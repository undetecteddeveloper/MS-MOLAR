// Gợi ý đề khi gõ vào ô tìm trên header (ADR-0020, 2026-09-08).
//
// Đường đi: `HeaderSearch` (client) → `GET /api/exams/search?q=` → hàm này →
// RPC `public.search_exams` (SECURITY INVOKER: RLS `exams_select_visible` áp
// lên chính người gọi, khách chưa đăng nhập không thấy gì). Kho đề (`?q=`)
// KHÔNG đi đường này — nó là một vị từ ILIKE trong `fetchExamRows`, để tìm kiếm
// chỉ hẹp tập ứng viên rồi xếp hạng như thường (catalogue.ts).
//
// Chuẩn hoá HAI LẦN, cố ý: `toSearchTerm` ở đây quyết định có gọi hay không
// (rỗng/quá ngắn → trả [] mà không tốn round-trip) và gửi chuỗi đã sạch; RPC
// tự chuẩn hoá lại chuỗi nhận được (idempotent) nên một người gọi khác quên
// bước này vẫn không thể đưa ký tự đặc biệt vào mẫu LIKE.
import "server-only";

import { createClient } from "@/lib/supabase/server";
import { toSearchTerm } from "@/lib/search/normalize";

export type ExamSearchHit = {
  id: string;
  title: string;
  /** Khoá canonical ("Math") — nơi hiển thị tra `subjectLabel()`. */
  subject: string;
  grade: number;
};

/** Số gợi ý tối đa dưới ô tìm — sáu dòng là vừa một màn điện thoại còn thấy
 *  được ô nhập; muốn nhiều hơn thì Enter ra Kho đề. RPC tự kẹp về 20. */
export const SEARCH_SUGGESTION_LIMIT = 6;

export async function searchExamTitles(
  q: string,
  limit = SEARCH_SUGGESTION_LIMIT
): Promise<ExamSearchHit[]> {
  const term = toSearchTerm(q);
  if (!term) return [];

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("search_exams", { q: term, max_results: limit });
  if (error) throw error;
  return (data ?? []) as ExamSearchHit[];
}
