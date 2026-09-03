// AssembledQuestionList — danh sách câu để review/sửa (UI Spec / Task 6.4 + D1).
// v2.1 (ADR-0005): nhóm câu theo PHẦN — heading lấy từ exams.parts (fallback
// "Phần N"). Mỗi câu là một QuestionEditor, định danh (part, number).
// Client-safe (con là client).
//
// 2026-09-03: bỏ nhánh render PHẲNG cho đề một phần. MỌI đề nay đều là một dãy
// nhóm có heading, kể cả đề chỉ có một nhóm. Lý do không phải thẩm mỹ: nhánh
// phẳng khiến màn sửa đề có HAI cấu trúc DOM khác nhau tuỳ dữ liệu, nên mọi
// tính năng bám vào ranh giới nhóm câu (panel gán điểm là cái đầu tiên) phải tự
// đoán lại xem hôm nay mình đang ở nhánh nào. Một cấu trúc duy nhất thì không
// có gì để đoán. Heading cũng sửa được tại chỗ — xem PartHeading.

"use client";

import type { AssembledQuestion, ExtractedPart, UgcError } from "@/lib/ugc/types";
import { PartHeading } from "./PartHeading";
import { QuestionEditor } from "./QuestionEditor";
import { reviewNodeKey, type ReviewNodes } from "./reviewNodes.types";

interface AssembledQuestionListProps {
  questions: AssembledQuestion[];
  parts: ExtractedPart[];
  errors: UgcError[];
  onChangeQuestion: (
    part: number,
    number: number,
    patch: Partial<AssembledQuestion>,
  ) => void;
  /** Sửa tiêu đề một phần. Chuỗi rỗng ⇒ gỡ khai báo, về nhãn mặc định. */
  onChangePartTitle: (part: number, title: string) => void;
  /** Nội dung server render sẵn, tra theo `reviewNodeKey` (TD-027). Chỉ đi qua đây. */
  nodes?: ReviewNodes;
  /** Môn của đề — chỉ đi ngang qua đây xuống `QuestionEditor`, nơi nó chốt
   *  trần độ dài theo môn (A6/A7). Nguồn là `exam.meta.subject` LIVE của
   *  ReviewScreen, không phải `q.topic`. */
  subject?: string;
  /** Cờ chấm tự luận — chỉ đi ngang qua đây xuống `QuestionEditor` (Task E4). */
  essayGradingEnabled?: boolean;
  /** Đang lưu/publish — khoá đường sửa heading. */
  disabled?: boolean;
}

/** Các nhóm câu của một đề, theo thứ tự đề gốc.
 *
 *  Nguồn là CÂU HỎI chứ không phải `parts`: `parts` là tiêu đề in trên đề, có
 *  thể rỗng (đề không chia phần) hoặc khai thừa một phần không còn câu nào.
 *  Cái quyết định "màn này có mấy nhóm" luôn là các câu thật.
 *
 *  Export vì panel gán điểm dựng đúng danh sách phạm vi này — hai nơi tự gom
 *  nhóm theo hai cách là hai cơ hội để panel gán điểm cho một nhóm mà tác giả
 *  không nhìn thấy trên màn hình. */
export function partNumbersOf(questions: { part: number }[]): number[] {
  return [...new Set(questions.map((q) => q.part))].sort((a, b) => a - b);
}

export function AssembledQuestionList({
  questions,
  parts,
  errors,
  onChangeQuestion,
  onChangePartTitle,
  nodes,
  subject,
  essayGradingEnabled = false,
  disabled = false,
}: AssembledQuestionListProps) {
  // Khoá lỗi composite — khớp validateAssembledExam (partNumber null = đề 1 phần).
  const errorKeys = new Set(
    errors
      .filter((e) => e.questionNumber !== null)
      .map((e) => `${e.partNumber ?? 1}:${e.questionNumber}`),
  );

  // Đề rỗng: không có nhóm nào để dựng. Lỗi NO_QUESTIONS_FOUND đã nói hộ ở
  // ExtractionErrorPanel, nên một heading "Phần 1" trống rỗng ở đây chỉ là một
  // cái vỏ không có gì bên trong.
  if (questions.length === 0) return null;

  const partNumbers = partNumbersOf(questions);
  const titleByPart = new Map(parts.map((p) => [p.number, p.title]));

  return (
    <div className="flex flex-col gap-6">
      {partNumbers.map((pn) => (
        <section key={pn} aria-labelledby={`part-${pn}`}>
          <PartHeading
            partNumber={pn}
            title={titleByPart.get(pn)}
            onChange={(title) => onChangePartTitle(pn, title)}
            disabled={disabled}
          />
          <ul className="flex flex-col gap-4">
            {questions
              .filter((q) => q.part === pn)
              .map((q) => (
                <QuestionEditor
                  key={`${q.part}:${q.number}`}
                  question={q}
                  hasError={errorKeys.has(`${q.part}:${q.number}`)}
                  onChange={(patch) => onChangeQuestion(q.part, q.number, patch)}
                  nodes={nodes?.[reviewNodeKey(q.part, q.number)]}
                  subject={subject}
                  essayGradingEnabled={essayGradingEnabled}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
