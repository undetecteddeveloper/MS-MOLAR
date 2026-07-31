# Task 03: Create `listMyHistory()` + `MyHistoryEntry` (Work Plan Phase 1, Task 1.2)

Metadata:
- Dependencies: none (independent of Task 02, reads only existing tables — can run in parallel)
- Provides: `MyHistoryEntry` type + `listMyHistory()` (consumed by Task 04, Task 13)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/app/(HM)/queries.ts`: `MyHistoryEntry` type + `listMyHistory()` (3 sequential batched selects: `exam_results` → `exam_attempts` (`.in().eq("status","submitted").order("submitted_at",{ascending:false})`) → `exams` (`.in().eq("status","published")`), matching `getExam()`'s explicit-filter convention, not RLS alone). Implement `SOURCE/app/(HM)/__tests__/history.int.test.ts` (skeleton, no import/describe blocks yet) — add both in this same commit (Red → Green).

## Target Files
- [x] `SOURCE/app/(HM)/queries.ts` (new)
- [x] `SOURCE/app/(HM)/__tests__/history.int.test.ts` (fill in skeleton)

## Investigation Targets
- `SOURCE/app/(HM)/__tests__/history.int.test.ts` (the full skeleton — obligations a-g, mock boundary notes)
- `SOURCE/app/(layer2)/queries.ts` (lines 197-205, `listMySubmittedExamIds()` — closest RLS-scoping pattern reference; lines 181-191, `getExam()` — the `.eq("status","published")` filter convention this function must mirror)
- `SOURCE/app/(layer4)/queries.ts` (lines 11-67, `MyExamListItem`/`listMyExams()` — closest typed-list-return-shape precedent; line 108, `getMyExam()`'s now-rejected `.in()` empty-array sentinel pattern — confirm it is correctly NOT needed here per the backend DD's own reasoning)
- `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (lines 1-55 — the established mocked-Supabase-client style, `createQueryBuilder` helper, `vi.mock("server-only")`/`vi.mock("@/lib/supabase/server")` pattern)
- `SOURCE/app/(layer2)/actions.ts` (lines 32-129, `submitExam()` — establishes Assumed Behaviors #1/#2: `exam_results` inserted before `status='submitted'`; `submitted_at` set in the same atomic `.update()` call as `status`)
- `SOURCE/supabase/schema.sql` (lines 99-127, 160-170, 201-207, 263-268 — `exam_attempts`/`exam_results`/`exams` tables + RLS policies this function reads)
- `docs/design/history-backend-design.md` (§ Data Contracts — `listMyHistory()` yaml; § Query Implementation Shape — full code; § Exams-Visibility Edge Case — Explicit Decision; § Minimal Surface Alternatives (Element A); § Data Representation Decision; § Field Propagation Map; § Assumed Behaviors #1/#2/#5)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-backend-design.md` (§ Exams-Visibility Edge Case — Explicit Decision) | state-lifecycle-negative | `"Decision: omit the row silently... A row whose exam_id has no matching title in that lookup is dropped from the returned array entirely; no placeholder title, no partial row."` | Does a row whose `exam_id` has no title match in the batched `exams` lookup get dropped entirely from the returned array (no placeholder title, no partial row)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular: confirm `examIds` is always non-empty at the exam-title-lookup step (Assumed Behavior evidence), so no defensive `.in()` sentinel is added (matches the backend DD's own I002 dead-code removal decision).
- [x] Write the failing tests in `history.int.test.ts` per the skeleton's 7 obligations (a-g): in-progress-attempt exclusion (AC-001), empty-early-return (AC-002), `.order("submitted_at",{ascending:false})` call-args (AC-003), field completeness (AC-004/005), exams-visibility JS-assembly omission, no-N+1 (`exams` `.from` called exactly once), throw-on-error at any of the 3 steps (AC-019).
- [x] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [x] Implement `listMyHistory()` exactly per the backend DD's Query Implementation Shape code (3 sequential batched selects, assemble-and-omit step).
- [x] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [x] Improve code (maintain passing tests); confirm no dead defensive code (per the backend DD's own I002 fix, do not reintroduce an unreachable `.in()` sentinel for `examIds`).
- [x] Confirm added tests still pass.

## Investigation Notes

**Investigation Targets read** (all, in full, before implementation):
- `history.int.test.ts` skeleton — obligations a-g and the "SKELETON ONLY"/mock-boundary comment block confirmed no import/describe blocks existed yet; `(HM)/queries.ts` confirmed absent via `ls`.
- `(layer2)/queries.ts:181-191` (`getExam`) — confirms the `.eq("id",id).eq("status","published")` two-layer visibility convention (RLS + explicit filter, not RLS alone); `:197-205` (`listMySubmittedExamIds`) — confirms the RLS-only-scoping pattern (no explicit `.eq("user_id",...)`, relies on `attempts_select_own`).
- `(layer4)/queries.ts:11-67` (`MyExamListItem`/`listMyExams`) — confirms the typed-list-return-shape precedent (flat object array, camelCase, single ordered read); `:108` (`getMyExam`'s `.in()` sentinel `questionIds.length > 0 ? questionIds : ["__none__"]`) — confirmed this sentinel is a defensive pattern for a caller-supplied array that *can* be empty; NOT applicable to `listMyHistory()`'s `examIds` because step 2 already early-returns `[]` before `examIds` is ever computed, and `exam_id` is a `NOT NULL` FK (schema.sql:102) — so no sentinel was added (matches DD's I002 dead-code-removal decision).
- `rating.int.test.ts:1-55` — confirmed the established `vi.hoisted(fromMock)` + `vi.mock("server-only")` + `vi.mock("@/lib/supabase/server")` + chainable `createQueryBuilder` (`select/eq/gte/lt/order` + thenable `.then`) style; extended with an `.in()` chain method for this task's 3-table dispatch (`fromMock.mockImplementation((table) => ...)`), mirroring the same per-table dispatch idiom used in `rating.int.test.ts`'s `mockEligibleWithUpsert`.
- `actions.ts:32-129` (`submitExam`) — confirms Assumed Behavior #1 (`exam_results` inserted at step 5, `:111-119`, strictly before `exam_attempts.status` is set to `'submitted'` at step 6, `:122-126`) and #2 (`status`/`submitted_at` set in the *same* atomic `.update()` call, `:122-126`) — so every row matched by `.eq("status","submitted")` necessarily has a non-null `submitted_at`; no runtime null-guard needed (missing-sort-key ordering Proof Obligation, code-inspection only, no test added).
- `schema.sql:99-127` (`exam_attempts`/`exam_results`), `:160-170`/`:201-207` (RLS `attempts_select_own`/`results_select_own`), `:263-268` (`exams_select_visible`) — confirms `exam_id text not null references public.exams(id)` (NOT NULL FK, supports the no-sentinel decision) and all 3 RLS policies this function relies on.
- `docs/design/history-backend-design.md` (v1.2) — read in full; `listMyHistory()` implemented verbatim per § Query Implementation Shape (lines 320-409); Data Contracts yaml (§ Data Contracts) and Field Propagation Map cross-checked against the final `MyHistoryEntry` type — match exactly.

**Reference Contract Check** (pre-implementation and Exit Gate re-evaluation):

| Source | Required Observable Value | Planned/Actual Approach | Evaluation | Rationale |
|---|---|---|---|---|
| `docs/design/history-backend-design.md` (§ Exams-Visibility Edge Case — Explicit Decision) | A row whose `exam_id` has no matching title in the batched `exams` lookup is dropped from the returned array entirely; no placeholder title, no partial row. | Implemented the DD's Step 4 assembly verbatim: `.map((a) => { const examTitle = titleByExamId.get(a.exam_id); if (examTitle === undefined) return null; return {...}; }).filter((e): e is MyHistoryEntry => e !== null)` — a titleless row maps to `null` and is filtered out, never defaulted. | Y | Test obligation (e) proves this directly: 2 attempt rows, exams mock returns a title for only 1 → resolved array has exactly 1 entry, the titleless attempt's id never appears. Matches the Compliance Check exactly. |

Result: **Y** — no escalation required.

**Similar Function Duplication check** (Step 3 of Mandatory Judgment Criteria): searched `listMySubmittedExamIds()` and `listMyExams()` per the backend DD's own "Similar Functionality Search and Decision" section — both share domain-adjacent keywords but differ on input/output shape (Set<string> vs. typed row array) and/or entity (author's `exams` vs. student's `exam_attempts`); DD already concluded neither is reusable as-is and a new function is warranted (2 indicators match at most: same domain, same directory-adjacency — below the 3-indicator/escalation threshold). Continued implementation, no escalation.

**Core Mechanism Preservation**: implemented the 3-sequential-batched-select shape, the explicit `.eq("status","published")` filter (not RLS alone), and the silent-omission assembly exactly as specified in the DD's Query Implementation Shape code block — no substitution, no simplification.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (node), `app/**/*.test.{ts,tsx}` — Enforces: call-construction/query-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/app/(HM)/__tests__/history.int.test.ts`
- RLS verification harness `test-rls.ts` — Enforces: real-Postgres RLS/aggregate behavior — Config: `SOURCE/supabase/test-rls.ts` — Covers: `exams_select_visible` RLS + explicit `.eq("status","published")` filter (case H-a, required blocking — verified in Task 05, not this task)

## Operation Verification Methods
- **Verification method**: run `history.int.test.ts` against the mocked Supabase client; separately, hit `/history` (once Task 04's guard/layout exist) in `npm run dev` against local Supabase for a seeded user with a mix of in-progress/submitted attempts.
- **Success criteria**: all 7 obligations pass; the mocked `exams` table's `.from` is invoked exactly once regardless of attempt-row count (no-N+1, NFR Performance).
- **Failure response**: if the RLS-driven omission half cannot be proven by mocks (expected — it can't), do not treat obligation (e) as a substitute for Task 05's required, blocking real-Postgres proof; escalate any mock-vs-real-Postgres disagreement discovered when Task 05 runs.
- **Verification level**: L2 (7/7 obligations green) as this task's own gate; L1 (real `/history` data) achieved once Task 04 exists.

## Proof Obligations
- **Claim**: AC-001 — only rows with `status='submitted'` AND an existing `exam_results` row appear; an in-progress attempt never leaks in.
  - **Primary failure mode**: an in-progress (`status='in_progress'`) attempt leaks into the returned list.
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary).
  - **State assertion**: N/A (read-only).
  - **Mock boundary rationale**: Supabase client is the sanctioned mock boundary (backend DD Test Boundaries) — proves JS assembly, not real RLS.
  - **Residual**: none for this claim specifically (JS-assembly logic, not an RLS concern).
- **Claim**: AC-002 / Failure Mode `empty input` — a user with zero completed+scored attempts resolves to `[]`, not an error, with zero calls to the other 2 tables.
  - **Primary failure mode**: `exam_results` resolving to `[]` throws, or resolves to something other than `[]`, or the early return still invokes the `exam_attempts`/`exams` mocks (violating the no-per-row-round-trip guarantee even in the zero-row case).
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: AC-003 — rows ordered `submitted_at` descending.
  - **Primary failure mode**: the list is not ordered `submitted_at` descending (or the mocked call omits `.order(...)` entirely).
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary, asserting exact `.order()` call args).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: AC-004/AC-005 — every returned row carries `attemptId`/`examId`/`examTitle`/`totalScore`/`startedAt`/`submittedAt`, all populated.
  - **Primary failure mode**: a field is silently dropped or coerced.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: Exams-Visibility Edge Case (R-1, JS-assembly half) / Failure Mode `shared-state dependency` + `rollback-only visibility` — a titleless row (exam not visible/published) is omitted entirely, never defaulted.
  - **Primary failure mode**: a row whose exam is not visible/published still carries a title (the omission rule silently regresses to "default title" or "include anyway" instead of dropping the row) — this is exactly the shared-state (`exams.status`, mutated independently by its author) and rollback-only-visibility failure class named in the Work Plan's Failure Mode Checklist.
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary) — this proves the JS-assembly/omit-logic half only; it does NOT prove real-Postgres RLS behavior for the self-authored-exam-reverted scenario.
  - **State assertion**: N/A (read-only; the underlying exam's `status` mutation is out of this feature's scope).
  - **Mock boundary rationale**: Supabase client mocked; the RLS omission behavior itself is explicitly NOT provable by mock (backend DD Test Boundaries: "Mocks cannot prove RLS filtering... require a real DB").
  - **Residual**: real-Postgres RLS proof for the self-authored-exam-reverted-to-non-published scenario is closed exclusively by Task 05's `test-rls.ts` case H-a + manual walkthrough — not by this task.
- **Claim**: no-N+1 regression guard (NFR Performance) — the `exams` table's mocked `.from` is invoked exactly once regardless of attempt-row count.
  - **Primary failure mode**: the exams lookup is invoked once per row instead of once total.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.
- **Claim**: AC-019 / Failure Mode `unavailable boundary` — a simulated Supabase error at any of the 3 steps rejects the promise, never resolves to `[]`/partial data.
  - **Primary failure mode**: a Supabase error at any of the 3 steps resolves to `[]` or partial data instead of rejecting.
  - **Boundary to exercise**: in-process unit.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: does not prove the frontend's `error.tsx` boundary actually catches this thrown error in a real render — that residual is closed by Task 13/Task 15.
- **Claim**: `missing-sort-key ordering` (Failure Mode Checklist) — ordering by `submitted_at desc` relies on Assumed Behavior #2 (`submitted_at` guaranteed non-null for every matched row).
  - **Primary failure mode**: a matched row has a null `submitted_at`, causing nondeterministic ordering or a runtime error in the `.order()` comparison.
  - **Boundary to exercise**: in-process unit — confirm via code inspection (Assumed Behavior #2's evidence: `submitExam()` sets `status`/`submitted_at` in the same atomic `.update()` call) that every row matched by `.eq("status","submitted")` necessarily has a non-null `submitted_at`; no additional runtime null-guard is required.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none — this is a code-inspection/assumed-behavior confirmation, not a new test case.
  - **Residual**: if a future second write site ever sets `status='submitted'` without `submitted_at` in the same statement, this assumption must be re-verified (flagged as Risk R-3 in the backend DD, not actionable today).

## Completion Criteria
- [x] All added tests pass (7/7 obligations green — 9 test cases total: obligation (g)'s 3 sub-cases, one per step, split into 3 separate `it()` blocks)
- [x] Operation verified per Operation Verification Methods above — L2 (`history.int.test.ts` against the mocked Supabase client, 9/9 green) achieved, this task's own gate. L1 (`/history` in `npm run dev`) is explicitly deferred to once Task 04's guard/layout exist, per this task's own Verification level note.
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary (the whole suite was confirmed red pre-implementation — module-not-found; each test's mocked-Supabase-client fixture is constructed to directly exercise its stated primary failure mode: e.g. obligation (a)'s mock supplies both A and B in `exam_results` but only A in the `exam_attempts` response, so a leak of B would fail the `entries.some(...)` assertion — all boundaries are the in-process mocked Supabase client per the Proof Obligations table)
- [x] `tsc`/lint clean (`npx tsc --noEmit` — zero errors; `npx eslint "app/(HM)/queries.ts" "app/(HM)/__tests__/history.int.test.ts"` — zero errors; `npx prettier --check` — matches style)
- [x] Every Reference Contract Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/app/(HM)/queries.ts` (new) + its test file only.
- Scope boundary: no schema/RLS change; do not touch `(HM)/layout.tsx`/`(HM)/history/page.tsx` (Task 04) in this task.
