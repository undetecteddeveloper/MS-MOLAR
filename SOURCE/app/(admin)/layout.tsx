// Layout route group (admin) — khung chung cho /admin và /admin/tickets.
//
// Tới 2026-09-10 nhóm này KHÔNG có layout: hai trang quản trị tự bọc mình trong
// `min-h-dvh` và không có thanh trên, thanh đáy hay nút hỗ trợ — người quản trị
// vào /admin không có lối nào về ngoài nút Back của trình duyệt. Design doc §3
// chốt "một hệ điều hướng cho mọi trang", nên nhóm này nhận cùng AppShell.
//
// Quyền quản trị KHÔNG kiểm ở đây: mỗi trang tự `notFound()` theo allowlist
// (lib/auth/admin.ts) — layout chỉ dựng khung, không phải cổng.
//
// `entitlement: false` như (history): không component nào dưới đây đọc quyền
// lợi, bật lên là thêm một lượt đọc cho mỗi lần mở trang quản trị.
//
// Khung dùng chung: components/layout/AppShell.tsx — header, SkipLink,
// BottomNav, SupportWidget đều ở đó. Gọi như HÀM (không phải JSX), xem chú
// thích ở AppShell về làn fixture và bộ render client của React 19.

import { AppShell } from "@/components/layout/AppShell";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  return AppShell({ children, entitlement: false });
}
