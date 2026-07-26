"use client";

// RatingModal — result-page dialog shell hosting RatingForm(layout="modal")
// (Rating System, frontend DD § Component Hierarchy — RatingModal row; UI Spec
// Component: RatingModal). Extends the ReportExam.tsx/LeaveExamDialog.tsx dialog
// precedent (scrim `bg-[#1B1512]/40`, Esc/scrim-close, role=dialog/aria-modal/
// aria-labelledby) and closes the three documented a11y gaps in that precedent
// (frontend DD ui:F1 / UI Spec "closes the two precedent gaps"): focus-trap
// (Tab/Shift+Tab cycle), focus-return-to-trigger on close, and a success
// aria-live announcement. The announcement itself is RatingForm's own internal
// `aria-live="polite"` region (RatingForm.tsx's documented decision: "the
// shell's aria-live" is satisfied there for both shells, not duplicated here).
//
// Cross-fade scope note: the frontend DD lists "cross-fade overview<->detail"
// as a RatingModal responsibility, but that internal transition point
// (RatingForm's `activePart`) is sealed inside Task 7's core, which this task's
// Notes explicitly forbid modifying. No AC/Proof Obligation in this task
// exercises that specific internal transition (only open/close, focus-trap,
// focus-return, aria-live, and the CircleScale keyboard smoke check inside the
// modal do). So the cross-fade this component owns and can implement without
// touching RatingForm is the modal's own open transition (fade-in on mount),
// matching RatingForm's own precedent of an approximate CSS-only transition
// (RatingForm.tsx's BubbleReveal comment) rather than an exact measured one.

import { useEffect, useRef, useState } from "react";
import type { PartId, PartScore } from "@/lib/rating";
import { RatingForm } from "./RatingForm";
import { submitRating } from "./submitRating";

export interface RatingModalProps {
  open: boolean;
  onClose: () => void;
  examId: string;
  initialScores?: Partial<Record<PartId, PartScore>>;
}

/** Saved-state visible window before the modal closes on a successful save —
 *  mirrors RatingForm's own SAVED_LABEL_DURATION_MS (1600ms, not exported since
 *  RatingForm.tsx is out of this task's Target Files) so the "Sent" label and
 *  the aria-live "Rating saved." announcement are actually perceivable before
 *  RatingForm unmounts, instead of closing in the same commit as the announce
 *  (frontend DD line 438 "onSaved...closes + returns focus + announces";
 *  UI Spec line 577 groups the 1.6s Sent-label window with the close). */
const SAVED_STATE_VISIBLE_MS = 1600;

function supportsMatchMedia(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function";
}

/** prefers-reduced-motion, read once at mount — local duplicate of RatingForm's
 *  own hook (RatingForm.tsx is out of this task's Target Files, so it isn't
 *  exported from there; this is the 2nd occurrence, small enough that Rule of
 *  Three doesn't yet warrant a shared module). */
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => supportsMatchMedia() && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
  useEffect(() => {
    if (!supportsMatchMedia()) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

function getFocusable(container: HTMLElement): HTMLElement[] {
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    )
  );
}

export function RatingModal({ open, onClose, examId, initialScores }: RatingModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [revealed, setRevealed] = useState(false);
  const reducedMotion = usePrefersReducedMotion();

  // Focus-trap + initial focus + focus-return — the three gaps ReportExam/
  // LeaveExamDialog leave open (frontend DD ui:F1).
  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus into first control on open (UI Spec): querying only the FORM
    // content (not this header's Close button) means a disabled SUBMIT is
    // skipped in favor of the first PartCard when fresh, and SUBMIT itself
    // is picked when re-editing (already 3/3 rated, SUBMIT enabled) — without
    // RatingModal needing to know which case it is.
    const firstFocusable = contentRef.current && getFocusable(contentRef.current)[0];
    firstFocusable?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const focusable = getFocusable(dialogRef.current);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, [open, onClose]);

  // Fade-in reveal — the modal's own open transition (see file header's
  // cross-fade scope note). rAF-deferred so the transition actually runs
  // (applying the target class on the first paint skips the transition).
  // Reduced-motion skips the transition entirely via the `revealed ||
  // reducedMotion` check in the className below, not by setting state here.
  // The cleanup resets `revealed` for the next open (this component doesn't
  // unmount between opens — it returns null while closed instead).
  useEffect(() => {
    if (!open || reducedMotion) return;
    const raf = requestAnimationFrame(() => setRevealed(true));
    return () => {
      cancelAnimationFrame(raf);
      setRevealed(false);
    };
  }, [open, reducedMotion]);

  // Pending close timer cleanup on unmount (avoids a setState-after-unmount if
  // the result page itself unmounts mid-window).
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  function handleSaved() {
    // Delay the close so the "Sent" label swap + aria-live announce are
    // perceivable before RatingForm (and its aria-live region) unmounts.
    closeTimerRef.current = setTimeout(onClose, SAVED_STATE_VISIBLE_MS);
  }

  if (!open) return null;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby={`rating-form-heading-${examId}`}
      className="fixed inset-0 z-50 flex items-center justify-center px-6"
    >
      {/* Scrim — click ra ngoài = đóng (LeaveExamDialog/ReportExam precedent).
          data-testid: aria-hidden means it has no accessible role/name for the
          fixture-e2e FE1 script (rating.fixture.e2e.test.ts) to target by role. */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={onClose}
        data-testid="rating-modal-scrim"
        className="absolute inset-0 cursor-default bg-[#1B1512]/40"
      />
      <div
        className={`border-border bg-background relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border p-6 transition-opacity duration-300 ${
          revealed || reducedMotion ? "opacity-100" : "opacity-0"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          className="text-muted-foreground hover:text-brand absolute top-4 right-4 text-sm underline-offset-4 transition-colors hover:underline"
        >
          Close
        </button>
        <div ref={contentRef}>
          <RatingForm
            examId={examId}
            layout="modal"
            initialScores={initialScores}
            onSubmit={(scores) => submitRating(examId, scores)}
            onSaved={handleSaved}
          />
        </div>
      </div>
    </div>
  );
}
