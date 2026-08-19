# Subscription — bàn giao pha THỰC THI (phiên 5)

**Viết 2026-08-19.** Phiên 1–2 đóng pha thiết kế; phiên 2 chạy bước 15→16→phân rã và 8 task đầu;
phiên 3 đóng Pha 1 và cổng chặn thủ công; phiên 4 chạy trọn Pha 2 và mở Pha 3. Phiên này chạy nốt
**backend của Pha 3: xong 24/50 task, Pha 0–2 đóng, Pha 3 còn đúng 4 task frontend.**

Đọc file này trước, đọc hết, rồi mới mở task file. Nó tồn tại để phiên sau không phải suy lại một
ngày ngữ cảnh. Nó được **viết lại tại chỗ mỗi phiên**, không bồi thêm — một bàn giao cứ dài ra thì
không ai đọc nữa, và đó đúng là thứ file này sinh ra để chặn.

---

## 1. Luồng đang ở đâu

`recipe-fullstack-implement`, luồng fullstack quy mô Large (`monorepo-flow.md`).

| Bước | Trạng thái |
|---|---|
| 1–14 | xong; kỹ sư duyệt cổng thiết kế 2026-08-18 |
| 15 acceptance-test-generator | xong — 3 làn đều sinh khung |
| 16 work-planner | xong — `docs/plans/subscription-work-plan.md` **v1.3** |
| **Batch approval** | **ĐÃ CẤP** 2026-08-18 ("full autonomous run") — vẫn còn hiệu lực |
| task-decomposer | xong — 50 task file + 7 phase-completion + 1 overview |
| Vòng build | **24/50 xong. Pha 0 ✅ Pha 1 ✅ Pha 2 ✅ — Pha 3: 5/9, backend ĐÓNG** |

**Hành động kế tiếp: mở `docs/plans/tasks/subscription-work-plan-frontend-task-06.md`** (plan Task 3.6),
chạy qua giao thức vòng build ở §4. Chú ý **đổi làn**: bốn task còn lại của Pha 3 đều là frontend, nên
executor là `task-executor-frontend` và quality fixer là `quality-fixer-frontend` — định tuyến theo tên
file, đừng suy đoán.

Điểm ★ xác minh sớm thứ hai là **plan Task 3.8 (`frontend-task-08`)**. Điểm ★ thứ nhất (2.2/2.5) đã qua ở
phiên 4.

## 2. Nhánh và commit

Nhánh **`feat/subscription`**. Cây làm việc **sạch**. Tổng: **5 commit dọn nền + 24 commit task
(1 task = 1 commit) + 1 commit dọn dẹp tài liệu**.

Phiên 5 (4 commit, 4 task, không có commit chore):

| Commit | Task | Nội dung |
|---|---|---|
| `18872cd` | 3.2 | `settleOrder` — đường ghi DUY NHẤT gia hạn quyền lợi; 5 lý do từ chối, 4 bước cố định |
| `1fbe5c9` | 3.3 | `toCheckoutOrder` — một hình dạng dòng, đúng một dạng tuần tự hoá |
| `0ebf47d` | 3.4 | `createOrder` + `recheckOrder` + 2 lối rate limit + **INT-3**; làn integration bắt đầu chạy thật |
| `5cdbc23` | 3.5 | `getMyOrder` qua `toCheckoutOrder` — **đóng CL-01** — kèm **INT-2** |

## 3. ✅ CỔNG CHẶN TASK 1.3 ĐÃ QUA — quy trình phải lặp y hệt cho Task 5.8

**Kỹ sư đã chỉ định làm bằng Composio**, và nó chạy được. **Task 5.8 (`backend-task-28`, apply prod) dùng
lại nguyên quy trình này** — đừng phát minh lại.

- **Dev = `hynwleaxtbtjzkvpjsug`**. **Prod = `pebjdlbgbmizgfpuptjl`** (tên "MS-MOLAR-prod").
  `.mcp.json` trỏ PROD — đọc nhầm ref là kết luận nhầm môi trường. **`SOURCE/.env.local.prod-backup` giữ
  credential PROD, nằm ngay cạnh `.env.local`** — đừng bao giờ nạp nó hay trỏ một làn test vào nó.
