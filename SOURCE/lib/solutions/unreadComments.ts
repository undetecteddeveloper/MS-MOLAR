// countUnreadComments — the shared unread-count formula (decomposer resolution
// R6, backend task 26; backend DD § Data Contracts "community_my_comment_feed"
// New-comment rule, Reference Contract Value #23): "one formula, two call
// sites", consumed by task 29 (per-exam list-card badge) and task 45 (profile
// chip). Neither badge task re-implements this rule.
//
// A row counts as new IF AND ONLY IF isUnread && examVisible — never isUnread
// alone. The feed's own row set already excludes the viewer's own comments,
// draft/hidden solutions (S7) and admin-hidden comments (S19); this filter
// applies the remaining S8 exclusion (exam not published, or its author
// banned) to the COUNT while the row still appears in the feed list (AC-098):
// an S8 exam-not-visible comment is technically unread but must not count as
// new.
//
// Pure: no I/O, no imports — this module sits below every feature that
// consumes it (same convention as lib/solutions/identity.ts).

/** The subset of `CommentFeedItem` (features/solutions/queries.ts) this
 *  formula needs — kept structural rather than importing the full type, so
 *  this module stays free of any dependency. */
export interface UnreadCommentRow {
  solutionId: string;
  isUnread: boolean;
  examVisible: boolean;
}

/**
 * Counts the rows that count as "new" (AC-091, AC-092): `isUnread &&
 * examVisible`, optionally restricted to one solution's rows (the per-exam
 * "k bình luận mới" use, task 29).
 */
export function countUnreadComments(
  rows: readonly UnreadCommentRow[],
  opts?: { solutionId?: string }
): number {
  return rows.reduce((count, row) => {
    if (opts?.solutionId !== undefined && row.solutionId !== opts.solutionId) {
      return count;
    }
    return row.isUnread && row.examVisible ? count + 1 : count;
  }, 0);
}
