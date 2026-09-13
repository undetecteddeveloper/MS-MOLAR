"use client";

// ProfileCard — thẻ duy nhất của /profile (S-01). Giữ trạng thái mở/đóng hộp
// thoại, ref của nút mở (để trả focus), bộ đếm toast, và chữ của vùng
// role="status" dùng chung. KHÔNG tự fetch gì: `user` do page (Server
// Component) truyền xuống, khuôn của SupportWidget.tsx.
//
// Theme "Sân trường" (2026-09-10): thẻ surface không viền, không bóng. Ba khối
// bên trong (cụm danh tính, hàng mật khẩu, đăng xuất) tách bằng kẻ chia —
// ngoại lệ đã cho phép của quy tắc "nền tô thay viền" (design doc §4.2). Khối
// sửa tên và khối xem trước ảnh là thẻ TRẮNG con nằm trên surface, chỉ gắn vào
// cây khi có việc. Căn TRÁI ở mọi bề rộng: bản trước căn giữa cụm danh tính
// dưới 768px và phải đưa bút chì ra khỏi dòng chảy bằng `absolute` để phép căn
// giữa không lệch 23px — nay không còn gì để lệch.

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import type { CurrentUserProfile } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { cn } from "@/lib/utils";
import { Avatar } from "@/components/shared/Avatar";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { AvatarUploader } from "@/features/profile/components/AvatarUploader";
import { ChangePasswordDialog } from "@/features/profile/components/ChangePasswordDialog";
import { DisplayNameEditor } from "@/features/profile/components/DisplayNameEditor";
import { PasswordRow } from "@/features/profile/components/PasswordRow";
import { SignOutButton } from "@/features/profile/components/SignOutButton";
import { profileMessage, type ProfileMessage } from "@/features/profile/components/errorMessages";

/** Nút mở và khối xem trước ảnh nằm ở hai chỗ khác nhau trong cây, nên
 *  `aria-controls` là thứ duy nhất nối chúng lại cho trình đọc màn hình. Khối
 *  sửa tên thì đứng ĐÚNG CHỖ dòng tên (2026-09-13), id chỉ để định danh form. */
const AVATAR_PANEL_ID = "profile-avatar-panel";
const NAME_PANEL_ID = "profile-name-panel";
/** Ô chọn tệp ảnh sống ở ĐÂY (cạnh nhãn của nó) chứ không trong AvatarUploader:
 *  `htmlFor` cần input, và mẫu `peer-focus-visible` cần nó là anh em liền kề. */
const AVATAR_INPUT_ID = "profile-avatar";
const AVATAR_HINT_ID = "profile-avatar-hint";

/**
 * Nhãn đóng vai NÚT cho `<input type="file">` mang `peer sr-only` đứng ngay
 * TRƯỚC nó — viên thuốc trắng 36px, cỡ nút trong thẻ. Hai khác biệt so với
 * một Button thật, và cả hai đều bắt buộc: vòng tiêu điểm soi qua
 * `peer-focus-visible:*` vì `<label>` không bao giờ nhận tiêu điểm (cái nhận
 * là input ẩn), và `cursor-pointer` vì nhãn không phải nút nên trình duyệt
 * không tự đổi con trỏ.
 */
const FILE_PICKER_CLS = cn(
  buttonVariants({ variant: "plain", size: "sm" }),
  "peer-focus-visible:border-ring peer-focus-visible:ring-ring/40 cursor-pointer peer-focus-visible:ring-3"
);

interface ProfileCardProps {
  user: CurrentUserProfile;
}

