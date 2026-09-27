// Community Solutions — SERVICE-INTEGRATION-E2E lane (task 47, P5-T8)
// Design Doc: docs/design/community-solutions-backend-design.md — § Verification
//   Strategy Early Verification Point, § Integration Verification Points, § Test
//   Boundaries, § Data Contracts (`save_community_solution` "Save refusal
//   carrier", `set_community_solution_status` "Missing-count carrier",
//   `community_solutions_list` / `community_solution_detail` masking, Admin RPCs
//   "Queue row condition" / "Queue row columns")
// PRD: docs/prd/community-solutions-prd.md (AC-002, AC-029, AC-039, AC-048,
//   AC-075, AC-085, AC-105, M5, S5)
// Plan: docs/plans/20260917-feature-community-solutions.md (§ P5-T8, § Open Items
//   SK-2, Reference Contract Values #12, #13)
// Budget: service-integration-e2e 2/2 — SE1 and SE2 only.
//
// NOTHING IS MOCKED. Every RPC under test runs on a real `authenticated` session
// (writer A, non-submitter N, reader B, the seeded admin) against the dev
// project. The service key is used only by the fixture file, for setup/cleanup
// and for direct read-backs that are independent of the RPC under test. TD-029:
// no import of `@/lib/supabase/service-role` here or in the fixture file.
//
// Run: `npm run test:localdb` (from SOURCE/). Precondition: `npm run
// verify:schema` green on dev — a `PGRST202` here means the DDL is missing:
// fix the database, not the test.
//
// Refusals are asserted on `error.code` and `error.details` only. The message
// is server-log context and is asserted nowhere, so moving the count or the
// token back into the message turns SE1 red.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminClient,
  cleanUp,
  countSolutions,
  createAccount,
  createExam,
  HAS_LIVE_DB,
  insertResult,
  readSolution,
  setProfile,
  signInAsSeededAdmin,
  submittedAttempt,
  words,
  type Account,
} from "./communitySolutionsServiceFixtures";

const SETUP_TIMEOUT = 180_000;
const CASE_TIMEOUT = 60_000;

