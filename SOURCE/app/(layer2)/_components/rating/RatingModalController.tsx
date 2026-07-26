"use client";

// RatingModalController — result-page open-condition controller (Rating System,
// frontend DD § Component Hierarchy — RatingModalController row; UI Spec
// Component: RatingModalController; § Field Propagation Map `rate=auto` row).
// Reads `?rate=auto` exactly ONCE on mount and, if present, opens the modal and
// strips the marker via `router.replace(pathname, { scroll: false })` — the same
// API family ExamFilters.tsx:73 already uses for searchParams mutation without a
// reload. Renders the inline entry point ("Rate this exam" / "Edit your rating")
// that also opens the modal manually (AC-006), independent of the marker.

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PartId, PartScore } from "@/lib/rating";
import { RatingModal } from "./RatingModal";

export interface RatingModalControllerProps {
  examId: string;
  /** Pre-fill for a user who already rated this exam (AC-006/013); undefined =
   *  not yet rated, entry point reads "Rate this exam" instead of "Edit your
   *  rating". */
  initialScores?: Partial<Record<PartId, PartScore>>;
}

export function RatingModalController({ examId, initialScores }: RatingModalControllerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // Lazy initializer: the open-condition read happens exactly once, during
  // this component's first render, from whatever `?rate=auto` was present on
  // arrival — not as a setState call inside an effect. Re-consulting the
  // marker on every render would defeat the idempotency it exists to provide
  // (AC-005): a stray re-open after the strip's own re-render would re-pop
  // the modal.
  const [open, setOpen] = useState(() => searchParams.get("rate") === "auto");
  const strippedRef = useRef(false);

  useEffect(() => {
    if (strippedRef.current) return;
    strippedRef.current = true;
    if (searchParams.get("rate") === "auto") {
      router.replace(pathname, { scroll: false });
    }
    // Mount-only by design: empty deps make the "strip exactly once"
    // guarantee explicit rather than relying on the strip's own re-render
    // making a second read a no-op.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="border-brand bg-brand text-brand-foreground rounded-lg border px-4 py-3 text-center text-sm font-medium transition-opacity hover:opacity-90"
      >
        {initialScores ? "Edit your rating" : "Rate this exam"}
      </button>
      <RatingModal
        open={open}
        onClose={() => setOpen(false)}
        examId={examId}
        initialScores={initialScores}
      />
    </>
  );
}
