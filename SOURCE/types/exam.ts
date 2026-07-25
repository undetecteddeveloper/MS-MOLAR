// Data model — Exam (Layer 2 Core Loop).
// Contract giữ vào production (xem PROJECT_ROADMAP.md M1.1).

import type { CommunityDifficulty } from "@/lib/rating";

export interface Exam {
  id: string;
  title: string;
  /** Thứ tự câu hỏi trong đề; trỏ tới Question.id. */
  questionIds: string[];
  /** Thời lượng làm bài (phút). Dùng cho ExamTimer ở GĐ 3. */
  durationMinutes: number;
  /** Môn học — hiển thị trên ExamCard (xem UI-LAYER-MAP Mục 4.3). */
  subject: string;
  /** Cấp lớp 6–12 — hiển thị trên ExamCard. */
  grade: number;
  /** Trường biên soạn/nguồn đề (free-text) — S#27, nullable trong DB. */
  school?: string;
  /** Niên khóa ra đề (vd 2024) — S#27, nullable trong DB. */
  schoolYear?: number;
  /** Học kỳ ra đề: 'HK1' | 'HK2' — S#27, nullable trong DB. */
  semester?: string;
  /**
   * Tên hiển thị tác giả (UGC v2.0, ADR-0003 — denormalized snapshot).
   * undefined với đề seed (author_id null) → KHÔNG render byline (không chỗ trống).
   */
  authorDisplayName?: string;
  /**
   * Tiêu đề các PHẦN của đề chuẩn 2025 (UGC v2.1, ADR-0005) — dùng cho heading
   * nhóm câu hỏi ở player/review. undefined/null = đề 1 phần (không heading).
   */
  parts?: { number: number; title: string }[];
  /**
   * Độ khó do cộng đồng đánh giá (Rating System, ADR-0008) — derived on read
   * từ view `exams_with_difficulty`, KHÔNG lưu trên bảng `exams`. `toExam`
   * (queries.ts) luôn gán giá trị này — `null` khi đề có < `RATING_THRESHOLD`
   * lượt đánh giá (frontend hiển thị "—", R6/R7/R8). Optional (như các field
   * bổ sung khác trên `Exam`: `school?`/`parts?`) để không bắt buộc các nguồn
   * `Exam` khác `toExam` (vd GĐ1 fake-data) phải khai báo field này.
   */
  communityDifficulty?: CommunityDifficulty | null;
}
