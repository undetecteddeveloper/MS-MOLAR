"use client";

// AvatarUploader — BƯỚC HAI của việc đổi ảnh đại diện (/profile S-03): xem
// trước tệp đã chọn rồi mới Lưu.
//
// Bước MỘT (mở trình quản lý tệp) không ở đây — nó là `<input type="file">` +
// nhãn nằm ngay cạnh nút "Đổi ảnh" trong ProfileCard, và khối này chỉ được gắn
// vào cây SAU khi đã có tệp.
//
// HAI BƯỚC thì vẫn giữ, cố ý (UI-D11): chọn tệp KHÔNG upload. Một cú chạm nhầm
// trong thư viện ảnh điện thoại mà upload ngay là 2MB trên một mạng di động
// chập chờn, và người dùng không có cơ hội nhìn thứ sắp trở thành danh tính của
// mình trên header.
//
// Tệp là PROP, không phải state: ProfileCard giữ nó, nên khi upload hỏng thì
// tệp còn nguyên (AC-067). Kiểm MIME/kích thước ở client là PHÉP LỊCH SỰ, không
// phải chốt chặn (AC-030): nó gọi checkAvatarFile — ĐÚNG hàm thuần mà Server
// Action gọi. Kết quả kiểm là giá trị DẪN XUẤT từ prop `file` (useMemo).
//
// Theme "Sân trường" (2026-09-10): thẻ TRẮNG con trên thẻ surface, ảnh xem
// trước là hình TRÒN 64px — đúng hình nó sẽ mang trên header, không phải ô
// vuông kẻ khung như bản trước. Lỗi tô đỏ.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): changeAvatar/updateProfile/changePassword còn nằm chung file với signIn/signUp. Xem ARCHITECTURE.md § Import chéo.
import { changeAvatar, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { checkAvatarFile } from "@/lib/profile/validateAvatar";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { profileMessage, resolveActionError, type ProfileMessage } from "@/features/profile/components/errorMessages";

/** Chặn trên quay-mãi-không-dừng (AC-067) — cùng con số với hộp thoại mật khẩu. */
const UPLOAD_TIMEOUT_MS = 20000;

const ERROR_ID = "profile-avatar-error";

interface AvatarUploaderProps {
  /** Đích của `aria-controls` trên nút mở, nút đó nằm ở ProfileCard. */
  id: string;
  /** Tệp người dùng vừa chọn. ProfileCard sở hữu nó và chỉ gắn khối này khi
   *  đã có tệp — nên ở đây nó không bao giờ null. */
  file: File;
  onClose: () => void;
  onSuccess: (key: MessageKey) => void;
  onStatus: (message: ProfileMessage | null) => void;
}

export function AvatarUploader({ id, file, onClose, onSuccess, onStatus }: AvatarUploaderProps) {
  const router = useRouter();
  const [error, setError] = useState<ProfileMessage | null>(null);
  const [uploading, setUploading] = useState(false);

  // Kết luận từ chối phía client — DẪN XUẤT từ `file`, xem đầu file.
  const rejection = useMemo(() => {
    const check = checkAvatarFile({ type: file.type, size: file.size });
    if (check.ok) return null;
    return profileMessage(
      check.reason === "too_large" ? "profile.avatar.tooLarge" : "profile.avatar.invalidType"
    );
  }, [file]);

  // Lỗi hiển thị: từ chối phía client thắng lỗi server cũ — tệp đã đổi thì kết
  // cục của lần gửi trước không còn nói về thứ đang nằm trên màn hình nữa.
  const shownError = rejection ?? error;

  const uploadingRef = useRef(false);
  const attemptIdRef = useRef(0);

  // Tạo URL ĐỒNG BỘ trong render, không setState trong effect: tệp đổi thì ảnh
  // xem trước đổi theo ngay trong cùng lượt render. Tệp bị từ chối thì KHÔNG
  // tạo URL: không có ảnh xem trước cho thứ sẽ không được gửi đi.
  const previewUrl = useMemo(
    () => (rejection ? null : URL.createObjectURL(file)),
    [file, rejection]
  );
  // ⚠ THU HỒI Ở `onLoad` CỦA CHÍNH ẢNH, KHÔNG ở cleanup của một effect.
  //
  // Bản trước thu hồi trong cleanup, và ảnh xem trước KHÔNG BAO GIỜ hiện ra khi
  // chạy `next dev`: React StrictMode chạy effect hai lần (gắn → dọn → gắn
  // lại), lượt dọn thu hồi URL, còn `useMemo` không tính lại vì phụ thuộc không
  // đổi — nên thẻ <img> giữ một blob URL đã chết. Đo 2026-09-10 trên dev:
  // `naturalWidth = 0` với src `blob:http://localhost:3000/…`, trong khi một
  // blob URL tạo mới ngay tại đó tải bình thường (64px). Lỗi này có TỪ TRƯỚC
  // đợt refactor (cùng vòng đời URL), chỉ lộ ra khi chụp ảnh trạng thái.
  //
  // Thu hồi ngay sau khi trình duyệt giải mã xong là đúng lúc: từ đó ảnh đã
  // nằm trong bộ nhớ của thẻ <img>, URL không còn việc gì. Không cần effect,
  // nên StrictMode chạy bao nhiêu lượt cũng không đụng tới nó.
  function releasePreview(e: React.SyntheticEvent<HTMLImageElement>) {
    URL.revokeObjectURL(e.currentTarget.src);
  }

  async function handleSave() {
    if (uploadingRef.current || rejection) return;

    uploadingRef.current = true;
    setUploading(true);
    setError(null);
    onStatus(profileMessage("profile.avatar.uploading"));
    const attemptId = ++attemptIdRef.current;

    try {
      const formData = new FormData();
      // Tên trường PHẢI là "avatar" — changeAvatar đọc đúng khoá này.
      formData.set("avatar", file);

      const outcome = await Promise.race<AuthState | "timeout">([
        changeAvatar(null, formData),
        new Promise<"timeout">((resolve) => {
          setTimeout(() => resolve("timeout"), UPLOAD_TIMEOUT_MS);
        }),
      ]);

      if (attemptIdRef.current !== attemptId) return;

      if (outcome === "timeout") {
        setError(profileMessage("profile.error.network"));
        return;
      }
      if (outcome === null) {
        onClose();
        onSuccess("profile.avatar.saved");
        // Ảnh mới xuất hiện ở /profile VÀ trên SiteHeader mà không cần tải lại
        // trang (AC-071) — mọi chỗ hiển thị đều đọc từ hàng profile ở server.
        router.refresh();
        return;
      }
      // GIỮ NGUYÊN tệp đã chọn: người dùng trên mạng di động rớt sóng thử lại
      // bằng một cú chạm, không phải bằng một chuyến đi lại vào thư viện ảnh.
      setError(resolveActionError(outcome.error ?? ""));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onStatus(null);
    }
  }

  return (
    <Card id={id} variant="plain" padding="compact" className="motion-unfold mt-4 gap-3">
      <p className="eyebrow">{t("profile.avatar.label")}</p>

      {shownError && (
        <p id={ERROR_ID} role="alert" className="text-destructive text-sm">
          {t(shownError.key, shownError.values)}
        </p>
      )}

      {previewUrl && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL tạm của tệp vừa chọn, không phải ảnh Storage và không qua next/image */}
          <img
            src={previewUrl}
            alt=""
            onLoad={releasePreview}
            className="size-16 shrink-0 rounded-full object-cover"
          />
          <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">{file.name}</span>
        </div>
      )}

      {/* Căn TRÁI, cùng lý do với hàng nút của DisplayNameEditor: khối inline
          trong thẻ theo quy tắc căn trái, và hàng nút căn phải rơi đúng vào
          vùng nút hỗ trợ nổi ở 360px. */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onClose}
          className={buttonVariants({ variant: "secondary", size: "sm" })}
        >
          {t("common.cancel")}
        </button>
        {/* Không có nút Lưu cho một tệp đã bị từ chối: lối thoát duy nhất là
            Huỷ rồi chọn lại, và bộ chọn nằm ngay trên đầu thẻ. */}
        {!rejection && (
          <button
            type="button"
            aria-disabled={uploading}
            onClick={handleSave}
            className={cn(buttonVariants({ size: "sm" }), "aria-disabled:opacity-60")}
          >
            {uploading ? t("profile.avatar.uploading") : t("common.save")}
          </button>
        )}
      </div>
    </Card>
  );
}
