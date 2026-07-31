// Loading state for /history — skeleton mirrors (layer4)/me/exams/loading.tsx's
// pattern (heading skeleton + pulsing row placeholders), per the frontend DD's
// HistoryList states table (D7): 4 placeholder rows for this list.

export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-10">
      <div className="h-8 w-32 animate-pulse rounded bg-border/60" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card/40" />
        ))}
      </div>
    </main>
  );
}
