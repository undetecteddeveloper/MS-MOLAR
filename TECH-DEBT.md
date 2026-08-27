# Technical Debt Register

Sổ ghi nợ kỹ thuật — CHỈ dùng để ghi nhận nợ, không phải nơi thiết kế giải pháp.
Mỗi mục: nó là gì, tại sao chấp nhận, và cái gì sẽ nổ nếu quên.

Không ghi vào đây: lỗi bảo mật đang mở (thuộc `docs/security-review-*.md`), cảnh
báo đã tự viết trong header của chính file code, và những lệch pha không có
đường nào chạm tới được trong thực tế. Ghi mục mới lên ĐẦU phần "Đang mở"; khi
trả nợ thì CHUYỂN mục đó xuống "Đã trả" (không xoá — bối cảnh của một món nợ đã
trả vẫn có giá trị tra cứu sau này) kèm ngày trả và cách verify.

*(Trước 2026-08-07, quy trình này ghi "xoá mục khi đã trả nợ, ghi lại trong
PROCESS.md" — file đó đã bị xoá. Tiến độ theo phiên nay ghi ở Notion (database
MS-MOLAR), còn sổ nợ này CHỈ ghi nội dung nợ như tiêu đề file đã nói — không
còn nơi nào khác giữ lịch sử nợ ngoài chính file này.)*

---

## Đang mở

> **2026-08-27 — hai mục dưới đây còn mở LÀ DO ENGINEER QUYẾT ĐỊNH, không phải
> do chưa ai đụng tới.** Cả hai bị chặn bởi một khoản chi hoặc một credential mà
> chỉ engineer cấp được; khi được hỏi thẳng trong phiên đó, engineer chọn "để
> mở". Ghi lại vì nếu không thì phiên sau sẽ đọc chúng như việc bị bỏ quên rồi đi
> làm lại đúng cuộc thảo luận này.
>
> - **TD-013**: đã kê 4 đường (Upstash chặn theo IP trong `proxy.ts` — $0, ship
>   được ngay, nhưng function đã bị gọi rồi mới từ chối được / Cloudflare free —
>   $0, chặn ở biên thật, đổi DNS / Vercel Pro ~$20/tháng — cấu hình thuần / để
>   mở). Chọn: **để mở**.
> - **TD-005**: đã kê 3 đường (dựng Supabase CLI migrations kèm mật khẩu DB cả
>   hai project / chỉ scaffold + runbook, engineer tự chạy / để mở). Chọn: **để
>   mở** — cơ chế PHÁT HIỆN lệch (fingerprint `schema_version` + test CI + check
>   lúc khởi động) vẫn đang chạy và vẫn bắt được drift.

### TD-013 — Không có rate limit nào cho lưu lượng CHƯA đăng nhập
**Từ:** 2026-08-07 (tách ra khi trả TD-008; trước đó nằm lẫn trong mục đó)
**Loại:** phòng thủ còn thiếu hẳn một mảng, có vật cản cụ thể

TD-008 đã trả xong phần "trần chính xác theo user across-instance". Phần này là
mảng còn lại, và nó KHÔNG phải cùng một bài toán: mọi guard hiện có đều khoá
theo `user.id`, nên **một client chưa đăng nhập không bị đếm bởi bất cứ thứ gì.**
Redis không sửa được — không có khoá để đếm.

**Vật cản, đo 2026-08-07:** project `ms-molar` ở plan **Hobby**.
`vercel firewall overview` trả `IP Bypass is unavailable for this plan (404)`;
Firewall custom rules + rate limit ở biên cần **Pro** (~$20/tháng). Đây là nợ
chặn bởi QUYẾT ĐỊNH CHI PHÍ, không phải bởi việc chưa ai viết code — đừng đi tìm
cách lách bằng code ứng dụng, vì mọi thứ chạy trong function thì đã tốn tiền và
tốn thời gian trước khi kịp từ chối.

**Sẽ nổ thế nào:** không phải lỗi sai kết quả mà là hoá đơn và thời gian chết —
một vòng lặp nện `/exams` hay `/login` sẽ đốt invocation cho tới khi hết hạn mức
Hobby, rồi site tắt. Mức độ hiện tại thấp vì site chưa có ai chú ý tới; nó tăng
đúng lúc site bắt đầu có người dùng, tức là đúng lúc tệ nhất.

**Cách trả:** nâng Pro rồi cấu hình Vercel Firewall rate limit (config, không
phải code), hoặc đặt site sau Cloudflare free tier — cái sau không tốn tiền
nhưng đổi DNS và thêm một tầng vào đường đi.

### TD-005 — `schema.sql` áp bằng tay, không có migration tool
**Từ:** trước 2026-08-03 (nợ cũ, ghi lại cho rõ)
**Loại:** vận hành
**Trạng thái:** **đã trả PHẦN PHÁT HIỆN (2026-08-07)** — phần QUẢN LÝ vẫn nguyên

> **Cập nhật 2026-08-07 — nợ này đã nổ thật, lần thứ ba.** Bản vá cascade
> 2026-08-04 (bug xoá đề) chỉ được áp lên **prod**. Trên **dev**,
> `exam_attempts.exam_id` và `attempt_answers.question_id` vẫn là `no action`
> suốt 3 ngày: Preview deploy (trỏ dev) vẫn chết `23503` khi xoá đề, trong khi
> tsc, vitest, `next build` và CI đều xanh. Không cổng nào biết hỏi câu "DB này
> đang ở bản nào". Cùng lúc phát hiện §16 **chưa từng được apply lên bất kỳ DB
> nào** — cảnh báo ⚠ cũ ở mục này là đúng, không phải đã cũ.
>
> **Đã trả phần phát hiện:** `schema.sql` §17 tạo `public.schema_version` và tự
> ghi VÂN TAY của chính nó vào đó ở câu lệnh CUỐI CÙNG của file (paste đứt giữa
> chừng thì không ghi gì — DB thà không biết còn hơn khai nhận một bản nó chưa
> chạy hết). Ba cổng đọc vân tay đó:
> - `lib/schema/__tests__/schemaFingerprint.test.ts` — so ba bên (hằng số TS ↔
>   giá trị §17 khai ↔ giá trị tính lại từ nội dung). Chạy trong CI, không cần
>   DB, không cần credential. Sửa schema.sql mà quên cập nhật vân tay → FAIL kèm
>   đúng giá trị phải dán vào.
> - `verify:schema` mục 7 — so với DB THẬT.
> - `instrumentation.ts` → `lib/schema/checkSchemaVersion.ts` — chạy lúc server
>   khởi động. Phân biệt `mismatch` với `unknown` (mất mạng ≠ lệch bản): gộp hai
>   cái là cách nhanh nhất giết một cổng bằng báo động giả. Fail-open, không
>   throw — cùng quyết định với TD-009.
>
> Vân tay băm phần THỰC THI (bỏ comment, gộp khoảng trắng), có chủ đích: file
> này viết rất nhiều comment giải thích, nếu mỗi dòng chữ thêm vào lại đòi paste
> lại 2 DB thì cổng sẽ bị tắt đi vì nhiễu. Đổi một chữ trong `on delete`, hay
> một dòng trong thân hàm `$$...$$`, thì vân tay đổi.
>
> Là VÂN TAY chứ không phải số phiên bản người tự tăng, vì số tự tăng vẫn quên
> được — mà quên chính là hình dạng của nợ này.
>
> **Đã áp và xác minh 2026-08-07:** dev + prod cùng ở `bbe1ee9326c9`. `verify:schema`
> trên dev xanh cả 7 mục. Kèm theo: bỏ bước swap file `.env` bằng tay khi kiểm
> prod — `verify-schema.ts` nay nhận `SCHEMA_ENV_FILE`.
>
> **VÌ SAO MỤC NÀY CHƯA XOÁ:** cái vừa dựng là cơ chế **phát hiện** lệch, KHÔNG
> phải migration tool. Không có thứ tự áp, không rollback, không biết đi từ bản A
> sang bản B. Nó trả lời đúng một câu — "DB này có chạy đúng file trong git
> không?" — và im lặng về mọi câu khác. Trả nợ trọn vẹn vẫn là Supabase CLI
> migrations (cần DB password của cả 2 project).

