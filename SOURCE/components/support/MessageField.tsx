"use client";

// MessageField — textarea + đếm ký tự (UI-D5, ReportExam.tsx pattern).
// readOnly (không native disabled) trong lúc submitting — giữ được focus/
// discoverable cho AT, cùng chủ đích với RateButton's aria-disabled idiom.

import { LIMITS } from "@/lib/ugc/limits";
import { useT } from "@/lib/i18n/client";

interface MessageFieldProps {
  value: string;
  onChange: (value: string) => void;
  error: string | null;
  disabled: boolean;
}

export function MessageField({ value, onChange, error, disabled }: MessageFieldProps) {
  const t = useT();
  const errorId = "support-message-error";

  return (
    <div className="mt-4">
      <label htmlFor="support-message" className="text-foreground text-sm font-medium">
        {t("support.message.label")}
      </label>
      <textarea
        id="support-message"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={LIMITS.MAX_SUPPORT_MESSAGE}
        rows={4}
        readOnly={disabled}
        aria-disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        placeholder={t("support.message.placeholder")}
        className="border-border bg-card text-foreground focus:border-brand mt-2 w-full resize-none rounded-[4px] border p-3 text-sm outline-none aria-disabled:opacity-60"
      />
      <p className="text-muted-foreground mt-1 text-right text-xs">
        {t("support.message.count", { count: value.length, max: LIMITS.MAX_SUPPORT_MESSAGE })}
      </p>
      {error && (
        <p id={errorId} role="alert" className="text-brand mt-1 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
