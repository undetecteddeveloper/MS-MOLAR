import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// GĐ 2 M2.4: refresh Supabase session mỗi request + chặn route chưa auth.
// Logic chi tiết (public paths, redirect) nằm trong lib/supabase/middleware.ts.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
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
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|opengraph-image|.*\\..*).*)",
  ],
};
