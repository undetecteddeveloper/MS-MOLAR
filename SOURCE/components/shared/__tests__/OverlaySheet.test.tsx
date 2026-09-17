// @vitest-environment jsdom

// OverlaySheet — vỏ lớp phủ của tấm trượt ghi chú/bình luận (UI Spec C-16,
// UI-D10, UI-D28; PRD NFR Trợ năng, AC-104).
//
// Nghĩa vụ chứng minh của file này:
// 1. Tiêu điểm bị GIAM trong panel (Tab/Shift+Tab vòng ở hai mép) và phần còn
//    lại của trang mang `inert` — `BottomNav` phía sau không nhận được tiêu
//    điểm. Cây test có một nút nằm NGOÀI portal đóng vai BottomNav (jsdom
//    không cài `inert`, nên nút đó vẫn nhận được tiêu điểm — đúng ca để kiểm
//    bẫy Tab kéo tiêu điểm về panel).
// 2. Mọi đường đóng (Escape, chạm scrim) đi qua `onRequestClose`; "kept" giữ
//    tấm trượt mở.
// 3. Bố cục + lớp chuyển động đổi theo `matchMedia("(min-width: 768px)")`,
//    kể cả khi bề rộng đổi lúc đang mở; chiều đóng giữ đúng exitMs của lớp đó.
//
// Ca AC-104 (tấm trượt + ConfirmDialog ba lựa chọn render CÙNG nhau) nằm ở
// ConfirmDialog.test.tsx.

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OverlaySheet } from "@/components/shared/OverlaySheet";

type MediaListener = () => void;

/** matchMedia giả với bề rộng đổi được. Giảm chuyển động luôn TẮT, nên
 *  usePresence có pha đóng thật. */
function stubViewport(initialWidth: number): { resize: (width: number) => void } {
  let width = initialWidth;
  const listeners = new Set<MediaListener>();
  vi.stubGlobal("matchMedia", (query: string) => {
    const minWidth = /min-width:\s*(\d+)px/.exec(query);
    return {
      get matches() {
        return minWidth ? width >= Number(minWidth[1]) : false;
      },
      media: query,
      addEventListener: (_type: string, listener: MediaListener) => listeners.add(listener),
      removeEventListener: (_type: string, listener: MediaListener) => listeners.delete(listener),
    };
  });
  return {
    resize(next: number) {
      width = next;
      act(() => {
        listeners.forEach((listener) => listener());
      });
    },
  };
}

function Harness({
  decide = () => "closed",
  onRequestClose,
}: {
  /** Quyết định của cha cho mỗi lần xin đóng. */
  decide?: () => "closed" | "kept";
  onRequestClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Mở tấm trượt
      </button>
      <nav aria-label="BottomNav">
        <button type="button">Kho đề</button>
      </nav>
      <OverlaySheet
        open={open}
        titleId="sheet-title"
        onRequestClose={() => {
          onRequestClose?.();
          const decision = decide();
          if (decision === "closed") setOpen(false);
          return decision;
        }}
      >
        <h2 id="sheet-title">Câu 3</h2>
        <button type="button">Đóng</button>
        <textarea aria-label="Ghi chú" />
        <button type="button">Lưu ghi chú</button>
      </OverlaySheet>
    </>
  );
}

function openSheet(): { opener: HTMLElement; sheet: HTMLElement } {
  const opener = screen.getByRole("button", { name: "Mở tấm trượt" });
  opener.focus();
  fireEvent.click(opener);
  return { opener, sheet: screen.getByRole("dialog", { name: "Câu 3" }) };
}

