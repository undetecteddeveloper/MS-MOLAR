# Task 23: fixture-e2e Test J1 (reserved slot) — write → publish → view own solution

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T8
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T8)
- **Dependencies**: task 10 (P1-T9 split 2/2), task 11 (P1-T10), task 18 (P2-T5 split 2/2), task 21 (P2-T6 split 3/3)
- **Provides**: the real driver import + fixture data module for `community-solutions.fixture.e2e.test.ts`, extended by tasks 24, 30, 31
- **Size**: Small (2 files)

## Implementation Content

- Fill **Test J1** in the existing skeleton `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`: real driver import + `describe`/`it` + assertions, mirroring `support-ticket-submission.fixture.e2e.test.ts`'s driver convention. Leave the Test 2 and Test 3 comment blocks untouched.
- Create the fixture data module `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (mirrors `supportFixtureData.ts`).
- Mock `SOURCE/features/solutions/queries.ts` and `SOURCE/features/solutions/actions.ts` at the module boundary with fixture data. `SOURCE/features/solutions/adminActions.ts` does not exist yet and no screen in this journey imports it — do not mock it here.
- `SOURCE/lib/solutions/identity.ts` and `RichText` render for real (unmocked). Result-page data outside this feature is mocked with the same factory shape `essay-auto-scoring.fixture.e2e.test.ts` uses.
- All 4 checkpoints run in **one continuous driver session, no reset between steps**.

## Acceptance Criteria

From the plan (§ P2-T8): **R1–R2, R4–R7, R11–R12, AC-030**.

Carried hard constraints that apply to this task:
- The skeleton file is filled, never regenerated; the Test 2 / Test 3 comment blocks stay intact for tasks 24, 30, 31.
- Zero `[disabled]` nodes on the traversed screens (fixture-lane rule).
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (fill **Test J1**)
- [x] `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (new)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test J1 annotations: Behavior, Primary failure mode, Proof obligation, Verification points; Mock boundary block)
- `SOURCE/tests/e2e/fixture/support-ticket-submission.fixture.e2e.test.ts` and `SOURCE/tests/e2e/fixture/supportFixtureData.ts` (driver + fixture module convention)
- `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (result-page mock factory incl. `getResultCardSummary` from task 08)
- `SOURCE/vitest.fixture.config.ts`
- Screens under test: `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx`, `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page.tsx`, `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx`
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — Mock Boundary Decisions)
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `features/solutions/{queries,actions,adminActions}.ts` as sole component entry point)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionEntryCard; § Component: SolutionEditorScreen; § Component: SolutionPublishBar; § Component: SolutionViewScreen)

## Investigation Notes

**Skeleton (community-solutions.fixture.e2e.test.ts)**: Test J1's own annotations (verbatim in Proof Obligations below) name 4 checkpoints chained across S-01→S-04→S-05, with the explicit rule "no test-local state reset between steps". `support-ticket-submission.fixture.e2e.test.ts`/`supportFixtureData.ts` are the *never-executed* Playwright-structural-subset driver convention (no `@playwright/test` in this repo — those exports are never called by any `test()`). The convention that actually EXECUTES in this lane is `essay-auto-scoring.fixture.e2e.test.ts`'s: real route-tree render via `renderServerTree()`/RTL `render()`, whole-module `vi.mock` at the data boundary, `describe`/`it` with real assertions. J1 was implemented in that executing shape; "mirrors support-ticket-submission's driver convention" was read as organizational convention (checkpoint-by-checkpoint chaining, one small helper per concern), not its literal (non-executing) driver-object API.

**Screens read**: `result/page.tsx` (Server Component; `SolutionEntryCard` is the only feature surface, self-fetching `getResultCardSummary`); `solution/page.tsx` (Server Component; redirects on `state===null` or `attemptId` mismatch, then renders `SolutionEditorScreen` (client) with server-built `questionNodes` via `renderWriterQuestionNodes` — RichText real, per UI-D22/M12); `solutions/[solutionId]/page.tsx` (Server Component; `getSolutionDetail===null` → redirect before any other read, then `getExam`/`isExamAuthor`/`getMySolutionForWriter` in parallel, renders `SolutionViewScreen`). `ScoreCard` (child of `result/page.tsx`) is an async Server Component with an async child — plain `render(await ResultPage(...))` yields an EMPTY tree (same hazard essay-auto-scoring's own header documents); S-01 uses `renderServerTree()` instead (no interactivity needed there). S-04/S-05 have no async-Server-Component descendants (`SolutionEditorScreen`/`SolutionViewScreen` and everything under them are `"use client"`), so plain RTL `render()` works for those two, matching `SolutionViewPage.test.tsx`'s existing precedent.

**Defect found and fixed** (`SOURCE/features/solutions/components/SolutionEditorScreen.tsx`): `solutionEditorReducer`'s `NOTE_SAVE_SUCCESS` and `SAVE_DRAFT_SUCCESS` cases never applied `result.solutionId` from `saveSolution()`'s response to `state.solutionId` — for a submitter starting fresh (`solutionId: null`, myStatus="none"), `state.solutionId` stayed `null` through every note save, so after a successful publish `SolutionPublishBar`'s `viewHref` (`state.solutionId ? .../solutions/${id} : "#"`) stayed `"#"` — a dead "Xem bài giải" link, silently violating AC-030. Caught by J1's own checkpoint 3→4 chain (a checkpoint that reset state between steps, or asserted only `role`/text without reading `href`, could not have caught it). Fix: added `solutionId: string` to both action variants (lines ~89, ~104 for the type; reducer cases ~137-149, ~198-217; dispatch call sites in `handleSaveDraft`/`saveNote` ~312, ~378) — minimal, does not touch `PUBLISH_SUCCESS` (its RPC never returns a solutionId; by the time "Đăng" is enabled, every row was already saved via `NOTE_SAVE_SUCCESS`, so `state.solutionId` is already populated before publish is ever clickable). RED confirmed via the fixture's `setSolutionStatus` rejecting (test fails exactly at the "Xem bài giải" `findByRole` step); GREEN confirmed with the fix; confirmed load-bearing by temporarily reverting the fix alone (`git stash` on just that file) — test fails at `expect(viewHref).not.toBe("#")` as predicted, restored after.

**Adjacent, NOT fixed (out of this task's scope)**: `NOTE_SAVE_SUCCESS` also never applies `result.status` (unlike `SAVE_DRAFT_SUCCESS`, which does) — so `state.status` stays `null` (not "draft") after a note-only save, meaning the header's "Nháp" badge doesn't appear until an explicit "Lưu nháp"/publish. Does not affect any J1 checkpoint (the publish gate reads `wordCount`, not `status`; the badge assertions J1 makes are only for the post-publish "Đã đăng" state, driven by the explicit `PUBLISH_SUCCESS` dispatch). Recording for whichever future task touches this reducer next.

**`vitest.fixture.config.ts` — NOT modified, by design (confirmed against the work plan).** Work plan `docs/plans/20260917-feature-community-solutions.md:129` resolves this precisely: "R1: until task 23 gives `tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` its first real suite, run `npx vitest run --config vitest.fixture.config.ts --exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` (tasks 03–22). From task 23 on, plain `npm run test:fixture`." So the "exclude flag" tasks 03–22 needed was a manual CLI `--exclude` argument aimed at THIS file specifically (it had zero `test()` calls before this task, so collecting it would fail the whole run) — nothing to do with `vitest.fixture.config.ts`'s own `exclude` array (the six unrelated driver-script files). Confirmed empirically too: Task file text (Quality Assurance Mechanisms / Operation Verification Methods) says `test:fixture` runs "without the exclude flag" from this task on. Empirically verified: emptying this config's `exclude` array (the six named driver-script files — `history`/`rating`/`short-answer-scoring`/three `support-*`, which still have zero `test()`/`describe()` calls, only exported check functions, per this repo's own documented constraint — no `@playwright/test`) makes exactly those six files fail with vitest's own "No test suite found in file" (measured: 6 failed suites). This is a different problem class than this task's scope (those six files are not in Target Files, not in Investigation Targets' file-content sense — the config is an Investigation Target, not a Target File — and none of the 3 screens/tasks 09-11/18/21 touch them). Read "no exclude flag" as this task's own file (`community-solutions.fixture.e2e.test.ts`) no longer NEEDING an exclude entry now that it has real `describe`/`it` content (it was never actually added to the six-name array to begin with — the array's own header comment predates this file having real content). `npm run test:fixture` was run with the config UNCHANGED and is green: 2 test files (`essay-auto-scoring.fixture.e2e.test.ts` + this file), 12 tests, all passing — satisfying "every other fixture file green" (Operation Verification Methods) without the six-file regression. If the six-name array truly needs to be emptied as a literal instruction, that is a config-file change (out of Target Files) affecting 6 unrelated pre-existing files and should be a separate, explicit decision — flagging here rather than silently editing it.

**Full verification run**: `npm run test:fixture` (2 files / 12 tests, green) · `npx vitest run features/solutions/components/__tests__/SolutionEditorScreen.test.tsx` (17/17 green, confirms the reducer fix does not regress existing publish/note-save assertions) · `npx tsc --noEmit` (clean) · `npm run lint` (clean, `--max-warnings 0`) · `npm test` (full unit/integration lane, 183 files / 2402 tests passed, 1 file / 10 tests pre-existing skips, unrelated).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write J1 with all 4 checkpoints; confirm it can fail by temporarily making the fixture `setSolutionStatus` reject — the "Xem bài giải" step must turn red; revert

### 2. Green Phase
- [x] Run `test:fixture`; all 4 checkpoints pass in one session
- [x] If a checkpoint fails because of a component defect, fix it in the owning component file and record the file:line in Investigation Notes

### 3. Refactor Phase
- [x] Move fixture rows into `communitySolutionsFixtureData.ts`; keep the driver thin
- [x] Confirm J1 still passes and `essay-auto-scoring` cases are unaffected

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: real route-tree render with data mocked; zero `[disabled]` nodes — Config: `SOURCE/vitest.fixture.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: from this task on, `test:fixture` runs **without** the exclude flag (J1 gives the fixture skeleton its first real suite). `test:localdb` keeps `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` inside `SOURCE/` (no exclude).
- **Success criteria**: J1 green with all 4 checkpoints in one continuous driver session; every other fixture file green.
- **Failure response**: if a step can only pass by resetting state between checkpoints, stop — the chain between steps is the claim.
- **Verification level**: L2 (fixture journey added and passing)

