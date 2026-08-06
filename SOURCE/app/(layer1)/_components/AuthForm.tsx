// UI Layer 1 — Card đăng nhập / đăng ký (GĐ 3 Polish, S#15; restyle S#17).
// Bố cục theo TEMPLATE/homepage/signup_login_page_form.jpe (panel tab trái +
// form phải). Theme "Mực & Sơn mài" (DESIGN.md): panel tab đen sơn mài #1B1512,
// form nền ngà #EDE1C8, nút đỏ son #A62C2B, focus underline vàng đồng #B8863B.
// Không đổ bóng, bo góc 4px (quy tắc Elevation & Shapes). Nằm trong content
// area của homepage (HomeStage) — không còn page /login riêng.
// Logic: signIn/signUp Server Actions (L1). S#23 hoàn thiện auth module:
//  - Google/Facebook OAuth THẬT (signInWithOAuth — 1 form chung, button
//    name="provider"; hoạt động khi engineer đã cấu hình provider ở Supabase).
//  - "Forgot password?" mở VIEW reset ngay trong card (nhập email → gửi link).
//  - Hiển thị `state.info` (vd signup cần xác nhận email) — tông trung tính,
//    khác error đỏ son.
// S#24: panel trái đổi từ watermark logo → chữ cái serif phóng to trang trí
// (tinh thần drop-cap DESIGN.md); password field có toggle hiện/ẩn.
// S#25: thân form (reset view ⇄ sign-in/sign-up) bọc trong AutoHeightPanel —
// card giãn/nở mượt khi số field thay đổi giữa 2 tab, thay vì nhảy khựng.
"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { requestPasswordReset, signIn, signInWithOAuth, signUp, type AuthState } from "../actions";
import { useT } from "@/lib/i18n/client";

type Mode = "signin" | "signup";

