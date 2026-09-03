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
// @dependency: app/(layer4)/actions.ts, features/exams/tutorActions.ts,
//   lib/billing/quota.ts (consumeQuota), lib/ugc/gemini.ts (emit chokepoint),
//   lib/billing/readEntitlement.ts
//   CORRECTED (was `features/exams/actions.ts`): `extractAndAssemble` — the
//   function AC-017/018/019 talk about — lives in `app/(layer4)/actions.ts`.
//   `features/exams/actions.ts` never mentioned `MAX_UPLOADS_PER_DAY`, so an
//   absence assertion written against it would have been permanently green.
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
//   (d) `SOURCE/app/(layer4)/actions.ts` contains no surviving reference to
//       `LIMITS.MAX_UPLOADS_PER_DAY` — an absence assertion, so the old check
//       cannot be left running in parallel with the new gate. (AC-017)
//       CORRECTED (was `features/exams/actions.ts`): `extractAndAssemble` lives
//       in layer4, and `features/exams/actions.ts` never mentioned
//       `MAX_UPLOADS_PER_DAY` — the assertion as written would have been
//       permanently green while observing nothing. The implementation below
//       reads layer4 and opens with two PRESENCE assertions so that "string not
//       found" and "read the wrong file" cannot read identically.
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
 *  `features/exams/__tests__/recordSkillMastery.int.test.ts`, kể cả việc bóc cặp
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
// INT-1 — IMPLEMENTATION (plan Task 5.4, commit đặt cổng hạn mức lên đường
//         upload và xoá khối đếm dòng cũ)
// =============================================================================
// Đọc khối chú thích INT-1 ở đầu file trước: năm nghĩa vụ (a)…(e) nằm ở đó,
// nguyên văn, và các ca dưới đây mang đúng nhãn ấy. Ba điểm phải nói rõ vì
// chúng KHÁC khung, và khác có lý do:
//
// 1. KHUNG GHI SAI ĐƯỜNG DẪN Ở NGHĨA VỤ (d). Khung viết
//    `SOURCE/features/exams/actions.ts`, nhưng `extractAndAssemble` — hàm mà cả
//    AC-017/018/019 nói tới — sống ở `SOURCE/app/(layer4)/actions.ts`;
//    `features/exams/actions.ts` chưa từng nhắc `LIMITS.MAX_UPLOADS_PER_DAY` một lần
//    nào, nên một khẳng định vắng mặt viết cho nó sẽ XANH VĨNH VIỄN mà không
//    quan sát gì. Ca (d) vì thế đọc file layer4, và mở đầu bằng hai khẳng định
//    CÓ MẶT (file tồn tại, và nó chứa `extractAndAssemble`) — không có chúng
//    thì "không tìm thấy chuỗi nào" và "đọc nhầm file" đọc giống hệt nhau.
//
// 2. VÌ SAO CÁC CA ĐƯỢC CẤP PHÉP LẠI ĐỂ GEMINI HỎNG. Ba ca (b)/(c)/(f) chạy
//    với adapter Gemini ném lỗi, nên pipeline dừng ở stage 5 và trả
//    `kind: "extraction"`. Đó là CHỦ ĐÍCH: `consumeQuota()` ĐẶT CHỖ trước lời
//    gọi đầu tiên và cố ý KHÔNG hoàn lại khi lời gọi sau đó hỏng (backend DD
//    § "Where the budget increment lives"), nên một lượt hỏng ở Gemini vẫn phải
//    hiện đúng một suất kỳ và đúng số request đã đặt chỗ. Cho Gemini "thành
//    công" sẽ phải bịa ra hai payload JSON đúng schema — nhiều mã hơn, và cái
//    thêm được là stage 6–8, thứ không ca nào ở đây khẳng định.
//    Hệ quả quan trọng hơn: SỐ LƯỢT GỌI ADAPTER KHÁC 0 trên đường được cấp
//    phép. Không có nó thì "đúng 0 lượt gọi" ở (a)/(e)/(g) là một khẳng định
//    RỖNG — nó cũng xanh y hệt với một cổng từ chối tất cả, hoặc với một mock
//    không bao giờ được nối vào.
//
// 3. VÌ SAO PHẢI BA CA ĐƯỢC CẤP PHÉP CHỨ KHÔNG PHẢI HAI. Khung chỉ đòi (b)
//    `rerunExamId` unset và (c) set. Ghép mỗi nhánh với một chế độ thì hai biến
//    dính vào nhau: một bản cài đặt tính chi phí theo NHÁNH (`rerunExamId ? 3 :
//    2`) sẽ vượt qua đúng bộ ca đó. Ba ca tách hai biến ra:
//      (b) typed  + unset ⇒ 2 request      (f) automatic + unset ⇒ 3 request
//      (c) typed  + SET   ⇒ 2 request
//    (b) vs (f): cùng nhánh, khác chế độ, khác chi phí ⇒ chi phí đi theo CHẾ ĐỘ.
//    (b) vs (c): cùng chế độ, khác nhánh, cùng chi phí ⇒ nhánh không đổi chi
//    phí, còn suất kỳ vẫn đúng 1 ở cả hai. Mọi con số kỳ vọng (1, 2, 3) là
//    literal GÕ TAY; không ca nào đọc `GEMINI_CALLS_PER_OPERATION` để dựng kỳ
//    vọng của chính nó.
//
// RANH GIỚI MOCK (backend DD Test Boundaries, dòng `consumeQuota`):
//   · `@upstash/redis` — GIẢ, một Map trong RAM. "Từ chối khi hạ tầng không
//     tới được" là chính lời khẳng định, nên nó phải hỏng theo lệnh.
//   · `@/lib/ugc/gemini` — chỉ `generateContent()`, GIẢ VÀ ĐẾM. Đây là điểm
//     phát duy nhất của repo (plan Task 5.2), tức ranh giới hợp lệ duy nhất để
//     đếm "0 byte tới nhà cung cấp".
//   · `@/lib/supabase/server` — đã giả sẵn ở tầm file cho INT-2/INT-3; INT-1
//     chuyển `sessionClientHolder` sang một client giả trong RAM.
//   · KHÔNG giả `quota.ts`, KHÔNG giả `readEntitlement.ts`, KHÔNG giả chính
//     server action. Giả một module nội bộ ở đây là khẳng định cái mock.
//
// BỘ ĐẾM RATE LIMIT DÙNG CHUNG PHẢI TẮT SUỐT CẢ FILE, kể cả sau khi INT-1 đặt
// lại `KV_REST_API_*` cho `consumeQuota()`. `rateLimitStore.getClient()` đọc env
// ở lần gọi ĐẦU TIÊN rồi nhớ kết quả, nên lời gọi ghim bên dưới — phát ra lúc
// nạp module, khi env còn trống — khoá nó ở `null` vĩnh viễn. Không có nó,
// `guard()` của INT-1 sẽ dựng client Upstash bằng URL giả và INT-3 thừa hưởng
// một bộ đếm dùng chung mà khối "WHY THE SHARED RATE-LIMIT STORE IS SWITCHED
// OFF" ở đầu file đã cố ý tắt.
//
// TRẦN `guard("uploadExam")` LÀ 5 LƯỢT/24h TRÊN MỖI NGƯỜI, đếm trong RAM tiến
// trình. Ba ca được cấp phép dùng CHUNG một tài khoản (khung đòi "same user"),
// tức 3/5. Ca (g) và ca (e) mỗi ca một tài khoản RIÊNG — (g) bắt buộc phải
// riêng, vì nó gieo bộ đếm upload ở mức cạn (3/3) và dùng chung tài khoản sẽ
// phá đúng phép đo delta của (b)/(c)/(f). Thêm ca upload thứ tư vào tài khoản
// dùng chung là chạm trần: đổi tài khoản, đừng nới trần.

