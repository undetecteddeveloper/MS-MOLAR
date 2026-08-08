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
- [ ] `SOURCE/lib/i18n/dictionaries/en.ts` (additive — extend existing `analytics.*` block with `recommend*` keys)
- [ ] `SOURCE/lib/i18n/dictionaries/vi.ts` (additive — same)
- [ ] `SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx` (new)
- [ ] `SOURCE/app/(layer3)/me/dashboard/page.tsx` (additive — parallel fetch + mount)
- [ ] `SOURCE/app/(layer3)/_components/SkillRecommendationCard.test.tsx` (fill in the existing skeleton's 3 tests, or record the fallback decision)

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
- [ ] Read all Investigation Targets, in particular the skeleton's fallback instruction and all 3 tests' annotations.
- [ ] Sweep the `AnalyticsDashboard`-untouched and `Promise.all`-error-handling adjacent cases per Change Category above; record findings in Investigation Notes.
- [ ] Add `// @vitest-environment jsdom` as the real test file's first line.
- [ ] Attempt the `render(await SkillRecommendationCard({ recommendation }))` technique on a minimal throwaway case first, to determine early whether the fallback is needed — record the outcome in Investigation Notes before writing the full 3-test suite.
- [ ] If the technique works: convert the 3 skeleton tests into real vitest(jsdom) tests. If it does not: document the fallback decision explicitly and plan for manual/Playwright-only verification (Phase 5 Task 18) instead — do not silently skip.
- [ ] Run the tests (if written) and confirm they fail (no implementation exists yet).

### 2. Green Phase
- [ ] Extend `en.ts`/`vi.ts`'s existing `analytics.*` block in place with `recommend*` keys (including `recommendColdStart` and the 3 `REASON_KEY`-mapped reason strings).
- [ ] Implement `SkillRecommendationCard.tsx`: Server Component, no `"use client"`; populated state renders `skillLabel` verbatim + closed-by-default `<details>`/`<summary>` via `REASON_KEY`; cold-start state (`recommendation === null`) renders `analytics.recommendColdStart`, never throws, never blank.
- [ ] Add the parallel `getSkillRecommendation()` fetch to `DashboardPage`'s `Promise.all`; mount `SkillRecommendationCard` between `PageHeader` and `AnalyticsDashboard`; confirm `AnalyticsDashboard`'s own props/children are unchanged.
- [ ] Run `npx vitest run components/tutor app/\(layer3\)/_components` (project-wide staged gate for this phase) — confirm this task's tests pass (if the technique was viable).

### 3. Refactor Phase
- [ ] Confirm the Reference Contract's Compliance Check evaluates to `Y`; record evidence.
- [ ] Confirm `AnalyticsDashboard`'s render is byte-identical to before this change for a fixture dashboard load.

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
- [ ] `analytics.recommend*` i18n keys added in place; `SkillRecommendationCard.tsx` implemented; mounted on `DashboardPage` between `PageHeader`/`AnalyticsDashboard`
- [ ] All 3 tests pass, OR the fallback decision is explicitly documented in Investigation Notes and Phase 5 Task 18 is confirmed as this component's verification path
- [ ] Reference Contract's Compliance Check evaluates to `Y`, evidence recorded
- [ ] `AnalyticsDashboard` confirmed byte-identical/unchanged
- [ ] Each Proof Obligation is met (directly, or transferred to Phase 5 Task 18 if the fallback was taken)

## Notes
- Impact scope: `SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx` (new), `SOURCE/app/(layer3)/me/dashboard/page.tsx` (additive fetch + mount only), `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` (additive, in-place `analytics.*` extension).
- Scope boundary: do not modify `AnalyticsDashboard.tsx`/`BarChartCard.tsx`/`DonutChartCard.tsx`; do not implement `ExplainStepAffordance`/`useTutorAction` here (frontend-task-01, already complete).
