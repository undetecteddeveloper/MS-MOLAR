// ScoreCard — block tổng kết điểm ở màn Result (Layer 2). M1.7 → GĐ 3 M3.1 Task 4.
// Template `resultpage_L2_mobile.png` block lớn: tên đề · số câu đúng · sai · thời gian.
// Visual "tờ giấy trắng": nền card, hairline, điểm lớn nổi bật (UI-LAYER-MAP 4.4) —
// KHÔNG fill màu (màu template chỉ tượng trưng, Q6).

import { getTranslate } from "@/lib/i18n/server";
import type { ScoreResult } from "@/types/result";

export async function ScoreCard({
  examTitle,
  result,
  completionTimeLabel,
}: {
  examTitle: string;
  result: ScoreResult;
  completionTimeLabel: string;
}) {
  const t = await getTranslate();
  const wrong = result.total - result.correct;

  return (
    <section className="border-border bg-card rounded-xl border p-6 text-center sm:p-8">
      <span className="eyebrow">{t("result.title")}</span>
      <h1 className="text-card-foreground mt-2 font-serif text-2xl leading-snug">{examTitle}</h1>

      {/* Điểm lớn nổi bật — thang 10. */}
      <p className="mt-5 flex items-baseline justify-center gap-1">
        <span className="text-brand font-serif text-6xl leading-none tabular-nums">
          {result.totalScore.toFixed(1)}
        </span>
        <span className="text-muted-foreground font-serif text-2xl">/10</span>
      </p>

      {/* Thống kê: đúng · sai · thời gian. Time cell nhận completionTimeLabel
          đã format sẵn từ caller (Task 12) — component này chỉ hiển thị, không
          tự tính toán ngày giờ (xem lib/history/format.ts). */}
      <dl className="border-border mt-6 grid grid-cols-3 gap-3 border-t pt-5 text-center">
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("common.correct")}</dt>
          <dd className="text-foreground font-serif text-xl tabular-nums">{result.correct}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("common.wrong")}</dt>
          <dd className="text-foreground font-serif text-xl tabular-nums">{wrong}</dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="eyebrow">{t("result.time")}</dt>
          <dd className="text-muted-foreground font-serif text-xl tabular-nums">
            {completionTimeLabel}
          </dd>
        </div>
      </dl>
    </section>
  );
}
