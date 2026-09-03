# Overall Design Document: History Feature Implementation

Generation Date: 2026-07-30
Target Plan Document: `docs/plans/history-work-plan.md`

> **⚠ Per-task files removed 2026-08-18, after the feature closed.** The 18 executor-instruction files (`history-work-plan-task-01…18.md`) were deleted to keep the workspace navigable; references to them here and in the `*-phaseN-completion.md` files are **dangling by intent**.
>
> Recoverable from git — last commit containing them is **`aabc3de`**:
> ```
> git show aabc3de:docs/plans/tasks/history-work-plan-task-01.md
> ```
> Kept instead: every `*-phaseN-completion.md` (outcomes and measurements) and this overview.

## Project Overview

### Purpose and Goals

Ship a `/history` page listing every completed+scored exam attempt for the logged-in student, plus one shared, client-side PDF-generation module (score/time/exam-metadata summary only) consumed identically by History rows and the existing Result page's now-enabled Save/Share buttons. Success is defined by the PRD's 5 quantitative Success Criteria (list-scope correctness, single PDF implementation, guest access blocked, Share fallback coverage, nav wiring complete) and the two Design Docs' Acceptance Criteria (backend AC-001-005/009/016/017/019; frontend AC-002/004-015/018-019).

### Background and Context

`exam_attempts`/`exam_results` already store everything needed, but no page lists past attempts, and the Result page's Save/Share buttons render permanently `disabled` ("coming soon"). The PRD → UI Spec → ADR-0009 (PDF library choice) → backend Design Doc (v1.2) → frontend Design Doc (v1.3) chain is complete and Accepted/Draft-ready; this decomposition turns the Work Plan's 7 phases into single-commit-granularity task files.

## Task Division Design

### Division Policy

The Work Plan itself combines the backend DD's **Vertical Slice** approach (Phase 1: two independently-shippable units built together — `getResult()` extension and `listMyHistory()`) with the frontend DD's **Hybrid** approach (Phases 2-5: foundation-first PDF/Share module, then two vertical wire-ups, then nav) — this decomposition preserves that structure exactly, one task file per Work Plan task (1 task = 1 commit = 1 logical change), in the Work Plan's own dependency order.

Verifiability priority (per implementation-approach skill): L1 (functional, e.g. hitting `/history` or generating a real PDF) is preferred wherever the Work Plan already names an L1 checkpoint (Early Verification Points, Phase Completion Criteria); L2 (tests passing) is the default for every implementation task with an accompanying test file; L3 (build/`tsc` clean) is the floor for every task.

### Inter-task Relationship Map

```
Phase 0
  Task 01 (0.1 fixture-e2e harness) ─────────────────────────┐
                                                               │ (feeds Task 15 only)
Phase 1 (backend, vertical slice — 1.1/1.2 run in parallel)   │
  Task 02 (1.1 getResult() ext + test) ──────────┐            │
  Task 03 (1.2 listMyHistory() + test) ──┬───────┼─► Task 04 (1.3 HM guard/layout, placeholder render)
                                          └───────┼─► Task 05 (1.4 RLS case H-a + walkthrough)
                                                  │
Phase 2 (frontend foundation, hybrid step 1)      │
  Task 06 (2.1 add jspdf/html2canvas) ──┐         │
  Task 07 (2.2 format.ts) ──────────────┼─► Task 09 (2.4 generateAttemptPdf.ts)
  Task 08 (2.3 AttemptPdfTemplate) ─────┘         │
  Task 09 ──► Task 10 (2.5 ActionButton) ──► Task 11 (2.6 Early Verification Point, BLOCKING)
                                                  │
Phase 3 (vertical slice A)                       │
  Task 12 (3.1 ResultActions/ScoreCard/result page wiring) ◄── depends on Task 02, Task 10 (proven), Task 07
                                                  │
Phase 4 (vertical slice B)                       │
  Task 13 (4.1 HistoryList/HistoryRow + loading/error.tsx) ◄── depends on Task 12, Task 03
  Task 14 (4.2 history/page.tsx render wiring, replaces Task 04's placeholder) ◄── depends on Task 04, Task 13
  Task 15 (4.3 fixture-e2e execution) ◄── depends on Task 14, Task 01, Task 12
                                                  │
Phase 5 (nav)                                    │
  Task 16 (5.1 SiteHeader href) ◄── depends on Task 14
  Task 17 (5.2 HomeSidebar href) ◄── depends on Task 14
                                                  │
Final Phase (Phase 6)
  Task 18 (Final QA sweep) ◄── depends on all above
```

