# Task 24: fixture-e2e Test 2 (anonymous never renders) — list + detail portions

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T9
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T9)
- **Dependencies**: task 18 (P2-T5 split 2/2), task 21 (P2-T6 split 3/3) — plan labels P2-T5, P2-T6; plus task 23 (P2-T8), because the driver import and `communitySolutionsFixtureData.ts` this test extends are created there
- **Provides**: browser-level anonymity proof for S-03 and S-05; task 30 completes Test 2 with the O-02 portion
- **Size**: Small (2 files)

## Implementation Content

- Fill the **S-03 (list) and S-05 (detail) portions of Test 2** in `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`. The O-02 comment-sheet portion is **not** written here (task 30).
- Fixture rows in `communitySolutionsFixtureData.ts` include both a NAMED and an ANONYMOUS solution, plus a `show_score=false` solution. The anonymous fixture's source data carries a real name/avatar/score elsewhere in the fixture set so the absence assertion is meaningful.
- Assertions query the **rendered DOM** (not props/internal state) for each row's card/item subtree.

## Acceptance Criteria

From the plan (§ P2-T9): **AC-039, M5 (browser-level proof, list + detail)**.

Carried hard constraints that apply to this task:
- Test 3 comment block stays intact; J1 stays green.
- `identity.ts` and `RichText` remain unmocked.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 2: S-03 + S-05 portions)
- [x] `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (add named/anonymous/show_score=false rows)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 2 annotations; J1 driver from task 23)
- `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (task 23)
- `SOURCE/features/solutions/components/{SolutionCard,SolutionAuthorCard,AuthorIdentity}.tsx`
- `SOURCE/lib/solutions/identity.ts`
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — Mock Boundary Decisions)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionCard — anonymous state; § Component: SolutionAuthorCard — anonymous state)
- `docs/prd/community-solutions-prd.md` (AC-039, M5)

## Investigation Notes

