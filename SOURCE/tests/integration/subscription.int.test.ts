// Subscription (payOS prepaid period) — INTEGRATION lane test skeleton
// Design Docs: docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121)
//              docs/design/subscription-frontend-design.md (v1.2, Test Boundaries :1018)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.3)
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Generated:   2026-08-18 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// This file is a SKELETON: comments only, no imports, no describe/it, no
// assertions. Nothing it names exists yet (lib/billing/checkoutOrder.ts,
// createOrder(), getMyOrder(), quota.ts). The implementing task adds the
// imports, the runner blocks and the assertions in the SAME commit as the
// implementation, so Red -> Green happens inside one task.
//
// PLACEMENT AND HOW THIS FILE IS RUN — decided, not left open.
//   `SOURCE/vitest.config.ts:19` collects only lib/**, components/**, app/**.
//   `SOURCE/tests/**` is deliberately outside that glob, which is why the
//   shipped fixture-e2e scripts live there. This file is placed here for one
//   verified reason: cases INT-2 and INT-3 require the REAL dev Supabase
//   database, and the backend DD's Implementation Approach Phase 4 states
//   "CI has no database, so every DB-touching assertion is an integration test
//   run locally against dev, not a CI gate". Putting them under lib/** would
//   make `npm test` red in CI for a missing credential, not for a defect.
//
//   The implementing task MUST add, in the same commit:
//     1. `SOURCE/vitest.integration.config.ts` — same `resolve.alias` as
//        vitest.config.ts, `test.environment: "node"`,
//        `test.include: ["tests/integration/**/*.test.{ts,tsx}"]`.
//     2. `package.json` script: "test:integration": "vitest run --config
//        vitest.integration.config.ts".
//   `npm test` stays untouched and stays green; `npm run test:integration` is
//   run locally against dev after schema gate B has passed on dev
//   (backend DD Early verification point, gate B).
//
//   Case INT-1 mocks Redis and the Supabase client and is therefore CI-safe on
//   its own. It is kept in this file for lane cohesion. Promoting it into the
//   CI gate is a separate decision and is NOT part of this skeleton's scope.
//
// EXECUTION ORDER inside this file: INT-1, INT-2, INT-3. INT-2 and INT-3 each
// create their own order rows under their own fixture user and delete them in
// teardown; neither reads the other's rows, so the order is for readability,
// not dependency. No case may reuse another case's orderCode.
//
// FROZEN CONTRACT: `SOURCE/lib/billing/types.ts` is frozen (its own header says
// so). No case here may assume any change to Plan / Quota / Entitlement /
// FREE_FALLBACK / isQuotaExhausted.
//
// HARD SCOPE LIMIT: no case in this file performs real payOS money movement or
// opens a live payOS connection. payOS is verified at the adapter boundary only
// (a mocked `createPaymentRequest` / `getPaymentStatus`, invocation-counted).
//
//
// =============================================================================
// INT-1 — The quota gate short-circuits Gemini emission and counts operations,
//         not rows
// =============================================================================
// AC-018: "Cho một lượt gọi bị chặn vì hạn mức, khi rà, thì 0 lần gọi adapter
//          Gemini xảy ra." (PRD :270 — gate placed ahead of the branch)
// AC-019: "Cho cổng hạn mức, khi đặt, thì nó nằm TRƯỚC nhánh rẽ ở actions.ts,
//          đếm trong Redis chứ không đếm số dòng." (PRD :271)
// AC-017: "Cho check LIMITS.MAX_UPLOADS_PER_DAY tại actions.ts:337, khi feature
//          này ship, thì nó bị XOÁ, không phải để lại song song." (PRD :269)
// EARS: (none / If-then) -> basic functionality + branch coverage.
// ROI: 89 (BV:9 x Freq:9 + Legal:0 + Defect:8)
// Behavior: user activates tutor/upload -> consumeQuota() decides at the action
//   -> on refusal the Gemini adapter is never reached; on grant exactly one
//   upload allowance is consumed in BOTH branches (rerunExamId set and unset).
// @category: core-functionality
// @lane: integration
// @dependency: app/(layer2)/actions.ts, app/(layer2)/tutorActions.ts,
//   lib/billing/quota.ts (consumeQuota), lib/ugc/gemini.ts (emit chokepoint),
//   lib/billing/readEntitlement.ts
// @complexity: high
// Mock boundary (backend DD Test Boundaries, `consumeQuota` row): Redis is
//   MOCKED — "fail-closed on unavailability is the claim". The Gemini adapter
//   is MOCKED AND INVOCATION-COUNTED. Everything between the action entry point
//   and those two boundaries is REAL (no mocking of quota.ts, no mocking of the
//   action itself) — mocking an internal module here would assert the mock.
// @real-dependency: none (both boundaries of this case are marked "mocked" in
//   the backend DD's Mock Boundary Decisions table)
//
// Primary failure mode: a refused call still reaches Gemini (the gate is placed
//   after the branch, or the refusal path falls through), so a user who is out
//   of allowance still spends supplier budget; and/or the re-run upload branch
//   consumes zero allowance because the deleted row-count check was replaced by
//   something that still counts rows created rather than operations performed.
//
// Proof obligation:
//   - Traverse the REFUSAL branch, not only the happy path. The main path stays
//     green through this regression: an ungated Gemini call succeeds and returns
//     a valid answer, so only the refusal branch exposes it.
//   - Observable state before/after for the counting claim: read the mocked
//     Redis counter for `quota:upload:{userId}:{periodStart}` BEFORE and AFTER
//     each upload, and assert the DELTA against a HARDCODED literal 1 — never a
//     value read back from the code under test (backend DD, `consumeQuota`
//     counting-unit row: "Expected values are hardcoded, never read back").
//   - The Gemini adapter is the only boundary that may be counted as a proxy for
//     "no emission"; assert the count, not merely that a rejection was returned.
// Verification points / expected results / pass criteria:
//   (a) Free user whose tutor allowance is exhausted activates the tutor action
//       => the action resolves with reason `user_quota`, AND the Gemini adapter
//       mock has EXACTLY 0 invocations. (AC-018)
//   (b) Same user, upload action, `rerunExamId` UNSET => resolves successfully,
//       `quota:upload:{user}:{period}` delta is EXACTLY 1. (AC-019, the
//       "expected non-difference" of the backend DD's output comparison)
//   (c) Same user, upload action, `rerunExamId` SET (the re-run branch) =>
//       resolves successfully, `quota:upload:{user}:{period}` delta is EXACTLY 1.
//       This is the backend DD's stated "expected difference": the deleted
//       row-count check counted rows created and a re-run creates none, so this
//       assertion fails against the OLD behaviour. (AC-017 + AC-019)
//   (d) `SOURCE/app/(layer2)/actions.ts` contains no surviving reference to
//       `LIMITS.MAX_UPLOADS_PER_DAY` — an absence assertion, so the old check
//       cannot be left running in parallel with the new gate. (AC-017)
//   (e) Redis unavailable (the mock throws) => the action refuses, and the
//       Gemini adapter mock has EXACTLY 0 invocations. Fail-CLOSED. (AC-024's
//       shape as it applies at this gate; the standalone AC-024 unit case is not
//       duplicated here)
//
//
// =============================================================================
// INT-2 — `toCheckoutOrder()` is the single mapper: createOrder() and
//         getMyOrder() return deeply equal values for one order
// =============================================================================
// Source: backend DD I010 (Test Boundaries `toCheckoutOrder()` row, :1139) and
//   Third verification point item "I010 — the two mappings agree" (:1218).
//   Escalation E-02 records that `app/(billing)/queries.ts` keeps its location,
//   signature and `import "server-only"`; only its mapping step becomes
//   `toCheckoutOrder(row)`.
// AC touched (supply half): AC-028 (PRD :290 — account number, amount and
//   transfer memo must be available as TEXT beside the QR) and AC-027's deadline
//   text (PRD :287).
// EARS: (none) -> basic functionality / contract test.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Behavior: one order is created -> read back cold through the request-scoped
//   client -> both paths map through the one exported `toCheckoutOrder(row)` in
//   `SOURCE/lib/billing/checkoutOrder.ts` -> the two `CheckoutOrder` values are
//   deeply equal.
// @category: integration
// @lane: integration
// @dependency: lib/billing/checkoutOrder.ts (toCheckoutOrder),
//   createOrder(), app/(billing)/queries.ts (getMyOrder),
//   Supabase request-scoped client, payment_orders
// @complexity: medium
// Mock boundary (backend DD Test Boundaries, `toCheckoutOrder()` row):
//   "nothing — real Postgres, one order". The payOS adapter is mocked ONLY to
//   supply the four transfer values at creation; it is not on the read path.
// @real-dependency: Postgres (payment_orders, orders_select_own RLS), dev
//   Supabase, one authenticated session
//
// Primary failure mode: the two paths agree field-by-field on every field a
//   reviewer thinks to spot-check while `pendingUntil` differs in STRING form —
//   PostgREST returns `…+00:00`, `Date.prototype.toISOString()` returns `…Z`.
//   Same instant, different string. That string is the deadline text AC-027
//   observes on screen, so the user is shown one deadline immediately after
//   purchase and a differently-formatted one after a reload. A second, quieter
//   form of the same failure: someone adds a ninth field to one path only.
//
// Proof obligation:
//   - The assertion MUST be deep equality over the whole `CheckoutOrder` value,
//     not a field-by-field spot check. A spot check passes through both failure
//     forms above; that is the entire reason the backend DD names deep equality
//     specifically.
//   - Boundary path to traverse: the COLD read. Call `getMyOrder(orderCode)` in
//     a session that has NOT called `createOrder()` — an in-memory value carried
//     over from the create call would make the comparison compare a value with
//     itself.
//   - `SOURCE/lib/billing/types.ts` is frozen: assert against the shipped
//     `CheckoutOrder` shape, do not widen it to make the test pass.
//   - Only the payOS adapter may be mocked, and only for the create step,
//     because its four returned values must be pinned as literals.
// Verification points / expected results / pass criteria:
//   (a) `createOrder()` for a fresh fixture user returns a `CheckoutOrder`;
//       capture it.
//   (b) In a fresh request-scoped client with no prior `createOrder()` call,
//       `getMyOrder(orderCode)` returns a `CheckoutOrder`.
//       This is also backend DD FE-B-01's cold read: all eight fields come back.
//   (c) The two values are DEEPLY EQUAL. Pass criterion: a single deep-equality
//       assertion over the whole object, with no field excluded and no
//       normalisation applied to either side before comparing.
//   (d) `pendingUntil` is compared as a raw string, byte for byte. Assert it
//       additionally equals the literal string form the implementation commits
//       to, so a future change of serialization form fails here rather than on
//       the payment screen.
//   (e) `qrPayload`, `accountNumber`, `accountName`, `memo` on BOTH values are
//       byte-identical to what the mocked `createPaymentRequest()` returned —
//       stored as offered, never recomputed (frontend DD Risk R-11).
//   (f) Exactly one exported mapper exists: `toCheckoutOrder` is imported from
//       `SOURCE/lib/billing/checkoutOrder.ts` by both paths, and
//       `app/(billing)/queries.ts` declares no inline camelCase mapping of its
//       own for this row.
//
//
// =============================================================================
// INT-3 — One live order per user: a second purchase inside the 30-minute
//         window reuses the same order; after the window a new one is minted
// =============================================================================
// AC-026: "Cho một lần khởi tạo đơn, khi hoàn tất, thì tồn tại đúng MỘT bản ghi
//          đơn với `orderCode` duy nhất, số tiền 39000, và trạng thái chờ."
//          (PRD :286)
// AC-027: "Cho một người dùng đã có một đơn ở trạng thái chờ CHƯA QUÁ 30 PHÚT,
//          khi họ bấm mua lần nữa, thì hệ thống TÁI DÙNG đúng đơn đó — cùng
//          `orderCode`, cùng số tiền, cùng mã QR — chứ KHÔNG tạo `orderCode`
//          mới. Sau thao tác, một truy vấn đếm đơn chờ của người dùng đó trả về
//          đúng 1." (PRD :287)
// EARS: "While" (a live pending order exists) + "If-then" (window elapsed) ->
//   state-condition test with both branches of the window predicate.
// ROI: 72 (BV:9 x Freq:7 + Legal:0 + Defect:9)
//
// ONE SKELETON FOR TWO ACs — recorded so it is not read as an omission.
//   AC-026 and AC-027 are one behaviour of `createOrder()`: "a user has at most
//   one live order, and the second activation lands on it". AC-026 is the
//   first-activation state of that invariant and AC-027 is its second-activation
//   state; the backend DD's Third verification point already writes AC-027's
//   assertion (a) as `count(*) pending = 1`, which is AC-026's assertion. They
//   share one fixture, one act sequence and one primary failure mode, so they
//   are one test. Neither AC receives a second skeleton anywhere in this
//   generation.
//
// Behavior: user activates purchase -> exactly one pending row at 39000 ->
//   activates again inside 30 min -> the SAME row is returned and the provider
//   is not called again -> activates again after the window -> a new orderCode
//   is minted AND the provider IS called.
// @category: core-functionality
// @lane: integration
// @dependency: createOrder() step (0), payment_orders, PREMIUM_PRICE_VND
//   (lib/billing/pricing.ts), payOS adapter (createPaymentRequest)
// @complexity: high
// Mock boundary (backend DD Test Boundaries, `createOrder` step (0) row): the
//   payOS adapter is mocked AND COUNTED — "counted, not just stubbed". The
//   database is real.
// @real-dependency: Postgres (payment_orders), dev Supabase, one authenticated
//   session
//
// Primary failure mode: the naive implementation. It re-calls the provider,
//   discards the result, and returns the existing row. That passes a count-of-1
//   assertion AND an equal-orderCode assertion while still (i) spending money on
//   a second provider request and (ii) leaving a second live payOS link
//   pointing at the same order, and (iii) restarting the 30-minute deadline the
//   user is reading off the screen. The second failure mode is the opposite
//   over-correction: the reuse predicate degenerates to "any pending row,
//   forever", so a user whose order expired can never start a new purchase.
//
// Proof obligation:
//   - Two of the four sub-claims are INVISIBLE to a value-only assertion. The
//     adapter invocation count and the byte-identity of `pendingUntil` must both
//     be asserted, or the naive implementation ships green.
//   - Boundary path to traverse: the WINDOW-ELAPSED branch. The main path (two
//     rapid clicks) stays green while the expiry half regresses, so the third
//     activation past `pending_until` is a required part of this test, not an
//     optional extra.
//   - Observable state before/after: the pending-order COUNT for this user, read
//     from the real table by query, before the first activation (0) and after
//     each activation.
//   - Only the payOS adapter may be mocked — the reuse predicate is decided from
//     a real row's real `pending_until` against the clock, which is precisely
//     what a mocked client would stop proving.
// Verification points / expected results / pass criteria:
//   (a) After the FIRST `createOrder()`:
//       `select count(*) from payment_orders where user_id = A and status =
//       'pending'` is EXACTLY 1; the row's `amount` is the literal 39000; its
//       `order_code` is unique; its status is `pending`. (AC-026)
//   (b) After a SECOND `createOrder()` with no wait: the same count query
//       returns EXACTLY 1. (AC-027, the PRD's own stated check)
//   (c) The two returned `orderCode`s are EQUAL.
//   (d) `createPaymentRequest` was invoked EXACTLY ONCE across both calls.
//       Assert the invocation count, not "it was called".
//   (e) `pendingUntil` is BYTE-IDENTICAL between the two returns — the reuse
//       path must not restart the window.
//   (f) `qrPayload` and `amount` are identical between the two returns (AC-027's
//       "cùng mã QR, cùng số tiền").
//   (g) Then advance past the window — write a row whose `pending_until` is in
//       the past rather than sleeping 30 minutes — and call `createOrder()` a
//       THIRD time: a NEW `orderCode` is returned (not equal to (c)'s) AND
//       `createPaymentRequest`'s cumulative invocation count is now EXACTLY 2.
//   (h) Teardown deletes every row created under this case's fixture user, so
//       the case passes when run twice in a row and when run in isolation.
