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
