# Task B1.3b — `lib/supabase/service-role.ts`: the two privileged operations (operations 12 and 13)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.3b**
Layer: **backend** (`SOURCE/lib/supabase/**`)

Metadata:
- Dependencies: **Task H7** (the SQL functions must exist on dev before these operations can be exercised against anything real).
- Blocks: **Task B1.4** — `gradeEssays.ts` calls these two operations; without B1.3b landing first, B1.4 does not compile.
- Provides: `claimEssayGradingAttempt()` and `recordEssayGrade()` as **named operations** (11 → **13**).
- Size: Small (2 files)
- Verification level: **L2**.

## Change Category
`Change Category: boundary-change`

The `service-role.ts` operation surface is a published trust boundary governed by ADR-0010, and the `.rpc()` argument keys must match the SQL `p_*` parameter names exactly — a mismatch is a runtime `PGRST202`-family failure, **not** a type error. Adjacent cases swept: the sibling operations in this file (`recordSkillMastery()` at `:95-104` is the shape being followed), and both SQL function signatures as authored in Task H5.

## Why this is its own task and sits here (I003, fixed 2026-08-29)

`gradeEssays.ts` (Task B1.4) **calls** `claimEssayGradingAttempt()` and `recordEssayGrade()`. If those operations only appear in B1.5 — which depends on B1.4 — then B1.4 cannot compile as a standalone commit and the two tasks form a **genuine cycle**. Splitting the operations out ahead of B1.4 breaks it: B1.4 then compiles alone.

**`SOURCE/lib/supabase/service-role.ts` is in neither B1.5 commit** — it moved here.

## Implementation Content

In `SOURCE/lib/supabase/service-role.ts`, add:
- `claimEssayGradingAttempt(attemptId, questionId)`
- `recordEssayGrade(attemptId, questionId, state, earned, max, lowConfidence)`

shaped after `recordSkillMastery()` (`:95-104`). Operations **11 → 13**. `serviceRoleClient()` stays **private**; both are exposed as **named operations**, never as a client (ADR-0010).

### TD-029 note, written at this exact line in the file
These are operations **12 and 13**. ADR-0010's kill criterion has **already fired on both limbs**, and `TECH-DEBT.md:43-90` names the two conditions that force the revisit — a **fourteenth** operation in this file, or a **third** in-place mutation of `exam_results`. This is the line the person about to add operation fourteen will be looking at, which is the whole reason the note goes **here** rather than in an ADR.

### Six-parameter signature, deliberately
It exceeds the 0–2 parameter recommendation. ADR-0018 Decision 1 fixes the SQL signature verbatim, and wrapping the arguments in an object would misalign the `.rpc()` call from the SQL `p_*` parameter names — adding a mapping layer that **neither sibling operation in this file has**, at a boundary where a silent key mismatch is a runtime `PGRST202`-family failure rather than a type error.

