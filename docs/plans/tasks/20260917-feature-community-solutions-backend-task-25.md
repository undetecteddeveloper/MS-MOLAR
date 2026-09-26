# Task 25: DB Migration — comment RPCs + feed RPC + unread cursor column

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P3-T1
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T1)
- **Dependencies**: task 03 (P1-T3), task 13 (P2-T1 — comments reference a published, viewable solution; the `community_solution_comments` **table block** already exists from task 13 per resolution R2). Phase 2 completion signed off.
- **Provides** (backend DD v1.9 § Migration Strategy "Migration ownership", task-25 row — **3 functions + 1 additive column**): `post_community_comment(uuid,text,text,boolean)`, `delete_community_comment(uuid)`, `community_my_comment_feed(int,int)`, `user_profiles.community_comments_last_read_at` — consumed by tasks 26, 27, 29, 40, 45
- **Size**: Medium (4 files)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Comment writes go through the two `SECURITY DEFINER` RPCs this task creates. `community_solution_comments` (table block created in task 13, R2) keeps RLS enabled, every privilege revoked from `anon`/`authenticated`, and **no policy and no grant** — this task adds none. The v1.1 policies `community_comments_insert_own` / `community_comments_delete_own` are gone from the design and were never applied to any database, so no `drop policy` is needed. Executor rule: do not invent grants, policies or wrapper RPCs.

## Implementation Content

Edit `schema.sql` with the task-25 statements copied **verbatim** from backend DD v1.9 § Data Contracts ("SECURITY DEFINER user-write RPCs" — comments block, eligibility parity and outcome tables; `community_my_comment_feed`; `user_profiles.community_comments_last_read_at`):

