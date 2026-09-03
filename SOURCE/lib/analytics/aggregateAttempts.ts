// aggregateAttemptsByRange — reducer thuần (không I/O) cho Analytics (Layer 3)
// thật, theo docs/design/analytics-layer3-data-logic-design.md § Aggregation
// Algorithm. Đặt ngoài app/(analytics)/ vì vitest.config.ts's include glob không
// quét app/** — reducer cần import được thẳng trong test (xem doc's Domain
// constraint). queries.ts (server-only) chỉ gọi hàm này, không tự làm reduce.
import { SUBJECT_ORDER, type Subject, type SubjectStats, type TimeRange } from "@/lib/fake-data/analytics";

/** Một exam_result đã submit, "làm phẳng" cùng subject của đề + thời điểm nộp
 *  bài của attempt — projection tối thiểu reducer cần, không phải kiểu domain
 *  nào có sẵn (ExamResult/ScoreResult đều mang theo payload câu hỏi không liên
 *  quan ở đây). */
export interface AttemptRow {
  correct: number;
  total: number;
  submittedAt: string | null;
  /** Chuỗi thô từ exams.subject — có thể KHÔNG thuộc union 7 môn Analytics. */
  subject: string;
}

const RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = { week: 7, month: 30 };
const RANGES: readonly TimeRange[] = ["week", "month", "all"];

function isAnalyticsSubject(value: string): value is Subject {
  return (SUBJECT_ORDER as readonly string[]).includes(value);
}

/**
 * Với 1 tập AttemptRow[] + mốc `now` cố định (tiêm vào để test tất định, giống
 * cách computeScore tránh input ẩn), trả về SubjectStats[] cho cả 3 range.
 * - Môn ngoài union (SUBJECT_ORDER) bị loại hẳn, không có bucket "Other".
 * - Môn 0 lượt làm bài trong range bị bỏ qua (không xuất hiện với 0-0-0).
 * - Thứ tự luôn theo SUBJECT_ORDER, không theo thứ tự `rows` đến.
 * - `submittedAt` null/không parse được: vẫn tính vào "all", bỏ qua ở
 *   "week"/"month" (không throw — quy tắc phòng thủ cho row bất thường).
 */
export function aggregateAttemptsByRange(
  rows: AttemptRow[],
  now: Date,
): Record<TimeRange, SubjectStats[]> {
  const result = {} as Record<TimeRange, SubjectStats[]>;

  for (const range of RANGES) {
    const lowerBound = range === "all" ? null : now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

    const acc = new Map<Subject, { correct: number; wrong: number; sessions: number }>();

    for (const row of rows) {
      if (!isAnalyticsSubject(row.subject)) continue;

      if (lowerBound !== null) {
        if (!row.submittedAt) continue;
        const submittedMs = Date.parse(row.submittedAt);
        if (Number.isNaN(submittedMs) || submittedMs < lowerBound) continue;
      }

      const entry = acc.get(row.subject) ?? { correct: 0, wrong: 0, sessions: 0 };
      entry.correct += row.correct;
      entry.wrong += row.total - row.correct;
      entry.sessions += 1;
      acc.set(row.subject, entry);
    }

    result[range] = SUBJECT_ORDER.filter((subject) => acc.has(subject)).map((subject) => ({
      subject,
      ...acc.get(subject)!,
    }));
  }

  return result;
}
