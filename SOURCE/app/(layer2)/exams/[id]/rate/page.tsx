// Standalone Rate Page — /exams/[id]/rate (academic-rubric redesign). Server
// Component: getExam → 404 (published-only, cùng guard exams/[id]/page.tsx);
// eligibility gate qua listMySubmittedExamIds() (server-side reject — UX
// only, RLS write-eligibility check trên rateExam mới là gate thật, ADR-0008
// Decision 3); getMyRating prefill (AC-013).
//
// "← Back" target (2026-07-27): context-aware via a `?returnTo=` query param
// set by whoever links here — ExamBrowser's RateButton doesn't set one (falls
// back to `/exams`, exactly where it should go back to anyway); the Result
// page's rating entry sets `returnTo` to its own result URL so rating from
// there returns to that same result page instead of the exam list.
// `safeBackHref` only trusts an internal absolute path (`/...`, never
// `//host/...` or `scheme://...`) — this value ends up as a rendered <Link
// href>, and an unvalidated redirect target is an open-redirect/phishing risk
// even when it takes a click rather than firing automatically.

import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyRating } from "@/app/(layer2)/actions";
import { RatingRubric } from "@/app/(layer2)/_components/rating/RatingRubric";
import { getExam, listMySubmittedExamIds } from "@/app/(layer2)/queries";
import { getTranslate } from "@/lib/i18n/server";
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
  const t = await getTranslate();

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
