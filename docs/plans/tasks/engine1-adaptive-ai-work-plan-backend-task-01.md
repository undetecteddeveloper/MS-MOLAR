# Task 01 (Backend): Schema DDL — §9b/§18/§19 + edited §10c + §17 fingerprint + ⚠ BLOCKING manual dev apply (Work Plan Phase 1, Task 1)

Metadata:
- Dependencies: none
- Provides: the DB shape (`skill_nodes`, `skill_prerequisites`, `questions.skill_node_id`, `record_skill_mastery()`, `telemetry_log`) every downstream task in Phase 2+ reads or writes
- Size: Medium (2 files: `schema.sql`, `schemaFingerprint.ts`)

## ⚠ MANUAL CHECKPOINT — READ BEFORE STARTING

**This task ends at a human-in-the-loop step an executor agent cannot complete.** The agent may author and stage the DDL text and the fingerprint update (the Green-phase deliverable below), but the actual **apply to the dev Supabase project via the SQL Editor**, and the subsequent `npm run verify:schema` + `npx vitest run lib/schema` run against that live dev DB, must be performed by the human engineer. **Do not attempt to work around this** (e.g. by writing a script that connects to Supabase with found/guessed credentials, or by marking this task "done" without the human having run the apply). If you are an executor agent and reach this checkpoint, stop, report the DDL is staged and ready, and hand off explicitly — do not proceed to any Phase 2+ task file until the human confirms this checkpoint passed.

**No task in Phase 2 or later may begin until this checkpoint's `verify:schema` (7/7 checks) and `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` are green against dev.**

## Implementation Content

Author 4 new/edited DDL sections in `SOURCE/supabase/schema.sql`:
1. **§9b**: `skill_nodes`, `skill_prerequisites` tables + RLS + `questions.skill_node_id` FK.
2. **§10c (edited in place — not appended)**: add `skill_node_id` as the 10th granted column to the existing `grant select (...) on public.questions` statement.
3. **§18**: `record_skill_mastery()` SQL function per ADR-0011 — `SECURITY INVOKER`, `service_role`-only, `user_id` derived from the attempt row (never a caller parameter), `revoke all on function ... from public, anon, authenticated`.
4. **§19**: `telemetry_log` table + RLS — insert-own only, **no select policy for any client role**.

Then recompute the schema fingerprint via `computeSchemaFingerprint()` and update **both** `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` and the literal fingerprint value inside `schema.sql`'s §17 block, **in the same commit**.

