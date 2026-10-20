// Phải khớp size + padding của page.tsx, nếu không nội dung giật khi thay skeleton.

import { PageContainer } from "@/components/layout/PageContainer";
import { t } from "@/lib/copy";

export default function Loading() {
  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
      aria-busy="true"
    >
      <p className="sr-only">{t("common.loading")}</p>
      <div className="bg-surface h-8 w-48 animate-pulse rounded-lg sm:h-9" />
      <div className="bg-surface rounded-card h-72 animate-pulse" />
      <div className="bg-surface h-13 w-full animate-pulse rounded-full" />
    </PageContainer>
  );
}
