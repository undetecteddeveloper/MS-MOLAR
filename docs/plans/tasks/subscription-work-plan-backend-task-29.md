# Task: service-integration-e2e SVC-1 — settlement grants exactly one period, exactly once, and only after the provider says paid

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.1**
Layer: **backend** (`SOURCE/tests/e2e/service/**` against real Postgres)

Metadata:
- Dependencies: backend-task-02 (`test:localdb`), backend-task-07 (service fixtures), backend-task-11 (gate B on dev), backend-task-16 (`settleOrder`), backend-task-09 (the SQL function)
- Provides: the proof of ADR-0014 idempotency **and** of the recorded two-statement deviation
- Size: Small (1 test file)

## Implementation Content

Against the **real dev database**, after gate B is green there. **Only the payOS adapter is stubbed (and counted); `service-role.ts` is left real**, because this case claim is about the write, not about call order.

Read observable state **before and after by query** for every claim: `subscriptions.expires_at`, `subscriptions.period_anchor_at`, `payment_orders.status`, `payment_orders.settled_at`.

Cases (a)…(h) exactly as the skeleton specifies, including:
- the **replay** boundary — *n* ≥ 3 replays ⇒ `expires_at` still advanced by **exactly one period in total**;
- the **early-purchase** branch — 10 days remaining ⇒ **+40 days** and `period_anchor_at` moved to now (more days, **one** allowance);
- the negative that settlement is **never reachable** without a preceding `getPaymentStatus() === "paid"` — **a row count of 0 after the call is the assertion**;
- the **adapter-rejects** negative — zero writes, adapter invocation count **exactly 1**, no retry storm;
- `record_payment_settlement` **not** executable with a user JWT (AC-033).

**Expected instants are hardcoded in the test, never read back from the implementation.** Teardown removes every fixture-prefixed row.

**This is also what proves the recorded ADR-0014 deviation** (two statements rather than one) rather than assuming it: **run the concurrent-settlement case, not only the sequential one.**

## Target Files
- [x] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-1 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-1** `Proof obligation:` / `Primary failure mode:` annotation block — cases (a)…(h))
- `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (plan Task 0.8 — prefix, sessions, counted adapter stub)
- `SOURCE/lib/billing/settleOrder.ts` (plan Task 3.2 — the four-step order)
- `SOURCE/lib/supabase/service-role.ts` (`recordPaymentSettlement()` — left **real**)
- `SOURCE/supabase/schema.sql` (`record_payment_settlement` — the `status='pending'` guard, the `greatest()` extension, the revokes)
- `SOURCE/vitest.localdb.config.ts` (plan Task 0.2)
- `docs/design/subscription-backend-design.md` (§ Second verification point)
- `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance)
- `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md` (§ Implementation Guidance) | data_flow | "Extend with `max(expires_at, now()) + 30 days`. Write it once, in one function, and test **all three cases: still valid, inside grace, past grace**" | All three cases are executed against the real function and each asserts a hardcoded expected instant |
| `docs/adr/ADR-0014-payment-webhook-trust-boundary.md` (§ Decision) | persistence | Replay defence is state-based: idempotency is the order own `pending → paid` transition, guarded in SQL — no nonce table, no timestamp window, no clock | *n* ≥ 3 replays advance `expires_at` by exactly one period in total, and `settled_at` is set once |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `record_payment_settlement`) | derived-display | `set expires_at = greatest(public.subscriptions.expires_at, now()) + make_interval(days => p_period_days)`, `period_anchor_at = now()` — in the same statement | The early-purchase case observes +40 days from a 10-days-remaining start and `period_anchor_at` moved to now |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record the (a)…(h) case list verbatim
- [x] Write each case with **hardcoded expected instants** and before/after queries; confirm they fail against a deliberately weakened guard
### 2. Green Phase
- [x] Execute under `npm run test:localdb` against dev; all cases green
### 3. Refactor Phase
- [x] Re-run twice in a row to confirm teardown idempotency; run the concurrent case repeatedly

