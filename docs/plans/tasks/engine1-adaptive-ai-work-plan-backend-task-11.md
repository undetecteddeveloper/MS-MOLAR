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
- [x] `SOURCE/lib/tutor/prompt.ts` (new — `TutorPromptInput`, `buildTutorPrompt()`)
- [x] `SOURCE/lib/tutor/constants.ts` (new — `TUTOR_CALL_DEADLINE_MS`)
- [x] `SOURCE/lib/tutor/__tests__/prompt.test.ts` (fill in the existing skeleton's 3 tests)

## Investigation Targets
- `SOURCE/lib/tutor/__tests__/prompt.test.ts` (already generated — read in full: the TWO-LAYERED containment mechanism note in the header, all 3 tests' exact annotations, especially Test 1's sentinel technique and Test 3's `@ts-expect-error` requirement)
- `SOURCE/types/question.ts` (the full `Question` type — to know exactly which fields `TutorPromptInput` must structurally exclude)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/tutor/prompt.ts` — `buildTutorPrompt()`, `TutorPromptInput`, AC-018/019/020; § `lib/tutor/constants.ts` — `TUTOR_CALL_DEADLINE_MS`)

## Investigation Notes
(Recorded 2026-08-14, before implementation.)

- `SOURCE/lib/tutor/__tests__/prompt.test.ts` (skeleton): comment-only, 3 test blocks. Header states the containment is TWO-LAYERED — (1) type shape cannot HOLD the answer key, (2) the OUTPUT STRING must contain 0 occurrences of answer-key-shaped sentinels even for an adversarial-but-type-valid input. Test 1 mandates one fixture per `questionType` (mcq/true_false/short_answer), each paired with a sentinel deliberately absent from the fixture, plus positive assertions that `studentAnswer`/`questionContent` DO appear. Test 1's named primary failure mode is a call site passing the FULL `Question` row instead of the narrowed type — so the battery also feeds an over-broad, `Question`-row-shaped object (carrying answer-key sentinels) through a runtime cast, which is the only way that failure mode is observable in this file. Test 2 requires the instruction literal be defined ONCE in the test as a fixture constant, **not imported from the implementation**. Test 3 requires a `@ts-expect-error` line rejecting `questionType: "essay"`.
- `SOURCE/types/question.ts`: the answer-key-bearing fields on `Question` are `correctAnswer: ChoiceId`, `subAnswers?: Partial<Record<SubItemId, boolean>>`, `essayAnswer?: string`. `PublicQuestion` already `Omit`s exactly these three — the same three `TutorPromptInput` must be unable to hold. Note `Question` is not assignable to `TutorPromptInput` anyway (`content` vs `questionContent`, and `questionType` is optional there and includes `"essay"`), so the accidental-full-row call site is a compile error at the call site; the runtime cast in Test 1 exercises what would happen if that guard were ever defeated.
- `docs/design/engine1-adaptive-ai-backend-design.md` § Data Contracts (`buildTutorPrompt()`, ~L905-928): fixes the exact `TutorPromptInput` shape (`questionContent`, `questionType: "mcq" | "true_false" | "short_answer"`, `choices?`, `subItems?`, `studentAnswer`), "never throws", "deterministic given the same input (no ambient reads)". Its stated invariant — "`TutorPromptInput` has no field named or shaped like an answer-key field" — rules out adding defensive `correctAnswer?: never` guard fields: that would add a field *named* like an answer-key field, contradicting the invariant. Implemented exactly as specified.
- House style confirmed repo-wide for `lib/<domain>/` pure modules (`lib/scoring/wrongTwice.ts`, `lib/scoring/computeScore.ts`, `lib/analytics/aggregateAttempts.ts`): Vietnamese header comment stating purity + why, named module-level constants instead of magic literals, single exported function, co-located `__tests__/`. `TUTOR_CALL_DEADLINE_MS` follows `FATAL_CALL_DEADLINE_MS` (`lib/ugc/gemini.ts:99`) in naming/underscore-numeric form; kept in its own `constants.ts` per the DD's file mapping rather than in `prompt.ts`, since `callTutor.ts` (task 12), not `prompt.ts`, is its consumer.
- Prompt-text language: existing Gemini prompts in `lib/ugc/` are English *instructions*. Here the task file and DD both call for a **Vietnamese** instruction (AC-020 also requires instructing the model to answer in Vietnamese), so the instruction block is written in Vietnamese — a deliberate divergence from `lib/ugc/`'s English prompts, driven by AC-020.
- Instruction placement: the Socratic/answer-withholding block is emitted unconditionally as a shared prefix, never inside a per-`questionType` branch — that is exactly Test 2's named failure mode (preamble dropped for one branch only).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular the skeleton's full 3-test annotation set and the exact `Question` type's answer-key-bearing fields.
- [x] Convert the 3 skeleton tests into real vitest tests: Test 1's per-questionType sentinel battery (independently-authored sentinel strings, e.g. `"SENTINEL-CORRECT-ANSWER-mcq"`), Test 2's fixed instruction-literal presence check, Test 3's `@ts-expect-error` line.
- [x] Run the tests and confirm Test 1/2 fail (no implementation) and Test 3 fails to compile in the expected way (proving the `@ts-expect-error` line is meaningful, not accidentally already-passing). — Red run: `Cannot find module '../prompt'`, 0 tests collected. Test 3's directive proven load-bearing separately (see Refactor phase mutation checks), since a missing module makes every line error and would mask an unused directive.

### 2. Green Phase
- [x] Implement `TutorPromptInput` — a type whose fields structurally cannot hold `correct_answer`/`sub_answers`/`essay_answer`, and whose `questionType` union excludes `"essay"`.
- [x] Implement `buildTutorPrompt()` — pure string construction including `studentAnswer`, `questionContent`, and the fixed Vietnamese Socratic-form, answer-withholding instruction text for all 3 supported question types.
- [x] Implement `constants.ts` with `TUTOR_CALL_DEADLINE_MS = 30_000`.
- [x] Run `npx vitest run lib/tutor/__tests__/prompt.test.ts` — confirm all 3 pass (Test 3 passes by virtue of the `@ts-expect-error` line correctly flagging the expected compile error). — 3 passed; `npx tsc --noEmit` clean, i.e. the directive is used (an unused one would be TS2578).

### 3. Refactor Phase
- [x] Re-read the final `buildTutorPrompt()` implementation once more for any accidental interpolation of a field not present in the narrowed `TutorPromptInput` type (the exact failure mode Test 1 exists to catch at the call-site level, not just the type level). — Confirmed: the body names `questionType`, `questionContent`, `choices`, `subItems`, `studentAnswer` explicitly; no `JSON.stringify(input)`, no `...input` spread, no `Object.entries()` walk. `formatOptions()` likewise reads only `.id`/`.text` per element, so extra properties on an over-broad element object have no path into the string.

### 4. Mutation checks (proof that the two tests are load-bearing, not merely green)
- [x] Injected `JSON.stringify(input)` into `buildTutorPrompt()`'s sections → Test 1 failed listing all 9 leaked sentinels (3 per questionType) from the `full-question-row` variant. Reverted.
- [x] Widened `questionType` with `| "essay"` → `tsc --noEmit` failed with `prompt.test.ts(250,5): error TS2578: Unused '@ts-expect-error' directive.` — exactly the intended catch mechanism for a future silent widening. Reverted.

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
- [x] `prompt.ts`/`constants.ts` implemented; all 3 `prompt.test.ts` tests pass
- [x] Each Proof Obligation is met, with Test 1's 0-occurrence battery given explicit priority

## Notes
- Impact scope: `SOURCE/lib/tutor/prompt.ts`, `SOURCE/lib/tutor/constants.ts`, and their test file only.
- Scope boundary: do not implement `callTutor.ts` (backend-task-12) or `explainStep()` (backend-task-13) here — this task only produces the pure prompt-construction logic.
