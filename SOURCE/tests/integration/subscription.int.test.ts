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
//
//
// =============================================================================
// INT-3 — IMPLEMENTATION (plan Task 3.4, the commit that adds createOrder()'s
//         step (0) reuse branch)
// =============================================================================
// INT-1 and INT-2 above stay comment-only; they are filled by plan Tasks 5.3 and
// 3.5 respectively. A file carrying at least one real suite no longer trips
// vitest's "No test suite found", so this lane goes from exit 1 to exit 0 with
// this commit. That transition is the deliverable, not a side effect.
//
// WHAT IS MOCKED, AND WHY IT DOES NOT WEAKEN THE PROOF — exactly two things:
//   1. `createPaymentRequest` of the payOS adapter. It is an external PAID
//      service, and the backend DD's Test Boundaries row for `createOrder`
//      step (0) says "counted, not just stubbed". `getPaymentStatus` is
//      replaced too, with a throwing stub, so that a regression which reaches
//      the provider from this path fails loudly instead of hitting the network.
//   2. `createClient` of `@/lib/supabase/server`, which exists only to build a
//      client from request COOKIES via `next/headers` (unavailable outside a
//      Next request). It is replaced by a REAL `@supabase/supabase-js` client
//      holding a REAL session for the fixture account — the same JWT and the
//      same RLS-bound identity production uses.
//   Postgres is NOT mocked. The reuse predicate is decided from a real row's
//   real `pending_until` against the clock, which is exactly what a mocked
//   client would stop proving.
//
// WHY MISSING CREDENTIALS FAIL THIS LANE INSTEAD OF SKIPPING IT: the backend
//   DD's Implementation Approach Phase 4 states "CI has no database", and this
//   lane honours that exclusion by living outside the CI gate entirely, not by
//   degrading when credentials are absent. `.github/workflows/ci.yml` runs
//   `npm run lint`, `npx tsc --noEmit`, `npm test` and `npx next build`; it
//   never runs `npm run test:integration`, and `vitest.config.ts` collects
//   lib/**, components/**, app/** only, so `tests/**` is unreachable from CI by
//   two independent routes. The only thing that can invoke this config is a
//   developer at a keyboard, for whom an absent credential is an operator
//   error — a broken run, not a documented exclusion. Skipping it silently is
//   worse than useless: the reporter summary did say "skipped", but the two
//   things a caller actually acts on did not — the EXIT STATUS was 0, exactly
//   as for eight real passes, and no warning accompanied it, because vitest
//   suppresses module-scope console output for a file whose only suite is
//   skipped. A renamed .env.local therefore certified the same green as
//   working code. The guard below THROWS AT MODULE SCOPE, i.e. at COLLECTION
//   time, whenever a credential is absent: the lane exits non-zero and names
//   the missing variables. Collection is the only placement that holds for
//   EVERY invocation. A guard registered as a test case is itself a test case,
//   so vitest's test-name filter removes it: `-t "…"`, ordinary single-case
//   iteration, gave `Tests 9 skipped (9)` and exit 0 with a credential absent,
//   and a stray `.only` defeats it the same way. Measured with the throw in
//   place — same filter, credential absent: `Test Files 1 failed (1)`, exit 1,
//   message naming the variable; same filter, credentials present: `1 passed |
//   7 skipped`, exit 0, so the green path is untouched. No named case is kept
//   beside the throw: both would fire on the same condition, and a collection
//   failure discards the file's registered tasks (measured `(0 test)` /
//   `Tests no tests`), so such a case could never run.
//
// WHY THE SHARED RATE-LIMIT STORE IS SWITCHED OFF FOR THIS FILE: `guard()` still
//   runs — the in-RAM sliding window is real and the action still passes through
//   it — but the AUTHORITATIVE Upstash counter survives across runs, and this
//   case spends three `createOrder` allowances per run against a ceiling of 15
//   per hour. Left on, a mutation-testing session would exhaust the ceiling and
//   the case would fail for an unrelated reason. The shared store has its own
//   coverage in `lib/security/rateLimitStore.test.ts`; nothing INT-3 claims is
//   about it.
//
// DEV DATABASE ONLY. Credentials come from `SOURCE/.env.local`
//   (ref `hynwleaxtbtjzkvpjsug`). `SOURCE/.env.local.prod-backup` is never read.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/** Nạp `.env.local` vào `process.env` — vitest không tự nạp và
 *  `vitest.integration.config.ts` khai không `setupFiles` nào. Chép từ
 *  `app/(layer2)/__tests__/recordSkillMastery.int.test.ts`, kể cả việc bóc cặp
 *  nháy bao ngoài (Next.js bóc khi nó nạp file, nên vài giá trị được ghi có
 *  nháy và vẫn chạy đúng ở production). Không ghi đè biến đã có sẵn. */
