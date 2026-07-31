# Analytics (Layer 3) — Design Document (UI-only pass)

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-07-21 |
| **Status** | Draft — pending user approval |
| **Scope** | UI only. Renders against mocked/simulated data; no Supabase queries, no real scoring pipeline wiring. |

## Design Summary (Meta)

```yaml
design_type: "new page"           # (layer3) route group is currently empty
risk_level: "low"                 # no DB/RLS/auth surface touched in this pass; visual + client-state only
complexity_level: "medium"        # 2 chart types (bar + donut) with hover/tooltip interaction, hand-rolled SVG (no chart lib in package.json)
main_constraints:
  - "UI only per user request — data is simulated (mirrors hidden-features.md's 3 independent per-range datasets), not fetched from Supabase."
  - "No chart library in dependencies (checked package.json) — charts are hand-rolled inline SVG, consistent with the project's flat, no-shadow/no-gradient design system."
  - "Must reuse SiteHeader (already covers Layer 2/3/4) and the Mực & Sơn Mài design tokens — no new theme."
biggest_risks:
  - "Route mismatch: SiteHeader/HomeSidebar's existing 'Analytics' nav item already points at /me/dashboard, not a /analytics or (layer3)-prefixed path (route groups are pathless). Resolved: user confirmed this page lives at app/(layer3)/me/dashboard/page.tsx so the existing nav item lights up with no nav changes needed."
unknowns:
  - "None blocking — reference has 2 full-page screenshots (BAR tab default, DONUT tab) + a hidden-features.md documenting 8 non-obvious behaviors. Real-data wiring (computeScore/attempts aggregation) is explicitly deferred to a future pass."
```

## Source material

- `SCREENSHOT/design_reference/AnalyticPage_Layer3/screenshots/01-bar-tab-default.png` — BAR tab, "Correct vs. Incorrect by Subject", Week filter, legend (green=Correct/red=Wrong), horizontal gridlines with nice-number labels (25/19/13/…).
- `SCREENSHOT/design_reference/AnalyticPage_Layer3/screenshots/02-donut-tab.png` — DONUT tab, "Most Frequently Practiced Subject", center label (33% / English), right-hand legend list with %.
- `SCREENSHOT/design_reference/AnalyticPage_Layer3/hidden-features.md` — 8 documented behaviors (see below).

## Route & nav

- New page: `app/(layer3)/me/dashboard/page.tsx` → URL `/me/dashboard`. Route groups are pathless, so this matches the **existing** "Analytics" nav item in `SiteHeader.tsx`/`HomeSidebar.tsx` (`href: "/me/dashboard"`) — confirmed with user, no nav/href edits needed.
- Layout: no `(layer3)/layout.tsx` exists yet. Add one that renders `<SiteHeader user={...} />` above `{children}`, mirroring `(layer2)/layout.tsx` / `(layer4)/layout.tsx` (fetch the session user once, pass to header).

## Component plan (5 files — Medium scale)

