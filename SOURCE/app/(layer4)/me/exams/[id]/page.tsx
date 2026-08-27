// S-03 Review & edit — /me/exams/[id] (UGC v2.0, Task 6.4). Server Component.
// Guard: chưa đăng nhập → /?auth=signin; không phải của mình / không tồn tại →
// /me/exams (getMyExam trả null qua RLS + author check).

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getMyExam } from "@/app/(layer4)/queries";
import { ReviewScreen } from "@/app/(layer4)/_components/ReviewScreen";
import { renderReviewNodes } from "@/app/(layer4)/_components/reviewNodes";
import { PageContainer } from "@/components/layout/PageContainer";

export default async function ReviewExamPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ src?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/?auth=signin");

  const { id } = await params;
  const detail = await getMyExam(id);
  if (!detail) redirect("/me/exams");

  // processing: extract chưa xong (không nên vào đây trực tiếp) → về danh sách.
  if (detail.status === "processing") redirect("/me/exams");

  // v2.2: ?src=auto — phiên đến thẳng từ extract Automatic → marker "from your
  // file" trên field AI điền (session-derived, O-7; reload mất là chủ đích).
  const { src } = await searchParams;

  return (
    <PageContainer as="main" size="default">
      <ReviewScreen
        examId={detail.id}
        status={detail.status}
        initialExam={detail.exam}
        srcAuto={src === "auto"}
        // TD-027: markdown + LaTeX render Ở ĐÂY (server), không ở QuestionEditor
        // — giữ 126.3 KB br của RichText khỏi lượt tải đầu của màn sửa đề.
        nodes={renderReviewNodes(detail.exam.questions)}
      />
    </PageContainer>
  );
}
