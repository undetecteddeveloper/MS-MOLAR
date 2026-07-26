# Task 7 (Frontend): Frontend rating form (CircleScale, RatingForm, RatePageShell)

Metadata:
- Dependencies: `rating-system-backend-task-6.md` (`rateExam`/`getMyRating` contracts), `rating-system-backend-task-3.md` (`overall`/`bucket`/`formatMean`/`RATING_MIN`/`RATING_MAX` to reuse, not duplicate)
- Provides: the shared `RatingForm` core Task 8 reuses in the modal shell (`layout="modal"`)
- Size: Large (9 files — the shared form core is intentionally kept in one task per the frontend DD's Minimal Surface Element 3, "one `RatingForm(layout)` + two thin shells," so the core and its first shell land together)

## Implementation Content
`SOURCE/components/rating/CircleScale.tsx` (+ jsdom test: roving tabindex, Arrow/Home/End/Space/Enter, `aria-checked`, no out-of-range value) and the shared client core `RatingForm` (+ `RatingOverview`/`PartCard`/`PartDetail`) implementing the 5-state machine (Empty/Partial/Complete/Submitting/Saved/Error) with the live `readoutModel` readout; `RatePageShell` (bubble-expand) + new route `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx` (getExam → 404; server-side eligibility gate via `listMySubmittedExamIds()`; `getMyRating` prefill via `mapFromMyRating`); `submitRating.ts` adapter mapping `PartId→partI/II/III` and the error union to `rateErrorMessage` copy. Add `PART_META`, `readoutModel`, `rateErrorMessage`, `mapFromMyRating` to `SOURCE/lib/rating/` (node vitest).

## Target Files
- [x] `SOURCE/components/rating/CircleScale.tsx` (new)
- [x] `SOURCE/components/rating/CircleScale.test.tsx` (new, jsdom)
- [x] `SOURCE/app/(layer2)/_components/rating/RatingForm.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/RatingOverview.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/PartCard.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/PartDetail.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/RatePageShell.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/submitRating.ts` (new)
- [x] `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx` (new)
- [x] `SOURCE/lib/rating/` additions: `PART_META`, `readoutModel`, `rateErrorMessage`, `mapFromMyRating` (+ tests)
- [x] (additive, beyond literal list — see Investigation Notes "Test-file scope decision") `SOURCE/app/(layer2)/_components/rating/RatingForm.test.tsx` (new, jsdom)
- [x] (additive) `SOURCE/app/(layer2)/_components/rating/submitRating.test.ts` (new, node)

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

**Key interfaces read (Step 2):**
- `rateExam(examId, {partI,partII,partIII}): Promise<{error?:"ineligible"|"invalid"|"server"}>`, `getMyRating(examId): Promise<{partI,partII,partIII}|null>` — `SOURCE/app/(layer2)/actions.ts`. Both callable directly from a Server Component (no client wrapper needed for reads); `rateExam` is the write boundary `submitRating.ts` adapts.
- `getExam(id): Promise<Exam|null>` (published-only) and `listMySubmittedExamIds(): Promise<Set<string>>` — `SOURCE/app/(layer2)/queries.ts:163-187`. Both plain async reads (not "use server"), used together in the new `/exams/[id]/rate` route.
- `SOURCE/lib/rating/index.ts` (Task 3): `RATING_MIN=1`, `RATING_MAX=10`, `isValidPartScore`, `overall(p1,p2,p3)`, `bucket`, `formatMean` — reused, not duplicated, by the new `PART_META`/`readoutModel`/`rateErrorMessage`/`mapFromMyRating` additions.
- `RatingFormProps` binding contract (UI Spec lines 160-178): `{examId, layout:"page"|"modal", initialScores?, onSubmit: (scores)=>Promise<{ok:true}|{ok:false,message}>, onSaved?}` — `onSubmit` is injected by the shell (`RatePageShell` wires `submitRating`), not imported directly inside `RatingForm`. This resolves an apparent tension with the frontend DD's mermaid (`RF1 -.submit.-> ADP`), which is read as "RatingForm's submit action reaches the adapter via the shell-supplied `onSubmit`", not a direct import.
- `vitest.config.ts:19` now collects `app/**/*.test.{ts,tsx}` too (widened for backend Task 4/6/8), so `app/(layer2)/_components/rating/*.test.tsx` jsdom tests are collected by `npm test`, not only `lib/**`/`components/**`.

**Test-file scope decision:** Target Files lists 9 implementation files (no `RatingForm.test.tsx`/`submitRating.test.ts`), and the Red Phase step only names `CircleScale.test.tsx` + lib fixtures. However Proof Obligations explicitly require a jsdom boundary for 5 of 6 claims (contrast: claim 7 explicitly says "no dedicated skeleton"), and the Mock Boundary Decisions table names a `submitRating` unit test against a stubbed `rateExam`. Both are achievable without a browser (pure Node/jsdom, unlike the Playwright-only claim 7), so two co-located test files are added beyond the literal Target Files list: `SOURCE/app/(layer2)/_components/rating/submitRating.test.ts` (mocks `@/app/(layer2)/actions`) and `SOURCE/app/(layer2)/_components/rating/RatingForm.test.tsx` (jsdom, injects a controllable `onSubmit` — the component's actual prop-level boundary per `RatingFormProps`). This is additive test coverage co-located with already-in-scope impl files, not a new architectural surface.

**Eligible/ineligible/prefill path verification (manual, no Playwright MCP this session):** Code-level trace of `SOURCE/app/(layer2)/exams/[id]/rate/page.tsx`: (1) `getExam(id)` null → `notFound()` (published-only, matches `exams/[id]/page.tsx` precedent). (2) `listMySubmittedExamIds()` — `.has(id)===false` (covers both logged-out and not-attempted, RLS-scoped to `auth.uid()`) renders a static ineligible notice + back link, **not** `RatePageShell`/`RatingForm` — server-side reject per ADR-0008 Decision 3 (RLS remains the real gate; ineligible precheck calling `rateExam` directly would still be rejected by `with check` on write). (3) `.has(id)===true` → `mapFromMyRating(await getMyRating(id))` prefill → `RatePageShell`. Live-browser walkthrough of these three paths against `npm run dev` is deferred to Task 9-frontend's QA gate (no Playwright MCP / Supabase MCP available this session), consistent with the orchestrator note and prior tasks' handling.

**Reference Contract compliance evidence:**
- Row 1 (`SUBMIT` pinned-disabled → enabled at 3/3 rated): `RatingOverview.tsx` renders the header button with `disabled={submitDisabled}` and `aria-describedby={submitDisabled && !submitBusy ? submitHintId : undefined}` pointing at a `sr-only` span with the exact text `Rate all three parts to submit.`; `RatingForm.tsx` computes `submitDisabled={!allRated || submitState==="submitting"}` where `allRated = PART_IDS.every(id => scores[id] !== undefined)` — i.e. `Object.keys(scores).length===3` in effect (all three fixed `PartId`s present). Verified green by `RatingForm.test.tsx` ("stays disabled with aria-describedby hint..." / "enables once the 3rd part is rated..."). **Y**.
- Row 2 (`rateErrorMessage` copy map): `SOURCE/lib/rating/index.ts` `rateErrorMessage` returns the three exact strings for `'ineligible'`/`'invalid'`/`'server'`. Verified green by `lib/rating/__tests__/ratingForm.test.ts` (3 literal-string assertions) and transitively by `submitRating.test.ts` (2 of the 3 mapped through the adapter). **Y**.

**Test run evidence (this session, no Playwright MCP/Supabase MCP):** `npx vitest run lib/rating components/rating "app/(layer2)/_components/rating" "app/(layer2)/__tests__"` → 7 test files, 83/83 passed (12 `CircleScale`, 14 `lib/rating` frontend fixtures, 4 `submitRating`, 9 `RatingForm`, plus pre-existing Task 3/6 rating suites unaffected). `npx tsc --noEmit` clean on every file this task touches (2 pre-existing, unrelated `(layer3)` errors untouched — untracked analytics work). `npx eslint`/`npx prettier --check` clean on every new/modified file this task touches.

**Post-review fix (integration-test-reviewer gap):** the reviewer found `PartDetail`'s `Selected: x/10` readout and its default-disabled `SUBMIT RATING` button (AC-002) were correctly implemented but had zero assertions in `RatingForm.test.tsx`. Extended the existing "enables once the 3rd part is rated via its `PartDetail`" test with: (1) on opening Part III with no selection — `Selected: —/10` renders and `SUBMIT RATING` is disabled; (2) after selecting circle 9 — `Selected: 9/10` renders live and `SUBMIT RATING` enables. Re-ran the full rating-scoped suite (83/83 still passing) plus `tsc`/`eslint`/`prettier --check` on the modified file — all clean. The reviewer's second point (an executed Playwright/manual pass for the `/exams/[id]/rate` server-side eligibility gate, vs. this task's code-level trace) is a Task 9-frontend QA-gate process item, already tracked above and in the work plan — no further action taken on it here.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Review dependency deliverables: Task 6's `rateExam`/`getMyRating` signatures; Task 3's reusable `lib/rating/` exports
- [x] Write `CircleScale.test.tsx` (roving tabindex, keyboard model, `aria-checked`, no out-of-range value) and the `lib/rating/` addition fixtures (`readoutModel`, `rateErrorMessage`, `mapFromMyRating`, `PART_META` sanity) first; run and confirm failure

### 2. Green Phase
- [x] Add the minimal `CircleScale`/`RatingForm`/`RatingOverview`/`PartCard`/`PartDetail`/`RatePageShell`/`submitRating.ts`/rate-route/`lib/rating` implementation to pass the added tests
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — confirm the 5-state machine matches the frontend DD's state diagram exactly (Empty→Partial→Complete→Submitting→Saved/Error)
- [x] Confirm added tests still pass

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
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above (L2 vitest fully executed; L1 browser walkthrough deferred to Task 9-frontend's QA gate — no Playwright MCP/Supabase MCP this session, per orchestrator note and Task 5's precedent)
- [x] Each Proof Obligation is met (claims 1-6 exercised by jsdom tests; claim 7 verified by code-level trace, live-browser confirmation deferred to Task 9 per its own "no dedicated skeleton" disclaimer)
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Phase 2 completion (shared with Task 6): `CircleScale` meets the WCAG 2.1 AA keyboard model (12/12 jsdom tests: roving tabindex, Arrow/Home/End/Space/Enter, `aria-checked`, no out-of-range value); standalone `/exams/[id]/rate` implements an eligible-user end-to-end path + a server-side ineligible reject by code trace (live-browser confirmation deferred to Task 9-frontend QA gate)

## Notes
- Impact scope: `SOURCE/components/rating/CircleScale.tsx` (+test), all files under `SOURCE/app/(layer2)/_components/rating/` created in this task, the new rate route, and the `lib/rating/` additions listed above.
- Scope boundary: do not create `RatingModal`/`RatingModalController` here — that shell is Task 8's scope, reusing this task's `RatingForm(layout="modal")`.
