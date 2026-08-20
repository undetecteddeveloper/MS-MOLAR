// Subscription (payOS prepaid period) — SERVICE-LANE fixture module. Consumed by
// `subscription.service.e2e.test.ts`: SVC-1 (plan Task 6.1 / backend-task-29) and
// SVC-2 (plan Task 6.2 / backend-task-30). Collected only by
// `SOURCE/vitest.localdb.config.ts` (`npm run test:localdb`), never by `npm test`.
//
// NOTHING HERE HAS BEEN RUN, AND THAT IS THE STATE THIS FILE SHIPS IN.
//   `payment_orders`, `subscriptions` and `record_payment_settlement` do not exist
//   on any database yet, and schema gate B (plan Task 1.3 / backend-task-11) has not
//   run on dev. So: teardown is idempotent BY CONSTRUCTION — every step is a
//   predicate `delete()` with no read-modify-write, and `tearDown()` is runnable
//   before `setUp()` has ever run — which is a structural property, NOT an observed
//   one. The two-runs-in-a-row check the task specifies is
//   `tearDown(); setUp(); tearDown();` twice over, asserting `countFixtureRows()`
//   returns all zeros after each teardown, and it is owed the moment gate B is green.
//
// PRECEDENT. `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (this
//   repository's only existing service-lane test) and `SOURCE/supabase/test-rls.ts`:
//   hand-loaded `.env.local`, a service-role `admin` client for seeding, a REAL
//   signed-in anon client per user for anything RLS decides, a per-fixture id prefix,
//   and cleanup that runs before AND after.
//
// WHAT THE `sub-svc-` PREFIX CAN AND CANNOT SCOPE — stated because a prefix that does
//   not reach a table is the exact way a "prefixed teardown" quietly leaks.
//   `payment_orders.order_code` is a `bigint` PRIMARY KEY and `subscriptions.user_id`
//   is a uuid: NEITHER can carry the literal string `sub-svc-`. This is the situation
//   `test-rls.ts` already hit with `support_tickets.id`, and it is resolved the same
//   way — scope by the owning `user_id`. This module therefore tears down by THREE scopes,
//   and each exists because the others miss something:
//     1. `user_id` in this case's two fixture accounts — the ONLY scope that catches
//        rows written by the code under test, whose `order_code` and `memo` this
//        module never chooses (`createOrder()` mints its own).
//     2. A reserved `order_code` BLOCK — catches rows this module seeded whose
//        `user_id` was set to null by an account deletion (the column is
//        `on delete set null`, deliberately: a money record outlives the account).
//     3. The account EMAIL prefix — how a crashed earlier run's accounts are found at
//        all, since their ids died with the process that created them.
//   `memo` carries a `sub-svc-<caseTag>` marker and is a fourth scope, but a DETECTION
//   one only (`countFixtureRows()`), never a delete predicate: production `createOrder()`
//   writes its own `MSMOLAR <code>` memo, which this marker can never match, so a
//   memo-scoped DELETE would silently miss precisely the rows scope 1 exists for.
//   Scope 2 is exhaustive for SEEDED rows and is kept that way by a bound check:
//   `seedPendingOrder()` REJECTS an `orderCode` outside the block, so no row this module
//   writes can end up reachable by scope 1 alone — which is what an account deletion
//   would then strand, since it nulls `user_id` rather than deleting the row.
//
//   WHICH OF THE THREE SCOPES IS ACTUALLY PROVEN, and by what. Stated because the
//   paragraph above is a normative claim, and a normative claim no test reaches is the
//   defect shape this lane exists to catch.
//     - Scope 2 (block) is PROVEN, by SVC-1's orphan case: it manufactures the one row
//       shape scope 2 uniquely reaches — `user_id` NULL — and asserts the row is gone
//       after `tearDown()`. Deleting the block delete below makes that case red.
//     - Scope 1 (`user_id`) is UNPROVEN in the service lane, and cannot be proven there:
//       a row reachable by scope 1 ALONE must sit outside the reserved block, and
//       `requireCodeInBlock()` refuses to seed one. Only a case that drives production
//       `createOrder()` — which mints its own code — can build one, and no SVC-1 case
//       does. Deleting the `user_id` delete below therefore leaves the whole lane green.
//     - Scope 3 (email prefix) is exercised by every `setUp()`, which tears down first.
//   Teardown's row counts prove the UNION of scopes 1 and 2, not either one alone.
//
// WHAT `countFixtureRows()` CAN AND CANNOT OBSERVE — stated because a leak detector that
//   cannot fail is worse than none, since it reads as evidence.
//     - `authUsers` is ENTAILED, not observed: `tearDown()` deletes every listed account
//       and `deleteUser` throws on error, so a returning `listFixtureUsers()` is empty by
//       construction. It carries NO discriminating power after a teardown that returned.
//     - `subscriptions` is ENTAILED too, twice over: `subscriptions.user_id` is
//       `on delete cascade`, and with no accounts left the id list is empty, so the branch
//       is skipped and returns 0 WITHOUT QUERYING. Also no discriminating power.
//     - `paymentOrders` is the one count that can fail for the right reason, and only
//       because of the `memo` scope: the block and `user_id` scopes re-ask exactly the two
//       predicates the delete just ran, so they answer 0 whether or not it worked. The
//       `memo` scope shares no predicate with any delete.
//   So the two-runs-in-a-row check owed once gate B is green proves fixture hygiene for
//   `payment_orders` and, for the other two scopes, proves only that teardown did not
//   throw. That is what those numbers are worth; reading them as more would be the hollow
//   assertion this lane exists to avoid.
//
// FIXTURE ACCOUNTS ARE DELETED, unlike the two precedent files which keep theirs.
//   Three reasons, all load-bearing here and not there: (a) the task's own success
//   criterion counts remaining `sub-svc-` rows in the AUTH USERS table too;
//   (b) `subscriptions` is keyed by `user_id`, so a persistent account carries its
//   `expires_at` into the next run and SVC-1's "advanced by exactly 30 days from the
//   pre-state" would be measured from whatever the previous run left behind;
//   (c) `guard()` rate limits are keyed by user id in Upstash and survive across runs
//   — the hazard `recordSkillMastery.int.test.ts` records against its own persistent
//   account. Deletion order is orders → subscriptions → accounts, so no order is ever
//   orphaned by the cascade it would otherwise hit.
//
// TRANSCRIBED VALUES AND THEIR RECONCILIATION OWNERS. Most of what this module names
//   still does not exist in code, so those constants remain transcriptions with NO
//   compile-time link to the real declaration — `tsc` cannot see drift there, and
//   saying otherwise would be the false claim the sibling fixture-e2e harness was
//   corrected for. Owners:
//     - `FixturePaymentStatusResult`            -> RECONCILED (backend-task-15 shipped).
//       It is now `Awaited<ReturnType<typeof getPaymentStatus>>` — a compile-time LINK
//       to the adapter's real return type, not a hand-copied shape. This is the one
//       transcription whose drift was both silent and load-bearing: the two-property
//       object IS P-1, so an adapter that grew a third property would have left this
//       file quietly describing a boundary that no longer existed.
//     - `FIXTURE_AMOUNT_VND`, the 30-min window -> RECONCILED (backend-task-12 shipped).
//       Both are now IMPORTED from `lib/billing/pricing.ts`, not transcribed, so `tsc`
//       does see drift on these two and the caveat above no longer applies to them.
//     - `FIXTURE_PERIOD_DAYS`, every table and column name -> backend-task-09 (`schema.sql`)
//   The column names differ from the type transcriptions in one way worth stating:
//   they cross PostgREST as STRINGS, so no compile-time link is possible for them at
//   all — but they are detectable at RUN time, loudly, on the first insert once gate B
//   is green. That is a weaker guarantee than a type error and a stronger one than
//   nothing, and it is the honest description of both.
//
// THE ADAPTER'S RETURN SHAPE — the contradiction was INTRA-DOCUMENT, and it has been
//   corrected at the source rather than worked around here. The backend DD required the
//   two-property object in THREE places — § "Payer-identifying data is never stored
//   either" (P-1, normative: *"`settleOrder()` reads only `status` and `amount`"*), the
//   Field Propagation Map's `transactions[]` row (*"carries `status` and `amount` and
//   nothing else"*) and the P-1 verification mechanism (*"asserted to have exactly two
//   properties"*) — while ONE line, the signature block under § `lib/billing/payos/`,
//   still declared the bare union `Promise<"pending"|"paid"|"cancelled"|"unknown">`. The
//   work plan's Connection Map, backend-task-15 and backend-task-16 agree with the three,
//   and the two-property object is the only shape under which `settleOrder()` step 3 can
//   compare the provider's amount against the stored row, which SVC-1 exercises. Since
//   the stale line sat in the block a backend-task-15 implementer copies from, it was
//   corrected in the DD (v1.7) instead of being annotated here. backend-task-15 has
//   since landed the two-property object, and this file no longer restates it: the
//   type below is derived from the adapter's own signature, so an adapter that landed
//   anything else is now a `tsc` error here rather than a surprise when SVC-1 runs.
//
// COUNTS MEASURE INVOCATION, NOT COMPLETION. Every counter is incremented BEFORE the
//   hold gate is awaited and before any rejection is thrown, so a call that is in
//   flight — or one that is about to fail — is already counted. SVC-1(f) asserts the
//   count is exactly 1 against a REJECTING adapter, and SVC-2(e) asserts 0 per refusal
//   branch; both read a number a completion-counting stub would get wrong.
//
// NO SHARED MUTABLE STATE. Every fixture is created by
//   `createSubscriptionServiceFixture()` and owns its accounts, its order-code block
//   and its adapter stub, so two cases cannot reach each other's rows. The file's one
//   piece of module-level state is the append-only `caseTag` / `orderCodeBlock` registry
//   next to the constructor: no fixture behaviour ever reads it, it only throws on reuse
//   at construction time, and it exists because the alternative was enforcing the two
//   isolation rules by review. The other piece that cannot live here is the session
//   holder the `vi.mock("@/lib/supabase/server")`
//   factory reads: `vi.mock` is hoisted above imports, so the holder has to be created
//   in the test file with `vi.hoisted` (exactly as `recordSkillMastery.int.test.ts`
//   does) and handed in. It is an injected parameter, not a shared global:
//
//     const { sessionHolder } = vi.hoisted(() => ({
//       sessionHolder: { current: null as SupabaseClient | null },
//     }));
//     vi.mock("@/lib/supabase/server", () => ({
//       createClient: async () => {
//         if (!sessionHolder.current) throw new Error("no active fixture session");
//         return sessionHolder.current;
//       },
//     }));

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ORDER_PENDING_WINDOW_MS, PREMIUM_PRICE_VND } from "@/lib/billing/pricing";
import type { getPaymentStatus } from "@/lib/billing/payos";

