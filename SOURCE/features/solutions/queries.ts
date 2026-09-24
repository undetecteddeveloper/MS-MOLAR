// Bài giải cộng đồng — đọc phía "của tôi": màn viết (community_solution_for_writer)
// và tấm thẻ kết quả (community_solution_result_card). Hai RPC còn lại
// (community_solutions_list/community_solution_detail, che danh tính người
// khác) thuộc task 14 — file này KHÔNG khai chúng.
//
// import "server-only" (quy ước file query không mang "use server" —
// features/exams/queries/*.ts, features/authoring/queries.ts,
// features/billing/queries.ts): chặn bundle nhầm sang client nếu một ngày có
// import lạc.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Choice, SubItemId } from "@/types/question";

export type SolutionStatus = "draft" | "published" | "hidden";

/** Loại câu (UGC v2.0/v2.1) — cột `question_type` của `community_solution_for_writer`
 *  (migration `8b80e2188cc3`, bổ sung sau khi task 11 phát hiện thiếu dữ liệu
 *  cho AC-022's "Xem N phương án"/"Đáp án mẫu"). Không set (dòng cũ) → "mcq",
 *  cùng quy ước fallback với `exam_answer_key()`'s consumer (`features/exams/queries/result.ts`). */
export type WriterQuestionType = "mcq" | "essay" | "true_false" | "short_answer";

/** Một câu hỏi trong màn viết. `stem`/`correctAnswer`/`myResult` là dữ liệu
 *  THÔ (chưa dựng ReactNode) — dựng markdown/LaTeX thành ReactNode là việc của
 *  trang tiêu thụ (`writerQuestionNodes.tsx`, UI-D22), không phải của lớp
 *  query này: cách dựng dùng chung (features/exams/components/questionNodes.tsx)
 *  thuộc tính năng KHÁC — B4 cấm import chéo.
 *
 *  `choices`/`subItems`/`subAnswers`/`essayAnswer` đã có từ migration
 *  `8b80e2188cc3` (`ak.choices`/`ak.sub_answers`/`ak.essay_answer`, cùng cột
 *  `exam_answer_key()` đã trả cho màn Chi tiết kết quả) — tách theo
 *  `questionType` NGAY TẠI mapper này, cùng quy ước `result.ts:295-304`: mcq
 *  giữ nguyên trong `choices`, true_false chuyển sang `subItems` (cùng cột
 *  jsonb, khác cách đọc theo loại câu). */
export interface SolutionEditorQuestion {
  questionId: string;
  stem: unknown;
  correctAnswer: unknown;
  myResult: unknown;
  note: string;
  wordCount: number;
  hasChanged: boolean;
  essayPrefillApplied: boolean;
  questionType: WriterQuestionType;
  /** Chỉ có ý nghĩa khi `questionType === "mcq"`; mảng rỗng cho loại câu khác. */
  choices: Choice[];
  /** Chỉ có mặt khi `questionType === "true_false"` (nội dung từng ý a-d, KHÔNG kèm đáp án). */
  subItems?: { id: SubItemId; text: string }[];
  /** Đáp án Đ/S từng ý của true_false — ground truth, không phải bài làm của người viết. */
  subAnswers?: Partial<Record<SubItemId, boolean>>;
  /** Đáp án mẫu (tự luận) / giá trị mong đợi (short_answer) — `undefined` khi đề không có. */
  essayAnswer?: string;
}

export interface SolutionEditorState {
  solutionId: string | null;
  attemptId: string;
  status: SolutionStatus | null;
  showProfile: boolean;
  showScore: boolean;
  hiddenReason?: string;
  questions: SolutionEditorQuestion[];
}

export interface ResultCardSummary {
  publishedCount: number;
  myStatus: SolutionStatus | null;
  changedQuestionCount: number;
  unseenDeletionReason: string | null;
}

/** Hàng thô mà `community_solution_for_writer` trả cho một câu (jsonb, snake_case). */
interface RawWriterQuestion {
  question_id: string;
  stem: unknown;
  correct_answer: unknown;
  my_result: unknown;
  note: string | null;
  word_count: number;
  has_changed: boolean;
  essay_prefill_applied: boolean;
  question_type: WriterQuestionType | null;
  /** jsonb — `{id,text}[]`; ý nghĩa của `id` (A-D hay a-d) phụ thuộc `question_type`. */
  choices: { id: string; text: string }[] | null;
  sub_answers: Partial<Record<SubItemId, boolean>> | null;
  essay_answer: string | null;
}