export function AuthForm({ initialMode = "signin" }: { initialMode?: Mode }) {
  const t = useT();
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
    <div className="flex w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-[#D8C9A8] bg-[#EDE1C8] sm:flex-row">
      {/* ---------- Panel trái: tabs (đen sơn mài) ---------- */}
      <div className="relative flex overflow-hidden bg-[#1B1512] p-6 sm:w-2/5 sm:flex-col sm:justify-center sm:p-8">
        {/* Nền: chữ cái Latinh serif phóng to trang trí (S#24, thay watermark
            logo cũ) — "M"/"S" khớp MS-MOLAR, tông đỏ son mờ (tinh thần
            drop-cap DESIGN.md: font display, color primary). Tĩnh — S#26 bỏ
            transition remount theo tab (engineer yêu cầu). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden"
        >
          <div className="flex font-serif text-[9rem] leading-none text-[#A62C2B]/[0.16] select-none sm:text-[11rem]">
            <span className="-mr-4 sm:-mr-6">M</span>
            <span className="mt-10 sm:mt-14">S</span>
          </div>
        </div>

        <div className="relative flex gap-3 sm:flex-col sm:gap-2">
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
      </div>

      {/* ---------- Panel phải: form (ngà) ---------- */}
      <div className="flex-1 px-7 py-7 sm:px-10">
        {/* Avatar tròn */}
        <div className="mb-4 flex justify-center">
          <div className="grid size-14 place-items-center rounded-full bg-[#1B1512] text-[#EDE1C8]">
            <UserIcon className="size-7" />
          </div>
        </div>

        <h1 className="mb-6 text-center font-serif text-2xl tracking-wide text-[#1B1512]">
          {resetOpen ? t("auth.resetPassword") : isSignup ? t("auth.signUp") : t("auth.signIn")}
        </h1>

        {/* S#25: bọc toàn bộ phần THÂN thay đổi chiều cao (reset view ⇄
            sign-in/sign-up — số field khác nhau) trong AutoHeightPanel →
            card giãn/nở MƯỢT thay vì nhảy khựng khi đổi tab hoặc mở/đóng
            reset. h1 phía trên giữ nguyên (luôn 1 dòng, không cần đo). */}
        <AutoHeightPanel measureKey={resetOpen ? "reset" : mode}>
          {resetOpen ? (
            <div className="animate-in fade-in slide-in-from-right-3 duration-300">
              <p className="text-sm text-[color:var(--muted-foreground)]">{t("auth.resetIntro")}</p>
              <form action={resetAction} className="mt-5">
                <Field
                  id="reset-email"
                  name="email"
                  type="email"
                  placeholder={t("auth.email")}
                  required
                  icon={<MailIcon className="size-4" />}
                />
                {resetState?.error && (
                  <p role="alert" className="mt-4 text-sm text-[#A62C2B]">
                    {resetState.error}
                  </p>
                )}
                {resetState?.info && (
                  <p role="status" className="mt-4 text-sm text-[color:var(--muted-foreground)]">
                    {resetState.info}
                  </p>
                )}
                <div className="mt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setResetOpen(false)}
                    className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[#1B1512]"
                  >
                    {t("auth.backToSignIn")}
                  </button>
                  <button
                    type="submit"
                    disabled={resetPending}
                    className="rounded-[4px] bg-[#A62C2B] px-7 py-2.5 text-xs font-medium tracking-[0.14em] text-[#EDE1C8] uppercase transition-colors hover:bg-[#8F2523] disabled:opacity-60"
                  >
                    {resetPending ? t("common.sending") : t("auth.sendResetLink")}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            <>
              <form action={formAction}>
                {/* Key theo mode → field animate khi chuyển tab; "Tên hiển thị"
                    xuất hiện/ẩn tự nhiên theo remount. */}
                <div
                  key={mode}
                  className="animate-in fade-in slide-in-from-right-3 space-y-5 duration-300"
                >
                  {isSignup && (
                    <Field
                      id="displayName"
                      name="displayName"
                      type="text"
                      placeholder={t("common.displayName")}
                      icon={<UserIcon className="size-4" />}
                    />
                  )}
                  <Field
                    id="email"
                    name="email"
                    type="email"
                    placeholder={t("auth.email")}
                    required
                    icon={<MailIcon className="size-4" />}
                  />
                  <Field
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t("auth.password")}
                    required
                    icon={<LockIcon className="size-4" />}
                  />
                </div>

                {state?.error && (
                  <p role="alert" className="mt-4 text-sm text-[#A62C2B]">
                    {state.error}
                  </p>
                )}
                {/* info — message trung tính (vd signup cần xác nhận email, S#23). */}
                {state?.info && (
                  <p role="status" className="mt-4 text-sm text-[color:var(--muted-foreground)]">
                    {state.info}
                  </p>
                )}

                <div className="mt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="text-xs text-[color:var(--muted-foreground)] transition-colors hover:text-[#1B1512]"
                  >
                    {t("auth.forgotPassword")}
                  </button>
                  {/* button-primary DESIGN.md: nền đỏ son, chữ ngà, label-caps, bo 4px. */}
                  <button
                    type="submit"
                    disabled={pending}
                    className="rounded-[4px] bg-[#A62C2B] px-7 py-2.5 text-xs font-medium tracking-[0.14em] text-[#EDE1C8] uppercase transition-colors hover:bg-[#8F2523] disabled:opacity-60"
                  >
                    {pending
                      ? t("common.processing")
                      : isSignup
                        ? t("auth.signUp")
                        : t("auth.signIn")}
                  </button>
                </div>
              </form>

              {/* Social — OAuth THẬT (S#23): MỘT form chung, mỗi nút là submit
                  kèm name="provider" → signInWithOAuth đọc provider từ
                  formData. Lỗi (vd provider chưa bật trong Supabase) hiện
                  ngay dưới hàng nút. */}
              <form
                action={oauthAction}
                className="mt-6 flex flex-col gap-3 border-t border-[#D8C9A8] pt-4 text-xs text-[color:var(--muted-foreground)]"
              >
                <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
                  <span>{isSignup ? t("auth.orSignUpWith") : t("auth.orSignInWith")}</span>
                  <div className="flex items-center gap-4">
                    <SocialButton
                      provider="google"
                      label="Google"
                      pending={oauthPending}
                      icon={<GoogleIcon className="size-4" />}
                    />
                    <SocialButton
                      provider="facebook"
                      label="Facebook"
                      pending={oauthPending}
                      icon={<FacebookIcon className="size-4" />}
                    />
                  </div>
                </div>
                {oauthState?.error && (
                  <p role="alert" className="text-[#A62C2B]">
                    {oauthState.error}
                  </p>
                )}
              </form>
            </>
          )}
        </AutoHeightPanel>
      </div>
    </div>
  );
}

