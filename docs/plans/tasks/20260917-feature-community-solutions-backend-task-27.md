# Task 27: `test-rls.ts`/`test:localdb` — the test task of migration 25 (comment RPC groups, M5 comment half + S4, feed)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P3-T4
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T4)
- **Dependencies**: task 25 (P3-T1), task 26 (P3-T2 — also provides `countUnreadComments`)
- **Provides**: real-DB proof of every object migration task 25 created — both comment RPCs, the feed's columns and unread cursor, and the anonymous-comment (M5) and S4 masking halves
- **Size**: Small (2 files)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Comment writes go through `post_community_comment` / `delete_community_comment`; `community_solution_comments` has RLS enabled, every privilege revoked, **no policy and no grant**. The v1.1 policies `community_comments_insert_own` / `community_comments_delete_own` are gone from the design and were never applied to any database, so this task writes **RPC groups, not policy groups** (backend DD v1.9 § Test Boundaries "User-write RPC groups"). Never weaken a success group into a refusal expectation, and never add a grant or policy to make one pass.

## Implementation Content

This is **the test task of migration 25** (backend DD v1.9 § Integration Verification Points, binding "Task ownership"). Every case below asserts on the actual JSON body / error and re-reads rows through the harness setup client; every refusal case asserts `isAuthorizationDenial(error)` and unchanged rows.

