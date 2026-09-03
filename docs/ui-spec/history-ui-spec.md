# History — UI Specification

| | |
|---|---|
| **Version** | 1.1 |
| **Date** | 2026-07-28 |
| **Status** | Draft — ready for ADR/Design Doc chain. |
| **PRD** | `docs/prd/history-prd.md` (v1.2, Draft — product decisions locked with the product owner (2026-07-27), ready for downstream chain) |
| **ADR** | `docs/adr/ADR-0009-pdf-generation-library-choice.md` (Accepted) — governs the `AttemptPdfTemplate` subtree constraints in this document |

## Revision History

| Version | Date | Change |
|---|---|---|
| 1.0 | 2026-07-27 | Initial version. No prototype provided (confirmed with user); design is fresh, built on the existing "Ink & Lacquer" system and codebase precedents. Resolves the 3 PRD Undetermined Items owned by this document (share-fallback UX, PDF filename convention, pagination threshold). |
| 1.1 | 2026-07-28 | Document-reviewer fix pass (approved_with_conditions), targeted fixes only: (1) corrected the PRD status citation in the header and Overview > Target PRD to match `docs/prd/history-prd.md`'s actual Status field ("Draft — product decisions locked with product owner", not "approved"); (2) specified the Share-fallback confirmation message's Partial → Default dismissal trigger in `ActionButton`'s AC-012 interaction row and D1 rationale (persists until the next Save/Share activation on that row, no auto-dismiss timer — `SuccessToast.tsx` checked and found not to fit this per-row inline context); (3) narrowed the AC-017 traceability citation to the pre-existing `exam_attempts`/`exam_results` RLS policies (`SOURCE/supabase/schema.sql`), removing the overstated ADR-0001 (UGC-lifecycle scope) attribution. |

## Overview

Defines the `/history` list page, the rewiring of the Result page's `ResultActions`, and the visual layout of the shared `AttemptPdfTemplate` rasterization subtree. Covers PRD R1–R9 in full and resolves R10 (pagination) for MVP scope. No prototype code exists for this feature; existing components (`MyExamsList`/`ExamRow`/`StatusBadge`, `ScoreCard`, `ResultActions`, `RateButton`, `ExtractionProgress`/`ExtractionErrorPanel`) are used as **visual/behavioral precedent**, not literal reuse targets — the History domain (attempts, not exams) requires new components styled consistently with them.

### Target PRD

- PRD path: `docs/prd/history-prd.md` (v1.2, Draft — product decisions locked with the product owner (2026-07-27), ready for downstream chain)
- Feature scope: R1 (list scope/content), R2 (drill-through), R3 (shared PDF module — UI surface only; module internals are Design Doc), R4 (Save), R5 (Share + fallback), R6 (wire `ResultActions`), R7 (nav wiring), R8 (auth guard — UI surface only), R9 (error resilience). R10 (pagination) resolved here for MVP scope per this document's Decisions Record.

### Design Source

| Source | Path | Version |
|--------|------|---------|
| Theme definition | `PROJECT_OVERVIEW.md §2` (repo root) | repo `feat/rating-system`, "Ink & Lacquer" alpha |
| Existing component precedent | `SOURCE/features/authoring/components/MyExamsList.tsx`, `ExamRow.tsx`, `StatusBadge.tsx`; `SOURCE/features/exams/components/ScoreCard.tsx`, `ResultActions.tsx`, `rating/RateButton.tsx`; `SOURCE/features/authoring/components/ExtractionProgress.tsx`, `ExtractionErrorPanel.tsx` | repo `feat/rating-system` |
| Prototype code | None provided | — |

## Prototype Management

No prototype was provided (user-confirmed: design fresh per the existing design system). The canonical specification is this document plus the Design Doc. Existing production screens/components listed above are the visual/behavioral reference; where this document and those screens disagree on a *new* surface, this document wins.

## External Resources Used

Project-tier facts are recorded in `docs/project-context/external-resources.md` (already present, last updated 2026-07-14). Feature-specific subset:

| Resource (project-tier label) | Feature-specific identifier | Notes |
|-------------------------------|-----------------------------|-------|
| Design Origin | `PROJECT_OVERVIEW.md §2` — Colors, Elevation & Depth, Shapes sections | Governs both on-screen History UI and the `AttemptPdfTemplate` subtree (R3/AC-008) |
| Design System | `SOURCE/features/authoring/components/{MyExamsList,ExamRow,StatusBadge}.tsx`, `SOURCE/features/exams/components/ScoreCard.tsx, SOURCE/features/exams/components/ResultActions.tsx, SOURCE/features/exams/components/rating/RateButton.tsx`, `SOURCE/components/ui/{tooltip,button}.tsx` | On-screen History/ResultActions UI may use any of these freely; `AttemptPdfTemplate` may **not** use `components/ui/button.tsx` (ADR-0009) |
| Guidelines | `PROJECT_OVERVIEW.md §2` (visual rules) | Contrast rule (no brand-red-on-black below 24px), no-shadow rule, serif-only-for-display rule |
| Visual Verification Environment | Routes `/history`, `/exams/[id]/attempt/[attemptId]/result` | Verified via `npm run dev` + Playwright MCP + manual mid-range-Android pass (PRD NFR Performance) before ship |

