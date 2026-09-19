# Task FQA-T3 — Success Criteria #5 confirmation: `rating.int.test.ts:317-440` unmodified

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T3**
Layer: cross-cutting (verification only — no source files changed)

Metadata:
- Dependencies: Phase 4 complete (P4-T3, the last task to touch this file)
- Blocks: none
- Size: Small (0 files; 1 diff check)
- Verification level: L2

## Implementation Content
Confirm Success Criteria #5 — `rating.int.test.ts:317-440` passes unmodified (diff check against the pre-feature baseline).

## Target Files
- [x] None (verification-only task; no source files changed)

## Investigation Targets
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (`:317-440`, and by extension the wider `:319-457` range named elsewhere in the plan)
- `docs/plans/20260918-feature-exam-shelves.md` (§ Correctness Proof Method — "Success Criteria #5")
- `docs/plans/20260918-feature-exam-shelves.md` (P2-T4, P4-T3 — the two tasks that touch this file; both declare 0-diff obligations on this exact range)

## Investigation Notes

**Investigation Targets read**:
- `SOURCE/features/exams/__tests__/rating.int.test.ts` — read in full around lines 310-460 and 740-940. Confirms the current file still has the `describe("listExams — Hardest-sort and Level-filter query construction (Test 2)", ...)` block starting at line 319 and the `dir`-without-`sort` describe block ending at line 457 — matching the plan's `:319-457` citation. The task title's `:317-440` sits fully inside this same describe range (line 317 is a trailing comment before the describe, line 440 is mid-block).
- `docs/plans/20260918-feature-exam-shelves.md` § Correctness Proof Method (line 22): "the flat-grid path keeps its code, and `rating.int.test.ts:319-457` passing **unmodified** is the proof it did (Success Criteria #5)."
- `docs/plans/20260918-feature-exam-shelves.md` P2-T4 (line 434) and P4-T3 (line 471): both declare 0-diff obligations on this exact range; P4-T3's own "Done" note records `git diff -U0` showing the first hunk starting after the pre-existing content, 0 changes through the append point.

**Baseline commit identification**: first exam-shelves commit is `5267fd9` ("docs(exam-shelves): PRD, ADR, UI spec, design docs, work plan và task breakdown"). Pre-feature baseline = its parent, confirmed via `git rev-parse 5267fd9^`:
```
f3de797e6846cf6bfdc46f8ad036b7828e29fea8  (feat(ads): thêm script Google AdSense vào root layout)
```

**Diff check performed** (working tree confirmed clean via `git status --short` before diffing):
```
git diff --stat f3de797e6846cf6bfdc46f8ad036b7828e29fea8..HEAD -- SOURCE/features/exams/__tests__/rating.int.test.ts
 SOURCE/features/exams/__tests__/rating.int.test.ts | 195 +++++++++++++++++++++
 1 file changed, 195 insertions(+)
```
0 deletions, 0 modifications — only insertions. Hunk headers via `git diff -U0`:
```
@@ -746,0 +747,195 @@ describe("listExams — q lọc theo tên qua cột title_search (ADR-0020)", ()
```
Single hunk, pure append starting after original line 746 (i.e., after all pre-existing content, including the entire 317-457/319-457 range). This is P4-T3's committed candidate-3 block plus its header comments.

Cross-checked with a direct content diff: dumped the baseline blob (`git show f3de797e6846cf6bfdc46f8ad036b7828e29fea8:SOURCE/features/exams/__tests__/rating.int.test.ts`) to a temp file and ran `git diff --no-index` against the current working-tree file — confirmed the only diff is the append after line 744/746; lines 1-746 (which fully contains 317-457/319-457) are byte-identical.

**Conclusion**: 0 diff in the named range — the plan's headline correctness proof holds. No accidental drift from P2-T4 or P4-T3 (or any other task) slipped through.

**Vitest run**:
```
npx vitest run features/exams/__tests__/rating.int.test.ts
 Test Files  1 passed (1)
      Tests  31 passed (31)
```
All 31 cases pass, including the 319-457 range's pre-existing cases and P4-T3's new candidate-3 cases appended after line 746.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Identify the pre-feature baseline commit/ref to diff against (the branch point before this feature's first commit) — `f3de797e6846cf6bfdc46f8ad036b7828e29fea8`, the parent of `5267fd9` (the feature's first commit)
### 2. Green Phase
- [x] Run `git diff <base>..HEAD -- SOURCE/features/exams/__tests__/rating.int.test.ts` restricted to lines 317-440 (or the tool-appropriate equivalent) and confirm 0 changes — confirmed via `--stat` (0 deletions/modifications, only insertions) and hunk-header check (single hunk, pure append after original line 746)
- [x] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and confirm this range's cases pass — 31/31 passed
### 3. Refactor Phase
- [x] N/A — this task changes no source files

## Operation Verification Methods
- **Verification method**: `git diff` against the pre-feature baseline, restricted to `rating.int.test.ts:317-440`; `npx vitest run` for the full file.
- **Success criteria**: 0 diff in the named range; the file's full suite passes (including the P4-T3-added block outside this range).
- **Failure response**: if a diff is found in this range, this is a direct violation of the plan's headline correctness proof — trace which task touched it and why, and determine whether the touch was accidental (must be reverted) or a legitimate scope change that was never approved.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (Success Criteria #5, the plan's headline regression proof): `rating.int.test.ts:317-440` (part of the wider `:319-457` range) is unmodified by this entire feature end-to-end.
  - **Primary failure mode**: an accumulation of small, individually-justified edits across P2-T4 and P4-T3 that each claimed 0-diff on their own but collectively drifted this range — this task is the final, whole-feature check that no drift slipped through despite each task's own local proof.
  - **Boundary to exercise**: static diff against the pre-feature baseline (the strongest form of this proof — stronger than "tests still pass", which could pass even if assertions were edited to match new behavior).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none — this is the plan's own designated final confirmation of its headline claim.

## Completion Criteria
- [x] `git diff` against the pre-feature baseline confirms 0 changes to `rating.int.test.ts:317-440`
- [x] `npx vitest run features/exams/__tests__/rating.int.test.ts` passes in full

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
