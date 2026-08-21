"use client";

// SupportWidgetTrigger — nút tròn nổi mở SupportWidgetDialog (UI-D6).
// Thuần trình bày: không state, không side effect ngoài onOpen.

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n/client";

// Id, không ref: SupportWidget (cha) cần focus lại nút này khi dialog đóng
// (UI-D7 — Escape/scrim/Cancel phải trả focus về trigger, không rơi về
// <body> — phát hiện lúc kiểm bằng bàn phím thật, 2026-08-13). Export để
// SupportWidget.tsx dùng document.getElementById thay vì phải truyền ref
// xuyên qua Button (@base-ui/react) mà ref-forwarding chưa được xác nhận.
export const TRIGGER_ID = "support-widget-trigger";

interface SupportWidgetTriggerProps {
  onOpen: () => void;
}

export function SupportWidgetTrigger({ onOpen }: SupportWidgetTriggerProps) {
  const t = useT();

  return (
    <Button
      id={TRIGGER_ID}
      type="button"
      variant="default"
      shape="pill"
      size="icon"
      onClick={onOpen}
      aria-label={t("support.trigger.label")}
      // z-[45]: dưới dialog/toast (z-50/70) nhưng trên nội dung thường.
      // bottom: calc() thay vì số cứng — không bao giờ đè lên BottomNav ở bất
      // kỳ viewport nào ≤768px, cấu trúc chứ không phải canh tay (UI-D6).
      // size-14 ghi đè scale "icon" mặc định (size-8) — Button chưa có bậc
      // size lớn cỡ này.
      className="fixed right-4 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+1rem)] z-[45] size-14 md:right-6 md:bottom-6"
    >
      <MessageCircle aria-hidden className="size-6" strokeWidth={1.75} />
    </Button>
  );
}
