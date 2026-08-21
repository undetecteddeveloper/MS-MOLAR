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
- [x] `SOURCE/supabase/schema.sql` (four new/edited DDL blocks + the §17 fingerprint literal)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` recomputed in the same commit)

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
- [x] Read all Investigation Targets and record key observations (header style at `:1268`, the exact insertion point before `:1597`, both `error_code in ( … )` sites)
- [x] **Boundary sweep (Change Category `boundary-change`)**: enumerate every place the telemetry literal list exists — `schema.sql` inline at `:1381-1382`, the drop/add pair this task adds, `telemetry.ts:35`, `telemetry.test.ts:49`, `telemetry.test.ts:261` — and record which task owns each (this task owns the two SQL sites; plan Task 5.5 owns the code sites). Fold the SQL-side sites into this commit; do **not** edit `telemetry.ts` here
- [x] Write/extend the failing text-side assertions first where they belong to gate A (plan Task 1.2 owns the two **new** ones; confirm the existing `parseForeignKeys` and `schemaFingerprint` cases go red against the un-fingerprinted DDL)
### 2. Green Phase
- [x] Write the four blocks; recompute §17 and `SCHEMA_FINGERPRINT` in the same commit
- [x] Run `npm test` and confirm the schema text-side cases pass
### 3. Refactor Phase
- [x] Re-count the new-object blocks (must be **four**) and re-check each against its traceability row
- [x] Reconcile `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` against the shipped DDL: `FIXTURE_PERIOD_DAYS` versus `record_payment_settlement(p_period_days …)`'s default, and the **eleven** `payment_orders` plus **four** `subscriptions` column-name literals (`PaymentOrderRow` / `SubscriptionRow`, and the insert/upsert key sets) versus the column sets written here — these cross PostgREST as strings, so no compile-time link is possible and this checklist line is the only reconciliation there is

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
- [x] All added tests pass; `npm test` green (gate A)
- [x] `schema.sql` gained **exactly four** new/edited DDL blocks, each with a Design Doc **schema** section behind it
- [x] §17 literal and `SOURCE/lib/schema/schemaFingerprint.ts` recomputed **in this same commit**
- [x] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence (file:line) recorded in Investigation Notes
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] No sink DDL shipped (BU-6 open) — **no fifth block**
- [x] **No production deploy of this branch has occurred** (see the plan Deployment Sequencing table)

## Notes
- Impact scope: `SOURCE/supabase/schema.sql`, `SOURCE/lib/schema/schemaFingerprint.ts`; downstream, plan Tasks 1.2, 1.3, 1.5, 5.5, 5.8.
- Scope boundary: `SOURCE/lib/tutor/telemetry.ts` and `SOURCE/lib/tutor/__tests__/telemetry.test.ts` are **not** edited here — plan Task 5.5 owns the code side of the widened CHECK. `SOURCE/lib/billing/types.ts` is frozen.
- The fingerprint insert must remain the **last** statement in `schema.sql`.

## Investigation Notes

### Insertion point and header style (Investigation Targets)

- Header precedent confirmed at `schema.sql:1267-1279` — the mastery block uses an unnumbered named header under a `-- ===` rule. The four new blocks follow it: `:1604`, `:1670`, `:1703`, `:1794`. No §18, no §19 introduced.
- Insertion point: the four blocks sit at `:1603-1821`, immediately **before** the §17 rule line. `-- 17. Phiên bản schema` now at `:1824`; the `insert into public.schema_version` at `:1861-1865` is still the **last statement** in the file (verified by `tail`).
- `create or replace` exception re-read at `:981-989` (rationale) / `:990` (statement): it is **dependency-scoped** — the view `exams_with_difficulty` depends on `exam_rating_aggregate()`, so `drop function` dies with 2BP01 on a second run. `record_payment_settlement()` has no dependents, so drop-then-create applies (`:1734-1735`), matching `record_exam_result` (`:887-888`) and `record_skill_mastery` (`:1303-1304`).
- `INVOKER` is Postgres' default when `security definer` is not declared; the file states this explicitly at `:875` and `:1459-1460` and both privileged-write precedents rely on it rather than writing `security invoker`. The new function follows: no `security definer` anywhere in `:1703-1793` (grep confirmed), and the header comment records why.
- `schemaFingerprint.ts` computes a sha256 over `normalizeSql(sql)` with the `@schema-fingerprint` block excised, truncated to 12 hex chars; comments and whitespace are normalised away, so only executable SQL moves it.

### Boundary sweep — the telemetry literal list (Change Category `boundary-change`)

Repo-wide grep for `gemini_unavailable` over `*.ts`/`*.tsx`/`*.sql`. Every site of the **constraint list**, and its owner:

| # | Site | Owner | Action here |
|---|---|---|---|
| 1 | `SOURCE/supabase/schema.sql:1382-1389` — inline CHECK inside `create table telemetry_log` | **this task** | edited 4 → 6 literals |
| 2 | `SOURCE/supabase/schema.sql:1810-1821` — the `drop constraint` / `add constraint` pair | **this task** | added (new) |
| 3 | `SOURCE/lib/tutor/telemetry.ts:35` — `TELEMETRY_ERROR_CODES` | plan Task 5.5 | **not edited** |
| 4 | `SOURCE/lib/tutor/__tests__/telemetry.test.ts:49` — hand-transcribed `SCHEMA_ERROR_CODES` | plan Task 5.5 | **not edited** |
| 5 | `SOURCE/lib/tutor/__tests__/telemetry.test.ts:261` — the two-layer equality guard | plan Task 5.5 | **not edited; passes unmodified** |

Same-boundary sites that are *not* the constraint list, recorded so they are not mistaken for drift:
- `SOURCE/app/(layer2)/tutorActions.ts:51` — `ExplainStepError`, the **client-visible** union (UI-D3 collapse constraint, plan Task 5.3). Deliberately does not widen with the CHECK.
- `SOURCE/lib/tutor/callTutor.ts:51` — `Extract<TelemetryErrorCode, …>`, **derived**, so it carries no transcription.
- `SOURCE/lib/tutor/telemetry.ts:33`/`:39` and `telemetry.test.ts:188` — phantom "§19" labels and a "4 named literals" comment; cleanup owned by plan Task 5.5.
- `SOURCE/lib/supabase/service-role.ts:73` — the stale "§18" label; owned by plan Task 3.2/3.4 (traceability row I6). Out of scope here.

**Why `telemetry.test.ts:261` still passes with the SQL at six and the code at four**: `:49` is a *hand copy*, deliberately not a parse of `schema.sql` (stated at `:47-48`). Both sides of the `:261` equality are code-side, so widening SQL alone cannot move it. That is exactly the drift plan Task 1.2's new "every `error_code in ( … )` occurrence" parse case exists to close. Confirmed by running the file: 4 files / 40 tests pass, `telemetry.test.ts` unmodified.

### Red-phase observation (gates actually seen failing)

- `schemaFingerprint.test.ts` → **RED** against the un-fingerprinted DDL: `expected '021dd1387945' to be 'd714c313fe1d'` at `schemaFingerprint.test.ts:105`.
- `parseForeignKeys.test.ts` stayed green on the correct DDL (both new FKs declare `on delete`), so a green run proves nothing on its own. Discrimination was therefore **observed directly** with two transient probes on the real file, each reverted immediately:
  - dropping `on delete set null` from `payment_orders.user_id` → RED, reported `"public.payment_orders(user_id) -> auth.users"`;
  - dropping `on delete cascade` from `subscriptions.user_id` → RED, reported `"public.subscriptions(user_id) -> auth.users"`.
  The gate sees both new foreign keys; it is not passing by not looking.

### Block count and structural obligations

- **Exactly four** new/edited blocks — `grep -c "^-- SUBSCRIPTION — "` = **4** (`:1604`, `:1670`, `:1703`, `:1794`). No fifth block; **no `ai_usage_log`, no usage columns on `telemetry_log`** (BU-6 stays open and undesigned).
- Each block maps to a traceability row in `docs/plans/subscription-work-plan.md`: `:106`+`:107` (payment_orders + MSA-2 columns), `:108` (subscriptions / MSA-1), `:109` (record_payment_settlement), `:110` (RLS), `:111` (Schema (R13) telemetry alter), `:112` (fingerprint).
- `payment_orders` column set parsed out of the block = **exactly eleven**, in DD order: `order_code, user_id, amount, status, created_at, pending_until, settled_at, qr_payload, account_number, account_name, memo`. No twelfth.
- `subscriptions` = **four**: `user_id, expires_at, period_anchor_at, updated_at`. Grep for `boolean|is_premium|is_active|plan_active|status` inside the block matches only a *comment* saying those must not exist — no such column in either new table (AC-004, structural).
- Fingerprint recomputed once for the whole change: `schema.sql:1862` `values (1, '021dd1387945')` and `SOURCE/lib/schema/schemaFingerprint.ts:41` `SCHEMA_FINGERPRINT = "021dd1387945"`. Repo-wide grep for the old `d714c313fe1d` returns **no** remaining occurrence.

### Binding Decisions — Compliance Check results

| Source | Axis | Result | Evidence |
|---|---|---|---|
| ADR-0013 (§ Decision) | persistence | **Y** | `schema.sql:1683` declares `expires_at timestamptz not null`; the block `:1677-1691` contains only `user_id`, `expires_at`, `period_anchor_at`, `updated_at`. Grep over the block for `boolean`/`is_premium`/`is_active`/`plan_active`/`status` matches no column declaration — only the comment at `:1681-1682`. No provider lifecycle column exists |
| ADR-0013 (§ Implementation Guidance) | persistence | **Y** | Same block scan plus `payment_orders` `:1610-1648`: the only `status` in the change is `payment_orders.status` (`:1623-1624`), an **order** state that ADR-0013's rule does not govern (its subject is the entitlement timestamp). `subscriptions` has no `status`. `period_anchor_at` (`:1689`) is not a restatement — MSA-1's argument recorded in the column comment `:1684-1688`: after an early purchase `expires_at − 30d` is the OLD expiry, a different value |
| ADR-0013 (§ Implementation Guidance) | data_flow | **Y** | The extension is written exactly **once** in the repository: `schema.sql:1773-1774` `greatest(public.subscriptions.expires_at, now()) + make_interval(days => p_period_days)`, inside `record_payment_settlement`. Grep for `make_interval` in `schema.sql` returns only `:1771` (the insert arm) and `:1774` (the conflict arm) of that one function |
| ADR-0014 (§ Decision 3) | persistence | **Y** | `:1735-1743` declares the function with no `security definer` (INVOKER by Postgres default, the file's stated convention at `:875`, `:1459-1460`); `:1788-1789` `revoke all on function … from public, anon, authenticated`; `:1790-1791` `grant execute … to service_role`. Parameters are `p_order_code bigint` and `p_period_days integer` only — **no user identifier**; the beneficiary comes from `returning user_id into v_user_id` at `:1754` |
| ADR-0014 (§ Decision 4) | persistence | **Y** | `and status = 'pending'` sits **inside** the UPDATE's WHERE at `:1753`, above `returning` at `:1754`. No nonce table, no timestamp window and no clock-based defence is added anywhere in `:1603-1821` |
| ADR-0014 (§ Implementation Guidance) | persistence | **Y** | `:1788-1789` names all three roles explicitly on `record_payment_settlement(bigint, integer)` |

**Recorded deviation carried through as designed** (backend DD `:527-531`): the body uses **two** statements (`:1750-1754` UPDATE, `:1770-1779` INSERT … ON CONFLICT). Carried as a *deviation*, not compliance — the header comment at `:1724-1733` states the transaction + row-lock argument and names plan Task 6.1's concurrent real-Postgres case as what proves it. The single-statement CTE fallback and why it was rejected (the null-beneficiary `raise exception` at `:1764-1765` has no CTE equivalent) is recorded in the same comment.

### Reference Contracts — Compliance Check results

| Source | Result | Evidence |
|---|---|---|
| DD § Schema, `payment_orders` — eleven columns | **Y** | Column declarations parsed out of `:1610-1648` = 11, in the declared order. Any twelfth would appear in that parse |
| DD § Schema, `payment_orders` — `status` CHECK, four literals | **Y** | `:1623-1624` `status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled'))`. Exactly four; **no `'refunded'`** |
| DD § Schema, telemetry alter — six literals | **Y** | Both occurrences carry the same six: `:1383` + `:1388` (inline, within the CHECK at `:1382-1389`) and `:1814` + `:1818-1819` (drop/add pair, within `:1813-1820`). `grep -n "error_code in ("` returns exactly these two sites |
| DD § Schema, `record_payment_settlement` — one statement | **Y** | `:1772-1778`: `expires_at = greatest(…) + make_interval(…)`, `period_anchor_at = now()`, `updated_at = now()` are three SET clauses of the **same** `on conflict … do update` statement |

