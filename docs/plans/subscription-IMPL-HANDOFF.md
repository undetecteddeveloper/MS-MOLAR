# Subscription — bàn giao pha THỰC THI (phiên 6)

**Viết 2026-08-20.** Phiên 1–2 đóng pha thiết kế; phiên 2 chạy bước 15→16→phân rã và 8 task đầu;
phiên 3 đóng Pha 1 và cổng chặn thủ công; phiên 4 chạy trọn Pha 2; phiên 5 đóng backend Pha 3.
Phiên này chạy **nốt frontend Pha 3 và TRỌN Pha 4: 34/50 task, Pha 0–4 ĐÓNG HẾT.**

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
| Vòng build | **34/50 xong. Pha 0 ✅ 1 ✅ 2 ✅ 3 ✅ 4 ✅ — còn Pha 5 (8) và Pha 6 (8)** |

**Hành động kế tiếp: mở `docs/plans/tasks/subscription-work-plan-backend-task-21.md`** (plan Task 5.1),
chạy qua giao thức vòng build ở §4. Chú ý **đổi làn lại**: Pha 5 và Pha 6 gần như toàn backend
(15/16 task còn lại), nên executor là `task-executor` và quality fixer là `quality-fixer` — **định
tuyến theo tên file, đừng suy đoán.** Đúng một task frontend còn lại: `frontend-task-15` (Task 6.5,
⚠ thủ công, cần người thật + Android thật).

**Cả hai điểm ★ xác minh sớm đã QUA.** Điểm thứ hai (Task 3.8) chạy phiên này trên browser thật —
chi tiết ở §5c.

## 2. Nhánh và commit

Nhánh **`feat/subscription`**. Cây làm việc **sạch**. Tổng: **5 commit dọn nền + 34 commit task
+ 1 commit dọn dẹp tài liệu + 1 commit đòn nền giữa chừng** (xem `e5b91e7` dưới).

Phiên 6 (11 commit, 10 task + 1 commit đòn nền):

| Commit | Task | Nội dung |
|---|---|---|
| `5ee4100` | 3.6 | S-05 `/me/orders`, C-07, C-08, hai file biên |
| `84e1a08` | 3.7 | C-10 `RecheckOrderControl` + C-11 `PlanSummary` + 19 khoá |
| `8e3230d` | 3.8 ★ | mount C-11 + chạy điểm xác minh sớm trên browser thật |
| `e5b91e7` | — | **đòn nền, KHÔNG có task file**: C-10 nhận `status`, có nhánh trạng thái kết thúc, được mount; UI Spec + frontend DD lên **v1.7** |
| `7d1bca5` | 3.9 | FE-3 — **Pha 3 đóng** |
| `70a5c31` | 4.1 | webhook payOS + mở `PUBLIC_PATHS` + mốc quét bundle |
| `1965164` | 4.2 | route S-06, luật đọc `?order=`, hai file biên |
| `7056168` | 4.3 | C-12…C-15 + khoá S-06 |
| `a5f3da8` | 4.4 | `PurchaseCta` → `createOrder()` + điều hướng |
| `a9fe8f9` | 4.5 | cổng pháp lý C-15 độc lập với cờ bán hàng |
| `f83efa6` | 4.6 | FE-1 — **Pha 4 đóng, làn fixture-e2e 3/3** |

## 3. ✅ CỔNG CHẶN TASK 1.3 ĐÃ QUA — quy trình phải lặp y hệt cho Task 5.8

**Kỹ sư đã chỉ định làm bằng Composio**, và nó chạy được. **Task 5.8 (`backend-task-28`, apply prod) dùng
lại nguyên quy trình này** — đừng phát minh lại.

- **Dev = `hynwleaxtbtjzkvpjsug`**. **Prod = `pebjdlbgbmizgfpuptjl`** (tên "MS-MOLAR-prod").
  `.mcp.json` trỏ PROD — đọc nhầm ref là kết luận nhầm môi trường. **`SOURCE/.env.local.prod-backup` giữ
  credential PROD, nằm ngay cạnh `.env.local`** — đừng bao giờ nạp nó hay trỏ một làn test vào nó.
