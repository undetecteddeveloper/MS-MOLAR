// ExamPlayer — phần client của Exam Player (Layer 2). GĐ 3 M3.1 Task 2–3.
// Giữ state làm bài qua useExamPlayer (useReducer — tracer code M1.5): câu, đáp án, flag.
// Nộp bài gọi submitExam() Server Action (batch on submit, Q2=A) — action tự redirect.
// Task 3: ExamTimer đếm ngược → hết giờ auto-submit (PA A); FlagButton đánh dấu câu.
// Layout đồng bộ TEMPLATE/L2/ExamPage (redesign UI-only — logic/hooks giữ nguyên):
// header (tên đề + đồng hồ + nút Nộp bài) → 2 cột (card câu hỏi trái, sidebar
// điều hướng phải). SiteHeader (navbar) vẫn từ (layer2)/layout.tsx.
// M3.2 Task 1: mobile vuốt trái/phải chuyển câu (useSwipe); desktop dùng phím ← → .
"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

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
    // `data-exam-focus`: dấu để CSS biết trang này chạy ở chế độ tập trung
    // (BottomNav không render dưới 768px) và bỏ khoảng chừa chân trang —
    // xem `.pb-bottom-nav:has(...)` trong globals.css. Thuộc tính chứ không
    // phải class: nó là DỮ LIỆU trạng thái cho một quy tắc khác đọc, không
    // phải kiểu dáng của chính khối này.
    <div data-exam-focus className="bg-background">
      {/* S#28: modal xác nhận rời trang (mở khi guard chặn một click nav). */}
      <LeaveExamDialog open={pendingHref !== null} onCancel={cancelLeave} onLeave={confirmLeave} />

      {/* `full` (72rem = 1152px) thay số ma thuật max-w-[1100px] cũ — chênh
          52px, không đổi bố cục, nhưng màn làm bài không còn là bề rộng ngoại
          lệ duy nhất của app và mép nội dung thẳng hàng mép navbar. */}
      <PageContainer as="main" size="full" className="flex flex-col gap-6">
        {/* Header — tên đề (trái) · đồng hồ + nút Nộp bài (phải). Không sticky:
            khu vực trả lời đã tự cuộn trong khung 238px (QuestionRenderer) nên
            trang hiếm khi cần cuộn dài. preload order 1 — fade sau navbar (S#21). */}
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
        <div
          className="preload-fade flex items-end justify-between gap-4 max-md:bg-background/95 max-md:sticky max-md:top-0 max-md:z-20 max-md:-mx-4 max-md:items-center max-md:gap-2 max-md:px-4 max-md:py-2 max-md:backdrop-blur"
          style={{ "--preload-order": 1 } as React.CSSProperties}
        >
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
            className="text-muted-foreground hover:text-foreground active:text-foreground -ml-3 flex size-11 shrink-0 items-center justify-center rounded-md transition-colors md:hidden"
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
              className="text-foreground truncate font-serif text-2xl font-semibold max-md:text-base sm:text-3xl"
            >
              {examTitle}
            </h1>
            <div className="bg-ring mt-3 h-0.5 w-10 max-md:hidden" />
          </div>
          <div className="flex shrink-0 items-center gap-4 max-md:gap-2">
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
            {/* Nhãn PHẦN — KHÔNG dùng `.eyebrow` nữa. `.eyebrow` là style NHÃN
                NGẮN (uppercase + tracking 0.08em + 12px + muted): đúng cho "Thời
                gian còn lại", sai cho thứ đang đổ vào đây. Nội dung thật trong
                DB là cả một đoạn ba câu — vd "PHẦN I. (3.0 điểm) Câu trắc
                nghiệm nhiều phương án lựa chọn. Thí sinh trả lời từ câu 1 đến
                câu 12. Mỗi câu hỏi thí sinh chỉ chọn một phương án." — và
                `uppercase` của CSS ép TOÀN BỘ đoạn đó thành chữ hoa (bản thân
                chuỗi trong DB vốn là chữ thường, chỉ "PHẦN I." mới viết hoa).
                Chữ hoa toàn bộ xoá hình dạng từ (word shape) nên mắt phải đọc
                từng chữ cái; cộng thêm 12px + giãn chữ + màu mờ thì đây là khối
                khó đọc nhất màn hình, trong khi nó lại là HƯỚNG DẪN LÀM BÀI bắt
                buộc phải đọc ("chỉ chọn một phương án").
                Nay: giữ nguyên chữ như tác giả đề đã viết, 14px, giãn dòng
                thoáng, tương phản đầy đủ, và bọc trong khối nền + kẻ dọc — thứ
                bậc do KÍCH CỠ và cái khối đảm nhiệm, không phải do làm mờ chữ.
                Khối nền + hairline là cách phân lớp của theme (không đổ bóng). */}
            {currentPartTitle && (
              <p
                /* Đệm dọc bó sát hơn ở mobile. Đo ở 390px với nhãn phần dài
                   nhất (đoạn 3 câu): 127px kể cả lề dưới, so với ~87px của bản
                   `.eyebrow` cũ. Bó đệm + lề chỉ lấy lại 8px (còn 119px) — chỗ
                   tốn nằm ở LINE-HEIGHT của 4 dòng chữ thường, không nằm ở
                   đệm, nên không bó thêm được nữa mà không phá lại chính phần
                   dễ đọc vừa giành được.
                   Vẫn đắt hơn bản cũ ~32px, xấp xỉ một dòng câu hỏi trên màn
                   hẹp (xem ghi chú chi phí chiều cao ở khối header). Chấp nhận:
                   đây là HƯỚNG DẪN LÀM BÀI bắt buộc đọc, và bản cũ tuy ngắn
                   hơn nhưng gần như không ai đọc nổi. */
                className="border-ring bg-muted text-foreground mb-3 border-l-2 py-2 pr-3 pl-3 text-sm leading-relaxed text-pretty sm:mb-4 sm:py-2.5 sm:pl-3.5"
                aria-live="polite"
              >
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
            <div className="border-border mt-4 flex items-center justify-between gap-3 border-t pt-4 max-md:bg-background/95 max-md:sticky max-md:bottom-[env(safe-area-inset-bottom,0px)] max-md:z-20 max-md:-mx-4 max-md:px-4 max-md:pb-3 max-md:backdrop-blur">
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

          {/* Mobile: bó về đúng bề rộng của sidebar desktop rồi canh GIỮA.
              Trước đây `w-full` kéo lưới giãn hết bề ngang màn hình nên các ô
              số phình to bất thường và cả khối lệch hẳn về mép trái so với
              card câu hỏi phía trên. ≥sm trả lại hành vi sidebar cũ. */}
          <div className="mx-auto w-full max-w-[260px] basis-[260px] sm:mx-0 sm:w-auto sm:max-w-none sm:min-w-[240px]">
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
