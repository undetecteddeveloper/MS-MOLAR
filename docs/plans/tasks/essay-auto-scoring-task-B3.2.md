# Task B3.2 — `app/(layer2)/essayActions.ts` — the retry Server Action + `maxDuration`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B3 (Retry, Telemetry and the Ceiling Ripple, vertical slice V3), Task B3.2**
Layer: **backend** (`SOURCE/app/(layer2)/**`)

Metadata:
- Dependencies: **Task B3.1**, **Task B2.1**, **Task B1.4** (this action drives the same claim → budget → provider → settle path `gradeEssays.ts` owns).
- Blocks: **Task F-C1** (`EssayRegradeControl` calls this action).
- Provides: `retryEssayGrading(attemptId, questionId)` — typed result, no throw, no redirect — plus the result-detail segment's `maxDuration`.
- Size: Small (3 files)
- Verification level: **L1** on dev.

## ENTRY CONDITION: Gate A5b ticked

**A1 + A2 + A5** — a Groq account, the key in `SOURCE/.env.local`, and **Zero Data Retention ON** — are the precondition for **ANY** Groq request, **including dev**. **A5b is currently BLOCKED on A2.**

**No task may set `ESSAY_GRADING_ENABLED=true` anywhere until A5b ticks.** After A5b, dev runs use **SEEDED data only — never a real student attempt.** The `L1` completion evidence below reaches `api.groq.com`.

## Implementation Content

Create `SOURCE/app/(layer2)/essayActions.ts` with `"use server"`, exporting `retryEssayGrading(attemptId, questionId)`. **Typed result, no throw, no redirect** — the caller is an affordance inside an already-rendered page (precedent: `tutorActions.ts:8-12`, citing `rateExam()`). It lives in its **own file**, not in `actions.ts`, following the recorded rule at `tutorActions.ts:1-6` ("everything guarding the door sits in one file you can read in one pass").

### Order (Gate G / AC-072): authorise **before** metering
The check runs **twice, deliberately**:
1. once reading through the **student's** client so RLS filtering yields the *specific* refusal reason;
2. once enforced in **SQL** so a wrong call site still cannot write.

Dropping the first turns every refusal into a generic sentence; dropping the second puts the rule at the call site — exactly the reasoning ADR-0010 used to reject a policy-only fix.

### Refusal union
`not_found | not_failed | exhausted | budget | server`.

The **flag is also checked here** (read site **2 of 3**) and returns `reason: "server"` when off — without it, a disabled feature still lets the retry button burn budget.

`console.error` logs **`digest` only** (pattern: `RecheckOrderControl`); a Postgres error message crossing this boundary **can echo the student's answer back**.

### Telemetry call sites for this file are wired here (I007)
Using the `event_type` and the three `error_code` literals that **Task B3.1** already added. B3.1 wires `gradeEssays.ts`; this task wires `essayActions.ts`, because this is the commit that creates it.

### Route segment
Add `export const maxDuration` to `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` — the route segment for this action. **Do not touch that file's scored branch (`:133` onward)**; TBD-02's deferral stays in force.

