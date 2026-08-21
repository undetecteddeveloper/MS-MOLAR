// SkillRecommendationCard — "nên luyện gì tiếp theo" (PRD R10, UI Spec
// S-02/D3/D6). Server Component, KHÔNG "use client": tương tác duy nhất là
// <details>/<summary> gốc của trình duyệt (D2), không cần JavaScript.
//
// Thẻ này đứng riêng một hàng, không nằm trong BentoGrid (D3), nên span="full"
// là bắt buộc — mặc định "half" của BentoCell sẽ hụt một nửa hàng.
//
// skillLabel được in NGUYÊN VĂN: nhãn kỹ năng do backend chọn và dịch sẵn (là
// nội dung chương trình học, không phải chữ giao diện). Tự cắt/gộp/xếp lại nhãn
// ở đây là để UI trôi lệch âm thầm khỏi giá trị backend thật sự đã tính.

import { getTranslate } from "@/lib/i18n/server";
import { BentoCell } from "@/components/layout/BentoGrid";
import type { MessageKey } from "@/lib/i18n/translate";
import type { SkillRecommendation } from "@/types/adaptive";

type ReasonCode = Exclude<SkillRecommendation, null>["reasonCode"];

const REASON_KEY: Record<ReasonCode, MessageKey> = {
  "prerequisite-gate": "analytics.recommendReasonPrerequisiteGate",
  "lowest-mastery": "analytics.recommendReasonLowestMastery",
  "recently-wrong": "analytics.recommendReasonRecentlyWrong",
};

interface SkillRecommendationCardProps {
  recommendation: SkillRecommendation;
}

export async function SkillRecommendationCard({ recommendation }: SkillRecommendationCardProps) {
  const t = await getTranslate();

  // Cold start (chưa có dòng mastery nào) là ca ĐÔNG NHẤT ngoài đời — mọi tài
  // khoản mới đều rơi vào đây — nên nó có nhánh render tử tế riêng, chứ không
  // phải thẻ rỗng hay một biến thể populated thiếu dữ liệu (AC-028).
  if (recommendation === null) {
    return (
      <BentoCell span="full">
        <span className="eyebrow">{t("analytics.recommendTitle")}</span>
        <p className="text-muted-foreground mt-2 text-sm">{t("analytics.recommendColdStart")}</p>
      </BentoCell>
    );
  }

  return (
    <BentoCell span="full">
      <span className="eyebrow">{t("analytics.recommendTitle")}</span>
      <p className="text-foreground mt-2 font-serif text-lg">{recommendation.skillLabel}</p>
      {/* Không có `open`: lời giải thích là thứ người dùng tự chủ động mở ra. */}
      <details className="text-muted-foreground mt-2 text-xs">
        <summary className="cursor-pointer">{t("analytics.recommendWhy")}</summary>
        <p className="mt-2">{t(REASON_KEY[recommendation.reasonCode])}</p>
      </details>
    </BentoCell>
  );
}
