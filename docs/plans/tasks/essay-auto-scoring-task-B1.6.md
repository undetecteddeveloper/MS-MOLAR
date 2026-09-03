# Task B1.6 — Convert INT-1: the feature-off submit path

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.6**
Layer: **backend** (`SOURCE/app/(exams)/__tests__/**` — the integration lane)

Metadata:
- Dependencies: **Task B1.5**.
- Blocks: nothing; it is what turns the shipping state into an automated claim.
- Provides: integration lane resolution **1/3** (INT-1 executing; INT-2 and INT-3 remain `it.todo` until Phase B2).
- Size: Small (1 file)
- Verification level: **L2**.

## Implementation Content

Convert `SOURCE/features/exams/__tests__/essayGrading.int.test.ts` case **INT-1** from `it.todo` to an executing test.

**Mocked**: the Supabase client at the `createClient()` boundary (the sanctioned boundary of `getResult.int.test.ts` / `rating.int.test.ts`), the `service-role.ts` operations, `after()` (replaced by a **synchronous invocation** — the subject is *what* is registered and *when*, not how Next schedules it), Redis, `redirect()`, and global `fetch` as a **counted** mock.

**Real**: `computeScore()`, `lib/scoring/essayLifecycle.ts`, `lib/scoring/wrongTwice.ts`, the i18n dictionaries.

## Target Files
- [x] `SOURCE/features/exams/__tests__/essayGrading.int.test.ts`

