"use client";

// ScoreScale — radiogroup 5 SAO cho Rating Page (thang 1-5, thay thang số 1-10
// cũ). Roving tabindex: ô đang CHECKED có tabIndex=0 (checked follows focus —
// Arrow/Home/End vừa focus vừa select trong cùng thao tác); khi chưa có lựa
// chọn nào, sao 1 giữ tabIndex=0.
//
// Sao ĐÃ CHỌN tô đặc, sao chưa chọn chỉ có nét viền — khác nhau ở HÌNH DẠNG
// (fill vs stroke) chứ không chỉ ở màu, nên vẫn phân biệt được khi không nhận
// ra màu (WCAG 1.4.1). aria-checked + aria-label số sao lo phần trình đọc màn
// hình; hiệu ứng hover "sáng tới sao đang trỏ" cố ý CHỈ nằm ở CSS (peer-hover)
// để không cần thêm state cho một tín hiệu thuần thị giác.

import { useRef } from "react";
import { RATING_MAX, RATING_MIN, type PartScore } from "@/lib/rating";

interface ScoreScaleProps {
  value?: PartScore;
  onChange: (v: PartScore) => void;
  labelledBy: string;
}

const STARS: PartScore[] = Array.from(
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
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex justify-center gap-2">
      {STARS.map((n) => {
        const filled = value !== undefined && n <= value;
        return (
          <button
            key={n}
            ref={(el) => {
              refs.current[n] = el;
            }}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={String(n)}
            tabIndex={n === rovingValue ? 0 : -1}
            onClick={() => selectAndFocus(n)}
            onKeyDown={(e) => onKeyDown(e, n)}
            className={`shrink-0 rounded-sm p-0.5 transition-all duration-150 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none motion-safe:active:scale-90 ${
              filled ? "text-brand" : "text-muted-foreground hover:text-brand"
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              className="h-7 w-7 sm:h-8 sm:w-8"
              fill={filled ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            >
              <path d="M12 3.2l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.9-5.4 2.9 1-6L3.2 9.6l6.1-.9L12 3.2Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}
