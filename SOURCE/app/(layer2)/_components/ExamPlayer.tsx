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
import { PageContainer } from "@/components/layout/PageContainer";

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

      {/* `full` (72rem = 1152px) thay số ma thuật max-w-[1100px] cũ — chênh
          52px, không đổi bố cục, nhưng màn làm bài không còn là bề rộng ngoại
          lệ duy nhất của app và mép nội dung thẳng hàng mép navbar. */}
      <PageContainer as="main" size="full" className="flex flex-col gap-6">
        {/* Header — tên đề (trái) · đồng hồ + nút Nộp bài (phải). Không sticky:
            khu vực trả lời đã tự cuộn trong khung 238px (QuestionRenderer) nên
            trang hiếm khi cần cuộn dài. preload order 1 — fade sau navbar (S#21). */}
        {/* Dưới 768px khối này DÍNH ĐỈNH (dưới navbar h-15) và nén lại: đồng hồ
            đếm ngược là thông tin phải nhìn thấy LIÊN TỤC trong một bài thi có
            giờ, nhưng trước thay đổi này nó cuộn mất ngay khi người dùng bắt
            đầu đọc câu hỏi đầu tiên. Tiêu đề đề rút còn một dòng (`truncate`)
            để dải sticky không ăn quá nhiều chiều cao — ở 360×800 mỗi 40px giữ
            lại là một dòng câu hỏi đọc được thêm. */}
        <div
          className="preload-fade flex flex-wrap items-end justify-between gap-4 max-md:bg-background/95 max-md:sticky max-md:top-15 max-md:z-20 max-md:-mx-4 max-md:items-center max-md:gap-2 max-md:px-4 max-md:py-2 max-md:backdrop-blur"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
          <div className="min-w-0 max-md:flex-1">
            <h1 className="text-foreground font-serif text-2xl font-semibold max-md:truncate max-md:text-base sm:text-3xl">
              {examTitle}
            </h1>
            <div className="bg-ring mt-3 h-0.5 w-10 max-md:hidden" />
          </div>
          <div className="flex items-center gap-4 max-md:gap-2">
            <div className="border-border min-w-[130px] rounded-md border px-4 py-2 text-center max-md:min-w-0 max-md:border-0 max-md:px-0 max-md:py-0">
              {/* Nhãn "Thời gian còn lại" ẩn trên mobile — định dạng MM:SS
                  trong một dải điều khiển đã tự nói nó là đồng hồ. */}
              <span className="eyebrow block max-md:hidden">{t("player.timeRemaining")}</span>
              <ExamTimer durationMinutes={durationMinutes} onTimeUp={submit} />
            </div>
            {/* Ẩn trên mobile: bản Nộp bài của mobile nằm trong dải dính ĐÁY
                (Vùng Xanh của ngón cái, §4.2). Hai nút cùng chức năng trên một
                màn hình sẽ khiến người dùng phải đoán chúng có khác nhau không.
                ExamTimer thì KHÔNG nhân bản — nó mang `onTimeUp` tự nộp bài,
                mount hai lần là hai bộ đếm cùng chạy. */}
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="bg-brand text-brand-foreground rounded-full px-5 py-3 text-xs font-medium tracking-[0.04em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50 max-md:hidden"
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

            {/* Điều hướng Trước/Tiếp.
                Dưới 768px cụm này DÍNH ĐÁY (`sticky bottom-*`) ngay trên
                BottomNav: đo trước thay đổi này, với đề chỉ 5 câu thì khối
                điều hướng + bảng câu hỏi đã nằm ở y≈797 — đúng một viewport
                bên dưới — nên mỗi lần chuyển câu là một lần cuộn xuống rồi
                cuộn ngược lên. Đề 40 câu thì khoảng cách đó nhân lên.
                bottom = chiều cao BottomNav + safe-area (§6.2). */}
            <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-4 max-md:bg-background/95 max-md:sticky max-md:bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] max-md:z-20 max-md:-mx-4 max-md:px-4 max-md:pb-3 max-md:backdrop-blur">
              <button
                type="button"
                onClick={prev}
                disabled={current === 0}
                className="border-border text-foreground hover:border-ring disabled:hover:border-border min-h-11 rounded-md border px-4 py-2.5 text-xs font-medium tracking-[0.04em] uppercase transition-colors disabled:cursor-default disabled:opacity-40"
              >
                ← {t("player.previous")}
              </button>
              {/* Nộp bài NHÂN BẢN ở đây CHỈ trên mobile: bản gốc nằm trong
                  header trang, và header đó cuộn mất ngay khi người dùng bắt
                  đầu đọc câu hỏi. Nút quan trọng nhất của màn hình không được
                  đòi cuộn ngược lên mới bấm được (§4.2 Sticky CTA).
                  `md:hidden` để desktop không có hai nút Nộp bài cùng lúc. */}
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="bg-brand text-brand-foreground min-h-11 rounded-full px-4 py-2.5 text-xs font-medium tracking-[0.04em] uppercase transition-opacity hover:opacity-90 disabled:opacity-50 md:hidden"
              >
                {submitting ? t("player.submitting") : t("player.submit")}
              </button>
              <button
                type="button"
                onClick={next}
                disabled={current === questions.length - 1}
                className="border-border text-foreground hover:border-ring disabled:hover:border-border min-h-11 rounded-md border px-4 py-2.5 text-xs font-medium tracking-[0.04em] uppercase transition-colors disabled:cursor-default disabled:opacity-40"
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
      </PageContainer>
    </div>
  );
}
