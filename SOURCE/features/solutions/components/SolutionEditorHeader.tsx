"use client";

// SolutionEditorHeader — đầu màn viết bài giải: tiêu đề, nút "Bảng câu hỏi",
// thanh tiến độ "a/N câu đã ghi chú", huy hiệu trạng thái (UI Spec `C-10`,
// AC-027, AC-030).
//
// 0 câu hiện hành (DD-U4, UI Spec `C-21` "Rỗng"): KHÔNG mount
// `QuestionPaletteDock` — thay vào đó một nút tĩnh cùng hình dạng nút nghỉ
// của bảng (`chipVariants({ active: false })` + `h-11`), `aria-disabled="true"`,
// không `aria-expanded`/`aria-controls`/`onClick`, không bao giờ `disabled`
// gốc (UI-D25). `aria-describedby` trỏ câu "Đề này hiện không còn câu hỏi
// nào." mà chính hàng này hiển thị (thanh tiến độ ẩn đi thay chỗ nó).

import { useId } from "react";
import { LayoutGrid } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { chipVariants } from "@/components/ui/chip";
import { QuestionPaletteDock } from "@/components/shared/QuestionPaletteDock";
import type { QuestionCell } from "@/components/shared/QuestionPagination";
import { noteRowCellLabel, type NoteRowState } from "@/features/solutions/components/NoteQuestionRow";

export type SolutionEditorStatus = "draft" | "published" | "hidden";

type BadgeVariant = VariantProps<typeof badgeVariants>["variant"];

const STATUS_BADGE: Record<SolutionEditorStatus, { variant: BadgeVariant; key: MessageKey }> = {
  draft: { variant: "muted", key: "solutions.status.draft" },
  // Chung với huy hiệu UGC hiện có — cùng chữ "Đã đăng", không thêm khoá mới.
  published: { variant: "success", key: "status.published" },
  hidden: { variant: "wrong", key: "solutions.status.hidden" },
};

interface SolutionEditorHeaderProps {
  /** `null` = chưa có bài giải nào được lưu lần nào (chưa có huy hiệu). */
  status: SolutionEditorStatus | null;
  /** Trạng thái từng câu hiện hành, đúng thứ tự câu — vừa để tính a/N, vừa là
   *  nguồn dựng `cells[]` của `QuestionPaletteDock` (UI-D26). Rỗng = 0 câu
   *  hiện hành (DD-U4). */
  questionStates: NoteRowState[];
  onJump: (index: number) => void;
}

export function SolutionEditorHeader({ status, questionStates, onJump }: SolutionEditorHeaderProps) {
  const progressId = useId();
  const emptyId = useId();
  const total = questionStates.length;
  const noted = questionStates.filter((state) => state === "noted").length;
  const cells: QuestionCell[] = questionStates.map((state, index) => ({
    index,
    state,
    label: noteRowCellLabel(state, index + 1),
  }));
  const badge = status !== null ? STATUS_BADGE[status] : null;

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-foreground text-lg font-semibold">{t("solutions.editor.title")}</h1>
        {total === 0 ? (
          <button
            type="button"
            aria-disabled="true"
            aria-describedby={emptyId}
            className={cn(chipVariants({ active: false }), "gap-1.5 px-3 tabular-nums h-11")}
          >
            <LayoutGrid aria-hidden className="size-4" />
            <span>{t("common.questionPalette")}</span>
          </button>
        ) : (
          <QuestionPaletteDock
            current={0}
            total={total}
            cells={cells}
            triggerLabel={t("common.questionPalette")}
            onJump={onJump}
          />
        )}
      </div>
      <div className="flex items-center gap-3">
        {total > 0 ? (
          <>
            <Progress value={noted} max={total} aria-labelledby={progressId} className="flex-1" />
            <span id={progressId} className="text-xs tabular-nums whitespace-nowrap">
              {t("solutions.editor.progress", { done: noted, total })}
            </span>
          </>
        ) : (
          <p id={emptyId} className="text-muted-foreground flex-1 text-xs">
            {t("solutions.emptyExam")}
          </p>
        )}
        {badge && <Badge variant={badge.variant}>{t(badge.key)}</Badge>}
      </div>
    </header>
  );
}
