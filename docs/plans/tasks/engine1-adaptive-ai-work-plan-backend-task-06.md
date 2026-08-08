# Task 06 (Backend): `SOURCE/supabase/tagQuestionSkills.ts` (Work Plan Phase 1, Task 6)

Metadata:
- Dependencies: backend-task-05 (seeded dev taxonomy)
- Provides: tagged `questions.skill_node_id` values on dev, consumed by all of Phase 2/3's real-data-facing work (though unit tests use independent fixtures, not this real data)
- Size: Small (1 file)

## Implementation Content

Batch skill-tagging script, **dry-run by default**, `--apply` flag. Corpus query `subject in ('Math', 'Toán')` (R2 — must include the 10 non-canonical `'Toán'` rows). Confidence gate at `SKILL_TAG_CONFIDENCE_THRESHOLD` (backend-task-04) — below-threshold classifications are recorded as `"left-null"` in the JSON report, never written.

Run sequence:
1. Dry-run, produce the report.
2. Engineer reviews 100% of proposed `"tagged"` decisions (AC-008).
3. `--apply`.
4. Re-run `--apply` a second time against the unchanged corpus to prove re-runnability (AC-006, PRD Success Criteria #5 — "a script that claims idempotence and has never been re-run is a claim, not a property").
5. Verify tag coverage ≥ 70% of the ~47-question corpus (PRD Success Criteria #4) — below 70% is a **stop-and-review signal**, not an automatic failure.

## Target Files
- [ ] `SOURCE/supabase/tagQuestionSkills.ts` (new)

## Investigation Targets
- `SOURCE/lib/ugc/gemini.ts` (`getGeminiClient()`, `QUESTION_MODEL`, `sdkErrorDetail()`, `makeDeadlineSignal()` — the shared Gemini-calling utilities this script likely reuses for classification)
- `SOURCE/lib/adaptive/skillTaxonomy.ts` (backend-task-04 — the seeded skill nodes to classify questions against)
- `SOURCE/lib/adaptive/constants.ts` (`SKILL_TAG_CONFIDENCE_THRESHOLD`)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `SOURCE/supabase/tagQuestionSkills.ts` — batch tagger, dry-run default, `--apply`, `subject in ('Math','Toán')` corpus; AC-005-008)
- `SOURCE/supabase/seed.ts` (env-loading/service-role client pattern, same as backend-task-05)

## Change Category

`Change Category: state-change`

This task writes `questions.skill_node_id` (new persisted classification state) via `--apply`. Adjacent sweep: confirm the dry-run report path and the `--apply` write path share the exact same classification logic (no drift between "what the report says will happen" and "what actually gets written") — a common defect class for dry-run/apply scripts.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets; confirm the exact confidence-gate semantics (below `SKILL_TAG_CONFIDENCE_THRESHOLD` → `"left-null"` in the report, never written).
- [ ] If a unit-testable pure classification/report-building function is extracted (recommended, mirrors this repo's own pattern of extracting pure logic from I/O-heavy scripts), write a failing test for its below-threshold / at-or-above-threshold / already-tagged branches first.

### 2. Green Phase
- [ ] Implement the corpus query (`subject in ('Math', 'Toán')`), the classification call, the confidence gate, the dry-run report (JSON, `"tagged"` / `"left-null"` states), and the `--apply` write path.
- [ ] Run dry-run against dev; produce the report.

### 3. Refactor / Real-corpus verification (this task's actual completion gate — not vitest)
- [ ] Engineer reviews 100% of proposed `"tagged"` decisions in the dry-run report (AC-008).
- [ ] Run `--apply`.
- [ ] Re-run `--apply` a second time against the unchanged corpus — confirm 0 duplicate/changed rows (AC-006).
- [ ] Verify tag coverage ≥ 70% of the ~47-question corpus (PRD Success Criteria #4); if below, record an explicit stop-and-review decision rather than treating it as silent failure.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `check-ai-key-bundle.mjs` — Enforces: no server-only secret reaches the client bundle — Covered: `tagQuestionSkills.ts` explicitly named (touches `GEMINI_API_KEY`)

## Operation Verification Methods
- **Verification method**: run dry-run → human review → `--apply` → `--apply` again → query real `questions.skill_node_id` coverage against dev.
- **Success criteria**: (1) 0 below-threshold writes (every `"left-null"` report entry stays NULL in the DB); (2) the second `--apply` run produces 0 duplicate/changed rows; (3) every considered row in exactly one of `"tagged"`/`"left-null"`; (4) 100% of `"tagged"` decisions were human-reviewed before the first `--apply`; (5) tag coverage ≥ 70% of the corpus, or an explicit recorded stop-and-review decision if below.
- **Failure response**: if re-running `--apply` produces different results (not idempotent), fix the conflict-handling logic before proceeding — backend-task-07/08's dependents assume a stable, re-runnable tagging state on dev.
- **Verification level**: L1 (functional — real dev DB `questions.skill_node_id` state observed directly after each run).

## Proof Obligations
- **Claim**: AC-005 — 0 below-threshold writes.
- **Primary failure mode**: the confidence gate is inverted or off-by-one, writing a `skill_node_id` for a classification actually below `SKILL_TAG_CONFIDENCE_THRESHOLD`.
- **Boundary to exercise**: real dev Postgres write (service-role) + the classification call.
- **State assertion**: before = `questions.skill_node_id` NULL for all rows; after = only at-or-above-threshold rows have a non-NULL value; every below-threshold row remains NULL.
- **Mock boundary rationale**: the classification call itself may reasonably use a real Gemini call per this script's own design (not unit-mocked) since this is a one-shot operational script, not code under CI's vitest gate — but the confidence-gate logic's correctness is proven against the real written DB state, not merely the report.
- **Residual**: none.
- **Claim**: AC-006 (Failure Mode Checklist `same-value`) — re-running the batch tagger against an unchanged corpus produces the same tagged/left-null partition.
- **Primary failure mode**: the second `--apply` run reclassifies already-tagged questions (e.g. missing an "already tagged, skip" guard), potentially flipping a previously-tagged question to a different skill node or to `left-null` on a nondeterministic re-classification.
- **Boundary to exercise**: real dev Postgres write, run twice.
- **State assertion**: before = state after first `--apply`; action = second `--apply` against the same unchanged corpus; after = identical state (0 changed rows).
- **Mock boundary rationale**: none — this is the actual re-run proof, must be against the real DB.
- **Residual**: none.
- **Claim**: AC-007 — every considered row is in exactly one of two states (`"tagged"` or `"left-null"`).
- **Primary failure mode**: a row is silently omitted from the report entirely (neither state), making it invisible to the 100%-human-review step (AC-008).
- **Boundary to exercise**: the dry-run report generation, inspected against the full real corpus row count.
- **State assertion**: N/A (report generation, not a DB write).
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: AC-008 — 100% of assigned (`"tagged"`) decisions are human-reviewed before `--apply`.
- **Primary failure mode**: `--apply` is run before the engineer's review step completes.
- **Boundary to exercise**: N/A — process proof, not a code proof.
- **State assertion**: N/A.
- **Mock boundary rationale**: N/A.
- **Residual**: this is a process/ordering claim, not something a test can enforce — the Completion Criteria below requires the review to be explicitly recorded before `--apply` is checked off.

## Completion Criteria
- [ ] `tagQuestionSkills.ts` implemented with dry-run default + `--apply` flag
- [ ] Dry-run report produced; 100% of `"tagged"` decisions human-reviewed (recorded)
- [ ] `--apply` run once; re-run a second time with 0 duplicate/changed rows
- [ ] Tag coverage ≥ 70% confirmed, or an explicit stop-and-review decision recorded
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/supabase/tagQuestionSkills.ts` only; writes to dev `questions.skill_node_id`.
- Scope boundary: do not modify `questions`' other columns; do not touch `skill_nodes`/`skill_prerequisites` (backend-task-05's responsibility, read-only here).
