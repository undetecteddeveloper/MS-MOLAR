// @vitest-environment jsdom

// AdminPage (`app/(admin)/admin/page.tsx`) — composition of the new
// "Bài giải bị báo cáo" section (overview R7 / B4 wiring rule, frontend DD
// § Minimal Surface Alternatives Element 11). Plan § P4-T7 Proof Obligation:
// AC-085 (non-admin → `notFound()`, existing gate unchanged).
//
// Pattern: call the async Server Component directly, no Next runtime (same as
// `SolutionsListPage.test.tsx`). Mock boundary: `@/features/solutions/adminActions`
// (the four functions the page imports), the existing exam-moderation data
// source (`listReportedExams`) and its `ModerationRow` action module, the
// auth helpers, and `next/navigation`'s `notFound`.

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminReportedSolution } from "@/features/solutions/adminActions";

const {
  listCommunityReportsMock,
  getSolutionNotesForAdminMock,
  moderateSolutionActionMock,
  moderateCommentActionMock,
  listReportedExamsMock,
  getCurrentUserMock,
  isAdminUserIdMock,
  notFoundMock,
} = vi.hoisted(() => ({
  listCommunityReportsMock: vi.fn(),
  getSolutionNotesForAdminMock: vi.fn(),
  moderateSolutionActionMock: vi.fn(),
  moderateCommentActionMock: vi.fn(),
  listReportedExamsMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  isAdminUserIdMock: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

vi.mock("@/features/solutions/adminActions", () => ({
  listCommunityReports: listCommunityReportsMock,
  getSolutionNotesForAdmin: getSolutionNotesForAdminMock,
  moderateSolutionAction: moderateSolutionActionMock,
  moderateCommentAction: moderateCommentActionMock,
}));
vi.mock("@/lib/supabase/service-role", () => ({ listReportedExams: listReportedExamsMock }));
vi.mock("@/features/admin/actions", () => ({ moderateExamAction: vi.fn() }));
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUser: getCurrentUserMock }));
vi.mock("@/lib/auth/admin", () => ({
  isAdminUserId: isAdminUserIdMock,
  hasAdminsConfigured: () => true,
}));
vi.mock("next/navigation", () => ({ notFound: notFoundMock }));

const { default: AdminPage } = await import("@/app/(admin)/admin/page");

afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserMock.mockResolvedValue({ id: "admin-1", email: "admin@example.com" });
  isAdminUserIdMock.mockReturnValue(true);
  listReportedExamsMock.mockResolvedValue([]);
  listCommunityReportsMock.mockResolvedValue([]);
  getSolutionNotesForAdminMock.mockResolvedValue([]);
});

function solution(overrides: Partial<AdminReportedSolution>): AdminReportedSolution {
  return {
    id: "s1",
    examId: "e1",
    examTitle: "Đề",
    author: { displayName: "Minh", isAnonymousToReaders: false },
    status: "published",
    reportCount: 1,
    reportReasons: ["Sai"],
    reportedComments: [],
    hiddenComments: [],
    ...overrides,
  };
}

describe("AdminPage — cổng admin giữ nguyên (AC-085)", () => {
  it("không phải admin → notFound(), không đọc hàng đợi bài giải nào", async () => {
    isAdminUserIdMock.mockReturnValue(false);

    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
    expect(listCommunityReportsMock).not.toHaveBeenCalled();
    expect(getSolutionNotesForAdminMock).not.toHaveBeenCalled();
  });

  it("chưa đăng nhập → notFound()", async () => {
    getCurrentUserMock.mockResolvedValue(null);

    await expect(AdminPage()).rejects.toThrow("NOT_FOUND");
    expect(listCommunityReportsMock).not.toHaveBeenCalled();
  });
});

describe("AdminPage — ghép mục 'Bài giải bị báo cáo' (R7, Element 11)", () => {
  it("gọi getSolutionNotesForAdmin(row.id) cho TỪNG hàng và đưa ghi chú vào đúng hàng; mục đề cũ vẫn còn", async () => {
    listCommunityReportsMock.mockResolvedValue([
      solution({ id: "sA", examTitle: "Đề A" }),
      solution({ id: "sB", examTitle: "Đề B", status: "hidden" }),
    ]);
    getSolutionNotesForAdminMock.mockImplementation(async (id: string) =>
      id === "sA"
        ? [{ questionNumber: 1, questionId: "qa", body: "Ghi chú của A" }]
        : [{ questionNumber: 2, questionId: "qb", body: "Ghi chú của B" }]
    );

    render(await AdminPage());

    expect(getSolutionNotesForAdminMock).toHaveBeenCalledTimes(2);
    expect(getSolutionNotesForAdminMock).toHaveBeenCalledWith("sA");
    expect(getSolutionNotesForAdminMock).toHaveBeenCalledWith("sB");

    const rowA = screen.getByText("Đề A").closest("li")!;
    const rowB = screen.getByText("Đề B").closest("li")!;
    expect(within(rowA).getByText("Ghi chú của A")).toBeTruthy();
    expect(within(rowA).queryByText("Ghi chú của B")).toBeNull();
    expect(within(rowB).getByText("Ghi chú của B")).toBeTruthy();

    // Mục báo cáo đề hiện có (ModerationSection) không bị thay thế.
    expect(listReportedExamsMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("region", { name: "Bài giải bị báo cáo" })).toBeTruthy();
    expect(screen.getAllByRole("heading", { name: /^Chờ xử lý/ }).length).toBeGreaterThanOrEqual(2);
  });

  it("không có bài giải nào bị báo cáo → không gọi getSolutionNotesForAdmin, hai phần hiện thẻ rỗng", async () => {
    render(await AdminPage());

    expect(getSolutionNotesForAdminMock).not.toHaveBeenCalled();
    const section = screen.getByRole("region", { name: "Bài giải bị báo cáo" });
    expect(within(section).getAllByText("Không có báo cáo nào.")).toHaveLength(2);
  });
});
