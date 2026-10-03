// Community Solutions — `community_my_solutions()` (schema.sql §28, 2026-10-03,
// docs/plans/20261003-feature-profile-solutions-tab.md). Làn SERVICE (Postgres
// dev THẬT, không mock) — `describe.skipIf(!HAS_LIVE_DB)`, cùng tiền lệ
// `community-solutions-reputation.localdb.test.ts`.
//
// Phủ: chỉ bài CỦA người gọi (không lộ bài người khác), đủ cả ba trạng thái
// nháp/đã đăng/bị ẩn, thứ tự mới cập nhật nhất trước, `attempt_id` theo công
// thức của `community_solution_for_writer` (linked_attempt_id, rồi lượt nộp mới
// nhất; null khi hết lượt nộp), `exam_visible` false khi đề không còn published,
// `helpful_count`, và anon không gọi được.
//
// Chạy: `npm run test:localdb` (từ SOURCE/). Tiền đề: `npm run verify:schema`
// XANH TRÊN DEV trước khi chạy.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

const PASSWORD = "cs28mine-password-123";
const PREFIX = "cs28mine-";

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

interface MySolutionRow {
  solution_id: string;
  exam_id: string;
  exam_title: string;
  exam_subject: string;
  exam_grade: number;
  status: "draft" | "published" | "hidden";
  attempt_id: string | null;
  updated_at: string;
  helpful_count: number;
  exam_visible: boolean;
}

interface Student {
  id: string;
  client: SupabaseClient;
}

const EXAM_PUBLISHED = `${PREFIX}exam-published`;
const EXAM_DRAFT = `${PREFIX}exam-draft`;
const EXAM_HIDDEN = `${PREFIX}exam-hidden`;
const EXAM_UNPUBLISHED = `${PREFIX}exam-unpublished`;
const EXAM_OTHERS = `${PREFIX}exam-others`;
const EMAILS = ["mine", "other", "author", "fan1", "fan2"].map((slot) => `${PREFIX}${slot}@example.com`);

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

async function createExam(
  admin: SupabaseClient,
  examId: string,
  authorId: string,
  status: "published" | "draft" = "published",
): Promise<string> {
  const questionId = `${examId}-q1`;
  const q = await admin.from("questions").insert({
    id: questionId,
    content: `[CS28] ${examId}`,
    choices: MCQ_CHOICES,
    correct_answer: "A",
    subject: "Toán",
    grade: 10,
    topic: "Toán",
  });
  if (q.error) throw q.error;
  const exam = await admin.from("exams").insert({
    id: examId,
    title: `[CS28] ${examId}`,
    duration_minutes: 45,
    subject: "Toán",
    grade: 10,
    author_id: authorId,
    author_display_name: "Author",
    question_ids: [questionId],
    status,
  });
  if (exam.error) throw exam.error;
  return questionId;
}

async function submittedAttempt(
  admin: SupabaseClient,
  userId: string,
  examId: string,
  submittedAt: string,
): Promise<string> {
  const res = await admin
    .from("exam_attempts")
    .insert({ user_id: userId, exam_id: examId, status: "submitted", submitted_at: submittedAt })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data!.id as string;
}

async function createSolution(
  admin: SupabaseClient,
  fixture: {
    examId: string;
    authorId: string;
    status: "draft" | "published" | "hidden";
    updatedAt: string;
    linkedAttemptId?: string | null;
  },
): Promise<string> {
  const res = await admin
    .from("community_solutions")
    .insert({
      exam_id: fixture.examId,
      author_id: fixture.authorId,
      status: fixture.status,
      updated_at: fixture.updatedAt,
      linked_attempt_id: fixture.linkedAttemptId ?? null,
    })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data!.id as string;
}

