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
- [ ] `SOURCE/features/exams/queries/shelves.ts` (new)
- [ ] `SOURCE/features/exams/__tests__/shelves.int.test.ts` (fill-in — pre-committed skeleton)

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
_(Record here: the exact call-count assertions observed for Candidate 1 and Candidate 2; confirmation the AC-049 additional obligation's cross-shelf overlap fixture was seeded and its assertion passed.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, **including every comment block in the pre-committed `shelves.int.test.ts` skeleton**
- [ ] Confirm the 2 candidates currently run as `it.todo` (not yet exercising any real assertion)
- [ ] Additionally seed the AC-049/D13 cross-shelf overlap fixture described below, as a new assertion inside Candidate 1 or 2 (whichever the skeleton's structure fits — read the skeleton first to decide)
### 2. Green Phase
- [ ] Implement `shelves.ts`: `ExamShelves`, `listExamShelves()`, `HotExamList`, `listHotExams(limit)`, per the DD pseudocode, composing `attempts.ts` + `hotCounts.ts` + `examShelves.ts`
- [ ] Convert both `it.todo` to `it` and run
- [ ] Confirm all 5 skeleton assertions plus the added AC-049 assertion pass
### 3. Refactor Phase
- [ ] Confirm the 4-call budget (3 `.from` + 1 `.rpc`) via the deferred-resolution gate technique, following `rating.int.test.ts:676-706`'s precedent
- [ ] Confirm `listHotExams(limit)` issues exactly 3 calls (no `exam_results`) and its `submittedExamIds` comes from the SAME attempt read as the shelves composition

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
  - **Residual**: none for the guarded-call proof; the wiring of this guard into the real home page call site is P7-T1's.
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
- [ ] Both `shelves.int.test.ts` candidates converted from `it.todo` to `it`, all 5 skeleton assertions pass
- [ ] The AC-049 cross-shelf overlap assertion added and passing
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `shelves.ts` (new), `shelves.int.test.ts` (fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy).
- Scope boundary — preserve unchanged: `listExamsRanked`'s own 3-boundary-call budget (this task adds a parallel composition, not a modification to the existing one).
