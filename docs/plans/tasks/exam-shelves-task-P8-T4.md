# Task P8-T4 — Fill in `exam-hot-counts.service.e2e.test.ts` (6 obligations) — gate 6 first meaningful run

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8, Task P8-T4**
Layer: backend (`SOURCE/tests/e2e/service/`)

Metadata:
- Dependencies: P8-T3 (`examHotCountsFixtures.ts`)
- Blocks: none downstream (last task before Final Phase, alongside P8-T1/T2)
- Size: Small (1 file, pre-committed skeleton fill-in)
- Verification level: L2 on live dev — `npm run test:localdb` green, exercising this feature's real-Postgres surface for the first time

## Implementation Content
Fill in `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (already committed as `it.todo`, 6 obligations) — wrap the top-level `describe` in `describe.skipIf(!HAS_LIVE_DB)` (importing `HAS_LIVE_DB` from P8-T3), replace each `it.todo` with a real `it`.

## Target Files
- [x] `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (fill-in — pre-committed skeleton)

## Investigation Targets
- `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts` (the full pre-committed skeleton — read every `Proof obligation`/`Primary failure mode` comment block before writing any assertion)
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — service e2e row; skeleton's own Proof Obligation list)
- `SOURCE/tests/e2e/service/examHotCountsFixtures.ts` (P8-T3 — the fixtures this task consumes)
- `SOURCE/lib/adaptive/constants.ts` (`LIST_ROW_CEILING`, `POSTGREST_MAX_ROWS` — imported for the clamp assertion, never hand-copied)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Implementation Guidance — key-set-exact proof)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Implementation Guidance) | contract_schema | Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values | Does obligation (b) assert the returned row's key set EXACTLY, mirroring P8-T2's HS-c from the service-e2e angle? |

## Investigation Notes

**Investigation Targets read:**
- `exam-hot-counts.service.e2e.test.ts` skeleton (all 6 `it.todo` + every comment block: FILE STATUS, MOCK BOUNDARY, ROI, Proof Obligations a-f) — read in full before writing any assertion.
- `docs/design/exam-shelves-backend-design.md` § The SQL objects (:210-296): `exam_hot_counts(p_since_recent, p_since_wide, p_max_rows int default 500)`, `security definer`, predicates `status='submitted'`/`status='published'`/`not is_author_banned`, `group by exam_id`, `limit least(greatest(coalesce(p_max_rows, 500), 1), 1000)` — the two SQL literals (500, 1000) are hand copies of `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`.
- `examHotCountsFixtures.ts` (P8-T3): `setUp`/`tearDown` shape, `HC_PREFIX = "hc-svc-"`, userA=caller (never banned), userB=submitter/banned-author, four exam ids (`published`/`unpublished`/`bannedAuthor`/`hourBoundary`), `hourBoundaryArgs.{sinceRecent,sinceWide}` straddling a real hour boundary (`HOUR_ANCHOR_MS`, offset 37 min for `sinceRecent` to prove the server truncates rather than uses the raw arg). `tearDownBySlot` deletes by `like exam_id '${HC_PREFIX}${slot}-%'` / `like id '${HC_PREFIX}${slot}-%'` — confirmed this also auto-cleans any additional rows this task seeds under the same slot prefix (used for obligation (e), no separate cleanup needed).
- `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`: **correction to this task file's Investigation Targets** — these do NOT live in `SOURCE/lib/adaptive/constants.ts` (grepped, not found there); they live in `SOURCE/lib/supabase/boundedRead.ts:55,74` (`POSTGREST_MAX_ROWS = 1000`, `LIST_ROW_CEILING = 500`), exactly as the skeleton's own obligation (e) text states (`from "@/lib/supabase/boundedRead"`). Imported from that path in the implementation.
- `SOURCE/features/exams/queries/hotCounts.ts`: confirms the real production call shape — `p_max_rows: LIST_ROW_CEILING + 1` always, never omitted. Obligation (e)'s "after" assertion mirrors this exact shape.
- ADR-0021 § Implementation Guidance: "Keep the aggregate's projection minimal and prove it. The RLS harness asserts the returned row's key set, not just its values" — obligation (b) implements this from the service-e2e angle (independent of `test-rls.ts` HS-c).
- `SOURCE/supabase/test-rls.ts` Phần 10 (P8-T2, HS-a..HS-g): confirmed NO row-ceiling clamp case exists there — obligation (e) here is genuinely new coverage, not a duplicate.

**Binding Decision evaluation:**
- Row: ADR-0021 § Implementation Guidance, axis `contract_schema`, "Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values". Planned approach: obligation (b)'s `it` calls `exam_hot_counts` as user A, finds the row for `examIds.published`, and asserts `Object.keys(row).sort()` deep-equals exactly `["exam_id", "recent_count", "total_count", "wide_count"]` — the KEY SET, not merely that expected values are present. Compliance Check ("Does obligation (b) assert the returned row's key set EXACTLY, mirroring P8-T2's HS-c from the service-e2e angle?"): **Y** — implemented exactly this way and observed passing against real Postgres (see run below).

