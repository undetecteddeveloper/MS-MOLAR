# Task: service-integration-e2e SVC-2 — `recheckOrder()` is owner-scoped

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 6, plan Task 6.2**
Layer: **backend** (`SOURCE/tests/e2e/service/**` against real Postgres)

Metadata:
- Dependencies: backend-task-07 (two-session fixture), backend-task-18 (`recheckOrder`), backend-task-11 (gate B on dev)
- Provides: **the gate FE-B-02 escalation condition names — S-05 must not reach real users until this passes**
- Size: Small (1 test file)

## Implementation Content

**Two real sessions against one database** — a mocked Supabase client would assert the mock `null`, not the policy.

Include the **control** case (user A settles their own order) **in the same run**, so a globally-broken action that refuses everything cannot pass by refusing correctly for the wrong reason.

Then:
- user B with A `orderCode` ⇒ `unknown_order`;
- user B with a code nobody owns ⇒ `unknown_order`;
- **deep equality** between those two results — one assertion over the whole value, no field excluded (asserting each equals `unknown_order` independently is weaker, since it passes if one branch carries an extra field);
- **exactly 0** payOS adapter invocations asserted **separately for each branch**;
- **zero writes** — A `payment_orders` row **byte-identical** before and after, no new `subscriptions` row for either user;
- **no log line** during either refusal containing the owner, an amount, an account number or a memo.

## Target Files
- [x] `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-2 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts` (**SVC-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/service/subscriptionServiceFixtures.ts` (plan Task 0.8 — the two-session fixture and the counted adapter stub)
- `SOURCE/lib/billing/orderActions.ts` (plan Task 3.4 — `recheckOrder()` ownership branch, `.maybeSingle()`)
- `SOURCE/supabase/schema.sql` (`orders_select_own`)
- `SOURCE/lib/supabase/server.ts` (the request-scoped client under which the policy applies)
- `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping)
- `docs/design/subscription-backend-design.md` (§ Third verification point)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ `recheckOrder()` — ownership scoping) | state-lifecycle-negative | `recheckOrder(orderCode)` resolves `{ settled: false, reason: "unknown_order" }` for an `orderCode` that does not exist **and** for one that exists but whose `user_id` is not the caller. The two are **byte-identical**: the same value, from the same branch, with the same side effects (none), the same number of provider calls (zero) and the same number of writes (zero) | One deep-equality assertion over the two whole results passes, with adapter count 0 and write count 0 asserted separately per branch |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record SVC-2 annotation block verbatim
- [x] Write the control case **first**, then the two refusal branches and the deep equality; confirm each fails against a deliberately un-scoped read
### 2. Green Phase
- [x] Execute under `npm run test:localdb` against dev; all cases green
### 3. Refactor Phase
- [x] Re-run twice in a row to confirm teardown idempotency

## Quality Assurance Mechanisms
- Real-Postgres integration tests — Enforces: RLS visibility under two distinct sessions — Config: `SOURCE/vitest.localdb.config.ts`
- `SOURCE/supabase/test-rls.ts` — Enforces: the cross-user read denial these results depend on

## Operation Verification Methods
- **Verification method**: two real authenticated sessions against one database, with only the payOS adapter stubbed and counted.
- **Success criteria**: the control case settles; both refusals are deeply equal; adapter invocations **0** on each branch; A row byte-identical before and after; no new `subscriptions` row; no owner/amount/account/memo in any log line.
- **Failure response**: **S-05 must not reach real users until this passes** (FE-B-02 escalation condition). If it fails, hold the deploy rather than shipping the screen.
- **Verification level**: L1.

## Proof Obligations
- **Claim**: a foreign order and a nonexistent order are indistinguishable in value, in cost and in side effects.
- **Primary failure mode**: an enumeration oracle — a caller can confirm that another user order exists, by value, by an extra field, by a provider-call latency difference, or by a log line.
- **Boundary to exercise**: the real dev Postgres under `orders_select_own`, through **two distinct authenticated sessions**.
- **State assertion**: A `payment_orders` row read before and after each refusal and compared **byte-identical**; `subscriptions` row count unchanged for both users.
- **Mock boundary rationale**: only the payOS adapter is stubbed and counted; the Supabase client and RLS are real, because the policy is the mechanism under test.
- **Residual**: none for ownership scoping; the rendered refusal copy is proven by plan Task 3.7 / FE-3.

