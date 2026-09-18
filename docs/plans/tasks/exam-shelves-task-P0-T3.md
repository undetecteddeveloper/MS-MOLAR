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
- [ ] `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` (new)

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
_(Record here: the exact `<fp>` value used; confirmation the `create table` statement was excluded; confirmation `$$`-quoting around the function body was preserved verbatim.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Run `npx vitest run lib/schema` and confirm `migrationsMatchSchema.test.ts` is red because the migration file does not yet exist (the expected P0-T2 state)
### 2. Green Phase
- [ ] Create the migration file with the 7 statements + fingerprint upsert, verbatim from schema.sql
- [ ] Run `npx vitest run lib/schema` — expect **fully green** (this step's gate, not P0-T2's)
### 3. Refactor Phase
- [ ] Diff the migration file's statement text against schema.sql's §20a/20b/20c byte-for-byte (post normalisation) to confirm no drift was introduced by hand-copying
- [ ] Confirm the `$$`-quoted function body is one statement per `splitStatements.test.ts`'s rule

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
- [ ] Migration file created with all 7 statements + fingerprint upsert, verbatim from schema.sql
- [ ] `npx vitest run lib/schema` fully green
- [ ] Every Boundary Context roundtrip check confirmed (fingerprint matches filename and constant; statements match schema.sql verbatim)
- [ ] Gates 1-2, 4 green; gate 3 fully green (this is the commit that closes the intermediate red state); gate 6 not yet meaningful

## Notes
- Impact scope: this new migration file only.
- Scope boundary — preserve unchanged: no existing migration file is edited or renamed; the `create table if not exists exam_attempts` statement is deliberately excluded from this migration.
