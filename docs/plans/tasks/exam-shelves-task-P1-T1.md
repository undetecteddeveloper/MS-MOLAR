# Task P1-T1 — ExamCard containment proof: pre-change baseline snapshot (MUST BE FIRST)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1 (Pure-Logic Foundations & Containment Proof), Task P1-T1 — MUST BE FIRST, before any `ExamCard` edit**
Layer: frontend (`SOURCE/features/exams/components/`)

Metadata:
- Dependencies: Phase 0 complete (P0-T6 Early Verification Point passed) — Phase 1 tasks are otherwise independent of each other, but this specific task must land **before P2-T2** and before any other edit to `ExamCard.tsx`
- Blocks: P2-T2 (extends this snapshot; must not exist without this baseline)
- Size: Small (1 new test file + 1 committed snapshot)
- Verification level: L2

## Implementation Content
Create `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` against the **pre-change** `ExamCard` (the component has 0 of the 3 new props at this point); commit the generated `.snap` file. This is the plan's containment proof for AC-043 — the byte-identical guarantee that `ExamCard` rendered with none of the 3 new props never changes.

## Target Files
- [x] `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` (new)
- [x] `SOURCE/features/exams/components/__tests__/__snapshots__/ExamCard.snapshot.test.tsx.snap` (new, generated + committed)

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ ExamCard extension and the containment proof (AC-043) — the "Proof file" section)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Containment Rule (AC-043))
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamCard (shelf-aware props) — verify default flat/home state only at this point, since ribbon/from/className do not exist yet)
- `SOURCE/features/exams/components/ExamCard.tsx` (the current, pre-change implementation in full — this is what the snapshot freezes)
- `SOURCE/tests/helpers/renderServerTree` (the helper this test must import verbatim)
- an existing snapshot test elsewhere in the repo, if any, as a structural precedent (search `__snapshots__/` under `SOURCE/`)

