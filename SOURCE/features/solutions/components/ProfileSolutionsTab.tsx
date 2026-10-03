// ProfileSolutionsTab — nội dung ô "Bài giải" của hồ sơ, render theo
// `?tab=solutions` (2026-10-03, docs/plans/20261003-feature-profile-solutions-tab.md).
// Cho người đã viết bài giải vào lại trang sửa/xem bài của mình trong hai thao
// tác: chip "Bài giải" rồi nút trên thẻ — trước đó chỉ có nút "Sửa bài giải" ở
// trang kết quả của TỪNG đề, nên phải nhớ đúng đề.
//
// Server Component, không có state client: URL là nguồn sự thật duy nhất, cùng
// quy ước `ProfileCommentsTab`. Mỗi thẻ là một bài giải của một đề — tên đề, môn
// và lớp, nhãn trạng thái, thời điểm cập nhật; "hữu ích" chỉ hiện ở bài đã đăng
// (bài nháp/bị ẩn không ai bấm được). Hai nút: "Sửa bài giải" (luôn có nếu mở
// được) và "Xem" (chỉ bài đã đăng, vì bài nháp/bị ẩn không có trang xem công
// khai).
//
// Đề không còn hiện (chưa published / tác giả đề bị ban) hoặc không còn lượt nộp
// để gắn: KHÔNG nút nào, thay bằng dòng "Đề không còn hiện" — cùng quy ước thẻ
// bình luận (`CommentNotificationCard`): trang viết/xem sẽ redirect ở những ca
// đó, một liên kết dẫn tới redirect là một liên kết gãy.
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format/relativeTime";
import { t, type MessageKey } from "@/lib/copy";
import { subjectLabel } from "@/lib/ugc/subjects";
import { cn } from "@/lib/utils";
import {
  getMySolutions,
  type MySolutionItem,
  type SolutionStatus,
} from "@/features/solutions/queries";

/** Bảng tra nhãn trạng thái — MỘT chỗ, không rẽ nhánh rải rác. */
const STATUS_LABEL_KEY = {
  draft: "profile.solutions.statusDraft",
  published: "profile.solutions.statusPublished",
  hidden: "profile.solutions.statusHidden",
} as const satisfies Record<SolutionStatus, MessageKey>;

const STATUS_BADGE_VARIANT = {
  draft: "muted",
  published: "success",
  hidden: "wrong",
} as const satisfies Record<SolutionStatus, "muted" | "success" | "wrong">;

/** Nhãn nút chính theo trạng thái: nháp là "Viết tiếp" (việc còn dở), còn lại
 *  là "Sửa bài giải" — cùng hai nhãn `SolutionEntryCard` dùng cho cùng việc. */
const EDIT_LABEL_KEY = {
  draft: "solutions.entry.continue",
  published: "solutions.entry.edit",
  hidden: "solutions.entry.edit",
} as const satisfies Record<SolutionStatus, MessageKey>;

function MySolutionCard({ item, now }: { item: MySolutionItem; now: Date }) {
  const canOpen = item.examVisible && item.attemptId !== null;
  const editLabel = t(EDIT_LABEL_KEY[item.status]);
  const viewLabel = t("profile.solutions.view");

  return (
    <Card as="li" variant="tint" className="gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="plain">{subjectLabel(item.examSubject)}</Badge>
        <Badge variant="plain">{t("exams.gradeValue", { grade: item.examGrade })}</Badge>
        <Badge variant={STATUS_BADGE_VARIANT[item.status]}>{t(STATUS_LABEL_KEY[item.status])}</Badge>
      </div>

      <h2 className="text-base leading-snug font-semibold text-balance">{item.examTitle}</h2>

      <p className="text-muted-foreground flex flex-wrap items-center gap-x-3 text-sm">
        <span>{t("solutions.card.updated", { time: relativeTime(item.updatedAt, now) })}</span>
        {item.status === "published" && (
          <span>{t("solutions.card.helpfulCount", { count: item.helpfulCount })}</span>
        )}
      </p>

      {canOpen ? (
        <div className="flex flex-wrap items-stretch gap-2">
          <Link
            href={`/exams/${item.examId}/attempt/${item.attemptId}/solution`}
            aria-label={t("profile.solutions.openLabel", { action: editLabel, title: item.examTitle })}
            className={cn(buttonVariants(), "min-w-32 flex-1 sm:flex-none")}
          >
            {editLabel}
          </Link>
          {item.status === "published" && (
            <Link
              href={`/exams/${item.examId}/solutions/${item.solutionId}`}
              aria-label={t("profile.solutions.openLabel", { action: viewLabel, title: item.examTitle })}
              className={cn(buttonVariants({ variant: "secondary" }), "min-w-24 flex-1 sm:flex-none")}
            >
              {viewLabel}
            </Link>
          )}
        </div>
      ) : (
        <p className="text-muted-foreground text-sm">{t("profile.solutions.examHidden")}</p>
      )}
    </Card>
  );
}

export async function ProfileSolutionsTab() {
  let items: MySolutionItem[];
  try {
    items = await getMySolutions();
  } catch {
    // Lỗi truy vấn THẬT — băng lỗi cục bộ trong tab, không kéo cả trang xuống
    // error.tsx (tab Tài khoản vẫn dùng được bình thường).
    return (
      <div role="alert" className="flex flex-col items-start gap-2">
        <p className="text-destructive text-sm">{t("profile.solutions.loadError")}</p>
        <a
          href="/profile?tab=solutions"
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t("common.retry")}
        </a>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <Card variant="outline" className="items-center gap-1 border-dashed px-6 py-12 text-center">
        <p className="text-muted-foreground text-sm">{t("profile.solutions.empty")}</p>
        <p className="text-muted-foreground text-sm">{t("profile.solutions.emptyHowTo")}</p>
      </Card>
    );
  }

  const now = new Date();

  return (
    <ul className="flex flex-col gap-3">
      {items.map((item) => (
        <MySolutionCard key={item.solutionId} item={item} now={now} />
      ))}
    </ul>
  );
}
