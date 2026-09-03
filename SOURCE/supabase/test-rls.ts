// Test RLS (GĐ 2 M2.7 + UGC v2.0 Gate A) — kiểm tra cách ly dữ liệu.
//
// Phần 1 (cũ): cách ly attempt giữa 2 user + chặn truy cập chưa auth.
// Phần 2 (UGC v2.0, Task 1.2): cases R-a…R-o từ Design Doc §Test Strategy —
//   cách ly exam/question/report chưa published (bảng + Storage), positive
//   controls, write policies tác giả, backfill. ĐÂY LÀ GATE A (ADR-0001 kill
//   criterion) — không sang Phase 4/5/6 khi chưa xanh.
// Phần 3 (Answer-key lockdown, Security review 2026-08-03 Critical #1, cases
//   R-v…R-z) — required, blocking. Quyền CỘT + 2 hàm SECURITY DEFINER
//   (schema.sql §10) chỉ tồn tại trong Postgres thật; R-v là hồi quy trực tiếp
//   của lỗ hổng "học sinh đọc đáp án qua REST trước khi nộp bài".
// Phần 4 (Score write lockdown, Security review 2026-08-03 Critical #2, cases
//   S-a…S-e) — required, blocking. Quyền bảng (§11a) + EXECUTE grant của
//   record_exam_result (§11b) chỉ Postgres thật mới chứng minh được; S-a là hồi
//   quy trực tiếp của "học sinh POST điểm bịa vào /rest/v1/exam_results".
// Phần 5 (Takedown UGC, Security review 2026-08-03 Medium #7, cases M-a…M-d) —
//   required, blocking. Lệnh gỡ chỉ có nghĩa nếu tác giả không tự đưa ngược lại
//   được, và điều đó do RLS quyết định chứ không phải Server Action.
// Phần 6 (History feature, backend Design Doc v1.2, case H-a) — required,
//   blocking trước khi listMyHistory() coi là hoàn thành (xem block bên dưới,
//   sau Phần 5). Không có mock nào chứng minh được hành vi RLS thật
//   (chỉ Postgres thật mới chứng minh được) — history.int.test.ts obligation
//   (e) (mocked) chỉ chứng minh predicate còn được gắn vào query. Từ 2026-08-03
//   case này chạy trên chính embedded join mà listMyHistory() phát sau khi gộp
//   round-trip, kèm một positive control đi trước.
// Phần 7 (Engine 1 Adaptive AI, backend Design Doc §Test Boundaries + ADR-0011,
//   cases MM-a/MM-b/TL-a/TL-b) — required, blocking. Cách ly bảng
//   user_skill_mastery, ranh giới EXECUTE của record_skill_mastery() (§18) và
//   khoá đọc/ghi telemetry_log (§19). MM-b là hồi quy trực tiếp của "học sinh
//   tự ghi mastery bịa", tức bản sao ADR-0010 cho điểm số áp sang mastery.
// Phần 8 (User Support System v1, backend Design Doc §Test Boundaries + ADR-0012,
//   Work Plan Task 03, cases ST-a…ST-e) — required, blocking Early Verification
//   Point, backend. Cách ly bảng support_tickets (`support_tickets_select_own`),
//   khoá đọc/ghi tuyệt đối support_ticket_notes (`revoke all`, ZERO policy —
//   idiom giống exam_moderation_log) và policy insert-own trên bucket
//   support-screenshots (KHÔNG có select policy nào cho authenticated). ST-a..
//   ST-d ported từ supabase/__tests__/support.rls.service.e2e.test.ts; ST-e là
//   plan-added (đóng document review finding I001, AC-013).
// Phần 9 (Subscription, backend Design Doc §Security Considerations + ADR-0014,
//   Work Plan Task 1.5, cases PO-a…PO-f / SB-a…SB-g / PS-a/PS-b) — required,
//   blocking. Một nhóm từ chối cho MỖI đối tượng mà khối SUBSCRIPTION của
//   schema.sql tạo ra, không ít hơn: bảng `payment_orders`, bảng `subscriptions`
//   và hàm `record_payment_settlement()`. Đây là đường tiền: một JWT học sinh
//   ghi được vào một trong hai bảng, hay gọi được hàm thanh toán, là tự cấp
//   entitlement không trả tiền (AC-033).
//   SỐ NHÓM PHẢI BẰNG số đối tượng DDL: thêm một bảng cho khối này thì nhóm
//   từ chối của nó đi CÙNG thay đổi đó, không bao giờ đi sau.
//
// 2 user test được tạo qua Admin API (service_role, email_confirm=true) để KHÔNG
// gửi email xác nhận. Việc TEST RLS sau đó chỉ dùng ANON key + đăng nhập thật.
// User A = TÁC GIẢ (author), User B = KHÔNG PHẢI tác giả (non-author).
//
// Tiền đề: schema.sql (bản có UGC v2.0) + seed đã chạy; 2 bucket đã tạo
// (npx tsx supabase/setup-storage.ts).
// Cách chạy:  cd SOURCE && npx tsx supabase/test-rls.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Đọc env từ `.env.local`, hoặc từ file khác nếu đặt `SCHEMA_ENV_FILE` — cùng
// override đã có ở verify-schema.ts (TD-005), để chạy được cho prod mà không
// phải swap `.env.local` bằng tay:
//   SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/test-rls.ts
function loadEnv(): Record<string, string> {
  const file = process.env.SCHEMA_ENV_FILE?.trim() || ".env.local";
  const raw = readFileSync(resolve(__dirname, "..", file), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
  }
  return env;
}

const PASSWORD = "rls-test-password-123";
// Fixture riêng của Phần 1, KHÔNG còn phụ thuộc `supabase/seed.ts` (đề demo
// "exam-toan-10" của seed đó chỉ từng chạy trên dev — prod chỉ có UGC thật,
// không có demo content). Phụ thuộc cũ làm Phần 1 chết ngay ở INSERT đầu
// tiên với 23503 khi chạy trên môi trường chưa seed (phát hiện 2026-08-17
// khi chạy trên prod). Cùng khuôn tự cấp-phát/dọn dẹp fixture như mọi phần
// khác trong file (setup*Fixtures/cleanup*Fixtures bên dưới).
const EXAM_ID = "rls-legacy-attempt";
const EMAIL_A = "smithnguyen247+rlstesta@gmail.com";
const EMAIL_B = "smithnguyen247+rlstestb@gmail.com";

// Fixture UGC (Task 1.2) — id có prefix riêng để setup/cleanup idempotent.
const REVIEW_EXAM_ID = "rls-ugc-review"; // status='review' (chưa published), tác giả A
const PUBLISHED_EXAM_ID = "rls-ugc-published"; // status='published', tác giả A
const DELETE_EXAM_ID = "rls-ugc-delete"; // A tự xóa (R-g)
const UGC_EXAM_IDS = [REVIEW_EXAM_ID, PUBLISHED_EXAM_ID, DELETE_EXAM_ID];
const REVIEW_Q1 = `${REVIEW_EXAM_ID}-q1`;
const PUBLISHED_Q1 = `${PUBLISHED_EXAM_ID}-q1`;
// q2 nằm trong question_ids nhưng KHÔNG có row — dùng cho R-f (B insert câu
// hỏi "thuộc đề của A" phải bị chặn).
const REVIEW_Q2 = `${REVIEW_EXAM_ID}-q2`;
const UGC_QUESTION_IDS = [REVIEW_Q1, PUBLISHED_Q1, REVIEW_Q2];

const IMAGES_BUCKET = "exam-images";
const UPLOADS_BUCKET = "exam-uploads";
const REVIEW_IMAGE_PATH = `${REVIEW_EXAM_ID}/q1.png`;
const PUBLISHED_IMAGE_PATH = `${PUBLISHED_EXAM_ID}/q1.png`;
const REVIEW_UPLOAD_PATH = `${REVIEW_EXAM_ID}/questions.pdf`;

// Fixture Rating (ADR-0008, Backend Design Doc §Test Boundaries) — id prefix riêng,
// setup/cleanup idempotent như fixture UGC ở trên. Người rate = User A (đã có
// submitted attempt trên 2 trong 3 đề dưới đây) để R-u khớp đúng ngữ nghĩa Design
// Doc ("user B đọc rating của user A"); tác giả cũng = A (RLS không cấm tự rate đề
// của mình — chỉ cần published + có submitted attempt).
const RATING_PUBLISHED_EXAM_ID = "rls-rating-published"; // published, A CÓ submitted attempt (R-p/R-r/R-t/R-u)
const RATING_NO_ATTEMPT_EXAM_ID = "rls-rating-no-attempt"; // published, A KHÔNG có attempt (R-q)
const RATING_NON_PUBLISHED_EXAM_ID = "rls-rating-review"; // status='review', A CÓ submitted attempt (R-s)
const RATING_EXAM_IDS = [
  RATING_PUBLISHED_EXAM_ID,
  RATING_NO_ATTEMPT_EXAM_ID,
  RATING_NON_PUBLISHED_EXAM_ID,
];
const INITIAL_RATING_SCORES = { score_part1: 5, score_part2: 6, score_part3: 7 };
const UPDATED_RATING_SCORES = { score_part1: 9, score_part2: 3, score_part3: 8 };

// Fixture History (backend Design Doc v1.2, case H-a) — id prefix riêng, setup/
// cleanup idempotent như 2 fixture trên. A vừa là tác giả vừa là người làm bài
// (published, có 1 submitted attempt + exam_results tương ứng).
const HISTORY_EXAM_ID = "rls-history-h-a";

// Fixture Engine 1 Adaptive AI (backend Design Doc §Test Boundaries, schema.sql
// §18/§19, cases MM-a/MM-b/TL-a/TL-b) — id prefix riêng, setup/cleanup idempotent
// như 3 fixture trên. Chủ sở hữu dữ liệu = User A; User B đóng vai "người khác"
// đi đọc trộm. Phải TỰ tạo skill node fixture chứ không mượn taxonomy thật:
// taxonomy do seedSkillTaxonomy.ts seed (Task 5, chưa chạy) nên không được phép
// giả định nó đã tồn tại, và mượn node thật thì cleanup sẽ xoá nhầm nội dung.
const MASTERY_SKILL_ID = "rls-skill-mastery";

// Fixture User Support System v1 (backend Design Doc §Test Boundaries, schema.sql
// User Support System section, cases ST-a…ST-e) — setup/cleanup idempotent như 4
// fixture trên. `support_tickets.id` là uuid (không có text PK cố định để đặt
// prefix như các fixture khác) nên cleanup dọn theo user_id sở hữu (2 tài khoản
// RLS test A/B dành riêng cho việc này, không có vé thật nào khác); note bị xoá
// theo cascade khi vé bị xoá (schema.sql: `ticket_id ... on delete cascade`).
const SUPPORT_TICKET_A_MESSAGE = "[rls-support] Vé của A — test cách ly (ST-a/ST-b/ST-c/ST-d)";
const SUPPORT_TICKET_B_MESSAGE = "[rls-support] Vé của B — test cách ly (ST-a)";
const SUPPORT_NOTE_TEXT = "[rls-support] Ghi chú nội bộ trên vé của A (ST-b/ST-c)";
const SUPPORT_SCREENSHOTS_BUCKET = "support-screenshots";
const SUPPORT_SCREENSHOT_FILENAME = "rls-support-screenshot.png";

// Fixture Subscription (backend Design Doc §Security Considerations, khối
// SUBSCRIPTION của schema.sql, ADR-0014; cases PO-a…PO-f / SB-a…SB-g /
// PS-a/PS-b) — setup/cleanup idempotent như 5 fixture trên.
//
// Mã đơn cố ý nằm ở dải 9_9xx tỷ: to hơn mọi orderCode thật payOS từng sinh
// trong dự án này, nên không có cơ hội đụng một chứng từ tiền thật, và vẫn nằm
// dưới Number.MAX_SAFE_INTEGER (bigint đi qua JSON).
const SUB_ORDER_A = 9_900_000_000_001; // đơn của User A — chủ sở hữu (PO-a/PO-d/PO-e/PS-b)
const SUB_ORDER_B = 9_900_000_000_002; // đơn của User B — đối tượng đọc chéo (PO-b)
const SUB_ORDER_FORGED = 9_900_000_000_003; // đơn A tự ý insert (PO-c) — không bao giờ được tồn tại
const SUB_ORDER_CODES = [SUB_ORDER_A, SUB_ORDER_B, SUB_ORDER_FORGED];

// Hai giá trị mốc dưới đây KHÔNG chỉ để cho đẹp: chúng là vị từ hậu kiểm dọn
// dẹp, và cố ý KHÁC vị từ mà cleanup dùng để xoá (order_code / user_id). Dọn
// bằng một vị từ rồi xác nhận bằng chính vị từ đó thì một lệnh delete khớp 0
// dòng vẫn cho ra "đã sạch".
const SUB_ORDER_MEMO = "[rls-sub] fixture memo — khong phai don that";
const SUB_ANCHOR_SENTINEL = "2099-01-02T03:04:05.000Z";
const SUB_EXPIRES_SENTINEL = "2099-02-03T04:05:06.000Z";
const SUB_PENDING_UNTIL_SENTINEL = "2099-03-04T05:06:07.000Z";

let failures = 0;
function assert(cond: boolean, msg: string) {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    console.error(`  ✗ ${msg}`);
    failures += 1;
  }
}

/** Tạo (hoặc cập nhật) user đã confirm qua Admin API — không gửi email. */
async function ensureUser(admin: SupabaseClient, email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  // Đã tồn tại → tìm và đảm bảo password + đã confirm.
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw created.error;
  const upd = await admin.auth.admin.updateUserById(existing.id, {
    password: PASSWORD,
    email_confirm: true,
  });
  if (upd.error) throw upd.error;
  return existing.id;
}

/** Anon client đã đăng nhập user (RLS có hiệu lực). */
async function signInAs(
  url: string,
  anon: string,
  email: string,
): Promise<SupabaseClient> {
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({
    email,
    password: PASSWORD,
  });
  if (error) throw error;
  return client;
}

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

/** Xóa attempt mà Phần 3 (answer-key lockdown, R-y/R-z) tạo trên đề UGC — chạy
 *  trước VÀ sau để idempotent. PHẢI chạy trước khi xóa exams: exam_attempts.exam_id
 *  là FK KHÔNG cascade, attempt sót lại sẽ chặn cleanupUgcFixtures của lần chạy sau. */
async function cleanupAnswerKeyFixtures(admin: SupabaseClient) {
  await admin.from("exam_attempts").delete().in("exam_id", UGC_EXAM_IDS);
}

/** Xóa sạch fixture UGC (chạy trước VÀ sau để idempotent). */
async function cleanupUgcFixtures(admin: SupabaseClient) {
  await cleanupAnswerKeyFixtures(admin);
  await admin.from("exam_reports").delete().in("exam_id", UGC_EXAM_IDS);
  await admin.from("exams").delete().in("id", UGC_EXAM_IDS);
  await admin.from("questions").delete().in("id", UGC_QUESTION_IDS);
  await admin.storage
    .from(IMAGES_BUCKET)
    .remove([REVIEW_IMAGE_PATH, PUBLISHED_IMAGE_PATH]);
  await admin.storage.from(UPLOADS_BUCKET).remove([REVIEW_UPLOAD_PATH]);
}

