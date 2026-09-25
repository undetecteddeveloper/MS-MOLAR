# Task 13: DB Migration — list/detail RPCs + Helpful table + Helpful RPCs + pin RPC + comment/report table blocks

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P2-T1
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T1)
- **Dependencies**: task 03 (P1-T3). Phase 1 completion signed off. (U1 is resolved — no gate.)
- **Provides** (backend DD v1.9 § Migration Strategy "Migration ownership", task-13 row — **5 functions + 3 table blocks**): `community_solutions_list(text)`, `community_solution_detail(uuid)`, `set_community_solution_pin(text,text,uuid)`, `add_community_solution_helpful(uuid)`, `remove_community_solution_helpful(uuid)`; the `community_solution_helpfuls` table block; plus the **table blocks only** of `community_solution_comments` and `community_content_reports` (decomposer resolution R2). All three write tables carry RLS enabled, every privilege revoked from `anon`/`authenticated`, **no policies and no grants** — consumed by tasks 14, 15, 16, 25, 32
- **Size**: Medium (4 files)

## U1 — resolved (engineer decision 2026-09-17, backend DD v1.2; no gate remains)

Helpful, comment and report writes go through **six `SECURITY DEFINER` RPCs**; the three write tables have **no policies and no grants**. Two of those RPCs — `add_community_solution_helpful` and `remove_community_solution_helpful` — are created in this task; `post_`/`delete_community_comment` land in task 25 and `report_community_solution`/`report_community_comment` in task 32. The five v1.1 policies (`community_helpfuls_insert_own`, `community_helpfuls_delete_own`, `community_comments_insert_own`, `community_comments_delete_own`, `community_reports_insert_own`) are **gone from the design and are never written**; no database ever received them, so no `drop policy` is needed. Executor rule (unchanged): do not invent grants, policies or wrapper RPCs — apply exactly the DDL the backend DD v1.9 specifies.

## Implementation Content

Edit `schema.sql` with the task-13 statements copied **verbatim** from backend DD v1.9 § Data Contracts, in dependency order:

