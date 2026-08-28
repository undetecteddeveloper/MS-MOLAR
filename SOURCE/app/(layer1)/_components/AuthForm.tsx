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

import { useActionState, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { requestPasswordReset, signIn, signInWithOAuth, signUp, type AuthState } from "../actions";
import { useT } from "@/lib/i18n/client";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/passwordPolicy";

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
                    className="rounded-full bg-[#A62C2B] px-7 py-2.5 text-xs font-medium tracking-[0.14em] text-[#EDE1C8] uppercase transition-colors hover:bg-[#8F2523] disabled:opacity-60"
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
                  {/* Sàn độ dài CHỈ gắn ở tab Đăng ký. Tab Đăng nhập tuyệt
                      đối không được có `minLength`/gợi ý: tài khoản cũ đặt từ
                      thời luật 6 ký tự vẫn đăng nhập được (chính sách chỉ áp
                      cho mật khẩu MỚI — xem lib/auth/passwordPolicy.ts), nên
                      một ràng buộc ở trình duyệt tại đây sẽ khoá cửa đúng
                      những người đang dùng sản phẩm.

                      Gợi ý hiện SẴN chứ không đợi lỗi: người dùng báo "không
                      nhập được mật khẩu" chính vì luật chỉ lộ ra sau một vòng
                      gửi lên server, không có gì nói trước. */}
                  <Field
                    id="password"
                    name="password"
                    type="password"
                    placeholder={t("auth.password")}
                    required
                    minLength={isSignup ? PASSWORD_MIN_LENGTH : undefined}
                    hint={
                      isSignup ? t("auth.passwordHint", { min: PASSWORD_MIN_LENGTH }) : undefined
                    }
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
                    className="rounded-full bg-[#A62C2B] px-7 py-2.5 text-xs font-medium tracking-[0.14em] text-[#EDE1C8] uppercase transition-colors hover:bg-[#8F2523] disabled:opacity-60"
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
  minLength,
  hint,
}: {
  id: string;
  name: string;
  type: string;
  /** Nhãn ĐÃ DỊCH — component cha tra từ điển rồi truyền xuống. */
  placeholder: string;
  icon: React.ReactNode;
  required?: boolean;
  minLength?: number;
  /** Câu gợi ý ĐÃ DỊCH, hiện ngay dưới field. Bỏ trống thì không render gì. */
  hint?: string;
}) {
  const t = useT();
  // S#24: toggle hiện/ẩn — chỉ áp dụng cho field password.
  const [show, setShow] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (show ? "text" : "password") : type;
  // useId: form này render được hai lần trên một trang (card + view reset), nên
  // id cố định suy từ `id` prop sẽ đụng nhau và aria-describedby trỏ nhầm ô.
  const hintId = `${useId()}-hint`;

  return (
    <div>
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
          minLength={minLength}
          aria-describedby={hint ? hintId : undefined}
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
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs text-[color:var(--muted-foreground)]">
          {hint}
        </p>
      )}
    </div>
  );
}

// Chỉ LOGO, không kèm chữ "Google"/"Facebook" (engineer 2026-08-28: logo màu
// thương hiệu đã tự nói lên nó là gì). Tên nhà cung cấp vẫn phải tới được trình
// đọc màn hình và tooltip chuột — `aria-label` + `title` gánh phần đó, nên chữ
// biến mất khỏi màn hình chứ không biến mất khỏi giao diện.
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
      className="grid size-11 place-items-center rounded-full border border-[#D8C9A8] bg-[#EDE1C8] transition-colors hover:border-[#1B1512]/30 hover:bg-[#1B1512]/[0.04] disabled:opacity-60"
    >
      {icon}
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

// Logo Google 4 màu chính thức (đỏ/vàng/lục/lam) và Facebook xanh #1877F2 —
// màu HARDCODE chứ không `currentColor`: đây là tài sản thương hiệu của bên
// thứ ba, không phải icon giao diện, và từ 2026-08-28 chúng là thứ DUY NHẤT
// nhận diện nút (không còn nhãn chữ bên cạnh).
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
