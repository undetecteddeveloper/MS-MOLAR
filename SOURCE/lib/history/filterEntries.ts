// filterHistoryEntries — pure predicate applying HistoryFilters' selected
// criteria to an already-fetched MyHistoryEntry[] (front-adjust). Kept
// separate from queries.ts: filtering a user's own bounded history array
// in-memory avoids adding 4 more conditional WHERE-clause branches across
// listMyHistory()'s 3 sequential Supabase calls for no real cost benefit —
// RLS already scopes the read to auth.uid(), so the unfiltered fetch is
// small per-user.
import type { MyHistoryEntry } from "@/app/(HM)/queries";

export interface HistoryEntryFilters {
  subject?: string;
  examId?: string;
  scoreMin?: number;
  scoreMax?: number;
  /** ISO date (YYYY-MM-DD), inclusive lower bound on submittedAt's date portion. */
  dateFrom?: string;
  /** ISO date (YYYY-MM-DD), inclusive upper bound on submittedAt's date portion. */
  dateTo?: string;
}

export function filterHistoryEntries(
  entries: MyHistoryEntry[],
  filters: HistoryEntryFilters
): MyHistoryEntry[] {
  return entries.filter((entry) => {
    if (filters.subject !== undefined && entry.subject !== filters.subject) return false;
    if (filters.examId !== undefined && entry.examId !== filters.examId) return false;
    if (filters.scoreMin !== undefined && entry.totalScore < filters.scoreMin) return false;
    if (filters.scoreMax !== undefined && entry.totalScore > filters.scoreMax) return false;

    // ISO 8601 timestamps sort/compare correctly as plain strings; slicing to
    // the date portion is enough for inclusive day-level bounds.
    const submittedDate = entry.submittedAt.slice(0, 10);
    if (filters.dateFrom !== undefined && submittedDate < filters.dateFrom) return false;
    if (filters.dateTo !== undefined && submittedDate > filters.dateTo) return false;

    return true;
  });
}
