// tfVerdict — đọc phán quyết Đúng/Sai từ FILE ĐÁP ÁN, bất kể nó viết bằng chữ
// cái nào (2026-09-02).
//
// Thuần, không I/O, dùng được cả hai phía biên. Khác `tfCodec.ts` ở chỗ nó đọc
// đầu vào NGƯỜI VIẾT: `tfCodec` mã hoá/giải mã đúng MỘT định dạng do chính app
// sinh ra ("a:Đ,b:S"), còn file đáp án là do giáo viên gõ nên nó viết kiểu gì
// cũng có.
//
// VÌ SAO TỒN TẠI: prompt của `extractAnswers` từng chỉ dạy model rằng "Đúng/Đ =
// true, Sai/S = false" — nguyên văn hai chữ cái TIẾNG VIỆT. Đề TIẾNG ANH thì
// bảng đáp án viết "Câu 21: T" / "Câu 3: F", và model không có chỗ nào để xếp
// chúng vào: nó hoặc trả về `short_answer` với value "T", hoặc bỏ hẳn câu đó.
// Cả hai ngả đều dẫn tới cùng một kết cục ở `assembleExamLenient()` — đáp án
// SAI LOẠI so với câu hỏi thì bị coi như thiếu, `subAnswers` rỗng, và
// `isScored()` trong `computeScore.ts` trả `false`. Học sinh làm xong thấy dòng
// "chưa chấm tự động" mà không có gì hỏng để mà báo lỗi.
//
// Sửa prompt là điều kiện CẦN nhưng không đủ: prompt là lời khuyên cho một mô
// hình, không phải một bất biến. File này là cái lưới hứng ở tầng dữ liệu, và
// nó kiểm được bằng test thuần — thứ prompt không bao giờ làm được.

import type { SubItemId } from "./types";

const SUB_ITEM_IDS: readonly SubItemId[] = ["a", "b", "c", "d"];

/** Token nghĩa ĐÚNG. Gồm cả bản không dấu ("DUNG") vì bảng đáp án gõ vội hay
 *  rụng dấu, và cả Y/YES vì cặp Y/N xuất hiện trong đề tiếng Anh cạnh T/F. */
const TRUE_TOKENS = new Set(["Đ", "D", "ĐÚNG", "DUNG", "T", "TRUE", "Y", "YES", "✓", "✔"]);

/** Token nghĩa SAI. KHÔNG có "X": trong bảng đáp án viết tay X vừa được dùng
 *  làm dấu TÍCH (chọn ô này) vừa làm dấu GẠCH (sai), nên nó không quyết định
 *  được — đoán bừa một trong hai nghĩa là chấm sai bài của học sinh, còn trả
 *  `null` chỉ dẫn tới "chưa chấm", tức đúng hiện trạng chứ không tệ hơn. */
const FALSE_TOKENS = new Set(["S", "SAI", "F", "FALSE", "N", "NO", "✗", "✘", "✕"]);

/** Bỏ dấu câu bao quanh + chuẩn hoá hoa/thường. NFC trước khi `toUpperCase()`
 *  để "đ" tổ hợp (d + dấu gạch ngang) và "đ" dựng sẵn cùng ra một chuỗi. */
function normalizeToken(token: string): string {
  return token
    .normalize("NFC")
    .replace(/^[\s"'`.,;:()[\]{}]+|[\s"'`.,;:()[\]{}]+$/g, "")
    .toUpperCase();
}

/** Một token → true/false, hoặc null nếu không đọc ra nghĩa nào chắc chắn. */
export function parseTfVerdict(token: string): boolean | null {
  const t = normalizeToken(token);
  if (t === "") return null;
  if (TRUE_TOKENS.has(t)) return true;
  if (FALSE_TOKENS.has(t)) return false;
  return null;
}

/**
 * Cả DÒNG đáp án của một câu true_false → phán quyết từng ý.
 *
 * Nhận ba hình dạng, thử theo đúng thứ tự này:
 *   1. Có NHÃN ý     — "a:Đ,b:S" · "a) T  b) F" · "a - True"
 *   2. Tách bằng dấu — "T,F,T,T" · "Đ S Đ Đ" · "T"
 *   3. Dính liền     — "TFTT" · "ĐSĐĐ"
 *
 * Thứ tự KHÔNG tuỳ tiện: dạng 3 phải đi cuối vì nó cắt từng ký tự, nên nếu
 * chạy trước nó sẽ đọc "TRUE" thành T-R-U-E và trả về rác thay vì một giá trị.
 * Dạng 1 phải đi đầu vì "a:Đ,b:S" khi tách bằng dấu sẽ cho các token "a:Đ" —
 * không token nào đọc ra nghĩa, và ta sẽ mất nhãn ý mà file đã ghi rõ.
 *
 * Trả `null` khi KHÔNG đọc được trọn vẹn — chỉ cần một mẩu không hiểu là bỏ cả
 * dòng. Một phán quyết đọc nhầm đi thẳng vào `subAnswers` rồi thành điểm số;
 * còn `null` chỉ đưa câu về đúng trạng thái "chưa có đáp án" mà nó đang ở.
 */
export function parseTfVerdictSequence(raw: string): Partial<Record<SubItemId, boolean>> | null {
  const text = raw.trim();
  if (text === "") return null;

  // 1 — có nhãn ý.
  const labelled = [...text.matchAll(/\b([abcd])\s*[:).\-–]\s*([^\s,;|]+)/gi)];
  if (labelled.length > 0) {
    const out: Partial<Record<SubItemId, boolean>> = {};
    for (const m of labelled) {
      const verdict = parseTfVerdict(m[2]);
      if (verdict === null) return null;
      out[m[1].toLowerCase() as SubItemId] = verdict;
    }
    return out;
  }

  // 2 — tách bằng khoảng trắng / dấu phẩy / gạch đứng.
  const tokens = text.split(/[\s,;|]+/).filter((s) => s !== "");
  if (tokens.length > 0 && tokens.length <= SUB_ITEM_IDS.length) {
    const verdicts = tokens.map(parseTfVerdict);
    if (verdicts.every((v) => v !== null)) {
      return fromOrderedVerdicts(verdicts as boolean[]);
    }
  }

  // 3 — dính liền, mỗi ký tự một ý.
  const compact = normalizeToken(text);
  if (compact.length >= 1 && compact.length <= SUB_ITEM_IDS.length && !/\s/.test(compact)) {
    const verdicts = [...compact].map(parseTfVerdict);
    if (verdicts.every((v) => v !== null)) {
      return fromOrderedVerdicts(verdicts as boolean[]);
    }
  }

  return null;
}

/** [true,false] → {a:true,b:false} (gán theo thứ tự a–d). */
function fromOrderedVerdicts(verdicts: boolean[]): Partial<Record<SubItemId, boolean>> {
  const out: Partial<Record<SubItemId, boolean>> = {};
  verdicts.forEach((v, i) => {
    const id = SUB_ITEM_IDS[i];
    if (id) out[id] = v;
  });
  return out;
}
