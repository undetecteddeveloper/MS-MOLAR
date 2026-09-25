"use client";

// SolutionRouteError (C-41) — ranh giới lỗi của route danh sách bài giải.
// Khuôn của `(exams)/attempt/[attemptId]/solution/error.tsx` (task 10) và
// `(analytics)/profile/error.tsx`: node `role="alert"` NHẬN tiêu điểm lúc
// render, "Thử lại" nối thẳng vào `reset()`. Câu hiển thị `solutions.routeError`
// dùng chung cho cả ba route mới (UI Spec § Component: SolutionRouteError).

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
    console.error("(exams)/exams/[id]/solutions render failed", { digest: error.digest });
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
        <p className="text-sm leading-relaxed font-medium">{t("solutions.routeError")}</p>
        <Button type="button" variant="plain" size="default" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </PageContainer>
  );
}
