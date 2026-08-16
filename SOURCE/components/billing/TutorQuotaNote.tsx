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
//      dùng đang đứng").
//   2. Trạng thái `hint-shown` return sớm và THAY THẾ hẳn nút. Bộ đếm đặt bên
//      trong sẽ biến mất đúng lúc người dùng vừa tiêu một lượt.
//
// Hôm nay component này luôn trả null vì chưa có bộ đếm nào (UI-D2: hạn mức là
// `unknown` trong suốt pha UI). Nó được viết sẵn để khi backend lên thì thứ
// phải đổi là DỮ LIỆU, không phải bố cục.

import { useEntitlement } from "@/lib/billing/entitlement";
import { useT } from "@/lib/i18n/client";

export function TutorQuotaNote({ formattedResetDate }: { formattedResetDate?: string }) {
  const t = useT();
  const { tutor } = useEntitlement();

  // `unknown` ⇒ không hiện gì. Tuyệt đối không đoán một con số: hiện sai số
  // lượt còn lại trên một tính năng có thu tiền là kiểu sai không ai báo cho ta
  // biết, người dùng chỉ đơn giản là không tin bảng số nữa.
  if (tutor.state !== "known") return null;

  return (
    <p className="text-muted-foreground text-sm">
      {t("billing.quota.remaining", { used: tutor.used, limit: tutor.limit })}
      {formattedResetDate ? ` ${t("billing.quota.resetsAt", { date: formattedResetDate })}` : ""}
    </p>
  );
}