## Completion Criteria
- [x] All SVC-2 cases green, including the control case in the same run
- [x] One deep-equality assertion over the two whole refusal values
- [x] Adapter invocation count 0 asserted **separately per branch**; zero writes proven by byte-identical before/after row
- [x] No log line contains the owner, an amount, an account number or a memo
- [x] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Test-case resolution: **service-integration-e2e 2/2 — lane complete**
- [x] **Gate recorded**: S-05 is not reachable by real users until this task is green

## Notes
- Impact scope: test only.
- Scope boundary: no mocked Supabase client; two real sessions are required.

## Investigation Notes
**Chạy trên dev THẬT `hynwleaxtbtjzkvpjsug`** (`SOURCE/.env.local`), sau khi cổng B
(`npx tsx supabase/verify-schema.ts`) xanh trên chính database đó cùng phiên
(`✅ Schema verify … vân tay 021dd1387945`). Prod `pebjdlbgbmizgfpuptjl` KHÔNG bị
chạm tới ở bất kỳ bước nào.

### Hai danh tính phiên

| Vai | Email | Cách lấy phiên | Ai quyết định tầm nhìn |
|---|---|---|---|
| A (chủ đơn) | `smithnguyen247+sub-svc-svc2-a@gmail.com` | `signInWithPassword` → client `@supabase/supabase-js` THẬT mang JWT `authenticated` | `orders_select_own` |
| B (kẻ dò) | `smithnguyen247+sub-svc-svc2-b@gmail.com` | như trên, JWT khác | `orders_select_own` |

`vi.mock("@/lib/supabase/server")` trả về ĐÚNG một trong hai client ấy, nên
`recheckOrder()` đọc dòng đơn bằng một danh tính RLS thật — không có client giả
nào trên đường đọc. Chỉ adapter payOS bị thay (và bị ĐẾM).

Một lượt chạy mẫu (green-1): `user_id` của A `b8adfa46-c89b-4760-bfb5-e96fbb80e14f`,
đơn `8000000001000`, mã không ai sở hữu `8000000001001`. Hai `user_id` được khẳng
định KHÁC nhau ngay trong ca, nên một fixture lỡ đăng nhập hai vai vào cùng một tài
khoản không thể làm ca này xanh giả.

### CHÍNH SÁCH trả về gì — quan sát trực tiếp, không qua TypeScript nào

Câu hỏi của task là về policy, không phải về phép kiểm chủ sở hữu trong TypeScript
(và `recheckOrder()` KHÔNG có phép kiểm ấy: nó đọc bằng client theo phiên rồi tin
vào RLS). Nên ca (b+c) hỏi thẳng bảng:

| Truy vấn (cùng một câu, khác danh tính) | `error` | Số dòng |
|---|---|---|
| B đọc đơn của A | `null` | **0** |
| A đọc đơn của A (đối chứng dương 1) | `null` | **1** |
| B đọc mã không ai sở hữu | `null` | **0** |
| service_role đọc đơn của A (đối chứng dương 2, `rowBefore`) | `null` | **1** |

Hình dạng của một lượt từ chối bởi RLS là **0 DÒNG, KHÔNG PHẢI LỖI** —
`expect(error).not.toBeNull()` ở đây là khẳng định sai hình dạng, không bao giờ đỏ
được, và "hàm không tồn tại" hay một sự cố mạng cũng thoả nó. Khẳng định đã dùng là
`error === null` **và** tập dòng rỗng, kèm hai đối chứng dương trong CÙNG ca.

### Kết quả bằng nhau sâu, và cái giá của hai nhánh

- `foreign.value` và `nonexistent.value` cùng là `{ settled: false, reason: "unknown_order" }`.
- `toStrictEqual` giữa hai giá trị (một khẳng định trên CẢ giá trị, không loại trừ
  trường nào), CỘNG một literal viết tay cho từng giá trị — vì riêng phép bằng nhau
  sâu thì hai nhánh cùng hỏng một kiểu (`rate_limited`, `unauthenticated`) vẫn thoả.
- `getPaymentStatusCallCount === 0` và `getPaymentStatusOrderCodes === []`, khẳng
  định RIÊNG cho từng nhánh (có `reset()` giữa hai nhánh).

