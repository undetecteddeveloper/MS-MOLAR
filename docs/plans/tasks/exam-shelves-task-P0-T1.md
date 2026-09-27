# Task P0-T1 — `schema.sql` §20a/20b/20c: `exam_attempts.source`, hot index, `exam_hot_counts()`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0 (Schema, Fingerprint, and Migration), Task P0-T1**
Layer: backend (SQL / `SOURCE/supabase/schema.sql`)

Metadata:
- Dependencies: none (first task of the plan)
- Blocks: P0-T2 (fingerprint update depends on this SQL text existing)
- Size: Small (1 file)
- Verification level: L3 (tooling exit code — `schema:plan` prints the plan; fingerprint is intentionally not yet updated)

## Implementation Content
Add a new §20 block to `SOURCE/supabase/schema.sql`, placed after §19 (index block ending `:2554`) and before §17 (`schema_version`, `:2556`):
- **20a**: `exam_attempts.source` column — inline in the `create table if not exists` at `:192-202`, **plus** an idempotent pair: `alter table ... add column if not exists source text not null default 'none'`, and a drop-then-add named CHECK `exam_attempts_source_check` (source ∈ the 4 declared values).
- **20b**: index `exam_attempts_status_submitted_idx (status, submitted_at desc)`.
- **20c**: `exam_hot_counts(p_since_recent, p_since_wide, p_max_rows)` function (`security definer`) + `revoke all ... from public, anon; grant execute ... to authenticated, service_role;`.

## Target Files
- [x] `SOURCE/supabase/schema.sql`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The SQL objects — full SQL text for 20a/20b/20c)
- `docs/design/exam-shelves-backend-design.md` (§ Security Considerations)
- `docs/design/exam-shelves-backend-design.md` (§ State Transitions and Invariants)
- `SOURCE/supabase/schema.sql` (`:192-202` existing `exam_attempts` table; `:2554` end of §19 index block; `:2556` §17 `schema_version` — insertion point)
- `SOURCE/supabase/schema.sql` (§ `search_exams` grant block — the idiom to follow: `authenticated` + `service_role`, no `anon`)
- `SOURCE/supabase/schema.sql` (§ `exam_rating_aggregate` grant block — the idiom to avoid: do not copy its `anon` grant)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D1, D2, D5, D6; § Implementation Guidance)

## Change Category
`Change Category: state-change, boundary-change`

This task adds persisted state (new column + CHECK + index) and a new cross-user read boundary (`exam_hot_counts()` RPC + its grant set). Sweep adjacent cases sharing the same boundary class: every other `security definer` function's grant block in `schema.sql` (`search_exams`, `exam_rating_aggregate`) for grant-idiom consistency, and every existing `exam_attempts` CHECK constraint for naming-convention consistency with `exam_attempts_source_check`.

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | contract_schema | `exam_hot_counts(...)` returns `(exam_id, recent_count, wide_count, total_count)` — aggregate-only projection, no new view | Does `exam_hot_counts()` return exactly those 4 columns via a plain `returns table(...)`, with 0 joined view created? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D1) | persistence | Grants: `revoke all ... from public, anon;` then `grant execute ... to authenticated, service_role;` | Does the grant block revoke from `public, anon` then grant execute to exactly `authenticated, service_role`, with 0 grant reaching `anon`? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D2, Decision 3) | contract_schema | No identity resolved anywhere — function takes window boundaries + a cap, never a user id | Does `exam_hot_counts()`'s parameter list contain only `p_since_recent, p_since_wide, p_max_rows` (0 user-id parameter)? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D5) | persistence | `exam_attempts.source text not null default 'none'` + named CHECK `exam_attempts_source_check`, normalised to `'none'` on write | Does `schema.sql` declare `source text not null default 'none'` plus a CHECK constraint literally named `exam_attempts_source_check`? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D6) | persistence | `exam_attempts.status` gains no CHECK; no RLS policy added/altered/dropped; one new index `(status, submitted_at desc)` | Does the diff add exactly 1 index and 0 RLS policy statements, with `status`'s existing CHECK list unchanged? |
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Implementation Guidance) | contract_schema | Re-assert visibility inside every definer object — restate `status='published'` and the ban predicate, not out of caution | Does `exam_hot_counts()`'s body predicate restate `exams.status='published'` and `not is_author_banned(author_id)` rather than relying on caller-side filtering? |