function scrimOf(sheet: HTMLElement): HTMLElement {
  const scrim = sheet.previousElementSibling;
  if (!(scrim instanceof HTMLElement)) throw new Error("scrim not rendered before the panel");
  return scrim;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("OverlaySheet — mở", () => {
  it("portal ra <body>, dialog aria-modal gắn nhãn, mốc data-app-overlay, tiêu điểm vào panel", () => {
    const { container } = render(<Harness />);
    const { sheet } = openSheet();

    expect(container.contains(sheet)).toBe(false);
    expect(sheet.parentElement?.parentElement).toBe(document.body);
    expect(sheet.getAttribute("aria-modal")).toBe("true");
    expect(sheet.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(sheet.hasAttribute("data-app-overlay")).toBe(true);
    expect(document.activeElement).toBe(sheet);
  });

  it("scrim là nút aria-hidden ngoài vòng Tab, z-50 — đè lên cả BottomNav (z-40)", () => {
    render(<Harness />);
    const { sheet } = openSheet();
    const scrim = scrimOf(sheet);
    expect(scrim.tagName).toBe("BUTTON");
    expect(scrim.getAttribute("aria-hidden")).toBe("true");
    expect(scrim.getAttribute("tabindex")).toBe("-1");
    expect(scrim.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["motion-scrim", "fixed", "inset-0", "z-50"])
    );
    expect(sheet.className.split(/\s+/)).toContain("z-50");
  });

  it("phần còn lại của trang mang inert và body khoá cuộn; đóng thì gỡ cả hai", () => {
    const { container } = render(<Harness />);
    openSheet();
    expect(container.hasAttribute("inert")).toBe(true);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(container.hasAttribute("inert")).toBe(false);
    expect(document.body.style.overflow).toBe("");
  });
});

describe("OverlaySheet — bẫy Tab (NFR Trợ năng)", () => {
  it("Tab ở phần tử cuối vòng về phần tử đầu; Shift+Tab ở phần tử đầu vòng về cuối", () => {
    render(<Harness />);
    openSheet();
    const first = screen.getByRole("button", { name: "Đóng" });
    const last = screen.getByRole("button", { name: "Lưu ghi chú" });

    last.focus();
    const tabNotPrevented = fireEvent.keyDown(last, { key: "Tab" });
    expect(tabNotPrevented).toBe(false);
    expect(document.activeElement).toBe(first);

    const shiftTabNotPrevented = fireEvent.keyDown(first, { key: "Tab", shiftKey: true });
    expect(shiftTabNotPrevented).toBe(false);
    expect(document.activeElement).toBe(last);
  });

  it("ở giữa panel thì để trình duyệt tự đi — không chặn", () => {
    render(<Harness />);
    openSheet();
    const middle = screen.getByRole("textbox", { name: "Ghi chú" });
    middle.focus();
    expect(fireEvent.keyDown(middle, { key: "Tab" })).toBe(true);
    expect(document.activeElement).toBe(middle);
  });

  it("Shift+Tab ngay khi vừa mở (tiêu điểm đang ở panel) vòng xuống phần tử cuối", () => {
    render(<Harness />);
    const { sheet } = openSheet();
    fireEvent.keyDown(sheet, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Lưu ghi chú" }));
  });

  it.each([360, 1024])(
    "ở %ipx: BottomNav phía sau inert; tiêu điểm lọt ra đó → Tab kéo về phần tử đầu của panel",
    (width) => {
      stubViewport(width);
      const { container } = render(<Harness />);
      openSheet();
      const behind = screen.getByRole("button", { name: "Kho đề" });
      expect(container.contains(behind)).toBe(true);
      expect(container.hasAttribute("inert")).toBe(true);
      behind.focus();
      fireEvent.keyDown(behind, { key: "Tab" });
      expect(document.activeElement).toBe(screen.getByRole("button", { name: "Đóng" }));
    }
  );
});

describe("OverlaySheet — đóng qua onRequestClose", () => {
  it("Escape gọi onRequestClose; 'closed' ⇒ tấm trượt đóng, tiêu điểm về nút đã mở", () => {
    const onRequestClose = vi.fn();
    render(<Harness onRequestClose={onRequestClose} />);
    const { opener } = openSheet();

    fireEvent.keyDown(screen.getByRole("textbox", { name: "Ghi chú" }), { key: "Escape" });

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("Escape trong lúc bộ gõ đang ghép chữ (Telex) KHÔNG xin đóng; Escape thường thì có", () => {
    const onRequestClose = vi.fn();
    render(<Harness onRequestClose={onRequestClose} />);
    openSheet();
    const field = screen.getByRole("textbox", { name: "Ghi chú" });
    field.focus();

    // Escape lúc đang ghép chỉ huỷ chữ đang gõ dở ("tieng" chưa thành "tiếng").
    fireEvent.keyDown(field, { key: "Escape", isComposing: true });
    expect(onRequestClose).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Câu 3" }).isConnected).toBe(true);

    fireEvent.keyDown(field, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("chạm scrim gọi onRequestClose", () => {
    const onRequestClose = vi.fn();
    render(<Harness onRequestClose={onRequestClose} />);
    const { sheet } = openSheet();

    fireEvent.click(scrimOf(sheet));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("'kept' ⇒ tấm trượt VẪN mở, trang phía sau vẫn inert", () => {
    const onRequestClose = vi.fn();
    const { container } = render(<Harness decide={() => "kept"} onRequestClose={onRequestClose} />);
    const { sheet } = openSheet();

    fireEvent.keyDown(sheet, { key: "Escape" });
    fireEvent.click(scrimOf(sheet));

    expect(onRequestClose).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("dialog", { name: "Câu 3" })).toBe(sheet);
    expect(container.hasAttribute("inert")).toBe(true);
  });
});

describe("OverlaySheet — hai bố cục theo bề rộng (UI-D10)", () => {
  it("<768px: neo đáy toàn bề rộng, .motion-sheet", () => {
    stubViewport(360);
    render(<Harness />);
    const tokens = openSheet().sheet.className.split(/\s+/);
    expect(tokens).toEqual(
      expect.arrayContaining([
        "motion-sheet",
        "inset-x-0",
        "bottom-0",
        "rounded-t-card",
        "border-t",
      ])
    );
    expect(tokens).not.toContain("motion-modal");
  });

  it("≥768px: khối nổi max-w-2xl neo bottom-6, .motion-modal (không phải .motion-sheet)", () => {
    stubViewport(1024);
    render(<Harness />);
    const tokens = openSheet().sheet.className.split(/\s+/);
    expect(tokens).toEqual(
      expect.arrayContaining(["motion-modal", "bottom-6", "mx-auto", "max-w-2xl", "rounded-card"])
    );
    expect(tokens).not.toContain("motion-sheet");
  });

  it("bề rộng đổi lúc đang mở ⇒ bố cục và lớp chuyển động đổi theo", () => {
    const viewport = stubViewport(360);
    render(<Harness />);
    const { sheet } = openSheet();
    expect(sheet.className.split(/\s+/)).toContain("motion-sheet");

    viewport.resize(800);

    expect(sheet.className.split(/\s+/)).toContain("motion-modal");
    expect(sheet.className.split(/\s+/)).not.toContain("motion-sheet");
  });

  it.each([
    [360, 200],
    [1024, 150],
  ])("đang đóng ở %ipx: data-closing + inert, gỡ khỏi DOM sau đúng %ims", (width, exitMs) => {
    stubViewport(width);
    vi.useFakeTimers();
    render(<Harness />);
    const { sheet } = openSheet();
    const scrim = scrimOf(sheet);

    fireEvent.keyDown(sheet, { key: "Escape" });

    for (const el of [sheet, scrim]) {
      expect(el.hasAttribute("data-closing")).toBe(true);
      expect(el.hasAttribute("inert")).toBe(true);
    }
    act(() => {
      vi.advanceTimersByTime(exitMs - 1);
    });
    expect(sheet.isConnected).toBe(true);
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(sheet.isConnected).toBe(false);
  });
});
