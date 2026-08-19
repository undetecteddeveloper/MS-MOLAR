# Task: C-10 `RecheckOrderControl`, C-11 `PlanSummary` and the remaining S-05 keys

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 3, plan Task 3.7**
Layer: **frontend** (`SOURCE/components/billing/**`, `SOURCE/lib/i18n/**`)

Metadata:
- Dependencies: backend-task-16 (plan Task 3.2 — the five `SettleResult` reasons exist), frontend-task-06 (S-05)
- Provides: the re-check control both screens share, and the plan summary — consumed by plan Tasks 3.8, 3.9, 4.3
- Size: Medium (4 files)

## Implementation Content

### C-10 `RecheckOrderControl` (client, shared by both screens, `variant: "row" | "primary"`)
- **synchronous `busyRef` early-return before any `setState` and before any `await`**;
- busy = `aria-busy={true}` (**boolean**) + `aria-disabled="true"` (**string**) + a mutating `aria-describedby` target with **no `aria-live`** (idiom 3);
- outcome in a node that **appears** carrying `role="alert"` (idiom 1);
- the control **remains mounted in every status** including terminal ones, so focus is never lost and no focus rescue is needed;
- **native `disabled` is forbidden in every state**; `min-h-11`;
- post-action update via **`router.refresh()`** (not `revalidatePath()`, because the control lives on two routes and only the client knows which).

**Seven outcomes, seven sentences, seven dictionary keys** — implement the C-10 table one row at a time:

| Result | Rendered sentence | Dictionary key | Badge after re-render |
|---|---|---|---|
| `{settled:true}` | "Paid — your Premium period runs to {date}" | `billing.recheck.settled` | `paid` |
| `not_paid_yet` | "Still awaiting payment" + how to complete the transfer | `billing.recheck.stillPending` | `pending` |
| `not_pending` | "This order is already closed" | `billing.recheck.notPending` | unchanged |
| `unknown_order` | "We cannot find this order" + support link | `billing.recheck.unknownOrder` | unchanged |
| `amount_mismatch` | "The amount received does not match this order — contact support" | `billing.recheck.amountMismatch` | unchanged |
| `provider_unavailable` | "We could not reach the payment provider — try again shortly" | `billing.recheck.providerUnavailable` | unchanged |
| rate-limited (AC-037) | "You checked several times in a row — wait a moment" | `billing.recheck.rateLimited` | unchanged |

**No two reasons share a sentence** — "we could not reach the provider" and "you have not paid yet" call for **opposite actions**. **`amount_mismatch` deliberately routes to a human**: it is the one outcome where money may have moved and the automatic path has stopped. **All seven keys land in both dictionaries in this task.**

### C-11 `PlanSummary` (client)
- AC-056 four items **in order**, inside one `BentoCell`; hand-rolled `md:grid-cols-2` (`BentoGrid` hardcodes `sm:grid-cols-12`, which `md:` does **not** override).
- The three quota-derived items render **only when both quotas are `known`**; otherwise **one sentence** stating both that the counters are unreadable **and** that access is unaffected — **never `0`, never `—`**.
- `limit − used` **clamped at 0**.

