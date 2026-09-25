// Community Solutions — S12 ordering + score-grading badge state + detail
// payload column enumeration (#14) + AC-047/AC-048 (list/detail part). Test
// task 16 (migration task 13, backend DD v1.9 § Integration Verification
// Points). Làn SERVICE (Postgres dev THẬT, không mock) — `describe.skipIf
// (!HAS_LIVE_DB)`, cùng tiền lệ `community-solutions-write-gate.localdb.test.ts`
// (task 05) và `exam-search.service.e2e.test.ts`.
//
// Các case còn lại của task 16 (M5, writer self-read AC-062, cả hai nhóm RPC
// Helpful kèm table-closure, ghim nguyên tử + refusal mục tiêu, cổng AC-004
// cho ghim/list/detail, bình luận trên bài giải nháp/bị ẩn S7/AC-071/AC-063,
// admin-hidden comment S19/AC-107, hồi quy tên) sống ở `supabase/test-rls.ts`
// (Design Doc cho phép sống ở MỘT trong hai nơi, miễn là chạy — task file
// § Implementation Content).
//
// Chạy: `npm run test:localdb` (từ SOURCE/), với `--exclude` cho skeleton
// `community-solutions.service.e2e.test.ts` (R1, còn comment-only tới task 47
// — decomposer resolution R1, task file § Quality Assurance Mechanisms).
// Tiền đề: `npm run verify:schema` XANH TRÊN DEV trước khi chạy.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { adminClient, anonClient, HAS_LIVE_DB } from "./essayGradeWriteFixtures";

const PREFIX = "cs16order-";
const PASSWORD = "cs16order-password-123";

const MCQ_CHOICES = [
  { id: "A", text: "1" },
  { id: "B", text: "2" },
  { id: "C", text: "3" },
  { id: "D", text: "4" },
];

/** Sinh đúng `n` từ (đếm bằng khoảng trắng, khớp `count_words`/`countWords`) —
 *  cùng công thức `csWords` của `supabase/test-rls.ts`. */
function csWords(n: number): string {
  return Array.from({ length: n }, (_, i) => `tu${i + 1}`).join(" ");
}

interface Student {
  id: string;
  client: SupabaseClient;
}

async function createStudent(admin: SupabaseClient, slot: string): Promise<Student> {
  const email = `${PREFIX}${slot}@example.com`;
  const created = await admin.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true });
  if (created.error) throw created.error;
  const client = anonClient();
  const signIn = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (signIn.error) throw signIn.error;
  return { id: created.data.user.id, client };
}

async function submittedAttempt(admin: SupabaseClient, userId: string, examId: string): Promise<string> {
  const res = await admin
    .from("exam_attempts")
    .insert({ user_id: userId, exam_id: examId, status: "submitted", submitted_at: new Date().toISOString() })
    .select("id")
    .single();
  if (res.error) throw res.error;
  return res.data.id as string;
}

/** Idempotent: xoá theo email — an toàn để gọi cả khi setup thất bại giữa
 *  chừng, cùng quy ước `tearDownByEmail` của `essayGradeWriteFixtures.ts`. */
async function cleanupByEmails(admin: SupabaseClient, emails: string[]): Promise<void> {
  const list = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const email of emails) {
    const user = list.data?.users.find((u) => u.email === email);
    if (user) await admin.auth.admin.deleteUser(user.id);
  }
}