`schema.sql` idempotent và được paste tay vào Supabase SQL Editor. Không có bản
ghi "môi trường nào đang ở phiên bản nào", không có thứ tự áp, không rollback.

**Sẽ nổ thế nào:** một bản vá bảo mật nằm trong git mà chưa hề chạy trên prod —
code và DB lệch nhau, không có gì báo. Đúng chuyện đã xảy ra với bản vá §10: code
đã chuyển sang RPC trong khi DB còn chưa có hàm.

**Đã giảm nhẹ:** `npm run verify:schema` (`SOURCE/supabase/verify-schema.ts`) so
schema.sql với hành vi thật của DB cho phần khoá đáp án (§10) và khoá ghi điểm
(§11), fail kèm chỉ dẫn. Nó soi MÃ LỖI chứ không chỉ "có lỗi hay không" — vd
`23503` (vướng khoá ngoại, quyền INSERT vẫn còn) không được tính là đã vá, chỉ
`42501` mới tính. Chạy sau mỗi lần apply schema.sql và trước khi deploy.

**Còn thiếu:** vẫn phải NHỚ chạy nó. Trả nợ thật = Supabase CLI migrations, hoặc
tối thiểu bảng `schema_version` + check lúc khởi động ứng dụng.
*(Vế thứ hai đã làm 2026-08-07 — xem khối ở đầu mục. Vế "phải NHỚ chạy" nay do
test CI và check khởi động gánh; vế Supabase CLI vẫn còn nguyên.)*

**Phủ rộng thêm 2026-08-04 (TD-011):** script nay còn so `on delete` của TOÀN BỘ
khoá ngoại với schema.sql, qua RPC chỉ-đọc `public.schema_foreign_keys()` (§16a).
Đối chiếu hai chiều — khai-mà-DB-không-có, và DB-có-mà-không-khai.

~~⚠ **§16 CHƯA ĐƯỢC APPLY lên DB nào**~~ — **đã áp 2026-08-07 lên cả dev lẫn
prod.** Cảnh báo này đứng nguyên 3 ngày và nó ĐÚNG suốt 3 ngày đó: `verify:schema`
thật sự FAIL với `PGRST202`, và không ai thấy vì không ai chạy. Ghi lại vì nó là
bằng chứng cho chính TD-005 — một cảnh báo viết đúng, đặt đúng chỗ, vẫn không cứu
được gì khi việc chạy nó phụ thuộc vào trí nhớ người.

**Đã tái phát 2026-08-03 (lần 2):** §12a dùng `drop function` cho
`exam_rating_aggregate()`, nhưng view `exams_with_difficulty` phụ thuộc nó → lần
chạy thứ hai chết với `2BP01: cannot drop function ... because other objects
depend on it`. Đã sửa sang `create or replace`. Hai lần vấp cùng một chỗ trong
một ngày: **không có cách nào biết schema.sql còn chạy lại được, ngoài việc
THỰC SỰ chạy lại nó trên DB có dữ liệu thật.**

**Hệ quả kèm theo — tính idempotent của schema.sql không ai kiểm chứng.** File tự
khai "chạy lại nhiều lần không lỗi" ở header, nhưng vì không ai chạy lại nó bao
giờ, lời khai đó mục lúc nào không hay. Ngày 2026-08-03 phát hiện §2 add
`questions_type_check` bản HẸP (`mcq`/`essay`) trong khi §8c nới ra 4 giá trị:
mọi DB đã có dữ liệu v2.1 sẽ chết ở §2 với `23514`, và §8c không bao giờ chạy
tới. Đã sửa (§2 nhường quyền sở hữu constraint cho §8c), nhưng cùng kiểu mục nát
đó sẽ tái diễn ở mỗi "narrow rồi widen" tiếp theo. Chỉ có migration thật, hoặc
một lần chạy lại toàn file trên DB có dữ liệu đại diện, mới phát hiện được.

---

## Đã trả

### ~~TD-023 — Hai route vẫn vượt ngân sách JS~~
**Trả:** 2026-08-27
**Verify:** `next build` thật + đọc `page_client-reference-manifest.js` từng route.

**Số đo LẠI trên PRODUCTION trước khi sửa** (máy tầm trung, 4× CPU throttle +
slow 4G, 3 lượt/route lấy trung vị, `https://ms-molar.vercel.app`) — và số đo
này SỬA LẠI tiền đề của chính mục TD-023 cũ:

TD-023 viết "còn ĐÚNG HAI route vượt ngưỡng ~170 KB". Sai. Đo bằng JS THẬT SỰ
TẢI VỀ (Resource Timing `encodedBodySize`, tức byte đã nén br mà trình duyệt
thật nhận) thì **MỌI route đều vượt** — nền chung đã là 205 KB br, đo ở
`/terms`, một trang chỉ có chữ. Con số 188.4/185.6 KB cũ là "First Load JS" của
`next build` (gzip, cách đếm khác), không phải thứ người dùng tải.

| Route | JS tải về (br) | LCP | INP (max) | TBT | CLS |
|---|---|---|---|---|---|
| `/me/exams/[id]` (sửa đề) | 354.3 KB | 5.1s | 2544ms | 2388ms | 0 |
| `/exams/[id]/attempt/[attemptId]` (làm bài) | 351.8 KB | 3.7s | 328ms | 1591ms | 0 |
| nền chung (`/terms`) | 205.4 KB | 2.3s | 128ms | 343ms | 0 |

Cả hai route nặng nhất vượt vì CÙNG một chunk markdown+KaTeX **126.3 KB br**
(`0k3qsrq5-u33w.js`) — đúng chunk mà TD-021 đã gỡ được khỏi `/result/detail`.

**Đã trả bằng HAI cách khác nhau, vì hai route KHÔNG cùng một bài toán** — và
đây là chỗ mục TD-023 cũ đoán chưa đúng khi kê một cách chung cho cả hai:

- **Màn LÀM BÀI** — dùng đúng cách TD-023 đề xuất: render nội dung câu hỏi ở
  SERVER (`app/(layer2)/_components/questionNodes.tsx`) rồi truyền phần tử
  React xuống `ExamPlayer`/`QuestionRenderer`/`AnswerChoice`. Làm được vì nội
  dung câu hỏi BẤT BIẾN trong suốt một lượt làm bài. Server giao đủ N câu một
  lần (client mới biết `current`, server không).
- **Màn SỬA ĐỀ** — KHÔNG làm được như trên, và lý do là bản chất: tác giả sửa
  chính chuỗi nguồn đó, nên node render sẵn ôi ngay lần sửa đầu tiên. Dùng
  `next/dynamic` GIỮ `ssr` mặc định: cả 5 chỗ dùng `RichText` đều nằm trong
  nhánh XEM (`editing === false`) — chế độ SỬA là input/textarea chuỗi nguồn,
  không có preview trực tiếp — nên nội dung vẫn render ở server và có mặt trong
  HTML đầu tiên; `dynamic` chỉ đẩy 126 KB ra khỏi đường hydrate ban đầu.
  `ssr: false` ở đây sẽ là "trang trống rồi mới có chữ", đúng cái bẫy TD-023
  cảnh báo.

**Kết quả đo trên build thật** (chunk client mà mỗi route THAM CHIẾU, br):
`/me/exams/[id]` **169.9 → 68.7 KB** (−101.2 KB, −60%); route làm bài không còn
tham chiếu chunk markdown+KaTeX nữa (nay là chunk nạp động của riêng màn sửa đề).

**Vì sao mục này KHÔNG để lại phần dư:** nền chung 205 KB br là React 19 +
runtime Next 16 + app shell, không phải thứ gỡ được bằng ranh giới component.
Muốn hạ tiếp thì đó là một quyết định về FRAMEWORK, không phải một món nợ.

