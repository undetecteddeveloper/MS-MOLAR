// countUnreadComments / getMyUnreadCommentCount — công thức đếm chưa đọc dùng chung
// (quyết định của decomposer R6, backend task 26; backend DD § Data Contracts
// "community_my_comment_feed" New-comment rule; Reference Contract Value #23;
// Proof Obligation "Failure Mode #7, shared-state dependency").
//
// countUnreadComments là hàm thuần — một hàng được tính là mới KHI VÀ CHỈ KHI isUnread && examVisible
// (không bao giờ chỉ isUnread: một bình luận ở đề không hiển thị S8 không được tính là mới
// dù về kỹ thuật nó chưa đọc).
//
// getMyUnreadCommentCount khai thác bảo đảm của chính feed rằng các hàng chưa đọc
// tạo thành một TIỀN TỐ của danh sách mới-nhất-trước (is_unread không phụ thuộc
// exam_visible) — nó lấy các trang tuần tự và dừng ở trang đầu tiên
// không đầy hoặc có chứa một hàng đã đọc.
import { beforeEach, describe, expect, it, vi } from "vitest";

// queries.ts import "server-only" — cùng stub với các test solutions khác.
vi.mock("server-only", () => ({}));

const { rpcMock } = vi.hoisted(() => ({ rpcMock: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: rpcMock })),
}));

import { countUnreadComments, type UnreadCommentRow } from "@/lib/solutions/unreadComments";
const { getMyUnreadCommentCount } = await import("@/features/solutions/queries");

function row(overrides: Partial<UnreadCommentRow> = {}): UnreadCommentRow {
  return {
    solutionId: "sol-1",
    isUnread: true,
    examVisible: true,
    ...overrides,
  };
}

beforeEach(() => {
  rpcMock.mockReset();
});

describe("countUnreadComments — Required test list rows 14-15", () => {
  it("row 14: a row with isUnread: true, examVisible: false is NOT counted (Reference Contract Value #23)", () => {
    const rows = [row({ isUnread: true, examVisible: false })];

    expect(countUnreadComments(rows)).toBe(0);
  });

  it("row 15: countUnreadComments(rows, { solutionId }) counts only matching rows that also satisfy isUnread && examVisible", () => {
    const rows: UnreadCommentRow[] = [
      row({ solutionId: "target", isUnread: true, examVisible: true }),
      row({ solutionId: "target", isUnread: true, examVisible: false }),
      row({ solutionId: "target", isUnread: false, examVisible: true }),
      row({ solutionId: "other", isUnread: true, examVisible: true }),
    ];

    expect(countUnreadComments(rows, { solutionId: "target" })).toBe(1);
  });

  it("a read, exam-visible row is not counted", () => {
    const rows = [row({ isUnread: false, examVisible: true })];

    expect(countUnreadComments(rows)).toBe(0);
  });

  it("an unread, exam-visible row is counted", () => {
    const rows = [row({ isUnread: true, examVisible: true })];

    expect(countUnreadComments(rows)).toBe(1);
  });

  it("with no opts, counts matching rows regardless of solutionId", () => {
    const rows = [
      row({ solutionId: "a", isUnread: true, examVisible: true }),
      row({ solutionId: "b", isUnread: true, examVisible: true }),
    ];

    expect(countUnreadComments(rows)).toBe(2);
  });
});

/** Dựng một trang feed RPC: `unreadCount` hàng chưa đọc (hiển thị-đề trừ khi
 *  được nêu trong `notExamVisibleIdx`) theo sau là `readCount` hàng đã đọc, mới
 *  nhất trước — khớp bảo đảm thứ tự của chính feed. */
function feedPage(opts: { unreadCount: number; notExamVisibleIdx?: number[]; readCount: number }) {
  const notExamVisible = new Set(opts.notExamVisibleIdx ?? []);
  const rows = [];
  for (let i = 0; i < opts.unreadCount; i++) {
    rows.push({
      comment_id: `unread-${rows.length}`,
      solution_id: "sol-1",
      exam_id: "exam-1",
      exam_title: "Đề 1",
      question_number: 1,
      comment_body: "body",
      comment_created_at: "2026-09-01T00:00:00.000Z",
      author_display_name: "Người bình luận",
      is_unread: true,
      exam_visible: !notExamVisible.has(i),
    });
  }
  for (let i = 0; i < opts.readCount; i++) {
    rows.push({
      comment_id: `read-${rows.length}`,
      solution_id: "sol-1",
      exam_id: "exam-1",
      exam_title: "Đề 1",
      question_number: 1,
      comment_body: "body",
      comment_created_at: "2026-09-01T00:00:00.000Z",
      author_display_name: "Người bình luận",
      is_unread: false,
      exam_visible: true,
    });
  }
  return rows;
}

describe("getMyUnreadCommentCount — Required test list row 16 / Proof Obligation Failure Mode #7", () => {
  it("row 16: 45 unread rows (3 with examVisible: false) + 5 read rows across pages of 20 -> count = 42; .rpc called exactly 3 times", async () => {
    // Trang 1: 20 chưa đọc (đều hiển thị-đề), đầy và không có hàng đã đọc -> tiếp tục.
    // Trang 2: 20 chưa đọc (3 không hiển thị-đề), đầy và không có hàng đã đọc -> tiếp tục.
    // Trang 3: 5 chưa đọc còn lại + 5 đã đọc = 10 hàng, không đầy -> dừng.
    rpcMock.mockResolvedValueOnce({ data: feedPage({ unreadCount: 20, readCount: 0 }), error: null });
    rpcMock.mockResolvedValueOnce({
      data: feedPage({ unreadCount: 20, notExamVisibleIdx: [0, 1, 2], readCount: 0 }),
      error: null,
    });
    rpcMock.mockResolvedValueOnce({ data: feedPage({ unreadCount: 5, readCount: 5 }), error: null });

    const count = await getMyUnreadCommentCount();

    expect(count).toBe(42);
    expect(rpcMock).toHaveBeenCalledTimes(3);
    expect(rpcMock.mock.calls[0][0]).toBe("community_my_comment_feed");
    expect(rpcMock.mock.calls[0][1]).toMatchObject({ p_page: 1 });
    expect(rpcMock.mock.calls[1][1]).toMatchObject({ p_page: 2 });
    expect(rpcMock.mock.calls[2][1]).toMatchObject({ p_page: 3 });
  });

  it("stops at the first page containing a read row even when that page is full", async () => {
    // Trang 1: trang đầy, lẫn chưa đọc/đã đọc (đầy nhưng không toàn chưa đọc) -> dừng sau trang 1.
    rpcMock.mockResolvedValueOnce({
      data: feedPage({ unreadCount: 15, readCount: 5 }),
      error: null,
    });

    const count = await getMyUnreadCommentCount();

    expect(count).toBe(15);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("empty feed -> count 0, exactly one .rpc call", async () => {
    rpcMock.mockResolvedValueOnce({ data: [], error: null });

    const count = await getMyUnreadCommentCount();

    expect(count).toBe(0);
    expect(rpcMock).toHaveBeenCalledTimes(1);
  });

  it("opts.solutionId is forwarded to countUnreadComments across pages", async () => {
    const page = feedPage({ unreadCount: 2, readCount: 0 }).map((r, i) => ({
      ...r,
      solution_id: i === 0 ? "target" : "other",
    }));
    rpcMock.mockResolvedValueOnce({ data: page, error: null });

    const count = await getMyUnreadCommentCount({ solutionId: "target" });

    expect(count).toBe(1);
  });
});
