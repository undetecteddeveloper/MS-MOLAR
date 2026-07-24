# Task 3 (Backend): `SOURCE/lib/rating/` pure helpers + unit tests

Metadata:
- Dependencies: none (independent of Task 1; can be TDD'd first per the backend DD's implementation order)
- Provides: `overall`/`bucket`/`communityDifficultyFrom`/`formatMean`/`isValidPartScore` + `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD`, consumed by Task 4 (read wiring), Task 6 (write validation), and Task 7 (frontend readout model additions to the same directory)
- Size: Small (2 files: `SOURCE/lib/rating/index.ts` + `SOURCE/lib/rating/__tests__/rating.test.ts`)

## Implementation Content
Implement the pure, side-effect-free helpers `overall`, `bucket`, `communityDifficultyFrom`, `formatMean`, `isValidPartScore`, and the `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD` constants exactly per the backend DD's Business Logic section (the DD contains ready-to-use TypeScript — paste, don't paraphrase). Add `SOURCE/lib/rating/__tests__/rating.test.ts` with literal-fixture tests: bucket boundaries (3.9/4.0/6.9/7.0/1.0/10.0), `overall`=mean, threshold gating, validation, threshold-agreement (`RATING_THRESHOLD===3` cross-referenced to the view's SQL literal), and mean display rounding.

## Target Files
- [ ] `SOURCE/lib/rating/index.ts` (or `bucket.ts`/`constants.ts` — match whichever split the backend DD's snippet implies; a single `index.ts` is acceptable)
- [ ] `SOURCE/lib/rating/__tests__/rating.test.ts`

## Investigation Targets
- `docs/design/rating-system-backend-design.md` (§ Business Logic — `SOURCE/lib/rating/` (pure, vitest-covered)) — contains the exact implementation to use
- `docs/design/rating-system-backend-design.md` (§ Test Boundaries — `vitest — SOURCE/lib/rating/__tests__/rating.test.ts (literal fixtures)`)
- `SOURCE/lib/scoring/computeScore.ts` + `SOURCE/lib/scoring/__tests__/` (pattern precedent — pure server-side domain function + literal-fixture vitest style)
- `SOURCE/lib/ugc/limits.ts` (`LIMITS` — centralized numeric-limit constant pattern precedent)
- `SOURCE/vitest.config.ts:15` (`include: lib/**, components/**` — confirms this path is already collected)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0008-exam-difficulty-rating-and-on-read-aggregation.md (§ Decision) | placement | On-read aggregate is expressed as a Postgres view (Task 1) with a NULL-below-threshold aggregate column, plus a pure TS display helper for bucket/mean/`"—"` | `SOURCE/lib/rating/` exports a pure `bucket()`/`formatMean()`/`communityDifficultyFrom()` with no I/O or side effects |
| docs/adr/ADR-0008-exam-difficulty-rating-and-on-read-aggregation.md (§ Implementation Guidance) | contract_schema | Express `N = 3` once as a named constant, referenced from both the view definition (Task 1) and the TS display helper | `RATING_THRESHOLD === 3` is asserted by a vitest test carrying a comment cross-referencing the view's SQL literal `3` |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/rating-system-backend-design.md (§ Acceptance Criteria R6/R7/R8) | derived-display | "bucket follows [1,4)→Easy / [4,7)→Medium / [7,10]→Hard (4.0→Medium, 7.0→Hard, 10.0→Hard)" | `bucket(mean)` returns Easy for `[1,4)`, Medium for `[4,7)`, Hard for `[7,10]`, with `4.0`→Medium, `7.0`→Hard, `10.0`→Hard, verified by a literal-fixture test at each boundary |
| docs/design/rating-system-backend-design.md (§ Acceptance Criteria R6/R7/R8) | state-lifecycle-negative | "While an exam has < 3 ratings, `communityDifficulty` shall be `null` (frontend renders `"—"`)." | `communityDifficultyFrom` returns `null` whenever `ratingCount < RATING_THRESHOLD` (3), verified by a literal fixture with `count=2` |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write the literal-fixture tests first: bucket boundaries, `overall`, threshold gating, validation, threshold-agreement, mean display
- [ ] Run tests and confirm failure (module does not exist yet)

### 2. Green Phase
- [ ] Add the minimal implementation (the backend DD's snippet, adapted only if a file-split choice requires it) to pass tests
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests) — e.g., confirm comments cross-referencing the SQL threshold literal are present and accurate
- [ ] Confirm added tests still pass

## Quality Assurance Mechanisms
- Vitest (node env) — Enforces: pure-function correctness — Config: `SOURCE/vitest.config.ts` (`include: lib/**, components/**`) — Covers: `SOURCE/lib/rating/**`
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: run `SOURCE/lib/rating/__tests__/rating.test.ts` under vitest (node env); each assertion uses a literal expected value computed independently of the implementation.
- **Success criteria**: all literal-fixture tests pass, including the boundary fixtures (3.9/4.0/6.9/7.0/1.0/10.0), `overall`/threshold/validation fixtures, and the `RATING_THRESHOLD===3` agreement assertion.
- **Failure response**: a failing fixture indicates a bucket/threshold/validation logic defect — fix before Task 4 depends on these helpers.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
(No skeleton test block covers these pure helpers directly; source = backend DD's own vitest fixture list per its Test Boundaries section and the ACs it traces to.)
- **Claim**: `bucket(mean)` classifies per `[1,4)`→Easy / `[4,7)`→Medium / `[7,10]`→Hard, with `4.0`/`7.0`/`10.0` landing correctly (AC-018).
  - **Primary failure mode**: an off-by-one boundary (e.g., `4.0` misclassified as Easy, or `7.0` as Medium).
  - **Boundary to exercise**: in-process unit (pure function call).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none — pure, no I/O.
  - **Residual**: none.
- **Claim**: `overall(p1,p2,p3)` equals the arithmetic mean of the three part scores (AC-003).
  - **Primary failure mode**: incorrect aggregation (e.g., sum instead of mean).
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: `communityDifficultyFrom` returns `null` iff `avgOverall` is `null` OR `ratingCount < RATING_THRESHOLD`, else `{bucket, mean, count}` (AC-014/015).
  - **Primary failure mode**: threshold off-by-one (`count===3` misclassified null, or `count===2` misclassified non-null).
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim**: `isValidPartScore` rejects non-integers and out-of-range values, accepts `1` and `10` inclusive (AC-002).
  - **Primary failure mode**: boundary values `0`/`11`/non-integer incorrectly accepted, or the valid boundary `1`/`10` incorrectly rejected.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (threshold-agreement, R-5 risk): `RATING_THRESHOLD === 3`, matching the view's SQL literal.
  - **Primary failure mode**: the TS constant drifts from the SQL view's hardcoded `3`, causing display/filter inconsistency between DB and client.
  - **Boundary to exercise**: in-process unit (static assertion), cross-referenced manually against `schema.sql`'s view definition (Task 1).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: this test cannot detect a future drift of the SQL literal without a corresponding code review; Task 2's RLS 2-vs-3-rating fixtures independently pin the SQL side.
- **Claim**: `formatMean` rounds to one decimal place for display (AC-014).
  - **Primary failure mode**: incorrect rounding/truncation or wrong precision.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [ ] All added tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Phase 0 completion (shared with Tasks 1 and 2): `SOURCE/lib/rating/` unit tests green, including the threshold-agreement test

## Investigation Notes
(Record the RATING_THRESHOLD/SQL-literal cross-reference evidence and each Compliance Check result here before marking complete.)

## Notes
- Impact scope: `SOURCE/lib/rating/` only in this task.
- Scope boundary: do not add `readoutModel`/`PART_META`/`rateErrorMessage`/`mapFromMyRating` here — those are frontend-owned additions to this same directory, made by Task 7, to avoid this task blocking on frontend decisions.
