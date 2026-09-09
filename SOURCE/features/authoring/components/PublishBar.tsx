"use client";

// PublishBar — thanh hành động màn rà soát (UI Spec §PublishBar / Task 6.4).
// Đề chưa published: "Lưu thay đổi" (lưu nháp) + "Xuất bản" (disabled tới khi
// sạch). Đề đã published: chỉ "Lưu thay đổi" (validate trước khi ghi). Trạng
// thái saving/publishing + thông báo lỗi.
//
// Theme "Sân trường" (2026-09-09):
//   - Nền trắng đặc + kẻ chia trên (kẻ chia là ngoại lệ được phép của "nền tô
//     thay viền", §4.2); hết backdrop-blur (theme phẳng, §7).
//   - Dưới 768px thanh dính NGAY TRÊN BottomNav chứ không ở mép viewport: bản
//     trước `sticky bottom-0` nằm dưới thanh điều hướng cố định, tức bị che
//     cho tới khi cuộn hết trang. Cùng biểu thức bottom với FilterSheet.
//   - Hai nút chia đôi bề ngang dưới 640px (đủ 44px mỗi nút ở 360px); từ 640px
//     căn phải, cỡ mặc định.
//   - Nút Xoá đề RỜI khỏi thanh này, xuống chân trang (ReviewScreen): ba viên
//     thuốc không đứng vừa 312px, và hành động phá huỷ đứng cạnh nút Xuất bản
//     là sai thứ tự an toàn. Nhờ vậy thanh không còn chứa hộp thoại nào.
//   - `data-bottom-bar`: mốc để SupportWidgetTrigger nhấc lên trên thanh (nút
//     hỗ trợ ở góc dưới phải từng che nút Xuất bản ở 360px và 768px).
//   - Lề âm dưới (`-mb-6 sm:-mb-8`) nuốt đệm đáy của PageContainer: ở cuối
//     trang thanh về đúng vị trí trong luồng, và nếu còn đệm dưới nó sẽ "nhảy"
//     lên 24–32px so với lúc đang dính — cùng một thanh mà hai vị trí.

import { t } from "@/lib/copy";
import { Button } from "@/components/ui/button";

interface PublishBarProps {
  isPublished: boolean;
  canPublish: boolean;
  saving: boolean;
  publishing: boolean;
  dirty: boolean;
  error: string | null;
  onSave: () => void;
  onPublish: () => void;
}

export function PublishBar({
  isPublished,
  canPublish,
  saving,
  publishing,
  dirty,
  error,
  onSave,
  onPublish,
}: PublishBarProps) {
  const busy = saving || publishing;
  return (
    <div
      data-bottom-bar=""
      className="border-border bg-background sticky bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] z-20 -mx-4 -mb-6 border-t px-4 py-3 sm:-mx-6 sm:-mb-8 sm:px-6 md:bottom-0"
    >
      {error && (
        <p role="alert" className="text-destructive mb-2 text-sm">
          {error}
        </p>
      )}
      <div className="flex items-center gap-2 sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          onClick={onSave}
          disabled={busy || (!dirty && isPublished)}
          className="flex-1 sm:flex-none"
        >
          {saving ? t("common.saving") : t("upload.saveChanges")}
        </Button>

        {!isPublished && (
          <Button
            type="button"
            onClick={onPublish}
            disabled={!canPublish || busy}
            title={canPublish ? undefined : t("upload.fixIssuesFirst")}
            className="flex-1 sm:flex-none"
          >
            {publishing ? t("upload.publishing") : t("upload.publish")}
          </Button>
        )}
      </div>
    </div>
  );
}