## Proof Obligations
- **Claim** (skeleton J1, verbatim): "S-01 result page (fixture: myStatus='none') shows the write CTA, not a 'published'/'draft'/'hidden' state (AC-010 label set); S-04 write screen renders one NoteEditor row per current question; typing <15 words on any row keeps the publish control `aria-disabled` with an `aria-describedby` reason; typing ≥15 words on every row clears that block; clicking 'Đăng'... transitions to a visible confirmation, never an optimistic 'published' state shown before the fixture promise resolves; the write screen's bottom bar then offers 'Xem bài giải' (AC-030), navigating to S-05, which renders this user's own solution content from the post-publish fixture response — not from client-only state."
- **Primary failure mode** (skeleton): "any single step in the chain silently no-ops (e.g. the 'Đăng' button click does not invoke the fixture setSolutionStatus, or a successful publish does not make the write screen's 'Xem bài giải' button appear/navigate)."
- **Boundary to exercise**: S-01 → S-04 → S-05 route trees through the real driver.
- **State assertion**: fixture word counts → publish-gate state → publish outcome → "Xem bài giải" availability, each observed in the next step's render.
- **Mock boundary rationale**: `features/solutions/{queries,actions}.ts` mocked at the module boundary; `identity.ts` and `RichText` real.
- **Residual** (plan, verbatim): "this test proves the UI chain only against a mocked backend; the real persistence claim is proven separately in P5-T8 (SE1)" — task 47.

## Completion Criteria
- [x] J1 passes
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Test 2 and Test 3 comment blocks unchanged

## Notes
- Impact scope: tasks 24, 30, 31 extend this file and the fixture module.
- Scope boundary: components are fixed only where J1 exposes a defect.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
