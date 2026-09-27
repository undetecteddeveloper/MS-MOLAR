// Community Solutions [integration] Test Skeleton
// Design Docs: docs/design/community-solutions-backend-design.md (v1.1),
//   docs/design/community-solutions-frontend-design.md (v1.1)
// UI Spec: docs/ui-spec/community-solutions-ui-spec.md
// PRD: docs/prd/community-solutions-prd.md (v1.3)
// Generated: 2026-09-17 | Budget Used: integration 3/3, fixture-e2e 3/3, service-integration-e2e 2/1-2
//
// SKELETON ONLY — comment-based design intent. No imports, no describe/it, no
// assertions yet, by design (testing-principles skill: a committed skeleton
// must stay green under tsc/eslint/build before the referenced modules exist).
// features/solutions/** does not exist yet; this feature's migration is NOT
// yet applied to dev (hynwleaxtbtjzkvpjsug) — this is still the design phase.
// The implementing task adds real imports + vitest runner blocks + assertions
// alongside features/solutions/actions.ts / queries.ts / adminActions.ts, in
// the same commit (Red -> Green in one task), per this repo's rating.int.test.ts
// precedent (SOURCE/features/exams/__tests__/rating.int.test.ts).
//
// Mock boundary (backend DD § Test Boundaries, Mock Boundary Decisions table):
// the Supabase SESSION client (.rpc/.from calls returned by
// @/lib/supabase/server createClient()) is the only sanctioned mock in this
// file — mirrors rating.int.test.ts's existing vi.mock("@/lib/supabase/server")
// convention. Real Postgres RLS/RPC/masking correctness is explicitly NOT
// provable with a mock ("no mock can verify that... masking case when
// expressions actually evaluate to null in the live response" — backend DD
// § Data Layer Testing Strategy); that proof lives in this feature's
// service-integration-e2e file, not here. This file proves Server Action /
// query-wrapper business logic, call construction, and error mapping only.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts and lib/auth/admin.ts import "server-only" (throws outside a
// Next server/react-server bundle) — same stub as rating.int.test.ts /
// getResult.int.test.ts.
vi.mock("server-only", () => ({}));

const { getUserMock, rpcMock, fromMock, isAdminUserIdMock, createSignedUrlsMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  // Test 1 (b): a spy, so "zero .from(...) calls" is an assertion on a
  // recorded call log rather than on a TypeError from a missing method.
  fromMock: vi.fn(),
  isAdminUserIdMock: vi.fn(),
  // Test 3 (task 42 integration handoff, see task 14's Investigation Notes):
  // listSolutions/getSolutionDetail now batch-sign every named row's
  // author_avatar_path before toAuthorIdentity. Echoes a deterministic signed
  // value per path — the batching/fail-closed Storage contract itself is
  // proven in features/solutions/__tests__/avatarSigner.test.ts (task 42).
  createSignedUrlsMock: vi.fn(async (paths: string[]) => ({
    data: paths.map((path) => ({ path, signedUrl: `signed:${path}`, error: null })),
    error: null,
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: fromMock,
    storage: { from: () => ({ createSignedUrls: createSignedUrlsMock }) },
  })),
}));

// adminActions.ts's app-layer pre-check (Test 1 + the admin rows below).
vi.mock("@/lib/auth/admin", () => ({ isAdminUserId: isAdminUserIdMock }));

// adminActions.ts revalidates /admin after an accepted moderation; outside a
// Next request the real revalidatePath has no store to write to.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { saveSolution, setSolutionStatus } = await import("@/features/solutions/actions");
const { listSolutions, getSolutionDetail } = await import("@/features/solutions/queries");
const { listCommunityReports, getSolutionNotesForAdmin, moderateSolutionAction, moderateCommentAction } =
  await import("@/features/solutions/adminActions");

const ADMIN_ACTIONS_SOURCE_PATH = fileURLToPath(new URL("../adminActions.ts", import.meta.url));
const ADMIN_ACTION_ERROR_KEY = "admin.solutions.actionError";

