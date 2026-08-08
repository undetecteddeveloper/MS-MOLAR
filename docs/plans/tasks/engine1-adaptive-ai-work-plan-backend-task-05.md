# Task 05 (Backend): `SOURCE/supabase/seedSkillTaxonomy.ts` (Work Plan Phase 1, Task 5)

Metadata:
- Dependencies: backend-task-04 (typed DAG data + `validateDag()`)
- Provides: seeded dev DB skill taxonomy, consumed by backend-task-06 (batch tagger reads real `skill_nodes`)
- Size: Small (1 file)

## Implementation Content

Idempotent upsert of the reviewed DAG (backend-task-03/04's content) via a service-role client, mirroring `SOURCE/supabase/seed.ts`'s env-loading/client pattern. Run against dev; confirm re-running produces 0 duplicate rows.

## Target Files
- [ ] `SOURCE/supabase/seedSkillTaxonomy.ts` (new)

## Investigation Targets
- `SOURCE/supabase/seed.ts` (env-loading pattern — `.env.local` read, `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, `createClient()` with service role — mirror this exactly)
- `SOURCE/lib/adaptive/skillTaxonomy.ts` (backend-task-04 — the typed DAG data this script upserts)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `SOURCE/supabase/seedSkillTaxonomy.ts` — idempotent DAG seeding, mirrors `seed.ts`)

## Implementation Steps

### 1. Author
- [ ] Read Investigation Targets; confirm the exact upsert key (`skill_nodes.id`, `skill_prerequisites`' composite key) matches backend-task-01's §9b DDL.
- [ ] Implement the upsert script using `on conflict` semantics so re-running is a no-op on already-seeded rows.

### 2. Verify
- [ ] Run the script against dev once; confirm all nodes/edges from backend-task-04's data are present.
- [ ] Re-run the script a second time against the same dev DB; confirm 0 duplicate rows and 0 errors.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide

## Operation Verification Methods
- **Verification method**: run the script twice against dev; query `skill_nodes`/`skill_prerequisites` row counts before and after each run.
- **Success criteria**: after the first run, row counts match backend-task-04's data exactly; after the second run, row counts are unchanged (0 duplicates).
- **Failure response**: if the second run produces duplicate rows, the upsert's conflict target is wrong (e.g. missing `on conflict` clause or wrong key) — fix before proceeding to backend-task-06, which depends on a clean, idempotently-seeded taxonomy.
- **Verification level**: L1 (functional — real dev DB state observed directly).

## Proof Obligations
- **Claim**: PRD Success Criteria #3 (taxonomy DAG-valid, node count in range) as observed in the live dev DB after seeding.
- **Primary failure mode**: the seed script silently drops rows on conflict (instead of upserting) or fails partway through, leaving the dev DB's taxonomy in a state that does not match backend-task-04's validated data.
- **Boundary to exercise**: real dev Postgres write (service-role client) — cannot be mocked per testing-principles' Data Layer Testing guidance (this is exactly the kind of write-correctness claim mocks cannot prove).
- **State assertion**: before = dev DB has no (or a partial/older) `skill_nodes`/`skill_prerequisites` rows; action = run seed script; after = dev DB's rows exactly match backend-task-04's validated data, re-running produces the same state (idempotent).
- **Mock boundary rationale**: none — real DB write is the point of this verification.
- **Residual**: none.

## Completion Criteria
- [ ] `seedSkillTaxonomy.ts` implemented, upserts idempotently
- [ ] Run twice against dev; 0 duplicate rows confirmed on the second run
- [ ] Dev DB's `skill_nodes`/`skill_prerequisites` match backend-task-04's validated data exactly

## Notes
- Impact scope: `SOURCE/supabase/seedSkillTaxonomy.ts` only; writes to dev `skill_nodes`/`skill_prerequisites` tables.
- Scope boundary: do not touch `tagQuestionSkills.ts` (backend-task-06) or any `questions` row here — this script only seeds the taxonomy itself, not question tags.
