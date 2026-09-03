// Loading state cho /me/exams (+ nested [id]) — khối skeleton nhẹ.
// Bề rộng PHẢI khớp trang thật (`default`), nếu không nội dung sẽ nhảy ngang
// đúng lúc skeleton được thay bằng dữ liệu.

import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    <PageContainer as="main" size="default">
      <div className="bg-border/60 h-8 w-40 animate-pulse rounded" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-border bg-card/40 h-20 animate-pulse rounded-lg border" />
        ))}
      </div>
    </PageContainer>
  );
}
