# Task: S-06 route, `?order=` parsing, and the boundary files

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.2**
Layer: **frontend** (`SOURCE/app/(billing)/pricing/checkout/**`)

Metadata:
- Dependencies: backend-task-04 (plan Task 0.4 — ST-01, which unblocks slice S2), backend-task-19 (`getMyOrder()`), backend-task-18 (`createOrder()`)
- Provides: the S-06 route shell that plan Tasks 4.3 and 4.4 render into
- Size: Small (3 files)

## Implementation Content

`SOURCE/app/(billing)/pricing/checkout/page.tsx`:
- auth guard **before** fetch;
- `?order=` accepted **only** when it is a **string** matching `/^\d+$/` whose `Number()` is a **positive safe integer** (`> 0` and `<= Number.MAX_SAFE_INTEGER`); **never `parseInt`** (it accepts `"123abc"`);
- anything else — **including a non-string** — lands in **C-13 Empty state**, **not an error and not a 404**;
- reads one order via `getMyOrder(orderCode)` under `orders_select_own`.

`pricing/checkout/{loading,error}.tsx` at **`size="small"`**, same origin pattern as plan Task 3.6.

**Neither new path is added to `PUBLIC_PATHS`** (both are private by default; AC-032 budget of exactly three public entries is untouched), **neither path contains a dot** (a dotted segment reaches neither the auth middleware nor the nonce-bearing CSP), and **no CSP change is made or authorised**.

## Target Files
- [x] `SOURCE/app/(billing)/pricing/checkout/page.tsx`
- [x] `SOURCE/app/(billing)/pricing/checkout/loading.tsx`
- [x] `SOURCE/app/(billing)/pricing/checkout/error.tsx`

## Investigation Targets
- `SOURCE/app/(history)/history/loading.tsx` and `SOURCE/app/(history)/history/error.tsx` (the origin pattern; here at `size="small"`)
- `SOURCE/app/(billing)/me/orders/loading.tsx` and `error.tsx` (plan Task 3.6 — the sibling implementation to stay consistent with)
- `SOURCE/features/billing/queries.ts` (plan Task 3.5 — `getMyOrder(orderCode)`)
- `SOURCE/lib/supabase/middleware.ts` (`PUBLIC_PATHS` — **read only**; confirm this route is **not** added)
- `SOURCE/lib/security/csp.ts` (**frozen** — confirm no CSP change)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — verify default (`pending`) + loading + empty (no/unknown/foreign `?order=`, one shared state) + error + partial states)
- `docs/design/subscription-frontend-design.md` (§ Main Components)
- `docs/design/subscription-frontend-design.md` (§ FE-I9 / UI-D18)
- `docs/design/subscription-frontend-design.md` (§ Field Propagation Map)
- `docs/design/subscription-frontend-design.md` (§ Security Considerations)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | The page passes the eight-field `CheckoutOrder` from `getMyOrder()` to C-13 without reshaping it |

## Boundary Context (from the plan Connection Map)

