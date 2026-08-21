"use client";

// AvatarUploader — BƯỚC HAI của việc đổi ảnh đại diện (/profile S-03): xem
// trước tệp đã chọn rồi mới Lưu.
//
// Bước MỘT (mở trình quản lý tệp) không còn ở đây — nó là `<input type="file">`
// + nhãn nằm ngay cạnh nút "Đổi ảnh" trong ProfileCard, và khối này chỉ được
// gắn vào cây SAU khi đã có tệp. Trước 2026-08-21 cả hai bước cùng nằm trong
// khối này, nghĩa là bấm "Đổi ảnh" mở ra một khối chứa đúng một nút "Chọn ảnh":
// một cú chạm thừa không cho người dùng thêm thông tin hay lựa chọn nào.
//
// HAI BƯỚC thì vẫn giữ, cố ý (UI-D11): chọn tệp KHÔNG upload. Một cú chạm nhầm
// trong thư viện ảnh điện thoại mà upload ngay là 2MB trên một mạng di động
// chập chờn, và người dùng không có cơ hội nhìn thứ sắp trở thành danh tính của
// mình trên header — tính năng này không có bước cắt/xoay/nén nào để sửa lại.
//
// Tệp là PROP, không phải state: ProfileCard giữ nó, nên khi upload hỏng thì
// tệp còn nguyên mà không cần khối này tự canh giữ điều gì (AC-067). Object URL
// vẫn tạo trong useMemo và thu hồi trong cleanup của effect.
//
// Kiểm MIME/kích thước ở client là PHÉP LỊCH SỰ, không phải chốt chặn (AC-030):
// nó gọi checkAvatarFile — ĐÚNG hàm thuần mà Server Action gọi — nên hai bên
// không thể lệch luật, nhưng một POST tự chế chưa từng chạy qua đây vẫn bị
// server từ chối. Kết quả kiểm là giá trị DẪN XUẤT từ prop `file` (useMemo),
// không phải state đặt trong effect: tệp đổi thì kết luận đổi theo ngay trong
// cùng lượt render, không có khung hình nào hiện nút "Lưu" cho một tệp vừa bị
// từ chối.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeAvatar, type AuthState } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { checkAvatarFile } from "@/lib/profile/validateAvatar";
import { profileMessage, resolveActionError, type ProfileMessage } from "./errorMessages";
import { actionRowCls, fieldErrorCls, outlineButtonCls } from "./styles";

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

/** Khối xem trước + Lưu. Trạng thái mở/đóng và việc trả focus thuộc về
 *  ProfileCard — bộ chọn tệp nằm trong cụm danh tính đầu thẻ, tách khỏi khối
 *  này trong cây DOM. ProfileCard GẮN/GỠ component này thay vì truyền `open`,
 *  nên lỗi cũ của lần upload trước không sống sót qua một lần đóng. */
export function AvatarUploader({ id, file, onClose, onSuccess, onStatus }: AvatarUploaderProps) {
  const t = useT();
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

  // Tạo URL ĐỒNG BỘ trong render, không setState trong effect: effect bên dưới
  // chỉ còn việc dọn dẹp, nên không có lượt render thừa nào ở trạng thái "chưa
  // có ảnh xem trước" (react-hooks/set-state-in-effect).
  // Tệp bị từ chối thì KHÔNG tạo URL: không có ảnh xem trước cho thứ sẽ không
  // được gửi đi, và cũng không có blob nào phải thu hồi.
  const previewUrl = useMemo(
    () => (rejection ? null : URL.createObjectURL(file)),
    [file, rejection]
  );
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

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
        // Nút Lưu biến mất cùng khối này — ProfileCard xoá tệp và trả tiêu điểm
        // về bộ chọn, thứ vẫn còn trong cây.
        onClose();
        onSuccess("profile.avatar.saved");
        // Ảnh mới xuất hiện ở /profile VÀ trên SiteHeader mà không cần tải lại
        // trang (AC-071) — mọi chỗ hiển thị đều đọc từ hàng profile ở server.
        router.refresh();
        return;
      }
      // GIỮ NGUYÊN tệp đã chọn: người dùng trên mạng di động rớt sóng thử lại
      // bằng một cú chạm, không phải bằng một chuyến đi lại vào thư viện ảnh
      // (AC-067).
      setError(resolveActionError(outcome.error ?? ""));
    } finally {
      uploadingRef.current = false;
      setUploading(false);
      onStatus(null);
    }
  }

  return (
    <div id={id} className="border-border mt-4 border-t pt-4">
      <p className="eyebrow block">{t("profile.avatar.label")}</p>
      <div className="mt-2">
        {shownError && (
          <p id={ERROR_ID} role="alert" className={fieldErrorCls}>
            {t(shownError.key, shownError.values)}
          </p>
        )}

        {previewUrl && (
          <div className="flex items-center gap-3">
            {/* Khung nhấn mạnh `border-2` đi kèm `p-[7px]` bù lại đúng 1px mà
                viền dày thêm chiếm (khuôn AnswerChoice.tsx:30) — trạng thái
                nghỉ tương ứng là `border p-2`. Không bù thì mọi thứ phía sau
                bị đẩy đi 1px mỗi lần khung xuất hiện. */}
            <span className="border-ring inline-flex rounded-[4px] border-2 p-[7px]">
              {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL tạm của tệp vừa chọn, không phải ảnh Storage và không qua next/image */}
              <img src={previewUrl} alt="" className="size-16 rounded-[4px] object-cover" />
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
              {file.name}
            </span>
          </div>
        )}

        <div className={actionRowCls}>
          <button type="button" onClick={onClose} className={outlineButtonCls}>
            {t("common.cancel")}
          </button>
          {/* Không có nút Lưu cho một tệp đã bị từ chối: lối thoát duy nhất là
              Huỷ rồi chọn lại, và bộ chọn nằm ngay trên đầu thẻ. */}
          {!rejection && (
            <button
              type="button"
              aria-disabled={uploading}
              onClick={handleSave}
              className={outlineButtonCls}
            >
              {uploading ? t("profile.avatar.uploading") : t("common.save")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
