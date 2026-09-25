// SolutionCard (C-06) — một thẻ bài giải trong danh sách (S-03); cả thẻ là
// một liên kết tới màn xem (AC-055). UI Spec § Component: SolutionCard;
// frontend DD § Main Components "features/solutions/components/SolutionList.tsx
// + SolutionCard.tsx". `SolutionList` (khung trang, `ul`, trạng thái rỗng) là
// task 18 — file này chỉ dựng MỘT hàng.
//
// `examId` chỉ dùng để dựng liên kết phủ thẻ `/exams/{examId}/solutions/{item.id}`
// — không dùng cho việc gì khác trong component này (`editHref` do CHA truyền
// sẵn, không dựng lại ở đây).
//
// `now`: một `Date` do route tạo MỘT LẦN cho cả lượt render, KHÔNG BAO GIỜ gọi
// `relativeTime(iso)` bằng đối số mặc định — hai lần gọi `new Date()` khác
// nhau giữa server và lúc hydrate sẽ in ra hai chuỗi khác nhau (frontend DD §
// "lib/format/relativeTime.ts").
//
// Tín hiệu sở hữu CHỈ từ `isMine`/`editHref`, KHÔNG BAO GIỜ so `item.author`
// (AC-053, AC-062): bài của chính người viết dưới danh tính ẩn danh vẫn hiện
// "Ẩn danh" VÀ "Bài của bạn" VÀ liên kết "Sửa" — hai tín hiệu độc lập nhau,
// không có nhánh nào đọc `item.author.kind` để quyết định sở hữu.
import Link from "next/link";
import { MessageCircle, Pin, ThumbsUp } from "lucide-react";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format/relativeTime";
import { t } from "@/lib/copy";
import type { SolutionListItem } from "@/features/solutions/queries";

export interface SolutionCardProps {
  item: SolutionListItem;
  examId: string;
  now: Date;
  /** Chỉ CHA truyền cho ĐÚNG hàng có `item.isMine === true`. Vắng mặt ⇒ không
   *  có liên kết "Sửa" nào render — không có nhánh nào trong file này tự kiểm
   *  lại `isMine` cho liên kết này (frontend DD § SolutionCard/SolutionList). */
  editHref?: string;
}

/** Huy hiệu điểm — ĐÚNG hai hình dạng, không có hình thứ ba (Reference
 *  Contract Value #18, AC-040/AC-041, dấu chấm thập phân UI-D3/D47).
 *  `score` vắng mặt ⇒ `null` dù `scoreGrading` nói gì (AC-040 thắng). */
function ScoreBadge({ score, scoreGrading }: Pick<SolutionListItem, "score" | "scoreGrading">) {
  if (score === undefined) return null;
  const scoreText = score.toFixed(1);
  const label = scoreGrading
    ? t("solutions.scorePending", { score: scoreText })
    : scoreText + " " + t("result.outOfTen");
  return (
    <Badge variant="plain" className="tabular-nums">
      {label}
    </Badge>
  );
}

export function SolutionCard({ item, examId, now, editHref }: SolutionCardProps) {
  const viewHref = `/exams/${examId}/solutions/${item.id}`;
  const openLabelName =
    item.author.kind === "named" ? item.author.displayName : t("solutions.identity.anonymous");

  return (
    <Card as="li" variant="tint" className="card-linked relative gap-2.5">
      <Link
        href={viewHref}
        aria-label={t("solutions.card.openLabel", { name: openLabelName })}
        className="card-link absolute inset-0 z-0 rounded-card focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      />

      {item.isPinned && (
        <Badge variant="sun" className="w-fit">
          <Pin aria-hidden />
          {t("solutions.card.pinned")}
        </Badge>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <AuthorIdentity identity={item.author} size={32} />
        <span className="text-muted-foreground text-sm">
          {t("solutions.card.updated", { time: relativeTime(item.updatedAt, now) })}
        </span>
        <ScoreBadge score={item.score} scoreGrading={item.scoreGrading} />
      </div>

      <div className="text-muted-foreground flex items-center gap-3 text-sm">
        <span className="inline-flex items-center gap-1">
          <ThumbsUp aria-hidden className="size-4" />
          {t("solutions.card.helpfulCount", { count: item.helpfulCount })}
        </span>
        <span className="inline-flex items-center gap-1">
          <MessageCircle aria-hidden className="size-4" />
          {t("solutions.card.commentCount", { count: item.commentCount })}
        </span>
      </div>

      {item.isMine && (
        <div className="flex items-center gap-2">
          <Badge variant="surface">{t("solutions.card.mine")}</Badge>
          {editHref && (
            <Link
              href={editHref}
              className="text-primary focus-visible:ring-ring/40 relative z-10 w-fit text-sm font-medium underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:outline-none"
            >
              {t("common.edit")}
            </Link>
          )}
        </div>
      )}
    </Card>
  );
}
