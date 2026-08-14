# Task 09 (Backend): `hasBeenWrongTwice` mechanism — `lib/scoring/wrongTwice.ts` + `getResult()` integration (Work Plan Phase 3, Task 9)

Metadata:
- Dependencies: none (does not require backend-task-01's schema checkpoint — reads only existing `exam_results`/`attempt_answers`-derived data already in scope, no new table)
- Provides: `computeWrongTwiceQuestionIds()`, consumed by backend-task-10 (fixture-construction consistency), backend-task-13 (`explainStep()`'s server-side re-verification), frontend-task-01 (`ExplainStepAffordance`'s mount gate via `getResult()`'s output)
- Size: Medium (4 files: `wrongTwice.ts`, `queries.ts` extension, `types/result.ts` extension, `wrongTwice.test.ts`)

## Implementation Content

Implement `computeWrongTwiceQuestionIds()` (`SOURCE/lib/scoring/wrongTwice.ts`) — pure function, `Set<string>` of question IDs scored incorrect on ≥2 distinct attempt IDs across ALL of a user's submitted attempts (mirrors `computeScore.ts`'s `isScored()` convention exactly: `scored !== false`). Wire it into `getResult()` (`SOURCE/app/(layer2)/queries.ts`) via a new parallel (`Promise.all`) cross-attempt query, and add `PerQuestionResult.hasBeenWrongTwice?: boolean` (`SOURCE/types/result.ts`), computed only when `row.scored !== false && !row.isCorrect` (else `undefined`).

Convert `wrongTwice.test.ts`'s 3 already-generated tests into real vitest tests in the same commit:
- Test 1 (cross-attempt ≥2-distinct threshold)
- Test 2 (`scored:false` exclusion vs. `scored:undefined` inclusion parity)
- Test 3 (cross-exam global question identity)

## Target Files
- [x] `SOURCE/lib/scoring/wrongTwice.ts` (new — `computeWrongTwiceQuestionIds()`)
- [x] `SOURCE/app/(layer2)/queries.ts` (additive — new parallel cross-attempt query wired into `getResult()`)
- [x] `SOURCE/types/result.ts` (additive — `PerQuestionResult.hasBeenWrongTwice?: boolean`)
- [x] `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (fill in the existing skeleton's 3 tests)
- [x] `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` — **obligations (a), (e), (f) and (g) only**; added by orchestrator grant 2026-08-14 (widened after integration-test-reviewer's `needs_revision`) on the authority of `docs/design/engine1-adaptive-ai-backend-design.md` § Integration Points List, row "`getResult()` cross-attempt read", whose Verification Method names "+ a `getResult` integration test extension" — which covers adding coverage, not only editing one guard. Obligations (b)/(c)/(d) and the shared `mockGetResultChain` helper remain byte-identical (DD line 1121's Output Comparison assertions).

## Investigation Targets
- `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` (already generated — read in full: the contract-under-test comment, all 3 tests' exact annotations)
- `SOURCE/lib/scoring/computeScore.ts` (lines ~36-42, `isScored()` — the exact `scored !== false` convention this function must mirror; Code Inspection Evidence cited directly by the skeleton)
- `SOURCE/app/(layer2)/queries.ts` (`getResult()`, its existing `Promise.all` block around line 242, and `perQuestion: row.per_question` around line 358 — the exact wiring point for the new parallel query)
- `SOURCE/types/result.ts` (`PerQuestionResult` interface, its existing `scored?: boolean` field and its own doc-comment on the essay/scored convention)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/scoring/wrongTwice.ts` + `getResult()` integration; § Data Contracts — `computeWrongTwiceQuestionIds()` Consumer-side gating, verbatim source for the Reference Contract below; § Minimal Surface Alternatives Element 1 — computed on read, 0 new persistent state)

## Change Category

`Change Category: boundary-change`

