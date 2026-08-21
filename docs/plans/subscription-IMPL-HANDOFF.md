# Subscription — bàn giao pha THỰC THI (phiên 7)

**Viết 2026-08-21.** Phiên 1–2 đóng pha thiết kế; phiên 2 chạy bước 15→16→phân rã và 8 task đầu;
phiên 3 đóng Pha 1 và cổng chặn thủ công; phiên 4 chạy trọn Pha 2; phiên 5 đóng backend Pha 3;
phiên 6 chạy nốt frontend Pha 3 và trọn Pha 4.
Phiên này chạy **TRỌN Pha 5 (kể cả apply DDL lên PRODUCTION) và mọi thứ làm được của Pha 6, rồi
chạy trọn vòng xác minh sau thực thi.**

Đọc file này trước, đọc hết, rồi mới mở task file. Nó tồn tại để phiên sau không phải suy lại một
ngày ngữ cảnh. Nó được **viết lại tại chỗ mỗi phiên**, không bồi thêm.

---

## 1. Luồng đang ở đâu

`recipe-fullstack-implement`, luồng fullstack quy mô Large (`monorepo-flow.md`).

| Bước | Trạng thái |
|---|---|
| 1–16 + phân rã | xong (phiên 1–2) |
| **Batch approval** | **ĐÃ CẤP** 2026-08-18, vẫn còn hiệu lực |
| Vòng build | **47/50 xong. Pha 0–5 ✅, Pha 6 ✅ phần làm được** |
| Xác minh sau thực thi | **XONG** — code-verifier ×2 + security-reviewer, và **5 vòng sửa** |
| Final Cleanup | **CHƯA LÀM — bị chặn quyền.** Xem §9 |

**Ba task còn lại KHÔNG PHẢI việc của agent.** Chúng cần người thật, tiền thật, hoặc một quyết
định kinh doanh — chi tiết ở §8. **Mã sẽ xong; TÍNH NĂNG THÌ CHƯA BÁN ĐƯỢC.**

## 2. Nhánh và commit

Nhánh **`feat/subscription`**. Cây làm việc **sạch** tại `6e192f0`. Phiên này **19 commit**.

| Commit | Việc |
|---|---|
| `abe779f` | 5.1 `consumeQuota` — hai bộ đếm, hai đơn vị |
| `14616b6` | 5.2 điểm phát Gemini duy nhất + bảng giá thao tác |
| `6d2fd26` | **đòn nền, KHÔNG task file** — nới `TELEMETRY_ERROR_CODES` lên sáu mã |
| `22aeab8` | 5.3 cổng hạn mức gia sư + **sửa cổng ADR-0013** |
| `6fa3580` | 5.4 cổng hạn mức upload + INT-1 |
| `535faf7` | 5.5 gỡ trích dẫn §19 ma |
| `a1476b2` | 5.6 B-01 trần gia sư theo bậc |
| `1b0c138` | 5.7 AC-047 trên Postgres THẬT |
| `adf78e8` | **5.8 — DDL LÊN PRODUCTION** |
| `6361485` | 6.1 SVC-1 |
| `52cc734` | 6.2 SVC-2 — **OP-5 đóng** |
| `a7d3038` | 6.3 bản ghi hồi quy toàn cổng |
| `c864786` | 6.4 rà soát an ninh ADR-0014 |
| `b944751` | 6.6 đóng sổ tài liệu |
| `1418442` … `6e192f0` | **5 vòng sửa sau xác minh** |

## 3. ✅ DDL ĐÃ LÊN PROD — và một nửa cổng B còn nợ

**Đã apply lúc `2026-08-20T10:08:39Z`** lên `pebjdlbgbmizgfpuptjl`, theo quy trình Composio:
xác nhận đích → chụp TRƯỚC → apply **từng khối một** → **kiểm catalog** → ghi vân tay **CUỐI CÙNG**.

- **TRƯỚC**: không bảng nào, CHECK bốn literal, vân tay `d714c313fe1d`.
- **SAU**: `payment_orders` 11 cột, `subscriptions` 4 cột, `record_payment_settlement`, CHECK **sáu**
  literal, RLS bật, **27** khoá ngoại, vân tay `021dd1387945`.
- Xác minh bằng **truy vấn đếm thật**, không phải so vân tay. Đối chiếu chéo với dev: digest cột
  `d77afe475990791d31ee192deffa1796` (150 cột) và digest khoá ngoại
  `8b627029b88131d807213c2b87112fc7` (27) **TRÙNG KHÍT**.
