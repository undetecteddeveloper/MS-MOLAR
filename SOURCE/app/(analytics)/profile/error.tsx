"use client";

// Error boundary của /profile — khuôn của (history)/history/error.tsx: node
// role="alert" NHẬN focus lúc render, và "Thử lại" nối thẳng vào reset() để
// chạy lại chính lượt render server vừa hỏng.
//
// Câu hiển thị là `profile.error.generic`, KHÔNG phải `error.message`: thông
// điệp lỗi ở đây có thể mang chữ của Supabase, và trang này là trang tài khoản.
//
// Theme "Sân trường" (2026-09-10): khối đỏ nhạt bo 18px, nút Thử lại là viên
// thuốc TRẮNG (`plain` — nút nằm trên khối đã tô). Cùng PageContainer với
// page.tsx để khối lỗi đứng đúng chỗ thẻ hồ sơ lẽ ra đứng.

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";
import { PageContainer } from "@/components/layout/PageContainer";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("(analytics)/profile render failed", { digest: error.digest });
    alertRef.current?.focus();
  }, [error]);

  return (
    <PageContainer as="main" size="small" padding="none" className="px-4 py-6 sm:px-6 sm:py-8">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="bg-destructive/10 text-destructive rounded-card focus-visible:ring-ring/40 flex flex-col items-start gap-3 p-4 focus-visible:ring-3 focus-visible:outline-none sm:p-5"
      >
        <p className="text-sm leading-relaxed font-medium">{t("profile.error.generic")}</p>
        <Button type="button" variant="plain" size="sm" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </PageContainer>
  );
}
