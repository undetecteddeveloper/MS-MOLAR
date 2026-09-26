// @vitest-environment jsdom

// ReportedSolutionsSection — UI Spec § Component: ReportedSolutionsSection
// (C-37); PRD R17. Proof Obligations #1 (AC-109: no "Bỏ qua", part = solution
// status), #3 (AC-107 / Failure Mode #8: hidden comments stay inside their row
// in both parts; a hard-deleted row leaves both parts), #6 (Reference Contract
// Value #26: a hidden row with 0 reports is still queued) and the author-shape
// DOM check (no avatar rendered on /admin).
//
// Mock boundary: `@/features/solutions/adminActions` mocked at the module
// boundary; the mocked Server Actions are passed as props exactly as
// `app/(admin)/admin/page.tsx` passes the real ones (B4).

import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/solutions/adminActions", () => ({
  moderateSolutionAction: vi.fn(),
  moderateCommentAction: vi.fn(),
  listCommunityReports: vi.fn(),
  getSolutionNotesForAdmin: vi.fn(),
}));

const { moderateSolutionAction, moderateCommentAction } = await import("@/features/solutions/adminActions");
const { ReportedSolutionsSection } = await import("@/features/admin/components/ReportedSolutionsSection");
type AdminReportedSolution = import("@/features/admin/components/ReportedSolutionRow").AdminReportedSolution;
type AdminHiddenCommentItem = import("@/features/admin/components/ReportedCommentItem").AdminHiddenCommentItem;

afterEach(cleanup);

const NOW = new Date("2026-09-27T10:00:00.000Z");

const HIDDEN_COMMENT: AdminHiddenCommentItem = {
  id: "hc1",
  questionNumber: 2,
  body: "Bình luận đã bị ẩn",
  commenter: { displayName: "Lan", isAnonymousToReaders: false },
  hiddenReason: "spam",
  hiddenAt: "2026-09-26T10:00:00Z",
  reportCount: 1,
};

function solution(overrides: Partial<AdminReportedSolution> = {}): AdminReportedSolution {
  return {
    id: "s1",
    examId: "e1",
    examTitle: "Đề mặc định",
    author: { displayName: "Minh", isAnonymousToReaders: false },
    status: "published",
    reportCount: 1,
    reportReasons: ["Sai"],
    reportedComments: [],
    hiddenComments: [],
    ...overrides,
  };
}

function renderSection(rows: AdminReportedSolution[]) {
  const ui = (list: AdminReportedSolution[]) => (
    <ReportedSolutionsSection
      items={list.map((row) => ({ row, notes: [] }))}
      now={NOW}
      onModerateSolution={moderateSolutionAction}
      onModerateComment={moderateCommentAction}
    />
  );
  const utils = render(ui(rows));
  return { ...utils, rerenderRows: (next: AdminReportedSolution[]) => utils.rerender(ui(next)) };
}

function pendingPart() {
  return screen.getByRole("region", { name: /^Chờ xử lý/ });
}

function hiddenPart() {
  return screen.getByRole("region", { name: /^Đã ẩn/ });
}

describe("ReportedSolutionsSection — Proof Obligation #1 (AC-109)", () => {
  it("không phần tử nào tên 'Bỏ qua'; published → 'Chờ xử lý', hidden → 'Đã ẩn'", () => {
    renderSection([
      solution({ id: "p1", examTitle: "Đề A (đang hiện)", status: "published" }),
      solution({ id: "h1", examTitle: "Đề B (bị ẩn)", status: "hidden" }),
    ]);

    expect(screen.getByRole("heading", { name: /Bài giải bị báo cáo/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Bỏ qua/ })).toBeNull();
    expect(screen.queryByText(/Bỏ qua|Đóng báo cáo/)).toBeNull();

    expect(within(pendingPart()).getByText("Đề A (đang hiện)")).toBeTruthy();
    expect(within(pendingPart()).queryByText("Đề B (bị ẩn)")).toBeNull();
    expect(within(hiddenPart()).getByText("Đề B (bị ẩn)")).toBeTruthy();
    expect(within(hiddenPart()).queryByText("Đề A (đang hiện)")).toBeNull();
  });

  it("phần của hàng chỉ theo status: hàng published có 0 báo cáo trên bài (chỉ báo cáo bình luận) vẫn ở 'Chờ xử lý'", () => {
    renderSection([
      solution({
        id: "p2",
        examTitle: "Đề C",
        reportCount: 0,
        reportReasons: [],
        reportedComments: [
          {
            id: "rc1",
            questionNumber: 1,
            body: "BL",
            commenter: { displayName: "Hà", isAnonymousToReaders: false },
            reportCount: 1,
            reportReasons: ["x"],
          },
        ],
      }),
    ]);

    expect(within(pendingPart()).getByText("Đề C")).toBeTruthy();
  });

  it("huy hiệu đếm số hàng của từng phần", () => {
    renderSection([
      solution({ id: "p1", status: "published" }),
      solution({ id: "p2", status: "published" }),
      solution({ id: "h1", status: "hidden" }),
    ]);

    expect(pendingPart().querySelector("h3 [data-slot=badge]")?.textContent).toBe("2");
    expect(hiddenPart().querySelector("h3 [data-slot=badge]")?.textContent).toBe("1");
  });
});

