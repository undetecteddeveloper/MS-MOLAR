"use client";

// HistoryRowMenu — front-adjust: consolidates HistoryRow's 3 separate
// controls (Save ActionButton, Share ActionButton, "View details" Link) into
// a single ⋯ trigger + dropdown menu, matching HeaderProfile.tsx's existing
// dropdown convention (scrim + role="menu" panel, ivory-on-border styling)
// rather than introducing a new menu primitive.
//
// Save/Share route through the same usePdfAction hook ActionButton uses
// (AC-007 single PDF pipeline) — each has its own busyRef instance, so
// triggering Save doesn't block Share and vice versa. Unlike ActionButton,
// busy/error/fallback text renders as normal in-flow content inside the menu
// item (not an absolutely-positioned overlay), so there's no D2-style
// phantom-position risk here at all — the menu item just grows.
//
// ⚠ POSITIONING (2026-08-09, real bug — same shape as ExamFilters.tsx's
// FilterRow fix, same day): the panel used to be `position: absolute
// top-full right-0`, anchored to THIS row. HistoryList renders rows inside
// `<ul class="max-h-[...] overflow-y-auto">` (a bounded, internally-scrolling
// list, D3) sitting just above the mobile BottomNav (`fixed z-40`). An
// `absolute` descendant's containing block is the nearest POSITIONED
// ancestor — here, this row's own `.relative` wrapper — which is itself
// INSIDE that scroll container, so the panel's paint position is still
// subject to the list's clipping box. For any row whose menu-open position
// lands near the bottom of the currently-scrolled list (trivially true once
// a user accumulates enough history to fill/scroll the list — this is NOT a
// fixed-count bug, it gets MORE likely as `entries` grows, not less), the
// panel rendered flush against — and got visually eaten by — BottomNav.
// Fix: compute the panel's position from the trigger's viewport rect
// (`getBoundingClientRect`) and render it via `createPortal` to `document
// .body` with `position: fixed`. This is a structural guarantee, not an
// implicit one — the panel is no longer a descendant of ANY scroll
// container, so no future ancestor change (an added `overflow`, a `max-h`,
// a `transform` for an unrelated animation) can silently reintroduce this
// clipping. Direction flips (opens upward) and height clamps with its own
// `overflow-y-auto` when the trigger is close enough to the viewport edge
// that even the flipped side doesn't have room — the panel can never render
// partially off-screen or behind BottomNav, regardless of how tall its
// content is or how many rows the list holds.
import { ArrowUpRight, Download, Loader2, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePdfAction } from "@/components/history/usePdfAction";
import { useT } from "@/lib/i18n/client";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export interface HistoryRowMenuProps {
  pdfInput: AttemptPdfData;
  resultHref: string;
  /** Accessible name suffix ("More actions for <examTitle>") — disambiguates N triggers on one page. */
  examTitle: string;
}

/** Trần chiều cao "muốn có" của panel — 3 mục + có thể thêm 1 dòng lỗi/fallback.
 *  Không phải hằng cứng bố cục, chỉ là ngưỡng ước lượng để quyết định mở lên/
 *  xuống; panel luôn tự `overflow-y-auto` nếu chỗ thật sự có ít hơn số này. */
const MENU_PREFERRED_MAX_PX = 260;
const MENU_MIN_PX = 100;
const GAP_PX = 8;

function usePanelPosition(open: boolean, triggerRef: React.RefObject<HTMLButtonElement | null>) {
  const [style, setStyle] = useState<React.CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // jsdom (RTL/vitest) không cài `matchMedia` — guard để test component
    // chạy được trong môi trường không phải trình duyệt thật, không phải vì
    // lo trình duyệt thật thiếu API này (đã có từ IE10).
    const isMobile =
      typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
    const bottomNavRem = isMobile
      ? parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-h")
        ) || 0
      : 0;
    // +16px đệm thêm cho safe-area (home indicator iOS) — không đọc được
    // `env()` qua JS một cách gọn gàng, nên dự phòng rộng rãi hơn thay vì cắt
    // sát rồi lại tái diễn đúng lỗi này trên máy có notch.
    const bottomReservePx = bottomNavRem * rootPx + (bottomNavRem > 0 ? 16 : 0);

    const spaceBelow = window.innerHeight - bottomReservePx - rect.bottom - GAP_PX;
    const spaceAbove = rect.top - GAP_PX;
    const right = window.innerWidth - rect.right;

    if (spaceBelow >= MENU_MIN_PX && spaceBelow >= spaceAbove) {
      setStyle({
        position: "fixed",
        top: rect.bottom + GAP_PX,
        right,
        maxHeight: Math.min(Math.max(spaceBelow, MENU_MIN_PX), MENU_PREFERRED_MAX_PX),
      });
    } else {
      setStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + GAP_PX,
        right,
        maxHeight: Math.min(Math.max(spaceAbove, MENU_MIN_PX), MENU_PREFERRED_MAX_PX),
      });
    }
  }, [open, triggerRef]);

  return style;
}