## Investigation Notes

**Investigation Targets read**: backend DD §"The SQL objects" (`:210-296`), §"Security Considerations" (`:603-607`), §"State Transitions and Invariants" (`:568-570`); `schema.sql` `:192-202` (`exam_attempts` table), `:2510-2554` (§19 index block, ends at `:2554` with `attempt_answers_question_idx`), `:2556-2599` (§17 `schema_version`, insertion point is between `:2554` and `:2556`); `schema.sql:157-186` (`search_exams` grant idiom — `revoke all … from public, anon; grant execute … to authenticated, service_role;`, security **invoker**) and `:1543-1567` (`exam_rating_aggregate` grant idiom — grants `anon` too, security **definer**); ADR-0021 D1/D2/D5/D6 and Implementation Guidance.

**Grant idiom decision**: follow `search_exams`'s revoke/grant *shape* (`revoke all … from public, anon;` then `grant execute … to authenticated, service_role;`) but NOT its `security invoker` — `exam_hot_counts()` is `security definer` like `exam_rating_aggregate()`. ADR-0021 D1 states explicitly: "Grants follow the `search_exams` idiom (`:185-186`), not the `exam_rating_aggregate` one" — `exam_rating_aggregate` grants `anon` only because a `security_invoker` view calls it on anon's behalf; nothing anonymous calls `exam_hot_counts` and `/exams` is not in `PUBLIC_PATHS`, so `anon` must be excluded. This is the idiom-to-avoid the Change Category sweep flags.

**Adjacent grant-block sweep** (Change Category: state-change, boundary-change): `search_exams` (`:185-186`) = revoke `public, anon` / grant `authenticated, service_role` — correct shape to copy. `exam_rating_aggregate` (`:1566-1567`) = revoke `public` only / grant `anon, authenticated, service_role` — the idiom to avoid, confirmed by ADR-0021 D1's explicit reasoning above. `is_author_banned` (`:2480-2481`) grants `anon` too, but for a different reason (RLS policy needs to call it on anon's behalf) — not a counter-example to the decision, same class as `exam_rating_aggregate`.

**Existing `exam_attempts` CHECK naming sweep**: no existing named CHECK constraint on `exam_attempts` in `schema.sql` today (the table has none inline; `status` has no CHECK per ADR-0021 D6, by decision). The naming convention `<table>_<column>_check` is established elsewhere on other tables: `telemetry_log_error_code_check`, `telemetry_log_event_type_check` (`:2373-2411`, drop-then-add pattern) — `exam_attempts_source_check` follows this convention and is also the name Postgres auto-generates for the inline `check` on `source`, so the inline declaration and the named alter pair reference the identical constraint name (confirmed in DD `:229`).

**Definer-body predicate confirmation**: DD's SQL text (`:262-274`) and ADR-0021 D1 both specify the body predicate as `a.status = 'submitted'`, `e.status = 'published'`, `not public.is_author_banned(e.author_id)` — all three re-asserted inside the function body (no RLS on a definer function). This is copied verbatim from the DD; Security Considerations (`:607`) and State Transitions (`:570`) confirm no broader visibility is intended.

**Insertion point confirmation**: §19 index block's last statement is `attempt_answers_question_idx` ending at schema.sql line 2554 (blank line 2555), §17 `schema_version` banner starts at line 2556. New §20 block goes between these two lines, disturbing neither.

