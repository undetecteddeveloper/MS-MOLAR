"use client";

// SupportWidgetTrigger — nút tròn nổi mở SupportWidgetDialog (UI-D6).
//
// Dời được (2026-10-21): kéo bằng chuột/ngón tay, hoặc Shift + mũi tên khi đang focus,
// để nút không che thứ người dùng muốn bấm; vị trí được nhớ trên máy. Logic kéo nằm ở
// `useDraggableFab`; component này chỉ nối nó vào nút và nuốt cú click sinh ra ngay
// sau một cú kéo. Chưa kéo thì không có `style` nào — nút ở đúng chỗ mặc định của CSS.

import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { useDraggableFab } from "@/components/support/useDraggableFab";

// Id, không ref: SupportWidget (cha) cần focus lại nút này khi dialog đóng
// (UI-D7 — Escape/scrim/Cancel phải trả focus về trigger, không rơi về
// <body> — phát hiện lúc kiểm bằng bàn phím thật, 2026-08-13). Export để
// SupportWidget.tsx dùng document.getElementById thay vì phải truyền ref
// xuyên qua Button (@base-ui/react) mà ref-forwarding chưa được xác nhận.
export const TRIGGER_ID = "support-widget-trigger";

/** Cạnh nút (px) = `size-14`; hook cần để kẹp nút trong màn hình. */
const FAB_SIZE = 56;
const MOVE_HINT_ID = "support-widget-move-hint";

interface SupportWidgetTriggerProps {
  onOpen: () => void;
}

export function SupportWidgetTrigger({ onOpen }: SupportWidgetTriggerProps) {
  const fab = useDraggableFab(FAB_SIZE);

  return (
    <>
      <Button
        id={TRIGGER_ID}
        type="button"
        variant="default"
        shape="pill"
        size="icon"
        onClick={(e) => {
          if (fab.consumeClick()) {
            e.preventDefault();
            return;
          }
          onOpen();
        }}
        {...fab.handlers}
        style={fab.style}
        data-dragging={fab.dragging ? "" : undefined}
        aria-label={t("support.trigger.label")}
        aria-describedby={MOVE_HINT_ID}
        // z-[45]: dưới dialog/toast (z-50/70) nhưng trên nội dung thường.
        // bottom: calc() thay vì số cứng — không bao giờ đè lên BottomNav ở bất
        // kỳ viewport nào ≤768px, cấu trúc chứ không phải canh tay (UI-D6).
        // size-14 ghi đè scale "icon" mặc định (size-8) — Button chưa có bậc
        // size lớn cỡ này.
        // Ẩn khi một bảng lọc (`FilterSheet`, mốc `data-filter-sheet`) đang mở:
        // nút này (z-45) nằm TRÊN bottom sheet (z-30) nên ở 360px từng che ô
        // nhập cuối của bảng lọc Kho đề lẫn Lịch sử (engineer 2026-09-08). Cũng
        // ẩn khi một tấm trượt `OverlaySheet` (mốc `data-app-overlay`) đang mở —
        // scrim chỉ mờ 20% nên nút vẫn trông như bấm được (UI-D28). Chỉ hai mốc
        // đó, không phải mọi dialog — hộp thoại hỗ trợ của chính nó cần nút này
        // còn trong DOM để trả tiêu điểm về khi đóng (UI-D7).
        // Nhấc lên khi trang có thanh hành động dính đáy (`data-bottom-bar`, hiện
        // là PublishBar ở màn rà soát đề, 2026-09-09): thanh cao ~68px nằm đúng
        // chỗ nút này, và ở 360px lẫn 768px nút che mất nút Xuất bản. Không ẩn
        // như với bảng lọc — thanh có mặt suốt trang, ẩn là mất hẳn kênh hỗ trợ.
        // touch-none: ngón tay đặt lên nút là để KÉO nút, không phải cuộn trang. select-none +
        // cursor-grab báo nút dời được; data-[dragging] đổi con trỏ sang nắm lúc đang kéo.
        className="fixed right-4 bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+1rem)] z-[45] size-14 cursor-grab touch-none select-none data-[dragging]:cursor-grabbing md:right-6 md:bottom-6 [body:has([data-app-overlay])_&]:hidden [body:has([data-bottom-bar])_&]:bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+5.5rem)] md:[body:has([data-bottom-bar])_&]:bottom-24 [body:has([data-filter-sheet])_&]:hidden"
      >
        <MessageCircle aria-hidden className="size-6" strokeWidth={1.75} />
      </Button>
      <span id={MOVE_HINT_ID} className="sr-only">
        {t("support.trigger.moveHint")}
      </span>
    </>
  );
}
