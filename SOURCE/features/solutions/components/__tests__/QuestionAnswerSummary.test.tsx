// @vitest-environment jsdom

// QuestionAnswerSummary (biến thể người viết) — nhánh "Chưa chấm tự động"
// (UI-D16, Required Test #10) cho true_false/short_answer không có phán
// quyết đúng/sai, MỞ RỘNG (cùng file, follow-up sau khi
// `community_solution_for_writer` được bổ sung question_type/choices/
// sub_answers/essay_answer, commit 4b0ea52) để phủ "Xem N phương án" (mcq,
// AC-022/AC-060) và "Đáp án mẫu" (tự luận, AC-022 "nếu đề có").
// `stemNode`/`correctAnswerNode`/`choiceNodes`/`subItemNodes`/`essayAnswerNode`
// là ReactNode giả lập (đã dựng sẵn phía server trong production, xem
// writerQuestionNodes.tsx).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { QuestionAnswerSummary } from "@/features/solutions/components/QuestionAnswerSummary";
import type { PerQuestionResult } from "@/types/result";

afterEach(cleanup);

function outcome(overrides: Partial<PerQuestionResult>): PerQuestionResult {
  return { questionId: "q1", isCorrect: false, ...overrides };
}

describe("QuestionAnswerSummary — nhánh 'Chưa chấm tự động' (Required Test #10, UI-D16)", () => {
  it("true_false (selected mã hoá tfCodec): hiện badge muted + 'Bạn trả lời:' giải mã đúng", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="true_false"
        outcome={outcome({ scored: false, selected: "a:Đ,b:S", isCorrect: false })}
      />
    );

    expect(screen.getByText("Chưa chấm tự động")).toBeTruthy();
    expect(screen.getByText("Bạn trả lời:")).toBeTruthy();
    expect(screen.getByText("a) Đ · b) S")).toBeTruthy();
  });

  it("short_answer chưa chấm (scored:false, không phải true_false): hiện nguyên văn câu trả lời", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="short_answer"
        outcome={outcome({ scored: false, selected: "12/7", isCorrect: false })}
      />
    );

    expect(screen.getByText("Chưa chấm tự động")).toBeTruthy();
    expect(screen.getByText("12/7")).toBeTruthy();
  });

  it("bỏ trống (selected rỗng): 'Bạn trả lời:' hiện '— bỏ trống —'", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="short_answer"
        outcome={outcome({ scored: false, selected: undefined, isCorrect: false })}
      />
    );

    expect(screen.getByText("— bỏ trống —")).toBeTruthy();
  });

  it("essay (outcome.essay có mặt) KHÔNG rơi vào nhánh 'Chưa chấm tự động' (UI-D16 loại trừ tự luận)", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="essay"
        outcome={outcome({
          scored: false,
          isCorrect: false,
          essay: { state: "graded", earned: 1, max: 1, lowConfidence: false, retryAvailable: false },
          earnedPoints: 8,
          maxPoints: 10,
        })}
      />
    );

    expect(screen.queryByText("Chưa chấm tự động")).toBeNull();
    expect(screen.getByText("Đã chấm: 8/10 điểm")).toBeTruthy();
  });

  it("mcq (outcome.correct có mặt, scored !== false): hiện badge 'Đáp án đúng' + nhãn kết quả", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>A</span>}
        questionType="mcq"
        outcome={outcome({ correct: "A", selected: "A", isCorrect: true })}
      />
    );

    expect(screen.queryByText("Chưa chấm tự động")).toBeNull();
    expect(screen.getByText("Bạn làm đúng")).toBeTruthy();
  });
});