- Công cụ: `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, tool slug **`SUPABASE_BETA_RUN_SQL_QUERY`**
  (chạy được DDL, đặt `read_only: false`). Toolkit `supabase` đã ACTIVE.
  **Tham số project là `ref`, KHÔNG phải `project_id`** — sai tên thì lỗi 400 "Following fields are missing".
- Trình tự đã dùng: liệt kê project để xác nhận đích → chụp trạng thái TRƯỚC → apply theo thứ tự phụ thuộc,
  **từng khối một** (API timeout khoảng 60s) → **kiểm catalog TRƯỚC khi ghi vân tay** → ghi vân tay **CUỐI CÙNG**.
  Vân tay đi cuối là cố ý: paste đứt giữa chừng thì DB thà không biết mình là bản nào, còn hơn khai nhận một
  bản nó chưa chạy hết.
- Kết quả trên dev: đủ 4 đối tượng; `npm run verify:schema` **8/8 xanh**; khoá ngoại **25 → 27**; vân tay
  `021dd1387945` apply lúc `2026-08-18T13:53:05.77815+00:00`.
- **Prod vẫn KHÔNG có bảng nào.** Đó là Task 5.8, chỉ chạy khi Pha 5 tới lượt.

## 4. Giao thức vòng build (bắt buộc, đừng rút gọn)

Mỗi task: **executor → [integration-test-reviewer nếu task lấp khung test] → quality-fixer →
orchestrator commit.**

| Mẫu tên | Executor | Quality fixer |
|---|---|---|
| `*-backend-task-*` | `task-executor` | `quality-fixer` |
| `*-frontend-task-*` | `task-executor-frontend` | `quality-fixer-frontend` |

**Orchestrator commit, subagent KHÔNG commit.** Viết câu đó vào mọi prompt.

**`requiresTestReview` KHÔNG tồn tại trong file task nào** — đừng grep nó. Luật thực dụng: chạy
integration-test-reviewer khi task **lấp một khung test đã đặt trước** (INT-*, FE-*, SVC-*). Phiên này
áp dụng cho 3.9 và 4.6, và **cả hai lần nó đều tìm ra khuyết tật thật.** Còn lại 8 task Pha 6 có
`backend-29`/`30` lấp SVC-1/SVC-2 → hai task đó bắt buộc phải qua vòng rà.

### 4a. Lớp lỗi tái phát — nay là 20 ca

**Tạo tác khẳng định một năng lực phân biệt mà nó không có.** Đếm chạy: 5 + 3 + 4 + 3 (phiên 2–5) +
**5 (phiên này)** = **20**.

Năm ca phiên này. **Ba ca do vòng rà độc lập tìm ra SAU KHI executor đã tự chạy đột biến và báo
"không con nào sống sót"**; hai ca do chính executor/quality-fixer tìm ra:

1. **FE-1 ca (d)** — chứng minh "mã đơn đọc được" bằng phép tìm văn bản **TOÀN TRANG**, mà phép đó
   được thoả mãn bởi **một phần tử KHÁC**: ô memo, vì memo chứa chính dãy số đó. Đột biến buộc mã đơn
   vào `qrPayload` **SỐNG SÓT CẢ REPO**: làn fixture 76 xanh **VÀ** `npm test` 1414 xanh. Hậu quả thật:
   đơn không có QR thì màn hình **không còn hiện mã đơn ở đâu cả**.
2. **FE-3, `router.refresh()`** — xoá đi thì cả 44 ca vẫn xanh. Trên sản xuất: người dùng kiểm tra lại
   một đơn đã trả, đọc "Đã thanh toán" trong khi huy hiệu ngay trên vẫn ghi "Chờ thanh toán" và C-11 vẫn
   ghi "Free" — **mãi mãi**, cho tới khi tự tải lại trang. Đúng cái lệch C-11/dòng mà UI-D16 sinh ra để chặn.
3. **FE-3, câu sr-only pha BẬN** — đổi sang bất kỳ câu kết cục nào khác thì 44 ca vẫn xanh. Người dùng
   màn hình đọc nghe "Số tiền nhận được không khớp" **trong khi lượt gọi còn đang bay** — một thất bại
   thanh toán bịa ra, công bố trước khi có kết quả.
4. **Task 3.6, log digest** — ca kiểm so `JSON.stringify(args)` nên **không bác bỏ được**
   `console.error(msg, { error })`: `digest` là thuộc tính *enumerable* còn `Error#message` thì không,
   nên dạng bọc cả đối tượng vẫn chứa digest và giấu message. Executor tự tìm ra, tự vá.
5. **Task 4.2, phép quét `whitespace-nowrap`** — `li.querySelectorAll()` chỉ khớp **HẬU DUỆ**, nên
   `nowrap` đặt trên chính thẻ `<li>` chưa bao giờ bị bắt, trong khi comment vừa thêm lại khẳng định là có.
   Quality-fixer tìm ra.

