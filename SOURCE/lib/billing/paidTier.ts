import "server-only";

// Cổng phát hành của PRD R14 — AC-049 / AC-054.
//
// Bối cảnh, vì con số làm rõ vấn đề hơn mọi lời giải thích: gói Premium bán
// 500 lượt gia sư mỗi kỳ 30 ngày ≈ 16,7 lượt/ngày cho MỘT người, trong khi key
// Gemini ở bậc miễn phí cho 20 request/NGÀY cho CẢ DỰ ÁN. Tức bậc miễn phí
// không phục vụ nổi dù chỉ một thuê bao. Nhận tiền trong trạng thái đó là nhận
// tiền cho một hạn mức không giao được.
//
// Nguồn sự thật là một biến môi trường do NGƯỜI đặt bằng tay sau khi đã xác
// minh bằng một lời gọi thật vượt mức 20 request/ngày (AC-048). Google không có
// API trạng thái thanh toán dùng được trên đường nóng, nên mọi cách "tự phát
// hiện" đều là đoán — và đoán sai theo hướng "bật" là bán thứ không có.
//
// Hình dạng chép từ lib/auth/admin.ts (`import "server-only"` + đọc env +
// mặc định fail-closed). KHÔNG phải NEXT_PUBLIC_: repo chưa từng có cờ tính
// năng nào đọc được ở client, và một cờ fail-closed thì càng không nên nằm ở
// nơi người dùng sửa được. Trang bảng giá đọc hàm này trong Server Component
// rồi truyền xuống một prop boolean.

/** Các giá trị được coi là BẬT. Mọi thứ khác — kể cả không đặt, chuỗi rỗng,
 *  "yes", "on", hay một khoảng trắng — đều là TẮT. Quên đặt biến thì hậu quả
 *  là KHÔNG BÁN ĐƯỢC, chứ không phải BÁN NHẦM (AC-054, cùng nguyên tắc
 *  fail-closed với AC-024). */
const AFFIRMATIVE = new Set(["1", "true"]);

export function isPaidTierEnabled(): boolean {
  const raw = process.env.GEMINI_PAID_TIER_ENABLED ?? "";
  return AFFIRMATIVE.has(raw.trim().toLowerCase());
}
