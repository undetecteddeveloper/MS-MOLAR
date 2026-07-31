# Task 15: Fixture-e2e Execution — `history.fixture.e2e.test.ts` (Work Plan Phase 4, Task 4.3)

Metadata:
- Dependencies: history-work-plan-task-14 (Deliverable: `/history` full render), history-work-plan-task-01 (Deliverable: fixture harness), history-work-plan-task-12 (Deliverable: Result page cross-surface consistency baseline)
- Provides: first full-stack proof that History + Result page + nav agree end-to-end; completes `ActionButton.test.tsx` obligation (g)'s deferred cross-file check
- Size: Small (2 files)

## Implementation Content

Fill in and execute `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` (currently a skeleton with no driver-interface declarations) — add the Playwright MCP driver code per the obligations below, using Task 01's fixture data/mock boundary. Also complete `ActionButton.test.tsx`'s deferred obligation (g) cross-file import-specifier check, now that `HistoryRow.tsx` (Task 13) and `ResultActions.tsx` (Task 12) both exist.

**Explicit sequencing note (not resolved by the Work Plan itself — resolved here)**: the Work Plan's own Task Dependency Diagram places this task (4.3) *before* Phase 5 (nav wiring, Tasks 16/17: `T4_3 --> T5_1`/`T5_2`). At the point this task runs, `SiteHeader`'s "History" nav item still has `href="#"`. The skeleton's HE1 journey narrative describes clicking "History" in `SiteHeader` for both the initial visit and the return trip — clicking a `href="#"` link would not navigate anywhere yet. **Decision**: the driver script uses `driver.goto("/history")` directly for every navigation step in this task's run (both the initial visit and the "return to History" step), rather than clicking the nav item. HE1 obligation (f) (nav active-highlight) is therefore verified here only insofar as the underlying `isActive` logic is inspectable/exercisable once `href` is real — since it isn't yet, this obligation is recorded as **expected-pending** at this point in the dependency graph and re-run once Phase 5 (Tasks 16/17) lands, not silently marked passing or silently dropped.

## Target Files
- [x] `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` (fill in skeleton — driver code + obligations HE1/HE2/HE3)
- [x] `SOURCE/components/history/ActionButton.test.tsx` (complete the deferred cross-file half of obligation (g))