describe.skipIf(!HAS_LIVE_DB)("community_solutions_list — S12 ordering (task 16; migration 13)", () => {
  const admin = adminClient();
  const EXAM_ID = `${PREFIX}order-exam`;
  const QUESTION_ID = `${EXAM_ID}-q1`;
  const emails = ["order-author", "order-s1", "order-s2", "order-s3"].map((s) => `${PREFIX}${s}@example.com`);
  let author!: Student;
  let solIds: string[] = [];

  async function cleanup() {
    await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
    await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
    await admin.from("exams").delete().eq("id", EXAM_ID);
    await admin.from("questions").delete().eq("id", QUESTION_ID);
    await cleanupByEmails(admin, emails);
  }

  beforeAll(async () => {
    await cleanup();
    author = await createStudent(admin, "order-author");
    const s1 = await createStudent(admin, "order-s1");
    const s2 = await createStudent(admin, "order-s2");
    const s3 = await createStudent(admin, "order-s3");

    const q = await admin.from("questions").insert({
      id: QUESTION_ID,
      content: "[CS16-order] câu 1",
      choices: MCQ_CHOICES,
      correct_answer: "A",
      subject: "Toán",
      grade: 10,
      topic: "Toán",
    });
    if (q.error) throw q.error;
    const exam = await admin.from("exams").insert({
      id: EXAM_ID,
      title: "[CS16-order] đề",
      duration_minutes: 45,
      subject: "Toán",
      grade: 10,
      author_id: author.id,
      author_display_name: "Author",
      question_ids: [QUESTION_ID],
      status: "published",
    });
    if (exam.error) throw exam.error;
    await submittedAttempt(admin, author.id, EXAM_ID);

    // 3 bài giải hoà nhau trên CẢ BA vế đầu của order by (is_pinned, helpful_count,
    // updated_at) — chỉ id còn khác nhau, đúng vế cuối cùng của Reference Contract
    // Value #3 phải phân xử.
    const solutions = await admin
      .from("community_solutions")
      .insert([
        { exam_id: EXAM_ID, author_id: s1.id, status: "published" },
        { exam_id: EXAM_ID, author_id: s2.id, status: "published" },
        { exam_id: EXAM_ID, author_id: s3.id, status: "published" },
      ])
      .select("id");
    if (solutions.error) throw solutions.error;
    solIds = (solutions.data as Array<{ id: string }>).map((r) => r.id);
    const tieUpdatedAt = new Date("2026-01-01T00:00:00.000Z").toISOString();
    const forceTie = await admin.from("community_solutions").update({ updated_at: tieUpdatedAt }).in("id", solIds);
    if (forceTie.error) throw forceTie.error;
  }, 60_000);

  afterAll(async () => {
    await cleanup();
  }, 60_000);

  it("hai lượt đọc liên tiếp trả cùng thứ tự id; hoà is_pinned/helpful_count/updated_at giải quyết bằng id tăng dần (Reference Contract Value #3)", async () => {
    const expectedOrder = [...solIds].sort();
    const read1 = await author.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
    const read2 = await author.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
    expect(read1.error).toBeNull();
    expect(read2.error).toBeNull();
    const order1 = (read1.data as Array<{ id: string }>).map((r) => r.id);
    const order2 = (read2.data as Array<{ id: string }>).map((r) => r.id);
    expect(order1).toEqual(expectedOrder);
    expect(order2).toEqual(order1);
  });
});