/** Điểm phát Gemini — GIẢ VÀ ĐẾM. Ném lỗi: xem lý do 2 ở khối trên. Ghi vào
 *  `int1State.events` để thứ tự "đặt chỗ trước lời gọi" đo được, chứ không chỉ
 *  suy ra từ giá trị cuối. */
const { int1State, int1GenerateContent } = vi.hoisted(() => {
  const state = {
    redis: new Map<string, number>(),
    redisDown: false,
    events: [] as string[],
  };
  return {
    int1State: state,
    int1GenerateContent: vi.fn(() => {
      state.events.push("gemini:emit");
      throw new Error("INT-1: adapter Gemini giả — không request nào ra mạng");
    }),
  };
});

vi.mock("@/lib/ugc/gemini", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ugc/gemini")>()),
  generateContent: int1GenerateContent,
}));

/** Upstash GIẢ, dùng chung cho `readEntitlement()` (đường ĐỌC) và
 *  `consumeQuota()` (đường GHI) — đúng như production, nơi hai đường nói
 *  chuyện với cùng một Redis. `consumeQuota()` dựng một instance MỚI mỗi lượt
 *  gọi, nên trạng thái phải nằm ngoài class. */
vi.mock("@upstash/redis", () => {
  const touch = (op: string, key: string) => {
    int1State.events.push(`redis:${op}:${key}`);
    if (int1State.redisDown) throw new Error("INT-1: Upstash không trả lời (mô phỏng AC-024)");
  };
  const bump = (key: string, by: number): number => {
    touch(by >= 0 ? "incr" : "decr", key);
    const next = (int1State.redis.get(key) ?? 0) + by;
    int1State.redis.set(key, next);
    return next;
  };
  return {
    Redis: class {
      async mget<T>(...keys: string[]): Promise<T> {
        touch("mget", keys.join("|"));
        return keys.map((k) => int1State.redis.get(k) ?? null) as T;
      }
      async incr(key: string): Promise<number> {
        return bump(key, 1);
      }
      async decr(key: string): Promise<number> {
        return bump(key, -1);
      }
      async incrby(key: string, by: number): Promise<number> {
        return bump(key, by);
      }
      async decrby(key: string, by: number): Promise<number> {
        return bump(key, -by);
      }
      async expire(): Promise<number> {
        return 1;
      }
      async pexpire(): Promise<number> {
        return 1;
      }
    },
  };
});

const { extractAndAssemble } = await import("@/app/(layer4)/actions");
const { explainStep } = await import("@/features/exams/tutorActions");

/** Hợp đồng lỗi của S-01 (`UgcActionFailure`), lấy TỪ CHÍNH chữ ký hàm thay vì
 *  import lại tên kiểu: một lần đổi kiểu trả về sẽ hiện ra ở đây là lỗi biên
 *  dịch, chứ không lặng lẽ trôi. */
type Int1UploadResult = Awaited<ReturnType<typeof extractAndAssemble>>;

// Ghim bộ đếm rate limit dùng chung về `null` NGAY BÂY GIỜ — env còn trống ở
// thời điểm này (hai lệnh `delete` ở đầu file), và `getClient()` nhớ kết quả
// lần gọi đầu tiên. Khẳng định luôn thay vì gọi suông: nếu một ngày ai đó đặt
// lại env sớm hơn dòng này thì INT-3 mất lớp cách ly của nó và phải đỏ ở đây,
// chứ không phải đỏ ở một ca nói về chuyện khác.
const { isSharedStoreConfigured } = await import("@/lib/security/rateLimitStore");
if (isSharedStoreConfigured()) {
  throw new Error(
    "INT-1: bộ đếm rate limit dùng chung đã được cấu hình trước khi file kịp ghim nó về null — " +
      "INT-3 sẽ chạy với một Upstash giả. Xem khối 'WHY THE SHARED RATE-LIMIT STORE IS SWITCHED OFF'."
  );
}

/** Bốn tài khoản, bốn vai — và chúng phải KHÁC NHAU: xem đoạn về trần
 *  `guard("uploadExam")` ở khối trên. Tài khoản thứ tư chỉ đi đường GIA SƯ
 *  (`guard("explainStep")`, một xô đếm khác), và nó là CHỨNG CỨ ĐỐI CHỨNG
 *  DƯƠNG của ca (a): xem `int1.tutorGranted`. */
const INT1_USER_ID = "1c3f0a10-0000-4000-8000-00000000a001";
const INT1_QUOTA_OUT_USER_ID = "1c3f0a10-0000-4000-8000-00000000a002";
const INT1_REDIS_DOWN_USER_ID = "1c3f0a10-0000-4000-8000-00000000a003";
const INT1_TUTOR_OK_USER_ID = "1c3f0a10-0000-4000-8000-00000000a004";

/** Lượt làm bài đang xem, và câu hỏi được hỏi. Cùng cặp cho cả hai lượt gia sư
 *  (ca (a) bị chặn, và đối chứng dương được cấp phép), nên khác biệt DUY NHẤT
 *  giữa hai lượt là trạng thái bộ đếm hạn mức. */
