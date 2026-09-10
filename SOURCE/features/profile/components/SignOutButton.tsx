"use client";

// SignOutButton — bọc Server Action `signOut` SẴN CÓ, không sửa gì (AC-013,
// AC-014).
//
// Là `<form action>` chứ không phải onClick + fetch: nó vẫn chạy khi JavaScript
// hỏng hoặc chưa tải xong, và đó là sàn đúng cho control dùng để rời khỏi một
// tài khoản trên máy dùng chung.
//
// Theme "Sân trường" (2026-09-10): viên thuốc đỏ nhạt (`destructive`) — cùng
// họ với "Rời khỏi" ở màn làm bài: một hành động rời đi, không phải sửa gì.
//
// CO THEO CHỮ, không trải hết bề ngang — và vị trí (căn giữa) do ProfileCard
// quyết định, không phải file này.
//
// Vì sao không trải rộng, đo ở 360×740: nút hỗ trợ nổi ở góc dưới phải (z-45)
// chiếm 288–344 × 608–664; nút Đăng xuất trải rộng nằm 633–677 nên góc phải
// của nó bị đè 36×31px. Trang này ngắn nên không cuộn được, và đệm đáy kiểu
// /upload không kéo nút lên. Co theo chữ rồi căn giữa thì nút nằm gọn trong
// 122–238, cách nút hỗ trợ 50px.

import { useRef } from "react";
import { useFormStatus } from "react-dom";
// eslint-disable-next-line no-restricted-imports -- rò chéo có sẵn trước B4 (2026-09-03): signOut là của auth; profile chỉ đặt nút. Xem ARCHITECTURE.md § Import chéo.
import { signOut } from "@/features/auth/actions";
import { t } from "@/lib/copy";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export function SignOutButton() {
  return (
    <form action={signOut} className="flex">
      <SubmitButton />
    </form>
  );
}

/** Tách riêng vì `useFormStatus` chỉ đọc được trạng thái của form CHA nó. */
function SubmitButton() {
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
      className={cn(buttonVariants({ variant: "destructive" }), "aria-disabled:opacity-60")}
    >
      {pending ? t("common.working") : t("common.signOut")}
    </button>
  );
}
