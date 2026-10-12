"use client";

// Nút mũi tên của trang ẩn Maxwell — về ĐÚNG trang người dùng đang ở trước khi
// vào đây (brief T5).
//
// Ô tìm ghi lại trang đang đứng vào sessionStorage ngay trước khi sang /maxwell
// (lib/search/easterEgg.ts). Có dấu → `router.back()`: đó chính là nút Back của
// trình duyệt, giữ cả vị trí cuộn và bộ lọc của trang trước. KHÔNG có dấu (mở
// thẳng đường link, tab mới, ứng dụng chat mở link trong cửa sổ riêng) → Kho đề,
// đích mặc định của cả site; không dùng `history.length` vì trình duyệt mới đã
// có sẵn một mục about:blank / "Tab mới" (xem easterEgg.ts) — và không bao giờ
// là một nút không làm gì.

import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { DEFAULT_POST_AUTH_PATH } from "@/lib/auth/guestPaths";
import { t } from "@/lib/copy";
import { readMaxwellOrigin } from "@/lib/search/easterEgg";

export function MaxwellBackButton() {
  const router = useRouter();

  function goBack() {
    const origin = readMaxwellOrigin();
    if (origin === null) {
      router.push(DEFAULT_POST_AUTH_PATH);
    } else if (window.history.length > 1) {
      router.back();
    } else {
      // Có dấu nhưng không còn mục nào để lùi (tab nhân đôi chép sessionStorage).
      router.push(origin);
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
