// Subscription (kỳ trả trước payOS) — module fixture LÀN SERVICE. Được
// `subscription.service.e2e.test.ts` dùng: SVC-1 (plan Task 6.1 / backend-task-29) và
// SVC-2 (plan Task 6.2 / backend-task-30). Chỉ được `SOURCE/vitest.localdb.config.ts`
// (`npm run test:localdb`) thu thập, không bao giờ bởi `npm test`.
//
// KHÔNG GÌ Ở ĐÂY ĐÃ ĐƯỢC CHẠY, VÀ ĐÓ LÀ TRẠNG THÁI FILE NÀY XUẤT XƯỞNG.
//   `payment_orders`, `subscriptions` và `record_payment_settlement` chưa tồn tại
//   trên database nào, và cổng schema B (plan Task 1.3 / backend-task-11) chưa
//   chạy trên dev. Vì vậy: teardown lũy đẳng THEO CẤU TRÚC — mỗi bước là
//   một `delete()` theo vị từ không có đọc-sửa-ghi, và `tearDown()` chạy được
//   trước khi `setUp()` từng chạy — là thuộc tính cấu trúc, KHÔNG phải thuộc tính
//   quan sát được. Phép kiểm hai-lần-chạy-liên-tiếp mà task chỉ định là
//   `tearDown(); setUp(); tearDown();` hai lượt, khẳng định `countFixtureRows()`
//   trả toàn số không sau mỗi teardown, và còn nợ ngay khi cổng B xanh.
//
// TIỀN LỆ. `SOURCE/features/exams/__tests__/recordSkillMastery.int.test.ts` (test làn service
//   duy nhất sẵn có của repo này) và `SOURCE/supabase/test-rls.ts`:
//   `.env.local` nạp bằng tay, một client `admin` service-role để gieo, một client anon
//   đã đăng nhập THẬT cho mỗi người dùng với bất cứ thứ gì RLS quyết định, một tiền tố id theo fixture,
//   và dọn dẹp chạy cả trước VÀ sau.
//
// TIỀN TỐ `sub-svc-` GIỚI HẠN ĐƯỢC VÀ KHÔNG ĐƯỢC GÌ — nêu vì một tiền tố
//   không với tới một bảng chính là cách một "teardown có tiền tố" rò thầm lặng.
//   `payment_orders.order_code` là `bigint` KHOÁ CHÍNH và `subscriptions.user_id`
//   là uuid: KHÔNG cái nào mang được chuỗi literal `sub-svc-`. Đây là tình huống
//   `test-rls.ts` đã gặp với `support_tickets.id`, và được giải quyết cùng cách
//   — giới hạn theo `user_id` sở hữu. Module này vì vậy teardown theo BA phạm vi,
//   và mỗi cái tồn tại vì các cái khác bỏ sót gì đó:
//     1. `user_id` thuộc hai tài khoản fixture của ca này — phạm vi DUY NHẤT bắt được
//        các hàng do code đang kiểm ghi, mà `order_code` và `memo` thì module này
//        không bao giờ chọn (`createOrder()` tự sinh).
//     2. Một KHỐI `order_code` dành riêng — bắt các hàng module này đã gieo mà
//        `user_id` bị đặt null do xoá tài khoản (cột là
//        `on delete set null`, cố ý: bản ghi tiền sống lâu hơn tài khoản).
//     3. Tiền tố EMAIL của tài khoản — cách các tài khoản của một lượt chạy sập trước đó được tìm
//        ra, vì id của chúng đã chết cùng tiến trình tạo ra chúng.
//   `memo` mang dấu `sub-svc-<caseTag>` và là phạm vi thứ tư, nhưng chỉ để PHÁT HIỆN
//   (`countFixtureRows()`), không bao giờ là vị từ xoá: `createOrder()` production
//   ghi memo `MSMOLAR <code>` của riêng nó, mà dấu này không bao giờ khớp, nên một
//   DELETE theo memo sẽ lặng lẽ bỏ sót đúng các hàng mà phạm vi 1 sinh ra để bắt.
//   Phạm vi 2 vét cạn với hàng ĐÃ GIEO và được giữ như vậy nhờ một phép kiểm biên:
//   `seedPendingOrder()` TỪ CHỐI một `orderCode` ngoài khối, nên không hàng nào module này
//   ghi có thể chỉ tới được bằng phạm vi 1 — thứ mà một việc xoá tài khoản
//   sẽ làm mắc kẹt, vì nó làm null `user_id` thay vì xoá hàng.
//
//   PHẠM VI NÀO TRONG BA ĐƯỢC CHỨNG MINH THẬT, và bởi gì. Nêu vì
//   đoạn trên là một khẳng định chuẩn tắc, và một khẳng định chuẩn tắc mà không test nào với tới chính là
//   dạng lỗi mà làn này sinh ra để bắt.
//     - Phạm vi 2 (khối) ĐƯỢC CHỨNG MINH, bởi ca mồ côi của SVC-1: nó tạo ra hình dạng hàng duy nhất
//       mà phạm vi 2 độc nhất với tới — `user_id` NULL — và khẳng định hàng mất
//       sau `tearDown()`. Xoá lệnh xoá theo khối bên dưới làm ca đó đỏ.
//     - Phạm vi 1 (`user_id`) CHƯA ĐƯỢC CHỨNG MINH trong làn service, và không chứng minh được ở đó:
//       một hàng chỉ phạm vi 1 với tới được phải nằm ngoài khối dành riêng, và
//       `requireCodeInBlock()` từ chối gieo cái như vậy. Chỉ một ca điều khiển `createOrder()`
//       production — thứ tự sinh mã — mới dựng được, và không ca SVC-1 nào làm.
//       Xoá lệnh xoá `user_id` bên dưới do đó để cả làn vẫn xanh.
//     - Phạm vi 3 (tiền tố email) được thực thi bởi mọi `setUp()`, vốn teardown trước.
//   Số đếm hàng của teardown chứng minh HỢP của phạm vi 1 và 2, không chứng minh riêng cái nào.
//
// `countFixtureRows()` QUAN SÁT ĐƯỢC VÀ KHÔNG QUAN SÁT ĐƯỢC GÌ — nêu vì một bộ phát hiện rò mà
//   không thể hỏng còn tệ hơn không có, vì nó đọc như bằng chứng.
//     - `authUsers` là ĐƯỢC KÉO THEO, không quan sát: `tearDown()` xoá mọi tài khoản được liệt kê
//       và `deleteUser` ném lỗi nếu lỗi, nên một `listFixtureUsers()` trả về là rỗng
//       theo cấu trúc. Nó KHÔNG có sức phân biệt nào sau một teardown đã trả về.
//     - `subscriptions` cũng được KÉO THEO, hai lần: `subscriptions.user_id` là
//       `on delete cascade`, và khi không còn tài khoản nào thì danh sách id rỗng, nên nhánh
//       bị bỏ qua và trả 0 MÀ KHÔNG TRUY VẤN. Cũng không có sức phân biệt.
//     - `paymentOrders` là số đếm duy nhất có thể hỏng vì lý do đúng, và chỉ
//       nhờ phạm vi `memo`: các phạm vi khối và `user_id` hỏi lại đúng hai
//       vị từ mà lệnh xoá vừa chạy, nên chúng trả 0 dù có hiệu lực hay không. Phạm vi
//       `memo` không chung vị từ nào với lệnh xoá nào.
//   Vậy phép kiểm hai-lần-chạy-liên-tiếp còn nợ khi cổng B xanh chứng minh vệ sinh fixture cho
//   `payment_orders` và, với hai phạm vi còn lại, chỉ chứng minh teardown không
//   ném lỗi. Đó là giá trị của các con số ấy; đọc chúng nhiều hơn thế sẽ là
//   khẳng định rỗng mà làn này sinh ra để tránh.
//
// TÀI KHOẢN FIXTURE BỊ XOÁ, khác với hai file tiền lệ giữ tài khoản của chúng.
//   Ba lý do, đều chịu lực ở đây mà không ở đó: (a) tiêu chí thành công của chính task
//   đếm cả các hàng `sub-svc-` còn lại trong bảng AUTH USERS;
//   (b) `subscriptions` khoá theo `user_id`, nên một tài khoản bền vững mang
//   `expires_at` của nó sang lượt chạy sau và "tiến đúng 30 ngày từ trạng thái
//   trước" của SVC-1 sẽ bị đo từ bất cứ thứ gì lượt chạy trước để lại;
//   (c) giới hạn tần suất của `guard()` khoá theo id người dùng ở Upstash và sống qua các lượt chạy
//   — mối nguy mà `recordSkillMastery.int.test.ts` ghi cho tài khoản bền vững của chính nó.
//   Thứ tự xoá là đơn → subscription → tài khoản, nên không đơn nào bị mồ côi bởi
//   cascade mà nó lẽ ra sẽ gặp.
//
// GIÁ TRỊ ĐÃ CHÉP VÀ CHỦ SỞ HỮU ĐỐI CHIẾU CỦA CHÚNG. Phần lớn thứ module này nêu tên
//   vẫn chưa tồn tại trong code, nên các hằng đó vẫn là bản chép KHÔNG CÓ liên kết
//   lúc biên dịch với khai báo thật — `tsc` không thấy được sự lệch ở đó,
//   và nói khác đi sẽ là khẳng định sai mà harness fixture-e2e anh em
//   đã bị sửa. Chủ sở hữu:
//     - `FixturePaymentStatusResult`            -> ĐÃ ĐỐI CHIẾU (backend-task-15 đã ship).
//       Nay là `Awaited<ReturnType<typeof getPaymentStatus>>` — một LIÊN KẾT lúc biên dịch
//       với kiểu trả về thật của adapter, không phải hình dạng chép tay. Đây là bản chép
//       duy nhất mà sự lệch vừa im lặng vừa chịu lực: object hai-thuộc-tính
//       CHÍNH LÀ P-1, nên một adapter mọc thêm thuộc tính thứ ba sẽ để file này
//       lặng lẽ mô tả một ranh giới không còn tồn tại.
//     - `FIXTURE_AMOUNT_VND`, cửa sổ 30 phút -> ĐÃ ĐỐI CHIẾU (backend-task-12 đã ship).
//       Cả hai nay được IMPORT từ `lib/billing/pricing.ts`, không chép, nên `tsc`
//       thấy được sự lệch ở hai cái này và lưu ý ở trên không còn áp dụng cho chúng.
//     - `FIXTURE_PERIOD_DAYS`, mọi tên bảng và cột -> backend-task-09 (`schema.sql`)
//   Tên cột khác với các bản chép kiểu ở một điểm đáng nêu:
//   chúng đi qua PostgREST dưới dạng CHUỖI, nên không thể có liên kết lúc biên dịch nào cho chúng —
//   nhưng phát hiện được lúc CHẠY, to tiếng, ở lần insert đầu khi cổng B
//   xanh. Đó là bảo đảm yếu hơn một lỗi kiểu và mạnh hơn không có gì,
//   và là mô tả trung thực của cả hai.
//
// HÌNH DẠNG TRẢ VỀ CỦA ADAPTER — mâu thuẫn là NỘI TÀI LIỆU, và đã được
//   sửa tại nguồn thay vì lách ở đây. Backend DD đòi object hai-thuộc-tính ở
//   BA nơi — § "Payer-identifying data is never stored
//   either" (P-1, chuẩn tắc: *"`settleOrder()` chỉ đọc `status` và `amount`"*), dòng
//   `transactions[]` của Field Propagation Map (*"mang `status` và `amount` và
//   không gì khác"*) và cơ chế kiểm chứng P-1 (*"được khẳng định có đúng hai
//   thuộc tính"*) — trong khi MỘT dòng, khối chữ ký dưới § `lib/billing/payos/`,
//   vẫn khai báo union trần `Promise<"pending"|"paid"|"cancelled"|"unknown">`. Connection Map
//   của work plan, backend-task-15 và backend-task-16 đồng ý với ba nơi kia,
//   và object hai-thuộc-tính là hình dạng duy nhất mà bước 3 của `settleOrder()` có thể
//   so số tiền của nhà cung cấp với hàng đã lưu, thứ SVC-1 thực thi. Vì
//   dòng lỗi thời nằm trong khối mà người cài đặt backend-task-15 chép từ đó, nó được
//   sửa trong DD (v1.7) thay vì chú thích ở đây. backend-task-15
//   sau đó đã đáp xuống object hai-thuộc-tính, và file này không còn nhắc lại nó:
//   kiểu bên dưới suy ra từ chữ ký của chính adapter, nên một adapter đáp xuống
//   bất cứ thứ gì khác giờ là lỗi `tsc` ở đây thay vì một bất ngờ khi SVC-1 chạy.
//
// SỐ ĐẾM ĐO LỜI GỌI, KHÔNG PHẢI HOÀN TẤT. Mọi bộ đếm được tăng TRƯỚC khi
//   cổng giữ được await và trước mọi từ chối được ném, nên một lời gọi đang
//   bay — hay sắp thất bại — đã được đếm. SVC-1(f) khẳng định số đếm
//   đúng bằng 1 với một adapter REJECT, và SVC-2(e) khẳng định 0 cho mỗi nhánh từ chối;
//   cả hai đọc một con số mà một stub đếm-hoàn-tất sẽ làm sai.
//
// KHÔNG CÓ TRẠNG THÁI KHẢ BIẾN DÙNG CHUNG. Mỗi fixture được tạo bởi
//   `createSubscriptionServiceFixture()` và sở hữu các tài khoản, khối mã đơn
//   và stub adapter của nó, nên hai ca không thể với tới hàng của nhau. Mảnh
//   trạng thái cấp module duy nhất của file là registry chỉ-thêm `caseTag` / `orderCodeBlock`
//   cạnh hàm dựng: không hành vi fixture nào đọc nó, nó chỉ ném lỗi khi dùng lại lúc
//   dựng, và tồn tại vì phương án khác là cưỡng chế hai
//   luật cô lập bằng review. Mảnh khác không thể sống ở đây là holder phiên
//   mà factory `vi.mock("@/lib/supabase/server")` đọc:
//   `vi.mock` được hoist lên trên import, nên holder phải được tạo
//   trong file test bằng `vi.hoisted` (đúng như `recordSkillMastery.int.test.ts`
//   làm) và truyền vào. Nó là tham số được tiêm, không phải global dùng chung:
//
//     const { sessionHolder } = vi.hoisted(() => ({
//       sessionHolder: { current: null as SupabaseClient | null },
//     }));
//     vi.mock("@/lib/supabase/server", () => ({
//       createClient: async () => {
//         if (!sessionHolder.current) throw new Error("no active fixture session");
//         return sessionHolder.current;
//       },
//     }));

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { ORDER_PENDING_WINDOW_MS, PREMIUM_PRICE_VND } from "@/lib/billing/pricing";
import type { getPaymentStatus } from "@/lib/billing/payos";

