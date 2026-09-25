"use client";

// SolutionQuestionRow — một hàng câu gập/mở ở màn xem (UI Spec § Component:
// SolutionQuestionRow; AC-059, AC-060). "use client" chỉ vì gập/mở tại chỗ
// (`aria-expanded`/`aria-controls`, cùng khuôn disclosure với
// `ChoicesDisclosure` trong `QuestionAnswerSummary.tsx`) — file này KHÔNG BAO
// GIỜ import `RichText`/`SolutionNoteBlock` (TD-021/TD-023, ADR-0002): thân
// đề câu (`stemNode`/`correctAnswerNode`/`writerChoiceNode`) và thân ghi chú
// (`note.bodyNode`) đến dưới dạng `ReactNode` ĐÃ DỰNG SẴN phía server (UI-D22,
// task 21's node-builder) — hàng này chỉ sắp xếp, không tự render markdown.
//
// Sheet bình luận thật (`CommentSheet`) tới ở task 28; hàng này chỉ phát
// `onOpenComments(questionId)`, không tự mở gì.
import { useId, useState, type ReactNode } from "react";
import { Check, ChevronDown, Minus, RefreshCw, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { QuestionAnswerSummary } from "@/features/solutions/components/QuestionAnswerSummary";

/** Một nhãn duy nhất theo thứ tự ưu tiên UI-D17 (Reference Contract Value #2):
 *  `noSolution` > `changed` > (khi bật hiện lựa chọn gốc) kết quả/chưa chấm tự
 *  động/điểm tự luận > (khi tắt, `null`) không nhãn. */
export type SolutionRowLabel =
  | { kind: "noSolution" }
  | { kind: "changed" }
  | { kind: "result"; result: "correct" | "wrong" | "skipped" }
  | { kind: "notAutoScored" }
  | { kind: "essayScore"; earned: number; max: number }
  | null;

export interface SelectRowLabelInput {
  hasNote: boolean;
  hasChanged: boolean;
  result?: "correct" | "wrong" | "skipped";
  notAutoScored?: boolean;
  essayScore?: { earned: number; max: number };
}

/** Hàm thuần — không đọc `score`, chỉ đọc sự CÓ MẶT của từng khoá (đúng quy
 *  ước mapper `queries.ts`: vắng cả bốn khoá điểm = writer tắt "Hiện điểm và
 *  lựa chọn gốc"). `essayScore`/`notAutoScored`/`result` loại trừ lẫn nhau
 *  theo đúng `mapPerQuestionFields()`, nên thứ tự kiểm giữa ba nhánh đó không
 *  quan trọng — chỉ thứ tự `noSolution` > `changed` > (ba nhánh đó) mới là
 *  UI-D17's ưu tiên thật sự cần giữ đúng. */
export function selectRowLabel({
  hasNote,
  hasChanged,
  result,
  notAutoScored,
  essayScore,
}: SelectRowLabelInput): SolutionRowLabel {
  if (!hasNote) return { kind: "noSolution" };
  if (hasChanged) return { kind: "changed" };
  if (essayScore) return { kind: "essayScore", earned: essayScore.earned, max: essayScore.max };
  if (notAutoScored) return { kind: "notAutoScored" };
  if (result) return { kind: "result", result };
  return null;
}

function RowLabelBadge({ label }: { label: NonNullable<SolutionRowLabel> }) {
  switch (label.kind) {
    case "noSolution":
      return <Badge variant="muted">{t("solutions.row.noSolution")}</Badge>;
    case "changed":
      return (
        <Badge variant="muted">
          <RefreshCw aria-hidden />
          {t("solutions.row.changed")}
        </Badge>
      );
    case "notAutoScored":
      return <Badge variant="muted">{t("result.notAutoScored")}</Badge>;
    case "essayScore":
      return (
        <Badge variant="muted">
          {t("solutions.view.essayScored", { earned: label.earned, max: label.max })}
        </Badge>
      );
    case "result":
      if (label.result === "correct") {
        return (
          <Badge variant="success">
            <Check aria-hidden />
            {t("common.correct")}
          </Badge>
        );
      }
      if (label.result === "wrong") {
        return (
          <Badge variant="wrong">
            <X aria-hidden />
            {t("solutions.view.writerWrong")}
          </Badge>
        );
      }
      return (
        <Badge variant="muted">
          <Minus aria-hidden />
          {t("solutions.view.writerSkipped")}
        </Badge>
      );
  }
}

export interface SolutionQuestionRowProps {
  questionId: string;
  /** Số thứ tự 0-based trong đề — "Câu k" hiện `index + 1`. */
  index: number;
  stemNode: ReactNode;
  correctAnswerNode: ReactNode;
  hasChanged: boolean;
  /** Bốn trường dưới đây CÙNG gộp từ một cột `per_question` của header — có
   *  mặt khi và chỉ khi `score` có mặt (Reference Contract Value #19). Không
   *  component nào trong cây này tự kiểm `score`. */
  writerChoiceNode?: ReactNode;
  result?: "correct" | "wrong" | "skipped";
  notAutoScored?: boolean;
  essayScore?: { earned: number; max: number };
  /** `undefined` ⇒ "Chưa có lời giải" (AC-048): không khối lời giải, không nút
   *  bình luận. `commentCount` optional bên trong: có mặt (kể cả `0`) ⇒ có nút
   *  bình luận; vắng mặt ⇒ không nút, không chữ đếm (Reference Contract #20). */
  note?: { bodyNode: ReactNode; commentCount?: number };
  onOpenComments: (questionId: string) => void;
}

export function SolutionQuestionRow({
  questionId,
  index,
  stemNode,
  correctAnswerNode,
  hasChanged,
  writerChoiceNode,
  result,
  notAutoScored,
  essayScore,
  note,
  onOpenComments,
}: SolutionQuestionRowProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const label = selectRowLabel({ hasNote: note !== undefined, hasChanged, result, notAutoScored, essayScore });
  const headerCommentCount =
    note?.commentCount !== undefined && note.commentCount > 0 ? note.commentCount : undefined;

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-h-14 w-full items-center gap-2 text-left"
      >
        <span className="w-13 shrink-0 text-sm font-semibold">
          {t("upload.questionLabel", { number: index + 1 })}
        </span>
        {label && <RowLabelBadge label={label} />}
        <span className="text-muted-foreground ml-auto flex shrink-0 items-center gap-2">
          {headerCommentCount !== undefined && (
            <span className="text-xs">{t("solutions.comments.open", { count: headerCommentCount })}</span>
          )}
          <ChevronDown aria-hidden className={cn("size-4 shrink-0 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      {open && (
        <div id={panelId} className="motion-unfold flex min-h-14 flex-col gap-4 pb-4">
          <QuestionAnswerSummary
            variant="reader"
            stemNode={stemNode}
            correctAnswerNode={correctAnswerNode}
            writerChoiceNode={writerChoiceNode}
            result={result}
            notAutoScored={notAutoScored}
            essayScore={essayScore}
          />

          {note && (
            <>
              {note.bodyNode}
              {note.commentCount !== undefined && (
                <button
                  type="button"
                  onClick={() => onOpenComments(questionId)}
                  className="text-primary flex h-11 w-fit items-center text-sm font-medium"
                >
                  {note.commentCount > 0
                    ? t("solutions.comments.open", { count: note.commentCount })
                    : t("solutions.comments.openEmpty")}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </li>
  );
}
