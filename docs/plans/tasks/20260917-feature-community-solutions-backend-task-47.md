# Task 47: Service-integration-e2e SE1 + SE2 — implement and EXECUTE against real dev Postgres

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P5-T8
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T8)
- **Dependencies**: all migration tasks from Phases 1–5 applied to dev — task 03 (P1-T3), task 13 (P2-T1), task 25 (P3-T1), task 32 (P4-T1), task 40 (P5-T1), task 41 (P5-T2)
- **Provides**: the real-DB persistence proof fixture-e2e J1 (task 23) cannot give, and the live anonymity null-value + admin true-identity proof. **This is the only task in which the service-integration-e2e skeleton runs.**
- **Size**: Small (2 files)

## U1 is resolved (no gate on this task); SK-2 fixes SE2's admin leg

**U1.** The three write tables carry RLS with **no policy and no grant**; every user write goes through a `SECURITY DEFINER` RPC. SE2's anonymous comment is therefore created with `post_community_comment(..., p_is_anonymous => true)` **by the commenter's own session** — the table has no insert path of its own — and it must sit under a note of **at least 15 words** for its question, or `post_community_comment` refuses it with `42501` (AC-048).

**SK-2 (plan § Open Items, resolved 2026-09-20 by the orchestrator; the engineer may overrule before this task starts).** The skeleton's SE2 expects `community_solutions_list()` / `community_solution_detail()` to show the TRUE identity to an `admin_users` session. Backend DD v1.6+ masks those two functions **by `show_profile` alone for every caller, admins included** (AC-062, no admin exception) — so an admin read of them returns the same `null`s session B gets. The only admin path to real identity is `admin_list_community_reports()`, which returns the writer's real `author_display_name` and `author_is_anonymous_to_readers`, and **no `author_id` and no avatar path**. Resolution: **SE2's admin leg reads the same solution through `admin_list_community_reports()`** and asserts the real display name plus `author_is_anonymous_to_readers = true`. The skeleton's own `@dependency` line already allows this ("`admin_list_community_reports` (or the admin-scoped equivalent read)"). Do **not** add an admin exception to a masking RPC to make the skeleton's literal wording pass — that would break AC-062 and task 16's writer-self-read case.

## Implementation Content

Fill both tests in the existing skeleton `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` (real imports, `describe.skipIf(!HAS_LIVE_DB)`, `@supabase/supabase-js` clients from `.env.local`, `ensureUser`/`signInAs`-style accounts: submitted user "A", non-author/non-admin "B", admin "Admin" = a real `admin_users` member on dev). Put prefixed, idempotently-cleaned-up fixture helpers in a new `SOURCE/tests/e2e/service/communitySolutionsServiceFixtures.ts`, mirroring `essayGradeWriteFixtures.ts`.

- **SE1**: A calls `save_community_solution()` then `set_community_solution_status('publish')` through **A's own session client (never service_role)** against dev. Three checks, each with direct read-backs before and after (independent of the RPC under test):
  1. happy path reaches `published`;
  2. a note artificially shortened below 15 words → `set_community_solution_status('publish')` raises **`23514`**, and the caught error's **DETAIL is the decimal missing count** (a string comparison — `'3'`, never `' 3'`, `'3 questions'` or `'+3'`), with **no row change** (status and every `community_solution_notes` body unchanged). **Assert on `error.details`, never on `error.message`** (Reference Contract Value #12; backend DD "Missing-count carrier"). A `save_community_solution` call with a 9-word note on the published solution raises `23514` whose DETAIL is exactly `below_word_count` (Reference Contract Value #13) — the token that separates it from the body-length CHECK;
  3. a non-submitter's call → rejected `42501` with **zero** `community_solutions` row for that `(exam_id, author_id)`.
