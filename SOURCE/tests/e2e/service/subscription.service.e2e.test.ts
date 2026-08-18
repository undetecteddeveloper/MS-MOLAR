// Subscription (payOS prepaid period) — SERVICE-INTEGRATION-E2E lane skeleton
// Design Docs: docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121,
//              Second verification point :1201, Third verification point :1211)
//              docs/design/subscription-frontend-design.md (v1.2, FE-B-02 :1124)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.3)
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Generated:   2026-08-18 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// This file is a SKELETON: comments only, no imports, no describe/it, no
// assertions. The implementing task adds them in the same commit as the
// implementation.
//
// WHY THIS LANE EXISTS FOR THIS FEATURE. Both cases below qualify on the
// lane's own criterion — "data persists across a real DB write" — and neither
// is verifiable with fixtures. SVC-1's claims (`greatest()`,
// `on conflict do update`, the `status='pending'` guard, the row lock) and
// SVC-2's claim (an RLS policy actually scopes a read) are properties of
// Postgres, not of our TypeScript. The backend DD says so directly: for
// `record_payment_settlement` the boundary mocked is "nothing — real Postgres
// required", and for `recheckOrder` ownership it is "nothing — real Postgres,
// two real sessions ... a mocked Supabase client would assert the mock's
// `null`, not the policy's".
//
// HOW THIS FILE IS RUN — decided, not left open.
//   `SOURCE/vitest.config.ts:19` collects lib/**, components/**, app/** only, so
//   nothing here runs under `npm test`. That is correct and deliberate: the
//   backend DD's Implementation Approach Phase 4 states "CI has no database, so
//   every DB-touching assertion is an integration test run locally against dev,
//   not a CI gate". Making this file a CI gate would turn a missing credential
//   into a red build.
//
//   The implementing task MUST add, in the same commit:
//     1. `SOURCE/vitest.localdb.config.ts` — same `resolve.alias` as
//        vitest.config.ts, `test.environment: "node"`,
//        `test.include: ["tests/e2e/service/**/*.test.{ts,tsx}"]`.
//     2. `package.json` script: "test:localdb": "vitest run --config
//        vitest.localdb.config.ts".
//
//   PRECONDITION, blocking: schema gate B (`npm run verify:schema`, run from
//   `SOURCE/`) must be GREEN ON DEV before this file is run at all. Running it
//   against a database that has not received the DDL produces failures that look
//   like implementation defects and are not — that is this repository's
//   three-time TD-005 failure shape.
//
// FIXTURE HYGIENE. Follow the shipped precedent in
//   `SOURCE/app/(layer2)/__tests__/recordSkillMastery.int.test.ts` (this repo's
//   only existing service-lane test) and `SOURCE/supabase/test-rls.ts`: an
//   isolated id prefix per case (e.g. "sub-svc-") for idempotent setup and
//   teardown. Each case creates its own users and orders and deletes them in
//   teardown, so each passes when run twice in a row and when run in isolation.
//
// HARD SCOPE LIMIT. No case in this file performs real payOS money movement or
//   opens a live payOS connection. payOS is verified at the ADAPTER boundary:
//   `getPaymentStatus()` / `createPaymentRequest()` are stubbed and
//   invocation-counted. The one real-money webhook verification the backend DD
//   describes ("What real money buys") is blocked on UI Spec TBD-02 (unfinished
//   legal content) and is deliberately NOT generated here.
//
//
// =============================================================================
// SVC-1 — RESERVED SLOT — Settlement grants exactly one period, exactly once,
//         and only after the provider says paid
// =============================================================================
// AC-035: "Cho một đơn đã thanh toán thật nhưng webhook chưa về, khi người dùng
//          bấm kiểm tra lại, thì hệ thống hỏi payOS theo `orderCode`, thấy trạng
//          thái đã thanh toán và CẤP QUYỀN LỢI NGAY TẠI ĐÓ, đi qua đúng khoá
//          idempotency của AC-009." (PRD :309)
// Also proven by the same fixture, without a second skeleton for either:
//   AC-009 (PRD :240 — the `status='pending'` guard inside the UPDATE),
//   AC-031 (PRD :295 — n replays grant once),
//   AC-016 (PRD :265 — early purchase: more days, one allowance).
// EARS: "When" (user activates re-check on a genuinely paid order) ->
//   event-driven, with a replay branch.
// ROI: 99 (BV:10 x Freq:9 + Legal:0 + Defect:9)
//
// RESERVED-SLOT JUSTIFICATION. FE-1 in
//   `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` covers the
//   user-facing purchase journey with fixtures. That journey's CORRECTNESS,
//   however, depends on a real cross-service behaviour fixtures cannot fake:
//   the money grant must persist across a real DB write, and the "granted once"
//   property lives in Postgres row-locking and `on conflict do update`, not in
//   application code. This slot is therefore reserved and emitted for that
//   journey's real-write half.
//
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: full-system (local) — recheckOrder() -> settleOrder() ->
//   record_payment_settlement() -> payment_orders + subscriptions, on the real
//   dev Supabase database; payOS adapter stubbed and counted
// @complexity: high
// Mock boundary (backend DD Test Boundaries). For `record_payment_settlement`
//   the table's entry reads "nothing — real Postgres required", so the write
//   path here is real end to end. `settleOrder`'s own table entry permits
//   mocking the payOS adapter AND `service-role.ts` when the claim under test is
//   call ORDER; that is a different claim from this case's, so here ONLY the
//   payOS adapter is stubbed and `service-role.ts` is left real.
// @real-dependency: Postgres (payment_orders, subscriptions,
//   record_payment_settlement, its `service_role`-only EXECUTE grant), dev
//   Supabase, one authenticated session
//
// Primary failure mode: the same order settles twice and the user is granted two
//   periods for one payment — or, in the opposite direction, a user who pays
//   while 10 days remain has those 10 days silently discarded because the new
//   expiry is computed from `now()` instead of `greatest(expires_at, now())`.
//   Both are money-visible and neither is detectable from application code: the
//   guard that prevents them is a SQL predicate.
//
// Proof obligation:
//   - Observable state BEFORE and AFTER, read back from the real tables by
//     query, for every claim: `subscriptions.expires_at`,
//     `payment_orders.status`, `payment_orders.settled_at`,
//     `subscriptions.period_anchor_at`. A return-value assertion alone does not
//     prove a row changed, and the Engine 1 Phase 3 lesson the backend DD cites
//     is exactly this: asserting that a call happened is not asserting what
//     passed through it.
//   - Boundary path to traverse: the REPLAY. One settlement stays green while
//     idempotency regresses. Call settlement n >= 2 times for one `orderCode`
//     and assert `expires_at` advanced by exactly ONE period across all of them.
//   - Second boundary path: the EARLY-PURCHASE branch (a user with days
//     remaining). The zero-days-remaining path stays green while
//     `greatest(expires_at, now())` regresses to `now()`.
//   - Third: settlement must NEVER be reachable without a preceding
//     `getPaymentStatus() === "paid"`. Assert the negative directly.
//   - Only the payOS adapter may be mocked, and it must be COUNTED, because the
//     "no write before verification" claim is a claim about call sequence.
// Verification points / expected results / pass criteria:
//   (a) A `pending` order for user A; stubbed `getPaymentStatus()` returns paid
//       with a matching amount. After one `recheckOrder()`:
//       `payment_orders.status` = `paid`; `settled_at` is set (non-null);
//       `subscriptions.expires_at` advanced by EXACTLY 30 days from the
//       pre-state. Compare against a hardcoded expected instant computed in the
//       test, never read back from the implementation. (AC-035, AC-003)
//   (b) A SECOND `recheckOrder()` for the same `orderCode` returns
//       `{settled:false, reason:"not_pending"}`; `settled_at` is UNCHANGED
//       (same value, not merely non-null); `expires_at` is UNCHANGED. (AC-009)
//   (c) n >= 3 replays: `expires_at` still advanced by exactly one period in
//       total. (AC-031)
//   (d) Early purchase — a user whose `expires_at` is 10 days in the future
//       settles again: the new `expires_at` is 40 days from today (10 remaining
//       + 30 granted), and `period_anchor_at` has moved to now. More days, ONE
//       allowance. (AC-016)
//   (e) Negative: stubbed `getPaymentStatus()` returns not-paid => the action
//       returns a non-settled result AND `subscriptions` has zero rows written
//       for that user AND `payment_orders.status` is still `pending`. A row
//       count of 0 after the call is the assertion.
//   (f) Negative: stubbed adapter REJECTS => zero writes to either table, and
//       the payOS adapter invocation count is exactly 1 (no retry storm).
//   (g) `record_payment_settlement` is not executable with a user JWT: calling
//       it as `authenticated` fails. (AC-033)
//   (h) Teardown removes every row created under this case's fixture prefix.
//
//
// =============================================================================
// SVC-2 — `recheckOrder()` is owner-scoped: a foreign order is byte-identically
//         as invisible as a nonexistent one
// =============================================================================
// Source: backend DD Test Boundaries, "`recheckOrder` ownership (FE-B-02)" row
//   (:1132) — "Required negative test"; frontend DD Blocking Unresolved Item
//   FE-B-02 (:1124), whose escalation condition is that S-05 "must not be
//   SHIPPED to real users until this is confirmed".
// AC context: AC-034 (PRD :302 — no bank-identifying information leaks) and the
//   security property both DDs state as "no enumeration oracle on the action
//   path".
// EARS: "If-then" (caller does not own the order) -> branch coverage.
// ROI: 65 (BV:8 x Freq:7 + Legal:0 + Defect:9) — clears the
//   service-integration-e2e additional-slot threshold of ROI > 50.
// @category: service-integration-e2e
// @lane: service-integration-e2e
// @dependency: full-system (local) — recheckOrder(), the request-scoped Supabase
//   client, the `orders_select_own` RLS policy, payment_orders, on the real dev
//   database; payOS adapter stubbed and counted
// @complexity: high
// Mock boundary (backend DD Test Boundaries, `recheckOrder` ownership row):
//   "nothing — real Postgres, two real sessions". The payOS adapter is stubbed
//   ONLY so its invocation count can be asserted at zero; nothing on the read
//   path is mocked.
// @real-dependency: Postgres (payment_orders, the `orders_select_own` RLS
//   policy), dev Supabase, TWO distinct authenticated sessions (user A and
//   user B)
//
// Primary failure mode: `recheckOrder(orderCode)` takes an attacker-controllable
//   bigint. If the ownership read goes through `service_role` — which the
//   settlement WRITE legitimately must — then any signed-in user can enumerate
//   order codes and learn which exist and which are pending versus settled: an
//   oracle over other users' payment state, reachable from an ordinary UI
//   control. The quieter half of the same failure: the two refusals return the
//   same VALUE but the foreign-order branch reaches the provider first, so the
//   two are distinguishable by latency even when they are indistinguishable by
//   text.
//
// Proof obligation:
//   - Two REAL sessions against ONE database. A mocked Supabase client returning
//     `null` would assert the mock's null, not the policy's — the policy is the
//     entire subject of this case.
//   - The assertion is DEEP EQUALITY between the foreign-order result and the
//     nonexistent-order result. Asserting each equals `unknown_order`
//     independently is weaker: it passes if one branch carries an extra field.
//   - AND zero payOS adapter invocations in BOTH branches. The backend DD is
//     explicit that "the value alone would pass even if the foreign branch
//     called the provider first". Both halves are required.
//   - Include the CONTROL case (user A settles their own order) in the same run,
//     so a globally-broken action that refuses everything cannot pass by
//     refusing correctly for the wrong reason.
// Verification points / expected results / pass criteria:
//   (a) Control: user A calls `recheckOrder()` with A's own `orderCode` =>
//       the action proceeds normally (the order is found; the outcome follows
//       the stubbed provider status). This case must PASS, or (b) and (c) prove
//       nothing.
//   (b) User B calls `recheckOrder()` with A's `orderCode` =>
//       `{settled:false, reason:"unknown_order"}`.
//   (c) User B calls `recheckOrder()` with a code nobody owns =>
//       `{settled:false, reason:"unknown_order"}`.
//   (d) The results of (b) and (c) are DEEPLY EQUAL — one assertion over the
//       whole value, no field excluded.
//   (e) The payOS adapter recorded EXACTLY 0 invocations during (b) AND during
//       (c). Assert the count separately for each branch, not once for both.
//   (f) Zero writes occurred during (b) and (c): `payment_orders` for A is
//       byte-identical before and after, and `subscriptions` has no new row for
//       either user.
//   (g) No log line emitted during (b) or (c) contains the `orderCode`'s owner,
//       an amount, an account number or a memo — refusal reasons are a closed
//       set of codes. (AC-034)
//   (h) Teardown removes both fixture users' rows.