This task extends `getResult()`'s existing published output shape (`ExamResult.perQuestion[].hasBeenWrongTwice`), consumed today by `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` and any other existing caller. Sweep required: confirm every pre-existing field of `PerQuestionResult`/`ExamResult` remains byte-identical for rows where `hasBeenWrongTwice` is `undefined` (i.e. this is a strictly additive extension, not a reshape) — check `getResult()`'s other callers/consumers beyond the result-detail page for any assumption about the exact key set of a `PerQuestionResult` row (e.g. exhaustive destructuring or `Object.keys()` usage) that a new optional field could break.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-backend-design.md (§ Data Contracts — `computeWrongTwiceQuestionIds()` Consumer-side gating) | derived-display | "hasBeenWrongTwice = (row.scored !== false \&\& !row.isCorrect) ? wrongTwiceSet.has(row.questionId) : undefined" | Does `getResult()`'s wiring compute `hasBeenWrongTwice` exactly per this formula (never set for `scored === false` or `isCorrect === true` rows, `undefined` in those cases) (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular `computeScore.ts`'s `isScored()` and `wrongTwice.test.ts`'s 3 tests in full.
- [x] Convert the 3 skeleton tests into real vitest tests, using the exact literal fixtures described in each test's Behavior/Proof-obligation annotation.
- [x] Run the tests and confirm all 3 fail (no `wrongTwice.ts` implementation exists yet). — Red evidence: `Error: Cannot find module '../wrongTwice'`, `Test Files 1 failed`.

### 2. Green Phase
- [x] Implement `computeWrongTwiceQuestionIds()` — cross-attempt aggregation by distinct `attemptId`, `scored !== false` gate, global (not per-exam) `questionId` identity.
- [x] Run `npx vitest run lib/scoring/__tests__/wrongTwice.test.ts` — confirm all 3 pass. — Green evidence: `Test Files 1 passed (1) / Tests 6 passed (6)` (the 3 skeleton tests expanded to 6 `it()` cases, one per proof obligation).
- [x] Wire the new parallel cross-attempt query into `getResult()`'s existing `Promise.all`, add `hasBeenWrongTwice` to the returned `perQuestion` rows per the Reference Contract formula above.
- [x] Add `hasBeenWrongTwice?: boolean` to `PerQuestionResult` in `types/result.ts`.

### 3. Refactor Phase
- [x] Confirm every pre-existing field of `getResult()`'s output is byte-identical for a fixture attempt with no wrong-twice questions (regression check per Change Category sweep above). — Evidence: `getResult.int.test.ts` obligation (b) (`toEqual` against the independently-authored `EXPECTED_PRE_EXISTING_OUTPUT`) still passes, as do obligations (a), (c), (d).
- [x] Extend `getResult.int.test.ts` obligation (e) to the parallel-read shape without weakening it (granted scope). — See "Obligation (e) extension" below.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/scoring/wrongTwice.ts`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/scoring/__tests__/wrongTwice.test.ts`; separately, compare `getResult()`'s output for a fixture attempt against its pre-change output shape (Output Comparison technique, this repo's own precedent from the History feature's `getResult()` extension).
- **Success criteria**: all 3 unit tests pass; `hasBeenWrongTwice` computed correctly and wired into `getResult()`'s existing output shape (byte-identical for all pre-existing fields) — Phase 3 Completion Criteria.
- **Failure response**: if the Output Comparison reveals any pre-existing field changed shape/value, treat as a regression — do not proceed to backend-task-10, which relies on `getResult()`'s stability for its own real-DB fixture construction.
- **Verification level**: L2 (new tests added and passing) plus an explicit Output Comparison regression check on the extended function.

