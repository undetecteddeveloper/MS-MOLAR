# Overall Design Document: Engine 1 — Adaptive AI & Feedback (Sprint 1)

Generation Date: 2026-08-08
Target Plan Document: `docs/plans/engine1-adaptive-ai-work-plan.md`

> **⚠ Per-task files removed 2026-08-18, after the feature closed.** The 16 executor-instruction files (`…-backend-task-01…14.md`, `…-frontend-task-01…02.md`) were deleted to keep the workspace navigable; references to them in this file and in the `*-phaseN-completion.md` files are therefore **dangling by intent, not by accident**.
>
> They are fully recoverable from git — the last commit containing them is **`aabc3de`**:
> ```
> git show aabc3de:docs/plans/tasks/engine1-adaptive-ai-work-plan-backend-task-14.md
> ```
> Kept instead: every `*-phaseN-completion.md` (outcomes, measurements, findings P-1/Q-1/Q-2) and this overview. That split is deliberate — the task files were scaffolding for doing the work; the completion files are the record of what the work found, and other documents cite them.

## Project Overview

### Purpose and Goals

Ship a Math-only skill taxonomy, per-user mastery written from real `submitExam()` submissions behind ADR-0011's trust boundary, a heuristic "what to practise next" recommendation (`SkillRecommendationCard` on the dashboard), and a Socratic "Explain this step" tutor affordance (`ExplainStepAffordance` on the result-detail page) that appears after a student gets the same question wrong twice. Success is defined by the PRD's Success Criteria and both Design Docs' Acceptance Criteria (AC-001 through AC-031).

### Background and Context

This is a Next.js + Supabase project with **no migration tool** (TD-005) — `schema.sql` DDL is applied by hand into the Supabase SQL Editor, on two databases (dev during the sprint, prod at ship time, per A3). A three-day dev/prod divergence already happened once (2026-08-07) from a missed manual-apply step. This decomposition treats both manual DDL-apply points (Phase 1 Task 1 dev apply, Final Phase Task 22 prod apply) as explicit, blocking, non-agent-completable checkpoints — carried into their own task files with a `⚠ MANUAL CHECKPOINT` marker an executor agent must stop at, not work around.

## Task Division Design

### Division Policy

The work plan itself is already Hybrid: Phase 1 is foundation-first (schema + taxonomy + tagging, horizontal), Phases 2-3 build backend verticals in dependency order (routing, then mastery-write + tutor), Phase 4 is two independent frontend vertical slices, Phase 5 is real-content manual verification, and the Final Phase is cross-cutting hardening. This decomposition preserves that shape exactly — one task file per work-plan implementation task that produces a code/content artifact (1 task = 1 commit = 1 logical change), in the work plan's own dependency order (per its Task Dependency Diagram, treated as authoritative and not re-derived).

