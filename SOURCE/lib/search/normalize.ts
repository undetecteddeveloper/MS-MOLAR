// normalizeSearch — chuẩn hoá chuỗi để TÌM ĐỀ THEO TÊN (ADR-0020, 2026-09-08).
//
// Bản JS của `public.search_normalize(text)` trong schema.sql, và hai bản PHẢI
// cho cùng kết quả: cột sinh `exams.title_search` lưu bản SQL, còn bộ lọc `?q=`
// của Kho đề gửi bản JS vào `ILIKE '%term%'` trên cột đó — lệch một ký tự là
// tìm không ra dù đề có thật. Làn localdb (`tests/e2e/service/exam-search.*`)
// so hai bản trên cùng một chuỗi tiếng Việt để bắt lệch.
//
// Các bước, đúng thứ tự của bản SQL:
//   1. thường hoá;
//   2. bỏ dấu: NFD rồi bỏ mọi dấu kết hợp (`\p{M}`) — với chữ Việt cho cùng kết
//      quả với `unaccent` (ấ → a, ệ → e, ơ → o, ư → u);
//   3. đ/Đ → d/D tường minh: "đ" KHÔNG phân rã được bằng NFD (là chữ riêng, không
//      phải d + dấu), và bản SQL cũng đổi tường minh để không phụ thuộc bảng
//      quy tắc của unaccent;
//   4. mọi ký tự không phải chữ/số → dấu cách, rồi gộp khoảng trắng và cắt hai
//      đầu. Nhờ vậy `%`, `_`, `\` (ký tự đặc biệt của LIKE) và `,` `(` `)` (ký tự
//      PostgREST hiểu riêng trong bộ lọc) không bao giờ lọt vào mẫu tìm —
//      chuỗi ra chỉ còn [a-z0-9 ].
//
// "[e1-manual-pass] Đề nguyên hàm (sai)" → "e1 manual pass de nguyen ham sai".

const COMBINING_MARKS = /\p{M}+/gu;
const NON_ALNUM = /[^a-z0-9]+/g;

export function normalizeSearch(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(COMBINING_MARKS, "")
    .replace(/đ/g, "d")
    .replace(NON_ALNUM, " ")
    .trim()
    .replace(/\s+/g, " ");
}

/** Sàn độ dài từ khoá đã chuẩn hoá để bắt đầu tìm — một ký tự khớp gần như
 *  mọi đề, chỉ tốn một lượt gọi để hiện danh sách vô nghĩa. */
export const SEARCH_MIN_LENGTH = 2;

/** Trần độ dài từ khoá THÔ (trước chuẩn hoá) nhận từ URL/ô nhập. Tên đề dài
 *  nhất trong kho cũng chỉ vài chục ký tự; phần dư chỉ là chỗ cho một mẫu LIKE
 *  dài bất thường. */
export const SEARCH_MAX_LENGTH = 64;

/**
 * Từ khoá SẴN SÀNG TÌM từ một chuỗi thô, hoặc `null` khi không có gì để tìm
 * (rỗng, quá ngắn sau chuẩn hoá). Cắt về `SEARCH_MAX_LENGTH` TRƯỚC khi chuẩn
 * hoá để giá trị lạ từ URL không thành một mẫu dài.
 */
export function toSearchTerm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const term = normalizeSearch(raw.slice(0, SEARCH_MAX_LENGTH));
  return term.length >= SEARCH_MIN_LENGTH ? term : null;
}
