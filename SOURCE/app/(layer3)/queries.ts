// (layer3) route group — Analytics read (docs/design/analytics-layer3-data-logic-design.md
// § getAnalyticsByRange). Server-only, mirrors (layer2)/queries.ts's/(HM)/queries.ts's
// snake_case DB → camelCase mapping + throw-on-infrastructure-error convention.
// RLS scopes the read to auth.uid() — no explicit user_id predicate needed
// (results_select_own/attempts_select_own, supabase/schema.sql).
import "server-only";
import { createClient } from "@/lib/supabase/server";
import { aggregateAttemptsByRange, type AttemptRow } from "@/lib/analytics/aggregateAttempts";
import type { SubjectStats, TimeRange } from "@/lib/fake-data/analytics";

// PostgREST embedded shape: exam_results -> exam_attempts (!inner, to-one) ->
// exams (!inner, to-one). Both FKs are many-to-one, so each embed is an
// object, not an array.
type EmbeddedRow = {
  correct: number;
  total: number;
  exam_attempts: {
    submitted_at: string | null;
    status: string;
    exams: { subject: string };
  };
};

export async function getAnalyticsByRange(): Promise<Record<TimeRange, SubjectStats[]>> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("exam_results")
    .select("correct, total, exam_attempts!inner(submitted_at, status, exams!inner(subject))")
    .eq("exam_attempts.status", "submitted");
  if (error) throw error;

  const rows: AttemptRow[] = (data as unknown as EmbeddedRow[]).map((row) => ({
    correct: row.correct,
    total: row.total,
    submittedAt: row.exam_attempts.submitted_at,
    subject: row.exam_attempts.exams.subject,
  }));

  return aggregateAttemptsByRange(rows, new Date());
}