describe.skipIf(!HAS_LIVE_DB)(
  "community_solutions_list / community_solution_detail — score-grading badge state (task 16; migration 13)",
  () => {
    const admin = adminClient();
    const EXAM_ID = `${PREFIX}score-exam`;
    const QUESTION_ID = `${EXAM_ID}-q1`;
    const emails = ["score-author", "score-x", "score-y"].map((s) => `${PREFIX}${s}@example.com`);
    let author!: Student;
    let solX!: string;
    let solY!: string;
    let attemptX!: string;

    async function cleanup() {
      await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
      await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
      await admin.from("exams").delete().eq("id", EXAM_ID);
      await admin.from("questions").delete().eq("id", QUESTION_ID);
      await cleanupByEmails(admin, emails);
    }

    beforeAll(async () => {
      await cleanup();
      author = await createStudent(admin, "score-author");
      const sx = await createStudent(admin, "score-x");
      const sy = await createStudent(admin, "score-y");

      const q = await admin.from("questions").insert({
        id: QUESTION_ID,
        content: "[CS16-score] câu 1",
        choices: MCQ_CHOICES,
        correct_answer: "A",
        subject: "Toán",
        grade: 10,
        topic: "Toán",
      });
      if (q.error) throw q.error;
      const exam = await admin.from("exams").insert({
        id: EXAM_ID,
        title: "[CS16-score] đề",
        duration_minutes: 45,
        subject: "Toán",
        grade: 10,
        author_id: author.id,
        author_display_name: "Author",
        question_ids: [QUESTION_ID],
        status: "published",
      });
      if (exam.error) throw exam.error;
      await submittedAttempt(admin, author.id, EXAM_ID);

      attemptX = await submittedAttempt(admin, sx.id, EXAM_ID);
      const resultX = await admin.from("exam_results").insert({
        attempt_id: attemptX,
        user_id: sx.id,
        total_score: 8,
        correct: 1,
        total: 1,
        topic_breakdown: [],
        per_question: [{ questionId: QUESTION_ID, essayState: "pending" }],
      });
      if (resultX.error) throw resultX.error;

      const attemptY = await submittedAttempt(admin, sy.id, EXAM_ID);
      const resultY = await admin.from("exam_results").insert({
        attempt_id: attemptY,
        user_id: sy.id,
        total_score: 5,
        correct: 1,
        total: 1,
        topic_breakdown: [],
        per_question: [],
      });
      if (resultY.error) throw resultY.error;

      const solutionX = await admin
        .from("community_solutions")
        .insert({ exam_id: EXAM_ID, author_id: sx.id, status: "published", show_score: true, linked_attempt_id: attemptX })
        .select("id")
        .single();
      if (solutionX.error) throw solutionX.error;
      solX = solutionX.data!.id as string;

      const solutionY = await admin
        .from("community_solutions")
        .insert({ exam_id: EXAM_ID, author_id: sy.id, status: "published", show_score: false, linked_attempt_id: attemptY })
        .select("id")
        .single();
      if (solutionY.error) throw solutionY.error;
      solY = solutionY.data!.id as string;
    }, 60_000);

    afterAll(async () => {
      await cleanup();
    }, 60_000);

    async function readBoth(solutionId: string) {
      const list = await author.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      const detail = await author.client.rpc("community_solution_detail", { p_solution_id: solutionId });
      const listRow = (list.data as Array<Record<string, unknown>> | null)?.find((r) => r.id === solutionId);
      const detailRow = (detail.data as Array<Record<string, unknown>> | null)?.[0];
      return { listRow, detailRow };
    }

    it("essayState='pending' → score_grading=true; 'graded' → false cùng score; không có phần tử tự luận → false; show_score=false → cả hai null, mọi trường hợp giống nhau trên CẢ HAI đường đọc (AC-040/AC-041/AC-055)", async () => {
      const pending = await readBoth(solX);
      expect(pending.listRow?.score).not.toBeNull();
      expect(pending.listRow?.score_grading).toBe(true);
      expect(pending.detailRow?.score).not.toBeNull();
      expect(pending.detailRow?.score_grading).toBe(true);
      expect(pending.listRow?.score).toBe(pending.detailRow?.score);

      const graded = await admin
        .from("exam_results")
        .update({ per_question: [{ questionId: QUESTION_ID, essayState: "graded" }] })
        .eq("attempt_id", attemptX);
      if (graded.error) throw graded.error;
      const afterGraded = await readBoth(solX);
      expect(afterGraded.listRow?.score_grading).toBe(false);
      expect(afterGraded.listRow?.score).toBe(pending.listRow?.score);
      expect(afterGraded.detailRow?.score_grading).toBe(false);
      expect(afterGraded.detailRow?.score).toBe(pending.detailRow?.score);

      const noEssay = await admin.from("exam_results").update({ per_question: [] }).eq("attempt_id", attemptX);
      if (noEssay.error) throw noEssay.error;
      const afterNoEssay = await readBoth(solX);
      expect(afterNoEssay.listRow?.score_grading).toBe(false);
      expect(afterNoEssay.detailRow?.score_grading).toBe(false);

      const hidden = await readBoth(solY);
      expect(hidden.listRow?.score).toBeNull();
      expect(hidden.listRow?.score_grading).toBeNull();
      expect(hidden.detailRow?.score).toBeNull();
      expect(hidden.detailRow?.score_grading).toBeNull();
      expect(hidden.detailRow?.per_question).toBeNull();
    });
  },
);

