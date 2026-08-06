// ExamPlayer — phần client của Exam Player (Layer 2). GĐ 3 M3.1 Task 2–3.
// Giữ state làm bài qua useExamPlayer (useReducer — tracer code M1.5): câu, đáp án, flag.
// Nộp bài gọi submitExam() Server Action (batch on submit, Q2=A) — action tự redirect.
// Task 3: ExamTimer đếm ngược → hết giờ auto-submit (PA A); FlagButton đánh dấu câu.
// Layout đồng bộ TEMPLATE/L2/ExamPage (redesign UI-only — logic/hooks giữ nguyên):
// header (tên đề + đồng hồ + nút Nộp bài) → 2 cột (card câu hỏi trái, sidebar
// điều hướng phải). SiteHeader (navbar) vẫn từ (layer2)/layout.tsx.
// M3.2 Task 1: mobile vuốt trái/phải chuyển câu (useSwipe); desktop dùng phím ← → .
"use client";

import { useEffect, useRef, useTransition } from "react";
import { submitExam } from "@/app/(layer2)/actions";
import { useT } from "@/lib/i18n/client";
import { ExamTimer } from "./ExamTimer";
import { LeaveExamDialog } from "./LeaveExamDialog";
import { QuestionRenderer } from "./QuestionRenderer";
import { QuestionPagination } from "./QuestionPagination";
import { useExamPlayer } from "@/hooks/useExamPlayer";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useSwipe } from "@/hooks/useSwipe";
import type { PublicQuestion } from "@/types/question";

interface ExamPlayerProps {
  attemptId: string;
  examTitle: string;
  durationMinutes: number;
  questions: PublicQuestion[];
  /** Tiêu đề các PHẦN (đề chuẩn 2025, v2.1) — hiện nhãn phần của câu hiện tại. */
  parts?: { number: number; title: string }[];
}

