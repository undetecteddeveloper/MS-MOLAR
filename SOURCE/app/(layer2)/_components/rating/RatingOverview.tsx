// RatingOverview — panel ngà (ivory) của RatingForm: tiêu đề, subtitle, header
// SUBMIT + divider copper + overall readout, và 3 PartCard (Rating System, UI
// Spec Component: RatingOverview). Thuần trình bày — mọi state (scores,
// submit lifecycle) do RatingForm điều khiển qua props.

import { PART_IDS, type PartId, type PartScore, type ReadoutModel } from "@/lib/rating";
import { PartCard } from "./PartCard";

interface RatingOverviewProps {
  headingId: string;
  scores: Partial<Record<PartId, PartScore>>;
  readout: ReadoutModel;
  onOpenPart: (part: PartId) => void;
  submitDisabled: boolean;
  submitBusy: boolean;
  submitLabel: string;
  submitHintId: string;
  onSubmit: () => void;
  errorMessage: string | null;
}

export function RatingOverview({
  headingId,
  scores,
  readout,
  onOpenPart,
  submitDisabled,
  submitBusy,
  submitLabel,
  submitHintId,
  onSubmit,
  errorMessage,
}: RatingOverviewProps) {
  return (
    <div className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <h2 id={headingId} className="font-serif text-2xl">
            2025 Exam Difficulty Scale
          </h2>
          <p className="text-muted-foreground mt-2 max-w-sm text-sm">
            Tap a section below to rate it. Overall score averages the rated sections.
          </p>
          {/* Copper rule divider 40x2px — inline precedent (HomeStage.tsx), KHÔNG
              class "rule-divider" (không tồn tại) và KHÔNG CSS --accent (ivory nhạt). */}
          <div className="mt-4 h-0.5 w-10 bg-[#B8863B]" aria-hidden />
        </div>

        <div className="flex flex-col items-end gap-2">
          {/* Nút SUBMIT header — MỘT className duy nhất cho cả 2 trạng thái:
              disabled:opacity-60 (pinned-disabled treatment) tự áp khi thiếu
              phần chưa chấm HOẶC đang submitting; full-strength khi đủ 3 phần
              và không submitting (Reference Contract row 1). */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={submitDisabled}
            aria-busy={submitBusy}
            aria-describedby={submitDisabled && !submitBusy ? submitHintId : undefined}
            className="bg-brand text-brand-foreground rounded-[4px] px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity disabled:opacity-60"
          >
            {submitLabel}
          </button>
          <span id={submitHintId} className="sr-only">
            Rate all three parts to submit.
          </span>
          <p className="text-muted-foreground text-sm">
            OVERALL {readout.value}/10 · {readout.status}
          </p>
        </div>
      </div>

      {errorMessage && (
        <p role="alert" className="text-brand mt-4 text-sm">
          {errorMessage}
        </p>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {PART_IDS.map((part) => (
          <PartCard key={part} part={part} score={scores[part]} onOpen={() => onOpenPart(part)} />
        ))}
      </div>
    </div>
  );
}
