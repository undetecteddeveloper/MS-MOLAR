// ĐÚNG MỘT mapping snake_case → `CheckoutOrder` trong repo này. Cả hai bên sản
// xuất đều import từ đây: đường đọc-lại của `createOrder()` và `getMyOrder()`
// trong `app/(billing)/queries.ts`. Một mapping THỨ HAI chính là lỗi mà file
// này tồn tại để chặn, không phải một tiện lợi.
// Backend DD § "One mapper, not two" (I010), Escalation E-02.
//
// VÌ SAO KHÔNG PHẢI "GIỐNG NHAU DO CÁCH DỰNG": PostgREST render `timestamptz`
// thành `2026-08-18T17:30:00+00:00`, còn `new Date(x).toISOString()` render
// CÙNG thời điểm ấy thành `2026-08-18T17:30:00.000Z`. Hai chuỗi khác nhau cho
// một khoảnh khắc — mà AC-027 khẳng định `pendingUntil` KHÔNG ĐỔI qua một lần
// dùng lại đơn, và phép khẳng định ấy so CHUỖI. Hai đường đọc không ghim dạng
// serialize sẽ làm phép so đó đúng hay sai tuỳ theo đường nào vừa chạy, và
// người dùng thấy một hạn chót sau khi bấm mua, một hạn chót khác sau khi F5.
//
// FILE MỚI, CỐ Ý: `lib/billing/types.ts` là hợp đồng ĐÓNG BĂNG (hình dạng
// entitlement do UI Spec sở hữu), nên `CheckoutOrder` không chen vào đó.
//
// KHÔNG `server-only`: đây là mapping THUẦN, không I/O, không đồng hồ, không
// bí mật. Chặn nó ở client sẽ không bảo vệ được gì và sẽ chặn luôn cả lối dùng
// nó làm hợp đồng biên dịch trong lớp fixture.

/**
 * Hình dạng màn thanh toán (S-06) tiêu thụ — **UI Spec C-13, chép nguyên si**.
 *
 * Tám trường, đúng tên ấy, đúng thứ tự ấy. Đây là hợp đồng chuẩn tắc cho
 * backend (điều khoản Phase Inversion): muốn đổi thì đổi UI Spec trước kèm lý
 * do, đừng đổi ở đây rồi để màn hình tự thích nghi.
 */
export type CheckoutOrder = {
  /** Hiện thẳng cho người dùng; đây là mã họ đọc cho bộ phận hỗ trợ. */
  orderCode: number;
  /** `formatVnd()` lo phần định dạng (UI-D13) — KHÔNG bao giờ định dạng ở đây. */
  amountVnd: number;
  /** Một trong bốn literal của CHECK; giá trị lạ render theo UI-D15. */
  status: string;
  /** ISO 8601, lấy TỪ DÒNG — không bao giờ là `now + 30 phút` tính ở màn hình. */
  pendingUntil: string;
  /** Payload VietQR/EMVCo (payOS `qrCode`), KHÔNG phải URL (UI-D14). */
  qrPayload: string;
  /** AC-028 — tài khoản NHẬN của mình. */
  accountNumber: string;
  /** AC-028 — chủ tài khoản nhận. */
  accountName: string;
  /** AC-028 — mô tả chuyển khoản mà nhà cung cấp đối soát theo. */
  memo: string;
};

/**
 * Một dòng `public.payment_orders` đúng như PostgREST giao nó.
 *
 * Chỉ tám cột `toCheckoutOrder()` đọc, không phải cả mười một cột của bảng:
 * `user_id`, `created_at` và `settled_at` không đi vào hợp đồng C-13, nên khai
 * chúng ở đây chỉ tạo thêm thứ để trôi lệch.
 *
 * `order_code` là `bigint` và `amount` là `integer`, cả hai tới dạng SỐ JSON;
 * `status` để kiểu `string` chứ không phải union, cùng lý do
 * `readPaymentOrderForSettlement()` đã chọn: tập literal hợp lệ do CHECK trong
 * schema quyết định, và một dòng mang literal ngoài dự kiến phải chảy tới nhánh
 * "không nhận ra" của chỗ đọc chứ không được làm hỏng phép ép kiểu.
 */
export type PaymentOrderRow = {
  order_code: number;
  amount: number;
  status: string;
  pending_until: string;
  qr_payload: string;
  account_number: string;
  account_name: string;
  memo: string;
};

/**
 * Chiếu một dòng `payment_orders` thành `CheckoutOrder`.
 *
 * Thuần, đồng bộ, không I/O — nên cả hai bên sản xuất gọi được nó ngay sau lệnh
 * đọc của mình mà không phải mang theo cái gì.
 *
 * `pendingUntil` là điểm mấu chốt: `new Date(row.pending_until).toISOString()`
 * đưa MỌI dạng `timestamptz` PostgREST có thể giao (offset `+00:00`, offset
 * khác 0, phần thập phân rút gọn) về CÙNG MỘT dạng `…Z` có mili giây. Chuẩn hoá
 * chính là mục đích của hàm này — bỏ nó đi thì hai đường đọc lại nói hai chuỗi
 * khác nhau về cùng một hạn chót.
 *
 * `Number(row.order_code)` là quy tắc đã ghim (backend DD § "One mapper, not
 * two", bảng dạng serialize): an toàn vì `orderCode` của payOS nằm xa dưới 2⁵³,
 * và nó giữ nguyên một điểm quy đổi duy nhất cho một cột `bigint` — thứ mà cấu
 * hình PostgREST đổi được mà không ai phải sửa một dòng code nào.
 *
 * KHÔNG kiểm tra hợp lệ và KHÔNG ném lỗi: mapper không phải chỗ phán xét
 * `status`, và một dòng đọc được từ `orders_select_own` đã qua mọi ràng buộc
 * NOT NULL của bảng rồi.
 */
export function toCheckoutOrder(row: PaymentOrderRow): CheckoutOrder {
  return {
    orderCode: Number(row.order_code),
    amountVnd: row.amount,
    status: row.status,
    pendingUntil: new Date(row.pending_until).toISOString(),
    qrPayload: row.qr_payload,
    accountNumber: row.account_number,
    accountName: row.account_name,
    memo: row.memo,
  };
}