// =============================================================================
// SE1 [reserved slot] — save_community_solution -> set_community_solution_status
//   ('publish') against real Postgres: eligibility gate, word-count gate,
//   persisted state, whole-call rollback (AC-002, AC-029; RCV #12, #13)
// =============================================================================
// Primary failure mode: the R1 gate re-derived inside these two RPCs diverges
//   from exam_answer_key()'s own gate, or a refused call writes part of its
//   payload. Every check reads the tables directly BEFORE and AFTER the call.
describe.skipIf(!HAS_LIVE_DB)("SE1 — write + publish persist on real Postgres; refusals change nothing", () => {
  const admin: SupabaseClient = adminClient();
  const GROUP = { examSlot: "se1", accountSlots: ["se1-author", "se1-writer", "se1-outsider"] };
  let writer!: Account;
  let outsider!: Account;
  let examId!: string;
  let questionIds!: string[];
  let writerAttemptId!: string;

  beforeAll(async () => {
    await cleanUp(admin, GROUP);
    const author = await createAccount(admin, "se1-author");
    writer = await createAccount(admin, "se1-writer");
    outsider = await createAccount(admin, "se1-outsider");
    ({ examId, questionIds } = await createExam(admin, "se1", author.id, 5));
    writerAttemptId = await submittedAttempt(admin, writer.id, examId);
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    await cleanUp(admin, GROUP);
  }, SETUP_TIMEOUT);

  it("(1) happy path: every current note >= 15 words -> status literally 'published' in the table", async () => {
    const before = await readSolution(admin, examId, writer.id);
    expect(before.status).toBeNull();

    const notes = questionIds.map((question_id, i) => ({ question_id, body: words(15, `q${i + 1}w`) }));
    const saved = await writer.client.rpc("save_community_solution", {
      p_exam_id: examId,
      p_attempt_id: writerAttemptId,
      p_show_profile: true,
      p_show_score: false,
      p_notes: notes,
    });
    expect(saved.error).toBeNull();

    const afterSave = await readSolution(admin, examId, writer.id);
    expect(afterSave.status).toBe("draft");
    expect(afterSave.notes).toEqual(Object.fromEntries(notes.map((n) => [n.question_id, n.body])));

    const published = await writer.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: "publish" });
    expect(published.error).toBeNull();
    expect(published.data).toEqual([{ status: "published" }]);

    const afterPublish = await readSolution(admin, examId, writer.id);
    expect(afterPublish.status).toBe("published");
    expect(afterPublish.notes).toEqual(afterSave.notes);
  }, CASE_TIMEOUT);

  it("(2a) save refusal: a 9-word note on the published solution -> 23514, DETAIL exactly 'below_word_count', nothing written", async () => {
    const before = await readSolution(admin, examId, writer.id);
    expect(before.status).toBe("published");

    const refused = await writer.client.rpc("save_community_solution", {
      p_exam_id: examId,
      p_attempt_id: writerAttemptId,
      p_show_profile: true,
      p_show_score: false,
      p_notes: [{ question_id: questionIds[0], body: words(9, "short") }],
    });
    expect(refused.error?.code).toBe("23514");
    expect(refused.error?.details).toBe("below_word_count");

    expect(await readSolution(admin, examId, writer.id)).toEqual(before);
  }, CASE_TIMEOUT);

  it("(2b) publish refusal: three notes shortened below 15 words -> 23514, DETAIL exactly '3', status and every note body unchanged", async () => {
    // Shortening is only possible while the solution is a draft (a published
    // note may not drop below 15 words — case 2a), so unpublish first.
    const unpublished = await writer.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: "draft" });
    expect(unpublished.error).toBeNull();
    const shortened = await writer.client.rpc("save_community_solution", {
      p_exam_id: examId,
      p_attempt_id: writerAttemptId,
      p_show_profile: true,
      p_show_score: false,
      p_notes: questionIds.slice(2).map((question_id) => ({ question_id, body: words(9, "cut") })),
    });
    expect(shortened.error).toBeNull();

    const before = await readSolution(admin, examId, writer.id);
    expect(before.status).toBe("draft");

    const refused = await writer.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: "publish" });
    expect(refused.error?.code).toBe("23514");
    // Exact string equality: '3', never ' 3', '3 questions' or '+3'.
    expect(refused.error?.details).toBe("3");
    expect(refused.data).toBeNull();

    const after = await readSolution(admin, examId, writer.id);
    expect(after.status).toBe("draft");
    expect(after).toEqual(before);
  }, CASE_TIMEOUT);

  it("(3) ineligible caller: a non-submitter -> 42501 and zero community_solutions row for (exam_id, author_id)", async () => {
    expect(await countSolutions(admin, examId, outsider.id)).toBe(0);

    const saved = await outsider.client.rpc("save_community_solution", {
      p_exam_id: examId,
      p_attempt_id: null,
      p_show_profile: true,
      p_show_score: false,
      p_notes: questionIds.map((question_id) => ({ question_id, body: words(15) })),
    });
    expect(saved.error?.code).toBe("42501");

    const published = await outsider.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: "publish" });
    expect(published.error?.code).toBe("42501");

    expect(await countSolutions(admin, examId, outsider.id)).toBe(0);
  }, CASE_TIMEOUT);
});

// =============================================================================
// SE2 [additional slot] — anonymity masking is a literal JSON null in the live
//   RPC body; the admin queue carries the real identity (AC-039, AC-105, M5,
//   S5, AC-075, AC-085; SK-2)
// =============================================================================
// SK-2 (resolved 2026-09-20): `community_solutions_list()` /
//   `community_solution_detail()` mask by `show_profile` alone for EVERY caller,
//   admins included (AC-062) — so the admin reads of those two functions must
//   return the same nulls. The only admin path to the real identity is
//   `admin_list_community_reports()`: real `author_display_name` and
//   `author_is_anonymous_to_readers`, no `author_id`, no avatar path.
// Primary failure mode: an edit to a masking RPC restores a raw column and
//   leaks identity or score on an anonymous / show_score=false row.
const MASKED_SOLUTION_FIELDS = ["author_id", "author_display_name", "author_avatar_path", "score", "score_grading"] as const;
const MASKED_COMMENT_FIELDS = ["author_id", "author_display_name", "author_avatar_path"] as const;
const WRITER_DISPLAY_NAME = "CS47 Người viết thật";

