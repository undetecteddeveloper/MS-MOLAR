// SkillRecommendationCard — "nên luyện gì tiếp theo" (PRD R10, UI Spec
// S-02/D3/D6). Server Component, KHÔNG "use client": tương tác duy nhất là
// <details>/<summary> gốc của trình duyệt (D2), không cần JavaScript.
//
// Theme "Sân trường" (2026-09-06): đây là THẺ VÀNG của màn Thống kê — chỗ táo
// bạo duy nhất (§4.1), cùng vai trò với "Trước khi bắt đầu" ở chi tiết đề và
// "Tiếp theo" ở kết quả: nơi mắt dừng lại là nơi có việc để làm. Vì thế thẻ
// mang một hành động thật: liên kết tới kho đề Toán. Engine 1 hiện chỉ có
// taxonomy Toán (chính câu cold start cũng nói "luyện một đề Toán"), nên đích
// cố định là hợp lý cho tới khi taxonomy mở rộng; lúc đó SkillRecommendation
// cần thêm môn, và liên kết này đi theo. Thay BentoCell kẻ viền của bản trước
// bằng primitive Card (viền là dấu vết theme cũ, §5).
//
// skillLabel được in NGUYÊN VĂN: nhãn kỹ năng do backend chọn và dịch sẵn (là
// nội dung chương trình học, không phải chữ giao diện). Tự cắt/gộp/xếp lại nhãn
// ở đây là để UI trôi lệch âm thầm khỏi giá trị backend thật sự đã tính.

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { t, type MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { SkillRecommendation } from "@/types/adaptive";

type ReasonCode = Exclude<SkillRecommendation, null>["reasonCode"];

const REASON_KEY: Record<ReasonCode, MessageKey> = {
  "prerequisite-gate": "analytics.recommendReasonPrerequisiteGate",
  "lowest-mastery": "analytics.recommendReasonLowestMastery",
  "recently-wrong": "analytics.recommendReasonRecentlyWrong",
};

/** Kho đề lọc sẵn môn Toán — `subject` là tham số lọc thật của /exams. */
const MATH_EXAMS_HREF = "/exams?subject=Math";

interface SkillRecommendationCardProps {
  recommendation: SkillRecommendation;
  className?: string;
}

export async function SkillRecommendationCard({
  recommendation,
  className,
}: SkillRecommendationCardProps) {
  const action = (
    <Link
      href={MATH_EXAMS_HREF}
      className={cn(buttonVariants(), "w-full sm:w-auto sm:self-start")}
    >
      {t("analytics.recommendAction")}
    </Link>
  );

  // Cold start (chưa có dòng mastery nào) là ca ĐÔNG NHẤT ngoài đời — mọi tài
  // khoản mới đều rơi vào đây — nên nó có nhánh render tử tế riêng, chứ không
  // phải thẻ rỗng hay một biến thể populated thiếu dữ liệu (AC-028). Hành động
  // giữ nguyên: câu cold start bảo "luyện một đề Toán", nút đưa thẳng tới đó.
  if (recommendation === null) {
    return (
      <Card
        as="section"
        variant="sun"
        aria-labelledby="recommend-title"
        className={cn("gap-4", className)}
      >
        <div className="flex flex-col gap-1.5">
          <h2 id="recommend-title" className="text-lg font-semibold">
            {t("analytics.recommendTitle")}
          </h2>
          <p className="text-sm leading-relaxed">{t("analytics.recommendColdStart")}</p>
        </div>
        {action}
      </Card>
    );
  }

  return (
    <Card
      as="section"
      variant="sun"
      aria-labelledby="recommend-title"
      className={cn("gap-4", className)}
    >
      <div className="flex flex-col gap-1.5">
        <h2 id="recommend-title" className="text-lg font-semibold">
          {t("analytics.recommendTitle")}
        </h2>
        <p className="text-2xl leading-snug font-bold text-balance">{recommendation.skillLabel}</p>
      </div>

      {/* Không có `open`: lời giải thích là thứ người dùng tự chủ động mở ra.
          Dấu tam giác mặc định của trình duyệt thay bằng mũi tên xoay 90° khi
          mở — cùng ngôn ngữ mũi tên với các hàng mở/đóng trong bảng lọc Kho đề. */}
      <details className="group text-sm">
        <summary className="focus-visible:ring-ring flex min-h-9 w-fit cursor-pointer list-none items-center gap-1 rounded-md font-semibold focus-visible:ring-3 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
          <ChevronRight
            aria-hidden
            className="size-4 shrink-0 transition-transform group-open:rotate-90 motion-reduce:transition-none"
          />
          {t("analytics.recommendWhy")}
        </summary>
        <p className="mt-1 pl-5 leading-relaxed">{t(REASON_KEY[recommendation.reasonCode])}</p>
      </details>

      {action}
    </Card>
  );
}
