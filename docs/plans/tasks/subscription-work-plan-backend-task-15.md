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
- [x] `SOURCE/lib/billing/payos/index.ts` (or the equivalent entry the directory convention dictates)
- [x] `SOURCE/lib/billing/payos/signature.ts` (`verifyWebhookSignature`)
- [x] `SOURCE/lib/billing/payos/__tests__/` (signature fixtures + adapter-boundary tests)

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
- [x] Read all Investigation Targets and record the exact HMAC input construction from the provider documentation
- [x] Write failing tests first: signature verification against **literal fixtures**, including a **tampered-field negative**; a `getPaymentStatus()` case asserting the return object has exactly two own properties; a `createPaymentRequest()` case asserting `qrCode`→`qrPayload` and `description`→`memo`
### 2. Green Phase
- [x] Implement the three functions; run only the added tests
### 3. Refactor Phase
- [x] Grep outside `SOURCE/lib/billing/payos/**` for payOS vocabulary and confirm zero hits
- [x] After exporting the real `getPaymentStatus()`, replace the transcribed `FixturePaymentStatusResult` declaration in `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` with a compile-time link to its return type (e.g. `type FixturePaymentStatusResult = Awaited<ReturnType<typeof getPaymentStatus>>;`) — until that link exists, service-lane fixture drift against the adapter's return shape is silent, and the two-property shape (P-1) is the exact thing that drifts

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
- [x] All added tests pass, including the tampered-field negative
- [x] `getPaymentStatus()` return object asserted to have exactly two properties
- [x] Provider vocabulary confined to `SOURCE/lib/billing/payos/**` (source scan, zero external hits)
- [x] The Binding Decisions Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] The Reference Contracts Compliance Check evaluates to `Y`
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: new directory `SOURCE/lib/billing/payos/`; downstream, plan Tasks 3.2, 3.4, 4.1.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen; no SDK dependency is added (a new dependency in this repository requires an ADR — precedent ADR-0009).
- The provider one-`l` `canceledAt` spelling is preserved deliberately.

## Investigation Notes

### Investigation Targets — what each one settled

- `SOURCE/lib/billing/pricing.ts` — `ORDER_PENDING_WINDOW_MS = 30 * 60 * 1000`, with the ADR-0013 quote in its docblock naming three consumers. The adapter is consumer (2); it imports the constant and never restates the number.
- `SOURCE/lib/env/checkEnv.ts:166-192` — the three payOS credential branches (`PAYOS_CLIENT_ID`, `PAYOS_API_KEY`, `PAYOS_CHECKSUM_KEY`), all `warn`. The adapter reads exactly these three names, at call time (never at module load), so `checkEnv`'s startup report and the adapter cannot disagree about what is configured.
- `SOURCE/lib/tutor/callTutor.ts` — the repository's existing hand-rolled external-service call. Adopted verbatim in shape: a typed error class whose `message` carries only a `site` constant declared in the same file, a `logXExit(site, detail)` helper that logs safe server-side metadata only, and classification of failure at the call site rather than at the caller. Not adopted: the SDK retry/deadline plumbing (payOS has no SDK; the deadline comes from `AbortSignal.timeout`).
- `SOURCE/lib/billing/types.ts` — read, **not touched**. It is frozen and nothing provider-shaped reaches it: the adapter exports its own `PaymentStatus`, `OrderDraft` and `PaymentRequestResult`, and imports nothing from `types.ts`.
- Backend DD § Design — adapter (`:789-813`) — the three declared signatures. Followed exactly, with one concretisation recorded below.
- Backend DD § Sensitivity / P-1 (`:697`) and ADR-0013 § Architecture Impact (`:158`) — the two normative constraints this task is measured against.

### The HMAC input construction, and where it comes from

**Construction implemented** (`signature.ts`, one function `toSignedString()` used by both the verify path and the sign path):

```
HMAC-SHA256( checksumKey,
             join("&", sortAlphabetically(keys(data)).map(k => `${k}=${serialise(data[k])}`) ) )
  -> hex digest
```

with `serialise`: `null`/`undefined` -> `""` (the key still appears); string -> verbatim, **no URL-encoding**; object/array -> `JSON.stringify`; anything else -> `String(v)`.

**Source, quoted.** Three in-repo statements agree, and are the authority used:

- Backend DD § Data Contracts, `payOS → webhook route` row: *"raw JSON body + `signature` over sorted `key=value&…` of `data`"*.
- ADR-0014 `:16`: *"signed HMAC-SHA256 over the alphabetically key-sorted `key=value&…` serialisation of the payload's `data` object, using a rotatable per-integration **checksum key**"*.
- `docs/project-context/external-resources.md` § Payment Gateway: *"Webhooks are signed HMAC-SHA256 over the alphabetically key-sorted `key=value&…` serialisation, keyed by a rotatable per-integration **checksum key**."*

