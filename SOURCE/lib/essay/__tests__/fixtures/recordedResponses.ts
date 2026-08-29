// Bộ fixture TẤT ĐỊNH của AC-069 — "response đã ghi lại" của một provider.
//
// KHÔNG có provider nào bị chạm tới ở đây, và đó là chủ ý: một response đã ghi
// lại KHÔNG THỂ bị một cú tiêm chích nào nâng điểm, nên bộ này chứng minh đúng
// một thứ — LUẬT TỪ CHỐI — chứ không chứng minh sức đề kháng trước tấn công.
// Phần còn lại (AC-042/AC-070: so sánh đối chứng trên provider THẬT) là Phase E,
// Task E3, và AC-032 buộc chạy lại nó mỗi lần đổi `ESSAY_GRADER_MODEL`.
//
// Năm ca mà AC-069 gọi tên đích danh được đánh dấu `ac069: true`. Chúng là điều
// kiện CHẶN MERGE, nên chúng phải chạy trong làn vitest mặc định — không `skip`,
// không `only`, không cờ môi trường nào bật/tắt được chúng.

import type { ParseGradeFailureReason } from "../../parseGrade";

/** Một response thô đã ghi lại + lý do từ chối DUY NHẤT mà nó phải nhận. */
export interface InvalidResponseFixture {
  /** Nhãn ngắn, dùng làm tên ca test. */
  label: string;
  /** Nguyên văn text mà groqClient sẽ trả về, chưa đụng vào. */
  rawText: string;
  /** Lý do CỤ THỂ — không phải "một lý do nào đó". Ba lý do phân biệt được
   *  nhau là thứ cho phép telemetry đọc ra hiện tượng R-06 từ dữ liệu. */
  expectedReason: ParseGradeFailureReason;
  /** Ca được AC-069 gọi tên đích danh (chặn merge). */
  ac069?: true;
}

