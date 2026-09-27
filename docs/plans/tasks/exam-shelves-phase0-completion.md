# Phase 0 Completion: Schema, Fingerprint, and Migration

Covers Work Plan Phase 0 (Tasks P0-T1..P0-T7 / `exam-shelves-task-P0-T1.md` through `exam-shelves-task-P0-T7.md`).

**This phase is the plan's single unavoidable horizontal exception and its Early Verification Point gate — nothing in Phase 1 onward may begin until this phase's checklist is fully checked.**

## All-Task Completion Checklist
- [ ] P0-T1 (schema.sql §20a/20b/20c) complete: SQL block landed; `npm run schema:plan` prints the plan and exits 1 (expected); every Binding Decision Compliance Check = `Y`.
- [ ] P0-T2 (fingerprint update + stale-comment fix) complete: `npm run schema:plan` exits 0; `schemaFingerprint.test.ts` green; `migrationsMatchSchema.test.ts` confirmed red for the expected reason only.
- [ ] P0-T3 (migration file) complete: `npx vitest run lib/schema` fully green; migration's fingerprint matches its filename and P0-T2's constant.
- [ ] P0-T4 (dev apply + 5-query read-back) complete: all 5 read-back queries return their declared expected values, recorded verbatim.
- [ ] P0-T5 (`verify:schema` full mode) complete: exit code 0 against dev.
- [ ] P0-T6 (Early Verification Point — GATING) complete: second-student cross-user RPC call returns `total_count >= 1` with the exact 4-column key set.
- [ ] P0-T7 (doc cleanup: theme-name comments) complete: 0 remaining `"Mực & Sơn mài"` references in either file.

## Test Skeleton / Verification Paths
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts:91-108` — expect green from P0-T2 onward
- `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts:80-175` — expect red-by-design between P0-T2 and P0-T3, green from P0-T3 onward
- `SOURCE/lib/schema/__tests__/splitStatements.test.ts` — expect green from P0-T3 onward
- `npm run schema:plan` (SOURCE/scripts/schema-plan.ts) — expect exit 1 after P0-T1, exit 0 from P0-T2 onward
- `npm run verify:schema` (SOURCE/supabase/verify-schema.ts) — expect exit 0 from P0-T5 onward

## Phase Completion Criteria (verbatim from Work Plan)
- [ ] Early verification point (P0-T6) passed
- [ ] `verify:schema` green on dev
- [ ] Fingerprint agreement across schema.sql, schemaFingerprint.ts, migration filename, and dev's `schema_version` row
- [ ] Gates 1-3 green; gate 6 not yet meaningful for this feature (no localdb test file exists until Phase 8)

## Verification Commands
```
cd SOURCE && npm run schema:plan
cd SOURCE && npx vitest run lib/schema
cd SOURCE && npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql
cd SOURCE && npm run verify:schema
```

## Known-Red Baseline Carried Forward
`SOURCE/lib/security/rateLimit.test.ts` has exactly 1 pre-existing failing case ("keeps ONE account's whole daily Gemini budget under the project quota", asserts `33 <= 20`) — unrelated to this feature, already red before Phase 0 started. Record this count at Phase 0 start and confirm it stays exactly 1 (same case) through Phase 0's completion.

## Next Phase Gate
Phase 1 may not begin until P0-T6's Early Verification Point has passed with a real, recorded cross-user RPC result. If P0-T6 fails, the work plan's explicit instruction is to **stop and re-open ADR-0021** rather than patch at a call site — do not proceed to Phase 1 task files under any circumstance while this gate is open.
