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
- [x] `SOURCE/supabase/test-rls.ts` (new Phần 8)

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
- [x] Read all Investigation Targets; list the exact table/function set plan Task 1.1 created and check it against the groups planned here (**must be equal**)
- [x] Write the denial assertions first and confirm each fails if the corresponding revoke/policy is (hypothetically) absent — assert on the **denial**, not on the call returning something
### 2. Green Phase
- [x] Run Phần 8 against dev; confirm all three groups pass
### 3. Refactor Phase
- [x] Confirm fixtures are prefix-scoped and torn down, so the block passes twice in a row

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
- [x] All added cases pass; three denial groups present (two tables + the function)
- [x] The asserted table set **equals** the table set plan Task 1.1 created
- [x] Each case asserts the *denial*, not merely that the call returned
- [x] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts`; downstream, plan Task 6.4 security review re-walks these results.
- Scope boundary: no schema edit here; no service-role path is exercised (that is plan Task 6.1).

## Investigation Notes

### Objects plan Task 1.1 created (read from `SOURCE/supabase/schema.sql:1604-1791`, cross-checked against the live dev catalog `hynwleaxtbtjzkvpjsug`)
1. `public.payment_orders` — 11 cols; NOT NULL on `amount, status, created_at, pending_until, qr_payload, account_number, account_name, memo`; `user_id` FK `on delete set null`; RLS on; policy `orders_select_own` (`for select to authenticated using (user_id = auth.uid())`); `revoke insert, update, delete … from anon, authenticated`; `revoke select … from anon`.
2. `public.subscriptions` — 4 cols (`user_id` PK FK `on delete cascade`, `expires_at`, `period_anchor_at`, `updated_at`); RLS on; policy `subscriptions_select_own`; same revokes.
3. `public.record_payment_settlement(bigint, integer)` — INVOKER, `revoke all … from public, anon, authenticated`, `grant execute … to service_role`.

**Set equality**: the asserted set = {`payment_orders`, `subscriptions`, `record_payment_settlement`} = the created set. Three groups, no fewer.

### Existing `test-rls.ts` conventions adopted (no new harness)
- `assert(cond, msg)` counter + `process.exit(failures === 0 ? 0 : 1)`; `admin` (service_role) for fixtures, `userA`/`userB` real password sessions from `signInAs()` for the assertions.
- Phased blocks with a `setup*Fixtures` / `cleanup*Fixtures` pair, cleanup run **before and after** for idempotency (Engine 1 / Support precedent).
- Error-class discrimination is the house idiom already: `MM-b` (`:1541`) refuses a bare `error !== null` and demands `42501`/`PGRST202`; `ST-d` (`:1710`) demands `42501` plus a service_role before/after row count; `TL-b` (`:1583`) demands the DB state, not just the returned error.
- **Numbering drift**: the task file says "new Phần 8", but `Phần 8` is already taken by the User Support System block (`test-rls.ts:1606`). The new block is therefore **Phần 9**. Naming detail only — the object set, the grouping and the assertions are unchanged.

### Adjacent case sweep
Not applicable: the task file declares no `Change Category`, and this is additive test coverage for freshly-created objects, not a bug-fix/regression/state-change/boundary-change.

### Binding Decisions — planned approach and per-row evaluation
- **Planned approach (persistence axis)**: the settlement denial is exercised as `userA.rpc("record_payment_settlement", { p_order_code: <A's own real, still-'pending' fixture order>, p_period_days: 30 })` — correctly-typed arguments naming a row that a *permitted* caller would actually settle — and is asserted as (a) an authorization-class error (`42501`, or `PGRST202` = PostgREST cannot see a function the role holds no EXECUTE on) **and** (b) a service_role byte-identical snapshot of both the order row and A's `subscriptions` row taken before and after, proving the function body never ran.
- Row 1 — `ADR-0014 (§ Implementation Guidance)` / persistence / "`revoke all on function … from public, anon, authenticated` by name" / "A student JWT `rpc(...)` call is denied, and the denial is asserted as a denial (not merely as 'returned something')" → **Y**. Rationale: the assertion is a conjunction of an authorization-class error code and an unchanged-state proof; a body-thrown error (`check_violation`) or a returned value both fail it, and a missing revoke would let the call succeed and mutate the two snapshots.

### Reference Contracts
Section absent from the task file — not applicable.

### How each denial case is kept from passing for the wrong reason
Every denied write is built by the **same builder function** (`buildFixtureOrderRow` / `buildFixtureSubscriptionRow`) that service_role uses to create the fixtures in the same run, and each insert-denial is immediately followed by a positive control in which service_role sends the **byte-identical payload** and is accepted. A `23502` (not-null), `23503` (FK), `23505` (unique) or `22P02` (bad literal) rejection therefore fails the block instead of greening it. `isAuthorizationDenial()` accepts only `42501` / an explicit row-level-security message and rejects every constraint class.

### Teardown proof uses a different predicate from the teardown itself (Task 0.8 finding)
`cleanupSubscriptionFixtures()` deletes `payment_orders` by **`order_code`** and `subscriptions` by **`user_id`**. The post-teardown assertion instead queries `payment_orders` by **`memo`** and `subscriptions` by **`period_anchor_at`** — both sentinel values carried by every fixture row — so a delete that silently matched nothing is caught rather than confirmed.

### Exit-gate evidence (re-evaluated against the final implementation, not the plan)
- **Block landed as `Phần 9`** in `SOURCE/supabase/test-rls.ts` — cases `PO-a…PO-e`, `SB-a…SB-e`, `PS-a`/`PS-b`. Three groups, one per object.
- **RED counterfactual (dev, scratch script, not committed)**: every operation the block asserts as denied was executed with service_role and **succeeded** — `insert`/`update`/`delete` on `payment_orders`, `insert`/`update`/`delete` on `subscriptions`, and `rpc("record_payment_settlement", {p_order_code: <the same order>, p_period_days: 30})`, which returned `3000-01-30T23:59:59+00:00` and mutated both rows (`status` → `'paid'`). This is the "if the revoke were absent" branch: it proves each denial is caused by authorization, not by payload, constraint or argument type.
- **GREEN (dev `hynwleaxtbtjzkvpjsug`, `cd SOURCE && npx tsx supabase/test-rls.ts`)**: exit 0, whole file green. All 16 new checks pass; **every** denial reported `42501` — `PO-c/PO-d/PO-e`, `SB-c/SB-d/SB-e` and `PS-b` alike, and `PS-b` additionally reported `đơn + entitlement còn nguyên: true`.
- **REFACTOR / idempotency**: a second consecutive full run is green with identical output; the post-teardown assertion reports `0 đơn / 0 entitlement`. An independent out-of-band service_role count confirms `payment_orders` = 0 rows and `subscriptions` = 0 rows on dev — no residue.
- **Binding Decisions row 1 → `Y`** (unchanged from the pre-implementation evaluation). Evidence: `PS-b` observed `42501`, and the byte-identical before/after snapshots of both the order row and A's `subscriptions` row prove the function body never executed. A missing `revoke` would have produced the RED-counterfactual outcome instead — a returned timestamp and two mutated rows — which the assertion rejects.
- **Gates**: `npx tsc --noEmit` 0 errors; `npx eslint . --max-warnings 0` clean; `npx vitest run` 962 passed / 10 skipped across 90 files (baseline preserved). No production deploy of this branch occurred; only dev was touched.

### Revision after integration-test-reviewer `needs_revision` (one required fix)

**The defect.** `PS-b` accepted `42501` **or** `PGRST202` **or** `/permission denied|could not find the function/i`, and the comment attributed `PGRST202` to "role không có EXECUTE". That attribution is false: PostgREST returns `PGRST202` for **any** function reference it cannot resolve. In the wrong-name world the case is not merely weaker, it is empty — the companion conjunct `psStateUntouched` is *trivially* satisfied because the body never ran on either branch, so `PS-b` would report a green authorisation denial while proving nothing about authorisation. It was also the only denial in the block with no positive control proving its callee reachable (`PO-c:2064` and `SB-c:2159` both have one; `PS-a` proves only the state precondition), and the earlier RED counterfactual lived in an uncommitted scratch script, so nothing in the committed suite protected it against a later rename.

**The fix applied (reviewer's preferred option, not the fallback).** A non-mutating service_role **callability control** now runs immediately before `PS-b`:
`admin.rpc("record_payment_settlement", { p_order_code: SUB_ORDER_FORGED, p_period_days: 30 })`, asserted as `!error && data === null`.
It mutates nothing by construction: `SUB_ORDER_FORGED` was deleted at `:2069`, so `update … where order_code = … and status = 'pending'` matches zero rows, the function takes its `if not found then return null` branch and stops **before** the `insert into subscriptions`. `data === null` is itself the evidence that branch ran — the same observation proves the function is callable *and* that it wrote nothing. `psDeniedByPermission` is left intact (still accepting `PGRST202`), because the control is what makes that disjunct mean something; the comment now says so explicitly instead of claiming `PGRST202` implies a missing grant.

**Counterfactual proving the control discriminates** (dev, scratch script, run then deleted — its role is one-off evidence, the *committed* protection is the control itself):

| service_role call | result |
|---|---|
| `record_payment_settlement_RENAMED` (wrong function name) | `PGRST202`, `data: null` |
| `record_payment_settlement` with `p_order_code_RENAMED` (wrong param name) | `PGRST202`, `data: null` |
| `record_payment_settlement` with the real name + params | no error, `data: null` |

So under a rename the control's `!error` conjunct fails and the suite goes **red**, where previously `PS-b` would have swallowed the same `PGRST202` and greened. Note the control's discriminating conjunct is `!error`, not `data === null` — `data` is `null` on the error rows too.

**Optional items — both applied** (cheap, same file, same block, no new harness):
- `PO-f` and `SB-g`: the **anon** role is denied `select` on both tables, closing the gap where `schema.sql:1668-1669` / `:1697-1698` shipped `revoke select … from anon` untested. Asserted with `isAuthorizationDenial` rather than TL-a's softer `error !== null || 0 rows`, because the failure mode here is **silent**: `orders_select_own` / `subscriptions_select_own` are declared `to authenticated`, so if the revoke were dropped, anon would fall through to "RLS on, no policy matches" and receive **0 rows** — indistinguishable from safety. Both observed `42501`.
- `SB-f`: A reads its **own** `subscriptions` row, the `PO-a` symmetry the `SB` group lacked (`SB-a` covers only B). Placed after `SB-e` because A has no row until the `SB-c` positive control creates one and `SB-e` has just proved it byte-intact. Without it, a policy that hid *everyone's* row would leave `SB-b`/`SB-d`/`SB-e` green.

**A real assumption this caught.** `SB-f` first compared `period_anchor_at` to `SUB_ANCHOR_SENTINEL` by string and **failed**: Postgres returns `2099-01-02T03:04:05+00:00`, not the file's `…​.000Z`. Fixed by comparing `new Date(v).toISOString()` — the sentinel check is retained (it proves A read the *fixture* row, not a stray one), only the representation assumption dropped. The teardown predicate `.eq("period_anchor_at", SENTINEL)` is unaffected: there Postgres parses the literal server-side.

**Re-verification (dev `hynwleaxtbtjzkvpjsug`; prod `pebjdlbgbmizgfpuptjl` never contacted — URL confirmed from `.env.local` before running).**
- `cd SOURCE && npx tsx supabase/test-rls.ts` → **exit 0, whole file green, 20 checks in `Phần 9`**. Every denial reported `42501`; the new control reported `data=null`; `PS-b` still reports `42501` + `đơn + entitlement còn nguyên: true`.
- **Idempotency**: two consecutive full runs green with **byte-identical** `Phần 9` output (`diff` clean); post-teardown assertion reports `0 đơn / 0 entitlement`. An independent out-of-band service_role `count: "exact"` confirms `payment_orders` = **0** rows and `subscriptions` = **0** rows on dev — no residue, and both scratch scripts were deleted (`git status` shows only the three intended files).
- **Gates**: `npx tsc --noEmit` 0; `npx eslint . --max-warnings 0` clean; `npx vitest run` **962 passed / 10 skipped across 90 files** — baseline exactly preserved (this block does not run under vitest).
- **Binding Decisions row 1 → `Y`, re-evaluated against the final implementation.** The ADR-0014 check ("a student JWT `rpc(...)` call is denied, and the denial is asserted as a denial") is now strictly stronger than at first landing: the accepted error set is unchanged, but the `PGRST202` disjunct can no longer be satisfied by an unresolvable reference, because service_role resolved that exact name and parameter set moments earlier in the same run.
