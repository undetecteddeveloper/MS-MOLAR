"use client";

// QuestionAnswerSummary (biến thể người viết) — khối "đề câu + đáp án đúng +
// kết quả của tôi" bên trong tấm trượt ghi chú (UI Spec § Component:
// QuestionAnswerSummary; AC-022; UI-D16). Biến thể người đọc là task 20.
//
// Đề câu/đáp án đúng/danh sách phương án/đáp án mẫu đến dưới dạng ReactNode ĐÃ
// DỰNG SẴN phía server (`writerQuestionNodes.tsx`, UI-D22) — component này CHỈ
// sắp xếp, không tự gọi `RichText` (giữ M12). "use client" ở đây chỉ vì mục
// "Xem N phương án" cần state gập/mở tại chỗ — cùng khuôn disclosure với
// `SolutionSettingsPanel.tsx` (button `aria-expanded` + `ChevronDown` xoay +
// `.motion-unfold`), không phải vì cần nạp RichText.
//
// Hai trục rẽ nhánh ĐỘC LẬP nhau:
//   - `outcomeBranch(outcome)` quyết định phần "kết quả của tôi" (Bạn làm
//     đúng/sai/bỏ trống, hay "Chưa chấm tự động" — UI-D16, GIỮ NGUYÊN không đổi).
//   - `questionType` (nay có từ `community_solution_for_writer`, migration
//     `8b80e2188cc3`) quyết định phần "đáp án đúng" hiện gì: trắc nghiệm
//     ("Đáp án đúng A" + "Xem N phương án"); đúng/sai (từng ý + đáp án đã lưu);
//     trả lời ngắn (một chuỗi); tự luận ("Đáp án mẫu" nếu đề có).
// Khi `outcomeBranch()` trả "notAutoScored", nhánh đó ĐÈ mọi thứ ở trên —
// đúng hành vi cũ, không phụ thuộc `questionType`.
import { useId, useState } from "react";
import type { ReactNode } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import {
  outcomeBranch,
  resultLabel,
  type WriterQuestionOutcome,
} from "@/features/solutions/lib/questionOutcome";
import { decodeTfAnswer, formatSubAnswers } from "@/lib/ugc/tfCodec";
import type { WriterQuestionType } from "@/features/solutions/queries";
import type { ChoiceNode, SubItemNode } from "@/features/solutions/components/writerQuestionNodes";
import type { SubItemId } from "@/types/question";

export interface QuestionAnswerSummaryProps {
  stemNode: ReactNode;
  correctAnswerNode: ReactNode;
  outcome: WriterQuestionOutcome;
  questionType: WriterQuestionType;
  /** Chỉ dùng khi `questionType === "mcq"`; rỗng/`undefined` ⇒ không có nút "Xem N phương án". */
  choiceNodes?: ChoiceNode[];
  /** Chỉ dùng khi `questionType === "true_false"`. */
  subItemNodes?: SubItemNode[];
  subAnswers?: Partial<Record<SubItemId, boolean>>;
  /** `undefined` khi đề không có đáp án mẫu (AC-022 "nếu đề có") — không hiện dòng "Đáp án mẫu". */
  essayAnswerNode?: ReactNode;
}

/** Nhãn kết quả "tấm trượt" (UI Spec § QuestionAnswerSummary "Nhãn kết quả —
 *  tấm trượt"): success+Check / wrong+X / muted+Minus. */
function ResultBadge({ outcome }: { outcome: WriterQuestionOutcome }) {
  if (!outcome) return null;
  const label = resultLabel(outcome);
  if (label === "correct") {
    return (
      <Badge variant="success">
        <Check aria-hidden />
        {t("solutions.note.yourCorrect")}
      </Badge>
    );
  }
  if (label === "wrong") {
    return (
      <Badge variant="wrong">
        <X aria-hidden />
        {t("solutions.note.yourWrong")}
      </Badge>
    );
  }
  return (
    <Badge variant="muted">
      <Minus aria-hidden />
      {t("solutions.note.yourSkipped")}
    </Badge>
  );
}

/** `selected`/đáp án đã lưu của true_false đến dưới dạng chuỗi mã hoá tfCodec
 *  ("a:Đ,b:S,…", cùng quy ước attempt_answers.answer); một chuỗi KHÔNG khớp
 *  quy ước đó (short_answer tự do) giải mã ra rỗng một cách an toàn
 *  (`decodeTfAnswer` tự nói: "chuỗi lạ/không phải TF → {} bỏ qua an toàn") —
 *  nên rơi về hiển thị nguyên văn. */
function formatFreeOrTfAnswer(raw: string | undefined): string {
  if (!raw) return "";
  const decoded = formatSubAnswers(decodeTfAnswer(raw));
  return decoded !== "" ? decoded : raw;
}

/** Hàng một phương án — cùng khuôn `flex items-start gap-3 rounded-lg border-2
 *  p-3` mà `result/detail/page.tsx` dùng cho mcq (UI Spec 1141: "Dùng lại
 *  nguyên vốn từ trang chi tiết kết quả"), viết lại tại đây vì
 *  `features/solutions` không được import từ `features/exams` (B4). */
