// Skeleton của /pricing/checkout (S-06) — khuôn GỐC `(history)/history/loading.tsx`
// (UI-D18, FE-I9), qua bản đã sửa ba điểm ở `me/orders/loading.tsx`.
//
// Phải khớp CHÍNH XÁC size + padding của `page.tsx` — `size="small"`, padding
// MẶC ĐỊNH. KHÔNG chép `size="default"` của route anh em `/me/orders`, cũng
// không chép cặp `size="small" padding="compact"` của file gốc: quy tắc UI-D18
// là "khớp trang CỦA CHÍNH MÌNH", không phải "khớp tiền lệ". Lệch một nấc thì
// nội dung giật lên/xuống đúng lúc skeleton được thay bằng dữ liệu (chính
// `history/loading.tsx` ghi lại sự cố đó).
//
// MỘT KHỐI CAO, KHÔNG PHẢI BA HÀNG: thứ sắp tới ở màn này là MỘT khối thanh
// toán (mã QR + khối chuyển khoản), không phải một danh sách. Một skeleton
// hình danh sách sẽ dời cú giật sang chỗ khác chứ không bỏ được nó.
import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer as="main" size="small">
      <div className="bg-border/60 h-8 w-40 animate-pulse rounded" />
      <div className="border-border bg-card/40 mt-6 h-64 animate-pulse rounded-lg border" />
    </PageContainer>
  );
}
