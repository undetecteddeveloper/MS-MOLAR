// Subscription (kỳ trả trước payOS) — skeleton test làn INTEGRATION
// Design Docs: docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121)
//              docs/design/subscription-frontend-design.md (v1.2, Test Boundaries :1018)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.3)
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Sinh ngày:   2026-08-18 | Ngân sách đã dùng: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// TRẠNG THÁI FILE — đọc trước khi sửa
// =============================================================================
// File này là một SKELETON: chỉ có comment, không import, không describe/it, không
// khẳng định. Chưa gì nó nêu tên tồn tại (lib/billing/checkoutOrder.ts,
// createOrder(), getMyOrder(), quota.ts). Task cài đặt thêm các
// import, khối runner và khẳng định trong CÙNG commit với phần
// cài đặt, để Red -> Green xảy ra bên trong một task.
//
// VỊ TRÍ VÀ CÁCH CHẠY FILE NÀY — đã quyết, không để mở.
//   `SOURCE/vitest.config.ts:19` chỉ thu thập lib/**, components/**, app/**.
//   `SOURCE/tests/**` cố ý nằm ngoài glob đó, đó là lý do các script fixture-e2e
//   đã ship nằm ở đó. File này được đặt ở đây vì một lý do đã xác minh: các ca INT-2 và
//   INT-3 đòi database Supabase dev THẬT, và Implementation Approach Phase 4
//   của backend DD nêu "CI không có database, nên mọi khẳng định chạm DB là một integration test
//   chạy cục bộ trên dev, không phải cổng CI". Đặt chúng dưới lib/** sẽ
//   làm `npm test` đỏ trong CI vì thiếu thông tin đăng nhập, không phải vì lỗi.
//
//  Task cài đặt PHẢI thêm, trong cùng commit:
//     1. `SOURCE/vitest.integration.config.ts` — cùng `resolve.alias` với
//        vitest.config.ts, `test.environment: "node"`,
//        `test.include: ["tests/integration/**/*.test.{ts,tsx}"]`.
//     2. script `package.json`: "test:integration": "vitest run --config
//        vitest.integration.config.ts".
//   `npm test` không đổi và vẫn xanh; `npm run test:integration` được
//   chạy cục bộ trên dev sau khi cổng schema B qua trên dev
//   (Early verification point của backend DD, cổng B).
//
//  Ca INT-1 mock Redis và client Supabase nên tự nó an toàn với CI.
//   Nó được giữ trong file này cho gắn kết làn. Đưa nó vào
//   cổng CI là một quyết định riêng và KHÔNG thuộc phạm vi của skeleton này.
//
//THỨ TỰ THỰC THI trong file này: INT-1, INT-2, INT-3. INT-2 và INT-3 mỗi cái
//   tạo hàng đơn riêng dưới user fixture riêng và xoá chúng khi
//   teardown; không cái nào đọc hàng của cái kia, nên thứ tự là để dễ đọc,
//   không phải phụ thuộc. Không ca nào được dùng lại orderCode của ca khác.
//
//HỢP ĐỒNG ĐÓNG BĂNG: `SOURCE/lib/billing/types.ts` bị đóng băng (comment đầu của chính nó
//   nói vậy). Không ca nào ở đây được giả định bất kỳ thay đổi nào với Plan / Quota / Entitlement /
//   FREE_FALLBACK / isQuotaExhausted.
//
//GIỚI HẠN PHẠM VI CỨNG: không ca nào trong file này chuyển tiền thật qua payOS
//   hay mở kết nối payOS sống. payOS chỉ được kiểm chứng ở ranh giới adapter
//   (`createPaymentRequest` / `getPaymentStatus` bị mock, có đếm lời gọi).
//
//
// =============================================================================
// INT-1 — ĐÃ TÁCH KHỎI LÀN NÀY (2026-09-18), NGUYÊN VĂN
// =============================================================================
// Khối đặc tả INT-1 (nghĩa vụ (a)…(e)) và phần cài đặt của nó — 10 ca, trong đó
// 8 ca ĐỎ — nay nằm ở
// `SOURCE/tests/integration/pending/subscription-quota.int.test.ts`, bị loại
// khỏi làn bằng đúng MỘT dòng trong `test.exclude` của
// `vitest.integration.config.ts`.
//
// Vì sao: commit `a77e03d` (2026-09-03) CỐ Ý gỡ `consumeQuota("upload", …)`
// khỏi đường upload vì `GEMINI_PAID_TIER_ENABLED` còn tắt và không ai mua được
// gì để mở khoá. Tám ca ấy canh đúng cái cổng đó, nên chúng đỏ vì một quyết
// định sản phẩm chứ không vì một lỗi — và vì thế chúng được giữ NGUYÊN VĂN chứ
// không bị sửa, làm yếu, skip hay xoá. Chi tiết + điều kiện bật lại: header của
// file đã tách, và `TECH-DEBT.md` TD-034.
//
// Hai khối chú thích ngay trên ("Case INT-1 mocks Redis…", "EXECUTION ORDER…")
// giữ nguyên chữ của chúng: chúng ghi lại quyết định đặt file lúc soạn khung,
// và quyết định ấy không bị sửa — chỉ NƠI CHẠY của khối INT-1 đổi.
//
//
// =============================================================================
// INT-2 — `toCheckoutOrder()` là bộ ánh xạ duy nhất: createOrder() và
//         getMyOrder() trả về các giá trị bằng nhau sâu cho một đơn
// =============================================================================
// Nguồn: backend DD I010 (dòng `toCheckoutOrder()` của Test Boundaries, :1139) và
//   mục "I010 — hai phép ánh xạ khớp nhau" của Third verification point (:1218).
//   Escalation E-02 ghi rằng `features/billing/queries.ts` giữ vị trí, chữ ký
//   và `import "server-only"` của nó; chỉ bước ánh xạ của nó trở thành
//   `toCheckoutOrder(row)`.
// AC bị chạm tới (nửa cung cấp): AC-028 (PRD :290 — số tài khoản, số tiền và
//   nội dung chuyển khoản phải có dưới dạng CHỮ cạnh mã QR) và chữ hạn chót của
//   AC-027 (PRD :287).
// EARS: (không) -> chức năng cơ bản / test hợp đồng.
// ROI: 81 (BV:9 x Freq:8 + Legal:0 + Defect:9)
// Hành vi: một đơn được tạo -> đọc lại nguội qua client theo phạm vi request
//   -> cả hai đường ánh xạ qua một `toCheckoutOrder(row)` được export trong
//   `SOURCE/lib/billing/checkoutOrder.ts` -> hai giá trị `CheckoutOrder`
//   bằng nhau sâu.
// @category: integration
// @lane: integration
// @dependency: lib/billing/checkoutOrder.ts (toCheckoutOrder),
//   createOrder(), features/billing/queries.ts (getMyOrder),
//   client Supabase theo phạm vi request, payment_orders
// @complexity: medium
// Ranh giới mock (Test Boundaries của backend DD, dòng `toCheckoutOrder()`):
//   "không gì — Postgres thật, một đơn". Adapter payOS được mock CHỈ để
//   cấp bốn giá trị chuyển khoản lúc tạo; nó không nằm trên đường đọc.
// @real-dependency: Postgres (payment_orders, RLS orders_select_own), Supabase
//   dev, một phiên authenticated
//
// Kiểu hỏng chính: hai đường khớp nhau từng trường ở mọi trường mà một
//   reviewer nghĩ tới để kiểm điểm trong khi `pendingUntil` khác nhau ở dạng CHUỖI —
//   PostgREST trả `…+00:00`, `Date.prototype.toISOString()` trả `…Z`.
//   Cùng một thời điểm, chuỗi khác nhau. Chuỗi đó là chữ hạn chót mà AC-027
//   quan sát trên màn hình, nên người dùng được hiện một hạn chót ngay sau
//   khi mua và một hạn chót định dạng khác sau khi tải lại. Một dạng kín đáo hơn
//   của cùng kiểu hỏng: ai đó thêm một trường thứ chín vào chỉ một đường.
//
// Nghĩa vụ chứng minh:
//   - Khẳng định PHẢI là bằng nhau sâu trên toàn bộ giá trị `CheckoutOrder`,
//     không phải kiểm điểm từng trường. Kiểm điểm lọt qua cả hai dạng hỏng
//     ở trên; đó là toàn bộ lý do backend DD nêu đích danh bằng nhau sâu.
//   - Đường ranh giới phải đi qua: lượt đọc NGUỘI. Gọi `getMyOrder(orderCode)` trong
//     một phiên CHƯA gọi `createOrder()` — một giá trị trong bộ nhớ mang từ
//     lời gọi tạo sang sẽ khiến phép so sánh so một giá trị với chính nó.
//   - `SOURCE/lib/billing/types.ts` bị đóng băng: khẳng định theo hình dạng
//     `CheckoutOrder` đã ship, đừng mở rộng nó để test qua.
//   - Chỉ adapter payOS được mock, và chỉ cho bước tạo,
//     vì bốn giá trị nó trả phải được ghim dưới dạng literal.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   (a) `createOrder()` cho một user fixture mới trả về một `CheckoutOrder`;
//       bắt lấy nó.
//   (b) Trong một client theo phạm vi request mới, không có lời gọi `createOrder()` trước,
//       `getMyOrder(orderCode)` trả về một `CheckoutOrder`.
//       Đây cũng là lượt đọc nguội FE-B-01 của backend DD: cả tám trường đều trả về.
//   (c) Hai giá trị BẰNG NHAU SÂU. Tiêu chí qua: một khẳng định bằng-nhau-sâu
//       duy nhất trên cả object, không loại trường nào và không chuẩn hoá
//       nào áp lên hai phía trước khi so.
//   (d) `pendingUntil` được so dưới dạng chuỗi thô, từng byte. Khẳng định thêm nó
//       bằng dạng chuỗi literal mà cài đặt cam kết, để một thay đổi
//       dạng serialize về sau hỏng ở đây thay vì ở màn hình thanh toán.
//   (e) `qrPayload`, `accountNumber`, `accountName`, `memo` trên CẢ HAI giá trị
//       giống từng byte với thứ `createPaymentRequest()` mock đã trả —
//       lưu như được đưa, không bao giờ tính lại (Risk R-11 của frontend DD).
//   (f) Tồn tại đúng một bộ ánh xạ được export: `toCheckoutOrder` được import từ
//       `SOURCE/lib/billing/checkoutOrder.ts` bởi cả hai đường, và
//       `features/billing/queries.ts` không khai báo phép ánh xạ camelCase nội tuyến
//       nào của riêng nó cho hàng này.
//
//
// =============================================================================
//INT-3 — Mỗi người dùng một đơn sống: lần mua thứ hai trong cửa sổ 30 phút
//        dùng lại cùng đơn; sau cửa sổ thì một đơn mới được tạo
// =============================================================================
// AC-026: "Cho một lần khởi tạo đơn, khi hoàn tất, thì tồn tại đúng MỘT bản ghi
//          đơn với `orderCode` duy nhất, số tiền 39000, và trạng thái chờ."
//          (PRD :286)
// AC-027: "Cho một người dùng đã có một đơn ở trạng thái chờ CHƯA QUÁ 30 PHÚT,
//          khi họ bấm mua lần nữa, thì hệ thống TÁI DÙNG đúng đơn đó — cùng
//          `orderCode`, cùng số tiền, cùng mã QR — chứ KHÔNG tạo `orderCode`
//          mới. Sau thao tác, một truy vấn đếm đơn chờ của người dùng đó trả về
//          đúng 1." (PRD :287)
// EARS: "While" (có một đơn pending sống) + "If-then" (cửa sổ đã hết) ->
//   test điều kiện-trạng-thái với cả hai nhánh của vị từ cửa sổ.
// ROI: 72 (BV:9 x Freq:7 + Legal:0 + Defect:9)
//
// MỘT SKELETON CHO HAI AC — ghi lại để không bị đọc như một sơ suất.
//   AC-026 và AC-027 là một hành vi của `createOrder()`: "một người dùng có tối đa
//   một đơn sống, và lần kích hoạt thứ hai đáp xuống nó". AC-026 là
//   trạng thái kích hoạt-lần-đầu của bất biến đó và AC-027 là trạng thái
//   kích hoạt-lần-hai; Third verification point của backend DD đã viết
//   khẳng định (a) của AC-027 là `count(*) pending = 1`, chính là khẳng định của AC-026.
//   Chúng dùng chung một fixture, một chuỗi tác động và một kiểu hỏng chính, nên
//   là một test. Không AC nào nhận skeleton thứ hai ở bất kỳ đâu trong đợt
//   sinh này.
//
// Hành vi: người dùng kích hoạt mua -> đúng một hàng pending ở 39000 ->
//   kích hoạt lần nữa trong 30 phút -> CÙNG hàng đó được trả về và nhà cung cấp
//   không bị gọi lại -> kích hoạt lần nữa sau cửa sổ -> một orderCode mới
//   được tạo VÀ nhà cung cấp ĐƯỢC gọi.
// @category: core-functionality
// @lane: integration
// @dependency: bước (0) của createOrder(), payment_orders, PREMIUM_PRICE_VND
//   (lib/billing/pricing.ts), adapter payOS (createPaymentRequest)
// @complexity: high
// Ranh giới mock (Test Boundaries của backend DD, dòng bước (0) của `createOrder`): adapter
//   payOS bị mock VÀ ĐẾM — "đếm, không chỉ stub". Database là thật.
// @real-dependency: Postgres (payment_orders), Supabase dev, một phiên
//   authenticated
//
//Kiểu hỏng chính: cài đặt ngây thơ. Nó gọi lại nhà cung cấp,
//   bỏ kết quả, và trả hàng sẵn có. Cái đó qua khẳng định số-đếm-1 VÀ khẳng định
//   orderCode-bằng-nhau trong khi vẫn (i) tiêu tiền cho một request nhà cung cấp thứ
//   hai và (ii) để lại một liên kết payOS sống thứ hai
//   trỏ vào cùng đơn, và (iii) khởi động lại hạn chót 30 phút mà
//   người dùng đang đọc trên màn hình. Kiểu hỏng thứ hai là sửa
//   quá tay ngược lại: vị từ dùng lại thoái hoá thành "bất kỳ hàng pending nào,
//   mãi mãi", nên người dùng có đơn đã hết hạn không bao giờ bắt đầu được lần mua mới.
//
//Nghĩa vụ chứng minh:
//   - Hai trong bốn khẳng định con là VÔ HÌNH với khẳng định chỉ-giá-trị. Số lần
//     gọi adapter và tính giống-từng-byte của `pendingUntil` đều phải
//     được khẳng định, nếu không cài đặt ngây thơ ship xanh.
//   - Đường ranh giới phải đi qua: nhánh CỬA-SỔ-ĐÃ-HẾT. Đường chính (hai cú bấm
//     nhanh) vẫn xanh trong khi nửa hết hạn hồi quy, nên lần kích hoạt thứ ba
//     quá `pending_until` là một phần bắt buộc của test này, không phải
//     phần thêm tuỳ chọn.
//   - Trạng thái quan sát được trước/sau: SỐ ĐƠN pending của người dùng này, đọc
//     từ bảng thật bằng truy vấn, trước lần kích hoạt đầu (0) và sau
//     mỗi lần kích hoạt.
//   - Chỉ adapter payOS được mock — vị từ dùng lại được quyết định từ
//     `pending_until` thật của một hàng thật so với đồng hồ, chính là
//     thứ mà một client bị mock sẽ thôi chứng minh.
// Điểm kiểm chứng / kết quả mong đợi / tiêu chí qua:
//   (a) Sau `createOrder()` ĐẦU TIÊN:
//       `select count(*) from payment_orders where user_id = A and status =
//       'pending'` là CHÍNH XÁC 1; `amount` của hàng là literal 39000; `order_code`
//       của nó là duy nhất; trạng thái của nó là `pending`. (AC-026)
//   (b) Sau `createOrder()` THỨ HAI không chờ: cùng truy vấn đếm
//       trả CHÍNH XÁC 1. (AC-027, phép kiểm do chính PRD nêu)
//   (c) Hai `orderCode` trả về BẰNG NHAU.
//   (d) `createPaymentRequest` được gọi CHÍNH XÁC MỘT LẦN qua cả hai lời gọi.
//       Khẳng định số lần gọi, không phải "nó đã được gọi".
//   (e) `pendingUntil` GIỐNG TỪNG BYTE giữa hai giá trị trả về — đường dùng lại
//       không được khởi động lại cửa sổ.
//   (f) `qrPayload` và `amount` giống nhau giữa hai giá trị trả về (AC-027
//       "cùng mã QR, cùng số tiền").
//   (g) Rồi đẩy qua cửa sổ — ghi một hàng có `pending_until` ở quá khứ
//       thay vì ngủ 30 phút — và gọi `createOrder()` lần THỨ BA:
//       một `orderCode` MỚI được trả về (không bằng của (c)) VÀ số lần gọi
//       tích luỹ của `createPaymentRequest` giờ là CHÍNH XÁC 2.
//   (h) Teardown xoá mọi hàng tạo dưới user fixture của ca này, để
//       ca qua được khi chạy hai lần liên tiếp và khi chạy riêng lẻ.
//
//
// =============================================================================
// INT-3 — CÀI ĐẶT (plan Task 3.4, commit thêm nhánh dùng lại bước (0) của
//         createOrder())
// =============================================================================
// INT-1 và INT-2 ở trên vẫn chỉ có comment; chúng được điền bởi plan Tasks 5.3 và
// 3.5 tương ứng. Một file mang ít nhất một suite thật không còn dính
// "No test suite found" của vitest, nên làn này chuyển từ thoát mã 1 sang thoát mã 0 với
// commit này. Chuyển đổi đó là sản phẩm bàn giao, không phải tác dụng phụ.
//
// CÁI GÌ BỊ MOCK, VÀ VÌ SAO KHÔNG LÀM YẾU BẰNG CHỨNG — đúng hai thứ:
//   1. `createPaymentRequest` của adapter payOS. Đó là một dịch vụ ngoài TRẢ PHÍ,
//      và dòng Test Boundaries của backend DD cho bước (0) của `createOrder`
//      nói "đếm, không chỉ stub". `getPaymentStatus` cũng được
//      thay, bằng một stub ném lỗi, để một hồi quy với tới
//      nhà cung cấp từ đường này hỏng to thay vì chạm mạng.
//   2. `createClient` của `@/lib/supabase/server`, vốn chỉ tồn tại để dựng một
//      client từ COOKIE của request qua `next/headers` (không có ngoài một request
//      Next). Nó được thay bằng một client `@supabase/supabase-js` THẬT
//      giữ một phiên THẬT cho tài khoản fixture — cùng JWT và
//      cùng danh tính bị ràng buộc RLS mà production dùng.
//   Postgres KHÔNG bị mock. Vị từ dùng lại được quyết định từ `pending_until`
//   thật của một hàng thật so với đồng hồ, chính là thứ một client
//   bị mock sẽ thôi chứng minh.
//
// VÌ SAO THIẾU THÔNG TIN ĐĂNG NHẬP LÀM LÀN NÀY HỎNG THAY VÌ BỎ QUA: Implementation
//   Approach Phase 4 của backend DD nêu "CI không có database", và làn này
//   tôn trọng ngoại lệ đó bằng cách nằm hoàn toàn ngoài cổng CI, không bằng
//   cách suy giảm khi thiếu thông tin đăng nhập. `.github/workflows/ci.yml` chạy
//   `npm run lint`, `npx tsc --noEmit`, `npm test` và `npx next build`;
//   nó không bao giờ chạy `npm run test:integration`, và `vitest.config.ts` chỉ thu thập
//   lib/**, components/**, app/**, nên `tests/**` không với tới được từ CI bằng
//   hai đường độc lập. Thứ duy nhất có thể gọi config này là một lập trình viên
//   ngồi trước bàn phím, với họ thông tin đăng nhập vắng mặt là một
//   lỗi của người vận hành — một lượt chạy hỏng, không phải một ngoại lệ đã tài liệu hoá. Bỏ qua
//   im lặng còn tệ hơn vô dụng: tóm tắt của reporter có nói "skipped", nhưng hai
//   thứ mà người gọi thực sự dựa vào thì không — MÃ THOÁT là 0, y như
//   tám lần qua thật, và không cảnh báo nào đi kèm, vì vitest
//   nén output console ở cấp module của một file mà suite duy nhất bị bỏ qua. Một
//   .env.local bị đổi tên do đó được chứng nhận xanh y hệt code
//   chạy được. Chốt bên dưới NÉM LỖI Ở CẤP MODULE, tức lúc THU THẬP,
//   bất cứ khi nào một thông tin đăng nhập vắng mặt: làn thoát mã khác không và nêu tên
//   các biến thiếu. Thu thập là vị trí duy nhất đúng với MỌI lần gọi.
//   Một chốt đăng ký như một ca test thì chính nó là một ca test, nên
//   bộ lọc tên test của vitest loại nó đi: `-t "…"`, vòng lặp một ca thông thường,
//   cho `Tests 9 skipped (9)` và thoát mã 0 khi thiếu thông tin đăng nhập,
//   và một `.only` lạc cũng vô hiệu nó theo cách tương tự. Đã đo với lệnh ném lỗi
//   tại chỗ — cùng bộ lọc, thiếu thông tin đăng nhập: `Test Files 1 failed (1)`, thoát mã 1,
//   thông báo nêu tên biến; cùng bộ lọc, có thông tin đăng nhập: `1 passed |
//   7 skipped`, thoát mã 0, nên đường xanh không bị đụng. Không ca nào được đặt tên
//   được giữ cạnh lệnh ném: cả hai sẽ bắn cùng một điều kiện, và một lỗi thu thập
//   loại bỏ các task đã đăng ký của file (đo được `(0 test)` /
//   `Tests no tests`), nên một ca như vậy không bao giờ chạy được.
//
// VÌ SAO KHO GIỚI HẠN TẦN SUẤT DÙNG CHUNG BỊ TẮT CHO FILE NÀY: `guard()` vẫn
//   chạy — cửa sổ trượt trong RAM là thật và action vẫn đi qua nó — nhưng
//   bộ đếm Upstash CÓ THẨM QUYỀN sống qua các lượt chạy, và ca này tiêu ba suất
//   `createOrder` mỗi lượt trên trần 15 mỗi giờ. Để bật, một phiên mutation-testing
//   sẽ làm cạn trần và ca sẽ hỏng vì một lý do không liên quan.
//   Kho dùng chung có độ phủ riêng trong `lib/security/rateLimitStore.test.ts`; không gì INT-3
//   khẳng định liên quan tới nó.
//
//CHỈ DATABASE DEV. Thông tin đăng nhập đến từ `SOURCE/.env.local`
//   (ref `hynwleaxtbtjzkvpjsug`). `SOURCE/.env.local.prod-backup` không bao giờ được đọc.

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

