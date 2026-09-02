// @vitest-environment jsdom

// Điền chỗ trống trong bài đọc dùng chung (2026-09-02).
//
// Đề Tiếng Anh dạng điền khuyết in ĐỀ BÀI CỦA CÂU HỎI ngay trong bài đọc, nên
// trước thay đổi này màn làm bài không có chỗ nào cho học sinh thấy câu văn sau
// khi điền: bài đọc là một khối HTML đã render xong ở server, các dãy gạch dưới
// nằm chết trong đó.
//
// Test đi qua ĐÚNG cặp server/client thật — `renderQuestionNodes()` dựng node
// rồi `QuestionRenderer` nhận. Tự dựng node giả sẽ cho một bài test xanh trong
// khi hai nửa ngoài đời đã lệch nhau (cùng lý do đã ghi ở QuestionRenderer.test).

import { render, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Exam } from "@/types/exam";
import type { PublicQuestion } from "@/types/question";
import { QuestionRenderer } from "../QuestionRenderer";
import { renderQuestionNodes } from "../questionNodes";

const PASSAGE_TEXT =
  "Every July, thousands of students (34) ____ up for Green Summer, a campaign " +
  "for children (35) ____ families cannot afford extra tuition.\n\n" +
  "The work is demanding, (36) ____ very few of them drop out.";

const PASSAGES: Exam["passages"] = [
  { id: "p1", title: "Read the following passage.", text: PASSAGE_TEXT },
];

/** Ba câu điền khuyết cùng trỏ vào p1 — số hiển thị là VỊ TRÍ trong đề, nên
 *  mảng này phải bắt đầu từ câu 34 để khớp nhãn "(34)" in trong bài đọc. */
function gapQuestions(): PublicQuestion[] {
  const filler: PublicQuestion[] = Array.from({ length: 33 }, (_, i) => ({
    id: `filler-${i + 1}`,
    content: `Câu ${i + 1}`,
    choices: [
      { id: "A", text: "a" },
      { id: "B", text: "b" },
    ],
    subject: "Tiếng Anh",
    grade: 12,
    topic: "Tiếng Anh",
    questionType: "mcq",
  }));

  const gaps: PublicQuestion[] = [
    ["q34", "sign", "take", "put", "give"],
    ["q35", "which", "whose", "who", "that"],
    ["q36", "therefore", "moreover", "nevertheless", "otherwise"],
  ].map(([id, ...opts]) => ({
    id,
    content: "",
    choices: (["A", "B", "C", "D"] as const).map((cid, i) => ({ id: cid, text: opts[i] })),
    subject: "Tiếng Anh",
    grade: 12,
    topic: "Tiếng Anh",
    questionType: "mcq",
    passageId: "p1",
  }));

  return [...filler, ...gaps];
}

function renderGapQuestion(indexInGroup: number, answers: Record<string, string>) {
  const questions = gapQuestions();
  const nodes = renderQuestionNodes(questions, PASSAGES);
  const position = 33 + indexInGroup; // 0-based index của câu 34/35/36
  return render(
    <QuestionRenderer
      index={position + 1}
      question={questions[position]}
      nodes={nodes[position]}
      selectedAnswer={answers[questions[position].id]}
      answers={answers}
      onSelectAnswer={vi.fn()}
      flagged={false}
      onToggleFlag={vi.fn()}
    />
  );
}

function passageOf(container: HTMLElement) {
  const section = container.querySelector("section");
  if (!section) throw new Error("không tìm thấy khối bài đọc");
  return section;
}

describe("bài đọc dùng chung — điền chỗ trống theo đáp án đã chọn", () => {
  it("chưa chọn gì thì mọi chỗ trống vẫn là dãy gạch", () => {
    const { container } = renderGapQuestion(0, {});
    const passage = passageOf(container);
    expect(within(passage as HTMLElement).getAllByText("____")).toHaveLength(3);
    expect(passage.textContent).toContain("thousands of students");
  });

  it("chọn đáp án câu 34 → chữ của lựa chọn ấy hiện vào đúng chỗ trống (34)", () => {
    const { container } = renderGapQuestion(0, { q34: "A" });
    const passage = passageOf(container) as HTMLElement;
    expect(within(passage).getByText("sign")).toBeTruthy();
    // Hai chỗ trống còn lại chưa được trả lời.
    expect(within(passage).getAllByText("____")).toHaveLength(2);
  });

  it("ĐỨNG Ở CÂU 34 vẫn thấy đáp án đã chọn của câu 35 và 36", () => {
    // Đây là lý do component nhận CẢ bảng đáp án chứ không chỉ `selectedAnswer`:
    // cả ba chỗ trống hiện cùng lúc trên màn của mỗi câu trong nhóm.
    const { container } = renderGapQuestion(0, { q34: "A", q35: "B", q36: "C" });
    const passage = passageOf(container) as HTMLElement;
    expect(within(passage).getByText("sign")).toBeTruthy();
    expect(within(passage).getByText("whose")).toBeTruthy();
    expect(within(passage).getByText("nevertheless")).toBeTruthy();
    expect(within(passage).queryByText("____")).toBeNull();
  });

  it("số in trên đề được giữ lại cạnh chỗ trống", () => {
    const { container } = renderGapQuestion(0, {});
    const passage = passageOf(container) as HTMLElement;
    for (const label of ["(34)", "(35)", "(36)"]) {
      expect(within(passage).getByText(label)).toBeTruthy();
    }
  });

  it("giữ nguyên ranh giới đoạn văn của bài đọc", () => {
    // Cắt theo chỗ trống mà quên cắt theo đoạn trước sẽ dồn cả bài thành một
    // khối, hoặc ngược lại biến mỗi mẩu thành một đoạn riêng.
    const { container } = renderGapQuestion(0, {});
    // Trong `.rich-text` chứ không phải cả <section>: tiêu đề in trên đề
    // ("Read the following passage.") cũng là một <p>, và nó không phải đoạn
    // văn của bài đọc.
    const body = passageOf(container).querySelector(".rich-text");
    expect(body?.querySelectorAll("p")).toHaveLength(2);
  });

  it("câu KHÔNG có bài đọc thì không render khối nào — bố cục cũ giữ nguyên", () => {
    const questions = gapQuestions();
    const nodes = renderQuestionNodes(questions, PASSAGES);
    const { container } = render(
      <QuestionRenderer
        index={1}
        question={questions[0]}
        nodes={nodes[0]}
        selectedAnswer={undefined}
        answers={{}}
        onSelectAnswer={vi.fn()}
        flagged={false}
        onToggleFlag={vi.fn()}
      />
    );
    expect(container.querySelector("section")).toBeNull();
  });
});
