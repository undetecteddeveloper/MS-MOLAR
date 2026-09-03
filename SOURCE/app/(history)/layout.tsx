// Layout route group (history) — khung chung cho History (backend Design Doc
// history-backend-design.md v1.2, § Auth Guard and Layout). Structurally
// identical to (analytics)/(authoring) layout.tsx — nullable user, SiteHeader only,
// NO redirect (the guard lives in history/page.tsx instead, see AC-016).
//
// Khung dùng chung: components/layout/AppShell.tsx (B1, 2026-09-03) — header,
// SkipLink, BottomNav, SupportWidget đều ở đó.

import { AppShell } from "@/components/layout/AppShell";

export default async function HMLayout({ children }: { children: React.ReactNode }) {
  // `entitlement: false`: (history) trước B1 là layout DUY NHẤT không mount
  // EntitlementProvider và không gọi readEntitlement(). Giữ nguyên để hành vi
  // không đổi — bật lên là thêm một lượt đọc quyền lợi cho mỗi lần mở /history
  // mà không component nào dưới đó cần, và đó là một quyết định riêng, không
  // phải sản phẩm phụ của việc gộp layout.
  return AppShell({ children, entitlement: false });
}