- Công cụ: `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, tool slug **`SUPABASE_BETA_RUN_SQL_QUERY`**
  (chạy được DDL, đặt `read_only: false`). Toolkit `supabase` đã ACTIVE.
- Trình tự đã dùng: liệt kê project để xác nhận đích → chụp trạng thái TRƯỚC → apply theo thứ tự phụ thuộc,
  **từng khối một** (API timeout khoảng 60s) → **kiểm catalog TRƯỚC khi ghi vân tay** → ghi vân tay **CUỐI CÙNG**.
  Vân tay đi cuối là cố ý: paste đứt giữa chừng thì DB thà không biết mình là bản nào, còn hơn khai nhận một
  bản nó chưa chạy hết.
- Kết quả trên dev: đủ 4 đối tượng; `npm run verify:schema` **8/8 xanh**; khoá ngoại **25 → 27**; vân tay
  `021dd1387945` apply lúc `2026-08-18T13:53:05.77815+00:00`.
- **Prod vẫn KHÔNG có bảng nào.** Đó là Task 5.8, chỉ chạy khi Pha 5 tới lượt.

## 4. Giao thức vòng build (bắt buộc, đừng rút gọn)

Mỗi task: **task-executor → [integration-test-reviewer nếu `requiresTestReview: true`] → quality-fixer →
orchestrator commit.**

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Viết câu đó vào mọi prompt.

### 4a. Lớp lỗi tái phát — nay là 15 ca

**Tạo tác khẳng định một năng lực phân biệt mà nó không có.** Đếm chạy: 5 (phiên 2) + 3 (phiên 3) +
4 (phiên 4) + **3 (phiên này)** = **15**.

Ba ca phiên này, **cả ba do integration-test-reviewer tìm ra, không phải do executor tự khai** — và cả ba
lần executor đều đã tự chạy đột biến rồi báo "không con nào sống sót":

1. **Task 3.2** — đường lan lỗi khi lượt đọc đơn ở bước 1 hỏng **không có ca nào phủ**; đổi
   `if (error) throw error` thành `return null` vẫn để cả 27 ca xanh. Khuyết tật đó báo cho một người
   ĐÃ TRẢ TIỀN rằng "không tìm thấy đơn" khi thật ra database vừa timeout. Cùng task, một ca khác đọc kỳ
   vọng ngược ra từ chính fixture nó dựng, nên một bản cài đặt trả nguyên cả dòng vẫn xanh.
2. **Task 3.4 — ở tầng LÀN, không phải tầng khẳng định.** Cổng canh credential của làn integration cho
   **exit 0 y hệt nhau** dù 8 ca chạy thật hay 8 ca lặng lẽ bỏ qua: vitest **nuốt `console.warn` ở phạm vi
   module** khi file chỉ có một suite bị skip. Nghĩa là chính cái "chuyển từ exit 1 sang exit 0" mà task này
   lấy làm sản phẩm bàn giao lại được sinh ra hệt nhau bởi một `.env.local` bị đổi tên. Vá lần một bằng một
   ca kiểm **có tên** — vòng rà chỉ ra ca có tên vẫn bị `-t` loại, lại về exit 0. Vá lần hai, và là bản đang
   dùng: **throw ở phạm vi module, lúc thu thập**.
3. **Task 3.5** — `MyOrderRow.pendingUntil` **không được khẳng định ở bất kỳ đâu**, vì mọi dòng gieo đặt
   `pending_until = created_at`. Hoán vị hai trường đó, hoặc ghim cứng `pendingUntil`, đều sống sót qua cả
   16 ca. Đúng lớp "hai giá trị lấy từ cùng một nguồn thì phép hoán vị dịch cả hai vế".

**Bài học rút ra, viết vào prompt: một bảng đột biến báo "không con nào sống sót" chỉ đáng tin khi tập đột
biến đã đủ.** Executor không tự nghĩ ra được con đột biến nhắm vào chỗ chính nó bỏ quên. Đó là lý do
integration-test-reviewer vẫn phải chạy, và phiên này nó **có phát hiện thật ở 3 trên 4 task**.

### 4b. Cách viết prompt có hiệu quả

Yêu cầu executor: (a) quan sát **ĐỎ thật** trước khi xanh, (b) nêu rõ mỗi ca kiểm bác bỏ những **bản cài đặt
sai NÀO**, (c) chạy **đột biến** trên bản sao trong bộ nhớ rồi khôi phục, (d) **một giá trị kỳ vọng DẪN TỪ
CHÍNH THỨ ĐANG KIỂM thì không chứng minh gì** — kể cả dẫn từ đầu vào mà chính bài kiểm dựng ra.

**Bổ sung phiên này:** khi ca kiểm chạm hai trường cùng kiểu (hai mốc thời gian, hai chuỗi), **bắt buộc gieo
hai giá trị KHÁC NHAU**. Bằng nhau thì phép hoán vị vô hình. Đây là cách Task 3.5 bị lọt.

### 4c. Tiền lệ orchestrator

- **Vòng rà trả `needs_revision` thì quay lại executor bằng một lần gọi Agent MỚI**, không SendMessage —
  guide nói rõ mỗi lần gọi là một ngữ cảnh cô lập.
- Sau khi executor vá, **chạy lại vòng rà** nếu thay đổi có tính cấu trúc (Task 3.4: đổi cả cơ chế cổng canh
  → chạy lại, và **vòng hai tìm ra lỗ `-t`**). Nếu vòng rà nêu đích danh N con đột biến và executor đã giết
  đủ N kèm đầu ra thật, **bỏ qua vòng rà thứ ba** (Task 3.2, 3.5 làm thế, không mất gì).
- **Prettier KHÔNG phải cổng** trong repo này (không script nào gọi). `npm run lint` là
  `eslint --max-warnings 0`. Đừng bắt agent reformat để chiều prettier — và ca (h) của INT-2 khẳng định trên
  **văn bản nguồn** của `queries.ts`, nên reformat file đó sẽ làm nó đỏ.

## 5. Làn test và nền xanh (số phải tái lập được TRƯỚC khi tin thay đổi của chính mình)

### 5a. Làn integration nay CHẠY THẬT

`npm run test:integration` đi từ exit 1 ("No test suite found in file") sang **16 ca xanh, exit 0** trên dev.
INT-3 vào ở `0ebf47d`, INT-2 vào ở `5cdbc23`. **INT-1 vẫn chỉ có comment** — thuộc task sau.

**Cổng canh của làn này là một `throw` ở phạm vi module, lúc thu thập.** KHÔNG phải `describe.skipIf`, KHÔNG
phải `HAS_LIVE_DB`, KHÔNG phải một ca kiểm đã đăng ký. Hình dạng đó là kết quả của hai vòng rà (xem §4a mục 2)
— **đừng khôi phục lại bất kỳ hình dạng nào trong ba cái kia.** Đo cả hai chiều: thiếu credential kèm bộ lọc
`-t` → exit 1 và gọi tên biến thiếu; đủ credential kèm cùng bộ lọc → vẫn xanh.

### 5b. Nền xanh hiện tại

| Lệnh (chạy trong `SOURCE/`) | Kết quả phải tái lập |
|---|---|
| `npm test` | **1164 pass / 10 skip** (101 file pass, 1 skip) |
| `npm run test:fixture` | **23 pass, exit 0** |
| `npm run test:integration` | **16 pass, exit 0** — chạm dev thật |
| `npx tsc --noEmit` | **0** |
| `npm run lint` | sạch |
| `npm run check:bundle` | exit 0 |
| `npm run test:localdb` | **vẫn exit 1**, "No test suite found in file" |
| `next build` | xanh **chỉ khi tắt sandbox** (xem §6) |

- `test:localdb` exit 1 là **CỐ Ý** (khung Pha 6 chỉ có comment). **Đừng bao giờ thêm `--passWithNoTests`.**
- **Flake đã biết, đừng đuổi:** `components/tutor/ExplainStepAffordance.test.tsx` timeout 5000ms khi chạy song
  song lúc cache lạnh; chạy riêng **5/5 trong khoảng 3 giây**. Phiên này nổ đúng một lần.
- Sau mỗi lần chạy làn integration, **`payment_orders` trên dev phải về 0 dòng**. Phiên này kiểm sau mọi lượt.

### 5c. Bẫy môi trường: múi giờ

Máy dev chạy **`TZ=Asia/Saigon`** — đúng múi giờ mà `lib/format/datetime.ts` ghim (`Asia/Ho_Chi_Minh`). Một
formatter **không ghim** vẫn render y hệt **ở đây** và xanh vô cớ, trong khi Vercel chạy UTC. Khi viết ca kiểm
chạm ngày/giờ: chọn instant **khác NGÀY LỊCH** giữa UTC và ICT (ví dụ `2026-08-18T17:30:00.000Z`), đừng chọn
instant chỉ khác giờ. Task 3.3 làm đúng thế.

## 6. Sự thật môi trường (tốn thời gian để phát hiện lại)

- **`TaskCreate` / `TaskUpdate` KHÔNG tồn tại.** Mọi agent sẽ báo thiếu. Bảo agent bỏ lệnh gọi đó nhưng vẫn làm
  phần việc bên dưới; không phải blocker. **Hệ quả cho orchestrator: bước "đăng ký toàn bộ flow bằng TaskCreate"
  mà recipe bắt buộc là KHÔNG làm được** — theo dõi vị trí bằng `_overview-subscription-work-plan.md` + file này,
  và **nói thẳng với người dùng** thay vì lặng lẽ bỏ.
- **`next build` TREO vô hạn dưới sandbox mặc định** (turbopack node transform pool: khoảng 2.2 CPU-giây trong
  20 phút, không ghi gì, không báo lỗi). **TREO chứ không FAIL.** Chạy với `dangerouslyDisableSandbox: true`.
  `vitest` / `tsc` / `eslint` chạy bình thường trong sandbox.
- **Bẫy cwd của runner — mới, tốn 2 lần đỏ oan:** spawn với `cwd: "e:/…"` (chữ ổ đĩa THƯỜNG) làm Vite phân giải
  module id khác với npm, và `vi.mock("server-only")` **trượt trong im lặng**; file rồi fail lúc collect vì lý do
  chẳng liên quan gì tới code. **Luôn dùng `E:\…` đúng như npm.**
- **`2>&1` trong `execSync` làm HỎNG exit code trên nền này** — báo thành công khi thất bại và ngược lại. Đọc
  trạng thái thật bằng `spawnSync` trên `node_modules/vitest/vitest.mjs`. Đã sinh ra một kết quả "all killed" giả.
- **Bash tool bọc lệnh trong nháy đơn**, nên **nội dung có dấu nháy đơn phá cú pháp shell**. Viết file dài bằng
  Write tool, đừng heredoc. Commit message tránh dấu nháy đơn.
- **App root là `SOURCE/`**, không phải gốc repo. `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- `test-rls.ts` chạy độc lập bằng `npx tsx supabase/test-rls.ts` (93 phép kiểm), **không** qua vitest.
- **`npm run verify:schema` = `npx tsx supabase/verify-schema.ts`**, độc lập, chạm DB thật — **không** nằm trong
  `check:bundle`. Script ở `SOURCE/package.json:15` (task file ghi `:13`, sai).