/** Tạo fixture UGC qua service_role (bypass RLS): 3 exam của A + questions + objects. */
async function setupUgcFixtures(admin: SupabaseClient, authorId: string) {
  const baseExam = {
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "RLS Test Author",
  };
  const exams = await admin.from("exams").insert([
    {
      ...baseExam,
      id: REVIEW_EXAM_ID,
      title: "[RLS] Đề chưa published",
      question_ids: [REVIEW_Q1, REVIEW_Q2],
      status: "review",
    },
    {
      ...baseExam,
      id: PUBLISHED_EXAM_ID,
      title: "[RLS] Đề đã published",
      question_ids: [PUBLISHED_Q1],
      status: "published",
    },
    {
      ...baseExam,
      id: DELETE_EXAM_ID,
      title: "[RLS] Đề để A tự xóa",
      question_ids: [],
      status: "review",
    },
  ]);
  if (exams.error) throw exams.error;

  const baseQuestion = {
    choices: MCQ_CHOICES,
    correct_answer: "A",
    subject: "Toán",
    grade: 10,
    topic: "Toán",
  };
  const questions = await admin.from("questions").insert([
    { ...baseQuestion, id: REVIEW_Q1, content: "[RLS] Câu 1 (review)" },
    { ...baseQuestion, id: PUBLISHED_Q1, content: "[RLS] Câu 1 (published)" },
  ]);
  if (questions.error) throw questions.error;

  // Nội dung file không quan trọng — chỉ test quyền đọc object.
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const pdfBytes = new TextEncoder().encode("%PDF-1.4 rls-test");
  for (const [bucket, path, bytes, contentType] of [
    [IMAGES_BUCKET, REVIEW_IMAGE_PATH, pngBytes, "image/png"],
    [IMAGES_BUCKET, PUBLISHED_IMAGE_PATH, pngBytes, "image/png"],
    [UPLOADS_BUCKET, REVIEW_UPLOAD_PATH, pdfBytes, "application/pdf"],
  ] as const) {
    const up = await admin.storage
      .from(bucket)
      .upload(path, bytes, { contentType, upsert: true });
    if (up.error) throw up.error;
  }
}

/** Xóa sạch fixture Rating (chạy trước VÀ sau để idempotent). */
async function cleanupRatingFixtures(admin: SupabaseClient) {
  await admin.from("exam_difficulty_ratings").delete().in("exam_id", RATING_EXAM_IDS);
  await admin.from("exam_attempts").delete().in("exam_id", RATING_EXAM_IDS);
  await admin.from("exams").delete().in("id", RATING_EXAM_IDS);
}

