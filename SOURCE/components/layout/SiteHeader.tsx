"use client";

// SiteHeader — navbar DÙNG CHUNG cho UI Layer 2/3/4 + History, và (từ
// 2026-08-07) cho cả TRANG CHỦ ở dưới 1024px.
//
// Bố cục theo bề rộng (tài liệu Mobile-Layout-Research-MS §3.1 + §4.2):
//  - ≥768px (md): giữ nguyên như trước — logo + dãy 5 tag ngang + nút ngôn ngữ
//    + ô profile. Không đổi gì so với bản desktop cũ.
//  - <768px: dãy 5 tag ĐI XUỐNG `BottomNav` (Vùng Xanh của ngón cái). Header
//    chỉ còn logo (trái) + nút ngôn ngữ và ô profile (phải).
//
// Vì sao nút ngôn ngữ và ô profile Ở LẠI header thay vì xuống thanh đáy: cả
// hai là thao tác HIẾM (đổi ngôn ngữ một lần rồi thôi; sửa tên/đăng xuất càng
// hiếm), trong khi thanh đáy chỉ có 5 chỗ và mỗi chỗ nên dành cho một đích
// người dùng quay lại nhiều lần. Đặt thứ hiếm dùng vào Vùng Xanh là lấy mất
// chỗ của thứ hay dùng.
//
// Guest: tag "Account" nằm trong dãy tag ngang (desktop) và hiện thành nút
// riêng ở header trên mobile — KHÔNG đẩy xuống thanh đáy, để thanh đáy giữ
// đúng 5 ô ở mọi trạng thái đăng nhập (xem BottomNav.tsx).
//
// Active tag theo `usePathname()` qua `isNavItemActive` dùng chung
// (lib/nav/items.ts) — header và thanh đáy cùng hiển thị trên một màn hình,
// hai bản so khớp riêng sẽ có ngày tô sáng hai mục khác nhau.
// `user` được fetch 1 lần ở layout của từng route group.

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HeaderProfile, type MenuUser } from "@/components/shared/HeaderProfile";
import { LanguageToggle } from "@/components/shared/LanguageToggle";
import { GUEST_NAV_ITEMS, NAV_ITEMS, isExamFocusRoute, isNavItemActive } from "@/lib/nav/items";
import { useT } from "@/lib/i18n/client";