type JsonRow = Record<string, unknown>;
type DetailComment = JsonRow & { id: string };
type DetailQuestion = JsonRow & { question_id: string; comments: DetailComment[] };

function expectFieldsNull(row: JsonRow | undefined, fields: readonly string[]): void {
  expect(row).toBeDefined();
  for (const field of fields) expect(row).toHaveProperty(field, null);
}

describe.skipIf(!HAS_LIVE_DB)("SE2 — anonymous solution/comment masked to JSON null; admin queue shows the real writer", () => {
  const admin: SupabaseClient = adminClient();
  const GROUP = { examSlot: "se2", accountSlots: ["se2-author", "se2-writer", "se2-reader"] };
  let writer!: Account;
  let reader!: Account;
  let adminSession!: SupabaseClient;
  let examId!: string;
  let questionIds!: string[];
  let solutionId!: string;
  let readerCommentId!: string;
  let writerCommentId!: string;

  async function listRow(client: SupabaseClient): Promise<JsonRow | undefined> {
    const res = await client.rpc("community_solutions_list", { p_exam_id: examId });
    expect(res.error).toBeNull();
    return (res.data as JsonRow[]).find((row) => row.id === solutionId);
  }

  async function detailRow(client: SupabaseClient): Promise<JsonRow & { questions: DetailQuestion[] }> {
    const res = await client.rpc("community_solution_detail", { p_solution_id: solutionId });
    expect(res.error).toBeNull();
    const rows = res.data as (JsonRow & { questions: DetailQuestion[] })[];
    expect(rows).toHaveLength(1);
    return rows[0];
  }

  function commentOf(detail: { questions: DetailQuestion[] }, commentId: string): DetailComment | undefined {
    return detail.questions.find((q) => q.question_id === questionIds[0])?.comments.find((c) => c.id === commentId);
  }

  beforeAll(async () => {
    await cleanUp(admin, GROUP);
    const author = await createAccount(admin, "se2-author");
    writer = await createAccount(admin, "se2-writer");
    reader = await createAccount(admin, "se2-reader");
    const seededAdmin = await signInAsSeededAdmin(admin);
    adminSession = seededAdmin.client;
    ({ examId, questionIds } = await createExam(admin, "se2", author.id, 2));

    // Real stored values the masked columns must hide and the admin queue must show.
    await setProfile(admin, writer.id, { displayName: WRITER_DISPLAY_NAME, avatarPath: `${writer.id}/cs47-avatar.png` });
    const writerAttemptId = await submittedAttempt(admin, writer.id, examId);
    await insertResult(admin, { attemptId: writerAttemptId, userId: writer.id, questionIds, totalScore: 7.5 });
    // Both readers need their own submitted attempt: list/detail are R1-gated for
    // every caller, so without it the admin read would return zero rows and prove nothing.
    await submittedAttempt(admin, reader.id, examId);
    await submittedAttempt(admin, seededAdmin.id, examId);

    const saved = await writer.client.rpc("save_community_solution", {
      p_exam_id: examId,
      p_attempt_id: writerAttemptId,
      p_show_profile: false,
      p_show_score: false,
      p_notes: questionIds.map((question_id, i) => ({ question_id, body: words(15, `q${i + 1}w`) })),
    });
    if (saved.error) throw saved.error;
    solutionId = (saved.data as { solution_id: string }[])[0].solution_id;
    const published = await writer.client.rpc("set_community_solution_status", { p_exam_id: examId, p_action: "publish" });
    if (published.error) throw published.error;

    const readerComment = await reader.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: questionIds[0],
      p_body: "Bình luận ẩn danh của người đọc B",
      p_is_anonymous: true,
    });
    if (readerComment.error) throw readerComment.error;
    readerCommentId = (readerComment.data as { comment_id: string }[])[0].comment_id;

    // The writer's own non-anonymous comment under a show_profile=false solution
    // is masked too (comment identity condition) — and is the is_solution_author=true case.
    const writerComment = await writer.client.rpc("post_community_comment", {
      p_solution_id: solutionId,
      p_question_id: questionIds[0],
      p_body: "Người viết trả lời dưới bài giải của mình",
      p_is_anonymous: false,
    });
    if (writerComment.error) throw writerComment.error;
    writerCommentId = (writerComment.data as { comment_id: string }[])[0].comment_id;
  }, SETUP_TIMEOUT);

  afterAll(async () => {
    await cleanUp(admin, GROUP);
  }, SETUP_TIMEOUT);

  it("non-author, non-admin reader B: identity and score fields are JSON null on the solution (list + detail) and on the anonymous comment", async () => {
    const list = await listRow(reader.client);
    expectFieldsNull(list, MASKED_SOLUTION_FIELDS);
    expect(list).toHaveProperty("is_mine", false);

    const detail = await detailRow(reader.client);
    expectFieldsNull(detail, [...MASKED_SOLUTION_FIELDS, "per_question"]);

    const anonymousComment = commentOf(detail, readerCommentId);
    expectFieldsNull(anonymousComment, MASKED_COMMENT_FIELDS);
    expect(anonymousComment).toHaveProperty("is_solution_author", false);
    expect(anonymousComment).toHaveProperty("is_mine", true);

    const writerComment = commentOf(detail, writerCommentId);
    expectFieldsNull(writerComment, MASKED_COMMENT_FIELDS);
    expect(writerComment).toHaveProperty("is_solution_author", true);
  }, CASE_TIMEOUT);

  it("admin session reading list/detail gets the SAME nulls — no admin exception on a masking RPC (AC-062, SK-2)", async () => {
    const list = await listRow(adminSession);
    expectFieldsNull(list, MASKED_SOLUTION_FIELDS);

    const detail = await detailRow(adminSession);
    expectFieldsNull(detail, [...MASKED_SOLUTION_FIELDS, "per_question"]);
    expectFieldsNull(commentOf(detail, readerCommentId), MASKED_COMMENT_FIELDS);
    expectFieldsNull(commentOf(detail, writerCommentId), MASKED_COMMENT_FIELDS);
  }, CASE_TIMEOUT);

  it("admin leg: after B reports the solution (reader view unchanged, AC-075), admin_list_community_reports shows A's real display name and author_is_anonymous_to_readers = true (S5)", async () => {
    const tableBefore = await readSolution(admin, examId, writer.id);
    const readerViewBefore = await listRow(reader.client);
    expect(tableBefore.status).toBe("published");

    const reported = await reader.client.rpc("report_community_solution", {
      p_solution_id: solutionId,
      p_reason: "[CS47] nội dung cần admin xem lại",
    });
    expect(reported.error).toBeNull();

    // AC-075: a report changes nothing a reader sees.
    expect(await readSolution(admin, examId, writer.id)).toEqual(tableBefore);
    const readerViewAfter = await listRow(reader.client);
    expect(readerViewAfter?.status).toBe(readerViewBefore?.status);
    expect(readerViewAfter?.is_pinned).toBe(readerViewBefore?.is_pinned);
    expect(readerViewAfter?.helpful_count).toBe(readerViewBefore?.helpful_count);
    expect(readerViewAfter?.comment_count).toBe(readerViewBefore?.comment_count);
    expect(readerViewAfter?.comment_count).toBe(2);

    const queue = await adminSession.rpc("admin_list_community_reports");
    expect(queue.error).toBeNull();
    const queueRow = (queue.data as JsonRow[]).find((row) => row.id === solutionId);
    expect(queueRow).toBeDefined();
    expect(queueRow).toHaveProperty("author_display_name", WRITER_DISPLAY_NAME);
    expect(queueRow).toHaveProperty("author_is_anonymous_to_readers", true);
  }, CASE_TIMEOUT);
});
