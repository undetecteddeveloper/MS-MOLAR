// Subscription (payOS prepaid period) — fixture data, the browser Driver
// interface, and the counted action-module stub layer consumed by the three
// subscription fixture-e2e cases (FE-1 / FE-2 / FE-3 in
// `subscription.fixture.e2e.test.ts`, filled by plan Tasks 4.6 / 2.5 / 3.9).
//
// Same convention and the same documented residual as the shipped siblings
// (`supportFixtureData.ts`, `history.fixture.e2e.test.ts`,
// `rating.fixture.e2e.test.ts`): this repo has no `@playwright/test`
// dependency, no committed `playwright.config.ts` and no request/route-mocking
// layer, so wiring these fixtures into a real running page is the job of
// whoever stands up the Playwright harness. `SubscriptionDriver` is therefore
// written as a structural SUBSET of Playwright's real `Page`/`Locator` API, and
// the three cases run unchanged once that harness exists — either as `test()`
// blocks or driven directly through a Playwright MCP session.
//
// NO MSW. The frontend Design Doc states MSW is not used and is not introduced;
// the sanctioned mock boundary is the ACTION MODULE, which is what
// `SubscriptionActionStubs` below stands in for. No live payOS connection and
// no real money movement occurs in this lane: `createOrder` / `recheckOrder`
// resolve from fixtures, while the route tree, the layouts, the
// `EntitlementProvider` mount and the dictionaries stay REAL — the provider in
// particular must come from where production puts it, because a fixture that
// wraps the unit in its own provider supplies the very thing a broken
// production tree would be missing (frontend DD Risk R-12).
//
// TRANSCRIBED CONTRACTS — AND THEIR UNCHECKED WINDOW. `Entitlement` / `Quota`
// are imported from the frozen `lib/billing/types.ts`, so a change there breaks
// this file at compile time. `CheckoutOrder`, `MyOrderRow` and `SettleResult`
// have no code yet, so their shapes are transcribed from the work plan's
// Reference Contract Values. Being transcriptions, they are structurally
// INDEPENDENT of the real types — no import, no assignment, no `satisfies` —
// so until the reconciliation lands, drift between this file and the shipped
// contract is NOT detectable, silently, by tsc or by anything else. That is the
// same exposure `supportAdminFixtureData.ts` carries for `TicketWithNotes`, and
// it is accepted only because the real declarations do not exist yet.
// The reconciliation is owned by the task that first exports each type, and is
// recorded as a checklist line in that task's file:
//   - `FixtureCheckoutOrder`      -> backend-task-17 (`lib/billing/checkoutOrder.ts`)
//   - `FixtureMyOrderRow`         -> backend-task-19 (`app/(billing)/queries.ts`)
//   - `FixtureSettleResult`       -> backend-task-16 (`lib/billing/settleOrder.ts`)
//   - `FixtureRateLimitedRefusal` -> backend-task-18 (`lib/billing/orderActions.ts`)
// Each of those tasks adds a compile-time link here (e.g.
// `const _fixtureContract: CheckoutOrder = FIXTURE_ORDER_PENDING;`) and deletes
// the transcribed declaration. Only after that link exists does a tsc error
// become the failure mode for drift.

import { FREE_FALLBACK, type Entitlement } from "@/lib/billing/types";
import { LOCALE_COOKIE, type Locale } from "@/lib/i18n/locales";

// --- Fixture identities and routes ------------------------------------------

export const FIXTURE_USER = {
  id: "subscription-fixture-user-1",
  email: "fixture-subscription@example.com",
};

/** S-01 — the purchase screen FE-1 starts from. */
export const FIXTURE_PRICING_ROUTE = "/pricing";

/** S-05 — the order list FE-3 drives. */
export const FIXTURE_ORDERS_ROUTE = "/me/orders";

/** S-06 with no `?order=` param — one of the four inputs that must render the
 *  single shared "no active payment in progress" state (FE-AC-20). */
export const FIXTURE_CHECKOUT_ROUTE = "/pricing/checkout";

