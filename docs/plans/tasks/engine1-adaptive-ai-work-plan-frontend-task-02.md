# Task 02 (Frontend): Slice B — `SkillRecommendationCard` + `DashboardPage` mount (Work Plan Phase 4, Task 15)

Metadata:
- Dependencies: backend-task-08 (`getSkillRecommendation()`, `SkillRecommendation` type), frontend-task-01 (goes second per the work plan's own risk-ordering — de-risked by Slice A)
- Provides: `SkillRecommendationCard`, mounted on the dashboard; last code task before Phase 5's manual verification
- Size: Medium (4 files: `SkillRecommendationCard.tsx`, `dashboard/page.tsx` extension, `en.ts`/`vi.ts` extension)

## Implementation Content

Add the `analytics.recommend*` i18n keys (extending the existing `analytics.*` block **in place**, both `en.ts`/`vi.ts`).

Implement `SkillRecommendationCard.tsx` (Server Component, **no** `"use client"` — populated state renders `recommendation.skillLabel` verbatim (never re-derived/re-bucketed) + a closed-by-default native `<details>`/`<summary>` disclosure mapped via `REASON_KEY`; cold-start state renders the honest `analytics.recommendColdStart` message, never blank).

Add the parallel `getSkillRecommendation()` fetch to `DashboardPage`'s existing `Promise.all` and mount the card between `PageHeader` and `AnalyticsDashboard` (zero change to `AnalyticsDashboard` itself).

**Unprecedented test technique, with an explicit documented fallback**: convert `SkillRecommendationCard.test.tsx`'s 3 already-generated tests into real vitest(jsdom) tests using `render(await SkillRecommendationCard({ recommendation }))` — this has NO prior precedent in this repo's test suite. **If it proves incompatible** with this repo's RTL/vitest/jsdom versions (e.g. `getTranslate()`'s internal `next/headers` call cannot be satisfied in jsdom), fall back explicitly to manual/Playwright-only verification for this component, matching the `ExamCard`/`ExamBrowser` untested-Server-Component precedent — **document the fallback decision in Investigation Notes, do not silently skip the test.**
- Test 1 (AC-031, verbatim label + closed-by-default disclosure)
- Test 2 (all 3 `reasonCode` values map to distinct, correct copy)
- Test 3 (AC-028, cold-start renders without throwing, honest copy, populated-only elements absent)

