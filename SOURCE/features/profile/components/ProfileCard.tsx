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
import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { Avatar } from "@/components/shared/Avatar";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { AvatarUploader } from "@/features/profile/components/AvatarUploader";
import { ChangePasswordDialog } from "@/features/profile/components/ChangePasswordDialog";
import { DisplayNameEditor } from "@/features/profile/components/DisplayNameEditor";
import { PasswordRow } from "@/features/profile/components/PasswordRow";
import { SignOutButton } from "@/features/profile/components/SignOutButton";
import { profileMessage, type ProfileMessage } from "@/features/profile/components/errorMessages";
import { outlineFilePickerCls } from "@/features/profile/components/styles";

/** Nút mở và khối sửa nằm ở hai chỗ khác nhau trong cây, nên `aria-controls`
 *  là thứ duy nhất nối chúng lại cho trình đọc màn hình. */
const AVATAR_PANEL_ID = "profile-avatar-panel";
const NAME_PANEL_ID = "profile-name-panel";
/** Ô chọn tệp ảnh sống ở ĐÂY (cạnh nhãn của nó) chứ không trong AvatarUploader:
 *  `htmlFor` cần input, và mẫu `peer-focus-visible` cần nó là anh em liền kề. */
const AVATAR_INPUT_ID = "profile-avatar";
const AVATAR_HINT_ID = "profile-avatar-hint";

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
  // Trình đổi ảnh do thẻ này sở hữu, không do AvatarUploader tự giữ: bộ chọn
  // tệp nằm trong cụm danh tính ở đầu thẻ còn khối xem trước nằm bên dưới nó,
  // hai chỗ khác nhau trong cây DOM. Một component không thể render hai mảnh
  // vào hai nơi mà không có ai đứng trên cả hai.
  //
  // Trạng thái là TỆP ĐÃ CHỌN, không phải một cờ "đang mở": khối bên dưới không
  // còn lý do tồn tại nào khác ngoài việc xem trước một tệp cụ thể, nên "có tệp"
  // và "đang mở" là cùng một điều — hai biến cho một điều thì sẽ có ngày lệch.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // Cùng lý do với avatar: bút chì nằm trong cụm danh tính, khối sửa nằm dưới.
  const [nameOpen, setNameOpen] = useState(false);
  const nameTriggerRef = useRef<HTMLButtonElement>(null);

  function closeName() {
    setNameOpen(false);
    nameTriggerRef.current?.focus();
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    // Reset BẮT BUỘC: `change` chỉ bắn khi giá trị đổi, nên chọn LẠI đúng tệp
    // vừa huỷ sẽ im lặng không làm gì nếu giá trị cũ còn nằm đó.
    e.target.value = "";
    if (!picked) return;
    setAvatarFile(picked);
    // Người dùng trình đọc màn hình không thấy ảnh xem trước; câu này là thứ
    // duy nhất xác nhận cú chọn vừa rồi đã "vào".
    setStatus({ key: "profile.avatar.selected", values: { name: picked.name } });
  }

  // Bộ chọn tệp ở LẠI trong cây khi khối xem trước mở, nên trả tiêu điểm là một
  // lệnh gọi thẳng. Đích là chính cái <input> ẩn chứ không phải nhãn: nhãn
  // không nhận được tiêu điểm, và vòng focus của nó vốn đã soi từ input qua
  // `peer-focus-visible` — nên trả về input là trả về đúng thứ người dùng nhìn
  // thấy là "đang đứng ở nút Đổi ảnh".
  function closeAvatar() {
    setAvatarFile(null);
    setStatus(null);
    avatarInputRef.current?.focus();
  }

  function reportSuccess(key: MessageKey) {
    setToast((prev) => ({ key, n: prev.n + 1 }));
  }

  // `{maxMb}` được điền một chỗ duy nhất, ở đây, từ chính hằng số mà Server
  // Action dùng — không có bản chép nào để lệch.
  const avatarHint = profileMessage("profile.avatar.hint");

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
          <div className="flex items-center justify-center md:justify-start">
            {/* Bọc tên + bút chì trong một khối co theo NỘI DUNG, để dưới 768px
                cái được căn giữa là khối này chứ không phải "tên cộng thêm 44px
                nút". Trước đây bút chì nằm trong dòng chảy của hàng căn giữa,
                nên tâm của hàng rơi vào giữa cụm tên+nút và cái tên bị đẩy lệch
                trái đúng nửa bề rộng nút — đo được ở 390px: tâm tên 172 so với
                tâm email 195, lệch 23px. Nó đọc thành "chữ bị đặt sai chỗ" chứ
                không ai nhìn ra thủ phạm là cái nút bên cạnh.
                Cách chữa: dưới 768px bút chì ra khỏi dòng chảy (`absolute
                left-full`) — nó vẫn đứng ngay cạnh tên, nhưng không còn góp bề
                rộng nào vào phép căn giữa. Từ 768px trở lên hàng căn TRÁI nên
                không có gì để lệch, giữ nguyên dòng chảy cũ. */}
            <span className="relative flex min-w-0 items-center gap-1">
              {/* <p>, KHÔNG phải heading: đây là DỮ LIỆU, không phải cấu trúc
                  tài liệu — nên nó cũng không được nhận serif (globals.css tự
                  gán serif cho h1/h2/h3). */}
              <p className="text-foreground truncate text-xl font-medium">{user.displayName}</p>
              {/* `size-11` = sàn chạm 44px (Mobile-Layout-Research-MS §4.3) —
                  biểu tượng nhỏ nhưng vùng bấm thì không. `md:-my-2` nuốt phần
                  cao thừa để cụm danh tính không cao thêm vì một cái nút; chỉ
                  cần từ 768px vì dưới ngưỡng đó nút đã ra khỏi dòng chảy và
                  không đóng góp chiều cao nào.
                  `max-md:ml-1` giữ đúng khe 4px mà `gap-1` tạo ra ở dòng chảy —
                  phần tử absolute không nhận gap, nên khe phải khai bằng lề.
                  aria-label bắt buộc: nút chỉ có biểu tượng không có chữ nào cho
                  trình đọc màn hình, và <svg> bên trong là aria-hidden. */}
              <button
                ref={nameTriggerRef}
                type="button"
                aria-label={t("profile.name.change")}
                aria-expanded={nameOpen}
                aria-controls={NAME_PANEL_ID}
                onClick={() => (nameOpen ? closeName() : setNameOpen(true))}
                className="text-muted-foreground hover:text-brand focus-visible:border-ring focus-visible:ring-ring/50 inline-flex size-11 shrink-0 items-center justify-center rounded-[4px] border border-transparent transition-colors outline-none focus-visible:ring-3 max-md:absolute max-md:top-1/2 max-md:left-full max-md:ml-1 max-md:-translate-y-1/2 md:-my-2"
              >
                <Pencil aria-hidden className="size-4" />
              </button>
            </span>
          </div>
          <p className="text-muted-foreground truncate text-sm">
            <span className="sr-only">{t("profile.email.label")}: </span>
            {user.email}
          </p>
          <p className="text-muted-foreground text-xs">{t("profile.email.readOnly")}</p>
        </div>
        {/* Nút đổi ảnh đứng cạnh thứ nó sửa. `md:ml-auto` đẩy nó về mép phải
            trên desktop; dưới 768px cụm xếp dọc và căn giữa nên nút tự nằm dưới
            avatar, vẫn ngay cạnh đối tượng của nó.

            Đây là NHÃN của bộ chọn tệp, không phải nút mở một khối sửa (đổi
            2026-08-21). Trước đây bấm "Đổi ảnh" mở ra một khối chỉ chứa đúng
            một nút "Chọn ảnh" — tức người dùng phải bấm HAI lần, và lần thứ
            nhất chẳng cho họ thông tin hay lựa chọn gì để mà cân nhắc. Nay
            trình quản lý tệp của máy mở ngay từ cú chạm đầu tiên; khối bên dưới
            chỉ xuất hiện SAU khi đã có tệp, và lúc đó nó có việc thật để làm
            (xem trước + Lưu, bước hai của UI-D11).

            `<label htmlFor>` chứ không phải `<button onClick={input.click()}>`:
            nhãn mở hộp thoại tệp bằng hành vi gốc của trình duyệt, không phụ
            thuộc vào việc lượt kích hoạt của người dùng còn hiệu lực hay không
            ở thời điểm JS chạy. */}
        <div className="md:ml-auto md:shrink-0">
          {/* `peer sr-only`, KHÔNG `hidden`: SR-ONLY giữ điểm dừng Tab và giữ ô
              này trong cây trợ năng, còn `hidden` thì xoá cả hai. Cùng khuôn
              với ScreenshotAttachment.tsx và với chính khối này trước đây. */}
          <input
            ref={avatarInputRef}
            id={AVATAR_INPUT_ID}
            type="file"
            accept={AVATAR_LIMITS.ALLOWED_MIME.join(",")}
            onChange={handleAvatarPick}
            aria-describedby={AVATAR_HINT_ID}
            className="peer sr-only"
          />
          <label htmlFor={AVATAR_INPUT_ID} className={outlineFilePickerCls}>
            {t("profile.avatar.change")}
          </label>
          {/* Giới hạn định dạng/dung lượng nói cho người dùng trình đọc màn
              hình biết TRƯỚC khi họ đi vào thư viện ảnh. sr-only chứ không hiện
              ra: thuộc tính `accept` đã lọc sẵn danh sách tệp cho người dùng
              nhìn thấy được, nên với họ dòng này chỉ là một ghi chú thừa trong
              một thẻ vốn đã nhiều chữ. */}
          <span id={AVATAR_HINT_ID} className="sr-only">
            {t(avatarHint.key, avatarHint.values)}
          </span>
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

      {avatarFile && (
        <AvatarUploader
          id={AVATAR_PANEL_ID}
          file={avatarFile}
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
