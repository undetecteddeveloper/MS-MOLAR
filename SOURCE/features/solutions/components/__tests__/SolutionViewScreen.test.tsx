// @vitest-environment jsdom

// SolutionViewScreen (C-22, task 21) — frontend DD § Test Boundaries
// "Already-reported tests" (header half), "Comment-affordance tests"; UI Spec
// § Component: SolutionViewScreen (AC-061 liên kết sâu, Rỗng). Mock boundary:
// chỉ `@/features/solutions/actions` (tiêu thụ gián tiếp bởi
// `HelpfulButton`/`SolutionMenu` bên trong `SolutionAuthorCard`) — mọi thứ
// khác chạy mã thật.

import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { SolutionAuthorCardHeader } from "@/features/solutions/components/SolutionAuthorCard";

const { toggleHelpfulMock, setPinMock } = vi.hoisted(() => ({
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
}));

const { SolutionViewScreen } = await import("@/features/solutions/components/SolutionViewScreen");

// jsdom không có scrollIntoView (cùng ghi chú `QuestionPaletteDock.test.tsx`).
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);
beforeEach(() => {
  toggleHelpfulMock.mockReset();
  setPinMock.mockReset();
});

const NOW = new Date("2026-09-26T10:00:00.000Z");
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

function renderScreen(props: Partial<ComponentProps<typeof SolutionViewScreen>> = {}) {
  return render(
    <SolutionViewScreen
      solution={header()}
      examId={EXAM_ID}
      now={NOW}
      isExamAuthor={false}
      questionNodes={[]}
      initialCommentsOpen={false}
      {...props}
    />
  );
}

// ═══ iReported threading — CHỈ nửa đầu bài (SolutionMenu); nửa bình luận cần
// task 28 (task file § Notes "Sequencing") ═══

describe("SolutionViewScreen — iReported threading (Test Boundaries 'Already-reported tests', nửa đầu bài)", () => {
  it("iReported: true ⇒ đúng MỘT 'Bạn đã báo cáo bài giải này.' trong menu", () => {
    renderScreen({ solution: header({ iReported: true }) });

    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));

    expect(screen.getAllByText(/Bạn đã báo cáo bài giải này\./).length).toBe(1);
    expect(screen.queryByRole("menuitem", { name: "Báo cáo bài giải" })).toBeNull();
  });

  it("iReported: false ⇒ KHÔNG có 'Bạn đã báo cáo bài giải này.', menu hiện 'Báo cáo bài giải' thường", () => {
    renderScreen({ solution: header({ iReported: false }) });

    fireEvent.click(screen.getByRole("button", { name: "Thêm" }));

    expect(screen.queryByText(/Bạn đã báo cáo bài giải này\./)).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Báo cáo bài giải" })).toBeTruthy();
  });
});

// ═══ Comment affordance ở CẤP MÀN (Test Boundaries "Comment-affordance
// tests", Reference Contract Value #20) — commentCount đi NGUYÊN VẸN qua
// SolutionViewScreen, không thêm/bớt gì ═══

describe("SolutionViewScreen — comment affordance ở cấp màn (AC-048, Reference Contract #20)", () => {
  it("note có mặt, commentCount VẮNG MẶT ⇒ hiện ghi chú, KHÔNG nút bình luận, không chữ 'm bình luận'", () => {
    renderScreen({
      questionNodes: [
        {
          questionId: "q1",
          stemNode: <span>Đề 1</span>,
          correctAnswerNode: <span>A</span>,
          hasChanged: false,
          result: "correct",
          note: { bodyNode: <span>Ghi chú riêng</span> },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));

    expect(screen.getByText("Ghi chú riêng")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /bình luận/i })).toBeNull();
  });

  it("note có mặt, commentCount: 0 ⇒ hiện nút 'Bình luận'", () => {
    renderScreen({
      questionNodes: [
        {
          questionId: "q2",
          stemNode: <span>Đề 2</span>,
          correctAnswerNode: <span>B</span>,
          hasChanged: false,
          result: "correct",
          note: { bodyNode: <span>Ghi chú</span>, commentCount: 0 },
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));

    expect(screen.getByRole("button", { name: "Bình luận" })).toBeTruthy();
  });
});

// ═══ Rỗng (AC-047/AC-061 note, DD-U4) — thẻ nét đứt + id useId() cho task 22 ═══

describe("SolutionViewScreen — Rỗng (đề không còn câu hiện hành nào)", () => {
  it("0 câu ⇒ thẻ nét đứt 'Đề này hiện không còn câu hỏi nào.' với phần tử mang id", () => {
    renderScreen({ questionNodes: [] });

    const text = screen.getByText("Đề này hiện không còn câu hỏi nào.");
    expect(text.id).toBeTruthy();
  });
});

// ═══ Liên kết sâu ?q=k (AC-061) — mở sẵn + cuộn + focus, MỘT LẦN khi mount ═══

describe("SolutionViewScreen — liên kết sâu ?q=k (AC-061)", () => {
  const THREE_QUESTIONS: ComponentProps<typeof SolutionViewScreen>["questionNodes"] = [
    { questionId: "q1", stemNode: <span>Đề 1</span>, correctAnswerNode: <span>A</span>, hasChanged: false },
    { questionId: "q2", stemNode: <span>Đề 2</span>, correctAnswerNode: <span>B</span>, hasChanged: false },
    { questionId: "q3", stemNode: <span>Đề 3</span>, correctAnswerNode: <span>C</span>, hasChanged: false },
  ];

  it("initialOpenQuestion=3: đúng hàng 3 mở sẵn (không cần bấm), mang id/tabIndex/scroll-mt-24, nhận tiêu điểm", () => {
    renderScreen({ questionNodes: THREE_QUESTIONS, initialOpenQuestion: 3 });

    const row1 = screen.getByRole("button", { name: /Câu 1/ });
    const row3 = screen.getByRole("button", { name: /Câu 3/ });
    expect(row1.getAttribute("aria-expanded")).toBe("false");
    expect(row3.getAttribute("aria-expanded")).toBe("true");

    const li3 = row3.closest("li");
    expect(li3?.id).toBe("solution-question-q3");
    expect(li3?.getAttribute("tabindex")).toBe("-1");
    expect(li3?.className).toMatch(/scroll-mt-24/);

    // Tiêu điểm đặt lên đầu hàng k (UI Spec AC-061 "tiêu điểm đặt lên đầu hàng").
    expect(document.activeElement).toBe(li3);
  });

  it("không có initialOpenQuestion: không hàng nào mở sẵn, không hàng nào nhận tiêu điểm", () => {
    renderScreen({ questionNodes: THREE_QUESTIONS });

    for (const label of [/Câu 1/, /Câu 2/, /Câu 3/]) {
      expect(screen.getByRole("button", { name: label }).getAttribute("aria-expanded")).toBe("false");
    }
    expect(document.activeElement).toBe(document.body);
  });
});
