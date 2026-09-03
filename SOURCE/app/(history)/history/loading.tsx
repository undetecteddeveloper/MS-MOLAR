// Loading state for /history — skeleton mirrors (authoring)/me/exams/loading.tsx's
// pattern (heading skeleton + pulsing row placeholders), per the frontend DD's
// HistoryList states table (D7): 4 placeholder rows for this list.

import { PageContainer } from "@/components/layout/PageContainer";

export default function Loading() {
  return (
    // Khớp CHÍNH XÁC size + padding của history/page.tsx: lệch padding thì nội
    // dung sẽ giật lên/xuống đúng lúc skeleton được thay bằng dữ liệu (trước
    // đây skeleton py-10 còn trang thật py-5).
    <PageContainer as="main" size="small" padding="compact">
      <div className="h-8 w-32 animate-pulse rounded bg-border/60" />
      <div className="mt-6 flex flex-col gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg border border-border bg-card/40" />
        ))}
      </div>
    </PageContainer>
  );
}
