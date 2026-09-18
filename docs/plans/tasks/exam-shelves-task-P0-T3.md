# Task P0-T3 — Migration file: verbatim replay of §20a/20b/20c

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T3**
Layer: backend (`SOURCE/supabase/migrations/`)

Metadata:
- Dependencies: P0-T2 (needs the final fingerprint `<fp>`)
- Blocks: P0-T4 (dev apply consumes this file)
- Size: Small (1 new file)
- Verification level: L2 (`migrationsMatchSchema.test.ts`, `splitStatements.test.ts`)

## Implementation Content
Create `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` containing, **verbatim** as they appear in `schema.sql` (post comment/whitespace normalisation): the 3 alter statements of 20a, the 1 index statement of 20b, the 3 statements of 20c, then its own fingerprint upsert carrying `<fp>` (P0-T2's fingerprint). Do **not** copy the `create table if not exists` statement — only the additive/idempotent pieces.

## Target Files
- [x] `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 5)
- `SOURCE/supabase/schema.sql` (the §20a/20b/20c block landed by P0-T1/P0-T2, and its final fingerprint)
- `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` (`:80-175` and `:148-162` — the normalize-and-compare / own-fingerprint-in-filename assertions this file must satisfy)
- `SOURCE/lib/schema/__tests__/splitStatements.test.ts` (the `$$`-quoted function body must be treated as one statement by apply tooling)
- an existing migration file under `SOURCE/supabase/migrations/` (as a structural example of the verbatim-replay + fingerprint-upsert convention)

## Change Category
`Change Category: state-change`

This task authors the persisted migration record for the schema change introduced in P0-T1/P0-T2. Sweep the adjacent case: every other migration file in `SOURCE/supabase/migrations/` for the same filename-fingerprint-matches-content convention, so this file follows the established pattern exactly (do not invent a new filename or fingerprint-placement convention).

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `schema.sql` (source of truth) → migration file (verbatim replay). Owner left: `SOURCE/supabase/schema.sql` §20a/20b/20c. Owner right: this new migration file. Serialized format: SQL DDL statements as authored in schema.sql, post comment/whitespace normalisation. Consumer parse rule: `migrationsMatchSchema.test.ts`'s normalize-and-compare logic. Expected signal: test green; statements match verbatim.
- **Boundary**: Fingerprint 4-way agreement. Owner left: `schema.sql:2595` §17 upsert literal. Owner right: `schemaFingerprint.ts` constant + this migration's filename + (after P0-T4) dev's `schema_version.fingerprint` row. Roundtrip check: this migration file's own fingerprint upsert must carry the same `<fp>` as its filename, and both must match P0-T2's constant.

## Investigation Notes

- **Fingerprint `<fp>` used**: `340bab74ca57` — matches `SCHEMA_FINGERPRINT` at `SOURCE/lib/schema/schemaFingerprint.ts:44`, the §17 upsert literal at `SOURCE/supabase/schema.sql:2683`, and this migration's own filename + its own `insert into public.schema_version` upsert. `npm run schema:plan` prints "VÂN TAY ĐÍCH: 340bab74ca57" and exits 0 (all four agree).
- **Design Doc § Migration Procedure step 5** (`docs/design/exam-shelves-backend-design.md:306`) read: confirms exactly 3+1+3 statements (20a alters, 20b index, 20c function+revoke+grant) plus the migration's own fingerprint upsert, and confirms `create table if not exists public.exam_attempts (...)` must **not** be copied.
- **`create table` exclusion confirmed**: the new migration file contains only the 3 alter statements of §20a (`schema.sql:2582-2585`), the 1 index statement of §20b (`:2591-2592`), the 3 statements of §20c — function (`:2602-2634`), revoke (`:2641`), grant (`:2642`) — then the fingerprint upsert. No `create table` statement present.
- **`$$`-quoting preserved verbatim**: the `create or replace function public.exam_hot_counts(...) ... as $$ ... $$;` body (including the internal `-- date_trunc ...` comment) was copied character-for-character from `schema.sql:2602-2634`. `splitStatements.ts` treats a `$$...$$` span as one unit regardless of the `;` characters inside it, and `migrationsMatchSchema.test.ts`'s "mọi câu lệnh trong migration SAU baseline đều có mặt trong schema.sql" case (which itself calls `splitSqlStatements` on the migration file's content) passed fully green — if the body had been split into fragments here, those fragments would not normalize-match any single statement in schema.sql's haystack, so the pass is affirmative evidence the `$$` body was treated as one statement in this file too.
- **Byte-for-byte diff performed** (Refactor phase): extracted the exact statement line ranges from both `schema.sql` (`:2582-2585, :2591-2592, :2602-2634, :2641-2642, :2682-2686`) and the new migration file and diffed them — the only differences are blank lines inserted between statements in the migration file for readability; `normalize()` (comment-strip + whitespace-collapse) used by `migrationsMatchSchema.test.ts` makes those insignificant. No textual drift found.
- **Structural example followed**: `SOURCE/supabase/migrations/20260913000000_attempt_answer_ceiling_8000_187d3ed24f0c.sql` and `20260903000000_hot_path_indexes_4ecb67741520.sql` — both have an own (not schema.sql-copied) Vietnamese header comment explaining the "why" + a read-back recipe, then verbatim statements, then the fingerprint upsert `insert into public.schema_version (id, fingerprint) values (1, '<fp>') on conflict (id) do update set fingerprint = excluded.fingerprint, applied_at = now();`. The new file follows the same convention — no new filename or fingerprint-placement convention invented.
- **Idempotent drop-then-add pair confirmed**: `alter table public.exam_attempts drop constraint if exists exam_attempts_source_check;` precedes `alter table public.exam_attempts add constraint exam_attempts_source_check check (...)`, replayed verbatim from `schema.sql:2583-2585`, so re-running this migration against a database that already has the constraint is a no-op drop followed by a fresh add — no error.
- **RED confirmed before Green**: ran `npx vitest run lib/schema` before creating the file — `migrationsMatchSchema.test.ts` failed on "migration MỚI NHẤT mang đúng vân tay của schema.sql hiện tại" (latest migration fingerprint `187d3ed24f0c` ≠ schema.sql's `340bab74ca57`), all other 74 tests passed. This is the expected P0-T2 handoff state.
- **GREEN confirmed after**: `npx vitest run lib/schema` → 7 files, 75/75 tests passed. `npm run schema:plan` → exits 0.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Run `npx vitest run lib/schema` and confirm `migrationsMatchSchema.test.ts` is red because the migration file does not yet exist (the expected P0-T2 state)
### 2. Green Phase
- [x] Create the migration file with the 7 statements + fingerprint upsert, verbatim from schema.sql
- [x] Run `npx vitest run lib/schema` — expect **fully green** (this step's gate, not P0-T2's)
### 3. Refactor Phase
- [x] Diff the migration file's statement text against schema.sql's §20a/20b/20c byte-for-byte (post normalisation) to confirm no drift was introduced by hand-copying
- [x] Confirm the `$$`-quoted function body is one statement per `splitStatements.test.ts`'s rule

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- `migrationsMatchSchema.test.ts` — Enforces: migration file verbatim-replay + newest-migration-fingerprint matches schema.sql — Config: `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts:80-175`
- `splitStatements.test.ts` — Enforces: `$$`-quoted function body treated as one statement by apply tooling — Config: `SOURCE/lib/schema/__tests__/splitStatements.test.ts`
- `npm run schema:plan` — Config: `SOURCE/scripts/schema-plan.ts`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/schema` and inspect both `migrationsMatchSchema.test.ts` and `splitStatements.test.ts` results.
- **Success criteria**: `npx vitest run lib/schema` fully green — this is the step's own gate (distinct from P0-T2's, where `migrationsMatchSchema.test.ts` was expected red).
- **Failure response**: if `migrationsMatchSchema.test.ts` stays red, diff the migration's normalized statement text against schema.sql's §20a/20b/20c character-by-character rather than adjusting the test's normalization rule.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: this migration's own fingerprint upsert carries its own filename's fingerprint, and its statements replay schema.sql's §20a/20b/20c verbatim (post normalisation).
  - **Primary failure mode**: filename fingerprint and upsert-literal fingerprint drift apart (e.g. copy-paste from an earlier draft), or a statement is transcribed with a subtle difference (whitespace inside a string literal, a dropped `if not exists`).
  - **Boundary to exercise**: in-process unit test (`migrationsMatchSchema.test.ts:148-162` for the filename/upsert match; `:80-175` for the verbatim-replay compare).
  - **State assertion**: N/A (static file comparison, not a runtime state transition).
  - **Mock boundary rationale**: none — file-content comparison only, no I/O.
  - **Residual**: proves the migration file is internally consistent and matches schema.sql; that applying it to a real database produces the intended schema is P0-T4's read-back.
