// SOURCE/lib/rating — thuần, không side-effect. vitest chỉ thu lib/** + components/**.
// Dùng bởi toExam (map avg_overall → communityDifficulty) và rateExam (validate).

export const RATING_MIN = 1;
export const RATING_MAX = 10;
/** Ngưỡng hiển thị/xếp hạng. Bản sao SQL nằm trong view exams_with_difficulty
 *  (số 3). Không thể chia sẻ hằng số vật lý băng qua SQL/TS → test đảm bảo khớp. */
export const RATING_THRESHOLD = 3;

export type Bucket = "Easy" | "Medium" | "Hard";
export type CommunityDifficulty = { bucket: Bucket; mean: number; count: number };

/** Số nguyên trong [1,10]. Dùng ở rateExam trước khi ghi (AC-002). */
export function isValidPartScore(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= RATING_MIN && n <= RATING_MAX;
}

/** Overall của một user = mean 3 điểm phần (AC-003). */
export function overall(p1: number, p2: number, p3: number): number {
  return (p1 + p2 + p3) / 3;
}

/** Bucket theo nửa-mở: [1,4) Easy / [4,7) Medium / [7,10] Hard.
 *  Ranh giới: 4.0→Medium, 7.0→Hard, 10.0→Hard (AC-018). Dùng mean CHƯA làm tròn. */
export function bucket(mean: number): Bucket {
  if (mean < 4) return "Easy";
  if (mean < 7) return "Medium";
  return "Hard";
}

/** Hiển thị mean một chữ số thập phân, vd 7.2 (AC-014). */
export function formatMean(mean: number): string {
  return mean.toFixed(1);
}

/** avgOverall + ratingCount (từ view) → communityDifficulty | null.
 *  null khi avgOverall null (view đã NULL dưới ngưỡng) HOẶC count < THRESHOLD
 *  (kiểm tra phòng thủ để helper tự đúng kể cả nếu gọi ngoài view). */
export function communityDifficultyFrom(
  avgOverall: number | null,
  ratingCount: number
): CommunityDifficulty | null {
  if (avgOverall === null || ratingCount < RATING_THRESHOLD) return null;
  return { bucket: bucket(avgOverall), mean: avgOverall, count: ratingCount };
}