export function fixtureCheckoutRoute(orderCode: number): string {
  return `${FIXTURE_CHECKOUT_ROUTE}?order=${orderCode}`;
}

/** The UI-D17 mount site: FE-2 asserts the note beside BOTH
 *  `ExplainStepAffordance` call sites on the result-detail page. */
export const FIXTURE_EXAM_ID = "exam-subscription-fixture";
export const FIXTURE_ATTEMPT_ID = "attempt-subscription-fixture";
export const FIXTURE_RESULT_DETAIL_ROUTE = `/exams/${FIXTURE_EXAM_ID}/attempt/${FIXTURE_ATTEMPT_ID}/result/detail`;

/** The cookie `SubscriptionDriver.setLocale` has to set, taken from the shipped
 *  constant so a rename breaks here instead of silently rendering the default
 *  locale underneath a per-locale copy assertion. */
export const FIXTURE_LOCALE_COOKIE = LOCALE_COOKIE;

// --- Pinned clock -----------------------------------------------------------

/** Every timestamp below is written relative to this instant, so "pending until
 *  is in the future" holds by construction rather than by wall clock. The
 *  harness pins the browser clock to it via `driver.clock.setFixedTime`. */
export const FIXTURE_NOW = "2026-08-18T12:00:00.000Z";

/** Inside the 30-minute window — the "continue paying" link renders (FE-AC-11). */
export const FIXTURE_PENDING_UNTIL_FUTURE = "2026-08-18T12:25:00.000Z";

/** Past the window — the link must NOT render, while the re-check control still
 *  does (FE-AC-11; an expired-looking order may still have been paid). */
export const FIXTURE_PENDING_UNTIL_PAST = "2026-08-18T11:30:00.000Z";

// --- Entitlement fixtures ---------------------------------------------------

/** Deliberately an instant whose Asia/Ho_Chi_Minh calendar day differs from its
 *  UTC one (19:30Z is 02:30 the NEXT day in ICT). FE-2(b) requires the rendered
 *  reset date to be the ICT one, so a formatter missing the timezone pin lands
 *  a day off here — the failure the pin exists to catch, and the one the
 *  frontend DD's early-verification response says to stop on. */
export const FIXTURE_RESETS_AT = "2026-09-15T19:30:00.000Z";

/** The two calendar days `FIXTURE_RESETS_AT` falls on. FE-2(b) passes only
 *  against the ICT one; the UTC one is the exact wrong answer it must reject. */
export const FIXTURE_RESETS_AT_ICT_DATE = "2026-09-16";
export const FIXTURE_RESETS_AT_UTC_DATE = "2026-09-15";

/** The browser timezone FE-2(b) MUST run under, pinned by the harness through
 *  `driver.setTimezone(FIXTURE_BROWSER_TIMEZONE)` before navigating.
 *
 *  DO NOT DELETE THIS PIN AS REDUNDANT. The instant above discriminates only
 *  relative to the BROWSER's ambient zone, which Playwright inherits from the
 *  OS unless the context option `timezoneId` is set. On a developer machine
 *  already in ICT (this project's machines are on `Asia/Saigon`), a
 *  `TutorQuotaNote` formatter that OMITS `timeZone: "Asia/Ho_Chi_Minh"`
 *  produces byte-identical output to the correct pinned-ICT one — it renders
 *  `FIXTURE_RESETS_AT_ICT_DATE` for the wrong reason and FE-2(b) passes. The
 *  bug would then only surface in a UTC CI runner. Pinning the browser to a
 *  zone that is NOT `Asia/Ho_Chi_Minh` is what makes the unpinned formatter
 *  render `FIXTURE_RESETS_AT_UTC_DATE` and fail everywhere, including locally.
 *  Any zone whose calendar day differs from ICT at this instant works; `UTC` is
 *  chosen because it is the value CI already runs under. */
export const FIXTURE_BROWSER_TIMEZONE = "UTC";

