# Task: service-integration-e2e SVC-2 — `recheckOrder()` is owner-scoped

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.2**
Layer: **backend** (`SOURCE/tests/e2e/service/**` against real Postgres)

Metadata:
- Dependencies: backend-task-07 (two-session fixture), backend-task-18 (`recheckOrder`), backend-task-11 (gate B on dev)
- Provides: **the gate FE-B-02 escalation condition names — S-05 must not reach real users until this passes**
- Size: Small (1 test file)

## Implementation Content

**Two real sessions against one database** — a mocked Supabase client would assert the mock `null`, not the policy.

Include the **control** case (user A settles their own order) **in the same run**, so a globally-broken action that refuses everything cannot pass by refusing correctly for the wrong reason.

Then:
- user B with A `orderCode` ⇒ `unknown_order`;
- user B with a code nobody owns ⇒ `unknown_order`;
- **deep equality** between those two results — one assertion over the whole value, no field excluded (asserting each equals `unknown_order` independently is weaker, since it passes if one branch carries an extra field);
- **exactly 0** payOS adapter invocations asserted **separately for each branch**;
- **zero writes** — A `payment_orders` row **byte-identical** before and after, no new `subscriptions` row for either user;
- **no log line** during either refusal containing the owner, an amount, an account number or a memo.

## Target Files
- [ ] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-2 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (plan Task 0.8 — the two-session fixture and the counted adapter stub)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — `recheckOrder()` ownership branch, `.maybeSingle()`)
- `SOURCE/supabase/schema.sql` (`orders_select_own`)
- `SOURCE/lib/supabase/server.ts` (the request-scoped client under which the policy applies)
- `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping)
- `docs/design/subscription-backend-design.md` (§ Third verification point)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping) | state-lifecycle-negative | `recheckOrder(orderCode)` resolves `{ settled: false, reason: "unknown_order" }` for an `orderCode` that does not exist **and** for one that exists but whose `user_id` is not the caller. The two are **byte-identical**: the same value, from the same branch, with the same side effects (none), the same number of provider calls (zero) and the same number of writes (zero) | One deep-equality assertion over the two whole results passes, with adapter count 0 and write count 0 asserted separately per branch |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record SVC-2 annotation block verbatim
- [ ] Write the control case **first**, then the two refusal branches and the deep equality; confirm each fails against a deliberately un-scoped read
### 2. Green Phase
- [ ] Execute under `npm run test:localdb` against dev; all cases green
### 3. Refactor Phase
- [ ] Re-run twice in a row to confirm teardown idempotency

## Quality Assurance Mechanisms
- Real-Postgres integration tests — Enforces: RLS visibility under two distinct sessions — Config: `SOURCE/vitest.localdb.config.ts`
- `SOURCE/supabase/test-rls.ts` — Enforces: the cross-user read denial these results depend on

## Operation Verification Methods
- **Verification method**: two real authenticated sessions against one database, with only the payOS adapter stubbed and counted.
- **Success criteria**: the control case settles; both refusals are deeply equal; adapter invocations **0** on each branch; A row byte-identical before and after; no new `subscriptions` row; no owner/amount/account/memo in any log line.
- **Failure response**: **S-05 must not reach real users until this passes** (FE-B-02 escalation condition). If it fails, hold the deploy rather than shipping the screen.
- **Verification level**: L1.

## Proof Obligations
- **Claim**: a foreign order and a nonexistent order are indistinguishable in value, in cost and in side effects.
- **Primary failure mode**: an enumeration oracle — a caller can confirm that another user order exists, by value, by an extra field, by a provider-call latency difference, or by a log line.
- **Boundary to exercise**: the real dev Postgres under `orders_select_own`, through **two distinct authenticated sessions**.
- **State assertion**: A `payment_orders` row read before and after each refusal and compared **byte-identical**; `subscriptions` row count unchanged for both users.
- **Mock boundary rationale**: only the payOS adapter is stubbed and counted; the Supabase client and RLS are real, because the policy is the mechanism under test.
- **Residual**: none for ownership scoping; the rendered refusal copy is proven by plan Task 3.7 / FE-3.

## Completion Criteria
- [ ] All SVC-2 cases green, including the control case in the same run
- [ ] One deep-equality assertion over the two whole refusal values
- [ ] Adapter invocation count 0 asserted **separately per branch**; zero writes proven by byte-identical before/after row
- [ ] No log line contains the owner, an amount, an account number or a memo
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Test-case resolution: **service-integration-e2e 2/2 — lane complete**
- [ ] **Gate recorded**: S-05 is not reachable by real users until this task is green

## Notes
- Impact scope: test only.
- Scope boundary: no mocked Supabase client; two real sessions are required.

## Investigation Notes
(Record the two session identities, the deep-equality result, and the byte-comparison of A row here.)
