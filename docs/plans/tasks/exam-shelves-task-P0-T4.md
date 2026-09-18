# Task P0-T4 — Dev apply (one CLI command) + 5-query read-back

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T4**
Layer: backend (dev database operation — no source files changed)

Metadata:
- Dependencies: P0-T3 (the migration file being applied)
- Blocks: P0-T5, P0-T6, and everything downstream that reads the new DB objects (all of Phase 1 onward implicitly depends on this landing, though most Phase 1 tasks are pure/independent of the DB directly)
- Size: Small (0 repo files; 1 DB operation + 5 verification queries)
- Verification level: L1 (the 5 read-back queries return real, expected values — not the tool's own success message)

## Implementation Content
From `SOURCE/`, run the whole-file apply:
```
npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql
```
Then perform the dev read-back with the 5 real queries from backend DD § Migration Procedure step 7:
1. Fingerprint — dev's `schema_version.fingerprint` row equals P0-T2/P0-T3's `<fp>`.
2. `pg_proc.proacl` for `exam_hot_counts` — confirms the grant set (`authenticated`, `service_role`; no `anon`).
3. `exam_attempts_source_check` constraint name exists on `exam_attempts`.
4. `exam_attempts_status_submitted_idx` index name exists.
5. `source` column default/nullability on `exam_attempts` (`not null default 'none'`).

## Target Files
- [ ] None (dev database `hynwleaxtbtjzkvpjsug` only — no source files changed by this task)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Migration Procedure step 6, step 7 — the exact 5 read-back queries)
- `SOURCE/supabase/migrations/20260918000000_exam_hot_counts_and_attempt_source_<fp>.sql` (P0-T3's file — the exact statements being applied)
- `C:\Users\ASUS\.claude\projects\...\supabase-project-refs.md`-equivalent project context: dev server uses ref `hynwleaxtbtjzkvpjsug` (confirm before running against any other ref — this is dev, not prod)

## Investigation Notes
_(Record here: the CLI command's raw output; each of the 5 read-back query results verbatim — never paraphrase "looks fine".)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Before applying, run read-back query 1 (fingerprint) against dev and confirm it does **not** yet equal `<fp>` — this is the pre-apply baseline that proves the apply actually changed something
### 2. Green Phase
- [ ] Run the `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file ...` command from `SOURCE/`
- [ ] Run all 5 read-back queries and record each raw result
### 3. Refactor Phase
- [ ] Confirm idempotency: re-running the same migration file a second time does not error (the idempotent `if not exists` / drop-then-add pairs from P0-T1 hold on dev)

## Quality Assurance Mechanisms
- `npm run verify:schema` (extended) — Enforces: live-dev RPC existence/EXECUTE/anon-denial probes — Config: `SOURCE/supabase/verify-schema.ts:448-493` (this task lands the dev state P0-T5 verifies with this tool)

## Operation Verification Methods
- **Verification method**: execute the 5 read-back queries listed above directly against dev, and record their literal return values — never rely on the CLI apply command's own "success" message.
- **Success criteria**: (1) fingerprint = `<fp>`; (2) `proacl` shows execute granted to `authenticated` and `service_role`, absent for `anon`/`public`; (3) constraint `exam_attempts_source_check` exists; (4) index `exam_attempts_status_submitted_idx` exists; (5) `source` column is `not null`, default `'none'`.
- **Failure response**: if any of the 5 queries returns an unexpected value, **STOP** — do not proceed to P0-T5/P0-T6. Re-examine the migration file and the apply command's actual output (not just its exit code) before re-attempting.
- **Verification level**: L1 (functional — this is a real database, not a mock).

## Proof Obligations
- **Claim**: the migration was actually applied to dev (not silently no-op'd), and all 5 declared structural facts hold on dev afterward.
  - **Primary failure mode**: the CLI command reports success (exit 0) while the actual schema is unchanged (e.g. wrong `--project-ref`, or the file path resolved to nothing) — the "missing config" and "unavailable boundary" failure classes from the work plan's checklist.
  - **Boundary to exercise**: live dev Postgres (`hynwleaxtbtjzkvpjsug`) via the 5 real queries — this is not a mocked or fixture check.
  - **State assertion**: before → dev's `schema_version.fingerprint` ≠ `<fp>`, `exam_hot_counts` does not exist; after → fingerprint = `<fp>`, function/constraint/index/column all present with the declared shape.
  - **Mock boundary rationale**: none — this proof is specifically about the real database, not a stand-in.
  - **Residual**: this proves the objects exist with the right shape and grants; that the function's cross-user aggregate actually returns correct counts for a second real user is P0-T6's Early Verification Point.
- **Claim** (Failure Mode: missing config): the grant set is exactly `authenticated, service_role` — not `anon`, not `public`, not missing entirely.
  - **Primary failure mode**: the `revoke`/`grant` statement order was wrong in the migration, leaving `public`'s default EXECUTE grant intact.
  - **Boundary to exercise**: live dev Postgres, `pg_proc.proacl` read.
  - **State assertion**: N/A beyond the grant-set check above.
  - **Mock boundary rationale**: none.
  - **Residual**: anon-specifically-denied (42501) runtime proof is P8-T1/P8-T4's job; this task only confirms the catalogue-level ACL.

## Completion Criteria
- [ ] Dev apply command run successfully from `SOURCE/`
- [ ] All 5 read-back queries executed and their literal results recorded in Investigation Notes
- [ ] Each of the 5 results matches its declared expectation exactly
- [ ] If any result fails to match: task is NOT complete — escalate per the Failure response above rather than proceeding

## Notes
- Impact scope: dev database `hynwleaxtbtjzkvpjsug` only. This is **not** production — confirm the project ref before every call.
- Scope boundary: no source files are touched by this task.
- **Gate 6 becomes meaningful starting with the next commit after this task** — the plan's caveat: "Gate 6 requires the dev database to carry the new schema fingerprint." From P0-T5 onward, run all 6 verify gates before every commit.
