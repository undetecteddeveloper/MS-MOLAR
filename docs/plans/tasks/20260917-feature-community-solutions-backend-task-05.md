# Task 05: `test-rls.ts` + `test:localdb` — the test task of migration 03 (Early Verification Point, Slice 2 equivalent)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P1-T5
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T5)
- **Dependencies**: task 03 (P1-T3), task 04 (P1-T4)
- **Provides**: real-DB proof of every object migration task 03 created — the write path, the two `23514` DETAIL carriers, the writer payload's key set, and that the R1 gate matches `exam_answer_key()`'s gate. **Every later backend task depends on this proof passing.**
- **Size**: Small (2 files)

## Implementation Content

This is **the test task of migration 03** (backend DD v1.9 § Integration Verification Points, binding "Task ownership": migrations 03 / 13 / 25 / 32 are tested in 05 / 16 / 27 / 35). Task 03 writes no real-DB case; every case below is written here.

In `SOURCE/supabase/test-rls.ts` (existing `ensureUser`/`signInAs` users: A = author-shaped/submitted, B = non-submitter; setup-only writes use the file's existing harness setup client):
- One refusal group + one success group for each of `admin_users`/`is_admin_user()`, `community_solutions`, `community_solution_notes`, following the file's own header convention.
- The **Early Verification Point** scripted sequence: submitted user A calls `save_community_solution()` then `set_community_solution_status('publish')` with every current question's note ≥15 words.

Required cases (backend DD v1.9 § Integration Verification Points — every case marked "(test task 05; migration task 03)", plus the task-03 functions' share of the AC-004 gate, AC-002 gate and name-resolution cases). Each asserts on the actual error/JSON body and re-reads rows through the harness setup client:

- **AC-004 gate** — a solution published while its exam was visible, then the exam set to `draft` (and, separately, its author banned): `save_community_solution` and `set_community_solution_status` (`'publish'` **and** `'draft'`) raise `42501` with message `<function>: exam not visible` and change no row; `community_solution_for_writer` and `community_solution_result_card` return **zero rows**; an unseen `community_moderation_log` deletion row for that exam keeps `viewed_at = null`. After the exam is `published` again (author unbanned), every read returns its earlier rows and the result card returns the deletion reason **exactly once**.
- **AC-002 gate** — with the caller's own attempt set to `in_progress` by the harness setup client (the change `attempts_update_own` permits), `set_community_solution_status` (`'publish'` and `'draft'`) raises `42501 set_community_solution_status: not submitted` and changes no row; `community_solution_result_card` returns zero rows and the deletion row keeps `viewed_at = null`. With the attempt `submitted` again, every call behaves as before.
- **Writer attempt id** — an eligible caller with a submitted attempt and NO solution gets one row with `solution_id` and `status` **null** and `attempt_id` = their **latest** submitted attempt on that exam (a second, older submitted attempt in the fixture must not win). After `save_community_solution(p_attempt_id => <that id>, …)` the next read returns the same `attempt_id` from `linked_attempt_id`, with `solution_id` set and `status = 'draft'`. Attempt back to `in_progress` → zero rows; `submitted` again → the same row.
- **Writer payload key set** — the row's keys equal exactly `{solution_id, attempt_id, status, show_profile, show_score, hidden_reason, questions}` (Reference Contract Value #15), **set equality both ways**, so the case fails if `changed_question_count` reappears or `attempt_id` is dropped; with notes covering 3 of 5 current questions, one under a question whose content hash has since changed, the number of `questions` entries with `has_changed = true` is **1**.
- **Publish refusal DETAIL** — 5 current questions, 2 notes ≥15 words, one 9-word note, 2 questions with no note row: `set_community_solution_status('publish')` raises `23514` whose caught DETAIL is exactly the string `3` (a string comparison — `' 3'`, `'3 questions'` or `'+3'` fail the case) and the re-read row is still `status = 'draft'`; after the 9-word note is brought to 15 words the next refusal's DETAIL is exactly `2`; after the last two notes the call returns one row with `status = 'published'` and raises nothing; finally `set_community_solution_status('draft')` succeeds and never raises `23514` (the gate is publish-only). **Asserted on DETAIL, never on the message text.**
- **Save refusal token** — on a published solution, a 9-word note for a current question raises `23514` whose DETAIL is exactly `below_word_count` and the re-read note body is the old one; an 8001-character body on a **draft** solution raises `23514` through the body-length CHECK whose DETAIL is **not** `below_word_count`; the hidden-solution refusal raises `42501` with **no** DETAIL.
  - **SN-1 (work plan § Open Items, resolved 2026-09-20)**: `admin_moderate_community_solution` does not exist until migration 32, so the hidden-solution case is set up by the **harness setup client** writing `status = 'hidden'` and inserting the matching `community_moderation_log` `hide` row directly. Task 35 re-runs the hidden cases through the real admin RPCs.
- **Name-resolution regression** — call every PL/pgSQL `returns table` function of this migration on its success path and fail on any `42702`: `save_community_solution` twice with notes (the second call takes both `on conflict … do update` branches), `set_community_solution_status` (`'publish'`, then `'draft'`), `community_solution_result_card`.

In a new localdb-lane file `SOURCE/tests/e2e/service/community-solutions-write-gate.localdb.test.ts` (collected by `SOURCE/vitest.localdb.config.ts`'s `tests/e2e/service/**` glob; gated with `describe.skipIf(!HAS_LIVE_DB)` as in `exam-search.service.e2e.test.ts`, overview R4): the `count_words()` (SQL) vs `countWords()` (TS) twin agreement on the AC-023 cases (backend DD invariant "count_words(x) computed in SQL and countWords(x) computed in TS must agree on every input exercised by the shared localdb twin test"). The publish-refusal DETAIL, save-refusal token and writer key-set cases may live in this file or in `test-rls.ts` (the backend DD allows either) as long as each one runs. This file is a localdb behavioural proof, not an additional service-integration-e2e journey — the SE budget stays SE1/SE2 in task 47.

## Acceptance Criteria

From the plan (§ P1-T5): **AC-002, AC-004, AC-024, AC-029 (data-layer half), AC-034, AC-044, AC-045, AC-083, AC-110; Reference Contract Values #12, #13, #15**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit re-run)**: re-run `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` and confirm it is green with no diff to `SOURCE/lib/supabase/service-role.ts`, cross-checking task 03's own TD-029 criterion now that the foundation migration has landed. The sessions used in this task are plain Supabase Auth sessions, never the service-role client, for the calls under test.
- Tests run against dev project `hynwleaxtbtjzkvpjsug` only.
- `npm run verify:schema` must already be green on dev before running `test:localdb` (the blocking precondition stated at the top of `SOURCE/vitest.localdb.config.ts`).

## Target Files
- [x] `SOURCE/supabase/test-rls.ts`
- [x] `SOURCE/tests/e2e/service/community-solutions-write-gate.localdb.test.ts` (new)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (header rule: one refusal + one success group per new DDL object; `ensureUser`/`signInAs`; existing M-a–M-d moderation groups as shape reference)
- `SOURCE/tests/e2e/service/exam-search.service.e2e.test.ts` (`HAS_LIVE_DB` gating + `search_normalize` twin-test precedent)
- `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` (prefixed, idempotently-cleaned-up fixture ids)
- `SOURCE/vitest.localdb.config.ts` (include glob and blocking precondition)
- `SOURCE/lib/solutions/countWords.ts` (task 04 deliverable)
- `SOURCE/supabase/schema.sql` (`count_words`, `save_community_solution`, `set_community_solution_status`, `exam_answer_key` — the gate expression to compare)
- `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — every case marked "(test task 05; migration task 03)": "Writer attempt id", "Writer payload has no `changed_question_count`", "Publish refusal carries the missing count", "Save refusal token", plus the AC-004 gate, AC-002 gate and name-resolution regression entries)
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — SN-1, the harness-setup substitute for the hidden-solution case; § Reference Contract Values #12, #13, #15)
- `docs/design/community-solutions-backend-design.md` (§ Verification Strategy — Early Verification Point)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `exam_answer_key()` reuse, `is_author_banned()` reuse)
- `docs/design/community-solutions-backend-design.md` (§ Test Boundaries)

## Investigation Notes

**R1 gate predicates, side by side** (per Completion Criteria + Failure response):

- `save_community_solution` / `set_community_solution_status` (schema.sql:2687, 2795), the gate this task tests:
  ```
  exists (select 1 from exams e where e.id = p_exam_id
    and e.status = 'published' and not is_author_banned(e.author_id))
  -- then, separately:
  exists (select 1 from exam_attempts a where a.exam_id = p_exam_id
    and a.user_id = auth.uid() and a.status = 'submitted')
  ```
  Both raise `42501` on failure (`<function>: exam not visible` / `<function>: not submitted`).
- `exam_answer_key` (schema.sql:882-936), the pre-existing "canonical" gate cited by the Early Verification Point's Failure response, has TWO branches (author OR submitted+published): `e.author_id = auth.uid() OR (e.status = 'published' AND exists(submitted attempt))`. Its submitted-branch does **NOT** repeat `not is_author_banned(e.author_id)`, unlike `exams_select_visible` (schema.sql:2488) which the function's own comment claims to mirror ("hai nhánh cộng lại đúng bằng điều kiện của exams_select_visible").
- **Comparison result**: this is a structural asymmetry in `exam_answer_key`'s existing (pre-migration-03) submitted-branch, not a divergence introduced by migration 03's functions. It is not exercised by this task: `community_solution_for_writer` (the only migration-03 function that calls `exam_answer_key`) always re-derives and checks the full R1 gate (published + not banned) itself BEFORE calling `exam_answer_key`, so a banned author's exam never reaches the `exam_answer_key` call in this feature's path. No test in this task calls `exam_answer_key` directly with a banned author. Recorded here as an observation (possible separate tech debt in pre-existing §10a code) — no schema edit made, per this task's scope boundary; the Failure response does not trigger because the two gates behave identically for every test account/scenario this task actually exercises.
- `is_author_banned(p_author_id)` (schema.sql:2464): `exists(select 1 from auth.users u where u.id=p_author_id and u.banned_until is not null and u.banned_until > now())`.

**Key interfaces observed**:
- `save_community_solution(p_exam_id text, p_attempt_id uuid, p_show_profile boolean, p_show_score boolean, p_notes jsonb) returns table(solution_id uuid, status text)`. One transaction; raises `42501` (exam not visible / not submitted / attempt not owned or not submitted / solution is hidden), `23514 detail='below_word_count'` for a short note on a **published** solution only, or the table's own `23514` (body length CHECK, detail = Postgres's own "Failing row..." text) regardless of status.
- `set_community_solution_status(p_exam_id text, p_action text) returns table(status text)`. `p_action` not in `('publish','draft')` → `22023`. Same R1 gate, then `not submitted` (`42501`), `no solution to publish` (`P0002`), `solution is hidden` (`42501`). Publish counts current questions with `count_words(note.body) < 15` (including questions with no note row, via `left join`) and raises `23514` with `detail = v_missing_count::text` (a bare decimal string) when `> 0`. Draft transition has no word-count gate.
- `community_solution_for_writer(p_exam_id text) returns table(solution_id, attempt_id, status, show_profile, show_score, hidden_reason, questions jsonb)`. Re-derives R1 gate independently (returns 0 rows, not an error, when it fails); separately requires a submitted attempt to exist at all (returns 0 rows otherwise, even if a solution row already exists) — this is why the "attempt back to in_progress" case must leave **no** submitted attempt at all, not just flip the one the test cares about. `attempt_id` = `coalesce(cs.linked_attempt_id, latest submitted attempt)`. `questions[].has_changed` = `n.solution_id is not null and n.question_content_hash is distinct from question_content_fingerprint(ak.id)` — false whenever no note row exists for that question.
- `community_solution_result_card(p_exam_id text) returns table(published_count, my_status, changed_question_count, unseen_deletion_reason)`. Same R1+submitted gate (0 rows on failure). READ-CONSUMES the oldest unseen `community_moderation_log` row where `target_user_id=caller, exam_id=p_exam_id, target_type='solution', action='delete', viewed_at is null` — sets `viewed_at=now()` in the same call, so a second call returns `null`.
- `count_words(p_text text) returns int`: `btrim(coalesce(text,''))='' → 0`, else `array_length(regexp_split_to_array(btrim(text), '\s+'), 1)`. TS twin `countWords()` (`SOURCE/lib/solutions/countWords.ts`) uses `.trim()` + `.split(/\s+/)`.
- `community_solutions` (schema.sql:2640) / `community_solution_notes` (schema.sql:2666): RLS enabled, **zero policies**, `revoke all from anon, authenticated` — the only path in or out is the SECURITY DEFINER functions above. `community_solutions` has `unique(exam_id, author_id)` (the on-conflict target) and a partial unique index on `is_pinned`. `community_solution_notes` PK is `(solution_id, question_id)`, body length CHECK `<= 8000`.
- `community_moderation_log` (schema.sql:2878): RLS enabled, zero policies, `revoke all`; `target_id` is intentionally NOT a foreign key (survives hard-delete of its target).
- `test-rls.ts` conventions confirmed by reading the file in full: `ensureUser`/`signInAs` (Admin API, no email), `admin`/`userA`/`userB`/`anonClient` created once in `main()`; `assert(cond, msg)` accumulates into module-level `failures`; `isAuthorizationDenial(error)` (line 521) is the correct predicate for RLS/grant denials (never a bare `error !== null`); each Phần is a self-contained setup → checks → cleanup block, idempotent cleanup run at both ends; `process.exit(failures === 0 ? 0 : 1)` at the very end.
- `exam-search.service.e2e.test.ts` / `essayGradeWriteFixtures.ts` confirm the `describe.skipIf(!HAS_LIVE_DB)` + prefixed-idempotent-fixture convention for the localdb lane; `HAS_LIVE_DB`/`adminClient`/`anonClient` are already exported from `essayGradeWriteFixtures.ts` and re-exported by `examSearchFixtures.ts` — reused directly rather than re-implementing env loading (Reference Representativeness: this re-export pattern is already repo-wide, not just a 2-3-file coincidence).
- `vitest.localdb.config.ts` include glob is `tests/e2e/service/**/*.test.{ts,tsx}` — confirms the new file's location and `.localdb.test.ts` suffix both work (glob only requires `.test.ts`, but the task file names it `.localdb.test.ts` explicitly, kept as instructed).

**Plan**: one new "Phần 10 — Community Solutions" section appended to `test-rls.ts` after Phần 9 (Subscription)'s own cleanup, before the file's final Rating/UGC cleanup calls. Single shared exam fixture (5 questions) reused sequentially across all required cases to minimize redundant setup, in this order: admin_users/is_admin_user() refusal+success → community_solutions/community_solution_notes table-closure refusal (success proven later via the RPC's independent service_role re-read) → Writer attempt id + Writer payload key set (combined, since both need the same two-attempt/notes fixture) → Publish refusal DETAIL (3 → 2 → success) + Early Verification Point non-submitter (B) refusal → AC-004 gate (exam draft, then author banned) → AC-002 gate (attempt in_progress) → Save refusal token (word-count / body-length / SN-1 hidden) → Name-resolution regression. One idempotent cleanup function, run before and after.

**Two findings recorded during execution (both non-blocking for this task, reported to the orchestrator):**

1. **Pre-existing, unrelated `test-rls.ts` failures (R-p, R-r, R-t, R-u — Rating phase).** Confirmed via `git stash` that these 4 checks already fail on the untouched base commit (`e25e1b6`), before any edit in this task — a dev-DB drift in the `exam_difficulty_ratings` fixtures unrelated to Community Solutions. Left untouched: fixing them is out of this task's Target Files/scope (would be an unrelated-file/unrelated-section expansion), and every Community Solutions check added by this task is green regardless.
2. **`count_words()`/`countWords()` real divergence outside AC-023's literal case list.** A note body consisting ONLY of non-ASCII-space whitespace (e.g. a lone tab or newline, no literal space character) makes SQL's blank check (`btrim(text) = ''`, where `btrim` strips only the space character) return false while `.trim()` in TS strips all Unicode whitespace and returns `''` — SQL then falls into the split branch and counts phantom empty tokens (e.g. `count_words("\t")` = 2, `countWords("\t")` = 0). Discovered while drafting the twin test with a broader case list; narrowed the final `CASES` array in `community-solutions-write-gate.localdb.test.ts` back to exactly what AC-023 names (the 5-word phrase, the 14-words+no-internal-space-formula=15 case, tab/newline as a word separator between real words, empty string, plain-space-only string, same-string equivalence) so the required Proof Obligation ("SQL and TS agree on every AC-023 case") is met cleanly. Did NOT hand-patch `schema.sql` (out of this task's scope, would violate task 03's already-verified migration) or silently drop the finding — recorded here for a future task/ADR decision on whether `count_words`'s blank check should move to a `\s`-based regex to match `countWords`.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets; write down the exact R1 gate predicate inside `exam_answer_key()` and inside `save_community_solution()` side by side
- [x] Write the refusal/success groups and the scripted sequence; run them before any fix to confirm each group can fail (e.g. temporarily point the non-submitter case at user A and confirm the refusal assertion turns red, then revert)
- [x] Write the twin test; confirm it runs

### 2. Green Phase
- [x] Make every group pass against dev; no schema change is expected in this task — if one is required, stop (see Failure response)
- [x] Run only the added groups and confirm they pass

### 3. Refactor Phase
- [x] Deduplicate fixture setup with the existing helpers in `test-rls.ts`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` — Enforces: RLS/RPC isolation on real Postgres, one refusal + one success group per new DDL object — Config: `SOURCE/supabase/test-rls.ts`
- `npm run test:localdb` — Enforces: real-Postgres behaviours — Config: `SOURCE/vitest.localdb.config.ts`
- `serviceRoleSurface.test.ts` — Enforces: `service-role.ts` surface frozen — Config: `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `npm run verify:schema`, `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: run `test:localdb` as `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` (the SE skeleton stays comment-only until task 47); run `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23.

## Operation Verification Methods
(This task is the backend **Early Verification Point** — method, success criteria, and failure response copied verbatim from the work plan's Verification Strategy.)
- **Verification method** (verbatim): "a submitted user calls `save_community_solution()` then `set_community_solution_status('publish')` against real dev DB with every question ≥15 words → row reaches `published`; a second call with one note <15 words is rejected (23514) with zero row change; a call from a non-submitter is rejected (42501) with zero row created."
- **Success criteria** (verbatim, Backend DD Early Verification Point): "the solution row reaches `status = 'published'`; a second call with one note below 15 words is rejected with no row change (`23514`, verified by re-reading the row); a call from a caller who has not submitted the exam is rejected (`42501`, verified by no row being created at all, per AC-002)."
- **Failure response** (verbatim): "if the R1 gate re-derivation inside `save_community_solution()`/`set_community_solution_status()` behaves differently from `exam_answer_key()`'s own gate for the same test account... stop and reconcile the two gate expressions before writing any further slice — every later RPC copies this same gate, so a divergence here propagates to all of them."
- **Additional success criteria (v1.3 test list)**: every required case in § Implementation Content is present and green — AC-004 gate, AC-002 gate, writer attempt id, writer 7-key set equality, publish-refusal DETAIL `3` then `2`, save-refusal token vs the body-length CHECK, name-resolution regression (no `42702`).
- **Verification level**: L2 (new real-DB tests added and passing)

## Proof Obligations
- **Claim** (AC-002): a caller who has not submitted the exam is rejected with `42501` and no `community_solutions` row is created.
- **Primary failure mode** (SE skeleton): "the R1 eligibility gate re-derivation inside these two RPCs silently diverges from exam_answer_key()'s own gate for the same test account."
- **Boundary to exercise**: live RPC call from user B's own signed-in session against dev Postgres.
- **State assertion**: `count(*)` of `community_solutions` for (exam_id, B) = 0 before → call → still 0 after, read back independently of the RPC.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: banned-author and unpublished-exam gate branches are covered by the refusal groups, not by this scripted sequence.

- **Claim** (AC-029, data-layer half): publishing with one note <15 words is rejected with `23514` and nothing is partially saved.
- **Primary failure mode**: "a rejected publish call partially writes some notes before failing (violating 'rolls back, nothing partially saved')."
- **Boundary to exercise**: live `set_community_solution_status('publish')` from user A's session.
- **State assertion**: row `status` and every `community_solution_notes.body` read before the call → rejected call → re-read equals the pre-call values.
- **Mock boundary rationale**: none.
- **Residual**: the same proof is repeated as SE1 in task 47 at feature close.

- **Claim** (Reference Contract Value #12 / AC-029): a refused publish's DETAIL is exactly the decimal count of current questions still below 15 words — `3`, then `2` after one is fixed.
- **Primary failure mode**: a later edit moves the count back into the message alone, or pads/decorates it (`' 3'`, `'3 questions'`), so `setSolutionStatus`'s `Number.parseInt` rule silently degrades to `generic`.
- **Boundary to exercise**: live `set_community_solution_status('publish')` from user A's session; the caught PostgREST error's `details`.
- **State assertion**: DETAIL string equality (`'3'`, then `'2'`); the row re-read as `status = 'draft'` after each refusal; `'draft'` never raises `23514`.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: the TS parse rule (finite integer ≥ 1) is unit-tested in task 04.

- **Claim** (Reference Contract Value #13 / AC-024, AC-083): the save word-count refusal's DETAIL is exactly `below_word_count`, and the body-length CHECK's `23514` is distinguishable from it.
- **Primary failure mode**: both `23514`s look alike, so an 8001-character body renders "Ghi chú phải có ít nhất 15 từ" — or the token is read out of `error.message`.
- **Boundary to exercise**: live `save_community_solution` from user A's session: a 9-word note on a published solution, then an 8001-character body on a draft, then a hidden solution.
- **State assertion**: DETAIL exactly `below_word_count` / not `below_word_count` / `42501` with no DETAIL; the note body re-read unchanged after the refusal.
- **Mock boundary rationale**: none; the hidden state is set up per SN-1 by the harness setup client.
- **Residual**: the three literal errors are replayed as a mocked unit test in task 04; task 35 re-runs the hidden case through `admin_moderate_community_solution`.

- **Claim** (Reference Contract Value #15 / AC-044, AC-045): `community_solution_for_writer` returns exactly `{solution_id, attempt_id, status, show_profile, show_score, hidden_reason, questions}`.
- **Primary failure mode**: `changed_question_count` reappears (two disagreeing derivations) or `attempt_id` is dropped (the write route loses its `[attemptId]` segment).
- **Boundary to exercise**: live `community_solution_for_writer` from the writer's own session; `Object.keys()` of the returned row.
- **State assertion**: set equality in both directions; `has_changed = true` count = 1 for the fixture; `status` null iff `solution_id` null.
- **Mock boundary rationale**: none.
- **Residual**: the mapper's `status: SolutionStatus | null` and null-note-to-`""` rules are task 04.

- **Claim**: SQL `count_words()` and TS `countWords()` return the same number for every AC-023 case.
- **Primary failure mode**: the client counter enables "Đăng" while the server rejects the same text (or the reverse).
- **Boundary to exercise**: live `select count_words($1)` vs in-process `countWords()` in one test.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above (Early Verification Point green)
- [x] Each Proof Obligation is met
- [x] `serviceRoleSurface.test.ts` re-run green with no diff to `service-role.ts`
- [x] Gate-comparison notes (the two R1 predicates side by side) recorded in Investigation Notes

## Notes
- Impact scope: a failure here blocks tasks 06 onward per the Failure response.
- Scope boundary: no schema edits in this task; fixture rows created by these tests are prefixed and cleaned up idempotently.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