// =============================================================================
// Test 1 — adminActions.ts: admin moderation never touches service-role.ts;
//   moderation writes flow only through session-client RPC calls
//   (TD-029 boundary — required by the orchestration prompt to have >=1
//   skeleton proving this boundary, not only stated in documentation)
// =============================================================================
// AC: "The system shall implement every admin moderation write as a
//   SECURITY DEFINER function granted to authenticated, and shall add zero
//   exported functions and zero direct table writers to
//   SOURCE/lib/supabase/service-role.ts." (PRD NFR Bảo mật, M9; backend DD
//   § Agreement Checklist Non-Scope: "SOURCE/lib/supabase/service-role.ts —
//   zero exported functions added, zero direct writers added")
// ROI: 59 (BV:8 x Freq:5 + Legal:10 + Defect:9)
// Behavior: moderateSolutionAction / moderateCommentAction
//   (features/solutions/adminActions.ts) are invoked against a mocked
//   session Supabase client -> each call issues exactly one
//   .rpc("admin_moderate_community_solution" | "admin_moderate_community_comment",
//   {...}) on the SESSION client -> the module under test imports nothing
//   from "@/lib/supabase/service-role".
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/adminActions.ts (moderateSolutionAction,
//   moderateCommentAction) + mocked session Supabase client
// @complexity: low
// @real-dependency: none — the session client is the sanctioned mock
//   boundary here; the real is_admin_user() DB-layer rejection for a
//   non-admin caller is proven in the service-integration-e2e file's
//   admin-facing case (Test SE2's admin-vs-non-admin read), not here.
// Primary failure mode: a future edit routes admin moderation through
//   lib/supabase/service-role.ts (a 14th exported operation or a 5th direct
//   writer), silently reopening the frozen surface TD-029/ADR-0019 forbids.
// Proof obligation: (a) static-import check — features/solutions/adminActions.ts
//   contains zero imports of "@/lib/supabase/service-role"; (b) call-pattern
//   assertion — the mocked session client's .rpc() is called with exactly
//   "admin_moderate_community_solution" / "admin_moderate_community_comment",
//   never a direct .from("community_solutions").update(...) write; (c) note
//   that SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts (13
//   exports / 4 direct writers, unmodified) is the complementary repo-wide
//   proof this test does not duplicate — that file proves "the whole repo
//   didn't grow," this file proves "this feature's own code never reaches
//   for it."
// Verification points / expected results / pass criteria:
//   - moderateSolutionAction(id, "hide", reason) -> mocked client .rpc called
//     exactly once with "admin_moderate_community_solution"; zero calls to
//     .from("community_solutions")
//   - moderateCommentAction(id, "hide", reason) -> same shape, RPC name
//     "admin_moderate_community_comment"
//   - static check: zero occurrences of a "service-role" import path anywhere
//     in features/solutions/adminActions.ts's source
//   - pass criteria: all three checks hold; the test fails if any admin
//     write path bypasses the RPC or imports service-role.ts
// SK-1 (plan § Open Items, resolved 2026-09-20): the declared signature is
//   (prevState, formData), so the call above is made with a FormData carrying
//   the id, "hide" and the reason — no positional-argument overload exists.

let adminUidCounter = 0;
/** A fresh admin id per test: the real guard() keeps a per-user in-memory
 *  counter, so reusing one id across many moderation calls could trip the
 *  30/hour limit and turn an unrelated assertion red. */
function signInFreshAdmin() {
  adminUidCounter += 1;
  const id = `admin-actions-admin-${adminUidCounter}`;
  getUserMock.mockResolvedValue({ data: { user: { id } } });
  isAdminUserIdMock.mockImplementation((userId: string | null | undefined) => userId === id);
  return id;
}

function signInNonAdmin() {
  getUserMock.mockResolvedValue({ data: { user: { id: "admin-actions-not-an-admin" } } });
  isAdminUserIdMock.mockReturnValue(false);
}

function moderationForm(idField: "solutionId" | "commentId", id: string, action: string, reason?: string) {
  const formData = new FormData();
  formData.set(idField, id);
  formData.set("action", action);
  if (reason !== undefined) formData.set("reason", reason);
  return formData;
}

function readAdminActionsSource() {
  return readFileSync(ADMIN_ACTIONS_SOURCE_PATH, "utf8");
}

function resetAdminMocks() {
  getUserMock.mockReset();
  rpcMock.mockReset();
  fromMock.mockReset();
  isAdminUserIdMock.mockReset();
}

describe("adminActions.ts — admin moderation writes flow only through session-client RPCs, never service-role.ts (Test 1)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  it("(b) moderateSolutionAction(undefined, FormData{solutionId, 'hide', reason}) -> exactly one .rpc('admin_moderate_community_solution'), zero .from(...) calls", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ status: "hidden" }], error: null });

    const result = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-t1", "hide", "Nội dung sai lệch")
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_moderate_community_solution", {
      p_solution_id: "solution-t1",
      p_action: "hide",
      p_reason: "Nội dung sai lệch",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, status: "hidden" });
  });

  it("(b) moderateCommentAction(undefined, FormData{commentId, 'hide', reason}) -> exactly one .rpc('admin_moderate_community_comment'), zero .from(...) calls", async () => {
    rpcMock.mockResolvedValueOnce({ data: [{ status: "hidden" }], error: null });

    const result = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-t1", "hide", "Xúc phạm người khác")
    );

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_moderate_community_comment", {
      p_comment_id: "comment-t1",
      p_action: "hide",
      p_reason: "Xúc phạm người khác",
    });
    expect(fromMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true, status: "hidden" });
  });

  it("(a)/(c) static check: adminActions.ts contains zero 'service-role' import paths (serviceRoleSurface.test.ts is the complementary repo-wide proof)", () => {
    const source = readAdminActionsSource();

    expect(source).not.toMatch(/service-role/);
    expect(source).not.toMatch(/\.from\(/);
  });
});

