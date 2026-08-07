// @vitest-environment jsdom

// SuccessToast — hồi quy cho lượt trả TD-010 (2026-08-04).
//
// Component vừa đổi từ "setVisible(true) trong thân effect" (bị
// `react-hooks/set-state-in-effect` chặn) sang trạng thái DẪN XUẤT: state lưu
// "trigger nào đã hết hạn", còn hiện/ẩn tính lúc render. Ba tính chất phải giữ:
//
//   1. Bơm `trigger` → toast hiện NGAY ở lượt render kế tiếp (không mất một
//      frame ẩn — đó chính là cascading render mà rule cấm).
//   2. Tự tắt sau `durationMs`; bơm lại lúc đang hiện thì hẹn giờ chạy lại từ
//      đầu, không tắt sớm theo lượt cũ.
//   3. Vùng sr-only phải THAY ĐỔI nội dung "" → message → "" mỗi lượt, vì
//      aria-live chỉ được screen reader đọc khi nội dung đột biến. Bong bóng
//      nhìn thấy được thì luôn mounted và aria-hidden, không đọc lần hai.

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SuccessToast } from "./SuccessToast";

const MESSAGE = "Đã gửi đánh giá";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

/** Vùng aria-live — thứ screen reader thực sự đọc. */
function announcement() {
  return screen.getByRole("status").textContent;
}

/** Bong bóng nhìn thấy được đang ở trạng thái hiện hay ẩn. */
function bubbleVisible(container: HTMLElement) {
  const bubble = container.querySelector("[aria-hidden]");
  if (!bubble) throw new Error("không thấy bong bóng toast");
  return bubble.className.includes("opacity-100");
}

describe("SuccessToast", () => {
  it("trigger = 0 (chưa gửi lần nào) → ẩn, và KHÔNG thông báo gì", () => {
    const { container } = render(<SuccessToast message={MESSAGE} trigger={0} />);
    expect(announcement()).toBe("");
    expect(bubbleVisible(container)).toBe(false);
  });

  it("bơm trigger → hiện ngay và thông báo, không cần chờ timer nào", () => {
    const { container, rerender } = render(<SuccessToast message={MESSAGE} trigger={0} />);
    rerender(<SuccessToast message={MESSAGE} trigger={1} />);

    expect(bubbleVisible(container)).toBe(true);
    expect(announcement()).toBe(MESSAGE);
  });

  it("tự tắt sau durationMs và trả vùng aria-live về rỗng", () => {
    const { container, rerender } = render(<SuccessToast message={MESSAGE} trigger={0} />);
    rerender(<SuccessToast message={MESSAGE} trigger={1} />);

    advance(2999);
    expect(bubbleVisible(container)).toBe(true);

    advance(1);
    expect(bubbleVisible(container)).toBe(false);
    expect(announcement()).toBe("");
  });

  it("tôn trọng durationMs tuỳ chỉnh", () => {
    const { container, rerender } = render(
      <SuccessToast message={MESSAGE} trigger={0} durationMs={800} />
    );
    rerender(<SuccessToast message={MESSAGE} trigger={1} durationMs={800} />);

    advance(799);
    expect(bubbleVisible(container)).toBe(true);
    advance(1);
    expect(bubbleVisible(container)).toBe(false);
  });

  it("bơm lại lúc đang hiện → hẹn giờ chạy lại từ đầu, không tắt theo lượt cũ", () => {
    const { container, rerender } = render(<SuccessToast message={MESSAGE} trigger={0} />);
    rerender(<SuccessToast message={MESSAGE} trigger={1} />);

    advance(2000);
    rerender(<SuccessToast message={MESSAGE} trigger={2} />);

    // Mốc 3000ms của lượt 1 đã trôi qua — nếu timer cũ không bị huỷ, toast tắt ở đây.
    advance(1500);
    expect(bubbleVisible(container)).toBe(true);

    advance(1500);
    expect(bubbleVisible(container)).toBe(false);
  });

  it("bơm lại SAU khi đã tắt → hiện lại (state 'trigger nào đã hết hạn' không kẹt)", () => {
    const { container, rerender } = render(<SuccessToast message={MESSAGE} trigger={0} />);

    rerender(<SuccessToast message={MESSAGE} trigger={1} />);
    advance(3000);
    expect(bubbleVisible(container)).toBe(false);

    rerender(<SuccessToast message={MESSAGE} trigger={2} />);
    expect(bubbleVisible(container)).toBe(true);
    expect(announcement()).toBe(MESSAGE);

    advance(3000);
    expect(bubbleVisible(container)).toBe(false);
  });

  it("bong bóng nhìn thấy được là aria-hidden — nội dung không bị đọc hai lần", () => {
    const { container, rerender } = render(<SuccessToast message={MESSAGE} trigger={0} />);
    rerender(<SuccessToast message={MESSAGE} trigger={1} />);

    const bubble = container.querySelector("[aria-hidden='true']");
    expect(bubble).not.toBeNull();
    expect(bubble!.textContent).toContain(MESSAGE);
    expect(screen.getByRole("status").className).toContain("sr-only");
  });
});
