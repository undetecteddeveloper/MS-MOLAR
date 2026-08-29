# Overall Design Document: Essay (Tự luận) Auto-Scoring

Generation Date: 2026-08-29
Target Plan Document: `docs/plans/20260829-feature-essay-auto-scoring.md`
Branch: `design/adr-0018-essay-async-grade-write` (base `main` @ `7894417`)
App root: **`SOURCE/`, not the repository root.** Every `npm` script runs from `SOURCE/`.

## Project Overview

### Purpose and Goals

Ship automatic scoring for `essay` (tự luận) questions end-to-end and ship it **switched off**: `computeScore()` emits a six-key lifecycle contract into `exam_results.per_question`; an `after()` pass claims, meters, calls Groq once per question, and settles a band through two new `service_role`-only SQL functions that preserve array order and refuse to overwrite; the final state of a stuck question is **derived at read time** by one pure function used by every surface; four display surfaces render seven render states, block PDF export while anything is unresolved, and offer a bounded retry. The feature stays disabled behind `ESSAY_GRADING_ENABLED` until the human Zero Data Retention gate (AC-067) carries a dated console check in the work plan.

### Background and Context

`essay` is the last question type with no scoring: `isScored()` returns `false` unconditionally for it (`computeScore.ts:41`), so an all-essay attempt stores `correct = 0, total = 0, total_score = 0.00` and the student reads a zero on work they actually did. But there is **nowhere for a band to land**: `exam_results` is `unique (attempt_id)`, `record_exam_result()` is INSERT-only, and the client's write access was revoked entirely (`schema.sql:849`). That is constraint C1, and it is why ADR-0018 exists. Nothing survives the invocation either — `after()` dies with it, `vercel.json` has no `crons` — so "grading failed" cannot be a written value; it is **derived at read time** (C2/W6/F3).

Production has **0** submitted essays (measured 2026-08-27), so forward-only with no backfill loses no real data — and **every end-to-end check runs on dev with seeded data**.

