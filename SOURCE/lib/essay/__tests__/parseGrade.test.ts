// parseGrade() [unit] — bức tường của R9.
// Design Doc: docs/design/essay-auto-scoring-backend-design.md
//   (§ lib/essay/parseGrade.ts, § EG-BE-014/EG-BE-015, § R-06/R-10)
// ADR: docs/adr/ADR-0018-essay-async-grade-write.md (§ Decision 2 — tập band
//   khai MỘT LẦN, trong TypeScript)
// Task: docs/plans/tasks/essay-auto-scoring-task-H3.md
//
// KHÔNG nằm trong ngân sách làn integration/fixture/service-e2e: đây là unit
// test của một hàm THUẦN, và là nghĩa vụ chứng minh mà backend DD gọi tên đích
// danh (AC-069 — "test tất định trên response đã ghi lại", CHẶN MERGE).
//
// Mock boundary: KHÔNG CÓ. Đầu vào là một chuỗi và đầu ra là một object; mock
// bất cứ thứ gì ở đây là đi kiểm dây nối thay vì kiểm hành vi (backend DD
// § Test Boundaries: "parseGrade() — Không, chạy thật").
//
// Ba nghĩa vụ, theo đúng thứ tự chúng chặn thiệt hại:
//   1. TỪ CHỐI đúng lý do (EG-BE-014/015) — không làm tròn, không ép truthiness.
//   2. KHÔNG BAO GIỜ NÉM — chuỗi rỗng, JSON cụt, mảng, và cả input dị hình.
//   3. Hình dạng `ok:false` KHÔNG MANG NỔI một con số — AC-007 được cưỡng chế
//      bằng CẤU TRÚC ở test cuối cùng, không bằng lời hứa của call site.

import { describe, expect, it } from "vitest";

import { ESSAY_BANDS } from "@/lib/scoring/essayLifecycle";

import { parseGrade } from "../parseGrade";
import {
  INVALID_RESPONSES,
  VALID_RESPONSES,
} from "./fixtures/recordedResponses";

// ════════════════ 1. Response hợp lệ — luật chấp nhận ════════════════════════

describe("parseGrade() — response đúng hình dạng mà prompt yêu cầu", () => {
  for (const fixture of VALID_RESPONSES) {
    it(`chấp nhận: ${fixture.label}`, () => {
      const result = parseGrade(fixture.rawText);

      // toEqual trên CẢ object, không chỉ trên `band`: một hàm trả thêm trường
      // lạ (ví dụ `raw`, hay một `reason` sót lại) phải đỏ ở đây.
      expect(result).toEqual({
        ok: true,
        band: fixture.expectedBand,
        lowConfidence: fixture.expectedLowConfidence,
      });
    });
  }

  it("chấp nhận ĐÚNG năm band của ESSAY_BANDS, không hơn không kém", () => {
    // Giá trị kỳ vọng chép TAY, độc lập với hằng số: nếu ai đó nới tập band ở
    // essayLifecycle.ts, dòng này đỏ trước khi validator kịp nới theo.
    expect([...ESSAY_BANDS]).toEqual([0, 0.25, 0.5, 0.75, 1]);

    for (const band of ESSAY_BANDS) {
      const raw = JSON.stringify({ band, low_confidence: false });
      expect(parseGrade(raw)).toEqual({ ok: true, band, lowConfidence: false });
    }
  });
});

// ════════════════ 2. Response không hợp lệ — luật TỪ CHỐI ════════════════════

