// SubjectTimeDonut — "Thời gian luyện theo môn" (engineer chốt 2026-09-06).
//
// Vòng tròn chia lát theo TỔNG THỜI GIAN làm bài của mỗi môn (`seconds` —
// bắt đầu → nộp, cộng dồn các lượt đã nộp trong khoảng đang chọn); giữa vòng
// là tổng của mọi môn, chú giải là danh sách có kẻ chia (ngoại lệ được phép của
// "nền tô thay viền", §4.2) ghi thời gian từng môn dạng "1g23p", cùng thứ tự
// với lát (nhiều nhất trước, từ 12 giờ theo chiều kim đồng hồ).
//
// Thay cho vòng tròn "% số lượt làm bài theo môn" của bản trước: engineer nhận
// định con số % ấy không nói được gì với học sinh, còn "bạn đã dành 1g23p cho
// Toán tuần này" thì có. Vòng tròn cũng không còn là "cách nhìn khác" của
// biểu đồ cột (dải Cột/Tròn đã bỏ): hai biểu đồ trả lời hai câu hỏi khác nhau
// nên là hai thẻ đứng riêng.
//
// Màu môn cố định từ bảng "ngủ đông" (SUBJECT_COLORS): cùng môn cùng màu ở mọi
// khoảng. Khe 3 đơn vị giữa các lát để hai màu gần nhau (xương rồng / rong
// biển) không dính thành một; một lát duy nhất thì không khe — vòng kín.

import { t } from "@/lib/copy";
import { SUBJECT_COLORS, type SubjectStats } from "@/lib/analytics/constants";
import { formatDurationShort } from "@/lib/analytics/formatDuration";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";

const SIZE = 200;
const STROKE = 32;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SLICE_GAP = 3;

export function SubjectTimeDonut({ data }: { data: SubjectStats[] }) {
  const rows = [...data].sort((a, b) => b.seconds - a.seconds);
  const total = rows.reduce((sum, r) => sum + r.seconds, 0);
  const gap = rows.length > 1 ? SLICE_GAP : 0;

  // Điểm bắt đầu của mỗi lát = tổng phần của các lát đứng trước — gom bằng
  // reduce chứ không cộng dồn vào một biến ngoài (eslint react-hooks/immutability).
  const slices = rows.reduce<Array<{ subject: SubjectStats["subject"]; share: number; start: number }>>(
    (acc, r) => {
      const prev = acc[acc.length - 1];
      acc.push({
        subject: r.subject,
        share: total > 0 ? r.seconds / total : 0,
        start: prev ? prev.start + prev.share : 0,
      });
      return acc;
    },
    []
  );

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:gap-10">
      <svg
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        role="img"
        aria-label={t("analytics.donutAlt")}
        className="shrink-0"
      >
        <g transform={`translate(${SIZE / 2} ${SIZE / 2}) rotate(-90)`}>
          {slices.map((s) => {
            // Một lát duy nhất: vẽ vòng KÍN, không dùng dasharray — nét đứt
            // "C 0" vẫn để lại một vết nối mảnh ở 12 giờ (thấy trên ảnh 360px
            // 2026-09-06, khoảng Tuần một môn).
            if (slices.length === 1 && s.share > 0) {
              return (
                <circle
                  key={s.subject}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  style={{ stroke: SUBJECT_COLORS[s.subject] }}
                />
              );
            }
            const dash = Math.max(0, s.share * CIRCUMFERENCE - gap);
            return (
              <circle
                key={s.subject}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${dash} ${CIRCUMFERENCE - dash}`}
                strokeDashoffset={-(s.start * CIRCUMFERENCE)}
                style={{ stroke: SUBJECT_COLORS[s.subject] }}
              />
            );
          })}
        </g>
        <text
          x={SIZE / 2}
          y={SIZE / 2 - 4}
          textAnchor="middle"
          className="fill-foreground text-[28px] font-bold tabular-nums"
        >
          {formatDurationShort(total)}
        </text>
        <text
          x={SIZE / 2}
          y={SIZE / 2 + 18}
          textAnchor="middle"
          className="fill-muted-foreground text-[13px] font-medium"
        >
          {t("analytics.timeTotal")}
        </text>
      </svg>

      <ul className="divide-border w-full flex-1 divide-y">
        {rows.map((r) => (
          <li key={r.subject} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="inline-block size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: SUBJECT_COLORS[r.subject] }}
              />
              <span className="text-foreground">{SUBJECT_LABELS[r.subject]}</span>
            </span>
            <span className="text-foreground font-semibold tabular-nums">
              {formatDurationShort(r.seconds)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
