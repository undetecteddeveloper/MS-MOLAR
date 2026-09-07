// WeakTopicsCard — trả lời "cần sửa CÁI GÌ", không phải "môn nào đang kém".
//
// Biểu đồ ngay bên trên dừng ở mức môn: nó gắn cờ "Cần ôn lại" cho cả Hoá học
// rồi để người đọc tự đoán phải ôn phần nào. Thẻ này đi xuống một mức, tới đúng
// chủ đề `computeScore()` đã chấm ở từng câu. Khác SkillRecommendationCard
// (Engine 1) ở chỗ nó KHÔNG cần taxonomy kỹ năng, nên chạy cho cả 7 môn chứ
// không riêng Toán.
//
// Nằm trong AnalyticsDashboard (đảo client) và đổi theo cùng chip khoảng thời
// gian với biểu đồ — một thẻ đứng yên khi biểu đồ đổi khoảng là hai con số mâu
// thuẫn nhau trên cùng màn hình.
//
// Theme "Sân trường" (2026-09-06): thẻ surface; mỗi chủ đề một hàng — nhãn môn
// (Badge trắng, tiếng Việt) + tên chủ đề, bên phải là % đúng và "Đúng a/b", dưới
// là thanh Progress xanh 4px tô theo % đúng (thanh tiến độ tô xanh, không vàng —
// §2) để mắt so được các chủ đề mà không phải đọc số. Bỏ dấu chấm giữa của
// "Đúng 1/46 · 2%" (§5). Bỏ chấm màu theo môn: biểu đồ cột giờ chỉ dùng xanh/đỏ
// nên không còn bảng màu môn để nối sang; nhãn môn nói thẳng tên.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { t } from "@/lib/copy";
import { MIN_TOPIC_QUESTIONS, type TopicWeakness } from "@/lib/analytics/weakTopics";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";

export function WeakTopicsCard({ topics }: { topics: TopicWeakness[] }) {
  return (
    <Card as="section" aria-labelledby="weak-topics-title">
      <div className="flex flex-col gap-1">
        <h2 id="weak-topics-title" className="text-lg font-semibold">
          {t("analytics.weakTopicsTitle")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {topics.length === 0 ? t("analytics.weakTopicsEmpty") : t("analytics.weakTopicsHint")}
        </p>
      </div>

      {topics.length === 0 ? (
        <p className="text-sm leading-relaxed">
          {t("analytics.weakTopicsEmptyHint", { min: MIN_TOPIC_QUESTIONS })}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {topics.map((item) => {
            const accuracy = Math.round(item.accuracy * 100);
            const subjectLabel = SUBJECT_LABELS[item.subject];
            return (
              <li key={`${item.subject} ${item.topic}`} className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="flex min-w-0 flex-wrap items-center gap-2">
                    <Badge variant="plain">{subjectLabel}</Badge>
                    <span className="min-w-0 font-medium">{item.topic}</span>
                  </span>
                  <span className="text-sm tabular-nums">
                    <span className="font-semibold">{accuracy}%</span>{" "}
                    <span className="text-muted-foreground">
                      {t("analytics.weakTopicCorrect", { correct: item.correct, total: item.total })}
                    </span>
                  </span>
                </div>
                <Progress
                  value={accuracy}
                  size="sm"
                  aria-label={`${subjectLabel}, ${item.topic}: ${accuracy}%`}
                />
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
