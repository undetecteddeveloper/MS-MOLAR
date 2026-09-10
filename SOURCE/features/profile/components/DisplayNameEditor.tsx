"use client";

// DisplayNameEditor — sửa tên hiển thị ngay trong thẻ (/profile S-04).
//
// Gọi `updateProfile` NGUYÊN TRẠNG (PRD D6, AC-046): ba luật (không rỗng, ≤12
// ký tự, chỉ chữ cái + dấu chấm) chỉ có MỘT bản cài đặt phía server, và file
// này không thêm bản thứ hai. Bộ lọc lúc gõ dưới đây là tiện nghi — nó dùng
// chính filterDisplayNameInput mà server dùng hằng số.
//
// `updateProfile` trả câu TIẾNG ANH viết cứng, không phải khoá từ điển — nên
// câu đó được dịch ở client qua resolveDisplayNameError (UI-D9), và một cổng
// build canh cho bản đồ ấy không trôi (xem __tests__/errorMessages.test.ts).
//
// Theme "Sân trường" (2026-09-10): thẻ TRẮNG con trên thẻ surface, tỏ dần bằng
// `.motion-unfold`; ô nhập là primitive Input/Label; lỗi tô ĐỎ (bản trước tô
// `text-brand`, mà brand nay là xanh lá — một câu lỗi màu "đúng").

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): changeAvatar/updateProfile/changePassword còn nằm chung file với signIn/signUp. Xem ARCHITECTURE.md § Import chéo.
import { updateProfile, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { DISPLAY_NAME_MAX, filterDisplayNameInput } from "@/lib/profile/displayName";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { resolveDisplayNameError, type ProfileMessage } from "@/features/profile/components/errorMessages";

const INPUT_ID = "profile-display-name";
const HINT_ID = "profile-display-name-hint";
const ERROR_ID = "profile-display-name-error";

interface DisplayNameEditorProps {
  /** Đích của `aria-controls` trên nút bút chì, nút đó nằm ở ProfileCard. */
  id: string;
  onClose: () => void;
  displayName: string;
  onSuccess: (key: MessageKey) => void;
  onStatus: (message: ProfileMessage | null) => void;
}

/** Khối sửa tên. Trạng thái mở/đóng và việc trả focus thuộc về ProfileCard —
 *  bút chì nằm cạnh cái tên trong cụm danh tính, tách khỏi khối này trong cây.
 *  ProfileCard GẮN/GỠ component này thay vì truyền `open` xuống: nhờ vậy
 *  `useState(displayName)` tự khởi tạo đúng ở mỗi lần mở. */
export function DisplayNameEditor({
  id,
  onClose,
  displayName,
  onSuccess,
  onStatus,
}: DisplayNameEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState(displayName);
  const submittingRef = useRef(false);

  // Kết cục được xử lý NGAY TRONG action, không qua useEffect nghe lằn ranh
  // pending true→false: `updateProfile` trả `null` khi thành công, mà `null`
  // cũng là state khởi tạo. Bọc như thế này KHÔNG phải cài đặt lại action —
  // `updateProfile` vẫn là nơi DUY NHẤT quyết định ba luật (AC-046).
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    async (prev, formData) => {
      onStatus({ key: "common.saving" });
      try {
        const result = await updateProfile(prev, formData);
        if (!result?.error) {
          onClose();
          onSuccess("profile.name.saved");
          // Đẩy tên mới ra thẻ /profile và SiteHeader mà không bắt người dùng
          // tự tải lại trang (AC-047).
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

  function cancel() {
    onStatus(null);
    onClose();
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

  const error = state?.error ? resolveDisplayNameError(state.error) : null;
  const saveBlocked = pending || draft.trim().length === 0;

  return (
    <Card id={id} variant="plain" padding="compact" className="motion-unfold mt-4 gap-0">
      <form action={formAction} onSubmit={handleSubmit}>
        <Label htmlFor={INPUT_ID}>{t("common.displayName")}</Label>
        <Input
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
        />
        <p id={HINT_ID} className="text-muted-foreground mt-1.5 text-xs">
          {t("common.displayNameHint")}
        </p>
        {error && (
          <p id={ERROR_ID} role="alert" className="text-destructive mt-1.5 text-sm">
            {t(error.key, error.values)}
          </p>
        )}
        {/* Căn TRÁI (§3 "căn trái toàn bộ"), không phải căn phải như hàng nút
            của một hộp thoại: đây là khối inline trong thẻ, không phải hộp
            thoại. Và có lý do đo được — nút hỗ trợ nổi ở góc dưới phải (z-45):
            với hàng nút căn phải, "Lưu" nằm 252–312 × 586–622 ở 360×740 còn nút
            hỗ trợ 288–344 × 608–664, tức góc phải nút Lưu bị đè 24×14px. Căn
            trái thì "Huỷ"/"Lưu" kết thúc ở x≈180, cách nút hỗ trợ hơn 100px. */}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={cancel}
            className={buttonVariants({ variant: "secondary", size: "sm" })}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            aria-disabled={saveBlocked}
            className={cn(buttonVariants({ size: "sm" }), "aria-disabled:opacity-60")}
          >
            {pending ? t("common.saving") : t("common.save")}
          </button>
        </div>
      </form>
    </Card>
  );
}