## Target Files
- [x] `SOURCE/app/(layer2)/essayActions.ts` (new)
- [x] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` — `export const maxDuration = 300`
- [x] `SOURCE/app/(layer2)/__tests__/essayActions.test.ts` (new) — 41 cases
- [x] `SOURCE/lib/security/rateLimit.ts` — **extra, forced**: `guard()` cannot be called without a `RATE_LIMITS` key
- [x] `SOURCE/lib/security/rateLimit.test.ts` — **extra, forced**: the classification guard goes red until the new action is categorised

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `essayActions.ts`: `retryEssayGrading(attemptId, questionId)`, typed result, no throw, no redirect, authorise before meter)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — `maxDuration` on the result-detail route segment)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Security Considerations — the three console-logging rules; `digest` only at the Server Action boundary)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 6: ordering claim → reserve → provider → settle is a requirement)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision — the reasoning that rejected a policy-only fix)
- `SOURCE/app/(layer2)/tutorActions.ts` (`:1-6` the one-file rule; `:8-12` the typed-result, no-throw, no-redirect precedent citing `rateExam()`)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:75` the `notScored` branch — F-B1's territory; `:133` onward the **scored branch, untouched**)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — the same claim → budget → provider → settle path)
- `SOURCE/lib/tutor/telemetry.ts` (Task B3.1 — the event type and the three error codes)
- `SOURCE/app/(layer2)/queries.ts` (Task B2.1 — the read this action authorises against)
- `SOURCE/components/billing/RecheckOrderControl.tsx` (`:181-184` — why `console.error` logs `digest` only)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `ESSAY_MAX_ATTEMPTS`, the states)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The Groq budget reserves the worst case in a single `INCRBY` before the first request, on a Groq-only daily key, never on the Gemini key; fail closed. **Ordering claim → reserve → provider → settle is a requirement** | The action authorises before metering, and drives the same ordered path `gradeEssays.ts` owns |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop |
|---|---|
| Owner (left) | Vercel / `.env.local` |
| Owner (right) | `submitExam()` (behaviour gate), **`retryEssayGrading()` (behaviour gate — read site 2 of 3)**, the player route segment (copy gate) |
| Serialized format | Env string; **only** `"true"` (trimmed) means on. **Never** `NEXT_PUBLIC_*` (UI-D7) |
| Consumer parse rule | With the flag off, this action returns `reason: "server"` — without that check, a disabled feature still lets the retry button burn budget |
| Expected signal | All three read sites read **one** variable and flip together in a single deploy |

## Investigation Notes

### Two contradictions inside this task file, resolved against the Design Doc and the downstream consumer

**1. `already_graded` is not a refusal reason.** The Proof Obligation for AC-063 says a retry on an already-graded question is "a no-op returning `already_graded`". It cannot be: `RetryRefusal` is a closed five-member union (`not_found | not_failed | exhausted | budget | server`, Design Doc `:1366`) while `already_graded` is a **`ClaimReason`** (`:1393`) — a different union on the SQL side. The Design Doc and **Task F-C1** agree on the resolution: F-C1's `REFUSAL_KEY` maps `not_failed` to `result.essay.retryAlreadyGraded` *"because under AC-063 a retry on a graded question is a normal outcome, not an error"*. So `already_graded` maps to `not_failed`, declared in a `Record` (adding a SQL reason is then a compile error, not a silent fall-through into another reason's sentence). Mutation **M8** pins it.

**2. "Size: Small (3 files)" is wrong — it is 5.** `guard()` takes `action: keyof typeof RATE_LIMITS`, so the Design Doc's mandatory step 1 is **unreachable** without a new `RATE_LIMITS` entry. That is `rateLimit.ts` **and** `rateLimit.test.ts`. This is the **fifth** consecutive task needing files beyond its list (B2.1, B2.2, B2.3, B3.1, B3.2) — at this point it is a property of these task files, not an accident.

### The new rate-limit entry needed a FOURTH category, not a fourth row
`rateLimit.test.ts` carries a guard that fired exactly as designed the moment the entry was added: `classifies every configured action into exactly one category` went red (1 failed / 13 passed), because its lists are enumerated explicitly and compared against `Object.keys(RATE_LIMITS)`.

`retryEssayGrading` could **not** join `SUPPLIER_CAPPED_ACTIONS`: both invariants on that list are denominated in **Gemini** — `limit <= SUPPLIER_DAILY_QUOTA` (20) and a `GEMINI_REQUESTS_PER_CALL` record. Retry spends **Groq**. Filing it there would measure a Groq number against a Gemini ceiling and make *both* invariants lie while staying green. Hence a fourth list, `GROQ_CAPPED_ACTIONS`, pinning the two things that can honestly be pinned:

- `windowMs === ONE_DAY_MS` — the counter beneath it is `groq:budget:{day}`, so the unit must match (the rule `RATE_LIMITS.explainStep` already wrote out).
- one account's worst case read **in Groq requests** — `limit * GROQ_CALLS_PER_ESSAY`, imported from the emitter rather than retyping `3` (the TD-019 lesson).

`10/day` because SQL already caps 3 attempts **per question**; this ceiling guards against an automation loop, not against the student. Worst case is 30 Groq requests/account/day, a small fraction of any sane `GROQ_BUDGET_DAILY_LIMIT` — which `budget.ts` enforces independently and fail-closed.

### Why the action does not call `gradeEssaysForAttempt()`
The orchestrator runs **many** questions under a concurrency cap and a wall-clock cap, **swallows every outcome**, and returns `void`. Retry needs the opposite: **one** question and a **typed outcome** to hand back to the screen. The architecture diagram settles it independently — `Retry[...] --> CL` points straight at the claim node, the same node the automatic pass uses. What is shared is the four primitives (claim, budget, provider, settle) in the same order; the **order itself** is pinned by `mock.invocationCallOrder` at **both** entry points, because inverting it at either one opens the same hole.

### Order note: step 1 runs after step 2's read, and that is the Design Doc's own reference
The contract numbers the rate limit as step 1 but cites `actions.ts:75` — where `submitExam()` reads the attempt **first** and takes the key from the RLS-filtered row, with the reason written out at that line. Accepting `userId` from the client instead would let one user drain another's bucket: a targeted denial of service. Same order here, same reason.

### `rate_limited` has no seat in the five-member union
A `guard()` refusal maps to `server` — the only member meaning "refused for a reason outside the other four". Mapping it to `budget` would tell the student the **project** budget is gone when what they actually hit is their own bucket. Telemetry still records it precisely as `rate_limited`, so the two remain distinguishable in SQL even though the UI shows one sentence. Recorded as a small deliberate gap in the contract rather than papered over.

### Refusals settle nothing, and that is deliberate
Every failure path after the claim returns **without** a `recordEssayGrade(..., "failed", ...)`. The automatic pass settles `failed` because its question was `pending`; here step 3 has already **required** the question to be `failed`, so another write would only push `essayGradedAt` forward without changing anything the student sees.

### Accepted cost, carried over verbatim
A retry refused at **step 5** (budget) still consumes one of the three attempts, because D4 spends the attempt at claim and AC-072 requires claim before metering. Not reorderable — reordering opens exactly the hole AC-072 exists to close. UI-D9 already anticipated this by not displaying the attempt count.

### Mutation testing — the required evidence, since all 41 cases were green on the first run
The action was written before its tests, so no Red was ever observed for this file. Nine mutants, **all nine killed**:

| # | Mutation | Result |
|---|---|---|
| M1 | reserve budget **before** the claim (invert AC-072) | **Killed** — 5 failed |
| M2 | remove the feature-flag gate | **Killed** — 5 failed |
| M3 | drop the `retryAvailable` (exhausted) check | **Killed** — 2 failed |
| M4 | log the whole `err` instead of `digest` | **Killed** — 1 failed |
| M5 | settle band 0 on invalid output (break AC-007) | **Killed** — 1 failed |
| M6 | ignore the rate-limit result | **Killed** — 1 failed |
| M7 | counter-store failure reported as `budget` | **Killed** — 1 failed |
| M8 | `already_graded` mapped to `server` instead of `not_failed` | **Killed** — 1 failed |
| M9 | drop the `status === "submitted"` check | **Killed** — 1 failed |

### EG-BE-022 — every refusal measured on the counter itself
`budget.ts` and `groqClient` run **real code**; only `fetch` and `@upstash/redis` are mocked. Every refusal case asserts `fetch` uncalled **and** `incrby`/`decrby` uncalled through a shared `expectNothingSpent()` — so "the budget key is unchanged" is a measurement on the counter, not a claim about it.