- **Vitest không có `setupFiles` ở BẤT KỲ làn nào:** không có matcher `jest-dom`; jsdom khai theo từng file bằng
  chỉ thị `@vitest-environment jsdom` ở **dòng 1**; `render()` **không** tự cleanup.
- Import thừa là **lỗi chí mạng** dưới `eslint --max-warnings 0`.
- **Ghi tiến độ: Notion qua Composio, database `3b378ba6-ae12-803c-8500-c572b6fc745f`.** `PROCESS.md` đã bị xoá
  khỏi repo. **Lưu ý: phiên 4 không có dòng nào trong database đó** — đã ghi chú trong dòng của phiên 5.

## 7. Phiên bản tài liệu hiện tại

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.6** — thẩm quyền về UI, có mệnh đề Phase Inversion |
| `docs/design/subscription-backend-design.md` | **v1.9** (mục `:1199` sửa câu chữ ở `18872cd`, không lên phiên bản) |
| `docs/design/subscription-frontend-design.md` | **v1.6** |
| `docs/plans/subscription-work-plan.md` | **v1.3** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — sửa nó phải sửa UI Spec trước, kèm lý do.

Frontend DD cố ý vẫn trỏ **UI Spec v1.2** ở mục "Referenced UI Spec" — đó là bản mà thiết kế đã tiêu thụ, kèm
bảng liệt kê delta v1.3→v1.6 và quy tắc bác bỏ. **Đừng "sửa" nó.**

