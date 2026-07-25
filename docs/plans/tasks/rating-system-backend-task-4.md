# Task 4 (Backend): Backend read-model wiring (listExams/getExam/view, hardest/level, listMySubmittedExamIds)

Metadata:
- Dependencies: `rating-system-backend-task-1.md` (view/RPC must exist), `rating-system-backend-task-3.md` (`communityDifficultyFrom` etc.)
- Provides: `Exam.communityDifficulty`, `ExamSort='hardest'`, `ExamFilters.level`, `listMySubmittedExamIds()` — the read-model surface `rating-system-frontend-task-5.md` consumes
- Size: Medium (3 files: `SOURCE/types/exam.ts`, `SOURCE/app/(layer2)/queries.ts`, `SOURCE/app/(layer2)/__tests__/rating.int.test.ts`)

## Implementation Content
`ExamRow`/`EXAM_COLUMNS`/`toExam` gain `avg_overall`/`rating_count` → `Exam.communityDifficulty` (`SOURCE/types/exam.ts` + `SOURCE/app/(layer2)/queries.ts`); `listExams`/`getExam` read `exams_with_difficulty` (or the RPC fallback) with `.eq('status','published')` preserved; `ExamSort` gains `'hardest'` (`.order('avg_overall',{ascending:false,nullsFirst:false}).order('created_at').order('id')`); `ExamFilters` gains `level` (`.gte/.lt` per bucket); add `listMySubmittedExamIds()`. Convert integration Test 2 (`rating.int.test.ts`) into a real vitest test against a mocked Supabase query-builder chain.

**Known gap to resolve first**: `SOURCE/vitest.config.ts`'s `include` glob (`["lib/**/*.test.{ts,tsx}", "components/**/*.test.{ts,tsx}"]`) does not currently collect `SOURCE/app/(layer2)/__tests__/**`, where `rating.int.test.ts` lives, and `npm test` runs `vitest run` against that config. Extend the `include` glob (or confirm/introduce the project's actual mechanism for running app-layer integration tests) before asserting Test 2 passes under `npm test` — this decision is shared with Tasks 6 and 8, which convert the other two blocks in the same file; do not have them re-decide it.

## Target Files
- [x] `SOURCE/types/exam.ts` (`Exam.communityDifficulty`)
- [x] `SOURCE/app/(layer2)/queries.ts` (`ExamRow`/`EXAM_COLUMNS`/`toExam`, `listExams`/`getExam`, `ExamSort`, `ExamFilters`, `listMySubmittedExamIds`)
- [x] `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (convert Test 2 only)
- [x] `SOURCE/vitest.config.ts` (extend `include` if needed to collect the integration test — resolve the known gap above)

## Investigation Targets
- `SOURCE/app/(layer2)/queries.ts:30-47` (`EXAM_COLUMNS`/`toExam` — single mapping point to extend)
- `SOURCE/app/(layer2)/queries.ts:52-89` (`ExamSort`/`ExamFilters`/`listExams` — sort/filter extension point)
- `SOURCE/app/(layer2)/queries.ts:128-138` (`getExam`)
- `SOURCE/types/exam.ts` (existing `Exam` type to extend)
- `docs/design/rating-system-backend-design.md` (§ Data Flow — Read (catalog/detail/sort/filter))
- `docs/design/rating-system-backend-design.md` (§ Data Contracts — `ExamRow`/`EXAM_COLUMNS`/`toExam` deltas; Read model — `Exam.communityDifficulty`; `listMySubmittedExamIds`)
- `docs/design/rating-system-backend-design.md` (§ Field Propagation Map)
- `docs/design/rating-system-backend-design.md` (§ Minimal Surface Alternatives (Element 2 & 4))
- `docs/design/rating-system-backend-design.md` (§ Interface Change Matrix)
- `docs/design/rating-system-backend-design.md` (§ Data Representation Decision)
- `docs/design/rating-system-backend-design.md` (§ Security Considerations)
- `docs/design/rating-system-backend-design.md` (§ Integration Point Map)
- `docs/design/rating-system-frontend-design.md` (§ IP-6 Level param spelling alignment — `docs/design/rating-system-frontend-design.md`'s Field Propagation Map row for `level`) — confirms the lowercase `easy|medium|hard` enum
- `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (Test 2 skeleton block)
- `SOURCE/app/(layer2)/_components/ExamFilters.tsx` (Connection Map: other side of the `level`/`sort` URL boundary — read-only awareness; Task 5 owns edits here)
- `SOURCE/app/(layer2)/exams/page.tsx` (Connection Map: other side of the `level`/`sort` URL boundary — read-only awareness; Task 5 owns edits here)
- `SOURCE/vitest.config.ts:15` (`include` glob — the known gap to resolve)

