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
// SVC-1 AND SVC-2 ARE BOTH IMPLEMENTED AND EXECUTED (backend-task-29 / plan
// Task 6.1, and backend-task-30 / plan Task 6.2); their code lives at the FOOT
// of this file, below both reserved-slot annotation blocks, so those two
// annotations stay adjacent and readable. The lane is complete at 2/2 cases and
// no skeleton remains in this file.
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
//   BOTH PIECES NOW EXIST (plan Task 0.2 / backend-task-02), so this lane is
//   invoked as `npm run test:localdb` from `SOURCE/`:
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
//   `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts` (this repo's
//   only existing service-lane test) and `SOURCE/supabase/test-rls.ts`: an
//   isolated id prefix per case (e.g. "sub-svc-") for idempotent setup and
//   teardown. Each case creates its own users and orders and deletes them in
//   teardown.
//
//   ĐỘC LẬP THỨ TỰ — ĐÃ ĐO, KHÔNG suy ra. Mỗi ca tự dựng tiền đề của chính nó
//   (`clearSubscription()` hoặc `seedSubscription()` trước khi khẳng định), nên
//   không ca nào đọc trạng thái do ca khác để lại. Đã kiểm, và đây là NGHĨA
//   CHÍNH XÁC của lời khai này: cả file xanh dưới `--sequence.shuffle.tests`
//   với năm seed (1, 42, 7, 123, 2026); xanh khi chạy hai lượt liên tiếp; và
//   MỖI ca trong chín ca xanh khi chạy MỘT MÌNH qua `-t`.
//
//   Lời khai cũ ở đúng chỗ này ("each passes ... when run in isolation") ĐÃ
//   SAI, và sai theo hướng nguy hiểm nhất — nó đọc như một bảo đảm. Xáo thứ tự
//   trên cây trước bản sửa: 5/11 ca đỏ (seed 1), 4/11 (seed 42), 9/11 (seed 7).
//   Hai nguyên nhân, cả hai nay đã bị GỠ chứ không phải được ghi chú lại:
//     (i)  (a)→(b)→(c) nối nhau bằng ba biến `let` mức module, nên xếp sai thứ
//          tự thì (b)/(c) chết với "đơn 0 không còn trong payment_orders" — một
//          câu không nói ra cả hợp đồng thứ tự lẫn nguyên nhân thật. Ba ca ấy
//          nay là MỘT `it()` với `const` cục bộ.
//     (ii) ca (h) gọi `tearDown()` bên trong một `it()`, tức xoá CẢ HAI tài
//          khoản fixture giữa describe, nên mọi ca xếp sau nó chết với "fixture
//          user A/B is not set up". Phép đếm của (h) nay nằm trong `afterAll`,
//          nơi không `it()` nào xếp sau được nữa.
//
//   BUILT, and it lives in `./subscriptionServiceFixtures.ts` (plan Task 0.8 /
//   backend-task-07). SVC-1 and SVC-2 take their accounts, sessions, seeding,
//   read-back, teardown and the COUNTED payOS stub from
//   `createSubscriptionServiceFixture({ caseTag, orderCodeBlock, sessionHolder })`
//   — one instance per case, and the two cases MUST pass different
//   `orderCodeBlock` values, which is what makes one case's teardown unable to
//   reach the other's rows. Read that file's header before writing either case:
//   it states what the "sub-svc-" prefix can and cannot scope (neither
//   `payment_orders.order_code` nor `subscriptions.user_id` can carry it), why
//   the fixture accounts are DELETED rather than reused, and which of its
//   constants are transcriptions whose drift nothing detects yet.
//
//   The `sessionHolder` is created HERE, not there: `vi.mock` is hoisted above
//   imports, so the holder its factory reads has to come from `vi.hoisted` in
//   this file — the same shape `recordSkillMastery.int.test.ts` uses, extended
//   to two sessions by `fixture.useSession("A" | "B")`.
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
//       IMPLEMENTED IN `afterAll`, not as an `it()` — an `it()` that deletes the
//       fixture accounts mid-describe makes every case scheduled after it fail
//       for a reason that names neither it nor ordering. Its `paymentOrders`
//       count proves the UNION of teardown's block and `user_id` delete scopes
//       and neither one alone; the BLOCK scope is proven separately by (i).
//   (i) Orphan branch, added because both halves below were unproven claims:
//       an order whose `user_id` was nulled by an account deletion is (1) the
//       only row shape teardown's reserved-`order_code`-block scope reaches and
//       its `user_id` scope cannot, and (2) the input to `schema.sql`'s
//       "settlement for order % has no beneficiary" fail-closed branch. Assert
//       `check_violation` (23514) with zero rows written, then assert the row is
//       gone after `tearDown()`. The `user_id` scope stays UNPROVEN in this lane
//       — see the note on `afterAll` for why no SVC-1 case can prove it.
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

// =============================================================================
// SVC-1 — IMPLEMENTATION (plan Task 6.1 / backend-task-29)
// =============================================================================
// Ca chạy trên dev `hynwleaxtbtjzkvpjsug` THẬT, sau khi cổng B (`npm run
// verify:schema`) xanh trên chính database đó. Chỉ adapter payOS bị thay;
// `lib/supabase/service-role.ts`, hàm SQL, RLS và cả bốn bước của `settleOrder()`
// đều là bản thật.
//
// GIẢ ĐỊNH CHƯA TỪNG ĐƯỢC QUAN SÁT MÀ FILE NÀY TỒN TẠI ĐỂ TRẢ LỜI.
//   `recordPaymentSettlement()` (service-role.ts) gọi
//   `rpc("record_payment_settlement", { p_order_code })` — KHÔNG truyền
//   `p_period_days`, tức trông cậy PostgREST bỏ trống tham số ấy để `default 30`
//   phía SQL tự áp. Nếu PostgREST thay vào đó truyền `null`, thân hàm tính
//   `now() + make_interval(days => null)` = `null` và va vào `expires_at not null`
//   (23502) — lời gọi NÉM chứ không âm thầm sai. Nếu default hoá ra khác 30 thì ca
//   (a) đỏ ở đúng phép trừ dưới đây. Cả hai kết cục đều lộ ra ở ca (a); không ca
//   nào trong file này đọc kỳ hạn ra từ hàm đang bị kiểm.
//
// MỌI MỐC KỲ VỌNG NEO VÀO `settled_at`, KHÔNG VÀO `Date.now()`.
//   `now()` trong plpgsql là `transaction_timestamp()` — HẰNG trong suốt thân hàm.
//   Nên `payment_orders.settled_at`, `subscriptions.period_anchor_at` và số hạng
//   `now()` bên trong `greatest()` là CÙNG MỘT giá trị, và neo vào `settled_at`
//   (đọc lại từ dòng đơn) biến mọi kỳ vọng thành ĐẲNG THỨC CHÍNH XÁC thay vì một
//   cửa sổ mờ quanh đồng hồ của tiến trình test. Đồng hồ ở đây là đồng hồ của
//   DATABASE, không phải của Node, và hai cái đó không có lý do gì phải bằng nhau.
//   Đúng MỘT khẳng định dùng biên: `settled_at` phải nằm trong ±10 phút quanh
//   đồng hồ tiến trình — đủ rộng để lệch NTP và độ trễ mạng không làm flake, đủ
//   chặt để một database có đồng hồ sai hẳn, hay một cột bị gán một mốc cũ, vẫn
//   lộ ra.

import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { RecheckOutcome } from "@/lib/billing/orderActions";
import {
  createSubscriptionServiceFixture,
  HAS_LIVE_DB,
  type FixtureUserRole,
  type PayosAdapterStub,
  type PaymentOrderRow,
  type SubscriptionRow,
} from "./subscriptionServiceFixtures";

if (!HAS_LIVE_DB) {
  console.warn(
    "! subscription.service.e2e.test.ts BỎ QUA: thiếu NEXT_PUBLIC_SUPABASE_URL / " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. Làn này CHỈ có " +
      "nghĩa khi chạy với dev Supabase thật (xem đầu file)."
  );
}

// `vi.mock` được cẩu lên trên mọi import, nên hai holder mà factory của nó đọc
// phải sinh ra từ `vi.hoisted` NGAY TẠI FILE NÀY — đúng hình dạng
// `recordSkillMastery.int.test.ts` dùng, mở rộng thêm một holder cho stub adapter
// vì fixture (thứ sở hữu stub) chỉ tồn tại sau khi import xong.
const { sessionHolder, adapterHolder } = vi.hoisted(() => ({
  sessionHolder: { current: null as SupabaseClient | null },
  adapterHolder: { current: null as PayosAdapterStub | null },
}));

// `settleOrder.ts`, `service-role.ts` và adapter payOS đều mở đầu bằng
// `import "server-only"`, thứ ném ra ngoài bundle server của Next — cùng lý do
// năm file `*.int.test.ts` anh em stub nó.
vi.mock("server-only", () => ({}));

