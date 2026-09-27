// Cross-user avatar batch signer (task 42, P5-T3) — proves the four Proof
// Obligations pinned in the task file (batch-per-screen shape following
// `resolveSignedImageUrls`/`SOURCE/lib/ugc/imageUrl.ts:59-95`, adapted to the
// `avatars` bucket; fail-closed on Storage error/per-item error/exception;
// anonymity — masked rows never signed; `getMyCommentFeed` never signed).
//
// Mock boundary: the session client returned by `@/lib/supabase/server`
// `createClient()` — same convention as `solutionReadMappers.test.ts` /
// `communitySolutions.int.test.ts` — extended here with a `storage.from(...)
// .createSignedUrls` spy so call COUNT and call ARGUMENTS (the batching
// claim) are assertable, not just the mapped output.
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" — same stub as the sibling test files.
vi.mock("server-only", () => ({}));

const { rpcMock, createSignedUrlsMock } = vi.hoisted(() => ({
  rpcMock: vi.fn(),
  createSignedUrlsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    rpc: rpcMock,
    storage: { from: () => ({ createSignedUrls: createSignedUrlsMock }) },
  })),
}));

const { listSolutions, getSolutionDetail, getMyCommentFeed } = await import("@/features/solutions/queries");

function mockRpc(data: unknown) {
  rpcMock.mockResolvedValue({ data, error: null });
}

type SignedItem = { path: string | null; signedUrl: string | null; error: string | null };

function signOk(paths: string[]): SignedItem[] {
  return paths.map((path) => ({ path, signedUrl: `signed:${path}`, error: null }));
}

function echoSigned() {
  createSignedUrlsMock.mockImplementation(async (paths: string[]) => ({ data: signOk(paths), error: null }));
}

const listRowBase = {
  id: "sol-1",
  status: "published",
  is_pinned: false,
  updated_at: "2026-09-01T00:00:00.000Z",
  is_mine: false,
  author_id: "author-1",
  author_display_name: "Tác giả",
  author_avatar_path: "avatar-1.png",
  score: null as number | null,
  score_grading: null as boolean | null,
  helpful_count: 0,
  i_marked_helpful: false,
  comment_count: 0,
  changed_question_count: 0,
};

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    author_id: "author-1",
    author_display_name: "Tác giả",
    author_avatar_path: "avatar-header.png",
    is_pinned: false,
    updated_at: "2026-09-01T00:00:00.000Z",
    score: null as number | null,
    score_grading: null as boolean | null,
    per_question: null as unknown,
    is_mine: false,
    helpful_count: 0,
    i_marked_helpful: false,
    i_reported: false,
    questions: [],
    ...overrides,
  };
}

function detailQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question_id: "q1",
    stem: "stem",
    correct_answer: "A",
    has_changed: false,
    note: null as string | null,
    comment_count: null as number | null,
    comments: [] as unknown[],
    ...overrides,
  };
}

function commentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "comment-1",
    author_id: "author-9",
    author_display_name: "Người bình luận",
    author_avatar_path: "avatar-9.png",
    is_solution_author: false,
    is_mine: false,
    body: "Nội dung bình luận",
    is_hidden_by_admin: false,
    hidden_reason: null as string | null,
    i_reported: false,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  rpcMock.mockReset();
  createSignedUrlsMock.mockReset();
});

