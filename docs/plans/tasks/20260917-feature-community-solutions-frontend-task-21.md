# Task 21: `SolutionViewScreen` + view route `/exams/[id]/solutions/[solutionId]` (`?q`/`?comments` URL boundary)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T6 (split 3/3) — the plan entry lists 9 target files (> 5), so it is split: task 19 = header card + actions; task 20 = question rows + note block; this file = the screen composition, route files, redirect guard, and deep-link parsing
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T6)
- **Dependencies**: task 14 (P2-T2, `getSolutionDetail`), task 19 (P2-T6 split 1/3), task 20 (P2-T6 split 2/3)
- **Provides**: route `/exams/[id]/solutions/[solutionId]`, consumed by tasks 22, 23, 24, 28, 31, 45, 49
- **Size**: Medium (4 files + tests)

## Implementation Content

- Route `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` (Server Component): `getSolutionDetail(solutionId)`; `null` → `redirect("/exams/[id]")` (S11/AC-063 — never distinguishing hidden from nonexistent).
- Parse `?q=k`: `Number.parseInt`, clamp to `[1, N]` where N = current question count; invalid/absent → no row pre-opened. If the target question was since deleted, the screen still opens without error (AC-061 note).
- Parse `?comments=1`: exact-string whitelist compare; any other value = absent. In this task the parsed flag is passed down as `initialCommentsOpen` for question k; the comment sheet that consumes it is built in task 28.
- `SolutionViewScreen` composes `SolutionAuthorCard` (task 19) and `SolutionQuestionRow` + `SolutionNoteBlock` (task 20); row k pre-opened and scrolled into view; focus moves to the row head (`tabIndex={-1}`, `scroll-mt` clears `SiteHeader`).
- **`iReported` is threaded, never defaulted** (frontend DD § Data Contracts `SolutionDetail` render rules; Element 10; Field Propagation Map `i_reported` → `iReported`): the header's `iReported` reaches `SolutionAuthorCard` → `SolutionMenu` (task 19 renders "Bạn đã báo cáo bài giải này." / "Báo cáo bài giải" from it), and each `questions[].comments[].iReported` is handed unchanged to the comment surface that task 28 mounts (`CommentItem`, report control rendered in task 37). The screen drops no `false` and supplies no default.
- **Comment affordance at screen level** (AC-048; frontend DD § Data Contracts `SolutionDetail`): "the comment affordance renders if and only if `note.commentCount` is present" — the screen passes each question's `commentCount` through to `SolutionQuestionRow` (task 20) untouched; a question with a note but no `commentCount` gets no comment button and no "m bình luận" text; `commentCount: 0` gets the "Bình luận" button.
- States: default, empty (all questions deleted), error, deep-link. The empty state is the dashed `Card variant="outline"` with the sentence `solutions.emptyExam` ("Đề này hiện không còn câu hỏi nào."); the sentence element carries an id from `useId()` so task 22 can point the blocked "Bảng câu hỏi" trigger's `aria-describedby` at it (DD-U4). This task renders the card only; the trigger is task 22.
- `loading.tsx` / `error.tsx` per UI Spec `SolutionRouteLoading` / `SolutionRouteError`.

## Acceptance Criteria

From the plan (§ P2-T6), rows that apply to these files: **AC-048 (screen-level comment affordance), AC-058 (composition), AC-061, AC-063, AC-073/AC-074 (`iReported` threaded to header and comment)**; Reference Contract Value #20 (comment affordance iff `commentCount` present); plan Quality Complete: `test:fixture` for the view route.

