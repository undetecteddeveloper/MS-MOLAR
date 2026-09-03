import Link from "next/link";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { getTranslate } from "@/lib/i18n/server";
import { GUEST_NAV_ITEMS, NAV_ITEMS, navPrefetch } from "@/lib/nav/items";
import type { MessageKey } from "@/lib/i18n/translate";
import { SidebarProfile } from "@/features/auth/components/SidebarProfile";

// HomeSidebar — vertical nav for the homepage (Layer 1 — Entry), Hyperspace
// template layout. "Ink & Lacquer" theme (globals.css): lacquer-black #1B1512
// surface, ivory #EDE1C8 text. All nav rows share the same muted hairline
// divider (active is signalled only by brighter text). Real nav LINKS.
// Server component (SidebarProfile là client con).
//
// S#17 vòng sửa 1:
//  - GUEST: nav có thêm tag "Account" (→ /?auth=signin, mở form auth tại chỗ
//    trong content area); KHÔNG có ô account đáy sidebar.
//  - AUTHED: tag "Account" ẩn đi, thay bằng Ô PROFILE riêng ở góc dưới-trái
//    màn hình (SidebarProfile — dropup "Edit"/"Sign out" function thật).

export async function HomeSidebar({
  user,
  authOpen = false,
}: {
  // Nới thêm `avatarUrl` cho ô profile đáy sidebar. Không nới thì
  // getCurrentUserProfile() vẫn ký URL trên mọi lượt render trang chủ mà không
  // ai tiêu thụ kết quả đó.
  user: { displayName: string; avatarUrl: string | null } | null;
  /** Form auth đang mở trong content area (?auth=) → tag "Account" là tag active. */
  authOpen?: boolean;
}) {
  const t = await getTranslate();
  const items = user ? NAV_ITEMS : GUEST_NAV_ITEMS;
  // Tag đang được chọn highlight đỏ son (server-side theo URL — trang chủ chỉ
  // có 2 trạng thái: hero = Home, form auth mở = Account). So bằng KHOÁ chứ
  // không bằng nhãn hiển thị — nhãn đổi theo ngôn ngữ, khoá thì không.
  const activeKey: MessageKey = authOpen ? "nav.account" : "nav.home";

  return (
    // preload order 0 — sidebar là khối đầu tiên của chuỗi fade (S#21).
    // `max-lg:hidden` (2026-08-07): sidebar này CHỈ còn tồn tại từ 1024px. Dưới
    // ngưỡng đó, trang chủ dùng SiteHeader + BottomNav như mọi trang khác — xem
    // ghi chú trong app/page.tsx về 296px chiều cao mà bản xếp-dọc từng chiếm.
    <aside className="preload-fade hidden shrink-0 flex-col bg-[#1B1512] lg:sticky lg:top-0 lg:flex lg:h-dvh lg:w-80">
      {/* Nav căn giữa dọc (flex-1 + justify-center) trong cột full-height. */}
      <nav className="flex flex-col px-8 py-4 lg:flex-1 lg:justify-center lg:px-10 lg:py-0">
        {items.map((item) => {
          const isActive = item.key === activeKey;
          return (
            <Link
              key={item.key}
              href={item.href}
              // Khách chưa đăng nhập KHÔNG prefetch đích sau-đăng-nhập: mỗi
              // lượt như vậy là một 307 rồi trình duyệt ĐI THEO redirect sang
              // `/?auth=signin` — một lượt render server bỏ đi (xem
              // `navPrefetch`). Sidebar này là nav CHÍNH của trang chủ, tức
              // đúng chỗ khách gặp đầu tiên.
              prefetch={navPrefetch(item, Boolean(user))}
              aria-current={isActive ? "page" : undefined}
              className={[
                // Highlight CHỮ đỏ son (engineer chốt — không thêm bg cho tag);
                // S#26: BORDER cũng chuyển đỏ son khi tag được click — cả
                // pseudo `active:` (ngay lúc nhấn, kể cả tag dẫn route khác)
                // lẫn tag hiện hành (isActive).
                // Màu dùng --brand-on-dark chứ không phải --brand: sidebar là nền
                // đen sơn mài, mà đỏ son gốc #A62C2B trên #1B1512 chỉ đạt 2.44:1
                // — hụt 4.5:1 cho chữ 12px (WCAG 1.4.3) và 3:1 cho viền chỉ báo
                // trạng thái active (WCAG 1.4.11). Chính globals.css cũng cấm đặt đỏ
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
          <SidebarProfile displayName={user.displayName} avatarUrl={user.avatarUrl} />
        </div>
      )}
    </aside>
  );
}