describe("parseGrade() — từ chối, kèm lý do CỤ THỂ (AC-069, chặn merge)", () => {
  for (const fixture of INVALID_RESPONSES) {
    it(`từ chối "${fixture.expectedReason}": ${fixture.label}`, () => {
      const result = parseGrade(fixture.rawText);

      expect(result).toEqual({ ok: false, reason: fixture.expectedReason });
    });
  }

  it("cả năm ca AC-069 gọi tên đích danh đều CÓ MẶT và đều chạy", () => {
    // Khuyết tật mà ca này bắt: năm ca kia vẫn nằm trong file nhưng bị `skip`,
    // bị lọc mất, hoặc bị xoá dần cho "gọn" — chúng biến mất mà không dòng nào
    // đỏ. Đếm là cách duy nhất một test tự bảo vệ được sự tồn tại của mình.
    const ac069 = INVALID_RESPONSES.filter((fixture) => fixture.ac069 === true);
    expect(ac069).toHaveLength(5);
    expect(ac069.map((fixture) => fixture.expectedReason).sort()).toEqual([
      "band_out_of_set",
      "confidence_not_boolean",
      "unparseable",
      "unparseable",
      "unparseable",
    ]);
  });
});

// ════════════════ 3. EG-BE-014 — không làm tròn, không kẹp, không dịch ═══════

describe("EG-BE-014 — band ngoài tập bị TỪ CHỐI, không được nắn về band gần nhất", () => {
  // Mỗi cặp là một cám dỗ CỤ THỂ: giá trị model trả về, và band mà một lượt
  // "giúp đỡ" sẽ nắn nó về. Ca đỏ nếu parseGrade trả về band nào đó thay vì từ chối.
  const temptations: ReadonlyArray<[input: number, wouldSnapTo: number]> = [
    [0.6, 0.5],
    [0.7, 0.75],
    [0.13, 0.25],
    [0.9999, 1],
    [1.2, 1],
    [-0.3, 0],
    [2, 1],
    [-5, 0],
  ];

  for (const [input, wouldSnapTo] of temptations) {
    it(`band ${input} KHÔNG được thành ${wouldSnapTo}`, () => {
      const result = parseGrade(JSON.stringify({ band: input, low_confidence: false }));

      expect(result).toEqual({ ok: false, reason: "band_out_of_set" });
    });
  }

  it("giá trị đặc biệt của JS (NaN/Infinity qua chuỗi thô) cũng bị từ chối", () => {
    // NaN và Infinity không phải JSON hợp lệ, nên chúng dừng ở "unparseable" —
    // ghi lại đây để không ai "sửa" bằng cách bật một parser dễ dãi hơn.
    expect(parseGrade('{"band": NaN, "low_confidence": false}')).toEqual({
      ok: false,
      reason: "unparseable",
    });
    expect(parseGrade('{"band": Infinity, "low_confidence": false}')).toEqual({
      ok: false,
      reason: "unparseable",
    });
  });
});

// ════════════════ 4. EG-BE-015 — boolean THẬT, không truthiness ══════════════

describe("EG-BE-015 — cờ tin cậy phải là boolean thật", () => {
  const notBooleans: ReadonlyArray<[label: string, rawValue: string]> = [
    ['chuỗi "true"', '"true"'],
    ['chuỗi "false"', '"false"'],
    ["chuỗi rỗng", '""'],
    ["số 1", "1"],
    ["số 0", "0"],
    ["null", "null"],
    ["mảng rỗng", "[]"],
    ["object", "{}"],
    ["văn bản tự do", '"tôi khá chắc chắn"'],
  ];

  for (const [label, rawValue] of notBooleans) {
    it(`low_confidence = ${label} ⇒ từ chối, KHÔNG mặc định false`, () => {
      const result = parseGrade(`{"band": 1, "low_confidence": ${rawValue}}`);

      expect(result).toEqual({ ok: false, reason: "confidence_not_boolean" });
    });
  }

  it("trường vắng mặt ⇒ từ chối, KHÔNG mặc định false", () => {
    expect(parseGrade('{"band": 0.5}')).toEqual({
      ok: false,
      reason: "confidence_not_boolean",
    });
  });

  it("boolean thật vẫn đi qua — phép kiểm không suy biến thành 'từ chối tất cả'", () => {
    expect(parseGrade('{"band": 0.5, "low_confidence": true}')).toEqual({
      ok: true,
      band: 0.5,
      lowConfidence: true,
    });
  });
});

