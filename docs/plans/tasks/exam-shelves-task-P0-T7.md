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
- [ ] `SOURCE/app/(exams)/layout.tsx`
- [ ] `SOURCE/components/layout/AppShell.tsx`

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ External Resources Used — Open Item O-2, and the note that `globals.css` is the source of truth for the shipped theme name)
- `SOURCE/app/(exams)/layout.tsx` (`:2` the stale comment)
- `SOURCE/components/layout/AppShell.tsx` (`:15` the stale comment)
- `SOURCE/app/globals.css` (source of truth for the current theme name `Đêm hội`)

## Investigation Notes
_(Record here: grep confirmation of 0 remaining `"Mực & Sơn mài"` references in either file after the edit.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Grep both files for `"Mực & Sơn mài"` and confirm both currently contain it
### 2. Green Phase
- [ ] Replace both comments with the shipped theme name `Đêm hội`
### 3. Refactor Phase
- [ ] Grep both files again and confirm 0 remaining `"Mực & Sơn mài"` references

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
- [ ] Both comments corrected to `Đêm hội`
- [ ] Grep confirms 0 remaining `"Mực & Sơn mài"` references in either file
- [ ] Gates 1-4 green (gate 5/6 unaffected by a comment-only change; run per the plan's phase-position rule — see Notes)

## Notes
- Impact scope: 2 comment lines, 0 behavior change.
- Scope boundary: do not touch any other content in either file.
- **Gate position**: this task is independent of P0-T1..T6's sequential dependency chain and can be committed at any point in Phase 0. If committed before P0-T4 lands, run gates 1-5 only (per the plan's Phase 0 caveat); if committed after, run all 6.
