# Work Plan: Short-Answer Scoring Implementation

Created Date: 2026-08-02
Type: feature
Estimated Duration: 3-4 days (solo engineer, pre-launch, no deadline pressure per both Design Docs' External Resources Used)
Estimated Impact: 11 files (5 backend, 3 frontend, 3 test/skeleton conversions) + 1 already-amended ADR
Related Issue/PR: N/A (Medium-scale feature, no PRD; substitute source `requirement_analysis`, reproduced in both Design Docs' Agreement Checklists)
Review Scope: fresh pre-implementation plan — planned-files scope derived from the Design Docs' Implementation Path Mapping and this plan's task targets:
- Backend: `SOURCE/lib/scoring/computeScore.ts`, `SOURCE/lib/scoring/__tests__/computeScore.test.ts`, `SOURCE/app/(layer2)/actions.ts`, `SOURCE/app/(layer2)/__tests__/submitExam.int.test.ts`, `SOURCE/types/result.ts`, `SOURCE/scripts/dev-status.mjs`
- Frontend: `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx`, `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx`, `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx`
- E2E: `SOURCE/tests/e2e/fixture/short-answer-scoring.fixture.e2e.test.ts`
- Already applied (no task, prerequisite): `docs/adr/ADR-0005-multi-part-national-exam-format.md` (2026-08-01 amendment)

## Related Documents
- Design Doc(s):
  - `docs/design/short-answer-scoring-backend-design.md` (v1.1, approved_with_conditions — 2 remaining minor recommended conditions, folded into Task 1.2 below: `dev-status.mjs` stale pipeline-banner strings; `actions.ts:68` stale-date comment)
  - `docs/design/short-answer-scoring-frontend-design.md` (approved_with_conditions — 1 minor citation-precision condition, non-blocking: this doc's header/References cite the backend Design Doc as "v1.0, Draft" when the current version is v1.1 — folded into the Final Phase's documentation-update task)
- ADR: `docs/adr/ADR-0005-multi-part-national-exam-format.md` (Proposed, amended 2026-08-01 — prerequisite; amendment already applied prior to this plan)
- PRD: N/A — Medium-scale feature, no PRD per project scale rules
- UI Spec: `docs/ui-spec/short-answer-scoring-ui-spec.md` (v1.0, approved)

## Verification Strategy (from Design Docs)

### Correctness Proof Method — Backend
- **Correctness definition**: (1) for `short_answer`, `isCorrect` matches the engineer-confirmed matching rule (normalized text match; numeric equivalence tolerant of comma/dot-decimal and trailing zeros) on literal, independently-authored fixture values; (2) `mcq`/`true_false`/`essay` scoring results are byte-identical to the pre-change implementation (regression).
- **Verification method**: Vitest unit tests in `computeScore.test.ts` with literal expected values (testing-principles' "Literal Expected Values").
- **Verification timing**: before the change is considered complete — `npm test` (vitest run) must pass with zero regressions in the existing `mcq`/`true_false`/`topicBreakdown` describe blocks, all new/updated `short_answer`/`essay` assertions green, and the new `submitExam.int.test.ts` (SA-BE-012) passing.

### Correctness Proof Method — Frontend
- **Correctness definition**: (1) rendered "Your answer"/"Correct answer" lines and colors match the UI Spec's Sub-states table exactly (AC-001–005); (2) `essay`'s not-scored rendering and `true_false`'s rendering (both files) remain byte-identical (AC-007, AC-009); (3) the status chip requires zero code change (AC-006); (4) the `QuestionRenderer` footnote reads the new copy for `short_answer` only (AC-008).
- **Verification method**: primarily manual/Playwright MCP smoke verification against a locally seeded attempt, supplemented by `QuestionRenderer.test.tsx` (RTL/jsdom) for the footnote regression guard and the `short-answer-scoring.fixture.e2e.test.ts` fixture-e2e journey for the full display-correctness claim.
- **Verification timing**: `next build` (type-check) and `eslint` pass with zero errors; the manual/Playwright golden-state check (UI Spec Visual Acceptance, Golden States 1–5) is performed once the backend change is also live in the local dev environment (the new branch is otherwise unreachable).

### Early Verification Point — Backend
- **First verification target**: the private `isShortAnswerCorrect`/`parseShortAnswerNumber` functions in isolation, against the exact engineer-confirmed example set (`'1,04'`, `'1.04'`, `'1.040'` all equal; `'1.05'` not equal).
- **Success criteria**: all three representations evaluate as equal via `isShortAnswerCorrect`, and a distinct value evaluates as not equal.
- **Failure response**: if the exact-example set does not hold, reassess the normalization approach before wiring the matcher into `isScored`/`computeScore` — do not proceed to the `actions.ts` fix with an unverified matcher.

### Early Verification Point — Frontend
- **First verification target**: Golden State 3 ("Scored `short_answer` — skipped") — smallest surface, exercises both the "— skipped —" text fallback and the muted color class, no correct/incorrect fixture needed.
- **Success criteria**: "Your answer" line shows exactly "— skipped —" in `text-muted-foreground`; "Correct answer" line shows the question's `essayAnswer` in fern.
- **Failure response**: if the skipped state does not render correctly, do not proceed to verifying Golden States 1–2 — first confirm the `isShortAnswer` guard and `status.cls` reuse are wired correctly.

### Proof Strategy
- **Proof obligation source**: test skeleton annotations (`Primary failure mode` / `Proof obligation` comments) in `submitExam.int.test.ts`, `QuestionRenderer.test.tsx`, and `short-answer-scoring.fixture.e2e.test.ts` for integration/e2e claims; each SA-BE/AC item's primary failure mode (as documented in the backend/frontend Design Docs' Fact Disposition and Risks and Mitigation tables) for unit-level claims not covered by a generated skeleton (`computeScore.ts`'s scoring branch and `isScored` guard).
- **Per-task propagation**: every task below that implements a claim (SA-BE-* or AC-*) records its Proof Obligations so downstream review can judge whether the tests prove the claim, not merely that they run.

## Quality Assurance Mechanisms (from Design Docs)

| Mechanism | Enforces | Config Location | Covered Files |
|-----------|----------|-----------------|---------------|
| ESLint | Lint rules | `SOURCE/eslint.config.mjs` | project-wide |
| `tsc`/type-check via `next build` | Static typing (strict mode) | `SOURCE/tsconfig.json` | project-wide |
| `vitest run` | Unit/integration-test correctness | `SOURCE/vitest.config.ts` (`include: lib/**, components/**, app/**`) | `SOURCE/lib/scoring/__tests__/computeScore.test.ts`, `SOURCE/app/(layer2)/__tests__/submitExam.int.test.ts`, `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` (primary correctness-proof mechanism for the backend slice) |
| `next build` | Production build succeeds | `SOURCE/package.json` (`"build": "next build"`) | project-wide |
| `questions.question_type CHECK IN ('mcq','essay','true_false','short_answer')` | Valid enum value | `SOURCE/supabase/schema.sql:440-442` | `public.questions` (already satisfied — no widening needed) |
| Manual/Playwright MCP smoke verification | Visual/behavioral correctness of the 5 golden states | `.mcp.json` (`playwright` MCP server) | `/exams/[id]/attempt/[attemptId]/result/detail`, exam player short-answer input (primary correctness-proof mechanism for the frontend slice until the fixture-e2e test is live — this plan promotes it to an automated check via Task 1.6) |

Noted but not adopted for this change (recorded, not silently skipped): RLS verification harness (`SOURCE/supabase/test-rls.ts`) — no RLS/schema/access-control boundary touched; Playwright E2E harness proper — project is at "Pha 1", Playwright MCP interactive sessions are the available mechanism until a committed harness exists (matches the fixture-e2e skeleton's own Harness note).

## Design-to-Plan Traceability

| Design Doc | DD Section | DD Item | Category | Covered By Task(s) | Gap Status | Notes |
|---|---|---|---|---|---|---|
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope | Add dedicated `short_answer` branch to `computeScore()`'s per-question dispatch | impl-target | Phase 1 Task 1.2 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope | Extend `isScored()` with a `short_answer` ground-truth-presence guard | impl-target | Phase 1 Task 1.2 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope | Fix `submitExam()`'s questions `SELECT` + row-to-`Question` mapping (`essay_answer`/`essayAnswer`) | contract-change | Phase 1 Task 1.2 | covered | Must land in same commit as the computeScore.ts branch per Technical Dependencies step 3 |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope | Update header/doc comment in `computeScore.ts` (lines 8-15), including the true_false date correction | impl-target | Phase 1 Task 1.2 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope | Split `computeScore.test.ts`'s stale describe block (new `essay()` helper + regression test; rewritten `short_answer`-scored block) | verification | Phase 1 Task 1.1 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope / Fact Disposition `topicBreakdown-q3-callsite` | Fix pre-existing `topicBreakdown` describe block's `q3` call site to `shortAnswer("q3","Topic C", undefined)` | verification | Phase 1 Task 1.1 | covered | Must land in same task as the `shortAnswer()` helper's new 3rd parameter |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope / Fact Disposition `submitExam-select-test-gap` | Add `SOURCE/app/(layer2)/__tests__/submitExam.int.test.ts` (required scope, SA-BE-012) | verification | Phase 1 Task 1.3 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Agreement Checklist Scope / Prerequisite ADRs | Amend `docs/adr/ADR-0005-multi-part-national-exam-format.md` | prerequisite | (already applied, no task) | covered | Done alongside the Design Doc, prior to this plan |
| docs/design/short-answer-scoring-backend-design.md | Implementation Path Mapping | `types/result.ts` stale scored-semantics doc comment (lines 14-15) | contract-change | Phase 1 Task 1.4 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Approval condition (recommended, minor) | `SOURCE/scripts/dev-status.mjs` stale pipeline-banner strings | prerequisite | Phase 1 Task 1.2 | covered | |
| docs/design/short-answer-scoring-backend-design.md | Approval condition (recommended, minor) | `actions.ts:68` stale-date comment | prerequisite | Phase 1 Task 1.2 | covered | Same header block already edited by the select-fix task |
| docs/design/short-answer-scoring-backend-design.md | Minimal Surface Alternatives | Confirms no new lib/ file, no new column, no new prop — matcher stays private/co-located in `computeScore.ts` | impl-target | Phase 1 Task 1.2 | covered | Design constraint honored by task scope, not a separate deliverable |
| docs/design/short-answer-scoring-backend-design.md | Field Propagation Map | `essay_answer` (DB) → `essayAnswer` (Question) crossing; not a custom-encoded boundary | contract-change | Phase 1 Task 1.2, Phase 1 Task 1.3 | covered | See Connection Map |
| docs/design/short-answer-scoring-backend-design.md | Security Considerations | `essay_answer` stays server-only; `PublicQuestion` Omit unaffected | verification | Final Phase (security review task) | covered | No new code path — regression-only check |
| docs/design/short-answer-scoring-backend-design.md | Error Handling | Numeric-vs-text fallback is a designed rule, not error recovery; matcher never throws | verification | Phase 1 Task 1.1, Phase 1 Task 1.2 | covered | SA-BE-005 test case |
| docs/design/short-answer-scoring-frontend-design.md | Agreement Checklist Scope | Add `questionType === 'short_answer'` sub-branch to `ResultDetailPage`'s scored branch | impl-target | Phase 1 Task 1.5 | covered | |
| docs/design/short-answer-scoring-frontend-design.md | Agreement Checklist Scope | Update `QuestionRenderer.tsx`'s `short_answer` footnote string | impl-target | Phase 2 Task 2.1 | covered | Sequenced after Phase 1 per TBD-05 |
| docs/design/short-answer-scoring-frontend-design.md | Main Components (TBD-04 resolution) | Reuse `status.cls` local variable for "Your answer" color instead of a new helper/token | impl-target | Phase 1 Task 1.5 | covered | |
| docs/design/short-answer-scoring-frontend-design.md | Technical Dependencies and Implementation Order (TBD-05) | Footnote copy change must not ship before the backend auto-scoring change | prerequisite | Phase 2 (phase-ordering constraint) | covered | Enforced by phase sequencing, not a code change |
| docs/design/short-answer-scoring-frontend-design.md | Test Boundaries / Integration Verification Points | Recommended `QuestionRenderer.test.tsx` regression guard | verification | Phase 2 Task 2.2 | covered | |
| docs/design/short-answer-scoring-frontend-design.md | Test Boundaries / Integration Verification Points | Recommended `page.tsx` display-correctness test (Playwright/RTL follow-up) | verification | Phase 1 Task 1.6 (fixture-e2e) | covered | Fulfilled via the fixture-e2e journey instead of a dedicated RTL test, per this generation's test-skeleton allocation |
| docs/design/short-answer-scoring-frontend-design.md | State Transitions and Invariants | `ScoredCorrect`/`ScoredWrong`/`ScoredSkipped` mutually exclusive and exhaustive once `Dispatch` entered | verification | Phase 1 Task 1.5, Phase 1 Task 1.6 | covered | |
| docs/design/short-answer-scoring-frontend-design.md | Security Considerations | No new injection surface; `essayAnswer`/`selected` rendered as plain text, not `dangerouslySetInnerHTML` | verification | Final Phase (security review task) | covered | |
| docs/ui-spec/short-answer-scoring-ui-spec.md | Non-Scope / TBD-02, TBD-03 | Pre-existing `true_false` blank-render bug and stale footnote — explicitly out of scope | N/A | N/A | gap (intentional) | Backlog items, not part of this feature's scope; explicitly must not be fixed or worsened while editing the same files (regression guard only, no task) |

## Reference Contract Values

| Design Doc (§ Section) | Contract Type | Required Observable Value (verbatim) | Covered By Task(s) |
|---|---|---|---|
| docs/ui-spec/short-answer-scoring-ui-spec.md (§ Component: ResultDetailPage) | derived-display | "`<answerColorClass>` is `text-[#4F7942]` (fern) when `r.isCorrect`, `text-destructive` when `!r.isCorrect && r.selected`, `text-muted-foreground` when `!r.isCorrect && !r.selected` (skipped) — the exact same three-way rule the status chip immediately above already uses." | Phase 1 Task 1.5 |
| docs/ui-spec/short-answer-scoring-ui-spec.md (Decisions Record D1) | derived-display | "the scored `short_answer` sub-branch always renders two lines — 'Your answer: `<text>`' and 'Correct answer: `<text>`' — regardless of whether the two values are identical (i.e., even in the correct case, both lines render, showing the same text twice)." | Phase 1 Task 1.5 |
| docs/ui-spec/short-answer-scoring-ui-spec.md (Decisions Record D2) | derived-display | "the not-scored branch... keeps the label 'Stored answer:'... The new scored `short_answer` sub-branch uses the label 'Correct answer:'" — label change scoped strictly to the new branch's own JSX. | Phase 1 Task 1.5 |
| docs/ui-spec/short-answer-scoring-ui-spec.md (Decisions Record D3) | state-lifecycle-negative | "the correct-answer text for `short_answer` is read from `q.essayAnswer`... `PerQuestionResult.correct`... is typed `ChoiceId` and is documented as 'CHỈ câu mcq' (MCQ only) — it must not be read for `short_answer`." | Phase 1 Task 1.5, Phase 1 Task 1.6 |
| docs/design/short-answer-scoring-backend-design.md (§ Acceptance Criteria, SA-BE-006) | state-lifecycle-negative | "If a `short_answer` question's stored `essayAnswer` is `undefined`, `null`, or blank/whitespace-only, then the system shall mark that question `scored: false` regardless of the submitted answer, and exclude it from `total`/`correct`/`topicBreakdown` while retaining it in `perQuestion`." | Phase 1 Task 1.1, Phase 1 Task 1.2 |
| docs/ui-spec/short-answer-scoring-ui-spec.md (§ Component: QuestionRenderer) | derived-display | Footnote copy change — Before: "Short answer — stored, not auto-scored yet." After: "Short answer — auto-scored after you submit." | Phase 2 Task 2.1, Phase 2 Task 2.2 |
| docs/ui-spec/short-answer-scoring-ui-spec.md (§ Component: QuestionRenderer, AC-009 guard) | state-lifecycle-negative | `true_false` footnote must stay exactly "True/False — stored, not auto-scored yet."; `essay` footnote must stay exactly "Essay question — answer on paper. Stored, not auto-scored yet." — "any diff there is out of scope and must be reverted." | Phase 2 Task 2.2 |

## Failure Mode Checklist

| Category | Applies? | Covered By Task(s) |
|---|---|---|
| same-value | yes | Phase 1 Task 1.1 (SA-BE-001 byte-for-byte exact match case) |
| no-op | yes | Phase 1 Task 1.2 (computeScore.ts branch + actions.ts fix must land in the same commit — landing one without the other is a silent production no-op, DD's own named top-2 risk), Phase 1 Task 1.3 (submitExam.int.test.ts closes the detection gap) |
| empty input | yes | Phase 1 Task 1.1 (SA-BE-006 blank/missing ground truth, SA-BE-007 unanswered submission) |
| invalid option | no | Not applicable — `short_answer` accepts free text, no enum/selection validation on the submitted value |
| missing config | no | Not applicable — no new config, env var, or feature flag introduced |
| unavailable boundary | yes | Phase 1 Task 1.2 (Supabase select failure — existing `throw` convention, unchanged), Phase 1 Task 1.5 (`q?.essayAnswer || "—"` fallback when ground truth is defensively absent) |
| shared-state dependency | yes | Phase 1 Task 1.5 (the new "Your answer" line reuses the same `status.cls` local variable already computed for the header status chip — TBD-04; both render sites must stay derived from the one shared computation) |
| rollback-only visibility | no | Not applicable — no backfill/rollback/undo path exists in this feature (already-persisted rows keep their original `scored:false` forever, by design, not via a rollback mechanism) |
| missing-sort-key ordering | yes | Phase 1 Task 1.1 (pre-existing `topicBreakdown` describe block's exact-2-entry, first-appearance-order assertion is at risk of a silent 3rd unplanned entry from `shortAnswer()`'s new default parameter — SA-BE-011) |

## UI Spec Component → Task Mapping

| UI Spec Component (section heading) | States to Cover | Covered By Task(s) | Gap Status | Notes |
|---|---|---|---|---|
| Component: ResultDetailPage (per-question review card, scored branch) | scored-correct, scored-wrong-with-answer, scored-skipped, not-scored (essay; unaffected regression baseline), unsupported (pre-feature bug, now fixed) | Phase 1 Task 1.5 (implementation), Phase 1 Task 1.6 (fixture-e2e verification of all 3 scored sub-states + essay regression) | covered | |
| Component: QuestionRenderer (short_answer footnote copy) | default (static string; no loading/empty/error/partial states apply) | Phase 2 Task 2.1 (implementation), Phase 2 Task 2.2 (regression-guard test covering short_answer/true_false/essay footnotes) | covered | |

## ADR Bindings

| ADR | Source Section | Axis | Binding Decision | Covered By Task(s) |
|---|---|---|---|---|
| docs/adr/ADR-0005-multi-part-national-exam-format.md | Decision | persistence | `short_answer`'s ground truth is stored in the existing `essay_answer` column ("the model answer as text"); no new column is added for this feature. | Phase 1 Task 1.2, Phase 1 Task 1.3 |
| docs/adr/ADR-0005-multi-part-national-exam-format.md | Amendment — 2026-08-01 (amends Decision) | data_flow | `short_answer` auto-scoring must follow the same ground-truth-presence-guard dispatch pattern already established for `mcq`/`true_false` (`isScored()` per-type gate) rather than introduce a new dispatch mechanism. | Phase 1 Task 1.2 |
| docs/adr/ADR-0005-multi-part-national-exam-format.md | Decision | contract_schema | `questions.question_type` enum includes `'short_answer'` (already CHECK-constrained); this feature completes behavior for an already-existing enum value, it does not widen the schema. | Phase 1 Task 1.2 |

## Connection Map

| Boundary | Owner (left side) | Owner (right side) | Serialized Format | Consumer Parse Rule | Expected Signal | Covered By Task(s) |
|---|---|---|---|---|---|---|
| `submitExam()` server action → `public.questions` (Supabase Postgres) | `SOURCE/app/(layer2)/actions.ts` `submitExam()` | `public.questions` table (Supabase/Postgres, separate process) | SQL `.select(...)` column-list string — must include `"essay_answer"` alongside the 8 pre-existing columns | Row-to-`Question` mapping: `essayAnswer: (r.essay_answer as string \| null) ?? undefined` | `submitExam.int.test.ts` asserts the mocked select-call string includes `"essay_answer"` and that the resulting `Question[]` has `essayAnswer` correctly mapped (incl. null→undefined) | Phase 1 Task 1.2 (producer/fix), Phase 1 Task 1.3 (consumer-side proof) |

## Objective

Ship automatic scoring for `short_answer` questions end-to-end: `computeScore()` gains a dedicated matching branch (normalized text + numeric equivalence), `submitExam()`'s questions fetch is fixed so the ground truth (`essay_answer`) actually reaches the scorer in production, and `ResultDetailPage`/`QuestionRenderer` are updated so students see correct, correctly-colored results instead of the current blank render. Backend and frontend Design Docs are `approved_with_conditions`; all conditions are folded into this plan's tasks (see Related Documents).

## Background

`computeScore.ts` currently forces `short_answer` to `scored: false` unconditionally, mirroring the same gap `true_false` had until commit `f1e665093` (2026-07-27). Separately, even once the scorer is fixed, `submitExam()`'s questions `SELECT` never fetches `essay_answer`, so the ground truth never reaches production regardless of matcher correctness — both gaps must close in the same change set. On the display side, `ResultDetailPage`'s scored branch has no `short_answer` dispatch at all and blank-renders an empty `<ul>` once the backend starts producing `scored: true` rows. `docs/adr/ADR-0005-multi-part-national-exam-format.md` was amended 2026-08-01 to retroactively document `true_false`'s auto-scoring and prospectively document this feature's `short_answer` auto-scoring, closing a governance gap that had already gone stale once silently.

## Risks and Countermeasures

### Technical Risks
- **Risk**: Landing `computeScore.ts`'s branch without `actions.ts`'s select+mapping fix (or splitting them across separate commits/PRs) is a silent no-op in production.
  - **Impact**: Feature appears shipped but does nothing — `essayAnswer` stays `undefined`, `isScored()`'s guard always fails closed.
  - **Countermeasure**: Task 1.2 requires both files in the same commit (backend DD's own top-2 named risk); Task 1.3's `submitExam.int.test.ts` proves the select-string is correct, closing the one gap `computeScore.test.ts`'s pure-unit fixtures cannot detect.
- **Risk**: Incorrect numeric-vs-text branch selection silently misgrades a student.
  - **Impact**: High — shifts the score denominator and topic breakdown for any exam containing PHẦN III questions.
  - **Countermeasure**: Early Verification Point (backend) unit-tests the exact engineer-confirmed example set before wiring into `computeScore`; ambiguous multi-separator strings explicitly fall back to text-exact comparison (SA-BE-005), not a guess.
- **Risk**: The pre-existing `topicBreakdown` describe block's `q3` call site silently breaks once `shortAnswer()`'s new default parameter makes it `scored:true`.
  - **Impact**: High — blocks `npm test`; found only by document-reviewer in the backend DD's revision history, not the original design pass.
  - **Countermeasure**: Task 1.1 explicitly updates the call site to `shortAnswer("q3", "Topic C", undefined)` in the same task that adds the new default parameter.
- **Risk**: Editing `page.tsx`'s multi-branch scored function accidentally touches the untouched `mcq`/`true_false`/not-scored rendering.
  - **Impact**: Medium — regression in already-shipped correctness display.
  - **Countermeasure**: Task 1.5 scopes the diff to a pure `if`/`else` wrapper around the existing, unmodified `<ul>` map; Task 1.6's fixture-e2e Test 2 asserts essay's not-scored branch renders byte-identical.
- **Risk**: `QuestionRenderer.tsx`'s footnote copy ships before the backend `short_answer` auto-scoring change is live.
  - **Impact**: Medium — misleads students mid-exam about scoring behavior that isn't live yet (UI Spec TBD-05).
  - **Countermeasure**: Phase 2 is explicitly sequenced after Phase 1; the footnote task is never scheduled ahead of the backend change.

### Schedule Risks
- **Risk**: Solo-engineer, pre-launch project — no external schedule pressure, but sequencing mistakes (Phase 2 shipping before Phase 1) are the main schedule-adjacent risk.
  - **Impact**: Low (no live users, no deployment downtime) but would require a revert.
  - **Countermeasure**: Phase ordering in this plan encodes TBD-05 directly; Phase 2 cannot start before Phase 1's Completion Criteria are met.

## Implementation Phases

### Phase 1: Short-Answer Scoring Core — Backend Engine + Data-Fetch Fix + Result-Detail Display (Estimated commits: 5)

**Purpose**: Deliver the feature's primary observable capability end-to-end in one vertical slice: `computeScore()`'s new scoring branch, `submitExam()`'s `essay_answer` fetch fix (which must land in the same commit as the branch), and `ResultDetailPage`'s new `short_answer` scored display — proving backend and frontend compose correctly before the smaller, sequenced footnote-copy slice (Phase 2).

**Verification**: Early Verification Point (backend) — `isShortAnswerCorrect`/`parseShortAnswerNumber` against the exact engineer-confirmed example set, before wiring into `isScored`/`computeScore`.

#### Tasks

- [x] **Task 1.1 — RED: split stale describe block, fix `topicBreakdown` q3 call site, author `short_answer`/`essay` unit tests**
  - Implementation: In `SOURCE/lib/scoring/__tests__/computeScore.test.ts` — add a new `essay()` helper (mirrors `shortAnswer()`/`trueFalse()` shape, `questionType: "essay"`, no `essayAnswer`); split the `"computeScore — short_answer/essay vẫn KHÔNG auto-scored"` describe block into (a) a new `essay`-only regression test (SA-BE-010: `scored: false` unconditionally) and (b) a rewritten `short_answer`-scored describe block covering SA-BE-001 (exact match), SA-BE-002 (numeric equivalence: `'1,04'`/`'1.04'`/`'1.040'` all equal), SA-BE-003 (genuine mismatch), SA-BE-004 (case/whitespace-only difference), SA-BE-005 (ambiguous multi-separator falls back to text), SA-BE-006 (missing/blank `essayAnswer` → `scored:false`), SA-BE-007 (unanswered → `scored:true`, `isCorrect:false`); extend `shortAnswer()`'s signature additively to `shortAnswer(id, topic = "Topic C", essayAnswer: string | undefined = "1260")`; update the **pre-existing** `topicBreakdown` describe block's `q3` call site (line 129) from `shortAnswer("q3", "Topic C")` to `shortAnswer("q3", "Topic C", undefined)` in this same task, so the block's existing exact-2-entry assertion (SA-BE-011) is not silently broken by the new default parameter.
  - Proof Obligations: SA-BE-001–007 (new/rewritten), SA-BE-009 (true_false regression unaffected by the helper change), SA-BE-010 (essay), SA-BE-011 (topicBreakdown exact-2-entry assertion preserved) — each asserted via literal, independently-authored expected values (testing-principles).
  - Primary failure mode guarded: `shortAnswer()`'s new non-blank default parameter silently making the unrelated `topicBreakdown` block's `q3` fixture `scored:true`, adding an unplanned 3rd entry.
  - Files: `SOURCE/lib/scoring/__tests__/computeScore.test.ts`
  - Completion: Implementation Complete = new/updated tests written and fail for the right reason against the current (pre-Task-1.2) implementation; Quality Complete = lint/type-check pass on the test file; Integration Complete = N/A (test-file-only change, no production code touched yet).

- [ ] **Task 1.2 — GREEN: `computeScore.ts` short_answer branch + `isScored()` guard + `actions.ts` select/mapping fix (same commit) + fold in both backend approval conditions**
  - Implementation:
    - `computeScore.ts`: add private `isShortAnswerCorrect(expected, submitted)`, `parseShortAnswerNumber`, `normalizeShortAnswerText`; extend `isScored()` with `if (type === "short_answer") return Boolean(q.essayAnswer?.trim());` before the final `return false`; add a dedicated `short_answer` branch in `computeScore()`'s per-question dispatch, between the existing `true_false` branch and the generic `mcq` fallthrough, calling the new matcher against `q.essayAnswer` (never `q.correctAnswer`).
    - `computeScore.ts` header comment (lines 8-15): append a `short_answer re-enable 2026-08-01` clause under the same `v2.1 (ADR-0005)` umbrella label; correct the inherited `true_false re-enable 2026-07-21` date to `2026-07-27` (git-log-verified, per ADR-0005's amendment).
    - `actions.ts`: append `essay_answer` to `submitExam()`'s questions `.select(...)` string (additive, after `sub_answers`); add `essayAnswer: (r.essay_answer as string | null) ?? undefined,` to the row-to-`Question` mapping, immediately after `subAnswers`.
    - **Approval condition 1 (fold-in)**: `actions.ts:68`'s stale comment "chấm (v2.1 true_false auto-scored, 2026-07-21)" → correct to "2026-07-27", in the same edit pass since it sits in the comment block directly above the `.select(...)` call being modified.
    - **Approval condition 2 (fold-in)**: `SOURCE/scripts/dev-status.mjs` lines 54-55 — update the "Pipeline: Auto-scoring" banner text from "computeScore() pure — mcq + true_false auto-scored; short_answer/essay: stored, not auto-scored" to reflect `short_answer` now auto-scored (only `essay` remains "stored, not auto-scored").
  - **Hard sequencing rule**: the `computeScore.ts` branch and the `actions.ts` select+mapping fix land in this one commit — landing either half alone is a silent production no-op (backend DD's own top-2 named risk).
  - Proof Obligations: Task 1.1's tests turn GREEN; SA-BE-008/009 (mcq/true_false byte-identical regression) stay green throughout.
  - Files: `SOURCE/lib/scoring/computeScore.ts`, `SOURCE/app/(layer2)/actions.ts`, `SOURCE/scripts/dev-status.mjs`
  - Completion: Implementation Complete = branch + guard + select + mapping + both comment/string corrections done; Quality Complete = `vitest run` green with zero regressions, `tsc`/ESLint pass; Integration Complete = `computeScore()`'s new branch is reachable in production via `actions.ts`'s newly-fetched `essayAnswer` (proven by Task 1.3).

- [x] **Task 1.3 — Integration test: `submitExam.int.test.ts` (SA-BE-012, required scope)**
  - Convert the existing comment-only skeleton `SOURCE/app/(layer2)/__tests__/submitExam.int.test.ts` into an executable Vitest test using the sanctioned Supabase-client-mock boundary (pattern: `getResult.int.test.ts`/`rating.int.test.ts`).
  - Proof Obligations (from skeleton): (a) query-shape — mocked `.select(...)` call string includes `"essay_answer"` alongside the pre-existing 8 columns (`.includes("sub_answers")` also true, proving additive, not replacing); (b) mapping correctness, non-null — `essay_answer: "1260"` → `Question.essayAnswer === "1260"` via an independently-authored literal `toEqual`/`toMatchObject`; (c) mapping correctness, null — `essay_answer: null` → `essayAnswer === undefined` strictly (key present, `toBeUndefined()`), never `null`/coerced `""`; (d) regression guard — the 8 pre-existing mapped fields stay byte-identical.
  - Dependency: Task 1.2 (the fix must exist to assert against).
  - Files: `SOURCE/app/(layer2)/__tests__/submitExam.int.test.ts`
  - Completion: Implementation Complete = skeleton converted, all 4 proof obligations asserted and passing; Quality Complete = `vitest run` green; Integration Complete = closes the backend DD's own top-2 named risk (silent no-op undetectable by pure-unit tests).

- [ ] **Task 1.4 — `types/result.ts` doc-comment correction (lines 14-15)**
  - Update the stale "false = câu KHÔNG tính điểm (true_false/short_answer/essay ...)" comment to state that `true_false` and `short_answer` are now conditionally scored (ground-truth-presence-gated); only `essay` is unconditionally excluded. No field/type change.
  - Files: `SOURCE/types/result.ts`
  - Completion: Implementation Complete = comment corrected; Quality Complete = `tsc`/ESLint pass (no behavior change, doc-only); Integration Complete = N/A.

- [🔄] **Task 1.5 — Frontend: `ResultDetailPage`'s `short_answer` scored sub-branch (AC-001–006)**
  - Implementation: In `page.tsx`'s scored branch (lines 127-194), add a `questionType === 'short_answer'` sub-branch before the existing `q?.choices.map(...)` MCQ render. Reuse the already-computed `status.cls` local variable for the "Your answer" line's color (TBD-04 resolution — no new helper/token). Render exactly:
    ```tsx
    const isShortAnswer = q?.questionType === "short_answer";
    {isShortAnswer ? (
      <div className="flex flex-col gap-1 text-sm">
        <p className="text-muted-foreground">
          Your answer:{" "}
          <span className={status.cls}>{r.selected || "— skipped —"}</span>
        </p>
        <p className="text-muted-foreground">
          Correct answer:{" "}
          <span className="text-[#4F7942]">{q?.essayAnswer || "—"}</span>
        </p>
      </div>
    ) : (
      <ul className="flex flex-col gap-2">{/* unchanged MCQ rendering */}</ul>
    )}
    ```
    Source "Correct answer" from `q.essayAnswer` only — never `r.correct` (D3 invariant). Must not modify the not-scored branch (56-117), the status chip (118-126), or the MCQ map's content (AC-006/AC-007 regression guard).
  - Proof Obligations: AC-001 (`r.selected` displayed), AC-002 (`q.essayAnswer` displayed, never `r.correct`), AC-003 (fern when correct), AC-004 (destructive when wrong-with-answer, correct-answer line stays fern), AC-005 (muted "— skipped —" when wrong-and-unanswered) — see Reference Contract Values for exact color/label rules.
  - No ordering dependency on the backend change (dormant, degrades safely to the old blank render until `scored:true` rows exist) — included in this phase for early cross-slice integration verification via Task 1.6.
  - Files: `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx`
  - Completion: Implementation Complete = sub-branch added per the markup above [x] done; Quality Complete = ESLint/`tsc`/`next build` pass [x] done; Integration Complete = renders correctly once fed a `scored:true` `short_answer` `PerQuestionResult` (proven by Task 1.6) [ ] pending — manual/Playwright MCP live confirmation not executed in this run (no MCP/browser tool or confirmed seeded dev attempt in this execution context); code-level review confirms the guard/color/fallback logic matches the required states.

- [ ] **Task 1.6 — fixture-e2e: `short-answer-scoring.fixture.e2e.test.ts` (Test 1 + Test 2)**
  - Convert the existing comment-only skeleton `SOURCE/tests/e2e/fixture/short-answer-scoring.fixture.e2e.test.ts` into an executable test against the minimal Playwright-Page-compatible driver interface already established by `rating.fixture.e2e.test.ts` (structural subset: goto/url/getByRole/getByText/click/getAttribute/first/count); backend state (attempt, questions, exam_results) is fixture-driven, not live Supabase.
  - **Test 1 (reserved slot, AC-001–006)**: seed an attempt with 3 `short_answer` questions (correct via numeric equivalence, e.g. submitted `"1,04"` vs. stored `"1.04"`; genuinely wrong; skipped) + 1 `mcq` baseline → submit → result summary → "View details" → result detail; verify all 3 sub-states' text/color and the status chip per the UI Spec Sub-states table; verify no rendered value originates from `PerQuestionResult.correct` for any short_answer row.
  - **Test 2 (AC-007)**: essay regression — an essay question's card renders byte-identical via the unchanged not-scored branch ("Not auto-scored" chip in muted, "Stored answer:" label, no fern/destructive class anywhere in that card's subtree).
  - Dependency: Task 1.2 (backend scoring reachable) + Task 1.5 (frontend display implemented) — this is the composing integration point proving the vertical slice works end-to-end.
  - Files: `SOURCE/tests/e2e/fixture/short-answer-scoring.fixture.e2e.test.ts`
  - Completion: Implementation Complete = both tests converted and passing against fixture-driven state; Quality Complete = test run green; Integration Complete = Verification Level L1 (functional, end-user-visible operation) achieved for the combined backend+frontend slice.

#### Phase Completion Criteria
- [ ] Early Verification Point (backend) passed — exact numeric-equivalence example set confirmed as an actual Vitest assertion
- [ ] SA-BE-001–013 all satisfied (`computeScore.test.ts` + `submitExam.int.test.ts` green)
- [ ] AC-001–007 satisfied (`page.tsx` implementation + fixture-e2e Test 1/Test 2 green)
- [ ] `computeScore.ts` and `actions.ts` landed in the same commit — no silent no-op window
- [ ] Zero regression in `mcq`/`true_false`/`essay` scoring and rendering paths

### Phase 2: Exam Player Footnote Copy Update (Estimated commits: 2)

**Purpose**: Update `QuestionRenderer`'s `short_answer` footnote to reflect the now-live auto-scoring (AC-008), without disturbing the sibling `true_false`/`essay` footnotes (AC-009). Sequenced strictly after Phase 1 per UI Spec TBD-05 — this footnote must never ship before the backend change it describes is live.

**Verification**: manual/Playwright MCP smoke check (UI Spec Golden State 5) + `QuestionRenderer.test.tsx` regression guard.

#### Tasks

- [ ] **Task 2.1 — `QuestionRenderer.tsx` footnote copy fix (AC-008/AC-009)**
  - Update line 150's `short_answer` footnote string from `"Short answer — stored, not auto-scored yet."` to `"Short answer — auto-scored after you submit."`. Do not touch the `true_false` footnote (129-131), the `essay` footnote (156-160), or the `<input>`'s `maxLength`/`placeholder`/`onChange` wiring.
  - Sequencing constraint (not a code dependency): must not land before Phase 1's backend change is live.
  - Files: `SOURCE/app/(layer2)/_components/QuestionRenderer.tsx`
  - Completion: Implementation Complete = string updated exactly; Quality Complete = ESLint/`tsc` pass; Integration Complete = verified by Task 2.2.

- [ ] **Task 2.2 — Integration test: `QuestionRenderer.test.tsx` (AC-008/AC-009 regression guard)**
  - Convert the existing comment-only skeleton `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx` into an executable RTL/jsdom test (`// @vitest-environment jsdom` docblock convention, matching `RichText`'s test suite).
  - Proof Obligations (from skeleton): (a) `short_answer` footnote renders exactly `"Short answer — auto-scored after you submit."`, no match for "not auto-scored yet"; (b) `essay` footnote renders exactly the byte-identical pre-change string `"Essay question — answer on paper. Stored, not auto-scored yet."`; (c) `true_false` footnote renders exactly the byte-identical pre-change string `"True/False — stored, not auto-scored yet."`; (d) the `short_answer` `<input>`'s `maxLength="100"`, placeholder, and `onChange`→`onSelectAnswer` wiring are unaffected.
  - Files: `SOURCE/app/(layer2)/_components/__tests__/QuestionRenderer.test.tsx`
  - Completion: Implementation Complete = test converted, all 4 proof obligations asserted and passing; Quality Complete = `vitest run` green; Integration Complete = closes the "no automated test exists for either target file" gap named in the frontend DD's Risks and Mitigation.

#### Phase Completion Criteria
- [ ] AC-008/AC-009 satisfied
- [ ] `QuestionRenderer.test.tsx` green
- [ ] Manual/Playwright smoke check performed with both Phase 1 and Phase 2 live (UI Spec Golden State 5)

### Final Phase: Quality Assurance (Required) (Estimated commits: 1)

**Purpose**: Cross-cutting quality assurance and Design Doc consistency verification across both Design Docs and the UI Spec.

#### Tasks
- [ ] Verify all Design Doc acceptance criteria achieved: SA-BE-001–013 (backend) and AC-001–009 (frontend/UI Spec)
- [ ] Security review: confirm `essay_answer`/`essayAnswer` remain server-only (`PublicQuestion` Omit unaffected), no new injection surface on the frontend (plain-text rendering, not `dangerouslySetInnerHTML`), RLS/auth boundaries unchanged (no new entry point)
- [ ] Quality checks: ESLint, `tsc`/`next build` type-check, formatting — zero errors across all touched files
- [ ] Execute all tests: `computeScore.test.ts`, `submitExam.int.test.ts`, `QuestionRenderer.test.tsx`, `short-answer-scoring.fixture.e2e.test.ts` — zero failures
- [ ] Coverage: confirm no regression in existing coverage for `computeScore.ts`/`actions.ts` (diagnostic signal, not a gate — per testing-principles)
- [ ] Document updates:
  - [ ] Confirm `docs/adr/ADR-0005-multi-part-national-exam-format.md`'s amendment remains accurate post-implementation (dates, commit references)
  - [ ] **Frontend DD citation-precision fix (non-blocking approval condition)**: correct `docs/design/short-answer-scoring-frontend-design.md`'s citations of the backend Design Doc's version — currently reads "v1.0, Draft, code-verifier result: consistent, score 85" in the header table, Overview, Prior-Layer Verification Review, and References sections — update to reference v1.1 (the version actually approved and implemented)
  - [ ] Manual/Playwright MCP golden-state walkthrough performed once, covering all 5 Golden States from the UI Spec's Visual Acceptance section

### Quality Assurance
- [ ] Quality check (staged)
- [ ] All tests pass
- [ ] Static check pass
- [ ] Lint check pass
- [ ] Build success

## Completion Criteria
- [ ] All phases completed (Phase 1, Phase 2, Final Phase)
- [ ] All integration/E2E tests passing: `submitExam.int.test.ts`, `QuestionRenderer.test.tsx`, `short-answer-scoring.fixture.e2e.test.ts`
- [ ] Design Doc acceptance criteria satisfied: SA-BE-001–013, AC-001–009
- [ ] Staged quality checks completed (zero errors)
- [ ] All tests pass
- [ ] Both backend approval conditions resolved (dev-status.mjs, actions.ts:68) and the frontend citation-precision condition resolved
- [ ] User review approval obtained

## Progress Tracking
### Phase 1
- Start: TBD
- Complete: TBD
- Notes:

### Phase 2
- Start: TBD
- Complete: TBD
- Notes:

### Final Phase
- Start: TBD
- Complete: TBD
- Notes:

## Notes

- **E2E Gap Check**: fixture-e2e skeleton was provided (Test 1 reserved-slot journey covers AC-001–006; Test 2 covers AC-007) — no fixture-e2e gap. `e2eAbsenceReason.serviceE2e = "no_real_service_dependency"` was explicitly communicated — no service-integration-e2e lane is warranted (DB-persistence risk is already closed by `submitExam.int.test.ts`'s mock-boundary integration test, matching this project's established convention) — no gap warning required for either lane.
- **Test skeleton conversion discipline**: all three test skeleton files (`submitExam.int.test.ts`, `QuestionRenderer.test.tsx`, `short-answer-scoring.fixture.e2e.test.ts`) already exist on disk as comment-only skeletons (no imports, no runner syntax). Each implementing task (1.3, 1.6, 2.2) converts its skeleton to an executable Red→Green test in the same commit as the corresponding implementation — not as a deferred follow-up.
- **Phase ordering is a hard constraint, not a convenience grouping**: Phase 2 must not begin until Phase 1's Completion Criteria are met (UI Spec TBD-05).
