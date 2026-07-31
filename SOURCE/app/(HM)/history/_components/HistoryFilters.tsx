"use client";

// HistoryFilters — front-adjust: inline filter trigger for /history, sitting
// beside the "History" heading (engineer feedback: the earlier sticky
// left-rail placement — copied from ExamFilters — was rejected; the trigger
// now lives in the page header row, balanced against the title, dropdown
// opening below-right like HistoryRowMenu's ⋯ menu). The overlay panel's own
// content/style (ivory rgba tone, FilterRow dropdown-list pattern,
// URL-searchParams-driven filtering re-queried by the Server Component page)
// is unchanged from ExamFilters' convention — only the trigger/anchor moved.
// FilterRow/Triangle are duplicated locally rather than imported —
// ExamFilters keeps them module-private too, and this is only the 2nd
// occurrence (not yet a Rule-of-Three extraction).
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";

export interface HistoryFiltersSelected {
  subject?: string;
  examId?: string;
  scoreMin?: number;
  scoreMax?: number;
  dateFrom?: string;
  dateTo?: string;
}

interface HistoryFiltersProps {
  subjects: string[];
  exams: { id: string; title: string }[];
  selected: HistoryFiltersSelected;
}

// rgba khai báo tường minh (theo convention ExamFilters) — tông ngà #EDE1C8.
const PANEL_BG = "rgba(237, 225, 200, 0.98)";
const OPTIONS_BG = "rgba(237, 225, 200, 0.99)";
const SCRIM_BG = "rgba(27, 21, 18, 0.08)";

export function HistoryFilters({ subjects, exams, selected }: HistoryFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    startTransition(() => {
      router.push(params.toString() ? `${pathname}?${params}` : pathname, { scroll: false });
    });
  }

  function clearAll() {
    startTransition(() => router.push(pathname, { scroll: false }));
  }

  const hasFilters =
    selected.subject !== undefined ||
    selected.examId !== undefined ||
    selected.scoreMin !== undefined ||
    selected.scoreMax !== undefined ||
    selected.dateFrom !== undefined ||
    selected.dateTo !== undefined;

  const selectedExamTitle = exams.find((e) => e.id === selected.examId)?.title;

  return (
    <>
      {open && (
        <button
          aria-hidden
          tabIndex={-1}
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-10 cursor-default"
          style={{ backgroundColor: SCRIM_BG }}
        />
      )}

      <div className="relative" data-pending={isPending ? "" : undefined}>
        <button
          type="button"
          aria-label="Filters"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="border-border bg-card hover:border-brand/40 flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-foreground transition-colors"
        >
          <Triangle open={open} />
          Filters
          {hasFilters && <span aria-hidden className="bg-brand size-1.5 shrink-0 rounded-full" />}
        </button>

        {open && (
          <div
            className="border-border absolute top-full right-0 z-20 mt-2 w-[84vw] max-w-xs border"
            style={{ backgroundColor: PANEL_BG }}
          >
            <div className="border-border bg-background/60 flex w-full items-center justify-between gap-3 border-b px-4 py-3">
              <span className="eyebrow">Filters{hasFilters ? " · active" : ""}</span>
              <button
                type="button"
                onClick={clearAll}
                disabled={!hasFilters}
                className="text-muted-foreground hover:text-brand text-xs underline-offset-4 transition-colors hover:underline disabled:pointer-events-none disabled:opacity-40"
              >
                Clear
              </button>
            </div>

            <FilterRow
              label="Subject"
              selectedLabel={selected.subject}
              currentValue={selected.subject ?? ""}
              options={[
                { value: "", label: "All" },
                ...subjects.map((s) => ({ value: s, label: s })),
              ]}
              onSelect={(v) => setParam("subject", v)}
            />
            <FilterRow
              label="Exam"
              selectedLabel={selectedExamTitle}
              currentValue={selected.examId ?? ""}
              options={[
                { value: "", label: "All" },
                ...exams.map((e) => ({ value: e.id, label: e.title })),
              ]}
              onSelect={(v) => setParam("examId", v)}
            />

            <RangeRow label="Score">
              <NumberField
                ariaLabel="Minimum score"
                value={selected.scoreMin}
                min={0}
                max={10}
                step={0.1}
                placeholder="Min"
                onCommit={(v) => setParam("scoreMin", v)}
              />
              <span className="text-muted-foreground text-xs">–</span>
              <NumberField
                ariaLabel="Maximum score"
                value={selected.scoreMax}
                min={0}
                max={10}
                step={0.1}
                placeholder="Max"
                onCommit={(v) => setParam("scoreMax", v)}
              />
            </RangeRow>

            <RangeRow label="Submitted" last>
              <DateField
                ariaLabel="Submitted from date"
                value={selected.dateFrom}
                onCommit={(v) => setParam("dateFrom", v)}
              />
              <span className="text-muted-foreground text-xs">–</span>
              <DateField
                ariaLabel="Submitted to date"
                value={selected.dateTo}
                onCommit={(v) => setParam("dateTo", v)}
              />
            </RangeRow>
          </div>
        )}
      </div>
    </>
  );
}