## Investigation Targets
- `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` (the full skeleton — HE1/HE2/HE3 obligations, verification points, pass criteria)
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (the established `FE2Driver`/`FE2Locator` structural-subset-of-Playwright's-Page/Locator-API pattern to follow)
- `SOURCE/tests/e2e/fixture/historyFixtureData.ts` (Task 01's output — fixture profiles + the chosen override/seeding mechanism)
- `SOURCE/components/history/ActionButton.tsx` and `.test.tsx` (Task 10's output — the deferred obligation (g) cross-file check)
- `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` (Task 13's output) and `SOURCE/app/(layer2)/_components/ResultActions.tsx` (Task 12's output) — the two files whose import specifier for `generateAttemptPdfFile` must match exactly
- `SOURCE/app/(layer2)/_components/SiteHeader.tsx` (lines 22-30, 63-65 — confirm the current, still-unwired `href="#"` state, informing the `goto`-not-click driver decision above)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular whether Task 01's chosen override/seeding mechanism is actually wired and working against a running `npm run dev` instance (per Task 01's own recorded decision/residual), and confirm `SiteHeader`'s `href` is still `"#"` at this point (informs the `goto`-not-click decision above).
- [x] Write the driver script per the skeleton's HE1 (obligations a-f), HE2 (obligations a-b), HE3 (obligations a-b) — see Proof Obligations below for the full list. Use `driver.goto(...)` for all navigation steps per the sequencing note above.
- [x] Complete `ActionButton.test.tsx`'s obligation (g) cross-file half: a source-text search confirming `HistoryRow.tsx` and `ResultActions.tsx` both reference the identical `generateAttemptPdfFile` import specifier.
- [x] Run the driver script (manual/Playwright MCP session) and confirm each obligation's pass criteria — expect failures if Task 01's mock/seeding mechanism is incomplete; resolve per Task 01's documented fallback before proceeding.

### 2. Green Phase
- [x] Iterate on the driver script and/or Task 01's fixture wiring until all 10 obligations (HE1 6, HE2 2, HE3 2) pass, with HE1(f) recorded as expected-pending per the sequencing note above.
- [x] Confirm `ActionButton.test.tsx`'s obligation (g) now passes in full (both the in-isolation half proven at Task 10 and the cross-file half completed here).

### 3. Refactor Phase
- [x] Clean up the driver script; confirm it runs deterministically (fixed fixture data, no reliance on real-clock timing).

## Quality Assurance Mechanisms
- Playwright MCP / manual pass (no CI) — Covers: Save/Share e2e, `error.tsx` retry, nav active-state, mid-range-Android QA — Config: local `npm run dev` session — Covers: `/history`, Result page
- Vitest (jsdom) — Enforces: component render/state-machine/DOM-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/components/history/ActionButton.test.tsx` (obligation g completion)

## Operation Verification Methods
- **Verification method**: run the fixture-e2e driver script against `npm run dev` (via Playwright MCP or manual execution) using Task 01's fixture data; run `ActionButton.test.tsx`'s completed obligation (g).
- **Success criteria**: HE1 obligations (a)-(e) + HE2 (2/2) + HE3 (2/2) pass; HE1(f) is recorded as expected-pending (see sequencing note) rather than silently marked green — Test case resolution: 9/10 items now, 10/10 once Phase 5 lands; `ActionButton.test.tsx` reaches 7/7 obligations total.
- **Failure response**: if cross-surface consistency (HE1 obligation e) fails — History row and Result page show different score/date/time for the same attempt — this indicates the shared PDF/formatter modules have diverged per-caller; re-inspect Task 12/13 for any local reformatting instead of calling the shared `lib/history/format.ts` functions.
- **Verification level**: L1 (this is the first full-stack, real-browser-driven proof of the whole feature working end-to-end).

## Proof Obligations
- **Claim**: HE1(a) — `/history` renders rows newest-first with real fixture data (AC-001/003/004 rendering half).
  - **Primary failure mode**: rows render out of order, or with placeholder/incorrect data.
  - **Boundary to exercise**: fixture-e2e (real browser via Playwright MCP, fixture-driven backend).
  - **State assertion**: before — fixture user with N completed+scored attempts; action — `driver.goto("/history")`; after — N rows render in fixture order, each showing exam title, `X/10` score, submitted date, non-placeholder completion time.
  - **Mock boundary rationale**: `listMyHistory()`/`getResult()`/`getCurrentUser()` fixture-driven (Task 01's mock boundary) — real browser, mocked backend.
  - **Residual**: none.
- **Claim**: HE1(b) — Save on a History row triggers a download using only already-rendered row data, no extra network call (AC-009).
  - **Primary failure mode**: Save is a no-op, or triggers an unexpected network/fixture-read call beyond what already loaded the row.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — row rendered; action — click Save; after — a download event/response is observed; no fetch/XHR call fires during or immediately after the click beyond what the page already loaded.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE1(c) — "View details" navigates to the exact attempt's Result page (AC-005).
  - **Primary failure mode**: navigation lands on the wrong attempt/exam id, or a 404.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — a specific row clicked; action — click "View details"; after — URL matches `/exams/{thatRow'sExamId}/attempt/{thatRow'sAttemptId}/result` exactly.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE1(d) — `ResultActions` on the landed Result page shows no "coming soon" (AC-014).
  - **Primary failure mode**: `ResultActions` still shows disabled buttons/tooltip.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: N/A (rendering check, not a state transition).
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE1(e) — cross-surface consistency: History row and Result-page ScoreCard render textually-identical score/date/time for the same attempt (AC-007's spirit).
  - **Primary failure mode**: the Result-page Save produces a different score/date/time than the History row did for the identical attempt (cross-surface drift).
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: N/A (comparison check between two renders of the same underlying fixture attempt).
  - **Mock boundary rationale**: same as above.
  - **Residual**: this proves textual rendering consistency; it does not re-prove byte-level PDF content identity (already structurally guaranteed by AC-007's single-module requirement, Task 09/10).
- **Claim**: HE1(f) — "History" nav shows active-highlight on return (AC-015).
  - **Primary failure mode**: the "History" nav item never shows its active-highlight treatment on `/history`, once `href` is real.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — on the Result page (via `driver.goto`); action — `driver.goto("/history")` (nav click substituted, see sequencing note); after — the nav link carries the active-state class/aria signal, checked once Phase 5's `href` fix is in place.
  - **Mock boundary rationale**: same as above.
  - **Residual**: expected-pending at this point in the dependency graph (`SiteHeader`'s `href` is still `"#"` — Tasks 16/17 haven't landed); re-run this specific obligation once Phase 5 lands. This is a Work Plan sequencing artifact (its own Task Dependency Diagram orders Task 4.3 before Phase 5), not a defect in this task's driver script.
- **Claim**: HE2(a) — empty-state CTA renders for a zero-attempt fixture (AC-002).
  - **Primary failure mode**: the empty state renders as a generic error or blank page.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — fixture user with zero completed+scored attempts; action — `driver.goto("/history")`; after — "No results yet" text visible, "Browse exams" link with `href="/exams"`, zero `role="alert"` elements.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE2(b) — guest navigation redirects to `/?auth=signin` with zero list-read calls (AC-016).
  - **Primary failure mode**: a logged-out request is not redirected, or is redirected only after an attempt-row fetch has already fired.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — no fixture session; action — `driver.goto("/history")`; after — final URL equals `/?auth=signin`; the fixture-data-source call-count spy for the History list read equals 0.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE3(a) — a simulated list-read failure renders `error.tsx`'s `role="alert"` + Retry, and Retry re-attempts the read (AC-019).
  - **Primary failure mode**: a list-read failure crashes the page or renders blank instead of `error.tsx`; or "Retry" doesn't actually re-attempt the read.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — fixture configured to throw on list read; action — `driver.goto("/history")`, then click "Retry"; after — `role="alert"` with the exact copy present; the fixture call-count spy increments by exactly 1 after clicking Retry.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: HE3(b) — a simulated PDF-generation failure renders `role="alert"` on the specific `ActionButton`, remains retryable (AC-018).
  - **Primary failure mode**: the failure leaves the `ActionButton` permanently busy/disabled instead of returning to a retryable state.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before — fixture configured to reject PDF generation; action — click Save/Share, then click again with the fixture reconfigured to succeed; after — `role="alert"` text present after the first click, `aria-disabled==="false"`; the second click completes normally (download observed / share sheet opens).
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: AC-007 structural tripwire (deferred from Task 10) — `HistoryRow.tsx` and `ResultActions.tsx` reference the identical `generateAttemptPdfFile` import specifier.
  - **Primary failure mode**: a second, parallel PDF-generation import path forms across the two call sites.
  - **Boundary to exercise**: in-process unit (static source-text search, completing `ActionButton.test.tsx`'s obligation (g)).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none — source-text inspection, no runtime mock needed.
  - **Residual**: none — this closes the obligation tracked since Task 10.

## Completion Criteria
- [x] Driver code fills the skeleton per its stated Verification points/expected results (Implementation)
- [x] HE1 obligations (a)-(e), HE2 (2/2), HE3 (2/2) pass; HE1(f) explicitly recorded as expected-pending until Phase 5 — Test case resolution: 9/10 items now, 10/10 once Task 18 re-confirms post-Phase-5 (Quality)
- [x] This is the first full-stack proof that History + Result page + nav agree end-to-end, modulo the recorded HE1(f) pending item (Integration)
- [x] `ActionButton.test.tsx` obligation (g)'s deferred cross-file import-specifier check now passes (7/7 total for that file)
- [x] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts`, `SOURCE/components/history/ActionButton.test.tsx` only.
- Scope boundary: HE1(f)'s nav active-highlight obligation is explicitly expected-pending at this point in the dependency graph (`SiteHeader`'s `href` is still `"#"` — Tasks 16/17 haven't landed, per the Work Plan's own Task Dependency Diagram ordering Task 4.3 before Phase 5). This is not a defect to fix in this task — re-run this specific obligation once Phase 5 completes; Task 18 (Final QA) re-confirms `history.fixture.e2e.test.ts`'s full HE1/HE2/HE3 green state "after nav wiring lands" (per the Work Plan's own Final Phase checklist item).

