// S-03 Review & edit — /me/exams/[id] (UGC v2.0, Task 6.4). Server Component.
// Guard: chưa đăng nhập → /?auth=signin; không phải của mình / không tồn tại →
// /me/exams (getMyExam trả null qua RLS + author check).

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { getMyExam } from "@/features/authoring/queries";
import { ReviewScreen } from "@/features/authoring/components/ReviewScreen";
import { renderReviewNodes } from "@/features/authoring/components/reviewNodes";
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
        nodes={renderReviewNodes(detail.exam.questions, detail.exam.passages)}
        // Task E4 / OQ-5. Đọc cờ Ở ĐÂY vì đây là server component; cả ba
        // component bên dưới đều `"use client"` và ở đó `process.env` không
        // tồn tại. Quy tắc đọc giống HỆT ba chỗ đọc cờ kia (AC-013): CHỈ chuỗi
        // `"true"` đã trim mới là bật, mọi giá trị khác kể cả vắng mặt là tắt.
        essayGradingEnabled={process.env.ESSAY_GRADING_ENABLED?.trim() === "true"}
      />
    </PageContainer>
  );
}
