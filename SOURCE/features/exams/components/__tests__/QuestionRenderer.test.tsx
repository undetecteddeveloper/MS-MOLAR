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
import { QuestionRenderer } from "@/features/exams/components/QuestionRenderer";
// TD-023: nội dung câu hỏi nay render ở SERVER rồi truyền xuống. Test dùng
// ĐÚNG hàm render đó thay vì tự dựng node giả — nếu không, test sẽ xanh trong
// khi cặp server/client ngoài đời đã lệch nhau.
import { renderQuestionNodes } from "@/features/exams/components/questionNodes";

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

function renderQuestion(
  question: PublicQuestion,
  onSelectAnswer = vi.fn(),
  // Tham so THU BA, tuy chon, va co y de o cuoi: moi cho goi san co giu nguyen
  // chu ky cu va vi the van nhan `essayGradingEnabled === undefined` — tuc mac
  // dinh `false` cua component. Do la nua co hoc giu cho chuoi da ghim o ca
  // AC-009 phia tren o nguyen xanh (Open Item I-6 / backend D-14).
  options: { essayGradingEnabled?: boolean } = {}
) {
  return render(
    <QuestionRenderer
      index={1}
      question={question}
      nodes={renderQuestionNodes([question])[0]}
      selectedAnswer={undefined}
      answers={{}}
      onSelectAnswer={onSelectAnswer}
      flagged={false}
      onToggleFlag={vi.fn()}
      essayGradingEnabled={options.essayGradingEnabled}
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
    // của DB — attempt_answers.answer CHECK length <= 4000 (nâng 500 → 4000 ở
    // Task H7/B3.3, R11/D11: một bài tự luận có rubric không viết nổi trong 500
    // ký tự). Con số này DI CHUYỂN CÙNG `LIMITS.MAX_ATTEMPT_ANSWER`:
    // `QuestionRenderer.tsx:23` alias hằng đó, và cả `maxLength` lẫn phép tính
    // `charsLeft` đều đọc alias — nên không có literal thứ hai nào để trôi lệch.
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.maxLength).toBe(4000);
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


// ═══════════════════════════════════════════════════════════════════════════
// CHÂN TRANG Ô TỰ LUẬN DO CỜ CHỌN (AC-051 / AC-067 / UI-D8) — Task F-D1
//
// HAI khoá, không phải một khoá bị thay. Câu cũ được GIỮ NGUYÊN VĂN vì AC-067
// tạo ra một khoảng thời gian CÓ THẬT trong đó nó vẫn ĐÚNG: tính năng ship ở
// trạng thái TẮT, bài làm được lưu, và không được chấm tự động. Xoá nó trong
// cùng commit là buộc phải ship một câu SAI suốt khoảng ấy.
//
// ═══ OPEN ITEM I-6, GIẢI Ở ĐÂY THAY VÌ ĐỂ MỞ ═══
//
// Frontend DD nói `:112` và `:119` "phải đổi cùng nhau"; backend D-14 nói
// `:112` ở nguyên XANH cho tới khi có một test chạm nhánh BẬT. D-14 đúng, và
// lý do là HÌNH DẠNG PROP đã ship: `essayGradingEnabled` là TUỲ CHỌN, mặc định
// `false`. Mọi ca sẵn có dựng component mà không truyền nó ⇒ nhận `false` ⇒ in
// `player.essayNotScored` ⇒ chuỗi ghim ở đó không nhúc nhích.
//
// NHƯNG: ca ĐẦU TIÊN chạm nhánh BẬT nằm ngay dưới đây, nên kể từ commit này
// hai chỗ ấy ĐÃ ghép cặp — đúng như D-14 báo trước. Điều kiện làm nó vỡ cũng
// ghi luôn: nếu prop thành BẮT BUỘC, hoặc mặc định đổi thành `true`, thì `:112`
// đỏ NGAY và ghép cặp sớm hơn kế hoạch.
// ═══════════════════════════════════════════════════════════════════════════

describe("QuestionRenderer — chân trang tự luận do cờ AC-067 chọn", () => {
  it("cờ TẮT (mặc định, không truyền prop) ⇒ câu CŨ, nguyên văn", () => {
    const { container } = renderQuestion(ESSAY_QUESTION);

    // Đây chính là hành vi giữ cho chuỗi đã ghim ở ca AC-009 phía trên xanh.
    expect(container.textContent).toContain(
      "Essay — your working is saved with the attempt, not auto-scored yet."
    );
    expect(container.textContent).not.toContain("auto-scored after you submit");
  });

  it("cờ BẬT ⇒ câu MỚI, và câu cũ biến mất", () => {
    const { container } = renderQuestion(ESSAY_QUESTION, undefined, { essayGradingEnabled: true });

    expect(container.textContent).toContain("Essay — auto-scored after you submit.");
    expect(container.textContent).not.toContain("not auto-scored yet");
  });

  it("cờ KHÔNG đụng tới ô nhập, chỗ giữ chỗ hay bộ đếm ký tự (AC-052)", () => {
    // Hai lan render doc lap, doc tu container RIENG cua tung lan — file nay
    // khong bat `cleanup` tu dong, nen so sanh qua container thay vi qua
    // `screen` la cach tranh hai cay chong len nhau.
    const off = renderQuestion(ESSAY_QUESTION);
    const offTextarea = off.container.querySelector("textarea");
    const offPlaceholder = offTextarea?.getAttribute("placeholder");
    const offMaxLength = offTextarea?.maxLength;

    const on = renderQuestion(ESSAY_QUESTION, undefined, { essayGradingEnabled: true });
    const onTextarea = on.container.querySelector("textarea");

    // Cờ chọn MỘT câu chữ. Nó không được phép chạm vào bất cứ thứ gì khác của
    // ô nhập — ô nhập là thứ học sinh đang gõ bài vào.
    expect(onTextarea).not.toBeNull();
    expect(onTextarea?.getAttribute("placeholder")).toBe(offPlaceholder);
    expect(onTextarea?.maxLength).toBe(offMaxLength);
    expect(onTextarea?.maxLength).toBe(4000);
  });
});
