// Nguồn gốc của một attempt (Kho đề theo kệ, ADR-0021 D5) — chuẩn hoá `?from=`
// (chuỗi client-controlled, đi qua href rồi bound server-action argument) về
// đúng 4 giá trị `exam_attempts.source` đã khai trong CHECK
// (`schema.sql:207-208`, `exam_attempts_source_check`).
//
// `startAttempt` là nơi DUY NHẤT ghi cột này, và chỉ ghi bằng kết quả của
// `toAttemptSource` — không bao giờ ghi giá trị thô của client. Whitelist chỉ
// sống ở MỘT module để type TS và runtime check không lệch nhau; CHECK ở DB là
// bức tường thứ hai cho một writer thứ hai trong tương lai, không phải bức
// tường chính (giá trị này là "usage hint, không phải sự thật đáng tin").
//
// Bất biến: KHÔNG BAO GIỜ ném lỗi hay chặn attempt start vì input lạ (AC-041)
// — mọi thứ không khớp đúng 1 trong 4 literal đều rơi về 'none'.

export const ATTEMPT_SOURCES = ["practice", "hot", "explore", "none"] as const;

export type AttemptSource = (typeof ATTEMPT_SOURCES)[number];

/**
 * Chuẩn hoá input thô (`searchParams.from` hoặc bound server-action argument)
 * về một `AttemptSource` hợp lệ. Mọi giá trị không khớp byte-for-byte một
 * trong 4 literal — kể cả `undefined`, `null`, chuỗi rỗng, mảng (searchParams
 * đa giá trị) hoặc một chuỗi dị dạng bất kỳ — rơi về `'none'`, không ném lỗi.
 */
export function toAttemptSource(raw: string | string[] | undefined | null): AttemptSource {
  if (typeof raw !== "string") return "none";
  return (ATTEMPT_SOURCES as readonly string[]).includes(raw) ? (raw as AttemptSource) : "none";
}
