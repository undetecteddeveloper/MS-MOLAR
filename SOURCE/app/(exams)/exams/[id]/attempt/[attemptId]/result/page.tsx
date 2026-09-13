// Result — /exams/[id]/attempt/[attemptId]/result (Layer 2). M2.6 → GĐ 3 M3.1 Task 4.
// Server Component: đọc kết quả đã chấm + lưu trong DB qua getResult().
// Attempt chưa nộp / không tồn tại / không thuộc user → redirect về trang đề (Q2=A).
//
// Bố cục theo theme "Sân trường" (2026-09-06, design plan §3 "Kết quả"):
// breadcrumbs → thẻ điểm (surface, căn giữa) → khối quá giờ (nếu có) → thẻ
// VÀNG "Tiếp theo" mang hai nút Xem từng câu / Làm lại đề → hàng Lưu · Chia sẻ
// · Về kho đề → liên kết chấm độ khó dưới một kẻ chia khép trang. Thẻ vàng là
// chỗ táo bạo duy nhất của màn hình (§4.1) và hai hành động chính đứng trong
// đó, cùng lối với thẻ "Trước khi bắt đầu" của trang chi tiết đề.
//
// Dòng "Tự luận" riêng (EssayScoreLine, ADR-0018 FE-AC-01) bỏ 2026-09-13 theo
// engineer sau khi test trên điện thoại thật: thẻ điểm đã gánh được vai trò đó
// — còn câu chưa chấm thì ô lớn hiện vòng xoay thay con số, chấm xong thì hiện
// điểm CUỐI (G1 trong ScoreCard). Hai khối cùng nói "đang chấm" là một khối
// thừa. Lối vào nút chấm lại (RS-4/RS-5) vẫn qua "Xem từng câu" → trang chi
// tiết, nơi EssayRegradeControl đứng cạnh chính câu bị lỗi.
//
// 2026-07-27: bỏ hẳn khối "Topics" (số câu đúng theo chủ đề, cũ dùng
// TopicBreakdown.tsx — component đã xóa, không còn nơi nào khác dùng).

