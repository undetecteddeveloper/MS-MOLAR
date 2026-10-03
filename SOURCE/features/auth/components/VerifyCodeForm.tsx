// View nhập mã xác minh email — `/?auth=verify`, mở sau khi bấm Đăng ký. Nằm
// TRONG thẻ đăng nhập của trang chủ (cùng chỗ với view "Quên mật khẩu"), không
// phải trang riêng. Chỉ đường email/mật khẩu đi qua đây: Google/Facebook đã được
// nhà cung cấp xác minh email nên vào thẳng /exams.
//
//  - Email điền sẵn từ bước đăng ký (`?email=`); mở thẳng trang không có email
//    thì hiện ô nhập email.
//  - "Gửi lại mã" có đếm ngược 60 giây (chặn bấm dồn ở client; server còn có
//    rate limit riêng theo email — actions.ts).
//  - "Đổi email" quay về form Đăng ký để gõ lại.
//  - Action trả KHOÁ bảng nhãn (kèm `:{giây}` ở nhánh rate limit) → client dịch.
"use client";

import { useActionState, useEffect, useState } from "react";
import {
  resendSignupCode,
  verifySignupCode,
  type AuthState,
} from "@/features/auth/actions";
import { RESEND_COOLDOWN_SECONDS, VERIFY_CODE_MAX_LENGTH } from "@/lib/auth/verifyCode";
import { t } from "@/lib/copy";
import { authMessage } from "@/features/auth/components/authMessage";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

export function VerifyCodeForm({
  initialEmail,
  onChangeEmail,
}: {
  initialEmail: string;
  onChangeEmail: () => void;
}) {
  const [email, setEmail] = useState(initialEmail);
  // Có email từ bước đăng ký nghĩa là mail vừa được gửi → bắt đầu đã ở trong
  // thời gian chờ; mở thẳng trang (không email) thì cho gửi ngay.
  const [cooldown, setCooldown] = useState(initialEmail ? RESEND_COOLDOWN_SECONDS : 0);

  const [verifyState, verifyAction, verifyPending] = useActionState<AuthState, FormData>(
    verifySignupCode,
    null
  );
  const [resendState, resendAction, resendPending] = useActionState<AuthState, FormData>(
    async (prev, formData) => {
      const result = await resendSignupCode(prev, formData);
      if (result?.info) setCooldown(RESEND_COOLDOWN_SECONDS);
      return result;
    },
    null
  );

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const hasEmail = email.trim() !== "";

  return (
    <div className="animate-in fade-in slide-in-from-right-3 flex flex-col gap-4 duration-300 motion-reduce:animate-none">
      <p className="text-muted-foreground text-sm leading-relaxed">
        {initialEmail
          ? t("auth.verify.intro", { email: initialEmail })
          : t("auth.verify.introNoEmail")}
      </p>

      <form action={verifyAction} className="flex flex-col gap-4">
        {initialEmail ? (
          <input type="hidden" name="email" value={initialEmail} />
        ) : (
          <div>
            <Label htmlFor="verify-email">{t("auth.email")}</Label>
            <Input
              id="verify-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
        )}
        <div>
          <Label htmlFor="verify-code">{t("auth.verify.code")}</Label>
          <Input
            id="verify-code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            // Cho phép dán "123 456" / "123-456": server bỏ khoảng trắng và gạch.
            pattern="[0-9 \-]*"
            maxLength={VERIFY_CODE_MAX_LENGTH + 3}
            required
            className="text-center text-xl tracking-[0.3em]"
          />
        </div>

        {verifyState?.error && (
          <p role="alert" className="text-destructive text-sm">
            {authMessage(verifyState.error)}
          </p>
        )}

        <Button type="submit" size="lg" disabled={verifyPending} className="w-full">
          {verifyPending ? t("common.processing") : t("auth.verify.submit")}
        </Button>
      </form>

      <form action={resendAction} className="flex flex-col items-center gap-1">
        <input type="hidden" name="email" value={email} />
        {resendState?.error && (
          <p role="alert" className="text-destructive text-sm">
            {authMessage(resendState.error)}
          </p>
        )}
        {resendState?.info && (
          <p role="status" className="text-muted-foreground text-sm">
            {authMessage(resendState.info)}
          </p>
        )}
        <Button
          type="submit"
          variant="link"
          disabled={resendPending || cooldown > 0 || !hasEmail}
        >
          {resendPending
            ? t("common.sending")
            : cooldown > 0
              ? t("auth.verify.resendIn", { seconds: cooldown })
              : t("auth.verify.resend")}
        </Button>
      </form>

      <Button type="button" variant="link" onClick={onChangeEmail} className="self-center">
        {t("auth.verify.changeEmail")}
      </Button>
    </div>
  );
}
