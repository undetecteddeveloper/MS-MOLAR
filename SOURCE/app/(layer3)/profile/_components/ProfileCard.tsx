"use client";

// ProfileCard — thẻ duy nhất của /profile (S-01). Giữ trạng thái mở/đóng hộp
// thoại, ref của nút mở (để trả focus), bộ đếm toast, và chữ của vùng
// role="status" dùng chung. KHÔNG tự fetch gì: `user` do page (Server
// Component) truyền xuống, khuôn của SupportWidget.tsx:3-6.

import { useRef, useState } from "react";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { Avatar } from "@/components/shared/Avatar";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { AvatarUploader } from "./AvatarUploader";
import { ChangePasswordDialog } from "./ChangePasswordDialog";
import { DisplayNameEditor } from "./DisplayNameEditor";
import { PasswordRow } from "./PasswordRow";
import { SignOutButton } from "./SignOutButton";
import type { ProfileMessage } from "./errorMessages";

interface ProfileCardProps {
  user: CurrentUserProfile;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const t = useT();
  const [dialogOpen, setDialogOpen] = useState(false);
  // MỘT bộ đếm cho BA nguồn thành công (đổi mật khẩu / đổi ảnh / đổi tên).
  // `n: 0` nghĩa là "chưa bắn lần nào" và phải giữ đúng 0 cho tới lần thành
  // công thật đầu tiên — khởi tạo khác 0 là bắn một toast ngay lúc mount.
  const [toast, setToast] = useState<{ key: MessageKey | null; n: number }>({ key: null, n: 0 });
  const [status, setStatus] = useState<ProfileMessage | null>(null);
  const passwordTriggerRef = useRef<HTMLButtonElement>(null);

  function reportSuccess(key: MessageKey) {
    setToast((prev) => ({ key, n: prev.n + 1 }));
  }

  // Trả focus về nút mở trên MỌI đường đóng — Escape, scrim, Huỷ, thành công.
  // Panel chỉ biết cách tự lấy focus lúc mở, không biết trả về đâu, nên việc
  // này thuộc về component sở hữu cả hai (SupportWidget.tsx:33-36).
  function closeDialog() {
    setDialogOpen(false);
    passwordTriggerRef.current?.focus();
  }

  return (
    // Thẻ và trang CÙNG một màu nền — thẻ được phân biệt bằng đúng cái hairline
    // của nó. Đó là luật phân lớp phẳng của theme: không shadow, không gradient.
    <div className="border-border bg-card rounded-[var(--radius-card)] border p-6">
      <div className="flex flex-col items-center gap-4 text-center md:flex-row md:text-left">
        <Avatar src={user.avatarUrl} name={user.displayName} size={96} />
        <div className="min-w-0">
          {/* <p>, KHÔNG phải heading: đây là DỮ LIỆU, không phải cấu trúc tài
              liệu — nên nó cũng không được nhận serif (globals.css tự gán serif
              cho h1/h2/h3). */}
          <p className="text-foreground text-xl font-medium">{user.displayName}</p>
          <p className="text-muted-foreground truncate text-sm">
            <span className="sr-only">{t("profile.email.label")}: </span>
            {user.email}
          </p>
          <p className="text-muted-foreground text-xs">{t("profile.email.readOnly")}</p>
        </div>
      </div>

      <div className="divide-border border-border mt-6 divide-y border-t">
        <DisplayNameEditor
          displayName={user.displayName}
          onSuccess={reportSuccess}
          onStatus={setStatus}
        />
        <PasswordRow onOpen={() => setDialogOpen(true)} triggerRef={passwordTriggerRef} />
        <AvatarUploader onSuccess={reportSuccess} onStatus={setStatus} />
      </div>

      <div className="border-border mt-6 flex border-t pt-6">
        <SignOutButton />
      </div>

      {/* MỘT vùng polite cho cả thẻ, mang chữ "đang xử lý" hiện hành và rỗng khi
          rảnh. Nó tồn tại vì nhãn của một nút aria-disabled mà người dùng KHÔNG
          đứng trên đó thì không được đọc lên một cách đáng tin. */}
      <div role="status" aria-live="polite" className="sr-only">
        {status ? t(status.key, status.values) : ""}
      </div>

      <SuccessToast message={toast.key ? t(toast.key) : ""} trigger={toast.n} />

      <ChangePasswordDialog
        open={dialogOpen}
        onClose={closeDialog}
        onSuccess={reportSuccess}
        onStatus={setStatus}
      />
    </div>
  );
}