## Investigation Notes
- **0-new-props confirmation**: read `SOURCE/features/exams/components/ExamCard.tsx` in full. `ExamCardProps` today is exactly `{ exam: Exam; eligibility: RateEligibility }` — no `ribbon`/`from`/`className`. `export async function ExamCard({ exam, eligibility }: ExamCardProps)`; import graph is `next/link`, `@/lib/copy`, `@/types/exam`, `@/components/ui/{badge,card}`, `@/components/shared/AuthorByline` (async), `@/components/rating/DifficultyBadge` (`"use client"`), `@/features/exams/components/rating/RateButton` (`"use client"`, exports `RateEligibility = "eligible" | "not-attempted" | "logged-out"`), `@/lib/ugc/subjects`. Nothing pulls in `server-only` or `next/navigation`, matching Design Doc's "no `vi.mock`" claim.
- **Positive assertion used**: `expect(container.querySelector("h3")?.textContent).toBe(EXAM.title)`, placed immediately before `expect(container.innerHTML).toMatchSnapshot()` — matches UI Spec's "bare card" case row (§ ExamCard extension, Proof file table) and the task's own Red-phase instruction.
- **Scope for this task's case set**: Design Doc's proof-file table lists 3 cases (bare card / `from="hot"` / `ribbon="Hot nhất"`), but `from` and `ribbon` don't exist on the pre-change component — task's own Investigation Targets line says "verify default flat/home state only at this point". This task's test therefore covers **only the bare-card case**; the other two rows are P2-T2's proof obligation once it adds the props (task's own "Residual" note confirms this split).
- **Structural precedent**: searched `__snapshots__/` under `SOURCE/` → one precedent, `SOURCE/components/shared/__tests__/RichText.regression.test.tsx` (+ its committed `.snap`). Confirms the repo's only snapshot idiom is `expect(container.innerHTML).toMatchSnapshot()` on a detached container — no serializer config, no `toMatchInlineSnapshot`. Also read `SOURCE/features/exams/components/__tests__/EssayReviewBlock.test.tsx` (same `renderServerTree` helper, same feature directory) for the async-server-component test shape (helper `render()` wrapper, positive assertions on `container.textContent` before anything else).
- **`renderServerTree` signature**: `async function renderServerTree(node: ReactNode): Promise<{ container: HTMLElement }>` (`SOURCE/tests/helpers/renderServerTree.tsx`) — streams via `renderToReadableStream`, parses HTML into a detached `<div>`; documented reason for existing over `render(await Component(props))`: an async child (here `AuthorByline`) yields an empty tree with the direct-await form. Imported verbatim: `import { renderServerTree } from "@/tests/helpers/renderServerTree";`.
- **Fixture choice**: `eligibility: "eligible"` was chosen for the bare-card baseline — `RateButton`'s `"eligible"` branch renders a plain `<Link>`; the other two states render a `base-ui` `Tooltip`/`Portal`, which is an unnecessary SSR-portal variable for a baseline that only needs to prove "0 new props ⇒ today's markup". `Exam` fixture omits `authorDisplayName` (seed-exam shape, `AuthorByline` returns `null`, matches the ExamCard.tsx comment "đề seed bỏ qua") and sets `school` so the optional school `<span>` is exercised in the baseline.
- **Prettier + prettier-plugin-tailwindcss check**: ran `npx prettier --check features/exams/components/ExamCard.tsx` (Green phase, before generating the snapshot) — it reported the file as not fully formatted. Diffed current vs `npx prettier` output: the **only** difference is the `<h3>` element's JSX collapsing from 3 lines to 1 line (pure whitespace/line-wrap); every `className` string is byte-identical between the two versions, i.e. Tailwind class order is already final — the one thing this gate exists to guarantee. Since the JSX diff is a whitespace-only line inside a single-expression-child element (`{exam.title}` is the only child either way), it compiles to identical children and cannot change `container.innerHTML`. Per the task's own Scope boundary ("`ExamCard.tsx` must have 0 edits in this task"), `ExamCard.tsx` was **not** written to — the check's real target (class-string order) is confirmed final, and the residual whitespace-only diff carries no snapshot risk. Verified empirically: RED run before any snapshot existed (`CI=true npx vitest run`) failed **only** at the snapshot assertion line (positive `h3` assertion passed first), then the snapshot was generated, then two more runs (plain and `CI=true`) both stayed green with 0 regeneration — proving the frozen baseline is stable regardless of this cosmetic formatting gap.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the test file with `// @vitest-environment jsdom` as line 1
- [x] Import `renderServerTree` verbatim from `@/tests/helpers/renderServerTree`
- [x] Write a positive assertion (`h3` title) that precedes the snapshot assertion, so an empty/broken tree fails the positive assertion first rather than silently passing an empty-tree snapshot
- [x] Run the test **before** generating any snapshot and confirm it fails only because no snapshot exists yet (not because the positive assertion fails) — `CI=true npx vitest run …ExamCard.snapshot.test.tsx` failed exactly at the `toMatchSnapshot()` line, `h3` assertion had already passed
### 2. Green Phase
- [x] Run Prettier + prettier-plugin-tailwindcss on `ExamCard.tsx` **before** generating the snapshot (class-string order must be final before the baseline is frozen) — ran `prettier --check` + diffed against `prettier`'s output; 0 class-string differences (see Investigation Notes); `ExamCard.tsx` left unedited per this task's own scope boundary
- [x] Generate and commit the `.snap` file
- [x] Confirm the positive `h3` assertion passes: `container.querySelector("h3")?.textContent === exam.title`
### 3. Refactor Phase
- [x] Re-run the test with no `-u` flag and confirm it stays green (proves the snapshot is stable, not accidentally regenerated on every run) — reran twice (plain and `CI=true`), both green, 0 regeneration

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- Prettier + prettier-plugin-tailwindcss — Enforces: class-string order (must run before generating the AC-043 snapshot) — Config: `SOURCE/package.json` devDependencies; Covered: `SOURCE/features/exams/components/**`

## Operation Verification Methods
- **Verification method**: run `npx vitest run` and inspect that the positive `h3` assertion and the snapshot assertion both pass; confirm the snapshot file is committed.
- **Success criteria**: test green; snapshot file present in `__snapshots__/`; re-running without `-u` stays green.
- **Failure response**: if the positive assertion fails, the render tree itself is broken — fix that before ever looking at the snapshot. Do not generate a snapshot of a broken/empty tree.
- **Verification level**: L2 (new test added and passing).

## Proof Obligations
- **Claim** (AC-043): `ExamCard` rendered with none of its (future) 3 new props produces a specific, frozen, byte-identical markup baseline that any later change must be proven not to have altered.
  - **Primary failure mode**: an empty or broken render tree gets snapshotted as "correct" because no positive assertion caught the failure first (the classic snapshot-test trap — a `renderServerTree` hazard the plan calls out explicitly for both `ExamCard` and `ExamShelf`).
  - **Boundary to exercise**: component render boundary via `renderServerTree` (server-component render, not a live DOM/browser).
  - **State assertion**: N/A (rendering is not a state transition; this is a structural/markup proof).
  - **Mock boundary rationale**: none required — `ExamCard` at this point has no external data dependency beyond its `exam` prop, which is supplied directly by the test.
  - **Residual**: this task proves the pre-change baseline is captured correctly. That the baseline survives P2-T2's prop additions with 0 diff on the bare-card case is P2-T2's own proof obligation, not this task's.

## Completion Criteria
- [x] `ExamCard.snapshot.test.tsx` created, importing `renderServerTree` verbatim
- [x] Positive `h3` assertion precedes and passes before the snapshot assertion
- [x] Prettier + prettier-plugin-tailwindcss run before the snapshot was generated
- [x] `.snap` file committed
- [x] `npx vitest run` green; gates 1-6 green (Phase 0 complete, so all 6 gates apply — gate 6 will just reflect existing baseline until Phase 8 adds new localdb cases)

## Notes
- Impact scope: 1 new test file + 1 committed snapshot. `ExamCard.tsx` itself is **not** touched by this task.
- Scope boundary — preserve unchanged: `ExamCard.tsx` must have 0 edits in this task; any prop addition happens only in P2-T2, against this committed baseline.
- **This task MUST be committed before P2-T2 begins.** If P2-T2 is started before this task's snapshot is committed, P2-T2 has no containment proof to extend against and must not proceed.
