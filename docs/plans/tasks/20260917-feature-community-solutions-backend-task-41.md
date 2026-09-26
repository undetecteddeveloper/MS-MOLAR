# Task 41: DB Migration — `community_reputation_summary()`

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P5-T2
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T2)
- **Dependencies**: task 03 (P1-T3), task 13 (P2-T1 — Helpful count + pin), task 32 (P4-T1)
- **Provides** (backend DD v1.9 § Migration Strategy "Migration ownership", task-41 row — **1 function**): `community_reputation_summary()`, consumed by task 43
- **Size**: Medium (5 files)

## Implementation Content

**This task tests its own migration** (backend DD v1.9 § Integration Verification Points, binding "Task ownership": "tasks 40 and 41 test their own migrations"), so the real-DB cases below are written here, not in a separate test task.

- `community_reputation_summary()` — no parameters (auth.uid() only; AC-089: can never look up someone else's reputation); returns `{ total_score int, published_count int, helpful_count int, pinned_count int }`; `total_score` computed fresh on every call with exactly Reference Contract Value #4's formula; no stored total anywhere.
- `helpful_count` sums Helpful rows **only on the caller's currently-published solutions** (AC-088 — un-publishing or admin-hiding removes them immediately because the sum is recomputed, not decremented); `pinned_count` counts currently-published pinned solutions.
- A writer with zero published solutions gets all-zero fields (AC-090).
- Drop-then-create, `set search_path`, `revoke all … from public, anon`, `grant execute … to authenticated`.
- No target-user parameter and **no exam-published gate** (ADR-0021 Decision 2 amendment note — the reputation summary is exempt from the exam-published half of the R1 gate).
- This is a **separate migration file** from task 40's (separate task, separate commit). If 40 and 41 ever land in **one** commit, one file carries the later fingerprint and this task owns no separate file (backend DD § Migration Strategy).

Add a localdb-lane file `SOURCE/tests/e2e/service/community-solutions-reputation.localdb.test.ts` (collected by `vitest.localdb.config.ts`; `describe.skipIf(!HAS_LIVE_DB)`, overview R4) carrying:

- **The fixed vector (Reference Contract Value #25), replayed end to end with all four fields asserted after every leg**: 2 published solutions with 32 Helpful rows on them, none pinned → `total_score = 84`; the exam author pins one → `104`; **ca 1** — the writer gỡ về nháp the NON-pinned solution, which carries 10 of the Helpful rows → `74`, and re-publishing it → `104`; **ca 2** — the writer gỡ về nháp the PINNED solution, which carries 10 Helpful rows → `54`, and re-publishing it with no other solution pinned meanwhile → `104` (AC-080); **ca 3** — the admin hard-deletes the non-pinned solution with 10 Helpful rows (`admin_moderate_community_solution('delete', …)`, task 32) → `74`, with no way back (S17, AC-106). No leg writes a total anywhere — every value is recomputed on read.
- **AC-088 badge rollback, same test**: with the writer at 5 published solutions, `published_count` is 5; after one is gỡ về nháp, **and separately** after the admin hides one, `published_count` is 4 and `total_score` is lower by exactly that solution's own contribution; after re-publishing (and after `'restore'`) both return to their earlier values with no row changed in between — the numbers the frontend's tier switch at 1 / 5 / 20 reads.
- **AC-090**: a writer with zero published solutions gets all-zero fields, never `null` and never an error.

## Acceptance Criteria

From the plan (§ P5-T2): **AC-067, AC-080, AC-086, AC-088–AC-090, AC-106, S17; Reference Contract Values #4 and #25**.

Carried hard constraints that apply to this task:
- **Migration chain (fixed order)**: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` + §17 `schema_version` upsert (last statement) → `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_reputation_<fingerprint>.sql` containing only this task's statements → apply to dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. **No PROD apply** (task 52 only).
- **Migration statement immutability**: no earlier statement redefined.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_reputation_<fingerprint>.sql` (new)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`
- [x] `SOURCE/supabase/verify-schema.ts` (probe judged by the **message** per backend DD v1.9 § Migration Strategy "Probe rule (v1.3)": anon client → message starting `permission denied for function`; probe user → rows with **no error** (rule 3 — this function's body never raises `42501`))
- [x] `SOURCE/tests/e2e/service/community-solutions-reputation.localdb.test.ts` (new)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (`community_solutions` status/`is_pinned`, `community_solution_helpfuls`)
- `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts` (task 16 localdb shape)
- `SOURCE/supabase/verify-schema.ts`
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_my_comment_feed(p_page, p_page_size)`, `community_reputation_summary()`)
- `docs/design/community-solutions-backend-design.md` (§ Acceptance Criteria — AC-086 reputation-on-read)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "Reputation fixed vector (v1.8, required) … (task 41, which tests its own migration)", incl. the AC-088 badge-rollback half)
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy — "Migration ownership (v1.8, binding)" task-41 row; "Probe rule (v1.3)")
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision — the 2026-09-17 amendment note: `community_reputation_summary` does not apply the exam-published check)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-067, AC-086, AC-088–AC-090, R18)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Grant `EXECUTE` explicitly and narrowly (`authenticated` only, never `anon`); `revoke all ... from public, anon` before every `grant` on a new function | `community_reputation_summary` is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only |

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Acceptance Criteria (AC-086)) | derived-display | "compute a caller's own reputation on read as `10 × published_count + 2 × helpful_count_on_published + 20 × pinned_published_count`, with no stored total." | The function body computes `total_score` as `10*published_count + 2*helpful_count + 20*pinned_count` from live rows on every call, and no table column stores a reputation total |
| `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points "Reputation fixed vector"; work plan Reference Contract Value #25) | derived-display | "2 published solutions, 32 Helpful rows on them, none pinned → `total_score = 84`; the exam author pins one → `104`; **ca 1** … → `74`, and re-publishing it → `104`; **ca 2** … → `54`, and re-publishing it with no other solution pinned meanwhile → `104` (AC-080); **ca 3** — the admin hard-deletes the non-pinned solution with 10 Helpful rows → `74`" | The localdb test replays the vector end to end and asserts `total_score`, `published_count`, `helpful_count` and `pinned_count` after **every** leg |

## Investigation Notes
(Append observations before implementation. Record each Compliance Check result.)

**Investigation Targets read (2026-09-27, pre-implementation):**
- `schema.sql` §20c (l.2640-2664): `community_solutions` has `status text` ∈ {draft, published, hidden} (check constraint), `is_pinned boolean not null default false`, **`unique (exam_id, author_id)`** (one solution per writer per exam — a writer's N published solutions sit on N different exams) and a partial unique index "one pin per exam". `community_solution_helpfuls` (§21, l.3076-3083): PK `(solution_id, user_id)`, `on delete cascade` from the solution — a hard delete removes its Helpful rows. Both tables closed (RLS on, all privileges revoked from anon/authenticated).
- `set_community_solution_status` (§20e): `'draft'`/`'publish'` update only `status`/`updated_at` — `is_pinned` is never touched, so a pinned solution that goes draft → published stays pinned (AC-080 "trở lại là bài ghim"); publish needs every current question's note ≥ 15 words and the caller's submitted attempt on a visible exam. `set_community_solution_pin(p_exam_id, p_action, p_solution_id)` (§21): exam author only, author must have a submitted attempt, target must be published; pin is per exam (atomic swap within the exam). `admin_moderate_community_solution(p_solution_id, p_action, p_reason)` (§23): `is_admin_user()` gate; `hide` published → hidden, `restore` hidden → published, `delete` hard-deletes the row (cascade notes/helpfuls/comments/reports) and writes `community_moderation_log` (`exam_id` FK on delete cascade — cleaned with the fixture exam). `is_pinned` untouched by hide/restore.
- §24 (task 40) is the last community block, §17 upsert is the last statement at fp `03b6b75d6ef5`. New block goes in as §25 directly above §17. `community_my_comment_feed` (§22) is the precedent for a `language sql stable security definer set search_path = public, pg_temp` read with `drop function if exists` + `create function` + revoke/grant.
- `community-solutions-list-order.localdb.test.ts` (task 16): shape = header comment naming task/migration/lane, `describe.skipIf(!HAS_LIVE_DB)` per fixture, per-describe PREFIX, `createStudent`/`submittedAttempt`/`cleanupByEmails`/`csWords` helpers, idempotent `cleanup()` in both `beforeAll` and `afterAll`, fixture rows written with the service-role `adminClient()`, the behaviour under test called through the user's own session client.
- Admin session in a test: `test-rls.ts` `signInAsSeededAdmin` — reads `admin_users ∩ ADMIN_USER_IDS` with service role, then exchanges a magic-link token for a real `authenticated` JWT of that admin (no service-role RPC, TD-029). `.env.local` has `ADMIN_USER_IDS`; `essayGradeWriteFixtures.ts` `loadEnvLocal()` loads every key. The localdb test reuses this pattern.
- `verify-schema.ts` mục 13 is the rule-1 + rule-3 precedent (`community_my_comment_feed`: anon message starts `permission denied for function`; probe user → no error, `PGRST202` → "apply migration"). New probe goes in as mục 16 after mục 15.
- Backend DD v1.9 § Data Contracts `community_reputation_summary()`: no input (auth.uid() only, AC-089); output `{ total_score int, published_count int, helpful_count int, pinned_count int }`; `total_score = 10*published_count + 2*helpful_count + 20*pinned_count` fresh on every call, no stored total; zero published → all-zero (AC-090); helpful_count only over currently-published solutions (AC-088). § Migration Strategy ownership: task 41 owns exactly this 1 function in `<ts>_community_solutions_reputation_<fp>.sql`; each function lands as drop / create / revoke from public, anon / grant to authenticated. Probe rule 3 lists this function.
- ADR-0021 Decision amendment 2026-09-17: `community_reputation_summary` is exempt from the exam-published half of R1 (counts by current status, S8) — so no `exams` join at all. Implementation Guidance: `revoke all … from public, anon` before `grant execute … to authenticated`.
- PRD AC-067 (Helpful count = live rows, +2 each), AC-080 (pin returns on re-publish/restore if author has not pinned another), AC-086 (formula + fixed vector, three cases), AC-088 (5 → 4 → 5 on draft or admin hide), AC-089 (nobody sees another's reputation), AC-090 (zero → "0"), R18.

**Fixed-vector reconciliation (not a design conflict):** PRD AC-086 / DD "Reputation fixed vector" gives *ca 1* (non-pinned solution carries 10 Helpful) and *ca 2* (pinned solution carries 10 Helpful) from the same "2 published, 32 Helpful" start; with 32 rows over two solutions, one solution holds 10 and the other 22, so the 10-Helpful solution must be the non-pinned one in ca 1/ca 3 and the pinned one in ca 2. The PRD labels them as separate cases ("ca 1/2/3"), each starting from 104. The test replays them for ONE writer end to end by moving the pin between legs with the exam author's own `set_community_solution_pin` (A = 10 Helpful on exam 1, B = 22 Helpful on exam 2): 84 → pin B 104 → ca 1 draft A 74 → publish A 104 → unpin B 84 → pin A 104 → ca 2 draft A 54 → publish A 104 (pin kept, AC-080) → unpin A 84 → pin B 104 → ca 3 admin delete A 74. Every value the vector names appears in order; the two re-pin legs are extra legs, also asserted on all four fields. No leg writes a total.

**Planned approach (Binding Decisions, axis dependency_direction):** `community_reputation_summary()` lands as `drop function if exists` → `create function … security definer set search_path = public, pg_temp` → `revoke all on function public.community_reputation_summary() from public, anon;` → `grant execute on function public.community_reputation_summary() to authenticated;` — nothing else granted. Pre-implementation evaluation: **Y**.

**Planned approach (Reference Contracts):**
- Row 1 (AC-086 formula): one `language sql stable` body — one aggregate over the caller's `status = 'published'` solutions (count, `coalesce(sum(live Helpful count per solution), 0)`, `count(*) filter (where is_pinned)`), and the outer `select` computes `10*… + 2*… + 20*…` in a single expression; no column/table is added. Pre-implementation evaluation: **Y**.
- Row 2 (fixed vector): the localdb test replays the vector as above, asserting all four fields after every leg with literal expected values. Pre-implementation evaluation: **Y**.

**Implementation record (2026-09-27):**
- `schema.sql` §25 (above §17): `drop function if exists public.community_reputation_summary()` → `create function … returns table (total_score int, published_count int, helpful_count int, pinned_count int) language sql stable security definer set search_path = public, pg_temp` → `revoke all … from public, anon` → `grant execute … to authenticated`. Body: CTE `mine` = one aggregate (no `group by` → always exactly one row) over `community_solutions cs where cs.author_id = auth.uid() and cs.status = 'published'`, with a `cross join lateral` live count of `community_solution_helpfuls` per solution; `coalesce(sum(…), 0)` (AC-090) and `count(*) filter (where cs.is_pinned)`; the outer `select` computes `10 * n_published + 2 * n_helpful + 20 * n_pinned` in one expression under an AC-086 comment. No `exams` join (ADR-0021 amendment), no parameter (AC-089), no column/table added. The only `-` line in the schema.sql diff is the old §17 fingerprint.
- Fingerprint `03b6b75d6ef5` → **`13a8e93ea8e7`** (`schema:plan`: 420 statements, 4 new = #413-#416); `SCHEMA_FINGERPRINT` + §17 upsert updated. Migration `SOURCE/supabase/migrations/20260929000000_community_solutions_reputation_13a8e93ea8e7.sql` = §25 block + upsert only (separate from task 40's file).
- Applied to DEV only (`hynwleaxtbtjzkvpjsug`, `supabase db query --linked --file`). Catalog read-back: `schema_version.fingerprint = 13a8e93ea8e7`; `proacl = {postgres=X, authenticated=X, service_role=X}` (no `anon`, no PUBLIC); `prosecdef = true`; `provolatile = s`; `proconfig = {search_path=public, pg_temp}`; result `TABLE(total_score integer, published_count integer, helpful_count integer, pinned_count integer)`. NOT applied to PROD (task 52).
- `verify-schema.ts` mục 16: anon → message starts `permission denied for function` (rule 1) ✓; probe user → rows, no error (rule 3) ✓, with `PGRST202` / missing-grant / other-error branches naming task 41.
- Localdb test `SOURCE/tests/e2e/service/community-solutions-reputation.localdb.test.ts` (4 describes, 9 cases, prefixes `cs41vec-` / `cs41roll-` / `cs41state-` / `cs41zero-`, idempotent cleanup before and after): fixed vector (one writer, 11 reads, all four fields asserted each time, pin by the exam author's `set_community_solution_pin`, draft/publish by the writer's `set_community_solution_status`, hard delete by the seeded admin's real `authenticated` session via `admin_moderate_community_solution('delete')`; after delete the solution's Helpful rows count 0 and `'restore'` returns `not found`, score stays 74); pin survives draft → publish (AC-080, `is_pinned = true` read back); "no stored total" (no reputation-like key on `community_solutions` / `user_profiles` rows); AC-088 draft route (80 → 44 → 80, the pinned 3-Helpful solution's contribution 36) and admin route (80 → 66 → 80 via hide/restore, the 2-Helpful solution's contribution 14); Proof Obligation state `{2, 8, 1, 56}` → `{1, 3, 0, 16}`; AC-090 zero user and draft-only (pinned, with Helpful) user both `{0, 0, 0, 0}`; AC-089 `p_user_id` overload → `PGRST202`; anon → `permission denied for function`.
- RED (before migration): 7 of 9 failed with `Could not find the function public.community_reputation_summary without parameters` (PGRST202). The 2 that passed are properties that hold without the function by construction (no stored-total column; no `p_user_id` overload). GREEN (after): 9/9.
- Residue on dev after runs: 0 `cs41%` exams / questions / solutions / users / moderation-log rows.
- TD-029: `SOURCE/lib/supabase/service-role.ts` not touched.
- Observation (out of scope): the verify probe user (`rlstesta`) currently has 1 published solution on dev (`total_score = 10`); rule 3 only requires "rows, no error", so it does not affect the probe.

**Binding Decision Compliance Check (Exit Gate re-evaluation):**
| Axis | Compliance Check | Result | Evidence |
|---|---|---|---|
| dependency_direction | `community_reputation_summary` is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only | **Y** | schema.sql §25 statement order (#414 create → #415 revoke → #416 grant); dev `proacl` has no `anon` / PUBLIC entry; verify:schema anon probe "permission denied for function" ✓; localdb anon case ✓ |

**Reference Contract Compliance Check (Exit Gate re-evaluation):**
| Row | Compliance Check | Result | Evidence |
|---|---|---|---|
| AC-086 formula | body computes `total_score` as `10*published + 2*helpful + 20*pinned` from live rows every call; no column stores a total | **Y** | §25 outer `select` single expression over the live aggregate; schema.sql diff adds no column/table; localdb "no stored total" case ✓; every recompute leg of the vector returns to 104 after draft/publish |
| Fixed vector #25 | localdb test replays the vector end to end, asserting all four fields after every leg | **Y** | fixed-vector case: 84 → 104 → 74 → 104 → (84 → 104) → 54 → 104 → (84 → 104) → 74, `toEqual` on the full 4-field row at each of 11 reads ✓ |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the localdb test — the fixed vector, the AC-088 rollback and the AC-090 zero case (Proof Obligations below); confirm it fails before the migration (function missing)

### 2. Green Phase
- [x] Complete `schema.sql`; `npm run schema:plan`; constant + upsert; migration; apply to dev; `npm run verify:schema`
- [x] Run the localdb test and confirm green

### 3. Refactor Phase
- [x] Keep the formula in one `select` expression with a comment citing AC-086
- [x] Confirm all checks remain green

## Quality Assurance Mechanisms
- `schemaFingerprint.test.ts` + `migrationsMatchSchema.test.ts` + `parseForeignKeys` + `bannedAuthorVisibility.test.ts` — Config: `SOURCE/lib/schema/__tests__/*.test.ts`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`
- `npm run test:localdb` — Config: `SOURCE/vitest.localdb.config.ts`
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: run `test:localdb` as `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: migration chain against dev; `npm run verify:schema`; `test:localdb` (lane rule).
- **Success criteria**: all Proof Obligation cases green on real dev Postgres.
- **Failure response**: if a stored total seems necessary for performance, stop and escalate — AC-086 forbids it.
- **Verification level**: L2 (real-DB test added and passing)

## Proof Obligations
- **Claim** (Reference Contract #4 / AC-086): `total_score = 10*published + 2*helpful_on_published + 20*pinned_published`, recomputed on every call.
- **Primary failure mode**: helpfuls on a draft/hidden solution still count, or pinned counts an unpublished pinned row.
- **Boundary to exercise**: live `community_reputation_summary()` from the writer's own session.
- **State assertion**: writer with 2 published (5 and 3 helpfuls, one pinned) → `{published 2, helpful 8, pinned 1, total 56}`; un-publish the 5-helpful pinned one → `{1, 3, 0, 16}` on the next call.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: TS mapping in task 43; UI in task 44.

- **Claim** (Reference Contract Value #25 / AC-080, AC-086, AC-106, S17): the fixed vector replays end to end — 84 → 104 → 74 → 104 → 54 → 104 → 74 — with all four fields asserted after every leg.
- **Primary failure mode**: a value is decremented rather than recomputed somewhere, so un-publishing and re-publishing does not return the score to `104`, or the hard-delete leg leaves the deleted solution's Helpful rows in the sum.
- **Boundary to exercise**: live `community_reputation_summary()` from the writer's own session after each leg, with the pin written by the exam author's `set_community_solution_pin` and the hard delete by the admin's `admin_moderate_community_solution('delete', …)` (task 32).
- **State assertion**: `total_score` 84 → 104 → 74 → 104 → 54 → 104 → 74, with `published_count`, `helpful_count` and `pinned_count` asserted at every step; no leg writes a total anywhere.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: the tier switch at 1 / 5 / 20 is rendered in task 44.

- **Claim** (AC-088 badge rollback): `published_count` drops to 4 from 5 when a solution is gỡ về nháp and, separately, when the admin hides one, and `total_score` drops by exactly that solution's contribution — both restored by re-publish / `'restore'`.
- **Primary failure mode**: an admin hide is not treated like un-publishing, so a hidden solution keeps earning reputation (or its Helpful rows keep counting).
- **Boundary to exercise**: live `community_reputation_summary()` around `set_community_solution_status('draft')` and `admin_moderate_community_solution('hide' | 'restore', …)`.
- **State assertion**: 5 → 4 → 5 on `published_count` on both routes, with the matching `total_score` delta and no row changed in between.
- **Mock boundary rationale**: none.
- **Residual**: the badge rollback's UI half is task 44.

- **Claim** (AC-090): zero published solutions → all-zero fields, not null and not an error.
- **Primary failure mode**: `sum()` over no rows returns `null`.
- **Boundary to exercise**: live call from a user with no solutions.
- **State assertion**: result = `{0, 0, 0, 0}`.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All added probes/tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: task 43 wraps this function; task 44 renders it.
- Scope boundary: no PROD apply; no stored reputation column anywhere.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
