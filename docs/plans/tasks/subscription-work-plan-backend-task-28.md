# Task: ⚠ MANUAL — apply the identical DDL to prod, then gate B on prod

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.8**
Layer: **backend** (database operation)

Metadata:
- Dependencies: backend-task-09 (the DDL text), backend-task-11 (dev apply + gate B), backend-task-25 (the code side of the widened CHECK), backend-task-07 (service fixtures)
- Provides: **the earliest permitted production deploy** — Phase 5 is the first phase whose end permits a prod deploy, and only after this task is green
- Size: Small (no source file changed)

## ⚠ Manual checkpoint — not completable by an agent unsupervised

The apply is engineer-performed and engineer-approved, against **production**.

## Implementation Content

Apply the **identical** DDL (the same four blocks from plan Task 1.1) to prod, then run `npm run verify:schema` against prod with the fingerprint matching git.

**Learn from Engine 1 P-1: a matching fingerprint proves *which build of the file* the database is running, not that its *content* is present.** Verify the money tables and the widened constraint with a **real counting/inspection query**, not a fingerprint comparison.

Ordered here because the Migration Strategy makes the `telemetry_log` alter arrival on **both** databases a precondition for the deploy that starts writing the new codes — and because **rollback of that constraint is only safe before that deploy**, since a rejected telemetry insert is silent.

## Target Files
- [ ] (none — this task changes no repository file)
- [ ] Record the prod apply timestamp and the **content-verification query used** in the plan Progress Tracking, Phase 5 Notes

## Investigation Targets
- `SOURCE/supabase/schema.sql` (the four blocks — the identical text applied to dev in plan Task 1.3)
- `SOURCE/supabase/verify-schema.ts` (the eight checks; item 6 `on delete`; item 7 the fingerprint)
- `SOURCE/lib/schema/schemaFingerprint.ts` (the git-side fingerprint)
- `SOURCE/lib/tutor/telemetry.ts` (the six literals live code will write once deployed)
- `docs/design/subscription-backend-design.md` (§ Migration Strategy)
- `docs/plans/subscription-work-plan.md` (§ Deployment Sequencing — the Phase 5 row and the Rollback note)

## Quality Assurance Mechanisms
- `npm run verify:schema` -> `npx tsx supabase/verify-schema.ts` (DB-side, per environment, run from `SOURCE/`) — Enforces: the DDL being right in git and **absent from a database** — Config: `SOURCE/package.json:13`

## Implementation Steps
### 1. Pre-apply
- [ ] Confirm gate A green and gate B green on **dev**; confirm the DDL text is byte-identical to what dev received
- [ ] Confirm the target is **prod** (`.mcp.json` points at PROD; the dev ref comes from `SOURCE/.env.local`) — and that **no production deploy of this branch has happened yet**
### 2. Apply (engineer-performed)
- [ ] Apply the four blocks to prod; record the timestamp
### 3. Gate B on prod + content verification
- [ ] Run `npm run verify:schema` against prod; capture the output verbatim
- [ ] Run a **real counting/inspection query** confirming: both money tables exist with their column sets, and `telemetry_log_error_code_check` admits all **six** literals
- [ ] Record the query used

## Operation Verification Methods
- **Verification method**: `npm run verify:schema` against prod **plus** a real counting/inspection query over the money tables and the widened constraint.
- **Success criteria**: ⚠ **Gate B green on prod, content verified by a real query** (not a fingerprint comparison); the widened `telemetry_log` CHECK present.
- **Failure response**: **stop. Do not deploy the AI gates.** A deploy that writes a new telemetry code before this lands fails the CHECK **silently**, because telemetry writes are best-effort.
- **Verification level**: L1 (the objects and the constraint are observed on the live production catalog).

## Proof Obligations
- **Claim (rollback-only visibility)**: the widened constraint reaches **every** environment **before** the deploy that writes the new values.
- **Primary failure mode**: the alter reaches git but not a database; every refusal that tries to write a new code fails the CHECK **with nothing red**. After the deploy that starts writing them, a rollback re-narrows a CHECK that live code writes against — and the rejected inserts are silent.
- **Boundary to exercise**: the live production Postgres catalog, read by `verify-schema.ts` **and** by an independent counting/inspection query.
- **State assertion**: before — prod lacks both money tables and admits four telemetry literals; after — both tables present with their designed column sets, and the CHECK admits all six literals.
- **Mock boundary rationale**: none. A fingerprint comparison is explicitly **insufficient** as the content proof.
- **Residual**: rollback safety exists **only before** the first deploy that writes the new codes; after that, treat re-narrowing as an incident action.

## Completion Criteria
- [ ] ⚠ Gate B green on **prod**, fingerprint matching git
- [ ] Prod **content** verified by a real counting/inspection query, and the query recorded
- [ ] The widened `telemetry_log` CHECK present on prod
- [ ] **Production deploy is permitted only after this task is green** — and not before (see Deployment Sequencing)

## Notes
- Impact scope: the production database.
- Scope boundary: no repository file changes; `npm run verify:schema` and `npm run check:bundle` are two distinct scripts and both must be run separately.
- Downstream gates that remain after this: plan Task 6.2 (SVC-2) before S-05 reaches real users; plan Task 6.8 before the purchase control is enabled.
