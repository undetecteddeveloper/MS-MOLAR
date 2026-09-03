// Skeleton của /profile — khuôn của (history)/history/loading.tsx.
//
// Phải khớp CHÍNH XÁC size + padding của page.tsx (`small`, padding mặc định):
// lệch một nấc thì nội dung giật lên/xuống đúng lúc skeleton được thay bằng dữ
// liệu thật. Khối tròn 96px và ba thanh cao bằng hàng thật giữ cho thẻ không
// đổi chiều cao khi ảnh và ba hàng tới nơi.

import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer as="main" size="small">
      <div className="bg-border/60 h-8 w-40 animate-pulse rounded" />
      <div className="border-border bg-card mt-6 rounded-[var(--radius-card)] border p-6">
        <div className="flex flex-col items-center gap-4 md:flex-row">
          <div className="bg-muted size-24 shrink-0 animate-pulse rounded-full" />
          <div className="w-full max-w-48">
            <div className="bg-border/60 h-5 w-32 animate-pulse rounded" />
            <div className="bg-border/60 mt-2 h-4 w-44 animate-pulse rounded" />
          </div>
        </div>
        <div className="divide-border border-border mt-6 divide-y border-t">
          {[0, 1, 2].map((i) => (
            <div key={i} className="py-4">
              <div className="bg-border/60 h-12 w-full animate-pulse rounded" />
            </div>
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
