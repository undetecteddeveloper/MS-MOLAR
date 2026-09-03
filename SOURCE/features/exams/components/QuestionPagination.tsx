// QuestionPagination — sidebar điều hướng giữa các câu (Layer 2). GĐ 3 M3.1 Task 2–3.
// Đồng bộ TEMPLATE/L2/ExamPage: card hairline bo góc 8px, mỗi câu một ô vuông —
// đang xem = viền 2px accent, đã làm = nền brand, chưa làm = hairline; câu đánh
// dấu có chấm nhỏ ở góc trên-phải.
// (Swipe cho mobile — UI-LAYER-MAP 8.2 — xử lý ở ExamPlayer.)
//
// KHÔNG có "use client" nhưng đây LÀ client component: nó nhận prop `onJump`
// là hàm, nên chỉ render được bên trong ranh giới client của ExamPlayer. Vì
// vậy phải tra từ điển bằng `useT()`, không dùng `getTranslate()` của server.
//
// HAI CHẾ ĐỘ theo số câu (bug prod 2026-08-17):
// Lưới 4 cột không giới hạn chiều cao chỉ ổn với đề seed ~5–12 câu. Đề thật
// 40 câu (Sinh 12) đẩy card lên 10 hàng ≈ 600px — dài hơn cả câu hỏi bên
// cạnh, và trên mobile thì nó chiếm trọn một màn hình phải cuộn qua. Từ
// COMPACT_THRESHOLD câu trở lên: dày hơn (5 cột) + trần chiều cao + tự cuộn
// câu đang xem vào tầm nhìn, kèm một dòng đếm tiến độ để phần bị cuộn khuất
// không làm mất thông tin "đã làm bao nhiêu".

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";

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
  const t = useT();
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
    <div className="border-border rounded-lg border p-5">
      <div className="mb-3.5 flex items-baseline justify-between gap-3">
        <span className="eyebrow">{t("common.questions")}</span>
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
                  className={`relative flex aspect-square w-full items-center justify-center rounded tabular-nums transition-colors ${
                    compact ? "text-xs" : "text-sm"
                  } ${
                    isCurrent
                      ? "border-ring text-foreground border-2"
                      : isAnswered
                        ? "bg-brand text-brand-foreground border border-transparent hover:opacity-90"
                        : "border-border text-muted-foreground hover:border-ring/50 hover:text-foreground border"
                  }`}
                >
                  {i + 1}
                  {isFlagged && (
                    <span
                      aria-hidden
                      className="bg-ring ring-background absolute -top-1 -right-1 size-2 rounded-full ring-2"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}
