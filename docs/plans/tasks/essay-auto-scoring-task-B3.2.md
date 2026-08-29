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
- [ ] `SOURCE/app/(layer2)/essayActions.ts` (new)
- [ ] `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx`
- [ ] `SOURCE/app/(layer2)/__tests__/essayActions.test.ts` (new)

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
_(Record here: the five refusal cases and the evidence that each produced zero provider requests and an unchanged budget key; the `digest`-only console payload; the `L1` dev run's outcome.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write `essayActions.test.ts` covering the five refusal cases and the success path, with counted provider and budget mocks; observe failure

### 2. Green Phase
- [ ] Create `essayActions.ts`: `"use server"`, typed result, **no throw, no redirect**, authorise **before** meter (twice — student's client, then SQL), the five-reason refusal union, the flag check, `digest`-only logging
- [ ] Wire this file's telemetry call sites using B3.1's literals
- [ ] Add `export const maxDuration` to the result-detail route segment
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm the scored branch of `result/detail/page.tsx` (`:133` onward) is **untouched**
- [ ] Confirm no path throws and no path redirects
- [ ] Confirm the flag check returns `reason: "server"` when off

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the closed refusal union — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: the route segment config and the `"use server"` boundary — Config: `SOURCE/package.json` (project-wide)

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
- [ ] **Entry condition**: Gate A5b ticked before the dev `L1` run
- [ ] **Implementation Complete** = action + segment config + **this file's** telemetry call sites
- [ ] **Quality Complete** = six verify gates green (with H7's known-red ceiling assertion recorded as expected)
- [ ] **Integration Complete** = **L1** on a **seeded** dev attempt — pressing retry on a `failed` question yields a band; a refusal returns exactly one specific reason
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task F-C1's `EssayRegradeControl` maps this action's five refusal reasons through `REFUSAL_KEY`.
- Scope boundary — preserve unchanged: the **scored branch** of `result/detail/page.tsx` (`:133` onward — TBD-02's deferral stays in force); `SOURCE/app/(layer2)/actions.ts` (Task B1.5); `SOURCE/lib/essay/gradeEssays.ts` (B1.4 created it, B3.1 wired its telemetry).
- **Unselected integration candidate I-D** ("`retryEssayGrading` refusal matrix", EG-BE-022, ROI 49) lives here. Covered at unit level; it is the **second** case the engineer should swap into the integration lane if budget frees up, after I-E.
