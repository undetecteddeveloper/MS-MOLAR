# Subscription — bàn giao pha THỰC THI (phiên 4)

**Viết 2026-08-19.** Phiên 1–2 đóng pha thiết kế; phiên 2 chạy bước 15→16→phân rã và 8 task đầu;
phiên 3 đóng Pha 1 và cổng chặn thủ công. Phiên này chạy trọn Pha 2 và mở Pha 3:
**xong 20/50 task, Pha 0 + Pha 1 + Pha 2 đều đóng, Pha 3 mở với Task 3.1 xong.**

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
| Vòng build | **20/50 xong. Pha 0 ✅ Pha 1 ✅ Pha 2 ✅ — Pha 3: 1/9** |

**Hành động kế tiếp: mở `docs/plans/tasks/subscription-work-plan-backend-task-16.md`** (plan Task 3.2 —
`settleOrder.ts` + `recordPaymentSettlement()`), chạy nó qua giao thức vòng build ở §4. Kỳ vọng khi xong:
một commit duy nhất, `npm test` và `npm run test:fixture` giữ nguyên nền xanh ở §5.

Pha 2 là **★ điểm xác minh sớm** đầu tiên của plan (plan Tasks 2.2/2.5) và nó đã qua: một component bị gate
render hạn mức thật từ provider thật, trên cây route thật. Điểm ★ thứ hai là plan Task 3.8 (`frontend-task-08`).

## 2. Nhánh và commit

Nhánh **`feat/subscription`**. Cây làm việc **sạch**. Tổng cho tính năng này:
**5 commit dọn nền + 20 commit task (1 task = 1 commit) + 1 commit dọn dẹp tài liệu**.

Phiên 4 (7 commit — 6 task + 1 chore):

| Commit | Task | Nội dung |
|---|---|---|
| `aa2cf48` | 2.1 | Thân `readEntitlement()` — dẫn xuất lúc đọc, quota từ Redis |
| `cef31e7` | 2.2 | `EntitlementProvider` mount ở `(layer2)` + `(layer4)` — **điểm xác minh sớm ★** |
| `aecc72e` | 2.3 | `lib/format/datetime.ts` + `number.ts`, C-09 `OrderStatusBadge`, 13 khoá `billing.*` cho S-05 |
| `d5ba7d7` | 2.4 | `TutorQuotaNote` mount ở cả hai call site; khai tử prop `formattedResetDate` |
| `d63a7b7` | 2.5 | FE-2 trên cây route THẬT **+ runner còn thiếu cho làn fixture-e2e** |
| `4a7419d` | 3.1 | Adapter payOS — module DUY NHẤT được nói tiếng nhà cung cấp |
| `c435bce` | — | Chore: vá trích dẫn `schema.sql` mục nát + ghi nhận drift của fixture |

## 3. ✅ CỔNG CHẶN TASK 1.3 ĐÃ QUA — quy trình phải lặp y hệt cho Task 5.8

Phiên 2 ghi đây là cổng thủ công không agent nào làm được. **Kỹ sư đã chỉ định làm bằng Composio**, và
nó chạy được. **Task 5.8 (`backend-task-28`, apply prod) dùng lại nguyên quy trình này** — đừng phát minh lại.

- **Dev = `hynwleaxtbtjzkvpjsug`**. **Prod = `pebjdlbgbmizgfpuptjl`** (tên "MS-MOLAR-prod").
  `.mcp.json` trỏ PROD — đọc nhầm ref là kết luận nhầm môi trường.