// DRIFT, RECORDED AND DELIBERATELY NOT CORRECTED. These two numbers describe a
// user shape the backend cannot produce. Both entitlement fixtures below spread
// `FREE_FALLBACK`, whose `plan` is `"free"`, while carrying a tutor limit of
// 500 — and 500 is `PLAN_LIMITS.premium.tutor` (`lib/billing/quota.ts`); the
// FREE tutor limit is 5. The upload limit is further off still: 5 matches
// NEITHER plan (free 3, premium 15).
//
// Harmless today, and for a reason that is a property of the consumer rather
// than luck: `TutorQuotaNote` prints whatever the entitlement carries
// (`tutor.used`, `tutor.limit`, `tutor.resetsAt`) and never consults
// `PLAN_LIMITS` — outside `quota.ts` itself, that table's only importers are
// `readEntitlement.ts` and two unit-test files. So no rendered string and no
// FE-2 assertion depends on the plan and the allowance being coherent.
//
// NOT corrected here, deliberately, on two grounds. FE-2's expected note
// literals are hand-written with these exact numbers ("12/500" and "500/500",
// each in both locales, in `subscription.fixture.e2e.test.ts`), so editing the
// value turns a green lane red. And what a fixture's user is SUPPOSED to be is
// a fixture-ownership decision, not something to settle as a side effect of
// making a test agree with a constant.
//
// If you do correct it, these move TOGETHER or the lane goes red for the wrong
// reason: (1) this constant and `FIXTURE_UPLOAD_LIMIT`; (2)
// `FIXTURE_ENTITLEMENT_KNOWN.tutor.used`, since 12 is not a legal `used` under
// a limit of 5; (3) the four hardcoded `NOTE` literals in
// `subscription.fixture.e2e.test.ts`. The other direction — keep 500 and
// override `plan: "premium"` on both spreads — is one edit instead of three,
// but it changes what these fixtures are ABOUT (a premium user, hence a
// non-null `expiresAt` to decide as well). Which direction is right is the part
// that needs deciding, not the edit.
export const FIXTURE_TUTOR_LIMIT = 500;
export const FIXTURE_UPLOAD_LIMIT = 5;

/** Both counters readable — the state AC-042 is about: a remaining count and a
 *  reset date the user can read where they stand. */
export const FIXTURE_ENTITLEMENT_KNOWN: Entitlement = {
  ...FREE_FALLBACK,
  tutor: { state: "known", used: 12, limit: FIXTURE_TUTOR_LIMIT, resetsAt: FIXTURE_RESETS_AT },
  upload: { state: "known", used: 1, limit: FIXTURE_UPLOAD_LIMIT, resetsAt: FIXTURE_RESETS_AT },
};

/** No counter readable. Identical to `FREE_FALLBACK` on purpose — that is the
 *  value a real user gets both from the UI-phase stub and from a missing
 *  provider — and it is the fail-OPEN case: the note renders nothing while the
 *  surrounding page keeps working, with no `0` and no `—` standing in for a
 *  counter. */
export const FIXTURE_ENTITLEMENT_UNKNOWN: Entitlement = { ...FREE_FALLBACK };

/** `used >= limit`, the branch `isQuotaExhausted` answers true for. FE-2(e)
 *  asserts the rendered reason is NOT the generic `t("tutor.error")` string. */
export const FIXTURE_ENTITLEMENT_EXHAUSTED: Entitlement = {
  ...FREE_FALLBACK,
  tutor: {
    state: "known",
    used: FIXTURE_TUTOR_LIMIT,
    limit: FIXTURE_TUTOR_LIMIT,
    resetsAt: FIXTURE_RESETS_AT,
  },
  upload: { state: "known", used: 1, limit: FIXTURE_UPLOAD_LIMIT, resetsAt: FIXTURE_RESETS_AT },
};

// --- Order fixtures ---------------------------------------------------------

/** Transcribed from UI Spec C-13's normative eight-field `CheckoutOrder` (work
 *  plan § Reference Contract Values). RECONCILIATION OWNER: **backend-task-17**,
 *  which creates `lib/billing/checkoutOrder.ts` and carries the checklist line
 *  for replacing this declaration with a compile-time link. Until then, drift
 *  against the real `CheckoutOrder` is undetectable (see the file header). */
