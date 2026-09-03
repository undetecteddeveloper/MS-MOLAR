// Logic Layer 2 — Reads (GĐ 2 M2.5/M2.6). Server-only: dùng Supabase server client.
// Gọi từ Server Component. Thay getFakeExams/getFakeExam/getFakeQuestions của GĐ 1.
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 4.2.
import "server-only";

import {
  EXAM_RANK_GRADE_MATCH_WEIGHT,
  EXAM_RANK_RECENCY_WEIGHT,
  EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
} from "@/lib/adaptive/constants";
import { rankExamIds } from "@/lib/adaptive/rankExams";
import { createClient } from "@/lib/supabase/server";
import { readBounded } from "@/lib/supabase/boundedRead";
import { EXAMS_PAGE_SIZE, paginateExams } from "@/lib/exams/paginate";
import {
  BUCKET_HARD_MIN,
  BUCKET_MEDIUM_MIN,
  communityDifficultyFrom,
  RATING_MIN,
} from "@/lib/rating";
import { computeWrongTwiceQuestionIds, type WrongTwiceAttempt } from "@/lib/scoring/wrongTwice";
import {
  deriveEssayView,
  hasIncompleteEssay,
  summariseEssays,
  type EssaySummary,
} from "@/lib/scoring/essayLifecycle";
import { resolveSignedImageUrls } from "@/lib/ugc/imageUrl";
import { repairTrueFalseStem } from "@/lib/ugc/tfShape";
import type { SubItemId } from "@/lib/ugc/types";
import type { Exam } from "@/types/exam";
import type { Choice, PublicQuestion } from "@/types/question";
import type { PerQuestionResult, ScoreResult } from "@/types/result";

// `EXAMS_PAGE_SIZE`/`paginateExams` ở `lib/exams/paginate.ts` — file này có
// `import "server-only"`, nên một hàm THUẦN nằm trong đây thì không test được
// mà không dựng cả một môi trường server giả. Re-export để chỗ gọi không phải
// biết chuyện đó.
export { EXAMS_PAGE_SIZE, paginateExams };

// --- Mappers (snake_case DB → camelCase type) ----------------------------

type ExamRow = {
  id: string;
  title: string;
  question_ids: string[];
  duration_minutes: number;
  subject: string;
  grade: number;
  school: string | null;
  school_year: number | null;
  semester: string | null;
  author_display_name: string | null;
  parts: { number: number; title: string }[] | null;
  passages: { id: string; title?: string; text: string }[] | null;
  /** Rating System (ADR-0008): từ view exams_with_difficulty, không phải bảng exams. */
  rating_count: number;
  avg_overall: number | null;
  /** Xếp hạng cá nhân hoá (ADR-0015): tín hiệu mới-cũ. KHÔNG đi vào `Exam` —
   *  `toExam` chỉ map các field có tên, nên hợp đồng `Exam` vẫn y nguyên. */
  created_at: string;
};

// Cột đề dùng chung cho mọi query exams (S#27: school/school_year/semester;
// UGC v2.0: author_display_name cho byline; v2.1: parts cho heading phần;
// Rating System: rating_count/avg_overall — chỉ tồn tại khi đọc qua view
// exams_with_difficulty, KHÔNG phải cột trên bảng exams (ADR-0008 Decision 1/2);
// ADR-0015: created_at cho xếp hạng — view đã phơi sẵn qua `e.*`, không phải
// nới hình dạng view (schema.sql:1009-1015 đóng băng hình dạng đó).
//
// CẢNH BÁO: chuỗi này có một BẢN SAO CHÉP TAY ở SOURCE/scripts/perf-layers.ts
// (:122-123) và hai bản trôi lệch trong im lặng — sửa ở đây thì sửa luôn ở đó,
// đúng như header của chính file benchmark đó đã ghi.
const EXAM_COLUMNS =
  "id, title, question_ids, duration_minutes, subject, grade, school, school_year, semester, author_display_name, parts, passages, rating_count, avg_overall, created_at";

