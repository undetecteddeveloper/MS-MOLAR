// (HM) route group — History read (backend Design Doc history-backend-design.md
// v1.2, § Query Implementation Shape). Server-only, mirrors (layer2)/queries.ts's
// snake_case DB → camelCase mapping and throw-on-infrastructure-error convention.
import "server-only";
import { createClient } from "@/lib/supabase/server";

export type MyHistoryEntry = {
  attemptId: string;
  examId: string;
  examTitle: string;
  subject: string;
  totalScore: number;
  startedAt: string;
  submittedAt: string;
};

export async function listMyHistory(): Promise<MyHistoryEntry[]> {
  const supabase = await createClient();

  // Step 1 — which attempts are scored (exam_results existence). Do NOT trust
  // exam_attempts.status alone (Assumed Behavior #1 / AC-001).
  const { data: resultRows, error: resultErr } = await supabase
    .from("exam_results")
    .select("attempt_id, total_score");
  if (resultErr) throw resultErr;
  if (resultRows.length === 0) return [];

  const scoreByAttemptId = new Map<string, number>(
    (resultRows as { attempt_id: string; total_score: number }[]).map((r) => [
      r.attempt_id,
      r.total_score,
    ])
  );

  // Step 2 — of those, which are ALSO status='submitted' — newest first (AC-003).
  const { data: attemptRows, error: attemptErr } = await supabase
    .from("exam_attempts")
    .select("id, exam_id, started_at, submitted_at")
    .in("id", [...scoreByAttemptId.keys()])
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false });
  if (attemptErr) throw attemptErr;
  if (attemptRows.length === 0) return [];

  // Step 3 — batch exam titles, single round trip (no N+1). Mirrors getExam()'s
  // exact visibility convention ((layer2)/queries.ts:181-191): exams_select_visible
  // RLS scopes the read, AND an explicit .eq("status","published") filter is
  // applied on top — not RLS alone. This keeps the omission rule symmetric with
  // getExam()/getResult() even for a self-authored exam later reverted away from
  // "published" (see Exams-Visibility Edge Case decision).
  // examIds is always non-empty here: step 2 already returned [] when attemptRows
  // was empty, and exam_id is a NOT NULL FK — so no defensive .in() sentinel
  // (cf. getMyExam()'s pattern, (layer4)/queries.ts:108) is needed at this call site.
  const examIds = [...new Set(attemptRows.map((a) => a.exam_id as string))];
  const { data: examRows, error: examErr } = await supabase
    .from("exams")
    .select("id, title, subject")
    .in("id", examIds)
    .eq("status", "published");
  if (examErr) throw examErr;
  const examById = new Map<string, { title: string; subject: string }>(
    (examRows as { id: string; title: string; subject: string }[]).map((e) => [
      e.id,
      { title: e.title, subject: e.subject },
    ])
  );

  // Step 4 — assemble, preserving step 2's ORDER BY. A row whose exam has no
  // title match here (invisible under RLS, or not currently published — including
  // the reader's own unpublished exam) is omitted, not defaulted.
  return (
    attemptRows as {
      id: string;
      exam_id: string;
      started_at: string;
      submitted_at: string;
    }[]
  )
    .map((a): MyHistoryEntry | null => {
      const exam = examById.get(a.exam_id);
      if (exam === undefined) return null;
      return {
        attemptId: a.id,
        examId: a.exam_id,
        examTitle: exam.title,
        subject: exam.subject,
        totalScore: scoreByAttemptId.get(a.id)!,
        startedAt: a.started_at,
        submittedAt: a.submitted_at,
      };
    })
    .filter((entry): entry is MyHistoryEntry => entry !== null);
}
