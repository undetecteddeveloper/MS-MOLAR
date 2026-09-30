// LatestSolutionsSpotlight — kệ "Lời giải cộng đồng mới nhất" trên trang chủ,
// chỉ hiện khi đã đăng nhập VÀ có ít nhất một bài đủ điều kiện (F-041,
// 2026-09-30). Dữ liệu từ `listLatestSolutionsForHome()`
// (features/solutions/queries.ts), vốn đã cá nhân hoá theo eligibility ngay
// trong RPC (schema.sql §26) — component này không lọc lại gì thêm.
//
// Thẻ mượn ĐÚNG bố cục của SolutionCard (features/solutions/components/) —
// subject/grade thay cho huy hiệu ghim, không có comment count/score/isMine vì
// RPC trang chủ cố tình không đọc mấy trường đó (một thẻ GIỚI THIỆU, bấm vào
// mới sang màn xem đầy đủ).
//
// SỐ LE VÀO KHUNG NHÌN (2026-09-30, F-041 tiếp nối) — `ScrollRevealGroup` thay
// chính `<ul>`, mỗi thẻ mang `.motion-reveal` + `--motion-i` theo thứ tự (app/
// globals.css § TRANG CHỦ SỐNG ĐỘNG), cùng cách `.motion-grow-x` mọc thanh
// biểu đồ Thống kê.
import Link from "next/link";
import { ThumbsUp } from "lucide-react";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollRevealGroup } from "@/components/shared/ScrollRevealGroup";
import { relativeTime } from "@/lib/format/relativeTime";
import { subjectLabel } from "@/lib/ugc/subjects";
import { t } from "@/lib/copy";
import type { HomeSolutionTeaser } from "@/features/solutions/queries";

interface LatestSolutionsSpotlightProps {
  items: readonly HomeSolutionTeaser[];
  /** Một `Date` do route tạo MỘT LẦN cho cả lượt render — cùng quy ước
   *  `relativeTime` với SolutionCard (server/hydrate không được lệch chuỗi). */
  now: Date;
}

export function LatestSolutionsSpotlight({ items, now }: LatestSolutionsSpotlightProps) {
  return (
    <section aria-labelledby="home-solutions" className="flex flex-col gap-3">
      <h2 id="home-solutions" className="eyebrow">
        {t("home.solutions.title")}
      </h2>
      <ScrollRevealGroup as="ul" className="grid gap-3 sm:grid-cols-3">
        {items.map((item, index) => (
          <HomeSolutionCard key={item.id} item={item} now={now} index={index} />
        ))}
      </ScrollRevealGroup>
    </section>
  );
}

function HomeSolutionCard({
  item,
  now,
  index,
}: {
  item: HomeSolutionTeaser;
  now: Date;
  index: number;
}) {
  const href = `/exams/${item.examId}/solutions/${item.id}`;
  const openLabelName =
    item.author.kind === "named" ? item.author.displayName : t("solutions.identity.anonymous");

  return (
    <Card
      as="li"
      variant="tint"
      className="card-linked motion-reveal relative gap-2.5"
      style={{ "--motion-i": index } as React.CSSProperties}
    >
      <Link
        href={href}
        aria-label={t("solutions.card.openLabel", { name: openLabelName })}
        className="card-link absolute inset-0 z-0 rounded-card focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="plain">{subjectLabel(item.examSubject)}</Badge>
        <Badge variant="plain">{t("exams.gradeValue", { grade: item.examGrade })}</Badge>
      </div>

      <AuthorIdentity identity={item.author} size={32} />

      <div className="text-muted-foreground flex items-center justify-between gap-3 text-sm">
        <span>{t("solutions.card.updated", { time: relativeTime(item.updatedAt, now) })}</span>
        <span className="inline-flex items-center gap-1">
          <ThumbsUp aria-hidden className="size-4" />
          {t("solutions.card.helpfulCount", { count: item.helpfulCount })}
        </span>
      </div>
    </Card>
  );
}
