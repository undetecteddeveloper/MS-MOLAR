"use client";

// Nút mũi tên của trang ẩn Maxwell — về ĐÚNG trang người dùng đang ở trước khi
// vào đây (brief T5). Đó chính là hành vi nút Back của trình duyệt, nên dùng
// `router.back()`: giữ cả vị trí cuộn và bộ lọc của trang trước.
//
// Không có lịch sử để lùi (mở thẳng đường link ở tab mới, hoặc ứng dụng chat mở
// link trong cửa sổ riêng) thì rơi về Kho đề, đích mặc định của cả site — không
// bao giờ là một nút không làm gì.

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_POST_AUTH_PATH } from "@/lib/auth/guestPaths";
import { t } from "@/lib/copy";

export function MaxwellBackButton() {
  const router = useRouter();

  function goBack() {
    if (window.history.length > 1) {
      router.back();
    } else {
      router.push(DEFAULT_POST_AUTH_PATH);
    }
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t("maxwell.back")}
      onClick={goBack}
      className="rounded-full bg-white/10 text-white hover:bg-white/20"
    >
      <ArrowLeft aria-hidden />
    </Button>
  );
}
