# Task P1-T5 — `lib/exams/attemptSource.ts` + `startAttempt(examId, rawSource?)`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T5**
Layer: backend (`SOURCE/lib/exams/`, `SOURCE/features/exams/actions.ts`)

Metadata:
- Dependencies: none within Phase 1 — explicitly independent of the shelves work; unblocks the frontend `?from` chain early (backend DD step 3 rationale)
- Blocks: P6-T1 (the `?from=` chain's server-action consumer side)
- Size: Small (3 files)
- Verification level: L2

## Implementation Content
Create `SOURCE/lib/exams/attemptSource.ts` (`ATTEMPT_SOURCES`, `AttemptSource`, `toAttemptSource`). Edit `SOURCE/features/exams/actions.ts:21-50` — `startAttempt(examId, rawSource?)`, one added column on the existing insert. Create `SOURCE/lib/exams/__tests__/attemptSource.test.ts`.

## Target Files
- [ ] `SOURCE/lib/exams/attemptSource.ts` (new)
- [ ] `SOURCE/features/exams/actions.ts`
- [ ] `SOURCE/lib/exams/__tests__/attemptSource.test.ts` (new)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The attempt-source write path)
- `docs/design/exam-shelves-backend-design.md` (§ State Transitions and Invariants — `source` has no transition, INSERT-only; invariant `source ∈ {4 values}`)
- `docs/design/exam-shelves-backend-design.md` (§ Security Considerations — `?from` normalization)
- `docs/design/exam-shelves-backend-design.md` (§ Field Propagation Map — `source` field chain, 5 boundary rows)
- `SOURCE/features/exams/actions.ts` (`:21-50` the current `startAttempt(examId)` implementation and its insert statement)
- `SOURCE/supabase/schema.sql` (P0-T1's `exam_attempts.source` column + `exam_attempts_source_check` — the 4 declared valid values this module must mirror)

## Change Category
`Change Category: state-change, boundary-change`

This task writes a new persisted column value on every attempt insert (state-change) and widens `startAttempt`'s public signature (boundary-change, per the Design-to-Plan Traceability table's contract-change rows for "startAttempt(examId, rawSource?)" and "State Transitions and Invariants"). Sweep the adjacent case: every existing call site of `startAttempt` (flat grid, home block, `/exams/[id]`) must still compile and behave correctly with the new optional parameter defaulting through `toAttemptSource(undefined)` → `'none'`.

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md (§ Decision D5) | persistence | `exam_attempts.source text not null default 'none'` + named CHECK `exam_attempts_source_check`, normalised to `'none'` on write | Does `startAttempt` always pass `toAttemptSource(rawSource)`'s result (never the raw client value) into the insert, and does `toAttemptSource` normalise every non-4-literal input to `'none'`? |

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `StartAttemptButton` (client) → `startAttempt` (server action). Owner left: `features/exams/components/StartAttemptButton.tsx` (P6-T1 producer side). Owner right (this task): `features/exams/actions.ts`. Serialized format: server-action closure bound argument (React serializes bound args). Consumer parse rule (this task): `startAttempt(examId, rawSource?)` → `toAttemptSource(rawSource)`. Expected signal: inserted `exam_attempts.source` matches the normalised value. This task owns the consumer/normalisation half; P6-T1 wires the producer half once this lands.

## Investigation Notes
_(Record here: the 4 declared `AttemptSource` literal values, confirmed to match `schema.sql`'s CHECK constraint exactly; confirmation every existing `startAttempt` call site still compiles.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write failing cases for `toAttemptSource`: each of the 4 literals round-trips; `undefined`/`""`/`"PRACTICE"`/an injection-shaped string/an array all normalise to `'none'`
- [ ] Confirm they fail because the module does not yet exist
### 2. Green Phase
- [ ] Implement `attemptSource.ts` (`ATTEMPT_SOURCES`, `AttemptSource`, `toAttemptSource`)
- [ ] Edit `startAttempt` to accept `rawSource?`, normalise via `toAttemptSource`, and add the one column to the existing insert
- [ ] Run tests and confirm all pass
### 3. Refactor Phase
- [ ] Grep for every existing call site of `startAttempt` and confirm each still compiles with the new optional parameter (Change Category sweep)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `lib/exams/**`, `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run lib/exams/__tests__/attemptSource.test.ts`; grep-verify every existing `startAttempt` call site.
- **Success criteria**: all 4 literals round-trip; every malformed/unexpected input normalises to `'none'` without ever rejecting the attempt start.
- **Failure response**: if any malformed input throws or blocks the insert, the design intent ("never a rejected start") is violated — fix by widening the normalisation's fallback branch, not by adding a new error path.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (Failure Mode: empty input): `toAttemptSource("")` normalises to `'none'`.
  - **Primary failure mode**: empty string is treated as a valid-but-unrecognised source and passed through, violating the CHECK constraint at insert time.
  - **Boundary to exercise**: in-process unit test.
  - **State assertion**: N/A (pure function).
  - **Mock boundary rationale**: none.
  - **Residual**: the CHECK constraint itself (P0-T1) is the last-line defense; this proof is about the application-layer normalisation never needing it.
- **Claim** (Failure Mode: invalid option): an unknown source literal (e.g. `"PRACTICE"`, an injection-shaped string, an array) normalises to `'none'`, never rejected.
  - **Primary failure mode**: an unrecognised value throws or is passed through raw, either blocking the attempt start (bad UX) or violating the CHECK constraint (a 500 at the DB layer instead of a graceful fallback).
  - **Boundary to exercise**: in-process unit test.
  - **State assertion**: before → client sends an arbitrary string; after → the inserted row's `source` column is exactly `'none'`.
  - **Mock boundary rationale**: the actual DB insert is not exercised here (pure function boundary); the insert-time proof is P8-T2's HS-g (`source='hacked'` → 23514 is defense-in-depth, not the primary path).
  - **Residual**: this task proves normalisation; that the normalised value actually reaches the DB column unchanged is P6-T1's wiring + a manual smoke check.

## Completion Criteria
- [ ] All added tests pass
- [ ] Every existing `startAttempt` call site confirmed still compiling (Change Category sweep)
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `attemptSource.ts` (new), `actions.ts` (`startAttempt` signature + insert), its test file (new).
- Scope boundary — preserve unchanged: every other export in `actions.ts`; the shelves work in this phase (this task is deliberately independent of it).
