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
import { randomUUID } from "node:crypto";
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

// Fixture Community Solutions (backend Design Doc v1.9 § Integration
// Verification Points, task-ownership binding: migration task 03 tested here,
// task 05 — Early Verification Point of the whole work plan). Một đề published
// duy nhất, 5 câu, tác giả = User A (cùng quy ước "tác giả = A" dùng lại ở
// Rating/History phía trên — A vừa là tác giả vừa là người nộp bài, RLS không
// cấm điều đó). Dùng LẠI đúng exam/solution fixture xuyên suốt mọi case dưới
// đây để không nhân bản setup — mỗi case chỉ đổi TRẠNG THÁI (đề/attempt/bài
// giải), không tạo exam mới.
const CS_EXAM_ID = "rls-cs-exam";
const CS_QUESTION_IDS = [1, 2, 3, 4, 5].map((n) => `${CS_EXAM_ID}-q${n}`);

// User thứ ba (bền vững, cùng quy ước A/B — không xoá ở cuối) — task 16 (test
// task migration 13) cần nó cho remove_community_solution_helpful case (a).
const EMAIL_C = "smithnguyen247+rlstestc@gmail.com";

// Fixture Community Solutions — task 16 (test task của migration 13; backend
// DD v1.9 § Integration Verification Points / § Test Boundaries "User-write
// RPC groups"). Đề RIÊNG, KHÔNG dùng lại CS_EXAM_ID ở trên — Phần 10 (task 05)
// dọn sạch fixture của nó trước khi khối task-16 chạy trong cùng file.
const CS16_EXAM_ID = "rls-cs16-exam";
const CS16_QUESTION_IDS = [1, 2, 3, 4, 5].map((n) => `${CS16_EXAM_ID}-q${n}`);
// Đề THỨ HAI, chỉ để làm mục tiêu refusal của set_community_solution_pin
// ("một bài giải published của MỘT ĐỀ KHÁC").
const CS16_OTHER_EXAM_ID = "rls-cs16-exam-other";
const CS16_OTHER_QUESTION_ID = `${CS16_OTHER_EXAM_ID}-q1`;

/** Xóa sạch fixture Community Solutions của task 16 (chạy trước VÀ sau để
 *  idempotent). community_solution_notes/comments/helpfuls đều `on delete
 *  cascade` theo community_solutions, không cần xoá tường minh. */
async function cleanupCs16Fixtures(admin: SupabaseClient) {
  const examIds = [CS16_EXAM_ID, CS16_OTHER_EXAM_ID];
  await admin.from("community_moderation_log").delete().in("exam_id", examIds);
  await admin.from("community_solutions").delete().in("exam_id", examIds);
  await admin.from("exam_attempts").delete().in("exam_id", examIds);
  await admin.from("exams").delete().in("id", examIds);
  await admin.from("questions").delete().in("id", [...CS16_QUESTION_IDS, CS16_OTHER_QUESTION_ID]);
}

/** Sinh đúng `n` từ (đếm bằng khoảng trắng, khớp `count_words`/`countWords`). */
function csWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `tu${i + 1}`).join(" ");
}

// Fixture Community Solutions — task 27 (test task của migration 25; backend
// DD v1.9 § Integration Verification Points / § Test Boundaries "User-write
// RPC groups"). Đề RIÊNG THỨ BA, KHÔNG dùng lại CS_EXAM_ID/CS16_EXAM_ID ở
// trên — Phần 11 (task 16) dọn sạch fixture của nó trước khi khối task-27
// chạy trong cùng file.
const CS27_EXAM_ID = "rls-cs27-exam";
const CS27_QUESTION_IDS = [1, 2, 3].map((n) => `${CS27_EXAM_ID}-q${n}`);
// Câu hỏi KHÔNG nằm trong question_ids của đề — dùng cho case (c) của
// post_community_comment. Không cần row `questions` cho id này: điều kiện
// eligibility (`p_question_id = any(e.question_ids)`) chặn TRƯỚC khi RPC chạm
// tới bảng đó, nên FK không bao giờ được kiểm tới.
const CS27_OUTSIDE_QUESTION_ID = `${CS27_EXAM_ID}-q-outside`;

/** Xóa sạch fixture Community Solutions của task 27 (chạy trước VÀ sau để
 *  idempotent). community_solution_notes/comments (và report của comment) đều
 *  `on delete cascade` theo community_solutions/community_solution_comments,
 *  không cần xoá tường minh. */
async function cleanupCs27Fixtures(admin: SupabaseClient) {
  await admin.from("community_moderation_log").delete().eq("exam_id", CS27_EXAM_ID);
  await admin.from("community_solutions").delete().eq("exam_id", CS27_EXAM_ID);
  await admin.from("exam_attempts").delete().eq("exam_id", CS27_EXAM_ID);
  await admin.from("exams").delete().eq("id", CS27_EXAM_ID);
  await admin.from("questions").delete().in("id", CS27_QUESTION_IDS);
}

// Fixture Community Solutions — task 35 (test task của migration 32; backend
// DD v1.9 § Integration Verification Points / § Test Boundaries "User-write
// RPC groups"). Ba đề RIÊNG, mỗi đề 3 câu, tác giả = A: một cho hai nhóm RPC
// báo cáo + `i_reported`, một cho nhóm admin (kiểm duyệt bài giải/bình luận,
// AC-084, SN-1), một cho hàng đợi admin + ghi chú cho admin — tách đề để mỗi
// nhóm đọc đúng trạng thái của riêng nó (hàng đợi là toàn cục).
const CS35_REPORT_EXAM_ID = "rls-cs35-report";
const CS35_MOD_EXAM_ID = "rls-cs35-mod";
const CS35_QUEUE_EXAM_ID = "rls-cs35-queue";
const CS35_EXAM_IDS = [CS35_REPORT_EXAM_ID, CS35_MOD_EXAM_ID, CS35_QUEUE_EXAM_ID];
function cs35QuestionIds(examId: string): string[] {
  return [1, 2, 3].map((n) => `${examId}-q${n}`);
}
// User thứ tư (bền vững, cùng quy ước A/B/C) — case `i_reported` cần bốn người
// khác nhau không phải admin: người viết W, người bình luận Q, người báo cáo R
// và người thứ ba T chưa báo cáo gì.
const EMAIL_D = "smithnguyen247+rlstestd@gmail.com";

/** Xóa sạch fixture Community Solutions của task 35 (chạy trước VÀ sau để
 *  idempotent). Ghi chú/Hữu ích/bình luận/báo cáo cascade theo bài giải;
 *  community_moderation_log cascade theo exam_id. */
async function cleanupCs35Fixtures(admin: SupabaseClient) {
  await admin.from("community_moderation_log").delete().in("exam_id", CS35_EXAM_IDS);
  await admin.from("community_solutions").delete().in("exam_id", CS35_EXAM_IDS);
  await admin.from("exam_attempts").delete().in("exam_id", CS35_EXAM_IDS);
  await admin.from("exams").delete().in("id", CS35_EXAM_IDS);
  await admin.from("questions").delete().in("id", CS35_EXAM_IDS.flatMap(cs35QuestionIds));
}

/** Xóa sạch fixture Community Solutions (chạy trước VÀ sau để idempotent). */
async function cleanupCommunitySolutionsFixtures(admin: SupabaseClient) {
  await admin.from("community_moderation_log").delete().eq("exam_id", CS_EXAM_ID);
  await admin.from("community_solutions").delete().eq("exam_id", CS_EXAM_ID);
  await admin.from("exam_attempts").delete().eq("exam_id", CS_EXAM_ID);
  await admin.from("exams").delete().eq("id", CS_EXAM_ID);
  await admin.from("questions").delete().in("id", CS_QUESTION_IDS);
}

/** Tạo fixture Community Solutions qua service_role: 1 đề published, 5 câu, tác
 *  giả = A. KHÔNG tạo attempt/bài giải ở đây — từng nhóm case tự tạo attempt
 *  đúng lúc nó cần (case "Writer attempt id" cần đọc trạng thái CHƯA có attempt
 *  nào trước). */
async function setupCommunitySolutionsFixtures(admin: SupabaseClient, authorId: string) {
  const questions = await admin.from("questions").insert(
    CS_QUESTION_IDS.map((id, i) => ({
      id,
      content: `[RLS-CS] Câu ${i + 1} bản gốc`,
      choices: MCQ_CHOICES,
      correct_answer: "A",
      subject: "Toán",
      grade: 10,
      topic: "Toán",
    })),
  );
  if (questions.error) throw questions.error;

  const exam = await admin.from("exams").insert({
    id: CS_EXAM_ID,
    title: "[RLS] Đề Bài giải cộng đồng",
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "RLS Test Author",
    question_ids: CS_QUESTION_IDS,
    status: "published",
  });
  if (exam.error) throw exam.error;
}

/** Tạo một lượt làm ĐÃ NỘP qua service_role, trả về id. `submittedAt` quyết
 *  định thứ tự "mới nhất" mà `community_solution_for_writer` dùng. */
async function insertSubmittedAttempt(
  admin: SupabaseClient,
  userId: string,
  examId: string,
  submittedAt: Date,
): Promise<string> {
  const res = await admin
    .from("exam_attempts")
    .insert({
      user_id: userId,
      exam_id: examId,
      status: "submitted",
      started_at: new Date(submittedAt.getTime() - 60_000).toISOString(),
      submitted_at: submittedAt.toISOString(),
    })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id as string;
}

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

/** Phiên Supabase Auth THƯỜNG của admin đã seed trong `admin_users` (task 03:
 *  seed out-of-band từ ADMIN_USER_IDS của chính project này).
 *
 *  TD-029: đây KHÔNG phải service-role client. Setup client chỉ dùng Auth
 *  Admin API để sinh một token magic-link (không gửi email, không đổi mật khẩu
 *  tài khoản thật); một anon client MỚI tự đổi token đó lấy JWT
 *  `authenticated` của đúng user admin — mọi RPC admin sau đó chạy dưới
 *  `auth.uid()` thật, như phiên A/B/C. Không tìm thấy id nào đã seed thì dừng
 *  hẳn: đó là thiếu seed (chạy lại seed của task 03), không phải lỗi code. */