## Target Files
- [ ] `SOURCE/supabase/schema.sql` (major edit — §9b new, §10c edited in place, §18 new, §19 new, §17 fingerprint literal updated)
- [ ] `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` constant updated to match)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (§10c's exact current `grant select (...) on public.questions` statement — this is the ONE statement to edit in place; §11 `SCORE WRITE LOCKDOWN` as the sibling INVOKER/revoke-by-name pattern §18 must mirror per ADR-0011; §17 fingerprint block; every other `grant select (...)` and `revoke all on function ...` statement in the file, for the adjacent-defect sweep below)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`computeSchemaFingerprint()`, `SCHEMA_FINGERPRINT`)
- `SOURCE/supabase/verify-schema.ts` (all 7 checks — especially check #1's `parseGrantedColumns()` single-match parser, check #6 FK `on delete` values, check #7 fingerprint three-way agreement)
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`
- `docs/design/engine1-adaptive-ai-backend-design.md` (§9b, §10c, §18, §19, §17 procedure, Early Verification Point, State Transitions and Invariants, Minimal Surface Alternatives Element 3)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision, § Implementation Guidance)

## Change Category

`Change Category: state-change, boundary-change`

This task both introduces new persisted state (`skill_nodes`/`skill_prerequisites`/`user_skill_mastery`/`telemetry_log`) and edits an existing published DB-level contract (`public.questions`' safe-column grant, §10c). Sweep required: check every other `grant select (...)` statement in `schema.sql` for the same append-vs-edit-in-place risk class (confirm none of them are accidentally duplicated either), and every other `revoke all on function ... from public, anon, authenticated` statement for the same by-name/by-signature precision §18 must also use (Supabase's default-privileges pitfall, already named in this file's own incident note near `schema.sql:732-739`).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | dependency_direction | `record_skill_mastery()` is separate from `record_exam_result()`, `INVOKER`, `service_role`-only, called as a second, independent, best-effort step from `submitExam()` after the score write already succeeded — never atomic with the score write | Is `record_skill_mastery()` declared `SECURITY INVOKER` with no transactional coupling to `record_exam_result()` in the SQL itself (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | placement | New function `record_skill_mastery()` lives in `schema.sql` §18, sibling to §11's `SCORE WRITE LOCKDOWN` | Is `record_skill_mastery()` defined in a §18 block placed immediately after §11 in `schema.sql` (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | persistence | `user_skill_mastery` stores counters only (`correct_count`, `total_count`, `last_wrong_at`) per `(user_id, skill_node_id)` — no normalized error-event log | Does `user_skill_mastery`'s DDL contain exactly these 3 non-key columns plus the `(user_id, skill_node_id)` key, no per-event log table (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Decision) | contract_schema | `user_id` is derived from the `exam_attempts` row (never a caller parameter); requires `status = 'submitted'` | Does `record_skill_mastery()`'s SQL body derive `user_id` via a join/lookup on `exam_attempts` (not via a `p_user_id` parameter) and check `status = 'submitted'` (Y/N)? |
| docs/adr/ADR-0011-mastery-write-trust-boundary.md (§ Implementation Guidance) | dependency_direction | `revoke all on function ... from public, anon, authenticated` by name on every new privileged function, every time (Supabase default-privileges pitfall) | Does the DDL contain an explicit `revoke all on function public.record_skill_mastery(uuid, jsonb) from public, anon, authenticated` statement matching the function's exact signature (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `submitExam()`/`recordSkillMastery()` (Next.js server, TS) → `record_skill_mastery()` (Postgres SQL function, via Supabase RPC). This task owns the **right-side / consumer** owner (`SOURCE/supabase/schema.sql` §18) — the left-side producer (`SOURCE/lib/supabase/service-role.ts`) is backend-task-10.

- **Serialized Format**: JSON array `p_per_question`, each element `{questionId, selected?, correct?, isCorrect, scored?}` — the exact `ScoreResult.perQuestion` object, unmodified.
- **Consumer Parse Rule**: SQL `jsonb_array_elements(p_per_question) as pq`, fields via `pq->>'questionId'` / `(pq->>'isCorrect')::boolean` / `coalesce((pq->>'scored')::boolean, true)`.
- **Roundtrip check this task must satisfy**: the SQL parse rule above must correctly extract every field the TS producer (backend-task-10) will emit unmodified from `ScoreResult.perQuestion` — in particular, the `coalesce(..., true)` default must treat an **absent/undefined `scored` field as scored=true**, matching `computeScore.ts`'s own `isScored()` convention (`undefined = scored`) that backend-task-09/10 mirror on the TS side. A mismatch here (e.g. defaulting to `false`) would silently break AC-009/010's arithmetic even though both sides individually "parse fine."
- **Expected Signal**: resulting `user_skill_mastery` rows arithmetically match the attempt's per-question correctness for tagged/scored questions; untagged/unscored questions contribute nothing (AC-009/010, proven end-to-end by backend-task-10's `recordSkillMastery.int.test.ts`, not by this task directly — this task only defines the consumer side correctly).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations — in particular, locate the exact current `grant select (...) on public.questions` statement's column list and line range.
- [ ] Sweep the adjacent cases per Change Category above; record findings in Investigation Notes.
- [ ] Confirm `schemaFingerprint.test.ts`'s current expected value (it will fail once the DDL below changes but the constant hasn't been updated yet — this is the intended failing state before the Green phase's fingerprint update).

### 2. Green Phase
- [ ] Author §9b, edit §10c in place, author §18, author §19 exactly per Implementation Content above.
- [ ] Run `computeSchemaFingerprint()` against the finalized `schema.sql` text; update `SCHEMA_FINGERPRINT` in `schemaFingerprint.ts` and the literal in `schema.sql`'s §17 block to match, in the same commit.
- [ ] Stage the change; do **not** apply to dev yet — hand off to the ⚠ MANUAL CHECKPOINT below first.

### 3. Refactor Phase
- [ ] Re-read the full staged diff once more for the §10c in-place-edit risk and the §18 revoke-by-name risk (Binding Decisions rows 1/5) before handing off.

### ⚠ MANUAL CHECKPOINT (human-in-the-loop, not agent-completable)
- [ ] Engineer pastes the finalized DDL into the Supabase SQL Editor against the **dev** project.
- [ ] Engineer runs `npm run verify:schema` — all 7 checks must pass.
- [ ] Engineer runs `npx vitest run lib/schema` (`parseForeignKeys.test.ts` + `schemaFingerprint.test.ts`) — both green.
- [ ] Do not begin any Phase 2+ task file until this passes.

## Quality Assurance Mechanisms
- ESLint (`--max-warnings 0`, CI-blocking) — Enforces: style/lint — Config: `SOURCE/eslint.config.mjs`
- `tsc --noEmit` (strict) — Enforces: static typing — Config: `SOURCE/tsconfig.json`
- `next build` — Enforces: production build succeeds — Config: `SOURCE/package.json`
- `npm run verify:schema` — Enforces: DB-vs-`schema.sql` behavioral parity (column classification, FK `on delete`, §17 fingerprint) — Config: `SOURCE/supabase/verify-schema.ts` — mandatory after every manual apply (TD-005)
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` — Enforces: every new `references` clause declares `on delete` — reads real `schema.sql` — CI-blocking (TD-011)
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` — Enforces: §17 fingerprint three-way agreement — CI-blocking (TD-005)

## Operation Verification Methods
(Copied verbatim from Verification Strategy's First Verification Target — this task IS the Early Verification Point.)
- **Verification method**: `npm run verify:schema` passing all 7 checks immediately after the first manual apply of the new DDL (§9b/§18/§19 + edited §10c) to the **dev** database — the smallest unit that proves the highest-risk, most foundational piece (schema shape + the mastery-write trust boundary's DB-side prerequisites) before any TS-layer code is written against it.
- **Success criteria**: all 7 `verify:schema` checks green, specifically check #1 (no orphan `questions` column — confirms the §10c in-place edit worked, not a second appended grant statement), check #6 (every new FK's `on delete` matches the declared values), and check #7 (fingerprint agreement).
- **Failure response**: if check #1 fails with `skill_node_id` listed as an orphan, re-confirm the §10c edit was applied to the **first** `grant select (...) on public.questions` statement in the file (not appended as a second statement) before re-applying — the single most likely failure mode the backend DD's own investigation identified. Do not proceed to any lib/integration-layer implementation (Phase 2+) until this passes.
- **Verification level**: L1 (functional — the real dev DB shape exists and passes the project's own schema-parity tool) as the target; L3 (the staged DDL text and fingerprint update are internally consistent) as the floor before handoff to the manual checkpoint.

## Proof Obligations
- **Claim**: `record_skill_mastery()` implements ADR-0011's trust-boundary mechanism (INVOKER, `service_role`-only EXECUTE, `user_id` derived from the attempt row).
- **Primary failure mode**: the revoke statement is missing, mistyped (wrong function signature/overload — this project's own documented Supabase default-privileges pitfall), or `user_id` is accepted as a caller parameter instead of derived — silently leaving the mastery write forgeable by any authenticated student's own JWT.
- **Boundary to exercise**: DB-level function EXECUTE-grant boundary (proven for real, end-to-end, by backend-task-10's `recordSkillMastery.int.test.ts` Test 2 and backend-task-02's RLS case `MM-b` — this task only authors the DDL correctly; it does not itself run against a live DB).
- **State assertion**: N/A at this task's own scope (no code runs yet); the state assertion is owned by backend-task-10's real-DB proof.
- **Mock boundary rationale**: none — this task is pure DDL authorship, no I/O.
- **Residual**: this task's own verification is limited to the Early Verification Point (`verify:schema` schema-shape parity) — it does NOT itself prove the function is unforgeable by a real JWT; that is backend-task-10 and backend-task-02's job, deliberately sequenced after this checkpoint passes.
- **Claim**: `npm run verify:schema`'s Early Verification Point passes on the dev DB after this task's DDL is applied.
- **Primary failure mode**: any of the 7 checks fails, most likely check #1 (§10c parser trap) or check #7 (fingerprint not updated in the same change, TD-005's exact repeated failure shape).
- **Boundary to exercise**: real dev Postgres instance (the manual checkpoint itself).
- **State assertion**: before = dev DB lacks §9b/§18/§19/edited-§10c; after = dev DB has all 4, and `verify:schema` reports 7/7 green.
- **Mock boundary rationale**: none — this is the one point in Phase 1 that must run against a real, human-operated database.
- **Residual**: none once the checkpoint is confirmed green.

## Completion Criteria
- [ ] DDL for §9b/§18/§19 authored, §10c edited in place (not appended) — staged in `schema.sql`
- [ ] `SCHEMA_FINGERPRINT` and the §17 literal updated to match, in the same commit
- [ ] Each Binding Decision's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes (file:line)
- [ ] ⚠ MANUAL CHECKPOINT confirmed by the human engineer: `verify:schema` 7/7 green on dev; `parseForeignKeys.test.ts`/`schemaFingerprint.test.ts` green
- [ ] No Phase 2+ task begun before this checkpoint is confirmed

## Notes
- Impact scope: `SOURCE/supabase/schema.sql` (§9b/§10c/§18/§19/§17 only) and `SOURCE/lib/schema/schemaFingerprint.ts`.
- Scope boundary: do not touch any other section of `schema.sql` (e.g. §11 `SCORE WRITE LOCKDOWN` is read-only reference, not edited); do not implement any TS code that reads/writes the new tables/function here — that is Phase 2+'s responsibility, explicitly blocked until this checkpoint passes.
