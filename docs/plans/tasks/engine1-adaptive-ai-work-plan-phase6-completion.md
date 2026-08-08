# Final Phase Completion: Quality Assurance & Hardening

Covers Work Plan Final Phase (Tasks 22-27). Task 22 has its own file (`engine1-adaptive-ai-work-plan-backend-task-14.md`, ⚠ BLOCKING prod apply). **Tasks 23-27 have no individual task files** — see `_overview-engine1-adaptive-ai-work-plan.md`'s "Decomposition Scope Decision" for the full reasoning (these are cross-cutting review/coverage/documentation activities with no `Target Files`/commit unit of their own; this file carries forward each task's exact scope so nothing is lost in the fold).

## All-Item Completion Checklist (carried forward from the Work Plan, verbatim scope)

- [ ] **Task 22 — Full regression + prod schema apply**: see `engine1-adaptive-ai-work-plan-backend-task-14.md` (⚠ BLOCKING).
- [ ] **Task 23 — Security review**: walk ADR-0011's mechanism end to end (INVOKER, `service_role`-only, revoke-by-name on `record_skill_mastery()`); re-confirm D3/AC-018/019 answer-key containment across both the prompt (backend-task-11) and telemetry (backend-task-12) paths; confirm D4 (hint renders only via `RichText`, no competing path — frontend-task-01); confirm `explainStep()` (backend-task-13) has 0 unauthenticated code paths and every invocation passes through `guard()` (AC-022, PRD Success Criteria #11).
- [ ] **Task 24 — Coverage check**: 70%+ on `lib/adaptive/**` (backend-task-04/07), `lib/tutor/**` (backend-task-11/12), `lib/scoring/wrongTwice.ts` (backend-task-09), `components/tutor/**` (frontend-task-01), `app/(layer3)/_components/SkillRecommendationCard.tsx` (frontend-task-02).
- [ ] **Task 25 — Risk closure walk**: confirm each backend DD Risk (mastery-write forgery, answer-key-in-prompt, §10c parser trap, §17 fingerprint, mastery/score-divergence narrow window, Vercel deadline, threshold placeholders, dry-run/apply drift), each frontend DD Risk (argument-order swap, TBD-01 repeated-cost-on-reload, async-SC test technique, multi-instance id uniqueness, RichText malformed-input degrade), and each PRD Risk (R-a through R-h) has either a passing, evidenced mitigation or an explicitly accepted residual — none silently dropped between design and ship. (This plan's own per-task Proof Obligations and Change Category sweeps are the primary evidence trail for this walk — cross-reference each risk against the task file that names it.)
- [ ] **Task 26 — Design Doc / PRD acceptance criteria final walk**: verify every AC this feature owns (the backend-owned and frontend-owned subsets of AC-001 through AC-031) against the shipped implementation; record disposition per AC. (Cross-reference this plan's own Design-to-Plan Traceability table, reproduced per-task across `engine1-adaptive-ai-work-plan-backend-task-01.md` through `-frontend-task-02.md`'s Investigation Targets/Reference Contracts/Proof Obligations sections.)
- [ ] **Task 27 — Document updates**: update the Update History of both Design Docs, the ADR, and the UI Spec if any discrepancy was found during implementation. Record U3/U5's actual shipped values (0.75/0.7, or their retuned values if backend-task-04/Phase 5 evidence justified a change) and R9's accepted-gap disposition (tracked separately as TD-016, not a Sprint 1 blocker).

## Phase Completion Criteria (verbatim from Work Plan)

- [ ] Security review: complete (Task 23)
- [ ] Quality checks (types, lint, format): zero errors
- [ ] Execute all tests (unit, integration, service-integration-e2e): all green; manual/Playwright passes recorded (Phase 5)
- [ ] Coverage 70%+: confirmed (Task 24)
- [ ] Document updates: complete (Task 27)

## Overall Work Plan Completion Criteria (verbatim)

- [ ] All phases completed
- [ ] All integration/service-integration-e2e tests passing
- [ ] Both Design Docs' acceptance criteria satisfied
- [ ] Staged quality checks completed (zero errors)
- [ ] All tests pass
- [ ] Manual Playwright/keyboard/axe-equivalent/10-case tone-eval passes recorded (Phase 5)
- [ ] Both dev and prod schema applies verified via `verify:schema`, fingerprints matching git
- [ ] User review approval obtained

## Verification Commands

```
cd SOURCE && npx vitest run --coverage
cd SOURCE && npx eslint --max-warnings 0 .
cd SOURCE && npx tsc --noEmit
cd SOURCE && npm run build
```

## This Is the Final Gate

No further phase follows. Once this checklist and both `⚠` manual checkpoints (backend-task-01 dev apply, backend-task-14 prod apply) are confirmed, the work plan itself is complete pending user review approval.
