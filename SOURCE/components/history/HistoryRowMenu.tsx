"use client";

// HistoryRowMenu — front-adjust: consolidates HistoryRow's 3 separate
// controls (Save ActionButton, Share ActionButton, "View details" Link) into
// a single ⋯ trigger + dropdown menu, matching HeaderProfile.tsx's dropdown
// convention (scrim + role="menu" panel) rather than introducing a new menu
// primitive. Theme "Sân trường" (2026-09-07): nút ⋯ là viên thuốc TRẮNG 36px
// (`plain`, cỡ nút-trong-thẻ) trên thẻ surface; bảng menu cùng lớp vỏ với
// HeaderProfile (popover trắng, viền mảnh, bo 14px, mục 44px bo 11px). Hết
// viền-xám-chữ-nâu của theme cũ.
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
// top-full right-0`, anchored to THIS row, inside HistoryList's then-bounded
// `overflow-y-auto` list sitting just above the mobile BottomNav (`fixed
// z-40`). An `absolute` descendant's containing block is the nearest
// POSITIONED ancestor — here, this row's own `.relative` wrapper — which was
// INSIDE that scroll container, so the panel's paint position was subject to
// the list's clipping box and got visually eaten by BottomNav for rows near
// the bottom. Fix: compute the panel's position from the trigger's viewport
// rect (`getBoundingClientRect`) and render it via `createPortal` to
// `document.body` with `position: fixed`. The list no longer scrolls on its
// own (2026-09-07: it paginates instead), but the portal stays as a
// STRUCTURAL guarantee — no future ancestor change (an added `overflow`, a
// `max-h`, a `transform` for an unrelated animation) can silently reintroduce
// the clipping. Direction flips (opens upward) and height clamps with its own
// `overflow-y-auto` when the trigger is close enough to the viewport edge
// that even the flipped side doesn't have room — the panel can never render
// partially off-screen or behind BottomNav, regardless of how tall its
// content is or how many rows the list holds.
import { ArrowUpRight, Download, Loader2, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePdfAction } from "@/components/history/usePdfAction";
import { buttonVariants } from "@/components/ui/button";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export interface HistoryRowMenuProps {
  pdfInput: AttemptPdfData;
  resultHref: string;
  /** Accessible name suffix ("More actions for <examTitle>") — disambiguates N triggers on one page. */
  examTitle: string;
  /** Lý do KHÔNG xuất được PDF, hoặc `null`. BẮT BUỘC — xem `usePdfAction`.
   *
   *  CỬA THỨ HAI của cổng AC-058 (UI-D4). `/history` là nơi học sinh quay lại
   *  sau vài ngày, tức nơi một lượt xuất PDF dễ xảy ra nhất; chặn ở `/result`
   *  mà mở ở đây là không chặn gì cả. */
  blockedReason: string | null;
}

/** Trần chiều cao "muốn có" của panel — 3 mục 44px + đệm + có thể thêm dòng
 *  lý do chặn/lỗi. Không phải hằng cứng bố cục, chỉ là ngưỡng ước lượng để
 *  quyết định mở lên/xuống; panel luôn tự `overflow-y-auto` nếu chỗ thật sự có
 *  ít hơn số này. */
const MENU_PREFERRED_MAX_PX = 280;
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
        // Gốc phóng ra (globals.css .motion-pop) đặt ở góc dính với nút ⋯.
        transformOrigin: "top right",
      });
    } else {
      setStyle({
        position: "fixed",
        bottom: window.innerHeight - rect.top + GAP_PX,
        right,
        maxHeight: Math.min(Math.max(spaceAbove, MENU_MIN_PX), MENU_PREFERRED_MAX_PX),
        transformOrigin: "bottom right",
      });
    }
  }, [open, triggerRef]);

  return style;
}

/** Một mục menu — dùng chung cho hai nút PDF lẫn liên kết Xem chi tiết để ba
 *  mục không trôi khỏi nhau về đệm hay cỡ chữ. */
const ITEM_CLASS =
  "hover:bg-surface flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-foreground transition-colors aria-disabled:opacity-60";

