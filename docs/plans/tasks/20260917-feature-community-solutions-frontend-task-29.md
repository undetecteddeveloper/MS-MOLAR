# Task 29: Unread "chấm đỏ" badge on the writer's own `SolutionCard`

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P3-T6
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T6)
- **Dependencies**: task 25 (P3-T1), task 26 (P3-T2 — provides `getMyUnreadCommentCount`), task 17 (P2-T5 split 1/2, `SolutionCard`); plus task 18 (list route that fetches the count) and task 27 (real-data AC-091 exclusion proof)
- **Provides**: list-card half of AC-092; shares its formula with task 45's profile chip
- **Size**: Small (2 files + component test)

## Implementation Content

- `SolutionCard` renders a red dot (`span aria-hidden bg-destructive size-2 rounded-full`) + the text "k bình luận mới" (`--primary-foreground` on `--destructive`, 9.3:1) **only** on the viewer's own card (`item.isMine`), and only when the count is > 0. The count reaches the card as a prop the route supplies only for the `isMine` row (the same rule as `editHref`); the component never computes it.
- **Counting rule (frontend DD § Data Contracts "Comment feed contract", "Counting rule (AC-091, AC-092) — one formula, two consumers"; Reference Contract Value #23)**: "A row counts as new IF AND ONLY IF `isUnread && examVisible`"; "the writer's own `SolutionCard` in exam X's list shows a dot + 'k bình luận mới' with k = the number of such rows whose `examId === X`". A feed row with `examVisible: false` is listed on the profile tab but is **not** counted here.
- The list route (`SOURCE/app/(exams)/exams/[id]/solutions/page.tsx`) fetches the count with **one** call to `getMyUnreadCommentCount` from `SOURCE/features/solutions/queries.ts` (task 26), scoped to this exam, and only when the viewer has a published solution on this exam. The count is never computed in the component and never by a naive `community_comments_last_read_at` vs `created_at` comparison — the formula (`countUnreadComments`, `isUnread && examVisible`) lives in `SOURCE/lib/solutions/unreadComments.ts` (decomposer resolution R6) and is shared with task 45's profile chip. The feed's row set already excludes the viewer's own comments, comments under a draft/hidden solution (S7) and admin-hidden comments (S19); `examVisible` carries the S8 exclusion.
- Never added to the shared top-bar avatar or any layout (D38, AC-094).

## Acceptance Criteria

From the plan (§ P3-T6): **AC-091, AC-092 (list-card half), AC-094**.

Carried hard constraints that apply to this task:
- Data only via `SOURCE/features/solutions/queries.ts`; no query added to any shared layout (`SOURCE/app/layout.tsx` and route-group layouts untouched — `SOURCE/app/layout.tsx` also carries uncommitted engineer changes).
- Vietnamese strings only via `SOURCE/lib/copy.ts`; the count is in the accessible name, the dot is `aria-hidden`; 360px floor; "Đêm hội" tokens only.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionCard.tsx` (extend)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/page.tsx` (one count query for the viewer's own published solution)
- [x] Component test under `SOURCE/features/solutions/components/__tests__/` (`SolutionCard.test.tsx`, `SolutionList.test.tsx`, `SolutionsListPage.test.tsx`)
- [x] (unlisted, required plumbing — see Investigation Notes "Scope note") `SOURCE/features/solutions/components/SolutionList.tsx` (pass-through `unreadCommentCount` prop) + its test
- [x] (unlisted, required — see Investigation Notes "Scope note") `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (new `getMyUnreadCommentCount` mock export) + `SOURCE/lib/copy.ts` (new `solutions.card.unreadComments` key)

## Investigation Targets
- `SOURCE/features/solutions/components/SolutionCard.tsx` (task 17)
- `SOURCE/app/(exams)/exams/[id]/solutions/page.tsx` (task 18)
- `SOURCE/features/solutions/queries.ts` (`getMyUnreadCommentCount`, task 26) and `SOURCE/lib/solutions/unreadComments.ts` (`countUnreadComments`, task 26)
- `SOURCE/tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` (task 27 — the real-data AC-091 exclusion proof this badge relies on)
- `SOURCE/features/authoring/components/QuestionJumpDock.tsx` (line ~87: `aria-hidden bg-destructive size-2` dot idiom)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — `community_comments_last_read_at`)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `community_comments_last_read_at` write-only-by-`markCommentsRead`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Comment feed contract", "Counting rule"; § Test Boundaries — "Comment feed tests (frontend tasks 45 and 29)")
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionCard — verify unread-badge (Phase 3 extension) state)
- `docs/ui-spec/community-solutions-ui-spec.md` (row `AC-092`; DV-05; contrast row "Viên số chưa đọc")
- `docs/prd/community-solutions-prd.md` (D21, D38, AC-091, AC-092, AC-094)

## Investigation Notes

- **`SolutionCard.tsx` (task 17)**: props were `{ item, examId, now, editHref? }`; `editHref` is the precedent this task's `unreadCommentCount` follows — supplied by the parent only for `item.isMine === true`, no self-check of `isMine` inside for that link. Extended with `unreadCommentCount?: number`; render condition is `item.isMine && unreadCommentCount !== undefined && unreadCommentCount > 0` (outer `{item.isMine && (...)}` wrapper already present from task 17's "Bài của bạn"/"Sửa" block — the badge nests inside it, so a count supplied to a non-`isMine` row can never render regardless of value).
- **`page.tsx` (task 18)**: exactly two fixed reads (`getMySolutionForWriter`, `listSolutions`) plus the exam read; S11 redirect happens before any other read. `own.status === "published"` is the exact branch where `OwnSolutionBlock` renders `null` (verified in `OwnSolutionBlock.tsx`) — reused this same condition to gate the new conditional `getMyUnreadCommentCount` call, added to the existing `Promise.all` (a `Promise.resolve(undefined)` branch when not published, so the call count stays "at most one, never per-row").
- **`queries.ts` (task 26)**: `getMyUnreadCommentCount(opts?: { solutionId? })` pages through `community_my_comment_feed`, stopping at the first non-full or mixed-read page, delegating the actual "counts as new" rule to `countUnreadComments`. It filters by `solutionId`, not `examId` — this is exploited here: since a writer has at most one solution per exam, scoping by `own.solutionId` (the writer's own solution on THIS exam) is equivalent to "count rows whose examId === X" per the frontend DD's counting-rule wording.
- **`unreadComments.ts` (task 26)**: pure `countUnreadComments(rows, opts?)`, row counts iff `isUnread && examVisible`, optionally scoped by `solutionId`. Not re-implemented; reused directly in the new `SolutionsListPage.test.tsx` fixture-linked test (feeds the literal fixture rows through the real formula to derive the expected rendered count, rather than hand-typing a disconnected magic number).
- **`community-solutions-comment-feed.localdb.test.ts` (task 27)**: real-DB proof — (a) own comment, (b) admin-hidden (S19), (c) draft-solution comment (S7) excluded from the feed entirely; (d) S8 exam-not-visible row present but `exam_visible: false`; (e) normal row present and counted; `countUnreadComments(...) === 1` when cursor is null. **Re-ran this file** against the current dev schema (`npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts" tests/e2e/service/community-solutions-comment-feed.localdb.test.ts`, after `npm run verify:schema` green): **6/6 passed.** The AC-091 exclusion proof this badge depends on still holds.
- **`QuestionJumpDock.tsx:87`**: confirmed idiom `<span aria-hidden className="bg-destructive size-2 rounded-full" />` reused verbatim for the dot; the same file's `bg-destructive text-primary-foreground` combo (line ~143, on the question-jump button) is the precedent reused for the accessible-name text pill ("Viên số chưa đọc" contrast row, UI Spec Tương phản table, 9.3:1).
- **Backend/frontend DD Field Propagation Map — `community_comments_last_read_at`**: write-only by `markCommentsRead` (task 26's Server Action); `is_unread` is computed against it at READ time in `community_my_comment_feed`, never stored per-comment. This task never writes the cursor — read-only consumption via `getMyUnreadCommentCount`.
- **UI Spec § Component: SolutionCard, row "Bài của tôi (đã đăng)"**: "khi k > 0: chấm `bg-destructive size-2` (`aria-hidden`) + chữ 'k bình luận mới'"; AC-092 row: "chấm là trang trí (`aria-hidden`), chữ mang thông tin" — matches the render implemented (dot `aria-hidden`, text carries the full accessible content, not wrapped in anything hiding it from the accessibility tree).
- **Scope note (File Scope Constraint)**: `SolutionList.tsx` is NOT listed in this task's Target Files, but modifying it was unavoidable — `page.tsx` renders `SolutionCard` only through `SolutionList`'s `.map`, so the count cannot reach the card without `SolutionList` forwarding it (mirrors exactly how `editHref` already crosses that same boundary). Treated as in-scope, low-risk, additive-only plumbing (new optional prop, no existing prop touched) per the Gray Zone guidance ("appending optional Props while preserving existing is minor"); not escalated. Also required: adding the `getMyUnreadCommentCount` export to the `@/features/solutions/queries` mock in `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 2 renders `SolutionsListPage` with `own.status: "published"`, so the route now calls it there too) — otherwise `npm run test:fixture` (an explicit Quality Assurance Mechanism for this task) breaks.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests (frontend DD § Test Boundaries, "Comment feed tests (frontend tasks 45 and 29)", `getMyCommentFeed`/`getMyUnreadCommentCount` mocked at the module boundary):
  - the own-card count for exam X equals the number of feed rows satisfying `isUnread && examVisible` whose `examId === X` (e.g. rows for X: unread+visible, unread+visible, read+visible, unread+`examVisible: false`; plus one unread+visible row for exam Y → own card of X shows "2 bình luận mới"); a row with `examVisible: false` is not counted — `SolutionsListPage.test.tsx` describe "k khớp đúng countUnreadComments trên feed thô";
  - badge renders on the viewer's own card with count 3; never on another writer's card even if a count prop were supplied; hidden when count = 0 — `SolutionCard.test.tsx` describe "chấm chưa đọc chỉ trên thẻ của mình";
  - the route calls `getMyUnreadCommentCount` exactly once, scoped to this exam, and not at all when the viewer has no published solution — `SolutionsListPage.test.tsx` describe "getMyUnreadCommentCount chỉ gọi khi bài của mình đã đăng".
- [x] Run and confirm failure (honest note: implementation and tests were authored in the same edit pass rather than strict test-first sequencing; tests passed on first run against the finished implementation — not separately verified red beforehand)

### 2. Green Phase
- [x] Implement badge + route wiring
- [x] Run only the added tests and confirm they pass (35/35 across the 3 files)

### 3. Refactor Phase
- [x] Keep the "is own card" decision on the mapped `isMine` field
- [x] Confirm added tests still pass (re-ran after refactor pass — unchanged, all green)

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — J1 / Test 2 stay green
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `test:fixture`; re-run task 27's `community-solutions-comment-feed.localdb.test.ts` (lane rule) and record its result.
- **Success criteria**: badge tests green; task 27's AC-091 exclusion test green on the current dev schema.
- **Failure response**: if the badge needs a count source other than `getMyUnreadCommentCount`, stop — the shared formula is binding for both call sites.
- **Verification level**: L2 (new tests added and passing)
- **Result (task-executor-frontend, 2026-09-26)**:
  - `npm test` (full suite): 2464 passed, 10 skipped, 0 failed (188/189 files passed, 1 skipped file).
  - `npm run test:fixture`: 14/14 passed (J1 + Test 2 both green, including the anonymity-leak S-03 row that now also exercises the new `getMyUnreadCommentCount` call path).
  - `npx eslint --max-warnings 0` on all touched files: clean.
  - `npx tsc --noEmit`: clean.
  - `npx tsx supabase/verify-schema.ts`: green on dev.
  - Task 27's `community-solutions-comment-feed.localdb.test.ts` re-run (`npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts" tests/e2e/service/community-solutions-comment-feed.localdb.test.ts`): **6/6 passed** — AC-091 exclusion proof still holds on current dev schema.

## Proof Obligations
- **Claim** (D38, verbatim): "Chấm đỏ/số 'chưa đọc' chỉ hiện trên ô 'Bình luận' của trang hồ sơ và trên bài giải của mình trong danh sách; không thêm vào ảnh đại diện ở thanh trên."
- **Primary failure mode**: the badge appears on another writer's card, or a count query is added to a shared layout.
- **Boundary to exercise**: rendered `SolutionCard` for own and non-own items; route with `features/solutions/queries.ts` mocked.
- **State assertion**: N/A.
- **Mock boundary rationale**: query module mocked at the module boundary.
- **Residual**: none.

- **Claim** (AC-091, PRD verbatim): "Given tôi có bài đã đăng, then một 'bình luận mới' là bình luận của người khác dưới một ghi chú đang hiện của bài đó, tạo sau lần tôi mở tab 'Bình luận' gần nhất (chưa từng mở → mọi bình luận đều mới); bình luận của chính tôi không bao giờ tính là mới; bình luận trên bài mà đề hiện không hiện (published bị gỡ / tác giả bị khoá, S8) không tính là mới trong lúc đó — đề hiện lại thì tính theo luật chung; bình luận trên bài đang nháp / bị ẩn (S7) và bình luận bị admin ẩn (S19) cũng không tính."
- **Primary failure mode**: the list badge counts the viewer's own comment, an S8 comment, or an admin-hidden comment.
- **Boundary to exercise**: the plan requires "a test (integration or RLS) asserting all three AC-091 exclusions hold". Per decomposer resolution R6 this proof is delivered by task 26 (`unreadComments.test.ts`, formula + paging) and task 27 (`community-solutions-comment-feed.localdb.test.ts`, real feed row set: own, S7, S19 excluded; S8 listed but not counted). This task re-runs both and consumes the formula without re-implementing it.
- **State assertion**: see task 27 (seeded (a)–(e) → count = 1).
- **Mock boundary rationale**: component test mocks the query; the exclusion proof is real-DB in task 27.
- **Residual**: none once tasks 26/27 are green.

- **Claim** (Reference Contract Value #23, verbatim): "a row counts as new — in every count, badge and unread dot — only when `is_unread && exam_visible` (AC-091)"; frontend DD: the own card's k = "the number of such rows whose `examId === X`".
- **Primary failure mode**: the own-card badge counts an S8 row (`examVisible: false`) that the profile tab still lists, or counts another exam's unread rows, so the two surfaces disagree.
- **Boundary to exercise**: route/component with `getMyUnreadCommentCount` mocked at the module boundary, and `countUnreadComments` (task 26's pure formula) fed the literal feed rows above.
- **State assertion**: rows {X: unread+visible ×2, read+visible, unread+`examVisible: false`; Y: unread+visible} → own card of X reads "2 bình luận mới"; the `examVisible: false` row and exam Y's row add nothing.
- **Mock boundary rationale**: query module mocked in the component test; the exclusion proof on real feed rows is task 27.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above (task 26/27 exclusion tests re-run green)
- [x] Each Proof Obligation is met

## Notes
- Impact scope: task 45 uses the same helper for the profile chip.
- Scope boundary: no layout files; no shared top bar changes.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
