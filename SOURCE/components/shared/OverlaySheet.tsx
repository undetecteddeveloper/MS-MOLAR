"use client";

// OverlaySheet — vỏ lớp phủ DÙNG CHUNG cho tấm trượt ghi chú (O-01) và tấm
// trượt bình luận (O-02) của Bài giải cộng đồng (UI Spec C-16, UI-D10, UI-D28).
//
// Không dựng trên FilterSheet: nó neo TRÊN BottomNav (z-30), không giam tiêu
// điểm, không Escape, không portal — trái D34 ("đè lên cả thanh đáy") và NFR
// trợ năng. Vỏ này gộp bẫy Tab của ChangePasswordDialog với portal + usePresence
// + khoá cuộn của DeleteDialog.
//
// SHELL THUẦN: không biết "chưa lưu" là gì. Mọi đường đóng (Escape, chạm scrim,
// nút đóng trong nội dung) đi qua `onRequestClose`; cha tự quyết đóng ngay
// ("closed") hay mở ConfirmDialog ba lựa chọn và giữ tấm trượt ("kept", AC-104).
//
// ⚠ PORTAL LÀ BẮT BUỘC (xem DeleteDialog.tsx): `fixed` bên trong một tổ tiên có
// backdrop-blur/transform co lại thành một dải ngang, không lỗi nào được báo.
//
// `useModalLayer` được export để ConfirmDialog dùng CÙNG một bộ luật: hộp thoại
// mở đè lên tấm trượt là ca thường gặp (AC-104), và hai lớp mà mỗi lớp tự nghe
// Escape/Tab, tự đặt `inert`, tự khoá cuộn thì giành nhau — Escape ở hộp thoại
// sẽ xin đóng luôn tấm trượt phía sau, đóng lớp dưới trước sẽ mở khoá trang
// trong khi lớp trên còn mở, và đóng cả hai cùng lúc sẽ trả tiêu điểm về ô
// nhập của tấm trượt đang bị gỡ.

