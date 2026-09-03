// Danh mục đề: lọc, sắp xếp, facet, một đề, tập đề đã nộp.
//
// Màn /exams (Exam Browser) và /exams/[id]. Không có gì thuộc về một lượt
// làm bài cụ thể ở đây.
//
// Tách khỏi `features/exams/queries.ts` (835 dòng) ngày 2026-09-03, mục 7 của
// đợt refactor. Đường import ngoài KHÔNG đổi — `@/features/exams/queries` nay
// phân giải vào `queries/index.ts`.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { BUCKET_HARD_MIN, BUCKET_MEDIUM_MIN, RATING_MIN } from "@/lib/rating";
import type { Exam } from "@/types/exam";
import { EXAM_COLUMNS, toExam, type ExamRow } from "./rows";

// --- Reads ----------------------------------------------------------------

/** Sort cho Exam Browser: theo created_at, hoặc "hardest" theo avg_overall (Rating System). */
export type ExamSort = "newest" | "oldest" | "hardest";

/** Bucket độ khó cộng đồng cho Level filter (khớp lowercase slug FE — IP-6). */
export type ExamLevel = "easy" | "medium" | "hard";

/** Chiều hiển thị của trục ?sort= đang chọn (ExamFilters direction toggle) —
 *  không tự có ý nghĩa nếu thiếu `sort`. */
export type SortDirection = "asc" | "desc";

/** Chiều mặc định của mỗi trục sort khi không truyền `dir` — khớp hành vi cũ
 *  trước khi có direction toggle (Newest=desc, Oldest=asc, Hardest=desc). */
const DEFAULT_ASCENDING: Record<ExamSort, boolean> = {
  newest: false,
  oldest: true,
  hardest: false,
};

// Ranh giới avg_overall theo bucket (nửa-mở, khớp SOURCE/lib/rating's bucket()):
// [1, 2.5) Easy / [2.5, 3.5) Medium / [3.5, 5] Hard trên thang sao 1-5. Lọc
// DB-side (ADR-0008 Implementation Guidance — không merge/lọc aggregate ở JS);
// hai cận lấy thẳng từ lib/rating để không thể lệch với bucket().
const LEVEL_RANGES: Record<ExamLevel, { gte: number; lt?: number }> = {
  easy: { gte: RATING_MIN, lt: BUCKET_MEDIUM_MIN },
  medium: { gte: BUCKET_MEDIUM_MIN, lt: BUCKET_HARD_MIN },
  hard: { gte: BUCKET_HARD_MIN },
};

export interface ExamFilters {
  subject?: string;
  grade?: number;
  school?: string;
  schoolYear?: number;
  semester?: string;
  sort?: ExamSort;
  level?: ExamLevel;
  /** Đảo chiều trục `sort` đang chọn — bỏ qua nếu `sort` không được truyền. */
  dir?: SortDirection;
}

/**
 * Lấy các DÒNG đề thô cho Exam Browser (nội bộ — không export).
 *
 * Tách ra khỏi `listExams` để `listExamsRanked` dùng lại đúng cùng một truy vấn
 * mà không phải chép lại chuỗi lọc, và để `listExams` giữ nguyên hành vi quan
 * sát được (ADR-0015 Decision 1). Trả dòng thô chứ không phải `Exam`: xếp hạng
 * cần `created_at`, thứ mà `toExam` cố ý không map sang hợp đồng presentation.
 */
export async function fetchExamRows(filters?: ExamFilters): Promise<ExamRow[]> {
  const supabase = await createClient();
  // R-7 guard (UGC v2.0): chỉ đề published vào catalog — dù RLS cho tác giả đọc
  // đề chưa published của mình, filter tường minh này chặn nó lọt vào browser.
  // Đọc qua view exams_with_difficulty (ADR-0008 Decision 2) — exams.* + 2 cột
  // aggregate; .eq('status','published') giữ nguyên trên view (R-3).
  let query = supabase.from("exams_with_difficulty").select(EXAM_COLUMNS).eq("status", "published");
  if (filters?.subject) query = query.eq("subject", filters.subject);
  if (filters?.grade !== undefined && !Number.isNaN(filters.grade)) {
    query = query.eq("grade", filters.grade);
  }
  if (filters?.school) query = query.eq("school", filters.school);
  if (filters?.schoolYear !== undefined && !Number.isNaN(filters.schoolYear)) {
    query = query.eq("school_year", filters.schoolYear);
  }
  if (filters?.semester) query = query.eq("semester", filters.semester);
  // Level filter: bucket avg_overall DB-side; NULL (dưới ngưỡng) tự loại (AC-021).
  if (filters?.level) {
    const range = LEVEL_RANGES[filters.level];
    query = query.gte("avg_overall", range.gte);
    if (range.lt !== undefined) query = query.lt("avg_overall", range.lt);
  }
  // Newest/Oldest theo created_at; Hardest theo avg_overall (nulls-last luôn —
  // đề dưới ngưỡng sink xuống cuối bất kể chiều, AC-019/020 — tie-break
  // created_at/id); mặc định giữ order id (ổn định như trước). `dir` đảo chiều
  // ascending của trục đang chọn, mặc định theo DEFAULT_ASCENDING khi không
  // truyền (khớp hành vi cũ).
  if (filters?.sort) {
    const ascending = filters.dir ? filters.dir === "asc" : DEFAULT_ASCENDING[filters.sort];
    if (filters.sort === "hardest") {
      query = query
        .order("avg_overall", { ascending, nullsFirst: false })
        .order("created_at")
        .order("id");
    } else {
      query = query.order("created_at", { ascending });
    }
  } else {
    query = query.order("id");
  }
  // Biên tường minh (P3): đây là lệnh đọc DUY NHẤT chạy trên nội dung TOÀN CỤC
  // — nó lớn theo số đề published của cả site, không theo hoạt động của một
  // người. Nên nó là lệnh đọc sẽ chạm trần PostgREST TRƯỚC TIÊN, và hậu quả của
  // việc chạm trần ở đây là đề biến mất khỏi catalog mà không ai được báo.
  return (await readBounded("listExams", query)) as ExamRow[];
}

