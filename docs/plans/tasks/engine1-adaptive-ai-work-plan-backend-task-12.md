# Task 12 (Backend): `lib/tutor/callTutor.ts` + telemetry payload builder (Work Plan Phase 3, Task 12)

Metadata:
- Dependencies: backend-task-11 (`TUTOR_CALL_DEADLINE_MS`, `TutorPromptInput`/`buildTutorPrompt()`'s shape, for consistency)
- Provides: `generateHint()`, `logTutorExit()`, the telemetry payload builder, consumed by backend-task-13 (`explainStep()`) and reconciled against backend-task-08's `getSkillRecommendation()` telemetry shape
- Size: Medium (3 files: `callTutor.ts`, `telemetry.ts` or co-located, `telemetry.test.ts`)

## Implementation Content

Implement `generateHint()` (reuses `getGeminiClient()`, `QUESTION_MODEL`, `makeDeadlineSignal()`, `sdkErrorDetail()` from `lib/ugc/gemini.ts` — **not** `logExtractorExit()` verbatim, its hardcoded `"[ugc-extract]"` prefix would mislabel tutor logs; add a small analogous helper instead) and `logTutorExit()`.

Extract the `telemetry_log` insert-payload construction into its own small, pure, unit-testable function per the skeleton's own suggestion (home: `lib/tutor/telemetry.ts`, new file, or co-located in `callTutor.ts` — implementer's choice), reused by both `explainStep()` (backend-task-13) and `getSkillRecommendation()` (backend-task-08, if not already using an equivalent inline shape — reconcile if so, since backend-task-08 landed first per the dependency graph).

Convert `telemetry.test.ts`'s 1 already-generated test into a real vitest test: every field of the constructed payload is either structurally safe (uuid/boolean/timestamp/closed enum) or, for `error_code`, strictly one of the 4 named literals — never a raw `Error.message`, across a fixture battery including a simulated error whose message contains an answer-key-shaped sentinel.

