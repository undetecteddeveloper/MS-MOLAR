# Task: fixture-e2e harness and fixture data for the subscription lane

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 0, plan Task 0.7**
Layer: **frontend** (browser-driver harness that renders React route trees; consumed only by the three FE cases)

Metadata:
- Dependencies: none
- Provides: the harness and fixtures consumed by plan Tasks 2.5 (FE-2), 3.9 (FE-3), 4.6 (FE-1)
- Size: Small (1–2 files)
- `@category: e2e-setup` · `@lane: fixture-e2e`

## Implementation Content

Follow the **shipped convention in the same directory** — a driver-based script written against the structural subset of Playwright that `supportFixtureData.ts` declares (`support-widget-visibility.fixture.e2e.test.ts:9-17`, `history.fixture.e2e.test.ts`, `rating.fixture.e2e.test.ts`).

Provide:
- **entitlement fixtures**: `known` (with `used` / `limit` / `resetsAt`), `unknown`, and exhausted;
- **order fixtures**: `pending` **with and without** `qrPayload`, `paid`, `expired`, `cancelled`, and **an unrecognised status**;
- an **action-module stub layer** for `createOrder` / `recheckOrder` (the FE cases assert invocation **counts**, so the stubs must expose counters).

**Do not introduce MSW** — the frontend Design Doc states it is not used and is not introduced. **No live payOS connection, no real money movement in this lane.**