// Thay ĐÚNG đường lấy phiên (cookies của next/headers, không tồn tại ngoài một
// request Next). Giá trị trả về là client `@supabase/supabase-js` THẬT đã đăng
// nhập bằng mật khẩu tài khoản fixture: đúng JWT, đúng danh tính RLS mà
// production dùng — nên `orders_select_own` vẫn là bên quyết định nhánh chủ sở
// hữu của `recheckOrder()`, và `authenticated` trong ca (g) là vai thật.
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!sessionHolder.current) {
      throw new Error("làn service: chưa có phiên fixture nào đang hoạt động");
    }
    return sessionHolder.current;
  },
}));

// Biên DUY NHẤT bị giả. `importOriginal` giữ nguyên `PayosCallError` THẬT, nên
// phép `err instanceof PayosCallError` bên trong `settleOrder()` vẫn nhận ra lỗi
// mà ca (f) ném ra — một lớp lỗi chép tay sẽ rơi nhầm xuống nhánh `throw` và ca
// (f) sẽ đỏ vì lý do không liên quan. `createPaymentRequest` bị thay bằng một
// hàm NÉM, không phải bị bỏ qua: đó là cách biến HARD SCOPE LIMIT ("không lời gọi
// payOS thật nào, không đồng nào chuyển") thành một tính chất cấu trúc thay vì
// một lời hứa.
vi.mock("@/lib/billing/payos", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/billing/payos")>();
  return {
    ...actual,
    getPaymentStatus: (orderCode: number) => {
      const adapter = adapterHolder.current;
      if (!adapter) {
        throw new Error(
          "làn service: stub payOS chưa được gắn vào holder — mỗi describe tự NHẬN " +
            "holder trong beforeAll của chính nó"
        );
      }
      return adapter.simulateGetPaymentStatus(orderCode);
    },
    createPaymentRequest: () => {
      throw new Error(
        "không ca nào trong làn này tạo payment request — xem HARD SCOPE LIMIT"
      );
    },
  };
});

const { recheckOrder } = await import("@/lib/billing/orderActions");
const { PayosCallError } = await import("@/lib/billing/payos");

const fixture = createSubscriptionServiceFixture({
  caseTag: "svc1",
  orderCodeBlock: 0,
  sessionHolder,
});

/** `caseTag` VÀ khối mã đều khác SVC-1 — registry của module fixture ném ngay lúc
 *  dựng nếu trùng — nên tài khoản, dòng đơn và lệnh xoá của hai làn không với tới
 *  nhau được. */
const svc2Fixture = createSubscriptionServiceFixture({
  caseTag: "svc2",
  orderCodeBlock: 1,
  sessionHolder,
});

// HAI describe DÙNG CHUNG MỘT `vi.mock`, nên holder adapter được MỖI describe tự
// NHẬN trong `beforeAll` của chính nó, chứ KHÔNG gán một lần ở mức module như bản
// một-describe trước đây. Gán một lần là một phụ thuộc thứ tự ẩn: describe nào
// chạy sau cũng đọc bộ đếm của fixture describe kia, nên phép đếm 0 của SVC-2 —
// thứ chứng minh nhánh từ chối không tốn lượt gọi nhà cung cấp nào — sẽ đúng vì
// nhìn nhầm một bộ đếm chứ không vì hành vi. Hai describe không bao giờ chạy xen
// kẽ nhau (một suite chạy hết mới tới suite kia, kể cả dưới
// `--sequence.shuffle.tests`), nên "ai vào thì nhận" là đủ và không cần trả lại
// holder lúc ra.

// --- Hằng số kỳ vọng, VIẾT TAY -----------------------------------------------

const DAY_MS = 86_400_000;

/** 30 ngày tính bằng mili giây: 30 × 24 × 60 × 60 × 1000. Gõ ra thành literal,
 *  KHÔNG suy ra từ `FIXTURE_PERIOD_DAYS` (bản chép tay của fixture) và tuyệt đối
 *  không đọc ngược từ hàm SQL đang bị kiểm — nếu `default 30` phía SQL đổi thành
 *  60 thì các ca dưới đây phải ĐỎ, chứ không được lặng lẽ đi theo.
 *
 *  Đẳng thức chính xác hợp lệ vì `make_interval(days => 30)` cộng ngày theo
 *  TimeZone của session, và cả UTC (mặc định của Supabase) lẫn `Asia/Ho_Chi_Minh`
 *  đều KHÔNG có DST. Một ngày 23 hay 25 giờ trên đường tiền là một lỗi thật, nên
 *  để nó làm đỏ chỗ này là đúng chứ không phải giòn. */
const EXPECTED_PERIOD_MS = 2_592_000_000;

/** Biên duy nhất của cả file, và chỉ dùng cho `settled_at` so với đồng hồ tiến
 *  trình. Xem đoạn "MỌI MỐC KỲ VỌNG NEO VÀO `settled_at`" ở trên. */
const CLOCK_WINDOW_MS = 10 * 60 * 1000;

/** Mặc định 5 giây của vitest biến một làn chạm Postgres thật thành flake — đó
 *  đúng là lý do `recordSkillMastery.int.test.ts` từng flake. Một ca ở đây tốn
 *  vài vòng PostgREST cộng một vòng Upstash cho `guard()`; 60 giây là dư dả mà
 *  vẫn treo được một lời gọi đứng im. Hook nặng hơn: `setUp()` xoá rồi tạo lại
 *  hai tài khoản và đăng nhập cả hai. */
const CASE_TIMEOUT_MS = 60_000;
const HOOK_TIMEOUT_MS = 120_000;

// --- Trợ giúp đọc trạng thái --------------------------------------------------

function ms(value: string): number {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) throw new Error(`không đọc được mốc thời gian: ${value}`);
  return parsed;
}

async function orderRow(orderCode: number): Promise<PaymentOrderRow> {
  const row = await fixture.readOrderRow(orderCode);
  if (!row) throw new Error(`đơn ${orderCode} không còn trong payment_orders`);
  return row;
}

async function subscriptionRow(role: FixtureUserRole): Promise<SubscriptionRow> {
  const row = await fixture.readSubscriptionRow(role);
  if (!row) throw new Error(`không có dòng subscriptions nào cho user ${role}`);
  return row;
}

/** Đếm ĐÍCH DANH thay vì `maybeSingle() === null`: nghĩa vụ của ca (e) là "0
 *  DÒNG sau lời gọi", và một phép đếm nói ra con số ấy, kể cả khi nó là 2. */
async function subscriptionRowCount(role: FixtureUserRole): Promise<number> {
  const res = await fixture
    .admin()
    .from("subscriptions")
    .select("user_id", { count: "exact", head: true })
    .eq("user_id", fixture.userId(role));
  if (res.error) throw res.error;
  return res.count ?? 0;
}

/** Đưa một vai về "chưa từng mua" để một ca âm có thể khẳng định 0 dòng. Phạm vi
 *  là ĐÚNG `user_id` của tài khoản fixture — không bao giờ một vị từ rộng như
 *  `status = 'paid'`. */
async function clearSubscription(role: FixtureUserRole): Promise<void> {
  const res = await fixture
    .admin()
    .from("subscriptions")
    .delete()
    .eq("user_id", fixture.userId(role));
  if (res.error) throw res.error;
}

/** Nhà cung cấp nói ĐÃ TRẢ, với đúng số tiền mà fixture vừa ghi xuống dòng đơn
 *  (giá trị fixture ĐÃ YÊU CẦU, không phải giá trị đọc ngược từ dòng). `reset()`
 *  trước để mỗi ca tự cầm bộ đếm của mình. */
function armPaid(amountVnd: number): void {
  fixture.adapter.reset();
  fixture.adapter.setPaymentStatus({ status: "paid", amount: amountVnd });
}

function isSettled(outcome: RecheckOutcome): boolean {
  return "settled" in outcome && outcome.settled === true;
}

function assertSettled(outcome: RecheckOutcome): { settled: true; expiresAt: string } {
  if (!isSettled(outcome)) {
    throw new Error(`kỳ vọng settled:true, nhận được ${JSON.stringify(outcome)}`);
  }
  return outcome as { settled: true; expiresAt: string };
}

/** Chờ tới khi ĐỦ `target` lượt gọi adapter đã VÀO tới cổng giữ. Đây là thứ làm
 *  ca đồng thời tất định: nếu thả cổng sớm, lượt thứ nhất settle xong trước khi
 *  lượt thứ hai kịp đọc dòng đơn ở bước 1, và lượt thứ hai sẽ no-op vì cổng
 *  TypeScript `status !== 'pending'` — chứng minh nhầm thứ. Chờ tới 2 nghĩa là cả
 *  hai đã qua bước 1 khi dòng CÒN 'pending', nên lượt no-op chỉ có thể do vị từ
 *  SQL sinh ra. */
