// Admin — mục "Bài giải bị báo cáo" trên /admin (UI Spec C-37; PRD R17,
// AC-081, AC-109). Hai phần: "Chờ xử lý" (bài đã đăng) và "Đã ẩn" (bài đang bị
// ẩn). Phần của một hàng CHỈ theo `row.status` — không lọc theo số báo cáo:
// hàng `hidden` với 0 báo cáo vẫn là một hàng (Reference Contract Value #26),
// và bình luận bị ẩn không bao giờ kéo hàng sang phần khác (AC-107). Không có
// "Bỏ qua"/"Đóng báo cáo" (AC-109).
//
// Không `"use client"`: mục này không có state; trang server render nó và
// ReportedSolutionRow (client) nhận Server Action qua prop. B4: không import gì
// từ `@/features/solutions/**` — `app/(admin)/admin/page.tsx` ghép dữ liệu.

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import type { AdminModerationFormAction } from "@/features/admin/components/ReportedCommentItem";
import {
  ReportedSolutionRow,
  type AdminReportedSolution,
  type AdminSolutionNote,
} from "@/features/admin/components/ReportedSolutionRow";

export interface ReportedSolutionQueueItem {
  row: AdminReportedSolution;
  /** Ghi chú của đúng hàng này — trang ghép theo cặp, không tra bảng nên không
   *  có đường nào rơi về `[]` giả ("Chưa có lời giải") khi thiếu dữ liệu. */
  notes: AdminSolutionNote[];
}

export interface ReportedSolutionsSectionProps {
  items: ReportedSolutionQueueItem[];
  now: Date;
  onModerateSolution: AdminModerationFormAction;
  onModerateComment: AdminModerationFormAction;
}

const TITLE_ID = "admin-reported-solutions-title";

export function ReportedSolutionsSection({
  items,
  now,
  onModerateSolution,
  onModerateComment,
}: ReportedSolutionsSectionProps) {
  const pending = items.filter((item) => item.row.status === "published");
  const hidden = items.filter((item) => item.row.status === "hidden");

  return (
    <section aria-labelledby={TITLE_ID} className="flex flex-col gap-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span id={TITLE_ID}>{t("admin.solutions.title")}</span>
        <Badge variant="surface" className="tabular-nums">
          {items.length}
        </Badge>
      </h2>

      {[
        { key: "pending", title: t("admin.awaitingReview"), part: pending },
        { key: "hidden", title: t("admin.solutions.hiddenPart"), part: hidden },
      ].map(({ key, title, part }) => {
        const partTitleId = `${TITLE_ID}-${key}`;
        return (
          <section key={key} aria-labelledby={partTitleId} className="flex flex-col gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <span id={partTitleId}>{title}</span>
              <Badge variant="surface" className="tabular-nums">
                {part.length}
              </Badge>
            </h3>
            {part.length === 0 ? (
              <Card variant="outline" className="items-center border-dashed py-8 text-center">
                <p className="text-muted-foreground text-sm">{t("admin.nothingReported")}</p>
              </Card>
            ) : (
              <ul className="flex flex-col gap-3">
                {part.map(({ row, notes }) => (
                  <ReportedSolutionRow
                    key={row.id}
                    row={row}
                    notes={notes}
                    now={now}
                    onModerate={onModerateSolution}
                    onModerateComment={onModerateComment}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </section>
  );
}
