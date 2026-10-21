// /pricing — đã gộp vào Hồ sơ (2026-10-21): bảng giá nay là tab "Gói" của /profile.
// Giữ route này để link cũ và `cancelUrl` mà payOS đã nhận (lib/billing/orderActions.ts)
// vẫn tới đúng chỗ. Cần đăng nhập (không nằm trong PUBLIC_PATHS) nên khách bị
// middleware đá về đăng nhập trước khi tới đây.

import { redirect } from "next/navigation";

export default function PricingPage(): never {
  redirect("/profile?tab=plans");
}
