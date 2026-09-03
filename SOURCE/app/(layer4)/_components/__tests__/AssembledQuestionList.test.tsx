// @vitest-environment jsdom

// AssembledQuestionList — cấu trúc nhóm câu ở màn sửa đề.
//
// Trước 2026-09-03 component này có HAI hình dạng DOM: đề nhiều phần ra
// `<section><h2>` theo phần, đề một phần ra một `<ul>` phẳng không heading. File
// này ghim việc bỏ nhánh thứ hai — không phải vì heading đẹp hơn, mà vì mọi thứ
// bám vào ranh giới nhóm câu (panel gán điểm là cái đầu tiên) chỉ đúng khi cấu
// trúc là MỘT.
//
// Ghim luôn ngữ nghĩa "xoá trắng tiêu đề = gỡ khai báo": nếu chỗ này lỡ gửi lên
// chuỗi rỗng thay vì gỡ, saveExam từ chối ("A part title cannot be empty") và
// tác giả mất nguyên lượt lưu vì một ô họ chỉ định xoá đi.
//
// @category: core-functionality
// @dependency: none — real component, no mocks

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render } from "@testing-library/react";
import type { AssembledQuestion, ExtractedPart } from "@/lib/ugc/types";
import { AssembledQuestionList, partNumbersOf } from "../AssembledQuestionList";

afterEach(cleanup);

function question(part: number, number: number): AssembledQuestion {
  return {
    part,
    number,
    type: "short_answer",
    stem: `Câu ${number}`,
    topic: "Ngữ văn",
  };
}

function setup(questions: AssembledQuestion[], parts: ExtractedPart[]) {
  const onChangePartTitle = vi.fn<(part: number, title: string) => void>();
  const { container } = render(
    <AssembledQuestionList
      questions={questions}
      parts={parts}
      errors={[]}
      onChangeQuestion={vi.fn()}
      onChangePartTitle={onChangePartTitle}
    />
  );
  return { container, onChangePartTitle };
}

describe("AssembledQuestionList — heading luôn có", () => {
  it("đề KHÔNG chia phần vẫn có đúng một heading, nhãn mặc định", () => {
    const { container } = setup([question(1, 1), question(1, 2)], []);
    const headings = [...container.querySelectorAll("h2")];
    expect(headings.map((h) => h.textContent)).toEqual(["Part 1"]);
    expect(container.querySelectorAll("section")).toHaveLength(1);
  });

  it("đề nhiều phần: mỗi phần một heading, in NGUYÊN VĂN tiêu đề đề gốc", () => {
    const { container } = setup(
      [question(1, 1), question(2, 1), question(2, 2)],
      [
        { number: 1, title: "I. PHẦN ĐỌC HIỂU" },
        { number: 2, title: "PHẦN II. VIẾT" },
      ]
    );
    expect([...container.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
      "I. PHẦN ĐỌC HIỂU",
      "PHẦN II. VIẾT",
    ]);
  });

  it("phần có câu nhưng đề không khai tiêu đề ⇒ nhãn mặc định, không bỏ trống", () => {
    const { container } = setup(
      [question(1, 1), question(3, 1)],
      [{ number: 1, title: "I. PHẦN ĐỌC HIỂU" }]
    );
    expect([...container.querySelectorAll("h2")].map((h) => h.textContent)).toEqual([
      "I. PHẦN ĐỌC HIỂU",
      "Part 3",
    ]);
  });

  it("đề rỗng ⇒ không dựng heading rỗng", () => {
    const { container } = setup([], []);
    expect(container.querySelectorAll("h2")).toHaveLength(0);
  });
});

describe("AssembledQuestionList — sửa tiêu đề phần", () => {
  it("gõ tiêu đề mới rồi Enter ⇒ đẩy chuỗi đã trim lên", () => {
    const { container, onChangePartTitle } = setup([question(1, 1)], []);
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Edit")!
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "  I. PHẦN ĐỌC HIỂU  " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChangePartTitle).toHaveBeenCalledWith(1, "I. PHẦN ĐỌC HIỂU");
  });

  it("xoá trắng ⇒ gửi chuỗi RỖNG (gỡ khai báo), không phải khoảng trắng", () => {
    const { container, onChangePartTitle } = setup(
      [question(1, 1)],
      [{ number: 1, title: "PHẦN I" }]
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Edit")!
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChangePartTitle).toHaveBeenCalledWith(1, "");
  });

  it("Escape ⇒ bỏ thay đổi, KHÔNG ghi gì", () => {
    const { container, onChangePartTitle } = setup(
      [question(1, 1)],
      [{ number: 1, title: "PHẦN I" }]
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Edit")!
    );
    const input = container.querySelector("input")!;
    fireEvent.change(input, { target: { value: "gõ nhầm" } });
    fireEvent.keyDown(input, { key: "Escape" });

    expect(onChangePartTitle).not.toHaveBeenCalled();
    expect(container.querySelector("h2")?.textContent).toBe("PHẦN I");
  });

  it("không đổi gì rồi rời ô ⇒ không sinh một lượt sửa giả", () => {
    const { container, onChangePartTitle } = setup(
      [question(1, 1)],
      [{ number: 1, title: "PHẦN I" }]
    );
    fireEvent.click(
      [...container.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Edit")!
    );
    fireEvent.blur(container.querySelector("input")!);

    expect(onChangePartTitle).not.toHaveBeenCalled();
  });
});

describe("partNumbersOf", () => {
  it("lấy nhóm từ CÂU HỎI, sắp tăng dần, không trùng", () => {
    expect(partNumbersOf([{ part: 2 }, { part: 1 }, { part: 2 }])).toEqual([1, 2]);
  });
});
