"use client";

// SupportWidgetTrigger — nút tròn nổi mở SupportWidgetDialog (UI-D6).
// Thuần trình bày: không state, không side effect ngoài onOpen.

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

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
      // Ẩn khi một bảng lọc (`FilterSheet`, mốc `data-filter-sheet`) đang mở:
      // nút này (z-45) nằm TRÊN bottom sheet (z-30) nên ở 360px từng che ô
      // nhập cuối của bảng lọc Kho đề lẫn Lịch sử (engineer 2026-09-08). Chỉ
      // bảng lọc, không phải mọi dialog — hộp thoại hỗ trợ của chính nó cần
      // nút này còn trong DOM để trả tiêu điểm về khi đóng (UI-D7).
      className="fixed right-4 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+1rem)] z-[45] size-14 md:right-6 md:bottom-6 [body:has([data-filter-sheet])_&]:hidden"
    >
      <MessageCircle aria-hidden className="size-6" strokeWidth={1.75} />
    </Button>
  );
}