const INT1_TUTOR_ATTEMPT_ID = "int1-attempt";
const INT1_TUTOR_QUESTION_ID = "int1-question";

/** Lịch sử làm bài khiến `int1-question` ĐỦ ĐIỀU KIỆN "sai hai lần": HAI dòng
 *  `exam_results` với HAI `attempt_id` KHÁC NHAU, mỗi dòng chấm câu ấy là sai.
 *  `computeWrongTwiceQuestionIds()` đếm theo attemptId phân biệt và ngưỡng là
 *  2, nên một dòng là chưa đủ; và dòng ĐANG XEM phải mang đúng
 *  `INT1_TUTOR_ATTEMPT_ID`, vì `explainStep()` còn đòi câu này đang sai TRONG
 *  CHÍNH lượt ấy (`eligibleInThisAttempt`).
 *
 *  Vì sao fixture này quan trọng hơn vẻ ngoài của nó: với `[]`, đường gia sư
 *  từ chối ở stage 4 và KHÔNG BAO GIỜ gọi Gemini — nên `geminiCalls === 0` của
 *  ca (a) đúng kể cả khi cổng hạn mức bị gỡ sạch. Đo được, không phải suy: gỡ
 *  cổng và đổi kỳ vọng thành `toBe(999)` cho ra `expected +0 to be 999`. */
function int1EligibleResults(): Record<string, unknown>[] {
  const wrong = [{ questionId: INT1_TUTOR_QUESTION_ID, isCorrect: false, scored: true }];
  return [
    { attempt_id: INT1_TUTOR_ATTEMPT_ID, per_question: wrong },
    { attempt_id: "int1-attempt-truoc", per_question: wrong },
  ];
}

/** `user_profiles.created_at` của cả ba: MỘT PHÚT TRƯỚC, tính lúc nạp module.
 *
 *  Không phải một literal cố định, và lý do là số học chứ không phải sở thích:
 *  mốc kỳ của gói Free là `created_at + 30 ngày × floor((now − created_at) /
 *  30 ngày)`, nên chỉ khi khoảng cách DƯỚI 30 ngày thì `floor(…) = 0` và mốc kỳ
 *  BẰNG ĐÚNG `created_at`. Một literal gõ cứng sẽ vượt 30 ngày sau vài tuần và
 *  biến cả khối này thành đỏ vì tờ lịch, không vì một lỗi. */
const INT1_CREATED_AT_MS = Date.now() - 60_000;
const INT1_CREATED_AT_ISO = new Date(INT1_CREATED_AT_MS).toISOString();

/** Mốc kỳ suy TAY từ dòng trên (xem lý lẽ ngay trên). KHÔNG gọi
 *  `periodStartEpoch()`, và khoá dưới đây KHÔNG gọi `quotaKey()`: một kỳ vọng
 *  dựng bằng chính hàm đang bị kiểm thì hai bên sai giống nhau vẫn xanh. */
const INT1_PERIOD_START_MS = INT1_CREATED_AT_MS;
function int1QuotaKey(kind: "tutor" | "upload", userId: string): string {
  return `quota:${kind}:${userId}:${INT1_PERIOD_START_MS}`;
}

/** Tổng mọi khoá ngân sách ngày. Cộng theo TIỀN TỐ chứ không dựng lại chuỗi
 *  `ai:budget:{ngày Pacific}`: dựng lại đòi một phép đổi múi giờ thứ hai trong
 *  file test, và một phép đổi múi giờ viết hai lần là đúng thứ `budgetKey()`
 *  tồn tại để chặn. Ca (h) khẳng định riêng rằng chỉ có MỘT khoá như vậy. */
function int1BudgetTotal(): number {
  let total = 0;
  for (const [key, value] of int1State.redis) {
    if (key.startsWith("ai:budget:")) total += value;
  }
  return total;
}

function int1BudgetKeys(): string[] {
  return [...int1State.redis.keys()].filter((k) => k.startsWith("ai:budget:"));
}

interface Int1QueryResult {
  data: unknown;
  error: { code?: string; message: string } | null;
  count: number | null;
}

interface Int1Fixture {
  userId: string;
  /** Dòng `exams` mà nhánh re-run đọc được; `null` = không phải re-run. */
  ownExam: Record<string, unknown> | null;
  /** Dòng `exam_attempts` cho đường gia sư. */
  attempt: Record<string, unknown> | null;
  /** Dòng `exam_results` mà `fetchOwnAttemptHistory()` đọc để tính lại tập
   *  "sai hai lần". PHẢI khác rỗng cho đường gia sư: `[]` làm
   *  `computeWrongTwiceQuestionIds()` trả tập rỗng và `explainStep()` từ chối
   *  bằng `not_eligible` TRƯỚC Gemini — tức một CỔNG KHÁC thoả mãn khẳng định
   *  "đúng 0 lượt gọi" của ca (a), bất kể cổng hạn mức còn sống hay không. */
  results: Record<string, unknown>[];
  /** Giá trị `count` mà truy vấn ĐẾM DÒNG cũ (`head: true`) trả về. Giữ lại để
   *  lượt chạy ĐỎ trên bản cài đặt cũ đi được tới cùng một chỗ như bản mới —
   *  nếu không, ca sẽ đỏ vì một lỗi đọc `count` chứ không vì cái nó khẳng định. */
  examRowCount: number;
}

/** Query builder giả — chuỗi hoá `.select().eq().gte().maybeSingle()` rồi
 *  `await`. Chỉ có `select` mới trả dữ liệu; `insert`/`update`/`delete` luôn
 *  `{error: null}` và chỉ ghi lại dấu vết, vì không ca nào ở đây khẳng định về
 *  nội dung ghi (INT-2/INT-3 mới nói về Postgres thật). */
class Int1Query implements PromiseLike<Int1QueryResult> {
  private op: "select" | "insert" | "update" | "delete" = "select";
  private head = false;

  constructor(
    private readonly table: string,
    private readonly fixture: Int1Fixture,
    private readonly trail: string[],
    private readonly telemetry: Record<string, unknown>[]
  ) {}