/**
 * Đề cho Exam Browser, lọc tuỳ chọn theo môn/lớp/trường/niên khóa/học kỳ/độ khó
 * (S#27, Rating System).
 *
 * Thứ tự trả về của hàm này là thứ tự DB-side: theo `?sort` nếu có, còn không
 * thì `.order("id")`. Đó KHÔNG (còn) là thứ tự mặc định mà /exams hiển thị —
 * thứ tự đó do `listExamsRanked` quyết (ADR-0015 Decision 1b). Giữ nguyên ở đây
 * có chủ ý: hàm này là khối xây dựng nội bộ, và một thứ tự nền ổn định làm đầu
 * vào của bộ xếp hạng tất định hơn thứ tự tuỳ Postgres.
 */
export async function listExams(filters?: ExamFilters): Promise<Exam[]> {
  return (await fetchExamRows(filters)).map(toExam);
}

/** Giá trị khả dụng để dựng bộ lọc (distinct, đã sort) — S#27 thêm school/year/semester. */
export async function listExamFacets(): Promise<{
  subjects: string[];
  grades: number[];
  schools: string[];
  years: number[];
  semesters: string[];
}> {
  const supabase = await createClient();
  // Cùng nhóm rủi ro với `fetchExamRows`: lớn theo số đề của CẢ SITE. Chạm trần
  // ở đây hỏng theo kiểu khó truy hơn — không phải đề biến mất, mà là một giá
  // trị biến mất khỏi BỘ LỌC, nên người dùng không lọc được tới nhóm đề đó nữa
  // dù bản thân các đề vẫn nằm trong catalog.
  const rows = (await readBounded(
    "listExamFacets",
    supabase.from("exams").select("subject, grade, school, school_year, semester")
  )) as {
    subject: string;
    grade: number;
    school: string | null;
    school_year: number | null;
    semester: string | null;
  }[];
  const subjects = [...new Set(rows.map((r) => r.subject))].sort((a, b) =>
    a.localeCompare(b, "vi")
  );
  const grades = [...new Set(rows.map((r) => r.grade))].sort((a, b) => a - b);
  const schools = [
    ...new Set(rows.map((r) => r.school).filter((s): s is string => s !== null)),
  ].sort((a, b) => a.localeCompare(b, "vi"));
  const years = [
    ...new Set(rows.map((r) => r.school_year).filter((y): y is number => y !== null)),
  ].sort((a, b) => b - a); // năm mới nhất lên đầu
  const semesters = [
    ...new Set(rows.map((r) => r.semester).filter((s): s is string => s !== null)),
  ].sort();
  return { subjects, grades, schools, years, semesters };
}

/** Một đề published theo id, hoặc null. R-7 guard: chỉ published (catalog/player).
 * Đọc qua view exams_with_difficulty — cùng nguồn quan hệ với listExams (ADR-0008). */
export async function getExam(id: string): Promise<Exam | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exams_with_difficulty")
    .select(EXAM_COLUMNS)
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) throw error;
  return data ? toExam(data as unknown as ExamRow) : null;
}

/**
 * Set các examId mà user hiện tại đã nộp bài (Rating System — bật/tắt nút Rate, R4).
 * Một round-trip, không N+1 mỗi thẻ đề (NFR Performance); rỗng nếu user chưa nộp bài nào.
 */
export async function listMySubmittedExamIds(): Promise<Set<string>> {
  const supabase = await createClient();
  const rows = (await readBounded(
    "listMySubmittedExamIds",
    supabase.from("exam_attempts").select("exam_id").eq("status", "submitted")
  )) as { exam_id: string }[];
  return new Set(rows.map((row) => row.exam_id));
}