- **SE2**:
  - **Fixtures**: A publishes a solution with `show_profile = false`, `show_score = false` and a ≥15-word note on the commented question (both required: `show_profile = false` is what the masking asserts, the ≥15-word note is what lets a comment exist at all). B — a different, non-author, non-admin submitted user — posts the anonymous comment with `post_community_comment(..., p_is_anonymous => true)` from B's own session.
  - **Masked read (B's session)**: `community_solutions_list()` and `community_solution_detail()` — the **actual JSON body** has `author_id`, `author_display_name` and `author_avatar_path` equal to JSON `null` (keys present, `returns table` always serializes them), and `score`, `score_grading` and `per_question` equal `null` together for the `show_score = false` row. The anonymous comment's `author_id` / `author_display_name` / `author_avatar_path` are `null` too, while `is_solution_author` is present and correct.
  - **Admin leg (SK-2)**: B then calls `report_community_solution(<A's solution>, '<reason>')`, which puts the row in the "Chờ xử lý" part of the queue and, by AC-075, **changes nothing a reader sees**. The Admin session calls `admin_list_community_reports()` and the row for that solution carries A's **real** `author_display_name` and `author_is_anonymous_to_readers = true`. (The report step is needed because the queue's row condition is `hidden OR (published AND ≥1 open report)` — backend DD § Data Contracts Admin RPCs "Queue row condition". Run the masked reads **before** it, so the assertions above are made on an unreported row.)
  - The admin leg asserts the **display name and the anonymity flag only**: `admin_list_community_reports()` returns no `author_id` and no avatar path, by contract.

## Acceptance Criteria

From the plan (§ P5-T8): **AC-002, AC-029, AC-039, AC-085, AC-105, M5, S5; Reference Contract Values #12, #13**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit acceptance criterion, SE2)**: the admin-session read goes through plain RPC calls on a signed-in session client (`admin_list_community_reports()`, per SK-2) — never through `SOURCE/lib/supabase/service-role.ts`; the test's admin session is a normal Supabase Auth session, not the service-role client.
- Both tests pass in **one continuous run** against `hynwleaxtbtjzkvpjsug`; fixture data cleaned up afterwards.
- The skeleton's comment annotations are replaced by real code for SE1/SE2 in this task only; no other service-e2e journey is added (budget 2).

## Target Files
- [x] `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` (fill **SE1** and **SE2**)
- [x] `SOURCE/tests/e2e/service/communitySolutionsServiceFixtures.ts` (new)

