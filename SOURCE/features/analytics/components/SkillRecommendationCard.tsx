"use client";

// SkillRecommendationCard — "nên luyện gì tiếp theo" cho CẢ 7 MÔN (brief
// docs/plans/20261003-feature-weak-skill-suggestions.md). Đảo client chỉ vì hàng
// chip môn: chọn chip là đổi tại chỗ, dữ liệu của cả bảy môn đã tính sẵn ở server.
//
// Hướng giao diện do người dùng chọn từ prototype (2026-10-03): hướng B "Vàng
// chỉ khi có việc" — thẻ là THẺ VÀNG (`sun`, chỗ táo bạo duy nhất của màn Thống
// kê, Card variant `sun`) chỉ khi môn đang chọn có gợi ý để làm; hết việc thì
// đổi sang `plain` trung tính. Màu nói được "có việc hay không", nên không thêm
// chấm báo việc lên chip và không cần nhắc người dùng đoán chip nào đáng bấm
// (môn mở sẵn đã là môn đầu tiên có việc — `defaultSuggestionSubject`).
//
// Năm trạng thái của một môn (lib/analytics/weakSkillSuggestions.ts):
//  - suggest: nhãn dạng yếu, "Đúng a/b câu (p%) · Còn n đề chưa làm", nút "Tìm
//    đề dạng này" → /exams?subject=…&skill=… (lưới chỉ có đề chứa dạng đó).
//  - none/all-done, none/no-exam, none/no-weak: "Không có gì để luyện" + MỘT lý
//    do riêng cho từng ca, KHÔNG có nút — không dẫn học sinh tới một lưới chỉ có
//    đề cũ hay một lưới trống.
//  - none/no-data: cũng không có nút lớn, chỉ một liên kết chữ nhỏ tới đề của
//    môn để học sinh bắt đầu (quyết định của người dùng).
//
// skillLabel được in NGUYÊN VĂN: nhãn dạng bài do taxonomy đặt và dịch sẵn (là
// nội dung chương trình học, không phải chữ giao diện).

import { useState } from "react";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { MASTERY_CLEARED_THRESHOLD } from "@/lib/adaptive/constants";
import type { Subject } from "@/lib/analytics/constants";
import {
  defaultSuggestionSubject,
  examsHref,
  type SubjectSuggestion,
} from "@/lib/analytics/weakSkillSuggestions";
import { t } from "@/lib/copy";
import { SUBJECT_LABELS } from "@/lib/ugc/subjects";
import { cn } from "@/lib/utils";

type Suggest = Extract<SubjectSuggestion, { kind: "suggest" }>;
type None = Extract<SubjectSuggestion, { kind: "none" }>;

function percentOf(correct: number, total: number): number {
  return total > 0 ? Math.round((correct / total) * 100) : 0;
}

function SuggestBody({ suggestion }: { suggestion: Suggest }) {
  const { subject, skillNodeId, skillLabel, correct, total, openExamCount } = suggestion;
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-2xl leading-snug font-bold text-balance">{skillLabel}</p>
        <p className="text-sm leading-relaxed">
          {t("analytics.recommendStats", {
            correct,
            total,
            percent: percentOf(correct, total),
            open: openExamCount,
          })}
        </p>
      </div>
      <Link
        href={examsHref(subject, skillNodeId)}
        className={cn(buttonVariants(), "w-full sm:w-auto sm:self-start")}
      >
        {t("analytics.recommendAction")}
      </Link>
    </>
  );
}

function reasonText(suggestion: None): string {
  switch (suggestion.reason) {
    case "no-weak":
      return t("analytics.recommendNoWeak", {
        percent: Math.round(MASTERY_CLEARED_THRESHOLD * 100),
      });
    case "all-done":
      return t("analytics.recommendAllDone", {
        skill: suggestion.skillLabel,
        correct: suggestion.correct,
        total: suggestion.total,
      });
    case "no-exam":
      return t("analytics.recommendNoExam", {
        skill: suggestion.skillLabel,
        correct: suggestion.correct,
        total: suggestion.total,
      });
    case "no-data":
      return t("analytics.recommendNoData");
  }
}

function NoneBody({ suggestion }: { suggestion: None }) {
  return (
    <>
      <div className="flex flex-col gap-1.5">
        <p className="text-xl leading-snug font-bold">{t("analytics.recommendNoneTitle")}</p>
        <p className="text-sm leading-relaxed">{reasonText(suggestion)}</p>
      </div>
      {suggestion.reason === "no-data" && (
        <Link
          href={examsHref(suggestion.subject)}
          // `link` của Button là chữ gạch chân không có chiều cao riêng; min-h-11 giữ
          // vùng chạm 44px (sàn của repo) mà không biến nó thành nút.
          className={cn(buttonVariants({ variant: "link" }), "min-h-11 w-fit")}
        >
          {t("analytics.recommendViewExams", { subject: SUBJECT_LABELS[suggestion.subject] })}
        </Link>
      )}
    </>
  );
}

interface SkillRecommendationCardProps {
  /** Đủ 7 môn theo `SUBJECT_ORDER` (`suggestWeakSkills`). */
  suggestions: SubjectSuggestion[];
  className?: string;
}

export function SkillRecommendationCard({ suggestions, className }: SkillRecommendationCardProps) {
  const [selected, setSelected] = useState<Subject>(() => defaultSuggestionSubject(suggestions));
  const current = suggestions.find((s) => s.subject === selected) ?? suggestions[0];
  if (!current) return null;

  return (
    <Card
      as="section"
      variant={current.kind === "suggest" ? "sun" : "plain"}
      aria-labelledby="recommend-title"
      className={cn("gap-4", className)}
    >
      <h2 id="recommend-title" className="text-lg font-semibold">
        {t("analytics.recommendTitle")}
      </h2>

      {/* Chip xuống dòng (không cuộn ngang): cả bảy môn nhìn thấy cùng lúc. h-11 =
          sàn vùng chạm 44px, cao hơn chip 40px mặc định của Chip. */}
      <div role="group" aria-label={t("analytics.recommendSubjects")} className="flex flex-wrap gap-2">
        {suggestions.map((s) => (
          <Chip
            key={s.subject}
            active={s.subject === current.subject}
            onClick={() => setSelected(s.subject)}
            className="h-11"
          >
            {SUBJECT_LABELS[s.subject]}
          </Chip>
        ))}
      </div>

      {/* aria-live: bấm chip đổi nội dung tại chỗ, không đổi trang — trình đọc màn
          hình cần nghe được môn mới nói gì. */}
      <div aria-live="polite" className="flex flex-col gap-4">
        {current.kind === "suggest" ? (
          <SuggestBody suggestion={current} />
        ) : (
          <NoneBody suggestion={current} />
        )}
      </div>
    </Card>
  );
}
