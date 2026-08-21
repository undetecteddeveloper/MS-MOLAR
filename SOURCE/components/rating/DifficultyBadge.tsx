// DifficultyBadge — hiển thị độ khó cộng đồng (Rating System, ADR-0008). Thuần,
// không client hook (vitest jsdom render test đơn giản, không cần user-event).
// Consume Exam.communityDifficulty NGUYÊN VẸN từ server (bucket + mean từ
// view exams_with_difficulty qua toExam) — KHÔNG re-bucket/re-compute ở client
// (AC-018). variant chọn kiểu chữ đúng "ô" đang render: "card" (muted, ExamCard
// Level cell) vs "detail" (serif, exam-detail Difficulty cell) — tự trả về
// <dd> để khớp đúng slot cũ (dl ExamCard / dl exam-detail).

"use client";

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import type { Bucket, CommunityDifficulty } from "@/lib/rating";
import { formatMean } from "@/lib/rating";

/** Bucket là giá trị NGHIỆP VỤ (khớp view SQL) — chỉ nhãn hiển thị đổi theo
 *  ngôn ngữ, giá trị gốc giữ nguyên. */
const BUCKET_KEY: Record<Bucket, MessageKey> = {
  Easy: "exams.levelEasy",
  Medium: "exams.levelMedium",
  Hard: "exams.levelHard",
};

interface DifficultyBadgeProps {
  /** null (chưa đủ ngưỡng RATING_THRESHOLD lượt) hoặc undefined (field thiếu,
   *  vd nguồn Exam khác toExam) → "—" (fail-safe, không throw, AC-015). */
  communityDifficulty: CommunityDifficulty | null | undefined;
  variant: "card" | "detail";
}

export function DifficultyBadge({ communityDifficulty, variant }: DifficultyBadgeProps) {
  const t = useT();
  const label = communityDifficulty
    ? `${t(BUCKET_KEY[communityDifficulty.bucket])} · ${formatMean(communityDifficulty.mean)}`
    : "—";

  if (variant === "detail") {
    return (
      <dd
        className={`mt-2 font-serif text-2xl ${
          communityDifficulty ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
      </dd>
    );
  }

  return <dd className="text-[var(--block-fg-muted)]">{label}</dd>;
}