## Change Category
`Change Category: boundary-change, bug-fix`

`listExams`/`getExam`/`Exam`/`ExamSort`/`ExamFilters` are existing public contracts being extended (boundary-change), and the current `hardest` sort value is already a documented no-op (`queries.ts:51`, "`hardest` TẠM BỎ QUA (chờ rating)") that this task must make actually functional (bug-fix regression guard). Sweep: confirm the pre-existing `newest`/`oldest` sorts and `subject`/`grade`/`school`/`schoolYear`/`semester` filters are unaffected by the relation swap (Proof Obligation 3 below); confirm no pre-existing `Exam` field is dropped or renamed for below-threshold exams (Proof Obligation 4 below, Output Comparison in the backend DD).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0008-exam-difficulty-rating-and-on-read-aggregation.md (§ Decision) | data_flow | Community difficulty is computed on-read only; no denormalized cache column on `exams`, no trigger, no backfill | `listExams`/`getExam` read `communityDifficulty` only via the view/RPC read path — no write to any `exams` column and no client-side aggregate merge in `queries.ts` |
| docs/adr/ADR-0008-exam-difficulty-rating-and-on-read-aggregation.md (§ Implementation Guidance) | placement | Never merge a per-exam aggregate in JS and then order/filter by it — ordering/threshold/filtering must stay DB-side (view or RPC) | `listExams` performs ordering/threshold/filtering exclusively via chained Supabase query-builder calls (`.order`/`.gte`/`.lt`) against the view/RPC — no JS-side sort/filter of the aggregate |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/rating-system-backend-design.md (§ Acceptance Criteria R6/R7/R8) | derived-display | "bucket follows [1,4)→Easy / [4,7)→Medium / [7,10]→Hard (4.0→Medium, 7.0→Hard, 10.0→Hard)" | `toExam` maps `avg_overall`/`rating_count` through `communityDifficultyFrom` (Task 3) without re-deriving the bucket logic locally |
| docs/design/rating-system-backend-design.md (§ Acceptance Criteria R6/R7/R8) | state-lifecycle-negative | "While an exam has < 3 ratings, `communityDifficulty` shall be `null` (frontend renders `"—"`)." | `toExam` maps `avg_overall=null` (or `rating_count<3`) to `Exam.communityDifficulty=null` |
| docs/design/rating-system-backend-design.md (§ Data Flow) | derived-display | "hardest -> .order('avg_overall',{ascending:false,nullsFirst:false}).order('created_at').order('id')" | `listExams({sort:'hardest'})` issues `.order('avg_overall',{ascending:false,nullsFirst:false}).order('created_at').order('id')` in that exact chained order |
| docs/design/rating-system-backend-design.md (§ Data Flow) | derived-display | "level filter: Easy -> .gte('avg_overall',1).lt('avg_overall',4) ; Medium -> .gte(4).lt(7) ; Hard -> .gte('avg_overall',7)" | `listExams({level:'easy'\|'medium'\|'hard'})` issues the exact `.gte`/`.lt` boundary pair per bucket |

## Investigation Notes
(Record the vitest.config.ts resolution decision, and each Binding Decision / Reference Contract Compliance Check result, here before marking complete.)

