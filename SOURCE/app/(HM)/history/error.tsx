"use client";

// Error boundary for /history — Next.js App Router error.tsx convention
// (this repo's first use, D7/AC-019). role="alert" receives focus on render
// (UI Spec Accessibility Definition: "assertive; receives focus on render").
// "Retry" is wired directly to `reset()`, which re-runs the failed server
// render (re-attempting listMyHistory()) — closing the gap
// ExtractionErrorPanel.tsx's precedent leaves open (that panel lists errors
// but has no Retry control).

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
    console.error("(HM)/history render failed", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    // Khớp size + padding của history/page.tsx — xem ghi chú ở loading.tsx.
    <PageContainer as="main" size="small" padding="compact">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="border-brand bg-brand/8 text-brand rounded-lg border px-4 py-3 text-sm"
      >
        <p>{t("history.loadError")}</p>
        <button
          type="button"
          onClick={reset}
          className="bg-brand text-brand-foreground mt-3 rounded-full px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity hover:opacity-90"
        >
          {t("common.retry")}
        </button>
      </div>
    </PageContainer>
  );
}
