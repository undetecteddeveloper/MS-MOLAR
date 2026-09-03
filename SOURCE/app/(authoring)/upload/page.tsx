// S-01 Upload — /upload (UGC v2.0, Task 6.2). Server guard → /?auth=signin
// (AC-002). Form là client component (giữ state metadata + file).

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { UploadForm } from "@/features/authoring/components/UploadForm";
import { PageContainer } from "@/components/layout/PageContainer";

// Trần thời gian cho function chạy Server Action của route này — chủ yếu là
// `extractAndAssemble` (features/authoring/actions.ts), đường dài nhất trong app:
// upload file → mupdf parse → extractQuestions (≤150s, FATAL_CALL_DEADLINE_MS)
// → extractAnswers (≤150s nữa) → ghi DB.
//
// 300s là trần cứng của Vercel với fluid compute (bật mặc định, Hobby lẫn Pro).
// Khai tường minh vì mặc định của platform thấp hơn nhiều và có thể đổi theo
// cấu hình project — im lặng cắt giữa chừng thì đề đã upload sẽ mất trắng.
// docs/DEPLOYMENT.md § "Đã biết trước" ghi việc này là nợ; đây là chỗ trả.
export const maxDuration = 300;

export default async function UploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  return (
    <PageContainer as="main" size="default">
      <UploadForm />
    </PageContainer>
  );
}
