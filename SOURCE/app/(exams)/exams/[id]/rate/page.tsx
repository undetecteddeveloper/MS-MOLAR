// Trang đánh giá độc lập — /exams/[id]/rate (thiết kế lại theo rubric học thuật). Server
// Component: getExam → 404 (published-only, cùng guard exams/[id]/page.tsx);
// eligibility gate qua listMySubmittedExamIds() (server-side reject — UX
// only, RLS write-eligibility check trên rateExam mới là gate thật, ADR-0008
// Decision 3); getMyRating prefill (AC-013).
//
// Đích của nút "← Quay lại" (2026-07-27): nhận biết ngữ cảnh qua tham số truy vấn
// `?returnTo=` do nơi dẫn tới đây đặt — RateButton của ExamBrowser không đặt (rơi
// về `/exams`, đúng chỗ cần quay lại); mục đánh giá ở trang Kết quả đặt `returnTo`
// là URL kết quả của chính nó, để đánh giá xong thì quay về đúng trang kết quả đó
// thay vì danh sách đề.
// `safeBackHref` chỉ tin đường dẫn tuyệt đối nội bộ (`/...`, không bao giờ
// `//host/...` hay `scheme://...`) — giá trị này cuối cùng thành <Link
// href> được render, và một đích chuyển hướng chưa kiểm là rủi ro open-redirect/phishing
// kể cả khi cần một cú bấm chứ không tự động chuyển.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyRating } from "@/features/exams/actions";
import { RatingRubric } from "@/features/exams/components/rating/RatingRubric";
import { getExam, listMySubmittedExamIds } from "@/features/exams/queries";
import { t } from "@/lib/copy";
import { mapFromMyRating } from "@/lib/rating";
import { PageContainer } from "@/components/layout/PageContainer";

function safeBackHref(returnTo: string | undefined): string {
  if (
    returnTo &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("://") &&
    !returnTo.includes("\\")
  ) {
    return returnTo;
  }
  return "/exams";
}

export default async function RatePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { id } = await params;
  const { returnTo } = await searchParams;
  const backHref = safeBackHref(returnTo);

  const exam = await getExam(id);
  if (!exam) {
    notFound();
  }

  const submittedExamIds = await listMySubmittedExamIds();
  if (!submittedExamIds.has(id)) {
    return (
      <div className="bg-background">
        <PageContainer as="main" size="small" className="flex flex-col items-center text-center">
          <h1 className="font-serif text-2xl">{t("rating.needAttemptTitle")}</h1>
          <p className="text-muted-foreground mt-2 text-sm">{t("rating.needAttemptBody")}</p>
          <Link
            href={backHref}
            className="text-brand mt-6 text-xs font-medium tracking-[0.14em] uppercase hover:underline"
          >
            ← {t("common.back")}
          </Link>
        </PageContainer>
      </div>
    );
  }

  const initialScores = mapFromMyRating(await getMyRating(id));

  return (
    <div className="bg-background">
      {/* Giữ nguyên link "← Back" thay vì đổi sang Breadcrumbs: đích của nó là
          `?returnTo=` phụ thuộc ngữ cảnh (vào từ /exams thì về /exams, vào từ
          trang kết quả thì về đúng trang kết quả đó) và đã qua kiểm tra chống
          open-redirect ở safeBackHref. Breadcrumbs là đường dẫn TĨNH theo cây
          route nên không diễn đạt được hành vi đó. */}
      <PageContainer as="main" size="small" className="flex flex-col gap-6 py-12 sm:py-16">
        <div>
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← {t("common.back")}
          </Link>
          <span className="eyebrow mt-6 block">{t("rating.title")}</span>
          <h1 className="mt-2 font-serif text-3xl leading-snug">{exam.title}</h1>
        </div>

        <RatingRubric examId={id} initialScores={initialScores} />
      </PageContainer>
    </div>
  );
}