describe("adminActions.ts — Required test list rows 4-8 (validation, admin pre-check, error mapping)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("row 4: a crafted action outside {hide, restore, delete} is rejected before any call, for both actions", async () => {
    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r4", "purge", "lý do")
    );
    const commentResult = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-r4", "purge", "lý do")
    );

    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
  });

  it("row 5: 'hide' or 'delete' with an empty / whitespace-only / missing reason -> .rpc count 0 and { error: key } (AC-082, AC-106)", async () => {
    const results = [
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "hide", "")),
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "delete", "   \n\t ")),
      await moderateSolutionAction(null, moderationForm("solutionId", "solution-r5", "hide")),
      await moderateCommentAction(null, moderationForm("commentId", "comment-r5", "hide", "  ")),
      await moderateCommentAction(null, moderationForm("commentId", "comment-r5", "delete", "")),
    ];

    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(results).toEqual(Array(5).fill({ error: ADMIN_ACTION_ERROR_KEY }));
  });

  it("row 6: 'restore' with no reason is accepted — the RPC is called for both actions", async () => {
    rpcMock
      .mockResolvedValueOnce({ data: [{ status: "published" }], error: null })
      .mockResolvedValueOnce({ data: [{ status: "visible" }], error: null });

    const solutionResult = await moderateSolutionAction(null, moderationForm("solutionId", "solution-r6", "restore"));
    const commentResult = await moderateCommentAction(null, moderationForm("commentId", "comment-r6", "restore"));

    expect(rpcMock).toHaveBeenCalledTimes(2);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "admin_moderate_community_solution", {
      p_solution_id: "solution-r6",
      p_action: "restore",
      p_reason: "",
    });
    expect(rpcMock).toHaveBeenNthCalledWith(2, "admin_moderate_community_comment", {
      p_comment_id: "comment-r6",
      p_action: "restore",
      p_reason: "",
    });
    expect(solutionResult).toEqual({ ok: true, status: "published" });
    expect(commentResult).toEqual({ ok: true, status: "visible" });
  });

  it("row 7: isAdminUserId -> false refuses all four functions with .rpc count 0 (AC-085)", async () => {
    signInNonAdmin();

    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r7", "hide", "lý do")
    );
    const commentResult = await moderateCommentAction(
      null,
      moderationForm("commentId", "comment-r7", "hide", "lý do")
    );
    await expect(listCommunityReports()).rejects.toThrow();
    await expect(getSolutionNotesForAdmin("solution-r7")).rejects.toThrow();

    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(rpcMock).toHaveBeenCalledTimes(0);
    expect(fromMock).toHaveBeenCalledTimes(0);
  });

  it("row 7 (signed out): no session user is refused the same way, with .rpc count 0", async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });
    isAdminUserIdMock.mockReturnValue(false);

    const solutionResult = await moderateSolutionAction(
      null,
      moderationForm("solutionId", "solution-r7b", "hide", "lý do")
    );
    await expect(listCommunityReports()).rejects.toThrow();

    expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
    expect(rpcMock).toHaveBeenCalledTimes(0);
  });

  it.each([
    {
      code: "42501",
      expectedLogCalls: [
        ["[admin_moderate_community_solution]", "42501"],
        ["[admin_moderate_community_comment]", "42501"],
      ],
    },
    { code: "22023", expectedLogCalls: [] },
    { code: "P0002", expectedLogCalls: [] },
  ])(
    "row 8: RPC error $code -> both moderation actions return the fixed key; error.message is never read nor forwarded; only 42501 is logged (RPC name + code)",
    async ({ code, expectedLogCalls }) => {
      const databaseMessage = `admin_moderate_community_x: leaked detail for ${code}`;
      let messageReads = 0;
      const rpcError = {
        code,
        get message() {
          messageReads += 1;
          return databaseMessage;
        },
      };
      rpcMock.mockResolvedValue({ data: null, error: rpcError });
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const solutionResult = await moderateSolutionAction(
        null,
        moderationForm("solutionId", "solution-r8", "hide", "lý do kiểm duyệt riêng tư")
      );
      const commentResult = await moderateCommentAction(
        null,
        moderationForm("commentId", "comment-r8", "hide", "lý do kiểm duyệt riêng tư")
      );

      expect(solutionResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
      expect(commentResult).toEqual({ error: ADMIN_ACTION_ERROR_KEY });
      expect(messageReads).toBe(0);
      expect(JSON.stringify([solutionResult, commentResult])).not.toContain("leaked detail");
      expect(errorSpy.mock.calls).toEqual(expectedLogCalls);
      for (const call of errorSpy.mock.calls) {
        expect(call.map(String).join(" ")).not.toContain("lý do kiểm duyệt riêng tư");
      }
    }
  );

  it("row 8 (source): adminActions.ts never reads error.message", () => {
    expect(readAdminActionsSource()).not.toMatch(/error\.message|\.message\b/);
  });
});

