# Task 9 (Frontend): Final QA gate — frontend (axe a11y audit, AC review, coverage)

Metadata:
- Dependencies: `rating-system-frontend-task-5.md`, `rating-system-frontend-task-7.md`, `rating-system-frontend-task-8.md` (all frontend UI surfaces must be complete)
- Provides: the closing frontend a11y/functional regression evidence; this is the other half of the work plan's Task 9, split by layer per document-reviewer note I002 (the backend half is `rating-system-backend-task-9.md`)
- Size: Small (no new files expected unless the axe audit surfaces a defect requiring an in-place fix in an existing component)

## Implementation Content
Run the axe a11y audit on the rating form (modal + standalone), `RateButton` states, and the Level filter. Run full lint/typecheck/build/vitest (node+jsdom) and check coverage on `SOURCE/components/rating/**`. Verify every frontend-owned AC in `docs/design/rating-system-frontend-design.md`'s Acceptance Criteria section against the running implementation. Fix any defect found in place, in the owning component.

## Target Files
(Verification-focused; fix in place only if the audit surfaces a defect)
- [ ] `SOURCE/app/(layer2)/_components/rating/RatingForm.tsx` (+ `RatingModal.tsx`/`RatePageShell.tsx` shells) — audit subject
- [ ] `SOURCE/app/(layer2)/_components/rating/RateButton.tsx` — audit subject
- [ ] `SOURCE/app/(layer2)/_components/ExamFilters.tsx` (Level filter) — audit subject
- [ ] `SOURCE/components/rating/CircleScale.tsx`, `SOURCE/components/rating/DifficultyBadge.tsx` — audit subject

## Investigation Targets
- `docs/design/rating-system-frontend-design.md` (§ Quality Assurance Mechanisms — axe a11y audit row)
- `docs/design/rating-system-frontend-design.md` (§ Acceptance Criteria — the full frontend-owned AC list)
- `docs/design/rating-system-frontend-design.md` (§ Verification Strategy)
- `docs/prd/rating-system-prd.md` (UI Quality Metric 3 — WCAG 2.1 AA)
- `SOURCE/vitest.config.ts` (coverage invocation — no coverage threshold is configured in the file itself; run the project's coverage command and compare manually against the 70% target)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Review dependency deliverables: confirm Tasks 5, 7, and 8 are all complete before starting the audit
- [ ] Run the axe a11y audit against the dev server (`npm run dev`) on the rating form (modal + standalone), `RateButton` (all three states), and the Level filter; record every violation found — this IS the "Red" evidence for this task if any violation exists

### 2. Green Phase
- [ ] Fix each axe violation in its owning component (`RatingForm`/`RatingModal`/`RatePageShell`/`RateButton`/`ExamFilters`/`CircleScale`/`DifficultyBadge`)
- [ ] Re-run the audit and confirm zero unresolved violations

### 3. Refactor Phase
- [ ] Run project-wide lint/typecheck/build once (shared with `rating-system-backend-task-9.md`; do not duplicate if already run this session)
- [ ] Run vitest (node+jsdom) with coverage and confirm `SOURCE/lib/rating/**` and `SOURCE/components/rating/**` meet 70%+

## Quality Assurance Mechanisms
- axe a11y audit (manual, dev) — Enforces: WCAG 2.1 AA — Config: manual, dev environment — Covers: rating form (modal + standalone), `RateButton` states, Level filter
- Vitest (jsdom, `// @vitest-environment jsdom`) — Covers: `SOURCE/components/rating/**` — coverage check
- Vitest (node env) — Covers: `SOURCE/lib/rating/**` — coverage check (shared with backend task)
- Playwright MCP / manual pass (no CI) — cross-check against Tasks 5/7/8's own interaction passes
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: run the axe a11y audit (manual, dev server) against the rating form (modal + standalone), `RateButton` states (enabled/not-attempted/logged-out), and the Level filter; run `npm run test` (vitest node+jsdom) with coverage and confirm `SOURCE/lib/rating/**` and `SOURCE/components/rating/**` meet 70%+; walk every frontend-owned AC in `docs/design/rating-system-frontend-design.md` against the running app.
- **Success criteria**: zero axe violations (or each documented with a justified exception); coverage >=70% on both paths; every frontend AC confirmed satisfied with evidence.
- **Failure response**: an axe violation or unmet AC blocks sign-off — fix the specific component (`RatingForm`/`RateButton`/`ExamFilters`/`CircleScale`/`DifficultyBadge`) and re-run the audit before proceeding.
- **Verification level**: L1 (axe + manual pass is the final functional/a11y gate) combined with L2 (coverage/test greenness).

## Proof Obligations
(Source: frontend DD Verification Strategy correctness definition item 5 (WCAG bar) and a cross-cutting AC-review obligation — no skeleton test block covers a full-audit claim directly.)
- **Claim**: `CircleScale` + `RatingModal` (and the standalone `RatePageShell` form) meet the WCAG 2.1 AA keyboard/AT bar (frontend DD correctness definition item 5).
  - **Primary failure mode**: an axe-detectable violation (missing label, insufficient contrast, missing role, focus-order defect) exists in the shipped rating form/`RateButton`/Level filter that unit/jsdom tests did not catch, because those tests assert specific behaviors, not exhaustive WCAG coverage.
  - **Boundary to exercise**: manual + axe a11y audit against the real dev server — real browser DOM, no mocks.
  - **State assertion**: N/A (audit, not a state-changing claim).
  - **Mock boundary rationale**: none — real rendered DOM audited.
  - **Residual**: axe catches automatically-detectable violations only; the manual Playwright pass (already run in Tasks 5/7/8) covers keyboard-model/focus-trap behaviors axe cannot assert.
- **Claim**: every frontend-owned AC in `docs/design/rating-system-frontend-design.md`'s Acceptance Criteria section is satisfied by the shipped implementation.
  - **Primary failure mode**: an AC was implemented correctly in an earlier task but silently regressed by a later task's change (e.g., Task 8's `actions.ts` edit regressing Task 5's card navigation).
  - **Boundary to exercise**: manual cross-check — walk each AC against the running app and the relevant task's own recorded Proof Obligations/completion evidence.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: this is a documentation/traceability check, not a new automated test — it relies on the per-task proofs already recorded in Tasks 5, 7, and 8.

## Completion Criteria
- [ ] axe a11y audit — zero unresolved violations
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] All frontend tests green (vitest node+jsdom; fixture-e2e FE1 + FE2 manually confirmed per the no-CI workflow)
- [ ] Coverage 70%+ on `SOURCE/components/rating/**` (and confirm `SOURCE/lib/rating/**` remains 70%+, shared with the backend task)
- [ ] Every frontend-owned AC in `docs/design/rating-system-frontend-design.md` verified against the implementation, with evidence
- [ ] Document updates: none required beyond this plan (both Design Docs already reflect the shipped contracts)

## Notes
- Impact scope: no new files expected; in-place fixes only, scoped to the specific component an axe violation or AC gap points to.
- Scope boundary: the backend-owned RLS regression, SE2 authoring, and security review are `rating-system-backend-task-9.md`'s scope, not this task's.