## 8. Việc mở thuộc về kỹ sư

### 8a. BU-1…BU-6 (không đổi)

| # | Mục | Chặn gì |
|---|---|---|
| **BU-1** | **TBD-02 nội dung pháp lý** | **bật bán + test webhook tiền thật.** `docs/legal/refund-policy.md` còn 3 chỗ chưa điền; **chưa có bản Terms nào** dù R11 đòi 2 trang |
| **BU-2** | ADR-0018 thư viện QR | không chặn gì |
| **BU-3** | E-01 phạm vi AC-034 | không chặn gì |
| **BU-4** | U2 đơn giá thật | **bật bán** — chặn qua BU-6 |
| **BU-5** | Metric #9 baseline | **bật bán** — truy vấn `telemetry_log` 14 ngày, phải chạy TRƯỚC khi bật bán (AC-055) |
| **BU-6** | **Đích ghi bền cho AI usage chưa được thiết kế** | **Task 1.6** (không sinh file thực thi), rồi BU-4 |

Chuỗi: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Không gì trong Pha 2–5 phụ thuộc nó. BU-6 đã ghi thành **E-03**
trong backend DD (Task 0.9), đòi một bản sửa DD thiết kế đủ 6 phần. **Cấm mọi task tự chọn sink.**

### 8b. Việc mở mang mã OP-* (chỉ dùng trong file này)

