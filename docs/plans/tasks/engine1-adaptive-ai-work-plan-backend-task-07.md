# Task 07 (Backend): `lib/adaptive/route.ts` — `recommendNextSkill()` (Work Plan Phase 2, Task 7)

Metadata:
- Dependencies: backend-task-04 (`skillTaxonomy.ts`'s typed shapes, `MASTERY_CLEARED_THRESHOLD`) — does NOT depend on backend-task-05/06 (uses independent literal fixtures, per Phase 1 completion's Next Phase Gate)
- Provides: `recommendNextSkill()`, consumed by backend-task-08 (`getSkillRecommendation()`)
- Size: Small (2 files: `route.ts`, `route.test.ts`)

## Implementation Content

Implement per the backend DD's Data Contracts algorithm (10-step pseudocode): cold-start check, ratio computation with untouched-node-defaults-to-0, `isCleared()`, the 3-key `sortKey`, the prerequisite-substitution walk with a defensive visited-set, `reasonCode` derivation. Convert `route.test.ts`'s 4 already-generated tests into real vitest tests in the same commit (Red→Green):
- Test 1 (AC-014/017, prerequisite-gate substitution)
- Test 2 (AC-015/016, recency tie-break + determinism, incl. no-mutation assertion)
- Test 3 (AC-028, strict-null cold start on a non-trivial DAG)
- Test 4 (node-absent-from-mastery defaults to ratio 0, no crash)

