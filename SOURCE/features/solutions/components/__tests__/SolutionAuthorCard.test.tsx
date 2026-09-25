// @vitest-environment jsdom

// SolutionAuthorCard (C-23) — frontend DD § Required Tests rows 9-11. Mock
// boundary: only `@/features/solutions/actions` (consumed transitively by
// `HelpfulButton`/`SolutionMenu`); `lib/solutions/identity.ts` stays real.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionAuthorCardHeader } from "@/features/solutions/components/SolutionAuthorCard";

const { toggleHelpfulMock, setPinMock } = vi.hoisted(() => ({
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
}));

const { SolutionAuthorCard } = await import("@/features/solutions/components/SolutionAuthorCard");

const NOW = new Date("2026-09-20T10:05:00.000Z");
const EXAM_ID = "E1";

function header(overrides: Partial<SolutionAuthorCardHeader> = {}): SolutionAuthorCardHeader {
  return {
    id: "S1",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    helpfulCount: 3,
    iMarkedHelpful: false,
    iReported: false,
    ...overrides,
  };
}

function renderCard(props: Partial<Parameters<typeof SolutionAuthorCard>[0]> = {}) {
  return render(
    <SolutionAuthorCard
      solution={header()}
      examId={EXAM_ID}
      now={NOW}
      isExamAuthor={false}
      {...props}
    />
  );
}

afterEach(cleanup);
beforeEach(() => {
  toggleHelpfulMock.mockReset();
  setPinMock.mockReset();
});

describe("SolutionAuthorCard — Required Test 9 (huy hiệu điểm, đúng hai hình dạng)", () => {
  it("score có, không chấm: '7.5 trên 10'", () => {
    renderCard({ solution: header({ score: 7.5 }) });
    expect(screen.getByText("7.5 trên 10")).toBeTruthy();
  });

  it("score có, scoreGrading true: '7.5 trên 10 · đang chấm'", () => {
    renderCard({ solution: header({ score: 7.5, scoreGrading: true }) });
    expect(screen.getByText("7.5 trên 10 · đang chấm")).toBeTruthy();
  });

  it("score có, scoreGrading false: giống hệt trường hợp vắng ('7.5 trên 10')", () => {
    renderCard({ solution: header({ score: 7.5, scoreGrading: false }) });
    expect(screen.getByText("7.5 trên 10")).toBeTruthy();
  });

  it("score vắng, scoreGrading true: KHÔNG có huy hiệu nào (AC-040 thắng)", () => {
    renderCard({ solution: header({ scoreGrading: true }) });
    expect(screen.queryByText(/trên 10/)).toBeNull();
  });
});

describe("SolutionAuthorCard — Required Test 10 (AC-062)", () => {
  it("isMine: true -> chữ 'x hữu ích', 'Sửa bài giải' trong menu, KHÔNG có nút Hữu ích", () => {
    renderCard({
      solution: header({ isMine: true, helpfulCount: 24 }),
      editHref: "/exams/E1/attempt/A1/solution",
    });

    expect(screen.getByText("24 hữu ích")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Hữu ích/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));
    expect(screen.getByRole("menuitem", { name: "Sửa bài giải" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "Báo cáo bài giải" })).toBeNull();
  });
});

describe("SolutionAuthorCard — Required Test 11 (ghim + ẩn danh)", () => {
  it("bài ghim + ẩn danh: 'Tác giả đề ghim' + 'Ẩn danh', không tên/ảnh nào trong thẻ", () => {
    const { container } = renderCard({
      solution: header({ isPinned: true, author: { kind: "anonymous" } }),
    });

    expect(screen.getByText("Tác giả đề ghim")).toBeTruthy();
    expect(screen.getByText("Ẩn danh")).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect(screen.queryByText("Nguyễn Văn A")).toBeNull();
  });
});
