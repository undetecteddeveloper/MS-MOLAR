// Bài giải cộng đồng — đọc phía "của tôi": màn viết (community_solution_for_writer)
// và tấm thẻ kết quả (community_solution_result_card), cùng hai RPC che danh
// tính người KHÁC (task 14): community_solutions_list / community_solution_detail.
//
// import "server-only" (quy ước file query không mang "use server" —
// features/exams/queries/*.ts, features/authoring/queries.ts,
// features/billing/queries.ts): chặn bundle nhầm sang client nếu một ngày có
// import lạc.
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Choice, SubItemId } from "@/types/question";
import { toAuthorIdentity, toScoreField, type AuthorIdentity } from "@/lib/solutions/identity";
import { countUnreadComments } from "@/lib/solutions/unreadComments";
import type { PerQuestionResult } from "@/types/result";
import { outcomeBranch, resultLabel, toWriterQuestionOutcome } from "./lib/questionOutcome";
import { AVATARS_BUCKET, AVATAR_SIGNED_URL_TTL_SECONDS } from "@/lib/profile/avatarStorage";

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
// user_profiles.avatar_url, một PATH object trong bucket private `avatars`
// (không phải URL — khác exam-images, xem resolveAuthorAvatarUrls dưới đây).
// KÝ thành URL có hạn (task 42, tích hợp handoff mà task 14 để lại) chạy
// TRƯỚC khi gọi vào toAuthorIdentity, cho MỌI hàng có tên trong CÙNG một lượt
// đọc — hàng ẩn danh không bao giờ vào danh sách ký.

/**
 * Ký CẢ LOẠT avatar của người viết/người bình luận trong MỘT lượt gọi Storage
 * (`createSignedUrls`, bucket `avatars`) — cùng khuôn `resolveSignedImageUrls`
 * (`lib/ugc/imageUrl.ts:59-95`), khác ở chỗ `author_avatar_path` đã là PATH
 * sẵn (như `resolveAvatarUrl`, `lib/auth/getCurrentUser.ts:128-145`), không
 * phải URL cần bóc path.
 *
 * Chỉ ký path của hàng CÓ TÊN — gọi nơi này truyền vào đúng tập path đã lọc
 * theo `author_display_name !== null` (không tự lọc lại ở đây, vì hàm này
 * không biết display name của từng path; ranh giới ẩn danh nằm ở chỗ gọi).
 *
 * FAIL CLOSED ở MỌI tầng, y hệt `resolveSignedImageUrls`: path rỗng/trùng bị
 * loại trước khi gọi Storage; một mục ký hỏng (per-item `error`) chỉ mục đó
 * `undefined`, mục khác vẫn có URL; cả lô hỏng (Storage trả `error` toàn cục
 * hoặc ném) → MỌI mục `undefined`, KHÔNG ném tiếp — một avatar vỡ không được
 * phép làm hỏng cả trang.
 *
 * Ký bằng client PHIÊN NGƯỜI GỌI (TD-029 — không import service-role), nên
 * RLS `avatars_select_community_visible` vẫn là tầng cưỡng chế cho lượt đọc
 * xuyên người dùng này.
 */
async function resolveAuthorAvatarUrls(
  supabase: SupabaseClient,
  paths: ReadonlyArray<string | null | undefined>
): Promise<Map<string, string>> {
  const signedByPath = new Map<string, string>();
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (uniquePaths.length === 0) return signedByPath;

  try {
    const { data, error } = await supabase.storage
      .from(AVATARS_BUCKET)
      .createSignedUrls(uniquePaths, AVATAR_SIGNED_URL_TTL_SECONDS);
    if (error) {
      console.warn("[resolveAuthorAvatarUrls] ký cả lô hỏng:", error.message);
    } else {
      for (const item of data ?? []) {
        if (item.path && item.signedUrl && !item.error) {
          signedByPath.set(item.path, item.signedUrl);
        }
      }
    }
  } catch (err) {
    console.warn("[resolveAuthorAvatarUrls] Storage không kết nối được:", err);
  }
  return signedByPath;
}

/** `author_avatar_path` → giá trị đưa vào `toAuthorIdentity`'s `author_avatar_url`:
 *  `null` cho hàng ẩn danh (không tra bảng ký) hoặc khi ký vắng/hỏng — cả hai
 *  đều rơi về initials ở `Avatar.tsx`, không phân biệt (fail-closed). */
function resolvedAvatarUrl(
  displayName: string | null,
  path: string | null,
  signedByPath: Map<string, string>
): string | null {
  if (displayName === null || !path) return null;
  return signedByPath.get(path) ?? null;
}

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

