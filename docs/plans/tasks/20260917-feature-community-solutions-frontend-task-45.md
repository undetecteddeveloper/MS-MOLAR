# Task 45: `ProfileCommentsTab` + `CommentNotificationCard` + profile chip unread count + profile skeleton re-measurement

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P5-T6
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T6)
- **Dependencies**: task 26 (P3-T2, `getMyCommentFeed` + `countUnreadComments` + `getMyUnreadCommentCount`), task 44 (P5-T5); task 27 provides the real-data AC-091 exclusion proof. **No gate** — the decomposition-time placement question behind task 44 is resolved (frontend DD v1.6 § Minimal Surface Alternatives Element 4), so nothing blocks this task once 44 has landed.
- **Provides**: profile-chip half of AC-092; the "Trả lời" producer for the view route's `?q`/`?comments` boundary
- **Size**: Medium (plan list: 3 files; plus the page wiring below)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, work plan **v1.3**

## Implementation Content

- `ProfileCommentsTab` — server-rendered from `getMyCommentFeed(page)`; states empty ("Chưa có bình luận nào về bài giải của bạn.", plus the how-to line when `publishedCount === 0`), default, pagination ("Xem thêm" — `commentId` is the list key across appended pages); comment excerpts render through `RichText` **server-side** inside the tab with `line-clamp-2`, so `/profile` gains no markdown/KaTeX client chunk. An empty page past the last one is **not** an error; a thrown query error renders the tab's `role="alert"` + "Thử lại".
- **`CommentFeedItem` (frontend DD § Data Contracts "Comment feed contract")** — the fields this task consumes: `commentId`, `solutionId`, `examId`, `examTitle`, `questionNumber` (a plain `number` — the feed's row condition filters removed questions out), `commentBody` (raw markdown), `commentCreatedAt`, `author: AuthorIdentity`, `isUnread`, `examVisible`. Rows are newest first; the RPC's own row set already excludes the viewer's own comments, comments under a draft/hidden solution (S7), under a removed question, under a note below 15 words, and admin-hidden comments (S19) — so the tab has **no "hidden comment" branch of its own**.
- **`CommentNotificationCard` — name only, no avatar.** The feed carries **no avatar**: `toAuthorIdentity` is called with `author_avatar_url: null`, so a named row is `{ kind: "named", displayName }` with **no `avatarUrl`**, and UI Spec `C-36` renders a name only. The card must not render an `Avatar`, an `AnonymousAvatar` or a placeholder for one, and must not reach for an avatar field that does not exist. (`getMyCommentFeed` is also the one read the cross-user avatar signer of task 42 deliberately does **not** cover.)
- **Card line (`C-36`, AC-097)**: "{name} hỏi ở câu {questionNumber}" (`profile.comments.asked`) when `commentBody` contains "?", otherwise "{name} bình luận ở câu {questionNumber}" (`profile.comments.commented`); `{name}` is `author.displayName` for a named row and "Ẩn danh" (`solutions.identity.anonymous`) for an anonymous one — the **same** `AuthorIdentity` switch every other surface uses, so an anonymous row reads "Ẩn danh hỏi ở câu k".
- `Card as="li" variant="tint"`; unread dot (`aria-hidden bg-destructive size-2`) only while the row counts as new; exam title one line, ellipsised; `examVisible: true` → "Trả lời" (≥44px) linking to `/exams/{examId}/solutions/{solutionId}?q={questionNumber}&comments=1`. When the exam is currently not visible (S8/AC-098) the "Trả lời" link is **replaced** by the status line "Đề không còn hiện" (`profile.comments.examHidden`) — never a broken link — and that card shows **no** unread dot and counts toward **no** number.
- **Chip count wiring** (integration edit on the page): `SOURCE/app/(analytics)/profile/page.tsx` fetches `getMyUnreadCommentCount()` (no solution filter) once and passes the number to `ProfileTabs`' "Bình luận" chip (count inside the accessible name "Bình luận, {count} bình luận mới", `profile.tabs.commentsA11y`; dot `aria-hidden`). **The formula is task 26's, not re-implemented here** (Reference Contract Value #23, decomposer resolution R6, `SOURCE/lib/solutions/unreadComments.ts`): a row counts as new **if and only if `isUnread && examVisible`**. The same one formula feeds the writer's own-card per-exam count in task 29 (rows whose `examId` equals that exam). Never a naive `last_read_at` vs `created_at` comparison, and never a second counting rule on this screen.
- `SOURCE/app/(analytics)/profile/loading.tsx` — skeleton heights **re-measured on dev** (not estimated) after the chip row + reputation block land, at <640px and ≥640px; record the measured numbers in the file's header comment (closes TBD-01).
- **Copy keys added here**: `profile.comments.*` from the UI Spec list (`asked`, `commented`, `reply`, `examHidden`, `empty`, `emptyHowTo`, `more`, `loadError`), cited by key name. `profile.tabs.*` came with task 44; `solutions.identity.anonymous` and `time.*` already exist.

## Acceptance Criteria

From the plan (§ P5-T6): **AC-091, AC-092 (profile-chip half), AC-093, AC-097–AC-099**; Reference Contract Value **#23**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** a feed row's `examVisible` is `false`, the system renders the status line "Đề không còn hiện" in place of the "Trả lời" button, renders **no** unread dot on that card, and excludes that row from **every** new-comment count. (AC-098, AC-091, S8)
- **When** a feed row is counted, the system counts it as new only while `isUnread && examVisible`, and the per-exam count on the writer's own list card is the number of such rows whose `examId` equals that exam. (AC-091, AC-092)
- **When** "Trả lời" is pressed on a feed row, the system navigates to `/exams/{examId}/solutions/{solutionId}?q={questionNumber}&comments=1`. (AC-098, AC-061, S13)

Carried hard constraints that apply to this task:
- **ADR-0002**: comment excerpts render only through `SOURCE/components/shared/RichText.tsx` (server-side here, so no client chunk).
- Data only via `SOURCE/features/solutions/queries.ts`; no query added to any shared layout (D38/AC-094).
- Vietnamese strings only via `SOURCE/lib/copy.ts`; 360px floor; 44px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`; never fade page content on load.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/ProfileCommentsTab.tsx` (new)
- [x] `SOURCE/features/solutions/components/CommentNotificationCard.tsx` (new)
- [ ] `SOURCE/app/(analytics)/profile/loading.tsx` (re-measured heights) — **deferred, TBD-01 not closed**: shared Playwright CLI session not signed in (see Investigation Notes); file left unchanged

Integration edit (chip count must be fetched by the page):
- [x] `SOURCE/app/(analytics)/profile/page.tsx`

Supporting tests:
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/features/solutions/components/ProfileTabs.tsx` (task 44 — chip count prop)
- `SOURCE/app/(analytics)/profile/page.tsx`, `SOURCE/app/(analytics)/profile/loading.tsx` (header comment: 415px/323px measured 2026-09-10)
- `SOURCE/features/solutions/queries.ts` (`getMyCommentFeed`, `getMyUnreadCommentCount`), `SOURCE/lib/solutions/unreadComments.ts` (task 26)
- `SOURCE/tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` (task 27 — the AC-091 exclusion proof)
- `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` (task 21 — `?q`/`?comments` parse rule this link must satisfy)
- `SOURCE/features/authoring/components/QuestionJumpDock.tsx` (line ~87: unread dot idiom)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Comment feed contract": the `CommentFeedItem` fields, the `C-36` rendering rules incl. "the feed carries no avatar", and the one counting rule with its two consumers)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "Comment feed tests (frontend tasks 45 and 29)")
- `docs/design/community-solutions-frontend-design.md` (§ UI Error State Design — the `ProfileCommentsTab` row)
- `docs/design/community-solutions-frontend-design.md` (§ Fact Disposition Table — `profile/loading.tsx:Loading`, TBD-01; `HoSo.dc.html:70` row)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `community_comments_last_read_at` write-only-by-`markCommentsRead`)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — `community_comments_last_read_at`)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ProfileCommentsTab — verify empty + default + pagination ("Xem thêm") states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentNotificationCard — verify default + "Đề không còn hiện" branch states)
- `docs/prd/community-solutions-prd.md` (D21, R19–R20, AC-091–AC-093, AC-097–AC-099)

## Boundary Context
(From the work plan's Connection Map — "URL query string (`?q`, `?comments`, `?tab`)"; `CommentNotificationCard` is a named producer)
- **Serialized format** (verbatim): "`?q={1-based int}`, `?comments=1` (whitelist)".
- **Consumer parse rule** (verbatim): "`Number.parseInt` clamp to `[1,N]`; exact-string whitelist compare; server re-validates … never trusts the URL alone".
- **Expected signal** (verbatim): "Deep link opens/scrolls to the right row without error even if the target question was since deleted (AC-061 note)".
- **Roundtrip check**: the link built for question number k parses on the view route to `{ q: k, commentsOpen: true }` using task 21's exported parse function.

## Investigation Notes

**Key interfaces read**:
- `getMyCommentFeed(page): Promise<CommentFeedItem[]>` and `getMyUnreadCommentCount(opts?: {solutionId?})` already exist in `queries.ts` (landed by backend task 26); `CommentFeedItem` has exactly the 10 fields the frontend DD's contract lists, `author: AuthorIdentity` already built with `author_avatar_url: null`. `countUnreadComments(rows, opts)` in `lib/solutions/unreadComments.ts` is the one shared formula (`isUnread && examVisible`); this task never re-implements it, only applies the same boolean expression per-row inline in `CommentNotificationCard` (dot condition) since that helper operates on arrays.
- `parseSolutionDeepLink(rawQ, rawComments, questionCount)` is exported (not default) from `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` (task 21) — this is the link-building target and the roundtrip-check function.
- `ProfileTabs.tsx` (task 44) currently took only `{ activeTab }` — **no** count prop existed yet, and `profile.tabs.commentsA11y` (added by task 44) was unused. `ProfilePage` (`page.tsx`) rendered `null` for the "comments" tab branch and did not call `getMyUnreadCommentCount()` at all.
- `loading.tsx` header comment (2026-09-10): 415px/323px measured for the account-card block only; it has **no** skeleton block at all for the chip row / reputation block that task 44 added (task 44 did not touch this file — confirmed via `git log -- loading.tsx`, last touch predates task 44).
- Task 27's proof (`community-solutions-comment-feed.localdb.test.ts`) covers feed columns, unread cursor (incl. `countUnreadComments`), stable ordering, and the AC-091 exclusion set (a-e); re-run below, still green.

**Task file inconsistency found (not a PRD/UI Spec/Design Doc conflict — a Target Files omission)**: the task's own Implementation Content and "Provides: profile-chip half of AC-092" require passing the unread count into `ProfileTabs`' chip accessible name (`profile.tabs.commentsA11y`, added by task 44 for exactly this purpose), which is impossible without adding a prop to `ProfileTabs.tsx`. That file is listed only under Investigation Targets ("chip count prop"), not under Target Files. Treated this as an in-scope, backward-compatible **additive** change (new optional `commentCount?: number` prop, default behavior unchanged, existing `ProfileTabs.test.tsx` assertions all still pass unmodified) rather than escalating — no interface was broken, no Design Doc value was contradicted, and no other file could satisfy this task's own stated AC-092 obligation. Documented here per the escalation "Gray Zone" guidance instead of stopping the task.

**Pagination architecture decision**: `CommentNotificationCard` renders `RichText` and per ADR-0002/TD-021 must never be imported from a `"use client"` module (would bundle the 122.5 KB gzip markdown/KaTeX chunk into `/profile`). This rules out a client-side "load more" that fetches raw rows and maps them into cards on the client. Implemented "Xem thêm" as a `next/link` to `?tab=comments&cpage={page+1}` (`scroll={false}`) — a plain URL-driven re-render, same idiom as `ProfileTabs`/`HistoryList`'s `?page=`. `ProfileCommentsTab` reads pages `1..page` on every render and concatenates (`loadCommentFeedThroughPage`), so "append" is achieved by re-fetching the accumulated range rather than incremental client state. `hasMore` is decided by whether the **last** fetched page's length equals `COMMENT_FEED_PAGE_SIZE` (=20, mirrored locally as a comment-cited constant since `queries.ts`'s own `COMMENT_FEED_PAGE_SIZE` is private and out of this task's Target Files — a wrong guess here only costs one harmless extra "Xem thêm" round trip past the true end, never data loss, per the contract's own "quá trang cuối → mảng rỗng, không lỗi").

**Skeleton re-measurement (TBD-01) — NOT closed, deferred**: attempted per the task's protocol — ran `node scripts/pw/cli.mjs goto "http://localhost:3000/profile"` from `SOURCE/` (after starting a local `next dev` to have something to connect to; stopped it again afterward) using the shared Playwright CLI session at `%TEMP%\ms-molar-pw-cli\port`. Result: the session redirected to `/?auth=signin` — **not signed in**. Per instruction, stopped here without attempting sign-in and without estimating numbers. `loading.tsx` is left **byte-for-byte unchanged**: its stale 415px/323px header comment covers only the account-card block and does not yet have any skeleton for the chip row / `ReputationBlock` that task 44 added — inventing a plausible-looking new skeleton block without a real measurement would itself be a fabricated number, which the task explicitly forbids. TBD-01 requires an engineer to log the shared CLI session in, then re-run the measurement at 360px and ≥640px and add the new chip-row/reputation-block skeleton block plus updated numbers. Required Test #9 (skeleton parity) is consequently **not implemented** — recorded here as the residual, not faked.

**Task 27 re-run result**: `npx vitest run --config vitest.localdb.config.ts tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` → 1 file, 6/6 tests passed (feed columns, unread cursor incl. `countUnreadComments`, stable ordering, AC-091 exclusion proof, AC-048/AC-047 feed part) — unaffected by this task's changes.

**Full `test:localdb --exclude ".../community-solutions.service.e2e.test.ts"` result**: first run 7 files / 40 tests passed cleanly. An immediate second run hit Supabase auth `429 over_request_rate_limit` across most files (known environment flake per project memory — rapid repeated `admin.auth.admin.createUser` calls against the dev project — not a code regression); the first clean run is the evidence of record.

## Required Tests (frontend DD v1.6 § Test Boundaries, "Comment feed tests"; work plan § P5-T6)

`getMyCommentFeed` / `getMyUnreadCommentCount` are mocked at the module boundary; `lib/solutions/identity.ts`, `lib/solutions/unreadComments.ts` and `RichText` stay real.

1. **S8 row**: a row with `examVisible: false` renders "Đề không còn hiện", **no** "Trả lời" link and **no** unread dot.
2. **Counted row**: a row with `isUnread: true, examVisible: true` renders the dot and is counted.
3. **Chip count**: the chip count equals the number of rows satisfying `isUnread && examVisible` — computed by task 26's shared helper, not by a rule written in this file; the page calls `getMyUnreadCommentCount()` exactly once and passes the number to `ProfileTabs`.
4. **"Trả lời" href**: equals `/exams/{examId}/solutions/{solutionId}?q={questionNumber}&comments=1` and roundtrips through task 21's exported parse function to `{ q: k, commentsOpen: true }` (AC-098).
5. **Anonymous line**: an anonymous row whose body contains "?" reads "Ẩn danh hỏi ở câu k" (AC-097, AC-105).
6. **Name only, no avatar**: a **named** row renders the display name and **no** avatar image and no avatar placeholder anywhere in the card (the feed carries no avatar path).
7. **Empty feed**: renders "Chưa có bình luận nào về bài giải của bạn." (plus the how-to line when the viewer has no published solution), and an empty page past the last one is not an error.
8. **Pagination**: "Xem thêm" loads the next page and appends it, keyed by `commentId`.
9. **Skeleton parity**: the re-measured `loading.tsx` heights match the loaded page at <640px and ≥640px (measured on dev, numbers recorded in the file's header comment — TBD-01).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement tab content, card, page wiring
- [ ] Measure skeleton heights on dev at <640px and ≥640px; update `loading.tsx` — **deferred** (session not signed in; see Investigation Notes)
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Link building in one helper next to task 21's parser usage
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `next build` (manual manifest read) — `/profile` first bundle has no markdown/KaTeX chunk (formal check task 48)
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test`; re-run task 27's comment-feed localdb test (lane rule); on the dev server as a writer with commented solutions open `/profile?tab=comments`, tap "Trả lời", and compare the skeleton to the loaded page at 360px and 640px.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: tests green; "Trả lời" lands on the right question with the sheet open; no layout jump between skeleton and content (heights equal).
- **Failure response**: if the chip count differs from the number of unread, exam-visible rows in the feed, stop — the shared formula must be the only source.
- **Verification level**: L1 (profile comments tab on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (AC-098, verbatim): "'Trả lời' mở màn xem đúng câu + tấm trượt; nhánh 'Đề không còn hiện' thay nút."
- **Primary failure mode**: "Trả lời" points to a wrong question index or renders for an S8 exam as a broken link.
- **Boundary to exercise**: rendered `CommentNotificationCard` hrefs parsed by task 21's parse function; S8 fixture row.
- **State assertion**: N/A.
- **Mock boundary rationale**: query module mocked at the module boundary.
- **Residual**: server re-validation on the view route (task 21).

- **Claim** (AC-091, PRD verbatim): "Given tôi có bài đã đăng, then một 'bình luận mới' là bình luận của người khác dưới một ghi chú đang hiện của bài đó, tạo sau lần tôi mở tab 'Bình luận' gần nhất (chưa từng mở → mọi bình luận đều mới); bình luận của chính tôi không bao giờ tính là mới; bình luận trên bài mà đề hiện không hiện (published bị gỡ / tác giả bị khoá, S8) không tính là mới trong lúc đó — đề hiện lại thì tính theo luật chung; bình luận trên bài đang nháp / bị ẩn (S7) và bình luận bị admin ẩn (S19) cũng không tính."
- **Primary failure mode**: the profile chip counts the viewer's own comment, an S8 comment (while still listing it), or an admin-hidden comment.
- **Boundary to exercise**: the plan requires "a test (integration or RLS) asserting all three AC-091 exclusions hold for the profile-chip unread count". Per resolution R6 this is delivered by task 26 (`unreadComments.test.ts`, formula incl. S8 filter + paging) and task 27 (`community-solutions-comment-feed.localdb.test.ts`, real row set: own/S7/S19 excluded, S8 listed with exam-visible=false and not counted). This task re-runs both and wires the same helper without re-implementing it.
- **State assertion**: see task 27 (seeded (a)–(e) → count = 1, feed lists (d) and (e)).
- **Mock boundary rationale**: component tests mock the query; exclusion proof is real-DB in task 27.
- **Residual**: none once tasks 26/27 are green.

- **Claim** (frontend DD § Data Contracts "Comment feed contract"): the feed card renders a name only.
- **Primary failure mode**: the card renders an `Avatar`/`AnonymousAvatar` (or reserves space for one) from a field the feed does not carry, producing an empty circle on every row and an implicit dependency on an avatar path this read deliberately omits.
- **Boundary to exercise**: `CommentNotificationCard` rendered with a **named** `CommentFeedItem` (`{ kind: "named", displayName }`, no `avatarUrl`).
- **State assertion**: the display name is present; `container.querySelector("img")` is `null` and no avatar placeholder element is rendered.
- **Mock boundary rationale**: literal props; `toAuthorIdentity` runs for real.
- **Residual**: the "feed is not signed" half is task 42's.

## Completion Criteria
- [x] All added tests pass
- [ ] Operation verified per Operation Verification Methods above (task 26/27 exclusion tests re-run green — done; skeleton heights measured and recorded — **deferred, TBD-01 not closed**)
- [x] Each Proof Obligation is met

## Notes
- Impact scope: `/profile` only.
- Scope boundary: no layout files; `ProfileTabs` behaviour from task 44 unchanged except for receiving the count.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