**Bài học phiên này, viết vào prompt: khi ca kiểm khẳng định "X hiện trên màn hình", hỏi ngay CÒN PHẦN
TỬ NÀO KHÁC trên trang mang cùng chuỗi đó không.** Ca (d) và ca 5 là cùng một lớp: phép khẳng định có
phạm vi rộng hơn thứ nó định đo. Cách vá: đọc đúng ở node sở hữu giá trị (`span.select-all` của C-13),
đừng đọc `textContent` toàn trang.

### 4b. Cách viết prompt có hiệu quả

Yêu cầu executor: (a) quan sát **ĐỎ thật** trước khi xanh, (b) nêu rõ mỗi ca kiểm bác bỏ những **bản cài đặt
sai NÀO**, (c) chạy **đột biến** trên bản sao trong bộ nhớ rồi khôi phục, (d) **một giá trị kỳ vọng DẪN TỪ
CHÍNH THỨ ĐANG KIỂM thì không chứng minh gì**, (e) khi ca kiểm chạm hai trường cùng kiểu, **bắt buộc gieo
hai giá trị KHÁC NHAU**.

**Bổ sung phiên này, ba điều:**

- **Sản phẩm đã ship rồi thì ĐỎ chỉ đến từ đột biến.** Bảo executor nói thẳng điều đó thay vì trình một
  lỗi phân giải import như thể là ĐỎ từng-ca. Task 4.6 làm đúng và bản báo cáo hữu ích hẳn.
- **Bắt executor tự kiểm NEO của đột biến có khớp đúng một lần không.** Một đột biến không ăn neo trông
  **y hệt** một đột biến sống sót. Đã lừa được ba tác nhân trong phiên này. Và một đột biến **tương đương
  về ngữ nghĩa** cũng thế: một tác nhân đổi bí danh import + đổi tên thẻ JSX, neo khớp, file đổi thật,
  nhưng `element.type` phân giải y như cũ → 9 ca vẫn xanh, đọc như một con sống sót.
- **"Trả về 200" / "có render" / thuộc tính ARIA gần như vô giá trị làm khẳng định.** Ở webhook, route trả
  200 cho **cả** chữ ký đúng lẫn sai; thứ phân biệt là **số lượt I/O**. Ở nút Mua, với đột biến "không bao
  giờ nhả chốt", ba khẳng định `aria-disabled` / không-`disabled`-gốc / Tab-tới-được **ĐỀU XANH** — chỉ
  phép đếm bắt được một nút Mua chết vĩnh viễn. **Đếm số lượt gọi, đừng đọc trạng thái đã render.**

### 4c. Tiền lệ orchestrator

- **Vòng rà trả `needs_revision` thì quay lại executor bằng một lần gọi Agent MỚI**, không SendMessage.
- Nếu vòng rà nêu đích danh N con đột biến và executor đã giết đủ N kèm đầu ra thật, **bỏ qua vòng rà thứ ba**
  (3.9 và 4.6 đều làm thế, không mất gì). Nhưng hãy trỏ quality-fixer thẳng vào phần **cấu trúc** của bản vá.
- **Prettier KHÔNG phải cổng** (không script nào gọi). `npm run lint` là `eslint --max-warnings 0`. Đừng bắt
  agent reformat — và ca (h) của INT-2 khẳng định trên **văn bản nguồn** của `queries.ts`, nên reformat file
  đó sẽ làm nó đỏ.
- **Khi một tác nhân chết giữa chừng vì lỗi kết nối**, đừng chạy lại từ đầu: kiểm `git status` + chạy lại làn
  test để lấy sự thật, rồi **SendMessage** cho chính nó để lấy nốt báo cáo. Ngữ cảnh của nó còn nguyên.
  Task 4.6 mất 85 lượt gọi công cụ, phục hồi trọn vẹn bằng một tin nhắn.

## 5. Làn test và nền xanh (số phải tái lập được TRƯỚC khi tin thay đổi của chính mình)

### 5a. Nền xanh hiện tại

| Lệnh (chạy trong `SOURCE/`) | Kết quả phải tái lập |
|---|---|
| `npm test` | **1414 pass / 10 skip** (117 file pass, 1 skip) |
| `npm run test:fixture` | **77 pass, exit 0** — FE-1 + FE-2 + FE-3, **làn đủ 3/3** |
| `npm run test:integration` | **16 pass, exit 0** — chạm dev thật |
| `npx tsc --noEmit` | **0** |
| `npm run lint` | sạch |
| `npm run check:bundle` | exit 0 |
| `npm run build` | **XANH, 24/24 trang** — nhưng **phải tắt sandbox** (xem §6) |
| `npm run test:localdb` | **vẫn exit 1**, "No test suite found in file" |

