"use client";

// SidebarProfile — ô profile góc dưới-trái sidebar homepage (Layer 1, S#17
// vòng sửa 1). Chỉ render khi ĐÃ đăng nhập (guest thấy tag "Account" trong nav
// thay thế). Click → dropup (mở LÊN TRÊN vì ô nằm đáy màn hình) gồm ba đường:
// "Profile" → /profile, "My exams" → /me/exams, "Sign out" → signOut Server
// Action → về /?auth=signin.
// Panel dropup nền ngà trên sidebar đen sơn mài (phân lớp bằng màu nền +
// hairline, không shadow). Nhãn tiếng Anh đồng bộ homepage.
//
// MỤC "EDIT" ĐÃ BỎ (2026-08-17) — xem chú thích cùng nội dung ở đầu
// components/shared/HeaderProfile.tsx. Tóm tắt: nó là bản cài đặt thứ ba của
// việc sửa tên hiển thị, trên bề mặt chật nhất, và /profile đã làm việc đó tử tế
// hơn (có nhãn, có role="alert", có bản dịch).
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/shared/Avatar";

// ⚠ components/shared/HeaderProfile.tsx là BẢN SINH ĐÔI gần như từng chữ của
// file này. Mọi thay đổi ở đây phải làm ở CẢ HAI, nếu không hai ô tài khoản của
// cùng một sản phẩm sẽ trôi ra khác nhau — đúng thứ AC-040 cấm.

/** Giống hệt `itemCls` của HeaderProfile. Cố ý chép chứ không import chéo: hai
 *  file này là cặp sinh đôi được canh bằng mắt và bằng chú thích ở trên, không
 *  phải hai chỗ gọi của một component chung — gộp chúng là một việc riêng, và
 *  là việc phải làm cho CẢ trigger lẫn panel chứ không chỉ một dòng class. */
function itemCls(tone: "default" | "brand" = "default"): string {
  return [
    "block w-full rounded-[4px] px-3 py-2 text-center font-sans text-sm transition-colors hover:bg-[#E3D5B6]",
    tone === "brand" ? "text-brand" : "text-[#1B1512]",
  ].join(" ");
}

export function SidebarProfile({
  displayName,
  avatarUrl,
}: {
  displayName: string;
  avatarUrl: string | null;
}) {
  const t = useT();
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

      {/* Trigger — avatar + tên (truncate "…"), giữ bố cục ô account cũ. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-md border border-[#EDE1C8]/12 px-3 py-2.5 transition-colors hover:border-[#EDE1C8]/30"
      >
        {/* Avatar thay cho <Image> + ảnh placeholder cục bộ. next/image chỉ chạy
            được với ảnh cục bộ ở đây: next.config.ts không khai remotePatterns
            nào, nên một URL Supabase đưa vào <Image> là lỗi LÚC CHẠY. */}
        <Avatar src={avatarUrl} name={displayName} size={32} />
        <span className="min-w-0 flex-1 truncate text-left font-sans text-sm text-[#EDE1C8]">
          {displayName}
        </span>
        <ChevronUp open={open} />
      </button>

      {/* Dropup — mở lên trên, nền ngà đảo tông trên sidebar đen. */}
      {open && (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-2 w-full rounded-md border border-[#D8C9A8] bg-[#EDE1C8] p-1"
        >
          <Link role="menuitem" href="/profile" onClick={close} className={itemCls()}>
            {t("common.profile")}
          </Link>
          <Link role="menuitem" href="/me/exams" onClick={close} className={itemCls()}>
            {t("common.myExams")}
          </Link>
          {/* Đỏ son cho CHỮ, không phải cho nền — xem chú thích tương ứng ở
              HeaderProfile. Panel nền ngà nên dùng --brand, không phải
              --brand-on-dark. */}
          <form action={signOut}>
            <button role="menuitem" type="submit" className={itemCls("brand")}>
              {t("common.signOut")}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function ChevronUp({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 8"
      className={`size-3 shrink-0 text-[#EDE1C8]/60 transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M1 6.5 6 1.5 11 6.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
