"use client";

// QuestionJumpDock — dải dính đỉnh của màn sửa đề + bảng nhảy tới câu (engineer
// 2026-09-13): màn này dài như màn làm bài (tới 50 thẻ câu) và tác giả cũng
// cần đi tới một câu cụ thể liên tục (câu báo lỗi, câu vừa soát dở). Dải dính
// ngay dưới navbar (`top-15`: navbar 60px hiện ở mọi bề rộng trên route này)
// mang tên đề + nút mở bảng; bảng thả xuống góc phải, cùng khuôn với
// QuestionPaletteDock của màn làm bài (scrim qua portal, usePresence, Escape).
//
// Không đụng góc dưới phải: PointsPanel (fixed, z-30) và PublishBar (sticky
// đáy, z-20) ở đó — bảng này thả từ ĐỈNH, cao tối đa nửa màn hình.
//
// Ô câu: số câu TRONG PHẦN (định danh layer 4 là cặp (part, number), ADR-0005)
// nên bảng chia theo phần, mỗi phần một lưới. Câu có lỗi tô đỏ + "Cần sửa" cho
// trình đọc màn hình. Chọn câu = cuộn thẻ `#p{part}q{number}` lên đỉnh
// (`scroll-mt-24` của thẻ đã chừa navbar + dải này) và dời focus vào thẻ.

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { LayoutGrid } from "lucide-react";
import type { AssembledQuestion, ExtractedPart } from "@/lib/ugc/types";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { chipVariants } from "@/components/ui/chip";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";
import { partNumbersOf } from "@/features/authoring/components/AssembledQuestionList";

interface QuestionJumpDockProps {
  title: string;
  questions: AssembledQuestion[];
  parts: ExtractedPart[];
  /** Khoá `${part}:${number}` của câu đang có lỗi — `questionErrorKeys()`. */
  errorKeys: Set<string>;
}

export function QuestionJumpDock({ title, questions, parts, errorKeys }: QuestionJumpDockProps) {
  const [open, setOpen] = useState(false);
  const { present, closing } = usePresence(open, POP_EXIT_MS);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Đề rỗng: không có câu nào để nhảy tới — ExtractionErrorPanel đã nói hộ.
  if (questions.length === 0) return null;

  const partNumbers = partNumbersOf(questions);
  const titleByPart = new Map(parts.map((p) => [p.number, p.title]));
  const errorCount = errorKeys.size;

  function jumpTo(part: number, number: number) {
    setOpen(false);
    const el = document.getElementById(`p${part}q${number}`);
    if (!el) return;
    el.scrollIntoView({ block: "start", behavior: "smooth" });
    // Thẻ mang tabIndex={-1} (QuestionEditor) nên nhận được focus; không cuộn
    // lần hai vì scrollIntoView vừa làm việc đó.
    el.focus({ preventScroll: true });
  }

  return (
    <div className="bg-background/95 border-border sticky top-15 z-20 -mx-4 flex items-center justify-between gap-3 border-b px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
      <p className="text-foreground min-w-0 flex-1 truncate text-sm font-semibold">{title}</p>

      <div className="relative shrink-0">
        <button
          ref={triggerRef}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          aria-label={t("common.questionPalette")}
          onClick={() => setOpen((v) => !v)}
          className={cn(chipVariants({ active: open }), "gap-1.5 px-3 tabular-nums")}
        >
          <LayoutGrid aria-hidden className="size-4" />
          <span>{questions.length}</span>
          {/* Chấm đỏ = còn câu cần sửa; con số cụ thể nằm trong bảng. */}
          {errorCount > 0 && <span aria-hidden className="bg-destructive size-2 rounded-full" />}
        </button>

        {present &&
          createPortal(
            <button
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />,
            document.body
          )}

        {present && (
          <section
            id={panelId}
            aria-label={t("common.questionPalette")}
            data-closing={closing ? "" : undefined}
            inert={closing || undefined}
            style={{ transformOrigin: "top right" }}
            className="motion-pop border-border bg-popover absolute top-full right-0 z-20 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-xl border p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold">{t("common.questions")}</span>
              {errorCount > 0 && (
                <span className="text-destructive text-xs font-semibold">
                  {t("status.needsFixingCount", { count: errorCount })}
                </span>
              )}
            </div>
            <div className="mt-3 flex max-h-[min(50vh,22rem)] flex-col gap-3 overflow-y-auto pr-1">
              {partNumbers.map((pn) => (
                <div key={pn}>
                  {partNumbers.length > 1 && (
                    <p className="eyebrow mb-1.5 truncate">
                      {titleByPart.get(pn) ?? t("upload.partLabel", { part: pn })}
                    </p>
                  )}
                  <ol className="grid grid-cols-5 gap-2">
                    {questions
                      .filter((q) => q.part === pn)
                      .map((q) => {
                        const hasError = errorKeys.has(`${q.part}:${q.number}`);
                        return (
                          <li key={q.number}>
                            <button
                              type="button"
                              onClick={() => jumpTo(q.part, q.number)}
                              aria-label={
                                t("upload.questionLabel", { number: q.number }) +
                                (hasError ? ` (${t("status.needsFixing")})` : "")
                              }
                              className={cn(
                                "focus-visible:ring-ring/40 flex aspect-square w-full items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-[color,background-color,scale] ease-out motion-safe:active:scale-90 focus-visible:ring-3 focus-visible:outline-none",
                                hasError
                                  ? "bg-destructive text-primary-foreground"
                                  : "bg-surface text-muted-foreground hover:text-foreground"
                              )}
                            >
                              {q.number}
                            </button>
                          </li>
                        );
                      })}
                  </ol>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