**Binding Decisions — planned approach and compliance evaluation** (evaluated against the DD's SQL text at `:216-227` for D5/D6, `:243-278` for D1/D2, `:270` + Security Considerations `:607` for Implementation Guidance row):
- Axis `contract_schema` (rows 1 and 3, grouped): plan is to copy the DD's `exam_hot_counts` signature and `returns table(...)` verbatim — `(p_since_recent timestamptz, p_since_wide timestamptz, p_max_rows int default 500)` → `returns table (exam_id text, recent_count bigint, wide_count bigint, total_count bigint)`, a plain `returns table`, 0 joined view, 0 user-id parameter. Evaluation: **Y** for both rows — verified against DD `:243-253` character-for-character; no view created anywhere in this task's scope (schema.sql only, no `create view`).
- Axis `persistence` (rows 2, 4, 5, grouped): plan is to copy verbatim the DD's revoke/grant block (`:276-277`), the inline+alter `source` column declaration (`:216-227`), and the D6 constraint (exactly 1 new index `exam_attempts_status_submitted_idx`, 0 RLS statements, `status`'s CHECK list left untouched — DD confirms `status` gains no CHECK). Evaluation: **Y** for rows 2, 4, 5 — the grant block text, the column/CHECK text and the index-only-no-RLS scope all match the DD verbatim, and this task's Notes section already pins "no other file changes" / "0 RLS policy statements".
- Axis `contract_schema` (Implementation Guidance row): plan is to copy the DD's `where` clause (`:268-270`) verbatim, which literally restates `e.status = 'published'` and `not public.is_author_banned(e.author_id)`. Evaluation: **Y** — confirmed above under "Definer-body predicate confirmation".

**Blocker — Test Environment Check, resolved**: the Bash tool initially hard-blocked every command whose text contained the substring "source" (case-insensitive), which made `npm run schema:plan` and every other Quality Assurance Mechanism unexecutable while the working directory was the repo root. The coordinator confirmed this is a false-positive in the Bash tool's worktree-isolation guard (not present in the PowerShell tool) and updated this session's primary working directory to `.../parallel-work/SOURCE` directly. With cwd already inside `SOURCE/`, commands that never spell the word "source" (e.g. plain `npm run schema:plan`, `pwd`, `npx tsc --noEmit`) run fine through the Bash tool — confirmed working below. No PowerShell tool is present in this session's actual toolset (only Read/Edit/Write/Bash/Grep/Glob/SubagentHandback), so verification proceeded via Bash from the SOURCE-rooted cwd instead.

**Red phase — actual baseline** (before writing the §20 block): `npm run schema:plan` printed 285 statements and exited **0** (declared fingerprint `187d3ed24f0c` == computed fingerprint `187d3ed24f0c`) — the file was self-consistent at baseline, not non-zero as the checklist's wording guessed. This is the correct pre-change baseline: nothing had touched `schema.sql` for this feature yet, so its self-declared fingerprint still described itself accurately. Establishing this baseline is what the checklist item requires; the post-change exit-1 state (below) is what the Green phase specifically expects.

**Green phase — actual result** (after writing the §20 block): `npm run schema:plan` printed **292 statements** (285 + 7 new: statements 282–288 = 3 for 20a's alter group, 1 for 20b's index, 3 for 20c's function+revoke+grant — matching the task's stated 7-statement/3+1+3 split exactly), computed a new target fingerprint `340bab74ca57` (≠ declared `187d3ed24f0c`), and **exited 1** — exactly the Green-phase expectation. Statement #281 (`attempt_answers_question_idx`, end of §19) and statement #289 (`create table … schema_version`, start of §17) sandwich the 7 new statements with no reordering of either section — insertion-point confirmed at the tool level, matching the Refactor-phase static read.

