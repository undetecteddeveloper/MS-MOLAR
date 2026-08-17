"use client";

// Avatar — ảnh đại diện dùng chung, BA chỗ gọi: /profile (96px), SidebarProfile
// (32px), HeaderProfile (24px). Đúng ngưỡng Rule of Three, không phải dự phòng
// cho một tương lai giả định — trước file này, hai widget kia mỗi bên hardcode
// `const AVATAR = "/images/user-avatar-placeholder.png"` và không nơi nào trong
// repo suy ra được chữ cái đầu.
//
// ⚠ <img> THUẦN, KHÔNG dùng next/image (Design Doc C5). next.config.ts không
// khai `images.remotePatterns` nào, nên next/image trỏ vào URL Supabase là lỗi
// LÚC CHẠY chứ không phải lỗi biên dịch — nó qua được `tsc`, qua được `next
// build`, rồi hỏng trên production. Tiền lệ của repo là QuestionFigure.tsx:50.
//
// ⚠ KHÔNG BAO GIỜ ĐƯỢC PHÉP RA ẢNH VỠ (PRD AC-033b, AC-006). Có đúng MỘT nhánh
// render <img>: khi `src` là chuỗi và qua được allowlist origin. Ba đường còn
// lại — null (chưa có ảnh HOẶC ký URL hỏng, chỗ gọi không cần phân biệt), origin
// lạ/URL rác, và ảnh lỗi lúc chạy — đều rơi về initials.

import { useState } from "react";
import { User } from "lucide-react";
import { isAllowedImageUrl } from "@/components/shared/QuestionFigure";
import { deriveInitials } from "@/lib/profile/initials";
import { cn } from "@/lib/utils";

interface AvatarProps {
  /** Signed URL đã giải sẵn ở server, hoặc `null`. KHÔNG phải path trong bucket. */
  src: string | null;
  /** Tên hiển thị — nguồn của initials. Không bao giờ rỗng (getCurrentUser.ts). */
  name: string;
  /** Cạnh hình vuông, px. Đi qua `style` chứ không qua class: đây là số lúc
   *  chạy, mà Tailwind sinh class bằng cách quét TĨNH mã nguồn — `size-${size}`
   *  biên dịch được nhưng không có CSS nào tồn tại cho nó. */
  size: number;
  className?: string;
}

export function Avatar({ src, name, size, className }: AvatarProps) {
  // Lưu ĐÚNG cái src đã hỏng, không phải một cờ boolean: sau khi đổi ảnh,
  // router.refresh() đưa xuống một src mới và một cờ boolean sẽ dính lại, khiến
  // ảnh vừa tải lên thành công vẫn hiện initials cho tới lần tải trang sau.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const usable = src !== null && src !== failedSrc && isAllowedImageUrl(src);

  const box = "inline-flex shrink-0 items-center justify-center rounded-full";

  if (usable) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh Storage động (signed URL), không qua next/image optimizer: next.config.ts không khai remotePatterns
      <img
        src={src}
        // alt="" là CHỦ Ý (AC-042): tên hiển thị luôn nằm ngay cạnh trong DOM,
        // nên một alt mô tả chỉ đọc lặp lại cùng một thông tin. Và alt KHÔNG
        // BAO GIỜ được là tên file hay URL.
        alt=""
        width={size}
        height={size}
        onError={() => setFailedSrc(src)}
        style={{ width: size, height: size }}
        className={cn(box, "object-cover", className)}
      />
    );
  }

  const initials = deriveInitials(name);

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.36)) }}
      className={cn(box, "bg-secondary text-foreground font-sans font-medium", className)}
    >
      {initials ? (
        // aria-hidden: chữ cái là bản nhắc lại trang trí của một cái tên đã có
        // trong DOM; đọc lên là đọc hai lần cùng một thứ.
        <span aria-hidden>{initials}</span>
      ) : (
        // `deriveInitials` trả "" khi tên không chứa chữ cái nào (vd "..." —
        // DISPLAY_NAME_RE cho phép). Vòng tròn trống trông như lỗi tải ảnh, nên
        // chỗ trống đó phải do một glyph trung tính chiếm.
        <User aria-hidden style={{ width: size * 0.5, height: size * 0.5 }} />
      )}
    </span>
  );
}
