# Task F-C2 — `EssayGradingPoller` + deterministic RTL test

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-C (Interaction and fixture-e2e, frontend slices V4 + V5), Task F-C2**
Layer: **frontend** (`SOURCE/features/exams/components/**`, two route pages)

Metadata:
- Dependencies: **Task F-A3**.
- Blocks: **Tasks F-C3, F-C4**.
- Provides: the self-refreshing page — the second piece of genuinely new client behaviour.
- Size: Medium (2 new files + 2 mount points)
- Verification level: **L1**.

## ENTRY CONDITION: Gate A5b ticked

**A1 + A2 + A5** — a Groq account, the key in `SOURCE/.env.local`, and **Zero Data Retention ON** — are the precondition for **ANY** Groq request, **including dev**. **A5b is currently BLOCKED on A2.** No task may set `ESSAY_GRADING_ENABLED=true` anywhere until A5b ticks. The `L1` completion evidence below needs **a real band to land on dev**, which means a real Groq request — **seeded dev attempts only, never a real student attempt**.

## Implementation Content

Create `SOURCE/features/exams/components/EssayGradingPoller.tsx` as a `"use client"` component, mounted on **both** result pages.

This is **entirely new code** — a repo-wide grep found `(exams)` has **0** `router.refresh()` calls, **0** `visibilityState` uses, and the only `setInterval` in the codebase at `(auth)/_components/HomeCarousel.tsx:88`.

### Mechanism: chained `setTimeout`, borrowing `ExamTimer`'s documented reasoning — **not** `setInterval`
`setInterval` **coalesces ticks** when the tab is backgrounded, so returning to the tab fires a **burst** of `router.refresh()` calls, which is the most expensive possible behaviour for the target user (mid-range Android, unstable network).

`router.refresh()` is the **only** client mechanism that can reach a Server Component: a client `fetch()` needs a new route (AC-022 forbids it) and a local patch creates a second source of truth for the band.

### Two-phase cadence and two independent caps — **all six values declared as named constants** so the component never hand-types a literal (I016)
| Constant | Value |
|---|---|
| `ESSAY_POLL_FAST_INTERVAL_MS` | **5 000** |
| `ESSAY_POLL_FAST_TICKS` | **12** |
| `ESSAY_POLL_SLOW_INTERVAL_MS` | **10 000** |
| `ESSAY_POLL_MAX_REFRESHES` | **30** |
| `ESSAY_POLL_MAX_ELAPSED_MS` | **240 000** |

`ESSAY_POLL_FAST_TICKS = 12` covers the first 60 seconds — **not** because 60 s is the latency target, which is now **≤ 3 minutes** (OQ-7), but because at `GROQ_MAX_CONCURRENCY = 2` the **first** essays land early.

The last two were the only ones the UI Spec left as bare numbers; **naming them is what keeps the test file and the component from drifting**, since the tests assert against exactly those two bounds.

A tick while `document.visibilityState === "hidden"` is **skipped and costs no budget**, but **the 240-second clock keeps running**.

On stopping, show `result.essay.pollStopped` and a real `<button>` "Cập nhật" that performs one `router.refresh()` and **reloads both budgets**.

These four constants are **not** the read-time deadline and are **not derived from it** (AC-061); the deadline is anchored to the platform's duration ceiling, not to a latency estimate.

**`ESSAY_POLL_MAX_ELAPSED_MS` is anchored to a third thing again**: it equals `ESSAY_PASS_BUDGET_MS` (240 000), the grading pass's own wall-clock cap — **past that moment no band can still land from that pass, so every further refresh is certainly useless.** That is a checkable proposition about the writer, not an estimate about latency, and it is what makes the stop state an **exception rather than the default outcome**. One recorded offset: the poller's clock starts at **mount**, the pass's at **submit**, so the poller stops a few seconds later — **the safe direction**. The two **cadence** constants remain owned by **O-6 / OQ-1** until measured (Task E5).

### Mount condition is `essaySummary !== undefined` — **not** `pendingCount > 0`
`pendingCount > 0` is what the UI Spec first published and it **causes** the AC-023 defect: on the render that resolves the last essay, the component unmounts and the `aria-live` region leaves the DOM **in the same commit the sentence would have been inserted**, so the completion is never announced. The visual user notices nothing, so nobody reports it.

The conclusion for the **feature-off** state is unchanged, which is why the old predicate looked harmless: with no element carrying `essayState`, `summariseEssays()` returns `undefined`, so the poller still does not mount.

### The `aria-live="polite"` region is **empty from the first render** and receives text later
A region pre-filled with text may not be announced (AB-7, `ExamTimer.tsx:69-76`, with the counter-example recorded at `RecheckOrderControl.tsx:22-26`). **A refresh that resolves nothing leaves it empty** — announcing on every tick is the AC-023 defect from the other direction (a screen reader interrupting on every poll).

