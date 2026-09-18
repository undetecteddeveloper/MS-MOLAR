# Overall Design Document: Kho đề theo kệ (Exam Shelves)

Generation Date: 2026-09-18
Target Plan Document: `docs/plans/20260918-feature-exam-shelves.md`

## Project Overview

### Purpose and Goals
Turn `/exams` from one flat grid into three shelves (Cần luyện, Nổi nhất, Khám phá), backed by a new cross-user "hot" signal (`exam_hot_counts()` RPC) the product cannot currently read, and persist which shelf every attempt started from (`exam_attempts.source`). Full requirements: `docs/prd/exam-shelves-prd.md` v1.2, AC-001–AC-051.

### Background and Context
`exam_attempts` RLS scopes every client read to the caller, so "how many students attempted this exam" is unreadable today without a `security definer` escape hatch. ADR-0021 authorizes exactly one such aggregate, scoped to 4 columns, granted only to `authenticated`/`service_role`. The weakest-subject signal already exists inside `rankExams.ts`'s `affinity` computation but is never surfaced; this feature exports it. Both signals compose into 3 shelves that replace the flat grid only when no browse/filter/sort/page param is present.

## Task Division Design

### Division Policy
The work plan's own phase structure is a **hybrid** strategy: Phase 0 is a horizontal exception (schema must exist before anything else can read it — Foundation-driven), Phases 1–2 are horizontal foundation layers (pure logic, then presentational components), and Phases 3–8 are vertical/integration slices that compose those foundations into working surfaces (backend composition → sort axis → page integration → `?from=` chain → home block → hardening). This decomposition follows that same structure 1:1 — each work-plan task becomes exactly one task file, at 1-commit granularity, because the plan itself was already authored at single-commit granularity (each task already names its target files, AC list, Design ref, Proof Obligation, and Verify step).

Verifiability level distribution: most tasks are L2 (new/extended unit or integration tests green) or L3 during Phase 0's schema work (build/tooling exit codes); Phase 5 (page integration), Phase 6 (`?from=` chain), and Phase 7 (home block) are L1 (functional, end-user-visible); Phase 8 and the Final Phase mix L2 (live-dev test runs) with manual L1 gates (CLS, accessibility, prod fingerprint).

### Inter-task Relationship Map
The work plan's own **Phase Structure Diagram** and **Task Dependency Diagram** (`docs/plans/20260918-feature-exam-shelves.md` lines 254-363) are the authoritative dependency graph and are not restated here — each task file's Metadata section names its direct predecessors from that graph. In summary:

```
Phase 0 (P0-T1..T7, sequential T1→T2→T3→T4→T5→T6; T7 independent)
  → Phase 1 (P1-T1 independent-first; P1-T2..T6 mostly independent of each other)
    → Phase 2 (P2-T1, P2-T2 needs P1-T1; P2-T3 needs P1-T2+P1-T4+P2-T2; P2-T4 needs P1-T4)
      → Phase 3 (P3-T1 needs P1-T4; P3-T2 needs P3-T1+P2-T4)
        → Phase 4 (P4-T1 needs P3-T2; P4-T2 needs P4-T1; P4-T3 needs P4-T2; P4-T4 needs P4-T1)
          → Phase 5 (P5-T1 needs P1-T6+P2-T3+P4-T4; P5-T2 needs P5-T1)
            → Phase 6 (P6-T1 needs P1-T5+P2-T2+P5-T1)
Phase 7 (P7-T1 needs P3-T2) runs parallel to Phases 4-6
              → Phase 8 (P8-T1 needs P0-T6; P8-T2 independent within P8; P8-T3 before P8-T4; P8-T1/T4 need P5-T2+P6-T1+P7-T1)
                → Final Phase (FQA-T1..T10, after Phase 8)
```