- **Khác biệt duy nhất, có từ trước**: prod có `public.rls_auto_enable()` (event trigger `ensure_rls`),
  **không có trong dev lẫn git**. Vô hại và có tính bảo vệ. Nó cho thấy giới hạn thật của vân tay:
  vân tay chứng minh `schema.sql` nào đã chạy, **không** phát hiện được một đối tượng CÓ trên DB mà
  VẮNG trong git.

### ⚠ Cổng B trên prod CHƯA chạy, và đừng chạy nó cho tới khi gỡ được chốt

`verify-schema.ts` gọi `admin.auth.admin.createUser` **vô điều kiện**, và khi tài khoản đã tồn tại
thì `updateUserById` **đặt lại mật khẩu + xác nhận email**. `PROBE_EMAIL`/`PROBE_PASSWORD` nằm
**nguyên văn trong mã nguồn**. Chạy trên prod = cắm một tài khoản biết-mật-khẩu đã xác nhận vào auth
sản xuất.

**Và tác nhân an ninh chỉ ra một điều làm việc dừng lại đỡ tốn hơn tưởng**: `verify:schema` **không
hề nhắc** `payment_orders`, `subscriptions` hay `record_payment_settlement` — grep trả về rỗng. Nên
"gate B green on prod" là tiêu chí thoát được đặt tên cho các bảng tiền trong khi **về cấu trúc
không quan sát được chúng**. Phiên này đã thêm **mục 9** (ba phép thăm quyền ghi, mỗi cái khẳng định
**42501**, dùng lại kỷ luật `isAuthorizationDenial` nên `23503` **không** đi qua được), nên cổng B
nay *có* nhìn thấy chúng — nhưng chốt tài khoản probe vẫn phải gỡ trước.

**Đây là MỘT quyết định với HAI thứ phụ thuộc** (mục 17 của sổ đăng ký): gỡ chốt `signInProbeUser()`
thì đóng được cả cổng B trên prod lẫn rủi ro thông tin đăng nhập.

## 4. Giao thức vòng build (đừng rút gọn)

Mỗi task: **executor → [integration-test-reviewer nếu lấp khung test] → quality-fixer → orchestrator commit.**

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Viết câu đó vào mọi prompt.

### 4a. Lớp lỗi tái phát — nay **24 ca**

**Tạo tác khẳng định một năng lực phân biệt mà nó không có.** Đếm chạy: 20 (phiên 2–6) + **4 lớp
mới phiên này**. Sáu ca phiên này, và **mọi ca đều do vòng rà ĐỘC LẬP tìm ra sau khi executor đã tự
chạy đột biến và báo "không con nào sống sót"**:

1. **#21** Hai phép quét "triệt để" chỉ đi bộ `.ts`/`.tsx` trong khi `allowJs: true` — một điểm phát
   `.mjs` sống sót **cả hai** danh sách, trong khi comment ngay trên khẳng định phủ kín `SOURCE/**`.
2. **#22 CON SỐNG SÓT THẬT**: người dùng hết lượt bị trả lời *"tạm thời không dùng được"* thay vì câu
   chính sách AC-018/AC-053 — **25/25 test vẫn xanh**. Ca (g) khẳng định số lần gọi adapter, cả hai
   delta bộ đếm và mã console, nhưng **không bao giờ đọc `run.result`**.
3. **#23** Một khẳng định "0 lượt gọi" được thoả mãn bởi **một CỔNG KHÁC** — nên nó đúng kể cả khi gỡ
   hẳn cổng đang kiểm.
4. **#24** Con sống sót **THỨ HAI** mà executor không báo: cả hai phạm vi xoá của teardown đều sống
   sót **riêng lẻ**; chỉ bỏ cả hai mới bị bắt.

**Bài học phiên này, viết vào prompt:**

- **Đếm số lượt gọi, đừng đọc trạng thái đã render** — và **luôn có ĐỐI CHỨNG DƯƠNG**. Một khẳng định
  "0 lượt gọi" **thưởng cho** một cổng từ chối tất cả. Đã chứng minh: trỏ truy vấn vào `order_code = -1`
  (từ chối mọi thứ) thì **chỉ ca đối chứng** đỏ, ca từ chối **vẫn xanh**.
- **Khi hai nhánh cùng suy giảm giống nhau, phép bằng sâu giữa chúng vẫn XANH.** Cần thêm một literal
  viết tay cho **từng** nhánh.