## Target Files
- [x] `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (new — name to match the sibling `supportFixtureData.ts` / `supportAdminFixtureData.ts` convention)
- [x] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (imports only; **the three cases stay comments-only in this task**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (the declared structural subset of Playwright and the fixture-data shape to copy)
- `SOURCE/tests/e2e/fixture/support-widget-visibility.fixture.e2e.test.ts` (`:9-17` — the driver-based script convention)
- `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` and `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (two further shipped examples)
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (FE-1, FE-2, FE-3 annotation blocks — what the fixtures must make observable)
- `SOURCE/lib/billing/types.ts` (**frozen** — the `Entitlement` / `Quota` shapes the entitlement fixtures must match)
- `SOURCE/lib/billing/entitlement.tsx` (**frozen** — how the provider supplies context in the real route tree)
- `SOURCE/supabase/schema.sql` (the four permitted `payment_orders.status` literals the order fixtures must cover, plus one deliberately unrecognised value)
- `docs/design/subscription-frontend-design.md` (§ Test Boundaries)

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Enforces: the CI gate stays green; this lane is **not** collected by it — Config: `SOURCE/package.json:10`, `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record the declared Playwright structural subset verbatim
- [x] Confirm a smoke render of an existing fixture-e2e script currently passes (the baseline)
### 2. Green Phase
- [x] Add the fixture module and the stub layer with counters; keep the three subscription cases comments-only
### 3. Refactor Phase
- [x] Re-run the existing fixture-e2e smoke script and confirm it still passes

## Operation Verification Methods
- **Verification method**: load the harness and run a smoke render of an existing fixture-e2e script.
- **Success criteria**: **the harness loads and a smoke render of an existing fixture-e2e script still passes**; the entitlement, order and stub fixtures are all present; **no MSW dependency was added**.
- **Failure response**: if the shipped convention cannot express a needed fixture, extend the fixture module rather than introducing a new mocking library.
- **Verification level**: L3 now; L1 when the three FE cases run in Phases 2–4.

## Proof Obligations
- **Claim**: the three FE cases can render the **real route tree** with controllable entitlement and order state, and can count action invocations.
- **Primary failure mode**: fixtures that wrap the unit in a provider instead of letting the provider come from where production puts it — which supplies the very thing production would be missing and makes FE-2 unable to discharge AC-042.
- **Boundary to exercise**: the browser harness against the real route tree.
- **State assertion**: N/A in this task (no case executes).
- **Mock boundary rationale**: only the action modules (`createOrder` / `recheckOrder`) are stubbed, and they are counted; the route tree, layouts and provider stay real.
- **Residual**: proves the harness loads; the three journeys are proven in plan Tasks 2.5, 3.9, 4.6.

## Completion Criteria
- [x] The harness loads; a smoke render of an existing fixture-e2e script still passes
- [x] Entitlement fixtures (`known` / `unknown` / exhausted), order fixtures (`pending` with and without `qrPayload`, `paid`, `expired`, `cancelled`, unrecognised) and the counted action stubs all exist
- [x] **No MSW** and no live payOS connection introduced
- [x] `npm test` unchanged and green

## Notes
- Impact scope: the fixture-e2e lane only; no product code.
- Scope boundary: the three subscription cases stay comments-only until their owning phases.

## Investigation Notes

### The declared Playwright structural subset, verbatim (`supportFixtureData.ts`)

> `SupportDriver` is a structural SUBSET of Playwright's real `Page`/`Locator` API (`goto`, `url`, `getByRole`, `getByLabelText`, `getByText`, `.click`, `.fill`, `.setInputFiles`, `.getAttribute`, `.first`, `.count`, `.textContent`, plus `.boundingBox`/`setViewportSize` for Obligation C's real-layout requirement) — a real Playwright `Page` satisfies this interface as-is, matching the FE2Driver/HistoryDriver precedent exactly.

`SupportLocator` members as declared: `click`, `fill`, `setInputFiles`, `isVisible`, `getAttribute`, `boundingBox` (`null` = not in DOM / not laid out), `first`, `count`, `textContent`, `inputValue`. `SupportDriver` members: `goto`, `url`, `setViewportSize`, `getByRole(role, {name?})`, `getByLabelText`, `getByText`, `querySelectorCount` — the last one documented in place as **beyond** the accessibility-tree queries, to prove a node does not exist at all.

### What each Investigation Target contributed

| Target | Observed |
|---|---|
| `supportFixtureData.ts` | The module shape copied here: header recording the harness residual (no `@playwright/test`, no committed `playwright.config.ts`, no route-mocking layer), fixture routes/users as bare consts, response fixtures as `as const satisfies Record<…>`, then the Driver interface last. Also the precedent for adding a harness-provided method beyond the strict Playwright subset (`querySelectorCount`) with its reason stated inline |
| `support-widget-visibility.fixture.e2e.test.ts:9-17` | The driver-based script convention: `import assert from "node:assert/strict"`, one exported `checkXxx(driver)` per verification point, `assert.equal` carrying the AC in its message, and `runXxx()` aggregators. Nothing in these files is a `test()` block — the lane runs under a harness that does not exist yet |
| `history.fixture.e2e.test.ts:145-205` | `FixtureBackend` + `createInMemoryFixtureBackend()` — the shipped shape for a counted stub layer: mutable `xxxCallCount` fields incremented **inside** the `simulateXxx` methods, configurable behaviour through `setXxx`/`configureXxx`, and a deterministic in-memory reference implementation with no real clock. `createSubscriptionActionStubs()` copies this exactly |
| `rating.fixture.e2e.test.ts:23-27,43` | Second confirmation of the same subset convention, plus the precedent for importing a **real** type from `@/lib/**` into a fixture module (`Bucket`) rather than re-declaring it |
| `subscription.fixture.e2e.test.ts` (FE-1/2/3 blocks) | What the fixtures must make observable — see the per-case mapping below |
| `lib/billing/types.ts` (frozen) | `Quota` is a three-valued discriminated union (`unknown` vs `known {used, limit, resetsAt}`); `Entitlement` is `{plan, expiresAt, inGracePeriod, tutor, upload}`; `FREE_FALLBACK` is the fail-closed value; `isQuotaExhausted` is fail-OPEN for `unknown`. The three entitlement fixtures are built by **spreading `FREE_FALLBACK`** and overriding one half, which is the shipped technique at `ExplainStepAffordance.paywall.test.tsx:47-51` |
| `lib/billing/entitlement.tsx` (frozen) | The provider takes a single prebuilt `value` from a Server Component and `useEntitlement()` falls back to `FREE_FALLBACK` **silently** outside a provider. This is why the fixture module supplies entitlement **values** and never a provider wrapper: a fixture-mounted provider would hide the exact production failure FE-2 exists to catch |
| `supabase/schema.sql` | **`payment_orders` is not in `schema.sql` yet** — it lands with backend plan Task 1.1. The four permitted literals were therefore taken from the two places that carry them verbatim: backend DD `:358-359` (`check (status in ('pending', 'paid', 'expired', 'cancelled'))`) and the work plan's § Reference Contract Values, which additionally records that **no `'refunded'` value exists**. That is why `refunded` is the unrecognised fixture: it is a status no code path can set, so it can only arrive as drift |
| `docs/design/subscription-frontend-design.md` § Test Boundaries | MSW is not used and is not introduced; the action module is the sanctioned mock boundary; `render()` does not auto-cleanup; jsdom is per-file on line 1; jest-dom matchers are unavailable, so DOM reads are raw (`getAttribute`, `hasAttribute`, `.disabled`) — reflected in `SubscriptionLocator.getAttribute` returning `string \| null` as the way to prove a native `disabled` is absent |

### Fixture → verification point mapping

- `FIXTURE_ENTITLEMENT_KNOWN` → FE-2(a)/(b); `_UNKNOWN` → FE-2(d) (fail-OPEN must not render as fail-CLOSED); `_EXHAUSTED` → FE-2(e).
- `FIXTURE_RESETS_AT` is `2026-09-15T19:30:00.000Z` — 02:30 on **16** September in Asia/Ho_Chi_Minh. A UTC-formatted date is a day off here, which is FE-2(b)'s stated failure and the frontend DD's "stop" condition. The instant alone is **not sufficient**: discriminating power is relative to the **browser's** ambient zone, which Playwright inherits from the OS. This machine is on `Asia/Saigon`, where an unpinned `toLocaleDateString("en-CA")` returns `2026-09-16` — byte-identical to the correct pinned-ICT answer, so a formatter missing `timeZone: "Asia/Ho_Chi_Minh"` would pass locally and fail only in a UTC CI runner. `FIXTURE_BROWSER_TIMEZONE = "UTC"` plus `driver.setTimezone()` (harness-provided, Playwright context option `timezoneId`) is what restores the failure locally; `FIXTURE_RESETS_AT_ICT_DATE` / `_UTC_DATE` name the two answers.
- `FIXTURE_ORDER_PENDING` / `_PENDING_NO_QR` → FE-1(c)/(d); the two differ in `qrPayload` — the field under test — plus the **identity-derived** `orderCode` and the `memo` computed from it, because `fixtureOrderByCode` resolves on the code and two orders cannot share one. Every other field (amount, status, deadline, account number, account name) is identical, so a completable-without-QR claim still cannot pass by accident, but each screen must be asserted against **its own** fixture's values rather than by comparing the two rendered screens field-by-field.
- `_PAID` / `_EXPIRED` / `_CANCELLED` → FE-AC-19's Partial state; `_UNRECOGNISED` (`refunded`) → FE-AC-10.
- `createSubscriptionActionStubs()` counters → FE-1's fail-closed branch (**zero** `createOrder` invocations) and FE-3(f) (**exactly one** `recheckOrder` invocation under two synchronous activations). Both `simulate*` methods return **Promises**, and `holdNextRecheck()` / `releaseHeldRecheck()` keep a call outstanding: FE-3(f)'s guard is an **in-flight** guard, so against a synchronous stub two activations are two settled calls and a *correct* implementation records 2. Counters increment **before** the hold is awaited, so they measure invocation rather than completion; `reset()` releases any held call so a leaked hold cannot strand the next case.

### Decisions taken, with their reasons

1. **`qrPayload` "absent" is modelled as the empty string, not a missing property.** UI Spec C-13's normative type declares `qrPayload: string` (not optional) and C-12's contract is written over "no payload". Dropping the key would contradict the frozen eight-field shape and exercise a value the read path cannot produce.
2. **The rate-limited outcome is a branch of its own, not a sixth `SettleResult.reason`.** `SettleResult` declares exactly five reasons; C-10 renders **seven** outcomes; neither Design Doc states how `guard()`'s refusal crosses the action boundary, and that encoding belongs to plan Task 3.4. The fixture models it as `{ error: "rate_limited" }` — this repository's shipped typed-refusal convention (`(exams)/actions.ts:239`, `tutorActions.ts:183`) — kept **outside** the transcribed union so a later divergence surfaces as a type error instead of being absorbed silently.
3. **`CheckoutOrder` / `MyOrderRow` / `SettleResult` are transcribed, not imported**, because no code declares them yet. Same call `supportAdminFixtureData.ts` makes for `TicketWithNotes`. **Correction after review:** a tsc error is *not* the failure mode today — the transcriptions are structurally independent of the real types (no import, no assignment, no `satisfies`), so until the reconciliation lands, drift is **silent**. The header now states that, each declaration names its reconciliation owner (`backend-task-17` CheckoutOrder, `-19` MyOrderRow, `-16` SettleResult, `-18` the rate-limited wire shape), and each of those four task files carries a checklist line to add the compile-time link here and delete the transcription. Deferring the reconciliation stays correct — the real types do not exist yet — and the rate-limited refusal stays **outside** the transcribed `SettleResult` union. `Entitlement` / `Quota` **are** imported, since `lib/billing/types.ts` is frozen and already exists.
4. **No `explainStep` stub was added.** FE-2's exhausted state is rendered **before invocation**, from entitlement (`ExplainStepAffordance.tsx:92-104`), so it needs no tutor-action stub — and the task scopes the stub layer to `createOrder` / `recheckOrder`.
5. **A pinned clock (`FIXTURE_NOW` + `driver.clock.setFixedTime`) replaces wall-clock-relative deadlines**, so "pending until is in the future" is true by construction. `page.clock` is real Playwright API, so the subset claim holds.
6. **`driver.setTimezone(timeZoneId)` was added as a harness-provided member** (same call `supportFixtureData.ts` makes with `querySelectorCount`, and the same one `setLocale` already makes here). Playwright reads the timezone from the OS unless the **context** option `timezoneId` is set, and there is no `Page`-level equivalent, so it cannot be part of the declared `Page` subset. `clock.setFixedTime` pins the instant only, never the zone — the two pins are independent and FE-2(b) needs both.
7. **Both `simulate*` methods return Promises, and the recheck stub is holdable** (`holdNextRecheck()` / `releaseHeldRecheck()`). The real actions are async Server Actions and FE-3(f)'s dogpile guard is an in-flight guard, so a synchronous stub leaves no window to suppress: a *correct* implementation would record 2 invocations and the case would fail, with red/green decided by microtask timing rather than by the guard. FE-3(a)/(e)'s busy-state window has the same requirement. The hold is not consumed by the first call, so a dogpiled second call is held too. This is the extension this task's own **Failure response** sanctions ("extend the fixture module"); `history.fixture.e2e.test.ts` is synchronous only because none of its obligations involve an in-flight window.
8. **`createdAt` in `FIXTURE_ORDER_ROWS` is a list-ordering key only**, documented as such inline. The two pending rows deliberately share `FIXTURE_PENDING_UNTIL_FUTURE` (that identity is what keeps FE-1(d) unconfounded) while needing distinct `createdAt` values to sort deterministically, so the second row's 35-minute spread cannot satisfy the documented 30-minute window and is not meant to. No case reads `createdAt` as a deadline.
9. **The skeleton file names the harness module in a comment instead of importing it.** The task file asks for "imports only", but no case consumes an import yet, and an unused import is a **fatal** warning under `eslint --max-warnings 0` (`@typescript-eslint/no-unused-vars` is `warn` in `eslint-config-next/typescript`; verified empirically — one added `import type` produced `✖ 1 problem` and a non-zero gate). The pointer block records the module, its exported surface and which plan task fills each slot, which is what a later implementer needs. The file's `CORRECTION APPLIED` banner was left untouched: it is routed to plan Task 2.5.

### Verification performed

- **Baseline (Red step)**: loaded the shipped `support-widget-visibility.fixture.e2e.test.ts` and executed `checkNoWidgetWhenLoggedOut`, `checkNoWidgetOnAttemptRouteLoggedIn` and `checkNoWidgetOnAttemptRouteRawDom` against a minimal in-memory driver — all pass, and the same check **rejects** when the driver reports one trigger node, so the assertion is real rather than vacuous. `supportFixtureData.ts`, `history.fixture.e2e.test.ts` and `rating.fixture.e2e.test.ts` all still load.
- **Post-change (Refactor step)**: the same baseline re-run stays green, and the new module loads and passes checks on the three fixture groups, the counters (independent instances, `reset()`, recorded order codes) and the seven distinct outcomes, plus a check that neither this module nor `package.json` introduces MSW and that no payOS URL appears.
- Both runs execute under `vitest` with a scratch config, because `SOURCE/tests/**` is deliberately outside every collected lane; nothing was added to a collected lane.
- Project gates: `npm test` → **914 passed / 10 skipped, 89 files** (identical to the pre-change baseline — this lane is not collected); `npx tsc --noEmit` → exit 0; `npm run lint` → exit 0.

### Review round 2 — the five required fixes, and how each was proven

Re-ran under the same scratch-config technique (11 checks, all passing; the scratch config and scratch test were deleted afterwards):

1. **Timezone pin.** Verified that `FIXTURE_RESETS_AT` formats to `FIXTURE_RESETS_AT_ICT_DATE` under `Asia/Ho_Chi_Minh` and to `FIXTURE_RESETS_AT_UTC_DATE` under `FIXTURE_BROWSER_TIMEZONE`, and — the check that motivated the fix — that with **no** `timeZone` option this machine returns the **ICT** answer, i.e. an unpinned formatter passes FE-2(b) locally. `driver.setTimezone()` added as harness-provided, documented so it cannot be deleted as redundant.
2. **Async holdable stubs.** Verified both `simulate*` return thenables; that a held call is counted at **1** while still unsettled (invocation, not completion); the FE-3(f) sequence hold → activate → assert 1 → change outcome → release → assert the released outcome; that a *broken* guard's second call is observable as **2** and is also held; and that `reset()` releases an outstanding call, clears counters and disarms. Counters remain per-instance and survive destructuring.
3. **Header truth + cross-file reconciliation.** Header now states drift is undetectable until the compile-time link lands, and each transcribed declaration names its owner. One checklist line added to backend tasks 16/17/18/19 (Refactor Phase) — the only edit made to those files, under explicit orchestrator authorization.
4. **`createdAt` documented as a list-ordering key only**; verified the six rows are strictly descending and distinct while both pending rows keep the identical `pendingUntil`.
5. **The "differ only in `qrPayload`" claim corrected**; verified by diffing the two fixtures field-by-field — the difference set is exactly `{qrPayload, orderCode, memo}`.

Gates after the fixes: `npm test` → **914 passed / 10 skipped, 89 files** (baseline unmoved); `npx tsc --noEmit` → exit 0; `npm run lint` (project-wide) → exit 0.