1. **`community_solution_helpfuls` table block** — create table, indexes, `enable row level security`, `revoke all … from anon, authenticated`. **No policy, no grant.**
2. **Decomposer resolution R2 — forward-referenced table blocks.** `community_solutions_list` is `language sql` and its DD-verbatim body joins `public.community_solution_comments`; `community_solution_detail` returns per-question comment rows and `i_reported`, which read `community_solution_comments` and `community_content_reports`. Postgres validates a SQL function body at `CREATE` time, and `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` forbids redefining a statement later with different text — so an interim function is not an option. Therefore this migration also creates, **exactly as the backend DD § Data Contracts "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" block defines them and in this order**: the `community_solution_comments` table block (create table, `status` + `body` CHECK constraints, `community_solution_comments_solution_idx`, `enable row level security`, `revoke all … from anon, authenticated`) and then the `community_content_reports` table block (create table, `reason` + `target` CHECK constraints, the two partial unique reporter indexes, `enable row level security`, `revoke all … from anon, authenticated`). Both stay **policy-less and grant-less for the whole feature** — tasks 25 and 32 add their RPCs, never a policy. No comment is placed directly above any of the three table blocks (a statement's text includes its leading comment, `SOURCE/lib/schema/splitStatements.ts`).
3. **`community_solutions_list(p_exam_id)`** — the DD SQL verbatim: the exact `order by` (Reference Contract Value #3); identity masked by `case when cs.show_profile then … end` with **no self-exception for the writer** (AC-062) and **no `else` branch**; `score`/`score_grading`/`per_question` gated together by `show_score`; `score_grading` by the pinned Score-grading condition; `left join public.user_profiles` (a writer with no profile row keeps their place with null identity); `comment_count` counting only visible comments under a **current** question whose note is ≥15 words (AC-047, AC-048).
4. **`community_solution_detail(p_solution_id)`** — the pinned **14 header / 7 per-question / 11 per-comment** columns of Reference Contract Value #14, in the DD's order, with the Solution identity, Comment identity, Solution status for comments, Comment note, Comment row, Hidden-comment, Comment count presence and Comment count conditions; `i_reported` per caller on the header **and on every comment**; `per_question` gated with `score`; own-preview carve-out for the writer of a draft/hidden solution returns header + questions + notes with an **empty** comments array and a **null** (never `0`) `comment_count` per question; current `question_ids` only (AC-047); empty result (not an exception) for an ineligible/nonexistent id.
5. **`set_community_solution_pin(p_exam_id, p_action, p_solution_id)`** — the DD SQL verbatim: atomic unset-then-set (AC-078), backstopped by the partial unique index from task 03; `'pin'` with a `null`, another exam's solution, or a draft of this exam → `22023`; `'unpin'` ignores the target.
6. **`add_community_solution_helpful(uuid)`** — exam visible + caller submitted + not the solution's own author + published solution, else `42501 add_community_solution_helpful: not eligible`; inserts `auth.uid()` with `on conflict (solution_id, user_id) do nothing` and returns `added` (`false` on a repeat — no `23505` ever reaches the client).
7. **`remove_community_solution_helpful(uuid)`** — exam visible + caller submitted, else `42501 remove_community_solution_helpful: not eligible`; a missing row is a silent no-op.

Every function: drop-then-create, `set search_path = public, pg_temp`, `revoke all … from public, anon`, `grant execute … to authenticated` — four statements per RPC in that order. Then run the fixed migration chain.

**The real-DB refusal/success cases for every object created here are written in task 16, not in this task** (backend DD v1.9 § Integration Verification Points, binding "Task ownership").

## Acceptance Criteria

From the plan (§ P2-T1): **AC-039 (data layer), AC-040, AC-041, AC-047, AC-048, AC-054, AC-055, AC-057, AC-062, AC-064–AC-067, AC-071, AC-073, AC-078; Reference Contract Values #3, #14, #20**.

Carried hard constraints that apply to this task:
- **Migration chain (fixed order)**: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` + §17 `schema_version` upsert (last statement) → `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_read_<fingerprint>.sql` containing only this task's statements → apply to dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. **No PROD apply** (task 52 only).
- **Migration statement immutability**: every statement is written in its final backend-DD form; no later task redefines any of them with different text.
- `exam_results` cross-user score read goes only through `linked_attempt_id`, gated by `show_score` — never a different attempt's data.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/supabase/migrations/20260925000000_community_solutions_read_c3c344fffc6e.sql` (new)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`
- [x] `SOURCE/supabase/verify-schema.ts` (one probe per new RPC, judged by the **message** per backend DD v1.9 § Migration Strategy "Probe rule (v1.3)", never by `error.code` alone):
  - anon client, every RPC → message must start with `permission denied for function`
  - probe user, `set_community_solution_pin(<random uuid>, 'unpin', null)` → `42501` with message exactly `set_community_solution_pin: exam not visible`
  - probe user, `add_community_solution_helpful(<random uuid>)` → `42501` with message exactly `add_community_solution_helpful: not eligible`
  - probe user, `remove_community_solution_helpful(<random uuid>)` → `42501` with message exactly `remove_community_solution_helpful: not eligible`
  - probe user, `community_solutions_list(…)` and `community_solution_detail(…)` → rows or zero rows, no error (probe rule 3)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (task 03 objects; `exam_results`, `exam_attempts`, `user_profiles`, `questions` definitions)
- The task 03 migration file under `SOURCE/supabase/migrations/` (naming + upsert shape to mirror)
- `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` (statement-presence rule behind resolution R2)
- `SOURCE/supabase/verify-schema.ts`
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_solutions_list(p_exam_id)`, `community_solution_detail(p_solution_id)` "Output columns (binding, v1.9)" and its binding conditions, `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`, "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" — the Helpful block and the comment/report **table blocks**, plus the eligibility parity and outcome tables)
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy — "Migration ownership (v1.8, binding)" task-13 row; the two probe tables; "Probe rule (v1.3)")
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `exam_results` cross-user read (show_score); `user_profiles` cross-user read + additive column)
- `docs/design/community-solutions-backend-design.md` (§ Security Considerations — every write re-derives its own eligibility gate; identity masked at SQL projection layer only)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-039, AC-054, AC-057, AC-063, AC-067, AC-078)