- `test:localdb` exit 1 là **CỐ Ý** (khung Pha 6 chỉ có comment). **Đừng bao giờ thêm `--passWithNoTests`.**
- **Hai flake đã biết, đừng đuổi:** `components/tutor/ExplainStepAffordance.test.tsx` và
  `app/(layer2)/__tests__/recordSkillMastery.int.test.ts` — cả hai vượt mốc 5000ms khi chạy song song lúc
  cache lạnh; chạy riêng đều xanh trong vài giây. Con thứ hai **mới phát hiện phiên này** và đáng lưu ý hơn:
  nó chạm **Postgres dev thật ngay trong làn `npm test`** với timeout mặc định 5s.
- Sau mỗi lần chạy làn integration, **`payment_orders` trên dev phải về 0 dòng**. Phiên này kiểm sau mọi lượt.
- Cả ba làn đều **độc lập thứ tự**: làn fixture đã chạy `--sequence.shuffle.tests` với 5 hạt giống, đều 77/77.

### 5b. Bẫy môi trường: múi giờ

Máy dev chạy **`TZ=Asia/Saigon`** — đúng múi giờ mà `lib/format/datetime.ts` ghim (`Asia/Ho_Chi_Minh`). Một
formatter **không ghim** vẫn render y hệt **ở đây** và xanh vô cớ, trong khi Vercel chạy UTC. Khi viết ca kiểm
chạm ngày/giờ: chọn instant **khác NGÀY LỊCH** giữa UTC và ICT (ví dụ `2026-08-18T17:30:00.000Z`), đừng chọn
instant chỉ khác giờ.

### 5c. ★ Điểm xác minh sớm thứ hai — ĐÃ QUA, đo bằng số

Chạy trên `next dev` thật + dev DB thật, đăng nhập bằng `smithnguyen247+rlstesta@gmail.com`. Gieo 3 đơn
**CỐ Ý chèn sai thứ tự** (102, 101, 103) để một phép sắp xếp thiếu sẽ lộ ra trên màn hình:

- thứ tự dòng: `5500000000103`, `…102`, `…101` — mới nhất trước ✅
- mốc thời gian: `19/08/2026 19:30`, `17/08/2026 19:35`, `10/08/2026 19:35` — đúng ICT, mỗi cái là UTC + 7h,
  **không cái nào lệch NGÀY** ✅
- số tiền `39,000 VND` (en) / `39.000 VNĐ` (vi); `orderCode` vẫn là chuỗi số thô ở **cả hai** ngôn ngữ —
  quyết định nhất là ở `vi`, nơi số tiền trong **cùng đoạn văn** được chấm nhóm còn mã đơn thì không ✅
- **C-11 hiện PREMIUM, không phải Free** — điều kiện DỪNG thứ nhất không kích hoạt ✅
- 360px: `scrollWidth` 360, `clientWidth` 360, **tràn 0px**, 0 phần tử rộng hơn khung nhìn ✅
- quét bàn phím 13 điểm dừng, khép vòng, không chỗ nào dùng `disabled` gốc ✅

**Quy trình gieo/dọn** (lặp lại được cho Task 6.5): seed bằng Composio `SUPABASE_BETA_RUN_SQL_QUERY` trên dev,
quan sát bằng `npm run pw` (`resize`, `eval`, `snapshot`, `press`), rồi **xoá sạch dòng gieo TRƯỚC khi chạy
cổng chất lượng** — làn integration khẳng định `payment_orders` về 0 dòng, nên để sót là làm đỏ oan.

## 6. Sự thật môi trường (tốn thời gian để phát hiện lại)

- **`TaskCreate` / `TaskUpdate` KHÔNG tồn tại.** Mọi agent sẽ báo thiếu. Bảo agent bỏ lệnh gọi đó nhưng vẫn làm
  phần việc bên dưới. **Hệ quả cho orchestrator: bước "đăng ký toàn bộ flow bằng TaskCreate" mà recipe bắt buộc
  là KHÔNG làm được** — theo dõi vị trí bằng `_overview-subscription-work-plan.md` + file này, và **nói thẳng
  với người dùng** thay vì lặng lẽ bỏ.
- **`next build` TREO vô hạn dưới sandbox mặc định** (turbopack node transform pool). **TREO chứ không FAIL.**
  Chạy với `dangerouslyDisableSandbox: true` thì **xanh trong khoảng 6 giây, 24/24 trang** — phiên này chạy
  thật hai lần. `next dev` cũng vậy: tắt sandbox thì "Ready in 4.1s".
