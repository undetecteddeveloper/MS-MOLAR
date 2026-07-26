// Standalone Rate Page — /exams/[id]/rate (Rating System, frontend DD §
// Data-Fetching Plan). Server Component: getExam → 404 (published-only, cùng
// guard exams/[id]/page.tsx); eligibility gate qua listMySubmittedExamIds()
// (server-side reject — UX only, RLS write-eligibility check trên rateExam mới
// là gate thật, ADR-0008 Decision 3); getMyRating prefill (AC-013).

import Link from "next/link";
import { notFound } from "next/navigation";
import { getMyRating } from "@/app/(layer2)/actions";
import { RatePageShell } from "@/app/(layer2)/_components/rating/RatePageShell";
import { getExam, listMySubmittedExamIds } from "@/app/(layer2)/queries";
import { mapFromMyRating } from "@/lib/rating";

export default async function RatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
            href={`/exams/${id}`}
            className="text-brand mt-6 text-xs font-medium tracking-[0.14em] uppercase hover:underline"
          >
            ← Back to exam
          </Link>
        </main>
      </div>
    );
  }

  const initialScores = mapFromMyRating(await getMyRating(id));

  return <RatePageShell examId={id} initialScores={initialScores} />;
}
