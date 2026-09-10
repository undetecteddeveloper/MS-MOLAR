// NotificationFailureFlag — cờ "email báo ticket gửi thất bại" (AC-032, UI-D3).
// Thuần trình bày, hiện được ngay trên collapsed row, không cần mở ticket
// (AC-022 UI half).
//
// Theme "Sân trường" (2026-09-10): Badge đỏ nhạt + icon tam giác (kênh hình)
// + chữ (kênh lời) — không dựa vào màu đơn thuần (§4.3).

import { TriangleAlert } from "lucide-react";
import { t } from "@/lib/copy";
import { Badge } from "@/components/ui/badge";

export function NotificationFailureFlag() {
  return (
    <Badge variant="wrong">
      <TriangleAlert aria-hidden />
      {t("support.admin.notifyFailed")}
    </Badge>
  );
}
