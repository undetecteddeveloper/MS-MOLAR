# Phase 1 Completion: Schema, Taxonomy & Batch Tagging

Covers Work Plan Phase 1 (Tasks 1-6 / `engine1-adaptive-ai-work-plan-backend-task-01.md` through `engine1-adaptive-ai-work-plan-backend-task-06.md`).

## All-Task Completion Checklist

- [ ] backend-task-01 (T1 — Schema DDL) complete: ⚠ BLOCKING — `npm run verify:schema` 7/7 green on dev; `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` green.
- [ ] backend-task-02 (T2 — RLS Phần 7) complete: `cd SOURCE && npx tsx supabase/test-rls.ts` exits 0, including `MM-a`/`MM-b`/`TL-a`/`TL-b`.
- [ ] backend-task-03 (T3 — Math DAG content draft) complete: 15-25 nodes, Vietnamese labels, engineer approval recorded.
- [ ] backend-task-04 (T4 — `skillTaxonomy.ts`/`constants.ts`) complete: `skillTaxonomy.test.ts` (AC-001-004) green.
- [ ] backend-task-05 (T5 — `seedSkillTaxonomy.ts`) complete: dev seeded, re-run produces 0 duplicates.
- [ ] backend-task-06 (T6 — `tagQuestionSkills.ts`) complete: run twice against real corpus, 0 errors/duplicates; ≥70% coverage or recorded stop-and-review decision; 100% human-reviewed.

## Test Skeleton / Verification Paths

- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` — expect green against the post-apply dev DB / updated `schema.sql`
- `SOURCE/supabase/test-rls.ts` (Phần 7, cases `MM-a`/`MM-b`/`TL-a`/`TL-b`) — expect full suite exit 0
- `SOURCE/lib/adaptive/__tests__/skillTaxonomy.test.ts` — expect AC-001/002/003/004 all green

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] `npm run verify:schema` passes all 7 checks against the dev DB; `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` green
- [ ] `test-rls.ts` full suite (incl. new Phần 7 `MM-a`/`MM-b`/`TL-a`/`TL-b`) green
- [ ] Reviewed DAG seeded on dev, `validateDag()`-proven, node count in the 15-25 range
- [ ] Batch tagger run twice against the real corpus with 0 errors/duplicates; ≥70% coverage or an explicit, recorded stop-and-review decision; 100% of assigned tags human-reviewed

## Verification Commands

```
cd SOURCE && npm run verify:schema
cd SOURCE && npx vitest run lib/schema
cd SOURCE && npx tsx supabase/test-rls.ts
cd SOURCE && npx vitest run lib/adaptive/__tests__/skillTaxonomy.test.ts
cd SOURCE && npx tsx supabase/seedSkillTaxonomy.ts
cd SOURCE && npx tsx supabase/tagQuestionSkills.ts        # dry-run
cd SOURCE && npx tsx supabase/tagQuestionSkills.ts --apply
cd SOURCE && npx tsx supabase/tagQuestionSkills.ts --apply # re-run, prove idempotence
```

## Next Phase Gate

Phase 2 (backend-task-07/08) depends only on backend-task-04 (typed DAG data + `validateDag()`) — it may begin once backend-task-04 is green, **without waiting for backend-task-05/06** (the work plan's own Schedule Risk countermeasure: routing's unit tests use independently-authored literal fixture DAGs, not the real seeded/tagged data). backend-task-05/06 must still complete before Final-Phase Task 22 (backend-task-14)'s full regression, and before Phase 5's real-content manual verification (which needs real tagged questions).