## Quality Assurance Mechanisms
- Real-Postgres integration tests (precedent `recordSkillMastery.int.test.ts`) — Enforces: `greatest()`, `on conflict do update`, the `status='pending'` guard, the row lock, RLS visibility — Config: `SOURCE/vitest.localdb.config.ts`
- `SOURCE/supabase/test-rls.ts` — Enforces: the AC-033 denial (a user JWT cannot execute the function)

## Operation Verification Methods
- **Verification method**: real-Postgres service-lane execution with only the payOS adapter stubbed and counted; every claim read back by query.
- **Success criteria**: all (a)…(h) cases green; the concurrent case green; `expires_at` advanced by exactly one period across *n* ≥ 3 replays; `settled_at` set once; a row count of **0** after a call with no preceding `paid`.
- **Failure response**: if the concurrent case fails, the recorded two-statement deviation is **not** safe — fall back to the recorded alternative (a single data-modifying CTE plus an explicit null-beneficiary post-check, a local change to that one function) rather than accepting the result.
- **Verification level**: L1 (real database, real function, observable rows).

## Proof Obligations
- **Claim (no-op)**: a repeated settlement of an already-settled record changes nothing and reports so.
- **Primary failure mode**: asserting settlement succeeded does not prove the second replay wrote nothing — the named hollow-test shape for this feature.
- **Boundary to exercise**: the real dev Postgres, through `settleOrder()` and the real `service-role.ts`.
- **State assertion**: `expires_at`, `period_anchor_at`, `status`, `settled_at` read **before and after each** replay; total advance exactly one period; `settled_at` unchanged after the first.
- **Mock boundary rationale**: only the payOS adapter is stubbed (external paid service) and it is counted; everything else is real.
- **Residual**: production behaviour under a genuine payOS delivery is plan Task 6.7.

## Completion Criteria
- [x] All (a)…(h) cases green, including the concurrent-settlement case
- [x] Expected instants hardcoded in the test, never read back from the implementation
- [x] Teardown removes every fixture-prefixed row; the suite passes twice in a row
- [x] Every Binding Decisions and Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Test-case resolution: **service-integration-e2e 1/2**

## Notes
- Impact scope: test only.
- Scope boundary: `service-role.ts` stays real; do not stub it to make a case pass.

## Investigation Notes
(Record the before/after query results, the hardcoded instants, and each Compliance Check result here.)

### Phiên thực thi (backend-task-29)

**Tiền đề chặn.** `npm run verify:schema` (cổng B) chạy từ `SOURCE/` — XANH trên dev
`hynwleaxtbtjzkvpjsug`, vân tay `021dd1387945`, exit 0. Không chạm prod.

**Baseline đo trước khi viết ca nào:** `payment_orders` = 0 dòng, `subscriptions` = 0 dòng.

