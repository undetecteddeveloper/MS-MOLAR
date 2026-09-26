// Community Solutions — `community_reputation_summary()` (task 41, P5-T2; the
// task tests its OWN migration — backend DD v1.9 § Integration Verification
// Points "Reputation fixed vector", binding "Task ownership"). Làn SERVICE
// (Postgres dev THẬT, không mock) — `describe.skipIf(!HAS_LIVE_DB)`, cùng tiền
// lệ `community-solutions-list-order.localdb.test.ts` (task 16).
//
// Phủ: Reference Contract Value #4 (công thức AC-086, tính lại mỗi lần đọc) và
// #25 (bộ vector cố định 84 → 104 → 74 → 104 → 54 → 104 → 74, cả bốn trường
// sau MỖI chặng), AC-088 (huy hiệu rơi 5 → 4 → 5 qua cả gỡ về nháp lẫn admin
// ẩn/khôi phục), AC-090 (0 bài đã đăng → mọi trường = 0, không null, không lỗi),
// AC-089 (không có tham số người dùng đích; anon không gọi được).
//
// Mọi lượt đổi trạng thái đi qua đúng RPC sản phẩm dùng: người viết
// `set_community_solution_status`, tác giả đề `set_community_solution_pin`,
// admin `admin_moderate_community_solution` (phiên `authenticated` THẬT của
// admin đã seed — cùng cách `signInAsSeededAdmin` của `supabase/test-rls.ts`,
// không service-role RPC nào, TD-029).
//
// Chạy: `npm run test:localdb` (từ SOURCE/), với `--exclude` cho skeleton
// `community-solutions.service.e2e.test.ts` (R1, còn comment-only tới task 47).
// Tiền đề: `npm run verify:schema` XANH TRÊN DEV trước khi chạy.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

const PASSWORD = "cs41rep-password-123";

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

interface Reputation {
  total_score: number;
  published_count: number;
  helpful_count: number;
  pinned_count: number;
}

interface Student {
  id: string;
  client: SupabaseClient;
}

/** Sinh đúng `n` từ (đếm bằng khoảng trắng, khớp `count_words`) — cùng công
 *  thức `csWords` của `supabase/test-rls.ts`. */
function csWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `tu${i + 1}`).join(" ");
}

function emailOf(prefix: string, slot: string): string {
  return `${prefix}${slot}@example.com`;
}

async function createUserId(admin: SupabaseClient, email: string): Promise<string> {
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;
  return created.data.user.id;
}

async function createStudent(admin: SupabaseClient, email: string): Promise<Student> {
  const id = await createUserId(admin, email);
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id, client };
}

/** Phiên `authenticated` THẬT của admin đã seed trong `admin_users` — cùng cách
 *  `signInAsSeededAdmin` của `supabase/test-rls.ts`: service role chỉ sinh một
 *  token magic-link, một anon client MỚI tự đổi token đó lấy JWT của đúng user
 *  admin. Không có id nào đã seed thì dừng: đó là thiếu seed out-of-band của
 *  task 03, không phải lỗi code. */