| # | Mục | Cần input gì để gỡ | Ai sở hữu |
|---|---|---|---|
| **OP-1** | `FIXTURE_ENTITLEMENT_KNOWN` / `_EXHAUSTED` mô tả hình dạng người dùng backend KHÔNG tạo ra được (`plan: "free"` nhưng `FIXTURE_TUTOR_LIMIT = 500`; `FIXTURE_UPLOAD_LIMIT = 5` không khớp plan nào) | Sửa số fixture cho khớp một plan **và** sửa kèm mọi khẳng định FE-2 ghim theo số đó, hay giữ nguyên và ghi lý do | Chủ sở hữu module fixture. **Vô hại** hiện tại và **cố ý KHÔNG sửa** — FE-2 ghim theo chính con số này. Đã ghi comment tại chỗ khai báo |
| **OP-2** | `ADR-0015` mang cùng lớp mục nát trích dẫn `schema.sql`: `:1574`, `:1385`, `:1429`, `:1513`, `:1009-1015` | Một đợt vệ sinh tài liệu **đọc lại từng neo trong file rồi mới vá** — vá số dòng mà không đọc lại chính là đẻ lại khuyết tật | Đợt vệ sinh tài liệu kế tiếp |
| **OP-3** | Câu hỏi bảo mật cố ý để ngỏ ở Task 3.1: adapter chỉ ánh xạ ba literal trạng thái repo ghi nhận; giá trị khác về `"unknown"` (fail-closed, cứu được bằng `recheckOrder`) | **Một lần giao THẬT ở plan Task 6.7.** Nếu nhà cung cấp dùng literal khác cho trạng thái đã trả tiền, **`toPaymentStatus()` là đúng một dòng cần sửa** | Task 6.7 |
| **OP-4** | Backend DD tự mâu thuẫn về đầu vào HMAC: Consumer Parse Rule nói "raw body bytes", Serialized Format lại quy định canonicalisation `key=value&…`. Digest trên body bytes sẽ **từ chối mọi lần giao thật** | Sửa câu chữ DD cho khớp bản cài đặt (adapter nhận `rawBody: string`, parse ĐÚNG một lần, không tuần tự hoá lại) | Đợt vệ sinh tài liệu kế tiếp — **khuyết tật câu chữ**, không phải code |
| **OP-5** | **MỚI.** Chứng minh RLS thật cho phép kiểm chủ sở hữu của `recheckOrder` **chưa có**: ca unit giả lập `@/lib/supabase/server`, nên tiền đề "`orders_select_own` làm đơn của người khác vô hình" do chính bài kiểm cung cấp chứ không phải do cơ chế sinh ra. Một schema thiếu hẳn policy đó vẫn qua được cả 4 ca | Không cần input — **đã có chỗ**: plan Task 6.2 / SVC-2 chạy hai phiên thật | Task 6.2. Ghi ở đây để **đừng tính nghĩa vụ đó là đã hoàn thành** khi lên lịch 6.2 |
| **OP-6** | **MỚI, nhỏ.** `PAYMENT_ORDER_CHECKOUT_COLUMNS` ở `SOURCE/lib/supabase/service-role.ts:469-472` có comment "một lời khai cho HAI chỗ đọc"; `getMyOrder()` nay là chỗ thứ ba | Sửa con số trong comment | Bất kỳ task nào chạm `service-role.ts` sau này. **Không hành vi nào phụ thuộc** |

## 9. Nợ kỹ thuật và việc dọn còn nợ

- **Transcription drift — đã trả phần lớn.** Phiên này xoá thêm ba khai báo chép tay:
  `FixtureCheckoutOrder` (Task 3.3), `FixtureRateLimitedRefusal` / `FixtureRecheckOutcome` (Task 3.4),
  `FixtureMyOrderRow` (Task 3.5). **Mỗi mối nối đều được chứng minh có ràng buộc thật**, không phải giả định:
  thêm một trường vào kiểu thật làm `tsc` đỏ **ngay trong file fixture** (TS2741), rồi hoàn nguyên. Cả
  executor lẫn hai tác nhân rà soát đều dựng lại được. **Còn nợ:** `subscriptionFixtureData.ts:203` vẫn chép
  tay `39_000`.
