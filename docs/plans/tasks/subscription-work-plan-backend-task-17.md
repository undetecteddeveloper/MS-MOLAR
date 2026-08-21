# Task: `checkoutOrder.ts` — the one `toCheckoutOrder(row)` mapper

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.3**
Layer: **backend** (`SOURCE/lib/billing/**`)

Metadata:
- Dependencies: backend-task-12 (plan Task 1.4)
- Provides: `CheckoutOrder` + `toCheckoutOrder(row)` — the **single** mapper imported by plan Task 3.4 (`createOrder`) and plan Task 3.5 (`getMyOrder`)
- Size: Small (1 file + test)
- ⚠ **Ordering constraint: this task must precede plan Tasks 3.4 and 3.5** — the contract is pinned *before* two producers exist (that is the whole point of CL-01).

## Implementation Content

A **new file**, so `SOURCE/lib/billing/types.ts` stays frozen.

Exports:
- the `CheckoutOrder` type **consumed verbatim from UI Spec C-13** (not redefined, not re-ordered);
- the single snake_case → camelCase mapping, with every field serialized form pinned per Reference Contracts below — in particular **`pendingUntil` = `new Date(row.pending_until).toISOString()`**, normalising PostgREST `+00:00` form to the `…Z` form.

**The normalisation is the point.**

## Target Files
- [x] `SOURCE/lib/billing/checkoutOrder.ts` (new)
- [x] `SOURCE/lib/billing/__tests__/checkoutOrder.test.ts` (new)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — the normative eight-field `CheckoutOrder`)
- `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010)
- `SOURCE/lib/billing/types.ts` (**frozen** — confirm `CheckoutOrder` does **not** go here)
- `SOURCE/supabase/schema.sql` (the `payment_orders` block — the snake_case source column names and their SQL types)
- `SOURCE/lib/supabase/boundedRead.ts` (how PostgREST rows arrive in this repository, and their JSON shapes)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | `CheckoutOrder` declares exactly these eight fields with these names and types, in this order |
| `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010) | derived-display | `pendingUntil` ← `pending_until timestamptz`: **`new Date(row.pending_until).toISOString()`** — always the `…Z` form with milliseconds. The normalisation is the point | `toCheckoutOrder()` produces `pendingUntil` in the `…Z` form with milliseconds for a PostgREST `+00:00` input |

## Boundary Context (from the plan Connection Map)

**Boundary — Postgres → PostgREST → `createOrder()` / `getMyOrder()` → S-06.**
- Owners: `public.payment_orders` (via `SOURCE/lib/billing/checkoutOrder.ts`) ↔ `SOURCE/app/(billing)/pricing/checkout/**`.
- **Serialized Format**: PostgREST renders `timestamptz` as `2026-08-18T09:30:00+00:00`; `bigint` and `integer` as JSON numbers.
- **Consumer Parse Rule**: `toCheckoutOrder(row)` — the **one** mapper: `Number(row.order_code)`; `amount` → `amountVnd` (rename only); `new Date(row.pending_until).toISOString()` ⇒ the `…Z` form; four `text` fields verbatim.
- **Expected Signal**: `createOrder()` return and `getMyOrder(orderCode)` return are **deeply equal** for one `orderCode`, with `pendingUntil` byte-identical.
- **Roundtrip check this task must satisfy**: a PostgREST `+00:00` timestamp fed through this mapper emits exactly the `…Z` string the checkout screen renders and that INT-2 compares byte for byte.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and copy the eight-field C-13 declaration verbatim
- [x] Write the failing test first: feed a literal PostgREST-shaped row (with `+00:00`) and assert `pendingUntil` **equals the literal `…Z` string with milliseconds** — a hardcoded expected value, never read back from the implementation
### 2. Green Phase
- [x] Implement the mapper; run only the added tests
### 3. Refactor Phase
- [x] Confirm no other module declares a `CheckoutOrder` shape or a competing mapping
- [x] After exporting the real `CheckoutOrder`, add a compile-time link in `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (e.g. `const _fixtureContract: CheckoutOrder = FIXTURE_ORDER_PENDING;`) and delete the transcribed `FixtureCheckoutOrder` declaration — until that link exists, fixture drift against this type is silent

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit` — Enforces: the eight-field contract compiles as declared — Config: `SOURCE/tsconfig.json`
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit test over literal PostgREST-shaped input rows (no database).
- **Success criteria**: `pendingUntil` matches the `…Z` form **with milliseconds**; `orderCode` is a `number` via `Number(row.order_code)`; `amount` → `amountVnd` is a rename only; the four `text` fields pass through verbatim.
- **Failure response**: if a second mapping exists anywhere for this row shape, delete it here rather than reconciling it later — two mappings for one contract is exactly CL-01.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: one row shape has exactly one serialized `CheckoutOrder` form.
- **Primary failure mode**: a future change of serialization form (PostgREST `+00:00` vs `toISOString()` `…Z`) passes here and fails on the payment screen instead — the user sees one deadline after purchase and a differently formatted one after a reload.
- **Boundary to exercise**: the mapper public function, fed literal PostgREST-shaped rows (in-process unit).
- **State assertion**: N/A (pure mapping).
- **Mock boundary rationale**: none — literal input, no I/O.
- **Residual**: deep equality between the **two producers** is proven in plan Task 3.5 (INT-2), not here.

