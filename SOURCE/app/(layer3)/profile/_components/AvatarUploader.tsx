"use client";

// AvatarUploader — đổi ảnh đại diện (/profile S-03).
//
// HAI BƯỚC, cố ý (UI-D11): chọn tệp KHÔNG upload. Một cú chạm nhầm trong thư
// viện ảnh điện thoại mà upload ngay là 2MB trên một mạng di động chập chờn, và
// người dùng không có cơ hội nhìn thứ sắp trở thành danh tính của mình trên
// header — tính năng này không có bước cắt/xoay/nén nào để sửa lại.
//
// CHÉP THEO MẪU bộ chọn tệp của components/support/ScreenshotAttachment.tsx:89-108:
//   - input thật là `peer sr-only` — SR-ONLY chứ không phải `hidden`, để nó giữ
//     điểm dừng Tab và ở lại trong cây a11y; nhãn hiển thị phản chiếu focus của
//     nó qua `peer-focus-visible:*`. Nó cũng gạt bỏ chuỗi "No file chosen" mà
//     trình duyệt tự chèn — thứ không dịch được và không style được;
//   - `e.target.value = ""` sau mỗi lần đổi, nếu không thì chọn LẠI đúng tệp
//     vừa gỡ sẽ im lặng không làm gì (onChange chỉ bắn khi giá trị đổi);
//   - object URL tạo trong useMemo, thu hồi trong cleanup của effect.
//
// Kiểm MIME/kích thước ở client là PHÉP LỊCH SỰ, không phải chốt chặn (AC-030):
// nó gọi checkAvatarFile — ĐÚNG hàm thuần mà Server Action gọi — nên hai bên
// không thể lệch luật, nhưng một POST tự chế chưa từng chạy qua đây vẫn bị
// server từ chối.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { changeAvatar, type AuthState } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { AVATAR_LIMITS } from "@/lib/profile/limits";
import { checkAvatarFile } from "@/lib/profile/validateAvatar";
import { ProfileRow } from "./ProfileRow";
import { profileMessage, resolveActionError, type ProfileMessage } from "./errorMessages";
import { actionRowCls, fieldErrorCls, fieldHintCls, outlineButtonCls } from "./styles";

/** Chặn trên quay-mãi-không-dừng (AC-067) — cùng con số với hộp thoại mật khẩu. */
const UPLOAD_TIMEOUT_MS = 20000;

const INPUT_ID = "profile-avatar";
const HINT_ID = "profile-avatar-hint";
const ERROR_ID = "profile-avatar-error";

interface AvatarUploaderProps {
  onSuccess: (key: MessageKey) => void;
  onStatus: (message: ProfileMessage | null) => void;
}

export function AvatarUploader({ onSuccess, onStatus }: AvatarUploaderProps) {
  const t = useT();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<ProfileMessage | null>(null);
  const [uploading, setUploading] = useState(false);

  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const uploadingRef = useRef(false);
  const attemptIdRef = useRef(0);
  const returnFocusRef = useRef(false);

  // Trả focus về nút "Đổi ảnh" phải đợi nút đó MỌC LẠI: khi hàng đang mở, nút
  // không được render, nên `changeButtonRef.current` là null và một lệnh focus()
  // gọi ngay trong hàm thu gọn sẽ rơi vào khoảng không.
  useEffect(() => {
    if (!expanded && returnFocusRef.current) {
      returnFocusRef.current = false;
      changeButtonRef.current?.focus();
    }
  }, [expanded]);

  // Tạo URL ĐỒNG BỘ trong render, không setState trong effect: effect bên dưới
  // chỉ còn việc dọn dẹp, nên không có lượt render thừa nào ở trạng thái "chưa
  // có ảnh xem trước" (react-hooks/set-state-in-effect).
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;

    const check = checkAvatarFile({ type: picked.type, size: picked.size });
    if (!check.ok) {
      setFile(null);
      setError(
        profileMessage(
          check.reason === "too_large" ? "profile.avatar.tooLarge" : "profile.avatar.invalidType"
        )
      );
      return;
    }

    setFile(picked);
    setError(null);
    onStatus({ key: "profile.avatar.selected", values: { name: picked.name } });
  }

  function collapse() {
    returnFocusRef.current = true;
    setExpanded(false);
    setFile(null);
    setError(null);
    onStatus(null);
  }

  async function handleSave() {
    if (uploadingRef.current || !file) return;

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
        // Nút Lưu vừa biến mất cùng khối mở rộng — không trả focus thì nó rơi
        // xuống <body>.
        returnFocusRef.current = true;
        setExpanded(false);
        setFile(null);
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

  const hint = profileMessage("profile.avatar.hint");
  const hintText = t(hint.key, hint.values);

  if (!expanded) {
    return (
      <ProfileRow
        label={t("profile.avatar.label")}
        action={
          <button
            ref={changeButtonRef}
            type="button"
            onClick={() => setExpanded(true)}
            className={outlineButtonCls}
          >
            {t("profile.avatar.change")}
          </button>
        }
      >
        <span className="text-muted-foreground">{hintText}</span>
      </ProfileRow>
    );
  }

  return (
    <ProfileRow
      label={t("profile.avatar.label")}
      expanded={
        <div>
          <input
            id={INPUT_ID}
            type="file"
            accept={AVATAR_LIMITS.ALLOWED_MIME.join(",")}
            onChange={handlePick}
            aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
            className="peer sr-only"
          />
          <label
            htmlFor={INPUT_ID}
            className="border-border bg-card text-foreground hover:bg-accent peer-focus-visible:border-ring peer-focus-visible:ring-ring/50 inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-[4px] border px-4 py-2 text-sm transition-colors peer-focus-visible:ring-3"
          >
            {t("profile.avatar.chooseFile")}
          </label>
          <p id={HINT_ID} className={fieldHintCls}>
            {hintText}
          </p>

          {error && (
            <p id={ERROR_ID} role="alert" className={fieldErrorCls}>
              {t(error.key, error.values)}
            </p>
          )}

          {file && previewUrl && (
            <div className="mt-4 flex items-center gap-3">
              {/* Khung nhấn mạnh `border-2` đi kèm `p-[7px]` bù lại đúng 1px mà
                  viền dày thêm chiếm (khuôn AnswerChoice.tsx:30) — trạng thái
                  nghỉ tương ứng là `border p-2`. Không bù thì mọi thứ phía sau
                  bị đẩy đi 1px mỗi lần khung xuất hiện. */}
              <span className="border-ring inline-flex rounded-[4px] border-2 p-[7px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob: URL tạm của tệp vừa chọn, không phải ảnh Storage và không qua next/image */}
                <img
                  src={previewUrl}
                  alt=""
                  className="size-16 rounded-[4px] object-cover"
                />
              </span>
              <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">
                {file.name}
              </span>
            </div>
          )}

          <div className={actionRowCls}>
            <button type="button" onClick={collapse} className={outlineButtonCls}>
              {t("common.cancel")}
            </button>
            {file && (
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
      }
    />
  );
}
