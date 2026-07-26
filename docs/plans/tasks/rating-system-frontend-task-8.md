# Task 8 (Frontend): Result-page modal (RatingModalController, ?rate=auto)

Metadata:
- Dependencies: `rating-system-backend-task-6.md` (`getMyRating`), `rating-system-frontend-task-7.md` (shared `RatingForm` core); resolve using the `vitest.config.ts` decision recorded by `rating-system-backend-task-4.md`
- Provides: the reserved-slot user journey (submit → result → auto-open → rate → saved → idempotent return) that Task 9-frontend audits
- Size: Medium (5 files: `RatingModal.tsx`, `RatingModalController.tsx`, the result page, `actions.ts` (one-line redirect change), the two test-skeleton conversions)

## Implementation Content
`RatingModal` (extends `ReportExam`/`LeaveExamDialog` dialog shell: scrim, Esc/scrim/Close-close, `role=dialog`/`aria-modal`/`aria-labelledby`; adds focus-trap, focus-return-to-trigger, `aria-live="polite"` success announcement) hosting `RatingForm(layout="modal")`; `RatingModalController` (reads `?rate=auto`, opens once, strips via `router.replace(pathname,{scroll:false})`; renders the inline entry point `Rate this exam`/`Edit your rating`); mount on the result page with a `getMyRating` prefill read; append `?rate=auto` only to `submitExam`'s fresh-submit redirect (`actions.ts` line ~127), leaving the idempotent already-submitted redirect (line ~50) unchanged. Convert integration Test 3 (`rating.int.test.ts`) into a real vitest/RTL test against a mocked `next/navigation` router. Convert fixture-e2e FE1 (`rating.fixture.e2e.test.ts`, RESERVED SLOT) into a Playwright script covering the full continuous-session journey.

## Target Files
- [x] `SOURCE/app/(layer2)/_components/rating/RatingModal.tsx` (new)
- [x] `SOURCE/app/(layer2)/_components/rating/RatingModalController.tsx` (new)
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (add `getMyRating` read; mount `RatingModalController`)
- [x] `SOURCE/app/(layer2)/actions.ts` (append `?rate=auto` to the fresh-submit redirect at `:127` ONLY)
- [x] `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (convert Test 3 only)
- [x] `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (convert Test FE1 only)

