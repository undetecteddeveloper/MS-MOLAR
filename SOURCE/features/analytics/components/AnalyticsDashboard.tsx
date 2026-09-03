"use client";
import { useT } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/translate";

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
import { BarChartCard } from "@/features/analytics/components/BarChartCard";
import { DonutChartCard } from "@/features/analytics/components/DonutChartCard";
import { WeakTopicsCard } from "@/features/analytics/components/WeakTopicsCard";
import type { TopicWeakness } from "@/lib/analytics/weakTopics";
import {
  DEFAULT_RANGE,
  RANGE_ORDER,
  type SubjectStats,
  type TimeRange,
} from "@/lib/analytics/constants";

type Tab = "bar" | "donut";

const TABS: { value: Tab; labelKey: MessageKey }[] = [
  { value: "bar", labelKey: "analytics.tabBar" },
  { value: "donut", labelKey: "analytics.tabDonut" },
];

const TITLE_KEY: Record<Tab, MessageKey> = {
  bar: "analytics.barTitle",
  donut: "analytics.donutTitle",
};

const RANGE_LABEL_KEY: Record<TimeRange, MessageKey> = {
  week: "analytics.rangeWeek",
  month: "analytics.rangeMonth",
  all: "analytics.rangeAll",
};

export function AnalyticsDashboard({
  dataByRange,
  weakTopicsByRange,
}: {
  dataByRange: Record<TimeRange, SubjectStats[]>;
  weakTopicsByRange: Record<TimeRange, TopicWeakness[]>;
}) {
  const t = useT();
  const [tab, setTab] = useState<Tab>("bar");
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [filterTouched, setFilterTouched] = useState(false);

  const data = dataByRange[range];
  const weakTopics = weakTopicsByRange[range];

  const filterSlot = (
    <select
      aria-label={t("analytics.timeRangeFilter")}
      value={filterTouched ? range : ""}
      onChange={(e) => {
        setFilterTouched(true);
        setRange(e.target.value as TimeRange);
      }}
      className="border-border bg-card text-foreground focus:border-brand rounded-md border px-3 py-2 text-sm outline-none"
    >
      {!filterTouched && (
        <option value="" disabled>
          {t("common.filter")}
        </option>
      )}
      {RANGE_ORDER.map((r) => (
        <option key={r} value={r}>
          {t(RANGE_LABEL_KEY[r])}
        </option>
      ))}
    </select>
  );

  return (
    <div>
      <div className="border-border flex items-center gap-6 border-b">
        {/* `tabDef` chứ không phải `t` — biến map cũ che mất hàm dịch. */}
        {TABS.map((tabDef) => {
          const isActive = tab === tabDef.value;
          return (
            <button
              key={tabDef.value}
              type="button"
              onClick={() => setTab(tabDef.value)}
              className={[
                "relative pb-3 font-sans text-xs font-medium tracking-[0.2em] uppercase transition-colors",
                "after:bg-brand after:absolute after:-bottom-px after:left-0 after:h-[2px] after:w-full after:origin-center after:scale-x-0 after:transition-transform after:content-['']",
                isActive
                  ? "text-brand after:scale-x-100"
                  : "text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              {t(tabDef.labelKey)}
            </button>
          );
        })}
      </div>

      <div className="mt-6">
        {data.length === 0 ? (
          <div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-foreground font-serif text-2xl">{t(TITLE_KEY[tab])}</h2>
                <p className="text-muted-foreground mt-1 text-sm">{t("analytics.noData")}</p>
              </div>
              {filterSlot}
            </div>
            <div className="border-border bg-card mt-4 rounded-md border p-5">
              <p className="text-foreground font-serif text-lg">{t("analytics.noData")}</p>
              <p className="text-muted-foreground mt-1 text-sm">{t("analytics.noDataHint")}</p>
            </div>
          </div>
        ) : tab === "bar" ? (
          <>
            <BarChartCard data={data} filterSlot={filterSlot} />
            {/* Chỉ ở tab BAR: tab đó nói "môn nào sai nhiều", thẻ này nói tiếp
                "trong đó sửa cái gì" — cùng một mạch đọc. Tab DONUT nói về tỷ
                trọng luyện tập, một câu hỏi khác hẳn. */}
            <WeakTopicsCard topics={weakTopics} />
          </>
        ) : (
          <DonutChartCard
            data={data}
            rangeLabel={t(RANGE_LABEL_KEY[range])}
            filterSlot={filterSlot}
          />
        )}
      </div>
    </div>
  );
}
