"use client";

// SolutionAuthorCard (C-23) — thẻ đầu màn xem một bài giải (S-05): danh tính,
// "Cập nhật …", nhãn ghim, hàng hành động Hữu ích/điểm/"⋯" (AC-058). UI Spec §
// Component: SolutionAuthorCard; frontend DD § Main Components "HelpfulButton.tsx
// (new, client) and its error line in SolutionAuthorCard".
//
// `now`: cùng quy ước `SolutionCard.tsx` — một `Date` route dựng MỘT LẦN cho
// cả lượt render, không bao giờ tự gọi `relativeTime(iso)` bằng đối số mặc
// định (SolutionCard.tsx đầu file có lý do đầy đủ).
//
// `solution.isMine` điều khiển CẢ hai khác biệt AC-062 đòi cùng lúc: chữ "x
// hữu ích" thay nút Hữu ích, VÀ (bên trong `SolutionMenu`) mục "Sửa bài giải"
// thay "Báo cáo bài giải" — không có nhánh nào ở đây tự suy lại sở hữu từ
// `solution.author.kind` (cùng bất biến `SolutionCard`).

import { useState } from "react";
import { Pin } from "lucide-react";
import { AuthorIdentity } from "@/features/solutions/components/AuthorIdentity";
import { HelpfulButton } from "@/features/solutions/components/HelpfulButton";
import { SolutionMenu } from "@/features/solutions/components/SolutionMenu";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { relativeTime } from "@/lib/format/relativeTime";
import { t } from "@/lib/copy";
import type { SolutionDetail } from "@/features/solutions/queries";

export type SolutionAuthorCardHeader = Pick<
  SolutionDetail,
  | "id"
  | "author"
  | "isPinned"
  | "updatedAt"
  | "score"
  | "scoreGrading"
  | "isMine"
  | "helpfulCount"
  | "iMarkedHelpful"
  | "iReported"
>;

export interface SolutionAuthorCardProps {
  solution: SolutionAuthorCardHeader;
  examId: string;
  now: Date;
  /** Tác giả ĐỀ (không phải tác giả bài) — điều khiển mục ghim/bỏ ghim của
   *  `SolutionMenu` (AC-077). Xem ghi chú `SolutionMenu.isExamAuthor`. */
  isExamAuthor: boolean;
  /** Bắt buộc khi `solution.isMine` — xem `SolutionMenu.editHref`. */
  editHref?: string;
}

/** Huy hiệu điểm — ĐÚNG hai hình dạng, không có hình thứ ba (Reference
 *  Contract Value #18, AC-040/AC-041, dấu chấm thập phân UI-D3/D47) — cùng
 *  luật `SolutionCard.ScoreBadge` (Rule of Three: đây mới là lần dùng lại thứ
 *  hai, chưa gộp thành một hàm dùng chung). */
function ScoreBadge({ score, scoreGrading }: Pick<SolutionAuthorCardHeader, "score" | "scoreGrading">) {
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

export function SolutionAuthorCard({ solution, examId, now, isExamAuthor, editHref }: SolutionAuthorCardProps) {
  // Local mirror của `isPinned`/dòng lỗi Hữu ích — cả hai chỉ đổi khi CON báo
  // kết quả lên qua callback (`SolutionMenu.onPinnedChange`, `HelpfulButton.onError`);
  // component này không tự gọi action nào (AC-058, AC-077).
  const [isPinned, setIsPinned] = useState(solution.isPinned);
  const [helpfulError, setHelpfulError] = useState<string | null>(null);

  return (
    <Card as="section" variant="tint" className="gap-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <AuthorIdentity identity={solution.author} size={32} />
        <span className="text-muted-foreground text-sm">
          {t("solutions.card.updated", { time: relativeTime(solution.updatedAt, now) })}
        </span>
        {isPinned && (
          <Badge variant="sun" className="w-fit">
            <Pin aria-hidden />
            {t("solutions.card.pinned")}
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {solution.isMine ? (
          <span className="flex-1 text-sm text-muted-foreground">
            {t("solutions.view.helpfulCount", { count: solution.helpfulCount })}
          </span>
        ) : (
          <HelpfulButton
            solutionId={solution.id}
            initialPressed={solution.iMarkedHelpful}
            initialCount={solution.helpfulCount}
            onError={setHelpfulError}
          />
        )}
        <ScoreBadge score={solution.score} scoreGrading={solution.scoreGrading} />
        <SolutionMenu
          solutionId={solution.id}
          examId={examId}
          isPinned={isPinned}
          isExamAuthor={isExamAuthor}
          isMine={solution.isMine}
          editHref={editHref}
          iReported={solution.iReported}
          onPinnedChange={setIsPinned}
        />
      </div>

      {helpfulError && (
        <p role="alert" className="text-destructive text-sm">
          {helpfulError}
        </p>
      )}
    </Card>
  );
}
