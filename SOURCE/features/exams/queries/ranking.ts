// Xếp hạng đề cá nhân hoá cho /exams (ADR-0015).
//
// Đọc lịch sử làm bài của chính người dùng rồi đổi thứ tự danh mục. Tách
// riêng vì nó là MỘT quyết định có ADR đứng sau, không phải một bộ lọc nữa.
//
// Tách khỏi `features/exams/queries.ts` (835 dòng) ngày 2026-09-03, mục 7 của
// đợt refactor. Đường import ngoài KHÔNG đổi — `@/features/exams/queries` nay
// phân giải vào `queries/index.ts`.
import "server-only";

import {
  EXAM_RANK_GRADE_MATCH_WEIGHT,
  EXAM_RANK_RECENCY_WEIGHT,
  EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
} from "@/lib/adaptive/constants";
import { rankExamIds } from "@/lib/adaptive/rankExams";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { paginateExams } from "@/lib/exams/paginate";
import type { Exam } from "@/types/exam";
import { toExam } from "./rows";
import { fetchExamRows, type ExamFilters } from "./catalogue";

// --- Xếp hạng cá nhân hoá cho /exams (ADR-0015) -----------------------------

/** Dòng lượt-làm-bài + lớp của đề, lấy kèm trong CÙNG một round-trip. */
type AttemptRow = {
  id: string;
  exam_id: string;
  submitted_at: string | null;
  // ĐÃ ĐO 2026-08-16 (câu hỏi analytics-layer3 để ngỏ, nay đóng lại): PostgREST
  // trả embed to-one này dưới dạng OBJECT — `{"exams":{"grade":10}}` — kiểm
  // bằng chính @supabase/supabase-js trên dev (hynwleaxtbtjzkvpjsug, 40 dòng
  // qua đường anon key + JWT thật, RLS bật). Trên prod (pebjdlbgbmizgfpuptjl)
  // xác nhận gián tiếp mà chắc chắn: `exam_attempts_exam_id_fkey` là khoá ngoại
  // MỘT cột `exam_id -> exams`, và chính chiều many-to-one đó là thứ PostgREST
  // dùng để quyết to-one. Vẫn khai CẢ HAI hình dạng: chi phí bằng 0, còn thứ
  // được bảo vệ là một giả định về thư viện bên thứ ba có thể đổi khi nâng cấp.
  exams: EmbeddedExamFacets | EmbeddedExamFacets[] | null;
};

/** Các facet của đề mà bộ xếp hạng cần, lấy kèm qua embed to-one. */
type EmbeddedExamFacets = { grade: number; subject: string };

function embeddedExam(row: AttemptRow): EmbeddedExamFacets | undefined {
  return Array.isArray(row.exams) ? row.exams[0] : (row.exams ?? undefined);
}

function gradeOfAttempt(row: AttemptRow): number | null {
  const embedded = embeddedExam(row);
  return typeof embedded?.grade === "number" ? embedded.grade : null;
}

/**
 * Môn của đề đã làm, hoặc null khi embed không giao được nó (TD-028).
 *
 * TÁCH KHỎI `gradeOfAttempt` chứ không gộp thành một guard: một embed thiếu MÔN
 * chỉ được phép làm câm tín hiệu môn. Gộp lại thì lượt ấy rơi khỏi cả tín hiệu
 * LỚP — tức một trường thiếu đi sửa thứ tự theo một trục nó không liên quan.
 */
function subjectOfAttempt(row: AttemptRow): string | null {
  const embedded = embeddedExam(row);
  return typeof embedded?.subject === "string" ? embedded.subject : null;
}

export interface RankedExamList {
  /** Đề của TRANG đang xem (đã cắt), không phải toàn bộ tập khớp bộ lọc. */
  exams: Exam[];
  /** Trang hiện tại, 1-based và đã kẹp vào [1, pageCount]. */
  page: number;
  /** Tổng số trang; luôn >= 1 (danh sách rỗng vẫn là "trang 1 / 1"). */
  pageCount: number;
  /** Tổng số đề khớp bộ lọc TRONG cửa sổ xếp hạng — xem ghi chú TD-026. */
  total: number;
  /**
   * Cùng tập id mà `listMySubmittedExamIds()` trả, nhưng suy ra từ CHÍNH lượt
   * đọc mà bộ xếp hạng dùng — nhờ vậy băng "đã làm" và huy hiệu "đã làm" trên
   * thẻ đề không thể bất đồng với nhau.
   */
  submittedExamIds: Set<string>;
}