// ════════════════ 5. KHÔNG BAO GIỜ NÉM ═══════════════════════════════════════

describe("parseGrade() không bao giờ ném", () => {
  const hostileInputs: ReadonlyArray<[label: string, raw: string]> = [
    ["chuỗi rỗng", ""],
    ["chỉ khoảng trắng", "   "],
    ["JSON cụt", '{"band": 0.5'],
    ["chỉ một dấu ngoặc", "{"],
    ["mảng", "[]"],
    ["mảng lồng sâu", "[[[[[1]]]]]"],
    ["dấu ngoặc lệch", '{"band": 0.5}}}'],
    ["ký tự điều khiển", "\u0000\u0001\u0002"],
    ["ký tự vô hình", "\u200b\u202e\u202c"],
    ["BOM đứng trước JSON", '\ufeff{"band": 1, "low_confidence": false}'],
    ["JSON rất sâu", `${"[".repeat(200)}${"]".repeat(200)}`],
    ["chuỗi rất dài", "a".repeat(100_000)],
    ["__proto__ trong payload", '{"__proto__": {"band": 1}, "band": 1, "low_confidence": false}'],
    ["khoá trùng lặp", '{"band": 1, "band": 0.6, "low_confidence": false}'],
  ];

  for (const [label, raw] of hostileInputs) {
    it(`không ném với: ${label}`, () => {
      expect(() => parseGrade(raw)).not.toThrow();
    });
  }

  it("không ném kể cả khi caller JS truyền vào thứ không phải chuỗi", () => {
    // Biên với provider là JS thật, không phải TypeScript: `res.json()` trả
    // `any`, nên một `undefined` đi lọt qua hàng rào kiểu là chuyện có thật.
    const parseGradeUnsafe = parseGrade as (raw: unknown) => unknown;

    for (const value of [undefined, null, 0, [], {}, Symbol("x")]) {
      expect(() => parseGradeUnsafe(value)).not.toThrow();
    }
  });

  it("mọi fixture đã ghi lại đều chạy qua mà không ném", () => {
    for (const fixture of [...INVALID_RESPONSES, ...VALID_RESPONSES]) {
      expect(() => parseGrade(fixture.rawText)).not.toThrow();
    }
  });
});

// ════════════════ 6. AC-007 — `ok:false` không mang nổi một band ═════════════

describe("AC-007 — một lượt từ chối KHÔNG BAO GIỜ mang theo band 0", () => {
  it("hình dạng thất bại không có trường band/lowConfidence nào để ai đó đọc nhầm", () => {
    // Đây là chỗ khuyết tật chính của cả task bị chặn bằng CẤU TRÚC: nếu hình
    // dạng thất bại không có trường số nào, thì một `result.band ?? 0` ở call
    // site không biên dịch được, thay vì âm thầm ghi 0 cho một bài bị tấn công.
    for (const fixture of INVALID_RESPONSES) {
      const result = parseGrade(fixture.rawText);

      expect(result.ok).toBe(false);
      expect(Object.keys(result).sort()).toEqual(["ok", "reason"]);
      expect("band" in result).toBe(false);
      expect("lowConfidence" in result).toBe(false);
      expect(Object.values(result)).not.toContain(0);
    }
  });

  it("band 0 HỢP LỆ vẫn phân biệt được với một lượt từ chối", () => {
    // Con số 0 không bị cấm — thứ bị cấm là 0 SINH RA TỪ một lượt từ chối. Hai
    // ca này cạnh nhau để sự khác biệt ấy đọc được bằng mắt.
    const zero = parseGrade('{"band": 0, "low_confidence": false}');
    const rejected = parseGrade('{"band": 0.6, "low_confidence": false}');

    expect(zero).toEqual({ ok: true, band: 0, lowConfidence: false });
    expect(rejected).toEqual({ ok: false, reason: "band_out_of_set" });
  });
});
