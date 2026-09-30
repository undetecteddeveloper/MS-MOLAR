"use client";

// ScrollRevealGroup — bật `data-visible` MỘT LẦN khi nhóm cuộn vào khung nhìn,
// cho các con `.motion-reveal` (app/globals.css § TRANG CHỦ SỐNG ĐỘNG) so le
// hiện ra qua `--motion-i`. Ngắt quan sát ngay sau lần trúng đầu tiên — không
// theo dõi cuộn lên/xuống lặp lại (F-041, 2026-09-30).
//
// Polymorphic `as` — cùng mẫu Card/PageContainer: component NÀY thay thế thẻ
// bọc sẵn có (`<section>`/`<ul>`...) chứ không thêm một lớp div thừa, để
// không phá layout/flex-item hiện có của nơi gọi.
//
// Không có IntersectionObserver (SSR, trình duyệt cũ) → hiện luôn, không kẹt
// vô hình vĩnh viễn. KHÔNG tự thêm `prefers-reduced-motion` — yêu cầu rõ của
// engineer cho riêng khối "trang chủ sống động" này, khác quy ước usePresence.

import { useEffect, useRef, useState } from "react";

type ScrollRevealGroupProps = React.HTMLAttributes<HTMLElement> & {
  as?: "div" | "section" | "ul";
};

export function ScrollRevealGroup({ as: Tag = "div", children, ...props }: ScrollRevealGroupProps) {
  const ref = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setVisible(true);
        observer.disconnect();
      },
      { threshold: 0.2, rootMargin: "0px 0px -60px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // `as React.ElementType`: JSX với một tag ĐỘNG (biến, không phải literal) suy
  // ra kiểu props/ref là GIAO của mọi tag trong union `as?`, nên TS đòi `ref`
  // khớp cả `HTMLDivElement` LẪN `HTMLUListElement` cùng lúc — không thoả được.
  // Ép kiểu rộng ra đúng ở ranh giới polymorphic này, cùng lý do Card.tsx né
  // vấn đề bằng cách không nhận `ref` (component đó không cần đo geometry;
  // component này thì cần, cho IntersectionObserver).
  const Component = Tag as React.ElementType;
  return (
    <Component ref={ref} data-visible={visible || undefined} {...props}>
      {children}
    </Component>
  );
}
