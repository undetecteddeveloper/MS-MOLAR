"use client";

// Error boundary for /history — Next.js App Router error.tsx convention
// (this repo's first use, D7/AC-019). role="alert" receives focus on render
// (UI Spec Accessibility Definition: "assertive; receives focus on render").
// "Thử lại" is wired directly to `reset()`, which re-runs the failed server
// render (re-attempting listMyHistory()).
//
// Theme "Sân trường" (2026-09-07): khối đỏ nhạt bo 18px (cùng `bg-destructive/10`
// với nút Rời khỏi ở màn làm bài), nút Thử lại là viên thuốc TRẮNG (`plain` —
// nút nằm trên khối đã tô). Cùng PageContainer với page.tsx để khối lỗi đứng
// đúng chỗ danh sách lẽ ra đứng.

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
    console.error("(history)/history render failed", { error });
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
        <p className="text-sm leading-relaxed font-medium">{t("history.loadError")}</p>
        <Button type="button" variant="plain" size="sm" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </PageContainer>
  );
}