- **Gieo HAI giá trị KHÁC NHAU** — con đột biến đòi điều đó là con **GỘP** (một anh xạ thật ra là hằng
  số), không phải con hoán vị.
- **Một `console.warn` của CHÍNH module đang kiểm có thể thoả mãn phép quét chuỗi toàn cục.** Thu hẹp
  về đúng dòng.

### 4b. Bốn cái bẫy "0 lần khớp" — đều đọc y hệt một lần PASS

Đây là chủ đề lớn nhất của phiên. **Bốn tác nhân khác nhau dính, bốn nguỵ trang khác nhau:**

1. **Neo đột biến viết bằng LF trên file CRLF** → khớp 0 lần. 5/15 con đầu tiên dính.
2. **`vitest -t "a+b+c"`** → `+` là lượng tử regex, khớp **0 ca**, **exit 0**.
3. **Phép quét chỉ đi bộ `.ts`/`.tsx`** trong khi `allowJs: true`.
4. **Perl pattern kết thúc `,\n` trên file CRLF** → sửa không ăn, test báo XANH.

**Luật: md5 file trước/sau, và khẳng định neo khớp ĐÚNG MỘT LẦN.** Vòng chất lượng bắt được ca (4)
**chỉ vì** nó đã ghi md5 trước. Đọc dòng `Tests`, **đừng đọc exit code**.

### 4c. Tiền lệ orchestrator

- **Vòng rà trả `needs_revision` → gọi Agent MỚI**, không SendMessage. Nhưng **executor bị CHẶN giữa
  chừng thì SendMessage** — Task 5.3 leo thang hai lần và được nối lại nguyên ngữ cảnh cả hai lần.
- **Prettier KHÔNG phải cổng.** Đừng reformat.
- **Vòng rà độc lập tìm ra khuyết tật thật 100% số lần chạy** trên nhánh này. Một báo cáo "không con
  nào sống sót" **chưa đủ để tin**.

## 5. Làn test và nền xanh

| Lệnh (chạy trong `SOURCE/`) | Kết quả phải tái lập |
|---|---|
| `npm test` | **1483 pass / 10 skip** (120 file) |
| `npm run test:integration` | **31 pass** (2 file) |
| `npm run test:fixture` | **77 pass** |
| `npm run test:localdb` | **11 pass** ← **ĐÃ ĐỔI NGHĨA** |
| `npx tsc --noEmit` | 0 |
| `npm run lint` | sạch |
| `npm run check:bundle` | exit 0 |
| `npm run build` | 24/24 trang — **phải tắt sandbox** |
| `npm run verify:schema` | **26** ✓ trên dev (trước: 22) |
| `npx tsx supabase/test-rls.ts` | **93** ✓, khối subscription là **Phần 9**, 20 phép kiểm |

**`test:localdb` KHÔNG còn exit 1.** Trước phiên này nó exit 1 *có chủ đích* vì khung rỗng; Task 6.1
và 6.2 lấp SVC-1/SVC-2 nên nay exit 0 với 11 ca. **Đừng bao giờ thêm `--passWithNoTests`** — đã quét
toàn repo, nó không tồn tại ở chỗ chạy được nào.

- **Hai flake đã biết, đừng đuổi**: `ExplainStepAffordance.test.tsx` và `recordSkillMastery.int.test.ts`.
- Sau mọi làn chạm DB, **`payment_orders` và `subscriptions` phải về 0 dòng** — kiểm bằng **truy vấn
  không vị từ của riêng mình**, đừng dùng `countFixtureRows()`: hai trong ba chân của nó là **hiển
  nhiên** sau teardown (người dùng đã bị xoá nên đếm bằng 0 theo cấu trúc).
- Làn service **độc lập thứ tự** (5 hạt giống), và **tự quản `KV_REST_API_*`** để ghim bộ đếm về RAM.

## 6. Sự thật môi trường

- **`TaskCreate`/`TaskUpdate` KHÔNG tồn tại.** Bảo agent bỏ lệnh gọi, vẫn làm phần việc dưới. **Hệ quả
  cho orchestrator: bước "đăng ký flow bằng TaskCreate" mà recipe bắt buộc là KHÔNG làm được.**
- **`next build` TREO vô hạn dưới sandbox mặc định** — treo chứ không fail. `dangerouslyDisableSandbox: true`.
- **`cwd` phải là `E:/StemWeb_project/MS-MOLAR/SOURCE`**: gạch ngược → `spawnSync` lỗi `ENOENT` **trong
  im lặng**; chữ ổ đĩa thường → `vi.mock("server-only")` **trượt trong im lặng**.
