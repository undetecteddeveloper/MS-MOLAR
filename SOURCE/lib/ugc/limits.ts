// UGC Exam Upload v2.0 — giới hạn input (Design Doc §Input limits, TBD-04).
// Dùng ở cả validation server (actions) lẫn assembler thuần.

export const LIMITS = {
  MAX_QUESTIONS: 50,
  MIN_QUESTIONS: 1,
  // v2.1 (ADR-0005) — format đề quốc gia nhiều phần.
  MAX_PARTS: 5,
  MIN_SUB_ITEMS: 2,
  MAX_SUB_ITEMS: 4,
  MAX_SHORT_ANSWER: 100,
  // Trần cho BÀI LÀM của người thi (attempt_answers.answer), KHÁC với
  // MAX_ESSAY_ANSWER ở dưới — cái đó là đáp án mẫu của tác giả đề, lưu ở
  // questions.essay_answer. Giá trị này PHẢI khớp CHECK trong
  // supabase/schema.sql: `length(answer) <= 500`. Lệch xuống thì cắt oan bài
  // làm; lệch lên thì Postgres từ chối nguyên lượt nộp bài lúc submit.
  MAX_ATTEMPT_ANSWER: 500,
  MAX_TITLE: 200,
  MAX_STEM: 2000,
  MAX_CHOICE: 500,
  MAX_ESSAY_ANSWER: 4000,
  MAX_REPORT_REASON: 1000,
  MAX_SCHOOL: 200,
  MIN_DURATION: 1,
  MAX_DURATION: 600,
  // Giả định nghiệp vụ D10 — phạm vi THCS/THPT; product confirm ở Open Item O-1.
  MIN_GRADE: 6,
  MAX_GRADE: 12,
  MIN_YEAR: 1900,
  MAX_YEAR: 2100,
  // Mỗi file; đồng thời là guard kích thước request Claude.
  MAX_FILE_BYTES: 15 * 1024 * 1024,
  MAX_PDF_PAGES: 30,
  ALLOWED_MIME: [
    "image/png",
    "image/jpeg",
    "image/webp",
    "application/pdf",
  ] as const,
  // Guard chi phí nhẹ theo user (app-layer, không phải DB).
  MAX_UPLOADS_PER_DAY: 30,
  // User Support System v1 (support-system-backend-design.md §Business Logic).
  MAX_SUPPORT_MESSAGE: 1000, // TBD-07 resolved — matches MAX_REPORT_REASON
  MAX_SCREENSHOT_BYTES: 8 * 1024 * 1024, // 8MB — nhỏ hơn MAX_FILE_BYTES(15MB), còn dư dưới bodySizeLimit 32MB toàn cục
  ALLOWED_SCREENSHOT_MIME: ["image/png", "image/jpeg", "image/webp"] as const,
} as const;

export type AllowedMime = (typeof LIMITS.ALLOWED_MIME)[number];
