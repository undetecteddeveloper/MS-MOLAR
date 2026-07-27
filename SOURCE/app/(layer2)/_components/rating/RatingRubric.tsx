"use client";

// RatingRubric — shared core of the standalone Rating Page (academic-rubric
// redesign, replaces the old RatingForm/RatingOverview/PartCard/PartDetail
// bubble-expand stack). Renders ONE exam part at a time in a single section,
// paginated via Prev/Next (2026-07-27 compactness pass — was all 3 rows
// stacked at once). Matches this app's own established "paper" language
// (ScoreCard.tsx: `rounded-xl border border-border bg-card`, `.eyebrow`
// labels, serif tabular-nums figures) instead of the dark-sidebar demo
// aesthetic it replaces.
//
// Owns the submitRating(examId, scores) call itself (rather than taking an
// injected onSubmit) so the Server Component route (rate/page.tsx) can render
// this Client Component with only serializable props — a plain closure
// cannot cross the server→client boundary as a prop (Next.js requires a
// "use server" action for that).
//
// UX pass (2026-07-27): the button only ever shows two states — "Submit
// rating" / "Submitting…" (engineer spec: no third label state). Success is
// instead confirmed by a bottom-center SuccessToast owned here.
//
// Result-page UX pass (2026-07-27): this used to also render inside a modal
// dialog opened from the Result page (`variant="dialog"`, via a deleted
// RatingEntry popup component) — the Result page's rating button now
// navigates straight here instead of opening a popup, so that variant, its
// `onSaved` close-hook, and the toast's former per-variant conditional are
// all gone; this is the only place RatingRubric renders.

import { useState } from "react";
import {
  PART_IDS,
  PART_META,
  formatMean,
  readoutModel,
  type PartId,
  type PartScore,
} from "@/lib/rating";
import { ScoreScale } from "@/components/rating/ScoreScale";
import { SuccessToast } from "@/components/ui/SuccessToast";
import { submitRating } from "./submitRating";

export interface RatingRubricProps {
  examId: string;
  initialScores?: Partial<Record<PartId, PartScore>>;
}

type SubmitState = "idle" | "submitting" | "error";

export function RatingRubric({ examId, initialScores }: RatingRubricProps) {
  const [scores, setScores] = useState<Partial<Record<PartId, PartScore>>>(initialScores ?? {});
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastTrigger, setToastTrigger] = useState(0);

  const headingId = `rating-heading-${examId}`;
  const submitHintId = `rating-submit-hint-${examId}`;
  const allRated = PART_IDS.every((id) => scores[id] !== undefined);
  const readout = readoutModel(scores);
  const submitDisabled = !allRated || submitState === "submitting";

  const activePart = PART_IDS[activeIndex];
  const meta = PART_META[activePart];
  const score = scores[activePart];
  const scaleLabelId = `${headingId}-${activePart}-label`;
  const isFirst = activeIndex === 0;
  const isLast = activeIndex === PART_IDS.length - 1;

  function goPrev() {
    setDirection(-1);
    setActiveIndex((i) => i - 1);
  }

  function goNext() {
    setDirection(1);
    setActiveIndex((i) => i + 1);
  }

  async function handleSubmit() {
    if (submitDisabled) return;
    setSubmitState("submitting");
    setErrorMessage(null);
    const result = await submitRating(examId, scores as Record<PartId, PartScore>);
    if (result.ok) {
      setSubmitState("idle");
      setToastTrigger((n) => n + 1);
    } else {
      setSubmitState("error");
      setErrorMessage(result.message);
    }
  }

  const submitLabel = submitState === "submitting" ? "Submitting…" : "Submit rating";

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="eyebrow">
          Difficulty rubric
        </h2>
        <span className="eyebrow text-muted-foreground">
          Part {activeIndex + 1} of {PART_IDS.length}
        </span>
      </div>

      <div
        key={activePart}
        className={`mt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300 motion-safe:ease-out ${
          direction === 1
            ? "motion-safe:slide-in-from-right-3"
            : "motion-safe:slide-in-from-left-3"
        }`}
        role="group"
        aria-label={meta.name}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <div>
            <p className="eyebrow">{meta.eyebrow}</p>
            <p className="mt-1 font-serif text-lg text-foreground">{meta.name}</p>
          </div>
          <p className="font-serif text-lg tabular-nums text-brand transition-colors duration-200">
            {score !== undefined ? formatMean(score) : "—"}
            <span className="text-sm font-sans text-muted-foreground">/10</span>
          </p>
        </div>
        <p className="mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground">
          {meta.description}
        </p>
        <div className="mt-3.5">
          <span id={scaleLabelId} className="sr-only">
            {meta.name} — rate from 1 (easiest) to 10 (hardest)
          </span>
          <ScoreScale
            value={score}
            onChange={(v) => setScores((prev) => ({ ...prev, [activePart]: v }))}
            labelledBy={scaleLabelId}
          />
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          className="text-xs font-medium tracking-[0.14em] text-foreground uppercase transition-all hover:text-brand disabled:opacity-30 disabled:hover:text-foreground"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={isLast}
          className="text-xs font-medium tracking-[0.14em] text-foreground uppercase transition-all hover:text-brand disabled:opacity-30 disabled:hover:text-foreground"
        >
          Next →
        </button>
      </div>

      <div className="mt-5 flex items-center justify-between gap-4 border-t border-border pt-5">
        <div>
          <span className="eyebrow">Overall</span>
          <p className="mt-1 font-serif text-3xl tabular-nums text-foreground">
            {readout.value}
            <span className="text-base font-sans text-muted-foreground"> /10 · {readout.status}</span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            aria-busy={submitState === "submitting"}
            aria-describedby={submitDisabled && submitState !== "submitting" ? submitHintId : undefined}
            className="flex items-center gap-2 rounded-[4px] bg-brand px-5 py-2.5 text-xs font-medium tracking-[0.14em] text-brand-foreground uppercase transition-all duration-200 hover:opacity-90 disabled:opacity-50"
          >
            {submitState === "submitting" && (
              <svg
                aria-hidden
                viewBox="0 0 24 24"
                className="h-3 w-3 motion-safe:animate-spin"
              >
                <circle
                  cx="12"
                  cy="12"
                  r="9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeOpacity="0.3"
                />
                <path
                  d="M21 12a9 9 0 0 0-9-9"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              </svg>
            )}
            {submitLabel}
          </button>
          <span id={submitHintId} className="sr-only">
            Rate all three parts to submit.
          </span>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="mt-3 text-sm text-brand">
          {errorMessage}
        </p>
      )}

      <SuccessToast message="Đã gửi đánh giá" trigger={toastTrigger} />
    </div>
  );
}