## Proof Obligations
(Sourced verbatim from `wrongTwice.test.ts`'s own annotations.)
- **Claim**: Test 1 — a question scored incorrect on ≥2 distinct attempt IDs is included in the returned Set; a question wrong on only 1 attempt is excluded.
- **Primary failure mode**: the function counts wrong OCCURRENCES within a flattened list instead of DISTINCT attemptIds, over-including a once-attempted question; or treats "wrong on exactly 1 attempt" as satisfying "≥2" (off-by-one).
- **Boundary to exercise**: in-process unit (pure function, literal attempt/perQuestion fixtures).
- **State assertion**: N/A (pure function).
- **Mock boundary rationale**: none — no I/O.
- **Residual** (corrected 2026-08-14 — the original text misattributed this coverage to backend-task-10, which covers `record_skill_mastery()` / `submitExam()` and never touches `getResult()`, so it could not discharge it): none at the pure-function level. The wiring into `getResult()` is now proven **here**, by obligation (f) of `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` — the gating formula on all three row branches, plus the history read being unscoped and selecting `attempt_id`. What genuinely remains: real-Postgres semantics of that read (that `results_select_own` returns exactly the caller's rows, and that `per_question` deserialises as assumed), which no mocked-client test can prove. Owner: the Phase 5 manual verification pass (seeded real-data session, `phase5-completion`), with backend-task-02's RLS cases covering the row-scoping half. Not owned by backend-task-10.
- **Claim**: Test 2 — `scored: false` rows are excluded even if wrong on 2 attempts; `scored: undefined` rows are included (mirrors `computeScore.ts`'s `isScored()` convention).
- **Primary failure mode**: the predicate is written as `scored === true` instead of `scored !== false`, silently excluding every question whose `scored` field was never explicitly set to `true`.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.
- **Claim**: Test 3 — a question shared by two different exams' attempts still counts toward the same ≥2-distinct-attempts threshold (global identity, not per-exam).
- **Primary failure mode** (corrected 2026-08-14): per-exam scoping is **unrepresentable** in `computeWrongTwiceQuestionIds()` — `WrongTwiceAttempt` carries no exam identifier, so no mutation of `wrongTwice.ts` can group by exam. Test 3 is therefore kept as executable documentation that the contract is global by construction; the real per-exam/per-attempt scoping risk lives in the caller's query shape and is covered by obligation (f) of `getResult.int.test.ts`.
- **Boundary to exercise**: in-process unit.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: the caller-side scoping risk, discharged by obligation (f) (see corrected failure mode above).

## Completion Criteria
- [x] `wrongTwice.ts` implemented; all 3 `wrongTwice.test.ts` tests pass
- [x] `getResult()` extended with `hasBeenWrongTwice`, Reference Contract Compliance Check `Y`, evidence recorded
- [x] Output Comparison confirms all pre-existing `getResult()` fields byte-identical
- [x] Each Proof Obligation is met
- [x] Full suite green (excluding the 8 pre-existing comment-only skeletons owned by other Engine 1 tasks)

## Notes
- Impact scope: `SOURCE/lib/scoring/wrongTwice.ts` (new), `SOURCE/app/(layer2)/queries.ts` (additive), `SOURCE/types/result.ts` (additive).
- Scope boundary: do not modify `explainStep()` (backend-task-13, separate caller of this same function) or `ResultDetailPage`'s render (frontend-task-01) here.

## Investigation Notes

### Targets read (2026-08-14)

- `SOURCE/lib/scoring/__tests__/wrongTwice.test.ts` — comment-only skeleton. Contract under test:
  `computeWrongTwiceQuestionIds(attempts: {attemptId, perQuestion}[]): Set<string>`; questionId qualifies when
  `scored !== false && isCorrect === false` on **≥2 distinct attemptIds**. Test 1 demands `toEqual(new Set(["Q1"]))`
  exactly (not `toContain`); Test 2 demands `scored:false` excluded / `scored` omitted included; Test 3 demands
  cross-exam (global) questionId identity.
- `SOURCE/lib/scoring/computeScore.ts` — `isScored(q)` (lines 36-42) decides at *scoring* time; the persisted
  convention this function must mirror is the consumer-side one at line 127: `perQuestion.filter((r) => r.scored !== false)`
  (i.e. `undefined === scored`). No side effects, no I/O; house style FA-11 (single exported function, Vietnamese
  header comment, pure, co-located test).
- `SOURCE/lib/analytics/aggregateAttempts.ts` — pattern reference for `lib/<domain>/` pure reducers: a minimal
  local projection interface (`AttemptRow`) declared in the module rather than reusing a fat domain type, all
  state injected, `Map`/`Set` accumulator, no ambient reads.
- `SOURCE/app/(layer2)/queries.ts` — `getResult()` (lines 315-412). Control flow: Vòng 1 = one PostgREST request on
  `exam_results` embedding `exam_attempts!inner(... exams_with_difficulty!inner(id,title))` → `maybeSingle()`;
  `!joined` → `null`. Vòng 2 = `supabase.rpc("exam_answer_key", {p_exam_id})`, **sequentially dependent** on Vòng 1
  (needs `exam.id`). The `Promise.all` at line 242 belongs to `getExamForPlayer()`, not `getResult()` — the task
  file's "existing `Promise.all` block around line 242" pointer is stale for this function; the DD's actual
  instruction is `Promise.all([existingQuery, wrongTwiceQuery])`, i.e. a **new** `Promise.all` wrapping Vòng 1.
  Result assembly: `const result: ScoreResult = { ...perQuestion: row.per_question ... }` at lines 354-360.
- `SOURCE/types/result.ts` — `PerQuestionResult { questionId; selected?; correct?; isCorrect; scored? }`;
  its `scored` doc-comment states the same "undefined (row cũ trước v2.1) = true" convention.
- `docs/design/engine1-adaptive-ai-backend-design.md` — §Data Contracts `computeWrongTwiceQuestionIds()` (lines 929-946),
  §Minimal Surface Alternatives Element 1 (computed on read, 0 new persistent state), §Integration Points List line 763.
- `SOURCE/supabase/schema.sql` §RLS lines 204-207 — `results_select_own` (`user_id = auth.uid()`) means an
  unfiltered `select` on `exam_results` through the JWT-scoped client already returns exactly this user's rows;
  no explicit `user_id` filter is needed (matches DD line 934).

### Reference Contract Check (pre-implementation)

Planned approach for the single Reference Contracts row: `getResult()` will fetch all of the caller's
`exam_results` rows (`attempt_id, per_question`) in parallel with Vòng 1, feed them to
`computeWrongTwiceQuestionIds()`, and map `perQuestion` with
`hasBeenWrongTwice = (row.scored !== false && !row.isCorrect) ? set.has(row.questionId) : undefined`
— the formula copied verbatim from the DD, with the gate kept in the consumer (`getResult()`), not inside the
pure function.

| Source | Compliance Check | Evaluation | Rationale |
|---|---|---|---|
| DD § Data Contracts — Consumer-side gating | Does `getResult()` compute `hasBeenWrongTwice` exactly per the formula? | Y | The mapping expression is the DD's formula character-for-character; `undefined` is produced for `scored === false` and for `isCorrect === true` rows because the ternary's else-branch is `undefined`. |

### Adjacent Case Sweep (Change Category: `boundary-change`)

Consumers of `getResult()` / `PerQuestionResult` checked for assumptions a new optional key could break:

- `app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx:69` — `result.perQuestion.map((r, i) => …)`,
  field-by-field reads only. No `Object.keys`, no exhaustive destructuring, no rest-spread. Safe.
- `app/(layer2)/exams/[id]/attempt/[attemptId]/result/page.tsx` — reads score aggregates only. Safe.
- `lib/scoring/computeScore.ts` — *produces* `PerQuestionResult`; an added optional field cannot affect it.
  Not modified (Preserved area).
- `lib/scoring/__tests__/computeScore.test.ts` — asserts `toEqual` on rows `computeScore()` itself builds;
  `computeScore()` never sets `hasBeenWrongTwice`, so those assertions are unaffected.
- `lib/supabase/service-role.ts` / `record_exam_result()` / `record_skill_mastery()` — consume `per_question`
  by named key (`pq->>'questionId'` etc.), key-set-agnostic. Not touched by this task (`hasBeenWrongTwice` is
  computed on read and never written back to `exam_results`).
- **Residual found — `app/(layer2)/__tests__/getResult.int.test.ts` obligation (e)**: that pre-existing test
  asserts `fromMock.mock.calls.map(([table]) => table)` `toEqual(["exam_results"])` — i.e. **exactly one**
  `.from()` call inside `getResult()`. The DD-mandated new parallel cross-attempt read is a second
  `.from("exam_results")` call, so it necessarily turns that array into `["exam_results", "exam_results"]`.
  This file is outside this task's Target Files list. See "Scope conflict" below.

### Exit Gate evidence (2026-08-14)

Run from `SOURCE/`:

| Gate | Result |
|---|---|
| `npx vitest run lib/scoring/__tests__/wrongTwice.test.ts` | 1 file / **6 tests passed** (Red first: `Cannot find module '../wrongTwice'`) |
| `npx tsc --noEmit` | clean |
| `npx eslint --max-warnings 0` (4 changed files) | clean |
| `npm run build` | success |
| `npx vitest run "app/(layer2)/__tests__/getResult.int.test.ts"` | 7/7 passed (obligations (a)-(g)) |
| `npx vitest run` (full) | **573 passed / 0 failed** (after review round 3). The 8 remaining "failed suites" are pre-existing comment-only skeletons owned by backend tasks 07/08/10/11/12/13 and frontend 01/02 (`(0 test)` — "No test suite found"), untouched by this task; `wrongTwice.test.ts` was the 9th such skeleton and is now real. |
| Diff audit of the granted test file | Removals confined to the header's (e) note, obligation (a)'s indexed lookup and obligation (e)'s old body. `mockGetResultChain`, `EXPECTED_PRE_EXISTING_OUTPUT` and obligations (b)/(c)/(d) show zero removed lines. |

Reference Contract re-evaluation against the **final** implementation: `Y`.
`queries.ts` mapping is `hasBeenWrongTwice: r.scored !== false && !r.isCorrect ? wrongTwiceQuestionIds.has(r.questionId) : undefined`
— the DD formula verbatim; the pure function itself contains no such gate (gate lives in the consumer, per the DD).
Confirmed observationally by obligation (b), whose fixture row is `isCorrect: true` and whose `toEqual`
against the pre-change literal still passes (an extra key valued `undefined` is `toEqual`-transparent).

### Scope conflict (recorded 2026-08-14) — ESCALATED

`SOURCE/app/(layer2)/__tests__/getResult.int.test.ts:288` asserts:

```
expect(fromMock.mock.calls.map(([table]) => table)).toEqual(["exam_results"]);
```

Observed after this change: `expected [ 'exam_results', 'exam_results' ] to deeply equal [ 'exam_results' ]`.

That guard was written (2026-08-03 perf pass) to stop the collapsed 3-into-1 join from being **re-split into
sequential round trips**. The new read is not a re-split — it is a DD-mandated *parallel* second query inside
one `Promise.all`, so the guard's intent is intact while its literal form is not. Correcting it needs a
one-line extension (e.g. `toEqual(["exam_results", "exam_results"])` plus an added assertion that the two are
issued in the same `Promise.all` rather than in sequence).

`getResult.int.test.ts` is **not** in this task's Target Files. The Design Doc does anticipate the edit
(§Integration Points List, `getResult()` cross-attempt read → Verification Method: "…+ a `getResult`
integration test extension"), but the task file does not grant the file, and modifying a pre-existing test is
itself an escalation trigger. Escalated as `out_of_scope_file` rather than silently editing it.

### Obligation (e) extension — RESOLVED (grant approved 2026-08-14)

Orchestrator granted `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts`, **obligation (e) only**, citing the
Design Doc row above as authority. Obligations (a)/(b)/(c)/(d), the shared `mockGetResultChain` helper and all
shared fixture constants are byte-identical.

The guard was **strengthened, not loosened**. Its original purpose was to catch a future edit that re-splits the
collapsed join into *sequential* round trips; a `.from()` call count can no longer express that, because a
parallel second read and a re-split both raise the count. Obligation (e) now asserts the property directly:
the joined read's `maybeSingle()` is held open on a deferred, `getResult()` is driven to a macrotask boundary
(which drains all pending microtasks — deterministic, not a race), and the test asserts **both** `exam_results`
reads are already in flight while the first is still unresolved. It then releases the deferred and re-asserts
that nothing further was issued and the answer key still costs exactly one `.rpc()`.

Non-vacuity proved by mutation: temporarily rewriting `getResult()`'s `Promise.all` as two sequential `await`s
made obligation (e) fail (`expected [ 'exam_results' ] to deeply equal [ 'exam_results', 'exam_results' ]`)
while obligations (a)/(b)/(c)/(d) all still passed — i.e. this obligation is the only thing standing between
the codebase and a silent re-serialization. The parallel implementation was then restored and re-verified.

The test's own comments state what remains unguarded: the *cost* of the parallel reads (a hypothetical 3rd
parallel `exam_results` read would pass once added to the literal). What is guarded is that nothing becomes
sequential and that the answer-key trip stays at exactly one.

### Review round 2 — integration-test-reviewer `needs_revision` (2026-08-14)

Three defects, each reproduced by mutation before fixing. Grant widened to obligations (a), (e), (f).

1. **Obligation (e) was directional.** Only the joined read was gated, so a *history-first* sequential
   re-split stayed green. Fixed: both `exam_results` reads are now held on their own gates, and the test
   asserts both `.from()` calls are recorded while **neither** has resolved.
   Mutation evidence — both orderings now fail:
   - join-then-history sequential → `expected [ 'exam_results' ] to deeply equal [ 'exam_results', 'exam_results' ]`
   - history-then-join sequential → same failure.
2. **The feature was unguarded end to end (most serious).** The fake builder was not thenable, so
   `await supabase.from("exam_results").select(...)` yielded the builder object, `data`/`error` destructured
   to `undefined`, and the history silently degraded to `[]` in every test — mapping it to nothing passed the
   whole file. New **obligation (f)** uses a thenable builder, feeds a history where one question is
   scored-wrong on 2 distinct attempts, and asserts `hasBeenWrongTwice === true` on that row, `undefined` on a
   correct row and `undefined` on a `scored: false` row; it also asserts the history read carries **no**
   `.eq()` (the real per-exam/per-attempt scoping failure mode) and selects both `attempt_id` and
   `per_question`. Mutation evidence:
   - mapping forced to `undefined` (feature dead) → `(f)` fails (`"hasBeenWrongTwice": true` vs `undefined`); every other obligation still passes, which is precisely the reviewer's point.
   - `.eq("attempt_id", …)` added to the history read → `(f)` fails (`expected [ [ 'attempt_id', 'attempt-1' ] ] to deeply equal []`).
3. **Obligation (a) was index-coupled.** `examResultsSelectMock.mock.calls[0][0]` assumed the join is the
   first `exam_results` read; swapping the two entries inside the same `Promise.all` is behaviour-identical
   but flipped the index. Fixed: the join's select argument is now located by matching `exam_attempts!inner(`,
   with the `started_at`/`submitted_at` assertions unchanged.

### Review round 3 — history-read error handling (2026-08-14)

integration-test-reviewer `approved` all six round-2 findings, leaving one low-severity observation which the
orchestrator ruled in-scope and fixed now rather than deferred.

**Defect**: `fetchWrongTwiceAttempts()` did `if (error) throw error` inside `getResult()`'s `Promise.all`, so a
transient failure of this *additive, non-essential* cross-attempt read rejected the whole `getResult()` call and
broke the already-shipped result-detail page even when its core data had loaded fine.

**Fix**: on read error the helper now logs and returns `[]`. The joined read's `throw joinedErr` is unchanged —
no row genuinely means no page, so it stays fail-loud. `SOURCE/app/(layer2)/queries.ts` is already one of this
task's own Target Files, so no new grant was needed for the implementation half; obligation (g) was granted
under the same Design Doc authority as (a)/(e)/(f).

**Why this is a designed state, not a swallowed error** (the ai-development-guide fallback gate requires Design
Doc sanction): UI Spec § D1 / AC-024 defines the absent flag as the fail-closed default — "When a per-question
result has `hasBeenWrongTwice` false or absent, the system shall not render the affordance." A degraded read
therefore lands the UI in a state the spec already specifies. The backend DD's Minimal Surface Alternatives
Element 1 treats the flag as additive display gating computed on read with 0 persistent state throughout. The
activation is logged, per the same guide's "log all fallback activations".

**Logging convention** (not invented): matches the repo's established
`console.warn("[fn] …:", error.code, error.message)` shape — the closest structural precedent is
`lib/security/rateLimit.ts:149` (degrade-to-fallback + warn), with the `code`/`message` argument pair from
`lib/support/actions.ts:116`. `details`/`hint` are deliberately excluded because PostgREST can put row values
in them; no row content is logged, and obligation (g) asserts that.

**Deviation from the instruction's literal wording — flag is `false`, not `undefined`**: the orchestrator's
brief said the flag should be `undefined` on a row that would otherwise have been `true`. Obligation (g) caught
that this is not what the Reference Contract produces: the degraded history is an *empty* history, so the
formula `(scored !== false && !isCorrect) ? set.has(id) : undefined` is applied unchanged and a scored+wrong row
yields `false`. Producing `undefined` would require the mapping to distinguish "history unavailable" from
"history empty" — a new mode, contradicting this task's own gated Reference Contract Compliance Check, for zero
observable difference: AC-024 lists "false **or** absent" as the same non-rendering state. The assertion was
therefore written to the accurate observable (`false`, and never `true`), with the reasoning recorded in the
test itself. Substance of the instruction (resolve rather than reject; affordance does not render) is met.

**Mutation evidence**: restoring `if (error) throw error` turns obligation (g) red
(`Unknown Error: statement timeout` — `getResult()` rejects) while the other six obligations stay green.

### Design Doc tension (recorded, DD not edited)

DD line 1121 states "no existing assertion is edited by this design" while line 763 authorises the `getResult`
integration test extension. Reading that reconciles them: line 1121's clause is scoped to the **Output
Comparison** assertions it sits with — obligations (b)/(c) (plus (d)'s visibility guard), which are byte-identical
and still passing. Obligation (e) is a round-trip/performance guard outside that scope, and (f) is new coverage
rather than an edited assertion. Recorded here only; the Design Doc is not modified by this task.
