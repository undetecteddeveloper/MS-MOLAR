// ModerationReasonBanner — băng một dòng nêu lý do kiểm duyệt cho CHÍNH CHỦ
// NHÂN của bài giải. UI Spec § Component: ModerationReasonBanner định nghĩa
// hai biến thể: `alert` (bài đang bị ẩn, AC-083, màn viết) và `status` (bài
// vừa bị xoá hẳn, hiện MỘT LẦN trên thẻ cửa vào, AC-110). Task 08 dựng đúng
// biến thể `status` (mặc định, hành vi giữ nguyên — task này không sửa nhánh
// đó). Biến thể `alert` do task 10 thêm vào đây khi dựng đầu màn viết
// (`SolutionEditorScreen`, task 39 khai thác thêm ở màn xem cho ngữ cảnh khác).
//
// `role="status"` mang aria-live="polite" NGẦM ĐỊNH theo đặc tả ARIA — không
// cần khai `aria-live` tường minh (UI Spec :998 cũng không khai). Biến thể
// `alert` dùng `role="alert"` (assertive ngầm định) đúng UI Spec `:1955`.
import { Info } from "lucide-react";

import { t } from "@/lib/copy";
import { Card } from "@/components/ui/card";

interface ModerationReasonBannerProps {
  /** Lý do quản trị viên ghi — luôn có mặt khi component này được gọi (nơi
   *  gọi chỉ render khi có lý do khác rỗng, dù là "đã xoá hẳn" hay "đang ẩn"). */
  reason: string;
  /** `"status"` (mặc định, task 08): thẻ cửa vào, hiện một lần (AC-110).
   *  `"alert"` (task 10): đầu màn viết khi bài đang bị ẩn (AC-083). */
  variant?: "status" | "alert";
  /** Id gắn lên phần tử gốc — `SolutionSettingsPanel`'s `lockReasonId` trỏ vào
   *  đây để hai công tắc chỉ đọc có `aria-describedby` đúng băng lý do khoá. */
  id?: string;
}

export function ModerationReasonBanner({ reason, variant = "status", id }: ModerationReasonBannerProps) {
  if (variant === "alert") {
    return (
      <div id={id} role="alert" className="bg-destructive/10 text-destructive rounded-card px-4 py-3 text-sm">
        {t("solutions.hiddenBanner", { reason })}
      </div>
    );
  }

  return (
    <Card id={id} padding="compact" role="status" className="flex-row items-center gap-3">
      <Info aria-hidden className="text-muted-foreground size-5 shrink-0" />
      <p className="text-sm">{t("solutions.entry.deleted", { reason })}</p>
    </Card>
  );
}