## Completion Criteria
- [x] All added tests pass, including the literal `…Z`-form assertion
- [x] `CheckoutOrder` declares exactly the eight C-13 fields; `SOURCE/lib/billing/types.ts` is unmodified
- [x] No competing mapping for this row shape exists in the repository
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/billing/checkoutOrder.ts`; downstream, plan Tasks 3.4, 3.5, 4.2, 4.3.
- Scope boundary: `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes

### Investigation Targets read (2026-08-19)

- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13): the normative eight-field `CheckoutOrder` block was copied **verbatim**, field names, types and order unchanged. Load-bearing notes carried into the code comments: `amountVnd` is never formatted in the mapper (`formatVnd()` owns that, UI-D13); `pendingUntil` comes **from the row**, never `now + 30 min`; `qrPayload` is a VietQR/EMVCo payload and never a URL (UI-D14); `status` stays `string` because UI-D15 renders an unrecognised value rather than rejecting it.
- `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010): the whole point is that the two paths are **not** byte-identical by construction — PostgREST emits `2026-08-18T09:30:00+00:00`, `toISOString()` emits `…000Z`, and AC-027 compares the **string**. The per-field serialized-form table is reproduced exactly: `Number(row.order_code)`, `amount` → `amountVnd` rename only, `new Date(row.pending_until).toISOString()`, four `text` fields verbatim. E-02 records that `getMyOrder()` (plan Task 3.5) must import this mapper rather than keeping its inline mapping.
- `SOURCE/lib/billing/types.ts` (**frozen**): read and **not modified**. It owns the entitlement contract (`Plan` / `Quota` / `Entitlement` / `FREE_FALLBACK` / `isQuotaExhausted`) and nothing order-shaped. `CheckoutOrder` went into the new `checkoutOrder.ts`, as the design requires.
- `SOURCE/supabase/schema.sql` (`payment_orders` block, `:1610-1648`): eleven columns. The eight this mapper reads are `order_code bigint`, `amount integer not null check (amount > 0)`, `status text not null check (status in ('pending','paid','expired','cancelled'))`, `pending_until timestamptz not null`, and the four `text not null` transfer columns `qr_payload` / `account_number` / `account_name` / `memo`. `user_id`, `created_at` and `settled_at` are **not** part of C-13, so `PaymentOrderRow` declares only the eight — three fewer fields able to drift.
- `SOURCE/lib/supabase/boundedRead.ts`: applies to **list** reads (the `LIST_ROW_CEILING + 1` decoy-row tripwire). `getMyOrder()` is a single-row `.maybeSingle()` read, so this mapper sits outside that helper; what carried over is the repository's convention that PostgREST rows arrive as loosely-typed JSON and are cast at the call site (`as unknown as Row[]`), which is why `PaymentOrderRow` is exported for the two producers to cast to.

### The literal input row and the literal expected `…Z` strings

Input row (typed out in the test, PostgREST shape):

```
order_code: 1755518400001, amount: 39000, status: "pending",
pending_until: "2026-08-18T17:30:00+00:00",
qr_payload: "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2",
account_number: "0011001234567", account_name: "CONG TY TNHH MS MOLAR", memo: "MSMOLAR 1755518400001"
```

Expected, **hand-typed literals**, never produced by calling `new Date(...).toISOString()` in the test and never read back from the mapper:

| Case | Input `pending_until` | Expected `pendingUntil` | Wrong implementations it rejects |
|---|---|---|---|
| 1 | `2026-08-18T17:30:00+00:00` | `2026-08-18T17:30:00.000Z` | (a) passing the column through verbatim (`…+00:00`); (b) dropping milliseconds (`…17:30:00Z`); (c) formatting in local time — **17:30Z is 19/08 00:30 in ICT, so the calendar date differs** and a local-time leak cannot hide on this `TZ=Asia/Saigon` machine |
| 2 | `2026-08-18T23:45:00.5+07:00` | `2026-08-18T16:45:00.500Z` | (d) string surgery such as `.replace("+00:00", ".000Z")`, which leaves the hour 7 hours wrong; (e) unconditionally appending `.000Z`, which destroys the row's real `.5` fraction |

The other three cases assert: the eight C-13 keys **in C-13's order** via `Object.keys`; the whole object by deep equality against hand-typed literals (four pairwise-distinct `text` values, so a swap cannot survive); and an out-of-CHECK `status` (`"refunded"`) passing through untouched, because UI-D15's unrecognised branch only exists if the mapper refuses to judge.

### Mutation testing (in-memory, original bytes restored — verified byte-equal afterwards)

Harness: mutate `checkoutOrder.ts` in memory, run the unit file through `spawnSync` on `node_modules/vitest/vitest.mjs` (a truthful exit status; `execSync` + `2>&1` reports success on failure on this platform), restore in `finally`.

| Mutant | Result | Killed by |
|---|---|---|
| M1 pass `pending_until` through verbatim | **KILLED** (exit 1) | cases 1, 2, 4 |
| M2 emit `…+00:00` instead of `…Z` | **KILLED** | cases 1, 2, 4 |
| M3 strip milliseconds | **KILLED** | cases 1, 2, 4 |
| M4 swap `accountNumber` ↔ `memo` (dictionary swap) | **KILLED** | case 4 |
| M5 swap `accountName` ↔ `qrPayload` (dictionary swap) | **KILLED** | case 4 |
| M6 `Number(row.amount.toFixed(0))` | *survived — equivalent mutant, no behaviour change on an integer; replaced by M7* | — |
| M7 `amountVnd` stringified instead of renamed | **KILLED** | case 4 |
| M8 field order changed (`memo` emitted first) | **KILLED** | case 3 |
| M9 an extra snake_case `amount` field leaks out | **KILLED** | cases 3, 4 |
| M10 `orderCode` not converted to `number` | **KILLED** | case 4 |

### Reference Contracts — Compliance Check results

| Source | Compliance Check | Result | Evidence |
|---|---|---|---|
| UI Spec § `PaymentPanel` (C-13) | `CheckoutOrder` declares exactly these eight fields with these names and types, in this order | **Y** | `checkoutOrder.ts` declares `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — copied from C-13, nothing added or reordered. Pinned at runtime too by the `Object.keys` case (M8 and M9 both die on it) |
| Backend DD § One mapper, not two (I010) | `toCheckoutOrder()` produces `pendingUntil` in the `…Z` form with milliseconds for a PostgREST `+00:00` input | **Y** | `pendingUntil: new Date(row.pending_until).toISOString()`; `+00:00` input ⇒ literal `2026-08-18T17:30:00.000Z`. M1/M2/M3 all die |

