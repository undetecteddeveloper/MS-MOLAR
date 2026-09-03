// Layout route group (layer4) — khung chung cho MỌI trang Layer 4.
// Theme dùng thẳng root "Mực & Sơn mài" (globals.css) — không có scope riêng.
// SiteHeader dùng chung với Layer 2/3 (xem comment trong SiteHeader.tsx).
//
// Khung dùng chung: components/layout/AppShell.tsx (B1, 2026-09-03) — header,
// SkipLink, BottomNav, SupportWidget và EntitlementProvider đều ở đó.

import { AppShell } from "@/components/layout/AppShell";

export default async function Layer4Layout({ children }: { children: React.ReactNode }) {
  return AppShell({ children });
}
