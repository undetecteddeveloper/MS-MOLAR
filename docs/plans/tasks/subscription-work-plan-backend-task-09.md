# Task: DDL — the four designed schema blocks + fingerprint recomputation

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.1**
Layer: **backend** (schema + library code)

Metadata:
- Dependencies: backend-task-08 (plan Task 0.9 — BU-6 raised **before** any DDL is written)
- Provides: the DDL text that gate A (plan Task 1.2) asserts and gate B (plan Task 1.3) applies
- Size: Small (2 files)

`Change Category: boundary-change`

The `telemetry_log_error_code_check` replacement changes a **persisted** constraint on an existing, populated table that live code writes against. Sweep the adjacent cases sharing that boundary (listed in Investigation Targets) for the same class of defect: a constraint that is right in git and absent from a database, and a code-side literal list that drifts from the SQL-side one.

## Implementation Content

**Exactly four blocks — the same four the plan header counts.** Each has a Design-to-Plan Traceability row pointing at a backend DD **Schema** section; a block with no such row does not belong in this apply. All inserted **before** `-- 17. Phiên bản schema` at `schema.sql:1597` (the fingerprint insert must remain the file last statement), using **unnumbered named headers** (the mastery-block precedent at `:1268`; there is no §18 and no §19).

1. **`payment_orders`** — exactly the eleven columns in Reference Contracts below, `user_id … on delete set null`, the `status` CHECK carrying **exactly** the four permitted literals verbatim, `pending_until` fed by the same constant as payOS `expiredAt`, the four transfer columns `text not null`; `payment_orders_user_created_idx` on `(user_id, created_at desc)`; RLS enabled; `revoke insert, update, delete … from anon, authenticated`; `revoke select … from anon`; policy `orders_select_own`.
2. **`subscriptions`** — `user_id … on delete cascade`, `expires_at`, `period_anchor_at`, `updated_at`; RLS + the same revokes + policy `subscriptions_select_own`.
3. **`record_payment_settlement(bigint, integer default 30)`** — **drop-then-create** (not `create or replace`; the one exception at `:990` is dependency-scoped and this function has no dependents), `INVOKER`, `set search_path = public, pg_temp`, the `status = 'pending'` guard **inside** the UPDATE, the null-beneficiary `raise exception`, `greatest(expires_at, now()) + make_interval` with `period_anchor_at = now()` **in the same statement**; then `revoke all … from public, anon, authenticated` **by name** and `grant execute … to service_role`.
4. **`telemetry_log_error_code_check` replaced in place** under its own name — **both** the inline edit at `:1381-1382` (4 → 6 literals) **and** the drop/add pair, because `create table if not exists` is a no-op on the two databases that already exist.

Then recompute §17 literal **and** `SOURCE/lib/schema/schemaFingerprint.ts` `SCHEMA_FINGERPRINT` **in the same commit** — one recomputation for the whole block.

### No fifth block

The durable AI usage-log sink is **not** in this apply: no Design Doc schema section designs it, and choosing between a dedicated table and extending `telemetry_log` — or choosing its columns — is a schema design decision this plan does not make (BU-6 / plan Task 0.9). It also has no RLS denial case in plan Task 1.5, no allowlist coverage in plan Task 1.2 and no stated grants or FK target. When the DD revision lands, it ships as its **own** DDL block with its own traceability row, its own denial block and its own hand-apply — **not smuggled into this one**.

