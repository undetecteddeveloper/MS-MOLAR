// Hai con số của đường tiền — PRD AC-026 (giá) và AC-027 (cửa sổ đơn chờ).
//
// Chúng ở CHUNG một file vì cùng một lý do: mỗi con số phải có ĐÚNG MỘT lời
// khai. Với `ORDER_PENDING_WINDOW_MS` đó không phải sở thích về phong cách mà
// là một ràng buộc đã ghi thành văn — ADR-0013 § Implementation Guidance:
// *"Keep the pending-order window and the provider's `expiredAt` the same
// number, set from one shared constant. Two clocks that disagree produce a QR
// code that one side considers live and the other considers dead"*. Một QR mà
// ta tưởng đã chết còn payOS tưởng còn sống là một lần chuyển khoản không có
// đơn nào nhận.

/** Giá gói Premium một kỳ 30 ngày, VNĐ (AC-026; chuỗi hiển thị do AC-002 ghim).
 *
 *  ĐỌC LÚC TẠO ĐƠN, KHÔNG BAO GIỜ LÚC ĐỐI SOÁT. `settleOrder()` so số tiền
 *  payOS báo về với **số đã lưu trên chính dòng đơn đó**, không với hằng này —
 *  nếu không, một lần đổi giá sẽ vô hiệu hoá mọi đơn đang bay được tạo ở giá
 *  cũ. Hai nửa của quy tắc được viết ra cùng nhau để lần sau không ai "sửa cho
 *  nhất quán" bằng cách kéo hằng này xuống chỗ so sánh. */
export const PREMIUM_PRICE_VND = 39_000;

/** Đơn `pending` sống được bao lâu — 30 phút (AC-027).
 *
 *  BA chỗ tiêu thụ, và cả ba phải đọc từ đây:
 *    1. `payment_orders.pending_until` lúc insert (schema.sql, khối
 *       `pending_until` đã trỏ tên hằng này);
 *    2. `expiredAt` gửi cho payOS trong payment request;
 *    3. vị từ tái dùng ở bước (0) của `createOrder()` — "đã có đơn pending còn
 *       hạn thì trả lại chính nó, không gọi payOS lần thứ hai".
 *  Chỗ thứ ba là lý do con số này không thể nằm trong một trong hai chỗ đầu:
 *  nó là điều kiện quyết định có gọi nhà cung cấp hay không, chứ không chỉ là
 *  một giá trị được ghi xuống. */
export const ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000;
