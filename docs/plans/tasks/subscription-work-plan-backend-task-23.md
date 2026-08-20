# Task: Gate the tutor path (I2), without reopening the eligibility-disclosure surface (UI-D3 / AC-041)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.3**
Layer: **backend** (server action `SOURCE/app/(layer2)/tutorActions.ts`)

Metadata:
- Dependencies: backend-task-21 (`consumeQuota`), backend-task-22 (the chokepoint)
- Provides: the tutor-side enforcement; its telemetry code is mapped in plan Task 5.5
- Size: Small (1 file + test)

`Change Category: state-change`

Adds a refusal branch that consumes a per-user counter. Sweep the adjacent cases sharing that path — the existing `guard("explainStep", …)` refusal at `:171` and the four-literal client-visible union at `:51` — for the same class of defect: a refusal that leaks *why* it refused.

## Implementation Content

Add `consumeQuota("tutor", userId, ent, 1)` **beside** the existing `guard("explainStep", userId)` at `SOURCE/app/(layer2)/tutorActions.ts:175`. **Access control does not move into `callTutor.ts`.**

### Constraint, binding — the two codes this refusal produces are different codes, and only one of them is client-visible

- **Returned to the client**: one of the **four already-declared** `ExplainStepError` literals — `"not_eligible" | "rate_limited" | "gemini_unavailable" | "server"` (`tutorActions.ts:51`). **No fifth literal is added to that union.** This plan names **`not_eligible`**, matching the code the shipped server-side re-check refusal already returns at `tutorActions.ts:171`; because all four collapse to one rendered message, substituting a different member of the same four changes nothing observable, and **adding a fifth changes everything**.
- **Written to `telemetry_log.error_code`**: the *distinct* code — `user_quota_exhausted` or `project_budget_exhausted` per plan Task 5.5 OK-04 mapping (`"unavailable"` ⇒ `server`). **This is where the new distinction lives, and the only place it lives.**

### Completion criterion (binding)

`SOURCE/components/tutor/ExplainStepAffordance.tsx` ships **unmodified** — `:96-99` collapse is intact and the four client-visible codes remain **indistinguishable** to a user. An implementation that returns a distinguishable client-visible quota reason satisfies AC-041 surface reading **while reopening the disclosure surface UI-D3 deliberately closed, and is rejected.**

**The positive half of AC-041 is already observable and already asserted**: FE-2 (plan Task 2.5, item (e)) asserts the pre-emptive exhausted-state string is **NOT EQUAL** to the resolved `t("tutor.error")` value in the same locale. AC-041 is satisfied *before* the press, from entitlement — not *after* the failure, from an error code. That is UI-D3 whole mechanism, and **this task must not move it**.

## Target Files
- [ ] `SOURCE/app/(layer2)/tutorActions.ts` (gate added beside `:175`)
- [ ] `SOURCE/app/(layer2)/__tests__/tutorActions.test.ts` (added cases)