export const INVALID_RESPONSES: readonly InvalidResponseFixture[] = [
  // ── Năm ca AC-069 ──────────────────────────────────────────────────────────
  {
    label: "AC-069 · số ngoài tập band (0.6)",
    rawText: '{"band": 0.6, "low_confidence": false}',
    expectedReason: "band_out_of_set",
    ac069: true,
  },
  {
    label: "AC-069 · văn xuôi tự do, không JSON",
    rawText: "Bài làm của em khá tốt. Tôi cho 0,75 điểm và khá tự tin về nhận xét này.",
    expectedReason: "unparseable",
    ac069: true,
  },
  {
    label: "AC-069 · output rỗng",
    rawText: "",
    expectedReason: "unparseable",
    ac069: true,
  },
  {
    label: "AC-069 · JSON hỏng (cụt giữa chừng)",
    rawText: '{"band": 0.5, "low_confidence": tr',
    expectedReason: "unparseable",
    ac069: true,
  },
  {
    label: 'AC-069 · cờ tin cậy không phải boolean (chuỗi "true")',
    rawText: '{"band": 1, "low_confidence": "true"}',
    expectedReason: "confidence_not_boolean",
    ac069: true,
  },

  // ── Band: mọi lối "giúp đỡ" mà EG-BE-014 cấm ───────────────────────────────
  {
    label: "band 0.7 — cám dỗ làm tròn về 0.75",
    rawText: '{"band": 0.7, "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band 0.5000001 — cám dỗ coi như 0.5",
    rawText: '{"band": 0.5000001, "low_confidence": true}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band 1.5 — cám dỗ kẹp biên về 1",
    rawText: '{"band": 1.5, "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band -1 — cám dỗ kẹp biên về 0",
    rawText: '{"band": -1, "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band 10 — thang điểm khác hẳn",
    rawText: '{"band": 10, "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: 'band là CHUỖI "0.5" — cám dỗ Number()',
    rawText: '{"band": "0.5", "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band vắng mặt",
    rawText: '{"low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band null",
    rawText: '{"band": null, "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },
  {
    label: "band là mảng [0.5]",
    rawText: '{"band": [0.5], "low_confidence": false}',
    expectedReason: "band_out_of_set",
  },

  // ── Cờ tin cậy: mọi lối ép truthiness mà EG-BE-015 cấm ─────────────────────
  {
    label: "cờ tin cậy vắng mặt — KHÔNG được mặc định false",
    rawText: '{"band": 0.75}',
    expectedReason: "confidence_not_boolean",
  },
  {
    label: 'cờ tin cậy là chuỗi "false" — chuỗi khác rỗng, truthiness đọc thành true',
    rawText: '{"band": 0.75, "low_confidence": "false"}',
    expectedReason: "confidence_not_boolean",
  },
  {
    label: "cờ tin cậy là số 1",
    rawText: '{"band": 0.25, "low_confidence": 1}',
    expectedReason: "confidence_not_boolean",
  },
  {
    label: "cờ tin cậy là số 0",
    rawText: '{"band": 0.25, "low_confidence": 0}',
    expectedReason: "confidence_not_boolean",
  },
  {
    label: "cờ tin cậy null",
    rawText: '{"band": 0, "low_confidence": null}',
    expectedReason: "confidence_not_boolean",
  },
  {
    label: "cờ tin cậy là văn bản tự do",
    rawText: '{"band": 1, "low_confidence": "khá tự tin"}',
    expectedReason: "confidence_not_boolean",
  },

  // ── Hình dạng: JSON hợp lệ nhưng không phải object ─────────────────────────
  {
    label: "mảng ở gốc",
    rawText: '[{"band": 1, "low_confidence": false}]',
    expectedReason: "unparseable",
  },
  {
    label: "literal null",
    rawText: "null",
    expectedReason: "unparseable",
  },
  {
    label: "literal số",
    rawText: "0.75",
    expectedReason: "unparseable",
  },
  {
    label: "literal chuỗi",
    rawText: '"0.75"',
    expectedReason: "unparseable",
  },
  {
    label: "chỉ khoảng trắng",
    rawText: "   \n\t  ",
    expectedReason: "unparseable",
  },
  {
    label: "JSON bọc trong hàng rào markdown — KHÔNG được bóc vỏ",
    rawText: '```json\n{"band": 1, "low_confidence": false}\n```',
    expectedReason: "unparseable",
  },
  {
    label: "văn xuôi rồi mới tới JSON — KHÔNG được đi mò dấu ngoặc",
    rawText: 'Đây là kết quả chấm:\n{"band": 1, "low_confidence": false}',
    expectedReason: "unparseable",
  },
  {
    label: "hai object nối nhau",
    rawText: '{"band": 0}{"band": 1}',
    expectedReason: "unparseable",
  },
];

/** Response HỢP LỆ — cần để phép kiểm "từ chối" không suy biến thành "từ chối
 *  tất cả", vốn cũng xanh với một hàm luôn trả `ok:false`. */
export interface ValidResponseFixture {
  label: string;
  rawText: string;
  expectedBand: number;
  expectedLowConfidence: boolean;
}

export const VALID_RESPONSES: readonly ValidResponseFixture[] = [
  {
    label: "band 0 + tin cậy",
    rawText: '{"band": 0, "low_confidence": false}',
    expectedBand: 0,
    expectedLowConfidence: false,
  },
  {
    label: "band 0.25 + kém tin cậy",
    rawText: '{"band": 0.25, "low_confidence": true}',
    expectedBand: 0.25,
    expectedLowConfidence: true,
  },
  {
    label: "band 0.5 + tin cậy",
    rawText: '{"band": 0.5, "low_confidence": false}',
    expectedBand: 0.5,
    expectedLowConfidence: false,
  },
  {
    label: "band 0.75 + kém tin cậy",
    rawText: '{"band": 0.75, "low_confidence": true}',
    expectedBand: 0.75,
    expectedLowConfidence: true,
  },
  {
    label: "band 1 + tin cậy",
    rawText: '{"band": 1, "low_confidence": false}',
    expectedBand: 1,
    expectedLowConfidence: false,
  },
  {
    label: "khoảng trắng thừa quanh JSON — JSON.parse vốn cho phép",
    rawText: '  \n{"band": 0.5, "low_confidence": true}\n  ',
    expectedBand: 0.5,
    expectedLowConfidence: true,
  },
  {
    label: "trường lạ đi kèm — bỏ qua, không phải lý do từ chối",
    rawText: '{"band": 1, "low_confidence": false, "comment": "tốt"}',
    expectedBand: 1,
    expectedLowConfidence: false,
  },
];
