# Task: `features/billing/queries.ts` — `listMyOrders()` and `getMyOrder()` (closes CL-01) + INT-2

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.5**
Layer: **backend** (server-only data module + integration test; not a page/layout/component file)

Metadata:
- Dependencies: backend-task-17 (`toCheckoutOrder`), backend-task-18 (`createOrder` — INT-2 creates an order first), backend-task-01 (`test:integration`), backend-task-11 (gate B on dev)
- Provides: the two read functions S-05 (plan Task 3.6) and S-06 (plan Task 4.2) consume; **INT-2 filled in this same commit**
- Size: Small (2 files)

`Change Category: boundary-change`

`getMyOrder()` mapping step changes so that one contract has **one** producer. Sweep the adjacent cases sharing that contract — `createOrder()` return (plan Task 3.4), `toCheckoutOrder()` (plan Task 3.3) and every consumer of `pendingUntil` — for the same class of defect: a second inline camelCase mapping of the same row.

## Implementation Content

`import "server-only"`, following the four shipped route-group query modules.

- **`listMyOrders()`** wraps `readBounded` and orders `created_at desc` **in SQL**. The read is flat — no embed — so the `(history)` JavaScript-sort exception, which exists only because `.order(col, { referencedTable })` is a measured no-op for to-one embeds, **does not arise**. It maps to `MyOrderRow` with `status` typed **`string`, not the union**.
- **`getMyOrder(orderCode)` imports and uses `toCheckoutOrder(row)`.** It keeps its location, its signature and its `import "server-only"`; **only its mapping step changes**. **Do not write an inline camelCase mapping for this row.**
- `listMyOrders()` / `MyOrderRow` are unaffected — a different, list-shaped projection.

**This is the fix for CL-01.** Two mappings for one contract produce a **failing test** (INT-2), not a silent divergence: `pendingUntil` in PostgREST `+00:00` form is not string-equal to `toISOString()` `…Z` form — same instant, different string — and that string is the deadline text AC-027 observes.

### INT-2 — filled in **this** commit
This is the commit that changes `getMyOrder()` mapping, which is the behaviour INT-2 asserts. **Without it, CL-01 fix ships with nothing that proves it.**

Create an order, then in a **fresh request-scoped client that has not called `createOrder()`** read it back and assert:
- a **single deep-equality** assertion over the whole `CheckoutOrder` (no field excluded, no normalisation applied to either side);
- `pendingUntil` compared as a raw string **byte for byte** *and* against the literal `…Z` form the implementation commits to;
- the four transfer values byte-identical to what the mocked `createPaymentRequest()` returned;
- that `queries.ts` declares **no inline camelCase mapping of its own** for this row.

## Target Files
- [x] `SOURCE/features/billing/queries.ts` (new)
- [x] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-2 filled**)