function mapSolutionListRow(row: RawSolutionListRow, signedByPath: Map<string, string>): SolutionListItem {
  return {
    id: row.id,
    isPinned: row.is_pinned,
    updatedAt: row.updated_at,
    isMine: row.is_mine,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: resolvedAvatarUrl(row.author_display_name, row.author_avatar_path, signedByPath),
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
  // Ký MỘT lượt cho cả màn hình (Proof Obligation 1) — chỉ path của hàng có
  // tên vào danh sách ký (Proof Obligation 3, anonymity).
  const signedByPath = await resolveAuthorAvatarUrls(
    supabase,
    rows.filter((row) => row.author_display_name !== null).map((row) => row.author_avatar_path)
  );
  return rows.map((row) => mapSolutionListRow(row, signedByPath));
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
  /** Gốc của mạch; null = bản thân là bình luận gốc (trả lời một cấp). */
  parentId?: string | null;
  /** Bình luận cụ thể được trả lời (có thể là một câu trả lời); null nếu là gốc. */
  replyToId?: string | null;
  /** Dòng mờ của gốc đã xoá / bị ẩn mà còn trả lời — không danh tính, không nội dung. */
  placeholder?: "deleted" | "hidden";
}

export interface SolutionDetailQuestion {
  questionId: string;
  /** Dữ liệu THÔ (chưa dựng ReactNode) — cùng quy ước `SolutionEditorQuestion`
   *  ở trên: dựng thành `stemNode`/`correctAnswerNode` là việc của trang tiêu
   *  thụ (backend DD § Data Contracts `community_solution_detail`: "the
   *  sources the frontend pre-renders into stem_node / correct_answer_node"). */
  stem: unknown;
  correctAnswer: unknown;
  /** Bốn trường dưới đây (`questionType`/`choices`/`subItems`/`subAnswers`/
   *  `essayAnswer`) đến từ 4 cột `question_type`/`choices`/`sub_answers`/
   *  `essay_answer` mà backend DD v1.10 (AC-022) bổ sung vào per-question
   *  entry của `community_solution_detail`, cùng cột `exam_answer_key()` đã
   *  trả cho `community_solution_for_writer` — tách theo `questionType` bằng
   *  đúng phép của `mapWriterQuestion` ở trên. Không set (loại câu vắng) →
   *  "mcq", cùng quy ước fallback. Không có UI nào tiêu thụ các trường này ở
   *  bước này — chỉ đưa dữ liệu tới lớp TS an toàn về kiểu. */
  questionType?: WriterQuestionType;
  choices?: Choice[];
  subItems?: SolutionEditorQuestion["subItems"];
  subAnswers?: Partial<Record<SubItemId, boolean>>;
  essayAnswer?: string;
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
  body: string | null;
  is_hidden_by_admin: boolean;
  hidden_reason: string | null;
  i_reported: boolean;
  created_at: string;
  parent_id: string | null;
  reply_to_id: string | null;
  placeholder: "deleted" | "hidden" | null;
}

interface RawSolutionDetailQuestion {
  question_id: string;
  stem: unknown;
  correct_answer: unknown;
  question_type: WriterQuestionType | null;
  /** jsonb — `{id,text}[]`; ý nghĩa của `id` (A-D hay a-d) phụ thuộc `question_type` (cùng quy ước `RawWriterQuestion.choices`). */
  choices: { id: string; text: string }[] | null;
  sub_answers: Partial<Record<SubItemId, boolean>> | null;
  essay_answer: string | null;
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

function mapSolutionDetailComment(
  row: RawSolutionDetailComment,
  signedByPath: Map<string, string>
): SolutionDetailComment {
  return {
    id: row.id,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: resolvedAvatarUrl(row.author_display_name, row.author_avatar_path, signedByPath),
    }),
    isSolutionAuthor: row.is_solution_author,
    isMine: row.is_mine,
    body: row.body ?? "",
    ...(row.is_hidden_by_admin ? { isHiddenByAdmin: row.is_hidden_by_admin } : {}),
    ...(row.hidden_reason !== null ? { hiddenReason: row.hidden_reason } : {}),
    iReported: row.i_reported,
    createdAt: row.created_at,
    parentId: row.parent_id ?? null,
    replyToId: row.reply_to_id ?? null,
    ...(row.placeholder ? { placeholder: row.placeholder } : {}),
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
  perQuestion: PerQuestionResult[] | null,
  signedByPath: Map<string, string>
): SolutionDetailQuestion {
  const questionType: WriterQuestionType = row.question_type ?? "mcq";
  const rawChoices = row.choices ?? [];
  return {
    questionId: row.question_id,
    stem: row.stem,
    correctAnswer: row.correct_answer,
    questionType,
    // Cùng phép tách của mapWriterQuestion trên: mcq giữ nguyên `choices`,
    // true_false đổi tên đọc thành `subItems` (cùng cột jsonb `{id,text}[]`).
    choices: questionType === "mcq" ? (rawChoices as Choice[]) : [],
    subItems:
      questionType === "true_false"
        ? (rawChoices as unknown as SolutionEditorQuestion["subItems"])
        : undefined,
    subAnswers: row.sub_answers ?? undefined,
    essayAnswer: row.essay_answer ?? undefined,
    ...mapPerQuestionFields(perQuestion, row.question_id),
    hasChanged: row.has_changed,
    ...(row.note !== null
      ? { note: { body: row.note, ...(row.comment_count !== null ? { commentCount: row.comment_count } : {}) } }
      : {}),
    comments: row.comments.map((comment) => mapSolutionDetailComment(comment, signedByPath)),
  };
}

/** Mọi `author_avatar_path` có tên trong MỘT hàng detail — header VÀ từng
 *  bình luận của mọi câu — gộp lại để ký chung MỘT lượt (Proof Obligation 1:
 *  "detail with 3 comments -> 1 call covering header + comments"). */
function collectNamedDetailAvatarPaths(row: RawSolutionDetailRow): (string | null)[] {
  const headerPath = row.author_display_name === null ? null : row.author_avatar_path;
  const commentPaths = row.questions.flatMap((question) =>
    question.comments
      .filter((comment) => comment.author_display_name !== null)
      .map((comment) => comment.author_avatar_path)
  );
  return [headerPath, ...commentPaths];
}

function mapSolutionDetailRow(row: RawSolutionDetailRow, signedByPath: Map<string, string>): SolutionDetail {
  return {
    id: row.id,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: resolvedAvatarUrl(row.author_display_name, row.author_avatar_path, signedByPath),
    }),
    isPinned: row.is_pinned,
    updatedAt: row.updated_at,
    ...mapScoreFields(row),
    isMine: row.is_mine,
    helpfulCount: row.helpful_count,
    iMarkedHelpful: row.i_marked_helpful,
    iReported: row.i_reported,
    questions: row.questions.map((q) => mapSolutionDetailQuestion(q, row.per_question, signedByPath)),
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

  const row = rows[0];
  // Ký MỘT lượt cho cả header lẫn mọi bình luận lồng trong hàng này (Proof
  // Obligation 1: "detail with 3 comments -> 1 call covering header + comments").
  const signedByPath = await resolveAuthorAvatarUrls(supabase, collectNamedDetailAvatarPaths(row));
  return mapSolutionDetailRow(row, signedByPath);
}

