// Logic Layer 2 — Reads (GĐ 2 M2.5/M2.6). Server-only: dùng Supabase server client.
// Gọi từ Server Component. Thay getFakeExams/getFakeExam/getFakeQuestions của GĐ 1.
// Xem ARCHITECTURE.md (gốc repo).
//
// MẶT TIỀN của thư mục. Trước 2026-09-03 toàn bộ nội dung nằm trong MỘT file
// 835 dòng gộp truy vấn của năm màn hình; nay mỗi màn một file và file này chỉ
// nối lại. Giữ nguyên đường import `@/features/exams/queries` nên 8 chỗ gọi và
// mọi `vi.mock("@/features/exams/queries")` không phải sửa một chữ.
//
// Thêm truy vấn mới: đặt vào file của MÀN HÌNH nó phục vụ, rồi re-export ở đây.
import "server-only";

// `EXAMS_PAGE_SIZE`/`paginateExams` ở `lib/exams/paginate.ts` — file này có
// `import "server-only"`, nên một hàm THUẦN nằm trong đây thì không test được
// mà không dựng cả một môi trường server giả. Re-export để chỗ gọi không phải
// biết chuyện đó.
export { EXAMS_PAGE_SIZE, paginateExams } from "@/lib/exams/paginate";

export {
  listExams,
  listExamFacets,
  getExam,
  listMySubmittedExamIds,
  type ExamFilters,
  type ExamSort,
  type ExamLevel,
  type SortDirection,
} from "./catalogue";
export { listExamsRanked } from "./ranking";
export { getExamForPlayer } from "./player";
export { getResult, type ExamResult, type ResultQuestion } from "./result";
