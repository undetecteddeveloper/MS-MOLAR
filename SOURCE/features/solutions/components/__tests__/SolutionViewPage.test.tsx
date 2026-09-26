// @vitest-environment jsdom

// SolutionViewPage — /exams/[id]/solutions/[solutionId] (S-05). Task 21 §
// Implementation Steps "Red Phase": rào S11/AC-063 (hidden/nonexistent redirect
// giống hệt nhau, không phân biệt), Rỗng không lỗi, liên kết sâu tới câu đã
// xoá vẫn mở trang bình thường, và `parseSolutionDeepLink` (Boundary Context
// "Roundtrip check").
//
// Khuôn theo `SolutionsListPage.test.tsx` (task 18): gọi thẳng hàm async của
// Server Component, KHÔNG qua Next runtime thật. Mock boundary:
// `@/features/solutions/queries`, `@/features/exams/queries`,
// `next/navigation`'s `redirect`, và `@/features/solutions/actions` (tiêu thụ
// gián tiếp bởi `HelpfulButton`/`SolutionMenu` bên trong `SolutionAuthorCard`
// khi trang render đầy đủ).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionDetail, SolutionDetailQuestion, SolutionEditorState } from "@/features/solutions/queries";
import type { Exam } from "@/types/exam";

const {
  getSolutionDetailMock,
  getMySolutionForWriterMock,
  getExamMock,
  isExamAuthorMock,
  redirectMock,
  toggleHelpfulMock,
  setPinMock,
  postCommentMock,
  deleteCommentMock,
  getCurrentUserProfileMock,
} = vi.hoisted(() => ({
  getSolutionDetailMock: vi.fn(),
  getMySolutionForWriterMock: vi.fn(),
  getExamMock: vi.fn(),
  isExamAuthorMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
  toggleHelpfulMock: vi.fn(),
  setPinMock: vi.fn(),
  // task 28 — page.tsx now also reads the viewer's own profile to build the
  // optimistic identity CommentSheet needs; not exercised by these tests.
  postCommentMock: vi.fn(),
  deleteCommentMock: vi.fn(),
  getCurrentUserProfileMock: vi.fn(),
}));

vi.mock("@/features/solutions/queries", () => ({
  getSolutionDetail: getSolutionDetailMock,
  getMySolutionForWriter: getMySolutionForWriterMock,
}));
vi.mock("@/features/exams/queries", () => ({ getExam: getExamMock, isExamAuthor: isExamAuthorMock }));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));
vi.mock("@/features/solutions/actions", () => ({
  toggleHelpful: toggleHelpfulMock,
  setPin: setPinMock,
  postComment: postCommentMock,
  deleteComment: deleteCommentMock,
}));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUserProfile: getCurrentUserProfileMock }));

const { default: SolutionViewPage, parseSolutionDeepLink } = await import(
  "@/app/(exams)/exams/[id]/solutions/[solutionId]/page"
);

// jsdom không có scrollIntoView (cùng ghi chú `QuestionPaletteDock.test.tsx`).
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(cleanup);
beforeEach(() => {
  getSolutionDetailMock.mockReset();
  getMySolutionForWriterMock.mockReset();
  getExamMock.mockReset();
  isExamAuthorMock.mockReset();
  redirectMock.mockClear();
  toggleHelpfulMock.mockReset();
  setPinMock.mockReset();
  postCommentMock.mockReset();
  deleteCommentMock.mockReset();
  getCurrentUserProfileMock.mockReset();

  getCurrentUserProfileMock.mockResolvedValue(null);
  getMySolutionForWriterMock.mockResolvedValue({
    solutionId: "S1",
    attemptId: "A1",
    status: "published",
    showProfile: true,
    showScore: true,
    questions: [],
  } satisfies SolutionEditorState);
  getExamMock.mockResolvedValue({ id: "E1", title: "Đề Toán 12" } as Exam);
  isExamAuthorMock.mockResolvedValue(false);
});

function detail(overrides: Partial<SolutionDetail> = {}): SolutionDetail {
  return {
    id: "S1",
    author: { kind: "named", displayName: "Nguyễn Văn A" },
    isPinned: false,
    updatedAt: "2026-09-20T10:00:00.000Z",
    isMine: false,
    helpfulCount: 0,
    iMarkedHelpful: false,
    iReported: false,
    questions: [],
    ...overrides,
  };
}

