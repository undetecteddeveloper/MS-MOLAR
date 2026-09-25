// @vitest-environment jsdom

// SolutionsListPage — /exams/[id]/solutions (S-03). Frontend DD § Data
// Contracts "Own-solution block contract" (AC-110/S20 — `getResultCardSummary`
// KHÔNG bao giờ được gọi ở route này) và "Writer load contract" (S11/AC-002/
// AC-004 — `null` ⇒ redirect trước khi render). Required Tests #1–#5, #8 (task
// 18 task file § Required Tests).
//
// Khuôn theo `(exams)/attempt/[attemptId]/solution/__tests__/page.test.tsx`
// (task 10): gọi thẳng hàm async của Server Component, KHÔNG qua Next runtime
// thật. Mock boundary: `@/features/solutions/queries` (bắt buộc mock cả
// `getResultCardSummary` dù route không gọi nó — số lần gọi CHÍNH LÀ khẳng
// định), `@/features/exams/queries` (tên đề cho breadcrumb/đầu trang, AC-052)
// và `next/navigation`'s `redirect`/`notFound`.

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionEditorState, SolutionListItem } from "@/features/solutions/queries";
import type { Exam } from "@/types/exam";

const {
  getMySolutionForWriterMock,
  listSolutionsMock,
  getResultCardSummaryMock,
  getExamMock,
  redirectMock,
  notFoundMock,
} = vi.hoisted(() => ({
  getMySolutionForWriterMock: vi.fn(),
  listSolutionsMock: vi.fn(),
  getResultCardSummaryMock: vi.fn(),
  getExamMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/features/solutions/queries", () => ({
  getMySolutionForWriter: getMySolutionForWriterMock,
  listSolutions: listSolutionsMock,
  getResultCardSummary: getResultCardSummaryMock,
}));
vi.mock("@/features/exams/queries", () => ({ getExam: getExamMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock, notFound: notFoundMock }));

const { default: SolutionsListPage } = await import("@/app/(exams)/exams/[id]/solutions/page");

afterEach(cleanup);
beforeEach(() => {
  getMySolutionForWriterMock.mockReset();
  listSolutionsMock.mockReset();
  getResultCardSummaryMock.mockReset();
  getExamMock.mockReset();
  redirectMock.mockClear();
  notFoundMock.mockClear();

  getExamMock.mockResolvedValue({ id: "E1", title: "Đề Toán 12" } as Exam);
});

function writerState(overrides: Partial<SolutionEditorState> = {}): SolutionEditorState {
  return {
    solutionId: "sol1",
    attemptId: "A1",
    status: "draft",
    showProfile: true,
    showScore: false,
    questions: [],
    ...overrides,
  };
}

function listItem(overrides: Partial<SolutionListItem> = {}): SolutionListItem {
  return {
    id: "S1",
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    author: { kind: "named", displayName: "Người viết" },
    helpfulCount: 0,
    iMarkedHelpful: false,
    commentCount: 0,
    changedQuestionCount: 0,
    ...overrides,
  };
}

async function renderPage() {
  const jsx = await SolutionsListPage({ params: Promise.resolve({ id: "E1" }) });
  return render(jsx);
}

describe("SolutionsListPage — getResultCardSummary KHÔNG BAO GIỜ được gọi (AC-110/S20, Required Test #1)", () => {
  it("render với state 50 câu: getResultCardSummary không được gọi lần nào", async () => {
    getMySolutionForWriterMock.mockResolvedValue(
      writerState({
        questions: Array.from({ length: 50 }, (_, i) => ({
          questionId: `q${i}`,
          stem: null,
          correctAnswer: null,
          myResult: null,
          note: "",
          wordCount: 0,
          hasChanged: false,
          essayPrefillApplied: false,
          questionType: "mcq" as const,
          choices: [],
        })),
      })
    );
    listSolutionsMock.mockResolvedValue([]);

    await renderPage();

    expect(getResultCardSummaryMock).not.toHaveBeenCalled();
  });
});

describe("SolutionsListPage — một lượt đọc getMySolutionForWriter (Required Test #2)", () => {
  it("gọi getMySolutionForWriter đúng MỘT lần mỗi lượt render", async () => {
    getMySolutionForWriterMock.mockResolvedValue(writerState());
    listSolutionsMock.mockResolvedValue([listItem(), listItem({ id: "S2" })]);

    await renderPage();

    expect(getMySolutionForWriterMock).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionsListPage — nội dung ghi chú KHÔNG rò ra client (Required Test #3)", () => {
  it("chuỗi cắm trong questions[0].note không xuất hiện ở bất kỳ đâu trên trang", async () => {
    const sentinel = "SENTINEL-NOTE-BODY-KHONG-DUOC-LO-RA-CLIENT";
    getMySolutionForWriterMock.mockResolvedValue(
      writerState({
        questions: [
          {
            questionId: "q1",
            stem: null,
            correctAnswer: null,
            myResult: null,
            note: sentinel,
            wordCount: 20,
            hasChanged: false,
            essayPrefillApplied: false,
            questionType: "mcq",
            choices: [],
          },
        ],
      })
    );
    listSolutionsMock.mockResolvedValue([]);

    const { container } = await renderPage();

    expect(container.textContent).not.toContain(sentinel);
  });
});

describe("SolutionsListPage — 0 dòng ⇒ redirect trước khi render (S11/AC-002/AC-004, Required Test #4)", () => {
  it("getMySolutionForWriter trả null: redirect('/exams/E1'), không render danh sách", async () => {
    getMySolutionForWriterMock.mockResolvedValue(null);

    await expect(
      SolutionsListPage({ params: Promise.resolve({ id: "E1" }) })
    ).rejects.toThrow("REDIRECT:/exams/E1");

    expect(redirectMock).toHaveBeenCalledWith("/exams/E1");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    // Danh sách/đề không được đọc khi đã biết chuyển hướng — không lãng phí
    // truy vấn cho một trang sẽ không render.
    expect(listSolutionsMock).not.toHaveBeenCalled();
    expect(getExamMock).not.toHaveBeenCalled();
  });
});

describe("SolutionsListPage — status: null (Required Test #5, AC-053)", () => {
  it("đúng MỘT liên kết 'Viết bài giải của bạn', KHÔNG 'Viết tiếp' / 'Xem lý do'", async () => {
    getMySolutionForWriterMock.mockResolvedValue(writerState({ solutionId: null, status: null }));
    listSolutionsMock.mockResolvedValue([]);

    await renderPage();

    expect(screen.getAllByRole("button", { name: "Viết bài giải của bạn" })).toHaveLength(1);
    expect(screen.queryByRole("button", { name: "Viết tiếp" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Xem lý do" })).toBeNull();
  });
});

describe("SolutionsListPage — số truy vấn không tăng theo số bài (AC-057, Required Test #8)", () => {
  it("listSolutions được gọi đúng MỘT lần dù danh sách có nhiều bài", async () => {
    getMySolutionForWriterMock.mockResolvedValue(writerState());
    listSolutionsMock.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) => listItem({ id: `S${i}` }))
    );

    await renderPage();

    expect(listSolutionsMock).toHaveBeenCalledTimes(1);
  });
});
