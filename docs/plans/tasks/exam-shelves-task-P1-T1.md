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
- [ ] `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` (new)
- [ ] `SOURCE/features/exams/components/__tests__/__snapshots__/ExamCard.snapshot.test.tsx.snap` (new, generated + committed)

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ ExamCard extension and the containment proof (AC-043) — the "Proof file" section)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Containment Rule (AC-043))
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamCard (shelf-aware props) — verify default flat/home state only at this point, since ribbon/from/className do not exist yet)
- `SOURCE/features/exams/components/ExamCard.tsx` (the current, pre-change implementation in full — this is what the snapshot freezes)
- `SOURCE/tests/helpers/renderServerTree` (the helper this test must import verbatim)
- an existing snapshot test elsewhere in the repo, if any, as a structural precedent (search `__snapshots__/` under `SOURCE/`)

## Investigation Notes
_(Record here: confirmation `ExamCard.tsx` currently has 0 of the 3 new props; the exact positive assertion used before the snapshot assertion; confirmation Prettier + prettier-plugin-tailwindcss ran before generating the snapshot.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write the test file with `// @vitest-environment jsdom` as line 1
- [ ] Import `renderServerTree` verbatim from `@/tests/helpers/renderServerTree`
- [ ] Write a positive assertion (`h3` title) that precedes the snapshot assertion, so an empty/broken tree fails the positive assertion first rather than silently passing an empty-tree snapshot
- [ ] Run the test **before** generating any snapshot and confirm it fails only because no snapshot exists yet (not because the positive assertion fails)
### 2. Green Phase
- [ ] Run Prettier + prettier-plugin-tailwindcss on `ExamCard.tsx` **before** generating the snapshot (class-string order must be final before the baseline is frozen)
- [ ] Generate and commit the `.snap` file
- [ ] Confirm the positive `h3` assertion passes: `container.querySelector("h3")?.textContent === exam.title`
### 3. Refactor Phase
- [ ] Re-run the test with no `-u` flag and confirm it stays green (proves the snapshot is stable, not accidentally regenerated on every run)

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
- [ ] `ExamCard.snapshot.test.tsx` created, importing `renderServerTree` verbatim
- [ ] Positive `h3` assertion precedes and passes before the snapshot assertion
- [ ] Prettier + prettier-plugin-tailwindcss run before the snapshot was generated
- [ ] `.snap` file committed
- [ ] `npx vitest run` green; gates 1-6 green (Phase 0 complete, so all 6 gates apply — gate 6 will just reflect existing baseline until Phase 8 adds new localdb cases)

## Notes
- Impact scope: 1 new test file + 1 committed snapshot. `ExamCard.tsx` itself is **not** touched by this task.
- Scope boundary — preserve unchanged: `ExamCard.tsx` must have 0 edits in this task; any prop addition happens only in P2-T2, against this committed baseline.
- **This task MUST be committed before P2-T2 begins.** If P2-T2 is started before this task's snapshot is committed, P2-T2 has no containment proof to extend against and must not proceed.
