// @vitest-environment jsdom

// CommentComposer — UI Spec § Component: CommentComposer; frontend DD § Main
// Components. Component ĐIỀU KHIỂN thuần (state sống ở CommentSheet) — bài
// kiểm ở đây chỉ xác nhận phần TRÌNH BÀY: mặc định "Ẩn danh" tắt (S18),
// checkbox khoá bật + dòng phụ khi lockedAnonymous (S4/UI-D12), dòng lỗi hiện
// đúng chữ, nút Gửi/Đang gửi. Luồng gửi thật (postComment) là CommentSheet.test.tsx.

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentComposer } from "@/features/solutions/components/CommentComposer";

afterEach(cleanup);

function baseProps() {
  return {
    value: "",
    onChange: vi.fn(),
    isAnonymous: false,
    onAnonymousChange: vi.fn(),
    lockedAnonymous: false,
    sending: false,
    error: null as string | null,
    onSend: vi.fn(),
  };
}

describe("CommentComposer — mặc định (Required Test #5, S18)", () => {
  it("ô Ẩn danh KHÔNG được đánh dấu ở lượt render đầu", () => {
    render(<CommentComposer {...baseProps()} />);

    const checkbox = screen.getByRole("checkbox", { name: "Ẩn danh" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    expect(checkbox.getAttribute("aria-disabled")).toBeNull();
  });

  it("gõ chữ gọi onChange, bấm Gửi (không sending) gọi onSend", () => {
    const props = baseProps();
    render(<CommentComposer {...props} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abc" } });
    expect(props.onChange).toHaveBeenCalledWith("abc");

    fireEvent.click(screen.getByRole("button", { name: "Gửi" }));
    expect(props.onSend).toHaveBeenCalledTimes(1);
  });
});

describe("CommentComposer — lockedAnonymous (Required Test #4, S4/UI-D12)", () => {
  it("checkbox luôn checked + aria-disabled='true' (không disabled gốc) + dòng phụ", () => {
    render(<CommentComposer {...baseProps()} lockedAnonymous />);

    const checkbox = screen.getByRole("checkbox", { name: "Ẩn danh" }) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.getAttribute("aria-disabled")).toBe("true");
    expect(checkbox.hasAttribute("disabled")).toBe(false);
    expect(
      screen.getByText("Bài giải của bạn đang ẩn danh nên bình luận của bạn cũng hiện là Ẩn danh.")
    ).toBeTruthy();
  });

  it("bấm vào checkbox đã khoá KHÔNG gọi onAnonymousChange", () => {
    const props = baseProps();
    render(<CommentComposer {...props} lockedAnonymous />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Ẩn danh" }));
    expect(props.onAnonymousChange).not.toHaveBeenCalled();
  });
});

describe("CommentComposer — trạng thái đang gửi / lỗi", () => {
  it("sending: nút hiện 'Đang gửi…' với aria-busy", () => {
    render(<CommentComposer {...baseProps()} sending />);

    const button = screen.getByRole("button", { name: "Đang gửi…" });
    expect(button.getAttribute("aria-busy")).toBe("true");
  });

  it("error: hiện đúng dòng role=alert", () => {
    render(<CommentComposer {...baseProps()} error="Chưa gửi được bình luận. Bạn thử lại nhé." />);

    expect(screen.getByRole("alert").textContent).toBe("Chưa gửi được bình luận. Bạn thử lại nhé.");
  });
});