### Still open: the L1 dev run
Everything above is L2. **Integration Complete for this task is NOT met** — it needs the seeded dev run (Gate A5b), which spends live Groq budget and is the engineer's call. It is the same run that still gates B1.5 and B2.1.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [~] Tests were written **after** the action, so no Red was observed for `essayActions.ts`. **Mutation testing substitutes**, per standing practice — nine mutants, all killed (table above). A genuine Red *was* observed on `rateLimit.test.ts`: adding the entry turned the classification case red (1 failed / 13 passed) before the fourth category existed

### 2. Green Phase
- [x] `essayActions.ts` created with all of it: typed result, no throw, no redirect, authorise before meter (student's client, then SQL), the five-reason union, the flag check, `digest`-only logging
- [x] Telemetry wired with B3.1's literals — `not_eligible` for every authorisation refusal (the code B3.1 deliberately did **not** write on the automatic path), plus the shared codes for budget/provider/parse/settle outcomes
- [x] `export const maxDuration = 300` on the result-detail segment
- [x] `41 passed (41)`, exit **0**

### 3. Refactor Phase
- [x] Scored branch of `result/detail/page.tsx` **untouched** — the only edit is the `maxDuration` export near the imports; TBD-02's deferral stays in force
- [x] No path throws, no path redirects — the whole body sits in one `try`, and a test drives `createClient()` itself into rejection to prove the outer net
- [x] Flag off returns `reason: "server"` **and never constructs a client** (asserted); mutation M2 pins it

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the closed refusal union — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: the route segment config and the `"use server"` boundary — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 135 files passed / 1 skipped; **1945 passed, 10 skipped, 0 todo** (was 1902 — **+43**: 41 new `essayActions.test.ts` cases + 2 new rate-limit invariants), 45.7 s |
| 4 | `npm run build` | **0** | Confirms the `"use server"` boundary and the new route-segment `maxDuration` |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline ONLY**: exactly 2 failures, both `subscription.fixture.e2e.test.ts > FE-1 (e) ... > locale en` and `locale vi`, named individually from the run. CRLF churn on `RichText.regression.test.tsx.snap` reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — **Task H8**, still open) |
| 7 | `npm run check:bundle` | **0** | Run although not listed: this task adds a file importing `groqClient`/`budget`, both on the `GROQ_API_KEY` path |

`npm run verify:schema` was **not run** — this task touches no schema and no `LIMITS` constant. Its character-ceiling assertion stays red by design in the H7 to B3.3 window (Fix I002).

**A task file with any exit-code cell left empty is not complete** (Gate E4).
**Known-red window (Fix I002)**: this commit sits between H7 and B3.3 — if `verify:schema` is run, its character-ceiling assertion is red **by design**; record it as expected. Any **other** red `verify:schema` assertion is a regression.

## Operation Verification Methods
- **Verification method**: drive each of the five refusal cases with counted provider and Redis mocks and assert **zero** provider requests **and** an unchanged `groq:budget:{day}`; then **L1** on a **seeded** dev attempt (Gate A5b ticked) — press retry on a `failed` question and receive a band.
- **Success criteria**: each refusal returns exactly **one specific reason**; zero provider requests and an unchanged budget key on every refusal; the `L1` run yields a band, and a refusal yields exactly one specific reason.
- **Failure response**: if metering precedes authorising, **stop** — an unauthorised caller with a self-composed `attemptId` can drain the single unmetered project budget, denying grading to every student that day and triggering cross-account grading. If a Postgres error message crosses the boundary, the `digest`-only rule was broken: a Postgres message **can echo the student's answer back**, and `Error#message` is non-enumerable so such a leak does **not** show under `JSON.stringify`.
- **Verification level**: **L1** — on a **seeded** dev attempt, pressing retry on a `failed` question yields a band.

