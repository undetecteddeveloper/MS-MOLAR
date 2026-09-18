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
- [ ] `SOURCE/supabase/schema.sql`
- [ ] `SOURCE/lib/schema/schemaFingerprint.ts`

## Investigation Targets
- `SOURCE/supabase/schema.sql` (`:2595` §17 upsert literal)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`:41` `SCHEMA_FINGERPRINT` constant; header comment block making the stale "no migration tool" claim)
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (`:91-108` — the 3-way agreement assertion this task must satisfy)
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure)

## Investigation Notes
_(Record here: the computed fingerprint value; confirmation it was computed over P0-T1's final SQL text, not an earlier draft.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Run `npm run schema:plan` and confirm it still exits 1 (P0-T1's baseline) and note the target fingerprint it prints
- [ ] Run `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` and confirm it fails for the expected reason (constant does not yet match schema.sql's literal)
### 2. Green Phase
- [ ] Write the printed fingerprint into `schema.sql:2595` and `schemaFingerprint.ts:41`
- [ ] Reword the stale header comment in `schemaFingerprint.ts`
- [ ] Run `npm run schema:plan` — expect exit **0**
- [ ] Run `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` — expect green
### 3. Refactor Phase
- [ ] Confirm `npx vitest run lib/schema` as a whole is **not** fully green yet — `migrationsMatchSchema.test.ts` is expected RED at this point **by design** (no migration file exists until P0-T3). Leave it alone; do not rename an existing migration to force it green.

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
- [ ] `npm run schema:plan` exits 0
- [ ] `npx vitest run lib/schema/__tests__/schemaFingerprint.test.ts` green
- [ ] `migrationsMatchSchema.test.ts` confirmed red for the expected reason only (recorded in Investigation Notes)
- [ ] Stale header comment in `schemaFingerprint.ts` corrected without overclaiming
- [ ] Gates 1-2, 4 green; gate 3 partially green (schemaFingerprint case green, migrationsMatchSchema case red-by-design); gate 6 not yet meaningful

## Notes
- Impact scope: `schema.sql` §17, `schemaFingerprint.ts` (constant + header comment) only.
- Scope boundary — preserve unchanged: do **not** touch or rename any existing migration file to force `migrationsMatchSchema.test.ts` green — that would rewrite a state two live databases already ran (plan hard constraint).
