// AnonymousAvatar — ô tròn "mắt gạch" đứng chỗ ảnh đại diện của một danh tính
// ẩn danh (UI Spec C-08, DV-18; PRD AC-039, AC-105).
//
// Anh em của Avatar, KHÔNG phải một nhánh của nó: nếu Avatar có nhánh "ẩn danh"
// thì nơi gọi vẫn phải cầm `src`/`name` của người ẩn danh để truyền vào — tức dữ
// liệu cần che đã đi tới tận component. Ở đây không có prop nào chở được danh
// tính, nên không có cách nào làm lộ nó từ phía này.
//
// Thuần trang trí: icon `aria-hidden`, nghĩa do chữ "Ẩn danh" đứng CẠNH ô mang
// (AuthorIdentity render chữ đó, không phải component này).

import { EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface AnonymousAvatarProps {
  /** 28px ở hàng bình luận, 32px ở thẻ bài giải và thẻ người viết. */
  size: 28 | 32;
}

export function AnonymousAvatar({ size }: AnonymousAvatarProps) {
  return (
    <span
      className={cn(
        "bg-card inline-flex shrink-0 items-center justify-center rounded-full",
        size === 28 ? "size-7" : "size-8"
      )}
    >
      <EyeOff aria-hidden className="text-muted-foreground size-4" />
    </span>
  );
}