Three pieces of process debt shape the sequencing more than any technical fact: **TD-005** (hand-applied schema, fired four times) makes Phase 3.5 non-negotiable; **TD-029** (ADR-0010's kill criterion already fired on both limbs) means operations 12 and 13 proceed by recorded engineer decision and a fourteenth forces a revisit; **TD-030** means `npm run test:fixture` is already red on `main` and the verify gate went from four commands to six.

## Task Division Design

### Division Policy

- **The plan's own task IDs are preserved exactly.** G0.1–G0.5, H1–H8, B1.1, B1.2, B1.3, B1.3b, B1.4, B1.5, B1.6, B2.1–B2.4, B3.1–B3.3, B4.1, F-A1–F-A3, F-B1–F-B3, F-C1–F-C4, F-D1, E1–E6, Final. These IDs are referenced by the plan's hard gates, its Task Dependency Diagram, its Design-to-Plan Traceability table and its PRD-AC → Task Traceability table; renumbering them breaks all four. **No task was invented, merged, split, reordered or renamed.**
- **Structure: Hybrid** — one horizontal foundation phase (H) in front of five vertical slices (B1…B4 backend, F-A…F-D frontend), with human-owned gates at both ends (Phase 0, Phase E).
- **Granularity: 1 plan task = 1 task file = 1 commit**, with one deliberate exception the plan itself fixes: **Task B1.5 is two commits** with an explicit boundary (I004), and **Task B1.1 has no commit of its own** — its cases land inside B1.5 commit 1 (I006).
- **Verification level distribution**: **L1** at the two Early Verification Points (B1.1/B1.5 backend, F-A3 frontend), at every vertical slice's dev run (B1.5, B2.1, B3.2, F-B1, F-B3, F-C1, F-C2, F-D1), at the database operations (H7) and at Phase E; **L2** for Phase H's pure modules and every test-conversion task; **L3** for the type-level and comment-only tasks (B2.3, B4.1).

### Task counts

| Group | Count | Files |
|---|---|---|
| Phase 0 — entry gates | 5 | `…-task-G0.1.md` … `-G0.5.md` |
| Phase H — foundation | 8 | `…-task-H1.md` … `-H8.md` |
| Phase B1 — automatic grading path | 7 | `…-task-B1.1.md`, `-B1.2.md`, `-B1.3.md`, `-B1.3b.md`, `-B1.4.md`, `-B1.5.md`, `-B1.6.md` |
| Phase B2 — read path | 4 | `…-task-B2.1.md` … `-B2.4.md` |
| Phase B3 — retry, telemetry, ceiling ripple | 3 | `…-task-B3.1.md` … `-B3.3.md` |
| Phase B4 — reason-only corrections | 1 | `…-task-B4.1.md` |
| Phase F-A — display foundation | 3 | `…-task-F-A1.md` … `-F-A3.md` |
| Phase F-B — detail surface + PDF guard | 3 | `…-task-F-B1.md` … `-F-B3.md` |
| Phase F-C — interaction + fixture-e2e | 4 | `…-task-F-C1.md` … `-F-C4.md` |
| Phase F-D — player footnote | 1 | `…-task-F-D1.md` |
| Phase E — enable | 6 | `…-task-E1.md` … `-E6.md` |
| Final Phase — quality assurance | 1 | `…-task-Final.md` |
| **Total task files** | **46** | all prefixed `essay-auto-scoring-task-` |

### Phase order

```
Phase 0  →  H  →  B1  →  B2  →  B3  →  B4
                   ↓
                  F-A  →  F-B  →  F-C  →  F-D
B3 ─┐
F-D ─┴→  Phase E  →  Final Phase
B4 ──────────────────→ Final Phase
```

**Phase ordering is a hard constraint, not a convenience grouping**:
- **0 before H** — Gates C and D are prerequisites to DDL and to `listMyHistory()`.
- **H before B1** — nothing can be claimed or settled before the functions exist on the database.
- **B1 before B2** — V1 creates the data, V2 reads it. Reversed, V2 can only be verified against a hand-typed jsonb fixture the author invented rather than against what `record_essay_grade()` actually writes, **and that divergence is the hardest-to-see failure mode in the feature**.
- **H7 before B3.3** — schema first, code second (the R-f condition).
- **F-A before F-B/F-C** — V1 is the only slice proving the read contract actually runs; three slices otherwise stand on sand.
- **F-B before F-C** — F-B is the only slice touching two route groups and two already-green test files, and doing it while the tree is quiet keeps "red because of a new prop" distinguishable from "red because of the poller".

### Inter-task dependency edges (from each task's own Dependencies line)

```
G0.2 → H5          G0.4 → H5          G0.5 → H1
H1 → H5            H1 → B1.1          H1 → H3
H3 → B1.2          H4 → B1.2
H5 → H6 → H7 → H8
H2 → B1.3          H7 → B1.3b
B1.2 → B1.4        B1.3 → B1.4        B1.3b → B1.4
B1.1 → B1.5        B1.4 → B1.5        H7 → B1.5
B1.5 → B1.6        B1.5 → B2.1        B1.5 → B4.1        B1.5 → F-D1
G0.3 → B2.2        B2.1 → B2.2
B2.1 → B2.3        B2.2 → B2.3
B2.1 → B2.4        B2.2 → B2.4
H7 → B3.1          B1.4 → B3.1
B3.1 → B3.2        B2.1 → B3.2        B1.4 → B3.2
H7 → B3.3          B3.1 → B3.3
B2.1 → F-A1 → F-A2 → F-A3
F-A3 → F-B1        F-A3 → F-B2        F-A3 → F-C2
B2.3 → F-B3        F-B2 → F-B3
F-B1 → F-C1        B3.2 → F-C1
F-B3 → F-C3        F-C2 → F-C3
F-C3 → F-C4        F-C2 → F-C4        F-B2 → F-C4
F-C3 → F-D1
E1 → E2, E3, E4, E5 → E6
all phases → Final
```

*The work plan's Mermaid diagram is generated from these lines. **Where the two differ, the task text wins** — fix the diagram, not the task.*

### Per-task status

| Task | Status | Note |
|---|---|---|
| **G0.1** | 🔴 **BLOCKED on the engineer** | A1 ✅ and A5 ✅ (ZDR on). **A5b blocked on A2 alone** — the rotated `GROQ_API_KEY` must be placed in `SOURCE/.env.local`. Until A5b ticks, **no task may perform a dev `L1` run** |
| **G0.2** | ✅ **DISCHARGED 2026-08-29** | Gate C **CLOSED**: `telemetry_log_event_type_check` + `telemetry_log_error_code_check`, identical on both projects. Task H5 uses them verbatim |
| **G0.3** | ✅ **DONE** (2026-08-29) | Gate D — payload measured on both DBs (375 → 3 401 B/row, ≈9.1× on prod-shaped exams). Engineer **ACCEPTED**; Escalation 2 stays closed. **B2.2 unblocked** |
| **G0.4** | ✅ **DISCHARGED 2026-08-29** | Gate B1: prod and dev both `29931beeb950`. **Gate B2 stays open by construction** — the new literal does not exist until H5 edits `schema.sql` |
| **G0.5** | ✅ **DISCHARGED 2026-08-29** | Gate F1: TD-030 baseline = exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) (`en`, `vi`) |
| H1…H8 | 🟡 **H1–H7 DONE** (2026-08-29) | H7 applied to dev **and** prod, human-confirmed. **H8 is the one still open** — SVC-1/SVC-2 remain `it.todo`; it needs real Postgres and was outside this session's agreed order |
| B1.1…B1.6 | 🟡 **ALL SIX DONE** (2026-08-29) | `46bc8af` B1.2 · `bffaad0` B1.3 · `a87ba7d` B1.3b · `046a2e8` B1.4 · `3a34c9c`+`b7208f2` B1.5 (B1.1 folded into commit 1) · `5224a99` B1.6. **Phase not closed**: the manual `L1` dev run is the single outstanding criterion |
| B2.1…B2.4 | ⚪ not started | B2.2's gate (G0.3 / Gate D) is **now closed** — no longer blocked |
| B3.1…B3.3 | ⚪ not started | B3.3 **closes H7's known-red window** |
| B4.1 | ⚪ not started | comments and titles only |
| F-A1…F-A3 | ⚪ not started | F-A3 is the frontend Early Verification Point |
| F-B1…F-B3 | ⚪ not started | 15 coupled test render sites split 13 (F-B2) + 2 (F-B3) |
| F-C1…F-C4 | ⚪ not started | F-C3 **before** F-C4 — same file, shared fake-clock harness |
| F-D1 | ⚪ not started | resolves Open Item I-6 |
| E1…E6 | ⚪ not started | human-owned; E1 gates the rest of the phase |
| Final | ⚪ not started | verification + document updates; **no feature code** |

