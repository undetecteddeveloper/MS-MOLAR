// Loading state for /admin/tickets — mirrors (HM)/history/loading.tsx's
// pattern (heading skeleton + pulsing row placeholders), matching this
// route's own page.tsx size ("default", default padding) so the skeleton
// doesn't shift layout when data replaces it.

import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer as="main" size="default">
      <div className="h-8 w-40 animate-pulse rounded bg-border/60" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 animate-pulse rounded-lg border border-border bg-card/40" />
        ))}
      </div>
    </PageContainer>
  );
}