export type FixtureCheckoutOrder = {
  orderCode: number;
  amountVnd: number;
  status: string;
  pendingUntil: string;
  qrPayload: string;
  accountNumber: string;
  accountName: string;
  memo: string;
};

/** Transcribed from the frontend DD's `MyOrderRow` — S-05's list item.
 *  RECONCILIATION OWNER: **backend-task-19**, which creates
 *  `app/(billing)/queries.ts` where `MyOrderRow` is first exported. Until then,
 *  drift against it is undetectable (see the file header).
 *
 *  `status` is `string` and not the union on purpose (UI Spec C-09): the value
 *  crosses a database boundary whose CHECK can change without a TypeScript
 *  change, and the unrecognised branch is its honest destination. */
export type FixtureMyOrderRow = {
  orderCode: number;
  amountVnd: number;
  status: string;
  createdAt: string;
  pendingUntil: string;
};

/** Exactly the four literals `payment_orders.status`'s CHECK permits. */
export const FIXTURE_PERMITTED_STATUSES = ["pending", "paid", "expired", "cancelled"] as const;

/** Outside the CHECK, and unreachable by any code path: the backend DD states
 *  refunds are a bank action plus a hand-written SQL correction, so no
 *  `'refunded'` status exists to be set. It can therefore only arrive as schema
 *  drift — precisely the case C-09's fifth branch renders, and it must never
 *  read as `pending` or as `paid`. */
export const FIXTURE_UNRECOGNISED_STATUS = "refunded";

/** `PREMIUM_PRICE_VND` (AC-026). */
export const FIXTURE_AMOUNT_VND = 39_000;

/** A VietQR/EMVCo payload string, NOT a URL — C-12 must never be handed one,
 *  and a fixture carrying a URL would let that mistake pass unnoticed. */
export const FIXTURE_QR_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2";

const FIXTURE_ACCOUNT_NUMBER = "0011001234567";
const FIXTURE_ACCOUNT_NAME = "CONG TY TNHH MS MOLAR";

/** The transfer fields are identical across orders (one merchant account) and
 *  the memo carries the order code, so FE-1's byte-for-byte assertions fail on
 *  a blank-but-present `<dd>` instead of passing a presence check. */
function fixtureOrder(order: {
  orderCode: number;
  status: string;
  pendingUntil: string;
  qrPayload: string;
}): FixtureCheckoutOrder {
  return {
    orderCode: order.orderCode,
    amountVnd: FIXTURE_AMOUNT_VND,
    status: order.status,
    pendingUntil: order.pendingUntil,
    qrPayload: order.qrPayload,
    accountNumber: FIXTURE_ACCOUNT_NUMBER,
    accountName: FIXTURE_ACCOUNT_NAME,
    memo: `MSMOLAR ${order.orderCode}`,
  };
}

/** Live order: QR present, deadline in the future. */
export const FIXTURE_ORDER_PENDING = fixtureOrder({
  orderCode: 1755518400001,
  status: "pending",
  pendingUntil: FIXTURE_PENDING_UNTIL_FUTURE,
  qrPayload: FIXTURE_QR_PAYLOAD,
});

/** The same live order with NO QR — the screen must stay completable from the
 *  text block alone (AC-028, FE-AC-15, golden state 18).
 *
 *  "Absent" is the EMPTY payload, not a missing property: the normative
 *  `CheckoutOrder` declares `qrPayload: string`, and C-12's contract is stated
 *  over "no payload". Dropping the field would contradict the eight-field shape
 *  the UI Spec froze and would exercise a value the read path cannot produce.
 *
 *  DIFFERENCE FROM `FIXTURE_ORDER_PENDING`, precisely: `qrPayload` — the field
 *  under test — plus `orderCode` and the `memo` DERIVED from it. The order code
 *  must differ because it is the identity `fixtureOrderByCode` resolves on: two
 *  orders sharing a code could not both be reachable from `?order=`. Every
 *  other field (amount, status, deadline, account number, account name) is
 *  identical, so a completable-without-QR claim still cannot pass by accident.
 *  Assert each screen against ITS OWN fixture's values rather than comparing
 *  the two rendered screens field-by-field: the code and memo are expected to
 *  differ, and only `qrPayload` carries the claim. */
