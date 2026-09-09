// S-02 My exams — /me/exams (UGC v2.0, Task 6.3). Server Component.
// Guard: chưa đăng nhập → /?auth=signin (AC-002). Băng ?published=1 (D13).
// Theme "Sân trường" (2026-09-09): PageHeader chuẩn với nút "Tải một đề lên"
// ở hàng tiêu đề — bản trước giấu h1 và để nút lơ lửng căn phải.

import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { t } from "@/lib/copy";
import { listMyExams } from "@/features/authoring/queries";
import { MyExamsList } from "@/features/authoring/components/MyExamsList";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";

export default async function MyExamsPage({
  searchParams,
}: {
  searchParams: Promise<{ published?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const { published } = await searchParams;
  const exams = await listMyExams();

  return (
    <PageContainer
      as="main"
      size="default"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        title={t("common.myExams")}
        description={t("upload.myExamsHint")}
        actions={
          <Button render={<Link href="/upload" />} nativeButton={false}>
            {t("upload.uploadAnExam")}
          </Button>
        }
      />
      <MyExamsList exams={exams} justPublished={published === "1"} />
    </PageContainer>
  );
}
