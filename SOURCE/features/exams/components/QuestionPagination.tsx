// QuestionPagination — sidebar điều hướng giữa các câu (Layer 2). GĐ 3 M3.1 Task 2–3.
// Thẻ tô nền surface, mỗi câu một ô TRÒN — đang xem = viên vàng nắng chữ đen
// (cùng ngôn ngữ với ô đang chọn của BottomNav), đã làm = nền xanh chữ trắng,
// chưa làm = ô trắng chữ dịu; câu đánh dấu có chấm đen ở góc trên-phải.
// (Swipe cho mobile — UI-LAYER-MAP 8.2 — xử lý ở ExamPlayer.)
//
// KHÔNG có "use client" nhưng đây LÀ client component: nó nhận prop `onJump`
// là hàm, nên chỉ render được bên trong ranh giới client của ExamPlayer.
//
// HAI CHẾ ĐỘ theo số câu (bug prod 2026-08-17):
// Lưới 4 cột không giới hạn chiều cao chỉ ổn với đề seed ~5–12 câu. Đề thật
// 40 câu (Sinh 12) đẩy card lên 10 hàng ≈ 600px — dài hơn cả câu hỏi bên
// cạnh, và trên mobile thì nó chiếm trọn một màn hình phải cuộn qua. Từ
// COMPACT_THRESHOLD câu trở lên: dày hơn (5 cột) + trần chiều cao + tự cuộn
// câu đang xem vào tầm nhìn, kèm một dòng đếm tiến độ để phần bị cuộn khuất
// không làm mất thông tin "đã làm bao nhiêu".

import { useEffect, useRef } from "react";
import { t } from "@/lib/copy";
import { Card } from "@/components/ui/card";

/** Trên ngưỡng này thì đổi sang lưới dày + khung cuộn. */
const COMPACT_THRESHOLD = 10;

interface QuestionPaginationProps {
  current: number; // index 0-based của câu đang xem
  total: number;
  /** Các index đã có đáp án — đánh dấu "đã làm". */
  answeredIndices: number[];
  /** Các index được đánh dấu để xem lại (flag). */
  flaggedIndices: number[];
  onJump: (index: number) => void;
}

export function QuestionPagination({
  current,
  total,
  answeredIndices,
  flaggedIndices,
  onJump,
}: QuestionPaginationProps) {
  const answered = new Set(answeredIndices);
  const flagged = new Set(flaggedIndices);
  const compact = total > COMPACT_THRESHOLD;

  // Cuộn ô của câu đang xem vào tầm nhìn khi nó nằm ngoài khung. `block:
  // "nearest"` để khung chỉ nhích vừa đủ, không giật về giữa mỗi lần chuyển
  // câu; chỉ cuộn KHUNG này, không cuộn cả trang.
  const listRef = useRef<HTMLOListElement>(null);
  useEffect(() => {
    if (!compact) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-q="${current}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [current, compact]);

  return (
    <Card padding="none" className="gap-3.5 p-4 sm:p-5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold">{t("common.questions")}</span>
        {compact && (
          <span className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
            {t("player.answeredCount", { done: answered.size, total })}
          </span>
        )}
      </div>
      <nav>
        <ol
          ref={listRef}
          className={
            compact
              ? // max-h ≈ 4 hàng ô 5 cột: card tổng còn ~250px thay vì ~600px
                // với đề 40 câu, xấp xỉ chiều cao card câu hỏi bên cạnh.
                "grid max-h-[11rem] grid-cols-5 gap-2 overflow-y-auto pr-1"
              : "grid grid-cols-4 gap-2"
          }
        >
          {Array.from({ length: total }, (_, i) => {
            const isCurrent = i === current;
            const isAnswered = answered.has(i);
            const isFlagged = flagged.has(i);
            return (
              <li key={i}>
                <button
                  type="button"
                  data-q={i}
                  onClick={() => onJump(i)}
                  aria-current={isCurrent ? "true" : undefined}
                  aria-label={
                    t("upload.questionLabel", { number: i + 1 }) +
                    (isAnswered ? ` (${t("player.answeredStatus")})` : "") +
                    (isFlagged ? ` (${t("player.flagged")})` : "")
                  }
                  className={`focus-visible:ring-ring/40 relative flex aspect-square w-full items-center justify-center rounded-full font-semibold tabular-nums transition-colors focus-visible:ring-3 focus-visible:outline-none ${
                    compact ? "text-xs" : "text-sm"
                  } ${
                    isCurrent
                      ? "bg-sun text-foreground"
                      : isAnswered
                        ? "bg-primary text-primary-foreground hover:bg-[color-mix(in_oklch,var(--primary),black_10%)]"
                        : "bg-card text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {i + 1}
                  {isFlagged && (
                    <span
                      aria-hidden
                      className="bg-foreground ring-surface absolute top-0 right-0 size-2.5 rounded-full ring-2"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </Card>
  );
}
