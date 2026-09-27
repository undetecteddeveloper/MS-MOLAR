// @vitest-environment jsdom

// SolutionCard (C-06) — UI Spec § Component: SolutionCard; frontend DD §
// Main Components "SolutionList.tsx + SolutionCard.tsx"; § Data Contracts
// `SolutionListItem`. Ba nghĩa vụ chứng minh chính của file này:
//   1. Danh tính ẩn danh không rò rỉ (AC-039) — kể cả khi đó là bài của
//      CHÍNH người xem (AC-062).
//   2. Huy hiệu điểm đúng hai hình dạng, không có hình thứ ba (Reference
//      Contract Value #18, AC-040/AC-041).
//   3. Tín hiệu sở hữu ("Bài của bạn"/"Sửa") chỉ từ `isMine`/`editHref`,
//      không bao giờ từ so sánh `item.author` (AC-053, AC-062).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SolutionCard } from "@/features/solutions/components/SolutionCard";
import type { SolutionListItem } from "@/features/solutions/queries";

const NOW = new Date("2026-09-20T10:05:00.000Z");
const EXAM_ID = "E1";

function item(overrides: Partial<SolutionListItem> = {}): SolutionListItem {
  return {
    id: "S1",
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    helpfulCount: 3,
    iMarkedHelpful: false,
    commentCount: 2,
    changedQuestionCount: 0,
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof SolutionCard>[0]> = {}) {
  return render(
    <ul>
      <SolutionCard item={item()} examId={EXAM_ID} now={NOW} {...props} />
    </ul>
  );
}

afterEach(cleanup);

describe("SolutionCard — danh tính (AC-039, AC-105)", () => {
  it("bài có tên: hiện tên, không hiện 'Ẩn danh'", () => {
    renderCard({ item: item({ author: { kind: "named", displayName: "Nguyễn Văn A" } }) });
    expect(screen.getByText("Nguyễn Văn A")).toBeTruthy();
    expect(screen.queryByText("Ẩn danh")).toBeNull();
  });

  it("bài ẩn danh (không bật điểm): không tên, không <img>, không chữ điểm nào trong thẻ", () => {
    const { container } = renderCard({
      item: item({ author: { kind: "anonymous" } }),
    });
    expect(screen.getByText("Ẩn danh")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Nguyễn Văn A")).toBeNull();
    expect(screen.queryByText(/trên 10/)).toBeNull();
  });

  it("bài ghim + ẩn danh: hiện CẢ 'Tác giả đề ghim' lẫn 'Ẩn danh' (AC-079)", () => {
    renderCard({ item: item({ isPinned: true, author: { kind: "anonymous" } }) });
    expect(screen.getByText("Tác giả đề ghim")).toBeTruthy();
    expect(screen.getByText("Ẩn danh")).toBeTruthy();
  });
});

describe("SolutionCard — huy hiệu điểm, đúng hai hình dạng (Reference Contract #18, AC-040/AC-041)", () => {
  it("score có, không chấm (scoreGrading vắng): '7.5 trên 10'", () => {
    renderCard({ item: item({ score: 7.5 }) });
    expect(screen.getByText("7.5 trên 10")).toBeTruthy();
  });

  it("score có, scoreGrading true: '7.5 trên 10 · đang chấm'", () => {
    renderCard({ item: item({ score: 7.5, scoreGrading: true }) });
    expect(screen.getByText("7.5 trên 10 · đang chấm")).toBeTruthy();
  });

  it("score có, scoreGrading false: giống hệt trường hợp vắng ('7.5 trên 10')", () => {
    renderCard({ item: item({ score: 7.5, scoreGrading: false }) });
    expect(screen.getByText("7.5 trên 10")).toBeTruthy();
  });

  it("score vắng, scoreGrading true: KHÔNG có huy hiệu nào (AC-040 thắng)", () => {
    renderCard({ item: item({ scoreGrading: true }) });
    expect(screen.queryByText(/trên 10/)).toBeNull();
  });
});

describe("SolutionCard — thẻ phủ liên kết (AC-055)", () => {
  it("mở đúng /exams/{examId}/solutions/{id}, tên trợ năng theo tác giả", () => {
    renderCard({ item: item({ id: "S9", author: { kind: "named", displayName: "Nguyễn Văn A" } }) });
    const link = screen.getByRole("link", { name: "Mở bài giải của Nguyễn Văn A" });
    expect(link.getAttribute("href")).toBe("/exams/E1/solutions/S9");
  });

  it("bài ẩn danh: tên trợ năng của liên kết phủ thẻ là 'Ẩn danh', không phải tên thật", () => {
    renderCard({ item: item({ author: { kind: "anonymous" } }) });
    expect(screen.getByRole("link", { name: "Mở bài giải của Ẩn danh" })).toBeTruthy();
  });
});

describe("SolutionCard — sở hữu chỉ từ isMine/editHref (AC-053, AC-062)", () => {
  it("isMine true + editHref: có 'Bài của bạn' và liên kết 'Sửa' đúng href", () => {
    renderCard({
      item: item({ isMine: true }),
      editHref: "/exams/E1/attempt/A1/solution",
    });
    expect(screen.getByText("Bài của bạn")).toBeTruthy();
    const editLink = screen.getByRole("link", { name: "Sửa" });
    expect(editLink.getAttribute("href")).toBe("/exams/E1/attempt/A1/solution");
    // Sàn chạm 44px: liên kết chữ "Sửa" phải giữ min-h-11 dù nội dung 1 dòng tự nhiên thấp hơn.
    expect(editLink.className).toContain("min-h-11");
  });

  it("isMine true, KHÔNG có editHref: 'Bài của bạn' vẫn hiện, không có liên kết 'Sửa'", () => {
    renderCard({ item: item({ isMine: true }) });
    expect(screen.getByText("Bài của bạn")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
  });

  it("isMine false: không 'Bài của bạn', không 'Sửa'", () => {
    renderCard({ item: item({ isMine: false }) });
    expect(screen.queryByText("Bài của bạn")).toBeNull();
    expect(screen.queryByRole("link", { name: "Sửa" })).toBeNull();
  });

  it("bài của CHÍNH mình dưới danh tính ẩn danh: 'Ẩn danh' VÀ 'Bài của bạn' VÀ 'Sửa' cùng có mặt (AC-062)", () => {
    renderCard({
      item: item({ isMine: true, author: { kind: "anonymous" } }),
      editHref: "/exams/E1/attempt/A1/solution",
    });
    expect(screen.getByText("Ẩn danh")).toBeTruthy();
    expect(screen.getByText("Bài của bạn")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Sửa" }).getAttribute("href")).toBe(
      "/exams/E1/attempt/A1/solution"
    );
  });
});

describe("SolutionCard — hàng đếm (AC-055)", () => {
  it("hiện 'x hữu ích' và 'y bình luận' theo đúng số của item", () => {
    renderCard({ item: item({ helpfulCount: 5, commentCount: 0 }) });
    expect(screen.getByText("5 hữu ích")).toBeTruthy();
    expect(screen.getByText("0 bình luận")).toBeTruthy();
  });
});

describe("SolutionCard — chấm chưa đọc chỉ trên thẻ của mình (AC-091, AC-092, AC-094, task 29)", () => {
  it("isMine true + unreadCommentCount=3: hiện '3 bình luận mới' cùng chấm aria-hidden", () => {
    const { container } = renderCard({
      item: item({ isMine: true }),
      unreadCommentCount: 3,
    });
    expect(screen.getByText("3 bình luận mới")).toBeTruthy();
    const dot = container.querySelector("span[aria-hidden].bg-destructive.size-2.rounded-full");
    expect(dot).toBeTruthy();
  });

  it("isMine true + unreadCommentCount=0: KHÔNG hiện chữ 'bình luận mới' nào", () => {
    renderCard({ item: item({ isMine: true }), unreadCommentCount: 0 });
    expect(screen.queryByText(/bình luận mới/)).toBeNull();
  });

  it("isMine true, KHÔNG truyền unreadCommentCount: KHÔNG hiện chữ 'bình luận mới' nào", () => {
    renderCard({ item: item({ isMine: true }) });
    expect(screen.queryByText(/bình luận mới/)).toBeNull();
  });

  it("isMine false NHƯNG có unreadCommentCount=5 (giả lập truyền nhầm): KHÔNG hiện chấm/chữ nào (D38/AC-094)", () => {
    renderCard({ item: item({ isMine: false }), unreadCommentCount: 5 });
    expect(screen.queryByText(/bình luận mới/)).toBeNull();
    expect(screen.queryByText("5 bình luận mới")).toBeNull();
  });
});