### Interface Change Matrix
| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|---|---|---|---|
| `buildSubjectWeakness` (internal, unexported) | `buildSubjectWeakness` (exported, widened return `Map<string, SubjectWeakness> \| null`) | Yes — single in-file caller updated | P1-T3 |
| `startAttempt(examId)` | `startAttempt(examId, rawSource?)` | Yes — 1 added optional param, 1 added column on existing insert | P1-T5 |
| `ExamCard({exam, priority?, ...})` | `ExamCard({exam, priority?, ribbon?, from?, className?, ...})` | Yes — 3 new optional props, bare-card render byte-identical (AC-043) | P2-T2 |
| `ExamSort = "newest" \| "oldest" \| "hardest"` | `ExamSort` widened `+= "hot"` | Yes — union + `DEFAULT_ASCENDING` record entry + inner branch, ONE commit | P4-T1 |
| `attempts.ts` logic inline in `ranking.ts:27-64` | `features/exams/queries/attempts.ts` (extracted, unchanged) | No behavior change — `listExamsRanked` output byte-identical | P2-T4 |
| `StartAttemptButton({examId})` | `StartAttemptButton({examId, source?})` | Yes — 1 new optional prop | P6-T1 |
| `app/(exams)/exams/[id]/page.tsx` (no `searchParams`) | same page + `searchParams: Promise<{from?: string}>` | Yes — new param read, untyped until `toAttemptSource()` | P6-T1 |
| `ExamFilters`'s local `ExamSort` union (3 values) | local union `+= "hot"`, `QUICK` gains 4th entry | Yes — additive, 0 changed props on existing 3 chips | P4-T4 |
| `app/page.tsx`'s home block reads `listNewExams`-shaped data | guarded `user ? await listHotExams(...) : null` | Yes — data source + label swap, guarded (F-001) | P7-T1 |