/** Idempotent — an toàn để gọi cả khi setup thất bại giữa chừng. */
async function cleanup(admin: SupabaseClient): Promise<void> {
  await admin.from("community_solutions").delete().like("exam_id", `${PREFIX}%`);
  await admin.from("exam_attempts").delete().like("exam_id", `${PREFIX}%`);
  await admin.from("exams").delete().like("id", `${PREFIX}%`);
  await admin.from("questions").delete().like("id", `${PREFIX}%`);
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of EMAILS) {
    const user = list.data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

async function readMine(client: SupabaseClient): Promise<MySolutionRow[]> {
  const res = await client.rpc("community_my_solutions");
  if (res.error) throw res.error;
  return res.data as MySolutionRow[];
}

describe.skipIf(!HAS_LIVE_DB)("community_my_solutions — chỉ bài của người gọi, đủ trạng thái, đúng thứ tự (§28)", () => {
  const admin = adminClient();
  let mine!: Student;
  let other!: Student;
  const ids: Record<string, string> = {};
  let oldAttempt = "";
  let newAttempt = "";
  let linkedAttempt = "";

  beforeAll(async () => {
    await cleanup(admin);
    mine = await createStudent(admin, EMAILS[0]);
    other = await createStudent(admin, EMAILS[1]);
    const author = await createStudent(admin, EMAILS[2]);
    const fan1 = await createUserId(admin, EMAILS[3]);
    const fan2 = await createUserId(admin, EMAILS[4]);

    for (const examId of [EXAM_PUBLISHED, EXAM_DRAFT, EXAM_HIDDEN, EXAM_OTHERS]) {
      await createExam(admin, examId, author.id);
    }
    await createExam(admin, EXAM_UNPUBLISHED, author.id, "draft");

    // EXAM_PUBLISHED: hai lượt nộp, bài KHÔNG gắn lượt nào → attempt_id = lượt mới nhất.
    oldAttempt = await submittedAttempt(admin, mine.id, EXAM_PUBLISHED, "2026-09-01T00:00:00.000Z");
    newAttempt = await submittedAttempt(admin, mine.id, EXAM_PUBLISHED, "2026-09-20T00:00:00.000Z");
    // EXAM_DRAFT: bài GẮN lượt cũ, dù có lượt mới hơn → attempt_id = lượt đã gắn.
    linkedAttempt = await submittedAttempt(admin, mine.id, EXAM_DRAFT, "2026-09-02T00:00:00.000Z");
    await submittedAttempt(admin, mine.id, EXAM_DRAFT, "2026-09-25T00:00:00.000Z");
    // EXAM_HIDDEN: không lượt nộp nào còn lại → attempt_id null.
    // EXAM_UNPUBLISHED: có lượt nộp nhưng đề không còn published → exam_visible false.
    await submittedAttempt(admin, mine.id, EXAM_UNPUBLISHED, "2026-09-03T00:00:00.000Z");

    // Cập nhật theo thứ tự: PUBLISHED (mới nhất) > DRAFT > HIDDEN > UNPUBLISHED (cũ nhất).
    ids.published = await createSolution(admin, {
      examId: EXAM_PUBLISHED,
      authorId: mine.id,
      status: "published",
      updatedAt: "2026-10-03T00:00:00.000Z",
    });
    ids.draft = await createSolution(admin, {
      examId: EXAM_DRAFT,
      authorId: mine.id,
      status: "draft",
      updatedAt: "2026-10-02T00:00:00.000Z",
      linkedAttemptId: linkedAttempt,
    });
    ids.hidden = await createSolution(admin, {
      examId: EXAM_HIDDEN,
      authorId: mine.id,
      status: "hidden",
      updatedAt: "2026-10-01T00:00:00.000Z",
    });
    ids.unpublished = await createSolution(admin, {
      examId: EXAM_UNPUBLISHED,
      authorId: mine.id,
      status: "published",
      updatedAt: "2026-09-30T00:00:00.000Z",
    });
    // Bài của NGƯỜI KHÁC — không được lộ ra cho `mine`.
    await submittedAttempt(admin, other.id, EXAM_OTHERS, "2026-09-05T00:00:00.000Z");
    ids.others = await createSolution(admin, {
      examId: EXAM_OTHERS,
      authorId: other.id,
      status: "published",
      updatedAt: "2026-10-04T00:00:00.000Z",
    });

    const helpfuls = await admin
      .from("community_solution_helpfuls")
      .insert([fan1, fan2].map((userId) => ({ solution_id: ids.published, user_id: userId })));
    if (helpfuls.error) throw helpfuls.error;
  }, 180_000);

  afterAll(async () => {
    await cleanup(admin);
  }, 180_000);

  it("trả đúng bốn bài của người gọi, KHÔNG có bài của người khác, mới cập nhật nhất trước", async () => {
    const rows = await readMine(mine.client);

    expect(rows.map((r) => r.solution_id)).toEqual([ids.published, ids.draft, ids.hidden, ids.unpublished]);
    expect(rows.map((r) => r.solution_id)).not.toContain(ids.others);
  });

  it("cả ba trạng thái đều có mặt, kèm tên đề, môn và lớp", async () => {
    const rows = await readMine(mine.client);

    expect(rows.map((r) => r.status)).toEqual(["published", "draft", "hidden", "published"]);
    expect(rows[0]).toMatchObject({ exam_id: EXAM_PUBLISHED, exam_title: `[CS28] ${EXAM_PUBLISHED}`, exam_grade: 10 });
    expect(rows[0].exam_subject).toBeTruthy();
  });

  it("attempt_id: bài không gắn lượt → lượt nộp MỚI NHẤT; bài đã gắn → lượt đã gắn dù có lượt mới hơn; hết lượt nộp → null", async () => {
    const byExam = new Map((await readMine(mine.client)).map((r) => [r.exam_id, r]));

    expect(byExam.get(EXAM_PUBLISHED)?.attempt_id).toBe(newAttempt);
    expect(byExam.get(EXAM_PUBLISHED)?.attempt_id).not.toBe(oldAttempt);
    expect(byExam.get(EXAM_DRAFT)?.attempt_id).toBe(linkedAttempt);
    expect(byExam.get(EXAM_HIDDEN)?.attempt_id).toBeNull();
  });

  it("exam_visible: true cho đề published, false khi đề không còn published", async () => {
    const byExam = new Map((await readMine(mine.client)).map((r) => [r.exam_id, r]));

    expect(byExam.get(EXAM_PUBLISHED)?.exam_visible).toBe(true);
    expect(byExam.get(EXAM_DRAFT)?.exam_visible).toBe(true);
    expect(byExam.get(EXAM_UNPUBLISHED)?.exam_visible).toBe(false);
  });

  it("helpful_count đếm đúng số lượt Hữu ích của từng bài (là số nguyên, không phải chuỗi)", async () => {
    const byExam = new Map((await readMine(mine.client)).map((r) => [r.exam_id, r]));

    expect(byExam.get(EXAM_PUBLISHED)?.helpful_count).toBe(2);
    expect(byExam.get(EXAM_DRAFT)?.helpful_count).toBe(0);
  });

  it("người khác chỉ thấy bài của chính họ; người chưa viết gì nhận mảng rỗng", async () => {
    const otherRows = await readMine(other.client);
    expect(otherRows.map((r) => r.solution_id)).toEqual([ids.others]);

    const nobody = await createStudent(admin, `${PREFIX}nobody@example.com`);
    try {
      expect(await readMine(nobody.client)).toEqual([]);
    } finally {
      await admin.auth.admin.deleteUser(nobody.id);
    }
  });

  it("không có chữ ký nhận người dùng đích: gọi kèm p_user_id → không tìm thấy hàm (PGRST202)", async () => {
    const res = await mine.client.rpc("community_my_solutions", { p_user_id: other.id });
    expect(res.error?.code).toBe("PGRST202");
  });

  it("anon không gọi được: message bắt đầu bằng 'permission denied for function'", async () => {
    const res = await anonClient().rpc("community_my_solutions");
    expect(res.error?.message ?? "").toMatch(/^permission denied for function/);
  });
});
