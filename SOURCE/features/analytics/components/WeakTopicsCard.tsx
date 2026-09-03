"use client";

// WeakTopicsCard — trả lời "cần sửa CÁI GÌ", không phải "môn nào đang kém".
//
// Biểu đồ cột ngay bên cạnh dừng ở mức môn: nó gắn cờ "NEEDS REVIEW" cho cả
// Chemistry rồi để người đọc tự đoán phải ôn phần nào. Thẻ này đi xuống một
// mức, tới đúng chủ đề `computeScore()` đã chấm ở từng câu. Khác
// SkillRecommendationCard (Engine 1) ở chỗ nó KHÔNG cần taxonomy kỹ năng, nên
// chạy cho cả 7 môn chứ không riêng Toán.
//
// "use client" vì nó nằm trong AnalyticsDashboard (client island) và phải đổi
// theo cùng bộ lọc range với biểu đồ — một thẻ đứng yên khi biểu đồ đổi range
// là hai con số mâu thuẫn nhau trên cùng màn hình.
import { useT } from "@/lib/i18n/client";
import { MIN_TOPIC_QUESTIONS, type TopicWeakness } from "@/lib/analytics/weakTopics";
import { SUBJECT_COLORS } from "@/lib/fake-data/analytics";

export function WeakTopicsCard({ topics }: { topics: TopicWeakness[] }) {
  const t = useT();

  return (
    <div className="border-border bg-card mt-4 rounded-md border p-5">
      <h3 className="text-foreground font-serif text-lg">{t("analytics.weakTopicsTitle")}</h3>

      {topics.length === 0 ? (
        <>
          <p className="text-foreground mt-3 text-sm">{t("analytics.weakTopicsEmpty")}</p>
          <p className="text-muted-foreground mt-1 text-sm">
            {t("analytics.weakTopicsEmptyHint", { min: MIN_TOPIC_QUESTIONS })}
          </p>
        </>
      ) : (
        <>
          <p className="text-muted-foreground mt-1 text-sm">{t("analytics.weakTopicsHint")}</p>
          <ol className="mt-4 flex flex-col gap-3">
            {topics.map((item) => (
              <li key={`${item.subject} ${item.topic}`} className="flex items-baseline gap-3">
                {/* Chấm màu theo môn — cùng bảng màu biểu đồ, để mắt nối được
                    dòng này với cột tương ứng mà không phải đọc lại tên môn. */}
                <span
                  aria-hidden
                  className="mt-1.5 inline-block size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: SUBJECT_COLORS[item.subject] }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground text-sm">
                    <span className="text-muted-foreground">{item.subject}</span> · {item.topic}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs tabular-nums">
                    {t("analytics.weakTopicScore", {
                      correct: item.correct,
                      total: item.total,
                      accuracy: Math.round(item.accuracy * 100),
                    })}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </>
      )}
    </div>
  );
}