## Investigation Targets
- `SOURCE/app/(layer2)/tutorActions.ts` (`:51` the four-literal `ExplainStepError` union; `:171` the shipped `not_eligible` refusal; `:175` `guard("explainStep", …)`) — **adjacent cases for the state sweep**
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (`:96-99` — the collapse; **read only, must ship unmodified**)
- `SOURCE/lib/billing/quota.ts` (plan Task 5.1 — `consumeQuota` three reasons)
- `SOURCE/lib/tutor/telemetry.ts` (the write target for the distinct code; widened in plan Task 5.5)
- `SOURCE/lib/tutor/callTutor.ts` (confirm no access control, quota or budget enters it)
- `docs/design/subscription-backend-design.md` (§ Integration Point I2)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `ExplainStepAffordance` (modified) — C-05 — verify default (idle) + loading (busy) + error + partial (hint-shown) + blocked-quota states)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes) | state-lifecycle-negative | **"When the backend later introduces a distinct quota code, the split must preserve `not_eligible`, `server` and `gemini_unavailable` as one indistinguishable group — that constraint is recorded for the backend phase, not resolved here."** With its rationale: *"distinguishing the codes would leak that the server re-runs an eligibility check (`not_eligible`)"* — `ExplainStepAffordance.tsx:96-99`. The client-visible union stays exactly `"not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server"` (`tutorActions.ts:51`) and all four keep rendering **one** message | The client-visible union is unchanged at four literals; the quota refusal returns `not_eligible`; `ExplainStepAffordance.tsx` is byte-unmodified |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the four-literal union and the `:171` refusal verbatim
- [ ] **State sweep**: enumerate every refusal branch in this action and confirm each returns a member of the four literals
- [ ] Write failing tests first: `ok:false` ⇒ **zero** `callTutor` invocations (assert the **count**); the returned `error` is a member of the four-literal union; the telemetry row written in the same branch carries the **distinct** quota code — asserted as an **inequality between the two values**
### 2. Green Phase
- [ ] Add the gate beside `:175`; run only the added tests
### 3. Refactor Phase
- [ ] Confirm `ExplainStepAffordance.tsx` and `callTutor.ts` are unmodified

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `npx tsc --noEmit` — Enforces: the client-visible union stays exhaustive at four literals — Config: `SOURCE/tsconfig.json`
- `telemetry.test.ts:261` two-layer guard — Enforces: `TELEMETRY_ERROR_CODES` matches the CHECK constraint; **must pass unmodified** — Config: `SOURCE/lib/tutor/__tests__/telemetry.test.ts`
- `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests over the server action with `consumeQuota`, `callTutor` and the telemetry writer mocked and counted.
- **Success criteria**: a refused call makes **zero** `callTutor` invocations; the client receives one of the four literals (`not_eligible`); the telemetry row carries `user_quota_exhausted` / `project_budget_exhausted` / `server`; the two values are asserted **unequal**.
- **Failure response**: if the implementation returns a distinguishable client-visible quota reason, **reject it and revert to `not_eligible`** — it reopens the disclosure surface UI-D3 closed.
- **Verification level**: L1 at phase level (a Free user sixth tutor call is refused with a distinguishable reason **in telemetry** and the row lands in `telemetry_log`); L2 in this task.

## Proof Obligations
- **Claim**: a refusal is attributable in telemetry and indistinguishable to the client.
- **Primary failure mode**: a future "simplification" returns the telemetry code to the client, leaking that the server re-runs an eligibility check.
- **Boundary to exercise**: the server action public return value, plus the telemetry write, both captured.
- **State assertion**: refusal branch — `callTutor` invocation count **0**; one telemetry row written carrying the distinct code; the returned client code **≠** the telemetry code.
- **Mock boundary rationale**: `consumeQuota`, `callTutor` and the telemetry writer are mocked at their module boundaries; the action branch logic stays real.
- **Residual**: AC-041 pre-press half is discharged by FE-2 (plan Task 2.5), not here.

## Completion Criteria
- [ ] All added tests pass, asserting counts and the code inequality
- [ ] `SOURCE/components/tutor/ExplainStepAffordance.tsx` ships **unmodified**
- [ ] The client-visible refusal union is still exactly four literals
- [ ] The quota distinction exists **only** in `telemetry_log.error_code`
- [ ] The Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: `SOURCE/app/(layer2)/tutorActions.ts`; downstream, plan Tasks 5.5 (the mapping) and 5.7 (the three-cause telemetry proof).
- Scope boundary (must remain unmodified): `SOURCE/components/tutor/ExplainStepAffordance.tsx`; `SOURCE/lib/tutor/callTutor.ts` responsibilities.

## Investigation Notes
(Record the state sweep, the asserted inequality, and the Compliance Check result here.)

### Session 2026-08-20 — Investigation (pre-implementation), ESCALATED before the Red phase

**Investigation Targets read in full:** `tutorActions.ts`, `ExplainStepAffordance.tsx`,
`lib/billing/quota.ts`, `lib/tutor/telemetry.ts`, `lib/tutor/callTutor.ts`,
`lib/tutor/__tests__/telemetry.test.ts` (`:49`, `:261`),
`lib/schema/__tests__/schemaFingerprint.test.ts` (`:138-143`),
backend DD (`:224`, `:1068` I2), work plan Phase 5 (Tasks 5.1–5.8),
task-25 (plan Task 5.5) as the owner of the telemetry constant.

**State sweep — every refusal branch of `explainStep()` today, and the code each returns:**

| Branch | Line | Client code | Telemetry `errorCode` written |
|---|---|---|---|
| `exam_attempts` read failed | `:169` | `server` | *(none — no `userId` yet)* |
| attempt not found / not owned | `:171` | `not_eligible` | *(none — no `userId` yet)* |
| `guard("explainStep")` refused | `:183` | `rate_limited` | `rate_limited` |
| history read failed | `:191` | `server` | `server` |
| server-side wrong-twice re-check failed | `:209` | `not_eligible` | `not_eligible` |
| question read failed | `:222` | `server` | `server` |
| question missing / essay | `:243` | `not_eligible` | `not_eligible` |
| `generateHint()` threw | `:276` | `TutorCallError.code` else `server` | same value |

All eight return a member of the four-literal union at `:51` — confirmed verbatim:
`export type ExplainStepError = "not_eligible" | "rate_limited" | "gemini_unavailable" | "server";`
No branch discloses *why* beyond those four. `callTutor.ts` carries no access control,
quota or budget import (only `recordUsage` from `lib/ugc/quotaTracker`, the pre-existing
supplier-side counter, and a `TelemetryErrorCode` type import).

**BLOCKER — the task's two halves cannot both hold today (escalated, no implementation written).**

The client half is implementable now. The telemetry half is not:

1. `lib/tutor/telemetry.ts:35` — `TELEMETRY_ERROR_CODES` is still the **four** literals
   `["gemini_unavailable","rate_limited","server","not_eligible"]`. It is the sole source of
   both the type (`:37`) and the **runtime filter** `toErrorCode()` (`:78`).
2. Therefore a refusal branch that passes `"user_quota_exhausted"` to `recordTutorInvoke()`
   (a) does not type-check (`TelemetryEvent.errorCode` is `TelemetryErrorCode | null`), and
   (b) even forced through with a cast, is **nulled at runtime** by `toErrorCode()` before the
   insert — `telemetry_log.error_code` would receive `null`, not the distinct code. The task's
   Completion Criterion *"the quota distinction exists only in `telemetry_log.error_code`"*
   would be **false in the shipped path** while a mock-boundary assertion stayed green: exactly
   the defect class this plan hunts.
3. Widening `TELEMETRY_ERROR_CODES` here is **not available to this task**: it is
   plan Task 5.5 / backend-task-25's Target File, and widening it without also updating
   `telemetry.test.ts:49` (hand transcription, still four) and
   `schemaFingerprint.test.ts:143` (`CODES_PENDING_ON_TS_SIDE`, the deliberate tripwire that
   *"goes red the moment Task 5.5 widens `telemetry.ts`"`) turns two shipped guards RED —
   and this task's own Quality Assurance Mechanisms require `telemetry.test.ts:261` to
   **pass unmodified**.
