// Thẻ đăng nhập / đăng ký. Theme "Sân trường" (2026-09-04): MỘT cột, nền surface
// xanh nhạt, hai tab dạng viên thuốc, ô nhập có nhãn phía trên (không dùng
// placeholder làm nhãn — placeholder biến mất khi gõ). Nằm trong vùng hero của
// trang chủ (HomeStage) — không còn page /login riêng.
//
// Logic giữ nguyên từ các đợt trước:
//  - signIn/signUp Server Actions; Google/Facebook OAuth THẬT (signInWithOAuth —
//    một form chung, nút submit name="provider").
//  - "Quên mật khẩu?" mở VIEW reset ngay trong thẻ (nhập email → gửi link).
//  - `state.info` (vd đăng ký cần xác nhận email) — tông trung tính, khác lỗi đỏ.
//  - Toggle hiện/ẩn mật khẩu; thân thẻ bọc AutoHeightPanel để đổi tab/view giãn
//    nở mượt thay vì nhảy khựng.
"use client";

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { requestPasswordReset, signIn, signInWithOAuth, signUp, type AuthState } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";

type Mode = "signin" | "signup";

export function AuthForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const [mode, setMode] = useState<Mode>(initialMode);
  // View reset mật khẩu — đè lên form sign in/up; tab nào bấm cũng thoát reset.
  const [resetOpen, setResetOpen] = useState(false);
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(action, null);
  const [oauthState, oauthAction, oauthPending] = useActionState<AuthState, FormData>(
    signInWithOAuth,
    null
  );
  const [resetState, resetAction, resetPending] = useActionState<AuthState, FormData>(
    requestPasswordReset,
    null
  );

  const isSignup = mode === "signup";

  return (
    <div className="bg-surface rounded-card flex w-full flex-col gap-5 p-5 sm:p-7">
      {/* Hai tab — một dải viên thuốc, tab đang chọn tô trắng. aria-pressed vì
          đây là hai nút đổi trạng thái của cùng một form, không phải tablist
          điều khiển hai panel riêng. */}
      <div className="bg-background flex rounded-full p-1" role="group" aria-label={t("auth.signIn")}>
        <TabButton
          active={!isSignup && !resetOpen}
          onClick={() => {
            setMode("signin");
            setResetOpen(false);
          }}
          label={t("auth.signIn")}
        />
        <TabButton
          active={isSignup && !resetOpen}
          onClick={() => {
            setMode("signup");
            setResetOpen(false);
          }}
          label={t("auth.signUp")}
        />
      </div>

      <h1 className="text-2xl font-bold">
        {resetOpen ? t("auth.resetPassword") : isSignup ? t("auth.signUp") : t("auth.signIn")}
      </h1>

      <AutoHeightPanel measureKey={resetOpen ? "reset" : mode}>
        {resetOpen ? (
          <div className="animate-in fade-in slide-in-from-right-3 flex flex-col gap-4 duration-300 motion-reduce:animate-none">
            <p className="text-muted-foreground text-sm leading-relaxed">{t("auth.resetIntro")}</p>
            <form action={resetAction} className="flex flex-col gap-4">
              <Field id="reset-email" name="email" type="email" label={t("auth.email")} required />
              {resetState?.error && (
                <p role="alert" className="text-destructive text-sm">
                  {resetState.error}
                </p>
              )}
              {resetState?.info && (
                <p role="status" className="text-muted-foreground text-sm">
                  {resetState.info}
                </p>
              )}
              <Button type="submit" size="lg" disabled={resetPending} className="w-full">
                {resetPending ? t("common.sending") : t("auth.sendResetLink")}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => setResetOpen(false)}
                className="self-center"
              >
                {t("auth.backToSignIn")}
              </Button>
            </form>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <form action={formAction} className="flex flex-col gap-4">
              {/* Key theo mode → field animate khi chuyển tab; "Tên hiển thị"
                  xuất hiện/ẩn tự nhiên theo remount. */}
              <div
                key={mode}
                className="animate-in fade-in slide-in-from-right-3 flex flex-col gap-4 duration-300 motion-reduce:animate-none"
              >
                {isSignup && (
                  <Field
                    id="displayName"
                    name="displayName"
                    type="text"
                    label={t("common.displayName")}
                    hint={t("common.displayNameHint")}
                  />
                )}
                <Field id="email" name="email" type="email" label={t("auth.email")} required />
                {/* Sàn độ dài CHỈ gắn ở tab Đăng ký. Tab Đăng nhập tuyệt đối không
                    được có `minLength`/gợi ý: tài khoản cũ đặt từ thời luật 6 ký tự
                    vẫn đăng nhập được (chính sách chỉ áp cho mật khẩu MỚI — xem
                    lib/auth/passwordPolicy.ts). Gợi ý hiện SẴN chứ không đợi lỗi. */}
                <Field
                  id="password"
                  name="password"
                  type="password"
                  label={t("auth.password")}
                  required
                  minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
                  hint={
                    isSignup ? t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH }) : undefined
                  }
                />
              </div>

              {state?.error && (
                <p role="alert" className="text-destructive text-sm">
                  {state.error}
                </p>
              )}
              {state?.info && (
                <p role="status" className="text-muted-foreground text-sm">
                  {state.info}
                </p>
              )}

              <Button type="submit" size="lg" disabled={pending} className="w-full">
                {pending ? t("common.processing") : isSignup ? t("auth.signUp") : t("auth.signIn")}
              </Button>
              {!isSignup && (
                <Button
                  type="button"
                  variant="link"
                  onClick={() => setResetOpen(true)}
                  className="self-center"
                >
                  {t("auth.forgotPassword")}
                </Button>
              )}
            </form>

            {/* OAuth THẬT: MỘT form chung, mỗi nút là submit kèm name="provider"
                → signInWithOAuth đọc provider từ formData. */}
            <form action={oauthAction} className="border-border flex flex-col gap-3 border-t pt-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-muted-foreground text-sm">
                  {isSignup ? t("auth.orSignUpWith") : t("auth.orSignInWith")}
                </span>
                <div className="flex items-center gap-2">
                  <SocialButton
                    provider="google"
                    label="Google"
                    pending={oauthPending}
                    icon={<GoogleIcon className="size-5" />}
                  />
                  <SocialButton
                    provider="facebook"
                    label="Facebook"
                    pending={oauthPending}
                    icon={<FacebookIcon className="size-5" />}
                  />
                </div>
              </div>
              {oauthState?.error && (
                <p role="alert" className="text-destructive text-sm">
                  {oauthState.error}
                </p>
              )}
            </form>
          </div>
        )}
      </AutoHeightPanel>
    </div>
  );
}

