// SolutionsListPage — /exams/[id]/solutions (S-03). Server Component: đúng
// HAI truy vấn cố định — `getMySolutionForWriter(examId)` (rào S11 + dữ liệu
// khối "bài của tôi") và `listSolutions(examId)` (danh sách đã đăng) — cộng
// truy vấn đề mà đầu trang/breadcrumb đã cần cho tên đề (AC-052). Không có
// truy vấn nào theo từng dòng: trăm bài giải không thêm truy vấn nào (AC-057).
//
// `getResultCardSummary(examId)` KHÔNG BAO GIỜ được gọi ở route này (frontend
// DD § Data Contracts "Own-solution block contract", AC-110/S20) — đọc nó
// đánh dấu lý do xoá hẳn một lần duy nhất đã xem, và bề mặt DUY NHẤT được gọi
// nó là `result/page.tsx`. Không import hàm này ở đây.
//
// `getMySolutionForWriter` trả `null` (0 dòng: chưa nộp bài / đề chưa
// published / tác giả đề bị ban) ⇒ redirect("/exams/[id]") TRƯỚC KHI bất kỳ
// nội dung danh sách nào render (S11/AC-002/AC-004) — người không được VIẾT
// cũng không được ĐỌC, theo đúng rào R1. KHÔNG render "danh sách thiếu khối
// đầu". Lỗi truy vấn THẬT (ném ngoại lệ) không bị đổi thành redirect — nó rơi
// thẳng vào error.tsx.
import { notFound, redirect } from "next/navigation";
import { getExam } from "@/features/exams/queries";
import { getMySolutionForWriter, listSolutions } from "@/features/solutions/queries";
import { SolutionList } from "@/features/solutions/components/SolutionList";
import type { OwnSolutionSummary } from "@/features/solutions/components/OwnSolutionBlock";
import { PageContainer } from "@/components/layout/PageContainer";
import { PageHeader } from "@/components/layout/PageHeader";
import { t } from "@/lib/copy";

export default async function SolutionsListPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // Rào S11 trước tiên — không đọc `listSolutions`/đề khi caller chưa đủ điều
  // kiện, và chắc chắn không render gì trước redirect.
  const own = await getMySolutionForWriter(id);
  if (own === null) {
    redirect(`/exams/${id}`);
  }

  const [exam, items] = await Promise.all([getExam(id), listSolutions(id)]);
  if (!exam) {
    notFound();
  }

  // `now`: một Date duy nhất cho cả lượt render, giao xuống mọi `SolutionCard`
  // (frontend DD § lib/format/relativeTime.ts "now parameter... rule").
  const now = new Date();

  // Dẫn xuất OwnSolutionSummary trên SERVER (frontend DD § "Own-solution block
  // contract"): ghi chú/mảng câu hỏi/bài làm của lượt liên kết KHÔNG được đi
  // xa hơn dòng này — chỉ ba con số đếm và attemptId qua tới client.
  const summary: OwnSolutionSummary = {
    status: own.status,
    attemptId: own.attemptId,
    notedCount: own.questions.filter((q) => q.wordCount >= 15).length,
    questionCount: own.questions.length,
    changedQuestionCount: own.questions.filter((q) => q.hasChanged).length,
  };

  return (
    <PageContainer
      as="main"
      size="small"
      padding="none"
      className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"
    >
      <PageHeader
        breadcrumbs={[
          { label: t("nav.exams"), href: "/exams" },
          { label: exam.title, href: `/exams/${id}` },
          // "Kết quả" trỏ lượt nộp/lượt gắn của tôi — cùng attemptId route này
          // đã có sẵn, không thêm truy vấn nào cho riêng breadcrumb (AC-052).
          { label: t("result.title"), href: `/exams/${id}/attempt/${summary.attemptId}/result` },
          { label: t("solutions.list.crumb") },
        ]}
        eyebrow={t("solutions.eyebrow")}
        title={t("solutions.list.title")}
        description={t("solutions.list.description", { count: items.length })}
      />

      <SolutionList examId={id} items={items} own={summary} now={now} />
    </PageContainer>
  );
}
