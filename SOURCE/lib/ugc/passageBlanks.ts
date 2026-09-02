// passageBlanks — tìm CHỖ TRỐNG trong ngữ liệu dùng chung (A1) và cắt bài đọc
// thành các mẩu quanh chúng (2026-09-02).
//
// Thuần, không I/O, dùng được cả hai phía biên.
//
// VÌ SAO CẦN: đề Tiếng Anh dạng điền khuyết in ĐỀ BÀI CỦA CÂU HỎI ngay trong
// bài đọc — "thousands of students (34) ______ up for Green Summer". Thân câu
// hỏi (`question.content`) không chứa gì ngoài lời dẫn, nên khi học sinh chọn
// đáp án, không có chỗ nào trên màn hình cho thấy CÂU VĂN sau khi điền. Cắt bài
// đọc ở đây cho phép màn làm bài ghép đáp án đã chọn vào đúng chỗ trống của nó.
//
// KHÔNG có gì bảo đảm định dạng chỗ trống: bài đọc là văn bản do model phiên âm
// từ ảnh đề, và prompt chỉ mới được dặn định dạng chuẩn từ 2026-09-02 — mọi đề
// upload TRƯỚC đó đã nằm trong DB với định dạng bất kỳ. Vì thế bộ nhận dạng ở
// đây cố ý rộng ở phần GẠCH CHÂN (dấu hiệu chắc chắn) và hẹp ở phần SỐ THỨ TỰ
// (dấu hiệu dễ nhầm): một dãy gạch dưới hầu như chỉ có thể là chỗ trống, còn
// một con số cạnh nó thì có thể là bất cứ thứ gì trong câu văn.

/** Một mẩu của đoạn văn: văn bản thường, hoặc một chỗ trống. */
export type PassageChunk =
  | { kind: "text"; text: string }
  | { kind: "blank"; number: number | null };

/** Dãy ≥2 gạch dưới — dấu hiệu DUY NHẤT khởi động việc nhận dạng chỗ trống.
 *  Hai chứ không phải ba: đề in bằng font hẹp hay bị rút còn "__". */
const UNDERSCORE_RUN = /_{2,}/g;

/** Số đứng NGAY TRƯỚC dãy gạch: "(34)", "[34]", "34.", "34)".
 *  Dạng trần "34" (không ngoặc, không dấu chấm) CỐ Ý không nhận: "in 34 ______"
 *  là câu văn bình thường, và nuốt mất chữ số của nó là làm hỏng bài đọc để đổi
 *  lấy một cái nhãn. Lookbehind chặn nửa sau của số dài ("1975." → "975."). */
const NUMBER_BEFORE = /(?:\(\s*(\d{1,3})\s*\)|\[\s*(\d{1,3})\s*\]|(?<![\d.,])(\d{1,3})\s*[.)])\s*$/;

/** Số đứng NGAY SAU dãy gạch — CHỈ dạng có ngoặc. "______ 34." gần như luôn là
 *  chỗ trống rồi tới câu số 34 của phần sau, không phải nhãn của chính nó. */
const NUMBER_AFTER = /^\s*(?:\(\s*(\d{1,3})\s*\)|\[\s*(\d{1,3})\s*\])/;

/** Tách bài đọc thành các ĐOẠN VĂN (markdown: cách nhau bằng dòng trống).
 *  Không có dòng trống nào → cả bài là một đoạn, đúng như `RichText` block
 *  vốn đã render nó, nên không màn nào đổi hình dạng vì hàm này. */
export function splitPassageParagraphs(text: string): string[] {
  return text
    .split(/\n[ \t]*\n+/)
    .map((p) => p.trim())
    .filter((p) => p !== "");
}

/** Cắt MỘT đoạn văn thành các mẩu xen chỗ trống. Đoạn không có chỗ trống nào
 *  trả về đúng một mẩu `text` — chỗ gọi không cần phân biệt hai ca. */
