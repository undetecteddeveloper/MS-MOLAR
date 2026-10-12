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

// --- Nút mũi tên: "về đúng trang trước đó" ------------------------------------
//
// Không dựa vào `history.length`: trình duyệt mới luôn có sẵn một mục (about:blank
// hoặc trang "Tab mới"), nên "có lịch sử" không có nghĩa là mục trước là một trang
// của site (đo 2026-10-12: mở thẳng /maxwell ở phiên mới → `history.length` = 2,
// `back()` đưa về trang trống). Thay vào đó ô tìm GHI LẠI trang đang đứng ngay
// trước khi sang /maxwell, vào sessionStorage của CHÍNH tab này. Có dấu → mũi tên
// lùi đúng mục trước; không có (mở thẳng link, tab mới, ứng dụng chat mở link) →
// Kho đề.

const ORIGIN_KEY = "ms-molar-maxwell-origin";
const MAX_ORIGIN_LENGTH = 512;

/** Đường dẫn nội bộ an toàn để `router.push`: một dấu `/` đầu, không `//`
 *  (protocol-relative → ra ngoài site), không `\`, không ký tự điều khiển, và
 *  không phải chính trang ẩn (tránh vòng lặp). */
export function isSafeMaxwellOrigin(value: unknown): value is string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ORIGIN_LENGTH) {
    return false;
  }
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return false;
  if (/[\u0000-\u001f\u007f]/.test(value)) return false;
  const path = value.split(/[?#]/, 1)[0];
  return path !== MAXWELL_PATH && !path.startsWith(`${MAXWELL_PATH}/`);
}

/** Ghi lại trang đang đứng (`pathname + search`). Lỗi lưu trữ (chế độ riêng tư,
 *  bị chặn) → bỏ qua: mũi tên rơi về Kho đề, trang vẫn dùng được. */
export function rememberMaxwellOrigin(href: string): void {
  if (!isSafeMaxwellOrigin(href)) return;
  try {
    window.sessionStorage.setItem(ORIGIN_KEY, href);
  } catch {
    /* không có sessionStorage — bỏ qua */
  }
}

/** Trang đã ghi (đã kiểm lại — dữ liệu từ storage không được tin mù), hoặc `null`. */
export function readMaxwellOrigin(): string | null {
  try {
    const stored = window.sessionStorage.getItem(ORIGIN_KEY);
    return isSafeMaxwellOrigin(stored) ? stored : null;
  } catch {
    return null;
  }
}
