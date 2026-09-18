# Task FQA-T2 — All 6 verify gates, real exit codes + AC-045 (0 new dependencies)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T2**
Layer: cross-cutting (verification only — no feature source files changed)

Metadata:
- Dependencies: Phase 8 complete
- Blocks: FQA-T3 (regression check assumes gates already ran clean)
- Size: Small (0 files; 1 full gate run + 1 dependency diff)
- Verification level: L3 (real exit codes) + L2 (AC-045's dependency diff)

## Implementation Content
Run all 6 verify gates from `SOURCE/`, in order, real exit codes. Confirm the only red case (if any) is the pre-existing `lib/security/rateLimit.test.ts` baseline (`33 <= 20`) — confirm its failure count is unchanged from the Phase 0 baseline (still exactly 1, same assertion). Anything beyond that is a real regression and blocks sign-off. **AC-045**: run `git diff main -- SOURCE/package.json` (or the equivalent against the branch's base) and confirm 0 added dependencies (`dependencies` and `devDependencies` both byte-identical to before this feature); confirm the three new shelf icons (`Target`, `Flame`, `Compass`) are imported from `lucide-react` in `ExamShelf.tsx` and nowhere introduce a second icon package.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/plans/20260918-feature-exam-shelves.md` (§ The Six Verify Gates — verbatim command list and order)
- `docs/plans/20260918-feature-exam-shelves.md` (§ Known baseline — the `rateLimit.test.ts` case description)
- `SOURCE/package.json` (`dependencies`/`devDependencies` — diffed against the branch's base)
- `SOURCE/features/exams/components/ExamShelf.tsx` (P2-T3 — the icon imports to confirm)
- `docs/design/exam-shelves-backend-design.md` (Agreement Checklist — "0 new npm dependencies"); `docs/design/exam-shelves-frontend-design.md` (Agreement Checklist — "0 new dependencies (AC-045)")

## Investigation Notes
_(Record here: the 6 gates' real exit codes; the exact `vitest run` failure count and case name, confirmed to match the Phase 0 baseline; the `package.json` diff output, confirmed empty; the exact import line for `Target`/`Flame`/`Compass` in `ExamShelf.tsx`.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Re-confirm the Phase 0 baseline recorded for `rateLimit.test.ts` (1 failing case, `33 <= 20`)
### 2. Green Phase
- [ ] Run all 6 gates in order from `SOURCE/`, recording each real exit code
- [ ] Run `git diff main -- SOURCE/package.json` and confirm 0 added dependencies
- [ ] Grep `ExamShelf.tsx` for its icon imports and confirm all 3 come from `lucide-react`
### 3. Refactor Phase
- [ ] N/A — this task changes no source files

## Quality Assurance Mechanisms
- `npx tsc --noEmit`, `npx eslint --max-warnings 0`, `npx vitest run`, `npm run build`, `npm run test:fixture`, `npm run test:localdb` — the 6 gates themselves, run here for their final real-exit-code confirmation
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: run all 6 gates in the declared order; run the `package.json` diff; grep the icon imports.
- **Success criteria**: gates 1/2/4/5/6 exit 0; gate 3 (`vitest run`) has exactly 1 failing case, matching the Phase 0 baseline exactly (same file, same assertion); `package.json` diff is empty; all 3 icons import from `lucide-react`.
- **Failure response**: any gate exit code beyond the documented baseline blocks sign-off — do not proceed to FQA-T3 until resolved. A `vitest run` failure count above 1, or a different failing case, is a real regression, not baseline noise.
- **Verification level**: L3 for the gate exit codes; L2 for the AC-045 dependency/import confirmation.

## Proof Obligations
- **Claim** (AC-045): `package.json` declares 0 new dependencies; every shelf icon imports from `lucide-react`.
  - **Primary failure mode**: a new icon library was added as a dependency during implementation (e.g. to get a specific icon not in `lucide-react`), silently violating the plan's 0-new-dependency constraint.
  - **Boundary to exercise**: static diff (`git diff` on `package.json`) + grep (icon import statements).
  - **State assertion**: N/A (comparison of file state, not a runtime transition).
  - **Mock boundary rationale**: none.
  - **Residual**: none.

## Completion Criteria
- [ ] All 6 gates run with real exit codes recorded
- [ ] Gate 3's failure count confirmed exactly 1, matching the Phase 0 baseline case
- [ ] `package.json` diff confirmed empty (0 new dependencies)
- [ ] All 3 shelf icons confirmed imported from `lucide-react`
- [ ] Every Proof Obligation's claim confirmed

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