- **Claim** (Failure Mode: same-value / idempotent drop-then-add): the CHECK constraint's drop-then-add pair, replayed in this migration file, is the same idempotent pair authored in P0-T1 — re-running this migration against a database that already has it does not error.
  - **Primary failure mode**: the migration drops the constraint unconditionally without re-adding it, or adds it without a prior conditional drop, breaking idempotent replay.
  - **Boundary to exercise**: in-process unit test comparing statement text against schema.sql's idempotent form.
  - **State assertion**: N/A here (proven statically; runtime idempotency proof is P0-T4's dev-apply read-back).
  - **Mock boundary rationale**: none.
  - **Residual**: actual re-apply against dev is out of this task's scope.
- **Claim** (Failure Mode: unavailable boundary — intermediate red-by-design state): between P0-T2's completion and this task's completion, `migrationsMatchSchema.test.ts` is red by design and must never be shipped in that state.
  - **Primary failure mode**: a commit lands between P0-T2 and P0-T3 that ships the red state as if it were final.
  - **Boundary to exercise**: CI gate (`npx vitest run lib/schema`).
  - **State assertion**: before this task, red-by-design; after this task, green.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this task is exactly what closes the gap.

## Completion Criteria
- [x] Migration file created with all 7 statements + fingerprint upsert, verbatim from schema.sql
- [x] `npx vitest run lib/schema` fully green
- [x] Every Boundary Context roundtrip check confirmed (fingerprint matches filename and constant; statements match schema.sql verbatim)
- [x] Gates 1-2, 4 green; gate 3 fully green (this is the commit that closes the intermediate red state); gate 6 not yet meaningful

## Notes
- Impact scope: this new migration file only.
- Scope boundary — preserve unchanged: no existing migration file is edited or renamed; the `create table if not exists exam_attempts` statement is deliberately excluded from this migration.