4. The backend DD's own I2 row (`:1068`) states the verification for this integration point as
   *"Unit test: `ok:false` ⇒ zero `callTutor` invocations"* only; the OK-04 mapping is carried by
   I11 / plan Task 5.5, whose Target Files list both refusal sites for exactly that reason.

**Reference Contracts Compliance Check — deferred (`Unknown`), not evaluated against an
implementation, because implementation was stopped before the Red phase.** The single row
(UI-D3) is satisfiable and was planned as: client-visible union untouched at four literals;
the quota refusal returns `not_eligible`; `ExplainStepAffordance.tsx` untouched. No file under
`SOURCE/` was modified in this session — `ExplainStepAffordance.tsx` is byte-unmodified.

### Session 2026-08-20 (continued) — executed after foundation commit `6d2fd26` unblocked the telemetry half

`TELEMETRY_ERROR_CODES` re-read at `telemetry.ts:35`: now **six** literals, and `toErrorCode()`
passes the two new ones through. The blocker recorded above is closed; nothing else in the
earlier analysis changed.

**Implemented** (`tutorActions.ts`): `readEntitlement(userId)` + `consumeQuota("tutor", userId,
ent, GEMINI_CALLS_PER_OPERATION.tutor)` as gate **3**, after the rate-limit block and before the
wrong-twice re-check; refusal writes the mapped telemetry code and returns `not_eligible`.
The OK-04 mapping is a `const … as const satisfies Record<Extract<ConsumeResult, {ok:false}>
["reason"], TelemetryErrorCode>` at `:59`, so a fourth `consumeQuota` reason is a **compile
error** — verified by probe M13 (two `tsc` errors, TS1360 + TS7053), not merely asserted.

