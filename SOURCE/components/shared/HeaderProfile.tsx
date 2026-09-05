"use client";

// HeaderProfile — ô tài khoản trong SiteHeader, CHỈ render khi ĐÃ đăng nhập
// (khách thấy nút "Đăng nhập" thay thế). Từ 2026-09-04 đây là ô tài khoản DUY
// NHẤT của site (SidebarProfile của trang chủ cũ đã gỡ cùng sidebar).
//
// Menu ba đường: Hồ sơ → /profile, Đề của tôi → /me/exams, Đăng xuất (Server
// Action). Mục "Sửa tên" đã bỏ từ 2026-08-17 — /profile làm việc đó tử tế hơn.
import Link from "next/link";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { signOut } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import { Avatar } from "@/components/shared/Avatar";

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

  function close() {
    setOpen(false);
  }

  return (
    <div className="relative">
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={close}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      {/* Trigger — avatar + tên (ẩn dưới 768px) + chevron. min-h-11: sàn 44px. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="bg-surface hover:bg-[color-mix(in_oklch,var(--surface),var(--foreground)_7%)] focus-visible:ring-ring flex min-h-11 items-center gap-2 rounded-full py-1 pr-2.5 pl-1.5 transition-colors focus-visible:ring-3 focus-visible:outline-none"
      >
        {/* Avatar thay cho <Image>: next.config.ts không khai remotePatterns,
            URL Supabase đưa vào <Image> là lỗi LÚC CHẠY. */}
        <Avatar src={avatarUrl} name={displayName} size={28} />
        <span className="text-foreground max-w-32 truncate text-sm font-medium max-md:hidden">
          {displayName}
        </span>
        <ChevronDown
          aria-hidden
          className={`text-muted-foreground size-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div
          role="menu"
          // `w-max`: menu ôm sát mục dài nhất, không có bề rộng cố định để trống
          // bên phải (engineer 2026-09-04). `max-w-64` chặn mục dài nếu sau này
          // thêm; không đặt min-width — ba mục hiện tại đủ ngắn để tự quyết.
          className="border-border bg-popover absolute top-full right-0 z-20 mt-2 w-max max-w-64 rounded-xl border p-1.5"
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