/** A queue row in the RPC's snake_case shape (migration task 32), unmasked (S5). */
function queueRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "solution-q1",
    exam_id: "exam-q1",
    exam_title: "Đề thi thử THPT 2026",
    author_display_name: "Nguyễn Văn A",
    author_is_anonymous_to_readers: false,
    status: "published",
    report_count: 2,
    report_reasons: ["spam", "sai đáp án"],
    reported_comments: [],
    hidden_comments: [],
    ...overrides,
  };
}

describe("listCommunityReports / getSolutionNotesForAdmin — Required test list rows 9-16 (unmasked admin mappers)", () => {
  beforeEach(() => {
    resetAdminMocks();
    signInFreshAdmin();
  });

  it("row 9: author_is_anonymous_to_readers = true keeps the real name; AdminReportedAuthor has exactly {displayName, isAnonymousToReaders}", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [queueRow({ author_display_name: "Trần Thị Bích", author_is_anonymous_to_readers: true })],
      error: null,
    });

    const [row] = await listCommunityReports();

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_list_community_reports");
    expect(row.author.isAnonymousToReaders).toBe(true);
    expect(row.author.displayName).toBe("Trần Thị Bích");
    expect(row.author.displayName).not.toBe("Ẩn danh");
    expect("avatarUrl" in row.author).toBe(false);
    expect(Object.keys(row.author).sort()).toEqual(["displayName", "isAnonymousToReaders"]);
    expect(row).toEqual({
      id: "solution-q1",
      examId: "exam-q1",
      examTitle: "Đề thi thử THPT 2026",
      author: { displayName: "Trần Thị Bích", isAnonymousToReaders: true },
      status: "published",
      reportCount: 2,
      reportReasons: ["spam", "sai đáp án"],
      reportedComments: [],
      hiddenComments: [],
    });
  });

  it("row 10: a hidden_comments entry with question_number null -> questionNumber: null (key present), commenter unmasked", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          hidden_comments: [
            {
              id: "comment-h1",
              question_number: null,
              body: "Bình luận **thô**",
              commenter_display_name: "Lê Văn C",
              commenter_is_anonymous_to_readers: true,
              hidden_reason: "Xúc phạm",
              hidden_at: "2026-09-20T10:00:00+00:00",
              report_count: 0,
            },
          ],
        }),
      ],
      error: null,
    });

    const [row] = await listCommunityReports();
    const [hidden] = row.hiddenComments;

    expect("questionNumber" in hidden).toBe(true);
    expect(hidden.questionNumber).toBeNull();
    expect(hidden).toEqual({
      id: "comment-h1",
      questionNumber: null,
      body: "Bình luận **thô**",
      commenter: { displayName: "Lê Văn C", isAnonymousToReaders: true },
      hiddenReason: "Xúc phạm",
      hiddenAt: "2026-09-20T10:00:00+00:00",
      reportCount: 0,
    });
  });

  it("row 11: a reported_comments entry with question_number null -> questionNumber: null (the visible half is nullable too)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          reported_comments: [
            {
              id: "comment-v1",
              question_number: null,
              body: "Bình luận đang hiện",
              commenter_display_name: "Phạm Thị D",
              commenter_is_anonymous_to_readers: false,
              report_count: 3,
              report_reasons: ["spam", "spam", "quấy rối"],
            },
            {
              id: "comment-v2",
              question_number: 4,
              body: "Bình luận câu 4",
              commenter_display_name: "Hoàng Văn E",
              commenter_is_anonymous_to_readers: true,
              report_count: 1,
              report_reasons: ["spam"],
            },
          ],
        }),
      ],
      error: null,
    });

    const [row] = await listCommunityReports();

    expect("questionNumber" in row.reportedComments[0]).toBe(true);
    expect(row.reportedComments).toEqual([
      {
        id: "comment-v1",
        questionNumber: null,
        body: "Bình luận đang hiện",
        commenter: { displayName: "Phạm Thị D", isAnonymousToReaders: false },
        reportCount: 3,
        reportReasons: ["spam", "spam", "quấy rối"],
      },
      {
        id: "comment-v2",
        questionNumber: 4,
        body: "Bình luận câu 4",
        commenter: { displayName: "Hoàng Văn E", isAnonymousToReaders: true },
        reportCount: 1,
        reportReasons: ["spam"],
      },
    ]);
  });

  it("row 12: a hidden row with report_count 0, no reasons, no reported comments and one hidden comment is returned, not filtered out (Reference Contract Value #26)", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [
        queueRow({
          id: "solution-hidden",
          status: "hidden",
          report_count: 0,
          report_reasons: [],
          reported_comments: [],
          hidden_comments: [
            {
              id: "comment-h2",
              question_number: 2,
              body: "Đã ẩn",
              commenter_display_name: "Võ Thị F",
              commenter_is_anonymous_to_readers: false,
              hidden_reason: "Spam",
              hidden_at: "2026-09-21T08:30:00+00:00",
              report_count: 0,
            },
          ],
        }),
      ],
      error: null,
    });

    const rows = await listCommunityReports();

    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe("solution-hidden");
    expect(rows[0].status).toBe("hidden");
    expect(rows[0].reportCount).toBe(0);
    expect(rows[0].reportReasons).toEqual([]);
    expect(rows[0].reportedComments).toEqual([]);
    expect(rows[0].hiddenComments).toHaveLength(1);
  });

  it("row 13: a row with no hidden comment maps hiddenComments to [] (never null or absent)", async () => {
    rpcMock.mockResolvedValueOnce({ data: [queueRow({ hidden_comments: [] })], error: null });

    const [row] = await listCommunityReports();

    expect("hiddenComments" in row).toBe(true);
    expect(row.hiddenComments).toEqual([]);
  });

  it("row 14: no admin row passes through a masking mapper — adminActions.ts references neither toAuthorIdentity nor toScoreField", () => {
    const source = readAdminActionsSource();

    expect(source).not.toContain("toAuthorIdentity");
    expect(source).not.toContain("toScoreField");
    expect(source).not.toMatch(/lib\/solutions\/identity/);
  });

  it("row 15: getSolutionNotesForAdmin(S) maps notes for positions 1 and 3 in array order, body kept as the raw string", async () => {
    const rawBody = "Ta có $x^2 = 4$ nên **x = ±2**.\n\n- bước 1\n- bước 2";
    rpcMock.mockResolvedValueOnce({
      data: [
        { question_number: 1, question_id: "q-1", body: rawBody },
        { question_number: 3, question_id: "q-3", body: "Câu 3: chọn C" },
      ],
      error: null,
    });

    const notes = await getSolutionNotesForAdmin("solution-n1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("admin_get_community_solution_notes", { p_solution_id: "solution-n1" });
    expect(notes).toEqual([
      { questionNumber: 1, questionId: "q-1", body: rawBody },
      { questionNumber: 3, questionId: "q-3", body: "Câu 3: chọn C" },
    ]);
  });

  it("row 16: getSolutionNotesForAdmin(S) with an empty RPC result returns [] as a legal, non-error state", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    await expect(getSolutionNotesForAdmin("solution-empty")).resolves.toEqual([]);
  });
});

