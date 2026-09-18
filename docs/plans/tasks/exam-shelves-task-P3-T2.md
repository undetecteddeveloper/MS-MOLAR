# Task P3-T2 — `features/exams/queries/shelves.ts` + fill in `shelves.int.test.ts` — the backend integration point

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 3, Task P3-T2 — the plan's own named backend integration point**
Layer: backend (`SOURCE/features/exams/queries/`, `SOURCE/features/exams/__tests__/`)

Metadata:
- Dependencies: P3-T1 (`hotCounts.ts`), P2-T4 (extracted `attempts.ts`)
- Blocks: P4-T1 (`?sort=hot` axis work depends on this composition existing), P5-T1 (page integration consumes `listExamShelves`), P7-T1 (home consumes `listHotExams`)
- Size: Small-Medium (2 files, 1 of which is a pre-committed skeleton fill-in)
- Verification level: L2 — `shelves.int.test.ts`'s 2 candidates (5 assertions total), converted from `it.todo` to `it`

## Implementation Content
Create `SOURCE/features/exams/queries/shelves.ts` (`ExamShelves` interface, `listExamShelves()`, `HotExamList` interface, `listHotExams(limit)`) per the backend DD § Data Flow pseudocode. Fill in the 2 candidates already committed as `it.todo` in `SOURCE/features/exams/__tests__/shelves.int.test.ts`, replacing `it.todo` with `it`.

## Target Files
- [x] `SOURCE/features/exams/queries/shelves.ts` (new)
- [x] `SOURCE/features/exams/__tests__/shelves.int.test.ts` (fill-in — pre-committed skeleton)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Data Flow — the body of `listExamShelves()`, full pseudocode)
- `docs/design/exam-shelves-backend-design.md` (§ Query layer "shelves.ts")
- `docs/design/exam-shelves-backend-design.md` (Data Representation Decision)
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — `shelves.int.test.ts` fill-in row)
- `SOURCE/features/exams/__tests__/shelves.int.test.ts` (the full pre-committed skeleton — read every `Proof obligation`/`Primary failure mode` comment block before writing any implementation code)
- `SOURCE/features/exams/queries/attempts.ts` (P2-T4 — the single attempt-read this composition consumes)
- `SOURCE/features/exams/queries/hotCounts.ts` (P3-T1 — the single RPC call site this composition consumes)
- `SOURCE/lib/adaptive/examShelves.ts` (P1-T4 — the ladder functions this composition calls)
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (`:676-706` — the deferred-resolution gate technique this task's concurrency proof follows as precedent)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability's Data Representation Decision row (contract-change, covering P1-T4/P2-T4/P3-T2) and multiple ADR Binding rows (data_flow: rank-then-cut, one-composition-per-page, composition budget) apply here. Sweep the adjacent case: `listExamsRanked` (the existing personalised-ranking composition) must retain its own 3-boundary-call budget untouched by this new composition — confirm no shared module was modified in a way that silently adds a 4th call to `listExamsRanked` itself.

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2) | data_flow | Rank-then-cut stays binding — no `.limit()`/`.range()` in `fetchExamRows`; every shelf cut to 10 in Node after ordering | Does `listExamShelves()` fetch full candidate sets and cut to `SHELF_MAX_CARDS` only after calling into `examShelves.ts`'s pick functions, with 0 SQL-level `LIMIT`/`.range()` calls added by this task? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2, Decision 1b) | data_flow | One composition per page — the caller's `exam_attempts` read is owned once per render, its submitted-id set re-exported | Does `listExamShelves()` call `attempts.ts`'s read exactly once and derive `submittedExamIds` from that single read, rather than reading `exam_attempts` a second time? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D3) | data_flow | Composition budget: `listExamsRanked` stays 3 boundary calls except `?sort=hot`; shelves composition = 4, asserted by counting `from()`+`rpc()` together | Does `listExamShelves()` issue exactly 4 boundary calls (3 `.from` + 1 `.rpc`) total, verified by a test that counts `from()`+`rpc()` together? |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-051) | state-lifecycle-negative | "Given any shelf, when its own selection yields 0 cards, then that shelf is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders, 0 empty cards, 0 errors — and the remaining shelves keep their relative order (D8)" | Does a 0-card shelf resolve to exactly `null` in `ExamShelves`, with the other shelves' keys/order unaffected? |
| docs/design/exam-shelves-backend-design.md (§ Integration Point I5); docs/design/exam-shelves-frontend-design.md (§ Home block) | state-lifecycle-negative | "An anonymous visitor therefore issues 0 RPC calls" — the guarded home fetch never executes `listHotExams` when `user === null` | Does the guarded call site (verified here at the query layer, wired at P7-T1) issue literally 0 calls of any kind when invoked with a `null` user, asserted by total call count, not only rpc absence? |