## Decisions Record

Items delegated to this UI Spec by the PRD's Undetermined Items section, plus supporting UI-level decisions. Downstream documents (Design Doc, Work Plan) treat these as fixed unless a listed escalation triggers.

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | **Share-fallback UX (resolves PRD Undetermined Item #1)**: when `navigator.canShare({ files: [pdfFile] })` is false/unsupported, Share performs **the same file download as Save** (not copy-link), followed by an inline confirmation message ("Downloaded — sharing isn't supported in this browser.") rendered in a `role="status" aria-live="polite"` element next to the action. | AC-012 requires only "at minimum, the same PDF download as Save" — that alone satisfies the AC with zero new surface. "Copy-link" is explicitly **rejected**: it would require a persisted, fetchable URL for the Blob, which is either (a) a public/unauthenticated link — forbidden outright by AC-013 — or (b) a server round-trip to host the file, which violates AC-009's "no extra round trip" and ADR-0009's client-only architecture. There is no way to "copy a link" to a local Blob without one of those two violations, so the ambiguity in the PRD's phrasing ("download/copy-link fallback") is resolved in favor of the only option that satisfies every locked AC. The confirmation message exists so the Share click doesn't look broken/silent when the OS share sheet never opens. **Dismissal rule**: the confirmation message persists until the next Save or Share activation on that same row — no auto-dismiss timer. `SOURCE/components/ui/SuccessToast.tsx` was checked for an existing dismissal convention: it is a global, bottom-center, singleton toast driven by a `trigger` counter with a fixed `durationMs` (default 3000ms) auto-dismiss — a pattern built for one page-level success signal at a time, not for multiple simultaneous, row-scoped, next-to-the-action confirmations, so it does not fit this inline-per-row context and is not reused here. With no fitting precedent, the simplest, timer-free rule applies: the message clears only when that row's Save/Share is activated again (see AC-012 interaction row), which requires no additional timer logic. |
| D2 | **PDF filename convention (resolves PRD Undetermined Item #2)**: `{exam-title-slug}_{YYYYMMDD}.pdf`, where the slug is the exam title lowercased, non-alphanumeric runs collapsed to single hyphens, truncated to 60 chars, and the date is the attempt's `submitted_at` (not the moment of Save/Share). Empty/whitespace title (should not occur; `exams.title` is required) falls back to the slug `exam`. Example: `algebra-midterm-1_20260715.pdf`. | Deriving the name from attempt-owned data (not "now()") means re-downloading the same attempt always produces the identical filename — predictable, no incrementing OS-appended "(1)" clutter, and matches the same shared module regardless of entry point (History row vs. `ResultActions`), consistent with AC-007's single-implementation requirement extending to filename logic. Slugging follows the same plain-ASCII, no-diacritics convention already used for the (English-only) UI copy in this codebase. |
| D3 | **History list pagination threshold (resolves PRD Undetermined Item #3)**: MVP ships with **zero query-level pagination** (R10 stays deferred, single unpaginated read per PRD lock). To keep the on-screen list ergonomic on the mid-range-Android baseline without a second query, the list renders inside a bounded-height, internally-scrolling container (`max-h-[30rem] overflow-y-auto`, mirroring `MyExamsList`'s `ExamListScroll`) instead of an unbounded page-length list. A concrete **future trigger** for real (cursor-based, query-level) pagination is set at **50 rows** per user — the Work Plan / Design Doc treats crossing this as the signal to pick up R10; revisit sooner if the mid-range-Android manual QA pass (PRD NFR Performance) shows jank before 50 rows. | Satisfies R10's explicit MVP lock (no pagination shipped) while still resolving the "threshold" question the PRD leaves open, using an existing in-repo scroll-container pattern (zero new interaction to design) rather than inventing a "Load more" control. 50 is a deliberately round, checkable number tied to the same NFR the PRD already cites (mid-range Android/unstable network), not an arbitrary guess. |
| D4 | **Save/Share accessibility pattern**: both actions use `RateButton`'s `aria-disabled="true"` + `aria-describedby` (pointing at a same-DOM `sr-only` reason span) + `Tooltip` pattern for their busy state, **not** `ResultActions`'s current native `disabled` + `title`-only pattern. Native `disabled` removes the element from the tab order, which fails the PRD Accessibility NFR ("fully keyboard-operable, both idle and busy states"). | Reuses an already-audited, in-repo a11y fix (see `RateButton.tsx`'s WCAG 1.4.3 code comment) instead of re-deriving the pattern; keeps Save/Share focusable and their reason discoverable by AT during busy/error states. |
| D5 | **Nav wiring requires no new active-state logic**: `SiteHeader`'s `isActive` is already computed from `usePathname()` (`item.href !== "#" && pathname.startsWith(item.href)`) — changing `href: "#"` to `href: "/history"` alone makes "History" highlight correctly on any `/history/*` route, with no other code change. `HomeSidebar`'s `activeLabel` is a static prop set by its only caller (the homepage) and can never be `"History"` (the homepage is the only page that renders `HomeSidebar`; `/history` renders `SiteHeader` instead) — so `HomeSidebar` needs only its `href` fixed, no active-logic change. | Prevents scope creep: the two files use genuinely different active-state mechanisms, but only one (`SiteHeader`) ever needs to *show* History as active, and its existing logic already handles it. |
| D6 | **`(history)` route-group layout**: `SOURCE/app/(history)/layout.tsx` renders only `SiteHeader` with a nullable user (matching `(exams)/layout.tsx` / `(analytics)/layout.tsx`); the auth guard (AC-016) lives in `SOURCE/app/(history)/history/page.tsx` itself, following the `(authoring)/upload/page.tsx` precedent (`getCurrentUser()` + `redirect("/?auth=signin")`). | PRD Technical Considerations > Dependencies already names this precedent explicitly; restated here so the UI Spec's screen/component ownership is unambiguous. |
| D7 | **List loading/error via Next.js route conventions**: `(history)/history/loading.tsx` (skeleton, mirrors `(authoring)/me/exams/loading.tsx`) for the Loading state; `(history)/history/error.tsx` (Next.js error boundary, client component) for the list-read failure state (AC-019), using its `reset()` callback as the "Retry" action. | Idiomatic App Router mechanism already used once in this codebase (`loading.tsx`); `error.tsx`'s built-in `reset()` gives a working retry with no manual refetch plumbing. |

## AC Traceability (PRD → Screens/Components)

No prototype exists, so this replaces the template's prototype-specific traceability table. "No UI surface" ACs are owned by the Design Doc/RLS, not this document.

| AC ID | Summary | Screen/Component | State |
|-------|---------|-------------------|-------|
| AC-001 | Only submitted+scored attempts appear | S-01 HistoryList | Default |
| AC-002 | Empty state with CTA to browse exams | S-01 HistoryList | Empty |
| AC-003 | Rows ordered `submitted_at` desc | S-01 HistoryList | Default |
| AC-004 | Row shows title, score, submitted date, completion time | S-01 HistoryRow | Default / Partial (missing time → "—") |
| AC-005 | "View details" → existing Result page | S-01 HistoryRow | Default |
| AC-006 | PDF contains only score/time/metadata | AttemptPdfTemplate | Default |
| AC-007 | Exactly one PDF implementation | No UI surface — code-inspection concern (Design Doc/Work Plan); both `HistoryRow`'s ActionButton and `ResultActions` import the same module (Component Tree) | — |
| AC-008 | PDF follows `PROJECT_OVERVIEW.md §2` tokens | AttemptPdfTemplate | Default |
| AC-009 | Save uses only already-loaded data, no extra round trip | ActionButton (Save) | Default |
| AC-010 | Busy state, not double-triggerable | ActionButton | Loading |
| AC-011 | Share opens native share sheet with file | ActionButton (Share) | Default → Loading → Default |
| AC-012 | Unsupported browser → working fallback | ActionButton (Share) | Partial (D1) |
| AC-013 | No public/unauthenticated link ever created | ActionButton (Share) | All states (constraint, not a visual state) |
| AC-014 | `ResultActions` Save/Share enabled, same behavior as History row | S-02 ResultActions | Default |
| AC-015 | Both nav entries → `/history`, active highlight | SiteHeader (nav extension), HomeSidebar (nav extension) | Default |
| AC-016 | Guest redirected to `/?auth=signin`, no fetch | S-01 route guard | No UI surface — page-level guard (Design Doc) |
| AC-017 | RLS scoping to own attempts | — | No UI surface (existing RLS on `exam_attempts`/`exam_results`, `SOURCE/supabase/schema.sql` lines ~159-207, pre-dating this feature — unrelated to ADR-0001's UGC-lifecycle (`exams`/`questions`/`exam_reports`/Storage) scope) |
| AC-018 | PDF-generation failure → actionable, retryable | ActionButton | Error |
| AC-019 | `/history` list-read failure → actionable, retryable | S-01 HistoryList (via `error.tsx`) | Error |

## Screen List and Transitions

### Screen List

| Screen ID | Screen Name | Route | Description | Entry Condition |
|-----------|------------|-------|-------------|-----------------|
| S-01 | History | `/history` | List of the current user's submitted+scored attempts, newest first; each row offers Save/Share/View details | Logged-in user clicks "History" in `SiteHeader`/`HomeSidebar`. Logged-out → redirect `/?auth=signin` (AC-016) |
| S-02 | Result (extended) | `/exams/[id]/attempt/[attemptId]/result` | Existing per-attempt Result page; `ScoreCard`'s Time stat now real, `ResultActions` now wired to Save/Share | Existing entry conditions unchanged (post-submit landing, or revisited via S-01 "View details") |

`AttemptPdfTemplate` is **not a routed screen** — it is an off-DOM, non-visible-to-the-user subtree rendered only long enough for `html2canvas` to rasterize it, then discarded. It is documented under Component Decomposition, referenced from both S-01 and S-02.

### Screen Transition Diagram

```mermaid
flowchart LR
    NAV[SiteHeader / HomeSidebar "History"] -->|logged in| S01[S-01 /history]
    NAV -->|logged out| AUTH["/?auth=signin"]
    S01 -->|"View details" click| S02[S-02 Result page]
    S01 -->|Save/Share click, per row| S01
    S02 -->|Save/Share click| S02
    S02 -.->|revisit later via History nav| S01
```

### Transition Conditions

| Source | Destination | Trigger | Guard Condition |
|--------|------------|---------|-----------------|
| Any | S-01 | "History" nav click | Authenticated; else redirect `/?auth=signin`, no attempt data fetched (AC-016) |
| S-01 | S-02 | "View details" click on a row | None — every rendered row is already the user's own submitted+scored attempt (RLS) |
| S-01 | S-01 | Save/Share click | Stays on page; no navigation, only in-place busy/success/error state on that row |
| S-02 | S-02 | Save/Share click | Stays on page; identical in-place behavior to S-01 |

## Component Decomposition

### Component Tree

```
S-01 /history  (SOURCE/app/(history)/history/page.tsx)
  +-- app/(history)/layout.tsx -- SiteHeader (existing, extended: href="/history")
  +-- HistoryList (new, server component)
      +-- HistoryRow (new)  [x N]
          +-- ActionButton (new, shared atom)  -- Save
          +-- ActionButton (new, shared atom)  -- Share
          +-- "View details" Link (existing Link pattern)
  +-- app/(history)/history/loading.tsx  -- skeleton (Loading state, see HistoryList matrix)
  +-- app/(history)/history/error.tsx    -- error boundary (Error state, see HistoryList matrix)

S-02 /exams/[id]/attempt/[attemptId]/result  (existing page, extended)
  +-- ScoreCard (existing, extended: Time stat computed, no longer "--")
  +-- ResultActions (existing, rewired)
      +-- ActionButton (new, shared atom)  -- Save
      +-- ActionButton (new, shared atom)  -- Share

Shared, non-routed (referenced by both S-01 and S-02):
  generateAttemptPdf.ts (client util; naming/module boundaries owned by Design Doc)
    +-- AttemptPdfTemplate (new component) -- plain-hex-only DOM subtree (ADR-0009)
```

---

### Component: SiteHeader (nav extension)

Existing `SOURCE/components/layout/SiteHeader.tsx`. Change: `NAV` array's `{ label: "History", href: "#" }` → `{ label: "History", href: "/history" }`. No other change (D5: `isActive` logic already handles it).

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response | Error Handling |
|-------|---------------|-------------|-----------------|----------------|
| AC-015 | When a logged-in user clicks "History" | Click/Enter | Navigate to `/history`; nav item shows active (brand-red text + underline) on `/history*` | — |

---

### Component: HomeSidebar (nav extension)

Existing `SOURCE/features/auth/components/HomeSidebar.tsx`. Change: `NAV` array's `{ label: "History", href: "#" }` → `{ label: "History", href: "/history" }`. No `activeLabel` logic change (D5).

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response |
|-------|---------------|-------------|-----------------|
| AC-015 | When a logged-in user clicks "History" from the homepage sidebar | Click/Enter | Navigate to `/history` |

---

### Component: HistoryList

New server component for S-01. Layout mirrors `MyExamsList`: heading "History" (serif) + `rule-divider`, rows in a single column inside a bounded-height scroll container (`max-w-2xl mx-auto px-6 py-10`; list itself `max-h-[30rem] overflow-y-auto` per D3).

#### State x Display Matrix

| State | Default | Loading | Empty | Error | Partial |
|-------|---------|---------|-------|-------|---------|
| Display | `HistoryRow` list, newest-first (AC-001/003) | `(history)/history/loading.tsx`: heading skeleton + 4 pulsing row placeholders (`animate-pulse`, `border-border`, `rounded-lg`, no shadow — mirrors `(authoring)/me/exams/loading.tsx`) | Dashed-border block: serif "No results yet" + caption "Finish an exam to see it here." + primary Link "Browse exams" → `/exams` (AC-002) | `(history)/history/error.tsx`: bordered `role="alert"` notice "Couldn't load your history right now." + "Retry" button calling `reset()` (AC-019) | 1+ rows have an unavailable completion time (data-integrity edge case, e.g. malformed timestamp): that row's Time cell shows "—" (matches `ScoreCard`'s existing symbolic-placeholder convention); the row otherwise renders and functions normally |

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response | State Transition | Error Handling |
|-------|---------------|-------------|-----------------|-------------------|-----------------|
| AC-001 | When the list renders | Navigate to `/history` | Only rows with `status='submitted'` and a matching `exam_results` row appear | Loading → Default | — |
| AC-002 | Given zero completed+scored attempts | Navigate to `/history` | Empty state renders with "Browse exams" CTA | Loading → Empty | — |
| AC-003 | Given 2+ attempts | (render) | Rows ordered `submitted_at` descending | — | — |
| AC-019 | When the list read fails (DB/network) | (server error) | `error.tsx` boundary renders with Retry | Loading → Error | Click "Retry" → `reset()` re-runs the failed render |

---

### Component: HistoryRow

New. One row per attempt, styled after `ExamRow`'s shell: `<li className="flex flex-col gap-3 rounded-lg border border-border p-5 sm:flex-row sm:items-center sm:justify-between">`. Content: exam title (links nowhere itself — the row is read-only except its actions), score `X/10`, submitted date + completion time joined with " · " (matching `ExamRow`'s metadata-line convention), then an action cluster: two `ActionButton`s (Save, Share) + a "View details" text link.

Completion time display format: `submitted_at − started_at` rendered as `"Hh Mm"` when ≥ 60 min, `"Mm Ss"` when ≥ 60 s and < 60 min, `"Ss"` when < 60 s; `"—"` if either timestamp is missing or the diff is negative (defensive fallback, not expected in valid data).

#### State x Display Matrix

| State | Default | Loading | Empty | Error | Partial |
|-------|---------|---------|-------|-------|---------|
| Display | Title, score, date, time, Save/Share/View details all interactive | N/A at row level — busy state lives on the individual `ActionButton` being triggered; the other controls in the row stay interactive | N/A (a rendered row always has data) | N/A at row level — PDF-generation error lives on the individual `ActionButton` (see below) | Completion time unavailable → "—" in place of the computed value; rest of row unaffected |

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response | State Transition | Error Handling |
|-------|---------------|-------------|-----------------|-------------------|-----------------|
| AC-004 | When a row renders | (render) | Shows exam title, `X/10` score, submitted date, completion time | — | — |
| AC-005 | When the user activates "View details" | Click/Enter | Navigate to `/exams/[id]/attempt/[attemptId]/result` for that exact attempt | S-01 → S-02 | — |

---

### Component: ActionButton

New shared atom — the single Save/Share control used by both `HistoryRow` and `ResultActions` (AC-007: one visual/behavioral definition, not two). Always a real `<button type="button">` (never a `disabled` native attribute, never a `Link`, since it always performs an in-place action, never navigation).

Accessibility pattern (D4, generalizes `RateButton`'s fix): the button is **always focusable**. Busy and error states are communicated via `aria-disabled="true"` (busy only) + `aria-describedby` pointing at a same-DOM `sr-only` reason span, plus a `Tooltip` for pointer users — never via the native `disabled` attribute. Because `aria-disabled` does not itself block the DOM `click` event, the `onClick` handler guards re-invocation with a local `busy` check (`if (busy) return;`) so the busy state is also functionally, not just visually, non-double-triggerable (AC-010).

#### State x Display Matrix

| State | Default | Loading | Empty | Error | Partial |
|-------|---------|---------|-------|-------|---------|
| Display | Icon + `sr-only` label ("Save"/"Share"), `aria-disabled="false"`, enabled | Icon replaced by spinner, visible label unchanged or "Saving…"/"Sharing…", `aria-disabled="true"` + `aria-busy="true"`; `sr-only` reason span (`aria-describedby`) reads "Generating your PDF, please wait" | N/A (button always has a defined default) | `aria-disabled="false"` (re-enabled), `role="alert"` text below/beside the row reads "Couldn't generate the PDF. Try again." (AC-018); clicking Save/Share again **is** the retry — no separate Retry button | Share only, unsupported browser (D1/AC-012): falls back to Save's download behavior, then a `role="status" aria-live="polite"` confirmation reads "Downloaded — sharing isn't supported in this browser." |

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response | State Transition | Error Handling |
|-------|---------------|-------------|-------------------|-----------------|-----------------|
| AC-009 | When "Save" is activated | Click/Enter | PDF generated from already-loaded row/page data; browser download starts; filename per D2 | Default → Loading → Default | — |
| AC-010 | While generation is in progress | (repeat click attempt) | No-op — guarded in the handler; button remains `aria-disabled` | Loading (no transition) | — |
| AC-011 | When "Share" is activated on a browser supporting file sharing | Click/Enter | `navigator.share({ files: [pdfFile] })` opens the native share sheet | Default → Loading → Default | — |
| AC-012 | When "Share" is activated on a browser without file-sharing support | Click/Enter | Falls back to the same download as Save + confirmation message (D1) | Default → Loading → Partial → Default | Partial → Default is triggered only by that row's next Save or Share activation (no auto-dismiss timer) — the new click's Loading state clears the prior confirmation before the next result renders; see D1 |
| AC-018 | When PDF generation fails (either action) | (generation throws) | `role="alert"` message renders; button re-enabled | Loading → Error | User clicks Save/Share again to retry |

---

### Component: ResultActions (rewired)

Existing `SOURCE/features/exams/components/ResultActions.tsx`. Change: remove the `disabled` attribute, the `title="{label} — coming soon"` tooltip, and wire each of the two buttons to render an `ActionButton` (Save, Share) instead of a static disabled `<button>`. **Preserves the exact existing structural contract**: renders its two buttons as bare siblings with no wrapping element — the caller (`result/page.tsx`) continues to place them inside its own `grid-cols-3` alongside "Return", so all three cells remain equal height/width. No change to that caller.

#### State x Display Matrix

Identical to `ActionButton`'s matrix above, ×2 instances (Save, Share) sharing the same attempt's already-loaded `examTitle`/`result`/timestamps — no additional data fetch (AC-009).

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response | Error Handling |
|-------|---------------|-------------|-----------------|-----------------|
| AC-014 | When this feature ships | (page render) | Save/Share render enabled (no more "coming soon"), invoking the same behavior as the corresponding History row for this attempt | Same as `ActionButton` |

---

### Component: ScoreCard (extended)

Existing `SOURCE/features/exams/components/ScoreCard.tsx`. Change: the "Time" stat (`dl` third column, currently a hardcoded `—`) now receives a real `completionTimeLabel: string` prop, computed by the page from `submitted_at − started_at` (same display format as `HistoryRow`, above) and rendered in place of the placeholder. Requires `getResult()` (`SOURCE/features/exams/queries.ts`) to also select `started_at`/`submitted_at` on the `exam_attempts` read — a Design Doc-owned query change (PRD flags this gap explicitly), not a UI Spec concern.

#### State x Display Matrix

| State | Default | Partial |
|-------|---------|---------|
| Display | Time cell shows the computed label (e.g. "12m 34s") | Missing/invalid timestamp data: Time cell falls back to "—" (same placeholder the component already used, now reserved for the genuine edge case rather than always-on) |

---

### Component: AttemptPdfTemplate

New. The rasterized-to-PDF DOM subtree (via `html2canvas`), consumed identically by both S-01 `HistoryRow` actions and S-02 `ResultActions` (one visual definition, AC-007). **Never rendered on-screen for the user to see** — mounted off-viewport only long enough to be captured, then unmounted.

**Hard styling constraint (ADR-0009, applies only to this subtree)**: every style must resolve to a plain hex value or a literal `rgb()`/`rgba()` function — the root `globals.css` custom properties (`--background #ede1c8`, `--foreground #1b1512`, `--brand #a62c2b`, `--border #d8c9a8`, and literal `#B8863B` copper) are safe; it must **not** import `components/ui/button.tsx` (confirmed `color-mix(in_oklch, ...)` in its `secondary` variant, and effectively every variant once its `hover:bg-primary/80`-style opacity modifiers are considered) and must **not** use any Tailwind slash-opacity utility (e.g. `bg-brand/8`, `border-brand/40`) — these compile to `color-mix()` regardless of whether the base color is a token or an arbitrary hex, and `html2canvas` cannot parse the resulting `color-mix()`/`oklch()` output. Where a translucent fill is needed (e.g. a subtle copper-tinted rule), use a literal `rgba()` value instead (e.g. `rgba(184,134,59,0.08)`), mirroring the already-safe `--sidebar-border: rgb(237 225 200 / 0.12)` token.

**Visual layout** (content width follows `PROJECT_OVERVIEW.md §2`'s existing 720px long-text grid convention, applied here as the template's fixed content width):
- Header: site wordmark/logo (plain `<img>`, same-origin `/images/brand_logo.png`) + a `rule-divider`-style bar (`rgba` copper, 2px height, 40px width — not a Tailwind opacity utility).
- Title block: exam title, Source Serif 4, `#1b1512`, matching `ScoreCard`'s serif h1 treatment.
- Score block: score `X/10` large, Source Serif 4, `#a62c2b` (brand, plain hex — safe; large-size clears the PROJECT_OVERVIEW.md §2 24px contrast-floor rule for brand-on-light).
- Metadata row: submitted date, completion time (same format as `HistoryRow`), joined with " · ", `#6b655c` muted, sans (Be Vietnam Pro).
- Footer: 1px hairline (`#d8c9a8`) then a caption "Generated by MS-MOLAR · summary only, not a full transcript" + generation timestamp, `#6b655c`, `body-sm`.
- No shadows, no gradients (PROJECT_OVERVIEW.md §2 Elevation & Depth rule — this subtree has zero exception, unlike `ExamCard`'s documented hover-shadow one-off).

#### State x Display Matrix

| State | Default | Partial |
|-------|---------|---------|
| Display | Full content: logo, title, score, date, completion time, footer | Optional/unavailable field (e.g. completion time unresolvable): renders "—" in that field's place rather than omitting the row, keeping the template's fixed layout stable across attempts |

#### Interaction Definition

| AC ID | EARS Condition | User Action | System Response |
|-------|---------------|-------------|-----------------|
| AC-006 | When Save/Share triggers generation | (system, via `ActionButton`) | Template renders with only score/time/exam-metadata — no per-question content is ever included in its markup |
| AC-008 | When the PDF is produced | (system) | Visual style follows `PROJECT_OVERVIEW.md §2` tokens (see above), not an unbranded default |

## Design Tokens and Component Map

### Environment Constraints

- Target browsers: Chrome / Firefox / Safari / Edge, latest 2 versions (site default). Share-file support varies by browser (weak/absent on desktop Firefox) — covered by the D1 fallback, not a target-browser exclusion.
- Theme: single light theme ("Ink & Lacquer"); `SiteHeader`/nav strip uses the existing dark `--nav-*` surface, unchanged.
- UI chrome language: English (no i18n framework in this codebase; all new copy in this spec is English).

#### Responsive Behavior

| Breakpoint | Width | Key Changes |
|-----------|-------|-------------|
| Mobile | < 640px | `HistoryRow` stacks (title/score/date/time block above the action cluster), matching `ExamRow`'s `sm:flex-row` breakpoint; `ActionButton`s remain icon-only, `View details` full-width text link |
| Tablet/Desktop | ≥ 640px | `HistoryRow` single line (`sm:flex-row sm:items-center sm:justify-between`); action cluster right-aligned |

### Existing Component Reuse Map

| UI Element | Decision | Existing Component | Notes |
|-----------|----------|--------------------|-------|
| Nav item ("History") | Extend | `SiteHeader.tsx`, `HomeSidebar.tsx` | `href` fix only (D5); no `isActive` logic change |
| `(history)` route-group layout | New (pattern-copied) | `(exams)/layout.tsx`, `(analytics)/layout.tsx` | Renders `SiteHeader` only, nullable user (D6) |
| Auth guard on `/history` | New (pattern-reused) | `(authoring)/upload/page.tsx` | `getCurrentUser()` + `redirect("/?auth=signin")`, page-level not layout-level |
| History row shell | New, pattern-informed | `SOURCE/features/authoring/components/ExamRow.tsx` | Same `<li>` shell classes, `" · "`-joined metadata line, `formatDateTime` convention; domain differs (attempts vs. UGC exams) so a new component, not a literal import |
| History list container + empty state | New, pattern-informed | `SOURCE/features/authoring/components/MyExamsList.tsx` | Adopts its empty-state-with-CTA shape (AC-002) and its `ExamListScroll` bounded-height container (D3); **not** `ExamBrowser.tsx`'s empty state (that one has no CTA, insufficient for AC-002) |
| Status/score display precedent | Reuse (pattern) | `SOURCE/features/exams/components/ScoreCard.tsx` | Large serif score number treatment informs the AttemptPdfTemplate score block |
| Save/Share disabled-but-meaningful pattern | Reuse (pattern) | `SOURCE/features/exams/components/rating/RateButton.tsx` | `aria-disabled` + `aria-describedby` + `Tooltip`, **not** `ResultActions`'s current native-`disabled` + `title` pattern (D4) |
| Busy-state live-region precedent | Reuse (pattern) | `SOURCE/features/authoring/components/ExtractionProgress.tsx` | Informs `ActionButton`'s `role="status" aria-live="polite"` busy/fallback announcements (compact per-button form, not a full banner, given row density) |
| Actionable-error panel precedent | Reuse (pattern), extended | `SOURCE/features/authoring/components/ExtractionErrorPanel.tsx` | Existing panel lacks a Retry control; `HistoryList`'s Error state and `ActionButton`'s Error state both add one (list: dedicated button via `error.tsx`'s `reset()`; per-action: re-click Save/Share) |
| Tooltip | Reuse | `SOURCE/components/ui/tooltip.tsx` | Used by `ActionButton`'s busy/error reason (via `RateButton`'s pattern) |
| shadcn Button | Reuse (on-screen only) | `SOURCE/components/ui/button.tsx` | Freely usable in `HistoryRow`/`ResultActions`/`HistoryList`'s on-screen controls; **forbidden** inside `AttemptPdfTemplate` (ADR-0009) |
| Loading skeleton | Reuse (pattern) | `SOURCE/app/(authoring)/me/exams/loading.tsx` | Same `animate-pulse` row-placeholder treatment for `(history)/history/loading.tsx` |
| Route-level error boundary | New (idiomatic Next.js) | — | No existing `error.tsx` precedent in this codebase; first use, following Next.js App Router convention |

### Design Tokens

No new token values are introduced. All values below are already defined in `PROJECT_OVERVIEW.md §2` and `SOURCE/app/globals.css`.

#### Color Roles

| Role | Token | Value | Usage |
|------|-------|-------|-------|
| Page background | `background` | `#ede1c8` | `/history` page background |
| Text | `foreground` | `#1b1512` | Headings, row text, PDF body text |
| Card/row surface | `border` + `bg-card` | `#d8c9a8` hairline / `#ede1c8` | `HistoryRow` shell |
| Primary action | `brand` | `#a62c2b` | Save/Share icon color (enabled), score number, PDF score |
| On primary | `brand-foreground` | `#ede1c8` | Text on brand-filled controls |
| Accent (rules/borders only) | copper | `#b8863b` | `rule-divider`, PDF header rule (as a literal `rgba()` fill, never a slash-opacity utility inside the PDF subtree) — never as text (RateButton's documented ~2.49:1 AA failure) |
| Muted text | `muted-foreground` | `#6b655c` | Row metadata, PDF footer/caption |
| Border | `border` | `#d8c9a8` | Hairlines, row/card borders |
| Nav surface | `--nav-bg` | `rgb(27 21 18 / 0.97)` | `SiteHeader` (unchanged) |

#### Typography, Spacing, Elevation, Radius

Unchanged from the site defaults: Serif (Source Serif 4) for the History page `h1` and the PDF title/score only; Sans (Be Vietnam Pro) everywhere else including all button/nav labels. Spacing scale `xs`4/`sm`8/`md`16/`lg`24/`xl`40. Elevation: flat everywhere in this feature — no exception (unlike `ExamCard`'s one-off hover shadow, not extended here). Radius: `sm`4px (buttons), `md`8px (rows/cards); no pill shapes.

## Visual Acceptance

### Golden States

1. **History — populated list**: ≥ 3 rows spanning different dates, newest first, no shadows, hairline row borders.
2. **History — empty state**: dashed border, serif message, "Browse exams" CTA visible.
3. **History — list error**: `error.tsx` bordered alert + "Retry" button.
4. **HistoryRow — Save busy**: spinner replaces icon, `aria-busy`, row's other controls stay interactive.
5. **HistoryRow — Share fallback**: post-download confirmation text visible (D1), not a dead click.
6. **HistoryRow — PDF-generation error**: `role="alert"` message + button re-enabled for retry.
7. **Result page — ResultActions enabled**: Save/Share no longer show "coming soon"; same 3-cell grid layout with Return preserved.
8. **AttemptPdfTemplate — rendered summary**: logo, serif title, brand score, muted metadata line, footer disclaimer — no per-question content, no shadows, all plain-hex colors.

### Layout Constraints

- `/history` content column: `max-w-2xl`, centered, `px-6 py-10` (matches `MyExamsList`).
- List scroll region: `max-h-[30rem] overflow-y-auto` (D3) — page itself does not scroll further than needed for the heading + this region.
- `AttemptPdfTemplate` content width: fixed at the site's existing 720px long-text convention (`PROJECT_OVERVIEW.md §2` Layout); exact pixel/DPI rasterization parameters are a Design Doc decision (see Open Items).
- Result page's existing 3-column `grid-cols-3` (Save/Share/Return) is unchanged in shape.

## Accessibility Requirements

Compliance target: WCAG 2.1 AA (site default, per PRD NFR Accessibility). Audit gate: 0 serious/critical axe issues + manual keyboard pass, both surfaces (History, Result page).

### Keyboard Navigation

| Component | Tab Order | Key Binding | Behavior |
|-----------|-----------|-------------|----------|
| SiteHeader / HomeSidebar | Existing; History now a real destination | Enter | Navigate to `/history` |
| HistoryRow | Save → Share → View details, per row, rows in list order | Enter/Space | Activate |
| ActionButton | Always in tab order, busy or not (never native `disabled`) | Enter/Space | Triggers action if not busy; no-op (silently, per D4 handler guard) if busy |
| HistoryList error retry | After heading | Enter/Space | Calls `reset()` |
| ResultActions | Save → Share (unchanged position in the existing 3-col grid, before Return) | Enter/Space | Same as `ActionButton` |

### Screen Reader

| Component | Role | Accessible Name | Live Region |
|-----------|------|-----------------|-------------|
| HistoryList error (`error.tsx`) | `alert` | "Couldn't load your history right now." | assertive; receives focus on render |
| HistoryList empty state | text | "No results yet" + CTA link text | none |
| ActionButton (busy) | `button` + `aria-busy="true"` + `aria-describedby` | visible label ("Save"/"Share") | `sr-only` reason span: polite |
| ActionButton (error) | `button` + `aria-describedby` → adjacent `alert` | visible label unchanged | assertive (the `role="alert"` message) |
| ActionButton (Share fallback confirmation) | `status` | "Downloaded — sharing isn't supported in this browser." | polite |
| AttemptPdfTemplate | — | N/A — never mounted visibly/announced; the **output PDF** has no selectable/screen-reader-accessible text (rasterized image, ADR-0009 accepted trade-off) — a known, documented limitation of the generated artifact itself, not a gap in this feature's on-screen UI |

### Contrast Requirements

| Element | Foreground | Background | Ratio Target |
|---------|-----------|------------|---------------|
| Row title/body text | `#1b1512` | `#ede1c8` | ~12.9:1 (AA/AAA both clear) |
| ActionButton enabled icon/label color | `#a62c2b` (brand) | `#ede1c8` | ~5.4:1 — clears 4.5:1 normal-text floor (do **not** use copper `#b8863b` for this, per RateButton's documented ~2.49:1 failure) |
| Row metadata (date/time) | `#6b655c` (muted) | `#ede1c8` | ~4.5:1 |
| PDF score (large, ≥ 24px) | `#a62c2b` | `#ede1c8` | Large-text floor (3:1) clears easily; also satisfies PROJECT_OVERVIEW.md §2's "no brand-red below 24px" rule since the score renders large |
| Copper rule/border | `#b8863b` | `#ede1c8` | Non-text UI ≥ 3:1 — decorative rule only, never text |

## Open Items

| ID | Description | Owner | Deadline |
|----|-------------|-------|----------|
| TBD-01 | Exact `html2canvas` rasterization scale/DPI and resulting `AttemptPdfTemplate` pixel dimensions (this spec fixes only the CSS content width, 720px, per PROJECT_OVERVIEW.md §2's existing convention) | Design Doc | Before Design Doc sign-off |
| TBD-02 | `getResult()` query change to select `started_at`/`submitted_at` (flagged by the PRD; needed for `ScoreCard`'s real Time stat on the Result page) | Design Doc | Before Design Doc sign-off |
| TBD-03 | Confirm the D3 "50 rows" pagination-revisit trigger against real usage once available; adjust if the mid-range-Android manual QA pass surfaces jank earlier | Work Plan (post-MVP) | At R10 pickup, non-blocking for this feature's MVP ship |

## Update History

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2026-07-27 | 1.0 | Initial version from PRD v1.2 / ADR-0009. No prototype; fresh design on the existing "Ink & Lacquer" system. Resolved all 3 PRD Undetermined Items (D1–D3). | ui-spec agent (Claude) |