export function HistoryRowMenu({
  pdfInput,
  resultHref,
  examTitle,
  blockedReason,
}: HistoryRowMenuProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  // Panel ở lại thêm 120ms sau khi đóng để chạy chiều thu (globals.css
  // §CHUYỂN ĐỘNG) — vị trí tính theo `present` chứ không theo `open`, nếu
  // không style về null ngay lúc đóng và panel nhảy về góc 0,0 trước khi mờ đi.
  const { present, closing } = usePresence(open, POP_EXIT_MS);
  const panelStyle = usePanelPosition(present, triggerRef);
  const save = usePdfAction("save", pdfInput, blockedReason);
  const share = usePdfAction("share", pdfInput, blockedReason);

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
  // cuộn trang (hoặc resize) thì đóng menu, giống hành vi chuẩn của hầu hết
  // dropdown khác, thay vì phải định vị lại theo thời gian thực. `capture:
  // true` để bắt được cả cuộn bên trong bất kỳ khung cuộn con nào (sự kiện
  // scroll không bubble, chỉ capture hoặc gắn thẳng lên phần tử cuộn).
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
        className={buttonVariants({ variant: "plain", size: "icon-sm" })}
      >
        <MoreHorizontal aria-hidden />
      </button>

      {present &&
        panelStyle &&
        createPortal(
          <div
            role="menu"
            style={panelStyle}
            data-closing={closing ? "" : undefined}
            inert={closing || undefined}
            className="motion-pop border-border bg-popover z-50 w-60 overflow-y-auto rounded-xl border p-1.5"
          >
            {/* CẢ HAI mục PDF nhận `blockedReason`. Nối một mục mà quên mục
                kia là sai lầm dễ xảy ra nhất ở lát này, VÀ MỖI CỬA TRÔNG VẪN
                ĐÚNG KHI KIỂM RIÊNG — "Lưu" và "Chia sẻ" sinh ra CÙNG một tệp,
                nên chặn một nửa là không chặn gì cả. */}
            <MenuAction
              label={t("common.save")}
              busyLabel={t("common.saving")}
              errorText={t("history.pdfError")}
              icon={Download}
              phase={save.phase}
              onClick={save.run}
              blockedReason={blockedReason}
            />
            <MenuAction
              label={t("common.share")}
              busyLabel={t("history.sharing")}
              errorText={t("history.pdfError")}
              icon={Share2}
              phase={share.phase}
              onClick={share.run}
              fallbackText={t("history.downloadedNoShare")}
              blockedReason={blockedReason}
            />
            {/* "Xem chi tiết" KHÔNG BAO GIỜ bị chặn, và đó là một quyết định:
                chặn nó là khoá học sinh khỏi đúng cái nút chấm lại sẽ GỠ được
                cái chặn kia. Cửa duy nhất ra khỏi trạng thái bị chặn đi qua
                đây. */}
            <Link role="menuitem" href={resultHref} onClick={close} className={ITEM_CLASS}>
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
  blockedReason,
}: {
  label: string;
  busyLabel: string;
  errorText: string;
  icon: typeof Download;
  phase: "idle" | "busy" | "error" | "fallback-confirmed";
  onClick: () => void;
  fallbackText?: string;
  /** Lý do KHÔNG bấm được, hoặc `null`. Chỉ hai mục PDF truyền vào. */
  blockedReason?: string | null;
}) {
  const busy = phase === "busy";
  const blocked = blockedReason != null;
  return (
    <div>
      <button
        type="button"
        role="menuitem"
        onClick={onClick}
        // KHÔNG BAO GIỜ `disabled` gốc (UI-D5): mục vẫn tới được bằng bàn phím
        // và LÝ DO vẫn đọc được. Bản thân `usePdfAction` đã chặn lượt chạy từ
        // trước chốt bận, nên một lượt bấm ở đây là no-op và menu KHÔNG tự
        // đóng — menu chỉ đóng khi xuất THÀNH CÔNG.
        aria-disabled={blocked || busy ? "true" : "false"}
        aria-busy={busy}
        className={cn(ITEM_CLASS)}
      >
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-4 shrink-0" aria-hidden />
        )}
        {busy ? busyLabel : label}
      </button>
      {blocked && (
        <p className="text-muted-foreground px-3 pb-1.5 text-xs leading-snug">{blockedReason}</p>
      )}
      {phase === "error" && (
        <p role="alert" className="text-destructive px-3 pb-1.5 text-xs leading-snug">
          {errorText}
        </p>
      )}
      {phase === "fallback-confirmed" && fallbackText && (
        <p
          role="status"
          aria-live="polite"
          className="text-muted-foreground px-3 pb-1.5 text-xs leading-snug"
        >
          {fallbackText}
        </p>
      )}
    </div>
  );
}
