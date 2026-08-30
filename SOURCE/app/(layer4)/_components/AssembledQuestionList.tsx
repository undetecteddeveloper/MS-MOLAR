// AssembledQuestionList — danh sách câu để review/sửa (UI Spec / Task 6.4 + D1).
// v2.1 (ADR-0005): nhóm câu theo PHẦN — heading lấy từ exams.parts (fallback
// "Phần N"); đề 1 phần render phẳng như v2.0 (không heading). Mỗi câu là một
// QuestionEditor, định danh (part, number). Client-safe (con là client).

"use client";

import { useT } from "@/lib/i18n/client";
import type { AssembledQuestion, ExtractedPart, UgcError } from "@/lib/ugc/types";
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
  /** Nội dung server render sẵn, tra theo `reviewNodeKey` (TD-027). Chỉ đi qua đây. */
  nodes?: ReviewNodes;
  /** Cờ chấm tự luận — chỉ đi ngang qua đây xuống `QuestionEditor` (Task E4). */
  essayGradingEnabled?: boolean;
}

export function AssembledQuestionList({
  questions,
  parts,
  errors,
  onChangeQuestion,
  nodes,
  essayGradingEnabled = false,
}: AssembledQuestionListProps) {
  const t = useT();
  // Khoá lỗi composite — khớp validateAssembledExam (partNumber null = đề 1 phần).
  const errorKeys = new Set(
    errors
      .filter((e) => e.questionNumber !== null)
      .map((e) => `${e.partNumber ?? 1}:${e.questionNumber}`),
  );

  const multiPart = parts.length > 0 || questions.some((q) => q.part !== 1);
  if (!multiPart) {
    return (
      <ul className="flex flex-col gap-4">
        {questions.map((q) => (
          <QuestionEditor
            key={`${q.part}:${q.number}`}
            question={q}
            hasError={errorKeys.has(`${q.part}:${q.number}`)}
            onChange={(patch) => onChangeQuestion(q.part, q.number, patch)}
            nodes={nodes?.[reviewNodeKey(q.part, q.number)]}
            essayGradingEnabled={essayGradingEnabled}
          />
        ))}
      </ul>
    );
  }

  // Nhóm theo part, giữ thứ tự (questions đã sort theo (part, number)).
  const partNumbers = [...new Set(questions.map((q) => q.part))].sort((a, b) => a - b);
  const titleByPart = new Map(parts.map((p) => [p.number, p.title]));

  return (
    <div className="flex flex-col gap-6">
      {partNumbers.map((pn) => (
        <section key={pn} aria-labelledby={`part-${pn}`}>
          <h2 id={`part-${pn}`} className="eyebrow mb-3">
            {titleByPart.get(pn) ?? t("upload.partLabel", { part: pn })}
          </h2>
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
                  essayGradingEnabled={essayGradingEnabled}
                />
              ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