export function SiteHeader({ user = null }: { user?: MenuUser | null }) {
  const pathname = usePathname();
  const t = useT();
  const items = user ? NAV_ITEMS : GUEST_NAV_ITEMS;

  // Chế độ tập trung khi đang làm bài — ẩn header trên MOBILE, giữ nguyên trên
  // ≥768px (ở đó 60px header không phải khoản chi đáng kể, và desktop không có
  // thanh đáy nên đây là lối điều hướng duy nhất). `max-md:hidden` chứ không
  // phải `return null`: xem isExamFocusRoute trong lib/nav/items.ts.
  const focusMode = isExamFocusRoute(pathname);

  return (
    // preload order 0 — navbar là khối đầu tiên của chuỗi fade (S#21).
    // h-15 (60px, S#21): các sticky offset dưới navbar (ExamFilters,
    // ExamPlayer top bar) phải dùng top-15 khớp theo.
    <header
      className={`preload-fade sticky top-0 z-30 border-b border-[color:var(--nav-border)] bg-[var(--nav-bg)] backdrop-blur${
        focusMode ? " max-md:hidden" : ""
      }`}
    >
      <div className="mx-auto flex h-15 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        {/* Logo — neo về trang chủ. Trước 2026-08-07 nó bị `max-sm:hidden` vì 5
            tag không đủ chỗ ở màn hẹp; nay tag đã dọn xuống BottomNav nên logo
            hiện ở MỌI bề rộng và header mobile có mốc nhận diện thương hiệu
            (tài liệu §4.2: "Header phía trên chỉ nên đóng vai trò là một biển
            báo nhận diện thương hiệu"). Ảnh gốc 715×650 — height 38px. */}
        {/* `min-h-11` + `-ml-1 px-1`: ảnh logo cao 38px nên vùng bấm hụt sàn
            44px (§4.3). Nới bằng chiều cao tối thiểu, rồi kéo lại 4px lề trái
            để mép logo vẫn thẳng hàng với mép nội dung bên dưới — vùng chạm to
            ra mà bố cục nhìn thấy được thì không xê dịch. */}
        <Link
          href="/"
          aria-label={t("nav.home")}
          className="-ml-1 flex min-h-11 shrink-0 items-center px-1"
        >
          {/* `priority` (perf audit 2026-08-15): dưới 1024px header này là khối
              đầu tiên có ảnh, nên Lighthouse chấm CHÍNH logo 42×38 này là phần
              tử LCP. Mặc định next/image phát `loading="lazy"` + không có
              `fetchpriority`, khiến trình duyệt xếp nó sau 12 file font và toàn
              bộ chunk JS → LCP 4.6s (Poor) trong khi FCP chỉ 0.9s. `priority`
              đổi thành eager + fetchpriority=high + <link rel=preload>.
              ⚠ KHÔNG rải `priority` sang các <Image> khác: nó chỉ có nghĩa khi
              số ảnh được ưu tiên đủ nhỏ để thật sự giành được băng thông. */}
          <Image
            src="/images/brand_logo.png"
            alt="Trạng Nguyên"
            width={42}
            height={38}
            priority
            className="h-[38px] w-auto"
          />
        </Link>

        <nav aria-label={t("nav.secondary")} className="flex items-center gap-3 md:gap-4 lg:gap-8">
          {/* Dãy tag ngang — CHỈ từ 768px trở lên. Dưới ngưỡng đó chúng sống ở
              BottomNav; render cả hai sẽ là hai thanh điều hướng cùng nội dung
              trên một màn hình.
              Khoảng cách theo nấc: ĐÚNG tại 768px (nấc hẹp nhất còn hiển thị
              dãy này) logo + 5 tag + nút ngôn ngữ + ô profile chỉ vừa đủ chỗ —
              đo được tràn 13px khi dùng gap-6, nên nấc md dùng gap-4 và chỉ nới
              lên gap-8 từ 1024px. */}
          <ul className="hidden items-center gap-4 md:flex lg:gap-8">
            {items.map((item) => {
              const isActive = isNavItemActive(pathname, item.href);
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={[
                      // `flex items-center py-2`: chữ 12px chỉ cao ~16px nên
                      // vùng bấm hụt ngưỡng 24×24px CSS (WCAG 2.5.8). py-2 nâng
                      // lên 32px mà không dịch layout vì header đã là flex
                      // căn giữa. (Ngưỡng 44px của tài liệu §4.3 áp cho giao
                      // diện CẢM ỨNG — dãy này chỉ hiện từ 768px, nơi đầu vào
                      // chính là chuột; thanh đáy mới là bản chạm và nó dùng
                      // 56px.)
                      "relative flex items-center py-2 font-sans text-xs font-medium tracking-[0.2em] whitespace-nowrap uppercase transition-colors",
                      // Underline đỏ son nở ra hai bên từ giữa.
                      // --brand-on-dark: đỏ son gốc #A62C2B trên nền navbar đen
                      // chỉ đạt 2.44:1, hụt cả 4.5:1 (chữ) lẫn 3:1 (gạch chân
                      // là chỉ báo phi văn bản).
                      "after:absolute after:bottom-0 after:left-1/2 after:h-[2px] after:w-full after:origin-center after:-translate-x-1/2 after:scale-x-0 after:bg-[color:var(--brand-on-dark)] after:transition-transform after:duration-300 after:content-['']",
                      isActive
                        ? "text-[color:var(--brand-on-dark)] after:scale-x-100"
                        : "text-[#EDE1C8]/55 hover:text-[#EDE1C8] hover:after:scale-x-100 active:text-[color:var(--brand-on-dark)] active:after:scale-x-100",
                    ].join(" ")}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>

          {/* Guest trên MOBILE: tag "Account" của dãy trên đang bị ẩn, nên cần
              một lối vào đăng nhập hiện ngay trên header. Ẩn từ md trở lên để
              không thành hai lối vào trùng nhau. */}
          {!user && (
            <Link
              href="/?auth=signin"
              className="flex min-h-11 items-center rounded-sm px-2 font-sans text-xs font-medium tracking-[0.12em] whitespace-nowrap text-[#EDE1C8]/70 uppercase transition-colors active:text-[color:var(--brand-on-dark)] md:hidden"
            >
              {t("nav.account")}
            </Link>
          )}

          <LanguageToggle />

          {user && <HeaderProfile displayName={user.displayName} avatarUrl={user.avatarUrl} />}
        </nav>
      </div>
    </header>
  );
}