function loadEnvLocal(): void {
  const path = resolve(__dirname, "../../.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

// Xem "WHY THE SHARED RATE-LIMIT STORE IS SWITCHED OFF" ở đầu khối. Xoá TRƯỚC
// mọi lượt import, vì `rateLimitStore.ts` đọc env ở lần gọi ĐẦU TIÊN rồi nhớ
// lại kết quả.
delete process.env.KV_REST_API_URL;
delete process.env.KV_REST_API_TOKEN;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MISSING_CREDENTIALS = (
  [
    ["NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY", ANON_KEY],
    ["SUPABASE_SERVICE_ROLE_KEY", SERVICE_ROLE_KEY],
  ] as const
)
  .filter(([, value]) => !value)
  .map(([name]) => name);
// Xem khối "WHY MISSING CREDENTIALS FAIL THIS LANE INSTEAD OF SKIPPING IT" ở
// đầu file. Ném ở TẦM MODULE, tức lúc THU THẬP, chứ không đăng ký một ca canh
// gác: một ca canh gác cũng là một ca, nên nó chịu đúng bộ lọc tên ca của
// vitest, và `-t "..."` — lối chạy lặp một ca hoàn toàn bình thường — loại nó
// đi cùng tám ca INT-3 rồi trả về mã thoát 0 y như một lượt chạy xanh (đo được:
// `Tests 9 skipped (9)`, exit 0). Một `.only` bỏ quên trong file cũng vô hiệu
// hoá nó bằng đúng cơ chế ấy. Lượt THU THẬP thì không bộ lọc nào chạm tới, nên
// đây là chỗ duy nhất lời hứa "thiếu credential là làn ĐỎ" đúng với MỌI lối gọi.
if (MISSING_CREDENTIALS.length > 0) {
  throw new Error(
    `Làn integration thiếu ${MISSING_CREDENTIALS.join(", ")}. ` +
      "Tám ca INT-3 chỉ có giá trị khi chạy với Supabase dev thật (ref " +
      "hynwleaxtbtjzkvpjsug, credential lấy từ SOURCE/.env.local). Làn này " +
      "không nằm trong cổng CI, nên thiếu credential là lỗi thao tác chứ " +
      "không phải môi trường: nó làm làn ĐỎ, chứ không trả về mã thoát 0 " +
      "giống hệt một lượt chạy tám ca xanh."
  );
}

vi.mock("server-only", () => ({}));

/** Adapter payOS — MOCK VÀ ĐẾM. Số lượt gọi là một trong hai khẳng định mà một
 *  phép so giá trị KHÔNG nhìn thấy (xem "Primary failure mode" ở khối INT-3). */
const createPaymentRequestMock = vi.fn();
vi.mock("@/lib/billing/payos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/billing/payos")>()),
  createPaymentRequest: createPaymentRequestMock,
  // Đường tạo đơn KHÔNG được chạm tới lượt hỏi trạng thái. Một stub ném lỗi làm
  // hồi quy đó lộ ra ngay thay vì lặng lẽ đi ra mạng.
  getPaymentStatus: vi.fn(async () => {
    throw new Error("INT-3: createOrder() không được gọi getPaymentStatus()");
  }),
}));

/** Chỉ thay ĐƯỜNG LẤY SESSION (cookies của next/headers). Giá trị gán vào holder
 *  là một client Supabase THẬT đã đăng nhập bằng mật khẩu của tài khoản fixture,
 *  nên `orders_select_own` là chính sách thật đang áp. */
const { sessionClientHolder } = vi.hoisted(() => ({
  sessionClientHolder: { current: null as SupabaseClient | null },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    if (!sessionClientHolder.current) throw new Error("session client chưa sẵn sàng");
    return sessionClientHolder.current;
  },
}));

const { createOrder } = await import("@/lib/billing/orderActions");

/** Tài khoản fixture dùng chung cho MỌI ca trong file: tạo nếu chưa có, và nếu
 *  đã có thì đặt lại mật khẩu + xác nhận email, để một lần chạy trước đó không
 *  quyết định được lần chạy này đăng nhập nổi hay không.
 *
 *  Nhận `email`/`password` làm tham số vì INT-2 và INT-3 mỗi ca một tài khoản
 *  RIÊNG (xem khối "EXECUTION ORDER" đầu file: không ca nào đọc dòng của ca
 *  kia). Chép lại thân hàm này cho ca thứ hai là cách chắc chắn nhất để hai lối
 *  cấp tài khoản trôi lệch — đúng loại lỗi mà cả file này tồn tại để chặn. */
async function ensureUser(
  adminClient: SupabaseClient,
  email: string,
  password: string
): Promise<string> {
  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  const list = await adminClient.auth.admin.listUsers({ perPage: 1000 });
  if (list.error) throw list.error;
  const existing = list.data.users.find((u) => u.email === email);
  if (!existing) throw created.error;
  const updated = await adminClient.auth.admin.updateUserById(existing.id, {
    password,
    email_confirm: true,
  });
  if (updated.error) throw updated.error;
  return existing.id;
}

/** Một client Supabase THẬT đã đăng nhập — không phải mock. Mỗi lượt gọi dựng
 *  một instance MỚI với một JWT MỚI, nên hai lượt gọi không chia sẻ trạng thái
 *  trong tiến trình. INT-2 dựa vào đúng tính chất đó (xem nghĩa vụ (b)). */
async function signedInClient(email: string, password: string): Promise<SupabaseClient> {
  const session = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await session.auth.signInWithPassword({ email, password });
  if (signIn.error) throw signIn.error;
  return session;
}

// =============================================================================
// INT-2 — IMPLEMENTATION (plan Task 3.5, the commit that changes getMyOrder()'s
//         mapping step to `toCheckoutOrder(row)` — CL-01)
// =============================================================================
// Đọc khối chú thích INT-2 ở đầu file trước: sáu nghĩa vụ (a)…(f) nằm ở đó,
// nguyên văn, và các ca dưới đây mang đúng nhãn ấy.
//
// VÌ SAO PHẢI LÀ HAI CLIENT KHÁC NHAU. Nghĩa vụ (b) đòi lượt đọc lại diễn ra
// trong một client THEO YÊU CẦU CÒN MỚI, chưa từng gọi `createOrder()`. Nếu
// dùng lại đúng client đã tạo đơn thì phép so ở (c) có nguy cơ so một giá trị
// với chính nó qua một đường vòng, và dạng serialize — thứ duy nhất gây ra lỗi
// CL-01 — sẽ không bao giờ bị chạm tới. `signedInClient()` dựng một instance
// mới với một JWT mới cho mỗi lượt gọi, và `sessionClientHolder` được chuyển
// sang instance ĐỌC trước khi `getMyOrder()` chạy.
//
// VÌ SAO `pendingUntil` ĐƯỢC SO VỚI MỘT LITERAL GÕ TAY. Vế "hai đường bằng
// nhau" một mình vẫn xanh khi CẢ HAI đường cùng bỏ chuẩn hoá — lúc đó cả hai
// nói dạng `+00:00` của PostgREST và hợp đồng C-13 im lặng đổi. Literal
// `INT2_PROVIDER_EXPIRES_AT` là phía KHÔNG do code đang kiểm dựng ra, nên nó
// ghim dạng `…Z` chứ không chỉ ghim sự bằng nhau. KHÔNG có phép chuẩn hoá nào
// được áp lên bất kỳ vế nào trước khi so: gọi lại `toCheckoutOrder()` hay dựng
// một `new Date(...)` tại chỗ chính là đồng thuận với lỗi cần bắt.
//
// HAI CA CUỐI (g)/(h) KHÔNG THUỘC KHUNG INT-2 và không làm tăng ngân sách ca
// integration (vẫn là INT-1/INT-2/INT-3). Chúng giải quyết nghĩa vụ chứng minh
// THỨ HAI của cùng plan Task 3.5 — "missing-sort-key ordering": thứ tự được
// khai ĐÚNG MỘT LẦN, trong module query, bằng SQL, khớp chỉ mục
// `payment_orders_user_created_idx`. Nghĩa vụ ấy ghi rõ "Mock boundary
// rationale: none — real database", nên nó không thể trả bằng một ca unit với
// query builder giả, và nó dùng chung đúng một tài khoản fixture + một lượt
// dọn dẹp với INT-2 thay vì mở thêm một tài khoản thứ ba.