import {
  useEffect,
  useEffectEvent,
  useRef,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { MODAL_EXIT_MS, SHEET_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ lớp phủ */

/** Mọi phần tử nhận được Tab. Loại tabindex="-1" nên scrim và chính panel không
 *  lọt vào vòng Tab (cùng bộ chọn với ChangePasswordDialog). */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

interface ModalLayer {
  /** Phần tử con trực tiếp của <body> do portal tạo. */
  root: HTMLElement;
  /** Phần tử giữ tiêu điểm lúc lớp mở — nơi tiêu điểm quay về khi lớp đóng. */
  opener: HTMLElement | null;
  /** Lớp đang mở chứa `opener`: hộp thoại "Lưu/Bỏ/Ở lại" hỏi từ trong tấm trượt. */
  parent: ModalLayer | null;
  open: boolean;
}

/** Các lớp phủ đang mở theo thứ tự mở. Chỉ lớp TRÊN CÙNG xử lý Escape/Tab. */
const openLayers: ModalLayer[] = [];
/** Số lớp phủ đang giữ `inert` trên từng phần tử con của <body>. Đếm thay vì
 *  bật/tắt: hai lớp có thể đóng theo bất kỳ thứ tự nào (chọn "Bỏ" đóng cả tấm
 *  trượt lẫn hộp thoại trong cùng một lượt render). */
const inertHolds = new Map<Element, number>();
let scrollLocks = 0;
let overflowBeforeLock = "";

function holdInertOutside(root: Element): () => void {
  const held: Element[] = [];
  for (const el of Array.from(document.body.children)) {
    if (el === root) continue;
    const holds = inertHolds.get(el);
    if (holds === undefined) {
      // Đã inert vì một lý do không phải lớp phủ nào ở đây → không đụng tới.
      if (el.hasAttribute("inert")) continue;
      el.setAttribute("inert", "");
    }
    inertHolds.set(el, (holds ?? 0) + 1);
    held.push(el);
  }
  return () => {
    for (const el of held) {
      const holds = (inertHolds.get(el) ?? 1) - 1;
      if (holds > 0) {
        inertHolds.set(el, holds);
        continue;
      }
      inertHolds.delete(el);
      el.removeAttribute("inert");
    }
  };
}

function lockScroll(): () => void {
  // Lớp phủ nằm ở <body>: không khoá thì trang phía sau cuộn dưới scrim và kéo
  // panel trôi khỏi tầm mắt — tệ nhất trên điện thoại đang mở bàn phím ảo.
  if (scrollLocks === 0) {
    overflowBeforeLock = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  scrollLocks += 1;
  return () => {
    scrollLocks -= 1;
    if (scrollLocks === 0) document.body.style.overflow = overflowBeforeLock;
  };
}

/**
 * BẪY TAB (mẫu ChangePasswordDialog.tsx:202-230). Danh sách tính theo thứ tự
 * DOM ngay lúc nhấn phím vì nội dung đổi theo trạng thái; chỉ chặn ở hai mép và
 * khi tiêu điểm đang ở NGOÀI panel (hoặc ở chính panel lúc vừa mở).
 */
function trapTab(event: KeyboardEvent, panel: HTMLElement): void {
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (item) => item.closest("[inert]") === null
  );
  if (items.length === 0) {
    event.preventDefault();
    return;
  }
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = active === panel || !panel.contains(active);

  if (event.shiftKey) {
    if (active === first || outside) {
      event.preventDefault();
      last.focus();
    }
    return;
  }
  if (active === last || outside) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Trả tiêu điểm khi một lớp đóng. "Bỏ"/"Lưu" đóng hộp thoại LẪN tấm trượt
 * trong cùng một lượt, và khi có chuyển động cả hai còn nằm trong DOM suốt pha
 * đóng: trả về `opener` của hộp thoại là trả về ô nhập của tấm trượt sắp bị gỡ,
 * rồi tiêu điểm rơi về <body>. Nên đi ngược lên qua mọi lớp cha ĐÃ đóng và trả
 * về người mở của lớp NGOÀI CÙNG — đúng với mọi thứ tự chạy cleanup.
 */
function returnFocus(closed: ModalLayer): void {
  const current = document.activeElement;
  // Tiêu điểm đang ở một lớp còn mở (tấm trượt đóng trước, hộp thoại trên nó
  // còn mở): lớp đó trả tiêu điểm khi tới lượt nó đóng.
  if (openLayers.some((layer) => layer.root.contains(current))) return;
  // Chỉ kéo tiêu điểm khi nó đã rơi về <body>, còn kẹt trong lớp vừa đóng, hoặc
  // nằm trong vùng `inert` (panel của một lớp khác đang đóng — trình duyệt thật
  // không cho focus() vào đó); cha đã tự đặt tiêu điểm ở chỗ khác thì giữ nguyên.
  const stranded =
    current === null ||
    current === document.body ||
    closed.root.contains(current) ||
    current.closest("[inert]") !== null;
  if (!stranded) return;

  let origin = closed;
  while (origin.parent && !origin.parent.open) origin = origin.parent;
  if (origin.opener?.isConnected) origin.opener.focus();
}

interface ModalLayerOptions {
  /** Lớp đang mở VÀ portal đã có trong DOM. */
  active: boolean;
  /** Phần tử con trực tiếp của <body> do portal tạo — mọi thứ khác bị `inert`. */
  rootRef: RefObject<HTMLElement | null>;
  /** Ranh giới của bẫy Tab. */
  panelRef: RefObject<HTMLElement | null>;
  /** Nơi nhận tiêu điểm khi mở; không truyền thì là chính panel. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  onEscape: () => void;
}

/**
 * Luật chung của một lớp phủ modal: phần còn lại của trang `inert`, khoá cuộn
 * <body>, tiêu điểm vào lớp khi mở, Escape + bẫy Tab khi là lớp trên cùng, trả
 * tiêu điểm về phần tử đã mở khi đóng.
 */
export function useModalLayer({
  active,
  rootRef,
  panelRef,
  initialFocusRef,
  onEscape,
}: ModalLayerOptions): void {
  const escape = useEffectEvent(onEscape);

  useEffect(() => {
    if (!active) return;
    const root = rootRef.current;
    const panel = panelRef.current;
    if (!root || !panel) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const layer: ModalLayer = {
      root,
      opener,
      parent: openLayers.findLast((below) => below.root.contains(opener)) ?? null,
      open: true,
    };
    openLayers.push(layer);
    const releaseInert = holdInertOutside(root);
    const releaseScroll = lockScroll();
    (initialFocusRef?.current ?? panel).focus();

    function onKeyDown(event: KeyboardEvent) {
      if (openLayers[openLayers.length - 1] !== layer || !panel) return;
      // Escape trong lúc gõ bộ gõ tiếng Việt chỉ huỷ chữ đang ghép, không đóng.
      if (event.key === "Escape" && !event.isComposing) {
        event.preventDefault();
        escape();
        return;
      }
      if (event.key === "Tab") trapTab(event, panel);
    }
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      layer.open = false;
      openLayers.splice(openLayers.indexOf(layer), 1);
      // Gỡ `inert` TRƯỚC khi trả tiêu điểm: phần tử nằm trong vùng inert không
      // nhận được tiêu điểm.
      releaseInert();
      releaseScroll();
      returnFocus(layer);
    };
  }, [active, rootRef, panelRef, initialFocusRef]);
}

/* ------------------------------------------------------------- tấm trượt */

/** Khớp `@media (min-width: 768px)` của `.motion-sheet` trong globals.css —
 *  đúng mốc mà lớp đó tự đổi thành "bung từ góc trên-trái". */
const WIDE_QUERY = "(min-width: 768px)";

/** Chỗ DUY NHẤT chọn bố cục, lớp chuyển động và thời gian đóng theo bề rộng
 *  (UI-D10). Chọn cả bố cục bằng JS thay vì tiền tố `md:` để hai thứ không bao
 *  giờ lệch nhau ở đúng mốc 768px. */
const LAYOUTS = {
  narrow: {
    panel: "inset-x-0 bottom-0 rounded-t-card border-t motion-sheet",
    exitMs: SHEET_EXIT_MS,
  },
  wide: {
    panel: "inset-x-0 bottom-6 mx-auto max-w-2xl rounded-card border motion-modal",
    exitMs: MODAL_EXIT_MS,
  },
} as const;

const PANEL_BASE =
  "fixed z-50 max-h-[85dvh] overflow-y-auto border-border bg-background px-4 pt-3 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] outline-none focus-visible:ring-3 focus-visible:ring-ring/40";

function subscribeWide(onChange: () => void): () => void {
  if (typeof window.matchMedia !== "function") return () => {};
  const mql = window.matchMedia(WIDE_QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

function getWideSnapshot(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(WIDE_QUERY).matches;
}

function subscribeNothing(): () => void {
  return () => {};
}

interface OverlaySheetProps {
  open: boolean;
  /** Mọi đường đóng đi qua đây. Trả "closed" khi cha đã đóng tấm trượt, "kept"
   *  khi cha giữ nó mở (vd đang hỏi Lưu/Bỏ/Ở lại). */
  onRequestClose: () => "closed" | "kept";
  /** Id của tiêu đề trong nội dung — nhãn của dialog. */
  titleId: string;
  children: ReactNode;
}

export function OverlaySheet({ open, onRequestClose, titleId, children }: OverlaySheetProps) {
  // Snapshot phía server là false cho cả hai: tấm trượt có thể MỞ SẴN lúc tải
  // (`?comments=1`), nên không dựa vào "chỉ mở sau một cú bấm" như DeleteDialog
  // — portal chỉ render sau hydrate, bề rộng đọc lúc render nên đúng ngay khung
  // hình đầu tiên (không chạy thử lớp chuyển động của bố cục kia).
  const isClient = useSyncExternalStore(
    subscribeNothing,
    () => true,
    () => false
  );
  const wide = useSyncExternalStore(subscribeWide, getWideSnapshot, () => false);
  const layout = wide ? LAYOUTS.wide : LAYOUTS.narrow;
  const { present, closing } = usePresence(open, layout.exitMs);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useModalLayer({ active: open && isClient, rootRef, panelRef, onEscape: onRequestClose });

  if (!present || !isClient) return null;
  const closingAttr = closing ? "" : undefined;

  return createPortal(
    <div ref={rootRef}>
      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        onClick={() => onRequestClose()}
        data-closing={closingAttr}
        inert={closing || undefined}
        className="motion-scrim bg-foreground/20 fixed inset-0 z-50 cursor-default"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        // Mốc cho SupportWidgetTrigger tự ẩn khi tấm trượt đang mở (UI-D28): nút
        // hỗ trợ z-45 nằm dưới panel nhưng scrim chỉ mờ 20% nên nó vẫn trông như
        // bấm được.
        data-app-overlay=""
        data-closing={closingAttr}
        inert={closing || undefined}
        className={cn(PANEL_BASE, layout.panel)}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
