// ScoreCard — block tổng kết điểm ở màn Result (Layer 2). M1.7 → GĐ 3 M3.1 Task 4.
// Template `resultpage_L2_mobile.png` block lớn: tên đề · số câu đúng · sai · thời gian.
// Visual "tờ giấy trắng": nền card, hairline, điểm lớn nổi bật (UI-LAYER-MAP 4.4) —
// KHÔNG fill màu (màu template chỉ tượng trưng, Q6).

import type { ScoreResult } from "@/types/result";

export function ScoreCard({
  examTitle,
  result,
  completionTimeLabel,
}: {
  examTitle: string;
  result: ScoreResult;
  completionTimeLabel: string;
}) {
  const wrong = result.total - result.correct;

  return (
    <section className="rounded-xl border border-border bg-card p-6 text-center sm:p-8">
      <span className="eyebrow">Result</span>
      <h1 className="mt-2 font-serif text-2xl leading-snug text-card-foreground">
        {examTitle}
      </h1>

      {/* Điểm lớn nổi bật — thang 10. */}
      <p className="mt-5 flex items-baseline justify-center gap-1">
        <span className="font-serif text-6xl leading-none text-brand tabular-nums">
          {result.totalScore.toFixed(1)}
        </span>
        <span className="font-serif text-2xl text-muted-foreground">/10</span>
      </p>

      {/* Thống kê: đúng · sai · thời gian. Time cell nhận completionTimeLabel
          đã format sẵn từ caller (Task 12) — component này chỉ hiển thị, không
          tự tính toán ngày giờ (xem lib/history/format.ts). */}
      <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-border pt-5 text-center">
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">Correct</dt>
          <dd className="font-serif text-xl text-foreground tabular-nums">
            {result.correct}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">Wrong</dt>
          <dd className="font-serif text-xl text-foreground tabular-nums">
            {wrong}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">Time</dt>
          <dd className="font-serif text-xl text-muted-foreground tabular-nums">
            {completionTimeLabel}
          </dd>
        </div>
      </dl>
    </section>
  );
}
