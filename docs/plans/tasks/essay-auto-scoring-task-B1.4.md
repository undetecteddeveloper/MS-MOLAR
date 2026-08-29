# Task B1.4 — `lib/essay/gradeEssays.ts` — pass orchestration in the mandated order

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.4**
Layer: **backend** (`SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task B1.2**, **Task B1.3**, **Task B1.3b** (this module calls `claimEssayGradingAttempt()` and `recordEssayGrade()`; without B1.3b landing first, this commit does not compile).
- Blocks: **Task B1.5** (commit 2 registers `gradeEssaysForAttempt`), **Task B3.1** (which edits this file), **Task B3.2**.
- Provides: `gradeEssaysForAttempt(...)` — the pass orchestrator.
- Size: Small (2 files)
- Verification level: **L2**; proven end to end by B1.5's manual dev run.

## Implementation Content

Create `SOURCE/lib/essay/gradeEssays.ts` with `import "server-only"`, exporting `gradeEssaysForAttempt(...)`.

Per essay question **with ground truth**, in **this order and no other** (Gate G, AC-072):

> **claim → reserve budget → call provider → settle**

- Concurrency capped at `GROQ_MAX_CONCURRENCY = 2`.
- Wall-clock capped at `ESSAY_PASS_BUDGET_MS = 240_000` (4 minutes), stopping **proactively before** the platform's 300 s fluid-compute ceiling rather than being cut off.
- **Every exit is swallowed and logged.**

### Branch outcomes
| Condition | Outcome |
|---|---|
| Claim refused | telemetry only — **no settle, no provider call** |
| Budget refused or store unreachable | settle `failed` + telemetry (`project_budget_exhausted` or `server`) |
| 429 with retries left | retry after backoff **without a second `INCRBY`** |
| Provider error, 429-exhaustion, or `parseGrade()` returning `ok:false` | settle `failed` |
| Valid output | settle `graded` with the band, `max = 1`, and the low-confidence flag |
| **Empty student answer** | settle band 0 **without claiming and without calling the provider** (AC-037) |
| No ground truth | never enters the target set (AC-038 / EG-BE-003) |

### Wall-clock exhaustion is a designed degradation, not an incident
Questions not yet claimed keep `essayAttempts: 0` and remain **fully retryable**; read-time derivation handles their presentation. Record it so nobody reads it as a failure.

## Target Files
- [ ] `SOURCE/lib/essay/gradeEssays.ts` (new)
- [ ] `SOURCE/lib/essay/__tests__/gradeEssays.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `gradeEssays.ts`: pass orchestration, concurrency cap, wall-clock cap)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Error Handling — a rejected output settles `failed`, never band 0, never left `pending`; every exit of the pass is swallowed and logged)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Security Considerations — the three console-logging rules)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 3: zero rows affected is a value, not an exception; Decision 4: the cap is consumed at claim time; Decision 6: ordering claim → reserve → provider → settle)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance — the score-write path is load-bearing; everything attached to it is allowed to fail; the grading pass runs **after** `recordExamResult` and `recordSkillMastery`)
- `SOURCE/lib/essay/groqClient.ts` (Task B1.2 — the closed error union, `GROQ_MAX_IN_PASS_RETRIES`, the deadline)
- `SOURCE/lib/essay/budget.ts` (Task B1.3 — `reserveGroqBudget(calls, now)`)
- `SOURCE/lib/essay/parseGrade.ts` and `SOURCE/lib/essay/prompt.ts` (Task H3)
- `SOURCE/lib/supabase/service-role.ts` (Task B1.3b — `claimEssayGradingAttempt()`, `recordEssayGrade()`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — states, `ESSAY_MAX_ATTEMPTS`)
- `SOURCE/lib/tutor/telemetry.ts` (the event/error-code constants; **Task B3.1 wires this file's telemetry call sites** — see Notes)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | First-write-wins is a `WHERE … <> 'graded'` predicate inside the settle statement — zero rows affected is a **distinct return value, not an exception** — never a read-then-write in TypeScript. `failed` is not protected by the predicate; `graded` is absorbing | The orchestrator treats a `false` settle as a normal outcome and performs no read-then-write |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time, before the provider is contacted, and is never decremented | The claim precedes the provider call in every branch, and no path decrements the counter |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The Groq budget reserves the worst case (`1 + MAX_IN_PASS_RETRIES`) in a single `INCRBY` before the first request, on a Groq-only daily key, never on the Gemini key; fail closed. **Ordering claim → reserve → provider → settle is a requirement** | Invocation-order assertions on spies show claim → reserve → provider → settle in every successful pass |
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Implementation Guidance) | data_flow | The score-write path is load-bearing; everything attached to it is allowed to fail. The grading pass runs after `recordExamResult` and `recordSkillMastery`, and every exit is swallowed and logged | No exit of this module propagates an exception to its caller |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ EG-BE-020) | derived-display | "**Khi** pass chấm cho một câu bắt đầu, hệ thống **phải** phát **đúng một** `INCRBY` bằng `1 + GROQ_MAX_IN_PASS_RETRIES` **trước** request đầu tiên, và **phải không** hoàn lại khi pass thành công ngay lần đầu." | An in-pass 429 retry emits **no second** `INCRBY`, and a first-try success emits no refund |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `gradeEssays()` → `api.groq.com` (cross-process HTTPS) |
|---|---|
| Owner (left) | `SOURCE/lib/essay/groqClient.ts` — the single emission point |
| Owner (right) | Groq OpenAI-compatible Chat Completions |
| Serialized format | JSON POST body: model = `ESSAY_GRADER_MODEL`, messages built by `lib/essay/prompt.ts`, `response_format: {"type":"json_object"}` as noise reduction only |
| Consumer parse rule | `parseGrade()` validates strictly and never throws; anything invalid is `{ ok: false, reason }` and **settles `failed`** |
| Expected signal | Chokepoint scan: the emission surface is exactly one module; the Gemini `EMIT_PATTERN` matches zero lines in the Groq module |

