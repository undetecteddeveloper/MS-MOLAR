"use client";

// BottomNav — thanh điều hướng ĐÁY, chỉ hiện dưới 768px.
//
// Lý do tồn tại (tài liệu Mobile-Layout-Research-MS §4.2 "Kiến trúc
// Bottom-Heavy"): hơn 90% máy bán ra tại VN có màn hình trên 6 inch, nên phần
// trên cùng màn hình là "Vùng Đỏ" — ngón cái phải vươn tới, thường buộc đổi tư
// thế cầm hoặc dùng tay thứ hai. Năm đích chính vì thế được bóc khỏi header và
// neo xuống viền dưới (Vùng Xanh).
//
// Nó đồng thời trả một lỗi ĐO ĐƯỢC: trước thay đổi này, dãy 5 nav link + nút
// ngôn ngữ + ô profile nhồi trong MỘT hàng ngang làm mọi route đã đăng nhập
// tràn ngang 118px ở viewport 360px (scrollWidth 468 / clientWidth 350), và ô
// profile nằm hẳn ngoài màn hình ở x=402–468.
//
// SỐ Ô LUÔN LÀ 5, không đổi theo trạng thái đăng nhập. Guest KHÔNG được thêm ô
// "Account" ở đây (tag đó ở lại trên header): vị trí của một ô trong thanh đáy
// là trí nhớ cơ bắp — người dùng bấm theo VỊ TRÍ chứ không đọc nhãn — nên xê
// dịch nó lúc đăng nhập/đăng xuất là phá đúng cái tính chất khiến bottom nav
// đáng dùng. Đây cũng là lý do dùng `NAV_ITEMS` chứ không phải `GUEST_NAV_ITEMS`.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ClipboardList, History, Home, Upload, type LucideIcon } from "lucide-react";
import { NAV_ITEMS, isExamFocusRoute, isNavItemActive, navPrefetch } from "@/lib/nav/items";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

// Icon tra theo KHOÁ i18n, không theo thứ tự mảng: thêm/bớt/đổi chỗ một mục
// trong NAV_ITEMS thì icon vẫn đi đúng mục của nó.
// `Partial<Record<…>>` chứ không phải `Record<…>`: MessageKey là toàn bộ tập
// khoá của từ điển (hàng trăm khoá), khai đủ là vô nghĩa — nhưng kiểu này vẫn
// bắt được lỗi gõ sai tên khoá, là thứ thật sự cần bắt.
const ICONS: Partial<Record<MessageKey, LucideIcon>> = {
  "nav.home": Home,
  "nav.exams": ClipboardList,
  "nav.analytics": BarChart3,
  "nav.history": History,
  "nav.upload": Upload,
};

export function BottomNav({ signedIn = false }: { signedIn?: boolean }) {
  const pathname = usePathname();
  const t = useT();

  // Chế độ tập trung khi đang làm bài (isExamFocusRoute). Thanh này vốn CHỈ
  // hiện dưới 768px (`md:hidden`), nên "không render" ở đây đúng bằng "ẩn trên
  // mobile" — không cần thêm class nào. Đọc pathname lúc render chứ không phải
  // trong effect ⇒ bản dựng phía server đã đúng, không có một khung hình nào
  // thanh này kịp nháy lên rồi biến mất.
  if (isExamFocusRoute(pathname)) return null;

  return (
    <nav
      // `md:hidden` — trên ≥768px tài liệu §3.1 nói bề ngang đã đủ để bỏ lối
      // điều hướng nén và quay lại dãy tag ngang, việc mà SiteHeader lo.
      //
      // z-40: dưới modal (z-50: LeaveExamDialog, ReportExam, DeleteDialog) và
      // dưới toast (z-70) — một thanh điều hướng đè lên hộp thoại xác nhận rời
      // trang sẽ khiến người dùng bấm nhầm ngay giữa lúc đang mất bài làm.
      aria-label={t("nav.primary")}
      className="border-t border-[color:var(--nav-border)] bg-[var(--nav-bg)] fixed inset-x-0 bottom-0 z-40 backdrop-blur md:hidden"
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
                // Xem `navPrefetch`: với khách, prefetch một đích sau-đăng-nhập
                // đổi lấy một 307 + một lượt render server hoàn toàn bỏ đi.
                prefetch={navPrefetch(item, signedIn)}
                aria-current={active ? "page" : undefined}
                // min-h-14 = 56px: trên ngưỡng 44–48px mà tài liệu §4.3 yêu cầu
                // cho vùng chạm. Chia đều `flex-1` nên bề ngang mỗi ô ở 360px
                // là 72px — cũng vượt ngưỡng.
                className={[
                  "flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-1.5 transition-colors",
                  // Màu chữ/icon trên nền đen sơn mài phải dùng
                  // --brand-on-dark: đỏ son gốc #A62C2B trên #1B1512 chỉ đạt
                  // 2.44:1, hụt cả 4.5:1 (chữ) lẫn 3:1 (chỉ báo phi văn bản).
                  active
                    ? "text-[color:var(--brand-on-dark)]"
                    : "text-[#EDE1C8]/60 active:text-[#EDE1C8]",
                ].join(" ")}
              >
                {Icon && <Icon aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />}
                {/* Nhãn KHÔNG uppercase-tracking như dãy tag desktop: ở 10px
                    cộng tracking 0.2em thì "Thống kê" tràn khỏi ô 72px. Đây là
                    chỗ bố cục thắng sự đồng bộ hình thức — nhãn đọc được quan
                    trọng hơn việc trông giống hệt navbar desktop. */}
                <span className="w-full truncate text-center font-sans text-[10px] leading-none font-medium">
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