1. **`post_community_comment(p_solution_id, p_question_id, p_body, p_is_anonymous)`** — eligibility re-derived inside the body from `community_solutions` + `exams` + `exam_attempts` + `community_solution_notes`: published solution, exam visible (published, author not banned), caller has a submitted attempt, `p_question_id` in the exam's **current** `question_ids` (AC-047), and that question's note is **≥15 words** (AC-048) — otherwise `42501 post_community_comment: not eligible`, one message for every failed condition, so a direct caller learns nothing. Inserts `auth.uid()` as the author, `is_anonymous = coalesce(p_is_anonymous, false)`, `status` left at `'visible'`; returns `comment_id` and `comment_created_at`. Never trusts a client-supplied eligibility flag.
2. **`delete_community_comment(p_comment_id)`** — own comment, `status = 'visible'`, exam visible, caller submitted; zero rows deleted → `42501 delete_community_comment: not eligible` (so an admin-hidden comment cannot be self-deleted, AC-070/S19). The comment's `community_content_reports` rows cascade with it.
3. **`community_my_comment_feed(p_page, p_page_size)`** — exactly **ten** output columns: `comment_id`, `solution_id`, `exam_id`, `exam_title`, `question_number`, `comment_body`, `comment_created_at`, `author_display_name`, `is_unread`, `exam_visible`. No commenter id and **no avatar path** (so task 42's signer never covers the feed). The binding Row condition: comments on the caller's **own published** solutions, under a current question with a ≥15-word note, newest first; excludes the caller's own comments, comments on draft/hidden solutions (S7) and admin-hidden comments (S19); `author_display_name` is the commenter's real name or `null` for an anonymous comment (AC-105). `is_unread` is computed at read time against `community_comments_last_read_at` (null cursor → unread) and is **unchanged by the exam's visibility**; `exam_visible` carries the exam gate, because this function is **exempt from the exam-published half of the R1 gate** (ADR-0021 Decision 2 amendment note). New-comment rule (Reference Contract Value #23): a row counts as new only when `is_unread && exam_visible` — the frontend applies it, this function supplies both flags. Page size capped server-side (not below 20).
4. **`alter table public.user_profiles add column if not exists community_comments_last_read_at timestamptz;`** — nullable, **no default** (a `default now()` would silently mark every pre-existing comment read); written only by `markCommentsRead()`'s plain update under the unchanged `profiles_update_own` policy.

Every function: drop-then-create, `set search_path = public, pg_temp`, `revoke all … from public, anon`, `grant execute … to authenticated` — four statements per RPC in that order.

**Do not re-create the `community_solution_comments` table block** — it was created in task 13 (resolution R2) — and **do not add any policy to it**. Then run the fixed migration chain.

**The real-DB refusal/success cases for every object created here are written in task 27, not in this task** (backend DD v1.9 § Integration Verification Points, binding "Task ownership").

## Acceptance Criteria

From the plan (§ P3-T1): **AC-047, AC-048, AC-069, AC-070, AC-072, AC-091, AC-092, AC-097, AC-098, S7, S19 (data layer); Reference Contract Value #23**.

Carried hard constraints that apply to this task:
- **Migration chain (fixed order)**: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` + §17 `schema_version` upsert (last statement) → `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_comments_<fingerprint>.sql` containing only this task's statements → apply to dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. **No PROD apply** (task 52 only).
- **Migration statement immutability**: no statement from tasks 03 or 13 is redefined with different text.
- `bannedAuthorVisibility.test.ts` stays green, unaffected.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/supabase/migrations/20260926000000_community_solutions_comments_9a0ac5d5fc49.sql` (new)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`
- [x] `SOURCE/supabase/verify-schema.ts` (one probe per new RPC, judged by the **message** per backend DD v1.9 § Migration Strategy "Probe rule (v1.3)", never by `error.code` alone; plus a column-existence check for `community_comments_last_read_at`):
  - anon client, every RPC → message must start with `permission denied for function`
  - probe user, `post_community_comment(<random uuid>, 'probe', 'probe', false)` → `42501` with message exactly `post_community_comment: not eligible`
  - probe user, `delete_community_comment(<random uuid>)` → `42501` with message exactly `delete_community_comment: not eligible`
  - probe user, `community_my_comment_feed(…)` → rows or zero rows, no error (probe rule 3)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (task 13's `community_solution_comments` table block; `user_profiles` + `profiles_update_own` at ~lines 453–454; `is_author_banned`)
- `SOURCE/lib/schema/__tests__/bannedAuthorVisibility.test.ts`, `migrationsMatchSchema.test.ts`, `schemaFingerprint.test.ts`, `parseForeignKeys.test.ts`
- `SOURCE/supabase/verify-schema.ts`
- `SOURCE/lib/auth/getCurrentUser.ts` (adjacent case: reads `user_profiles` columns — confirm the additive column does not change its select shape)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" (the comments block, its eligibility parity table and its outcome table); `community_my_comment_feed(p_page, p_page_size)` — ten output columns, Row condition, New-comment rule; `user_profiles.community_comments_last_read_at` and `avatars_select_community_visible`)
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy — "Migration ownership (v1.8, binding)" task-25 row; the user-write probe table; "Probe rule (v1.3)")
- `docs/design/community-solutions-frontend-design.md` v1.6 (§ Data Contracts — "Comment feed contract" `CommentFeedItem`, the ten columns' camelCase twin, no avatar)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision — the 2026-09-17 amendment note: `community_my_comment_feed` is exempt from the exam-published half of the R1 gate)
- `docs/design/community-solutions-backend-design.md` (§ Minimal Surface Alternatives — Element: `user_profiles.community_comments_last_read_at` reuse decision)
- `docs/design/community-solutions-backend-design.md` (§ State Transitions — `community_solution_comments.status` 2-state + 2 deletion doors)
- `docs/design/community-solutions-backend-design.md` (§ Security Considerations — every write re-derives its own eligibility gate)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `user_profiles` cross-user read + additive column)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision — comment 2-state lifecycle)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-070, AC-072, AC-091, AC-098, AC-099, S7, S8, S19)

## Change Category

`Change Category: state-change, boundary-change`

This task activates the comment status lifecycle's self-delete door and adds a persisted cursor column to a shared table. Adjacent cases to sweep: `profiles_update_own` (the policy the cursor write relies on, unchanged), `SOURCE/lib/auth/getCurrentUser.ts` (existing `user_profiles` reader), `bannedAuthorVisibility.test.ts` (banned-author clause must survive), and the two future cursor consumers (task 29 list badge, task 45 profile chip).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Every new public-read RPC must re-derive its own eligibility gate inside its own body, never assume the caller already passed RLS | `community_my_comment_feed` restricts rows to the caller's own published solutions inside its own body, and `post_community_comment` / `delete_community_comment` each re-derive submitted/published/not-banned/current-question/≥15-word-note eligibility inside their own bodies — no table policy carries any of it |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Grant `EXECUTE` explicitly and narrowly (`authenticated` only, never `anon`); `revoke all ... from public, anon` before every `grant` on a new function | `post_community_comment`, `delete_community_comment` and `community_my_comment_feed` are each followed by `revoke all … from public, anon` then `grant execute … to authenticated` only |

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map `is_unread`, `exam_visible`; work plan Reference Contract Value #23) | derived-display | "a row counts as new — in every count, badge and unread dot — only when `is_unread && exam_visible` (AC-091)" | The feed returns both flags as separate columns and combines neither: `is_unread` is computed against the cursor alone and stays unchanged when the exam goes invisible, `exam_visible` carries the exam gate, and the count formula lives once in `lib/solutions/unreadComments.ts` (task 26) |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_my_comment_feed`) | structure-order | Exactly ten columns: `comment_id`, `solution_id`, `exam_id`, `exam_title`, `question_number`, `comment_body`, `comment_created_at`, `author_display_name`, `is_unread`, `exam_visible` | The `returns table (...)` list has those ten and nothing else — in particular no commenter id and no avatar path (task 42's signer therefore never covers the feed) |

## Investigation Notes
(Append observations before implementation. Record each Binding Decision / Reference Contract Compliance Check result.)

- Read `schema.sql` §21 (task 13 block): `community_solution_comments` table already exists (RLS on, zero policy/grant, revoke all from anon/authenticated); confirmed via `grep` that no policy/grant statement touches it anywhere in the file. `community_solutions_list`/`community_solution_detail` are `language sql`, confirming the "body resolved at CREATE time" mechanic that also applies to `community_my_comment_feed` below. `user_profiles`/`profiles_update_own` at schema.sql:452-454 — row-scoped only (`id = auth.uid()`), no column restriction, so the additive `community_comments_last_read_at` column is writable under the unchanged policy with no edit needed. `is_author_banned(uuid)` signature confirmed (schema.sql:2464-2481).
- Read `bannedAuthorVisibility.test.ts`: reads `schema.sql` by regex against the LAST `exams_select_visible`/`questions_select_visible` policy definitions and `is_author_banned`'s body — none of these blocks are touched by this task's new statements (all appended near the end of the file, after §21, before §17); ran green (see below).
- Read `migrationsMatchSchema.test.ts`/`schemaFingerprint.test.ts`/`parseForeignKeys.test.ts`: confirmed the exact mechanics — migration statements are matched against `schema.sql` after comment/whitespace normalization (`normalize()`), and the newest migration file's declared fingerprint must equal `schema.sql`'s computed fingerprint. Followed exactly.
- Read `verify-schema.ts` in full: found the established per-phase probe block pattern (COMMUNITY SOLUTIONS Phase 1 / Phase 2 sections, each: anon-message-prefix probes, then behind `if (!probe)` a message-exact probe per write RPC, then a "never raises" probe for pure reads). Added a Phase 3 section following the identical shape, plus a column-existence probe (service_role `select` with `limit(1)`, since none of the 3 new RPCs read the column back to the anon/authenticated caller directly under RLS — this is the simplest read-only existence check, run on every target since it needs no `authenticated` session).
- Read `getCurrentUser.ts`: `getCurrentUserProfile()` selects `.select("display_name, avatar_url")` — an explicit column list, not `select("*")`. The additive `community_comments_last_read_at` column does not appear in it and is not read by this function; confirmed unaffected (adjacent case, Change Category sweep).
- Read backend DD v1.9 § Data Contracts: `post_community_comment`/`delete_community_comment` have a full verbatim `create function ... $$ ... $$` SQL block (lines 2021-2109) — copied character-for-character into `schema.sql`/the new migration. `community_my_comment_feed` has NO literal SQL block in the DD — only a YAML `Contract:` with every column's name/type/value-expression pinned as "binding" and one pinned "Row condition (binding)" predicate string, explicitly leaving "hình dạng thân hàm" (language choice, pagination mechanics) as "chi tiết triển khai của CHÍNH task này" — the same deliberate-gap pattern the DD uses for `community_solution_detail`'s body (§21 comment, and the HANDOFF's own precedent for that function). This is NOT a genuine design/contract gap requiring escalation (per the three HANDOFF precedents, the gap category that requires escalation is a *conflict* between two committed decisions, not a deliberately-left implementation-detail with fully pinned invariants) — proceeded by transcribing the pinned Row condition predicate verbatim into the `where` clause and the pinned column list verbatim into the `select`/`returns table` lists, choosing `language sql` (avoids the DD's flagged plpgsql name-resolution footgun entirely, and matches `community_solutions_list`/`community_solution_detail`'s existing convention) and a page-size ceiling of 20 (satisfies the DD's explicit "not below 20" floor; `LIST_ROW_CEILING` (500) was rejected as a model since it is documented as serving unbounded fetch-all reads, not per-page sizing, a different mechanism).
- Discovered ordering constraint (not in task file, derived from the `language sql` mechanic already documented at §21 for `community_solutions_list`/`community_solution_detail`): `community_my_comment_feed`'s body reads `p.community_comments_last_read_at`, so the `alter table ... add column` statement must precede the `create function` statement in both `schema.sql` and the migration file, or `create function` fails at CREATE time (Postgres resolves a `language sql` body's column references immediately). Ordered accordingly (column added right after the two comment RPCs, before the feed function) and documented why in a schema.sql comment.