function toExam(row: ExamRow): Exam {
  return {
    id: row.id,
    title: row.title,
    questionIds: row.question_ids,
    durationMinutes: row.duration_minutes,
    subject: row.subject,
    grade: row.grade,
    school: row.school ?? undefined,
    schoolYear: row.school_year ?? undefined,
    semester: row.semester ?? undefined,
    authorDisplayName: row.author_display_name ?? undefined,
    parts: row.parts ?? undefined,
    passages: row.passages ?? undefined,
    communityDifficulty: communityDifficultyFrom(row.avg_overall, row.rating_count),
  };
}

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
async function fetchExamRows(filters?: ExamFilters): Promise<ExamRow[]> {
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

/**
 * Đề + danh sách câu hỏi cho Player — KHÔNG kèm `correctAnswer` (bảo mật).
 * Câu hỏi được sắp theo đúng thứ tự `questionIds`. null nếu đề không tồn tại.
 */
export async function getExamForPlayer(
  id: string
): Promise<{ exam: Exam; questions: PublicQuestion[] } | null> {
  const supabase = await createClient();
  const exam = await getExam(id);
  if (!exam) return null;

  // KHÔNG select correct_answer / essay_answer / sub_answers (đáp án — mọi
  // dạng đều server-only, kể cả Đ/S từng ý của true_false — v2.1 ADR-0005).
  // UGC v2.0: thêm question_type + image_url; v2.1: part_number (cột choices
  // với true_false chứa các Ý a–d — nội dung, an toàn để render).
  const { data, error } = await supabase
    .from("questions")
    .select(
      "id, content, choices, subject, grade, topic, question_type, part_number, image_url, passage_id"
    )
    .in("id", exam.questionIds);
  if (error) throw error;

  const rows = data as Array<{
    id: string;
    content: string;
    choices: PublicQuestion["choices"];
    subject: string;
    grade: number;
    topic: string;
    question_type: string | null;
    part_number: number | null;
    image_url: string | null;
    passage_id: string | null;
  }>;

  // Đổi image_url đã lưu → signed URL (bucket private) để player render được.
  // MỘT lượt gọi Storage cho cả đề (`createSignedUrls`) thay vì N lượt song
  // song — đo 2026-09-03 trên dev: một lượt lô ≈ 216 ms, một lượt đơn ≈ 409 ms;
  // đề 40 câu có hình trước đây là 40 request (A3). Mục nào ký hỏng thì
  // `get()` trả undefined, y như bản ký từng ảnh.
  const signedImages = await resolveSignedImageUrls(
    supabase,
    rows.map((r) => r.image_url)
  );
  const byId = new Map<string, PublicQuestion>();
  rows.forEach((r) => {
    const questionType =
      (r.question_type as "mcq" | "essay" | "true_false" | "short_answer" | null) ?? "mcq";
    // SHIM CHO ROW CŨ (2026-09-02) — câu Đúng/Sai lưu TRƯỚC bản vá
    // `repairTrueFalseStem` có `choices` rỗng và câu phán xét kẹt trong
    // `content`. Đây là đường đọc mà việc KHÔNG vá tốn nhiều nhất: học sinh
    // mở bài ra và thấy một câu hỏi không có gì để bấm. Cùng một hàm với màn
    // duyệt, cố ý — hai đường đọc dựng hai cấu trúc khác nhau cho cùng một
    // row là đúng thứ shim này sinh ra để tránh.
    const shaped = repairTrueFalseStem(
      questionType,
      r.content,
      questionType === "true_false"
        ? (r.choices as unknown as { id: SubItemId; text: string }[])
        : undefined
    );
    byId.set(r.id, {
      id: r.id,
      content: shaped.stem,
      // true_false: cột choices chứa các ý a–d → map sang subItems.
      choices: questionType === "true_false" ? [] : r.choices,
      subItems:
        questionType === "true_false"
          ? (shaped.subItems as unknown as PublicQuestion["subItems"])
          : undefined,
      subject: r.subject,
      grade: r.grade,
      topic: r.topic,
      questionType,
      partNumber: r.part_number ?? 1,
      passageId: r.passage_id ?? undefined,
      imageUrl: r.image_url ? signedImages.get(r.image_url) : undefined,
    });
  });
  const questions = exam.questionIds
    .map((qid) => byId.get(qid))
    .filter((q): q is PublicQuestion => q !== undefined);

  return { exam, questions };
}

// --- Result ---------------------------------------------------------------

type ResultRow = {
  total_score: number;
  correct: number;
  total: number;
  per_question: ScoreResult["perQuestion"];
  topic_breakdown: ScoreResult["topicBreakdown"];
  /** Mốc bắt đầu của hạn chờ chấm tự luận (ADR-0018/AC-026). KHÔNG có trong
   *  select trước ADR-0018 — D-02. `exam_attempts.submitted_at` KHÔNG thay thế
   *  được: hai mốc lệch nhau đúng bằng thời gian `record_exam_result()` chạy,
   *  và AC-026 nêu đích danh `exam_results.created_at`. */
  created_at: string;
};

/** Nội dung một câu để render màn Chi tiết (post-submit nên kèm được lựa chọn).
 * v2.1: kèm loại câu + đáp án lưu trữ của câu KHÔNG chấm (true_false/short/
 * essay) — màn Chi tiết là SAU KHI NỘP, xem được đáp án (như mcq đã hiển thị
 * correct từ per_question). subItems của true_false nằm trong cột choices. */
export type ResultQuestion = {
  content: string;
  choices: Choice[];
  questionType: "mcq" | "essay" | "true_false" | "short_answer";
  subItems?: { id: "a" | "b" | "c" | "d"; text: string }[];
  subAnswers?: Partial<Record<"a" | "b" | "c" | "d", boolean>>;
  essayAnswer?: string;
  /** Hình thân câu, ĐÃ ký (signed URL) — `undefined` khi câu không có hình
   *  hoặc không ký được. Bucket exam-images PRIVATE nên URL lưu trong DB
   *  KHÔNG render được trực tiếp: `<img>` không gửi được header auth, ảnh về
   *  400 và trình duyệt chỉ hiện icon vỡ. Đây là lý do trường này tồn tại
   *  riêng thay vì để trang tự đọc `image_url` — cùng hợp đồng với
   *  `PublicQuestion.imageUrl` mà `getExamForPlayer()` đã trả cho màn làm bài. */
  imageUrl?: string;
  /** NGỮ LIỆU DÙNG CHUNG (A1) — nội dung bài đọc mà câu này tham chiếu, đã
   *  GIẢI SẴN từ `exam.passages`. Trang Chi tiết nhận chuỗi chứ không nhận
   *  khoá: nó dò lại từng câu một, và bắt nó tự tra một bảng thứ hai chỉ để
   *  hiện đúng đoạn văn là mời gọi cái bug "câu này mất bài đọc". */
  passageText?: string;
  passageTitle?: string;
};

export type ExamResult = {
  examId: string;
  examTitle: string;
  subject: string;
  result: ScoreResult;
  /** questionId → nội dung + lựa chọn (để render Chi tiết từng câu, Task 4). */
  questions: Record<string, ResultQuestion>;
  /** Luôn có mặt — exam_attempts.started_at NOT NULL DEFAULT now() (History). */
  startedAt: string;
  /** null khi truy cập trực tiếp URL attempt trong khoảng hở trước khi
   * submitExam() cập nhật xong status/submitted_at (History). */
  submittedAt: string | null;
  /** Số giây nộp QUÁ thời gian cho phép; 0 = trong giờ (Security review #6).
   * DB tự tính trong record_exam_result() từ started_at + duration_minutes —
   * client không khai được, kể cả khi tắt JS để vô hiệu hoá đồng hồ đếm ngược. */
  overtimeSeconds: number;
  /** Tổng hợp mức-lượt-thi của các câu tự luận, hoặc `undefined` khi KHÔNG dòng
   * nào mang khoá vòng đời (dòng cũ / tính năng tắt). `undefined` chứ không phải
   * một summary toàn số 0 chính là thứ giữ AC-012 đúng trên đường ĐỌC: một dòng
   * ghi trước khi tính năng ship không mọc thêm trường nào có giá trị. */
  essaySummary?: EssaySummary;
  /** Có câu tự luận nào đã dừng hẳn ở RS-6 (thất bại, hết lượt) không — điều
   * kiện in chú thích PDF (O-8/AC-058).
   *
   * BẮT BUỘC, không phải tuỳ chọn, và đó là chỗ hai mục của Design Doc bất đồng
   * (Open Item I-4): bản kế hoạch theo § Interface Change Matrix. Lý do là một
   * lý do sản phẩm chứ không phải sở thích kiểu — trường này là ĐẦU VÀO QUYẾT
   * ĐỊNH của chú thích PDF, nên một ca `undefined` ở đây là một tệp PDF không
   * quyết được nội dung. Luôn tính được: `false` khi không có khoá nào. */
  hasIncompleteEssay: boolean;
};

/** Lịch sử làm bài của CHÍNH user đang đăng nhập, rút gọn còn đúng phần
 * computeWrongTwiceQuestionIds() cần (Engine 1, backend DD § Data Contracts).
 *
 * KHÔNG lọc user_id: policy `results_select_own` (schema.sql §RLS) đã giới hạn
 * `user_id = auth.uid()`, và cột user_id không nằm trong projection này. Cũng
 * không lọc trạng thái: exam_results chỉ có dòng cho attempt ĐÃ NỘP, vì
 * record_exam_result() là đường ghi duy nhất và nó đòi status='submitted'.
 *
 * Dòng đang xem cũng nằm trong tập này — đúng theo contract ("across all
 * attempts including the current one being viewed").
 *
 * SUY GIẢM MỀM khi query lỗi, KHÁC với vòng 1 của getResult(): đây là dữ liệu
 * LÀM GIÀU cho một cờ hiển thị, không phải dữ liệu cốt lõi của trang. Trả []
 * → mọi hasBeenWrongTwice thành undefined → affordance không hiện, đúng trạng
 * thái fail-closed UI Spec §D1 đã định nghĩa ("Absent/false = affordance does
 * not render", AC-024). Ném lỗi ở đây sẽ đánh sập cả màn Chi tiết vốn đã chạy
 * tốt từ trước tính năng này — một lỗi nặng hơn hẳn lỗi nó báo. */
async function fetchWrongTwiceAttempts(
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<WrongTwiceAttempt[]> {
  // `readBounded` NÉM lỗi hạ tầng thay vì trả `error`, nên đường suy giảm mềm
  // của hàm này chuyển sang try/catch. Rộng hơn bản cũ chứ không hẹp hơn: nó bắt
  // cả exception, thứ mà nhánh `if (error)` cũ để lọt lên trên và đánh sập đúng
  // màn Chi tiết mà cả đoạn docblock trên cam kết không làm sập.
  let rows: { attempt_id: string; per_question: PerQuestionResult[] | null }[];
  try {
    rows = (await readBounded(
      "getResult.wrongTwiceHistory",
      supabase.from("exam_results").select("attempt_id, per_question")
    )) as { attempt_id: string; per_question: PerQuestionResult[] | null }[];
  } catch (err) {
    // Chỉ code + message: `details`/`hint` của PostgREST có thể chứa giá trị
    // dòng dữ liệu, không được đưa vào log.
    const e = err as { code?: string; message?: string };
    console.warn("[getResult] đọc lịch sử wrong-twice thất bại:", e.code, e.message);
    return [];
  }
  // per_question là jsonb → về lý thuyết có thể null với dòng hỏng; hàm thuần
  // nhận kiểu mảng chặt nên chuẩn hoá ngay tại ranh giới dữ liệu này.
  return rows.map((r) => ({ attemptId: r.attempt_id, perQuestion: r.per_question ?? [] }));
}

/**
 * Kết quả của một attempt đã nộp. null nếu attempt không tồn tại / chưa nộp /
 * không thuộc về user (RLS lọc) → caller redirect về trang đề (Q2=A).
 */
export async function getResult(attemptId: string): Promise<ExamResult | null> {
  const supabase = await createClient();

  // Vòng 1 — MỘT request cho cả 3 tầng: exam_results + attempt (FK) + đề (view).
  // Trước đây là 3 query nối đuôi (exam_results → exam_attempts → getExam) rồi
  // mới tới questions, tức 4×RTT; nay còn 2×RTT. Embed xuyên qua VIEW
  // exams_with_difficulty đã được kiểm chứng thực tế chạy được (view không có FK
  // metadata riêng nên KHÔNG hiển nhiên — đừng đổi sang bảng `exams`: bảng gốc
  // không có rating_count/avg_overall, hai cột đó chỉ tồn tại trên view, ADR-0008).
  //
  // Bốn nhánh trả null của bản cũ hội tụ về đúng một nhánh ở đây, không đổi kết
  // quả quan sát được: thiếu exam_results, hoặc attempt không tồn tại, hoặc đề
  // không published → `!inner` loại cả dòng → maybeSingle() trả null.
  // `.eq(...exams_with_difficulty.status,'published')` giữ đúng quy ước visibility
  // của getExam() (RLS lọc, VÀ thêm filter published tường minh chồng lên).
  // Chỉ lấy id/title/subject/passages của đề vì đó là tất cả những gì hàm này
  // dùng — cố ý KHÔNG kéo cả EXAM_COLUMNS để không ngụ ý rằng có sẵn nguyên
  // contract `Exam`. (`passages` vào danh sách từ A1: màn Chi tiết phải hiện
  // lại bài đọc, nếu không thì học sinh dò lại một câu đọc hiểu mà không có
  // đoạn văn — không cách nào hiểu vì sao mình sai.)
  //
  // Song song (KHÔNG nối đuôi) với vòng 1: lịch sử làm bài cho cờ
  // hasBeenWrongTwice. Hai query không phụ thuộc nhau — cái sau chỉ cần user
  // đang đăng nhập, không cần exam.id — nên gộp Promise.all giữ nguyên số RTT
  // quan sát được của getResult() (Engine 1 backend DD § Integration Points).
  const [{ data: joined, error: joinedErr }, wrongTwiceAttempts] = await Promise.all([
    supabase
      .from("exam_results")
      .select(
        "total_score, correct, total, per_question, topic_breakdown, overtime_seconds, created_at, exam_attempts!inner(started_at, submitted_at, exams_with_difficulty!inner(id, title, subject, passages))"
      )
      .eq("attempt_id", attemptId)
      .eq("exam_attempts.exams_with_difficulty.status", "published")
      .maybeSingle(),
    fetchWrongTwiceAttempts(supabase),
  ]);
  if (joinedErr) throw joinedErr;
  if (!joined) return null;

  const row = joined as unknown as ResultRow & {
    overtime_seconds: number | null;
    exam_attempts: {
      started_at: string;
      submitted_at: string | null;
      exams_with_difficulty: {
        id: string;
        title: string;
        subject: string;
        passages: { id: string; title?: string; text: string }[] | null;
      };
    };
  };
  const attempt = row.exam_attempts;
  const exam = attempt.exams_with_difficulty;

  // Cờ chỉ có nghĩa với câu ĐANG sai VÀ có chấm — mọi dòng khác để undefined
  // (backend DD § Data Contracts, Consumer-side gating: điều kiện nằm ở phía
  // caller chứ không nằm trong computeWrongTwiceQuestionIds()). Mọi trường cũ
  // của mỗi dòng giữ nguyên giá trị, chỉ thêm đúng một trường tuỳ chọn.
  const wrongTwiceQuestionIds = computeWrongTwiceQuestionIds(wrongTwiceAttempts);

  // MỘT `now` cho cả lượt đọc, đọc ĐÚNG MỘT LẦN — không phải một `new Date()`
  // cho mỗi dòng và một cái nữa cho summary. Hạn chờ là 10 phút và phép suy
  // diễn dùng biên LOẠI TRỪ, nên hai lần đọc đồng hồ cách nhau một phần triệu
  // giây vẫn có thể nằm hai bên hạn chờ: khi đó `essaySummary.pendingCount`
  // đếm một câu mà `perQuestion[i].essay.state` đã gọi là `"failed"`, và trang
  // kết quả tự mâu thuẫn với chính nó ở một khuyết tật không tái hiện được.
  const now = new Date();
  const createdAt = row.created_at;

  // Suy diễn ĐÚNG MỘT LẦN cho mỗi phần tử, và đó KHÔNG phải tối ưu hoá — nó là
  // một sửa lỗi. `summariseEssays()` và `hasIncompleteEssay()` mỗi hàm tự gấp
  // lại mảng một lượt, nên gọi thẳng cả ba trên `row.per_question` sẽ chạy
  // `deriveEssayView()` BA lần trên cùng một phần tử; với một `essayState` không
  // nhận ra, EG-BE-025 hứa ĐÚNG MỘT `console.warn` còn thực tế nhả ra ba, mỗi
  // lần render. Một test của Task B2.1 bắt được đúng chuyện đó.
  const essayViews = row.per_question.map((r) => deriveEssayView(r, createdAt, now));

  // Chỉ những phần tử THỰC SỰ suy ra được view mới đi tiếp vào hai hàm tổng
  // hợp. Đầu ra không đổi một chút nào: `essayLifecycle` vốn đã bỏ qua mọi phần
  // tử suy ra `null` (dòng cũ, câu không phải tự luận, giá trị lạ), nên lọc
  // trước hay lọc trong đều cho cùng tập view — khác nhau duy nhất ở chỗ phần
  // tử hỏng không bị hỏi lại hai lần nữa.
  const derivableRows = row.per_question.filter((_, i) => essayViews[i] !== null);

  const perQuestion: PerQuestionResult[] = row.per_question.map((r, i) => ({
    ...r,
    hasBeenWrongTwice:
      r.scored !== false && !r.isCorrect ? wrongTwiceQuestionIds.has(r.questionId) : undefined,
    // `?? undefined` chứ không giữ `null`: `null` là câu trả lời của
    // `deriveEssayView()` ("dòng này KHÔNG ÁP DỤNG"), còn hợp đồng đọc phơi ra
    // ngoài dùng `undefined` cho đúng ca đó — cùng quy ước với
    // `hasBeenWrongTwice` ngay trên.
    essay: essayViews[i] ?? undefined,
  }));

  const result: ScoreResult = {
    totalScore: row.total_score,
    correct: row.correct,
    total: row.total,
    perQuestion,
    topicBreakdown: row.topic_breakdown,
  };

  // Vòng 2 — questions phụ thuộc vòng 1 (cần exam.id) nên buộc phải tuần tự.
  // Không gộp được vào vòng 1: liên kết đề↔câu hỏi đi qua mảng `question_ids`
  // (text[]) / `per_question` (jsonb), không phải FK, nên PostgREST không embed
  // được. Nội dung + lựa chọn để render Chi tiết (post-submit nên hiển thị được);
  // v2.1 kèm question_type + đáp án lưu trữ cho câu không chấm.
  //
  // RPC chứ không phải .from("questions"): sub_answers/essay_answer đã bị REVOKE
  // khỏi role `authenticated` (Security review 2026-08-03 #1 — RLS lọc dòng chứ
  // không lọc cột, nên đọc thẳng bảng thì devtools cũng đọc được đáp án của đề
  // chưa làm). exam_answer_key() chỉ nhả đáp án cho tác giả hoặc người ĐÃ nộp
  // bài đề đó (schema.sql §10a) — đúng điều kiện của màn Chi tiết này.
  // Vẫn đúng 1 round-trip: hàm trả cả đề một lượt, map theo id như trước
  // (dư vài câu ngoài per_question là vô hại — UI tra cứu theo questionId).
  const { data: qs, error: qErr } = await supabase.rpc("exam_answer_key", {
    p_exam_id: exam.id,
  });
  if (qErr) throw qErr;
  const questions: Record<string, ResultQuestion> = {};
  // `image_url` VỐN ĐÃ nằm trong RETURNS TABLE của `exam_answer_key()`
  // (schema.sql §10a) — chỗ này trước đây chỉ đơn giản không đọc nó, nên màn
  // Chi tiết là màn DUY NHẤT của vòng làm bài không có hình: cùng một câu hỏi
  // có hình lúc làm bài (getExamForPlayer) rồi mất hình lúc dò lại.
  //
  // Ký song song (Promise.all) chứ không nối đuôi trong `for...of`: mỗi
  // `createSignedUrl` là một round-trip tới Storage, và một đề 40 câu có hình
  // sẽ cộng dồn 40 lần chờ vào TTFB của trang. Đúng khuôn `getExamForPlayer()`
  // (queries.ts:465) đã dùng cho màn làm bài.
  //
  // Từ 2026-09-03 (A3): vẫn một lần chờ, nhưng là MỘT request — ký cả lô bằng
  // `resolveSignedImageUrls()` rồi tra Map, thay vì N request chạy song song.
  const answerRows = (qs ?? []) as Array<{
    id: string;
    content: string;
    choices: Choice[];
    question_type: ResultQuestion["questionType"] | null;
    sub_answers: ResultQuestion["subAnswers"] | null;
    essay_answer: string | null;
    image_url: string | null;
    passage_id: string | null;
  }>;
  const signedImages = await resolveSignedImageUrls(
    supabase,
    answerRows.map((q) => q.image_url)
  );
  answerRows.forEach((q) => {
    const questionType = q.question_type ?? "mcq";
    const passage = q.passage_id
      ? (exam.passages ?? []).find((pg) => pg.id === q.passage_id)
      : undefined;
    questions[q.id] = {
      content: q.content,
      passageText: passage?.text,
      passageTitle: passage?.title,
      choices: questionType === "true_false" ? [] : q.choices,
      questionType,
      subItems:
        questionType === "true_false"
          ? (q.choices as unknown as ResultQuestion["subItems"])
          : undefined,
      subAnswers: q.sub_answers ?? undefined,
      essayAnswer: q.essay_answer ?? undefined,
      // Ký bằng client PHIÊN USER, không phải service role: policy
      // `exam_images_select` (schema.sql §8) mới là tầng cưỡng chế, và nó
      // cho đọc hình của đề `published` — đúng điều kiện của màn này
      // (getResult đã lọc `status = 'published'` ở vòng 1).
      imageUrl: q.image_url ? signedImages.get(q.image_url) : undefined,
    };
  });

  return {
    examId: exam.id,
    examTitle: exam.title,
    subject: exam.subject,
    result,
    questions,
    startedAt: attempt.started_at,
    submittedAt: attempt.submitted_at,
    // Dòng cũ (trước khi có cột) đọc lên null → coi như trong giờ.
    overtimeSeconds: row.overtime_seconds ?? 0,
    // Suy từ MẢNG ĐÃ LƯU (`row.per_question`), không phải từ `perQuestion` vừa
    // gắn thêm trường: hai bên cho cùng kết quả hôm nay, nhưng chỉ mảng đã lưu
    // mới đúng là thứ `essayLifecycle` nhận hợp đồng — nó đọc khoá jsonb thô.
    essaySummary: summariseEssays(derivableRows, createdAt, now),
    // KHÔNG tự suy lại `state === "failed" && !retryAvailable` ở đây: RS-6 được
    // khai đúng một chỗ trong repo, trong `essayLifecycle.ts` (EG-BE-036). Hai
    // lối xuất PDF đọc cùng hàm này nên chúng không thể sinh ra hai tệp khác
    // nhau cho cùng một lượt thi.
    hasIncompleteEssay: hasIncompleteEssay(derivableRows, createdAt, now),
  };
}
