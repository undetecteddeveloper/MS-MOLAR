// CommentNotificationCard (C-36) — một thẻ trong ô "Bình luận" của hồ sơ
// (UI Spec § Component: CommentNotificationCard; frontend DD § Data Contracts
// "Comment feed contract"). Server Component THUẦN (không "use client", không
// hook) — chứa `RichText` cho trích nội dung, nên KHÔNG BAO GIỜ được import từ
// một file "use client" (ADR-0002/TD-021: làm vậy đẩy 122.5 KB gzip
// markdown/KaTeX sang trình duyệt cho MỌI lượt tải `/profile`).
//
// CHỈ TÊN, KHÔNG AVATAR: feed (`getMyCommentFeed`) gọi `toAuthorIdentity` với
// `author_avatar_url: null` — một hàng có tên không bao giờ mang `avatarUrl`
// (frontend DD § Data Contracts "Comment feed contract"). File này không render
// `Avatar`/`AnonymousAvatar` hay bất kỳ chỗ giữ chỗ ảnh nào, và không đọc
// trường ảnh nào của `item.author` (trường đó không tồn tại trên nhánh named
// của kiểu `AuthorIdentity` khi không có `avatarUrl`).
import Link from "next/link";
import { Reply } from "lucide-react";
import { Card } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { RichText } from "@/components/shared/RichText";
import { relativeTime } from "@/lib/format/relativeTime";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import type { CommentFeedItem } from "@/features/solutions/queries";

export interface CommentNotificationCardProps {
  item: CommentFeedItem;
  /** Một `Date` do route tạo MỘT LẦN cho cả lượt render — cùng quy ước
   *  `SolutionCard`'s `now` (frontend DD § lib/format/relativeTime.ts). */
  now: Date;
}

export function CommentNotificationCard({ item, now }: CommentNotificationCardProps) {
  const name = item.author.kind === "named" ? item.author.displayName : t("solutions.identity.anonymous");
  // Đúng công thức đếm (backend task 26, `lib/solutions/unreadComments.ts`):
  // isUnread && examVisible — không viết lại luật riêng ở đây, chỉ áp cho MỘT
  // hàng thay vì một mảng (AC-091, AC-098: đề không hiện ⇒ không chấm).
  const isNew = item.isUnread && item.examVisible;
  const lineKey = item.commentBody.includes("?") ? "profile.comments.asked" : "profile.comments.commented";

  return (
    <Card as="li" variant="tint" className="gap-2">
      <div className="flex items-center gap-2">
        {isNew && <span aria-hidden className="bg-destructive size-2 shrink-0 rounded-full" />}
        <span className="flex-1 truncate text-xs">{item.examTitle}</span>
        <span className="text-muted-foreground shrink-0 text-xs">
          {relativeTime(item.commentCreatedAt, now)}
        </span>
      </div>

      <p className="text-sm">{t(lineKey, { name, questionNumber: item.questionNumber })}</p>

      <RichText text={item.commentBody} className="line-clamp-2 text-sm text-muted-foreground" />

      {item.examVisible ? (
        <Link
          href={`/exams/${item.examId}/solutions/${item.solutionId}?q=${item.questionNumber}&comments=1`}
          className={cn(buttonVariants({ variant: "secondary" }), "w-fit")}
        >
          <Reply aria-hidden />
          {t("profile.comments.reply")}
        </Link>
      ) : (
        // Đề không còn hiện (S8/AC-098) — KHÔNG BAO GIỜ một liên kết gãy: thay
        // hẳn bằng dòng trạng thái, không có chấm (đã khoá ở `isNew` trên), và
        // không tính vào số đếm nào (chip/own-card đều đọc examVisible riêng).
        <p className="text-muted-foreground text-sm">{t("profile.comments.examHidden")}</p>
      )}
    </Card>
  );
}
