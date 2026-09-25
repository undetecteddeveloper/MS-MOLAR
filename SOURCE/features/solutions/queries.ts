// Bài giải cộng đồng — đọc phía "của tôi": màn viết (community_solution_for_writer)
// và tấm thẻ kết quả (community_solution_result_card), cùng hai RPC che danh
// tính người KHÁC (task 14): community_solutions_list / community_solution_detail.
//
// import "server-only" (quy ước file query không mang "use server" —
// features/exams/queries/*.ts, features/authoring/queries.ts,
// features/billing/queries.ts): chặn bundle nhầm sang client nếu một ngày có
// import lạc.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { Choice, SubItemId } from "@/types/question";
import { toAuthorIdentity, toScoreField, type AuthorIdentity } from "@/lib/solutions/identity";
import type { PerQuestionResult } from "@/types/result";
import { outcomeBranch, resultLabel, toWriterQuestionOutcome } from "./lib/questionOutcome";

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

// ----------------------------------------------------------------------------
// community_solutions_list / community_solution_detail (task 14) — đọc bài
// giải của NGƯỜI KHÁC, che danh tính qua toAuthorIdentity/toScoreField. Hai RPC
// này là NƠI DUY NHẤT của module này gọi vào hai hàm che đó — không đọc thẳng
// author_display_name/score ở đâu khác trong file (ADR-0021 § Implementation
// Guidance: mọi cột định danh phải qua đúng phép chiếu che, không có ngoại lệ).
//
// author_avatar_path → author (AuthorIdentity): cột RPC lưu nguyên
// user_profiles.avatar_url; KÝ thành URL có hạn là việc của bộ ký hàng loạt
// task 42 thêm vào module này sau (xem Investigation Notes task 14) — cho tới
// lúc đó giá trị đi thẳng vào toAuthorIdentity không qua bước ký nào.

/** Gộp score/score_grading vào MỘT quyết định vắng-mặt duy nhất (toScoreField
 *  là nơi DUY NHẤT tự kiểm null cho `score`); `scoreGrading` không tự kiểm
 *  null lần hai — nó ăn theo đúng kết quả `toScoreField` đã quyết, vì hợp đồng
 *  RPC đảm bảo score_grading null CHÍNH XÁC khi score null (Reference Contract
 *  Value #18). */
function mapScoreFields(row: {
  score: number | null;
  score_grading: boolean | null;
}): { score?: number; scoreGrading?: boolean } {
  const scored = toScoreField({ score: row.score });
  if (!("score" in scored)) return {};
  return { score: scored.score, scoreGrading: row.score_grading as boolean };
}

export interface SolutionListItem {
  id: string;
  isPinned: boolean;
  updatedAt: string;
  isMine: boolean;
  author: AuthorIdentity;
  score?: number;
  scoreGrading?: boolean;
  helpfulCount: number;
  iMarkedHelpful: boolean;
  commentCount: number;
  changedQuestionCount: number;
}

/** Hàng thô mà `community_solutions_list` trả — cột `status` LUÔN 'published'
 *  (RPC chỉ trả bài đã đăng) nên không có mặt trong `SolutionListItem`, đọc
 *  rồi bỏ, không chuyển tiếp. */
interface RawSolutionListRow {
  id: string;
  status: string;
  is_pinned: boolean;
  updated_at: string;
  is_mine: boolean;
  author_id: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  score: number | null;
  score_grading: boolean | null;
  helpful_count: number;
  i_marked_helpful: boolean;
  comment_count: number;
  changed_question_count: number;
}

function mapSolutionListRow(row: RawSolutionListRow): SolutionListItem {
  return {
    id: row.id,
    isPinned: row.is_pinned,
    updatedAt: row.updated_at,
    isMine: row.is_mine,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_path,
    }),
    ...mapScoreFields(row),
    helpfulCount: row.helpful_count,
    iMarkedHelpful: row.i_marked_helpful,
    commentCount: row.comment_count,
    changedQuestionCount: row.changed_question_count,
  };
}

/**
 * Danh sách bài giải đã đăng của một đề, đọc bởi người khác (S-03). Không sắp
 * lại — RPC đã trả đúng thứ tự pinned-desc, helpful-desc, updated_at-desc, id
 * (Reference Contract Value #3, S12). Người gọi không đủ điều kiện → `[]`,
 * không phân biệt "chưa có bài" với "không đủ điều kiện" (AC-063).
 */
export async function listSolutions(examId: string): Promise<SolutionListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_solutions_list", {
    p_exam_id: examId,
  });
  if (error) throw error;

  const rows = (data ?? []) as RawSolutionListRow[];
  return rows.map(mapSolutionListRow);
}

export interface SolutionDetailComment {
  id: string;
  author: AuthorIdentity;
  isSolutionAuthor: boolean;
  isMine: boolean;
  body: string;
  isHiddenByAdmin?: boolean;
  hiddenReason?: string;
  iReported: boolean;
  createdAt: string;
}

export interface SolutionDetailQuestion {
  questionId: string;
  /** Dữ liệu THÔ (chưa dựng ReactNode) — cùng quy ước `SolutionEditorQuestion`
   *  ở trên: dựng thành `stemNode`/`correctAnswerNode` là việc của trang tiêu
   *  thụ (backend DD § Data Contracts `community_solution_detail`: "the
   *  sources the frontend pre-renders into stem_node / correct_answer_node"). */
  stem: unknown;
  correctAnswer: unknown;
  /** Bốn trường này CÙNG gộp từ MỘT cột `per_question` của header — có mặt
   *  khi và chỉ khi `score` có mặt (Reference Contract Value #19); giá trị
   *  RAW của `writerChoiceNode` (chưa dựng ReactNode — cùng quy ước `stem`
   *  trên), dựng thật là việc của trang tiêu thụ. */
  writerChoiceNode?: unknown;
  result?: "correct" | "wrong" | "skipped";
  notAutoScored?: boolean;
  essayScore?: { earned: number; max: number };
  hasChanged: boolean;
  note?: { body: string; commentCount?: number };
  comments: SolutionDetailComment[];
}