- **Bẫy cwd của runner, HAI dạng khác nhau — đừng lẫn:**
  - `cwd` dùng **dấu gạch ngược** (`E:\StemWeb_project\…`) làm `spawnSync` lỗi `ENOENT` **trong im lặng**:
    `status` về `null` kèm báo cáo rỗng, **đọc y hệt một làn đã pass**. Dùng `E:/StemWeb_project/…`.
  - `cwd` dùng **chữ ổ đĩa THƯỜNG** (`e:/…`) làm Vite phân giải module id khác npm, và `vi.mock("server-only")`
    **trượt trong im lặng**. Luôn viết hoa `E:`.
- **`2>&1` trong `execSync` làm HỎNG exit code**, và **đọc exit code qua ống dẫn cũng thế** (`| tail` trả trạng
  thái của `tail`, nên `test:fixture` đọc ra 0 bất kể thật sự thế nào). Đọc trạng thái thật bằng `spawnSync` trên
  `node_modules/vitest/vitest.mjs`.
- **Bash tool bọc lệnh trong nháy đơn**, nên **nội dung có dấu nháy đơn phá cú pháp shell**. Viết file dài bằng
  Write tool. Commit message tránh dấu nháy đơn.
- **App root là `SOURCE/`**, không phải gốc repo. `SOURCE/AGENTS.md` cảnh báo bản Next.js này khác dữ liệu huấn luyện.
- `test-rls.ts` chạy độc lập bằng `npx tsx supabase/test-rls.ts` (93 phép kiểm), **không** qua vitest.
- **`npm run verify:schema` = `npx tsx supabase/verify-schema.ts`**, độc lập, chạm DB thật — **không** nằm trong
  `check:bundle`. Script ở `SOURCE/package.json:15` (task file ghi `:13`, sai).
- **Vitest không có `setupFiles` ở BẤT KỲ làn nào:** không có matcher `jest-dom`; jsdom khai theo từng file bằng
  chỉ thị `@vitest-environment jsdom` ở **dòng 1**; `render()` **không** tự cleanup.
- **`render(await Component())` cho ra CÂY RỖNG trong im lặng** khi component được await có con async. Dùng
  `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`, hoặc `resolveServerTree()` trong làn fixture.
- **`react-hooks/purity` báo lỗi khi gọi `Date.now()` trong thân component** dưới `--max-warnings 0`.
  `OrderRow.tsx` cho hình dạng đã được chấp nhận: một vị từ đặt tên ở phạm vi module kèm docblock.
- Import thừa là **lỗi chí mạng** dưới `eslint --max-warnings 0`.
- **Ghi tiến độ: Notion qua Composio, database `3b378ba6-ae12-803c-8500-c572b6fc745f`.** `PROCESS.md` đã bị xoá
  khỏi repo. Phiên 4 không có dòng nào; phiên 5 và 6 đều đã ghi.

## 7. Phiên bản tài liệu hiện tại

| Tài liệu | Phiên bản |
|---|---|
| `docs/prd/subscription-prd.md` | v1.6 |
| `docs/ui-spec/subscription-ui-spec.md` | **v1.7** — thẩm quyền về UI; v1.7 sửa mâu thuẫn props C-10 |
| `docs/design/subscription-backend-design.md` | **v1.9** |
| `docs/design/subscription-frontend-design.md` | **v1.7** |
| `docs/plans/subscription-work-plan.md` | **v1.3** |

`SOURCE/lib/billing/types.ts` là **hợp đồng đóng băng** — sửa nó phải sửa UI Spec trước, kèm lý do.

Frontend DD cố ý vẫn trỏ **UI Spec v1.2** ở mục "Referenced UI Spec" — đó là bản mà thiết kế đã tiêu thụ, kèm
bảng liệt kê delta v1.3→**v1.7** và quy tắc bác bỏ. **Đừng "sửa" ghim đó.** Quy tắc của chính bảng ấy là "một
bản UI Spec mà KHÔNG thêm được vào bảng thì phải dời ghim" — v1.7 thêm được, nên ghim đứng yên là đúng.

### 7a. Vì sao UI Spec lên v1.7 (quyết định của phiên này, kỹ sư uỷ quyền)

UI Spec **tự mâu thuẫn** về C-10: đóng băng props ở `{ orderCode, variant }`, nhưng **cùng mục đó**, hành vi
điểm 5 lại đòi ở `paid`/`expired`/`cancelled` nút vẫn còn trong cây, mang `aria-disabled="true"` kèm một lý do
buộc qua `aria-describedby`. Hai props không phân biệt được `paid` với `pending`.