### Common Processing Points
- **`lib/adaptive/examShelves.ts`** (P1-T4) is the single ladder implementation — `pickHotShelf`, `pickWeakestSubject`, `pickDominantGrade`, `pickExploreShelf`, `orderIdsByHotCount` are each called from exactly one composition site (`shelves.ts` P3-T2 for the first four, `ranking.ts`'s hot branch P4-T2 for the last) — no duplicate re-implementation.
- **`lib/adaptive/rankExams.ts`'s exported helpers** (P1-T3) are reused, not re-implemented, by `examShelves.ts`'s weakest-subject pick (ADR-0021 D2 dependency_direction binding).
- **`features/exams/queries/attempts.ts`** (P2-T4, extracted from `ranking.ts`) becomes the single attempt-read owned once per page render (ADR-0021 D2 Decision 1b) — consumed by both `ranking.ts` (existing personalised ranking) and `shelves.ts` (P3-T2, new shelves composition).
- **`features/exams/queries/hotCounts.ts`** (P3-T1) is the single RPC call site and single window-clock read — shared by `shelves.ts` (P3-T2), `ranking.ts`'s hot branch (P4-T2), and home's `listHotExams` (P7-T1, itself inside `shelves.ts`). The clock is read once per composition, never inside `lib/adaptive` (ADR-0021 D4).
- **`lib/exams/browseParams.ts`'s `hasBrowseParam(sp)`** (P1-T6) is the single source of truth for the shelves-vs-grid branch predicate — consumed by the page (P5-T1) and proven table-driven by the fixture lane (P5-T2). No second, parallel definition of "does this URL carry a browse param" is permitted anywhere.
- **`lib/exams/attemptSource.ts`'s `toAttemptSource()`** (P1-T5) is the single normalisation point for the `source` value — the `?from=` chain (P2-T2 producer, P6-T1 consumer) never validates client-side; normalisation happens only at the server-action boundary.
- **`ExamCard.snapshot.test.tsx`** (P1-T1) is the single containment proof for `ExamCard`'s pre-change markup — P2-T2 extends it, never re-creates it.

## Implementation Considerations

### Principles to Maintain Throughout
1. Every existing path (flat grid, `?sort=newest|oldest|hardest`, `?dir`, `?page`, every filter, `/exams/[id]`) stays byte-identical/behavior-identical — proven by `rating.int.test.ts:319-457` passing unmodified end-to-end, not just once.
2. `ExamCard` rendered with none of its 3 new props stays byte-identical (AC-043) — P1-T1's snapshot must be committed before P2-T2 touches the component, and P2-T2 must never run `-u` reflexively.
3. Rank-then-cut stays binding — no `.limit()`/`.range()` inside `fetchExamRows`; every shelf is cut to 10 in Node, after ordering (ADR-0021 D2).
4. The composition budget is asserted by counting `from()` + `rpc()` together, one case per surface (`listExamsRanked` stays 3 except `?sort=hot`; `listExamShelves()` = 4) — a silently added read must turn a test red.
5. The 6 verify gates run before every commit from inside `SOURCE/`; gate 6 is not meaningful until Phase 0's dev migration apply (P0-T4) lands — run gates 1-5 only before that.
6. The pre-existing `SOURCE/lib/security/rateLimit.test.ts` failing case (`33 <= 20`) is baseline noise, unrelated to this feature — it must stay exactly 1 failing case throughout; no task here may "fix" it.

### Risks and Countermeasures
See work plan §"Risks and Countermeasures" (lines 224-252) — copied verbatim into the affected task files' Proof Obligations rather than restated here, so each risk's countermeasure lives next to the task that implements it (P0-T4 dev/prod drift; P3-T2/P4-T3 round-trip budget; P2-T4/P1-T3 extraction behavior-preservation; P1-T1/P2-T2 ExamCard containment; P1-T6/P5-T1/P5-T2 raw-key branch predicate; P8-T2 k-anonymity residual).

### Impact Scope Management
- **Allowed change scope**: every file listed in the Design-to-Plan Traceability table (backend + frontend Implementation Path Mapping union) plus the 4 pre-committed test skeleton files being filled in (`shelves.int.test.ts`, `rating.int.test.ts`'s appended block, `exam-shelves.fixture.e2e.test.ts`, `exam-hot-counts.service.e2e.test.ts`).
- **Preserved areas**: `rating.int.test.ts:1-747` (except the appended candidate-3 block, P4-T3); `ExamBrowser` component (byte-untouched per frontend DD Minimal Surface Alternatives Element 3); `exam_attempts` RLS policies (0 additions/alterations/drops per ADR-0021 D6); `globals.css` (0 edits per frontend DD § Rendering, performance and motion); `catalogue.ts`'s outer `if (filters?.sort) {...} else {...}` structure at `:105-117` (only the inner case list gains one branch, P4-T1).

## Task File Index

| Task ID | File | Phase Purpose |
|---|---|---|
| P0-T1..P0-T7 | `exam-shelves-task-P0-T1.md` .. `exam-shelves-task-P0-T7.md` | Schema, fingerprint, migration, dev apply/read-back, Early Verification Point, doc cleanup |
| P1-T1..P1-T6 | `exam-shelves-task-P1-T1.md` .. `exam-shelves-task-P1-T6.md` | Pure-logic foundations + ExamCard containment proof (FIRST) |
| P2-T1..P2-T4 | `exam-shelves-task-P2-T1.md` .. `exam-shelves-task-P2-T4.md` | ExamCard/ExamRibbon/ExamShelf UI + attempts.ts extraction |
| P3-T1..P3-T2 | `exam-shelves-task-P3-T1.md` .. `exam-shelves-task-P3-T2.md` | Backend shelves composition (integration point) |
| P4-T1..P4-T4 | `exam-shelves-task-P4-T1.md` .. `exam-shelves-task-P4-T4.md` | `?sort=hot` axis |
| P5-T1..P5-T2 | `exam-shelves-task-P5-T1.md` .. `exam-shelves-task-P5-T2.md` | `/exams` page integration (main integration point) + fixture-e2e |
| P6-T1 | `exam-shelves-task-P6-T1.md` | `?from=` chain wiring |
| P7-T1 | `exam-shelves-task-P7-T1.md` | Home block guarded hot fetch |
| P8-T1..P8-T4 | `exam-shelves-task-P8-T1.md` .. `exam-shelves-task-P8-T4.md` | Backend verification hardening (RLS proof, service e2e) |
| FQA-T1..FQA-T10 | `exam-shelves-task-FQA-T1.md` .. `exam-shelves-task-FQA-T10.md` | Final Quality Assurance |

Phase completion files: `exam-shelves-phase0-completion.md` through `exam-shelves-phase8-completion.md` (one per numbered phase). The Final Phase's own FQA-T1..T10 tasks already constitute the project-wide completion checklist (Design-to-Plan Traceability coverage, 6-gate real exit codes, `rating.int.test.ts` regression, security review, manual CLS/accessibility/prod-fingerprint gates, coverage, docs, AC-042 metric query) — no separate wrapping "final-phase-completion" file is generated, to avoid duplicating FQA-T1..T10's own checklist.

## Notes on Decomposition
- All 41 work-plan tasks map 1:1 to 41 task files — no splitting or merging was needed, because the plan was already authored at single-commit granularity with per-task AC lists, Design refs, Proof Obligations, and Verify steps.
- No ambiguous/underspecified task was found during decomposition (see final report to the invoking agent for the explicit confirmation).