- **`spawnSync` trên `npm.cmd` từng trả `status: null` kèm `EINVAL` trong khi shell báo thành công** —
  kiểm `status === null` tường minh.
- **`2>&1` trong `execSync` phá exit code**, ống dẫn cũng vậy.
- **App root là `SOURCE/`.** `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- **Vitest không có `setupFiles` ở BẤT KỲ làn nào**; jsdom khai theo từng file ở **dòng 1**;
  `render()` **không** tự cleanup.
- **`render(await Component())` cho CÂY RỖNG trong im lặng** khi component có con async — dùng
  `renderServerTree.tsx`. **12 file test đi vòng qua nó.**
- **GFM phân tích ô bảng TRƯỚC inline code** — dấu nháy ngược **không** bảo vệ dấu `|`. Một dòng
  **thừa ô** bị GFM **vứt bỏ nội dung trong im lặng**. Đã có một ca thật: dòng lịch sử v1.7 của UI
  Spec mất ~1.960 ký tự, và ô bị cắt **giữa chữ ký**, khiến từ cuối người đọc thấy lại chính là chữ
  ký đã bị thay thế. Thoát `\|` là sửa **cách render**, không sửa nội dung.
- **Ghi tiến độ: Notion qua Composio**, database `3b378ba6-ae12-803c-8500-c572b6fc745f`.

## 7. Phiên bản tài liệu

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.11** |
| `docs/design/subscription-backend-design.md` | **v1.12** |
| `docs/design/subscription-frontend-design.md` | **v1.13** |
| `docs/plans/subscription-work-plan.md` | **v1.6** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — vòng xác minh xác nhận **byte-nguyên-vẹn**,
không mã nào trôi khỏi nó.

Frontend DD cố ý ghim **UI Spec v1.2** — đó là bản thiết kế đã tiêu thụ, kèm bảng delta và luật bác
bỏ. **Đừng "sửa" ghim đó.** Mọi bản từ v1.3 đến v1.11 đều thêm được vào bảng, nên ghim đứng yên là đúng.

## 8. Việc mở thuộc về kỹ sư

### 8a. Ba task bị chặn — **KHÔNG PHẢI việc của agent**

| Task | Chờ gì |
|---|---|
| **6.5** `frontend-task-15` | **Người thật trên Android tầm trung thật** — quét 360px + greyscale, quét bàn phím, FE-AC-26. Một unit test xanh **KHÔNG** giải trừ được FE-AC-26. Là bằng chứng **duy nhất** cho AC-042, AC-043 |
| **6.7** `backend-task-34` | **Tiền thật** trên tên miền sản xuất, **và** BU-1 — người mua chỉ chạm được nút Mua khi nó được bật, mà C-15 giữ nó `aria-disabled` chừng nào `legalContentReady === false` |
| **6.8** `backend-task-35` | **BU-1, BU-4, BU-5** — BU-4 nằm sau chuỗi **BU-6 → Task 1.6 → BU-4**, tức sau một lần **sửa thiết kế**, không chỉ sau vài phép đo |

### 8b. Ba thứ chặn việc BÁN, ngoài ba task trên

1. **BU-1 — nội dung pháp lý.** `docs/legal/refund-policy.md` còn **3 chỗ trống**, và **chưa có trang
   Terms nào** dù R11 đòi 2 trang. Cổng C-15 đã ship ở trạng thái **ĐÓNG** kèm lý do đọc được, và Task
   4.5 chứng minh nó **độc lập** với cờ bán hàng — nên an toàn, chỉ là không bán được.
2. **OP-7** — bốn mã lỗi của `createOrder` dùng lại câu sẵn có. Tệ nhất: nhánh bắt-tất-cả `server` đọc
   *"Chưa tải được danh sách đơn của bạn"* — báo một lỗi **ĐỌC** trên một đơn **chưa từng được tạo**.
   Nay còn **nhánh thứ tám** `unauthenticated` mượn `profile.error.sessionExpired` từ namespace khác.
3. **OP-8** — hàng Loading của UI Spec C-03 chưa cài được. Trạng thái bận hiện **chỉ có `aria-busy`**,
   thứ gần như không được đọc trên một `<button>`.

### 8c. Sổ đăng ký nợ tài liệu — **18 mục, mỗi mục có người sở hữu**

Nằm trong `docs/plans/subscription-work-plan.md` § Progress Tracking. Đáng chú ý:

- **Mục 1 — Nhóm B**: ~40 neo `file:dòng` mục nát. **Cố ý KHÔNG sửa**, và tác nhân xác minh **đã hai
  lần phán quyết** điều đó tương thích với `mostly_consistent`, sau khi tự lấy mẫu và không tìm được
  neo nào trỏ vào mã vắng mặt hay sai.
- **Mục 17** — gỡ chốt thông tin đăng nhập probe, **nối với cổng B của Task 5.8**: một quyết định,
  hai thứ phụ thuộc.
- **Mục 18 — LỜI KHUYÊN VIẾT LẠI, đã chấp nhận** (xem §10).
- Hai mục ghi rằng **bản cài đặt MẠNH HƠN tài liệu** (cổng AC-021; `queries.test.ts` được thay bằng
  làn integration DB thật). Ghi theo chiều đó **có chủ đích** — ghi ngược lại sẽ mời người ta làm
  yếu một cổng cho khớp mô tả nó.

## 9. ⚠ Final Cleanup CHƯA LÀM — bị chặn quyền

Recipe đòi xoá task file đã tiêu thụ. **Thử hai cách, cả hai bị permission classifier chặn.** Không
thử tiếp (một lần từ chối là một lần từ chối).

**Việc còn lại**, trong `docs/plans/tasks/`:

- **XOÁ 55 file**: mọi `subscription-work-plan-*-task-*.md` và `subscription-work-plan-phase*-completion.md`
  và `_overview-subscription-work-plan.md`, **TRỪ** bốn file dưới.
- **GIỮ 4 file** — đây là **sai lệch có chủ đích so với recipe**, vì recipe giả định mọi task đã xong:
  `backend-task-28` (5.8 — nửa cổng B còn nợ), `backend-task-34` (6.7), `backend-task-35` (6.8),
  `frontend-task-15` (6.5). **Xoá chúng là xoá đặc tả của việc chưa làm.**
- **GIỮ** `docs/plans/subscription-work-plan.md`.

## 10. Bài học lớn nhất phiên này

**Năm vòng xác minh trên MỘT lớp khuyết tật, và vòng thứ năm kết luận đúng: dừng vá, viết lại.**

Lớp đó: một prop (`formattedResetDate`) bị Task 2.4 khai tử, nhưng frontend DD vẫn khẳng định nó tồn
tại. Đếm chỗ: **8 → 16 → 3 → 2 → 3 = 24**. Và **bốn vòng liên tiếp sửa trúng một mệnh đề rồi bỏ lại
anh em sinh đôi của nó TRONG CÙNG MỘT Ô BẢNG.**

Hai điều đáng mang đi:

**(a) Vì sao quét theo cụm từ và theo định danh đều trượt.** Khi một định danh bị khai tử, **nó là
thứ đầu tiên biến khỏi văn xuôi** — bị viết lại thành *"the prop"*, *"it"* — **còn vị từ phụ thuộc
vào nó thì ở lại nguyên**. Một chỗ bị bỏ sót **không chứa lần xuất hiện nào** của định danh. **Luật
mới: quét theo VỊ TỪ và theo NEO ĐƯỢC PHÂN GIẢI LẠI, và phân loại theo TỪNG CÂU, không theo từng lần
xuất hiện.**

**(b) Vì sao ngay cả luật đúng cũng thất bại ở đây, và đó là lý do phải viết lại.** Ô của
§ Interface Change Impact dài ~2.000 ký tự, ô X-13 ~5.000, mỗi ô chồng bốn lớp sửa lên văn xuôi thời
thiết kế — nên người đọc phải phân xử giọng nói **năm lần trong một ô**. **Phép phân loại theo từng
câu, vốn là luật đúng, chính là thứ mà một ô dài như thế đánh bại.** Nguyên nhân là **cấu trúc**,
không phải phương pháp.

Bản sửa được đề xuất, **có phạm vi và kiểm được kết cục**: viết lại ba ô mang `TutorQuotaNote` theo
lối **hiện-trạng-trước, một phụ lục lịch sử có ghi ngày, không đan xen**, và ghim lại neo trong chính
ba ô đó khi chúng đang mở. Mục 18 của sổ đăng ký.

**Không mệnh đề nào trong `SOURCE/` bị ảnh hưởng — MÃ VẪN ĐÚNG suốt từ đầu; chỉ phần MÔ TẢ nó là sai.**

---

**Không có lần deploy production nào của nhánh này đã xảy ra.** DDL đã lên prod; **mã thì chưa.**
