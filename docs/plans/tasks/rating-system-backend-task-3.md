# Task 3 (Backend): `SOURCE/lib/rating/` pure helpers + unit tests

Metadata:
- Dependencies: none (independent of Task 1; can be TDD'd first per the backend DD's implementation order)
- Provides: `overall`/`bucket`/`communityDifficultyFrom`/`formatMean`/`isValidPartScore` + `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD`, consumed by Task 4 (read wiring), Task 6 (write validation), and Task 7 (frontend readout model additions to the same directory)
- Size: Small (2 files: `SOURCE/lib/rating/index.ts` + `SOURCE/lib/rating/__tests__/rating.test.ts`)

## Implementation Content
Implement the pure, side-effect-free helpers `overall`, `bucket`, `communityDifficultyFrom`, `formatMean`, `isValidPartScore`, and the `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD` constants exactly per the backend DD's Business Logic section (the DD contains ready-to-use TypeScript — paste, don't paraphrase). Add `SOURCE/lib/rating/__tests__/rating.test.ts` with literal-fixture tests: bucket boundaries (3.9/4.0/6.9/7.0/1.0/10.0), `overall`=mean, threshold gating, validation, threshold-agreement (`RATING_THRESHOLD===3` cross-referenced to the view's SQL literal), and mean display rounding.

## Target Files
- [x] `SOURCE/lib/rating/index.ts` (or `bucket.ts`/`constants.ts` — match whichever split the backend DD's snippet implies; a single `index.ts` is acceptable)
- [x] `SOURCE/lib/rating/__tests__/rating.test.ts`

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
- [x] Read all Investigation Targets and record key observations
- [x] Write the literal-fixture tests first: bucket boundaries, `overall`, threshold gating, validation, threshold-agreement, mean display
- [x] Run tests and confirm failure (module does not exist yet)

### 2. Green Phase
- [x] Add the minimal implementation (the backend DD's snippet, adapted only if a file-split choice requires it) to pass tests
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — e.g., confirm comments cross-referencing the SQL threshold literal are present and accurate
- [x] Confirm added tests still pass

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
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Phase 0 completion (shared with Tasks 1 and 2): `SOURCE/lib/rating/` unit tests green, including the threshold-agreement test

## Investigation Notes
(Record the RATING_THRESHOLD/SQL-literal cross-reference evidence and each Compliance Check result here before marking complete.)

- **Backend DD § Business Logic (lines 527-575)**: contains the exact ready-to-use TS snippet for `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD`, `Bucket`/`CommunityDifficulty` types, `isValidPartScore`, `overall`, `bucket`, `formatMean`, `communityDifficultyFrom`. Pasted verbatim into `SOURCE/lib/rating/index.ts` (single-file split — DD explicitly allows `index.ts` or a `bucket.ts`/`constants.ts` split; single `index.ts` chosen, matching the `lib/ugc/limits.ts` single-constants-file precedent).
- **Backend DD § Test Boundaries (lines 760-767)**: literal fixture list (bucket boundaries 3.9/4.0/6.9/7.0/1.0/10.0; `overall(3,3,3)→3`/`overall(7,8,9)→8`/`overall(1,1,4)→2`; threshold gating `communityDifficultyFrom(6.0,2)→null`/`(6.0,3)→{Medium,6,3}`/`(null,5)→null`; validation `isValidPartScore(0/11/5.5)→false`, `(1)/(10)→true`; `RATING_THRESHOLD===3`; `formatMean(7.24)→"7.2"`, `formatMean(7)→"7.0"`) — all reproduced literally in `rating.test.ts`.
- **`SOURCE/lib/scoring/computeScore.ts` + `__tests__/computeScore.test.ts`**: precedent confirmed — pure function, no I/O, `describe`/`it` literal-fixture style with Vietnamese test descriptions and a file-header comment explaining scope/versioning. `rating.test.ts` follows the same style (Vietnamese `describe`/`it` names, header comment).
- **`SOURCE/lib/ugc/limits.ts`**: precedent for centralized named numeric constants (`LIMITS` object with header comment referencing the Design Doc). `RATING_MIN`/`RATING_MAX`/`RATING_THRESHOLD` follow the same "named constant with rationale comment" spirit, kept as individual top-level exports per the DD's own snippet (DD does not group them into a `LIMITS`-style object for `lib/rating/`).
- **`SOURCE/vitest.config.ts:15`**: `include: ["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"]` — confirmed `lib/rating/__tests__/rating.test.ts` is collected (glob `**` matches nested `__tests__` dirs, same as `lib/scoring/__tests__/computeScore.test.ts`). Verified by running `npx vitest run lib/rating/__tests__/rating.test.ts` — 21/21 passed.

**RATING_THRESHOLD/SQL-literal cross-reference evidence**: Backend DD § `exams_with_difficulty` view (lines 428-450) defines `case when coalesce(agg.rating_count, 0) >= 3 then agg.avg_overall end` — the SQL literal `3`. `SOURCE/lib/rating/index.ts`'s `RATING_THRESHOLD = 3` carries a comment stating this is the SQL copy's TS counterpart ("Bản sao SQL nằm trong view exams_with_difficulty (số 3)"). `rating.test.ts`'s "threshold agreement" test asserts `RATING_THRESHOLD === 3` with a comment quoting the exact SQL `CASE WHEN` clause. Task 1/2 (schema.sql + RLS 2-vs-3-rating fixtures) independently pin the SQL side — no shared physical constant crosses the SQL/TS boundary (by design, per ADR-0008).

**Binding Decisions compliance**:
| Source | Axis | Planned approach | Evaluation | Rationale |
|---|---|---|---|---|
| ADR-0008 § Decision | placement | Implement `lib/rating/` as a pure module (no DB client, no `"use server"`, no React) exporting `bucket`/`formatMean`/`communityDifficultyFrom` alongside `overall`/`isValidPartScore` and the constants; no I/O anywhere in the file | Y | `SOURCE/lib/rating/index.ts` has zero imports beyond none (no imports at all) — no I/O, no side effects; all 5 functions are pure. |
| ADR-0008 § Implementation Guidance | contract_schema | Define `RATING_THRESHOLD = 3` once as the sole named constant in `lib/rating/`, referenced (not duplicated as a physical constant) by the SQL view's literal `3` via a cross-referencing comment; assert `RATING_THRESHOLD === 3` in a vitest test that also carries the cross-reference comment | Y | `RATING_THRESHOLD` is defined once in `index.ts` with a comment naming the view; `rating.test.ts`'s "threshold agreement" `describe` block asserts `RATING_THRESHOLD === 3` and quotes the SQL `CASE WHEN ... >= 3` clause in its test comment. |

**Reference Contracts compliance**:
| Source | Contract Type | Planned approach | Evaluation | Rationale |
|---|---|---|---|---|
| Backend DD § AC R6/R7/R8 (bucket) | derived-display | `bucket()` uses `if (mean < 4) return "Easy"; if (mean < 7) return "Medium"; return "Hard";` — half-open boundaries as specified | Y | Literal-fixture tests assert `bucket(3.9)→Easy`, `bucket(4.0)→Medium`, `bucket(6.9)→Medium`, `bucket(7.0)→Hard`, `bucket(1.0)→Easy`, `bucket(10.0)→Hard` — all pass (verified by `npx vitest run`). |
| Backend DD § AC R6/R7/R8 (null below threshold) | state-lifecycle-negative | `communityDifficultyFrom` returns `null` when `avgOverall === null` OR `ratingCount < RATING_THRESHOLD` | Y | Literal fixture `communityDifficultyFrom(6.0, 2)` (count=2 < 3) asserted `toBeNull()` — passes. |

## Notes
- Impact scope: `SOURCE/lib/rating/` only in this task.
- Scope boundary: do not add `readoutModel`/`PART_META`/`rateErrorMessage`/`mapFromMyRating` here — those are frontend-owned additions to this same directory, made by Task 7, to avoid this task blocking on frontend decisions.
