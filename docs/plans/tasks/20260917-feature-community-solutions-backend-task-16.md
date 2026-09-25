# Task 16: `test-rls.ts`/`test:localdb` — the test task of migration 13 (M5 solution half, S12 ordering, Helpful RPC groups, pin, detail shape)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P2-T4
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T4)
- **Dependencies**: task 13 (P2-T1)
- **Provides**: real-DB proof of every object migration task 13 created — the masking projection for solutions, list-order stability, both Helpful RPCs, the pin RPC, and the detail payload's pinned shape
- **Size**: Small (2 files)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Helpful writes go through `add_community_solution_helpful` / `remove_community_solution_helpful`; `community_solution_helpfuls` has RLS enabled, every privilege revoked, **no policy and no grant**. The v1.1 policies `community_helpfuls_insert_own` / `community_helpfuls_delete_own` are gone from the design and were never applied to any database, so this task writes **RPC groups, not policy groups** (backend DD v1.9 § Test Boundaries "User-write RPC groups"). Executor rule: never weaken a success group into a refusal expectation, and never add a grant or policy to make one pass.

## Implementation Content

This is **the test task of migration 13** (backend DD v1.9 § Integration Verification Points, binding "Task ownership"). Task 13 writes no real-DB case; every case below is written here. Each asserts on the **actual JSON body / error** and re-reads rows through the harness setup client; every refusal case asserts `isAuthorizationDenial(error)` (or the pinned `22023`) and unchanged rows.

In `SOURCE/supabase/test-rls.ts`:
- **M5 null-value group, solution half**: a non-admin, non-author session reads an **anonymous** solution (`show_profile = false`) and a `show_score = false` solution through `community_solutions_list` **and** `community_solution_detail` — `author_id`, `author_display_name`, `author_avatar_path` (and `score`, `score_grading`, `per_question` when `show_score = false`) **equal JSON `null`**, keys present.
- **Decomposer resolution R3**: the anonymous-**comment** half of M5 stays in **task 27**, where `post_community_comment` exists to create the fixture. This task covers the anonymous-**solution** half only.
- **Writer self-read (AC-062)**: the writer of a `show_profile = false` solution reads their own list row and detail header and gets `null` identity with `is_mine = true`; another eligible viewer gets the same `null` values with `is_mine = false`; switching `show_profile` on returns the writer's identity to **both** on the next read, and switching it off again returns `null` to both.
- **`add_community_solution_helpful` group (AC-065, required)** — refusals, each `42501` with zero rows: (a) the solution's own author; (b) a caller with no submitted attempt on the exam; (c) a `draft` solution; (d) `anon`; (e) **table closure** — an eligible reader's direct `.from("community_solution_helpfuls").insert(...)` is an authorization denial and creates zero rows; (f) AC-004 — a published solution whose exam is now `draft`; (g) AC-004 — the same with the exam author now banned. Success: `[{ added: true }]` and exactly one row; the same call again → `[{ added: false }]`, still exactly one row (AC-066, M4).
- **`remove_community_solution_helpful` group** — (a) reader B calls it for a solution where reader C holds a row → no error and C's row still present; (b) `anon` → denial; (c) **table closure** — direct `.from("community_solution_helpfuls").delete()` denied, row present; (f) AC-004 — exam now `draft` → `42501 remove_community_solution_helpful: not eligible`, row present; (g) AC-004 — exam author now banned → `42501`, row present; (h) AC-002 — the caller's own attempt now `in_progress` → `42501`, row present. Success: the caller's own row is gone; the same call again → no error, zero rows.
- **Pin atomicity + target refusals**: the exam author calls `set_community_solution_pin('pin', A)` then `set_community_solution_pin('pin', B)` → exactly one row of that exam has `is_pinned = true` and it is B, and `community_solutions_list` returns B first (AC-054). The harness setup client then writes a second pin by hand (`update … set is_pinned = true where id = <A>`) and the partial unique index `community_solutions_pinned_per_exam_idx` rejects it with `23505`, leaving B the only pinned row. `'unpin'` then leaves no pinned row, and a repeat succeeds with no row changed. `set_community_solution_pin('pin', null)`, `'pin'` with **another exam's** published solution, and `'pin'` with a **draft** of this exam each raise `22023` and leave B the only pinned row.
- **AC-004 gate** for `set_community_solution_pin` (`42501 set_community_solution_pin: exam not visible`, `'pin'` and `'unpin'`, no row changed) and for `community_solutions_list` / `community_solution_detail` (zero rows).
- **Comments on a draft or hidden solution (S7, AC-071, AC-063)** and **admin-hidden comment in detail (S19, AC-107)**: per the backend DD text — on the writer's own preview of a draft/hidden solution the header, questions and notes come back with an **empty** comments array and a **null** (never `0`) `comment_count` per question, and no other caller reads the solution at all; an admin-hidden comment reaches only its own author, with `is_hidden_by_admin = true` and the latest `hidden_reason`, and is counted by no `comment_count`.
  - **SN-1 (work plan § Open Items, resolved 2026-09-20)**: `admin_moderate_community_comment` / `admin_moderate_community_solution` land in migration 32, so until then the **harness setup client** sets `status = 'hidden'` and inserts the matching `community_moderation_log` `hide` row directly; comment rows for these cases are likewise seeded by the setup client (no comment RPC exists before task 25). **Task 35 re-runs the hidden cases through the real admin RPCs.**