describe("ReportedSolutionsSection — Proof Obligation #6 / Admin queue-membership test (Reference Contract Value #26)", () => {
  it("hidden, reportCount 0, không lý do, không bình luận báo cáo, 1 bình luận đã ẩn → ở 'Đã ẩn' với [Khôi phục]/[Xoá hẳn] + mục con", () => {
    renderSection([
      solution({
        id: "h0",
        examTitle: "Đề ẩn không báo cáo",
        status: "hidden",
        reportCount: 0,
        reportReasons: [],
        reportedComments: [],
        hiddenComments: [HIDDEN_COMMENT],
      }),
    ]);

    const part = hiddenPart();
    const row = within(part).getByText("Đề ẩn không báo cáo").closest("li")!;
    expect(row).toBeTruthy();
    expect(within(row).getByText("Bình luận đã ẩn")).toBeTruthy();
    expect(within(row).getByText("Bình luận đã bị ẩn")).toBeTruthy();
    // Nút của CHÍNH hàng (không tính nút của bình luận đã ẩn bên trong).
    const rowForm = within(row).getAllByRole("button", { name: "Khôi phục" });
    expect(rowForm.length).toBe(2);
    expect(within(row).getAllByRole("button", { name: "Xoá hẳn" }).length).toBe(2);
    expect(within(pendingPart()).queryByText("Đề ẩn không báo cáo")).toBeNull();
  });
});

describe("ReportedSolutionsSection — Proof Obligation #3 (AC-107, Failure Mode #8)", () => {
  it("hàng có 1 bình luận đã ẩn ở 'Chờ xử lý' → mục con hiện TRONG hàng, hàng không đổi phần", () => {
    renderSection([
      solution({ id: "p1", examTitle: "Đề có BL ẩn", status: "published", hiddenComments: [HIDDEN_COMMENT] }),
    ]);

    const row = within(pendingPart()).getByText("Đề có BL ẩn").closest("li")!;
    expect(within(row).getByText("Bình luận đã ẩn")).toBeTruthy();
    expect(within(hiddenPart()).queryByText("Đề có BL ẩn")).toBeNull();
  });

  it("hiddenComments không rỗng → mục con ở CẢ hai phần; [] → không có mục con nào", () => {
    renderSection([
      solution({ id: "p1", examTitle: "Đề P", status: "published", hiddenComments: [HIDDEN_COMMENT] }),
      solution({ id: "h1", examTitle: "Đề H", status: "hidden", hiddenComments: [{ ...HIDDEN_COMMENT, id: "hc2" }] }),
      solution({ id: "p2", examTitle: "Đề Q", status: "published", hiddenComments: [] }),
    ]);

    const rowP = within(pendingPart()).getByText("Đề P").closest("li")!;
    const rowH = within(hiddenPart()).getByText("Đề H").closest("li")!;
    const rowQ = within(pendingPart()).getByText("Đề Q").closest("li")!;
    expect(within(rowP).getByText("Bình luận đã ẩn")).toBeTruthy();
    expect(within(rowH).getByText("Bình luận đã ẩn")).toBeTruthy();
    expect(within(rowQ).queryByText("Bình luận đã ẩn")).toBeNull();
  });

  it("chuyển trạng thái qua fixture: ẩn → hàng sang 'Đã ẩn'; xoá hẳn → hàng biến khỏi CẢ hai phần", () => {
    const row = solution({ id: "t1", examTitle: "Đề chuyển", status: "published", hiddenComments: [HIDDEN_COMMENT] });
    const { rerenderRows } = renderSection([row]);
    expect(within(pendingPart()).getByText("Đề chuyển")).toBeTruthy();

    rerenderRows([{ ...row, status: "hidden" }]);
    expect(within(pendingPart()).queryByText("Đề chuyển")).toBeNull();
    const moved = within(hiddenPart()).getByText("Đề chuyển").closest("li")!;
    expect(within(moved).getByText("Bình luận đã ẩn")).toBeTruthy();

    rerenderRows([]);
    expect(screen.queryByText("Đề chuyển")).toBeNull();
    expect(within(pendingPart()).getByText("Không có báo cáo nào.")).toBeTruthy();
    expect(within(hiddenPart()).getByText("Không có báo cáo nào.")).toBeTruthy();
  });
});

describe("ReportedSolutionsSection — trạng thái rỗng (C-37 'Rỗng')", () => {
  it("không hàng nào → mỗi phần một thẻ 'Không có báo cáo nào.'", () => {
    renderSection([]);

    expect(within(pendingPart()).getByText("Không có báo cáo nào.")).toBeTruthy();
    expect(within(hiddenPart()).getByText("Không có báo cáo nào.")).toBeTruthy();
    expect(screen.queryAllByRole("listitem")).toHaveLength(0);
  });
});

describe("ReportedSolutionsSection — không avatar trên /admin (author-shape, DOM half)", () => {
  it("hàng + bình luận ẩn danh/không ẩn danh: không <img> nào được dựng", () => {
    const { container } = renderSection([
      solution({ id: "p1", author: { displayName: "Minh", isAnonymousToReaders: true }, hiddenComments: [HIDDEN_COMMENT] }),
    ]);

    expect(container.querySelector("img")).toBeNull();
  });
});
