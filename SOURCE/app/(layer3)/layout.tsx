// Layout route group (layer3) — khung chung cho Analytics. Theme dùng thẳng
// root "Mực & Sơn mài" (globals.css), SiteHeader dùng chung với Layer 2/4
// (xem comment trong SiteHeader.tsx).
//
// Khung dùng chung: components/layout/AppShell.tsx (B1, 2026-09-03) — header,
// SkipLink, BottomNav, SupportWidget và EntitlementProvider đều ở đó.

import { AppShell } from "@/components/layout/AppShell";

export default async function Layer3Layout({ children }: { children: React.ReactNode }) {
  // VÌ SAO (layer3) CẦN EntitlementProvider, dù trước đây không: /profile nay có
  // tab Usage render `PlanSummary` (C-11), và `useEntitlement()` NGOÀI provider
  // trả `FREE_FALLBACK` — tức một người Premium sẽ thấy hạn mức của gói Free,
  // im lặng, không lỗi, không log. Đó đúng là kiểu hỏng mà `TutorQuotaNote`
  // đã phải ghi cả một khối chú thích để cảnh báo. Mặc định của AppShell là
  // CÓ provider — đúng thứ layout này cần.
  return AppShell({ children });
}
