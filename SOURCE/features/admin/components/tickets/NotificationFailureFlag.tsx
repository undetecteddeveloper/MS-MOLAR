// NotificationFailureFlag — cờ "email báo ticket gửi thất bại" (AC-032, UI-D3).
// Thuần trình bày, hiện được ngay trên collapsed row, không cần mở ticket
// (AC-022 UI half).

import { t } from "@/lib/copy";

export function NotificationFailureFlag() {
  return (
    <span className="border-brand text-brand inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium">
      <span aria-hidden>⚠</span>
      {t("support.admin.notifyFailed")}
    </span>
  );
}
