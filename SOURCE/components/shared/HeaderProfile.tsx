"use client";

// HeaderProfile — ô profile trong SiteHeader (L2/3/4), CHỈ render khi ĐÃ đăng
// nhập (guest thấy tag "Account" trong nav thay thế — S#19, đồng bộ homepage).
// Bản đối xứng của SidebarProfile (L1): cùng mục menu, cùng Server Action,
// nhưng dropdown MỞ XUỐNG (header nằm đỉnh màn hình, ngược với ô sidebar nằm
// đáy) và trigger nén gọn cho khớp navbar h-15.
// Panel nền ngà trên navbar đen sơn mài (phân lớp bằng màu + hairline, không
// shadow).
//
// MỤC "EDIT" ĐÃ BỎ (2026-08-17). Trước đây menu này có một ô sửa tên hiển thị
// ngay tại chỗ, và SidebarProfile có một bản sao từng chữ của nó. Từ khi có
// /profile thì đó là bản cài đặt THỨ BA của cùng một việc, trên bề mặt chật
// nhất trong ba bề mặt — một ô nhập rộng 224px không nhãn, không role="alert",
// và hiện lỗi bằng tiếng Anh cho người dùng tiếng Việt. Menu nay chỉ còn ba
// đường đi; việc sửa nằm ở /profile, cách đây đúng một cú bấm.
import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import { Avatar } from "@/components/shared/Avatar";

// ⚠ SidebarProfile.tsx là BẢN SINH ĐÔI gần như từng chữ của file này. Mọi thay
// đổi ở đây phải làm ở CẢ HAI, nếu không hai ô tài khoản của cùng một sản phẩm
// sẽ trôi ra khác nhau — đúng thứ AC-040 cấm.
export type MenuUser = { displayName: string; avatarUrl: string | null };

/** Một mục trong menu. Dùng chung cho cả ba mục để chúng không trôi khỏi nhau
 *  về padding hay cỡ chữ; `tone` là chỗ DUY NHẤT chúng được phép khác nhau. */
function itemCls(tone: "default" | "brand" = "default"): string {
  return [
    "block w-full rounded-[4px] px-3 py-2 text-center font-sans text-sm transition-colors hover:bg-[#E3D5B6]",
    tone === "brand" ? "text-brand" : "text-[#1B1512]",
  ].join(" ");
}

export function HeaderProfile({
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

      {/* Trigger — avatar + tên (truncate "…") + chevron xuống, nén vừa h-15. */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        // min-h-11: sàn 44px cho vùng chạm (tài liệu §4.3) — trước đây trigger
        // này chỉ cao 38px.
        className="flex min-h-11 items-center gap-2 rounded-md border border-[#EDE1C8]/12 px-2.5 py-1.5 transition-colors hover:border-[#EDE1C8]/30"
      >
        {/* Avatar thay cho <Image> + ảnh placeholder cục bộ. next/image chỉ chạy
            được với ảnh cục bộ ở đây: next.config.ts không khai remotePatterns
            nào, nên một URL Supabase đưa vào <Image> là lỗi LÚC CHẠY. */}
        <Avatar src={avatarUrl} name={displayName} size={24} />
        {/* Tên ẩn dưới 768px: ở đó header chỉ còn logo + ngôn ngữ + ô này, và
            giữ tên lại sẽ ăn hết phần bề ngang vốn đã hẹp. Avatar + chevron vẫn
            đủ nhận diện đây là ô tài khoản. */}
        <span className="max-w-32 truncate font-sans text-sm text-[#EDE1C8] max-md:hidden">
          {displayName}
        </span>
        <ChevronDown open={open} />
      </button>

      {/* Dropdown — mở xuống dưới, nền ngà đảo tông trên navbar đen. */}
      {open && (
        <div
          role="menu"
          className="absolute top-full right-0 z-20 mt-2 w-56 rounded-md border border-[#D8C9A8] bg-[#EDE1C8] p-1"
        >
          {/* Trang tài khoản đầy đủ — mục ĐẦU TIÊN của menu. Không thêm ô nào
              vào BottomNav và không thêm tag nào vào header, nên nó không đụng
              tới hai bề mặt điều hướng đã chật. */}
          <Link role="menuitem" href="/profile" onClick={close} className={itemCls()}>
            {t("common.profile")}
          </Link>
          <Link role="menuitem" href="/me/exams" onClick={close} className={itemCls()}>
            {t("common.myExams")}
          </Link>
          {/* Đỏ son cho CHỮ, không phải cho nền: quy tắc cứng của theme là đỏ
              son không phủ khối lớn. Trên nền ngà #EDE1C8 thì --brand là biến
              thể đúng — #e86b5c (--brand-on-dark) dành cho nền đen sơn mài, và
              panel này không phải nền đó dù nó nổi trên navbar đen. */}
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

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 8"
      className={`size-3 shrink-0 text-[#EDE1C8]/60 transition-transform ${
        open ? "rotate-180" : ""
      }`}
    >
      <path
        d="M1 1.5 6 6.5 11 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