Verifiability priority (per implementation-approach skill): L1 is used wherever the work plan already names an L1 checkpoint (the two Early Verification Points: `verify:schema` after dev apply, and the real `explainStep()` round trip); L2 (tests passing) is the default for every implementation task — all 13 backend/frontend code tasks below convert an already-generated skeleton test file (or, for `skillTaxonomy.test.ts`, an AC-authored one) into real, passing tests in the same commit as the implementation (Red→Green-same-commit, this repo's convention); L3 (build/`tsc` clean) is the floor for every task via the project-wide Quality Assurance Mechanisms (ESLint, `tsc --noEmit`, `next build`).

### Decomposition Scope Decision — Phase 5 and Final-Phase Tasks 23-27

Phase 5 (work-plan Tasks 16-21) and Final-Phase Tasks 23-27 are **not** given individual task files. Reasoning:

- None of these tasks produce a new or modified source file with a `Target Files` list — they are manual Playwright/keyboard/axe-equivalent passes, a human-judgment 10-case tone evaluation, a security walk, a coverage-threshold check, a risk-closure walk, an AC-disposition walk, and a documentation-history update. There is no "1 commit = 1 logical code change" unit to decompose them into; splitting one continuous manual QA session (Tasks 16→21) into 6 near-empty files would manufacture artificial boundaries the work plan itself does not impose (Task 19/20/21 all read directly off Task 16-18's same seeded session).
- Every one of these tasks already carries, inline in the work plan, its own complete executable procedure, pass/fail bar, and (for Task 21) a recorded-verdict format — the task-file template's added structure (Target Files, TDD Red/Green/Refactor, Investigation Targets pointing at code) would either sit empty or duplicate the plan's own text verbatim without adding anything executable.
- Per this decomposer's own documented option ("some decomposers skip non-code verification steps as task files and leave them as work-plan-level checklist items instead"), these items are left as work-plan-level checklist items, and are instead **aggregated into the Phase 5 and Phase 6 (Final Phase) completion files** below, each carrying forward the originating task's exact procedure/pass-bar/verdict-format so nothing is lost in the fold — only the "separate single-commit file" packaging is skipped.
- Final-Phase Task 22 is the one exception in the Final Phase: it does have a concrete, scriptable command sequence (`verify:schema`, `test-rls.ts`, `vitest run`, `tsc`, `eslint`, `next build`) plus the second `⚠` BLOCKING manual checkpoint the work plan itself calls out by name — it gets its own file (`engine1-adaptive-ai-work-plan-backend-task-14.md`).

### Layer-Aware Naming and Numbering

This is a genuine fullstack split (Next.js Server Components/Actions/queries for backend logic vs. `components/tutor/**` and `app/(layer3)/_components/**` client/server UI for frontend), so layer-aware filenames are used per the orchestration instructions. Backend task files are numbered `backend-task-01` through `backend-task-14`, mapping 1:1 to work-plan Tasks 1-13 (in order) plus Final-Phase Task 22 (`backend-task-14`, since it re-touches the same `schema.sql`/`verify:schema` surface as Task 1). Frontend task files are numbered independently, `frontend-task-01`/`frontend-task-02`, mapping to work-plan Tasks 14/15. Work-plan Task 3 (Math DAG content draft) has no `SOURCE/**` target file at all (it is a content-authoring/review deliverable) — it is still filed under the backend sequence (`backend-task-03`) because its sole deliverable feeds directly into Task 4's backend code and it sits inside the backend-only Phase 1 dependency chain; this is called out explicitly in that task's own file.

### Inter-task Relationship Map

```
Phase 1 (backend, foundation-first)
  backend-task-01 (T1  Schema DDL, ⚠ BLOCKING dev apply) ──┬─► backend-task-02 (T2 RLS Phần 7)
                                                              └─► backend-task-04 (T4 skillTaxonomy.ts) ◄── backend-task-03 (T3 DAG content, human review gate)
  backend-task-04 ──► backend-task-05 (T5 seedSkillTaxonomy.ts) ──► backend-task-06 (T6 tagQuestionSkills.ts)
  backend-task-04 ──► backend-task-07 (T7 route.ts)
  → phase1-completion

Phase 2 (backend, adaptive routing)
  backend-task-07 ──► backend-task-08 (T8 getSkillRecommendation())
  → phase2-completion

Phase 3 (backend, mastery write + tutor)
  backend-task-01 ──┐
  backend-task-09 (T9 wrongTwice.ts) ──┴─► backend-task-10 (T10 mastery-write TS wiring, service-integration-e2e)
  backend-task-09 ──────────────────────────────────────────► backend-task-13 (T13 explainStep(), needs T9's re-verification fn)
  backend-task-11 (T11 prompt.ts) ──► backend-task-12 (T12 callTutor.ts + telemetry) ──► backend-task-13
  → phase3-completion

Phase 4 (frontend, two vertical slices)
  backend-task-13 ──► frontend-task-01 (T14 Slice A — ExplainStepAffordance)
  backend-task-08 ──┐
  frontend-task-01 ─┴─► frontend-task-02 (T15 Slice B — SkillRecommendationCard)
  → phase4-completion

Phase 5 (manual verification — folded into phase5-completion, no individual task files)
  frontend-task-02 ──► [seed data → tutor round trip → dashboard pass → keyboard pass → axe pass → 10-case tone eval]
  → phase5-completion

Final Phase (backend-task-14 = T22 full regression + ⚠ BLOCKING prod apply; Tasks 23-27 folded into phase6-completion)
  phase2-completion (T2) ──┐
  backend-task-06 ─────────┴─► backend-task-14 (T22)
  phase5-completion (T21) ──► backend-task-14 (T22) ──► phase6-completion
```

### Interface Change Impact Analysis

| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|---|---|---|---|
| `public.questions` safe-column grant (9 columns) | Same grant statement, 10th column `skill_node_id` added **in place** | Yes — edit the existing `grant select (...)` statement, never append a second one (parser limitation, `verify-schema.ts` check #1) | backend-task-01 |
| `submitExam(attemptId, answers)` — steps 1-6, ends at `recordExamResult()` + redirect | Same signature; new non-throwing step 7 (`recordSkillMastery()` call) inserted after step 6's error handling, before redirect | Additive only — no signature change, no new thrown-error path | backend-task-10 |
| `getResult(attemptId)` → `ExamResult.perQuestion: PerQuestionResult[]` | `PerQuestionResult` gains `hasBeenWrongTwice?: boolean` | Additive only — 1 new optional field, computed only when `scored !== false && !isCorrect` | backend-task-09 |
| `RATE_LIMITS` (`SOURCE/lib/security/rateLimit.ts`) | New member `RATE_LIMITS.explainStep` | Additive only — no existing member's shape changes | backend-task-13 |
| `ResultDetailPage` render tree (mcq/short_answer/not-scored branches) | `ExplainStepAffordance` conditionally mounted in the mcq and short_answer branches only, gated by `r.hasBeenWrongTwice` | Additive-conditional — not-scored branch untouched | frontend-task-01 |
| `DashboardPage`'s `Promise.all` fetch + render (`PageHeader` → `AnalyticsDashboard`) | New parallel `getSkillRecommendation()` fetch + `SkillRecommendationCard` mounted between `PageHeader` and `AnalyticsDashboard` | Additive only — `AnalyticsDashboard` itself receives zero changes | frontend-task-02 |
| `en.ts`/`vi.ts` dictionaries | New `tutor.*` tail block; existing `analytics.*` block extended in place with `recommend*` keys | Additive only | frontend-task-01, frontend-task-02 |

### Common Processing Points

- **`computeWrongTwiceQuestionIds()`** (backend-task-09, `SOURCE/lib/scoring/wrongTwice.ts`) is the single source of truth for wrong-twice eligibility — both `getResult()` (display gating, backend-task-09) and `explainStep()` (server-side re-verification, backend-task-13) call this exact function. No task may re-derive or duplicate this aggregation logic.
- **Telemetry payload construction** (backend-task-12, home `lib/tutor/telemetry.ts` or co-located in `callTutor.ts`) is reused by both `explainStep()` (backend-task-13) and `getSkillRecommendation()` (backend-task-08) — backend-task-12 explicitly reconciles with whatever inline shape backend-task-08 used, if backend-task-08 lands first per the dependency graph (it does: T8 is Phase 2, T12 is Phase 3).
- **`recommendNextSkill()`** (backend-task-07) is the single heuristic-routing implementation — `getSkillRecommendation()` (backend-task-08) is its only caller; no second routing path may be introduced.
- **`skill_node_id`** never crosses into the TS layer past the SQL boundary (Minimal Surface Alternatives Element 3, backend-task-01 + backend-task-10) — enforced at both the schema grant level and the RPC's SQL-only lookup.

## Implementation Considerations

### Principles to Maintain Throughout

1. `record_skill_mastery()` is never atomic with `record_exam_result()` — a second, independent, best-effort step, per ADR-0011 (backend-task-01, backend-task-10).
2. Answer-key material (`correct_answer`/`sub_answers`/`essay_answer`) must reach neither the tutor prompt nor `telemetry_log`, proven by a 0-occurrence unit-test battery in both places (backend-task-11, backend-task-12) — the single most important gate per PRD Success Criteria #8.
3. Every task's tests are written Red-before-Green in the same commit as the implementation they cover (this repo's convention, not a deferred pass).
4. `§17` fingerprint recompute is a mandatory same-commit sub-step of every schema DDL change (backend-task-01), gated by `schemaFingerprint.test.ts`.
5. `explainStep(attemptId, questionId)`'s argument order is exact and is proven by a literal two-fixture unit test (frontend-task-01) — both are plain strings, so a swap compiles silently.

### Risks and Countermeasures

- **Risk**: §10c's grant-list edit lands as a second appended statement instead of an in-place edit, silently defeating `verify-schema.ts`'s single-match parser. **Countermeasure**: explicit instruction + `⚠` marker in backend-task-01; caught immediately by `verify:schema` check #1 (the Early Verification Point).
- **Risk**: A forged/incorrect mastery write re-opens the trust boundary ADR-0010 closed for scores. **Countermeasure**: ADR-0011's mirrored mechanism, proven by backend-task-02's new RLS cases and backend-task-10's real-DB `recordSkillMastery.int.test.ts` AC-011 negative proof.
- **Risk**: The Math DAG content review (backend-task-03) is a human content-authoring/review step and can stall the taxonomy-dependent chain. **Countermeasure**: backend-task-07's routing algorithm is proven against independently-authored literal fixture DAGs, not the real reviewed content — it can be built and verified in parallel with the content review; only backend-task-05/06 are hard-blocked on backend-task-03.
- **Risk**: `SkillRecommendationCard`'s async-Server-Component test technique has no prior precedent in this repo's test suite. **Countermeasure**: frontend-task-02 carries an explicit documented fallback (manual/Playwright-only verification) rather than silently reopening the UI Spec's server-component decision.

### Impact Scope Management

- **Allowed change scope**: `SOURCE/supabase/schema.sql` (§9b/§10c/§18/§19/§17 only), `SOURCE/supabase/{seedSkillTaxonomy,tagQuestionSkills}.ts` (new), `SOURCE/supabase/test-rls.ts` (append-only, new Phần 7), `SOURCE/lib/{adaptive,tutor}/**` (new), `SOURCE/lib/scoring/wrongTwice.ts` (new), `SOURCE/lib/schema/schemaFingerprint.ts` (constant update only), `SOURCE/lib/supabase/service-role.ts` (additive export), `SOURCE/lib/security/rateLimit.ts` (additive `RATE_LIMITS` member), `SOURCE/types/{adaptive.ts (new), result.ts (additive field)}`, `SOURCE/app/(layer2)/actions.ts` (additive step 7 in `submitExam()`), `SOURCE/app/(layer2)/tutorActions.ts` (new), `SOURCE/app/(layer2)/queries.ts` (additive `getResult()` extension), `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (additive conditional mount), `SOURCE/app/(layer3)/queries.ts` (additive `getSkillRecommendation()`), `SOURCE/app/(layer3)/_components/SkillRecommendationCard.tsx` (new), `SOURCE/app/(layer3)/me/dashboard/page.tsx` (additive fetch + mount), `SOURCE/components/tutor/**` (new), `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` (additive blocks).
- **Preserved areas (do not change)**: any pre-existing `schema.sql` grant/RLS/function outside the 4 listed sections; `computeScore.ts`, `recordExamResult()`, `claim_attempt_answer_key()`; `AnalyticsDashboard.tsx` and its existing props/children; `ResultDetailPage`'s not-scored branch and its pre-existing all-server-rendering behavior for every question/user not satisfying the new gating conditions.

## Task File Index

| # | File | Work Plan Task | Depends on |
|---|---|---|---|
| 01 | `engine1-adaptive-ai-work-plan-backend-task-01.md` | Phase 1 Task 1 (⚠ BLOCKING dev apply) | — |
| 02 | `engine1-adaptive-ai-work-plan-backend-task-02.md` | Phase 1 Task 2 | backend-task-01 |
| 03 | `engine1-adaptive-ai-work-plan-backend-task-03.md` | Phase 1 Task 3 (human content review) | — |
| 04 | `engine1-adaptive-ai-work-plan-backend-task-04.md` | Phase 1 Task 4 | backend-task-01, backend-task-03 |
| 05 | `engine1-adaptive-ai-work-plan-backend-task-05.md` | Phase 1 Task 5 | backend-task-04 |
| 06 | `engine1-adaptive-ai-work-plan-backend-task-06.md` | Phase 1 Task 6 | backend-task-05 |
| — | `engine1-adaptive-ai-work-plan-phase1-completion.md` | Phase 1 completion | 01-06 |
| 07 | `engine1-adaptive-ai-work-plan-backend-task-07.md` | Phase 2 Task 7 | backend-task-04 |
| 08 | `engine1-adaptive-ai-work-plan-backend-task-08.md` | Phase 2 Task 8 | backend-task-07 |
| — | `engine1-adaptive-ai-work-plan-phase2-completion.md` | Phase 2 completion | 07-08 |
| 09 | `engine1-adaptive-ai-work-plan-backend-task-09.md` | Phase 3 Task 9 | — |
| 10 | `engine1-adaptive-ai-work-plan-backend-task-10.md` | Phase 3 Task 10 | backend-task-01, backend-task-09 |
| 11 | `engine1-adaptive-ai-work-plan-backend-task-11.md` | Phase 3 Task 11 | — |
| 12 | `engine1-adaptive-ai-work-plan-backend-task-12.md` | Phase 3 Task 12 | backend-task-11 |
| 13 | `engine1-adaptive-ai-work-plan-backend-task-13.md` | Phase 3 Task 13 | backend-task-09, backend-task-12 |
| — | `engine1-adaptive-ai-work-plan-phase3-completion.md` | Phase 3 completion | 09-13 |
| 14 (frontend-01) | `engine1-adaptive-ai-work-plan-frontend-task-01.md` | Phase 4 Task 14 | backend-task-13 |
| 15 (frontend-02) | `engine1-adaptive-ai-work-plan-frontend-task-02.md` | Phase 4 Task 15 | backend-task-08, frontend-task-01 |
| — | `engine1-adaptive-ai-work-plan-phase4-completion.md` | Phase 4 completion | frontend-01, frontend-02 |
| — | `engine1-adaptive-ai-work-plan-phase5-completion.md` | Phase 5 (Tasks 16-21, folded — no individual task files, see Decomposition Scope Decision) | phase4-completion |
| 14 (backend) | `engine1-adaptive-ai-work-plan-backend-task-14.md` | Final Phase Task 22 (⚠ BLOCKING prod apply) | phase2-completion (T2), backend-task-06 (T6), phase5-completion (T21) |
| — | `engine1-adaptive-ai-work-plan-phase6-completion.md` | Final Phase completion (Tasks 22-27; 23/24/25/26/27 folded, see Decomposition Scope Decision) | backend-task-14 |
