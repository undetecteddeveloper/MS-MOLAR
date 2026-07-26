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

// ============================================================
// Frontend additions (Task 7, frontend DD § Rating-form State
// Management + Data-Fetching Plan). Ba phần đề chuẩn 2025 CỐ ĐỊNH
// (ADR-0005) — form luôn render đúng 3 phần này, KHÔNG đọc từ
// exam.parts (AC-001).
// ============================================================

export type PartId = "mcq" | "true_false" | "short_answer";
/** Số nguyên 1-10 — literal union (không phải `number` trần) để không thể
 *  biểu diễn giá trị ngoài khoảng ở tầng kiểu (AC-002/024). */
export type PartScore = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export const PART_IDS: readonly PartId[] = ["mcq", "true_false", "short_answer"];

interface PartMeta {
  /** Dùng chung cho eyebrow overview LẪN detail — UI Spec liệt kê cùng text
   *  ở cả hai bảng "Eyebrow (overview)" và "Detail eyebrow". */
  eyebrow: string;
  name: string;
  description: string;
}

/** Copy verbatim từ UI Spec (Component: PartCard / PartDetail) — KHÔNG diễn giải lại. */
export const PART_META: Record<PartId, PartMeta> = {
  mcq: {
    eyebrow: "PART I · MULTIPLE CHOICE",
    name: "Multiple Choice",
    description:
      "Four options per question, one correct answer. Tests basic recall and understanding.",
  },
  true_false: {
    eyebrow: "PART II · TRUE / FALSE",
    name: "True / False",
    description:
      "Four sub-statements per question, mark each true or false. One wrong sub-statement forfeits the whole question — no guessing by elimination.",
  },
  short_answer: {
    eyebrow: "PART III · SHORT ANSWER",
    name: "Short Answer",
    description:
      "No options to pick from — solve and enter a single numeric answer. No room for guesswork.",
  },
};

export interface ReadoutModel {
  /** "—" (0 phần) hoặc mean 1 chữ số thập phân (formatMean). */
  value: string;
  /** "UNRATED" | "<n>/3 RATED" | "RATED". */
  status: string;
}

/** Overall readout SỐNG, tính lại mỗi render từ scores hiện có (frontend DD
 *  § Rating-form State Management). 0 phần → "—"/UNRATED; 1-2 phần → running
 *  mean các phần đã chấm; đủ 3 phần → overall() (khớp server AC-003). */
export function readoutModel(scores: Partial<Record<PartId, PartScore>>): ReadoutModel {
  const rated = PART_IDS.filter((id) => scores[id] !== undefined);
  if (rated.length === 0) return { value: "—", status: "UNRATED" };
  if (rated.length === PART_IDS.length) {
    const [p1, p2, p3] = PART_IDS.map((id) => scores[id] as number);
    return { value: formatMean(overall(p1, p2, p3)), status: "RATED" };
  }
  const mean = rated.reduce((sum, id) => sum + (scores[id] as number), 0) / rated.length;
  return { value: formatMean(mean), status: `${rated.length}/${PART_IDS.length} RATED` };
}

/** Discriminated error union của rateExam ((layer2)/actions.ts) — copy độc lập
 *  (không import file "use server") để giữ lib/rating thuần. */
export type RateExamError = "ineligible" | "invalid" | "server";

/** Copy verbatim UI Spec (Component: RatingForm, bảng rateExam error → Message). */
export function rateErrorMessage(error: RateExamError): string {
  switch (error) {
    case "ineligible":
      return "You need to finish this exam before you can rate it.";
    case "invalid":
      return "Please rate all three parts from 1 to 10.";
    case "server":
      return "Couldn't save your rating right now. Please try again.";
  }
}

/** getMyRating() → initialScores form (frontend DD § Data-Fetching Plan).
 *  mcq←partI, true_false←partII, short_answer←partIII; null → undefined
 *  (chưa đánh giá, form ở default 0-phần). Điểm đã qua isValidPartScore ở
 *  rateExam trước khi ghi (server contract) nên không re-validate ở đây. */
export function mapFromMyRating(
  rating: { partI: number; partII: number; partIII: number } | null
): Partial<Record<PartId, PartScore>> | undefined {
  if (!rating) return undefined;
  return {
    mcq: rating.partI as PartScore,
    true_false: rating.partII as PartScore,
    short_answer: rating.partIII as PartScore,
  };
}
