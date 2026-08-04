import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Sitemap chỉ có MỘT url và đó là đúng: mọi route khác đều nằm sau đăng nhập
// (proxy.ts), crawler vào chỉ nhận redirect. Liệt kê chúng ở đây sẽ tạo lỗi
// "Redirect error" trong Search Console chứ không thêm được gì.
//
// Khi nào mở trang đề công khai (không cần đăng nhập vẫn xem được đề) thì bổ
// sung tại đây bằng cách query danh sách exam đã publish.

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1,
    },
  ];
}