import Link from "next/link";
import { t } from "@/lib/copy";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { getMyRating } from "@/features/exams/actions";
import { getResult } from "@/features/exams/queries";
import { ScoreCard } from "@/features/exams/components/ScoreCard";
import { EssayGradingPoller } from "@/features/exams/components/EssayGradingPoller";
import { ResultActions } from "@/features/exams/components/ResultActions";
import { mapFromMyRating } from "@/lib/rating";
import { formatCompletionTime, formatOvertime } from "@/lib/history/format";
import { subjectLabel } from "@/lib/ugc/subjects";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";
import { cn } from "@/lib/utils";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const { id, attemptId } = await params;
  const data = await getResult(attemptId);

  if (!data) {
    redirect(`/exams/${id}`);
  }

  const { examTitle, subject, result } = data;
  // Đã rated trước đó chưa → nhãn nút rating "Sửa điểm chấm"/"Chấm độ khó"
  // (AC-006/013), cùng pattern mapFromMyRating(getMyRating(id)) như
  // /exams/[id]/rate/page.tsx.
  const initialScores = mapFromMyRating(await getMyRating(id));
  const hasRated = initialScores !== undefined;

  // Lấy lại profile (displayName cho PDF) — layout đã gọi getCurrentUserProfile()
  // một lần cho cả cây; từ 2026-09-03 `React.cache()` trong
  // lib/auth/getCurrentUser.ts gộp lượt gọi này với lượt của layout trong cùng
  // request — không thêm round-trip nào.
  const user = await getCurrentUserProfile();

  // Task 12: computed once here (no extra round trip, AC-009) and passed
  // down to ScoreCard/ResultActions — same shared formatter/type HistoryRow
  // (Task 13) and generateAttemptPdf.ts use, so all surfaces stay in sync.
  const completionTimeLabel = formatCompletionTime(data.startedAt, data.submittedAt);
  const pdfInput: AttemptPdfData = {
    // PDF in nhãn tiếng Việt như mọi bề mặt khác (mẫu PDF không đổi, chỉ dữ
    // liệu) — cùng `subjectLabel` với HistoryRow, hai lối xuất vẫn cùng một tệp.
    subject: subjectLabel(subject),
    examTitle,
    totalScore: result.totalScore,
    examineeName: user?.displayName ?? "",
    submittedAt: data.submittedAt,
    correct: result.correct,
    total: result.total,
    // ĐỌC trường đã published của đường đọc này, không suy lại RS-6 tại chỗ
    // (EG-BE-036). Lối xuất kia (HistoryRow) đọc trường tương ứng của đường đọc
    // CỦA NÓ, và cả hai trường đều do cùng một `hasIncompleteEssay()` sinh ra —
    // đó là thứ khiến hai lối không thể sinh ra hai tệp khác nhau cho cùng một
    // lượt thi (F-06/O-8).
    hasIncompleteEssay: data.hasIncompleteEssay,
  };

  const detailHref = `/exams/${id}/attempt/${attemptId}/result/detail`;

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      <Breadcrumbs
        className="text-xs"
        items={[
          { label: t("nav.exams"), href: "/exams" },
          { label: examTitle, href: `/exams/${id}` },
          { label: t("result.title") },
        ]}
      />

      <ScoreCard
        examTitle={examTitle}
        result={result}
        completionTimeLabel={completionTimeLabel}
        // G1 — còn câu tự luận chưa ngã ngũ ⇒ ô lớn hoãn hiện con số.
        // Dùng CHÍNH `unresolvedCount` mà EssayGradingPoller đọc để quyết
        // định còn poll hay không, nên hai thứ không thể lệch pha: lượt
        // refresh cuối cùng của poller cũng là lượt gỡ chữ "đang chấm…".
        pending={(data.essaySummary?.unresolvedCount ?? 0) > 0}
      />

      {/* Bộ poll — mount khi `essaySummary !== undefined`, KHÔNG phải khi
          `pendingCount > 0`.

          Điều kiện `pendingCount > 0` là thứ UI Spec công bố lần đầu, và nó
          GÂY RA khuyết tật AC-023: ở đúng lượt render giải quyết câu tự luận
          cuối cùng, component sẽ unmount và vùng `aria-live` của nó rời khỏi
          DOM TRONG CÙNG commit mà câu "đã chấm xong toàn bộ" lẽ ra được chèn
          vào — nên lời thông báo ấy không bao giờ được đọc lên. Người dùng
          nhìn thấy không nhận ra điều gì, nên không ai báo lỗi.

          Kết luận cho trạng thái tính năng TẮT không đổi — đó là lý do vị từ
          cũ trông vô hại: không phần tử nào mang khoá vòng đời thì
          `summariseEssays()` trả `undefined`, nên poller vẫn không mount.

          (Tên khoá jsonb CỐ Ý không gõ ra ở đây: một rào chắn trong
          `essayLifecycle.test.ts` giữ cho sáu literal ấy chỉ được gõ ở đúng
          một file, và bản nháp đầu của comment này đã làm nó đỏ.) */}
      {data.essaySummary !== undefined && (
        <EssayGradingPoller
          pendingCount={data.essaySummary.pendingCount}
          gradedCount={data.essaySummary.gradedCount}
        />
      )}

      {/* Quá giờ (Security review #6). DB tự tính overtime_seconds trong
          record_exam_result() từ started_at + duration_minutes, nên nhãn này
          không nói dối được kể cả khi người làm tắt JS để vô hiệu hoá đồng hồ.
          Điểm vẫn được chấm bình thường — chỉ nói rõ là ngoài thời gian.
          Viền nét đứt: cùng khuôn với dòng tự luận — "một chú thích cho con
          số bên trên", không phải một khối nội dung. */}
      {data.overtimeSeconds > 0 && (
        <Card variant="outline" padding="compact" className="border-dashed text-sm">
          <p className="leading-relaxed">
            <span className="text-foreground font-semibold">{t("result.submittedAfterTime")}</span>{" "}
            <span className="text-muted-foreground">
              {t("result.overtimeBody", { time: formatOvertime(data.overtimeSeconds) })}
            </span>
          </p>
        </Card>
      )}

      {/* Thẻ vàng "Tiếp theo" — chỗ táo bạo duy nhất của màn hình, mang hai
          hành động chính: Xem từng câu (page riêng, Q5) là nút xanh vì đó là
          việc có giá trị học tập; Làm lại đề (→ chi tiết đề, tạo attempt mới)
          là nút trắng trên nền vàng. Vàng chỉ làm NỀN sau chữ đen (§2). */}
      <Card as="section" variant="sun" aria-labelledby="result-next-title" className="gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="result-next-title" className="text-lg font-semibold">
            {t("result.nextTitle")}
          </h2>
          <p className="text-sm leading-relaxed">{t("result.nextBody")}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={detailHref} className={cn(buttonVariants({ size: "lg" }), "sm:flex-1")}>
            {t("result.reviewEach")}
          </Link>
          <Link
            href={`/exams/${id}`}
            className={cn(buttonVariants({ variant: "plain", size: "lg" }), "sm:flex-1")}
          >
            {t("result.retake")}
          </Link>
        </div>
      </Card>

      {/* Lưu · Chia sẻ · Về kho đề — ba viên thuốc surface bằng nhau. ActionButton
          giữ hình dạng "một nút trong luồng" nên số ô của lưới không đổi theo
          trạng thái (xem ghi chú D2 ở components/history/ActionButton.tsx). */}
      <div className="grid grid-cols-3 gap-2">
        {/* CỬA THỨ NHẤT của cổng chặn PDF (AC-058). Chặn khi còn câu tự
            luận CHƯA NGÃ NGŨ — `unresolvedCount` đếm RS-2 + RS-4 + RS-5 và
            CỐ Ý không đếm RS-6: hết lượt là trạng thái CUỐI, nên chặn ở đó
            là chặn VĨNH VIỄN một học sinh khỏi chính kết quả của mình vì một
            sự cố không do họ gây ra (O-8). Ca RS-6 được xử bằng một dòng chú
            thích IN TRONG tệp, không bằng một cánh cửa khoá. */}
        <ResultActions
          pdfInput={pdfInput}
          blockedReason={
            (data.essaySummary?.unresolvedCount ?? 0) > 0 ? t("result.essay.pdfBlocked") : null
          }
        />
        {/* Về kho đề → ExamBrowser (S#26 — đổi từ Home→"/" cũ). */}
        <Link href="/exams" className={cn(buttonVariants({ variant: "secondary" }), "px-3")}>
          {t("result.backToExams")}
        </Link>
      </div>

      {/* Rating System — điều hướng thẳng sang trang Rating chính
          (/exams/[id]/rate) thay vì mở popup tại chỗ (2026-07-27). Kèm
          ?returnTo= chính URL trang này, để nút quay lại trên trang rate về
          ĐÚNG trang kết quả này thay vì mặc định /exams.
          Hành động phụ, đứng cuối trang dưới một kẻ chia khép trang. Căn GIỮA
          (2026-09-06) — khác lối căn trái ở kênh báo cáo đề của trang chi tiết
          đề, vì đây là dòng cuối cùng của cả trang chứ không phải một hành
          động ẩn dưới danh sách còn nội dung khác bên trên. */}
      <div className="border-border border-t pt-4 text-center">
        <Link
          href={`/exams/${id}/rate?returnTo=${encodeURIComponent(
            `/exams/${id}/attempt/${attemptId}/result`
          )}`}
          className="text-primary inline-flex min-h-11 items-center text-sm font-semibold underline-offset-4 hover:underline"
        >
          {hasRated ? t("result.editRating") : t("result.rateThisExam")}
        </Link>
      </div>
    </PageContainer>
  );
}
