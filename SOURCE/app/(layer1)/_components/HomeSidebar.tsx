import Link from "next/link";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { getTranslate } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import { SidebarProfile } from "./SidebarProfile";

// HomeSidebar — vertical nav for the homepage (Layer 1 — Entry), Hyperspace
// template layout. "Ink & Lacquer" theme (DESIGN.md): lacquer-black #1B1512
// surface, ivory #EDE1C8 text. All nav rows share the same muted hairline
// divider (active is signalled only by brighter text). Real nav LINKS.
// Server component (SidebarProfile là client con).
//
// S#17 vòng sửa 1:
//  - GUEST: nav có thêm tag "Account" (→ /?auth=signin, mở form auth tại chỗ
//    trong content area); KHÔNG có ô account đáy sidebar.
//  - AUTHED: tag "Account" ẩn đi, thay bằng Ô PROFILE riêng ở góc dưới-trái
//    màn hình (SidebarProfile — dropup "Edit"/"Sign out" function thật).

// Giữ KHOÁ i18n thay vì chuỗi sẵn — mảng ở cấp module không tra từ điển được.
type NavItem = { key: MessageKey; href: string };

const NAV: NavItem[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.exams", href: "/exams" },
  { key: "nav.analytics", href: "/me/dashboard" },
  { key: "nav.history", href: "/history" },
  // UGC v2.0 (Task 6.1): Import→Upload cho MỌI user; KHÔNG có mục admin.
  { key: "nav.upload", href: "/upload" },
];

const GUEST_NAV: NavItem[] = [...NAV, { key: "nav.account", href: "/?auth=signin" }];

export async function HomeSidebar({
  user,
  authOpen = false,
}: {
  user: { displayName: string } | null;
  /** Form auth đang mở trong content area (?auth=) → tag "Account" là tag active. */
  authOpen?: boolean;
}) {
  const t = await getTranslate();
  const items = user ? NAV : GUEST_NAV;
  // Tag đang được chọn highlight đỏ son (server-side theo URL — trang chủ chỉ
  // có 2 trạng thái: hero = Home, form auth mở = Account). So bằng KHOÁ chứ
  // không bằng nhãn hiển thị — nhãn đổi theo ngôn ngữ, khoá thì không.
  const activeKey: MessageKey = authOpen ? "nav.account" : "nav.home";

  return (
    // preload order 0 — sidebar là khối trên cùng (mobile) / đầu tiên của chuỗi fade (S#21).
    <aside className="preload-fade flex shrink-0 flex-col bg-[#1B1512] lg:sticky lg:top-0 lg:h-dvh lg:w-80">
      {/* Desktop: nav vertically centered (flex-1 + justify-center) inside the
          full-height column. Mobile: sidebar is a top strip, rows stacked
          (compact padding — trang không cuộn, S#17 vòng sửa 1). */}
      <nav className="flex flex-col px-8 py-4 lg:flex-1 lg:justify-center lg:px-10 lg:py-0">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                // Highlight CHỮ đỏ son (engineer chốt — không thêm bg cho tag);
                // S#26: BORDER cũng chuyển đỏ son khi tag được click — cả
                // pseudo `active:` (ngay lúc nhấn, kể cả tag dẫn route khác)
                // lẫn tag hiện hành (isActive).
                // Màu dùng --brand-on-dark chứ không phải --brand: sidebar là nền
                // đen sơn mài, mà đỏ son gốc #A62C2B trên #1B1512 chỉ đạt 2.44:1
                // — hụt 4.5:1 cho chữ 12px (WCAG 1.4.3) và 3:1 cho viền chỉ báo
                // trạng thái active (WCAG 1.4.11). Chính DESIGN.md cũng cấm đặt đỏ
                // son trên đen sơn mài ở cỡ nhỏ hơn 24px.
                "block border-b-2 py-2.5 text-right font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors active:border-[color:var(--brand-on-dark)] active:text-[color:var(--brand-on-dark)] lg:py-3.5",
                isActive
                  ? "border-[color:var(--brand-on-dark)] text-[color:var(--brand-on-dark)]"
                  : "border-[#EDE1C8]/12 text-[#EDE1C8]/55 hover:text-[#EDE1C8]",
              ].join(" ")}
            >
              {t(item.key)}
            </Link>
          );
        })}

        {/* Nút chuyển ngôn ngữ — căn phải cho khớp dãy tag (text-right ở trên). */}
        <LanguageToggle className="mt-3 self-end" />
      </nav>

      {/* Ô profile — góc dưới-trái màn hình, CHỈ khi đã đăng nhập. */}
      {user && (
        <div className="px-8 pb-4 lg:px-10 lg:pb-8">
          <SidebarProfile displayName={user.displayName} />
        </div>
      )}
    </aside>
  );
}
