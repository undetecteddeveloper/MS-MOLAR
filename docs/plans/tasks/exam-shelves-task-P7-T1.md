# Task P7-T1 — Home block: guarded hot fetch (F-001)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 7 (Home Block Guarded Hot Fetch), Task P7-T1**
Layer: frontend (`SOURCE/app/page.tsx`)

Metadata:
- Dependencies: P3-T2 (`listHotExams`, already exists from Phase 3)
- Blocks: P8-T1, P8-T4 (Phase 8's verification runs against a fully-wired feature including this)
- Size: Small (1 file)
- Verification level: L1 — home block shows the hot order for signed-in visitors; 0 RPC calls for anonymous visitors

## Implementation Content
Edit `SOURCE/app/page.tsx:52-53,116-138` — `const hot = user ? await listHotExams(HOME_EXAM_COUNT) : null;` (guarded, not a bare swap); label `t("home.newExams")` → `t("home.hotExams")` (Phase 1's new key); empty guard widens to `hot !== null && hot.exams.length > 0`. Frame, `layout="stack"`, `HOME_EXAM_COUNT=3`, `Xem tất cả đề` link, `home-new-exams` id all unchanged.

## Target Files
- [ ] `SOURCE/app/page.tsx`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Integration Point I5 — Home guarded fetch (F-001), the guard rationale)
- `docs/design/exam-shelves-frontend-design.md` (§ Home block (AC-036–AC-038) — Data source / label / ribbon / empty-guard table)
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: HomeHotExamsSection — Default; Empty (site 0 attempts, or anon); Loading/Error N/A)
- `SOURCE/app/page.tsx` (`:52-53` current data-fetch call; `:116-138` current render block — read the full current implementation of this section before editing)
- `SOURCE/features/exams/queries/shelves.ts` (P3-T2 — `listHotExams`, called here)
- `SOURCE/lib/copy.ts` (P1-T2 — `home.hotExams`, the new label key)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability marks the frontend DD's "Home block table — Data source / label / ribbon / empty-guard rows" as `contract-change`. Sweep the adjacent case: this call site's data source is swapping from one query to another (`listNewExams`-shaped → `listHotExams`) — confirm no other part of `app/page.tsx` (or another page) still imports/relies on the old data source for the same visual section.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-038) | state-lifecycle-negative | "Given a site with 0 submitted attempts, when / renders for a signed-in visitor, then the block is absent (AC-024) and the page renders with 0 errors" | Does the home page's hot-exams section render nothing (not an empty frame) when `hot !== null` but `hot.exams.length === 0`, with 0 thrown errors? |
| docs/design/exam-shelves-backend-design.md (§ Integration Point I5); docs/design/exam-shelves-frontend-design.md (§ Home block) | state-lifecycle-negative | "An anonymous visitor therefore issues 0 RPC calls" — the guarded home fetch never executes `listHotExams` when `user === null` | Does the call site read `user ? await listHotExams(...) : null` (ternary guard), never an unconditional call followed by discarding the result? |

## UI Spec Component Reference
`docs/ui-spec/exam-shelves-ui-spec.md (§ Component: HomeHotExamsSection — verify Default; Empty (site 0 attempts, or anon); Loading/Error N/A states)`

## Investigation Notes
_(Record here: confirmation the guard is a ternary at the call site, not a try/catch or a post-hoc discard; the manual smoke-test result for both signed-in and signed-out renders, incl. a network-call count for the anonymous case.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write/extend a test (integration or fixture-lane, coordinated with existing home-page test coverage if any) confirming: anonymous (`user === null`) render issues 0 `.from`/`.rpc` calls of any kind; signed-in render with 0 submitted attempts site-wide renders the whole section absent (not an empty frame)
### 2. Green Phase
- [ ] Replace the data-fetch call with the guarded ternary `user ? await listHotExams(HOME_EXAM_COUNT) : null`
- [ ] Swap the label to `t("home.hotExams")`
- [ ] Widen the empty guard to `hot !== null && hot.exams.length > 0`
### 3. Refactor Phase
- [ ] Confirm `layout="stack"`, `HOME_EXAM_COUNT=3`, the `Xem tất cả đề` link, and the `home-new-exams` id are all unchanged
- [ ] Manual smoke test: `/` signed-in (with and without site-wide submitted attempts) and `/` signed-out

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `app/page.tsx`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: automated test (call-count assertion for the anonymous case) + manual smoke test on `/` signed-in and signed-out.
- **Success criteria**: anonymous visitor's render issues 0 `.from`/`.rpc` calls of any kind; signed-in visitor sees "Đề nổi nhất" + up to 3 hot exams when data exists, and the whole section absent when the site has 0 submitted attempts.
- **Failure response**: if an anonymous visitor's render issues any call, this is exactly the F-001 violation the guard exists to prevent — fix by moving the `listHotExams` call inside the ternary's truthy branch, not by adding a post-hoc early return after the call already fired.
- **Verification level**: L1.

## Proof Obligations
- **Claim** (F-001, "0 RPC calls"): an anonymous visitor's render issues 0 `.from`/`.rpc` calls of any kind.
  - **Primary failure mode**: the guard is implemented as a post-hoc conditional render (call `listHotExams` unconditionally, then check `user` before rendering the result) instead of a call-site guard — this still issues the RPC call for every anonymous visitor, silently defeating the security intent (the RPC is granted to `authenticated`/`service_role` only, so an anon call would 42501, but issuing it anyway is wasted work and a probe of the boundary from an unauthenticated context).
  - **Boundary to exercise**: this task's own local test (a call-count assertion against a mocked data layer, or the same proof pattern P3-T2 already established at the query layer) + manual smoke test.
  - **State assertion**: before → `user === null`; after → 0 total calls issued.
  - **Mock boundary rationale**: the query layer itself was already proven zero-call-when-null at P3-T2 (the "shared-state dependency"/guarded-composition proof); this task's residual proof is specifically that the **call site** in `app/page.tsx` actually uses the guard, not a discarded-result pattern.
  - **Residual**: none — this closes the loop P3-T2 opened at the query layer.
- **Claim** (AC-038): a site with 0 submitted attempts renders the whole section absent for a signed-in visitor, with 0 errors.
  - **Primary failure mode**: the empty guard checks only `hot.exams.length > 0` without first checking `hot !== null`, throwing on `null.exams` for the anonymous case, or rendering an empty frame instead of omitting the section entirely.
  - **Boundary to exercise**: this task's own local test + manual smoke test.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: mocked data layer for the automated case; real dev for the manual smoke test.
  - **Residual**: none.

## Completion Criteria
- [ ] Guarded ternary call site confirmed (not a post-hoc discard)
- [ ] Label swapped to `home.hotExams`
- [ ] Empty guard widened correctly; whole section absent (not empty frame) when appropriate
- [ ] Manual smoke test on `/` signed-in and signed-out recorded in Investigation Notes
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-4 green

## Notes
- Impact scope: `app/page.tsx`'s hot-exams section only.
- Scope boundary — preserve unchanged: `layout="stack"`, `HOME_EXAM_COUNT=3`, the `Xem tất cả đề` link, the `home-new-exams` DOM id, and every other section of the home page.
