# Task 48: fixture-e2e full suite re-run + bundle budget + static-import check

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P5-T9
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T9)
- **Dependencies**: task 23 (P2-T8), task 30 (P3-T7), task 31 (P3-T8)
- **Provides**: the M12 bundle-budget proof on the real build artifact plus a permanent source-level guard
- **Size**: Small (1 new file; 2 fixture files run, not changed)

## Implementation Content

1. Add a grep-based unit test `SOURCE/features/solutions/components/__tests__/noStaticRichTextImport.test.ts` that scans every `"use client"` file under `SOURCE/features/solutions/` and fails if any contains a static import of `@/components/shared/RichText` (only `dynamic(() => import(...))` is allowed). Server Components (e.g. `SolutionNoteBlock`, `ProfileCommentsTab`) are exempt because they ship no client JS.
2. Run the full fixture lane: `community-solutions.fixture.e2e.test.ts` (J1, Test 2, Test 3 — no new tests; budget 3/3) and the regression file `essay-auto-scoring.fixture.e2e.test.ts` (extended mock factory from task 08).
3. Manual `next build` + manifest read (TD-021 precedent) for the three new routes: `/exams/[id]/attempt/[attemptId]/solution`, `/exams/[id]/solutions`, `/exams/[id]/solutions/[solutionId]` — plus `/profile` and the result route as regression. Record per-route first-load JS (gzip) and whether the markdown+KaTeX chunk is present.

## Acceptance Criteria

From the plan (§ P5-T9): **AC-103, M12**.

