// @vitest-environment jsdom

// Short-Answer Scoring — sửa chữ chú thích cuối bài của QuestionRenderer [integration]
// Design Doc: docs/design/short-answer-scoring-frontend-design.md (v1.0)
// UI Spec: docs/ui-spec/short-answer-scoring-ui-spec.md (v1.0), AC-008/AC-009
//
// Chốt hồi quy cho đúng ranh giới mà AC-009 sinh ra để bảo vệ:
// QuestionRenderer là client component render hoàn toàn theo prop
// (không I/O), render ở đây qua RTL/jsdom, theo quy ước docblock
// `// @vitest-environment jsdom` của bộ test RichText.
//
// AC: AC-008 — chú thích short_answer render chữ mới "tự chấm sau khi
//   bạn nộp bài" đúng nguyên văn, không còn dấu vết chữ cũ
//   "chưa tự chấm".
// AC: AC-009 (chốt) — chú thích true_false và essay giữ giống từng byte
//   chuỗi trước khi đổi, và dây nối maxLength/placeholder/onChange->onSelectAnswer
//   của <input> short_answer không bị ảnh hưởng bởi
//   thay đổi chỉ-chữ.
// Hành vi: render QuestionRenderer (component thật, không mock) với một fixture
//   PublicQuestion short_answer/true_false/essay -> nhánh chú thích
//   của component phân giải theo questionType -> chữ chú thích đã render
//   và thuộc tính/callback onChange của <input> short_answer khớp
//   các giá trị kỳ vọng literal tự soạn độc lập (chữ mới cho
//   short_answer; chữ trước khi đổi giống từng byte cho true_false/essay).
// @category: core-functionality
// @lane: integration
// @dependency: không có — render component QuestionRenderer thật, không mock
// @complexity: low
// ROI: 57 (BV:7 x Freq:7 + Legal:0 + Defect:8) — canh một chuỗi chữ chú thích
//   hiển thị cho người dùng qua 3 nhánh loại câu hỏi trong một file component
//   dùng chung, đóng khoảng trống "không có test tự động nào" do chính
//   frontend DD nêu; không phải suất giá trị cao nhất trong bộ vì nó là
//   chữ UI theo prop, không phải ranh giới đúng-sai của chấm điểm hay toàn vẹn dữ liệu.

import { fireEvent, render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PublicQuestion } from "@/types/question";
import { QuestionRenderer } from "@/features/exams/components/QuestionRenderer";
// TD-023: nội dung câu hỏi nay render ở SERVER rồi truyền xuống. Test dùng
// ĐÚNG hàm render đó thay vì tự dựng node giả — nếu không, test sẽ xanh trong
// khi cặp server/client ngoài đời đã lệch nhau.
import { renderQuestionNodes } from "@/features/exams/components/questionNodes";

// Fixtures — PublicQuestion literal tối thiểu cho từng questionType, tự soạn
// độc lập với đầu ra render của chính QuestionRenderer.tsx.
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
      within(container).getByText("Trả lời ngắn — chấm tự động sau khi bạn nộp bài.")
    ).toBeTruthy();
    expect(within(container).queryByText(/đã lưu, chưa chấm tự động/i)).toBeNull();
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
      within(container).getByText("Tự luận — bài làm được lưu cùng lượt thi, chưa chấm tự động.")
    ).toBeTruthy();

    // Ô nhập phải TỒN TẠI (đây là thứ bug prod làm mất) và bị chặn đúng ở trần
    // THEO MÔN của câu — Toán dùng trần mặc định 4000 (nâng 500 → 4000 ở Task
    // H7/B3.3, R11/D11: một bài tự luận có rubric không viết nổi trong 500 ký
    // tự). Con số này DI CHUYỂN CÙNG `maxAttemptAnswerFor()` (lib/ugc/limits):
    // cả `maxLength` lẫn phép tính `charsLeft` đều đọc cùng một biến — nên
    // không có literal thứ hai nào để trôi lệch.
    const textarea = container.querySelector("textarea");
    expect(textarea).not.toBeNull();
    expect(textarea?.maxLength).toBe(4000);
    // Nhãn phải trỏ đúng ô nhập (a11y) — id do questionType + question.id sinh ra.
    expect(textarea?.id).toBe(`essay-${ESSAY_QUESTION.id}`);
    expect(container.querySelector(`label[for="essay-${ESSAY_QUESTION.id}"]`)).not.toBeNull();
  });

  it("essay Ngữ văn / Tiếng Anh: ô nhập nới lên 8000 ký tự, bộ đếm đi theo (engineer 2026-09-13)", () => {
    // Nhãn tiếng Việt như dữ liệu cũ trong DB (TD-016) vẫn phải tra ra môn —
    // trần đi qua normalizeSubject, không so chuỗi thô.
    for (const subject of ["Literature", "Ngữ văn", "English", "Tiếng Anh"]) {
      const { container } = renderQuestion({ ...ESSAY_QUESTION, subject });
      const textarea = container.querySelector("textarea");
      expect(textarea?.maxLength, subject).toBe(8000);
      expect(within(container).getByText("Còn 8000 ký tự"), subject).toBeTruthy();
    }
    // Môn khác giữ trần mặc định.
    const math = renderQuestion({ ...ESSAY_QUESTION, subject: "Math" });
    expect(math.container.querySelector("textarea")?.maxLength).toBe(4000);
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

    expect(within(container).getByText("Đúng/Sai — đã lưu, chưa chấm tự động.")).toBeTruthy();
  });

  it("short_answer: <input> maxLength/placeholder/onChange wiring is unaffected by the copy-only change", () => {
    const onSelectAnswer = vi.fn();
    const { container } = renderQuestion(SHORT_ANSWER_QUESTION, onSelectAnswer);

    const input = container.querySelector("input");
    expect(input).not.toBeNull();
    expect(input?.getAttribute("maxlength")).toBe("100");
    expect(input?.getAttribute("placeholder")).toBe("ví dụ: 1260 / 1,04");

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
      "Tự luận — bài làm được lưu cùng lượt thi, chưa chấm tự động."
    );
    expect(container.textContent).not.toContain("auto-scored after you submit");
  });

  it("cờ BẬT ⇒ câu MỚI, và câu cũ biến mất", () => {
    const { container } = renderQuestion(ESSAY_QUESTION, undefined, { essayGradingEnabled: true });

    expect(container.textContent).toContain("Tự luận — chấm tự động sau khi bạn nộp bài.");
    expect(container.textContent).not.toContain("đã lưu, chưa chấm tự động");
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