## Target Files
- [x] `SOURCE/components/billing/RecheckOrderControl.tsx` (new)
- [x] `SOURCE/app/(billing)/me/orders/_components/PlanSummary.tsx` (new — C-11; place beside the S-05 components per the route-group convention)
- [x] `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (the seven recheck keys + the remaining S-05 keys)

## Investigation Targets
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10 — verify default (idle) + loading (busy) + error + partial (terminal status, `aria-disabled` with reason) states **and all seven** rendered outcomes)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PlanSummary` — C-11 — verify default (four items) + partial (`quota.unknown` ⇒ one sentence, never `0`, never `—`) + grace-period variant states)
- `docs/design/subscription-frontend-design.md` (§ Decision 2 / UI-D16)
- `docs/design/subscription-frontend-design.md` (§ Decision 4)
- `SOURCE/lib/billing/settleOrder.ts` (plan Task 3.2 — the five refusal reasons this control must render)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — `recheckOrder` and its rate-limit guard)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — `useEntitlement()` and the `known` narrowing C-11 depends on)
- `SOURCE/components/billing/OrderStatusBadge.tsx` (plan Task 2.3 — the badge whose post-re-render state is asserted)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (existing `billing.*` keys and the identical-string budget)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `RecheckOrderControl` — C-10) | structure-order | The **seven** Result → rendered sentence (dictionary key) → badge-after-re-render triples, verbatim: `{settled:true}` → "Paid — your Premium period runs to {date}" (`billing.recheck.settled`) → badge `paid`; `not_paid_yet` → "Still awaiting payment" + how to complete the transfer (`billing.recheck.stillPending`) → badge `pending`; `not_pending` → "This order is already closed" (`billing.recheck.notPending`) → badge unchanged; `unknown_order` → "We cannot find this order" + support link (`billing.recheck.unknownOrder`) → badge unchanged; `amount_mismatch` → "The amount received does not match this order — contact support" (`billing.recheck.amountMismatch`) → badge unchanged; `provider_unavailable` → "We could not reach the payment provider — try again shortly" (`billing.recheck.providerUnavailable`) → badge unchanged; rate-limited (AC-037) → "You checked several times in a row — wait a moment" (`billing.recheck.rateLimited`) → badge unchanged. Plus: *"`SettleResult` (backend design) maps to copy one-to-one; **no two reasons share a sentence**"* and *"**`amount_mismatch` deliberately routes to a human.** It is the one outcome where money may have moved and the automatic path has stopped"* | All seven outcomes render their own sentence from their own key, and the badge state after re-render matches the third column for each |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PlanSummary` — C-11) | structure-order | AC-056 four Must items … **current plan**, **period reset date**, **tutor calls remaining**, **uploads remaining** | C-11 renders these four items, in this order, when both quotas are `known` |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `PlanSummary` — C-11) | state-lifecycle-negative | **When either quota is `unknown`, the three quota-derived items are replaced by ONE sentence, and it is not a dash.** … Rendering `0` would state exhaustion the system is not enforcing; rendering `—` reads as *a count of nothing* … Never `0`, never `—` | With either quota `unknown`, the rendered output contains neither `"0"` nor `"—"` and shows one sentence covering both facts |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and copy the seven triples verbatim into the test as **fixed expected strings per locale**
- [x] Write the failing assertions: seven sentences, **21 pairwise inequalities** within a locale, the badge state per outcome, one invocation under two synchronous activations, `hasAttribute("disabled") === false` **and** `.disabled === false` in every state, and C-11 unknown branch containing neither `"0"` nor `"—"`
### 2. Green Phase
- [x] Implement C-10 and C-11; add all seven keys plus the remaining S-05 keys to **both** dictionaries; run only the added tests
### 3. Refactor Phase
- [x] Re-run the i18n identical-string ratio assertion

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `i18n.test.ts:55-59` identical-string budget — Enforces: identical-key ratio stays `< 0.1` — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- `npx tsc --noEmit` — Enforces: i18n key parity; discriminated-union exhaustiveness on `SettleResult` — Config: `SOURCE/tsconfig.json`
- `npm run build` -> `next build`; `npm run lint` (project-wide)
- Manual browser pass at 360px + greyscale (plan Task 6.5) — the load-bearing accessibility check

## Operation Verification Methods
- **Verification method**: component tests resolving the **real dictionary** values, asserting each of the seven outcomes against its fixed expected string per locale, plus the badge state after re-render.
- **Success criteria**: **all seven rendered outcome sentences asserted, each against its fixed expected string per locale** (not a substring match, not a heuristic), and **pairwise distinct within a locale** — seven assertions and 21 inequalities. Exactly **one** invocation under two synchronous activations. `hasAttribute("disabled") === false` **and** `.disabled === false` in every state. The badge after re-render matches the C-10 table third column for each of the seven (only `settled` ⇒ `paid` and `not_paid_yet` ⇒ `pending` change it; **the other five leave it unchanged**). C-11 unknown branch contains neither `"0"` nor `"—"`.
- **Failure response**: an implementation that ships three reasons and three sentences **fails here rather than in production** — add the missing outcomes, do not relax the assertions.
- **Verification level**: L2 here; L1 via FE-3 (plan Task 3.9) and the manual pass (plan Task 6.5).

## Proof Obligations
- **Claim**: seven distinct outcomes produce seven distinct, correct sentences and the right badge state.
- **Primary failure mode**: an implementation ships fewer reasons than five and silently removes a sentence from the C-10 table; or two reasons share a sentence, so "we could not reach the provider" reads as "you have not paid yet" — **opposite user actions**.
- **Boundary to exercise**: the component rendered output with the action module stubbed and counted, resolving **real** dictionary values.
- **State assertion**: badge state before → activation → badge state after, per outcome; `{settled:true}` ⇒ `paid`, `not_paid_yet` ⇒ `pending`, the other five **unchanged**.
- **Mock boundary rationale**: only the action module is stubbed (with a counter); the dictionary, the badge and the control are real — resolving real copy is what makes the seven equalities meaningful.
- **Residual**: whether the alert survives `router.refresh()` in a real browser is **R-1 / A5**, discharged by the manual pass (plan Task 6.5, item iii).

- **Claim (AC-036)**: `not_paid_yet` **must not read as a failure**.
- **Primary failure mode**: the copy uses failure vocabulary; since `role="alert"` is assertive, AC-036 rests **entirely on copy**.
- **Boundary to exercise**: the rendered sentence compared against its fixed expected string per locale.
- **State assertion**: N/A.
- **Mock boundary rationale**: none for copy.
- **Residual**: greyscale and screen-reader confirmation is part of the manual pass.

- **Claim (C-11 partial)**: when either quota is `unknown`, one sentence replaces the three quota items — **never `0`, never `—`**.
- **Primary failure mode**: rendering `0` states exhaustion the system is not enforcing; rendering `—` reads as a count of nothing.
- **Boundary to exercise**: C-11 rendered output with an `unknown` quota fixture.
- **State assertion**: N/A.
- **Mock boundary rationale**: entitlement supplied as a fixture through the real provider contract.
- **Residual**: agreement between C-11 and the badge after a re-check is asserted in FE-3 and re-checked manually (R-2 / A6).

## Completion Criteria
- [x] All added tests pass: seven sentences, 21 pairwise inequalities, seven badge-state assertions
- [x] Exactly one invocation under two synchronous activations; no native `disabled` in any state; `min-h-11`
- [x] All seven keys in **both** dictionaries; the identical-string ratio assertion still green
- [x] C-11 renders the four AC-056 items in order when both quotas are `known`, and one sentence otherwise with **no `0` and no `—`**; `limit − used` clamped at 0
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/components/billing/RecheckOrderControl.tsx`, C-11, both dictionaries; downstream, plan Tasks 3.9, 4.3.
- Scope boundary: `SOURCE/lib/billing/types.ts` and `entitlement.tsx` frozen; no integration case is filled here (INT-2 was filled by plan Task 3.5, INT-3 by plan Task 3.4 — **integration 2/3 cumulative, unchanged**).

