"use client";

// AnalyticsDashboard — client island for /me/dashboard (Layer 3). Owns
// activeTab/range/filterTouched state per docs/design/analytics-layer3-design.md
// component plan #3, wired to real data per
// docs/design/analytics-layer3-data-logic-design.md § Client Rewire Detail.
//
// Hidden feature #1: the range <select> shows the "Filter" placeholder until
// the user touches it, but `range` itself already defaults to DEFAULT_RANGE
// ("week") underneath — data lookup is never gated by `filterTouched`, only
// the select's displayed value is.
//
// Empty-state branch (data-logic decision #5): when the active range has zero
// subjects, render an empty-state panel *instead of* the chart card — the
// frozen chart components (BarChartCard/DonutChartCard) are never called with
// an empty array (guards DonutChartCard's computeShares from a degenerate
// 0-session set). Tab nav + the range filterSlot remain interactive so the
// user can switch to a populated range without a reload.
import { useState } from "react";
import { BarChartCard } from "./BarChartCard";
import { DonutChartCard } from "./DonutChartCard";
import {
  DEFAULT_RANGE,
  RANGE_LABELS,
  RANGE_ORDER,
  type SubjectStats,
  type TimeRange,
} from "@/lib/fake-data/analytics";

type Tab = "bar" | "donut";

const TABS: { value: Tab; label: string }[] = [
  { value: "bar", label: "BAR" },
  { value: "donut", label: "DONUT" },
];

const TITLES: Record<Tab, string> = {
  bar: "Correct vs. Incorrect by Subject",
  donut: "Most Frequently Practiced Subject",
};

export function AnalyticsDashboard({
  dataByRange,
}: {
  dataByRange: Record<TimeRange, SubjectStats[]>;
}) {
  const [tab, setTab] = useState<Tab>("bar");
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [filterTouched, setFilterTouched] = useState(false);

  const data = dataByRange[range];

  const filterSlot = (
    <select
      aria-label="Time range filter"
      value={filterTouched ? range : ""}
      onChange={(e) => {
        setFilterTouched(true);
        setRange(e.target.value as TimeRange);
      }}
      className="border-border bg-card text-foreground focus:border-brand rounded-md border px-3 py-2 text-sm outline-none"
    >
      {!filterTouched && (
        <option value="" disabled>
          Filter
        </option>
      )}
      {RANGE_ORDER.map((r) => (
        <option key={r} value={r}>
          {RANGE_LABELS[r]}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="border-border flex items-center gap-6 border-b">
        {TABS.map((t) => {
          const isActive = tab === t.value;
          return (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={[
                "relative pb-3 font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors",
                "after:absolute after:-bottom-px after:left-0 after:h-[2px] after:w-full after:origin-center after:scale-x-0 after:bg-brand after:transition-transform after:content-['']",
                isActive
                  ? "text-brand after:scale-x-100"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {data.length === 0 ? (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif text-2xl text-foreground">{TITLES[tab]}</h2>
                <p className="mt-1 text-sm text-muted-foreground">No data yet</p>
              </div>
              {filterSlot}
            </div>
            <div className="border-border bg-card mt-4 rounded-md border p-5">
              <p className="font-serif text-lg text-foreground">No data yet</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete a submitted attempt in this range to see analytics.
              </p>
            </div>
          </div>
        ) : tab === "bar" ? (
          <BarChartCard data={data} filterSlot={filterSlot} />
        ) : (
          <DonutChartCard data={data} rangeLabel={RANGE_LABELS[range]} filterSlot={filterSlot} />
        )}
      </div>
    </div>
  );
}
