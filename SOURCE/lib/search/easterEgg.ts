// Trang ẩn Maxwell the Cat (2026-10-12, brief
// docs/plans/20261012-feature-maxwell-easter-egg.md D1/D2).
//
// Ô tìm đề chỉ chuyển sang trang ẩn khi TOÀN BỘ từ khoá (sau chuẩn hoá của ô
// tìm: thường hoá, bỏ dấu) đúng bằng một trong các từ dưới đây. So khớp "chứa"
// sẽ nuốt cả "education", "category" — những từ tìm đề thật — nên cố ý không làm.
//
// Dùng lại `toSearchTerm` thay vì tự chuẩn hoá: bốn dạng gõ "Maxwell", "CAT",
// "Mèo", "cát" tự khớp theo đúng cách ô tìm hiểu chúng, và một từ khoá quá
// ngắn / rỗng không bao giờ khớp.

import { toSearchTerm } from "@/lib/search/normalize";

export const MAXWELL_PATH = "/maxwell";

/** Dạng ĐÃ chuẩn hoá (không dấu, chữ thường). "mèo" → "meo". */
const MAXWELL_TERMS: ReadonlySet<string> = new Set(["maxwell", "cat", "meo"]);

export function isMaxwellQuery(raw: string | null | undefined): boolean {
  const term = toSearchTerm(raw);
  return term !== null && MAXWELL_TERMS.has(term);
}