// ----------------------------------------------------------------------------
// community_my_comment_feed (task 25) — feed "Bình luận của tôi" (S-tab hồ sơ)
// + công thức đếm chưa đọc dùng chung (task 26, decomposer resolution R6:
// "one formula, two call sites" — countUnreadComments trong
// lib/solutions/unreadComments.ts, không lặp lại luật đếm ở đây).
//
// Cỡ trang cố định phía server — CAO HƠN hoặc bằng trần 20 mà chính RPC đã tự
// áp (schema.sql: least(greatest(coalesce(p_page_size,20),1),20)); truyền
// đúng con số RPC đã dùng làm mặc định, không bịa thêm một trần khác.
const COMMENT_FEED_PAGE_SIZE = 20;

/** Hàng thô mà `community_my_comment_feed` trả — đúng MƯỜI cột, đúng thứ tự
 *  (schema.sql §22, backend DD v1.6 § Data Contracts). KHÔNG có cột định danh
 *  hay ảnh nào khác `author_display_name` — feed này không trả `author_id` và
 *  không trả đường dẫn ảnh (frontend DD § Data Contracts "Comment feed
 *  contract": "the feed carries no avatar"). */
interface RawCommentFeedRow {
  comment_id: string;
  solution_id: string;
  exam_id: string;
  exam_title: string;
  question_number: number;
  comment_body: string;
  comment_created_at: string;
  author_display_name: string | null;
  is_unread: boolean;
  exam_visible: boolean;
  thread_root_id: string;
  is_reply_to_me: boolean;
  reply_to_body: string | null;
}

