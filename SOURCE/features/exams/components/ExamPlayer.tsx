// ExamPlayer — phần client của Exam Player (Layer 2). GĐ 3 M3.1 Task 2–3.
// Giữ state làm bài qua useExamPlayer (useReducer — tracer code M1.5): câu, đáp án, flag.
// Nộp bài gọi submitExam() Server Action (batch on submit, Q2=A) — action tự redirect.
// Task 3: ExamTimer đếm ngược → hết giờ auto-submit (PA A); FlagButton đánh dấu câu.
// Bố cục: header (lối thoát mobile, tên đề, đồng hồ, Nộp bài desktop) → 2 cột
// (thẻ câu hỏi trái, bảng câu hỏi phải) → thanh Câu trước / Nộp bài / Câu sau.
// SiteHeader (navbar) vẫn từ (exams)/layout.tsx.
// M3.2 Task 1: mobile vuốt trái/phải chuyển câu (useSwipe); desktop dùng phím ← → .
//
// Theme "Sân trường" (2026-09-06): đợt này CHỈ đổi diện mạo — màu, khoảng
// cách, bo góc, chữ. Bố cục, đồng hồ và logic nộp bài giữ nguyên từng dòng vì
// đây là chế độ tập trung, màn nhạy nhất toàn site. Nút dùng primitive Button;
// đồng hồ là chip (ExamTimer); thẻ câu hỏi và bảng câu hỏi tô nền surface.
"use client";

import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { submitExam } from "@/features/exams/actions";
import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";
import { ExplainStepAffordance } from "@/components/tutor/ExplainStepAffordance";
import { ExamTimer } from "@/features/exams/components/ExamTimer";
import { LeaveExamDialog } from "@/features/exams/components/LeaveExamDialog";
import { QuestionRenderer } from "@/features/exams/components/QuestionRenderer";
import { QuestionPagination } from "@/features/exams/components/QuestionPagination";
import { QuestionPaletteDock } from "@/features/exams/components/QuestionPaletteDock";
import { useExamPlayer } from "@/hooks/useExamPlayer";
import { useLeaveGuard } from "@/hooks/useLeaveGuard";
import { useSwipe } from "@/hooks/useSwipe";
import type { PublicQuestion } from "@/types/question";
import type { QuestionNodes } from "@/features/exams/components/questionNodes.types";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

interface ExamPlayerProps {
  attemptId: string;
  examTitle: string;
  durationMinutes: number;
  questions: PublicQuestion[];
  /**
   * Nội dung ĐÃ RENDER SẴN Ở SERVER của TỪNG câu, cùng thứ tự với `questions`
   * (TD-023 — xem `questionNodes.tsx`). Server phải giao đủ N câu một lần vì
   * đổi câu là tương tác client: server không biết `current` bằng bao nhiêu.
   */
  questionNodes: QuestionNodes[];
  /** Tiêu đề các PHẦN (đề chuẩn 2025, v2.1) — hiện nhãn phần của câu hiện tại. */
  parts?: { number: number; title: string }[];
  /** Chuyển tiếp NGUYÊN VẸN xuống `QuestionRenderer`. Tuỳ chọn, mặc định
   *  `false` — xem lý do đầy đủ ở `QuestionRendererProps`. State, handler và
   *  bố cục của player KHÔNG đổi gì. */
  essayGradingEnabled?: boolean;
}

