# Task B1.6 — Convert INT-1: the feature-off submit path

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.6**
Layer: **backend** (`SOURCE/app/(layer2)/__tests__/**` — the integration lane)

Metadata:
- Dependencies: **Task B1.5**.
- Blocks: nothing; it is what turns the shipping state into an automated claim.
- Provides: integration lane resolution **1/3** (INT-1 executing; INT-2 and INT-3 remain `it.todo` until Phase B2).
- Size: Small (1 file)
- Verification level: **L2**.

## Implementation Content

Convert `SOURCE/app/(layer2)/__tests__/essayGrading.int.test.ts` case **INT-1** from `it.todo` to an executing test.

**Mocked**: the Supabase client at the `createClient()` boundary (the sanctioned boundary of `getResult.int.test.ts` / `rating.int.test.ts`), the `service-role.ts` operations, `after()` (replaced by a **synchronous invocation** — the subject is *what* is registered and *when*, not how Next schedules it), Redis, `redirect()`, and global `fetch` as a **counted** mock.

**Real**: `computeScore()`, `lib/scoring/essayLifecycle.ts`, `lib/scoring/wrongTwice.ts`, the i18n dictionaries.

## Target Files
- [ ] `SOURCE/app/(layer2)/__tests__/essayGrading.int.test.ts`

## Investigation Targets
- `SOURCE/app/(layer2)/__tests__/essayGrading.int.test.ts` (the committed skeleton — INT-1's `Primary failure mode` / `Proof obligation` annotations, which this task converts verbatim in intent)
- `SOURCE/app/(layer2)/__tests__/getResult.int.test.ts` and `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (the sanctioned `createClient()` mock boundary)
- `SOURCE/app/(layer2)/actions.ts` (Task B1.5 commit 2 — the flag read, the threaded option, the `after()` registration at `:192`)
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
_(Record here: the independently authored literal used in (a); the `fetch` mock's recorded call count in (b); the `mock.invocationCallOrder` values compared in (e).)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets, especially the skeleton's own annotations
- [ ] Write the six obligations as executing cases; observe each fail before wiring the mocks and fixtures

### 2. Green Phase
- [ ] Bring INT-1 green with the stated mock boundaries — Supabase at `createClient()`, `service-role.ts` operations, `after()` as a synchronous invocation, Redis, `redirect()`, and `fetch` **counted**
- [ ] Keep `computeScore()`, `essayLifecycle.ts`, `wrongTwice.ts` and the dictionaries **real**

### 3. Refactor Phase
- [ ] Confirm the literal in (a) was authored **independently** — not captured from `computeScore`'s output
- [ ] Confirm (d)'s positive control (a trimmed `"true"`) is present, so the flag read cannot be dead code
- [ ] Confirm the added cases still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit/integration correctness; this file is collected by the default lane — Config: `SOURCE/vitest.config.ts` (`lib/**`, `components/**`, `app/**`); covers `SOURCE/app/(layer2)/__tests__/essayGrading.int.test.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | **this task's primary gate** |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

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
- [ ] **Implementation Complete** = INT-1 executing with **all six** obligations asserted
- [ ] **Quality Complete** = `npx vitest run` green
- [ ] **Integration Complete** = the shipping state (flag off ⇒ zero keys, zero registrations, zero provider calls) is now an **automated claim** rather than a promise
- [ ] Integration lane test resolution: **1/3** (INT-2 and INT-3 remain `it.todo` until Phase B2)
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: none in production code — this task converts a skeleton case.
- Scope boundary — preserve unchanged: INT-2 and INT-3 stay `it.todo` in this commit (Task B2.4 converts them); `SOURCE/app/(layer2)/actions.ts` and `computeScore.ts` (Task B1.5 owns them).
- The lane's mock boundaries are fixed by the skeleton and by `getResult.int.test.ts`/`rating.int.test.ts` — do not mock deeper than `createClient()`.