async function signInAsSeededAdmin(admin: SupabaseClient): Promise<SupabaseClient> {
  const configuredIds = (process.env.ADMIN_USER_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const seeded = await admin.from("admin_users").select("user_id").in("user_id", configuredIds);
  if (seeded.error) throw seeded.error;
  const userId = (seeded.data?.[0] as { user_id: string } | undefined)?.user_id;
  if (!userId) {
    throw new Error("admin_users không chứa id nào của ADMIN_USER_IDS — chạy lại seed out-of-band của task 03, KHÔNG sửa test");
  }
  const user = await admin.auth.admin.getUserById(userId);
  if (user.error) throw user.error;
  const email = user.data.user.email;
  if (!email) throw new Error("User admin đã seed không có email — không đăng nhập bằng magic link được");
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw link.error;
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const verified = await client.auth.verifyOtp({ token_hash: link.data.properties.hashed_token, type: "magiclink" });
  if (verified.error) throw verified.error;
  return client;
}

async function submittedAttempt(admin: SupabaseClient, userId: string, examId: string): Promise<void> {
  const res = await admin
    .from("exam_attempts")
    .insert({ user_id: userId, exam_id: examId, status: "submitted", submitted_at: new Date().toISOString() });
  if (res.error) throw res.error;
}

/** Một đề published một câu, do `authorId` viết, tác giả đã nộp (cổng ghim). */
async function createExam(admin: SupabaseClient, examId: string, authorId: string): Promise<string> {
  const questionId = `${examId}-q1`;
  const q = await admin.from("questions").insert({
    id: questionId,
    content: `[CS41] ${examId}`,
    choices: MCQ_CHOICES,
    correct_answer: "A",
    subject: "Toán",
    grade: 10,
    topic: "Toán",
  });
  if (q.error) throw q.error;
  const exam = await admin.from("exams").insert({
    id: examId,
    title: `[CS41] ${examId}`,
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "Author",
    question_ids: [questionId],
    status: "published",
  });
  if (exam.error) throw exam.error;
  await submittedAttempt(admin, authorId, examId);
  return questionId;
}

/** Bài giải ĐÃ ĐĂNG của `writer` trên `examId`, ghi chú 15 từ (đủ để người viết
 *  tự đăng lại qua `set_community_solution_status`), kèm `helpfulUserIds.length`
 *  dòng Hữu ích. */
async function createPublishedSolution(
  admin: SupabaseClient,
  fixture: { examId: string; questionId: string; writerId: string; helpfulUserIds: string[]; isPinned?: boolean },
): Promise<string> {
  await submittedAttempt(admin, fixture.writerId, fixture.examId);
  const solution = await admin
    .from("community_solutions")
    .insert({ exam_id: fixture.examId, author_id: fixture.writerId, status: "published", is_pinned: fixture.isPinned ?? false })
    .select("id")
    .single();
  if (solution.error) throw solution.error;
  const solutionId = solution.data!.id as string;
  const note = await admin
    .from("community_solution_notes")
    .insert({ solution_id: solutionId, question_id: fixture.questionId, body: csWords(15) });
  if (note.error) throw note.error;
  if (fixture.helpfulUserIds.length > 0) {
    const helpfuls = await admin
      .from("community_solution_helpfuls")
      .insert(fixture.helpfulUserIds.map((userId) => ({ solution_id: solutionId, user_id: userId })));
    if (helpfuls.error) throw helpfuls.error;
  }
  return solutionId;
}

/** Idempotent: xoá bài giải/lượt làm/đề/câu hỏi theo tiền tố rồi xoá user theo
 *  email — an toàn để gọi cả khi setup thất bại giữa chừng. Nhật ký kiểm duyệt
 *  của fixture đi theo đề (`community_moderation_log.exam_id on delete cascade`). */
async function cleanupFixture(admin: SupabaseClient, prefix: string, emails: string[]): Promise<void> {
  await admin.from("community_solutions").delete().like("exam_id", `${prefix}%`);
  await admin.from("exam_attempts").delete().like("exam_id", `${prefix}%`);
  await admin.from("exams").delete().like("id", `${prefix}%`);
  await admin.from("questions").delete().like("id", `${prefix}%`);
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of emails) {
    const user = list.data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

async function readReputation(client: SupabaseClient): Promise<Reputation> {
  const res = await client.rpc("community_reputation_summary");
  if (res.error) throw res.error;
  const rows = res.data as Reputation[];
  expect(rows).toHaveLength(1);
  return rows[0];
}

async function setStatus(writer: Student, examId: string, action: "draft" | "publish"): Promise<void> {
  const res = await writer.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: action });
  if (res.error) throw res.error;
}

async function setPin(author: Student, examId: string, action: "pin" | "unpin", solutionId?: string): Promise<void> {
  const res = await author.client.rpc("set_community_solution_pin", {
    p_exam_id: examId,
    p_action: action,
    p_solution_id: solutionId ?? null,
  });
  if (res.error) throw res.error;
}

async function moderate(adminSession: SupabaseClient, solutionId: string, action: "hide" | "restore" | "delete"): Promise<void> {
  const res = await adminSession.rpc("admin_moderate_community_solution", {
    p_solution_id: solutionId,
    p_action: action,
    p_reason: action === "restore" ? null : "[CS41] lý do kiểm duyệt",
  });
  if (res.error) throw res.error;
}