**Giải theo vế HÀNH VI**: ma trận State × Display mô tả cái người dùng trải nghiệm, còn dòng Props chỉ là chi
tiết cài đặt *của chính nó*. Nên: thêm prop `status: string` (để kiểu `string` chứ **không** phải union bốn
literal, giống `queries.ts:44`, để một lần đổi CHECK không thể tới tay người dùng dưới dạng hiện sai);
**KHÔNG thêm khoá từ điển nào** — `billing.recheck.notPending` sẵn có đọc đúng là câu spec cần; và sửa **cả hai**
tài liệu lên v1.7 để mã và tài liệu không nói ngược nhau.

**Trạng thái KHÔNG NHẬN RA thì KHÔNG phải trạng thái kết thúc** (FE-AC-10, bảng C-09 ghi thẳng) — nên
`status !== "pending"` là một vị từ **SAI**, và có ca kiểm bắt đúng nó.

## 8. Việc mở thuộc về kỹ sư

### 8a. BU-1…BU-6 (không đổi)

| # | Mục | Chặn gì |
|---|---|---|
| **BU-1** | **TBD-02 nội dung pháp lý** | **bật bán + test webhook tiền thật.** `docs/legal/refund-policy.md` còn 3 chỗ chưa điền; **chưa có bản Terms nào** dù R11 đòi 2 trang. Cổng C-15 đã ship ở trạng thái ĐÓNG kèm lý do đọc được, và Task 4.5 chứng minh nó độc lập với cờ bán hàng |
| **BU-2** | ADR-0018 thư viện QR | không chặn gì. C-12 ship ở trạng thái "chưa có bộ mã hoá" **đúng như spec mô tả**, giữ một đường nối `encodeQrMatrix()` trả `null`; ngày ADR về, chỉ thân hàm đó đổi |
| **BU-3** | E-01 phạm vi AC-034 | không chặn gì |
| **BU-4** | U2 đơn giá thật | **bật bán** — chặn qua BU-6 |
| **BU-5** | Metric #9 baseline | **bật bán** — truy vấn `telemetry_log` 14 ngày, phải chạy TRƯỚC khi bật bán (AC-055) |
| **BU-6** | **Đích ghi bền cho AI usage chưa được thiết kế** | **Task 1.6** (không sinh file thực thi), rồi BU-4 |

Chuỗi: **BU-6 → Task 1.6 → BU-4 → Task 6.8.** Không gì trong Pha 2–5 phụ thuộc nó. **Cấm mọi task tự chọn sink.**

### 8b. Việc mở mang mã OP-* (chỉ dùng trong file này)