  select(_columns?: string, options?: { count?: string; head?: boolean }): this {
    this.head = options?.head === true;
    return this;
  }
  insert(rows: Record<string, unknown> | Record<string, unknown>[]): this {
    this.op = "insert";
    this.trail.push(`${this.table}:insert`);
    if (this.table === "telemetry_log") this.telemetry.push(rows as Record<string, unknown>);
    return this;
  }
  update(): this {
    this.op = "update";
    this.trail.push(`${this.table}:update`);
    return this;
  }
  delete(): this {
    this.op = "delete";
    this.trail.push(`${this.table}:delete`);
    return this;
  }
  eq(): this {
    return this;
  }
  gte(): this {
    return this;
  }
  in(): this {
    return this;
  }
  maybeSingle(): this {
    return this;
  }
  single(): this {
    return this;
  }

  private result(): Int1QueryResult {
    if (this.op !== "select") return { data: null, error: null, count: null };
    this.trail.push(`${this.table}:select${this.head ? ":count" : ""}`);
    switch (this.table) {
      case "subscriptions":
        // Chưa từng mua ⇒ Free. `readEntitlement()` hỏng-ĐÓNG về Free ở đường
        // này, nên `PLAN_LIMITS.free` (tutor 5 / upload 3) là bảng đang áp.
        return { data: null, error: null, count: null };
      case "user_profiles":
        return {
          data: { created_at: INT1_CREATED_AT_ISO, display_name: "INT-1 fixture" },
          error: null,
          count: null,
        };
      case "exams":
        return this.head
          ? { data: null, error: null, count: this.fixture.examRowCount }
          : { data: this.fixture.ownExam, error: null, count: null };
      case "exam_attempts":
        return { data: this.fixture.attempt, error: null, count: null };
      case "exam_results":
        return { data: this.fixture.results, error: null, count: null };
      case "questions":
        // Đường gia sư đọc ĐÚNG ba cột an toàn (`TUTOR_QUESTION_COLUMNS`).
        // Thiếu arm này thì `data: null` ⇒ `explainStep()` từ chối
        // `not_eligible` ở stage 5 và không bao giờ tới stage 6, nên lượt gọi
        // adapter dương của chứng cứ đối chứng bên dưới không tồn tại.
        return {
          data: {
            content: "INT-1: 2 + 2 bằng mấy?",
            question_type: "mcq",
            choices: [
              { id: "A", text: "3" },
              { id: "B", text: "4" },
            ],
          },
          error: null,
          count: null,
        };
      default:
        return { data: null, error: null, count: null };
    }
  }

  then<TResult1 = Int1QueryResult, TResult2 = never>(
    onFulfilled?: ((value: Int1QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.result()).then(onFulfilled, onRejected);
  }
}

function int1SupabaseClient(
  fixture: Int1Fixture,
  trail: string[],
  telemetry: Record<string, unknown>[]
): SupabaseClient {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: fixture.userId } }, error: null }),
    },
    from: (table: string) => new Int1Query(table, fixture, trail, telemetry),
    storage: {
      from: (bucket: string) => ({
        upload: async () => {
          trail.push(`storage:${bucket}:upload`);
          return { error: null };
        },
        remove: async () => {
          trail.push(`storage:${bucket}:remove`);
          return { error: null };
        },
      }),
    },
  } as unknown as SupabaseClient;
}

/** FormData của S-01. Hai file mang HAI dãy byte khác nhau, cố ý: một bản cài
 *  đặt lẫn file đề với file đáp án vẫn xanh nếu cả hai giống nhau. */
function int1UploadForm(mode: "manual" | "automatic", rerunExamId: string | null): FormData {
  const form = new FormData();
  form.set("entryMode", mode);
  form.set("title", "INT-1 đề kiểm tra");
  form.set("subject", "Math");
  form.set("grade", "10");
  form.set("durationMinutes", "45");
  form.set("questionFile", new File([new Uint8Array([1, 2, 3, 4])], "q.png", { type: "image/png" }));
  form.set("answerFile", new File([new Uint8Array([9, 8, 7, 6])], "a.png", { type: "image/png" }));
  if (rerunExamId) form.set("examId", rerunExamId);
  return form;
}

/** Bắt `console.warn` mà KHÔNG nuốt nó — cổng hạn mức của đường upload ghi mã
 *  telemetry đã ánh xạ ra đây (xem ca (e)/(g) và khối OK-04 trong actions.ts).
 *  Đường upload không có dòng `telemetry_log` nào để đọc: CHECK của §19 chỉ
 *  nhận `event_type in ('adaptive_route','tutor_invoke')`, nên console phía máy
 *  chủ là nơi DUY NHẤT mã ấy quan sát được hôm nay. */
function int1CaptureWarnings(sink: string[]): () => void {
  const original = console.warn;
  console.warn = (...args: unknown[]) => {
    sink.push(args.map((a) => String(a)).join(" "));
    (original as (...a: unknown[]) => void)(...args);
  };
  return () => {
    console.warn = original;
  };
}

interface Int1UploadRun {
  result: Int1UploadResult;
  counterBefore: number;
  counterAfter: number;
  budgetBefore: number;
  budgetAfter: number;
  geminiCalls: number;
  events: string[];
  warnings: string[];
  trail: string[];
}

async function int1RunUpload(options: {
  userId: string;
  mode: "manual" | "automatic";
  rerunExamId: string | null;
  redisDown?: boolean;
}): Promise<Int1UploadRun> {
  const trail: string[] = [];
  const telemetry: Record<string, unknown>[] = [];
  const warnings: string[] = [];
  const ownExam = options.rerunExamId
    ? {
        id: options.rerunExamId,
        title: "INT-1 đề cũ",
        subject: "Math",
        grade: 10,
        duration_minutes: 45,
        school: null,
        school_year: null,
        semester: null,
        // Rỗng để nhánh re-run không phải xoá câu hỏi cũ — lượt xoá ấy không
        // thuộc điều ca này khẳng định.
        question_ids: [],
      }
    : null;

  sessionClientHolder.current = int1SupabaseClient(
    // `results: []` — đường upload không đọc `exam_results` ở lượt nào cả; chỉ
    // đường gia sư mới cần lịch sử (xem `int1RunTutor`).
    { userId: options.userId, ownExam, attempt: null, results: [], examRowCount: 0 },
    trail,
    telemetry
  );

  const key = int1QuotaKey("upload", options.userId);
  const counterBefore = int1State.redis.get(key) ?? 0;
  const budgetBefore = int1BudgetTotal();
  int1State.events.length = 0;
  int1GenerateContent.mockClear();
  int1State.redisDown = options.redisDown === true;
  const restoreWarn = int1CaptureWarnings(warnings);

  let result: Int1UploadResult;
  try {
    result = await extractAndAssemble(int1UploadForm(options.mode, options.rerunExamId));
  } finally {
    restoreWarn();
    int1State.redisDown = false;
  }

  return {
    result,
    counterBefore,
    counterAfter: int1State.redis.get(key) ?? 0,
    budgetBefore,
    budgetAfter: int1BudgetTotal(),
    geminiCalls: int1GenerateContent.mock.calls.length,
    events: [...int1State.events],
    warnings,
    trail,
  };
}

