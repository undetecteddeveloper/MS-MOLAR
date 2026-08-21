import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Trước đây /robots.txt trả 404 — crawler tự do bò vào mọi route rồi ăn
// redirect `/?auth=signin` (proxy.ts chỉ để lọt PUBLIC_PATHS = `/`, `/login`,
// `/auth/callback`). Không hỏng gì, nhưng phí crawl budget và có nguy cơ lộ
// URL nội bộ trong báo cáo Search Console.
//
// Bốn trang công khai và đáng index: `/`, `/terms`, `/refund-policy` (hai
// trang sau do tính năng Subscription thêm — PRD R11/AC-038) và `/about`
// (ADR-0017). Chúng không cần khai `allow` riêng vì đã nằm dưới `allow: "/"`;
// chúng chỉ cần KHÔNG bị dính một luật disallow nào. Mọi route còn lại nằm sau
// đăng nhập.
//
// Danh sách disallow phải bám theo PUBLIC_PATHS (lib/supabase/middleware.ts):
// route nào KHÔNG công khai mà thiếu ở đây thì crawler vẫn bò vào rồi ăn
// redirect `/?auth=signin` — chính lãng phí mà file này sinh ra để chặn.

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/exams",
        "/me",
        "/history",
        "/admin",
        "/upload",
        "/login",
        "/reset-password",
        "/auth/",
        // Cần đăng nhập (Subscription S-01): không nằm trong PUBLIC_PATHS.
        "/pricing",
        // Trang quản lý tài khoản: cần đăng nhập, và nội dung của nó là dữ
        // liệu cá nhân — không có lý do gì để nó xuất hiện trong kết quả tìm
        // kiếm dù chỉ dưới dạng một URL (profile-and-about-prd.md AC-066).
        "/profile",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