## Proof Obligations
- **Claim (EG-BE-022)**: for **each** refusal case — not the owner; attempt not `submitted`; not an essay; not in `failed`; attempts exhausted — **zero** provider requests **and** `groq:budget:{day}` unchanged.
  - **Primary failure mode**: a refusal that still spends budget, so a denied caller can drain the day's ceiling for everyone. **Boundary**: in-process with counted `fetch` and Redis mocks; Supabase mocked at its sanctioned boundary. **State assertion**: budget key value before → refusal → unchanged. **Mock rationale**: `fetch`, Redis and `createClient()` are the external I/O boundaries; the ordering logic runs real code. **Residual**: the SQL-side enforcement is proven by Task H8.
- **Claim (AC-025)**: retry is **user-triggered** — no automatic background retry across passes — and each retry passes through the same gate.
  - **Primary failure mode**: an automatic retry loop quietly multiplying spend. **Boundary**: in-process. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (AC-063)**: a retry on an already-graded question is a **no-op** returning `already_graded`.
  - **Primary failure mode**: the AC-063 race treated as an error, so the student sees a failure sentence when the poller simply landed a band first. **Boundary**: in-process. **State assertion**: the stored band unchanged. **Mock rationale**: as above. **Residual**: the SQL first-write-wins predicate is proven by H8 SVC-1(d).
- **Claim (AC-064)**: the cap is enforced **in SQL**, and the UI hiding the button is **not** treated as enforcement.
  - **Primary failure mode**: relying on the control's disabled state, which a hand-made request bypasses. **Boundary**: in-process for the action; the real cap is H8 SVC-2(b). **State assertion**: `essayAttempts` unchanged on a refused claim. **Mock rationale**: as above. **Residual**: SVC-2 proves the claim refuses; the "with zero provider calls" half is B1.4's and this task's.
- **Claim (AC-072 / Gate G)**: authorisation precedes metering at this entry point.
  - **Primary failure mode**: metering first, so a self-composed `attemptId` denies grading to every student for the day. **Boundary**: in-process with invocation-order assertions. **State assertion**: N/A. **Mock rationale**: as above. **Residual**: none.
- **Claim (the `digest`-only logging rule)**: `console.error` logs **`digest` only**.
  - **Primary failure mode**: a Postgres error message echoing the student's answer back through the Server Action boundary — and `Error#message` is non-enumerable, so the leak does **not** show under `JSON.stringify`; it shows only at a real console, i.e. late. **Boundary**: in-process with a spied `console.error`, asserting the payload's key set. **State assertion**: N/A. **Mock rationale**: `console.error` spied. **Residual**: none.

## Completion Criteria
- [x] **Entry condition**: Gate A5b ticked. **No Groq request was made by this commit** — every test mocks `fetch`
- [x] **Implementation Complete** = action + segment config + this file's telemetry call sites (+ the two forced rate-limit files)
- [x] **Quality Complete** = seven gates run **separately with real exit codes**; six at 0, `test:fixture` at 1 with the TD-030 pair named individually
- [ ] **Integration Complete** = **NOT MET.** Needs the seeded dev `L1` run, which spends live Groq budget and is the engineer's call. Same run that gates B1.5 and B2.1
- [x] Every Binding Decision Compliance Check evaluates to `Y` — the action authorises before metering, proven by `mock.invocationCallOrder` and by mutation M1
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task F-C1's `EssayRegradeControl` maps this action's five refusal reasons through `REFUSAL_KEY`.
- Scope boundary — preserve unchanged: the **scored branch** of `result/detail/page.tsx` (`:133` onward — TBD-02's deferral stays in force); `SOURCE/app/(layer2)/actions.ts` (Task B1.5); `SOURCE/lib/essay/gradeEssays.ts` (B1.4 created it, B3.1 wired its telemetry).
- **Unselected integration candidate I-D** ("`retryEssayGrading` refusal matrix", EG-BE-022, ROI 49) lives here. Covered at unit level; it is the **second** case the engineer should swap into the integration lane if budget frees up, after I-E.
