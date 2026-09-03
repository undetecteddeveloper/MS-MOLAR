"use client";

// Error boundary của /profile — khuôn của (HM)/history/error.tsx: node
// role="alert" NHẬN focus lúc render, và "Làm lại" nối thẳng vào reset() để
// chạy lại chính lượt render server vừa hỏng.
//
// Câu hiển thị là `profile.error.generic`, KHÔNG phải `error.message`: thông
// điệp lỗi ở đây có thể mang chữ của Supabase, và trang này là trang tài khoản.

import { useEffect, useRef } from "react";
import { useT } from "@/lib/i18n/client";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useT();
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("(analytics)/profile render failed", { digest: error.digest });
    alertRef.current?.focus();
  }, [error]);

  return (
    <PageContainer as="main" size="small">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="border-brand bg-brand/8 text-brand rounded-[var(--radius-card)] border px-4 py-3 text-sm"
      >
        <p>{t("profile.error.generic")}</p>
        <button
          type="button"
          onClick={reset}
          className="bg-brand text-brand-foreground mt-3 min-h-11 rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
        >
          {t("common.tryAgain")}
        </button>
      </div>
    </PageContainer>
  );
}
