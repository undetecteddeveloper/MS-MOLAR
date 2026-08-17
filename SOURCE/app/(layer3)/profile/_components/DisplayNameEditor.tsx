"use client";

// DisplayNameEditor — sửa tên hiển thị ngay trong hàng (/profile S-04).
//
// Gọi `updateProfile` NGUYÊN TRẠNG (PRD D6, AC-046): ba luật (không rỗng, ≤12
// ký tự, chỉ chữ cái + dấu chấm) chỉ có MỘT bản cài đặt phía server, và file
// này không thêm bản thứ hai. Bộ lọc lúc gõ dưới đây là tiện nghi — nó dùng
// chính filterDisplayNameInput mà server dùng hằng số, chứ không viết lại
// `/[^\p{L}.]/gu` thành bản sao thứ ba.
//
// `updateProfile` trả câu TIẾNG ANH viết cứng, không phải khoá i18n — nên câu
// đó được dịch ở client qua resolveDisplayNameError (UI-D9), và một cổng build
// canh cho bản đồ ấy không trôi (xem __tests__/errorMessages.test.ts).

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, type AuthState } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";
import { DISPLAY_NAME_MAX, filterDisplayNameInput } from "@/lib/profile/displayName";
import { ProfileRow } from "./ProfileRow";
import { resolveDisplayNameError, type ProfileMessage } from "./errorMessages";
import {
  actionRowCls,
  fieldErrorCls,
  fieldHintCls,
  fieldInputCls,
  outlineButtonCls,
} from "./styles";

const INPUT_ID = "profile-display-name";
const HINT_ID = "profile-display-name-hint";
const ERROR_ID = "profile-display-name-error";

interface DisplayNameEditorProps {
  displayName: string;
  onSuccess: (key: MessageKey) => void;
  onStatus: (message: ProfileMessage | null) => void;
}

export function DisplayNameEditor({ displayName, onSuccess, onStatus }: DisplayNameEditorProps) {
  const t = useT();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(displayName);
  const submittingRef = useRef(false);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef(false);

  // Trả focus về nút "Đổi tên" phải đợi nút đó MỌC LẠI: trong lúc sửa, nút
  // không được render, nên `changeButtonRef.current` là null và một lệnh
  // focus() gọi ngay trong hàm huỷ sẽ rơi vào khoảng không — focus tụt xuống
  // <body> và người dùng bàn phím mất chỗ đứng giữa trang.
  // Effect này KHÔNG gọi setState, nên nó không phạm react-hooks/set-state-in-effect.
  useEffect(() => {
    if (!editing && returnFocusRef.current) {
      returnFocusRef.current = false;
      changeButtonRef.current?.focus();
    }
  }, [editing]);

  // Kết cục được xử lý NGAY TRONG action, không qua useEffect nghe lằn ranh
  // pending true→false (khuôn cũ ở HeaderProfile.tsx:33-41). Hai lý do:
  //   - `updateProfile` trả `null` khi thành công, mà `null` cũng là state khởi
  //     tạo — nghe qua effect thì phải thêm một ref "đã từng pending" chỉ để
  //     phân biệt "vừa lưu xong" với "chưa bấm gì";
  //   - setState đồng bộ trong thân effect sinh cascading render và bị
  //     `react-hooks/set-state-in-effect` chặn ở cổng lint.
  // Bọc như thế này KHÔNG phải cài đặt lại action: `updateProfile` được gọi
  // nguyên trạng và vẫn là nơi DUY NHẤT quyết định ba luật (AC-046).
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    async (prev, formData) => {
      onStatus({ key: "common.saving" });
      try {
        const result = await updateProfile(prev, formData);
        if (!result?.error) {
          // Nút Lưu vừa biến mất cùng trình sửa — không trả focus thì nó rơi
          // xuống <body>.
          returnFocusRef.current = true;
          setEditing(false);
          onSuccess("profile.name.saved");
          // Đẩy tên mới ra thẻ /profile, SiteHeader và HomeSidebar mà không bắt
          // người dùng tự tải lại trang (AC-047).
          router.refresh();
        }
        return result;
      } finally {
        submittingRef.current = false;
        onStatus(null);
      }
    },
    null
  );

  function startEditing() {
    setDraft(displayName);
    setEditing(true);
  }

  function cancel() {
    returnFocusRef.current = true;
    setEditing(false);
    setDraft(displayName);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    // Chốt ĐỒNG BỘ: hai lần Enter trong cùng một tick đều đọc thấy `pending`
    // còn false, vì React chưa kịp commit lần setState nào.
    if (submittingRef.current || draft.trim().length === 0) {
      e.preventDefault();
      return;
    }
    submittingRef.current = true;
  }

  const label = t("common.displayName");

  if (!editing) {
    return (
      <ProfileRow
        label={label}
        action={
          <button
            ref={changeButtonRef}
            type="button"
            onClick={startEditing}
            className={outlineButtonCls}
          >
            {t("profile.name.change")}
          </button>
        }
      >
        {displayName}
      </ProfileRow>
    );
  }

  const error = state?.error ? resolveDisplayNameError(state.error) : null;
  const saveBlocked = pending || draft.trim().length === 0;

  return (
    <ProfileRow
      label={label}
      labelFor={INPUT_ID}
      expanded={
        <form action={formAction} onSubmit={handleSubmit}>
          <input
            id={INPUT_ID}
            name="displayName"
            value={draft}
            onChange={(e) => setDraft(filterDisplayNameInput(e.target.value))}
            maxLength={DISPLAY_NAME_MAX}
            autoFocus
            // readOnly + aria-disabled thay cho `disabled` gốc: người dùng có
            // thể đang đứng ngay trên ô này lúc bấm Lưu, và một control bị
            // disabled gốc sẽ đánh rơi focus xuống <body> giữa chừng.
            readOnly={pending}
            aria-disabled={pending}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
            className={fieldInputCls(error !== null)}
          />
          <p id={HINT_ID} className={fieldHintCls}>
            {t("common.displayNameHint")}
          </p>
          {error && (
            <p id={ERROR_ID} role="alert" className={fieldErrorCls}>
              {t(error.key, error.values)}
            </p>
          )}
          <div className={actionRowCls}>
            <button type="button" onClick={cancel} className={outlineButtonCls}>
              {t("common.cancel")}
            </button>
            <button type="submit" aria-disabled={saveBlocked} className={outlineButtonCls}>
              {pending ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      }
    />
  );
}
