// Auth callback — /auth/callback (Logic Layer 1, S#23).
// Điểm về CHUNG của mọi flow PKCE `?code=`:
//  - OAuth Google/Facebook (signInWithOAuth → provider → Supabase → đây)
//  - Link email reset mật khẩu (resetPasswordForEmail → đây, next=/reset-password)
//  - Link email xác nhận đăng ký (nếu template Supabase trỏ về đây)
// Đổi code lấy session (cookie) rồi redirect theo `next` — CHỈ nhận giá trị
// trong whitelist (chống open-redirect). Path này nằm trong PUBLIC_PATHS của
// middleware (request tới đây CHƯA có session).
//
// KHÔI PHỤC MẬT KHẨU (2026-09-13, lib/auth/recovery.ts): mã khôi phục đổi ra
// một phiên Y HỆT phiên đăng nhập — Supabase không có "phiên chỉ được đổi mật
// khẩu". Nên ở đây gắn cờ RECOVERY_COOKIE khi (a) link nói `next=/reset-password`
// HOẶC (b) token vừa nhận mang amr=recovery; middleware đọc cờ và ép mọi đường
// về /reset-password cho tới khi `updatePassword` gỡ cờ. (b) là lớp thứ hai:
// một link bị sửa `next=/exams` vẫn không thoát được, vì cờ đi theo TOKEN.

import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { SESSION_COOKIE_OPTIONS } from "@/lib/supabase/cookieOptions";
import {
  RECOVERY_COOKIE,
  RECOVERY_COOKIE_MAX_AGE_SECONDS,
  RECOVERY_PATH,
  isRecoveryAccessToken,
} from "@/lib/auth/recovery";

const ALLOWED_NEXT = ["/exams", RECOVERY_PATH];

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next") ?? "/exams";
  const next = ALLOWED_NEXT.includes(nextParam) ? nextParam : "/exams";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const recovery =
        next === RECOVERY_PATH || isRecoveryAccessToken(data.session?.access_token);
      if (recovery) {
        // Cùng httpOnly/sameSite/secure với cookie phiên: không JS nào cần đọc.
        const cookieStore = await cookies();
        cookieStore.set(RECOVERY_COOKIE, "1", {
          ...SESSION_COOKIE_OPTIONS,
          path: "/",
          maxAge: RECOVERY_COOKIE_MAX_AGE_SECONDS,
        });
        return NextResponse.redirect(`${origin}${RECOVERY_PATH}`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.warn("[auth/callback] exchangeCodeForSession:", error.message);
  }

  // Code thiếu/hết hạn/đã dùng → về form đăng nhập.
  return NextResponse.redirect(`${origin}/?auth=signin`);
}