### ~~TD-025 — Không có cổng nào xác nhận CSS/JS đã DEPLOY THẬT khớp với build cục bộ~~
**Trả:** 2026-08-27
**Verify:** chạy CẢ HAI CHIỀU — xanh với bản deploy khớp, ĐỎ khi tiêm một khối
CSS hình dạng TD-024 vào artifact cục bộ rồi chạy lại.

`npm run verify:deployed -- <base-url>` (`scripts/verify-deployed-assets.mjs`).

**Nó so cái gì:** không phải hash file. Vercel build trên hạ tầng của nó nên tên
chunk và byte KHÔNG BAO GIỜ khớp `.next-build` cục bộ, kể cả khi mọi thứ đúng —
một cổng đỏ 100% số lần là một cổng bị tắt trong tuần đầu. Thứ so được là NỘI
DUNG NGỮ NGHĨA: mỗi biến CSS khai báo (`--foo:`) và mỗi class selector mà build
cục bộ sinh ra, bản deploy phải có đủ.

**Phép so là ĐỘ PHỦ THEO TỪNG FILE, và đó là bài học từ chính lần chạy đầu:**
gộp toàn bộ CSS cục bộ rồi so với CSS của mấy route công khai cho ra 139 "class
thiếu" — tất cả đều là KaTeX, thiếu vì ĐÚNG (KaTeX chỉ nạp ở route có nội dung
câu hỏi). Nên mỗi file chỉ có hai trạng thái hợp lệ: không được nạp (độ phủ ≤2%
→ bỏ qua) hoặc được nạp (phải ĐỦ TUYỆT ĐỐI, thiếu 1 token cũng đỏ). Trạng thái
thứ ba — nạp một phần — chính là hình dạng TD-024.

**Vì sao ngưỡng "đủ" là 100% chứ không phải 98%:** khối CSS mất tích của TD-024
là MỘT khối cuối file, vài class trên tổng số hàng trăm → 99.2% độ phủ → xanh →
trang vẫn hỏng. Một ngưỡng phần trăm ở đây sẽ để lọt đúng bug sinh ra cổng này.

**Chạy khi nào:** sau MỖI lần ship UI có đụng `globals.css` hoặc thêm asset tĩnh
mới, với URL prod hoặc preview. Cần `.next-build` của ĐÚNG commit đang deploy —
script tự từ chối nếu không có build cục bộ.

**Phần nó KHÔNG trả:** nguyên nhân gốc (vì sao build cache của Vercel bỏ sót
thay đổi CSS thuần) vẫn CHƯA xác định được, đúng như TD-025 cũ ghi. Đây là cổng
PHÁT HIỆN, không phải bản vá. Nó biến một sự cố vô hình thành một sự cố nhìn
thấy được — nó không sửa gì cả.

### ~~TD-026 — Không có phân trang thật~~
**Trả:** 2026-08-27 (phần QUYẾT ĐỊNH + phân trang cho `/exams`)
**Verify:** `lib/exams/__tests__/paginate.test.ts` — 12 case, ghim cả phép số
học lẫn bất biến "cắt trang KHÔNG sắp xếp lại".

**Quyết định (engineer uỷ quyền 2026-08-27): XẾP HẠNG TRƯỚC RỒI CẮT.**
`/exams` nay có `?page=`, 12 đề/trang (`lib/exams/paginate.ts`,
`app/(layer2)/_components/ExamPagination.tsx`).

Vì sao đường này trong ba đường TD-026 kê:
- **Cắt-rồi-xếp (DB-side `.range()`)** giảm tải DB nhiều nhất và PHÁ ADR-0015:
  `rankExamIds` chỉ còn nhìn thấy 12 đề của trang hiện tại, nên "xếp hạng cá
  nhân hoá" thành "xếp hạng trong phạm vi 12 đề tình cờ nằm cạnh nhau". Thứ tự
  sai theo trang là kiểu hỏng KHÔNG NHÌN RA ĐƯỢC — trang vẫn đầy đề, chỉ là sai
  đề. Loại.
- **Ranking xuống SQL** đúng cả hai vế, và là một bản viết lại của thuật toán đã
  có test, cho một catalog hiện có **8 đề** (đo prod 2026-08-27). Chi phí đi
  trước nhu cầu.
- **Xếp-rồi-cắt** giữ ADR-0015 NGUYÊN VẸN: `rankExamIds` vẫn nhận trọn tập ứng
  viên, thứ tự y hệt trước, phân trang thuần tuý là chuyện TRÌNH BÀY. Không
  giảm tải DB — đó là cái giá ĐÃ BIẾT, không phải sơ suất.

MỘT ngữ nghĩa phân trang cho CẢ HAI nhánh (`?sort` tường minh lẫn mặc định cá
nhân hoá), cố ý: hai ngữ nghĩa khác nhau làm tổng số trang nhảy khi người dùng
đổi kiểu sắp xếp, và không có cách nào giải thích điều đó cho họ.

**⚠ PHẦN CÒN LẠI, đừng đọc nhầm mục này là đã xong hết:** đây KHÔNG phải phân
trang không giới hạn. `fetchExamRows` vẫn đọc trong biên `LIST_ROW_CEILING`
(500), nên tập ứng viên — và do đó tổng số trang — bị chặn ở cửa sổ đó. Vượt 500
đề thì `readBounded` kêu vào log (dòng mồi) và ĐÓ là tín hiệu chuyển sang đường
SQL, KHÔNG phải để nới hằng số lên. Các danh sách theo-user (`listMyHistory`,
`listMyExams`) chưa phân trang — chúng lớn chậm hơn hẳn và không vướng ranking,
đúng thứ tự ưu tiên mà TD-026 cũ đã kê.

### ~~TD-022 — Không có ngân sách Gemini ở mức PROJECT~~
**Trả:** thực ra đã trả bởi đợt Subscription (commit `72a729d`), SAU khi mục này
được viết — mục này ĐỨNG SAI suốt từ đó. Xác minh lại 2026-08-27.
**Verify:** đọc `lib/billing/quota.ts` + cả hai điểm gọi.

Ngân sách mức project ĐÃ TỒN TẠI và làm đúng thứ TD-022 đòi:
- `ai:budget:{ngày Pacific}` — bộ đếm **KHÔNG theo user**, `INCRBY` bằng đúng SỐ
  REQUEST Gemini sẽ phát (`geminiCalls` là tham số **BẮT BUỘC, không có giá trị
  mặc định** — một mặc định `1` tái tạo im lặng chính cái under-count 2–3× mà nó
  sinh ra để sửa).
- Cửa sổ theo NGÀY PACIFIC, khớp đơn vị reset của nhà cung cấp.
- ĐẶT CHỖ trước khi phát request, hoàn lại cả hai bộ đếm khi bị từ chối.
- `project_budget` là một lý do **PHÂN BIỆT** với `user_quota` — đúng lời phàn
  nàn cốt lõi của TD-022 ("không mã lỗi nào chỉ về đúng nguyên nhân"). Đường
  upload nói với người dùng "tạm thời không dùng được", KHÔNG nói "bạn hết
  lượt", vì nói thế là nói sai (`app/(layer4)/actions.ts`). Telemetry giữ mã
  phân biệt `project_budget_exhausted` (`lib/billing/quotaTelemetry.ts`).
- Fail-CLOSED khi Redis không tới được (`unavailable` → từ chối), cố ý KHÔNG
  thừa kế lớp đệm RAM của `rateLimit.ts` — bộ đếm process-local nhân lên theo số
  instance nên không bao giờ chặn nổi một ngân sách toàn dự án.

**Bài học ghi lại vì nó sẽ tái diễn:** một món nợ được trả ở một nhánh khác
(Subscription) mà sổ nợ không ai cập nhật thì nó vẫn "đang mở" trong mắt mọi
phiên sau — và phiên sau sẽ đi làm lại một việc đã xong. Trả nợ và ĐÓNG SỔ là
hai việc, không phải một.

