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
- [x] (none — no **source** file changed; the only repository edit is the plan record below)
- [x] Record the apply timestamp and the verbatim gate B output in the plan Progress Tracking, Phase 1 Notes — `docs/plans/subscription-work-plan.md` § Progress Tracking → Phase 1

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
- [x] Confirm gate A is green (`npm test`) — plan Task 1.2 closed; baseline 919 pass / 10 skip
- [x] Read the four blocks end to end and confirm the target environment is **dev**, not prod (`.mcp.json` points at PROD; the dev ref comes from `SOURCE/.env.local`) — the project list was read before any DDL; dev = `hynwleaxtbtjzkvpjsug`, prod = `pebjdlbgbmizgfpuptjl`
### 2. Apply (engineer-performed)
- [x] Apply the four blocks to dev in one engineer-authorised apply (five statements, fingerprint last), executed through the Composio Supabase toolkit
- [x] Record the apply timestamp — `2026-08-18T13:53:05.77815+00:00` (`schema_version.applied_at`)
### 3. Gate B
- [x] Run `npm run verify:schema` from `SOURCE/` against dev; capture the output verbatim — recorded in the plan's Phase 1 Notes
- [x] Confirm item 6 (`on delete` on both new FKs — FK count 25 → 27, all matching) and item 7 (fingerprint `021dd1387945` matches git) explicitly

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
- [x] ⚠ Gate B green on **dev** (`npm run verify:schema` from `SOURCE/`), fingerprint matching git
- [x] Item 6 and item 7 confirmed explicitly in the captured output
- [x] The apply timestamp and the verbatim gate B output recorded in the plan Phase 1 Notes
- [x] **No production deploy of this branch has occurred**, and **no DDL was applied to prod** (that is plan Task 5.8) — prod `pebjdlbgbmizgfpuptjl` still has neither table

## Investigation Notes

- `SOURCE/supabase/schema.sql` — the four blocks sit before `-- 17. Phiên bản schema`, in the order applied: `payment_orders` (+ `payment_orders_user_created_idx`, RLS, revokes, `orders_select_own`), `subscriptions` (RLS, revokes, `subscriptions_select_own`), `record_payment_settlement(bigint, integer)` (drop-then-create, revoke by name, `grant execute … to service_role`), and the `telemetry_log_error_code_check` drop/add pair. The §17 `insert into public.schema_version` remains the file's last statement — which is why the apply wrote the fingerprint last.
- `SOURCE/supabase/verify-schema.ts` — item 6 prints the declared-vs-live FK comparison ("Đối chiếu `on delete` …"); item 7 reads `schema_version.fingerprint, applied_at` and prints "apply lúc <applied_at>". The apply timestamp recorded for this task is therefore the *same* value the gate prints, not a separately observed clock reading.
- `SOURCE/package.json:15` — `verify:schema` is `npx tsx supabase/verify-schema.ts`, standalone; `check:bundle` is a different script and neither pipes into the other.
- `SOURCE/lib/schema/schemaFingerprint.ts` — `SCHEMA_FINGERPRINT = "021dd1387945"`, matching the value gate B read from dev. The fingerprint is a content hash of the *executable* SQL (comments and whitespace normalised away), so it moves on any real DDL change.
- `docs/plans/subscription-work-plan.md` § Deployment Sequencing, Phase 1 row — "Dev-only apply. Prod still has neither new table"; a production deploy is first permitted at Phase 5, after Task 5.8. The Phase 1 Notes entry states this explicitly so a later reader cannot read gate B as a prod statement.
- Residual carried into the record: a matching fingerprint proves *which build* the DB is running, not that every object's content is present — hence the pre-fingerprint catalog readings (column lists, CHECK text, FK `on delete`, RLS, function ACL) recorded alongside the gate output.

## Notes
- Impact scope: the dev database only.
- Scope boundary: prod is untouched. `npm run verify:schema` and `npm run check:bundle` are two distinct scripts; neither pipes into the other.
- Downstream: plan Task 0.8 fixtures may now be executed; plan Tasks 2.1, 3.x integration cases and the two new Vitest lanes become runnable against dev.
