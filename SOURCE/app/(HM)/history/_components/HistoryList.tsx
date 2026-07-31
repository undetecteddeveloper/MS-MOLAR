// HistoryList — /history content column (S-01, Task 13). Server Component.
// Front-adjust: history/page.tsx owns the page-level <main>; this component
// renders the header row (title left, `filters` slot right — engineer
// feedback: the filter trigger must sit beside "History", balanced against
// the title, not as a separate page-level sidebar column) + the row list.
// Bounded-height, internally-scrolling row container (D3) instead of an
// unbounded list; the dashed-border empty state distinguishes "genuinely no
// history yet" (CTA to /exams, AC-002) from "filtered down to zero" (no CTA
// — the fix is clearing filters, not browsing exams). The header (and so the
// filters trigger) always renders regardless of entries.length, so filters
// stay reachable even from an empty/filtered-empty state.
//
// Invariant: never re-sorts or re-filters `entries` itself — that is
// listMyHistory()'s (ordering) and filterHistoryEntries()'s (filtering)
// responsibility, both already applied by the caller.
import Link from "next/link";
import type { ReactNode } from "react";
import type { MyHistoryEntry } from "@/app/(HM)/queries";
import { HistoryRow } from "./HistoryRow";

export function HistoryList({
  entries,
  isFiltered = false,
  filters,
}: {
  entries: MyHistoryEntry[];
  isFiltered?: boolean;
  filters?: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-foreground">History</h1>
          <div className="mt-3 h-0.5 w-10 bg-[#B8863B]" aria-hidden />
        </div>
        {filters}
      </div>

      {entries.length === 0 ? (
        <div className="mt-6 flex flex-col items-center gap-2 rounded-lg border border-dashed border-border px-6 py-16 text-center">
          {isFiltered ? (
            <>
              <p className="font-serif text-lg text-foreground">No matches</p>
              <p className="text-sm text-muted-foreground">
                Try adjusting or clearing your filters.
              </p>
            </>
          ) : (
            <>
              <p className="font-serif text-lg text-foreground">No results yet</p>
              <p className="text-sm text-muted-foreground">Finish an exam to see it here.</p>
              <Link
                href="/exams"
                className="mt-2 rounded-[4px] bg-brand px-4 py-2 text-xs font-medium uppercase tracking-[0.14em] text-brand-foreground transition-opacity hover:opacity-90"
              >
                Browse exams
              </Link>
            </>
          )}
        </div>
      ) : (
        <ul className="mt-6 flex max-h-[30rem] flex-col gap-3 overflow-y-auto pr-2">
          {entries.map((entry) => (
            <HistoryRow key={entry.attemptId} entry={entry} />
          ))}
        </ul>
      )}
    </div>
  );
}
