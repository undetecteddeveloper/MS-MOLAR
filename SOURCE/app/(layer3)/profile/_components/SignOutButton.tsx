"use client";

// SignOutButton — bọc Server Action `signOut` SẴN CÓ, không sửa gì (AC-013,
// AC-014).
//
// Là `<form action>` chứ không phải onClick + fetch: nó vẫn chạy khi JavaScript
// hỏng hoặc chưa tải xong, và đó là sàn đúng cho control dùng để rời khỏi một
// tài khoản trên máy dùng chung.
//
// Nằm dưới một hairline, tách khỏi ba hàng phía trên, vì nó RỜI KHỎI trang chứ
// không sửa gì trên trang.

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { signOut } from "@/app/(layer1)/actions";
import { useT } from "@/lib/i18n/client";
import { cn } from "@/lib/utils";
import { outlineButtonCls } from "./styles";

export function SignOutButton() {
  return (
    <form action={signOut} className="flex w-full justify-center">
      <SubmitButton />
    </form>
  );
}

/** Tách riêng vì `useFormStatus` chỉ đọc được trạng thái của form CHA nó. */
function SubmitButton() {
  const t = useT();
  const { pending } = useFormStatus();
  // Chốt đồng bộ: cửa sổ giữa lúc bấm và lúc redirect rất ngắn, nhưng hai cú
  // bấm trong đó không được phép bắn hai lượt đăng xuất. KHÔNG cần mở lại —
  // signOut luôn redirect và không có nhánh nào quay lại trang này.
  const submittedRef = useRef(false);

  return (
    <button
      type="submit"
      aria-disabled={pending}
      onClick={(e) => {
        if (submittedRef.current) {
          e.preventDefault();
          return;
        }
        submittedRef.current = true;
      }}
      // Đỏ son cho CHỮ, không phải cho nền: quy tắc cứng của theme là đỏ son
      // không phủ khối lớn (.claude/MEMORY.md §3) — một nút nền đỏ ở đây vừa
      // phạm luật đó vừa hét to hơn mức cần thiết cho việc đăng xuất.
      // Căn giữa (form bọc `justify-center`), không còn `md:ml-auto`: đăng xuất
      // không thuộc cột hành động căn phải của các hàng phía trên.
      //
      // ⚠ PHẢI đi qua cn(): `outlineButtonCls` đã mang sẵn `text-foreground`, và
      // nối chuỗi trần thì Tailwind xử va chạm theo THỨ TỰ TRONG STYLESHEET chứ
      // không theo thứ tự trong thuộc tính class — `text-brand` viết sau vẫn
      // thua. cn() (tailwind-merge) bỏ hẳn lớp bị ghi đè, nên cái sau thắng
      // thật. Bản trước dùng nối chuỗi và nút hiện ra màu đen.
      className={cn(outlineButtonCls, "text-brand w-full md:w-auto")}
    >
      {pending ? t("common.working") : t("common.signOut")}
    </button>
  );
}