In `SOURCE/supabase/test-rls.ts` (assertions via real signed-in sessions; setup-only writes — flipping a comment to `status='hidden'`, shortening a note, reordering `exams.question_ids` — use the harness's existing setup client exactly as the existing Phần 5 M-a–M-d cases do):
- **`post_community_comment` group** — refusals, each `42501 post_community_comment: not eligible` with zero rows: (a) a caller with no submitted attempt; (b) a `draft` solution; (c) `p_question_id` not in `exams.question_ids`; (d) `anon`; (e) **table closure** — a direct `.from("community_solution_comments").insert(...)` by an eligible caller is an authorization denial and creates zero rows; (i) **AC-048** — a current question the published solution has no note for, and a current question whose note has 14 words (written by the setup client); the same note at exactly **15 words** is accepted. Success: returns `comment_id` and the row has `status = 'visible'`; a call with `p_is_anonymous = true` creates the anonymous comment the M5 case reads; the **writer's own** `p_is_anonymous = false` comment on their `show_profile = false` solution creates the S4 fixture.
- **`delete_community_comment` group** — refusals, each `42501 delete_community_comment: not eligible` with the row present: (a) another user's comment, **including a call by the solution's writer** (AC-070); (b) the caller's own comment after the setup client sets it `hidden` (S19); (c) `anon`; (d) **table closure** — a direct delete is denied, row present; (f) AC-004 — exam now `draft`; (g) AC-004 — exam author now banned; (h) AC-002 — the caller's own attempt now `in_progress`. Success: the caller's own `visible` comment is gone **and its `community_content_reports` rows are gone** (cascade).
- **M5 null-value assertion, comment half + S4 case** — an anonymous comment read through `community_solution_detail` by another eligible viewer returns `author_id` / `author_display_name` / `author_avatar_path` as JSON `null` with `is_solution_author` present; the writer's **non-anonymous** comment on their `show_profile = false` solution returns `null` identity with `is_solution_author = true`, follows `show_profile` on the next read (on → identity, off → `null` again); a non-anonymous comment by a different user on the same solution keeps its identity.
  - **SN-1 (work plan § Open Items, resolved 2026-09-20)**: the S4 **avatar** assertion (`community_avatar_owner_visible(<writer id>)` → `false`, and the viewer's session cannot sign the writer's avatar object) calls a function migration 40 creates, so **it runs in task 40**, which tests its own migration. Do not stub it here.
- **Cursor write case** (backend DD § Integration Point Map, "`test-rls.ts` case for the additive column write") — the owner can set their own `user_profiles.community_comments_last_read_at` under the unchanged `profiles_update_own`; another user cannot set it for them.
- **AC-004 / AC-002 gate** for `delete_community_comment` and `community_my_comment_feed`, and the **name-resolution regression** for `post_community_comment` (success path, no `42702`).

In a new localdb-lane file `SOURCE/tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` (collected by `vitest.localdb.config.ts`; `describe.skipIf(!HAS_LIVE_DB)`, overview R4):
- **Feed columns** — a writer W's published solution on an exam whose `question_ids` has the commented question at **position 3**, with one non-anonymous and one anonymous comment by reader R: each feed row carries `solution_id` = W's solution, `exam_id`, `exam_title` = `exams.title`, `question_number = 3`, the comment's `comment_body` and `comment_created_at`, and `author_display_name` = R's display name on the first and **`null`** on the anonymous one. After the setup client reorders `question_ids` so that question is first, the next read returns `question_number = 1`. **No row carries a commenter id or an avatar path.**
- **Feed unread cursor** — two new comments → both `is_unread = true`, `exam_visible = true`, new-count 2; after `markCommentsRead()`'s plain update of the cursor → both `is_unread = false`, new-count 0; a third comment → new-count 1; the setup client sets the exam `draft` → all three still listed, each `exam_visible = false`, new-count **0** (`is_unread` itself unchanged, so the unread rows stay a prefix of the newest-first feed); the exam published again → new-count 1, with no comment row and no cursor value changed in between (AC-091, AC-093, AC-098, S8).
- Feed ordering newest-first is stable across two reads.
- **AC-091 exclusion proof on real data (overview R6; row set + formula, consumed by tasks 29 and 45)**: seed, on the viewer's own published solution, (a) a comment by the viewer themself, (b) a comment by user B that the setup client flips to `status='hidden'` (S19), (c) a comment by user B on the viewer's own **draft** solution for another exam (S7), (d) a visible comment by user B on a solution whose exam the setup client makes not visible (S8), and (e) a normal visible comment by user B. Assert the raw feed rows exclude (a), (b), (c); include (d) with `exam_visible = false` and (e) with it `true`; and `countUnreadComments(rawRows)` from `SOURCE/lib/solutions/unreadComments.ts` (task 26) returns **1** (only (e)) while the cursor is null — the `isUnread && examVisible` rule of Reference Contract Value #23.
- **AC-048 / AC-047 (feed part)** — a comment whose note the setup client shortens to 14 words or deletes, and a comment whose question the setup client removes from `exams.question_ids`, are no longer listed in W's feed; restoring the note or the question id restores the row.

## Acceptance Criteria

From the plan (§ P3-T4): **AC-002, AC-004, AC-047, AC-048, AC-069, AC-070, AC-072, AC-091–AC-093, AC-097, AC-098, AC-105, S4, S7, S8, S19, M5; Reference Contract Value #23** — including (via R3) the anonymous-comment real-DB half of M5 and (via R6) the real-data AC-091 exclusion proof the plan's P3-T6/P5-T6 rely on.

Carried hard constraints that apply to this task:
- Sessions under test are plain Supabase Auth sessions; **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts` (the harness setup client is the existing test-script convention, not that module).
- `npm run verify:schema` green on dev before `test:localdb`.

## Target Files
- [x] `SOURCE/supabase/test-rls.ts`
- [x] `SOURCE/tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` (new)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (header rules; Phần 5 M-a–M-d setup pattern; tasks 05/16 groups)
- `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts` (task 16 localdb file shape)
- `SOURCE/supabase/schema.sql` (task 25 policies, feed function, cursor column)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — every case marked "(test task 27; migration task 25)": M5 + the S4 case, "Feed columns", "Feed unread cursor", the AC-048 note condition and AC-047 current-question feed parts, the AC-004 and AC-002 gates, "Name-resolution regression")
- `docs/design/community-solutions-backend-design.md` (§ Test Boundaries — "User-write RPC groups": the `post_community_comment` and `delete_community_comment` rows, incl. the table-closure case (e) and the AC-048 case (i))
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — SN-1: the S4 avatar assertion runs in task 40; § Reference Contract Values #23)
- `docs/design/community-solutions-backend-design.md` (§ Verification Strategy — one refusal + one success group per new DDL object)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_solution_detail` Invariants: comment rows follow the same anonymity rule; `is_solution_author` always present)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `user_profiles` row: `test-rls.ts` case for the additive column write)
- `docs/prd/community-solutions-prd.md` (AC-070, AC-072, AC-105, S19, M5)