interface Int1TutorRun {
  result: Awaited<ReturnType<typeof explainStep>>;
  telemetry: Record<string, unknown>[];
  geminiCalls: number;
}

/** Một lượt gia sư trên fixture ĐỦ ĐIỀU KIỆN. Hai lượt gọi hàm này khác nhau ở
 *  ĐÚNG MỘT thứ — bộ đếm `quota:tutor:{user}` đã gieo — nên chênh lệch số lượt
 *  gọi adapter giữa chúng quy được về cổng hạn mức và chỉ về nó. */
async function int1RunTutor(userId: string): Promise<Int1TutorRun> {
  const trail: string[] = [];
  const telemetry: Record<string, unknown>[] = [];
  sessionClientHolder.current = int1SupabaseClient(
    {
      userId,
      ownExam: null,
      attempt: { user_id: userId },
      results: int1EligibleResults(),
      examRowCount: 0,
    },
    trail,
    telemetry
  );
  int1GenerateContent.mockClear();
  const result = await explainStep(INT1_TUTOR_ATTEMPT_ID, INT1_TUTOR_QUESTION_ID);
  return { result, telemetry, geminiCalls: int1GenerateContent.mock.calls.length };
}

const INT1_ACTIONS_PATH = resolve(__dirname, "../../app/(layer4)/actions.ts");

/** Ảnh chụp của dãy thao tác, chạy MỘT lần trong `beforeAll`; mỗi `it` chỉ đọc
 *  ảnh chụp — cùng lối INT-2/INT-3. */
const int1 = {
  tutor: null as Int1TutorRun | null,
  tutorGranted: null as Int1TutorRun | null,
  typedNew: null as Int1UploadRun | null,
  typedRerun: null as Int1UploadRun | null,
  autoNew: null as Int1UploadRun | null,
  quotaOut: null as Int1UploadRun | null,
  redisDown: null as Int1UploadRun | null,
};

function int1Upload(run: Int1UploadRun | null, label: string): Int1UploadRun {
  if (!run) throw new Error(`INT-1: ảnh chụp "${label}" chưa được dựng`);
  return run;
}

