// C-13 PaymentPanel — xương sống dữ liệu của màn thanh toán (UI Spec
// § Component: `PaymentPanel` — C-13, tập Empty/Partial đã hợp nhất ở v1.6 —
// plan Task 0.6, LO-01/LO-02; frontend DD § C-13, § Affordances). Server
// component.
//
// MỘT CỔNG DUY NHẤT, VÀ NÓ TÊN LÀ `isPayable`. Mã QR (C-12), khối chuyển khoản
// (C-14), hạn chót và nút xác nhận (C-15) đều mở theo `status === "pending"` và
// KHÔNG theo gì khác (frontend DD § Affordances). Vị từ được XUẤT ra ngoài để
// `page.tsx` — nơi quyết định có mount C-15 hay không — dùng lại CHÍNH nó thay
// vì viết bản thứ hai: hai vị từ đồng ý ở ba trạng thái đóng đã biết và LỆCH
// nhau ở trạng thái thứ tư, và một bản lệch sẽ dựng nút "Tôi đã chuyển khoản"
// bên cạnh một tấm bảng nói "đơn này đã đóng".
//
// TRẠNG THÁI PARTIAL LÀ BỐN, KHÔNG PHẢI BA: `paid`, `expired`, `cancelled`, VÀ
// một giá trị đặc tả KHÔNG NHẬN RA (UI-D15, trường hợp thứ năm). Ở cả bốn,
// KHÔNG render mã QR và KHÔNG render khối chuyển khoản — bày hướng dẫn chuyển
// tiền cho một đơn đã tất toán, đã chết hoặc không hiểu được chính là mời người
// dùng trả tiền lần thứ hai. Thay vào đó: trạng thái, mã đơn, một liên kết về
// `/me/orders`, và control hỏi-lại vẫn còn đó — hỏi lại là hành động DUY NHẤT
// gỡ được một trạng thái lạ.
//
// Ở trạng thái Partial, C-10 dùng `variant="row"` chứ không phải `"primary"`:
// `variant` chỉ chọn NHÃN (xem docblock của C-10), và nhãn `primary` là "Tôi đã
// chuyển khoản — kiểm tra ngay", một câu SAI SỰ THẬT trên một đơn đã đóng.
//
// HẠN CHÓT LÀ MỐC TUYỆT ĐỐI CỦA DÒNG, KHÔNG PHẢI ĐỒNG HỒ ĐẾM NGƯỢC (UI-D12,
// FE-AC-21). `formatDateTime(pendingUntil, locale)`, đọc thẳng từ dòng: (a)
// AC-027 chỉ quan sát được nếu hạn chót là của DÒNG, nên một đơn được dùng lại
// hiện đúng phần hiệu lực CÒN LẠI của nó chứ không phải 30 phút mới tinh; (b)
// một đồng hồ đếm ngược re-render mỗi giây, và một vùng đổi mỗi giây đúng là
// thứ tuyệt đối không được thông báo; (c) mốc tuyệt đối mới là thứ người dùng
// đối chiếu với đồng hồ trong ứng dụng ngân hàng.
//
// Hệ quả, ghi ra để không ai phát hiện nó dưới dạng một cái bug: màn hình để mở
// quá `pendingUntil` VẪN hiện một mã QR không còn được chào nữa. Control hỏi
// lại là lời giải — nó báo trạng thái thật — và một lượt chuyển tiền muộn vào
// một `orderCode` đã hết hạn vẫn cứu được bằng đối soát chủ động cộng khoá
// idempotency của AC-009.

import Link from "next/link";
import { OrderStatusBadge } from "@/components/billing/OrderStatusBadge";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import type { CheckoutOrder } from "@/lib/billing/checkoutOrder";
import { formatDateTime } from "@/lib/format/datetime";
import { getLocale, getTranslate } from "@/lib/i18n/server";
import { TransferDetails } from "./TransferDetails";
import { VietQrCode } from "./VietQrCode";

/**
 * Đơn này có được phép nhận tiền không?
 *
 * So SÁT NGHĨA với đúng một literal. KHÔNG viết thành `status !== "paid"` hay
 * "không nằm trong tập kết thúc": những vị từ ấy đồng ý với quy tắc trên ba
 * trạng thái đóng đã biết rồi TRẢ VỀ TRUE cho một giá trị lạ — tức bày mã QR ra
 * cho một đơn mà chính màn hình không hiểu.
 */
export function isPayable(status: string): boolean {
  return status === "pending";
}

export async function PaymentPanel({ order }: { order: CheckoutOrder }) {
  const t = await getTranslate();
  const locale = await getLocale();

  const orderCodeLine = (
    <p className="text-muted-foreground text-sm">
      {t("billing.orders.orderCode")}{" "}
      {/* NGUYÊN SI: không nhóm nghìn, không viết tắt, không theo ngôn ngữ —
          người dùng ĐỌC mã này cho bộ phận hỗ trợ (UI Spec § C-08, § C-13). */}
      <span className="text-foreground font-mono select-all">{String(order.orderCode)}</span>
    </p>
  );

  if (!isPayable(order.status)) {
    return (
      <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5">
        <div className="flex flex-wrap items-center gap-3">
          {/* Chữ của trạng thái lấy từ C-09 — MỘT bảng năm chữ cho cả hai màn
              hình, nên không có bản thứ hai để trôi lệch, và một giá trị lạ
              không có đường nào chạm tới một nhánh hợp lệ. */}
          <OrderStatusBadge status={order.status} />
        </div>
        {orderCodeLine}
        <div className="flex flex-wrap items-center gap-3">
          <RecheckOrderControl orderCode={order.orderCode} variant="row" status={order.status} />
          <Link
            href="/me/orders"
            className="text-brand inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
          >
            {t("billing.orders.title")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="border-border bg-card flex flex-col gap-4 rounded-lg border p-5">
      {orderCodeLine}
      <p className="text-muted-foreground text-sm">
        {t("billing.checkout.validUntil", { time: formatDateTime(order.pendingUntil, locale) })}
      </p>

      {/* Dưới `md:` xếp chồng, từ `md:` đứng cạnh nhau — KHÔNG `sm:` ở bất kỳ
          markup mới nào của tính năng này (UI Spec § Responsive Behavior).
          `min-w-0` trên cột chữ vì nội dung chuyển khoản là ứng viên tràn ngang
          đã đo được ở 360px. */}
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-6">
        {/* Mã QR là thứ ĐI KÈM, không phải thứ CHỊU LỰC: hôm nay nó render rỗng
            (ADR-0018 chưa chốt) và khối chữ bên cạnh vẫn hoàn tất được giao
            dịch — đó chính là AC-028. */}
        <VietQrCode payload={order.qrPayload} />
        <TransferDetails
          accountNumber={order.accountNumber}
          accountName={order.accountName}
          amountVnd={order.amountVnd}
          memo={order.memo}
        />
      </div>
    </section>
  );
}
