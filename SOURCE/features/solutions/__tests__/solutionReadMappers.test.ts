// listSolutions / getSolutionDetail — mapper unit cases (backend task 14,
// § Required test list; frontend DD v1.6 § Test Boundaries "Mapper rule
// tests"). `.rpc()` mocked at the Supabase client boundary and fed literal
// rows shaped exactly as community_solutions_list / community_solution_detail
// actually serialize them (SOURCE/supabase/schema.sql `returns table` /
// `jsonb_build_object` column lists) — every declared key present, masked
// values `null`.
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts imports "server-only" — same stub as writerActions.test.ts /
// communitySolutions.int.test.ts.
vi.mock("server-only", () => ({}));

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

const { listSolutions, getSolutionDetail } = await import("@/features/solutions/queries");

function mockRpc(data: unknown) {
  rpcMock.mockResolvedValue({ data, error: null });
}

const listRowBase = {
  id: "sol-1",
  status: "published",
  is_pinned: false,
  updated_at: "2026-09-01T00:00:00.000Z",
  is_mine: false,
  author_id: "author-1",
  author_display_name: "Tác giả",
  author_avatar_path: "avatar.png",
  score: null as number | null,
  score_grading: null as boolean | null,
  helpful_count: 3,
  i_marked_helpful: true,
  comment_count: 2,
  changed_question_count: 1,
};

const baseComment = {
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
};

function detailQuestion(overrides: Record<string, unknown> = {}) {
  return {
    question_id: "q1",
    stem: "stem",
    correct_answer: "A",
    has_changed: false,
    note: "Ghi chú đủ mười lăm từ để mở khoá bề mặt bình luận cho câu hỏi này hôm nay",
    comment_count: 0,
    comments: [],
    ...overrides,
  };
}

function detailRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "sol-1",
    author_id: "author-1",
    author_display_name: "Tác giả",
    author_avatar_path: "avatar.png",
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