// =============================================================================
// Test 2 — saveSolution / setSolutionStatus: word-count validation gate runs
//   before any DB call; a word-count rejection maps to a non-leaking,
//   AC-029-specific error, and never clears the caller's unsaved note text
// =============================================================================
// AC: "...if status = 'published', reject any note whose word count
//   (count_words()) drops below 15 for a question that is still current (S1)
//   — whole call rolls back, nothing partially saved" (backend DD § Data
//   Flow, "Writer saves a draft" step 3); § Error Handling table row 1
//   (errcode 23514 -> AC-029's "nêu số câu chưa đạt" message; "note text is
//   never lost (client-side draft state independent of the server
//   response)").
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Behavior: setSolutionStatus(examId, "publish") is called against a mocked
//   session Supabase client returning a simulated 23514 (check-violation)
//   response -> the Server Action maps it to the exact AC-029 copy.ts key,
//   never a raw Postgres error string/code -> a second, unrelated simulated
//   error (e.g. a generic network failure) maps to the distinct generic
//   "Thao tác thất bại" message, proving the mapping is error-code-specific
//   -> no code path in either branch clears/resets the caller-supplied note
//   text.
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/actions.ts (setSolutionStatus, saveSolution)
//   + mocked session Supabase client
// @complexity: medium
// @real-dependency: none — session client mocked; the real count_words() SQL
//   evaluation and the "whole call rolls back" transactional guarantee are
//   proven in service-integration-e2e (Test SE1, mirroring backend DD's own
//   Early Verification Point).
// Primary failure mode: a 9-word note is allowed to publish because the
//   server's 23514 response is swallowed or mis-mapped to a generic message
//   instead of the AC-029 "chưa đạt" wording, or the caller's typed note text
//   is cleared on the failed-publish branch (violating "note text is never
//   lost").
// Proof obligation: assert the mapped result object for the simulated 23514
//   case carries the AC-029 message key/copy — not the raw Postgres
//   error code/string; assert the simulated infra-error case carries a
//   different, generic message key; assert neither failure branch's return
//   value or side effect references clearing/resetting the note text
//   parameter passed into the action.
// Verification points / expected results / pass criteria:
//   - simulated 23514 -> Server Action result carries the AC-029 message key
//   - simulated generic/infra error -> generic message key, distinct from
//     the 23514 case
//   - the note text argument passed into saveSolution/setSolutionStatus is
//     never touched by any "clear"/"reset" code path in either failure branch
//   - pass criteria: both error branches map to distinct, correct copy keys
//     with no assertion depending on a real DB roundtrip