### Refactor — fixture reconciliation (`SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts`)

These names cross PostgREST as strings, so `tsc` cannot see drift; reconciled by hand against the shipped DDL. **Result: no drift, no edit required.**

| Fixture element | Shipped DDL | Verdict |
|---|---|---|
| `FIXTURE_PERIOD_DAYS = 30` (`:182`) | `p_period_days integer default 30` (`schema.sql:1737`) | agree |
| `PaymentOrderRow` (`:216-228`), 11 fields | the 11 columns at `:1610-1648`, same names, same order | agree |
| `SubscriptionRow` (`:230-235`), 4 fields | `user_id, expires_at, period_anchor_at, updated_at` | agree |
| `payment_orders` insert keys (`:723-733`): 9 keys | omits only `created_at` (`not null default now()`, `:1625`) and `settled_at` (nullable, `:1631`); supplies every other `not null` column | legal |
| `subscriptions` upsert keys (`:742-749`): `user_id, expires_at, period_anchor_at`, `onConflict: "user_id"` | omits only `updated_at` (`not null default now()`, `:1690`); `onConflict` matches the PK at `:1680` | legal |
| `status` overrides comment "one of the four CHECK literals" (`:255`) | the four at `:1624` | agree |
| `FIXTURE_ORDER_CODE_BASE = 8_000_000_000_000` (`:192`) | `order_code bigint primary key` (`:1613`) | agree — the value exceeds int4, so `bigint` is load-bearing here |
| `FIXTURE_AMOUNT_VND = 39_000` (`:177`) | `amount integer not null check (amount > 0)` (`:1618`) | agree |

### Verification run (gate A only — no database touched)

- `npx vitest run lib/schema/__tests__/ lib/tutor/__tests__/telemetry.test.ts` → 4 files / **40 passed**, including `telemetry.test.ts:261` **unmodified**.
- `npm test` → 87 passed / 1 failed / 1 skipped file; **913 passed / 10 skipped**. The single failure is the documented flake `components/tutor/ExplainStepAffordance.test.tsx` (5000ms timeout under parallel load); re-run alone it is **5/5 passed in 2.62s**, restoring the 914/10 baseline.
- `npx tsc --noEmit` → 0 errors. `npm run lint` (`eslint --max-warnings 0`) → clean.
- `npm run verify:schema` **deliberately not run** — that is gate B and belongs to plan Task 1.3 (manual, engineer-owned apply). No database was touched and no deploy of this branch occurred.
