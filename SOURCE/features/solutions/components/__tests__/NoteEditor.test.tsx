// @vitest-environment jsdom

// NoteEditor — bộ đếm từ dùng ĐÚNG countWords() (AC-023, Required Test #6) và
// trần 8000 ký tự không cắt chữ (AC-026, Required Test #8).

import { useState } from "react";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { NoteEditor } from "@/features/solutions/components/NoteEditor";
import { countWords } from "@/lib/solutions/countWords";

afterEach(cleanup);

function Harness({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return <NoteEditor id="note" value={value} onChange={setValue} />;
}

describe("NoteEditor — bộ đếm từ (Required Test #6, AC-023)", () => {
  it("bộ đếm bằng đúng countWords() cho cùng chuỗi", () => {
    const text = "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn";
    render(<Harness initial={text} />);
    expect(countWords(text)).toBe(14);
    expect(screen.getByText("14/15 từ")).toBeTruthy();
  });

  it("công thức viết liền không khoảng trắng đếm là một từ, đủ 15/15 đổi màu + dấu Check", () => {
    const text =
      "một hai ba bốn năm sáu bảy tám chín mười mười-một mười-hai mười-ba mười-bốn $\\Delta=b^2-4ac$";
    render(<Harness initial={text} />);
    expect(countWords(text)).toBe(15);
    const counter = screen.getByText("15/15 từ");
    expect(counter.className).toContain("text-primary");
    expect(counter.querySelector("svg")).toBeTruthy();
  });
});

describe("NoteEditor — trần 8000 ký tự (Required Test #8, AC-026)", () => {
  it("gõ vượt 8000 ký tự: KHÔNG cắt chữ, bộ đếm đổi thành 'Còn N ký tự'", () => {
    render(<Harness />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const long = "a".repeat(8005);
    fireEvent.change(textarea, { target: { value: long } });

    expect(textarea.value).toBe(long);
    expect(textarea.value.length).toBe(8005);
    expect(screen.getByText("Còn -5 ký tự")).toBeTruthy();
  });

  it("còn <= 10% giới hạn (800 ký tự): đổi bộ đếm thành 'Còn {remaining} ký tự' trước khi chạm trần", () => {
    render(<Harness />);
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    const nearLimit = "a".repeat(7300);
    fireEvent.change(textarea, { target: { value: nearLimit } });

    expect(screen.getByText("Còn 700 ký tự")).toBeTruthy();
  });
});
