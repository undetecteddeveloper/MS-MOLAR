# Phase 1 Completion: Schema, Taxonomy & Batch Tagging

Covers Work Plan Phase 1 (Tasks 1-6 / `engine1-adaptive-ai-work-plan-backend-task-01.md` through `engine1-adaptive-ai-work-plan-backend-task-06.md`).

## All-Task Completion Checklist

- [x] backend-task-01 (T1 — Schema DDL) complete: ⚠ BLOCKING — `npm run verify:schema` green on dev (fingerprint `f525e3095339`, applied 2026-08-13); `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` green (39/39 across `lib/schema`).
- [x] backend-task-02 (T2 — RLS Phần 7) complete: `npx tsx supabase/test-rls.ts` exits 0, full suite PASS incl. `MM-a`/`MM-b`/`TL-a`/`TL-b` (landed `a948efa`).
- [x] backend-task-03 (T3 — Math DAG content draft) complete: 20 nodes / 15 prerequisite edges, all Vietnamese labels, engineer approval ticked in `docs/plans/analysis/engine1-math-skill-dag-draft.md`.
- [x] backend-task-04 (T4 — `skillTaxonomy.ts`/`constants.ts`) complete: `skillTaxonomy.test.ts` 15/15 green (commit `1599a27`). 5 of the 15 are negative fixtures proving `validateDag()` actually detects cycles/dangling edges — without them a `validateDag()` hardcoded to `valid: true` would pass every AC-001/002 assertion.
- [x] backend-task-05 (T5 — `seedSkillTaxonomy.ts`) complete: dev seeded (commit `944ff23`); run 1 → 20 nodes / 15 edges, run 2 → still 20 / 15, 0 duplicates. Script calls `validateDag()` before writing and re-counts rows from the DB afterwards, failing loudly on drift.
- [x] backend-task-06 (T6 — `tagQuestionSkills.ts`) complete (commits `4e2fe8b`, `6027356`): dry-run → engineer review → `--apply` ×3 (34 rows written → 1 → 0). Final dev state measured directly from the DB: **47 Math questions · 35 tagged · 12 NULL → 74.5% coverage**, 0 tags pointing at a non-existent node. AC-006 proven by the third `--apply` writing 0 rows with an identical tagged/left-null partition.

## Test Skeleton / Verification Paths

- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` — expect green against the post-apply dev DB / updated `schema.sql`
- `SOURCE/supabase/test-rls.ts` (Phần 7, cases `MM-a`/`MM-b`/`TL-a`/`TL-b`) — expect full suite exit 0
- `SOURCE/lib/adaptive/__tests__/skillTaxonomy.test.ts` — expect AC-001/002/003/004 all green

## Phase Completion Criteria (verbatim from Work Plan)

- [x] `npm run verify:schema` passes against the dev DB; `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` green
- [x] `test-rls.ts` full suite (incl. Phần 7 `MM-a`/`MM-b`/`TL-a`/`TL-b`) green
- [x] Reviewed DAG seeded on dev, `validateDag()`-proven, node count 20 (in the 15-25 range)
- [x] Batch tagger run ×3 against the real corpus, converging to 0 writes; 74.5% coverage (above the 70% bar); 100% of assigned tags human-reviewed before the first `--apply`

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

## Recorded Decisions (2026-08-15)

**`SKILL_TAG_CONFIDENCE_THRESHOLD` retuned 0.75 → 0.90.** This is the retune PRD U3 shipped the placeholder expecting. The full-corpus dry-run put the correct/incorrect boundary exactly at 0.90: all 36 questions at confidence ≥ 0.90 were verified correct on human review, while all 5 at exactly 0.85 were wrong or off — "tập xác định của hàm số" filed under `menh-de-tap-hop`; the **linear** function `y = 2x - 1` filed under `ham-so-bac-hai` (the taxonomy has no linear-function node, so NULL is the correct outcome); and 3 copies of "đạo hàm tại một điểm", which is grade-11 material the DAG deliberately does not cover (the corpus has no grade-11 questions to tag). 0.85 turned out to be the model's "close but not quite" band — precisely what D2 says to leave NULL.

**Coverage dip investigated, not papered over.** The first dry-run at the new threshold returned 68.1%, below PRD Success Criteria #4's 70% bar. The shortfall came entirely from 3 questions failing with `classification-error` (Gemini free-tier flakiness) — the same questions scored 1.00 on other runs — not from the threshold. No new mechanism was added: the script already skips already-tagged rows and leaves failed ones NULL, so re-running converges by construction. Three `--apply` runs took it to 74.5% and then to a fixed point.

**`no-matching-node` split out from `classification-error`.** The first dry-run reported 7 "errors", but 6 were the model correctly declining a question outside the taxonomy and only 1 was a real network failure. Those two call for opposite actions (do nothing vs. re-run), and this report is the artifact the AC-008 review is performed against, so they must not share a label.

**Retry + throttle added to the tagger.** Two consecutive identical dry-runs produced 85.1% then 70.2% coverage, the entire delta being `fetch failed` rows the SDK does not treat as retryable. A report whose error count swings between 1 and 8 across identical runs cannot be reviewed, so classification now retries 3× with backoff and pauses 400ms between questions.

**All 12 remaining NULLs verified as genuinely out-of-taxonomy**, not missed tags: rectangle area (×4), grade-11 derivative (×4), linear equation, function domain, quadratic equation, and monotonicity of a linear function.

## Next Phase Gate

Phase 2 (backend-task-07/08) depends only on backend-task-04 (typed DAG data + `validateDag()`) — it may begin once backend-task-04 is green, **without waiting for backend-task-05/06** (the work plan's own Schedule Risk countermeasure: routing's unit tests use independently-authored literal fixture DAGs, not the real seeded/tagged data). backend-task-05/06 must still complete before Final-Phase Task 22 (backend-task-14)'s full regression, and before Phase 5's real-content manual verification (which needs real tagged questions).