| `consumeQuota` reason | `telemetry_log.error_code` | client-visible code |
|---|---|---|
| `user_quota` | `user_quota_exhausted` | `not_eligible` |
| `project_budget` | `project_budget_exhausted` | `not_eligible` |
| `unavailable` | `server` (no third literal — R13 scope) | `not_eligible` |

**Reference Contracts Compliance Check — `Y`** (evaluated against the final implementation, not
the plan): the client-visible union at `:54` is **byte-unchanged** at four literals (pinned two
ways — `Record<ExplainStepError, true>` under `tsc`, and a source scan of every `return { error:
"…" }`); the quota refusal returns `not_eligible`; `ExplainStepAffordance.tsx` is byte-unmodified
(md5 `6aec4ba686963d7c3c6d351236b0cc09`, unchanged from before this session, `git diff` empty).
`callTutor.ts` likewise untouched — it gained no access control, quota or budget.

**Adjacent-case sweep (`state-change`) — done, no residual in scope.** All eight pre-existing
refusal branches were re-checked after the insertion: each still returns a member of the four
literals, and the new branch joins them. The one adjacent invariant the sweep surfaced and the
tests now pin: a **rate-limited** call must not also burn a period unit — `consumeQuota()` does
`INCR` before comparing, so calling it for an already-refused request charges a user for a
request that never reaches Gemini. Probe M8 (gates swapped) confirms that case is not vacuous.

**BLOCKER — one pre-existing test goes RED, and it encodes a binding decision, so it was NOT
edited.** `app/(layer2)/__tests__/layout.test.tsx:376` (`describe("Binding decision ADR-0013 —
một phép tính quyền lợi, KHÔNG có đường đọc thứ hai")`) walks `app/`, `components/` and `lib/`
and asserts the only files mentioning `readEntitlement` in **code lines** are four allowlisted
paths (the three route-group layouts + the defining module). This task's gate makes
`app/(layer2)/tutorActions.ts` a fifth. Full suite: **1478 passed / 1 failed / 10 skipped**, and
that one failure is this scan — every other file, including both known flakes, is green.

Why it is not resolvable inside this task's Target Files: `consumeQuota` requires a real
`Entitlement` (it reads `ent.plan` for `PLAN_LIMITS`/`budgetCeiling` and `ent[kind]` for the
period start), `readEntitlement()` is its only producer, a wrapper anywhere under `lib/` trips
the same scan, and `quota.ts` cannot call it without an import cycle (recorded in plan Task
5.1). Passing an entitlement in from the client would be both an interface change and a forgeable
security input in the one file whose stated design is to trust nothing the caller declares.
**Plan Task 5.4 hits the identical wall** at `app/(layer4)/actions.ts`, so the rule wants stating
once for both — escalated rather than patched.

