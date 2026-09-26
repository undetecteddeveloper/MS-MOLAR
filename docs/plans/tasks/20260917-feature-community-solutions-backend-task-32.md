# Task 32: DB Migration — report RPCs + admin moderation RPCs + moderation-log admin writers

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P4-T1
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T1)
- **Dependencies**: task 03 (P1-T3 — `admin_users`/`is_admin_user()`, `community_moderation_log` table), task 13 (P2-T1 — `community_content_reports` **table block** per resolution R2), task 25 (P3-T1). Phase 3 completion signed off.
- **Provides** (backend DD v1.9 § Migration Strategy "Migration ownership", task-32 row — **6 functions**): `report_community_solution(uuid,text)`, `report_community_comment(uuid,text)`, `admin_moderate_community_solution(uuid,text,text)`, `admin_moderate_community_comment(uuid,text,text)`, `admin_list_community_reports()`, `admin_get_community_solution_notes(uuid)` — consumed by tasks 33, 34, 35, 38, 39
- **Size**: Medium (4 files)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Report writes go through the two `SECURITY DEFINER` report RPCs this task creates. `community_content_reports` (table block created in task 13, R2) keeps RLS enabled, every privilege revoked from `anon`/`authenticated`, and **no policy and no grant** — this task adds none. The v1.1 policy `community_reports_insert_own` is gone from the design and was never applied to any database, so no `drop policy` is needed. Executor rule: do not invent grants, policies or wrapper RPCs.

## Implementation Content

Edit `schema.sql` with the task-32 statements copied **verbatim** from backend DD v1.9 § Data Contracts ("SECURITY DEFINER user-write RPCs" — reports block; the Admin RPCs block and its "Contract-only column lists"):

