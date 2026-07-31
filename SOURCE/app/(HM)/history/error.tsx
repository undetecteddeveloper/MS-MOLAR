"use client";

// Error boundary for /history — Next.js App Router error.tsx convention
// (this repo's first use, D7/AC-019). role="alert" receives focus on render
// (UI Spec Accessibility Definition: "assertive; receives focus on render").
// "Retry" is wired directly to `reset()`, which re-runs the failed server
// render (re-attempting listMyHistory()) — closing the gap
// ExtractionErrorPanel.tsx's precedent leaves open (that panel lists errors
// but has no Retry control).

import { useEffect, useRef } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error("(HM)/history render failed", { error });
    alertRef.current?.focus();
  }, [error]);

  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div
        ref={alertRef}
        role="alert"
        tabIndex={-1}
        className="rounded-lg border border-brand bg-brand/8 px-4 py-3 text-sm text-brand"
      >
        <p>Couldn&apos;t load your history right now.</p>
        <button
          type="button"
          onClick={reset}
          className="mt-3 rounded-[4px] bg-brand px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90"
        >
          Retry
        </button>
      </div>
    </main>
  );
}
