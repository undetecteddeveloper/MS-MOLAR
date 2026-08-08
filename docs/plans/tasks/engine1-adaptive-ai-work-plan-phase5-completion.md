# Phase 5 Completion: Real-Content End-to-End Verification & Tone Tuning

Covers Work Plan Phase 5 (Tasks 16-21). **No individual task files were generated for this phase** — see `_overview-engine1-adaptive-ai-work-plan.md`'s "Decomposition Scope Decision — Phase 5 and Final-Phase Tasks 23-27" for the full reasoning (manual Playwright/keyboard/axe passes and a human-judgment tone evaluation produce no `Target Files`/commit unit; this file carries forward each task's exact procedure and pass bar so nothing is lost in the fold).

This entire phase is manual/human-in-the-loop verification work executed by the engineer (with Playwright MCP as an agent-driven tool where applicable) against the real, deployed stack — not agent-completable code implementation.

## All-Item Completion Checklist (carried forward from the Work Plan, verbatim procedures)

- [ ] **Task 16 — Seed manual-pass test data**: (a) a real Math exam/question fixture answered incorrectly on two separate scored attempts by one test account (`hasBeenWrongTwice: true`); (b) a fresh/never-submitted test account (dashboard cold-start); (c) a test account with real submitted Math attempts spanning all 3 `reasonCode` outcomes (`prerequisite-gate`/`lowest-mastery`/`recently-wrong`).
- [ ] **Task 17 — Manual Playwright MCP pass: tutor round trip (Verification Strategy's Second Verification Target)**: on `/exams/[id]/attempt/[attemptId]/result/detail` with Task 16(a)'s fixture — click "Explain this step," observe busy spinner, then the hint panel (RichText-rendered Vietnamese) or, on a forced Gemini failure, the error paragraph + relabeled retry button. Confirm a second rapid click while busy does not fire a second `explainStep()` call (observable via dev server logs).
  - **Success criteria**: clicking the button shows the busy spinner; then either the hint panel replaces the button, or the error paragraph + retry button appears; a second rapid click while busy does not fire a second `explainStep()` call.
  - **Failure response**: if the real round trip's shape differs from the frontend DD's Data Contracts assumption (e.g. a field name or discriminant differs from `"hint" in result`), treat as a discrepancy against the backend Design Doc and escalate rather than silently adapting the frontend to a mismatched shape.
- [ ] **Task 18 — Manual Playwright MCP pass: dashboard**: `/me/dashboard` on Task 16(b)'s cold-start account (honest "not enough data yet" message, not a blank/broken card) and Task 16(c)'s populated account (all 3 `reasonCode` disclosure texts verified distinct and correct at least once). **If frontend-task-02's async-Server-Component test technique fell back to manual-only verification, `SkillRecommendationCard`'s 3 Proof Obligations (verbatim label, reasonCode mapping, cold-start honesty) are proven here instead.**
- [ ] **Task 19 — Keyboard-only pass**: Tab reaches the affordance button in every phase; Enter/Space activates it; focus never traps; `<summary>` toggles via Enter/Space; idle/busy/error/hint-shown are each distinguishable without color (AC-026).
- [ ] **Task 20 — Manual axe-equivalent pass**: ESLint's bundled `jsx-a11y` rules (already CI-enforced) + a manual ARIA-semantics/contrast walk of `ExplainStepAffordance`'s 4 states and `SkillRecommendationCard`'s 2 states against the actual `globals.css` tokens (rating-system Task 9's precedent method). Resolves UI Spec TBD-06.
- [ ] **Task 21 — PRD Success Criteria #9: 10-case Socratic-tone manual evaluation**: a fixed, recorded set of 10 real wrong-answer cases spanning `mcq`/`true_false`/`short_answer`, run against the real Gemini tutor. Record each case's verdict (Vietnamese: Y/N; Socratic form: Y/N; states the final answer: Y/N).
  - **Passing bar**: 10/10 Vietnamese, 10/10 Socratic form, 0/10 state the final answer.
  - **Failure response**: a failing case is a stop-and-tune signal — tune `buildTutorPrompt()`'s instruction text (backend-task-11) and re-run the full 10-case set, not just the failing case.
- [ ] **Quality check (staged)**: re-run `npx vitest run` (full suite), lint, typecheck.

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] Both DDs' Early Verification Points passed on the real, deployed stack
- [ ] PRD Success Criteria #9, #10, and UI Quality Metrics 1-2 satisfied with recorded evidence
- [ ] UI Spec TBD-06 resolved (downgraded to manual pass, recorded here)

## Verification Commands

```
npm run dev   # local session for all manual/Playwright passes
cd SOURCE && npx vitest run
cd SOURCE && npx eslint --max-warnings 0 .
cd SOURCE && npx tsc --noEmit
```

## Next Phase Gate

Final Phase (backend-task-14 / Task 22) depends on this phase's Task 21 (10-case tone eval) per the work plan's own Task Dependency Diagram (`T21 --> T22`), in addition to Phase 1's `test-rls.ts` (Task 2) and `tagQuestionSkills.ts` (Task 6).