## Change Category

`Change Category: boundary-change`

This task publishes the masking RPC boundary every reader surface consumes. Adjacent cases to sweep: `user_profiles` (`profiles_select_own` RLS bypassed internally by the masking functions — confirm no raw column escapes), `exam_results` (score read only via `linked_attempt_id`), and the two consumers `SOURCE/features/solutions/queries.ts` (task 14) and `SOURCE/lib/solutions/identity.ts` (task 06).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision) | contract_schema | No `SELECT` grant to `anon`/`authenticated` on any new content table; every public read goes through a `SECURITY DEFINER` function projecting `case when <show-flag> then <column> end`. With U1 the three write tables also carry **no policy and no grant**: writes go only through the six user-write RPCs | `community_solution_helpfuls`, `community_solution_comments`, and `community_content_reports` each have `revoke all … from anon, authenticated`, no `grant`, and **zero policies**; list/detail and both Helpful RPCs are `security definer` |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Every new public-read RPC must re-derive its own eligibility gate inside its own body, never assume the caller already passed RLS | `community_solutions_list`, `community_solution_detail`, `set_community_solution_pin`, `add_community_solution_helpful` and `remove_community_solution_helpful` each contain their own R1 gate (published exam, not author-banned, caller submitted) |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | contract_schema | Every identity-bearing column returned to a non-author/non-admin caller must be produced by a `case when <visibility flag> then <column> end` expression, never a raw column reference — including any read path added later | Every `author_id`, `author_display_name`, `author_avatar_path`, `score`, and comment-author identity column in list/detail is a `case when … then … end` with no `else` branch, gated on the show-flag **alone** — no masking expression contains a `cs.author_id = auth.uid()` self-exception (v1.6 removed it; ownership reaches the writer only through `is_mine`, AC-062) |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Grant `EXECUTE` explicitly and narrowly (`authenticated` only, never `anon`); `revoke all ... from public, anon` before every `grant` on a new function | Each of the three new functions is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only |

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solutions_list`) | structure-order | `order by cs.is_pinned desc, coalesce(h.helpful_count, 0) desc, cs.updated_at desc, cs.id` | The `order by` clause of `community_solutions_list` in `schema.sql` is character-for-character this expression |
| `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points "Detail payload column enumeration"; work plan Reference Contract Value #14) | structure-order | Header keys `{id, author_id, author_display_name, author_avatar_path, is_pinned, updated_at, score, score_grading, per_question, is_mine, helpful_count, i_marked_helpful, i_reported, questions}`; per-question keys `{question_id, stem, correct_answer, has_changed, note, comment_count, comments}`; per-comment keys `{id, author_id, author_display_name, author_avatar_path, is_solution_author, is_mine, body, is_hidden_by_admin, hidden_reason, i_reported, created_at}` | `community_solution_detail` declares exactly those 14 / 7 / 11 keys — nothing missing, nothing extra; set equality both ways is asserted in task 16 |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` `comment_count`; work plan Reference Contract Value #20) | presence-conditional | `comment_count` is SQL `null` (never `0`) when the question carries no comment surface, an integer when it does | The comment-count presence condition projects `null` for a question with no current-question/≥15-word-note comment surface and for every question of a draft or hidden solution on the writer's own preview — the frontend renders the comment affordance if and only if the key is present |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` `score_grading`; work plan Reference Contract Value #18) | derived-display | `score_grading` is `null` exactly when `score` is null, and is the same pair on the list row and the detail header | One shared Score-grading expression is used by both functions; task 16 asserts the same pair on both read paths for the same solution |

