"use client";

// ScoreScale — radiogroup 10 ô điểm 1-10 cho Rating Page (academic-rubric
// redesign, thay CircleScale cũ). Roving tabindex: ô đang CHECKED có
// tabIndex=0 (checked follows focus — Arrow/Home/End vừa focus vừa select
// trong cùng thao tác); khi chưa có lựa chọn nào, ô 1 giữ tabIndex=0. Lựa
// chọn KHÔNG chỉ truyền đạt bằng màu (WCAG 1.4.1): ô checked có
// aria-checked="true" + font-semibold + viền đổi kiểu, không chỉ đổi màu nền.

import { useRef } from "react";
import { RATING_MAX, RATING_MIN, type PartScore } from "@/lib/rating";

interface ScoreScaleProps {
  value?: PartScore;
  onChange: (v: PartScore) => void;
  labelledBy: string;
}

const CIRCLES: PartScore[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => (i + RATING_MIN) as PartScore
);

export function ScoreScale({ value, onChange, labelledBy }: ScoreScaleProps) {
  const refs = useRef<Partial<Record<PartScore, HTMLButtonElement | null>>>({});
  const rovingValue = value ?? (RATING_MIN as PartScore);

  function selectAndFocus(next: PartScore) {
    onChange(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: PartScore) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown":
        e.preventDefault();
        selectAndFocus(
          current === RATING_MAX ? (RATING_MIN as PartScore) : ((current + 1) as PartScore)
        );
        break;
      case "ArrowLeft":
      case "ArrowUp":
        e.preventDefault();
        selectAndFocus(
          current === RATING_MIN ? (RATING_MAX as PartScore) : ((current - 1) as PartScore)
        );
        break;
      case "Home":
        e.preventDefault();
        selectAndFocus(RATING_MIN as PartScore);
        break;
      case "End":
        e.preventDefault();
        selectAndFocus(RATING_MAX as PartScore);
        break;
      case " ":
      case "Enter":
        e.preventDefault();
        if (value !== current) onChange(current);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1.5">
      {CIRCLES.map((n) => {
        const checked = value === n;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n] = el;
            }}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={String(n)}
            tabIndex={n === rovingValue ? 0 : -1}
            onClick={() => selectAndFocus(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm tabular-nums transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none motion-safe:active:scale-90 ${
              checked
                ? "border-brand bg-brand font-semibold text-brand-foreground"
                : "border-border text-foreground hover:border-brand"
            }`}
          >
            {n}
          </button>
        );
      })}
    </div>
  );
}
