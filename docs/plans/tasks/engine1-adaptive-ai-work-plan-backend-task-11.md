# Task 11 (Backend): `lib/tutor/prompt.ts` (Work Plan Phase 3, Task 11)

Metadata:
- Dependencies: none
- Provides: `buildTutorPrompt()`, `TutorPromptInput`, `TUTOR_CALL_DEADLINE_MS`, consumed by backend-task-13 (`explainStep()`)
- Size: Small (3 files: `prompt.ts`, `constants.ts`, `prompt.test.ts`)

## Implementation Content

Implement `TutorPromptInput` (structurally answer-key-free — no field can hold `correct_answer`/`sub_answers`/`essay_answer`) and `buildTutorPrompt()` (pure string construction, Vietnamese Socratic-form instruction). Also `lib/tutor/constants.ts` (`TUTOR_CALL_DEADLINE_MS = 30_000`).

**This is this feature's own explicitly named top risk item** (backend DD Design Summary): the answer key reaching the tutor prompt is the single most important gate per PRD Success Criteria #8.

Convert `prompt.test.ts`'s 3 already-generated tests into real vitest tests:
- Test 1 (AC-018/019, 0 sentinel occurrences across an mcq/true_false/short_answer fixture battery, plus a positive assertion that `studentAnswer`/`questionContent` DO appear — proves the test isn't vacuous)
- Test 2 (AC-020 backend half, Socratic instruction literal present for all 3 question types)
- Test 3 (`@ts-expect-error` compile-time proof that `questionType: "essay"` is rejected by the type)

## Target Files
- [ ] `SOURCE/lib/tutor/prompt.ts` (new — `TutorPromptInput`, `buildTutorPrompt()`)
- [ ] `SOURCE/lib/tutor/constants.ts` (new — `TUTOR_CALL_DEADLINE_MS`)
- [ ] `SOURCE/lib/tutor/__tests__/prompt.test.ts` (fill in the existing skeleton's 3 tests)

## Investigation Targets
- `SOURCE/lib/tutor/__tests__/prompt.test.ts` (already generated — read in full: the TWO-LAYERED containment mechanism note in the header, all 3 tests' exact annotations, especially Test 1's sentinel technique and Test 3's `@ts-expect-error` requirement)
- `SOURCE/types/question.ts` (the full `Question` type — to know exactly which fields `TutorPromptInput` must structurally exclude)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/tutor/prompt.ts` — `buildTutorPrompt()`, `TutorPromptInput`, AC-018/019/020; § `lib/tutor/constants.ts` — `TUTOR_CALL_DEADLINE_MS`)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets, in particular the skeleton's full 3-test annotation set and the exact `Question` type's answer-key-bearing fields.
- [ ] Convert the 3 skeleton tests into real vitest tests: Test 1's per-questionType sentinel battery (independently-authored sentinel strings, e.g. `"SENTINEL-CORRECT-ANSWER-mcq"`), Test 2's fixed instruction-literal presence check, Test 3's `@ts-expect-error` line.
- [ ] Run the tests and confirm Test 1/2 fail (no implementation) and Test 3 fails to compile in the expected way (proving the `@ts-expect-error` line is meaningful, not accidentally already-passing).

### 2. Green Phase
- [ ] Implement `TutorPromptInput` — a type whose fields structurally cannot hold `correct_answer`/`sub_answers`/`essay_answer`, and whose `questionType` union excludes `"essay"`.
- [ ] Implement `buildTutorPrompt()` — pure string construction including `studentAnswer`, `questionContent`, and the fixed Vietnamese Socratic-form, answer-withholding instruction text for all 3 supported question types.
- [ ] Implement `constants.ts` with `TUTOR_CALL_DEADLINE_MS = 30_000`.
- [ ] Run `npx vitest run lib/tutor/__tests__/prompt.test.ts` — confirm all 3 pass (Test 3 passes by virtue of the `@ts-expect-error` line correctly flagging the expected compile error).

### 3. Refactor Phase
- [ ] Re-read the final `buildTutorPrompt()` implementation once more for any accidental interpolation of a field not present in the narrowed `TutorPromptInput` type (the exact failure mode Test 1 exists to catch at the call-site level, not just the type level).

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/tutor/`
- `check-ai-key-bundle.mjs` — Covered: `lib/tutor/` (directory-level; this specific file makes no external API call itself)

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/tutor/__tests__/prompt.test.ts` against the 3 tests, with particular attention to Test 1's 0-occurrence sentinel battery.
- **Success criteria**: `buildTutorPrompt()`'s output contains zero occurrences of literal answer-key fixture values across a battery of crafted inputs (Verification Strategy's backend correctness definition #3); the prompt DOES contain `studentAnswer`/`questionContent` verbatim (proves non-vacuousness); all 3 tests pass.
- **Failure response**: if any sentinel leaks into the prompt output, treat as the single highest-priority defect in this task — do not ship any tutor-facing code downstream (backend-task-12/13) until this is fixed and re-verified.
- **Verification level**: L2 (new tests added and passing), with Test 1 functioning as this feature's own highest-stakes correctness proof.

## Proof Obligations
(Sourced verbatim from `prompt.test.ts`'s own annotations.)
- **Claim**: Test 1 — 0 occurrences of any answer-key-shaped sentinel value in `buildTutorPrompt()`'s output, across mcq/true_false/short_answer fixtures (AC-018/019).
- **Primary failure mode**: a future maintainer widens `TutorPromptInput` or `buildTutorPrompt()`'s implementation to interpolate a field that happens to carry answer-key-shaped content — e.g. accidentally passing the FULL `Question` row instead of the narrowed `TutorPromptInput` at the `explainStep()` call site — and the containment silently breaks, because nothing today asserts the OUTPUT STRING itself.
- **Boundary to exercise**: in-process unit (pure string construction, no I/O).
- **State assertion**: N/A.
- **Mock boundary rationale**: none — no I/O boundary exists to mock.
- **Residual**: this test proves containment for `buildTutorPrompt()`'s own inputs; it does not itself prove the `explainStep()` call site passes only the narrowed type (that is backend-task-13's own responsibility, structurally enforced by `TutorPromptInput`'s type shape at the call site).
- **Claim**: Test 2 — the fixed Vietnamese Socratic-form, answer-withholding instruction text is present in the prompt for all 3 question types (AC-020 backend half — a necessary precondition, not the model's actual compliance, which PRD Success Criteria #9/Phase 5 Task 21 judges manually).
- **Primary failure mode**: the instruction preamble is accidentally dropped for one questionType branch only (e.g. `true_false`'s subItems-shaped context).
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: the model's actual behavioral compliance with this instruction is not provable by this unit test — that is Phase 5 Task 21's manual 10-case evaluation.
- **Claim**: Test 3 — `TutorPromptInput.questionType` structurally rejects `"essay"` at compile time (essay never wrong-twice-eligible, never scored).
- **Primary failure mode**: a future maintainer widens `questionType` to include `"essay"` with nothing flagging the change, since today's exclusion has no accompanying runtime assertion.
- **Boundary to exercise**: compile-time (`@ts-expect-error`), not runtime.
- **State assertion**: N/A.
- **Mock boundary rationale**: N/A.
- **Residual**: if `"essay"` is ever consciously added to the union, this line's `@ts-expect-error` will itself fail to compile (an unused-directive error), forcing a reviewed decision — this is the intended catch mechanism, not a gap.

## Completion Criteria
- [ ] `prompt.ts`/`constants.ts` implemented; all 3 `prompt.test.ts` tests pass
- [ ] Each Proof Obligation is met, with Test 1's 0-occurrence battery given explicit priority

## Notes
- Impact scope: `SOURCE/lib/tutor/prompt.ts`, `SOURCE/lib/tutor/constants.ts`, and their test file only.
- Scope boundary: do not implement `callTutor.ts` (backend-task-12) or `explainStep()` (backend-task-13) here — this task only produces the pure prompt-construction logic.