describe("saveSolution / setSolutionStatus — word-count validation gate, non-leaking error mapping, note text preserved (Test 2)", () => {
  const CALLER_ID = "writer-test2-caller";

  beforeEach(() => {
    getUserMock.mockReset();
    rpcMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: { id: CALLER_ID } } });
  });

  it("simulated 23514 (check-violation) maps to the AC-029 result code {belowWordCount, missingCount}, never a raw Postgres code/string", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "23514", details: "2" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "belowWordCount", missingCount: 2 } });
    expect(JSON.stringify(result)).not.toContain("23514");
  });

  it("a second, unrelated simulated infra error maps to a distinct generic code, proving the mapping is error-code-specific", async () => {
    rpcMock.mockResolvedValue({ data: null, error: { code: "08006", message: "connection reset" } });

    const result = await setSolutionStatus("exam-1", "publish");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("neither failure branch's result or the caller's note text is touched (note text is never lost, AC-024/AC-032)", async () => {
    const originalNote = "Ghi chú của người viết, chưa đủ 15 từ, không được đổi.";
    const patch = {
      attemptId: "attempt-1",
      showProfile: true,
      showScore: false,
      notes: [{ questionId: "q1", body: originalNote }],
    };

    rpcMock.mockResolvedValue({ data: null, error: { code: "23514", details: "below_word_count" } });
    const saveResult = await saveSolution("exam-1", patch);
    expect(saveResult).toEqual({ ok: false, error: { code: "belowWordCount" } });
    // The action's own result carries no note text, and the patch object the
    // caller built is untouched on the failed branch — nothing here clears or
    // resets it (the reducer holding the draft text lives in frontend task 11).
    expect(patch.notes[0].body).toBe(originalNote);
    expect(JSON.stringify(saveResult)).not.toContain(originalNote);

    rpcMock.mockResolvedValue({ data: null, error: { code: "57P01", message: "infra failure" } });
    const statusResult = await setSolutionStatus("exam-1", "publish");
    expect(statusResult).toEqual({ ok: false, error: { code: "generic" } });
    expect(patch.notes[0].body).toBe(originalNote);
  });
});