### ~~TD-024 — Overlay "Loading" hiện toàn phần trên MỌI tải trang production, không do bấm gì~~
**Từ:** 2026-08-17 (engineer báo lại kèm ảnh chụp — overlay "LOADING" phủ kín
trang chủ prod ngay từ lần tải đầu, tương tác các thành phần khác vẫn bình
thường)

`RouteLoadingOverlay` (lớp phủ chuyển trang, thêm cùng ngày) hiện đè kín mọi
trang trên `ms-molar.vercel.app`, không tắt được, không do một cú bấm cụ thể
nào kích hoạt — chỉ cần tải trang là thấy. Ba đường tắt đã viết sẵn trong
component (URL mới commit, popstate/pageshow, hẹn giờ 12s) đều không cứu được
vì bug không nằm ở state JS.

**Nguyên nhân xác định bằng đo, không suy luận:** `getComputedStyle` trên
production trả `opacity: 1; visibility: visible` NGAY CẢ KHI `data-pending`
đọc đúng là `"false"` — tức JS toggle đúng, chỉ CSS quyết định ẩn/hiện là
thiếu. Kiểm CSS bundle đã deploy (`grep route-loading` trên file `.css` tải
từ `https://ms-molar.vercel.app/_next/static/...`) ra **0 kết quả** — toàn bộ
khối `.route-loading { opacity:0; visibility:hidden }` vắng mặt. Đối chiếu:
git blob của ĐÚNG commit đã deploy (`8be5340`) có đủ 10 dòng khớp
`route-loading`; `next build` chạy cục bộ trên cùng commit đó cũng cho ra CSS
đúng. Vậy lệch pha xảy ra trong chính bước build của Vercel, không phải do
quên commit hay do trình duyệt người dùng cache cũ (kiểm bằng Playwright phiên
mới tinh, không cookie/cache cũ, vẫn ra kết quả giống hệt).

**Đã trả 2026-08-17** — không tìm được tham số "bỏ qua build cache" nào cho
API tạo deployment (kể cả qua Composio), nên sửa bằng cách đổi NỘI DUNG THẬT
của `globals.css` (thêm đoạn cảnh báo sự cố này ngay tại chỗ) để bước build kế
tiếp không còn artifact cũ nào để tái dùng, rồi deploy lại
(`9dabe1a2cd15fc32256a89f73482e5bd00839975`).

**Verify (đo lại trên chính production sau khi sửa):**
- Tên file CSS đổi hash thật (`2hthv7rrgemj1.css` → `25_fg3gc056lk.css`) —
  xác nhận đây là artifact MỚI, không phải cache được phục vụ lại.
- `getComputedStyle` trên tải trang mới: `opacity: 0; visibility: hidden` khi
  `data-pending="false"` — đúng thiết kế.
- Điều hướng thật qua click: `data-pending` chuyển `true → false` trong ~1
  giây, không kẹt.

**Bài học giữ lại:** 5 cổng verify chuẩn của dự án (tsc/eslint/vitest/build/
check:bundle) ĐỀU XANH trước khi ship — không cổng nào phát hiện được sự cố
này vì tất cả chỉ kiểm cục bộ, không cổng nào hỏi "CSS/JS đã lên Vercel thật
có khớp bản build không". Phần lỗ hổng quy trình này CHƯA trả, tách thành
[[TD-025]].

### ~~TD-019 — `extractAndAssemble` không có rate limit, vét sạch hạn ngạch AI dùng chung~~
**Từ:** 2026-08-17 (rà bảo mật toàn repo; Semgrep 117 rule/769 file ra 0 finding,
mục này đến từ vòng thủ công OWASP A07/A08, không phải từ scanner)

`extractAndAssemble` — action ĐẮT NHẤT dự án — là Server Action DUY NHẤT chạm
Gemini mà không có `guard()` nào. Mỗi lần gọi: 2 file × 15MB, một lượt đọc PDF
bằng mupdf/WASM, rồi **2 request Gemini (Manual) hoặc 3 (Automatic)** chạy song
song ở stage 5. Hạn ngạch thật: **20 request/NGÀY cho CẢ project** (free tier).

**Vì sao nó tệ hơn "một action thiếu guard":** nó làm HỎNG một guard khác đã
viết đúng. `RATE_LIMITS.explainStep` được thiết kế rất kỹ (3 lượt/NGÀY, cửa sổ cố
ý trùng đơn vị ngày của nhà cung cấp, kèm cả một đoạn giải thích vì sao cửa sổ
theo giờ không đặt được trần cho hạn ngạch theo ngày) — và chính comment đó đã
ghi "cùng key đó còn phục vụ trích xuất PDF ở `lib/ugc/gemini.ts`". Nhưng đường
trích xuất ấy không bị đếm. Kết quả: **7 lần upload của MỘT tài khoản đã đăng
nhập là hết sạch 20 lượt/ngày**, rồi gia sư của toàn bộ người dùng chết — trong
khi không ai vượt trần 3 lượt của mình. Một trần trên giấy.

**Đã trả 2026-08-17** — `RATE_LIMITS.uploadExam = { limit: 5, windowMs: 24h }`,
`guard("uploadExam", user.id)` đặt NGAY sau `requireUser()`. Ba chi tiết cố ý:
- **Vị trí là điểm sớm nhất còn có khoá để đếm.** Trước `requireUser()` thì chưa
  có `user.id`; sau bước validate file thì đã trả giá phần đắt nhất (đọc/parse
  file) rồi mới từ chối — một vòng lặp gửi rác vẫn bắt server làm hết việc.
- **Xếp vào nhóm "supplier-capped", không phải nhóm "tốn DB của chính ta".** Test
  phân loại sẵn có đòi nhóm tốn-DB phải `limit >= 15`; xếp nhầm là hợp thức hoá
  đúng cái lỗ vừa vá.
- **5 chứ không nhỏ hơn:** đăng đề là việc TẠO GIÁ TRỊ chính của Layer 4, siết
  xuống 1–2 là chặn người dùng thật để phòng kẻ tấn công chưa xuất hiện.

**Cổng canh mới, và nó bắt thứ mà từng trần riêng lẻ KHÔNG bắt được:** kiểm từng
cái thì 3 và 5 đều "dưới 20", trong khi cộng lại một tài khoản vẫn vét sạch. Test
mới quy đổi sang SỐ REQUEST GEMINI (explainStep ×1, uploadExam ×3) và ghim tổng
worst-case của một tài khoản ≤ 20 — hiện là **18**. Thêm lời gọi AI thứ tư vào
pipeline sẽ làm case này đỏ kèm chỉ dẫn trần nào phải hạ.

**Verify:** `npx vitest run lib/security/rateLimit.test.ts` → 10 passed. Đủ 5 cổng
sau khi sửa: `tsc --noEmit` sạch · `eslint --max-warnings 0` sạch · `vitest run`
**728 passed / 10 skipped** · `next build` không warning · `check:bundle` PASS.

**Phần KHÔNG trả được, đã tách thành TD-022:** trần khoá theo `user.id` nên bó
được một tài khoản chứ không bó được TỔNG — 2 tài khoản dùng hết phần mình vẫn
hết hạn ngạch project.

### ~~TD-021 — Chunk markdown+KaTeX 122.5 KB gzip nằm trong bundle đầu của trang chỉ-đọc~~
**Từ:** 2026-08-17 (rà hiệu năng; Next 16 + Turbopack KHÔNG còn in bảng
`Size`/`First Load JS` sau build, nên số đo lấy bằng cách đọc
`page_client-reference-manifest.js` của từng route rồi gzip từng chunk thật)

Ba route vượt ngân sách ~170 KB gzip, và cả ba vượt vì CÙNG một chunk:
`react-markdown + remark-gfm + remark-math + rehype-katex + rehype-sanitize +
katex` = **122.5 KB gzip / 415.9 KB raw** — chunk client lớn nhất dự án, lớn hơn
toàn bộ phần JS còn lại của phần lớn route. Đo bằng cách diff tập chunk giữa hai
route anh em: `/…/result/detail` (181.8 K) trừ `/…/result` (94.4 K) ra đúng chunk
đó.

