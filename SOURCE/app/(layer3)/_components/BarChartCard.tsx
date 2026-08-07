// BarChartCard — tab BAR của Analytics (Layer 3), UI-only pass. Bar chart tự
// vẽ bằng SVG (repo chưa có chart lib) theo docs/design/analytics-layer3-design.md.
// SVG dùng viewBox + w-full nên trải đều các nhóm cột theo bề ngang card (khớp
// design reference). Hidden features: tooltip bám chuột (#2), tag "NEEDS REVIEW"
// tự động khi accuracy < 75% (#3), trục Y "nice number" theo range (#4), dim
// nhóm khác khi hover 35%/200ms (#7).

"use client";
import { useT } from "@/lib/i18n/client";

import { useRef, useState, type ReactNode } from "react";
import { NEEDS_REVIEW_THRESHOLD, niceCeil, type SubjectStats } from "@/lib/fake-data/analytics";

// Hệ toạ độ nội bộ (viewBox) — SVG scale theo bề ngang card qua w-full.
const VB_WIDTH = 920;
const VB_HEIGHT = 300;
const PLOT_LEFT = 44; // chừa chỗ cho nhãn trục Y
const PLOT_TOP = 12;
const PLOT_BOTTOM = 250;
const PLOT_HEIGHT = PLOT_BOTTOM - PLOT_TOP;
const PLOT_WIDTH = VB_WIDTH - PLOT_LEFT;
const BAR_WIDTH = 22;
const BAR_GAP = 8;
const PAIR_WIDTH = BAR_WIDTH * 2 + BAR_GAP;

const CORRECT_COLOR = "#3E7A54";
const WRONG_COLOR = "#A62C2B";

type Tooltip = {
  x: number;
  y: number;
  containerWidth: number;
  subject: string;
  correct: number;
  wrong: number;
};

// Ngưỡng khoảng cách tới mép phải container để lật tooltip sang bên trái con trỏ,
// tránh bị ép hẹp bề ngang (shrink-to-fit width bị giới hạn bởi available space).
const TOOLTIP_FLIP_THRESHOLD = 140;

export function BarChartCard({
  data,
  filterSlot,
  highlightWeakest = true,
}: {
  data: SubjectStats[];
  filterSlot: ReactNode;
  highlightWeakest?: boolean;
}) {
  const t = useT();
  const [hovered, setHovered] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<Tooltip | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const rawMax = Math.max(1, ...data.flatMap((d) => [d.correct, d.wrong]));
  const niceMax = niceCeil(rawMax);
  // Gridline đều nhau 0 → niceMax, làm tròn về số nguyên (khớp reference: với
  // niceMax 90 → 0/23/45/68/90; với 25 → 0/6/13/19/25).
  const ticks = [4, 3, 2, 1, 0].map((i) => Math.round((niceMax * i) / 4));

  const slotWidth = PLOT_WIDTH / data.length;

  function scaleY(value: number) {
    return PLOT_TOP + (1 - value / niceMax) * PLOT_HEIGHT;
  }

  function handleMouseMove(e: React.MouseEvent, stat: SubjectStats) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      containerWidth: rect.width,
      subject: stat.subject,
      correct: stat.correct,
      wrong: stat.wrong,
    });
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-foreground font-serif text-2xl">{t("analytics.barTitle")}</h2>
          <p className="text-muted-foreground mt-1 text-sm">{t("analytics.barHint")}</p>
        </div>
        {filterSlot}
      </div>

      <div className="border-border bg-card mt-4 rounded-md border p-5">
        <div className="flex justify-end">
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span
                className="inline-block h-2.5 w-2.5"
                style={{ backgroundColor: CORRECT_COLOR }}
              />
              <span className="text-muted-foreground tracking-wide uppercase">{t("common.correct")}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5" style={{ backgroundColor: WRONG_COLOR }} />
              <span className="text-muted-foreground tracking-wide uppercase">{t("common.wrong")}</span>
            </span>
          </div>
        </div>

        <div ref={containerRef} className="relative mt-4">
          <svg
            role="img"
            aria-label={t("analytics.barAlt")}
            viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
            preserveAspectRatio="xMidYMid meet"
            className="h-auto w-full"
          >
            {ticks.map((t) => {
              const y = scaleY(t);
              return (
                <g key={t}>
                  <line
                    x1={PLOT_LEFT}
                    x2={VB_WIDTH}
                    y1={y}
                    y2={y}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeDasharray="4 4"
                  />
                  <text
                    x={PLOT_LEFT - 10}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground font-sans text-[12px] tabular-nums"
                  >
                    {t}
                  </text>
                </g>
              );
            })}

            {data.map((stat, i) => {
              const slotX = PLOT_LEFT + i * slotWidth;
              const pairStart = slotX + (slotWidth - PAIR_WIDTH) / 2;
              const centerX = slotX + slotWidth / 2;
              const isDimmed = hovered !== null && hovered !== stat.subject;
              const accuracy =
                stat.correct + stat.wrong > 0 ? stat.correct / (stat.correct + stat.wrong) : 1;
              const needsReview = highlightWeakest && accuracy < NEEDS_REVIEW_THRESHOLD;
              const correctY = scaleY(stat.correct);
              const wrongY = scaleY(stat.wrong);

              return (
                <g
                  key={stat.subject}
                  className="transition-opacity duration-200"
                  style={{ opacity: isDimmed ? 0.35 : 1 }}
                  onMouseEnter={() => setHovered(stat.subject)}
                  onMouseLeave={() => {
                    setHovered(null);
                    setTooltip(null);
                  }}
                  onMouseMove={(e) => handleMouseMove(e, stat)}
                >
                  <rect
                    x={slotX}
                    y={PLOT_TOP}
                    width={slotWidth}
                    height={PLOT_HEIGHT}
                    fill="transparent"
                  />
                  <rect
                    x={pairStart}
                    y={correctY}
                    width={BAR_WIDTH}
                    height={PLOT_BOTTOM - correctY}
                    fill={CORRECT_COLOR}
                  />
                  <rect
                    x={pairStart + BAR_WIDTH + BAR_GAP}
                    y={wrongY}
                    width={BAR_WIDTH}
                    height={PLOT_BOTTOM - wrongY}
                    fill={WRONG_COLOR}
                  />
                  <text
                    x={centerX}
                    y={PLOT_BOTTOM + 20}
                    textAnchor="middle"
                    className="fill-foreground font-sans text-[12px]"
                  >
                    {stat.subject}
                  </text>
                  {needsReview && (
                    <text
                      x={centerX}
                      y={PLOT_BOTTOM + 36}
                      textAnchor="middle"
                      className="fill-[#A62C2B] font-sans text-[10px] font-semibold tracking-wide uppercase"
                    >
                      {t("analytics.needsReview")}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {tooltip && (
            <div
              className="border-border bg-foreground text-background pointer-events-none absolute z-10 w-max rounded-sm border px-2 py-1 font-sans text-xs whitespace-nowrap"
              style={
                tooltip.x > tooltip.containerWidth - TOOLTIP_FLIP_THRESHOLD
                  ? { right: tooltip.containerWidth - tooltip.x + 12, top: tooltip.y - 12 }
                  : { left: tooltip.x + 12, top: tooltip.y - 12 }
              }
            >
              <div className="font-medium">{tooltip.subject}</div>
              <div>
                {t("common.correct")}: {tooltip.correct}
              </div>
              <div>
                {t("common.wrong")}: {tooltip.wrong}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