| # | Mục | Cần input gì để gỡ | Ai sở hữu |
|---|---|---|---|
| **OP-1** | `FIXTURE_ENTITLEMENT_KNOWN` / `_EXHAUSTED` mô tả hình dạng người dùng backend KHÔNG tạo ra được (`plan: "free"` nhưng `FIXTURE_TUTOR_LIMIT = 500`) | Sửa số cho khớp một plan **và** sửa kèm mọi khẳng định ghim theo số đó, hay giữ nguyên và ghi lý do | **Vô hại** và **cố ý KHÔNG sửa** — nay FE-1, FE-2 **và** FE-3 đều ghim theo chính con số này |
| **OP-2** | `ADR-0015` mang lớp mục nát trích dẫn `schema.sql`: `:1574`, `:1385`, `:1429`, `:1513`, `:1009-1015` | Một đợt vệ sinh tài liệu **đọc lại từng neo trong file rồi mới vá** | Đợt vệ sinh tài liệu kế tiếp |
| **OP-3** | Adapter chỉ ánh xạ ba literal trạng thái repo ghi nhận; giá trị khác về `"unknown"` (fail-closed) | **Một lần giao THẬT ở plan Task 6.7.** `toPaymentStatus()` là đúng một dòng cần sửa | Task 6.7 |
| **OP-4** | Backend DD tự mâu thuẫn về đầu vào HMAC: Consumer Parse Rule nói "raw body bytes", Serialized Format lại quy định canonicalisation. **Đã xác nhận lại ở Task 4.1: MÃ ĐÚNG, CÂU CHỮ SAI** | Sửa câu chữ DD cho khớp bản cài đặt (adapter nhận `rawBody: string`, parse ĐÚNG một lần, không tuần tự hoá lại) | Đợt vệ sinh tài liệu — **khuyết tật câu chữ**, không phải code |
| **OP-5** | Chứng minh RLS thật cho phép kiểm chủ sở hữu của `recheckOrder` **chưa có** | Không cần input — **đã có chỗ**: plan Task 6.2 / SVC-2 | Task 6.2. **Đừng tính nghĩa vụ đó là đã hoàn thành** |
| **OP-6** | `PAYMENT_ORDER_CHECKOUT_COLUMNS` ở `service-role.ts:469-472` có comment "một lời khai cho HAI chỗ đọc"; nay là chỗ thứ ba | Sửa con số trong comment | Bất kỳ task nào chạm `service-role.ts`. **Không hành vi nào phụ thuộc** |
| **OP-7** | **MỚI. Bốn mã lỗi của `createOrder` dùng lại câu sẵn có** vì ngân sách i18n không cấp khoá nào cho thất bại mua hàng. Tệ nhất là nhánh **bắt-tất-cả `server`** hiện đọc *"Chưa tải được danh sách đơn của bạn"* — báo một lỗi **ĐỌC** trên một đơn **chưa từng được tạo**; kế đó `rate_limited` dùng động từ "kiểm tra lại" trên một nút **Mua** | Cấp 1–4 khoá `billing.cta.*` trong **cả hai** từ điển | **Phải đóng TRƯỚC khi bật `GEMINI_PAID_TIER_ENABLED`.** Hôm nay không ai thấy được vì cờ tắt nên nút trơ |
| **OP-8** | **MỚI. Hàng Loading của UI Spec C-03 chưa cài được**: đòi `aria-disabled` dạng chuỗi + một mốc `aria-describedby` đổi nội dung, mà cả hai nằm ở `PurchaseCta.tsx:29` và `:32` — **đang bị đóng băng** bởi task file, work plan và frontend DD | Gỡ đóng băng hai dòng đó | **Phải đóng TRƯỚC khi bật bán.** Trạng thái bận hiện chỉ có `aria-busy`, **không ai cảm nhận được** — không hình ảnh, và `aria-busy` trên một `<button>` thường ít được đọc |
| **OP-9** | **MỚI. Một con đột biến SỐNG SÓT ở Task 3.8**: provider **có mặt** nhưng **không bọc** `children` thì cả 4 ca mount vẫn xanh, vì cả 4 khẳng định trên **văn bản nguồn**. Kịch bản thảm hoạ (đặt nhầm route group) **thì bị bắt** | Một ca render thật RootLayout → `(billing)/layout` → page với `readEntitlement` bị stub | Lỗ hẹp, đã ghi tại chỗ. Nhà của nó là làn fixture |
| **OP-10** | **MỚI. Hai chỗ sổ sách đã cũ**: `frontend-task-07.md:125` vẫn ghi "Props frozen at `{ orderCode, variant }`" (nay đã có `status`), và bảng delta của frontend DD | Thêm ghi chú "đã bị thay thế bởi v1.7", **đừng sửa lời khai gốc** — nó là bản ghi kiểm toán của một task đã xong | Đợt vệ sinh tài liệu |
| **OP-11** | **MỚI, hai lỗ ở `PUBLIC_PATHS`/quét bundle, CẢ HAI CÓ TỪ TRƯỚC**: (a) một đường GHI **ngoài `/api`** vẫn có thể bị xếp nhầm vào nhóm ĐỌC mà không ca nào đỏ — chuỗi path không nói lên nó phục vụ GET hay POST; (b) **danh sách mốc** của `check-ai-key-bundle.mjs` không có ca kiểm nào, nên xoá một mốc thì không đâu đỏ, mà **trong CI danh sách mốc là toàn bộ tấm lưới** (CI build bằng giá trị giả nên nhánh quét-giá-trị không bao giờ nổ) | (a) quét `app/**/route.ts` tìm export POST/PUT/PATCH/DELETE rồi đối chiếu; (b) một unit test trên bảng SECRETS | Không chặn gì hôm nay |
| **OP-12** | **MỚI. Hai vị từ ở Task 4.5 chỉ được giữ bằng khẳng định văn bản nguồn** (ghim cứng `false`, và `every`→`some`) vì **tương đương về hành vi** khi chưa khoá pháp lý nào tồn tại | Sau khi BU-1 về: thêm một khoá lúc chạy → khẳng định vẫn `false` (giết `some`); thêm cả hai → khẳng định lật `true` (giết ghim cứng). **BẪY: khôi phục phải dùng `delete en[key]`, KHÔNG được gán `undefined`** — vị từ là `key in en`, và một khoá giá trị `undefined` vẫn thoả `in` | Sau BU-1 |

