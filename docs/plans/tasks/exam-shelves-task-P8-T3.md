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
- [x] `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — this file's own row, and the skeleton's own "FIXTURES MODULE" comment inside `exam-hot-counts.service.e2e.test.ts`)
- `SOURCE/tests/e2e/service/examSearchFixtures.ts` (the exact structural shape this new module must follow — re-exports, `SLOT` prefix convention, `setUp`/`tearDown` idempotency)
- `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` (`HAS_LIVE_DB`, `adminClient`, `anonClient` — re-exported here, not reimplemented)
- `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (the pre-committed skeleton's "FIXTURES MODULE" comment block — the exact shape P8-T4 will need from this module)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D5, D6 — the exact schema shape the seeded rows must match: `source` CHECK values, `status`/`submitted_at` for the hour-snapped window)

## Investigation Notes
- `examSearchFixtures.ts` structural shape confirmed: re-exports `adminClient`/`anonClient`/`HAS_LIVE_DB` from `essayGradeWriteFixtures.ts` (does not reimplement them), owns a `SLOT`-prefixed constant (`ES_PREFIX`), `setUp` calls `tearDownBySlot` first for idempotency, `tearDown` signs out the fixture's student client(s) then delegates to `tearDownBySlot`, and defines its own `serviceClient()` separate from `adminClient()` "so this test file doesn't depend on the neighbour fixture's export details." `examHotCountsFixtures.ts` follows this exact shape.
- `essayGradeWriteFixtures.ts` confirmed as the actual owner of `HAS_LIVE_DB`/`adminClient`/`anonClient` (computed boolean from 3 env vars loaded by hand via `loadEnvLocal()`, since vitest does not load `.env.local`) — re-exported, not reimplemented, in the new module.
- `exam-hot-counts.service.e2e.test.ts` skeleton's "FIXTURES MODULE" comment (lines 53-74) is the authoritative shape contract: `HAS_LIVE_DB` re-exported; a `SLOT` prefix; `setUp(admin, slot)` seeding TWO real users (A, B) plus published/unpublished/banned-author exam rows and `exam_attempts` rows straddling the hour-snapped window boundary, returning both users' authenticated clients; `tearDown(admin, fixture, slot)` idempotent/prefix-scoped; `serviceClient()`/`anonClient()` for grant probes.
- `schema.sql` confirmed: `exams.status` CHECK allows `('processing','review','draft','published','failed')`; `exams.author_id` is nullable (`on delete set null`) — `is_author_banned(null)` is `false` by construction, so exams left with no `author_id` never trigger the ban predicate. `exam_attempts.status` is `'in_progress'|'submitted'` (no CHECK, per ADR-0021 D6). `exam_hot_counts()` (§20c) predicates: `a.status='submitted'`, `e.status='published'`, `not is_author_banned(e.author_id)`; both window boundaries are `date_trunc('hour', …)`-snapped server-side.
- `test-rls.ts` Phần 10 (already-committed P8-T2) precedent read for the banned-author scenario shape (`setupHotCountsFixtures`/`cleanupHotCountsFixtures`, HS-f). It uses a THIRD user C, isolated from A/B, specifically so a ban command never touches A/B's sessions used elsewhere in that same manual run. This new module deliberately uses only the TWO users the skeleton's own comment specifies (not test-rls.ts's 3-user shape): user A is the constant RPC *caller* in every obligation (a)-(f) and is never banned; user B is both submitter (on `published`/`unpublished`) and the *author* of `bannedAuthor` — banning B never disrupts A's own session, so this stays safe with 2 users. Verified functionally (see below) that toggling B's ban state does not disturb A's subsequent RPC calls.
- Seeded row shapes implemented in `setUp`: 4 exams (`published`, `unpublished` [`status:'draft'`], `bannedAuthor` [`author_id: userB.id`], `hourBoundary`) and 6 `exam_attempts` rows: B submitted on `published` (HS-b/HS-c) + A `in_progress` on the same exam (obligation c vế 1, proves in-progress doesn't inflate the count); B submitted on `unpublished` (obligation c vế 2); A submitted on `bannedAuthor` (obligation c vế 3, ban/unban toggled by the test itself via `admin.auth.admin.updateUserById`, not by this fixture's `setUp`); B submitted 1s before and A submitted 1s after a fixed UTC hour boundary on the dedicated `hourBoundary` exam (obligation d) — kept on its own exam so it is not contaminated by the "now"-timestamped attempt on `published`. `hourBoundaryArgs.sinceRecent` is deliberately NOT hour-aligned (37 minutes past the anchor hour) so the test proves the server truncates, not that the client already sent a truncated value; `hourBoundaryArgs.sinceWide` is the epoch floor so `wide_count` always includes both straddling attempts.
- **Idempotency proof (Proof Obligation)**: ran a one-off script against live dev Postgres (ref `hynwleaxtbtjzkvpjsug`) calling this module's `setUp`/`tearDown` directly: clean baseline (0/0/0) -> `setUp` #1 seeds exactly 4 exams/6 attempts/2 users -> `tearDown` #1 returns to 0/0/0 -> a SECOND `tearDown` call with no `setUp` in between (idempotency case) is a no-op, no error, still 0/0/0 -> `setUp`/`tearDown` cycle #2 seeds the same counts and returns to 0/0/0 again (no accumulation across cycles). All assertions passed.
- **Functional sanity check** (beyond this task's L3 scope, run only to de-risk P8-T4): exercised the real `exam_hot_counts()` RPC against the seeded fixture with real JWTs — cross-user count (A sees B's exam, `total_count===1`, in-progress attempt does not inflate it), key set exactly `{exam_id, recent_count, wide_count, total_count}`, unpublished exam absent, banned-author exam absent during ban / present before and after, hour boundary `recent_count===1` vs `wide_count===2`, `p_max_rows` lower-clamp, `anon` 42501, `service_role` array — all passed against live dev Postgres. Dev DB confirmed clean of all residual fixture rows afterward.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, including `examSearchFixtures.ts`'s exact structure
- [x] Confirm the module does not yet exist
### 2. Green Phase
- [x] Implement the module: re-exports, `SLOT` convention, `setUp`, `tearDown`, `serviceClient()`, `anonClient()`
- [x] Seed 2 real users (A, B), published/unpublished/banned-author exams, and attempts straddling the hour-snapped window boundary
### 3. Refactor Phase
- [x] Run `tearDown` twice in sequence (idempotency check) and confirm no error and no duplicate rows
- [x] Confirm the module compiles (`tsc`) and is importable by P8-T4

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
- [x] Module created with the full structural shape of `examSearchFixtures.ts`
- [x] `setUp`/`tearDown` confirmed idempotent (2-cycle test)
- [x] `tsc --noEmit` passes
- [x] Gates 1-2, 4 green

## Notes
- Impact scope: this new fixtures module only.
- Scope boundary — preserve unchanged: `examSearchFixtures.ts` and `essayGradeWriteFixtures.ts` (re-used via import, not modified).