- **Trích dẫn `schema.sql`:** phần backend DD + work plan đã vá ở `c435bce`. **`:1381-1382`, `:887-888`,
  `:1303-1304`, `:1268`, `:1361` và mọi thứ phía trên VẪN ĐÚNG** — bàn giao phiên 3 ghi `:1381-1382` là mục nát,
  **điều đó SAI**, đã xác minh lại hai lần; đừng "sửa" nó thành sai. Phần còn nợ là OP-2.
- **`docs/plans/subscription-backend-work-plan.md:50`** (bản **đã bị thay thế**) vẫn bảo implementer chọn sink —
  đúng cái BU-6 sinh ra để chặn. **Chờ kỹ sư: vô hiệu hoá hay lưu trữ.**
- **Checkbox trong `phase0/1/2-completion.md`** còn ô trống dù task đã xong — chỉ là sổ sách, Final Cleanup sẽ
  xoá các file này. Nội dung cổng đã verify thật.
- **`backend-task-13.md`**: mục "Exit-gate evidence" liệt kê bộ ca TRƯỚC vòng revision (16 checks); mục
  "Revision after integration-test-reviewer" mới là bộ cuối (20 checks). Task 6.4 re-walk nên biết.
- **Bàn giao trong code còn hiệu lực:** Task 5.1 sở hữu cách mã hoá `AI_BUDGET_FREE_SHARE` (phân số 0.5 hay
  phần trăm 50 — chưa tài liệu nào nêu; `checkEnv` cố ý chỉ kiểm "số hữu hạn lớn hơn 0").
- **`recordPaymentSettlement` KHÔNG truyền `p_period_days`**, dựa vào PostgREST phân giải tham số mặc định của
  SQL. Cố ý (một lời khai duy nhất cho độ dài kỳ hạn, đặt cạnh `make_interval` dùng nó). **Lần đầu chạm Postgres
  thật là plan Task 6.1 / SVC-1** — nếu sai thì sai ở đó.
- **Hai ghi chú cường độ khẳng định ở INT-2**, đã cân nhắc và cố ý không sửa: ca (h) ghim đúng định dạng mã nguồn
  (`.order("created_at", { ascending: false })`) nên xuống dòng cũng làm đỏ, và nó cấm `.sort(` chứ không cấm
  `.toSorted(` / `.reverse()`; ca (f) nhận diện mapping bằng 4 khoá nên né được bằng destructuring rename. Cả hai
  là phòng thủ lớp hai — chứng minh hành vi nằm ở (c)/(d).

## 10. Thứ tự chạy còn lại (26 task)

Từ `docs/plans/tasks/_overview-subscription-work-plan.md`:

- **Pha 3** (còn 4, **tất cả frontend**): `frontend-06` → `frontend-09` (`frontend-08` là điểm ★ thứ hai)
- **Pha 4** (6): `backend-20`, `frontend-10` → `frontend-14`
- **Pha 5** (8): `backend-21` → `backend-27`, **`backend-28` ⚠ apply prod (Task 5.8 — quy trình ở §3)**
- **Pha 6** (8): `backend-29` → `backend-33`, `frontend-15`, **`backend-34` ⚠ tiền thật**, **`backend-35` ⚠ bật bán**

**Ràng buộc thứ tự CL-01 đã được thoả và đóng lại** ở `5cdbc23`: `backend-17`/`18` chạy trước `backend-19`, và
`getMyOrder()` nay dùng `toCheckoutOrder()`. Lớp bẫy sinh ra nó (chuỗi thời gian dẫn từ chính thứ đang kiểm)
**đã cắn thật hai lần** — Task 2.3 và Task 3.5 — nên đừng coi là giả định.

## 11. Sau khi hết 50 task

Recipe đòi, đừng bỏ:

1. **code-verifier ×2** (một lần mỗi Design Doc, `doc_type: design-doc`) + **security-reviewer**, chạy **song song**.
2. Đạt: code-verifier `consistent`/`mostly_consistent`; security-reviewer `approved`/`approved_with_notes`.
   Trượt → gộp phát hiện thành 1 task file → executor → quality-fixer → chạy lại **chỉ** verifier đã trượt.
3. **Final Cleanup**: xoá `docs/plans/tasks/subscription-work-plan-*-task-*.md`, `*-phase*-completion.md`,
   `_overview-subscription-work-plan.md`. **Giữ** work plan.
