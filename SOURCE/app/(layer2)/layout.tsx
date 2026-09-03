// Layout route group (layer2) — khung chung cho MỌI trang Layer 2.
// Theme dùng thẳng root "Mực & Sơn mài" (globals.css, S#17) — không còn scope
// .theme-l2 riêng; navbar đen sơn mài lấy từ biến --nav-* mặc định.
//
// SiteHeader render Ở ĐÂY (1 lần cho mọi trang L2) thay vì lặp lại trong từng
// page — tránh phải truyền `user` prop xuyên qua ExamPlayer (client component)
// và tránh fetch getCurrentUserProfile() nhiều lần mỗi navigation. Các trang
// con KHÔNG còn tự render <SiteHeader/> nữa (đã gỡ), chỉ giữ `bg-background`
// (bỏ `min-h-dvh` — layout này gánh min-h-dvh, tránh cộng dồn chiều cao với
// header 56px gây scrollbar thừa, giống bug đã gặp ở M3.3 homepage).
//
// Khung dùng chung: components/layout/AppShell.tsx (B1, 2026-09-03) — header,
// SkipLink, BottomNav, SupportWidget và EntitlementProvider đều ở đó.

import { AppShell } from "@/components/layout/AppShell";

export default async function Layer2Layout({ children }: { children: React.ReactNode }) {
  return AppShell({ children });
}