**Binding Decisions compliance:**
1. "Every new public-read RPC must re-derive its own eligibility gate inside its own body" — planned approach: `community_my_comment_feed`'s `where` clause carries the full ownership/status/note/submitted-attempt predicate itself (no policy involved, the table has none); `post_community_comment`/`delete_community_comment` each carry their own `not exists`/`delete ... using` eligibility predicate. Result: **Y** — verified by reading the final SQL in schema.sql: no table policy exists on `community_solution_comments`, and each function's own body is the only place its eligibility predicate lives.
2. "Grant EXECUTE explicitly and narrowly... revoke all ... from public, anon before every grant" — planned approach: each of the three new functions gets exactly `revoke all on function ... from public, anon;` immediately followed by `grant execute on function ... to authenticated;`, no other grantee. Result: **Y** — verified by reading the final SQL (three revoke/grant pairs, `authenticated` only) and by the anon-probe section of `verify:schema` passing (anon gets `permission denied for function` on all three).

**Reference Contracts compliance:**
1. "a row counts as new only when `is_unread && exam_visible`" (derived-display) — planned approach: `community_my_comment_feed` returns `is_unread` computed only from the cursor comparison and `exam_visible` computed only from the exam's own status/ban check, as two independent columns; the combining `&&` is left to task 26's `lib/solutions/unreadComments.ts` (out of this task's scope). Result: **Y** — verified by reading the final `select` list: neither expression references the other.
2. "Exactly ten columns... in particular no commenter id and no avatar path" (structure-order) — planned approach: `returns table (...)` lists exactly the ten named columns in the pinned order, nothing else. Result: **Y** — verified by reading the final `returns table` clause (10 columns, no `author_id`/`avatar_path`) and by `verify:schema`'s Phase 3 probe returning 0 rows with no error for the probe user (structural shape unverifiable further without seed data — the row-count assertion is task 27's job per the task file's explicit split).

**Proof Obligations verified:**
1. `delete_community_comment`'s predicate includes `c.status = 'visible'` — confirmed present in the final SQL (schema.sql `delete from ... where ... and c.status = 'visible' ...`); zero rows matched raises `42501 'delete_community_comment: not eligible'` (behavioural proof deferred to task 27 per the task file).
2. `community_comments_last_read_at` added with no default, nullable — confirmed both via reading the DDL (`add column if not exists ... timestamptz;`, no `default` clause) and via a direct `information_schema.columns` query against dev (`hynwleaxtbtjzkvpjsug`): `column_default: null`, `is_nullable: "YES"`.
3. Admin-hidden comment exclusion from `community_my_comment_feed` — the Row condition's `c.status = 'visible'` predicate excludes hidden comments structurally (behavioural proof deferred to task 27 per the task file).

**Operation verification (dev, `hynwleaxtbtjzkvpjsug`):** migration applied via `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/20260926000000_community_solutions_comments_9a0ac5d5fc49.sql`, no error. `npm run verify:schema` green in full (includes the new Phase 3 block: column-existence check, 3 anon-permission-denied probes, `post_community_comment`/`delete_community_comment` exact-message probes, `community_my_comment_feed` no-error probe). `npx vitest run lib/schema` (75 tests, 7 files) green, including `bannedAuthorVisibility.test.ts`, `migrationsMatchSchema.test.ts`, `schemaFingerprint.test.ts`, `parseForeignKeys.test.ts`. `npx tsc --noEmit` clean. `npm test` (full suite): 181/183 test files pass; the 2 failing tests (`FormulaPreview.test.tsx`, `FormulaPreview.error.test.tsx`, task 11 component) are pre-existing, documented, out-of-scope flakiness (`docs/plans/community-solutions-HANDOFF.md` "Phát hiện ngoài phạm vi") — confirmed untouched by this task's changes (`git status` shows no diff on those files) and unrelated to any object this task creates.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations (U1 is resolved — the comment write path is the two RPCs, and no policy is added to `community_solution_comments`)
- [x] Sweep the adjacent cases named in Change Category
- [x] Add `verify-schema.ts` probe(s); edit `schema.sql` and confirm schema tests go red until constant + migration exist

### 2. Green Phase
- [x] `npm run schema:plan`; constant + upsert; migration file; apply to dev; `npm run verify:schema`
- [x] Confirm schema tests (incl. `bannedAuthorVisibility.test.ts`) and probes green

### 3. Refactor Phase
- [x] State in `schema.sql` why the comment table block lives in the task-13 section — but **not** as a comment directly above that block (a leading comment is part of the statement's text, `SOURCE/lib/schema/splitStatements.ts`, and the block must stay byte-identical to the backend DD)
- [x] Confirm all checks remain green

## Quality Assurance Mechanisms
- `schemaFingerprint.test.ts` + `migrationsMatchSchema.test.ts` + `parseForeignKeys` + `bannedAuthorVisibility.test.ts` — Config: `SOURCE/lib/schema/__tests__/*.test.ts`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`
- `npx tsx supabase/test-rls.ts` / `npm run test:localdb` — groups for these objects are written in task 27
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run the migration chain against dev `hynwleaxtbtjzkvpjsug`; `npm run verify:schema`; schema tests in `npm test`.
- **Success criteria**: migration applies cleanly; `verify:schema` green incl. new probe and fingerprint; schema tests green incl. `bannedAuthorVisibility.test.ts`.
- **Failure response**: if the migration attempts to create `community_solution_comments` again, remove that statement — the table block belongs to task 13.
- **Verification level**: L2 (probes added and passing)

## Proof Obligations
- **Claim** (plan, "ADR binding #1, comment lifecycle"): a `hidden` comment's delete is refused at the DB layer — `delete_community_comment`'s predicate `c.status = 'visible'` deletes zero rows and the function raises `42501` — not only hidden in the UI.
- **Primary failure mode**: the RPC omits the status predicate, letting a user erase an admin-hidden comment (and its evidence).
- **Boundary to exercise**: the RPC body here; behavioural proof in task 27.
- **State assertion**: see task 27.
- **Mock boundary rationale**: none.
- **Residual**: behavioural half in task 27.

- **Claim** (Failure Mode #7, shared-state dependency): `community_comments_last_read_at` is one shared cursor read by two surfaces; this task adds it once, nullable, with no default that would mark existing comments read.
- **Primary failure mode**: a `default now()` silently marks every pre-existing comment as read for every user.
- **Boundary to exercise**: column DDL + `verify:schema` column check.
- **State assertion**: for an existing profile row, the column value is `null` after migration.
- **Mock boundary rationale**: none.
- **Residual**: the two consumers' shared formula is proven in tasks 29 and 45.

- **Claim** (Failure Mode #8, rollback-only visibility / S19): an admin-hidden comment is excluded from `community_my_comment_feed` and from public detail reads for non-owners.
- **Primary failure mode**: the feed lists hidden comments, re-exposing moderated content to the solution writer.
- **Boundary to exercise**: feed function body; behavioural proof in task 27.
- **State assertion**: see task 27.
- **Mock boundary rationale**: none.
- **Residual**: behavioural half in task 27.

## Completion Criteria
- [x] All added probes/tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] `community_solution_comments` still has RLS enabled with **zero policies and zero grants** after this migration

## Notes
- Impact scope: tasks 26–31 and 45 depend on these objects; task 40's avatar-visibility function reads visible non-anonymous comments.
- Scope boundary: `profiles_select_own` and `profiles_update_own` unchanged; no PROD apply.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