Chỗ sai thật nằm ở `/…/result/detail`: đây là trang **chỉ đọc**, nhưng nó trả
122.5 KB cho MỌI người xem — kể cả người làm đúng hết. Lý do: `RichText` mang
`"use client"` (dù không có hook/state/handler nào), nên 4 chỗ page.tsx render nó
ở vị trí server vẫn tạo ranh giới client; và `ExplainStepAffordance` (client)
import tĩnh nó, dù bảng gợi ý chỉ hiện khi học sinh đã sai câu đó HAI lần VÀ chủ
động bấm nút.

**Đã trả 2026-08-17** — hai thay đổi, và **cả hai đều bắt buộc**. Đây là chỗ dễ
làm nửa vời nhất nên số đo cả 4 tổ hợp ghi lại ở đây:

| `RichText` | import trong tutor | `/…/result/detail` |
|---|---|---|
| client | tĩnh | 181.8 K gzip (bản gốc) |
| **server** | tĩnh | 181.8 K — bỏ directive MỘT MÌNH không đổi gì |
| client | động | 183.2 K — nạp động MỘT MÌNH còn tệ hơn (thêm wrapper) |
| **server** | **động** | **60.7 K** |

→ **−121.1 KB gzip (−66%)**, route tụt từ trên ngưỡng xuống dưới hẳn. Bài học
đáng giữ: hai thay đổi mà mỗi cái đo riêng đều ra **0**, gộp lại ra 66% — nếu chỉ
làm một cái rồi đo, kết luận đúng sẽ là "cách này vô dụng".

`ssr: false` ở chỗ nạp động là ĐÚNG chứ không phải để né lỗi: `hint` chỉ tồn tại
sau một lời gọi Server Action từ tương tác người dùng, nên lượt render server nó
luôn rỗng.

**Cổng canh:** cảnh báo đặt ngay đầu `RichText.tsx` — thêm lại `"use client"` vào
file đó là đẩy 122.5 KB sang trình duyệt cho mọi route render nội dung câu hỏi;
cần state thì bọc một client component MỎNG ở ngoài. Test
`ExplainStepAffordance.test.tsx` nay chờ đúng thẻ `<strong>` xuất hiện — vừa là
bằng chứng chunk đã resolve, vừa đúng nghĩa vụ chứng minh sẵn có của case đó
(đường render đi qua markdown, không phải plain-text).

**Verify:** `vitest run components/tutor components/shared` → 61 passed (gồm
nguyên bộ XSS fixtures của RichText). Đủ 5 cổng như TD-019.

**Phần KHÔNG trả được, đã tách thành TD-023:** `/me/exams/[id]` (188.4 K) và
`/exams/[id]/attempt/[attemptId]` (185.6 K) vẫn vượt ngưỡng — ở đó nội dung câu
hỏi nằm trong cây client thật và phải có NGAY, nên không dùng lại được cách này.

### ~~TD-020 — 2 CVE trong phụ thuộc production~~
**Từ:** 2026-08-17 (`npm audit --omit=dev`)

- `nanoid <3.3.18` (**high**, GHSA-2v37-7h3g-55p8) qua `next@16.3.0 → postcss`.
- `dompurify <=3.4.12` (**moderate**, GHSA-55q2-fjhq-7xh7 — XSS: IN_PLACE hook
  removal để lại subtree tách rời vẫn thực thi được) qua `jspdf@4.2.1`.

**Đã trả 2026-08-17** — `npm audit fix` (KHÔNG `--force`; cảnh báo cũ ở TD-007
vẫn nguyên giá trị: `--force` từng đề xuất hạ `next` xuống 9.3.3). Chỉ
`package-lock.json` đổi, không chạm `package.json`: dompurify 3.4.12→3.4.13,
nanoid 3.3.17→3.3.18. `npm audit --omit=dev` sau khi vá → **0 vulnerabilities**
(cả `npm audit` đầy đủ cũng 0).

Ghi lại vì hai đường tiếp cận đều dễ kết luận nhầm theo hướng ngược nhau:
`--omit=dev` vẫn báo `nanoid` dù `@tailwindcss/postcss` là devDependency — nó
đến qua `next` (đường prod thật), nên "chỉ là dev dependency" là sai. Ngược lại
`npm audit fix --omit=dev` chạy thử thì đòi gỡ 332 gói (nó dọn luôn devDeps khỏi
`node_modules`) — chạy bản đó để "cho an toàn" mới là thứ làm hỏng cây làm việc.

### ~~TD-015 — `eslint-config-next` lệch phiên bản với `next`~~
**Từ:** 2026-08-04 (ghi nhận lần đầu trong PROCESS.md, chưa từng vào sổ)

`package.json` ghim `eslint-config-next@16.2.7` trong khi `next` đã lên `16.3.0`.
Không ai cố ý để lệch: TD-007 nâng `next` bằng `npm audit fix`, việc đó không
đụng `eslint-config-next` vì nó không nằm trong đường phụ thuộc bị advisory. Lint
là cổng CHẶN merge (TD-010), nên một bộ rule đặc thù Next.js đi sau chính bản
Next đang chạy là khoảng hở im lặng trên chính cổng được kỳ vọng bắt lỗi.

**Đã trả 2026-08-17** — `eslint-config-next` 16.2.7 → **16.3.0**, khớp `next`
đang chạy. `npm run lint` (`--max-warnings 0`) vẫn sạch sau khi nâng, tức bản
mới không flag thêm gì trong source hiện tại.

**Một chi tiết phải giữ lại, vì nó suýt trôi qua:** `npm install -D
eslint-config-next@16.3.0` ghi vào `package.json` thành `^16.3.0` — đổi luôn
CHÍNH SÁCH ghim của dep này (trước đó là bản duy nhất trong repo ghim CHÍNH XÁC,
không caret, và đó là chủ đích: nó phải đi lockstep với `next`). Đã sửa lại thành
`16.3.0` đúng nghĩa rồi `npm install` cho khớp lockfile. Nâng phiên bản mà vô
tình nới quy ước ghim là đúng cách để món nợ này quay lại theo hướng ngược.

### ~~TD-018 — 9 file test rỗng làm cổng `npm test` ĐỎ trên mọi push~~
**Từ:** 2026-08-14 (phát hiện khi chạy full suite cho một việc khác)

Commit `fdad2b8` thêm 9 file `*.test.ts(x)` chỉ có comment, không
`describe`/`it` nào → Vitest tính mỗi file là suite FAIL (`No test suite found
in file`), cổng `npm test` đỏ trên mọi push dù 558 assertion đều xanh.

**Đã trả 2026-08-15** — đo lại trước khi sửa: 7/9 file đã được implement thật ở
các commit sau đó (`795ab38`, `1c2c02d`, `7352960`...), chỉ còn đúng 2 file rỗng
— `components/tutor/ExplainStepAffordance.test.tsx` và
`app/(layer3)/_components/SkillRecommendationCard.test.tsx`. Cả hai đổi sang
`it.todo(...)` (một dòng mỗi test case đã đặc tả sẵn trong skeleton — 5 test cho
ExplainStepAffordance, 3 cho SkillRecommendationCard), giữ nguyên toàn bộ
comment ROI/proof-obligation phía trên làm tài liệu cho lần implement thật.

**Không implement thật 2 file này** — component chúng test
(`ExplainStepAffordance.tsx`, `useTutorAction.ts`, `SkillRecommendationCard.tsx`)
CHƯA TỒN TẠI trong repo (`ls` xác nhận, không phải suy đoán); test thật cho
component chưa build là không thể viết, đúng lý do TD-018 tách "trả cổng" ra
khỏi "implement thật" ngay từ đầu.

**Verify:** `npx vitest run` → `Test Files 67 passed | 2 skipped (69)`,
`Tests 649 passed | 8 todo (657)`, exit 0. `tsc --noEmit` và `npm run lint`
(`--max-warnings 0`) cũng xanh trên 2 file đã sửa.

