// @vitest-environment jsdom

// SolutionViewScreen (C-22, task 21) — frontend DD § Test Boundaries
// "Already-reported tests" (header half), "Comment-affordance tests"; UI Spec
// § Component: SolutionViewScreen (AC-061 liên kết sâu, Rỗng). Mock boundary:
// chỉ `@/features/solutions/actions` (tiêu thụ gián tiếp bởi
// `HelpfulButton`/`SolutionMenu` bên trong `SolutionAuthorCard`) — mọi thứ
// khác chạy mã thật.

import type { ComponentProps } from "react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import type { SolutionAuthorCardHeader } from "@/features/solutions/components/SolutionAuthorCard";

const { toggleHelpfulMock, setPinMock, postCommentMock, deleteCommentMock } = vi.hoisted(() => ({
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
  // task 28 — CommentSheet/CommentItem (mounted via the `?comments=1` deep
  // link tests below) import postComment/deleteComment from this same
  // module; neither is exercised by the pre-existing tests in this file.
  postCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
}));

vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
  postComment: postCommentMock,
  deleteComment: deleteCommentMock,
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

// ═══ Nút "Bảng câu hỏi" bị chặn khi 0 câu hiện hành (DD-U4, frontend DD §
// Test Boundaries "Empty palette trigger tests" — cùng khẳng định task 09) ═══

describe("SolutionViewScreen — nút Bảng câu hỏi bị chặn khi 0 câu hiện hành (DD-U4)", () => {
  it("không mount QuestionPaletteDock: nút tĩnh, aria-disabled, không disabled gốc, mở không panel nào", () => {
    renderScreen({ questionNodes: [] });

    const trigger = screen.getByRole("button", { name: "Bảng câu hỏi" });
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    expect(trigger.hasAttribute("disabled")).toBe(false);
    expect(trigger.hasAttribute("aria-expanded")).toBe(false);
    expect(trigger.hasAttribute("aria-controls")).toBe(false);

    const describedById = trigger.getAttribute("aria-describedby");
    expect(describedById).toBeTruthy();
    expect(document.getElementById(describedById!)?.textContent).toBe(
      "Đề này hiện không còn câu hỏi nào."
    );

    fireEvent.click(trigger);
    expect(screen.queryByRole("region", { name: "Bảng câu hỏi" })).toBeNull();
  });
});

// ═══ Ô "hiện tại" của bảng câu hỏi (AC-051) — chọn ô k đặt lại "vị trí hiện
// tại" và mở đúng hàng k tại chỗ; chọn ô khác chuyển aria-current sang ô mới,
// không để lại hai ô cùng mang aria-current ═══

