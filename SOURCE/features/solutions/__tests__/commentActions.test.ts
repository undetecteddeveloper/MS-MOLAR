// postComment / deleteComment / markCommentsRead / getMyCommentFeed —
// Server Action call-shape + error mapping unit tests (backend task 26; plan
// § P3-T2; backend DD § Integration Verification Points "Task ownership").
//
// Mock boundary (same convention as helpfulPinActions.test.ts): the Supabase
// SESSION client AND `guard()` are both mocked here. `community_solution_comments`
// has RLS on with zero policies and zero grants (U1) — the ONLY write path is
// the two SECURITY DEFINER RPCs, so neither postComment nor deleteComment may
// ever call `.from("community_solution_comments")` (Required Test #11).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" — same stub as writerActions.test.ts /
// helpfulPinActions.test.ts.
vi.mock("server-only", () => ({}));

const { getUserMock, rpcMock, guardMock, fromMock, updateMock, eqMock } = vi.hoisted(() => ({
  getUserMock: vi.fn(),
  rpcMock: vi.fn(),
  guardMock: vi.fn(),
  fromMock: vi.fn(),
  updateMock: vi.fn(),
  eqMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: getUserMock },
    rpc: rpcMock,
    from: fromMock,
  })),
}));

vi.mock("@/lib/security/rateLimit", () => ({
  guard: guardMock,
}));

const { postComment, deleteComment, markCommentsRead } = await import("@/features/solutions/actions");
const { getMyCommentFeed } = await import("@/features/solutions/queries");

function mockUser(id: string) {
  getUserMock.mockResolvedValue({ data: { user: { id } } });
}

function allowGuard() {
  guardMock.mockResolvedValue({ ok: true, retryAfterSeconds: 0 });
}

let uidCounter = 0;
function freshUserId() {
  uidCounter += 1;
  return `comment-actions-user-${uidCounter}`;
}

const ACTIONS_SOURCE_PATH = fileURLToPath(new URL("../actions.ts", import.meta.url));

beforeEach(() => {
  getUserMock.mockReset();
  rpcMock.mockReset();
  guardMock.mockReset();
  fromMock.mockReset();
  updateMock.mockReset();
  eqMock.mockReset();

  // update("...").eq("id", user.id) chain, matching auth/actions.ts's
  // updateProfile precedent — resolves to { error: null } by default.
  eqMock.mockResolvedValue({ error: null });
  updateMock.mockReturnValue({ eq: eqMock });
  fromMock.mockReturnValue({ update: updateMock });
});