## Investigation Notes
- `SOURCE/supabase/test-rls.ts` header + Phần 5/10/11: `ensureUser`/`signInAs` create the 3 persistent RLS-test users (A/B/C); `isAuthorizationDenial(error)` (line ~621) is the sole predicate for "authorization denial" (42501 or the RLS-policy-violation message text) — never a bare `error !== null`, since that would pass on constraint errors too. Phần 11 (task 16, `CS16_*`) is the direct model for Phần 12: own top-level fixture constants + `cleanupCsNNFixtures`, a `{ }`-wrapped block appended to `main()` right after the previous task's block and before the file's final Rating/UGC cleanup, and per-group helper closures (`helpfulCountFor`-style) scoped inside the block.
- `community-solutions-list-order.localdb.test.ts` (task 16 localdb file): shape is `describe.skipIf(!HAS_LIVE_DB)` per test area, each with its own `beforeAll`/`afterAll` fixture (own prefix, own `createStudent`/`submittedAttempt`/`cleanupByEmails` helpers duplicated locally rather than shared across localdb files — followed the same duplication here), imports `adminClient`/`anonClient`/`HAS_LIVE_DB` from `./essayGradeWriteFixtures`.
- `schema.sql` §22 (migration 25): `post_community_comment(p_solution_id, p_question_id, p_body, p_is_anonymous) returns table(comment_id, comment_created_at)` — eligibility is one `not exists` over `community_solutions`+`exams`+`exam_attempts`+`community_solution_notes` (published solution, published+not-banned exam, caller's own submitted attempt, `p_question_id = any(question_ids)`, a note of >=15 words for that question); no restriction against the solution's own author commenting on their own solution (confirmed live: A's self-comment on their own `show_profile=false` solution succeeded). `delete_community_comment(p_comment_id) returns void` — single `delete ... using` join requiring `c.author_id = auth.uid() and c.status='visible'` plus the same exam-visibility/submitted-attempt gate; `get diagnostics row_count`, raises `42501 'delete_community_comment: not eligible'` on 0 rows deleted (covers "someone else's comment" and "own but hidden" with the SAME message, by construction). `community_my_comment_feed(p_page,p_page_size)` row condition (line ~3706) has NO filter on `e.status`/`is_author_banned` — that half of the R1 gate is explicitly exempted (ADR-0021 Decision 2 amendment, confirmed at doc line 48); `exam_visible` is a computed OUTPUT column instead, and `is_unread` depends only on the cursor vs `c.created_at`, independent of `exam_visible` — this is why the AC-002 gate (caller's own attempt now `in_progress`) is the only gate that makes the feed return zero rows for that exam, while the AC-004 gate (exam draft/banned) does not (the feed still lists the row, with `exam_visible=false`). `user_profiles.community_comments_last_read_at` (added same migration, no default) is written only via a plain update under the pre-existing `profiles_update_own` (`using(id=auth.uid()) with check(id=auth.uid())`) — another caller's update matches 0 rows (no error, `data.length===0`), never a table-closure-style denial.
- `docs/design/community-solutions-backend-design.md` § Integration Verification Points / § Test Boundaries "User-write RPC groups": table confirms Task 27 owns both `post_community_comment` and `delete_community_comment` refusal+success groups (cases a–i as enumerated in this task file), and that the "Feed columns"/"Feed unread cursor" cases explicitly say "in `test:localdb` or `test-rls.ts`" — placed feed-shape cases in the new localdb file per the file's own precedent (task 16 also split RLS/RPC cases into `test-rls.ts` and shape/ordering cases into its localdb file).
- § Open Items SN-1 (work plan): confirmed the S4 avatar assertion (`community_avatar_owner_visible`) is explicitly deferred to task 40 ("which tests its own migration") — not stubbed here.
- `SOURCE/lib/solutions/unreadComments.ts` (task 26): `countUnreadComments(rows, opts?)` takes `{solutionId, isUnread, examVisible}[]`; reused directly (not reimplemented) via a local `toUnreadRow` mapper from the raw RPC row shape, matching `features/solutions/queries.ts`'s own `mapCommentFeedRow`/`RawCommentFeedRow` field names (confirmed via `commentActions.test.ts`'s `rawFeedRow()` fixture: `comment_id, solution_id, exam_id, exam_title, question_number, comment_body, comment_created_at, author_display_name, is_unread, exam_visible` — exactly 10 keys, no commenter id/avatar column exists to omit).
- `handle_new_user()` (schema.sql): a user created via `admin.auth.admin.createUser` with no `raw_user_meta_data` gets `display_name = split_part(email, '@', 1)` — used this to assert the feed's `author_display_name` deterministically without a separate profile-read.
- **RED-phase discrimination proof (mandatory, performed)**: temporarily commented out the harness's `status='hidden'` flip before the S19 own-hidden-comment delete-refusal assertion (case (b) of the `delete_community_comment` group) and re-ran `npx tsx supabase/test-rls.ts` against dev — the assertion turned red (failure count 4→5, the new failure being exactly that case: the delete succeeded instead of raising `42501`, since without the flip the comment is still `'visible'` and the caller is its own eligible author). Reverted the flip; re-ran; back to the pre-existing baseline of 4 failures (see below). This confirms the assertion is not vacuously true.
- **Pre-existing, out-of-scope failures**: `npx tsx supabase/test-rls.ts` fails 4 checks (`R-p`, `R-r`, `R-t`, `R-u` — the Rating fixture group, Phần 2, unrelated to Community Solutions) both before and after this task's changes; confirmed by running `git show HEAD:SOURCE/supabase/test-rls.ts` (the pre-task committed version) standalone against the same dev DB and observing the identical 4 failures. Not this task's regression — out of scope (task file's own Target Files are `test-rls.ts` and the new localdb file for Community Solutions task 27 only); left unfixed and unreported further here beyond this note.
- **Correction (post-review, 2026-09-26)**: `integration-test-reviewer` re-verified this task and found the "feed unread cursor" test flaked reproducibly (2/2 runs) via client/server clock skew — root cause confirmed: `markCommentsRead()`'s cursor write in the test used `writer.client.from("user_profiles").update({ community_comments_last_read_at: new Date().toISOString() })`, a **client-generated** timestamp, compared server-side (`is_unread = c.created_at > p.community_comments_last_read_at`) against `created_at` values that are **server-generated** (`now()`). The reviewer measured ~500ms-1s client/server clock lag in this environment and confirmed root cause by adding a temporary 1.5s delay (made the test pass) then reverting it. **Fix applied**: replaced the client-side `new Date().toISOString()` with a server round-trip — re-selecting `created_at` of the just-posted C2 comment via the admin client (`admin.from("community_solution_comments").select("created_at").eq("id", c2Id).single()`) and using that server-sourced value as the cursor. This removes all dependence on wall-clock synchronization between test runner and DB host. Re-verified: `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` passed 31/31 on two consecutive runs (including the feed-unread-cursor test); `npx tsx supabase/test-rls.ts` re-run afterward — still only the same 4 pre-existing Rating-group failures (`R-p`/`R-r`/`R-t`/`R-u`), Phần 12 fully green; `npx tsc --noEmit` clean.
- **Production latent hazard (NOT fixed here — out of this task's scope/Target Files)**: `markCommentsRead()` in `SOURCE/features/solutions/actions.ts` has the same shape of hazard as the test bug just fixed — it writes a client-generated timestamp for `community_comments_last_read_at`, compared server-side against server-generated `created_at`. Under sufficient client/server clock skew in production (a real user's browser clock, not just a CI runner), a comment posted in the moments right after the user calls "mark as read" could theoretically be misclassified. Flagging for the orchestrator to relay to the engineer as a possible follow-up (e.g., have the RPC/action derive the cursor server-side, such as via a dedicated RPC using `now()`, instead of trusting the client's `Date`); no schema/action change made in this pass.
- **Correction to prior "clean npm test" claim**: my prior report claimed a full `npm test` run was "clean". This was inaccurate as stated — `integration-test-reviewer` found 3 failures in `components/tutor/ExplainStepAffordance.test.tsx` and `features/solutions/components/__tests__/FormulaPreview.error.test.tsx` (both confirmed untouched by this task's diff via `git status`, unrelated to Community Solutions). On re-verification just now (2 consecutive full `npm test` runs, post cursor-fix), both runs were fully green (185 files / 2430 tests passed, 1 file / 10 tests skipped, zero failures) — the 3 failures did not reproduce for me. Since the reviewer independently observed real failures in these exact out-of-scope files, treating this as flaky/order-dependent rather than asserting "clean": disclosing both observations rather than re-asserting a flat "clean" claim, mirroring how the 4 Rating-section `test-rls.ts` failures are disclosed above.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations (U1 is resolved — these are RPC groups, and every refusal group carries a table-closure case)
- [x] Write the groups; prove discrimination (e.g. run the hidden-comment delete with the setup flip skipped and confirm the refusal assertion turns red because the delete succeeds; revert)

### 2. Green Phase
- [x] Run against dev; all groups green without schema changes (a needed schema change means task 25 is wrong — stop and escalate)

### 3. Refactor Phase
- [x] Share fixture helpers with tasks 05/16
- [x] Confirm tests still pass

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` — Config: `SOURCE/supabase/test-rls.ts`
- `npm run test:localdb` — Config: `SOURCE/vitest.localdb.config.ts`
- `npm run verify:schema`, `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: run `test:localdb` as `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npx tsx supabase/test-rls.ts` and `test:localdb` (lane rule) from inside `SOURCE/` against dev.
- **Success criteria**: every case in § Implementation Content green — both comment RPC groups (incl. their table-closure cases and the AC-048 case), the M5 comment half and the S4 identity case, the cursor write case, the AC-004/AC-002 gates, name-resolution, plus the localdb feed-columns, feed-unread-cursor, ordering, AC-091 exclusion and AC-047/AC-048 feed cases. The S4 **avatar** assertion is not run here (SN-1 — it runs in task 40).
- **Failure response**: if the anonymous comment's identity is non-null for another reader, stop Phase 3 — fix the detail projection in a new migration before tasks 28–31.
- **Verification level**: L2 (real-DB tests added and passing)

## Proof Obligations
- **Claim** (AC-070, verbatim): "bình luận đang bị admin ẩn (S19): nút Xoá không có, API xoá bị từ chối" — proven here at the DB layer with a `status='hidden'` row flipped by the harness setup client (admin-hide itself lands in task 32).
- **Primary failure mode**: a user deletes their own admin-hidden comment, destroying moderated content.
- **Boundary to exercise**: live `.rpc("delete_community_comment", …)` from the author's own session, plus the table-closure case (a direct PostgREST delete is denied too).
- **State assertion**: row exists with `status='hidden'` → refused call (`42501`) → row still exists, unchanged.
- **Mock boundary rationale**: none — real dev DB.
- **Residual**: admin-hide itself lands in task 32; the UI half in task 28.

- **Claim** (R3 — AC-105/M5, anonymous comment): an anonymous comment's identity columns equal JSON `null` for a non-admin, non-author reader; `is_solution_author` stays present.
- **Primary failure mode** (SE skeleton): "a future edit to a masking RPC adds or restores a raw column reference, leaking author_id / display name / avatar path … on an anonymous … row."
- **Boundary to exercise**: live `community_solution_detail` from user B's session, raw JSON body.
- **State assertion**: N/A (read).
- **Mock boundary rationale**: none.
- **Residual**: admin-sees-true-identity half in task 47 (SE2).

- **Claim** (Failure Mode #7): the unread computation reads the real shared cursor column.
- **Primary failure mode**: "is unread" ignores the cursor (always true) or uses a per-comment flag.
- **Boundary to exercise**: live `community_my_comment_feed` before/after setting the cursor.
- **State assertion**: cursor null → rows unread; cursor set between comment 1 and 2 → comment 1 read, comment 2 unread.
- **Mock boundary rationale**: none.
- **Residual**: the S8 exam-not-visible exclusion from the count is proven in tasks 29 and 45.

- **Claim** (AC-091, PRD verbatim): "bình luận của chính tôi không bao giờ tính là mới; bình luận trên bài mà đề hiện không hiện (published bị gỡ / tác giả bị khoá, S8) không tính là mới trong lúc đó …; bình luận trên bài đang nháp / bị ẩn (S7) và bình luận bị admin ẩn (S19) cũng không tính."
- **Primary failure mode**: the badge count includes the viewer's own comment, an admin-hidden comment, a draft-solution comment, or an S8 comment — i.e. a naive `created_at > last_read_at` comparison.
- **Boundary to exercise**: live `community_my_comment_feed` rows from the viewer's session + the shared pure formula applied to those raw rows.
- **State assertion**: seeded (a)–(e) with cursor null → feed ids = {(d), (e)}; `countUnreadComments` = 1.
- **Mock boundary rationale**: none for the row set; setup-only flips use the existing harness setup client.
- **Residual**: badge rendering on the list card (task 29) and profile chip (task 45).

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: gates Phase 3 frontend tasks 28–31.
- Scope boundary: no schema edits; fixtures prefixed and cleaned idempotently; `status` changes in this task happen only through setup or self-delete (admin RPCs arrive in task 32).
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
