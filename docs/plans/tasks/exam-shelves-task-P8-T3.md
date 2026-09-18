# Task P8-T3 — `examHotCountsFixtures.ts` (companion fixtures module)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8, Task P8-T3**
Layer: backend (`SOURCE/tests/e2e/service/`)

Metadata:
- Dependencies: none within Phase 8 (structurally independent of P8-T1/T2, but must land before P8-T4)
- Blocks: P8-T4 (imports `HAS_LIVE_DB` and the seeded fixtures from this module)
- Size: Small (1 new file)
- Verification level: L3 (module compiles) — consumed and exercised by P8-T4

## Implementation Content
Create `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (companion fixtures module — does not exist yet), following the exact shape of `examSearchFixtures.ts`: re-export `HAS_LIVE_DB`/`adminClient`/`anonClient` from `essayGradeWriteFixtures.ts`; a `SLOT` prefix convention; `setUp(admin, slot)` seeding 2 real users (A, B) plus published/unpublished/banned-author exam rows and `exam_attempts` rows straddling the hour-snapped window boundary; `tearDown(admin, fixture, slot)` idempotent and prefix-scoped; `serviceClient()`/`anonClient()` for grant-boundary probes.

## Target Files
- [ ] `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — this file's own row, and the skeleton's own "FIXTURES MODULE" comment inside `exam-hot-counts.service.e2e.test.ts`)
- `SOURCE/tests/e2e/service/examSearchFixtures.ts` (the exact structural shape this new module must follow — re-exports, `SLOT` prefix convention, `setUp`/`tearDown` idempotency)
- `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` (`HAS_LIVE_DB`, `adminClient`, `anonClient` — re-exported here, not reimplemented)
- `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (the pre-committed skeleton's "FIXTURES MODULE" comment block — the exact shape P8-T4 will need from this module)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D5, D6 — the exact schema shape the seeded rows must match: `source` CHECK values, `status`/`submitted_at` for the hour-snapped window)

## Investigation Notes
_(Record here: confirmation `HAS_LIVE_DB`/`adminClient`/`anonClient` are re-exported, not reimplemented; the exact seeded row shapes for published/unpublished/banned-author exams and the hour-boundary-straddling attempts.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, including `examSearchFixtures.ts`'s exact structure
- [ ] Confirm the module does not yet exist
### 2. Green Phase
- [ ] Implement the module: re-exports, `SLOT` convention, `setUp`, `tearDown`, `serviceClient()`, `anonClient()`
- [ ] Seed 2 real users (A, B), published/unpublished/banned-author exams, and attempts straddling the hour-snapped window boundary
### 3. Refactor Phase
- [ ] Run `tearDown` twice in sequence (idempotency check) and confirm no error and no duplicate rows
- [ ] Confirm the module compiles (`tsc`) and is importable by P8-T4

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run test:localdb` — Enforces: real-Postgres service e2e (RLS isolation, grants, hour-snap) — Config: `SOURCE/vitest.localdb.config.ts:4-31`; Covered: `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (this module is the fixture dependency, exercised via P8-T4)

## Operation Verification Methods
- **Verification method**: `tsc --noEmit` for compile-correctness; module consumed and exercised end-to-end by P8-T4's `npm run test:localdb` run.
- **Success criteria**: module compiles; `setUp`/`tearDown` are idempotent and prefix-scoped (a second `tearDown` call is a no-op, not an error); seeded data matches the shapes P8-T4's 6 obligations need.
- **Failure response**: if `tearDown` is not idempotent, a failed test run could leave orphaned fixture rows on dev that accumulate across CI runs — fix by scoping every delete to the `SLOT` prefix and using `if exists`-style guards.
- **Verification level**: L3 for this task in isolation (module compiles); the real functional proof is P8-T4's, which this module enables.

## Proof Obligations
- **Claim**: `setUp`/`tearDown` are idempotent and prefix-scoped — running them twice leaves the dev database in the same state as running them once.
  - **Primary failure mode**: `tearDown` errors on a second call (e.g. a delete against already-deleted rows without an existence check), or fails to scope its deletes to its own `SLOT` prefix and accidentally removes another test run's concurrent fixture data.
  - **Boundary to exercise**: live dev Postgres, via this module's own `setUp`/`tearDown` functions called directly (not yet through the full test suite — that is P8-T4's).
  - **State assertion**: before → clean dev state; after 1 setUp+tearDown cycle → clean dev state again; after 2 cycles → still clean, no accumulation.
  - **Mock boundary rationale**: none — this proof requires real Postgres, since idempotency of DELETE/INSERT sequences cannot be proven against a mock.
  - **Residual**: the actual test assertions this fixture data supports (HS-b, HS-c, exclusions, hour-snap boundary, row-ceiling clamp, anon/service_role) are P8-T4's proof obligations, not this module's — this task only proves the fixture *data* is correctly shaped and safely reusable.

## Completion Criteria
- [ ] Module created with the full structural shape of `examSearchFixtures.ts`
- [ ] `setUp`/`tearDown` confirmed idempotent (2-cycle test)
- [ ] `tsc --noEmit` passes
- [ ] Gates 1-2, 4 green

## Notes
- Impact scope: this new fixtures module only.
- Scope boundary — preserve unchanged: `examSearchFixtures.ts` and `essayGradeWriteFixtures.ts` (re-used via import, not modified).
