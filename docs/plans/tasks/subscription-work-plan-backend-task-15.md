# Task: payOS adapter (`SOURCE/lib/billing/payos/`)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.1**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: backend-task-11 (gate B green on dev), backend-task-12 (`pricing.ts` constants)
- Provides: the only module that may speak payOS — consumed by plan Tasks 3.2, 3.4, 4.1
- Size: Small (2–3 files in one new directory + tests)

## Implementation Content

Hand-rolled, **no SDK** (three endpoints and one HMAC on the money path; ADR-0013 names SePay as a migration target and an adapter written to *our* interface swaps more cleanly).

- `verifyWebhookSignature(rawBody: string)` takes the **raw body string**, not a parsed object — re-serialising parsed JSON can reorder or renormalise values and break an HMAC computed over the wire bytes — and **returns `null` rather than throwing**, so the route rejection path is a branch.
- `getPaymentStatus(orderCode)` narrows to `"pending" | "paid" | "cancelled" | "unknown"`, and its return object carries **exactly two properties** (`status`, `amount`).
- `createPaymentRequest(o)` returns `{ qrPayload, accountNumber, accountName, memo, orderCode, amount, expiresAt }`, translating provider words **at the boundary**: `qrCode` → `qrPayload`, `description` → `memo`.
- Provider vocabulary — `orderCode`-as-payOS-concept, checksum keys, `PENDING` / `SUCCEEDED` / `CANCELLED` — **does not escape this directory**.
- Note the provider one-`l` spelling `canceledAt`; **do not "correct" it.**

## Target Files
- [ ] `SOURCE/lib/billing/payos/index.ts` (or the equivalent entry the directory convention dictates)
- [ ] `SOURCE/lib/billing/payos/signature.ts` (`verifyWebhookSignature`)
- [ ] `SOURCE/lib/billing/payos/__tests__/` (signature fixtures + adapter-boundary tests)

## Investigation Targets
- `SOURCE/lib/billing/pricing.ts` (`ORDER_PENDING_WINDOW_MS` — the constant that sets `expiredAt` on the create request)
- `SOURCE/lib/env/checkEnv.ts` (the three payOS credential branches registered in plan Task 1.4)
- `SOURCE/lib/tutor/callTutor.ts` (an existing hand-rolled external-service call in this repository — the fetch/error-shape convention to follow)
- `SOURCE/lib/billing/types.ts` (**frozen** — confirm nothing from the provider leaks into it)
- `docs/design/subscription-backend-design.md` (§ Design — adapter)
- `docs/design/subscription-backend-design.md` (§ Security / P-1)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Architecture Impact) | placement | "One provider boundary, and everything provider-specific behind it. `orderCode`, `checksum key`, signature format, `expiredAt`, and the `PENDING`/`SUCCEEDED`/`CANCELLED` vocabulary belong inside a single payOS adapter module. Nothing above that line … may reference a payOS type" | All payOS vocabulary and credentials are confined to `SOURCE/lib/billing/payos/**`, and no module outside that directory references a payOS type |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1) | state-lifecycle-negative | **P-1 (normative).** No field of the provider `transactions[]` may be persisted to any column or reach any log. `settleOrder()` reads exactly **two** values from the provider response — the order `status` and its `amount` | `getPaymentStatus()` return value has **exactly two** own properties, `status` and `amount`, asserted in test |

## Boundary Context (from the plan Connection Map)

**Boundary — webhook route / `recheckOrder()` → payOS status query.**
- Owners: `SOURCE/lib/billing/settleOrder.ts` ↔ payOS `GET /v2/payment-requests/{id}` via `SOURCE/lib/billing/payos/`.
- **Expected Signal**: `getPaymentStatus()` returns a value narrowed to `"pending" | "paid" | "cancelled" | "unknown"`, and its return object carries **exactly two properties** (`status`, `amount`) — P-1.