describe.skipIf(!HAS_LIVE_DB)(
  "community_solution_detail — column enumeration (#14) + AC-048/AC-047 note & current-question conditions (task 16; migration 13)",
  () => {
    const admin = adminClient();
    const EXAM_ID = `${PREFIX}detail-exam`;
    const Q1 = `${EXAM_ID}-q1`;
    const Q2 = `${EXAM_ID}-q2`;
    const emails = ["detail-reader", "detail-writer", "detail-commenter"].map((s) => `${PREFIX}${s}@example.com`);
    let reader!: Student;
    let sol!: string;

    const HEADER_KEYS = [
      "id",
      "author_id",
      "author_display_name",
      "author_avatar_path",
      "is_pinned",
      "updated_at",
      "score",
      "score_grading",
      "per_question",
      "is_mine",
      "helpful_count",
      "i_marked_helpful",
      "i_reported",
      "questions",
    ].sort();
    const QUESTION_KEYS = ["question_id", "stem", "correct_answer", "has_changed", "note", "comment_count", "comments"].sort();
    const COMMENT_KEYS = [
      "id",
      "author_id",
      "author_display_name",
      "author_avatar_path",
      "is_solution_author",
      "is_mine",
      "body",
      "is_hidden_by_admin",
      "hidden_reason",
      "i_reported",
      "created_at",
    ].sort();

    async function cleanup() {
      await admin.from("community_solutions").delete().eq("exam_id", EXAM_ID);
      await admin.from("exam_attempts").delete().eq("exam_id", EXAM_ID);
      await admin.from("exams").delete().eq("id", EXAM_ID);
      await admin.from("questions").delete().in("id", [Q1, Q2]);
      await cleanupByEmails(admin, emails);
    }

    beforeAll(async () => {
      await cleanup();
      reader = await createStudent(admin, "detail-reader");
      const writer = await createStudent(admin, "detail-writer");
      const commenter = await createStudent(admin, "detail-commenter");

      const q = await admin.from("questions").insert([
        { id: Q1, content: "[CS16-detail] câu 1", choices: MCQ_CHOICES, correct_answer: "A", subject: "Toán", grade: 10, topic: "Toán" },
        { id: Q2, content: "[CS16-detail] câu 2", choices: MCQ_CHOICES, correct_answer: "A", subject: "Toán", grade: 10, topic: "Toán" },
      ]);
      if (q.error) throw q.error;
      const exam = await admin.from("exams").insert({
        id: EXAM_ID,
        title: "[CS16-detail] đề",
        duration_minutes: 45,
        subject: "Toán",
        grade: 10,
        author_id: reader.id,
        author_display_name: "Reader",
        question_ids: [Q1, Q2],
        status: "published",
      });
      if (exam.error) throw exam.error;
      await submittedAttempt(admin, reader.id, EXAM_ID);
      const writerAttempt = await submittedAttempt(admin, writer.id, EXAM_ID);
      const result = await admin.from("exam_results").insert({
        attempt_id: writerAttempt,
        user_id: writer.id,
        total_score: 8,
        correct: 1,
        total: 1,
        topic_breakdown: [],
        per_question: [],
      });
      if (result.error) throw result.error;

      const solution = await admin
        .from("community_solutions")
        .insert({
          exam_id: EXAM_ID,
          author_id: writer.id,
          status: "published",
          show_profile: true,
          show_score: true,
          linked_attempt_id: writerAttempt,
        })
        .select("id")
        .single();
      if (solution.error) throw solution.error;
      sol = solution.data!.id as string;

      const notes = await admin.from("community_solution_notes").insert([
        { solution_id: sol, question_id: Q1, body: csWords(15) },
        { solution_id: sol, question_id: Q2, body: csWords(15) },
      ]);
      if (notes.error) throw notes.error;

      const comment = await admin
        .from("community_solution_comments")
        .insert({ solution_id: sol, question_id: Q1, author_id: commenter.id, body: "[CS16-detail] bình luận" });
      if (comment.error) throw comment.error;
    }, 60_000);

    afterAll(async () => {
      await cleanup();
    }, 60_000);

    it("header đúng 14 khoá / mỗi câu đúng 7 khoá / mỗi bình luận đúng 11 khoá — set-equal cả hai chiều, với show_score=true rồi show_score=false (Reference Contract Value #14)", async () => {
      const detailTrue = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      expect(detailTrue.error).toBeNull();
      const rowTrue = (detailTrue.data as Array<Record<string, unknown>>)[0];
      expect(Object.keys(rowTrue).sort()).toEqual(HEADER_KEYS);
      const questionsTrue = rowTrue.questions as Array<Record<string, unknown>>;
      expect(questionsTrue).toHaveLength(2);
      for (const question of questionsTrue) expect(Object.keys(question).sort()).toEqual(QUESTION_KEYS);
      const q1True = questionsTrue.find((question) => question.question_id === Q1)!;
      const commentsQ1True = q1True.comments as Array<Record<string, unknown>>;
      expect(commentsQ1True).toHaveLength(1);
      expect(Object.keys(commentsQ1True[0]).sort()).toEqual(COMMENT_KEYS);

      const toggleScoreOff = await admin.from("community_solutions").update({ show_score: false }).eq("id", sol);
      if (toggleScoreOff.error) throw toggleScoreOff.error;
      const detailFalse = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const rowFalse = (detailFalse.data as Array<Record<string, unknown>>)[0];
      expect(Object.keys(rowFalse).sort()).toEqual(HEADER_KEYS);
      expect(rowFalse.score).toBeNull();
      expect(rowFalse.score_grading).toBeNull();
      expect(rowFalse.per_question).toBeNull();
      const questionsFalse = rowFalse.questions as Array<Record<string, unknown>>;
      for (const question of questionsFalse) expect(Object.keys(question).sort()).toEqual(QUESTION_KEYS);

      const restoreScoreOn = await admin.from("community_solutions").update({ show_score: true }).eq("id", sol);
      if (restoreScoreOn.error) throw restoreScoreOn.error;
    });

    it("AC-048: rút ngắn rồi xoá hẳn ghi chú dưới 15 từ đều làm rơi bình luận của câu đó khỏi list.comment_count và khỏi detail (comment_count null, không phải 0); khôi phục ghi chú 15 từ trả lại đúng giá trị cũ", async () => {
      const baselineList = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      const baselineRow = (baselineList.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!;
      expect(baselineRow.comment_count).toBe(1);
      const baselineDetail = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const baselineQuestions = (baselineDetail.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions;
      expect(baselineQuestions.find((q) => q.question_id === Q1)!.comment_count).toBe(1);
      // Câu 2 có ghi chú ≥15 từ nhưng KHÔNG bình luận nào — "có bề mặt bình luận"
      // nên comment_count là 0 (một số nguyên), KHÔNG phải null.
      expect(baselineQuestions.find((q) => q.question_id === Q2)!.comment_count).toBe(0);

      const shorten = await admin
        .from("community_solution_notes")
        .update({ body: csWords(14) })
        .eq("solution_id", sol)
        .eq("question_id", Q1);
      if (shorten.error) throw shorten.error;
      const listAfterShorten = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listAfterShorten.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(0);
      const detailAfterShorten = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const q1AfterShorten = (detailAfterShorten.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions.find(
        (q) => q.question_id === Q1,
      )!;
      expect(q1AfterShorten.comment_count).toBeNull();
      expect((q1AfterShorten.comments as unknown[]).length).toBe(0);

      const restore15 = await admin
        .from("community_solution_notes")
        .update({ body: csWords(15) })
        .eq("solution_id", sol)
        .eq("question_id", Q1);
      if (restore15.error) throw restore15.error;
      const listRestored = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listRestored.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(1);
      const detailRestored = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const q1Restored = (detailRestored.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions.find(
        (q) => q.question_id === Q1,
      )!;
      expect(q1Restored.comment_count).toBe(1);
      expect((q1Restored.comments as unknown[]).length).toBe(1);

      // Xoá hẳn ghi chú — cùng con đường "không tồn tại note ≥15 từ" như rút ngắn.
      const deleteNote = await admin.from("community_solution_notes").delete().eq("solution_id", sol).eq("question_id", Q1);
      if (deleteNote.error) throw deleteNote.error;
      const listAfterDelete = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listAfterDelete.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(0);
      const detailAfterDelete = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const q1AfterDelete = (detailAfterDelete.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions.find(
        (q) => q.question_id === Q1,
      )!;
      expect(q1AfterDelete.comment_count).toBeNull();
      expect((q1AfterDelete.comments as unknown[]).length).toBe(0);

      const reinsertNote = await admin.from("community_solution_notes").insert({ solution_id: sol, question_id: Q1, body: csWords(15) });
      if (reinsertNote.error) throw reinsertNote.error;
      const listFinal = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listFinal.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(1);
    });

    it("AC-047: xoá id của câu 1 khỏi exams.question_ids làm rơi đúng số bình luận của câu đó khỏi list.comment_count, detail không còn dòng/comment_count cho câu đó; khôi phục id trả lại mọi giá trị", async () => {
      const removeQ1 = await admin.from("exams").update({ question_ids: [Q2] }).eq("id", EXAM_ID);
      if (removeQ1.error) throw removeQ1.error;
      const listAfterRemove = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listAfterRemove.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(0);
      const detailAfterRemove = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const questionsAfterRemove = (detailAfterRemove.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions;
      expect(questionsAfterRemove.some((q) => q.question_id === Q1)).toBe(false);
      expect(questionsAfterRemove).toHaveLength(1);

      const restoreQuestionIds = await admin.from("exams").update({ question_ids: [Q1, Q2] }).eq("id", EXAM_ID);
      if (restoreQuestionIds.error) throw restoreQuestionIds.error;
      const listRestored = await reader.client.rpc("community_solutions_list", { p_exam_id: EXAM_ID });
      expect((listRestored.data as Array<Record<string, unknown>>).find((row) => row.id === sol)!.comment_count).toBe(1);
      const detailRestored = await reader.client.rpc("community_solution_detail", { p_solution_id: sol });
      const questionsRestored = (detailRestored.data as Array<{ questions: Array<Record<string, unknown>> }>)[0].questions;
      expect(questionsRestored).toHaveLength(2);
      const q1Restored = questionsRestored.find((q) => q.question_id === Q1)!;
      expect(q1Restored.comment_count).toBe(1);
      expect((q1Restored.comments as unknown[]).length).toBe(1);
    });
  },
);