describe("QuestionAnswerSummary — 'Xem N phương án' (AC-022, AC-060, mcq)", () => {
  function choiceNodes() {
    return [
      { id: "A", textNode: <span>Phương án A</span>, isCorrect: true },
      { id: "B", textNode: <span>Phương án B</span>, isCorrect: false },
      { id: "C", textNode: <span>Phương án C</span>, isCorrect: false },
      { id: "D", textNode: <span>Phương án D</span>, isCorrect: false },
    ];
  }

  it("mặc định đóng: nút 'Xem 4 phương án' hiện, danh sách chưa hiện", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>A</span>}
        questionType="mcq"
        choiceNodes={choiceNodes()}
        outcome={outcome({ correct: "A", selected: "A", isCorrect: true })}
      />
    );

    const button = screen.getByRole("button", { name: "Xem 4 phương án" });
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("Phương án A")).toBeNull();
  });

  it("bấm nút: cả 4 phương án hiện ra tại chỗ, đáp án đúng được đánh dấu", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>A</span>}
        questionType="mcq"
        choiceNodes={choiceNodes()}
        outcome={outcome({ correct: "A", selected: "A", isCorrect: true })}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Xem 4 phương án" }));

    expect(screen.getByText("Phương án A")).toBeTruthy();
    expect(screen.getByText("Phương án B")).toBeTruthy();
    expect(screen.getByText("Phương án C")).toBeTruthy();
    expect(screen.getByText("Phương án D")).toBeTruthy();
    // Đáp án đúng (A) mang thêm huy hiệu "Đáp án đúng" bên cạnh phương án — hai
    // lần chữ "Đáp án đúng" trên trang: badge tóm tắt ở trên + badge trong hàng A.
    expect(screen.getAllByText("Đáp án đúng").length).toBe(2);
    expect(screen.getByRole("button", { name: "Ẩn phương án" })).toBeTruthy();
  });

  it("không có choiceNodes (mảng rỗng/undefined): không có nút 'Xem N phương án'", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>A</span>}
        questionType="mcq"
        outcome={outcome({ correct: "A", selected: "A", isCorrect: true })}
      />
    );

    expect(screen.queryByRole("button", { name: /Xem \d+ phương án/ })).toBeNull();
  });
});

describe("QuestionAnswerSummary — 'Đáp án mẫu' (AC-022, tự luận)", () => {
  it("essay_answer có nội dung: hiện nhãn 'Đáp án mẫu' + nội dung", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="essay"
        essayAnswerNode={<span>Nêu ba giai đoạn chuyển biến.</span>}
        outcome={outcome({
          scored: false,
          essay: { state: "graded", earned: 0.75, max: 1, lowConfidence: false, retryAvailable: false },
          earnedPoints: 7.5,
          maxPoints: 10,
        })}
      />
    );

    expect(screen.getByText("Đáp án mẫu")).toBeTruthy();
    expect(screen.getByText("Nêu ba giai đoạn chuyển biến.")).toBeTruthy();
    expect(screen.getByText("Đã chấm: 7.5/10 điểm")).toBeTruthy();
  });

  it("essay_answer rỗng/không có (đề không có đáp án mẫu): KHÔNG hiện dòng 'Đáp án mẫu'", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="essay"
        essayAnswerNode={undefined}
        outcome={outcome({
          scored: false,
          essay: { state: "pending", earned: null, max: null, lowConfidence: false, retryAvailable: false },
        })}
      />
    );

    expect(screen.queryByText("Đáp án mẫu")).toBeNull();
    expect(screen.getByText("Chưa chấm")).toBeTruthy();
  });
});

describe("QuestionAnswerSummary — true_false/short_answer ĐÃ chấm (có ground truth, không rơi vào 'Chưa chấm tự động')", () => {
  it("true_false đã chấm: hiện từng ý + 'Đáp án đúng:' tổng hợp từ subAnswers", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>—</span>}
        questionType="true_false"
        subItemNodes={[
          { id: "a", textNode: <span>Ý a</span> },
          { id: "b", textNode: <span>Ý b</span> },
        ]}
        subAnswers={{ a: true, b: false }}
        outcome={outcome({ scored: true, selected: "a:Đ,b:S", isCorrect: true })}
      />
    );

    expect(screen.queryByText("Chưa chấm tự động")).toBeNull();
    expect(screen.getByText("Ý a")).toBeTruthy();
    expect(screen.getByText("Ý b")).toBeTruthy();
    expect(screen.getByText("a) Đ · b) S")).toBeTruthy();
  });

  it("short_answer đã chấm: hiện 'Đáp án đúng:' + chuỗi đáp án + nhãn kết quả", () => {
    render(
      <QuestionAnswerSummary
        stemNode={<span>Đề bài</span>}
        correctAnswerNode={<span>12/7</span>}
        questionType="short_answer"
        outcome={outcome({ scored: true, selected: "12/7", isCorrect: true })}
      />
    );

    expect(screen.queryByText("Chưa chấm tự động")).toBeNull();
    expect(screen.getByText("12/7")).toBeTruthy();
    expect(screen.getByText("Bạn làm đúng")).toBeTruthy();
  });
});
