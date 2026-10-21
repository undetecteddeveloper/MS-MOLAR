"use client";

import { useEffect, useRef } from "react";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/copy";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Chỉ `digest`: message lỗi có thể mang nội dung đơn.
    console.error("(billing)/me/orders render failed", { digest: error.digest });
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
        <p className="text-sm leading-relaxed font-medium">{t("billing.orders.loadError")}</p>
        <Button type="button" variant="plain" size="sm" onClick={reset}>
          {t("common.retry")}
        </Button>
      </div>
    </PageContainer>
  );
}
