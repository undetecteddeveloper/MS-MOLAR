"use client";

// ResetPasswordForm — form đặt mật khẩu mới (Layer 1, S#23). User tới đây từ
// link email reset (recovery session đã có nhờ /auth/callback). Submit →
// updatePassword Server Action → redirect /exams.
// S#24: mỗi field có toggle hiện/ẩn mật khẩu RIÊNG (New/Confirm độc lập nhau).
//
// Theme "Sân trường" (2026-09-10): thẻ surface, ô nhập là primitive Input với
// nhãn phía trên (cùng khuôn `Field` của AuthForm), nút mắt nằm trong ô, gợi
// ý độ dài hiện SẴN dưới ô đầu, lỗi tô đỏ, nút xanh 52px trải hết bề ngang
// dưới 640px. Hết mã màu kem/đỏ son của theme cũ.

import { useActionState, useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { updatePassword, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

export function ResetPasswordForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, null);

  return (
    <Card as="section">
      <form action={formAction} className="flex flex-col gap-4">
        <PasswordField
          id="password"
          name="password"
          label={t("auth.newPassword")}
          hint={t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
        />
        <PasswordField id="confirm" name="confirm" label={t("auth.confirmNewPassword")} />

        {state?.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={pending} className="w-full sm:w-auto sm:self-start">
          {pending ? t("common.saving") : t("auth.setNewPassword")}
        </Button>
      </form>
    </Card>
  );
}

function PasswordField({
  id,
  name,
  label,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  /** Câu gợi ý hiện ngay dưới ô. Bỏ trống thì không render gì. */
  hint?: string;
}) {
  const [show, setShow] = useState(false);
  const hintId = `${useId()}-hint`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          // Lấy từ hằng số chung, KHÔNG viết số cứng: bản cũ ghi 6 trong khi
          // server bắt 10, nên trình duyệt cho gửi rồi server mới từ chối.
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete="new-password"
          aria-describedby={hint ? hintId : undefined}
          className="pr-12"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
          className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full focus-visible:ring-3 focus-visible:outline-none"
        >
          {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="text-muted-foreground mt-1.5 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}