export const FIXTURE_ORDER_PENDING_NO_QR = fixtureOrder({
  orderCode: 1755518400002,
  status: "pending",
  pendingUntil: FIXTURE_PENDING_UNTIL_FUTURE,
  qrPayload: "",
});

export const FIXTURE_ORDER_PAID = fixtureOrder({
  orderCode: 1755431990003,
  status: "paid",
  pendingUntil: FIXTURE_PENDING_UNTIL_PAST,
  qrPayload: FIXTURE_QR_PAYLOAD,
});

export const FIXTURE_ORDER_EXPIRED = fixtureOrder({
  orderCode: 1755345600004,
  status: "expired",
  pendingUntil: FIXTURE_PENDING_UNTIL_PAST,
  qrPayload: FIXTURE_QR_PAYLOAD,
});

export const FIXTURE_ORDER_CANCELLED = fixtureOrder({
  orderCode: 1755259200005,
  status: "cancelled",
  pendingUntil: FIXTURE_PENDING_UNTIL_PAST,
  qrPayload: FIXTURE_QR_PAYLOAD,
});

/** The three terminal orders above and this one all keep a non-empty
 *  `qrPayload`, because the row really does carry the payload it was created
 *  with: S-06 must refuse to render the QR on the STATUS, never on the payload
 *  happening to be blank. */
export const FIXTURE_ORDER_UNRECOGNISED = fixtureOrder({
  orderCode: 1755172800006,
  status: FIXTURE_UNRECOGNISED_STATUS,
  pendingUntil: FIXTURE_PENDING_UNTIL_PAST,
  qrPayload: FIXTURE_QR_PAYLOAD,
});

export const FIXTURE_ORDERS: readonly FixtureCheckoutOrder[] = [
  FIXTURE_ORDER_PENDING,
  FIXTURE_ORDER_PENDING_NO_QR,
  FIXTURE_ORDER_PAID,
  FIXTURE_ORDER_EXPIRED,
  FIXTURE_ORDER_CANCELLED,
  FIXTURE_ORDER_UNRECOGNISED,
];

/** `null` for an unknown code — the same value a foreign order yields under
 *  `orders_select_own`, which is what makes C-13's four Empty inputs
 *  indistinguishable. */
export function fixtureOrderByCode(orderCode: number): FixtureCheckoutOrder | null {
  return FIXTURE_ORDERS.find((order) => order.orderCode === orderCode) ?? null;
}

/** S-05 reads `MyOrderRow` and S-06 reads `CheckoutOrder`, but both project the
 *  SAME database row. Deriving one from the other keeps the two
 *  representations from drifting into disagreeing about a single order — a
 *  disagreement FE-3 would then read as a state change it never caused. */
export function toFixtureOrderRow(
  order: FixtureCheckoutOrder,
  createdAt: string
): FixtureMyOrderRow {
  return {
    orderCode: order.orderCode,
    amountVnd: order.amountVnd,
    status: order.status,
    createdAt,
    pendingUntil: order.pendingUntil,
  };
}

/** Newest first — the order `listMyOrders()` reads in (`created_at desc`), so a
 *  driver-level "nothing reordered" check can compare against array order.
 *
 *  `createdAt` here is a LIST-ORDERING KEY ONLY, deliberately not constrained to
 *  `pendingUntil − 30m`: the two pending rows must keep the SAME
 *  `FIXTURE_PENDING_UNTIL_FUTURE` deadline (that identity is what keeps FE-1(d)
 *  unconfounded — see `FIXTURE_ORDER_PENDING_NO_QR`), and they must still sort
 *  deterministically, which two equal `createdAt` values would not. The second
 *  row's 35-minute spread is therefore expected and is not a window a code path
 *  produced. No case reads `createdAt` as a deadline; only S-05's sort order
 *  and its rendered date depend on it. */
