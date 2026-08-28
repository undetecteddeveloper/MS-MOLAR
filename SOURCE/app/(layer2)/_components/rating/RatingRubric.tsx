"use client";
import { useT } from "@/lib/i18n/client";

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
  RATING_MAX,
  formatMean,
  overall,
  type PartId,
  type PartScore,
  type RateExamError,
} from "@/lib/rating";
import { ScoreScale } from "@/components/rating/ScoreScale";
import { SuccessToast } from "@/components/ui/SuccessToast";
import type { MessageKey } from "@/lib/i18n/translate";
import { submitRating } from "./submitRating";

/**
 * Nhãn từng phần theo ngôn ngữ hiện hành. `lib/rating/index.ts` giữ
 * `PART_META` tiếng Anh làm dữ liệu THUẦN (test đơn vị assert đúng chuỗi đó,
 * và server action rateErrorMessage có thể cần bản không phụ thuộc `t`) — chỗ
 * hiển thị lấy nhãn từ đây thay vì từ PART_META, để không phải kéo `t` xuyên
 * qua một module thuần không có React.
 */
const PART_LABEL_KEYS: Record<PartId, { eyebrow: MessageKey; name: MessageKey; description: MessageKey }> = {
  mcq: {
    eyebrow: "rating.mcqEyebrow",
    name: "rating.mcqName",
    description: "rating.mcqDescription",
  },
  true_false: {
    eyebrow: "rating.tfEyebrow",
    name: "rating.tfName",
    description: "rating.tfDescription",
  },
  short_answer: {
    eyebrow: "rating.saEyebrow",
    name: "rating.saName",
    description: "rating.saDescription",
  },
};

const RATE_ERROR_KEYS: Record<RateExamError, MessageKey> = {
  ineligible: "rating.errIneligible",
  invalid: "rating.errInvalid",
  rate_limited: "rating.errRateLimited",
  server: "rating.errServer",
};

export interface RatingRubricProps {
  examId: string;
  initialScores?: Partial<Record<PartId, PartScore>>;
}

type SubmitState = "idle" | "submitting" | "error";

export function RatingRubric({ examId, initialScores }: RatingRubricProps) {
  const t = useT();
  const [scores, setScores] = useState<Partial<Record<PartId, PartScore>>>(initialScores ?? {});
  const [activeIndex, setActiveIndex] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [toastTrigger, setToastTrigger] = useState(0);

  const headingId = `rating-heading-${examId}`;
  const submitHintId = `rating-submit-hint-${examId}`;
  const allRated = PART_IDS.every((id) => scores[id] !== undefined);
  const submitDisabled = !allRated || submitState === "submitting";

  // Đọc lại tại chỗ (không dùng readoutModel — trạng thái của nó là chuỗi
  // tiếng Anh bake sẵn "RATED"/"N/3 RATED", không dịch được bằng tham số).
  const ratedIds = PART_IDS.filter((id) => scores[id] !== undefined);
  const readoutValue =
    ratedIds.length === 0
      ? "—"
      : ratedIds.length === PART_IDS.length
        ? formatMean(
            overall(
              scores.mcq as number,
              scores.true_false as number,
              scores.short_answer as number
            )
          )
        : formatMean(
            ratedIds.reduce((sum, id) => sum + (scores[id] as number), 0) / ratedIds.length
          );
  const readoutStatus =
    ratedIds.length === 0
      ? t("rating.unrated")
      : ratedIds.length === PART_IDS.length
        ? t("rating.rated")
        : t("rating.partiallyRated", { rated: ratedIds.length, total: PART_IDS.length });

  const activePart = PART_IDS[activeIndex];
  const labelKeys = PART_LABEL_KEYS[activePart];
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
      setErrorMessage(t(RATE_ERROR_KEYS[result.error]));
    }
  }

  const submitLabel =
    submitState === "submitting" ? t("report.submitting") : t("rating.submitRating");

  return (
    <div className="border-border bg-card rounded-xl border p-6 sm:p-8">
      <div className="flex items-baseline justify-end gap-4">
        <span id={headingId} className="eyebrow text-muted-foreground">
          {t("rating.partOf", { part: activeIndex + 1, total: PART_IDS.length })}
        </span>
      </div>

      <div
        key={activePart}
        className={`motion-safe:animate-in motion-safe:fade-in mt-3 motion-safe:duration-300 motion-safe:ease-out ${
          direction === 1 ? "motion-safe:slide-in-from-right-3" : "motion-safe:slide-in-from-left-3"
        }`}
        role="group"
        aria-label={t(labelKeys.name)}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="eyebrow">{t(labelKeys.eyebrow)}</p>
          <p className="text-brand font-serif text-lg tabular-nums transition-colors duration-200">
            {score ?? "—"}
            <span className="text-muted-foreground font-sans text-sm">/{RATING_MAX}</span>
          </p>
        </div>
        <div className="mt-4">
          <span id={scaleLabelId} className="sr-only">
            {t("rating.rateFromTo", { name: t(labelKeys.name) })}
          </span>
          <ScoreScale
            value={score}
            onChange={(v) => setScores((prev) => ({ ...prev, [activePart]: v }))}
            labelledBy={scaleLabelId}
          />
        </div>
      </div>

      <div className="border-border mt-5 flex items-center justify-between border-t pt-4">
        <button
          type="button"
          onClick={goPrev}
          disabled={isFirst}
          className="text-foreground hover:text-brand disabled:hover:text-foreground text-xs font-medium tracking-[0.14em] uppercase transition-all disabled:opacity-30"
        >
          ← {t("rating.prev")}
        </button>
        <button
          type="button"
          onClick={goNext}
          disabled={isLast}
          className="text-foreground hover:text-brand disabled:hover:text-foreground text-xs font-medium tracking-[0.14em] uppercase transition-all disabled:opacity-30"
        >
          {t("common.next")}
        </button>
      </div>

      <div className="border-border mt-5 flex items-center justify-between gap-4 border-t pt-5">
        <div>
          <span className="eyebrow">{t("rating.overall")}</span>
          <p className="text-foreground mt-1 font-serif text-3xl tabular-nums">
            {readoutValue}
            <span className="text-muted-foreground font-sans text-base">
              {" "}
              /{RATING_MAX} · {readoutStatus}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitDisabled}
            aria-busy={submitState === "submitting"}
            aria-describedby={
              submitDisabled && submitState !== "submitting" ? submitHintId : undefined
            }
            className="bg-brand text-brand-foreground flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-medium tracking-[0.14em] uppercase transition-all duration-200 hover:opacity-90 disabled:opacity-50"
          >
            {submitState === "submitting" && (
              <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3 motion-safe:animate-spin">
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
            {t("rating.rateAllParts")}
          </span>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-brand mt-3 text-sm">
          {errorMessage}
        </p>
      )}

      <SuccessToast message={t("rating.submitted")} trigger={toastTrigger} />
    </div>
  );
}
