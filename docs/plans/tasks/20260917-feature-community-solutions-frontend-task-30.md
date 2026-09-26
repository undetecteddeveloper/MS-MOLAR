# Task 30: fixture-e2e Test 2 finalize — comment-sheet portion (O-02)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P3-T7
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T7)
- **Dependencies**: task 24 (P2-T9), task 28 (P3-T5)
- **Provides**: completes skeleton Test 2 — S-03, S-05, O-02 all verified in one file
- **Size**: Small (2 files)

## Implementation Content

- Add the **O-02 comment-sheet portion** to Test 2 in `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`.
- Add comment fixture rows to `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts`: a NAMED comment, an ANONYMOUS comment (whose source data carries a real name/avatar elsewhere in the fixture set), and a comment by the solution's writer (`is_solution_author: true`).
- Open the sheet through the real screen (row "Bình luận" button or `?comments=1`), then query the rendered DOM subtree of each comment item.

## Acceptance Criteria

From the plan (§ P3-T7): **AC-105, M5 (comment-sheet browser-level proof, closes the file's Test 2)**.

Carried hard constraints that apply to this task:
- J1 and the existing Test 2 portions stay green; Test 3's comment block stays intact until task 31.
- `identity.ts` and `RichText` remain unmocked; `features/solutions/{queries,actions}.ts` mocked at the module boundary.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 2: O-02 portion)
- [x] `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (comment rows)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 2 annotations; S-03/S-05 portions from task 24)
- `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts`
- `SOURCE/features/solutions/components/{CommentSheet,CommentItem,SolutionViewScreen}.tsx` (task 28 mount)
- `SOURCE/lib/solutions/identity.ts`
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentItem — default state; § Component: CommentSheet — default state)
- `docs/prd/community-solutions-prd.md` (AC-105, D42, M5)

## Investigation Notes

- `community-solutions.fixture.e2e.test.ts` — Test 2 (task 24) already has S-03
  (`SolutionsListPage`) and S-05 (`SolutionViewPage`) portions, each isolating
  ONE property per fixture solution (NAMED baseline, ANONYMOUS identity,
  hidden-score). Reused `imagesWithSrc()`/`authorCardSection()` subtree
  helpers unchanged — no new helper needed for O-02 (comment rows are located
  by their own body text + `.closest("li")`, same "own accessible
  cue → scope to ancestor" technique task 24 used via `getByRole("link",
  ...).closest("li")`).
- `communitySolutionsFixtureData.ts` — `SolutionDetail.questions[].comments:
  SolutionDetailComment[]` (per-question, not per-solution, per
  `features/solutions/queries.ts` `SolutionDetailQuestion.comments`). Added a
  DEDICATED solution `T2_COMMENTS_SOLUTION_ID` (own author identity reused
  from `T2_NAMED_*`, irrelevant to this test — only comment rows are
  asserted) with exactly one question carrying 3 comment rows, same
  isolate-one-property discipline as the S-03/S-05 trio.
- `CommentSheet.tsx`/`CommentItem.tsx` (task 28 mount, read in full): comments
  only render once `chunkState === "shown"` (dynamic `import("@/components/
  shared/RichText")` resolves) — `screen.findByText(...)` on the first
  comment's body both waits out the chunk load AND proves the sheet actually
  rendered. `OverlaySheet` (`role="dialog"`) gates on an `isClient`
  `useSyncExternalStore` flip, also covered by the same `findByText` await.
  `CommentItem` badge ("Người viết") reads `comment.isSolutionAuthor`
  independently of `comment.author.kind` — confirms a writer's comment CAN be
  simultaneously anonymous + writer-badged (mirrors `CommentItem.test.tsx`
  Required Test #3, now proven through the real screen).
- `SolutionViewScreen.tsx`/`page.tsx` (`parseSolutionDeepLink`): `?q=1&comments=1`
  opens `CommentSheet` for question 1 directly on first render, with NO
  button click needed — `initialCommentsOpen && initialOpenQuestion` derive
  `openCommentsQuestionId` in `useState`'s lazy initializer. Chose this route
  (task's "either... or") over clicking "Bình luận" because the URL route
  needs no `note`/`note.commentCount` on the fixture question (the button is
  gated on `note.commentCount !== undefined`, per `SolutionQuestionRow.tsx`).
- `identity.ts` (`toAuthorIdentity`): same `null`-at-source discriminator as
  task 24 — fixture's anonymous/writer comment rows call this REAL function
  with `author_display_name: null, author_avatar_url: null`, never a
  hand-typed `{kind:"anonymous"}` literal.
- UI Spec § Component: CommentSheet/CommentItem (read in full) — layout order
  "cũ trước, mới sau" (old first, new last) respected in fixture `createdAt`
  ordering; badge/anonymous matrix rows match `CommentItem.tsx` exactly.
- RED-phase discrimination proof (mandatory per Implementation Steps): with
  the O-02 test written and green, temporarily replaced the ANONYMOUS
  comment's `.author` with a hand-typed
  `{kind:"named", displayName: T2_COMMENT_ANONYMOUS_REAL_DISPLAY_NAME,
  avatarUrl: T2_COMMENT_ANONYMOUS_REAL_AVATAR_URL}` (bypassing
  `toAuthorIdentity`) in `communitySolutionsFixtureData.ts`. Ran
  `npx vitest run --config vitest.fixture.config.ts
  tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`: the O-02 test
  turned RED — `within(anonymousRow).getByText(t("solutions.identity.anonymous"))`
  failed to find the element, and the failure's own DOM dump showed the real
  name/avatar (`Vũ Văn Ẩn Danh Bình Luận`, the `d.png` avatar URL) rendered
  in the row instead — proving the assertion actually discriminates, not a
  vacuous pass. Reverted to the `toAuthorIdentity(null-source)` call; re-ran
  the same command — all 4 tests (J1, S-03, S-05, O-02) green again.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the O-02 assertions; prove they discriminate by temporarily feeding the anonymous comment through a fixture that bypasses the mapper (name present) and confirming red; revert

### 2. Green Phase
- [x] Run `test:fixture`; all Test 2 portions and J1 green

### 3. Refactor Phase
- [x] Reuse Test 2's subtree-query helpers
- [x] Confirm the whole file passes

## Quality Assurance Mechanisms
- `npm run test:fixture` — Config: `SOURCE/vitest.fixture.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` inside `SOURCE/`.
- **Success criteria**: zero occurrences of the fixture's real name/avatar strings inside the anonymous comment's rendered subtree; the writer's comment shows the "Người viết" badge with no other identity leak; the named comment shows its own name.
- **Failure response**: if the anonymous comment subtree leaks identity, stop Phase 3 and fix `CommentItem` before task 31.
- **Verification level**: L2 (fixture assertions added and passing)

## Proof Obligations
- **Claim** (skeleton Test 2, O-02 subset, verbatim): "S-05 detail / O-02 comment sheet: same for an anonymous comment, plus the 'is the solution's writer' boolean badge renders when applicable, with no other identity leak alongside it."
- **Primary failure mode** (skeleton): "a component renders row.author_display_name directly (bypassing the AuthorIdentity mapper/discriminated union), so an anonymous-fixture row's real name leaks into the DOM."
- **Boundary to exercise**: rendered S-05 route tree with the O-02 sheet opened through the real screen.
- **State assertion**: N/A.
- **Mock boundary rationale**: query/action modules mocked; mapper, components, `RichText` real.
- **Residual**: real-DB anonymity for comments is proven in task 27 (R3) and task 47 (SE2).

## Completion Criteria
- [x] O-02 portion passes; all of Test 2 (S-03, S-05, O-02) and J1 pass in the same run
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: closes skeleton Test 2.
- Scope boundary: test + fixture files only.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