**Row-ceiling clamp (obligation e) — exact values observed:**
- Seeded `LIST_ROW_CEILING + 20` = 520 extra published exams (id prefix `hc-svc-hc1-clamp-*`) each with one real `submitted` attempt by userB, via the service_role client directly in the test (fixtures module untouched — Target Files scope is the test file only).
- "Before" (unclamped read, `p_max_rows: 999`, well above the seeded ~520 candidates and below `POSTGREST_MAX_ROWS`): `data.length` observed `> LIST_ROW_CEILING` (500) — confirmed real, not assumed.
- "After" (production call shape, `p_max_rows: LIST_ROW_CEILING + 1` = 501): `data.length` observed **exactly `Math.min(LIST_ROW_CEILING + 1, POSTGREST_MAX_ROWS)` = 501**, computed from the imported constants, not hand-copied.
- This obligation is new coverage vs. `test-rls.ts` Phần 10 (which has no clamp case) and vs. `boundedRead.test.ts` (which pins the same invariant with a **mocked** query) — this is the first proof against the REAL SQL `limit least(greatest(coalesce(p_max_rows,500),1),1000)` clause.

**Hour-snap boundary (obligation d) — confirmed real timestamps:**
- `BEFORE_HOUR_BOUNDARY = HOUR_ANCHOR_MS - 1_000` (1s before `date_trunc('hour', p_since_recent)`, since `p_since_recent` = `RAW_SINCE_RECENT` = `HOUR_ANCHOR_MS + 37min`, truncates back to `HOUR_ANCHOR_MS`), `AFTER_HOUR_BOUNDARY = HOUR_ANCHOR_MS + 1_000` — both real ISO timestamps from `examHotCountsFixtures.ts`, seeded as real `exam_attempts.submitted_at` values, not simulated. Observed: `recent_count === 1` (only the after-boundary attempt), `total_count === 2` (both, since total_count has no time filter) — matches server-side `date_trunc` truncation, not the raw 37-minutes-past argument (which would have produced `recent_count === 0`).

**Full `npm run test:localdb -- tests/e2e/service/exam-hot-counts.service.e2e.test.ts --reporter=verbose` output:**
```
 ✓ ... > user A's authenticated call counts an exam only user B submitted (HS-b, obligation a) 174ms
 ✓ ... > a returned row's key set is exactly {exam_id, recent_count, wide_count, total_count} — no user_id/submitted_at/id/total_score (HS-c, obligation b) 131ms
 ✓ ... > in_progress attempts, unpublished exams and banned-author exams are excluded; a banned author's exam reappears once the ban is lifted (HS-d/HS-f, obligation c) 678ms
 ✓ ... > window boundaries snap to the HOUR server-side: an attempt 1s before date_trunc('hour', p_since_recent) is excluded, 1s after is included (obligation d) 140ms
 ✓ ... > p_max_rows clamps against the imported LIST_ROW_CEILING/POSTGREST_MAX_ROWS constants, not hand-copied literals (obligation e) 921ms
 ✓ ... > anon gets 42501; service_role gets an array (HS-e, obligation f) 283ms

 Test Files  1 passed (1)
      Tests  6 passed (6)
   Duration  5.78s
```
Full-lane run afterward (`npm run test:localdb`, all 4 service e2e files): `Test Files 4 passed (4)`, `Tests 25 passed (25)`.

**Dev cleanliness confirmed post-run:** queried dev directly (service_role) for any row/user matching `hc-svc-hc1-%` after the suite completed — `leftover exams: 0`, `leftover attempts: 0`, `leftover users: []`. `tearDown`'s existing prefix-scoped delete (P8-T3) cleans up both the fixture rows and this task's extra clamp-test rows, since they share the same `${HC_PREFIX}${slot}-` prefix.