/* ---------- Sub-components ---------- */

// useLayoutEffect gây warning khi chạy trong SSR — dùng bản isomorphic để
// đo/set height NGAY trước paint đầu tiên, không nháy.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * AutoHeightPanel — bọc nội dung có thể đổi chiều cao (số field khác nhau giữa
 * các view) để container GIÃN/NỞ mượt thay vì nhảy khựng. Outer div có height
 * cố định (animate qua CSS transition) + overflow-hidden; ResizeObserver theo
 * dõi inner để cập nhật.
 */
function AutoHeightPanel({
  children,
}: {
  children: React.ReactNode;
  /** Nhãn view hiện tại — không dùng trong logic, chỉ để đọc code dễ hơn. */
  measureKey?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);

  useIsomorphicLayoutEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    const applyHeight = () => {
      outer.style.height = `${inner.offsetHeight}px`;
    };
    applyHeight(); // set ngay lúc mount — không animate từ 0.

    const ro = new ResizeObserver(applyHeight);
    ro.observe(inner);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className="overflow-hidden transition-[height] duration-500 ease-out motion-reduce:transition-none"
    >
      <div ref={innerRef}>{children}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`focus-visible:ring-ring h-10 flex-1 rounded-full text-sm font-semibold transition-colors focus-visible:ring-3 focus-visible:outline-none ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}

function Field({
  id,
  name,
  type,
  label,
  required,
  minLength,
  hint,
}: {
  id: string;
  name: string;
  type: string;
  label: string;
  required?: boolean;
  minLength?: number;
  /** Câu gợi ý hiện ngay dưới ô. Bỏ trống thì không render gì. */
  hint?: string;
}) {
  // Toggle hiện/ẩn — chỉ áp dụng cho ô mật khẩu.
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  // useId: form này render được hai lần trên một trang (thẻ + view reset), nên
  // id cố định suy từ `id` prop sẽ đụng nhau và aria-describedby trỏ nhầm ô.
  const hintId = `${useId()}-hint`;

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input
          id={id}
          name={name}
          type={inputType}
          required={required}
          minLength={minLength}
          aria-describedby={hint ? hintId : undefined}
          autoComplete={
            isPassword ? (minLength ? "new-password" : "current-password") : type === "email" ? "email" : undefined
          }
          className={isPassword ? "pr-12" : undefined}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:outline-none"
          >
            {show ? <EyeOff aria-hidden className="size-4" /> : <Eye aria-hidden className="size-4" />}
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-muted-foreground mt-1.5 text-xs">
          {hint}
        </p>
      )}
    </div>
  );
}

// Chỉ LOGO, không kèm chữ "Google"/"Facebook" (engineer 2026-08-28: logo màu
// thương hiệu đã tự nói lên nó là gì). Tên nhà cung cấp vẫn tới được trình đọc
// màn hình và tooltip chuột qua `aria-label` + `title`.
function SocialButton({
  provider,
  label,
  icon,
  pending,
}: {
  provider: "google" | "facebook";
  label: string;
  icon: React.ReactNode;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      name="provider"
      value={provider}
      disabled={pending}
      aria-label={label}
      title={label}
      className="bg-background hover:bg-[color-mix(in_oklch,var(--background),var(--foreground)_6%)] focus-visible:ring-ring grid size-11 place-items-center rounded-full transition-colors focus-visible:ring-3 focus-visible:outline-none disabled:opacity-60"
    >
      {icon}
    </button>
  );
}

// Logo Google 4 màu chính thức và Facebook xanh #1877F2 — màu HARDCODE chứ
// không `currentColor`: đây là tài sản thương hiệu của bên thứ ba, không phải
// icon giao diện, và chúng là thứ DUY NHẤT nhận diện nút.
function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#4285F4"
        d="M23.5 12.27c0-.82-.07-1.6-.21-2.36H12v4.47h6.45a5.52 5.52 0 0 1-2.39 3.62v3.01h3.87c2.26-2.09 3.57-5.17 3.57-8.74Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.01c-1.08.72-2.45 1.15-4.06 1.15-3.13 0-5.78-2.11-6.72-4.96H1.28v3.11A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.28 14.27a7.2 7.2 0 0 1 0-4.54V6.62H1.28a12 12 0 0 0 0 10.76l4-3.11Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.69 1.28 6.62l4 3.11C6.22 6.88 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className}>
      <path
        fill="#1877F2"
        d="M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.96h-1.51c-1.49 0-1.96.93-1.96 1.89v2.26h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z"
      />
    </svg>
  );
}
