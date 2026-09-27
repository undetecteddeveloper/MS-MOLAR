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
import { orderIdsByHotCount, type HotCounts, type ShelfCandidate } from "@/lib/adaptive/examShelves";
import { rankExamIds } from "@/lib/adaptive/rankExams";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { paginateExams } from "@/lib/exams/paginate";
import type { Exam } from "@/types/exam";
import { toExam, type ExamRow } from "./rows";
import { fetchExamRows, type ExamFilters } from "./catalogue";
import { readMyAttemptRows, submittedExamIdsOf, toShelfAttempts } from "./attempts";
import { readHotCounts } from "./hotCounts";

/**
 * `ExamRow[]` → `ShelfCandidate[]`, riêng cho nhánh `?sort=hot` bên dưới —
 * `orderIdsByHotCount` (P1-T4, `lib/adaptive/examShelves.ts`) chỉ thật sự đọc
 * field `id`, nhưng đòi kiểu `ShelfCandidate[]` đầy đủ.
 *
 * Bản sao CỤC BỘ của `candidatesFromRows` trong `shelves.ts` — hàm đó KHÔNG
 * export và nằm ngoài Target Files của task này (P4-T2). Rule of Three: đây là
 * lần thứ 2 của phép ánh xạ 5 trường thuần cấu trúc này (lần 1 phục vụ 2 nơi
 * gọi ngay trong `shelves.ts`); hợp nhất bị hoãn lại, không bắt buộc ở lần 2.
 */
function hotCandidatesFromRows(rows: readonly ExamRow[]): ShelfCandidate[] {
  return rows.map((row) => ({
    id: row.id,
    grade: row.grade,
    subject: row.subject,
    school: row.school,
    createdAt: row.created_at,
  }));
}

/**
 * Đề trong đúng thứ tự "Nổi nhất" phẳng (`total_count DESC, id ASC`, AC-018) —
 * id không còn nằm trong `rows` (hiếm) bị bỏ, cùng quy ước "rơi khỏi rowById
 * thì bị bỏ" mà nhánh xếp hạng cá nhân hoá bên dưới đã dùng.
 */
function applyHotOrder(rows: readonly ExamRow[], hotCounts: ReadonlyMap<string, HotCounts>): ExamRow[] {
  const rowById = new Map(rows.map((row) => [row.id, row]));
  return orderIdsByHotCount(hotCandidatesFromRows(rows), hotCounts).flatMap((id) => {
    const row = rowById.get(id);
    return row ? [row] : [];
  });
}

// --- Xếp hạng cá nhân hoá cho /exams (ADR-0015) -----------------------------

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
  // Đồng hồ đọc ĐÚNG MỘT LẦN mỗi lượt gọi (ADR-0021 D4) — kể cả trên đường
  // không phải `?sort=hot`, cùng quy ước `shelves.ts` đã dùng cho `now`.
  const now = new Date();

  // Hai lệnh đọc dưới đây lớn theo hoạt động của MỘT người (RLS khoá về
  // auth.uid()), nên chậm chạm trần hơn hẳn catalog. Vẫn đặt biên: chạm trần ở
  // đây làm tín hiệu xếp hạng bị tính trên dữ liệu thiếu, và thứ tự sai thì
  // không có cách nào nhìn ra bằng mắt — nó chỉ là một thứ tự khác.
  //
  // Thành viên thứ 4: `?sort=hot` là trục DUY NHẤT cần cửa sổ đếm cross-user
  // (backend DD § The ?sort=hot axis). Mọi đường khác giữ nguyên ngân sách 3
  // lượt đọc — nhánh else là một Promise ĐÃ RESOLVE, 0 lượt gọi mạng thêm.
  const [rows, attemptRows, resultRows, hotCounts] = await Promise.all([
    fetchExamRows(filters),
    readMyAttemptRows(supabase, "listExamsRanked.attempts"),
    readBounded(
      "listExamsRanked.results",
      supabase.from("exam_results").select("attempt_id, total_score")
    ) as Promise<{ attempt_id: string; total_score: number | string }[]>,
    filters?.sort === "hot"
      ? readHotCounts(supabase, "listExamsRanked.hotCounts", now)
      : Promise.resolve<Map<string, HotCounts>>(new Map()),
  ]);

  const submittedExamIds = submittedExamIdsOf(attemptRows);

  // `total_score` là numeric(4,2) — PostgREST có thể trả về chuỗi. Ép số một
  // lần ở biên thay vì để `rankExamIds` phải biết chuyện đó.
  const scoreByAttempt = new Map<string, number>();
  for (const row of resultRows) {
    const score = Number(row.total_score);
    if (Number.isFinite(score)) scoreByAttempt.set(row.attempt_id, score);
  }

  const attempts = toShelfAttempts(attemptRows, scoreByAttempt);

  // `?sort` tường minh thắng cá nhân hoá — trả thẳng thứ tự DB-side, TRỪ
  // `"hot"`: trục đó không có thứ tự DB-side thật (catalogue.ts chỉ
  // `.order("id")` để cấp đầu vào tất định) — thứ tự thật dựng ở ĐÂY, Node-side,
  // bằng `orderIdsByHotCount` trên cửa sổ đếm cross-user vừa đọc ở trên
  // (AC-018/AC-034). `?dir` không được đọc ở nhánh này — vẫn được CHẤP NHẬN
  // (không throw/400) nhưng không có hiệu lực, đúng Proof Obligation của task.
  if (filters?.sort) {
    const orderedRows = filters.sort === "hot" ? applyHotOrder(rows, hotCounts) : rows;
    return { ...paginateExams(orderedRows.map(toExam), page), submittedExamIds };
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