const { getMyOrder, listMyOrders } = await import("@/app/(billing)/queries");

const INT2_EMAIL = "smithnguyen247+mapperint@gmail.com";
const INT2_PASSWORD = "mapper-int-password-123";

/** Bốn giá trị chuyển khoản nhà cung cấp trả về cho ca này — gõ tay, và KHÁC
 *  bộ của INT-3 để một ca không bao giờ khẳng định được nhờ hằng của ca kia.
 *
 *  `INT2_PROVIDER_MEMO` cố ý KHÔNG phải `MSMOLAR <orderCode>`: nếu stub trả về
 *  đúng chuỗi mà `transferMemo()` vừa dựng, thì một bản cài đặt ghi xuống chuỗi
 *  TỰ TÍNH thay vì chuỗi NHÀ CUNG CẤP TRẢ VỀ vẫn xanh. Một literal cố định
 *  phân biệt được hai thứ đó — đúng khẳng định "lưu như đã nhận, không bao giờ
 *  tính lại" (frontend DD Risk R-11) mà nghĩa vụ (e) đòi. */
const INT2_QR_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN6304INT2";
const INT2_ACCOUNT_NUMBER = "0022002345678";
const INT2_ACCOUNT_NAME = "CONG TY TNHH MS MOLAR";
const INT2_PROVIDER_MEMO = "MSMOLAR INT2 FIXED";

/** Mốc `expiresAt` nhà cung cấp trả về — LITERAL, dạng `…Z` có mili giây, đúng
 *  dạng mà `toCheckoutOrder()` cam kết. Đây là vế "và so với dạng literal mà
 *  bản cài đặt cam kết" của nghĩa vụ (d). Nằm xa trong tương lai nên dòng luôn
 *  còn hạn suốt lần chạy. */
const INT2_PROVIDER_EXPIRES_AT = "2099-11-30T23:59:59.000Z";

/** Dải mã dành riêng cho ba dòng gieo tay của ca thứ tự: TRÊN dải epoch-mili
 *  giây mà `createOrder()` sinh ra (~1.79e12 hôm nay) và DƯỚI dải
 *  `FIXTURE_ORDER_CODE_BASE = 8e12` mà làn service-e2e đã giữ chỗ, nên không va
 *  vào dòng thật lẫn dòng của làn kia. */
const INT2_SEEDED_CODE_BASE = 7_900_000_000_000;

/** Số tiền của ba dòng gieo tay — KHÁC `PREMIUM_PRICE_VND`, cố ý: nó chứng minh
 *  `amountVnd` đi ra từ DÒNG chứ không từ một hằng giá nào đó. */
const INT2_SEEDED_AMOUNT_VND = 12_000;

/** Gieo theo thứ tự [Jan 2, Jan 1, Jan 3] — KHÔNG theo thứ tự thời gian, và
 *  cũng không theo thứ tự khoá chính. Gieo đúng thứ tự rồi khẳng định vẫn thứ
 *  tự ấy thì không chứng minh được gì: một bản cài đặt KHÔNG sắp xếp gì cả cũng
 *  xanh. Ba `status` là ba literal khác nhau của CHECK, nên ca này đồng thời
 *  cho thấy `status` đi thẳng ra dạng `string`.
 *
 *  `pendingUntil` KHÁC `createdAt` trên TỪNG dòng, và đó không phải trang trí:
 *  gieo hai cột bằng cùng một mốc thì mọi phép khẳng định trên chúng sống sót
 *  qua một lượt HOÁN ĐỔI `created_at` ⇄ `pending_until` ở tầng map — hai giá
 *  trị lấy từ cùng một chỗ thì không phép so nào phân biệt được chúng. Tháng 2
 *  chứ không phải tháng 1 nên khoảng cách giữa hai cột lớn hơn mọi sai lệch múi
 *  giờ, và cả ba mốc đều đã QUÁ HẠN so với `now()`, nên bước (0) của
 *  `createOrder()` không bao giờ tái dùng được một dòng gieo. */
const INT2_SEEDED_ROWS = [
  {
    orderCode: INT2_SEEDED_CODE_BASE + 1,
    createdAt: "2026-01-02T00:00:00+00:00",
    pendingUntil: "2026-02-11T00:00:00+00:00",
    status: "paid",
  },
  {
    orderCode: INT2_SEEDED_CODE_BASE + 2,
    createdAt: "2026-01-01T00:00:00+00:00",
    pendingUntil: "2026-02-12T00:00:00+00:00",
    status: "expired",
  },
  {
    orderCode: INT2_SEEDED_CODE_BASE + 3,
    createdAt: "2026-01-03T00:00:00+00:00",
    pendingUntil: "2026-02-13T00:00:00+00:00",
    status: "cancelled",
  },
] as const;

const INT2_QUERIES_PATH = resolve(__dirname, "../../app/(billing)/queries.ts");

/** Nguồn của `app/(billing)/queries.ts` đã BÓC chú thích.
 *
 *  Nghĩa vụ (f) và ca (h) nói về CODE, không về văn xuôi: một dòng chú thích
 *  giải thích vì sao KHÔNG được viết `qrPayload:` ở đây mà lại làm chính phép
 *  khẳng định ấy đỏ là một cổng canh vô dụng, và sửa nó bằng cách đổi cách viết
 *  chú thích là sửa sai chỗ. */