## Investigation Notes
(Record the seven expected strings per locale, the 21 inequality results, and each Compliance Check result here.)

### Read of Investigation Targets (plan Task 3.7, session 6)

**`docs/ui-spec/subscription-ui-spec.md` § C-10 (`:865-914`)** — Props frozen at `{ orderCode: number; variant: "row" | "primary" }`; `variant` selects **label and `Button` variant only**. Handler order: (1) synchronous `busyRef` early-return before any `setState`, (2) busy ARIA (`aria-busy={true}` boolean + `aria-disabled="true"` string + mutating `aria-describedby` target, **no `aria-live`**), (3) `await recheckOrder(orderCode)`, (4) outcome in a node that **appears** carrying `role="alert"`, (5) clear busy; control stays mounted in every status. Native `disabled` forbidden in every state; `min-h-11`. Seven Result → sentence (key) → badge triples copied verbatim into the test.

**`docs/ui-spec/subscription-ui-spec.md` § C-11 (`:916-955`)** — `<dl>` in one `BentoCell`, four AC-056 items in order (plan, period reset, tutor remaining, uploads remaining); hand-rolled `md:grid-cols-2` (`BentoGrid` hardcodes `sm:grid-cols-12`, `md:` does not override); when either quota is `unknown` the three quota-derived items are replaced by **one** sentence stating both halves — never `0`, never `—`; `limit − used` clamped at 0.

**`docs/design/subscription-frontend-design.md` § Decision 2 / UI-D16 (`:588-676`)** — `router.refresh()` from the client control after the awaited action, before the latch is released; idiom 1 (`role="alert"` on an appearing node) for the outcome, idiom 3 (mutating `aria-describedby`, no `aria-live`) for the busy phase; **no** row-local patch — the server decides what the badge says.

**§ Decision 4 (`:679-712`)** — predicate is `tutor.state === "known" && upload.state === "known"` (**both**, not either); `Math.max(0, limit - used)`; `billing.quota.remaining` must **not** be reused (its semantics are *used*, and it is tutor-specific) — C-11 introduces `billing.orders.tutorRemaining` / `.uploadRemaining`.

**`SOURCE/lib/billing/settleOrder.ts:36-46`** — `SettleResult = { settled: true; expiresAt } | { settled: false; reason: "unknown_order" | "not_pending" | "not_paid_yet" | "amount_mismatch" | "provider_unavailable" }`.

**`SOURCE/lib/billing/orderActions.ts:255-289`** — `recheckOrder(orderCode): Promise<RecheckOutcome>`, `RecheckOutcome = SettleResult | { error: "unauthenticated" | "rate_limited" }`. So the union carries **eight** branches, not seven; the C-10 table covers seven (see the two recorded deviations below).

**`SOURCE/lib/billing/entitlement.tsx` (frozen)** — `useEntitlement()` returns `FREE_FALLBACK` outside a provider; `Quota` narrowing is by `state === "known"`, and `resetsAt` lives inside that variant.

**`SOURCE/components/billing/OrderStatusBadge.tsx`** — badge word comes from `billing.status.*`; glyph is `aria-hidden`. Fixed words pinned by `OrderStatusBadge.test.tsx`: `pending` = "Awaiting payment" / "Chờ thanh toán", `paid` = "Paid" / "Đã thanh toán".

