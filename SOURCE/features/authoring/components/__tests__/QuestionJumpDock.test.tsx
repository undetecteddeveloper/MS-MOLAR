// @vitest-environment jsdom

// QuestionJumpDock — bảng nhảy tới câu của màn sửa đề, nay dùng CHUNG cấu trúc với
// mọi bảng câu hỏi khác (QuestionPagination, 2026-10-02): chia mục theo PHẦN, ô
// mang số câu TRONG PHẦN, câu lỗi đỏ + ký hiệu, dòng phụ đỏ "N câu cần sửa".

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AssembledQuestion } from "@/lib/ugc/types";
import { QuestionJumpDock } from "@/features/authoring/components/QuestionJumpDock";

afterEach(cleanup);

function question(part: number, number: number): AssembledQuestion {
  return {
    part,
    number,
    type: "mcq",
    stem: `Câu ${number}`,
    choices: [],
  } as unknown as AssembledQuestion;
}

const QUESTIONS = [question(1, 1), question(1, 2), question(2, 1)];
const PARTS = [
  { number: 1, title: "PHẦN I. Trắc nghiệm" },
  { number: 2, title: "PHẦN II. Đúng sai" },
];

describe("QuestionJumpDock", () => {
  const scrollIntoView = vi.fn();
  const focus = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockReset();
    focus.mockReset();
    for (const id of ["p1q1", "p1q2", "p2q1"]) {
      const el = document.createElement("div");
      el.id = id;
      el.scrollIntoView = scrollIntoView;
      el.focus = focus;
      document.body.appendChild(el);
    }
  });
  afterEach(() => {
    for (const id of ["p1q1", "p1q2", "p2q1"]) document.getElementById(id)?.remove();
  });

  function open() {
    fireEvent.click(screen.getByRole("button", { name: "Bảng câu hỏi" }));
    return screen.getByRole("region", { name: "Bảng câu hỏi" });
  }

  it("chia mục theo phần, ô đánh số theo câu TRONG PHẦN (phần 2 bắt đầu lại từ 1)", () => {
    render(
      <QuestionJumpDock title="Đề thử" questions={QUESTIONS} parts={PARTS} errorKeys={new Set()} />
    );

    const panel = open();

    expect(within(panel).getByText("PHẦN I. Trắc nghiệm")).toBeTruthy();
    expect(within(panel).getByText("PHẦN II. Đúng sai")).toBeTruthy();
    expect(
      within(panel)
        .getAllByRole("button")
        .map((b) => b.textContent)
    ).toEqual(["1", "2", "1"]);
  });

  it("câu lỗi đỏ + 'Cần sửa' trong tên, dòng phụ đỏ đếm số câu lỗi", () => {
    render(
      <QuestionJumpDock
        title="Đề thử"
        questions={QUESTIONS}
        parts={PARTS}
        errorKeys={new Set(["2:1"])}
      />
    );

    const panel = open();

    const bad = within(panel).getAllByRole("button")[2];
    expect(bad.className).toContain("bg-destructive");
    expect(bad.getAttribute("aria-label")).toMatch(/Cần sửa/);
    expect(within(panel).getByText(/1 câu cần sửa/).className).toContain("text-destructive");
  });

  it("chọn ô nhảy tới đúng thẻ #p{phần}q{số}, cuộn + focus, và đóng bảng", () => {
    render(
      <QuestionJumpDock title="Đề thử" questions={QUESTIONS} parts={PARTS} errorKeys={new Set()} />
    );

    const panel = open();
    fireEvent.click(within(panel).getAllByRole("button")[2]);

    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start", behavior: "smooth" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("đề một phần → lưới phẳng, không nhãn mục", () => {
    render(
      <QuestionJumpDock
        title="Đề thử"
        questions={[question(1, 1), question(1, 2)]}
        parts={[]}
        errorKeys={new Set()}
      />
    );

    const panel = open();

    expect(within(panel).queryByText(/Phần|PHẦN/)).toBeNull();
    expect(within(panel).getAllByRole("list")).toHaveLength(1);
  });
});
