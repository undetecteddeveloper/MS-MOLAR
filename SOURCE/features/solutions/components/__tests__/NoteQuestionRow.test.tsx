// @vitest-environment jsdom

// NoteQuestionRow — bốn trạng thái của UI-D7: Đã ghi chú / Chưa ghi chú /
// Chưa đủ 15 từ / Câu hỏi đã thay đổi. Mỗi trạng thái phải lộ diện qua CẢ ký
// hiệu lẫn chữ, không chỉ màu (AC-050).

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteQuestionRow, noteRowCellLabel } from "@/features/solutions/components/NoteQuestionRow";

afterEach(cleanup);

describe("NoteQuestionRow", () => {
  it.each([
    ["noted", "Đã ghi chú", "lucide-check"],
    ["missing", "Chưa ghi chú", "lucide-minus"],
    ["short", "Chưa đủ 15 từ", "lucide-minus"],
    ["changed", "Câu hỏi đã thay đổi", "lucide-refresh-cw"],
  ] as const)("trạng thái %s hiện chữ %j kèm đúng một ký hiệu %s", (state, text, iconClass) => {
    const { container } = render(
      <ul>
        <NoteQuestionRow questionNumber={3} state={state} onOpen={() => {}} />
      </ul>
    );
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.getByText("Câu 3")).toBeTruthy();
    // Hàng có hai svg: ký hiệu trạng thái + ChevronRight cuối hàng. Ký hiệu
    // trạng thái là svg đầu tiên, nằm trong ô tròn size-6 đầu hàng.
    const icons = container.querySelectorAll("svg");
    expect(icons).toHaveLength(2);
    expect(icons[0].classList.contains(iconClass)).toBe(true);
    expect(icons[0].getAttribute("aria-hidden")).toBe("true");
    expect(icons[1].classList.contains("lucide-chevron-right")).toBe(true);
  });

  it("hàng cao tối thiểu 56px, là <button> thật trong <li>", () => {
    const { container } = render(
      <ul>
        <NoteQuestionRow questionNumber={1} state="noted" onOpen={() => {}} />
      </ul>
    );
    const button = screen.getByRole("button");
    expect(button.tagName).toBe("BUTTON");
    expect(button.className.split(/\s+/)).toContain("min-h-14");
    expect(container.querySelector("li > button")).toBe(button);
  });

  it("bấm hàng gọi onOpen", () => {
    const onOpen = vi.fn();
    render(
      <ul>
        <NoteQuestionRow questionNumber={1} state="noted" onOpen={onOpen} />
      </ul>
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("trích dòng đầu ghi chú chỉ hiện khi có excerpt", () => {
    render(
      <ul>
        <NoteQuestionRow questionNumber={1} state="noted" excerpt="Vì tam giác cân nên..." onOpen={() => {}} />
      </ul>
    );
    expect(screen.getByText("Vì tam giác cân nên...")).toBeTruthy();
  });

  it("trạng thái missing không có dòng trích khi không truyền excerpt", () => {
    const { container } = render(
      <ul>
        <NoteQuestionRow questionNumber={2} state="missing" onOpen={() => {}} />
      </ul>
    );
    // Chỉ 2 span chữ: "Câu 2" và "Chưa ghi chú" — không có dòng trích thứ ba.
    const textSpans = container.querySelectorAll("button > span:last-of-type > span");
    expect(textSpans).toHaveLength(1);
  });

  it("tên trợ năng của hàng đúng khuôn UI-D26 'Câu k, <trạng thái viết thường>'", () => {
    render(
      <ul>
        <NoteQuestionRow questionNumber={4} state="changed" onOpen={() => {}} />
      </ul>
    );
    expect(screen.getByRole("button", { name: "Câu 4, câu hỏi đã thay đổi" })).toBeTruthy();
  });
});

describe("noteRowCellLabel", () => {
  it.each([
    ["noted", 1, "Câu 1, đã ghi chú"],
    ["missing", 2, "Câu 2, chưa ghi chú"],
    ["short", 3, "Câu 3, chưa đủ 15 từ"],
    ["changed", 4, "Câu 4, câu hỏi đã thay đổi"],
  ] as const)("state=%s, k=%d → %j", (state, number, expected) => {
    expect(noteRowCellLabel(state, number)).toBe(expected);
  });
});
