// Layout route group (auth) — khung chung cho /reset-password (và /login, vốn
// chỉ redirect nên không render gì dưới khung này).
//
// Tới 2026-09-10 nhóm này KHÔNG có layout: trang đặt lại mật khẩu là một thẻ
// kem đứng giữa màn hình trống của theme cũ, không thanh trên, không thanh
// đáy. Design doc §3 chốt "một hệ điều hướng cho mọi trang", và người tới đây
// đã có phiên (recovery session từ link email), nên khung hiện đúng tài khoản
// đang đổi mật khẩu — engineer chốt 2026-09-10.
//
// `entitlement: false` như (history): không component nào dưới đây đọc quyền lợi.

import { AppShell } from "@/components/layout/AppShell";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return AppShell({ children, entitlement: false });
}
