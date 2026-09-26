# Task 31: fixture-e2e Test 3 — malicious markdown renders inert (note + comment)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P3-T8
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T8)
- **Dependencies**: task 20 (P2-T6 split 2/3 — note render path), task 28 (P3-T5 — comment render path)
- **Provides**: browser-level XSS proof on both surfaces; completes all three fixture skeleton tests
- **Size**: Small (2 files)

## Implementation Content

- Fill **Test 3** in `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`.
- Add one shared XSS payload fixture to `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (script tag and `onerror=` markdown-HTML injection attempt) applied to both a solution-note fixture (S-05) and a comment fixture (O-02).
- The driver renders both through the real, unmocked `RichText` (server-direct for the note block, dynamic import for the comment body — await the dynamic chunk before asserting).

## Acceptance Criteria

From the plan (§ P3-T8): **AC-025, AC-102, ADR-0002**.

Carried hard constraints that apply to this task:
- **ADR-0002**: both surfaces render through `SOURCE/components/shared/RichText.tsx` only; this test asserts on the rendered DOM, not on the raw fixture string.
- Complements (does not duplicate) the unit-lane `RichText.xss.test.tsx` groups from tasks 11 and 28.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (fill **Test 3**)
- [x] `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (shared XSS payload fixture)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (Test 3 annotations; J1/Test 2 driver)
- `SOURCE/components/shared/__tests__/RichText.xss.test.tsx` (note + comment groups — payload shapes to mirror, not copy verbatim)
- `SOURCE/features/solutions/components/SolutionNoteBlock.tsx` (task 20), `SOURCE/features/solutions/components/CommentItem.tsx` (task 28)
- `SOURCE/components/shared/RichText.tsx`
- `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md`
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Cách đo row XSS (M8))
- `docs/prd/community-solutions-prd.md` (AC-025, AC-102, M8)

## Investigation Notes

- `community-solutions.fixture.e2e.test.ts` (J1/Test 2 driver, task 23/24/30): mock boundary mocks `features/solutions/{queries,actions}` + a few result-page/exam-layer modules; `lib/solutions/identity.ts` and `RichText` are NEVER mocked. `authorCardSection()` helper assumes "the ONLY `<section>` on this route" — true only when no `?q=` deep link opens a note row; Test 3 opens `?q=1`, so `SolutionNoteBlock` (task 20) ALSO renders a `<section>` — Test 3 cannot reuse `authorCardSection()` verbatim and instead scopes via the note block's own unique eyebrow label (`t("solutions.view.solutionLabel")`).`closest("section")`.
- `RichText.xss.test.tsx` (task 11/28 groups): payload shapes are `<script>alert("xss")</script>` and `<img src="x" onerror="alert(1)">`, asserted via `assertSafe()` (no `<script>`/`<iframe>`/`<style>`, no `on*` attribute, no `javascript:`/non-image `data:` URL). Test 3 mirrors (not copies) this by combining ONE `<img onerror>` vector + ONE `<script>` vector into a single shared string (`XSS_SHARED_PAYLOAD`), and scopes the check (`assertPayloadInert`) to `<script>` + `on*` attributes only, per this task's own narrower Success Criteria.
- `SolutionNoteBlock.tsx` (task 20): Server Component, imports `RichText` **statically** (never `"use client"` — TD-021/TD-023). Props: `{text, titleId}`; renders `<Card as="section" ... aria-labelledby={titleId}><span id={titleId} className="eyebrow">{t("solutions.view.solutionLabel")}</span><RichText text={text} .../></Card>`.
- `CommentItem.tsx` (task 28): `"use client"`; renders comment body via `LazyRichText = dynamic(() => import("@/components/shared/RichText").then(m => m.RichText), {ssr:false})` — resolves asynchronously (must `await`/`findBy*` before querying). `CommentItem` also imports the REAL `deleteComment` from `@/features/solutions/actions`, whose module chain transitively pulls in `server-only` — irrelevant to the RichText proof, must be mocked away in any standalone render of `CommentItem` (discovered during the RED-phase proof below; the main fixture file already mocks `@/features/solutions/actions` at its top-level `vi.mock`, so this only mattered for the throwaway proof file).
- `RichText.tsx`: pipeline is `remark-gfm+remark-math -> rehype-katex(trust:false) -> rehype-sanitize(SANITIZE_SCHEMA)`; never `rehype-raw`, never overridden `urlTransform`, never `trust:true` (ADR-0002 invariants). Public props (`text`, `className`, `inline`) unchanged by any of this.
- `page.tsx` (`SolutionViewPage`, S-05 route): `buildQuestionNode()` wires `question.note.body` through `<SolutionNoteBlock text={question.note.body} .../>` into `note.bodyNode`; `question.comments` passed through UNCHANGED (no server-side ReactNode building) to `SolutionViewScreen` -> `CommentSheet` -> `CommentItem`. `parseSolutionDeepLink` whitelists `?comments=1` exactly and clamps `?q` into `[1, questionCount]`.
- `SolutionQuestionRow.tsx`: `defaultOpen` (set when `?q=k` targets that row) is read ONLY at `useState` init — the note block (`note.bodyNode`) mounts immediately on first render with no click needed when `defaultOpen` is true. Confirmed this means `?q=1&comments=1` opens BOTH the note body and the `CommentSheet` in ONE render, exactly the "full route-tree render of S-05 with O-02 opened" boundary this task's Proof Obligation requires.
- ADR-0002 / UI Spec M8 / PRD AC-025, AC-102: single hardened `RichText` path for all UGC (notes + comments), sanitized at render time; AC-025 forbids raw HTML/markdown-image rendering in notes; AC-102 is the formula-preview instance of the same sanitized `RichText` path (general RichText-sanitize AC, cited as a carried hard constraint, not specific to O-02/S-05).

