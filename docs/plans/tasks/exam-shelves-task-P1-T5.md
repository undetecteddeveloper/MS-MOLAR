# Task P1-T5 — `lib/exams/attemptSource.ts` + `startAttempt(examId, rawSource?)`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 1, Task P1-T5**
Layer: backend (`SOURCE/lib/exams/`, `SOURCE/features/exams/actions.ts`)

Metadata:
- Dependencies: none within Phase 1 — explicitly independent of the shelves work; unblocks the frontend `?from` chain early (backend DD step 3 rationale)
- Blocks: P6-T1 (the `?from=` chain's server-action consumer side)
- Size: Small (3 files, +1 line in a 4th — see Investigation Notes, coordinator-approved scope widening)
- Verification level: L2

## Implementation Content
Create `SOURCE/lib/exams/attemptSource.ts` (`ATTEMPT_SOURCES`, `AttemptSource`, `toAttemptSource`). Edit `SOURCE/features/exams/actions.ts:21-50` — `startAttempt(examId, rawSource?)`, one added column on the existing insert. Create `SOURCE/lib/exams/__tests__/attemptSource.test.ts`.

## Target Files
- [x] `SOURCE/lib/exams/attemptSource.ts` (new)
- [x] `SOURCE/features/exams/actions.ts`
- [x] `SOURCE/lib/exams/__tests__/attemptSource.test.ts` (new)
- [x] `SOURCE/features/exams/components/StartAttemptButton.tsx` — **coordinator-approved scope widening, one line only** (see Investigation Notes): compile-only adapter, no `source` prop, no other change — that stays P6-T1's job

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

**Investigation Targets read:**
- Backend Design Doc § "The attempt-source write path" (`:491-513`): pins the exact module shape — `ATTEMPT_SOURCES = ["practice","hot","explore","none"] as const`, `AttemptSource = (typeof ATTEMPT_SOURCES)[number]`, `toAttemptSource(raw: string | string[] | undefined | null): AttemptSource` returning `'none'` for undefined/null/""/array/unknown literal. `startAttempt` inserts `source: toAttemptSource(rawSource)` — one added column, 0 extra round trips.
- § "State Transitions and Invariants" (`:568-570`): `source` has no transition — INSERT-only, `startAttempt` only inserts, nothing ever updates it. Invariant: `source ∈ {practice, hot, explore, none}` on every row via NOT NULL + DEFAULT + CHECK.
- § "Security Considerations" (`:603-607`): `?from=` is the only external input for this datum; normalised by `toAttemptSource` before reaching SQL; the CHECK is the second wall, not the first (the bound server-action argument is client-controlled).
- § "Field Propagation Map" (`:542-553`): 3 `source` rows — `ExamCard` href → detail route (`?from=practice|hot|explore`, absent on flat grid/home, AC-039) [frontend/P6-T1, out of scope here]; detail page → `StartAttemptButton` → `startAttempt` (bound server-action arg, client-controlled) → `toAttemptSource()` maps unknown to `'none'`; `startAttempt` → `exam_attempts.source` (SQL text literal, one of 4) → `exam_attempts_source_check` is the second wall.
- `SOURCE/features/exams/actions.ts:21-50` (current `startAttempt(examId)`): published-guard read (`exams` `.eq("status","published")`), then `.from("exam_attempts").insert({ exam_id: examId }).select("id").single()`, throw on error, else `redirect`. The one-column addition point is the insert object literal at line 44.
- `SOURCE/supabase/schema.sql` — confirmed the 4 declared valid values: inline column at `:207-208` — `source text not null default 'none' check (source in ('practice', 'hot', 'explore', 'none'))`; the idempotent alter/named-constraint pair at `:2582-2585` mirrors the same 4 literals exactly. `AttemptSource`'s 4 literals (`practice`, `hot`, `explore`, `none`) match byte-for-byte.
- ADR-0021 D5 (`:84-95`): same 4-literal CHECK, same normalise-on-write framing, "usage hint, not a trusted fact" — nothing in the running system reads `source` to make a decision.

**Call site sweep** (Change Category: state-change, boundary-change): grepped `startAttempt` repo-wide — exactly **one** call site outside `actions.ts` itself: `SOURCE/features/exams/components/StartAttemptButton.tsx:18` — `const start = startAttempt.bind(null, examId);`. This passes only `examId`; with `rawSource?` optional and appended after `examId` (existing argument order preserved, not inserted), the `.bind(null, examId)` call still typechecks and at runtime resolves `rawSource` to `undefined` → `toAttemptSource(undefined)` → `'none'`. No other call site exists (flat grid and home block render `StartAttemptButton`, which is the only wrapper — confirmed no direct `startAttempt(...)` call elsewhere).

**Binding Decision evaluation** (pre-implementation):
- Planned approach (Axis: persistence): `startAttempt(examId, rawSource?)` will insert `source: toAttemptSource(rawSource)` directly in the `.insert({...})` call — the raw client value is never assigned to a variable that reaches the insert; `toAttemptSource` is the sole normalisation point and its fallback branch (the `default`/`else` of the whitelist check) returns `'none'` for every non-4-literal input including `undefined`, `null`, `""`, arrays, and unrecognised strings.
- Compliance Check ("Does `startAttempt` always pass `toAttemptSource(rawSource)`'s result... and does `toAttemptSource` normalise every non-4-literal input to `'none'`?"): **Y** — this is exactly the Design Doc's pinned code shape (`:503-506`), and the fallback-to-`'none'` behavior is enumerated as one of the Proof Obligations below.

**Reference Contracts**: none — task file has no "Reference Contracts" section.

**Conclusion**: no design deviation, no similar-function duplication risk (this is the sole `AttemptSource`/CHECK-mirroring module by the Design Doc's own dependency-existence table — "Requires new creation": `lib/exams/{attemptSource,browseParams}.ts`), no core-mechanism substitution. Proceeding to TDD.

**RED-GREEN result**: `attemptSource.test.ts` written first (12 cases — `ATTEMPT_SOURCES` literal check, 4-literal round-trip via `it.each`, and 7 fallback-to-`'none'` cases: `undefined`, `null`, `""`, `"PRACTICE"`, an injection-shaped string, a 2-element array, an empty array), confirmed RED (module not found), then `attemptSource.ts` implemented and confirmed GREEN (12/12 pass). `startAttempt` edited exactly per the Design Doc's pinned code shape: `.insert({ exam_id: examId, source: toAttemptSource(rawSource) })`. Full `lib/exams` + `features/exams` vitest run: 247 passed, 8 pre-existing todo, 0 regressions.

**Refactor-phase sweep finding (blocking)**: grepped `startAttempt` repo-wide — the sole external call site is `SOURCE/features/exams/components/StartAttemptButton.tsx:18` (`const start = startAttempt.bind(null, examId);`). `npx tsc --noEmit` (project-wide, `strict: true` → `strictBindCallApply` on) now fails there: adding the trailing optional `rawSource?: string` changes `.bind(null, examId)`'s inferred type from a zero-parameter function to `(rawSource?: string) => Promise<void>`, which is **not** assignable to the `<form action>` prop's `(formData: FormData) => void | Promise<void>` — contradicting the Design Doc's Interface Change Matrix row (`startAttempt(examId)` → `startAttempt(examId, rawSource?)`, "Conversion required: No", "Adapter: No") and this task's own Change Category text ("must still compile ... with the new optional parameter defaulting through `toAttemptSource(undefined)` → `'none'`"). Repo-wide grep for `.bind(null,` found no other occurrence — no existing precedent to follow. The work plan's Design-to-Plan Traceability table assigns `StartAttemptButton.tsx` gains `source?: string` to **P6-T1**, not P1-T5; the file is absent from this task's Target Files and Investigation Targets. Fixing the compile break requires editing that file, which is out of this task's File Scope Constraint. Escalated.

**Coordinator resolution (scope widening approved)**: coordinator approved option 1 from the escalation — widen this task's Target Files by exactly the one line needed. `SOURCE/features/exams/components/StartAttemptButton.tsx:18` changed from `startAttempt.bind(null, examId)` to `startAttempt.bind(null, examId, undefined)`. Nothing else in that file touched — no `source` prop, no other change; that remains P6-T1's job (it still owns the producer half of the Boundary Context above: threading `?from` through `searchParams` into a `source` prop and passing it as the bind's 3rd argument). This is a compile-only adapter with zero runtime behavior change: `undefined` was already what `rawSource` resolved to at this call site before the edit (the parameter is optional and was simply omitted); passing it explicitly changes only the TS-inferred arity of the bound function; `toAttemptSource(undefined)` → `'none'` either way. Root cause recorded: the Design Doc's Interface Change Matrix assumed "Adapter: No" for the `startAttempt(examId)` → `startAttempt(examId, rawSource?)` widening, but under `strictBindCallApply` (on via `strict: true`), `.bind()` on a function with 1 of 2 params bound does **not** collapse to a type compatible with a zero/one-arg caller when the unbound trailing parameter is merely optional — the bound function's type still carries that optional parameter, which is incompatible with the `<form action>` prop's `(formData: FormData) => ...` shape. Re-ran `npx tsc --noEmit` project-wide after the fix: clean, 0 errors. Re-ran `npx vitest run lib/exams features/exams`: 247 passed, 8 pre-existing todo, 0 regressions. `npx eslint --max-warnings 0` on all 4 touched files: 0 warnings/errors.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing cases for `toAttemptSource`: each of the 4 literals round-trips; `undefined`/`""`/`"PRACTICE"`/an injection-shaped string/an array all normalise to `'none'`
- [x] Confirm they fail because the module does not yet exist
### 2. Green Phase
- [x] Implement `attemptSource.ts` (`ATTEMPT_SOURCES`, `AttemptSource`, `toAttemptSource`)
- [x] Edit `startAttempt` to accept `rawSource?`, normalise via `toAttemptSource`, and add the one column to the existing insert
- [x] Run tests and confirm all pass
### 3. Refactor Phase
- [x] Grep for every existing call site of `startAttempt` and confirm each still compiles with the new optional parameter (Change Category sweep) — found `StartAttemptButton.tsx:18` failing; coordinator approved a one-line compile-only adapter (`startAttempt.bind(null, examId, undefined)`); `npx tsc --noEmit` now clean project-wide (see Investigation Notes)

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
- [x] All added tests pass
- [x] Every existing `startAttempt` call site confirmed still compiling (Change Category sweep) — `StartAttemptButton.tsx:18` fixed with a coordinator-approved one-line adapter
- [x] Every Binding Decision's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green — L2 gates run and green for this task's scope (`tsc --noEmit` project-wide clean, `eslint --max-warnings 0` on the 4 touched files, `vitest run lib/exams features/exams`: 247 passed, 0 regressions); `npm run build` / `check:bundle` / `test:fixture` / `test:localdb` are project-wide gates owned by the quality-assurance process per this agent's Responsibility Boundaries, not re-run here

## Notes
- Impact scope: `attemptSource.ts` (new), `actions.ts` (`startAttempt` signature + insert), its test file (new), plus a coordinator-approved one-line compile-only adapter in `StartAttemptButton.tsx:18` (`.bind(null, examId, undefined)` — see Investigation Notes for the escalation and resolution).
- Scope boundary — preserve unchanged: every other export in `actions.ts`; the shelves work in this phase (this task is deliberately independent of it); every line of `StartAttemptButton.tsx` other than the one bind-arity fix — no `source` prop, no other change, that stays P6-T1's job.
