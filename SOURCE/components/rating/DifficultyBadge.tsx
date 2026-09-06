// DifficultyBadge — độ khó cộng đồng (Rating System, ADR-0008). Thuần, không
// client hook. Consume Exam.communityDifficulty NGUYÊN VẸN từ server (bucket +
// mean từ view exams_with_difficulty) — KHÔNG re-bucket ở client (AC-018).
//
// Theme "Sân trường": nhãn chữ + thang 3 vạch (Dễ 1 / Trung bình 2 / Khó 3) —
// trạng thái đọc được bằng hình lẫn chữ.
//
// CẢ HAI biến thể trả <span> NỘI TUYẾN, không tự mang thẻ ngữ nghĩa nào:
//   card    hàng meta của ExamCard — chữ dịu 14px, mean nằm trong `title`.
//   detail  GIÁ TRỊ của một dòng trong bảng thông số ở trang chi tiết đề —
//           mean hiện thành chữ, cỡ và màu thừa hưởng từ <dd> của dòng đó.
//
// Trước 2026-09-06 biến thể `detail` tự trả <dd> để cắm thẳng vào <dl> của
// trang chi tiết đề. Bản dựng lại của trang gom <dt> và <dd> về một component
// dòng dùng chung, nên <dd> tự-mang đó rơi vào trong một <dd> khác — HTML sai
// và React báo lỗi hydration. Nay ngữ nghĩa <dl> chỉ do NƠI GỌI quyết định,
// component này chỉ lo phần nhìn.

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
      // Chưa đủ lượt chấm → cả dòng dịu lại; có giá trị thì để nguyên màu và độ
      // đậm của <dd> bọc ngoài, để mọi giá trị trong bảng thông số cùng một cỡ.
      <span
        className={`inline-flex items-center gap-2 ${
          communityDifficulty ? "" : "text-muted-foreground"
        }`}
      >
        {label}
        {mean && <span className="text-muted-foreground text-sm font-normal">{mean}</span>}
        {meter}
      </span>
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
