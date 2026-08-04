// Supabase middleware helper — refresh session mỗi request và bảo vệ route.
// Được gọi từ proxy.ts (Next.js 16 convention thay middleware.ts).
// Xem BACK-END-ARCHITECTURE-MAP.md Mục 8.1.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_OPTIONS } from "./cookieOptions";

/** Các path không yêu cầu đăng nhập. `/auth/callback` (S#23): điểm về của
 * OAuth + email link — request tới đây CHƯA có cookie session, không whitelist
 * thì bị chặn trước khi route handler kịp đổi code lấy session.
 * (`/reset-password` KHÔNG public — cần recovery session từ email link.) */
const PUBLIC_PATHS = ["/", "/login", "/auth/callback"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      // Phải khớp server.ts: middleware là nơi refresh token nên cũng GHI LẠI
      // cookie session. Thiếu ở đây thì mỗi lần refresh sẽ ghi đè bằng cookie
      // KHÔNG httpOnly và âm thầm huỷ tác dụng của server.ts.
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // QUAN TRỌNG: getUser() phải được gọi để refresh token. Không chèn code giữa
  // createServerClient và getUser() — dễ gây lỗi đăng xuất ngẫu nhiên.
  // Bọc try/catch: nếu backend Supabase không kết nối được (project paused/
  // deleted, mạng), coi như chưa đăng nhập thay vì để mọi request 500.
  let user = null;
  try {
    const result = await supabase.auth.getUser();
    user = result.data.user;
  } catch (err) {
    console.warn("[updateSession] Supabase auth không kết nối được:", err);
  }

  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  // Chưa đăng nhập + route cần bảo vệ → về homepage với form auth mở
  // (auth nằm trong content area của `/` từ S#17, không còn page /login riêng).
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    url.search = "?auth=signin";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
