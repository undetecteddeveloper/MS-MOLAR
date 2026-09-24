// renderWriterQuestionNodes — dựng ReactNode phía SERVER cho đề câu, đáp án
// đúng, danh sách phương án/từng ý (đúng/sai), đáp án mẫu và (khi chỉ đọc)
// chính ghi chú của một câu ở màn viết (UI-D22, task 11). Chỉ gọi từ Server
// Component (`SolutionEditorPage`) — KHÔNG BAO GIỜ import file này từ một
// component có "use client": cùng lý do TD-023/TD-021 của
// `features/exams/components/questionNodes.tsx` — một import tĩnh từ
// component client kéo nguyên cây phụ thuộc 122,5 KB gzip của RichText vào
// bundle và xoá sạch khoản tiết kiệm mà `ssr:false`/nạp động ở FormulaPreview
// đang giữ.
//
// File này KHÔNG import `questionNodes.tsx` (B4 — `features/exams` và
// `features/solutions` là hai tính năng khác nhau); nó là bản MÔ PHỎNG cùng
// khuôn (server dựng sẵn, client chỉ nhận ReactNode), áp cho một jsonb khác
// hẳn: `community_solution_for_writer`'s `questions[]`, không phải
// `PublicQuestion`.
//
// `choices`/`subItems`/`essayAnswer` (migration `8b80e2188cc3`) đi qua RichText
// giống hệt `stem`/`correctAnswer`: đều là nội dung do tác giả đề soạn, cùng cú
// pháp markdown + LaTeX, cùng nhu cầu sanitize (ADR-0002) — không có lý do kỹ
// thuật nào để hai cột này đi đường khác.
import type { ReactNode } from "react";
import { RichText } from "@/components/shared/RichText";
import type { SolutionEditorQuestion, WriterQuestionType } from "@/features/solutions/queries";
import type { SubItemId } from "@/types/question";
import { toWriterQuestionOutcome, type WriterQuestionOutcome } from "@/features/solutions/lib/questionOutcome";

const CONTENT_CLASS = "text-foreground text-lg leading-relaxed font-medium text-pretty sm:text-xl";
const ANSWER_CLASS = "text-foreground text-base leading-relaxed";
const NOTE_CLASS = "text-foreground text-base leading-relaxed";

/** Một phương án trắc nghiệm đã dựng — `isCorrect` so trực tiếp với chuỗi thô
 *  `correct_answer` phía SERVER (nơi duy nhất còn giữ chuỗi đó), nên client
 *  không cần nhận lại giá trị thô để tự so sánh. */
export interface ChoiceNode {
  id: string;
  textNode: ReactNode;
  isCorrect: boolean;
}

/** Một ý (a-d) của câu đúng/sai — nội dung ý, KHÔNG kèm phán quyết Đ/S (ground
 *  truth nằm ở `subAnswers`, đọc riêng bởi `QuestionAnswerSummary`). */
export interface SubItemNode {
  id: string;
  textNode: ReactNode;
}

export interface WriterQuestionNode {
  questionId: string;
  stemNode: ReactNode;
  /** Chuỗi thô của đáp án đúng — QuestionAnswerSummary tự quyết định có ghép
   *  nó với nhãn "Đáp án đúng" hay không theo `outcomeBranch()`. */
  correctAnswerNode: ReactNode;
  /** Bản render CHỈ ĐỌC của ghi chú hiện tại — dùng khi bài bị ẩn (AC-083,
   *  "ghi chú hiện dưới dạng bản render RichText server"). */
  noteNode: ReactNode;
  outcome: WriterQuestionOutcome;
  questionType: WriterQuestionType;
  /** Luôn `[]` khi `questionType !== "mcq"`. */
  choiceNodes: ChoiceNode[];
  /** Luôn `[]` khi `questionType !== "true_false"`. */
  subItemNodes: SubItemNode[];
  subAnswers?: Partial<Record<SubItemId, boolean>>;
  /** `undefined` khi đề không có đáp án mẫu (AC-022 "nếu đề có") — kể cả câu
   *  không phải tự luận. */
  essayAnswerNode?: ReactNode;
}

function toText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function renderWriterQuestionNodes(questions: SolutionEditorQuestion[]): WriterQuestionNode[] {
  return questions.map((q) => {
    const correctAnswer = toText(q.correctAnswer);
    const essayAnswer = q.essayAnswer?.trim() ?? "";

    return {
      questionId: q.questionId,
      stemNode: <RichText text={toText(q.stem)} className={CONTENT_CLASS} />,
      correctAnswerNode: <RichText text={correctAnswer} inline className={ANSWER_CLASS} />,
      noteNode: <RichText text={q.note} className={NOTE_CLASS} />,
      outcome: toWriterQuestionOutcome(q.myResult),
      questionType: q.questionType,
      choiceNodes:
        q.questionType === "mcq"
          ? q.choices.map((c) => ({
              id: c.id,
              textNode: <RichText text={c.text} inline className={ANSWER_CLASS} />,
              isCorrect: c.id === correctAnswer,
            }))
          : [],
      subItemNodes:
        q.questionType === "true_false"
          ? (q.subItems ?? []).map((s) => ({
              id: s.id,
              textNode: <RichText text={s.text} inline className={ANSWER_CLASS} />,
            }))
          : [],
      subAnswers: q.subAnswers,
      essayAnswerNode: essayAnswer !== "" ? <RichText text={essayAnswer} className={ANSWER_CLASS} /> : undefined,
    };
  });
}
