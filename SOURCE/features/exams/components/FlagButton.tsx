// FlagButton — đánh dấu câu hiện tại để xem lại (Layer 2). GĐ 3 M3.1 Task 3.
// State sống trong useExamPlayer (in-memory session, không persist DB) — controlled
// qua props flagged/onToggle. Bordered pill + glyph + nhãn chữ (đồng bộ
// TEMPLATE/L2/ExamPage) — active = viền/chữ brand.
"use client";

import { useT } from "@/lib/i18n/client";

interface FlagButtonProps {
  flagged: boolean;
  onToggle: () => void;
}

export function FlagButton({ flagged, onToggle }: FlagButtonProps) {
  const t = useT();
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={flagged}
      title={flagged ? t("player.unflagHint") : t("player.flagHint")}
      className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium tracking-[0.04em] uppercase transition-colors ${
        flagged ? "border-brand text-brand" : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      <svg
        aria-hidden
        viewBox="0 0 16 16"
        className="size-3.5"
        fill={flagged ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      >
        <path d="M3.5 1.5v13" strokeLinecap="round" />
        <path d="M3.5 2.5h8.5l-2 3 2 3H3.5z" />
      </svg>
      <span>{flagged ? t("player.flagged") : t("player.flag")}</span>
    </button>
  );
}
