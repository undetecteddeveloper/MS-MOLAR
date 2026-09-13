"use client";

// DisplayNameEditor — sửa tên hiển thị NGAY TRÊN DÒNG TÊN của thẻ /profile (S-04).
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
// Bố cục (engineer 2026-09-13, test trên điện thoại thật): ô nhập đứng ĐÚNG CHỖ
// cái tên, hai nút Lưu (✓) / Huỷ (✕) 36px kề bên — không phải một thẻ con mọc ra
// bên dưới cụm danh tính như bản 2026-09-10. Người dùng bấm bút chì cạnh cái tên
// thì chờ đợi được gõ vào đúng chỗ ấy. Gợi ý và câu lỗi đứng dưới dòng nhập,
// trong cùng khối form, nên vẫn nối được bằng aria-describedby. Ô nhập 40px
// (không phải 44px mặc định của Input): nó thay một dòng chữ 28px, cao thêm nữa
// thì email và ghi chú bên dưới tụt xuống rõ rệt mỗi lần bấm bút chì. Nút 36px
// là cỡ nút-trong-thẻ đã có (⋯ của Lịch sử), không phải một cỡ mới.

import { useActionState, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): changeAvatar/updateProfile/changePassword còn nằm chung file với signIn/signUp. Xem ARCHITECTURE.md § Import chéo.
import { updateProfile, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import { DISPLAY_NAME_MAX, filterDisplayNameInput } from "@/lib/profile/displayName";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { resolveDisplayNameError, type ProfileMessage } from "@/features/profile/components/errorMessages";

const INPUT_ID = "profile-display-name";
const HINT_ID = "profile-display-name-hint";
const ERROR_ID = "profile-display-name-error";

interface DisplayNameEditorProps {
  /** id của khối form — ProfileCard giữ hằng số này. */
  id: string;
  onClose: () => void;
  displayName: string;
  onSuccess: (key: MessageKey) => void;
  onStatus: (message: ProfileMessage | null) => void;
}

/** Khối sửa tên, đứng thay dòng tên trong cụm danh tính. Trạng thái mở/đóng và
 *  việc trả focus thuộc về ProfileCard. ProfileCard GẮN/GỠ component này thay
 *  vì truyền `open` xuống: nhờ vậy `useState(displayName)` tự khởi tạo đúng ở
 *  mỗi lần mở. */
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
    <form
      id={id}
      action={formAction}
      onSubmit={handleSubmit}
      className="motion-unfold flex min-w-0 flex-1 flex-col gap-1.5"
    >
      <div className="flex items-center gap-1">
        {/* Nhãn sr-only: ô đứng đúng chỗ cái tên và mang chính cái tên làm
            giá trị, một nhãn nhìn thấy được ở đây là chữ thừa trên một dòng
            chật. Trình đọc màn hình vẫn có "Tên hiển thị". */}
        <Label htmlFor={INPUT_ID} className="sr-only">
          {t("common.displayName")}
        </Label>
        <Input
          id={INPUT_ID}
          name="displayName"
          value={draft}
          onChange={(e) => setDraft(filterDisplayNameInput(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          maxLength={DISPLAY_NAME_MAX}
          autoFocus
          // readOnly + aria-disabled thay cho `disabled` gốc: người dùng có
          // thể đang đứng ngay trên ô này lúc bấm Lưu, và một control bị
          // disabled gốc sẽ đánh rơi focus xuống <body> giữa chừng.
          readOnly={pending}
          aria-disabled={pending}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${HINT_ID} ${ERROR_ID}` : HINT_ID}
          className="h-10 min-w-0 flex-1 px-3 text-base font-semibold"
        />
        <button
          type="submit"
          aria-disabled={saveBlocked}
          aria-label={pending ? t("common.saving") : t("common.save")}
          className={cn(buttonVariants({ size: "icon-sm" }), "shrink-0 aria-disabled:opacity-60")}
        >
          <Check aria-hidden className="size-4" />
        </button>
        <button
          type="button"
          onClick={cancel}
          aria-label={t("common.cancel")}
          className={cn(buttonVariants({ variant: "plain", size: "icon-sm" }), "shrink-0")}
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
      <p id={HINT_ID} className="text-muted-foreground text-xs">
        {t("common.displayNameHint")}
      </p>
      {error && (
        <p id={ERROR_ID} role="alert" className="text-destructive text-sm">
          {t(error.key, error.values)}
        </p>
      )}
    </form>
  );
}