### Session 2026-08-20 (continued) — ADR-0013 guard amended, not weakened

Coordinator upheld the escalation and directed the **split** variant. Amended
`SOURCE/app/(layer2)/__tests__/layout.test.tsx` only; **no ADR file was edited** and
ADR-0013 text is untouched.

**What changed**: the one flat scan became **two scans over the same walked file set**,
partitioned by a predicate on the `"use server"` directive prologue — so the partition is
exhaustive by construction and no file escapes both lists.

- **Render path** (no directive): allowlist is byte-identical to before — the three route-group
  layouts + `lib/billing/readEntitlement.ts`. Same rule, same strictness.
- **Server actions** (directive present): a separate allowlist, one entry, carrying its reason —
  `app/(layer2)/tutorActions.ts`. Plan Task 5.4 adds `app/(layer4)/actions.ts`.

Grounds recorded at the allowlist: ADR-0013 forbids two **implementations** (*"Two independent
implementations of a money-adjacent predicate is the shortest path to two different answers on
the same account"*), and a Server Action calling `readEntitlement()` is the single implementation
invoked from a second place — while the two alternatives (deriving entitlement inside
`consumeQuota()`, or accepting it from the client) are what would actually produce a second
answer. The render-path remedy is physically unavailable in an action (no React context; a
client-supplied entitlement is forgeable). ADR-0013 itself classes actions as existing mechanism:
*"Purchase and reconciliation are Server Actions, per the existing precedent"*. The runtime half
of the guard (`readEntitlementCallCount() === 1` per render) is **untouched**.

Directive detection matches the **first code line** against `/^"use server";?$/`, not
`includes()`: a mention inside a comment must not re-classify a file. Double quote only —
`.prettierrc` sets `singleQuote: false`, and a hand-written single-quoted directive falls into
the *stricter* render-path branch, which is the safe direction.

**Five probes, each anchor matched exactly once, each verified to change the file:**

| Probe | Expected | Observed |
|---|---|---|
| G1 `readEntitlement` added to a page with no directive (`app/(layer2)/exams/page.tsx`, CRLF) | RED | RED — render-path case, `['app/(layer2)/exams/page.tsx']` |
| G2 same, in a `lib/` helper (`lib/billing/pricing.ts`, CRLF) | RED | RED — render-path case, `['lib/billing/pricing.ts']` |
| G3 a NEW `"use server"` module not on the action allowlist (`app/(layer4)/probeActions.ts`) | RED | RED — server-action case; **this is the property the flat list lacked** |
| G4 `"use server"` removed from `tutorActions.ts` | RED | RED — it falls into the render-path bucket, proving the classifier keys on the directive and not on the path |
| G5a `// "use server"` added as a comment to `app/(layer2)/layout.tsx` | GREEN (must not flip) | GREEN, 10/10 |
| G5b same comment **plus** a naive `source.includes("use server")` detector | RED | RED — server-action case names `app/(layer2)/layout.tsx`, so G5a green is discriminating, not vacuous |

**Target Files naming deviation, accepted and recorded**: the task file names
`SOURCE/app/(layer2)/__tests__/tutorActions.test.ts`, which does not exist. The real file is
`tutorActions.int.test.ts`, collected by `npm test` through `vitest.config.ts`'s
`app/**/*.test.{ts,tsx}` include (unit lane, not the integration lane). The ten cases were added
there rather than duplicating ~200 lines of Supabase-chain mock into a near-identical file.
A third file — `SOURCE/app/(layer2)/__tests__/layout.test.tsx` — is therefore also modified by
this task, by coordinator direction, and is outside the task file's Target Files list as written.

**M6 honesty note stands**: `consumeQuota("tutor", userId, ent, 1)` is behaviourally equivalent
today because the table's tutor value **is** 1, so only the source pin catches it; M5 (mutating
the table to 3) is the complementary behavioural half. Neither is claimed to do the other job.
