"use client";

// Error boundary for /admin/tickets — mirrors (history)/history/error.tsx's
// pattern exactly (this repo's established error.tsx idiom): role="alert"
// receives focus on render, Retry wired directly to reset() (re-runs the
// failed Server Component render, re-attempting listSupportTickets()).

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
    console.error("(admin)/admin/tickets render failed", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    <PageContainer as="main" size="default">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="border-brand bg-brand/8 text-brand rounded-lg border px-4 py-3 text-sm"
      >
        <p>{t("support.admin.statusError")}</p>
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
