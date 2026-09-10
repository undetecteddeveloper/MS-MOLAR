"use client";

// Admin — một đề bị báo cáo + nút gỡ/khôi phục (Security review #7).
//
// Theme "Sân trường" (2026-09-10): thẻ surface — hàng nhãn (số báo cáo, trạng
// thái) → tên đề → tác giả → lý do báo cáo (gấp/mở) → ô lý do gỡ → nút. Gỡ là
// viên thuốc ĐỎ NHẠT (`destructive`, cùng họ với Xoá): nó rút đề khỏi kho ngay;
// Khôi phục là nút xanh. Bỏ dấu chấm giữa nối meta (design doc §5).

import { useActionState, useId } from "react";
import { ChevronDown } from "lucide-react";
import { moderateExamAction, type ModerationState } from "@/features/admin/actions";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { ModeratableExam } from "@/lib/supabase/service-role";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

/** Trạng thái đề là KHOÁ tiếng Anh trong DB ("published", "removed"…) — không
 *  bao giờ in thẳng ra màn hình. Cùng bảng nhãn với StatusBadge của nhóm tác
 *  giả, cộng "removed" (chỉ có ở màn kiểm duyệt). Giá trị lạ rơi về "Đang xử
 *  lý" theo đúng lệ `CONFIG[status] ?? CONFIG.processing` của StatusBadge. */
const STATUS_LABEL_KEY: Record<string, MessageKey> = {
  processing: "status.processing",
  review: "status.needsReview",
  draft: "status.draft",
  published: "status.published",
  failed: "status.needsFixing",
  removed: "status.removed",
};

export function ModerationRow({ exam }: { exam: ModeratableExam }) {
  const [state, formAction, pending] = useActionState<ModerationState, FormData>(
    moderateExamAction,
    null
  );
  const reasonId = useId();
  const isRemoved = exam.status === "removed";
  const reportCount =
    exam.reportCount === 1 ? t("admin.oneReport") : t("admin.reportCount", { count: exam.reportCount });

  return (
    <Card as="li" padding="compact" className="gap-0">
      <form action={formAction} className="flex flex-col gap-3">
        <input type="hidden" name="examId" value={exam.id} />
        <input type="hidden" name="action" value={isRemoved ? "restore" : "remove"} />

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="plain">{reportCount}</Badge>
          {/* Huy hiệu trạng thái trắng trên surface; "Đã gỡ" tô chữ đỏ và "Đã
              đăng" tô chữ xanh — màu là kênh phụ, chữ đã nói rõ (§4.3). */}
          <Badge
            variant="plain"
            className={cn(
              isRemoved && "text-destructive",
              exam.status === "published" && "text-success"
            )}
          >
            {t(STATUS_LABEL_KEY[exam.status] ?? "status.processing")}
          </Badge>
        </div>

        <div className="flex flex-col gap-0.5">
          <h3 className="leading-snug font-semibold">{exam.title}</h3>
          {exam.authorDisplayName && (
            <p className="text-muted-foreground text-sm">
              {t("admin.author", { name: exam.authorDisplayName })}
            </p>
          )}
        </div>

        {/* Lý do do người báo cáo gõ — văn bản THUẦN, không diễn giải markup.
            `<details>` chứ không phải nút + state: khối này gập/mở được mà
            không cần JS, và không có gì khác phụ thuộc vào trạng thái đó.
            Marker tam giác mặc định của trình duyệt bị gỡ (`[&::-webkit-details-marker]:hidden`
            + `list-none`) và thay bằng chevron lật 180° khi mở — cùng ngôn ngữ
            hình với hàng ticket ở hộp thư, thay vì một glyph của trình duyệt
            không theo màu hay cỡ nào của theme. */}
        <details className="group/reasons text-sm">
          <summary className="text-foreground flex cursor-pointer list-none items-center gap-1.5 font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronDown
              aria-hidden
              className="text-muted-foreground size-4 shrink-0 group-open/reasons:rotate-180"
            />
            {t("admin.reportedReasons")}
          </summary>
          <ul className="bg-card mt-2 flex list-disc flex-col gap-1 rounded-lg py-3 pr-3 pl-7">
            {exam.reasons.map((reason, i) => (
              <li key={i} className="break-words">
                {reason}
              </li>
            ))}
          </ul>
        </details>

        {/* Lý do là tuỳ chọn nhưng được ghi vào exam_moderation_log — "vì sao
            gỡ" là thứ cần nhất khi phải giải thích lại sau vài tháng. */}
        <div>
          <Label htmlFor={reasonId}>
            {isRemoved ? t("admin.reasonForRestoring") : t("admin.reasonForRemoval")}
          </Label>
          <Input id={reasonId} name="reason" />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={pending}
            className={buttonVariants({ variant: isRemoved ? "default" : "destructive", size: "sm" })}
          >
            {pending ? t("common.working") : isRemoved ? t("common.restore") : t("admin.removeExam")}
          </button>
          {state?.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          {state?.info && (
            <p role="status" className="text-muted-foreground text-sm">
              {state.info}
            </p>
          )}
        </div>
      </form>
    </Card>
  );
}
