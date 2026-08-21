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

  // Nhận bất kỳ sự kiện nào có toạ độ con trỏ — chuột LẪN chạm. Trước
  // 2026-08-07 hàm này khai `React.MouseEvent` và chỉ được gọi từ
  // `onMouseMove`, nên trên điện thoại toàn bộ tooltip là vùng chết: dòng gợi ý
  // ngay trên biểu đồ ghi "Rê chuột lên một môn để xem chi tiết" — một hướng
  // dẫn không thể làm theo bằng ngón tay (tài liệu §4.3: hiệu ứng hover phải
  // có đường tương đương khi chạm).
  function showTooltipAt(point: { clientX: number; clientY: number }, stat: SubjectStats) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip({
      x: point.clientX - rect.left,
      y: point.clientY - rect.top,
      containerWidth: rect.width,
      subject: stat.subject,
      correct: stat.correct,
      wrong: stat.wrong,
    });
  }

  // Chạm: bật chi tiết của nhóm được chạm; chạm LẠI đúng nhóm đó thì tắt.
  // Chỉ xử lý pointerType khác "mouse" — chuột đã có đường hover riêng, để cả
  // hai cùng chạy sẽ thành click-để-khoá lẫn hover-để-hiện tranh nhau.
  function handlePointerDown(e: React.PointerEvent, stat: SubjectStats) {
    if (e.pointerType === "mouse") return;
    if (hovered === stat.subject) {
      setHovered(null);
      setTooltip(null);
      return;
    }
    setHovered(stat.subject);
    showTooltipAt(e, stat);
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

        {/* overflow-x-auto + min-w: viewBox rộng 920 đơn vị, ép vừa 350px thì
            nhãn 12px co còn ~4,5px — có vẽ ra cũng không ai đọc được. Cho khối
            biểu đồ tự cuộn ngang trong khung của NÓ (không để cả trang cuộn
            ngang) là cách tài liệu khuyến nghị cho nội dung rộng; min-w-[560px]
            giữ nhãn ở cỡ đọc được. Từ 768px trở lên bỏ min-w để biểu đồ trải
            hết bề ngang card như cũ. */}
        <div className="-mx-1 mt-4 overflow-x-auto px-1 md:mx-0 md:overflow-x-visible md:px-0">
          <div ref={containerRef} className="relative min-w-[560px] md:min-w-0">
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
                  onMouseMove={(e) => showTooltipAt(e, stat)}
                  onPointerDown={(e) => handlePointerDown(e, stat)}
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
    </div>
  );
}