interface RawWriterRow {
  solution_id: string | null;
  attempt_id: string;
  status: SolutionStatus | null;
  show_profile: boolean;
  show_score: boolean;
  hidden_reason: string | null;
  questions: RawWriterQuestion[] | null;
}

function mapWriterQuestion(row: RawWriterQuestion): SolutionEditorQuestion {
  const questionType: WriterQuestionType = row.question_type ?? "mcq";
  const rawChoices = row.choices ?? [];
  return {
    questionId: row.question_id,
    stem: row.stem,
    correctAnswer: row.correct_answer,
    myResult: row.my_result,
    // v1.6 mapper rule: SQL null (chưa có ghi chú) → "", không bao giờ null,
    // không bao giờ vắng khoá; word_count đi nguyên, không tính lại ở đây.
    note: row.note ?? "",
    wordCount: row.word_count,
    hasChanged: row.has_changed,
    essayPrefillApplied: row.essay_prefill_applied,
    questionType,
    // Cùng phép tách của result.ts:295-304: mcq giữ nguyên `choices`, true_false
    // đổi tên đọc thành `subItems` (cùng cột jsonb `{id,text}[]`, khác nghĩa `id`).
    choices: questionType === "mcq" ? (rawChoices as Choice[]) : [],
    subItems:
      questionType === "true_false"
        ? (rawChoices as unknown as SolutionEditorQuestion["subItems"])
        : undefined,
    subAnswers: row.sub_answers ?? undefined,
    essayAnswer: row.essay_answer ?? undefined,
  };
}

function mapWriterRow(row: RawWriterRow): SolutionEditorState {
  return {
    solutionId: row.solution_id,
    attemptId: row.attempt_id,
    // status === null khi và chỉ khi solutionId === null — sao y giá trị SQL,
    // không suy diễn "draft" (v1.6 mapper rule).
    status: row.status,
    showProfile: row.show_profile,
    showScore: row.show_score,
    hiddenReason: row.hidden_reason ?? undefined,
    questions: (row.questions ?? []).map(mapWriterQuestion),
  };
}

/**
 * Bài giải của CHÍNH người gọi cho một đề, cho màn viết (S-04) và khối
 * "bài của tôi" ở màn danh sách (S-03).
 *
 * 0 dòng → `null`: người gọi không đủ điều kiện (chưa nộp lượt làm nào, đề
 * chưa published, hoặc tác giả đề đã bị ban) — RPC tự suy lại R1, module này
 * không phân biệt thêm và KHÔNG BAO GIỜ ném lỗi cho trường hợp này (khác lỗi
 * hạ tầng, vẫn ném nguyên).
 */
export async function getMySolutionForWriter(examId: string): Promise<SolutionEditorState | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_solution_for_writer", {
    p_exam_id: examId,
  });
  if (error) throw error;

  const rows = (data ?? []) as RawWriterRow[];
  if (rows.length === 0) return null;

  return mapWriterRow(rows[0]);
}

interface RawResultCardRow {
  published_count: number;
  my_status: SolutionStatus | null;
  changed_question_count: number;
  unseen_deletion_reason: string | null;
}

/**
 * Tấm thẻ kết quả (S20) — CHỈ được gọi từ result/page.tsx (đọc này "tiêu thụ"
 * lý do xoá hẳn chưa xem một lần duy nhất — AC-110). 0 dòng → `null` (đề chưa
 * published/tác giả bị ban/người gọi chưa nộp bài) — không ném lỗi.
 */
export async function getResultCardSummary(examId: string): Promise<ResultCardSummary | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_solution_result_card", {
    p_exam_id: examId,
  });
  if (error) throw error;

  const rows = (data ?? []) as RawResultCardRow[];
  if (rows.length === 0) return null;

  const row = rows[0];
  return {
    publishedCount: row.published_count,
    myStatus: row.my_status,
    changedQuestionCount: row.changed_question_count,
    unseenDeletionReason: row.unseen_deletion_reason,
  };
}