// `createOrder()` tự từ chối khi chưa mở bán; bộ test này kiểm đường tạo đơn nên
// phải bật cờ (giá trị thật của môi trường không được quyết định kết quả).
vi.stubEnv("GEMINI_PAID_TIER_ENABLED", "true");

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
// INT-1 — IMPLEMENTATION: ĐÃ CHUYỂN (2026-09-18)
// =============================================================================
// Toàn bộ phần cài đặt INT-1 (mock `@upstash/redis`, mock điểm phát
// `@/lib/ugc/gemini`, fixture, helper và 10 ca) nằm NGUYÊN VĂN ở
// `SOURCE/tests/integration/pending/subscription-quota.int.test.ts`.
// Xem con trỏ ở đầu file để biết lý do và bước bật lại.

// =============================================================================
// INT-2 — CÀI ĐẶT (plan Task 3.5, commit đổi bước ánh xạ của getMyOrder()
//         sang `toCheckoutOrder(row)` — CL-01)
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

const { getMyOrder, listMyOrders } = await import("@/features/billing/queries");

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

const INT2_QUERIES_PATH = resolve(__dirname, "../../features/billing/queries.ts");

/** Nguồn của `features/billing/queries.ts` đã BÓC chú thích.
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
    it("(f) `features/billing/queries.ts` nhập và gọi `toCheckoutOrder()`, và KHÔNG tự khai một mapping camelCase nào cho dòng này", async () => {
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
