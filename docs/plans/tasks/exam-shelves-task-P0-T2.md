# Task P0-T2 — Fingerprint update (`schema.sql` §17 + `schemaFingerprint.ts` constant) + stale-comment correction

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T2**
Layer: backend (`SOURCE/supabase/schema.sql`, `SOURCE/lib/schema/schemaFingerprint.ts`)

Metadata:
- Dependencies: P0-T1 (the new fingerprint is computed over P0-T1's SQL text)
- Blocks: P0-T3 (migration file's own fingerprint upsert must match)
- Size: Small (2 files)
- Verification level: L3 (tooling exit code) + L2 (`schemaFingerprint.test.ts`)

## Implementation Content
Write the new fingerprint into `schema.sql:2595` (§17 upsert literal) **and** `SOURCE/lib/schema/schemaFingerprint.ts:41` (`SCHEMA_FINGERPRINT` constant) — same value, two locations. In the same commit, correct `schemaFingerprint.ts`'s header comment: it currently states flatly there is no migration tool and that full debt repayment "vẫn là Supabase CLI migrations" as future work. Since 2026-08-31 a migration **procedure** exists (schema:plan → migration file → CLI apply on dev) even though prod apply is still manual/statement-by-statement. Reword to state that reality without overclaiming — this file still is not a migration *runner* and does not auto-detect prod drift.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`

## Investigation Targets
- `SOURCE/supabase/schema.sql` (`:2595` §17 upsert literal)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`:41` `SCHEMA_FINGERPRINT` constant; header comment block making the stale "no migration tool" claim)
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (`:91-108` — the 3-way agreement assertion this task must satisfy)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure)

