"use client";

// HistoryRowMenu — front-adjust: consolidates HistoryRow's 3 separate
// controls (Save ActionButton, Share ActionButton, "View details" Link) into
// a single ⋯ trigger + dropdown menu, matching HeaderProfile.tsx's existing
// dropdown convention (scrim + role="menu" panel, ivory-on-border styling,
// mt-2 anchored top-full) rather than introducing a new menu primitive.
//
// Save/Share route through the same usePdfAction hook ActionButton uses
// (AC-007 single PDF pipeline) — each has its own busyRef instance, so
// triggering Save doesn't block Share and vice versa. Unlike ActionButton,
// busy/error/fallback text renders as normal in-flow content inside the menu
// item (not an absolutely-positioned overlay), so there's no D2-style
// phantom-position risk here at all — the menu item just grows.
import { ArrowUpRight, Download, Loader2, MoreHorizontal, Share2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePdfAction } from "@/components/history/usePdfAction";
import { useT } from "@/lib/i18n/client";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export interface HistoryRowMenuProps {
  pdfInput: AttemptPdfData;
  resultHref: string;
  /** Accessible name suffix ("More actions for <examTitle>") — disambiguates N triggers on one page. */
  examTitle: string;
}

export function HistoryRowMenu({ pdfInput, resultHref, examTitle }: HistoryRowMenuProps) {
  const t = useT();
  const [open, setOpen] = useState(false);
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

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t("history.moreActionsFor", { title: examTitle })}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-center rounded-xl border border-border bg-card p-3 text-brand transition-colors hover:border-brand/40"
      >
        <MoreHorizontal className="size-5" aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="border-border bg-card absolute top-full right-0 z-20 mt-2 w-56 rounded-md border p-1 shadow-sm"
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
        </div>
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