/** Tạo fixture Rating qua service_role (bypass RLS): 3 đề của A + submitted attempts. */
async function setupRatingFixtures(admin: SupabaseClient, authorId: string, raterId: string) {
  const baseExam = {
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "RLS Test Author",
    question_ids: [] as string[],
  };
  const exams = await admin.from("exams").insert([
    {
      ...baseExam,
      id: RATING_PUBLISHED_EXAM_ID,
      title: "[RLS] Đề rating - đã published",
      status: "published",
    },
    {
      ...baseExam,
      id: RATING_NO_ATTEMPT_EXAM_ID,
      title: "[RLS] Đề rating - đã published, chưa có attempt",
      status: "published",
    },
    {
      ...baseExam,
      id: RATING_NON_PUBLISHED_EXAM_ID,
      title: "[RLS] Đề rating - chưa published",
      status: "review",
    },
  ]);
  if (exams.error) throw exams.error;

  // A có submitted attempt trên đề published (R-p/R-r/R-t/R-u) VÀ trên đề chưa
  // published (R-s, "otherwise-eligible"); KHÔNG có attempt nào trên
  // RATING_NO_ATTEMPT_EXAM_ID (R-q).
  const attempts = await admin.from("exam_attempts").insert([
    {
      user_id: raterId,
      exam_id: RATING_PUBLISHED_EXAM_ID,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
    {
      user_id: raterId,
      exam_id: RATING_NON_PUBLISHED_EXAM_ID,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    },
  ]);
  if (attempts.error) throw attempts.error;
}

/** Xóa sạch fixture History (chạy trước VÀ sau để idempotent). exam_results dọn
 *  theo cascade của exam_attempts (schema.sql: `attempt_id ... on delete cascade`). */
async function cleanupHistoryFixtures(admin: SupabaseClient) {
  await admin.from("exam_attempts").delete().eq("exam_id", HISTORY_EXAM_ID);
  await admin.from("exams").delete().eq("id", HISTORY_EXAM_ID);
}

/** Tạo fixture History qua service_role (bypass RLS): 1 đề published của A, A vừa
 *  là tác giả vừa là người làm bài, với 1 submitted attempt + 1 exam_results khớp. */
async function setupHistoryFixtures(admin: SupabaseClient, authorId: string) {
  const exam = await admin.from("exams").insert({
    id: HISTORY_EXAM_ID,
    title: "[RLS] Đề History H-a - published rồi bị unpublish",
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "RLS Test Author",
    question_ids: [] as string[],
    status: "published",
  });
  if (exam.error) throw exam.error;

  const attempt = await admin
    .from("exam_attempts")
    .insert({
      user_id: authorId,
      exam_id: HISTORY_EXAM_ID,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (attempt.error) throw attempt.error;

  const result = await admin.from("exam_results").insert({
    attempt_id: attempt.data.id as string,
    user_id: authorId,
    total_score: 10,
    correct: 1,
    total: 1,
    per_question: [],
    topic_breakdown: [],
  });
  if (result.error) throw result.error;
}

/** Xóa sạch fixture Engine 1 (chạy trước VÀ sau để idempotent).
 *
 *  THỨ TỰ QUAN TRỌNG: telemetry_log.skill_node_id là `on delete set null` (§19 —
 *  nhật ký vận hành không được biến mất theo node), nên nếu xoá skill node
 *  TRƯỚC thì dòng telemetry còn lại với skill_node_id = null, tức chính bộ lọc
 *  dưới đây không còn tìm thấy nó ở lần chạy sau → rác tích luỹ vĩnh viễn.
 *  user_skill_mastery thì `on delete cascade` nên xoá theo cách nào cũng sạch,
 *  vẫn xoá tường minh để không phụ thuộc vào cascade khi đọc code. */
async function cleanupEngine1Fixtures(admin: SupabaseClient) {
  await admin.from("telemetry_log").delete().eq("skill_node_id", MASTERY_SKILL_ID);
  await admin.from("user_skill_mastery").delete().eq("skill_node_id", MASTERY_SKILL_ID);
  await admin.from("skill_nodes").delete().eq("id", MASTERY_SKILL_ID);
}

/** Tạo fixture Engine 1 qua service_role (bypass RLS): 1 skill node + 1 dòng
 *  mastery của User A + 1 dòng telemetry của chính User A.
 *
 *  Dòng telemetry cố tình gắn user_id = A (chứ không để null): TL-a phải chứng
 *  minh được "kể cả dòng CỦA CHÍNH MÌNH cũng không đọc được" — nếu fixture để
 *  user_id null thì case xanh vì lý do sai (không có dòng nào thuộc về A). */
async function setupEngine1Fixtures(admin: SupabaseClient, ownerId: string) {
  const node = await admin
    .from("skill_nodes")
    .insert({ id: MASTERY_SKILL_ID, label_vi: "[RLS] Kỹ năng fixture" });
  if (node.error) throw node.error;

  const mastery = await admin.from("user_skill_mastery").insert({
    user_id: ownerId,
    skill_node_id: MASTERY_SKILL_ID,
    correct_count: 3,
    total_count: 5,
  });
  if (mastery.error) throw mastery.error;

  const telemetry = await admin.from("telemetry_log").insert({
    user_id: ownerId,
    event_type: "adaptive_route",
    skill_node_id: MASTERY_SKILL_ID,
    success: true,
  });
  if (telemetry.error) throw telemetry.error;
}

/** Xóa sạch fixture Support System (chạy trước VÀ sau để idempotent). Xóa vé
 *  theo user_id sở hữu -> support_ticket_notes bị xóa theo cascade. */
async function cleanupSupportFixtures(
  admin: SupabaseClient,
  authorAId: string,
  authorBId: string,
) {
  await admin.from("support_tickets").delete().in("user_id", [authorAId, authorBId]);
  await admin.storage
    .from(SUPPORT_SCREENSHOTS_BUCKET)
    .remove([`${authorAId}/${SUPPORT_SCREENSHOT_FILENAME}`]);
}

/** Tạo fixture Support System qua service_role (bypass RLS): 1 vé của A + 1 vé
 *  của B + 1 ghi chú nội bộ trên vé của A + 1 object ảnh chụp màn hình dưới
 *  đúng folder path của A trong bucket support-screenshots (schema.sql:
 *  `(storage.foldername(name))[1] = auth.uid()::text`). */
async function setupSupportFixtures(
  admin: SupabaseClient,
  authorAId: string,
  authorBId: string,
): Promise<{ ticketAId: string; ticketBId: string; screenshotPath: string }> {
  const ticketA = await admin
    .from("support_tickets")
    .insert({ user_id: authorAId, intent: "bug", message: SUPPORT_TICKET_A_MESSAGE })
    .select("id")
    .single();
  if (ticketA.error) throw ticketA.error;

  const ticketB = await admin
    .from("support_tickets")
    .insert({ user_id: authorBId, intent: "bug", message: SUPPORT_TICKET_B_MESSAGE })
    .select("id")
    .single();
  if (ticketB.error) throw ticketB.error;

  const ticketAId = ticketA.data.id as string;
  const ticketBId = ticketB.data.id as string;

  const note = await admin
    .from("support_ticket_notes")
    .insert({ ticket_id: ticketAId, note_text: SUPPORT_NOTE_TEXT });
  if (note.error) throw note.error;

  // Nội dung file không quan trọng — chỉ test quyền đọc object (giống UGC fixture).
  const pngBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const screenshotPath = `${authorAId}/${SUPPORT_SCREENSHOT_FILENAME}`;
  const upload = await admin.storage
    .from(SUPPORT_SCREENSHOTS_BUCKET)
    .upload(screenshotPath, pngBytes, { contentType: "image/png", upsert: true });
  if (upload.error) throw upload.error;

  return { ticketAId, ticketBId, screenshotPath };
}

/** Lỗi trả về có thuộc hạng QUYỀN hay không.
 *
 *  ĐÂY LÀ CHỖ CẢ PHẦN 9 SỐNG HOẶC CHẾT. Một case "insert bị chặn" mà chỉ kiểm
 *  `error !== null` sẽ XANH khi payload thiếu một cột NOT NULL (23502), sai FK
 *  (23503), trùng khoá (23505) hay sai kiểu (22P02) — tức xanh trong khi không
 *  chứng minh được một chữ nào về quyền. Chỉ 42501 (permission denied cho bảng,
 *  do `revoke`) và thông báo vi phạm row-level security (do KHÔNG có policy
 *  ghi) mới là "bị TỪ CHỐI CẤP QUYỀN"; mọi mã ràng buộc đều bị loại. */
function isAuthorizationDenial(
  error: { code?: string; message?: string } | null,
): boolean {
  if (!error) return false;
  return (
    error.code === "42501" ||
    /permission denied|violates row-level security policy/i.test(error.message ?? "")
  );
}

/** Một dòng `payment_orders` ĐẦY ĐỦ và hợp lệ về MỌI ràng buộc của bảng: đủ 8
 *  cột NOT NULL, `amount > 0`, `status` nằm trong CHECK, `user_id` là FK có
 *  thật, `order_code` chưa tồn tại.
 *
 *  MỘT builder dùng cho CẢ HAI phía là chủ ý: service_role tạo fixture bằng nó
 *  (và thành công), rồi JWT học sinh gửi ĐÚNG hình dạng đó và phải nhận 42501.
 *  Nhờ vậy "bị từ chối vì QUYỀN" tách bạch được với "bị từ chối vì DỮ LIỆU" —
 *  nếu payload có gì sai thì bước fixture đã ném trước khi tới assertion. */
function buildFixtureOrderRow(orderCode: number, userId: string) {
  return {
    order_code: orderCode,
    user_id: userId,
    amount: 199_000,
    status: "pending",
    pending_until: SUB_PENDING_UNTIL_SENTINEL,
    // payOS `qrCode` là PAYLOAD VietQR/EMVCo, không phải URL (UI-D14) — chuỗi
    // dưới đây chỉ cần đúng KIỂU, nội dung không được quét bởi ai.
    qr_payload: "[rls-sub] 00020101021138540010A00000072701",
    account_number: "0000000000",
    account_name: "[RLS-SUB] TAI KHOAN FIXTURE",
    memo: SUB_ORDER_MEMO,
  };
}

/** Một dòng `subscriptions` đầy đủ (3 cột NOT NULL không có default). Cùng vai
 *  trò builder-dùng-chung như buildFixtureOrderRow ở trên. */
function buildFixtureSubscriptionRow(userId: string) {
  return {
    user_id: userId,
    expires_at: SUB_EXPIRES_SENTINEL,
    period_anchor_at: SUB_ANCHOR_SENTINEL,
  };
}

/** Xóa sạch fixture Subscription (chạy trước VÀ sau để idempotent).
 *
 *  Xoá đơn theo `order_code` và entitlement theo `user_id` — vị từ user_id cố
 *  ý RỘNG hơn fixture, để một dòng subscriptions do lỗi quyền (hoặc do hàm
 *  settlement lỡ chạy) sinh ra cho A/B cũng bị cuốn đi, không chỉ dòng mang
 *  giá trị mốc. Hậu kiểm ở cuối Phần 9 dùng vị từ khác hẳn. */
async function cleanupSubscriptionFixtures(
  admin: SupabaseClient,
  authorAId: string,
  authorBId: string,
) {
  await admin.from("payment_orders").delete().in("order_code", SUB_ORDER_CODES);
  await admin.from("subscriptions").delete().in("user_id", [authorAId, authorBId]);
}

/** Tạo fixture Subscription qua service_role (bypass RLS): 1 đơn 'pending' của
 *  A + 1 đơn của B + 1 dòng subscriptions của B.
 *
 *  A CỐ Ý chưa có dòng subscriptions ở bước này: `subscriptions.user_id` là
 *  PRIMARY KEY, nên nếu A đã có dòng thì lệnh insert bị từ chối ở SB-c sẽ trùng
 *  khoá (23505) và case xanh vì lý do sai. Dòng của A được tạo SAU SB-c, ngay
 *  trước SB-d/SB-e. */
async function setupSubscriptionFixtures(
  admin: SupabaseClient,
  authorAId: string,
  authorBId: string,
) {
  const orders = await admin
    .from("payment_orders")
    .insert([
      buildFixtureOrderRow(SUB_ORDER_A, authorAId),
      buildFixtureOrderRow(SUB_ORDER_B, authorBId),
    ]);
  if (orders.error) throw orders.error;

  const subB = await admin
    .from("subscriptions")
    .insert(buildFixtureSubscriptionRow(authorBId));
  if (subB.error) throw subB.error;
}

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !service)
    throw new Error("Thiếu URL / ANON_KEY / SERVICE_ROLE_KEY trong .env.local");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userAId = await ensureUser(admin, EMAIL_A);
  const userBId = await ensureUser(admin, EMAIL_B);

  const userA = await signInAs(url, anon, EMAIL_A); // TÁC GIẢ
  const userB = await signInAs(url, anon, EMAIL_B); // non-author
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ==========================================================================
  // Phần 1 — attempts (GĐ 2 M2.7, giữ nguyên)
  // ==========================================================================

  // Idempotent cleanup-trước rồi tạo fixture riêng (service_role) — xem ghi
  // chú ở khai báo EXAM_ID.
  await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
  await admin.from("exams").delete().eq("id", EXAM_ID);
  const legacyExam = await admin.from("exams").insert({
    id: EXAM_ID,
    title: "[RLS] Legacy attempt isolation fixture",
    question_ids: [],
    duration_minutes: 15,
    subject: "Toán",
    grade: 10,
    status: "published",
  });
  if (legacyExam.error) throw legacyExam.error;

  // --- User A tạo một attempt -------------------------------------------
  const created = await userA
    .from("exam_attempts")
    .insert({ exam_id: EXAM_ID })
    .select("id")
    .single();
  if (created.error) throw created.error;
  const attemptId = created.data.id as string;
  console.log(`\nUser A tạo attempt ${attemptId}\n`);

  console.log("RLS checks (attempts):");

  // 1. A đọc được attempt của chính mình (positive control).
  const aRead = await userA
    .from("exam_attempts")
    .select("id")
    .eq("id", attemptId);
  assert(
    !aRead.error && aRead.data?.length === 1,
    "User A đọc được attempt của chính mình",
  );

  // 2. B KHÔNG đọc được attempt của A.
  const bRead = await userB
    .from("exam_attempts")
    .select("id")
    .eq("id", attemptId);
  assert(
    !bRead.error && (bRead.data?.length ?? 0) === 0,
    "User B KHÔNG đọc được attempt của A (RLS chặn)",
  );

  // 3. B KHÔNG cập nhật được attempt của A.
  const bUpdate = await userB
    .from("exam_attempts")
    .update({ status: "submitted" })
    .eq("id", attemptId)
    .select("id");
  assert(
    !bUpdate.error && (bUpdate.data?.length ?? 0) === 0,
    "User B KHÔNG update được attempt của A",
  );

  // 4. Client chưa đăng nhập KHÔNG đọc được questions (RLS to authenticated).
  const anonQ = await anonClient.from("questions").select("id");
  assert(
    (anonQ.data?.length ?? 0) === 0,
    "Client chưa auth KHÔNG đọc được questions",
  );

  // 5. Client chưa đăng nhập KHÔNG đọc được exam_attempts.
  const anonA = await anonClient.from("exam_attempts").select("id");
  assert(
    (anonA.data?.length ?? 0) === 0,
    "Client chưa auth KHÔNG đọc được exam_attempts",
  );

  // 6. Authenticated user ĐỌC được questions (positive control).
  const aQ = await userA.from("questions").select("id");
  assert(
    !aQ.error && (aQ.data?.length ?? 0) > 0,
    "User đã auth đọc được questions",
  );

  // Dọn dẹp: A xóa attempt test, service_role dọn nốt fixture đề.
  await userA.from("exam_attempts").delete().eq("id", attemptId);
  await admin.from("exams").delete().eq("id", EXAM_ID);

  // ==========================================================================
  // Phần 2 — UGC v2.0 Gate A: R-a…R-o (Task 1.2)
  // ==========================================================================
  console.log("\nUGC Gate A — setup fixture (service_role)…");
  await cleanupUgcFixtures(admin);
  await setupUgcFixtures(admin, userAId);

  console.log("\nRating — setup fixture (service_role)…");
  await cleanupRatingFixtures(admin);
  await setupRatingFixtures(admin, userAId, userAId);

  console.log("\nRLS checks (UGC R-a…R-l):");

  // R-a. Non-author đọc exam CHƯA published theo id → 0 row.
  const ra = await userB.from("exams").select("id").eq("id", REVIEW_EXAM_ID);
  assert(
    !ra.error && (ra.data?.length ?? 0) === 0,
    "R-a: Non-author KHÔNG đọc được exam chưa published",
  );

  // R-b. Non-author đọc questions của exam chưa published → 0 row.
  const rb = await userB.from("questions").select("id").eq("id", REVIEW_Q1);
  assert(
    !rb.error && (rb.data?.length ?? 0) === 0,
    "R-b: Non-author KHÔNG đọc được questions của exam chưa published",
  );

  // R-c. Anonymous đọc exam + questions chưa published → 0 row.
  const rcE = await anonClient
    .from("exams")
    .select("id")
    .eq("id", REVIEW_EXAM_ID);
  const rcQ = await anonClient
    .from("questions")
    .select("id")
    .eq("id", REVIEW_Q1);
  assert(
    (rcE.data?.length ?? 0) === 0 && (rcQ.data?.length ?? 0) === 0,
    "R-c: Anonymous KHÔNG đọc được exam/questions chưa published",
  );

  // R-d. Tác giả đọc được exam + questions chưa published của mình (positive control).
  const rdE = await userA.from("exams").select("id").eq("id", REVIEW_EXAM_ID);
  const rdQ = await userA.from("questions").select("id").eq("id", REVIEW_Q1);
  assert(
    !rdE.error &&
      (rdE.data?.length ?? 0) === 1 &&
      !rdQ.error &&
      (rdQ.data?.length ?? 0) === 1,
    "R-d: Tác giả đọc được exam + questions chưa published của mình",
  );

  // R-e. Non-author đọc được exam UGC ĐÃ published + questions (positive control).
  const reE = await userB
    .from("exams")
    .select("id, author_display_name")
    .eq("id", PUBLISHED_EXAM_ID);
  const reQ = await userB
    .from("questions")
    .select("id")
    .eq("id", PUBLISHED_Q1);
  assert(
    !reE.error &&
      (reE.data?.length ?? 0) === 1 &&
      !reQ.error &&
      (reQ.data?.length ?? 0) === 1,
    "R-e: Non-author ĐỌC được exam UGC đã published + questions",
  );

  // R-f. Non-author insert/update/delete trên exam/questions của người khác → bị chặn.
  const rfInsertExam = await userB.from("exams").insert({
    id: "rls-ugc-bogus",
    title: "[RLS] B giả mạo",
    question_ids: [],
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    status: "review",
    author_id: userAId, // giả mạo tác giả → with check phải chặn
  });
  assert(
    rfInsertExam.error != null,
    "R-f: Non-author KHÔNG insert được exam mạo danh tác giả khác",
  );
  const rfUpdateExam = await userB
    .from("exams")
    .update({ title: "[RLS] B sửa trộm" })
    .eq("id", REVIEW_EXAM_ID)
    .select("id");
  assert(
    !rfUpdateExam.error && (rfUpdateExam.data?.length ?? 0) === 0,
    "R-f: Non-author KHÔNG update được exam của A",
  );
  const rfDeleteExam = await userB
    .from("exams")
    .delete()
    .eq("id", REVIEW_EXAM_ID)
    .select("id");
  assert(
    !rfDeleteExam.error && (rfDeleteExam.data?.length ?? 0) === 0,
    "R-f: Non-author KHÔNG delete được exam của A",
  );
  const rfInsertQ = await userB.from("questions").insert({
    id: REVIEW_Q2, // nằm trong question_ids đề của A nhưng chưa có row
    content: "[RLS] B chèn câu hỏi vào đề của A",
    choices: MCQ_CHOICES,
    correct_answer: "A",
    subject: "Toán",
    grade: 10,
    topic: "Toán",
  });
  assert(
    rfInsertQ.error != null,
    "R-f: Non-author KHÔNG insert được question vào đề của A",
  );
  const rfUpdateQ = await userB
    .from("questions")
    .update({ content: "[RLS] B sửa trộm câu hỏi" })
    .eq("id", PUBLISHED_Q1)
    .select("id");
  assert(
    !rfUpdateQ.error && (rfUpdateQ.data?.length ?? 0) === 0,
    "R-f: Non-author KHÔNG update được question của A",
  );
  const rfDeleteQ = await userB
    .from("questions")
    .delete()
    .eq("id", PUBLISHED_Q1)
    .select("id");
  assert(
    !rfDeleteQ.error && (rfDeleteQ.data?.length ?? 0) === 0,
    "R-f: Non-author KHÔNG delete được question của A",
  );

  // R-g. Tác giả xóa được exam của chính mình (mọi status).
  const rg = await userA
    .from("exams")
    .delete()
    .eq("id", DELETE_EXAM_ID)
    .select("id");
  assert(
    !rg.error && (rg.data?.length ?? 0) === 1,
    "R-g: Tác giả xóa được exam của chính mình",
  );

  // R-h. Non-owner update user_profiles của người khác → 0 row (with check).
  const rh = await userB
    .from("user_profiles")
    .update({ display_name: "[RLS] hacked" })
    .eq("id", userAId)
    .select("id");
  assert(
    !rh.error && (rh.data?.length ?? 0) === 0,
    "R-h: Non-owner KHÔNG update được user_profiles của người khác",
  );

  // R-i/R-j/R-k — exam_reports.
  // Setup: B report exam đã published (hợp lệ).
  const reportInsert = await userB.from("exam_reports").insert({
    exam_id: PUBLISHED_EXAM_ID,
    reporter_display_name: "RLS Test B",
    reason: "Nội dung không phù hợp (RLS test)",
  });
  assert(
    reportInsert.error == null,
    "R-i (setup): B report được exam đã published",
  );

  // R-i. A (không phải reporter) KHÔNG đọc được report của B; B đọc được report của mình.
  const riA = await userA
    .from("exam_reports")
    .select("id")
    .eq("exam_id", PUBLISHED_EXAM_ID);
  const riB = await userB
    .from("exam_reports")
    .select("id")
    .eq("exam_id", PUBLISHED_EXAM_ID);
  assert(
    !riA.error &&
      (riA.data?.length ?? 0) === 0 &&
      !riB.error &&
      (riB.data?.length ?? 0) === 1,
    "R-i: Report chỉ reporter đọc được (A: 0 row, B: 1 row)",
  );

  // R-j. Report exam CHƯA published → bị chặn (insert check).
  const rj = await userB.from("exam_reports").insert({
    exam_id: REVIEW_EXAM_ID,
    reason: "Report đề chưa published (phải bị chặn)",
  });
  assert(rj.error != null, "R-j: KHÔNG report được exam chưa published");

  // R-k. Report trùng (cùng exam, cùng user) → unique violation.
  const rk = await userB.from("exam_reports").insert({
    exam_id: PUBLISHED_EXAM_ID,
    reason: "Report lần 2 (phải bị chặn unique)",
  });
  assert(
    rk.error != null && rk.error.code === "23505",
    "R-k: Report trùng bị chặn bởi unique(exam_id, reporter_id)",
  );

  // R-l. Backfill: seed (author_id null) tất cả đã 'published'; catalog giữ nguyên;
  //      questions seed mặc định question_type='mcq'.
  const rlSeedAll = await admin
    .from("exams")
    .select("id", { count: "exact", head: true })
    .is("author_id", null);
  const rlSeedPublished = await admin
    .from("exams")
    .select("id", { count: "exact", head: true })
    .is("author_id", null)
    .eq("status", "published");
  const rlSeedQ = await admin
    .from("questions")
    .select("question_type")
    .like("id", "q-%")
    .limit(1)
    .single();
  assert(
    (rlSeedAll.count ?? 0) > 0 &&
      rlSeedAll.count === rlSeedPublished.count &&
      rlSeedQ.data?.question_type === "mcq",
    `R-l: Backfill giữ nguyên seed (${rlSeedPublished.count}/${rlSeedAll.count} published, question_type='mcq')`,
  );

  console.log("\nStorage checks (UGC R-m…R-o):");

  // R-m. Non-author KHÔNG tải được hình của exam chưa published.
  const rm = await userB.storage
    .from(IMAGES_BUCKET)
    .download(REVIEW_IMAGE_PATH);
  assert(
    rm.error != null && rm.data == null,
    "R-m: Non-author KHÔNG đọc được hình của exam chưa published",
  );

  // R-n. Hình của exam đã published đọc được (B); tác giả đọc được hình chưa published của mình.
  const rnB = await userB.storage
    .from(IMAGES_BUCKET)
    .download(PUBLISHED_IMAGE_PATH);
  const rnA = await userA.storage
    .from(IMAGES_BUCKET)
    .download(REVIEW_IMAGE_PATH);
  assert(
    rnB.error == null && rnB.data != null,
    "R-n: Non-author ĐỌC được hình của exam đã published",
  );
  assert(
    rnA.error == null && rnA.data != null,
    "R-n: Tác giả đọc được hình chưa published của chính mình",
  );

  // R-o. Non-author KHÔNG tải được file gốc trong exam-uploads của người khác.
  const ro = await userB.storage
    .from(UPLOADS_BUCKET)
    .download(REVIEW_UPLOAD_PATH);
  assert(
    ro.error != null && ro.data == null,
    "R-o: Non-author KHÔNG đọc được file gốc (exam-uploads) của người khác",
  );

  console.log("\nRLS checks (Rating R-p…R-u):");

  // R-p. User đủ điều kiện (đề published + đã có submitted attempt) insert rating
  //      thành công (positive control).
  const rp = await userA.from("exam_difficulty_ratings").insert({
    exam_id: RATING_PUBLISHED_EXAM_ID,
    ...INITIAL_RATING_SCORES,
  });
  const rpRow = await admin
    .from("exam_difficulty_ratings")
    .select("score_part1, score_part2, score_part3")
    .eq("exam_id", RATING_PUBLISHED_EXAM_ID)
    .eq("user_id", userAId);
  assert(
    rp.error == null &&
      rpRow.data?.length === 1 &&
      rpRow.data[0].score_part1 === INITIAL_RATING_SCORES.score_part1 &&
      rpRow.data[0].score_part2 === INITIAL_RATING_SCORES.score_part2 &&
      rpRow.data[0].score_part3 === INITIAL_RATING_SCORES.score_part3,
    "R-p: User đủ điều kiện insert rating thành công (đúng 1 row, đúng điểm)",
  );

  // R-q. User KHÔNG có submitted attempt trên đề (dù đề đã published) → insert bị
  //      chặn, 0 row.
  const rq = await userA.from("exam_difficulty_ratings").insert({
    exam_id: RATING_NO_ATTEMPT_EXAM_ID,
    ...INITIAL_RATING_SCORES,
  });
  const rqRow = await admin
    .from("exam_difficulty_ratings")
    .select("id")
    .eq("exam_id", RATING_NO_ATTEMPT_EXAM_ID)
    .eq("user_id", userAId);
  assert(
    rq.error != null && (rqRow.data?.length ?? 0) === 0,
    "R-q: User KHÔNG có submitted attempt → insert rating bị chặn (0 row)",
  );

  // R-r. Cùng user đủ điều kiện rate lại (upsert) với điểm mới → vẫn đúng 1 row,
  //      điểm là điểm MỚI NHẤT (update-own path), không tạo row thứ hai.
  const rr = await userA.from("exam_difficulty_ratings").upsert(
    {
      exam_id: RATING_PUBLISHED_EXAM_ID,
      user_id: userAId,
      ...UPDATED_RATING_SCORES,
    },
    { onConflict: "exam_id,user_id" },
  );
  const rrRow = await admin
    .from("exam_difficulty_ratings")
    .select("score_part1, score_part2, score_part3")
    .eq("exam_id", RATING_PUBLISHED_EXAM_ID)
    .eq("user_id", userAId);
  assert(
    rr.error == null &&
      rrRow.data?.length === 1 &&
      rrRow.data[0].score_part1 === UPDATED_RATING_SCORES.score_part1 &&
      rrRow.data[0].score_part2 === UPDATED_RATING_SCORES.score_part2 &&
      rrRow.data[0].score_part3 === UPDATED_RATING_SCORES.score_part3,
    "R-r: Rate lại (upsert) → vẫn đúng 1 row, điểm là điểm mới nhất",
  );

  // R-s. User đủ điều kiện (CÓ submitted attempt) nhưng đề CHƯA published → write
  //      bị chặn (with-check published clause), 0 row.
  const rs = await userA.from("exam_difficulty_ratings").insert({
    exam_id: RATING_NON_PUBLISHED_EXAM_ID,
    ...INITIAL_RATING_SCORES,
  });
  const rsRow = await admin
    .from("exam_difficulty_ratings")
    .select("id")
    .eq("exam_id", RATING_NON_PUBLISHED_EXAM_ID)
    .eq("user_id", userAId);
  assert(
    rs.error != null && (rsRow.data?.length ?? 0) === 0,
    "R-s: Đề CHƯA published → write rating bị chặn dù user đủ điều kiện khác (0 row)",
  );

  // R-t. Raw duplicate INSERT (không phải upsert) trên cùng (exam_id, user_id) đã có
  //      row (từ R-p/R-r) → vi phạm unique constraint (23505), vẫn giữ đúng 1 row.
  const rt = await userA.from("exam_difficulty_ratings").insert({
    exam_id: RATING_PUBLISHED_EXAM_ID,
    ...INITIAL_RATING_SCORES,
  });
  const rtRow = await admin
    .from("exam_difficulty_ratings")
    .select("id")
    .eq("exam_id", RATING_PUBLISHED_EXAM_ID)
    .eq("user_id", userAId);
  assert(
    rt.error != null &&
      rt.error.code === "23505" &&
      rtRow.data?.length === 1,
    "R-t: Raw duplicate INSERT bị chặn bởi unique(exam_id, user_id) (23505), vẫn 1 row",
  );

  // R-u. select-own confinement: B KHÔNG đọc được rating của A; A đọc được rating
  //      của chính mình.
  const ruB = await userB
    .from("exam_difficulty_ratings")
    .select("id")
    .eq("exam_id", RATING_PUBLISHED_EXAM_ID);
  const ruA = await userA
    .from("exam_difficulty_ratings")
    .select("id")
    .eq("exam_id", RATING_PUBLISHED_EXAM_ID);
  assert(
    !ruB.error &&
      (ruB.data?.length ?? 0) === 0 &&
      !ruA.error &&
      (ruA.data?.length ?? 0) === 1,
    "R-u: B KHÔNG đọc được rating của A (0 row); A đọc được rating của chính mình (1 row)",
  );

  // ==========================================================================
  // Phần 3 — Answer-key lockdown Gate (Security review 2026-08-03 Critical #1,
  // schema.sql §10): R-v…R-z. REQUIRED, BLOCKING.
  //
  // Đây là tầng bảo vệ mà KHÔNG mock nào chứng minh được: quyền CỘT
  // (GRANT/REVOKE) và 2 hàm SECURITY DEFINER chỉ tồn tại trong Postgres thật.
  // Mock trong submitExam.int.test.ts/getResult.int.test.ts chỉ chứng minh
  // được app code GỌI đúng RPC, không chứng minh được rằng đường cũ
  // (`GET /rest/v1/questions?select=correct_answer`) đã thực sự bị đóng.
  //
  // R-v là hồi quy trực tiếp của chính lỗ hổng được báo cáo: học sinh đăng nhập
  // đọc thẳng đáp án của đề published qua REST API.
  // ==========================================================================
  console.log("\nAnswer-key lockdown — setup fixture (service_role)…");
  await cleanupAnswerKeyFixtures(admin);

  console.log("\nRLS checks (answer-key lockdown R-v…R-z):");

  // R-v. CHÍNH LỖ HỔNG: B (đã đăng nhập, không phải tác giả) đọc thẳng cột đáp
  //      án của một đề ĐÃ PUBLISHED → phải LỖI quyền (42501), không phải trả
  //      dữ liệu. Kèm positive control: cột an toàn vẫn đọc được bình thường —
  //      chứng minh REVOKE nhắm đúng cột chứ không khoá cả bảng.
  const rvDenied = await userB
    .from("questions")
    .select("id, correct_answer")
    .eq("id", PUBLISHED_Q1);
  const rvAllowed = await userB
    .from("questions")
    .select("id, content, choices, question_type, part_number, image_url")
    .eq("id", PUBLISHED_Q1);
  assert(
    rvDenied.error !== null &&
      !rvAllowed.error &&
      (rvAllowed.data?.length ?? 0) === 1,
    `R-v: Học sinh KHÔNG đọc được questions.correct_answer qua REST (lỗi: ${rvDenied.error?.code ?? "KHÔNG CÓ LỖI — LỖ HỔNG CÒN MỞ"}); cột an toàn vẫn đọc được`,
  );

  // R-v2. Hai cột đáp án còn lại đóng cùng cơ chế (sub_answers Đ/S từng ý,
  //       essay_answer dùng cho cả short_answer) — cột nào lọt cũng đủ hỏng
  //       tính toàn vẹn của đề.
  const rvSub = await userB.from("questions").select("sub_answers").eq("id", PUBLISHED_Q1);
  const rvEssay = await userB.from("questions").select("essay_answer").eq("id", PUBLISHED_Q1);
  assert(
    rvSub.error !== null && rvEssay.error !== null,
    "R-v2: sub_answers + essay_answer cũng KHÔNG đọc được qua REST",
  );

  // R-w. exam_answer_key(): người không phải tác giả VÀ chưa nộp bài đề đó →
  //      0 dòng (không lỗi — hàm fail-closed bằng WHERE, không bằng exception).
  //      Anonymous thì không gọi được (EXECUTE chỉ cấp cho `authenticated`).
  const rwB = await userB.rpc("exam_answer_key", { p_exam_id: PUBLISHED_EXAM_ID });
  const rwAnon = await anonClient.rpc("exam_answer_key", { p_exam_id: PUBLISHED_EXAM_ID });
  assert(
    !rwB.error && (rwB.data?.length ?? 0) === 0 && rwAnon.error?.code === "42501",
    `R-w: Chưa nộp bài + không phải tác giả -> exam_answer_key trả 0 dòng; anonymous bị chặn EXECUTE (mong đợi 42501, nhận: ${rwAnon.error?.code ?? "KHÔNG CÓ LỖI — anon vẫn gọi được hàm"})`,
  );

  // R-x. Positive control nhánh TÁC GIẢ: A đọc được đáp án đề CHƯA published
  //      của mình (màn review S-03 của Layer 4 sống nhờ nhánh này).
  const rxA = await userA.rpc("exam_answer_key", { p_exam_id: REVIEW_EXAM_ID });
  const rxRow = (rxA.data as Array<{ id: string; correct_answer: string }> | null)?.[0];
  assert(
    !rxA.error && rxA.data?.length === 1 && rxRow?.id === REVIEW_Q1 && rxRow?.correct_answer === "A",
    "R-x: Tác giả đọc được đáp án đề chưa published của mình qua exam_answer_key (positive control)",
  );

  // R-y. claim_attempt_answer_key() trên attempt CỦA NGƯỜI KHÁC → 0 dòng, VÀ
  //      attempt của nạn nhân không bị đụng tới (không bị nộp hộ).
  const aAttempt = await admin
    .from("exam_attempts")
    .insert({ user_id: userAId, exam_id: PUBLISHED_EXAM_ID, status: "in_progress" })
    .select("id")
    .single();
  if (aAttempt.error) throw aAttempt.error;
  const ryB = await userB.rpc("claim_attempt_answer_key", {
    p_attempt_id: aAttempt.data.id as string,
  });
  const ryStatus = await admin
    .from("exam_attempts")
    .select("status")
    .eq("id", aAttempt.data.id as string)
    .single();
  assert(
    !ryB.error &&
      (ryB.data?.length ?? 0) === 0 &&
      (ryStatus.data as { status: string } | null)?.status === "in_progress",
    "R-y: claim_attempt_answer_key trên attempt của người khác -> 0 dòng, attempt nạn nhân vẫn 'in_progress'",
  );

  // R-z. Nhánh chính: B claim attempt CỦA MÌNH → nhận được đáp án, VÀ attempt
  //      bị khóa 'submitted' trong cùng transaction. Chính tính atomic này làm
  //      cho việc trả đáp án cho JWT học sinh trở nên an toàn — lấy được đáp án
  //      thì bài đã nộp xong, không dùng để gian lận được nữa.
  const bAttempt = await admin
    .from("exam_attempts")
    .insert({ user_id: userBId, exam_id: PUBLISHED_EXAM_ID, status: "in_progress" })
    .select("id")
    .single();
  if (bAttempt.error) throw bAttempt.error;
  const rzClaim = await userB.rpc("claim_attempt_answer_key", {
    p_attempt_id: bAttempt.data.id as string,
  });
  const rzStatus = await admin
    .from("exam_attempts")
    .select("status, submitted_at")
    .eq("id", bAttempt.data.id as string)
    .single();
  const rzRow = (rzClaim.data as Array<{ correct_answer: string }> | null)?.[0];
  assert(
    !rzClaim.error &&
      rzClaim.data?.length === 1 &&
      rzRow?.correct_answer === "A" &&
      (rzStatus.data as { status: string } | null)?.status === "submitted",
    "R-z: B claim attempt của chính mình -> nhận đáp án VÀ attempt bị khóa 'submitted' cùng lúc (atomic)",
  );

  // R-z1. Leo thang mà chính bản vá này có thể mở ra nếu làm ẩu: attempt tạo
  //       được trên đề BẤT KỲ (attempts_insert_own chỉ soi user_id; startAttempt
  //       chưa gate published), còn claim_attempt_answer_key là SECURITY DEFINER
  //       nên không còn RLS che. Nếu nhánh (2) của exam_answer_key thiếu điều
  //       kiện `status = 'published'` thì B tự nộp một attempt trên ĐỀ NHÁP của
  //       A là đọc được đáp án bản nháp. Phải trả 0 dòng.
  const bDraftAttempt = await admin
    .from("exam_attempts")
    .insert({ user_id: userBId, exam_id: REVIEW_EXAM_ID, status: "in_progress" })
    .select("id")
    .single();
  if (bDraftAttempt.error) throw bDraftAttempt.error;
  const rz1Claim = await userB.rpc("claim_attempt_answer_key", {
    p_attempt_id: bDraftAttempt.data.id as string,
  });
  const rz1Read = await userB.rpc("exam_answer_key", { p_exam_id: REVIEW_EXAM_ID });
  assert(
    !rz1Claim.error &&
      (rz1Claim.data?.length ?? 0) === 0 &&
      !rz1Read.error &&
      (rz1Read.data?.length ?? 0) === 0,
    "R-z1: Tự tạo+nộp attempt trên đề CHƯA published của người khác -> vẫn 0 dòng (không leo thang qua SECURITY DEFINER)",
  );

  // R-z2. Sau khi đã nộp, nhánh (2) của exam_answer_key mở ra: màn Chi tiết đọc
  //       được đáp án. Cùng một user, cùng một đề, khác kết quả so với R-w —
  //       chứng minh gate là "đã nộp bài", không phải "đã đăng nhập".
  const rz2 = await userB.rpc("exam_answer_key", { p_exam_id: PUBLISHED_EXAM_ID });
  assert(
    !rz2.error &&
      rz2.data?.length === 1 &&
      (rz2.data as Array<{ correct_answer: string }>)[0].correct_answer === "A",
    "R-z2: Sau khi nộp bài, chính user đó đọc được đáp án qua exam_answer_key (màn Chi tiết)",
  );

  await cleanupAnswerKeyFixtures(admin);

  // ==========================================================================
  // Phần 4 — Score write lockdown Gate (Security review 2026-08-03 Critical #2,
  // schema.sql §11): S-a…S-e. REQUIRED, BLOCKING.
  //
  // Trước bản vá, `results_insert_own` chỉ check `user_id = auth.uid()`, nên
  // học sinh POST thẳng một dòng điểm bịa vào /rest/v1/exam_results là có ngay
  // 10 điểm — và vì attempt_id là UNIQUE, còn chiếm được chỗ attempt của người
  // khác khiến lần nộp bài thật của họ chết vì 23505.
  //
  // Cưỡng chế nay nằm ở QUYỀN BẢNG (§11a thu hồi INSERT của client) + hàm
  // record_exam_result chỉ service_role gọi được (§11b). Cả hai chỉ Postgres
  // thật mới chứng minh được; mock trong submitExam.int.test.ts chỉ chứng minh
  // được app code GỌI đúng đường.
  // ==========================================================================
  console.log("\nScore write lockdown — setup fixture (service_role)…");
  await cleanupAnswerKeyFixtures(admin);

  // Attempt ĐÃ NỘP của A, chưa có exam_results — bối cảnh "đáng lẽ hợp lệ nhất"
  // để ghi điểm. Nếu ngay cả nó cũng bị chặn thì client không còn đường nào.
  const scoredAttempt = await admin
    .from("exam_attempts")
    .insert({
      user_id: userAId,
      exam_id: PUBLISHED_EXAM_ID,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (scoredAttempt.error) throw scoredAttempt.error;
  const scoredAttemptId = scoredAttempt.data.id as string;

  // Attempt CÒN DỞ của A — dùng cho S-d.
  const openAttempt = await admin
    .from("exam_attempts")
    .insert({ user_id: userAId, exam_id: PUBLISHED_EXAM_ID, status: "in_progress" })
    .select("id")
    .single();
  if (openAttempt.error) throw openAttempt.error;

  const FAKE_SCORE = {
    total_score: 10,
    correct: 40,
    total: 40,
    per_question: [] as unknown[],
    topic_breakdown: [] as unknown[],
  };

  console.log("\nRLS checks (score write lockdown S-a…S-e):");

  // S-a. CHÍNH LỖ HỔNG: chủ nhân tự ghi điểm cho attempt ĐÃ NỘP của mình.
  //      Kèm biến thể chiếm chỗ attempt người khác (B ghi cho attempt của A).
  //      Hiện cả hai bị chặn ngay ở tầng quyền bảng, nên test này KHÔNG tách
  //      bạch được lớp policy §11a-2; policy là lưới thứ hai cho trường hợp ai
  //      đó lỡ cấp lại INSERT, và chỉ kiểm được nếu tự cấp lại quyền (không làm).
  const saOwn = await userA.from("exam_results").insert({
    attempt_id: scoredAttemptId,
    ...FAKE_SCORE,
  });
  const saForeign = await userB.from("exam_results").insert({
    attempt_id: scoredAttemptId,
    ...FAKE_SCORE,
  });
  assert(
    saOwn.error !== null && saForeign.error !== null,
    `S-a: Học sinh KHÔNG ghi được exam_results — kể cả cho attempt đã nộp của CHÍNH MÌNH (lỗi: ${saOwn.error?.code ?? "KHÔNG CÓ LỖI — LỖ HỔNG CÒN MỞ"}), lẫn cho attempt của người khác (lỗi: ${saForeign.error?.code ?? "KHÔNG CÓ LỖI — LỖ HỔNG CÒN MỞ"})`,
  );

  // S-b. UPDATE/DELETE cũng đã bị thu hồi — trước nay chỉ được chặn nhờ "chưa
  //      ai viết policy", một lý do quá mỏng cho bảng chứa điểm số.
  const sbUpd = await userA
    .from("exam_results")
    .update({ total_score: 10 })
    .eq("attempt_id", scoredAttemptId);
  const sbDel = await userA.from("exam_results").delete().eq("attempt_id", scoredAttemptId);
  assert(
    sbUpd.error !== null && sbDel.error !== null,
    "S-b: Học sinh KHÔNG sửa/xoá được exam_results (quyền bảng bị thu hồi, không chỉ dựa vào 'không có policy')",
  );

  // S-c. record_exam_result chỉ cấp EXECUTE cho service_role → học sinh bị chặn
  //      NGAY Ở CỬA HÀM, phải là 42501.
  //      Probe bằng attempt KHÔNG TỒN TẠI là cố ý: với attempt có thật, hàm chạy
  //      tới INSERT rồi mới chết 42501 (do §11a) — cùng mã lỗi, khác lý do, nên
  //      không phân biệt được EXECUTE có bị thu hồi hay không. Với attempt giả,
  //      nếu EXECUTE còn thì hàm chạy và raise 23514; chỉ 42501 mới chứng minh
  //      nó bị chặn trước khi vào thân hàm. (Bẫy này đã bỏ lọt thật một lần —
  //      Supabase default privileges, xem schema.sql §10b.)
  const NIL_UUID = "00000000-0000-0000-0000-000000000000";
  const sc = await userA.rpc("record_exam_result", {
    p_attempt_id: NIL_UUID,
    p_total_score: 10,
    p_correct: 40,
    p_total: 40,
    p_per_question: [],
    p_topic_breakdown: [],
  });
  assert(
    sc.error?.code === "42501",
    `S-c: Học sinh bị chặn EXECUTE record_exam_result (mong đợi 42501, nhận: ${sc.error?.code ?? "KHÔNG CÓ LỖI"}${sc.error?.code === "23514" ? " = hàm VẪN CHẠY, EXECUTE chưa bị thu hồi khỏi authenticated" : ""})`,
  );

  // S-d. Ngay cả service_role cũng không ghi được điểm cho attempt CHƯA NỘP —
  //      luật "điểm chỉ tồn tại cho bài đã đóng" nằm trong DB, không nằm ở
  //      call site.
  const sd = await admin.rpc("record_exam_result", {
    p_attempt_id: openAttempt.data.id as string,
    p_total_score: 10,
    p_correct: 40,
    p_total: 40,
    p_per_question: [],
    p_topic_breakdown: [],
  });
  assert(
    sd.error !== null,
    `S-d: record_exam_result TỪ CHỐI attempt chưa 'submitted', kể cả với service_role (lỗi: ${sd.error?.code ?? "KHÔNG CÓ LỖI"})`,
  );

  // S-e. Positive control + tính chất then chốt: người gọi KHÔNG khai user_id,
  //      hàm tự suy ra từ attempt. service_role không có auth.uid() nào cả, mà
  //      dòng ghi ra vẫn phải thuộc về A.
  const se = await admin.rpc("record_exam_result", {
    p_attempt_id: scoredAttemptId,
    p_total_score: 7.5,
    p_correct: 3,
    p_total: 4,
    p_per_question: [],
    p_topic_breakdown: [],
  });
  const seRow = await admin
    .from("exam_results")
    .select("user_id, total_score, correct, total")
    .eq("attempt_id", scoredAttemptId);
  const seData = (seRow.data as Array<{ user_id: string; total_score: number }> | null) ?? [];
  assert(
    !se.error &&
      seData.length === 1 &&
      seData[0].user_id === userAId &&
      Number(seData[0].total_score) === 7.5,
    "S-e: service_role ghi được điểm qua record_exam_result, và user_id được SUY RA từ attempt (không nhận từ tham số)",
  );

  // S-f. overtime_seconds (Security review #6) do DB TỰ TÍNH từ
  //      started_at + exams.duration_minutes, KHÔNG nhận từ tham số — hệt như
  //      user_id. Đây là toàn bộ nội dung của "timer server-side": đồng hồ ở
  //      client chỉ là UX, tắt JS thì nó biến mất, còn dòng này thì không.
  //      Hai fixture chỉ khác nhau ở started_at nên chênh lệch quan sát được
  //      chắc chắn đến từ phép tính trong hàm.
  const examDuration = await admin
    .from("exams")
    .select("duration_minutes")
    .eq("id", PUBLISHED_EXAM_ID)
    .single();
  if (examDuration.error) throw examDuration.error;
  const durationMin = examDuration.data.duration_minutes as number;

  /** Tạo attempt đã nộp, bắt đầu cách đây `startedMinutesAgo` phút. */
  const seedFinishedAttempt = async (startedMinutesAgo: number) => {
    const now = Date.now();
    const row = await admin
      .from("exam_attempts")
      .insert({
        user_id: userAId,
        exam_id: PUBLISHED_EXAM_ID,
        status: "submitted",
        started_at: new Date(now - startedMinutesAgo * 60_000).toISOString(),
        submitted_at: new Date(now).toISOString(),
      })
      .select("id")
      .single();
    if (row.error) throw row.error;
    return row.data.id as string;
  };

  // Trong giờ: bắt đầu cách đây (duration - 5) phút.
  const inTimeId = await seedFinishedAttempt(Math.max(1, durationMin - 5));
  // Quá giờ: bắt đầu cách đây (duration + 30) phút → phải ra ~1800s.
  const lateId = await seedFinishedAttempt(durationMin + 30);

  const scorePayload = {
    p_total_score: 9,
    p_correct: 9,
    p_total: 10,
    p_per_question: [],
    p_topic_breakdown: [],
  };
  const wInTime = await admin.rpc("record_exam_result", { p_attempt_id: inTimeId, ...scorePayload });
  const wLate = await admin.rpc("record_exam_result", { p_attempt_id: lateId, ...scorePayload });
  if (wInTime.error) throw wInTime.error;
  if (wLate.error) throw wLate.error;

  const sfRows = await admin
    .from("exam_results")
    .select("attempt_id, overtime_seconds")
    .in("attempt_id", [inTimeId, lateId]);
  const byAttempt = new Map(
    ((sfRows.data as Array<{ attempt_id: string; overtime_seconds: number }> | null) ?? []).map(
      (r) => [r.attempt_id, r.overtime_seconds],
    ),
  );
  const inTimeOvertime = byAttempt.get(inTimeId);
  const lateOvertime = byAttempt.get(lateId);
  assert(
    inTimeOvertime === 0 && typeof lateOvertime === "number" && lateOvertime > 1700 && lateOvertime < 1900,
    `S-f: overtime_seconds do DB tự tính — nộp trong giờ = 0 (nhận ${inTimeOvertime}); nộp quá ${durationMin + 30}' trên đề ${durationMin}' ≈ 1800s (nhận ${lateOvertime})`,
  );

  await cleanupAnswerKeyFixtures(admin);

  // ==========================================================================
  // Phần 5 — Takedown UGC (Security review 2026-08-03 Medium #7, schema.sql §14):
  // M-a…M-d. REQUIRED, BLOCKING.
  //
  // Gỡ nội dung chỉ có nghĩa nếu tác giả KHÔNG tự đưa ngược lại được. Toàn bộ
  // việc đó nằm ở RLS (exams_update_author/exams_delete_author loại trừ
  // 'removed') — app code không cưỡng chế được, vì tác giả gọi thẳng REST API
  // bằng JWT của mình là bỏ qua mọi guard trong Server Action.
  // ==========================================================================
  console.log("\nTakedown UGC — setup fixture (service_role)…");
  const REMOVED_EXAM_ID = "rls-ugc-removed";
  const cleanupRemoved = async () => {
    await admin.from("exam_moderation_log").delete().eq("exam_id", REMOVED_EXAM_ID);
    await admin.from("exams").delete().eq("id", REMOVED_EXAM_ID);
  };
  await cleanupRemoved();
  const removedSeed = await admin.from("exams").insert({
    id: REMOVED_EXAM_ID,
    title: "[RLS] Đề đã bị gỡ",
    question_ids: [] as string[],
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: userAId,
    author_display_name: "RLS Test Author",
    status: "removed",
  });
  if (removedSeed.error) throw removedSeed.error;

  console.log("\nRLS checks (takedown M-a…M-d):");

  // M-a. Tác giả KHÔNG sửa được đề đã bị gỡ — kể cả đổi status về 'published'
  //      (đúng nước đi của người muốn lách lệnh gỡ).
  const maRepublish = await userA
    .from("exams")
    .update({ status: "published" })
    .eq("id", REMOVED_EXAM_ID)
    .select("id");
  const maTitle = await userA
    .from("exams")
    .update({ title: "[RLS] Đổi tên lách lệnh gỡ" })
    .eq("id", REMOVED_EXAM_ID)
    .select("id");
  const maAfter = await admin
    .from("exams")
    .select("status, title")
    .eq("id", REMOVED_EXAM_ID)
    .single();
  const maRow = maAfter.data as { status: string; title: string } | null;
  assert(
    (maRepublish.data?.length ?? 0) === 0 &&
      (maTitle.data?.length ?? 0) === 0 &&
      maRow?.status === "removed" &&
      maRow?.title === "[RLS] Đề đã bị gỡ",
    `M-a: Tác giả KHÔNG tự publish lại / sửa được đề đã bị gỡ (status còn '${maRow?.status}')`,
  );

  // M-b. Cũng không xoá được để phi tang.
  const mbDel = await userA.from("exams").delete().eq("id", REMOVED_EXAM_ID).select("id");
  const mbStill = await admin.from("exams").select("id").eq("id", REMOVED_EXAM_ID);
  assert(
    (mbDel.data?.length ?? 0) === 0 && (mbStill.data?.length ?? 0) === 1,
    "M-b: Tác giả KHÔNG xoá được đề đã bị gỡ",
  );

  // M-c. Đề đã gỡ biến mất khỏi catalog với người khác, nhưng CHÍNH tác giả vẫn
  //      thấy (nhánh author_id của exams_select_visible) — chủ đích: họ cần biết
  //      bài bị gỡ, chứ không phải thấy nó bốc hơi không lời giải thích.
  const mcOther = await userB.from("exams_with_difficulty").select("id").eq("id", REMOVED_EXAM_ID);
  const mcAuthor = await userA.from("exams").select("id, status").eq("id", REMOVED_EXAM_ID);
  assert(
    (mcOther.data?.length ?? 0) === 0 && (mcAuthor.data?.length ?? 0) === 1,
    "M-c: Đề đã gỡ ẩn với người khác (kể cả qua view) nhưng tác giả vẫn thấy trạng thái",
  );

  // M-d. Nhật ký kiểm duyệt là dữ liệu vận hành — không ai ngoài service_role
  //      đọc được (RLS bật, KHÔNG policy nào + thu hồi quyền bảng).
  const mdUser = await userA.from("exam_moderation_log").select("id");
  const mdAnon = await anonClient.from("exam_moderation_log").select("id");
  assert(
    (mdUser.error !== null || (mdUser.data?.length ?? 0) === 0) &&
      (mdAnon.error !== null || (mdAnon.data?.length ?? 0) === 0),
    "M-d: exam_moderation_log KHÔNG đọc được bởi user thường lẫn anonymous",
  );

  await cleanupRemoved();

  // ==========================================================================
  // Phần 6 — History Gate (backend Design Doc v1.2, docs/design/history-backend-design.md,
  // case H-a) — REQUIRED, BLOCKING. Chứng minh duy nhất trên Postgres thật rằng
  // exams_select_visible RLS + filter tường minh .eq("status","published") loại
  // bỏ đúng hàng của một đề tự-tác-giả sau khi bị unpublish (R-1) — mock trong
  // history.int.test.ts obligation (e) chỉ chứng minh được predicate còn được
  // GẮN vào query, không chứng minh được Postgres tôn trọng nó.
  //
  // 2026-08-03 (perf pass): listMyHistory() đã gộp 3 query tuần tự thành MỘT
  // embedded join, nên case này cũng đổi theo để chạy đúng shape production
  // đang phát — bản cũ query thẳng bảng `exams` theo shape "bước 3", một bước
  // không còn tồn tại, tức vẫn xanh nhưng chứng minh nhầm thứ. Nhờ chạy trên
  // chính join đó, nay chứng minh được mạnh hơn: cả DÒNG biến mất khỏi kết quả
  // (do `exams!inner`), chứ không chỉ "lookup title trả 0 row".
  // ==========================================================================
  console.log("\nHistory H-a — setup fixture (service_role)…");
  await cleanupHistoryFixtures(admin);
  await setupHistoryFixtures(admin, userAId);

  console.log("\nRLS checks (History H-a):");

  /** Đúng query listMyHistory() phát (features/history/queries.ts), thu hẹp về fixture H-a. */
  const haJoin = () =>
    userA
      .from("exam_results")
      .select(
        "attempt_id, total_score, exam_attempts!inner(exam_id, started_at, submitted_at, exams!inner(title, subject))",
      )
      .eq("exam_attempts.status", "submitted")
      .eq("exam_attempts.exams.status", "published")
      .eq("exam_attempts.exam_id", HISTORY_EXAM_ID);

  // H-a (positive control). Khi đề CÒN published, dòng fixture phải đi qua được
  // join. Thiếu bước này, assertion "0 row" bên dưới có thể xanh vì lý do sai
  // (fixture hỏng, filter viết nhầm tên cột, RLS giấu sạch) chứ không phải vì
  // quy tắc omission hoạt động.
  const haBefore = await haJoin();
  assert(
    !haBefore.error && (haBefore.data?.length ?? 0) === 1,
    "H-a (positive control): đề CÒN published -> join của listMyHistory() trả đúng 1 row cho attempt của fixture",
  );

  // H-a. Tác giả đổi status đề khỏi 'published' (service_role) -> chạy lại đúng
  //      join đó dưới danh nghĩa chính User A (tác giả kiêm người làm bài) ->
  //      phải trả về 0 row, chứng minh việc loại bỏ là do RLS + filter tường
  //      minh + `exams!inner` ở tầng DB, không phải do application-code (JS-side).
  const haRevert = await admin
    .from("exams")
    .update({ status: "draft" })
    .eq("id", HISTORY_EXAM_ID);
  if (haRevert.error) throw haRevert.error;

  const ha = await haJoin();
  assert(
    !ha.error && (ha.data?.length ?? 0) === 0,
    "H-a: Đề tự-tác-giả sau khi bị unpublish -> cả dòng bị loại khỏi join của listMyHistory() (RLS + filter tường minh + !inner, không phải application-code)",
  );

  // Dọn dẹp fixture History.
  await cleanupHistoryFixtures(admin);

  // ==========================================================================
  // Phần 7 — Engine 1 Adaptive AI (Mastery + Telemetry), cases MM-a/MM-b/TL-a/
  // TL-b — REQUIRED, BLOCKING. Backend Design Doc §Test Boundaries + schema.sql
  // §18/§19 + ADR-0011.
  //
  // Vì sao phải chạy trên Postgres thật: cả 4 case đều là ranh giới QUYỀN, chỉ
  // tồn tại trong DB — RLS policy `mastery_select_own`, EXECUTE grant của
  // record_skill_mastery(), và các lệnh `revoke` tường minh trên telemetry_log.
  // Không mock nào chứng minh được, và §18 chính là cơ chế ADR-0011 mirror lại
  // ADR-0010 cho điểm số: một dòng mastery bịa được ghi/đọc chéo sẽ mở lại đúng
  // lỗ hổng ADR-0010 đã đóng.
  //
  // MM-b bổ sung cho recordSkillMastery.int.test.ts Test 2 (backend-task-10) —
  // file đó tự trích tên MM-a/MM-b trong header; hai chỗ chứng minh cùng ranh
  // giới ở hai tầng khác nhau theo đúng thiết kế dual-coverage của Work Plan,
  // KHÔNG phải trùng lặp thừa.
  // ==========================================================================
  console.log("\nEngine 1 MM/TL — setup fixture (service_role)…");
  await cleanupEngine1Fixtures(admin);
  await setupEngine1Fixtures(admin, userAId);

  console.log("\nRLS checks (Engine 1 Phần 7):");

  // MM-a (positive control). Chủ dòng PHẢI đọc được dòng của chính mình. Thiếu
  // bước này, assertion "B thấy 0 row" bên dưới có thể xanh vì fixture hỏng /
  // tên cột sai / RLS giấu sạch của mọi người, chứ không phải vì cách ly hoạt
  // động (đúng bài học của H-a Phần 6).
  const mmOwn = await userA
    .from("user_skill_mastery")
    .select("skill_node_id, correct_count, total_count")
    .eq("skill_node_id", MASTERY_SKILL_ID);
  assert(
    !mmOwn.error &&
      (mmOwn.data?.length ?? 0) === 1 &&
      mmOwn.data?.[0]?.correct_count === 3 &&
      mmOwn.data?.[0]?.total_count === 5,
    "MM-a (positive control): chủ dòng đọc được đúng dòng mastery của mình (3/5)",
  );

  // MM-a. User B đọc user_skill_mastery lọc đúng skill node của A -> phải
  //       KHÔNG thấy dòng nào. Chế độ hỏng chính: policy `mastery_select_own`
  //       thiếu (hoặc sai toán tử) `user_id = auth.uid()`, khiến mọi user đọc
  //       được counter của mọi người.
  const mmOther = await userB
    .from("user_skill_mastery")
    .select("user_id, skill_node_id")
    .eq("skill_node_id", MASTERY_SKILL_ID);
  assert(
    mmOther.error !== null || (mmOther.data?.length ?? 0) === 0,
    "MM-a: user khác KHÔNG đọc được dòng user_skill_mastery của người ta",
  );

  // MM-b. JWT học sinh KHÔNG gọi thẳng record_skill_mastery() được (§18:
  //       `revoke all on function ... from public, anon, authenticated`).
  //
  //       ⚠ KHÔNG được assert trần `error !== null` — đó là false green: nếu
  //       quyền EXECUTE bị hở, lời gọi VẪN lỗi, nhưng là lỗi check_violation do
  //       thân hàm ném ("attempt … không tồn tại hoặc chưa submitted") vì
  //       attempt id bịa ở dưới. Phải phân biệt đúng lớp lỗi QUYỀN: 42501
  //       (permission denied) hoặc PGRST202 (PostgREST không thấy hàm trong
  //       schema cache vì role không có EXECUTE) — cả hai đều chứng minh không
  //       gọi được; lỗi từ thân hàm thì ngược lại, chứng minh ĐÃ gọi được.
  const mmRpc = await userA.rpc("record_skill_mastery", {
    p_attempt_id: "00000000-0000-0000-0000-000000000000",
    p_per_question: [],
  });
  assert(
    mmRpc.error !== null &&
      (mmRpc.error.code === "42501" ||
        mmRpc.error.code === "PGRST202" ||
        /permission denied|could not find the function/i.test(mmRpc.error.message)),
    "MM-b: JWT học sinh gọi thẳng record_skill_mastery() bị chặn ở tầng quyền (không phải lỗi từ thân hàm)",
  );

  // TL-a (positive control). Dòng telemetry fixture của A có thật trong DB
  //      (đọc bằng service_role) — để "user đọc ra 0 dòng" bên dưới có nghĩa.
  const tlSeeded = await admin
    .from("telemetry_log")
    .select("id, user_id")
    .eq("skill_node_id", MASTERY_SKILL_ID);
  assert(
    !tlSeeded.error &&
      (tlSeeded.data?.length ?? 0) === 1 &&
      tlSeeded.data?.[0]?.user_id === userAId,
    "TL-a (positive control): dòng telemetry_log của User A tồn tại thật (service_role đọc được)",
  );

  // TL-a. Chính User A — CHỦ của dòng telemetry đó — vẫn KHÔNG đọc được.
  //       telemetry_log là dữ liệu vận hành, không phải dữ liệu người dùng tự
  //       xem (tiền lệ exam_moderation_log / M-d): RLS bật + KHÔNG policy select
  //       nào + `revoke select ... from anon, authenticated`. Chế độ hỏng chính:
  //       ai đó thêm một policy select "own-row" cho tiện debug.
  const tlOwn = await userA
    .from("telemetry_log")
    .select("id")
    .eq("skill_node_id", MASTERY_SKILL_ID);
  assert(
    tlOwn.error !== null || (tlOwn.data?.length ?? 0) === 0,
    "TL-a: user đã đăng nhập KHÔNG đọc được telemetry_log, kể cả dòng của chính mình",
  );

  // TL-b. anon KHÔNG insert được vào telemetry_log (§19 `revoke insert ... from
  //       anon`; policy insert chỉ dành cho authenticated với check user_id =
  //       auth.uid()). Gắn skill_node_id fixture vào payload để nếu lệnh này
  //       LỌT thì cleanup vẫn dọn được dòng rác đó.
  const tlAnonInsert = await anonClient.from("telemetry_log").insert({
    user_id: userAId,
    event_type: "tutor_invoke",
    skill_node_id: MASTERY_SKILL_ID,
    success: false,
    error_code: "server",
  });
  // Xác nhận bằng trạng thái DB thật chứ không chỉ bằng error trả về: một
  // lệnh insert bị RLS chặn có thể trả "thành công rỗng" tuỳ cấu hình, nên
  // đếm lại bằng service_role mới là bằng chứng chắc chắn không có dòng nào rơi vào.
  const tlAfterAnon = await admin
    .from("telemetry_log")
    .select("id")
    .eq("skill_node_id", MASTERY_SKILL_ID)
    .eq("event_type", "tutor_invoke");
  assert(
    tlAnonInsert.error !== null && !tlAfterAnon.error && (tlAfterAnon.data?.length ?? 0) === 0,
    "TL-b: anon KHÔNG insert được vào telemetry_log (lỗi trả về + DB thật không có dòng nào)",
  );

  // Dọn dẹp fixture Engine 1.
  await cleanupEngine1Fixtures(admin);

  // ==========================================================================
  // Phần 8 — User Support System v1 (support_tickets + support_ticket_notes +
  // support-screenshots), cases ST-a…ST-e — REQUIRED, BLOCKING (backend Design
  // Doc §Test Boundaries — RLS suite ST-a…ST-d; ST-e plan-added, closes document
  // review finding I001, AC-013). Work Plan Task 03 — this IS the Early
  // Verification Point, backend: no code in lib/support/ may be built on top of
  // this authorization layer before all five cases below are green.
  //
  // Vì sao phải chạy trên Postgres thật: cả 5 case đều là ranh giới QUYỀN, chỉ
  // tồn tại trong DB — RLS policy `support_tickets_select_own`, `revoke all`
  // tường minh trên support_ticket_notes (KHÔNG một policy nào), và Storage
  // policy insert-own trên bucket `support-screenshots` (KHÔNG có select policy
  // nào cho `authenticated`). Không mock nào chứng minh được (backend DD Mock
  // Boundary Decisions, "Supabase DB + RLS (cả 2 bảng + storage policy) — No").
  // ==========================================================================
  console.log("\nSupport System — setup fixture (service_role)…");
  await cleanupSupportFixtures(admin, userAId, userBId);
  const supportFixture = await setupSupportFixtures(admin, userAId, userBId);

  console.log("\nRLS checks (Support System ST-a…ST-e):");

  // ST-a (AC-015, metric 2). A đọc được đúng vé của mình, KHÔNG đọc được vé của
  // B; đối xứng ngược lại từ phía B. Chế độ hỏng chính: thiếu hoặc sai toán tử
  // `user_id = auth.uid()` trên `support_tickets_select_own`.
  const staAOwn = await userA
    .from("support_tickets")
    .select("id")
    .eq("id", supportFixture.ticketAId);
  const staACross = await userA
    .from("support_tickets")
    .select("id")
    .eq("id", supportFixture.ticketBId);
  assert(
    !staAOwn.error &&
      staAOwn.data?.length === 1 &&
      !staACross.error &&
      (staACross.data?.length ?? 0) === 0,
    "ST-a: User A đọc được đúng vé của mình, KHÔNG đọc được vé của B",
  );

  const staBOwn = await userB
    .from("support_tickets")
    .select("id")
    .eq("id", supportFixture.ticketBId);
  const staBCross = await userB
    .from("support_tickets")
    .select("id")
    .eq("id", supportFixture.ticketAId);
  assert(
    !staBOwn.error &&
      staBOwn.data?.length === 1 &&
      !staBCross.error &&
      (staBCross.data?.length ?? 0) === 0,
    "ST-a: đối xứng — User B đọc được đúng vé của mình, KHÔNG đọc được vé của A",
  );

  // ST-b (positive control, mirrors TL-a/S-a). Ghi chú nội bộ trên vé của A có
  // thật trong DB (đọc bằng service_role) — để "0 dòng" ở ST-c có nghĩa là bị
  // RLS chặn, không phải vì fixture rỗng.
  const stb = await admin
    .from("support_ticket_notes")
    .select("id")
    .eq("ticket_id", supportFixture.ticketAId);
  assert(
    !stb.error && (stb.data?.length ?? 0) >= 1,
    "ST-b (positive control): ghi chú nội bộ trên vé của A tồn tại thật (service_role đọc được)",
  );

  // ST-c (AC-025, metric 3). Chính A — CHỦ của vé đó — vẫn KHÔNG đọc được ghi
  // chú nội bộ. `support_ticket_notes` có `revoke all ... from anon,
  // authenticated` + ZERO policy (idiom strict giống exam_moderation_log) —
  // phải phân biệt đúng lớp lỗi QUYỀN (42501/permission denied) khi có lỗi,
  // giống cách MM-b phân biệt lớp lỗi, chứ không chấp nhận lỗi bất kỳ làm bằng
  // chứng; kết quả "0 dòng không lỗi" cũng thỏa AC-025 ("0 rows ... or access
  // is denied").
  const stc = await userA
    .from("support_ticket_notes")
    .select("id")
    .eq("ticket_id", supportFixture.ticketAId);
  assert(
    (stc.error !== null &&
      (stc.error.code === "42501" || /permission denied/i.test(stc.error.message))) ||
      (stc.error === null && (stc.data?.length ?? 0) === 0),
    `ST-c: Chính tác giả vé cũng KHÔNG đọc được ghi chú nội bộ (mong đợi 0 dòng hoặc lỗi 42501, nhận: ${stc.error?.code ?? `${stc.data?.length ?? 0} dòng`})`,
  );

  // ST-d (AC-048, metric 3). A INSERT thẳng vào support_ticket_notes cho vé của
  // chính mình -> phải bị chặn ở tầng GRANT (42501, vì `revoke all` xóa quyền
  // bảng trước khi RLS được xét, không chỉ dựa vào "không có policy insert") ->
  // service_role đếm lại số dòng trước/sau xác nhận không có dòng nào lọt qua
  // (per TL-b convention — RLS/grant-blocked write có thể trả "thành công
  // rỗng" tùy cấu hình mà một check lỗi trần sẽ bỏ sót).
  const stdBefore = await admin
    .from("support_ticket_notes")
    .select("id")
    .eq("ticket_id", supportFixture.ticketAId);
  const stdInsert = await userA.from("support_ticket_notes").insert({
    ticket_id: supportFixture.ticketAId,
    note_text: "[rls-support] học sinh cố tự ghi chú (ST-d, phải bị chặn)",
  });
  const stdAfter = await admin
    .from("support_ticket_notes")
    .select("id")
    .eq("ticket_id", supportFixture.ticketAId);
  assert(
    stdInsert.error !== null &&
      (stdInsert.error.code === "42501" ||
        /permission denied/i.test(stdInsert.error.message)) &&
      !stdBefore.error &&
      !stdAfter.error &&
      stdBefore.data?.length === stdAfter.data?.length,
    `ST-d: A KHÔNG tự INSERT được vào support_ticket_notes (mong đợi 42501, nhận: ${stdInsert.error?.code ?? "KHÔNG CÓ LỖI"}; số dòng trước/sau: ${stdBefore.data?.length}/${stdAfter.data?.length})`,
  );

  console.log("\nStorage checks (Support System ST-e):");

  // ST-e (AC-013, plan-added — đóng document review finding I001). Ảnh chụp
  // màn hình của A được service_role xác nhận tồn tại thật (positive control,
  // mirrors ST-b) -> User B (không phải tác giả, không phải admin) tải xuống
  // cùng path -> phải bị chặn, phân biệt bằng lớp lỗi thật (error != null &&
  // data == null) giống hệt idiom R-m/R-n cho bucket exam-images/exam-uploads
  // (:715-737), KHÔNG chỉ `error !== null` trần.
  const steSeed = await admin.storage
    .from(SUPPORT_SCREENSHOTS_BUCKET)
    .download(supportFixture.screenshotPath);
  assert(
    steSeed.error == null && steSeed.data != null,
    "ST-e (positive control): service_role xác nhận ảnh chụp màn hình của A tồn tại thật trong bucket support-screenshots",
  );

  const steB = await userB.storage
    .from(SUPPORT_SCREENSHOTS_BUCKET)
    .download(supportFixture.screenshotPath);
  assert(
    steB.error != null && steB.data == null,
    "ST-e: User B (không phải tác giả, không phải admin) KHÔNG tải được ảnh chụp màn hình của A (AC-013 — bucket không có select policy nào cho authenticated)",
  );

  // -------------------------------------------------------------------------
  // Storage checks — bucket `avatars` (profile-and-about-prd.md AC-031/AC-032,
  // ADR-0016), cases AV-a…AV-d. REQUIRED, BLOCKING.
  //
  // VÌ SAO PHẢI Ở ĐÂY chứ không phải trong vitest: các test integration của
  // tính năng này mock TOÀN BỘ Supabase client, nên chúng chứng minh được thứ
  // tự lệnh gọi chứ không chứng minh được một policy nào cả. Bốn policy
  // `avatars_*_own` chỉ tồn tại trong schema.sql, và schema.sql tới được
  // database bằng TAY (TD-005).
  //
  // VÌ SAO `npm run verify:schema` KHÔNG thay được: nó so
  // `public.schema_version.fingerprint` với file, mà dòng fingerprint đó do
  // chính file tự insert ở câu lệnh cuối. Nó chứng minh "lần paste gần nhất
  // chạy hết", KHÔNG chứng minh "vị từ của policy khớp với file".
  //
  // Kịch bản hỏng mà khối này canh, và chính schema.sql:1560-1561 mời gọi nó:
  // khi SQL Editor báo "must be owner of table objects", người vận hành được
  // hướng dẫn tạo lại policy bằng Dashboard. Gõ tay `bucket_id = 'avatars'` mà
  // quên vế `(storage.foldername(name))[1] = auth.uid()::text` cho ra một
  // verify:schema XANH và một bucket nơi bất kỳ học sinh nào cũng đọc được ảnh
  // của học sinh khác. Chủ thể của những tấm ảnh đó là trẻ vị thành niên —
  // đúng thứ ADR-0016 chọn bucket private để chặn.
  // -------------------------------------------------------------------------
  console.log("\nStorage checks (avatars AV-a…AV-d):");

  const AVATARS_BUCKET = "avatars";
  const avatarBytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const avatarAPath = `${userAId}/rls-avatar-a.png`;
  const avatarBPath = `${userBId}/rls-avatar-b.png`;
  // Đường A cố tình ghi vào folder của B — tên file riêng để nếu nó LỌT thì
  // dọn dẹp bên dưới vẫn xoá được, không để rác lại trong folder của B.
  const avatarCrossPath = `${userBId}/rls-avatar-cross-written-by-a.png`;

  // Nền: B có sẵn một ảnh thật (qua service_role, bypass RLS) để AV-c/AV-d có
  // thứ để mà thử đọc. Không có bước này thì "A không đọc được gì" là một khẳng
  // định rỗng — không đọc được vì bị chặn, hay vì chẳng có gì ở đó?
  const avSeed = await admin.storage
    .from(AVATARS_BUCKET)
    .upload(avatarBPath, avatarBytes, { contentType: "image/png", upsert: true });
  assert(
    avSeed.error == null,
    "AV (positive control): service_role tạo được ảnh đại diện của B trong bucket avatars",
  );

  // AV-a. A ghi được vào ĐÚNG folder của mình — chứng minh policy insert không
  // chặn nhầm chính chủ (một policy `false` cũng làm AV-b xanh).
  const avA = await userA.storage
    .from(AVATARS_BUCKET)
    .upload(avatarAPath, avatarBytes, { contentType: "image/png", upsert: true });
  assert(
    avA.error == null,
    "AV-a: User A upload được vào folder của chính mình (avatars_insert_own cho phép đúng chủ)",
  );

  // AV-b. A ghi vào folder của B — phải bị chặn.
  const avB = await userA.storage
    .from(AVATARS_BUCKET)
    .upload(avatarCrossPath, avatarBytes, { contentType: "image/png", upsert: true });
  assert(
    avB.error != null,
    "AV-b: User A KHÔNG upload được vào folder của B (AC-031/AC-032)",
  );

  // AV-b'. Xác nhận bằng phía service_role rằng thật sự không có object nào
  // được tạo — `error != null` một mình vẫn có thể là lỗi mạng, không phải RLS.
  const avBCheck = await admin.storage.from(AVATARS_BUCKET).list(userBId);
  const avBNames = (avBCheck.data ?? []).map((o) => o.name);
  assert(
    avBCheck.error == null && !avBNames.includes("rls-avatar-cross-written-by-a.png"),
    "AV-b (hậu kiểm): service_role xác nhận folder của B KHÔNG có object nào do A ghi vào",
  );

  // AV-c. A không ký được URL cho ảnh của B. Đây là đường đọc thật của tính
  // năng (getCurrentUser.ts gọi createSignedUrl), nên nó mới là thứ đáng kiểm,
  // không phải download() trần.
  const avC = await userA.storage.from(AVATARS_BUCKET).createSignedUrl(avatarBPath, 60);
  assert(
    avC.error != null && avC.data == null,
    "AV-c: User A KHÔNG ký được signed URL cho ảnh của B (avatars_select_own)",
  );

  // AV-d. A liệt kê folder của B — phải rỗng. Chặn được download mà vẫn liệt kê
  // được tên file thì vẫn là rò: tên file cho biết người đó CÓ ảnh.
  const avD = await userA.storage.from(AVATARS_BUCKET).list(userBId);
  assert(
    (avD.data ?? []).length === 0,
    "AV-d: User A liệt kê folder của B ra 0 object (không rò cả sự tồn tại)",
  );

  // Dọn dẹp fixture avatars — service_role, xoá cả đường cross phòng khi AV-b
  // lọt (nếu nó lọt thì test đã FAIL, nhưng đừng để lại rác trên môi trường).
  await admin.storage
    .from(AVATARS_BUCKET)
    .remove([avatarAPath, avatarBPath, avatarCrossPath]);

  // Dọn dẹp fixture Support System.
  await cleanupSupportFixtures(admin, userAId, userBId);

  // ==========================================================================
  // Phần 9 — Subscription (payment_orders + subscriptions +
  // record_payment_settlement), cases PO-a…PO-f / SB-a…SB-g / PS-a/PS-b —
  // REQUIRED, BLOCKING. Backend Design Doc §Security Considerations + ADR-0014
  // §Implementation Guidance + khối SUBSCRIPTION của schema.sql.
  //
  // Vì sao phải chạy trên Postgres thật: cả ba nhóm đều là ranh giới QUYỀN chỉ
  // tồn tại trong DB — hai policy `*_select_own`, các lệnh `revoke insert,
  // update, delete` tường minh trên hai bảng, và `revoke all on function …
  // from public, anon, authenticated` trên hàm settlement. Một Supabase client
  // giả lập sẽ chứng minh cái giả lập, không chứng minh policy nào.
  //
  // MỘT NHÓM CHO MỖI ĐỐI TƯỢNG DDL, và số nhóm phải BẰNG số đối tượng:
  //   PO-* → public.payment_orders
  //   SB-* → public.subscriptions
  //   PS-* → public.record_payment_settlement(bigint, integer)
  //
  // ⚠ CÁCH KHỐI NÀY TRÁNH "XANH VÌ LÝ DO SAI" — đọc trước khi sửa bất cứ case
  // nào. Một lệnh ghi bị từ chối vì thiếu cột NOT NULL (23502), sai FK (23503),
  // trùng khoá (23505) hay sai kiểu (22P02) cũng "thất bại", và một assertion
  // `error !== null` sẽ xanh trong khi `revoke` đã bị gỡ mất. Ba lớp phòng vệ:
  //   1. isAuthorizationDenial() chỉ chấp nhận 42501 / vi phạm row-level
  //      security — mọi mã ràng buộc đều trượt.
  //   2. Payload bị từ chối do CÙNG builder sinh ra với payload mà service_role
  //      chèn thành công trong chính lần chạy này (positive control ngay sau
  //      mỗi case insert) — nên "dữ liệu sai" là giả thuyết bị loại bằng bằng
  //      chứng, không bằng lời hứa. Với PS-b, thứ tương đương là một lời gọi
  //      RPC no-op bằng service_role dùng ĐÚNG tên hàm và ĐÚNG bộ tham số,
  //      loại bỏ giả thuyết "hàm không giải được" (PostgREST trả PGRST202 cho
  //      cả sai tên lẫn thiếu EXECUTE).
  //   3. Mọi case đều kèm hậu kiểm trạng thái DB bằng service_role: dòng còn
  //      nguyên từng byte, hoặc không có dòng mới nào. Một lệnh ghi bị RLS chặn
  //      có thể trả "thành công rỗng" tuỳ cấu hình, nên error trả về một mình
  //      chưa bao giờ đủ (tiền lệ TL-b/ST-d).
  // ==========================================================================
  console.log("\nSubscription — setup fixture (service_role)…");
  await cleanupSubscriptionFixtures(admin, userAId, userBId);
  await setupSubscriptionFixtures(admin, userAId, userBId);

  console.log("\nRLS checks (Subscription Phần 9 — payment_orders PO-a…PO-f):");

  // PO-a (positive control). Chủ đơn PHẢI đọc được đơn của chính mình. Thiếu
  // bước này, "A không thấy gì" ở PO-b có thể xanh vì fixture hỏng hoặc vì
  // policy giấu sạch của mọi người (đúng bài học H-a/MM-a).
  const poOwn = await userA
    .from("payment_orders")
    .select("order_code, user_id, amount, status, memo")
    .eq("order_code", SUB_ORDER_A);
  assert(
    !poOwn.error &&
      poOwn.data?.length === 1 &&
      poOwn.data?.[0]?.user_id === userAId &&
      poOwn.data?.[0]?.status === "pending" &&
      poOwn.data?.[0]?.memo === SUB_ORDER_MEMO,
    "PO-a (positive control): A đọc được đúng đơn 'pending' của chính mình (orders_select_own cho phép đúng chủ)",
  );

  // PO-b (positive control). Đơn của B tồn tại THẬT — để "A đọc ra 0 dòng" bên
  // dưới nghĩa là bị policy chặn, không phải vì chẳng có gì ở đó.
  const poBSeeded = await admin
    .from("payment_orders")
    .select("order_code, user_id")
    .eq("order_code", SUB_ORDER_B);
  assert(
    !poBSeeded.error &&
      poBSeeded.data?.length === 1 &&
      poBSeeded.data?.[0]?.user_id === userBId,
    "PO-b (positive control): đơn của User B tồn tại thật trong payment_orders (service_role đọc được)",
  );

  // PO-b. A đọc đơn của B -> 0 dòng. Chế độ hỏng chính: `orders_select_own`
  //       thiếu hoặc sai vế `user_id = auth.uid()`, khiến mọi người đọc được
  //       chứng từ tiền của mọi người.
  const poCross = await userA
    .from("payment_orders")
    .select("order_code, user_id")
    .eq("order_code", SUB_ORDER_B);
  assert(
    !poCross.error && (poCross.data?.length ?? 0) === 0,
    `PO-b: User A KHÔNG đọc được đơn của User B (nhận: ${poCross.error?.code ?? String(poCross.data?.length ?? 0) + " dòng"})`,
  );

  // PO-c. A tự INSERT một đơn cho CHÍNH MÌNH -> phải bị chặn ở tầng GRANT
  //       (`revoke insert … from authenticated`). Payload đầy đủ và hợp lệ,
  //       user_id đúng là A: nếu quyền hở, lệnh này SẼ thành công, và đó chính
  //       là "tự cấp một chứng từ tiền" mà AC-033 cấm.
  const poForgedRow = buildFixtureOrderRow(SUB_ORDER_FORGED, userAId);
  const poInsert = await userA.from("payment_orders").insert(poForgedRow);
  const poAfterInsert = await admin
    .from("payment_orders")
    .select("order_code")
    .eq("order_code", SUB_ORDER_FORGED);
  assert(
    isAuthorizationDenial(poInsert.error) &&
      !poAfterInsert.error &&
      (poAfterInsert.data?.length ?? 0) === 0,
    `PO-c: A KHÔNG tự INSERT được vào payment_orders (mong đợi 42501, nhận: ${poInsert.error?.code ?? "KHÔNG CÓ LỖI"}; số dòng lọt vào: ${poAfterInsert.data?.length ?? "?"})`,
  );

  // PO-c (positive control) — mấu chốt của cả khối. CHÍNH payload vừa bị từ
  // chối, do service_role gửi, được NHẬN. Nếu PO-c xanh vì payload sai (thiếu
  // cột NOT NULL, sai FK, sai kiểu) thì bước này FAIL. Xoá ngay sau đó để
  // cleanup cuối khối không phải là nơi duy nhất chịu trách nhiệm.
  const poForgedByAdmin = await admin.from("payment_orders").insert(poForgedRow);
  assert(
    !poForgedByAdmin.error,
    `PO-c (positive control): service_role chèn được ĐÚNG payload mà A vừa bị từ chối — lời từ chối ở PO-c là do QUYỀN, không phải do dữ liệu (nhận: ${poForgedByAdmin.error?.code ?? "OK"})`,
  );
  await admin.from("payment_orders").delete().eq("order_code", SUB_ORDER_FORGED);

  // PO-d. A UPDATE đơn của CHÍNH MÌNH (đơn nó ĐỌC được, nên RLS không phải thứ
  //       che mắt) sang 'paid' -> phải bị chặn. Đây là case đắt nhất của nhóm:
  //       nếu `revoke update` biến mất mà chỉ còn "không có policy update", lệnh
  //       này KHÔNG lỗi — nó lặng lẽ khớp 0 dòng và trả về thành công. Vì thế
  //       assertion đòi CẢ mã lỗi quyền LẪN dòng còn nguyên từng byte.
  const poBefore = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_code", SUB_ORDER_A)
    .single();
  const poUpdate = await userA
    .from("payment_orders")
    .update({ status: "paid", settled_at: new Date().toISOString() })
    .eq("order_code", SUB_ORDER_A);
  const poAfterUpdate = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_code", SUB_ORDER_A)
    .single();
  const poUpdateKeptRow =
    JSON.stringify(poAfterUpdate.data) === JSON.stringify(poBefore.data);
  assert(
    isAuthorizationDenial(poUpdate.error) &&
      !poBefore.error &&
      !poAfterUpdate.error &&
      poUpdateKeptRow,
    `PO-d: A KHÔNG UPDATE được đơn của chính mình sang 'paid' (mong đợi 42501, nhận: ${poUpdate.error?.code ?? "KHÔNG CÓ LỖI"}; dòng sau còn nguyên: ${poUpdateKeptRow})`,
  );

  // PO-e. A DELETE đơn của chính mình -> phải bị chặn, và dòng còn nguyên.
  //       Cùng lý do như PO-d: một delete bị RLS lọc cũng "thành công, 0 dòng".
  const poDelete = await userA
    .from("payment_orders")
    .delete()
    .eq("order_code", SUB_ORDER_A);
  const poAfterDelete = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_code", SUB_ORDER_A)
    .single();
  const poDeleteKeptRow =
    JSON.stringify(poAfterDelete.data) === JSON.stringify(poBefore.data);
  assert(
    isAuthorizationDenial(poDelete.error) && !poAfterDelete.error && poDeleteKeptRow,
    `PO-e: A KHÔNG DELETE được đơn của chính mình (mong đợi 42501, nhận: ${poDelete.error?.code ?? "KHÔNG CÓ LỖI"}; dòng sau còn nguyên: ${poDeleteKeptRow})`,
  );

  // PO-f. Khách VÃNG LAI (anon) KHÔNG đọc được payment_orders. `revoke select
  //       … from anon` là một bảo đảm DDL riêng, không suy ra được từ các case
  //       JWT học sinh ở trên: policy `orders_select_own` chỉ khai `to
  //       authenticated`, nên nếu revoke biến mất thì anon rơi vào "RLS bật,
  //       không policy nào khớp" và nhận 0 DÒNG chứ không nhận lỗi — im lặng
  //       giống hệt lúc đang an toàn. Vì thế assertion đòi ĐÚNG lớp lỗi quyền
  //       (tiền lệ TL-b), không chấp nhận "0 dòng".
  const poAnon = await anonClient
    .from("payment_orders")
    .select("order_code, user_id, amount");
  assert(
    isAuthorizationDenial(poAnon.error) && (poAnon.data?.length ?? 0) === 0,
    `PO-f: anon KHÔNG đọc được payment_orders (mong đợi 42501, nhận: ${poAnon.error?.code ?? String(poAnon.data?.length ?? 0) + " dòng"})`,
  );

  console.log("\nRLS checks (Subscription Phần 9 — subscriptions SB-a…SB-g):");

  // SB-a (positive control). B đọc được entitlement của chính mình.
  const sbOwnB = await userB
    .from("subscriptions")
    .select("user_id, expires_at")
    .eq("user_id", userBId);
  assert(
    !sbOwnB.error && sbOwnB.data?.length === 1 && sbOwnB.data?.[0]?.user_id === userBId,
    "SB-a (positive control): B đọc được dòng subscriptions của chính mình (subscriptions_select_own cho phép đúng chủ)",
  );

  // SB-b. A đọc entitlement của B -> 0 dòng. Rò ở đây là rò "ai đã trả tiền".
  const sbCross = await userA
    .from("subscriptions")
    .select("user_id, expires_at")
    .eq("user_id", userBId);
  assert(
    !sbCross.error && (sbCross.data?.length ?? 0) === 0,
    `SB-b: User A KHÔNG đọc được dòng subscriptions của User B (nhận: ${sbCross.error?.code ?? String(sbCross.data?.length ?? 0) + " dòng"})`,
  );

  // SB-c. A tự INSERT entitlement cho CHÍNH MÌNH -> phải bị chặn. Đây là kịch
  //       bản "tự cấp gói trả phí" trần trụi nhất. A CHƯA có dòng nào ở thời
  //       điểm này (xem setupSubscriptionFixtures), nên payload không thể trùng
  //       khoá chính — nếu nó trùng, case sẽ xanh vì 23505 chứ không vì quyền.
  const sbForgedRow = buildFixtureSubscriptionRow(userAId);
  const sbInsert = await userA.from("subscriptions").insert(sbForgedRow);
  const sbAfterInsert = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", userAId);
  assert(
    isAuthorizationDenial(sbInsert.error) &&
      !sbAfterInsert.error &&
      (sbAfterInsert.data?.length ?? 0) === 0,
    `SB-c: A KHÔNG tự INSERT được entitlement cho chính mình (mong đợi 42501, nhận: ${sbInsert.error?.code ?? "KHÔNG CÓ LỖI"}; số dòng lọt vào: ${sbAfterInsert.data?.length ?? "?"})`,
  );

  // SB-c (positive control). CHÍNH payload vừa bị từ chối, do service_role gửi,
  // được nhận — và dòng đó là fixture cho SB-d/SB-e ngay bên dưới.
  const sbOwnSeed = await admin.from("subscriptions").insert(sbForgedRow);
  assert(
    !sbOwnSeed.error,
    `SB-c (positive control): service_role chèn được ĐÚNG payload mà A vừa bị từ chối — lời từ chối ở SB-c là do QUYỀN, không phải do dữ liệu (nhận: ${sbOwnSeed.error?.code ?? "OK"})`,
  );

  // SB-d. A UPDATE entitlement của CHÍNH MÌNH (dòng nó ĐỌC được) để tự kéo dài
  //       hạn -> phải bị chặn, và dòng còn nguyên từng byte.
  const sbBefore = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userAId)
    .single();
  const sbUpdate = await userA
    .from("subscriptions")
    .update({ expires_at: "2999-12-31T23:59:59.000Z" })
    .eq("user_id", userAId);
  const sbAfterUpdate = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userAId)
    .single();
  const sbUpdateKeptRow =
    JSON.stringify(sbAfterUpdate.data) === JSON.stringify(sbBefore.data);
  assert(
    isAuthorizationDenial(sbUpdate.error) &&
      !sbBefore.error &&
      !sbAfterUpdate.error &&
      sbUpdateKeptRow,
    `SB-d: A KHÔNG tự kéo dài được expires_at của chính mình (mong đợi 42501, nhận: ${sbUpdate.error?.code ?? "KHÔNG CÓ LỖI"}; dòng sau còn nguyên: ${sbUpdateKeptRow})`,
  );

  // SB-e. A DELETE dòng subscriptions của chính mình -> phải bị chặn. Xoá được
  //       cũng là một lệnh ghi: nó dọn đường cho một lần insert "sạch" sau này.
  const sbDelete = await userA
    .from("subscriptions")
    .delete()
    .eq("user_id", userAId);
  const sbAfterDelete = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userAId)
    .single();
  const sbDeleteKeptRow =
    JSON.stringify(sbAfterDelete.data) === JSON.stringify(sbBefore.data);
  assert(
    isAuthorizationDenial(sbDelete.error) && !sbAfterDelete.error && sbDeleteKeptRow,
    `SB-e: A KHÔNG DELETE được dòng subscriptions của chính mình (mong đợi 42501, nhận: ${sbDelete.error?.code ?? "KHÔNG CÓ LỖI"}; dòng sau còn nguyên: ${sbDeleteKeptRow})`,
  );

  // SB-f (positive control). Đối xứng với PO-a: chủ dòng PHẢI đọc được
  //       entitlement của CHÍNH MÌNH. SB-a mới chỉ chứng minh điều đó cho B —
  //       người có dòng ngay từ fixture — nên nếu `subscriptions_select_own`
  //       hỏng theo hướng "giấu sạch của mọi người", SB-b/SB-d/SB-e của A vẫn
  //       xanh y nguyên. Case này phải đứng SAU SB-c positive control (nơi A
  //       mới có dòng) và sau SB-e (nơi dòng đó vừa được chứng minh còn nguyên).
  //       So mốc `period_anchor_at` bằng cách PARSE chứ không so chuỗi trần:
  //       Postgres trả timestamptz dưới dạng `…+00:00`, không phải `…Z` như
  //       hằng sentinel viết trong file này. Vẫn giữ phép so mốc (nó là thứ
  //       chứng minh A đọc đúng DÒNG FIXTURE chứ không phải một dòng lạc nào
  //       đó), chỉ bỏ giả định về CÁCH biểu diễn.
  const sbOwnA = await userA
    .from("subscriptions")
    .select("user_id, expires_at, period_anchor_at")
    .eq("user_id", userAId);
  const sbOwnAAnchor = sbOwnA.data?.[0]?.period_anchor_at;
  assert(
    !sbOwnA.error &&
      sbOwnA.data?.length === 1 &&
      sbOwnA.data?.[0]?.user_id === userAId &&
      typeof sbOwnAAnchor === "string" &&
      new Date(sbOwnAAnchor).toISOString() === SUB_ANCHOR_SENTINEL,
    `SB-f (positive control): A đọc được dòng subscriptions của CHÍNH MÌNH — "A không thấy gì" ở SB-b là do policy, không phải do policy giấu sạch (nhận: ${sbOwnA.error?.code ?? String(sbOwnA.data?.length ?? 0) + " dòng, mốc " + String(sbOwnAAnchor)})`,
  );

  // SB-g. anon KHÔNG đọc được subscriptions. Cùng lý do như PO-f: `revoke
  //       select … from anon` là bảo đảm DDL riêng, và nếu nó biến mất thì thất
  //       bại là IM LẶNG (0 dòng) chứ không phải ồn ào. Rò ở đây là rò danh
  //       sách "ai đang trả tiền" cho một khách chưa đăng nhập.
  const sbAnon = await anonClient.from("subscriptions").select("user_id, expires_at");
  assert(
    isAuthorizationDenial(sbAnon.error) && (sbAnon.data?.length ?? 0) === 0,
    `SB-g: anon KHÔNG đọc được subscriptions (mong đợi 42501, nhận: ${sbAnon.error?.code ?? String(sbAnon.data?.length ?? 0) + " dòng"})`,
  );

  console.log(
    "\nRLS checks (Subscription Phần 9 — record_payment_settlement PS-a/PS-b):",
  );

  // PS-a (positive control) — điều kiện làm PS-b có nghĩa. Trước lời gọi: đơn
  // của A CÒN 'pending', chưa settled, và A ĐÃ có một dòng subscriptions. Nghĩa
  // là một lời gọi ĐƯỢC PHÉP với đúng tham số đó sẽ đổi CẢ HAI dòng (status →
  // 'paid', expires_at → +30 ngày). Không có bước này, "không có gì đổi" ở PS-b
  // là một khẳng định rỗng.
  const psOrderBefore = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_code", SUB_ORDER_A)
    .single();
  const psSubBefore = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userAId)
    .single();
  assert(
    !psOrderBefore.error &&
      psOrderBefore.data?.status === "pending" &&
      psOrderBefore.data?.settled_at === null &&
      psOrderBefore.data?.user_id === userAId &&
      !psSubBefore.error &&
      psSubBefore.data?.expires_at != null,
    `PS-a (positive control): trước lời gọi, đơn của A còn 'pending' + chưa settled và A đã có dòng subscriptions — một lời gọi ĐƯỢC PHÉP sẽ đổi cả hai (status nhận được: ${psOrderBefore.data?.status ?? psOrderBefore.error?.code})`,
  );

  // PS-b (positive control) — thứ làm MÃ LỖI của PS-b có nghĩa, và là lớp
  // phòng vệ mà PS-b một mình KHÔNG có (PO-c ở trên có, SB-c ở trên có).
  // PostgREST trả PGRST202 cho BẤT KỲ tham chiếu hàm nào nó không giải được:
  // sai tên hàm, sai tên tham số, chữ ký đã đổi — chứ không riêng "role thiếu
  // EXECUTE". Thiếu bước này, một lần đổi tên hàm sau này vẫn để PS-b XANH:
  // lời gọi nhận PGRST202, và `psStateUntouched` xanh theo một cách RỖNG vì
  // thân hàm không chạy ở CẢ HAI phía. Case sẽ báo "đã chặn được" mà không
  // chứng minh nổi một chữ nào về quyền.
  //
  // Lời gọi này KHÔNG chạm vào trạng thái nào: SUB_ORDER_FORGED vừa bị xoá ở
  // PO-c, nên `update … where order_code = … and status = 'pending'` khớp 0
  // dòng, hàm rơi vào nhánh `if not found then return null` và dừng TRƯỚC cả
  // lệnh insert vào subscriptions. `data === null` chính là bằng chứng nhánh đó
  // đã chạy: vừa xác nhận hàm gọi được, vừa xác nhận nó không ghi gì.
  const psCallable = await admin.rpc("record_payment_settlement", {
    p_order_code: SUB_ORDER_FORGED,
    p_period_days: 30,
  });
  assert(
    !psCallable.error && psCallable.data === null,
    `PS-b (positive control): service_role GỌI ĐƯỢC record_payment_settlement bằng ĐÚNG tên + ĐÚNG bộ tham số mà PS-b dùng, và lời gọi là no-op (mong đợi data=null, nhận: ${psCallable.error?.code ?? JSON.stringify(psCallable.data)})`,
  );

  // PS-b (AC-033; ADR-0014 §Implementation Guidance — `revoke all on function …
  //       from public, anon, authenticated` ĐÍCH DANH). JWT học sinh gọi thẳng
  //       record_payment_settlement().
  //
  //       Tham số cố ý ĐÚNG KIỂU và ĐÚNG NGHIỆP VỤ: p_order_code là bigint của
  //       một đơn CÓ THẬT, thuộc chính A, vẫn 'pending' — tức đơn mà một lời
  //       gọi hợp lệ settle được. Nhờ thế mọi giả thuyết "thất bại vì tham số"
  //       bị loại, và mệnh đề `status = 'pending'` trong thân hàm KHÔNG thể là
  //       nguyên nhân của lời từ chối.
  //
  //       ⚠ KHÔNG assert trần `error !== null` (bài học MM-b): nếu EXECUTE bị
  //       hở, lời gọi vẫn có thể lỗi từ THÂN hàm (check_violation "no
  //       beneficiary") — mà lỗi từ thân hàm chứng minh điều NGƯỢC LẠI, rằng
  //       hàm đã gọi được. Chỉ hai lớp lỗi được chấp nhận: 42501 (permission
  //       denied for function) và PGRST202 (PostgREST không thấy hàm trong
  //       schema cache của role đang gọi).
  //
  //       PGRST202 tự nó KHÔNG nói gì về quyền: PostgREST trả đúng mã đó cho
  //       mọi tham chiếu hàm không giải được, kể cả sai tên hay sai tên tham
  //       số. Nó chỉ mang nghĩa "role không có EXECUTE" NHỜ positive control
  //       ngay trên — service_role vừa giải được CHÍNH tên và CHÍNH bộ tham số
  //       này, nên khả năng "hàm không tồn tại như đang gọi" đã bị loại bằng
  //       bằng chứng, và cái còn lại chỉ có thể là schema cache theo role.
  //
  //       Và mã lỗi một mình vẫn chưa đủ: hai ảnh chụp bằng service_role phải
  //       khớp từng byte, chứng minh thân hàm KHÔNG chạy — không dòng đơn nào
  //       chuyển 'paid', không ngày hết hạn nào được cộng thêm.
  const psRpc = await userA.rpc("record_payment_settlement", {
    p_order_code: SUB_ORDER_A,
    p_period_days: 30,
  });
  const psOrderAfter = await admin
    .from("payment_orders")
    .select("*")
    .eq("order_code", SUB_ORDER_A)
    .single();
  const psSubAfter = await admin
    .from("subscriptions")
    .select("*")
    .eq("user_id", userAId)
    .single();
  const psDeniedByPermission =
    psRpc.error !== null &&
    (psRpc.error.code === "42501" ||
      psRpc.error.code === "PGRST202" ||
      /permission denied|could not find the function/i.test(psRpc.error.message));
  const psStateUntouched =
    !psOrderAfter.error &&
    !psSubAfter.error &&
    JSON.stringify(psOrderAfter.data) === JSON.stringify(psOrderBefore.data) &&
    JSON.stringify(psSubAfter.data) === JSON.stringify(psSubBefore.data);
  assert(
    psDeniedByPermission && psStateUntouched,
    `PS-b: JWT học sinh gọi thẳng record_payment_settlement() bị chặn ở tầng QUYỀN và thân hàm KHÔNG chạy (mong đợi 42501/PGRST202, nhận: ${psRpc.error?.code ?? "KHÔNG CÓ LỖI"}; đơn + entitlement còn nguyên: ${psStateUntouched})`,
  );

  // Dọn dẹp fixture Subscription.
  await cleanupSubscriptionFixtures(admin, userAId, userBId);

  // Hậu kiểm dọn dẹp — CỐ Ý bằng vị từ KHÁC vị từ đã dùng để xoá (xoá theo
  // order_code / user_id, xác nhận theo memo / period_anchor_at). Dọn bằng một
  // vị từ rồi hỏi lại bằng chính vị từ đó thì một lệnh delete khớp 0 dòng cũng
  // cho ra "đã sạch" — đúng lỗi đã bắt được ở Task 0.8. Hai giá trị mốc dưới
  // đây do builder gắn vào MỌI dòng fixture, kể cả dòng của A được tạo giữa
  // khối, nên không dòng nào lọt lưới.
  const subResidueOrders = await admin
    .from("payment_orders")
    .select("order_code, user_id")
    .eq("memo", SUB_ORDER_MEMO);
  const subResidueSubs = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("period_anchor_at", SUB_ANCHOR_SENTINEL);
  assert(
    !subResidueOrders.error &&
      (subResidueOrders.data?.length ?? 0) === 0 &&
      !subResidueSubs.error &&
      (subResidueSubs.data?.length ?? 0) === 0,
    `Phần 9 (hậu kiểm dọn dẹp): không còn dòng fixture nào trong payment_orders/subscriptions (còn lại: ${subResidueOrders.data?.length ?? "?"} đơn / ${subResidueSubs.data?.length ?? "?"} entitlement)`,
  );

  // Dọn dẹp fixture Rating.
  await cleanupRatingFixtures(admin);

  // Dọn dẹp fixture UGC.
  await cleanupUgcFixtures(admin);

  console.log(
    failures === 0
      ? "\n✅ RLS test: tất cả PASS."
      : `\n❌ RLS test: ${failures} check FAIL.`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ RLS test lỗi:", err.message ?? err);
  process.exit(1);
});