**Investigation Targets — key observations:**
- `queries.ts:30-47` (pre-change): `ExamRow`/`EXAM_COLUMNS`/`toExam` are the single mapping point (as the task description states); `EXAM_COLUMNS` was a plain comma string selected from `"exams"`; `toExam` maps every snake_case DB column to a camelCase `Exam` field with `?? undefined` for nullable DB columns.
- `queries.ts:52-89` (pre-change): `listExams` built the query via `let query = supabase.from("exams").select(EXAM_COLUMNS).eq("status","published")` then conditionally chained `.eq(...)` for subject/grade/school/schoolYear/semester, then a 3-branch sort (`newest`/`oldest`/default `.order("id")`); `hardest` was not a member of `ExamSort` (comment: "hardest TẠM BỎ QUA (chờ rating)") — confirms AC-019/020 was a documented no-op before this task.
- `queries.ts:128-138` (pre-change, `getExam`): same shape as `listExams`, single-row `.maybeSingle()` against `"exams"`.
- `types/exam.ts` (pre-change): every prior additive field (`school?`, `schoolYear?`, `semester?`, `authorDisplayName?`, `parts?`) is TS-optional; none of the existing fields is required-added.
- Backend DD Data Flow / Data Contracts / Field Propagation Map / Interface Change Matrix / Data Representation Decision / Minimal Surface Alternatives / Security Considerations / Integration Point Map: read and applied verbatim — the exact `.gte`/`.lt`/`.order` chains implemented below are copied from § Data Flow's Read block, not re-derived.
- Frontend DD § IP-6 (Field Propagation Map row for `level`): confirms `level` is the lowercase slug `easy|medium|hard` on the URL boundary (RESOLVED, backend DD already matches) — implemented `ExamLevel = "easy"|"medium"|"hard"` accordingly.
- `rating.int.test.ts` Test 2 skeleton: proof obligations (a)-(c) transcribed into real `it` blocks; obligation (d) (byte-identical below-threshold `Exam`) added per this task's own Proof Obligations section.
- `SOURCE/lib/ugc/__tests__/extractMeta.test.ts`/`extractors.test.ts`: repo-wide precedent for stubbing `server-only` in vitest (`vi.mock("server-only", () => ({}))`) — followed verbatim since `queries.ts` imports `server-only` and would otherwise throw when loaded under plain Node/vitest (no `react-server` condition).
- `ExamFilters.tsx`/`exams/page.tsx` (read-only awareness only, Task 5 owns edits): both currently reference only `sort`/existing filters; no `level` wiring yet — confirms this task does not need to touch them.