Carried hard constraints that apply to this task:
- Data only via `SOURCE/features/solutions/queries.ts`.
- **ADR-0002**: note content reaches the DOM only through `RichText` (via task 20's `SolutionNoteBlock`).
- Vietnamese strings only via `SOURCE/lib/copy.ts`; 360px floor, no horizontal scroll; 44px/56px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`; never fade page content on load.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionViewScreen.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/loading.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/error.tsx` (new)
- [x] Tests under `SOURCE/features/solutions/components/__tests__/`
- [x] `SOURCE/features/solutions/components/SolutionQuestionRow.tsx` (engineer decision, additive — id/tabIndex/scroll-mt-24/defaultOpen props for AC-061; task 20's committed file, now back in scope for this task)
- [x] `SOURCE/features/exams/queries/catalogue.ts` + `SOURCE/features/exams/queries/index.ts` (engineer decision — new `isExamAuthor(examId)` query, exported, for `SolutionMenu.isExamAuthor`)
- [x] `SOURCE/features/exams/queries/__tests__/catalogue.isExamAuthor.test.ts` (new test for the above)

## Investigation Targets
- Task 19/20 deliverables: `SOURCE/features/solutions/components/{SolutionAuthorCard,HelpfulButton,SolutionMenu,SolutionQuestionRow,SolutionNoteBlock}.tsx`
- `SOURCE/features/solutions/queries.ts` (`getSolutionDetail` → `null` for ineligible)
- `SOURCE/app/(exams)/exams/[id]/solutions/page.tsx` (task 18 — guard + loading/error conventions to mirror)
- `SOURCE/features/exams/components/ExamFilters.tsx` (URL param parsing precedent)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionViewScreen`)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `attemptId`/`q`/`comments`/`tab` URL params; `i_reported` → `iReported`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — `SolutionDetail` render rules; § Minimal Surface Alternatives — Element 8 (`commentCount` optional) and Element 10 (`iReported`); § Test Boundaries — "Already-reported tests", "Comment-affordance tests")
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra/dirty-close rows)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionViewScreen — verify default + empty (all questions deleted) + error + deep-link (`?q=k`) states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteLoading (loading.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteError (error.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Yêu cầu trợ năng — "Liên kết sâu `?q=k`" paragraph; rows `C-27`, `C-40`, `C-41`)
- `docs/prd/community-solutions-prd.md` (AC-058, AC-061, AC-063, S11)

## Boundary Context
(From the work plan's Connection Map — "URL query string (`?q`, `?comments`, `?tab`) + `attemptId` path segment"; this task owns `?q` and `?comments`)
- **Producer**: link-generating components (`SolutionCard`, `CommentNotificationCard` in task 45, deep-link generator).
- **Consumer**: this route's Server Component parse (`SolutionViewScreen`).
- **Serialized format** (verbatim): "`?q={1-based int}`, `?comments=1` (whitelist)".
- **Consumer parse rule** (verbatim): "`Number.parseInt` clamp to `[1,N]`; exact-string whitelist compare".
- **Expected signal** (verbatim): "Deep link opens/scrolls to the right row without error even if the target question was since deleted (AC-061 note)".
- **Roundtrip check**: a link built as `?q=3&comments=1` parses to `{ q: 3, commentsOpen: true }`; `?q=999` on a 10-question solution parses to `q: 10`; `?q=abc` and `?comments=true` parse to "absent".

## Investigation Notes
(Append observations here before implementation begins.)

- **`SolutionAuthorCard`/`HelpfulButton`/`SolutionMenu`** (task 19, committed `daef762`): `SolutionAuthorCard({ solution, examId, now, isExamAuthor, editHref? })` — `isExamAuthor: boolean` is **required** (not optional) and gates `SolutionMenu`'s pin/unpin item; `editHref` is required-in-practice only when `solution.isMine`. `SolutionMenu` renders exactly one of "Sửa bài giải" (isMine) or the report branch (`iReported` true/false) — never both. Task 19's own Investigation Notes record: "No field exists anywhere in `SolutionDetail`/`SolutionListItem` indicating whether the VIEWER is the EXAM's author… `SolutionMenu` accepts it as an explicit `isExamAuthor` boolean prop that the future screen (task 21) will derive from exam data it already holds." No committed exported query (`features/exams/queries/*`, `features/solutions/queries.ts`) currently returns an exam's `author_id`/`authorId` — `getExam()` (`features/exams/queries/catalogue.ts`) selects only `author_display_name`, never `author_id`. `editHref` for the view screen's own solution needs `attemptId`, which `SolutionDetail` does not carry either, but `getMySolutionForWriter(examId)` (already exported from the in-scope `features/solutions/queries.ts`) returns `attemptId` on the eligible-caller branch, mirroring `SolutionList.tsx`'s existing `editHref` construction (`/exams/${examId}/attempt/${own.attemptId}/solution`) — this part is resolvable in-scope.
- **`SolutionQuestionRow`/`SolutionNoteBlock`** (task 20, committed `4c5470d`): `SolutionQuestionRow`'s open/closed accordion state is **fully internal** (`useState(false)`, no `defaultOpen`/`open` prop, no `id`, no `tabIndex`, no `ref`/imperative handle, no `scroll-mt-*` class on its root `<li>`). It exposes no mechanism for a parent to force a specific row open, focus it, or scroll to it.
- **Established "jump to X, scroll + focus" pattern in this codebase** (`SOURCE/features/authoring/components/QuestionJumpDock.tsx` + `SOURCE/features/authoring/components/QuestionEditor.tsx:216`): the **target card itself** carries `id={p{part}q{number}}`, `tabIndex={-1}` and `scroll-mt-24` baked into its own root; the jump dock does `document.getElementById(id).scrollIntoView({block:"start"})` then `.focus({preventScroll:true})`. This is the only "jump and focus" precedent in the repo, and it requires the *target row component* to own the id/tabIndex/scroll-mt — not the parent.
- **UI Spec** (§ Component: SolutionViewScreen, AC-061 row): "Hàng k mở sẵn, được cuộn vào tầm nhìn, **tiêu điểm đặt lên đầu hàng**" — focus-to-row-head is an explicit UI Spec requirement for AC-061, not just an executor embellishment (PRD AC-061 itself only states "opened and scrolled into view", the focus detail is UI-Spec-level).
- **Gap identified**: satisfying AC-061's "row k pre-opened, scrolled into view, focus at the row head (`tabIndex={-1}`, `scroll-mt` clears `SiteHeader`)" requires `SolutionQuestionRow.tsx` (task 20's already-committed file, out of this task's Target Files) to gain an externally-settable open state and an id/`tabIndex`/`scroll-mt` anchor on its root — the same shape `QuestionEditor.tsx` already has for its own jump-dock use case. No construct scoped to this task's Target Files alone (imperative DOM click-simulation via a container `ref`, wrapping the row's `<li>` in another element) reproduces this without either invalid HTML nesting (`<li>` cannot gain a wrapping `<div>`/second `<li>` inside `<ol>`/`<ul>` without breaking list semantics) or bypassing React's own reconciliation of the row's DOM node from outside its own render (fragile, and still can't supply `tabIndex`/`scroll-mt` reliably since `SolutionQuestionRow` never sets those attributes in its own JSX to begin with — the parent would be inventing behavior the child was never built to expose, which is exactly a "compose task 19/20 as-is" contract mismatch per the task brief). Escalated in a prior attempt.
- **Similarly, no committed query returns an exam's `author_id`** (see the "SolutionAuthorCard/HelpfulButton/SolutionMenu" note above) — `SolutionMenu.isExamAuthor` had no producer in scope. Also escalated in a prior attempt.
- **Engineer decisions (this attempt), both applied**:
  1. **AC-061 fix**: `SolutionQuestionRow.tsx` extended additively with three optional props — `id?: string`, `tabIndex?: number`, `defaultOpen?: boolean` — mirroring the `QuestionEditor.tsx`/`QuestionJumpDock.tsx` id/tabIndex/scroll-mt-24 precedent. Root `<li>` gains `id`/`tabIndex` and a `scroll-mt-24 focus:outline-none` class ONLY when `id` is passed (`className={id !== undefined ? "scroll-mt-24 focus:outline-none" : undefined}`); `useState(false)` became `useState(defaultOpen ?? false)`. Purely additive/backward-compatible: every existing call (task 20's own tests, none of which pass these props) renders byte-identical to before — verified by the "không truyền gì" test in `SolutionQuestionRow.test.tsx`'s new Required Test #7 describe block, and by the full existing test suite (23/23 tests in that file) staying green. `SolutionViewScreen` is the only caller that sets these props, computing `isDeepLinkTarget = initialOpenQuestion === questionNumber` per row and passing `id`/`tabIndex={-1}`/`defaultOpen` only on that one row.
  2. **isExamAuthor query**: added `isExamAuthor(examId): Promise<boolean>` to `features/exams/queries/catalogue.ts` (re-exported from `features/exams/queries/index.ts`), following the exact `getMyExam()` precedent (`features/authoring/queries.ts:85-105`): `.from("exams").select("id").eq("id", examId).eq("author_id", user.id).maybeSingle()`, backed by RLS `exams_select_visible` (tác giả đọc được đề của mình bất kể status). Returns a boolean (not the raw `author_id`) — this gate only needs a yes/no decision, and `author_id` does not otherwise reach the client anywhere in this feature. Not logged in / exam not found / not the author all collapse to `false` (nothing to leak at this gate — it is not an eligibility/visibility boundary the way AC-063 is). `SolutionViewPage` calls it in parallel with `getMySolutionForWriter`/`getExam`, all three AFTER the `getSolutionDetail` null-check (both are guaranteed non-null once `community_solution_detail`'s own R1 gate has passed, per backend DD § Data Contracts `community_solution_detail` "Validation: R1 gate re-derived internally", `docs/design/community-solutions-backend-design.md:1512`).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests:
  - **`?q`/`?comments` boundary** (parser unit + rendered screen): `?q=3&comments=1` → `{ q: 3, commentsOpen: true }`; `?q=999` on a 10-question solution → `q: 10`; `?q=abc` → absent (no row pre-opened); `?comments=true` → absent (whitelist `=== "1"`); `?q=3` pre-opens row 3. — `SolutionViewPage.test.tsx`'s `parseSolutionDeepLink` describe block + `SolutionViewScreen.test.tsx`'s "liên kết sâu ?q=k" describe block.
  - `getSolutionDetail → null` → `redirect("/exams/[id]")` (same result for hidden and nonexistent); all-questions-deleted → the dashed empty card, no error; deep link to a deleted question → opens without error. — `SolutionViewPage.test.tsx`.
  - **`iReported` threading** (frontend DD § Test Boundaries, "Already-reported tests", task 21; quoted): "the screen rendered with a `SolutionDetail` whose header `iReported` is `true` and whose first question has one comment with `iReported: true` and a second with `iReported: false` renders exactly one `/Bạn đã báo cáo bài giải này\./` and exactly one `/Bạn đã báo cáo bình luận này\./` — proving both values are threaded from the read down to both surfaces, not defaulted." The header half (exactly one "Bạn đã báo cáo bài giải này." and, with `iReported: false`, none) is asserted in this task; the comment half needs `CommentItem` (task 28, which depends on this task) — see Notes "Sequencing". — `SolutionViewScreen.test.tsx`'s iReported describe block.
  - **Comment affordance, screen level** (frontend DD § Test Boundaries, "Comment-affordance tests"): a detail with one question whose note has **no** `commentCount` and one with `commentCount: 0` → the first renders its note and no comment button and no "m bình luận" text; the second renders the "Bình luận" button. — `SolutionViewScreen.test.tsx`'s comment-affordance describe block.
  - Plus (engineer decisions): `SolutionQuestionRow.test.tsx` Required Test #7 (additive id/tabIndex/scroll-mt-24/defaultOpen); `catalogue.isExamAuthor.test.ts` (new query function).
- [x] Run and confirm failure

### 2. Green Phase
- [x] Implement parser, screen, route files
- [x] Run only the added tests and confirm they pass (44/44 new/updated tests green)

### 3. Refactor Phase
- [x] Keep URL parsing in one pure function exported for task 45's link builder to mirror — `parseSolutionDeepLink` exported from `page.tsx`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — the view route's browser-level proof lands in tasks 23/24 (same lane)
- `next build` (manual manifest read) — per-route first-load JS ≤~170KB gzip; markdown/KaTeX chunk absent from this route's first bundle (formal measurement task 48)
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test`; then on the dev server against dev Supabase, as an eligible non-author open a published solution from the list, open `?q=2`, and open a draft solution id belonging to someone else.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: the solution opens with header + rows; `?q=2` pre-opens and scrolls to row 2; the foreign draft id redirects to `/exams/[id]` with no content flash.
- **Failure response**: if the page can render any content for an id the RPC returned empty, stop — the redirect must precede rendering.
- **Verification level**: L1 (open a solution on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (Failure Mode #6, unavailable boundary / AC-063): an ineligible or nonexistent solution id redirects server-side, never error-renders, never reveals existence.
- **Primary failure mode**: a hidden solution id renders the error page while a nonexistent id redirects — leaking which ids exist.
- **Boundary to exercise**: route Server Component with `features/solutions/queries.ts` mocked at the module boundary for both "hidden" and "nonexistent" (both `null`).
- **State assertion**: N/A.
- **Mock boundary rationale**: query module mocked; the RPC's empty-result contract is proven on real DB in task 16.
- **Residual**: none.

- **Claim** (Connection Map, `?q`/`?comments`): the parse rule clamps and whitelists exactly as specified.
- **Primary failure mode**: `?q=0` or `?q=999` throws or opens nothing silently; `?comments=true` opens the sheet.
- **Boundary to exercise**: in-process unit on the parser + rendered screen for `?q=3`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: the comment sheet opening from `?comments=1` is proven in task 28; the "Trả lời" producer in task 45.

- **Claim** (frontend DD Element 10 / Field Propagation Map): "The mapper must **not** drop a `false`" — `iReported` is a required boolean at both levels, read with the detail and threaded from `SolutionViewScreen` to `SolutionMenu` (solution) and `CommentItem` (comment).
- **Primary failure mode**: the screen defaults `iReported` to `false` (or drops it), so a reporter who reloads is offered a report the server will silently no-op (AC-074 "no user action in between").
- **Boundary to exercise**: rendered `SolutionViewScreen` with a literal `SolutionDetail` (header `iReported: true`; one comment `true`, one `false`), `queries.ts`/`actions.ts` mocked at the module boundary.
- **State assertion**: exactly one `/Bạn đã báo cáo bài giải này\./` (header) and exactly one `/Bạn đã báo cáo bình luận này\./` (comments) — not two, not zero.
- **Mock boundary rationale**: query and action modules mocked; components render for real.
- **Residual**: the comment row's own two report states are task 37; the comment-row render needs task 28.

- **Claim** (Reference Contract Value #20): "the comment affordance renders if and only if `note.commentCount` is present."
- **Primary failure mode**: the screen shows a comment button (or "0 bình luận") under a note whose solution is a draft/hidden preview, where the backend sent no `comment_count`.
- **Boundary to exercise**: rendered screen with a question lacking `commentCount` and one with `commentCount: 0`.
- **State assertion**: no comment button and no "m bình luận" text for the first; a "Bình luận" button for the second.
- **Mock boundary rationale**: none beyond the mocked query module.
- **Residual**: SQL-level `null` (never `0`) is proven in task 16.

## Completion Criteria
- [x] All added tests pass (44/44 new/updated; full `features/solutions` + `features/exams` unit suite 359/359 green; `npx tsc --noEmit` clean; `npm run lint` clean on changed files; `next build` succeeds and lists the new route)
- [x] Operation verified per Operation Verification Methods above — L2 (new tests passing) done in full; L1 (dev-server, signed-in Playwright walkthrough) deferred, same standing sign-in constraint as tasks 08/10/18 (not stalled on)
- [x] Each Proof Obligation is met (AC-063 redirect symmetry, `?q`/`?comments` clamp/whitelist, `iReported` header-half threading, Reference Contract #20 comment affordance — all covered by the new tests above)

## Notes
- Impact scope: task 22 adds palette current-highlight wiring to this screen; task 28 mounts the comment sheet.
- Scope boundary: no comment sheet in this task.
- Sequencing: the frontend DD assigns the "exactly one 'Bạn đã báo cáo bình luận này.'" assertion to the `SolutionViewScreen` test of task 21, but no comment row exists until task 28 (`CommentSheet`/`CommentItem`, which depends on this task) and its report control until task 37. This task therefore asserts the header half and the `commentCount` cases; the comment half is completed in this same screen test file when task 28 mounts the sheet (task 28 re-runs it).
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
