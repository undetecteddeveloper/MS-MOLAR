# Task P4-T3 — Fill in `rating.int.test.ts` candidate 3/3 (append-only, lines 748-833)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 4, Task P4-T3**
Layer: backend (`SOURCE/features/exams/__tests__/`)

Metadata:
- Dependencies: P4-T2 (the branch this fills in tests for)
- Blocks: none downstream within Phase 4 (Phase 5's `page.tsx` work does not depend on this test file)
- Size: Small (1 file, append-only)
- Verification level: L2

## Implementation Content
Fill in the appended block at the end of `SOURCE/features/exams/__tests__/rating.int.test.ts` (candidate 3/3, lines 748-833, already committed as `it.todo`) — replace with real `it` assertions. Do **not** touch lines 1-747.

## Target Files
- [ ] `SOURCE/features/exams/__tests__/rating.int.test.ts` (append-only — lines 748-833 only)

## Investigation Targets
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (`:748-833` the full pre-committed skeleton — read every `Proof obligation`/`Primary failure mode` comment block before writing any assertion; `:1-747` the region that must remain byte-identical)
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — `rating.int.test.ts` changed (budget candidate 3/3) row)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D3 — composition budget, the CI assertion that moves with it)
- `SOURCE/features/exams/queries/ranking.ts` (P4-T2's hot branch — the implementation under test)
- `SOURCE/lib/adaptive/constants.ts` (`LIST_ROW_CEILING`, `POSTGREST_MAX_ROWS` — the constants this task's clamp assertion must import, never hand-copy)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D3) | data_flow | Composition budget: `listExamsRanked` stays 3 boundary calls except `?sort=hot`; shelves composition = 4, asserted by counting `from()`+`rpc()` together | Does the `?sort=hot` case assert exactly 3 `.from` + 1 `.rpc("exam_hot_counts", ...)` calls, counted together, not asserted separately? |

## Investigation Notes
_(Record here: the exact literal expected hot-order array used, and confirmation it was independently computed from `total_count DESC, exam id ASC` rather than derived by running the implementation and copying its output; confirmation `git diff` shows 0 changes to lines 1-747.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton at `:748-833`
- [ ] Confirm the block currently runs as `it.todo`
- [ ] Independently compute the expected hot-order literal array from `total_count DESC, exam id ASC` over the test's fixture data, **without** running the implementation first
### 2. Green Phase
- [ ] Replace `it.todo` with real `it` assertions per the skeleton's comment blocks
- [ ] Run and confirm all pass
### 3. Refactor Phase
- [ ] Run `git diff -- SOURCE/features/exams/__tests__/rating.int.test.ts` and confirm 0 changes outside lines 748-833
- [ ] Confirm the AC-016/AC-017 cases above line 747 still pass unmodified in this same commit

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run features/exams/__tests__/rating.int.test.ts`; `git diff` restricted to this file, confirming only lines 748-833 changed.
- **Success criteria**: both skeleton obligations pass; `git diff` shows 0 changes to lines 1-747.
- **Failure response**: if satisfying the new assertions requires editing lines 1-747 (e.g. a shared mock needs adjustment), STOP — that signals the hot branch's implementation (P4-T2) has a dependency on shared test state it shouldn't, and the fix belongs in P4-T2's implementation, not in this test file's shared region.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (from skeleton, verbatim): `?sort=hot` issues exactly 3 `.from` + 1 `.rpc("exam_hot_counts", ...)`, and the returned `exams` order matches a LITERAL expected array independently computed from `total_count DESC, exam id ASC`.
  - **Primary failure mode**: the call-count assertion passes by coincidence while the order assertion is derived from running the implementation and copying its output (a snapshot-in-disguise that would pass even if the ordering logic were wrong).
  - **Boundary to exercise**: integration test, mocked Supabase client boundary (this file's established mock boundary, unchanged).
  - **State assertion**: N/A (read-only query, no state transition).
  - **Mock boundary rationale**: Supabase client mocked at its established `rating.int.test.ts` boundary.
  - **Residual**: that this literal-array approach generalizes to real Postgres data (not just the fixture) is out of this task's scope — the fixture is illustrative, not exhaustive.
- **Claim** (F-005, invalid option): `?sort=<value not in ExamSort>` issues exactly 3 `.from` and 0 `.rpc` calls.
  - **Primary failure mode**: an unrecognised sort value accidentally falls through to the hot branch (e.g. a loose string comparison), issuing an unnecessary RPC call for garbage input.
  - **Boundary to exercise**: integration test, mocked Supabase client boundary.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: Supabase client mocked at call boundary.
  - **Residual**: none.
- **Claim**: the AC-016/AC-017 cases above line 747 still pass unmodified in this same commit.
  - **Primary failure mode**: an accidental shared-state leak between the new candidate-3 block and earlier candidates in the same file (e.g. a shared mock not reset between test blocks).
  - **Boundary to exercise**: integration test, full-file run.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none beyond the existing established boundary.
  - **Residual**: none.

## Completion Criteria
- [ ] Both skeleton obligations converted from `it.todo` to `it` and passing
- [ ] `git diff` confirms 0 changes to lines 1-747
- [ ] AC-016/AC-017 cases above line 747 pass unmodified in this same commit
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `rating.int.test.ts` lines 748-833 only.
- Scope boundary — preserve unchanged: `rating.int.test.ts:1-747` — this is the single strongest regression proof in the whole plan; it must never be touched by this task.
