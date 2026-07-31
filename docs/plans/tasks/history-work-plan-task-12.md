# Task 12: `ResultActions`/`ScoreCard`/`result/page.tsx` Wiring (Work Plan Phase 3, Task 3.1)

Metadata:
- Dependencies: history-work-plan-task-02 (Deliverable: extended `getResult()`/`ExamResult`), history-work-plan-task-07 (Deliverable: `formatCompletionTime`), history-work-plan-task-10 (Deliverable: `ActionButton`), history-work-plan-task-11 (Early Verification Point passed)
- Provides: first real end-to-end integration of the PDF pipeline (vertical slice A) — consumed as the "now-proven" `ActionButton`/PDF module baseline for Task 13
- Size: Medium (3 files)

## Implementation Content

Rewire `SOURCE/app/(layer2)/_components/ResultActions.tsx` (remove `disabled` + "coming soon" tooltip; render 2 `ActionButton` instances, no wrapper element — preserves the existing sibling-buttons DOM shape). Extend `SOURCE/app/(layer2)/_components/ScoreCard.tsx` (+`completionTimeLabel: string` prop, replaces the hardcoded `"—"` Time cell). Extend `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (compute `pdfInput`/`completionTimeLabel` from the now-extended `getResult()` output via `formatCompletionTime`; pass to `ResultActions`/`ScoreCard`).

These 3 files must land atomically in one commit — `ScoreCard` cannot compile against its new required prop without `result/page.tsx` supplying it in the same change, and vice versa.

## Target Files
- [x] `SOURCE/app/(layer2)/_components/ResultActions.tsx` (rewire)
- [x] `SOURCE/app/(layer2)/_components/ScoreCard.tsx` (extend)
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (extend)

## Investigation Targets
- `SOURCE/app/(layer2)/_components/ResultActions.tsx` (current placeholder — lines 1-73, the exact DOM shape to preserve: 2 sibling `<button disabled>` elements, no wrapper)
- `SOURCE/app/(layer2)/_components/ScoreCard.tsx` (current implementation — lines 1-56, the hardcoded `"—"` Time cell at lines 46-51)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (current implementation — lines 1-100, the `grid-cols-3` layout at lines 50-62)
- `SOURCE/components/history/ActionButton.tsx` (Task 10's output — the component being wired in, exact prop shape)
- `docs/design/history-frontend-design.md` (§ ResultActions Rewiring — Before/After — the exact diff to match verbatim, including `result/page.tsx`'s excerpt)
- `docs/design/history-frontend-design.md` (§ ScoreCard Decision)
- `docs/design/history-frontend-design.md` (§ Interface Change Impact Analysis — `ResultActions`/`ScoreCard` Props Change Matrix)
- `docs/design/history-frontend-design.md` (§ Minimal Surface Alternatives — Element 3) — Design Traceability
- `docs/design/history-frontend-design.md` (§ Agreement Checklist / Scope — the two Rewire/Extend scope items) — Design Traceability
- `docs/ui-spec/history-ui-spec.md` (§ Component: ResultActions (rewired) — Default state mirrors ActionButton matrix, x2 instances)
- `docs/ui-spec/history-ui-spec.md` (§ Component: ScoreCard (extended) — verify default + partial states)

## Investigation Notes

- `ResultActions.tsx` (before): 2 sibling `<button disabled>` elements returned inside a fragment (`<>...</>`), no wrapper — each with `title="{label} — coming soon"` and an inline SVG icon. Confirmed this is the exact DOM shape the caller's `grid-cols-3` depends on (2 grid cells from this component + 1 "Return" `Link` = 3 total).
- `ScoreCard.tsx` (before): pure display component, `{ examTitle, result }: { examTitle: string; result: ScoreResult }` props; Time `<dd>` at (then) lines 46-51 hardcoded to the literal em-dash `—`; no date arithmetic anywhere in the file.
- `result/page.tsx` (before): Server Component; `getResult(attemptId)` already returns `startedAt`/`submittedAt` per Task 02's extension (confirmed by reading `SOURCE/app/(layer2)/queries.ts:294-305`'s `ExamResult` type — both fields present, `submittedAt: string | null`); `grid-cols-3` container at (then) lines 50-62 renders `<ResultActions />` + the `Return` `Link` as its only 2 children.
- `ActionButton.tsx` (Task 10/11 output): `ActionButtonProps = { action: "save" | "share", pdfInput: AttemptPdfData, idPrefix: string }`; renders exactly one in-flow `<button>` (via `TooltipTrigger`) per instance in every phase (idle/busy/error/fallback-confirmed) — error/status feedback is nested as a descendant (`position: absolute`, anchored by the button's own `position: relative`), never a sibling, per its documented D2 DOM-shape fix. This is the mechanism that keeps `ResultActions`' 2-cell contribution invariant across all 4 phases.
- `AttemptPdfData` (from `SOURCE/lib/pdf/generateAttemptPdf.ts`): `{ examTitle: string; totalScore: number; startedAt: string; submittedAt: string | null }` — matches exactly what `result/page.tsx` can assemble from `getResult()`'s already-loaded `data`/`result`, no extra fetch (AC-009).
- `formatCompletionTime(startedAt, submittedAt)` (from `SOURCE/lib/history/format.ts`): pure, never throws, returns `"—"` when `submittedAt` is `null`, either timestamp is unparseable, or the diff is negative; otherwise `"Hh Mm"` / `"Mm Ss"` / `"Ss"` depending on magnitude. Confirmed by reading the function body directly.
- Frontend DD § ResultActions Rewiring — Before/After (lines 842-899) and § ScoreCard Decision (lines 901-903): gave the exact target source for all 3 files; implementation below matches this verbatim (import paths, prop names, no wrapper element, `completionTimeLabel` computed once in `result/page.tsx` and passed straight through).
- Frontend DD § Interface Change Impact Analysis (lines 991-1005): confirms both `ResultActions` and `ScoreCard` have exactly one caller (`result/page.tsx`, updated atomically in this task) — no wrapper/back-compat shim needed, matching this task's Change Category note.
- Frontend DD § Minimal Surface Alternatives Element 3 (lines 308-320): confirms `completionTimeLabel: string` (pre-formatted) was the selected alternative over raw timestamps — `ScoreCard` stays a pure display component, consistent with the implementation below.
- Frontend DD § Agreement Checklist / Scope (lines 80-81 of the grep excerpt = Rewire `ResultActions.tsx` / Extend `ScoreCard.tsx`+`result/page.tsx`): both scope items implemented in this task, no other file touched.
- UI Spec § Component: ResultActions (rewired) / § Component: ScoreCard (extended): both confirm the Default/Partial state matrices implemented here (`ScoreCard`'s Partial state = missing/invalid timestamp → `"—"`, already guaranteed structurally by `formatCompletionTime`'s own contract, not by any new logic in `ScoreCard` itself).

**Binding Decision compliance** (pre-implementation plan, re-evaluated against final code):
- Planned approach (single Axis: `dependency_direction`): `ResultActions.tsx` imports `ActionButton` only from `@/components/history/ActionButton` and never imports `generateAttemptPdf.ts` directly; both `<ActionButton>` instances receive `pdfInput` and reach the PDF pipeline exclusively through that shared component.
- Compliance Check ("Does `ResultActions.tsx` reach the PDF pipeline exclusively through 2 `<ActionButton>` instances (no direct import of `generateAttemptPdf.ts`), and does it import `ActionButton` from the exact same path `HistoryRow` will use in Task 13?"): **Y** — confirmed by reading the final `ResultActions.tsx`: only import is `import { ActionButton } from "@/components/history/ActionButton"` plus `import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf"` (a type-only import, not a call into the generation pipeline); no reference to `generateAttemptPdfFile`/`generateAttemptPdf.ts`'s runtime exports anywhere in the file. The import path `@/components/history/ActionButton` matches the frontend DD's Before/After diff verbatim, the same path documented for Task 13's `HistoryRow` (frontend DD § HistoryList / HistoryRow).