export interface CommentFeedItem {
  commentId: string;
  solutionId: string;
  examId: string;
  examTitle: string;
  questionNumber: number;
  commentBody: string;
  commentCreatedAt: string;
  author: AuthorIdentity;
  isUnread: boolean;
  examVisible: boolean;
  /** Gốc của mạch chứa bình luận này — đích `?thread=` của nút "Xem trả lời". */
  threadRootId?: string;
  /** Bình luận này trả lời một bình luận CỦA TÔI (không phải chỉ nằm dưới bài của tôi). */
  isReplyToMe?: boolean;
  /** Nội dung bình luận của tôi được trả lời (dòng trích "Bạn: …"); null khi không phải trả lời tôi. */
  replyToBody?: string | null;
}

/** `author_avatar_url: null` TƯỜNG MINH — feed không có cột ảnh, nên đây
 *  không phải một cột bị bỏ đọc mà là hợp đồng: một hàng có tên không bao giờ
 *  mang `avatarUrl` từ hàm này (frontend DD § Data Contracts "Comment feed
 *  contract", Proof Obligation "no batch avatar signer wired into this
 *  function"). */
function mapCommentFeedRow(row: RawCommentFeedRow): CommentFeedItem {
  return {
    commentId: row.comment_id,
    solutionId: row.solution_id,
    examId: row.exam_id,
    examTitle: row.exam_title,
    questionNumber: row.question_number,
    commentBody: row.comment_body,
    commentCreatedAt: row.comment_created_at,
    author: toAuthorIdentity({ author_display_name: row.author_display_name, author_avatar_url: null }),
    isUnread: row.is_unread,
    examVisible: row.exam_visible,
    threadRootId: row.thread_root_id,
    isReplyToMe: row.is_reply_to_me,
    replyToBody: row.reply_to_body ?? null,
  };
}

/**
 * Một trang bình luận của người khác trên các bài giải ĐÃ ĐĂNG của chính
 * người gọi (S-tab hồ sơ "Bình luận", AC-091–AC-098). `page` 1-based; cỡ
 * trang cố định phía server (>= 20, frontend DD § Data Contracts). Quá trang
 * cuối → mảng rỗng, không lỗi.
 */
export async function getMyCommentFeed(page: number): Promise<CommentFeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_my_comment_feed", {
    p_page: page,
    p_page_size: COMMENT_FEED_PAGE_SIZE,
  });
  if (error) throw error;

  const rows = (data ?? []) as RawCommentFeedRow[];
  return rows.map(mapCommentFeedRow);
}

/**
 * Tổng số bình luận "mới" (AC-091, AC-092) trên mọi bài giải của người gọi —
 * "k bình luận mới" của chip hồ sơ (task 45) hay của một bài giải cụ thể khi
 * `opts.solutionId` được truyền (task 29). Dùng CHUNG `countUnreadComments`
 * (decomposer resolution R6) — không lặp lại luật `isUnread && examVisible` ở
 * đây.
 *
 * Khai thác đúng bảo đảm của chính feed: hàng chưa đọc luôn nằm ở ĐẦU danh
 * sách mới-nhất-trước (`is_unread` không phụ thuộc `exam_visible` — backend DD
 * § Data Contracts "community_my_comment_feed"). Vì vậy hàng chưa đọc luôn tạo
 * thành một TIỀN TỐ liên tục của feed: lấy từng trang, DỪNG ngay khi gặp
 * trang KHÔNG ĐẦY (đã hết dữ liệu) hoặc trang có chứa một hàng ĐÃ ĐỌC (tiền tố
 * đã kết thúc giữa trang) — không cần đọc quá trang đó, vì mọi hàng sau nó
 * (mới hơn... không, CŨ hơn, vì thứ tự giảm dần) đã đọc hoặc không tồn tại.
 */
// ----------------------------------------------------------------------------
// community_reputation_summary (task 41) — the caller's OWN reputation, for
// ReputationBlock (task 44). Deliberately does NOT follow the throw-on-error
// convention every other function in this file uses: the frontend DD's
// "ProfileCard reputation insertion" boundary contract requires a RETURNED
// failure result on RPC error (page renders no block, no log at this layer —
// only an unrelated thrown exception is the page's console.error case,
// frontend DD § Data Flow), not an exception from this function.

export interface ReputationSummary {
  totalScore: number;
  publishedCount: number;
  helpfulCount: number;
  pinnedCount: number;
}

export type ReputationResult = ({ ok: true } & ReputationSummary) | { ok: false };

