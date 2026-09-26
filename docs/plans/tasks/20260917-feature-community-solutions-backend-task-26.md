# Task 26: `actions.ts`/`queries.ts` — `postComment`, `deleteComment`, `markCommentsRead`, `getMyCommentFeed` (+ shared unread-count formula)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P3-T2
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T2)
- **Dependencies**: task 02 (P1-T2), task 25 (P3-T1)
- **Provides**: comment write actions, the feed query, and the **single** unread-count formula (`countUnreadComments` + `getMyUnreadCommentCount`) consumed by task 29 (list-card badge) and task 45 (profile chip) — "one formula, two call sites"
- **Size**: Medium (5 files)

## U1 is resolved (no gate on this task)

`postComment`/`deleteComment` are **not** plain-RLS writes. Backend DD v1.2 removed `community_comments_insert_own` and `community_comments_delete_own`: `community_solution_comments` has RLS on, every privilege revoked, **no policy and no grant**, and the only write path is the `SECURITY DEFINER` pair `post_community_comment` / `delete_community_comment` (task 25's migration). A direct PostgREST write on the table is an authorization denial — task 27 asserts that as a table-closure case. Every refusal from these RPCs is `42501` with one fixed message per function.

## Implementation Content

- `postComment(solutionId, questionId, body, isAnonymous)` — `requireUser()` → `guard("communitySolutionComment")` → validation **before any RPC** (`body.trim()` empty → `empty`; `body.length > 2000` → `tooLong`) → `.rpc("post_community_comment", { p_solution_id, p_question_id, p_body, p_is_anonymous })`. Success: `{ ok: true, comment }`, built from the returned `comment_id` / `comment_created_at` plus the action's own inputs.
- `deleteComment(commentId)` — `requireUser()` → `guard("communitySolutionCommentDelete")` → `.rpc("delete_community_comment", { p_comment_id })` → `{ ok: true }`. Another user's comment, the solution writer's attempt to delete someone else's, and one's own admin-hidden comment (S19) are all `42501` at the RPC and map to `generic` here — there is no zero-row-delete branch, because the action never issues a `.delete()`.
- **Neither action calls `.from("community_solution_comments")`** in any form.
- `markCommentsRead()` — guards `communityCommentsMarkRead`; a plain update of the caller's own `user_profiles.community_comments_last_read_at = now()` under the unchanged `profiles_update_own` policy (update-own precedent: `SOURCE/features/auth/actions.ts`); **no-op-safe** (Failure Mode #2). This is the one write in this task that is not an RPC, and it touches no community table.
- `getMyCommentFeed(page)` — wraps `community_my_comment_feed(p_page, p_page_size)` and maps its **ten** columns to `CommentFeedItem` (camelCase, same order): `comment_id`, `solution_id`, `exam_id`, `exam_title`, `question_number`, `comment_body`, `comment_created_at`, `author_display_name`, `is_unread`, `exam_visible`. `author` is built as `toAuthorIdentity({ author_display_name, author_avatar_url: null })` — **the feed returns no commenter id and no avatar path**, so a named row is `{ kind: "named", displayName }` with no `avatarUrl`, and `C-36` renders a name only. Task 42's batch avatar signer therefore does **not** cover this function.

### Error mapping (shared mapper from task 04 — backend DD § Data Contracts "Error signalling" clauses (a)/(b))

- `42501` → `{ code: "generic" }`, deliberately naming no reason (AC-002 non-leak; this covers the AC-048 note-gate race, a draft/hidden solution, a removed question, S19 and every other refusal).
- `23514` (body CHECK backstop, unreachable through the validated action) → `{ code: "generic" }`, with `console.error` carrying the **RPC name and code only**.
- Any other code or a network failure → `{ code: "generic" }`, same logging rule.
- Rate limit → `{ code: "rateLimited", seconds }`, `seconds` exactly the number `guard()` returned.
- **`error.message` is never read**, for any code; `error.details` is read by no action in this task.

### Copy keys

This task adds **no** `SOURCE/lib/copy.ts` key and returns codes only (`empty`, `tooLong`, `rateLimited`, `generic`). The Vietnamese text is owned by frontend task 28: `solutions.comments.emptyError`, `solutions.comments.sendError`, `solutions.comments.deleteError` — plus the existing `profile.error.rateLimited` with `{seconds}`. Cite these by key name only, never by `lib/copy.ts` line number.
- **Shared unread-count formula (decomposer resolution R6 — common processing for tasks 29 and 45)**. The work plan requires both badges to use "one formula, two call sites" sourced from `community_my_comment_feed`'s exclusion-respecting row set, never a naive timestamp comparison; the DDs define no count RPC and the feed is paginated. Deterministic implementation:
  - `countUnreadComments(rows, opts?: { solutionId?: string }): number` in `SOURCE/lib/solutions/unreadComments.ts` — pure; counts rows where `isUnread && examVisible` (and `solutionId` matches when given). The RPC's own row set already excludes the viewer's own comments, draft/hidden solutions (S7), and admin-hidden comments (S19); the `examVisible` filter applies the S8 exclusion to the **count** while the row still appears in the feed list (AC-098).
  - `getMyUnreadCommentCount(opts?)` in `queries.ts` — the feed is newest-first and `is_unread` does **not** depend on `exam_visible` (backend DD: "the unread rows stay a prefix of the newest-first feed"), so unread rows form a prefix. Fetch page 1, 2, … and stop at the first page that is not full or that contains a read row; apply `countUnreadComments` to the fetched rows.
- No code path logs comment body content (backend DD § Logging and Monitoring).
- Result/error shape follows the one task 04 established — reuse that mapper, do not add a parallel one.

## Acceptance Criteria

From the plan (§ P3-T2): **AC-069, AC-070, AC-091, AC-092, AC-093; Reference Contract Value #23**.

Carried hard constraints that apply to this task:
- Consumes the existing `RATE_LIMITS` keys from task 02; `SOURCE/lib/security/rateLimit.ts` not edited.
- Session client only; **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- `markCommentsRead`'s JSDoc states the consumer rule: call on tab-open, never on component mount before the data that prompted the visit has loaded.
- D38/AC-094: no helper in this task is designed for the shared top-bar layout; call sites are only the list page and the profile page.

## Target Files
- [x] `SOURCE/features/solutions/actions.ts` (extend)
- [x] `SOURCE/features/solutions/queries.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/commentActions.test.ts` (new)
- [x] `SOURCE/lib/solutions/unreadComments.ts` (new)
- [x] `SOURCE/lib/solutions/__tests__/unreadComments.test.ts` (new)

## Investigation Targets
- `SOURCE/features/solutions/actions.ts`, `SOURCE/features/solutions/queries.ts` (existing shapes from tasks 04, 14, 15)
- `SOURCE/lib/solutions/identity.ts`
- `SOURCE/supabase/schema.sql` (task 25: `post_community_comment` / `delete_community_comment` signatures and errcodes, `community_my_comment_feed`'s ten return columns incl. `is_unread` and `exam_visible`, the `community_comments_last_read_at` column; `profiles_update_own`; `community_solution_comments` with RLS on and zero policies/grants)
- `SOURCE/features/auth/actions.ts` (lines ~196–210 and ~296–312: `guard()` + `.from("user_profiles").update(...).eq("id", user.id)` update-own precedent; `changeAvatar` returns copy keys as `error`)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" → Server Action contracts table and "Error signalling")
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_my_comment_feed(p_page, p_page_size)`: Output columns, Row condition, New-comment rule)
- `docs/design/community-solutions-backend-design.md` (§ Logging and Monitoring — no note/comment/report-reason body ever logged)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — rows `comment_id` / `comment_created_at`, `is_unread` / `exam_visible`, the feed columns, `community_comments_last_read_at`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Comment feed contract" → the `CommentFeedItem` type and its "the feed carries no avatar" rule)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `community_comments_last_read_at` write-only-by-`markCommentsRead`)
- `docs/prd/community-solutions-prd.md` (AC-069, AC-070, AC-091, AC-092, AC-093, AC-094, AC-098, D38)

## Boundary Context
(From the work plan's Connection Map — "Rate-limit rejection → client copy")
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`; unsaved comment text never cleared.
- **Roundtrip check**: the `seconds` value `guard()` returns for each of the three comment keys is the exact number the action returns.

## Investigation Notes
(Append observations here before implementation begins. Record the feed's exact ten column names as task 25's migration applied them.)

- **`post_community_comment(p_solution_id uuid, p_question_id text, p_body text, p_is_anonymous boolean) returns table (comment_id uuid, comment_created_at timestamptz)`** (`schema.sql:3557-3607`). Single `42501` message `'post_community_comment: not eligible'` for every refusal (eligibility gate combining published solution/exam, submitted attempt, current question, note ≥15 words). Body/anonymity CHECK backstop is `community_solution_comments_body_check` (23514, unreachable through the validated action). Grant: `authenticated` only.
- **`delete_community_comment(p_comment_id uuid) returns void`** (`schema.sql:3609-3645`). Zero-row delete is turned into a raised `42501` (`'delete_community_comment: not eligible'`) inside the function itself — the action never sees a distinct "0 rows" branch, it only ever sees success (void, no error) or one `42501`.
- **`community_my_comment_feed(p_page int, p_page_size int) returns table (comment_id uuid, solution_id uuid, exam_id text, exam_title text, question_number int, comment_body text, comment_created_at timestamptz, author_display_name text, is_unread boolean, exam_visible boolean)`** (`schema.sql:3664-3712`) — exactly the ten columns in this order. `is_unread = p.community_comments_last_read_at is null or c.created_at > p.community_comments_last_read_at` (does not read `exam_visible`); `exam_visible = e.status = 'published' and not is_author_banned(e.author_id)`. Page size is capped server-side to `[1, 20]` (`least(greatest(coalesce(p_page_size,20),1),20)`) — a page can never carry more than 20 rows regardless of what the caller requests. Ordered `comment_created_at desc`. Empty page past the last one → no error, `[]`. Grant: `authenticated` only.
- **`user_profiles.community_comments_last_read_at`** (`schema.sql:3655`): nullable timestamptz, no default, added before the feed function (name-resolution ordering). Only writer is `markCommentsRead` via a plain update under unchanged `profiles_update_own` (`schema.sql` § profiles_update_own has no column restriction — backend DD:106).
- `community_solution_comments`: RLS on, `revoke all ... from anon, authenticated` (`schema.sql:3103`), zero policies added anywhere in the file — confirmed the two RPCs above are the only write path, matching U1.
- Error mapping precedent (`SOURCE/features/solutions/actions.ts:59-136`): `RpcErrorLike` (no `message` field declared), `logUnexpectedRpcError(rpcName, error, silentCodes = SILENT_RPC_ERROR_CODES)` logs `console.error(\`[${rpcName}]\`, error.code)` only for codes NOT in the silent set; `mapSaveSolutionError`/`mapSetSolutionStatusError` follow the same shape. For this task neither `postComment` nor `deleteComment` reads `error.details` for any code (backend DD "Error signalling" clause (b) applies to exactly two other actions, not these two) — every non-empty/non-tooLong/non-rateLimited outcome is `generic`, and `23514`/other-code get `console.error` with RPC name + code, `42501` stays silent (expected refusal). This means the silent-set for this task's mapper is `{"42501"}` only (not `23505`, which doesn't apply to comments; and NOT `23514`, which must log per Required Test #5).
- `toAuthorIdentity` (`SOURCE/lib/solutions/identity.ts:28-42`): `{author_display_name, author_avatar_url}` → `AuthorIdentity`; `typeof author_display_name !== "string"` → `{kind:"anonymous"}`; else `{kind:"named", displayName, ...(typeof avatarUrl === "string" ? {avatarUrl} : {})}`. Passing `author_avatar_url: null` therefore always omits `avatarUrl` for the feed's named rows — confirmed no `avatarUrl` key can leak through this helper.
- `markCommentsRead` precedent (`SOURCE/features/auth/actions.ts:196-210` `updateProfile`, and `:296-312` inside `changeAvatar`): `requireUser`-equivalent → guard → `supabase.from("user_profiles").update({...}).eq("id", user.id)` → `if (error) return {error}` else success. A "0 rows changed" outcome from PostgREST update is NOT surfaced as an error by Supabase itself (no `.select()`/`.single()` chained) — `error` stays `null` when zero rows matched, so the existing pattern is already no-op-safe by construction; this task's action just needs to not add a `.single()`/row-count check that would turn "0 rows" into a failure.
- Backend DD confirms (§ Data Contracts `community_my_comment_feed`, `:1629`, `:1633`): "is_unread does not depend on exam_visible, so the unread rows stay a prefix of the newest-first feed" and "a row counts as new ... only when is_unread and exam_visible" — this is Reference Contract Value #23 and the exact formula for `countUnreadComments`.
- `SOURCE/lib/supabase/boundedRead.ts` (`readBounded`/`LIST_ROW_CEILING`) is designed for unbounded `.from(...).select(...)` list reads that risk silent PostgREST truncation past `max_rows`; `community_my_comment_feed` is already explicitly paginated with a page size hard-capped to 20 inside the RPC's own SQL, so this helper does not apply to `getMyCommentFeed`/`getMyUnreadCommentCount` — the Main Components "Dependencies" line is a general per-file note, not a per-function requirement, and no Required Test references it.
- Rate limit keys confirmed present in `SOURCE/lib/security/rateLimit.ts`: `communitySolutionComment` (:254), `communitySolutionCommentDelete` (:256), `communityCommentsMarkRead` (:268) — all already added by a prior task; this task does not edit `rateLimit.ts`.
- Test conventions followed from `SOURCE/features/solutions/__tests__/helpfulPinActions.test.ts`: `vi.mock("server-only", ...)`, `vi.hoisted` for `getUserMock`/`rpcMock`/`guardMock`, `mockUser`/`allowGuard` helpers, source-string assertions via `readFileSync` scoped to the relevant function body.

### Binding Decisions evaluation
No dedicated "Binding Decisions" table section exists in this task file; the § Implementation Content bullets and § Required test list rows function as the binding constraints instead, evaluated directly during implementation (below) and re-checked at the Exit Gate.

### Reference Contracts evaluation
- Row condition / New-comment rule (backend DD `:1629,1633`) → Required Test #14/#15/#16, Proof Obligation #4 (Failure Mode #7): planned approach — `countUnreadComments` filters `isUnread && examVisible` (+ optional `solutionId` match); `getMyUnreadCommentCount` pages sequentially, stopping at the first page that is not full (`rows.length < pageSize`) or that contains a read row (`rows.some(r => !r.isUnread)`), then sums `countUnreadComments` over all fetched rows. Compliance Check: Y — this directly implements the prefix-stops-at-first-read-row guarantee; the "not full" branch handles a final page with fewer than `pageSize` unread rows even if all are unread.
- Feed contract (frontend DD `:1516-1527,1532`) → Required Test #12/#13, Proof Obligation #5: planned approach — map exactly ten columns to camelCase in the same order, `author: toAuthorIdentity({ author_display_name, author_avatar_url: null })`. Compliance Check: Y.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the § Required test list below in `commentActions.test.ts` and `unreadComments.test.ts`
- [x] Run and confirm failure

### Required test list (binding — plan § P3-T2; backend DD § Integration Verification Points "Task ownership": the comment actions' unit tests belong to this task)

The Supabase client is mocked at its boundary.

| # | Call | Input / mocked behaviour | Expected |
|---|---|---|---|
| 1 | `postComment(S, Q, "   ", false)` | — | `{ ok: false, error: { code: "empty" } }`; `.rpc` call count `0` |
| 2 | `postComment(S, Q, "x".repeat(2001), false)` | — | `{ code: "tooLong" }`; `.rpc` call count `0` |
| 3 | `postComment(S, Q, body, true)` | RPC → `[{ comment_id: "c1", comment_created_at: "…" }]` | one `.rpc("post_community_comment", { p_solution_id: S, p_question_id: Q, p_body: body, p_is_anonymous: true })`; the returned comment carries `c1` and that timestamp, plus the action's own inputs |
| 4 | `postComment` | RPC → `{ code: "42501" }` | `{ code: "generic" }`, naming no reason |
| 5 | `postComment` | RPC → `{ code: "23514" }` | `{ code: "generic" }`; `console.error` called with the RPC name and code only |
| 6 | `postComment` | every failure branch, with `console.error/log/warn` spied | **no spied argument contains the body string** |
| 7 | `deleteComment(C)` | RPC → no data | one `.rpc("delete_community_comment", { p_comment_id: C })` → `{ ok: true }` |
| 8 | `deleteComment(C)` | RPC → `{ code: "42501" }` | `{ code: "generic" }` (covers another user's comment, the writer's attempt, and one's own hidden comment — S19) |
| 9 | either action | `guard()` rejects with `seconds: 30` | `{ code: "rateLimited", seconds: 30 }`; `.rpc` call count `0`; the body argument is untouched |
| 10 | `markCommentsRead()` | mocked update reporting zero changed rows | the same success shape as a one-row update (no error) |
| 11 | module source | — | `SOURCE/features/solutions/actions.ts` contains no `.from("community_solution_comments")`; no action reads `error.message` |
| 12 | `getMyCommentFeed(1)` | RPC → one row with all ten columns, `author_display_name: "Lan"` | `CommentFeedItem` with camelCase fields in order and `author` = `{ kind: "named", displayName: "Lan" }` **with no `avatarUrl` key** |
| 13 | `getMyCommentFeed(1)` | the same row with `author_display_name: null` | `author` = `{ kind: "anonymous" }` |
| 14 | `countUnreadComments(rows)` | a row with `isUnread: true, examVisible: false` | **not** counted (Reference Contract Value #23) |
| 15 | `countUnreadComments(rows, { solutionId })` | mixed rows | counts only matching rows that also satisfy `isUnread && examVisible` |
| 16 | `getMyUnreadCommentCount()` | 45 unread rows (3 with `examVisible: false`) + 5 read rows across pages of 20 | count = `42`; `.rpc` called exactly 3 times (paging stops at the first page carrying a read row) |

### 2. Green Phase
- [x] Implement the actions, feed query, formula, and paging helper
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Reuse the shared error mapper; no parallel mapping table
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`, `SOURCE/lib/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `grep -n "service-role" SOURCE/features/solutions/actions.ts SOURCE/features/solutions/queries.ts` returns nothing; `grep -n "community_solution_comments" SOURCE/features/solutions/actions.ts` returns nothing (the table is reachable only through its two RPCs).
- **Success criteria**: all 16 rows of § Required test list and every Proof Obligation test green.
- **Failure response**: if the feed's columns do not expose `exam_visible` or `solution_id`, stop and escalate — the formula cannot apply the S8 exclusion or the per-solution filter without them. If a comment write can only be made to work with a direct insert or delete on `community_solution_comments`, stop — the table carries no policy and no grant by design.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (backend DD § Logging and Monitoring): no code path logs comment body content.
- **Primary failure mode**: an error branch logs the payload, writing user content to server logs.
- **Boundary to exercise**: `postComment` on every failure branch (rate-limited, empty, DB error) with `console.error`/`console.log`/`console.warn` spied.
- **State assertion**: no spied call argument contains the body string.
- **Mock boundary rationale**: session client mocked.
- **Residual**: none.

- **Claim** (Failure Mode #2, no-op): `markCommentsRead()` with nothing unread succeeds with the same success shape.
- **Primary failure mode**: a "0 rows changed" outcome is surfaced as an error.
- **Boundary to exercise**: `markCommentsRead` with the mocked update reporting zero changes.
- **State assertion**: N/A (mocked).
- **Mock boundary rationale**: session client mocked; real cursor write proven in task 27.
- **Residual**: tab-open timing is proven in task 45.

- **Claim** (Failure Mode #3, empty input / AC-069): an empty or whitespace-only comment body is rejected before any RPC call; the caller's text argument is never mutated.
- **Primary failure mode**: an empty comment reaches the DB, or the action returns a generic infra error.
- **Boundary to exercise**: `postComment` input validation.
- **State assertion**: mocked `.rpc` call count = 0; returned code is `empty` (the Vietnamese line `solutions.comments.emptyError` is rendered by task 28).
- **Mock boundary rationale**: session client mocked.
- **Residual**: UI retention of text on error is proven in task 28.

- **Claim** (Failure Mode #7, shared-state dependency / AC-091 S8 exclusion): the unread count counts only `isUnread && examVisible` rows (optionally for one solution), and paging stops at the read boundary so a count larger than one page is still complete.
- **Primary failure mode**: an S8 exam-not-visible comment is counted as new; or the count silently caps at one page size.
- **Boundary to exercise**: `countUnreadComments` (pure unit) and `getMyUnreadCommentCount` against a mocked session client returning two full unread pages then a mixed page.
- **State assertion**: fixture of 45 unread (3 with `examVisible=false`) + 5 read rows across pages of 20 → count = 42; `.rpc` called 3 times.
- **Mock boundary rationale**: session client mocked; the RPC's own row-set exclusions (own comment, S7, S19) are proven on real DB in task 27.
- **Residual**: badge rendering in tasks 29 and 45.

- **Claim** (frontend DD § Data Contracts "Comment feed contract"): the feed carries no avatar — `getMyCommentFeed` builds `author` with `author_avatar_url: null` and never signs a Storage path.
- **Primary failure mode**: the mapper invents an avatar field, or task 42's batch signer is later wired into this function, adding a Storage call per feed page for a card (`C-36`) that renders a name only.
- **Boundary to exercise**: `getMyCommentFeed` with a named-author row.
- **State assertion**: the mapped item's `author` has no `avatarUrl` key; the mocked client records no Storage call.
- **Mock boundary rationale**: session client mocked.
- **Residual**: the real column set is proven in task 27 ("no row carries a commenter id or avatar path").

## Completion Criteria
- [x] All added tests pass (the 16 rows of § Required test list included)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: tasks 28 (sheet), 29 (list badge), 45 (profile tab + chip) consume these; neither badge task re-implements the formula.
- Scope boundary: no edits to `rateLimit.ts` or `service-role.ts`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