async function waitForAdapterCalls(target: number): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (fixture.adapter.getPaymentStatusCallCount < target) {
    if (Date.now() > deadline) {
      throw new Error(
        `mới có ${fixture.adapter.getPaymentStatusCallCount}/${target} lượt gọi adapter ` +
          "vào tới cổng giữ"
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

describe.skipIf(!HAS_LIVE_DB)(
  "SVC-1 — settlement cấp đúng MỘT kỳ, đúng MỘT lần, và chỉ sau khi nhà cung cấp nói đã trả",
  () => {
    beforeAll(async () => {
      adapterHolder.current = fixture.adapter;
      await fixture.setUp();
    }, HOOK_TIMEOUT_MS);

    // Ca (h) cũ — "sau tearDown() không còn dòng nào trong cả ba phạm vi" — SỐNG
    //   Ở ĐÂY chứ không trong một `it()`, và đó là thứ sửa một khuyết tật thứ tự
    //   chứ không phải một lựa chọn thẩm mỹ. Là một `it()`, nó xoá CẢ HAI tài
    //   khoản fixture GIỮA describe, nên mọi ca bị xếp sau nó — dưới
    //   `--sequence.shuffle.tests`, hay đơn giản là một ca do task sau thêm vào
    //   bên dưới — chết với "fixture user A/B is not set up", một câu không nói
    //   ra cả (h) lẫn thứ tự. Trong `afterAll` thì không `it()` nào xếp sau được
    //   nữa, theo cấu tạo.
    // Con số nào có sức phân biệt: chỉ `paymentOrders`, vì phạm vi `memo` không
    //   dùng chung vị từ với bất kỳ lệnh delete nào (xem đầu file fixture). Hai
    //   con số kia được KÉO THEO từ chính hành động của teardown; khẳng định
    //   chúng bằng 0 chỉ nói rằng teardown đã trả về mà không ném.
    // Phạm vi nào có sức phân biệt: `paymentOrders` ở đây chứng minh HỢP của hai
    //   phạm vi delete, KHÔNG phạm vi nào riêng lẻ — bỏ riêng lệnh delete theo
    //   block, hay riêng lệnh theo `user_id`, đều để con số này bằng 0. Phạm vi
    //   BLOCK được chứng minh riêng bởi ca (mồ côi) ở cuối describe. Phạm vi
    //   `user_id` thì CHƯA ĐƯỢC CHỨNG MINH trong làn này, và không thể chứng
    //   minh được ở đây: nó chỉ trở thành thứ gánh việc cho một dòng nằm NGOÀI
    //   block, mà `requireCodeInBlock()` của fixture cấm seed ra, nên chỉ một ca
    //   đi qua `createOrder()` thật (thứ tự mint mã của riêng nó) mới dựng nổi.
    //   Không ca SVC-1 nào gọi `createOrder()`. Nói ra ở đây thay vì để ngầm.
    afterAll(async () => {
      await fixture.tearDown();
      expect(await fixture.countFixtureRows()).toEqual({
        paymentOrders: 0,
        subscriptions: 0,
        authUsers: 0,
      });
    }, HOOK_TIMEOUT_MS);

    // =========================================================================
    // (a)+(b)+(c) — AC-035 / AC-003 / AC-009 / AC-031: MỘT lượt cấp, bốn lượt
    //               phát lại, tổng mức tiến vẫn đúng MỘT kỳ
    // =========================================================================
    // BA CA CŨ, MỘT `it()` — cố ý, và vì tính đúng đắn của cả file chứ không vì
    //   gọn. (a), (b), (c) là MỘT Arrange (một đơn pending), MỘT Act nhiều lời
    //   gọi (1 lượt cấp + 4 lượt phát lại) và MỘT Assert ("đúng MỘT lượt cấp
    //   trên toàn bộ n lời gọi") — tức một hành vi, không phải ba. Tách ra,
    //   chúng chỉ nối được với nhau bằng ba biến `let` ở mức module, và ba biến
    //   ấy làm cả file PHỤ THUỘC THỨ TỰ mà không khai ra: xếp sai thứ tự, (b) và
    //   (c) chết với "đơn 0 không còn trong payment_orders" — một câu không nói
    //   ra cả hợp đồng thứ tự lẫn nguyên nhân thật, chỉ nói ra giá trị khởi tạo
    //   của một biến. Gộp lại, ba mốc ấy là `const` CỤC BỘ trong hàm và không ca
    //   nào khác đọc tới được. Truy vết (a)/(b)/(c) giữ nguyên bằng ba khối
    //   GIAI ĐOẠN dưới đây, mỗi khối giữ nguyên từng khẳng định của ca cũ.
    // Cài đặt SAI bị khối (a) loại: (1) PostgREST truyền `null` cho
    //   `p_period_days` thay vì để SQL áp `default 30` — `expires_at` thành null,
    //   va `not null`, lời gọi ném; (2) kỳ hạn khác 30 ngày; (3)
    //   `period_anchor_at` và `expires_at` bị gán ngược (cùng kiểu timestamptz,
    //   nên chỉ một khẳng định phân biệt được hai cột mới bắt ra); (4)
    //   `settled_at` không được đặt; (5) hàm ĐƯỢC gọi nhưng dòng không đổi — nên
    //   mọi khẳng định đọc LẠI dòng chứ không đọc giá trị trả về.
    // Cài đặt SAI bị khối (b) và (c) loại: một lượt phát lại cấp thêm một kỳ
    //   nữa. Khẳng định then chốt KHÔNG phải giá trị trả về — mà là `settled_at`
    //   và `expires_at` còn Y HỆT CHUỖI CŨ. "Lời gọi trả về not_pending" một
    //   mình chính là hình dạng test rỗng mà nghĩa vụ chứng minh của task gọi
    //   tên: một cài đặt báo no-op nhưng vẫn ghi đè `settled_at` thoả nó.
    // Adapter vẫn được nạp paid trước mỗi lượt phát lại: nếu no-op đến từ việc
    //   nhà cung cấp đổi câu trả lời thì chẳng chứng minh được gì về cổng
    //   idempotency. Và phép đếm 0 lượt gọi là thứ DUY NHẤT trong file bắt được
    //   việc cổng TypeScript `status !== "pending"` (bước 1 của settleOrder) bị
    //   gỡ: gỡ nó thì lượt phát lại vẫn trả về `not_pending` — cổng SQL vẫn giữ —
    //   nhưng đã tốn một vòng ra ngoài trước khi biết điều đó.
    it(
      "(a+b+c) đơn pending + nhà cung cấp trả paid ⇒ cấp đúng MỘT kỳ 30 ngày; bốn lượt phát lại sau đó là no-op, KHÔNG đổi settled_at/expires_at và KHÔNG gọi nhà cung cấp",
      async () => {
        // --- GIAI ĐOẠN (a) — lượt cấp DUY NHẤT ------------------------------
        // Dọn trước rồi mới khẳng định rỗng: mức tiến "đúng 30 ngày kể từ
        // settled_at" chỉ đo được từ trạng thái CHƯA TỪNG MUA (nhánh INSERT của
        // `on conflict`), nên đây là tiền đề phải được BẢO ĐẢM, không phải được
        // trông cậy vào việc ca nào chạy trước.
        await clearSubscription("A");
        expect(await fixture.readSubscriptionRow("A")).toBeNull();

        const seeded = await fixture.seedPendingOrder("A");
        armPaid(seeded.amountVnd);
        fixture.useSession("A");

        const before = await orderRow(seeded.orderCode);
        expect(before.status).toBe("pending");
        expect(before.settled_at).toBeNull();

        const callStartedAt = Date.now();
        const outcome = await recheckOrder(seeded.orderCode);
        const callEndedAt = Date.now();
        const settled = assertSettled(outcome);

        const after = await orderRow(seeded.orderCode);
        expect(after.status).toBe("paid");
        expect(after.settled_at).not.toBeNull();
        const settledAtMs = ms(after.settled_at!);
        expect(settledAtMs).toBeGreaterThanOrEqual(callStartedAt - CLOCK_WINDOW_MS);
        expect(settledAtMs).toBeLessThanOrEqual(callEndedAt + CLOCK_WINDOW_MS);

        const sub = await subscriptionRow("A");
        // ĐÂY là câu trả lời cho `p_period_days`: nếu PostgREST không áp được
        // default phía SQL thì dòng này không bao giờ tới được.
        expect(ms(sub.expires_at) - settledAtMs).toBe(EXPECTED_PERIOD_MS);
        // Hai cột cùng kiểu, hai vai khác nhau: mốc bắt đầu kỳ hạn mức là NOW,
        // không phải hạn dùng.
        expect(ms(sub.period_anchor_at)).toBe(settledAtMs);
        expect(ms(sub.period_anchor_at)).not.toBe(ms(sub.expires_at));
        expect(await subscriptionRowCount("A")).toBe(1);

        // Hợp đồng CL-01: giá trị trả về là CHÍNH mốc vừa ghi, chuẩn hoá về `Z`.
        expect(settled.expiresAt).toBe(new Date(sub.expires_at).toISOString());

        expect(fixture.adapter.getPaymentStatusCallCount).toBe(1);
        expect(fixture.adapter.getPaymentStatusOrderCodes).toEqual([seeded.orderCode]);

        /** Chuỗi NGUYÊN VĂN PostgREST trả về, không phải mốc đã chuẩn hoá: hai
         *  giai đoạn dưới khẳng định "y hệt giá trị cũ", và so chuỗi THÔ bắt được
         *  cả một lần ghi lại đúng bằng giá trị cũ dưới một định dạng khác — thứ
         *  mà so hai mốc đã parse sẽ bỏ lọt. `const`, và cục bộ trong hàm này. */
        const grantSettledAt = after.settled_at!;
        const grantExpiresAt = sub.expires_at;

        // --- GIAI ĐOẠN (b) — lượt phát lại thứ nhất, AC-009 -----------------
        armPaid(seeded.amountVnd);

        const replay1 = await recheckOrder(seeded.orderCode);

        expect(replay1).toEqual({ settled: false, reason: "not_pending" });
        const afterReplay1 = await orderRow(seeded.orderCode);
        expect(afterReplay1.status).toBe("paid");
        expect(afterReplay1.settled_at).toBe(grantSettledAt);
        expect((await subscriptionRow("A")).expires_at).toBe(grantExpiresAt);
        // Một lượt phát lại KHÔNG được tốn một vòng ra ngoài: bước 1 chặn trước
        // bước 2 (ADR-0014 Decision 1, thứ tự bốn bước của settleOrder).
        expect(fixture.adapter.getPaymentStatusCallCount).toBe(0);

        // --- GIAI ĐOẠN (c) — ba lượt nữa (tổng n=4), AC-031 -----------------
        // Ba lời gọi viết THẲNG, không vòng lặp: một vòng lặp hỏng (chạy 0 vòng)
        // đọc ra y hệt một vòng lặp chạy đủ.
        armPaid(seeded.amountVnd);

        const replay2 = await recheckOrder(seeded.orderCode);
        const replay3 = await recheckOrder(seeded.orderCode);
        const replay4 = await recheckOrder(seeded.orderCode);

        expect(replay2).toEqual({ settled: false, reason: "not_pending" });
        expect(replay3).toEqual({ settled: false, reason: "not_pending" });
        expect(replay4).toEqual({ settled: false, reason: "not_pending" });

        // TỔNG MỨC TIẾN sau 1 lượt cấp + 4 lượt phát lại là đúng một kỳ, và nó
        // được nói ra bởi HAI khẳng định đọc TƯƠI dưới đây ("không gì nhúc nhích
        // kể từ lượt cấp") CỘNG với phép trừ ở giai đoạn (a) (đã đo chính lượt
        // cấp ấy bằng đúng 30 ngày). Một phép trừ thứ hai trên
        // `grantExpiresAt`/`grantSettledAt` sẽ KHÔNG phải một phép đo sau phát
        // lại — hai biến ấy được chốt TRƯỚC lượt phát lại đầu tiên — nên nó
        // không tồn tại ở đây.
        const afterReplay4 = await orderRow(seeded.orderCode);
        expect(afterReplay4.settled_at).toBe(grantSettledAt);
        const subAfterReplay4 = await subscriptionRow("A");
        expect(subAfterReplay4.expires_at).toBe(grantExpiresAt);
        expect(await subscriptionRowCount("A")).toBe(1);
        expect(fixture.adapter.getPaymentStatusCallCount).toBe(0);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (d) — AC-016 / ADR-0013 ca 1/3 "CÒN HẠN": mua sớm THÊM ngày
    // =========================================================================
    // Cài đặt SAI bị loại: `expires_at = now() + 30d` thay vì
    //   `greatest(expires_at, now()) + 30d` — 10 ngày còn lại bị tịch thu. Hai đáp
    //   án lệch nhau đúng 10 ngày, nên ca này khẳng định CẢ HAI chiều: bằng đáp án
    //   đúng, và KHÁC đáp án của cài đặt sai.
    // Hai cột cùng kiểu được seed HAI giá trị KHÁC NHAU (hạn +10 ngày, mốc kỳ hạn
    //   mức −20 ngày) — một ca seed cùng một giá trị cho cả hai không phân biệt
    //   nổi việc hàm gán nhầm cột.
    it(
      "(d) còn 10 ngày + settle ⇒ expires_at = hạn cũ + đúng 30 ngày (tức +40 ngày kể từ hôm nay), period_anchor_at dời về now",
      async () => {
        const seedExpiresAt = new Date(Date.now() + 10 * DAY_MS).toISOString();
        const seedAnchorAt = new Date(Date.now() - 20 * DAY_MS).toISOString();
        await fixture.seedSubscription("B", {
          expiresAt: seedExpiresAt,
          periodAnchorAt: seedAnchorAt,
        });
        const seeded = await fixture.seedPendingOrder("B");
        armPaid(seeded.amountVnd);
        fixture.useSession("B");

        assertSettled(await recheckOrder(seeded.orderCode));

        const after = await orderRow(seeded.orderCode);
        const settledAtMs = ms(after.settled_at!);
        const sub = await subscriptionRow("B");

        // Mốc kỳ vọng TÍNH TAY từ giá trị chính test đã seed.
        expect(ms(sub.expires_at)).toBe(ms(seedExpiresAt) + EXPECTED_PERIOD_MS);
        // …và KHÔNG phải đáp án của cài đặt dùng now().
        expect(ms(sub.expires_at)).not.toBe(settledAtMs + EXPECTED_PERIOD_MS);
        // "+40 ngày kể từ hôm nay", nói bằng chính từ ngữ của DD.
        expect(ms(sub.expires_at) - settledAtMs).toBeGreaterThan(39 * DAY_MS);
        expect(ms(sub.expires_at) - settledAtMs).toBeLessThan(41 * DAY_MS);

        // THÊM NGÀY, MỘT SUẤT HẠN MỨC: mốc kỳ hạn mức nhảy về now trong CÙNG câu
        // lệnh, nên không có kỳ hạn mức thứ hai nào được cấp.
        expect(ms(sub.period_anchor_at)).toBe(settledAtMs);
        expect(ms(sub.period_anchor_at)).not.toBe(ms(seedAnchorAt));
        expect(await subscriptionRowCount("B")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // ADR-0013 ca 2/3 "TRONG ÂN HẠN" (hết hạn 1 ngày, ân hạn 3 ngày)
    // =========================================================================
    // Cài đặt SAI bị loại: `expires_at = expires_at + 30d` (gia hạn mù, không có
    //   `greatest`) — một người quay lại sau khi hết hạn sẽ được cấp một kỳ đã
    //   tiêu mất một phần. Đáp án sai lệch đáp án đúng đúng 1 ngày.
    it(
      "(ADR-0013 2/3) hết hạn 1 ngày (còn trong ân hạn 3 ngày) + settle ⇒ expires_at = settled_at + đúng 30 ngày",
      async () => {
        const seedExpiresAt = new Date(Date.now() - 1 * DAY_MS).toISOString();
        const seedAnchorAt = new Date(Date.now() - 31 * DAY_MS).toISOString();
        await fixture.seedSubscription("B", {
          expiresAt: seedExpiresAt,
          periodAnchorAt: seedAnchorAt,
        });
        const seeded = await fixture.seedPendingOrder("B");
        armPaid(seeded.amountVnd);
        fixture.useSession("B");

        assertSettled(await recheckOrder(seeded.orderCode));

        const after = await orderRow(seeded.orderCode);
        const settledAtMs = ms(after.settled_at!);
        const sub = await subscriptionRow("B");

        expect(ms(sub.expires_at)).toBe(settledAtMs + EXPECTED_PERIOD_MS);
        expect(ms(sub.expires_at)).not.toBe(ms(seedExpiresAt) + EXPECTED_PERIOD_MS);
        expect(ms(sub.period_anchor_at)).toBe(settledAtMs);
        expect(ms(sub.period_anchor_at)).not.toBe(ms(seedAnchorAt));
        expect(await subscriptionRowCount("B")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // ADR-0013 ca 3/3 "QUÁ ÂN HẠN" (hết hạn 10 ngày)
    // =========================================================================
    // Cùng cài đặt sai bị loại như ca 2/3, nhưng ở khoảng cách 10 ngày: một cài
    //   đặt chỉ đúng khi khoảng cách nhỏ (ví dụ kẹp về một trần nào đó) lộ ra ở
    //   đây mà không lộ ra ở ca trước.
    it(
      "(ADR-0013 3/3) hết hạn 10 ngày (quá ân hạn) + settle ⇒ expires_at = settled_at + đúng 30 ngày, ngày cũ KHÔNG được cộng dồn",
      async () => {
        const seedExpiresAt = new Date(Date.now() - 10 * DAY_MS).toISOString();
        const seedAnchorAt = new Date(Date.now() - 40 * DAY_MS).toISOString();
        await fixture.seedSubscription("B", {
          expiresAt: seedExpiresAt,
          periodAnchorAt: seedAnchorAt,
        });
        const seeded = await fixture.seedPendingOrder("B");
        armPaid(seeded.amountVnd);
        fixture.useSession("B");

        assertSettled(await recheckOrder(seeded.orderCode));

        const after = await orderRow(seeded.orderCode);
        const settledAtMs = ms(after.settled_at!);
        const sub = await subscriptionRow("B");

        expect(ms(sub.expires_at)).toBe(settledAtMs + EXPECTED_PERIOD_MS);
        expect(ms(sub.expires_at)).not.toBe(ms(seedExpiresAt) + EXPECTED_PERIOD_MS);
        expect(ms(sub.period_anchor_at)).toBe(settledAtMs);
        expect(await subscriptionRowCount("B")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (e) — âm: nhà cung cấp CHƯA nói đã trả ⇒ 0 dòng được ghi
    // =========================================================================
    // Cài đặt SAI bị loại: bước ghi trôi lên trước bước hỏi nhà cung cấp, hoặc
    //   nhánh `provider.status !== "paid"` bị nới. Khẳng định là một PHÉP ĐẾM
    //   BẰNG 0 — không phải "hàm trả về false". Đối chứng dương cho phép đếm ấy
    //   chính là ca (a): cùng fixture, cùng hình dạng, có ghi.
    it(
      "(e) nhà cung cấp trả 'pending' ⇒ {settled:false, reason:'not_paid_yet'}, subscriptions 0 dòng, đơn vẫn 'pending'",
      async () => {
        await clearSubscription("A");
        expect(await subscriptionRowCount("A")).toBe(0);

        const seeded = await fixture.seedPendingOrder("A");
        fixture.adapter.reset();
        fixture.adapter.setPaymentStatus({ status: "pending", amount: seeded.amountVnd });
        fixture.useSession("A");

        const outcome = await recheckOrder(seeded.orderCode);

        expect(outcome).toEqual({ settled: false, reason: "not_paid_yet" });
        expect(await subscriptionRowCount("A")).toBe(0);
        const after = await orderRow(seeded.orderCode);
        expect(after.status).toBe("pending");
        expect(after.settled_at).toBeNull();
        expect(fixture.adapter.getPaymentStatusCallCount).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (f) — âm: adapter NÉM ⇒ 0 lượt ghi, đúng 1 lượt gọi, không bão retry
    // =========================================================================
    // Cài đặt SAI bị loại: một vòng retry quanh lời gọi nhà cung cấp (đếm thành
    //   2+), hoặc một `catch` bắt tất biến sự cố thành một lượt cấp. Bộ đếm của
    //   stub tăng LÚC VÀO nên một lời gọi sắp ném vẫn đã được tính.
    it(
      "(f) adapter payOS ném PayosCallError ⇒ {settled:false, reason:'provider_unavailable'}, 0 lượt ghi, đúng 1 lượt gọi",
      async () => {
        await clearSubscription("A");
        const seeded = await fixture.seedPendingOrder("A");
        fixture.adapter.reset();
        fixture.adapter.setPaymentStatusRejection(new PayosCallError("getPaymentStatus"));
        fixture.useSession("A");

        const outcome = await recheckOrder(seeded.orderCode);

        expect(outcome).toEqual({ settled: false, reason: "provider_unavailable" });
        expect(fixture.adapter.getPaymentStatusCallCount).toBe(1);
        expect(await subscriptionRowCount("A")).toBe(0);
        const after = await orderRow(seeded.orderCode);
        expect(after.status).toBe("pending");
        expect(after.settled_at).toBeNull();
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (g) — AC-033: JWT người dùng KHÔNG gọi được record_payment_settlement()
    // =========================================================================
    // Cài đặt SAI bị loại: `revoke` vắng mặt, hoặc gõ sai chữ ký/overload — cạm
    //   bẫy default-privileges của Supabase mà repo này đã dính một lần (ghi chú
    //   sự cố ở schema.sql §10b). KHÔNG khẳng định trần `error !== null`: một lỗi
    //   từ THÂN hàm (check_violation) chứng minh điều NGƯỢC LẠI — rằng người dùng
    //   gọi ĐƯỢC. Chỉ hai mã lớp-quyền được chấp nhận.
    // ĐỐI CHỨNG DƯƠNG nằm ngay trong ca: cùng lời gọi, cùng đơn, chỉ khác danh
    //   tính, đi bằng service_role thì THÀNH CÔNG — nên một hàm không tồn tại, hay
    //   một đơn không với tới được, không thể giả dạng "đã chặn đúng".
    it(
      "(g) rpc record_payment_settlement bằng JWT người dùng bị chặn ở tầng QUYỀN và không đổi dòng nào; cùng lời gọi bằng service_role thì settle được",
      async () => {
        await clearSubscription("A");
        const seeded = await fixture.seedPendingOrder("A");

        const denied = await fixture
          .sessionFor("A")
          .rpc("record_payment_settlement", { p_order_code: seeded.orderCode });

        expect(denied.data).toBeNull();
        expect(denied.error).not.toBeNull();
        expect(denied.error!.code).toMatch(/^(42501|PGRST202)$/);

        const afterDenied = await orderRow(seeded.orderCode);
        expect(afterDenied.status).toBe("pending");
        expect(afterDenied.settled_at).toBeNull();
        expect(await subscriptionRowCount("A")).toBe(0);

        const allowed = await fixture
          .admin()
          .rpc("record_payment_settlement", { p_order_code: seeded.orderCode });

        expect(allowed.error).toBeNull();
        expect(typeof allowed.data).toBe("string");
        const afterAllowed = await orderRow(seeded.orderCode);
        expect(afterAllowed.status).toBe("paid");
        expect(afterAllowed.settled_at).not.toBeNull();
        const sub = await subscriptionRow("A");
        expect(ms(sub.expires_at) - ms(afterAllowed.settled_at!)).toBe(EXPECTED_PERIOD_MS);
        expect(await subscriptionRowCount("A")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // ĐỒNG THỜI — thứ CHỨNG MINH sai lệch hai-câu-lệnh đã ghi nhận của ADR-0014
    // =========================================================================
    // schema.sql ghi rõ thân hàm dùng HAI câu lệnh, ngược với ADR-0014
    //   Implementation Guidance ("Two statements is a window"), và rằng thứ làm nó
    //   an toàn là ngữ nghĩa giao dịch chứ không phải câu chữ. Một ca tuần tự
    //   KHÔNG kiểm được điều đó: nó không bao giờ dựng ra cửa sổ ấy.
    // Cài đặt SAI bị loại: cửa sổ giữa hai câu lệnh cho phép cả hai lượt cùng
    //   thắng ⇒ hai kỳ cho một lần trả tiền.
    // Cả hai lượt đã qua bước 1 khi dòng CÒN 'pending' (cổng chờ count===2 bảo
    //   đảm), nên lượt no-op không thể do cổng TypeScript sinh ra.
    it(
      "(đồng thời) hai lượt recheckOrder() tranh cùng một đơn ⇒ đúng MỘT lượt thắng, expires_at tiến đúng MỘT kỳ, adapter được gọi 2 lần",
      async () => {
        await clearSubscription("B");
        const seeded = await fixture.seedPendingOrder("B");
        armPaid(seeded.amountVnd);
        fixture.useSession("B");

        fixture.adapter.holdNextPaymentStatus();
        const first = recheckOrder(seeded.orderCode);
        const second = recheckOrder(seeded.orderCode);
        await waitForAdapterCalls(2);
        fixture.adapter.releaseHeldPaymentStatus();
        const outcomes = await Promise.all([first, second]);

        expect(outcomes.filter(isSettled)).toHaveLength(1);
        expect(outcomes.filter((outcome) => !isSettled(outcome))).toEqual([
          { settled: false, reason: "not_pending" },
        ]);
        expect(fixture.adapter.getPaymentStatusCallCount).toBe(2);
        expect(fixture.adapter.getPaymentStatusOrderCodes).toEqual([
          seeded.orderCode,
          seeded.orderCode,
        ]);

        const after = await orderRow(seeded.orderCode);
        expect(after.status).toBe("paid");
        const sub = await subscriptionRow("B");
        expect(ms(sub.expires_at) - ms(after.settled_at!)).toBe(EXPECTED_PERIOD_MS);
        expect(ms(sub.period_anchor_at)).toBe(ms(after.settled_at!));
        expect(await subscriptionRowCount("B")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (mồ côi) — đơn KHÔNG NGƯỜI THỤ HƯỞNG: nhánh fail-closed của SQL, và phạm
    //            vi BLOCK của tearDown(), cùng đóng bằng MỘT dòng
    // =========================================================================
    // MỘT hình dạng dòng, HAI lỗ hổng. Cả hai lỗ hổng đều là "lời khai chưa từng
    //   được kiểm", đúng hình dạng khuyết tật lặp lại của nhánh này.
    //
    // LỖ HỔNG 1 — phạm vi teardown. Đầu file fixture khai `tearDown()` xoá theo
    //   BA phạm vi và rằng phạm vi 2 (block `order_code`) tồn tại RIÊNG cho những
    //   dòng bị một lần xoá tài khoản nulls mất `user_id` (`on delete set null`,
    //   cố ý: chứng từ tiền sống lâu hơn tài khoản). Trước ca này, KHÔNG ca nào
    //   trong file dựng ra một dòng `user_id` NULL, nên ca (h) cũ chỉ chứng minh
    //   HỢP của hai phạm vi: trên cây TRƯỚC ca này, bỏ RIÊNG lệnh delete theo
    //   block, hay bỏ RIÊNG lệnh delete theo `user_id`, đều để cả 11 ca xanh —
    //   chỉ bỏ CẢ HAI mới đỏ. Dòng dưới đây là hình dạng DUY
    //   NHẤT mà phạm vi block với tới được còn phạm vi `user_id` KHÔNG — theo
    //   cấu tạo, vì `user_id` của nó là null — nên bỏ lệnh delete theo block làm
    //   ca này ĐỎ.
    //
    // LỖ HỔNG 2 — nhánh `raise exception ... errcode = 'check_violation'` của
    //   `record_payment_settlement` ("settlement for order % has no
    //   beneficiary", schema.sql). Trước ca này nhánh ấy chưa được kiểm theo CẢ
    //   HAI chiều. Nó là một cổng FAIL-CLOSED trên đường tiền: đơn đã 'paid' mà
    //   không ai được cấp quyền là đúng trạng thái cần một con người đối soát
    //   (D10). Khẳng định là MÃ LỖI 23514 đích danh, không phải `error !== null`
    //   trần — một lỗi lớp-quyền (42501) hay một chữ ký sai (PGRST202) cũng
    //   thoả `error !== null` mà chứng minh điều khác hẳn.
    //
    // VÌ SAO CA NÀY DỰNG LẠI FIXTURE Ở CUỐI. `tearDown()` xoá cả hai tài khoản,
    //   nên nếu ca này để lại thế giới như thế thì nó tái lập ĐÚNG khuyết tật
    //   thứ tự mà ca (h) cũ mắc phải: ca nào bị xếp sau sẽ chết với "fixture user
    //   A/B is not set up" — một câu không nói ra cả ca thủ phạm lẫn thứ tự.
    //   `setUp()` ở cuối trả thế giới về trạng thái chạy được, nên ca này không
    //   phụ thuộc thứ tự và không áp thứ tự lên ca nào khác.
    it(
      "(mồ côi) đơn user_id NULL ⇒ settlement bị chặn ở 23514 và không ghi gì; tearDown() vẫn dọn được dòng ấy bằng phạm vi BLOCK",
      async () => {
        await clearSubscription("A");
        expect(await subscriptionRowCount("A")).toBe(0);

        const orphan = await fixture.seedPendingOrder("A");
        const nulled = await fixture
          .admin()
          .from("payment_orders")
          .update({ user_id: null })
          .eq("order_code", orphan.orderCode);
        expect(nulled.error).toBeNull();

        // TIỀN ĐỀ, không phải trang trí: nếu `user_id` còn nguyên thì phạm vi 1
        // dọn được dòng này và khẳng định cuối ca thôi phân biệt hai phạm vi.
        const beforeSettlement = await orderRow(orphan.orderCode);
        expect(beforeSettlement.user_id).toBeNull();
        expect(beforeSettlement.status).toBe("pending");

        const orphanSettlement = await fixture
          .admin()
          .rpc("record_payment_settlement", { p_order_code: orphan.orderCode });

        expect(orphanSettlement.data).toBeNull();
        expect(orphanSettlement.error).not.toBeNull();

        // Mã 23514 đích danh, KHÔNG `error !== null` trần: một lỗi lớp-quyền
        // (42501) hay một chữ ký sai (PGRST202) cũng thoả `!== null` mà chứng
        // minh điều khác hẳn. Và kèm CÂU của nhánh ấy, vì 23514 còn là mã của
        // ràng buộc CHECK trên `payment_orders.status` — chỉ mã thôi thì không
        // phân biệt nổi "không người thụ hưởng" với "trạng thái không hợp lệ".
        expect(orphanSettlement.error!.code).toBe("23514");
        expect(orphanSettlement.error!.message).toBe(
          `settlement for order ${orphan.orderCode} has no beneficiary`
        );

        // FAIL CLOSED, và "closed" ở đây là NGUYÊN VẸN: exception làm cả thân
        // plpgsql quay lui, nên câu UPDATE mở đầu — thứ ĐÃ đặt status='paid' và
        // settled_at=now() trước khi nhánh này ném — không để lại dấu vết nào.
        const afterSettlement = await orderRow(orphan.orderCode);
        expect(afterSettlement.status).toBe("pending");
        expect(afterSettlement.settled_at).toBeNull();
        expect(await subscriptionRowCount("A")).toBe(0);

        // Đọc bằng `readOrderRow()` (một câu `eq("order_code", …)` đi thẳng),
        // KHÔNG bằng `countFixtureRows()`: phép đếm kia hỏi lại đúng những vị từ
        // mà delete vừa chạy, nên nó vòng tròn ở đúng chỗ này.
        await fixture.tearDown();
        expect(await fixture.readOrderRow(orphan.orderCode)).toBeNull();

        await fixture.setUp();
      },
      HOOK_TIMEOUT_MS
    );
  }
);

// =============================================================================
// SVC-2 — IMPLEMENTATION (plan Task 6.2 / backend-task-30)
// =============================================================================
// CÂU HỎI CỦA CẢ KHỐI NÀY LÀ VỀ CHÍNH SÁCH, KHÔNG PHẢI VỀ TYPESCRIPT.
//   `recheckOrder()` không so `user_id` với ai cả: nó đọc dòng đơn bằng client
//   THEO PHIÊN và giao toàn bộ phép phân quyền cho `orders_select_own`
//   (`for select to authenticated using (user_id = auth.uid())`, schema.sql
//   §payment_orders). Nên một ca chỉ chứng minh "TypeScript có kiểm chủ sở hữu"
//   sẽ thoả MẶT CHỮ của task này mà để nguyên đúng thứ nó tồn tại để đóng. Ca
//   (b+c) vì thế hỏi CHÍNH SÁCH trực tiếp — phiên của B, một câu select thẳng
//   xuống `payment_orders` — trước khi hỏi hành động.
//
// HÌNH DẠNG QUAN SÁT ĐƯỢC CỦA MỘT LƯỢT TỪ CHỐI BỞI RLS LÀ 0 DÒNG, KHÔNG PHẢI MỘT
//   LỖI, và nhầm chỗ này là cách một ca RLS im lặng không bao giờ đỏ được.
//   `expect(error).not.toBeNull()` ở đây SAI HÌNH DẠNG: policy không sinh lỗi, và
//   một "hàm không tồn tại" hay một sự cố mạng lại thoả nó. Khẳng định đúng là
//   `error` BẰNG null VÀ tập dòng RỖNG, kèm HAI đối chứng dương trong CÙNG ca —
//   A đọc ĐƯỢC dòng của A qua đúng đường ấy, và service_role vẫn thấy dòng — nên
//   một policy cấm tất, một dòng không tồn tại, một bảng trống, hay một lượt đọc
//   hỏng đều không giả dạng được "đã chặn đúng".
//
// VÌ SAO (b), (c) VÀ (d) LÀ MỘT `it()`. Phép bằng nhau sâu là một khẳng định
//   trên HAI giá trị, nên tách thành hai `it()` thì hai giá trị ấy chỉ nối được
//   với nhau bằng biến mức module — đúng khuyết tật phụ thuộc thứ tự mà khối
//   (a+b+c) của SVC-1 đã bị gỡ ra khỏi. Ở đây chúng là `const` cục bộ trong một
//   hàm và không ca nào khác đọc tới được.
//
// VÌ SAO ĐỐI CHỨNG DƯƠNG (a) NẰM RIÊNG MỘT `it()`. Nó tự dựng tiền đề của chính
//   nó (dọn subscriptions, seed đơn riêng) nên không áp thứ tự lên ai; tách ra
//   để một lượt hỏng "hành động từ chối TẤT CẢ" hiện ra thành một ca đỏ mang tên
//   nó, thay vì làm đỏ ca kia ở một khẳng định không liên quan.

/** Thu mọi lối ra console trong lúc `run()` chạy — sáu phương thức, vì một cài
 *  đặt rò rỉ không có nghĩa vụ chọn `console.log`. Trả về CẢ giá trị lẫn chuỗi
 *  nhật ký, nên ca gọi không phải giữ trạng thái ngoài phạm vi hàm.
 *
 *  `mockRestore()` trong `finally`: một lời gọi ném mà vẫn để nguyên spy sẽ nuốt
 *  mọi dòng log của phần còn lại của file. */
async function captureConsole<T>(run: () => Promise<T>): Promise<{ value: T; output: string }> {
  const lines: string[] = [];
  const methods = ["log", "info", "warn", "error", "debug", "trace"] as const;
  const spies = methods.map((method) =>
    vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
      lines.push(args.map(stringifyLogArg).join(" "));
    })
  );
  try {
    const value = await run();
    return { value, output: lines.join("\n") };
  } finally {
    for (const spy of spies) spy.mockRestore();
  }
}

/** Một `Error` được ghi ra nhật ký mang thông tin trong `message` VÀ trong
 *  `stack`; `JSON.stringify(err)` trả về `{}` và sẽ giấu mất cả hai. */
function stringifyLogArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (arg instanceof Error) return `${arg.name}: ${arg.message}\n${arg.stack ?? ""}`;
  try {
    return JSON.stringify(arg) ?? String(arg);
  } catch {
    return String(arg);
  }
}

interface LogSecret {
  label: string;
  value: string;
}

/** Trả về NHÃN của những bí mật xuất hiện trong `output`. Trả nhãn chứ không trả
 *  boolean: một ca đỏ khi ấy nói ra CÁI GÌ đã rò, không chỉ nói rằng có rò. */
function leakedLabels(output: string, secrets: LogSecret[]): string[] {
  return secrets.filter((secret) => output.includes(secret.value)).map((secret) => secret.label);
}

describe.skipIf(!HAS_LIVE_DB)(
  "SVC-2 — recheckOrder() theo phạm vi chủ sở hữu: đơn của người khác VÔ HÌNH y hệt một mã không tồn tại",
  () => {
    beforeAll(async () => {
      adapterHolder.current = svc2Fixture.adapter;
      await svc2Fixture.setUp();
    }, HOOK_TIMEOUT_MS);

    afterAll(async () => {
      await svc2Fixture.tearDown();
      expect(await svc2Fixture.countFixtureRows()).toEqual({
        paymentOrders: 0,
        subscriptions: 0,
        authUsers: 0,
      });
    }, HOOK_TIMEOUT_MS);

    // Trợ giúp của RIÊNG describe này, đóng quanh `svc2Fixture`. Khai trong thân
    // describe chứ không ở mức module: các trợ giúp cùng vai ở nửa trên file đóng
    // quanh fixture của SVC-1, và một ca SVC-2 lỡ gọi nhầm sẽ đọc tài khoản của
    // làn kia — một lượt xanh vì nhìn nhầm chỗ.
    async function orderRowOf(orderCode: number): Promise<PaymentOrderRow> {
      const row = await svc2Fixture.readOrderRow(orderCode);
      if (!row) throw new Error(`đơn ${orderCode} không còn trong payment_orders`);
      return row;
    }

    /** CẢ dòng, tuần tự hoá nguyên trạng: `readOrderRow()` dùng `select("*")`, nên
     *  một cột thứ mười hai thêm vào sau này vẫn tham gia phép so "y hệt từng
     *  byte" thay vì bị phép chiếu bỏ ra ngoài. */
    async function orderSnapshot(orderCode: number): Promise<string> {
      return JSON.stringify(await orderRowOf(orderCode));
    }

    async function subscriptionCount(role: FixtureUserRole): Promise<number> {
      const res = await svc2Fixture
        .admin()
        .from("subscriptions")
        .select("user_id", { count: "exact", head: true })
        .eq("user_id", svc2Fixture.userId(role));
      if (res.error) throw res.error;
      return res.count ?? 0;
    }

    /** Phạm vi là ĐÚNG `user_id` của tài khoản fixture — không bao giờ một vị từ
     *  rộng. Đưa một vai về "chưa từng mua" để phép đếm 0 sau đó có nghĩa. */
    async function clearSubscriptionOf(role: FixtureUserRole): Promise<void> {
      const res = await svc2Fixture
        .admin()
        .from("subscriptions")
        .delete()
        .eq("user_id", svc2Fixture.userId(role));
      if (res.error) throw res.error;
    }

    // =========================================================================
    // (a) — ĐỐI CHỨNG DƯƠNG: chính chủ gọi trên đơn của chính mình thì ĐI TIẾP
    // =========================================================================
    // Cài đặt SAI bị ca này loại: một hành động từ chối TẤT CẢ. Không có ca này,
    //   (b) và (c) chứng minh đúng con số không — `.eq("order_code", -1)`, một
    //   policy cấm tất, một bảng trống, hay một `return unknown_order` đặt ngay
    //   dòng đầu hàm đều làm hai nhánh kia xanh. Đây là nửa "chỉ từ chối vì đúng
    //   lý do" của nghĩa vụ chứng minh.
    it(
      "(a) ĐỐI CHỨNG DƯƠNG — A gọi recheckOrder() trên đơn CỦA CHÍNH MÌNH ⇒ đọc thấy dòng, đi tiếp tới nhà cung cấp và settle",
      async () => {
        await clearSubscriptionOf("A");
        expect(await subscriptionCount("A")).toBe(0);

        const seeded = await svc2Fixture.seedPendingOrder("A");
        svc2Fixture.adapter.reset();
        svc2Fixture.adapter.setPaymentStatus({ status: "paid", amount: seeded.amountVnd });
        svc2Fixture.useSession("A");

        const outcome = await recheckOrder(seeded.orderCode);

        // Đi TIẾP, tức lượt đọc theo phiên đã TRẢ VỀ một dòng: đúng cái mà (b) và
        // (c) khẳng định là KHÔNG xảy ra cho B.
        assertSettled(outcome);
        expect(svc2Fixture.adapter.getPaymentStatusCallCount).toBe(1);
        expect(svc2Fixture.adapter.getPaymentStatusOrderCodes).toEqual([seeded.orderCode]);

        const after = await orderRowOf(seeded.orderCode);
        expect(after.status).toBe("paid");
        expect(after.settled_at).not.toBeNull();
        expect(await subscriptionCount("A")).toBe(1);
      },
      CASE_TIMEOUT_MS
    );

    // =========================================================================
    // (b+c+d+e+f+g) — hai lượt từ chối KHÔNG PHÂN BIỆT ĐƯỢC: ở giá trị, ở chi
    //                 phí, ở dấu vết trên CSDL và ở nhật ký
    // =========================================================================
    // Cài đặt SAI bị khối này loại:
    //   (1) lượt đọc chủ sở hữu đi bằng `service_role` (hoặc nhánh
    //       `if (!data) return unknown_order` bị gỡ, để `settleOrder()` — thứ
    //       ĐƯỢC PHÉP đọc bằng service_role — trả lời thay): B đọc thấy đơn của
    //       A, adapter bị gọi, dòng của A đổi trạng thái. Đây là máy dò mà
    //       FE-B-02 tồn tại để chặn, và nó KHÔNG làm hỏng một phép biên dịch nào.
    //   (2) hai nhánh trả về hai giá trị khác nhau, hoặc một nhánh mang thêm một
    //       trường ("owner", "exists", một gợi ý trạng thái): phép bằng nhau sâu
    //       `toStrictEqual` bắt được, kể cả khi trường thừa mang `undefined`.
    //   (3) nhánh đơn-của-người-khác chạm nhà cung cấp TRƯỚC khi từ chối: hai giá
    //       trị vẫn bằng nhau nhưng độ trễ tách được chúng ra. Bộ đếm 0 khẳng
    //       định RIÊNG cho từng nhánh là thứ duy nhất trong file bắt được.
    //   (4) một dòng nhật ký chẩn đoán mang chủ sở hữu / số tiền / số tài khoản /
    //       nội dung chuyển khoản (AC-034) — máy dò đọc log thay vì đọc giá trị.
    // KHÔNG chỉ có phép bằng nhau sâu: hai nhánh cùng trả `{error:"rate_limited"}`
    //   cũng bằng nhau sâu. Nên mỗi giá trị còn bị so với MỘT LITERAL VIẾT TAY.
    it(
      "(b+c+d+e+f+g) B gọi trên đơn của A và trên một mã không ai sở hữu ⇒ hai kết quả BẰNG NHAU SÂU và đúng bằng {settled:false,reason:'unknown_order'}, mỗi nhánh 0 lượt gọi nhà cung cấp, dòng của A y hệt từng byte, 0 dòng subscriptions, 0 rò rỉ nhật ký",
      async () => {
        // --- Tiền đề, được BẢO ĐẢM chứ không trông cậy ----------------------
        await clearSubscriptionOf("A");
        await clearSubscriptionOf("B");
        expect(await subscriptionCount("A")).toBe(0);
        expect(await subscriptionCount("B")).toBe(0);

        const seeded = await svc2Fixture.seedPendingOrder("A");
        // Cấp phát trong khối dành riêng của làn NHƯNG KHÔNG seed: mã này không
        // ai sở hữu theo cấu tạo, và nằm trong khối nên tearDown vẫn quét qua.
        const unownedCode = svc2Fixture.nextOrderCode();
        expect(unownedCode).not.toBe(seeded.orderCode);
        // "Không ai sở hữu" nói bằng service_role — thứ bỏ qua RLS — nên nó là
        // một phát biểu về CSDL, không phải về tầm nhìn của một phiên.
        expect(await svc2Fixture.readOrderRow(unownedCode)).toBeNull();

        const rowBefore = await orderRowOf(seeded.orderCode);
        const snapshotBefore = JSON.stringify(rowBefore);
        expect(rowBefore.status).toBe("pending");
        expect(rowBefore.user_id).toBe(svc2Fixture.userId("A"));
        // Hai danh tính KHÁC nhau thật: một fixture lỡ đăng nhập cả hai vai vào
        // cùng một tài khoản sẽ làm cả ca này vô nghĩa mà vẫn xanh.
        expect(rowBefore.user_id).not.toBe(svc2Fixture.userId("B"));

        // --- CHÍNH SÁCH, hỏi thẳng: đây là thứ đang bị kiểm ------------------
        // Phiên của B, một câu select xuống thẳng bảng. Không TypeScript nào của
        // ta nằm giữa; thứ quyết định là `orders_select_own`.
        const foreignRead = await svc2Fixture
          .sessionFor("B")
          .from("payment_orders")
          .select("*")
          .eq("order_code", seeded.orderCode);
        expect(foreignRead.error).toBeNull();
        expect(foreignRead.data).toEqual([]);

        // ĐỐI CHỨNG DƯƠNG 1 — cùng câu, cùng mã, chỉ khác danh tính: chính chủ
        // ĐỌC ĐƯỢC. Một policy cấm tất sẽ đỏ ở đây.
        const ownerRead = await svc2Fixture
          .sessionFor("A")
          .from("payment_orders")
          .select("*")
          .eq("order_code", seeded.orderCode);
        expect(ownerRead.error).toBeNull();
        expect(ownerRead.data).toHaveLength(1);
        expect(Number((ownerRead.data as PaymentOrderRow[])[0].order_code)).toBe(seeded.orderCode);

        // ĐỐI CHỨNG DƯƠNG 2 — dòng CÓ THẬT vào lúc B bị từ chối: `rowBefore` vừa
        // được service_role đọc lên ngay trên kia, nên "0 dòng" của B không thể
        // là "bảng trống" hay "đơn đã bị xoá".
        expect(Number(rowBefore.order_code)).toBe(seeded.orderCode);

        // Mã không ai sở hữu, cũng qua phiên của B: 0 dòng, không lỗi — CÙNG hình
        // dạng quan sát được như đơn của người khác, ngay tại tầng CSDL.
        const unownedRead = await svc2Fixture
          .sessionFor("B")
          .from("payment_orders")
          .select("*")
          .eq("order_code", unownedCode);
        expect(unownedRead.error).toBeNull();
        expect(unownedRead.data).toEqual([]);

        // --- Máy dò nhật ký, và phép TỰ KIỂM của chính nó -------------------
        // Bốn thứ AC-034 cấm, lấy từ dòng đã seed (giá trị fixture ĐÃ YÊU CẦU),
        // không suy ra từ mã đang bị kiểm.
        const secrets: LogSecret[] = [
          { label: "chủ sở hữu", value: svc2Fixture.userId("A") },
          { label: "số tiền", value: String(seeded.amountVnd) },
          { label: "số tài khoản", value: rowBefore.account_number },
          { label: "nội dung chuyển khoản", value: rowBefore.memo },
        ];
        expect(secrets).toHaveLength(4);
        // MỘT DANH SÁCH RỖNG cũng cho `leakedLabels(...) === []`, và một spy chưa
        // gắn cũng thế: hai lượt xanh vì máy dò hỏng đọc y hệt hai lượt xanh vì
        // không có gì rò. Con chim hoàng yến này chạy qua ĐÚNG cỗ máy ấy và đòi
        // nó bắt được CẢ BỐN — nếu nó không bắt nổi bốn thứ đang phơi ra thì hai
        // khẳng định `[]` bên dưới không có giá trị gì.
        const canary = await captureConsole(async () => {
          console.error("[canary]", secrets.map((secret) => secret.value).join(" "));
          return null;
        });
        expect(leakedLabels(canary.output, secrets)).toEqual(secrets.map((secret) => secret.label));

        // --- NHÁNH (b): B + orderCode CỦA A ---------------------------------
        // Adapter được nạp "ĐÃ TRẢ" đúng số tiền của dòng: nếu phép phân phạm vi
        // hỏng, lượt gọi này KHÔNG âm thầm trôi qua — nó settle đơn của A, và ba
        // khẳng định dưới đây (bộ đếm, ảnh chụp byte, phép đếm subscriptions)
        // cùng đỏ. Nạp "chưa trả" sẽ làm một lượt rò rỉ trở nên êm hơn.
        svc2Fixture.adapter.reset();
        svc2Fixture.adapter.setPaymentStatus({ status: "paid", amount: seeded.amountVnd });
        svc2Fixture.useSession("B");

        const foreign = await captureConsole(() => recheckOrder(seeded.orderCode));

        // (e) RIÊNG cho nhánh này — `reset()` ngay trên kia nên con số 0 dưới đây
        // chỉ nói về đúng lời gọi vừa rồi.
        expect(svc2Fixture.adapter.getPaymentStatusCallCount).toBe(0);
        expect(svc2Fixture.adapter.getPaymentStatusOrderCodes).toEqual([]);
        // (f) KHÔNG một lượt ghi nào: cả dòng, so bằng chuỗi.
        expect(await orderSnapshot(seeded.orderCode)).toBe(snapshotBefore);
        expect(await subscriptionCount("A")).toBe(0);
        expect(await subscriptionCount("B")).toBe(0);
        // (g) không dòng nhật ký nào mang bốn thứ AC-034 cấm.
        expect(leakedLabels(foreign.output, secrets)).toEqual([]);

        // --- NHÁNH (c): B + mã KHÔNG AI SỞ HỮU ------------------------------
        svc2Fixture.adapter.reset();
        svc2Fixture.adapter.setPaymentStatus({ status: "paid", amount: seeded.amountVnd });
        svc2Fixture.useSession("B");

        const nonexistent = await captureConsole(() => recheckOrder(unownedCode));

        expect(svc2Fixture.adapter.getPaymentStatusCallCount).toBe(0);
        expect(svc2Fixture.adapter.getPaymentStatusOrderCodes).toEqual([]);
        expect(await orderSnapshot(seeded.orderCode)).toBe(snapshotBefore);
        // Nhánh này cũng không được MINT ra dòng nào cho mã nó vừa hỏi.
        expect(await svc2Fixture.readOrderRow(unownedCode)).toBeNull();
        expect(await subscriptionCount("A")).toBe(0);
        expect(await subscriptionCount("B")).toBe(0);
        expect(leakedLabels(nonexistent.output, secrets)).toEqual([]);

        // --- (d) BẰNG NHAU SÂU, MỘT khẳng định trên CẢ giá trị ---------------
        // `toStrictEqual` chứ không `toEqual`: `toEqual` bỏ qua các trường mang
        // `undefined`, nên một nhánh trả thêm `{ owner: undefined }` vẫn lọt.
        expect(foreign.value).toStrictEqual(nonexistent.value);
        // …và literal VIẾT TAY, vì riêng phép bằng nhau sâu thì hai nhánh cùng
        // hỏng theo một kiểu (cùng `rate_limited`, cùng `unauthenticated`) vẫn
        // thoả.
        expect(foreign.value).toStrictEqual({ settled: false, reason: "unknown_order" });
        expect(nonexistent.value).toStrictEqual({ settled: false, reason: "unknown_order" });
      },
      CASE_TIMEOUT_MS
    );
  }
);