## Investigation Targets
- `SOURCE/features/exams/queries.ts` and `SOURCE/features/authoring/queries.ts` (the shipped route-group query-module convention, incl. `import "server-only"`)
- `SOURCE/lib/supabase/boundedRead.ts` (`readBounded` — the bounded-read wrapper and its ordering options)
- `SOURCE/lib/billing/checkoutOrder.ts` (plan Task 3.3 — the mapper this module must import, not reimplement)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — the other producer of `CheckoutOrder`; INT-2 compares against it)
- `SOURCE/supabase/schema.sql` (`payment_orders_user_created_idx` on `(user_id, created_at desc)` — the index the SQL ordering must match)
- `SOURCE/tests/integration/subscription.int.test.ts` (**INT-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `docs/design/subscription-backend-design.md` (§ Escalation E-02 / CL-01)
- `docs/design/subscription-frontend-design.md` (§ Data-Fetching Plan)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | `getMyOrder()` returns exactly this shape, produced by `toCheckoutOrder()` |
| `docs/design/subscription-backend-design.md` (§ One mapper, not two — I010) | derived-display | `pendingUntil` ← `pending_until timestamptz`: **`new Date(row.pending_until).toISOString()`** — always the `…Z` form with milliseconds. The normalisation is the point | `getMyOrder()` `pendingUntil` is byte-identical to `createOrder()` for the same `orderCode`, in the `…Z` form |

## Boundary Context (from the plan Connection Map)

**Boundary — Postgres → PostgREST → `createOrder()` / `getMyOrder()` → S-06.**
- Owners: `public.payment_orders` (via `SOURCE/lib/billing/checkoutOrder.ts`) ↔ `SOURCE/app/(billing)/pricing/checkout/**`.
- **Serialized Format**: PostgREST renders `timestamptz` as `2026-08-18T09:30:00+00:00`; `bigint` and `integer` as JSON numbers.
- **Consumer Parse Rule**: `toCheckoutOrder(row)` — the **one** mapper: `Number(row.order_code)`; `amount` → `amountVnd` (rename only); `new Date(row.pending_until).toISOString()` ⇒ the `…Z` form; four `text` fields verbatim.
- **Expected Signal**: `createOrder()` return and `getMyOrder(orderCode)` return are **deeply equal** for one `orderCode`, with `pendingUntil` **byte-identical**.
- **Roundtrip check**: the value `createOrder()` emits parses to the value `getMyOrder()` returns — asserted as one deep equality, not field by field.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record INT-2 annotation block verbatim
- [x] **Boundary sweep**: grep for every camelCase mapping of a `payment_orders` row and confirm `toCheckoutOrder()` is the only one after this change
- [x] Write INT-2 first and confirm it fails against an inline mapping (the `+00:00` vs `…Z` difference is what it catches)
### 2. Green Phase
- [x] Implement `listMyOrders()` (SQL `created_at desc`) and `getMyOrder()` (via `toCheckoutOrder`); run `npm run test:integration` against dev
### 3. Refactor Phase
- [x] Confirm `MyOrderRow.status` is typed `string`, not the union, and that the module performs no JavaScript re-sort
- [x] After exporting the real `MyOrderRow`, add a compile-time link in `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (e.g. `const _fixtureRowContract: MyOrderRow = FIXTURE_ORDER_ROWS[0];`) and delete the transcribed `FixtureMyOrderRow` declaration — until that link exists, fixture drift against this type is silent

## Quality Assurance Mechanisms
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: query correctness, ordering against the matching index, RLS visibility — Config: `SOURCE/vitest.integration.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: `npm run test:integration` against **dev** — create through `createOrder()`, read back through `getMyOrder()` in a **fresh** request-scoped client, and compare with one deep equality.
- **Success criteria**: **INT-2 green from this commit**; `pendingUntil` byte-identical and in the literal `…Z` form; the four transfer values byte-identical to the mocked `createPaymentRequest()` return; `queries.ts` contains no inline camelCase mapping; `listMyOrders()` returns rows newest first with the ordering expressed in SQL.
- **Failure response**: if the deep equality fails on `pendingUntil`, the second mapping still exists — **remove the mapping, do not normalise the assertion**.
- **Verification level**: L2 (integration test against a real database).

## Proof Obligations
- **Claim (same-value)**: two producers of one contract yield **deeply equal** values.
- **Primary failure mode**: a field-by-field assertion that silently tolerates a different `pendingUntil` string form; on screen the user sees one deadline after purchase and a differently formatted one after a reload.
- **Boundary to exercise**: the real dev Postgres through PostgREST, read by a **fresh request-scoped client that has not called `createOrder()`** (so no in-process value is reused).
- **State assertion**: one row created → read back in a new client → the two `CheckoutOrder` values are deeply equal, with `pendingUntil` compared as a raw string byte for byte.
- **Mock boundary rationale**: only `createPaymentRequest()` is mocked (external paid service); the database, PostgREST serialisation and the mapper are real — a mocked client would assert the mock, not the serialization form that causes the defect.
- **Residual**: does not prove the rendered deadline text — plan Task 3.6 / FE-1 do.

- **Claim (missing-sort-key ordering)**: ordering is expressed **once**, in the query module, against the matching index.
- **Primary failure mode**: rows lacking a stable sort key are re-sorted (or not sorted) in the view, so "newest first" holds in one place and not another.
- **Boundary to exercise**: the SQL query against `payment_orders_user_created_idx`.
- **State assertion**: rows inserted out of chronological order come back `created_at desc`.
- **Mock boundary rationale**: none — real database.
- **Residual**: the view non-re-sorting invariant is re-stated and asserted in plan Task 3.6.

## Completion Criteria
- [x] All added tests pass; **INT-2 green from this commit**
- [x] `getMyOrder()` imports and uses `toCheckoutOrder(row)`; **no inline camelCase mapping exists in `queries.ts`**
- [x] `listMyOrders()` orders `created_at desc` **in SQL**; `MyOrderRow.status` is typed `string`
- [x] `import "server-only"` present, following the four shipped route-group query modules
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Test-case resolution: **integration 2/3 cumulative (INT-2, INT-3)**
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/features/billing/queries.ts`; downstream, plan Tasks 3.6, 4.2.
- Scope boundary: `SOURCE/lib/billing/checkoutOrder.ts` is imported, never re-implemented; `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes

### Investigation Targets — what each one settled

- **`SOURCE/features/exams/queries.ts` / `SOURCE/features/authoring/queries.ts`** (plus `(history)` and `(analytics)`, read for the sort exception) — the shipped route-group convention: `import "server-only"` on line 4, a `type XRow` describing the PostgREST row, a private mapper or an inline `.map()` in the query layer, `readBounded(label, query)` for every list read, and **throw on infrastructure error** (`if (error) throw error`) rather than degrading. `listMyExams()` is the closest structural sibling: `.order("created_at", { ascending: false })` in SQL, mapped inline to a camelCase list item, `status` left as `string`, `timestamptz` columns passed through **verbatim**. `listMyHistory()` performs no `auth.getUser()` at all and leans on RLS.
- **`SOURCE/lib/supabase/boundedRead.ts`** — `readBounded(label, query)` applies `.limit(LIST_ROW_CEILING + 1)` itself; the call site must **not** call `.limit()`. It returns `unknown[]`, so the call site casts. It throws on PostgREST error and fails **open** (logs, truncates) on ceiling breach. Consequence that decided the sort question: whatever PostgREST truncates is what the SQL ordering did **not** reach, so ordering in JS after `readBounded` loses unpredictable rows instead of the oldest ones.
- **`SOURCE/lib/billing/checkoutOrder.ts`** — `toCheckoutOrder(row: PaymentOrderRow): CheckoutOrder`, pure, synchronous, no `server-only` (deliberately, so the fixture layer can use it as a compile-time contract). `pendingUntil` = `new Date(row.pending_until).toISOString()`; `orderCode` = `Number(row.order_code)`; `amount` → `amountVnd` rename only; four `text` fields verbatim. Imported, never re-implemented.
- **`SOURCE/lib/billing/orderActions.ts`** — the other producer. `createOrder()` returns `toCheckoutOrder(reusable)` on the step-(0) reuse branch and `toCheckoutOrder(written.row)` on the write branch; both read the eight columns through `PAYMENT_ORDER_CHECKOUT_COLUMNS`. `findReusableOrder()` adds `.eq("user_id", …)` as a second layer **because** the exams-style precedent needs it; `recheckOrder()` deliberately does **not**, and records why: `orders_select_own` is the real enforcement for `payment_orders`, and a foreign code must be indistinguishable from a nonexistent one. `getMyOrder()` follows `recheckOrder()`, the same-table same-shape precedent.
- **`SOURCE/supabase/schema.sql`** — `payment_orders` (11 columns), `payment_orders_user_created_idx on (user_id, created_at desc)` at `:1650-1651`, and `orders_select_own … for select to authenticated using (user_id = auth.uid())` at `:1665-1667`. RLS is scoped to own-rows only, which is what makes the guard-free read correct here and would **not** make it correct on `exams`.
- **`SOURCE/tests/integration/subscription.int.test.ts`** — INT-2's annotation block: obligations (a)…(f), the deep-equality requirement, the cold-read requirement, the frozen-`types.ts` clause, the payOS-adapter-only mock boundary. Also the module-scope credential throw (collection-time, deliberately not a `describe.skipIf` and not a registered guard case) — left untouched.
- **Design docs** — backend DD § *One mapper, not two* (I010) / Escalation **E-02**: `getMyOrder()` keeps its location, signature and `import "server-only"`; only its mapping step changes; `listMyOrders()`/`MyOrderRow` untouched. Frontend DD § Data-Fetching Plan: `readBounded("listMyOrders", …)`, `.order("created_at", { ascending: false })` in SQL, C-07 never re-sorts; `getMyOrder()` is a single-row `.maybeSingle()` and is **not** bounded (a single-row read cannot be silently truncated).

### Boundary sweep — every camelCase mapping of a `payment_orders` row, repo-wide

Searched `SOURCE/**` (excluding `node_modules`) for the snake_case columns `order_code` / `amount` / `pending_until` / `qr_payload` / `account_number`, and then for each camelCase key of the contract bound to a row field (`orderCode: …row.order_code`, `amountVnd: …row.amount`, `pendingUntil: …pending_until`, `qrPayload: …row.qr_payload`).

**Exactly one mapping of the `CheckoutOrder` contract exists after this change:**

| Site | Verdict |
|---|---|
| `SOURCE/lib/billing/checkoutOrder.ts:94-104` (`toCheckoutOrder`) | **THE mapper.** The only camelCase projection of a `payment_orders` row onto `CheckoutOrder` in the repository |
| `SOURCE/lib/billing/orderActions.ts` | Calls `toCheckoutOrder()` on both branches. No mapping of its own |
| `SOURCE/features/billing/queries.ts` (this task) | Calls `toCheckoutOrder()`. **No inline mapping** — asserted by INT-2 (f), not merely reviewed |
| `SOURCE/lib/supabase/service-role.ts` | `recordPaymentOrder()` maps camelCase → **snake_case** (the write direction) and returns the raw row typed as `PaymentOrderRow`. `readPaymentOrderForSettlement()` reads two columns and renames nothing. Neither is a projection onto the contract |
| `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` | `SeededOrder` is what the seed call **wrote**, returned in the caller's vocabulary from its own inputs; `readOrderRow()` returns the raw snake_case row. Not a mapping of a read row |
| `SOURCE/supabase/test-rls.ts`, `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/security/rateLimit.ts` | Column names appear as schema text / literals only. No mapping |

`MyOrderRow` (this module) is the **five-field list projection** — `orderCode`, `amountVnd`, `status`, `createdAt`, `pendingUntil`. It is not a second producer of `CheckoutOrder`: it carries `createdAt`, which the contract does not have, and lacks the four transfer fields, which the contract requires. It has **one** producer (`listMyOrders()`) and therefore no second party to drift against — which is precisely why the design leaves it mapped in place while moving `CheckoutOrder`'s mapping out.

### The byte-compared `pendingUntil` strings (RED, measured)

INT-2 was written first and run against an inline mapping in `getMyOrder()` that passed `pending_until` through verbatim. Observed failure, verbatim from the run:

```
AssertionError: expected '2099-11-30T23:59:59+00:00' to be '2099-11-30T23:59:59.000Z'
Expected: "2099-11-30T23:59:59.000Z"      <- createOrder(), via toCheckoutOrder()
Received: "2099-11-30T23:59:59+00:00"     <- getMyOrder(), inline mapping (PostgREST form)
```

and, from the single deep-equality assertion (c):

```
- "pendingUntil": "2099-11-30T23:59:59.000Z"
+ "pendingUntil": "2099-11-30T23:59:59+00:00"
```

Seven of eight fields were identical; only `pendingUntil` diverged — which is the annotation block's stated Primary failure mode ("agree field-by-field … while `pendingUntil` differs in STRING form"), reproduced live. Assertion (f) failed in the same run on `toCheckoutOrder(` being absent from the module.

**Neither side of the comparison is derived from the code under test.** The `…Z` side is asserted against `INT2_PROVIDER_EXPIRES_AT = "2099-11-30T23:59:59.000Z"`, a hand-typed literal; no `new Date(...)` is constructed in the assertion and `toCheckoutOrder()` is never re-invoked to build an expectation. Vế 1 (producer vs producer) alone would stay green if **both** paths dropped the normalisation, which is why the literal is there.

After the fix (`toCheckoutOrder(row)`), both producers return `2099-11-30T23:59:59.000Z`, byte for byte.

### Reference Contracts — Compliance Check results

Planned approach, one sentence per row, recorded before the TDD cycle and re-evaluated against the final implementation at the exit gate:

1. *(structure-order)* `getMyOrder()` selects the eight columns through the shared `PAYMENT_ORDER_CHECKOUT_COLUMNS` and returns `toCheckoutOrder(row)` unchanged, so its shape is `CheckoutOrder`'s by construction rather than by transcription.
2. *(derived-display)* `getMyOrder()` performs no timestamp handling at all; `pendingUntil` is produced solely by `toCheckoutOrder()`'s `new Date(row.pending_until).toISOString()`.

| # | Source | Compliance Check | Pre-impl | Exit gate | Evidence |
|---|---|---|---|---|---|
| 1 | UI Spec § C-13 | `getMyOrder()` returns exactly this shape, produced by `toCheckoutOrder()` | `Y` | **`Y`** | Return type is `CheckoutOrder \| null` and the sole non-null return is `toCheckoutOrder(...)` (`queries.ts:154`). INT-2 (a)(b) asserts the returned key set sorted is exactly the eight contract names; (c) is one `toStrictEqual` over the whole value; (f) asserts the module declares no mapping of its own. `tsc --noEmit` 0 |
| 2 | Backend DD § One mapper, not two (I010) | `getMyOrder()` `pendingUntil` is byte-identical to `createOrder()` for the same `orderCode`, in the `…Z` form | `Y` | **`Y`** | INT-2 (d): `readBack.pendingUntil === created.pendingUntil`, both `=== "2099-11-30T23:59:59.000Z"` (hand-typed), plus a same-instant check against the raw PostgREST string. Measured RED first against an inline mapping (above), so the assertion is known to be able to fail |

No row evaluated `N` or `Unknown` at either point.

### Boundary Context — roundtrip check

The Connection Map's roundtrip ("the value `createOrder()` emits parses to the value `getMyOrder()` returns — asserted as one deep equality, not field by field") is discharged by INT-2 (c): a **single** `toStrictEqual` over the whole `CheckoutOrder`, no field excluded, no normalisation applied to either side. `toStrictEqual` rather than `toEqual` on purpose — the second failure form the annotation block names is "someone adds a ninth field to one path only", and an extra property holding `undefined` slips through `toEqual`. The read side runs in a **second** `@supabase/supabase-js` client with its own JWT that has never called `createOrder()`, so nothing in-process is compared with itself.

### Adjacent Case Sweep (`Change Category: boundary-change`)

Cases sharing the contract, the persisted state or the boundary with this change, checked for the same class of defect (a second inline mapping / a second serialisation form of the same value):

- `createOrder()` return (Task 3.4) — clean, calls `toCheckoutOrder()` on **both** branches.
- `recordPaymentOrder()` read-back (`service-role.ts`) — clean, returns the raw row; the projection happens at the caller.
- `recordPaymentSettlement()`'s `expiresAt` — already normalised at the same boundary with the same rule and an in-place comment citing CL-01 (`service-role.ts:460-464`). Not a `payment_orders` projection, and not a residual.
- Consumers of `pendingUntil` — `orderActions.ts` (comparison against `now()`, form-independent) and the fixture layer, which **derives** its `MyOrderRow.pendingUntil` from the `CheckoutOrder` value rather than declaring a second one.

**Residual recorded, outside this task's Target Files — one stale count, no behaviour.** `PAYMENT_ORDER_CHECKOUT_COLUMNS`'s doc comment (`SOURCE/lib/supabase/service-role.ts:469-472`) reads *"MỘT lời khai cho HAI chỗ đọc hình dạng ấy"* and enumerates two readers. `getMyOrder()` is now the **third**, deliberately reusing the constant rather than transcribing eight column names into `queries.ts` — writing them twice is what that comment itself calls the surest way to have one path return seven fields and the other eight. The comment therefore under-counts by one. `service-role.ts` is not in this task's Target Files, so the sentence is left for review to decide on rather than edited here.

### Decisions taken inside this task, with reasons

- **`MyOrderRow`'s two timestamps pass through verbatim** in PostgREST's form, not normalised to `…Z`. No specification pins the string form of this projection, and the shipped list projections (`listMyExams`, `listMyHistory`) pass `timestamptz` through unchanged. Both fields reach only `formatDateTime()` (which parses either form) and an instant comparison for the "continue paying" link; no string comparison touches them. Normalising here would add a **second** `new Date(...).toISOString()` call site for `pending_until` — the shape CL-01 exists to prevent — to buy nothing observable.
- **No `auth.getUser()` and no `.eq("user_id", …)` on either read.** `orders_select_own` is scoped to own-rows for this exact table, so the filter would be a second authorization decision expressing the same rule, plus a round trip. `recheckOrder()`'s by-code read — same table, same shape — records the same reasoning. An anonymous session reads 0 rows, so `listMyOrders()` returns `[]` and `getMyOrder()` returns `null`, which are the states S-05 and C-13 already render.
- **Two extra `it` blocks, (g) and (h), inside the INT-2 suite.** They discharge this task's *second* proof obligation (missing-sort-key ordering), whose Mock boundary rationale is "none — real database" and so cannot be met by a unit test with a fake query builder. They add **no** skeleton case: resolution stays integration **2/3** (INT-2, INT-3), and they share INT-2's fixture user and teardown rather than opening a third account.
- **Shared `ensureUser(admin, email, password)` extracted** in the test preamble; INT-3's `ensureFixtureUser()` now delegates to it. **No INT-3 assertion, fixture value or act sequence was modified** — all 8 INT-3 cases pass unchanged.
- **Every seeded row carries a `pending_until` distinct from its `created_at`.** Seeding both columns from one value is what let mutations 6 and 7 live (see below): an assertion cannot distinguish two fields fed from the same source. The distinctness is a **test-strength** property, not a domain one, and the values stay in the past so `createOrder()`'s reuse branch can never select a seeded row.
- **INT-2's provider stub returns a fixed `memo` literal** (`"MSMOLAR INT2 FIXED"`) rather than echoing `draft.memo`. Echoing makes obligation (e) unfalsifiable: an implementation that stores a memo it computed itself instead of the one the provider returned would still match. The fixed literal is the only side not built by the code under test.

### Mutation testing — 7 mutations, zero survivors *after* a review-found gap was closed

Each mutation was applied to `queries.ts` and reverted immediately after; a `diff` against a pristine copy and a re-run confirm the restored file.

**Correcting the earlier claim.** The first version of this section read *"5 mutations, zero survivors"*. The set was **incomplete**: mutations 6 and 7 below live in the same file, and **both survived** the lane as it then stood — 16 pass, exit 0, twice. They were found by **integration-test-reviewer**, not by my own run, and the "zero survivors" headline was an overclaim for as long as it stood. Rows 6–7 carry both measurements: the surviving pre-fix result and the post-fix kill.

| # | Mutation | Killed by | Note |
|---|---|---|---|
| 1 | `toCheckoutOrder(row)` in `getMyOrder()` replaced by an inline camelCase mapping passing `pending_until` through verbatim | (c), (d), (f) — 3 failed / 5 passed | This is the RED state the task was started from |
| 2 | Ordering moved from SQL into a JavaScript `.sort()` over `created_at` | **(h) only** — 1 failed / 7 passed | (g) stayed green because the observable result is *identical*; the difference is which rows `readBounded` loses at the ceiling. A value assertion cannot see this, which is the reason (h) asserts on the module's code |
| 3 | `.order("created_at", …)` removed entirely | (g), (h) — 2 failed | (g)'s diff shows rows returned in primary-key order `[created, +1, +2, +3]` instead of `[created, +3, +1, +2]` |
| 4 | Ordering direction flipped to `ascending: true` | (g), (h) — 2 failed | |
| 5 | `MyOrderRow.amountVnd` / `.status` hardcoded to `39000` / `"pending"` | (g) — 1 failed | The seeded rows carry `12_000` and three non-`pending` literals precisely so a constant cannot pass |
| 6 | `createdAt: row.created_at` ⇄ `pendingUntil: row.pending_until` **swapped** (`queries.ts:111-112`) | **Before fix: SURVIVED** — 16 pass, exit 0. **After fix: (g)** — 1 failed | Found by review, not by my run |
| 7 | `pendingUntil` hardcoded to `"1970-01-01T00:00:00+00:00"` | **Before fix: SURVIVED** — 16 pass, exit 0. **After fix: (g)** — 1 failed | Found by review, not by my run |

**Why 6 and 7 lived, and the fix.** Case (g) used to seed all three `INT2_SEEDED_ROWS` with `pending_until: seeded.createdAt`, so on **every row the case asserts against**, the two columns held the same instant. Two values sourced from the same place cannot be told apart by any assertion over them — the recorded defect class *"assertions that survive a swap of two values sourced from the same place"*. The one row where the columns genuinely differ (the `createOrder()` row: `created_at = now()` vs `pending_until = 2099-11-30`) appears in `int2.listed`, but only its `orderCode` **position** was asserted, never its timestamps in `MyOrderRow` form. Net effect: **`MyOrderRow.pendingUntil` was not observed by any assertion in the lane** — and it is the field S-05 reads for its deadline text and for the "continue paying" instant comparison.

Fix: `INT2_SEEDED_ROWS` gained a `pendingUntil` **distinct from `createdAt` on each row** (`2026-02-11/12/13` against `createdAt` `2026-01-02/01/03`), the insert writes `pending_until: seeded.pendingUntil` instead of reusing `seeded.createdAt`, and (g) asserts the `+3` row's `pendingUntil` against a **hand-typed literal**, beside the existing `createdAt` assertion. The properties that make (g) meaningful are unchanged: the rows are still inserted **out of chronological order** (`[Jan 2, Jan 1, Jan 3]`) and their primary-key order is still a third, distinct order, so neither "no sort" nor "sort by primary key" can pass. The three new `pending_until` values are all in the **past**, so no seeded row can be picked up by `createOrder()`'s step-(0) reuse branch.

Post-fix kill evidence, each mutant re-applied and measured (exit 1 in every case):

```
# 6, swap                    tests/integration/subscription.int.test.ts:828
   AssertionError: expected 1770940800000 to be 1767398400000
   ❯ expect(Date.parse(cancelled!.createdAt)).toBe(Date.parse("2026-01-03T00:00:00+00:00"))

# 6, half-swap (pendingUntil side only, run separately so BOTH halves are seen)
                             tests/integration/subscription.int.test.ts:829
   AssertionError: expected 1767398400000 to be 1770940800000
   ❯ expect(Date.parse(cancelled!.pendingUntil)).toBe(Date.parse("2026-02-13T00:00:00+00:00"))

# 7, hardcoded 1970          tests/integration/subscription.int.test.ts:829
   AssertionError: expected +0 to be 1770940800000
   ❯ expect(Date.parse(cancelled!.pendingUntil)).toBe(Date.parse("2026-02-13T00:00:00+00:00"))
```

Each failure is a **timestamp** assertion naming the corrupted field — not an incidental red elsewhere in the case: the `orderCode` ordering assertion at the top of (g) passed in all three runs. The full swap is reported by vitest at the first failing line (828, `createdAt`); the half-swap run exists so the `pendingUntil` half is proven to be observed on its own rather than inferred.

**Why the new assertion compares instants, not bytes.** `Date.parse(…)` on both sides, matching the `createdAt` assertion beside it, because `MyOrderRow` deliberately does **not** own the string form of its two timestamps (see Decisions, below) — a byte assertion here would pin PostgREST's rendering as a contract the design says is not one, and would redden on a serialisation change with no behaviour change. The hand-typed literal is still the load-bearing half: neither side is derived from the code under test. The form that *is* pinned (`…Z`) belongs to `CheckoutOrder` and is asserted byte-for-byte in (d); a mutant that normalised `MyOrderRow.pendingUntil` instead would introduce a second `toISOString(` call site, which (f)'s fingerprint ban already fails on.

### Assertion-strength limits recorded, deliberately not acted on

Both graded low-severity by review — no fix required, recorded here so a later maintainer knows the shape rather than rediscovering it:

- **(h) pins exact source formatting.** Its presence half asserts the literal string `'.order("created_at", { ascending: false })'`, so a line wrap or a quote-style change reddens it with **no behaviour change**; its absence half bans `.sort(` but not `.toSorted(`, `.reverse()` or a hand-rolled loop. It is defence-in-depth **behind** (g), and its presence half killed every ordering mutant (2, 3, 4) regardless — mutant 2 is killed by (h) *alone*, which is the whole reason the case exists.
- **(f)'s four-key fingerprint is evadable by a destructuring rename.** `const { qr_payload: qrPayload, … } = data` would ship exactly the CL-01 defect while emitting none of the banned fingerprints. The **behavioural** proof lives in (c)/(d), which caught mutant 1 alongside (f); (f) is the cheap early warning, not the proof.

### Fixture compile-time link — proven to bind, not assumed

`FixtureMyOrderRow` deleted from `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts`; `MyOrderRow` is now imported (`import type`, so `queries.ts`'s `import "server-only"` is erased at compile time and no runtime dependency on a server module is created) and used as the declared return type of `toFixtureOrderRow()` and the element type of `FIXTURE_ORDER_ROWS` / `FIXTURE_ORDER_ROWS_EMPTY` — the same shape the `CheckoutOrder` instalment used.

Binding proof: a sixth field (`settledAt: string | null`) was temporarily added to the real `MyOrderRow`, and `npx tsc --noEmit` went red **inside the fixture file** —

```
tests/e2e/fixture/subscriptionFixtureData.ts(350,3): error TS2741:
  Property 'settledAt' is missing in type '{ orderCode: number; amountVnd: number;
  status: string; createdAt: string; pendingUntil: string; }' but required in type 'MyOrderRow'.
```

— then reverted; `tsc` back to 0. The file header's transcription checklist is updated: **nothing remains on it**, and no shape in that file is declared independently of the code it stands for. `subscriptionFixtureData.ts:203`'s hand-copied `39_000` and the `FIXTURE_TUTOR_LIMIT` / `FIXTURE_UPLOAD_LIMIT` incoherence are documented in place as deliberate and were **not** touched.

### Verification runs (measured)

| Gate | Command | Result |
|---|---|---|
| Integration (this task) | `test:integration` against dev | **16 pass, exit 0** (was 8) — re-measured after the case-(g) fix, run **twice consecutively**, green both times |
| Integration, isolated | `test:integration -t "INT-2"` | 8 pass / 8 skip, **exit 0** |
| Dev database left clean | `select count(*) from payment_orders` (service role, ref `hynwleaxtbtjzkvpjsug`) | **0 rows** after the runs — whole table, not only this task's fixture user |
| Unit | `npm test` | **1164 pass / 10 skip** — baseline held exactly |
| Fixture-e2e | `test:fixture` | 23 pass, exit 0 |
| Types | `npx tsc --noEmit` | 0 |
| Lint | `eslint --max-warnings 0` | clean |

`SOURCE/.env.local` is unmodified (sha256 `2d8ef6ce…dac6413`, verified after the runs); `SOURCE/.env.local.prod-backup` was never read; production (`pebjdlbgbmizgfpuptjl`) was never contacted; **no production deploy of this branch has occurred**. `npm run build` / `next build` deliberately not run — it hangs indefinitely under the sandbox rather than failing.
