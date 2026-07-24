# Task 7 (Frontend): Frontend rating form (CircleScale, RatingForm, RatePageShell)

Metadata:
- Dependencies: `rating-system-backend-task-6.md` (`rateExam`/`getMyRating` contracts), `rating-system-backend-task-3.md` (`overall`/`bucket`/`formatMean`/`RATING_MIN`/`RATING_MAX` to reuse, not duplicate)
- Provides: the shared `RatingForm` core Task 8 reuses in the modal shell (`layout="modal"`)
- Size: Large (9 files — the shared form core is intentionally kept in one task per the frontend DD's Minimal Surface Element 3, "one `RatingForm(layout)` + two thin shells," so the core and its first shell land together)

## Implementation Content
`SOURCE/components/rating/CircleScale.tsx` (+ jsdom test: roving tabindex, Arrow/Home/End/Space/Enter, `aria-checked`, no out-of-range value) and the shared client core `RatingForm` (+ `RatingOverview`/`PartCard`/`PartDetail`) implementing the 5-state machine (Empty/Partial/Complete/Submitting/Saved/Error) with the live `readoutModel` readout; `RatePageShell` (bubble-expand) + new route `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx` (getExam → 404; server-side eligibility gate via `listMySubmittedExamIds()`; `getMyRating` prefill via `mapFromMyRating`); `submitRating.ts` adapter mapping `PartId→partI/II/III` and the error union to `rateErrorMessage` copy. Add `PART_META`, `readoutModel`, `rateErrorMessage`, `mapFromMyRating` to `SOURCE/lib/rating/` (node vitest).

## Target Files
- [ ] `SOURCE/components/rating/CircleScale.tsx` (new)
- [ ] `SOURCE/components/rating/CircleScale.test.tsx` (new, jsdom)
- [ ] `SOURCE/app/(layer2)/_components/rating/RatingForm.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/rating/RatingOverview.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/rating/PartCard.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/rating/PartDetail.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/rating/RatePageShell.tsx` (new)
- [ ] `SOURCE/app/(layer2)/_components/rating/submitRating.ts` (new)
- [ ] `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx` (new)
- [ ] `SOURCE/lib/rating/` additions: `PART_META`, `readoutModel`, `rateErrorMessage`, `mapFromMyRating` (+ tests)

## Investigation Targets
- `docs/design/rating-system-frontend-design.md` (§ Component Hierarchy & Responsibilities — `RatingForm`/`RatingOverview`/`PartCard`/`PartDetail`/`RatePageShell` rows)
- `docs/design/rating-system-frontend-design.md` (§ Rating-form State Management — the 5-state machine, the derived-readout table, the `submitRating` snippet, the `rateErrorMessage` copy map)
- `docs/design/rating-system-frontend-design.md` (§ Data-Fetching Plan — `/exams/[id]/rate`)
- `docs/design/rating-system-frontend-design.md` (§ Minimal Surface Alternatives (Element 3))
- `docs/design/rating-system-frontend-design.md` (§ Data Contracts (consumed))
- `docs/design/rating-system-frontend-design.md` (§ Field Propagation Map — `scores.{partI,partII,partIII}` row)
- `docs/design/rating-system-frontend-design.md` (§ Test Boundaries — `CircleScale`/`readoutModel` rows)
- `docs/design/rating-system-frontend-design.md` (§ Mock Boundary Decisions)
- `SOURCE/app/(layer2)/actions.ts` (`rateExam`/`getMyRating` — Task 6's output, the contract this task's `submitRating.ts`/rate route consume)
- `SOURCE/lib/rating/` (Task 3's `overall`/`bucket`/`formatMean`/`RATING_MIN`/`RATING_MAX` — reused, not duplicated)
- `SOURCE/vitest.config.ts:15` (`include: lib/**, components/**` — placement constraint for `CircleScale`/lib additions)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/rating-system-frontend-design.md (§ Rating-form State Management) | state-lifecycle-negative | "the header `SUBMIT` shall stay in its pinned disabled treatment ... it shall enable only when all three parts are rated" | `SUBMIT` stays disabled (pinned treatment, `aria-describedby` → "Rate all three parts to submit.") until `Object.keys(scores).length===3`, then enables |
| docs/design/rating-system-frontend-design.md (§ Rating-form State Management) | derived-display | `rateErrorMessage` copy map: `'ineligible'` → "You need to finish this exam before you can rate it."; `'invalid'` → "Please rate all three parts from 1 to 10."; `'server'` → "Couldn't save your rating right now. Please try again." | `rateErrorMessage` maps `'ineligible'`/`'invalid'`/`'server'` to the exact three copy strings specified |

## Investigation Notes
(Record the manual verification of the eligible/ineligible/prefill paths on `/exams/[id]/rate` here before marking complete.)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Review dependency deliverables: Task 6's `rateExam`/`getMyRating` signatures; Task 3's reusable `lib/rating/` exports
- [ ] Write `CircleScale.test.tsx` (roving tabindex, keyboard model, `aria-checked`, no out-of-range value) and the `lib/rating/` addition fixtures (`readoutModel`, `rateErrorMessage`, `mapFromMyRating`, `PART_META` sanity) first; run and confirm failure

### 2. Green Phase
- [ ] Add the minimal `CircleScale`/`RatingForm`/`RatingOverview`/`PartCard`/`PartDetail`/`RatePageShell`/`submitRating.ts`/rate-route/`lib/rating` implementation to pass the added tests
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests) — confirm the 5-state machine matches the frontend DD's state diagram exactly (Empty→Partial→Complete→Submitting→Saved/Error)
- [ ] Confirm added tests still pass

## Quality Assurance Mechanisms
- Vitest (node env) — Enforces: pure-function correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/lib/rating/**` (`readoutModel`/`PART_META`/`rateErrorMessage`/`mapFromMyRating`)
- Vitest (jsdom, `// @vitest-environment jsdom`) — Enforces: component render/keyboard/ARIA correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/components/rating/CircleScale.test.tsx`
- Playwright MCP / manual pass (no CI) — Covers: `RatePageShell` — Config: local `npm run dev` session
- axe a11y audit (manual, dev) — Covers: the rating form (standalone) — executed at the Task 9-frontend QA gate
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: run `CircleScale.test.tsx` and the new `lib/rating/__tests__/` fixtures (`readoutModel`/`PART_META`/`rateErrorMessage`/`mapFromMyRating`) under vitest (jsdom/node respectively); manually exercise the standalone `/exams/[id]/rate` route against the dev server for the eligible/ineligible/prefill paths.
- **Success criteria**: all new vitest assertions pass; manually, an eligible user can complete and save a rating end-to-end on the standalone route, and a direct-URL ineligible visit renders the ineligible notice, not the form.
- **Failure response**: a keyboard-model or state-machine defect blocks Task 8 (which reuses this same `RatingForm` core in the modal shell) — fix before proceeding.
- **Verification level**: L1 (rate from the Browser end-to-end; ineligible direct-URL rejected — per Phase 2 Completion Criteria), backed by L2 (vitest) for `CircleScale`/lib fixtures.

## Proof Obligations
(Source: frontend DD Acceptance Criteria — Rating form section, since no skeleton test block covers `CircleScale`/`RatingForm` directly.)
- **Claim**: the form renders exactly the three fixed parts (Part I — Multiple Choice, Part II — True/False, Part III — Short Answer) in order, regardless of `exam.parts` (AC-001).
  - **Primary failure mode**: parts are sourced from `exam.parts` (variable) instead of the fixed `PART_META` constants, or the order/count is wrong.
  - **Boundary to exercise**: jsdom component render (`RatingForm`/`RatingOverview`).
  - **State assertion**: N/A (render-only).
  - **Mock boundary rationale**: none needed for this render assertion.
  - **Residual**: none.
- **Claim**: `CircleScale` keyboard model — Arrow/Home/End/Space/Enter moves selection within 1-10, the checked circle follows focus (roving tabindex), and no value outside 1-10 is representable (AC-002/024).
  - **Primary failure mode**: focus and checked state diverge (roving tabindex broken), or a value outside 1-10 becomes representable/selectable.
  - **Boundary to exercise**: jsdom component render + simulated keyboard events (`CircleScale.test.tsx`).
  - **State assertion**: before (no selection) → action (keyboard sequence) → after (exactly one circle `aria-checked=true` matching the last committed value).
  - **Mock boundary rationale**: none — pure component, real DOM/keyboard (jsdom).
  - **Residual**: real-browser AT/tooltip behavior is verified by Task 9-frontend's axe + manual pass, not this jsdom test.
- **Claim**: `initialScores` prefill — each rated part pre-fills its score, and the overall readout reflects them (AC-006/013).
  - **Primary failure mode**: prefilled scores are not reflected in the running overall readout, or a part silently reverts to unrated on mount.
  - **Boundary to exercise**: jsdom component render (`RatingForm` with `initialScores` prop).
  - **State assertion**: before (`initialScores`={partial or full}) → action (mount) → after (each `PartCard` shows its score, `RatingOverview` readout matches `readoutModel(scores)`).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: while fewer than three parts are rated, `SUBMIT` stays disabled; it enables only when all three are rated (UI Spec Golden State 1; Reference Contract row above).
  - **Boundary to exercise**: jsdom.
  - **State assertion**: before (0-2 parts rated, `SUBMIT` disabled) → action (rate the 3rd part) → after (`SUBMIT` enabled).
  - **Mock boundary rationale**: none.
  - **Residual**: none.
  - **Primary failure mode**: `SUBMIT` enables before all three parts are rated, or stays disabled after all three are rated.
- **Claim**: clicking `SUBMIT` with all three rated calls the `rateExam` adapter; on success it swaps the label to "Sent" for 1.6s and announces "Rating saved." via `aria-live` (AC-003/009/012 UI side).
  - **Primary failure mode**: submit fires before all three are rated, the success announcement/label-swap doesn't occur, or `submitRating` maps scores to the wrong `partI`/`partII`/`partIII` columns.
  - **Boundary to exercise**: jsdom — `rateExam` mocked at the server-action boundary (sanctioned mock per frontend DD Mock Boundary Decisions).
  - **State assertion**: before (Complete state, `SUBMIT` enabled) → action (click `SUBMIT`) → after (Submitting → Saved state, label "Sent", `aria-live` announces "Rating saved.").
  - **Mock boundary rationale**: `rateExam` is mocked (server-action boundary); the real write path is covered by Task 6's backend tests and Task 2's RLS suite.
  - **Residual**: the real `rateExam` network round-trip and RLS enforcement are not exercised here.
- **Claim**: when the `rateExam` adapter returns an error, the form shows the mapped message in `role="alert"`, preserves all entered scores, and re-enables `SUBMIT` (AC-025/008 UI side).
  - **Primary failure mode**: an error response clears entered scores, `SUBMIT` stays stuck disabled, or the raw error union leaks instead of the mapped copy.
  - **Boundary to exercise**: jsdom — mocked `rateExam` returning `{error:...}`.
  - **State assertion**: before (Submitting) → action (mocked `rateExam` resolves with error) → after (Error state — `role=alert` shows the mapped message, scores unchanged, `SUBMIT` re-enabled).
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: the standalone `/exams/[id]/rate` route 404s on a missing/unpublished exam and renders an ineligible notice (not the form) for a non-eligible direct-URL visitor.
  - **Primary failure mode**: the eligibility gate is skipped or only enforced client-side, letting an ineligible direct-URL visitor see the live form (a defense-in-depth gap; RLS remains the ultimate backstop per ADR-0008 Decision 3).
  - **Boundary to exercise**: integration — Server Component logic (`listMySubmittedExamIds().has(id)`), verified via manual/Playwright pass (no dedicated skeleton — part of the frontend DD's manual/Playwright interaction pass).
  - **State assertion**: before (direct navigation to `/exams/[id]/rate` as an ineligible user) → action (page render) → after (ineligible notice rendered, no `RatingForm` mounted).
  - **Mock boundary rationale**: `getExam`/`listMySubmittedExamIds`/`getMyRating` are query-boundary mocks in page-level tests per frontend DD Mock Boundary Decisions.
  - **Residual**: the authoritative enforcement is RLS (Tasks 1 and 2), already proven; this task's gate is UX-only, consistent with ADR-0008 Decision 3.

## Completion Criteria
- [ ] All added tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Phase 2 completion (shared with Task 6): `CircleScale` meets the WCAG 2.1 AA keyboard model; standalone `/exams/[id]/rate` rates an eligible user end-to-end and rejects a direct-URL ineligible visit server-side

## Notes
- Impact scope: `SOURCE/components/rating/CircleScale.tsx` (+test), all files under `SOURCE/app/(layer2)/_components/rating/` created in this task, the new rate route, and the `lib/rating/` additions listed above.
- Scope boundary: do not create `RatingModal`/`RatingModalController` here — that shell is Task 8's scope, reusing this task's `RatingForm(layout="modal")`.
