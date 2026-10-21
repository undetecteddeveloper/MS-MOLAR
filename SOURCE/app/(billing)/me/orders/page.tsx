// /me/orders — đã gộp vào Hồ sơ (2026-10-21): danh sách đơn nay là phần "Lịch sử mua"
// của tab "Gói" ở /profile. Giữ route để link cũ (email, bookmark) không chết.

import { redirect } from "next/navigation";

export default function MyOrdersPage(): never {
  redirect("/profile?tab=plans");
}
