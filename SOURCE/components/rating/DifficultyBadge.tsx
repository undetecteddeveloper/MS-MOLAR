// DifficultyBadge — độ khó cộng đồng (Rating System, ADR-0008). Thuần, không
// client hook. Consume Exam.communityDifficulty NGUYÊN VẸN từ server (bucket +
// mean từ view exams_with_difficulty) — KHÔNG re-bucket ở client (AC-018).
//
// Theme "Sân trường": nhãn chữ + thang 3 vạch (Dễ 1 / Trung bình 2 / Khó 3) —
// trạng thái đọc được bằng hình lẫn chữ. `card` trả <span> (đặt trong hàng meta
// của ExamCard), `detail` trả <dd> (khớp <dl> của trang chi tiết đề).

"use client";

import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { Bucket, CommunityDifficulty } from "@/lib/rating";
import { formatMean } from "@/lib/rating";

/** Bucket là giá trị NGHIỆP VỤ (khớp view SQL) — chỉ nhãn hiển thị là tiếng Việt. */
const BUCKET_KEY: Record<Bucket, MessageKey> = {
  Easy: "exams.levelEasy",
  Medium: "exams.levelMedium",
  Hard: "exams.levelHard",
};

const BUCKET_STEPS: Record<Bucket, number> = { Easy: 1, Medium: 2, Hard: 3 };

interface DifficultyBadgeProps {
  /** null (chưa đủ ngưỡng RATING_THRESHOLD lượt) hoặc undefined (field thiếu)
   *  → "—" (fail-safe, không throw, AC-015). */
  communityDifficulty: CommunityDifficulty | null | undefined;
  variant: "card" | "detail";
}

export function DifficultyBadge({ communityDifficulty, variant }: DifficultyBadgeProps) {
  const label = communityDifficulty ? t(BUCKET_KEY[communityDifficulty.bucket]) : "—";
  const mean = communityDifficulty ? formatMean(communityDifficulty.mean) : null;
  const steps = communityDifficulty ? BUCKET_STEPS[communityDifficulty.bucket] : 0;

  const meter = (
    <span aria-hidden className="inline-flex items-center gap-0.5">
      {[1, 2, 3].map((n) => (
        <span
          key={n}
          className={`h-2 w-1.5 rounded-sm ${n <= steps ? "bg-primary" : "bg-border"}`}
        />
      ))}
    </span>
  );

  if (variant === "detail") {
    return (
      <dd
        className={`mt-1 flex items-center gap-2 text-xl font-semibold ${
          communityDifficulty ? "text-foreground" : "text-muted-foreground"
        }`}
      >
        {label}
        {mean && <span className="text-muted-foreground text-sm font-normal">{mean}</span>}
        {meter}
      </dd>
    );
  }

  return (
    <span
      className="text-muted-foreground inline-flex items-center gap-1.5 text-sm"
      title={mean ? `${label} ${mean}` : undefined}
    >
      {label}
      {meter}
    </span>
  );
}