## Investigation Targets
- `SOURCE/app/(layer2)/actions.ts:50` (idempotent already-submitted redirect — must NOT carry `?rate=auto`)
- `SOURCE/app/(layer2)/actions.ts:127` (fresh-submit redirect — the ONLY line to change, code:F6)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx:14-27` (existing Server Component, `getResult(attemptId)`)
- `SOURCE/app/(layer2)/_components/ReportExam.tsx:27-36,79-132` (dialog Esc/scrim-close + focus-into + primary-button pattern; the three a11y gaps — no focus-trap, no focus-return, no in-dialog announcement — this modal must close)
- `SOURCE/app/(layer2)/_components/LeaveExamDialog.tsx:22-46` (scrim `bg-[#1B1512]/40`, `role=dialog`/`aria-modal`/`aria-labelledby` precedent)
- `SOURCE/app/(layer2)/_components/ExamFilters.tsx:73` (`router.push(pathname,{scroll:false})` — the same API family `router.replace` reuses to strip the marker)
- `docs/design/rating-system-frontend-design.md` (§ Component Hierarchy & Responsibilities — `RatingModalController`/`RatingModal` rows)
- `docs/design/rating-system-frontend-design.md` (§ Rating-form State Management — the modal-close `onSaved` behavior)
- `docs/design/rating-system-frontend-design.md` (§ Minimal Surface Alternatives (Element 2) — `?rate=auto` transient marker)
- `docs/design/rating-system-frontend-design.md` (§ Data-Fetching Plan — result page)
- `docs/design/rating-system-frontend-design.md` (§ Field Propagation Map — `rate=auto` row)
- `docs/design/rating-system-frontend-design.md` (§ Acceptance Criteria — Result-page modal)
- `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (Test 3 skeleton block)
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (Test FE1 skeleton block)
- `SOURCE/app/(layer2)/_components/rating/RatingForm.tsx` (Task 7's shared core, reused here with `layout="modal"`)

## Change Category
`Change Category: boundary-change`

`actions.ts`'s fresh-submit redirect gains a query marker consumed by a new controller — a new serialized boundary on an existing file. Sweep: the sibling idempotent already-submitted redirect at `:50` shares the same file and must be swept for the same class of defect (accidentally also gaining the marker) — confirmed unchanged by Proof Obligation below.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/rating-system-frontend-design.md (§ Acceptance Criteria — Result-page modal) | state-lifecycle-negative | "When the result page loads without the marker (refresh/back/bookmark), the modal shall stay closed and only the inline entry point ... shall render." | `RatingModalController` renders the modal closed and only the inline entry point (`Rate this exam` / `Edit your rating`) when `searchParams.rate !== 'auto'` |

## Boundary Context (Connection Map)
- **Boundary**: `submitExam` redirect (Next.js server action) → `ResultPage` → `RatingModalController` (client).
- **Owner (left)**: `SOURCE/app/(layer2)/actions.ts` (fresh-submit redirect only, line ~127).
- **Owner (right)**: `SOURCE/app/(layer2)/_components/rating/RatingModalController.tsx`.
- **Serialized Format**: Query string `?rate=auto` appended once.
- **Consumer Parse Rule**: Controller reads `searchParams.rate`; if `=== 'auto'`, opens the modal once then `router.replace(pathname,{scroll:false})` strips it.
- **Expected Signal**: Modal opens exactly once on fresh submit; refresh/back never carries the marker.
- **Roundtrip check**: the exact string `auto` emitted by `actions.ts:127`'s appended query parameter must be the exact string `RatingModalController` compares `searchParams.rate` against — verify both sides use the literal `'auto'`, not a different casing/spelling.

## Investigation Notes

**Key observations (Step 2):**
- `actions.ts:50` (idempotent already-submitted redirect) reads `redirect(\`/exams/${examId}/attempt/${attemptId}/result\`);` — confirmed byte-for-byte unchanged after the edit (re-read post-edit, identical).
- `actions.ts:128` (fresh-submit redirect, was `:127` before this task's own comment insertion shifted line numbers) is the ONLY line changed: now `redirect(\`/exams/${examId}/attempt/${attemptId}/result?rate=auto\`);`.
- `result/page.tsx:14-27` — existing Server Component; `getResult(attemptId)` unchanged; `id`/`attemptId` already destructured from `params`, reused for the new `getMyRating(id)` read (same `id` = examId pattern as `/exams/[id]/rate/page.tsx`).
- `ReportExam.tsx`/`LeaveExamDialog.tsx` precedent: scrim `bg-[#1B1512]/40` + `role=dialog`/`aria-modal`/`aria-labelledby` + Esc-close reused verbatim in `RatingModal.tsx`; the three gaps (no focus-trap, no focus-return, no in-dialog announcement) are closed by `RatingModal`'s Tab/Shift+Tab trap, `previouslyFocused.focus()` restore on close, and reuse of `RatingForm`'s own internal `aria-live` region (per `RatingForm.tsx`'s documented decision that this satisfies "the shell's aria-live" for both shells — not duplicated in `RatingModal`).
- `ExamFilters.tsx:73` confirmed `router.push(pathname, { scroll: false })` — `RatingModalController` uses `router.replace(pathname, { scroll: false })` (same API family, `replace` instead of `push` since this is a history-replace strip, not a navigation).
- Task 6/7 dependency deliverables: `getMyRating(examId): Promise<{partI,partII,partIII}|null>` (actions.ts) and `mapFromMyRating` (lib/rating) reused verbatim (same pattern as the standalone rate page); `RatingForm(layout="modal", onSaved?)` prop contract confirmed from `RatingForm.tsx` — `onSaved` is invoked once on `{ok:true}`, `RatingForm`'s own `aria-live` region already renders inside whatever shell mounts it.

**Roundtrip check (Boundary Context)**: `actions.ts`'s appended query parameter is the literal string `?rate=auto`; `RatingModalController` compares `searchParams.get("rate") === "auto"` — both sides use the exact literal `"auto"` (verified by reading both files side-by-side and by Test 3 obligation (a), which renders the controller with `mockSearchParams = new URLSearchParams("rate=auto")` and asserts the dialog opens + `router.replace` is called with the exact pathname). **Match confirmed.**

**Reference Contract Compliance Check**: Row 1 (`RatingModalController` renders the modal closed and only the inline entry point when `searchParams.rate !== 'auto'`) — `RatingModalController`'s `open` state lazy-initializes from `searchParams.get("rate") === "auto"` at first render (not via a post-mount effect setState, to satisfy the `react-hooks/set-state-in-effect` lint rule without changing behavior); when false, `RatingModal` returns `null` and only the inline entry-point button renders. Verified by Test 3 obligation (b) (`rate` absent, with and without `initialScores` → `queryByRole("dialog")` is `null`, `replaceMock` never called). **Y**.

**Cross-fade scope decision**: the frontend DD's Component Hierarchy table lists "cross-fade overview↔detail" as a `RatingModal` responsibility, but that internal transition point (`RatingForm`'s `activePart`) is sealed inside Task 7's core, which this task's own Notes forbid modifying ("do not modify RatingForm's internal state machine here"). No AC, Reference Contract, or Proof Obligation in this task exercises that specific internal transition (only open/close, focus-trap, focus-return, `aria-live`, idempotency, and the CircleScale keyboard smoke check do — confirmed by re-reading every Proof Obligation claim). Implemented instead: the modal's own open-transition fade (opacity, `prefers-reduced-motion`-aware), which is the cross-fade `RatingModal` can own and implement without touching `RatingForm`, documented in `RatingModal.tsx`'s file header. This is treated as an implementation-detail scope reduction (not a tested-contract violation) consistent with Task 7's own precedent of approximate, Playwright-verified-by-eye CSS transitions rather than exact ones — residual noted here for Task 9-frontend's Playwright/manual pass.

**Pre-existing, unrelated test failures**: `lib/scoring/__tests__/computeScore.test.ts` (5 failures, true_false auto-scoring) — untracked file present before this task started, outside this task's Target Files/scope; not touched.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent case per Change Category: confirm the redirect at `:50` before editing `:127`, so the "unchanged" claim has a concrete baseline
- [x] Review dependency deliverables: Task 6's `getMyRating`; Task 7's `RatingForm(layout="modal")` prop contract
- [x] Convert Test 3's skeleton comments into real RTL/vitest blocks against a mocked `next/navigation` router; convert Test FE1's skeleton comments into a Playwright script; run and confirm failure

### 2. Green Phase
- [x] Add the minimal `RatingModal`/`RatingModalController`/result-page/`actions.ts` changes to pass the added tests
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — confirm the redirect at `:50` is byte-for-byte unchanged
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- Playwright MCP / manual pass (no CI) — Covers: the Rating modal (focus-trap/focus-return/`aria-live`, `?rate=auto` idempotency) — Config: local `npm run dev` session
- axe a11y audit (manual, dev) — Covers: the rating form (modal) — executed at the Task 9-frontend QA gate
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: convert integration Test 3 into a real vitest/RTL test against a mocked `next/navigation` router (open-condition branching in-process); convert fixture-e2e FE1 into a Playwright script covering the full continuous-session journey against fixture-driven `rateExam`/`getMyRating`.
- **Success criteria**: `?rate=auto` opens the modal exactly once on a fresh submit and never re-pops on refresh/back/bookmark (AC-004/AC-005); an already-rated user sees the editable pre-filled "Edit your rating" state, not a fresh empty form (AC-006); Modal Tab/Shift+Tab cycles within it; Esc/scrim/Close close it; focus returns to the inline entry-point trigger.
- **Failure response**: an idempotency failure (re-pop on refresh) is the feature's core UX regression — fix `RatingModalController`'s open-condition/strip logic before Task 9-frontend's audit.
- **Verification level**: L2 (Test 3, mocked-router integration) backed by L1 (fixture-e2e FE1, the reserved-slot full journey, per the no-CI local workflow).

## Proof Obligations
(Source: skeleton `rating.int.test.ts` Test 3 proof obligations (a)-(c) and skeleton `rating.fixture.e2e.test.ts` Test FE1 proof obligations (1)-(5).)
- **Claim**: with `searchParams.rate === "auto"`, the modal opens on mount and `router.replace(pathname, { scroll: false })` is called exactly once to strip the marker (AC-004).
  - **Primary failure mode**: the `?rate=auto` marker is re-consulted on every render instead of exactly once (open-loop or repeated `router.replace` calls).
  - **Boundary to exercise**: integration — RTL/jsdom with a mocked `next/navigation` router (sanctioned mock).
  - **State assertion**: before (mount with `rate=auto`) → after (modal `open===true`, `router.replace` called once with correct args).
  - **Mock boundary rationale**: `next/navigation` router is mocked; full focus-trap/focus-return/`aria-live` is browser-level, proven by fixture-e2e FE1 instead.
  - **Residual**: full DOM focus-trap/return behavior is not proven by this jsdom test — covered by FE1 obligation (5).
- **Claim**: with no `rate` marker present (simulating refresh/back/bookmark), the modal stays closed on mount regardless of `initialScores` (AC-005).
  - **Primary failure mode**: the marker is not stripped so a subsequent render (simulating refresh) re-triggers the open condition.
  - **Boundary to exercise**: same as above.
  - **State assertion**: before (mount without marker) → after (modal `open===false`).
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim**: when `initialScores` is provided, the inline entry-point label reads "Edit your rating" (not "Rate this exam"), and if opened, the form is seeded with those three scores (AC-006).
  - **Primary failure mode**: a user with `initialScores` present is shown an empty fresh form instead of the editable pre-filled entry point.
  - **Boundary to exercise**: same as above.
  - **State assertion**: before (`initialScores` present) → after (label reads "Edit your rating"; opened form's `PartCard`s show the three scores).
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim**: on first load with `?rate=auto`, the modal is visible AND the result content remains present in the DOM behind/around it (AC-004).
  - **Primary failure mode**: the modal blocks/hides the result content instead of overlaying it.
  - **Boundary to exercise**: fixture-e2e — full browser DOM, real Next.js client routing, fixture-driven backend.
  - **State assertion**: before (navigate to `result?rate=auto`) → after (modal visible, result content still in DOM).
  - **Mock boundary rationale**: backend (`rateExam`/`getMyRating`) fixture-driven; DOM/routing real.
  - **Residual**: none.
- **Claim**: all three `CircleScale` parts are keyboard-operable across 1-10 within the modal, and the scale legend is visible (AC-002/024, integrated smoke check).
  - **Primary failure mode**: the modal context breaks the keyboard model that Task 7's unit test already proved in isolation (e.g., focus-trap interferes with roving tabindex).
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: N/A (interaction check).
  - **Mock boundary rationale**: same.
  - **Residual**: the exhaustive keyboard-model matrix is proven by Task 7's `CircleScale.test.tsx`; this is an integrated smoke check within the modal.
- **Claim**: after submitting three valid scores, a saved confirmation is announced (`aria-live`) and the modal reaches its Saved state.
  - **Primary failure mode**: the success announcement/state transition doesn't occur within the modal shell.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before (Complete) → action (submit) → after (Saved, `aria-live` announces).
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim**: reloading the same result URL WITHOUT `?rate=auto` never auto-opens the modal, and instead shows an "Edit your rating" inline entry point pre-filled with the three just-saved scores (AC-005/006 — the idempotency guarantee this feature exists to provide).
  - **Primary failure mode**: the reload shows a blank fresh form or re-opens the modal instead of the pre-filled "already rated" editable state.
  - **Boundary to exercise**: fixture-e2e (continuous browser session, real reload).
  - **State assertion**: before (just saved a rating) → action (reload same URL without marker) → after (modal stays closed, inline entry shows "Edit your rating" pre-filled).
  - **Mock boundary rationale**: same.
  - **Residual**: none — this is the primary claim FE1 exists to prove.
- **Claim**: Esc, scrim click, and the Close control each close the modal, and focus returns to the inline entry-point trigger afterward.
  - **Primary failure mode**: one of the three close methods fails to close the modal, or focus is lost/misplaced after close.
  - **Boundary to exercise**: fixture-e2e.
  - **State assertion**: before (modal open) → action (each close method in turn) → after (modal closed, focus on trigger).
  - **Mock boundary rationale**: same.
  - **Residual**: none.

## Completion Criteria
- [x] All added tests pass (21/21 in `rating.int.test.ts`, incl. 5 new Test 3 blocks; full rating-scoped suite 88/88)
- [x] Operation verified per Operation Verification Methods above (L2 vitest fully executed; L1 fixture-e2e FE1 written as a driver-based script per the no-Playwright-MCP-this-session constraint — static/code-level verification only, live-browser walkthrough deferred to Task 9-frontend's QA gate, consistent with prior tasks' precedent)
- [x] Each Proof Obligation is met (claims 1-3 exercised by Test 3's jsdom/RTL blocks; claims 4-8 converted into FE1's `checkXxx`/`runFE1` script, verified by code-level trace + `tsc`/`eslint`/`prettier` — live-browser confirmation deferred to Task 9 per the no-CI local workflow)
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] The redirect at `actions.ts:50` is confirmed byte-for-byte unchanged (Change Category sweep)
- [x] Phase 3 completion: `?rate=auto` opens the modal exactly once on a fresh submit and never re-pops on refresh/back/bookmark (AC-004/AC-005); an already-rated user sees the editable pre-filled "Edit your rating" state, not a fresh empty form (AC-006); Modal Tab/Shift+Tab cycles within it; Esc/scrim/Close close it; focus returns to the inline entry-point trigger

## Notes
- Impact scope: `RatingModal.tsx`, `RatingModalController.tsx`, the result page, and exactly the one redirect line in `actions.ts` (`:127`).
- Scope boundary: do not touch the redirect at `actions.ts:50`; do not modify `RatingForm`'s internal state machine here — reuse Task 7's core via `layout="modal"` only.