describe("postComment — Required test list rows 1-6, 9", () => {
  it("row 1: postComment(S, Q, '   ', false) -> { code: 'empty' }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    allowGuard();

    const result = await postComment("solution-1", "q1", "   ", false);

    expect(result).toEqual({ ok: false, error: { code: "empty" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("row 2: postComment(S, Q, 'x'.repeat(2001), false) -> { code: 'tooLong' }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    allowGuard();

    const result = await postComment("solution-2", "q1", "x".repeat(2001), false);

    expect(result).toEqual({ ok: false, error: { code: "tooLong" } });
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("reply: postComment(..., replyToId) sends p_reply_to_id and returns the server-derived parentId/replyToId", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: [
        {
          comment_id: "c2",
          comment_created_at: "2026-09-26T00:00:00.000Z",
          comment_parent_id: "root-1",
          comment_reply_to_id: "reply-1",
        },
      ],
      error: null,
    });

    const result = await postComment("solution-3", "q1", "@A trả lời", false, "reply-1");

    expect(result).toMatchObject({ ok: true, comment: { id: "c2", parentId: "root-1", replyToId: "reply-1" } });
    expect(rpcMock).toHaveBeenCalledWith("post_community_comment", {
      p_solution_id: "solution-3",
      p_question_id: "q1",
      p_body: "@A trả lời",
      p_is_anonymous: false,
      p_reply_to_id: "reply-1",
    });
  });

  it("row 3: postComment(S, Q, body, true) -> RPC [{comment_id:'c1', comment_created_at}] -> the returned comment carries c1 and that timestamp, plus the action's own inputs; one .rpc call with the exact args", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: [{ comment_id: "c1", comment_created_at: "2026-09-26T00:00:00.000Z" }],
      error: null,
    });

    const result = await postComment("solution-3", "q1", "Nội dung bình luận", true);

    expect(result).toEqual({
      ok: true,
      comment: {
        id: "c1",
        createdAt: "2026-09-26T00:00:00.000Z",
        solutionId: "solution-3",
        questionId: "q1",
        body: "Nội dung bình luận",
        isAnonymous: true,
        parentId: null,
        replyToId: null,
      },
    });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "post_community_comment", {
      p_solution_id: "solution-3",
      p_question_id: "q1",
      p_body: "Nội dung bình luận",
      p_is_anonymous: true,
    });
  });

  it("row 4: postComment -> RPC error { code: '42501' } -> { code: 'generic' }, naming no reason", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "post_community_comment: not eligible" },
    });

    const result = await postComment("solution-4", "q1", "Nội dung hợp lệ", false);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    if (!result.ok) {
      expect(JSON.stringify(result.error)).not.toMatch(/eligible|reason|note|word/i);
    }
  });

  it("row 5: postComment -> RPC error { code: '23514' } -> { code: 'generic' }; console.error called with RPC name and code only", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "23514", message: "community_solution_comments_body_check" },
    });
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await postComment("solution-5", "q1", "Nội dung hợp lệ", false);

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining("post_community_comment"), "23514");
    errorSpy.mockRestore();
  });

  it("row 6: every failure branch (rate-limited, empty, 42501, 23514, other, network) never logs the body string via console.error/log/warn", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const body = "Đây là một nội dung bình luận không được phép rò rỉ vào log server";

    // rate-limited: no RPC at all.
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });
    await postComment("solution-6a", "q1", body, false);

    // empty: no RPC at all.
    mockUser(freshUserId());
    allowGuard();
    await postComment("solution-6b", "q1", "   ", false);

    // 42501
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "42501", message: body } });
    await postComment("solution-6c", "q1", body, false);

    // 23514
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "23514", message: body } });
    await postComment("solution-6d", "q1", body, false);

    // other code
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: { code: "08006", message: body } });
    await postComment("solution-6e", "q1", body, false);

    for (const spy of [errorSpy, logSpy, warnSpy]) {
      for (const call of spy.mock.calls) {
        for (const arg of call) {
          expect(String(arg)).not.toContain(body);
        }
      }
    }

    errorSpy.mockRestore();
    logSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("row 9 (postComment branch): guard() rejects with seconds: 30 -> { code: 'rateLimited', seconds: 30 }; .rpc call count 0; the body argument is untouched", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });
    const body = "Nội dung chưa gửi được vì bị giới hạn tốc độ";

    const result = await postComment("solution-9", "q1", body, false);

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 30 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("deleteComment — Required test list rows 7-9", () => {
  it("row 7: deleteComment(C) -> RPC no data -> one .rpc call named delete_community_comment with { p_comment_id: C } -> { ok: true }", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({ data: null, error: null });

    const result = await deleteComment("comment-7");

    expect(result).toEqual({ ok: true });
    expect(rpcMock).toHaveBeenCalledTimes(1);
    expect(rpcMock).toHaveBeenNthCalledWith(1, "delete_community_comment", { p_comment_id: "comment-7" });
  });

  it("row 8: deleteComment(C) -> RPC error { code: '42501' } -> { code: 'generic' } (covers another user's comment, the writer's attempt, and one's own hidden comment — S19)", async () => {
    mockUser(freshUserId());
    allowGuard();
    rpcMock.mockResolvedValueOnce({
      data: null,
      error: { code: "42501", message: "delete_community_comment: not eligible" },
    });

    const result = await deleteComment("comment-8");

    expect(result).toEqual({ ok: false, error: { code: "generic" } });
  });

  it("row 9 (deleteComment branch): guard() rejects with seconds: 30 -> { code: 'rateLimited', seconds: 30 }; .rpc call count 0", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 30 });

    const result = await deleteComment("comment-9");

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 30 } });
    expect(rpcMock).not.toHaveBeenCalled();
  });
});