export const FIXTURE_ORDER_ROWS: readonly FixtureMyOrderRow[] = [
  toFixtureOrderRow(FIXTURE_ORDER_PENDING, "2026-08-18T11:55:00.000Z"),
  toFixtureOrderRow(FIXTURE_ORDER_PENDING_NO_QR, "2026-08-18T11:50:00.000Z"),
  toFixtureOrderRow(FIXTURE_ORDER_PAID, "2026-08-17T09:00:00.000Z"),
  toFixtureOrderRow(FIXTURE_ORDER_EXPIRED, "2026-08-16T08:00:00.000Z"),
  toFixtureOrderRow(FIXTURE_ORDER_CANCELLED, "2026-08-15T07:00:00.000Z"),
  toFixtureOrderRow(FIXTURE_ORDER_UNRECOGNISED, "2026-08-14T06:00:00.000Z"),
];

/** FE-AC-04's empty-state profile — the four summary items still render above
 *  it, so "no orders" must not be reached by rendering nothing. */
export const FIXTURE_ORDER_ROWS_EMPTY: readonly FixtureMyOrderRow[] = [];

// --- Action-module responses ------------------------------------------------

/** Transcribed verbatim from the backend DD's `SettleResult`.
 *  RECONCILIATION OWNER: **backend-task-16**, which creates
 *  `lib/billing/settleOrder.ts` where `SettleResult` is first exported. Until
 *  then, drift against it is undetectable (see the file header). */
export type FixtureSettleResult =
  | { settled: true; expiresAt: string }
  | {
      settled: false;
      reason:
        | "unknown_order"
        | "not_pending"
        | "not_paid_yet"
        | "amount_mismatch"
        | "provider_unavailable";
    };

/** C-10's SEVENTH outcome — `guard()`'s refusal (AC-037). Neither Design Doc
 *  states its wire shape: `SettleResult` declares exactly five reasons and
 *  rate-limited is not one of them, and the encoding is decided by the task
 *  that writes `recheckOrder()` — RECONCILIATION OWNER: **backend-task-18**
 *  (`lib/billing/orderActions.ts`). It is modelled here as a
 *  branch of its own, shaped after this repo's shipped typed-refusal convention
 *  (`{ error: "rate_limited" }` — `(layer2)/actions.ts:239`,
 *  `tutorActions.ts:183`), and deliberately NOT as a sixth `reason`: widening
 *  the declared union here would invent a contract this file has no authority
 *  to decide, and would hide the drift instead of surfacing it. */
export type FixtureRateLimitedRefusal = { error: "rate_limited" };

export type FixtureRecheckOutcome = FixtureSettleResult | FixtureRateLimitedRefusal;

/** One value per rendered outcome, so a case selects the branch it means rather
 *  than rebuilding the union inline. The keys match C-10's dictionary keys
 *  one-to-one, and no two outcomes share a sentence. */
export const FIXTURE_RECHECK_OUTCOMES = {
  settled: { settled: true, expiresAt: "2026-09-17T12:00:00.000Z" },
  stillPending: { settled: false, reason: "not_paid_yet" },
  notPending: { settled: false, reason: "not_pending" },
  unknownOrder: { settled: false, reason: "unknown_order" },
  amountMismatch: { settled: false, reason: "amount_mismatch" },
  providerUnavailable: { settled: false, reason: "provider_unavailable" },
  rateLimited: { error: "rate_limited" },
} as const satisfies Record<string, FixtureRecheckOutcome>;

// --- Action-module stub layer (the sanctioned mock boundary) -----------------

/** The override-boundary contract a real harness must expose over the
 *  `createOrder` / `recheckOrder` action modules. Invocation COUNTS are part of
 *  the contract rather than a convenience: FE-1 proves no call occurs on the
 *  fail-closed branch and FE-3 proves two synchronous activations produce
 *  exactly one call, and neither claim is observable in rendered output. The
 *  recorded order codes travel with them, because one call against the wrong
 *  order is still a count of one. */