/**
 * Danh sách đề cho /exams, ĐÃ xếp hạng cho người dùng hiện tại, kèm tập id đã nộp.
 *
 * Đây là thứ trang gọi thay cho `listExams` + `listMySubmittedExamIds`
 * (ADR-0015 Decision 1b). Ba lượt đọc chạy SONG SONG trong cùng một
 * `Promise.all`, nên thời gian thêm vào bị chặn bởi lượt chậm nhất chứ không
 * phải tổng ba lượt — ngân sách là +1 lượt đọc ròng, 0 lượt ghi (PRD NFR).
 *
 * Vì sao gộp ở tầng trang chứ không nhét vào trong `listExams`: nhét vào trong
 * thì `exam_attempts` bị đọc HAI lần mỗi lần render (một cho băng, một ở trang
 * cho nút đánh giá), tức thêm một round-trip liên vùng ~50-60ms cho MỖI lần
 * bấm bộ lọc — mà mỗi lần bấm là một lần render lại toàn phần.
 *
 * `?sort=` tường minh thì KHÔNG xếp hạng gì cả: học sinh đã nói ra thứ tự họ
 * muốn (PRD D3/AC-016). Bộ lọc thì ngược lại — vẫn xếp hạng, trên tập đã hẹp
 * lại (AC-015), và `?dir` mà không kèm `?sort` cũng vẫn xếp hạng (AC-037: một
 * chiều mà không có trục để áp vào thì không phải là một phát biểu về thứ tự).
 *
 * Không đọc danh tính ở đâu cả: mọi lượt đọc đều được RLS giới hạn về đúng
 * người gọi, và quy ước của repo là KHÔNG thêm predicate `user_id` bằng tay
 * (xem features/analytics/queries.ts:90-99).
 */
export async function listExamsRanked(
  filters?: ExamFilters,
  page = 1
): Promise<RankedExamList> {
  const supabase = await createClient();

  // Hai lệnh đọc dưới đây lớn theo hoạt động của MỘT người (RLS khoá về
  // auth.uid()), nên chậm chạm trần hơn hẳn catalog. Vẫn đặt biên: chạm trần ở
  // đây làm tín hiệu xếp hạng bị tính trên dữ liệu thiếu, và thứ tự sai thì
  // không có cách nào nhìn ra bằng mắt — nó chỉ là một thứ tự khác.
  const [rows, attemptRows, resultRows] = await Promise.all([
    fetchExamRows(filters),
    readBounded(
      "listExamsRanked.attempts",
      supabase
        .from("exam_attempts")
        .select("id, exam_id, submitted_at, exams!inner(grade, subject)")
        .eq("status", "submitted")
    ) as Promise<AttemptRow[]>,
    readBounded(
      "listExamsRanked.results",
      supabase.from("exam_results").select("attempt_id, total_score")
    ) as Promise<{ attempt_id: string; total_score: number | string }[]>,
  ]);

  const submittedExamIds = new Set(attemptRows.map((row) => row.exam_id));

  // `total_score` là numeric(4,2) — PostgREST có thể trả về chuỗi. Ép số một
  // lần ở biên thay vì để `rankExamIds` phải biết chuyện đó.
  const scoreByAttempt = new Map<string, number>();
  for (const row of resultRows) {
    const score = Number(row.total_score);
    if (Number.isFinite(score)) scoreByAttempt.set(row.attempt_id, score);
  }

  // Lượt thiếu lớp (embed lệch hình dạng) bị BỎ khỏi tín hiệu lớp chứ không
  // được gán một lớp đoán bừa — nhưng vẫn nằm trong `submittedExamIds` ở trên,
  // nên băng "đã làm" không bao giờ mất đề.
  const attempts = attemptRows.flatMap((row) => {
    const grade = gradeOfAttempt(row);
    if (grade === null) return [];
    return [
      {
        examId: row.exam_id,
        grade,
        subject: subjectOfAttempt(row),
        submittedAt: row.submitted_at,
        totalScore: scoreByAttempt.get(row.id) ?? null,
      },
    ];
  });

  // `?sort` tường minh thắng cá nhân hoá — trả thẳng thứ tự DB-side.
  if (filters?.sort) {
    return { ...paginateExams(rows.map(toExam), page), submittedExamIds };
  }

  const orderedIds = rankExamIds({
    candidates: rows.map((row) => ({
      id: row.id,
      grade: row.grade,
      subject: row.subject,
      createdAt: row.created_at,
    })),
    attempts,
    weights: {
      gradeMatch: EXAM_RANK_GRADE_MATCH_WEIGHT,
      recency: EXAM_RANK_RECENCY_WEIGHT,
      subjectWeakness: EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
    },
  });

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const exams = orderedIds.flatMap((id) => {
    const row = rowById.get(id);
    return row ? [toExam(row)] : [];
  });

  // XẾP HẠNG TRƯỚC, CẮT TRANG SAU — thứ tự này là toàn bộ quyết định của
  // TD-026, xem `paginate()`.
  return { ...paginateExams(exams, page), submittedExamIds };
}