## Investigation Notes
_(Record here: the invocation-order evidence (`mock.invocationCallOrder` values) for a successful pass; the per-branch assertions for provider calls and budget key state; the exact console payload shape used.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write `gradeEssays.test.ts` covering every Proof Obligation, with the ordering asserted by **`mock.invocationCallOrder`**, not by "all four were called"
- [ ] Observe the failures before the module exists

### 2. Green Phase
- [ ] Implement `gradeEssaysForAttempt(...)`: the four-step order, the concurrency cap, the wall-clock cap, every branch outcome, every exit swallowed and logged
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm no `console.error` can carry the student's answer, the prompt, the raw response or the provider's `err.message`
- [ ] Confirm no path decrements `essayAttempts` and no path emits a second `INCRBY` on an in-pass retry
- [ ] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: `server-only` does not leak into a client tree — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: AC-029 — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**`

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
| 7 | `npm run check:bundle` | | Gate E2 — this task's files match `SOURCE/lib/essay/**` |

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected.

## Operation Verification Methods
- **Verification method**: run the orchestration suite with spies on claim, reserve, provider and settle; assert the **order** via `mock.invocationCallOrder`; drive each refusal branch and assert **zero** provider requests and an **unchanged** `groq:budget:{day}` value.
- **Success criteria**: claim → reserve → provider → settle in that order in every successful pass; each refusal path produces zero provider requests and leaves the budget key unchanged; a rejected output settles `failed` (never band 0, never left `pending`); one request per question per pass; the concurrency cap holds; an empty answer short-circuits before the claim.
- **Failure response**: if metering precedes authorising, **stop** — with a single unmetered project counter (U1/AC-066) that lets an unauthorised caller with a self-composed `attemptId` deny grading to **every** student for the day, and additionally trigger cross-account grading. Fix the order, not the assertion.
- **Verification level**: **L2**; **Integration Complete** is proven end to end by B1.5's manual dev run.

## Proof Obligations
- **Claim (AC-072 ordering)**: claim → reserve budget → call provider → settle, asserted by **invocation order on spies** (`mock.invocationCallOrder`), **not** by "all four were called" — that is true in the broken ordering too.
  - **Primary failure mode**: metering before authorising. With a single unmetered project counter, an unauthorised caller with a self-composed `attemptId` denies grading to every student for the day and triggers cross-account grading.
  - **Boundary to exercise**: in-process, with the provider mocked at the `fetch` boundary and the service-role operations mocked at their module boundary.
  - **State assertion**: N/A here (the SQL state is H8's); the budget counter's value **is** asserted per branch.
  - **Mock boundary rationale**: `fetch` and `serviceRoleClient()` are the external I/O boundaries; the orchestration logic itself runs real code.
  - **Residual**: the SQL functions' own semantics are Task H8's; the Server Action entry point's ordering is Task B3.2's.
- **Claim (EG-BE-022)**: each refusal path produces **zero** provider requests **and** leaves `groq:budget:{day}` **unchanged**.
  - **Primary failure mode**: a refusal that still spends budget, so a denied caller can drain the day. **Boundary**: in-process with counted mocks. **State assertion**: budget key value before → refusal → unchanged. **Mock rationale**: as above. **Residual**: the Server Action's refusal matrix is B3.2's.
- **Claim (EG-BE-016 / Failure Mode Checklist: unavailable boundary)**: a rejected output settles **`failed`** — never band 0, never left `pending`. Provider error, 429-exhaustion and invalid output all settle `failed`.
  - **Primary failure mode**: mapping `ok: false` to band 0, so a successful injection or a provider outage looks like poor student work. **Boundary**: in-process. **State assertion**: element state before (`pending`) → action → after (`failed`). **Mock rationale**: as above. **Residual**: the SQL settle's own behaviour is H8's.
- **Claim (AC-035)**: exactly **one** request per essay question per grading pass; a failure affects that question's row only.
  - **Primary failure mode**: a shared failure aborting the whole pass, so one bad question strands the rest as `pending`. **Boundary**: in-process with a counted provider mock. **State assertion**: sibling questions' states unchanged by one question's failure. **Mock rationale**: as above. **Residual**: none.
- **Claim (AC-036)**: outstanding concurrent grading requests never exceed `GROQ_MAX_CONCURRENCY = 2`.
  - **Primary failure mode**: 4 concurrent requests fire ~12K tokens at an 8K TPM ceiling and exceed it on **every** pass, which retry cannot rescue. **Boundary**: in-process with a provider mock recording peak in-flight count. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: the constant is owned by OQ-1 until measured (Task E5).
- **Claim (AC-037 / Failure Mode Checklist: empty input)**: an empty student answer settles band 0 **with no claim and no provider call**.
  - **Primary failure mode**: burning a claim and a request on a blank answer, consuming one of three attempts for nothing. **Boundary**: in-process with counted mocks. **State assertion**: `essayAttempts` unchanged; state → `graded` at band 0. **Mock rationale**: as above. **Residual**: none.
- **Claim (the three console-logging rules)**: `console.error` carries `questionId` and a **structured code** only — **never** the student's answer, the prompt, the raw response, or the provider's `err.message`.
  - **Primary failure mode**: a provider error message echoing the student's writing into a server log. **Boundary**: in-process with a spied `console.error`, asserting the payload's key set. **State assertion**: N/A. **Mock rationale**: `console.error` spied. **Residual**: the Server Action boundary's `digest`-only rule is B3.2's.
- **Claim (EG-BE-020, carried)**: an in-pass 429 retry emits **no second** `INCRBY`.
  - **Primary failure mode**: per-retry accumulation double-charging the day's budget. **Boundary**: in-process with a counted Redis mock. **State assertion**: exactly one increment per question per pass. **Mock rationale**: Redis at the boundary `quota.test.ts` uses. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = orchestrator + tests
- [ ] **Quality Complete** = six verify gates green (plus `check:bundle`)
- [ ] **Integration Complete** = proven end to end by **Task B1.5's manual dev run**
- [ ] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: B1.5 commit 2 registers this via `after()`; B3.1 adds this file's telemetry call sites; B3.2 drives the same claim → budget → provider → settle path from the retry action.
- Scope boundary — preserve unchanged: `SOURCE/lib/essay/groqClient.ts`, `budget.ts`, `parseGrade.ts`, `prompt.ts` (this module **composes** them); `SOURCE/lib/supabase/service-role.ts` (B1.3b owns it).
- **Unselected integration candidate I-E** ("gradeEssays orchestration order", AC-072, ROI 57) lives here. It is covered at unit level with real ordering assertions; if the engineer later wants it in the integration lane, this and **I-D** (`retryEssayGrading` refusal matrix, ROI 49) are the two to swap in first, in that order.
- Wall-clock exhaustion is a **designed degradation**: unclaimed questions keep `essayAttempts: 0` and stay fully retryable.