**RED-phase discrimination proof (performed, then reverted)**: created a throwaway file `SOURCE/tests/e2e/fixture/_tmp-t31-red-proof.fixture.e2e.test.tsx` that `vi.mock`ed `@/components/shared/RichText` to a raw `dangerouslySetInnerHTML` double (plus mocked `@/features/solutions/actions` to avoid the unrelated `server-only` import chain for `CommentItem`), rendered `SolutionNoteBlock` and `CommentItem` directly with `XSS_SHARED_PAYLOAD`, and ran `assertPayloadInert` against each — both threw (`expect(() => assertPayloadInert(container)).toThrow()` passed, i.e. the assertion turned RED), confirming the check is not vacuous on either surface. Ran via `npx vitest run --config vitest.fixture.config.ts _tmp-t31-red-proof` — 2/2 passed (the wrapping `.toThrow()` expectations). Deleted the file immediately after; the real Test 3 (below) uses the real, unmocked `RichText` throughout and is green.

**Verification run**: `npm run test:fixture` → 16/16 passed across the two fixture-e2e files (this file's 5: J1 + Test 2 ×3 + Test 3, all in the SAME run). `npx tsc --noEmit` clean. `eslint --max-warnings 0` on both changed files clean. `RichText.xss.test.tsx` unit-lane companion re-run standalone: 26/26 passed, unaffected.

**`npm test` note**: observed 0–5 failing test files across repeated full-suite runs, always in `CommentItem.test.tsx`/`SolutionViewScreen.test.tsx` (a `findByText` racing dynamic-import chunk resolution under parallel test-worker CPU load) — reproduced identically with this task's two files stashed out (baseline), confirming it is a pre-existing, load-dependent flake unrelated to this task. `vitest.config.ts`'s default include glob (`lib/**`, `components/**`, `app/**`, `features/**`, all `*.test.{ts,tsx}`) does not cover `tests/e2e/fixture/**` at all, so these two changed files structurally cannot be the cause. Flagged for the engineer/quality-fixer, not fixed (out of this task's file scope).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write Test 3; prove each surface's assertion discriminates by temporarily rendering that surface's fixture through a raw `dangerouslySetInnerHTML` test double and confirming red; revert

### 2. Green Phase
- [x] Run `test:fixture`; Test 3 green on both surfaces

### 3. Refactor Phase
- [x] Keep one payload constant used by both surfaces
- [x] Confirm J1, Test 2, and Test 3 pass in the same run

## Quality Assurance Mechanisms
- `npm run test:fixture` — Config: `SOURCE/vitest.fixture.config.ts`
- `components/shared/__tests__/RichText.xss.test.tsx` — unit-lane companion (must stay green)
- `npm test`, `npx tsc --noEmit`, `npm run lint`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: `npm run test:fixture` inside `SOURCE/`.
- **Success criteria**: on S-05 note body and O-02 comment body independently — zero `<script>` elements and zero `on*` attributes originating from the payload in the rendered DOM.
- **Failure response**: if either surface renders executable markup, stop the feature — this is an ADR-0002 violation; fix the render path before any Phase 4 task.
- **Verification level**: L2 (fixture assertions added and passing)

## Proof Obligations
- **Claim** (skeleton Test 3, verbatim): "S-05 solution view screen note body: payload renders as inert text/safe markup; zero `<script>` elements; zero `on*`-attributes from the payload. O-02 comment sheet comment body: same, independently checked."
- **Primary failure mode** (skeleton): "a future change to the note/comment render path bypasses RichText (e.g. a raw dangerouslySetInnerHTML shortcut), or RichText's sanitizer regresses, letting the payload's script execute or persist as live markup in the DOM."
- **Boundary to exercise**: full route-tree render of S-05 with O-02 opened, real `RichText` on both paths.
- **State assertion**: N/A.
- **Mock boundary rationale**: only `features/solutions/{queries,actions}.ts` mocked; render path fully real.
- **Residual**: none for these two surfaces; report-reason rendering (admin) is covered by task 38's component tests.

## Completion Criteria
- [x] Test 3 passes on both surfaces; J1 and Test 2 pass in the same run
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: all three fixture skeleton tests are now implemented; task 48 re-runs the full suite.
- Scope boundary: test + fixture files only.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
