"use client";

// Admin — một hàng của hàng đợi "Bài giải bị báo cáo" (UI Spec C-38; AC-081,
// AC-082, AC-106, AC-107). Mượn KHUÔN NHÌN của ModerationRow (Card compact,
// huy hiệu đếm, `<details>` lý do) nhưng không mượn hành vi của nó: ở đây lý do
// bắt buộc cho Ẩn/Xoá hẳn, Xoá hẳn phải qua hộp thoại xác nhận, và đang xử lý
// dùng `aria-disabled` chứ không `disabled` gốc.
//
// Không có nút "Bỏ qua" (AC-109): hàng vào/ra hàng đợi chỉ theo trạng thái bài
// giải — việc chia phần là của ReportedSolutionsSection, hàng không tự quyết.
//
// B4: không import gì từ `@/features/solutions/**` — dữ liệu, ghi chú và hai
// Server Action đến qua prop từ `app/(admin)/admin/page.tsx`.

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import {
  AdminAuthorLine,
  ModerationReasonForm,
  ReportedCommentItem,
  reportCountLabel,
  type AdminHiddenCommentItem,
  type AdminModerationFormAction,
  type AdminReportedAuthor,
  type AdminReportedCommentItem,
} from "@/features/admin/components/ReportedCommentItem";

/** Một hàng của hàng đợi R17. Hàng `hidden` có thể đến với 0 báo cáo — vẫn là
 *  một hàng (Reference Contract Value #26). */
export interface AdminReportedSolution {
  id: string;
  examId: string;
  examTitle: string;
  author: AdminReportedAuthor;
  status: "published" | "hidden";
  reportCount: number;
  reportReasons: string[];
  reportedComments: AdminReportedCommentItem[];
  hiddenComments: AdminHiddenCommentItem[];
}

/** Đúng ba khoá (Reference Contract Value #16). `body` là markdown THÔ, in dạng
 *  văn bản thường; `questionId` chỉ làm key. */
export interface AdminSolutionNote {
  questionNumber: number;
  questionId: string;
  body: string;
}

export interface ReportedSolutionRowProps {
  row: AdminReportedSolution;
  /** Bắt buộc: C-38 đặt "Ghi chú của bài giải" trên MỌI hàng; `[]` là ca hợp
   *  lệ ("Chưa có lời giải"). Trang gọi `getSolutionNotesForAdmin(row.id)`. */
  notes: AdminSolutionNote[];
  /** Mốc thời gian cố định của lượt render (cho `hiddenAt` của bình luận ẩn). */
  now: Date;
  /** `moderateSolutionAction` — form gửi `solutionId`, `action`, `reason`. */
  onModerate: AdminModerationFormAction;
  /** `moderateCommentAction` — form gửi `commentId`, `action`, `reason`. */
  onModerateComment: AdminModerationFormAction;
}

/** `<details>` gập/mở không cần JS; marker trình duyệt thay bằng chevron như
 *  ModerationRow. */
function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <details className="group/disclosure text-sm">
      <summary className="text-foreground flex min-h-11 cursor-pointer list-none items-center gap-1.5 font-medium select-none [&::-webkit-details-marker]:hidden">
        <ChevronDown
          aria-hidden
          className="text-muted-foreground size-4 shrink-0 group-open/disclosure:rotate-180"
        />
        {summary}
      </summary>
      <div className="bg-card mt-1 rounded-lg p-3">{children}</div>
    </details>
  );
}

export function ReportedSolutionRow({ row, notes, now, onModerate, onModerateComment }: ReportedSolutionRowProps) {
  const isHidden = row.status === "hidden";

  return (
    <Card as="li" padding="compact" className="gap-3">
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="plain" className="tabular-nums">
            {reportCountLabel(row.reportCount)}
          </Badge>
          <Badge variant="plain" className={cn(isHidden ? "text-destructive" : "text-success")}>
            {isHidden ? t("solutions.status.hidden") : t("status.published")}
          </Badge>
        </div>
        <h4 className="leading-snug font-semibold break-words">{row.examTitle}</h4>
        <AdminAuthorLine author={row.author} label={t("admin.solutions.author")} />
      </div>

      {row.reportReasons.length > 0 && (
        <Disclosure summary={t("admin.reportedReasons")}>
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {row.reportReasons.map((reason, i) => (
              <li key={i} className="break-words">
                {reason}
              </li>
            ))}
          </ul>
        </Disclosure>
      )}

      <Disclosure summary={t("admin.solutions.notes")}>
        {notes.length === 0 ? (
          <p className="text-muted-foreground">{t("solutions.row.noSolution")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {notes.map((note) => (
              <li key={note.questionId} className="flex flex-col gap-1">
                <h5 className="text-foreground font-semibold">
                  {t("upload.questionLabel", { number: note.questionNumber })}
                </h5>
                <p className="leading-relaxed break-words whitespace-pre-wrap">{note.body}</p>
              </li>
            ))}
          </ol>
        )}
      </Disclosure>

      {row.reportedComments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {row.reportedComments.map((comment) => (
            <ReportedCommentItem
              key={comment.id}
              variant="reported"
              item={comment}
              now={now}
              onModerate={onModerateComment}
            />
          ))}
        </ul>
      )}

      {/* AC-107: mục con nằm TRONG hàng, ở phần nào cũng hiện; rỗng thì không
          render gì (C-39 "Rỗng"). */}
      {row.hiddenComments.length > 0 && (
        <section className="flex flex-col gap-2">
          <h5 className="text-muted-foreground text-sm font-semibold">{t("admin.comments.hiddenGroup")}</h5>
          <ul className="flex flex-col gap-2">
            {row.hiddenComments.map((comment) => (
              <ReportedCommentItem
                key={comment.id}
                variant="hidden"
                item={comment}
                now={now}
                onModerate={onModerateComment}
              />
            ))}
          </ul>
        </section>
      )}

      <ModerationReasonForm
        idField="solutionId"
        targetId={row.id}
        primaryAction={isHidden ? "restore" : "hide"}
        primaryLabel={isHidden ? t("common.restore") : t("admin.solutions.hideAction")}
        deleteTitle={t("admin.solutions.deleteTitle")}
        deleteBody={t("admin.solutions.deleteBody")}
        onModerate={onModerate}
      />
    </Card>
  );
}