// --- Environment ------------------------------------------------------------

/** Vitest does not load `.env.local`; the precedent file loads it by hand and so does
 *  this one. Outer quotes are stripped because Next strips them when it loads the same
 *  file, so several values in it are written quoted and still work in production.
 *  Never overrides a variable already present in the environment. */
function loadEnvLocal(): void {
  const path = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Gate for `describe.skipIf(!HAS_LIVE_DB)`, read at import time because the skip is
 *  decided at collection time. It says three environment variables are present and
 *  NOTHING MORE — in particular it does not say schema gate B is green, which is the
 *  separate, blocking precondition for running any case in this lane at all. */
export const HAS_LIVE_DB = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

// --- Transcribed values (see the header for reconciliation owners) -----------

/** The lane's isolation marker. It reaches the account emails and `payment_orders.memo`;
 *  it cannot reach `order_code` or `user_id` — see the header. */
export const SUB_SVC_PREFIX = "sub-svc-";

/** The real `PREMIUM_PRICE_VND` (AC-026), imported rather than transcribed. A price
 *  change now moves the seeded amount with it; the previous hand-copied `39_000` would
 *  have left this lane silently seeding the old price against the new code. */
export const FIXTURE_AMOUNT_VND = PREMIUM_PRICE_VND;

/** `record_payment_settlement(p_period_days default 30)`. Transcribed — owner
 *  backend-task-09. SVC-1 computes its expected instants from this and asserts them as
 *  literals; it must never read the granted period back from the function under test. */
export const FIXTURE_PERIOD_DAYS = 30;

/** Order codes are allocated from a reserved band far above epoch-milliseconds, which
 *  is what a real `createOrder()` derives its codes from — so a fixture code cannot
 *  collide with a real one, and the block delete in `tearDown()` cannot reach a real
 *  row. Each fixture instance owns one block of `FIXTURE_ORDER_CODE_BLOCK_SIZE`
 *  consecutive codes. */
export const FIXTURE_ORDER_CODE_BASE = 8_000_000_000_000;
export const FIXTURE_ORDER_CODE_BLOCK_SIZE = 1_000;

/** A VietQR/EMVCo payload string, not a URL (UI-D14). Inert here — no service case
 *  reads it as a QR — but the column is `not null` and a blank value would let an
 *  "all four transfer fields survived" assertion pass against an empty row. */
const FIXTURE_QR_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2";
const FIXTURE_ACCOUNT_NUMBER = "0011001234567";
const FIXTURE_ACCOUNT_NAME = "CONG TY TNHH MS MOLAR";

const FIXTURE_PASSWORD = "sub-svc-password-123";

/** Upper bound on rows read while counting leftovers. A case seeds single digits of
 *  rows, so reaching this limit means something is badly wrong — and the reported count
 *  would then be a floor rather than a total. Explicit rather than relying on
 *  PostgREST's implicit page size, which truncates silently. */
const FIXTURE_ROW_SCAN_LIMIT = 1_000;

// --- Row shapes (transcribed column names — owner backend-task-09) -----------

/** The eleven `payment_orders` columns. Rows are read with `select("*")` and this type
 *  is a view over the result, so a twelfth column added later still participates in
 *  SVC-2's byte-identity comparison instead of being projected away by the select. */
export interface PaymentOrderRow {
  order_code: number;
  user_id: string | null;
  amount: number;
  status: string;
  created_at: string;
  pending_until: string;
  settled_at: string | null;
  qr_payload: string;
  account_number: string;
  account_name: string;
  memo: string;
}

export interface SubscriptionRow {
  user_id: string;
  expires_at: string;
  period_anchor_at: string;
  updated_at: string;
}

/** What `seedPendingOrder()` wrote, in the caller's vocabulary — returned so a case can
 *  assert against the values it asked for rather than re-reading the row it is about to
 *  make claims about. */
export interface SeededOrder {
  orderCode: number;
  userId: string;
  amountVnd: number;
  status: string;
  pendingUntil: string;
  memo: string;
}

export interface SeedOrderOverrides {
  /** Must lie inside this fixture's reserved block, and is rejected otherwise — a row
   *  outside the block is reachable by the owning-`user_id` scope alone, so it would
   *  survive teardown the moment its account deletion nulled that column. */
  orderCode?: number;
  amountVnd?: number;
  /** One of the four `payment_orders.status` CHECK literals. */
  status?: string;
  /** Defaults to now + the 30-minute window. Pass a past instant for the
   *  expired-window branch. Deliberately relative to the real clock: the predicate
   *  under test compares against Postgres `now()`, and this lane has no clock control
   *  over the database — there is no pin here and none is claimed. */
  pendingUntil?: string;
}

// --- The counted payOS adapter stub -----------------------------------------

/** `getPaymentStatus()`'s return, LINKED to the adapter rather than transcribed from
 *  it: exactly two properties, and exactly two is the point (P-1) — the adapter is
 *  where provider vocabulary stops. A third property appearing on the real return type
 *  is a compile error in every SVC case that reads this stub, which is the only thing
 *  that makes the drift visible before a settlement run. See the header.
 *
 *  Type-only import: `lib/billing/payos/index.ts` carries `import "server-only"`, so
 *  pulling it in as a value would throw the moment this module loads. `import type`
 *  is erased, so the link costs nothing at run time. */
export type FixturePaymentStatusResult = Awaited<ReturnType<typeof getPaymentStatus>>;

export type PayosPaymentStatus = FixturePaymentStatusResult["status"];

/** Only `getPaymentStatus` is stubbed. `createPaymentRequest` and
 *  `verifyWebhookSignature` are deliberately absent: neither SVC case reaches them
 *  (both seed their orders directly rather than going through `createOrder()`), and
 *  transcribing `createPaymentRequest`'s seven-field return would add a second
 *  undetectable-drift surface for nothing. Whoever needs them adds them. */
export interface PayosAdapterStub {
  /** Incremented on ENTRY to `simulateGetPaymentStatus` — before the hold gate and
   *  before any rejection. A held or failing call is already counted. */
  getPaymentStatusCallCount: number;
  /** Order codes passed to `simulateGetPaymentStatus`, in invocation order: one call
   *  against the wrong order is still a count of one. */
  getPaymentStatusOrderCodes: number[];
  setPaymentStatus(result: FixturePaymentStatusResult): void;
  /** Arms a rejection for every subsequent call; `null` disarms. SVC-1(f) asserts the
   *  invocation count is exactly 1 after one rejected call — no retry storm. */
  setPaymentStatusRejection(error: Error | null): void;
  /** Stands in for the real `getPaymentStatus(orderCode)`. No provider is contacted and
   *  no money moves. */
  simulateGetPaymentStatus(orderCode: number): Promise<FixturePaymentStatusResult>;
  /** Arms the hold: from the next call on, `simulateGetPaymentStatus` counts and records
   *  as usual and then STAYS UNRESOLVED until `releaseHeldPaymentStatus()`. The arm is
   *  not consumed by the first call, so a second concurrent call is held too — which is
   *  what makes SVC-1's concurrent-settlement case (the one that proves the recorded
   *  ADR-0014 two-statement deviation rather than assuming it) contend deterministically
   *  instead of on whichever call the network happened to answer first. */
  holdNextPaymentStatus(): void;
  /** Resolves every held call with the result configured AT RELEASE TIME, so a case can
   *  hold, reconfigure, then release. Disarms the hold. */
  releaseHeldPaymentStatus(): void;
  /** Back to the defaults. Releases any held call first — a leaked hold would strand the
   *  next branch's call in flight rather than failing it. SVC-2 calls this between its
   *  two refusal branches, because each branch asserts its own count of 0.
   *
   *  A call held across a `reset()` RESOLVES with the restored default; it does not
   *  reject, even if a rejection was armed when it was invoked, because the rejection is
   *  read after the wake and `reset()` has already disarmed it. Deliberate: a stale error
   *  surfacing inside the NEXT case is worse than a defaulted value escaping the previous
   *  one. Its invocation was already counted on the counter `reset()` then zeroed. */
  reset(): void;
}

const DEFAULT_PAYMENT_STATUS: FixturePaymentStatusResult = {
  status: "pending",
  amount: FIXTURE_AMOUNT_VND,
};

export function createPayosAdapterStub(): PayosAdapterStub {
  let result: FixturePaymentStatusResult = { ...DEFAULT_PAYMENT_STATUS };
  let rejection: Error | null = null;
  let releaseHold: (() => void) | null = null;
  let heldGate: Promise<void> | null = null;

  const stub: PayosAdapterStub = {
    getPaymentStatusCallCount: 0,
    getPaymentStatusOrderCodes: [],
    setPaymentStatus(next) {
      // Copied, not aliased: `DEFAULT_PAYMENT_STATUS` is spread on both paths that
      // install it, and a caller-owned object retained by identity would let a later
      // mutation of it change what an already-configured stub answers.
      result = { ...next };
    },
    setPaymentStatusRejection(error) {
      rejection = error;
    },
    async simulateGetPaymentStatus(orderCode) {
      stub.getPaymentStatusCallCount += 1;
      stub.getPaymentStatusOrderCodes.push(orderCode);
      // Captured before the await: `releaseHeldPaymentStatus()` clears `heldGate`, and a
      // call already waiting must still be woken by that same gate.
      const gate = heldGate;
      if (gate) await gate;
      // Read after the await, so a rejection or result configured during the hold
      // applies to the call that was held.
      if (rejection) throw rejection;
      return result;
    },
    holdNextPaymentStatus() {
      if (heldGate) return;
      heldGate = new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
    },
    releaseHeldPaymentStatus() {
      releaseHold?.();
      releaseHold = null;
      heldGate = null;
    },
    reset() {
      stub.releaseHeldPaymentStatus();
      stub.getPaymentStatusCallCount = 0;
      stub.getPaymentStatusOrderCodes = [];
      result = { ...DEFAULT_PAYMENT_STATUS };
      rejection = null;
    },
  };
  return stub;
}

// --- The fixture ------------------------------------------------------------

export type FixtureUserRole = "A" | "B";

/** The `vi.hoisted` object the test file's `vi.mock("@/lib/supabase/server")` factory
 *  reads. Injected rather than owned here because `vi.mock` is hoisted above imports —
 *  see the header. */
export interface ServiceSessionHolder {
  current: SupabaseClient | null;
}

export interface SubscriptionServiceFixtureOptions {
  /** Distinguishes this case's accounts and memos. Lowercase letters, digits and
   *  hyphens only, because it goes into an email local part. Must be unique within the
   *  file — reuse throws, see the registry next to `createSubscriptionServiceFixture()`. */
  caseTag: string;
  /** 0-based; each block is `FIXTURE_ORDER_CODE_BLOCK_SIZE` codes wide. Two cases in the
   *  same file must pass different blocks — that, together with the per-case accounts, is
   *  what makes one case's teardown unable to reach another case's rows — and reuse
   *  throws rather than relying on that being remembered. */
  orderCodeBlock: number;
  sessionHolder: ServiceSessionHolder;
}

/** All three must be 0 after `tearDown()`. Reported separately rather than summed: which
 *  one is non-zero says which scope leaked. Only `paymentOrders` can be non-zero after a
 *  teardown that returned — the other two are entailed by teardown's own actions, see the
 *  header's "what `countFixtureRows()` can and cannot observe". */
export interface FixtureRowCounts {
  paymentOrders: number;
  subscriptions: number;
  authUsers: number;
}

export interface SubscriptionServiceFixture {
  /** The counted payOS stub this case's `vi.mock` of `@/lib/billing/payos/` routes to. */
  readonly adapter: PayosAdapterStub;
  /** Tears down first — so a run that crashed before its own teardown cannot contaminate
   *  this one — then creates both accounts, signs both in, and makes A the active
   *  session. */
  setUp(): Promise<void>;
  /** Idempotent by construction: predicate deletes only, and runnable before `setUp()`.
   *  Also releases the adapter hold and clears the session holder. */
  tearDown(): Promise<void>;
  countFixtureRows(): Promise<FixtureRowCounts>;
  userId(role: FixtureUserRole): string;
  /** The signed-in anon client for one role — RLS applies to it. This is the "two real
   *  sessions against one database" SVC-2 requires; a mocked client would assert the
   *  mock's `null` rather than the `orders_select_own` policy's. */
  sessionFor(role: FixtureUserRole): SupabaseClient;
  /** Points the injected holder at one role, i.e. decides who the next Server Action call
   *  runs as. */
  useSession(role: FixtureUserRole): void;
  /** The service-role client, for seeding and for reading state back past RLS. One per
   *  fixture, so no case builds a second privileged client with its own env handling. */
  admin(): SupabaseClient;
  nextOrderCode(): number;
  seedPendingOrder(role: FixtureUserRole, overrides?: SeedOrderOverrides): Promise<SeededOrder>;
  seedSubscription(
    role: FixtureUserRole,
    subscription: { expiresAt: string; periodAnchorAt: string }
  ): Promise<void>;
  readOrderRow(orderCode: number): Promise<PaymentOrderRow | null>;
  readSubscriptionRow(role: FixtureUserRole): Promise<SubscriptionRow | null>;
}

const CASE_TAG_PATTERN = /^[a-z0-9-]+$/;

/** The only module-level state in this file, and it is APPEND-ONLY and never read by any
 *  fixture behaviour — its sole effect is to throw at construction time, before any
 *  network call, so it cannot make one case's rows visible to another. It exists because
 *  the two isolation rules were otherwise enforced by review alone and both fail
 *  destructively and silently: two fixtures sharing a `caseTag` share an email prefix, so
 *  the second one's `setUp()` — which tears down first — DELETES THE FIRST ONE'S ACCOUNTS
 *  mid-run, and two sharing an `orderCodeBlock` delete each other's orders.
 *
 *  Scope: one module registry per test file, which is exactly where the rule bites (two
 *  cases in one file). It says nothing across files; two files may legitimately reuse a
 *  block, which is why the accounts are per-`caseTag` as well.
 *
 *  It does forbid one legitimate-looking pattern: re-constructing the same fixture per
 *  test in `beforeEach`. Construct once at `describe` scope and call `setUp()` per test —
 *  `setUp()` is the idempotent entry point, and re-construction buys nothing. */
const claimedCaseTags = new Set<string>();
const claimedOrderCodeBlocks = new Set<number>();

export function createSubscriptionServiceFixture(
  options: SubscriptionServiceFixtureOptions
): SubscriptionServiceFixture {
  const { caseTag, orderCodeBlock, sessionHolder } = options;
  if (!CASE_TAG_PATTERN.test(caseTag)) {
    throw new Error(`caseTag must match ${String(CASE_TAG_PATTERN)}: got "${caseTag}"`);
  }
  if (!Number.isInteger(orderCodeBlock) || orderCodeBlock < 0) {
    throw new Error(`orderCodeBlock must be a non-negative integer: got ${orderCodeBlock}`);
  }
  if (claimedCaseTags.has(caseTag)) {
    throw new Error(
      `caseTag "${caseTag}" is already claimed in this file — two fixtures sharing a tag ` +
        `share an email prefix, so one setUp() would delete the other's accounts`
    );
  }
  if (claimedOrderCodeBlocks.has(orderCodeBlock)) {
    throw new Error(
      `orderCodeBlock ${orderCodeBlock} is already claimed in this file — two fixtures ` +
        `sharing a block would delete each other's orders`
    );
  }
  claimedCaseTags.add(caseTag);
  claimedOrderCodeBlocks.add(orderCodeBlock);

  const emailPrefix = `smithnguyen247+${SUB_SVC_PREFIX}${caseTag}-`;
  const emailFor = (role: FixtureUserRole) => `${emailPrefix}${role.toLowerCase()}@gmail.com`;
  const memoPrefix = `${SUB_SVC_PREFIX}${caseTag}`;
  const blockStart = FIXTURE_ORDER_CODE_BASE + orderCodeBlock * FIXTURE_ORDER_CODE_BLOCK_SIZE;
  const blockEnd = blockStart + FIXTURE_ORDER_CODE_BLOCK_SIZE;

  const adapter = createPayosAdapterStub();
  const userIds: Partial<Record<FixtureUserRole, string>> = {};
  const sessions: Partial<Record<FixtureUserRole, SupabaseClient>> = {};
  let adminClient: SupabaseClient | null = null;
  let nextCode = blockStart;

  function requireEnv(): { url: string; anonKey: string; serviceRoleKey: string } {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new Error(
        "service lane: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / " +
          "SUPABASE_SERVICE_ROLE_KEY. This lane only has meaning against a real dev database."
      );
    }
    return { url: SUPABASE_URL, anonKey: ANON_KEY, serviceRoleKey: SERVICE_ROLE_KEY };
  }

  function admin(): SupabaseClient {
    if (!adminClient) {
      const { url, serviceRoleKey } = requireEnv();
      adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return adminClient;
  }

  /** Every account whose email carries this case's prefix — including ones left behind by
   *  a run that crashed before its teardown, whose ids died with that process. */
  async function listFixtureUsers(): Promise<Array<{ id: string; email: string }>> {
    const list = await admin().auth.admin.listUsers({ perPage: 1000 });
    if (list.error) throw list.error;
    return list.data.users
      .filter((user) => (user.email ?? "").startsWith(emailPrefix))
      .map((user) => ({ id: user.id, email: user.email ?? "" }));
  }

  async function createFixtureUser(role: FixtureUserRole): Promise<string> {
    const created = await admin().auth.admin.createUser({
      email: emailFor(role),
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    return created.data.user.id;
  }

  async function signInAs(role: FixtureUserRole): Promise<SupabaseClient> {
    const { url, anonKey } = requireEnv();
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: emailFor(role),
      password: FIXTURE_PASSWORD,
    });
    if (error) throw error;
    return client;
  }

  function requireUserId(role: FixtureUserRole): string {
    const id = userIds[role];
    if (!id) throw new Error(`fixture user ${role} is not set up — call setUp() first`);
    return id;
  }

  function requireSession(role: FixtureUserRole): SupabaseClient {
    const client = sessions[role];
    if (!client) throw new Error(`session ${role} is not signed in — call setUp() first`);
    return client;
  }

  /** The union of every scope a leftover row could be found by — DETECTION only, wider
   *  than the set of predicates `tearDown()` deletes by, and deliberately so. The block
   *  and `user_id` scopes alone cannot fail after a teardown that just deleted by those
   *  same two predicates, so they would report 0 whether or not the delete worked. The
   *  `memo` scope shares no predicate with any delete, which is what gives the count
   *  discriminating power: a row this module seeded but the block delete did not remove
   *  is still marked, and still visible here.
   *
   *  `memo like '<prefix>%'` is a prefix match, so a `caseTag` that is a prefix of another
   *  case's tag over-reports that case's rows. Over-reporting is the safe direction for a
   *  leak detector; under-reporting is the failure this scope exists to prevent. */
  async function orderCodesInScope(userIdList: string[]): Promise<Set<number>> {
    const codes = new Set<number>();
    const inBlock = await admin()
      .from("payment_orders")
      .select("order_code")
      .gte("order_code", blockStart)
      .lt("order_code", blockEnd)
      .limit(FIXTURE_ROW_SCAN_LIMIT);
    if (inBlock.error) throw inBlock.error;
    for (const row of (inBlock.data ?? []) as Array<{ order_code: number }>) {
      codes.add(Number(row.order_code));
    }
    const marked = await admin()
      .from("payment_orders")
      .select("order_code")
      .like("memo", `${memoPrefix}%`)
      .limit(FIXTURE_ROW_SCAN_LIMIT);
    if (marked.error) throw marked.error;
    for (const row of (marked.data ?? []) as Array<{ order_code: number }>) {
      codes.add(Number(row.order_code));
    }
    if (userIdList.length > 0) {
      const owned = await admin()
        .from("payment_orders")
        .select("order_code")
        .in("user_id", userIdList)
        .limit(FIXTURE_ROW_SCAN_LIMIT);
      if (owned.error) throw owned.error;
      for (const row of (owned.data ?? []) as Array<{ order_code: number }>) {
        codes.add(Number(row.order_code));
      }
    }
    return codes;
  }

  /** An explicit `orderCode` bypasses the allocator, so it is bounds-checked here for the
   *  same reason the allocator refuses to run past `blockEnd`: the reserved block is the
   *  only scope that still reaches a seeded row after its owner's account is gone. */
  function requireCodeInBlock(code: number): number {
    if (!Number.isInteger(code) || code < blockStart || code >= blockEnd) {
      throw new Error(
        `orderCode ${code} is outside fixture block ${orderCodeBlock} ` +
          `([${blockStart}, ${blockEnd})) — a row seeded there cannot be torn down by block`
      );
    }
    return code;
  }

  function allocateOrderCode(): number {
    if (nextCode >= blockEnd) {
      throw new Error(
        `order-code block ${orderCodeBlock} exhausted (${FIXTURE_ORDER_CODE_BLOCK_SIZE} codes)`
      );
    }
    const code = nextCode;
    nextCode += 1;
    return code;
  }

  async function tearDown(): Promise<void> {
    adapter.reset();
    sessionHolder.current = null;
    delete sessions.A;
    delete sessions.B;
    delete userIds.A;
    delete userIds.B;
    nextCode = blockStart;

    const users = await listFixtureUsers();
    const ids = users.map((user) => user.id);

    // Orders before accounts: `payment_orders.user_id` is `on delete set null`, so an
    // account deleted first would leave its orders alive and unreachable by scope 1.
    const blockDelete = await admin()
      .from("payment_orders")
      .delete()
      .gte("order_code", blockStart)
      .lt("order_code", blockEnd);
    if (blockDelete.error) throw blockDelete.error;

    if (ids.length > 0) {
      const ownedDelete = await admin().from("payment_orders").delete().in("user_id", ids);
      if (ownedDelete.error) throw ownedDelete.error;
      const subscriptionDelete = await admin().from("subscriptions").delete().in("user_id", ids);
      if (subscriptionDelete.error) throw subscriptionDelete.error;
    }

    for (const user of users) {
      const deleted = await admin().auth.admin.deleteUser(user.id);
      if (deleted.error) throw deleted.error;
    }
  }

  return {
    adapter,

    async setUp() {
      await tearDown();
      userIds.A = await createFixtureUser("A");
      userIds.B = await createFixtureUser("B");
      sessions.A = await signInAs("A");
      sessions.B = await signInAs("B");
      nextCode = blockStart;
      sessionHolder.current = requireSession("A");
    },

    tearDown,

    async countFixtureRows() {
      const users = await listFixtureUsers();
      const ids = users.map((user) => user.id);
      const codes = await orderCodesInScope(ids);

      let subscriptions = 0;
      if (ids.length > 0) {
        const rows = await admin()
          .from("subscriptions")
          .select("user_id", { count: "exact", head: true })
          .in("user_id", ids);
        if (rows.error) throw rows.error;
        subscriptions = rows.count ?? 0;
      }

      return { paymentOrders: codes.size, subscriptions, authUsers: users.length };
    },

    userId: requireUserId,

    sessionFor: requireSession,

    useSession(role) {
      sessionHolder.current = requireSession(role);
    },

    admin,

    nextOrderCode: allocateOrderCode,

    async seedPendingOrder(role, overrides = {}) {
      const orderCode =
        overrides.orderCode === undefined
          ? allocateOrderCode()
          : requireCodeInBlock(overrides.orderCode);
      const userId = requireUserId(role);
      const amountVnd = overrides.amountVnd ?? FIXTURE_AMOUNT_VND;
      const status = overrides.status ?? "pending";
      const pendingUntil =
        overrides.pendingUntil ?? new Date(Date.now() + ORDER_PENDING_WINDOW_MS).toISOString();
      const memo = `${memoPrefix} ${orderCode}`;

      const inserted = await admin().from("payment_orders").insert({
        order_code: orderCode,
        user_id: userId,
        amount: amountVnd,
        status,
        pending_until: pendingUntil,
        qr_payload: FIXTURE_QR_PAYLOAD,
        account_number: FIXTURE_ACCOUNT_NUMBER,
        account_name: FIXTURE_ACCOUNT_NAME,
        memo,
      });
      if (inserted.error) throw inserted.error;

      return { orderCode, userId, amountVnd, status, pendingUntil, memo };
    },

    async seedSubscription(role, subscription) {
      const upserted = await admin()
        .from("subscriptions")
        .upsert(
          {
            user_id: requireUserId(role),
            expires_at: subscription.expiresAt,
            period_anchor_at: subscription.periodAnchorAt,
          },
          { onConflict: "user_id" }
        );
      if (upserted.error) throw upserted.error;
    },

    async readOrderRow(orderCode) {
      const row = await admin()
        .from("payment_orders")
        .select("*")
        .eq("order_code", orderCode)
        .maybeSingle();
      if (row.error) throw row.error;
      return (row.data as PaymentOrderRow | null) ?? null;
    },

    async readSubscriptionRow(role) {
      const row = await admin()
        .from("subscriptions")
        .select("*")
        .eq("user_id", requireUserId(role))
        .maybeSingle();
      if (row.error) throw row.error;
      return (row.data as SubscriptionRow | null) ?? null;
    },
  };
}
