// countWords — TS twin của SQL public.count_words() (backend DD § Main
// Components "lib/solutions/countWords.ts"). Cùng lý do tồn tại với
// lib/search/normalize.ts's normalizeSearch: hai bản PHẢI cho cùng kết quả
// trên cùng chuỗi (AC-023) — bộ đếm ở giao diện (NoteEditor) và luật 15 từ ở
// server (save_community_solution/set_community_solution_status) đọc từ MỘT
// công thức, không phải hai regex viết tay lệch nhau.
//
// SQL: `btrim(coalesce(p_text,'')) = '' → 0, else
// array_length(regexp_split_to_array(btrim(p_text), '\s+'), 1)`. `String.trim()`
// bỏ mọi khoảng trắng Unicode ở hai đầu (superset của `btrim`, vốn chỉ bỏ dấu
// cách); `split(/\s+/)` tách theo mọi lượt khoảng trắng liên tiếp (cách, tab,
// xuống dòng), khớp AC-023 "xuống dòng và tab tách từ như dấu cách".
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}
