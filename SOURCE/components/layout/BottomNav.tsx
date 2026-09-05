"use client";

// BottomNav — thanh điều hướng ĐÁY, chỉ hiện dưới 768px.
//
// Lý do tồn tại (Mobile-Layout-Research-MS §4.2): hơn 90% máy bán tại VN có màn
// trên 6 inch, phần trên màn hình là "Vùng Đỏ" ngón cái phải vươn tới. Năm đích
// chính vì thế neo xuống viền dưới. Nó cũng trả một lỗi đo được: trước đây 5
// link + nút ngôn ngữ + ô profile nhồi một hàng làm mọi route tràn ngang 118px
// ở 360px.
//
// SỐ Ô LUÔN LÀ 5, không đổi theo trạng thái đăng nhập: vị trí ô là trí nhớ cơ
// bắp, xê dịch lúc đăng nhập/đăng xuất là phá đúng tính chất khiến thanh đáy
// đáng dùng. Khách bấm ô cần đăng nhập thì middleware đưa về form đăng nhập.
//
// Theme "Sân trường": nền trắng, ô đang chọn = icon đen trong viên thuốc VÀNG
// NẮNG + nhãn đậm. Vàng chỉ đứng SAU icon đen (9,5:1) — tự nó không mang thông
// tin, nên không phạm ngưỡng 3:1 của WCAG 1.4.11.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, History, Home, Upload, type LucideIcon } from "lucide-react";
import { NAV_ITEMS, isExamFocusRoute, isNavItemActive, navPrefetch } from "@/lib/nav/items";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";

// Icon tra theo KHOÁ, không theo thứ tự mảng: thêm/bớt/đổi chỗ một mục trong
// NAV_ITEMS thì icon vẫn đi đúng mục của nó.
const ICONS: Partial<Record<MessageKey, LucideIcon>> = {
  "nav.home": Home,
  "nav.exams": ClipboardList,
  "nav.analytics": BarChart3,
  "nav.history": History,
  "nav.upload": Upload,
};

export function BottomNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();

  // Chế độ tập trung khi làm bài: thanh này vốn chỉ hiện dưới 768px, nên "không
  // render" đúng bằng "ẩn trên mobile". Đọc pathname lúc render ⇒ bản dựng
  // phía server đã đúng, không có khung hình nào thanh này nháy lên rồi mất.
  if (isExamFocusRoute(pathname)) return null;

  return (
    <nav
      // z-40: dưới modal (z-50) và toast (z-70) — thanh điều hướng đè lên hộp
      // thoại xác nhận rời bài sẽ khiến người dùng bấm nhầm đúng lúc mất bài.
      aria-label={t("nav.primary")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <ul className="flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const Icon = ICONS[item.key];
          return (
            <li key={item.key} className="min-w-0 flex-1">
              <Link
                href={item.href}
                prefetch={navPrefetch(item, signedIn)}
                aria-current={active ? "page" : undefined}
                // min-h-15 = 60px = --bottom-nav-h: trên ngưỡng 44–48px của
                // vùng chạm; bề ngang mỗi ô ở 360px là 72px.
                className={[
                  "focus-visible:ring-ring flex min-h-15 flex-col items-center justify-center gap-1 px-1 pt-1.5 pb-1 transition-colors focus-visible:ring-3 focus-visible:ring-inset focus-visible:outline-none",
                  active ? "text-foreground" : "text-muted-foreground active:text-foreground",
                ].join(" ")}
              >
                <span
                  className={`flex h-7 w-11 items-center justify-center rounded-full transition-colors ${
                    active ? "bg-sun" : ""
                  }`}
                >
                  {Icon && <Icon aria-hidden className="size-[22px] shrink-0" strokeWidth={1.9} />}
                </span>
                <span
                  className={`w-full truncate text-center text-[11px] leading-none ${
                    active ? "font-semibold" : "font-medium"
                  }`}
                >
                  {t(item.key)}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