interface RawReputationRow {
  total_score: number;
  published_count: number;
  helpful_count: number;
  pinned_count: number;
}

function mapReputationRow(row: RawReputationRow): ReputationSummary {
  return {
    // AC-086: the RPC computes this fresh every call; no recomputation here.
    totalScore: row.total_score,
    publishedCount: row.published_count,
    helpfulCount: row.helpful_count,
    pinnedCount: row.pinned_count,
  };
}

/**
 * Uy tín của CHÍNH người gọi (S-tab hồ sơ, AC-086–AC-090). Không tham số —
 * RPC chỉ đọc `auth.uid()` (AC-089). Lỗi RPC → kết quả thất bại, KHÔNG ném,
 * để `ProfilePage` không render khối uy tín mà cũng không lỗi cả trang
 * (frontend DD "ReputationBlock" "Lỗi: khối không render").
 */
export async function getMyReputation(): Promise<ReputationResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_reputation_summary");
  if (error) return { ok: false };

  const rows = (data ?? []) as RawReputationRow[];
  // Contract guarantee (schema.sql: aggregate with no group by): always
  // exactly one row, all-zero fields when the caller has 0 published
  // solutions (AC-090) — never zero rows. Defensive fallback kept minimal.
  const row = rows[0];
  if (!row) return { ok: false };

  return { ok: true, ...mapReputationRow(row) };
}

export async function getMyUnreadCommentCount(opts?: { solutionId?: string }): Promise<number> {
  const supabase = await createClient();

  let total = 0;
  let page = 1;
  for (;;) {
    const { data, error } = await supabase.rpc("community_my_comment_feed", {
      p_page: page,
      p_page_size: COMMENT_FEED_PAGE_SIZE,
    });
    if (error) throw error;

    const rows = ((data ?? []) as RawCommentFeedRow[]).map(mapCommentFeedRow);
    total += countUnreadComments(rows, opts);

    const pageIsFull = rows.length === COMMENT_FEED_PAGE_SIZE;
    const pageHasReadRow = rows.some((row) => !row.isUnread);
    if (!pageIsFull || pageHasReadRow) break;

    page += 1;
  }

  return total;
}

// =============================================================================
// Kệ "Lời giải cộng đồng mới nhất" — trang chủ (F-041, 2026-09-30)
// =============================================================================

export interface HomeSolutionTeaser {
  id: string;
  examId: string;
  examSubject: string;
  examGrade: number;
  updatedAt: string;
  author: AuthorIdentity;
  helpfulCount: number;
}

interface RawHomeSolutionRow {
  id: string;
  exam_id: string;
  exam_subject: string;
  exam_grade: number;
  updated_at: string;
  author_display_name: string | null;
  author_avatar_path: string | null;
  helpful_count: number;
}

function mapHomeSolutionRow(
  row: RawHomeSolutionRow,
  signedByPath: Map<string, string>
): HomeSolutionTeaser {
  return {
    id: row.id,
    examId: row.exam_id,
    examSubject: row.exam_subject,
    examGrade: row.exam_grade,
    updatedAt: row.updated_at,
    author: toAuthorIdentity({
      author_display_name: row.author_display_name,
      author_avatar_url: resolvedAvatarUrl(row.author_display_name, row.author_avatar_path, signedByPath),
    }),
    helpfulCount: row.helpful_count,
  };
}

/**
 * N bài giải cộng đồng mới nhất XUYÊN NHIỀU đề, cho trang chủ (F-041) — RPC
 * `community_solutions_latest_for_home` (schema.sql §26) tự lọc theo eligibility
 * (đã nộp đúng đề đó) NÊN kết quả CÁ NHÂN HOÁ theo người gọi, không phải một
 * feed giống nhau cho mọi người.
 *
 * Lỗi RPC → mảng rỗng, KHÔNG ném: khối này là trang trí trên trang chủ, cùng
 * triết lý `getMyReputation` ở trên — trang chủ không được vỡ vì một khối phụ.
 */
export async function listLatestSolutionsForHome(limit: number): Promise<HomeSolutionTeaser[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("community_solutions_latest_for_home", {
    p_limit: limit,
  });
  if (error) return [];

  const rows = (data ?? []) as RawHomeSolutionRow[];
  const signedByPath = await resolveAuthorAvatarUrls(
    supabase,
    rows.filter((row) => row.author_display_name !== null).map((row) => row.author_avatar_path)
  );
  return rows.map((row) => mapHomeSolutionRow(row, signedByPath));
}