## Investigation Notes
- **Computed fingerprint**: `npm run schema:plan` (run from `SOURCE/`) prints `VÂN TAY ĐÍCH: 340bab74ca57` over 292 statements, against the committed `SCHEMA_FINGERPRINT = "187d3ed24f0c"`. This confirms the context-provided value by direct execution, not by trusting the prompt.
- **Computed over P0-T1's final text, not a draft**: `git status` shows a clean working tree on `worktree-parallel-work` before any edit in this task (P0-T1's §20a/20b/20c already committed — see `f564126 feat(schema): exam_attempts.source, index lượt nộp, hàm exam_hot_counts()` in recent log). `schema:plan` reads the on-disk `SOURCE/supabase/schema.sql` directly, so `340bab74ca57` is computed over exactly the committed, final §20a/20b/20c text (statements 282-292 in the printed list correspond to §20a alter/constraint, §20b index, §20c function+grants, §17 table+RLS+upsert).
- **`schema.sql` §17 upsert literal**: actual current line is `supabase/schema.sql:2683` (`values (1, '187d3ed24f0c')` inside the `@schema-fingerprint-begin`/`-end` block, lines 2681-2687) — task file's `:2595` line reference is stale because P0-T1 inserted ~90 lines of new §20 content above it; located by `grep` for `schema_version`/`@schema-fingerprint` instead of trusting the stale line number.
- **`schemaFingerprint.ts:41`**: `export const SCHEMA_FINGERPRINT = "187d3ed24f0c";` — hand-copied constant, matches task file's line reference exactly. Header comment (lines 21-24 before edit) claimed "Trả nợ trọn vẹn vẫn là Supabase CLI migrations" as future work — stale since 2026-08-31 per backend design doc `## Migration Procedure` (`docs/design/exam-shelves-backend-design.md:298-324`), which documents an actual procedure: `schema:plan` → hand-write migration file → `npx supabase db query --linked --file <path>` (CLI, whole file) on dev; prod apply is explicitly **not** part of any implementation task and stays manual, one statement at a time via MCP/Composio (step 9, same section).
- **`schemaFingerprint.test.ts:91-108`**: `describe("schema.sql")` → `it("hằng số TS, giá trị §17 khai, và giá trị tính lại — cả ba khớp nhau")` reads the live `SOURCE/supabase/schema.sql` via `readFileSync`, computes `computeSchemaFingerprint(schemaSql)`, parses the declared `parseDeclaredFingerprint(schemaSql)`, and asserts `computed === declared === SCHEMA_FINGERPRINT` — this is the 3-way gate this task must turn green.
- **Design doc `## Migration Procedure` (`:298-324`)**: confirms the exact wording used for the reworded header comment — step 2-4 is `schema:plan` (prints target, exits 1) → hand-copy into both sites → `schema:plan` exits 0 + `schemaFingerprint.test.ts` green (this task, P0-T2); step 5 (new migration file) is explicitly P0-T3's job, and `migrationsMatchSchema.test.ts` is RED by design until then; step 9 confirms prod apply is manual/statement-by-statement and not part of any implementation task.
- **Red phase evidence**: before edit, `npm run schema:plan` exited 1 (`❌ schema.sql tự khai '187d3ed24f0c' nhưng nội dung băm ra '340bab74ca57'.`); `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` failed exactly the 3-way agreement assertion (`expected '340bab74ca57' to be '187d3ed24f0c'`), all 12 other cases in the file already green (they test `computeSchemaFingerprint`/`parseDeclaredFingerprint` in isolation, unaffected by the stale constant).
- **Green phase evidence**: after writing `340bab74ca57` into both `schema.sql:2683` and `schemaFingerprint.ts:41`, `npm run schema:plan` exited 0 (`VÂN TAY ĐÍCH: 340bab74ca57`, no ❌); `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` → 13/13 passed.
- **Refactor phase evidence — `migrationsMatchSchema.test.ts` red by design, confirmed for the expected reason only**: `npx vitest run lib/schema` → 7 files, 6 passed, 1 failed (`migrationsMatchSchema.test.ts`, 1 of 4 cases). The failing case (`migration MỚI NHẤT mang đúng vân tay của schema.sql hiện tại`) message: `"SCHEMA ĐÃ ĐỔI MÀ KHÔNG CÓ MIGRATION. schema.sql đang ở vân tay 340bab74ca57, nhưng file migration mới nhất (20260913000000_attempt_answer_ceiling_8000_187d3ed24f0c.sql) mang vân tay 187d3ed24f0c."` — exactly the expected-by-design reason (no migration file for `340bab74ca57` exists yet; that is P0-T3's deliverable), not a syntax error or an unrelated failure. The other 3 cases in that file (baseline immutability, verbatim-statement containment) and all 62 other tests across the remaining 6 files in `lib/schema` passed.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Run `npm run schema:plan` and confirm it still exits 1 (P0-T1's baseline) and note the target fingerprint it prints
- [x] Run `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` and confirm it fails for the expected reason (constant does not yet match schema.sql's literal)
### 2. Green Phase
- [x] Write the printed fingerprint into `schema.sql:2595` and `schemaFingerprint.ts:41`
- [x] Reword the stale header comment in `schemaFingerprint.ts`
- [x] Run `npm run schema:plan` — expect exit **0**
- [x] Run `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` — expect green
### 3. Refactor Phase
- [x] Confirm `npx vitest run lib/schema` as a whole is **not** fully green yet — `migrationsMatchSchema.test.ts` is expected RED at this point **by design** (no migration file exists until P0-T3). Leave it alone; do not rename an existing migration to force it green.

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- `schemaFingerprint.test.ts` — Enforces: 3-way fingerprint agreement (constant ↔ schema.sql literal ↔ recomputed hash) — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts:91-108`
- `npm run schema:plan` — Config: `SOURCE/scripts/schema-plan.ts`

## Operation Verification Methods
- **Verification method**: run `npm run schema:plan` (expect exit 0) then `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` (expect green); separately confirm `migrationsMatchSchema.test.ts` is red and note why.
- **Success criteria**: `schema:plan` exits 0; `schemaFingerprint.test.ts` green; `migrationsMatchSchema.test.ts` red **for exactly the expected reason** (no migration file yet), not for a different reason (e.g. a syntax error).
- **Failure response**: if `schemaFingerprint.test.ts` stays red after the constant is updated, re-check the literal was copied from `schema:plan`'s actual output, not hand-typed.
- **Verification level**: L2 (test operation verification).

## Proof Obligations
- **Claim**: the fingerprint recorded in `schema.sql`'s §17 upsert literal, `schemaFingerprint.ts`'s `SCHEMA_FINGERPRINT` constant, and the value recomputed by `schemaFingerprint.test.ts` from the live SQL text all agree.
  - **Primary failure mode**: a hand-typed or stale fingerprint value in one of the two source locations, causing silent 3-way disagreement that only a future `verify:schema` run on a different database would surface.
  - **Boundary to exercise**: in-process unit test (`schemaFingerprint.test.ts` recomputes the hash from the SQL text and compares against the constant).
  - **State assertion**: N/A (comparison of literal values, not a state transition).
  - **Mock boundary rationale**: none — no I/O; pure recomputation and comparison.
  - **Residual**: this task proves the 3-way (constant/literal/recompute) agreement; the 4th leg — dev's actual `schema_version.fingerprint` row — is P0-T4's read-back, and prod's is FQA-T7.

## Completion Criteria
- [x] `npm run schema:plan` exits 0
- [x] `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` green
- [x] `migrationsMatchSchema.test.ts` confirmed red for the expected reason only (recorded in Investigation Notes)
- [x] Stale header comment in `schemaFingerprint.ts` corrected without overclaiming
- [x] Gates 1-2, 4 green; gate 3 partially green (schemaFingerprint case green, migrationsMatchSchema case red-by-design); gate 6 not yet meaningful

  Evidence: `npx tsc --noEmit` exit 0 (Gate 1); `npx eslint --max-warnings 0` exit 0, project-wide (Gate 2); `npx vitest run` — 144 files passed, 1 file (`migrationsMatchSchema.test.ts`) 1/4 cases red for exactly the by-design reason above (Gate 3, partial as expected); `npm run build` exit 0, all 26 routes generated (Gate 4); `npm run check:bundle` exit 0 (project QA mechanism, unaffected by this change). Gate 6 (`npm run test:localdb`) not run — requires the dev database to already carry fingerprint `340bab74ca57`, which is P0-T4's read-back, not yet landed.

  **Unrelated pre-existing failure noted, not caused by this task and out of its Target Files scope**: the same full `npx vitest run` also failed `lib/security/rateLimit.test.ts > guard > keeps ONE account's whole daily Gemini budget under the project quota` (`expected 33 to be less than or equal to 20`). `git status --porcelain` confirms only `SOURCE/supabase/schema.sql`, `SOURCE/lib/schema/schemaFingerprint.ts` and this task file are modified — `rateLimit.ts`/`rateLimit.test.ts` are untouched by this task, and there is no plausible causal link between a schema fingerprint literal and a Gemini request-quota arithmetic check. Flagged here for the quality-assurance process to triage; not fixed here (out of Target Files scope for P0-T2).

## Notes
- Impact scope: `schema.sql` §17, `schemaFingerprint.ts` (constant + header comment) only.
- Scope boundary — preserve unchanged: do **not** touch or rename any existing migration file to force `migrationsMatchSchema.test.ts` green — that would rewrite a state two live databases already ran (plan hard constraint).