1. **`report_community_solution(p_solution_id, p_reason)`** and **`report_community_comment(p_comment_id, p_reason)`** — not one's own content, published solution (for a comment: its solution published and the comment visible), exam visible, caller submitted — otherwise `42501 <function>: not eligible`. Exactly one target column is written and the other left `null`; a repeat is skipped by the matching partial unique reporter index and returns `already_reported = true` (no `23505` ever reaches the client). A report writes **no** moderation-log row and changes nothing about the target (AC-075). **Do not re-create the `community_content_reports` table block** — it exists from task 13 (R2) — and do not add a policy to it.
2. **`admin_moderate_community_solution(p_solution_id, p_action, p_reason)`** — the DD SQL verbatim: the **admin gate runs first** (`if not is_admin_user() then raise … errcode '42501'` with message `admin_moderate_community_solution: not an admin`), before the reason and transition checks; `p_action` outside `{hide, restore, delete}`, a missing/blank/`null` reason on `hide`/`delete`, or a forbidden transition → `22023` (`… invalid action` / `… reason required` / `… invalid transition`); `P0002` when the solution is not found. Transitions: `hide` ← published, `restore` ← hidden (reason optional, back to published), `delete` ← published **or** hidden. Captures `exam_id`/`author_id` **before** the cascading `DELETE` so the log row is complete (AC-084); writes the status change or delete **and exactly one** `community_moderation_log` row per accepted call in one transaction; a refused call writes nothing.
3. **`admin_moderate_community_comment(p_comment_id, p_action, p_reason)`** — the same gate, order and error set for the comment state machine: `hide` ← visible, `restore` ← hidden, `delete` ← either; the comment's reports cascade on delete; one log row per accepted call with `target_type = 'comment'`, the commenter as `target_user_id` and the solution's exam as `exam_id`.
4. **`admin_list_community_reports()`** — R17 queue model with the **binding Queue row condition**: **every hidden solution is a row for as long as it is hidden, whatever its report count** (Reference Contract Value #26), plus every **published** solution with ≥1 open report on itself or on **any** comment of it (hidden comments included). "Chờ xử lý" vs "Đã ẩn" is computed from `community_solutions.status` alone; a `draft` solution is never a row. Queue row columns, unmasked (S5): `id`, `exam_id`, `exam_title`, `author_display_name` (the writer's **real** name whatever `show_profile`), **`author_is_anonymous_to_readers`** (`not cs.show_profile`), `status`, `report_count`, `report_reasons`, `reported_comments` and `hidden_comments`. Each `reported_comments` entry carries `id`, `question_number` (`array_position(e.question_ids, c.question_id)`, **`null`** once the question has left the exam), `body`, `commenter_display_name`, `commenter_is_anonymous_to_readers`, `report_count`, `report_reasons`; each `hidden_comments` entry (Entry condition: every `status = 'hidden'` comment of the row, whatever its report count, newest hidden first) carries `id`, `question_number`, `body`, `commenter_display_name`, `commenter_is_anonymous_to_readers`, `hidden_reason`, `hidden_at`, `report_count`. A row with no hidden comment carries an **empty array, never null**. The `is_admin_user()` gate runs before any row is read.
5. **`admin_get_community_solution_notes(p_solution_id)`** — exactly the three columns `{question_number, question_id, body}`, ordered by `question_number`, every note regardless of the admin's own submission status on that exam (AC-081); the snake_case twin of frontend `AdminSolutionNote` (Reference Contract Value #16).

Every function: drop-then-create, `set search_path = public, pg_temp`, `revoke all … from public, anon`, `grant execute … to authenticated` — four statements per RPC in that order. Then run the fixed migration chain.

**The real-DB refusal/success cases for every object created here are written in task 35, not in this task** (backend DD v1.9 § Integration Verification Points, binding "Task ownership"; the `i_reported` case, the admin-notes case and every admin-queue case are in 35).

## Acceptance Criteria

From the plan (§ P4-T1): **AC-017, AC-073–AC-076, AC-081, AC-082, AC-084–AC-086 (data layer), AC-106–AC-109, S5; Reference Contract Values #16, #26**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit acceptance criterion)**: this task adds **zero** exported functions and **zero** direct table writers to `SOURCE/lib/supabase/service-role.ts` — verified by re-running `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` in this task and confirming it is green with no diff to `service-role.ts` (TD-029/ADR-0019).
- **Migration chain (fixed order)**: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` + §17 `schema_version` upsert (last statement) → `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_moderation_<fingerprint>.sql` containing only this task's statements → apply to dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. **No PROD apply** (task 52 only).
- **Migration statement immutability**: no statement from tasks 03, 13, 25 is redefined with different text.
- `exam_reports`, `exam_moderation_log`, `moderateExam()`/`moderateExamAction` stay byte-for-byte unmodified.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_moderation_<fingerprint>.sql` (new)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`
- [x] `SOURCE/supabase/verify-schema.ts` (one probe per new RPC, judged by the **message** per backend DD v1.9 § Migration Strategy "Probe rule (v1.3)", never by `error.code` alone):
  - anon client, every RPC → message must start with `permission denied for function`
  - probe user, `report_community_solution(<random uuid>, 'probe')` → `42501` with message exactly `report_community_solution: not eligible`
  - probe user, `report_community_comment(<random uuid>, 'probe')` → `42501` with message exactly `report_community_comment: not eligible`
  - probe user, `admin_moderate_community_solution(<random uuid>, 'hide', 'probe')` → `42501 admin_moderate_community_solution: not an admin` (the gate runs before the reason/transition checks)
  - probe user, `admin_moderate_community_comment(<random uuid>, 'hide', 'probe')` → `42501 admin_moderate_community_comment: not an admin`
  - probe user, `admin_list_community_reports()` → `42501 admin_list_community_reports: not an admin`
  - probe user, `admin_get_community_solution_notes(<random uuid>)` → `42501 admin_get_community_solution_notes: not an admin`
  - the probe user (`signInProbeUser`) must **not** be in `admin_users`, and random ids guarantee no probe changes a row

## Investigation Targets
- `SOURCE/supabase/schema.sql` (task 03 `community_moderation_log` + `is_admin_user()`; task 13 `community_content_reports` table block; `exam_moderation_log`/`exam_reports` at ~lines 354–365, 437–447, 1645–1660, 1820–1824 as preserved siblings)
- `SOURCE/lib/supabase/service-role.ts` (lines ~131–206: `moderateExam` — the grandfathered path this design must not extend) and `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `SOURCE/lib/auth/admin.ts` (`ADMIN_USER_IDS` — app-layer list that must stay in sync with dev `admin_users`)
- `SOURCE/supabase/verify-schema.ts`
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — Admin RPCs: `admin_list_community_reports()` (Queue row condition, Queue row columns, Entry condition, Hidden-comment columns), `admin_get_community_solution_notes(p_solution_id)`, `admin_moderate_community_solution(p_solution_id, p_action, p_reason)`, `admin_moderate_community_comment(p_comment_id, p_action, p_reason)`; "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" → the **reports block** and its eligibility parity/outcome tables; "Contract-only column lists")
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy — "Migration ownership (v1.8, binding)" task-32 row; both probe tables; "Probe rule (v1.3)")
- `docs/design/community-solutions-frontend-design.md` v1.6 (§ Data Contracts — "Admin report row contract": `AdminReportedSolution`, `AdminReportedAuthor` = `{ displayName, isAnonymousToReaders }` with **no** `avatarUrl`, `AdminReportedCommentItem.questionNumber: number | null`, `AdminHiddenCommentItem`; "Admin solution-notes contract" `AdminSolutionNote`)
- `docs/design/community-solutions-backend-design.md` (§ Design-Attention — `community_content_reports` new shared structure; `community_moderation_log` new sibling (admin writers))
- `docs/design/community-solutions-backend-design.md` (§ State Transitions — `community_solutions.status` 3-state + hard-delete exit; `community_solution_comments.status` 2-state + 2 deletion doors)
- `docs/design/community-solutions-backend-design.md` (§ Security Considerations — every write re-derives its own eligibility gate)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `SOURCE/lib/supabase/service-role.ts` deliberately zero integration)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/adr/ADR-0019-continuing-with-service-role.md`
- `docs/prd/community-solutions-prd.md` (AC-073–AC-076, AC-081–AC-086, AC-106–AC-109, R17, S5)

## Change Category

`Change Category: state-change, boundary-change`

This task adds the admin transitions (hide/restore/hard-delete) for both content types and publishes the admin RPC boundary. Adjacent cases to sweep: `exam_moderation_log`/`exam_reports`/`moderateExam()` (preserved siblings — confirm untouched), `SOURCE/lib/supabase/service-role.ts` (must not grow), `SOURCE/lib/auth/admin.ts` (`ADMIN_USER_IDS` vs `admin_users` drift — operational, named in ADR-0021), and the consumers `SOURCE/features/solutions/adminActions.ts` (task 34) and `community_solution_result_card` (task 03 — reads the log's `viewed_at`).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision) | persistence | `community_solutions.status ∈ {draft,published,hidden}`; admin hard-delete is a transition-**out** via real `DELETE`+cascade, never a 4th status value | The `delete` branch of both admin moderation functions executes a real `DELETE` and no function writes a status value outside the allowed set |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision) | placement | `admin_users`(user_id) table (RLS-locked, zero policies) + `is_admin_user()` gate new RPCs granted to `authenticated`; zero new exports/writers in `service-role.ts` | Each of the four admin RPCs calls `is_admin_user()` before any read/write, and `git diff` shows no change to `SOURCE/lib/supabase/service-role.ts` |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Every new public-read RPC must re-derive its own eligibility gate inside its own body, never assume the caller already passed RLS | `admin_list_community_reports` applies the `is_admin_user()` gate inside its own body before any row is read, and `report_community_solution` / `report_community_comment` each re-derive reporter eligibility (not own content, published solution, exam visible, caller submitted) inside their own bodies — no table policy carries any of it |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Grant `EXECUTE` explicitly and narrowly (`authenticated` only, never `anon`); `revoke all ... from public, anon` before every `grant` on a new function | Each of the six functions is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing | `serviceRoleSurface.test.ts` is green and `git diff --stat SOURCE/lib/supabase/service-role.ts` is empty |

## Boundary Context
(From the work plan's Connection Map — "Admin moderation RPCs → `adminActions.ts`"; this task is the producer)
- **Serialized format** (verbatim): "PostgREST JSON — unmasked (S5): `author_display_name` + `author_is_anonymous_to_readers`, `reported_comments` and `hidden_comments` jsonb arrays, notes `{question_number, question_id, body}`".
- **Consumer parse rule** (verbatim): "`adminActions.ts` never imports `@/lib/supabase/service-role`; calls `.rpc()` on the session client only; admin rows never pass through `toAuthorIdentity`; form actions return `{ error: string }` on refusal".
- **Expected signal** (verbatim): "Mocked session client's `.rpc()` called with exactly the RPC name; zero `.from("community_solutions").update(...)` calls".
- **Producer obligation**: the six RPC names and argument names match the DD exactly so the consumer's `.rpc(name, args)` resolves (a mismatch surfaces as `PGRST202`, caught by the `verify:schema` probes); every nested entry carries the fields its frontend twin declares — in particular `author_is_anonymous_to_readers` and `commenter_is_anonymous_to_readers`, and **no** avatar path or url anywhere in the admin payload (`AdminReportedAuthor` has exactly `{ displayName, isAnonymousToReaders }`).

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points "Admin notes shape"; frontend DD v1.6 "Admin solution-notes contract"; work plan Reference Contract Value #16) | structure-order | "their keys equal exactly `{question_number, question_id, body}` (set equality both ways); the `question_number` values are `[1, 3]` in that order" — the twin of `AdminSolutionNote { questionNumber: number; questionId: string; body: string }` | `admin_get_community_solution_notes`'s `returns table (...)` declares exactly those three columns, ordered by `question_number`, with no extra column and no submission gate on the admin |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts Admin RPCs "Queue row condition"; work plan Reference Contract Value #26) | state-lifecycle-negative | "a hidden solution is a row for as long as it is hidden, whatever its report count" | The queue condition's "Đã ẩn" half is `cs.status = 'hidden'` with **no** report predicate, so a hidden row survives the hard-delete of the comment that carried its last open report and "Khôi phục" always has a row to sit on (AC-082, AC-108) |

## Investigation Notes
(Append observations before implementation. Record each Binding Decision / Reference Contract Compliance Check result.)

**Observations (2026-09-26, executor):**
- `schema.sql`: §20a `admin_users` + `is_admin_user()` (`language sql stable security definer`, reads `admin_users where user_id = auth.uid()`, granted to `authenticated` only). §20f `community_moderation_log` (target_id deliberately no FK; `exam_id` FK cascade; `target_user_id`/`actor_id` on delete set null; CHECKs target_type ∈ {solution,comment}, action ∈ {hide,restore,delete}; RLS on, revoked). §21 ends the `community_content_reports` table block at `revoke all … from anon, authenticated` (both partial unique reporter indexes present: `community_content_reports_solution_reporter_idx`, `…_comment_reporter_idx`) — no policy, no grant. §21 header already states "không migration nào sau đây được thêm một policy hay một grant lên ba bảng này". §22 (task 25) ends at `community_my_comment_feed`; §17 `schema_version` upsert is the file's last statement (fp `9a0ac5d5fc49`). New §23 block goes between §22 and §17.
- `community_solutions` columns: `id, exam_id, author_id, status, show_profile, show_score, is_pinned, linked_attempt_id, created_at, updated_at`; `community_solution_comments`: `id, solution_id, question_id, author_id, is_anonymous, body, status ('visible'|'hidden'), created_at`; notes PK `(solution_id, question_id)`, `body text not null default ''`. `user_profiles.display_name text`, `exams.title text`, `exams.question_ids text[]` — `return query` types match `returns table` exactly (text/boolean/int/text[]/jsonb).
- PL/pgSQL name-resolution rule (DD § "PL/pgSQL name resolution (v1.3)"): `admin_list_community_reports` output columns `id`, `exam_id`, `status` and notes output columns `question_id`, `body` are also table columns → every reference alias-qualified; ORDER BY uses the expression, never the bare output name.
- `service-role.ts`: `moderateExam` (line ~181) is the grandfathered path; `git diff --stat` on it is empty at start. `serviceRoleSurface.test.ts` present. `lib/auth/admin.ts`: `ADMIN_USER_IDS` env list → `isAdminUserId()`; DB twin is `admin_users` (seeded out-of-band per project).
- `verify-schema.ts`: sections 11–13 hold Phase 1–3 probes (anon loop "permission denied for function" + probe-user exact `code === "42501" && message === <pinned>` with PGRST202 branch). Section 12 already asserts the probe user is NOT in `admin_users`. New section 14 follows the same shape.
- Migration file pattern (task 25): section header comment + statements only, then the §17 upsert with the new fingerprint. `migrationsMatchSchema.test.ts` compares comment-stripped statements, so every migration statement must appear in `schema.sql`.

**Adjacent case sweep (state-change, boundary-change):**
- `exam_reports` / `exam_moderation_log` / `moderateExam()` / `moderateExamAction`: not referenced by any new statement; no edit to their sections (verified by `git diff` at the end — only §23 insertion + §17 value change).
- `service-role.ts`: zero integration (all admin writes live in `SECURITY DEFINER` RPCs gated by `is_admin_user()`).
- `ADMIN_USER_IDS` vs dev `admin_users` drift: operational (ADR-0021 Consequences); out of Target Files — residual noted for task 35/52 (seed check before admin success tests).
- `community_solution_result_card` reads `community_moderation_log.viewed_at`: new log rows insert with `viewed_at` null (column default), so the writer's unseen-deletion notice triggers as designed; no change needed.
- `adminActions.ts` (task 34): consumer not yet present; RPC and argument names copied from the DD so `.rpc(name, args)` resolves.

**Binding Decisions — planned approach (pre-implementation):**
- persistence: `delete` branches run a real `delete from …` (cascade), `hide`/`restore` write only 'hidden'/'published' (solution) and 'hidden'/'visible' (comment) → **Y**.
- placement: every admin RPC's first statement is `if not public.is_admin_user() then raise …`; no file under `lib/supabase` touched → **Y**.
- dependency_direction (re-derive gate): report RPCs carry the DD's single `not exists` eligibility guard (own content, published solution, exam published + author not banned, caller submitted); list RPC gates before `return query` → **Y**.
- dependency_direction (grants): each of the six functions = drop → create → `revoke all … from public, anon` → `grant execute … to authenticated` → **Y**.
- dependency_direction (service-role frozen): no edit to `service-role.ts` → **Y** (re-evaluated at exit).

**Reference Contracts — planned approach:**
- #16: `admin_get_community_solution_notes` `returns table (question_number int, question_id text, body text)`, rows = notes whose question is in the exam's current `question_ids`, `order by array_position(...)`, no submission gate → **Y**.
- #26: queue predicate `cs.status = 'hidden' or (cs.status = 'published' and (exists report on solution or exists report on any comment))` — the hidden half carries no report predicate → **Y**.

**Exit-gate re-evaluation against the final implementation (2026-09-26):**
- Result: new fingerprint `cb08928767f8`; migration `SOURCE/supabase/migrations/20260927000000_community_solutions_moderation_cb08928767f8.sql` (the §23 block + §17 upsert only) applied to DEV `hynwleaxtbtjzkvpjsug` via `npx supabase db query --linked … --file`; `verify:schema` reports "DB đang chạy đúng bản schema.sql trong git (cb08928767f8)" and all 12 new checks (6 anon "permission denied for function" + 6 probe-user exact messages) ✓. No PROD apply.
- Red evidence: before the apply, the same 12 checks failed with `PGRST202`; after the `schema.sql` edit, `schemaFingerprint.test.ts` and `migrationsMatchSchema.test.ts` went red (2 failures) until constant + migration existed; after, `lib/schema/__tests__` + `serviceRoleSurface.test.ts` 81/81 green; `npm test` 2464 passed / 10 skipped (pre-existing); `npx tsc --noEmit` clean.
- Two pre-existing `verify:schema` failures NOT from this task (present in the Red run before any schema edit): `questions.subject` (8 rows) and `exams.subject` (7 rows) with `"Toán"` on leftover `rls-*` fixture rows on dev (TD-016 check). Data, not schema; out of Target Files — residual for the engineer (`supabase/one-off/2026-08-14-td016-canonical-subject.sql`, or clean the `rls-*` fixtures).
- Runtime smoke (dev, one transaction, `rollback`): as an `admin_users` member under `role authenticated`, `admin_get_community_solution_notes` returned `{question_number, question_id, body}` rows; with a published solution flipped to `hidden` inside the txn, `admin_list_community_reports` returned it as a row with `report_count 0`, `report_reasons []`, `reported_comments []`, `hidden_comments []`, and no avatar key (RC #26 shape). Dev has no comments on a published solution, so the hidden-comment entry path runs first in task 35.
- Catalog (dev): `community_content_reports` RLS on, 0 policies, 0 grants to anon/authenticated/PUBLIC; all 6 new functions `prosecdef = true`, `search_path=public, pg_temp`, EXECUTE anon = false, authenticated = true.
- BD persistence → **Y**: `delete from public.community_solutions …` / `delete from public.community_solution_comments …` are real DELETEs; only 'hidden'/'published'/'visible' are written.
- BD placement → **Y**: first statement of all four admin RPCs is `if not public.is_admin_user() then raise … '42501'`; `git diff --stat SOURCE/lib/supabase/service-role.ts` empty.
- BD re-derive gate → **Y**: list/notes gate before `return query` (and repeat `public.is_admin_user()` in the WHERE — per-row gate, DD Invariant); report RPCs carry the DD eligibility guard verbatim; no policy added.
- BD grants → **Y**: 6 × (drop → create → `revoke all … from public, anon` → `grant execute … to authenticated`), confirmed by catalog.
- BD service-role frozen → **Y**: `serviceRoleSurface.test.ts` green, diff empty.
- RC #16 → **Y**: `returns table (question_number int, question_id text, body text)`, ordered by `array_position(e.question_ids, n.question_id)`, no submission gate.
- RC #26 → **Y**: the WHERE clause is the DD's Queue row condition verbatim; hidden half has no report predicate (smoke confirmed a 0-report hidden row).
- Proof Obligations: AC-084 ordering met in the body (`select … into v_exam_id, v_author_id` precedes DELETE; log insert in the same function call) — behavioural half task 35. Invalid action: `p_action not in (…)` raises `22023` before any read/write. Repeat report: `on conflict … do nothing` + `already_reported = (row_count = 0)`, no `23505` path. Rollback-only visibility: restore writes only a status; a deleted row has no path back — behavioural half tasks 35/38/39.
- Preserved siblings: `git diff -U0 schema.sql` = one pure insertion hunk (§23) + the §17 value line; no statement of tasks 03/13/25 and nothing in `exam_reports`/`exam_moderation_log`/`moderateExam` changed.
- Queue row order (DD does not pin it): published ("Chờ xử lý") first, then hidden, each newest `updated_at` first, `cs.id` tiebreak.

**Review fix: gate-order probes (integration-test-reviewer, 2026-09-26, result `needs_revision`):**
- Gap found: the probe-user checks for `admin_moderate_community_solution`/`admin_moderate_community_comment` used a valid action (`'hide'`) and a non-empty reason (`'probe'`). That shows the `is_admin_user()` gate runs before the row read (`P0002`). It does not show the gate runs before the `invalid action` (`22023`) and `reason required` (`22023`) checks: with valid input both checks pass, so the probe would stay green if the gate were moved below them.
- Fix: `SOURCE/supabase/verify-schema.ts` §14 gets `csPhase4GateOrderProbes`. It holds two extra probe-user rows (Rule 2 only) that call each admin moderate RPC with `p_action: "bogus"` and `p_reason: null`. Each row expects exactly `42501` with the pinned "<fn>: not an admin" message. The rows are kept out of `csPhase4Probes` because anon is refused before the function body runs, so an anon probe cannot tell the gate order. `schema.sql`, fingerprint and migration are unchanged.
- Result (`npm run verify:schema`, dev): task 32 now has 14 checks (6 anon + 8 probe-user), all passing. The only failures are the 2 pre-existing TD-016 `subject` failures on `rls-*` rows (unrelated, not touched).

**Review fix round 2: reason-required gate-order probes (integration-test-reviewer round 2, 2026-09-26, fixed):**
- Gap found: the two `'bogus'` rows only prove the gate runs before the `invalid action` check. The `reason required` branch is `if p_action in ('hide','delete') and btrim(coalesce(p_reason,'')) = ''`, so with `p_action = 'bogus'` that branch is never reached. A gate moved below the reason check (but kept above the action check) would stay green.
- Fix: two more rows in `csPhase4GateOrderProbes` (the `'bogus'` rows are kept). They call `admin_moderate_community_solution` and `admin_moderate_community_comment` with a random id, `p_action: "hide"` (valid) and `p_reason: null`. Each expects exactly `42501` with the pinned "<fn>: not an admin" message. If the gate ran after the reason check, these rows would get `22023` 'reason required' and fail. The block comment and the skip text now say "4 probe thứ tự gate". `schema.sql`, fingerprint and migration are unchanged.
- Result (`npm run verify:schema`, dev): the COMMUNITY SOLUTIONS Phase 4 block has 16 checks (6 anon + 6 base probe-user + 4 gate-order), 16/16 passing. The only failures are the same 2 pre-existing TD-016 `subject` failures ("Toán" on `rls-*` rows; unrelated, not touched).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations (U1 is resolved — the report write path is the two report RPCs, and no policy is added to `community_content_reports`)
- [x] Sweep the adjacent cases named in Change Category
- [x] Add the seven message-judged `verify-schema.ts` probes; edit `schema.sql` and confirm schema tests go red until constant + migration exist

### 2. Green Phase
- [x] `npm run schema:plan`; constant + upsert; migration; apply to dev; `npm run verify:schema`
- [x] Re-run `serviceRoleSurface.test.ts`; confirm green with no diff

### 3. Refactor Phase
- [x] Comments in `schema.sql` explain the capture-before-delete ordering
- [x] Confirm all checks remain green

## Quality Assurance Mechanisms
- `serviceRoleSurface.test.ts` — Enforces: ≤13 exported ops, exactly 4 direct writers, 1 env read, 1 `createClient(` — Config: `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `schemaFingerprint.test.ts` + `migrationsMatchSchema.test.ts` + `parseForeignKeys` + `bannedAuthorVisibility.test.ts` — Config: `SOURCE/lib/schema/__tests__/*.test.ts`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`
- `npx tsx supabase/test-rls.ts` — admin + report groups written in task 35
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run the migration chain against dev; `npm run verify:schema`; `npm test` (schema tests + `serviceRoleSurface.test.ts`).
- **Success criteria**: migration applies cleanly; `verify:schema` green incl. all seven message-judged probes (the four admin RPCs → `… not an admin`; the two report RPCs → `… not eligible`); schema tests green; `serviceRoleSurface.test.ts` green, no diff to `service-role.ts`.
- **Failure response**: if any admin path appears to need `service-role.ts`, stop and escalate — ADR-0021 Decision 3 forbids it.
- **Verification level**: L2 (probes added and passing)

## Proof Obligations
- **Claim** (AC-084, plan verbatim): "the system shall remove the solution row and every dependent note/helpful/comment/report row in one transaction, and shall write exactly one `community_moderation_log` row that outlives the deletion."
- **Primary failure mode**: the log insert runs after the cascade reads a now-missing row (null `exam_id`/`target_user_id`), or the delete and log are not atomic.
- **Boundary to exercise**: function body ordering here; behavioural proof in task 35's admin success group.
- **State assertion**: see task 35 (solution + dependents present → delete → none present; log count +1 with non-null `exam_id`/`target_user_id`).
- **Mock boundary rationale**: none.
- **Residual**: behavioural half in task 35.

- **Claim** (Failure Mode #4, invalid option): `p_action` outside `{hide, restore, delete}` raises `22023` with no row change and no log row.
- **Primary failure mode**: an unknown action falls through to the delete branch.
- **Boundary to exercise**: function body (`if p_action not in (…)` before any write); probe in `verify:schema`.
- **State assertion**: see task 35.
- **Mock boundary rationale**: none.
- **Residual**: none.

- **Claim** (Reference Contract Value #26 / AC-081, AC-082, AC-107, AC-108): a hidden solution is a queue row for as long as it is hidden, whatever its report count, and a hidden comment stays inside its solution's row under `hidden_comments` without moving or dropping that row.
- **Primary failure mode**: the queue condition requires a report for **both** parts (the v1.7 shape), so hiding a solution and then hard-deleting the comment that carried its last open report drops the row — the admin loses the only "Khôi phục" path while the solution stays `hidden` and locked (S6/AC-083).
- **Boundary to exercise**: the Queue row condition and Entry condition in `admin_list_community_reports`'s body.
- **State assertion**: N/A in this task — the queue membership sequences are asserted in task 35.
- **Mock boundary rationale**: none.
- **Residual**: every admin-queue case (hidden comments, hidden-solution membership, the two anonymity flags) is task 35's; the UI is task 38.

- **Claim** (Failure Mode #1, same-value / AC-074, AC-076): a repeat report is a **success** returning `already_reported = true`, never a `23505`, and a report changes nothing about its target (AC-075).
- **Primary failure mode**: the duplicate index error escapes to the client, so the Server Action has to map a constraint error and the reader sees a failure for an action that already succeeded.
- **Boundary to exercise**: the two report RPC bodies (the repeat is skipped against the partial unique reporter index) applied to dev.
- **State assertion**: N/A here — `[{ already_reported: false }]` then `[{ already_reported: true }]` with one row throughout is asserted in task 35.
- **Mock boundary rationale**: none.
- **Residual**: both report RPC groups, including their table-closure cases, are task 35's; `reportSolution`/`reportComment` unit tests are task 33's.

- **Claim** (Failure Mode #8, rollback-only visibility): a hidden solution/comment is visible only to its owner (with reason) and admins; a hard-deleted row is visible to nobody, ever.
- **Primary failure mode**: `restore` or a read RPC resurrects a hard-deleted row's data, or a hidden row leaks to other readers.
- **Boundary to exercise**: admin RPC transitions + existing read RPC gates (tasks 03/13) re-checked in task 35.
- **State assertion**: see task 35.
- **Mock boundary rationale**: none.
- **Residual**: UI half in tasks 38/39.

## Completion Criteria
- [x] All added probes/tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] `community_content_reports` still has RLS enabled with **zero policies and zero grants** after this migration
- [x] `serviceRoleSurface.test.ts` green with no diff to `SOURCE/lib/supabase/service-role.ts` (TD-029)

## Notes
- Impact scope: tasks 33–39 depend on these objects; task 41's reputation function reads statuses these transitions change.
- Scope boundary: no PROD apply; preserved sibling structures untouched.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
