// @vitest-environment jsdom

// ProfileCommentsTab (C-35) — UI Spec § Component: ProfileCommentsTab; frontend
// DD § Data Contracts "Comment feed contract", § UI Error State Design (hàng
// `ProfileCommentsTab`). Required Tests (task 45 task file § Required Tests):
// #7 (feed rỗng, trang rỗng sau trang cuối không phải lỗi), #8 (phân trang
// "Xem thêm" nối thêm, key theo commentId).
//
// Mock boundary: `@/features/solutions/queries` (`getMyCommentFeed`,
// `getMyReputation`) mocked ở boundary module — `CommentNotificationCard` và
// `RichText` giữ thật (component con render qua props thật, không mock).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentFeedItem } from "@/features/solutions/queries";

const { getMyCommentFeedMock, getMyReputationMock } = vi.hoisted(() => ({
  getMyCommentFeedMock: vi.fn(),
  getMyReputationMock: vi.fn(),
}));

vi.mock("@/features/solutions/queries", () => ({
  getMyCommentFeed: getMyCommentFeedMock,
  getMyReputation: getMyReputationMock,
}));

const { ProfileCommentsTab } = await import("@/features/solutions/components/ProfileCommentsTab");

function feedItem(overrides: Partial<CommentFeedItem> = {}): CommentFeedItem {
  return {
    commentId: "c1",
    solutionId: "sol1",
    examId: "E1",
    examTitle: "Đề Toán 12",
    questionNumber: 1,
    commentBody: "Bình luận mẫu",
    commentCreatedAt: "2026-09-27T09:00:00.000Z",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isUnread: false,
    examVisible: true,
    ...overrides,
  };
}

function fullPage(prefix: string, count = 20): CommentFeedItem[] {
  return Array.from({ length: count }, (_, i) =>
    feedItem({ commentId: `${prefix}-${i}`, examTitle: `${prefix} ${i}` })
  );
}

afterEach(cleanup);
beforeEach(() => {
  getMyCommentFeedMock.mockReset();
  getMyReputationMock.mockReset();
});

describe("ProfileCommentsTab — feed rỗng (Required Test #7, AC-099)", () => {
  it("publishedCount === 0: hiện khung rỗng + dòng how-to", async () => {
    getMyCommentFeedMock.mockResolvedValue([]);
    getMyReputationMock.mockResolvedValue({ ok: true, totalScore: 0, publishedCount: 0, helpfulCount: 0, pinnedCount: 0 });

    const jsx = await ProfileCommentsTab({ page: 1 });
    render(jsx);

    expect(screen.getByText("Chưa có bình luận nào về bài giải của bạn.")).toBeTruthy();
    expect(
      screen.getByText("Vào một đề bạn đã nộp rồi bấm Viết bài giải ở trang kết quả.")
    ).toBeTruthy();
  });

  it("publishedCount > 0: hiện khung rỗng nhưng KHÔNG có dòng how-to", async () => {
    getMyCommentFeedMock.mockResolvedValue([]);
    getMyReputationMock.mockResolvedValue({ ok: true, totalScore: 5, publishedCount: 2, helpfulCount: 1, pinnedCount: 0 });

    const jsx = await ProfileCommentsTab({ page: 1 });
    render(jsx);

    expect(screen.getByText("Chưa có bình luận nào về bài giải của bạn.")).toBeTruthy();
    expect(
      screen.queryByText("Vào một đề bạn đã nộp rồi bấm Viết bài giải ở trang kết quả.")
    ).toBeNull();
  });

  it("trang rỗng SAU trang cuối (page=2, cả hai trang đều rỗng) — vẫn là khung rỗng, KHÔNG role=alert", async () => {
    getMyCommentFeedMock.mockResolvedValue([]);
    getMyReputationMock.mockResolvedValue({ ok: false });

    const jsx = await ProfileCommentsTab({ page: 2 });
    render(jsx);

    expect(screen.getByText("Chưa có bình luận nào về bài giải của bạn.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("ProfileCommentsTab — lỗi truy vấn thật (frontend DD § UI Error State Design)", () => {
  it("getMyCommentFeed ném lỗi → role=alert + 'Chưa tải được bình luận. Bạn thử lại nhé.' + Thử lại", async () => {
    getMyCommentFeedMock.mockRejectedValue(new Error("boom"));

    const jsx = await ProfileCommentsTab({ page: 1 });
    render(jsx);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Chưa tải được bình luận. Bạn thử lại nhé.");
    expect(screen.getByText("Thử lại")).toBeTruthy();
  });
});

describe("ProfileCommentsTab — phân trang 'Xem thêm' (Required Test #8, AC-097)", () => {
  it("trang 1 đầy (20 dòng): hiện nút 'Xem thêm' trỏ tới cpage=2", async () => {
    getMyCommentFeedMock.mockImplementation((page: number) =>
      Promise.resolve(page === 1 ? fullPage("p1") : [])
    );

    const jsx = await ProfileCommentsTab({ page: 1 });
    render(jsx);

    const more = screen.getByRole("link", { name: "Xem thêm" });
    expect(more.getAttribute("href")).toBe("/profile?tab=comments&cpage=2");
    expect(document.querySelectorAll("li").length).toBe(20 + 1); // 20 thẻ + 1 <li> bọc nút.
  });

  it("trang 1 chưa đầy (5 dòng): KHÔNG có nút 'Xem thêm'", async () => {
    getMyCommentFeedMock.mockResolvedValue(fullPage("p1", 5));

    const jsx = await ProfileCommentsTab({ page: 1 });
    render(jsx);

    expect(screen.queryByRole("link", { name: "Xem thêm" })).toBeNull();
  });

  it("page=2: nối trang 1 (20 dòng) + trang 2 (3 dòng) thành 23 thẻ, key theo commentId, không còn 'Xem thêm'", async () => {
    const page1 = fullPage("p1");
    const page2 = fullPage("p2", 3);
    getMyCommentFeedMock.mockImplementation((page: number) =>
      Promise.resolve(page === 1 ? page1 : page === 2 ? page2 : [])
    );

    const jsx = await ProfileCommentsTab({ page: 2 });
    render(jsx);

    expect(getMyCommentFeedMock).toHaveBeenCalledWith(1);
    expect(getMyCommentFeedMock).toHaveBeenCalledWith(2);
    expect(screen.getByText("p1 0")).toBeTruthy();
    expect(screen.getByText("p2 0")).toBeTruthy();
    expect(document.querySelectorAll("li").length).toBe(23);
    expect(screen.queryByRole("link", { name: "Xem thêm" })).toBeNull();
  });
});
