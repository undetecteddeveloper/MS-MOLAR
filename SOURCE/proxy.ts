import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { buildCsp, createNonce, supabaseOriginFromEnv } from "@/lib/security/csp";

// GĐ 2 M2.4: refresh Supabase session mỗi request + chặn route chưa auth.
// Logic chi tiết (public paths, redirect) nằm trong lib/supabase/middleware.ts.
//
// TD-006 (trả 2026-08-04): đây cũng là nơi sinh nonce CSP. Cơ chế, vì nó không
// hiển nhiên và sai một bước là trang trắng toàn site:
//
//   1. Sinh một nonce ngẫu nhiên cho ĐÚNG request này.
//   2. Đặt CSP chứa nonce đó lên HEADER CỦA REQUEST (không phải response).
//      Next.js đọc `content-security-policy` của request đến, rút nonce ra, rồi
//      tự gắn `nonce="…"` vào mọi thẻ script nó render. Đây là toàn bộ lý do
//      phải đi qua request header — không có bước này thì script hydrate của
//      Next không có nonce, và chính sách mới sẽ chặn nó.
//   3. Đặt CÙNG chuỗi CSP đó lên response, để trình duyệt thực thi.
//
// Nonce phải là MỘT-LẦN-MỘT-REQUEST. Dùng lại giữa các request là biến nonce
// thành một hằng số công khai, tức là không còn tác dụng gì.
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isProd: process.env.NODE_ENV === "production",
    supabaseOrigin: supabaseOriginFromEnv(),
  });

  return await updateSession(request, { nonce, csp });
}

export const config = {
  // Loại trừ static asset: _next, favicon, và mọi path có phần mở rộng (chứa dấu
  // chấm) — vd `/models/*.glb` của homepage 3D. Nếu không, request model sẽ bị
  // route guard redirect `/login` với khách chưa đăng nhập (homepage là public).
  //
  // `opengraph-image` phải liệt kê RIÊNG: Next.js phục vụ nó ở `/opengraph-image`
  // KHÔNG có phần mở rộng, nên luật "chứa dấu chấm" không đỡ được — để lọt thì
  // crawler của Zalo/Facebook nhận 307 về `/?auth=signin` và link chia sẻ mất
  // ảnh preview. (`robots.txt`, `sitemap.xml`, `icon.png`, `apple-icon.png` đều
  // có đuôi nên đã được luật dấu chấm loại trừ sẵn.)
  //
  // Hệ quả với CSP: những path bị loại trừ ở đây KHÔNG nhận được CSP có nonce —
  // chúng dùng chính sách nền trong next.config.ts. Đúng ý đồ: không path nào
  // trong số đó trả về HTML có script inline.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\..*).*)",
  ],
};
