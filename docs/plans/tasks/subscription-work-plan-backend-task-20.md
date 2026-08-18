# Task: Webhook route + `PUBLIC_PATHS` admission + bundle-scan markers

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.1**
Layer: **backend** (`SOURCE/app/api/**`, `SOURCE/lib/supabase/middleware.ts`, `SOURCE/scripts/**`)

Metadata:
- Dependencies: backend-task-16 (plan Task 3.2 — `settleOrder`), backend-task-15 (adapter signature verification)
- Provides: ADR-0014 first settlement trigger
- Size: Small (3 files + test)

`Change Category: boundary-change`

This admits the **first unauthenticated write path** in the project and consumes an external provider contract. Sweep the adjacent cases sharing that boundary — every existing `PUBLIC_PATHS` entry in `SOURCE/lib/supabase/middleware.ts`, and every marker in `SOURCE/scripts/check-ai-key-bundle.mjs` — for the same class of defect: an unauthenticated path admitted without a reason comment, or a server-only secret with no bundle marker.

## Implementation Content

**`SOURCE/app/api/payments/payos/webhook/route.ts`** — the thin shell:
read raw body → `verifyWebhookSignature` (invalid ⇒ log a **structured reason code**, return **200**, **zero I/O**) → `settleOrder(data.orderCode)` → return 200.

- **200 for every decision reached**; non-2xx reserved for genuine internal faults ("we failed and a retry might work").
- **Nothing but `orderCode` is read from the payload for decision-making**, and the payload **never reaches a log**.

**`SOURCE/lib/supabase/middleware.ts`** — add **one** `PUBLIC_PATHS` entry with a **reason comment at the entry**, following `auth/callback/route.ts` convention. This moves unauthenticated **write** paths **0 → 1** (ADR-0017 guarded number).

**`SOURCE/scripts/check-ai-key-bundle.mjs`** — extend with the payOS secret markers and the `record_payment_settlement` marker.

## Target Files
- [ ] `SOURCE/app/api/payments/payos/webhook/route.ts` (new)
- [ ] `SOURCE/lib/supabase/middleware.ts` (one `PUBLIC_PATHS` entry + reason comment)
- [ ] `SOURCE/scripts/check-ai-key-bundle.mjs` (payOS secret markers + `record_payment_settlement` marker)
- [ ] `SOURCE/app/api/payments/payos/webhook/__tests__/route.test.ts` (new)

## Investigation Targets
- `SOURCE/lib/supabase/middleware.ts` (the `PUBLIC_PATHS` array and the `auth/callback/route.ts` reason-comment convention) — **adjacent case for the boundary sweep**
- `SOURCE/scripts/check-ai-key-bundle.mjs` (existing marker list and how it scans `.next/**`) — **adjacent case for the boundary sweep**
- `SOURCE/lib/billing/payos/` (plan Task 3.1 — `verifyWebhookSignature(rawBody: string)` returning `null` rather than throwing)
- `SOURCE/lib/billing/settleOrder.ts` (plan Task 3.2 — the single-parameter signature)
- `docs/design/subscription-backend-design.md` (§ Design — webhook route)
- `docs/design/subscription-backend-design.md` (§ Integration Point I4)
- `docs/design/subscription-backend-design.md` (§ Integration Point I8)
- `docs/design/subscription-backend-design.md` (§ Logging / AC-034)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Architecture Impact)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | data_flow | A single `settleOrder(orderCode)` is the only code path that can extend entitlement, invoked from exactly two triggers, and it always re-verifies against `GET /v2/payment-requests/{id}` before writing. **No caller can pass an amount, a status, or a user id into it — only an `orderCode`** | The route calls `settleOrder(orderCode)` with one argument and performs no entitlement write of its own |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | data_flow | "Never read `amount`, `status`, or any user identifier from the webhook payload for decision-making. Read `orderCode`, and nothing else" | The handler reads only `data.orderCode` from the payload; no other payload field influences a decision or reaches a log |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Implementation Guidance) | contract_schema | "Return 200 for every decision the endpoint reaches, including refusals. Reserve non-2xx for 'we failed and a retry might work'" | Every reached decision, including an invalid signature, returns HTTP 200 |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Architecture Impact) | placement | One new unauthenticated route handler admitted to `PUBLIC_PATHS` with a reason comment; unauthenticated **write**-path count 0 → 1 (ADR-0017 guarded number) | `PUBLIC_PATHS` gains exactly one entry, carrying a reason comment at the entry, and the unauthenticated write-path count is exactly 1 |

## Boundary Context (from the plan Connection Map)

