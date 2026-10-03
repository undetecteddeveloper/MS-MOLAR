// @vitest-environment jsdom

// ProfileSolutionsTab — ô "Bài giải" của hồ sơ (2026-10-03,
// docs/plans/20261003-feature-profile-solutions-tab.md). Việc của ô này: người
// đã viết bài giải vào lại trang sửa/xem trong hai thao tác, và KHÔNG BAO GIỜ
// dựng một liên kết dẫn tới trang sẽ redirect (đề ẩn, hết lượt nộp).
//
// Mock boundary: `@/features/solutions/queries` (`getMySolutions`) ở boundary
// module — thẻ, nhãn, `relativeTime` giữ thật.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MySolutionItem } from "@/features/solutions/queries";

const { getMySolutionsMock } = vi.hoisted(() => ({ getMySolutionsMock: vi.fn() }));

vi.mock("@/features/solutions/queries", () => ({ getMySolutions: getMySolutionsMock }));

const { ProfileSolutionsTab } = await import("@/features/solutions/components/ProfileSolutionsTab");

function item(overrides: Partial<MySolutionItem> = {}): MySolutionItem {
  return {
    solutionId: "sol-1",
    examId: "exam-1",
    examTitle: "Đề Toán giữa kỳ",
    examSubject: "Math",
    examGrade: 10,
    status: "published",
    attemptId: "att-1",
    updatedAt: "2026-10-01T09:00:00.000Z",
    helpfulCount: 4,
    examVisible: true,
    ...overrides,
  };
}

afterEach(cleanup);
beforeEach(() => {
  getMySolutionsMock.mockReset();
});

describe("ProfileSolutionsTab — bài đã đăng", () => {
  it("thẻ có tên đề, môn VIỆT hoá (không lộ khoá 'Math'), lớp, nhãn 'Đã đăng', số hữu ích", async () => {
    getMySolutionsMock.mockResolvedValue([item()]);

    render(await ProfileSolutionsTab());

    expect(screen.getByRole("heading", { name: "Đề Toán giữa kỳ" })).toBeTruthy();
    expect(screen.getByText("Toán")).toBeTruthy();
    expect(screen.queryByText("Math")).toBeNull();
    expect(screen.getByText("Lớp 10")).toBeTruthy();
    expect(screen.getByText("Đã đăng")).toBeTruthy();
    expect(screen.getByText("4 hữu ích")).toBeTruthy();
  });

  it("hai nút: 'Sửa bài giải' → trang viết theo attemptId, 'Xem' → trang xem bài; tên trợ năng kèm tên đề", async () => {
    getMySolutionsMock.mockResolvedValue([item()]);

    render(await ProfileSolutionsTab());

    const edit = screen.getByRole("link", { name: "Sửa bài giải, đề Đề Toán giữa kỳ" });
    const view = screen.getByRole("link", { name: "Xem, đề Đề Toán giữa kỳ" });
    expect(edit.getAttribute("href")).toBe("/exams/exam-1/attempt/att-1/solution");
    expect(view.getAttribute("href")).toBe("/exams/exam-1/solutions/sol-1");
  });
});

describe("ProfileSolutionsTab — nháp và bị ẩn", () => {
  it("bài nháp: nhãn 'Nháp', nút 'Viết tiếp', KHÔNG nút Xem, KHÔNG số hữu ích", async () => {
    getMySolutionsMock.mockResolvedValue([item({ status: "draft", helpfulCount: 0 })]);

    render(await ProfileSolutionsTab());

    expect(screen.getByText("Nháp")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Viết tiếp/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Xem/ })).toBeNull();
    expect(screen.queryByText(/hữu ích/)).toBeNull();
  });

  it("bài bị ẩn: nhãn 'Bị ẩn', nút 'Sửa bài giải' (vào xem lý do và sửa), không nút Xem", async () => {
    getMySolutionsMock.mockResolvedValue([item({ status: "hidden", helpfulCount: 9 })]);

    render(await ProfileSolutionsTab());

    expect(screen.getByText("Bị ẩn")).toBeTruthy();
    expect(screen.getByRole("link", { name: /^Sửa bài giải/ })).toBeTruthy();
    expect(screen.queryByRole("link", { name: /^Xem/ })).toBeNull();
    expect(screen.queryByText(/hữu ích/)).toBeNull();
  });
});

describe("ProfileSolutionsTab — không bao giờ một liên kết gãy", () => {
  it("đề không còn hiện: dòng 'Đề không còn hiện', không liên kết nào", async () => {
    getMySolutionsMock.mockResolvedValue([item({ examVisible: false })]);

    render(await ProfileSolutionsTab());

    expect(screen.getByText("Đề không còn hiện")).toBeTruthy();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("hết lượt nộp để gắn (attemptId null): cùng xử lý, không dựng URL '/attempt/null/'", async () => {
    getMySolutionsMock.mockResolvedValue([item({ attemptId: null })]);

    const { container } = render(await ProfileSolutionsTab());

    expect(screen.getByText("Đề không còn hiện")).toBeTruthy();
    expect(container.innerHTML).not.toContain("null");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("ProfileSolutionsTab — nhiều bài, rỗng, lỗi", () => {
  it("giữ nguyên thứ tự RPC trả về (mới cập nhật nhất trước), mỗi bài đúng một thẻ", async () => {
    getMySolutionsMock.mockResolvedValue([
      item({ solutionId: "s-a", examTitle: "Đề A" }),
      item({ solutionId: "s-b", examTitle: "Đề B", status: "draft" }),
      item({ solutionId: "s-c", examTitle: "Đề C", status: "hidden" }),
    ]);

    render(await ProfileSolutionsTab());

    const cards = screen.getAllByRole("listitem");
    expect(cards.map((c) => within(c).getByRole("heading").textContent)).toEqual(["Đề A", "Đề B", "Đề C"]);
  });

  it("chưa có bài nào: khung rỗng + câu hướng dẫn cách viết, không có danh sách", async () => {
    getMySolutionsMock.mockResolvedValue([]);

    render(await ProfileSolutionsTab());

    expect(screen.getByText("Bạn chưa viết bài giải nào.")).toBeTruthy();
    expect(screen.getByText("Vào một đề bạn đã nộp rồi bấm Viết bài giải ở trang kết quả.")).toBeTruthy();
    expect(screen.queryByRole("list")).toBeNull();
  });

  it("truy vấn ném lỗi: role=alert cục bộ + nút Thử lại về đúng ô, không ném ra ngoài", async () => {
    getMySolutionsMock.mockRejectedValue(new Error("boom"));

    render(await ProfileSolutionsTab());

    expect(screen.getByRole("alert").textContent).toContain("Chưa tải được bài giải của bạn.");
    expect(screen.getByRole("link", { name: "Thử lại" }).getAttribute("href")).toBe("/profile?tab=solutions");
  });
});
