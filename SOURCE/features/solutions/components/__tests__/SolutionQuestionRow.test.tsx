// @vitest-environment jsdom

// SolutionQuestionRow — Required Tests #1-6 (task 20 file). `note.bodyNode` là
// một ReactNode LITERAL trong mọi ca dưới đây (`<span>Ghi chú</span>`) — hàng
// này không tự gọi RichText/SolutionNoteBlock (kiến trúc UI-D22: nơi gọi ở
// TRÊN, task 21, dựng sẵn ReactNode rồi mới truyền xuống).

import type { ComponentProps } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SolutionQuestionRow, selectRowLabel } from "@/features/solutions/components/SolutionQuestionRow";

afterEach(cleanup);

function Row(props: Partial<ComponentProps<typeof SolutionQuestionRow>> = {}) {
  return (
    <ul>
      <SolutionQuestionRow
        questionId="q1"
        index={0}
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>A</span>}
        hasChanged={false}
        onOpenComments={vi.fn()}
        {...props}
      />
    </ul>
  );
}

// ═══ Required Test 1 — thứ tự ưu tiên nhãn, table-driven (UI-D17, Reference Contract #2) ═══

describe("selectRowLabel — thứ tự ưu tiên UI-D17 (Required Test #1)", () => {
  const table: Array<{
    name: string;
    hasNote: boolean;
    hasChanged: boolean;
    result?: "correct" | "wrong" | "skipped";
    notAutoScored?: boolean;
    essayScore?: { earned: number; max: number };
    expectLabel: string | null;
  }> = [
    {
      name: "không ghi chú + câu đổi → CHỈ 'Chưa có lời giải'",
      hasNote: false,
      hasChanged: true,
      result: "correct",
      expectLabel: "Chưa có lời giải",
    },
    {
      name: "có ghi chú + câu đổi → CHỈ 'Câu hỏi đã thay đổi'",
      hasNote: true,
      hasChanged: true,
      result: "correct",
      expectLabel: "Câu hỏi đã thay đổi",
    },
    {
      name: "có ghi chú + không đổi + score hiện + đúng",
      hasNote: true,
      hasChanged: false,
      result: "correct",
      expectLabel: "Đúng",
    },
    {
      name: "có ghi chú + không đổi + score hiện + sai",
      hasNote: true,
      hasChanged: false,
      result: "wrong",
      expectLabel: "Người viết làm sai",
    },
    {
      name: "có ghi chú + không đổi + score hiện + bỏ trống",
      hasNote: true,
      hasChanged: false,
      result: "skipped",
      expectLabel: "Người viết bỏ trống",
    },
    {
      name: "có ghi chú + không đổi + chưa chấm tự động",
      hasNote: true,
      hasChanged: false,
      notAutoScored: true,
      expectLabel: "Chưa chấm tự động",
    },
    {
      name: "có ghi chú + không đổi + điểm tự luận",
      hasNote: true,
      hasChanged: false,
      essayScore: { earned: 7, max: 10 },
      expectLabel: "Đã chấm: 7/10 điểm",
    },
    {
      name: "có ghi chú + không đổi + score ẩn (vắng cả 4 khoá) → không nhãn",
      hasNote: true,
      hasChanged: false,
      expectLabel: null,
    },
  ];

  it.each(table)("$name", ({ hasNote, hasChanged, result, notAutoScored, essayScore, expectLabel }) => {
    const label = selectRowLabel({ hasNote, hasChanged, result, notAutoScored, essayScore });
    if (expectLabel === null) {
      expect(label).toBeNull();
      return;
    }
    expect(label).not.toBeNull();
  });

  it.each(table)("$name — hàng render đúng 1 Badge (hoặc 0) với chữ khớp", ({
    hasNote,
    hasChanged,
    result,
    notAutoScored,
    essayScore,
    expectLabel,
  }) => {
    const { container } = render(
      <Row
        hasChanged={hasChanged}
        result={result}
        notAutoScored={notAutoScored}
        essayScore={essayScore}
        note={hasNote ? { bodyNode: <span>Ghi chú</span> } : undefined}
      />
    );

    const badges = container.querySelectorAll('[data-slot="badge"]');
    expect(badges.length).toBe(expectLabel === null ? 0 : 1);
    if (expectLabel !== null) {
      expect(badges[0].textContent).toBe(expectLabel);
    }
  });
});

// ═══ Required Test 2 — score ẩn: không nhãn/nhãn kết quả nào, đóng lẫn mở (AC-040) ═══

describe("Score ẩn — không rò rỉ nhãn kết quả nào ở cả trạng thái đóng và mở (Required Test #2, Reference Contract #19)", () => {
  const FORBIDDEN = /Chưa chấm tự động|Đã chấm|Chưa chấm|Người viết (chọn|trả lời|làm sai|bỏ trống)/;

  it("true_false không có notAutoScored/result/writerChoiceNode, và tự luận không có essayScore — cả hai không hiện chữ cấm, đáp án đúng + ghi chú vẫn còn", () => {
    const { container } = render(
      <ul>
        <SolutionQuestionRow
          questionId="q-tf"
          index={0}
          stemNode={<span>Đề true_false</span>}
          correctAnswerNode={<span>a) Đ · b) S</span>}
          hasChanged={false}
          note={{ bodyNode: <span>Ghi chú true_false</span>, commentCount: 2 }}
          onOpenComments={vi.fn()}
        />
        <SolutionQuestionRow
          questionId="q-essay"
          index={1}
          stemNode={<span>Đề tự luận</span>}
          correctAnswerNode={<span>Đáp án mẫu tự luận</span>}
          hasChanged={false}
          note={{ bodyNode: <span>Ghi chú tự luận</span> }}
          onOpenComments={vi.fn()}
        />
      </ul>
    );

    // Đóng: không chữ cấm nào.
    expect(container.textContent).not.toMatch(FORBIDDEN);

    // Mở cả hai hàng.
    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));
    fireEvent.click(screen.getByRole("button", { name: /Câu 2/ }));

    expect(container.textContent).not.toMatch(FORBIDDEN);
    expect(screen.getByText("a) Đ · b) S")).toBeTruthy();
    expect(screen.getByText("Đáp án mẫu tự luận")).toBeTruthy();
    expect(screen.getByText("Ghi chú true_false")).toBeTruthy();
    expect(screen.getByText("Ghi chú tự luận")).toBeTruthy();
  });
});

