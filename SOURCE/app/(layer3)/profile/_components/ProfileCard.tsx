"use client";

// ProfileCard — thẻ duy nhất của /profile (S-01). Giữ trạng thái mở/đóng hộp
// thoại, ref của nút mở (để trả focus), bộ đếm toast, và chữ của vùng
// role="status" dùng chung. KHÔNG tự fetch gì: `user` do page (Server
// Component) truyền xuống, khuôn của SupportWidget.tsx:3-6.

import { useRef, useState } from "react";
import { Pencil } from "lucide-react";
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
import { outlineButtonCls } from "./styles";

/** Nút mở và khối sửa nằm ở hai chỗ khác nhau trong cây, nên `aria-controls`
 *  là thứ duy nhất nối chúng lại cho trình đọc màn hình. */
const AVATAR_PANEL_ID = "profile-avatar-panel";
const NAME_PANEL_ID = "profile-name-panel";

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
  // Trình đổi ảnh do thẻ này sở hữu, không do AvatarUploader tự giữ: nút mở nằm
  // trong cụm danh tính ở đầu thẻ còn khối sửa nằm bên dưới nó, hai chỗ khác
  // nhau trong cây DOM. Một component không thể render hai mảnh vào hai nơi mà
  // không có ai đứng trên cả hai.
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarTriggerRef = useRef<HTMLButtonElement>(null);
  // Cùng lý do với avatar: bút chì nằm trong cụm danh tính, khối sửa nằm dưới.
  const [nameOpen, setNameOpen] = useState(false);
  const nameTriggerRef = useRef<HTMLButtonElement>(null);

  function closeName() {
    setNameOpen(false);
    nameTriggerRef.current?.focus();
  }

  // Nút "Đổi ảnh" ở LẠI trong cây khi khối sửa mở (chỉ đổi nhãn), nên trả focus
  // là một lệnh gọi thẳng — không cần ref "chờ nút mọc lại" + effect như bản
  // trước, khi nút bị gỡ khỏi cây lúc đang sửa và focus() rơi vào khoảng không.
  function closeAvatar() {
    setAvatarOpen(false);
    avatarTriggerRef.current?.focus();
  }

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
          {/* Bút chì ĐỨNG CẠNH cái tên nó sửa. Hàng "DISPLAY NAME" riêng đã bị
              bỏ: nó hiển thị lại đúng cái tên đang nằm ngay phía trên nó, nên
              cái nhãn ấy chỉ tồn tại để làm chỗ treo một cái nút.
              `justify-center md:justify-start` bám theo `text-center
              md:text-left` của cụm cha — dưới 768px cụm xếp dọc và căn giữa. */}
          <div className="flex items-center justify-center gap-1 md:justify-start">
            {/* <p>, KHÔNG phải heading: đây là DỮ LIỆU, không phải cấu trúc tài
                liệu — nên nó cũng không được nhận serif (globals.css tự gán
                serif cho h1/h2/h3). */}
            <p className="text-foreground truncate text-xl font-medium">{user.displayName}</p>
            {/* `size-11` = sàn chạm 44px (Mobile-Layout-Research-MS §4.3) —
                biểu tượng nhỏ nhưng vùng bấm thì không. `-my-2` nuốt phần cao
                thừa để cụm danh tính không cao thêm vì một cái nút.
                aria-label bắt buộc: nút chỉ có biểu tượng không có chữ nào cho
                trình đọc màn hình, và <svg> bên trong là aria-hidden. */}
            <button
              ref={nameTriggerRef}
              type="button"
              aria-label={t("profile.name.change")}
              aria-expanded={nameOpen}
              aria-controls={NAME_PANEL_ID}
              onClick={() => (nameOpen ? closeName() : setNameOpen(true))}
              className="text-muted-foreground hover:text-brand focus-visible:border-ring focus-visible:ring-ring/50 -my-2 inline-flex size-11 shrink-0 items-center justify-center rounded-[4px] border border-transparent transition-colors outline-none focus-visible:ring-3"
            >
              <Pencil aria-hidden className="size-4" />
            </button>
          </div>
          <p className="text-muted-foreground truncate text-sm">
            <span className="sr-only">{t("profile.email.label")}: </span>
            {user.email}
          </p>
          <p className="text-muted-foreground text-xs">{t("profile.email.readOnly")}</p>
        </div>
        {/* Nút đổi ảnh đứng cạnh thứ nó sửa. `md:ml-auto` đẩy nó về mép phải
            trên desktop; dưới 768px cụm xếp dọc và căn giữa nên nút tự nằm dưới
            avatar, vẫn ngay cạnh đối tượng của nó. */}
        <div className="md:ml-auto md:shrink-0">
          <button
            ref={avatarTriggerRef}
            type="button"
            aria-expanded={avatarOpen}
            aria-controls={AVATAR_PANEL_ID}
            onClick={() => (avatarOpen ? closeAvatar() : setAvatarOpen(true))}
            className={outlineButtonCls}
          >
            {t("profile.avatar.change")}
          </button>
        </div>
      </div>

      {/* GẮN/GỠ chứ không truyền `open` xuống: state bên trong (bản nháp tên,
          tệp đã chọn, lỗi) tự khởi tạo lại mỗi lần mở, nên không cần effect nào
          đồng bộ chúng — và một effect như vậy sẽ setState trong thân effect,
          thứ `react-hooks/set-state-in-effect` chặn ở cổng lint. */}
      {nameOpen && (
        <DisplayNameEditor
          id={NAME_PANEL_ID}
          onClose={closeName}
          displayName={user.displayName}
          onSuccess={reportSuccess}
          onStatus={setStatus}
        />
      )}

      {avatarOpen && (
        <AvatarUploader
          id={AVATAR_PANEL_ID}
          onClose={closeAvatar}
          onSuccess={reportSuccess}
          onStatus={setStatus}
        />
      )}

      {/* border-t VÀ border-b trên CHÍNH khối này (không phải border-t rời ở
          khối Sign out bên dưới): khối Sign out trước đây tự mang border-t +
          pt-6, nghĩa là khoảng cách "nút Change password → đường kẻ dưới" =
          py-4 (16px, bên trong PasswordRow) + mt-6 (24px, margin của khối
          Sign out) = 40px, trong khi "đường kẻ trên → nhãn Password" chỉ có
          py-4 = 16px — lệch hẳn (engineer 2026-08-17, đo bằng bounding rect:
          17px trên vs 40px dưới). Gộp cả hai đường kẻ vào khối này thì hai
          khoảng cách cùng chỉ còn đúng py-4 (16px) hai bên. */}
      <div className="border-border mt-6 border-t border-b">
        <PasswordRow onOpen={() => setDialogOpen(true)} triggerRef={passwordTriggerRef} />
      </div>

      {/* Căn GIỮA: đăng xuất không cùng họ với ba hành động sửa ở trên (chúng
          căn phải theo hàng của mình), nó rời khỏi trang. Đứng giữa dưới một
          hairline là cách nói điều đó bằng bố cục. mt-6 giữ nguyên khoảng
          cách 24px cũ tới đường kẻ (trước đây là pt-6 bên trong khối có
          border riêng — nay đường kẻ thuộc khối phía trên). */}
      <div className="mt-6 flex justify-center">
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