function int2QueriesCode(): string {
  return readFileSync(INT2_QUERIES_PATH, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

interface Int2SeededRowRead {
  order_code: number;
  amount: number;
  status: string;
  created_at: string;
  pending_until: string;
}

let int2Admin: SupabaseClient;
let int2UserId: string;

/** Ảnh chụp của dãy thao tác, chạy MỘT lần trong `beforeAll`. Mỗi `it` chỉ đọc
 *  ảnh chụp, nên không ca nào phụ thuộc vào việc ca kia đã chạy. */
const int2 = {
  created: null as Awaited<ReturnType<typeof createOrder>> | null,
  readBack: null as Awaited<ReturnType<typeof getMyOrder>> | null,
  rawRow: null as Int2SeededRowRead | null,
  listed: [] as Awaited<ReturnType<typeof listMyOrders>>,
};

async function int2Cleanup(): Promise<void> {
  const { error } = await int2Admin.from("payment_orders").delete().eq("user_id", int2UserId);
  if (error) throw error;
}

/** Hẹp lại `CheckoutOrder | { error } | null` về `CheckoutOrder`, và NÉM kèm
 *  giá trị thật khi không phải — một `!` lặng lẽ ở đây sẽ biến "action từ chối"
 *  thành một lỗi đọc thuộc tính của `null` cách đó ba dòng. */
function int2Checkout(value: unknown, label: string) {
  if (!value || typeof value !== "object" || "error" in value) {
    throw new Error(`INT-2: ${label} không trả về CheckoutOrder — ${JSON.stringify(value)}`);
  }
  return value as Exclude<Awaited<ReturnType<typeof getMyOrder>>, null>;
}

describe(
  "INT-2 — `toCheckoutOrder()` là mapper DUY NHẤT: `createOrder()` và `getMyOrder()` trả về hai giá trị BẰNG NHAU SÂU cho cùng một đơn (I010 / CL-01)",
  () => {
    beforeAll(async () => {
      int2Admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      int2UserId = await ensureUser(int2Admin, INT2_EMAIL, INT2_PASSWORD);
      await int2Cleanup();

      createPaymentRequestMock.mockReset();
      createPaymentRequestMock.mockImplementation(async (draft: { orderCode: number }) => ({
        qrPayload: INT2_QR_PAYLOAD,
        accountNumber: INT2_ACCOUNT_NUMBER,
        accountName: INT2_ACCOUNT_NAME,
        memo: INT2_PROVIDER_MEMO,
        orderCode: draft.orderCode,
        amount: 0,
        expiresAt: INT2_PROVIDER_EXPIRES_AT,
      }));

      // --- Dãy thao tác, chạy đúng một lần --------------------------------
      // (a) Tạo đơn trong client A.
      const creatingSession = await signedInClient(INT2_EMAIL, INT2_PASSWORD);
      sessionClientHolder.current = creatingSession;
      int2.created = await createOrder();
      const orderCode = int2Checkout(int2.created, "createOrder()").orderCode;

      // (b) Đọc lại trong client B — MỘT INSTANCE KHÁC, một JWT khác, chưa từng
      // gọi `createOrder()`. Đây là lượt đọc NGUỘI của backend DD FE-B-01.
      const readingSession = await signedInClient(INT2_EMAIL, INT2_PASSWORD);
      sessionClientHolder.current = readingSession;
      int2.readBack = await getMyOrder(orderCode);

      // Dòng THÔ đúng như PostgREST giao nó — dùng cho vế "cùng khoảnh khắc" ở
      // (d). Đọc bằng client admin để phép so không đi qua đường đang kiểm.
      const raw = await int2Admin
        .from("payment_orders")
        .select("order_code, amount, status, created_at, pending_until")
        .eq("order_code", orderCode)
        .maybeSingle();
      if (raw.error) throw raw.error;
      int2.rawRow = raw.data as Int2SeededRowRead;

      // (g) Ba dòng gieo tay, KHÔNG theo thứ tự thời gian. Gieo SAU lượt tạo
      // đơn: gieo trước thì bước (0) của `createOrder()` có thể tái dùng một
      // dòng gieo và ca này sẽ đo nhầm thứ khác.
      for (const seeded of INT2_SEEDED_ROWS) {
        const inserted = await int2Admin.from("payment_orders").insert({
          order_code: seeded.orderCode,
          user_id: int2UserId,
          amount: INT2_SEEDED_AMOUNT_VND,
          status: seeded.status,
          created_at: seeded.createdAt,
          pending_until: seeded.pendingUntil,
          qr_payload: INT2_QR_PAYLOAD,
          account_number: INT2_ACCOUNT_NUMBER,
          account_name: INT2_ACCOUNT_NAME,
          memo: INT2_PROVIDER_MEMO,
        });
        if (inserted.error) throw inserted.error;
      }
      int2.listed = await listMyOrders();
    }, 60_000);

    afterAll(async () => {
      if (int2Admin && int2UserId) await int2Cleanup();
    }, 60_000);

    // ---------------------------------------------------------------------
    // (a)(b) Hai đường sản xuất đều trả về một `CheckoutOrder`
    // ---------------------------------------------------------------------
    it("(a)(b) `createOrder()` trả về một `CheckoutOrder`, và `getMyOrder()` trong một client CÒN MỚI đọc lại được nó với đủ tám trường", async () => {
      const created = int2Checkout(int2.created, "createOrder()");
      const readBack = int2Checkout(int2.readBack, "getMyOrder()");

      expect(Object.keys(readBack).sort()).toEqual([
        "accountName",
        "accountNumber",
        "amountVnd",
        "memo",
        "orderCode",
        "pendingUntil",
        "qrPayload",
        "status",
      ]);
      expect(readBack.orderCode).toBe(created.orderCode);
      expect(readBack.status).toBe("pending");
    });

    // ---------------------------------------------------------------------
    // (c) MỘT phép so BẰNG NHAU SÂU trên toàn bộ giá trị
    // ---------------------------------------------------------------------
    it("(c) hai giá trị BẰNG NHAU SÂU — một phép so trên cả object, không bỏ trường nào, không chuẩn hoá vế nào", async () => {
      const created = int2Checkout(int2.created, "createOrder()");
      const readBack = int2Checkout(int2.readBack, "getMyOrder()");

      // `toStrictEqual` chứ không `toEqual`: lối hỏng thứ hai mà khối INT-2 gọi
      // tên là "ai đó thêm một trường thứ chín vào ĐÚNG MỘT đường", và một
      // trường thừa mang giá trị `undefined` lọt qua `toEqual`.
      expect(readBack).toStrictEqual(created);
    });

    // ---------------------------------------------------------------------
    // (d) `pendingUntil` — so chuỗi TỪNG BYTE, và so với dạng literal đã cam kết
    // ---------------------------------------------------------------------
    it("(d) `pendingUntil` giống nhau TỪNG BYTE giữa hai đường, ĐÚNG dạng `…Z` literal, và cùng khoảnh khắc với dòng thô", async () => {
      const created = int2Checkout(int2.created, "createOrder()");
      const readBack = int2Checkout(int2.readBack, "getMyOrder()");

      // Vế 1 — hai chuỗi đã bắt được, so thẳng với nhau.
      expect(readBack.pendingUntil).toBe(created.pendingUntil);

      // Vế 2 — dạng `…Z` mà `toCheckoutOrder()` cam kết, so với một literal gõ
      // tay. Vế 1 một mình vẫn xanh khi CẢ HAI đường cùng bỏ chuẩn hoá.
      expect(readBack.pendingUntil).toBe(INT2_PROVIDER_EXPIRES_AT);
      expect(created.pendingUntil).toBe(INT2_PROVIDER_EXPIRES_AT);

      // Vế 3 — cùng KHOẢNH KHẮC với chuỗi PostgREST giao. So theo thời điểm chứ
      // không theo chuỗi, vì dạng serialize của hai phía chính là thứ đang được
      // ghim ở vế 2 — và KHÔNG chuẩn hoá bằng mapper đang được kiểm.
      expect(Date.parse(readBack.pendingUntil)).toBe(Date.parse(int2.rawRow!.pending_until));
    });

    // ---------------------------------------------------------------------
    // (e) Bốn giá trị chuyển khoản, nguyên si như nhà cung cấp đã giao
    // ---------------------------------------------------------------------
    it("(e) `qrPayload` / `accountNumber` / `accountName` / `memo` trên CẢ HAI giá trị giống từng byte thứ `createPaymentRequest()` đã trả về", async () => {
      const created = int2Checkout(int2.created, "createOrder()");
      const readBack = int2Checkout(int2.readBack, "getMyOrder()");

      for (const value of [created, readBack]) {
        expect(value.qrPayload).toBe(INT2_QR_PAYLOAD);
        expect(value.accountNumber).toBe(INT2_ACCOUNT_NUMBER);
        expect(value.accountName).toBe(INT2_ACCOUNT_NAME);
        // `memo` KHÔNG phải `MSMOLAR <orderCode>`: xem chú thích của hằng. Một
        // bản cài đặt tự dựng lại nội dung chuyển khoản đỏ đúng ở dòng này.
        expect(value.memo).toBe(INT2_PROVIDER_MEMO);
      }
    });

    // ---------------------------------------------------------------------
    // (f) ĐÚNG MỘT mapper tồn tại
    // ---------------------------------------------------------------------
    it("(f) `app/(billing)/queries.ts` nhập và gọi `toCheckoutOrder()`, và KHÔNG tự khai một mapping camelCase nào cho dòng này", async () => {
      const code = int2QueriesCode();

      expect(code).toContain('from "@/lib/billing/checkoutOrder"');
      expect(code).toContain("toCheckoutOrder(");

      // Bốn trường CHỈ có ở `CheckoutOrder` (chúng không thuộc `MyOrderRow`,
      // hình chiếu danh sách hợp lệ của cùng module), cộng dấu vân tay của một
      // lần chuẩn hoá thứ hai. Một mapping nội tuyến cho hợp đồng tám trường
      // BẮT BUỘC phải mang bốn khoá này.
      for (const fingerprint of [
        "qrPayload:",
        "accountNumber:",
        "accountName:",
        "memo:",
        "toISOString(",
      ]) {
        expect(code).not.toContain(fingerprint);
      }
    });

    // ---------------------------------------------------------------------
    // (g)(h) plan Task 3.5, nghĩa vụ chứng minh "missing-sort-key ordering"
    // ---------------------------------------------------------------------
    it("(g) các dòng gieo KHÔNG theo thứ tự thời gian quay về `created_at desc`, và `MyOrderRow` mang `status`/`amountVnd` của chính dòng", async () => {
      const created = int2Checkout(int2.created, "createOrder()");

      // Thứ tự MONG ĐỢI, viết tay theo `created_at` chứ không suy từ kết quả:
      // đơn vừa tạo (now) → Jan 3 → Jan 2 → Jan 1. Thứ tự GIEO là [Jan 2, Jan
      // 1, Jan 3] và thứ tự khoá chính là [+1, +2, +3], nên cả "không sắp xếp"
      // lẫn "sắp theo khoá chính" đều đỏ ở đây.
      expect(int2.listed.map((row) => row.orderCode)).toEqual([
        created.orderCode,
        INT2_SEEDED_CODE_BASE + 3,
        INT2_SEEDED_CODE_BASE + 1,
        INT2_SEEDED_CODE_BASE + 2,
      ]);

      const cancelled = int2.listed.find(
        (row) => row.orderCode === INT2_SEEDED_CODE_BASE + 3
      );
      expect(cancelled).toBeDefined();
      expect(cancelled!.status).toBe("cancelled");
      expect(cancelled!.amountVnd).toBe(INT2_SEEDED_AMOUNT_VND);

      // HAI mốc thời gian, hai literal gõ tay KHÁC NHAU, cùng một dòng. Khẳng
      // định một mình `createdAt` là đủ chừng nào hai cột còn mang cùng một
      // khoảnh khắc — lúc ấy `createdAt: row.pending_until` / `pendingUntil:
      // row.created_at` hoán đổi cho nhau vẫn xanh, và `pendingUntil` (thứ
      // S-05 đọc để dựng dòng chữ hạn chót và để so mốc cho link "tiếp tục
      // thanh toán") không được QUAN SÁT ở đâu cả. Hai mốc cách nhau hơn một
      // tháng nên phép hoán đổi đỏ ở ĐÚNG trường bị hỏng.
      expect(Date.parse(cancelled!.createdAt)).toBe(Date.parse("2026-01-03T00:00:00+00:00"));
      expect(Date.parse(cancelled!.pendingUntil)).toBe(Date.parse("2026-02-13T00:00:00+00:00"));
    });

    it("(h) thứ tự được khai bằng SQL trong module query, KHÔNG sắp lại ở JavaScript", async () => {
      const code = int2QueriesCode();

      // Ca (g) một mình KHÔNG giết được đột biến "bê thứ tự từ SQL sang một
      // `.sort()` ở JS": kết quả quan sát được y hệt. Điều khác biệt là dòng bị
      // PostgREST cắt khi chạm trần `readBounded` — sắp ở JS thì phần bị cắt là
      // phần CHƯA sắp, tức mất những dòng không ai đoán trước được. Chỉ một
      // phép khẳng định trên CODE phân biệt được hai thứ đó.
      expect(code).toContain('.order("created_at", { ascending: false })');
      expect(code).not.toContain(".sort(");
    });

    // ---------------------------------------------------------------------
    // Dọn dẹp — khẳng định tại chỗ, không chỉ đọc code dọn dẹp
    // ---------------------------------------------------------------------
    it("(i) mọi dòng ca này tạo ra đều xoá được, nên ca chạy lại lần nữa vẫn bắt đầu từ 0 dòng", async () => {
      await int2Cleanup();
      const { count, error } = await int2Admin
        .from("payment_orders")
        .select("order_code", { count: "exact", head: true })
        .eq("user_id", int2UserId);
      expect(error).toBeNull();
      expect(count ?? 0).toBe(0);
    });
  }
);

// --- Fixture ---------------------------------------------------------------

const FIXTURE_EMAIL = "smithnguyen247+orderint@gmail.com";
const FIXTURE_PASSWORD = "order-int-password-123";

/** Bốn giá trị chuyển khoản nhà cung cấp trả về. Hằng của fixture, gõ tay: mọi
 *  phép so "ghi xuống nguyên si" phải có một phía KHÔNG do code đang kiểm dựng. */
const PROVIDER_QR_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN6304INT3";
const PROVIDER_ACCOUNT_NUMBER = "0011001234567";
const PROVIDER_ACCOUNT_NAME = "CONG TY TNHH MS MOLAR";

/** Mốc `expiresAt` nhà cung cấp trả về — LITERAL, ghim sẵn, KHÔNG đọc đồng hồ.
 *  Một stub dựng `Date.now() + ORDER_PENDING_WINDOW_MS` thực hiện ĐÚNG phép tính
 *  mà lỗi "đồng hồ thứ hai" thực hiện: một bản cài đặt ghi `pending_until` bằng
 *  `now() + 30 phút` tự tính, thay vì bằng `payment.expiresAt` nhà cung cấp giao,
 *  vẫn khớp con số ấy và INT-3 vẫn xanh trọn tám ca. Ghim thành literal biến
 *  phép so ở (e) thành phép so với một giá trị KHÔNG do code đang kiểm dựng ra,
 *  nên INT-3 tự giết được lỗi đó thay vì đi mượn ca của làn unit.
 *  Phần mili là `.000` vì adapter thật làm tròn xuống GIÂY trước khi gửi
 *  `expiredAt` (`lib/billing/payos/index.ts:260`, :294) và không bao giờ phát ra
 *  độ chính xác mili — stub phải nói đúng thứ tiếng ấy.
 *  Mốc nằm xa trong tương lai để vị từ tái dùng `pending_until > now()` luôn
 *  đúng ở lượt tạo thứ hai; nghĩa vụ (g) tự ghi dòng về quá khứ khi cần nhánh kia. */
const PROVIDER_EXPIRES_AT = "2099-12-31T23:59:59.000Z";

/** Số tiền một đơn Premium, LITERAL — nghĩa vụ (a) của INT-3 đòi đúng thế.
 *  KHÔNG import `PREMIUM_PRICE_VND`: nhập hằng lên thì phép khẳng định đồng ý
 *  với mọi lần đổi giá trong tương lai, tức đúng thứ trôi lệch mà literal này
 *  tồn tại để bắt. */
const EXPECTED_AMOUNT_VND = 39000;

interface OrderRow {
  order_code: number;
  user_id: string | null;
  amount: number;
  status: string;
  pending_until: string;
}

let admin: SupabaseClient;
let fixtureUserId: string;

/** Ảnh chụp trạng thái tại từng mốc của dãy thao tác. Toàn bộ dãy chạy MỘT lần
 *  trong `beforeAll`; mỗi `it` bên dưới đọc ảnh chụp, nên không ca nào phụ thuộc
 *  vào việc ca kia đã chạy. */
const snapshot = {
  pendingCountBefore: -1,
  first: null as Awaited<ReturnType<typeof createOrder>> | null,
  rowAfterFirst: null as OrderRow | null,
  pendingCountAfterFirst: -1,
  adapterCountAfterFirst: -1,
  second: null as Awaited<ReturnType<typeof createOrder>> | null,
  rowAfterSecond: null as OrderRow | null,
  pendingCountAfterSecond: -1,
  adapterCountAfterSecond: -1,
  third: null as Awaited<ReturnType<typeof createOrder>> | null,
  adapterCountAfterThird: -1,
};

/** Mọi `order_code` sinh ra trong lần chạy này — teardown xoá theo `user_id`,
 *  danh sách này chỉ để báo lỗi cho dễ đọc. */
const createdOrderCodes: number[] = [];

async function ensureFixtureUser(): Promise<string> {
  return ensureUser(admin, FIXTURE_EMAIL, FIXTURE_PASSWORD);
}

/** Nghĩa vụ (h): xoá MỌI dòng ca này tạo ra. Chạy cả trước lẫn sau, nên ca chạy
 *  được hai lần liên tiếp và chạy được một mình. */
async function cleanupFixtureOrders(): Promise<void> {
  const { error } = await admin.from("payment_orders").delete().eq("user_id", fixtureUserId);
  if (error) throw error;
}

/** `select count(*) from payment_orders where user_id = A and status = 'pending'`
 *  — đúng truy vấn PRD AC-027 tự viết ra. */
async function countPendingOrders(): Promise<number> {
  const { count, error } = await admin
    .from("payment_orders")
    .select("order_code", { count: "exact", head: true })
    .eq("user_id", fixtureUserId)
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

async function readOrderRow(orderCode: number): Promise<OrderRow | null> {
  const { data, error } = await admin
    .from("payment_orders")
    .select("order_code, user_id, amount, status, pending_until")
    .eq("order_code", orderCode)
    .maybeSingle();
  if (error) throw error;
  return (data as OrderRow | null) ?? null;
}

/** Nhà cung cấp trả về một đơn còn hạn, với mốc hết hạn LITERAL `PROVIDER_EXPIRES_AT`.
 *  Trước đây chỗ này dựng `new Date(Date.now() + ORDER_PENDING_WINDOW_MS)` — đúng
 *  BẰNG phép tính mà một bản cài đặt đọc đồng hồ lần thứ hai cũng làm, nên nó
 *  đồng thuận với chính lỗi cần bắt (xem chú thích của hằng). */
function armProviderStub(): void {
  createPaymentRequestMock.mockImplementation(
    async (draft: { orderCode: number; amountVnd: number; memo: string }) => ({
      qrPayload: PROVIDER_QR_PAYLOAD,
      accountNumber: PROVIDER_ACCOUNT_NUMBER,
      accountName: PROVIDER_ACCOUNT_NAME,
      memo: draft.memo,
      orderCode: draft.orderCode,
      amount: draft.amountVnd,
      expiresAt: PROVIDER_EXPIRES_AT,
    })
  );
}

function orderCodeOf(result: Awaited<ReturnType<typeof createOrder>> | null): number {
  if (!result || "error" in result) {
    throw new Error(`INT-3: createOrder() từ chối — ${JSON.stringify(result)}`);
  }
  return result.orderCode;
}

function checkoutOf(result: Awaited<ReturnType<typeof createOrder>> | null) {
  if (!result || "error" in result) {
    throw new Error(`INT-3: createOrder() từ chối — ${JSON.stringify(result)}`);
  }
  return result;
}

describe(
  "INT-3 — một đơn sống cho mỗi người: lần mua thứ hai trong 30 phút tái dùng đúng đơn cũ; sau cửa sổ mới mint đơn mới (AC-026 / AC-027)",
  () => {
    beforeAll(async () => {
      admin = createClient(SUPABASE_URL!, SERVICE_ROLE_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      fixtureUserId = await ensureFixtureUser();
      await cleanupFixtureOrders();

      const session = createClient(SUPABASE_URL!, ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signIn = await session.auth.signInWithPassword({
        email: FIXTURE_EMAIL,
        password: FIXTURE_PASSWORD,
      });
      if (signIn.error) throw signIn.error;
      sessionClientHolder.current = session;

      armProviderStub();
      createPaymentRequestMock.mockClear();

      // --- Dãy thao tác, chạy đúng một lần ---------------------------------
      snapshot.pendingCountBefore = await countPendingOrders();

      snapshot.first = await createOrder();
      createdOrderCodes.push(orderCodeOf(snapshot.first));
      snapshot.rowAfterFirst = await readOrderRow(orderCodeOf(snapshot.first));
      snapshot.pendingCountAfterFirst = await countPendingOrders();
      snapshot.adapterCountAfterFirst = createPaymentRequestMock.mock.calls.length;

      // Lần bấm mua thứ hai, KHÔNG chờ.
      snapshot.second = await createOrder();
      createdOrderCodes.push(orderCodeOf(snapshot.second));
      snapshot.rowAfterSecond = await readOrderRow(orderCodeOf(snapshot.first));
      snapshot.pendingCountAfterSecond = await countPendingOrders();
      snapshot.adapterCountAfterSecond = createPaymentRequestMock.mock.calls.length;

      // Nghĩa vụ (g): đẩy qua cửa sổ bằng cách GHI một `pending_until` trong quá
      // khứ, chứ không ngủ 30 phút. Dòng giữ nguyên `status = 'pending'`, nên ca
      // này phân biệt được vị từ `pending_until > now()` với một vị từ chỉ nhìn
      // `status`.
      const expired = await admin
        .from("payment_orders")
        .update({ pending_until: new Date(Date.now() - 60_000).toISOString() })
        .eq("order_code", orderCodeOf(snapshot.first));
      if (expired.error) throw expired.error;

      snapshot.third = await createOrder();
      createdOrderCodes.push(orderCodeOf(snapshot.third));
      snapshot.adapterCountAfterThird = createPaymentRequestMock.mock.calls.length;
    }, 60_000);

    afterAll(async () => {
      if (admin && fixtureUserId) await cleanupFixtureOrders();
    }, 60_000);

    // ---------------------------------------------------------------------
    // (a) AC-026 — đúng MỘT bản ghi, số tiền 39000, mã duy nhất, trạng thái chờ
    // ---------------------------------------------------------------------
    it("(a) sau lần tạo ĐẦU TIÊN: đúng 1 đơn chờ, `amount` là literal 39000, `order_code` duy nhất, status 'pending'", async () => {
      // Kiểm soát dương: nếu trước đó đã có đơn chờ nào thì "đúng 1" bên dưới
      // không nói lên điều gì.
      expect(snapshot.pendingCountBefore).toBe(0);
      expect(snapshot.pendingCountAfterFirst).toBe(1);

      const row = snapshot.rowAfterFirst;
      expect(row).not.toBeNull();
      expect(row!.amount).toBe(EXPECTED_AMOUNT_VND);
      expect(row!.status).toBe("pending");
      expect(row!.user_id).toBe(fixtureUserId);

      // "Duy nhất": `order_code` là PRIMARY KEY, nên một lượt đọc theo mã trả về
      // đúng một dòng — và dòng ấy thuộc về đúng người vừa bấm mua.
      expect(row!.order_code).toBe(orderCodeOf(snapshot.first));
      expect(checkoutOf(snapshot.first).amountVnd).toBe(EXPECTED_AMOUNT_VND);
    });

    // ---------------------------------------------------------------------
    // (b)(c)(d)(e)(f) AC-027 — lần bấm thứ hai TÁI DÙNG đúng đơn ấy
    // ---------------------------------------------------------------------
    it("(b) sau lần tạo THỨ HAI không chờ: truy vấn đếm đơn chờ vẫn trả về ĐÚNG 1", async () => {
      expect(snapshot.pendingCountAfterSecond).toBe(1);
    });

    it("(c) hai `orderCode` trả về BẰNG NHAU", async () => {
      expect(orderCodeOf(snapshot.second)).toBe(orderCodeOf(snapshot.first));
    });

    it("(d) `createPaymentRequest` được gọi ĐÚNG MỘT LẦN qua cả hai lượt — số đếm, không phải 'đã được gọi'", async () => {
      // Bản cài đặt ngây thơ (gọi lại nhà cung cấp, vứt kết quả đi, trả về dòng
      // cũ) xanh ở (b) và (c) và ĐỎ ở đây. Nó là lối hỏng mà khối chú thích
      // INT-3 gọi tên: một link thanh toán thứ hai cho một lần mua, tốn tiền thật.
      expect(snapshot.adapterCountAfterFirst).toBe(1);
      expect(snapshot.adapterCountAfterSecond).toBe(1);
    });

    it("(e) `pendingUntil` GIỐNG NHAU TỪNG BYTE giữa hai lượt trả về, và dòng trong CSDL không hề đổi", async () => {
      const first = checkoutOf(snapshot.first);
      const second = checkoutOf(snapshot.second);

      // Vế 1 — hai giá trị ĐÃ BẮT ĐƯỢC, so với nhau. Không mốc nào được tính lại
      // ở đây: một `new Date(...)` dựng tại chỗ, hay một lượt gọi lại chính
      // mapper, sẽ đồng ý với một bản cài đặt khởi động lại đồng hồ đếm ngược.
      expect(second.pendingUntil).toBe(first.pendingUntil);

      // Vế 2 — DÒNG trong CSDL. Hai lượt đọc PostgREST, so chuỗi với chuỗi: lần
      // bấm thứ hai không ghi gì lên `pending_until`.
      expect(snapshot.rowAfterSecond!.pending_until).toBe(snapshot.rowAfterFirst!.pending_until);

      // Vế 3 — mốc trả về CHÍNH LÀ mốc đã lưu. So theo KHOẢNH KHẮC, vì hai phía
      // dùng hai dạng serialize khác nhau (`+00:00` của PostgREST, `…Z` của hợp
      // đồng) — nhưng KHÔNG chuẩn hoá bằng mapper đang được kiểm.
      expect(Date.parse(first.pendingUntil)).toBe(Date.parse(snapshot.rowAfterFirst!.pending_until));

      // Vế 4 — mốc đã lưu là mốc NHÀ CUNG CẤP GIAO, so với một literal ghim sẵn.
      // Vế 1–3 mới chỉ nói ba giá trị bằng nhau; chúng vẫn bằng nhau khi cả ba
      // đều là `now() + 30 phút` do chính `createOrder()` tự tính. Chỉ literal
      // này phân biệt được "ghi lại thứ adapter trả về" với "tự đọc đồng hồ lần
      // hai" — nó là phía KHÔNG do code đang kiểm dựng ra.
      expect(Date.parse(snapshot.rowAfterFirst!.pending_until)).toBe(
        Date.parse(PROVIDER_EXPIRES_AT)
      );
      expect(first.pendingUntil).toBe(PROVIDER_EXPIRES_AT);
    });

    it("(f) `qrPayload` và số tiền giống nhau giữa hai lượt trả về, và `qrPayload` đúng chuỗi nhà cung cấp đã giao", async () => {
      const first = checkoutOf(snapshot.first);
      const second = checkoutOf(snapshot.second);

      expect(second.qrPayload).toBe(first.qrPayload);
      expect(second.amountVnd).toBe(first.amountVnd);
      // Lưu như đã nhận, không bao giờ tính lại (frontend DD Risk R-11).
      expect(first.qrPayload).toBe(PROVIDER_QR_PAYLOAD);
      expect(first.accountNumber).toBe(PROVIDER_ACCOUNT_NUMBER);
      expect(first.accountName).toBe(PROVIDER_ACCOUNT_NAME);
    });

    // ---------------------------------------------------------------------
    // (g) NHÁNH HẾT CỬA SỔ — nửa mà đường chính vẫn xanh khi nó hồi quy
    // ---------------------------------------------------------------------
    it("(g) sau khi `pending_until` lùi về quá khứ: lượt tạo THỨ BA mint `orderCode` MỚI và đưa số đếm adapter lên ĐÚNG 2", async () => {
      expect(orderCodeOf(snapshot.third)).not.toBe(orderCodeOf(snapshot.first));
      expect(snapshot.adapterCountAfterThird).toBe(2);
    });

    // ---------------------------------------------------------------------
    // (h) Teardown xoá sạch — khẳng định tại chỗ, không chỉ đọc code dọn dẹp
    // ---------------------------------------------------------------------
    it("(h) mọi dòng ca này tạo ra đều xoá được, nên ca chạy lại lần nữa vẫn bắt đầu từ 0 đơn", async () => {
      // Chạy THẬT phép dọn rồi đếm lại: đây là điều kiện để ca chạy hai lần liên
      // tiếp và chạy một mình. Dãy thao tác đã chụp xong ảnh, nên xoá ở đây
      // không làm hỏng ca nào.
      await cleanupFixtureOrders();
      expect(await countPendingOrders()).toBe(0);

      const { data, error } = await admin
        .from("payment_orders")
        .select("order_code")
        .in("order_code", createdOrderCodes);
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });
  }
);
