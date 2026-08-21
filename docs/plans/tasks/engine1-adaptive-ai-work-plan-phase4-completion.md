# Phase 4 Completion: Frontend Integration

Covers Work Plan Phase 4 (Tasks 14-15 / `engine1-adaptive-ai-work-plan-frontend-task-01.md`, `engine1-adaptive-ai-work-plan-frontend-task-02.md`).

**Status: COMPLETE — 2/2 tasks, 2026-08-15.** Commits `ae7e3c5` (Task 14, Slice A) and `4622396` (Task 15, Slice B) on `feat/engine1-adaptive-ai-build`, an ancestor of the current branch. Filled in retroactively 2026-08-16 during the Engine 1 close-out: the work shipped and was evidenced in the Notion row and the work plan, but this file was left as its generated template.

## All-Task Completion Checklist

- [x] frontend-task-01 (T14 — Slice A, `ExplainStepAffordance`) complete: `ExplainStepAffordance.test.tsx` 5/5 green; `ResultDetailPage`'s not-scored branch confirmed unregressed (mount is gated on `r.hasBeenWrongTwice` inside the mcq and short_answer branches only).
- [x] frontend-task-02 (T15 — Slice B, `SkillRecommendationCard`) complete: `SkillRecommendationCard.test.tsx` 3/3 green. **The documented manual/Playwright fallback was not needed** — see "Async Server Component technique" below.

## Measurements

| Item | Result |
|---|---|
| New tests | **8** — 5 `ExplainStepAffordance`, 3 `SkillRecommendationCard` |
| Full suite after Phase 4 | **657 passed / 69 files** (before: 654 passed + 3 todo — the 3 todo *were* the Slice B skeleton, now real tests) |
| `npx tsc --noEmit` | clean |
| `npx eslint --max-warnings 0 .` | clean |
| `npm run build` | success, 17/17 pages |

## Async Server Component technique — new precedent in this repo

`SkillRecommendationCard` is a Server Component, and `render(await Component(props))` had **no prior precedent** in this repo's suite. It was tried on a minimal case *before* committing to it for the whole set, and it works on React 19 / RTL 16 / vitest 4 / jsdom. The task file's explicit fallback (manual/Playwright-only verification, matching the `ExamCard`/`ExamBrowser` untested-Server-Component precedent) was therefore **not taken**.

This is reusable: the same technique applies to the other untested Server Components in the repo (`ExamCard`, `ExamBrowser`, currently 0 coverage).

## Three findings worth more than the task list

1. **A green test proves nothing until it has been mutation-checked.** Slice A's Test 1 (the double-click guard) was first written with two `fireEvent.click` calls and **stayed green with the guard deliberately broken** — `fireEvent` wraps each call in its own `act()` and flushes state in between, so the exact race the test exists to catch can never occur. Only `act(() => { button.click(); button.click(); })` actually catches it. Every one of the 8 tests was then fault-injected per failure mode and confirmed to go red in the right place. **Anyone who "simplifies" Test 1 back to `fireEvent` guts it silently.**
2. **Keeping `getTranslate()` real** (stubbing only `server-only` and `next/headers`) is what makes the tests catch quiet dictionary edits. Proven by mutation: changing `analytics.recommendWhy` from `"Why this skill?"` to `"Why?"` turns Slice B Test 1 red immediately. Mocking `getTranslate()` would let bad copy through.
3. **The sprint's #1 risk did not fire.** `explainStep(attemptId, questionId)` takes its arguments in the reverse of `ExplainStepAffordanceProps`' declaration order `(questionId, attemptId)`; both are `string`, so a swap compiles clean and no type catches it. The real signature was read off `tutorActions.ts:156` and pinned with two non-interchangeable fixtures.

## Documentation discrepancy found during implementation

`frontend-task-02` **and** the frontend Design Doc both described `DashboardPage` as already having a `Promise.all` at "~line 242". It did not: the file was 39 lines with a single bare `await getAnalyticsByRange()`. **The `Promise.all` is something Task 15 itself created.** Verified against `git show HEAD` at the time.

Consequence, raised and then closed by the engineer on 2026-08-15: `Promise.all` rejects on the first error, so a throwing `getSkillRecommendation()` takes down the **whole** dashboard, not just the recommendation card — a risk that did not exist before this query was added to the page. **Decision: keep as-is, do not add `.catch(() => null)`.** Reasons recorded at the time: UI Spec AC-031 already specifies this behaviour ("per existing page-level error handling, unchanged"); it matches the convention `getAnalyticsByRange()` already follows on that page; and swallowing the error into cold-start would hide a real infrastructure fault (a failed Supabase read) behind a message that looks normal. The cold-start case returns `null` rather than throwing, so the throwing path is only reached on a genuine read failure. No code change was needed — `page.tsx` is already in this state and carries a comment explaining it.

## Phase Completion Criteria (verbatim from Work Plan)

- [x] Both slices compile against the real backend contracts landed in Phases 2-3 (no stub types remaining)
- [x] All 8 frontend component tests green
- [x] `ResultDetailPage`/`DashboardPage`'s pre-existing all-server-rendering behavior is unregressed for every question/user not satisfying the new gating conditions — confirmed live in Phase 5 Task 17-18, not only by inspection: a correctly-answered question (Q3) renders no affordance, and the cold-start dashboard renders the honest message with no `<details>` and no crash

## Amended later by Phase 5

Phase 5 Task 19 (keyboard pass) found and fixed a **real defect in this phase's scope**: UI Spec D5 requires removing the button once the hint appears — but that button is where a keyboard user is standing, so the browser dropped focus to `<body>` and the next Tab jumped back to the top of the page, meaning a keyboard user could never reach the hint they had just requested. Fixed with a `tabIndex={-1}` wrapper that captures focus (`-1`, not `0`: it accepts focus on command without adding a stop to the Tab order), and locked in by a new assertion in `ExplainStepAffordance.test.tsx`. This is why that file now carries more than its original 5 tests.

## Verification Commands

```
cd SOURCE && npx vitest run components/tutor "app/(layer3)/_components"
cd SOURCE && npx tsc --noEmit
cd SOURCE && npx eslint --max-warnings 0 .
cd SOURCE && npm run build
```

## Next Phase Gate

Phase 5 (manual verification — see `engine1-adaptive-ai-work-plan-phase5-completion.md`, no individual task files per the overview's Decomposition Scope Decision) depends on both slices being mounted on real routes with the backend's implementation deployed and test data seeded. It is the first point where the real, non-mocked `explainStep()` round trip is exercised (Verification Strategy's Second Verification Target). **Passed — Phase 5 is complete except Task 21 (Q-2, Gemini quota).**
