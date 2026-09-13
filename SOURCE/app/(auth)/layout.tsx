// Layout route group (auth) — khung cho /reset-password (và /login, vốn chỉ
// redirect nên không render gì dưới khung này).
//
// 2026-09-10 khung này là AppShell đầy đủ (thanh trên, thanh đáy, nút hỗ trợ)
// theo "một hệ điều hướng cho mọi trang". 2026-09-13 đảo lại, sau khi engineer
// test trên điện thoại thật: người tới đây đang ở GIỮA việc đặt lại mật khẩu,
// middleware ép phiên khôi phục về đúng trang này (lib/auth/recovery.ts) —
// một thanh điều hướng mời họ đi chỗ khác, rồi bị đẩy về, là một vòng lặp
// nhìn thấy được. Còn lại: SkipLink + thanh trên chỉ có mốc thương hiệu +
// nội dung. Lối ra duy nhất là "Đăng xuất" ngay trong trang.
//
// Không EntitlementProvider: không component nào dưới đây đọc quyền lợi.

import { SkipLink } from "@/components/shared/SkipLink";
import { Wordmark } from "@/components/layout/Wordmark";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SkipLink />
      {/* Cùng chiều cao (h-15) và viền với SiteHeader để trang không "đổi
          khung" so với phần còn lại của site. */}
      <header className="border-b border-[color:var(--nav-border)] bg-[var(--nav-bg)]">
        <div className="mx-auto flex h-15 w-full max-w-6xl items-center px-4 sm:px-6">
          <Wordmark />
        </div>
      </header>
      {/* id + tabIndex={-1}: đích nhảy của SkipLink (WCAG 2.4.1). */}
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
    </div>
  );
}
