"use client";

// Error boundary của /admin/tickets — khuôn của (history)/history/error.tsx:
// role="alert" nhận focus lúc render, "Thử lại" nối thẳng vào reset() để chạy
// lại lượt render server vừa hỏng (gọi lại listSupportTickets()).
//
// Theme "Sân trường" (2026-09-10): khối đỏ nhạt bo 18px, nút Thử lại là viên
// thuốc TRẮNG (`plain` — nút nằm trên khối đã tô).

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
    console.error("(admin)/admin/tickets render failed", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    <PageContainer as="main" size="default" padding="none" className="px-4 py-6 sm:px-6 sm:py-8">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="bg-destructive/10 text-destructive rounded-card focus-visible:ring-ring/40 flex flex-col items-start gap-3 p-4 focus-visible:ring-3 focus-visible:outline-none sm:p-5"
      >
        <p className="text-sm leading-relaxed font-medium">{t("support.admin.statusError")}</p>
        <Button type="button" variant="plain" size="sm" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </PageContainer>
  );
}