- Công cụ: `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, tool slug **`SUPABASE_BETA_RUN_SQL_QUERY`**
  (chạy được DDL, đặt `read_only: false`). Toolkit `supabase` đã ACTIVE.
- Trình tự đã dùng: liệt kê project để xác nhận đích → chụp trạng thái TRƯỚC → apply theo thứ tự phụ thuộc,
  **từng khối một** (API timeout khoảng 60s) → **kiểm catalog TRƯỚC khi ghi vân tay** → ghi vân tay **CUỐI CÙNG**.
  Vân tay đi cuối là cố ý: paste đứt giữa chừng thì DB thà không biết mình là bản nào, còn hơn khai nhận một
  bản nó chưa chạy hết.
- Kết quả trên dev: đủ 4 đối tượng; `npm run verify:schema` **8/8 xanh**; khoá ngoại **25 → 27**, mọi `on delete`
  khớp (TD-011 đóng); vân tay `021dd1387945` apply lúc `2026-08-18T13:53:05.77815+00:00`.
- **Prod vẫn KHÔNG có bảng nào.** Đó là Task 5.8, và nó chỉ được chạy khi Pha 5 tới lượt.

Hệ quả: làn `test:localdb`, các ca integration và `test-rls.ts` giờ chạy được trên dev thật.

## 4. Giao thức vòng build (bắt buộc, đừng rút gọn)

Mỗi task: **task-executor → [integration-test-reviewer nếu `requiresTestReview: true`] → quality-fixer →
orchestrator commit.**

Định tuyến **theo tên file**, không suy đoán:

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Viết câu đó vào mọi prompt.

### 4a. Lớp lỗi tái phát — nay là 12 ca, phải nói thẳng trong mọi prompt

**Tạo tác khẳng định một năng lực phân biệt mà nó không có.** Đếm chạy: **5 ca phiên 2 + 3 ca phiên 3 +
4 ca phiên 4 = 12**. (Bản bàn giao phiên 3 ghi "6 lần" — đó là đếm thiếu; nó liệt kê 3 ca của chính nó và
gộp phiên 2 thành 4 dòng trong khi bản phiên 2 nêu 5 ca. Con số đúng là 12, giữ nó cho đúng.)

Bốn ca phiên này:

1. **Task 2.2** — ca kiểm mang **đúng tên khẳng định D005** vẫn **XANH trên một cây render ra rỗng**, vì
   helper `probeText()` trả `""` qua nhánh dự phòng khi phần tử vắng mặt. integration-test-reviewer bắt được,
   và chứng minh bằng cách gỡ một mock rồi chạy lại.
2. **Task 2.3** — đột biến hoán **hai giá trị từ điển** SỐNG SÓT, vì mọi khẳng định badge đọc kỳ vọng ngược ra
   từ chính từ điển đó, nên phép hoán dịch **cả hai vế** của đẳng thức. Vá bằng các ca literal cố định.
3. **Task 2.5** — mục (d) của chính FE-2 xanh tầm thường (không provider thì mọi quota đều `unknown`, nên
   "không note, không số 0, không dấu —" chẳng khẳng định gì), và cả ba dòng mục (g) quét **cùng một nút idle**
   bất kể trạng thái chúng đặt tên. Cả hai do vòng đỏ của chính executor bắt, rồi vá bằng positive control và
   `assertStateMaterialised`.
4. **Ở tầng LÀN, không phải tầng khẳng định** — FE-2 là thứ duy nhất kết toán AC-042 và **không có runner nào
   chạy nó**, nên nó kết toán con số không. Xem §5.

### 4b. Cách viết prompt có hiệu quả — và một tinh chỉnh mới

Yêu cầu executor: (a) quan sát **ĐỎ thật** trước khi xanh, (b) nêu rõ mỗi ca kiểm bác bỏ những **bản cài đặt sai
NÀO**, (c) chạy **đột biến** trên bản sao trong bộ nhớ rồi khôi phục. Cả ba tiếp tục đẻ ra phát hiện thật trong
**cả 6 task** phiên này.

**Tinh chỉnh phiên này bổ sung: một giá trị kỳ vọng DẪN TỪ CHÍNH THỨ ĐANG KIỂM thì không chứng minh gì.**
Ngày tạo bằng cách gọi `formatDate`; chữ badge đọc ngược ra từ từ điển; digest HMAC do chính bản cài đặt sinh ra
— cả ba trôi cùng lỗi và luôn xanh. Task 3.1 tính mọi digest kỳ vọng bằng `openssl` **ngoài project**, và
quality-fixer dẫn lại độc lập bằng Python; cả bốn khớp. Viết đúng yêu cầu đó vào prompt.

### 4c. Hai quyết định orchestrator, cả hai giải được mà không cần kỹ sư — tiền lệ để dùng lại

- **Task 2.4 leo thang `design_compliance_violation`**: render ngày đặt lại làm đỏ hai khẳng định trong file test
  của Task 2.2. Xung đột có thật, **nhưng lệnh đóng băng các file đó đến từ prompt của orchestrator, không phải
  từ task file**, mà mục scope boundary của task file chỉ nêu ba file. **UI Spec v1.4 § UI-D17 phân xử**: các
  khẳng định kia mã hoá suy luận TRƯỚC tu chỉnh ("không truyền prop ⇒ không có ngày"), thứ mà Task 0.3 đã lật.
  Chỉ sửa đúng hằng số kỳ vọng đã cũ. **Bài học: khi executor leo thang, kiểm xem ràng buộc bị vi phạm nằm ở
  task file hay ở prompt — nguồn khác nhau thì thẩm quyền khác nhau.**
- **Runner còn thiếu ở Task 2.5**: cấp phép như một **thiếu sót cơ học của plan Task 0.7** (`frontend-task-01`,
  task sinh ra ba khung làn), **không phải một lựa chọn thiết kế**. Vì vậy nó thuộc phạm vi sửa, không phải
  phạm vi hỏi.

## 5. Làn test và nền xanh (số phải tái lập được TRƯỚC khi tin thay đổi của chính mình)

### 5a. Có một làn MỚI

`SOURCE/vitest.fixture.config.ts` + script `npm run test:fixture` được tạo ở `d63a7b7`. Trước đó,
**KHÔNG config đã commit nào thu `tests/e2e/fixture/**`** — FE-2 và sáu driver script anh em **chưa từng chạy
trong bất kỳ làn đã commit nào**.

- Làn này **không cần database, không cần credential, không chạm mạng** (khác hẳn `test:integration` /
  `test:localdb`), nên nó an toàn để vào cổng CI.
- `exclude` **liệt kê ĐÍCH DANH sáu script chỉ-có-comment** (history, rating, short-answer-scoring, ba file
  support-*) thay vì lọc theo mẫu, để mỗi chỗ thiếu vẫn nhìn thấy được; **bật lại một file là xoá đúng một dòng**.
  **Khi danh sách đó rỗng, gộp làn này vào `npm test`.**
- `include` glob theo **thư mục**, nên một ca fixture-e2e mới được thu tự động, không phải sửa config.

### 5b. Nền xanh hiện tại

| Lệnh (chạy trong `SOURCE/`) | Kết quả phải tái lập |
|---|---|
| `npm test` | **1105 pass / 10 skip** (98 file pass, 1 skip) |
| `npm run test:fixture` | **23 pass, exit 0** |
| `npx tsc --noEmit` | **0** |
| `npm run lint` (`eslint --max-warnings 0`) | sạch |
| `npm run test:integration`, `npm run test:localdb` | **vẫn exit 1**, "No test suite found in file" |
| `next build` | xanh **chỉ khi tắt sandbox** (xem §6) |

- Hai làn exit 1 là **CỐ Ý** (khung mới chỉ có comment). **Đừng bao giờ thêm `--passWithNoTests`** — làm thế là
  xoá đúng tín hiệu cho biết ca integration chưa được điền.
- **Flake đã biết, đừng đuổi:** `components/tutor/ExplainStepAffordance.test.tsx` timeout 5000ms khi chạy song
  song lúc cache lạnh; chạy riêng **5/5 trong khoảng 3 giây**. Phiên này nó nổ vài lần và **lần nào chạy riêng
  cũng pass**.

### 5c. Bẫy môi trường thứ hai, nay đã xác nhận hai lần: múi giờ

Máy dev này chạy **`TZ=Asia/Saigon`** — **đúng cái múi giờ mà `lib/format/datetime.ts` ghim**
(`Asia/Ho_Chi_Minh`). Hệ quả: một formatter **không ghim** vẫn render y hệt **ở đây** và xanh một cách vô cớ,
trong khi Vercel chạy UTC.

- Cả bộ test format lẫn FE-2 **tự ép `process.env.TZ`** và mang một **ca canh gác** khẳng định phép ghim đã có
  hiệu lực.
- Ca canh gác **chịu lực thật**, đã chứng minh: reviewer bẻ formatter **VÀ** xoá luôn phần ghim → **22 ca xanh,
  chỉ ca canh gác đỏ**.
- Khi viết bất kỳ ca kiểm nào chạm ngày/giờ: chọn instant **khác NGÀY LỊCH** giữa UTC và ICT (ví dụ
  `2026-08-18T17:30:00.000Z`), đừng chọn instant chỉ khác giờ.

## 6. Sự thật môi trường (tốn thời gian để phát hiện lại)

- **`TaskCreate` / `TaskUpdate` KHÔNG tồn tại.** Mọi agent sẽ báo thiếu. Bảo agent bỏ lệnh gọi đó nhưng vẫn làm
  phần việc bên dưới; đây không phải blocker.
- **`next build` TREO vô hạn dưới sandbox mặc định** (turbopack node transform pool: khoảng 2.2 CPU-giây trong
  20 phút, không ghi gì, không báo lỗi). Chạy với `dangerouslyDisableSandbox: true`. **TREO chứ không FAIL** —
  đã tốn 35 phút mới phát hiện. `vitest` / `tsc` / `eslint` chạy bình thường trong sandbox.
- **Bash tool bọc lệnh trong nháy đơn**, nên **nội dung có dấu nháy đơn phá cú pháp shell** ("unexpected EOF").
  Viết file dài bằng Write tool, đừng heredoc. Commit message tránh dấu nháy đơn.
- **App root là `SOURCE/`**, không phải gốc repo. `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- `test-rls.ts` chạy độc lập bằng `npx tsx supabase/test-rls.ts` (93 phép kiểm), **không** qua vitest.
- **`npm run verify:schema` = `npx tsx supabase/verify-schema.ts`**, độc lập, chạm DB thật — **không** nằm trong
  `check:bundle`. Script ở `SOURCE/package.json:15` (task file ghi `:13`, sai).
- **Vitest không có `setupFiles`:** không có matcher `jest-dom`; jsdom khai theo từng file bằng chỉ thị
  `@vitest-environment jsdom` ở **dòng 1**; `render()` **không** tự cleanup.
- Import thừa là **lỗi chí mạng** dưới `eslint --max-warnings 0`.
- **Ghi tiến độ: Notion qua Composio, database `3b378ba6-ae12-803c-8500-c572b6fc745f`.** `PROCESS.md` đã bị xoá
  khỏi repo — đừng ghi vào đó.

## 7. Phiên bản tài liệu hiện tại

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.6** — thẩm quyền về UI, có mệnh đề Phase Inversion |
| `docs/design/subscription-backend-design.md` | **v1.9** (lên từ v1.8 ở `c435bce`) |
| `docs/design/subscription-frontend-design.md` | **v1.6** |
| `docs/plans/subscription-work-plan.md` | **v1.3** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — sửa nó phải sửa UI Spec trước, kèm lý do.

Frontend DD cố ý vẫn trỏ **UI Spec v1.2** ở mục "Referenced UI Spec" — đó là bản mà thiết kế đã tiêu thụ, kèm
bảng liệt kê delta v1.3→v1.6 và quy tắc bác bỏ. **Đừng "sửa" nó.**

## 8. Việc mở thuộc về kỹ sư

### 8a. BU-1…BU-6 (không đổi từ phiên trước)

| # | Mục | Chặn gì |
|---|---|---|
| **BU-1** | **TBD-02 nội dung pháp lý** | **bật bán + test webhook tiền thật.** `docs/legal/refund-policy.md` còn 3 chỗ chưa điền, chưa nêu pháp nhân bán; **chưa có bản Terms nào** dù R11 đòi 2 trang |
| **BU-2** | ADR-0018 thư viện QR | không chặn gì |
| **BU-3** | E-01 phạm vi AC-034 | không chặn gì |
| **BU-4** | U2 đơn giá thật | **bật bán** — chặn qua BU-6 |
| **BU-5** | Metric #9 baseline | **bật bán** — truy vấn `telemetry_log` 14 ngày, phải chạy TRƯỚC khi bật bán (AC-055) |
| **BU-6** | **Đích ghi bền cho AI usage chưa được thiết kế** | **Task 1.6** (không sinh file thực thi), rồi BU-4 |

Chuỗi: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Không gì trong Pha 2–5 phụ thuộc nó.

**BU-6 đã được ghi thành E-03 trong backend DD** (Task 0.9): nêu rõ mệnh đề nào bị rút, và yêu cầu một bản sửa DD
thiết kế đủ 6 phần — tên bảng; danh sách cột đầy đủ gồm tách token vào/ra kèm `thoughtsTokenCount` tính theo giá
output và chiều `role`; FK kèm `on delete`; RLS policy; tập revoke/grant nêu đích danh; ảnh hưởng vân tay §17.
**Cấm mọi task tự chọn sink.**

### 8b. Phát sinh phiên 4 (mã OP-* chỉ dùng trong file này, không tài liệu nào khác biết)

| # | Mục | Cần input gì để gỡ | Ai sở hữu |
|---|---|---|---|
| **OP-1** | **`FIXTURE_ENTITLEMENT_KNOWN` / `_EXHAUSTED` mô tả một hình dạng người dùng backend KHÔNG tạo ra được**: chúng trải `FREE_FALLBACK` (`plan: "free"`) nhưng mang `FIXTURE_TUTOR_LIMIT = 500`, tức `PLAN_LIMITS.premium.tutor` (free là 5); và `FIXTURE_UPLOAD_LIMIT = 5` **không khớp plan NÀO** (free 3, premium 15) | Một quyết định: sửa số fixture cho khớp một plan **và** sửa kèm mọi khẳng định FE-2 ghim theo số đó, hay giữ nguyên và ghi lý do | **Chủ sở hữu module fixture.** Hiện **vô hại** — `TutorQuotaNote` không bao giờ đọc `PLAN_LIMITS` — và **cố ý KHÔNG sửa**, vì các khẳng định FE-2 ghim theo chính con số này. Đã ghi thành comment ngay tại chỗ khai báo ở `c435bce` |
| **OP-2** | **`ADR-0015` mang cùng lớp mục nát trích dẫn `schema.sql`** mà `c435bce` đã vá cho backend DD và work plan: `:1574` (literal vân tay), cùng `:1385`, `:1429`, `:1513`, `:1009-1015` | Một đợt vệ sinh tài liệu đọc lại từng neo trong file rồi vá — **vá số dòng mà không đọc lại chính là đẻ lại khuyết tật** | Đợt vệ sinh tài liệu kế tiếp (ngoài phạm vi `c435bce`) |
| **OP-3** | **Một câu hỏi bảo mật cố ý để ngỏ ở Task 3.1**: adapter chỉ ánh xạ ba literal trạng thái mà nguồn trong repo ghi nhận (`PENDING` / `SUCCEEDED` / `CANCELLED`); giá trị khác rơi về `"unknown"` (fail-closed, cứu được bằng `recheckOrder`) | **Một lần giao THẬT ở plan Task 6.7.** Nếu nó dùng literal khác cho trạng thái đã trả tiền, **`toPaymentStatus()` là đúng một dòng cần sửa** | Task 6.7 (webhook tiền thật) |
| **OP-4** | **Backend DD tự mâu thuẫn, Task 3.1 giải công khai chứ không giải thầm**: mục Consumer Parse Rule của webhook nói HMAC phủ "raw body bytes", còn mục Serialized Format lại quy định canonicalisation `key=value&…` sắp theo khoá của `data`. Digest trên body bytes sẽ **từ chối mọi lần giao thật** | Sửa câu chữ DD cho khớp bản cài đặt: adapter nhận `rawBody: string`, parse **đúng một lần**, **không bao giờ** tuần tự hoá lại, và digest theo canonicalisation nhà cung cấp công bố | Đợt vệ sinh tài liệu kế tiếp — đây là **khuyết tật câu chữ**, không phải khuyết tật code |

## 9. Nợ kỹ thuật và việc dọn còn nợ

- **Transcription drift:** `subscriptionFixtureData.ts` và `subscriptionServiceFixtures.ts` chép tay type/hằng số
  của backend; **`tsc` KHÔNG thấy được** vì chúng qua PostgREST dạng chuỗi. Đã trả một phần: Task 1.4 (2 hằng
  trong làn service chuyển sang import) và Task 3.1 (`FixturePaymentStatusResult` nay dẫn từ
  `Awaited<ReturnType<typeof getPaymentStatus>>`, và mối nối đó **ràng buộc thật** — thêm một thuộc tính thứ ba
  vào kiểu trả làm `tsc` đỏ ngay trong file fixture, TS2741). Dòng checklist còn cắm ở backend task
  **16, 17, 18, 19**. `subscriptionFixtureData.ts:203` vẫn chép tay `39_000`.
- **Trích dẫn `schema.sql` — đã vá phần lớn, phần còn lại NHỎ và cụ thể:** Task 1.1 chèn 4 khối DDL **NGAY TRƯỚC**
  header `-- 17. Phiên bản schema`, nên **chỉ những neo tại hoặc dưới điểm chèn mới dịch, đúng 227 dòng**
  (§17 nay ở `:1824`; file dài 1866 dòng). `c435bce` đã vá 7 trích dẫn trong backend DD + work plan.
  **`:1381-1382`, `:887-888`, `:1303-1304`, `:1268`, `:1361` và mọi thứ phía trên VẪN ĐÚNG** — bản bàn giao phiên 3
  ghi `:1381-1382` là mục nát, **điều đó SAI** và đã xác minh lại; đừng "sửa" nó thành sai. Phần còn nợ là OP-2.
- **`docs/plans/subscription-backend-work-plan.md:50`** (bản **đã bị thay thế**) vẫn bảo implementer chọn sink và
  còn nêu ưu tiên bảng riêng — đúng cái BU-6 sinh ra để chặn. Không sửa, vì work plan hiện hành ghi rõ việc khai tử
  file đó là quyết định của kỹ sư. **Chờ kỹ sư: vô hiệu hoá hay lưu trữ.**
- **Backend DD `:1199`** còn viết tắt `getPaymentStatus() === "paid"`. Reviewer xét là để được. Gộp vào bước
  Refactor của `backend-task-16` (task kế tiếp).
- **Checkbox trong `phase0-completion.md`, `phase1-completion.md`, `phase2-completion.md`** còn ô trống dù task đã
  xong — chỉ là sổ sách, và Final Cleanup sẽ xoá các file này. Nội dung cổng đã được verify thật.
- **`backend-task-13.md`**: mục "Exit-gate evidence" liệt kê bộ ca TRƯỚC vòng revision (16 checks); mục "Revision
  after integration-test-reviewer" bên dưới mới là bộ cuối (20 checks). Task 6.4 re-walk nên biết.
- **Bàn giao trong code còn hiệu lực:** Task 5.1 sở hữu cách mã hoá `AI_BUDGET_FREE_SHARE` (phân số 0.5 hay phần
  trăm 50 — chưa tài liệu nào nêu; `checkEnv` cố ý chỉ kiểm "số hữu hạn lớn hơn 0").

## 10. Thứ tự chạy còn lại (30 task)

Từ `docs/plans/tasks/_overview-subscription-work-plan.md`:

- **Pha 3** (còn 8): `backend-16` → `backend-19`, rồi `frontend-06` → `frontend-09` (`backend-15` xong;
  `frontend-08` là điểm ★ thứ hai)
- **Pha 4** (6): `backend-20`, `frontend-10` → `frontend-14`
- **Pha 5** (8): `backend-21` → `backend-27`, **`backend-28` ⚠ apply prod (Task 5.8 — quy trình ở §3)**
- **Pha 6** (8): `backend-29` → `backend-33`, `frontend-15`, **`backend-34` ⚠ tiền thật**, **`backend-35` ⚠ bật bán**

**Ràng buộc thứ tự, giữ nguyên độ nổi bật: `backend-17` / `backend-18` PHẢI chạy trước `backend-19`**
(CL-01 — `getMyOrder()` phải dùng `toCheckoutOrder()`, nếu không **INT-2 đỏ** vì `pendingUntil` dạng `+00:00`
khác chuỗi dạng `…Z`). Lớp bẫy này **đã cắn lần nữa ở Task 2.3** (múi giờ/chuỗi thời gian dẫn từ chính thứ đang
kiểm): **có thật, không phải giả định.**

## 11. Sau khi hết 50 task

Recipe đòi, đừng bỏ:

1. **code-verifier ×2** (một lần mỗi Design Doc, `doc_type: design-doc`) + **security-reviewer**, chạy **song song**.
2. Đạt: code-verifier `consistent`/`mostly_consistent`; security-reviewer `approved`/`approved_with_notes`.
   Trượt → gộp phát hiện thành 1 task file → executor → quality-fixer → chạy lại **chỉ** verifier đã trượt.
3. **Final Cleanup**: xoá `docs/plans/tasks/subscription-work-plan-*-task-*.md`, `*-phase*-completion.md`,
   `_overview-subscription-work-plan.md`. **Giữ** work plan.
