# Task: C-12, C-13, C-14, C-15 and the S-06 dictionary keys

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 4, plan Task 4.3**
Layer: **frontend** (`SOURCE/app/(billing)/pricing/checkout/_components/**`, `SOURCE/lib/i18n/**`)

Metadata:
- Dependencies: frontend-task-10 (the route), frontend-task-07 (C-10, which C-15 wraps), backend-task-06 (plan Task 0.6 — the reconciled C-13 superset)
- Provides: the payment screen; consumed by plan Tasks 4.4, 4.5, 4.6
- Size: **Medium-Large (6 files)** — kept as one task because the four components form **one screen composition** (C-13 composes C-12 and C-14; C-15 wraps C-10) and the plan Phase 4 commit estimate is 6, one per task. Implement in the order C-12 → C-14 → C-13 → C-15 so each has its children.

## Implementation Content

### C-12 `VietQrCode` (**server component** — the encoder runs during the server render so nothing about payOS reaches the browser)
Inline `<svg role="img" aria-label=…>`, `w-full max-w-[16rem] mx-auto`, ≥ 4-module quiet zone, modules in `--foreground` on `--background` (**never vermilion**). **No `<img src>` pointing at payOS and no browser fetch to a provider host** — `img-src` / `connect-src` carry no payOS origin and are enforced in **every** environment, so a wrong implementation fails on the implementer own machine. **Absent encoder (BU-2 unresolved) is a specified state, not a crash**: the component renders nothing and the page still renders.

### C-13 `PaymentPanel` (server)
The deadline from `pendingUntil` as an **absolute time** ("valid until {time}"), **never a live countdown**. Empty and Partial implemented to the **superset** reconciled in plan Task 0.6 — Partial covers `paid` / `expired` / `cancelled` **and an unrecognised status**, in all of which **neither the QR nor the transfer block renders**; the status, the `orderCode` and a link to `/me/orders` render instead.

### C-14 `TransferDetails` (server)
A `<dl>` with the four pairs **in the order fixed by the UI Spec**, `font-mono` + `select-all` on the account number and memo, `break-all` on the memo, the amount via `formatVnd()` so it **matches what the QR encodes**. **A missing field is stated, never rendered blank. No clipboard utility is introduced.**

### C-15 `PaymentConfirm` (client)
Wraps C-10 with `variant="primary"` rather than issuing its own action. `LegalLinks` reused **unchanged** and rendered **before** the control in DOM order. `legalContentReady === true` **iff** `billing.terms.body` **and** `billing.refund.body` both exist as keys in `en.ts`, computed **server-side in `checkout/page.tsx` and passed as a prop** — **never derived from `isPaidTierEnabled()`** (two independent locks; deriving one from the other makes the legal gate silently disappear at the exact moment it must hold). While false: `aria-disabled="true"`, still **focusable**, reason announced on focus, activation a **no-op**.

Add the **S-06 `billing.*` keys to both dictionaries**.

