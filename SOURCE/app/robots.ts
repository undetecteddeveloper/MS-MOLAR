import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Trước đây /robots.txt trả 404 — crawler tự do bò vào mọi route rồi ăn
// redirect `/?auth=signin` (proxy.ts chỉ để lọt PUBLIC_PATHS = `/`, `/login`,
// `/auth/callback`). Không hỏng gì, nhưng phí crawl budget và có nguy cơ lộ
// URL nội bộ trong báo cáo Search Console.
//
// Chỉ `/` là trang thật sự công khai và đáng index, nên allowlist đúng nó.

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
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