interface Option {
  value: string;
  label: string;
}

function FilterRow({
  label,
  selectedLabel,
  currentValue,
  options,
  onSelect,
}: {
  label: string;
  selectedLabel?: string;
  currentValue?: string;
  options: Option[];
  onSelect: (value: string) => void;
}) {
  const [rowOpen, setRowOpen] = useState(false);

  return (
    <div className="relative border-border border-b">
      <button
        type="button"
        aria-expanded={rowOpen}
        onClick={() => setRowOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <span className="flex flex-col gap-0.5">
          <span className="eyebrow">{label}</span>
          {selectedLabel && (
            <span className="text-foreground truncate font-serif text-base">{selectedLabel}</span>
          )}
        </span>
      </button>

      {rowOpen && (
        <div
          className="border-border absolute inset-x-0 top-full z-30 max-h-56 overflow-y-auto border-x border-b"
          style={{ backgroundColor: OPTIONS_BG }}
        >
          <ul className="py-1">
            {options.map((opt) => {
              const active = opt.value === currentValue;
              return (
                <li key={opt.value || "all"}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(opt.value);
                      setRowOpen(false);
                    }}
                    aria-pressed={active}
                    className={`flex w-full items-center gap-2 px-4 py-2 text-left font-serif text-base transition-colors ${
                      active ? "text-brand" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-px w-3 shrink-0 transition-colors ${
                        active ? "bg-brand" : "bg-transparent"
                      }`}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

function RangeRow({
  label,
  last = false,
  children,
}: {
  label: string;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-4 py-3 ${last ? "" : "border-border border-b"}`}>
      <span className="eyebrow">{label}</span>
      <div className="mt-1.5 flex items-center gap-2">{children}</div>
    </div>
  );
}

function NumberField({
  ariaLabel,
  value,
  min,
  max,
  step,
  placeholder,
  onCommit,
}: {
  ariaLabel: string;
  value?: number;
  min: number;
  max: number;
  step: number;
  placeholder: string;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      // Remount when the URL-driven value changes externally (e.g. Clear) —
      // this is an uncontrolled field (commits on blur, not per keystroke).
      key={value ?? "empty"}
      type="number"
      aria-label={ariaLabel}
      defaultValue={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      onBlur={(e) => onCommit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      className="border-border text-foreground focus:border-brand w-16 rounded border bg-transparent px-2 py-1 text-sm outline-none"
    />
  );
}

function DateField({
  ariaLabel,
  value,
  onCommit,
}: {
  ariaLabel: string;
  value?: string;
  onCommit: (value: string) => void;
}) {
  return (
    <input
      key={value ?? "empty"}
      type="date"
      aria-label={ariaLabel}
      defaultValue={value ?? ""}
      onBlur={(e) => onCommit(e.target.value)}
      className="border-border text-foreground focus:border-brand w-full min-w-0 rounded border bg-transparent px-2 py-1 text-xs outline-none"
    />
  );
}

// Tam giác đen MASTER: ▶ (đóng) → ▼ (mở) — bản sao Triangle của ExamFilters.
function Triangle({ open }: { open: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 12 12"
      className={`fill-foreground size-3.5 shrink-0 transition-transform ${
        open ? "rotate-90" : ""
      }`}
    >
      <path d="M2 1 L10 6 L2 11 Z" />
    </svg>
  );
}
