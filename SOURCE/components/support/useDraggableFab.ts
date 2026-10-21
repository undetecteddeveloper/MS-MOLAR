"use client";

// useDraggableFab — cho nút nổi (SupportWidgetTrigger) dời được để nó không che thứ
// người dùng đang muốn bấm (2026-10-21).
//
// Vị trí là KHOẢNG CÁCH TỪ MÉP PHẢI VÀ MÉP DƯỚI của màn hình (cùng hệ với `right`/
// `bottom` mà nút dùng mặc định), nên đổi cỡ cửa sổ hay xoay điện thoại thì nút vẫn
// bám góc cũ. Chưa kéo lần nào thì hook KHÔNG trả `style` và nút ở đúng chỗ mặc định
// của CSS (kể cả các biến thể nhấc lên khỏi BottomNav/PublishBar).
//
// · Kéo: chuột hoặc ngón tay, quá DRAG_THRESHOLD px mới tính là kéo — dưới ngưỡng vẫn là
//   một cú bấm bình thường mở hộp thoại. Sau một cú kéo, cú `click` đi kèm bị nuốt.
// · Bàn phím: Shift + phím mũi tên dời KEY_STEP px — đường thay thế cho người không kéo
//   được (WCAG 2.5.7).
// · Nhớ vị trí trong localStorage (tiện ích riêng của từng máy, không phải dữ liệu
//   người dùng). Đọc qua `useSyncExternalStore` nên lượt render đầu của server và của
//   client trùng nhau (không có vị trí), rồi client áp vị trí đã lưu — không lệch hydrate.
//   Mọi lượt đọc/ghi bọc try/catch: cửa sổ ẩn danh hoặc bị chặn dữ liệu thì chỉ mất
//   việc nhớ, nút vẫn kéo được.

import { useRef, useState, useSyncExternalStore } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

export type FabOffset = { right: number; bottom: number };

export const FAB_STORAGE_KEY = "ms-molar:support-fab-offset";
const FAB_CHANGED_EVENT = "ms-molar:support-fab-offset-changed";
/** Khoảng chừa tối thiểu giữa nút và mép màn hình. */
const EDGE = 8;
const DRAG_THRESHOLD = 6;
const KEY_STEP = 16;
/** Cú `click` sinh ra ngay sau khi nhả chuột/tay của một cú kéo bị nuốt trong ngần này ms. */
const SWALLOW_CLICK_MS = 100;

const ARROW_DELTA: Record<string, readonly [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

function readSaved(): string | null {
  try {
    return window.localStorage.getItem(FAB_STORAGE_KEY);
  } catch {
    return null;
  }
}

/** `false` khi không lưu được (ẩn danh, bị chặn dữ liệu): nơi gọi giữ vị trí trong state. */
function writeSaved(offset: FabOffset): boolean {
  try {
    window.localStorage.setItem(FAB_STORAGE_KEY, JSON.stringify(offset));
  } catch {
    return false;
  }
  window.dispatchEvent(new Event(FAB_CHANGED_EVENT));
  return true;
}

function parseSaved(raw: string | null): FabOffset | null {
  if (raw === null) return null;
  try {
    const value = JSON.parse(raw) as Partial<FabOffset> | null;
    if (
      value !== null &&
      typeof value === "object" &&
      Number.isFinite(value.right) &&
      Number.isFinite(value.bottom)
    ) {
      return { right: value.right as number, bottom: value.bottom as number };
    }
  } catch {
    // JSON hỏng: coi như chưa lưu.
  }
  return null;
}

function subscribeSaved(onChange: () => void): () => void {
  window.addEventListener(FAB_CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(FAB_CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function subscribeResize(onChange: () => void): () => void {
  window.addEventListener("resize", onChange);
  return () => window.removeEventListener("resize", onChange);
}

function viewportKey(): string {
  return `${document.documentElement.clientWidth}x${document.documentElement.clientHeight}`;
}

/** Kẹp vị trí để nút nằm trọn trong màn hình, chừa EDGE ở mọi mép. */
export function clampFabOffset(offset: FabOffset, size: number): FabOffset {
  const maxRight = Math.max(EDGE, document.documentElement.clientWidth - size - EDGE);
  const maxBottom = Math.max(EDGE, document.documentElement.clientHeight - size - EDGE);
  return {
    right: Math.min(Math.max(offset.right, EDGE), maxRight),
    bottom: Math.min(Math.max(offset.bottom, EDGE), maxBottom),
  };
}

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startRight: number;
  startBottom: number;
  moved: boolean;
};

export function useDraggableFab(size: number) {
  const saved = useSyncExternalStore(subscribeSaved, readSaved, () => null);
  // Đọc để render lại khi đổi cỡ cửa sổ: vị trí đã lưu phải được kẹp lại cho vừa màn mới.
  useSyncExternalStore(subscribeResize, viewportKey, () => "");

  const [live, setLive] = useState<FabOffset | null>(null);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<DragState | null>(null);
  const lastOffset = useRef<FabOffset | null>(null);
  const swallowClick = useRef(false);

  const storedOffset = parseSaved(saved);
  const offset = live ?? (storedOffset ? clampFabOffset(storedOffset, size) : null);

  function currentOffset(el: HTMLElement): FabOffset {
    const rect = el.getBoundingClientRect();
    return {
      right: document.documentElement.clientWidth - rect.right,
      bottom: document.documentElement.clientHeight - rect.bottom,
    };
  }

  function onPointerDown(e: PointerEvent<HTMLElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const start = currentOffset(e.currentTarget);
    drag.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRight: start.right,
      startBottom: start.bottom,
      moved: false,
    };
  }

  function onPointerMove(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      d.moved = true;
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Môi trường không hỗ trợ capture: kéo vẫn chạy khi con trỏ còn ở trên nút.
      }
      setDragging(true);
    }
    // Kéo sang phải/xuống = khoảng cách tới mép phải/dưới GIẢM.
    const next = clampFabOffset({ right: d.startRight - dx, bottom: d.startBottom - dy }, size);
    lastOffset.current = next;
    setLive(next);
  }

  function endDrag(e: PointerEvent<HTMLElement>) {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) return;

    swallowClick.current = true;
    window.setTimeout(() => {
      swallowClick.current = false;
    }, SWALLOW_CLICK_MS);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Đã tự nhả.
    }
    setDragging(false);
    // Không lưu được thì GIỮ `live`: nút ở nguyên chỗ vừa thả cho tới khi tải lại trang.
    if (!lastOffset.current || writeSaved(lastOffset.current)) setLive(null);
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    const delta = ARROW_DELTA[e.key];
    if (!e.shiftKey || !delta) return;
    e.preventDefault();
    const from = offset ?? currentOffset(e.currentTarget);
    // Mũi tên phải = nút đi sang phải = `right` giảm; mũi tên lên = `bottom` tăng.
    const next = clampFabOffset(
      { right: from.right - delta[0] * KEY_STEP, bottom: from.bottom - delta[1] * KEY_STEP },
      size
    );
    if (!writeSaved(next)) setLive(next);
  }

  /** `true` đúng một lần cho cú click đi kèm một cú kéo — nơi gọi bỏ qua cú click đó. */
  function consumeClick(): boolean {
    if (!swallowClick.current) return false;
    swallowClick.current = false;
    return true;
  }

  return {
    style: offset ? { right: offset.right, bottom: offset.bottom } : undefined,
    dragging,
    consumeClick,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp: endDrag,
      onPointerCancel: endDrag,
      onKeyDown,
    },
  };
}