**The tension inside that DD row, and how it was resolved.** The same Connection Map row states a Serialized Format (sorted `key=value` of `data`) and a Consumer Parse Rule (*"HMAC verified over the raw body bytes, never over re-serialised parsed JSON"*). Both cannot be literally true: digesting the body bytes rejects every genuine delivery, because the provider signs the canonical `key=value` string. What the second clause actually forbids is the defect it names — **digesting `JSON.stringify(JSON.parse(rawBody))`**, a whole-body re-serialisation that can reorder keys and renormalise numbers and escapes, and therefore verifies only for values that survive a JSON round trip (green in a test, red on the wire). The implementation honours the operative constraint: `rawBody: string` is the input, the adapter parses **once** and never re-serialises the body, and the digest is taken over the provider's published canonicalisation of `data` alone. Recorded here rather than resolved silently; mutation M1 below is the guard that keeps the forbidden construction out.

### Fixture values, and how each expected digest was produced

Checksum key used in every fixture (not a real key of any environment):
`b5c3f1a9e7d2b4a6c8e0f2a4b6c8d0e2f4a6b8c0d2e4f6a8b0c2d4e6f8a0b2c4`

Every expected digest was produced **outside this project**, by piping a hand-typed canonical string into `openssl dgst -sha256 -hmac <key>`. No expected value is an output of the code under test.

| Fixture | Canonical string (hand-typed) | Expected digest (openssl) |
|---|---|---|
| Webhook, paid delivery (16 `data` keys, wire order deliberately **not** alphabetical) | `accountNumber=0123456789&amount=39000&code=00&counterAccountBankId=970422&counterAccountBankName=MB Bank&counterAccountName=NGUYEN VAN A&counterAccountNumber=0987654321&currency=VND&desc=success&description=MSMOLAR 2026081900&orderCode=2026081900&paymentLinkId=7f3d2a1b9c4e&reference=FT26081912345&transactionDateTime=2026-08-19 10:15:00&virtualAccountName=MS MOLAR&virtualAccountNumber=V3CAS0123456789` | `7b50211951b67fb19d5e1472709ac363716e0df45d32ef84b1eba45f7dfa2b95` |
| Same values, `data` keys alphabetical on the wire, **same signature** | identical to the row above — that identity is the assertion | identical |
| Webhook with `null` fields (the shape of every delivery nobody has paid yet) | `accountNumber=0123456789&amount=39000&code=00&counterAccountName=&desc=success&description=MSMOLAR 2026081902&orderCode=2026081902&reference=` | `4fe6c06179de9ee21c40c08d2209f30f56451b55704c633df2ea1a95d3d75adf` |
| Payment request (the five fields payOS signs; `expiredAt` is **not** signed) | `amount=39000&cancelUrl=https://ms-molar.vn/pricing&description=MSMOLAR 2026081901&orderCode=2026081901&returnUrl=https://ms-molar.vn/pricing/checkout` | `34c04ada4f3d841f981e4b3b69179429bc26236b10723a3e4243311c27ca5d94` |
| Type-gate case (valid signature, unusable `orderCode`) | `orderCode=abc` | `0862165880711a72cd3d83ecc440d6df3e7f42e2e7bed1a7502ba7d80834d9b1` |

**The tampered fixtures, and why they discriminate.** Both are well-formed JSON that differ from the genuine body in exactly one value the HMAC covers, and both keep the genuine `signature` byte-for-byte:

1. `"amount":39000` → `"amount":3900000` — still a JSON number, still the field `settleOrder()` step 3 compares. A plausible-but-wrong implementation that builds the canonical string from a hand-picked subset of "the fields we care about" accepts it.
2. `counterAccountName`: `NGUYEN VAN A` → `NGUYEN VAN B` — a field **no code in this repository reads**. It is the only case that catches an implementation which canonicalises an allowlist of keys instead of all of them.
3. Signature truncated to its first 32 hex characters — the case a `startsWith`/prefix comparison accepts and a full-length comparison rejects.

The four "return null, never throw" cases (malformed JSON, empty body, missing `signature`, missing `data`) are recorded in the test file as **contract** cases, not MAC cases: a malformed fixture is rejected for an unrelated reason and proves nothing about the digest.

### Mutation check (each mutation applied to the shipped source, suite re-run, source restored)

