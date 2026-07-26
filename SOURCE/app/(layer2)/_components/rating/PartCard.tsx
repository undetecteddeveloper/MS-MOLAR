// PartCard — một ô overview tối (dark) trong RatingOverview (Rating System, UI
// Spec Component: PartCard). Thuần trình bày — không giữ state riêng; click bất
// kỳ đâu trên thẻ mở PartDetail của phần đó (onOpen do RatingForm điều khiển
// activePart).

import { PART_META, type PartId, type PartScore } from "@/lib/rating";

interface PartCardProps {
  part: PartId;
  score?: PartScore;
  onOpen: () => void;
}

export function PartCard({ part, score, onOpen }: PartCardProps) {
  const meta = PART_META[part];
  const progressPercent = score ? (score / 10) * 100 : 0;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex flex-col gap-2 rounded-lg bg-[var(--sidebar)] p-4 text-left text-[var(--sidebar-foreground)] transition-colors hover:bg-[#241d19] focus-visible:ring-2 focus-visible:ring-[color:var(--ring)] focus-visible:outline-none"
    >
      <span className="eyebrow text-[color:var(--sidebar-accent)]">{meta.eyebrow}</span>
      <span className="font-serif text-2xl tabular-nums">{score ?? "—"}/10</span>
      <div className="h-1 w-full rounded-full bg-[rgb(237_225_200_/_0.12)]" aria-hidden>
        <div
          className="h-1 rounded-full bg-[color:var(--sidebar-accent)] transition-[width]"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <span className="text-sm font-bold text-[var(--sidebar-foreground)]">{meta.name}</span>
      <span className="text-xs font-medium tracking-[0.14em] text-[color:var(--sidebar-accent)] uppercase">
        Rate →
      </span>
    </button>
  );
}