/* ---------- Sub-components ---------- */

// useLayoutEffect gây warning khi chạy trong SSR ("does nothing on the
// server") — dùng bản isomorphic (useEffect trên server, useLayoutEffect
// trên client) để đo/set height NGAY trước paint đầu tiên, không nháy.
const useIsomorphicLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/**
 * AutoHeightPanel — bọc nội dung có thể đổi chiều cao (số field khác nhau
 * giữa các view) để container GIÃN/NỞ mượt thay vì nhảy khựng (S#25).
 * Kỹ thuật: outer div có height cố định (px, animate qua CSS transition) +
 * overflow-hidden; inner div height tự nhiên (auto), ResizeObserver theo dõi
 * inner để cập nhật height của outer mỗi khi nội dung đổi (đổi tab/view).
 * `measureKey` chỉ để debug/đọc code rõ ràng hơn — logic đo dựa hoàn toàn
 * vào ResizeObserver nên tự chạy đúng bất kể nội dung đổi vì lý do gì.
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
    <div ref={outerRef} className="overflow-hidden transition-[height] duration-500 ease-out">
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
      className={`rounded-[4px] px-5 py-2 text-sm font-medium tracking-wide transition-all duration-300 sm:-mr-8 sm:rounded-r-none sm:py-2.5 sm:text-left ${
        active ? "bg-[#B8863B]/50 text-[#EDE1C8]" : "text-[#EDE1C8]/55 hover:text-[#EDE1C8]"
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
  placeholder,
  icon,
  required,
}: {
  id: string;
  name: string;
  type: string;
  /** Nhãn ĐÃ DỊCH — component cha tra từ điển rồi truyền xuống. */
  placeholder: string;
  icon: React.ReactNode;
  required?: boolean;
}) {
  const t = useT();
  // S#24: toggle hiện/ẩn — chỉ áp dụng cho field password.
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;

  return (
    <label
      htmlFor={id}
      className="flex items-center gap-3 border-b border-[color:var(--input)] pb-1 text-[color:var(--muted-foreground)] transition-colors focus-within:border-[color:var(--ring)] focus-within:text-[#1B1512]"
    >
      <span className="shrink-0">{icon}</span>
      <input
        id={id}
        name={name}
        type={inputType}
        required={required}
        placeholder={placeholder}
        className="w-full bg-transparent py-2 text-[#1B1512] outline-none placeholder:text-[color:var(--muted-foreground)]/70"
      />
      {isPassword && (
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? t("auth.hidePassword") : t("auth.showPassword")}
          className="shrink-0 text-[color:var(--muted-foreground)] transition-colors hover:text-[#1B1512]"
        >
          {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
        </button>
      )}
    </label>
  );
}

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
      className="flex items-center gap-1.5 text-[color:var(--muted-foreground)] transition-colors hover:text-[#1B1512] disabled:opacity-60"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

/* ---------- Inline SVG icons (đồng bộ style SVG của SiteHeader) ---------- */

function UserIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M4 20c0-3.3 3.6-6 8-6s8 2.7 8 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m4 7 8 6 8-6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <rect x="4" y="10" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M8 10V7a4 4 0 0 1 8 0v3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M12 11v3h4.2c-.5 1.6-1.9 2.7-4.2 2.7A4.7 4.7 0 0 1 12 7.3c1.2 0 2.3.5 3 1.2l2.1-2.1A7.6 7.6 0 0 0 12 4a8 8 0 1 0 0 16c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden className={className}>
      <path
        d="M14 8.5V7c0-.7.3-1 1-1h1.5V3H14c-2.2 0-3.5 1.3-3.5 3.7V8.5H8.5v3h2V21h3.5v-9.5H17l.5-3H14Z"
        fill="currentColor"
      />
    </svg>
  );
}

// S#24 — toggle hiện/ẩn mật khẩu (AuthForm + ResetPasswordForm).
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
