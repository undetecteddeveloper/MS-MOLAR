// Layout route group (billing) — UI Spec UI-D7.
//
// Khung giống hệt (layer2)/layout.tsx, cộng thêm EntitlementProvider. Ba route
// nằm dưới đây: /pricing (cần đăng nhập) và /terms, /refund-policy (CÔNG KHAI).
//
// Một group chứa cả trang cần đăng nhập lẫn trang công khai là hợp lệ và không
// cần xử lý gì đặc biệt: quyền truy cập do middleware quyết theo TỪNG PATH
// (lib/supabase/middleware.ts PUBLIC_PATHS), không theo route group. Còn khung
// này vốn đã an toàn với khách chưa đăng nhập — getCurrentUserProfile() trả
// null khi không có phiên, SiteHeader đã mặc định `user = null`, và app/page.tsx
// (trang công khai duy nhất hiện có) đang render đúng tổ hợp này cho khách mỗi
// ngày. Không có gì mới bị mạo hiểm ở đây.
//
// Khung dùng chung: components/layout/AppShell.tsx (B1, 2026-09-03) — header,
// SkipLink, BottomNav, SupportWidget và EntitlementProvider đều ở đó.

import { AppShell } from "@/components/layout/AppShell";

export default async function BillingLayout({ children }: { children: React.ReactNode }) {
  return AppShell({ children });
}