export interface SolutionDetail {
  id: string;
  author: AuthorIdentity;
  isPinned: boolean;
  updatedAt: string;
  score?: number;
  scoreGrading?: boolean;
  isMine: boolean;
  helpfulCount: number;
  iMarkedHelpful: boolean;
  iReported: boolean;
  questions: SolutionDetailQuestion[];
}

interface RawSolutionDetailComment {
  id: string;
  author_id: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  is_solution_author: boolean;
  is_mine: boolean;
  body: string;
  is_hidden_by_admin: boolean;
  hidden_reason: string | null;
  i_reported: boolean;
  created_at: string;
}

interface RawSolutionDetailQuestion {
  question_id: string;
  stem: unknown;
  correct_answer: unknown;
  has_changed: boolean;
  note: string | null;
  comment_count: number | null;
  comments: RawSolutionDetailComment[];
}

interface RawSolutionDetailRow {
  id: string;
  author_id: string | null;
  author_display_name: string | null;
  author_avatar_path: string | null;
  is_pinned: boolean;
  updated_at: string;
  score: number | null;
  score_grading: boolean | null;
  per_question: PerQuestionResult[] | null;
  is_mine: boolean;
  helpful_count: number;
  i_marked_helpful: boolean;
  i_reported: boolean;
  questions: RawSolutionDetailQuestion[];
}

function mapSolutionDetailComment(row: RawSolutionDetailComment): SolutionDetailComment {
  return {
    id: row.id,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_path,
    }),
    isSolutionAuthor: row.is_solution_author,
    isMine: row.is_mine,
    body: row.body,
    ...(row.is_hidden_by_admin ? { isHiddenByAdmin: row.is_hidden_by_admin } : {}),
    ...(row.hidden_reason !== null ? { hiddenReason: row.hidden_reason } : {}),
    iReported: row.i_reported,
    createdAt: row.created_at,
  };
}

/** Gộp cột `per_question` của header vào bốn trường của MỘT câu — mirror của
 *  `toAuthorIdentity` gộp ba cột thành một trường (backend DD § Data Contracts
 *  `community_solution_detail`, cột `per_question`). `per_question === null`
 *  (score bị ẩn) → cả bốn trường vắng mặt trên MỌI câu, không viết giá trị
 *  thế chỗ nào (Reference Contract Value #19). Nhánh theo outcome tái dùng
 *  `outcomeBranch`/`resultLabel` (features/solutions/lib/questionOutcome.ts,
 *  đã có từ task 10/11) thay vì viết lại lần hai cùng một phép phân loại. */
function mapPerQuestionFields(
  perQuestion: PerQuestionResult[] | null,
  questionId: string
): Pick<SolutionDetailQuestion, "writerChoiceNode" | "result" | "notAutoScored" | "essayScore"> {
  if (perQuestion === null) return {};

  const rawEntry = perQuestion.find((entry) => entry.questionId === questionId) ?? null;
  const outcome = toWriterQuestionOutcome(rawEntry);
  if (!outcome) return {};

  const choiceField = outcome.selected !== undefined ? { writerChoiceNode: outcome.selected as unknown } : {};
  switch (outcomeBranch(outcome)) {
    case "essay":
      return { ...choiceField, essayScore: { earned: outcome.earnedPoints ?? 0, max: outcome.maxPoints ?? 0 } };
    case "notAutoScored":
      return { ...choiceField, notAutoScored: true };
    case "mcq":
    case "shortAnswerScored":
      return { ...choiceField, result: resultLabel(outcome) };
    default:
      return {};
  }
}

function mapSolutionDetailQuestion(
  row: RawSolutionDetailQuestion,
  perQuestion: PerQuestionResult[] | null
): SolutionDetailQuestion {
  return {
    questionId: row.question_id,
    stem: row.stem,
    correctAnswer: row.correct_answer,
    ...mapPerQuestionFields(perQuestion, row.question_id),
    hasChanged: row.has_changed,
    ...(row.note !== null
      ? { note: { body: row.note, ...(row.comment_count !== null ? { commentCount: row.comment_count } : {}) } }
      : {}),
    comments: row.comments.map(mapSolutionDetailComment),
  };
}

function mapSolutionDetailRow(row: RawSolutionDetailRow): SolutionDetail {
  return {
    id: row.id,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: row.author_avatar_path,
    }),
    isPinned: row.is_pinned,
    updatedAt: row.updated_at,
    ...mapScoreFields(row),
    isMine: row.is_mine,
    helpfulCount: row.helpful_count,
    iMarkedHelpful: row.i_marked_helpful,
    iReported: row.i_reported,
    questions: row.questions.map((q) => mapSolutionDetailQuestion(q, row.per_question)),
  };
}

/**
 * Chi tiết một bài giải, đọc bởi người khác hoặc bởi chính người viết xem
 * trước bản nháp/bị ẩn (AC-063). Không đủ điều kiện/không tồn tại → `null`,
 * không ném lỗi — trang chuyển hướng theo S11 (AC-063).
 */
export async function getSolutionDetail(solutionId: string): Promise<SolutionDetail | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_solution_detail", {
    p_solution_id: solutionId,
  });
  if (error) throw error;

  const rows = (data ?? []) as RawSolutionDetailRow[];
  if (rows.length === 0) return null;

  return mapSolutionDetailRow(rows[0]);
}