## Target Files
- [ ] `SOURCE/supabase/schema.sql` (four new/edited DDL blocks + the §17 fingerprint literal)
- [ ] `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` recomputed in the same commit)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (`:1268` the unnumbered mastery-block header precedent; `:1381-1382` the inline `error_code in ( … )` list; `:1597` the `-- 17. Phiên bản schema` fingerprint insert; `:990` the one `create or replace` exception)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` and how it is computed)
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` and `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (the gate-A assertions this DDL must satisfy)
- `SOURCE/lib/tutor/telemetry.ts` (`:35` `TELEMETRY_ERROR_CODES`, `:37` the derived type, `:78` the runtime filter — the code side of the widened CHECK) — **adjacent case for the boundary sweep**
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49` the hand transcription, `:261` the two-layer guard that must pass unmodified) — **adjacent case for the boundary sweep**
- `SOURCE/supabase/verify-schema.ts` (the eight checks gate B runs, incl. item 6 `on delete` via the §16a RPC and item 7 the fingerprint)
- `docs/design/subscription-backend-design.md` (§ Schema)
- `docs/design/subscription-backend-design.md` (§ Schema / MSA-1)
- `docs/design/subscription-backend-design.md` (§ Schema / MSA-2)
- `docs/design/subscription-backend-design.md` (§ Schema (R13))
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Decision)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-…-prepaid-period-model.md` (§ Decision) | persistence | Entitlement only stored state is one `expires_at` timestamp in a dedicated `subscriptions` table, evaluated at every read — no boolean, no status enum, no provider-pushed lifecycle | `subscriptions` declares `expires_at` and carries no boolean, no status enum and no provider lifecycle column |
| `docs/adr/ADR-0013-…-prepaid-period-model.md` (§ Implementation Guidance) | persistence | "Store **one** timestamp. Do not add `is_premium`, `is_active`, `status`, `plan_active`, or any other cached restatement of what the timestamp already says" | Neither new table declares `is_premium`, `is_active`, `status` (on `subscriptions`), `plan_active` or any other cached restatement of `expires_at` |
| `docs/adr/ADR-0013-…-prepaid-period-model.md` (§ Implementation Guidance) | data_flow | "Extend with `max(expires_at, now()) + 30 days`. Write it once, in one function, and test all three cases: still valid, inside grace, past grace" | The extension is written **once**, inside `record_payment_settlement`, as `greatest(expires_at, now()) + make_interval(days => p_period_days)` |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | persistence | The entitlement write is `service_role`-only, `INVOKER`, revoked by name from `public, anon, authenticated`, with `user_id` **derived in SQL from the order row** | `record_payment_settlement` is `INVOKER`, revoked by name from `public, anon, authenticated`, granted to `service_role`, and takes no user identifier — the beneficiary comes from the order row |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | persistence | Replay defence is state-based: idempotency is the order own `pending → paid` transition, guarded in SQL — no nonce table, no timestamp window, no clock | The `status = 'pending'` guard sits **inside** the UPDATE, and no nonce table, timestamp window or clock-based replay defence is added |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | persistence | "`revoke all on function … from public, anon, authenticated` **by name**, every time, on the new function" | The revoke statement names `public, anon, authenticated` explicitly on `record_payment_settlement` |

**Recorded deviation carried into implementation** (backend DD `:527-531`): `record_payment_settlement()` uses **two** statements where ADR-0014 Implementation Guidance says "Two statements is a window." It is a **recorded deviation, not compliance**; the transaction + row-lock argument (Assumed Behavior A-1, `Confirmed: Yes`) is what makes it safe, and **plan Task 6.1 concurrent real-Postgres case is what proves it rather than assuming it**. If review rejects the deviation, the fallback is a single data-modifying CTE plus an explicit null-beneficiary post-check — a local change to that one function.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `payment_orders`) | structure-order | The `payment_orders` column set is **exactly** the eleven declared: `order_code`, `user_id`, `amount`, `status`, `created_at`, `pending_until`, `settled_at`, `qr_payload`, `account_number`, `account_name`, `memo` — an allowlist, not a blocklist | The `payment_orders` block declares exactly these eleven columns and no twelfth |
| `docs/design/subscription-backend-design.md` (§ Schema, `payment_orders`) | structure-order | `status        text not null default 'pending'` `check (status in ('pending', 'paid', 'expired', 'cancelled'))` — the permitted set is **exactly** these four literals, in this declaration. **No `'refunded'` value**: *"refunds are a bank action plus a hand-written SQL correction (D10). Inventing a status the code never sets would be a state reachable only by a code path that does not exist"* | The `status` CHECK admits exactly `'pending'`, `'paid'`, `'expired'`, `'cancelled'` and no fifth literal |
| `docs/design/subscription-backend-design.md` (§ Schema, telemetry alter) | structure-order | `'gemini_unavailable', 'rate_limited', 'server', 'not_eligible', 'user_quota_exhausted', 'project_budget_exhausted'` | Both `error_code in ( … )` occurrences in `schema.sql` list exactly these six literals |
| `docs/design/subscription-backend-design.md` (§ Schema, `record_payment_settlement`) | derived-display | `set expires_at = greatest(public.subscriptions.expires_at, now()) + make_interval(days => p_period_days)`, `period_anchor_at = now()` — in the same statement | The function sets `expires_at` and `period_anchor_at` in **one** statement, exactly as written |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations (header style at `:1268`, the exact insertion point before `:1597`, both `error_code in ( … )` sites)
- [ ] **Boundary sweep (Change Category `boundary-change`)**: enumerate every place the telemetry literal list exists — `schema.sql` inline at `:1381-1382`, the drop/add pair this task adds, `telemetry.ts:35`, `telemetry.test.ts:49`, `telemetry.test.ts:261` — and record which task owns each (this task owns the two SQL sites; plan Task 5.5 owns the code sites). Fold the SQL-side sites into this commit; do **not** edit `telemetry.ts` here
- [ ] Write/extend the failing text-side assertions first where they belong to gate A (plan Task 1.2 owns the two **new** ones; confirm the existing `parseForeignKeys` and `schemaFingerprint` cases go red against the un-fingerprinted DDL)
### 2. Green Phase
- [ ] Write the four blocks; recompute §17 and `SCHEMA_FINGERPRINT` in the same commit
- [ ] Run `npm test` and confirm the schema text-side cases pass
### 3. Refactor Phase
- [ ] Re-count the new-object blocks (must be **four**) and re-check each against its traceability row

## Quality Assurance Mechanisms
- `parseForeignKeys.test.ts` (text-side, `readFileSync`, no DB) — Enforces: TD-011, every FK declares `on delete` — Config: `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`
- `schemaFingerprint.test.ts` (text-side) — Enforces: TD-005, the three fingerprint values agree — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`
- `npm run verify:schema` -> `npx tsx supabase/verify-schema.ts` (DB-side, per environment, run from `SOURCE/`) — Enforces: the DDL being right in git and **absent from a database** — Config: `SOURCE/package.json:13`
- `telemetry.test.ts:261` two-layer guard — Enforces: `TELEMETRY_ERROR_CODES` matches the CHECK constraint; **must pass unmodified** — Config: `SOURCE/lib/tutor/__tests__/telemetry.test.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: gate A only — `npm test` with `readFileSync`-based assertions over `SOURCE/supabase/schema.sql`. **No database is touched by this task**; the apply is plan Task 1.3.
- **Success criteria**: `parseForeignKeys.test.ts` and `schemaFingerprint.test.ts` green; the file gained **exactly four** new/edited DDL blocks; the §17 fingerprint literal and `schemaFingerprint.ts` agree.
- **Failure response**: **stop the phase.** A failure in either gate means the DDL text is wrong — do not proceed to implementation and do not apply to any database.
- **Verification level**: L2 (text-side tests added/passing). L1 is unreachable until gate B (plan Task 1.3).

## Proof Obligations
- **Claim**: the four designed schema objects exist in git exactly as designed, and nothing undesigned rode along.
- **Primary failure mode**: a fifth block (the undesigned usage sink) or a twelfth `payment_orders` column ships with no RLS denial case, no allowlist coverage and no stated grants.
- **Boundary to exercise**: the schema text itself, read with `readFileSync` (no database, no credential).
- **State assertion**: N/A in this task — the DDL is text until plan Task 1.3 applies it.
- **Mock boundary rationale**: none — gate A reads the real file.
- **Residual**: gate A says nothing about whether the DDL reached a database; that is gate B (plan Tasks 1.3 and 5.8), and a matching fingerprint proves which build is running, not that the content is present.

Additional obligations carried verbatim from the plan:
- no boolean entitlement column exists anywhere in either new table (AC-004, enforced structurally);
- the `payment_orders` column set is exactly eleven;
- the `status` CHECK admits exactly the four permitted literals and no fifth;
- `record_payment_settlement` is declared with drop-then-create and revoked **by name**;
- the file new-object count is **four blocks**, matching the header and the traceability rows.

## Completion Criteria
- [ ] All added tests pass; `npm test` green (gate A)
- [ ] `schema.sql` gained **exactly four** new/edited DDL blocks, each with a Design Doc **schema** section behind it
- [ ] §17 literal and `SOURCE/lib/schema/schemaFingerprint.ts` recomputed **in this same commit**
- [ ] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence (file:line) recorded in Investigation Notes
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] No sink DDL shipped (BU-6 open) — **no fifth block**
- [ ] **No production deploy of this branch has occurred** (see the plan Deployment Sequencing table)

## Notes
- Impact scope: `SOURCE/supabase/schema.sql`, `SOURCE/lib/schema/schemaFingerprint.ts`; downstream, plan Tasks 1.2, 1.3, 1.5, 5.5, 5.8.
- Scope boundary: `SOURCE/lib/tutor/telemetry.ts` and `SOURCE/lib/tutor/__tests__/telemetry.test.ts` are **not** edited here — plan Task 5.5 owns the code side of the widened CHECK. `SOURCE/lib/billing/types.ts` is frozen.
- The fingerprint insert must remain the **last** statement in `schema.sql`.

## Investigation Notes
(Record the boundary-sweep enumeration, the block count, and each Compliance Check result with file:line evidence here.)
