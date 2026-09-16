// SkillBreakdownCard — "Kết quả theo dạng bài": tỉ lệ đúng của TỪNG dạng bài
// học sinh đã làm, xếp theo môn, cho cả 7 môn (2026-09-16).
//
// Khác WeakTopicsCard ngay trên nó: thẻ kia trả lời "sửa gì TRƯỚC" (tối đa 3
// dòng, đủ bằng chứng, dưới ngưỡng); thẻ này là bảng kê ĐỦ — mọi dạng bài đã
// chạm tới, kể cả dạng đang làm tốt, để học sinh thấy mình đứng đâu chứ không
// chỉ thấy chỗ hỏng. Cả hai đọc từ CÙNG một bộ gộp (lib/analytics/
// skillBreakdown.ts) nên không thể nói hai con số khác nhau về một dạng bài.
//
// Ô "Chưa phân loại": câu chưa được gắn dạng bài (chưa chạy tagger, hoặc
// model không đủ tin cậy nên để NULL — quy ước "trống còn hơn sai" của Engine
// 1). Luôn đứng cuối môn, chữ mờ, vẫn có % và Đúng a/b — dữ liệu ấy là thật,
// chỉ chưa có tên. Không giấu: một môn mới gắn thẻ nửa chừng phải nhìn ra được
// là "nửa chừng".
//
// Theme "Sân trường": thẻ surface, mỗi môn một mục có tiêu đề nhỏ, mỗi dạng
// bài một hàng — nhãn, bên phải là % đúng và "Đúng a/b", dưới là thanh Progress
// 4px tô xanh theo % — cùng ngôn ngữ hàng với WeakTopicsCard, để mắt đọc hai
// thẻ như một. Không có tương tác, không "use client": chỉ render dữ liệu server
// đã tính sẵn cho cả ba khoảng thời gian.

import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { SubjectSkillBreakdown } from "@/lib/analytics/skillBreakdown";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";

export function SkillBreakdownCard({ breakdown }: { breakdown: SubjectSkillBreakdown[] }) {
  return (
    <Card as="section" aria-labelledby="skill-breakdown-title">
      <div className="flex flex-col gap-1">
        <h2 id="skill-breakdown-title" className="text-lg font-semibold">
          {t("analytics.skillBreakdownTitle")}
        </h2>
        <p className="text-muted-foreground text-sm leading-relaxed">
          {breakdown.length === 0
            ? t("analytics.skillBreakdownEmpty")
            : t("analytics.skillBreakdownHint")}
        </p>
      </div>

      {breakdown.length > 0 && (
        <div className="flex flex-col gap-4">
          {breakdown.map(({ subject, skills }, index) => {
            const subjectLabel = SUBJECT_LABELS[subject];
            const headingId = `skill-breakdown-${subject.toLowerCase()}`;
            return (
              <section
                key={subject}
                aria-labelledby={headingId}
                className={cn(
                  "flex flex-col gap-3",
                  index > 0 && "border-border border-t pt-4"
                )}
              >
                <h3 id={headingId} className="font-semibold">
                  {subjectLabel}
                </h3>
                <ol className="flex flex-col gap-3">
                  {skills.map((skill) => {
                    const accuracy = Math.round(skill.accuracy * 100);
                    const untagged = skill.skillNodeId === null;
                    const label = untagged ? t("analytics.skillUntagged") : (skill.labelVi ?? "");
                    return (
                      <li key={skill.skillNodeId ?? "untagged"} className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                          <span
                            className={cn(
                              "min-w-0",
                              untagged ? "text-muted-foreground" : "font-medium"
                            )}
                          >
                            {label}
                          </span>
                          <span className="text-sm tabular-nums">
                            <span className="font-semibold">{accuracy}%</span>{" "}
                            <span className="text-muted-foreground">
                              {t("analytics.weakTopicCorrect", {
                                correct: skill.correct,
                                total: skill.total,
                              })}
                            </span>
                          </span>
                        </div>
                        <Progress
                          value={accuracy}
                          size="sm"
                          aria-label={`${subjectLabel}, ${label}: ${accuracy}%`}
                        />
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}