export function ProfileCard({ user }: ProfileCardProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  // MỘT bộ đếm cho BA nguồn thành công (đổi mật khẩu / đổi ảnh / đổi tên).
  // `n: 0` nghĩa là "chưa bắn lần nào" và phải giữ đúng 0 cho tới lần thành
  // công thật đầu tiên — khởi tạo khác 0 là bắn một toast ngay lúc mount.
  const [toast, setToast] = useState<{ key: MessageKey | null; n: number }>({ key: null, n: 0 });
  const [status, setStatus] = useState<ProfileMessage | null>(null);
  const passwordTriggerRef = useRef<HTMLButtonElement>(null);
  // Trình đổi ảnh do thẻ này sở hữu, không do AvatarUploader tự giữ: bộ chọn
  // tệp nằm trong cụm danh tính ở đầu thẻ còn khối xem trước nằm bên dưới nó.
  // Trạng thái là TỆP ĐÃ CHỌN, không phải một cờ "đang mở": khối bên dưới không
  // còn lý do tồn tại nào khác ngoài việc xem trước một tệp cụ thể.
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // Khối sửa tên đứng THAY dòng tên + bút chì (2026-09-13), nên bút chì rời
  // cây trong lúc sửa và không thể nhận focus ngay trong closeName() — lúc đó
  // nó chưa được gắn lại. Cờ ref đánh dấu "vừa đóng", effect dưới đợi lượt
  // render gắn lại bút chì rồi mới trả focus (mọi đường đóng: Huỷ, Escape,
  // lưu thành công). Ref chứ không phải state: không có gì để render lại.
  const [nameOpen, setNameOpen] = useState(false);
  const nameTriggerRef = useRef<HTMLButtonElement>(null);
  const returnFocusToPencilRef = useRef(false);

  useEffect(() => {
    if (nameOpen || !returnFocusToPencilRef.current) return;
    returnFocusToPencilRef.current = false;
    nameTriggerRef.current?.focus();
  }, [nameOpen]);

  function closeName() {
    returnFocusToPencilRef.current = true;
    setNameOpen(false);
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

  // Trả tiêu điểm về chính cái <input> ẩn chứ không phải nhãn: nhãn không nhận
  // được tiêu điểm, và vòng focus của nó vốn đã soi từ input qua
  // `peer-focus-visible`.
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
  // Panel chỉ biết cách tự lấy focus lúc mở, không biết trả về đâu.
  function closeDialog() {
    setDialogOpen(false);
    passwordTriggerRef.current?.focus();
  }

  return (
    <Card padding="none" className="gap-0 p-5 sm:p-6">
      {/* Cụm danh tính. LƯỚI chứ không phải flex xếp dọc (engineer 2026-09-10):
          bản trước dùng `flex-col sm:flex-row`, nên dưới 640px ảnh chiếm trọn
          một hàng và cụm tên/email/ghi chú tụt xuống hàng dưới — bên phải ảnh
          bỏ trống một mảng 96px cao, đọc như lỗi bố cục.

          Lưới hai cột ở mọi bề ngang: ảnh (cột auto) và cụm chữ (cột
          `minmax(0,1fr)` — `0` là phần quan trọng: mặc định `1fr` không co
          dưới bề rộng nội dung, và một email dài sẽ nong lưới ra gây cuộn
          ngang thay vì bị cắt "…"). Ở 360px cột chữ được 176px, đủ cho tên và
          một email đã cắt.

          Nút Đổi ảnh: dưới 640px trải hết hai cột ở hàng thứ hai (căn trái,
          dưới ảnh); từ 640px thành cột thứ ba ở mép phải, ngang hàng với ảnh.
          Một khối duy nhất cho cả hai bố cục — nhân đôi nó là nhân đôi luôn ô
          `<input type="file">` mang id, tức hai phần tử cùng id trên một trang
          và `htmlFor` trỏ vào cái nào là chuyện của thứ tự DOM. */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        {/* `bg-card` (trắng) ghi đè nền mặc định của Avatar: bản dựng đầu để
            nguyên `bg-secondary`, mà `--secondary` VÀ `--surface` cùng là
            #eef7f1 — trên thẻ surface này, vòng tròn chữ cái đầu biến mất hẳn
            và chỉ còn một chữ "A" trôi giữa khoảng trắng (đo 2026-09-10:
            nền avatar và nền thẻ cùng rgb(238,247,241)). Hai chỗ gọi Avatar
            còn lại đứng trên nền TRẮNG nên giữ nguyên mặc định. */}
        <Avatar src={user.avatarUrl} name={user.displayName} size={96} className="bg-card" />
        <div className="min-w-0">
          {/* Dòng tên: lúc nghỉ là tên + bút chì; lúc sửa, khối DisplayNameEditor
              đứng THAY cả hai (ô nhập ở đúng chỗ cái tên, ✓/✕ ở chỗ bút chì).
              GẮN/GỠ chứ không truyền `open` xuống: bản nháp tên và lỗi tự khởi
              tạo lại mỗi lần mở, không cần effect nào đồng bộ chúng. */}
          <div className="flex items-center gap-1">
            {nameOpen ? (
              <DisplayNameEditor
                id={NAME_PANEL_ID}
                onClose={closeName}
                displayName={user.displayName}
                onSuccess={reportSuccess}
                onStatus={setStatus}
              />
            ) : (
              <>
                {/* <p>, KHÔNG phải heading: đây là DỮ LIỆU, không phải cấu trúc
                    tài liệu. */}
                <p className="text-foreground truncate text-xl font-semibold">{user.displayName}</p>
                {/* Bút chì ĐỨNG CẠNH cái tên nó sửa. `size-11` = sàn chạm 44px;
                    `-my-2` nuốt phần cao thừa để hàng tên không cao thêm vì một
                    cái nút. Ghost trên surface không đổi gì khi rê chuột (hover
                    của ghost là surface), nên hover tô TRẮNG như thẻ con.
                    aria-label bắt buộc: nút chỉ có biểu tượng. */}
                <button
                  ref={nameTriggerRef}
                  type="button"
                  aria-label={t("profile.name.change")}
                  onClick={() => setNameOpen(true)}
                  className={cn(
                    buttonVariants({ variant: "ghost", size: "icon" }),
                    "text-muted-foreground hover:bg-card -my-2"
                  )}
                >
                  <Pencil aria-hidden className="size-4" />
                </button>
              </>
            )}
          </div>
          <p className="text-muted-foreground truncate text-sm">
            <span className="sr-only">{t("profile.email.label")}: </span>
            {user.email}
          </p>
          <p className="text-muted-foreground text-xs">{t("profile.email.readOnly")}</p>
        </div>
        {/* NHÃN của bộ chọn tệp, không phải nút mở một khối trung gian: trình
            quản lý tệp của máy mở ngay từ cú chạm đầu tiên; khối bên dưới chỉ
            xuất hiện SAU khi đã có tệp. `<label htmlFor>` chứ không phải
            `<button onClick={input.click()}>`: nhãn mở hộp thoại tệp bằng hành
            vi gốc của trình duyệt, không phụ thuộc vào lượt kích hoạt của người
            dùng còn hiệu lực hay không ở thời điểm JS chạy. */}
        <div className="col-span-2 sm:col-span-1 sm:justify-self-end">
          {/* `peer sr-only`, KHÔNG `hidden`: sr-only giữ điểm dừng Tab và giữ ô
              này trong cây trợ năng, còn `hidden` thì xoá cả hai. */}
          <input
            ref={avatarInputRef}
            id={AVATAR_INPUT_ID}
            type="file"
            accept={AVATAR_LIMITS.ALLOWED_MIME.join(",")}
            onChange={handleAvatarPick}
            aria-describedby={AVATAR_HINT_ID}
            className="peer sr-only"
          />
          <label htmlFor={AVATAR_INPUT_ID} className={FILE_PICKER_CLS}>
            {t("profile.avatar.change")}
          </label>
          {/* Giới hạn định dạng/dung lượng cho người dùng trình đọc màn hình
              biết TRƯỚC khi vào thư viện ảnh. sr-only: thuộc tính `accept` đã
              lọc sẵn danh sách tệp cho người nhìn thấy được. */}
          <span id={AVATAR_HINT_ID} className="sr-only">
            {t(avatarHint.key, avatarHint.values)}
          </span>
        </div>
      </div>

      {/* GẮN/GỠ chứ không truyền `open` xuống: state bên trong (tệp đã chọn,
          lỗi) tự khởi tạo lại mỗi lần mở, nên không cần effect nào đồng bộ. */}
      {avatarFile && (
        <AvatarUploader
          id={AVATAR_PANEL_ID}
          file={avatarFile}
          onClose={closeAvatar}
          onSuccess={reportSuccess}
          onStatus={setStatus}
        />
      )}

      <div className="border-border mt-5 border-t pt-4">
        <PasswordRow onOpen={() => setDialogOpen(true)} triggerRef={passwordTriggerRef} />
      </div>

      {/* Đăng xuất đứng sau kẻ chia riêng và căn GIỮA (engineer 2026-09-10):
          nó không cùng họ với các hành động sửa ở trên — nó rời khỏi trang.
          Đứng giữa dưới một kẻ chia là cách nói điều đó bằng bố cục, và là
          ngoại lệ có chủ đích của quy tắc căn trái, giống dòng khép trang "Về
          MS-MOLAR" ở chân trang chủ. */}
      <div className="border-border mt-4 flex justify-center border-t pt-4">
        <SignOutButton />
      </div>

      {/* MỘT vùng polite cho cả thẻ, mang chữ "đang xử lý" hiện hành và rỗng khi
          rảnh. Nhãn của một nút aria-disabled mà người dùng KHÔNG đứng trên đó
          thì không được đọc lên một cách đáng tin. */}
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
    </Card>
  );
}