- **Name-resolution regression**: `set_community_solution_pin('pin', …)` and `add_community_solution_helpful` run their success paths with no `42702`.

In a new localdb-lane file `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts` (collected by `vitest.localdb.config.ts`; `describe.skipIf(!HAS_LIVE_DB)`, overview R4):
- **S12 ordering**: 3+ published solutions including rows that tie on `is_pinned`, helpful count and `updated_at` — two consecutive `community_solutions_list` reads with unchanged data return identical id order, and ties resolve by `id` ascending (Reference Contract Value #3).
- **Score-grading badge state**: a `show_score = true` solution whose linked attempt's `exam_results.per_question` carries one element with `essayState = 'pending'` → `score` non-null and `score_grading = true`; after the setup client sets that element to `'graded'` → `score_grading = false` with the same score; an attempt with no essay element → `false`; `show_score = false` → **both** `score` and `score_grading` SQL `null`. **Every case is asserted on both read paths** — the `community_solutions_list` row and the `community_solution_detail` header — and the two must return the same pair for the same solution (AC-041, AC-040, AC-055).
- **Detail payload column enumeration**: on a published solution with `show_score = true`, `show_profile = true`, two current questions each under a ≥15-word note, one visible comment under the first and none under the second, an eligible reader's `community_solution_detail` has header keys equal to exactly the 14 of Reference Contract Value #14, each `questions` entry exactly the 7, and the comment entry exactly the 11 — **set equality in both directions**, so the case fails on a missing column and on an extra one. Repeated with `show_score = false`: the same key sets, with `score`, `score_grading` and `per_question` all `null`.
- **AC-048 note condition (list/detail part)**: shortening a note below 15 words or deleting it drops that question's comments — the solution's `community_solutions_list.comment_count` is one lower, the detail returns no comment row for it and that question's `comment_count` is **null, not `0`**; restoring the 15-word note restores every value.
- **AC-047 current question (list/detail part)**: removing a question's id from `exams.question_ids` (setup client) drops `community_solutions_list.comment_count` by exactly that question's comment count and makes `community_solution_detail` return no row and no `comment_count` for it; putting the id back restores every value.

## Acceptance Criteria

From the plan (§ P2-T4): **AC-004, AC-039, AC-040, AC-041, AC-047, AC-048, AC-054, AC-055, AC-062, AC-063, AC-064–AC-066, AC-071, AC-078, AC-107, S12, S19, M4, M5; Reference Contract Values #3, #14, #20**.

Carried hard constraints that apply to this task:
- Assertions run against the RPC's **actual JSON body**, not a typed/mapped client object.
- Sessions are plain Supabase Auth sessions; **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- `npm run verify:schema` green on dev before running `test:localdb` (precondition in `SOURCE/vitest.localdb.config.ts`).

## Target Files
- [x] `SOURCE/supabase/test-rls.ts`
- [x] `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts` (new)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (task 05 groups; `ensureUser`/`signInAs`)
- `SOURCE/tests/e2e/service/community-solutions-write-gate.localdb.test.ts` (task 05 localdb file — gating + fixture cleanup shape)
- `SOURCE/tests/e2e/service/essayGradeWriteFixtures.ts` (prefixed, idempotently-cleaned-up ids)
- `SOURCE/supabase/schema.sql` (task 13 objects)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "the single most important test in this design" (M5), the writer self-read case, "Detail payload column enumeration", "Score-grading badge state", "Pin atomicity", "AC-048 note condition", "AC-047 current question", "Comments on a draft or hidden solution", "Admin-hidden comment in detail" — every case marked "(test task 16; migration task 13)")
- `docs/design/community-solutions-backend-design.md` (§ Test Boundaries — "User-write RPC groups": the `add_community_solution_helpful` and `remove_community_solution_helpful` rows, incl. the table-closure case in every refusal group)
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — SN-1, the harness-setup substitute for the hidden cases; § Reference Contract Values #3, #14, #20)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `add_community_solution_helpful` / `remove_community_solution_helpful`; `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`; `community_solution_detail` "Output columns (binding, v1.9)"; `community_solutions_list` Invariants)
- `docs/design/community-solutions-backend-design.md` (§ Verification Strategy — one refusal + one success group per new DDL object)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `exam_results` cross-user read (show_score))
- `docs/prd/community-solutions-prd.md` (AC-039, AC-054, AC-065, S12, M5)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solutions_list`) | structure-order | `order by cs.is_pinned desc, coalesce(h.helpful_count, 0) desc, cs.updated_at desc, cs.id` | The localdb ordering test observes pinned-first, then helpful desc, then `updated_at` desc, then `id` asc on tie rows, identically across two reads |
| `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points "Detail payload column enumeration"; work plan Reference Contract Value #14) | structure-order | Header `{id, author_id, author_display_name, author_avatar_path, is_pinned, updated_at, score, score_grading, per_question, is_mine, helpful_count, i_marked_helpful, i_reported, questions}`; per-question `{question_id, stem, correct_answer, has_changed, note, comment_count, comments}`; per-comment `{id, author_id, author_display_name, author_avatar_path, is_solution_author, is_mine, body, is_hidden_by_admin, hidden_reason, i_reported, created_at}` | The enumeration case asserts set equality in **both** directions for all three levels, with `show_score = true` and again with `show_score = false` |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` `comment_count`; work plan Reference Contract Value #20) | presence-conditional | `comment_count` is SQL `null` (never `0`) when the question carries no comment surface | The AC-047/AC-048 and draft-or-hidden cases assert `null`, never `0`, for the question with no comment surface |

