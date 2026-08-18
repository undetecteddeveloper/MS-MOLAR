# Task: `test-rls.ts` Phần 8 — one denial block per table plan Task 1.1 creates

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.5**
Layer: **backend** (`SOURCE/supabase/**`)

Metadata:
- Dependencies: backend-task-11 (plan Task 1.3 — gate B green on dev; these cases run against the live dev database)
- Provides: RLS denial coverage for both new tables and the settlement function — re-walked in plan Task 6.4
- Size: Small (1 file)

## Implementation Content

Plan Task 1.1 creates **two tables and one function**, so Phần 8 carries **three denial groups and no fewer**. Follow the existing fixture-prefix + phased-block pattern (mirrors Engine 1 `MM-a` / `MM-b`). With a **student JWT**, assert that the caller:

- cannot `insert` / `update` / `delete` **`payment_orders`**;
- cannot `insert` / `update` / `delete` **`subscriptions`**;
- cannot read **another user** rows in **either** table;
- cannot `rpc("record_payment_settlement", …)` — permission denied (AC-033).

**Coverage rule, checkable**: the set of tables asserted here must **equal** the set of tables plan Task 1.1 DDL creates. If a future apply adds a table — the BU-6 usage sink being the known candidate — it ships with its own denial group **in the same change, never after**.

## Target Files
- [ ] `SOURCE/supabase/test-rls.ts` (new Phần 8)

## Investigation Targets
- `SOURCE/supabase/test-rls.ts` (the existing Phần structure, the fixture-prefix convention, and how a student JWT session is created)
- `SOURCE/supabase/schema.sql` (the `orders_select_own` and `subscriptions_select_own` policies, the explicit revokes, and the `record_payment_settlement` grant set written by plan Task 1.1)
- `SOURCE/lib/supabase/service-role.ts` (the only client that is *allowed* to reach the function — the contrast case)
- `docs/design/subscription-backend-design.md` (§ Schema)
- `docs/design/subscription-backend-design.md` (§ Security Considerations)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | persistence | "`revoke all on function … from public, anon, authenticated` **by name**, every time, on the new function" | A student JWT `rpc("record_payment_settlement", …)` call is denied, and the denial is asserted as a denial (not merely as "returned something") |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; list the exact table/function set plan Task 1.1 created and check it against the groups planned here (**must be equal**)
- [ ] Write the denial assertions first and confirm each fails if the corresponding revoke/policy is (hypothetically) absent — assert on the **denial**, not on the call returning something
### 2. Green Phase
- [ ] Run Phần 8 against dev; confirm all three groups pass
### 3. Refactor Phase
- [ ] Confirm fixtures are prefix-scoped and torn down, so the block passes twice in a row

## Quality Assurance Mechanisms
- `SOURCE/supabase/test-rls.ts` — Enforces: RLS policies actually scope reads/writes on the new tables — Config: `SOURCE/supabase/test-rls.ts` (new Phần 8) — Covered: `public.payment_orders`, `public.subscriptions`, `public.record_payment_settlement`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: execute `SOURCE/supabase/test-rls.ts` against the **dev** database (gate B green) with a real student JWT; read each group result.
- **Success criteria**: **`test-rls.ts` Phần 8 passes, with one denial group per table plan Task 1.1 created (two tables + the function ⇒ three groups)**; each write and each cross-user read is denied; the RPC is permission-denied.
- **Failure response**: if any write or cross-user read succeeds, **stop the phase** — a client write path to a money table is not a defect to work around.
- **Verification level**: L1 (the policy is exercised against the live database as a real caller would).

## Proof Obligations
- **Claim**: no client-side identity can write either new table or execute the settlement function, and cannot read another user rows.
- **Primary failure mode**: a test that asserts the call **returned something** rather than that it was **denied** — the revoke-by-name discipline is what these cases prove, and a soft assertion passes even when the revoke is missing.
- **Boundary to exercise**: the live dev Postgres, through a real request-scoped client carrying a **student JWT** (no service-role client, no mock).
- **State assertion**: before — the other user row exists and is untouched; action — attempted insert/update/delete/select/rpc; after — **row byte-identical**, no new row, error surfaced as a denial.
- **Mock boundary rationale**: none. A mocked Supabase client would assert the mock, not the policy.
- **Residual**: covers only the objects plan Task 1.1 created. The BU-6 usage sink has **no** denial group because it has no design; when its DD revision lands, its group ships in the same change as its DDL.

## Completion Criteria
- [ ] All added cases pass; three denial groups present (two tables + the function)
- [ ] The asserted table set **equals** the table set plan Task 1.1 created
- [ ] Each case asserts the *denial*, not merely that the call returned
- [ ] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts`; downstream, plan Task 6.4 security review re-walks these results.
- Scope boundary: no schema edit here; no service-role path is exercised (that is plan Task 6.1).