## Boundary Context
(From the work plan's Connection Map — "Backend masking RPCs → frontend query layer"; this task is the producer)
- **Serialized format** (verbatim): "PostgREST JSON, `RETURNS TABLE` row — masked identity/score columns are JSON `null`, key always present (D003); `score_grading` and `per_question` are `null` together with `score`; no self-exception for the writer (AC-062) and no admin exception on these reads".
- **Consumer parse rule** (verbatim): "`toAuthorIdentity()`/`toScoreField()` treat `author_display_name===null` / `score===null` as the sole discriminant; never independent per-field checks".
- **Expected signal** (verbatim): "Mapped TS object has no `displayName`/`avatarUrl`/`authorId` key for a masked row; unmasked row carries fixture's own values unchanged".
- **Roundtrip check this producer must satisfy**: a masked row serializes every declared column as a JSON key whose value is `null` (not an empty string, not a placeholder), so the consumer's `=== null` discriminant fires. Proven on real DB in task 16 and task 47 (SE2).

## Investigation Notes
(Append observations before implementation. Record each Binding Decision / Reference Contract Compliance Check result.)

**Investigation Targets read:**
- `SOURCE/supabase/schema.sql` — task 03's §20 block (admin_users, count_words/question_content_fingerprint, community_solutions/community_solution_notes, save_community_solution, set_community_solution_status, community_moderation_log, community_solution_for_writer, community_solution_result_card) and §17 fingerprint upsert as the last statement. `exam_results` (id, attempt_id, user_id, total_score numeric(4,2), correct, total, per_question jsonb, topic_breakdown jsonb). `exam_answer_key(p_exam_id)` returns `(id, content, choices, correct_answer, subject, grade, topic, question_type, part_number, image_url, sub_answers, essay_answer, passage_id, points)`, `security definer`, gate = author OR (published AND submitted attempt) — already covers the R1 gate this task's functions also enforce, so calling it from inside `community_solution_detail` after the outer R1 gate is safe. `user_profiles` has `display_name`, `avatar_url`.
- `SOURCE/supabase/migrations/20260924000000_community_solutions_8b80e2188cc3.sql` (task 03 baseline-successor) — mirrored its header-comment style, its "apply DEV only, PROD is task 52" note, and its drop-then-create / revoke-then-grant statement shape for the new migration file.
- `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` — confirmed the cross-file check normalizes BOTH the migration file's and schema.sql's statement text (strips `--`/`/* */` comments, collapses whitespace) before comparing membership, so comment wording differences between the two files never fail this gate; the R2 "no leading comment" rule is a stricter, task-specific requirement layered on top for byte-identity with the backend DD text, not something the automated gate alone would catch.
- `SOURCE/lib/schema/splitStatements.ts` — confirmed a leading comment (any text between the prior `;` and the next statement's first token, blank lines included) is folded into that next statement's own `text` field, because `push()` only fires on `;`. This is why the three R2 table blocks (helpfuls, comments, reports) in `schema.sql` have literally zero comment lines immediately above `create table` — the section-overview comment was placed only after all three blocks, immediately above `community_solutions_list`, which is not one of the three forbidden objects.
- `SOURCE/supabase/verify-schema.ts` — mirrored task 03's "Phase 1" probe section (message-judged, anon rule 1 / probe-user rule 2 exact-message / rule 3 no-error) as the new "Phase 2" section (§12) for the five new RPCs.
- `docs/design/community-solutions-backend-design.md` § Data Contracts — read `set_community_solution_pin`, `community_solutions_list` (both DD-verbatim SQL blocks, copied unchanged), `community_solution_detail` (binding Output columns list + Invariants only — the DD leaves the function BODY as this task's own implementation detail, explicitly: "the migration task (13) may build them with whatever lateral joins or CTEs it prefers, provided the columns above, the masking rules, the eligibility gate, the v1.6 comment note condition and hidden-comment columns, and the v1.7 solution status condition with the comment row and count conditions that carry it all hold exactly as specified here"), and "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" (Helpful table+both RPCs DD-verbatim; comments/reports table blocks only, DD-verbatim).
- `docs/design/community-solutions-backend-design.md` § Migration Strategy — task-13 ownership row, Probe rule (v1.3) (judge by message, not `error.code` alone).
- `docs/design/community-solutions-backend-design.md` § Integration Point Map, § Security Considerations — every write re-derives R1; identity masked at SQL projection layer only.
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` § Decision, § Implementation Guidance — read; content matches the Binding Decisions table below verbatim.
- `docs/prd/community-solutions-prd.md` AC-039/AC-054/AC-057/AC-063/AC-067/AC-078 — read; no conflict with the DD's binding conditions found.

**Adjacent case sweep (Change Category: boundary-change):**
- `user_profiles` (`profiles_select_own` bypassed internally by the masking functions): confirmed `up.display_name` / `up.avatar_url` (list, detail header) and `cup.display_name` / `cup.avatar_url` (detail comments) are read ONLY inside a `case when <show-flag> then ... end` expression — no raw reference to either column appears anywhere outside a masking `case`.
- `exam_results` (cross-user score read only via `linked_attempt_id`): confirmed both `community_solutions_list` and `community_solution_detail` join `exam_attempts ea on ea.id = cs.linked_attempt_id` then `exam_results er on er.attempt_id = ea.id` — no other attempt id ever reaches `er`.
- `SOURCE/features/solutions/queries.ts` (task 14) and `SOURCE/lib/solutions/identity.ts` (task 06): out of scope for this task (not yet implemented on this branch as of task 13 — task 14/06 consume these RPCs later); no residual defect to record since these RPCs did not exist before this task.

**Binding Decisions — Compliance Check results:**

| Row (Axis) | Result | Evidence |
|---|---|---|
| contract_schema — no SELECT/policy/grant on the three content tables, six-RPC-only writes | Y | `community_solution_helpfuls`/`community_solution_comments`/`community_content_reports` each have exactly `alter table ... enable row level security;` + `revoke all on public.<table> from anon, authenticated;`, zero `create policy` and zero `grant` statements on any of the three, in both `schema.sql` and the migration file; `community_solutions_list`, `community_solution_detail`, `set_community_solution_pin`, `add_community_solution_helpful`, `remove_community_solution_helpful` are all `security definer` |
| dependency_direction — every new RPC re-derives its own R1 gate | Y | `community_solutions_list`'s `eligible` CTE; `community_solution_detail`'s WHERE clause (`e.status='published' and not is_author_banned(...) and exists(submitted attempt)`) plus the own-preview OR; `set_community_solution_pin`'s three `if not exists` guards; `add_/remove_community_solution_helpful`'s `if not exists` guards — none trust RLS |
| contract_schema — identity-bearing columns `case when <flag> then <col> end`, no self-exception | Y | Grepped every masking expression added by this task (`author_id`, `author_display_name`, `author_avatar_path`, `score`, `score_grading`, `per_question` in both list and detail; comment `author_id`/`author_display_name`/`author_avatar_path` in detail): none contains `= auth.uid()` inside the `case when` condition — only `cs.show_profile` / `cs.show_score` / the Comment identity condition (`not c.is_anonymous and (c.author_id <> cs.author_id or cs.show_profile)`, which compares to the SOLUTION's author, not the caller) |
| dependency_direction — `revoke all ... from public, anon` before every `grant execute ... to authenticated` on new functions | Y | All five new functions (`community_solutions_list`, `community_solution_detail`, `set_community_solution_pin`, `add_community_solution_helpful`, `remove_community_solution_helpful`) follow drop → create → `revoke all on function ... from public, anon;` → `grant execute on function ... to authenticated;`, in that exact order |

**Reference Contracts — Compliance Check results:**

| Row (Contract Type) | Result | Evidence |
|---|---|---|
| `community_solutions_list` order by (structure-order) | Y | `order by cs.is_pinned desc, coalesce(h.helpful_count, 0) desc, cs.updated_at desc, cs.id;` copied character-for-character from the DD's SQL block into both `schema.sql` and the migration file |
| Detail header/per-question/per-comment key set (structure-order) | Y | Counted and matched against the DD's "Output columns (binding, v1.9)" list: header 14 keys (`id, author_id, author_display_name, author_avatar_path, is_pinned, updated_at, score, score_grading, per_question, is_mine, helpful_count, i_marked_helpful, i_reported, questions`), per-question 7 keys (`question_id, stem, correct_answer, has_changed, note, comment_count, comments`), per-comment 11 keys (`id, author_id, author_display_name, author_avatar_path, is_solution_author, is_mine, body, is_hidden_by_admin, hidden_reason, i_reported, created_at`) — `returns table (...)` order and `jsonb_build_object` key order match this list 1:1, nothing added, nothing missing |
| `comment_count` null-vs-integer presence (presence-conditional) | Y | `comment_count` is a bare `case when <presence condition> then <count subquery> end` with no `else` — SQL `null` when the presence condition (published + a ≥15-word note exists for that question) is false |
| `score_grading` null iff `score` null, shared expression (derived-display) | Y | Identical text `case when cs.show_score then exists (select 1 from jsonb_array_elements(coalesce(er.per_question, '[]'::jsonb)) pq where pq ? 'essayState' and pq->>'essayState' <> 'graded') end` used verbatim in both `community_solutions_list` and `community_solution_detail`, gated by the same `cs.show_score` flag as `score` |

**Green-phase evidence (dev `hynwleaxtbtjzkvpjsug`):**
- `npm run schema:plan` target fingerprint `c3c344fffc6e`; `SCHEMA_FINGERPRINT` in `schemaFingerprint.ts` and the §17 upsert both updated to match; `npm run schema:plan` re-run confirms match.
- Migration applied via `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/20260925000000_community_solutions_read_c3c344fffc6e.sql` from inside `SOURCE/` — no error, empty `rows` (pure DDL).
- `npm run verify:schema` — full run green, including the five new "COMMUNITY SOLUTIONS Phase 2 (task 13)" probes (anon rule 1 × 5, probe-user exact-message rule 2 × 3 — pin/add/remove — and probe-user no-error rule 3 × 2 — list/detail) and the §17 fingerprint match (`c3c344fffc6e`) and the FK-catalog diff (44 declared = 44 on DB, all `on delete` clauses match).
- `npx vitest run lib/schema` — 7 files / 75 tests green (includes `migrationsMatchSchema.test.ts`, `schemaFingerprint.test.ts`, `parseForeignKeys`, `bannedAuthorVisibility.test.ts`).
- `npx tsc --noEmit` — clean.
- `npm test` — 2270 passed, 10 skipped, 2 pre-existing failures in `features/solutions/components/__tests__/FormulaPreview.test.tsx` / `FormulaPreview.error.test.tsx` (task 11 component, unrelated to this backend-only task) — reproduced with this task's four changed files stashed out, confirming the failure predates and is independent of this task.
- `npm run test:fixture -- --exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` — 1 file / 11 tests green.
- `npm run test:localdb -- --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` — 4 files / 20 tests green (run against dev, post-migration).
- `git status` confirms `SOURCE/lib/supabase/service-role.ts` has zero diff (TD-029 held).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent cases named in Change Category
- [x] Add `verify-schema.ts` probes for the three new RPCs; run the schema tests after editing `schema.sql` and confirm they go red until the constant + migration exist

### 2. Green Phase
- [x] Complete `schema.sql`; `npm run schema:plan`; constant + upsert; migration file; apply to dev; `npm run verify:schema`
- [x] Confirm schema tests and probes green

### 3. Refactor Phase
- [x] Explain R2's placement reason in `schema.sql` **without** putting a comment directly above any of the three table blocks — `SOURCE/lib/schema/splitStatements.ts` folds a leading comment into the statement's text, and the backend DD requires those blocks to stay byte-identical to its own SQL. Re-run the chain if any statement text changed
- [x] Confirm all checks remain green

## Quality Assurance Mechanisms
- `schemaFingerprint.test.ts` + `migrationsMatchSchema.test.ts` + `parseForeignKeys` + `bannedAuthorVisibility.test.ts` — Config: `SOURCE/lib/schema/__tests__/*.test.ts` — Covers: `schema.sql`, `migrations/*.sql`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`
- `npx tsx supabase/test-rls.ts` / `npm run test:localdb` — groups for these objects are written in task 16
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run the migration chain against dev `hynwleaxtbtjzkvpjsug`; `npm run verify:schema`; schema tests in `npm test`.
- **Success criteria**: migration applies cleanly (no `42P01 relation does not exist`); `verify:schema` green incl. the five new message-judged probes and the fingerprint match; schema tests green.
- **Failure response**: if the DD's list/detail SQL references another object not yet created, stop and escalate — do not substitute an interim function body (it would break `migrationsMatchSchema.test.ts` at the next migration).
- **Verification level**: L2 (probes added and passing)

## Proof Obligations
- **Claim** (ADR binding #2, #5): masked row's `case when` expression has no `else` branch, so a masked row's identity/score columns evaluate to `null`, not an incidental placeholder.
- **Primary failure mode**: a raw column reference or an `else ''` branch leaks or disguises identity on an anonymous row.
- **Boundary to exercise**: DDL text review + `verify:schema` probe; real JSON-null assertion in task 16.
- **State assertion**: N/A in this task.
- **Mock boundary rationale**: none.
- **Residual**: the live null-value proof is task 16 (solutions) / task 27 (comments) / task 47 (SE2).

- **Claim** (Failure Mode #7, shared-state dependency / AC-078): at most one pinned solution per exam at every point in time.
- **Primary failure mode**: a pin swap leaves two pinned rows (or zero after a failed swap) for one exam.
- **Boundary to exercise**: `set_community_solution_pin` body (unset-then-set in one function transaction) + partial unique index.
- **State assertion**: behavioural proof in task 16.
- **Mock boundary rationale**: none.
- **Residual**: see task 16.

- **Claim** (Failure Mode #1, same-value / AC-064, AC-066): the Helpful RPCs are the only write path, and a repeat is a no-op — `add_community_solution_helpful` uses `on conflict (solution_id, user_id) do nothing` and returns `added = false`, so no `23505` ever reaches the client and no client role can write the table directly.
- **Primary failure mode**: a policy or grant is added to `community_solution_helpfuls` to "make the write work", re-opening the direct PostgREST path U1 closed; or the repeat raises `23505` and the Server Action has to map a constraint error.
- **Boundary to exercise**: the two RPC bodies and the table block's `revoke`/zero-policy state, applied to dev.
- **State assertion**: N/A in this task — the `added: true` → `added: false` sequence and the table-closure refusal are asserted in task 16.
- **Mock boundary rationale**: none.
- **Residual**: both Helpful groups, including the table-closure case, are task 16's.

- **Claim** (Failure Mode #9, missing-sort-key ordering / S12): list order is total — `id` is the final tie-break.
- **Primary failure mode**: rows with equal pin/helpful/updated_at reorder between reads.
- **Boundary to exercise**: the `order by` clause (Reference Contract #3); behavioural proof in task 16.
- **State assertion**: N/A here.
- **Mock boundary rationale**: none.
- **Residual**: see task 16.

## Completion Criteria
- [x] All added probes/tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] The helpfuls, comments and reports table blocks exist on dev with RLS enabled, every privilege revoked from `anon`/`authenticated`, and **zero policies and zero grants** — and stay that way for the whole feature (no later task adds one)

## Notes
- Impact scope: tasks 25 and 32 must **not** re-create the two forward-referenced table blocks and must **not** add a policy to them — they add their `SECURITY DEFINER` RPCs only.
- Scope boundary: no PROD apply; objects from task 03 unchanged.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