Carried hard constraints that apply to this task:
- **ADR-0002**: fixture Test 3 (XSS inert on note + comment) green in the same run.
- Per-route first-load JS ≤ ~170KB gzip; markdown/KaTeX chunk absent from the first bundle of all three new routes.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/__tests__/noStaticRichTextImport.test.ts` (new)
- [x] Run only (no change): `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts`, `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts`
- [x] Measurement record appended to this task file's Investigation Notes (route → gzip KB → KaTeX chunk present Y/N)

## Investigation Targets
- `SOURCE/features/solutions/components/` (all files; identify `"use client"` ones)
- `SOURCE/features/authoring/components/QuestionEditor.tsx` (lines ~71–90: allowed `dynamic` pattern)
- `TECH-DEBT.md` (§ TD-021 — manifest-read method and the 122.5 KB chunk it identified; read only — this file carries uncommitted engineer edits)
- `SOURCE/next.config.ts` (`.next-build` distDir for local production builds)
- `SOURCE/vitest.fixture.config.ts`
- `docs/design/community-solutions-frontend-design.md` (§ Verification Strategy)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — Integration Verification Points)
- `docs/design/community-solutions-frontend-design.md` (§ Risks and Mitigation — static `RichText` import row)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Cách đo row "Ngân sách bundle (AC-103, M12)")

## Investigation Notes

**Investigation Targets read (2026-09-27):**

- `SOURCE/features/solutions/components/` (30 files, `__tests__/` excluded): the actual `"use client"` directive is always literal `"use client";` on **line 1** — never preceded by comments in this codebase, so a whole-line regex match is reliable (see false-positive note below). Verified with `grep -nm1 '^"use client"'` on each `.tsx` file (line 1 only): client files (19) are `ProfileTabs.tsx`, `SolutionEditorScreen.tsx`, `CommentItem.tsx`, `SolutionMenu.tsx`, `ReportDialog.tsx`, `CommentSheet.tsx`, `SolutionViewScreen.tsx`, `CommentComposer.tsx`, `SolutionQuestionRow.tsx`, `QuestionAnswerSummary.tsx`, `HelpfulButton.tsx`, `SolutionAuthorCard.tsx`, `NoteSheet.tsx`, `FormulaPreview.tsx`, `NoteEditor.tsx`, `SolutionPublishBar.tsx`, `SolutionSettingsPanel.tsx`, `SolutionEditorHeader.tsx`, `NoteQuestionRow.tsx` (19). Server components (no line-1 directive, some merely *mention* "use client" in a comment, e.g. `CommentNotificationCard.tsx:4`, `ReputationBlock.tsx:3`, `SolutionNoteBlock.tsx:8`, `OwnSolutionBlock.tsx:6`, `writerQuestionNodes.tsx:4-5`): `AuthorIdentity.tsx`, `ModerationReasonBanner.tsx`, `CommentNotificationCard.tsx`, `OwnSolutionBlock.tsx`, `ProfileCommentsTab.tsx`, `SolutionCard.tsx`, `SolutionEntryCard.tsx`, `SolutionList.tsx`, `SolutionNoteBlock.tsx`, `writerQuestionNodes.tsx`.
- A plain text-grep for the string "use client" over-matches: `CommentNotificationCard.tsx`, `ReputationBlock.tsx`, `SolutionNoteBlock.tsx`, `OwnSolutionBlock.tsx`, `writerQuestionNodes.tsx` all *contain the words* "use client" in a warning comment while carrying **no** actual directive. The grep test below matches the directive as a whole line (`/^\s*["']use client["'];?\s*$/m`), not a substring search, to avoid these false positives — same technique already used by the pre-existing guard in `SolutionNoteBlock.test.tsx:48`.
- Static `import { RichText } from "@/components/shared/RichText"` exists in exactly 3 files today, and all 3 are Server Components (no directive): `SolutionNoteBlock.tsx:20`, `writerQuestionNodes.tsx:22`, `CommentNotificationCard.tsx:18`. All 3 carry a header comment invoking TD-021/ADR-0002 and explicitly forbidding import from a `"use client"` file. No client file imports RichText statically today — the tree is currently clean.
- Allowed `dynamic()` pattern precedent read at `SOURCE/features/authoring/components/QuestionEditor.tsx:78-85`: `const LazyRichText = dynamic(() => import("@/components/shared/RichText").then((m) => m.RichText), { ssr: false })` + a sibling `warmRichText()` using the *same* `import()` call so the bundler merges one chunk and the module promise is memoized. `features/solutions/components/FormulaPreview.tsx:28-34` and `CommentItem.tsx:53-60` follow the identical shape. `CommentSheet.tsx:108-109,126-127` calls `warmRichText()` + bare `import("@/components/shared/RichText")` (function-call form, not a static `import…from` statement) purely to drive a loading/error UI state — also allowed, since it is not a static import statement.
- `TECH-DEBT.md` § TD-021 (read-only): manifest-read method — "Next 16 + Turbopack no longer prints the Size/First Load JS table after build", so the measurement method is: `next build` (real build) then read `page_client-reference-manifest.js` per route and gzip the referenced chunks by hand; diff the chunk set between sibling routes to isolate the markdown+KaTeX chunk (122.5 KB gzip / 415.9 KB raw = `react-markdown + remark-gfm + remark-math + rehype-katex + rehype-sanitize + katex`). TD-023 measured the **same** chunk at 126.3 KB br on a different route/compression — br and gzip numbers differ; this task measures gzip per the UI Spec's "Cách đo" row and the ≤~170KB gzip budget.
- `SOURCE/next.config.ts:69-72`: `distDir` is `.next-build` for `next build` when `NODE_ENV=production && !VERCEL` (kept separate from the dev server's `.next` to avoid manifest corruption).
- `SOURCE/vitest.fixture.config.ts`: fixture lane runs under `test:fixture` with its own config (`environment: "node"`, `include: tests/e2e/fixture/**/*.test.{ts,tsx}`, excluding 6 non-`test()` driver scripts). `community-solutions.fixture.e2e.test.ts` and `essay-auto-scoring.fixture.e2e.test.ts` are both auto-collected by this glob; neither is edited by this task.
- Frontend DD § Test Boundaries "Integration Verification Points" already names this exact guard: "Grep-based static-import check ... a cheap, deterministic substitute for the missing automated bundle-size gate". § Risks and Mitigation pins the same claim this task's Proof Obligation quotes verbatim. § Verification Strategy confirms the manual `next build` + manifest read is the accepted (non-automatable) verification for M12.
- UI Spec § "Cách đo" row "Ngân sách bundle (`AC-103`, M12)": method = `npm run build` then read manifest like TD-021, for the three new routes; pass = each route ≤ ~170KB gzip first-load, chunk markdown+KaTeX absent from all three.
- **Pre-existing partial coverage found**: `SolutionNoteBlock.test.tsx:44-78` already contains a grep-based guard with the identical rule (walks `features/solutions`, flags any file combining the `"use client"` line with a static RichText import) — added in an earlier task as a companion to that file's render tests. This task's new dedicated file is mandated by name in the task's Target Files list (decision already made at task-decomposition time, not reopened here); it additionally proves TDD discrimination via **in-test fixture strings** (not real files) per the task's Red-phase instruction, and explicitly asserts the allowed `dynamic()` shape does NOT trip the guard — coverage the existing test does not exercise. Both guards now enforce the same invariant from two files; no conflict, no behavior change to `SolutionNoteBlock.test.tsx` (out of this task's Target Files, left untouched).

**Binding Decisions / Reference Contracts**: task file has neither a "Binding Decisions" nor a "Reference Contracts" section — skipped, not applicable.

**Measurement table** (Green phase, `next build` 2026-09-27; method: read each route's `page_client-reference-manifest.js` under `.next-build/server/app/...`, extract `entryJSFiles["[project]/app<pageKey>"]` — the exact chunk set Next.js itself used to sum into the pre-Turbopack "First Load JS" table per TD-021's own note that this table is gone in Next 16 + Turbopack — then `zlib.gzipSync(file, { level: 9 })` per chunk and sum. The markdown+KaTeX chunk was identified by content, not just size: of the two chunks near TD-021's cited 415.9 KB raw figure, `.next-build/static/chunks/2aolv82mcdndy.js` (426,870 B raw / 125,512 B gzip ≈ 122.6 KB gzip — matches TD-021's 122.5 KB gzip almost exactly) contains 16 occurrences of `katex`/`KaTeX`; the sibling `1-b2ubvwkmsdh.js` is the unrelated jsPDF chunk (87+ occurrences of `jsPDF`)):

| Route | First-load JS (gzip) | Markdown/KaTeX chunk (`2aolv82mcdndy.js`) present |
|---|---|---|
| `/exams/[id]/attempt/[attemptId]/solution` (new) | 70.6 KB | No |
| `/exams/[id]/solutions` (new) | 56.3 KB | No |
| `/exams/[id]/solutions/[solutionId]` (new) | 72.3 KB | No |
| `/profile` (regression) | 63.5 KB | No |
| `/exams/[id]/attempt/[attemptId]/result` (regression) | 89.0 KB | No |

All three new routes sit far under the ~170 KB gzip budget (largest is 72.3 KB, less than half the ceiling), and none reference the 122.6 KB markdown+KaTeX chunk in their first-load set — consistent with the grep guard's Green-phase result (0 offenders) and with `SolutionNoteBlock`/`writerQuestionNodes`/`CommentNotificationCard` being Server Components that render `RichText` with zero shipped client JS, while every actual client consumer (`FormulaPreview`, `CommentItem`, `CommentSheet`) reaches `RichText` only through `dynamic(() => import(...))` or a bare `import()` call, both excluded from Next's `entryJSFiles` by design (that is precisely why they are "first-load" safe). No budget violation found — Proof Obligation and AC-103/M12 are met on the real build artifact, not just the source-scan proxy.

**Binding Decision / Reference Contract deferred rows**: none (sections not present in this task file).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the grep test; prove it discriminates by pointing it at a temporary fixture string containing a static RichText import (in-test, not a real file) and confirming it fails

### 2. Green Phase
- [x] Run the grep test against the real tree — green
- [x] Run `npm run test:fixture` — J1, Test 2, Test 3, and `essay-auto-scoring` green in one run
- [x] Run `npm run build` from `SOURCE/`; read the manifest; record the table

### 3. Refactor Phase
- [x] Keep the grep test's allow-list explicit (server components by path)
- [x] Confirm the grep test still passes

## Quality Assurance Mechanisms
- `npm run test:fixture` — Config: `SOURCE/vitest.fixture.config.ts`
- `next build` (manual manifest read, TD-021 precedent) — per-route first-load JS ≤ ~170KB gzip; markdown/KaTeX chunk absent
- `npm test` (includes the new grep test), `npm run lint`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)

## Operation Verification Methods
- **Verification method**: the three steps above, from inside `SOURCE/`.
- **Success criteria**: grep test green; fixture suite green (J1, Test 2, Test 3, essay regression); each of the three new routes ≤ ~170KB gzip first-load JS with no markdown/KaTeX chunk.
- **Failure response**: if a route exceeds the budget or carries the chunk, locate the static import (the grep test should also be red — if it is not, widen its detection) and fix it in the owning component before closing the feature.
- **Verification level**: L3 (build artifact measured) + L2 (grep test added and passing)

## Proof Obligations
- **Claim** (Frontend DD Risks row, verbatim): "`RichText` gets statically imported from a `features/solutions` client file, silently re-adding ~122KB gzip with no automated gate to catch it" — mitigated by both checks in this task.
- **Primary failure mode**: a future client component imports `RichText` statically and the first bundle grows by ~122KB.
- **Boundary to exercise**: source tree scan (unit) + real `next build` output (artifact).
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: the manifest read is manual (no automated budget gate exists — accepted DD gap).

## Completion Criteria
- [ ] Grep test passes; fixture suite passes in one run
- [ ] Measurement table recorded in Investigation Notes with all three new routes within budget
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: verification only apart from the new test file.
- Scope boundary: `TECH-DEBT.md` read only.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