**Boundary — S-05 / `PurchaseCta` → S-06 (order identifier across a navigation).**
- Owners: `OrderRow.tsx`, `PurchaseCta.tsx` ↔ `SOURCE/app/(billing)/pricing/checkout/page.tsx`.
- **Serialized Format**: URL query string `?order={digits}` on `/pricing/checkout` — a decimal digit string, no grouping, no sign.
- **Consumer Parse Rule**: accept **only** a value that is a **string** matching `/^\d+$/` whose `Number()` is a positive safe integer (`> 0` and `<= Number.MAX_SAFE_INTEGER`). **Never `parseInt`** — it accepts `"123abc"`. Anything else ⇒ C-13 Empty state, **not an error and not a 404**.
- **Expected Signal**: navigation lands on `/pricing/checkout?order={the same orderCode createOrder() returned}` and S-06 renders that order transfer block.
- **Roundtrip check this task must satisfy**: the digit string the producer emits parses, under this rule, to the identical `orderCode` value — and every non-conforming input lands in the one shared Empty state.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record the C-13 Empty/Partial **superset** reconciled in plan Task 0.6
- [x] Write the failing **table-driven** parsing cases: `undefined`, `""`, `"abc"`, `"12a"`, `"-1"`, `"0"`, `["1","2"]`, `"9007199254740993"`, `"12345"` ⇒ **only the last is accepted**
### 2. Green Phase
- [x] Implement the page and the two boundary files; run only the added tests
### 3. Refactor Phase
- [x] Confirm the four Empty-state causes render **byte-identical output**

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npm run build` -> `next build` — Enforces: the only full type check on the frontend side — Config: `SOURCE/package.json:7`
- Manual browser pass at 360px + greyscale (plan Task 6.5) — golden states 11-24
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: table-driven unit tests over the parsing rule, plus render tests for the four Empty-state causes.
- **Success criteria**: only `"12345"` is accepted from the listed table; the **four Empty-state causes (no param / unparseable / unknown / foreign) are byte-identical in rendered output**; both boundary files at `size="small"`; no `PUBLIC_PATHS` entry added; no dot in either path; no CSP change.
- **Failure response**: if `parseInt` is used anywhere in the parse, replace it — it accepts `"123abc"` and would route a malformed identifier into a real fetch.
- **Verification level**: L1 for the route (a user reaches the checkout screen); L2 for the parsing table.

## Proof Obligations
- **Claim (invalid option / empty input)**: an absent, blank, unparseable or out-of-range identifier lands in **the shared Empty state**, not an error and not a 404.
- **Primary failure mode**: `parseInt` accepts `"123abc"`; or a non-string (`["1","2"]`) reaches `Number()` and coerces.
- **Boundary to exercise**: the page parameter parsing, driven by the literal table above.
- **State assertion**: N/A (no state change).
- **Mock boundary rationale**: `getMyOrder()` stubbed; the parsing logic is real.
- **Residual**: none for parsing.

- **Claim (no enumeration oracle)**: the four Empty-state causes are **byte-identical in rendered output on purpose**.
- **Primary failure mode**: distinguishing "not yours" from "not found" **confirms the existence of another user order**.
- **Boundary to exercise**: rendered output compared across the four causes.
- **State assertion**: N/A.
- **Mock boundary rationale**: `getMyOrder()` stubbed to return `null` for both unknown and foreign, matching what RLS produces.
- **Residual**: the RLS-level guarantee is proven by SVC-2 (plan Task 6.2).

## Completion Criteria
- [x] All added tests pass, including the full parsing table
- [x] The four Empty-state causes are byte-identical in rendered output
- [x] Both boundary files at `size="small"`, matching the origin pattern
- [x] **Neither path added to `PUBLIC_PATHS`; neither path contains a dot; no CSP change shipped**
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: the `/pricing/checkout` route; downstream, plan Tasks 4.3, 4.4, 4.6.
- Scope boundary: `SOURCE/lib/security/csp.ts` and `SOURCE/lib/supabase/middleware.ts` are **read only** in this task.

## Investigation Notes
(Record the parsing table results, the byte-identical Empty-state comparison, and the Compliance Check result here.)

### Read at Step 2 (2026-08-19)

- **`(history)/history/{loading,error}.tsx`** (origin). `loading.tsx`: `PageContainer as="main" size="small" padding="compact"`, an `h-8 w-32` heading block plus four `h-20 animate-pulse` row blocks on `bg-border/60`. `error.tsx`: `"use client"`, `useEffect` logs **the whole `error` object** and focuses a `tabIndex={-1}` wrapper carrying `role="alert"`, retry `onClick={reset}` with **no `min-h-11`**, label `common.retry`.
- **`(billing)/me/orders/{loading,error}.tsx`** (plan Task 3.6, the sibling). Same skeleton idiom at the **page's own** `size="default"` + default padding, three row blocks. `error.tsx` applies the frontend DD's three corrections: `console.error("(billing)/me/orders render failed", { digest: error.digest })` — **digest only** — `min-h-11` on the retry control, and `common.tryAgain`. This is the shape S-06 copies, at `size="small"`.
- **`(billing)/queries.ts`** — `getMyOrder(orderCode: number): Promise<CheckoutOrder | null>`. Single-row `.eq("order_code", orderCode).maybeSingle()` under `orders_select_own`, **not** `readBounded`. Unknown code and foreign code both return `null` by the same branch (RLS filters the foreign row out); a failed read **throws**, and the throw is the route's `error.tsx`, never Empty. Projection goes through `toCheckoutOrder()` — the one mapper — so the eight-field `CheckoutOrder` arrives already shaped. **Not reformatted by this task.**
- **`lib/supabase/middleware.ts`** — `PUBLIC_PATHS` holds `/`, `/login`, `/auth/callback`, `/terms`, `/refund-policy`, … ; match is `pathname === p || pathname.startsWith(p + "/")`, query strings ignored. **Read only; no entry added.**
- **`lib/security/csp.ts`** — **frozen; not opened, not edited.**
- **UI Spec § C-13** — Empty is **four causes, one shared state** (no `?order=`; an `?order=` that does not parse; a code no row matches; a code belonging to another user), all rendering the same surface with a link back to `/pricing`, indistinguishable **on purpose**. Two mechanisms reach it: the accept-list rejects *before any read*; the RLS read returns no row. Partial (non-`pending`) and the QR/transfer block are **plan Task 4.3**.
- **Frontend DD § Field Propagation Map** — the consumer parse rule verbatim: `typeof` string **+** `/^\d+$/` **+** `Number()` a positive safe integer. Never `parseInt`. Written as an accept-list precisely so `string[]` needs no special case.
- **Frontend DD § Security Considerations** — both routes private (no `PUBLIC_PATHS` change), dot-free paths, **no CSP change**, nothing logged with order content.
- **Frontend DD § Route boundary files** — `size` **and** `padding` copy *the page*, never the precedent; `min-h-11`; `digest` only; `common.tryAgain`.

### Superset reconciled in plan Task 0.6 (recorded per Red-phase step 1)

Empty = **4** causes (no param / unparseable / unknown / foreign) → one shared surface.
Partial = **4** statuses (`paid` / `expired` / `cancelled` / **unrecognised**) → no QR, no transfer block. **Partial is plan Task 4.3's surface**; this task's shell delivers Empty and the parsed-order path only.

### Unimplemented dependency — the integration handoff to plan Task 4.3

`_components/PaymentPanel.tsx` (C-13's second file) and the `billing.checkout.*` dictionary block do **not** exist and are **not** in this task's Target Files — the work plan assigns both to **Task 4.3** ("Add the S-06 `billing.*` keys to **both** dictionaries"). `MessageKey = keyof typeof en`, so naming an unshipped key is a **tsc error**, not a runtime fallback; the shell therefore cannot render S-06's own copy.

Local, reversible construct used (contract preserved, scoped to Target Files):
- the found-order branch renders the row's `orderCode` as a **raw digit string** off the unreshaped `order` object, labelled with the already-shipped `billing.orders.orderCode`;
- the Empty branch renders the one shared surface with the `/pricing` link required by C-13, labelled with the already-shipped `billing.quota.upgradeLink`;
- `error.tsx` uses the already-shipped generic `error.couldntLoad`.

**Handoff to Task 4.3**: replace the found-branch block with `<PaymentPanel order={order} />` (the `order` const is already the eight-field object, unreshaped), and add `billing.checkout.noActiveOrder` above the Empty link. The single `!order` branch is the seam — Task 4.3 must not split it.

### Reference Contracts — planned approach and Compliance Check

Planned approach: `getMyOrder(orderCode)`'s return is bound to exactly **one** `const order: CheckoutOrder | null`. Nothing spreads it, copies it, re-maps it or re-derives any field; the page reads fields off that object and hands the same object on.

| Source | Compliance Check | Pre-impl | Rationale |
|---|---|---|---|
| UI Spec § C-13 | The page passes the eight-field `CheckoutOrder` from `getMyOrder()` to C-13 without reshaping it | **Y** | One binding, no spread, no second mapper; `toCheckoutOrder()` already did the only projection. C-13's own file is Task 4.3's; the object reaches its mount point unreshaped |

### Binding Decisions

This task file has **no** Binding Decisions section — check not applicable.

### Results (Exit Gate evidence)

**Parsing table** — `SOURCE/app/(billing)/pricing/checkout/__tests__/page.test.tsx`, 25 rows, one `it()` each. REFUSED means `getMyOrder()` was **never called** (refused before any read), not merely "rendered Empty".

| `?order=` | Outcome | Why it is in the table |
|---|---|---|
| `undefined` | REFUSED, 0 reads | no param at all |
| `""` | REFUSED, 0 reads | `Number("")` is `0`, a number — not `NaN` |
| `"abc"` | REFUSED, 0 reads | baseline |
| `"12a"` | REFUSED, 0 reads | `parseInt` ⇒ `12` |
| `"123abc"` | REFUSED, 0 reads | `parseInt` ⇒ `123` — the named defect |
| `"-1"` / `"-5"` | REFUSED, 0 reads | signed; the format carries no sign |
| `"+5"` | REFUSED, 0 reads | `Number("+5")` is `5` |
| `"0"` | REFUSED, 0 reads | `>= 0` in place of `> 0` |
| `" 12 "` | REFUSED, 0 reads | `Number()` trims; the anchored regex does not |
| `"1e3"` | REFUSED, 0 reads | `Number()` ⇒ `1000` |
| `"0x10"` | REFUSED, 0 reads | `Number()` ⇒ `16` |
| `"1.0"` | REFUSED, 0 reads | `Number()` ⇒ `1`, and `1` IS a safe integer |
| `"1,000"` | REFUSED, 0 reads | a formatted producer — what `OrderRow`'s comment warns of |
| `"\n12"` / `"12\n"` | REFUSED, 0 reads | an unanchored or `/m` regex accepts these |
| `"１２３"` (full-width) | REFUSED, 0 reads | `Number()` ⇒ `123`; `\d` is ASCII-only |
| `["1","2"]` | REFUSED, 0 reads | repeated param ⇒ array |
| `[]` | REFUSED, 0 reads | `Number([])` is `0` |
| `["12345"]` | REFUSED, 0 reads | **the row that makes `typeof` load-bearing** — `String(["12345"])` matches `/^\d+$/` and `Number()` of it is `12345` |
| `"9007199254740992"` | REFUSED, 0 reads | `MAX_SAFE_INTEGER + 1` — an integer, not a SAFE one |
| `"9007199254740993"` | REFUSED, 0 reads | past the bound |
| `"10000000000000000000"` | REFUSED, 0 reads | finite, not safe |
| `"12345"` | **ACCEPTED ⇒ `getMyOrder(12345)`** | the one row the plan names |
| `"9007199254740991"` | **ACCEPTED ⇒ `9007199254740991`** | exactly `MAX_SAFE_INTEGER`; the rule says `<=` |
| `"007"` | **ACCEPTED ⇒ `7`** | the written rule is `/^\d+$/`, not `/^[1-9]\d*$/`; recorded so it is not read as a defect |

No row calls `notFound()` and no row calls `redirect()` — not an error, not a 404.

**Four Empty causes, byte-identical**: `container.innerHTML` compared across no-param / `"12a"` / unknown `12345` / foreign `999999` — all three `toBe(noParam)`. Reads: **0** for the two refused causes, exactly **1 each** for the two that return `null`, in that order. The surface is asserted non-trivial (a real `a[href="/pricing"]` with text) and **different** from what a found order renders, so byte-identity cannot be satisfied by rendering nothing. A failed read is asserted to **propagate**, not degrade to Empty.

**Roundtrip (plan Connection Map)**: the shipped C-08 `OrderRow` is rendered for real, its `continue paying` href is parsed with `URL.searchParams`, and that exact digit string is fed to the page — `getMyOrder()` receives `3100000000002`, the identical value, as a `number`.

**Mutation run** — 20 mutants, every anchor asserted to match before the run (a no-op replacement reads exactly like a survivor); `spawnSync` on `vitest.mjs`, no `2>&1`; tree restored and re-verified green. First pass: **18 killed, 2 survived** — M01 (drop the `typeof` guard) and M07 (`Number()` → `parseInt()` with the accept-list intact). M01 was a **genuine table gap**, closed by the `["12345"]` row; M07 is an equivalent mutation under the regex, closed by a direct source assertion of the normative "never `parseInt`" rule. Second pass: **20/20 killed**.

**Thin spots in the mutant set, stated**: it does not mutate `PageContainer`, the dictionary, `getMyOrder()`'s own body, or Next.js's `searchParams` delivery; and the `size`/`padding` pair is mutated on `size` only — a `padding="compact"` added to all three files at once would stay green, which is the one drift the cross-file comparison cannot see.

**Gates**: `npm test` **1341 pass / 10 skip** (111 files pass, 1 skip) — baseline 1301/10 plus the 40 added; `npm run test:fixture` 45 pass; `npx tsc --noEmit` exit 0; `npm run lint` exit 0; `npm run check:bundle` exit 0; `npm run test:localdb` exit **1**, "No test suite found in file" — unchanged and deliberate. `npm run build` **not run** (it hangs under the sandbox); `npm run test:integration` **not run** (this task touches nothing in that lane).

### Reference Contracts — Exit Gate re-evaluation

| Compliance Check | Result | Evidence |
|---|---|---|
| The page passes the eight-field `CheckoutOrder` from `getMyOrder()` to C-13 without reshaping it | **Y** | `page.tsx` binds the read to exactly one `const order`; there is no spread, no object literal, no second mapper and no re-derivation anywhere in the file (`toCheckoutOrder()` already performed the only projection, in `queries.ts`). The one field the shell consumes is read straight off that object and printed with `String()` — mutant **M14** (`toLocaleString()`) is killed, so even a formatting of the identifier is red. C-13's own file is plan Task 4.3's; the object reaches its mount point unreshaped, and the handoff is recorded above. |

### Not done, deliberately

- `_components/PaymentPanel.tsx`, the QR (C-12), the transfer block (C-14), the confirm control (C-15), the **Partial** (non-`pending`) state, and the `billing.checkout.*` dictionary block — all **plan Task 4.3**, none in this task's Target Files.
- `SOURCE/lib/security/csp.ts` and `SOURCE/lib/supabase/middleware.ts` — read only. No CSP change; no `PUBLIC_PATHS` entry (asserted by a test, both directions: the constant, and the path Next.js actually serves these files at).
- No commit, no deploy.
