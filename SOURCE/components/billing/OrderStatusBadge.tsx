"use client";

// C-09 OrderStatusBadge — nhãn trạng thái của một đơn thanh toán (UI Spec
// UI-D15, frontend Design Doc Decision 3). Client component vì chữ phải theo
// ngôn ngữ đang chọn, đúng như `StatusBadge.tsx` đã giải thích cho chính nó.
//
// CẤU TRÚC chép từ `app/(layer4)/_components/StatusBadge.tsx:55-64`: một
// <span> viên thuốc, một glyph `aria-hidden`, rồi CHỮ làm tên khả truy cập —
// nhờ vậy badge vẫn phân biệt được khi in đen trắng, và trình đọc màn hình chỉ
// đọc chữ (AC-043).
//
// HAI KHUYẾT TẬT CỦA TIỀN LỆ THÌ KHÔNG CHÉP (cả hai là TBD-09, sửa ở nơi khác,
// KHÔNG sửa bên trong một thay đổi thanh toán):
//
//   1. Bốn hex hardcode (`:26`, `:36`). Ở đây mọi màu là token — quy tắc cứng
//      "đừng hardcode hex" của repo. `paid` được đánh dấu bằng ĐỘ ĐẬM và
//      `--foreground` đầy lực chứ không bằng một màu xanh lá không tồn tại
//      trong bảng màu; không token mới nào được thêm.
//   2. `CONFIG[status as Status] ?? CONFIG.processing` (`:53`) — ép âm thầm
//      một trạng thái lạ về một trạng thái THẬT. Trên một dây chuyền UGC đó là
//      dán nhãn sai vô hại; trên màn hình tiền thì hiện "chờ thanh toán" là
//      bảo một người ĐÃ TRẢ đi trả lần nữa, còn hiện "đã thanh toán" là bảo
//      một người CHƯA TRẢ rằng họ đang có quyền lợi. Nên ở đây không có `??`,
//      không có `as`, và nhánh thứ năm là một diện mạo RIÊNG.
//
// Bốn giá trị hợp lệ là ĐÚNG tập mà schema cho phép:
//   check (status in ('pending', 'paid', 'expired', 'cancelled'))
// KHÔNG có 'refunded' — hoàn tiền là một thao tác ngân hàng cộng một câu SQL
// sửa tay (D10). Mọi giá trị ngoài bốn cái đó rơi vào nhánh KHÔNG NHẬN RA.
//
// `status` nhận kiểu `string` chứ không phải union, có chủ đích (UI Spec C-09):
// giá trị này băng qua ranh giới database, khai kiểu union sẽ khiến một lần
// sửa ràng buộc CHECK biến thành nhãn sai lúc chạy mà không có lỗi biên dịch.

import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

type OrderStatus = "pending" | "paid" | "expired" | "cancelled";

type Appearance = { glyph: string; labelKey: MessageKey; className: string };

const CONFIG: Record<OrderStatus, Appearance> = {
  pending: {
    glyph: "◌",
    labelKey: "billing.status.pending",
    className: "border-border text-muted-foreground",
  },
  paid: {
    glyph: "●",
    labelKey: "billing.status.paid",
    className: "border-foreground text-foreground font-medium",
  },
  expired: {
    glyph: "⊘",
    labelKey: "billing.status.expired",
    className: "border-border text-muted-foreground",
  },
  // Chữ và glyph RIÊNG, không gộp vào `expired`: "đơn hết hiệu lực" và "đơn bị
  // huỷ" là hai sự thật khác nhau, và người đang khiếu nại một khoản tiền cần
  // phân biệt được.
  cancelled: {
    glyph: "✕",
    labelKey: "billing.status.cancelled",
    className: "border-border text-muted-foreground",
  },
};

/** Nhánh thứ năm. CỐ Ý nằm NGOÀI `CONFIG` để không giá trị lạ nào có đường
 *  chạm tới một nhánh hợp lệ. `--destructive` là màu duy nhất đọc ra "chỗ này
 *  cần để ý" mà không cần thêm token mới. */
const UNRECOGNISED: Appearance = {
  glyph: "?",
  labelKey: "billing.status.unrecognised",
  className: "border-destructive text-destructive",
};

function isOrderStatus(value: string): value is OrderStatus {
  return (
    value === "pending" || value === "paid" || value === "expired" || value === "cancelled"
  );
}

export function OrderStatusBadge({ status }: { status: string }) {
  const t = useT();
  const appearance = isOrderStatus(status) ? CONFIG[status] : UNRECOGNISED;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${appearance.className}`}
    >
      <span aria-hidden>{appearance.glyph}</span>
      {t(appearance.labelKey)}
    </span>
  );
}