// ═══ Required Test 3 — notAutoScored:true kèm score có mặt (AC-041, UI-D16) ═══

describe("notAutoScored với score có mặt (Required Test #3)", () => {
  it("hiện 'Chưa chấm tự động' ở đầu hàng (đóng) VÀ bên trong nội dung mở", () => {
    render(
      <Row
        notAutoScored
        writerChoiceNode={<span>a) Đ · b) Đ</span>}
        correctAnswerNode={<span>a) Đ · b) S</span>}
        note={{ bodyNode: <span>Ghi chú</span> }}
      />
    );

    // Đóng: badge đầu hàng.
    expect(screen.getByText("Chưa chấm tự động")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));

    // Mở: badge đầu hàng + badge bên trong QuestionAnswerSummary = 2 lần chữ.
    expect(screen.getAllByText("Chưa chấm tự động").length).toBe(2);
    expect(screen.getByText("Người viết trả lời:")).toBeTruthy();
  });
});

// ═══ Required Test 4 — có note nhưng không commentCount: không nút, không chữ đếm ═══

describe("Không commentCount: không nút bình luận, không chữ 'm bình luận' (Required Test #4, Reference Contract #20)", () => {
  it("note có mặt (đủ điều kiện hiện) nhưng commentCount vắng mặt", () => {
    const { container } = render(
      <Row result="correct" note={{ bodyNode: <span>Ghi chú riêng</span> }} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));

    expect(screen.getByText("Ghi chú riêng")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /bình luận/i })).toBeNull();
    expect(container.textContent).not.toMatch(/bình luận/i);
  });
});

// ═══ Required Test 5 — commentCount: 0 vẫn hiện nút "Bình luận" ═══

describe("commentCount: 0 vẫn hiện nút (Required Test #5, Reference Contract #20)", () => {
  it("bấm nút 'Bình luận' gọi onOpenComments(questionId)", () => {
    const onOpenComments = vi.fn();
    render(
      <Row result="correct" note={{ bodyNode: <span>Ghi chú</span>, commentCount: 0 }} onOpenComments={onOpenComments} />
    );

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));
    const commentButton = screen.getByRole("button", { name: "Bình luận" });
    fireEvent.click(commentButton);

    expect(onOpenComments).toHaveBeenCalledWith("q1");
    // Đầu hàng không hiện "0 bình luận" — chữ đếm đầu hàng chỉ hiện khi m > 0.
    expect(screen.queryByText(/0 bình luận/)).toBeNull();
  });
});

// ═══ Required Test 6 — "Chưa có lời giải": không note ⇒ không nút bình luận nào ═══

describe("'Chưa có lời giải' — không note (Required Test #6, AC-048)", () => {
  it("hiện badge 'Chưa có lời giải' và không có nút bình luận nào dù mở hàng", () => {
    render(<Row />);

    expect(screen.getByText("Chưa có lời giải")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Câu 1/ }));

    expect(screen.queryByRole("button", { name: /bình luận/i })).toBeNull();
  });
});

// ═══ Required Test 7 — id/tabIndex/scroll-mt-24/defaultOpen cộng thêm (task 21, Decision 1, AC-061) ═══

describe("Additive id/tabIndex/scroll-mt-24/defaultOpen (Required Test #7, AC-061, task 21)", () => {
  it("không truyền gì (mọi caller task 20 hiện có): <li> gốc không id, không scroll-mt-24, hàng đóng như cũ", () => {
    const { container } = render(<Row note={{ bodyNode: <span>Ghi chú</span> }} />);

    const li = container.querySelector("li");
    expect(li?.getAttribute("id")).toBeNull();
    expect(li?.getAttribute("tabindex")).toBeNull();
    expect(li?.className ?? "").not.toMatch(/scroll-mt-24/);
    expect(screen.getByRole("button", { name: /Câu 1/ }).getAttribute("aria-expanded")).toBe("false");
  });

  it("truyền id/tabIndex/defaultOpen: <li> gốc mang id/tabIndex/scroll-mt-24, và hàng mở sẵn ngay từ lượt render đầu (không cần bấm)", () => {
    const { container } = render(
      <Row
        id="solution-question-q1"
        tabIndex={-1}
        defaultOpen
        note={{ bodyNode: <span>Ghi chú</span> }}
      />
    );

    const li = container.querySelector("li");
    expect(li?.id).toBe("solution-question-q1");
    expect(li?.getAttribute("tabindex")).toBe("-1");
    expect(li?.className).toMatch(/scroll-mt-24/);

    // Mở sẵn: nội dung panel hiện ngay, không cần fireEvent.click.
    expect(screen.getByText("Ghi chú")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Câu 1/ }).getAttribute("aria-expanded")).toBe("true");
  });
});