**Investigation Targets — cái gì đọc được ở đâu.**
- `subscription.service.e2e.test.ts` (skeleton): SVC-1 nêu (a)…(h) nguyên văn; chép vào
  bảng ca dưới đây. `@lane`, mock boundary ("chỉ adapter payOS, `service-role.ts` để
  THẬT"), và giới hạn "không tiền thật" là ràng buộc cứng.
- `subscriptionServiceFixtures.ts`: `createSubscriptionServiceFixture({caseTag, orderCodeBlock,
  sessionHolder})`; teardown ba phạm vi (block mã đơn / `user_id` / email prefix); `memo` chỉ
  để PHÁT HIỆN, không bao giờ là vị từ delete; stub đếm LÚC VÀO (`getPaymentStatusCallCount`);
  `holdNextPaymentStatus()`/`releaseHeldPaymentStatus()` cho ca đồng thời; `FIXTURE_PERIOD_DAYS
  = 30` là bản CHÉP TAY — SVC-1 không được đọc kỳ hạn từ nó lẫn từ hàm SQL.
- `settleOrder.ts`: bốn bước, thứ tự là tính đúng đắn. Bước 1 đọc dòng đơn (`status !==
  'pending'` → `not_pending`), bước 2 hỏi payOS, bước 3 so `amount` với DÒNG ĐƠN, bước 4 gọi
  `recordPaymentSettlement()`. `outcome.expiresAt === null` ⇒ `not_pending` (không phải lỗi).
- `service-role.ts:451` `recordPaymentSettlement()`: `rpc("record_payment_settlement",
  { p_order_code })` — **KHÔNG truyền `p_period_days`**. Đây là giả định chưa từng được quan
  sát mà ca (a) tồn tại để trả lời.
- `schema.sql:1734`: `record_payment_settlement(p_order_code bigint, p_period_days integer
  default 30)`; idempotency = vị từ `status = 'pending'` TRONG `update … returning`; nhánh
  `v_user_id is null` → `raise exception … errcode = 'check_violation'`; gia hạn
  `greatest(subscriptions.expires_at, now()) + make_interval(days => p_period_days)` với
  `period_anchor_at = now()` CÙNG câu lệnh; `revoke all … from public, anon, authenticated`,
  `grant execute … to service_role`.
- `vitest.localdb.config.ts`: include `tests/e2e/service/**/*.test.{ts,tsx}`, env node, alias
  `@`. Làn chạy tay: `npm run test:localdb`.
- Backend DD § Second verification point: hai lượt `settleOrder()` ⇒ `paid`, `settled_at` đặt
  MỘT lần, `expires_at` tiến đúng MỘT kỳ, lượt hai trả `{settled:false, reason:"not_pending"}`;
  rồi ca mua sớm (còn 10 ngày ⇒ +40 ngày, `period_anchor_at` dời về now).
- ADR-0013 § Implementation Guidance: `max(expires_at, now()) + 30 days`, kiểm **cả ba** ca
  còn hạn / trong ân hạn / quá ân hạn. Ân hạn = 3 ngày (`readEntitlement.ts:41`).
- ADR-0014 § Decision 4: phòng phát lại theo TRẠNG THÁI, không bảng nonce, không đồng hồ.

**Đồng hồ — vì sao mọi mốc kỳ vọng neo vào `settled_at` chứ không vào `Date.now()`.**
`now()` trong plpgsql là `transaction_timestamp()`, HẰNG trong suốt thân hàm. `settled_at`,
`period_anchor_at` và số hạng `now()` của `greatest()` vì thế là CÙNG một giá trị. Neo vào
`settled_at` (đọc lại từ dòng đơn) biến mọi kỳ vọng thành đẳng thức CHÍNH XÁC, không phụ
thuộc lệch đồng hồ giữa tiến trình test và Postgres. Chỉ MỘT khẳng định dùng cửa sổ có
biên: `settled_at` phải nằm trong ±10 phút quanh đồng hồ tiến trình — biên đủ rộng để không
flake vì lệch NTP/độ trễ mạng, đủ chặt để một database có đồng hồ sai hẳn (hoặc một cột bị
gán một mốc cũ) vẫn lộ ra.
`EXPECTED_PERIOD_MS = 2_592_000_000` viết tay (30 × 24 × 60 × 60 × 1000), không suy ra từ
`FIXTURE_PERIOD_DAYS` lẫn từ hàm SQL. Đẳng thức chính xác hợp lệ vì `make_interval(days => 30)`
cộng ngày theo TimeZone của session, và cả UTC (mặc định Supabase) lẫn `Asia/Ho_Chi_Minh` đều
KHÔNG có DST.

**Binding Decisions — cách làm dự kiến và kết quả đánh giá.**
- *data_flow* (ADR-0013): dự kiến chạy ba ca gia hạn riêng biệt trên user B với ba tiền
  trạng thái khác nhau — còn hạn (`expires_at = now+10d`), trong ân hạn (`now−1d`, còn trong
  cửa sổ 3 ngày), quá ân hạn (`now−10d`) — mỗi ca một đơn `pending` riêng, mỗi ca khẳng định
  một mốc kỳ vọng CHÍNH XÁC neo vào `settled_at`/mốc đã seed. → **Y**.
- *persistence* (ADR-0014): dự kiến 1 lượt cấp + 4 lượt phát lại trên cùng `orderCode` (n = 4
  ≥ 3), khẳng định `expires_at` và `settled_at` GIỮ NGUYÊN CHUỖI sau mỗi lượt, và tổng mức
  tiến đúng một kỳ. Cộng ca ĐỒNG THỜI: hai lượt `recheckOrder()` cùng lúc, cả hai đã qua
  bước 1 khi dòng còn `pending` (cổng chờ `count === 2` bảo đảm điều đó), nên lượt no-op chỉ
  có thể đến từ vị từ SQL. → **Y**.

**Reference Contracts — cách làm dự kiến và kết quả đánh giá.**
- *derived-display* (DD § Schema): ca mua sớm seed `expires_at = now+10d` và
  `period_anchor_at = now−20d` — HAI giá trị KHÁC NHAU trên hai cột cùng kiểu, nên một cài
  đặt gán nhầm cột lộ ra. Khẳng định sau khi settle: `expires_at` = mốc đã seed + 2 592 000 000 ms
  ĐÚNG BẰNG (tức +40 ngày kể từ hôm nay), và `expires_at` **khác** `settled_at + 30d` (đáp
  án sai của một cài đặt dùng `now()` thay `greatest()`), và `period_anchor_at` = `settled_at`.
  → **Y**.

### Kết quả thực thi

**Câu trả lời cho `p_period_days` — PostgREST CÓ áp được `default 30` phía SQL.**
Chứng cứ hai chiều, đo trên dev, không phải suy luận:
1. Mã đang ship (một tham số) ⇒ ca (a) xanh với khẳng định
   `expires_at − settled_at === 2 592 000 000 ms` (30 ngày, viết tay). Nếu PostgREST
   truyền `null` thì `make_interval(days => null)` cho `null` và va `expires_at not null`;
   nếu default là một số khác 30 thì phép trừ ra số khác.
2. Đột biến M2 (`p_period_days: null` truyền tường minh) ⇒ ĐỎ với đúng thông điệp
   `null value in column "expires_at" of relation "subscriptions" violates not-null
   constraint`. Đó chính là hình dạng hỏng của giả thuyết "PostgREST truyền null", và
   nó KHÔNG xảy ra với mã đang ship.
3. Đột biến M1 (`p_period_days: 60`) ⇒ ĐỎ với `expected 5184000000 to be 2592000000`.
Ngoài ra một probe không ghi gì (rpc với `p_order_code` không tồn tại) trả về
`data: null, error: null` — tức PostgREST PHÂN GIẢI ĐƯỢC hàm khi chỉ nhận một tham số,
không trả `PGRST202`.

**Làn chạy SVC-1:** `npm run test:localdb` (`vitest.localdb.config.ts`), gọi bằng
`node node_modules/vitest/vitest.mjs run --config vitest.localdb.config.ts` từ `SOURCE/`.
Trước task này lệnh đó thoát 1 với "No test suite found in file"; nay **exit 0, 9 ca xanh
trên 1 file** (11 ca của vòng đầu, sau vòng sửa còn 9 — xem "Vòng sửa" cuối mục). Không thêm `--passWithNoTests`.

**Số dòng thật, trước và sau.** `payment_orders` 0 → 0; `subscriptions` 0 → 0; tài khoản
auth mang `sub-svc-` còn lại: 0 (tổng auth users 23, không đổi). Mọi lệnh xoá đều theo
phạm vi định danh riêng của fixture (block mã đơn `[8 000 000 000 000, …+1000)`, `user_id`
của chính hai tài khoản fixture, prefix email `sub-svc-svc1-`) — không lệnh nào dùng vị từ
rộng kiểu `status = 'paid'`.

**Chạy lặp.** Làn chạy 3 lượt liên tiếp: 11/11 xanh cả ba (teardown idempotent). Ca đồng
thời chạy riêng thêm 5 lượt: xanh cả 5.

**Bảng đột biến (mọi neo khớp ĐÚNG MỘT lần, mọi lần khôi phục đối chiếu byte-identical).**

| Đột biến | Cài đặt sai được mô phỏng | Kết quả |
|---|---|---|
| M1 `p_period_days: 60` | kỳ hạn không phải 30 ngày | ĐỎ 7 ca (`5184000000` vs `2592000000`) |
| M2 `p_period_days: null` | PostgREST truyền null thay vì để SQL áp default | ĐỎ 7 ca (23502 not-null trên `expires_at`) |
| M3a bỏ cổng `status !== 'pending'` phía TS | phòng phát lại chỉ nằm ở TypeScript | ĐỎ ĐÚNG hai khẳng định ĐẾM (1 và 3 thay vì 0); mọi khẳng định về DÒNG vẫn xanh ⇒ **vị từ SQL một mình giữ đúng các dòng** |
| M3b bỏ cổng TS + reset dòng về `pending` | không còn phòng phát lại ở đâu cả | ĐỎ (b), (c) — lượt phát lại trả `settled:true` |
| M4b `provider.status` không bao giờ bị từ chối | ghi trước khi nhà cung cấp xác nhận | ĐỎ (e) |
| M5 retry lời gọi nhà cung cấp | bão retry | ĐỎ (f) (đếm 2 thay vì 1) |
| M6 trả `not_pending` NHƯNG vẫn ghi | đúng hình dạng test rỗng mà task gọi tên | ĐỎ (b), (c) tại khẳng định DÒNG: `settled_at` đổi sang mốc mới |
| M7 bỏ lệnh xoá theo block trong teardown | teardown thiếu một phạm vi | **SỐNG SÓT Ở VÒNG ĐẦU, NAY BỊ DIỆT** — lý lẽ sống sót cũ ("mọi đơn còn `user_id` nên phạm vi `user_id` đã xoá hết") chỉ đúng khi KHÔNG ca nào dựng ra dòng `user_id` NULL. Ca (mồ côi) thêm ở vòng sửa dựng đúng dòng ấy, nên M7 nay ĐỎ. Xem "Vòng sửa" |

**Không mô phỏng được bằng đột biến, và vì sao.** Phiên này không có đường chạy DDL nào
lên dev (không `pg`, không `DATABASE_URL`, MCP Supabase trong `.mcp.json` trỏ PROD nên bị
loại), nên các mệnh đề nằm HẲN trong SQL — `greatest()` thay vì `now()`, việc gán đúng cột
`period_anchor_at`, `revoke` của AC-033, cửa sổ hai câu lệnh — không đột biến được.
Thay bằng phân biệt trong CHÍNH khẳng định:
- ca (d) khẳng định cả hai chiều: bằng `hạn cũ + 30 ngày`, và **khác** `settled_at + 30 ngày`
  (đáp án của cài đặt dùng `now()`), hai đáp án lệch nhau đúng 10 ngày;
- ca 2/3 và 3/3 khẳng định bằng `settled_at + 30 ngày` và **khác** `hạn cũ + 30 ngày`
  (đáp án của cài đặt gia hạn mù), lệch 1 ngày và 10 ngày;
- hai cột cùng kiểu được seed HAI giá trị khác nhau, nên gán nhầm cột lộ ra;
- ca (g) mang ĐỐI CHỨNG DƯƠNG trong chính nó: cùng lời gọi, cùng đơn, đi bằng
  `service_role` thì THÀNH CÔNG (quan sát: `42501` cho JWT người dùng, rồi dòng chuyển
  `paid` và `expires_at = settled_at + 30 ngày` cho service_role);
- ca đồng thời khẳng định `getPaymentStatusCallCount === 2`, mà adapter chỉ với tới được
  SAU bước 1, nên cả hai lượt đã qua bước 1 khi dòng còn `pending` — no-op không thể do
  cổng TypeScript sinh ra. M3a đã chứng minh các khẳng định ĐẾM này là sống.

**Binding Decisions — đánh giá lại trên cài đặt CUỐI CÙNG.**
- *data_flow* (ADR-0013) → **Y**. Ba ca chạy thật: còn hạn (d), trong ân hạn (2/3), quá ân
  hạn (3/3); mỗi ca một mốc kỳ vọng chính xác.
- *persistence* (ADR-0014) → **Y**. n = 4 lượt phát lại; `expires_at` và `settled_at` giữ
  NGUYÊN CHUỖI; tổng mức tiến `= 2 592 000 000 ms`; 0 lượt gọi nhà cung cấp mỗi lượt phát
  lại. Ca đồng thời: đúng 1 lượt thắng, adapter đếm 2.

**Reference Contracts — đánh giá lại trên cài đặt CUỐI CÙNG.**
- *derived-display* (DD § Schema) → **Y**. Ca (d): seed `expires_at = now+10d`,
  `period_anchor_at = now−20d`; sau settle `expires_at = seed + 2 592 000 000 ms` (tức
  +40 ngày kể từ hôm nay, khẳng định thêm bằng biên 39–41 ngày), `period_anchor_at =
  settled_at` và khác mốc đã seed. `period_anchor_at` bằng `settled_at` cũng chính là bằng
  chứng "CÙNG câu lệnh": hai cột ở hai bảng mang cùng một `now()` của một giao dịch.
  Độ chính xác của đẳng thức ấy là 1 ms (PostgREST trả micro giây, `Date.parse` cắt còn
  mili giây) — đủ để phân biệt `now()` với một mốc cũ, KHÔNG đủ để phân biệt `now()` với
  `clock_timestamp()`; nêu ra vì đó là giới hạn thật của khẳng định.

**Nghĩa vụ của skeleton — cái nào đã đáp, cái nào chưa.** (a)…(h) đã đáp đủ. Ngoài ra: ca
đồng thời (task đòi thêm) và hai ca ân hạn của ADR-0013. KHÔNG đáp: không ca nào chạm payOS
thật (đúng HARD SCOPE LIMIT — `createPaymentRequest` bị thay bằng một hàm NÉM để điều đó
thành tính chất cấu trúc); nhánh "đơn mồ côi" (`raise exception … check_violation` khi
`user_id` null) KHÔNG được kiểm — nó không nằm trong (a)…(h) và dựng nó đòi xoá tài khoản
giữa chừng, thứ sẽ đá vào chính cơ chế teardown của fixture. SVC-2 vẫn là skeleton.

**Cổng kiểm.** `npx tsc --noEmit` 0 · `npm run lint` sạch · `npm run check:bundle` 0 ·
`npm test` 1481 pass / 10 skip / 119 file · `npm run test:integration` 31 pass / 2 file ·
`npm run test:fixture` 77 pass / 1 file · `npm run build` 24/24 · `npm run test:localdb`
**9 pass / 1 file (trước: exit 1 "No test suite found in file")**.

### Vòng sửa (sau phản biện độc lập) — và kết quả THẨM ĐỊNH LẠI

Phản biện trả `needs_revision` với 4 phát hiện; vòng sửa đóng cả bốn. Số ca **11 → 9**
((a)(b)(c) gộp thành MỘT `it()`; thân ca (h) chuyển vào `afterAll`; thêm MỘT ca mồ côi).

**Bốn phát hiện, và cái gì đóng chúng.**
1. *Lời khai đầu file SAI.* Header cũ khai mỗi ca "passes when run in isolation" — đo lại
   thì xáo thứ tự làm ĐỎ 5/11 (seed 1), 4/11 (seed 42), 9/11 (seed 7). Hai nguyên nhân bị
   GỠ (ba biến `let` mức module; `tearDown()` gọi trong một `it()`), không phải ghi chú lại.
2. *M7 sống sót.* Nay bị diệt bằng ca (mồ côi) — dòng `user_id` NULL là hình dạng DUY NHẤT
   phạm vi block với tới được mà phạm vi `user_id` không.
3. *Khẳng định 23514 quá rộng.* `23514` cũng là mã của CHECK trên `payment_orders.status`,
   nên mã một mình không phân biệt "không người thụ hưởng" với "trạng thái không hợp lệ".
   Nay ghim thêm CÂU `settlement for order % has no beneficiary`, và khẳng định ROLLBACK.
4. *M7-prime chưa nói ra.* Nay nêu THÀNH LỜI trong CẢ HAI file (comment `afterAll` + header
   fixture) rằng phạm vi `user_id` là CHƯA CHỨNG MINH ĐƯỢC trong làn này.

**Thẩm định độc lập (agent QA, chạy lại từng đột biến, không tin self-report).**

| Kiểm | Cách đo | Kết quả |
|---|---|---|
| M7 (bỏ delete theo block) | neo `const blockDelete = await admin()` khớp ĐÚNG 1 lần | **ĐỎ** — ca (mồ côi) tại `readOrderRow(...)` toBeNull, nhận `user_id: null`; VÀ `afterAll` đỏ với `paymentOrders: 1` |
| M7-prime (bỏ delete theo `user_id`) | neo `const ownedDelete = ...` khớp ĐÚNG 1 lần | **SỐNG SÓT** (9/9 xanh, exit 0) — đúng như đã khai; lý lẽ đã kiểm: mọi seed đi qua `allocateOrderCode()`/`requireCodeInBlock()` nên luôn trong block, và KHÔNG ca nào gọi `createOrder()` |
| M4-i (bỏ cổng TS `status !== "pending"`) | | **ĐỎ tại khẳng định ĐẾM adapter** (dòng 636, `expected 1 to be +0`); các khẳng định DÒNG vẫn xanh ⇒ vị từ SQL một mình giữ đúng dòng |
| M4-ii (thêm ghi `settled_at` trên nhánh no-op) | | **ĐỎ tại so CHUỖI THÔ `settled_at`** (dòng 632) |
| M4-ii' (ghi lại CÙNG mốc, KHÁC định dạng) | `…922187+00:00` → `…922+00:00` | **ĐỎ tại dòng 632** — cùng thời điểm tới mili giây, nên so mốc đã parse sẽ XANH. Đây là bằng chứng dạng chuỗi thô có sức phân biệt thật |
| Xáo thứ tự | seed 1, 42, 7, 123, 2026 | **9/9 xanh cả năm**; đã kiểm cờ shuffle THỰC SỰ đổi thứ tự (seed 1 vs 7 khác nhau) |
| Chạy MỘT MÌNH | `-t` từng ca, 9/9 | **xanh cả 9**. Bẫy: `-t "a+b+c"` khớp 0 ca mà vẫn **exit 0** (`+` là lượng từ regex) — phải đọc dòng `Tests`, không đọc exit code |
| `afterAll` có răng | qua chính lượt chạy M7 | `expect` hỏng trong `afterAll` ĐƯỢC báo FAIL và làm exit 1 |
| Lời khai lịch sử của header | chạy lại cây TRƯỚC vòng sửa | tái lập ĐÚNG: 5/11 (seed 1), 4/11 (seed 42), 9/11 (seed 7) |

**Số dòng thật, đo bằng truy vấn RIÊNG (không dùng `countFixtureRows()`, vì nó hỏi lại đúng
những vị từ mà delete vừa chạy).** `payment_orders` 0, `subscriptions` 0, tài khoản
`sub-svc-` 0, tổng auth users 23 — trước, giữa và sau toàn bộ đợt đột biến. Lượt chạy M7 có
để lại 1 dòng mồ côi (`order_code` 8000000000008); đã xoá bằng vị từ giới hạn TRONG block
dành riêng. Mọi file bị đột biến đã khôi phục và đối chiếu `cmp` byte-identical.

**Cổng kiểm (thẩm định lại).** `npx tsc --noEmit` 0 · `npm run lint` sạch ·
`npm run check:bundle` 0 · `npm test` 1481 pass / 10 skip / 119 file (một flake đã biết,
`ExplainStepAffordance.test.tsx`, xanh khi chạy lại riêng) · `npm run test:integration`
31 pass / 2 file · `npm run build` 24/24 · `npm run test:localdb` **9 pass, exit 0**, xanh
hai lượt liên tiếp. Không có `--passWithNoTests` ở bất kỳ đâu trong repo (chỉ xuất hiện
trong văn xuôi tài liệu).
