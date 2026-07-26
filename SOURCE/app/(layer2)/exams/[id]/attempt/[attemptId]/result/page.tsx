// Result — /exams/[id]/attempt/[attemptId]/result (Layer 2). M2.6 → GĐ 3 M3.1 Task 4.
// Server Component: đọc kết quả đã chấm + lưu trong DB qua getResult().
// Attempt chưa nộp / không tồn tại / không thuộc user → redirect về trang đề (Q2=A).
// Bố cục theo TEMPLATE/L2/resultpage_L2_mobile.png: block điểm · chủ đề + save/share ·
// nav (Chi tiết → page riêng / Trở về homepage / Làm lại). Visual "tờ giấy trắng".

import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyRating } from "@/app/(layer2)/actions";
import { getResult } from "@/app/(layer2)/queries";
import { ScoreCard } from "@/app/(layer2)/_components/ScoreCard";
import { TopicBreakdown } from "@/app/(layer2)/_components/TopicBreakdown";
import { ResultActions } from "@/app/(layer2)/_components/ResultActions";
import { RatingModalController } from "@/app/(layer2)/_components/rating/RatingModalController";
import { mapFromMyRating } from "@/lib/rating";

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

  const { examTitle, result } = data;
  // Prefill for the modal's "already rated" editable state (AC-006/013) —
  // same mapFromMyRating(getMyRating(id)) pattern as /exams/[id]/rate/page.tsx.
  const initialScores = mapFromMyRating(await getMyRating(id));

  return (
    <div className="bg-background">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-5 px-6 py-8">
        {/* preload order 1–3 — các block fade lần lượt sau navbar (S#21). */}
        <div className="preload-fade" style={{ "--preload-order": 1 } as React.CSSProperties}>
          <ScoreCard examTitle={examTitle} result={result} />
        </div>

        {/* Chủ đề (trái) · Lưu/Chia sẻ + Trở về (phải) — engineer feedback: đổi
            justify-between → justify-start (gap-3 cố định) để 2 nhóm nút bên
            phải nằm SÁT nhau ngay dưới nhau, không bị kéo giãn hở khoảng
            trống theo chiều cao (do items-stretch khớp cột trái cao hơn). */}
        <div
          className="preload-fade grid grid-cols-[1fr_auto] items-stretch gap-4"
          style={{ "--preload-order": 2 } as React.CSSProperties}
        >
          <TopicBreakdown topics={result.topicBreakdown} />
          <div className="flex w-28 flex-col justify-start gap-3 sm:w-36">
            <ResultActions />
            {/* Return → ExamBrowser (S#26 — đổi từ Home→"/" cũ). */}
            <Link
              href="/exams"
              className="border-border bg-card text-foreground hover:border-brand flex items-center justify-center rounded-xl border px-3 py-4 text-center text-sm transition-colors"
            >
              Return
            </Link>
          </div>
        </div>

        {/* Nav cuối: Chi tiết (page riêng, Q5) · Làm lại (→ Detail, tạo attempt mới). */}
        <div
          className="preload-fade grid grid-cols-2 gap-3"
          style={{ "--preload-order": 3 } as React.CSSProperties}
        >
          <Link
            href={`/exams/${id}/attempt/${attemptId}/result/detail`}
            className="border-brand bg-brand text-brand-foreground rounded-lg border px-4 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90"
          >
            View details
          </Link>
          <Link
            href={`/exams/${id}`}
            className="border-border bg-card text-foreground hover:border-brand rounded-lg border px-4 py-3 text-center text-sm font-medium transition-colors"
          >
            Try again
          </Link>
        </div>

        {/* Rating System — auto-opens once on a fresh submit via ?rate=auto
            (stripped on mount); on refresh/return only the inline entry point
            renders (frontend DD § Data-Fetching Plan — result page). */}
        <div className="preload-fade" style={{ "--preload-order": 4 } as React.CSSProperties}>
          <RatingModalController examId={id} initialScores={initialScores} />
        </div>
      </main>
    </div>
  );
}
