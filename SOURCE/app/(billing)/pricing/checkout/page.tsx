// S-06 `/pricing/checkout` — màn thanh toán (UI Spec § Component:
// `PaymentPanel` — C-13; frontend DD § Main Components). Server component.
//
// CHỐT ĐĂNG NHẬP CHẠY TRƯỚC MỌI LƯỢT ĐỌC, cùng khuôn với `me/orders/page.tsx`
// và `(HM)/history/page.tsx`. Thứ tự hai dòng đầu là điều kiện được nghiệm thu
// chứ không phải thói quen: `getMyOrder()` đứng trước chốt vẫn trả `null` (RLS
// `orders_select_own` lọc sạch), nên màn hình trông vẫn ĐÚNG trong khi một
// khách chưa đăng nhập đã kịp chạm vào database. Đích chuyển hướng là
// `/?auth=signin` — KHÔNG phải `/login`, một route không tồn tại trong repo này.
//
// ĐƯỜNG NHẬN `?order=` LÀ MỘT DANH SÁCH CHẤP NHẬN, KHÔNG PHẢI MỘT LƯỢT PHÂN
// TÍCH. Xem `parseOrderCode()` bên dưới — đó là toàn bộ lý do tồn tại của file
// này ở Task 4.2.
//
// BỐN NGUYÊN NHÂN, MỘT TRẠNG THÁI RỖNG. Không `?order=`, một `?order=` không
// phân tích được, một mã không dòng nào khớp, và một mã CỦA NGƯỜI KHÁC — cả bốn
// ra CÙNG một nhánh `order === null`, và sự không phân biệt được ấy là CỐ Ý
// (§ Security Considerations): trả lời khác nhau cho "không phải của bạn" và
// "không tồn tại" chính là xác nhận rằng đơn của người khác có thật. Hai cơ chế
// dẫn tới đó khác nhau, và khác biệt ấy mới là thứ quan trọng với người cài
// đặt: hai nguyên nhân đầu bị chặn TRƯỚC KHI có lượt đọc nào, hai nguyên nhân
// sau đi qua lượt đọc RLS và không nhận được dòng nào.
//
// KHÔNG `notFound()` VÀ KHÔNG NÉM. Một 404 sẽ vứt đi đúng cái trạng thái mà màn
// này hữu ích nhất — nói cho người dùng biết đơn đã hết hạn và mời họ quay lại
// `/pricing` (UI-D11: mã đơn đi bằng query param chính là để "không có đơn /
// không phải đơn của bạn" là MỘT trạng thái của MỘT trang). Ngược lại, lượt đọc
// HỎNG thì `getMyOrder()` ném, và cú ném ấy đi tới `error.tsx` của route —
// "không đọc được" không phải "không có đơn nào", và dịch cái trước thành cái
// sau sẽ render trạng thái Rỗng cho một người vừa chuyển tiền xong.
//
// KHÔNG có mục `PUBLIC_PATHS` nào được thêm cho route này (private theo mặc
// định; ngân sách ba mục công khai của AC-032 không bị đụng tới), path KHÔNG
// chứa dấu chấm (một segment có dấu chấm bị `proxy.ts` loại khỏi matcher, nên
// nó không qua middleware xác thực lẫn CSP mang nonce), và KHÔNG có thay đổi
// CSP nào.
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getMyOrder } from "@/app/(billing)/queries";
import { PageContainer } from "@/components/layout/PageContainer";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getTranslate } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Checkout" };

/** Next.js giao `searchParams` dưới dạng Promise (khuôn của
 *  `(HM)/history/page.tsx`). Kiểu khai `string | string[]` vì một tham số LẶP
 *  LẠI trên query string tới đây dưới dạng MẢNG — và mảng phải rơi vào trạng
 *  thái Rỗng, không được ném. */
type SearchParams = Promise<{ order?: string | string[] }>;

/** Chuỗi chữ số thập phân, neo hai đầu. `\d` là ASCII (không cờ `u`) nên chữ số
 *  toàn phần `１２３` KHÔNG khớp. `Number("１２３")` cũng là `NaN`, nên hàng đó là
 *  lớp thứ hai chứ không phải chỗ regex một mình đỡ. */
const ORDER_CODE = /^\d+$/;