## Target Files
- [ ] `SOURCE/lib/supabase/service-role.ts`
- [ ] `SOURCE/lib/supabase/__tests__/service-role.essay.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `service-role.ts`: two new named operations, 11 → 13)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision — named operations, `serviceRoleClient()` private, enforcement in SQL, `import "server-only"`, the bundle scan stands)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Consequences — the kill criterion, already fired → TD-029)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision — a second privileged operation is a **separate function**, not a mode parameter)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 1: the SQL signatures, fixed verbatim; Decision 3: a refused duplicate is a **value**, not an exception)
- `SOURCE/lib/supabase/service-role.ts` (`:95-104` `recordSkillMastery()` — the shape to follow; the current operation count; `serviceRoleClient()`'s privacy)
- `SOURCE/supabase/schema.sql` (the two function signatures as authored in Task H5 — the `p_*` parameter names this call must key on)
- `TECH-DEBT.md` (`:43-90` — TD-029 and its two revisit triggers)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision) | dependency_direction | Privileged operations are exposed as named operations from `lib/supabase/service-role.ts`; `serviceRoleClient()` stays private; enforcement lives in SQL, not at the call site; `import "server-only"`; the bundle scan stands | Both additions are named exported operations, `serviceRoleClient()` remains unexported, and neither operation re-implements an enforcement rule that lives in SQL |
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Consequences) | placement | Adding operations 12 and 13 to `service-role.ts` proceeds by engineer decision; a **fourteenth** operation, or a **third** in-place mutation of `exam_results`, forces the revisit | The file has exactly 13 operations after this task, and the TD-029 note naming both triggers is present at the line where a fourteenth would be added |
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision) | placement | A second privileged operation is a **separate function**, not a mode parameter on the first — which is why claim and settle are two functions | Claim and settle are two separate exported operations; neither takes a mode/discriminator parameter |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `service-role.ts` operations → SQL function parameters |
|---|---|
| Owner (left) | `SOURCE/lib/supabase/service-role.ts` (`claimEssayGradingAttempt`, `recordEssayGrade`) |
| Owner (right) | `public.claim_essay_grading_attempt(p_attempt_id, p_question_id)`, `public.record_essay_grade(p_attempt_id, p_question_id, p_state, p_earned, p_max, p_low_confidence)` |
| Serialized format | `.rpc()` argument object **keyed by the SQL parameter names (`p_*`)**, positional order fixed by ADR-0018 Decision 1 |
| Consumer parse rule | Postgres binds **by name**; a mismatched key is a runtime `PGRST202`-family failure, **not** a type error |
| Expected signal | SVC-1 and SVC-2 drive the functions directly as `service_role` and read the row back by real query; a student JWT gets `42501` on both, discriminated from `PGRST202` (schema never applied) |

Roundtrip check this task owns: every key in the `.rpc()` argument object matches a `p_*` parameter name in the SQL signature **exactly** — asserted in this task's unit tests against a mocked `serviceRoleClient()`, and proven end-to-end by Task H8.

## Investigation Notes
_(Record here: the exact `.rpc()` argument keys used for each operation, copied from the SQL signature; the operation count before and after; where the TD-029 note was placed.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): the sibling operations' `.rpc()` shapes in this file, and both SQL signatures in `schema.sql` — copy the `p_*` names character by character
- [ ] Write `service-role.essay.test.ts` asserting the argument keys reach the mocked client exactly as named, and that a `false` settle is surfaced as a **value**; observe failure

### 2. Green Phase
- [ ] Add both operations shaped after `recordSkillMastery()` (`:95-104`)
- [ ] Add the TD-029 note at the line where a fourteenth operation would be written
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm `serviceRoleClient()` is still private and the file still carries `import "server-only"`
- [ ] Confirm the file is at **13** operations
- [ ] Confirm neither operation converts a `false` into a throw

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: `server-only` does not leak into a client tree — Config: `SOURCE/package.json` (project-wide)
- `npm run test:localdb` — Enforces: the same two functions driven against real Postgres (Task H8) — Config: `SOURCE/vitest.localdb.config.ts`

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3, so if `npm run verify:schema` is run, its character-ceiling assertion is red **by design** — record it as expected. Any **other** red `verify:schema` assertion is a regression.

## Operation Verification Methods
- **Verification method**: unit-test both operations against a **mocked `serviceRoleClient()`**, asserting the `.rpc()` argument object's keys match the SQL `p_*` parameter names exactly and that the return values are surfaced unchanged.
- **Success criteria**: `claimEssayGradingAttempt` surfaces `{ claimed, attempts, reason }` unchanged; `recordEssayGrade` surfaces the settle's boolean as a **value**; the argument keys match the SQL signature character for character.
- **Failure response**: a key mismatch does **not** show as a type error — it shows as a runtime `PGRST202`-family failure at H8 or in production. If H8 reports `PGRST202`, check first whether the schema was applied (Task H7) and only then whether these keys drifted.
- **Verification level**: **L2** — proven end-to-end against real Postgres by Task H8.

## Proof Obligations
- **Claim**: both operations reach the SQL functions with argument keys matching the `p_*` parameter names **exactly**.
  - **Primary failure mode**: a silently mismatched key — a runtime `PGRST202`-family failure rather than a type error, which is precisely why the six-parameter signature is not wrapped in an object.
  - **Boundary to exercise**: in-process unit against a **mocked `serviceRoleClient()`**; the real boundary is proven by Task H8 against real Postgres.
  - **State assertion**: N/A at this level — the SQL side owns the state, and H8 asserts it.
  - **Mock boundary rationale**: `serviceRoleClient()` is the external I/O boundary; mocking deeper would verify wiring rather than the argument contract, and mocking shallower is impossible without a database.
  - **Residual**: proves the call shape only. Array order, first-write-wins, the claim cap and the real grants are Task H8's.
- **Claim**: `claimEssayGradingAttempt` surfaces `{ claimed, attempts, reason }` **unchanged**.
  - **Primary failure mode**: the three refusal reasons collapsed into a single generic refusal at the TypeScript layer, so the UI cannot tell "exhausted" from "already graded". **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the three SQL branches are proven in H8 SVC-2(b)(e)(f).
- **Claim (ADR-0018 Decision 3)**: `recordEssayGrade` surfaces the settle's boolean as a **value**, never converting a `false` into a throw — a refused duplicate is a normal outcome of the AC-063 race, not an error.
  - **Primary failure mode**: a wrapper that throws on `false`, turning a routine race into an error path and, downstream, into a student-visible failure. **Boundary**: in-process unit. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: H8 SVC-1(d) proves the SQL side returns `false` rather than raising.

## Completion Criteria
- [ ] **Implementation Complete** = two operations + the TD-029 note
- [ ] **Quality Complete** = six verify gates green (with H7's known-red ceiling assertion recorded as expected)
- [ ] **Integration Complete** = **Task B1.4 compiles** and its orchestration tests run against these operations
- [ ] `service-role.ts` is at **13** operations with the TD-029 note in place at that line
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: B1.4 and, through it, B1.5 and B3.2.
- Scope boundary — preserve unchanged: `serviceRoleClient()`'s privacy; every existing operation in this file; `SOURCE/supabase/schema.sql` (H5 owns the SQL signatures — this task **copies** the `p_*` names, it does not change them).
- TD-029 is already fired. A **fourteenth** operation here, or a **third** in-place mutation of `exam_results`, forces the ADR-0010 revisit — the note at that line is what a future session will read.