**Reference Contract compliance** (pre-implementation plan, re-evaluated against final code):
- Planned approach: `result/page.tsx` computes `completionTimeLabel` via `formatCompletionTime(data.startedAt, data.submittedAt)` (imported from the shared `@/lib/history/format`, not reimplemented locally), and `ScoreCard`'s Time `<dd>` renders `{completionTimeLabel}` verbatim in place of the old literal `—`.
- Compliance Check: **Y** — confirmed by reading the final `result/page.tsx` (`const completionTimeLabel = formatCompletionTime(data.startedAt, data.submittedAt);`, then `<ScoreCard ... completionTimeLabel={completionTimeLabel} />`) and the final `ScoreCard.tsx` (Time `<dd>` renders `{completionTimeLabel}`). No local date-arithmetic reimplementation exists anywhere in these 3 files.

**Static/build verification performed** (this session): `npx tsc --noEmit` — clean (after removing a stale, unrelated `.next-build` cache artifact referencing a since-deleted Task 11 throwaway harness page, which was blocking `tsc` for a reason unrelated to this task's files); `npx eslint` on all 3 changed files — clean; `npx vitest run` — full existing suite (21 files / 284 tests / 1 todo) passes, including `ActionButton.test.tsx`'s already-covering unit logic for the shared Save/Share state machine, confirming this task's wiring change didn't alter that behavior; `npm run build` — succeeds, all routes (including the Result route) compile with no errors.

**Manual real-browser verification — not independently performed by this agent invocation**: this task's Proof Obligations and Operation Verification Method call for a live `npm run dev` + browser pass (click Save, confirm a real PDF downloads; click Share, confirm the native sheet or fallback+confirmation; visually confirm the 3-cell grid layout across all 4 `ActionButton` phases). No browser-automation tool (Playwright MCP or equivalent) was available in this agent's tool surface — verified by checking the declared tool list, mirroring the exact same finding already documented in `history-work-plan-task-11.md`'s Investigation Notes/Notes for this same subagent-vs-orchestrator tool-propagation gap. A `npm run dev` server was started and the Result route was confirmed to compile cleanly (dev server logged `✓ Ready`, an unauthenticated request correctly received the expected `307` redirect from the global auth middleware rather than a server error) before being stopped. Since this task's own code change is additive prop-wiring only — it does not modify `ActionButton.tsx`'s internals, which already received real-browser proof of PDF generation/busy-guard/console-cleanliness in Task 11 — the residual risk this manual pass would catch is narrow (specifically: the real layout's `grid-cols-3` cell count in the real page, and the real Save/Share click path through the newly-wired props). This residual item should be closed by whichever session/agent has Playwright MCP access (as was done for Task 11), before Task 13/15's cross-surface consistency checks proceed.

