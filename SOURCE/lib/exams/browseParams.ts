// Dự đoán nhánh render của /exams (Kho đề theo kệ) — bare URL (0 tham số) ra
// 3 kệ; bất kỳ tham số nào trong 10 khoá AC-008 hiện diện thì xuống lưới
// phẳng như hôm nay (D2/AC-008/AC-010).
//
// `BROWSE_PARAM_KEYS` là DUY NHẤT nơi khai 10 khoá này — `exams/page.tsx`
// import thẳng thay vì giữ một bản sao thứ hai có thể lệch (Boundary Context,
// work plan Connection Map).
//
// Bất biến quan trọng nhất: `hasBrowseParam` đọc SỰ HIỆN DIỆN CỦA KHOÁ THÔ
// trên object `searchParams`, KHÔNG BAO GIỜ đọc giá trị đã chuẩn hoá/parse.
// `?sort=garbage`, `?page=abc`, `?dir=asc` đều parse ra `undefined`/`NaN` ở
// `exams/page.tsx`, nhưng vẫn phải xuống lưới phẳng (AC-010) — một predicate
// đọc local đã parse không phân biệt được "vắng mặt" với "hiện diện nhưng dị
// dạng", vì cả hai đều là `undefined`. Chỉ khoá thô mới phân biệt được.

export const BROWSE_PARAM_KEYS = [
  "q",
  "subject",
  "grade",
  "school",
  "year",
  "semester",
  "sort",
  "level",
  "dir",
  "page",
] as const;

/**
 * `true` khi `sp` mang bất kỳ khoá nào trong 10 khoá AC-008 với giá trị
 * `!== undefined` — kể cả chuỗi rỗng (`?q=`) hoặc mảng (khoá lặp lại nhiều
 * lần trên URL). `false` chỉ khi không khoá nào trong danh sách hiện diện —
 * bare URL đích thực.
 */
export function hasBrowseParam(sp: Readonly<Record<string, string | string[] | undefined>>): boolean {
  return BROWSE_PARAM_KEYS.some((key) => key in sp && sp[key] !== undefined);
}