describe.skipIf(!HAS_LIVE_DB)("community_reputation_summary — fixed vector, Reference Contract Value #25 (task 41)", () => {
  const admin = adminClient();
  const PREFIX = "cs41vec-";
  const EXAM_A = `${PREFIX}exam-a`; // bài A: 10 Hữu ích
  const EXAM_B = `${PREFIX}exam-b`; // bài B: 22 Hữu ích
  const FAN_SLOTS = Array.from({ length: 22 }, (_, i) => `fan${i + 1}`);
  const emails = ["writer", "author", ...FAN_SLOTS].map((slot) => emailOf(PREFIX, slot));
  let writer!: Student;
  let author!: Student;
  let adminSession!: SupabaseClient;
  let solA!: string;
  let solB!: string;

  beforeAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
    writer = await createStudent(admin, emailOf(PREFIX, "writer"));
    author = await createStudent(admin, emailOf(PREFIX, "author"));
    const fanIds: string[] = [];
    for (const slot of FAN_SLOTS) fanIds.push(await createUserId(admin, emailOf(PREFIX, slot)));
    adminSession = await signInAsSeededAdmin(admin);

    const questionA = await createExam(admin, EXAM_A, author.id);
    const questionB = await createExam(admin, EXAM_B, author.id);
    solA = await createPublishedSolution(admin, { examId: EXAM_A, questionId: questionA, writerId: writer.id, helpfulUserIds: fanIds.slice(0, 10) });
    solB = await createPublishedSolution(admin, { examId: EXAM_B, questionId: questionB, writerId: writer.id, helpfulUserIds: fanIds });
  }, 180_000);

  afterAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
  }, 180_000);

  it("84 → 104 → 74 → 104 → 54 → 104 → 74 cho MỘT người viết, cả bốn trường khẳng định sau MỖI chặng, không chặng nào ghi tổng (AC-086, AC-080, AC-106, S17)", async () => {
    // 2 bài đã đăng, 32 Hữu ích, 0 ghim → 10×2 + 2×32 = 84.
    expect(await readReputation(writer.client)).toEqual({ total_score: 84, published_count: 2, helpful_count: 32, pinned_count: 0 });

    // Tác giả đề ghim B → 104.
    await setPin(author, EXAM_B, "pin", solB);
    expect(await readReputation(writer.client)).toEqual({ total_score: 104, published_count: 2, helpful_count: 32, pinned_count: 1 });

    // Ca 1: gỡ bài KHÔNG ghim (A, 10 Hữu ích) về nháp → 104 − 10 − 2×10 = 74; đăng lại → 104.
    await setStatus(writer, EXAM_A, "draft");
    expect(await readReputation(writer.client)).toEqual({ total_score: 74, published_count: 1, helpful_count: 22, pinned_count: 1 });
    await setStatus(writer, EXAM_A, "publish");
    expect(await readReputation(writer.client)).toEqual({ total_score: 104, published_count: 2, helpful_count: 32, pinned_count: 1 });

    // Chuyển ghim sang A để ca 2 có đúng "bài đang ghim mang 10 Hữu ích".
    await setPin(author, EXAM_B, "unpin");
    expect(await readReputation(writer.client)).toEqual({ total_score: 84, published_count: 2, helpful_count: 32, pinned_count: 0 });
    await setPin(author, EXAM_A, "pin", solA);
    expect(await readReputation(writer.client)).toEqual({ total_score: 104, published_count: 2, helpful_count: 32, pinned_count: 1 });

    // Ca 2: gỡ bài ĐANG GHIM (A, 10 Hữu ích) về nháp → 104 − 10 − 2×10 − 20 = 54.
    await setStatus(writer, EXAM_A, "draft");
    expect(await readReputation(writer.client)).toEqual({ total_score: 54, published_count: 1, helpful_count: 22, pinned_count: 0 });
    // Đăng lại, tác giả chưa ghim bài khác → A trở lại là bài ghim (AC-080) → 104.
    await setStatus(writer, EXAM_A, "publish");
    expect(await readReputation(writer.client)).toEqual({ total_score: 104, published_count: 2, helpful_count: 32, pinned_count: 1 });
    const pinnedAfterRepublish = await admin.from("community_solutions").select("is_pinned").eq("id", solA).single();
    expect(pinnedAfterRepublish.data?.is_pinned).toBe(true);

    // Chuyển ghim về B để ca 3 có đúng "bài không ghim mang 10 Hữu ích".
    await setPin(author, EXAM_A, "unpin");
    expect(await readReputation(writer.client)).toEqual({ total_score: 84, published_count: 2, helpful_count: 32, pinned_count: 0 });
    await setPin(author, EXAM_B, "pin", solB);
    expect(await readReputation(writer.client)).toEqual({ total_score: 104, published_count: 2, helpful_count: 32, pinned_count: 1 });

    // Ca 3: admin xoá hẳn bài không ghim (A, 10 Hữu ích) → 74, Hữu ích của A đi theo.
    await moderate(adminSession, solA, "delete");
    expect(await readReputation(writer.client)).toEqual({ total_score: 74, published_count: 1, helpful_count: 22, pinned_count: 1 });
    const helpfulsOfDeleted = await admin
      .from("community_solution_helpfuls")
      .select("user_id", { count: "exact", head: true })
      .eq("solution_id", solA);
    expect(helpfulsOfDeleted.count).toBe(0);

    // Không có đường trở lại (S17): 'restore' trên bài đã xoá → not found, điểm giữ 74.
    const restoreDeleted = await adminSession.rpc("admin_moderate_community_solution", {
      p_solution_id: solA,
      p_action: "restore",
      p_reason: null,
    });
    expect(restoreDeleted.error?.message).toBe("admin_moderate_community_solution: not found");
    expect(await readReputation(writer.client)).toEqual({ total_score: 74, published_count: 1, helpful_count: 22, pinned_count: 1 });
  }, 90_000);

  it("không bảng nào của tính năng lưu tổng uy tín: hàng community_solutions và user_profiles không có cột điểm/uy tín nào (AC-086 'no stored total')", async () => {
    const solutionRow = await admin.from("community_solutions").select("*").eq("id", solB).single();
    if (solutionRow.error) throw solutionRow.error;
    const profileRow = await admin.from("user_profiles").select("*").eq("id", writer.id).single();
    if (profileRow.error) throw profileRow.error;
    const storedKeys = [...Object.keys(solutionRow.data), ...Object.keys(profileRow.data)];
    expect(storedKeys.filter((key) => /reputation|total_score|helpful_count|published_count|pinned_count/.test(key))).toEqual([]);
  });
});