/**
 * `?order=` → `orderCode`, hoặc `null`.
 *
 * DANH SÁCH CHẤP NHẬN, KHÔNG PHẢI LƯỢT PHÂN TÍCH — ba điều kiện, cả ba đều bắt
 * buộc (frontend DD § Field Propagation Map):
 *
 *   1. `typeof raw === "string"`. Một `?order=` lặp lại tới đây là MẢNG, và mọi
 *      thứ phía sau đều ép kiểu nó trong im lặng: `String(["1","2"])` là
 *      `"1,2"`, `Number([])` là `0`. Viết dưới dạng `typeof` thay vì một nhánh
 *      riêng cho `string[]` nên quy tắc đúng bất kể mảng có tới hay không.
 *   2. `ORDER_CODE.test(raw)`. Đây là điều kiện DUY NHẤT chặn được `"1.0"`,
 *      `"1e3"`, `" 12 "`, `"+5"` và `"\n12"` — `Number()` nhận hết chúng và
 *      trả về một số nguyên dương an toàn. `"1,000"` KHÔNG nằm trong danh
 *      sách đó: `Number("1,000")` đã là `NaN`. Nó nằm trong danh sách của
 *      `parseInt` bên dưới — `parseInt("1,000")` là `1` — nên ở đây regex
 *      là lớp thứ hai, không phải lớp duy nhất.
 *   3. `Number.isSafeInteger(n) && n > 0`. Cận trên là `MAX_SAFE_INTEGER` chứ
 *      không phải "số nguyên": `9007199254740993` là chữ số hợp lệ nhưng
 *      `Number()` của nó đã mất chính xác, nên nó sẽ tra một mã KHÁC mã người
 *      dùng gõ. Cận dưới là `> 0` chứ không `>= 0`: `order_code` không bao giờ
 *      là 0.
 *
 * KHÔNG BAO GIỜ `parseInt`. `parseInt("123abc")` là `123` — nó bỏ qua phần đuôi
 * rác và đưa một mã sai vào một lượt đọc THẬT. Đó là lỗi mà cả ba điều kiện
 * trên tồn tại để chặn, và bảng test của Task 4.2 đỏ ở tám dòng nếu ai đó thay
 * lại bằng nó.
 *
 * `unknown` chứ không `string | string[] | undefined`: giá trị này tới từ NGOÀI
 * (URL do người dùng gõ), và một type guard thật phải tự kiểm tra kiểu chứ
 * không tin lời khai của người gọi.
 */
function parseOrderCode(raw: unknown): number | null {
  if (typeof raw !== "string") return null;
  if (!ORDER_CODE.test(raw)) return null;
  const orderCode = Number(raw);
  return Number.isSafeInteger(orderCode) && orderCode > 0 ? orderCode : null;
}

export default async function CheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const t = await getTranslate();
  const sp = await searchParams;

  const orderCode = parseOrderCode(sp.order);
  // Mã không hợp lệ KHÔNG sinh ra lượt đọc nào — đây là nửa an ninh của quy
  // tắc, không phải một tối ưu.
  const order = orderCode === null ? null : await getMyOrder(orderCode);

  // `size="small"` + padding MẶC ĐỊNH (UI-D18) — và hai file biên
  // (`loading.tsx`, `error.tsx`) phải khớp ĐÚNG cặp này, nếu không nội dung
  // giật đúng lúc skeleton được thay bằng dữ liệu. Container nằm NGOÀI nhánh
  // rẽ, một lần: hai container song song là hai chỗ để lệch nhau.
  return (
    <PageContainer as="main" size="small" className="flex flex-col gap-6">
      {order === null ? (
        // TRẠNG THÁI RỖNG — MỘT nhánh cho cả bốn nguyên nhân. Task 4.3 thêm câu
        // `billing.checkout.noActiveOrder` NGAY TRÊN liên kết này; nó KHÔNG
        // được tách nhánh này ra làm hai.
        <p className="text-muted-foreground text-sm">
          <Link href="/pricing" className="text-brand min-h-11 underline-offset-4 hover:underline">
            {t("billing.quota.upgradeLink")}
          </Link>
        </p>
      ) : (
        // Task 4.3 thay khối này bằng `<PaymentPanel order={order} />`: `order`
        // đã là hợp đồng TÁM TRƯỜNG `CheckoutOrder` đúng như `toCheckoutOrder()`
        // giao, và không có gì ở trang này dựng lại, sao chép hay tính lại nó.
        // `orderCode` in NGUYÊN SI — người dùng ĐỌC mã này cho bộ phận hỗ trợ,
        // nên không nhóm nghìn, không viết tắt, không theo ngôn ngữ (UI Spec
        // § C-08, § C-13).
        <p className="text-muted-foreground text-sm">
          {t("billing.orders.orderCode")}{" "}
          <span className="text-foreground font-mono">{String(order.orderCode)}</span>
        </p>
      )}
    </PageContainer>
  );
}