**Boundary — `createOrder()` → payOS create request.**
- Owners: `SOURCE/lib/billing/orderActions.ts` ↔ payOS `POST /v2/payment-requests` via `SOURCE/lib/billing/payos/`.
- **Serialized Format**: the request carries `expiredAt` derived from the **same** `ORDER_PENDING_WINDOW_MS` constant that sets `payment_orders.pending_until`.
- **Consumer Parse Rule**: response fields translated at the boundary — `qrCode` → `qrPayload`, `description` → `memo`.
- **Expected Signal**: provider-first ordering — on adapter failure **no `payment_orders` row exists**; on success the row carries the four returned values verbatim. (The row-count half is asserted in plan Task 3.4; this task owns the translation half.)
- **Roundtrip check**: the `expiredAt` this adapter sends and the `pending_until` the row stores are derived from one constant, so they are the same instant.

**Boundary — payOS → webhook route handler** (signature half, consumed by plan Task 4.1).
- **Serialized Format**: raw JSON body + a `signature` field, HMAC-SHA256 over the alphabetically key-sorted `key=value&…` serialisation of `data`.
- **Consumer Parse Rule**: HMAC verified over the **raw body bytes**, never over re-serialised parsed JSON; only `data.orderCode` is read for decisions.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the exact HMAC input construction from the provider documentation
- [ ] Write failing tests first: signature verification against **literal fixtures**, including a **tampered-field negative**; a `getPaymentStatus()` case asserting the return object has exactly two own properties; a `createPaymentRequest()` case asserting `qrCode`→`qrPayload` and `description`→`memo`
### 2. Green Phase
- [ ] Implement the three functions; run only the added tests
### 3. Refactor Phase
- [ ] Grep outside `SOURCE/lib/billing/payos/**` for payOS vocabulary and confirm zero hits

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the adapter-boundary unit tests — Config: `SOURCE/package.json:10`
- `npm run check:bundle` -> `node scripts/check-ai-key-bundle.mjs` (**separate script, not part of `verify:schema`**) — Enforces: server-only secrets appearing in client bundle output — Config: `SOURCE/package.json:12` (markers added in plan Task 4.1)
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests with the HTTP boundary mocked, driven by **literal** request/response fixtures; plus a source scan for payOS vocabulary outside the adapter directory.
- **Success criteria**: signature verification passes on a genuine fixture and **fails on a tampered field**; `getPaymentStatus()` returns exactly `{ status, amount }`; provider words are translated at the boundary; zero payOS references outside `SOURCE/lib/billing/payos/**`.
- **Failure response**: if the HMAC is computed over re-serialised JSON, **stop and rewrite against the raw body bytes** — a signature that verifies only for values that survive a JSON round trip fails against real deliveries.
- **Verification level**: L2. L1 for signature verification is only reachable via one real payOS delivery (plan Task 6.7, gated on BU-1).

## Proof Obligations
- **Claim**: a tampered webhook body does not verify, and nothing beyond `status` and `amount` crosses the provider boundary.
- **Primary failure mode**: the signature check passes on a body whose field was modified (HMAC computed over parsed-and-re-serialised JSON); or the adapter returns the whole provider payload, letting `transactions[]` reach a caller, a column or a log.
- **Boundary to exercise**: the adapter public functions with the HTTP client mocked — the provider boundary itself.
- **State assertion**: N/A (the adapter writes nothing).
- **Mock boundary rationale**: the HTTP client is external I/O and is mocked; the HMAC computation stays real, because it is the behaviour under test.
- **Residual**: P-1 is held **by construction** here (exactly two properties). Its persistence half is proven by the plan Task 1.2 allowlist assertion and the end-to-end review in plan Task 6.4. Real-delivery signature verification is plan Task 6.7.

## Completion Criteria
- [ ] All added tests pass, including the tampered-field negative
- [ ] `getPaymentStatus()` return object asserted to have exactly two properties
- [ ] Provider vocabulary confined to `SOURCE/lib/billing/payos/**` (source scan, zero external hits)
- [ ] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] The Reference Contracts Compliance Check evaluates to `Y`
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: new directory `SOURCE/lib/billing/payos/`; downstream, plan Tasks 3.2, 3.4, 4.1.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; no SDK dependency is added (a new dependency in this repository requires an ADR — precedent ADR-0009).
- The provider one-`l` `canceledAt` spelling is preserved deliberately.

## Investigation Notes
(Record the HMAC input construction, the fixture values used, and each Compliance Check result here.)
