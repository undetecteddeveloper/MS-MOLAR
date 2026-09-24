// @vitest-environment jsdom

// NoteSheet — điền sẵn ghi chú tự luận (AC-034-036, Required Test #9). Test
// đơn vị hoá trực tiếp trên `NoteSheet` (không qua toàn bộ `SolutionEditorScreen`)
// vì logic điền sẵn nằm hoàn toàn ở `initialDraft()`/lazy initializer bên
// trong file này — các Required Test #1-5, #7 khác đã có ở
// `SolutionEditorScreen.test.tsx` (kiểm qua đúng đường người dùng thật mở
// tấm trượt).

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NoteSheet } from "@/features/solutions/components/NoteSheet";
import type { PerQuestionResult } from "@/types/result";

afterEach(cleanup);

function baseProps() {
  return {
    open: true,
    questionNumber: 1,
    totalCount: 2,
    rowState: "missing" as const,
    readOnly: false,
    note: "",
    essayPrefillApplied: false,
    saving: false,
    error: null,
    stemNode: <span>Đề bài</span>,
    correctAnswerNode: <span>—</span>,
    noteNode: <span />,
    outcome: null as PerQuestionResult | null,
    onSave: vi.fn().mockResolvedValue({ ok: true, solutionId: "s1", status: "draft" as const }),
    onSaveAndNext: vi.fn(),
    onClose: vi.fn(),
  };
}

describe("NoteSheet — điền sẵn bài làm tự luận (Required Test #9, AC-034)", () => {
  it("câu tự luận, ghi chú còn trống, chưa từng điền sẵn: ô nhập điền sẵn đúng bài làm", () => {
    const props = baseProps();
    props.outcome = {
      questionId: "q1",
      isCorrect: false,
      scored: false,
      selected: "Bài làm tự luận của tôi",
      essay: { state: "pending", earned: null, max: null, lowConfidence: false, retryAvailable: false },
    };

    render(<NoteSheet {...props} />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Bài làm tự luận của tôi");
  });

  it("AC-036: ghi chú đã có sẵn chữ — KHÔNG bị ghi đè bằng bài làm của lần làm khác", () => {
    const props = baseProps();
    props.note = "ghi chú đã lưu";
    props.outcome = {
      questionId: "q1",
      isCorrect: false,
      scored: false,
      selected: "bài làm của lần làm khác",
      essay: { state: "pending", earned: null, max: null, lowConfidence: false, retryAvailable: false },
    };

    render(<NoteSheet {...props} />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("ghi chú đã lưu");
  });

  it("essayPrefillApplied đã true (server từng điền sẵn) — không điền sẵn lại dù ghi chú đang trống", () => {
    const props = baseProps();
    props.essayPrefillApplied = true;
    props.outcome = {
      questionId: "q1",
      isCorrect: false,
      scored: false,
      selected: "bài làm tự luận",
      essay: { state: "pending", earned: null, max: null, lowConfidence: false, retryAvailable: false },
    };

    render(<NoteSheet {...props} />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });

  it("câu không phải tự luận (outcome không có essay): không điền sẵn gì", () => {
    const props = baseProps();
    props.outcome = { questionId: "q1", isCorrect: true, correct: "A", selected: "A" };

    render(<NoteSheet {...props} />);

    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("");
  });
});

describe("NoteSheet — 'Lưu và sang câu k+1' (AC-022)", () => {
  it("câu KHÔNG phải cuối: hiện cả hai nút 'Lưu' và 'Lưu và sang câu 2'", () => {
    const props = baseProps();
    render(<NoteSheet {...props} />);

    expect(screen.getByRole("button", { name: "Lưu" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Lưu và sang câu 2" })).toBeTruthy();
  });

  it("câu CUỐI (k = N): chỉ có nút 'Lưu'", () => {
    const props = baseProps();
    props.questionNumber = 2;
    props.totalCount = 2;
    render(<NoteSheet {...props} />);

    expect(screen.getByRole("button", { name: "Lưu" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Lưu và sang câu/ })).toBeNull();
  });
});
