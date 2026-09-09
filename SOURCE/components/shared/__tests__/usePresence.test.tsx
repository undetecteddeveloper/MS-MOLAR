// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { usePresence } from "@/components/shared/usePresence";

function stubReducedMotion(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("reduce") ? matches : false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
}

describe("usePresence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("(a) không có matchMedia (jsdom) → đóng là gỡ ngay, không có pha closing", () => {
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 120), {
      initialProps: { open: true },
    });
    expect(result.current).toEqual({ present: true, closing: false });
    rerender({ open: false });
    expect(result.current).toEqual({ present: false, closing: false });
  });

  it("(b) trình duyệt cho phép chuyển động → giữ thêm đúng exitMs rồi mới gỡ", () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 120), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(result.current).toEqual({ present: true, closing: true });
    act(() => {
      vi.advanceTimersByTime(119);
    });
    expect(result.current.present).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ present: false, closing: false });
  });

  it("(c) mở lại trong lúc đang đóng → về open ngay, timer cũ không gỡ nhầm", () => {
    vi.useFakeTimers();
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 120), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(result.current.closing).toBe(true);
    rerender({ open: true });
    expect(result.current).toEqual({ present: true, closing: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toEqual({ present: true, closing: false });
  });

  it("(d) người dùng bật giảm chuyển động → gỡ ngay như không có chiều đóng", () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(({ open }) => usePresence(open, 120), {
      initialProps: { open: true },
    });
    rerender({ open: false });
    expect(result.current).toEqual({ present: false, closing: false });
  });
});