describe("SolutionViewScreen — ô hiện tại của bảng câu hỏi (AC-051)", () => {
  const FIVE_QUESTIONS: ComponentProps<typeof SolutionViewScreen>["questionNodes"] = Array.from(
    { length: 5 },
    (_, i) => ({
      questionId: `q${i + 1}`,
      stemNode: <span>{`Đề ${i + 1}`}</span>,
      correctAnswerNode: <span>Đáp án {i + 1}</span>,
      hasChanged: false,
    })
  );

  function openPalette() {
    fireEvent.click(screen.getByRole("button", { name: "Bảng câu hỏi" }));
  }

  function panel() {
    return screen.getByRole("region", { name: "Bảng câu hỏi" });
  }

  function chooseCell(number: number) {
    fireEvent.click(within(panel()).getByRole("button", { name: `Câu ${number}` }));
  }

  it("chọn ô 2 rồi ô 5: đúng một ô mang aria-current, ô cũ mất aria-current khi ô mới được chọn", () => {
    renderScreen({ questionNodes: FIVE_QUESTIONS });

    openPalette();
    chooseCell(2);

    openPalette();
    expect(within(panel()).getByRole("button", { name: "Câu 2" }).getAttribute("aria-current")).toBe(
      "true"
    );
    expect(within(panel()).getByRole("button", { name: "Câu 1" }).getAttribute("aria-current")).toBeNull();
    chooseCell(5);

    openPalette();
    expect(within(panel()).getByRole("button", { name: "Câu 5" }).getAttribute("aria-current")).toBe(
      "true"
    );
    expect(within(panel()).getByRole("button", { name: "Câu 2" }).getAttribute("aria-current")).toBeNull();
  });

  it("chọn ô 4: bảng đóng, hàng 4 mở tại chỗ", () => {
    renderScreen({ questionNodes: FIVE_QUESTIONS });

    openPalette();
    chooseCell(4);

    expect(screen.queryByRole("region", { name: "Bảng câu hỏi" })).toBeNull();
    expect(screen.getByRole("button", { name: /Câu 4/ }).getAttribute("aria-expanded")).toBe("true");
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

// ═══ Task 28 mount — CommentSheet wired from the row callback and from the
// parsed `?comments=1` flag (Required Tests #7, #11) ═══

describe("SolutionViewScreen — mount CommentSheet (task 28, Required Test #11)", () => {
  it("?comments=1 + ?q=2: mở sẵn CommentSheet của đúng câu 2 (AC-068)", async () => {
    renderScreen({
      questionNodes: [
        { questionId: "q1", stemNode: <span>Đề 1</span>, correctAnswerNode: <span>A</span>, hasChanged: false },
        {
          questionId: "q2",
          stemNode: <span>Đề 2</span>,
          correctAnswerNode: <span>B</span>,
          hasChanged: false,
          note: { bodyNode: <span>Ghi chú 2</span>, commentCount: 1 },
          comments: [
            {
              id: "c1",
              author: { kind: "named", displayName: "Nguyễn Văn A" },
              isSolutionAuthor: false,
              isMine: false,
              body: "Bình luận sẵn có",
              iReported: false,
              createdAt: "2026-09-20T10:00:00.000Z",
            },
          ],
        },
      ],
      initialOpenQuestion: 2,
      initialCommentsOpen: true,
    });

    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 2" })).toBeTruthy();
    expect(await screen.findByText("Bình luận sẵn có")).toBeTruthy();
  });

  it("bấm nút bình luận của một hàng: mở CommentSheet của đúng hàng đó", async () => {
    renderScreen({
      questionNodes: [
        {
          questionId: "q1",
          stemNode: <span>Đề 1</span>,
          correctAnswerNode: <span>A</span>,
          hasChanged: false,
          note: { bodyNode: <span>Ghi chú</span>, commentCount: 0 },
          comments: [],
        },
      ],
    });

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));
    fireEvent.click(screen.getByRole("button", { name: "Bình luận" }));

    expect(await screen.findByRole("heading", { name: "Bình luận · Câu 1" })).toBeTruthy();
  });
});

describe("SolutionViewScreen — đếm bình luận đọc commentCount, không đọc comments.length (Required Test #7)", () => {
  it("note.commentCount: 3 trong khi comments.length: 4 ⇒ hiện '3 bình luận'", () => {
    renderScreen({
      questionNodes: [
        {
          questionId: "q1",
          stemNode: <span>Đề 1</span>,
          correctAnswerNode: <span>A</span>,
          hasChanged: false,
          note: { bodyNode: <span>Ghi chú</span>, commentCount: 3 },
          comments: [
            {
              id: "c1",
              author: { kind: "named", displayName: "A" },
              isSolutionAuthor: false,
              isMine: false,
              body: "1",
              iReported: false,
              createdAt: "2026-09-20T10:00:00.000Z",
            },
            {
              id: "c2",
              author: { kind: "named", displayName: "B" },
              isSolutionAuthor: false,
              isMine: false,
              body: "2",
              iReported: false,
              createdAt: "2026-09-20T10:00:00.000Z",
            },
            {
              id: "c3",
              author: { kind: "named", displayName: "C" },
              isSolutionAuthor: false,
              isMine: false,
              body: "3",
              iReported: false,
              createdAt: "2026-09-20T10:00:00.000Z",
            },
            {
              id: "c4",
              author: { kind: "named", displayName: "D" },
              isSolutionAuthor: true,
              isMine: true,
              body: "4",
              isHiddenByAdmin: true,
              hiddenReason: "…",
              iReported: false,
              createdAt: "2026-09-20T10:00:00.000Z",
            },
          ],
        },
      ],
    });

    expect(screen.getByText("3 bình luận")).toBeTruthy();
    expect(screen.queryByText("4 bình luận")).toBeNull();
  });
});