export function ExamPlayer({
  attemptId,
  examTitle,
  durationMinutes,
  questions,
  questionNodes,
  parts,
  essayGradingEnabled,
}: ExamPlayerProps) {
  const { current, answers, flags, selectAnswer, toggleFlag, goto, next, prev } = useExamPlayer(
    questions.length
  );
  const [submitting, startSubmit] = useTransition();
  const submittedRef = useRef(false);
  // Gợi ý gia sư đã nhận, THEO CÂU (2026-09-13): affordance mount lại mỗi lần
  // đổi câu (key=question.id) nên state của nó không giữ được; giữ ở đây để
  // quay lại câu đã hỏi vẫn thấy lời gia sư thay vì một cái nút tốn thêm lượt.
  const [hints, setHints] = useState<Record<string, string>>({});

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
    // `data-exam-focus`: dấu để CSS biết trang này chạy ở chế độ tập trung
    // (BottomNav không render dưới 768px) và bỏ khoảng chừa chân trang —
    // xem `.pb-bottom-nav:has(...)` trong globals.css. Thuộc tính chứ không
    // phải class: nó là DỮ LIỆU trạng thái cho một quy tắc khác đọc, không
    // phải kiểu dáng của chính khối này.
    <div data-exam-focus className="bg-background">
      {/* S#28: modal xác nhận rời trang (mở khi guard chặn một click nav). */}
      <LeaveExamDialog open={pendingHref !== null} onCancel={cancelLeave} onLeave={confirmLeave} />

      {/* `full` (72rem): màn làm bài cùng bề rộng với kho đề, mép nội dung
          thẳng hàng mép navbar. Lề 16px ở mobile (như các trang (exams) khác)
          để hai dải dính đỉnh/đáy bên dưới bleed đúng bằng `-mx-4`. */}
      <PageContainer
        as="main"
        size="full"
        padding="none"
        className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      >
        {/* Header — tên đề (trái) · đồng hồ + nút Nộp bài (phải). Không sticky ở
            desktop: khu vực trả lời đã tự cuộn trong khung 238px (QuestionRenderer)
            nên trang hiếm khi cần cuộn dài. */}
        {/* Dưới 768px khối này DÍNH ĐỈNH và nén lại: đồng hồ đếm ngược là thông
            tin phải nhìn thấy LIÊN TỤC trong một bài thi có giờ, nhưng trước
            thay đổi này nó cuộn mất ngay khi người dùng bắt đầu đọc câu hỏi đầu
            tiên. Tiêu đề đề rút còn một dòng (`truncate`) để dải sticky không
            ăn quá nhiều chiều cao — ở 360×800 mỗi 40px giữ lại là một dòng câu
            hỏi đọc được thêm.
            `top-0` chứ không phải `top-15`: từ 2026-08-21 SiteHeader ẩn hẳn
            dưới 768px trên route này (isExamFocusRoute), nên không còn 60px
            navbar nào để né — giữ `top-15` sẽ chừa một dải trống đúng bằng
            navbar đã biến mất. */}
        {/* KHÔNG `flex-wrap`: tên đề do người dùng đặt nên độ dài không có
            trần thực tế (MAX_TITLE = 200). Với `flex-wrap` + tiêu đề chỉ
            truncate ở mobile, một tên đề dài đẩy cụm đồng hồ + Nộp bài xuống
            DÒNG RIÊNG trên desktop (bug prod 2026-08-17: "Đề kiểm tra giữa kì
            2 Sinh học 12 — THPT Gia Định, TP HCM (mã 421)"). Đồng hồ đếm ngược
            và nút Nộp bài là hai thứ phải ở CHỖ CỐ ĐỊNH suốt bài thi, không
            được nhảy vị trí theo dữ liệu. Nay: cụm phải `shrink-0` giữ nguyên
            chỗ, phần chữ bên trái co lại và cắt bằng dấu ba chấm ở MỌI bề
            rộng — `title` giữ lại tên đầy đủ khi rê chuột. */}
        <div className="max-md:bg-background/95 flex items-end justify-between gap-4 max-md:sticky max-md:top-0 max-md:z-20 max-md:-mx-4 max-md:items-center max-md:gap-2 max-md:px-4 max-md:py-2 max-md:backdrop-blur">
          {/* Lối quay về /exams — bản MOBILE. Dưới 768px cả SiteHeader lẫn
              BottomNav đều ẩn ở route này (isExamFocusRoute), nên nếu không có
              nút này thì lối ra duy nhất là nút Back của trình duyệt — và với
              một trang có hộp thoại "bạn có chắc muốn rời?" thì để người dùng
              phải dùng nút Back là đúng cái mà hộp thoại đó sinh ra để tránh.
              CHỈ mũi tên, không chữ: dải sticky này tính chi phí từng 40px
              chiều cao (xem comment khối cha) và bề ngang còn phải chia cho
              tên đề + đồng hồ. `size-11` = sàn 44px vùng chạm (§4.3).
              `-ml-3` kéo nút ra để MÉP TRÁI CỦA ICON (không phải của nút) thẳng
              hàng với mép nội dung: 44px nút − 20px icon = 12px đệm mỗi bên,
              nên lùi đúng 12px thì icon rơi vào đúng 16px của `px-4`.
              `<Link>` thật, không phải router.push: interceptor của
              useLeaveGuard bắt theo thẻ <a>, nên nút này đi qua cùng một hộp
              thoại xác nhận như mọi liên kết khác. */}
          <Link
            href="/exams"
            aria-label={t("player.backToExams")}
            className="text-muted-foreground hover:bg-surface hover:text-foreground active:text-foreground focus-visible:ring-ring/40 -ml-3 flex size-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:ring-3 focus-visible:outline-none md:hidden"
          >
            <ArrowLeft aria-hidden className="size-5" strokeWidth={2} />
          </Link>

          <div className="min-w-0 flex-1">
            {/* Về danh sách đề — TÁI DÙNG <Breadcrumbs> (đã có sẵn ở
                exams/[id]/page.tsx), không dựng link riêng: đây đúng là lý do
                Breadcrumbs ra đời — "← Back" chỉ nói ĐI ĐÂU chứ không nói ĐANG
                Ở ĐÂU. `<Link>` bên trong nó vẫn là thẻ <a> thật nên interceptor
                của useLeaveGuard bắt được y hệt navbar — hiện modal xác nhận
                thay vì rời thẳng và mất bài đang làm dở.
                Ẩn trên mobile: dải sticky đã tính chi phí từng 40px chiều cao
                (xem comment khối cha), và ở dải đó nút mũi tên ngay bên trái đã
                làm đúng việc này rồi — hai lối cùng chức năng trên một màn hình
                hẹp chỉ tốn chỗ. */}
            <Breadcrumbs
              items={[{ label: t("nav.exams"), href: "/exams" }, { label: examTitle }]}
              className="mb-1.5 text-xs max-md:hidden"
            />
            <h1
              title={examTitle}
              className="text-foreground truncate text-base font-semibold md:text-2xl md:font-bold lg:text-3xl"
            >
              {examTitle}
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-3 max-md:gap-2">
            {/* ExamTimer tự là một chip (nền surface, đỏ nhạt ở phút cuối) —
                không bọc thêm khung nào. Nhãn "Thời gian còn lại" nằm trong
                `aria-label` của đồng hồ; định dạng MM:SS + icon đã tự nói nó là
                đồng hồ. */}
            <ExamTimer durationMinutes={durationMinutes} onTimeUp={submit} />
            {/* Bảng câu hỏi — CHỈ dưới 768px, trong chính dải dính đỉnh này
                (engineer 2026-09-13, test điện thoại thật): bản trước bảng
                nằm dưới thẻ câu hỏi, mỗi lần nhảy câu là một lần lướt xuống
                rồi lướt lên. Nút mang tiến độ "đã làm/tổng"; bảng thả xuống
                góc phải ngay dưới cụm tiêu đề/đồng hồ. Từ 768px bảng là cột
                phải dính theo cuộn (bên dưới). */}
            <QuestionPaletteDock
              className="md:hidden"
              current={current}
              total={questions.length}
              answeredIndices={answeredIndices}
              flaggedIndices={flaggedIndices}
              onJump={goto}
            />
            {/* Ẩn trên mobile: bản Nộp bài của mobile nằm trong dải dính ĐÁY
                (Vùng Xanh của ngón cái, §4.2). Hai nút cùng chức năng trên một
                màn hình sẽ khiến người dùng phải đoán chúng có khác nhau không.
                ExamTimer thì KHÔNG nhân bản — nó mang `onTimeUp` tự nộp bài,
                mount hai lần là hai bộ đếm cùng chạy. */}
            <Button type="button" onClick={submit} disabled={submitting} className="max-md:hidden">
              {submitting ? t("player.submitting") : t("player.submit")}
            </Button>
          </div>
        </div>

        {/* Khu vực chính — card câu hỏi (trái) + sidebar điều hướng (phải). */}
        <div className="flex flex-wrap items-start gap-6">
          {/* Vùng đọc câu hỏi — bắt cử chỉ vuốt ngang để chuyển câu trên mobile. */}
          <div
            className="min-w-0 flex-1 basis-[480px]"
            onTouchStart={swipe.onTouchStart}
            onTouchEnd={swipe.onTouchEnd}
          >
            {/* Nhãn PHẦN — KHÔNG dùng `.eyebrow`. Nội dung thật trong DB là cả
                một đoạn ba câu — vd "PHẦN I. (3.0 điểm) Câu trắc nghiệm nhiều
                phương án lựa chọn. Thí sinh trả lời từ câu 1 đến câu 12. Mỗi
                câu hỏi thí sinh chỉ chọn một phương án." — và đây là HƯỚNG DẪN
                LÀM BÀI bắt buộc phải đọc ("chỉ chọn một phương án"), nên giữ
                nguyên chữ như tác giả đề đã viết, 14px, giãn dòng thoáng, tương
                phản đầy đủ. Một vạch xanh bên trái đánh dấu "lời dẫn", không
                tô nền: ngay dưới là thẻ câu hỏi đã tô surface, hai khối tô
                chồng nhau sẽ dính thành một.
                Đo ở 390px với nhãn phần dài nhất (đoạn 3 câu): ~119px kể cả lề
                dưới — chỗ tốn nằm ở LINE-HEIGHT của 4 dòng chữ thường, không
                nằm ở đệm, nên không bó thêm được mà không phá phần dễ đọc. */}
            {currentPartTitle && (
              <p
                className="border-primary text-foreground mb-3 border-l-2 py-0.5 pl-3 text-sm leading-relaxed text-pretty sm:mb-4 sm:pl-3.5"
                aria-live="polite"
              >
                {currentPartTitle}
              </p>
            )}
            <QuestionRenderer
              index={current + 1}
              total={questions.length}
              question={question}
              essayGradingEnabled={essayGradingEnabled}
              nodes={questionNodes[current]}
              selectedAnswer={answers[question.id]}
              /* CẢ bảng đáp án, không chỉ câu hiện tại: chỗ trống của bài đọc
                 dùng chung thuộc về nhiều câu khác nhau nhưng hiện cùng lúc
                 trên màn của mỗi câu trong nhóm. Xem `QuestionRendererProps`. */
              answers={answers}
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
              /* Gợi ý khi đang bí (engineer 2026-09-13) — mọi câu, kể cả tự
                 luận; server tự gác (lượt của mình, đang mở, câu thuộc đề, rate
                 limit, hạn mức). `key` theo câu để máy trạng thái về idle khi
                 đổi câu; bản nháp đọc từ `answers` lúc bấm. */
              hintSlot={
                <ExplainStepAffordance
                  key={question.id}
                  attemptId={attemptId}
                  questionId={question.id}
                  draftAnswer={answers[question.id] ?? ""}
                  hint={hints[question.id] ?? null}
                  onHint={(hint) => setHints((prev) => ({ ...prev, [question.id]: hint }))}
                />
              }
            />

            {/* Điều hướng Câu trước / Câu sau.
                Dưới 768px cụm này DÍNH ĐÁY (`sticky bottom-*`) ngay trên
                BottomNav: đo trước thay đổi này, với đề chỉ 5 câu thì khối
                điều hướng + bảng câu hỏi đã nằm ở y≈797 — đúng một viewport
                bên dưới — nên mỗi lần chuyển câu là một lần cuộn xuống rồi
                cuộn ngược lên. Đề 40 câu thì khoảng cách đó nhân lên.
                bottom = chiều cao BottomNav + safe-area (§6.2).
                Ở mobile hai nút chuyển câu là nút TRÒN chỉ có mũi tên (nhãn
                chữ giữ cho trình đọc màn hình) để "Nộp bài" ở giữa có chỗ
                trải rộng — ba viên thuốc có chữ không đứng vừa 328px. Từ 768px
                nhãn "Câu trước / Câu sau" hiện ra. Kẻ ngang chỉ ở mobile: dải
                dính đáy mờ 95% cần một mép để tách khỏi nội dung cuộn dưới nó. */}
            <div className="max-md:bg-background/95 mt-4 flex items-center justify-between gap-3 pt-4 max-md:sticky max-md:bottom-[env(safe-area-inset-bottom,0px)] max-md:z-20 max-md:-mx-4 max-md:border-t max-md:px-4 max-md:pb-3 max-md:backdrop-blur">
              <Button
                type="button"
                variant="secondary"
                onClick={prev}
                disabled={current === 0}
                aria-label={t("player.prevQuestion")}
                className="max-md:w-11 max-md:px-0"
              >
                <ChevronLeft aria-hidden />
                <span className="max-md:sr-only">{t("player.prevQuestion")}</span>
              </Button>
              {/* Nộp bài NHÂN BẢN ở đây CHỈ trên mobile: bản gốc nằm trong
                  header trang, và header đó cuộn mất ngay khi người dùng bắt
                  đầu đọc câu hỏi. Nút quan trọng nhất của màn hình không được
                  đòi cuộn ngược lên mới bấm được (§4.2 Sticky CTA).
                  `md:hidden` để desktop không có hai nút Nộp bài cùng lúc. */}
              <Button
                type="button"
                onClick={submit}
                disabled={submitting}
                className="flex-1 md:hidden"
              >
                {submitting ? t("player.submitting") : t("player.submit")}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={next}
                disabled={current === questions.length - 1}
                aria-label={t("player.nextQuestion")}
                className="max-md:w-11 max-md:px-0"
              >
                <span className="max-md:sr-only">{t("player.nextQuestion")}</span>
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </div>

          {/* Cột phải — CHỈ từ 768px (dưới đó bảng sống trong dải dính đỉnh,
              QuestionPaletteDock ở trên). DÍNH theo cuộn dưới navbar
              (`top-[4.5rem]` = navbar 60px + 12px; navbar hiện từ 768px trên
              route này) để bảng luôn trong tầm với khi thẻ câu hỏi dài hơn
              một màn — engineer 2026-09-13. Bề rộng 216px ở 768–1023 là con
              số làm cột câu hỏi (`basis-[480px]`) + khe 24px vừa khít 720px
              nội dung của khung 768, không gãy xuống dòng; từ 1024 trả lại
              260px. `self-start`: sticky chỉ chạy khi item thấp hơn hàng. */}
          <div className="max-md:hidden md:sticky md:top-[4.5rem] md:min-w-[216px] md:basis-[216px] md:self-start lg:min-w-[240px] lg:basis-[260px]">
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