// --- Environment ------------------------------------------------------------

/** Vitest không nạp `.env.local`; file tiền lệ nạp nó bằng tay và file này cũng vậy.
 *  Dấu nháy ngoài bị gỡ vì Next gỡ chúng khi nạp cùng file đó, nên nhiều giá trị
 *  trong đó được viết có nháy mà vẫn chạy ở production.
 *  Không bao giờ ghi đè một biến đã có sẵn trong môi trường. */
function loadEnvLocal(): void {
  const path = fileURLToPath(new URL("../../../.env.local", import.meta.url));
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^(["'])(.*)\1$/, "$2");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Cổng cho `describe.skipIf(!HAS_LIVE_DB)`, đọc lúc import vì việc bỏ qua được
 *  quyết định lúc thu thập. Nó nói ba biến môi trường có mặt và KHÔNG GÌ HƠN — đặc biệt
 *  nó không nói cổng schema B xanh, vốn là điều kiện tiên quyết riêng, chặn
 *  để chạy bất kỳ ca nào trong làn này. */
export const HAS_LIVE_DB = Boolean(SUPABASE_URL && ANON_KEY && SERVICE_ROLE_KEY);

// --- Giá trị đã chép (xem comment đầu file cho chủ sở hữu đối chiếu) -----------

/** Dấu cô lập của làn. Nó tới email tài khoản và `payment_orders.memo`;
 *  nó không tới được `order_code` hay `user_id` — xem comment đầu file. */
export const SUB_SVC_PREFIX = "sub-svc-";

/** `PREMIUM_PRICE_VND` thật (AC-026), được import thay vì chép. Đổi giá nay
 *  làm số tiền gieo đổi theo; `39_000` chép tay trước đây sẽ để làn này
 *  lặng lẽ gieo giá cũ so với code mới. */
export const FIXTURE_AMOUNT_VND = PREMIUM_PRICE_VND;

/** `record_payment_settlement(p_period_days default 30)`. Chép — chủ sở hữu
 *  backend-task-09. SVC-1 tính các thời điểm kỳ vọng từ cái này và khẳng định chúng dưới dạng
 *  literal; nó không bao giờ được đọc lại kỳ hạn đã cấp từ hàm đang kiểm. */
export const FIXTURE_PERIOD_DAYS = 30;

/** Mã đơn được cấp từ một dải dành riêng cao hơn nhiều so với epoch-mili giây, thứ mà
 *  `createOrder()` thật suy mã của nó từ đó — nên một mã fixture không thể
 *  va chạm với mã thật, và lệnh xoá theo khối trong `tearDown()` không thể với tới một hàng
 *  thật. Mỗi instance fixture sở hữu một khối gồm `FIXTURE_ORDER_CODE_BLOCK_SIZE`
 *  mã liên tiếp. */
export const FIXTURE_ORDER_CODE_BASE = 8_000_000_000_000;
export const FIXTURE_ORDER_CODE_BLOCK_SIZE = 1_000;

/** Một chuỗi payload VietQR/EMVCo, không phải URL (UI-D14). Vô hại ở đây — không ca service nào
 *  đọc nó như một QR — nhưng cột là `not null` và giá trị trống sẽ cho phép một
 *  khẳng định "cả bốn trường chuyển khoản sống sót" qua trên một hàng rỗng. */
const FIXTURE_QR_PAYLOAD =
  "00020101021238570010A00000072701270006970436011300110012345670208QRIBFTTA53037045802VN62190815MSMOLAR17555184006304A1B2";
const FIXTURE_ACCOUNT_NUMBER = "0011001234567";
const FIXTURE_ACCOUNT_NAME = "CONG TY TNHH MS MOLAR";

const FIXTURE_PASSWORD = "sub-svc-password-123";

/** Cận trên số hàng đọc khi đếm hàng còn sót. Một ca gieo cỡ một chữ số
 *  hàng, nên chạm giới hạn này nghĩa là có gì đó rất sai — và số đếm báo cáo
 *  khi đó là một cận dưới chứ không phải tổng. Tường minh thay vì dựa vào
 *  kích thước trang ngầm của PostgREST, thứ cắt bớt một cách im lặng. */
const FIXTURE_ROW_SCAN_LIMIT = 1_000;

// --- Hình dạng hàng (tên cột đã chép — chủ sở hữu backend-task-09) -----------

/** Mười một cột của `payment_orders`. Các hàng được đọc bằng `select("*")` và kiểu này
 *  là một góc nhìn trên kết quả, nên một cột thứ mười hai thêm về sau vẫn tham gia
 *  phép so sánh giống-từng-byte của SVC-2 thay vì bị phép chiếu của select loại bỏ. */
export interface PaymentOrderRow {
  order_code: number;
  user_id: string | null;
  amount: number;
  status: string;
  created_at: string;
  pending_until: string;
  settled_at: string | null;
  qr_payload: string;
  account_number: string;
  account_name: string;
  memo: string;
}

export interface SubscriptionRow {
  user_id: string;
  expires_at: string;
  period_anchor_at: string;
  updated_at: string;
}

/** Thứ mà `seedPendingOrder()` đã ghi, theo từ vựng của người gọi — trả về để một ca có thể
 *  khẳng định theo các giá trị nó đã yêu cầu thay vì đọc lại hàng mà nó sắp
 *  đưa ra khẳng định. */
export interface SeededOrder {
  orderCode: number;
  userId: string;
  amountVnd: number;
  status: string;
  pendingUntil: string;
  memo: string;
}

export interface SeedOrderOverrides {
  /** Phải nằm trong khối dành riêng của fixture này, nếu không bị từ chối — một hàng
   *  ngoài khối chỉ tới được bằng phạm vi `user_id` sở hữu, nên nó sẽ
   *  sống sót qua teardown ngay khi việc xoá tài khoản làm null cột đó. */
  orderCode?: number;
  amountVnd?: number;
  /** Một trong bốn literal CHECK của `payment_orders.status`. */
  status?: string;
  /** Mặc định là bây giờ + cửa sổ 30 phút. Truyền một thời điểm quá khứ cho
   *  nhánh cửa-sổ-đã-hết-hạn. Cố ý tương đối theo đồng hồ thật: vị từ
   *  đang kiểm so với `now()` của Postgres, và làn này không kiểm soát đồng hồ
   *  của database — không có ghim nào ở đây và cũng không tuyên bố có. */
  pendingUntil?: string;
}

// --- Stub adapter payOS có đếm -----------------------------------------

/** Giá trị trả về của `getPaymentStatus()`, NỐI với adapter thay vì chép từ
 *  nó: đúng hai thuộc tính, và đúng hai là mấu chốt (P-1) — adapter là
 *  nơi từ vựng của nhà cung cấp dừng lại. Một thuộc tính thứ ba xuất hiện trên kiểu trả về thật
 *  là lỗi biên dịch ở mọi ca SVC đọc stub này, là thứ duy nhất
 *  làm sự lệch nhìn thấy được trước một lượt settlement. Xem comment đầu file.
 *
 *  Import chỉ-kiểu: `lib/billing/payos/index.ts` mang `import "server-only"`, nên
 *  kéo nó vào như một giá trị sẽ ném lỗi ngay khi module này nạp. `import type`
 *  bị xoá, nên liên kết này không tốn gì lúc chạy. */
export type FixturePaymentStatusResult = Awaited<ReturnType<typeof getPaymentStatus>>;

export type PayosPaymentStatus = FixturePaymentStatusResult["status"];

/** Chỉ stub `getPaymentStatus`. `createPaymentRequest` và
 *  `verifyWebhookSignature` cố ý vắng mặt: không ca SVC nào với tới chúng
 *  (cả hai gieo đơn trực tiếp thay vì qua `createOrder()`), và
 *  chép giá trị trả về bảy trường của `createPaymentRequest` sẽ thêm một bề mặt trôi lệch
 *  không phát hiện được thứ hai mà chẳng được gì. Ai cần chúng thì thêm. */
export interface PayosAdapterStub {
  /** Tăng khi VÀO `simulateGetPaymentStatus` — trước cổng giữ và
   *  trước mọi từ chối. Một lời gọi bị giữ hay thất bại đã được đếm. */
  getPaymentStatusCallCount: number;
  /** Mã đơn truyền cho `simulateGetPaymentStatus`, theo thứ tự gọi: một lời gọi
   *  tới sai đơn vẫn là số đếm một. */
  getPaymentStatusOrderCodes: number[];
  setPaymentStatus(result: FixturePaymentStatusResult): void;
  /** Gắn một từ chối cho mọi lời gọi tiếp theo; `null` gỡ. SVC-1(f) khẳng định
   *  số lần gọi đúng bằng 1 sau một lời gọi bị từ chối — không bão thử lại. */
  setPaymentStatusRejection(error: Error | null): void;
  /** Thế chỗ `getPaymentStatus(orderCode)` thật. Không nhà cung cấp nào được liên hệ và
   *  không tiền nào chuyển. */
  simulateGetPaymentStatus(orderCode: number): Promise<FixturePaymentStatusResult>;
  /** Gắn cổng giữ: từ lời gọi kế tiếp, `simulateGetPaymentStatus` đếm và ghi
   *  như thường rồi Ở YÊN CHƯA GIẢI QUYẾT cho tới `releaseHeldPaymentStatus()`. Việc gắn
   *  không bị lời gọi đầu tiêu thụ, nên lời gọi đồng thời thứ hai cũng bị giữ — điều
   *  làm ca settlement đồng thời của SVC-1 (ca chứng minh độ lệch hai-câu-lệnh
   *  ADR-0014 đã ghi chứ không giả định) tranh chấp một cách xác định
   *  thay vì theo lời gọi nào mạng tình cờ trả lời trước. */
  holdNextPaymentStatus(): void;
  /** Giải quyết mọi lời gọi bị giữ bằng kết quả được cấu hình TẠI LÚC THẢ, nên một ca có thể
   *  giữ, cấu hình lại, rồi thả. Gỡ cổng giữ. */
  releaseHeldPaymentStatus(): void;
  /** Về mặc định. Thả mọi lời gọi bị giữ trước — một cổng giữ bị rò sẽ giam
   *  lời gọi của nhánh kế tiếp ở trạng thái đang bay thay vì làm nó hỏng. SVC-2 gọi cái này giữa
   *  hai nhánh từ chối của nó, vì mỗi nhánh khẳng định số đếm 0 của riêng nó.
   *
   *  Một lời gọi bị giữ qua một `reset()` RESOLVE với mặc định đã khôi phục; nó không
   *  reject, kể cả khi một từ chối đã được gắn lúc nó được gọi, vì từ chối được
   *  đọc sau khi thức dậy và `reset()` đã gỡ nó. Cố ý: một lỗi cũ
   *  nổi lên trong ca KẾ TIẾP còn tệ hơn một giá trị mặc định lọt ra khỏi ca trước.
   *  Lời gọi của nó đã được đếm trên bộ đếm mà `reset()` sau đó đặt về 0. */
  reset(): void;
}

const DEFAULT_PAYMENT_STATUS: FixturePaymentStatusResult = {
  status: "pending",
  amount: FIXTURE_AMOUNT_VND,
};

export function createPayosAdapterStub(): PayosAdapterStub {
  let result: FixturePaymentStatusResult = { ...DEFAULT_PAYMENT_STATUS };
  let rejection: Error | null = null;
  let releaseHold: (() => void) | null = null;
  let heldGate: Promise<void> | null = null;

  const stub: PayosAdapterStub = {
    getPaymentStatusCallCount: 0,
    getPaymentStatusOrderCodes: [],
    setPaymentStatus(next) {
      // Sao chép, không alias: `DEFAULT_PAYMENT_STATUS` được spread trên cả hai đường
      //  cài nó, và một object do người gọi sở hữu mà ta giữ theo danh tính sẽ để một
      //  đột biến về sau của nó đổi thứ một stub đã cấu hình trả lời.
      result = { ...next };
    },
    setPaymentStatusRejection(error) {
      rejection = error;
    },
    async simulateGetPaymentStatus(orderCode) {
      stub.getPaymentStatusCallCount += 1;
      stub.getPaymentStatusOrderCodes.push(orderCode);
      // Bắt trước await: `releaseHeldPaymentStatus()` xoá `heldGate`, và một
      //  lời gọi đang chờ vẫn phải được đánh thức bởi chính cổng đó.
      const gate = heldGate;
      if (gate) await gate;
      // Đọc sau await, để một từ chối hay kết quả được cấu hình trong lúc giữ
      //  áp dụng cho lời gọi đã bị giữ.
      if (rejection) throw rejection;
      return result;
    },
    holdNextPaymentStatus() {
      if (heldGate) return;
      heldGate = new Promise<void>((resolve) => {
        releaseHold = resolve;
      });
    },
    releaseHeldPaymentStatus() {
      releaseHold?.();
      releaseHold = null;
      heldGate = null;
    },
    reset() {
      stub.releaseHeldPaymentStatus();
      stub.getPaymentStatusCallCount = 0;
      stub.getPaymentStatusOrderCodes = [];
      result = { ...DEFAULT_PAYMENT_STATUS };
      rejection = null;
    },
  };
  return stub;
}

// --- The fixture ------------------------------------------------------------

export type FixtureUserRole = "A" | "B";

/** Object `vi.hoisted` mà factory `vi.mock("@/lib/supabase/server")` của file test
 *  đọc. Được tiêm vào thay vì sở hữu ở đây vì `vi.mock` được hoist lên trên import —
 *  xem comment đầu file. */
export interface ServiceSessionHolder {
  current: SupabaseClient | null;
}

export interface SubscriptionServiceFixtureOptions {
  /** Phân biệt tài khoản và memo của ca này. Chỉ chữ thường, chữ số và
   *  dấu gạch nối, vì nó đi vào phần local của email. Phải duy nhất trong
   *  file — dùng lại sẽ ném lỗi, xem registry cạnh `createSubscriptionServiceFixture()`. */
  caseTag: string;
  /** Tính từ 0; mỗi khối rộng `FIXTURE_ORDER_CODE_BLOCK_SIZE` mã. Hai ca trong cùng
   *  file phải truyền các khối khác nhau — điều đó, cùng với các tài khoản theo từng ca, là
   *  thứ làm teardown của ca này không thể với tới hàng của ca khác — và dùng lại
   *  ném lỗi thay vì dựa vào việc ai đó nhớ. */
  orderCodeBlock: number;
  sessionHolder: ServiceSessionHolder;
}

/** Cả ba phải bằng 0 sau `tearDown()`. Báo cáo riêng thay vì cộng: cái nào khác 0
 *  cho biết phạm vi nào đã rò. Chỉ `paymentOrders` mới có thể khác 0 sau một
 *  teardown đã trả về — hai cái kia được kéo theo bởi chính các hành động của teardown, xem
 *  mục "`countFixtureRows()` quan sát được và không quan sát được gì" ở comment đầu file. */
export interface FixtureRowCounts {
  paymentOrders: number;
  subscriptions: number;
  authUsers: number;
}

export interface SubscriptionServiceFixture {
  /** Stub payOS có đếm mà `vi.mock` của `@/lib/billing/payos/` ở ca này định tuyến tới. */
  readonly adapter: PayosAdapterStub;
  /** Teardown trước — để một lượt chạy sập trước teardown của chính nó không thể làm nhiễm lượt này
   *  — rồi tạo cả hai tài khoản, đăng nhập cả hai, và đặt A là
   *  phiên hoạt động. */
  setUp(): Promise<void>;
  /** Lũy đẳng theo cấu trúc: chỉ xoá theo vị từ, và chạy được trước `setUp()`.
   *  Cũng thả cổng giữ của adapter và xoá holder phiên. */
  tearDown(): Promise<void>;
  countFixtureRows(): Promise<FixtureRowCounts>;
  userId(role: FixtureUserRole): string;
  /** Client anon đã đăng nhập cho một vai — RLS áp dụng cho nó. Đây là "hai phiên thật
   *  trên một database" mà SVC-2 đòi; một client bị mock sẽ khẳng định `null` của mock
   *  chứ không phải của policy `orders_select_own`. */
  sessionFor(role: FixtureUserRole): SupabaseClient;
  /** Trỏ holder được tiêm vào một vai, tức quyết định lời gọi Server Action kế tiếp chạy
   *  dưới danh nghĩa ai. */
  useSession(role: FixtureUserRole): void;
  /** Client service-role, để gieo và để đọc lại trạng thái vượt RLS. Một cái cho mỗi
   *  fixture, để không ca nào dựng client đặc quyền thứ hai với cách xử lý env riêng. */
  admin(): SupabaseClient;
  nextOrderCode(): number;
  seedPendingOrder(role: FixtureUserRole, overrides?: SeedOrderOverrides): Promise<SeededOrder>;
  seedSubscription(
    role: FixtureUserRole,
    subscription: { expiresAt: string; periodAnchorAt: string }
  ): Promise<void>;
  readOrderRow(orderCode: number): Promise<PaymentOrderRow | null>;
  readSubscriptionRow(role: FixtureUserRole): Promise<SubscriptionRow | null>;
}

const CASE_TAG_PATTERN = /^[a-z0-9-]+$/;

/** Trạng thái cấp module duy nhất trong file này, và nó CHỈ-THÊM và không bao giờ được hành vi
 *  fixture nào đọc — tác dụng duy nhất là ném lỗi lúc dựng, trước mọi
 *  lời gọi mạng, nên nó không thể làm hàng của ca này nhìn thấy được với ca khác. Nó tồn tại vì
 *  hai luật cô lập trước đó chỉ được cưỡng chế bằng review và cả hai đều hỏng
 *  một cách phá huỷ và im lặng: hai fixture dùng chung `caseTag` dùng chung tiền tố email, nên
 *  `setUp()` của cái thứ hai — vốn teardown trước — XOÁ TÀI KHOẢN CỦA CÁI THỨ NHẤT
 *  giữa lượt chạy, và hai fixture dùng chung `orderCodeBlock` xoá đơn của nhau.
 *
 *  Phạm vi: một registry module cho mỗi file test, đúng là nơi luật có hiệu lực (hai
 *  ca trong một file). Nó không nói gì xuyên file; hai file có thể hợp lệ dùng lại một
 *  khối, đó là lý do tài khoản cũng theo từng `caseTag`.
 *
 *  Nó cấm một mẫu trông-hợp-lý: dựng lại cùng fixture ở mỗi test trong `beforeEach`.
 *  Dựng một lần ở phạm vi `describe` và gọi `setUp()` mỗi test —
 *  `setUp()` là điểm vào lũy đẳng, và dựng lại không mang lại gì. */
const claimedCaseTags = new Set<string>();
const claimedOrderCodeBlocks = new Set<number>();

export function createSubscriptionServiceFixture(
  options: SubscriptionServiceFixtureOptions
): SubscriptionServiceFixture {
  const { caseTag, orderCodeBlock, sessionHolder } = options;
  if (!CASE_TAG_PATTERN.test(caseTag)) {
    throw new Error(`caseTag must match ${String(CASE_TAG_PATTERN)}: got "${caseTag}"`);
  }
  if (!Number.isInteger(orderCodeBlock) || orderCodeBlock < 0) {
    throw new Error(`orderCodeBlock must be a non-negative integer: got ${orderCodeBlock}`);
  }
  if (claimedCaseTags.has(caseTag)) {
    throw new Error(
      `caseTag "${caseTag}" is already claimed in this file — two fixtures sharing a tag ` +
        `share an email prefix, so one setUp() would delete the other's accounts`
    );
  }
  if (claimedOrderCodeBlocks.has(orderCodeBlock)) {
    throw new Error(
      `orderCodeBlock ${orderCodeBlock} is already claimed in this file — two fixtures ` +
        `sharing a block would delete each other's orders`
    );
  }
  claimedCaseTags.add(caseTag);
  claimedOrderCodeBlocks.add(orderCodeBlock);

  const emailPrefix = `smithnguyen247+${SUB_SVC_PREFIX}${caseTag}-`;
  const emailFor = (role: FixtureUserRole) => `${emailPrefix}${role.toLowerCase()}@gmail.com`;
  const memoPrefix = `${SUB_SVC_PREFIX}${caseTag}`;
  const blockStart = FIXTURE_ORDER_CODE_BASE + orderCodeBlock * FIXTURE_ORDER_CODE_BLOCK_SIZE;
  const blockEnd = blockStart + FIXTURE_ORDER_CODE_BLOCK_SIZE;

  const adapter = createPayosAdapterStub();
  const userIds: Partial<Record<FixtureUserRole, string>> = {};
  const sessions: Partial<Record<FixtureUserRole, SupabaseClient>> = {};
  let adminClient: SupabaseClient | null = null;
  let nextCode = blockStart;

  function requireEnv(): { url: string; anonKey: string; serviceRoleKey: string } {
    if (!SUPABASE_URL || !ANON_KEY || !SERVICE_ROLE_KEY) {
      throw new Error(
        "service lane: missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / " +
          "SUPABASE_SERVICE_ROLE_KEY. This lane only has meaning against a real dev database."
      );
    }
    return { url: SUPABASE_URL, anonKey: ANON_KEY, serviceRoleKey: SERVICE_ROLE_KEY };
  }

  function admin(): SupabaseClient {
    if (!adminClient) {
      const { url, serviceRoleKey } = requireEnv();
      adminClient = createClient(url, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }
    return adminClient;
  }

  /** Mọi tài khoản có email mang tiền tố của ca này — kể cả những tài khoản bị bỏ lại bởi
   *  một lượt chạy sập trước teardown của nó, mà id đã chết cùng tiến trình đó. */
  async function listFixtureUsers(): Promise<Array<{ id: string; email: string }>> {
    const list = await admin().auth.admin.listUsers({ perPage: 1000 });
    if (list.error) throw list.error;
    return list.data.users
      .filter((user) => (user.email ?? "").startsWith(emailPrefix))
      .map((user) => ({ id: user.id, email: user.email ?? "" }));
  }

  async function createFixtureUser(role: FixtureUserRole): Promise<string> {
    const created = await admin().auth.admin.createUser({
      email: emailFor(role),
      password: FIXTURE_PASSWORD,
      email_confirm: true,
    });
    if (created.error) throw created.error;
    return created.data.user.id;
  }

  async function signInAs(role: FixtureUserRole): Promise<SupabaseClient> {
    const { url, anonKey } = requireEnv();
    const client = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({
      email: emailFor(role),
      password: FIXTURE_PASSWORD,
    });
    if (error) throw error;
    return client;
  }

  function requireUserId(role: FixtureUserRole): string {
    const id = userIds[role];
    if (!id) throw new Error(`fixture user ${role} is not set up — call setUp() first`);
    return id;
  }

  function requireSession(role: FixtureUserRole): SupabaseClient {
    const client = sessions[role];
    if (!client) throw new Error(`session ${role} is not signed in — call setUp() first`);
    return client;
  }

  /** Hợp của mọi phạm vi mà một hàng còn sót có thể được tìm thấy — chỉ để PHÁT HIỆN, rộng hơn
   *  tập vị từ mà `tearDown()` xoá theo, và cố ý như vậy. Phạm vi khối
   *  và `user_id` một mình không thể hỏng sau một teardown vừa xoá theo chính
   *  hai vị từ đó, nên chúng báo 0 dù lệnh xoá có hiệu lực hay không. Phạm vi
   *  `memo` không chung vị từ nào với lệnh xoá nào, điều tạo ra sức phân biệt cho số đếm:
   *  một hàng module này đã gieo mà lệnh xoá theo khối không xoá
   *  vẫn mang dấu, và vẫn nhìn thấy được ở đây.
   *
   *  `memo like '<prefix>%'` là khớp tiền tố, nên một `caseTag` là tiền tố của tag của
   *  ca khác sẽ báo thừa các hàng của ca đó. Báo thừa là hướng an toàn cho bộ phát hiện
   *  rò; báo thiếu là kiểu hỏng mà phạm vi này sinh ra để ngăn. */
  async function orderCodesInScope(userIdList: string[]): Promise<Set<number>> {
    const codes = new Set<number>();
    const inBlock = await admin()
      .from("payment_orders")
      .select("order_code")
      .gte("order_code", blockStart)
      .lt("order_code", blockEnd)
      .limit(FIXTURE_ROW_SCAN_LIMIT);
    if (inBlock.error) throw inBlock.error;
    for (const row of (inBlock.data ?? []) as Array<{ order_code: number }>) {
      codes.add(Number(row.order_code));
    }
    const marked = await admin()
      .from("payment_orders")
      .select("order_code")
      .like("memo", `${memoPrefix}%`)
      .limit(FIXTURE_ROW_SCAN_LIMIT);
    if (marked.error) throw marked.error;
    for (const row of (marked.data ?? []) as Array<{ order_code: number }>) {
      codes.add(Number(row.order_code));
    }
    if (userIdList.length > 0) {
      const owned = await admin()
        .from("payment_orders")
        .select("order_code")
        .in("user_id", userIdList)
        .limit(FIXTURE_ROW_SCAN_LIMIT);
      if (owned.error) throw owned.error;
      for (const row of (owned.data ?? []) as Array<{ order_code: number }>) {
        codes.add(Number(row.order_code));
      }
    }
    return codes;
  }

  /** Một `orderCode` tường minh bỏ qua bộ cấp phát, nên nó được kiểm biên ở đây vì
   *  cùng lý do bộ cấp phát từ chối chạy quá `blockEnd`: khối dành riêng là
   *  phạm vi duy nhất còn với tới một hàng đã gieo sau khi tài khoản chủ của nó biến mất. */
  function requireCodeInBlock(code: number): number {
    if (!Number.isInteger(code) || code < blockStart || code >= blockEnd) {
      throw new Error(
        `orderCode ${code} is outside fixture block ${orderCodeBlock} ` +
          `([${blockStart}, ${blockEnd})) — a row seeded there cannot be torn down by block`
      );
    }
    return code;
  }

  function allocateOrderCode(): number {
    if (nextCode >= blockEnd) {
      throw new Error(
        `order-code block ${orderCodeBlock} exhausted (${FIXTURE_ORDER_CODE_BLOCK_SIZE} codes)`
      );
    }
    const code = nextCode;
    nextCode += 1;
    return code;
  }

  async function tearDown(): Promise<void> {
    adapter.reset();
    sessionHolder.current = null;
    delete sessions.A;
    delete sessions.B;
    delete userIds.A;
    delete userIds.B;
    nextCode = blockStart;

    const users = await listFixtureUsers();
    const ids = users.map((user) => user.id);

    // Đơn trước tài khoản: `payment_orders.user_id` là `on delete set null`, nên một
    //  tài khoản bị xoá trước sẽ để đơn của nó sống và không với tới được bằng phạm vi 1.
    const blockDelete = await admin()
      .from("payment_orders")
      .delete()
      .gte("order_code", blockStart)
      .lt("order_code", blockEnd);
    if (blockDelete.error) throw blockDelete.error;

    if (ids.length > 0) {
      const ownedDelete = await admin().from("payment_orders").delete().in("user_id", ids);
      if (ownedDelete.error) throw ownedDelete.error;
      const subscriptionDelete = await admin().from("subscriptions").delete().in("user_id", ids);
      if (subscriptionDelete.error) throw subscriptionDelete.error;
    }

    for (const user of users) {
      const deleted = await admin().auth.admin.deleteUser(user.id);
      if (deleted.error) throw deleted.error;
    }
  }

  return {
    adapter,

    async setUp() {
      await tearDown();
      userIds.A = await createFixtureUser("A");
      userIds.B = await createFixtureUser("B");
      sessions.A = await signInAs("A");
      sessions.B = await signInAs("B");
      nextCode = blockStart;
      sessionHolder.current = requireSession("A");
    },

    tearDown,

    async countFixtureRows() {
      const users = await listFixtureUsers();
      const ids = users.map((user) => user.id);
      const codes = await orderCodesInScope(ids);

      let subscriptions = 0;
      if (ids.length > 0) {
        const rows = await admin()
          .from("subscriptions")
          .select("user_id", { count: "exact", head: true })
          .in("user_id", ids);
        if (rows.error) throw rows.error;
        subscriptions = rows.count ?? 0;
      }

      return { paymentOrders: codes.size, subscriptions, authUsers: users.length };
    },

    userId: requireUserId,

    sessionFor: requireSession,

    useSession(role) {
      sessionHolder.current = requireSession(role);
    },

    admin,

    nextOrderCode: allocateOrderCode,

    async seedPendingOrder(role, overrides = {}) {
      const orderCode =
        overrides.orderCode === undefined
          ? allocateOrderCode()
          : requireCodeInBlock(overrides.orderCode);
      const userId = requireUserId(role);
      const amountVnd = overrides.amountVnd ?? FIXTURE_AMOUNT_VND;
      const status = overrides.status ?? "pending";
      const pendingUntil =
        overrides.pendingUntil ?? new Date(Date.now() + ORDER_PENDING_WINDOW_MS).toISOString();
      const memo = `${memoPrefix} ${orderCode}`;

      const inserted = await admin().from("payment_orders").insert({
        order_code: orderCode,
        user_id: userId,
        amount: amountVnd,
        status,
        pending_until: pendingUntil,
        qr_payload: FIXTURE_QR_PAYLOAD,
        account_number: FIXTURE_ACCOUNT_NUMBER,
        account_name: FIXTURE_ACCOUNT_NAME,
        memo,
      });
      if (inserted.error) throw inserted.error;

      return { orderCode, userId, amountVnd, status, pendingUntil, memo };
    },

    async seedSubscription(role, subscription) {
      const upserted = await admin()
        .from("subscriptions")
        .upsert(
          {
            user_id: requireUserId(role),
            expires_at: subscription.expiresAt,
            period_anchor_at: subscription.periodAnchorAt,
          },
          { onConflict: "user_id" }
        );
      if (upserted.error) throw upserted.error;
    },

    async readOrderRow(orderCode) {
      const row = await admin()
        .from("payment_orders")
        .select("*")
        .eq("order_code", orderCode)
        .maybeSingle();
      if (row.error) throw row.error;
      return (row.data as PaymentOrderRow | null) ?? null;
    },

    async readSubscriptionRow(role) {
      const row = await admin()
        .from("subscriptions")
        .select("*")
        .eq("user_id", requireUserId(role))
        .maybeSingle();
      if (row.error) throw row.error;
      return (row.data as SubscriptionRow | null) ?? null;
    },
  };
}
