// Hàng đề thô từ DB → kiểu `Exam` (mapper dùng chung).
//
// Ba file trong thư mục này đọc bảng/view `exams` và cùng cần đúng một
// danh sách cột + đúng một phép map. Để mỗi file tự khai là mở đường cho hai
// bản trôi khỏi nhau — đúng cái bẫy mà cảnh báo về `scripts/perf-layers.ts`
// dưới đây mô tả.
//
// Tách khỏi `features/exams/queries.ts` (835 dòng) ngày 2026-09-03, mục 7 của
// đợt refactor. Đường import ngoài KHÔNG đổi — `@/features/exams/queries` nay
// phân giải vào `queries/index.ts`.
import "server-only";

import { communityDifficultyFrom } from "@/lib/rating";
import type { Exam } from "@/types/exam";

// --- Mappers (snake_case DB → camelCase type) ----------------------------

export type ExamRow = {
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
export const EXAM_COLUMNS =
  "id, title, question_ids, duration_minutes, subject, grade, school, school_year, semester, author_display_name, parts, passages, rating_count, avg_overall, created_at";

export function toExam(row: ExamRow): Exam {
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