describe.skipIf(!HAS_LIVE_DB)("community_reputation_summary — AC-088 badge rollback 5 → 4 → 5 (task 41)", () => {
  const admin = adminClient();
  const PREFIX = "cs41roll-";
  const EXAM_IDS = [1, 2, 3, 4, 5].map((n) => `${PREFIX}exam-${n}`);
  const FAN_SLOTS = ["fan1", "fan2", "fan3"];
  const emails = ["writer", "author", ...FAN_SLOTS].map((slot) => emailOf(PREFIX, slot));
  let writer!: Student;
  let adminSession!: SupabaseClient;
  const solutionIds: string[] = [];

  // Bài 1: 3 Hữu ích + đang ghim → đóng góp 10 + 2×3 + 20 = 36.
  // Bài 2: 2 Hữu ích, không ghim → đóng góp 10 + 2×2 = 14.
  // Bài 3–5: không Hữu ích → 10 mỗi bài.
  // Tổng: 5 bài, 5 Hữu ích, 1 ghim → 50 + 10 + 20 = 80.
  const BASELINE: Reputation = { total_score: 80, published_count: 5, helpful_count: 5, pinned_count: 1 };

  beforeAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
    writer = await createStudent(admin, emailOf(PREFIX, "writer"));
    const author = await createStudent(admin, emailOf(PREFIX, "author"));
    const fanIds: string[] = [];
    for (const slot of FAN_SLOTS) fanIds.push(await createUserId(admin, emailOf(PREFIX, slot)));
    adminSession = await signInAsSeededAdmin(admin);

    const helpfulsPerSolution = [fanIds, fanIds.slice(0, 2), [], [], []];
    for (const [index, examId] of EXAM_IDS.entries()) {
      const questionId = await createExam(admin, examId, author.id);
      solutionIds.push(
        await createPublishedSolution(admin, {
          examId,
          questionId,
          writerId: writer.id,
          helpfulUserIds: helpfulsPerSolution[index],
          isPinned: index === 0,
        }),
      );
    }
  }, 180_000);

  afterAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
  }, 180_000);

  it("gỡ về nháp một bài: published_count 5 → 4, total_score giảm đúng phần đóng góp của bài đó (36); đăng lại → trở về y nguyên", async () => {
    expect(await readReputation(writer.client)).toEqual(BASELINE);

    await setStatus(writer, EXAM_IDS[0], "draft");
    expect(await readReputation(writer.client)).toEqual({ total_score: 44, published_count: 4, helpful_count: 2, pinned_count: 0 });

    await setStatus(writer, EXAM_IDS[0], "publish");
    expect(await readReputation(writer.client)).toEqual(BASELINE);
  }, 60_000);

  it("admin ẩn một bài: published_count 5 → 4, total_score giảm đúng phần đóng góp của bài đó (14), Hữu ích của bài bị ẩn thôi tính; 'restore' → trở về y nguyên", async () => {
    expect(await readReputation(writer.client)).toEqual(BASELINE);

    await moderate(adminSession, solutionIds[1], "hide");
    expect(await readReputation(writer.client)).toEqual({ total_score: 66, published_count: 4, helpful_count: 3, pinned_count: 1 });

    await moderate(adminSession, solutionIds[1], "restore");
    expect(await readReputation(writer.client)).toEqual(BASELINE);
  }, 60_000);
});