## Target Files
- [ ] `SOURCE/lib/tutor/callTutor.ts` (new — `generateHint()`, `logTutorExit()`)
- [ ] `SOURCE/lib/tutor/telemetry.ts` (new, or co-located in `callTutor.ts` per implementer's choice — telemetry payload builder, e.g. `buildTelemetryPayload()`)
- [ ] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (fill in the existing skeleton's 1 test)

## Investigation Targets
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (already generated — read in full: the Implementer note explaining why a standalone payload-builder function must be extracted, and the exact test annotation)
- `SOURCE/lib/ugc/gemini.ts` (`getGeminiClient()` line ~33, `QUESTION_MODEL` line ~18, `makeDeadlineSignal()` line ~106, `sdkErrorDetail()` line ~69, `logExtractorExit()` line ~60 — reuse all but the last verbatim; author a tutor-specific analog of `logExtractorExit()` instead)
- `SOURCE/app/(layer3)/queries.ts` (backend-task-08's `getSkillRecommendation()` — its existing inline `telemetry_log` insert shape, to reconcile with the extracted builder here)
- `SOURCE/supabase/schema.sql` (§18/§19 — `telemetry_log`'s exact column shape and `error_code`'s CHECK constraint, verbatim source for the Reference Contract below)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/tutor/callTutor.ts` — `generateHint()`; § Telemetry payload builder (AC-013); § Logging and Monitoring — `telemetry_log.error_code` closed enum, never free text)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-backend-design.md (§18 schema, `telemetry_log.error_code`) | state-lifecycle-negative | "error_code text check (error_code is null or error_code in ('gemini_unavailable', 'rate_limited', 'server', 'not_eligible'))" — "Mã có cấu trúc, KHÔNG BAO GIỜ free-text/exception message" | Does the telemetry payload builder ever assign `error_code` a value outside these 4 literals (or `null`) — specifically never a raw caught-`Error`'s `.message` — verified across the fixture battery including a simulated error with an answer-key-shaped message (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets, in particular `gemini.ts`'s exported utilities and `telemetry.test.ts`'s single test annotation.
- [ ] Convert the skeleton test into a real vitest test: a fixture battery of success/failure × `tutor_invoke`/`adaptive_route` event types, including a simulated caught `Error` whose `.message` contains a sentinel answer-key-shaped string (mirroring `prompt.test.ts`'s sentinel technique).
- [ ] Run the test and confirm it fails (no payload builder exists yet).

### 2. Green Phase
- [ ] Implement `generateHint()` reusing `getGeminiClient()`/`QUESTION_MODEL`/`makeDeadlineSignal()`/`sdkErrorDetail()`; implement a small tutor-specific `logTutorExit()` analog to `logExtractorExit()` (not reusing its hardcoded `"[ugc-extract]"` prefix).
- [ ] Implement the telemetry payload builder — every field either structurally safe or, for `error_code`, strictly one of the 4 named literals, never `err.message`.
- [ ] Reconcile with backend-task-08's existing inline telemetry-insert shape in `getSkillRecommendation()` if it does not already use an equivalent structure — refactor `getSkillRecommendation()` to call this shared builder if straightforward, or document why not if reconciliation would expand this task's scope beyond its Target Files (escalate if so).
- [ ] Run `npx vitest run lib/tutor/__tests__/telemetry.test.ts` — confirm the test passes.

### 3. Refactor Phase
- [ ] Confirm `generateHint()`'s deadline handling correctly uses `TUTOR_CALL_DEADLINE_MS` (backend-task-11) via `makeDeadlineSignal()`, not a hardcoded value.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/tutor/`
- `check-ai-key-bundle.mjs` — Covered: `lib/tutor/` — relevant since `callTutor.ts` touches `GEMINI_API_KEY` via `getGeminiClient()`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/tutor/__tests__/telemetry.test.ts` against the fixture battery, with particular attention to the simulated-error-with-sentinel-message case.
- **Success criteria**: every field of the constructed payload is either structurally safe or, for `error_code`, strictly one of the 4 named literals; answer-key containment proven with 0 occurrences across the telemetry-payload fixture battery (Phase 3 Completion Criteria).
- **Failure response**: if the sentinel leaks into any payload field, treat as equally high-priority as backend-task-11's prompt-containment defect (same class of risk, different surface) — fix before backend-task-13 wires this builder into `explainStep()`.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
(Sourced verbatim from `telemetry.test.ts`'s own annotation.)
- **Claim**: 0 occurrences of answer-key material in the constructed `telemetry_log` insert payload, across a fixture battery including simulated error paths (AC-013).
- **Primary failure mode**: a future maintainer routes a caught exception's `err.message` (which could echo attacker-influenced UGC question content) into `error_code` or any other telemetry column instead of the constrained 4-member enum — reopening the exact leak path the schema's own CHECK constraint and this unit test both exist to prevent.
- **Boundary to exercise**: in-process unit (pure payload-construction function, no I/O — the actual DB insert call is a separate concern exercised by backend-task-08/13's integration tests).
- **State assertion**: N/A (pure function).
- **Mock boundary rationale**: none — no I/O at this layer.
- **Residual**: this test proves the payload-builder's own output is safe; it does not itself prove `explainStep()`/`getSkillRecommendation()` actually call this builder for every insert path rather than constructing an ad-hoc payload — that call-site discipline is proven by backend-task-13's `tutorActions.int.test.ts` Test 2 and backend-task-08's `getSkillRecommendation.int.test.ts` Test 1.

## Completion Criteria
- [ ] `callTutor.ts`/telemetry payload builder implemented; `telemetry.test.ts` passes
- [ ] Reconciliation with backend-task-08's existing telemetry-insert shape confirmed (either refactored to share the builder, or the decision not to documented)
- [ ] Reference Contract's Compliance Check evaluates to `Y`, evidence recorded in Investigation Notes
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/lib/tutor/callTutor.ts`, `SOURCE/lib/tutor/telemetry.ts` (or co-located) and their test file; a possible small refactor of `SOURCE/app/(layer3)/queries.ts`'s existing inline telemetry-insert call if reconciliation is straightforward.
- Scope boundary: do not implement `explainStep()` itself (backend-task-13) here — this task only produces the Gemini-calling wrapper and the shared payload builder.