**Boundary — payOS → webhook route handler.**
- Owners: payOS (external service) ↔ `SOURCE/app/api/payments/payos/webhook/route.ts`.
- **Serialized Format**: raw JSON body + a `signature` field, HMAC-SHA256 over the alphabetically key-sorted `key=value&…` serialisation of `data`.
- **Consumer Parse Rule**: HMAC verified over the **raw body bytes**, never over re-serialised parsed JSON; only `data.orderCode` is read for decisions.
- **Expected Signal**: signature valid ⇒ `settleOrder(orderCode)` is called **exactly once**. Invalid/absent signature ⇒ HTTP 200, **zero I/O**, one structured reason code logged.
- **Roundtrip check**: the bytes payOS signed are the bytes the handler verifies — read the body as text **before** any JSON parse, and never re-serialise it for verification.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets; record the existing `PUBLIC_PATHS` entries and classify each as read or write
- [ ] **Boundary sweep**: confirm every existing `PUBLIC_PATHS` entry carries a reason comment; confirm the current unauthenticated **write**-path count is **0**
- [ ] Write failing tests first, asserting **counts**: bad/missing signature ⇒ zero data changes and zero outbound calls; valid signature ⇒ `settleOrder` invoked exactly once
### 2. Green Phase
- [ ] Implement the route, the `PUBLIC_PATHS` entry with its reason comment, and the bundle markers; run only the added tests
### 3. Refactor Phase
- [ ] Run `npm run build` then `npm run check:bundle` and confirm the new markers are exercised

## Quality Assurance Mechanisms
- `npm run check:bundle` -> `node scripts/check-ai-key-bundle.mjs` (**separate script, not part of `verify:schema`**) — Enforces: server-only secrets appearing in client bundle output — Config: `SOURCE/package.json:12`, `SOURCE/scripts/check-ai-key-bundle.mjs` — extended here with payOS secret markers + the `record_payment_settlement` marker
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests over the route handler with `verifyWebhookSignature` and `settleOrder` mocked and **counted**; plus `npm run build` followed by `npm run check:bundle`.
- **Success criteria**: an invalid or absent signature returns 200 with **zero** data change and **zero** outbound calls; a valid signature invokes `settleOrder` exactly once; unauthenticated write paths = **exactly 1**; `npm run check:bundle` green with the new markers.
- **Failure response**: if a second unauthenticated path was admitted, remove it — the count is guarded by ADR-0017 and asserted here.
- **Verification level**: L2. L1 (a genuine payOS delivery against the production domain) is plan Task 6.7, gated on BU-1.

## Proof Obligations
- **Claim (AC-030)**: a bad or missing signature causes **zero** data change and **zero** outbound calls.
- **Primary failure mode**: the test asserts the response code only, while the handler has already called the provider or written a row — the "asserting that a call happened, not what went through it" shape.
- **Boundary to exercise**: the HTTP route handler, with the adapter and `settleOrder` mocked and counted.
- **State assertion**: before — no settlement recorded; action — POST with a tampered signature; after — settlement call count **0**, outbound call count **0**, response **200**.
- **Mock boundary rationale**: signature verification and `settleOrder` are mocked to isolate the shell; the raw-body reading path stays real, since it is the behaviour under test.
- **Residual**: verification against a **genuine** payOS delivery is only reachable in plan Task 6.7.

- **Claim (AC-032)**: unauthenticated **write** paths go 0 → 1, and **exactly** 1.
- **Primary failure mode**: a second path is admitted in the same change and nothing counts them.
- **Boundary to exercise**: `PUBLIC_PATHS` in `SOURCE/lib/supabase/middleware.ts`, asserted by count.
- **State assertion**: count before = 0 write paths; after = 1, with a reason comment at the entry.
- **Mock boundary rationale**: none — the array is read directly.
- **Residual**: plan Task 6.4 security review re-walks this end to end.

- **Claim (AC-034)**: no raw payload and no bank identifier appears in any log line.
- **Primary failure mode**: a debug log of the parsed body ships, putting an account number into log storage.
- **Boundary to exercise**: the handler logging calls, captured by a spy.
- **State assertion**: N/A.
- **Mock boundary rationale**: the logger is spied, not replaced in behaviour.
- **Residual**: the storage half of P-1 is enforced by the plan Task 1.2 allowlist assertion; the end-to-end confirmation is plan Task 6.4.

## Completion Criteria
- [ ] All added tests pass, asserting **counts** rather than occurrence
- [ ] Unauthenticated **write** paths = exactly 1, with a reason comment at the entry
- [ ] `npm run check:bundle` green with the new payOS markers and the `record_payment_settlement` marker
- [ ] Every Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred** — this code admits the webhook path and reads `payment_orders`, and prod has neither table until plan Task 5.8

## Notes
- Impact scope: new route directory; `SOURCE/lib/supabase/middleware.ts`; `SOURCE/scripts/check-ai-key-bundle.mjs`.
- Scope boundary: `SOURCE/lib/security/csp.ts` is frozen — no CSP change is made or authorised; `SOURCE/lib/billing/settleOrder.ts` signature is unchanged.
- Webhook **registration** against the production domain is plan Task 6.7, not this task.

## Investigation Notes
(Record the boundary sweep, the before/after write-path count, and each Compliance Check result here.)
