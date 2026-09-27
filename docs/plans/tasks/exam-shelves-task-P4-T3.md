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
- [x] `SOURCE/features/exams/__tests__/rating.int.test.ts` (append-only — lines 748-833 only)

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

**Skeleton (`:748-833`)**: read in full before writing any assertion. Obligations (a)-(d) verbatim as summarized in the task's own Proof Obligations section. `FILE STATUS` comment confirms the block reuses `fromMock`/`createQueryBuilder` (module scope, no re-import needed) and that `listExamsRanked` is already imported at `:33`. Converted both `it.todo` calls to real `it(...)`; left all comment/header text at `:748-824` untouched (only `:825` onward — the `describe`/`it.todo` block itself — was replaced).

**`ranking.ts`**: `listExamsRanked(filters?, page=1)` calls `const supabase = await createClient()` ONCE at its own top (`:105`), then `Promise.all([fetchExamRows(filters), readMyAttemptRows(supabase,...), readBounded(...exam_results...), filters?.sort==="hot" ? readHotCounts(supabase,...) : Promise.resolve(new Map())])`. Important control-flow detail NOT in the skeleton text: `fetchExamRows` (catalogue.ts:77) calls `createClient()` a SECOND, independent time internally — so `createClient()` is invoked twice per `listExamsRanked()` call, not once. Both calls resolve through the same mocked `createClient` vi.fn, so both share whatever `.from` implementation is active; only the FIRST call (`listExamsRanked`'s own `supabase`, used directly for `readMyAttemptRows`/`exam_results`/`readHotCounts`) ever needs `.rpc`. `filters?.sort` truthy but not `"hot"` → DB-side order returned as-is (flat grid, matches AC-009/AC-010); `filters?.sort === "hot"` → `applyHotOrder(rows, hotCounts)` (Node-side, `orderIdsByHotCount`).

**`hotCounts.ts`**: `readHotCounts(supabase, label, now)` is the SOLE call site of `supabase.rpc("exam_hot_counts", {...})` in the codebase; it internally calls `readBounded(label, supabase.rpc(...))`, which calls `.limit(LIST_ROW_CEILING+1)` on whatever `rpcMock` returns — confirms the fake `rpc` builder needs the same `select/eq/.../limit` + `.then` chain shape as `fromMock`'s builder (`createQueryBuilder` already supplies this).

**`constants.ts` correction**: the Investigation Target note says `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS` live in `SOURCE/lib/adaptive/constants.ts` — verified this is NOT where they are (that file only holds ranking/shelf weights and thresholds, none named `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`). Grep confirms both constants are actually exported from `SOURCE/lib/supabase/boundedRead.ts:55,74`. This task's own Proof Obligations (verbatim, re-checked against the skeleton `:810-824`) never assert a `p_max_rows`/clamp value — that clamp-against-imported-constants obligation belongs to `shelves.int.test.ts` Candidate 1 (ADR-0021 D3, backend DD `:618`) and the service-e2e clamp case (backend DD `:620`), not to this candidate. No import of these constants was needed or added here.

**Mock-boundary gap and how it was resolved without touching `:1-747`**: the file's shared `vi.mock("@/lib/supabase/server", ...)` at `:29-31` returns `{ from: fromMock }` only (no `rpc`) — `shelves.int.test.ts` (a separate, newer file) ships `{ from: fromMock, rpc: rpcMock }` from the start, but that pattern can't be copied into the shared factory here without editing `:29-31`, which the task's Failure response explicitly forbids. Resolution: added (append-only, `:826+`) `const { createClient } = await import("@/lib/supabase/server")` plus a per-test `vi.mocked(createClient).mockResolvedValueOnce({ from: fromMock, rpc: rpcMock } as never)` in this describe's own `beforeEach` — `mockResolvedValueOnce` self-consumes on the very next `createClient()` call (`listExamsRanked`'s own, per the control-flow note above), so the second, internal call inside `fetchExamRows` still gets the untouched default. Verified via `git diff` (below) that `:1-747` (and in fact `:1-824`) are byte-identical. The `as never` cast follows the repo's existing convention for this exact situation (`features/auth/__tests__/profileActions.int.test.ts`: `createClientMock.mockResolvedValue(session.client as never)`).

**Literal expected hot-order array — independently computed, not implementation-derived**: fixture for the `?sort=hot` test supplies `exam_hot_counts` rows `{a: total 5, b: total 5, z: total 1}` and exam rows for ids `z,a,m,b` (m has NO hot row at all). Hand computation of `total_count DESC, exam id ASC` (per AC-018, written out before running anything): a and b tie at total=5 → id ASC → a before b; z=1; m has no row → `orderIdsByHotCount` (examShelves.ts:305) defaults missing ids to `total: 0` → m last. Result: `["a", "b", "z", "m"]`. This literal was typed into the test BEFORE running vitest. Verified the assertion is not a snapshot-in-disguise by temporarily flipping `orderIdsByHotCount`'s comparator (`b.total - a.total` → `a.total - b.total`) in `examShelves.ts`, confirming the new test goes RED (`expected ['m','z','a','b'] to deeply equal ['a','b','z','m']`), then reverted (`git diff` on `examShelves.ts` now empty).

**`git diff` confirmation**: `git diff -U0 -- SOURCE/features/exams/__tests__/rating.int.test.ts` shows the first changed hunk starts at original line 825 (`@@ -824,0 +825,15 @@`) — 0 changes to lines 1-747, and in fact 0 changes through line 824 (all comment/header text preserved verbatim).

**Binding Decision compliance (pre-implementation and re-confirmed post-implementation)**: Source `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` § Decision D3, Axis `data_flow`, Decision "Composition budget: `listExamsRanked` stays 3 boundary calls except `?sort=hot`; shelves composition = 4, asserted by counting `from()`+`rpc()` together". Planned/actual approach: the `?sort=hot` test tracks `.from`/`.rpc` calls into one shared `issued` array (via `mockHotBoundary`) and asserts `issued` has length 4 and `new Set(issued)` equals the 4 expected names together, not as two separate assertions. Compliance Check ("Does the `?sort=hot` case assert exactly 3 `.from` + 1 `.rpc` calls, counted together, not asserted separately?") = **Y** — the count-together assertion is exactly what `mockHotBoundary`'s single `issued` array produces; `toHaveLength(4)` + `Set` equality is one combined check, not two independent per-call-type checks.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton at `:748-833`
- [x] Confirm the block currently runs as `it.todo`
- [x] Independently compute the expected hot-order literal array from `total_count DESC, exam id ASC` over the test's fixture data, **without** running the implementation first
### 2. Green Phase
- [x] Replace `it.todo` with real `it` assertions per the skeleton's comment blocks
- [x] Run and confirm all pass
### 3. Refactor Phase
- [x] Run `git diff -- SOURCE/features/exams/__tests__/rating.int.test.ts` and confirm 0 changes outside lines 748-833
- [x] Confirm the AC-016/AC-017 cases above line 747 still pass unmodified in this same commit

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
- [x] Both skeleton obligations converted from `it.todo` to `it` and passing
- [x] `git diff` confirms 0 changes to lines 1-747
- [x] AC-016/AC-017 cases above line 747 pass unmodified in this same commit
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green — verified project-wide by the quality-assurance phase: `npx tsc --noEmit` (0 errors), `npx eslint --max-warnings 0` (0 warnings/errors), `npx vitest run` (153 passed | 1 skipped of 155 files; 2179 passed | 1 failed | 10 skipped of 2190 tests — the 1 failure is the pre-existing, unrelated `lib/security/rateLimit.test.ts` 33<=20 budget assertion, not touched), `npm run build` (compiled successfully), `npm run test:fixture` (4 passed | 1 skipped of 2 files, pre-existing todos unrelated to this task), `npm run test:localdb` (19 passed | 1 skipped of 4 files, pre-existing todos unrelated to this task). `rating.int.test.ts` in isolation: 31/31 passing, 0 skipped. `npm run check:bundle` also run as a supplementary mechanism: PASS.

## Notes
- Impact scope: `rating.int.test.ts` lines 748-833 only.
- Scope boundary — preserve unchanged: `rating.int.test.ts:1-747` — this is the single strongest regression proof in the whole plan; it must never be touched by this task.
