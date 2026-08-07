"use client";

// EntryModeField — chọn Automatic/Manual. v2.2 (ADR-0007): control đã THÀNH
// THẬT (hết HIDDEN-FEATURES #2/#3) — Automatic: metadata để trống được, AI đọc
// từ trang 1 file đề, gate chuyển sang publish; Manual: hành vi v2.1 (nhập tay,
// validate trước mọi AI call). Đổi mode KHÔNG BAO GIỜ xoá giá trị đã gõ —
// giá trị tác giả gõ luôn thắng AI (normalizeMeta).

import { useState } from "react";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { EntryMode } from "@/lib/ugc/types";

export type { EntryMode };

const NOTE_KEY: Record<EntryMode, MessageKey> = {
  automatic: "upload.automaticNote",
  manual: "upload.manualNote",
};

export function EntryModeField({
  value,
  onChange,
  disabled,
}: {
  value: EntryMode;
  onChange: (mode: EntryMode) => void;
  disabled?: boolean;
}) {
  const t = useT();
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <label htmlFor="entry-mode" className="eyebrow block">
        {t("upload.entryMode")}
      </label>
      <div className="relative mt-1.5">
        <select
          id="entry-mode"
          value={value}
          onChange={(e) => onChange(e.target.value as EntryMode)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          className="w-full appearance-none rounded-[4px] border border-border bg-transparent px-3 py-2.5 text-sm text-foreground outline-none transition-colors duration-200 focus:border-ring disabled:opacity-60"
        >
          <option value="automatic">{t("upload.automatic")}</option>
          <option value="manual">{t("upload.manual")}</option>
        </select>
        <span
          aria-hidden
          className={[
            "pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-ring transition-transform duration-300",
            focused ? "rotate-180" : "",
          ].join(" ")}
        >
          ▾
        </span>
      </div>
      <p
        key={value}
        aria-live="polite"
        className="mt-1.5 animate-in fade-in slide-in-from-top-1 text-xs text-muted-foreground duration-[250ms]"
      >
        {t(NOTE_KEY[value])}
      </p>
    </div>
  );
}
