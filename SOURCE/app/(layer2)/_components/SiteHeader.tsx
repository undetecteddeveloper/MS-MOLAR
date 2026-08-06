"use client";

// SiteHeader — navbar DÙNG CHUNG cho UI Layer 2/3/4 (KHÔNG dùng cho L1 — L1 có
// HomeSidebar riêng). S#19: đồng bộ theo MẪU sidebar homepage nhưng nằm NGANG
// phía trên — cùng bộ nav items (Home / Analytics / History / Import), cùng
// style tag (uppercase tracking rộng, muted → hover sáng, active = CHỮ đỏ son,
// không bg — chốt S#17 vòng 3), nhãn tiếng Anh.
//  - Guest: thêm tag "Account" (→ /?auth=signin, mở form auth trong homepage).
//  - Authed: tag "Account" ẩn, thay bằng ô HeaderProfile (avatar + tên +
//    dropdown Edit/Sign out mở xuống) — đối xứng SidebarProfile của homepage.
// Active tag theo usePathname() (header sống trên nhiều route, khác homepage
// truyền prop tĩnh). Nền theo token --nav-* ở :root (đen sơn mài).
// `user` được fetch 1 lần ở (layer2)/layout.tsx.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderProfile, type MenuUser } from "@/components/shared/HeaderProfile";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

// Nhãn giữ dưới dạng KHOÁ i18n chứ không phải chuỗi sẵn: mảng này nằm ở cấp
// module nên chỉ chạy một lần lúc nạp, không thể tra từ điển tại đó được.
type NavItem = { key: MessageKey; href: string };

// Cùng bộ nav với HomeSidebar (L1) — đồng bộ 100% (engineer chốt S#19 Q2).
const NAV: NavItem[] = [
  { key: "nav.home", href: "/" },
  { key: "nav.exams", href: "/exams" },
  { key: "nav.analytics", href: "/me/dashboard" },
  { key: "nav.history", href: "/history" },
  // UGC v2.0 (Task 6.1): Import→Upload cho MỌI user; KHÔNG có mục admin.
  { key: "nav.upload", href: "/upload" },
];

const GUEST_NAV: NavItem[] = [...NAV, { key: "nav.account", href: "/?auth=signin" }];

export function SiteHeader({ user = null }: { user?: MenuUser | null }) {
  const pathname = usePathname();
  const t = useT();
  const items = user ? NAV : GUEST_NAV;

  return (
    // preload order 0 — navbar là khối đầu tiên của chuỗi fade (S#21).
    // h-15 (60px, S#21 — tăng từ h-14 để logo lớn hơn): các sticky offset
    // dưới navbar (ExamFilters, ExamPlayer top bar) phải dùng top-15 khớp theo.
    <header className="preload-fade sticky top-0 z-30 border-b border-[color:var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur">
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo — brand_logo.png (S#20, thay text "Trạng Nguyên") — neo về trang
            chủ. Ẩn ở màn hẹp nhất (nav 5 tag không đủ chỗ; tag "Home" đã gánh
            vai trò neo nên không mất chức năng). Ảnh gốc 715×650 — height
            38px (+6%, S#21), width auto theo tỉ lệ. */}
        <Link href="/" aria-label={t("nav.home")} className="shrink-0 max-sm:hidden">
          <Image
            src="/images/brand_logo.png"
            alt="Trạng Nguyên"
            width={42}
            height={38}
            className="h-[38px] w-auto"
          />
        </Link>

        {/* Dãy tag ngang — style chép từ HomeSidebar (bỏ hairline chia dòng vì
            các tag nằm ngang, đường kẻ dọc giữa tag sẽ thành nhiễu). Mobile:
            logo ẩn → nav giãn hết bề ngang (justify-between), chữ/tracking nén. */}
        <nav className="flex items-center gap-3 max-sm:w-full max-sm:justify-between sm:gap-8 lg:gap-10">
          {items.map((item) => {
            const isActive =
              item.href !== "#" &&
              (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href));
            return (
              <Link
                key={item.key}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  // `flex items-center py-2` (thay vì text trần): chữ 12px chỉ cao
                  // ~16px nên vùng bấm hụt ngưỡng 24×24px CSS của WCAG 2.5.8
                  // Target Size (Minimum). py-2 nâng lên 32px mà không dịch layout
                  // vì header đã là flex căn giữa.
                  "relative flex items-center py-2 font-sans text-xs font-medium tracking-[0.2em] whitespace-nowrap uppercase transition-colors max-sm:text-[10px] max-sm:tracking-[0.08em]",
                  // Underline đỏ son: origin-center + scale-x nên "nở" ra hai bên
                  // thay vì kéo từ một cạnh — hover/active(click)/isActive đều mở.
                  // Màu lấy --brand-on-dark: đỏ son gốc #A62C2B trên nền navbar đen
                  // chỉ đạt 2.44:1, hụt cả 4.5:1 (chữ, WCAG 1.4.3) lẫn 3:1 (gạch
                  // chân là chỉ báo phi văn bản, WCAG 1.4.11).
                  "after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-full after:origin-center after:-translate-x-1/2 after:scale-x-0 after:bg-[color:var(--brand-on-dark)] after:transition-transform after:duration-300 after:content-['']",
                  isActive
                    ? "text-[color:var(--brand-on-dark)] after:scale-x-100"
                    : "text-[#EDE1C8]/55 hover:text-[#EDE1C8] hover:after:scale-x-100 active:text-[color:var(--brand-on-dark)] active:after:scale-x-100",
                ].join(" ")}
              >
                {t(item.key)}
              </Link>
            );
          })}

          {/* Nút chuyển ngôn ngữ — nằm cuối dãy tag, trước ô profile. */}
          <LanguageToggle />

          {/* Ô profile — chỉ khi đã đăng nhập (guest dùng tag Account ở trên). */}
          {user && <HeaderProfile displayName={user.displayName} />}
        </nav>
      </div>
    </header>
  );
}