**Còn nợ:** implement thật 8 test case (`it.todo` → nội dung) khi
ExplainStepAffordance/SkillRecommendationCard được build — việc của nhánh
Engine 1, chưa mở lại thành mục riêng vì đã có sẵn đặc tả đầy đủ ngay trong
file.

### ~~TD-016 — `subject` không canonical trong `questions` VÀ `exams`~~
Bản mô tả ban đầu (2026-08-08) SAI ở hai chỗ, phát hiện khi đo lại bằng
`service_role` trên dev thay vì suy từ code:
  - **Không chỉ `questions`.** `exams.subject` cũng bẩn (2 đề mang `'Toán'`).
    10 câu hỏi bẩn chính là câu của đúng 2 đề đó — UGC cascade `subject`/`topic`
    từ đề xuống câu, nên đếm ở tầng `questions` là nhìn cái BÓNG, không phải
    cái gốc.
  - **Không phải `seed.ts`.** Cả 2 đề là UGC người dùng thật upload
    (`ugc-f8ec9b8a…`, `ugc-9c857be4…`, 2026-07-20 00:06/01:03 UTC), có
    `author_id`. `lib/ugc/subjects.ts` ra đời commit `971a4fe` lúc 15:33 UTC
    CÙNG NGÀY — tức 14 tiếng SAU. Dữ liệu tồn dư của thời chưa có canonical
    hoá, không phải một đường ghi rò rỉ hàng ngày.

**Đường ghi đã bịt 2026-08-14** — `validateExamMeta` (`lib/ugc/validateInput.ts`,
đường **Manual**) trước đây chỉ kiểm `subject` khác rỗng rồi ghi thẳng chuỗi
thô. Mọi đường khác đã canonical hoá từ trước (`parseTypedMeta`/`saveExam` dùng
`isSubject`; đường Automatic dùng `normalizeMeta` → `normalizeSubject`). S-01
render `<select>` từ `SUBJECTS` nên UI không tạo được giá trị lạ — nhưng đây là
**server action**, FormData không được tin. Vá bằng `normalizeSubject` TRƯỚC
rồi mới đòi canonical (alias sửa được thì sửa, chỉ từ chối cái không map nổi —
cùng hàm đường Automatic dùng, hai đường không thể lệch kết luận), kèm 4 test.

**Cổng canh (mới, sống lâu dài):** `verify-schema.ts` mục 8 hỏi thẳng DB "có
dòng nào ngoài `SUBJECTS` không", cho cả `questions` lẫn `exams`. Khác 7 mục
kia ở chỗ soi DỮ LIỆU chứ không phải cấu trúc — hình dạng hỏng giống hệt
TD-001/TD-005: không mã lỗi, không log, chỉ THIẾU.

**Dữ liệu đã dọn 2026-08-14** — `supabase/one-off/2026-08-14-td016-canonical-subject.sql`
(idempotent, sửa cả `subject` lẫn `topic`, chỉ sửa `topic` khi nó đang phản
chiếu `subject` — tránh đổi mảnh vỡ này lấy mảnh vỡ khác ở facet `topic`, nơi
taxonomy Engine 1 đọc vào). Áp qua Composio (`SUPABASE_BETA_RUN_SQL_QUERY`),
không phải paste tay:
  - **dev**: 10 câu + 2 đề → canonical. Đo trước/sau: `questions.subject=Math`
    37→47, `exams.subject=Math` 4→6, cả 10 câu có `topic` khớp `subject` sau vá.
    `npm run verify:schema` mục 8 xanh (57/57 câu, 8/8 đề canonical).
  - **prod**: đo trước khi vá — **0 dòng bẩn sẵn** (28 câu/3 đề, toàn bộ
    `Math`). Hai đề bẩn chỉ tồn tại trên dev (tài khoản test upload lúc dev
    testing), chưa từng chạm prod. Không cần chạy UPDATE nào ở đây — xác nhận
    bằng đếm subject trên toàn bảng, không chỉ bằng truy vấn "có dòng bẩn
    không" (loại trừ khả năng bảng rỗng làm truy vấn dương tính giả).

### ~~TD-014 — `ADMIN_USER_IDS` mất scope Preview trên Vercel~~
`ADMIN_USER_IDS` chỉ còn scope **Production**. Nguyên nhân đã biết từ S#46:
`vercel env rm` gỡ biến khỏi **mọi** scope chứ không chỉ scope được chỉ định —
một lần `rm` rồi `add` lại vô tình làm mất Preview. Hệ quả: `/admin` trên **mọi**
Preview deploy luôn 404 cho tất cả mọi người, kể cả tài khoản đúng quyền — không
phân biệt được với đăng nhập nhầm tài khoản (đúng hình dạng TD-009: fail-closed
im lặng). Từng xếp "chưa vá ngay" vì không chặn được gì hôm nay, nhưng nó là bẫy
cho người TIẾP THEO: thấy 404 rồi đi debug nhầm hướng.

**Đã trả 2026-08-14** — thêm entry mới `ADMIN_USER_IDS` scope **Preview**
(type `sensitive`, id `bmhkQ05v9a6dKLYo`), giá trị là UUID admin trên Supabase
**dev**, lấy từ `SOURCE/.env.local` (Preview trỏ dev). Làm qua Composio
(`VERCEL_ADD_ENVIRONMENT_VARIABLE`), **`upsert: false`** — cố ý, để entry
Production (`PuSygCGTweNdWPNo`) không bị đụng tới; đã đọc lại danh sách sau khi
ghi và xác nhận `updatedAt` của nó không đổi. Đây chính là bài học của S#46:
món nợ này SINH RA từ một thao tác env vô tình chạm nhiều scope hơn dự định,
nên cách trả nó phải là thao tác chỉ-thêm, không phải `rm` rồi `add` lại.

**Hai điều người sau cần biết:**
- **Env chỉ có hiệu lực với deploy MỚI.** Preview deploy đang tồn tại vẫn 404
  `/admin`; phải push/redeploy rồi mới kiểm được.
- **Chưa xác minh end-to-end.** Giá trị dev là suy ra từ `.env.local` + ghi chú
  TD-014, KHÔNG phải đọc được từ Vercel (biến `sensitive` không đọc lại được),
  và `docs/DEPLOYMENT.md` mà mục này từng dẫn chiếu **nay không còn tồn tại**
  trong repo. Nếu Preview hoá ra không trỏ dev thì `/admin` vẫn 404 — đúng như
  hiện trạng, không hỏng thêm gì, vì biến này chỉ gác `/admin`.

### ~~TD-017 — `instrumentation.ts` import tĩnh `node:crypto` vào Edge bundle~~
**Từ:** 2026-08-09 (phát hiện qua warning trong log build/deploy Vercel, không
chặn build)
**Loại:** vận hành, fragile-nhưng-chưa-hại

`instrumentation.ts` dùng `import` TĨNH cho `checkSchemaVersion.ts` →
`schemaFingerprint.ts` (`node:crypto`). `register()` bail-out sớm khi runtime
không phải `nodejs`, nên nhánh gọi `createHash()` không bao giờ CHẠY trên Edge —
nhưng import tĩnh kéo cả cây phụ thuộc vào Edge bundle lúc BUILD, không cần biết
runtime có chạy tới đó hay không. Nó "chạy được" chỉ vì Turbopack mới WARN chứ
chưa hard-fail; một bản Edge runtime siết chặt hơn có thể biến cảnh báo này
thành lỗi thật trên **mọi** request đi qua `proxy.ts` (gần như toàn site).

**Đã trả 2026-08-09** — cả hai import chuyển thành `await import(...)` bên TRONG
nhánh `if (process.env.NEXT_RUNTIME === "nodejs")`; đầu file nay không còn
import tĩnh nào.

