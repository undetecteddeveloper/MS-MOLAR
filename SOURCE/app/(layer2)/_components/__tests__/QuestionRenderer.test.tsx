// @vitest-environment jsdom

// Short-Answer Scoring — QuestionRenderer footnote copy fix [integration]
// Design Doc: docs/design/short-answer-scoring-frontend-design.md (v1.0)
// UI Spec: docs/ui-spec/short-answer-scoring-ui-spec.md (v1.0), AC-008/AC-009
//
// Regression guard for the exact boundary AC-009 exists to protect:
// QuestionRenderer is a client component with fully prop-driven rendering
// (no I/O), rendered here via RTL/jsdom, matching RichText's test suite
// `// @vitest-environment jsdom` docblock convention.
//
// AC: AC-008 — the short_answer footnote renders the new "auto-scored after
//   you submit" copy exactly, with no trace of the pre-change "not
//   auto-scored yet" wording.
// AC: AC-009 (guard) — the true_false and essay footnotes stay byte-identical
//   to their pre-change strings, and the short_answer <input>'s maxLength/
//   placeholder/onChange->onSelectAnswer wiring stays unaffected by the
//   copy-only change.
// Behavior: rendering QuestionRenderer (real component, no mocks) with a
//   short_answer/true_false/essay PublicQuestion fixture -> the component's
//   footnote branch resolves per questionType -> the rendered footnote text
//   and the short_answer <input>'s attributes/onChange callback match the
//   independently-authored literal expected values (new copy for
//   short_answer; byte-identical pre-change copy for true_false/essay).
// @category: core-functionality
// @lane: integration
// @dependency: none — renders the real QuestionRenderer component, no mocks
// @complexity: low
// ROI: 57 (BV:7 x Freq:7 + Legal:0 + Defect:8) — guards a user-facing
//   footnote copy string across 3 question-type branches in one shared
//   component file, closing the frontend DD's own named "no automated test
//   exists" gap; not the highest-value slot in the suite since it is
//   prop-driven UI text, not a scoring-correctness or data-integrity
//   boundary.

import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicQuestion } from "@/types/question";
import { QuestionRenderer } from "../QuestionRenderer";

// Fixtures — minimal literal PublicQuestion per questionType, authored
// independently of QuestionRenderer.tsx's own rendered output.
const SHORT_ANSWER_QUESTION: PublicQuestion = {
  id: "q-short-answer",
  content: "Tính giá trị của biểu thức.",
  choices: [],
  subject: "Toán",
  grade: 10,
  topic: "Đại số",
  questionType: "short_answer",
};

const TRUE_FALSE_QUESTION: PublicQuestion = {
  id: "q-true-false",
  content: "Xét các mệnh đề sau, mệnh đề nào đúng?",
  choices: [],
  subject: "Toán",
  grade: 11,
  topic: "Hàm số",
  questionType: "true_false",
  subItems: [],
};

const ESSAY_QUESTION: PublicQuestion = {
  id: "q-essay",
  content: "Trình bày lời giải chi tiết.",
  choices: [],
  subject: "Toán",
  grade: 12,
  topic: "Tích phân",
  questionType: "essay",
};

function renderQuestion(question: PublicQuestion, onSelectAnswer = vi.fn()) {
  return render(
    <QuestionRenderer
      index={1}
      question={question}
      selectedAnswer={undefined}
      onSelectAnswer={onSelectAnswer}
      flagged={false}
      onToggleFlag={vi.fn()}
    />
  );
}

describe("QuestionRenderer — footnote copy (AC-008/AC-009)", () => {
  it("short_answer: renders the new auto-scored copy, no trace of 'not auto-scored yet' (AC-008)", () => {
    const { container } = renderQuestion(SHORT_ANSWER_QUESTION);

    expect(
      within(container).getByText("Short answer — auto-scored after you submit.")
    ).toBeTruthy();
    expect(within(container).queryByText(/not auto-scored yet/i)).toBeNull();
  });

  // Chuỗi cũ ("Essay question — answer on paper.") CỐ Ý bị thay, không phải
  // copy trôi: bug prod 2026-08-17 — nhánh essay trước đây CHỈ render dòng chữ
  // đó, không có ô nhập nào, nên với đề toàn tự luận (Toán 8) màn làm bài
  // không có chỗ trả lời. Nay có <textarea>, nên câu "làm ra giấy" đã thành
  // mô tả SAI về màn hình. Guard vẫn còn nguyên tinh thần AC-009: khoá chuỗi
  // hiện hành + khoá luôn ô nhập vừa thêm để lần sau mất field thì test đỏ.
  it("essay: renders an answer textarea and the current footnote copy (AC-009 guard, updated)", () => {
    const { container } = renderQuestion(ESSAY_QUESTION);

    expect(
      within(container).getByText("Essay — your working is saved with the attempt, not auto-scored yet.")
    ).toBeTruthy();

    // Ô nhập phải TỒN TẠI (đây là thứ bug prod làm mất) và bị chặn đúng ở trần
    // của DB — attempt_answers.answer CHECK length <= 500.
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.maxLength).toBe(500);
    // Nhãn phải trỏ đúng ô nhập (a11y) — id do questionType + question.id sinh ra.
    expect(textarea?.id).toBe(`essay-${ESSAY_QUESTION.id}`);
    expect(container.querySelector(`label[for="essay-${ESSAY_QUESTION.id}"]`)).not.toBeNull();
  });

  it("essay: typing forwards the text to onSelectAnswer (bug prod 2026-08-17)", () => {
    const onSelectAnswer = vi.fn();
    const { container } = renderQuestion(ESSAY_QUESTION, onSelectAnswer);

    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    fireEvent.change(textarea as HTMLTextAreaElement, { target: { value: "2x(x-3)" } });

    expect(onSelectAnswer).toHaveBeenCalledWith("2x(x-3)");
  });

  it("true_false: footnote stays byte-identical to the pre-change string (AC-009 guard)", () => {
    const { container } = renderQuestion(TRUE_FALSE_QUESTION);

    expect(within(container).getByText("True/False — stored, not auto-scored yet.")).toBeTruthy();
  });

  it("short_answer: <input> maxLength/placeholder/onChange wiring is unaffected by the copy-only change", () => {
    const onSelectAnswer = vi.fn();
    const { container } = renderQuestion(SHORT_ANSWER_QUESTION, onSelectAnswer);

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("maxlength")).toBe("100");
    expect(input?.getAttribute("placeholder")).toBe("e.g. 1260 / 1,04");

    fireEvent.change(input as HTMLInputElement, { target: { value: "1260" } });
    expect(onSelectAnswer).toHaveBeenCalledWith("1260");
  });
});
