// C-08 OrderRow — một đơn thanh toán, một <li> (UI Spec § Component:
// `OrderRow`; frontend DD § Main Components). Server component; con của nó là
// client component (C-09 và C-10).
//
// C-10 MOUNT Ở MỌI DÒNG, MỌI TRẠNG THÁI — không chỉ dòng `pending`. "Đơn trông
// như đã hết hạn vẫn có thể đã được trả tiền" chính là toàn bộ tiền đề của R10
// (frontend DD § C-08), nên cái control gỡ được tình trạng ấy không được biến
// mất đúng lúc cần nhất. Việc phân biệt `paid`/`expired`/`cancelled` với các
// trạng thái còn lại là của C-10, và nó cần `status` để làm — dòng này đã cầm
// sẵn giá trị đó (nó cũng đi vào C-09 ngay bên cạnh), nên không có lượt đọc
// thứ hai nào được sinh ra ở đây.
//
// BA GIÁ TRỊ AC-026 — thời điểm tạo, số tiền, `orderCode` — và mỗi giá trị đi
// qua đúng một đường:
//
//   1. `formatDateTime()` (UI-D12) cho `createdAt`. KHÔNG dựng chuỗi bằng
//      `getDate()/getHours()` như `lib/history/format.ts` và `ExamRow.tsx`:
//      hai chỗ đó đọc múi giờ của RUNTIME, và Vercel chạy UTC — 00:30 giờ Việt
//      Nam sẽ hiện thành NGÀY HÔM TRƯỚC trên production trong khi máy lập
//      trình viên (đã ở ICT) in ra đúng.
//   2. `formatVnd()` rồi mới `t("billing.amount")` (UI-D13). ĐỊNH DẠNG TRƯỚC,
//      DỊCH SAU: `translate.ts:27` thay tham số bằng `String()` thô, nên đưa
//      thẳng số 39000 vào sẽ in "39000 VND" ngay cạnh một mã QR mang
//      "39.000 VNĐ".
//   3. `orderCode` KHÔNG đi qua bộ định dạng nào. Đây là hợp đồng, không phải
//      sở thích: người dùng ĐỌC mã này cho bộ phận hỗ trợ, nên nó không được
//      nhóm nghìn, không viết tắt, không theo ngôn ngữ. `String()` là toàn bộ
//      phép biến đổi được phép.
//
// "TIẾP TỤC THANH TOÁN" chỉ hiện khi `pending` VÀ `pendingUntil` còn ở tương
// lai. Hai vế, không phải một: một đơn đã trả mà còn trong cửa sổ 30 phút vẫn
// không được mời trả tiếp, còn một đơn `pending` đã quá hạn thì dẫn tới một mã
// QR chết — tệ hơn là không dẫn đi đâu.
//
// VÀ MỐC HẠN LÀ MỐC CỦA DÒNG, KHÔNG PHẢI MỐC TÍNH LẠI. `createdAt + 30 phút`
// là một phép tính SAI ở đây, kể cả khi nó đúng cho đa số dòng: `createOrder()`
// dùng lại đơn `pending` cũ và trả về `pending_until` GỐC của nó — "đồng hồ
// đếm ngược không bao giờ được khởi động lại" (backend DD § createOrder()). Một
// đơn dùng lại có thể chỉ còn 4 phút; tính lại từ `created_at` sẽ hứa 30.
import Link from "next/link";
import type { MyOrderRow } from "@/features/billing/queries";
import { OrderStatusBadge } from "@/components/billing/OrderStatusBadge";
import { RecheckOrderControl } from "@/components/billing/RecheckOrderControl";
import { formatDateTime } from "@/lib/format/datetime";
import { formatVnd } from "@/lib/format/number";
import { getLocale, getTranslate } from "@/lib/i18n/server";

/** Hạn CHÓT CỦA DÒNG so với đồng hồ lúc render. Nhận `pendingUntil` NGUYÊN SI
 *  như tầng truy vấn giao — không cộng, không trừ, không dựng lại từ
 *  `created_at`.
 *
 *  Không phân tích được ⇒ `false` (không hiện link). Hỏng-ĐÓNG là chiều đúng ở
 *  đây: chiều kia mời người dùng đi trả tiền vào một mã QR có thể đã chết.
 *
 *  Nằm NGOÀI thân component có lý do: `react-hooks/purity` cấm gọi hàm bất
 *  thuần trong lúc render, và nỗi lo của nó — kết quả đổi giữa các lần
 *  re-render — không tồn tại ở đây (server component, render đúng một lần cho
 *  mỗi request, không có lần thứ hai để lệch). "Bây giờ" không thể lấy từ chỗ
 *  nào khác: props của C-08 đã chốt là `{ order }` (frontend DD § Main
 *  Components), nên truyền `now` từ trang xuống là đổi hợp đồng của component. */
function isWindowStillOpen(pendingUntil: string): boolean {
  return Date.parse(pendingUntil) > Date.now();
}

export async function OrderRow({ order }: { order: MyOrderRow }) {
  const t = await getTranslate();
  const locale = await getLocale();

  const canContinuePaying = order.status === "pending" && isWindowStillOpen(order.pendingUntil);

  return (
    // `md:flex-row`, KHÔNG `sm:` (UI-D6) — repo chỉ có hai nấc, và `HistoryRow`
    // dùng `sm:` là tiền lệ KHÔNG chép ở đây. `min-w-0` trên cột chữ: ở 360px,
    // một `orderCode` kiểu bigint đứng cạnh số tiền và một viên nhãn là ứng
    // viên tràn ngang đã đo được — thiếu nó, cột chữ từ chối co lại.
    <li className="border-border bg-card flex flex-col gap-3 rounded-lg border p-5 md:flex-row md:items-center md:justify-between">
      <div className="min-w-0">
        <p className="text-foreground text-lg">
          {t("billing.amount", { amount: formatVnd(order.amountVnd, locale) })}
        </p>
        {/* KHÔNG `whitespace-nowrap`: dòng này phải được phép xuống dòng ở
            360px, nếu không nó đẩy cả hàng rộng ra. */}
        <p className="text-muted-foreground mt-1 text-sm">
          {t("billing.orders.createdAt")} {formatDateTime(order.createdAt, locale)} ·{" "}
          {t("billing.orders.orderCode")} {String(order.orderCode)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3 md:shrink-0 md:justify-end">
        <OrderStatusBadge status={order.status} />
        {/* `variant="row"` — nhãn hàng, nút outline; `variant="primary"` là
            của S-06 (C-15). Cùng MỘT `order.status` đi vào cả C-09 lẫn C-10:
            hai lượt đọc thì hai lượt có thể lệch nhau, và badge nói "đã đóng"
            trong khi control vẫn mời hỏi lại là đúng dạng lệch đó. */}
        <RecheckOrderControl orderCode={order.orderCode} variant="row" status={order.status} />
        {canContinuePaying && (
          // Chuỗi CHỮ SỐ THÔ trên query string — đúng dạng mà S-06 chấp nhận
          // (`/^\d+$/`, `Number()` là số nguyên dương an toàn). Nhóm nghìn ở
          // đây sẽ biến `?order=` thành một giá trị màn kia từ chối.
          <Link
            href={`/pricing/checkout?order=${order.orderCode}`}
            className="text-brand inline-flex min-h-11 items-center text-sm underline-offset-4 hover:underline"
          >
            {t("billing.orders.continuePaying")}
          </Link>
        )}
      </div>
    </li>
  );
}
