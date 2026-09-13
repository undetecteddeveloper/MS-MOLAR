"use client";

// HeaderProfile — ô tài khoản trong SiteHeader, CHỈ render khi ĐÃ đăng nhập
// (khách thấy nút "Đăng nhập" thay thế). Từ 2026-09-04 đây là ô tài khoản DUY
// NHẤT của site (SidebarProfile của trang chủ cũ đã gỡ cùng sidebar).
//
// Menu ba đường: Hồ sơ → /profile, Đề của tôi → /me/exams, Đăng xuất (Server
// Action). Mục "Sửa tên" đã bỏ từ 2026-08-17 — /profile làm việc đó tử tế hơn.
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import { Avatar } from "@/components/shared/Avatar";
import { POP_EXIT_MS, usePresence } from "@/components/shared/usePresence";

export type MenuUser = { displayName: string; avatarUrl: string | null };

/** Một mục trong menu. Dùng chung cho cả ba mục để chúng không trôi khỏi nhau
 *  về padding hay cỡ chữ; `tone` là chỗ DUY NHẤT chúng được phép khác nhau. */
function itemCls(tone: "default" | "danger" = "default"): string {
  return [
    "hover:bg-surface block w-full rounded-lg px-3.5 py-2.5 text-center text-sm font-medium whitespace-nowrap transition-colors",
    tone === "danger" ? "text-destructive" : "text-foreground",
  ].join(" ");
}

export function HeaderProfile({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  // Menu ở lại thêm 120ms sau khi đóng để chạy chiều thu (globals.css
  // §CHUYỂN ĐỘNG); scrim thì gỡ ngay — không giữ một lớp chặn click vô hình.
  const { present, closing } = usePresence(open, POP_EXIT_MS);

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative min-w-0">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      {/* Trigger — avatar + tên (ẩn dưới 1024px). min-h-11: sàn 44px.
          min-w-0 ở tên (và ở <div> bọc ngoài) để tên CO LẠI và cắt "…" khi header
          hết chỗ — không có nó, flex item giữ bề rộng nội dung và tên dài đẩy cả
          header tràn ngang ở 768px (xem chú thích tại <nav> trong SiteHeader).
          Mũi tên ▾ bỏ 2026-09-13 (engineer, test điện thoại thật): viên thuốc
          surface + `aria-haspopup` đã nói đây là nút mở menu; mũi tên chỉ thêm
          16px vào một hàng vốn chật ở 360px. Đệm phải bằng đệm trái khi chỉ có
          avatar, nới ra 12px từ 1024px để tên không dính mép. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="bg-surface hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)] focus-visible:ring-ring flex max-w-full min-h-11 items-center gap-2 rounded-full px-1.5 py-1 transition-[background-color,scale] ease-out motion-safe:active:scale-97 focus-visible:ring-3 focus-visible:outline-none lg:pr-3"
      >
        {/* Avatar thay cho <Image>: next.config.ts không khai remotePatterns,
            URL Supabase đưa vào <Image> là lỗi LÚC CHẠY. */}
        <Avatar src={avatarUrl} name={displayName} size={28} className="shrink-0" />
        {/* Tên chỉ hiện từ 1024px (trước 2026-09-08: từ 768px). Ở dải 768–1023
            nút kính lúp của HeaderSearch (44px) chiếm đúng phần dư còn lại của
            hàng, và tên co còn "A…" (đo 2026-09-08: ô tài khoản 93px ở 768px)
            — một cái tên bị cắt nói ít hơn không có tên; avatar vẫn định danh. */}
        <span className="text-foreground min-w-0 max-w-32 truncate text-sm font-medium max-lg:hidden">
          {displayName}
        </span>
      </button>

      {present && (
        <div
          role="menu"
          data-closing={closing ? "" : undefined}
          inert={closing || undefined}
          // `w-max`: menu ôm sát mục dài nhất, không có bề rộng cố định để trống
          // bên phải (engineer 2026-09-04). `max-w-64` chặn mục dài nếu sau này
          // thêm; không đặt min-width — ba mục hiện tại đủ ngắn để tự quyết.
          className="motion-pop border-border bg-popover absolute top-full right-0 z-20 mt-2 w-max max-w-64 rounded-xl border p-1.5"
        >
          <Link role="menuitem" href="/profile" onClick={close} className={itemCls()}>
            {t("common.profile")}
          </Link>
          <Link role="menuitem" href="/me/exams" onClick={close} className={itemCls()}>
            {t("common.myExams")}
          </Link>
          <form action={signOut}>
            <button role="menuitem" type="submit" className={itemCls("danger")}>
              {t("common.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
