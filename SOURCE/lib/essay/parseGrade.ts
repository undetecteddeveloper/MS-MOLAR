// parseGrade — biên validate của đường chấm tự luận, và là BỨC TƯỜNG của R9.
// Backend DD § lib/essay/parseGrade.ts, § EG-BE-014/EG-BE-015, § R-06/R-10;
// ADR-0018 Decision 2 (tập band khai một lần, trong TypeScript).
//
// HÀM THUẦN — không I/O, không `process.env`, không `server-only`, không biết
// model nào sinh ra chuỗi này. Đầu vào là một chuỗi, đầu ra là một object.
//
// BA LỜI HỨA, và mỗi lời hứa chặn một thiệt hại CỤ THỂ:
//
//   1. KHÔNG BAO GIỜ NÉM. Người gọi duy nhất chạy bên trong `after()`, nơi một
//      ngoại lệ thoát ra không có ai bắt và không có màn hình nào hiển thị.
//      Nên mọi lối vào JSON.parse đều nằm trong try, và KHÔNG có thao tác nào
//      đụng vào `rawText` TRƯỚC try — một `rawText.trim()` đặt nhầm lên trên là
//      đủ để `undefined` lọt qua hàng rào kiểu ném ngay tại đây.
//
//   2. TỪ CHỐI, KHÔNG ÉP. Không làm tròn, không kẹp biên, không dịch về band
//      gần nhất (AC-006), không mặc định cờ tin cậy về `false`, không đọc nó
//      theo truthiness (AC-041). Mỗi lượt "giúp đỡ" như thế là một điểm số do
//      hàm này BỊA ra cho một bài mà model đã không chấm được.
//
//   3. `ok:false` KHÔNG MANG NỔI MỘT CON SỐ. Nhánh thất bại không có trường
//      `band`, nên `result.band ?? 0` ở call site KHÔNG BIÊN DỊCH ĐƯỢC. Đó là
//      cách AC-007 được cưỡng chế bằng kiểu thay vì bằng lời dặn: một lượt từ
//      chối phải settle `failed` (học sinh thấy "Chấm thất bại" + nút Chấm
//      lại), không bao giờ thành band 0 — một con số 0 im lặng trông y hệt một
//      bài làm kém, nên một cú tiêm chích thành công sẽ tàng hình.
//
// Đây là chỗ DUY NHẤT trong repo so một giá trị với `ESSAY_BANDS`. Hai bộ lọc
// là hai cơ hội để một cái lỏng hơn cái kia.

import { ESSAY_BANDS } from "@/lib/scoring/essayLifecycle";

/** Ba lý do từ chối, ĐÓNG. Chúng phân biệt được nhau vì telemetry đọc chính
 *  chúng: một đợt `unparseable` tăng vọt là dấu hiệu R-06 (model bỏ qua
 *  `response_format`), còn `band_out_of_set` tăng vọt là chuyện khác hẳn. Gộp
 *  lại thành một "invalid" là vứt đi khả năng phân biệt đó. */
export type ParseGradeFailureReason =
  | "unparseable"
  | "band_out_of_set"
  | "confidence_not_boolean";

export type ParseGradeResult =
  | { ok: true; band: number; lowConfidence: boolean }
  | { ok: false; reason: ParseGradeFailureReason };

/** Hai tên khoá của response — LỜI KHAI DUY NHẤT. `prompt.ts` import chính hằng
 *  này để viết hình dạng đầu ra bằng chữ, nên lời hứa trong prompt và luật của
 *  validator không thể trôi lệch nhau: đổi tên khoá ở đây là đổi cả hai đầu. */
export const GRADE_RESPONSE_KEYS = {
  band: "band",
  lowConfidence: "low_confidence",
} as const;

/** JSON.parse trong try, và KHÔNG gì khác ngoài nó. `null`, mảng, số, chuỗi
 *  đều là JSON hợp lệ nhưng không phải hình dạng đã yêu cầu ⇒ cùng về
 *  `unparseable`. Không bóc hàng rào markdown, không đi mò cặp ngoặc đầu tiên
 *  trong một đoạn văn: mọi phép "cứu vãn" như thế là một đường để văn bản do kẻ
 *  tấn công soạn ra được đọc như một response. */
function parseJsonObject(rawText: string): Record<string, unknown> | null {
  let value: unknown;
  try {
    value = JSON.parse(rawText);
  } catch {
    return null;
  }
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/** Đọc một khoá CỦA CHÍNH object, không đọc qua chuỗi prototype: một payload
 *  chứa `"__proto__"` không được mượn giá trị từ đâu khác. Khoá vắng mặt trả
 *  `undefined`, và `undefined` thì không lọt nổi hai vị từ bên dưới. */
function ownValue(source: Record<string, unknown>, key: string): unknown {
  return Object.hasOwn(source, key) ? Reflect.get(source, key) : undefined;
}

/** `===` một phần tử của tập ĐÓNG. `includes` ở đây trùng ngữ nghĩa với `===`
 *  vì tập không chứa `NaN` — khác biệt duy nhất giữa SameValueZero và `===`. */
function isEssayBand(value: unknown): value is number {
  return typeof value === "number" && ESSAY_BANDS.includes(value as (typeof ESSAY_BANDS)[number]);
}

/**
 * Validate nguyên văn text mà provider trả về.
 *
 * @param rawText text thô, CHƯA đụng vào — không trim, không bóc vỏ ở call site.
 * @returns `{ ok: true, band, lowConfidence }` khi và chỉ khi response là một
 *   JSON object có `band` thuộc `ESSAY_BANDS` và `low_confidence` là boolean
 *   thật; ngược lại `{ ok: false, reason }` với lý do CỤ THỂ. Không bao giờ ném.
 *
 * Thứ tự kiểm là hình dạng → band → cờ tin cậy, nên một response hỏng nhiều chỗ
 * báo về lỗi ở TẦNG NGOÀI nhất. Khoá vắng mặt đi cùng lý do của chính khoá đó
 * (`band` vắng ⇒ `band_out_of_set`, cờ vắng ⇒ `confidence_not_boolean`): "vắng
 * mặt" và "sai giá trị" đều là *khoá đó không đúng*, và tách chúng ra sẽ đẻ
 * thêm hai lý do không ai đọc khác đi.
 */
export function parseGrade(rawText: string): ParseGradeResult {
  const parsed = parseJsonObject(rawText);
  if (parsed === null) return { ok: false, reason: "unparseable" };

  const band = ownValue(parsed, GRADE_RESPONSE_KEYS.band);
  if (!isEssayBand(band)) return { ok: false, reason: "band_out_of_set" };

  const lowConfidence = ownValue(parsed, GRADE_RESPONSE_KEYS.lowConfidence);
  if (typeof lowConfidence !== "boolean") {
    return { ok: false, reason: "confidence_not_boolean" };
  }

  return { ok: true, band, lowConfidence };
}