- `community-solutions.fixture.e2e.test.ts` (Test 2 skeleton, task 23 J1 driver): J1 uses `vi.hoisted` mocks for `@/features/solutions/queries` (`getResultCardSummary`, `getMySolutionForWriter`, `getSolutionDetail` only — `listSolutions` was NOT mocked, needed adding since S-03's route calls it), `@/features/solutions/actions`, `@/features/exams/{queries,actions}`, `@/lib/auth/getCurrentUser`, `next/navigation`, `@/lib/pdf/generateAttemptPdf`. `identity.ts`/`RichText` confirmed never mocked anywhere in the file (file header + inline comments). Top-level `beforeEach` does `vi.clearAllMocks()` + resets `redirectMock` — does NOT reset per-mock implementations (those are set inside each test/nested `beforeEach`), so a nested describe's own `beforeEach` setting fresh implementations is safe and matches J1's own pattern.
- `communitySolutionsFixtureData.ts` (task 23): plain builder-function + `FixtureStore` shape; no existing S-03/S-05 fixture rows before this task. `SERVER_NOTE_PREFIX`/`FixtureStore` are J1-only, unused by Test 2.
- `SolutionCard.tsx`/`SolutionAuthorCard.tsx`: both render via `AuthorIdentity` only (`item.author`/`solution.author`), no other read of name/avatar; card-covering link's `aria-label` = `t("solutions.card.openLabel", {name})` where `name` is the displayName or `t("solutions.identity.anonymous")` — used as the per-row subtree boundary (`.closest("li")` for S-03; the unique `<section>` for S-05, since `Breadcrumbs` renders `<nav>` not `<section>` and the S-05 route also echoes the author label into its breadcrumb, which would otherwise make a whole-page `getByText` ambiguous).
- `AuthorIdentity.tsx`: switch on `identity.kind`; anonymous branch renders `AnonymousAvatar` + "Ẩn danh" text, structurally cannot read a name/avatar field (compile-time enforced, per file's own header comment) — confirms the risk this test guards against is a bypass OUTSIDE this component (a future edit reading a raw field elsewhere), not a defect reachable inside it today.
- `lib/solutions/identity.ts`: `toAuthorIdentity`/`toScoreField` are pure, take `null`-at-source input (mirrors the real masked RPC shape — masking happens in the DB/RPC layer, not in this frontend mapper). Both imported for REAL (unmocked) into the fixture data module and used to build Test 2's rows, so the masking call itself is genuine code, not a hand-typed `{kind:"anonymous"}` literal.
- `components/shared/Avatar.tsx`/`AnonymousAvatar.tsx`: `Avatar` only renders `<img>` when `src` passes `isAllowedImageUrl` (`components/shared/QuestionFigure.ts`), which allow-lists exactly one origin from `process.env.NEXT_PUBLIC_SUPABASE_URL` — set in a `beforeAll` (same pattern as `AuthorIdentity.test.tsx`) so the NAMED/hidden-score rows' real `<img>` actually renders (otherwise the anonymous row's "no matching `<img>`" check would be vacuously true).
- `app/(exams)/exams/[id]/solutions/page.tsx` (S-03): calls `getMySolutionForWriter` (S11 gate — must resolve non-null to avoid `redirect()`), `getExam`, `listSolutions`, in that shape.
- `app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` (S-05): calls `getSolutionDetail` (gate — non-null needed), `isExamAuthor`, `getMySolutionForWriter`, `getExam`; `SolutionAuthorCard`/`HelpfulButton`/`SolutionMenu` render for real (menu closed by default — no portal content on initial render, confirmed by reading `SolutionMenu.tsx`).
- Confirmed via `docs/design/community-solutions-frontend-design.md` § Test Boundaries and `docs/ui-spec/community-solutions-ui-spec.md` (SolutionCard/SolutionAuthorCard anonymous state) and `docs/prd/community-solutions-prd.md` AC-039/M5 — no deviation found; implementation matches the skeleton's own Proof Obligation verbatim.

**Fixture design**: three rows, each isolating exactly one property — NAMED (baseline, proves the technique can find a real identity), ANONYMOUS (identity masked, score stays visible — `show_score`/`show_profile` are independent), `show_score=false` (identity visible, score masked). A distinct "real" name/avatar/score constant set (`T2_ANONYMOUS_REAL_*`, `T2_HIDDEN_SCORE_REAL_VALUE`) exists per the task's hard requirement — never fed into the actual masking call for the rendered row, only used for the absence-check strings and the RED-phase proof below.

**RED-phase discrimination proof (performed, then reverted)**: temporarily changed the ANONYMOUS row's `.author` (both S-03 list item and S-05 detail) from `toAuthorIdentity({author_display_name: null, author_avatar_url: null})` to a direct `{kind:"named", displayName: T2_ANONYMOUS_REAL_DISPLAY_NAME, avatarUrl: T2_ANONYMOUS_REAL_AVATAR_URL}` literal (bypassing the mapper — exactly the Primary failure mode) and separately changed the hidden-score row's score field from `toScoreField(...)` output to a literal `T2_HIDDEN_SCORE_REAL_VALUE` (bypassing that mapper). Ran `test:fixture` after each change: both turned the corresponding assertion red (`getElementError`: `getByRole("link", {name: ...})` could no longer find the anonymous row by its "Ẩn danh" open-label, since the bypassed row now carries a named identity instead). Reverted both changes; re-ran `test:fixture` — all 3 tests (J1 + S-03 + S-05) green again. This confirms the absence checks are discriminating, not tautological.

**Binding Decisions / Reference Contracts**: task file has neither section — not applicable.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the S-03/S-05 assertions; prove they discriminate by temporarily feeding the anonymous row through a fixture that bypasses `toAuthorIdentity` (name present) and confirming red; revert

### 2. Green Phase
- [x] Run `test:fixture`; S-03/S-05 portions green

### 3. Refactor Phase
- [x] Share subtree-query helpers with J1 (`imagesWithSrc` added alongside `disabledNodes`)
- [x] Confirm J1 and Test 2 portions pass together

## Quality Assurance Mechanisms
- `npm run test:fixture` — Config: `SOURCE/vitest.fixture.config.ts` (runs without the exclude flag since task 23)
- `npm test`, `npx tsc --noEmit`, `npm run lint`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` keeps `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` inside `SOURCE/`.
- **Success criteria**: zero occurrences of the fixture's real name/avatar/score strings inside the anonymous row's rendered subtree on S-03 and S-05; the named row's subtree shows its own name/avatar/score; the `show_score=false` row has no score badge/value in its subtree.
- **Failure response**: if the anonymous subtree leaks any identity string, stop Phase 2 — fix the rendering component before any Phase 3 task.
- **Verification level**: L2 (fixture assertions added and passing)

## Proof Obligations
- **Claim** (skeleton Test 2, S-03/S-05 subset, verbatim): "S-03 solutions list: anonymous row shows no name/avatar; named row shows both... a `show_score=false` row: no score badge/value rendered anywhere in that row's subtree."
- **Primary failure mode** (skeleton): "a component renders row.author_display_name directly (bypassing the AuthorIdentity mapper/discriminated union), so an anonymous-fixture row's real name leaks into the DOM the moment a future edit reintroduces a raw field read."
- **Boundary to exercise**: rendered S-03 and S-05 route trees; DOM subtree text + `img[src]` queries per row.
- **State assertion**: N/A.
- **Mock boundary rationale**: `features/solutions/queries.ts` mocked with fixture rows; mapper and components real.
- **Residual** (plan note): "this test file is not 'complete' until P3-T7 adds the O-02 comment-sheet portion in the same file" — task 30.

## Completion Criteria
- [x] S-03 and S-05 portions pass; J1 still passes
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met; the named-row assertion proves the check is discriminating

## Notes
- Impact scope: task 30 adds O-02 to the same test; task 31 adds Test 3.
- Scope boundary: test + fixture files only.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
