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
- **Work plan § The Six Verify Gates** (line 60-67): order confirmed — 1 `npx tsc --noEmit`, 2 `npx eslint --max-warnings 0`, 3 `npx vitest run`, 4 `npm run build`, 5 `npm run test:fixture`, 6 `npm run test:localdb`, all run from inside `SOURCE/`. Line 69 caveat (gate 6 needs dev DB fingerprint) is moot here — Phase 0 completed long ago (commit history starts well before this task).
- **Work plan § Known baseline** (line 71): documented Phase 0 baseline for `SOURCE/lib/security/rateLimit.test.ts` — exactly 1 failing case, name `"keeps ONE account's whole daily Gemini budget under the project quota"`, assertion `33 <= 20` (`worstCasePerUser <= SUPPLIER_DAILY_QUOTA`). This is the authoritative baseline record (no separate P0 task file baseline snapshot exists beyond this line); confirmed unrelated to exam-shelves and untouched by any of the 31 phase tasks + FQA-T1.
- **Branch base check**: `git merge-base main HEAD` = `f65b252e87aed8edc2d166ea52536f8e05cefbb5`, identical to `git log main -1` HEAD — `main` is a direct ancestor of this branch, so `git diff main -- SOURCE/package.json` is the correct, complete diff (no equivalent-base substitution needed).

### 6 Verify Gates — real exit codes (run from `SOURCE/`, in order, 2026-09-19)
| Gate | Command | Exit code | Result detail |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | 0 | clean |
| 2 | `npx eslint --max-warnings 0` | 0 | clean |
| 3 | `npx vitest run` | 1 | `Test Files 1 failed \| 158 passed \| 1 skipped (160)`; `Tests 1 failed \| 2207 passed \| 10 skipped (2218)`. Sole failure: `lib/security/rateLimit.test.ts > guard > keeps ONE account's whole daily Gemini budget under the project quota` — `AssertionError: expected 33 to be less than or equal to 20` at `lib/security/rateLimit.test.ts:261:30`. Matches the documented Phase 0 baseline exactly (same file, same case name, same assertion values) — not a regression. |
| 4 | `npm run build` | 0 | `next build` — "Compiled successfully in 12.8s", TypeScript pass, production build succeeded |
| 5 | `npm run test:fixture` | 0 | `Test Files 2 passed (2)`, `Tests 10 passed (10)` |
| 6 | `npm run test:localdb` | 0 | `Test Files 4 passed (4)`, `Tests 25 passed (25)` |

Gates 1/2/4/5/6 exit 0. Gate 3 exits 1 for the pre-existing, documented baseline case only — failure count is exactly 1 (unchanged from Phase 0 baseline), same file, same assertion. No new regressions found across any of the 6 gates.

Additional QA mechanism (listed in this task's own Quality Assurance Mechanisms section, run for completeness): `npm run check:bundle` → exit 0 — "✅ Server-secret bundle check PASS — 8 bí mật server-only không xuống client."

### AC-045 — dependency diff + icon import check
- `git diff main -- SOURCE/package.json` → empty output, exit code 0. 0 added/removed/changed `dependencies` and `devDependencies` — byte-identical to the branch base.
- `git diff main --stat -- SOURCE/package-lock.json` → also empty (reinforces 0 new dependencies transitively).
- `SOURCE/features/exams/components/ExamShelf.tsx:2` — `import { Compass, Flame, Target, type LucideIcon } from "lucide-react";` — all 3 new shelf icons (`Target`, `Flame`, `Compass`) imported from `lucide-react` in a single import statement. Used at lines 48, 56, 64 (per-shelf `icon` config) and 192 (`<Compass>` element in an empty-state).
- Repo-wide grep for other icon package imports (`react-icons`, `@heroicons`, `@radix-ui/react-icons`, `@tabler/icons`, `phosphor-react`) inside `SOURCE/` → 0 matches. No second icon package introduced anywhere.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Re-confirm the Phase 0 baseline recorded for `rateLimit.test.ts` (1 failing case, `33 <= 20`)
### 2. Green Phase
- [x] Run all 6 gates in order from `SOURCE/`, recording each real exit code
- [x] Run `git diff main -- SOURCE/package.json` and confirm 0 added dependencies
- [x] Grep `ExamShelf.tsx` for its icon imports and confirm all 3 come from `lucide-react`
### 3. Refactor Phase
- [x] N/A — this task changes no source files

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
- [x] All 6 gates run with real exit codes recorded
- [x] Gate 3's failure count confirmed exactly 1, matching the Phase 0 baseline case
- [x] `package.json` diff confirmed empty (0 new dependencies)
- [x] All 3 shelf icons confirmed imported from `lucide-react`
- [x] Every Proof Obligation's claim confirmed

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
