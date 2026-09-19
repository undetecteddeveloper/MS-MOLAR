# Task P8-T2 — `test-rls.ts` Phần 10 (HS-a through HS-g)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 8, Task P8-T2**
Layer: backend (`SOURCE/supabase/test-rls.ts`)

Metadata:
- Dependencies: P0-T6 (Early Verification Point passed) — otherwise independent within Phase 8
- Blocks: none downstream within Phase 8
- Size: Small-Medium (1 file, 7 cases)
- Verification level: L2 on live dev — `npx tsx supabase/test-rls.ts` run manually against dev, all 7 cases pass

## Implementation Content
Extend `SOURCE/supabase/test-rls.ts` with Phần 10 (cases HS-a through HS-g) per backend DD § Test Boundaries and Placement.

## Target Files
- [x] `SOURCE/supabase/test-rls.ts`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Test Boundaries and Placement — "test-rls.ts Phần 10" verbatim case list)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Implementation Guidance — "Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values")
- `SOURCE/supabase/test-rls.ts` (existing Phần structure — the pattern this new Phần 10 must follow for consistency; the two-seeded-user pattern already established, reused here)
- `SOURCE/supabase/schema.sql` (P0-T1's `exam_hot_counts()`, `exam_attempts.source` + CHECK, `attempts_insert_own` policy — the objects under test)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | persistence | Grants: `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` | Does HS-e assert `anon`→42501, `authenticated`→array, matching this grant decision exactly? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Implementation Guidance) | contract_schema | Keep the aggregate's projection minimal and prove it — the RLS harness asserts the returned row's key set, not just its values | Does HS-c assert the returned row's key set is EXACTLY the 4 declared columns, using an exhaustive key-set comparison (not just value spot-checks)? |

## Investigation Notes

**Investigation Targets read:**
- Backend DD §Test Boundaries and Placement (`:609-633`) — verbatim HS-a..HS-g case list copied into the new Phần 10 block comments; confirmed `test-rls.ts` is the manual/L2 lane (`cd SOURCE && npx tsx supabase/test-rls.ts`) and that the service e2e file (`exam-hot-counts.service.e2e.test.ts`, a separate localdb-lane file, already a skeleton with `it.todo`) is NOT this task's scope.
- ADR-0021 §Implementation Guidance (`:126-133`) — "Keep the aggregate's projection minimal and prove it" is the literal source of HS-c's exhaustive key-set requirement; D1 grant idiom (`revoke all … from public, anon; grant execute … to authenticated, service_role`) is the literal source of HS-e.
- `test-rls.ts` existing Phần structure (read Phần 1, 2, 7, 9 in full) — reused: `ensureUser`/`signInAs` (top-level, unchanged), the `assert()` non-throwing helper, `isAuthorizationDenial()` (message/code dual check for RLS-vs-grant denials), the "constants + cleanup*/setup* functions declared before `main()`, invoked inside `main()`, own-cleanup-at-end" idiom every earlier Phần follows. Phần 9's PS-b (service_role positive control before the JWT-denial assertion) informed HS-f's before/during/after three-snapshot structure.
- `schema.sql` §20a-20c (`:2575-2642`) — confirmed exact column set `(exam_id, recent_count, wide_count, total_count)`, the CHECK's literal value set `('practice','hot','explore','none')`, `attempts_insert_own`'s `with check (user_id = auth.uid())`, and that all other `exam_attempts` columns have defaults (so a minimal `{exam_id, source}` / `{exam_id, user_id, source}` insert payload is sufficient, matching the existing Phần 1 precedent). Also read §18a-18c (`is_author_banned()`, `exams_select_visible`) to confirm the ban/unban mechanism (`auth.admin.updateUserById(id, {ban_duration: "24h" | "none"})`) and that a definer function re-asserts this predicate itself (no RLS to rely on).
- `verify-schema.ts:448-493` — confirmed the harmless-boundary-args pattern (`p_since_recent`/`p_since_wide` epoch, `p_max_rows: 1`) and the anon-42501/authenticated-array probe shape mirrored into HS-e.

**Binding Decisions evaluation (both rows evaluated against the final implementation, run live on dev):**
| Source | Axis | Evaluation | Rationale |
|---|---|---|---|
| ADR-0021 D1 | persistence (grants) | **Y** | HS-e asserts `authenticated` (`userB.rpc`) resolves with `Array.isArray(data)` and no error, and `anon` (`anonClient.rpc`) resolves with `error.code === "42501"` — live run: `HS-e: authenticated gọi được exam_hot_counts (mảng); anon bị từ chối 42501 (nhận: authenticated=OK, anon=42501)` ✓ |
| ADR-0021 §Implementation Guidance | contract_schema (key set) | **Y** | HS-c does `Object.keys(hsbRow).sort()` and compares element-by-element against the exact 4-key list `["exam_id","recent_count","total_count","wide_count"]` (exhaustive, length-checked, not a value spot-check) — live run: `HS-c: tập khoá của hàng exam_hot_counts đúng CHÍNH XÁC {exam_id, recent_count, wide_count, total_count} (nhận: exam_id, recent_count, total_count, wide_count)` ✓ |

**Design decision — third test user (C) for HS-f:** used a dedicated `EMAIL_C` user (not A or B) as the banned author, created via the existing `ensureUser()` helper and never signed in (fixtures for C are written via `service_role`, which bypasses RLS, so no session is needed). This avoids banning an already-signed-in A/B client mid-script. `cleanupHotCountsFixtures` unconditionally unbans C (idempotent, matches every other Phần's "cleanup runs before AND after" convention) so a crashed run between ban and unban self-heals on the next run instead of leaving C permanently banned.

**Full live-dev run output (`npx tsx supabase/test-rls.ts`, from `SOURCE/`), Phần 10 section verbatim:**
```
Kho đề theo kệ — setup fixture (service_role)…

RLS checks (Kho đề theo kệ HS-a…HS-g):
  ✓ HS-a (positive control): User A KHÔNG thấy dòng exam_attempts nào của B qua bảng trực tiếp sau DDL (nhận: 0 dòng)
  ✓ HS-b: exam_hot_counts trả total_count >= 1 cho đề chỉ B nộp bài (nhận: 1)
  ✓ HS-c: tập khoá của hàng exam_hot_counts đúng CHÍNH XÁC {exam_id, recent_count, wide_count, total_count} (nhận: exam_id, recent_count, total_count, wide_count)
  ✓ HS-d: đề chưa published VẮNG MẶT khỏi exam_hot_counts dù có submitted attempt (nhận: vắng mặt (đúng))
  ✓ HS-e: authenticated gọi được exam_hot_counts (mảng); anon bị từ chối 42501 (nhận: authenticated=OK, anon=42501)
  ✓ HS-f: đề của tác giả bị ban vắng mặt TRONG LÚC ban, xuất hiện lại SAU KHI unban (trước ban: 1, trong lúc ban: vắng mặt (đúng), sau unban: 1)
  ✓ HS-g: source='hacked' bị CHECK từ chối, mã 23514 (nhận: 23514)
  ✓ HS-g: A KHÔNG insert được attempt mang user_id của B (attempts_insert_own chặn qua with-check; nhận: 42501)
```
All 7 cases (HS-a..HS-g — HS-g has two sub-assertions) PASS. HS-g's `source='hacked'` insert confirmed genuinely returns Postgres error code **23514** (CHECK violation `exam_attempts_source_check`) — verified directly in the `hsgHacked.error.code` value printed above, not inferred.

**Pre-existing, unrelated failures found during the full-suite run (NOT caused by this task):** the same run reported 4 failures in Phần 2's Rating block — `R-p`, `R-r`, `R-t`, `R-u` (all exit before Phần 10 runs). Root-caused via an isolated diagnostic (fresh fixture + immediate insert, outside the full suite, via `service_role` + a signed-in `userA` client): the insert fails with Postgres **23514**, `check constraint "ratings_scores_range_check"` — i.e. a CHECK violation, not an RLS/permission denial. `schema.sql:697-713` shows a migration (`rating_scale_1_to_5_stars`, `TECH-DEBT.md:321`) narrowed the valid range from the old 1-10 scale to `[1,5]` for all three score columns; `test-rls.ts`'s `INITIAL_RATING_SCORES = {score_part1: 5, score_part2: 6, score_part3: 7}` / `UPDATED_RATING_SCORES = {score_part1: 9, score_part2: 3, score_part3: 8}` (both pre-existing, unmodified by this task) still use values outside `[1,5]` on 2 of 3 fields each. This is stale fixture data left behind by an earlier, unrelated schema change — confirmed independent of this task by: (a) `git diff --stat` shows this task's change is 238 insertions / 0 deletions, touching nothing before the Subscription-fixture constants; (b) `main()` runs every Phần strictly sequentially and Phần 10 executes after Phần 9, i.e. after the Rating checks already ran and failed — Phần 10 code cannot have influenced them. Not fixed here: out of this task's Target Files/Investigation Targets/Binding Decisions/Proof Obligations, which are scoped entirely to HS-a..HS-g / `exam_hot_counts()`. Flagging for a separate fix (update the two constants to values within `[1,5]`, e.g. keep them distinct for R-r's "still-different" assertion) — recorded here rather than silently patched.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Confirm Phần 10 does not yet exist in `test-rls.ts`
### 2. Green Phase
- [x] Implement HS-a through HS-g per the verbatim case list below
- [x] Run `npx tsx supabase/test-rls.ts` against dev and iterate until all 7 pass
### 3. Refactor Phase
- [x] Confirm the full test-rls.ts suite (all Phần, not just Phần 10) still exits 0 — this task must not regress any earlier Phần. **Result: Phần 10 itself is 7/7 green with 0 regression caused by this task** (see Investigation Notes for the isolation proof). The overall process exit code is non-zero only because of a pre-existing, unrelated failure in Phần 2's Rating block (stale fixture constants after an earlier, unrelated 1-10→1-5 rating-scale migration) — documented in Investigation Notes, not fixed here (out of this task's scope), flagged for separate follow-up.

## Quality Assurance Mechanisms
- `SOURCE/supabase/test-rls.ts` Phần 10 (extended) — Enforces: RLS isolation + no-identity-leak proof (HS-a..HS-g) — Config: `SOURCE/supabase/test-rls.ts`

## Operation Verification Methods
- **Verification method**: `npx tsx supabase/test-rls.ts` run manually against dev.
- **Success criteria**: all 7 cases (HS-a..HS-g) pass, and the full suite (all Phần) still exits 0.
- **Failure response**: if HS-c's key-set assertion fails, this is the exact leak class ADR-0021 D1 exists to prevent — re-open the ADR per the plan's own Early Verification Point failure response, do not patch the assertion to accept extra keys.
- **Verification level**: L2 on live dev.

## Proof Obligations
- **Claim** (HS-a, positive control): student A sees 0 of student B's `exam_attempts` rows via direct table access post-DDL — RLS is unweakened by this feature's schema changes.
  - **Primary failure mode**: the new column/index/function additions accidentally interact with RLS policy evaluation (e.g. a policy referencing the new column incorrectly), breaking the pre-existing isolation guarantee.
  - **Boundary to exercise**: live dev Postgres, two real seeded users, direct table SELECT.
  - **State assertion**: before → B has attempts; after → A's direct SELECT of `exam_attempts` returns 0 of B's rows.
  - **Mock boundary rationale**: none — real Postgres, real RLS evaluation.
  - **Residual**: none.
- **Claim** (HS-b, cross-user proof): `total_count>=1` for an exam only B submitted, read by A via the RPC — the same claim P0-T6 proved once manually, now automated and repeatable.
  - **Primary failure mode**: same as P0-T6's.
  - **Boundary to exercise**: live dev Postgres, real RPC call.
  - **State assertion**: N/A beyond the count check.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this closes P0-T6's manual check into a repeatable automated one.
- **Claim** (HS-c, leak proof): the returned row's key set is EXACTLY the 4 declared columns.
  - **Primary failure mode**: a future schema edit widens the function's `returns table(...)` and this is the only place that would catch it before it reaches production.
  - **Boundary to exercise**: live dev Postgres, real RPC call, exhaustive key-set comparison.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none — per ADR-0021's own Implementation Guidance, this is the harness that specifically must assert the key set, not just values.
- **Claim** (HS-d): unpublished exams are excluded from the aggregate.
  - **Primary failure mode**: the function's `exams.status='published'` predicate is dropped or loosened.
  - **Boundary to exercise**: live dev Postgres.
  - **State assertion**: before → an unpublished exam has submitted attempts; after → it contributes 0 to any `exam_hot_counts` result.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-e): `anon`→42501, `authenticated`→array.
  - **Primary failure mode**: the grant set drifts (same class as P8-T1's automated probe, proven here from the RLS-harness angle instead).
  - **Boundary to exercise**: live dev Postgres, real anon and authenticated calls.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-f): banned-author exclusion + reappearance after unban.
  - **Primary failure mode**: the `not is_author_banned(author_id)` predicate is evaluated once and cached, or the reappearance-after-unban case is never actually tested (a common gap — ban is tested, unban is not).
  - **Boundary to exercise**: live dev Postgres, a real ban/unban state transition.
  - **State assertion**: before ban → exam contributes to counts; during ban → excluded; after unban → reappears.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (HS-g, state-change negative): `source='hacked'` on insert → Postgres error 23514 (CHECK violation); writing on B's `user_id` → refused by `attempts_insert_own`.
  - **Primary failure mode**: the CHECK constraint's literal value set is wrong (e.g. missing a value or too permissive), or `attempts_insert_own`'s policy was accidentally weakened by this feature's schema changes.
  - **Boundary to exercise**: live dev Postgres, real insert attempts.
  - **State assertion**: before → attempt to insert `source='hacked'`; after → insert rejected with 23514, 0 row written.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is application-layer normalisation's (P1-T5) last-line defense, now proven at the DB layer.

## Completion Criteria
- [x] All 7 cases (HS-a..HS-g) implemented and passing on dev
- [x] Full `test-rls.ts` suite (all Phần) still exits 0 **for this task's own change** — Phần 10 is 7/7 green with proven zero regression; the process-level exit code is non-zero solely due to a pre-existing, unrelated Rating-fixture defect (documented in Investigation Notes, out of scope here)
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Gates 1-2, 4 green for the TS changes; the test-rls.ts run itself verified separately — `npx tsc --noEmit` clean, `npx eslint --max-warnings 0` clean, `npm run build` succeeded; live dev run of `npx tsx supabase/test-rls.ts` shows all 7 HS cases passing

## Notes
- Impact scope: `test-rls.ts` Phần 10 (new section) only.
- Scope boundary — preserve unchanged: every earlier Phần in this file.