| Mutation | Result | Cases that went red |
|---|---|---|
| M1 digest over `JSON.stringify(JSON.parse(rawBody))` | **caught** | all three genuine-delivery cases |
| M2 `key=value` in insertion order instead of alphabetical | **caught** | the two fixtures whose wire order is not alphabetical (the alphabetical-wire fixture stays green, as designed) |
| M3 `startsWith` prefix compare instead of full-length `timingSafeEqual` | **caught** | truncated-signature case |
| M4 spread the whole provider payload into `getPaymentStatus()`'s return | **caught** | the exactly-two-properties count |
| M5 drop the `qrCode` → `qrPayload` translation | **caught** | translation case + seven-field contract case |
| M6 `expiredAt` from a fresh `1_800_000` literal | **caught** | the source-text case on `ORDER_PENDING_WINDOW_MS` |
| M7 URL-encode values in the canonical string | **caught** | three webhook cases + the payment-request signature case |
| M8 drop `null`-valued keys instead of serialising them as `""` | **caught** | the null-field delivery |
| M9 skip signature verification entirely | **caught** | all three tamper negatives (`AssertionError: expected { orderCode: 2026081900 } to be null`) |

Zero surviving mutations.

### Compliance Checks

**Binding Decision — ADR-0013 § Architecture Impact, placement: `Y`.**
Planned approach (recorded before implementation): all provider vocabulary, all three credentials and both HMAC constructions live in `SOURCE/lib/billing/payos/{index,signature}.ts`; the adapter exports only our own words plus the two identifiers (`orderCode`, `amount`) the DD itself keeps above the line.
Evidence after implementation — repo-wide scan for `PAYOS_*`, `x-client-id`, `checksum key`, `SUCCEEDED`, `CANCELLED`, `qrCode`, `api-merchant`, `/v2/payment-requests`, `canceledAt`, `expiredAt`, `transactions` outside `SOURCE/lib/billing/payos/**`:

- executable references: **zero**, with one registered exception — the three credential *names* in `SOURCE/lib/env/checkEnv.ts` (and its test), which `external-resources.md` § Payment Gateway mandates be registered there and which plan Task 1.4 shipped;
- everything else is prose in comments (`schema.sql`, `pricing.ts`, `test-rls.ts`, `parseForeignKeys.test.ts`) or a false positive of the scan (`FIXTURE_ORDER_CANCELLED` is our own `payment_orders.status` literal, not the provider's `CANCELLED`);
- no module outside the directory imports a payOS type at run time. The one new cross-boundary reference — `import type { getPaymentStatus }` in the service fixture — is type-only (erased at run time) and resolves to `{ status, amount }`, our vocabulary, not a provider type.

**Reference Contract — P-1 (backend DD § Sensitivity), state-lifecycle-negative: `Y`.**
Planned approach: `getPaymentStatus()` constructs its return as an object literal with exactly two properties; no provider object is spread, returned or logged.
Evidence: `adapter.test.ts` asserts `Object.getOwnPropertyNames(result)` has length **2** and `Object.keys(result).sort()` equals `["amount","status"]`, against a fixture whose response carries a fully-populated `transactions[]` (counter-account number/name/bank, reference, virtual account); it further asserts that no `transactions[]` value appears anywhere in the serialised return. Mutation M4 confirms the count assertion is the thing holding it. No log line in either file carries a provider field: `logPayosExit` emits only `site`, our own `orderCode`, the HTTP status, the envelope `code` and elapsed ms; `signature.ts` logs nothing at all.

### Concretisation recorded (not a change of contract)

The DD declares `verifyWebhookSignature(rawBody: string): PayosWebhookData | null` but never defines `PayosWebhookData`'s members. It is defined here as `{ orderCode: number }` — the narrowest shape satisfying ADR-0014 § Implementation Guidance (*"Never read `amount`, `status`, or any user identifier from the webhook payload for decision-making. Read `orderCode`, and nothing else"*) and the DD's own webhook-route rule (*"Nothing but `orderCode` is read from the payload for decision-making"*). The returned object is asserted to have exactly one own property, for the same reason P-1 is asserted by count.

### Open question left for plan Task 6.7 (not decided silently)

The status translation table implements exactly the three literals the in-repo sources record from `payos.vn/docs/api` (`PENDING`/`SUCCEEDED`/`CANCELLED`; ADR-0013 § References, fetched 2026-08-16). Any other literal maps to `unknown`, which is fail-closed (no settlement, recoverable through `recheckOrder()`); no literal outside the three was invented here. If the one real delivery in plan Task 6.7 shows a different literal for "paid", `toPaymentStatus()` in `index.ts` is the single line to change.

