# Task: ⚠ BLOCKING MANUAL CHECKPOINT — hand-apply the DDL to dev, then gate B

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.3**
Layer: **backend** (database operation)

Metadata:
- Dependencies: backend-task-09 (DDL text), backend-task-10 (gate A green) — **both required before this starts**
- Provides: a dev database that has the four DDL objects — the precondition for plan Tasks 1.5, 2.1, 3.1, 3.8, 6.1, 6.2 and for running `npm run test:integration` / `npm run test:localdb` at all
- Size: Small (no source file changed)

## ⚠ Manual checkpoint — not completable by an agent unsupervised

This is a **hand-apply to a live database**. An agent may prepare the statements, run the verification command and read its output, but **the apply itself is engineer-performed and engineer-approved**. This checkpoint has failed silently three times in this repository.

## Implementation Content

1. Hand-apply the four DDL blocks from plan Task 1.1 to the **dev** database.
2. Run `npm run verify:schema` **from `SOURCE/`** against dev (`npx tsx supabase/verify-schema.ts` — a standalone script; it is **not** part of `npm run check:bundle`).
3. All **eight** checks green, with **item 6** (`on delete` of every FK, read from the live catalog through the §16a RPC) and **item 7** (the §17 fingerprint) specifically confirmed.

**Nothing below may start against a database that has not passed gate B.**

## Target Files
- [ ] (none — this task changes no repository file)
- [ ] Record the apply timestamp and the verbatim gate B output in the plan Progress Tracking, Phase 1 Notes

## Investigation Targets
- `SOURCE/supabase/schema.sql` (the four blocks written by plan Task 1.1 — the exact text to apply)
- `SOURCE/supabase/verify-schema.ts` (the eight checks; item 6 §16a RPC path; item 7 fingerprint comparison)
- `SOURCE/package.json:13` (`verify:schema` — confirm it is standalone and run it separately from `check:bundle`)
- `SOURCE/lib/schema/schemaFingerprint.ts` (the git-side fingerprint item 7 compares against)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy)
- `docs/plans/subscription-work-plan.md` (§ Deployment Sequencing — Phase 1 row: **dev-only apply; prod still has neither table**)

## Quality Assurance Mechanisms
- `npm run verify:schema` -> `npx tsx supabase/verify-schema.ts` (DB-side, per environment, run from `SOURCE/`) — Enforces: the DDL being right in git and **absent from a database** — Config: `SOURCE/package.json:13`, `SOURCE/supabase/verify-schema.ts`

## Implementation Steps
### 1. Pre-apply
- [ ] Confirm gate A is green (`npm test`) — if it is not, **stop**
- [ ] Read the four blocks end to end and confirm the target environment is **dev**, not prod (`.mcp.json` points at PROD; the dev ref comes from `SOURCE/.env.local`)
### 2. Apply (engineer-performed)
- [ ] Apply the four blocks to dev in one hand-apply
- [ ] Record the apply timestamp
### 3. Gate B
- [ ] Run `npm run verify:schema` from `SOURCE/` against dev; capture the output verbatim
- [ ] Confirm item 6 (`on delete` on both new FKs) and item 7 (fingerprint matches git) explicitly

## Operation Verification Methods
- **Verification method**: `npm run verify:schema` from `SOURCE/`, against dev, after the hand-apply.
- **Success criteria**: **all eight `verify-schema.ts` checks green on dev**, `on delete` present on **both** new FKs, §17 fingerprint matching git.
- **Failure response**: **stop the phase. Do not proceed to implementation.** A failure here is not a defect to work around — it means the database and git disagree, which is exactly the "payment taken, nothing written" shape this gate exists to prevent.
- **Verification level**: L1 for the schema itself (the objects exist and are observable in the live catalog).

## Proof Obligations
- **Claim**: the four designed objects exist on dev with the same shape they have in git.
- **Primary failure mode**: DDL correct in git and **absent from the database** (TD-005) — for a money table the failure shape is "payment taken, nothing written". Has occurred three times in this repository.
- **Boundary to exercise**: the live dev Postgres catalog, read through `verify-schema.ts` (including the §16a RPC for FK `on delete`).
- **State assertion**: before — `payment_orders` / `subscriptions` / `record_payment_settlement` absent from dev; after — all three present, both FKs carrying `on delete`, the widened `telemetry_log` CHECK in force.
- **Mock boundary rationale**: none. A mocked client would assert the mock, not the catalog.
- **Residual**: says nothing about **prod**, which still has neither table until plan Task 5.8; and a matching fingerprint proves which build of the file the database is running, **not** that its content is present — which is why plan Task 5.8 verifies prod with a real counting query.

## Completion Criteria
- [ ] ⚠ Gate B green on **dev** (`npm run verify:schema` from `SOURCE/`), fingerprint matching git
- [ ] Item 6 and item 7 confirmed explicitly in the captured output
- [ ] The apply timestamp and the verbatim gate B output recorded in the plan Phase 1 Notes
- [ ] **No production deploy of this branch has occurred**, and **no DDL was applied to prod** (that is plan Task 5.8)

## Notes
- Impact scope: the dev database only.
- Scope boundary: prod is untouched. `npm run verify:schema` and `npm run check:bundle` are two distinct scripts; neither pipes into the other.
- Downstream: plan Task 0.8 fixtures may now be executed; plan Tasks 2.1, 3.x integration cases and the two new Vitest lanes become runnable against dev.
