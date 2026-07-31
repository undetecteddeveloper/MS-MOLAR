# Task 02: Extend `getResult()` — `startedAt`/`submittedAt` (Work Plan Phase 1, Task 1.1)

Metadata:
- Dependencies: none (zero DB dependency, can start immediately, independent of Task 03)
- Provides: extended `ExamResult` type (consumed by Task 12)
- Size: Small (2 files)

## Implementation Content

Extend `getResult()` (`SOURCE/app/(layer2)/queries.ts:317-320,370`): add `started_at, submitted_at` to the `exam_attempts` select; extend `ExamResult` type with `startedAt: string`, `submittedAt: string | null`. Implement `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` (currently a skeleton with no import/describe blocks) — add both the real import/describe blocks and the code change in this same commit (Red → Green).

This is this feature's **Early Verification Point #1** (Output Comparison) — it must pass before Task 03 (`listMyHistory()`) proceeds, since `listMyHistory()`'s own correctness depends on the same query-shape discipline being additive-correct first.

## Target Files
- [x] `SOURCE/app/(layer2)/queries.ts` (extend `getResult()` select + `ExamResult` type, lines ~294-300, 317-320, 370)
- [x] `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` (fill in skeleton — add import + describe/it blocks)

## Investigation Targets
- `SOURCE/app/(layer2)/queries.ts` (lines 260-371 — `getResult()`'s full current implementation, `ResultRow`/`ExamResult` types)
- `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` (the full skeleton — proof obligations a/b/c, mock boundary notes)
- `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (lines 1-55 — the established `vi.mock("server-only")`/`vi.mock("@/lib/supabase/server")`/`createQueryBuilder` mocked-chain style this new test file must follow)
- `docs/design/history-backend-design.md` (§ Data Contracts — `getResult()` (extended) yaml block; § Query Implementation Shape — `getResult()` diff; § Early Verification Point; § Output Comparison)
- `docs/design/history-backend-design.md` (§ Agreement Checklist / Scope) — Design Traceability
- `docs/design/history-backend-design.md` (§ Minimal Surface Alternatives (Element B)) — Design Traceability
- `docs/design/history-backend-design.md` (§ Data Representation Decision) — Design Traceability
- `docs/design/history-backend-design.md` (§ Field Propagation Map) — Design Traceability

## Change Category

`Change Category: boundary-change`

`getResult()`'s return type is an already-published, cross-file-consumed contract (2 existing consumers). Sweep both consumers for the same class of defect (a value or null-ness silently changing on a pre-existing field) as part of this task's Red phase, even though neither file is edited here:
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` (consumer — destructures `examTitle`, `result`; new fields present but unused until Task 12)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (consumer — same `ExamResult`, new fields present but unused)

## Investigation Notes

- **`getResult()` current implementation** (`queries.ts:306-371`): 4 sequential supabase calls — `exam_results` (`.select("total_score, correct, total, per_question, topic_breakdown").eq("attempt_id", attemptId).maybeSingle()`), `exam_attempts` (`.select("exam_id").eq("id", attemptId).maybeSingle()` — the target of this task), `getExam(attempt.exam_id)` (→ `exams_with_difficulty` `.select(EXAM_COLUMNS).eq("id", id).eq("status","published").maybeSingle()`), `questions` (`.select("id, content, choices, question_type, sub_answers, essay_answer").in("id", ...)`). Return statement (`:370`) currently builds `{ examId, examTitle, result, questions }` only.
- **Pre-change select string** (`:319`): `"exam_id"` (1 column). **Post-change select string**: `"exam_id, started_at, submitted_at"` (3 columns, additive — `exam_id` retained verbatim, not renamed/dropped).
- **`ExamResult` type** (`:294-300`): pre-change has no `startedAt`/`submittedAt` fields; post-change adds `startedAt: string` and `submittedAt: string | null` as new top-level siblings to `examId`/`examTitle`/`result`/`questions` (unchanged), per Data Contracts yaml + Query Implementation Shape diff (`docs/design/history-backend-design.md` v1.2, lines 294-316, 411-440).
- **Consumer sweep (Change Category: boundary-change)**: read both consumers in full.
  - `result/page.tsx:33` destructures `const { examTitle, result } = data;` only — no `startedAt`/`submittedAt`/`examId`/`questions` accessed. Adding 2 new sibling fields cannot shadow/rename anything this page reads; compiles unchanged.
  - `result/detail/page.tsx:27` destructures `const { examId, examTitle, result, questions } = data;` — same 4 pre-existing fields, no new-field access. Compiles unchanged.
  - Neither file needs any edit for this task; both remain byte-identical in behavior — confirmed via source read, not just design-doc claim. This confirmation is folded into `getResult.int.test.ts`'s obligation (b) Output Comparison (byte-identical pre-existing sub-object), which is the automated proof that the shape both consumers depend on is unchanged.
- **Test file style precedent** (`rating.int.test.ts:1-55`): `vi.hoisted(() => ({ fromMock: vi.fn() }))`, `vi.mock("server-only", () => ({}))`, `vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ from: fromMock })) }))`, then `const { X } = await import("../queries")` (top-level await, ESM). `fromMock.mockImplementation((table) => {...})` branches per table name, throwing on an unexpected table — this pattern is followed in the new test file for `exam_results`/`exam_attempts`/`exams_with_difficulty`/`questions`.
- **Design Doc traceability confirmed**: Agreement Checklist Scope item 2 (`getResult()` extension, additive); Minimal Surface Alternatives Element B (raw `startedAt`/`submittedAt` on `ExamResult`, frontend formats — selected over a backend-computed label or a second on-demand query); Data Representation Decision (extend `ExamResult` top-level, not nested in `ScoreResult` — read-time envelope fit); Field Propagation Map (`exam_attempts` row → `getResult()` `ExamResult`, transformed snake_case→camelCase, in-memory hand-off to both consumer pages, preserved/unused).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations.
- [x] Sweep the 2 adjacent consumers (`result/page.tsx`, `result/detail/page.tsx`) — confirm neither destructures a field this change could shadow/rename, and that both compile unchanged after the extension (fold this confirmation into the test suite's Output Comparison, not a separate manual step).
- [x] Write the failing tests in `getResult.int.test.ts`: obligation (a) select-shape assertion (`.select("exam_id, started_at, submitted_at")`), obligation (b) Output Comparison (`toEqual` against an independently-authored literal fixture for `{examId, examTitle, result, questions}`, plus `startedAt` non-empty string and `submittedAt` matching the non-null fixture case), obligation (c) null-`submittedAt` path (`ExamResult.submittedAt === null` exactly, key present via `hasOwnProperty`).
- [x] Run tests and confirm failure (import of `getResult` from the not-yet-extended module should fail the new assertions, or the test file itself doesn't compile yet since no describe/it blocks exist). Confirmed: all 3 tests failed pre-implementation — obligation (a) received `["exam_id"]` vs expected `["exam_id, started_at, submitted_at"]`; obligations (b)/(c) received `undefined` for `startedAt`/`submittedAt` (fields did not exist yet).

### 2. Green Phase
- [x] Extend the `exam_attempts` select (`:317-320`) and `ExamResult` type (`:294-300`) exactly per the Data Contracts yaml and Query Implementation Shape diff in the backend Design Doc.
- [x] Run only the added tests and confirm they pass. Confirmed: 3/3 passed.

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — confirm the diff touches only the 2 named line ranges, no unrelated reformatting. Confirmed via `git diff`: only the `ExamResult` type block (+6 lines), the select string (1 line), and the return statement (7 lines) changed — no other lines touched.
- [x] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (node), `app/**/*.test.{ts,tsx}` — Enforces: call-construction/query-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts`

## Operation Verification Methods
- **Verification method**: Output Comparison — call `getResult(knownAttemptId)` before vs. after the extension (via the mocked test), diffing field-by-field against an independently-authored literal fixture.
- **Success criteria**: `examId`/`examTitle`/`result.*`/`questions` exactly equal the pre-change fixture; `startedAt` is a non-empty string; `submittedAt` matches the mocked value (string or `null`) — no other field differs.
- **Failure response**: if any pre-existing field differs, the extension is not additive — stop and re-inspect the select diff before starting Task 03, since `listMyHistory()`'s own review depends on the same query-shape discipline being correct first.
- **Verification level**: L2 (all 3 obligations green in `getResult.int.test.ts`) plus this Early Verification Point's manual/test-based Output Comparison before Task 03 proceeds.

## Proof Obligations
- **Claim**: the `exam_attempts` select gains `started_at, submitted_at` without dropping or renaming the existing `exam_id` column.
  - **Primary failure mode**: the select silently drops or misnames one of the 2 new columns (e.g. selects `started_at` but not `submitted_at`).
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary).
  - **State assertion**: N/A (read-only query, no state change).
  - **Mock boundary rationale**: Supabase client (`createClient()`) is the sanctioned mock boundary per backend DD Test Boundaries — proves JS call construction, not real-Postgres semantics (none newly introduced by this additive change).
  - **Residual**: none — this is a pure call-construction assertion.
- **Claim**: `getResult()`'s pre-existing output (`examId`/`examTitle`/`result`/`questions`) is byte-identical to before this change (R-2 regression risk).
  - **Primary failure mode**: the extension inadvertently changes a pre-existing field's value or null-ness.
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary) — Output Comparison.
  - **State assertion**: N/A (read-only).
  - **Mock boundary rationale**: same as above.
  - **Residual**: does not prove the 2 live, already-shipped consumer pages render unchanged in a real browser — that residual is closed by Task 12's manual visual check when those pages are actually touched (they are not touched by this task).
- **Claim**: a null `submitted_at` maps to `ExamResult.submittedAt === null` exactly, never coerced or dropped.
  - **Primary failure mode**: a null `submitted_at` is coerced to an empty string or the key is omitted from the returned object.
  - **Boundary to exercise**: in-process unit (mocked Supabase client boundary).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same as above.
  - **Residual**: none.

## Completion Criteria
- [x] All added tests pass (3/3 obligations green in `getResult.int.test.ts`)
- [x] Operation verified per Operation Verification Methods above (Early Verification Point #1 passed)
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] `tsc`/lint clean

## Notes
- Impact scope: `SOURCE/app/(layer2)/queries.ts` (2 named line ranges only) + the 1 new test file.
- Scope boundary: do not touch `result/page.tsx` or `result/detail/page.tsx` in this task — they are Task 12's and out-of-scope (unused-until-wired) respectively.
