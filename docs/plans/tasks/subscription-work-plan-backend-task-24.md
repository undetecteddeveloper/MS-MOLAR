# Task: Gate the upload path (I3) — and integration case INT-1

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.4**
Layer: **backend** (server action `SOURCE/app/(layer4)/actions.ts` + integration test)

Metadata:
- Dependencies: backend-task-22 (the chokepoint), backend-task-21 (`consumeQuota`), backend-task-01 (`test:integration`), backend-task-11 (gate B on dev)
- Provides: upload-side enforcement; **INT-1 filled in this same commit** — integration lane 3/3
- Size: Medium (2 files)

`Change Category: bug-fix, state-change`

This **replaces** the superseded `LIMITS.MAX_UPLOADS_PER_DAY` DB-count check (which counted rows created, so a re-run consumed nothing) with a counter-based gate. Sweep the adjacent cases sharing that path — both branches of the upload action (`rerunExamId` set and unset), the `metaCall` derivation at `:417`, and any other consumer of `LIMITS.MAX_UPLOADS_PER_DAY` — for the same class of defect.

## Implementation Content

In `SOURCE/app/(layer4)/actions.ts`:
- **hoist the `metaCall` derivation** (`entryMode === "automatic"`, today at `:417`) to a `const` immediately after `requireUser()`, and have `:417` consumer read it rather than re-deriving — **the value passed to `consumeQuota` and the value that gates the third call must be the same expression, evaluated once**;
- call `consumeQuota("upload", userId, ent, metaCall ? 3 : 2)` **once, ahead of the branch at `:268`**, alongside the existing `guard("uploadExam", user.id)` at `:181`;
- **delete** the superseded DB-count check at `:331-343` (`LIMITS.MAX_UPLOADS_PER_DAY`) rather than leaving it running in parallel.

### INT-1 — filled in **this** commit
(a) exhausted Free tutor allowance ⇒ reason `user_quota` **and** the Gemini adapter mock has **exactly 0** invocations;
(b) upload with `rerunExamId` **unset** ⇒ the per-user upload counter delta is **exactly 1** (hardcoded literal, read before and after);
(c) upload with `rerunExamId` **set** ⇒ delta **exactly 1** — this is the stated expected *difference*, and it **fails against the old behaviour**, which counted rows created and a re-run creates none;
(d) an **absence assertion** that `actions.ts` contains no surviving reference to `LIMITS.MAX_UPLOADS_PER_DAY`;
(e) Redis unavailable ⇒ refuse with **exactly 0** Gemini adapter invocations.

## Target Files
- [ ] `SOURCE/app/(layer4)/actions.ts`
- [ ] `SOURCE/tests/integration/subscription.int.test.ts` (**INT-1 filled**)

## Investigation Targets
- `SOURCE/app/(layer4)/actions.ts` (`:181` `guard("uploadExam", …)`; `:268` the branch the gate must precede; `:331-343` the superseded DB-count check to delete; `:417` the `metaCall` derivation to hoist) — **adjacent cases for the bug-fix / state sweep**
- `SOURCE/lib/ugc/limits.ts` (`LIMITS.MAX_UPLOADS_PER_DAY` — confirm no other consumer survives)
- `SOURCE/lib/billing/quota.ts` (plan Task 5.1 — `consumeQuota` signature and its three reasons)
- `SOURCE/lib/ugc/gemini.ts` (plan Task 5.2 — the counted adapter boundary INT-1 asserts against)
- `SOURCE/tests/integration/subscription.int.test.ts` (**INT-1** `Proof obligation:` / `Primary failure mode:` annotation block)
- `docs/design/subscription-backend-design.md` (§ Integration Point I3)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy — the output-comparison clause for the one replaced behaviour)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record INT-1 annotation block verbatim
- [ ] **Bug-fix / state sweep**: record the **before** behaviour of the `:331-343` check in **both** branches (`rerunExamId` set and unset) — the refusal reason string and the counter delta — so the output comparison has a baseline
- [ ] Write INT-1 first and confirm case (c) **fails against the old behaviour**
### 2. Green Phase
- [ ] Hoist `metaCall`; add the gate ahead of `:268`; delete `:331-343`; run `npm run test:integration` against dev
### 3. Refactor Phase
- [ ] Confirm `metaCall` is derived exactly once and both consumers read the same `const`

## Quality Assurance Mechanisms
- Real-Postgres integration tests — Enforces: counter deltas and refusal reasons against a real database — Config: `SOURCE/vitest.integration.config.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: **the output comparison the Verification Strategy requires for the one replaced behaviour.** Compare the upload path `LIMITS.MAX_UPLOADS_PER_DAY` DB-count check at `actions.ts:337` before/after on identical input, in **both** branches (`rerunExamId` set and unset). The diff is taken on **the refusal reason string and the counter delta**, never on the response body.
- **Success criteria**: expected **difference** — the re-run branch now consumes exactly one upload allowance. Expected **non-difference** — a non-re-run upload still consumes exactly one. INT-1 (a)…(e) all green under `npm run test:integration` against dev.
- **Failure response**: if the re-run branch still consumes nothing, the old check is still running in parallel — **delete it**, do not add a second gate.
- **Verification level**: L2 (integration); L1 at phase level.

## Proof Obligations
- **Claim**: the plan is sold in operations, and a re-run is an operation.
- **Primary failure mode**: the old row-count semantics survive, so re-runs are free and the paid capacity leaks silently.
- **Boundary to exercise**: the upload server action against the real dev database, with the Gemini adapter mocked and **counted**.
- **State assertion**: per-user upload counter read **before** and **after** each upload; delta exactly **1** in both branches (hardcoded literal expectations).
- **Mock boundary rationale**: the Gemini adapter is external paid I/O and is mocked with a counter; Redis and the database are real, because the counter delta is the claim.
- **Residual**: budget-side literals (3 / 2 / 1) are proven in plan Task 5.1; this task proves the per-user delta and the refusal reasons at the gate.

- **Claim (absence)**: no surviving reference to `LIMITS.MAX_UPLOADS_PER_DAY` remains in `actions.ts`.
- **Primary failure mode**: two gates run in parallel and disagree, so a refusal reason depends on which fires first.
- **Boundary to exercise**: source-text assertion over `actions.ts`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: other consumers of the constant elsewhere in the repository are out of this task scope; record any found.

## Completion Criteria
- [ ] All added tests pass; **INT-1 green from this commit**
- [ ] `consumeQuota("upload", …)` called **once, ahead of the branch at `:268`**; `metaCall` derived once and shared
- [ ] `:331-343` deleted; the absence assertion passes
- [ ] Test-case resolution: **integration 3/3 (INT-1, INT-2, INT-3) — lane complete**
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: `SOURCE/app/(layer4)/actions.ts`; downstream, plan Task 5.5 maps its refusal reason to a telemetry code.
- Scope boundary: the diff is taken on the refusal reason string and the counter delta, **never on the response body**.

## Investigation Notes
(Record the before/after refusal reasons and counter deltas for both branches here.)
