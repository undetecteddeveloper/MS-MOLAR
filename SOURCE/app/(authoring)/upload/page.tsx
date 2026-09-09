// S-01 Upload — /upload (UGC v2.0, Task 6.2). Server guard → /?auth=signin
// (AC-002). Form là client component (giữ state metadata + file); tiêu đề và
// câu dẫn dựng ở đây bằng PageHeader chuẩn (theme "Sân trường", 2026-09-09) —
// bản trước giấu h1 (sr-only), nay hiện rõ như mọi trang khác.

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { UploadForm } from "@/features/authoring/components/UploadForm";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

// Trần thời gian cho function chạy Server Action của route này — chủ yếu là
// `extractAndAssemble` (features/authoring/actions.ts), đường dài nhất trong app:
// upload file → mupdf parse → extractQuestions (≤150s, FATAL_CALL_DEADLINE_MS)
// → extractAnswers (≤150s nữa) → ghi DB.
//
// 300s là trần cứng của Vercel với fluid compute (bật mặc định, Hobby lẫn Pro).
// Khai tường minh vì mặc định của platform thấp hơn nhiều và có thể đổi theo
// cấu hình project — im lặng cắt giữa chừng thì đề đã upload sẽ mất trắng.
// Trước đây trần này để mặc định và việc đó được ghi là nợ; đây là chỗ trả.
export const maxDuration = 300;

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader title={t("upload.title")} description={t("upload.intro")} />
      <UploadForm />
    </PageContainer>
  );
}
