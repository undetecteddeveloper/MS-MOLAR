"use client";

// PartDetail — panel tối full-width của phần đang active (Rating System, UI
// Spec Component: PartDetail). Giữ state CHỌN TẠM (`selected`, khởi tạo từ
// `value` — điểm đã commit trước đó nếu có) tách biệt khỏi `scores` của
// RatingForm: chỉ khi bấm "SUBMIT RATING" mới gọi onCommit để ghi vào state
// cha; "← Back to overview" bỏ chọn tạm, KHÔNG commit (điểm đã commit trước đó
// vẫn giữ nguyên — spec: "unselected parts stay unrated; a previously
// committed score is retained"). Vì component remount mỗi lần một phần khác
// được mở (RatingForm chỉ render PartDetail khi có activePart), `selected`
// tự reset đúng theo value mới mỗi lần mount — không cần effect đồng bộ tay.

import { useState } from "react";
import { CircleScale } from "@/components/rating/CircleScale";
import { PART_META, type PartId, type PartScore } from "@/lib/rating";

interface PartDetailProps {
  part: PartId;
  value?: PartScore;
  onCommit: (v: PartScore) => void;
  onBack: () => void;
}

export function PartDetail({ part, value, onCommit, onBack }: PartDetailProps) {
  const [selected, setSelected] = useState<PartScore | undefined>(value);
  const meta = PART_META[part];
  const scaleLabelId = `rating-scale-label-${part}`;

  return (
    <div className="rounded-lg bg-[var(--sidebar)] p-6 text-[var(--sidebar-foreground)]">
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-[color:var(--sidebar-accent)] transition-colors hover:opacity-80"
      >
        ← Back to overview
      </button>

      {/* Eyebrow đổi copper (không phải brand-red literal) — kích thước
          small-caps < 24px trên nền tối, DESIGN.md cấm chữ đỏ dưới 24px trên
          ink (frontend DD § PartDetail note). */}
      <p className="eyebrow mt-4 text-[color:var(--sidebar-accent)]">{meta.eyebrow}</p>
      <h3 className="font-serif text-xl">{meta.name}</h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-[rgb(237_225_200_/_0.75)]">
        {meta.description}
      </p>

      <p id={scaleLabelId} className="eyebrow mt-6 text-[color:var(--sidebar-accent)]">
        RATE DIFFICULTY — 1 (EASIEST) TO 10 (HARDEST)
      </p>
      <div className="mt-3">
        <CircleScale
          name={part}
          value={selected}
          onChange={setSelected}
          labelledBy={scaleLabelId}
        />
      </div>

      <div className="mt-6 flex items-center gap-4">
        <button
          type="button"
          disabled={selected === undefined}
          onClick={() => {
            if (selected !== undefined) onCommit(selected);
          }}
          className="bg-brand text-brand-foreground rounded-[4px] px-4 py-2 text-xs font-medium tracking-[0.14em] uppercase transition-opacity disabled:opacity-60"
        >
          SUBMIT RATING
        </button>
        <span className="text-sm">Selected: {selected ?? "—"}/10</span>
      </div>
    </div>
  );
}