**Dictionaries** — every S-05 foundation key (`billing.orders.title/.empty/.emptyHint/.createdAt/.orderCode/.continuePaying/.loadError`, `billing.amount`, the five `billing.status.*`) already shipped in Task 2.3/3.6. Remaining for this task: the seven `billing.recheck.*` outcome keys, `billing.recheck.action`, `billing.recheck.busy`, `billing.confirm.action` (C-10's `primary` label), `billing.quota.unavailable`, and C-11's item keys.

### Two recorded deviations (neither is in this task's Completion Criteria or Reference Contracts)

1. **Terminal-status `aria-disabled` is NOT implemented here.** The DD (`:745-752`) requires `paid`/`expired`/`cancelled` ⇒ `aria-disabled="true"` + a reason bound by `aria-describedby` + an early-returning handler. That needs the control to know the order's `status`, but **both** the UI Spec (`:869`) and the DD (`:738`) freeze the props at exactly `{ orderCode, variant }`, and the UI Spec's i18n inventory (`:1208-1209`) budgets **no** key for the terminal reason. Implementing it would require an unspecified third prop plus an unbudgeted key, for a branch no Completion Criterion or Reference Contract asserts, and with **no caller yet** (C-10 is mounted by plan Tasks 3.8/3.9/4.3). Deferred as a handoff: whoever mounts C-10 must decide the prop and the key.
2. **`{ error: "unauthenticated" }` has no row in the C-10 table**, but it is a branch of `RecheckOutcome` and must be handled for exhaustiveness. It reuses the shipped `profile.error.sessionExpired` (present in both locales, exact semantics) rather than inventing an eighth `billing.recheck.*` key — the dictionary's own reuse convention (`en.ts:5-6`). A thrown exception (a real DB failure, not an outcome) renders the shipped generic `billing.orders.loadError`, which is what plan Task 3.9's *"NOT EQUAL to the generic error string"* presupposes exists. Both are asserted distinct from all seven.

### Reference Contracts — Compliance Check results (Exit Gate re-evaluation)

| # | Contract | Result | Evidence |
|---|---|---|---|
| 1 | C-10 — all seven outcomes render their own sentence from their own key; badge after re-render matches the third column | **Y** | `RecheckOrderControl.test.tsx` — 7 EN + 7 VI fixed-string cases, each also compared against `dict[key]`; 21 pairwise inequalities per locale (`distinct = 7/7`, `equalPairs = 0`); 7 badge before→after cases plus a case asserting the set of badge-changing outcomes is exactly `["{settled:true}"]`. Mutants M1–M4 and D1–D2 (shared sentence / swapped keys / byte-identical dictionary values) all **KILLED**. |
| 2 | C-11 — the four AC-056 items, in this order, when both quotas are `known` | **Y** | `PlanSummary.test.tsx` — `terms` and `values` compared with `toEqual` against ordered four-element arrays, per locale. Mutants N4, N5, N8, N9 (wrong source, swapped quotas, collapsed grace, wrong plan word) **KILLED**. |
| 3 | C-11 — with either quota `unknown`, the output contains neither `"0"` nor `"—"` and shows one sentence covering both facts | **Y** | Both-unknown, tutor-only-unknown and upload-only-unknown cases; `text` asserted `not.toContain("0")` and `not.toContain("—")`; exactly one node carries the sentence; both halves of the sentence asserted separately. Mutants N1 (BOTH→EITHER), N6 (sentence → em dash), N7 (branch removed) and D4 (a `0` and an em dash added to the copy) **KILLED**. |

### Verification evidence

- `npm test` — **1252 passed | 10 skipped** (107 files passed, 1 skipped); baseline was 1182/10 over 105 files, so the 70 added cases (51 C-10 + 19 C-11) are the whole delta and nothing regressed.
- `npm run test:fixture` 23 passed · `npm run test:integration` 16 passed · `npx tsc --noEmit` exit 0 · `npm run lint` exit 0 · `npm run test:localdb` still the deliberate exit 1 (`No test suite found in file`), no `--passWithNoTests` added.
- Mutation pass: **33 mutants, 33 killed, 0 survived** (19 on C-10, 4 on the dictionaries, 10 on C-11), each applied to an in-memory copy and the original bytes restored afterwards; exit status read through `spawnSync`, never through `execSync` with `2>&1`.
- Thin spot in the mutant set, stated rather than hidden: a mutant that merely **unpins** the date formatter cannot be killed on this machine, because its timezone (`Asia/Saigon`) equals the pinned zone. M15 therefore pins the mutant to `UTC` to prove the assertion is timezone-sensitive at all; the true "unpinned formatter" case is only observable on a UTC runtime.
