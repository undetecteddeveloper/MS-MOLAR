import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/siteUrl";

// Sitemap chỉ liệt kê route THẬT SỰ công khai: mọi route khác nằm sau đăng nhập
// (proxy.ts), crawler vào chỉ nhận redirect, và liệt kê chúng sẽ tạo lỗi
// "Redirect error" trong Search Console chứ không thêm được gì.
//
// Danh sách này phải khớp PUBLIC_PATHS (lib/supabase/middleware.ts) ở phần các
// trang ĐỌC ĐƯỢC — không khớp thì trang công khai đúng nhưng vô hình với công
// cụ tìm kiếm, một kiểu hỏng không có triệu chứng nào trong app. Hai ngoại lệ
// cố ý KHÔNG có mặt ở đây: `/login` (chỉ là redirect stub) và `/auth/callback`
// (route handler, không phải trang).
//
// Khi nào mở trang đề công khai (không cần đăng nhập vẫn xem được đề) thì bổ
// sung tại đây bằng cách query danh sách exam đã publish.

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    {
      url: `${SITE_URL}/`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    // Trang pháp lý (Subscription R11). Đổi rất hiếm và không phải đích tìm
    // kiếm chính, nên yearly + priority thấp — nhưng vẫn phải index được: một
    // trang điều khoản không tìm thấy thì cũng gần như không tồn tại.
    {
      url: `${SITE_URL}/terms`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/refund-policy`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.3,
    },
    // Trang giới thiệu + liên hệ (ADR-0017). Ưu tiên cao hơn hai trang pháp lý
    // vì đây LÀ một đích tìm kiếm thật — người ta tra tên đơn vị vận hành và
    // số điện thoại — trong khi /terms và /refund-policy chỉ cần index được.
    // Chưa có liên kết in-app nào trỏ tới nó (NAV_ITEMS đã kín 5 chỗ, repo
    // không có footer), nên sitemap hiện là đường vào duy nhất ngoài gõ URL.
    {
      url: `${SITE_URL}/about`,
      lastModified,
      changeFrequency: "yearly",
      priority: 0.5,
    },
  ];
}