export function ExamPlayer({
  attemptId,
  examTitle,
  durationMinutes,
  questions,
  parts,
}: ExamPlayerProps) {
  const t = useT();
  const { current, answers, flags, selectAnswer, toggleFlag, goto, next, prev } = useExamPlayer(
    questions.length
  );
  const [submitting, startSubmit] = useTransition();
  const submittedRef = useRef(false);

  // S#28: cảnh báo rời trang khi đang làm bài — chặn click nav trong app
  // (modal tuỳ biến) + refresh/đóng tab (beforeunload). Tắt khi đang submit
  // để không tự chặn luồng redirect sang /result.
  const { pendingHref, cancelLeave, confirmLeave } = useLeaveGuard(!submitting);

  // S#26: chọn đáp án → tự chuyển câu tiếp theo sau delay ngắn (user kịp thấy
  // selection). Ref + clear chống dồn timeout khi đổi đáp án nhanh; câu cuối
  // không nhảy (reducer NEXT đã clamp).
  const advanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (advanceRef.current) clearTimeout(advanceRef.current);
    },
    []
  );

  // Mobile: vuốt trái → câu sau, vuốt phải → câu trước (gắn lên vùng đọc câu hỏi).
  const swipe = useSwipe({ onSwipeLeft: next, onSwipeRight: prev });

  // Desktop: phím ← → chuyển câu. Bỏ qua khi focus đang ở ô chọn đáp án (radio)
  // để mũi tên vẫn dùng để chọn A/B/C/D theo hành vi gốc của radio group.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, prev]);

  const question = questions[current];

  // v2.1: nhãn PHẦN của câu hiện tại (đề nhiều phần) — trên card câu hỏi.
  const multiPart = (parts?.length ?? 0) > 0 || questions.some((q) => (q.partNumber ?? 1) !== 1);
  const currentPartTitle = multiPart
    ? (parts?.find((p) => p.number === (question.partNumber ?? 1))?.title ??
      `Phần ${question.partNumber ?? 1}`)
    : null;

  const answeredIndices = questions.map((q, i) => (answers[q.id] ? i : -1)).filter((i) => i >= 0);
  const flaggedIndices = questions.map((q, i) => (flags[q.id] ? i : -1)).filter((i) => i >= 0);

  // Nộp bài — chống gọi trùng (nút thủ công + auto-submit hết giờ).
  function submit() {
    if (submittedRef.current) return;
    submittedRef.current = true;
    startSubmit(async () => {
      await submitExam(attemptId, answers);
    });
  }

  return (
    <div className="bg-background">
      {/* S#28: modal xác nhận rời trang (mở khi guard chặn một click nav). */}
      <LeaveExamDialog open={pendingHref !== null} onCancel={cancelLeave} onLeave={confirmLeave} />

      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-6 py-10">
        {/* Header — tên đề (trái) · đồng hồ + nút Nộp bài (phải). Không sticky:
            khu vực trả lời đã tự cuộn trong khung 238px (QuestionRenderer) nên
            trang hiếm khi cần cuộn dài. preload order 1 — fade sau navbar (S#21). */}
        <div
          className="preload-fade flex flex-wrap items-end justify-between gap-4"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
          <div>
            <h1 className="text-foreground font-serif text-2xl font-semibold sm:text-3xl">
              {examTitle}
            </h1>
            <div className="bg-ring mt-3 h-0.5 w-10" />
          </div>
          <div className="flex items-center gap-4">
            <div className="border-border min-w-[130px] rounded-md border px-4 py-2 text-center">
              <span className="eyebrow block">{t("player.timeRemaining")}</span>
              <ExamTimer durationMinutes={durationMinutes} onTimeUp={submit} />
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="bg-brand text-brand-foreground rounded-md px-5 py-3 text-xs font-medium tracking-[0.04em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {submitting ? t("player.submitting") : t("player.submit")}
            </button>
          </div>
        </div>

        {/* Khu vực chính — card câu hỏi (trái) + sidebar điều hướng (phải).
            preload order 2 (S#21). */}
        <div
          className="preload-fade flex flex-wrap items-start gap-6"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          {/* Vùng đọc câu hỏi — bắt cử chỉ vuốt ngang để chuyển câu trên mobile. */}
          <div
            className="min-w-0 flex-1 basis-[480px]"
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            {currentPartTitle && (
              <p className="eyebrow mb-3" aria-live="polite">
                {currentPartTitle}
              </p>
            )}
            <QuestionRenderer
              index={current + 1}
              question={question}
              selectedAnswer={answers[question.id]}
              onSelectAnswer={(value) => {
                selectAnswer(question.id, value);
                // Tự chuyển câu CHỈ với mcq (chọn 1 lần là xong); true_false/
                // short_answer nhập nhiều lần — tự nhảy sẽ phá dở input (v2.1).
                if ((question.questionType ?? "mcq") === "mcq") {
                  if (advanceRef.current) clearTimeout(advanceRef.current);
                  advanceRef.current = setTimeout(next, 250);
                }
              }}
              flagged={Boolean(flags[question.id])}
              onToggleFlag={() => toggleFlag(question.id)}
            />

            <div className="border-border mt-4 flex items-center justify-between border-t pt-4">
              <button
                type="button"
                onClick={prev}
                disabled={current === 0}
                className="border-border text-foreground hover:border-ring disabled:hover:border-border rounded-md border px-4 py-2.5 text-xs font-medium tracking-[0.04em] uppercase transition-colors disabled:cursor-default disabled:opacity-40"
              >
                ← Previous
              </button>
              <button
                type="button"
                onClick={next}
                disabled={current === questions.length - 1}
                className="border-border text-foreground hover:border-ring disabled:hover:border-border rounded-md border px-4 py-2.5 text-xs font-medium tracking-[0.04em] uppercase transition-colors disabled:cursor-default disabled:opacity-40"
              >
                {t("common.next")}
              </button>
            </div>
          </div>

          <div className="w-full basis-[260px] sm:w-auto sm:min-w-[240px]">
            <QuestionPagination
              current={current}
              total={questions.length}
              answeredIndices={answeredIndices}
              flaggedIndices={flaggedIndices}
              onJump={goto}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
