"use client";

// PasswordRow — hàng mật khẩu (/profile). Hàng này KHÔNG đọc gì, KHÔNG gửi gì
// và không thể hỏng ở đâu: mọi kết cục của việc đổi mật khẩu thuộc về
// ChangePasswordDialog. Ở đây chỉ có mặt nạ và một nút mở hộp thoại.
//
// KHÔNG CÓ NÚT HIỆN MẬT KHẨU, và sự vắng mặt đó là tiêu chí nghiệm thu chứ
// không phải thiếu sót (AC-011): không icon con mắt, không nút bật/tắt `type`,
// không `title`/`aria-label` nào hứa hiển thị được gì. Mặt nạ cũng KHÔNG phải
// một <input> — nó là text node, nên không có `value` nào cho devtools đọc.

import { t } from "@/lib/copy";
import { buttonVariants } from "@/components/ui/button";
import { ProfileRow } from "@/features/profile/components/ProfileRow";

/**
 * ĐÚNG 8 ký tự U+2022 BULLET. Hằng số cấp module, nằm NGOÀI từ điển: nó giống
 * hệt nhau giữa hai tài khoản có mật khẩu dài ngắn khác nhau.
 *
 * ⚠ KHÔNG BAO GIỜ dẫn xuất từ độ dài mật khẩu thật. Một mặt nạ dài bằng mật
 * khẩu trông "thật" hơn, nhưng nó đã tiết lộ một bit của chính bí mật đang được
 * che — và tiết lộ cho bất kỳ ai liếc qua màn hình.
 */
const PASSWORD_MASK = "••••••••";

interface PasswordRowProps {
  onOpen: () => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
}

export function PasswordRow({ onOpen, triggerRef }: PasswordRowProps) {
  return (
    <ProfileRow
      label={t("profile.password.label")}
      action={
        // Viên thuốc trắng 36px — nút trong thẻ (design doc §2), trắng vì nó
        // đứng trên thẻ surface. `buttonVariants` trên <button> thật thay vì
        // primitive Button để giữ `ref` nguyên vẹn cho việc trả tiêu điểm.
        <button
          ref={triggerRef}
          type="button"
          onClick={onOpen}
          className={buttonVariants({ variant: "plain", size: "sm" })}
        >
          {t("profile.password.change")}
        </button>
      }
    >
      {/* aria-hidden trên tám dấu chấm: đọc "chấm chấm chấm chấm…" là tiếng ồn.
          Câu sr-only bên cạnh nói đúng điều tám dấu chấm đang nói bằng hình.
          `font-mono` giữ nguyên: đây là tám ký tự giống nhau, không phải một
          con số cần tabular-nums, và ca kiểm ghim đúng lớp này. */}
      <span aria-hidden className="text-foreground font-mono tracking-[0.2em]">
        {PASSWORD_MASK}
      </span>
      <span className="sr-only">{t("profile.password.masked")}</span>
      <span className="text-muted-foreground mt-1 block text-xs">
        {t("profile.password.noReveal")}
      </span>
    </ProfileRow>
  );
}