export function HistoryRowMenu({ pdfInput, resultHref, examTitle }: HistoryRowMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelStyle = usePanelPosition(open, triggerRef);
  const save = usePdfAction("save", pdfInput);
  const share = usePdfAction("share", pdfInput);

  // Auto-close once Save/Share completes successfully (phase settles back to
  // idle) — error and fallback-confirmed stay open so the user can read the
  // message / retry. Adjusted during render (React's "adjust state when a
  // prop changes" pattern, not an effect — react-hooks/set-state-in-effect)
  // by tracking each hook's previous phase and reacting only to an actual
  // transition, never the initial idle render.
  const [prevSavePhase, setPrevSavePhase] = useState(save.phase);
  if (save.phase !== prevSavePhase) {
    setPrevSavePhase(save.phase);
    if (save.phase === "idle") setOpen(false);
  }
  const [prevSharePhase, setPrevSharePhase] = useState(share.phase);
  if (share.phase !== prevSharePhase) {
    setPrevSharePhase(share.phase);
    if (share.phase === "idle") setOpen(false);
  }

  function close() {
    setOpen(false);
  }

  // Vị trí tính MỘT LẦN lúc mở (usePanelPosition), không theo dõi liên tục —
  // cuộn danh sách (hoặc resize) thì đóng menu, giống hành vi chuẩn của hầu
  // hết dropdown khác, thay vì phải định vị lại theo thời gian thực. `capture:
  // true` để bắt được cả cuộn bên trong `<ul overflow-y-auto>` của HistoryList
  // (sự kiện scroll không bubble, chỉ capture hoặc gắn thẳng lên phần tử cuộn).
  useEffect(() => {
    if (!open) return;
    function handleScrollOrResize() {
      setOpen(false);
    }
    window.addEventListener("scroll", handleScrollOrResize, { capture: true, passive: true });
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-50 cursor-default"
        />
      )}

      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("history.moreActionsFor", { title: examTitle })}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-xl border border-border bg-card p-3 text-brand transition-colors hover:border-brand/40"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>

      {open &&
        panelStyle &&
        createPortal(
          <div
            role="menu"
            style={panelStyle}
            className="border-border bg-card animate-in fade-in zoom-in-95 z-50 w-56 overflow-y-auto rounded-md border p-1 shadow-sm duration-150 ease-out"
          >
            <MenuAction
              label={t("common.save")}
              busyLabel={t("common.saving")}
              errorText={t("history.pdfError")}
              icon={Download}
              phase={save.phase}
              onClick={save.run}
            />
            <MenuAction
              label={t("common.share")}
              busyLabel={t("history.sharing")}
              errorText={t("history.pdfError")}
              icon={Share2}
              phase={share.phase}
              onClick={share.run}
              fallbackText={t("history.downloadedNoShare")}
            />
            <Link
              role="menuitem"
              href={resultHref}
              onClick={close}
              className="hover:bg-accent flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-left text-sm text-foreground transition-colors"
            >
              <ArrowUpRight className="size-4 shrink-0" aria-hidden />
              {t("common.viewDetails")}
            </Link>
          </div>,
          document.body
        )}
    </div>
  );
}

function MenuAction({
  label,
  busyLabel,
  errorText,
  icon: Icon,
  phase,
  onClick,
  fallbackText,
}: {
  label: string;
  busyLabel: string;
  errorText: string;
  icon: typeof Download;
  phase: "idle" | "busy" | "error" | "fallback-confirmed";
  onClick: () => void;
  fallbackText?: string;
}) {
  const busy = phase === "busy";
  return (
    <div>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        aria-disabled={busy ? "true" : "false"}
        aria-busy={busy}
        className="hover:bg-accent flex w-full items-center gap-2 rounded-[4px] px-3 py-2 text-left text-sm text-foreground transition-colors"
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-4 shrink-0" aria-hidden />
        )}
        {busy ? busyLabel : label}
      </button>
      {phase === "error" && (
        <p role="alert" className="text-brand px-3 pb-1 text-xs">
          {errorText}
        </p>
      )}
      {phase === "fallback-confirmed" && fallbackText && (
        <p role="status" aria-live="polite" className="text-muted-foreground px-3 pb-1 text-xs">
          {fallbackText}
        </p>
      )}
    </div>
  );
}