describe("getSolutionDetail — per_question fold (rows 1-2)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("row 1: per_question null -> writerChoiceNode/essayScore/result/notAutoScored all absent on every question; header has no score/scoreGrading", async () => {
    mockRpc([
      detailRow({
        score: null,
        score_grading: null,
        per_question: null,
        questions: [detailQuestion({ question_id: "q1" }), detailQuestion({ question_id: "q2" })],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    expect(detail).not.toBeNull();
    expect("score" in detail!).toBe(false);
    expect("scoreGrading" in detail!).toBe(false);
    for (const q of detail!.questions) {
      expect("notAutoScored" in q).toBe(false);
      expect("essayScore" in q).toBe(false);
      expect("result" in q).toBe(false);
      expect("writerChoiceNode" in q).toBe(false);
    }
  });

  it("row 2: non-null score and per_question marking the first question scored:false -> that question maps to notAutoScored:true; score/scoreGrading present on header", async () => {
    mockRpc([
      detailRow({
        score: 8.5,
        score_grading: false,
        per_question: [
          { questionId: "q1", isCorrect: false, scored: false, selected: "sai" },
          { questionId: "q2", isCorrect: true, scored: true, selected: "A", correct: "A" },
        ],
        questions: [detailQuestion({ question_id: "q1" }), detailQuestion({ question_id: "q2" })],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    expect(detail!.score).toBe(8.5);
    expect(detail!.scoreGrading).toBe(false);
    const [q1] = detail!.questions;
    expect(q1.notAutoScored).toBe(true);
    expect("result" in q1).toBe(false);
    expect("essayScore" in q1).toBe(false);
  });
});

describe("getSolutionDetail — comment_count presence (rows 3-4)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("row 3: comment_count null -> no commentCount key on note; comments []", async () => {
    mockRpc([detailRow({ questions: [detailQuestion({ comment_count: null, comments: [] })] })]);

    const detail = await getSolutionDetail("sol-1");

    const [q] = detail!.questions;
    expect(q.note).toBeDefined();
    expect("commentCount" in q.note!).toBe(false);
    expect(q.comments).toEqual([]);
  });

  it("row 4: comment_count 0 -> commentCount 0 (a real value, not dropped)", async () => {
    mockRpc([detailRow({ questions: [detailQuestion({ comment_count: 0 })] })]);

    const detail = await getSolutionDetail("sol-1");

    const [q] = detail!.questions;
    expect(q.note!.commentCount).toBe(0);
  });
});

describe("getSolutionDetail — iReported and hidden-comment columns (rows 5-7)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("row 5: iReported present as a boolean on the header and on every comment row, never dropped, never optional", async () => {
    mockRpc([
      detailRow({
        i_reported: false,
        questions: [
          detailQuestion({
            comments: [
              { ...baseComment, id: "c1", i_reported: true },
              { ...baseComment, id: "c2", i_reported: false },
            ],
          }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    expect(detail!.iReported).toBe(false);
    const [q] = detail!.questions;
    expect(q.comments[0].iReported).toBe(true);
    expect(q.comments[1].iReported).toBe(false);
  });

  it("row 6: is_hidden_by_admin false / hidden_reason null -> neither isHiddenByAdmin nor hiddenReason present", async () => {
    mockRpc([
      detailRow({
        questions: [
          detailQuestion({ comments: [{ ...baseComment, is_hidden_by_admin: false, hidden_reason: null }] }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    const [comment] = detail!.questions[0].comments;
    expect("isHiddenByAdmin" in comment).toBe(false);
    expect("hiddenReason" in comment).toBe(false);
  });

  it("row 7: is_hidden_by_admin true / hidden_reason 'spam' -> both keys present with those values", async () => {
    mockRpc([
      detailRow({
        questions: [
          detailQuestion({ comments: [{ ...baseComment, is_hidden_by_admin: true, hidden_reason: "spam" }] }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    const [comment] = detail!.questions[0].comments;
    expect(comment.isHiddenByAdmin).toBe(true);
    expect(comment.hiddenReason).toBe("spam");
  });
});

describe("listSolutions / getSolutionDetail — identity masking, no self-exception (rows 8-10)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("row 8: masked list row and masked detail header (author_display_name null) -> no displayName/avatarUrl/authorId key; identity is exactly {kind:'anonymous'}, including when is_mine true (AC-062)", async () => {
    mockRpc([{ ...listRowBase, author_id: null, author_display_name: null, author_avatar_path: null, is_mine: true }]);
    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({ kind: "anonymous" });
    expect("displayName" in item).toBe(false);
    expect("avatarUrl" in item).toBe(false);
    expect("authorId" in item).toBe(false);
    expect(item.isMine).toBe(true);

    rpcMock.mockReset();
    mockRpc([detailRow({ author_id: null, author_display_name: null, author_avatar_path: null, is_mine: true })]);
    const detail = await getSolutionDetail("sol-1");

    expect(detail!.author).toEqual({ kind: "anonymous" });
    expect(detail!.isMine).toBe(true);
  });

  it("row 9: non-masked row -> identity values equal the fixture's own, unchanged (no transformation drift)", async () => {
    mockRpc([
      { ...listRowBase, author_id: "author-9", author_display_name: "Nguyễn Văn A", author_avatar_path: "https://example.com/avatar-9.png" },
    ]);

    const [item] = await listSolutions("exam-1");

    expect(item.author).toEqual({
      kind: "named",
      displayName: "Nguyễn Văn A",
      avatarUrl: "https://example.com/avatar-9.png",
    });
  });

  it("row 10: a nested masked comment row -> same as row 8, with isSolutionAuthor and isMine still present and correct", async () => {
    mockRpc([
      detailRow({
        questions: [
          detailQuestion({
            comments: [
              {
                ...baseComment,
                author_id: null,
                author_display_name: null,
                author_avatar_path: null,
                is_solution_author: true,
                is_mine: true,
              },
            ],
          }),
        ],
      }),
    ]);

    const detail = await getSolutionDetail("sol-1");

    const [comment] = detail!.questions[0].comments;
    expect(comment.author).toEqual({ kind: "anonymous" });
    expect("displayName" in comment).toBe(false);
    expect("avatarUrl" in comment).toBe(false);
    expect(comment.isSolutionAuthor).toBe(true);
    expect(comment.isMine).toBe(true);
  });
});

describe("listSolutions / getSolutionDetail — ordering and empty result (rows 11-12)", () => {
  beforeEach(() => {
    rpcMock.mockReset();
  });

  it("row 11: list rows supplied in a deliberately non-sorted order -> output ids equal input ids in the same order (no client sort)", async () => {
    mockRpc([
      { ...listRowBase, id: "sol-c" },
      { ...listRowBase, id: "sol-a" },
      { ...listRowBase, id: "sol-b" },
    ]);

    const items = await listSolutions("exam-1");

    expect(items.map((item) => item.id)).toEqual(["sol-c", "sol-a", "sol-b"]);
  });

  it("row 12: community_solution_detail returning [] -> getSolutionDetail returns null; community_solutions_list returning [] -> listSolutions returns [] (no throw)", async () => {
    mockRpc([]);
    await expect(getSolutionDetail("missing")).resolves.toBeNull();

    rpcMock.mockReset();
    mockRpc([]);
    await expect(listSolutions("exam-1")).resolves.toEqual([]);
  });
});