describe("markCommentsRead — Required test list row 10", () => {
  it("row 10: mocked update reporting zero changed rows -> the same success shape as a one-row update (no error)", async () => {
    mockUser(freshUserId());
    allowGuard();
    eqMock.mockResolvedValueOnce({ error: null }); // zero-row update — PostgREST still reports no error.

    const result = await markCommentsRead();

    expect(result).toEqual({ ok: true });
    expect(fromMock).toHaveBeenCalledWith("user_profiles");
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it("guard() rejects -> { ok: false, error: { code: 'rateLimited', seconds } }; no update call", async () => {
    mockUser(freshUserId());
    guardMock.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 12 });

    const result = await markCommentsRead();

    expect(result).toEqual({ ok: false, error: { code: "rateLimited", seconds: 12 } });
    expect(fromMock).not.toHaveBeenCalled();
  });
});

describe("module source — Required test list row 11", () => {
  it("row 11: actions.ts contains no .from(\"community_solution_comments\"); no action in this task reads error.message", () => {
    const source = readFileSync(ACTIONS_SOURCE_PATH, "utf8");

    expect(source).not.toContain('.from("community_solution_comments")');

    const newActionsSource = source.slice(source.indexOf("export async function postComment"));
    expect(newActionsSource).not.toMatch(/error\.message/);
  });
});

describe("getMyCommentFeed — Required test list rows 12-13", () => {
  function rawFeedRow(overrides: Record<string, unknown> = {}) {
    return {
      comment_id: "comment-1",
      solution_id: "sol-1",
      exam_id: "exam-1",
      exam_title: "Đề thi 1",
      question_number: 3,
      comment_body: "Câu này giải sao vậy bạn?",
      comment_created_at: "2026-09-20T00:00:00.000Z",
      author_display_name: "Lan",
      is_unread: true,
      exam_visible: true,
      thread_root_id: "comment-1",
      is_reply_to_me: false,
      reply_to_body: null,
      ...overrides,
    };
  }

  it("row 12: one row with all ten columns, author_display_name: 'Lan' -> CommentFeedItem with camelCase fields in order and author = { kind: 'named', displayName: 'Lan' } with no avatarUrl key", async () => {
    rpcMock.mockResolvedValueOnce({ data: [rawFeedRow()], error: null });

    const items = await getMyCommentFeed(1);

    expect(items).toEqual([
      {
        commentId: "comment-1",
        solutionId: "sol-1",
        examId: "exam-1",
        examTitle: "Đề thi 1",
        questionNumber: 3,
        commentBody: "Câu này giải sao vậy bạn?",
        commentCreatedAt: "2026-09-20T00:00:00.000Z",
        author: { kind: "named", displayName: "Lan" },
        isUnread: true,
        examVisible: true,
        threadRootId: "comment-1",
        isReplyToMe: false,
        replyToBody: null,
      },
    ]);
    expect(Object.keys(items[0])).toEqual([
      "commentId",
      "solutionId",
      "examId",
      "examTitle",
      "questionNumber",
      "commentBody",
      "commentCreatedAt",
      "author",
      "isUnread",
      "examVisible",
      "threadRootId",
      "isReplyToMe",
      "replyToBody",
    ]);
    expect("avatarUrl" in items[0].author).toBe(false);
  });

  it("reply row: is_reply_to_me + reply_to_body + thread_root_id are mapped to camelCase", async () => {
    rpcMock.mockResolvedValueOnce({
      data: [rawFeedRow({ thread_root_id: "root-9", is_reply_to_me: true, reply_to_body: "Câu hỏi của tôi" })],
      error: null,
    });

    const items = await getMyCommentFeed(1);

    expect(items[0]).toMatchObject({ threadRootId: "root-9", isReplyToMe: true, replyToBody: "Câu hỏi của tôi" });
  });

  it("row 13: the same row with author_display_name: null -> author = { kind: 'anonymous' }", async () => {
    rpcMock.mockResolvedValueOnce({ data: [rawFeedRow({ author_display_name: null })], error: null });

    const items = await getMyCommentFeed(1);

    expect(items[0].author).toEqual({ kind: "anonymous" });
  });
});