function question(overrides: Partial<SolutionDetailQuestion> = {}): SolutionDetailQuestion {
  return {
    questionId: "q1",
    stem: "Đề 1",
    correctAnswer: "A",
    hasChanged: false,
    comments: [],
    ...overrides,
  };
}

async function renderPage(sp: { q?: string; comments?: string } = {}) {
  const jsx = await SolutionViewPage({
    params: Promise.resolve({ id: "E1", solutionId: "S1" }),
    searchParams: Promise.resolve(sp),
  });
  return render(jsx);
}

describe("parseSolutionDeepLink — parser thuần (Boundary Context, Roundtrip check)", () => {
  it("?q=3&comments=1 trên đề 10 câu ⇒ { q: 3, commentsOpen: true }", () => {
    expect(parseSolutionDeepLink("3", "1", 10)).toEqual({ q: 3, commentsOpen: true });
  });

  it("?q=999 trên đề 10 câu ⇒ kẹp về q: 10, không vắng mặt", () => {
    expect(parseSolutionDeepLink("999", undefined, 10)).toEqual({ q: 10, commentsOpen: false });
  });

  it("?q=abc ⇒ q vắng mặt", () => {
    expect(parseSolutionDeepLink("abc", undefined, 10).q).toBeUndefined();
  });

  it("?comments=true ⇒ commentsOpen: false (whitelist chỉ nhận đúng chuỗi '1')", () => {
    expect(parseSolutionDeepLink(undefined, "true", 10).commentsOpen).toBe(false);
  });

  it("?q=0 trên đề 10 câu ⇒ kẹp về q: 1 (không mở nhầm 'không có gì')", () => {
    expect(parseSolutionDeepLink("0", undefined, 10).q).toBe(1);
  });

  it("đề rỗng (questionCount = 0) ⇒ q vắng mặt dù ?q hợp lệ", () => {
    expect(parseSolutionDeepLink("1", undefined, 0).q).toBeUndefined();
  });
});

describe("SolutionViewPage — getSolutionDetail trả null ⇒ redirect (S11/AC-063), KHÔNG phân biệt hidden/nonexistent", () => {
  it("bài ẩn của người khác: redirect('/exams/E1') TRƯỚC mọi truy vấn khác", async () => {
    getSolutionDetailMock.mockResolvedValue(null);

    await expect(
      SolutionViewPage({
        params: Promise.resolve({ id: "E1", solutionId: "S-hidden" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("REDIRECT:/exams/E1");

    expect(redirectMock).toHaveBeenCalledWith("/exams/E1");
    expect(redirectMock).toHaveBeenCalledTimes(1);
    expect(getMySolutionForWriterMock).not.toHaveBeenCalled();
    expect(getExamMock).not.toHaveBeenCalled();
    expect(isExamAuthorMock).not.toHaveBeenCalled();
  });

  it("bài không tồn tại: redirect ĐÚNG Y HỆT — cùng một đường, không tiết lộ khác biệt", async () => {
    getSolutionDetailMock.mockResolvedValue(null);

    await expect(
      SolutionViewPage({
        params: Promise.resolve({ id: "E1", solutionId: "S-nope" }),
        searchParams: Promise.resolve({}),
      })
    ).rejects.toThrow("REDIRECT:/exams/E1");

    expect(redirectMock).toHaveBeenCalledWith("/exams/E1");
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionViewPage — Rỗng (tất cả câu hiện hành đã bị xoá) không lỗi", () => {
  it("questions: [] ⇒ render thẻ 'Đề này hiện không còn câu hỏi nào.', không throw", async () => {
    getSolutionDetailMock.mockResolvedValue(detail({ questions: [] }));

    await renderPage();

    expect(screen.getByText("Đề này hiện không còn câu hỏi nào.")).toBeTruthy();
  });
});

describe("SolutionViewPage — liên kết sâu tới câu đã bị xoá vẫn mở trang bình thường (AC-061 note)", () => {
  it("?q=5 trên đề còn 2 câu (câu 5 đã mất) ⇒ mở hàng 2 (kẹp vào chỉ số hợp lệ), không lỗi", async () => {
    getSolutionDetailMock.mockResolvedValue(
      detail({ questions: [question({ questionId: "q1" }), question({ questionId: "q2" })] })
    );

    await renderPage({ q: "5" });

    const row1 = screen.getByRole("button", { name: /Câu 1/ });
    const row2 = screen.getByRole("button", { name: /Câu 2/ });
    expect(row1.getAttribute("aria-expanded")).toBe("false");
    expect(row2.getAttribute("aria-expanded")).toBe("true");
  });
});