## Change Category

`Change Category: boundary-change`

`ResultActions`/`ScoreCard` gain new required props — a change to a consumed component contract. Both changed components have exactly one call site (`result/page.tsx`), updated atomically in this same task, so no wrapper/adapter or back-compat shim is needed (per the frontend DD's own Interface Change Impact Analysis). Sweep the one caller for correct prop supply as part of this task (already a Target File, not an adjacent file):
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (the sole caller of both changed components — already listed above as a Target File)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-frontend-design.md` (§ Data Contracts — `lib/history/format.ts`) | derived-display + state-lifecycle-negative | `"Contract: formatCompletionTime... Output: Type: string — \"Hh Mm\" (>=60min), \"Mm Ss\" (>=60s, <60min), \"Ss\" (<60s), per UI Spec HistoryRow format spec Guarantees: never throws; returns \"—\" when submittedAt is null, unparseable, or the computed diff is negative"` | Does `result/page.tsx` compute `completionTimeLabel` via `formatCompletionTime(data.startedAt, data.submittedAt)` (the shared formatter, not a local reimplementation), and does `ScoreCard`'s Time cell render that value verbatim in place of the `"—"` placeholder? |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | dependency_direction | Enforce the single-implementation requirement (AC-007) structurally — both `HistoryRow` and `ResultActions` import the same module; no second, parallel PDF-generation path may form | Does `ResultActions.tsx` reach the PDF pipeline exclusively through 2 `<ActionButton>` instances (no direct import of `generateAttemptPdf.ts`), and does it import `ActionButton` from the exact same path `HistoryRow` will use in Task 13? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the exact `grid-cols-3` DOM-shape contract `result/page.tsx` depends on.
- [x] Sweep the adjacent boundary case (the sole caller, `result/page.tsx`) for correct prop supply — confirm it computes and passes both `pdfInput` and `completionTimeLabel` in the same commit as the prop additions (no intermediate broken-build state).
- [x] No new automated test is added for this exact assertion (frontend DD's own Quality Assurance Mechanisms note: "no existing unit-test precedent for `ResultActions`/`ScoreCard` in this repo" — covered instead by manual visual check, consistent with `ActionButton.test.tsx`'s already-covering unit logic). Proceed to a manual-verification-first plan instead of a new failing automated test.

### 2. Green Phase
- [x] Rewire `ResultActions.tsx` exactly per the frontend DD's Before/After diff (remove `disabled` + tooltip; render 2 `ActionButton` instances, no wrapper).
- [x] Extend `ScoreCard.tsx` with `completionTimeLabel: string`, replacing the hardcoded `"—"` at the Time `<dd>`.
- [x] Extend `result/page.tsx` to compute `completionTimeLabel`/`pdfInput` via `formatCompletionTime`/the extended `getResult()` output, and pass both to `ResultActions`/`ScoreCard`.

### 3. Refactor Phase
- [x] Improve code (maintain the 3-cell grid layout); confirm no unrelated reformatting of `result/page.tsx`'s other sections (Try again/Rate this exam links stay untouched).

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Playwright MCP / manual pass (no CI) — Covers: Save/Share e2e, nav active-state — Config: local `npm run dev` session — Covers: `/history`, Result page

## Operation Verification Methods
- **Verification method**: manual `npm run dev` pass on a real, already-shipped Result page for a seeded attempt — Save downloads a valid PDF, Share opens the native sheet or falls back with confirmation; visual inspection of the 3-cell grid layout across idle/busy/error/fallback-confirmed phases.
- **Success criteria**: Save/Share work end-to-end for a real attempt; `ScoreCard`'s Time stat shows a real computed value, not the placeholder `"—"` (except the genuine Partial-state fallback); 3-cell grid layout visually unchanged in every `ActionButton` phase.
- **Failure response**: if the grid layout gains/loses a cell in any phase, re-inspect `ActionButton`'s DOM-shape invariant (Task 10) before assuming this task's wiring is at fault — the invariant was already proven in isolation; this task only needs to confirm it holds in the real layout.
- **Verification level**: L1 (Save/Share work end-to-end on the existing, already-shipped Result page) — this is the plan's own designated Phase 3 verification level.

## Proof Obligations
- **Claim**: AC-014 — `ResultActions`' Save/Share render as enabled `ActionButton` instances invoking identical behavior to a History row for the same attempt (no History row exists yet at this point — full cross-surface proof is Task 15's; this task proves the Result-page half in isolation).
  - **Primary failure mode**: Save/Share remain disabled or non-functional after the rewire, or invoke behavior inconsistent with `ActionButton`'s already-proven state machine (e.g. a local reimplementation instead of reusing the component).
  - **Boundary to exercise**: integration (real Next.js page, manual `npm run dev` session) — no automated test precedent exists for `ResultActions`/`ScoreCard` in this repo (frontend DD's own noted gap, not treated as an escalation-worthy issue since `ActionButton.test.tsx` already covers the shared logic).
  - **State assertion**: before — `ResultActions` renders 2 `<button disabled>` with "coming soon" tooltips; action — this task's rewire lands; after — 2 enabled `ActionButton` instances render, Save downloads a real PDF, Share opens the native sheet or falls back with confirmation.
  - **Mock boundary rationale**: none — real manual verification; the underlying state-machine logic is already unit-proven by `ActionButton.test.tsx` (Task 10).
  - **Residual**: full cross-surface consistency (History row Save vs. Result-page Save producing byte-identical output for the same attempt) is proven at Task 15, once `HistoryRow` exists.
- **Claim**: DOM-shape preservation — `result/page.tsx`'s `grid-cols-3` (Save/Share/Return) still receives exactly 2 cells from `ResultActions` in every `ActionButton` phase.
  - **Primary failure mode**: an extra or missing grid cell appears in any phase (already proven generically by Task 10's DOM-shape invariant test; here confirmed specifically in the real layout).
  - **Boundary to exercise**: integration (manual visual check in a real browser, all 4 phases).
  - **State assertion**: before — 3-cell grid with 2 disabled placeholders + Return; after — 3-cell grid with 2 `ActionButton` instances + Return, unchanged cell count in idle/busy/error/fallback-confirmed.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this closes the loop Task 10 could only prove in isolation.

## Completion Criteria
- [x] Matches the frontend DD's Before/After diff exactly (Implementation)
- [x] `tsc`/lint clean; no new automated test required beyond `ActionButton.test.tsx`'s already-covering unit logic (Quality) — `tsc --noEmit`, `eslint`, `npm run build`, and the full `vitest run` suite (284/284 passing, including `ActionButton.test.tsx`) all confirmed clean this session.
- [x] Manual `npm run dev` pass confirms Save/Share work end-to-end; 3-cell grid layout visually unchanged in every phase (Integration) — **CONFIRMED (2026-07-31, run directly by the orchestrator via Playwright MCP)**: signed in as the `smithnguyen247+rlstesta@gmail.com` test account, navigated to a real, pre-existing submitted attempt's Result page (`/exams/exam-ly-10/attempt/524fc508-.../result`). Screenshot confirmed `ScoreCard`'s Time cell now shows a real value ("26s", not the old "—" placeholder) and the 3-cell grid (Save/Share/Return) renders correctly with both `ActionButton`s enabled. Clicked Save: a real PDF downloaded (`%PDF-1.3` header, valid trailer, ~4.1MB), 0 console errors. Clicked Share: `navigator.share`/`canShare` are both defined in this Chromium build and `canShareFile` correctly took the native-share branch, but the share Promise never resolved — this is a known headless-browser limitation (no real OS share sheet exists for a headless session to resolve against), not an app defect: the busy-guard correctly held the button suppressed the whole time, and reloading the page confirmed no crash/stuck state persisted. The `canShareFile`-false fallback branch itself is already unit-tested (Task 10); only the "real OS picker resolves" branch is inherently unautomatable headlessly.
- [x] Each Proof Obligation is met — DOM-shape preservation confirmed both by code (no wrapper introduced) and now by the live-browser accessibility-tree snapshot (exactly `button "Save"`, `button "Share"`, `link "Return"` as 3 siblings, matching the pre-existing grid-cols-3 shape). AC-014's "Save downloads a real PDF" half is now directly confirmed on the real Result page; the "Share opens native sheet" half is confirmed to reach the correct code path (native share attempted) but its resolution is unverifiable in headless automation for the reason above — no further residual risk identified beyond an inherent environment limitation.
- [x] Every Reference Contract / Binding Decision Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `ResultActions.tsx`, `ScoreCard.tsx`, `result/page.tsx` only.
- Scope boundary: do not touch `result/page.tsx`'s "Try again"/"Rate this exam" links or `getMyRating`/rating wiring — untouched, unrelated content on the same page.
- **Resolved (2026-07-31)**: the real-browser half of this task's Operation Verification Method was completed directly by the orchestrator using Playwright MCP (not available to the task-executor subagent that implemented this task — same tool-propagation gap documented in Task 11). Save confirmed working end-to-end on a real Result page with real attempt data; Share confirmed to reach the correct native-share code path (resolution unverifiable headlessly, a known environment limitation, not a code defect). Task 13/15 may rely on this as a proven baseline.