## Target Files
- [x] `SOURCE/features/billing/components/checkout/VietQrCode.tsx`
- [x] `SOURCE/features/billing/components/checkout/TransferDetails.tsx`
- [x] `SOURCE/features/billing/components/checkout/PaymentPanel.tsx`
- [x] `SOURCE/features/billing/components/checkout/PaymentConfirm.tsx`
- [x] `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (S-06 keys)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `VietQrCode` — C-12 — verify default (inline SVG) + empty (no payload / no encoder ⇒ not rendered) + error (encoding throws ⇒ page still renders) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13 — verify default (`pending`) + loading + empty + error + partial states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TransferDetails` — C-14 — verify default (four `<dl>` pairs, all selectable) + partial (a missing field is stated, never rendered blank) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentConfirm` — C-15 — verify default + loading (delegated to C-10) + error + partial (legal gate closed ⇒ `aria-disabled="true"`, focusable, no-op activation) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `LegalDocument` — C-04 (and `LegalLinks` — C-04b) — verify default + empty (reachable and forbidden — the page must not ship blank) states)
- `SOURCE/components/billing/LegalLinks.tsx` (**reused unchanged** as the S-06 second call site)
- `SOURCE/components/billing/LegalDocument.tsx` (the `LegalContentPending` render)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (plan Task 3.7 — C-10, wrapped with `variant="primary"`)
- `SOURCE/lib/format/number.ts` (plan Task 2.3 — `formatVnd`, so the amount matches what the QR encodes)
- `SOURCE/lib/billing/paidTier.ts` (**read only** — the flag the legal gate must **not** be derived from)
- `SOURCE/lib/security/csp.ts` (**frozen** — `img-src` / `connect-src` carry no payOS origin)
- `SOURCE/lib/i18n/dictionaries/en.ts` (whether `billing.terms.body` / `billing.refund.body` exist — the gate predicate)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PaymentPanel` — C-13) | structure-order | `orderCode: number; amountVnd: number; status: string; pendingUntil: string; qrPayload: string; accountNumber: string; accountName: string; memo: string;` — the eight-field `CheckoutOrder`, normative for the backend | C-13 consumes exactly these eight fields and declares no extra prop for the same data |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TransferDetails` — C-14) | structure-order | Bank account number → Account holder → Amount → Transfer memo (the four `<dl>` pairs, in this order) | The four `<dl>` pairs render in exactly this order |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TransferDetails` — C-14) | derived-display | Amount = `formatVnd(amountVnd, locale)` + the `billing.amount` unit (UI-D13). `select-all`. **Must match what the QR encodes.** Interpolating the raw number renders `39000` next to a QR carrying `39.000 VNĐ` | The rendered amount is `formatVnd()` output plus the `billing.amount` unit, and equals the amount encoded in the QR payload |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderRow` — C-08) | derived-display | **The `orderCode` is rendered as a raw digit string** — it is an identifier the user reads aloud to support, so it must not be grouped, abbreviated or localised | Every `orderCode` rendered on S-06 contains only digits, ungrouped and unlocalised |
| `docs/design/subscription-frontend-design.md` (§ Test Boundaries, C-15 row) | state-lifecycle-negative | One case asserting **`legalContentReady === false`** for the shipped dictionary **and, in the same test**, that `app/(billing)/terms/page.tsx` and `app/(billing)/refund-policy/page.tsx` still render `LegalContentPending` — so the predicate and the rendered legal pages cannot drift | `legalContentReady` is computed **only** from the presence of `billing.terms.body` and `billing.refund.body` in `en.ts` (the combined test itself is plan Task 4.5) |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, including the plan Task 0.6 C-13 superset reconciliation
- [x] Write failing tests first: the four `<dl>` pairs in order; the amount equal to `formatVnd()` output; **encoder absent ⇒ nothing rendered and the page still renders**; Partial for `paid` / `expired` / `cancelled` / unrecognised ⇒ **neither QR nor transfer block**; `legalContentReady === false` ⇒ `aria-disabled="true"`, focusable, no-op activation
### 2. Green Phase
- [x] Implement C-12 → C-14 → C-13 → C-15 in that order; add the S-06 keys to **both** dictionaries; run only the added tests
### 3. Refactor Phase
- [x] Confirm no clipboard utility was introduced and no CSP change was made; re-run the i18n ratio assertion

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `i18n.test.ts:55-59` identical-string budget — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- `npx tsc --noEmit` — Enforces: i18n key parity — Config: `SOURCE/tsconfig.json`
- `npm run build` -> `next build`; `npm run lint` (project-wide)
- Manual browser pass at 360px + greyscale (plan Task 6.5) — golden states 11-24

## Operation Verification Methods
- **Verification method**: component tests resolving real dictionary values, with an order fixture that has `qrPayload` and one that does not.
- **Success criteria**: **S-06 renders a pending order, and remains completable from the text block with the QR absent**; the four `<dl>` pairs in order with the formatted amount matching the QR-encoded amount; Partial statuses render neither QR nor transfer block; the legal gate holds while `legalContentReady === false`.
- **Failure response**: if the amount renders as a raw `39000` beside a QR carrying `39.000 VNĐ`, the value reached `t()` unformatted — format **before** substitution rather than adjusting the copy.
- **Verification level**: L1 for S-06.

## Proof Obligations
- **Claim (unavailable boundary)**: encoder absent ⇒ **the flow stays completable from text**.
- **Primary failure mode**: an absent encoder throws and takes the page down, or the transfer block is hidden with the QR, leaving the screen unpayable.
- **Boundary to exercise**: C-12 and C-13 rendered with no encoder available and with `qrPayload` absent.
- **State assertion**: N/A (render).
- **Mock boundary rationale**: the encoder module is absent/stubbed; components are real.
- **Residual**: ADR-0018 (BU-2) remains open and **non-blocking** — the absent-encoder state is a specified state, and AC-028 is satisfied from C-14 text block.

- **Claim**: the displayed amount matches what the QR encodes.
- **Primary failure mode**: interpolating the raw number renders `39000` next to a QR carrying `39.000 VNĐ`.
- **Boundary to exercise**: the rendered amount compared against the amount in the QR payload fixture.
- **State assertion**: N/A.
- **Mock boundary rationale**: none for formatting.
- **Residual**: greyscale/360px confirmation is the manual pass.

- **Claim (C-15 legal gate)**: the gate is **independent** of the release flag.
- **Primary failure mode**: the predicate is wired to `isPaidTierEnabled()` because both are false today — **the legal gate then vanishes the moment the flag is switched on** (Risk R-9, the highest-consequence guess in the frontend design).
- **Boundary to exercise**: `legalContentReady` computation against the shipped dictionary.
- **State assertion**: gate false ⇒ `aria-disabled="true"`, `hasAttribute("disabled") === false`, Tab-reachable, activation performs no action.
- **Mock boundary rationale**: the dictionary is real.
- **Residual**: the **combined** predicate-and-pages test is plan Task 4.5, and both assertions must live in **one** test.

## Completion Criteria
- [x] All added tests pass
- [x] The four C-14 `<dl>` pairs render in the fixed order; the amount matches the QR-encoded value
- [x] Encoder absent ⇒ C-12 renders nothing and the page still renders; the screen stays completable from C-14
- [x] C-13 Partial (`paid` / `expired` / `cancelled` / unrecognised) renders **neither** QR **nor** transfer block
- [x] `legalContentReady` computed **only** from the two dictionary keys, server-side, passed as a prop
- [x] S-06 keys in **both** dictionaries; identical-string ratio still green
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred** (no `vercel` / `vercel --prod` invoked in this session; no commit made by this task)

## Notes
- Impact scope: the S-06 component tree and both dictionaries; downstream, plan Tasks 4.4, 4.5, 4.6.
- Scope boundary: `LegalLinks` reused **unchanged**; no clipboard utility; no CSP change; `SOURCE/lib/security/csp.ts` frozen.
- **The legal content itself is TBD-02 / BU-1** and is engineer-owned: S-06 ships with the confirm control inert and a readable reason, which is **the specified behaviour, not a degradation**.

## Investigation Notes
(Record the C-13 superset applied, the QR/amount comparison, and each Compliance Check result here.)

### Investigation Targets read (2026-08-19)

- **UI Spec C-12 / C-13 / C-14 / C-15 / C-04(b)** — read in full. C-13's Empty and Partial sets are the v1.6 amendment (plan Task 0.6, LO-01/LO-02): Empty = {no `?order=`, unparseable `?order=`, no matching row, another user's row}; **Partial = {`paid`, `expired`, `cancelled`, unrecognised}**, and in all four *neither* the QR *nor* the transfer block renders — status + `orderCode` + a link to `/me/orders` render instead, and C-10 stays available.
- **`components/billing/LegalLinks.tsx`** — `"use client"`, no props, renders `billing.legal.linkIntro` + two `<Link>`s. Reused **unchanged**; second call site is the S-06 page.
- **`components/billing/LegalDocument.tsx`** — `LegalContentPending` renders `role="status"` dashed box. Not touched here (plan Task 4.5 asserts it).
- **`components/billing/RecheckOrderControl.tsx` (C-10)** — props are **three**: `{ orderCode, variant, status }`. `TERMINAL_STATUSES = {paid, expired, cancelled}`; an unrecognised status is **not** terminal. `LABEL_KEY.primary === "billing.confirm.action"` (already shipped, Task 3.7). `aria-disabled` is the string, `aria-busy` boolean, native `disabled` never used, `aria-describedby` points at C-10's **own** sr-only reason span.
- **`lib/format/number.ts`** — `formatVnd(amount, locale)` returns digits only; the unit lives in `billing.amount`. Format **before** `t()`.
- **`lib/billing/paidTier.ts`** — read only. `isPaidTierEnabled()` is **not** imported by anything added in this task.
- **`lib/security/csp.ts`** — untouched. `img-src`/`connect-src` carry no payOS origin and are emitted unconditionally.
- **`lib/i18n/dictionaries/en.ts`** — `billing.terms.body` / `billing.refund.body` do **not** exist (only `.pending`). ⇒ `legalContentReady === false` today.
- **`lib/billing/checkoutOrder.ts`** — the eight-field `CheckoutOrder` and its single mapper.

### Applied decisions (and where they came from)

1. **Composition.** Both component trees (UI Spec § Screen tree :544-548, frontend DD :433-438) place `PaymentPanel`, `LegalLinks`, `PaymentConfirm` as **siblings under `page.tsx`**. Followed literally, so neither C-13's documented props (`{ order }`) nor C-15's grow to carry the other's data. The `status === "pending"` gate has **one** definition — `isPayable()` exported from `PaymentPanel.tsx` and imported by `page.tsx` — so the panel branch and the confirm-control branch cannot drift (frontend DD § Affordances: QR + transfer block + deadline + confirm control are all gated on `status === "pending"` and nothing else).
2. **C-15's third prop `status`.** C-10 requires `{ orderCode, variant, status }` since plan Task 3.7; C-15 cannot fabricate a status, so it forwards one. Additive prop for data C-15 does not otherwise hold — not a reshape of `{ orderCode, legalContentReady }`.
3. **C-15's gated branch does not mount C-10.** C-10 derives `aria-disabled` from `busy || terminal` only, and it is **frozen** for this task (not in Target Files), so the legal gate cannot be expressed through it. Gate closed ⇒ C-15 renders its own inert control (same `billing.confirm.action` label, `aria-disabled="true"`, no native `disabled`, focusable, visible reason bound by `aria-describedby`, **no handler at all**). Gate open ⇒ exactly `<RecheckOrderControl variant="primary" …/>`. The "wrap rather than issue your own action" rule is preserved: the gated branch issues **no** action.
4. **C-13 Partial uses `variant="row"`** for C-10. `variant` selects only the label (C-10 docblock); `primary`'s label is "I have transferred — check now", which is false on a `paid`/`cancelled` order. UI Spec C-13 Partial names no variant, only "C-10's re-check control stays available".
5. **C-12 and BU-2 (ADR-0018).** **No dependency added.** `package.json` still has no `qr*`/`payos` package. C-12 keeps one local, reversible seam — `encodeQrMatrix(payload): QrMatrix | null`, which returns `null` today — and a real, tested matrix→`<svg>` renderer. **Integration handoff**: when ADR-0018 lands, the *only* change is the body of `encodeQrMatrix()` returning a square boolean matrix; the SVG, the quiet zone, the sizing, the palette and every guard stay as shipped.
6. **C-14 Partial** omits the missing pair and adds one visible sentence (frontend DD C-14: *"the others render **plus** a visible 'contact support' sentence"*). One key beyond the UI Spec's v1.2 budget table — `billing.checkout.fieldMissing` — because that table budgets no string for this state and reusing a C-10 outcome sentence would give two reasons one string.

### Reference Contracts — planned approach (pre-implementation)

| # | Row | Planned approach | Eval |
|---|---|---|---|
| 1 | C-13 eight-field `CheckoutOrder` | C-13 declares `{ order: CheckoutOrder }` and nothing else; the four transfer fields are forwarded to C-14 as the four values it needs, unreshaped | Y |
| 2 | C-14 four `<dl>` pairs in order | One literal array in source order: account number → account holder → amount → memo | Y |
| 3 | C-14 amount = `formatVnd()` + `billing.amount` | `t("billing.amount", { amount: formatVnd(amountVnd, locale) })`; a test compares the rendered amount against the amount encoded in the QR-payload fixture | Y |
| 4 | `orderCode` raw digits | `String(order.orderCode)` in both C-13 branches; no formatter touches it | Y |
| 5 | `legalContentReady` from the two `en` keys only | `["billing.terms.body","billing.refund.body"].every((k) => k in en)` inside `CheckoutPage`, passed as a prop. `isPaidTierEnabled` is not imported | Y |

### Reference Contracts — evaluated against the SHIPPED implementation (Exit Gate)

| # | Compliance Check | Eval | Evidence |
|---|---|---|---|
| 1 | C-13 consumes exactly the eight `CheckoutOrder` fields and declares no extra prop for the same data | **Y** | `PaymentPanel.tsx` props are `{ order: CheckoutOrder }`; the type is imported from `lib/billing/checkoutOrder.ts`, not restated. `page.tsx` passes `order` straight through — nothing rebuilt, copied or recomputed. |
| 2 | The four `<dl>` pairs render in exactly this order | **Y** | `TransferDetails.test.tsx` asserts `dt` texts `= [account, accountName, amountLabel, memo]` and `dd` texts `= ["19001234567890", "CONG TY MS MOLAR", "39,000 VND", "MSMOLAR3100000000002"]` — four DIFFERENT values, so a swap is visible. Mutants M11 (label swap) and M12 (value swap) both **KILLED**. |
| 3 | The rendered amount is `formatVnd()` output plus the `billing.amount` unit, and equals the amount encoded in the QR payload | **Y** | Same file: expected `"39,000 VND"` written as a literal, and compared against tag 54 of an EMVCo payload parsed by a TLV reader written inside the test. Mutant M10 (`String(amountVnd)`) **KILLED** on three test files. |
| 4 | Every `orderCode` rendered on S-06 contains only digits, ungrouped and unlocalised | **Y** | `String(order.orderCode)` in both C-13 branches; asserted in `PaymentPanel.test.tsx` and in the shipped `page.test.tsx` against four grouping idioms and the exponent form. Mutant M25 (`toLocaleString`) **KILLED**. |
| 5 | `legalContentReady` is computed **only** from the presence of `billing.terms.body` and `billing.refund.body` in `en.ts` | **Y** | `page.tsx`: `const legalContentReady = LEGAL_BODY_KEYS.every((key) => key in en);` evaluated inside `CheckoutPage` (request time), passed to C-15 as a prop. `PaymentConfirm.test.tsx` asserts, on source text, that neither `page.tsx` nor `PaymentConfirm.tsx` mentions `isPaidTierEnabled` / `paidTier` / `GEMINI_PAID_TIER_ENABLED` / `process.env`, and that the predicate is `.every(`, never `.some(`. Mutants M32/M33/M34 all **KILLED**. The combined predicate-and-legal-pages test stays with plan Task 4.5, as specified. |

### Results

- **Dictionaries**: 546 → **557 keys in each** locale (10 from the UI Spec's v1.2 budget + `billing.checkout.fieldMissing`). `billing.confirm.action` appears **exactly once** per locale — not re-added. `tsc --noEmit` exit 0 (parity), `i18n.test.ts` 12/12 including the identical-string ratio.
- **QR / BU-2**: **no dependency added**. `package.json` still matches no `qr*`/`payos` package. C-12 renders nothing today; the screen is payable from C-14's text block, asserted in `PaymentPanel.test.tsx`.
- **Mutation run**: 38 mutants, anchors verified unique before each run, **37 killed**. The one survivor is C-12's `payload === ""` guard, which is provably equivalent while the encoder seam returns `null` unconditionally — recorded in the file's own docblock rather than papered over.
- **Gates**: `npm test` 1384 pass / 10 skip (116 files pass, 1 skip; +43 tests, +5 files over the 1341/111 baseline) · `test:fixture` 45 pass · `tsc --noEmit` 0 · `lint` clean · `check:bundle` PASS · `test:localdb` exit 1 with "No test suite found in file" (unchanged, deliberate).
- **Scope**: `LegalLinks` and `RecheckOrderControl` reused byte-unchanged; no clipboard utility; `lib/security/csp.ts` untouched; no `PUBLIC_PATHS` change; `features/billing/queries.ts` not reformatted.
