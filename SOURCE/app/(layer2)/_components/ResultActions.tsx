// ResultActions — Save PDF + Share buttons ở màn Result (Layer 2). GĐ 3 M3.1
// Task 12: rewired from the disabled "coming soon" placeholder onto the
// shared ActionButton (AC-007/AC-014) — same component HistoryRow (Task 13)
// will use, so Save/Share are now fully functional here.
//
// Renders its two buttons as siblings (no wrapping grid of its own) — the
// caller (result/page.tsx) places them inside its own 3-column row alongside
// "Return", so all three sit at the same height/width. ActionButton's own
// DOM-shape fix (Task 10/11, see history-frontend-design.md § ActionButton —
// Deep Dive) keeps this a single in-flow <button> per instance in every
// phase (idle/busy/error/fallback-confirmed), so the grid-cols-3 cell count
// this page depends on stays unchanged.
import { ActionButton } from "@/components/history/ActionButton";
import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf";

export function ResultActions({ pdfInput }: { pdfInput: AttemptPdfData }) {
  return (
    <>
      <ActionButton action="save" idPrefix="result" pdfInput={pdfInput} />
      <ActionButton action="share" idPrefix="result" pdfInput={pdfInput} />
    </>
  );
}
