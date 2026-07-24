// Test RLS (GĐ 2 M2.7 + UGC v2.0 Gate A) — kiểm tra cách ly dữ liệu.
//
// Phần 1 (cũ): cách ly attempt giữa 2 user + chặn truy cập chưa auth.
// Phần 2 (UGC v2.0, Task 1.2): cases R-a…R-o từ Design Doc §Test Strategy —
//   cách ly exam/question/report chưa published (bảng + Storage), positive
//   controls, write policies tác giả, backfill. ĐÂY LÀ GATE A (ADR-0001 kill
//   criterion) — không sang Phase 4/5/6 khi chưa xanh.
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

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const PASSWORD = "rls-test-password-123";
const EXAM_ID = "exam-toan-10";
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

/** Xóa sạch fixture UGC (chạy trước VÀ sau để idempotent). */
async function cleanupUgcFixtures(admin: SupabaseClient) {
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
  await ensureUser(admin, EMAIL_B);

  const userA = await signInAs(url, anon, EMAIL_A); // TÁC GIẢ
  const userB = await signInAs(url, anon, EMAIL_B); // non-author
  const anonClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ==========================================================================
  // Phần 1 — attempts (GĐ 2 M2.7, giữ nguyên)
  // ==========================================================================

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

  // Dọn dẹp: A xóa attempt test.
  await userA.from("exam_attempts").delete().eq("id", attemptId);

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
