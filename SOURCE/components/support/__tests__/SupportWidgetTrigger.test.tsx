// @vitest-environment jsdom
// No I18nProvider wrapping → useT() renders the "en" default strings.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SupportWidgetTrigger } from "@/components/support/SupportWidgetTrigger";
import { FAB_STORAGE_KEY } from "@/components/support/useDraggableFab";

// jsdom không dàn layout: `clientWidth/Height` = 0 và `getBoundingClientRect()` toàn 0. Dựng
// một màn 1000×800 và nút 56px nằm ở vị trí mặc định (cách mép phải/dưới 16px).
const VIEW_W = 1000;
const VIEW_H = 800;
const DEFAULT_RIGHT = 16;
const DEFAULT_BOTTOM = 16;

function stubViewport() {
  Object.defineProperty(document.documentElement, "clientWidth", {
    configurable: true,
    value: VIEW_W,
  });
  Object.defineProperty(document.documentElement, "clientHeight", {
    configurable: true,
    value: VIEW_H,
  });
}

function renderTrigger(onOpen = vi.fn()) {
  render(<SupportWidgetTrigger onOpen={onOpen} />);
  const button = screen.getByRole("button", { name: "Gửi phản hồi" });
  const rect = () => ({
    right: VIEW_W - parseFloat(button.style.right || String(DEFAULT_RIGHT)),
    bottom: VIEW_H - parseFloat(button.style.bottom || String(DEFAULT_BOTTOM)),
    left: 0,
    top: 0,
    width: 56,
    height: 56,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  vi.spyOn(button, "getBoundingClientRect").mockImplementation(() => rect() as DOMRect);
  return { button, onOpen };
}

const pointer = (
  type: "pointerDown" | "pointerMove" | "pointerUp",
  el: HTMLElement,
  x: number,
  y: number
) =>
  act(() => {
    fireEvent[type](el, { pointerId: 1, pointerType: "touch", clientX: x, clientY: y, button: 0 });
  });

beforeEach(() => {
  stubViewport();
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("SupportWidgetTrigger", () => {
  it("renders a labelled button that calls onOpen on click", () => {
    const onOpen = vi.fn();
    render(<SupportWidgetTrigger onOpen={onOpen} />);
    const button = screen.getByRole("button", { name: "Gửi phản hồi" });
    button.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("chưa kéo lần nào: KHÔNG có style nội tuyến — nút ở đúng chỗ mặc định của CSS", () => {
    const { button } = renderTrigger();
    expect(button.getAttribute("style")).toBeNull();
  });

  // UI-D28: the trigger (z-45) hides while a FilterSheet (`data-filter-sheet`)
  // or an OverlaySheet (`data-app-overlay`) is open. jsdom does not build
  // Tailwind's CSS, so `display: none` cannot be measured here; what can be
  // proven is that the `:has()` variant class for each marker sits on the
  // button — without that class Tailwind emits no rule and the trigger stays
  // visible over the overlay.
  it.each([
    ["data-filter-sheet", "FilterSheet"],
    ["data-app-overlay", "OverlaySheet"],
  ])("carries the [body:has([%s])_&]:hidden class (%s)", (marker) => {
    render(<SupportWidgetTrigger onOpen={() => {}} />);
    const button = screen.getByRole("button", { name: "Gửi phản hồi" });
    expect(button.className.split(/\s+/)).toContain(`[body:has([${marker}])_&]:hidden`);
  });

  it("touch-none: ngón tay đặt lên nút để KÉO nút chứ không cuộn trang", () => {
    const { button } = renderTrigger();
    expect(button.className.split(/\s+/)).toContain("touch-none");
  });
});

describe("kéo nút (2026-10-21)", () => {
  it("kéo sang trái 100px và lên 50px → khoảng cách tới mép phải/dưới tăng đúng bấy nhiêu, rồi được nhớ", () => {
    const { button } = renderTrigger();
    pointer("pointerDown", button, 500, 500);
    pointer("pointerMove", button, 400, 450);
    expect(button.style.right).toBe("116px");
    expect(button.style.bottom).toBe("66px");
    expect(button.getAttribute("data-dragging")).toBe("");

    pointer("pointerUp", button, 400, 450);
    expect(button.getAttribute("data-dragging")).toBeNull();
    expect(button.style.right).toBe("116px");
    expect(JSON.parse(window.localStorage.getItem(FAB_STORAGE_KEY) as string)).toEqual({
      right: 116,
      bottom: 66,
    });
  });

  it("sau một cú kéo, cú click đi kèm bị nuốt (không mở hộp thoại); click kế tiếp mở bình thường", () => {
    const { button, onOpen } = renderTrigger();
    pointer("pointerDown", button, 500, 500);
    pointer("pointerMove", button, 300, 300);
    pointer("pointerUp", button, 300, 300);

    fireEvent.click(button);
    expect(onOpen).not.toHaveBeenCalled();

    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("dịch dưới ngưỡng 6px vẫn là một cú bấm: không dời nút, click mở hộp thoại", () => {
    const { button, onOpen } = renderTrigger();
    pointer("pointerDown", button, 500, 500);
    pointer("pointerMove", button, 503, 502);
    pointer("pointerUp", button, 503, 502);

    expect(button.getAttribute("style")).toBeNull();
    expect(window.localStorage.getItem(FAB_STORAGE_KEY)).toBeNull();
    fireEvent.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("kẹp trong màn hình, chừa 8px mọi mép — kéo ra ngoài không làm mất nút", () => {
    const { button } = renderTrigger();
    pointer("pointerDown", button, 500, 500);
    pointer("pointerMove", button, 5000, 5000); // sang phải/xuống quá xa → sát mép phải/dưới
    expect(button.style.right).toBe("8px");
    expect(button.style.bottom).toBe("8px");

    pointer("pointerMove", button, -5000, -5000); // sang trái/lên quá xa
    expect(button.style.right).toBe(`${VIEW_W - 56 - 8}px`);
    expect(button.style.bottom).toBe(`${VIEW_H - 56 - 8}px`);
  });

  it("nhớ vị trí: lần mở sau áp vị trí đã lưu", () => {
    window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ right: 200, bottom: 120 }));
    const { button } = renderTrigger();
    expect(button.style.right).toBe("200px");
    expect(button.style.bottom).toBe("120px");
  });

  it("vị trí đã lưu nằm ngoài màn hình mới (cửa sổ thu nhỏ) → được kẹp lại", () => {
    window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify({ right: 5000, bottom: -40 }));
    const { button } = renderTrigger();
    expect(button.style.right).toBe(`${VIEW_W - 56 - 8}px`);
    expect(button.style.bottom).toBe("8px");
  });

  it.each(["not json", '{"right":"a","bottom":1}', "null", '{"right":1}'])(
    "dữ liệu đã lưu hỏng (%s) → bỏ qua, nút ở chỗ mặc định",
    (raw) => {
      window.localStorage.setItem(FAB_STORAGE_KEY, raw);
      const { button } = renderTrigger();
      expect(button.getAttribute("style")).toBeNull();
    }
  );

  it("localStorage bị chặn: vẫn kéo được và nút giữ chỗ vừa thả trong phiên", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { button } = renderTrigger();
    pointer("pointerDown", button, 500, 500);
    pointer("pointerMove", button, 450, 450);
    pointer("pointerUp", button, 450, 450);
    expect(button.style.right).toBe("66px");
    expect(button.style.bottom).toBe("66px");
  });
});

describe("dời bằng bàn phím (thay thế cho người không kéo được)", () => {
  it("Shift + mũi tên trái dời nút 16px sang trái; lên dời lên", () => {
    const { button } = renderTrigger();
    fireEvent.keyDown(button, { key: "ArrowLeft", shiftKey: true });
    expect(button.style.right).toBe("32px");
    expect(button.style.bottom).toBe("16px");

    fireEvent.keyDown(button, { key: "ArrowUp", shiftKey: true });
    expect(button.style.bottom).toBe("32px");
  });

  it("mũi tên KHÔNG kèm Shift không dời nút", () => {
    const { button } = renderTrigger();
    fireEvent.keyDown(button, { key: "ArrowLeft" });
    expect(button.getAttribute("style")).toBeNull();
  });

  it("có dòng hướng dẫn cho trình đọc màn hình, nối qua aria-describedby", () => {
    const { button } = renderTrigger();
    const hint = document.getElementById(button.getAttribute("aria-describedby") as string);
    expect(hint?.textContent).toBe("Giữ Shift và bấm phím mũi tên để dời nút.");
  });
});
