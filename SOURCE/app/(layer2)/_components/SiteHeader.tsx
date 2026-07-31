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

type NavItem = { label: string; href: string };

// Cùng bộ nav với HomeSidebar (L1) — đồng bộ 100% (engineer chốt S#19 Q2).
const NAV: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Exams", href: "/exams" },
  { label: "Analytics", href: "/me/dashboard" },
  { label: "History", href: "/history" },
  // UGC v2.0 (Task 6.1): Import→Upload cho MỌI user; KHÔNG có mục admin.
  { label: "Upload", href: "/upload" },
];

const GUEST_NAV: NavItem[] = [...NAV, { label: "Account", href: "/?auth=signin" }];

export function SiteHeader({ user = null }: { user?: MenuUser | null }) {
  const pathname = usePathname();
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
        <Link href="/" aria-label="Home" className="shrink-0 max-sm:hidden">
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
                key={item.label}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                className={[
                  "relative font-sans text-xs font-medium tracking-[0.2em] whitespace-nowrap uppercase transition-colors max-sm:text-[10px] max-sm:tracking-[0.08em]",
                  // Underline đỏ son: origin-center + scale-x nên "nở" ra hai bên
                  // thay vì kéo từ một cạnh — hover/active(click)/isActive đều mở.
                  "after:absolute after:-bottom-1.5 after:left-1/2 after:h-[2px] after:w-full after:origin-center after:-translate-x-1/2 after:scale-x-0 after:bg-[#A62C2B] after:transition-transform after:duration-300 after:content-['']",
                  isActive
                    ? "text-[#A62C2B] after:scale-x-100"
                    : "text-[#EDE1C8]/55 hover:text-[#EDE1C8] hover:after:scale-x-100 active:text-[#A62C2B] active:after:scale-x-100",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}

          {/* Ô profile — chỉ khi đã đăng nhập (guest dùng tag Account ở trên). */}
          {user && <HeaderProfile displayName={user.displayName} />}
        </nav>
      </div>
    </header>
  );
}