// =============================================================================
// Test 3 — listSolutions / getSolutionDetail: reads route only through the
//   masking RPCs, never a raw table select; the TS mapper never backfills an
//   identity/score field the RPC row does not carry
// =============================================================================
// AC: "...routing every public read through masking SECURITY DEFINER
//   functions, verified by an integration test enumerating returned field
//   names" (backend DD § Design Summary, biggest_risks row 1); "one
//   designated mapper is the only place null-to-absent normalization
//   happens" (frontend DD § Design Summary, main_constraints).
// ROI: 88 (BV:9 x Freq:9 + Legal:0 + Defect:7)
// Behavior: listSolutions(examId) / getSolutionDetail(solutionId)
//   (features/solutions/queries.ts) are called against a mocked session
//   Supabase client -> exactly one .rpc call is made per function
//   ("community_solutions_list" / "community_solution_detail"), never
//   .from("community_solutions").select(...) -> when the mocked RPC row's
//   author_id / author_display_name / author_avatar_path are null (masked
//   shape), the mapped TS object has no displayName/avatarUrl/authorId key
//   at all for that row (absent, not present-with-null) -> when the mocked
//   row is not masked, the mapped object carries the fixture's own values
//   unchanged.
// @category: core-functionality
// @lane: integration
// @dependency: features/solutions/queries.ts (listSolutions,
//   getSolutionDetail) + mocked session Supabase client
// @complexity: medium
// @real-dependency: none — session client mocked with a hand-built row
//   fixture matching the RPC's documented masked shape; whether the REAL RPC
//   actually produces that shape (SQL `case when` masking) is proven only in
//   service-integration-e2e (Test SE2, the null-value assertion against a
//   live call) — this test cannot and does not claim to prove that.
// Primary failure mode: a future change to queries.ts reads
//   .from("community_solutions") directly (bypassing the masking RPC) for a
//   "quick" list query, or the TS mapper reads row.author_display_name
//   without checking for null and forwards a stray/placeholder value instead
//   of omitting the field — reintroducing the identity-leak risk both design
//   docs name as this feature's top risk, at the mapping layer this time.
// Proof obligation: (a) call-pattern assertion — the mocked client's method
//   log contains exactly one .rpc(name, ...) call per query function under
//   test, and zero .from("community_solutions" | "community_solution_notes")
//   calls; (b) field-enumeration assertion on the mapped result —
//   Object.keys() of the mapped row for a masked fixture must NOT include
//   "displayName" / "avatarUrl" / "authorId" (matching the AuthorIdentity
//   discriminated union's {kind:"anonymous"} branch), and MUST include them,
//   with the fixture's own unmodified values, for a non-masked fixture row.
// Verification points / expected results / pass criteria:
//   - listSolutions() -> exactly one .rpc("community_solutions_list", { p_exam_id })
//   - getSolutionDetail() -> exactly one .rpc("community_solution_detail", { p_solution_id })
//   - masked fixture row -> mapped object has no identity keys present
//   - non-masked fixture row -> mapped object has identity keys equal to the
//     fixture's own values (no transformation drift)
//   - pass criteria: all four assertions hold within the same test run