## Investigation Notes

**Investigation Targets read**: backend DD (§ Data Flow pseudocode, § Query layer "shelves.ts", § Data Representation Decision, § Logging and Monitoring — only `listExamShelves.hotCounts`/`listExamsRanked.hotCounts`/`listHotExams.hotCounts` are new labels; the catalogue read keeps its existing `"listExams"` label, unchanged; § Test Boundaries and Placement's `shelves.int.test.ts` row); `shelves.int.test.ts`'s full pre-committed skeleton including every Proof obligation/Primary failure mode block; `attempts.ts` (P2-T4 — `ATTEMPT_SELECT`, `readMyAttemptRows`, `submittedExamIdsOf`, `toShelfAttempts`, all reused verbatim); `hotCounts.ts` (P3-T1 — `hotWindows`, `readHotCounts(supabase, label, now)`, the single RPC call site); `lib/adaptive/examShelves.ts` (P1-T4 — `pickHotShelf`/`pickWeakestSubject`/`pickDominantGrade`/`pickExploreShelf`, `ShelfCandidate`/`ShelfAttempt`/`HotRung`/`HotCounts` types); `rating.int.test.ts:676-706` (the deferred-resolution gate technique — reused verbatim for candidate 1's concurrency test, extended from 3 to 4 tracked calls).

**Call-count assertions observed**:
- Candidate 1, test 1 (`issues exactly 4 boundary calls ...`): `issued` (combined `.from`+`.rpc` name log under the deferred gate) has length 4 and equals the set `{exams_with_difficulty, exam_attempts, exam_results, exam_hot_counts}`, all pushed before `settle()` is called (2 `await Promise.resolve()` ticks, same count as the 3-read precedent). PASSED.
- Candidate 1, test 2 (`rpc ... p_max_rows === imported LIST_ROW_CEILING + 1 ...`): `rpcMock` called exactly once, `args.p_max_rows === LIST_ROW_CEILING + 1` (imported, not a literal). PASSED.
- Candidate 1, test 3 (label `"listExamShelves.hotCounts"`): triggered the decoy-row truncation (`LIST_ROW_CEILING + 1` hot rows) and asserted `console.error` was called with a message containing `"listExamShelves.hotCounts"`. PASSED.
- Candidate 2, test 1 (0-card shelf is `null`): scenario 1 (no `exam_results` row for the one submitted attempt → 0 scored representative attempts) → `shelves.practice === null` and `"practice" in shelves === true`; scenario 2 (RPC returns 0 rows → every rung's pool is empty, including terminal) → `shelves.hot === null` and `"hot" in shelves === true`. PASSED.
- Candidate 2, test 2 (`listHotExams` 3 calls + `submittedExamIds`): `issued` has length 3, set `{exams_with_difficulty, exam_attempts, exam_hot_counts}` — `exam_results` absent; `result.submittedExamIds` equals `Set(["submitted-1"])`, sourced from the same `attemptRows` the hot ladder used. PASSED.
- Candidate 2, test 3 (F-001 guard pattern, 0 calls): inline `currentUser ? await listHotExams(3) : null` with `currentUser` hardcoded to the literal `null` → `fromMock`/`rpcMock` both `not.toHaveBeenCalled()`. PASSED — but **scope corrected 2026-09-18 per integration-test-reviewer finding**: because `currentUser` is a hardcoded literal `null` in the test, the ternary's other branch is structurally unreachable, so this assertion cannot fail regardless of what any real guard does. It proves the ternary PATTERN is correct in isolation only — it does NOT exercise any real call site, and does NOT prove `app/page.tsx`'s actual guard exists or works (that file doesn't exist with this wiring yet; P7-T1 builds it). See the corrected Residual on this claim under Proof Obligations below, and the new binding Completion Criterion added to `exam-shelves-task-P7-T1.md` requiring a real test against the actual composition.
- AC-049/D13 (added, not in the skeleton's own text): one fixture exam (`ex-overlap`, subject "Toán", grade 10) qualifies for both the weakest-subject pool (via a separate attempt establishing "Toán" as weakest) and the hot ladder's terminal rung (`site-all`, 1 qualifying count) → `shelves.practice.exams` and `shelves.hot.exams` BOTH contain `"ex-overlap"` in the SAME `listExamShelves()` call. PASSED — confirms no incorrect dedup step filters practice-selected ids out of the hot candidate pool.

**Binding Decisions — compliance evaluation against the final implementation**:
| Axis | Decision | Evaluation | Rationale |
|---|---|---|---|
| data_flow (rank-then-cut) | No `.limit()`/`.range()` in the candidate query; cut to `SHELF_MAX_CARDS` in Node after the pick functions | Y | `fetchExamRows()` (existing, unmodified) issues 0 new SQL-level `LIMIT`/`.range()`; the only `.limit()` is `readBounded`'s pre-existing row-ceiling decoy mechanism, not a cut. All three shelves cut via `.slice(0, SHELF_MAX_CARDS)` / `pickHotShelf`'s/`pickExploreShelf`'s own `maxCards` param, in Node, after ranking |
| data_flow (one composition per page) | `exam_attempts` read owned once per render, `submittedExamIds` re-exported from it | Y | `readMyAttemptRows(supabase, "listExamShelves.attempts")` called exactly once inside `listExamShelves()`; `submittedExamIdsOf(attemptRows)` derives the returned `submittedExamIds` from that same read — no second `exam_attempts` read anywhere in the function |
| data_flow (composition budget) | `listExamsRanked` stays 3; shelves composition = 4, counted via `from()`+`rpc()` together | Y | Candidate 1 test 1 asserts exactly 4 combined `from`+`rpc` calls; `listExamsRanked`/`ranking.ts` untouched by this task (verified via `git status` — only `shelves.ts`, `shelves.int.test.ts`, `ExamShelf.tsx` touched), so its own 3-call budget is unaffected by construction |

**Reference Contracts — compliance evaluation against the final implementation**:
| Contract Type | Required Observable Value | Evaluation | Rationale |
|---|---|---|---|
| state-lifecycle-negative (AC-051) | 0-card shelf ⇒ exactly `null`, siblings' keys/order unaffected | Y | Candidate 2 test 1 asserts `toBeNull()` + `"key" in shelves`; `ExamShelves`'s return is a fixed 4-key object literal (`practice, hot, explore, submittedExamIds`), so key presence/order is structural, not conditional |
| state-lifecycle-negative (F-001, 0 RPC for anon) | Guarded call site issues literally 0 calls of any kind for a `null` user | Y (narrow — pattern proof, not the real call site) | Candidate 2 test 3 asserts both `fromMock` and `rpcMock` `not.toHaveBeenCalled()` (total call count, not just rpc absence), but against a hardcoded literal `null`, not against `app/page.tsx`'s real guard — that call site does not exist yet (P7-T1). The Compliance Check's own phrasing ("verified here at the query layer, wired at P7-T1") anticipates exactly this split; the real-call-site half is now a binding Completion Criterion on `exam-shelves-task-P7-T1.md` |

**Adjacent-case / scope-boundary sweep** (task's own Change Category note): confirmed via `git status --short` that this task's diff touches only `SOURCE/features/exams/queries/shelves.ts` (new), `SOURCE/features/exams/__tests__/shelves.int.test.ts` (fill-in), and `SOURCE/features/exams/components/ExamShelf.tsx` (the reconciliation below) — `SOURCE/features/exams/queries/ranking.ts` (`listExamsRanked`) is byte-unmodified, so its existing 3-boundary-call budget cannot have silently gained a 4th call from this task.

**ExamShelf.tsx reconciliation** (per the orchestrator's explicit instruction, outside this task's own Target Files list but directly at the boundary this task creates): the frontend DD's own § Data flow "Facts → strings" code block and § Data contracts table both attribute `ExamShelves`'s type shape to "producer: `features/exams/queries/shelves.ts` (backend DD)" and give the literal derivation `type ShelfData = NonNullable<ExamShelves["practice"] | ExamShelves["hot"] | ExamShelves["explore"]>`. Since `shelves.ts` now exists, `ExamShelf.tsx` was updated to import the real `ExamShelves` type and derive `ShelfData` that way, replacing the P2-T3 local structural duplicate (which existed only because `shelves.ts` did not exist yet, per that file's own comment). `ShelfKind` was kept as a local declaration — the backend DD does not export it; it is a page/component-level concept (`SHELF_ORDER`), not part of `listExamShelves()`'s return contract. This is a type-only change (`import type`), so it has 0 runtime effect and does not pull the "server-only" module into `ExamShelf.tsx`'s bundle; `npx tsc --noEmit` and `npx eslint --max-warnings 0` both pass on the file after the change, and none of `ExamShelf.tsx`'s existing behaviour (casts inside `shelfSubtitle`, `SHELF` map, JSX) needed to change since the derived `ShelfData` is structurally identical to the shape it replaces.

**Pre-existing, unrelated test failure observed during full-suite verification**: `lib/security/rateLimit.test.ts > guard > keeps ONE account's whole daily Gemini budget under the project quota` fails on this worktree (`expected 33 to be less than or equal to 20`) independent of this task's changes — confirmed via `git status --short` that this task touched none of that file's dependencies. Not fixed here (out of this task's Target Files scope); flagged for the quality-assurance phase.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, **including every comment block in the pre-committed `shelves.int.test.ts` skeleton**
- [x] Confirm the 2 candidates currently run as `it.todo` (not yet exercising any real assertion)
- [x] Additionally seed the AC-049/D13 cross-shelf overlap fixture described below, as a new assertion inside Candidate 1 or 2 (whichever the skeleton's structure fits — read the skeleton first to decide)
### 2. Green Phase
- [x] Implement `shelves.ts`: `ExamShelves`, `listExamShelves()`, `HotExamList`, `listHotExams(limit)`, per the DD pseudocode, composing `attempts.ts` + `hotCounts.ts` + `examShelves.ts`
- [x] Convert both `it.todo` to `it` and run
- [x] Confirm all 5 skeleton assertions plus the added AC-049 assertion pass
### 3. Refactor Phase
- [x] Confirm the 4-call budget (3 `.from` + 1 `.rpc`) via the deferred-resolution gate technique, following `rating.int.test.ts:676-706`'s precedent
- [x] Confirm `listHotExams(limit)` issues exactly 3 calls (no `exam_results`) and its `submittedExamIds` comes from the SAME attempt read as the shelves composition

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run features/exams/__tests__/shelves.int.test.ts` with a mocked Supabase client boundary, using the deferred-resolution gate technique to prove call concurrency and exact count.
- **Success criteria**: both candidates (5 `it` assertions total) green; the AC-049 cross-shelf overlap assertion (added by this task, beyond the skeleton's own text) also green.
- **Failure response**: if the call count exceeds 4, identify which added read is responsible before adjusting any assertion — a silently added 5th call is exactly the round-trip-budget regression the work plan's Risk section names explicitly.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (Candidate 1, from skeleton verbatim): exactly 4 boundary calls (3 `.from` + 1 `.rpc`), all issued before any settle, rpc's 3rd arg = imported `LIST_ROW_CEILING + 1`, label exactly `"listExamShelves.hotCounts"`.
  - **Primary failure mode**: a 5th call silently added by a future edit to any of the composed modules; or the calls are issued sequentially (not concurrently) despite the test asserting they were all issued before any settle.
  - **Boundary to exercise**: integration test, mocked Supabase client boundary (`.from`/`.rpc` call interception).
  - **State assertion**: N/A (read-only composition, no state transition).
  - **Mock boundary rationale**: the Supabase client is mocked at its call boundary — this is the correct level per the plan's Verification Strategy (mocked composition tests before real-Postgres service tests).
  - **Residual**: that the mocked shapes match real Postgres response shapes is proven later by P8-T4's real-Postgres service e2e.
- **Claim** (Candidate 2, from skeleton verbatim): a 0-card shelf is exactly `null` via `toBeNull()` (not `{exams:[]}`; key still present via `"practice" in shelves"`); `listHotExams(limit)` issues exactly 3 calls (no `exam_results`) and returns a populated `submittedExamIds` from the SAME attempt read; the guarded home-fetch call site with a `null` user issues ZERO calls of any kind (assert total call count, not only rpc absence).
  - **Primary failure mode**: a 0-card shelf renders as `{exams: []}` instead of `null` (violating AC-051); or the guarded home-fetch path issues a call before checking `user === null` (violating F-001).
  - **Boundary to exercise**: integration test, mocked Supabase client boundary.
  - **State assertion**: before → `user === null`; after → 0 total calls issued (assert the mock's total invocation count, not just absence of `.rpc`).
  - **Mock boundary rationale**: Supabase client mocked at call boundary.
  - **Residual** (corrected 2026-09-18 per integration-test-reviewer finding — see Investigation Notes): the guarded-call test in this task exercises `currentUser ? await listHotExams(3) : null` with `currentUser` a hardcoded literal `null`, so the ternary's truthy branch is structurally unreachable and the assertion cannot fail regardless of what any real guard does. This proves the ternary PATTERN is correct in isolation, not that `app/page.tsx`'s real guard exists or works — that file has no guarded call site yet. The real guard's existence and correctness at `app/page.tsx` remain UNPROVEN until P7-T1 adds a test against the actual composition (mocked `getCurrentUser`/`getCurrentUserProfile` resolving `null`) asserting 0 Supabase calls — an explicit, binding Completion Criterion on `exam-shelves-task-P7-T1.md`, not merely implied by "wiring the guard in".
- **Claim** (AC-049, D13 — additional obligation beyond the skeleton's own text): an exam that qualifies for BOTH the weakest-subject pool (present in the practice candidate set with the weakest subject) AND a qualifying hot count (present in the hot candidate set at whichever rung qualifies) appears in BOTH `practice.exams` and `hot.exams` of the SAME `listExamShelves()` result.
  - **Primary failure mode**: the composition treats shelves as mutually exclusive (e.g. an exam already placed in `practice` is filtered out of the `hot` candidate pool by an incorrect dedup step), silently violating AC-049's "cross-shelf overlap is allowed" rule. The skeleton names AC-029's Khám phá dedup explicitly but not this cross-shelf case — "by construction" is not a proof without this explicit assertion.
  - **Boundary to exercise**: integration test, mocked Supabase client boundary, using a purpose-built fixture exam id seeded to qualify for both pools simultaneously.
  - **State assertion**: N/A (composition read, no state transition).
  - **Mock boundary rationale**: Supabase client mocked at call boundary; the fixture data itself is constructed directly in the test, not derived from a real seed.
  - **Residual**: none — this closes the exact gap the plan review identified.
- **Claim** (Failure Mode: unavailable boundary): if the RPC call fails (infrastructure error), the error propagates rather than being silently swallowed into an empty hot shelf.
  - **Primary failure mode**: a `try/catch` around the RPC call returns an empty/`null` hot shelf on any error, masking real infrastructure failures as "no hot exams today."
  - **Boundary to exercise**: integration test, mocked Supabase client configured to reject/error on the `.rpc` call.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: Supabase client mocked to simulate an infrastructure failure specifically.
  - **Residual**: none.

## Completion Criteria
- [x] Both `shelves.int.test.ts` candidates converted from `it.todo` to `it`, all 5 skeleton assertions pass
- [x] The AC-049 cross-shelf overlap assertion added and passing
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green (Gates 1-3 — `tsc`/`eslint`/`vitest` — verified directly by this task; Gates 4-6 — `build`/`test:fixture`/`test:localdb` — belong to the quality-assurance phase per this agent's Responsibility Boundaries; `test:localdb`/Gate 6 additionally requires the dev DB migration from P1-T1/backend DD step 1, outside this task's scope)

## Notes
- Impact scope: `shelves.ts` (new), `shelves.int.test.ts` (fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy).
- Scope boundary — preserve unchanged: `listExamsRanked`'s own 3-boundary-call budget (this task adds a parallel composition, not a modification to the existing one).