export interface SubscriptionActionStubs {
  createOrderCallCount: number;
  recheckOrderCallCount: number;
  /** Order codes passed to `recheckOrder`, in invocation order. */
  recheckedOrderCodes: number[];
  setCreateOrderResponse(order: FixtureCheckoutOrder): void;
  setRecheckOutcome(outcome: FixtureRecheckOutcome): void;
  /** Called by the harness's module-boundary override in place of the real
   *  `createOrder()` — counts the invocation, then resolves the configured
   *  order. No provider is contacted and no money moves. */
  simulateCreateOrder(): Promise<FixtureCheckoutOrder>;
  /** Called in place of the real `recheckOrder(orderCode)` — counts the
   *  invocation and records the code, then resolves the configured outcome. */
  simulateRecheckOrder(orderCode: number): Promise<FixtureRecheckOutcome>;
  /** Arms the hold: from the next call on, `simulateRecheckOrder` counts and
   *  records as usual and then STAYS UNRESOLVED until `releaseHeldRecheck()`.
   *  The arm is not consumed by the first call — a second, dogpiled call is
   *  held too, so the count FE-3(f) reads is never decided by which call
   *  happened to settle first. */
  holdNextRecheck(): void;
  /** Resolves every held call with the outcome configured AT RELEASE TIME (so a
   *  case can hold, change the outcome, then release) and disarms the hold. */
  releaseHeldRecheck(): void;
  /** Back to the defaults, so cases sharing one harness stay independent.
   *  Releases any held call first — a leaked hold would strand the next case's
   *  activation in flight rather than failing it. */
  reset(): void;
}

/** Deterministic in-memory reference implementation — fixed fixture data, no
 *  real clock, no network. A real harness routes each intercepted action call
 *  to the matching `simulate*` method here.
 *
 *  BOTH `simulate*` METHODS ARE ASYNC, and that is load-bearing rather than
 *  cosmetic. The real `createOrder` / `recheckOrder` are Server Actions, so
 *  every call has an IN-FLIGHT WINDOW, and FE-3(f)'s dogpile guard is an
 *  in-flight guard: it only has anything to suppress while the first call is
 *  still outstanding. Against a synchronous stub there is no such window — two
 *  activations are two fully-settled calls, so a CORRECT implementation records
 *  2 and FE-3(f) fails, while red/green is decided by microtask timing instead
 *  of by the guard. FE-3(a)/(e) need the same window for the busy state. The
 *  synchronous sibling in `history.fixture.e2e.test.ts` is synchronous only
 *  because none of its obligations involve an in-flight window; it is not a
 *  reason to stay synchronous here.
 *
 *  The counters are incremented BEFORE the hold is awaited, so they measure
 *  INVOCATION, not completion — a held call is already counted. FE-3(f) then
 *  reads: `holdNextRecheck()`, activate, activate again, assert
 *  `recheckOrderCallCount === 1`, `releaseHeldRecheck()`, assert the rendered
 *  outcome. */
export function createSubscriptionActionStubs(): SubscriptionActionStubs {
  let createOrderResponse: FixtureCheckoutOrder = FIXTURE_ORDER_PENDING;
  let recheckOutcome: FixtureRecheckOutcome = FIXTURE_RECHECK_OUTCOMES.stillPending;
  let releaseHold: (() => void) | null = null;
  let heldGate: Promise<void> | null = null;

  const stubs: SubscriptionActionStubs = {
    createOrderCallCount: 0,
    recheckOrderCallCount: 0,
    recheckedOrderCodes: [],
    setCreateOrderResponse(order) {
      createOrderResponse = order;
    },
    setRecheckOutcome(outcome) {
      recheckOutcome = outcome;
    },
    async simulateCreateOrder() {
      stubs.createOrderCallCount += 1;
      return createOrderResponse;
    },
    async simulateRecheckOrder(orderCode) {
      stubs.recheckOrderCallCount += 1;
      stubs.recheckedOrderCodes.push(orderCode);
      // Captured before the await: `releaseHeldRecheck()` clears `heldGate`,
      // and a call already waiting must still be woken by that same gate.
      const gate = heldGate;
      if (gate) await gate;
      // Read after the await, so an outcome configured during the hold applies.
      return recheckOutcome;
    },
    holdNextRecheck() {
      if (heldGate) return;
      heldGate = new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
    },
    releaseHeldRecheck() {
      releaseHold?.();
      releaseHold = null;
      heldGate = null;
    },
    reset() {
      stubs.releaseHeldRecheck();
      stubs.createOrderCallCount = 0;
      stubs.recheckOrderCallCount = 0;
      stubs.recheckedOrderCodes = [];
      createOrderResponse = FIXTURE_ORDER_PENDING;
      recheckOutcome = FIXTURE_RECHECK_OUTCOMES.stillPending;
    },
  };
  return stubs;
}