export function splitPassageBlanks(paragraph: string): PassageChunk[] {
  const chunks: PassageChunk[] = [];
  let cursor = 0;

  UNDERSCORE_RUN.lastIndex = 0;
  for (const match of paragraph.matchAll(UNDERSCORE_RUN)) {
    const runStart = match.index;
    if (runStart === undefined) continue;
    // Dãy gạch nằm TRƯỚC con trỏ nghĩa là nó đã bị mẩu trước nuốt (chỗ trống
    // liền nhau "___ ___"), bỏ qua để không cắt chồng lên nhau.
    if (runStart < cursor) continue;

    let start = runStart;
    let end = runStart + match[0].length;
    let number: number | null = null;

    const before = paragraph.slice(cursor, start);
    const beforeMatch = before.match(NUMBER_BEFORE);
    if (beforeMatch) {
      number = Number(beforeMatch[1] ?? beforeMatch[2] ?? beforeMatch[3]);
      start = cursor + before.length - beforeMatch[0].length;
    } else {
      const afterMatch = paragraph.slice(end).match(NUMBER_AFTER);
      if (afterMatch) {
        number = Number(afterMatch[1] ?? afterMatch[2]);
        end += afterMatch[0].length;
      }
    }

    if (start > cursor) chunks.push({ kind: "text", text: paragraph.slice(cursor, start) });
    chunks.push({ kind: "blank", number });
    cursor = end;
  }

  if (cursor < paragraph.length) {
    chunks.push({ kind: "text", text: paragraph.slice(cursor) });
  }
  // Đoạn rỗng vẫn phải trả về một mẩu để chỗ gọi không phải kiểm mảng rỗng.
  if (chunks.length === 0) chunks.push({ kind: "text", text: paragraph });

  return chunks;
}

/**
 * Gán mỗi chỗ trống cho một câu hỏi trong nhóm cùng bài đọc.
 *
 * `blanks` là số thứ tự đọc được của từng chỗ trống theo THỨ TỰ XUẤT HIỆN
 * (null = chỗ trống không đánh số). `questionNumbers` là số hiển thị ("Câu N")
 * của các câu trỏ vào bài đọc này, cũng theo thứ tự đề.
 *
 * Trả về mảng chỉ số vào `questionNumbers`, hoặc -1 cho chỗ trống không gán
 * được cho câu nào.
 *
 * HAI CHIẾN LƯỢC, và chỉ dùng cái thứ nhất khi nó chắc chắn:
 *
 *   Theo SỐ — khi mọi chỗ trống đều có số VÀ tập số ấy trùng khít tập số câu.
 *     Chống được ca bài đọc lẫn một dãy gạch không phải chỗ trống (dòng kẻ để
 *     điền tên chẳng hạn): số không khớp thì chiến lược này tự loại mình.
 *   Theo VỊ TRÍ — mọi ca còn lại. Chỗ trống thứ i thuộc câu thứ i.
 *
 * Vì sao không dùng thẳng số làm chỉ số: số in trên đề ("34") là số của cả đề,
 * còn nhóm này có thể bắt đầu từ giữa đề. Ánh xạ phải đi qua `questionNumbers`
 * chứ không được coi số in là vị trí.
 */
export function mapBlanksToQuestions(
  blanks: (number | null)[],
  questionNumbers: number[]
): number[] {
  const allNumbered = blanks.length > 0 && blanks.every((b) => b !== null);
  if (allNumbered && blanks.length === questionNumbers.length) {
    const byNumber = new Map<number, number>();
    questionNumbers.forEach((n, i) => byNumber.set(n, i));
    if (byNumber.size === questionNumbers.length) {
      const mapped = blanks.map((b) => byNumber.get(b as number) ?? -1);
      if (mapped.every((i) => i >= 0)) return mapped;
    }
  }
  return blanks.map((_, i) => (i < questionNumbers.length ? i : -1));
}