**Verify (đo thật, không suy luận):** chạy `npm run build` HAI lần trên cùng cây
làm việc — bản trước khi sửa in `Warning: A Node.js module is loaded
('node:crypto' at line 30) which is not supported in the Edge Runtime` kèm khối
`Edge Instrumentation:`; bản sau khi sửa không còn dòng cảnh báo nào (grep
`crypto|warn|Warning|Edge` trên toàn log build → 0 kết quả). Đây là cách duy
nhất phân biệt "đã sửa" với "cảnh báo vốn không xuất hiện ở máy local".

### ~~TD-008 — Rate limit nằm trong RAM tiến trình, không dùng chung giữa instance~~
`lib/security/rateLimit.ts` đếm trong RAM của tiến trình đang chạy: nhiều
instance → trần thực tế = limit × số instance; cold start → bộ đếm về 0. Đánh
giá 2026-08-03 là "chấp nhận được, vì thêm round-trip vào đường người dùng đang
chờ là đánh đổi tệ cho một guard mức Low".

**Đã trả 2026-08-07** — bộ đếm có thẩm quyền chuyển sang **Upstash for Redis**
(Vercel Marketplace, gói free, region `sin1`, `autoUpgrade=false` để không âm
thầm nhảy sang gói trả phí). `lib/security/rateLimitStore.ts`.

Ba chi tiết đáng giữ lại, vì mỗi cái đều là một chỗ dễ làm sai:

