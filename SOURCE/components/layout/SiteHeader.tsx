"use client";

// SiteHeader — thanh trên DÙNG CHUNG cho mọi trang, kể cả trang chủ (từ
// 2026-09-04 trang chủ không còn sidebar riêng — một hệ điều hướng cho toàn
// site, xem docs/design/ui-refactor-san-truong-design.md §3).
//
// Bố cục theo bề rộng:
//  - ≥768px (md): Wordmark + dãy liên kết + ô tài khoản.
//  - <768px: dãy liên kết ĐI XUỐNG `BottomNav` (vùng ngón cái). Header chỉ còn
//    Wordmark (trái) + ô tài khoản (phải); khách thấy nút "Tài khoản".
//
// Active theo `usePathname()` qua `isNavItemActive` dùng chung (lib/nav/items.ts)
// — header và thanh đáy cùng hiện trên một màn hình, hai bản so khớp riêng sẽ
// có ngày tô sáng hai mục khác nhau. `user` được fetch 1 lần ở layout.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderProfile, type MenuUser } from "@/components/shared/HeaderProfile";
import { Wordmark } from "@/components/layout/Wordmark";
import {
  GUEST_NAV_ITEMS,
  NAV_ITEMS,
  isExamFocusRoute,
  isNavItemActive,
  navPrefetch,
} from "@/lib/nav/items";
import { t } from "@/lib/copy";

export function SiteHeader({ user = null }: { user?: MenuUser | null }) {
  const pathname = usePathname();
  const items = user ? NAV_ITEMS : GUEST_NAV_ITEMS;

  // Chế độ tập trung khi đang làm bài — ẩn header trên MOBILE (60px là khoản
  // chi đáng kể ở 360×800), giữ từ 768px vì desktop không có thanh đáy.
  const focusMode = isExamFocusRoute(pathname);

  return (
    // h-15 (60px): các sticky offset dưới navbar (ExamFilters, ExamPlayer top
    // bar) dùng top-15 khớp theo; html{scroll-padding-top} cũng tính từ đây.
    <header
      className={`sticky top-0 z-30 border-b border-[color:var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur${
        focusMode ? " max-md:hidden" : ""
      }`}
    >
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Wordmark />

        <nav aria-label={t("nav.secondary")} className="flex items-center gap-2 md:gap-3">
          {/* Dãy liên kết — CHỈ từ 768px. Dưới ngưỡng đó chúng sống ở BottomNav;
              render cả hai là hai thanh điều hướng cùng nội dung trên một màn. */}
          <ul className="hidden items-center gap-1 md:flex">
            {items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    // Khách chưa đăng nhập KHÔNG prefetch đích sau-đăng-nhập:
                    // mỗi lượt như vậy là một 307 + một lượt render server của
                    // `/?auth=signin` mà không ai yêu cầu (xem `navPrefetch`).
                    prefetch={navPrefetch(item, Boolean(user))}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      // Mục điều hướng là viên thuốc; mục đang chọn tô nền
                      // surface + chữ đậm — trạng thái đọc được bằng hình lẫn
                      // màu, không chỉ bằng màu.
                      "focus-visible:ring-ring inline-flex h-10 items-center rounded-full px-3 text-sm whitespace-nowrap transition-colors lg:px-3.5 focus-visible:ring-3 focus-visible:outline-none",
                      isActive
                        ? "bg-surface text-foreground font-semibold"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground font-medium",
                    ].join(" ")}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Khách trên MOBILE: mục "Tài khoản" của dãy trên đang ẩn, nên cần
              một lối vào đăng nhập ngay trên header. */}
          {!user && (
            <Link
              href="/?auth=signin"
              className="bg-primary text-primary-foreground focus-visible:ring-ring inline-flex h-10 items-center rounded-full px-4 text-sm font-semibold focus-visible:ring-3 focus-visible:outline-none md:hidden"
            >
              {t("auth.signIn")}
            </Link>
          )}

          {user && <HeaderProfile displayName={user.displayName} avatarUrl={user.avatarUrl} />}
        </nav>
      </div>
    </header>
  );
}
