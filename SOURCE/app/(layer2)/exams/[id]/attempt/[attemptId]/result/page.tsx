// Result — /exams/[id]/attempt/[attemptId]/result (Layer 2). M2.6 → GĐ 3 M3.1 Task 4.
// Server Component: đọc kết quả đã chấm + lưu trong DB qua getResult().
// Attempt chưa nộp / không tồn tại / không thuộc user → redirect về trang đề (Q2=A).
// Bố cục: block điểm · save/share + trở về · nav (Chi tiết → page riêng / Làm lại) ·
// rating entry. Visual "tờ giấy trắng".
//
// 2026-07-27: bỏ hẳn khối "Topics" (số câu đúng theo chủ đề, cũ dùng
// TopicBreakdown.tsx — component đã xóa, không còn nơi nào khác dùng) theo
// yêu cầu — layout bên dưới được dựng lại từ đầu cho vừa khít 1 cột thay vì
// grid 2 cột [Topics | Save/Share+Return] cũ (xóa Topics để trống cột trái
// sẽ vỡ bố cục nếu giữ nguyên grid đó).

import Link from "next/link";
import { getTranslate } from "@/lib/i18n/server";
import { redirect } from "next/navigation";
import { getCurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { getMyRating } from "@/app/(layer2)/actions";
import { getResult } from "@/app/(layer2)/queries";
import { ScoreCard } from "@/app/(layer2)/_components/ScoreCard";
import { EssayScoreLine } from "@/app/(layer2)/_components/EssayScoreLine";
import { EssayGradingPoller } from "@/app/(layer2)/_components/EssayGradingPoller";
import { ResultActions } from "@/app/(layer2)/_components/ResultActions";
import { mapFromMyRating } from "@/lib/rating";
import { formatCompletionTime, formatOvertime } from "@/lib/history/format";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";
import { PageContainer } from "@/components/layout/PageContainer";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

export default async function ResultPage({
  params,
}: {
  params: Promise<{ id: string; attemptId: string }>;
}) {
  const t = await getTranslate();
  const { id, attemptId } = await params;
  const data = await getResult(attemptId);

  if (!data) {
    redirect(`/exams/${id}`);
  }

  const { examTitle, subject, result } = data;
  // Đã rated trước đó chưa → nhãn nút rating "Edit your rating"/"Rate this
  // exam" (AC-006/013), cùng pattern mapFromMyRating(getMyRating(id)) như
  // /exams/[id]/rate/page.tsx.
  const initialScores = mapFromMyRating(await getMyRating(id));
  const hasRated = initialScores !== undefined;

  // Lấy lại profile (displayName cho PDF) — layer2/layout.tsx đã gọi
  // getCurrentUserProfile() một lần cho cả cây, gọi lại ở page là tiền lệ đã
  // có sẵn trong repo (profile/page.tsx:37), không phải cách mới.
  const user = await getCurrentUserProfile();

  // Task 12: computed once here (no extra round trip, AC-009) and passed
  // down to ScoreCard/ResultActions — same shared formatter/type HistoryRow
  // (Task 13) and generateAttemptPdf.ts use, so all surfaces stay in sync.
  const completionTimeLabel = formatCompletionTime(data.startedAt, data.submittedAt);
  const pdfInput: AttemptPdfData = {
    subject,
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

  return (
    <div className="bg-background">
      <PageContainer as="main" size="small" className="flex flex-col gap-5">
        {/* preload order 1–4 — các block fade lần lượt sau navbar (S#21). */}
        <Breadcrumbs
          className="preload-fade text-xs"
          style={{ "--preload-order": 1 } as React.CSSProperties}
          items={[
            { label: t("nav.exams"), href: "/exams" },
            { label: examTitle, href: `/exams/${id}` },
            { label: t("result.title") },
          ]}
        />

        <div className="preload-fade" style={{ "--preload-order": 1 } as React.CSSProperties}>
          <ScoreCard
            examTitle={examTitle}
            result={result}
            completionTimeLabel={completionTimeLabel}
          />
        </div>

        {/* Điểm tự luận — DÒNG RIÊNG CÓ NHÃN, đặt giữa ScoreCard và khối quá
            giờ (ADR-0018 § Amendment to ADR-0010, FE-AC-01).

            Vì sao không gộp vào ScoreCard: `exam_results` không còn bất biến
            sau insert, nên một band có thể đáp xuống trong lúc học sinh đang
            nhìn trang. Gộp con số đang-đổi ấy vào ô điểm lớn làm chính con số
            học sinh tin tưởng nhất tự nhảy. ScoreCard là VÙNG 0-DIFF.

            Component tự trả `null` khi không câu nào mang khoá vòng đời, nên
            với một dòng cũ KHÔNG node nào vào cây (AC-012 đúng từng byte).
            Không bọc thêm div: nhịp dọc thuộc về `gap-5` của trang. */}
        <EssayScoreLine
          summary={data.essaySummary}
          detailHref={`/exams/${id}/attempt/${attemptId}/result/detail`}
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
            Điểm vẫn được chấm bình thường — chỉ nói rõ là ngoài thời gian. */}
        {data.overtimeSeconds > 0 && (
          <div
            className="preload-fade border-border bg-card text-muted-foreground rounded-lg border border-dashed px-4 py-3 text-sm"
            style={{ "--preload-order": 2 } as React.CSSProperties}
          >
            <span className="text-foreground font-medium">{t("result.submittedAfterTime")}</span>{" "}
            {t("result.overtimeBody", { time: formatOvertime(data.overtimeSeconds) })}
          </div>
        )}

        {/* Save · Share · Return — 3 ô ngang bằng nhau, không còn phụ thuộc
            cột Topics đã xóa để định chiều cao/chiều rộng. */}
        <div
          className="preload-fade grid grid-cols-3 gap-3"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          {/* CỬA THỨ NHẤT của cổng chặn PDF (AC-058). Chặn khi còn câu tự
              luận CHƯA NGÃ NGŨ — `unresolvedCount` đếm RS-2 + RS-4 + RS-5 và
              CỐ Ý không đếm RS-6: hết lượt là trạng thái CUỐI, nên chặn ở đó
              là chặn VĨNH VIỄN một học sinh khỏi chính kết quả của mình vì một
              sự cố không do họ gây ra (O-8). Ca RS-6 được xử bằng một dòng chú
              thích IN TRONG tệp, không bằng một cánh cửa khoá. */}
          <ResultActions
            pdfInput={pdfInput}
            blockedReason={
              (data.essaySummary?.unresolvedCount ?? 0) > 0
                ? t("result.essay.pdfBlocked")
                : null
            }
          />
          {/* Return → ExamBrowser (S#26 — đổi từ Home→"/" cũ). */}
          <Link
            href="/exams"
            className="border-border bg-card text-foreground hover:border-brand flex items-center justify-center rounded-xl border px-3 py-4 text-center text-sm transition-colors"
          >
            {t("result.return")}
          </Link>
        </div>

        {/* Nav cuối: Chi tiết (page riêng, Q5) · Làm lại (→ Detail, tạo attempt mới). */}
        <div
          className="preload-fade grid grid-cols-2 gap-3"
          style={{ "--preload-order": 3 } as React.CSSProperties}
        >
          <Link
            href={`/exams/${id}/attempt/${attemptId}/result/detail`}
            className="border-brand bg-brand text-brand-foreground rounded-full border px-4 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90"
          >
            {t("common.viewDetails")}
          </Link>
          <Link
            href={`/exams/${id}`}
            className="border-border bg-card text-foreground hover:border-brand rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors"
          >
            {t("common.tryAgain")}
          </Link>
        </div>

        {/* Rating System — điều hướng thẳng sang trang Rating chính
            (/exams/[id]/rate) thay vì mở popup tại chỗ (2026-07-27). Kèm
            ?returnTo= chính URL trang này, để nút "← Back" trên trang rate
            quay lại ĐÚNG trang kết quả này thay vì mặc định /exams. */}
        <div className="preload-fade" style={{ "--preload-order": 4 } as React.CSSProperties}>
          <Link
            href={`/exams/${id}/rate?returnTo=${encodeURIComponent(
              `/exams/${id}/attempt/${attemptId}/result`
            )}`}
            className="border-border bg-card text-foreground hover:border-brand block w-full rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors"
          >
            {hasRated ? t("result.editRating") : t("result.rateThisExam")}
          </Link>
        </div>
      </PageContainer>
    </div>
  );
}