- **Vì sao Redis chứ không phải một bảng Postgres — lý do là ĐỊA LÝ.** Functions
  chạy ở `sin1` (Singapore, `vercel.json`); Supabase prod ở `ap-south-1`
  (Mumbai). Bộ đếm trên Postgres = ~50–60ms xuyên vùng mỗi lần gọi guard. Upstash
  provision tại Singapore = cùng vùng với function. Đánh giá cũ ("đừng thêm
  round-trip") đúng ở mức nguyên tắc và sai ở mức số liệu: **round-trip không có
  một giá cố định, nó phụ thuộc bạn đặt cái gì ở đâu.**
- **MỘT lượt mạng, không phải bốn.** Cửa sổ trượt cần dọn hạn + đếm + đọc mốc cũ
  nhất + ghi mốc mới. Làm bằng 4 lệnh rời thì vừa tốn 4 lượt vừa KHÔNG nguyên tử
  (hai request song song cùng đọc `count = limit-1` rồi cùng ghi). Gói vào một
  script Lua thì Redis chạy trọn gói.
- **Redis hỏng → tụt về lớp RAM, KHÔNG mở cổng.** Nuốt lỗi thành "ok" sẽ biến
  một sự cố Upstash thành việc lặng lẽ gỡ bỏ guard — không ai biết cho tới khi
  có người lợi dụng. Kèm một dòng `console.warn`: chạy dài ngày với Redis chết mà
  im lặng thì nợ quay lại y như cũ, chỉ khác là nay có một file bảo rằng đã trả.
  Lớp RAM còn giữ vai thứ hai: chặn sớm, để một vòng lặp đang nện không tốn lượt
  Redis nào.

Kiểm bằng Redis THẬT (không phải mock): trần 3/60s → 3 lượt đầu qua, lượt 4 trả
`{ok:false, retryAfterSeconds:60}`. Thiếu `KV_REST_API_*` thì hành vi lùi về
đúng bản trước 2026-08-07 — 11 test mới ghim cả nhánh đó.

**Phần KHÔNG trả được, đã tách thành TD-013:** khoá là user id nên client CHƯA
đăng nhập vẫn không bị đếm bởi bất cứ thứ gì. Redis không sửa được cái đó, và
tầng biên thì bị khoá sau plan Pro của Vercel.

### ~~TD-012 — Xoá tài khoản `auth.users` sẽ bị chặn, nếu sau này làm tính năng đó~~
`exams.author_id` và `exam_moderation_log.actor_id` là hai khoá ngoại duy nhất
trỏ `auth.users` mà không cascade; `no action` nghĩa là xoá một tài khoản đã đăng
đề hoặc đã từng bấm gỡ/khôi phục đề sẽ chết `23503` — **đúng hình dạng bug
2026-08-04 nhưng ở tầng tài khoản.** Mục này từng được xếp "chưa chạm tới được,
để ngày làm tính năng xoá tài khoản hẵng đổi".

**Đã trả 2026-08-07** — đổi cả hai sang `on delete set null` (§16b), sớm hơn dự
tính, vì lý do xếp nó là "để sau" không đứng vững khi soi lại: `no action`
KHÔNG mua được gì ở hiện tại (app không có đường xoá tài khoản — đã grep
`deleteUser`/`admin.deleteUser`), nó chỉ hẹn giờ một lần `23503` cho người viết
tính năng đó. `set null` ở hiện tại cũng không đổi hành vi gì, vì không có lệnh
xoá nào chạm tới. **Hai lựa chọn cùng giá hôm nay; một cái đúng sẵn ngày mai** —
và cái giá của việc chọn sai chỉ hiện ra khi đã quên mất là mình có chọn.

KHÔNG cascade, và lý do phải nằm lại đây vì cascade là thứ người ta sẽ thử đầu
tiên: đề sống sót qua tác giả nhờ snapshot `author_display_name` (ADR-0003), nên
cascade sẽ xoá đề CÔNG KHAI của người khác đang làm dở; còn với nhật ký kiểm
toán, cascade biến "xoá tài khoản" thành "xoá luôn dấu vết mình đã làm gì".
`set null` giữ DÒNG nhật ký và chỉ bỏ danh tính actor.

Đã áp lên **cả dev lẫn prod** 2026-08-07 (`confdeltype = 'n'` trên cả hai). Test
hồi quy của TD-011 ghim giá trị CHÍNH XÁC chứ không chỉ "khác cascade" — hai giá
trị sai theo hai kiểu khác nhau, và nó đã FAIL đúng lúc §16b đổi.

### ~~TD-011 — `verify-schema.ts` không soi được `on delete` của khoá ngoại~~
Bug xoá đề 2026-08-04 (`exam_attempts.exam_id` + `attempt_answers.question_id`
thiếu `on delete cascade`) đi lọt qua MỌI cổng: tsc xanh, vitest xanh,
`verify:schema` xanh. Lý do: PostgREST không phơi `information_schema`, và cách
duy nhất suy ra `on delete` từ client là thật sự xoá một dòng cha — vi phạm
nguyên tắc chỉ-đọc làm script an toàn trên production.

**Đã trả 2026-08-04** — đóng ở HAI tầng, cố ý:
- **Tầng văn bản (không cần DB, chạy trong CI):**
  `lib/schema/parseForeignKeys.ts` đọc mọi khoá ngoại khai trong schema.sql;
  `lib/schema/__tests__/parseForeignKeys.test.ts` FAIL nếu có khoá ngoại nào
  không viết `on delete`. Đây là chỗ rẻ nhất để bắt — nó nổ lúc mở PR, trước khi
  SQL kịp chạy ở đâu. Quy ước mới: mọi `references` phải khai `on delete`, kể cả
  khi hành vi mong muốn đúng bằng mặc định.
- **Tầng DB:** §16a mở RPC chỉ-đọc `public.schema_foreign_keys()` (EXECUTE chỉ
  `service_role`); `verify-schema.ts` mục 6 so hai chiều với schema.sql và kiểm
  riêng chuỗi xoá đề trên DB THẬT — file đúng mà DB chưa apply thì bug vẫn sống,
  đó đúng là chuyện đã xảy ra.

Lỗ hổng của parser KHÔNG im lặng: khoá ngoại parser bỏ sót sẽ hiện ra ở chiều
"DB có mà schema.sql không khai" và làm script FAIL.
⚠ Còn một bước tay: **§16 phải được apply lên DB** thì tầng thứ hai mới sống.

### ~~TD-010 — 2 lỗi `react-hooks` trong source, nên bước lint ở CI không chặn được~~
`continue-on-error: true` ở bước ESLint nghĩa là lỗi lint MỚI lẫn vào giữa 2 lỗi
cũ mà không ai thấy.
**Đã trả 2026-08-04** — sửa cả hai bằng cách đổi cấu trúc, KHÔNG bằng
`eslint-disable`:
- `ExamTimer` → `useEffectEvent` thay latest-ref-ghi-trong-render. Ghi ref lúc
  render không an toàn với concurrent rendering; `useEffectEvent` cho đúng hai
  tính chất cần (thấy props mới nhất, không là dependency).
- `SuccessToast` → hiện/ẩn là giá trị DẪN XUẤT lúc render; state chỉ còn lưu
  "trigger nào đã hết hạn" và chỉ được set trong callback của `setTimeout`.
- Cảnh báo `<img>` cố ý của `AttemptPdfTemplate` tắt TẠI CHỖ kèm lý do, để
  `--max-warnings 0` bắt được cảnh báo mới.

Kèm 15 test hồi quy mới (`ExamTimer.test.tsx`, `SuccessToast.test.tsx`) — trước
đó cả hai component không có test nào, dù một cái nằm trên đường auto-submit.
`npm run lint` nay là `eslint --max-warnings 0` và bước ESLint trong CI đã bỏ
`continue-on-error` → lint CHẶN merge.

### ~~TD-009 — `ADMIN_USER_IDS` là cấu hình bắt buộc, không có ở đâu ngoài env~~
Mọi biến env của dự án fail-closed một cách IM LẶNG: quên `ADMIN_USER_IDS` thì
`/admin` trả 404 y hệt như khi đăng nhập nhầm tài khoản.
**Đã trả 2026-08-04** — nửa đầu là `.env.example` (đã có); nửa sau là
`instrumentation.ts` → `lib/env/checkEnv.ts`, chạy MỘT LẦN lúc server khởi động.
Phân biệt `error` (biến bắt buộc) với `warn` (mảng chức năng lặng lẽ tắt), và
bắt cả hai kiểu hỏng ngầm mà `.env.example` không bắt được: id không phải UUID
trong `ADMIN_USER_IDS` (không bao giờ khớp, không phân biệt được với "chưa cấu
hình"), và `NEXT_PUBLIC_SUPABASE_URL` sai định dạng (`next.config.ts` nuốt lỗi
parse → CSP rụng origin Supabase → ảnh đề biến mất). CỐ Ý không throw: một deploy
thiếu `GEMINI_API_KEY` mà làm sập trang chủ là đổi hỏng hóc cục bộ lấy sự cố toàn
site. Đã kiểm bằng `next start` thật với env cố tình sai.

### ~~TD-007 — `npm audit` còn 3 high trong bản lồng của `next`~~
Đánh giá 2026-08-03 là "không với tới được, chờ next phát hành bản nâng".
**Đã trả 2026-08-04** — bản đó đã có: `next` 16.3.0 nằm NGOÀI dải advisory
(`... - 16.3.0-preview.10`) và bỏ hẳn `next/node_modules/{sharp,postcss}`.
`npm audit fix` (KHÔNG `--force`) nâng next 16.2.12→16.3.0, postcss
8.5.19→8.5.23, undici 7.28.0→7.29.0, ip-address 10.2.0→10.4.0 → **0
vulnerabilities**. Kiểm sau khi nâng: tsc, lint, 396 test, `next build`,
`check:bundle`, và trình duyệt thật — tất cả xanh.

Ghi lại vì đánh giá cũ đã MỤC mà không ai biết: tới 2026-08-04, advisory postcss
nới lên `<=8.5.22`, tức bản TOP-LEVEL (8.5.19) cũng đã dính — câu "chúng chỉ nằm
ở bản lồng" đúng lúc viết và sai 1 ngày sau. Một đánh giá "chấp nhận được" có
hạn sử dụng; phải soi lại chứ không đọc lại.

⚠ Cảnh báo cũ vẫn giữ nguyên giá trị: **đừng chạy `npm audit fix --force`** — nó
từng đề xuất hạ `next` xuống 9.3.3.

### ~~TD-006 — CSP còn `'unsafe-inline'` cho script (chưa làm nonce)~~
CSP cũ KHÔNG chặn được inline-XSS; nó chỉ chặn script từ domain lạ, clickjacking,
`<base>` hijack, form bẻ hướng và plugin embed.
**Đã trả 2026-08-04** — `lib/security/csp.ts` là nguồn chân lý duy nhất;
`proxy.ts` sinh nonce 128-bit mỗi request, đặt CSP có nonce lên **request**
header (Next đọc header này để gắn `nonce=` vào script của nó) rồi đặt cùng chuỗi
đó lên response.
- `next.config.ts` giữ chính sách NỀN có `'unsafe-inline'`, nhưng chỉ còn hiệu
  lực ở path proxy.ts không chạy qua (`_next/static`, ảnh, `robots.txt`) — nơi
  không có script inline nào để bảo vệ. Giữ lại làm lưới an toàn: middleware
  không chạy → CSP yếu hơn, chứ KHÔNG phải trang trắng.
- KHÔNG dùng `'strict-dynamic'`: nó làm trình duyệt bỏ qua `'self'`, đổi lấy
  gần như không gì ở dự án không có script bên thứ ba.
- Dev vẫn `'unsafe-inline'`: Turbopack/HMR chèn script inline không qua đường
  gắn nonce của Next.

Đã kiểm trên bản production build + trình duyệt thật: đúng MỘT header CSP (đè
được nền), nonce khác nhau từng request, 17/17 thẻ script mang đúng nonce của
header, trang hydrate (điều hướng client-side chạy), 0 lỗi CSP trong console,
response 307 của route guard cũng mang CSP, `/robots.txt` giữ chính sách nền, và
`next dev` không hỏng.

### ~~TD-001 — Quyền cột trên `questions` không tự áp cho cột mới~~
Postgres không tự cấp cột mới cho column-level GRANT, nên thêm cột vào
`questions` sẽ gây `42501` ở production dưới dạng trang trắng — mà chỉ ở môi
trường có RLS thật, test mock vẫn xanh.
**Đã trả 2026-08-03** — `verify-schema.ts` lấy danh sách cột THẬT từ DB (không
hard-code) rồi đối chiếu với `grant select (...)` §10c và `returns table` §10a.
Cột mới chưa phân loại làm script fail kèm đúng câu phải sửa ở đâu. Bẫy vẫn còn
trong Postgres, nhưng nay nó kêu to thay vì im lặng.

### ~~RLS lọc dòng chứ không lọc cột — đáp án lộ qua REST API~~
Phát hiện lần đầu 2026-08-02 khi `security-reviewer` rà một feature khác (auto-
chấm `short_answer`) và thấy `essay_answer` lộ được qua REST API cùng nhóm với
`correct_answer`/`sub_answers` đã hở từ MVP; nâng lên Critical #1 trong
`docs/security-review-2026-08-03.md`.
**Đã vá 2026-08-03** — `schema.sql` §10 (quyền cột + 2 hàm SECURITY DEFINER),
gate hồi quy R-v…R-z2 trong `SOURCE/supabase/test-rls.ts`.

---

## Đã loại khỏi sổ (không phải nợ)

- **Chuỗi "claim → bịa điểm" phụ thuộc Critical #2** — không phải nợ kỹ thuật mà
  là một lỗi bảo mật đang mở, đã theo dõi ở `docs/security-review-2026-08-03.md`
  mục Critical #2 (ghi chú về tương tác đã chuyển sang đó). Hai chỗ theo dõi cùng
  một việc thì chỗ nào cũng sẽ bị bỏ quên.
- **`getResult` lấy đáp án theo đề thay vì theo `per_question`** — không có
  đường nào trong code hiện tại làm hai tập này lệch nhau (`extractAndAssemble`
  xoá hẳn row cũ khi ráp lại đề), và dư câu thì UI bỏ qua vì tra cứu theo
  `questionId`. Ghi lại một lệch pha không chạm tới được chỉ làm loãng sổ.
- **`perf-layers.ts` chép query thay vì import** — đã được cảnh báo bằng khối
  chữ ⚠ ngay đầu chính file đó, đúng nơi người sửa sẽ đọc. Chép sang đây không
  làm ai đọc nó sớm hơn.