## Investigation Targets
- `SOURCE/features/exams/__tests__/essayGrading.int.test.ts` (the committed skeleton — INT-1's `Primary failure mode` / `Proof obligation` annotations, which this task converts verbatim in intent)
- `SOURCE/features/exams/__tests__/getResult.int.test.ts` and `SOURCE/features/exams/__tests__/rating.int.test.ts` (the sanctioned `createClient()` mock boundary)
- `SOURCE/features/exams/actions.ts` (Task B1.5 commit 2 — the flag read, the threaded option, the `after()` registration at `:192`)
- `SOURCE/lib/scoring/computeScore.ts` (Task B1.5 commit 1 — the emitted keys; **real** in this lane)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — **real** in this lane)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — the callback whose registration is counted)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance — the score-write path is load-bearing; everything attached to it is allowed to fail)
- `docs/design/essay-auto-scoring-backend-design.md` (§ EG-BE-032 / EG-BE-033)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance) | data_flow | The score-write path is load-bearing; everything attached to it is allowed to fail. The grading pass runs after `recordExamResult` and `recordSkillMastery`, and every exit is swallowed and logged | Case (f) asserts that a rejecting registered callback leaves `recordExamResult`, `recordSkillMastery` and the redirect all intact |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-002) | state-lifecycle-negative | "**Khi** `computeScore()` chạy với `options.essayGrading === false` (mặc định), hệ thống **phải** phát ra phần tử `per_question` cho câu `essay` **y hệt từng byte** như hôm nay: `{ questionId, selected, isCorrect: false, scored: false }` và **không một khoá `essay*` nào**." | The payload handed to the mocked `recordExamResult` matches an independently authored literal with exactly that key set |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `computeScore()` → `exam_results.per_question` | **Consumer parse rule**: readers branch on the **presence** of the `essayState` key. **Expected signal**: INT-1(a) — the payload handed to the mocked `recordExamResult` equals an **independently authored** literal, and `Object.keys` of every essay element contains **none** of the six keys when the flag is off. |
| `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop | **Serialized format**: env string; **only** `"true"` (trimmed) means on. **Expected signal**: INT-1(d) — four spellings (absent, `""`, `"TRUE"`, `"1"`) all mean off, with a trimmed `"true"` as the **single positive control**. |

## Investigation Notes

**The independently authored literal used in (a)** — `EXPECTED_SCORE_FLAG_OFF`, hand-computed from the fixture, never captured from `computeScore`'s output:

| Field | Value | How it was derived by hand |
|---|---|---|
| `totalScore` | `5` | 1 correct of 2 **scored** questions ⇒ `1/2 × 10` |
| `correct` | `1` | q1 only (q2 answered `"C"` against key `"A"`) |
| `total` | `2` | q1 + q2; **the essay is not in the denominator** |
| `perQuestion[2]` | `{ questionId, selected, isCorrect: false, scored: false }` | the essay element, four keys, no `correct` key (only `mcq` carries one) |
| `topicBreakdown` | `Số học 1/1`, `Hình học 0/1` | **`Văn học hiện thực` is absent** — an unscored question contributes no bucket |

The fixture is deliberately built so that including the essay would move **every one of those five values**: the score would become `3.33`, the total `3`, and a third topic bucket would appear. With a fixture where the numbers coincide, the assertion would prove nothing.

**The `fetch` mock's recorded call count in (b)** — **0**, on all six flag-off runs and on the flag-ON control.

The stub was rewritten mid-task from *throwing* to *returning a benign `Response`*, and that is the more important note here. A throwing stub aborts `submitExam()` at the stray call, so **every** case in the file fails with a transport error and the count — the thing obligation (b) is actually about — is never the assertion that fires. Mutation **M9** (a real `fetch("https://api.groq.com/…")` inserted into `submitExam`) is what proves the counter can move: with the benign stub it fails **(b)** and the four **(d)** spellings by name, and nothing else.

**The `mock.invocationCallOrder` values compared in (e)** — the assertion is the **relation** `after < redirect`, not the integers: `invocationCallOrder` is a per-run global sequence counter shared by every spy in the process, so its absolute values are an artifact of test ordering and recording them would be recording noise. What was verified instead is that the comparison **discriminates**: mutation **M3** (registration moved below `redirect()`) fails (e) by name, while `expect(both).toHaveBeenCalled()` would have passed under M3 had `redirect()` been mocked as a no-op — which is why the redirect spy in this file throws a real `NEXT_REDIRECT` digest.

### Red phase: why it was replaced by mutation testing, and what that showed

A genuine red phase was not observable here. Task B1.5 landed both halves of the production code, and this task's own Notes say *"Impact scope: none in production code"* — so the six obligations were green on the first run (11 passed / 2 todo). A test that has never been seen to fail is a test with no evidence behind it, so each obligation was instead put against a deliberate mutation of the code it guards. **Nine mutations, nine caught**, each by the assertion written for it:

| # | Mutation | Caught by |
|---|---|---|
| M1 | `!== "false"` instead of `=== "true"` (loose truthiness) | (a), (c), all four (d) spellings |
| M2 | flag read loses `.trim()` | (d) positive control |
| M3 | `after()` registered **after** `redirect()` | (e), (d) control, (f) |
| M4 | target filter drops the ground-truth guard | (d) control — target set |
| M5 | registration no longer gated by the flag | (c), all four (d) spellings |
| M6 | pass `await`ed inline instead of registered | (f), (e), (d) control |
| M7 | `computeScore` emits essay keys regardless of the flag | (a), all four (d) spellings |
| M8 | graded-lifecycle essay marked `scored: true` | (d) control — score triple |
| M9 | stray `fetch("https://api.groq.com/…")` inside `submitExam` | **(b)**, four (d) spellings |

M1 is the exact defect the skeleton names as INT-1's primary failure mode; M3 is the second, quieter one.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, especially the skeleton's own annotations
- [x] Write the six obligations as executing cases; observe each fail before wiring the mocks and fixtures — **substituted by mutation testing, see Investigation Notes**: the production code already exists (B1.5), so nothing here could be red for the honest reason. Nine mutations, nine caught.

### 2. Green Phase
- [x] Bring INT-1 green with the stated mock boundaries — Supabase at `createClient()`, `service-role.ts` operations, `after()`, Redis (`guard()`), `redirect()`, and `fetch` **counted**
  - **One deliberate narrowing of the brief**: `after()` records but does **not** invoke, except in (f). Invoking synchronously in every case would make (c) and (e) assert about the callback rather than about the registration, and the registration is the subject. In (f) the spy invokes **and absorbs the rejection**, mirroring both halves of what the runtime does — otherwise a test artifact becomes an unhandled rejection.
  - `lib/essay/gradeEssays.ts` is also mocked. It is Task B1.4's subject with its own lane, and (f) needs it to fail on demand.
- [x] Keep `computeScore()`, `essayLifecycle.ts`, `wrongTwice.ts` and the dictionaries **real** — `wrongTwice.ts` and the dictionaries are not on `submitExam()`'s path at all, so "real" for them means simply unmocked

### 3. Refactor Phase
- [x] Confirm the literal in (a) was authored **independently** — not captured from `computeScore`'s output (derivation table above)
- [x] Confirm (d)'s positive control (a trimmed `"  true  "`) is present, so the flag read cannot be dead code — and M2 confirms it discriminates
- [x] Confirm the added cases still pass
- [x] **Added beyond the brief**: a seventh case pins the six hand-written key literals against `ESSAY_KEYS`. Without it, obligation (a) has two silent ways to stop testing anything — a renamed key leaves the hand-written list asserting the absence of a string nothing emits any more, and an emptied `ESSAY_KEYS` leaves nothing to leak

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit/integration correctness; this file is collected by the default lane — Config: `SOURCE/vitest.config.ts` (`lib/**`, `components/**`, `app/**`); covers `SOURCE/features/exams/__tests__/essayGrading.int.test.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | **primary gate** — 1848 passed / 10 skipped / 2 todo. **+11** from this task, and the todo count drops 3 → 2: INT-1 no longer counts as unwritten |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline exactly as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` FE-1 (e) — `locale en` and `locale vi` |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo |

**Lane duration checked, not assumed** (this task adds no filesystem walk, but the default lane is the gate everything else waits on): **46.4 s**, against 49–54 s before it. No regression.

**Known-red window, run and recorded:** `npm run verify:schema` (dev) exits **1** with exactly **one** failing assertion — `TRẦN DB CAO HƠN TRẦN TRONG MÃ … LIMITS.MAX_ATTEMPT_ANSWER = 500`. That is the H7→B3.3 ceiling gate and nothing else.

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method**: run the default vitest lane and read INT-1's six obligations individually; confirm the `fetch` mock's call count is **exactly 0** in the off state and that the `after()` mock records **0** registrations.
- **Success criteria**: with the flag off (all four spellings), the persisted payload equals the independently authored literal, zero provider calls are **measured**, and zero registrations occur; with a trimmed `"true"`, the positive control shows the flag read is live and `after()` precedes `redirect()`.
- **Failure response**: if the literal in (a) was captured from `computeScore`'s output rather than authored independently, the case proves nothing — rewrite the literal by hand. If the positive control is missing, the whole case passes for an implementation where the flag read is dead code.
- **Verification level**: **L2**.

## Proof Obligations
*(from the skeleton, verbatim in intent)*

- **(a)** With `ESSAY_GRADING_ENABLED` **deleted** from the environment, the `per_question` payload handed to the mocked `recordExamResult` equals an **independently authored** literal — **not** "whatever `computeScore` returned" — and `Object.keys` of every essay element contains **none** of the six keys. Assert on the **key set**, not on `essayState === undefined`.
  - *Overlap note*: `computeScore.test.ts` owns the pure half — the shape the function returns. What this lane adds is that the shape **survives the call site**: `submitExam` passes the option through and persists exactly that payload, which no pure-function test can see.
  - **Primary failure mode**: the option is threaded incorrectly at the call site, so the function is right and the persisted row is wrong. **Boundary**: the `createClient()` mock boundary — the sanctioned one for this lane. **State assertion**: the payload handed to `recordExamResult`. **Mock rationale**: Supabase, `service-role.ts`, Redis, `redirect()` and `after()` are the external boundaries; `computeScore` and `essayLifecycle` stay real. **Residual**: proves the payload handed over, not what Postgres stores — that is the service lane's (Task H8).
- **(b)** **Zero provider calls, measured**: the counted `fetch` mock's count is exactly **0**, and no `api.groq.com` request is constructed even to be aborted.
  - **Primary failure mode**: a request built and then cancelled — still a request, still text leaving the process. **Boundary**: the global `fetch` boundary, counted. **State assertion**: N/A. **Mock rationale**: `fetch` is external I/O. **Residual**: none.
- **(c)** The `after()` mock records **0** registrations.
  - **Primary failure mode**: a pass registered while the feature is off, doing nothing visible but keeping the invocation alive. **Boundary**: the `after()` mock. **State assertion**: N/A. **Mock rationale**: `after()` replaced by a synchronous invocation — the subject is what is registered and when. **Residual**: none.
- **(d) Failure Mode Checklist: missing config** — four env spellings all mean **OFF**: absent, `""`, `"TRUE"`, `"1"` — each yielding (a)+(b)+(c); a `"true"` **with surrounding whitespace** means ON and is included as the **one positive control**, so the case cannot pass by the flag read being dead code.
  - **Primary failure mode**: a loose truthiness read turning grading on in an environment nobody intended — or, in the other direction, a flag read that never executes. **Boundary**: in-process env read through the real call site. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(e)** Ordering with the flag ON: the `after()` mock is called **before** the `redirect()` mock, asserted by comparing `mock.invocationCallOrder` on the two spies — "both were called" is true in the broken ordering too.
  - **Primary failure mode**: registration after `redirect()` — in Next, never registering at all. **Boundary**: two spies in-process. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **(f) Failure Mode Checklist: unavailable boundary** — containment: with the flag ON and the registered callback **forced to reject** when invoked synchronously, `recordExamResult` and `recordSkillMastery` were still both called and the redirect still happened (EG-BE-033).
  - **Primary failure mode**: a failing grading pass changing `submitExam()`'s observable outcome, so a provider outage costs the student their attempt. **Boundary**: in-process through the real call site. **State assertion**: both writes performed; redirect occurred. **Mock rationale**: as above. **Residual**: none.

## Completion Criteria
- [x] **Implementation Complete** = INT-1 executing with **all six** obligations asserted (7 cases + a 4-row `it.each` = 11 executing)
- [x] **Quality Complete** = `npx vitest run` green
- [x] **Integration Complete** = the shipping state (flag off ⇒ zero keys, zero registrations, zero provider calls) is now an **automated claim** rather than a promise
- [x] Integration lane test resolution: **1/3** (INT-2 and INT-3 remain `it.todo` until Phase B2)
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y` — the ADR-0011 containment row by case (f) under mutation M6; the EG-BE-002 contract row by case (a) under mutations M1 and M7
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: none in production code — this task converts a skeleton case.
- Scope boundary — preserve unchanged: INT-2 and INT-3 stay `it.todo` in this commit (Task B2.4 converts them); `SOURCE/features/exams/actions.ts` and `computeScore.ts` (Task B1.5 owns them).
- The lane's mock boundaries are fixed by the skeleton and by `getResult.int.test.ts`/`rating.int.test.ts` — do not mock deeper than `createClient()`.
