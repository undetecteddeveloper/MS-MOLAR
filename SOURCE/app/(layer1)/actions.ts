// Logic Layer 1 — Auth Server Actions (GĐ 2 M2.4; S#23 hoàn thiện auth module:
// signup hardening + OAuth Google/Facebook + password reset).
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 3.2 & 9.1.
"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/auth/passwordPolicy";
import { guard } from "@/lib/security/rateLimit";

// `info` (S#23): message trung tính không phải lỗi — vd "check your email".
export type AuthState = { error?: string; info?: string } | null;

/** Origin của request hiện tại — làm base cho redirectTo (OAuth + email link). */
async function requestOrigin(): Promise<string> {
  return (await headers()).get("origin") ?? "http://localhost:3000";
}

/** Đăng ký email/password. user_profiles row được tạo tự động qua DB trigger (schema.sql). */
export async function signUp(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const displayName = String(formData.get("displayName") ?? "");

  // Trước đây signUp KHÔNG kiểm gì, thả cho mặc định 6 ký tự của Supabase —
  // lỏng hơn cả updatePassword (Security review 2026-08-03, Low). Nay cả hai
  // dùng chung lib/auth/passwordPolicy.
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { display_name: displayName || email } },
  });

  if (error) return { error: error.message };

  // Project bật "Confirm email" → chưa có session ngay sau signUp: user phải
  // bấm link xác nhận trong mail trước. KHÔNG redirect /exams (middleware sẽ
  // bounce ngược vì chưa auth) — hiện hướng dẫn tại chỗ.
  if (!data.session) {
    return {
      info: "Account created. Check your email to confirm your address, then sign in.",
    };
  }

  redirect("/exams");
}

/**
 * Đăng nhập/đăng ký bằng OAuth (Google | Facebook) — S#23.
 * Provider đọc từ formData (1 form chung, button name="provider").
 * Flow PKCE: Supabase trả URL consent của provider → redirect user sang đó;
 * provider gọi về Supabase → Supabase gọi về /auth/callback?code=... của app
 * (route handler đổi code lấy session). Code verifier nằm trong cookie do
 * @supabase/ssr tự quản lý.
 * ⚠️ Chỉ hoạt động khi engineer đã bật provider + dán credentials trong
 * Supabase Dashboard (xem `docs/DEPLOYMENT.md` § 3.2 OAuth providers).
 */
export async function signInWithOAuth(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const provider =
    formData.get("provider") === "facebook" ? "facebook" : "google";

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${origin}/auth/callback?next=/exams` },
  });

  if (error || !data.url) {
    return { error: error?.message ?? "OAuth sign-in failed. Try again." };
  }
  redirect(data.url);
}

/**
 * Gửi email reset mật khẩu — S#23. Link trong mail đi qua
 * /auth/callback?next=/reset-password (PKCE recovery) → trang đặt mật khẩu mới.
 * Luôn trả message CHUNG bất kể email có tồn tại hay không (chuẩn bảo mật —
 * không làm oracle dò email đã đăng ký). Lỗi thật (vd rate limit email
 * built-in Supabase) chỉ log server-side.
 */
export async function requestPasswordReset(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Enter your email address" };

  const origin = await requestOrigin();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });
  if (error) console.warn("[requestPasswordReset]", error.message);

  return {
    info: "If an account exists for that email, a password reset link has been sent.",
  };
}

/**
 * Đặt mật khẩu mới — S#23. Chạy trong recovery session (user vừa bấm link
 * email, /auth/callback đã đổi code lấy session) hoặc session thường.
 */
export async function updatePassword(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };
  if (password !== confirm) return { error: "Passwords do not match" };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  redirect("/exams");
}

/** Đăng nhập email/password. */
export async function signIn(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: error.message };
  redirect("/exams");
}

/** Đăng xuất, quay về homepage với form đăng nhập mở. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/?auth=signin");
}

/** Đổi tên hiển thị (user_profiles.display_name) — gọi từ HeaderProfile (navbar
 * L2/3/4) + SidebarProfile (homepage). RLS "profiles_update_own" đã cho phép
 * user tự sửa profile của mình. */
export async function updateProfile(
  _prev: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const displayName = String(formData.get("displayName") ?? "").trim();
  if (!displayName) return { error: "Display name must not be empty" };
  if (displayName.length > 12)
    return { error: "Display name must be 12 characters or fewer" };
  if (!/^[\p{L}.]+$/u.test(displayName))
    return { error: "Display name may only contain letters and dots" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired" };

  // Rate limit (Security review Low) — user_profiles.update không có ràng buộc
  // nào chặn ghi lặp, nên đây là action rẻ nhất để gọi dồn.
  const rl = await guard("updateProfile", user.id);
  if (!rl.ok) {
    return { error: `Too many updates. Try again in ${rl.retryAfterSeconds} seconds.` };
  }

  const { error } = await supabase
    .from("user_profiles")
    .update({ display_name: displayName })
    .eq("id", user.id);

  if (error) return { error: error.message };
  return null;
}