### Withdrawn claim, restated as three testable ones
The UI Spec's "0 bytes of JS when the feature is off" is **withdrawn** — the repo has no route-level bundle measurement (`check:bundle` only scans for AI keys), and it is probably false, because a statically imported `"use client"` module is in the route's bundle whether it mounts or not (AB-10). What is asserted instead: **(a)** the poller does not mount, **(b)** no timer is scheduled, **(c)** `router.refresh()` is called zero times.

### Test harness, pinned here so no case invents its own
- `// @vitest-environment jsdom`
- `beforeEach(() => vi.useFakeTimers())`
- `afterEach(() => { cleanup(); vi.useRealTimers(); })`
- a `tick(ms)` helper doing `act(() => vi.advanceTimersByTime(ms))`
- `setHidden(hidden)` overriding `document.visibilityState` via `Object.defineProperty`
- **Advance one tick at a time** — the timers are nested, so a single long advance leaves React no commit point to schedule the next timeout (`ExamTimer.test.tsx:17-19`).
- **No `waitFor` anywhere in this describe** — `waitFor` plus fake timers is the standing hang in this repo.

## Target Files
- [x] `SOURCE/features/exams/components/EssayGradingPoller.tsx` (new)
- [x] `SOURCE/features/exams/components/__tests__/EssayGradingPoller.test.tsx` (new) — 11 cases
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx` (mount point)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (mount point)

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayGradingPoller — verify default (polling) + stopped-at-cap + hidden-tab + resolved + not-mounted states)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Agreement Checklist Scope — `EssayGradingPoller`: chained `setTimeout`, two-phase cadence, two independent caps, visibility skip, `aria-live` polite region, manual refresh button)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Accessibility Requirements)
- `SOURCE/features/exams/components/ExamTimer.tsx` (`:69-76` — the empty-live-region idiom, AB-7)
- `SOURCE/features/exams/components/__tests__/ExamTimer.test.tsx` (`:17-19` — advance one tick at a time; nested timers need a commit point)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (`:22-26` — the counter-example: a region pre-filled with text)
- `SOURCE/features/auth/components/HomeCarousel.tsx` (`:88` — the codebase's only `setInterval`, and why this component does not copy it)
- `SOURCE/features/exams/queries.ts` (Task B2.1 — `essaySummary`, `pendingCount`; the mount predicate's input)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — `ESSAY_PASS_BUDGET_MS = 240_000`, the anchor for `ESSAY_POLL_MAX_ELAPSED_MS`)
- `SOURCE/lib/i18n/dictionaries/en.ts` / `vi.ts` (Task F-A1 — `result.essay.pollStopped`, `announceProgress`, `announceAllDone`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| UI Spec (§ Component: EssayGradingPoller) | derived-display | `ESSAY_POLL_FAST_INTERVAL_MS` **5 000**, `ESSAY_POLL_FAST_TICKS` **12**, `ESSAY_POLL_SLOW_INTERVAL_MS` **10 000**, hard caps **30 refreshes / 240 000 ms** (UI Spec v1.4; `ESSAY_POLL_MAX_ELAPSED_MS` == `ESSAY_PASS_BUDGET_MS`) — independent of the 10-minute read-time deadline (AC-061) | All five values are **named constants** in the component, the tests assert against those names, and `ESSAY_POLL_MAX_ELAPSED_MS` equals `ESSAY_PASS_BUDGET_MS` |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayGradingPoller — verify default + stopped-at-cap + hidden-tab + resolved + not-mounted states)

## Investigation Notes

### Three real failures before green, each a different rule
**1. The `aria-live` region was NOT empty on first render.** The first draft announced from a mount effect, so the region entered the DOM already carrying text — precisely what AB-7 says may never be announced. Caught by the dedicated case (`expected '0 essay questions scored. 2 still bei…' to be ''`).

**2. `eslint` found two React-rules violations**, both real:
- `Date.now()` inside `useRef(...)` runs **during render** — an impure call whose result drifts whenever the component happens to re-render (`react-hooks/purity`). The clock now starts in the first effect, which is also the anchor the file documents (mount).
- `setAnnouncement` synchronously inside an effect body causes cascading renders (`react-hooks/set-state-in-effect`).

Both were fixed by moving the announcement to React's **adjust-state-during-render** pattern — the one `HistoryRowMenu` already names in its own comment. That fixes the lint error and problem 1 at the same time: on the first render it only *records* the counts and announces nothing, so the region stays empty.

**3. A source-scan guard fired**: the six jsonb key literals may be typed only in `essayLifecycle.ts`, and my mount comment used one of them in prose. Same shape as F-B1's EG-BE-036 and F-B3's ADR-0009 scan. Rephrased the comment rather than widening the guard, and recorded why the name is avoided.

That is now the fifth and sixth time this repo's own tooling has caught something a reading would not.

### The mount condition is `essaySummary !== undefined`, and the alternative is a real defect
`pendingCount > 0` — what the UI Spec first published — **causes** the AC-023 defect: on the render that resolves the last essay, the component unmounts and its `aria-live` region leaves the DOM **in the same commit** the completion sentence would have been inserted, so it is never announced. A sighted user notices nothing, so nobody reports it. A dedicated case drives exactly that transition (`pending 1 → 0`) and asserts the sentence is present.

The feature-off conclusion is unchanged, which is why the old predicate looked harmless.

### `setTimeout` chained, never `setInterval`
`setInterval` **coalesces** ticks while the tab is backgrounded, so returning fires a **burst** of `router.refresh()` — the most expensive possible behaviour on a mid-range Android with an unstable network. Asserted: hidden for 5 ticks then visible for 2 gives exactly **2** refreshes, not 7.

### Two caps, and the second one's anchor is the interesting part
`ESSAY_POLL_MAX_ELAPSED_MS` is **not** derived from a latency target. It equals `ESSAY_PASS_BUDGET_MS`: past that moment no band can still land **from that pass**, so every further refresh is *certainly* useless. That is a checkable proposition about the writer, not an estimate about latency — and it is what keeps the stopped state an exception rather than the default outcome. One recorded offset: the poller's clock starts at mount, the pass's at submit, so the poller stops a few seconds later — the safe direction.

A hidden tab costs **no refresh budget but the wall clock keeps running**, asserted by a case that stays hidden past the cap and ends stopped with **zero** refreshes.

### The manual refresh button reloads BOTH budgets
Without that, the second press would stop immediately and the button would be useless after one use. Asserted by pressing it and then confirming polling resumes.

### All six values are named constants
The test file imports them rather than retyping numbers, so the component and its tests cannot drift. The two cadence constants remain owned by O-6 / OQ-1 until measured (Task E5).

### Still owed: the L1 check
A real band landing on dev while the page is open needs the engineer-owned grading run.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write the pinned harness, the six poller cases (P-1…P-6), the three `aria-live` cases and FE-AC-12; observe failure

### 2. Green Phase
- [ ] Implement the component: chained `setTimeout`, the five named constants, the visibility skip, the empty-from-first-render `aria-live="polite"` region, the stop state with the "Cập nhật" button
- [ ] Mount it on **both** result pages with the predicate `essaySummary !== undefined`
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm **zero** `waitFor` in the poller describe
- [ ] Confirm **no bare `18` or `120000` literal** in either the component or its test
- [ ] Confirm the mount predicate is `essaySummary !== undefined`, not `pendingCount > 0`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Enforces: **`react-hooks/refs` and `react-hooks/set-state-in-effect` govern the poller** — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers all client components
- Manual/Playwright MCP visual verification — Enforces: IV-4 — Config: `.mcp.json` (`playwright`), `npm run dev`, `npm run pw`; dev with seeded data

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | Was **1** first, with two real React-rules errors — see Investigation Notes |
| 3 | `npx vitest run` | **0** | 2022 passed / 10 skipped / 0 todo (was 2011 — **+11**). Was **1** first: a source-scan guard fired |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | Expected red, TD-030 baseline only. Snapshot CRLF churn reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

**Environment note**: partway through this task the Bash tool lost its view of `SOURCE/node_modules` (it reported the directory empty; `npx` then failed with `Cannot find package 'jsdom'`). PowerShell listed **704** packages in the same directory, so nothing was actually deleted — it was a stale view in one shell. The remaining gates were run from PowerShell. Recorded because the first symptom looks exactly like a wiped dependency tree, and reinstalling on that assumption would have been the wrong move.

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL with fake timers and the pinned harness; advance **one tick at a time**; count `router.refresh()` calls. Then **L1** on dev.
- **Success criteria**: all six poller cases and all three `aria-live` cases green; zero `waitFor` in the describe; no bare `18` or `120000` literal in either file; on dev, a page with one pending essay updates itself **within ≤ 10 seconds** of the band landing.
- **Failure response**: if a case hangs, `waitFor` is present with fake timers — remove it. If a single long advance produces fewer refreshes than expected, the timers are nested and React had no commit point — advance one tick at a time. If the completion announcement never appears, check the mount predicate: `pendingCount > 0` **causes** that defect.
- **Verification level**: **L1** — on a **seeded** dev attempt, a page with one pending essay updates itself within ≤ 10 seconds of the band landing.

## Proof Obligations — six poller cases
- **P-1**: `pendingCount = 1`, advance 5 000 ms ⇒ `refresh` called **exactly 1×**. **Primary failure mode**: the first tick scheduled at the slow interval. **Boundary**: RTL with fake timers and a counted `refresh` mock. **State assertion**: N/A. **Mock rationale**: `next/navigation` mocked so refreshes are counted. **Residual**: none.
- **P-2**: advance 12 × 5 000 then one more ⇒ the 13th happens after **10 000** ms, not 5 000 (phase change). **Primary failure mode**: the cadence never slowing, tripling the request cost of a long pass. **Boundary**: as above. **Residual**: none.
- **P-3**: advance until `refresh` has been called **30** times, then further ⇒ **no 31st**, and the "Cập nhật" button is found **by role**. **Primary failure mode**: an unbounded poller on a page a student leaves open. **Boundary**: as above. **Residual**: none.
- **P-4**: hidden, advance 10 × 5 000, visible, advance 5 000 ⇒ `refresh` called **exactly 1×** (hidden ticks spend **no budget**). **Primary failure mode**: a burst of refreshes on tab return — the most expensive possible behaviour for the target user. **Boundary**: as above with `setHidden`. **Residual**: none.
- **P-5**: hidden, advance 250 000 ⇒ **0** refreshes **and** the stopped block appears. **Primary failure mode**: **an inverted check order, where a permanently hidden tab loops forever because it never spends the count budget so the count cap is never reached** — this is the only case that catches it. **Boundary**: as above. **Residual**: none.
- **P-6**: `pendingCount = 0` from the start ⇒ **0** timers scheduled (advance 200 000 ⇒ 0 refreshes) and the `aria-live` region is **still present**. **Primary failure mode**: unmounting when nothing is pending, which removes the region that must carry the completion announcement. **Boundary**: as above. **Residual**: the transition version is FE2E-2 (Task F-C4).

## Proof Obligations — three `aria-live` cases
- `pendingCount` **decreases** ⇒ text. **Primary failure mode**: silence on progress.
- **unchanged** across a refresh ⇒ **empty**. **Primary failure mode**: announcing on every tick — the AC-023 defect from the other direction, a screen reader interrupting on every poll.
- reaches **0** ⇒ `announceAllDone` **and the component is still mounted** — the case that proves **F-05**. **Primary failure mode**: the mount predicate written as `pendingCount > 0`, so the region leaves the DOM in the same commit the sentence would have been inserted, and the completion is **never announced**; the visual user notices nothing, so nobody reports it.
- **Boundary** for all three: RTL with fake timers, real dictionary. **State assertion**: the region's `textContent` before → refresh → after. **Mock rationale**: `next/navigation` mocked. **Residual**: node-identity across the transition is FE2E-2(c)'s.

## Proof Obligations — other
- **FE-AC-12 (Failure Mode Checklist: unavailable boundary)**: a **throwing** `router.refresh()` is logged and **the next tick is still scheduled**; nothing surfaces to the student.
  - **Primary failure mode**: one failed refresh silently ending the poll, so the band never appears. **Boundary**: RTL with the mock made to throw. **State assertion**: a subsequent tick still fires. **Mock rationale**: as above. **Residual**: none.
- **The three restated claims (the "0 bytes of JS" withdrawal)**: with the feature off — (a) the poller does **not mount**, (b) **no timer** is scheduled, (c) `router.refresh()` is called **zero** times.
  - **Primary failure mode**: asserting a bundle-size promise the repo has no tooling to measure, and which is probably false because a statically imported `"use client"` module is in the route's bundle whether it mounts or not (AB-10). **Boundary**: RTL (`vi.getTimerCount()`, counted mock). **State assertion**: N/A. **Mock rationale**: as above. **Residual**: bundle size is **not** asserted anywhere, deliberately.

## Completion Criteria
- [ ] **Entry condition**: Gate A5b ticked before the dev `L1` run
- [ ] **Implementation Complete** = component + mounts + **nine cases** + the **five named polling constants**
- [ ] **Quality Complete** = six verify gates green, **zero `waitFor`** in the poller describe, **no bare `18` or `120000` literal** in either the component or its test
- [ ] **Integration Complete** = **L1** on a **seeded** dev attempt — a page with one pending essay updates itself within **≤ 10 seconds** of the band landing
- [ ] The mount predicate is `essaySummary !== undefined`
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-C3 (FE2E-1 asserts zero timers in the shipped state), F-C4 (FE2E-2 drives the transition).
- Scope boundary — preserve unchanged: `SOURCE/features/exams/components/ExamTimer.tsx` (its **reasoning** is borrowed, not its code); `HomeCarousel.tsx` (the codebase's only `setInterval` — **not** a model here); `ScoreCard.tsx`.
- The two **cadence** constants stay owned by **O-6 / OQ-1** until measured (Task E5); the two **caps** are already re-anchored to `ESSAY_PASS_BUDGET_MS` and move only if that moves.