## Target Files
- [x] `SOURCE/lib/i18n/dictionaries/en.ts` (additive — extend existing `analytics.*` block with `recommend*` keys)
- [x] `SOURCE/lib/i18n/dictionaries/vi.ts` (additive — same)
- [x] `SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx` (new)
- [x] `SOURCE/app/(layer3)/me/dashboard/page.tsx` (additive — parallel fetch + mount)
- [x] `SOURCE/app/(layer3)/_components/SkillRecommendationCard.test.tsx` (fill in the existing skeleton's 3 tests, or record the fallback decision)

## Investigation Targets
- `SOURCE/app/(layer3)/_components/SkillRecommendationCard.test.tsx` (already generated — read in full: the IMPLEMENTER NOTE on the unprecedented async-Server-Component render technique and its explicit fallback instruction, the Mock Boundary Decisions note on `getTranslate()`, all 3 tests' exact annotations)
- `docs/design/engine1-adaptive-ai-frontend-design.md` (§ Main Components — `SkillRecommendationCard.tsx`; § Assumed Behaviors; § Alternative Solutions, last row — the reasoning against forcing testability by reopening the server-component decision; § Design — `REASON_KEY`, verbatim source for the Reference Contract below)
- `docs/ui-spec/engine1-adaptive-ai-ui-spec.md` (S-02/D3/D6 — cold-start contract; § Component: DashboardPage state x display matrix; § Component: SkillRecommendationCard state x display matrix)
- `SOURCE/app/(layer3)/_components/AnalyticsDashboard.tsx`, `BarChartCard.tsx`, `DonutChartCard.tsx` (existing `app/(layer3)/_components/` siblings — an existing `DifficultyBadge.test.tsx`-style render-assertion precedent if present, and confirmation that `AnalyticsDashboard`'s own props/children are untouched by this task)
- `SOURCE/app/(layer3)/me/dashboard/page.tsx` (existing `Promise.all` at line ~242, `PageHeader`/`AnalyticsDashboard` mount order at lines ~28/35 — the exact insertion point)
- `SOURCE/app/(layer3)/queries.ts` (backend-task-08 — `getSkillRecommendation()`'s exact return shape, `{skillLabel, reasonCode} | null`)

## Change Category

`Change Category: boundary-change`

This task extends `DashboardPage`'s existing render tree (an already-shipped page) with a new parallel fetch and mount, and extends the existing `analytics.*` i18n block in place. Sweep required: confirm `AnalyticsDashboard` itself receives zero prop/behavior changes, and that the new parallel `getSkillRecommendation()` fetch does not alter the existing `Promise.all`'s other members' error-handling semantics (e.g. one new failing promise must not cause the whole `Promise.all` to reject and break the rest of the dashboard, unless that is already the existing convention for all its members — confirm and record the finding).

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-frontend-design.md (§ Design — `SkillRecommendationCard.tsx`, `REASON_KEY`) | derived-display | `{"prerequisite-gate": "analytics.recommendReasonPrerequisiteGate", "lowest-mastery": "analytics.recommendReasonLowestMastery", "recently-wrong": "analytics.recommendReasonRecentlyWrong"}` | Does the component's `REASON_KEY` lookup map exactly these 3 `reasonCode` values to exactly these 3 i18n keys, no missing/duplicate mapping (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular the skeleton's fallback instruction and all 3 tests' annotations.
- [x] Sweep the `AnalyticsDashboard`-untouched and `Promise.all`-error-handling adjacent cases per Change Category above; record findings in Investigation Notes.
- [x] Add `// @vitest-environment jsdom` as the real test file's first line.
- [x] Attempt the `render(await SkillRecommendationCard({ recommendation }))` technique on a minimal throwaway case first, to determine early whether the fallback is needed — record the outcome in Investigation Notes before writing the full 3-test suite.
- [x] If the technique works: convert the 3 skeleton tests into real vitest(jsdom) tests. If it does not: document the fallback decision explicitly and plan for manual/Playwright-only verification (Phase 5 Task 18) instead — do not silently skip.
- [x] Run the tests (if written) and confirm they fail (no implementation exists yet).

### 2. Green Phase
- [x] Extend `en.ts`/`vi.ts`'s existing `analytics.*` block in place with `recommend*` keys (including `recommendColdStart` and the 3 `REASON_KEY`-mapped reason strings).
- [x] Implement `SkillRecommendationCard.tsx`: Server Component, no `"use client"`; populated state renders `skillLabel` verbatim + closed-by-default `<details>`/`<summary>` via `REASON_KEY`; cold-start state (`recommendation === null`) renders `analytics.recommendColdStart`, never throws, never blank.
- [x] Add the parallel `getSkillRecommendation()` fetch to `DashboardPage`'s `Promise.all`; mount `SkillRecommendationCard` between `PageHeader` and `AnalyticsDashboard`; confirm `AnalyticsDashboard`'s own props/children are unchanged.
- [x] Run `npx vitest run components/tutor app/\(layer3\)/_components` (project-wide staged gate for this phase) — confirm this task's tests pass (if the technique was viable).

### 3. Refactor Phase
- [x] Confirm the Reference Contract's Compliance Check evaluates to `Y`; record evidence.
- [x] Confirm `AnalyticsDashboard`'s render is byte-identical to before this change for a fixture dashboard load.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `app/(layer3)/_components/`
- Manual axe-equivalent pass — Covered: `SkillRecommendationCard`'s 2 states (exercised fully in Phase 5 Task 20)

## Operation Verification Methods
- **Verification method**: run `npx vitest run app/\(layer3\)/_components/SkillRecommendationCard.test.tsx` if the async-Server-Component render technique proved viable; otherwise, the manual/Playwright pass in Phase 5 Task 18 is this component's sole verification, per the documented fallback.
- **Success criteria**: all 3 tests pass (or, if the fallback was taken, the fallback decision is explicitly recorded and Phase 5 Task 18 is confirmed as the component's verification path); both slices compile against the real backend contracts landed in Phases 2-3 (no stub types remaining) — Phase 4 Completion Criteria.
- **Failure response**: if the render technique throws an unrecoverable error (e.g. `next/headers` API unsatisfiable in jsdom) after a reasonable investigation attempt, take the documented fallback rather than reopening the UI Spec's server-component decision to force testability — this is the frontend DD's own named Risk countermeasure, not a task failure.
- **Verification level**: L2 (new tests added and passing) if the technique works; L1-deferred-to-Phase-5 (manual Playwright pass) if the fallback is taken — either is an acceptable, pre-approved outcome for this specific task.

## Proof Obligations
(Sourced verbatim from `SkillRecommendationCard.test.tsx`'s own annotations — applicable in full if the render technique is viable; if the fallback is taken, these obligations transfer to Phase 5 Task 18's manual pass and must still be checked there.)
- **Claim**: Test 1 — populated state renders `skillLabel` verbatim (never re-derived/re-bucketed) and a closed-by-default `<details>` disclosure (AC-031).
- **Primary failure mode**: the component re-derives or re-buckets the label instead of rendering it verbatim, silently diverging from the backend's computed value; or the `<details>` element defaults to OPEN, immediately exposing the reason text meant to be a deliberate, user-initiated disclosure.
- **Boundary to exercise**: integration (render), real `getTranslate()`/`BentoCell`.
- **State assertion**: N/A.
- **Mock boundary rationale**: `getSkillRecommendation` N/A (component receives `recommendation` as an already-resolved prop, no import to mock); `BentoCell`/`getTranslate()` real.
- **Residual**: none.
- **Claim**: Test 2 — all 3 `reasonCode` values map to their own distinct, correct localized reason text.
- **Primary failure mode**: the `REASON_KEY` lookup table is missing a member or maps two different `reasonCode` values to the same i18n key, showing the wrong or an uninformative explanation.
- **Boundary to exercise**: integration (render), real `getTranslate()`.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: none.
- **Claim**: Test 3 — cold start (`recommendation: null`) renders an honest message, never throws, never blank (AC-028).
- **Primary failure mode**: `recommendation === null` causes an unhandled property access and the component throws, breaking `DashboardPage`'s render for every brand-new/cold-start user — the single highest-frequency real-world case.
- **Boundary to exercise**: integration (render).
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: none.

## Completion Criteria
- [x] `analytics.recommend*` i18n keys added in place; `SkillRecommendationCard.tsx` implemented; mounted on `DashboardPage` between `PageHeader`/`AnalyticsDashboard`
- [x] All 3 tests pass, OR the fallback decision is explicitly documented in Investigation Notes and Phase 5 Task 18 is confirmed as this component's verification path
- [x] Reference Contract's Compliance Check evaluates to `Y`, evidence recorded
- [x] `AnalyticsDashboard` confirmed byte-identical/unchanged
- [x] Each Proof Obligation is met (directly, or transferred to Phase 5 Task 18 if the fallback was taken)

## Investigation Notes

**Render technique outcome — the fallback was NOT needed.** A throwaway probe
(`SkillRecommendationCard.probe.test.tsx`, created, run, then deleted) rendered a
minimal async component that awaits the real `getTranslate()` via
`render(await Probe())` under React 19.2.4 / RTL 16.3.2 / vitest 4.1.10 / jsdom
29.1.1 — passed on the first attempt (1 test, 1.61s). The only two things
`getTranslate()` needs from the Next server runtime are stubbed in the real test
file, both with existing repo precedent and both explicitly sanctioned by the
skeleton's Mock Boundary note:
- `vi.mock("server-only", () => ({}))` — precedent `app/(layer3)/__tests__/getSkillRecommendation.int.test.ts:27`
- `vi.mock("next/headers", ...)` returning a `cookies()` whose `get()` yields
  `undefined` — precedent `app/(admin)/admin/tickets/__tests__/actions.int.test.ts:86`

`getTranslate()` itself stays REAL (not stubbed to an identity function), so the
3 tests assert against the real dictionary; the absent cookie resolves to
`DEFAULT_LOCALE` = `en`, which is why the expected copy is English. All 3 tests
pass. Phase 5 Task 18's manual/Playwright pass therefore remains an addition, not
this component's sole verification path.

**Reference Contract (`REASON_KEY`) — Compliance Check = `Y`.**
`SkillRecommendationCard.tsx:19-23` declares
`Record<ReasonCode, MessageKey>` with exactly
`"prerequisite-gate" → "analytics.recommendReasonPrerequisiteGate"`,
`"lowest-mastery" → "analytics.recommendReasonLowestMastery"`,
`"recently-wrong" → "analytics.recommendReasonRecentlyWrong"` — byte-identical to
the frontend DD § Design block. Evidence beyond inspection: (a) `ReasonCode` is
derived as `Exclude<SkillRecommendation, null>["reasonCode"]`, so `Record<...>`
makes a *missing* member a compile error (`tsc --noEmit` clean); (b) a mutation
run mapping `"recently-wrong"` to the `lowest-mastery` key made Test 2 fail
(`expected 'This is the skill you're weakest at …' to be 'You got this one wrong
recently.'`), proving the *duplicate*-mapping half of the check is actually
exercised and not an always-passing assertion. Mutation reverted; suite green.

**Adjacent-case sweep 1 — `AnalyticsDashboard` untouched: confirmed.**
`git status`/`git diff --stat` show no entry for `AnalyticsDashboard.tsx`,
`BarChartCard.tsx`, or `DonutChartCard.tsx`. Its mount site is unchanged
(`<AnalyticsDashboard dataByRange={dataByRange} />`, same single prop, same
`<div className="mt-6">` wrapper); the new card is a *sibling* `<div>` inserted
before it, not a wrapper around it, so its own render tree is byte-identical.

**Adjacent-case sweep 2 — `Promise.all` error semantics (with a task-file
discrepancy).** The task file and the frontend DD both describe an *existing*
`Promise.all` in `DashboardPage` ("line ~242"); there is none. The real file was
39 lines with a single bare `const dataByRange = await getAnalyticsByRange();`.
`Promise.all` is therefore *introduced* by this task (which is what the DD's
Constraints section actually asks for: the recommendation read must not serialize
behind the analytics read). Finding on semantics: the change is neutral for the
pre-existing member and fail-fast for the new one, deliberately —
- Before: `getAnalyticsByRange()` rejecting propagated out of the async page
  component to page-level error handling.
- After: `Promise.all` still rejects on the first rejection, so
  `getAnalyticsByRange()` behaves exactly as before, and a rejecting
  `getSkillRecommendation()` now also breaks the whole dashboard render.
- That blast radius is the *specified* behavior, not an accident: UI Spec
  § Component: DashboardPage state × display matrix ("a fetch failure here
  follows the same (unchanged) top-level error handling as the existing
  `getAnalyticsByRange()` call; no new per-component error UI is introduced") and
  its AC-031 mount row ("Falls back to the page's existing top-level error
  handling if the fetch throws (unchanged)"). Note `getSkillRecommendation()`
  does throw on a Supabase read error (`queries.ts:112-114`), while its
  cold-start path returns `null` rather than throwing — so the highest-frequency
  "no data" case never reaches this error path at all.
- No `.catch(() => null)` swallow was added: inventing per-component error
  recovery here would change the existing page's error strategy, which this task
  is not authorized to do. Recorded for review rather than silently altered.

**Auth-guard ordering preserved**: the `getCurrentUser()` guard + `redirect()`
still run strictly before both data reads (the page's own header comment makes
this a hard rule), so the new fetch never fires for an unauthenticated visitor.

## Notes
- Impact scope: `SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx` (new), `SOURCE/app/(layer3)/me/dashboard/page.tsx` (additive fetch + mount only), `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` (additive, in-place `analytics.*` extension).
- Scope boundary: do not modify `AnalyticsDashboard.tsx`/`BarChartCard.tsx`/`DonutChartCard.tsx`; do not implement `ExplainStepAffordance`/`useTutorAction` here (frontend-task-01, already complete).
