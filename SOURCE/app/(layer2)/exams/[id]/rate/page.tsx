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
import { mapFromMyRating } from "@/lib/rating";

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
        <main className="mx-auto flex w-full max-w-xl flex-col items-center px-6 py-16 text-center">
          <h1 className="font-serif text-2xl">You need to finish this exam first</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Complete an attempt on this exam before you can rate its difficulty.
          </p>
          <Link
            href={backHref}
            className="text-brand mt-6 text-xs font-medium tracking-[0.14em] uppercase hover:underline"
          >
            ← Back
          </Link>
        </main>
      </div>
    );
  }

  const initialScores = mapFromMyRating(await getMyRating(id));

  return (
    <div className="bg-background">
      <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12 sm:py-16">
        <div>
          <Link
            href={backHref}
            className="text-muted-foreground hover:text-foreground text-sm transition-colors"
          >
            ← Back
          </Link>
          <span className="eyebrow mt-6 block">Difficulty rating</span>
          <h1 className="mt-2 font-serif text-3xl leading-snug">{exam.title}</h1>
          <p className="text-muted-foreground mt-2 max-w-prose text-sm leading-relaxed">
            Rate each part from 1 (easiest) to 10 (hardest). Your overall score is the average of
            the three.
          </p>
        </div>

        <RatingRubric examId={id} initialScores={initialScores} />
      </main>
    </div>
  );
}