## Investigation Notes

- `SOURCE/supabase/test-rls.ts`: task 05's "Phần 10" Community Solutions block (fixture helpers `ensureUser`/`signInAs`/`insertSubmittedAttempt`, `isAuthorizationDenial`, `assert`, `csWords`) reused as-is. Precedent read at lines ~3071-3105 (now shifted after this task's insert): SN-1 harness pattern for a hidden solution is `admin.from("community_solutions").update({status:"hidden"})` + `admin.from("community_moderation_log").insert({action:"hide", ...})`, no RPC. Same pattern applied here for the admin-hidden-comment case, targeting `community_solution_comments.status` instead.
- `SOURCE/supabase/schema.sql` (task 13 objects, read in full): `community_solutions_list` order by is `is_pinned desc, coalesce(helpful_count,0) desc, updated_at desc, id` (Reference Contract Value #3 — matches task file verbatim). `community_solution_detail`'s comment_count presence condition is keyed on "a qualifying (>=15-word) note exists for that question", independent of whether any comment exists — so a question with a 15-word note and zero comments reads `comment_count = 0` (an integer), not `null`; only a question with NO qualifying note reads `null`. This is a real invariant of the shipped SQL, not a gap — recorded here since it wasn't spelled out verbatim in the task's bullet text, and the new localdb test asserts it explicitly (Q2 in the "AC-048" case). `remove_community_solution_helpful` returns `void` (no `added`/data), confirmed against schema.sql — refusal/success checked via `.error` and independent row re-reads only. `exam_answer_key(p_exam_id)` joins `questions q on q.id = any(e.question_ids)`, confirming AC-047's "id removed from `question_ids` ⇒ the question disappears from `community_solution_detail`'s `questions` array entirely" (not just its `comment_count`).
- `docs/design/community-solutions-backend-design.md` § Integration Verification Points / § Test Boundaries "User-write RPC groups" (read in full): confirmed the exact refusal/success wording used in assertions (message strings `<function>: exam not visible`, `remove_community_solution_helpful: not eligible`, error codes `42501`/`22023`/`23505`).
- `docs/plans/20260917-feature-community-solutions.md` § Reference Contract Values #3/#14/#20 and § Open Items SN-1 (read in full): values copied verbatim into assertions and code comments; SN-1's resolution (harness sets `status`/inserts `community_moderation_log` directly until migration 32) applied exactly as written, for both the draft/hidden-solution case and the admin-hidden-comment case.
- U1 confirmed: no grant or policy was added to `community_solution_helpfuls` (or any other closed table) anywhere in this task; every Helpful assertion goes through the two RPCs or is a table-closure denial check.
- **Reference Contract Compliance Check**:
  - #3 (`community_solutions_list` order by) — **Y**. `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts`'s "S12 ordering" test creates 3 solutions tied on `is_pinned`/`helpful_count`/`updated_at`, asserts two consecutive reads both equal the id-ascending order.
  - #14 (`community_solution_detail` 14/7/11 key sets) — **Y**. Same file's "column enumeration" test asserts `Object.keys(...).sort()` equality both ways at all three levels, with `show_score` true and false.
  - #20 (`comment_count` null-never-0 when no comment surface) — **Y**. Both the AC-048 and AC-047 cases in the same file assert `null` (not `0`) when the question has no qualifying note / is not a current question, and `0` (not `null`) when a qualifying note exists with zero comments (the Q2 case above).
- A third persistent test account `EMAIL_C` (`smithnguyen247+rlstestc@gmail.com`) was added to `test-rls.ts` alongside the existing A/B convention (`ensureUser`/`signInAs`, never deleted) — required by `remove_community_solution_helpful` case (a), which needs a caller holding no row and a distinct third party holding one, simultaneously. This is additive test scaffolding only; no Design Doc contract or existing test was touched.
- No genuine data/projection gap found in migration 13 while writing these assertions — no escalation needed per the task's carried incident-avoidance note.
- No conflict found between this task's literal wording and any previously-committed task's shared logic (checked `SILENT_RPC_ERROR_CODES`-style concerns: not applicable here, this task adds no client-side action code, only RPC-level test assertions).
- **Revision (integration-test-reviewer `needs_revision`, 2 required fixes applied)**: added `helpfulTotalFor(solutionId)` helper (mirrors `helpfulCountFor` but without the `user_id` filter) and used it in `add_community_solution_helpful` case (d) (anon refusal) to assert 0 total rows for `SOL_HELPFUL` — anon has no `userId` to filter a per-user count by. Added `helpfulCountFor(SOL_HELPFUL, userBId) === 1` to `remove_community_solution_helpful` case (b) (anon refusal), mirroring siblings (a)/(c)/(f)/(g)/(h). Re-ran `npx tsx supabase/test-rls.ts` against dev `hynwleaxtbtjzkvpjsug`: all task-16 (Phần 11) checks green including both new assertions; the only 4 `✗` in the full run are the pre-existing, out-of-scope `Rating` section (R-p/R-r/R-t/R-u), confirmed pre-existing by the reviewer. `npx tsc --noEmit` clean.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the groups; prove each assertion can fail (e.g. point the M5 read at the author's own session and confirm the null assertion turns red because identity is returned; revert)

### 2. Green Phase
- [x] Run against dev; all groups green without schema changes (a needed schema change means task 13 is wrong — stop and escalate)

### 3. Refactor Phase
- [x] Share fixture setup with task 05's helpers
- [x] Confirm tests still pass

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` — Config: `SOURCE/supabase/test-rls.ts`
- `npm run test:localdb` — Config: `SOURCE/vitest.localdb.config.ts`
- `npm run verify:schema`, `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: run `test:localdb` as `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47; `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23.

## Operation Verification Methods
- **Verification method**: `npx tsx supabase/test-rls.ts` and `test:localdb` (lane rule) from inside `SOURCE/` against dev `hynwleaxtbtjzkvpjsug`.
- **Success criteria**: every case in § Implementation Content green — M5 solution half, writer self-read, both Helpful RPC groups (incl. their table-closure cases), pin atomicity + the three `22023` target refusals, AC-004 gate, draft/hidden-solution and admin-hidden-comment cases, name-resolution, plus the localdb ordering, score-grading, detail-enumeration and AC-047/AC-048 cases.
- **Failure response**: if a masked column comes back as a non-null value, stop Phase 2 — this is the feature's top risk; fix the RPC projection in a new migration task before any frontend reader task proceeds.
- **Verification level**: L2 (real-DB tests added and passing)

## Proof Obligations
- **Claim** (Backend DD, verbatim): "asserts `author_id`/`author_display_name`/`author_avatar_path` (and `score`/`per_question` when `show_score=false`) equal `null` in the RPC's actual JSON response — not that the keys are absent."
- **Primary failure mode** (SE skeleton): "a future edit to a masking RPC adds or restores a raw column reference, leaking author_id / display name / avatar path / score on an anonymous or show_score=false row to a non-admin, non-author caller."
- **Boundary to exercise**: live `.rpc()` from user B's session; raw JSON parsed without the TS mapper.
- **State assertion**: N/A (read-only).
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: anonymous-comment half → task 27 (R3); admin-sees-true-identity half → task 47 (SE2).

- **Claim** (AC-065, PRD verbatim): "Given người dùng là chính người viết, hoặc chưa nộp đề, when gọi API bấm Hữu ích (kể cả gọi thẳng), then DB từ chối; không dòng nào được tạo."
- **Primary failure mode**: `add_community_solution_helpful`'s author exclusion or submitted check is missing, letting authors self-upvote — or the table is reachable directly, so the RPC's gate can be bypassed entirely.
- **Boundary to exercise**: live `.rpc("add_community_solution_helpful", …)` from the author's and a non-submitter's own sessions, plus the table-closure case (a direct `.from("community_solution_helpfuls").insert(...)` by an **eligible** reader must still be denied).
- **State assertion**: `count(*)` of helpfuls for (solution, caller) = 0 before → refused call → 0 after; eligible caller → `[{ added: true }]` and 1 row; repeat → `[{ added: false }]` and still 1 row.
- **Mock boundary rationale**: none.
- **Residual**: the `toggleHelpful` add-then-remove call pattern is unit-tested in task 15.

- **Claim** (Reference Contract Value #14): `community_solution_detail` returns exactly its pinned 14 / 7 / 11 key sets.
- **Primary failure mode**: a column the frontend consumes is missing (the v1.8 prose omitted five), or a future `select *` regression adds one the contract never promised.
- **Boundary to exercise**: live `community_solution_detail` from an eligible reader's session; `Object.keys()` of the header, of a `questions` entry and of a `comments` entry.
- **State assertion**: set equality both ways at all three levels, with `show_score = true` and again with `show_score = false` (same key sets; `score`/`score_grading`/`per_question` all `null`).
- **Mock boundary rationale**: none.
- **Residual**: the TS mapper's key-dropping rules are unit-tested in task 14.

- **Claim** (AC-062, writer self-read): the writer of an anonymous solution reads their own row masked; ownership reaches them only through `is_mine`.
- **Primary failure mode**: a self-exception is re-introduced into a masking expression, so the writer's own screen renders identity a reader must never see — and a reviewer reading the writer's screen concludes masking is broken.
- **Boundary to exercise**: live `community_solutions_list` and `community_solution_detail` from the writer's own session and from another eligible viewer's.
- **State assertion**: identity `null` with `is_mine = true` for the writer and `is_mine = false` for the viewer; `show_profile` on → identity for both; off again → `null` for both.
- **Mock boundary rationale**: none.
- **Residual**: none.

- **Claim** (Failure Mode #9 / S12 + Failure Mode #7 / AC-078): list order is stable across reads including the final `id` tie-break; at most one pinned row per exam after every pin call.
- **Primary failure mode**: tie rows reorder between reads; a pin swap leaves two pinned rows.
- **Boundary to exercise**: live `community_solutions_list` reads; live `set_community_solution_pin` calls from the exam author's session.
- **State assertion**: pinned count per exam = 1 after pin X, = 1 (now Y) after pin Y; id order read 1 = read 2.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: gates Phase 2 frontend reader tasks (17–24) on a masked-correct backend.
- Scope boundary: no schema edits; test fixtures prefixed and cleaned up idempotently.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
