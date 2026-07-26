"use client";

// CircleScale — radiogroup 10 vòng tròn 1-10 (Rating System, UI Spec Component:
// CircleScale). Roving tabindex: vòng đang CHECKED có tabIndex=0 (checked follows
// focus — Arrow/Home/End vừa focus vừa select trong cùng thao tác); khi chưa có
// lựa chọn nào, vòng 1 giữ tabIndex=0 (group entered at the start). Vì vậy không
// cần state "focus rời" tách biệt khỏi `value` — vị trí roving LUÔN suy ra được
// từ value (hoặc RATING_MIN khi value undefined).
// Lựa chọn KHÔNG chỉ truyền đạt bằng màu (WCAG 1.4.1): vòng checked có
// aria-checked="true" + dấu check hiển thị + font-bold, không chỉ đổi màu nền.

import { useRef } from "react";
import { RATING_MAX, RATING_MIN, type PartScore } from "@/lib/rating";

interface CircleScaleProps {
  name: string;
  value?: PartScore;
  onChange: (v: PartScore) => void;
  labelledBy: string;
}

const CIRCLES: PartScore[] = Array.from(
  { length: RATING_MAX - RATING_MIN + 1 },
  (_, i) => (i + RATING_MIN) as PartScore
);

export function CircleScale({ name, value, onChange, labelledBy }: CircleScaleProps) {
  const refs = useRef<Partial<Record<PartScore, HTMLButtonElement | null>>>({});
  // Vị trí roving-tabindex hiện tại: vòng đã checked, hoặc vòng 1 nếu chưa chọn gì.
  const rovingValue = value ?? (RATING_MIN as PartScore);

  function selectAndFocus(next: PartScore) {
    onChange(next);
    refs.current[next]?.focus();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, current: PartScore) {
    switch (e.key) {
      case "ArrowRight":
      case "ArrowDown": {
        e.preventDefault();
        selectAndFocus(
          current === RATING_MAX ? (RATING_MIN as PartScore) : ((current + 1) as PartScore)
        );
        break;
      }
      case "ArrowLeft":
      case "ArrowUp": {
        e.preventDefault();
        selectAndFocus(
          current === RATING_MIN ? (RATING_MAX as PartScore) : ((current - 1) as PartScore)
        );
        break;
      }
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
        // No-op if already checked (spec) — chỉ gọi onChange khi khác value hiện tại.
        if (value !== current) onChange(current);
        break;
      default:
        break;
    }
  }

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
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
            data-name={name}
            onClick={() => selectAndFocus(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full border text-sm tabular-nums transition-colors focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--sidebar)] focus-visible:outline-none ${
              checked
                ? "border-[color:var(--sidebar-accent)] bg-[color:var(--sidebar-accent)] font-bold text-[color:var(--sidebar-accent-foreground)]"
                : "border-[rgb(237_225_200_/_0.3)] text-[var(--sidebar-foreground)]"
            }`}
          >
            {n}
            {/* Dấu mốc phi-màu-sắc (WCAG 1.4.1) — ĐI KÈM viền/nền đổi màu +
                font-bold, không thay số để người dùng vẫn thấy giá trị đã chọn. */}
            {checked && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[var(--sidebar)] text-[8px] leading-none text-[color:var(--sidebar-accent)]"
              >
                ✓
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