Both were evaluated `Y` at planning time and re-evaluated `Y` against the final implementation.

### Refactor-phase findings

- **No competing mapping exists.** Searched the repository for `pending_until`, `order_code`, `qr_payload`, `pendingUntil` and `amountVnd`. The only other `payment_orders` readers are `readPaymentOrderForSettlement()` in `lib/supabase/service-role.ts` (a deliberate two-column `{ status, amount }` projection with **no** camelCase renaming) and `supabase/test-rls.ts` (writes snake_case rows for the RLS harness). `lib/billing/payos/index.ts`'s `PaymentRequestResult` runs the *other* direction — provider response → values to insert — and is not a row projection. Nothing to delete.
- **Fixture link added and verified to bind.** `tests/e2e/fixture/subscriptionFixtureData.ts` now imports the real `CheckoutOrder` and uses it as `fixtureOrder()`'s declared return type; the transcribed `FixtureCheckoutOrder` declaration is deleted and the file header's reconciliation list records `CheckoutOrder -> DONE, backend-task-17`. **Binding proven, not assumed**: temporarily adding a ninth field to `CheckoutOrder` produced `tests/e2e/fixture/subscriptionFixtureData.ts(249,3): error TS2741` inside the fixture file; the probe was reverted and `tsc --noEmit` is back to 0.
- `subscriptionFixtureData.ts:203`'s hand-copied `39_000` is pre-existing and deliberately left alone (out of scope for this task).

### Verification (L2)

Run from `SOURCE/`: `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm test` 1137 passed / 1 failed / 10 skipped, the single failure being the known cold-cache flake `components/tutor/ExplainStepAffordance.test.tsx` (5/5 passing in 2.86s when run alone) — i.e. 1138 substantive passes against the 1133 baseline, exactly the five cases added here · `npm run test:fixture` 23 passed, exit 0. `next build` deliberately not run (hangs under the sandbox); `test:integration` / `test:localdb` remain comment-only skeletons. **No production deploy of this branch has occurred.**
