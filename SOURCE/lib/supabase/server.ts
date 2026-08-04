// Supabase server client (Logic L1/L2 — dùng trong Server Actions & Server Components).
// Đọc/ghi cookie session theo cơ chế của @supabase/ssr.
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 8.1 & 9.2.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SESSION_COOKIE_OPTIONS } from "./cookieOptions";

/**
 * Tạo Supabase client phía server từ cookie request.
 * RLS tự inject auth.uid() vào mọi query (xem BACK-END map Mục 8.1).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // httpOnly — xem cookieOptions.ts. Không có JS phía trình duyệt nào cần
      // đọc cookie session, nên khoá hẳn khỏi tầm với của XSS.
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Gọi từ Server Component (không set được cookie) — bỏ qua;
            // session đã được refresh ở proxy.ts (middleware).
          }
        },
      },
    },
  );
}
