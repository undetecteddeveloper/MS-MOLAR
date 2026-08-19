"use client";

// TutorQuotaNote — UI Spec C-06. "Đã dùng N/M lượt · đặt lại {ngày}".
//
// VÌ SAO NÓ KHÔNG NẰM TRONG ExplainStepAffordance, dù đó là chỗ trông có vẻ
// đúng nhất — hai lý do đọc được từ chính code đó, không phải suy đoán:
//
//   1. Affordance chỉ MOUNT khi `hasBeenWrongTwice === true`, do trang
//      result/detail quyết ở hai chỗ gọi riêng biệt. Một người dùng Free chưa
//      từng sai hai lượt cùng một câu sẽ KHÔNG BAO GIỜ thấy component đó — nên
//      đặt bộ đếm bên trong là không thoả AC-042 ("hiển thị ngay tại chỗ người
//      dùng đang đứng"). Vì vậy hai chỗ mount ở trang nằm NGOÀI cổng đó.
//   2. Trạng thái `hint-shown` return sớm và THAY THẾ hẳn nút. Bộ đếm đặt bên
//      trong sẽ biến mất đúng lúc người dùng vừa tiêu một lượt.
//
// NGÀY ĐẶT LẠI ĐƯỢC FORMAT TẠI ĐÂY, và đó là điều chỉnh của UI Spec v1.4
// (UI-D17) / X-13, không phải tuỳ tiện: chỗ mount là một async server component
// (`result/detail/page.tsx:19`) KHÔNG giữ giá trị entitlement nào, và `code:02`
// ghim `readEntitlement()` là con đường đọc DUY NHẤT phía server nên không được
// mở đường đọc thứ hai ở trang. `resetsAt` vì thế chỉ tới được đây dưới dạng
// CONTEXT — tức phía client, đúng chỗ `useLocale()` tồn tại.
//
// Prop "ngày đã format sẵn, truyền từ ngoài vào" mà bản v1.1 khai báo đã được
// KHAI TỬ ở plan Task 2.4: nó không có và KHÔNG THỂ có nhà sản xuất, và để
// nguyên thì kiểu hỏng là im lặng — chỗ mount không truyền được gì, ternary cũ
// nuốt mất nhánh ngày, nên note in ra bộ đếm mà KHÔNG có ngày, cho mọi người,
// mãi mãi, trong khi lint, build và một unit test bọc provider đều xanh.
// Component vì thế KHÔNG nhận tham số nào; đừng thêm lại prop khi thấy note
// trống — cái thiếu khi đó là EntitlementProvider ở layout, không phải prop.

import { useEntitlement } from "@/lib/billing/entitlement";
import { formatDate } from "@/lib/format/datetime";
import { useLocale, useT } from "@/lib/i18n/client";

export function TutorQuotaNote() {
  const t = useT();
  const locale = useLocale();
  const { tutor } = useEntitlement();

  // `unknown` ⇒ không hiện gì. Tuyệt đối không đoán một con số: hiện sai số
  // lượt còn lại trên một tính năng có thu tiền là kiểu sai không ai báo cho ta
  // biết, người dùng chỉ đơn giản là không tin bảng số nữa.
  if (tutor.state !== "known") return null;

  // Không còn ternary quanh ngày: trong biến thể `known` thì `resetsAt` luôn
  // tồn tại theo kiểu, và `formatDate` đã có hợp đồng lỗi riêng ("—" cho giá
  // trị không đọc được, không bao giờ ném).
  return (
    <p className="text-muted-foreground text-sm">
      {t("billing.quota.remaining", { used: tutor.used, limit: tutor.limit })}
      {` ${t("billing.quota.resetsAt", { date: formatDate(tutor.resetsAt, locale) })}`}
    </p>
  );
}