describe.skipIf(!HAS_LIVE_DB)("community_reputation_summary — Proof Obligation state (published 5 + 3 Helpful, one pinned) (task 41)", () => {
  const admin = adminClient();
  const PREFIX = "cs41state-";
  const EXAM_PINNED = `${PREFIX}exam-pinned`;
  const EXAM_PLAIN = `${PREFIX}exam-plain`;
  const FAN_SLOTS = ["fan1", "fan2", "fan3", "fan4", "fan5"];
  const emails = ["writer", "author", ...FAN_SLOTS].map((slot) => emailOf(PREFIX, slot));
  let writer!: Student;

  beforeAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
    writer = await createStudent(admin, emailOf(PREFIX, "writer"));
    const author = await createStudent(admin, emailOf(PREFIX, "author"));
    const fanIds: string[] = [];
    for (const slot of FAN_SLOTS) fanIds.push(await createUserId(admin, emailOf(PREFIX, slot)));
    const questionPinned = await createExam(admin, EXAM_PINNED, author.id);
    const questionPlain = await createExam(admin, EXAM_PLAIN, author.id);
    await createPublishedSolution(admin, { examId: EXAM_PINNED, questionId: questionPinned, writerId: writer.id, helpfulUserIds: fanIds, isPinned: true });
    await createPublishedSolution(admin, { examId: EXAM_PLAIN, questionId: questionPlain, writerId: writer.id, helpfulUserIds: fanIds.slice(0, 3) });
  }, 180_000);

  afterAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
  }, 180_000);

  it("{2, 8, 1, 56}; gỡ bài 5-Hữu-ích đang ghim về nháp → {1, 3, 0, 16} ngay lượt đọc sau — Hữu ích và ghim của bài nháp không còn tính", async () => {
    expect(await readReputation(writer.client)).toEqual({ total_score: 56, published_count: 2, helpful_count: 8, pinned_count: 1 });

    await setStatus(writer, EXAM_PINNED, "draft");
    expect(await readReputation(writer.client)).toEqual({ total_score: 16, published_count: 1, helpful_count: 3, pinned_count: 0 });
  }, 60_000);
});

describe.skipIf(!HAS_LIVE_DB)("community_reputation_summary — AC-090 zero + AC-089 caller-only (task 41)", () => {
  const admin = adminClient();
  const PREFIX = "cs41zero-";
  const EXAM_DRAFT = `${PREFIX}exam-draft`;
  const emails = ["nobody", "drafter", "author", "fan1"].map((slot) => emailOf(PREFIX, slot));
  let nobody!: Student;
  let drafter!: Student;

  beforeAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
    nobody = await createStudent(admin, emailOf(PREFIX, "nobody"));
    drafter = await createStudent(admin, emailOf(PREFIX, "drafter"));
    const author = await createStudent(admin, emailOf(PREFIX, "author"));
    const fanId = await createUserId(admin, emailOf(PREFIX, "fan1"));
    const questionId = await createExam(admin, EXAM_DRAFT, author.id);
    // Bài NHÁP đang ghim, có Hữu ích — dạng hỏng chính: sum/filter tính cả bài chưa đăng.
    const solutionId = await createPublishedSolution(admin, {
      examId: EXAM_DRAFT,
      questionId,
      writerId: drafter.id,
      helpfulUserIds: [fanId],
      isPinned: true,
    });
    const toDraft = await admin.from("community_solutions").update({ status: "draft" }).eq("id", solutionId);
    if (toDraft.error) throw toDraft.error;
  }, 120_000);

  afterAll(async () => {
    await cleanupFixture(admin, PREFIX, emails);
  }, 120_000);

  it("người chưa có bài giải nào → đúng một hàng {0, 0, 0, 0}, không null, không lỗi", async () => {
    expect(await readReputation(nobody.client)).toEqual({ total_score: 0, published_count: 0, helpful_count: 0, pinned_count: 0 });
  });

  it("người chỉ có một bài NHÁP (đang ghim, có Hữu ích) → vẫn {0, 0, 0, 0}", async () => {
    expect(await readReputation(drafter.client)).toEqual({ total_score: 0, published_count: 0, helpful_count: 0, pinned_count: 0 });
  });

  it("không có chữ ký nhận người dùng đích (AC-089): gọi kèm p_user_id → không tìm thấy hàm (PGRST202)", async () => {
    const res = await nobody.client.rpc("community_reputation_summary", { p_user_id: drafter.id });
    expect(res.error?.code).toBe("PGRST202");
  });

  it("anon không gọi được: message bắt đầu bằng 'permission denied for function'", async () => {
    const res = await anonClient().rpc("community_reputation_summary");
    expect(res.error?.message ?? "").toMatch(/^permission denied for function/);
  });
});