async function signInAsSeededAdmin(
  admin: SupabaseClient,
  url: string,
  anon: string,
  adminUserIdsEnv: string | undefined,
): Promise<{ client: SupabaseClient; userId: string }> {
  const configuredIds = (adminUserIdsEnv ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seeded = await admin.from("admin_users").select("user_id").in("user_id", configuredIds);
  if (seeded.error) throw seeded.error;
  const userId = (seeded.data?.[0] as { user_id: string } | undefined)?.user_id;
  if (!userId) {
    throw new Error(
      "admin_users không chứa id nào của ADMIN_USER_IDS — chạy lại seed out-of-band của task 03, KHÔNG sửa test",
    );
  }
  const user = await admin.auth.admin.getUserById(userId);
  if (user.error) throw user.error;
  const email = user.data.user.email;
  if (!email) throw new Error("User admin đã seed không có email — không đăng nhập bằng magic link được");

  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const client = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({
    token_hash: link.data.properties.hashed_token,
    type: "magiclink",
  });
  if (verified.error) throw verified.error;
  return { client, userId };
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
  const userCId = await ensureUser(admin, EMAIL_C);

  const userA = await signInAs(url, anon, EMAIL_A); // TÁC GIẢ
  const userB = await signInAs(url, anon, EMAIL_B); // non-author
  // Task 16 (test task migration 13) — user thứ ba: cần một caller KHÔNG giữ
  // dòng Helpful gọi remove trong khi một người KHÁC đang giữ dòng, cả hai
  // đồng thời tồn tại (remove_community_solution_helpful case (a)).
  const userC = await signInAs(url, anon, EMAIL_C);
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

  // ==========================================================================
  // Phần 10 — Community Solutions (backend Design Doc v1.9 § Integration
  // Verification Points; § Verification Strategy Early Verification Point).
  // ĐÂY LÀ TASK KIỂM CHO migration task 03 (task-ownership binding, v1.9): mọi
  // case dưới đây thuộc về task 03's DDL/functions, được VIẾT VÀ CHẠY ở task
  // 05. Cũng là Early Verification Point của TOÀN BỘ work plan — REQUIRED,
  // BLOCKING: một lượt gate lệch ở đây thì mọi RPC user-write sau này (task 06
  // trở đi) sao chép lại đúng gate lệch đó (xem Investigation Notes của task
  // 05 — so sánh predicate exam_answer_key() / save_community_solution()).
  // ==========================================================================
  console.log("\nCommunity Solutions — setup fixture (service_role)…");
  await cleanupCommunitySolutionsFixtures(admin);
  await setupCommunitySolutionsFixtures(admin, userAId);

  console.log("\nRLS checks (Community Solutions — admin_users / is_admin_user()):");

  // CS-admin (refusal). anon KHÔNG gọi được is_admin_user().
  const csAdminAnon = await anonClient.rpc("is_admin_user");
  assert(
    isAuthorizationDenial(csAdminAnon.error),
    `CS-admin refusal: anon KHÔNG gọi được is_admin_user() (nhận: ${csAdminAnon.error?.code ?? "KHÔNG CÓ LỖI"})`,
  );
  // CS-admin (refusal, table closure). B (authenticated, KHÔNG phải admin)
  // KHÔNG đọc trực tiếp được bảng admin_users (revoke all + RLS bật, không
  // policy nào).
  const csAdminUsersDirect = await userB.from("admin_users").select("user_id");
  assert(
    isAuthorizationDenial(csAdminUsersDirect.error) || (csAdminUsersDirect.data?.length ?? 0) === 0,
    `CS-admin refusal (table closure): B KHÔNG đọc trực tiếp được admin_users (nhận: ${csAdminUsersDirect.error?.code ?? `${csAdminUsersDirect.data?.length ?? 0} dòng`})`,
  );
  // CS-admin (success). B — authenticated, KHÔNG phải admin — gọi ĐƯỢC
  // is_admin_user() (chỉ BẢNG đóng, HÀM mở cho authenticated) và nhận false.
  const csAdminB = await userB.rpc("is_admin_user");
  assert(
    !csAdminB.error && csAdminB.data === false,
    `CS-admin success: B (không phải admin) gọi được is_admin_user() và nhận false (nhận: ${csAdminB.error?.code ?? csAdminB.data})`,
  );

  console.log(
    "\nRLS checks (Community Solutions — table closure community_solutions / community_solution_notes):",
  );

  // CS-table-closure (refusal). Không client role nào có đường ghi/đọc TRỰC
  // TIẾP — RLS bật, KHÔNG policy nào, `revoke all from anon, authenticated`.
  const csDirectInsertSolution = await userA
    .from("community_solutions")
    .insert({ exam_id: CS_EXAM_ID, author_id: userAId })
    .select("id");
  assert(
    isAuthorizationDenial(csDirectInsertSolution.error) && (csDirectInsertSolution.data?.length ?? 0) === 0,
    `CS table closure: A KHÔNG tự INSERT trực tiếp được community_solutions (nhận: ${csDirectInsertSolution.error?.code ?? "KHÔNG CÓ LỖI"})`,
  );
  const csDirectSelectSolution = await userA.from("community_solutions").select("id");
  assert(
    isAuthorizationDenial(csDirectSelectSolution.error) || (csDirectSelectSolution.data?.length ?? 0) === 0,
    `CS table closure: A KHÔNG đọc trực tiếp được community_solutions (nhận: ${csDirectSelectSolution.error?.code ?? `${csDirectSelectSolution.data?.length ?? 0} dòng`})`,
  );
  const csDirectInsertNote = await userA
    .from("community_solution_notes")
    .insert({ solution_id: randomUUID(), question_id: CS_QUESTION_IDS[0], body: "x" })
    .select();
  assert(
    isAuthorizationDenial(csDirectInsertNote.error) && (csDirectInsertNote.data?.length ?? 0) === 0,
    `CS table closure: A KHÔNG tự INSERT trực tiếp được community_solution_notes (nhận: ${csDirectInsertNote.error?.code ?? "KHÔNG CÓ LỖI"})`,
  );
  // Nhóm THÀNH CÔNG cho hai bảng này chứng minh ở các bước RPC ngay dưới đây —
  // save_community_solution ghi được đúng dòng mà client KHÔNG viết trực tiếp
  // được, đối chứng độc lập qua chính service_role.

  console.log("\nRLS checks (Community Solutions — Writer attempt id / Writer payload key set):");

  const csAttemptOld = await insertSubmittedAttempt(admin, userAId, CS_EXAM_ID, new Date(Date.now() - 3_600_000));
  const csAttemptNew = await insertSubmittedAttempt(admin, userAId, CS_EXAM_ID, new Date());

  const writerBeforeSolution = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const writerBeforeRow = writerBeforeSolution.data?.[0] as
    | { solution_id: string | null; status: string | null; attempt_id: string | null }
    | undefined;
  assert(
    !writerBeforeSolution.error &&
      writerBeforeSolution.data?.length === 1 &&
      writerBeforeRow?.solution_id === null &&
      writerBeforeRow?.status === null &&
      writerBeforeRow?.attempt_id === csAttemptNew,
    `Writer attempt id: chưa có bài giải → 1 dòng, solution_id/status null, attempt_id = lượt nộp MỚI NHẤT chứ không phải lượt cũ hơn (nhận: ${JSON.stringify(writerBeforeRow)}, mong đợi attempt_id=${csAttemptNew})`,
  );

  // csAttemptOld chỉ để chứng minh "không thắng" ở check trên — xoá ngay để
  // không còn 'submitted' nào khác lẫn vào các bước dưới (nếu còn, nó sẽ
  // "thắng" khi csAttemptNew bị chuyển in_progress ở bước sau).
  await admin.from("exam_attempts").delete().eq("id", csAttemptOld);

  const csNotesInitial = [
    { question_id: CS_QUESTION_IDS[0], body: csWords(15) },
    { question_id: CS_QUESTION_IDS[1], body: csWords(15) },
    { question_id: CS_QUESTION_IDS[2], body: csWords(9) },
  ];
  const saveInitial = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: csNotesInitial,
  });
  const saveInitialRow = saveInitial.data?.[0] as { solution_id: string; status: string } | undefined;
  assert(
    !saveInitial.error && saveInitial.data?.length === 1 && saveInitialRow?.status === "draft",
    `save_community_solution (lần 1): tạo bài giải draft, không lỗi (nhận: ${saveInitial.error?.code ?? JSON.stringify(saveInitial.data)})`,
  );
  const csSolutionId = saveInitialRow!.solution_id;

  // Nhóm THÀNH CÔNG (đối chứng độc lập qua service_role) cho community_solutions
  // / community_solution_notes — bảng bị đóng với client (kiểm ở trên) nhưng
  // RPC vừa ghi đúng dòng.
  const csSolutionRow = await admin
    .from("community_solutions")
    .select("id, exam_id, author_id, status")
    .eq("id", csSolutionId)
    .single();
  assert(
    !csSolutionRow.error && csSolutionRow.data?.exam_id === CS_EXAM_ID && csSolutionRow.data?.author_id === userAId,
    "CS success: community_solutions có đúng dòng do save_community_solution tạo (exam_id/author_id khớp)",
  );
  const csNotesRows = await admin.from("community_solution_notes").select("question_id").eq("solution_id", csSolutionId);
  assert(
    !csNotesRows.error && (csNotesRows.data?.length ?? 0) === 3,
    `CS success: community_solution_notes có đúng 3 dòng ghi chú do RPC tạo (nhận ${csNotesRows.data?.length})`,
  );

  const writerAfterSave = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const writerAfterSaveRow = writerAfterSave.data?.[0] as Record<string, unknown> | undefined;
  assert(
    !writerAfterSave.error &&
      writerAfterSave.data?.length === 1 &&
      writerAfterSaveRow?.solution_id === csSolutionId &&
      writerAfterSaveRow?.status === "draft" &&
      writerAfterSaveRow?.attempt_id === csAttemptNew,
    `Writer attempt id: sau save, attempt_id vẫn = attempt mới nhất, qua linked_attempt_id (nhận: ${JSON.stringify(writerAfterSaveRow)})`,
  );
  const writerKeys = Object.keys(writerAfterSaveRow ?? {}).sort();
  const expectedWriterKeys = [
    "attempt_id",
    "hidden_reason",
    "questions",
    "show_profile",
    "show_score",
    "solution_id",
    "status",
  ].sort();
  assert(
    JSON.stringify(writerKeys) === JSON.stringify(expectedWriterKeys),
    `Writer payload key set: đúng 7 khoá {solution_id, attempt_id, status, show_profile, show_score, hidden_reason, questions}, set-equal cả hai chiều (nhận: ${JSON.stringify(writerKeys)})`,
  );

  // Đổi NỘI DUNG câu 1 (KHÔNG đổi ghi chú) → question_content_fingerprint đổi
  // → has_changed=true cho ĐÚNG một câu (câu 1). Câu 4/5 chưa có ghi chú nên
  // has_changed của chúng luôn false (n.solution_id is null).
  const changeQ1Content = await admin
    .from("questions")
    .update({ content: "[RLS-CS] Câu 1 ĐÃ SỬA NỘI DUNG" })
    .eq("id", CS_QUESTION_IDS[0]);
  if (changeQ1Content.error) throw changeQ1Content.error;

  const writerAfterContentChange = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const questionsPayload = (writerAfterContentChange.data?.[0] as { questions?: Array<{ question_id: string; has_changed: boolean }> } | undefined)
    ?.questions;
  const changedCount = (questionsPayload ?? []).filter((q) => q.has_changed).length;
  const q1HasChanged = questionsPayload?.find((q) => q.question_id === CS_QUESTION_IDS[0])?.has_changed;
  assert(
    !writerAfterContentChange.error && changedCount === 1 && q1HasChanged === true,
    `Writer payload has_changed: đúng 1 câu có has_changed=true (câu 1, nội dung vừa đổi) trong số các câu CÓ ghi chú (nhận: đếm=${changedCount}, câu 1=${q1HasChanged})`,
  );

  // Attempt quay lại 'in_progress' (KHÔNG còn attempt 'submitted' nào khác của
  // A trên đề này, vì csAttemptOld đã xoá ở trên) → community_solution_for_writer
  // trả 0 dòng dù bài giải đã có.
  const toInProgress = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", csAttemptNew);
  if (toInProgress.error) throw toInProgress.error;
  const writerWhileInProgress = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  assert(
    !writerWhileInProgress.error && (writerWhileInProgress.data?.length ?? -1) === 0,
    `Writer attempt id: attempt quay 'in_progress' → 0 dòng dù đã có bài giải (nhận ${writerWhileInProgress.data?.length})`,
  );
  const toSubmittedAgain = await admin
    .from("exam_attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", csAttemptNew);
  if (toSubmittedAgain.error) throw toSubmittedAgain.error;
  const writerResubmitted = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const writerResubmittedRow = writerResubmitted.data?.[0] as Record<string, unknown> | undefined;
  assert(
    !writerResubmitted.error &&
      writerResubmitted.data?.length === 1 &&
      writerResubmittedRow?.solution_id === csSolutionId &&
      writerResubmittedRow?.attempt_id === csAttemptNew,
    "Writer attempt id: nộp lại (submitted) → về đúng dòng như trước",
  );

  console.log("\nRLS checks (Community Solutions — Publish refusal DETAIL / Early Verification Point):");

  // 5 câu hiện tại: câu 1/2 đủ 15 từ, câu 3 chỉ 9 từ, câu 4/5 chưa có ghi chú
  // → thiếu đúng 3 câu.
  const publishMissing3 = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  assert(
    publishMissing3.error?.code === "23514" && publishMissing3.error?.details === "3",
    `Publish refusal DETAIL: thiếu 3 câu (câu 3 chỉ 9 từ + câu 4/5 chưa có ghi chú) → DETAIL đúng bằng chuỗi '3' (nhận: ${JSON.stringify(publishMissing3.error?.details)})`,
  );
  const solutionAfterMissing3 = await admin.from("community_solutions").select("status").eq("id", csSolutionId).single();
  assert(solutionAfterMissing3.data?.status === "draft", "Publish refusal DETAIL: row vẫn 'draft' sau từ chối (DETAIL '3')");

  // Câu 3 lên 15 từ — đang draft nên không bị luật 15-từ chặn ở đây.
  const fixQ3 = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [{ question_id: CS_QUESTION_IDS[2], body: csWords(15) }],
  });
  assert(!fixQ3.error, `save_community_solution: nâng ghi chú câu 3 lên 15 từ, không lỗi (nhận ${fixQ3.error?.code})`);

  const publishMissing2 = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  assert(
    publishMissing2.error?.code === "23514" && publishMissing2.error?.details === "2",
    `Publish refusal DETAIL: còn thiếu 2 câu (4/5) → DETAIL đúng bằng chuỗi '2' (nhận: ${JSON.stringify(publishMissing2.error?.details)})`,
  );

  const fixQ4Q5 = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [
      { question_id: CS_QUESTION_IDS[3], body: csWords(15) },
      { question_id: CS_QUESTION_IDS[4], body: csWords(15) },
    ],
  });
  assert(!fixQ4Q5.error, `save_community_solution: điền nốt ghi chú câu 4/5, không lỗi (nhận ${fixQ4Q5.error?.code})`);

  const publishSuccess = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  const publishSuccessRow = publishSuccess.data?.[0] as { status: string } | undefined;
  assert(
    !publishSuccess.error && publishSuccess.data?.length === 1 && publishSuccessRow?.status === "published",
    `Publish refusal DETAIL / Early Verification Point: đủ 5 câu ≥15 từ → publish thành công, status='published', không raise gì (nhận: ${publishSuccess.error?.code ?? JSON.stringify(publishSuccess.data)})`,
  );

  const draftNeverThrows23514 = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    !draftNeverThrows23514.error && (draftNeverThrows23514.data?.[0] as { status: string } | undefined)?.status === "draft",
    "Publish refusal DETAIL: 'draft' không bao giờ bắn 23514 — gate chỉ áp cho publish",
  );
  const republishForNextGroups = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  assert(
    !republishForNextGroups.error &&
      (republishForNextGroups.data?.[0] as { status: string } | undefined)?.status === "published",
    "Publish lại thành công (mọi ghi chú vẫn ≥15 từ) — chuẩn bị bài giải published cho các nhóm AC-004/AC-002 dưới đây",
  );

  // Early Verification Point, tiêu chí thứ 3: một lời gọi từ người CHƯA nộp bài
  // (B) bị từ chối 42501 và KHÔNG tạo dòng nào — kiểm bằng đếm độc lập trước/
  // sau qua service_role (AC-002).
  //
  // RED-phase self-check (task file § Implementation Steps, Red Phase): trước
  // khi chốt bản dưới đây, đã tạm đổi `userB` → `userA` (người ĐÃ nộp bài) ở
  // lời gọi RPC bên dưới, chạy lại toàn bộ `test-rls.ts`, và xác nhận assertion
  // này chuyển ĐỎ (userA gọi được — code khác 42501/không phải "not submitted"
  // của B) trước khi revert về đúng userB. Xem Investigation Notes/báo cáo.
  const beforeBCount = await admin
    .from("community_solutions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", CS_EXAM_ID)
    .eq("author_id", userBId);
  const saveAsB = await userB.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: null,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [],
  });
  const afterBCount = await admin
    .from("community_solutions")
    .select("id", { count: "exact", head: true })
    .eq("exam_id", CS_EXAM_ID)
    .eq("author_id", userBId);
  assert(
    saveAsB.error?.code === "42501" && (beforeBCount.count ?? -1) === 0 && (afterBCount.count ?? -1) === 0,
    `Early Verification Point (tiêu chí 3): B (chưa nộp bài) gọi save_community_solution bị 42501, KHÔNG tạo dòng nào cho B (nhận: mã=${saveAsB.error?.code}, trước=${beforeBCount.count}, sau=${afterBCount.count})`,
  );

  console.log("\nRLS checks (Community Solutions — AC-004 gate: đề chuyển draft):");

  const csLog1 = await admin
    .from("community_moderation_log")
    .insert({
      target_type: "solution",
      target_id: randomUUID(),
      exam_id: CS_EXAM_ID,
      target_user_id: userAId,
      actor_id: userAId,
      action: "delete",
      reason: "[RLS-CS] Lý do xoá hẳn #1 (AC-004, đề draft)",
    })
    .select("id")
    .single();
  if (csLog1.error) throw csLog1.error;

  const snapshotBeforeExamDraft = await admin
    .from("community_solutions")
    .select("status, updated_at")
    .eq("id", csSolutionId)
    .single();
  const notesBeforeExamDraft = await admin
    .from("community_solution_notes")
    .select("question_id, body")
    .eq("solution_id", csSolutionId)
    .order("question_id");

  const examToDraft = await admin.from("exams").update({ status: "draft" }).eq("id", CS_EXAM_ID);
  if (examToDraft.error) throw examToDraft.error;

  const saveWhileExamDraft = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [],
  });
  const publishWhileExamDraft = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  const draftWhileExamDraft = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    saveWhileExamDraft.error?.code === "42501" &&
      saveWhileExamDraft.error?.message === "save_community_solution: exam not visible" &&
      publishWhileExamDraft.error?.code === "42501" &&
      publishWhileExamDraft.error?.message === "set_community_solution_status: exam not visible" &&
      draftWhileExamDraft.error?.code === "42501" &&
      draftWhileExamDraft.error?.message === "set_community_solution_status: exam not visible",
    `AC-004 gate (đề draft): save/publish/draft đều 42501 '<function>: exam not visible' (nhận: ${saveWhileExamDraft.error?.message} / ${publishWhileExamDraft.error?.message} / ${draftWhileExamDraft.error?.message})`,
  );
  const snapshotDuringExamDraft = await admin
    .from("community_solutions")
    .select("status, updated_at")
    .eq("id", csSolutionId)
    .single();
  const notesDuringExamDraft = await admin
    .from("community_solution_notes")
    .select("question_id, body")
    .eq("solution_id", csSolutionId)
    .order("question_id");
  assert(
    JSON.stringify(snapshotDuringExamDraft.data) === JSON.stringify(snapshotBeforeExamDraft.data) &&
      JSON.stringify(notesDuringExamDraft.data) === JSON.stringify(notesBeforeExamDraft.data),
    "AC-004 gate (đề draft): community_solutions/community_solution_notes KHÔNG đổi dòng nào sau 3 lời gọi bị từ chối",
  );

  const writerWhileExamDraft = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const resultCardWhileExamDraft = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  assert(
    (writerWhileExamDraft.data?.length ?? -1) === 0 && (resultCardWhileExamDraft.data?.length ?? -1) === 0,
    `AC-004 gate (đề draft): community_solution_for_writer/community_solution_result_card trả 0 dòng (nhận ${writerWhileExamDraft.data?.length}/${resultCardWhileExamDraft.data?.length})`,
  );
  const csLog1Unseen = await admin.from("community_moderation_log").select("viewed_at").eq("id", csLog1.data!.id).single();
  assert(
    csLog1Unseen.data?.viewed_at === null,
    "AC-004 gate (đề draft): community_moderation_log #1 vẫn viewed_at=null (result_card không đọc được lúc đề vô hình)",
  );

  const examRestored1 = await admin.from("exams").update({ status: "published" }).eq("id", CS_EXAM_ID);
  if (examRestored1.error) throw examRestored1.error;
  const writerAfterExamRestore1 = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  assert(
    (writerAfterExamRestore1.data?.length ?? 0) === 1,
    "AC-004 gate: sau khi đề published lại, community_solution_for_writer trả lại đúng dòng",
  );
  const resultCardFirstRead1 = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  const resultCardRow1a = resultCardFirstRead1.data?.[0] as { unseen_deletion_reason: string | null } | undefined;
  assert(
    !resultCardFirstRead1.error && resultCardRow1a?.unseen_deletion_reason === "[RLS-CS] Lý do xoá hẳn #1 (AC-004, đề draft)",
    `AC-004 gate: sau khi đề published lại, result_card trả đúng lý do xoá hẳn LẦN ĐẦU (nhận: ${resultCardRow1a?.unseen_deletion_reason})`,
  );
  const resultCardSecondRead1 = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  const resultCardRow1b = resultCardSecondRead1.data?.[0] as { unseen_deletion_reason: string | null } | undefined;
  assert(
    !resultCardSecondRead1.error && resultCardRow1b?.unseen_deletion_reason === null,
    `AC-004 gate: lần đọc THỨ HAI, lý do xoá hẳn không còn (đã đánh dấu viewed_at — "đúng một lần") (nhận: ${resultCardRow1b?.unseen_deletion_reason})`,
  );

  console.log("\nRLS checks (Community Solutions — AC-004 gate: tác giả bị ban):");

  const csLog2 = await admin
    .from("community_moderation_log")
    .insert({
      target_type: "solution",
      target_id: randomUUID(),
      exam_id: CS_EXAM_ID,
      target_user_id: userAId,
      actor_id: userAId,
      action: "delete",
      reason: "[RLS-CS] Lý do xoá hẳn #2 (AC-004, tác giả bị ban)",
    })
    .select("id")
    .single();
  if (csLog2.error) throw csLog2.error;

  const banAuthor = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
  if (banAuthor.error) throw banAuthor.error;

  const snapshotBeforeBan = await admin.from("community_solutions").select("status, updated_at").eq("id", csSolutionId).single();
  const saveWhileBanned = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [],
  });
  const publishWhileBanned = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  const draftWhileBanned = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    saveWhileBanned.error?.code === "42501" &&
      saveWhileBanned.error?.message === "save_community_solution: exam not visible" &&
      publishWhileBanned.error?.code === "42501" &&
      publishWhileBanned.error?.message === "set_community_solution_status: exam not visible" &&
      draftWhileBanned.error?.code === "42501" &&
      draftWhileBanned.error?.message === "set_community_solution_status: exam not visible",
    `AC-004 gate (tác giả bị ban): save/publish/draft đều 42501 '<function>: exam not visible' (nhận: ${saveWhileBanned.error?.message} / ${publishWhileBanned.error?.message} / ${draftWhileBanned.error?.message})`,
  );
  const snapshotDuringBan = await admin.from("community_solutions").select("status, updated_at").eq("id", csSolutionId).single();
  assert(
    JSON.stringify(snapshotDuringBan.data) === JSON.stringify(snapshotBeforeBan.data),
    "AC-004 gate (tác giả bị ban): community_solutions KHÔNG đổi dòng sau 3 lời gọi bị từ chối",
  );

  const writerWhileBanned = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  const resultCardWhileBanned = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  assert(
    (writerWhileBanned.data?.length ?? -1) === 0 && (resultCardWhileBanned.data?.length ?? -1) === 0,
    "AC-004 gate (tác giả bị ban): community_solution_for_writer/community_solution_result_card trả 0 dòng",
  );
  const csLog2Unseen = await admin.from("community_moderation_log").select("viewed_at").eq("id", csLog2.data!.id).single();
  assert(
    csLog2Unseen.data?.viewed_at === null,
    "AC-004 gate (tác giả bị ban): community_moderation_log #2 vẫn viewed_at=null",
  );

  const unbanAuthor = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
  if (unbanAuthor.error) throw unbanAuthor.error;

  const writerAfterUnban = await userA.rpc("community_solution_for_writer", { p_exam_id: CS_EXAM_ID });
  assert((writerAfterUnban.data?.length ?? 0) === 1, "AC-004 gate: sau khi bỏ ban, community_solution_for_writer trả lại đúng dòng");
  const resultCardAfterUnbanFirst = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  const rowUnban1 = resultCardAfterUnbanFirst.data?.[0] as { unseen_deletion_reason: string | null } | undefined;
  assert(
    rowUnban1?.unseen_deletion_reason === "[RLS-CS] Lý do xoá hẳn #2 (AC-004, tác giả bị ban)",
    `AC-004 gate: sau khi bỏ ban, lần đọc đầu trả đúng lý do #2 (nhận ${rowUnban1?.unseen_deletion_reason})`,
  );
  const resultCardAfterUnbanSecond = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  const rowUnban2 = resultCardAfterUnbanSecond.data?.[0] as { unseen_deletion_reason: string | null } | undefined;
  assert(rowUnban2?.unseen_deletion_reason === null, "AC-004 gate: lần đọc thứ hai sau bỏ ban, lý do xoá hẳn không còn");

  console.log("\nRLS checks (Community Solutions — AC-002 gate):");

  const csLog3 = await admin
    .from("community_moderation_log")
    .insert({
      target_type: "solution",
      target_id: randomUUID(),
      exam_id: CS_EXAM_ID,
      target_user_id: userAId,
      actor_id: userAId,
      action: "delete",
      reason: "[RLS-CS] Lý do xoá hẳn #3 (AC-002)",
    })
    .select("id")
    .single();
  if (csLog3.error) throw csLog3.error;

  const attemptToInProgress = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", csAttemptNew);
  if (attemptToInProgress.error) throw attemptToInProgress.error;

  const publishWhileInProgress = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  const draftWhileInProgress = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    publishWhileInProgress.error?.code === "42501" &&
      publishWhileInProgress.error?.message === "set_community_solution_status: not submitted" &&
      draftWhileInProgress.error?.code === "42501" &&
      draftWhileInProgress.error?.message === "set_community_solution_status: not submitted",
    `AC-002 gate: publish/draft đều 42501 'set_community_solution_status: not submitted' khi attempt của A đang 'in_progress' (nhận: ${publishWhileInProgress.error?.message} / ${draftWhileInProgress.error?.message})`,
  );
  const solutionDuringInProgress = await admin.from("community_solutions").select("status").eq("id", csSolutionId).single();
  assert(solutionDuringInProgress.data?.status === "published", "AC-002 gate: community_solutions KHÔNG đổi dòng (vẫn 'published')");

  const resultCardWhileInProgress = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  assert((resultCardWhileInProgress.data?.length ?? -1) === 0, "AC-002 gate: community_solution_result_card trả 0 dòng");
  const csLog3Unseen = await admin.from("community_moderation_log").select("viewed_at").eq("id", csLog3.data!.id).single();
  assert(csLog3Unseen.data?.viewed_at === null, "AC-002 gate: community_moderation_log #3 vẫn viewed_at=null");

  const attemptResubmitted = await admin
    .from("exam_attempts")
    .update({ status: "submitted", submitted_at: new Date().toISOString() })
    .eq("id", csAttemptNew);
  if (attemptResubmitted.error) throw attemptResubmitted.error;
  const draftAfterResubmit = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    !draftAfterResubmit.error && (draftAfterResubmit.data?.[0] as { status: string } | undefined)?.status === "draft",
    "AC-002 gate: sau khi nộp lại (submitted), set_community_solution_status hoạt động bình thường trở lại",
  );

  const republishForSaveGroup = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  if (republishForSaveGroup.error) throw republishForSaveGroup.error;

  console.log("\nRLS checks (Community Solutions — Save refusal token):");

  const noteBeforeShortRefusal = await admin
    .from("community_solution_notes")
    .select("body")
    .eq("solution_id", csSolutionId)
    .eq("question_id", CS_QUESTION_IDS[0])
    .single();
  const saveShortNote = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [{ question_id: CS_QUESTION_IDS[0], body: csWords(9) }],
  });
  assert(
    saveShortNote.error?.code === "23514" && saveShortNote.error?.details === "below_word_count",
    `Save refusal token: ghi chú 9 từ trên bài giải PUBLISHED → 23514, DETAIL đúng bằng chuỗi 'below_word_count' (nhận: ${JSON.stringify(saveShortNote.error?.details)})`,
  );
  const noteAfterShortRefusal = await admin
    .from("community_solution_notes")
    .select("body")
    .eq("solution_id", csSolutionId)
    .eq("question_id", CS_QUESTION_IDS[0])
    .single();
  assert(
    noteAfterShortRefusal.data?.body === noteBeforeShortRefusal.data?.body,
    "Save refusal token: nội dung ghi chú CŨ không đổi sau từ chối 'below_word_count'",
  );

  const backToDraftForLengthCheck = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  if (backToDraftForLengthCheck.error) throw backToDraftForLengthCheck.error;

  const saveOverLength = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [{ question_id: CS_QUESTION_IDS[0], body: "a".repeat(8001) }],
  });
  assert(
    saveOverLength.error?.code === "23514" && saveOverLength.error?.details !== "below_word_count",
    `Save refusal token: thân 8001 ký tự trên bài giải DRAFT → 23514 qua CHECK độ dài, DETAIL KHÁC 'below_word_count' (nhận DETAIL: ${JSON.stringify(saveOverLength.error?.details)})`,
  );

  // SN-1 (work plan § Open Items, chốt 2026-09-20): admin_moderate_community_solution
  // chưa tồn tại tới migration 32 — harness setup client (service_role) tự đặt
  // trạng thái 'hidden' + chèn thẳng dòng community_moderation_log 'hide' tương
  // ứng, thay vì chờ/giả hàm admin. Task 35 chạy lại đúng case này qua RPC
  // admin thật.
  const hideSolution = await admin.from("community_solutions").update({ status: "hidden" }).eq("id", csSolutionId);
  if (hideSolution.error) throw hideSolution.error;
  const hideLog = await admin.from("community_moderation_log").insert({
    target_type: "solution",
    target_id: csSolutionId,
    exam_id: CS_EXAM_ID,
    target_user_id: userAId,
    actor_id: userAId,
    action: "hide",
    reason: "[RLS-CS][SN-1] Ẩn để test Save refusal token",
  });
  if (hideLog.error) throw hideLog.error;

  const saveWhileHidden = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [],
  });
  assert(
    saveWhileHidden.error?.code === "42501" && !saveWhileHidden.error?.details,
    `Save refusal token: bài giải đã 'hidden' (SN-1 setup) → 42501 KHÔNG có DETAIL (nhận: mã=${saveWhileHidden.error?.code}, DETAIL=${JSON.stringify(saveWhileHidden.error?.details)})`,
  );

  // Đưa bài giải khỏi 'hidden' (thẳng qua harness — save_community_solution
  // luôn từ chối một bài giải hidden, không có đường nào khác) để nhóm cuối
  // (Name-resolution regression) gọi được các hàm ghi bình thường.
  const unhideForRegression = await admin.from("community_solutions").update({ status: "draft" }).eq("id", csSolutionId);
  if (unhideForRegression.error) throw unhideForRegression.error;

  console.log("\nRLS checks (Community Solutions — Name-resolution regression, không 42702):");

  const nameRes1 = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: false,
    p_show_score: true,
    p_notes: [{ question_id: CS_QUESTION_IDS[0], body: csWords(15) }],
  });
  assert(
    !nameRes1.error,
    `Name-resolution regression: save_community_solution lần 1, không lỗi — nhất là không 42702 (nhận ${nameRes1.error?.code})`,
  );
  // Lần 2: cả community_solutions (unique exam_id/author_id) LẪN
  // community_solution_notes (pkey solution_id/question_id) đều đi qua nhánh
  // `on conflict … do update` — đúng câu chữ Design Doc đòi.
  const nameRes2 = await userA.rpc("save_community_solution", {
    p_exam_id: CS_EXAM_ID,
    p_attempt_id: csAttemptNew,
    p_show_profile: true,
    p_show_score: false,
    p_notes: [{ question_id: CS_QUESTION_IDS[0], body: csWords(16) }],
  });
  assert(
    !nameRes2.error,
    `Name-resolution regression: save_community_solution lần 2 (cả hai nhánh on conflict do update), không lỗi — nhất là không 42702 (nhận ${nameRes2.error?.code})`,
  );

  const nameResPublish = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "publish",
  });
  assert(
    !nameResPublish.error,
    `Name-resolution regression: set_community_solution_status('publish') không lỗi — nhất là không 42702 (nhận ${nameResPublish.error?.code})`,
  );
  const nameResDraft = await userA.rpc("set_community_solution_status", {
    p_exam_id: CS_EXAM_ID,
    p_action: "draft",
  });
  assert(
    !nameResDraft.error,
    `Name-resolution regression: set_community_solution_status('draft') không lỗi — nhất là không 42702 (nhận ${nameResDraft.error?.code})`,
  );
  const nameResCard = await userA.rpc("community_solution_result_card", { p_exam_id: CS_EXAM_ID });
  assert(
    !nameResCard.error,
    `Name-resolution regression: community_solution_result_card không lỗi — nhất là không 42702 (nhận ${nameResCard.error?.code})`,
  );

  // Dọn dẹp fixture Community Solutions.
  await cleanupCommunitySolutionsFixtures(admin);

  // ==========================================================================
  // Phần 11 — Community Solutions, TEST TASK 16 (migration task 13: backend DD
  // v1.9 § Integration Verification Points / § Test Boundaries "User-write RPC
  // groups"). M5 (nửa bài giải) + writer self-read (AC-062), cả hai nhóm RPC
  // Helpful (kèm table-closure), ghim nguyên tử + refusal mục tiêu, cổng AC-004
  // cho ghim/list/detail, bình luận trên bài giải nháp/bị ẩn (S7/AC-071/AC-063)
  // + bình luận bị admin ẩn trong detail (S19/AC-107 — SN-1: admin_moderate_
  // community_comment/_solution chưa tồn tại tới migration 32, harness setup
  // client tự đặt trạng thái + chèn thẳng dòng community_moderation_log, đúng
  // tiền lệ task 05 ở trên), hồi quy tên. U1 (task file § "U1 — resolved"):
  // Helpful ghi CHỈ qua RPC — không thêm grant/policy nào để một case xanh.
  //
  // Bọc trong { } để mọi biến const bên dưới không đụng tên với hàng nghìn
  // dòng phía trên trong cùng main().
  // ==========================================================================
  {
    console.log("\nCommunity Solutions (task 16) — setup fixture (service_role)…");
    await cleanupCs16Fixtures(admin);

    const questionsSetup = await admin.from("questions").insert(
      CS16_QUESTION_IDS.map((id, i) => ({
        id,
        content: `[RLS-CS16] Câu ${i + 1} bản gốc`,
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      })),
    );
    if (questionsSetup.error) throw questionsSetup.error;
    const otherQuestionSetup = await admin.from("questions").insert({
      id: CS16_OTHER_QUESTION_ID,
      content: "[RLS-CS16] Câu đề khác",
      choices: MCQ_CHOICES,
      correct_answer: "A",
      subject: "Toán",
      grade: 10,
      topic: "Toán",
    });
    if (otherQuestionSetup.error) throw otherQuestionSetup.error;

    const examSetup = await admin.from("exams").insert({
      id: CS16_EXAM_ID,
      title: "[RLS] Đề Bài giải cộng đồng (task 16)",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: userAId,
      author_display_name: "RLS Test Author",
      question_ids: CS16_QUESTION_IDS,
      status: "published",
    });
    if (examSetup.error) throw examSetup.error;
    const otherExamSetup = await admin.from("exams").insert({
      id: CS16_OTHER_EXAM_ID,
      title: "[RLS] Đề khác (chỉ mục tiêu refusal ghim)",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: userBId,
      author_display_name: "RLS Test Author B",
      question_ids: [CS16_OTHER_QUESTION_ID],
      status: "published",
    });
    if (otherExamSetup.error) throw otherExamSetup.error;

    const attemptA = await insertSubmittedAttempt(admin, userAId, CS16_EXAM_ID, new Date());
    const attemptB = await insertSubmittedAttempt(admin, userBId, CS16_EXAM_ID, new Date());
    await insertSubmittedAttempt(admin, userCId, CS16_EXAM_ID, new Date());

    const resultB = await admin.from("exam_results").insert({
      attempt_id: attemptB,
      user_id: userBId,
      total_score: 7,
      correct: 1,
      total: 1,
      per_question: [],
      topic_breakdown: [],
    });
    if (resultB.error) throw resultB.error;

    // SOL_HELPFUL — tác giả = A (cũng là tác giả đề). Dùng cho hai nhóm
    // Helpful, cho ghim, cho cổng AC-004 và cho các case bình luận bên dưới.
    const solHelpfulRow = await admin
      .from("community_solutions")
      .insert({
        exam_id: CS16_EXAM_ID,
        author_id: userAId,
        status: "published",
        show_profile: true,
        show_score: true,
        linked_attempt_id: attemptA,
      })
      .select("id")
      .single();
    if (solHelpfulRow.error) throw solHelpfulRow.error;
    const SOL_HELPFUL = solHelpfulRow.data!.id as string;

    // SOL_ANON — tác giả = B, show_profile=false + show_score=false. Dùng cho
    // M5 (nửa bài giải) + writer self-read (AC-062) + vế "B" của Pin atomicity
    // (AC-054).
    const solAnonRow = await admin
      .from("community_solutions")
      .insert({
        exam_id: CS16_EXAM_ID,
        author_id: userBId,
        status: "published",
        show_profile: false,
        show_score: false,
        linked_attempt_id: attemptB,
      })
      .select("id")
      .single();
    if (solAnonRow.error) throw solAnonRow.error;
    const SOL_ANON = solAnonRow.data!.id as string;

    // SOL_DRAFT_C — tác giả = C, KHÔNG bao giờ published. Chỉ để test
    // set_community_solution_pin('pin', <bài giải NHÁP của chính đề này>).
    const solDraftCRow = await admin
      .from("community_solutions")
      .insert({ exam_id: CS16_EXAM_ID, author_id: userCId, status: "draft" })
      .select("id")
      .single();
    if (solDraftCRow.error) throw solDraftCRow.error;
    const SOL_DRAFT_C = solDraftCRow.data!.id as string;

    // Bài giải published của MỘT ĐỀ KHÁC — chỉ để test
    // set_community_solution_pin('pin', <bài giải đề khác>).
    const solOtherExamRow = await admin
      .from("community_solutions")
      .insert({ exam_id: CS16_OTHER_EXAM_ID, author_id: userBId, status: "published" })
      .select("id")
      .single();
    if (solOtherExamRow.error) throw solOtherExamRow.error;
    const SOL_OTHER_EXAM = solOtherExamRow.data!.id as string;

    async function helpfulCountFor(solutionId: string, userId: string): Promise<number> {
      const r = await admin
        .from("community_solution_helpfuls")
        .select("solution_id", { count: "exact", head: true })
        .eq("solution_id", solutionId)
        .eq("user_id", userId);
      return r.count ?? -1;
    }
    async function helpfulTotalFor(solutionId: string): Promise<number> {
      const r = await admin
        .from("community_solution_helpfuls")
        .select("solution_id", { count: "exact", head: true })
        .eq("solution_id", solutionId);
      return r.count ?? -1;
    }
    async function pinnedRowIdFor(examId: string): Promise<string | null> {
      const r = await admin.from("community_solutions").select("id").eq("exam_id", examId).eq("is_pinned", true);
      if ((r.data?.length ?? 0) !== 1) return null;
      return (r.data![0] as { id: string }).id;
    }
    async function readCs16(client: SupabaseClient) {
      const list = await client.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
      const detail = await client.rpc("community_solution_detail", { p_solution_id: SOL_ANON });
      return {
        listRow: (list.data as Array<Record<string, unknown>> | null)?.find((r) => r.id === SOL_ANON),
        detailRow: (detail.data as Array<Record<string, unknown>> | null)?.[0],
      };
    }

    console.log("\nRLS checks (Community Solutions task 16 — M5 solution half + writer self-read AC-062):");

    const m5WriterOff1 = await readCs16(userB);
    const m5ViewerOff1 = await readCs16(userA);
    assert(
      m5WriterOff1.listRow?.author_id === null &&
        m5WriterOff1.listRow?.author_display_name === null &&
        m5WriterOff1.listRow?.author_avatar_path === null &&
        m5WriterOff1.listRow?.score === null &&
        m5WriterOff1.listRow?.score_grading === null &&
        m5WriterOff1.listRow?.is_mine === true &&
        m5WriterOff1.detailRow?.author_id === null &&
        m5WriterOff1.detailRow?.author_display_name === null &&
        m5WriterOff1.detailRow?.author_avatar_path === null &&
        m5WriterOff1.detailRow?.score === null &&
        m5WriterOff1.detailRow?.score_grading === null &&
        m5WriterOff1.detailRow?.per_question === null &&
        m5WriterOff1.detailRow?.is_mine === true,
      `M5 + AC-062 (chính người viết B): show_profile=false/show_score=false → danh tính + score/score_grading (+per_question ở detail) là JSON null, is_mine=true (nhận list=${JSON.stringify(m5WriterOff1.listRow)}, detail=${JSON.stringify(m5WriterOff1.detailRow)})`,
    );
    assert(
      m5ViewerOff1.listRow?.author_id === null &&
        m5ViewerOff1.listRow?.author_display_name === null &&
        m5ViewerOff1.listRow?.author_avatar_path === null &&
        m5ViewerOff1.listRow?.score === null &&
        m5ViewerOff1.listRow?.score_grading === null &&
        m5ViewerOff1.listRow?.is_mine === false &&
        m5ViewerOff1.detailRow?.author_id === null &&
        m5ViewerOff1.detailRow?.author_display_name === null &&
        m5ViewerOff1.detailRow?.author_avatar_path === null &&
        m5ViewerOff1.detailRow?.score === null &&
        m5ViewerOff1.detailRow?.score_grading === null &&
        m5ViewerOff1.detailRow?.per_question === null &&
        m5ViewerOff1.detailRow?.is_mine === false,
      `M5 + AC-062 (A — người xem khác, không admin/không tác giả): CÙNG giá trị null, is_mine=false (nhận list=${JSON.stringify(m5ViewerOff1.listRow)}, detail=${JSON.stringify(m5ViewerOff1.detailRow)})`,
    );

    const showProfileOn = await admin.from("community_solutions").update({ show_profile: true }).eq("id", SOL_ANON);
    if (showProfileOn.error) throw showProfileOn.error;
    const m5WriterOn = await readCs16(userB);
    const m5ViewerOn = await readCs16(userA);
    assert(
      m5WriterOn.listRow?.author_id === userBId &&
        m5WriterOn.detailRow?.author_id === userBId &&
        m5WriterOn.listRow?.is_mine === true &&
        m5ViewerOn.listRow?.author_id === userBId &&
        m5ViewerOn.detailRow?.author_id === userBId &&
        m5ViewerOn.listRow?.is_mine === false,
      `AC-062: bật show_profile trả lại danh tính THẬT cho CẢ người viết lẫn người xem khác trên lượt đọc kế tiếp (nhận writer.author_id=${m5WriterOn.listRow?.author_id}, viewer.author_id=${m5ViewerOn.listRow?.author_id})`,
    );

    const showProfileOff = await admin.from("community_solutions").update({ show_profile: false }).eq("id", SOL_ANON);
    if (showProfileOff.error) throw showProfileOff.error;
    const m5WriterOff2 = await readCs16(userB);
    const m5ViewerOff2 = await readCs16(userA);
    assert(
      m5WriterOff2.listRow?.author_id === null &&
        m5WriterOff2.detailRow?.author_id === null &&
        m5ViewerOff2.listRow?.author_id === null &&
        m5ViewerOff2.detailRow?.author_id === null,
      "AC-062: tắt show_profile lại lần nữa, cả hai lại thấy null",
    );

    console.log("\nRLS checks (Community Solutions task 16 — add_community_solution_helpful group, AC-065):");

    const addByAuthor = await userA.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      addByAuthor.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userAId)) === 0,
      `AC-065 (a): tác giả của chính bài giải bị 42501, 0 dòng (nhận ${addByAuthor.error?.code})`,
    );

    const bToInProgress1 = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", attemptB);
    if (bToInProgress1.error) throw bToInProgress1.error;
    const addNoAttempt = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      addNoAttempt.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `AC-065 (b): caller chưa nộp bài (attempt 'in_progress') bị 42501, 0 dòng (nhận ${addNoAttempt.error?.code})`,
    );
    const bResubmit1 = await admin
      .from("exam_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", attemptB);
    if (bResubmit1.error) throw bResubmit1.error;

    const solToDraft1 = await admin.from("community_solutions").update({ status: "draft" }).eq("id", SOL_HELPFUL);
    if (solToDraft1.error) throw solToDraft1.error;
    const addDraft = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      addDraft.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `AC-065 (c): bài giải 'draft' bị 42501, 0 dòng (nhận ${addDraft.error?.code})`,
    );
    const solRestorePublished1 = await admin.from("community_solutions").update({ status: "published" }).eq("id", SOL_HELPFUL);
    if (solRestorePublished1.error) throw solRestorePublished1.error;

    const addAnon = await anonClient.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      isAuthorizationDenial(addAnon.error) && (await helpfulTotalFor(SOL_HELPFUL)) === 0,
      `AC-065 (d): anon bị từ chối, 0 dòng (nhận ${addAnon.error?.code})`,
    );

    const addDirect = await userB
      .from("community_solution_helpfuls")
      .insert({ solution_id: SOL_HELPFUL, user_id: userBId })
      .select();
    assert(
      isAuthorizationDenial(addDirect.error) && (addDirect.data?.length ?? 0) === 0,
      `AC-065 (e) table closure: B (đủ điều kiện) KHÔNG tự INSERT trực tiếp được community_solution_helpfuls (nhận ${addDirect.error?.code ?? "KHÔNG CÓ LỖI"})`,
    );

    const examToDraft1 = await admin.from("exams").update({ status: "draft" }).eq("id", CS16_EXAM_ID);
    if (examToDraft1.error) throw examToDraft1.error;
    const addExamDraft = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      addExamDraft.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `AC-065 (f) AC-004: đề đang 'draft' → 42501, 0 dòng (nhận ${addExamDraft.error?.code})`,
    );
    const examRestore1 = await admin.from("exams").update({ status: "published" }).eq("id", CS16_EXAM_ID);
    if (examRestore1.error) throw examRestore1.error;

    const ban1 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
    if (ban1.error) throw ban1.error;
    const addAuthorBanned = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      addAuthorBanned.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `AC-065 (g) AC-004: tác giả đề bị ban → 42501, 0 dòng (nhận ${addAuthorBanned.error?.code})`,
    );
    const unban1 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
    if (unban1.error) throw unban1.error;

    const addSuccess1 = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !addSuccess1.error &&
        JSON.stringify(addSuccess1.data) === JSON.stringify([{ added: true }]) &&
        (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `AC-065/AC-066/M4 success: B đủ điều kiện → [{ added: true }], đúng 1 dòng (nhận ${JSON.stringify(addSuccess1.data)}, mã lỗi ${addSuccess1.error?.code})`,
    );
    const addSuccess2 = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !addSuccess2.error &&
        JSON.stringify(addSuccess2.data) === JSON.stringify([{ added: false }]) &&
        (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `AC-066/M4: gọi lại → [{ added: false }], vẫn đúng 1 dòng (nhận ${JSON.stringify(addSuccess2.data)})`,
    );

    console.log("\nRLS checks (Community Solutions task 16 — remove_community_solution_helpful group):");

    const removeByNonHolder = await userC.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !removeByNonHolder.error && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (a): C không giữ dòng gọi remove → không lỗi, dòng của B (người khác) vẫn còn (nhận mã lỗi ${removeByNonHolder.error?.code})`,
    );

    const removeAnon = await anonClient.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      isAuthorizationDenial(removeAnon.error) && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (b): anon bị từ chối, dòng của B vẫn còn (nhận ${removeAnon.error?.code})`,
    );

    const removeDirect = await userB
      .from("community_solution_helpfuls")
      .delete()
      .eq("solution_id", SOL_HELPFUL)
      .eq("user_id", userBId)
      .select();
    assert(
      isAuthorizationDenial(removeDirect.error) && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (c) table closure: B KHÔNG tự DELETE trực tiếp được, dòng vẫn còn (nhận ${removeDirect.error?.code ?? "KHÔNG CÓ LỖI"})`,
    );

    const examToDraft2 = await admin.from("exams").update({ status: "draft" }).eq("id", CS16_EXAM_ID);
    if (examToDraft2.error) throw examToDraft2.error;
    const removeExamDraft = await userB.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      removeExamDraft.error?.code === "42501" &&
        removeExamDraft.error?.message === "remove_community_solution_helpful: not eligible" &&
        (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (f) AC-004: đề 'draft' → 42501 'not eligible', dòng vẫn còn (nhận ${removeExamDraft.error?.message})`,
    );
    const examRestore2 = await admin.from("exams").update({ status: "published" }).eq("id", CS16_EXAM_ID);
    if (examRestore2.error) throw examRestore2.error;

    const ban2 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
    if (ban2.error) throw ban2.error;
    const removeAuthorBanned = await userB.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      removeAuthorBanned.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (g) AC-004: tác giả đề bị ban → 42501, dòng vẫn còn (nhận ${removeAuthorBanned.error?.code})`,
    );
    const unban2 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
    if (unban2.error) throw unban2.error;

    const bToInProgress2 = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", attemptB);
    if (bToInProgress2.error) throw bToInProgress2.error;
    const removeInProgress = await userB.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      removeInProgress.error?.code === "42501" && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 1,
      `remove (h) AC-002: attempt của chính B đang 'in_progress' → 42501, dòng vẫn còn (nhận ${removeInProgress.error?.code})`,
    );
    const bResubmit2 = await admin
      .from("exam_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", attemptB);
    if (bResubmit2.error) throw bResubmit2.error;

    const removeSuccess1 = await userB.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !removeSuccess1.error && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `remove success: dòng của B mất (nhận mã lỗi ${removeSuccess1.error?.code})`,
    );
    const removeSuccess2 = await userB.rpc("remove_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !removeSuccess2.error && (await helpfulCountFor(SOL_HELPFUL, userBId)) === 0,
      `remove success: gọi lại không lỗi, vẫn 0 dòng (nhận mã lỗi ${removeSuccess2.error?.code})`,
    );

    console.log("\nRLS checks (Community Solutions task 16 — Pin atomicity + target refusals, AC-054/AC-078):");

    const pinA = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_HELPFUL,
    });
    assert(
      !pinA.error && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_HELPFUL,
      `Pin atomicity: ghim A (SOL_HELPFUL) thành công, đúng 1 dòng is_pinned=true của đề (nhận mã lỗi ${pinA.error?.code})`,
    );

    const pinB = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_ANON,
    });
    assert(
      !pinB.error && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `Pin atomicity: ghim B (SOL_ANON) → đúng 1 dòng is_pinned=true và đó là B, A tự động gỡ (nhận mã lỗi ${pinB.error?.code})`,
    );

    const listAfterPinB = await userA.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    assert(
      (listAfterPinB.data as Array<{ id: string }> | null)?.[0]?.id === SOL_ANON,
      `AC-054: community_solutions_list trả B (bài vừa ghim) đầu tiên (nhận ${(listAfterPinB.data as Array<{ id: string }> | null)?.[0]?.id})`,
    );

    const handWrittenSecondPin = await admin.from("community_solutions").update({ is_pinned: true }).eq("id", SOL_HELPFUL);
    assert(
      handWrittenSecondPin.error?.code === "23505" && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `Pin atomicity: khoá unique một-phần community_solutions_pinned_per_exam_idx chặn dòng ghim thứ hai viết tay (23505), B vẫn là dòng ghim duy nhất (nhận ${handWrittenSecondPin.error?.code})`,
    );

    const unpinCall = await userA.rpc("set_community_solution_pin", { p_exam_id: CS16_EXAM_ID, p_action: "unpin" });
    assert(
      !unpinCall.error && (await pinnedRowIdFor(CS16_EXAM_ID)) === null,
      `Pin atomicity: 'unpin' → không còn dòng ghim nào của đề (nhận mã lỗi ${unpinCall.error?.code})`,
    );
    const unpinAgain = await userA.rpc("set_community_solution_pin", { p_exam_id: CS16_EXAM_ID, p_action: "unpin" });
    assert(
      !unpinAgain.error && (await pinnedRowIdFor(CS16_EXAM_ID)) === null,
      `Pin atomicity: gọi lại 'unpin' thành công, không đổi dòng nào (nhận mã lỗi ${unpinAgain.error?.code})`,
    );

    const rePinB = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_ANON,
    });
    if (rePinB.error) throw rePinB.error;

    const pinNull = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: null,
    });
    assert(
      pinNull.error?.code === "22023" && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `CS-01: pin(null) → 22023, B vẫn là dòng ghim duy nhất (nhận ${pinNull.error?.code})`,
    );
    const pinOtherExam = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_OTHER_EXAM,
    });
    assert(
      pinOtherExam.error?.code === "22023" && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `pin(<bài giải published của MỘT ĐỀ KHÁC>) → 22023, B vẫn là dòng ghim duy nhất (nhận ${pinOtherExam.error?.code})`,
    );
    const pinDraft = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_DRAFT_C,
    });
    assert(
      pinDraft.error?.code === "22023" && (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `pin(<bài giải NHÁP của chính đề này>) → 22023, B vẫn là dòng ghim duy nhất (nhận ${pinDraft.error?.code})`,
    );

    console.log("\nRLS checks (Community Solutions task 16 — AC-004 gate: set_community_solution_pin / list / detail):");

    const examToDraft3 = await admin.from("exams").update({ status: "draft" }).eq("id", CS16_EXAM_ID);
    if (examToDraft3.error) throw examToDraft3.error;
    const pinWhileExamDraft = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_HELPFUL,
    });
    const unpinWhileExamDraft = await userA.rpc("set_community_solution_pin", { p_exam_id: CS16_EXAM_ID, p_action: "unpin" });
    assert(
      pinWhileExamDraft.error?.code === "42501" &&
        pinWhileExamDraft.error?.message === "set_community_solution_pin: exam not visible" &&
        unpinWhileExamDraft.error?.code === "42501" &&
        unpinWhileExamDraft.error?.message === "set_community_solution_pin: exam not visible" &&
        (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `AC-004 gate (đề draft): 'pin' và 'unpin' đều 42501 'exam not visible', không đổi dòng ghim (nhận: ${pinWhileExamDraft.error?.message} / ${unpinWhileExamDraft.error?.message})`,
    );
    const listWhileExamDraft = await userB.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    const detailWhileExamDraft = await userB.rpc("community_solution_detail", { p_solution_id: SOL_ANON });
    assert(
      (listWhileExamDraft.data?.length ?? -1) === 0 && (detailWhileExamDraft.data?.length ?? -1) === 0,
      `AC-004 gate (đề draft): community_solutions_list/community_solution_detail trả 0 dòng (nhận ${listWhileExamDraft.data?.length}/${detailWhileExamDraft.data?.length})`,
    );
    const examRestore3 = await admin.from("exams").update({ status: "published" }).eq("id", CS16_EXAM_ID);
    if (examRestore3.error) throw examRestore3.error;
    const listAfterGateRestore1 = await userB.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    assert(
      (listAfterGateRestore1.data as Array<{ id: string }> | null)?.[0]?.id === SOL_ANON,
      "AC-004 gate: sau khi đề published lại, community_solutions_list trả lại đúng thứ tự (B đầu tiên)",
    );

    const ban3 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
    if (ban3.error) throw ban3.error;
    const pinWhileBanned = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_HELPFUL,
    });
    const unpinWhileBanned = await userA.rpc("set_community_solution_pin", { p_exam_id: CS16_EXAM_ID, p_action: "unpin" });
    assert(
      pinWhileBanned.error?.code === "42501" &&
        pinWhileBanned.error?.message === "set_community_solution_pin: exam not visible" &&
        unpinWhileBanned.error?.code === "42501" &&
        (await pinnedRowIdFor(CS16_EXAM_ID)) === SOL_ANON,
      `AC-004 gate (tác giả bị ban): 'pin' và 'unpin' đều 42501 'exam not visible', không đổi dòng ghim (nhận: ${pinWhileBanned.error?.message} / ${unpinWhileBanned.error?.message})`,
    );
    const listWhileBanned = await userB.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    const detailWhileBanned = await userB.rpc("community_solution_detail", { p_solution_id: SOL_ANON });
    assert(
      (listWhileBanned.data?.length ?? -1) === 0 && (detailWhileBanned.data?.length ?? -1) === 0,
      "AC-004 gate (tác giả bị ban): community_solutions_list/community_solution_detail trả 0 dòng",
    );
    const unban3 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
    if (unban3.error) throw unban3.error;
    const listAfterGateRestore2 = await userB.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    assert(
      (listAfterGateRestore2.data as Array<{ id: string }> | null)?.[0]?.id === SOL_ANON,
      "AC-004 gate: sau khi bỏ ban, community_solutions_list trả lại đúng thứ tự (B đầu tiên)",
    );

    console.log(
      "\nRLS checks (Community Solutions task 16 — Comments on a draft/hidden solution S7/AC-071/AC-063 + admin-hidden comment S19/AC-107):",
    );

    const noteQ1 = await admin.from("community_solution_notes").insert({
      solution_id: SOL_HELPFUL,
      question_id: CS16_QUESTION_IDS[0],
      body: csWords(15),
    });
    if (noteQ1.error) throw noteQ1.error;
    const commentB = await admin
      .from("community_solution_comments")
      .insert({ solution_id: SOL_HELPFUL, question_id: CS16_QUESTION_IDS[0], author_id: userBId, body: "[RLS-CS16] Bình luận của B" })
      .select("id")
      .single();
    if (commentB.error) throw commentB.error;
    const commentC = await admin
      .from("community_solution_comments")
      .insert({ solution_id: SOL_HELPFUL, question_id: CS16_QUESTION_IDS[0], author_id: userCId, body: "[RLS-CS16] Bình luận của C" })
      .select("id")
      .single();
    if (commentC.error) throw commentC.error;
    const commentA = await admin
      .from("community_solution_comments")
      .insert({
        solution_id: SOL_HELPFUL,
        question_id: CS16_QUESTION_IDS[0],
        author_id: userAId,
        body: "[RLS-CS16] Bình luận của chính người viết",
      })
      .select("id")
      .single();
    if (commentA.error) throw commentA.error;
    const commentBId = commentB.data!.id as string;

    type DetailQuestion = { question_id: string; comment_count: number | null; comments: Array<{ id: string; is_hidden_by_admin: boolean; hidden_reason: string | null; body: string }> };
    function questionsOf(detail: { data: Array<{ questions: DetailQuestion[] }> | null }): DetailQuestion[] {
      return detail.data?.[0]?.questions ?? [];
    }
    function q1Of(detail: { data: Array<{ questions: DetailQuestion[] }> | null }): DetailQuestion | undefined {
      return questionsOf(detail).find((q) => q.question_id === CS16_QUESTION_IDS[0]);
    }

    const detailBaseline = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const q1Baseline = q1Of(detailBaseline);
    assert(
      !detailBaseline.error && q1Baseline?.comment_count === 3 && q1Baseline?.comments.length === 3,
      `(nền) SOL_HELPFUL published, câu 1 có 3 bình luận hiện, comment_count=3 (nhận ${JSON.stringify(q1Baseline)})`,
    );

    // Nhánh 'draft' — dùng đúng RPC của chính người viết (set_community_solution_status,
    // migration task 03, đã tồn tại).
    const toDraftForComments = await userA.rpc("set_community_solution_status", { p_exam_id: CS16_EXAM_ID, p_action: "draft" });
    if (toDraftForComments.error) throw toDraftForComments.error;
    const ownPreviewDraft = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const questionsDraft = questionsOf(ownPreviewDraft);
    assert(
      !ownPreviewDraft.error &&
        questionsDraft.length > 0 &&
        questionsDraft.every((q) => q.comment_count === null && q.comments.length === 0),
      `S7/AC-071/AC-063 (draft): own-preview của chính người viết vẫn đọc được header/questions, nhưng comments rỗng và comment_count null cho MỌI câu (nhận ${JSON.stringify(questionsDraft)})`,
    );
    const otherReadsDraft = await userB.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const listDuringDraft = await userB.rpc("community_solutions_list", { p_exam_id: CS16_EXAM_ID });
    assert(
      (otherReadsDraft.data?.length ?? -1) === 0 &&
        !(listDuringDraft.data as Array<{ id: string }> | null)?.some((r) => r.id === SOL_HELPFUL),
      "S7/AC-071/AC-063 (draft): người khác (kể cả người từng bình luận) không đọc được bài giải này ở list/detail",
    );

    const restoreFromDraft = await admin.from("community_solutions").update({ status: "published" }).eq("id", SOL_HELPFUL);
    if (restoreFromDraft.error) throw restoreFromDraft.error;
    const detailAfterDraftRestore = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const q1AfterDraftRestore = q1Of(detailAfterDraftRestore);
    assert(
      q1AfterDraftRestore?.comment_count === 3 && q1AfterDraftRestore?.comments.length === 3,
      `S7 (draft → published lại): trả lại đúng comment_count/comments như bản đọc nền (nhận ${JSON.stringify(q1AfterDraftRestore)})`,
    );

    // Nhánh 'hidden' — SN-1 (đúng tiền lệ task 05 ở trên): admin_moderate_
    // community_solution chưa tồn tại tới migration 32, harness setup client
    // tự đặt trạng thái 'hidden' + chèn thẳng dòng community_moderation_log.
    const hideSolution = await admin.from("community_solutions").update({ status: "hidden" }).eq("id", SOL_HELPFUL);
    if (hideSolution.error) throw hideSolution.error;
    const hideSolutionLog = await admin.from("community_moderation_log").insert({
      target_type: "solution",
      target_id: SOL_HELPFUL,
      exam_id: CS16_EXAM_ID,
      target_user_id: userAId,
      actor_id: userAId,
      action: "hide",
      reason: "[RLS-CS16][SN-1] Ẩn để test S7/AC-071/AC-063",
    });
    if (hideSolutionLog.error) throw hideSolutionLog.error;

    const ownPreviewHidden = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const questionsHidden = questionsOf(ownPreviewHidden);
    assert(
      !ownPreviewHidden.error &&
        questionsHidden.length > 0 &&
        questionsHidden.every((q) => q.comment_count === null && q.comments.length === 0),
      `S7/AC-071/AC-063 (hidden): own-preview của người viết — comments rỗng, comment_count null cho mọi câu, kể cả câu có bình luận CỦA CHÍNH họ (nhận ${JSON.stringify(questionsHidden)})`,
    );
    const otherReadsHidden = await userC.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    assert((otherReadsHidden.data?.length ?? -1) === 0, "S7/AC-071/AC-063 (hidden): người khác không đọc được bài giải này ở detail");

    const restoreFromHidden = await admin.from("community_solutions").update({ status: "published" }).eq("id", SOL_HELPFUL);
    if (restoreFromHidden.error) throw restoreFromHidden.error;
    const detailAfterHiddenRestore = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const q1AfterHiddenRestore = q1Of(detailAfterHiddenRestore);
    assert(
      q1AfterHiddenRestore?.comment_count === 3 && q1AfterHiddenRestore?.comments.length === 3,
      "S7 (hidden → published lại): trả lại đúng comment_count/comments như bản đọc nền, không dòng community_solution_comments nào đổi",
    );

    // Admin-hidden comment (S19/AC-107) — cùng SN-1: ẩn thẳng comment của B.
    const hideCommentB = await admin.from("community_solution_comments").update({ status: "hidden" }).eq("id", commentBId);
    if (hideCommentB.error) throw hideCommentB.error;
    const hideCommentBLog = await admin.from("community_moderation_log").insert({
      target_type: "comment",
      target_id: commentBId,
      exam_id: CS16_EXAM_ID,
      target_user_id: userBId,
      actor_id: userAId,
      action: "hide",
      reason: "spam",
    });
    if (hideCommentBLog.error) throw hideCommentBLog.error;

    const commentBAuthorReads = await userB.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const hiddenRowForB = q1Of(commentBAuthorReads)?.comments.find((c) => c.id === commentBId);
    assert(
      hiddenRowForB?.is_hidden_by_admin === true && hiddenRowForB?.hidden_reason === "spam" && typeof hiddenRowForB?.body === "string",
      `S19/AC-107: chính tác giả bình luận bị ẩn vẫn đọc được nó, is_hidden_by_admin=true, hidden_reason đúng (nhận ${JSON.stringify(hiddenRowForB)})`,
    );

    const writerReadsAfterHideComment = await userA.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const q1ForWriter = q1Of(writerReadsAfterHideComment);
    const thirdReaderReadsAfterHideComment = await userC.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const q1ForThird = q1Of(thirdReaderReadsAfterHideComment);
    assert(
      q1ForWriter?.comment_count === 2 &&
        !q1ForWriter.comments.some((c) => c.id === commentBId) &&
        q1ForThird?.comment_count === 2 &&
        !q1ForThird.comments.some((c) => c.id === commentBId),
      `S19/AC-107: người viết và một người đọc thứ ba khác đều KHÔNG thấy bình luận bị ẩn, comment_count=2 (không đếm nó) (nhận writer=${JSON.stringify(q1ForWriter)}, third=${JSON.stringify(q1ForThird)})`,
    );

    const secondHideCommentB = await admin.from("community_moderation_log").insert({
      target_type: "comment",
      target_id: commentBId,
      exam_id: CS16_EXAM_ID,
      target_user_id: userBId,
      actor_id: userAId,
      action: "hide",
      reason: "abuse",
    });
    if (secondHideCommentB.error) throw secondHideCommentB.error;
    const commentBAuthorRereads = await userB.rpc("community_solution_detail", { p_solution_id: SOL_HELPFUL });
    const hiddenRowForBAgain = q1Of(commentBAuthorRereads)?.comments.find((c) => c.id === commentBId);
    assert(
      hiddenRowForBAgain?.hidden_reason === "abuse",
      `S19/AC-107: một dòng community_moderation_log 'hide' MỚI hơn (lý do khác) → hidden_reason đọc lại đúng lý do MỚI NHẤT (nhận ${JSON.stringify(hiddenRowForBAgain)})`,
    );

    const restoreCommentB = await admin.from("community_solution_comments").update({ status: "visible" }).eq("id", commentBId);
    if (restoreCommentB.error) throw restoreCommentB.error;

    console.log("\nRLS checks (Community Solutions task 16 — Name-resolution regression, không 42702):");

    const nameResAdd = await userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_HELPFUL });
    assert(
      !nameResAdd.error,
      `Name-resolution regression: add_community_solution_helpful thành công — nhất là không 42702 (nhận ${nameResAdd.error?.code})`,
    );
    const nameResPin = await userA.rpc("set_community_solution_pin", {
      p_exam_id: CS16_EXAM_ID,
      p_action: "pin",
      p_solution_id: SOL_ANON,
    });
    assert(
      !nameResPin.error,
      `Name-resolution regression: set_community_solution_pin('pin', …) thành công — nhất là không 42702 (nhận ${nameResPin.error?.code})`,
    );

    // Dọn dẹp fixture Community Solutions (task 16).
    await cleanupCs16Fixtures(admin);
  }

  // ==========================================================================
  // Phần 12 — Community Solutions, TEST TASK 27 (migration task 25: backend DD
  // v1.9 § Integration Verification Points / § Test Boundaries "User-write RPC
  // groups"). Nhóm post_/delete_community_comment (kèm table-closure + case
  // (i) AC-048 + cổng AC-004/AC-002), M5 (nửa bình luận) + S4 (danh tính bình
  // luận của chính người viết), case ghi cursor
  // user_profiles.community_comments_last_read_at, cổng AC-002 của
  // community_my_comment_feed, hồi quy tên cho post_community_comment. U1
  // (task file § "U1 — resolved"): bình luận ghi CHỈ qua RPC — không thêm
  // grant/policy nào để một case xanh. Feed columns/Feed unread cursor/
  // ordering/AC-091 exclusion/AC-047-048 (phần feed) sống ở
  // `community-solutions-comment-feed.localdb.test.ts` (task file §
  // Implementation Content), không lặp lại ở đây.
  //
  // Bọc trong { } cùng quy ước Phần 11 — biến const bên dưới không đụng tên
  // với hàng nghìn dòng phía trên trong cùng main().
  // ==========================================================================
  {
    console.log("\nCommunity Solutions (task 27) — setup fixture (service_role)…");
    await cleanupCs27Fixtures(admin);

    const questionsSetup27 = await admin.from("questions").insert(
      CS27_QUESTION_IDS.map((id, i) => ({
        id,
        content: `[RLS-CS27] Câu ${i + 1} bản gốc`,
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      })),
    );
    if (questionsSetup27.error) throw questionsSetup27.error;

    const examSetup27 = await admin.from("exams").insert({
      id: CS27_EXAM_ID,
      title: "[RLS] Đề Bài giải cộng đồng (task 27)",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: userAId,
      author_display_name: "RLS Test Author",
      question_ids: CS27_QUESTION_IDS,
      status: "published",
    });
    if (examSetup27.error) throw examSetup27.error;

    const attemptA27 = await insertSubmittedAttempt(admin, userAId, CS27_EXAM_ID, new Date());

    // SOL27 — tác giả = A, show_profile=false + show_score=false (đúng khuôn
    // SOL_ANON của task 16, dùng cho M5 nửa bình luận + S4).
    const sol27Row = await admin
      .from("community_solutions")
      .insert({
        exam_id: CS27_EXAM_ID,
        author_id: userAId,
        status: "published",
        show_profile: false,
        show_score: false,
        linked_attempt_id: attemptA27,
      })
      .select("id")
      .single();
    if (sol27Row.error) throw sol27Row.error;
    const SOL27 = sol27Row.data!.id as string;

    // Q1 — ghi chú 15 từ, dùng cho hầu hết case; Q2 — KHÔNG có ghi chú (case
    // (i) AC-048 nhánh "không có ghi chú"); Q3 — ghi chú 14 từ, sau nâng lên
    // 15 (case (i) AC-048 nhánh "14 từ" rồi "được chấp nhận").
    const [CS27_Q1, CS27_Q2, CS27_Q3] = CS27_QUESTION_IDS;
    const noteQ1_27 = await admin
      .from("community_solution_notes")
      .insert({ solution_id: SOL27, question_id: CS27_Q1, body: csWords(15) });
    if (noteQ1_27.error) throw noteQ1_27.error;
    const noteQ3_27 = await admin
      .from("community_solution_notes")
      .insert({ solution_id: SOL27, question_id: CS27_Q3, body: csWords(14) });
    if (noteQ3_27.error) throw noteQ3_27.error;

    async function commentTotalFor27(solutionId: string): Promise<number> {
      const r = await admin
        .from("community_solution_comments")
        .select("id", { count: "exact", head: true })
        .eq("solution_id", solutionId);
      return r.count ?? -1;
    }
    async function commentStatusOf27(commentId: string): Promise<string | null> {
      const r = await admin
        .from("community_solution_comments")
        .select("status")
        .eq("id", commentId)
        .maybeSingle();
      return (r.data as { status: string } | null)?.status ?? null;
    }
    type CommentRow27 = {
      id: string;
      author_id: string | null;
      author_display_name: string | null;
      author_avatar_path: string | null;
      is_solution_author: boolean;
    };
    type DetailQuestion27 = { question_id: string; comments: CommentRow27[] };
    function commentIn27(
      detail: { data: Array<{ questions: DetailQuestion27[] }> | null },
      questionId: string,
      commentId: string,
    ): CommentRow27 | undefined {
      return detail.data?.[0]?.questions
        .find((q) => q.question_id === questionId)
        ?.comments.find((c) => c.id === commentId);
    }

    console.log("\nRLS checks (Community Solutions task 27 — post_community_comment group, AC-072/AC-047/AC-048):");

    // (a) caller CHƯA có attempt nào đã nộp trên đề này (B chưa được tạo attempt).
    const postNoAttempt = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      postNoAttempt.error?.code === "42501" &&
        postNoAttempt.error?.message === "post_community_comment: not eligible" &&
        (await commentTotalFor27(SOL27)) === 0,
      `(a) caller chưa nộp bài bị 42501 'not eligible', 0 dòng (nhận ${postNoAttempt.error?.message})`,
    );

    const attemptB27 = await insertSubmittedAttempt(admin, userBId, CS27_EXAM_ID, new Date());

    // (b) bài giải đang 'draft'.
    const solToDraft27 = await admin.from("community_solutions").update({ status: "draft" }).eq("id", SOL27);
    if (solToDraft27.error) throw solToDraft27.error;
    const postDraft = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      postDraft.error?.code === "42501" && (await commentTotalFor27(SOL27)) === 0,
      `(b) bài giải 'draft' bị 42501, 0 dòng (nhận ${postDraft.error?.code})`,
    );
    const solRestore27 = await admin.from("community_solutions").update({ status: "published" }).eq("id", SOL27);
    if (solRestore27.error) throw solRestore27.error;

    // (c) p_question_id không nằm trong exams.question_ids.
    const postOutsideQuestion = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_OUTSIDE_QUESTION_ID,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      postOutsideQuestion.error?.code === "42501" && (await commentTotalFor27(SOL27)) === 0,
      `(c) câu hỏi không thuộc question_ids của đề bị 42501, 0 dòng (nhận ${postOutsideQuestion.error?.code})`,
    );

    // (d) anon.
    const postAnon = await anonClient.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      isAuthorizationDenial(postAnon.error) && (await commentTotalFor27(SOL27)) === 0,
      `(d) anon bị từ chối, 0 dòng (nhận ${postAnon.error?.code})`,
    );

    // (e) table closure: B (đủ điều kiện) tự INSERT trực tiếp.
    const postDirect = await userB
      .from("community_solution_comments")
      .insert({ solution_id: SOL27, question_id: CS27_Q1, author_id: userBId, body: csWords(20) })
      .select();
    assert(
      isAuthorizationDenial(postDirect.error) &&
        (postDirect.data?.length ?? 0) === 0 &&
        (await commentTotalFor27(SOL27)) === 0,
      `(e) table closure: B (đủ điều kiện) KHÔNG tự INSERT trực tiếp được community_solution_comments (nhận ${postDirect.error?.code ?? "KHÔNG CÓ LỖI"})`,
    );

    // (i) AC-048 — câu hiện tại KHÔNG có ghi chú (Q2).
    const postNoNote = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q2,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      postNoNote.error?.code === "42501" && (await commentTotalFor27(SOL27)) === 0,
      `(i) AC-048 câu không có ghi chú bị 42501, 0 dòng (nhận ${postNoNote.error?.code})`,
    );

    // (i) AC-048 — ghi chú 14 từ (Q3, do harness setup client ghi).
    const postShortNote = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q3,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    assert(
      postShortNote.error?.code === "42501" && (await commentTotalFor27(SOL27)) === 0,
      `(i) AC-048 ghi chú 14 từ bị 42501, 0 dòng (nhận ${postShortNote.error?.code})`,
    );

    // (i) AC-048 — cùng ghi chú đó nâng đúng 15 từ → được chấp nhận.
    const bumpNoteQ3_27 = await admin
      .from("community_solution_notes")
      .update({ body: csWords(15) })
      .eq("solution_id", SOL27)
      .eq("question_id", CS27_Q3);
    if (bumpNoteQ3_27.error) throw bumpNoteQ3_27.error;
    const commentQ3 = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q3,
      p_body: csWords(20),
      p_is_anonymous: false,
    });
    const commentQ3Id = (commentQ3.data as Array<{ comment_id: string }> | null)?.[0]?.comment_id;
    assert(
      !commentQ3.error &&
        commentQ3Id !== undefined &&
        (await commentTotalFor27(SOL27)) === 1 &&
        (await commentStatusOf27(commentQ3Id as string)) === "visible",
      `(i) AC-048 ghi chú đúng 15 từ được chấp nhận, trả comment_id, status='visible' (nhận mã lỗi ${commentQ3.error?.code})`,
    );

    console.log(
      "\nRLS checks (Community Solutions task 27 — post_community_comment success + M5 nửa bình luận + S4):",
    );

    const commentBVisible = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: "[RLS-CS27] Bình luận không ẩn danh của B",
      p_is_anonymous: false,
    });
    const commentBVisibleId = (commentBVisible.data as Array<{ comment_id: string }> | null)?.[0]?.comment_id;
    assert(
      !commentBVisible.error && commentBVisibleId !== undefined && (await commentTotalFor27(SOL27)) === 2,
      `Success: B đủ điều kiện → trả comment_id, tổng số dòng cộng dồn đúng (nhận mã lỗi ${commentBVisible.error?.code})`,
    );

    const commentAnonB = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: "[RLS-CS27] Bình luận ẩn danh của B",
      p_is_anonymous: true,
    });
    const commentAnonBId = (commentAnonB.data as Array<{ comment_id: string }> | null)?.[0]?.comment_id;
    assert(
      !commentAnonB.error && commentAnonBId !== undefined && (await commentTotalFor27(SOL27)) === 3,
      `Success: p_is_anonymous=true tạo bình luận ẩn danh, đây là fixture cho M5 (nhận mã lỗi ${commentAnonB.error?.code})`,
    );

    const commentSelfA = await userA.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: "[RLS-CS27] Bình luận của chính người viết A",
      p_is_anonymous: false,
    });
    const commentSelfAId = (commentSelfA.data as Array<{ comment_id: string }> | null)?.[0]?.comment_id;
    assert(
      !commentSelfA.error && commentSelfAId !== undefined && (await commentTotalFor27(SOL27)) === 4,
      `Success: chính người viết A bình luận không ẩn danh trên bài giải show_profile=false của mình — fixture cho S4 (nhận mã lỗi ${commentSelfA.error?.code})`,
    );

    // M5 — bình luận ẩn danh: người xem khác đủ điều kiện (A, không phải tác
    // giả bình luận — tác giả bình luận là B) đọc qua community_solution_detail
    // → danh tính JSON null, is_solution_author hiện diện (= false vì tác giả
    // bình luận B khác tác giả bài giải A).
    const detailForM5 = await userA.rpc("community_solution_detail", { p_solution_id: SOL27 });
    const anonRowForM5 = commentIn27(detailForM5, CS27_Q1, commentAnonBId as string);
    assert(
      anonRowForM5?.author_id === null &&
        anonRowForM5?.author_display_name === null &&
        anonRowForM5?.author_avatar_path === null &&
        anonRowForM5?.is_solution_author === false,
      `M5 (nửa bình luận): bình luận ẩn danh của B → danh tính JSON null cho người xem khác (A), is_solution_author=false hiện diện (nhận ${JSON.stringify(anonRowForM5)})`,
    );

    // S4 — bình luận KHÔNG ẩn danh của CHÍNH người viết trên bài giải
    // show_profile=false của họ: người xem khác (B) đọc → danh tính null,
    // is_solution_author=true; bật show_profile → danh tính thật; tắt lại →
    // null lần nữa; bình luận không ẩn danh của B (người khác) giữ nguyên danh
    // tính xuyên suốt cả ba lượt đọc.
    const detailForS4Off1 = await userB.rpc("community_solution_detail", { p_solution_id: SOL27 });
    const selfRowOff1 = commentIn27(detailForS4Off1, CS27_Q1, commentSelfAId as string);
    const otherRowOff1 = commentIn27(detailForS4Off1, CS27_Q1, commentBVisibleId as string);
    assert(
      selfRowOff1?.author_id === null &&
        selfRowOff1?.author_display_name === null &&
        selfRowOff1?.author_avatar_path === null &&
        selfRowOff1?.is_solution_author === true &&
        otherRowOff1?.author_id === userBId &&
        otherRowOff1?.is_solution_author === false,
      `S4 (show_profile=false): bình luận của chính người viết A → danh tính null, is_solution_author=true; bình luận của B (người khác) vẫn giữ danh tính thật (nhận self=${JSON.stringify(selfRowOff1)}, other=${JSON.stringify(otherRowOff1)})`,
    );

    const showProfileOn27 = await admin.from("community_solutions").update({ show_profile: true }).eq("id", SOL27);
    if (showProfileOn27.error) throw showProfileOn27.error;
    const detailForS4On = await userB.rpc("community_solution_detail", { p_solution_id: SOL27 });
    const selfRowOn = commentIn27(detailForS4On, CS27_Q1, commentSelfAId as string);
    assert(
      selfRowOn?.author_id === userAId && selfRowOn?.is_solution_author === true,
      `S4: bật show_profile → bình luận của chính người viết trả lại danh tính THẬT trên lượt đọc kế tiếp (nhận ${JSON.stringify(selfRowOn)})`,
    );

    const showProfileOff27 = await admin.from("community_solutions").update({ show_profile: false }).eq("id", SOL27);
    if (showProfileOff27.error) throw showProfileOff27.error;
    const detailForS4Off2 = await userB.rpc("community_solution_detail", { p_solution_id: SOL27 });
    const selfRowOff2 = commentIn27(detailForS4Off2, CS27_Q1, commentSelfAId as string);
    assert(selfRowOff2?.author_id === null, "S4: tắt show_profile lại lần nữa → danh tính lại null");

    console.log("\nRLS checks (Community Solutions task 27 — delete_community_comment group, AC-070/S19):");

    // (a) người khác — kể cả CHÍNH người viết bài giải — xoá bình luận không
    // phải của mình (commentBVisible thuộc B).
    const deleteByWriter = await userA.rpc("delete_community_comment", { p_comment_id: commentBVisibleId });
    assert(
      deleteByWriter.error?.code === "42501" &&
        deleteByWriter.error?.message === "delete_community_comment: not eligible" &&
        (await commentStatusOf27(commentBVisibleId as string)) === "visible",
      `(a) người viết A xoá bình luận của B (không phải của mình) bị 42501 'not eligible', dòng còn nguyên (nhận ${deleteByWriter.error?.message})`,
    );

    // (b) bình luận của chính mình đã bị admin ẩn (S19) — dùng commentSelfA,
    // đúng tiền lệ SN-1 (task 05/16): admin_moderate_community_comment chưa
    // tồn tại tới migration 32, harness setup client tự đặt status='hidden'.
    const hideSelfComment = await admin
      .from("community_solution_comments")
      .update({ status: "hidden" })
      .eq("id", commentSelfAId as string);
    if (hideSelfComment.error) throw hideSelfComment.error;
    const deleteOwnHidden = await userA.rpc("delete_community_comment", { p_comment_id: commentSelfAId });
    assert(
      deleteOwnHidden.error?.code === "42501" && (await commentStatusOf27(commentSelfAId as string)) === "hidden",
      `(b) S19: bình luận của chính mình đã bị ẩn → xoá bị 42501, dòng còn nguyên, status='hidden' (nhận ${deleteOwnHidden.error?.code})`,
    );

    // (c) anon.
    const deleteAnon = await anonClient.rpc("delete_community_comment", { p_comment_id: commentBVisibleId });
    assert(
      isAuthorizationDenial(deleteAnon.error) && (await commentStatusOf27(commentBVisibleId as string)) === "visible",
      `(c) anon bị từ chối, dòng của B còn nguyên (nhận ${deleteAnon.error?.code})`,
    );

    // (d) table closure: B (chủ bình luận, đủ điều kiện) tự DELETE trực tiếp.
    const deleteDirect = await userB
      .from("community_solution_comments")
      .delete()
      .eq("id", commentBVisibleId as string)
      .select();
    assert(
      isAuthorizationDenial(deleteDirect.error) &&
        (deleteDirect.data?.length ?? 0) === 0 &&
        (await commentStatusOf27(commentBVisibleId as string)) === "visible",
      `(d) table closure: B KHÔNG tự DELETE trực tiếp được community_solution_comments, dòng còn nguyên (nhận ${deleteDirect.error?.code ?? "KHÔNG CÓ LỖI"})`,
    );

    // Fixture riêng cho (f)/(g)/(h)/success — một bình luận MỚI, còn 'visible',
    // của B, kèm một dòng community_content_reports (do harness ghi — bảng
    // này cũng đóng hoàn toàn, không policy không grant) để chứng minh cascade
    // khi xoá thành công.
    const commentForGates = await userB.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: "[RLS-CS27] Bình luận dùng cho cổng AC-004/AC-002",
      p_is_anonymous: false,
    });
    if (commentForGates.error) throw commentForGates.error;
    const commentForGatesId = (commentForGates.data as Array<{ comment_id: string }>)[0].comment_id;
    const reportOnGatesComment = await admin.from("community_content_reports").insert({
      comment_id: commentForGatesId,
      reporter_id: userAId,
      reason: "[RLS-CS27] báo cáo fixture cho cascade",
    });
    if (reportOnGatesComment.error) throw reportOnGatesComment.error;

    // (f) AC-004: đề đang 'draft'.
    const examToDraft27 = await admin.from("exams").update({ status: "draft" }).eq("id", CS27_EXAM_ID);
    if (examToDraft27.error) throw examToDraft27.error;
    const deleteExamDraft = await userB.rpc("delete_community_comment", { p_comment_id: commentForGatesId });
    assert(
      deleteExamDraft.error?.code === "42501" &&
        deleteExamDraft.error?.message === "delete_community_comment: not eligible" &&
        (await commentStatusOf27(commentForGatesId)) === "visible",
      `(f) AC-004: đề 'draft' → 42501 'not eligible', dòng còn nguyên (nhận ${deleteExamDraft.error?.message})`,
    );
    const examRestore27a = await admin.from("exams").update({ status: "published" }).eq("id", CS27_EXAM_ID);
    if (examRestore27a.error) throw examRestore27a.error;

    // (g) AC-004: tác giả đề bị ban.
    const banAuthor27 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
    if (banAuthor27.error) throw banAuthor27.error;
    const deleteAuthorBanned = await userB.rpc("delete_community_comment", { p_comment_id: commentForGatesId });
    assert(
      deleteAuthorBanned.error?.code === "42501" && (await commentStatusOf27(commentForGatesId)) === "visible",
      `(g) AC-004: tác giả đề bị ban → 42501, dòng còn nguyên (nhận ${deleteAuthorBanned.error?.code})`,
    );
    const unbanAuthor27 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
    if (unbanAuthor27.error) throw unbanAuthor27.error;

    // (h) AC-002: attempt của CHÍNH B đang 'in_progress'.
    const bToInProgress27 = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", attemptB27);
    if (bToInProgress27.error) throw bToInProgress27.error;
    const deleteInProgress = await userB.rpc("delete_community_comment", { p_comment_id: commentForGatesId });
    assert(
      deleteInProgress.error?.code === "42501" && (await commentStatusOf27(commentForGatesId)) === "visible",
      `(h) AC-002: attempt của chính B đang 'in_progress' → 42501, dòng còn nguyên (nhận ${deleteInProgress.error?.code})`,
    );
    const bResubmit27 = await admin
      .from("exam_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", attemptB27);
    if (bResubmit27.error) throw bResubmit27.error;

    console.log("\nRLS checks (Community Solutions task 27 — delete_community_comment success, cascade AC-070):");

    const deleteSuccess = await userB.rpc("delete_community_comment", { p_comment_id: commentForGatesId });
    const reportsAfterDelete = await admin
      .from("community_content_reports")
      .select("id")
      .eq("comment_id", commentForGatesId);
    assert(
      !deleteSuccess.error &&
        (await commentStatusOf27(commentForGatesId)) === null &&
        (reportsAfterDelete.data?.length ?? -1) === 0,
      `Success: bình luận 'visible' của chính B bị xoá, và community_content_reports của nó cũng mất theo cascade (nhận mã lỗi ${deleteSuccess.error?.code}, reports còn lại ${reportsAfterDelete.data?.length})`,
    );

    console.log("\nRLS checks (Community Solutions task 27 — AC-002 gate: community_my_comment_feed):");

    const aToInProgress27 = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", attemptA27);
    if (aToInProgress27.error) throw aToInProgress27.error;
    const feedWhileInProgress = await userA.rpc("community_my_comment_feed", { p_page: 1, p_page_size: 20 });
    const feedRowsForExamDuringInProgress = (feedWhileInProgress.data as Array<{ exam_id: string }> | null)?.filter(
      (row) => row.exam_id === CS27_EXAM_ID,
    );
    assert(
      !feedWhileInProgress.error && (feedRowsForExamDuringInProgress?.length ?? -1) === 0,
      `AC-002 gate: attempt của chính người viết A đang 'in_progress' → community_my_comment_feed không trả dòng nào của đề này (nhận ${feedRowsForExamDuringInProgress?.length})`,
    );
    const aResubmit27 = await admin
      .from("exam_attempts")
      .update({ status: "submitted", submitted_at: new Date().toISOString() })
      .eq("id", attemptA27);
    if (aResubmit27.error) throw aResubmit27.error;
    const feedAfterResubmit = await userA.rpc("community_my_comment_feed", { p_page: 1, p_page_size: 20 });
    const feedRowsForExamAfterResubmit = (feedAfterResubmit.data as Array<{ exam_id: string }> | null)?.filter(
      (row) => row.exam_id === CS27_EXAM_ID,
    );
    assert(
      (feedRowsForExamAfterResubmit?.length ?? 0) > 0,
      "AC-002 gate: sau khi nộp lại (submitted), community_my_comment_feed trả lại đúng dòng của đề này",
    );

    console.log(
      "\nRLS checks (Community Solutions task 27 — case ghi cursor user_profiles.community_comments_last_read_at):",
    );

    const ownerSetsCursor = await userA
      .from("user_profiles")
      .update({ community_comments_last_read_at: new Date().toISOString() })
      .eq("id", userAId)
      .select("id");
    assert(
      !ownerSetsCursor.error && (ownerSetsCursor.data?.length ?? 0) === 1,
      `Cursor write: chủ tài khoản (A) tự đặt được community_comments_last_read_at của chính mình dưới profiles_update_own không đổi (nhận mã lỗi ${ownerSetsCursor.error?.code})`,
    );
    const otherSetsCursor = await userB
      .from("user_profiles")
      .update({ community_comments_last_read_at: new Date().toISOString() })
      .eq("id", userAId)
      .select("id");
    assert(
      !otherSetsCursor.error && (otherSetsCursor.data?.length ?? 0) === 0,
      `Cursor write: B KHÔNG đặt được cột này cho A — 0 dòng đổi, không lỗi (RLS lọc theo id=auth.uid()) (nhận mã lỗi ${otherSetsCursor.error?.code}, số dòng đổi ${otherSetsCursor.data?.length})`,
    );
    const resetCursor27 = await admin
      .from("user_profiles")
      .update({ community_comments_last_read_at: null })
      .eq("id", userAId);
    if (resetCursor27.error) throw resetCursor27.error;

    console.log("\nRLS checks (Community Solutions task 27 — Name-resolution regression, không 42702):");

    const nameResPost = await userA.rpc("post_community_comment", {
      p_solution_id: SOL27,
      p_question_id: CS27_Q1,
      p_body: "[RLS-CS27] Hồi quy tên — không 42702",
      p_is_anonymous: false,
    });
    assert(
      !nameResPost.error,
      `Name-resolution regression: post_community_comment thành công — nhất là không 42702 (nhận ${nameResPost.error?.code})`,
    );

    // Dọn dẹp fixture Community Solutions (task 27).
    await cleanupCs27Fixtures(admin);
  }

  // ==========================================================================
  // Phần 13 — Community Solutions, TEST TASK 35 (migration task 32: backend DD
  // v1.9 § Integration Verification Points / § Test Boundaries "User-write RPC
  // groups" / § Data Contracts "Admin RPCs"). Hai nhóm RPC báo cáo (kèm
  // table-closure + AC-004), `i_reported` theo từng người gọi, nhóm admin
  // (từ chối người không phải admin cho CẢ BỐN hàm — AC-085; lý do/chuyển
  // trạng thái/hành động lạ 22023; AC-084 xoá hẳn cascade + đúng một dòng
  // log), hình dạng ghi chú cho admin (RCV #16), hàng đợi admin với bình luận
  // bị ẩn + bài giải bị ẩn luôn còn trong hàng đợi (RCV #26) + hai cờ ẩn danh,
  // hồi quy tên. SN-1 (work plan § Open Items): các case "bị ẩn" của task
  // 05/16/27 — trước đây dựng bằng harness setup client — chạy LẠI ở đây qua
  // RPC admin thật.
  //
  // TD-029: phiên admin là phiên Supabase Auth thường (signInAsSeededAdmin),
  // KHÔNG phải service-role client; setup client chỉ dựng fixture và đọc đối
  // chứng, đúng như mọi phần trên. U1: bảng community_content_reports đóng
  // hoàn toàn — không thêm grant/policy nào để một case xanh.
  //
  // Bọc trong { } cùng quy ước Phần 11/12.
  // ==========================================================================
  {
    console.log("\nCommunity Solutions (task 35) — setup fixture (service_role) + phiên admin đã seed…");
    await cleanupCs35Fixtures(admin);

    const userDId = await ensureUser(admin, EMAIL_D);
    const userD = await signInAs(url, anon, EMAIL_D);
    const { client: adminSession, userId: adminUserId } = await signInAsSeededAdmin(
      admin,
      url,
      anon,
      env.ADMIN_USER_IDS,
    );
    // Mọi thứ sau khi có phiên admin thật nằm trong try/finally: phiên này là
    // magic-link trên tài khoản admin dev, nên PHẢI được thu hồi kể cả khi một
    // assert/setup ném lỗi giữa chừng.
    let part13Completed = false;
    try {
      const adminGate = await adminSession.rpc("is_admin_user");
      if (adminGate.error || adminGate.data !== true) {
        throw new Error(
          `Phiên admin đã seed không qua is_admin_user() (nhận ${adminGate.error?.code ?? adminGate.data}) — chạy lại seed admin_users của task 03, KHÔNG sửa test`,
        );
      }

      const profiles = await admin.from("user_profiles").select("id, display_name").in("id", [userAId, userBId, userCId]);
      if (profiles.error) throw profiles.error;
      const displayNameOf = new Map(
        (profiles.data ?? []).map((p) => [p.id as string, (p.display_name as string | null) ?? null]),
      );
      const nameA = displayNameOf.get(userAId) ?? null;
      const nameB = displayNameOf.get(userBId) ?? null;
      const nameC = displayNameOf.get(userCId) ?? null;
      if (!nameA || !nameB || !nameC) {
        throw new Error("user_profiles.display_name của A/B/C rỗng — các case 'tên thật' sẽ không chứng minh được gì");
      }

      type RpcResult = { data: unknown; error: { code?: string; message?: string; details?: string } | null };

      /** Một đề published 3 câu, tác giả A, mỗi user A/B/C/D một lượt đã nộp.
       *  Admin KHÔNG có lượt nào (AC-081: admin không cần đã nộp đề). */
      async function setupCs35Exam(examId: string): Promise<Record<string, string>> {
        const questionIds = cs35QuestionIds(examId);
        const questions = await admin.from("questions").insert(
          questionIds.map((id, i) => ({
            id,
            content: `[RLS-CS35] ${examId} câu ${i + 1}`,
            choices: MCQ_CHOICES,
            correct_answer: "A",
            subject: "Toán",
            grade: 10,
            topic: "Toán",
          })),
        );
        if (questions.error) throw questions.error;
        const exam = await admin.from("exams").insert({
          id: examId,
          title: `[RLS] Đề Bài giải cộng đồng (task 35) ${examId}`,
          duration_minutes: 45,
          subject: "Toán",
          grade: 10,
          author_id: userAId,
          author_display_name: "RLS Test Author",
          question_ids: questionIds,
          status: "published",
        });
        if (exam.error) throw exam.error;
        const attempts: Record<string, string> = {};
        for (const userId of [userAId, userBId, userCId, userDId]) {
          attempts[userId] = await insertSubmittedAttempt(admin, userId, examId, new Date());
        }
        return attempts;
      }

      async function insertCs35Solution(spec: {
        examId: string;
        authorId: string;
        status: "draft" | "published";
        showProfile: boolean;
        attemptId: string;
        notes: Array<{ questionId: string; body: string }>;
      }): Promise<string> {
        const row = await admin
          .from("community_solutions")
          .insert({
            exam_id: spec.examId,
            author_id: spec.authorId,
            status: spec.status,
            show_profile: spec.showProfile,
            show_score: false,
            linked_attempt_id: spec.attemptId,
          })
          .select("id")
          .single();
        if (row.error) throw row.error;
        const solutionId = row.data!.id as string;
        if (spec.notes.length > 0) {
          const notes = await admin.from("community_solution_notes").insert(
            spec.notes.map((note) => ({ solution_id: solutionId, question_id: note.questionId, body: note.body })),
          );
          if (notes.error) throw notes.error;
        }
        return solutionId;
      }
      function fullNotes(examId: string): Array<{ questionId: string; body: string }> {
        return cs35QuestionIds(examId).map((questionId) => ({ questionId, body: csWords(15) }));
      }

      /** Bình luận tạo qua CHÍNH RPC của người bình luận (DD: bình luận ẩn danh
       *  phải đi qua post_community_comment của phiên người đó). */
      async function postCs35Comment(
        client: SupabaseClient,
        target: { solutionId: string; questionId: string; body: string; isAnonymous: boolean },
      ): Promise<string> {
        const res = await client.rpc("post_community_comment", {
          p_solution_id: target.solutionId,
          p_question_id: target.questionId,
          p_body: target.body,
          p_is_anonymous: target.isAnonymous,
        });
        if (res.error) throw res.error;
        return (res.data as Array<{ comment_id: string }>)[0].comment_id;
      }
      async function mustSucceed(label: string, call: PromiseLike<RpcResult>): Promise<void> {
        const res = await call;
        if (res.error) throw new Error(`${label}: ${res.error.code} ${res.error.message}`);
      }

      async function reportsOnSolution(solutionId: string): Promise<number> {
        const r = await admin
          .from("community_content_reports")
          .select("id", { count: "exact", head: true })
          .eq("solution_id", solutionId);
        return r.count ?? -1;
      }
      async function reportsOnComment(commentId: string): Promise<number> {
        const r = await admin
          .from("community_content_reports")
          .select("id", { count: "exact", head: true })
          .eq("comment_id", commentId);
        return r.count ?? -1;
      }
      async function solutionStatusOf(solutionId: string): Promise<string | null> {
        const r = await admin.from("community_solutions").select("status").eq("id", solutionId).maybeSingle();
        return (r.data as { status: string } | null)?.status ?? null;
      }
      async function commentStatusOf(commentId: string): Promise<string | null> {
        const r = await admin.from("community_solution_comments").select("status").eq("id", commentId).maybeSingle();
        return (r.data as { status: string } | null)?.status ?? null;
      }
      type LogRow = {
        target_type: string;
        exam_id: string | null;
        target_user_id: string | null;
        actor_id: string | null;
        action: string;
        reason: string | null;
        created_at: string;
      };
      async function logRowsFor(targetId: string): Promise<LogRow[]> {
        const r = await admin
          .from("community_moderation_log")
          .select("target_type, exam_id, target_user_id, actor_id, action, reason, created_at")
          .eq("target_id", targetId)
          .order("created_at");
        if (r.error) throw r.error;
        return r.data as LogRow[];
      }
      /** Toàn bộ trạng thái một đề fixture (bài giải, ghi chú, Hữu ích, bình
       *  luận, báo cáo, dòng log) — so trước/sau một lời gọi bị từ chối để chứng
       *  minh "không dòng nào, không dòng log nào đổi". */
      async function worldOf(examId: string): Promise<string> {
        const solutions = await admin
          .from("community_solutions")
          .select("id, status, updated_at, is_pinned, show_profile")
          .eq("exam_id", examId)
          .order("id");
        if (solutions.error) throw solutions.error;
        const solutionIds = (solutions.data ?? []).map((s) => s.id as string);
        const notes = await admin
          .from("community_solution_notes")
          .select("solution_id, question_id, body")
          .in("solution_id", solutionIds)
          .order("solution_id")
          .order("question_id");
        const helpfuls = await admin
          .from("community_solution_helpfuls")
          .select("solution_id, user_id")
          .in("solution_id", solutionIds)
          .order("solution_id")
          .order("user_id");
        const comments = await admin
          .from("community_solution_comments")
          .select("id, status, body")
          .in("solution_id", solutionIds)
          .order("id");
        const commentIds = (comments.data ?? []).map((c) => c.id as string);
        const solutionReports = await admin.from("community_content_reports").select("id").in("solution_id", solutionIds).order("id");
        const commentReports = await admin.from("community_content_reports").select("id").in("comment_id", commentIds).order("id");
        const logs = await admin.from("community_moderation_log").select("id").eq("exam_id", examId).order("id");
        for (const r of [notes, helpfuls, comments, solutionReports, commentReports, logs]) if (r.error) throw r.error;
        return JSON.stringify({
          solutions: solutions.data,
          notes: notes.data,
          helpfuls: helpfuls.data,
          comments: comments.data,
          solutionReports: solutionReports.data,
          commentReports: commentReports.data,
          logs: logs.data,
        });
      }
      async function assertRefusedUnchanged(
        label: string,
        examId: string,
        call: () => PromiseLike<RpcResult>,
        isExpectedRefusal: (res: RpcResult) => boolean,
      ): Promise<void> {
        const before = await worldOf(examId);
        const res = await call();
        const after = await worldOf(examId);
        assert(
          isExpectedRefusal(res) && after === before,
          `${label} — không dòng nào, không dòng log nào đổi (nhận: ${res.error?.code ?? "KHÔNG CÓ LỖI"} ${res.error?.message ?? ""}, trạng thái ${after === before ? "không đổi" : "ĐÃ ĐỔI"})`,
        );
      }
      function refusedNotEligible(fn: string): (res: RpcResult) => boolean {
        return (res) =>
          isAuthorizationDenial(res.error) && res.error?.code === "42501" && res.error?.message === `${fn}: not eligible`;
      }
      function refusedNotAdmin(fn: string): (res: RpcResult) => boolean {
        return (res) =>
          isAuthorizationDenial(res.error) &&
          res.error?.code === "42501" &&
          res.error?.message === `${fn}: not an admin` &&
          res.data === null;
      }
      function rejected22023(message: string): (res: RpcResult) => boolean {
        return (res) => res.error?.code === "22023" && res.error?.message === message;
      }
      function sameInstant(a: string | null | undefined, b: string | null | undefined): boolean {
        return typeof a === "string" && typeof b === "string" && Date.parse(a) === Date.parse(b);
      }

      const moderateSolution = (client: SupabaseClient, solutionId: string, action: string, reason: string | null) =>
        client.rpc("admin_moderate_community_solution", { p_solution_id: solutionId, p_action: action, p_reason: reason });
      const moderateComment = (client: SupabaseClient, commentId: string, action: string, reason: string | null) =>
        client.rpc("admin_moderate_community_comment", { p_comment_id: commentId, p_action: action, p_reason: reason });

      type DetailComment = {
        id: string;
        is_hidden_by_admin: boolean;
        hidden_reason: string | null;
        body: string;
        i_reported: boolean;
      };
      type DetailQuestion = { question_id: string; comment_count: number | null; comments: DetailComment[] };
      type DetailRow = { i_reported: boolean; questions: DetailQuestion[] };
      async function detailOf(client: SupabaseClient, solutionId: string) {
        const d = await client.rpc("community_solution_detail", { p_solution_id: solutionId });
        const rows = d.data as DetailRow[] | null;
        return { error: d.error, rowCount: rows?.length ?? -1, row: rows?.[0], questions: rows?.[0]?.questions ?? [] };
      }
      function questionIn(questions: DetailQuestion[], questionId: string): DetailQuestion | undefined {
        return questions.find((q) => q.question_id === questionId);
      }

      type QueueReportedComment = {
        id: string;
        question_number: number | null;
        body: string;
        commenter_display_name: string | null;
        commenter_is_anonymous_to_readers: boolean;
        report_count: number;
        report_reasons: string[];
      };
      type QueueHiddenComment = {
        id: string;
        question_number: number | null;
        body: string;
        commenter_display_name: string | null;
        commenter_is_anonymous_to_readers: boolean;
        hidden_reason: string | null;
        hidden_at: string | null;
        report_count: number;
      };
      type QueueRow = {
        id: string;
        exam_id: string;
        exam_title: string;
        author_display_name: string | null;
        author_is_anonymous_to_readers: boolean;
        status: string;
        report_count: number;
        report_reasons: string[];
        reported_comments: QueueReportedComment[];
        hidden_comments: QueueHiddenComment[];
      };
      /** Hàng đợi đọc bằng phiên admin. Nhóm admin_list_community_reports
       *  success kiểm lỗi của lượt đọc đầu tiên; các lượt sau lỗi thì dừng hẳn. */
      async function readQueue(): Promise<QueueRow[]> {
        const r = await adminSession.rpc("admin_list_community_reports");
        if (r.error) throw new Error(`admin_list_community_reports: ${r.error.code} ${r.error.message}`);
        return r.data as QueueRow[];
      }
      async function queueRowFor(solutionId: string): Promise<QueueRow | undefined> {
        return (await readQueue()).find((row) => row.id === solutionId);
      }

      // ------------------------------------------------------------------------
      // Nhóm RPC báo cáo — đề rls-cs35-report. W = A (người viết, cũng là tác giả
      // đề), Q = B (người bình luận), R = C (người báo cáo), T = D (chưa báo cáo).
      // ------------------------------------------------------------------------
      const attemptsR = await setupCs35Exam(CS35_REPORT_EXAM_ID);
      const [R_Q1] = cs35QuestionIds(CS35_REPORT_EXAM_ID);
      const SOL_R = await insertCs35Solution({
        examId: CS35_REPORT_EXAM_ID,
        authorId: userAId,
        status: "published",
        showProfile: true,
        attemptId: attemptsR[userAId],
        notes: fullNotes(CS35_REPORT_EXAM_ID),
      });
      const COMMENT_Q = await postCs35Comment(userB, {
        solutionId: SOL_R,
        questionId: R_Q1,
        body: "[RLS-CS35] Bình luận của Q (B)",
        isAnonymous: false,
      });
      const reportSolutionR = (client: SupabaseClient, reason = "[RLS-CS35] báo cáo bài giải") =>
        client.rpc("report_community_solution", { p_solution_id: SOL_R, p_reason: reason });
      const reportCommentQ = (client: SupabaseClient, reason = "[RLS-CS35] báo cáo bình luận") =>
        client.rpc("report_community_comment", { p_comment_id: COMMENT_Q, p_reason: reason });
      const notEligibleSolution = refusedNotEligible("report_community_solution");
      const notEligibleComment = refusedNotEligible("report_community_comment");

      console.log("\nRLS checks (Community Solutions task 35 — report_community_solution / report_community_comment refusal groups):");

      // (a) nội dung của chính mình.
      const reportOwnSolution = await reportSolutionR(userA);
      assert(
        notEligibleSolution(reportOwnSolution) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (a): người viết A báo cáo bài giải của chính mình → 42501 'not eligible', 0 dòng (nhận ${reportOwnSolution.error?.message})`,
      );
      const reportOwnComment = await reportCommentQ(userB);
      assert(
        notEligibleComment(reportOwnComment) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (a): B báo cáo bình luận của chính mình → 42501 'not eligible', 0 dòng (nhận ${reportOwnComment.error?.message})`,
      );

      // (b) caller chưa có lượt nào đã nộp (lượt duy nhất của D quay 'in_progress').
      const dToInProgress = await admin.from("exam_attempts").update({ status: "in_progress" }).eq("id", attemptsR[userDId]);
      if (dToInProgress.error) throw dToInProgress.error;
      const reportSolutionNoAttempt = await reportSolutionR(userD);
      const reportCommentNoAttempt = await reportCommentQ(userD);
      assert(
        notEligibleSolution(reportSolutionNoAttempt) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (b): caller chưa nộp bài → 42501, 0 dòng (nhận ${reportSolutionNoAttempt.error?.message})`,
      );
      assert(
        notEligibleComment(reportCommentNoAttempt) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (b): caller chưa nộp bài → 42501, 0 dòng (nhận ${reportCommentNoAttempt.error?.message})`,
      );
      const dResubmit = await admin
        .from("exam_attempts")
        .update({ status: "submitted", submitted_at: new Date().toISOString() })
        .eq("id", attemptsR[userDId]);
      if (dResubmit.error) throw dResubmit.error;

      // (c) bài giải 'draft' / bình luận dưới bài giải 'draft'.
      const solRToDraft = await admin.from("community_solutions").update({ status: "draft" }).eq("id", SOL_R);
      if (solRToDraft.error) throw solRToDraft.error;
      const reportSolutionDraft = await reportSolutionR(userC);
      const reportCommentDraft = await reportCommentQ(userC);
      assert(
        notEligibleSolution(reportSolutionDraft) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (c): bài giải 'draft' → 42501, 0 dòng (nhận ${reportSolutionDraft.error?.message})`,
      );
      assert(
        notEligibleComment(reportCommentDraft) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (c): bình luận dưới bài giải 'draft' → 42501, 0 dòng (nhận ${reportCommentDraft.error?.message})`,
      );
      const solRRepublish = await admin.from("community_solutions").update({ status: "published" }).eq("id", SOL_R);
      if (solRRepublish.error) throw solRRepublish.error;

      // (d) anon.
      const reportSolutionAnon = await reportSolutionR(anonClient);
      const reportCommentAnon = await reportCommentQ(anonClient);
      assert(
        isAuthorizationDenial(reportSolutionAnon.error) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (d): anon bị từ chối, 0 dòng (nhận ${reportSolutionAnon.error?.code})`,
      );
      assert(
        isAuthorizationDenial(reportCommentAnon.error) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (d): anon bị từ chối, 0 dòng (nhận ${reportCommentAnon.error?.code})`,
      );

      // (e) table closure: C (đủ điều kiện) tự INSERT trực tiếp.
      const directReportSolution = await userC
        .from("community_content_reports")
        .insert({ solution_id: SOL_R, reporter_id: userCId, reason: "[RLS-CS35] insert trực tiếp" })
        .select();
      assert(
        isAuthorizationDenial(directReportSolution.error) &&
          (directReportSolution.data?.length ?? 0) === 0 &&
          (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (e) table closure: C KHÔNG tự INSERT trực tiếp được community_content_reports (solution_id) (nhận ${directReportSolution.error?.code ?? "KHÔNG CÓ LỖI"})`,
      );
      const directReportComment = await userC
        .from("community_content_reports")
        .insert({ comment_id: COMMENT_Q, reporter_id: userCId, reason: "[RLS-CS35] insert trực tiếp" })
        .select();
      assert(
        isAuthorizationDenial(directReportComment.error) &&
          (directReportComment.data?.length ?? 0) === 0 &&
          (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (e) table closure: C KHÔNG tự INSERT trực tiếp được community_content_reports (comment_id) (nhận ${directReportComment.error?.code ?? "KHÔNG CÓ LỖI"})`,
      );

      // (f) AC-004: đề đang 'draft'.
      const examRToDraft = await admin.from("exams").update({ status: "draft" }).eq("id", CS35_REPORT_EXAM_ID);
      if (examRToDraft.error) throw examRToDraft.error;
      const reportSolutionExamDraft = await reportSolutionR(userC);
      const reportCommentExamDraft = await reportCommentQ(userC);
      assert(
        notEligibleSolution(reportSolutionExamDraft) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (f) AC-004: đề 'draft' → 42501, 0 dòng (nhận ${reportSolutionExamDraft.error?.message})`,
      );
      assert(
        notEligibleComment(reportCommentExamDraft) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (f) AC-004: đề 'draft' → 42501, 0 dòng (nhận ${reportCommentExamDraft.error?.message})`,
      );
      const examRRepublish = await admin.from("exams").update({ status: "published" }).eq("id", CS35_REPORT_EXAM_ID);
      if (examRRepublish.error) throw examRRepublish.error;

      // (g) AC-004: tác giả đề bị ban.
      const banAuthor35 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "24h" });
      if (banAuthor35.error) throw banAuthor35.error;
      const reportSolutionBanned = await reportSolutionR(userC);
      const reportCommentBanned = await reportCommentQ(userC);
      assert(
        notEligibleSolution(reportSolutionBanned) && (await reportsOnSolution(SOL_R)) === 0,
        `report_community_solution (g) AC-004: tác giả đề bị ban → 42501, 0 dòng (nhận ${reportSolutionBanned.error?.message})`,
      );
      assert(
        notEligibleComment(reportCommentBanned) && (await reportsOnComment(COMMENT_Q)) === 0,
        `report_community_comment (g) AC-004: tác giả đề bị ban → 42501, 0 dòng (nhận ${reportCommentBanned.error?.message})`,
      );
      const unbanAuthor35 = await admin.auth.admin.updateUserById(userAId, { ban_duration: "none" });
      if (unbanAuthor35.error) throw unbanAuthor35.error;

      console.log("\nRLS checks (Community Solutions task 35 — i_reported arrives from the read + report success, AC-073–AC-076/M4):");

      async function reportedFlagsOf(client: SupabaseClient) {
        const detail = await detailOf(client, SOL_R);
        const comment = questionIn(detail.questions, R_Q1)?.comments.find((c) => c.id === COMMENT_Q);
        return { error: detail.error, header: detail.row?.i_reported, comment: comment?.i_reported };
      }

      const flagsRBefore = await reportedFlagsOf(userC);
      assert(
        !flagsRBefore.error && flagsRBefore.header === false && flagsRBefore.comment === false,
        `i_reported: R (C) đọc trước khi báo cáo → header false, bình luận của Q false (nhận ${JSON.stringify(flagsRBefore)})`,
      );

      const reportSolutionFirst = await reportSolutionR(userC, "x");
      assert(
        !reportSolutionFirst.error &&
          JSON.stringify(reportSolutionFirst.data) === JSON.stringify([{ already_reported: false }]) &&
          (await reportsOnSolution(SOL_R)) === 1,
        `report_community_solution success: R đủ điều kiện → [{ already_reported: false }], đúng 1 dòng (nhận ${JSON.stringify(reportSolutionFirst.data)}, mã lỗi ${reportSolutionFirst.error?.code})`,
      );
      const flagsRAfterSolution = await reportedFlagsOf(userC);
      assert(
        !flagsRAfterSolution.error && flagsRAfterSolution.header === true && flagsRAfterSolution.comment === false,
        `i_reported: R đọc lại sau report_community_solution → header TRUE (từ chính lượt đọc), bình luận của Q vẫn false (nhận ${JSON.stringify(flagsRAfterSolution)})`,
      );

      const reportCommentFirst = await reportCommentQ(userC, "y");
      assert(
        !reportCommentFirst.error &&
          JSON.stringify(reportCommentFirst.data) === JSON.stringify([{ already_reported: false }]) &&
          (await reportsOnComment(COMMENT_Q)) === 1,
        `report_community_comment success: R đủ điều kiện → [{ already_reported: false }], đúng 1 dòng (nhận ${JSON.stringify(reportCommentFirst.data)}, mã lỗi ${reportCommentFirst.error?.code})`,
      );
      const flagsRAfterComment = await reportedFlagsOf(userC);
      assert(
        !flagsRAfterComment.error && flagsRAfterComment.header === true && flagsRAfterComment.comment === true,
        `i_reported: R đọc lại sau report_community_comment → cả header lẫn bình luận của Q đều true (nhận ${JSON.stringify(flagsRAfterComment)})`,
      );

      const flagsT = await reportedFlagsOf(userD);
      assert(
        !flagsT.error && flagsT.header === false && flagsT.comment === false,
        `i_reported (AC-075): người thứ ba T (D), chưa báo cáo gì → false/false — cờ theo TỪNG người gọi, không phải "đã có ai báo cáo" (nhận ${JSON.stringify(flagsT)})`,
      );
      const flagsW = await reportedFlagsOf(userA);
      assert(
        !flagsW.error && flagsW.header === false && flagsW.comment === false,
        `i_reported: chính người viết W (A) đọc bài giải của mình → header false, bình luận của Q false (nhận ${JSON.stringify(flagsW)})`,
      );

      const reportSolutionAgain = await reportSolutionR(userC, "x");
      assert(
        !reportSolutionAgain.error &&
          JSON.stringify(reportSolutionAgain.data) === JSON.stringify([{ already_reported: true }]) &&
          (await reportsOnSolution(SOL_R)) === 1,
        `report_community_solution (AC-074/M4): gọi lại → [{ already_reported: true }], vẫn đúng 1 dòng (nhận ${JSON.stringify(reportSolutionAgain.data)})`,
      );
      const reportCommentAgain = await reportCommentQ(userC, "y");
      assert(
        !reportCommentAgain.error &&
          JSON.stringify(reportCommentAgain.data) === JSON.stringify([{ already_reported: true }]) &&
          (await reportsOnComment(COMMENT_Q)) === 1,
        `report_community_comment (AC-076/M4): gọi lại → [{ already_reported: true }], vẫn đúng 1 dòng (nhận ${JSON.stringify(reportCommentAgain.data)})`,
      );

      // ------------------------------------------------------------------------
      // Nhóm admin — đề rls-cs35-mod. SOL_M (tác giả B, published, có Hữu ích,
      // bình luận, ghim), SOL_M_DRAFT (C, nháp), SOL_M_DEL_PUB (D, published —
      // AC-084), SOL_M_DEL_HID (A, published → ẩn → xoá hẳn).
      // ------------------------------------------------------------------------
      console.log("\nCommunity Solutions (task 35) — fixture nhóm admin (đề rls-cs35-mod)…");
      const attemptsM = await setupCs35Exam(CS35_MOD_EXAM_ID);
      const [M_Q1] = cs35QuestionIds(CS35_MOD_EXAM_ID);
      const SOL_M = await insertCs35Solution({
        examId: CS35_MOD_EXAM_ID,
        authorId: userBId,
        status: "published",
        showProfile: true,
        attemptId: attemptsM[userBId],
        notes: fullNotes(CS35_MOD_EXAM_ID),
      });
      const SOL_M_DRAFT = await insertCs35Solution({
        examId: CS35_MOD_EXAM_ID,
        authorId: userCId,
        status: "draft",
        showProfile: true,
        attemptId: attemptsM[userCId],
        notes: [],
      });
      const SOL_M_DEL_PUB = await insertCs35Solution({
        examId: CS35_MOD_EXAM_ID,
        authorId: userDId,
        status: "published",
        showProfile: true,
        attemptId: attemptsM[userDId],
        notes: fullNotes(CS35_MOD_EXAM_ID),
      });
      const SOL_M_DEL_HID = await insertCs35Solution({
        examId: CS35_MOD_EXAM_ID,
        authorId: userAId,
        status: "published",
        showProfile: true,
        attemptId: attemptsM[userAId],
        notes: fullNotes(CS35_MOD_EXAM_ID),
      });

      await mustSucceed("C Hữu ích SOL_M", userC.rpc("add_community_solution_helpful", { p_solution_id: SOL_M }));
      await mustSucceed("D Hữu ích SOL_M", userD.rpc("add_community_solution_helpful", { p_solution_id: SOL_M }));
      const COMMENT_MC = await postCs35Comment(userC, {
        solutionId: SOL_M,
        questionId: M_Q1,
        body: "[RLS-CS35] Bình luận của C trên SOL_M",
        isAnonymous: false,
      });
      const COMMENT_MD = await postCs35Comment(userD, {
        solutionId: SOL_M,
        questionId: M_Q1,
        body: "[RLS-CS35] Bình luận của D trên SOL_M",
        isAnonymous: false,
      });
      await postCs35Comment(userB, {
        solutionId: SOL_M,
        questionId: M_Q1,
        body: "[RLS-CS35] Bình luận của chính người viết B",
        isAnonymous: false,
      });
      await mustSucceed(
        "A ghim SOL_M",
        userA.rpc("set_community_solution_pin", { p_exam_id: CS35_MOD_EXAM_ID, p_action: "pin", p_solution_id: SOL_M }),
      );

      await mustSucceed("B Hữu ích SOL_M_DEL_PUB", userB.rpc("add_community_solution_helpful", { p_solution_id: SOL_M_DEL_PUB }));
      const COMMENT_DEL_PUB = await postCs35Comment(userC, {
        solutionId: SOL_M_DEL_PUB,
        questionId: M_Q1,
        body: "[RLS-CS35] Bình luận trên bài giải sẽ bị xoá hẳn",
        isAnonymous: false,
      });
      await mustSucceed(
        "B báo cáo SOL_M_DEL_PUB",
        userB.rpc("report_community_solution", { p_solution_id: SOL_M_DEL_PUB, p_reason: "[RLS-CS35] báo cáo trước khi xoá hẳn" }),
      );
      await mustSucceed(
        "B báo cáo bình luận trên SOL_M_DEL_PUB",
        userB.rpc("report_community_comment", { p_comment_id: COMMENT_DEL_PUB, p_reason: "[RLS-CS35] báo cáo trước khi xoá hẳn" }),
      );

      async function listRowFor(client: SupabaseClient, solutionId: string) {
        const l = await client.rpc("community_solutions_list", { p_exam_id: CS35_MOD_EXAM_ID });
        const row = (
          l.data as Array<{ id: string; helpful_count: number; comment_count: number; is_pinned: boolean }> | null
        )?.find((r) => r.id === solutionId);
        return { error: l.error, row };
      }
      const listBeforeHideM = await listRowFor(userC, SOL_M);
      assert(
        !listBeforeHideM.error &&
          listBeforeHideM.row?.helpful_count === 2 &&
          listBeforeHideM.row?.comment_count === 3 &&
          listBeforeHideM.row?.is_pinned === true,
        `(nền) SOL_M published: helpful_count=2, comment_count=3, is_pinned=true (nhận ${JSON.stringify(listBeforeHideM.row)})`,
      );

      console.log("\nRLS checks (Community Solutions task 35 — admin group: non-admin refusal cho cả bốn hàm, AC-085):");

      await assertRefusedUnchanged(
        "AC-085: B (không phải admin) gọi admin_list_community_reports → 42501 'admin_list_community_reports: not an admin', không dữ liệu",
        CS35_MOD_EXAM_ID,
        () => userB.rpc("admin_list_community_reports"),
        refusedNotAdmin("admin_list_community_reports"),
      );
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_get_community_solution_notes → 42501 'admin_get_community_solution_notes: not an admin', không dữ liệu",
        CS35_MOD_EXAM_ID,
        () => userB.rpc("admin_get_community_solution_notes", { p_solution_id: SOL_M }),
        refusedNotAdmin("admin_get_community_solution_notes"),
      );
      // RED-phase discrimination proof (task file § Implementation Steps, Red
      // Phase): trước khi chốt, đã tạm đổi `userB` → `adminSession` ở lời gọi
      // ngay dưới đây, chạy lại toàn bộ test-rls.ts và xác nhận assertion này
      // chuyển ĐỎ (phiên admin thật thì ẩn được SOL_M: không lỗi, trạng thái
      // ĐÃ ĐỔI), rồi revert về đúng userB. Xem Investigation Notes của task 35.
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_moderate_community_solution('hide', lý do) → 42501 'admin_moderate_community_solution: not an admin'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(userB, SOL_M, "hide", "[RLS-CS35] B thử ẩn"),
        refusedNotAdmin("admin_moderate_community_solution"),
      );
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_moderate_community_solution('hide') với lý do RỖNG → vẫn 42501 'not an admin' (cổng admin chạy trước kiểm lý do)",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(userB, SOL_M, "hide", ""),
        refusedNotAdmin("admin_moderate_community_solution"),
      );
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_moderate_community_comment('hide', lý do) → 42501 'admin_moderate_community_comment: not an admin'",
        CS35_MOD_EXAM_ID,
        () => moderateComment(userB, COMMENT_MC, "hide", "[RLS-CS35] B thử ẩn"),
        refusedNotAdmin("admin_moderate_community_comment"),
      );
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_moderate_community_solution('delete', lý do) → 42501 'admin_moderate_community_solution: not an admin', bài giải không bị xoá",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(userB, SOL_M, "delete", "[RLS-CS35] B thử xoá"),
        refusedNotAdmin("admin_moderate_community_solution"),
      );
      await assertRefusedUnchanged(
        "AC-085: B gọi admin_moderate_community_comment('delete', lý do) → 42501 'admin_moderate_community_comment: not an admin', bình luận không bị xoá",
        CS35_MOD_EXAM_ID,
        () => moderateComment(userB, COMMENT_MC, "delete", "[RLS-CS35] B thử xoá"),
        refusedNotAdmin("admin_moderate_community_comment"),
      );

      console.log(
        "\nRLS checks (Community Solutions task 35 — admin_moderate_community_solution: lý do / chuyển trạng thái / hành động lạ, AC-017/AC-082/AC-106):",
      );

      const solutionReasonRequired = rejected22023("admin_moderate_community_solution: reason required");
      const solutionInvalidTransition = rejected22023("admin_moderate_community_solution: invalid transition");
      for (const action of ["hide", "delete"]) {
        for (const reason of ["", "   ", null]) {
          await assertRefusedUnchanged(
            `admin_moderate_community_solution('${action}') với lý do ${JSON.stringify(reason)} → 22023 'reason required'`,
            CS35_MOD_EXAM_ID,
            () => moderateSolution(adminSession, SOL_M, action, reason),
            solutionReasonRequired,
          );
        }
      }
      await assertRefusedUnchanged(
        "admin_moderate_community_solution('restore') trên bài giải PUBLISHED → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M, "restore", null),
        solutionInvalidTransition,
      );
      await assertRefusedUnchanged(
        "admin_moderate_community_solution('purge') → 22023 'invalid action'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M, "purge", "[RLS-CS35] hành động lạ"),
        rejected22023("admin_moderate_community_solution: invalid action"),
      );
      await assertRefusedUnchanged(
        "AC-017: admin_moderate_community_solution('hide') trên bài giải NHÁP → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M_DRAFT, "hide", "[RLS-CS35] ẩn nháp"),
        solutionInvalidTransition,
      );
      await assertRefusedUnchanged(
        "AC-017: admin_moderate_community_solution('restore') trên bài giải NHÁP → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M_DRAFT, "restore", null),
        solutionInvalidTransition,
      );
      await assertRefusedUnchanged(
        "AC-017: admin_moderate_community_solution('delete') trên bài giải NHÁP → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M_DRAFT, "delete", "[RLS-CS35] xoá nháp"),
        solutionInvalidTransition,
      );

      console.log("\nRLS checks (Community Solutions task 35 — admin_moderate_community_solution success + SN-1 re-run task 05/16):");

      const logsBeforeHideM = (await logRowsFor(SOL_M)).length;
      const hideM = await moderateSolution(adminSession, SOL_M, "hide", "[RLS-CS35] Ẩn SOL_M");
      const logsAfterHideM = await logRowsFor(SOL_M);
      const hideMLog = logsAfterHideM[logsAfterHideM.length - 1];
      assert(
        !hideM.error &&
          JSON.stringify(hideM.data) === JSON.stringify([{ status: "hidden" }]) &&
          (await solutionStatusOf(SOL_M)) === "hidden" &&
          logsAfterHideM.length === logsBeforeHideM + 1 &&
          hideMLog?.target_type === "solution" &&
          hideMLog?.action === "hide" &&
          hideMLog?.exam_id === CS35_MOD_EXAM_ID &&
          hideMLog?.target_user_id === userBId &&
          hideMLog?.actor_id === adminUserId &&
          hideMLog?.reason === "[RLS-CS35] Ẩn SOL_M",
        `admin_moderate_community_solution('hide', lý do) → [{ status: 'hidden' }], đúng MỘT dòng log target_type='solution' (người viết, đề, admin, lý do) (nhận ${JSON.stringify(hideM.data)} / log ${logsBeforeHideM}→${logsAfterHideM.length} ${JSON.stringify(hideMLog)})`,
      );

      // SN-1 — task 05: save_community_solution trên bài giải bị admin ẩn THẬT.
      const saveWhileHiddenM = await userB.rpc("save_community_solution", {
        p_exam_id: CS35_MOD_EXAM_ID,
        p_attempt_id: attemptsM[userBId],
        p_show_profile: true,
        p_show_score: false,
        p_notes: [],
      });
      assert(
        saveWhileHiddenM.error?.code === "42501" &&
          !saveWhileHiddenM.error?.details &&
          (await solutionStatusOf(SOL_M)) === "hidden",
        `SN-1 (task 05, qua RPC admin thật): bài giải bị admin_moderate_community_solution ẩn → save_community_solution 42501 KHÔNG có DETAIL, vẫn 'hidden' (nhận: mã=${saveWhileHiddenM.error?.code}, DETAIL=${JSON.stringify(saveWhileHiddenM.error?.details)})`,
      );

      // SN-1 — task 16 (S7/AC-071/AC-063, nhánh hidden).
      const ownPreviewHiddenM = await detailOf(userB, SOL_M);
      assert(
        !ownPreviewHiddenM.error &&
          ownPreviewHiddenM.questions.length > 0 &&
          ownPreviewHiddenM.questions.every((q) => q.comment_count === null && q.comments.length === 0),
        `SN-1 (task 16 S7/AC-071/AC-063, qua RPC admin thật): own-preview của người viết B — comments rỗng, comment_count null cho MỌI câu, kể cả câu có bình luận CỦA CHÍNH B (nhận ${JSON.stringify(ownPreviewHiddenM.questions.map((q) => [q.comment_count, q.comments.length]))})`,
      );
      const otherReadsHiddenM = await detailOf(userC, SOL_M);
      assert(
        otherReadsHiddenM.rowCount === 0,
        `SN-1 (task 16 S7): người khác (C) không đọc được bài giải bị ẩn ở detail (nhận ${otherReadsHiddenM.rowCount} dòng)`,
      );

      await assertRefusedUnchanged(
        "admin_moderate_community_solution('hide') trên bài giải đã HIDDEN → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateSolution(adminSession, SOL_M, "hide", "[RLS-CS35] ẩn lần hai"),
        solutionInvalidTransition,
      );

      const logsBeforeRestoreM = (await logRowsFor(SOL_M)).length;
      const restoreM = await moderateSolution(adminSession, SOL_M, "restore", null);
      const logsAfterRestoreM = await logRowsFor(SOL_M);
      const restoreMLog = logsAfterRestoreM[logsAfterRestoreM.length - 1];
      assert(
        !restoreM.error &&
          JSON.stringify(restoreM.data) === JSON.stringify([{ status: "published" }]) &&
          (await solutionStatusOf(SOL_M)) === "published" &&
          logsAfterRestoreM.length === logsBeforeRestoreM + 1 &&
          restoreMLog?.target_type === "solution" &&
          restoreMLog?.action === "restore" &&
          restoreMLog?.reason === null,
        `admin_moderate_community_solution('restore') KHÔNG lý do → [{ status: 'published' }], đúng MỘT dòng log (reason null) (nhận ${JSON.stringify(restoreM.data)}, mã lỗi ${restoreM.error?.code}, log ${logsBeforeRestoreM}→${logsAfterRestoreM.length})`,
      );
      const listAfterRestoreM = await listRowFor(userC, SOL_M);
      assert(
        !listAfterRestoreM.error &&
          listAfterRestoreM.row?.helpful_count === listBeforeHideM.row?.helpful_count &&
          listAfterRestoreM.row?.comment_count === listBeforeHideM.row?.comment_count &&
          listAfterRestoreM.row?.is_pinned === listBeforeHideM.row?.is_pinned,
        `AC-082: sau 'hide' → 'restore', community_solutions_list trả lại ĐÚNG helpful_count/comment_count/is_pinned như trước khi ẩn (nhận ${JSON.stringify(listAfterRestoreM.row)}, trước ${JSON.stringify(listBeforeHideM.row)})`,
      );
      const writerAfterRestoreM = await detailOf(userB, SOL_M);
      const writerQ1AfterRestoreM = questionIn(writerAfterRestoreM.questions, M_Q1);
      assert(
        writerQ1AfterRestoreM?.comment_count === 3 && writerQ1AfterRestoreM?.comments.length === 3,
        `SN-1 (task 16 S7, hidden → 'restore' thật): người viết đọc lại đúng comment_count/comments như trước (nhận ${JSON.stringify(writerQ1AfterRestoreM?.comment_count)} / ${writerQ1AfterRestoreM?.comments.length})`,
      );

      console.log(
        "\nRLS checks (Community Solutions task 35 — admin_moderate_community_comment: lý do / chuyển trạng thái / success + SN-1 re-run task 16/27, AC-107/AC-108):",
      );

      const commentReasonRequired = rejected22023("admin_moderate_community_comment: reason required");
      const commentInvalidTransition = rejected22023("admin_moderate_community_comment: invalid transition");
      for (const action of ["hide", "delete"]) {
        for (const reason of ["", "   ", null]) {
          await assertRefusedUnchanged(
            `admin_moderate_community_comment('${action}') với lý do ${JSON.stringify(reason)} → 22023 'reason required'`,
            CS35_MOD_EXAM_ID,
            () => moderateComment(adminSession, COMMENT_MC, action, reason),
            commentReasonRequired,
          );
        }
      }
      await assertRefusedUnchanged(
        "admin_moderate_community_comment('restore') trên bình luận VISIBLE → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateComment(adminSession, COMMENT_MC, "restore", null),
        commentInvalidTransition,
      );
      await assertRefusedUnchanged(
        "admin_moderate_community_comment('purge') → 22023 'invalid action'",
        CS35_MOD_EXAM_ID,
        () => moderateComment(adminSession, COMMENT_MC, "purge", "[RLS-CS35] hành động lạ"),
        rejected22023("admin_moderate_community_comment: invalid action"),
      );

      async function moderateCommentLogged(action: string, commentId: string, reason: string | null) {
        const before = (await logRowsFor(commentId)).length;
        const res = await moderateComment(adminSession, commentId, action, reason);
        const logs = await logRowsFor(commentId);
        return { res, logDelta: logs.length - before, lastLog: logs[logs.length - 1] };
      }
      function commentLogMatches(log: LogRow | undefined, action: string, commenterId: string): boolean {
        return (
          log?.target_type === "comment" &&
          log?.action === action &&
          log?.target_user_id === commenterId &&
          log?.exam_id === CS35_MOD_EXAM_ID &&
          log?.actor_id === adminUserId
        );
      }

      const hideMC = await moderateCommentLogged("hide", COMMENT_MC, "spam");
      assert(
        !hideMC.res.error &&
          JSON.stringify(hideMC.res.data) === JSON.stringify([{ status: "hidden" }]) &&
          (await commentStatusOf(COMMENT_MC)) === "hidden" &&
          hideMC.logDelta === 1 &&
          commentLogMatches(hideMC.lastLog, "hide", userCId) &&
          hideMC.lastLog?.reason === "spam",
        `admin_moderate_community_comment('hide', 'spam') → [{ status: 'hidden' }], đúng MỘT dòng log target_type='comment', target_user_id = người bình luận C, exam_id = đề của bài giải (nhận ${JSON.stringify(hideMC.res.data)}, log +${hideMC.logDelta} ${JSON.stringify(hideMC.lastLog)})`,
      );

      // SN-1 — task 16 (S19/AC-107): bình luận bị admin ẩn THẬT trong detail.
      const commenterReadsHidden = await detailOf(userC, SOL_M);
      const hiddenRowForCommenter = questionIn(commenterReadsHidden.questions, M_Q1)?.comments.find((c) => c.id === COMMENT_MC);
      assert(
        hiddenRowForCommenter?.is_hidden_by_admin === true &&
          hiddenRowForCommenter?.hidden_reason === "spam" &&
          typeof hiddenRowForCommenter?.body === "string",
        `SN-1 (task 16 S19/AC-107, qua RPC admin thật): tác giả bình luận (C) vẫn đọc được nó, is_hidden_by_admin=true, hidden_reason='spam' (nhận ${JSON.stringify(hiddenRowForCommenter)})`,
      );
      const writerReadsHiddenComment = questionIn((await detailOf(userB, SOL_M)).questions, M_Q1);
      const thirdReadsHiddenComment = questionIn((await detailOf(userD, SOL_M)).questions, M_Q1);
      assert(
        writerReadsHiddenComment?.comment_count === 2 &&
          !writerReadsHiddenComment.comments.some((c) => c.id === COMMENT_MC) &&
          thirdReadsHiddenComment?.comment_count === 2 &&
          !thirdReadsHiddenComment.comments.some((c) => c.id === COMMENT_MC),
        `SN-1 (task 16 S19/AC-107): người viết (B) và người đọc thứ ba (D) KHÔNG thấy bình luận bị ẩn, comment_count=2 (nhận writer=${writerReadsHiddenComment?.comment_count}, third=${thirdReadsHiddenComment?.comment_count})`,
      );

      // SN-1 — task 27 (S19): bình luận của chính mình đã bị admin ẩn THẬT.
      const deleteOwnHiddenMC = await userC.rpc("delete_community_comment", { p_comment_id: COMMENT_MC });
      assert(
        deleteOwnHiddenMC.error?.code === "42501" && (await commentStatusOf(COMMENT_MC)) === "hidden",
        `SN-1 (task 27 (b) S19, qua RPC admin thật): C xoá bình luận của chính mình đã bị ẩn → 42501, dòng còn nguyên, status='hidden' (nhận ${deleteOwnHiddenMC.error?.code})`,
      );

      await assertRefusedUnchanged(
        "admin_moderate_community_comment('hide') trên bình luận đã HIDDEN → 22023 'invalid transition'",
        CS35_MOD_EXAM_ID,
        () => moderateComment(adminSession, COMMENT_MC, "hide", "[RLS-CS35] ẩn lần hai"),
        commentInvalidTransition,
      );

      const restoreMC = await moderateCommentLogged("restore", COMMENT_MC, null);
      assert(
        !restoreMC.res.error &&
          JSON.stringify(restoreMC.res.data) === JSON.stringify([{ status: "visible" }]) &&
          (await commentStatusOf(COMMENT_MC)) === "visible" &&
          restoreMC.logDelta === 1 &&
          commentLogMatches(restoreMC.lastLog, "restore", userCId) &&
          restoreMC.lastLog?.reason === null,
        `admin_moderate_community_comment('restore') KHÔNG lý do → [{ status: 'visible' }], đúng MỘT dòng log (nhận ${JSON.stringify(restoreMC.res.data)}, log +${restoreMC.logDelta})`,
      );
      const rehideMC = await moderateCommentLogged("hide", COMMENT_MC, "abuse");
      const commenterRereads = await detailOf(userC, SOL_M);
      const rehiddenRow = questionIn(commenterRereads.questions, M_Q1)?.comments.find((c) => c.id === COMMENT_MC);
      assert(
        !rehideMC.res.error && rehideMC.logDelta === 1 && rehiddenRow?.hidden_reason === "abuse",
        `SN-1 (task 16 S19): 'restore' rồi 'hide' lần hai với lý do 'abuse' (RPC thật) → hidden_reason đọc lại đúng lý do MỚI NHẤT (nhận ${JSON.stringify(rehiddenRow)})`,
      );
      const finalRestoreMC = await moderateCommentLogged("restore", COMMENT_MC, null);
      if (finalRestoreMC.res.error) throw new Error(`restore COMMENT_MC: ${finalRestoreMC.res.error.message}`);
      const everyoneAfterRestore = await Promise.all([userB, userC, userD].map((client) => detailOf(client, SOL_M)));
      assert(
        everyoneAfterRestore.every((d) => {
          const q1 = questionIn(d.questions, M_Q1);
          const row = q1?.comments.find((c) => c.id === COMMENT_MC);
          return q1?.comment_count === 3 && row?.is_hidden_by_admin === false && row?.hidden_reason === null;
        }),
        `S19/AC-107: sau 'restore' cuối, mọi người đọc đủ điều kiện (B/C/D) đều thấy bình luận, is_hidden_by_admin=false, hidden_reason=null, comment_count=3`,
      );

      await mustSucceed(
        "C báo cáo bình luận của D",
        userC.rpc("report_community_comment", { p_comment_id: COMMENT_MD, p_reason: "[RLS-CS35] báo cáo trước khi xoá" }),
      );
      const reportsOnMDBefore = await reportsOnComment(COMMENT_MD);
      const deleteMD = await moderateCommentLogged("delete", COMMENT_MD, "[RLS-CS35] Xoá bình luận của D");
      assert(
        !deleteMD.res.error &&
          JSON.stringify(deleteMD.res.data) === JSON.stringify([{ status: "deleted" }]) &&
          (await commentStatusOf(COMMENT_MD)) === null &&
          reportsOnMDBefore === 1 &&
          (await reportsOnComment(COMMENT_MD)) === 0 &&
          deleteMD.logDelta === 1 &&
          commentLogMatches(deleteMD.lastLog, "delete", userDId),
        `admin_moderate_community_comment('delete', lý do) → [{ status: 'deleted' }], dòng bình luận mất, community_content_reports của nó mất (${reportsOnMDBefore}→0), dòng log (comment, người bình luận D, đề) VẪN còn, đúng một dòng (nhận ${JSON.stringify(deleteMD.res.data)}, log +${deleteMD.logDelta} ${JSON.stringify(deleteMD.lastLog)})`,
      );

      console.log("\nRLS checks (Community Solutions task 35 — admin_moderate_community_solution('delete'): AC-084 cascade + log):");

      async function dependentsOf(solutionId: string, commentId: string) {
        const count = async (table: string, column: string, value: string) =>
          (await admin.from(table).select("*", { count: "exact", head: true }).eq(column, value)).count ?? -1;
        return {
          solution: await count("community_solutions", "id", solutionId),
          notes: await count("community_solution_notes", "solution_id", solutionId),
          helpfuls: await count("community_solution_helpfuls", "solution_id", solutionId),
          comments: await count("community_solution_comments", "solution_id", solutionId),
          solutionReports: await count("community_content_reports", "solution_id", solutionId),
          commentReports: await count("community_content_reports", "comment_id", commentId),
        };
      }
      const dependentsBefore = await dependentsOf(SOL_M_DEL_PUB, COMMENT_DEL_PUB);
      const deletePub = await moderateSolution(adminSession, SOL_M_DEL_PUB, "delete", "[RLS-CS35] Xoá hẳn (AC-084)");
      const dependentsAfter = await dependentsOf(SOL_M_DEL_PUB, COMMENT_DEL_PUB);
      const deletePubLogs = await logRowsFor(SOL_M_DEL_PUB);
      assert(
        JSON.stringify(dependentsBefore) ===
          JSON.stringify({ solution: 1, notes: 3, helpfuls: 1, comments: 1, solutionReports: 1, commentReports: 1 }),
        `AC-084 (trước): bài giải published có đủ ghi chú/Hữu ích/bình luận/báo cáo (nhận ${JSON.stringify(dependentsBefore)})`,
      );
      assert(
        !deletePub.error &&
          JSON.stringify(deletePub.data) === JSON.stringify([{ status: "deleted" }]) &&
          Object.values(dependentsAfter).every((n) => n === 0),
        `AC-084: admin_moderate_community_solution('delete') trên bài giải PUBLISHED → [{ status: 'deleted' }], bài giải + MỌI ghi chú/Hữu ích/bình luận/báo cáo phụ thuộc đều mất (nhận ${JSON.stringify(deletePub.data)}, mã lỗi ${deletePub.error?.code}, sau ${JSON.stringify(dependentsAfter)})`,
      );
      assert(
        deletePubLogs.length === 1 &&
          deletePubLogs[0].target_type === "solution" &&
          deletePubLogs[0].action === "delete" &&
          deletePubLogs[0].exam_id === CS35_MOD_EXAM_ID &&
          deletePubLogs[0].target_user_id === userDId &&
          deletePubLogs[0].reason === "[RLS-CS35] Xoá hẳn (AC-084)",
        `AC-084: đúng MỘT dòng community_moderation_log cho bài giải đã xoá, exam_id và target_user_id KHÔNG null (chụp trước khi xoá) (nhận ${JSON.stringify(deletePubLogs)})`,
      );

      const hideBeforeDelete = await moderateSolution(adminSession, SOL_M_DEL_HID, "hide", "[RLS-CS35] Ẩn trước khi xoá");
      const deleteHidden = await moderateSolution(adminSession, SOL_M_DEL_HID, "delete", "[RLS-CS35] Xoá hẳn bài đã ẩn");
      const deleteHiddenLogs = await logRowsFor(SOL_M_DEL_HID);
      assert(
        !hideBeforeDelete.error &&
          !deleteHidden.error &&
          JSON.stringify(deleteHidden.data) === JSON.stringify([{ status: "deleted" }]) &&
          (await solutionStatusOf(SOL_M_DEL_HID)) === null &&
          deleteHiddenLogs.length === 2 &&
          deleteHiddenLogs.map((l) => l.action).join(",") === "hide,delete" &&
          deleteHiddenLogs.every((l) => l.target_type === "solution" && l.exam_id === CS35_MOD_EXAM_ID && l.target_user_id === userAId),
        `AC-106: admin_moderate_community_solution('delete') trên bài giải HIDDEN → [{ status: 'deleted' }], dòng mất; đúng một dòng log cho MỖI lời gọi được chấp nhận (hide, delete) (nhận ${JSON.stringify(deleteHidden.data)}, mã lỗi ${deleteHidden.error?.code}, log ${JSON.stringify(deleteHiddenLogs.map((l) => l.action))})`,
      );

      // ------------------------------------------------------------------------
      // Hàng đợi admin + ghi chú cho admin — đề rls-cs35-queue. SOL_Q (A,
      // show_profile=true), SOL_H (B, show_profile=false), SOL_NR (C, chưa bao
      // giờ bị báo cáo), SOL_N (D, nháp, ghi chú câu 1 và 3).
      // ------------------------------------------------------------------------
      console.log("\nCommunity Solutions (task 35) — fixture hàng đợi admin (đề rls-cs35-queue)…");
      const attemptsQ = await setupCs35Exam(CS35_QUEUE_EXAM_ID);
      const [X3_Q1, X3_Q2, X3_Q3] = cs35QuestionIds(CS35_QUEUE_EXAM_ID);
      const NOTE_BODY_Q1 = `[RLS-CS35] ghi chú câu 1 — ${csWords(15)}`;
      const NOTE_BODY_Q3 = `[RLS-CS35] ghi chú câu 3 — ${csWords(15)}`;
      const SOL_N = await insertCs35Solution({
        examId: CS35_QUEUE_EXAM_ID,
        authorId: userDId,
        status: "draft",
        showProfile: true,
        attemptId: attemptsQ[userDId],
        notes: [
          { questionId: X3_Q1, body: NOTE_BODY_Q1 },
          { questionId: X3_Q3, body: NOTE_BODY_Q3 },
        ],
      });
      const SOL_Q = await insertCs35Solution({
        examId: CS35_QUEUE_EXAM_ID,
        authorId: userAId,
        status: "published",
        showProfile: true,
        attemptId: attemptsQ[userAId],
        notes: fullNotes(CS35_QUEUE_EXAM_ID),
      });
      const SOL_H = await insertCs35Solution({
        examId: CS35_QUEUE_EXAM_ID,
        authorId: userBId,
        status: "published",
        showProfile: false,
        attemptId: attemptsQ[userBId],
        notes: fullNotes(CS35_QUEUE_EXAM_ID),
      });
      const SOL_NR = await insertCs35Solution({
        examId: CS35_QUEUE_EXAM_ID,
        authorId: userCId,
        status: "published",
        showProfile: true,
        attemptId: attemptsQ[userCId],
        notes: fullNotes(CS35_QUEUE_EXAM_ID),
      });

      console.log("\nRLS checks (Community Solutions task 35 — Admin notes shape, RCV #16 / AC-081):");

      const adminAttemptsOnQueueExam = await admin
        .from("exam_attempts")
        .select("id", { count: "exact", head: true })
        .eq("exam_id", CS35_QUEUE_EXAM_ID)
        .eq("user_id", adminUserId);
      const adminNotes = await adminSession.rpc("admin_get_community_solution_notes", { p_solution_id: SOL_N });
      const adminNoteRows = (adminNotes.data as Array<Record<string, unknown>> | null) ?? [];
      const expectedNoteKeys = JSON.stringify(["body", "question_id", "question_number"]);
      assert(
        !adminNotes.error &&
          adminNoteRows.length === 2 &&
          adminNoteRows.every((row) => JSON.stringify(Object.keys(row).sort()) === expectedNoteKeys),
        `Admin notes shape (RCV #16): đúng 2 dòng, khoá mỗi dòng ĐÚNG BẰNG {question_number, question_id, body} — set-equal cả hai chiều (nhận ${adminNotes.error?.code ?? JSON.stringify(adminNoteRows.map((r) => Object.keys(r)))})`,
      );
      assert(
        JSON.stringify(adminNoteRows.map((row) => row.question_number)) === JSON.stringify([1, 3]) &&
          adminNoteRows[0]?.question_id === X3_Q1 &&
          adminNoteRows[1]?.question_id === X3_Q3 &&
          adminNoteRows[0]?.body === NOTE_BODY_Q1 &&
          adminNoteRows[1]?.body === NOTE_BODY_Q3,
        `Admin notes shape (RCV #16): question_number = [1, 3] ĐÚNG THỨ TỰ (không có câu 2), question_id là id câu ở đúng vị trí, body là nguyên văn ghi chú (nhận ${JSON.stringify(adminNoteRows)})`,
      );
      assert(
        adminAttemptsOnQueueExam.count === 0,
        `Admin notes shape (AC-081): admin KHÔNG có lượt làm nào trên đề này mà vẫn đọc được (nhận ${adminAttemptsOnQueueExam.count} lượt)`,
      );
      await assertRefusedUnchanged(
        "Admin notes shape: B (không phải admin) → 42501 'admin_get_community_solution_notes: not an admin'",
        CS35_QUEUE_EXAM_ID,
        () => userB.rpc("admin_get_community_solution_notes", { p_solution_id: SOL_N }),
        refusedNotAdmin("admin_get_community_solution_notes"),
      );

      console.log("\nRLS checks (Community Solutions task 35 — Admin queue hidden comments, AC-047/AC-081/AC-107/AC-108/R17/S5/S19):");

      const QC1_BODY = "[RLS-CS35] Bình luận 1 (B) — bị báo cáo, vẫn hiện";
      const QC2_BODY = "[RLS-CS35] Bình luận 2 (C) — hai người báo cáo, sẽ bị ẩn";
      const QC1 = await postCs35Comment(userB, { solutionId: SOL_Q, questionId: X3_Q1, body: QC1_BODY, isAnonymous: false });
      const QC2 = await postCs35Comment(userC, { solutionId: SOL_Q, questionId: X3_Q3, body: QC2_BODY, isAnonymous: false });
      await mustSucceed("C báo cáo QC1", userC.rpc("report_community_comment", { p_comment_id: QC1, p_reason: "[RLS-CS35] qc1" }));
      await mustSucceed("B báo cáo QC2", userB.rpc("report_community_comment", { p_comment_id: QC2, p_reason: "[RLS-CS35] qc2 b" }));
      await mustSucceed("D báo cáo QC2", userD.rpc("report_community_comment", { p_comment_id: QC2, p_reason: "[RLS-CS35] qc2 d" }));
      await mustSucceed("D báo cáo SOL_Q", userD.rpc("report_community_solution", { p_solution_id: SOL_Q, p_reason: "[RLS-CS35] sol q" }));

      const queueFirstRead = await adminSession.rpc("admin_list_community_reports");
      const rowQBefore = (queueFirstRead.data as QueueRow[] | null)?.find((row) => row.id === SOL_Q);
      assert(
        !queueFirstRead.error &&
          rowQBefore?.status === "published" &&
          rowQBefore?.report_count === 1 &&
          rowQBefore?.exam_id === CS35_QUEUE_EXAM_ID &&
          rowQBefore?.reported_comments.some((c) => c.id === QC1) === true &&
          rowQBefore?.reported_comments.some((c) => c.id === QC2) === true &&
          rowQBefore?.hidden_comments.length === 0,
        `admin_list_community_reports success (phiên admin): SOL_Q ở "Chờ xử lý" (published), report_count=1, cả hai bình luận bị báo cáo trong reported_comments, hidden_comments=[] (nhận ${queueFirstRead.error?.code ?? JSON.stringify(rowQBefore)})`,
      );

      const hideQC2Spam = await moderateComment(adminSession, QC2, "hide", "spam");
      if (hideQC2Spam.error) throw new Error(`hide QC2: ${hideQC2Spam.error.message}`);
      const hideQC2SpamLog = (await logRowsFor(QC2)).filter((l) => l.action === "hide").pop();
      const rowQAfterHide = await queueRowFor(SOL_Q);
      const qc2EntriesAfterHide = rowQAfterHide?.hidden_comments.filter((h) => h.id === QC2) ?? [];
      const qc2Entry = qc2EntriesAfterHide[0];
      assert(
        rowQAfterHide?.status === "published" &&
          rowQAfterHide?.report_count === rowQBefore?.report_count &&
          rowQAfterHide?.reported_comments.some((c) => c.id === QC1) === true &&
          rowQAfterHide?.reported_comments.some((c) => c.id === QC2) === false,
        `Admin queue: sau khi ẩn QC2, SOL_Q VẪN ở "Chờ xử lý" với CÙNG report_count cấp hàng, QC1 vẫn trong reported_comments, QC2 không còn ở đó (nhận ${JSON.stringify(rowQAfterHide && { status: rowQAfterHide.status, report_count: rowQAfterHide.report_count, reported: rowQAfterHide.reported_comments.map((c) => c.id) })})`,
      );
      assert(
        qc2EntriesAfterHide.length === 1 &&
          qc2Entry?.question_number === 3 &&
          qc2Entry?.body === QC2_BODY &&
          qc2Entry?.commenter_display_name === nameC &&
          qc2Entry?.commenter_is_anonymous_to_readers === false &&
          qc2Entry?.hidden_reason === "spam" &&
          sameInstant(qc2Entry?.hidden_at, hideQC2SpamLog?.created_at) &&
          qc2Entry?.report_count === 2,
        `Admin queue: QC2 xuất hiện ĐÚNG MỘT lần trong hidden_comments — id, question_number=3 (thứ tự hiện tại của đề), body, tên THẬT người bình luận, hidden_reason='spam', hidden_at = created_at của dòng log 'hide', report_count=2 (nhận ${JSON.stringify(qc2EntriesAfterHide)}, log ${hideQC2SpamLog?.created_at})`,
      );

      const restoreQC2 = await moderateComment(adminSession, QC2, "restore", null);
      const hideQC2Abuse = await moderateComment(adminSession, QC2, "hide", "abuse");
      if (restoreQC2.error || hideQC2Abuse.error) throw new Error("restore/hide QC2 thất bại");
      const hideQC2AbuseLog = (await logRowsFor(QC2)).filter((l) => l.action === "hide").pop();
      const qc2EntryAbuse = (await queueRowFor(SOL_Q))?.hidden_comments.filter((h) => h.id === QC2);
      assert(
        qc2EntryAbuse?.length === 1 &&
          qc2EntryAbuse[0].hidden_reason === "abuse" &&
          sameInstant(qc2EntryAbuse[0].hidden_at, hideQC2AbuseLog?.created_at) &&
          Date.parse(qc2EntryAbuse[0].hidden_at ?? "") > Date.parse(qc2Entry?.hidden_at ?? ""),
        `Admin queue: 'restore' rồi 'hide' lần hai với 'abuse' → entry mang 'abuse' và hidden_at MỚI hơn (nhận ${JSON.stringify(qc2EntryAbuse)}, trước ${qc2Entry?.hidden_at})`,
      );

      const dropQC1Report = await admin.from("community_content_reports").delete().eq("comment_id", QC1);
      const dropSolQReport = await admin.from("community_content_reports").delete().eq("solution_id", SOL_Q);
      if (dropQC1Report.error || dropSolQReport.error) throw new Error("xoá báo cáo fixture thất bại");
      const openReportsOnlyOnQC2 =
        (await reportsOnComment(QC1)) === 0 && (await reportsOnSolution(SOL_Q)) === 0 && (await reportsOnComment(QC2)) === 2;
      const rowQOnlyHiddenReported = await queueRowFor(SOL_Q);
      assert(
        openReportsOnlyOnQC2 &&
          rowQOnlyHiddenReported?.status === "published" &&
          rowQOnlyHiddenReported?.report_count === 0 &&
          rowQOnlyHiddenReported?.reported_comments.length === 0 &&
          rowQOnlyHiddenReported?.hidden_comments.filter((h) => h.id === QC2).length === 1,
        `Admin queue (AC-107/R17): báo cáo MỞ duy nhất nằm trên bình luận ĐÃ ẨN → hàng vẫn được trả, "Chờ xử lý", kèm tiểu mục hidden_comments (nhận ${JSON.stringify(rowQOnlyHiddenReported && { status: rowQOnlyHiddenReported.status, report_count: rowQOnlyHiddenReported.report_count, hidden: rowQOnlyHiddenReported.hidden_comments.map((h) => h.id) })})`,
      );

      const qc2EntryBeforeReorder = rowQOnlyHiddenReported?.hidden_comments.find((h) => h.id === QC2);
      const dropQ3FromExam = await admin.from("exams").update({ question_ids: [X3_Q1, X3_Q2] }).eq("id", CS35_QUEUE_EXAM_ID);
      if (dropQ3FromExam.error) throw dropQ3FromExam.error;
      const qc2EntryWithoutQ3 = (await queueRowFor(SOL_Q))?.hidden_comments.find((h) => h.id === QC2);
      const putQ3Back = await admin.from("exams").update({ question_ids: [X3_Q1, X3_Q2, X3_Q3] }).eq("id", CS35_QUEUE_EXAM_ID);
      if (putQ3Back.error) throw putQ3Back.error;
      assert(
        qc2EntryWithoutQ3 !== undefined &&
          qc2EntryWithoutQ3.question_number === null &&
          JSON.stringify({ ...qc2EntryWithoutQ3, question_number: 3 }) === JSON.stringify(qc2EntryBeforeReorder),
        `Admin queue (AC-047): bỏ câu của QC2 khỏi exams.question_ids → entry VẪN còn, question_number=null, mọi trường khác không đổi (nhận ${JSON.stringify(qc2EntryWithoutQ3)}, trước ${JSON.stringify(qc2EntryBeforeReorder)})`,
      );

      const restoreQC2Final = await moderateComment(adminSession, QC2, "restore", null);
      if (restoreQC2Final.error) throw new Error(`restore QC2: ${restoreQC2Final.error.message}`);
      const rowQAfterRestore = await queueRowFor(SOL_Q);
      const qc2Visible = rowQAfterRestore?.reported_comments.find((c) => c.id === QC2);
      assert(
        rowQAfterRestore?.hidden_comments.some((h) => h.id === QC2) === false &&
          qc2Visible?.report_count === 2 &&
          qc2Visible?.report_reasons.length === 2,
        `Admin queue: 'restore' đưa QC2 về danh sách bình luận HIỆN bị báo cáo, kèm đủ 2 báo cáo (nhận ${JSON.stringify(qc2Visible)})`,
      );

      // Một báo cáo bài giải mới để hàng còn trong hàng đợi sau khi QC2 (mang
      // mọi báo cáo bình luận còn lại) bị xoá hẳn — nhờ vậy "entry biến mất" đọc
      // được trên CHÍNH hàng đó chứ không phải do cả hàng rời hàng đợi.
      await mustSucceed("D báo cáo lại SOL_Q", userD.rpc("report_community_solution", { p_solution_id: SOL_Q, p_reason: "[RLS-CS35] sol q 2" }));
      const deleteQC2 = await moderateComment(adminSession, QC2, "delete", "[RLS-CS35] Xoá QC2");
      const rowQAfterDelete = await queueRowFor(SOL_Q);
      assert(
        !deleteQC2.error &&
          rowQAfterDelete !== undefined &&
          rowQAfterDelete.reported_comments.some((c) => c.id === QC2) === false &&
          rowQAfterDelete.hidden_comments.some((h) => h.id === QC2) === false &&
          (await reportsOnComment(QC2)) === 0,
        `Admin queue: 'delete' xoá entry QC2 khỏi cả hai danh sách và xoá luôn báo cáo của nó (nhận mã lỗi ${deleteQC2.error?.code}, hàng ${rowQAfterDelete ? "còn" : "MẤT"})`,
      );

      console.log(
        "\nRLS checks (Community Solutions task 35 — A hidden solution stays in the queue (RCV #26) + anonymity flags, AC-081/AC-082/AC-108/AC-109/R17/S5):",
      );

      const H1 = await postCs35Comment(userC, {
        solutionId: SOL_H,
        questionId: X3_Q1,
        body: "[RLS-CS35] Bình luận ẨN DANH của C trên SOL_H",
        isAnonymous: true,
      });
      const H2 = await postCs35Comment(userC, {
        solutionId: SOL_H,
        questionId: X3_Q2,
        body: "[RLS-CS35] Bình luận KHÔNG ẩn danh của C trên SOL_H",
        isAnonymous: false,
      });
      await mustSucceed("D báo cáo H1", userD.rpc("report_community_comment", { p_comment_id: H1, p_reason: "[RLS-CS35] h1" }));
      const rowHPublished = await queueRowFor(SOL_H);
      assert(
        rowHPublished?.status === "published" && (await reportsOnSolution(SOL_H)) === 0,
        `(nền) SOL_H ở "Chờ xử lý" chỉ nhờ báo cáo trên bình luận H1 — không có báo cáo nào trên chính bài giải (nhận ${rowHPublished?.status})`,
      );
      const hideH1 = await moderateComment(adminSession, H1, "hide", "[RLS-CS35] ẩn H1");
      const hideH2 = await moderateComment(adminSession, H2, "hide", "[RLS-CS35] ẩn H2");
      const hideH = await moderateSolution(adminSession, SOL_H, "hide", "[RLS-CS35] ẩn SOL_H");
      if (hideH1.error || hideH2.error || hideH.error) throw new Error("ẩn H1/H2/SOL_H thất bại");

      const queueAnonymityRead = await readQueue();
      const rowHHidden = queueAnonymityRead.find((row) => row.id === SOL_H);
      const rowQSameRead = queueAnonymityRead.find((row) => row.id === SOL_Q);
      const h1Entry = rowHHidden?.hidden_comments.find((h) => h.id === H1);
      const h2Entry = rowHHidden?.hidden_comments.find((h) => h.id === H2);
      assert(
        h1Entry?.commenter_display_name === nameC &&
          h1Entry?.commenter_is_anonymous_to_readers === true &&
          h2Entry?.commenter_display_name === nameC &&
          h2Entry?.commenter_is_anonymous_to_readers === false,
        `Anonymity flag (S5): bình luận ẩn danh bị ẩn → tên THẬT của C + commenter_is_anonymous_to_readers=true; bình luận không ẩn danh → CÙNG tên thật + cờ false (nhận h1=${JSON.stringify(h1Entry)}, h2=${JSON.stringify(h2Entry)})`,
      );
      assert(
        rowHHidden?.author_is_anonymous_to_readers === true &&
          rowHHidden?.author_display_name === nameB &&
          rowQSameRead?.author_is_anonymous_to_readers === false &&
          rowQSameRead?.author_display_name === nameA,
        `Anonymity flag (S5, cùng một lượt đọc): author_is_anonymous_to_readers = not show_profile — true cho SOL_H (show_profile=false), false cho SOL_Q; author_display_name là tên THẬT ở cả hai (nhận H=${JSON.stringify(rowHHidden && [rowHHidden.author_is_anonymous_to_readers, rowHHidden.author_display_name])}, Q=${JSON.stringify(rowQSameRead && [rowQSameRead.author_is_anonymous_to_readers, rowQSameRead.author_display_name])})`,
      );
      assert(
        rowHHidden?.status === "hidden" && rowHHidden?.report_count === 0 && rowHHidden?.hidden_comments.length === 2,
        `(nền RCV #26) SOL_H ở "Đã ẩn", report_count=0, hidden_comments có 2 entry (nhận ${JSON.stringify(rowHHidden && { status: rowHHidden.status, report_count: rowHHidden.report_count, hidden: rowHHidden.hidden_comments.length })})`,
      );

      const deleteH1 = await moderateComment(adminSession, H1, "delete", "[RLS-CS35] Xoá hẳn H1 (AC-108)");
      const rowHAfterDeleteH1 = await queueRowFor(SOL_H);
      assert(
        !deleteH1.error &&
          (await reportsOnComment(H1)) === 0 &&
          (await commentStatusOf(H1)) === null &&
          rowHAfterDeleteH1?.status === "hidden" &&
          rowHAfterDeleteH1?.report_count === 0 &&
          rowHAfterDeleteH1?.hidden_comments.length === 1 &&
          rowHAfterDeleteH1?.hidden_comments[0]?.id === H2,
        `RCV #26 (AC-082/AC-108): ẩn bài giải rồi xoá hẳn bình luận mang báo cáo mở CUỐI CÙNG → hàng VẪN được trả ở "Đã ẩn", report_count=0, hidden_comments ngắn đi đúng một entry — "Khôi phục" vẫn có chỗ (nhận ${rowHAfterDeleteH1 ? JSON.stringify({ status: rowHAfterDeleteH1.status, report_count: rowHAfterDeleteH1.report_count, hidden: rowHAfterDeleteH1.hidden_comments.map((h) => h.id) }) : "HÀNG MẤT"})`,
      );

      const restoreHNoReport = await moderateSolution(adminSession, SOL_H, "restore", null);
      assert(
        !restoreHNoReport.error &&
          JSON.stringify(restoreHNoReport.data) === JSON.stringify([{ status: "published" }]) &&
          (await queueRowFor(SOL_H)) === undefined,
        `RCV #26: 'restore' khi KHÔNG còn báo cáo nào (bài giải lẫn bình luận) → published và RỜI hàng đợi (nhận ${JSON.stringify(restoreHNoReport.data)})`,
      );

      await mustSucceed("D báo cáo SOL_H", userD.rpc("report_community_solution", { p_solution_id: SOL_H, p_reason: "[RLS-CS35] sol h" }));
      const rehideH = await moderateSolution(adminSession, SOL_H, "hide", "[RLS-CS35] ẩn SOL_H lần hai");
      const rowHRehidden = await queueRowFor(SOL_H);
      const restoreHWithReport = await moderateSolution(adminSession, SOL_H, "restore", null);
      const rowHRestoredWithReport = await queueRowFor(SOL_H);
      assert(
        !rehideH.error &&
          rowHRehidden?.status === "hidden" &&
          rowHRehidden?.report_count === 1 &&
          !restoreHWithReport.error &&
          rowHRestoredWithReport?.status === "published" &&
          rowHRestoredWithReport?.report_count === 1,
        `RCV #26: 'restore' khi CÒN một báo cáo → hàng ở lại, chuyển về "Chờ xử lý" (nhận ẩn=${rowHRehidden?.status}, sau restore=${rowHRestoredWithReport?.status ?? "HÀNG MẤT"})`,
      );

      const neverReportedBefore = await queueRowFor(SOL_NR);
      const hideNR = await moderateSolution(adminSession, SOL_NR, "hide", "[RLS-CS35] ẩn SOL_NR");
      const rowNRHidden = await queueRowFor(SOL_NR);
      const restoreNR = await moderateSolution(adminSession, SOL_NR, "restore", null);
      const rowNRRestored = await queueRowFor(SOL_NR);
      const rehideNR = await moderateSolution(adminSession, SOL_NR, "hide", "[RLS-CS35] ẩn SOL_NR lần hai");
      const rowNRRehidden = await queueRowFor(SOL_NR);
      const deleteNR = await moderateSolution(adminSession, SOL_NR, "delete", "[RLS-CS35] xoá hẳn SOL_NR");
      const rowNRDeleted = await queueRowFor(SOL_NR);
      assert(
        neverReportedBefore === undefined &&
          !hideNR.error &&
          rowNRHidden?.status === "hidden" &&
          rowNRHidden?.report_count === 0 &&
          !restoreNR.error &&
          rowNRRestored === undefined &&
          !rehideNR.error &&
          rowNRRehidden?.status === "hidden" &&
          !deleteNR.error &&
          rowNRDeleted === undefined &&
          (await reportsOnSolution(SOL_NR)) === 0,
        `RCV #26 (AC-109): bài giải CHƯA TỪNG bị báo cáo — ngoài hàng đợi → 'hide' vào "Đã ẩn" ngay → 'restore' rời hàng đợi → 'hide' lại vào → 'delete' rời hàng đợi (nhận trước=${neverReportedBefore ? "CÓ" : "không"}, ẩn=${rowNRHidden?.status}, restore=${rowNRRestored ? "CÒN" : "rời"}, ẩn lại=${rowNRRehidden?.status}, xoá=${rowNRDeleted ? "CÒN" : "rời"})`,
      );

      console.log("\nRLS checks (Community Solutions task 35 — Name-resolution regression, không 42702):");

      const nameResolutionCalls: Array<[string, RpcResult]> = [
        ["admin_moderate_community_solution('hide')", hideM],
        ["admin_moderate_community_solution('restore')", restoreM],
        ["admin_moderate_community_solution('delete')", deletePub],
        ["admin_moderate_community_comment('hide')", hideMC.res],
        ["admin_moderate_community_comment('restore')", restoreMC.res],
        ["admin_moderate_community_comment('delete')", deleteMD.res],
        ["report_community_solution", reportSolutionFirst],
        ["report_community_comment", reportCommentFirst],
      ];
      for (const [label, res] of nameResolutionCalls) {
        assert(
          res.error === null,
          `Name-resolution regression: ${label} chạy đường thành công không lỗi — nhất là không 42702 (nhận ${res.error?.code ?? "không lỗi"})`,
        );
      }

      part13Completed = true;
    } finally {
      // Thu hồi RIÊNG phiên admin này trước (scope 'local' — không đăng xuất các
      // phiên khác của tài khoản admin); dọn fixture chỉ dùng setup client.
      const adminSignOut = await adminSession.auth.signOut({ scope: "local" });
      if (adminSignOut.error) console.error("❌ Phần 13: thu hồi phiên admin thất bại:", adminSignOut.error.message);
      try {
        await cleanupCs35Fixtures(admin);
      } catch (cleanupError) {
        // Đang thoát vì lỗi gốc: chỉ ghi log để lỗi gốc (và stack của nó) được ném tiếp.
        if (part13Completed) throw cleanupError;
        console.error("❌ Phần 13: dọn fixture task 35 thất bại sau lỗi gốc:", cleanupError);
      }
    }
  }

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