## Target Files
- [ ] `SOURCE/lib/adaptive/route.ts` (new — `recommendNextSkill()`)
- [ ] `SOURCE/lib/adaptive/__tests__/route.test.ts` (fill in the existing skeleton's 4 tests)

## Investigation Targets
- `SOURCE/lib/adaptive/__tests__/route.test.ts` (already generated — read in full: the 10-step algorithm pseudocode in the header comment, and all 4 tests' exact Behavior/Primary-failure-mode/Proof-obligation annotations)
- `SOURCE/lib/adaptive/skillTaxonomy.ts`, `SOURCE/lib/adaptive/constants.ts` (backend-task-04 — `MASTERY_CLEARED_THRESHOLD`, the node/edge shape)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/adaptive/route.ts` — `recommendNextSkill()`, AC-014-017/028; § Data Contracts — `recommendNextSkill()` Algorithm steps 4/9/Output Guarantees, verbatim source for the Reference Contracts below)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-backend-design.md (§ Data Contracts — `recommendNextSkill()` Algorithm step 4) | derived-display | "sortKey(node) = [ratio(node) ASC, lastWrongAt(node) DESC NULLS LAST, node.id ASC]  // AC-015 + AC-016 determinism" | Does `recommendNextSkill()`'s internal sort implement exactly this 3-key order (ratio ASC, lastWrongAt DESC NULLS LAST, id ASC) (Y/N)? |
| docs/design/engine1-adaptive-ai-backend-design.md (§ Data Contracts — `recommendNextSkill()` Algorithm step 9) | derived-display | "reasonCode = substituted ? \"prerequisite-gate\" : (tieBrokenByRecency ? \"recently-wrong\" : \"lowest-mastery\")" | Does the returned `reasonCode` follow exactly this precedence (substitution first, then recency tie-break, then lowest-mastery default) (Y/N)? |
| docs/design/engine1-adaptive-ai-backend-design.md (§ Data Contracts — `recommendNextSkill()` Output Guarantees) | state-lifecycle-negative | "mastery.length === 0 -> returns null (AC-028, true cold start — never a fabricated entry-node guess, per PRD's own 'say less when it knows less' framing)" | Does `recommendNextSkill()` return strictly `null` (not an arbitrary/first/entry node) when `mastery.length === 0`, verified against a non-trivial DAG (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets, in particular the full skeleton file's 4 tests.
- [ ] Convert all 4 skeleton tests into real vitest tests, using the exact literal fixtures and assertions described in each test's Behavior/Proof-obligation annotation.
- [ ] Run the tests and confirm all 4 fail (no `route.ts` implementation exists yet).

### 2. Green Phase
- [ ] Implement `recommendNextSkill()` per the 10-step algorithm (cold-start check → ratio computation → `isCleared()` → `sortKey` → prerequisite-substitution walk with a visited-set → `reasonCode` derivation).
- [ ] Run `npx vitest run lib/adaptive/__tests__/route.test.ts` — confirm all 4 pass.

### 3. Refactor Phase
- [ ] Confirm the function performs no mutation of its input arguments (Test 2's own no-mutation assertion) and reads no ambient state (`Date.now()`, module-level mutable state) — re-run tests to confirm still green.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/adaptive/`
- `check-ai-key-bundle.mjs` — Covered: `lib/adaptive/` (directory-level; this file itself makes no external calls)

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/adaptive/__tests__/route.test.ts` against the 4 literal-fixture tests.
- **Success criteria**: all 4 tests pass; `recommendNextSkill()` is DAG-valid and deterministic on all 4 unit test fixtures (Phase 2 Completion Criteria).
- **Failure response**: reassess the algorithm step implicated by the specific failing test's Primary failure mode (see skeleton annotations) before proceeding to backend-task-08, which depends on this function's correctness.
- **Verification level**: L2 (new tests added and passing) — no end-user-facing surface exists yet for this function alone (L1 arrives once backend-task-08/frontend-task-02 wire it to the dashboard).

## Proof Obligations
(Sourced verbatim from `route.test.ts`'s own annotations.)
- **Claim**: Test 1 — the prerequisite-substitution walk (step 8) returns the unmet prerequisite, never the raw weakest node whose own prerequisite is unmet (AC-014/017).
- **Primary failure mode**: the substitution walk is missing or short-circuits, so the function returns the raw weakest node directly even though its own prerequisite sits below threshold.
- **Boundary to exercise**: in-process unit (pure function, literal fixture DAG + mastery array, no I/O).
- **State assertion**: N/A (pure function).
- **Mock boundary rationale**: none — no I/O boundary exists to mock.
- **Residual**: none.
- **Claim**: Test 2 — a tied-ratio pair is broken by `lastWrongAt` recency, not array order/object identity; repeated calls with structurally-identical input are deterministic and non-mutating (AC-015/016).
- **Primary failure mode**: a tied-ratio pair is broken by node array order or object identity instead of `lastWrongAt`; or the function reads ambient/mutable state, breaking the pure-function guarantee `getSkillRecommendation()`'s safety to call on every dashboard read depends on.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A (pure function; the "no mutation" assertion is itself the state-invariant being proven — input objects unchanged after each call).
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: Test 3 — `mastery: []` returns strictly `null`, never a fabricated recommendation (AC-028).
- **Primary failure mode**: the function falls through to the "absent from mastery = ratio 0" rule and returns SOME node instead of null for a zero-mastery user.
- **Boundary to exercise**: in-process unit, non-trivial (non-empty) DAG fixture.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: Test 4 (Failure Mode Checklist `missing-sort-key ordering` proxy + Data Contract invariant) — a node absent from `mastery` defaults to ratio 0 without crashing.
- **Primary failure mode**: accessing an untouched node's ratio throws, or the untouched node is silently excluded from candidate selection instead of ranked as weakest.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: this file's own regression is re-checked once more at Final-Phase Task 22's full regression re-run (Failure Mode Checklist `missing-sort-key ordering` row also names backend-task-14 as a covering task).

## Completion Criteria
- [ ] `route.ts` implements the 10-step algorithm; all 4 `route.test.ts` tests pass
- [ ] All 3 Reference Contracts' Compliance Checks evaluate to `Y`, evidence recorded in Investigation Notes
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode

## Notes
- Impact scope: `SOURCE/lib/adaptive/route.ts` and its test file only.
- Scope boundary: do not implement `getSkillRecommendation()` (backend-task-08) here — this task only produces the pure routing function.