describe(
  "INT-1 — cổng hạn mức chặn TRƯỚC byte Gemini đầu tiên, và đếm THAO TÁC chứ không đếm DÒNG (AC-017/018/019/024)",
  () => {
    const savedEnv: Record<string, string | undefined> = {};

    beforeAll(async () => {
      for (const name of [
        "KV_REST_API_URL",
        "KV_REST_API_TOKEN",
        "AI_BUDGET_DAILY_LIMIT",
        "AI_BUDGET_FREE_SHARE",
      ]) {
        savedEnv[name] = process.env[name];
      }
      // `consumeQuota()`/`readEntitlement()` đọc env LÚC GỌI, nên đặt ở đây là
      // đủ và không chạm tới bộ đếm rate limit đã ghim `null` ở tầm module.
      // Trần ngày để rộng và suất Free = 100%: ca nào ở khối này cũng phải bị
      // từ chối vì lý do nó tuyên, không phải vì cạn ngân sách của ca trước.
      process.env.KV_REST_API_URL = "https://int1-upstash-gia.invalid";
      process.env.KV_REST_API_TOKEN = "int1-token-gia";
      process.env.AI_BUDGET_DAILY_LIMIT = "1000";
      process.env.AI_BUDGET_FREE_SHARE = "1";

      int1State.redis.clear();
      int1State.redisDown = false;

      // --- (a) Đường GIA SƯ, hạn mức kỳ đã cạn -----------------------------
      // Gieo 5 = `PLAN_LIMITS.free.tutor`, gõ tay. Lượt gọi thứ 6 phải bị chặn.
      int1State.redis.set(int1QuotaKey("tutor", INT1_USER_ID), 5);
      int1.tutor = await int1RunTutor(INT1_USER_ID);

      // --- Đối chứng DƯƠNG cho (a) — TÀI KHOẢN RIÊNG -----------------------
      // Gieo 4 = `PLAN_LIMITS.free.tutor` − 1, gõ tay: lượt này là lượt thứ 5,
      // tức lượt CUỐI CÙNG còn được cấp phép. Cùng fixture, cùng cặp
      // attempt/question với (a); khác biệt duy nhất là bộ đếm. Không có lượt
      // này thì "đúng 0 lượt gọi adapter" của (a) cũng xanh với một cổng từ
      // chối SẠCH mọi thứ — và đó không phải là điều AC-018 nói.
      int1State.redis.set(int1QuotaKey("tutor", INT1_TUTOR_OK_USER_ID), 4);
      int1.tutorGranted = await int1RunTutor(INT1_TUTOR_OK_USER_ID);

      // --- (b)(c)(f) Ba lượt upload ĐƯỢC CẤP PHÉP, cùng một tài khoản ------
      // THỨ TỰ BA LỜI GỌI DƯỚI ĐÂY LÀ MỘT PHẦN CỦA KHẲNG ĐỊNH, không phải cách
      // sắp xếp cho dễ đọc: (b)/(c)/(f) so `counterBefore`/`counterAfter` với
      // các literal TUYỆT ĐỐI 0→1, 1→2, 2→3 trên cùng một khoá kỳ của cùng một
      // tài khoản. Đảo hai lượt bất kỳ, hay chèn thêm một lượt upload cho
      // `INT1_USER_ID` vào giữa, làm ba ca ấy đỏ vì số học chứ không vì một lỗi.
      int1.typedNew = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "manual",
        rerunExamId: null,
      });
      int1.typedRerun = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "manual",
        rerunExamId: "int1-exam-rerun",
      });
      int1.autoNew = await int1RunUpload({
        userId: INT1_USER_ID,
        mode: "automatic",
        rerunExamId: null,
      });

      // --- (g) Hạn mức upload đã cạn — TÀI KHOẢN RIÊNG ---------------------
      // Gieo 3 = `PLAN_LIMITS.free.upload`, gõ tay.
      int1State.redis.set(int1QuotaKey("upload", INT1_QUOTA_OUT_USER_ID), 3);
      int1.quotaOut = await int1RunUpload({
        userId: INT1_QUOTA_OUT_USER_ID,
        mode: "automatic",
        rerunExamId: null,
      });

      // --- (e) Redis không trả lời — TÀI KHOẢN RIÊNG -----------------------
      int1.redisDown = await int1RunUpload({
        userId: INT1_REDIS_DOWN_USER_ID,
        mode: "manual",
        rerunExamId: null,
        redisDown: true,
      });
    }, 60_000);

    afterAll(() => {
      for (const [name, value] of Object.entries(savedEnv)) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
      int1State.redis.clear();
      sessionClientHolder.current = null;
    });

    // ---------------------------------------------------------------------
    // (a) AC-018 — đường gia sư cạn hạn mức: 0 lượt gọi adapter, và lý do THẬT
    //     chỉ tồn tại trong telemetry
    // ---------------------------------------------------------------------
    it("(a) hạn mức gia sư Free đã cạn ⇒ 0 lượt gọi adapter Gemini, và `telemetry_log.error_code` mang `user_quota_exhausted`", () => {
      const snapshot = int1.tutor;
      if (!snapshot) throw new Error("INT-1: ảnh chụp đường gia sư chưa được dựng");

      // Bản cài đặt sai bị loại: một cổng đặt SAU lời gọi Gemini (hoặc một
      // nhánh từ chối "rơi xuyên"). Đếm lượt gọi, không đọc giá trị trả về —
      // giá trị trả về vẫn đúng khi request đã ra tới nhà cung cấp rồi mới bị
      // chặn, và tiền thì đã tiêu.
      expect(snapshot.geminiCalls).toBe(0);
      expect(snapshot.result).toEqual({ error: "not_eligible" });

      // Lý do PHÂN BIỆT chỉ sống ở đây (OK-04). Một hằng gộp cả ba lý do về
      // một chuỗi vẫn xanh nếu chỉ kiểm "có ghi telemetry" — nên kiểm giá trị.
      expect(snapshot.telemetry).toHaveLength(1);
      expect(snapshot.telemetry[0]).toMatchObject({
        event_type: "tutor_invoke",
        success: false,
        error_code: "user_quota_exhausted",
      });
    });

    // ---------------------------------------------------------------------
    // Đối chứng DƯƠNG của (a) — cổng gia sư KHÔNG từ chối tất cả
    // ---------------------------------------------------------------------
    it("đối chứng dương: cùng fixture, hạn mức gia sư còn ĐÚNG 1 suất ⇒ adapter Gemini được gọi ĐÚNG 1 lần", () => {
      const snapshot = int1.tutorGranted;
      if (!snapshot) throw new Error("INT-1: ảnh chụp đối chứng dương chưa được dựng");

      // Bản cài đặt sai bị loại: một cổng (bất kỳ cổng nào trên đường gia sư)
      // từ chối MỌI lượt. Nó làm `geminiCalls === 0` của ca (a) xanh mà không
      // quan sát gì về hạn mức — và đó chính là điều đã đo được: với fixture
      // lịch sử rỗng trước đây, gỡ sạch cổng hạn mức vẫn để ca (a) xanh.
      // `1` là literal gõ tay (= `GEMINI_CALLS_PER_OPERATION.tutor`), không đọc
      // từ bảng giá.
      expect(snapshot.geminiCalls).toBe(1);
      expect(snapshot.telemetry).toHaveLength(1);
      // Và lượt này KHÔNG bị cổng hạn mức chặn — nếu bị, mã dưới đây là
      // `user_quota_exhausted` và ca (a) mất chỗ dựa của nó.
      expect(snapshot.telemetry[0]).not.toMatchObject({ error_code: "user_quota_exhausted" });
    });

    // ---------------------------------------------------------------------
    // (b) AC-019 — nhánh TẠO MỚI: "expected non-difference" của phép so sánh
    // ---------------------------------------------------------------------
    it("(b) upload `rerunExamId` UNSET ⇒ bộ đếm kỳ của người dùng tăng ĐÚNG 1, và ngân sách đặt chỗ ĐÚNG 2 request", () => {
      const run = int1Upload(int1.typedNew, "typedNew");

      // Bản cài đặt sai bị loại: cổng vẫn đếm SỐ DÒNG (bộ đếm Redis không nhúc
      // nhích), hoặc cổng không được gọi. Đọc trước và sau, so với literal.
      expect(run.counterBefore).toBe(0);
      expect(run.counterAfter).toBe(1);
      expect(run.counterAfter - run.counterBefore).toBe(1);

      // Bản cài đặt sai bị loại: gộp hai bộ đếm về một ĐƠN VỊ (ngân sách +1
      // mỗi thao tác thay vì +số request) — dưới-đếm 2× đúng như thiết kế v1.4
      // sinh ra để sửa. `2` là literal gõ tay, không đọc từ bảng giá.
      expect(run.budgetAfter - run.budgetBefore).toBe(2);
      expect(run.geminiCalls).toBe(2);

      // Chứng cứ dương: cổng KHÔNG từ chối tất cả. Không có dòng này thì
      // "đúng 0 lượt gọi" ở (a)/(e)/(g) xanh cả với một cổng chặn sạch.
      expect(run.geminiCalls).toBeGreaterThan(0);
      expect(run.result.error.kind).toBe("extraction");
    });

    // ---------------------------------------------------------------------
    // (c) AC-017 + AC-019 — nhánh RE-RUN: "expected difference"
    // ---------------------------------------------------------------------
    it("(c) upload `rerunExamId` SET ⇒ bộ đếm kỳ vẫn tăng ĐÚNG 1 — nhánh mà bản cũ (đếm số dòng TẠO MỚI) không tính lượt nào", () => {
      const run = int1Upload(int1.typedRerun, "typedRerun");

      // Bản cài đặt sai bị loại: khối đếm cũ, hoặc bất kỳ bản thay thế nào vẫn
      // lấy "số dòng exams tạo trong 24h" làm cơ sở — một lượt xử lý lại không
      // tạo dòng nào, nên delta của nó là 0 và ca này đỏ.
      expect(run.counterBefore).toBe(1);
      expect(run.counterAfter).toBe(2);
      expect(run.counterAfter - run.counterBefore).toBe(1);

      // Cùng CHẾ ĐỘ với (b), khác NHÁNH ⇒ cùng chi phí. Cặp (b)/(c) một mình
      // vẫn hợp với một bản tính chi phí theo nhánh; (f) mới đóng chỗ đó lại.
      expect(run.budgetAfter - run.budgetBefore).toBe(2);
      expect(run.geminiCalls).toBe(2);
      expect(run.trail).toContain("exams:update");
      expect(run.result.error.kind).toBe("extraction");
    });

    // ---------------------------------------------------------------------
    // (f) Chi phí đi theo CHẾ ĐỘ, không theo nhánh, và không phải một hằng
    // ---------------------------------------------------------------------
    it("(f) upload chế độ `automatic`, `rerunExamId` UNSET ⇒ vẫn ĐÚNG 1 suất kỳ, nhưng ĐÚNG 3 request đặt chỗ", () => {
      const run = int1Upload(int1.autoNew, "autoNew");

      // Bản cài đặt sai bị loại: chi phí là một HẰNG (2 hoặc 3 cho mọi lượt),
      // hoặc chi phí đọc theo `rerunExamId` thay vì theo `entryMode`. Cả hai
      // đều vượt qua (b)+(c) và cùng chết ở đây.
      expect(run.budgetAfter - run.budgetBefore).toBe(3);
      expect(run.geminiCalls).toBe(3);

      // Và ĐƠN VỊ của bộ đếm người dùng vẫn là THAO TÁC: 3 request, 1 suất.
      // Trộn hai đơn vị (`+geminiCalls` vào khoá kỳ) làm số này thành 3.
      expect(run.counterBefore).toBe(2);
      expect(run.counterAfter).toBe(3);
    });

    // ---------------------------------------------------------------------
    // Đặt chỗ, không phải tích từng lượt gọi
    // ---------------------------------------------------------------------
    it("ngân sách nhích bằng MỘT lệnh, và lệnh đó phát TRƯỚC lời gọi Gemini đầu tiên — chỉ thứ tự chứng minh được đó là ĐẶT CHỖ", () => {
      const run = int1Upload(int1.autoNew, "autoNew");
      const reservation = run.events.findIndex((e) => e.startsWith("redis:incr:ai:budget:"));
      const firstEmit = run.events.indexOf("gemini:emit");

      // Bản cài đặt sai bị loại: một cái tích +1 mỗi lời gọi đặt trong
      // `gemini.ts`. Nó cho ra CÙNG tổng 3, nên chỉ so tổng thì không thấy —
      // nhưng lệnh đầu tiên của nó nằm SAU lời gọi đầu tiên, và một lời từ
      // chối rơi vào giữa `Promise.all` sẽ bỏ lại một lượt bóc đề dở dang.
      expect(reservation).toBeGreaterThanOrEqual(0);
      expect(firstEmit).toBeGreaterThanOrEqual(0);
      expect(reservation).toBeLessThan(firstEmit);

      // Đúng MỘT lệnh chạm khoá ngân sách trong cả lượt: ba lời gọi, một lần
      // nhích.
      expect(run.events.filter((e) => e.includes(":ai:budget:"))).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // (g) AC-018/AC-053 trên chính đường upload
    // ---------------------------------------------------------------------
    it("(g) hạn mức upload đã cạn ⇒ 0 lượt gọi adapter, bộ đếm kỳ KHÔNG bị trừ, và mã telemetry là `user_quota_exhausted`", () => {
      const run = int1Upload(int1.quotaOut, "quotaOut");

      expect(run.geminiCalls).toBe(0);
      // Hoàn lại: một lượt bị chặn không được tính phí. INCR rồi DECR ⇒ về đúng
      // giá trị đã gieo.
      expect(run.counterBefore).toBe(3);
      expect(run.counterAfter).toBe(3);
      expect(run.budgetAfter - run.budgetBefore).toBe(0);

      // BỀ MẶT NGƯỜI DÙNG, không chỉ bộ đếm và console. Không có hai dòng này
      // thì `return consumed.reason === "user_quota" ? … : …` trong actions.ts
      // đổi được thành `return false` mà cả làn vẫn xanh: người cạn hạn mức
      // nhận câu trả lời HẠ TẦNG (`kind: "server"`) thay vì câu trả lời CHÍNH
      // SÁCH mà AC-018/AC-053 đòi, và ca (e) — vốn khẳng định đúng
      // `kind === "server"` — không phân biệt nổi hai thứ ấy. Đo được: đột biến
      // ấy để lại nguyên 25 passed trước khi hai dòng này tồn tại.
      expect(run.result.error.kind).toBe("validation");
      expect(run.result.error.message).toContain("used every exam upload");

      // OK-04 tại chỗ từ chối của đường upload. GIÁ TRỊ KHÁC với ca (e) bên
      // dưới: một bảng ánh xạ thật ra là một hằng sẽ xanh ở một trong hai ca,
      // không bao giờ xanh ở cả hai.
      //
      // Lọc về ĐÚNG MỘT dòng từ chối thay vì tìm trong cả luồng cảnh báo: sink
      // này còn nhận `console.warn` của chính `consumeQuota()` (quota.ts, nhánh
      // catch), nên một phép tìm chuỗi trên toàn luồng cũng xanh khi cùng chuỗi
      // ấy phát ra từ một chỗ khác hẳn — đúng hình dạng "nới rộng" của một phép
      // tìm chữ trên cả trang.
      // ⚠ TẠM: hai khẳng định console này ĐƯỢC LÊN LỊCH THAY THẾ bằng một khẳng
      // định trên `telemetry_log` ngay khi đường upload có `event_type` riêng
      // (CHECK §19 hôm nay chỉ nhận `adaptive_route`/`tutor_invoke`). Chúng
      // KHÔNG được thừa kế trong im lặng như bằng chứng rằng mã ấy TRUY VẤN
      // ĐƯỢC — console máy chủ không truy vấn được.
      const refusal = run.warnings.filter((w) =>
        w.startsWith("[extractAndAssemble] cổng hạn mức từ chối:")
      );
      expect(refusal).toHaveLength(1);
      expect(refusal[0]).toContain("error_code=user_quota_exhausted");
      expect(refusal[0]).not.toContain("error_code=server");
    });

    // ---------------------------------------------------------------------
    // (e) AC-024 — hỏng ĐÓNG
    // ---------------------------------------------------------------------
    it("(e) Redis không trả lời ⇒ upload bị TỪ CHỐI với 0 lượt gọi adapter, và mã telemetry là `server`", () => {
      const run = int1Upload(int1.redisDown, "redisDown");

      // Bản cài đặt sai bị loại: hỏng-MỞ (Upstash chết ⇒ cho qua), hoặc tụt về
      // một bộ đếm trong RAM như `rateLimit.ts` làm — bộ đếm ấy nhân lên theo
      // số instance nên không bao giờ chặn nổi một ngân sách toàn dự án.
      expect(run.geminiCalls).toBe(0);
      expect(run.result.error.kind).toBe("server");
      expect(run.counterAfter - run.counterBefore).toBe(0);
      expect(run.budgetAfter - run.budgetBefore).toBe(0);

      // `unavailable` KHÔNG có literal riêng: nó là sự cố hạ tầng của CHÍNH TA.
      //
      // Lọc về ĐÚNG MỘT dòng từ chối, cùng lý do như ca (g) — và ở ca này thì
      // chắc chắn: `consumeQuota()` tự ghi thêm một dòng `[consumeQuota] bộ đếm
      // không ghi được, từ chối:` ở nhánh catch, nên sink có ÍT NHẤT hai dòng
      // và một phép tìm trên toàn luồng là phép tìm rộng nhất có thể.
      // ⚠ TẠM: xem ghi chú cùng nội dung ở ca (g) — hai khẳng định console này
      // được lên lịch thay thế bằng một khẳng định `telemetry_log` khi đường
      // upload có `event_type` riêng, và không được thừa kế như bằng chứng
      // rằng mã ấy truy vấn được.
      const refusal = run.warnings.filter((w) =>
        w.startsWith("[extractAndAssemble] cổng hạn mức từ chối:")
      );
      expect(refusal).toHaveLength(1);
      expect(refusal[0]).toContain("error_code=server");
      expect(refusal[0]).not.toContain("error_code=user_quota_exhausted");
    });

    // ---------------------------------------------------------------------
    // (h) Hình dạng khoá — hai đường phải ghép ra cùng một chuỗi
    // ---------------------------------------------------------------------
    it("(h) cả ba lượt cấp phép ghi vào ĐÚNG MỘT khoá kỳ `quota:upload:{user}:{periodStart}`, và đúng MỘT khoá ngân sách ngày", () => {
      // Nếu đường GHI ghép khoá khác đường ĐỌC, mọi delta ở trên vẫn có thể
      // đúng bằng cách tình cờ (0 → 0), nên chỗ này khẳng định chính chuỗi —
      // gõ tay, không gọi `quotaKey()`.
      const uploadKeys = [...int1State.redis.keys()].filter((k) => k.startsWith("quota:upload:"));
      expect(uploadKeys.sort()).toEqual(
        [
          `quota:upload:${INT1_USER_ID}:${INT1_PERIOD_START_MS}`,
          `quota:upload:${INT1_QUOTA_OUT_USER_ID}:${INT1_PERIOD_START_MS}`,
        ].sort()
      );
      // Tài khoản của ca (e) KHÔNG có khoá nào: Redis chết trước lệnh ghi đầu
      // tiên, nên một khoá mang tên nó ở đây có nghĩa là đường ghi đã lách qua
      // được lớp hỏng — đúng cái AC-024 cấm.
      expect(uploadKeys).not.toContain(
        `quota:upload:${INT1_REDIS_DOWN_USER_ID}:${INT1_PERIOD_START_MS}`
      );
      // GIẢ ĐỊNH GÁNH TẢI: mọi lượt của khối này rơi vào CÙNG MỘT ngày lịch
      // Pacific. `budgetKey()` ghép khoá theo ngày Pacific, nên một lượt chạy
      // vắt qua nửa đêm Pacific (07:00/08:00 UTC) sinh khoá thứ hai và ca này
      // đỏ vì tờ lịch chứ không vì một lỗi. Chấp nhận có ý thức: hai khoá cũng
      // đúng là hình dạng hỏng cần bắt (`budgetKey()` ghép khác nhau giữa các
      // lượt), và không tách được hai nguyên nhân mà không đóng băng đồng hồ
      // của cả tiến trình — thứ sẽ phá luôn mốc kỳ suy từ `created_at`.
      expect(int1BudgetKeys()).toHaveLength(1);
    });

    // ---------------------------------------------------------------------
    // (d) AC-017 — khẳng định VẮNG MẶT, kèm hai khẳng định CÓ MẶT
    // ---------------------------------------------------------------------
    it("(d) `app/(layer4)/actions.ts` không còn tham chiếu nào tới `LIMITS.MAX_UPLOADS_PER_DAY`, và cổng mới đứng ở chỗ của nó", () => {
      // Hai khẳng định CÓ MẶT trước đã: "không tìm thấy chuỗi" và "đọc nhầm
      // file / file rỗng" cho ra cùng một kết quả, và khung INT-1 ghi sai
      // đường dẫn ((exams)) đúng theo cách đó.
      expect(existsSync(INT1_ACTIONS_PATH)).toBe(true);
      const source = readFileSync(INT1_ACTIONS_PATH, "utf8");
      expect(source).toContain("export async function extractAndAssemble(");

      expect(source).not.toContain("MAX_UPLOADS_PER_DAY");

      // Thay thế, không phải chỉ xoá: cổng mới phải có mặt, đọc chi phí từ BẢNG
      // GIÁ (plan Task 5.2) chứ không từ một literal, và `metaCall` phải được
      // suy ĐÚNG MỘT LẦN — hai lời khai rời của cùng quy tắc chế-độ→chi-phí là
      // đúng hình dạng hỏng mà I004 tồn tại để xoá.
      expect(source).toMatch(
        /consumeQuota\(\s*"upload",\s*user\.id,\s*ent,\s*metaCall\s*\?\s*GEMINI_CALLS_PER_OPERATION\.uploadAutomatic\s*:\s*GEMINI_CALLS_PER_OPERATION\.uploadTyped\s*\)/
      );
      expect(source.match(/const metaCall\b/g)).toHaveLength(1);
      expect(source).not.toMatch(/consumeQuota\([^)]*\?\s*3\s*:\s*2/);
    });
  },
  120_000
);

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