function ChoiceRow({ choice }: { choice: ChoiceNode }) {
  return (
    <li
      className={cn(
        "flex items-start gap-3 rounded-lg border-2 p-3",
        choice.isCorrect ? "border-success bg-surface" : "bg-surface border-transparent"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
          choice.isCorrect ? "bg-success text-primary-foreground" : "bg-card text-muted-foreground"
        )}
      >
        {choice.id}
      </span>
      <span className="text-foreground min-w-0 flex-1 pt-0.5 text-base leading-relaxed">{choice.textNode}</span>
      {choice.isCorrect && (
        <Badge variant="success" className="bg-card shrink-0 self-center">
          {t("result.correctAnswer")}
        </Badge>
      )}
    </li>
  );
}

/** Nút gập/mở "Xem N phương án" (AC-022, AC-060) — cùng khuôn disclosure với
 *  `SolutionSettingsPanel.tsx` (button aria-expanded + ChevronDown +
 *  `.motion-unfold`). */
function ChoicesDisclosure({ choices }: { choices: ChoiceNode[] }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={panelId}
        className="text-primary focus-visible:ring-ring/40 flex h-11 w-fit items-center gap-1 text-sm font-medium focus-visible:ring-3 focus-visible:outline-none"
      >
        {t(open ? "solutions.note.choicesHide" : "solutions.note.choices", { count: choices.length })}
        <ChevronDown aria-hidden className={cn("size-4 shrink-0", open && "rotate-180")} />
      </button>
      {open && (
        <ul id={panelId} className="motion-unfold flex flex-col gap-2">
          {choices.map((c) => (
            <ChoiceRow key={c.id} choice={c} />
          ))}
        </ul>
      )}
    </div>
  );
}

export function QuestionAnswerSummary({
  stemNode,
  correctAnswerNode,
  outcome,
  questionType,
  choiceNodes,
  subItemNodes,
  subAnswers,
  essayAnswerNode,
}: QuestionAnswerSummaryProps) {
  const branch = outcomeBranch(outcome);
  // UI-D16 thắng mọi loại câu: câu true_false/short_answer không có phán
  // quyết đúng/sai đi thẳng vào nhánh "Chưa chấm tự động" bên dưới, không
  // hiện thêm phần "đáp án đúng" theo loại câu.
  const showAnswerKey = branch !== "notAutoScored";

  return (
    <div className="flex flex-col gap-3">
      <div className="text-lg leading-relaxed font-medium text-pretty sm:text-xl">{stemNode}</div>

      {showAnswerKey && questionType === "mcq" && (
        <>
          <Badge variant="success" className="w-fit">
            {t("result.correctAnswer")} {correctAnswerNode}
          </Badge>
          {choiceNodes && choiceNodes.length > 0 && <ChoicesDisclosure choices={choiceNodes} />}
        </>
      )}

      {showAnswerKey && questionType === "true_false" && (
        <div className="flex flex-col gap-2 text-sm">
          {subItemNodes && subItemNodes.length > 0 && (
            <ul className="flex flex-col gap-2">
              {subItemNodes.map((s) => (
                <li key={s.id} className="bg-surface flex items-start gap-3 rounded-lg p-3">
                  <span className="text-muted-foreground w-4 shrink-0 pt-0.5 text-sm font-semibold">{s.id})</span>
                  <span className="text-foreground min-w-0 flex-1 pt-0.5 text-base leading-relaxed">
                    {s.textNode}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p>
            <span className="text-muted-foreground">{t("result.correctAnswerLabel")} </span>
            <span className="text-success font-medium">{formatSubAnswers(subAnswers)}</span>
          </p>
        </div>
      )}

      {showAnswerKey && questionType === "short_answer" && (
        <p className="text-sm">
          <span className="text-muted-foreground">{t("result.correctAnswerLabel")} </span>
          <span className="text-success font-medium">{correctAnswerNode}</span>
        </p>
      )}

      {branch === "notAutoScored" && outcome && (
        <div className="flex flex-col gap-1 text-sm">
          <Badge variant="muted" className="w-fit">
            {t("result.notAutoScored")}
          </Badge>
          <p>
            <span className="text-muted-foreground">{t("result.yourAnswerLabel")} </span>
            <span className="text-foreground">
              {formatFreeOrTfAnswer(outcome.selected) || t("result.skipped")}
            </span>
          </p>
        </div>
      )}

      {branch === "essay" && outcome?.essay && (
        <div className="flex flex-col gap-2 text-sm">
          {essayAnswerNode && (
            <div className="flex flex-col gap-1">
              <p className="text-muted-foreground">{t("upload.modelAnswer")}</p>
              <div className="text-foreground">{essayAnswerNode}</div>
            </div>
          )}
          <p className="font-medium">
            {outcome.essay.state === "graded" && outcome.earnedPoints !== undefined && outcome.maxPoints !== undefined
              ? t("solutions.view.essayScored", { earned: outcome.earnedPoints, max: outcome.maxPoints })
              : t("solutions.view.essayPending")}
          </p>
        </div>
      )}

      {(branch === "mcq" || branch === "shortAnswerScored") && <ResultBadge outcome={outcome} />}
    </div>
  );
}
