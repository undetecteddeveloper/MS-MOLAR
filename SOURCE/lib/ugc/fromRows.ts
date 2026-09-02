// UGC Exam Upload v2.1 — dựng AssembledExam từ rows DB (Task 4.1/4.2 + C1).
// Dùng chung bởi (layer4)/actions.ts (publish/save re-validate) và
// (layer4)/queries.ts (getMyExam cho màn review S-03). Thuần — test được.

import type {
  AssembledExam,
  AssembledQuestion,
  ChoiceId,
  ExtractedPart,
  ExtractedPassage,
  QuestionType,
  SubAnswers,
  SubItemId,
} from "./types";

/** Row exams (cột liên quan assemble) — snake_case như DB. */
export type DbExamMetaRow = {
  title: string;
  subject: string;
  grade: number;
  duration_minutes: number;
  school: string | null;
  school_year: number | null;
  semester: string | null;
  question_ids: string[];
  /** v2.1 (ADR-0005): [{number,title}] | null — đề 1 phần = null. */
  parts?: ExtractedPart[] | null;
  /** A1: [{id,title,text}] | null — đề không có ngữ liệu chung = null. */
  passages?: ExtractedPassage[] | null;
};

/** Danh tính (part, number) từ id row — chấp nhận CẢ 2 dạng:
 *  - v2.1: `{examId}-p{part}q{n}`
 *  - v2.0: `{examId}-q{n}` (part = 1)
 * Fallback: (1, thứ tự trong question_ids). */
export function questionIdentityFromId(
  id: string,
  fallback: number
): { part: number; number: number } {
  const m21 = /-p(\d+)q(\d+)$/.exec(id);
  if (m21) return { part: Number.parseInt(m21[1], 10), number: Number.parseInt(m21[2], 10) };
  const m20 = /-q(\d+)$/.exec(id);
  if (m20) return { part: 1, number: Number.parseInt(m20[1], 10) };
  return { part: 1, number: fallback };
}

/** Tương thích v2.0 (chỉ số câu) — giữ cho call site cũ/test cũ. */
export function questionNumberFromId(id: string, fallback: number): number {
  return questionIdentityFromId(id, fallback).number;
}

/** Rows DB → AssembledExam (đúng thứ tự question_ids; row thiếu bị bỏ qua). */
export function assembledFromRows(
  examRow: DbExamMetaRow,
  qRows: Array<Record<string, unknown>>
): AssembledExam {
  const byId = new Map(qRows.map((r) => [r.id as string, r]));
  const questions: AssembledQuestion[] = examRow.question_ids
    .map((id, i) => ({ row: byId.get(id), id, i }))
    .filter(
      (x): x is { row: Record<string, unknown>; id: string; i: number } => x.row !== undefined
    )
    .map(({ row, id, i }) => {
      const identity = questionIdentityFromId(id, i + 1);
      const type = (row.question_type as QuestionType) ?? "mcq";
      // part_number của DB là nguồn chân lý; id chỉ là fallback (row v2.0 cũ
      // chưa có cột thì default 1 từ schema).
      const part = typeof row.part_number === "number" ? row.part_number : identity.part;
      return {
        part,
        number: identity.number,
        type,
        stem: row.content as string,
        // Cột `choices` jsonb chứa lựa chọn A–D (mcq) HOẶC các ý a–d (true_false).
        choices: type === "mcq" ? (row.choices as { id: ChoiceId; text: string }[]) : undefined,
        subItems:
          type === "true_false"
            ? (row.choices as { id: SubItemId; text: string }[])
            : undefined,
        correctAnswer: (row.correct_answer as ChoiceId | null) ?? undefined,
        subAnswers: (row.sub_answers as SubAnswers | null) ?? undefined,
        essayAnswer: (row.essay_answer as string | null) ?? undefined,
        imageUrl: (row.image_url as string | null) ?? undefined,
        passageId: (row.passage_id as string | null) ?? undefined,
        points: typeof row.points === "number" ? row.points : undefined,
        topic: row.topic as string,
      };
    });
  return {
    meta: {
      title: examRow.title,
      subject: examRow.subject,
      grade: examRow.grade,
      durationMinutes: examRow.duration_minutes,
      school: examRow.school ?? undefined,
      schoolYear: examRow.school_year ?? undefined,
      semester: (examRow.semester as "HK1" | "HK2" | null) ?? undefined,
    },
    parts: examRow.parts ?? [],
    passages: examRow.passages ?? [],
    questions,
  };
}
