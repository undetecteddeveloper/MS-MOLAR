import "server-only";

// Đường ĐỌC quyền lợi phía server — UI Spec C-01, giai đoạn stub.
//
// Hôm nay hàm này trả FREE_FALLBACK cho mọi người và KHÔNG chạm database. Đó
// không phải chỗ chưa làm xong bị bỏ quên, mà là trạng thái đã được quyết định
// và ghi lại: chưa có bảng `subscriptions` (schema.sql có 18 bảng, không bảng
// nào về thanh toán), chưa có đơn hàng nào, chưa bán cho ai.
//
// Toàn bộ phần "chưa xong" của pha UI được gói vào ĐÚNG một hàm, ở đúng một
// file, để khi backend lên thì thứ phải đổi là thân hàm này — không phải mỗi
// màn hình đi đoán lại một lần.
//
// Khi backend lên, hàm này sẽ:
//   1. đọc `subscriptions` theo userId → `expires_at`;
//   2. suy `plan`/`inGracePeriod` LÚC ĐỌC bằng cách so với now() + ân hạn 3 ngày
//      (PRD R2/R4) — không đọc cột boolean nào, vì sẽ không có cột nào như vậy;
//   3. đọc bộ đếm kỳ trên Redis → `tutor`/`upload` chuyển từ `unknown` sang
//      `known`.
// Nó phải nhận `userId` đã có sẵn từ lời gọi trước đó thay vì tự
// `auth.getUser()` lần nữa — tiền lệ ở tutorActions.ts:139-143.

import { FREE_FALLBACK, type Entitlement } from "./types";

/**
 * Quyền lợi của người dùng hiện tại cho lượt render này.
 *
 * `userId` là `null` cho khách chưa đăng nhập (hai trang Điều khoản/Hoàn tiền
 * công khai vẫn render qua layout này) — và câu trả lời cho họ cũng là Free,
 * nên tham số này chưa được dùng tới. Giữ nó trong chữ ký ngay từ bây giờ để
 * chỗ gọi ở layout không phải đổi khi thân hàm được nối vào database.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function readEntitlement(userId: string | null): Promise<Entitlement> {
  return FREE_FALLBACK;
}