### So byte dòng của A

`readOrderRow()` dùng `select("*")`, và cả dòng được `JSON.stringify` trước/sau MỖI
nhánh. Chuỗi trước và sau bằng nhau tuyệt đối, ví dụ (green-1):

`{"order_code":8000000001000,"user_id":"…","amount":39000,"status":"pending","created_at":"…","pending_until":"…","settled_at":null,"qr_payload":"…","account_number":"0011001234567","account_name":"CONG TY TNHH MS MOLAR","memo":"sub-svc-svc2 8000000001000"}`

`subscriptions` giữ **0 dòng cho CẢ HAI** vai trước và sau mỗi nhánh; mã không ai sở
hữu vẫn KHÔNG có dòng nào sau khi bị hỏi tới.

### Nhật ký (AC-034)

Sáu phương thức console bị thu trong đúng cửa sổ mỗi lời gọi. Bốn bí mật: `user_id`
của A, số tiền (`39000`), số tài khoản (`0011001234567`), nội dung chuyển khoản
(`sub-svc-svc2 …`). Cả hai nhánh: **0 nhãn rò**. Máy dò tự kiểm bằng một con chim
hoàng yến đi qua ĐÚNG cỗ máy ấy và phải bắt đủ CẢ BỐN — nên `[]` không thể là `[]`
vì spy chưa gắn hay vì danh sách bí mật rỗng.

### Reference Contracts — đánh giá (cách làm quyết trước pha Red, ghi lại tại đây)

- **Cách làm đã hoạch định**: dựng đơn `pending` của A trong khối mã dành riêng
  của làn, cấp một mã trong khối nhưng KHÔNG seed để làm "không ai sở hữu", gọi
  `recheckOrder()` bằng phiên của B cho cả hai đầu vào trong CÙNG một `it()`, so
  `toStrictEqual` giữa hai giá trị và với literal viết tay, đếm adapter RIÊNG từng
  nhánh sau `reset()`, chụp cả dòng của A bằng `select("*")` + `JSON.stringify`
  trước/sau từng nhánh, và đếm `subscriptions` cho cả hai vai.
