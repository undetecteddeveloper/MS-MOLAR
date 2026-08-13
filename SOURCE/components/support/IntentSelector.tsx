"use client";

// IntentSelector — radiogroup-equivalent 3 lựa chọn cố định (AC-001). KHÔNG
// có lựa chọn thứ 4 dưới bất kỳ hình thức nào — đúng bằng độ dài INTENTS.

import type { TicketIntent } from "@/lib/support/types";
import type { MessageKey } from "@/lib/i18n/translate";
import { useT } from "@/lib/i18n/client";

const INTENTS: readonly TicketIntent[] = ["bug", "suggestion", "question"];

const LABEL_KEY: Record<TicketIntent, MessageKey> = {
  bug: "support.intent.bug",
  suggestion: "support.intent.suggestion",
  question: "support.intent.question",
};

interface IntentSelectorProps {
  value: TicketIntent | null;
  onChange: (intent: TicketIntent) => void;
  error: string | null;
  disabled: boolean;
}

export function IntentSelector({ value, onChange, error, disabled }: IntentSelectorProps) {
  const t = useT();
  const errorId = "support-intent-error";

  return (
    <div>
      <span id="support-intent-label" className="text-foreground text-sm font-medium">
        {t("support.intent.groupLabel")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby="support-intent-label"
        aria-describedby={error ? errorId : undefined}
        className="mt-2 flex gap-2"
      >
        {INTENTS.map((intent) => (
          <button
            key={intent}
            type="button"
            role="radio"
            aria-checked={value === intent}
            aria-disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(intent);
            }}
            className={[
              "flex-1 rounded-[4px] border px-3 py-2 text-sm transition-colors",
              value === intent
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border bg-card text-foreground hover:bg-accent",
            ].join(" ")}
          >
            {t(LABEL_KEY[intent])}
          </button>
        ))}
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-brand mt-2 text-sm">
          {error}
        </p>
      )}
    </div>
  );
}
