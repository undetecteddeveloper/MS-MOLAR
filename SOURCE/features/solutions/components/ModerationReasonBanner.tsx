// ModerationReasonBanner — băng một dòng nêu lý do kiểm duyệt cho CHÍNH CHỦ
// NHÂN của bài giải. UI Spec § Component: ModerationReasonBanner định nghĩa
// hai biến thể: `alert` (bài đang bị ẩn, AC-083, màn viết) và `status` (bài
// vừa bị xoá hẳn, hiện MỘT LẦN trên thẻ cửa vào, AC-110). Task 08 dựng đúng
// biến thể `status` — biến thể `alert` do task 10/39 thêm vào file này khi
// dựng màn viết, không phải việc của task này (task 08 Notes: "impact scope").
//
// `role="status"` mang aria-live="polite" NGẦM ĐỊNH theo đặc tả ARIA — không
// cần khai `aria-live` tường minh (UI Spec :998 cũng không khai).
import { Info } from "lucide-react";

import { t } from "@/lib/copy";
import { Card } from "@/components/ui/card";

interface ModerationReasonBannerProps {
  /** Lý do quản trị viên ghi khi xoá hẳn bài giải — luôn có mặt khi component
   *  này được gọi (nơi gọi chỉ render khi `unseenDeletionReason` khác rỗng). */
  reason: string;
}

export function ModerationReasonBanner({ reason }: ModerationReasonBannerProps) {
  return (
    <Card padding="compact" role="status" className="flex-row items-center gap-3">
      <Info aria-hidden className="text-muted-foreground size-5 shrink-0" />
      <p className="text-sm">{t("solutions.entry.deleted", { reason })}</p>
    </Card>
  );
}
