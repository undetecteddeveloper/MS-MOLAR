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
import { outlineButtonCls } from "./styles";

export function SignOutButton() {
  return (
    <form action={signOut} className="flex">
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
      // Đỏ son cho chữ: đây là hành động rời đi, không phải một hành động sửa
      // ngang hàng ba nút trên. Full-width dưới 768px để ngón cái với tới dễ.
      className={`${outlineButtonCls} text-brand w-full md:ml-auto md:w-auto`}
    >
      {pending ? t("common.working") : t("common.signOut")}
    </button>
  );
}