describe("batch signing — one Storage call per screen render (Proof Obligation 1)", () => {
  it("listSolutions: 1 row -> exactly 1 createSignedUrls call, with that row's path", async () => {
    echoSigned();
    mockRpc([listRowBase]);

    const items = await listSolutions("exam-1");

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock.mock.calls[0][0]).toEqual(["avatar-1.png"]);
    expect(items[0].author).toEqual({ kind: "named", displayName: "Tác giả", avatarUrl: "signed:avatar-1.png" });
  });

  it("listSolutions: 25 rows sharing 2 distinct paths -> exactly 1 createSignedUrls call, deduplicated paths", async () => {
    echoSigned();
    const rows = Array.from({ length: 25 }, (_, i) => ({
      ...listRowBase,
      id: `sol-${i}`,
      author_avatar_path: i % 2 === 0 ? "avatar-a.png" : "avatar-b.png",
    }));
    mockRpc(rows);

    const items = await listSolutions("exam-1");

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect([...createSignedUrlsMock.mock.calls[0][0]].sort()).toEqual(["avatar-a.png", "avatar-b.png"]);
    expect(items).toHaveLength(25);
    expect(items[0].author).toEqual({ kind: "named", displayName: "Tác giả", avatarUrl: "signed:avatar-a.png" });
    expect(items[1].author).toEqual({ kind: "named", displayName: "Tác giả", avatarUrl: "signed:avatar-b.png" });
  });

  it("getSolutionDetail: header + 3 comments -> exactly 1 createSignedUrls call covering header AND every comment together", async () => {
    echoSigned();
    mockRpc([
      detailRow({
        author_avatar_path: "avatar-header.png",
        questions: [
          detailQuestion({
            comments: [
              commentRow({ id: "c1", author_avatar_path: "avatar-c1.png" }),
              commentRow({ id: "c2", author_avatar_path: "avatar-c2.png" }),
              commentRow({ id: "c3", author_avatar_path: "avatar-c3.png" }),
            ],
          }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect([...createSignedUrlsMock.mock.calls[0][0]].sort()).toEqual(
      ["avatar-c1.png", "avatar-c2.png", "avatar-c3.png", "avatar-header.png"].sort()
    );
    expect(detail!.author).toEqual({ kind: "named", displayName: "Tác giả", avatarUrl: "signed:avatar-header.png" });
    const [c1, c2, c3] = detail!.questions[0].comments;
    expect(c1.author).toEqual({ kind: "named", displayName: "Người bình luận", avatarUrl: "signed:avatar-c1.png" });
    expect(c2.author).toEqual({ kind: "named", displayName: "Người bình luận", avatarUrl: "signed:avatar-c2.png" });
    expect(c3.author).toEqual({ kind: "named", displayName: "Người bình luận", avatarUrl: "signed:avatar-c3.png" });
  });
});

describe("fail-closed — Storage error / per-item error / exception (Proof Obligation 2)", () => {
  it("global Storage error -> query resolves, affected row has no avatarUrl, no throw", async () => {
    createSignedUrlsMock.mockResolvedValue({ data: null, error: { message: "boom" } });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc([listRowBase]);

    const items = await listSolutions("exam-1");

    expect(items[0].author).toEqual({ kind: "named", displayName: "Tác giả" });
    expect("avatarUrl" in items[0].author).toBe(false);
    warn.mockRestore();
  });

  it("per-item error -> only that row loses avatarUrl, the other row still gets its signed URL", async () => {
    createSignedUrlsMock.mockImplementation(async (paths: string[]) => ({
      data: paths.map((path): SignedItem =>
        path === "avatar-bad.png"
          ? { path, signedUrl: null, error: "Either the object does not exist or you do not have access to it" }
          : { path, signedUrl: `signed:${path}`, error: null }
      ),
      error: null,
    }));
    mockRpc([
      { ...listRowBase, id: "sol-ok", author_avatar_path: "avatar-ok.png" },
      { ...listRowBase, id: "sol-bad", author_avatar_path: "avatar-bad.png" },
    ]);

    const items = await listSolutions("exam-1");

    expect(items[0].author).toEqual({ kind: "named", displayName: "Tác giả", avatarUrl: "signed:avatar-ok.png" });
    expect(items[1].author).toEqual({ kind: "named", displayName: "Tác giả" });
    expect("avatarUrl" in items[1].author).toBe(false);
  });

  it("Storage throws -> query resolves, no avatarUrl, exception does not propagate", async () => {
    createSignedUrlsMock.mockImplementation(async () => {
      throw new Error("fetch failed");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockRpc([listRowBase]);

    const items = await listSolutions("exam-1");

    expect(items[0].author).toEqual({ kind: "named", displayName: "Tác giả" });
    warn.mockRestore();
  });
});

describe("anonymity — masked rows are never signed (Proof Obligation 3)", () => {
  it("a masked row's path is excluded from the createSignedUrls call; a named row's path is still included", async () => {
    echoSigned();
    mockRpc([
      { ...listRowBase, id: "sol-named", author_display_name: "Tác giả", author_avatar_path: "avatar-named.png" },
      { ...listRowBase, id: "sol-anon", author_display_name: null, author_avatar_path: null },
    ]);

    const items = await listSolutions("exam-1");

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock.mock.calls[0][0]).toEqual(["avatar-named.png"]);
    expect(items[1].author).toEqual({ kind: "anonymous" });
  });

  it("a masked row carrying a non-null path (DB anomaly) is still excluded — the filter keys off author_display_name, not the path", async () => {
    echoSigned();
    mockRpc([{ ...listRowBase, id: "sol-anon", author_display_name: null, author_avatar_path: "leaked.png" }]);

    await listSolutions("exam-1");

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
  });

  it("getSolutionDetail: a masked nested comment's path is excluded while a named sibling comment's path is signed", async () => {
    echoSigned();
    mockRpc([
      detailRow({
        author_display_name: null,
        author_avatar_path: null,
        questions: [
          detailQuestion({
            comments: [
              commentRow({ id: "c1", author_display_name: null, author_avatar_path: null }),
              commentRow({ id: "c2", author_avatar_path: "avatar-c2.png" }),
            ],
          }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    expect(createSignedUrlsMock).toHaveBeenCalledTimes(1);
    expect(createSignedUrlsMock.mock.calls[0][0]).toEqual(["avatar-c2.png"]);
    expect(detail!.author).toEqual({ kind: "anonymous" });
    const [c1, c2] = detail!.questions[0].comments;
    expect(c1.author).toEqual({ kind: "anonymous" });
    expect(c2.author).toEqual({ kind: "named", displayName: "Người bình luận", avatarUrl: "signed:avatar-c2.png" });
  });
});

describe("getMyCommentFeed — never signed (Proof Obligation 4)", () => {
  it("createSignedUrls is never called; named row has no avatarUrl key, anonymous row is {kind:'anonymous'}", async () => {
    mockRpc([
      {
        comment_id: "c1",
        solution_id: "sol-1",
        exam_id: "exam-1",
        exam_title: "Đề 1",
        question_number: 1,
        comment_body: "Nội dung 1",
        comment_created_at: "2026-09-01T00:00:00.000Z",
        author_display_name: "Người bình luận",
        is_unread: false,
        exam_visible: true,
      },
      {
        comment_id: "c2",
        solution_id: "sol-1",
        exam_id: "exam-1",
        exam_title: "Đề 1",
        question_number: 2,
        comment_body: "Nội dung 2",
        comment_created_at: "2026-09-01T00:00:00.000Z",
        author_display_name: null,
        is_unread: false,
        exam_visible: true,
      },
    ]);

    const feed = await getMyCommentFeed(1);

    expect(createSignedUrlsMock).not.toHaveBeenCalled();
    expect(feed[0].author).toEqual({ kind: "named", displayName: "Người bình luận" });
    expect("avatarUrl" in feed[0].author).toBe(false);
    expect(feed[1].author).toEqual({ kind: "anonymous" });
  });
});