### Interface Change Impact Analysis

| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|---|---|---|---|
| `getResult(attemptId): Promise<ExamResult \| null>` — `ExamResult { examId, examTitle, result, questions }` | Same signature; `ExamResult` gains `startedAt: string`, `submittedAt: string \| null` | Additive only — 2 new fields | Task 02 |
| — (none) | `listMyHistory(): Promise<MyHistoryEntry[]>` | New function | Task 03 |
| `ResultActions()` — no props | `ResultActions({ pdfInput: AttemptPdfData })` | New required prop | Task 12 |
| `ScoreCard({ examTitle, result })` | `ScoreCard({ examTitle, result, completionTimeLabel: string })` | New required prop | Task 12 |
| `SiteHeader`/`HomeSidebar` `NAV` entry `{ label: "History", href: "#" }` | `{ label: "History", href: "/history" }` | Literal value only, no signature change | Tasks 16/17 |

### Common Processing Points

- **`lib/history/format.ts`** (Task 07) is the single source of truth for `formatSubmittedDate`/`formatCompletionTime`/`buildPdfFilename` — consumed by Task 09 (`generateAttemptPdf.ts`), Task 12 (`result/page.tsx` for `ScoreCard`), and Task 13 (`HistoryRow`). No task may re-derive these formats independently — this is the Minimal Surface Alternatives Element 2 decision from the frontend DD.
- **`generateAttemptPdfFile`/`AttemptPdfData`** (Task 09) is the single PDF-generation implementation (AC-007) — Task 10 (`ActionButton`) is the only caller; Task 12 (`ResultActions`) and Task 13 (`HistoryRow`) reach it exclusively through `ActionButton`, never by importing `generateAttemptPdf.ts` directly or forking a second pipeline.
- **`ActionButton`** (Task 10) is instantiated identically (`action`/`pdfInput`/`idPrefix` props) by both Task 12 and Task 13 — no per-surface fork of the Save/Share state machine.
- **Placeholder-then-replace sequencing** (flagged explicitly by the Work Plan): Task 04 creates `(history)/history/page.tsx` with a temporary minimal render (not yet importing `HistoryList`, which doesn't exist until Task 13); Task 14 replaces that placeholder with the real `import { HistoryList } from "./_components/HistoryList"` + render line. This is the one build-ordering subtlety spanning phases — preserved exactly as the Work Plan resolved it.

## Implementation Considerations

### Principles to Maintain Throughout

1. No schema or RLS change at any point (PRD R8/AC-017) — every backend task reads only already-existing tables/policies.
2. `getResult()`'s extension and `ResultActions`/`ScoreCard`'s new props are additive/single-caller changes — no back-compat shim needed, but every pre-existing field/behavior must remain byte-identical (Output Comparison, Task 02; DOM-shape invariant, Tasks 10/12).
3. `jspdf`/`html2canvas` are dynamically imported only inside the Save/Share handler body (ADR-0009) — never a top-level import of any page/layout/component (verified per-task in Tasks 06/09, swept project-wide in Task 18).
4. `AttemptPdfTemplate`'s styles resolve exclusively to plain hex/rgb(a) — no Tailwind class, no `components/ui/button.tsx` (ADR-0009, Task 08).
5. Every task's tests are written Red-before-Green in the same commit as the implementation they cover (TDD, testing-principles).

### Risks and Countermeasures

- **Risk (R-1, backend)**: exams-visibility edge case could silently omit a History row. **Countermeasure**: Task 03 proves JS-assembly omission via mocks; Task 05's real-Postgres `test-rls.ts` case H-a + manual walkthrough is the **required, blocking** proof mocks cannot provide.
- **Risk (R-2, backend)**: `getResult()`'s extension regresses its 2 existing consumers. **Countermeasure**: Task 02's Output Comparison (Early Verification Point #1) gates Task 03.
- **Risk (frontend, html2canvas/oklch)**: styling constraint violation crashes PDF generation for every Save/Share. **Countermeasure**: Task 08's guard test + Task 11's real-browser Early Verification Point #2, both blocking before Phase 3.
- **Risk (schedule)**: Phase 2's PDF pipeline is the highest-complexity, most novel piece. **Countermeasure**: foundation-first ordering (Tasks 06-10) with Task 11 as a hard-blocking checkpoint before either consumer (Tasks 12/13) is wired.
- **Risk (Phase 0 novelty)**: this repo has no existing request/route-mocking layer for fixture-e2e; Task 01 is the first task to build one. Flagged as low-certainty/exploratory in Task 01 itself, with an explicit fallback decision rule (real-Postgres seeding, mirroring `test-rls.ts`'s own established pattern) rather than a silently-unresolved gap.

### Impact Scope Management

- **Allowed change scope**: `SOURCE/app/(history)/**` (new route group), `SOURCE/components/{history,pdf}/**` (new), `SOURCE/lib/{history,pdf}/**` (new), `SOURCE/features/exams/queries.ts` (additive extension only), `SOURCE/features/exams/components/ResultActions.tsx, SOURCE/features/exams/components/ScoreCard.tsx, SOURCE/components/layout/SiteHeader.tsx`, `SOURCE/features/auth/components/HomeSidebar.tsx`, `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx`, `SOURCE/package.json`, `SOURCE/supabase/test-rls.ts` (append only), `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` (fill in skeleton) + one new fixture-data module.
- **Preserved areas (do not change)**: any schema/RLS definition in `SOURCE/supabase/schema.sql`; `computeScore`, `submitExam`, `startAttempt`, `rateExam`, `getMyRating`; `listMySubmittedExamIds`, `listExams`, `getExam`, `getExamForPlayer`; the Analytics/Layer 3 feature (`(analytics)/**`); `mupdf`/Layer 4 UGC extraction path; `result/page.tsx`'s "Try again"/rating-entry links and `grid-cols-3` layout shape (visually preserved, not structurally changed).

## Task File Index

| # | File | Phase.Task | Depends on |
|---|---|---|---|
| 01 | `history-work-plan-task-01.md` | 0.1 | — |
| 02 | `history-work-plan-task-02.md` | 1.1 | — |
| 03 | `history-work-plan-task-03.md` | 1.2 | — |
| 04 | `history-work-plan-task-04.md` | 1.3 | 03 |
| 05 | `history-work-plan-task-05.md` | 1.4 | 03 |
| — | `history-work-plan-phase1-completion.md` | Phase 1 completion | 02,03,04,05 |
| 06 | `history-work-plan-task-06.md` | 2.1 | — |
| 07 | `history-work-plan-task-07.md` | 2.2 | — |
| 08 | `history-work-plan-task-08.md` | 2.3 | — |
| 09 | `history-work-plan-task-09.md` | 2.4 | 06,07,08 |
| 10 | `history-work-plan-task-10.md` | 2.5 | 09 |
| 11 | `history-work-plan-task-11.md` | 2.6 | 10 |
| — | `history-work-plan-phase2-completion.md` | Phase 2 completion | 06-11 |
| 12 | `history-work-plan-task-12.md` | 3.1 | 02,07,10,11 |
| — | `history-work-plan-phase3-completion.md` | Phase 3 completion | 12 |
| 13 | `history-work-plan-task-13.md` | 4.1 | 03,12 |
| 14 | `history-work-plan-task-14.md` | 4.2 | 04,13 |
| 15 | `history-work-plan-task-15.md` | 4.3 | 01,12,14 |
| — | `history-work-plan-phase4-completion.md` | Phase 4 completion | 13,14,15 |
| 16 | `history-work-plan-task-16.md` | 5.1 | 14 |
| 17 | `history-work-plan-task-17.md` | 5.2 | 14 |
| — | `history-work-plan-phase5-completion.md` | Phase 5 completion | 16,17 |
| 18 | `history-work-plan-task-18.md` | Final Phase | 01-17 |
| — | `history-work-plan-phase6-completion.md` | Overall completion | 18 |

Naming note: this plan's tasks all touch a single Next.js application (`SOURCE/app`) spanning Server Components, route-group backend reads, and client components in the same directories per feature area — there is no separate backend/frontend package boundary in this repo's layout (route groups mix both), so layer-aware filename infixes are omitted in favor of the plan's own phase/task numbering, which already communicates layer (Phase 1 = backend, Phases 2-5 = frontend).