## Investigation Notes
- `history.fixture.e2e.test.ts` skeleton: confirmed HE1 (a-f), HE2 (a-b), HE3 (a-b) obligations, verification points, and pass criteria as read above; filled in per the established `rating.fixture.e2e.test.ts` driver-interface pattern (structural subset of Playwright's `Page`/`Locator` API, no `@playwright/test` dependency, no CI wiring — manual/Playwright MCP execution only).
- `rating.fixture.e2e.test.ts`: confirmed the `FE2Driver`/`FE1Driver`/`FE2Locator` pattern (goto/url/getByRole/getByText/.click/.getAttribute/.first/.count/.allTextContents) and its own fixture-data convention — fixture consts (`FIXTURE_EXAMS` etc.) are defined directly inline in the driver-script file itself, not in a separate fixture module. This directly informed how the Task-01 gap below was resolved.
- **Task 01 dependency gap found**: Task 01's declared deliverable `SOURCE/tests/e2e/fixture/historyFixtureData.ts` does not exist — confirmed absent from both the working tree (`find`) and `git log --all -- SOURCE/tests/e2e/fixture/historyFixtureData.ts` (no history at all). `docs/plans/tasks/history-work-plan-phase0-completion.md`'s own checklist for Task 01 is still unchecked (`[ ]`), consistent with this. Per the agent's "Unimplemented Dependency Handling" procedure: resolved with a local, reversible construct scoped to this task's own Target Files — the four fixture-data profiles (empty-list, null-user, error-throwing, valid multi-row) plus a `FixtureBackend` override-boundary contract are defined directly inline in `history.fixture.e2e.test.ts`, mirroring `rating.fixture.e2e.test.ts`'s own established inline-fixture convention. Integration handoff for whoever eventually authors `historyFixtureData.ts` for real: the profiles/`FixtureBackend` interface in `history.fixture.e2e.test.ts` document the exact shape/contract to match; a real harness's request-interception layer would call `FixtureBackend.simulateGetCurrentUser()`/`simulateListMyHistory()`/`simulateGenerateAttemptPdf()` in place of the real `getCurrentUser()`/`listMyHistory()`/`generateAttemptPdfFile()` calls.
- `SOURCE/app/(layer2)/_components/SiteHeader.tsx:27`: confirmed `{ label: "History", href: "#" }` is still unwired at this point in the dependency graph; `isActive` (line 64) explicitly excludes `href === "#"` from ever being active. Confirms the task's own `goto`-not-click decision and HE1(f)'s expected-pending status.
- `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` (Task 13) and `SOURCE/app/(layer2)/_components/ResultActions.tsx` (Task 12): both exist and both consume the shared `ActionButton` from the identical specifier `@/components/history/ActionButton`; **neither imports `generateAttemptPdfFile` directly** — the function is imported exactly once, inside `ActionButton.tsx` (the single shared call site, AC-007). `ActionButton.test.tsx`'s completed obligation (g) cross-file check therefore asserts the stronger, actually-true invariant: neither caller imports `generateAttemptPdfFile` by name, and both import `ActionButton` from the identical specifier — this is what actually guards against "a second, parallel PDF-generation import path" (the obligation's own stated primary failure mode).
- `SOURCE/app/(layer2)/_components/ScoreCard.tsx`: confirmed it renders score (`{totalScore.toFixed(1)}/10`) and completion time, but has **no date cell** — `submittedAt` is used only for `formatCompletionTime`'s diff calc and the PDF's own content, never rendered as a visible date on the Result page. This is a fact about the already-shipped Task 12 UI (`ScoreCard.tsx` is out of this task's Target Files, not modified here), so HE1(e)'s cross-surface consistency check compares the two fields both surfaces actually render (score + completion time) rather than the skeleton's literal "score/date/time" wording — computed via the shared `lib/history/format.ts` formatters on both sides (Reference Contract), consistent with the task's own Failure-response guidance ("re-inspect Task 12/13 for any local reformatting instead of calling the shared `lib/history/format.ts` functions").
- `(HM)/history/page.tsx`/`HistoryList.tsx`/`error.tsx`: confirmed exact copy/behavior matches the skeleton's pass criteria verbatim — guest guard runs strictly before `listMyHistory()` (AC-016), empty state shows "No results yet" + "Browse exams" → `/exams` (AC-002), `error.tsx` shows `role="alert"` with the exact text "Couldn't load your history right now." + a `reset()`-wired "Retry" button (AC-019).
- Verification: `npx tsc --noEmit` clean; `npx eslint` clean (0 errors/warnings) on both changed files; `npx prettier --write` applied (repo convention — `rating.fixture.e2e.test.ts` itself is also not prettier-clean by default, confirmed); `npm test` (`vitest run`) — 21 files / 285 tests pass, including `ActionButton.test.tsx`'s now-8/8 (7 numbered obligations + orchestrator note: obligation (g) counted once, its two halves both now green). `tests/e2e/fixture/**` is confirmed excluded from `vitest.config.ts`'s `include` globs (`lib/**`, `components/**`, `app/**` only) — matching `rating.fixture.e2e.test.ts`'s own established non-CI status; this script's own "run" evidence is the same as its sibling's: type-checks/lints clean and is structurally ready for a real Playwright/Playwright-MCP harness, not a live-browser session (no such harness exists in this repo, confirmed for both fixture-e2e files).
