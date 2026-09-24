// @vitest-environment jsdom

// SolutionEditorPage — writer load `null` → redirect (row 1, AC-002/AC-004,
// S11) và route guard trên `attemptId` (row 10, Boundary Context: server
// không bao giờ tin URL một mình). Khuôn theo `(exams)/__tests__/layout.test.tsx`:
// gọi thẳng hàm async của Server Component, KHÔNG qua Next runtime thật.
//
// Mock boundary: `@/features/solutions/queries` (nguồn dữ liệu, task 04) và
// `next/navigation`'s `redirect` (ném lỗi mô phỏng hành vi thật của Next —
// `redirect()` không bao giờ "return" bình thường).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SolutionEditorState } from "@/features/solutions/queries";

const { getMySolutionForWriterMock, redirectMock } = vi.hoisted(() => ({
  getMySolutionForWriterMock: vi.fn(),
  redirectMock: vi.fn((path: string) => {
    throw new Error(`REDIRECT:${path}`);
  }),
}));

vi.mock("@/features/solutions/queries", () => ({
  getMySolutionForWriter: getMySolutionForWriterMock,
}));
// `SolutionEditorScreen` (rendered on the non-redirect branch) imports
// `saveSolution`/`setSolutionStatus` at the module top level; the real
// `actions.ts` pulls in `@/lib/security/rateLimit` → `@/lib/billing/paidTier`
// → the real `server-only` package, which throws under jsdom regardless of
// this file's own mocks. Neither action is ever called by these tests (no
// save/publish interaction), so a bare stub is enough.
vi.mock("@/features/solutions/actions", () => ({
  saveSolution: vi.fn(),
  setSolutionStatus: vi.fn(),
}));
vi.mock("next/navigation", () => ({ redirect: redirectMock }));

const { default: SolutionEditorPage } = await import(
  "@/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page"
);

afterEach(cleanup);
beforeEach(() => {
  getMySolutionForWriterMock.mockReset();
  redirectMock.mockClear();
});

function baseState(overrides: Partial<SolutionEditorState> = {}): SolutionEditorState {
  return {
    solutionId: null,
    attemptId: "A1",
    status: null,
    showProfile: true,
    showScore: false,
    questions: [],
    ...overrides,
  };
}

describe("SolutionEditorPage — writer load null (row 1)", () => {
  it("getMySolutionForWriter trả null: redirect('/exams/E1') TRƯỚC khi render nội dung màn viết nào", async () => {
    getMySolutionForWriterMock.mockResolvedValue(null);

    await expect(
      SolutionEditorPage({ params: Promise.resolve({ id: "E1", attemptId: "A1" }) })
    ).rejects.toThrow("REDIRECT:/exams/E1");

    expect(redirectMock).toHaveBeenCalledWith("/exams/E1");
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });
});

describe("SolutionEditorPage — route guard trên attemptId (row 10, Boundary Context)", () => {
  it("attemptId của URL khác attemptId thật của state: redirect, không render editor", async () => {
    getMySolutionForWriterMock.mockResolvedValue(baseState({ attemptId: "REAL-ATTEMPT" }));

    await expect(
      SolutionEditorPage({ params: Promise.resolve({ id: "E1", attemptId: "FOREIGN-OR-MALFORMED" }) })
    ).rejects.toThrow("REDIRECT:/exams/E1");

    expect(redirectMock).toHaveBeenCalledWith("/exams/E1");
  });

  it("attemptId khớp đúng lượt làm state trả về: render SolutionEditorScreen, không redirect", async () => {
    getMySolutionForWriterMock.mockResolvedValue(
      baseState({ attemptId: "A1", solutionId: "s1", status: "draft" })
    );

    const jsx = await SolutionEditorPage({ params: Promise.resolve({ id: "E1", attemptId: "A1" }) });
    render(jsx);

    expect(redirectMock).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Bài giải của bạn" })).toBeTruthy();
  });
});