### Interface Change Impact Analysis

| Existing interface | New interface | Conversion required | Owning task |
|---|---|---|---|
| `computeScore(questions, answers)` | `computeScore(questions, answers, options?)` — default `{ essayGrading: false }` | **No** for callers (the default preserves today's behaviour byte-for-byte) | B1.5 commit 1 |
| `getResult()` → `ExamResult` | `+ essay?: EssayView` per row, `+ essaySummary?: EssaySummary`, `+ hasIncompleteEssay: boolean` (required) | Yes — the select gains `created_at` | B2.1 |
| `listMyHistory()` → `MyHistoryEntry` | `+ hasUnresolvedEssay: boolean`, `+ hasIncompleteEssay: boolean` (both required) | Yes — the embedded select gains `per_question, created_at` | B2.2 |
| `AttemptPdfData` | `+ hasIncompleteEssay: boolean` (required) | Yes at **2** construction sites; the **6** pass-through consumers only forward | B2.3 |
| `usePdfAction(action, pdfInput)` | `usePdfAction(action, pdfInput, blockedReason)` — third parameter **required** | Yes — **15** coupled test render sites (13 F-B2, 2 F-B3) | F-B2, F-B3 |
| `AttemptPdfTemplate` props | `+ hasIncompleteEssay: boolean`, `+ essayIncompleteLabel?: string` | Yes at the generator | F-B3 |
| `QuestionRenderer` / `ExamPlayer` props | `+ essayGradingEnabled?: boolean` — **optional**, default `false` | **No** — that optionality is what keeps `ExamPlayer.test.tsx` and `QuestionRenderer.test.tsx:112` green | F-D1 |
| `service-role.ts` operations (11) | **13** — `claimEssayGradingAttempt`, `recordEssayGrade` | Yes — TD-029 note at the line | B1.3b |
| `TelemetryEventType` / `TELEMETRY_ERROR_CODES` | `+ 'essay_grade'`; error codes 6 → 9 | Yes — **7** coupled sites | B3.1 (TS), H5/H7 (SQL) |
| `LIMITS.MAX_ATTEMPT_ANSWER` 500 | 4000 | Yes — DB first (H7), constant second (B3.3) | H5/H7 → B3.3 |

### Common processing points

- **`SOURCE/lib/scoring/essayLifecycle.ts` (Task H1)** is the single declaration of all six jsonb key literals, `ESSAY_BANDS`, `ESSAY_MAX_ATTEMPTS`, `ESSAY_MAX_POINTS`, `ESSAY_PENDING_DEADLINE_MS`, the three types and the seven functions. **Everything else imports from here so no key string is ever hand-typed twice**, and RS-6's expression (`state === "failed" && !retryAvailable`) exists **only** in this file (EG-BE-036).
- **`SOURCE/lib/billing/budgetDay.ts` (Task H2)** is the single Pacific-day + TTL declaration, imported by **both** `quota.ts` (Gemini) and `budget.ts` (Groq). Two independent derivations would split one counter with nothing red anywhere.
- **`SOURCE/lib/essay/groqClient.ts` (Task B1.2)** is the **only** Groq emission point, asserted by an exhaustive `toEqual` chokepoint scan **keyed on the endpoint-constant identifier, never the host string** — because `api.groq.com` also appears in `scripts/check-ai-key-bundle.mjs`.
- **`AttemptPdfData.hasIncompleteEssay` (Task B2.3)** is one field on one shared type, which is what makes the two PDF export routes **structurally unable to disagree**.
- **`usePdfAction`'s `blockedReason` (Task F-B2)** is one hook serving **two doors**.
- **`renderServerTree()`** is imported from `SOURCE/app/(billing)/me/orders/__tests__/renderServerTree.tsx`. **`SOURCE/lib/test/renderServerTree.tsx` does not exist.** This feature is its **second** consumer — Rule of Three is not met, so it is **not** extracted; a **third** consumer is the forced-revisit condition.

## Implementation Considerations

### Principles to maintain throughout

1. **Six verify gates per commit, run individually, trusted by real exit code.** Not an `&&` chain — a chain that "looked green" is how TD-030 stayed hidden. **Every task file carries its own Gate E4 exit-code table, and a file with an empty cell is not complete** at execution time.
2. **The known-red window (H7 → B3.3) is recorded, not resolved.** `verify:schema`'s character-ceiling assertion is red **by design** for ~12 commits. A red ceiling assertion **inside** the window is expected; **outside** it, or **any other** `verify:schema` assertion red at any time, is a regression. **Do not resolve it by moving `limits.ts` earlier** — that opens the Gemini-prompt ripple Gate H4 exists to close.
3. **Gate A5b before any Groq request, dev included.** Tasks **B1.5, B3.2, F-C2** carry the entry line. No task sets `ESSAY_GRADING_ENABLED=true` anywhere until A5b ticks, and dev runs use **seeded data only**.
4. **Gate G ordering is non-negotiable**: claim → reserve budget → call provider → settle. Metering never precedes authorisation.
5. **Assert unchanged, do not merely leave alone.** `ScoreCard.tsx` is a **0-diff zone**; `wrongTwice.ts` is not touched by one byte; `schema.sql:1354` is asserted, not assumed.
6. **Never a native `disabled`** anywhere in the essay tree — focusable + `aria-disabled` + exposed reason + a synchronous `ref` latch. The repo has fixed this exact bug **twice**.
7. **`toEqual` against hand-built literals, never snapshots** — a snapshot gets updated when it goes red, which records the very drift it exists to catch.

### Risks and countermeasures (carried from the plan)

- **R-01** missing `order by ord` shuffles `per_question` on the first graded essay — every "band landed" assertion stays green. → SVC-1(a) asserts the **whole** `questionId` sequence after grading the **middle** of three (Task H8).
- **R-02** the ceiling moves in one place only. → Gate H2 forces one commit; the window sits deliberately on the **truncating** side; `verify:schema` reads the ceiling from a real DB.
- **R-03** a host-keyed chokepoint scan pulls the bundle guard itself into an exception list. → the scan key is the **endpoint-constant identifier**; the bundle marker is the **host string** (Tasks H4, B1.2).
- **R-04** the CHECK-before-FK evaluation order is unverified. → measured at Task H6 on dev; the probe's shape adjusts, the gate is achievable either way.
- **R-07** a wrongly predicted CHECK name makes the migration a **silent** no-op. → Gate C closed 2026-08-29; H7 step 5 inserts and deletes a real `essay_grade` row on dev.
- **R-09** three double-declaration pairs drift. → one gate per pair: exhaustive `toEqual` (telemetry), DB-vs-file comparison (fingerprint), regex pin gate (attempt cap).
- **R-10** a prompt injection inflates a band. → six layers, split into deterministic CI (AC-069, Task H3) and a **real-provider controlled comparison** (AC-070, Task E3), re-run on every model change.
- **R-F1** a render branch reads `scored`/`isCorrect` and prints "Chưa chấm tự động" beside a fresh score. → **structural**: `EssayReviewBlock`'s props do not carry those fields (Task F-B1).
- **R-F2** a Server Component test renders an **empty tree** and its negative assertions pass against nothing. → `renderServerTree()` **plus** at least one positive assertion in every case.
- **Process** — an implementer "fixes" TD-030 inside a feature commit. → Gate F1's recorded baseline and F2's two-step discrimination procedure.

### Impact scope management

- **Allowed change scope**: the ~55 files enumerated in the work plan's Review Scope — backend 8 new + 20 modified, frontend 10 new + 15 modified, 3 test skeletons converted, 3 DDL groups applied by hand to two Supabase projects.
- **Preserved areas**: `ScoreCard.tsx` (0 diff), `wrongTwice.ts`, `schema.sql:1354`, `record_exam_result()`, the `exam_results` column DDL, `QuotaKind`/`PLAN_LIMITS`/`consumeQuota()` call sites, `TutorPromptInput.questionType`, `PublicQuestion`'s `Omit`, `buildTelemetryPayload()`'s body, the scored branch of `result/detail/page.tsx`, `ExamPlayer.test.tsx`, `RichText`, all `(layer4)` surfaces except the OQ-5 decision, and **`SOURCE/supabase/test-rls.ts`** (I-1 closed in favour of the runnable service lane; the shipped `S-b` case at `:1314-1320` stays where it is).

## Open Items still owned by the engineer

| Item | Where it must be resolved |
|---|---|
| **I-1** ✅ closed 2026-08-29 — the SQL proofs live in the **runnable** service lane | Task H8 |
| **I-2** ✅ closed 2026-08-29 — B1.5 is **two commits** with the boundary fixed by I004 | Task B1.5 |
| **I-3** — who owns `essayIncompleteLabel?` (boolean in B2.3, label in F-B3 — a **reading, not a stated decision**) | before Task F-B3 |
| **I-4** — which document owns `ExamResult.hasIncompleteEssay` (the plan follows the Interface Change Matrix) | before Task B2.1 |
| **I-5** — `EssaySummary`'s exact field set | at Task H1 |
| **I-6** — does `QuestionRenderer.test.tsx:112` move? (D-14's analysis is the one confirmed against the shipped prop shape) | at Task F-D1 |
| **I-7** — `npm run test:localdb` as a per-commit gate; the plan assumes option **(a)** | before the first commit |

## Notes on this task set

- **Phase completion checklists were not emitted as separate files.** The work plan's per-phase `#### Phase Completion Criteria` blocks are carried inside the relevant task files' Completion Criteria and in this overview's phase order; no separate `…-phase{n}-completion.md` files were generated, because the decomposition brief enumerated exactly the deliverables above.
- **The Final Phase's file is named `essay-auto-scoring-task-Final.md`** — the plan gives it no numeric ID.
- **Every task file carries its own Gate E4 verify table with empty exit-code cells**, per the plan's explicit instruction to the decomposer (Gate E, section E4). Rows 7 (`check:bundle`) and 8 (`verify:schema`) are added where the task's Files list matches Gate E2's or Gate E3's globs.