**Gates run:** `npx tsc --noEmit` (project-wide) — clean. `npx eslint --max-warnings 0` (project-wide) — clean. `npm run build` — succeeds (Next.js 16.3.0, 22 routes). `npm run test:localdb` — 25/25 passed across all 4 service e2e files.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, including every comment block in the pre-committed skeleton
- [x] Confirm all 6 obligations currently run as `it.todo`
### 2. Green Phase
- [x] Wrap the top-level `describe` in `describe.skipIf(!HAS_LIVE_DB)`, importing `HAS_LIVE_DB` from P8-T3's fixtures module
- [x] Replace each `it.todo` with a real `it` implementing obligations (a)-(f) below
- [x] Run `npm run test:localdb` and iterate until all pass
### 3. Refactor Phase
- [x] Confirm the row-ceiling clamp assertion imports `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`, not a hand-copied literal
- [x] Confirm `examHotCountsFixtures.ts`'s `tearDown` runs cleanly after this file's full suite

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run test:localdb` — Enforces: real-Postgres service e2e (RLS isolation, grants, hour-snap) — Config: `SOURCE/vitest.localdb.config.ts:4-31`; Covered: `SOURCE/tests/e2e/service/exam-hot-counts.service.e2e.test.ts`

## Operation Verification Methods
- **Verification method**: `npm run test:localdb` — this is gate 6, and this task is the first case that makes it meaningful for this feature (the plan header's own caveat: "Gate 6 requires the dev database to carry the new schema fingerprint... implementation step 1 must land before a gate run means anything" — this task is where that finally closes the loop).
- **Success criteria**: all 6 obligations pass; the `describe.skipIf(!HAS_LIVE_DB)` guard correctly skips the suite in environments without live-DB access rather than failing.
- **Failure response**: if obligation (e)'s clamp assertion fails, re-check it is comparing against the imported constant's actual current value, not a value that was correct when the skeleton was authored but has since been retuned elsewhere.
- **Verification level**: L2 on live dev.

## Proof Obligations
- **Claim (a)** (from skeleton, verbatim): HS-b cross-user proof via real JWT.
  - **Primary failure mode**: same class as P0-T6/P8-T2's HS-b — automated here as the 3rd independent proof of the same cross-user aggregate claim.
  - **Boundary to exercise**: live dev Postgres, real second-user JWT, via this test file's own client setup (not `test-rls.ts`'s).
  - **State assertion**: N/A beyond the count check.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (b)** (from skeleton, verbatim): HS-c key-set-exact proof.
  - **Primary failure mode**: same class as P8-T2's HS-c and ADR-0021's Implementation Guidance — automated here as an independent, service-lane assertion (distinct test infrastructure from `test-rls.ts`, so a bug in one harness doesn't hide a regression the other would catch).
  - **Boundary to exercise**: live dev Postgres, real RPC call.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (c)** (from skeleton, verbatim): `in_progress`/unpublished/banned-author exclusion + banned-author reappearance after unban.
  - **Primary failure mode**: same class as P8-T2's HS-d/HS-f, from the service-e2e angle.
  - **Boundary to exercise**: live dev Postgres, real state transitions (unban).
  - **State assertion**: before ban → included; during ban → excluded; after unban → reappears.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (d)** (from skeleton, verbatim, Failure Mode: unavailable boundary / hour-snap): attempt 1s before `date_trunc('hour', p_since_recent)` excluded, 1s after included.
  - **Primary failure mode**: the window boundary is computed with a non-hour-snapped or off-by-one comparison, causing an attempt exactly at the boundary to be misclassified — a defect that would only surface at specific real-world timestamps, making it easy to miss without an explicit boundary test.
  - **Boundary to exercise**: live dev Postgres, real timestamps seeded 1s before and 1s after the hour-snap boundary.
  - **State assertion**: before → 2 attempts seeded, one on each side of the boundary; after → RPC call's counts reflect the boundary correctly (1 included, 1 excluded, or vice versa per direction).
  - **Mock boundary rationale**: none — window-boundary arithmetic must be proven against the real SQL `date_trunc` behavior, not a JS re-implementation.
  - **Residual**: none.
- **Claim (e)** (from skeleton, verbatim, Failure Mode: unavailable boundary / row-ceiling clamp): `p_max_rows` clamp asserted against IMPORTED `LIST_ROW_CEILING`/`POSTGREST_MAX_ROWS`, not hand-copied literals.
  - **Primary failure mode**: the clamp assertion hand-copies today's constant value as a literal, silently passing even after a future retune of `LIST_ROW_CEILING` desyncs the test from the real constant.
  - **Boundary to exercise**: live dev Postgres, seeded with more rows than the ceiling to force the clamp to actually engage.
  - **State assertion**: before → more candidate exams than `LIST_ROW_CEILING`; after → RPC response row count is clamped at the imported constant's current value.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim (f)** (from skeleton, verbatim, Failure Mode: missing config): `anon`→42501, `service_role`→array.
  - **Primary failure mode**: same class as P8-T1's probe and P8-T2's HS-e — the 4th independent layer proving the same grant boundary (verify-schema probe, RLS harness, service e2e, and — deferred to FQA-T7 — prod catalogue read).
  - **Boundary to exercise**: live dev Postgres, real anon and service_role clients.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: prod's equivalent grant state is FQA-T7's separate, deploy-time obligation.

## Completion Criteria
- [x] `describe.skipIf(!HAS_LIVE_DB)` wraps the suite correctly
- [x] All 6 obligations (a)-(f) converted from `it.todo` to `it`, passing on dev
- [x] `npm run test:localdb` green
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Gates 1-2, 4, 6 green

## Notes
- Impact scope: `exam-hot-counts.service.e2e.test.ts` fill-in only — the skeleton's structure/comments are not this task's to redesign, only to satisfy.
- Scope boundary: no production source files are touched by this task; fixture teardown must leave dev clean (verified jointly with P8-T3).
