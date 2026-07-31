// DonutChartCard — tab DONUT của Analytics (Layer 3), UI-only pass. Donut tự
// vẽ bằng SVG (stroke-dasharray theo segment) theo
// docs/design/analytics-layer3-design.md. Màu cố định theo môn (hidden feature
// #5, SUBJECT_COLORS) — ổn định qua mọi tab/filter. Segment + legend sort theo
// % giảm dần (khớp design reference), legend trải hết bề ngang, có kẻ hairline
// giữa các dòng.

"use client";

import type { ReactNode } from "react";
import {
  SUBJECT_COLORS,
  computeShares,
  type Subject,
  type SubjectStats,
} from "@/lib/fake-data/analytics";

const SIZE = 200;
const STROKE = 34;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

// Hidden feature #6: donutHighlightCount đã có plumbing cho kiểu hiển thị
// "top N nổi bật, còn lại mờ", nhưng đang tắt (feedback yêu cầu bỏ dim) —
// mọi segment render full-opacity cho tới khi bật lại.
const DIMMING_ENABLED = false;

export function DonutChartCard({
  data,
  rangeLabel,
  filterSlot,
  donutHighlightCount = 1,
}: {
  data: SubjectStats[];
  rangeLabel: string;
  filterSlot: ReactNode;
  donutHighlightCount?: number;
}) {
  // Sort giảm dần theo % — donut segment bắt đầu từ 12h theo chiều kim đồng hồ,
  // legend liệt kê cùng thứ tự (khớp design reference).
  const shares = [...computeShares(data)].sort((a, b) => b.pct - a.pct);
  const top = shares[0];

  const segments = shares.reduce<Array<{ subject: Subject; pct: number; cumulative: number }>>(
    (acc, s) => {
      const cumulative = acc.length > 0 ? acc[acc.length - 1].cumulative + acc[acc.length - 1].pct : 0;
      acc.push({ subject: s.subject, pct: s.pct, cumulative });
      return acc;
    },
    [],
  );

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-serif text-2xl text-foreground">Most Frequently Practiced Subject</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            % share of practice sessions by subject, this {rangeLabel.toLowerCase()}
          </p>
        </div>
        {filterSlot}
      </div>

      <div className="mt-4 rounded-md border border-border bg-card p-5">
        <div className="flex flex-col items-center gap-10 sm:flex-row">
          <svg
            width={SIZE}
            height={SIZE}
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label="Practice session share by subject"
            className="shrink-0"
          >
            <g transform={`translate(${SIZE / 2}, ${SIZE / 2}) rotate(-90)`}>
              {segments.map((s, i) => {
                const dash = (s.pct / 100) * CIRCUMFERENCE;
                const offset = -((s.cumulative / 100) * CIRCUMFERENCE);
                const opacity = !DIMMING_ENABLED || i < donutHighlightCount ? 1 : 0.4;
                return (
                  <circle
                    key={s.subject}
                    r={RADIUS}
                    cx={0}
                    cy={0}
                    fill="none"
                    stroke={SUBJECT_COLORS[s.subject]}
                    strokeWidth={STROKE}
                    strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                    strokeDashoffset={offset}
                    opacity={opacity}
                  />
                );
              })}
            </g>
            <text
              x={SIZE / 2}
              y={SIZE / 2 - 6}
              textAnchor="middle"
              className="fill-brand font-serif text-2xl font-medium"
            >
              {top.pct}%
            </text>
            <text
              x={SIZE / 2}
              y={SIZE / 2 + 16}
              textAnchor="middle"
              className="fill-foreground font-sans text-xs uppercase tracking-wide"
            >
              {top.subject}
            </text>
          </svg>

          <ul className="w-full flex-1 divide-y divide-border">
            {shares.map((s) => (
              <li key={s.subject} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="flex items-center gap-2.5">
                  <span
                    className="inline-block h-2.5 w-2.5"
                    style={{ backgroundColor: SUBJECT_COLORS[s.subject] }}
                  />
                  <span className="text-foreground">{s.subject}</span>
                </span>
                <span className="text-muted-foreground tabular-nums">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