## Investigation Targets
- `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` (SE1/SE2 annotations: Behavior, Primary failure mode, Proof obligation, Verification points)
- `SOURCE/tests/e2e/service/essay-grade-write.service.e2e.test.ts` and `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` (setup + cleanup convention)
- `SOURCE/supabase/__tests__/rating.rls.service.e2e.test.ts` (signed-in session setup precedent)
- `SOURCE/tests/e2e/service/exam-search.service.e2e.test.ts` (`HAS_LIVE_DB` gate)
- `SOURCE/vitest.localdb.config.ts`
- `SOURCE/supabase/test-rls.ts` (user A/B shapes; admin session from tasks 03/35)
- `docs/design/community-solutions-backend-design.md` (§ Verification Strategy — Early Verification Point)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "Publish refusal carries the missing count", "Save refusal token", the M5 null-value assertion; § Test Boundaries — "User-write RPC groups", the `post_community_comment` row)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `set_community_solution_status` "Missing-count carrier"; `save_community_solution` "Save refusal carrier"; Admin RPCs "Queue row condition" and "Queue row columns")
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_solutions_list` / `community_solution_detail`: masking follows `show_profile` alone, **no admin exception**, AC-062)
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — **SK-2**, and § Reference Contract Values #12, #13, #26)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-002, AC-029, AC-039, AC-048, AC-075, AC-085, AC-105, M5, S5)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing | Neither test file imports from `@/lib/supabase/service-role`, every call under test uses a signed-in anon-key session, and `git diff --stat SOURCE/lib/supabase/service-role.ts` is empty |

## Investigation Notes
(Append observations here before implementation begins. Record the Binding Decision Compliance Check result and the run output.)

### Pre-implementation (2026-09-27)
- **Precondition**: `npm run verify:schema` (from `SOURCE/`, dev `hynwleaxtbtjzkvpjsug`) green, including the task 32/40/41 probe blocks → all six migrations (03/13/25/32/40/41) on dev.
- **SK-2**: not overruled — `docs/plans/community-solutions-HANDOFF.md` still lists SK-2 as "đã chốt 2026-09-20" with no engineer override; the admin leg goes through `admin_list_community_reports()`.
- **Skeleton** (`community-solutions.service.e2e.test.ts`) is still comment-only and untracked in git; SE1 = Early Verification Point (3 checks + read-backs), SE2 = M5 null-value proof + S5 admin identity.
- **Live signatures read from `SOURCE/supabase/schema.sql`** (the applied DDL):
  - `save_community_solution(p_exam_id text, p_attempt_id uuid, p_show_profile bool, p_show_score bool, p_notes jsonb) → table(solution_id, status)`; R1 gate raises `42501` before any insert (so a non-submitter creates no row); word-count refusal only when the CURRENT status is `published` → `23514` DETAIL `below_word_count`; whole function one transaction.
  - `set_community_solution_status(p_exam_id, p_action) → table(status)`; publish counts current questions whose note is missing or `< 15` words, raises `23514` DETAIL `v_missing_count::text` before the `update`, so a refusal writes nothing.
  - `community_solutions_list(p_exam_id)` / `community_solution_detail(p_solution_id)`: identity = `case when cs.show_profile …` for every caller (no admin, no self exception); score/score_grading (+ per_question on detail) = `case when cs.show_score …`; both require the CALLER to hold a submitted attempt on the exam — so the admin session needs its own submitted attempt on the fixture exam for the "admin sees the same nulls" check to read a row at all (otherwise 0 rows would prove nothing).
  - Comment identity (detail) = `not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)`; `is_solution_author = c.author_id = cs.author_id`.
  - `post_community_comment(p_solution_id, p_question_id, p_body, p_is_anonymous)` requires published solution + caller submitted + note ≥15 words on that question.
  - `report_community_solution(p_solution_id, p_reason) → table(already_reported)`; writes only `community_content_reports`.
  - `admin_list_community_reports()` gated by `is_admin_user()`; row condition `hidden OR (published AND ≥1 report)`; columns include `author_display_name` (= `user_profiles.display_name`, unmasked) and `author_is_anonymous_to_readers` (= `not cs.show_profile`); no `author_id`, no avatar column.
- **Fixture/setup convention**: every `tests/e2e/service/community-solutions-*.localdb.test.ts` imports `adminClient`/`anonClient`/`HAS_LIVE_DB` from `./essayGradeWriteFixtures` (raw `createClient` with the service key for SETUP and independent READ-BACKS only — never `@/lib/supabase/service-role`), prefixed ids, cleanup-before-and-after by prefix, and the admin session via `signInAsSeededAdmin` (magic-link token exchanged by a fresh anon client → a real `authenticated` JWT; same as `supabase/test-rls.ts`). Followed as the repository-wide majority pattern for this lane.
- **Similar-function check**: `community-solutions-reputation.localdb.test.ts` and `supabase/test-rls.ts` carry local, non-exported copies of `signInAsSeededAdmin`/`csWords`; neither is importable (test file / standalone script). New helpers live in the task's own fixture file; no production code is duplicated.

### Binding Decision Check (pre-implementation)
- Axis `dependency_direction` — planned approach: neither test file imports `@/lib/supabase/service-role`; every RPC under test is called on a signed-in anon-key session (A, N, B, Admin); the service key is used only by the fixture file's setup/cleanup and independent read-back client (the lane's existing convention); `service-role.ts` is not touched. Evaluation: **Y**.

### Implementation decisions
- SE1 uses a 5-question exam. "Artificially shortened" is done through the product path: A unpublishes (`draft`), saves 3 notes at 9 words (allowed on a draft), then publishes → DETAIL `'3'`. The 9-word `save_community_solution` refusal (`below_word_count`) runs while the solution is still published, before the unpublish. Read-backs (`readSolution`: status, is_pinned, every note body) go through the fixture's service-key client, never through the RPC under test. The non-submitter case calls both `save_community_solution` and `set_community_solution_status('publish')` and counts `(exam_id, author_id)` rows before/after (0/0).
- SE2 uses a 2-question exam (both notes 15 words, `show_profile=false`, `show_score=false`, linked attempt with a real `exam_results` row at 7.5 so `score`/`per_question` have real values to hide). A's `user_profiles.display_name`/`avatar_url` are set to known literals. B posts the anonymous comment through `post_community_comment(..., p_is_anonymous => true)`. A also posts one non-anonymous comment: under a `show_profile=false` solution it is masked too, and it gives the `is_solution_author = true` case next to B's `false`.
- The admin session gets its own submitted attempt on the fixture exam (removed by cleanup through `exam_id`), because list/detail are R1-gated for every caller. Without it the "admin sees the same nulls" check would read zero rows.
- The admin leg asserts only `author_display_name` (real literal) and `author_is_anonymous_to_readers = true` on the `admin_list_community_reports()` row. The AC-075 read-back after B's report covers the table (`status`, `is_pinned`, note bodies) and B's list view (`status`, `is_pinned`, `helpful_count`, `comment_count` = 2).
- `error.message` is asserted nowhere. A grep of both files finds `.message` only in comments that mention it.

### Red-phase discrimination (each done once, then reverted; `cmp` against a scratch backup confirmed a byte-identical restore)
1. `refused.error?.details` → `refused.error?.message` in SE1 (2a) and (2b): both went **red** — Received `"save_community_solution: note below 15 words on a published solution"` and `"set_community_solution_status: 3 question(s) below 15 words"`. So the assertions pin the DETAIL carrier, not the message.
2. SE2's first case read with **A's own session** (writer instead of B; `is_mine` lines dropped for the swap): **green**. AC-062 has no self-exception, so the writer also gets `null` identity/score on the solution and on both comments.
3. SE2 fixture with `p_show_profile: true`: the B case, the admin list/detail case and the admin-queue case all went **red** (`expected {…(14)} to have property "author_id" with value null`; the queue flag is `false`).

### Run output (2026-09-27, dev `hynwleaxtbtjzkvpjsug`)
- `npx vitest run --config vitest.localdb.config.ts tests/e2e/service/community-solutions.service.e2e.test.ts`: 1 file, **7/7 passed** (SE1 4 cases + SE2 3 cases) in one run, 20.2 s.
- `npm run test:localdb` (**no `--exclude`**): **8 files passed, 47/47 tests** in one continuous run, 48.9 s.
- Leftover check after the lane run (service-key count on the `cs47svc-` prefix): exams 0, questions 0, attempts 0, solutions 0, users 0. Earlier runs had already left data before this one, and it still passed, so re-running is idempotent.
- `npm run verify:schema`: green before and after.
- `lib/supabase/__tests__/serviceRoleSurface.test.ts`: 6/6 passed, file unmodified.
- `npm test`: 201 files passed | 1 skipped; 2627 tests passed | 10 skipped.
- `npx tsc --noEmit`: exit 0. `npm run lint` (`--max-warnings 0`): clean.

### Binding Decision Check (exit gate, against the final implementation)
- `dependency_direction`: **Y**. Neither `community-solutions.service.e2e.test.ts` nor `communitySolutionsServiceFixtures.ts` imports `@/lib/supabase/service-role` (grep finds the path only in comments). Every call under test is `writer.client` / `outsider.client` / `reader.client` / `adminSession`, all anon-key clients signed in with a password or a magic-link OTP. `git diff --stat SOURCE/lib/supabase/service-role.ts` is empty.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Confirm all six migrations are on dev (`npm run verify:schema` green); read all Investigation Targets
- [x] Confirm SK-2 has not been overruled by the engineer since 2026-09-20; if it has, follow the engineer's wording instead of the admin leg described above
- [x] Write SE1 and SE2; prove discrimination once (e.g. make SE1's refusal assertion read `error.message` instead of `error.details` and confirm it no longer pins the count; revert)
- [x] Prove the masking discrimination once as well (read SE2's anonymous row with A's own session and confirm the `null` assertion still holds — AC-062 has **no** self-exception, so this is a positive check, not a red one; then read it with `show_profile = true` and confirm the assertion turns red; revert)

### 2. Green Phase
- [x] Run `npx vitest run --config vitest.localdb.config.ts tests/e2e/service/community-solutions.service.e2e.test.ts` from `SOURCE/`; both green in one run
- [x] If a run fails on a timeout while dev is slow, re-run this file alone once before investigating (known dev-DB flake pattern)

### 3. Refactor Phase
- [x] Move setup/cleanup into `communitySolutionsServiceFixtures.ts`
- [x] Confirm both tests still pass

## Quality Assurance Mechanisms
- `npm run test:localdb` — Config: `SOURCE/vitest.localdb.config.ts` — **from this task on, run without the exclude flag** (decomposer resolution R1 ends here: the SE skeleton now has real suites)
- `npm run verify:schema` — precondition
- `serviceRoleSurface.test.ts` — re-run; green unmodified
- `npm test`, `npx tsc --noEmit`, `npm run lint`, commit gate list (run inside `SOURCE/`)

## Operation Verification Methods
- **Verification method**: `npm run test:localdb` (no exclude) from `SOURCE/` against dev.
- **Success criteria**: SE1 (3 checks, incl. the DETAIL assertions) and SE2 (non-admin `null` on solution **and** comment + the admin queue row's real display name and `author_is_anonymous_to_readers = true`) green in one continuous run; every other localdb file green; fixtures cleaned up (re-running is idempotent).
- **Failure response** (Backend DD Early Verification Point, verbatim): "if the R1 gate re-derivation inside `save_community_solution()`/`set_community_solution_status()` behaves differently from `exam_answer_key()`'s own gate for the same test account... stop and reconcile the two gate expressions". For SE2, a non-null masked value stops the feature close.
- **Verification level**: L2 (real-DB e2e tests added and passing)

## Proof Obligations
- **Claim** (SE1, verbatim): "successful publish -> the status column literally equals 'published'; word-count rejection -> the status column is UNCHANGED from its pre-call value AND no `community_solution_notes` row's body differs from its pre-call value (whole-call rollback, not partial); ineligible-caller rejection -> zero `community_solutions` row exists for that (exam_id, author_id) pair at all."
- **v1.3 addition**: the word-count rejection also asserts the **carrier** — `error.code === "23514"` and `error.details` exactly the decimal missing count for `set_community_solution_status`, exactly `below_word_count` for `save_community_solution`. `error.message` is asserted on nowhere, so the case turns red if a later edit moves either value back into the message.
- **Primary failure mode** (skeleton): "the R1 eligibility gate re-derivation inside these two RPCs silently diverges from exam_answer_key()'s own gate for the same test account … or a rejected publish call partially writes some notes before failing."
- **Boundary to exercise**: live RPCs through A's and a non-submitter's own sessions; direct read-backs.
- **State assertion**: pre-call snapshot of status + note bodies → call → post-call snapshot equal (rejections) / status `published` (success).
- **Mock boundary rationale**: none — full real system.
- **Residual**: none.

- **Claim** (SE2, verbatim): "non-admin/non-author read of the anonymous solution: `author_id`, `author_display_name`, `author_avatar_path` all JSON null... admin-session read of the SAME rows: `author_id` / display name / avatar path equal the true stored values, not null (S5)."
- **v1.3 reading of the admin half (SK-2, binding)**: the skeleton's second sentence is satisfied through `admin_list_community_reports()`, which is the **only** admin path to real identity in this design. It returns the writer's real `author_display_name` and `author_is_anonymous_to_readers`; it returns **no `author_id` and no avatar path**, so those two values are asserted on the masked (B) read only and are not asserted as "true stored values" anywhere. `community_solutions_list()` / `community_solution_detail()` mask by `show_profile` alone for **every** caller, admins included (AC-062), so an admin read of those two functions must return the same `null`s — assert that too, rather than treating it as a failure.
- **Primary failure mode** (skeleton): "a future edit to a masking RPC adds or restores a raw column reference, leaking author_id / display name / avatar path / score on an anonymous or show_score=false row to a non-admin, non-author caller."
- **Boundary to exercise**: live RPC JSON bodies for the B session (`community_solutions_list`, `community_solution_detail` — solution and comment) and the Admin session (`admin_list_community_reports`, plus the two masking RPCs to prove there is no admin exception).
- **State assertion**: N/A for the reads; the one write in SE2's admin leg is B's `report_community_solution`, which must leave the solution's status, `is_pinned`, `helpful_count` and `comment_count` unchanged (AC-075) — assert that with a read-back.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] SE1 and SE2 pass in one continuous run
- [x] No assertion anywhere in either test reads `error.message`; SE2's admin leg goes through `admin_list_community_reports()` and no masking RPC gained an admin exception
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: closes the service-integration-e2e budget; task 52 depends on this passing.
- Scope boundary: no schema edits; no additional service-e2e journeys.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
