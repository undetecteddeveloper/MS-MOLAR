// Phải khớp size + padding của page.tsx, nếu không nội dung giật khi thay skeleton.

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>
      <div className="bg-surface h-8 w-48 animate-pulse rounded-lg sm:h-9" />
      <div className="bg-surface rounded-card h-32 animate-pulse" />
      <div className="flex flex-col gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-surface rounded-card h-24 animate-pulse" />
        ))}
      </div>
    </PageContainer>
  );
}
