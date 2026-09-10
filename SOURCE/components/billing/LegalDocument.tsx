// LegalDocument — UI Spec C-04. Khung cho trang văn bản dài (/terms, /about).
//
// Bề rộng: PageContainer size="small" = --scaffold-small = 42rem = 672px — nấc
// duy nhất nằm dưới trần 720px cho khối text dài; `default` 768px đã vượt.
//
// KHÔNG dùng <RichText>: nó tồn tại để render UGC KHÔNG TIN CẬY qua bộ
// sanitize. Đẩy văn bản pháp lý của chính mình qua đường dành cho nội dung
// không tin cậy là mô tả sai mức tin cậy của nội dung.
//
// Theme "Sân trường" (2026-09-10): PageHeader chuẩn với tiêu đề HIỆN RÕ thay
// h1 `sr-only` của bản trước — hai trang này là hai trang công khai duy nhất
// ngoài trang chủ, người tới từ liên kết chân trang cần một tiêu đề để biết
// mình đã tới đúng chỗ. Thân chữ 16px theo thang thiết kế (§2: thân 16px,
// leading 1.5–1.55), không còn 14px. Khung `min-h-dvh` bỏ: AppShell gánh.

import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export function LegalDocument({
  title,
  description,
  children,
}: {
  title: string;
  /** Một câu dưới tiêu đề — bỏ trống thì không render gì. */
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={title} description={description} />
      <section className="flex flex-col gap-4 text-base leading-relaxed">{children}</section>
    </PageContainer>
  );
}