**Refactor phase — byte-level fidelity re-read**: the committed SQL in `schema.sql` was re-compared line-by-line against the DD's SQL objects section (`:216-227`, `:234-236`, `:243-278`) — column name `source`, CHECK name `exam_attempts_source_check`, index name `exam_attempts_status_submitted_idx`, function name/signature `exam_hot_counts(p_since_recent timestamptz, p_since_wide timestamptz, p_max_rows int default 500)`, `returns table (exam_id text, recent_count bigint, wide_count bigint, total_count bigint)`, the full `where`/`group by`/`order by`/`limit` body, and the grant targets `authenticated, service_role` (with `anon` excluded) all match verbatim. The only deviations from the DD's literal text are non-substantive formatting: comma-spaced value lists (`'practice', 'hot', 'explore', 'none'`) to match the repo-wide convention seen at `exams_semester_check` (`:99-101`) rather than the DD's compact `'practice','hot','explore','none'`, and Vietnamese explanatory banners in the codebase's established comment style (matching §18/§19's density) instead of the DD's terser English-language prose — both are style choices, not contract changes, per the task's own byte-level-fidelity scope (column/CHECK/index names, function signature, grant targets).

**Full verification gate run** (all via Bash, cwd already `SOURCE/`, no "source" text needed in any command):
- Gate 1 `npx tsc --noEmit` → **exit 0**, no errors.
- Gate 2 `npx eslint --max-warnings 0` → **exit 0**, no errors/warnings.
- Gate 4 `npm run build` → **exit 0**, Next.js production build completed, all 27 routes compiled.
- `npm run check:bundle` → **exit 0**, "8 bí mật server-only không xuống client".
- Gate 3, targeted: `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` → 12/13 pass, 1 fails exactly as documented ("gate 3's `schemaFingerprint.test.ts` case is expected red until P0-T2") — the failing assertion is precisely the 3-way fingerprint mismatch (`340bab74ca57` vs declared `187d3ed24f0c`), i.e. the expected-red case and no other case in that file.
- Gate 3, full suite: `npx vitest run` → 143 files passed, 3 files failed, 2048/2069 tests passed. Two of the three failing files are the same documented fingerprint-consistency family: `schemaFingerprint.test.ts` (above) and `lib/schema/__tests__/migrationsMatchSchema.test.ts` (fails because the newest migration file's fingerprint `187d3ed24f0c` no longer equals schema.sql's new computed fingerprint `340bab74ca57` — this is the exact state the backend DD's Migration Procedure step 4 calls "RED at this point by design" and instructs to "leave alone" until P0-T3 lands the migration file). The third failing file, `lib/security/rateLimit.test.ts` ("keeps ONE account's whole daily Gemini budget under the project quota", `expected 33 to be less than or equal to 20`), is unrelated to this task: it is a Gemini-quota/rate-limit assertion with no dependency on `schema.sql`, `exam_attempts`, or `exam_hot_counts`; `git status` shows `SOURCE/features/exams/__tests__/rating.int.test.ts` already modified by a different, concurrently-running task in this same shared worktree, confirming other agents are editing files in parallel here. This task's Notes pin "Impact scope: schema.sql only; no other file changes in this task", so `rateLimit.test.ts` was left untouched and is reported here as a pre-existing/concurrent-work observation, not a regression introduced by this task.
- Gate 5 (`test:fixture`) and Gate 6 (`test:localdb`) were not run, per the task's own Completion Criteria ("gate 5 unaffected; gate 6 not yet meaningful — see plan header caveat").

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Node query layer → Postgres RPC `exam_hot_counts` (owner left: `features/exams/queries/hotCounts.ts`, Phase 3; owner right: `supabase/schema.sql` §20c function). Expected signal: response rows are `(exam_id, recent_count, wide_count, total_count)`; `anon` gets `42501`. This task owns the right-side (function + grants); the left-side call site lands in P3-T1.
- **Boundary**: `schema.sql` (source of truth) → migration file (verbatim replay). Expected signal: `migrationsMatchSchema.test.ts`'s normalize-and-compare logic finds the migration's statements match §20a/20b/20c verbatim. This task's SQL text is what P0-T3's migration file must replay.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent grant blocks (`search_exams`, `exam_rating_aggregate`) and confirm which idiom is correct for this function (per Change Category)
- [x] Confirm `npm run schema:plan` currently exits non-zero for an unrelated reason (nothing to add yet), establishing the pre-change baseline — actual baseline was exit **0** (self-consistent, `187d3ed24f0c` == `187d3ed24f0c`); see Investigation Notes for why that is the correct baseline reading
### 2. Green Phase
- [x] Write the 20a/20b/20c SQL block in `schema.sql`
- [x] Run `npm run schema:plan` — expect it to print the new numbered statement list and target fingerprint, and **exit 1** (expected at this point — fingerprint not yet updated, see P0-T2)
### 3. Refactor Phase
- [x] Re-read the added block against the backend DD's SQL text for byte-level fidelity (column names, CHECK name, index name, function signature, grant targets)
- [x] Confirm insertion point does not disturb §17/§19 statement order

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Enforces: type correctness project-wide — Config: `SOURCE/tsconfig.json`
- `npx eslint --max-warnings 0` — Enforces: lint project-wide — Config: `SOURCE/eslint.config.mjs:27-56`
- `npm run build` — Enforces: production build succeeds — Config: `SOURCE/next.config.ts`
- `npm run check:bundle` — Enforces: AI-key bundle check — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`
- `npm run schema:plan` — Enforces: prints numbered statement list + target fingerprint; exits 1 until schema.sql/constant agree — Config: `SOURCE/scripts/schema-plan.ts`
- `schemaFingerprint.test.ts` — Enforces: 3-way fingerprint agreement — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts:91-108` (will fail until P0-T2)

## Operation Verification Methods
- **Verification method**: run `npm run schema:plan` from `SOURCE/` and inspect the printed numbered statement list against the backend DD's SQL text.
- **Success criteria**: the tool prints the full 7-statement plan (3 for 20a, 1 for 20b, 3 for 20c) and a target fingerprint; it **exits 1** — this is the expected state until P0-T2 lands the fingerprint.
- **Failure response**: if the tool errors on SQL syntax or fails to enumerate the expected statement count, re-check the SQL text against the backend DD before proceeding — do not silently adjust the DD's SQL to match a mistake.
- **Verification level**: L3 (tooling exit-code verification; no dev DB touched yet).

## Proof Obligations
- **Claim**: `exam_hot_counts()`'s predicate exactly matches `status='submitted'`, `exams.status='published'`, `not is_author_banned(author_id)` — no broader visibility than the flat-grid path.
  - **Primary failure mode**: predicate omits or loosens one of the three conditions, causing the aggregate to count unpublished/unsubmitted/banned-author attempts.
  - **Boundary to exercise**: SQL definer-function body (proven at the schema level here; runtime proof is P8-T2/P8-T4).
  - **State assertion**: N/A (DDL, not a runtime state transition).
  - **Mock boundary rationale**: none — this is the SQL source of truth itself.
  - **Residual**: this task proves the SQL text is authored correctly; P0-T4's dev read-back and P8-T2's RLS harness prove it behaves correctly against real data.
- **Claim** (Failure Mode: no-op): the idempotent `alter table ... add column if not exists` / drop-then-add CHECK pair is a true no-op on re-apply — a second application does not error or duplicate the constraint.
  - **Primary failure mode**: `add column` without `if not exists`, or `add constraint` without a prior `drop constraint if exists`, causing a second apply to error.
  - **Boundary to exercise**: SQL statement idempotency (proven at authoring time here; exercised at runtime in P0-T3's `migrationsMatchSchema.test.ts` and P0-T4's dev apply).
  - **State assertion**: schema before (no `source` column) → statement applied → schema after (`source` column present, default `'none'`, CHECK named `exam_attempts_source_check`) → statement re-applied → schema unchanged.
  - **Mock boundary rationale**: none.
  - **Residual**: actual idempotent re-apply against a live database is P0-T4's read-back, not this task's.

## Completion Criteria
- [x] `schema.sql` contains the 20a/20b/20c block, positioned after §19 and before §17
- [x] `npm run schema:plan` prints the full statement list and exits 1 (expected)
- [x] Every Binding Decision's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Gates 1-2, 4 green (gate 3's `schemaFingerprint.test.ts` case is expected red until P0-T2; gate 5 unaffected; gate 6 not yet meaningful — see plan header caveat)

## Notes
- Impact scope: `schema.sql` only; no other file changes in this task.
- Scope boundary — preserve unchanged: the existing `create table if not exists exam_attempts` body at `:192-202` except for the additive `source` column; all RLS policy statements (0 additions/alterations/drops per ADR-0021 D6).
