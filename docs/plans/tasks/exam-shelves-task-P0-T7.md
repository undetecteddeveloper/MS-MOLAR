# Task P0-T7 — Doc cleanup: stale theme-name comments

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 0, Task P0-T7** (independent — no dependency on P0-T1..T6)
Layer: frontend (comment-only change)

Metadata:
- Dependencies: none (independent of the rest of Phase 0)
- Blocks: none
- Size: Small (2 files, comment-only)
- Verification level: L3 (trivially green — comment-only change)

## Implementation Content
Fix the stale theme-name comments: `SOURCE/app/(exams)/layout.tsx:2` and `SOURCE/components/layout/AppShell.tsx:15` both still say `"Mực & Sơn mài"`. Correct to the shipped theme name `Đêm hội` (`globals.css` is the source of truth per frontend DD § External Resources Used note O-2).

## Target Files
- [x] `SOURCE/app/(exams)/layout.tsx`
- [x] `SOURCE/components/layout/AppShell.tsx`

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ External Resources Used — Open Item O-2, and the note that `globals.css` is the source of truth for the shipped theme name)
- `SOURCE/app/(exams)/layout.tsx` (`:2` the stale comment)
- `SOURCE/components/layout/AppShell.tsx` (`:15` the stale comment)
- `SOURCE/app/globals.css` (source of truth for the current theme name `Đêm hội`)

## Investigation Notes
- `docs/design/exam-shelves-frontend-design.md` § External Resources Used (Design Origin row) and § Open Items O-2 both confirm: `globals.css` is the source of truth for the shipped theme name, and the two stale comments say `"Mực & Sơn mài"` while the shipped theme is `"Đêm hội"`.
- `SOURCE/app/globals.css:83-88` — theme block header confirms the shipped theme is `THEME "ĐÊM HỘI"` (2026-09-14), replacing the earlier light theme "Sân trường"; `globals.css` line 527 also uses the display form `Đêm hội`. This is the source-of-truth value used for the edit.
- Red phase grep (before edit): both `SOURCE/app/(exams)/layout.tsx:2` and `SOURCE/components/layout/AppShell.tsx:15` contained `// Theme dùng thẳng root "Mực & Sơn mài" (globals.css, S#17) — không còn scope`.
- Scope note: the `S#17` slice-reference token in the same comment was left untouched (not found elsewhere in `globals.css`, but out of this task's scope per Notes § Scope boundary — only the theme-name string was corrected).
- Refactor phase grep (after edit): 0 remaining `"Mực & Sơn mài"` matches in either file; both now read `// Theme dùng thẳng root "Đêm hội" (globals.css, S#17) — không còn scope`.
- Gate run (P0-T4 already landed on this branch — ran gates 1-4 + `check:bundle`, from inside `SOURCE/`):
  - Gate 1 `npx tsc --noEmit` — PASS, no output.
  - Gate 2 `npx eslint --max-warnings 0` (scoped to the 2 changed files, then project-wide) — PASS, no output either way.
  - Gate 3 `npx vitest run` — 1 failed / 2050 passed / 10 skipped / 8 todo. The 1 failure is `lib/security/rateLimit.test.ts > guard > keeps ONE account's whole daily Gemini budget under the project quota` asserting `33 <= 20` — matches the plan's documented pre-existing baseline (§ The Six Verify Gates, "Known baseline") verbatim; count stayed at exactly 1, confirming no regression from this comment-only change.
  - Gate 4 `npm run build` — PASS, production build compiled and all 22 routes generated.
  - `npm run check:bundle` — PASS ("8 bí mật server-only không xuống client").
  - Gates 5/6 (`test:fixture`, `test:localdb`) not run — out of scope per this task's own Completion Criteria and the work plan's P0-T7 entry (`docs/plans/20260918-feature-exam-shelves.md:385`), which caps verification at gates 1-3/1-4 for this comment-only change; neither gate's covered files (`tests/e2e/fixture/exam-shelves.fixture.e2e.test.ts`, `tests/e2e/service/exam-hot-counts.service.e2e.test.ts`) touch the two edited files.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Grep both files for `"Mực & Sơn mài"` and confirm both currently contain it
### 2. Green Phase
- [x] Replace both comments with the shipped theme name `Đêm hội`
### 3. Refactor Phase
- [x] Grep both files again and confirm 0 remaining `"Mực & Sơn mài"` references

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide; trivially unaffected by a comment change)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: grep both files for the old and new theme-name strings.
- **Success criteria**: 0 occurrences of `"Mực & Sơn mài"` remain in either file; both now reference `Đêm hội`.
- **Failure response**: if a build or lint failure appears, it is unrelated to this comment-only change — investigate separately rather than assuming this task caused it.
- **Verification level**: L3 (gates 1-3 trivially green — no behavior change, per the plan's own note).

## Completion Criteria
- [x] Both comments corrected to `Đêm hội`
- [x] Grep confirms 0 remaining `"Mực & Sơn mài"` references in either file
- [x] Gates 1-4 green (gate 5/6 unaffected by a comment-only change; run per the plan's phase-position rule — see Notes)

## Notes
- Impact scope: 2 comment lines, 0 behavior change.
- Scope boundary: do not touch any other content in either file.
- **Gate position**: this task is independent of P0-T1..T6's sequential dependency chain and can be committed at any point in Phase 0. If committed before P0-T4 lands, run gates 1-5 only (per the plan's Phase 0 caveat); if committed after, run all 6.