1. **`app/(layer3)/layout.tsx`** — session fetch + `<SiteHeader>` shell (copy pattern from `(layer4)/layout.tsx`).
2. **`app/(layer3)/me/dashboard/page.tsx`** — server component; page chrome (title "Analytics", subtitle, `preload-fade` ordering per other pages), renders `<AnalyticsDashboard />` client island.
3. **`app/(layer3)/_components/AnalyticsDashboard.tsx`** (client) — owns `activeTab: "bar" | "donut"`, `range: "week" | "month" | "all"`, and `filterTouched: boolean` state (hidden feature #1: dropdown displays placeholder "Filter" until touched, but data defaults to Week underneath). Renders tab bar + filter `<select>` + the active chart card.
4. **`app/(layer3)/_components/BarChartCard.tsx`** (client) — hand-rolled SVG grouped bar chart. Implements: adaptive Y-axis via `niceCeil()` (#4), per-subject fixed colors (#5), cursor-following tooltip via `onMouseMove` (#2), hover-dim other groups to 35% opacity over 200ms (#7), automatic "NEEDS REVIEW" tag under bars where `correct/(correct+wrong) < 0.75` (#3, toggled by a `highlightWeakest` prop defaulting `true`).
5. **`app/(layer3)/_components/DonutChartCard.tsx`** (client) — hand-rolled SVG donut (stroke-dasharray segments) + right-hand legend list with %, center `%`/label readout for the top segment. Accepts `donutHighlightCount` prop (#6, default 1, currently a no-op — all segments render full-opacity per hidden-features.md's note that dimming was removed).
6. **`lib/fake-data/analytics.ts`** — simulated datasets: 3 independent hardcoded per-range (`week`/`month`/`all`) correct/wrong/session-count arrays keyed by subject (#8, not derived by scaling one dataset), the fixed subject→color lookup table (#5: Math=lacquer red `--chart-1`/`#A62C2B`, English=green, Physics=blue-gray, Literature=amber, Chemistry=brown, Biology=maroon/purple), and the `niceCeil()` helper (#4).

_(6 files total incl. layout — still Medium scale per the file-count table; no PRD/ADR needed since there's no architecture/data-flow decision, just a new client-rendered page.)_

## Visual spec (from reference + existing tokens)

- Page title: serif `h1` "Analytics" + sans subtitle "Track correct/incorrect answers by subject and practice frequency." — matches `<h1>`/body pattern used elsewhere (e.g. `ExamBrowser`/result pages).
- Tab bar (`BAR` / `DONUT`): same underline-on-active treatment as `SiteHeader` nav (uppercase, tracked, `--brand` underline), not a new tab component.
- Section card: `rounded-md` (8px) border `--border`, `--card` background — same recipe as `TopicBreakdown`'s `<section className="rounded-xl border border-border bg-card p-4">` (screenshots show a plain hairline-bordered flat panel, no shadow, consistent with "no elevation" rule).
- Colors: legend swatches + bars/donut segments use small filled squares/segments only (never large text/background fills of `--brand`) — compliant with the "Đỏ son never covers large blocks" hard rule.
- Filter dropdown: native `<select>` styled to match existing form fields (see `EntryModeField`/`MetadataFields` input styling) rather than a new custom dropdown component.

## Hidden features → implementation mapping

| # | Behavior | Where |
|---|---|---|
| 1 | Filter shows "Filter" placeholder until touched; data defaults to Week regardless | `AnalyticsDashboard` — `filterTouched` state gates the `<select>` displayed value only, not the `range` value used for data lookup |
| 2 | Cursor-following tooltip on bar hover | `BarChartCard` — `onMouseMove` on the bar-group hit area, tooltip positioned from event coords |
| 3 | Auto "NEEDS REVIEW" tag, accuracy < 75%, computed not manual | `BarChartCard` — derived per subject from `correct/(correct+wrong)`, gated by `highlightWeakest` prop |
| 4 | Adaptive Y-axis via nice-number rounding | `lib/fake-data/analytics.ts` — `niceCeil(max)`, recomputed per `range` |
| 5 | Fixed per-subject color mapping | `lib/fake-data/analytics.ts` — `SUBJECT_COLORS` lookup, shared by both charts |
| 6 | `donutHighlightCount` prop (currently no-op) | `DonutChartCard` — prop accepted, plumbed through, defaults to showing all segments full-opacity |
| 7 | Bar-chart hover-dim to 35%, 200ms | `BarChartCard` — `hoveredSubject` state, CSS `transition-opacity duration-200` |
| 8 | 3 independent hardcoded datasets (not scaled) | `lib/fake-data/analytics.ts` — separate `WEEK`/`MONTH`/`ALL` records |

## Non-scope (explicitly deferred)

- Real data: no Supabase query against `attempts`/`questions` — a future pass wires `AnalyticsDashboard` to real aggregates without changing the chart components' props contract.
- Any new nav/header changes — the existing "Analytics" href already resolves correctly once this page exists at `/me/dashboard`.
- Mobile-specific layout beyond the existing responsive patterns already used by `SiteHeader`/other Layer 2/4 pages.

## Testing plan (this pass)

- `npx tsc --noEmit` + `npm run lint` — type/lint clean.
- Manual verification: run `npm run dev`, navigate to `/me/dashboard`, screenshot both tabs via Playwright MCP, compare against the two reference screenshots side-by-side, iterate until visually aligned (spacing, colors, typography, gridlines).
- Confirm the "Analytics" nav tag shows the active underline/red-son style while on this page (regression check against the nav active-state fix already shipped for Upload/Review).
