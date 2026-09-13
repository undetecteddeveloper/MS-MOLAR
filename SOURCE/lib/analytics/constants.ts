// lib/analytics/constants — hằng số/helper thuần cho Thống kê (Layer 3), dùng
// bởi SubjectBarChart/SubjectTimeDonut/WeakTopicsCard/AnalyticsDashboard
// (docs/design/analytics-layer3-design.md component plan #6). Union 7 môn (khác
// SUBJECTS 10 môn của lib/ugc/subjects.ts — Geography/Informatics/Civic
// Education nằm ngoài phạm vi Thống kê theo
// docs/design/analytics-layer3-data-logic-design.md). Bảy môn này là TẬP CON
// của SUBJECTS, nên nhãn tiếng Việt tra thẳng `SUBJECT_LABELS` của file ấy —
// không chép một bảng nhãn thứ hai ở đây.
//
// Tên cũ là lib/fake-data/analytics.ts (đổi 2026-09-03, refactor mục 6): tên
// ấy nói "dữ liệu giả" trong khi file KHÔNG còn chứa dữ liệu giả lập nào — chỉ
// types/constants thuần. Dữ liệu thật đến từ
// features/analytics/queries.ts (getAnalyticsByRange, đọc Supabase RLS-scoped) qua
// lib/analytics/aggregateAttempts.ts (reducer thuần, có test riêng).

export const SUBJECT_ORDER = [
  "Math",
  "Physics",
  "Chemistry",
  "Biology",
  "Literature",
  "English",
  "History",
] as const;

export type Subject = (typeof SUBJECT_ORDER)[number];

export interface SubjectStats {
  subject: Subject;
  correct: number;
  wrong: number;
  /** Số lượt làm bài (không phải số câu). */
  sessions: number;
  /** Tổng giây làm bài (bắt đầu → nộp) của các lượt trong khoảng — dữ liệu của
   *  vòng tròn "Thời gian luyện theo môn" (engineer 2026-09-06). */
  seconds: number;
  /** Điểm TRUNG BÌNH (thang 10) của các lượt đã chấm xong trong khoảng; `null`
   *  khi chưa lượt nào chấm xong. Dữ liệu của hàng Ngữ văn/Tiếng Anh trong
   *  "Kết quả theo môn" (engineer 2026-09-13): câu tự luận chỉ "đúng" khi trọn
   *  điểm nên đếm đúng/sai không diễn tả được hai môn này — điểm mới diễn tả. */
  avgScore: number | null;
  /** Số lượt còn câu tự luận đang chấm — không kéo trung bình về 0. */
  pendingSessions: number;
  /** Số câu tự luận nộp TRỐNG trong khoảng (mỗi câu tính 0 điểm — quy ước "bỏ
   *  trống = sai"; đây là con số nói vì sao trung bình thấp). */
  blankEssays: number;
}

/** Hai môn hiện ĐIỂM TRUNG BÌNH thay cho đúng/sai (engineer 2026-09-13). Cố
 *  định theo môn, không theo "đề có câu tự luận hay không": học sinh cần một
 *  hàng đọc được cùng một cách mỗi tuần, không phải một hàng đổi dạng tuỳ đề
 *  tuần này có tự luận hay không. */
export const ESSAY_SUBJECTS: readonly Subject[] = ["Literature", "English"];

export function isEssaySubject(subject: Subject): boolean {
  return ESSAY_SUBJECTS.includes(subject);
}

/** Màu cố định theo môn — ổn định qua mọi khoảng thời gian, không gán theo hạng
 *  (hidden feature #5). Lấy từ bảng "ngủ đông" của globals.css (`--dormant-*`):
 *  tám màu CHỈ thức trong biểu đồ dữ liệu, mọi màu ≥ 3:1 trên trắng lẫn surface
 *  (WCAG 1.4.11) — thay bảy hex của theme cũ (2026-09-06). Chuỗi `var(...)`
 *  dùng được trong style nội tuyến của cả SVG lẫn HTML. */
export const SUBJECT_COLORS: Record<Subject, string> = {
  Math: "var(--dormant-clay)",
  Physics: "var(--dormant-sky)",
  Chemistry: "var(--dormant-olive)",
  Biology: "var(--dormant-cactus)",
  Literature: "var(--dormant-fig)",
  English: "var(--dormant-kelp)",
  History: "var(--dormant-heather)",
};

/** Ngưỡng "Cần ôn lại" — accuracy = correct/(correct+wrong) dưới mốc này
 *  (hidden feature #3). Cũng là ngưỡng lọc chủ đề yếu (features/analytics/queries.ts). */
export const NEEDS_REVIEW_THRESHOLD = 0.75;

/** 3 khoảng thời gian AnalyticsDashboard cho chọn — "all" = không giới hạn dưới. */
export const RANGE_ORDER = ["week", "month", "all"] as const;
export type TimeRange = (typeof RANGE_ORDER)[number];

/** Khoảng dùng để tính dữ liệu ngay từ đầu — chip "Tuần" tô đậm sẵn khi mở trang. */
export const DEFAULT_RANGE: TimeRange = "week";
