"use client";

// SolutionMenu (C-25, O-06) — menu "⋯" của một bài giải ở màn xem (AC-058,
// AC-073, AC-077). Bản dựng của task 19 CHỈ có mục ghim/bỏ ghim + "Sửa bài
// giải" (edit); ReportDialog thật (mở khi bấm "Báo cáo bài giải") là phạm vi
// task 36 — file này chỉ dựng ĐÚNG hai nhánh hiển thị của `iReported` và
// KHÔNG gắn `onClick` mở hộp thoại nào (xem Notes trong task file).
//
// Định vị/portal: cùng khuôn `components/history/HistoryRowMenu.tsx:184-295`
// (Reference Representativeness — cùng nguy cơ bị `overflow` tổ tiên cắt mất,
// cùng lớp vỏ popover "Đêm hội"). Đây là lần dùng lại THỨ HAI (Rule of Three
// chưa chạm 3), nên chưa tách thành hook dùng chung trong task này.
//
// Hai nhánh loại trừ nhau trong MỘT đường dựng (Refactor Phase của task 19):
// mục ghim/bỏ ghim chỉ khi `isExamAuthor`; ngay sau đó, "Sửa bài giải" (khi
// `isMine`) HOẶC báo cáo/đã báo cáo (khi không phải `isMine`) — không bao giờ
// cả hai mục sau cùng lúc, nên task 36 chỉ cần thêm `onClick`/`ReportDialog`
// vào nhánh báo cáo mà không phải viết lại cấu trúc này.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { setPin, type SetPinAction } from "@/features/solutions/actions";
import { buttonVariants } from "@/components/ui/button";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { t } from "@/lib/copy";

export interface SolutionMenuProps {
  solutionId: string;
  examId: string;
  isPinned: boolean;
  /** Tác giả ĐỀ (khác tác giả BÀI GIẢI) — tín hiệu này không có trong
   *  `SolutionDetail`/`SolutionListItem` (queries.ts task 14 không chiếu nó);
   *  cha (màn xem, task 21) tự suy từ dữ liệu đề đã đọc sẵn và truyền xuống.
   *  Chỉ khi `true` mới render mục "Ghim bài này"/"Bỏ ghim" (AC-077). */
  isExamAuthor: boolean;
  /** Bài của chính người xem (AC-062) — ẩn mục báo cáo, thêm "Sửa bài giải". */
  isMine: boolean;
  /** Bắt buộc khi `isMine` — href mở S-04 với lượt làm đang gắn (cùng quy ước
   *  `SolutionCard.editHref`). Vắng mặt ⇒ không render mục "Sửa bài giải". */
  editHref?: string;
  /** Nguồn DUY NHẤT của trạng thái "đã báo cáo" trên một lượt render mới
   *  (`SolutionDetail.iReported`, frontend DD v1.6). */
  iReported: boolean;
  /** Cho cha (`SolutionAuthorCard`) tự vẽ lại nhãn "Tác giả đề ghim" sau khi
   *  ghim/bỏ ghim thành công (AC-077) — cùng khuôn `HelpfulButton.onError`:
   *  con giữ logic gọi action, cha chỉ nhận kết quả để vẽ lại. */
  onPinnedChange?: (pinned: boolean) => void;
}

/** Trần chiều cao "muốn có" của panel — mẫu `HistoryRowMenu.tsx:62-68`, cùng
 *  hằng số, cùng lý do (ngưỡng ước lượng mở lên/xuống, panel tự `overflow-y-auto`
 *  nếu chỗ thật ít hơn). */
const MENU_PREFERRED_MAX_PX = 280;
const MENU_MIN_PX = 100;
const GAP_PX = 8;

function usePanelPosition(open: boolean, triggerRef: RefObject<HTMLButtonElement | null>) {
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) {
      setStyle(null);
      return;
    }
    const rect = triggerRef.current.getBoundingClientRect();
    const rootPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    // jsdom (RTL/vitest) không cài `matchMedia` — guard để test component chạy
    // được trong môi trường không phải trình duyệt thật.
    const isMobile =
      typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches;
    const bottomNavRem = isMobile
      ? parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--bottom-nav-h")) || 0
      : 0;
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

const ITEM_CLASS =
  "hover:bg-surface flex min-h-11 w-full items-center gap-2.5 rounded-lg px-3 text-left text-sm font-medium text-foreground transition-colors aria-disabled:opacity-60";

export function SolutionMenu({
  solutionId,
  examId,
  isPinned,
  isExamAuthor,
  isMine,
  editHref,
  iReported,
  onPinnedChange,
}: SolutionMenuProps) {
  const [open, setOpen] = useState(false);
  const [pinBusy, setPinBusy] = useState(false);
  const [pinError, setPinError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { present, closing } = usePresence(open, POP_EXIT_MS);
  const panelStyle = usePanelPosition(present, triggerRef);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  // Escape đóng menu và trả tiêu điểm về nút "⋯" (mẫu `QuestionPaletteDock.tsx`
  // — `HistoryRowMenu` không tự implement phím này, chỉ có chạm ngoài).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      close();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function handlePin(action: SetPinAction) {
    if (pinBusy) return;
    setPinBusy(true);
    setPinError(null);
    const result = await setPin(examId, action, solutionId);
    setPinBusy(false);
    if (result.ok) {
      onPinnedChange?.(action === "pin");
      return;
    }
    setPinError(
      result.error.code === "rateLimited"
        ? t("profile.error.rateLimited", { seconds: result.error.seconds })
        : t("solutions.menu.pinError")
    );
  }

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
        aria-label={t("solutions.view.more")}
        onClick={() => setOpen((v) => !v)}
        className={buttonVariants({ variant: "plain", size: "icon" })}
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
            {isExamAuthor && (
              <button
                type="button"
                role="menuitem"
                aria-busy={pinBusy}
                onClick={() => handlePin(isPinned ? "unpin" : "pin")}
                className={ITEM_CLASS}
              >
                {pinBusy
                  ? t("common.processing")
                  : t(isPinned ? "solutions.menu.unpin" : "solutions.menu.pin")}
              </button>
            )}

            {isMine
              ? editHref && (
                  <Link role="menuitem" href={editHref} onClick={close} className={ITEM_CLASS}>
                    {t("solutions.menu.edit")}
                  </Link>
                )
              : iReported
                ? (
                    <button type="button" role="menuitem" aria-disabled="true" className={ITEM_CLASS}>
                      {t("solutions.menu.reported")}
                    </button>
                  )
                : (
                    <button type="button" role="menuitem" className={ITEM_CLASS}>
                      {t("solutions.menu.report")}
                    </button>
                  )}

            {pinError && (
              <p role="alert" className="text-destructive px-3 pb-1.5 text-xs leading-snug">
                {pinError}
              </p>
            )}
          </div>,
          document.body
        )}
    </div>
  );
}
