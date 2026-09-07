// aggregateAttemptsByRange — reducer thuần (không I/O) cho Thống kê (Layer 3)
// thật, theo docs/design/analytics-layer3-data-logic-design.md § Aggregation
// Algorithm. Đặt ngoài app/(analytics)/ vì vitest.config.ts's include glob không
// quét app/** — reducer cần import được thẳng trong test (xem doc's Domain
// constraint). queries.ts (server-only) chỉ gọi hàm này, không tự làm reduce.
import { SUBJECT_ORDER, type Subject, type SubjectStats, type TimeRange } from "@/lib/analytics/constants";

/** Một exam_result đã submit, "làm phẳng" cùng subject + thời lượng của đề và
 *  hai mốc thời gian của attempt — projection tối thiểu reducer cần, không phải
 *  kiểu domain nào có sẵn (ExamResult/ScoreResult đều mang theo payload câu hỏi
 *  không liên quan ở đây). */
export interface AttemptRow {
  correct: number;
  total: number;
  /** `exam_attempts.started_at` — NOT NULL trong DB, nhưng nhận null để reducer
   *  không bao giờ ném vì một dòng bất thường (cùng quy tắc với submittedAt). */
  startedAt: string | null;
  submittedAt: string | null;
  /** `exams.duration_minutes` — trần thời gian tính cho MỘT lượt (xem
   *  `elapsedSeconds`). null/0 = không có trần. */
  durationMinutes: number | null;
  /** Chuỗi thô từ exams.subject — có thể KHÔNG thuộc union 7 môn Thống kê. */
  subject: string;
}

const RANGE_DAYS: Record<Exclude<TimeRange, "all">, number> = { week: 7, month: 30 };
const RANGES: readonly TimeRange[] = ["week", "month", "all"];

function isAnalyticsSubject(value: string): value is Subject {
  return (SUBJECT_ORDER as readonly string[]).includes(value);
}

/** Giây làm bài của MỘT lượt: bắt đầu → nộp, TỐI ĐA bằng thời lượng đề.
 *
 *  Vì sao có trần: `started_at` là lúc bấm "Làm bài", còn một lượt có thể bị bỏ
 *  dở (đóng tab, đổi máy) rồi nhiều ngày sau mới nộp — đo trên dev 2026-09-06,
 *  tài khoản test có Toán "140 giờ" chỉ vì vài lượt như thế, trong khi thời
 *  gian THẬT SỰ ngồi làm không thể vượt thời lượng đề (hết giờ là tự nộp).
 *  Trần theo đề chứ không phải một hằng chung: đề 15 phút và đề 90 phút cần hai
 *  trần khác nhau. Khác `formatCompletionTime` ở trang kết quả — nơi ấy in đúng
 *  khoảng cách hai mốc của MỘT lượt, kèm nhãn quá giờ; ở đây là tổng nhiều lượt
 *  nên một lượt hỏng không được kéo cả môn đi.
 *
 *  0 khi thiếu một mốc, mốc không parse được, hoặc nộp trước khi bắt đầu. */
function elapsedSeconds(
  startedAt: string | null,
  submittedAt: string | null,
  durationMinutes: number | null,
): number {
  if (!startedAt || !submittedAt) return 0;
  const start = Date.parse(startedAt);
  const end = Date.parse(submittedAt);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  const elapsed = Math.floor((end - start) / 1000);
  return durationMinutes && durationMinutes > 0 ? Math.min(elapsed, durationMinutes * 60) : elapsed;
}

/**
 * Với 1 tập AttemptRow[] + mốc `now` cố định (tiêm vào để test tất định, giống
 * cách computeScore tránh input ẩn), trả về SubjectStats[] cho cả 3 range.
 * - Môn ngoài union (SUBJECT_ORDER) bị loại hẳn, không có bucket "Other".
 * - Môn 0 lượt làm bài trong range bị bỏ qua (không xuất hiện với 0-0-0).
 * - Thứ tự luôn theo SUBJECT_ORDER, không theo thứ tự `rows` đến.
 * - `submittedAt` null/không parse được: vẫn tính vào "all", bỏ qua ở
 *   "week"/"month" (không throw — quy tắc phòng thủ cho row bất thường).
 * - `seconds` = tổng thời gian làm bài (bắt đầu → nộp, trần theo thời lượng đề)
 *   của các lượt trong range (engineer 2026-09-06: vòng tròn "Thời gian luyện
 *   theo môn" thay % số lượt).
 */
export function aggregateAttemptsByRange(
  rows: AttemptRow[],
  now: Date,
): Record<TimeRange, SubjectStats[]> {
  const result = {} as Record<TimeRange, SubjectStats[]>;

  for (const range of RANGES) {
    const lowerBound = range === "all" ? null : now.getTime() - RANGE_DAYS[range] * 24 * 60 * 60 * 1000;

    const acc = new Map<Subject, { correct: number; wrong: number; sessions: number; seconds: number }>();

    for (const row of rows) {
      if (!isAnalyticsSubject(row.subject)) continue;

      if (lowerBound !== null) {
        if (!row.submittedAt) continue;
        const submittedMs = Date.parse(row.submittedAt);
        if (Number.isNaN(submittedMs) || submittedMs < lowerBound) continue;
      }

      const entry = acc.get(row.subject) ?? { correct: 0, wrong: 0, sessions: 0, seconds: 0 };
      entry.correct += row.correct;
      entry.wrong += row.total - row.correct;
      entry.sessions += 1;
      entry.seconds += elapsedSeconds(row.startedAt, row.submittedAt, row.durationMinutes);
      acc.set(row.subject, entry);
    }

    result[range] = SUBJECT_ORDER.filter((subject) => acc.has(subject)).map((subject) => ({
      subject,
      ...acc.get(subject)!,
    }));
  }

  return result;
}