**vitest.config.ts known-gap resolution:** extended `include` to add `"app/**/*.test.{ts,tsx}"` alongside the existing `"lib/**/*.test.{ts,tsx}"` and `"components/**/*.test.{ts,tsx}"` globs. This collects `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (and any future `app/**/__tests__` test the same file gains when Tasks 6/8 convert Test 1/Test 3) without narrowing to one file path — shared decision, not to be re-litigated by Tasks 6/8. Verified: `npx vitest run app` now collects and passes the 9 Test 2 cases; `npm test` (`vitest run`, full `SOURCE` root) also collects and runs them (see Operation Verification below).

**Binding Decisions — Compliance Check evaluation:**
- Row 1 (ADR-0008 § Decision, `data_flow` axis — community difficulty computed on-read only, no denormalized cache/trigger/backfill): planned approach — `listExams`/`getExam` read `communityDifficulty` exclusively via `communityDifficultyFrom(row.avg_overall, row.rating_count)` inside `toExam`, sourced from the `exams_with_difficulty` view's two selected columns; no write to any `exams` column anywhere in this task's diff, no client-side aggregate merge (the aggregate arrives pre-computed from the view). Evaluation: **Y** — grep of the diff confirms no `.update`/`.insert` on `exams`, and `toExam` only reads `row.avg_overall`/`row.rating_count`, never recomputes an aggregate from multiple raw rating rows in JS.
- Row 2 (ADR-0008 § Implementation Guidance, `placement` axis — ordering/threshold/filtering must stay DB-side): planned approach — `hardest` sort and `level` filter are implemented exclusively as chained `.order`/`.gte`/`.lt` calls on the Supabase query builder against `exams_with_difficulty`; no `.filter()`/`.sort()`/`.reduce()` JS-side post-processing of the returned rows anywhere in `listExams`. Evaluation: **Y** — confirmed by reading the final `listExams` body: the only JS-side step after `await query` is `.map(toExam)`, which is a per-row field transform, not an aggregate-based sort/filter.

**Reference Contracts — Compliance Check evaluation:**
- Row 1 (derived-display, bucket mapping via `communityDifficultyFrom`): planned approach — `toExam` calls `communityDifficultyFrom(row.avg_overall, row.rating_count)` (imported from `@/lib/rating`), no local re-implementation of `bucket()`/threshold comparison. Evaluation: **Y** — verified by reading `toExam`'s single line; also covered by the added test "at-threshold row … maps … through communityDifficultyFrom" (`communityDifficultyFrom(6.0,3) → {bucket:"Medium",mean:6.0,count:3}`, matching `SOURCE/lib/rating`'s own fixture).
- Row 2 (state-lifecycle-negative, `avg_overall=null` → `communityDifficulty=null`): planned approach — same `communityDifficultyFrom` call; the helper itself (Task 3, already unit-tested) returns `null` when `avgOverall===null` or `ratingCount<RATING_THRESHOLD`. Evaluation: **Y** — verified by the added test "below-threshold row (rating_count<3) maps to communityDifficulty:null …", which passed.
- Row 3 (derived-display, exact `hardest` `.order` chain): planned approach — literal `.order("avg_overall",{ascending:false,nullsFirst:false}).order("created_at").order("id")`, copied verbatim from backend DD § Data Flow. Evaluation: **Y** — verified by the added test asserting `orderCalls` equals exactly that 3-call sequence in that order; test passed.
- Row 4 (derived-display, exact `.gte`/`.lt` boundary pairs per bucket): planned approach — `LEVEL_RANGES` table `{easy:{gte:RATING_MIN(=1),lt:4}, medium:{gte:4,lt:7}, hard:{gte:7}}`. Evaluation: **Y** — verified by the added parametrized test (`easy`→gte 1/lt 4, `medium`→gte 4/lt 7) and the separate `hard` test (gte 7, no `.lt` call); all passed.

**Change Category sweep (boundary-change, bug-fix) — Proof Obligation 3/4 baselines and results:**
- Baseline (pre-change, recorded above): `newest`/`oldest`/no-filter chains and the below-threshold `Exam` shape (no `communityDifficulty` field at all, since the field didn't exist).
- Post-change: added tests assert `newest`/`oldest`/no-sort-no-level chains contain no `gte`/`lt` calls and the same `.order` call as before (`created_at` desc/asc, or `.order("id")`), i.e. unaffected by the relation swap or the 2 new selected columns — all passed (Proof Obligation 3, AC-023 continuity).
- Post-change: added test asserts a below-threshold fixture row maps to an `Exam` object whose every pre-existing field is byte-identical to what `toExam` would have produced pre-change, plus the additive `communityDifficulty: null` — passed via `toEqual` on the full object (Proof Obligation 4, backend DD Output Comparison).

**Design decision beyond the task's literal text — `Exam.communityDifficulty` typed optional (`?:`), not required:** the backend DD's Data Contract writes the type without a TS `?` modifier. Making it a *required* field broke `tsc --noEmit` on `SOURCE/lib/fake-data/exams.ts` (a GĐ1 "TẠM THỜI" fixture, still consumed by `supabase/seed.ts` and a `RichText` regression test, typed as `Exam[]`), which is out of this task's Target Files. Every other additive `Exam` field in the codebase (`school?`, `schoolYear?`, `semester?`, `authorDisplayName?`, `parts?`) is optional — Reference Representativeness check confirms this is the repo-wide, not just nearby, convention for this exact interface. Chose optional: (1) matches the established pattern for every prior additive field on this interface, (2) `toExam` (the sole producer this task's Reference Contracts govern) always assigns the field explicitly to `null` or the computed object — never omits it — so the Reference Contracts' "null exactly when …" guarantee holds byte-for-byte regardless of the TS modifier, (3) avoids an edit to an out-of-scope file for a purely mechanical, non-functional compile fix. Did not touch `lib/fake-data/exams.ts`.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Resolve the `vitest.config.ts` known gap (see above) so the converted Test 2 can actually run under `npm test`
- [x] Sweep the adjacent cases per Change Category: confirm what the current `newest`/`oldest`/no-filter query chain looks like (so Proof Obligation 3 has a concrete "before" baseline) and what the current below-threshold `Exam` shape looks like (so Proof Obligation 4 has a concrete baseline)
- [x] Review dependency deliverables: Task 1's view/RPC column names; Task 3's `communityDifficultyFrom`/`bucket`/`formatMean` signatures
- [x] Convert Test 2's skeleton comments into real `describe`/`it` blocks against a mocked Supabase query-builder chain; run and confirm failure (module/branches don't exist yet)

### 2. Green Phase
- [x] Add the minimal `queries.ts`/`types/exam.ts` changes to pass the converted Test 2
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — confirm `EXAM_COLUMNS` selects from the view/RPC consistently between `listExams` and `getExam`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: run the converted `rating.int.test.ts` Test 2 as a real vitest test against a mocked Supabase query-builder chain, comparing exact call arguments to the backend DD's Data Flow spec; separately verify field-by-field that pre-existing `Exam` fields are unchanged for below-threshold fixtures (Output Comparison).
- **Success criteria**: Test 2 passes; the `.order`/`.gte`/`.lt` call sequences match verbatim; below-threshold `Exam` objects are byte-identical to pre-change fixtures except for the added `communityDifficulty: null` field.
- **Failure response**: a query-construction mismatch blocks Task 5 (the frontend depends on this read model) — fix `listExams`/`getExam` before proceeding.
- **Verification level**: L2 (new tests added and passing); contributes to the Phase 1 L1 Early Verification Point that Task 5 completes.

## Proof Obligations
(Source: skeleton `rating.int.test.ts` Test 2 proof obligations (a)-(c), plus Failure Mode Checklist entries `no-op`, `empty input`, `shared-state dependency`, `missing-sort-key ordering` mapped to this task.)
- **Claim**: `sort:"hardest"` constructs the exact chained nulls-last order, fixing the previous `?hardest=1` no-op (AC-019/020).
  - **Primary failure mode**: `sort:"hardest"` omits `nullsFirst:false` or the chained secondary `.order("created_at").order("id")` tie-break (no-op / missing-sort-key regression).
  - **Boundary to exercise**: integration — mocked Supabase query-builder chain (sanctioned mock per backend DD Test Boundaries; real Postgres ordering semantics are proven by Task 1's spike and Task 9-backend's SE2).
  - **State assertion**: N/A (query construction, not persisted state).
  - **Mock boundary rationale**: the Supabase query-builder chain is mocked — this test proves only JS call construction; real Postgres NULL/order semantics are out of scope here.
  - **Residual**: real nulls-last/tie-break behavior is proven by Task 1's spike and Task 9-backend's SE2, not by this mocked test.
- **Claim**: the `level` bucket filter constructs the exact `.gte`/`.lt` boundary pair per bucket and preserves `.eq('status','published')` (AC-017/021); NULL (below-threshold, 0/1/2-rating) exams are excluded for free via SQL NULL comparison semantics.
  - **Primary failure mode**: a level bucket's `.gte`/`.lt` pair does not match `[1,4)`/`[4,7)`/`[7,10]`, or the published guard is dropped when the source relation swaps to the view.
  - **Boundary to exercise**: integration — mocked Supabase query-builder chain.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: real NULL-exclusion semantics proven by Task 1's spike (S3) and Task 9-backend's SE2, not by this mocked test.
- **Claim**: `sort:"newest"`/`"oldest"` and no level filter leave the pre-existing query chain unchanged (AC-023 continuity, regression guard for the Change Category sweep).
  - **Primary failure mode**: the view-relation swap or the two new selected columns accidentally alter unrelated newest/oldest/no-filter query construction.
  - **Boundary to exercise**: integration — mocked Supabase query-builder chain.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim**: `toExam` maps `avg_overall`/`rating_count` to `Exam.communityDifficulty` additively — every pre-existing `Exam` field stays byte-identical for below-threshold exams (AC-023 no-regression; backend DD Output Comparison).
  - **Primary failure mode**: the view/column swap silently drops or renames a pre-existing `Exam` field, or `communityDifficulty` is populated for a `<3`-rating exam.
  - **Boundary to exercise**: integration — mocked Supabase query-builder chain returning a fixture row.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same.
  - **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] The `vitest.config.ts` known gap is resolved and recorded (extended include glob, or documented alternative mechanism)

## Notes
- Impact scope: `SOURCE/types/exam.ts`, `SOURCE/app/(layer2)/queries.ts`, the Test 2 block of `rating.int.test.ts`, and (if needed) `SOURCE/vitest.config.ts`.
- Scope boundary: do not modify `ExamFilters.tsx`/`ExamBrowser.tsx`/`exams/page.tsx` here — those are Task 5's frontend-side edits; this task only changes what `listExams`/`getExam` accept and return.
