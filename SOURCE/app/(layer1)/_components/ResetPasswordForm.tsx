"use client";
import { useT } from "@/lib/i18n/client";

// ResetPasswordForm — form đặt mật khẩu mới (Layer 1, S#23). User tới đây từ
// link email reset (recovery session đã có nhờ /auth/callback). Submit →
// updatePassword Server Action → redirect /exams.
// Theme Mực & Sơn mài đồng bộ AuthForm: card ngà, hairline, focus vàng đồng,
// nút đỏ son, không shadow.
// S#24: mỗi field có toggle hiện/ẩn mật khẩu RIÊNG (New/Confirm độc lập nhau).

import { useActionState, useState } from "react";
import { updatePassword, type AuthState } from "@/app/(layer1)/actions";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";

export function ResetPasswordForm() {
  const t = useT();
  const [state, formAction, pending] = useActionState<AuthState, FormData>(updatePassword, null);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <Field id="password" name="password" label="New password" autoComplete="new-password" />
      <Field id="confirm" name="confirm" label="Confirm new password" autoComplete="new-password" />

      <p className="text-xs text-[color:var(--muted-foreground)]">
        {t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH })}
      </p>

      {state?.error && (
        <p role="alert" className="text-sm text-[#A62C2B]">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-[#A62C2B] px-7 py-2.5 text-xs font-medium tracking-[0.14em] text-[#EDE1C8] uppercase transition-colors hover:bg-[#8F2523] disabled:opacity-60"
      >
        {pending ? t("common.saving") : t("auth.setNewPassword")}
      </button>
    </form>
  );
}

function Field({
  id,
  name,
  label,
  autoComplete,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
}) {
  const t = useT();
  const [show, setShow] = useState(false);

  return (
    <label htmlFor={id} className="flex flex-col gap-1.5">
      <span className="text-xs font-medium tracking-[0.08em] text-[color:var(--muted-foreground)] uppercase">
        {label}
      </span>
      <span className="flex items-center gap-3 border-b border-[color:var(--input)] transition-colors focus-within:border-[color:var(--ring)]">
        <input
          id={id}
          name={name}
          type={show ? "text" : "password"}
          required
          // Lấy từ hằng số chung, KHÔNG viết số cứng: bản cũ ghi 6 trong khi
          // server bắt 10, nên trình duyệt cho gửi rồi server mới từ chối.
          minLength={PASSWORD_MIN_LENGTH}
          autoComplete={autoComplete}
          className="w-full bg-transparent py-2 text-[#1B1512] outline-none"
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
          className="shrink-0 text-[color:var(--muted-foreground)] transition-colors hover:text-[#1B1512]"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      </span>
    </label>
  );
}

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M6.5 6.6C4 8.3 2 12 2 12s3.5 7 10 7c1.3 0 2.5-.2 3.6-.6M10.6 5.2A10.4 10.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.4 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.9 9.9a3 3 0 0 0 4.2 4.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M3 3l18 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