describe("listSolutions / getSolutionDetail — reads route only through the masking RPCs, mapper never backfills identity (Test 3)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("listSolutions() -> exactly one .rpc(\"community_solutions_list\", { p_exam_id }), never .from(\"community_solutions\")", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await listSolutions("exam-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_solutions_list", { p_exam_id: "exam-1" });
  });

  it("getSolutionDetail() -> exactly one .rpc(\"community_solution_detail\", { p_solution_id })", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });

    await getSolutionDetail("sol-1");

    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenCalledWith("community_solution_detail", { p_solution_id: "sol-1" });
  });

  it("masked fixture row (author_display_name null) -> mapped object has no identity keys present", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-1",
          status: "published",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          is_mine: false,
          author_id: null,
          author_display_name: null,
          author_avatar_path: null,
          score: null,
          score_grading: null,
          helpful_count: 0,
          i_marked_helpful: false,
          comment_count: 0,
          changed_question_count: 0,
        },
      ],
      error: null,
    });

    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({ kind: "anonymous" });
    expect("displayName" in item).toBe(false);
    expect("avatarUrl" in item).toBe(false);
    expect("authorId" in item).toBe(false);
  });

  it("non-masked fixture row -> displayName equals the fixture's own, unchanged; avatarUrl is the signed URL for the fixture's path (task 42 batch signer)", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-2",
          status: "published",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          is_mine: false,
          author_id: "author-2",
          author_display_name: "Trần Thị B",
          author_avatar_path: "https://example.com/b.png",
          score: null,
          score_grading: null,
          helpful_count: 0,
          i_marked_helpful: false,
          comment_count: 0,
          changed_question_count: 0,
        },
      ],
      error: null,
    });

    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({
      kind: "named",
      displayName: "Trần Thị B",
      avatarUrl: "signed:https://example.com/b.png",
    });
  });

  it("empty RPC result -> getSolutionDetail() returns null and listSolutions() returns [] (never throws, AC-063/S11)", async () => {
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(getSolutionDetail("missing")).resolves.toBeNull();

    rpcMock.mockReset();
    rpcMock.mockResolvedValue({ data: [], error: null });
    await expect(listSolutions("exam-1")).resolves.toEqual([]);
  });

  it("a nested masked comment row -> mapped comment has no identity keys, identity is exactly {kind:'anonymous'}", async () => {
    rpcMock.mockResolvedValue({
      data: [
        {
          id: "sol-3",
          author_id: "author-3",
          author_display_name: "Tác giả",
          author_avatar_path: "a.png",
          is_pinned: false,
          updated_at: "2026-09-01T00:00:00.000Z",
          score: null,
          score_grading: null,
          per_question: null,
          is_mine: false,
          helpful_count: 0,
          i_marked_helpful: false,
          i_reported: false,
          questions: [
            {
              question_id: "q1",
              stem: "stem",
              correct_answer: "A",
              has_changed: false,
              note: "Ghi chú đủ mười lăm từ để mở khoá bề mặt bình luận cho câu hỏi này hôm nay",
              comment_count: 1,
              comments: [
                {
                  id: "c1",
                  author_id: null,
                  author_display_name: null,
                  author_avatar_path: null,
                  is_solution_author: false,
                  is_mine: false,
                  body: "Bình luận ẩn danh",
                  is_hidden_by_admin: false,
                  hidden_reason: null,
                  i_reported: false,
                  created_at: "2026-09-01T00:00:00.000Z",
                },
              ],
            },
          ],
        },
      ],
      error: null,
    });

    const detail = await getSolutionDetail("sol-3");

    const [comment] = detail!.questions[0].comments;
    expect(comment.author).toEqual({ kind: "anonymous" });
    expect("displayName" in comment).toBe(false);
    expect("avatarUrl" in comment).toBe(false);
  });
});