// --- Driver (Playwright `Page`/`Locator` structural subset) -----------------

export interface SubscriptionRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SubscriptionLocator {
  click(): Promise<void>;
  focus(): Promise<void>;
  count(): Promise<number>;
  first(): SubscriptionLocator;
  nth(index: number): SubscriptionLocator;
  isVisible(): Promise<boolean>;
  textContent(): Promise<string | null>;
  allTextContents(): Promise<string[]>;
  /** `null` when the attribute is absent — how these cases prove no control
   *  carries native `disabled` (AC-043) with no jest-dom matcher available. */
  getAttribute(name: string): Promise<string | null>;
  /** `null` = not in DOM / not laid out — real Playwright semantics. */
  boundingBox(): Promise<SubscriptionRect | null>;
}

export interface SubscriptionDriver {
  goto(url: string): Promise<void>;
  url(): string;
  setViewportSize(size: { width: number; height: number }): Promise<void>;
  getByRole(role: string, options?: { name?: string | RegExp }): SubscriptionLocator;
  getByText(text: string | RegExp): SubscriptionLocator;
  /** Raw CSS query. `locator(":focus")` is how the focus claims are read
   *  (FE-3(e): focus stays on the activated control after the outcome lands). */
  locator(selector: string): SubscriptionLocator;
  keyboard: { press(key: string): Promise<void> };
  /** Real Playwright `page.clock` — pinned to `FIXTURE_NOW`, so "pending until
   *  is in the future" cannot decay into a flake. */
  clock: { setFixedTime(time: string | Date): Promise<void> };

  // Beyond the strict Playwright subset, and harness-provided — the same call
  // `supportFixtureData.ts` makes with its own `querySelectorCount`.

  /** Raw DOM node count, not accessibility-tree-only: proves a node does not
   *  exist at all, rather than merely being unnamed or hidden. */
  querySelectorCount(selector: string): Promise<number>;
  /** True when the first match of `beforeSelector` precedes the first match of
   *  `afterSelector` in DOCUMENT order. AC-039 is an order claim, not a
   *  presence claim, and every "the link exists" assertion stays green while
   *  the links sit after the confirm control. */
  precedesInDocumentOrder(beforeSelector: string, afterSelector: string): Promise<boolean>;
  /** `documentElement.scrollWidth - clientWidth` in CSS px; 0 means no
   *  horizontal overflow. The 360px floor is measured, never eyeballed. */
  horizontalOverflowPx(): Promise<number>;
  /** Sets `FIXTURE_LOCALE_COOKIE` in the browser context. The copy assertions
   *  run per locale and must come from the real dictionaries, because the copy
   *  is the thing under test. */
  setLocale(locale: Locale): Promise<void>;
  /** Pins the browser context's timezone — implemented by the harness as
   *  Playwright's context option `timezoneId`, which has no `Page`-level
   *  equivalent and is therefore harness-provided rather than part of the
   *  subset. FE-2(b) calls it with `FIXTURE_BROWSER_TIMEZONE` before navigating:
   *  without it the context inherits the OS zone, and on an ICT machine an
   *  unpinned formatter passes FE-2(b) by accident (see
   *  `FIXTURE_BROWSER_TIMEZONE`). `clock.setFixedTime` pins the instant only,
   *  never the zone, so the two pins are independent and both are required. */
  setTimezone(timeZoneId: string): Promise<void>;
}