- **Compliance Check** ("One deep-equality assertion over the two whole results
  passes, with adapter count 0 and write count 0 asserted separately per branch"):
  **Y**. Bằng chứng: `expect(foreign.value).toStrictEqual(nonexistent.value)` xanh;
  `getPaymentStatusCallCount === 0` khẳng định hai lần, mỗi nhánh một lần; so byte
  dòng và đếm `subscriptions` cũng khẳng định riêng cho từng nhánh. `npm run
  test:localdb` → **11 pass**, exit 0, hai lượt liên tiếp.

### Đột biến — mỗi khẳng định đã được QUAN SÁT đỏ

Mã đang bị kiểm đã ship trước task này, nên RED chỉ có thể tới từ đột biến, và nó
đã tới: lượt chạy ĐẦU TIÊN của ca mới là một lượt ĐỎ dưới M1 (lượt đọc mất phạm vi
chủ sở hữu), trước bất kỳ lượt xanh nào.

| # | Đột biến | Neo khớp | Khẳng định đỏ | Chứng cứ |
|---|---|---|---|---|
| M1 | `orderActions.ts`: gỡ nhánh `if (!data) return unknown_order`, để `settleOrder()` (đọc bằng `service_role`) trả lời thay — đúng kịch bản refactor mà Risks row của backend DD nêu tên | 1/1 | `getPaymentStatusCallCount` | `expected 1 to be +0` |
| M1b | M1 + tắt hai khẳng định bộ đếm của nhánh (b) để lộ khẳng định kế tiếp | 1/1 | so byte dòng của A | `status` `pending`→`paid`, `settled_at` `null`→`2026-08-20T12:18:18.826472+00:00` — tức B đã SETTLE đơn của A |
| M1c | M1 + tắt cả khối khẳng định của (b) và (c) | 2/2 (mỗi neo 1) | `toStrictEqual` giữa hai giá trị | `{settled:true, expiresAt:"2026-09-19T…"}` vs `{settled:false, reason:"unknown_order"}` — máy dò lộ nguyên hình |
| M3 | `orderActions.ts`: thêm một dòng `console.warn` chẩn đoán mang số tiền / số tài khoản / memo vào đúng nhánh từ chối | 1/1 | `leakedLabels(foreign.output, …)` | `[ "số tiền", "số tài khoản", "nội dung chuyển khoản" ]` ≠ `[]` |
| M4 | test: `captureConsole` không đẩy dòng nào vào `lines` (máy thu hỏng) | 1/1 | phép TỰ KIỂM của con chim hoàng yến | `[]` ≠ bốn nhãn — nên hai khẳng định `[]` không thể xanh rỗng |
| M6 | `orderActions.ts`: `.eq("order_code", orderCode)` → `.eq("order_code", -1)` (từ chối TẤT CẢ) | 1/1 | ca (a) ĐỐI CHỨNG DƯƠNG | `kỳ vọng settled:true, nhận được {"settled":false,"reason":"unknown_order"}` — và ca (b+c) VẪN XANH trong cùng lượt. Đây chính là lý do đối chứng dương bắt buộc phải có |
| M2 | test: probe của B đổi sang `admin()` | 1/1 | `foreignRead.data` rỗng | trả về NGUYÊN dòng — nên "0 dòng" là do DANH TÍNH, không do câu truy vấn hay do dòng không tồn tại |
| M2b | test: `ownerRead` đổi sang phiên của B | 1/1 | `ownerRead.data` có 1 dòng | `expected [] to have a length of 1` — đối chứng dương tự nó cũng đỏ được |

Không đột biến nào tương đương ngữ nghĩa với bản gốc (mỗi cái đổi hành vi quan sát
được), và mọi neo đều được đếm là khớp ĐÚNG MỘT lần trước khi thay. Hai file bị đột
biến (`lib/billing/orderActions.ts`, file test) được khôi phục bằng **bản sao byte**
và đối chiếu sha256 — `orderActions.ts` trở lại đúng
`23c28c28…67fd02e`, tức KHÔNG có thay đổi nào của task này nằm trong mã sản phẩm.

### Độc lập thứ tự — ĐÃ ĐO

- `--sequence.shuffle.tests` với năm seed (1, 42, 7, 123, 2026): **11 pass** cả năm.
- Hai lượt `test:localdb` liên tiếp: **11 pass**, exit 0 cả hai (tính idempotent của
  teardown).
- Chạy MỘT MÌNH: `-t "ĐỐI CHỨNG DƯƠNG"` → 1 passed | 10 skipped; `-t "BẰNG NHAU
  SÂU"` → 1 passed | 10 skipped; cả describe SVC-2 → 2 passed | 9 skipped; cả
  describe SVC-1 → 9 passed | 2 skipped. Đọc DÒNG `Tests`, không đọc exit code: một
  mẫu `-t` khớp 0 ca vẫn exit 0.
- KHÔNG thêm trạng thái mức module nào. Ngược lại, một phụ thuộc thứ tự tiềm tàng
  đã bị GỠ: `adapterHolder.current` không còn được gán một lần ở mức module (khi ấy
  describe chạy sau sẽ đọc bộ đếm của fixture describe kia, và phép đếm 0 của SVC-2
  sẽ đúng vì nhìn nhầm chỗ); mỗi describe nay tự NHẬN holder trong `beforeAll` của
  chính nó. Hai fixture khác `caseTag` và khác khối mã, nên teardown của làn này
  không với tới dòng nào của làn kia.

### Vệ sinh CSDL

Đếm bằng truy vấn RIÊNG (`select count(*)` toàn bảng, KHÔNG dùng
`countFixtureRows()` — phép đếm ấy hỏi lại chính những vị từ mà teardown vừa chạy
nên vòng tròn ở đúng chỗ này):

| | `payment_orders` | `subscriptions` | tài khoản mang `sub-svc-` |
|---|---|---|---|
| trước | 0 | 0 | 0 |
| sau (sau 9 lượt chạy làn) | 0 | 0 | 0 |

### Cổng đã ghi

Task 6.2 XANH ⇒ điều kiện leo thang FE-B-02 đã được thoả: S-05 nay không còn bị
chặn bởi cổng này. Nghĩa vụ mở OP-5 ("chưa từng có một chứng minh RLS THẬT cho phép
kiểm chủ sở hữu của `recheckOrder`") được đóng bằng chính bảng quan sát ở trên, chứ
không phải bằng một ca chỉ chứng minh TypeScript.