## 9. Nợ kỹ thuật và việc dọn còn nợ

- **Transcription drift — đã trả phần lớn.** Còn nợ: `subscriptionFixtureData.ts:203` vẫn chép tay `39_000`.
- **Trích dẫn `schema.sql`:** phần backend DD + work plan đã vá ở `c435bce`. **`:1381-1382`, `:887-888`,
  `:1303-1304`, `:1268`, `:1361` và mọi thứ phía trên VẪN ĐÚNG** — bàn giao phiên 3 ghi `:1381-1382` là mục nát,
  **điều đó SAI**, đã xác minh lại hai lần. Phần còn nợ là OP-2.
- **`docs/plans/subscription-backend-work-plan.md:50`** (bản **đã bị thay thế**) vẫn bảo implementer chọn sink —
  đúng cái BU-6 sinh ra để chặn. **Chờ kỹ sư: vô hiệu hoá hay lưu trữ.**
- **Checkbox trong `phase0..4-completion.md`** còn ô trống dù task đã xong — chỉ là sổ sách, Final Cleanup sẽ xoá.
  Nội dung cổng đã verify thật.
- **`backend-task-13.md`**: mục "Exit-gate evidence" liệt kê bộ ca TRƯỚC vòng revision (16 checks); mục
  "Revision after integration-test-reviewer" mới là bộ cuối (20 checks). Task 6.4 re-walk nên biết.
- **Bàn giao trong code còn hiệu lực:** Task 5.1 sở hữu cách mã hoá `AI_BUDGET_FREE_SHARE` (phân số 0.5 hay
  phần trăm 50 — chưa tài liệu nào nêu; `checkEnv` cố ý chỉ kiểm "số hữu hạn lớn hơn 0").
- **`recordPaymentSettlement` KHÔNG truyền `p_period_days`**, dựa vào PostgREST phân giải tham số mặc định của
  SQL. Cố ý. **Lần đầu chạm Postgres thật là plan Task 6.1 / SVC-1** — nếu sai thì sai ở đó.
- **`badgeTextIn()` trong làn fixture ném lỗi mang tiền tố `FE-3:`** dù nay FE-1 cũng gọi nó — một ca FE-1 đỏ sẽ
  báo nhãn FE-3. Chỉ là câu chữ; task nào chạm helper đó tiếp thì sửa.

## 10. Thứ tự chạy còn lại (16 task)

Từ `docs/plans/tasks/_overview-subscription-work-plan.md`:

- **Pha 5** (8, **toàn backend**): `backend-21` → `backend-27`, **`backend-28` ⚠ apply prod (Task 5.8 — quy trình ở §3)**
- **Pha 6** (8): `backend-29` → `backend-33`, **`frontend-15` ⚠ thủ công, cần người + Android thật**,
  **`backend-34` ⚠ tiền thật**, **`backend-35` ⚠ bật bán**

**Pha 5 là lần ĐẦU TIÊN được phép deploy production** — và chỉ sau khi Task 5.8 apply xong DDL lên prod, gate B
xanh trên prod, **xác minh bằng một truy vấn ĐẾM THẬT, không phải so vân tay**. Trước đó, mọi task đều giữ dòng
"Không có lần deploy production nào của nhánh này đã xảy ra" trong Completion Criteria.

Hai cổng nữa ở Pha 6: **Task 6.2 (SVC-2) phải qua TRƯỚC khi S-05 tới tay người dùng thật**; **Task 6.8 phải qua
TRƯỚC khi bật nút mua**.

## 11. Sau khi hết 50 task

Recipe đòi, đừng bỏ:

1. **code-verifier ×2** (một lần mỗi Design Doc, `doc_type: design-doc`) + **security-reviewer**, chạy **song song**.
2. Đạt: code-verifier `consistent`/`mostly_consistent`; security-reviewer `approved`/`approved_with_notes`.
   Trượt → gộp phát hiện thành 1 task file → executor → quality-fixer → chạy lại **chỉ** verifier đã trượt.
3. **Final Cleanup**: xoá `docs/plans/tasks/subscription-work-plan-*-task-*.md`, `*-phase*-completion.md`,
   `_overview-subscription-work-plan.md`. **Giữ** work plan.

**Lưu ý cho security-reviewer:** nhánh này nay có **đường GHI chưa-đăng-nhập đầu tiên của dự án**
(`/api/payments/payos/webhook`, ADR-0017 đi từ 0 lên 1). Trỏ thẳng nó vào đó, kèm OP-11.
