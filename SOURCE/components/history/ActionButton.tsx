"use client";

// ActionButton — the single shared Save/Share atom (AC-007), consumed by
// ResultActions (Task 12). History's own row actions now go through
// HistoryRowMenu (front-adjust: merged ⋯ menu) instead, but both route
// through the identical usePdfAction hook (components/history/usePdfAction.ts) — no
// second PDF-generation call site.
//
// D4 a11y pattern (2nd application of RateButton.tsx's precedent, not yet a
// Rule-of-Three extraction): always focusable, never native `disabled` —
// aria-disabled + aria-describedby + Tooltip communicate busy/error/fallback
// state instead. Because aria-disabled does not itself block the DOM click
// event, usePdfAction's `busyRef` is the actual (synchronous) click-
// suppression mechanism (AC-010).
//
// D2 DOM-shape fix: the error/status feedback spans, AND the sr-only
// aria-describedby reason span, are all rendered as descendants of the
// button (position: absolute, anchored by the button's own position:
// relative) — never as Tooltip-level siblings of it. A prior revision left
// the reason span as a sibling (see the frontend DD's "ActionButton phase ->
// local DOM shape" table); that span had no positioned ancestor at all, so
// browsers fell back to positioning it at its *hypothetical static
// position* against the document root — inflating
// document.documentElement.scrollHeight by one row-height per rendered
// instance (harmless with 2 buttons on the Result page, but with 30+ rows on
// /history this produced several thousand px of invisible page height,
// i.e. the "infinite scroll" bug). Keeping every phase-dependent node inside
// the button's own `relative` box keeps ActionButton contributing exactly
// one in-flow node to its parent AND never leaks layout height to the page.
import { Download, Loader2, Share2 } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePdfAction } from "@/components/history/usePdfAction";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

const LABEL_KEY = { save: "common.save", share: "common.share" } as const satisfies Record<
  "save" | "share",
  MessageKey
>;
const ICON = { save: Download, share: Share2 } as const;

export interface ActionButtonProps {
  action: "save" | "share";
  pdfInput: AttemptPdfData;
  /** Unique per rendered instance — keeps the sr-only reason span's id unique across N HistoryRow instances. */
  idPrefix: string;
  /** Lý do KHÔNG xuất được, hoặc `null` khi xuất được (ADR-0018/AC-058).
   *
   *  BẮT BUỘC. Xem `usePdfAction` — một prop tuỳ chọn ở đây làm mọi call site
   *  mới mặc định KHÔNG bị chặn, và chế độ hỏng im lặng là để lọt một tệp PDF
   *  thiếu phần điểm tự luận. */
  blockedReason: string | null;
}

export function ActionButton({ action, pdfInput, idPrefix, blockedReason }: ActionButtonProps) {
  const t = useT();
  const { phase, run } = usePdfAction(action, pdfInput, blockedReason);
  const blocked = blockedReason !== null;
  const reasonId = `${idPrefix}-${action}-reason`;
  const Icon = ICON[action];
  const label = t(LABEL_KEY[action]);

  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={run}
        // KHÔNG BAO GIỜ thuộc tính `disabled` gốc, ở BẤT KỲ trạng thái nào
        // (UI-D5). Repo đã sửa đúng lỗi này HAI LẦN. `disabled` gỡ phần tử khỏi
        // thứ tự tab VÀ đẩy LÝ DO ra ngoài tầm với của trình đọc màn hình — đúng
        // hai thứ AC-058 muốn có. Idiom: focus được + `aria-disabled` (chuỗi) +
        // `aria-describedby` trỏ tới ô `sr-only` mang lý do.
        aria-disabled={blocked || phase === "busy" ? "true" : "false"}
        aria-busy={phase === "busy"}
        aria-describedby={reasonId}
        // `relative` is required — it anchors every absolutely-positioned descendant below (error/status text,
        // and the sr-only reason span) so none of them ever become extra in-flow siblings of this button, or —
        // worse, since they'd have no positioned ancestor at all — get positioned against the document root (D2).
        className="relative flex items-center justify-center rounded-xl border border-border bg-card px-3 py-4 text-brand transition-colors hover:border-brand/40"
      >
        {phase === "busy" ? (
          <Loader2 className="size-6 animate-spin" aria-hidden />
        ) : (
          <Icon className="size-6" aria-hidden />
        )}
        <span className="sr-only">{label}</span>
        {phase === "error" && (
          <span
            role="alert"
            className="text-brand absolute top-full left-1/2 z-10 mt-1 w-max max-w-40 -translate-x-1/2 text-center text-sm"
          >
            {t("history.pdfError")}
          </span>
        )}
        {phase === "fallback-confirmed" && action === "share" && (
          <span
            role="status"
            aria-live="polite"
            className="text-muted-foreground absolute top-full left-1/2 z-10 mt-1 w-max max-w-40 -translate-x-1/2 text-center text-sm"
          >
            {t("history.downloadedNoShare")}
          </span>
        )}
        {/* Descendant of the button (not a Tooltip-level sibling, see D2 above) — aria-describedby resolves it
            by id regardless of DOM containment, so this move has no a11y-semantics effect, only a layout one. */}
        <span id={reasonId} className="sr-only">
          {/* Lý do BỊ CHẶN thắng lý do BẬN: khi đang bị chặn thì không có lượt
              tạo tệp nào để mà bận. */}
          {blocked ? blockedReason : phase === "busy" ? t("history.generatingPdf") : ""}
        </span>
      </TooltipTrigger>
      <TooltipContent>{blocked ? blockedReason : label}</TooltipContent>
    </Tooltip>
  );
}
