# Task P0-T6 — Early Verification Point (GATING): cross-user `exam_hot_counts` call as a second student

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T6 — the plan's designated Early Verification Point**
Layer: backend (dev database — no source files changed)

Metadata:
- Dependencies: P0-T5 (`verify:schema` green on dev)
- Blocks: **the entire rest of the plan** — Phase 1 may not begin until this task passes
- Size: Small (0 files; 1 manual/scripted RPC call sequence)
- Verification level: L1 (real cross-user functional proof)

## THIS IS A HARD GATE

Per the work plan's Verification Strategy header: **"Failure response: STOP — do not write any shelf code (Phase 1 onward)."** A count of 0 means the function is not running as definer or the grant is wrong; extra keys mean the projection leaked and ADR-0021 D1's security argument is void. Re-open the ADR rather than patch at a call site.

## Implementation Content
As a **second** authenticated student (a different JWT from the seed/dev account used in P0-T4's read-back), call `exam_hot_counts(...)` directly and confirm a non-zero `total_count` for an exam only the **first** student submitted, and that the returned row's key set is exactly `{exam_id, recent_count, wide_count, total_count}`.

**How to get the second session**: reuse the two-seeded-user pattern `SOURCE/supabase/test-rls.ts` and `SOURCE/tests/e2e/service/examSearchFixtures.ts` already use — `admin.auth.admin.createUser(...)` + `signInWithPassword(...)` for a second real test account (or, if faster for a one-off manual check, log in as a second existing dev-seed account through the same CLI session the engineer already uses, then call the RPC with that session's JWT via `supabase.rpc("exam_hot_counts", {...})`).

## Target Files
- [ ] None (dev database `hynwleaxtbtjzkvpjsug` only — no source files changed by this task)

## Investigation Targets
- `docs/plans/20260918-feature-exam-shelves.md` (§ Early Verification Point, plan header — verbatim success/failure criteria)
- `SOURCE/supabase/test-rls.ts` (the two-seeded-user pattern: `admin.auth.admin.createUser` + `signInWithPassword`)
- `SOURCE/tests/e2e/service/examSearchFixtures.ts` (the same two-user fixture pattern, as a second reference example)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D1 — what "aggregate-only projection" means for the key-set check)

## Investigation Notes

**Investigation Targets read:**
- `docs/plans/20260918-feature-exam-shelves.md` § Early Verification Point (`:25-28`): verbatim success/failure criteria — `total_count >= 1` for an exam only the first student submitted, key set exactly the four declared columns, STOP on failure.
- `SOURCE/supabase/test-rls.ts`: the two-seeded-user pattern (`ensureUser` via `admin.auth.admin.createUser` + fallback `listUsers`/`updateUserById`; `signInAs` via `createClient` + `signInWithPassword`). This file's `PROBE_EMAIL` constant in `verify-schema.ts:137` (`smithnguyen247+rlstesta@gmail.com`) is the *same* account as `test-rls.ts`'s `EMAIL_A` — confirms these two accounts (`EMAIL_A`/`EMAIL_B`, password `rls-test-password-123`) are the project's established, shared test-student convention, reused here rather than creating new accounts.
- `SOURCE/tests/e2e/service/examSearchFixtures.ts`: second reference example of the same admin-create + sign-in pattern (per-slot single student), confirming the pattern generalizes.
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` § Decision D1: "aggregate-only projection... The projection carries no user id, no timestamp, no score" and "The RLS harness asserts the returned row's key set, not just its values" (Implementation Guidance) — confirms the key-set check (exactly `{exam_id, recent_count, wide_count, total_count}`, no extras) is the correct operationalization of D1's security argument.
- `SOURCE/supabase/schema.sql:2602-2634` (`exam_hot_counts` definition): confirmed signature `(p_since_recent timestamptz, p_since_wide timestamptz, p_max_rows int default 500)`, predicates `status='submitted'` + `e.status='published'` + `not is_author_banned(author_id)`, and that `total_count` is an unwindowed `count(*)` (not gated by either `p_since_*` boundary) — so any valid window values prove the claim, only the predicates matter. Also confirmed `is_author_banned(null)` is documented (`:2448-2450`) and coded (`:2471-2485`) to return `false`, so a fixture exam with `author_id: null` is visible.
- `SOURCE/supabase/schema.sql:192-209` (`exam_attempts`), `:263-274` (RLS policies `attempts_select_own`/`attempts_insert_own`/`attempts_update_own`): `attempts_insert_own` only checks `with check (user_id = auth.uid())` — no column-value restriction — so the first student's own authenticated client can insert a row with `status: 'submitted'` directly (a genuine RLS-governed write, not an admin/service-role bypass).

**Second-session mechanism used**: reused `test-rls.ts`'s existing two-seeded-user pattern verbatim (`ensureUser` + `signInAs` functions, copied into a transient script) against the project's existing shared test-student accounts `EMAIL_A = smithnguyen247+rlstesta@gmail.com` (first student, `userAId = f7b89cd1-17e5-4b4f-8766-d93dff9ab879`) and `EMAIL_B = smithnguyen247+rlstestb@gmail.com` (second, different student, `userBId = d779b786-fbd3-4674-a843-75ed7c2d6e10`). No new accounts were created.

**Fixture and exam id**: seeded `exams.id = 'p0-t6-hotcheck-exam'` (published, `author_id: null`) via service-role admin client. **First student (A)** then inserted+submitted `exam_attempts` for that exam **via A's own authenticated client** (`status: 'submitted'`, `submitted_at: now()` at insert time) — confirmed to be the *only* submitted attempt on this exam (freshly created id, no other writer touched it).

**Before-state check (RLS, second student cannot see the row directly)**:
```
BEFORE: User B direct read of A's attempt row -> error=null rows=0 (expect 0)
```

**Live cross-user RPC call** — second student (B) called `exam_hot_counts` with `p_since_recent = now-7d`, `p_since_wide = now-30d`, `p_max_rows = 500`. Raw response (all 12 rows returned on dev, unmodified):
```json
[{"exam_id":"exam-ly-10","recent_count":0,"wide_count":0,"total_count":24},{"exam_id":"exam-hoa-10","recent_count":0,"wide_count":1,"total_count":12},{"exam_id":"ugc-e3048c6e-cea7-46ed-abd5-0fa07a92f0c8","recent_count":1,"wide_count":3,"total_count":6},{"exam_id":"ugc-7b9029ae-2998-4f6c-966b-277516d747cd","recent_count":0,"wide_count":0,"total_count":4},{"exam_id":"exam-toan-10","recent_count":0,"wide_count":1,"total_count":3},{"exam_id":"l1seed-exam-tuluan","recent_count":0,"wide_count":3,"total_count":3},{"exam_id":"e1mp-exam-lowest","recent_count":0,"wide_count":1,"total_count":2},{"exam_id":"e1mp-exam-prereq","recent_count":0,"wide_count":1,"total_count":2},{"exam_id":"e1mp-exam-recent","recent_count":0,"wide_count":1,"total_count":2},{"exam_id":"e1mp-exam-tutor","recent_count":0,"wide_count":0,"total_count":2},{"exam_id":"p0-t6-hotcheck-exam","recent_count":1,"wide_count":1,"total_count":1},{"exam_id":"ugc-20c3b8f7-c24e-473b-afb0-01250aa11c36","recent_count":0,"wide_count":0,"total_count":1}]
```
Target row (`exam_id = 'p0-t6-hotcheck-exam'`): `{"exam_id":"p0-t6-hotcheck-exam","recent_count":1,"wide_count":1,"total_count":1}`.

**Checks**:
- `total_count = 1` → `>= 1` — **PASS**. Confirms the function runs as `security definer` with the correct EXECUTE grant to `authenticated`: student B, who never submitted this exam and cannot read A's row directly (proven above), still gets the true cross-user count via the RPC.
- Key set `["exam_id","recent_count","total_count","wide_count"]` (sorted) === expected `["exam_id","recent_count","total_count","wide_count"]` (sorted) — **exact match, PASS**. No extra column leaked; ADR-0021 D1's aggregate-only projection holds in the running database, not just in `schema.sql` text.

**Cleanup**: fixture attempt + exam deleted via the script's own cleanup (before-run idempotent delete + after-run delete); verified via a direct `npx supabase db query` read-back that both `exams.id = 'p0-t6-hotcheck-exam'` and its `exam_attempts` row are gone from dev post-run (0 rows). The two shared test-student accounts (`EMAIL_A`/`EMAIL_B`) are intentionally left in place — they are persistent, reusable project fixtures per `test-rls.ts`'s own convention, not per-task throwaways.

**Execution mechanics**: ran as a transient `SOURCE/_p0-t6-verify.ts` script (`cd SOURCE && npx tsx _p0-t6-verify.ts`), deleted immediately after the run — `git status --porcelain` from the worktree root shows no tracked/untracked changes attributable to this task (only the pre-existing, unrelated `?? supabase/` entry that predates this task). Matches the task's own Target Files declaration (`None`).

**Early Verification Point outcome: PASS.** Both gating conditions hold on live dev Postgres with a real second JWT. Phase 1 is unblocked.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Identify (or seed) an exam submitted only by the first student
- [x] Obtain a second authenticated session (different JWT) via one of the two documented patterns
### 2. Green Phase
- [x] Call `exam_hot_counts(p_since_recent, p_since_wide, p_max_rows)` as the second session
- [x] Record the raw response rows
### 3. Refactor Phase
- [x] Confirm the response row for the target exam has `total_count >= 1`
- [x] Confirm `Object.keys(row)` (or SQL column list) is exactly `{exam_id, recent_count, wide_count, total_count}` — no extra column

## Quality Assurance Mechanisms
- `npm run verify:schema` (extended) — Config: `SOURCE/supabase/verify-schema.ts:448-493` (this manual check is the human-run precursor to what P8-T1 automates)

## Operation Verification Methods
- **Verification method**: direct RPC call to `exam_hot_counts` as a second, different authenticated student, against dev.
- **Success criteria**: the returned row has `total_count >= 1` for an exam id the first student (and only the first student) submitted, and the row's key set is exactly the four declared columns (`exam_id`, `recent_count`, `wide_count`, `total_count`).
- **Failure response**: **STOP — do not proceed to Phase 1.** A count of 0 means the function is not running as `security definer` or the grant is wrong; extra keys mean the projection leaked and ADR-0021 D1's security argument is void. Re-open the ADR rather than patch at a call site.
- **Verification level**: L1 — this is the plan's headline correctness proof for the whole cross-user aggregate mechanism, run against a real second identity.

## Proof Obligations
- **Claim**: `exam_hot_counts()` correctly aggregates across users — a student who never submitted an exam can still read its cross-user count.
  - **Primary failure mode**: the function is not actually running with definer rights (e.g. `security definer` was dropped or the owner lacks the underlying table grants), so the second student's RLS-scoped view returns 0 regardless of the true count.
  - **Boundary to exercise**: live dev Postgres, real second JWT, real RPC call — no mock, no fixture stand-in.
  - **State assertion**: before → second student has never submitted the target exam and cannot see the first student's row directly (RLS); after → second student's RPC call returns `total_count >= 1` for that exam.
  - **Mock boundary rationale**: none — mocking this call would defeat the entire purpose of the Early Verification Point.
  - **Residual**: this proves the happy path (a genuine cross-user count). The negative/leak proofs (exact key set enforced under adversarial conditions, anon denial, banned-author exclusion) are P8-T2's HS-a..HS-g and P8-T4's service e2e — deferred to Phase 8 by design, not skipped.
- **Claim**: the aggregate's projection is exactly the 4 declared columns — no identity-bearing or extra field leaks through.
  - **Primary failure mode**: the function's `returns table(...)` declaration (or an accidental `select *`) includes more columns than declared, silently widening what a cross-user caller can observe.
  - **Boundary to exercise**: live dev Postgres, real RPC response inspected for its exact key set.
  - **State assertion**: N/A beyond the key-set check above.
  - **Mock boundary rationale**: none.
  - **Residual**: this is a single-call spot check; P8-T2's HS-c is the systematic, repeatable version of the same assertion inside the RLS harness.

## Completion Criteria
- [x] Second-session RPC call executed against dev with real second-student credentials
- [x] `total_count >= 1` confirmed for an exam submitted only by the first student
- [x] Response key set confirmed exactly `{exam_id, recent_count, wide_count, total_count}`
- [x] Investigation Notes record the raw response, not a paraphrase
- [x] If either check fails: **task is NOT complete**, Phase 1 must not begin, and ADR-0021 must be re-opened rather than patched at a call site — N/A, both checks passed

## Notes
- Impact scope: this is the gate on the whole feature. If this fails, stop — do not continue to Phase 1.
- Scope boundary: no source files touched by this task.
