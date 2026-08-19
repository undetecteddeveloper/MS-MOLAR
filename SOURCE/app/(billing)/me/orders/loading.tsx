// Skeleton của /me/orders — khuôn GỐC `(HM)/history/loading.tsx` (UI-D18,
// FE-I9).
//
// Phải khớp CHÍNH XÁC size + padding của `page.tsx` — `size="default"`, padding
// MẶC ĐỊNH. Không chép cặp `size="small" padding="compact"` của file gốc: quy
// tắc của UI-D18 là "khớp trang CỦA CHÍNH MÌNH", không phải "khớp tiền lệ".
// Lệch một nấc thì nội dung giật lên/xuống đúng lúc skeleton được thay bằng dữ
// liệu (chính `history/loading.tsx:9-12` ghi lại sự cố đó).
//
// Ba khối cao bằng một hàng thật, chứ không phải một con quay: hàng đơn là thứ
// sắp tới, và một skeleton không giữ đúng chiều cao ấy chỉ dời cú giật sang chỗ
// khác.
import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer as="main" size="default">
      <div className="bg-border/60 h-8 w-40 animate-pulse rounded" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="border-border bg-card/40 h-20 animate-pulse rounded-lg border"
          />
        ))}
      </div>
    </PageContainer>
  );
}
