// @vitest-environment jsdom

// OwnSolutionBlock (C-05) — UI Spec § Component: OwnSolutionBlock; frontend
// DD § Data Contracts "Own-solution block contract". Bốn nhánh theo
// `summary.status`, đúng và chỉ đúng bốn (AC-053).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { OwnSolutionBlock, type OwnSolutionSummary } from "@/features/solutions/components/OwnSolutionBlock";

const EXAM_ID = "E1";
const HREF = "/exams/E1/attempt/A1/solution";

function summary(overrides: Partial<OwnSolutionSummary>): OwnSolutionSummary {
  return {
    status: null,
    attemptId: "A1",
    notedCount: 0,
    questionCount: 12,
    changedQuestionCount: 0,
    ...overrides,
  };
}

afterEach(cleanup);

describe("OwnSolutionBlock — status: null (Rỗng, AC-053)", () => {
  it("đúng một liên kết 'Viết bài giải của bạn', không thanh tiến độ, không dòng 'Đã ghi chú'", () => {
    render(<OwnSolutionBlock summary={summary({ status: null })} examId={EXAM_ID} />);

    const cta = screen.getByRole("button", { name: "Viết bài giải của bạn" });
    expect(cta.getAttribute("href")).toBe(HREF);
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByText(/Đã ghi chú/)).toBeNull();
  });
});

describe("OwnSolutionBlock — status: draft (AC-053, AC-045, AC-027)", () => {
  it("hiện 'Đã ghi chú 3/12 câu', progressbar cùng tên trợ năng, badge 'Nháp', liên kết 'Viết tiếp', KHÔNG dòng 'đã thay đổi'", () => {
    render(
      <OwnSolutionBlock
        summary={summary({ status: "draft", notedCount: 3, questionCount: 12, changedQuestionCount: 0 })}
        examId={EXAM_ID}
      />
    );

    const line = screen.getByText("Đã ghi chú 3/12 câu");
    expect(line).toBeTruthy();
    const bar = screen.getByRole("progressbar", { name: "Đã ghi chú 3/12 câu" });
    expect(bar.getAttribute("aria-valuenow")).toBe("3");
    expect(bar.getAttribute("aria-valuemax")).toBe("12");
    expect(screen.getByText("Nháp")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Viết tiếp" }).getAttribute("href")).toBe(HREF);
    expect(screen.queryByText(/đã thay đổi/)).toBeNull();
  });

  it("changedQuestionCount: 2 → hiện dòng '2 câu hỏi đã thay đổi, hãy cập nhật'", () => {
    render(
      <OwnSolutionBlock
        summary={summary({ status: "draft", notedCount: 3, questionCount: 12, changedQuestionCount: 2 })}
        examId={EXAM_ID}
      />
    );

    expect(screen.getByText("2 câu hỏi đã thay đổi, hãy cập nhật")).toBeTruthy();
  });
});

describe("OwnSolutionBlock — status: hidden (AC-053, AC-083)", () => {
  it("badge 'Bị ẩn', câu thông báo, liên kết 'Xem lý do', không progressbar", () => {
    render(<OwnSolutionBlock summary={summary({ status: "hidden" })} examId={EXAM_ID} />);

    expect(screen.getByText("Bị ẩn")).toBeTruthy();
    expect(screen.getByText("Bài giải của bạn đã bị ẩn bởi quản trị viên.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Xem lý do" }).getAttribute("href")).toBe(HREF);
    expect(screen.queryByRole("progressbar")).toBeNull();
  });
});

describe("OwnSolutionBlock — status: published (AC-053)", () => {
  it("render null — thẻ của tôi nằm trong danh sách thay vì ở đây", () => {
    const { container } = render(<OwnSolutionBlock summary={summary({ status: "published" })} examId={EXAM_ID} />);
    expect(container.firstChild).toBeNull();
  });
});
