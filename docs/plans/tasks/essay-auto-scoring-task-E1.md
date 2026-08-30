# Task E1 — Close Gate A (ZDR) with a dated console check

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E1**
Layer: **process gate** (no repository file; Gate A of the work plan is edited)

Metadata:
- Owner: **engineer**. No agent and no test can discharge this.
- Dependencies: Task G0.1 (stage 1, A5b) is the same gate at its earlier stage; **stage 2 is this task**.
- Blocks: **every other task in Phase E — nothing below E1 may start until A6 carries a real date.**
- Provides: Gate A fully closed, with a dated console check, a name and an evidence location.
- Size: documentation only (Gate A).
- Verification level: **L1** — the external system's configuration and the recorded evidence.

## Implementation Content

Complete Gate A items **A1–A7**. **Nothing below may start until A6 carries a real date.**

### Why it is a gate and not a recommendation
The provider's **default** posture (no training on input/output, inference requests not stored) is **not** Zero Data Retention. The provider's own documentation states input and output **may be logged temporarily** during reliability troubleshooting or abuse investigation, retained for up to **30 days**. For this data — **a minor's own writing, produced during an exam** — a 30-day third-party retention window is not an acceptable default.

The design makes the gate the **default state** rather than a promise: with `ESSAY_GRADING_ENABLED` absent, `computeScore()` emits no keys and `after()` is never registered, so **zero Groq requests is unavoidable rather than remembered**.

### The items
- **A1** — Groq account exists and is the organisation that will own production traffic. *(Confirmed 2026-08-29.)*
- **A2** — `GROQ_API_KEY` in `SOURCE/.env.local` (engineer places it directly; the file is gitignored and untracked).
- **A3** — `GROQ_API_KEY` in the Vercel **Production** scope.
- **A4** — `GROQ_API_KEY` in the Vercel **Preview** scope.
- **A5** — Zero Data Retention **enabled** in Groq Data Controls. *(Confirmed enabled 2026-08-29.)*
- **A5b** — stage 1: A1 + A2 + A5 are the precondition for **any** Groq request, dev included. *(Blocked on A2 as of 2026-08-29 — see Task G0.1.)*
- **A6** — **dated console check recorded in the work plan**, with the engineer's name and a screenshot/evidence location.
- **A7** — until A6 carries a real date, `ESSAY_GRADING_ENABLED` is **absent in both Vercel scopes** and Phase E is not started.

## Target Files
- [x] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate A items A2–A7 and their date/name/evidence slots. **A3, A4 recorded 2026-08-30 (`4a51c66`); A6, A7 recorded 2026-08-30. Gate A is fully closed: zero unticked items remain.**

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate A — AC-067 Zero Data Retention)
- `docs/plans/tasks/essay-auto-scoring-task-G0.1.md` (stage 1 of the same gate — A5b's status and the seeded-data-only rule)
- `docs/prd/essay-auto-scoring-prd.md` (§ AC-067)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — item #10)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Risks — R-12)

## Investigation Notes

### Gate A closed 2026-08-30 — stage 2 discharged
- **A6 console check**: date **2026-08-30**, by **undetecteddeveloper** (`smithnguyen247@gmail.com`), evidence = a screenshot of `console.groq.com/settings/data-controls` shown in the session transcript for session `ca31f4cc-9218-40e0-9449-e1849155de64`. A durable copy outside the transcript is still worth saving; a transcript is session-scoped and this gate gets re-audited.
- **A3 / A4**: the engineer placed `GROQ_API_KEY` in **both** Vercel scopes in one dashboard visit on 2026-08-30. The key never passed through the assistant — the same precaution A2 records, after the first key was pasted into a transcript and had to be rotated.
- **A7**: `ESSAY_GRADING_ENABLED` was **absent in both Vercel scopes for the entire period up to this point**, and is **still absent as of 2026-08-30**. Closing A7 is permission for E6 to run; it is not the enabling.

### The console reading that would have gone wrong if summarised
The Data Controls page shows **two** switches, and only the first governs:
- **Global ZDR — ENABLED**, self-labelled *"Enabled - API specific settings are overriden"*.
- **Inference APIs ZDR — displays OFF and greyed out.** This is **not** a gap: it is greyed *because* the global switch overrides it, exactly as that switch's own label says.

Recorded in Gate A verbatim rather than compressed to "ZDR is on", because the compressed version is the one that fails an audit: the next person to open that page sees an apparently-off inference toggle and concludes the gate was ticked without looking.

### The gate's premise, confirmed from the provider's own console
The page states: *"Starting October 15, 2025, Groq may store inputs and outputs for up to 30 days, strictly for purposes of maintaining system reliability and compliance."* Until now the plan cited that 30-day window **from provider documentation**. It is now corroborated **in the account's own console** — the default posture is confirmed to be the unacceptable one, and ZDR the opt-out from it.

### No redeploy was triggered, deliberately
Vercel offered one when the variable was added. It buys nothing yet: a new environment variable reaches a running deployment only at the next build, but while `ESSAY_GRADING_ENABLED` is absent **nothing reads `GROQ_API_KEY`** — `computeScore()` emits no essay keys and `after()` is never registered. The redeploy that matters is the one **after E6**, which must carry both variables. Recorded against A4 so a later reader does not treat it as a missed step.

## Implementation Steps
- [x] Confirm A1 and A5 still hold in the Groq console — re-confirmed 2026-08-30 by the same console check that discharges A6
- [x] Confirm A2 (key in `SOURCE/.env.local`) — already ticked 2026-08-29 (A5b stage 1)
- [x] Add `GROQ_API_KEY` to the Vercel **Production** scope (A3) — 2026-08-30
- [x] Add `GROQ_API_KEY` to the Vercel **Preview** scope (A4) — 2026-08-30
- [x] Perform the console check; record the **date**, the **name** and the **evidence location** in A6 — 2026-08-30
- [x] Confirm `ESSAY_GRADING_ENABLED` is absent in both Vercel scopes and record that against A7 — confirmed absent 2026-08-30

## Quality Assurance Mechanisms
None automated — nothing in the repository can check any of it. That is precisely why Gate A is a gate with a named owner.

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 2025 passed / 10 skipped / 0 todo — **unchanged**, as a documentation-only commit must be |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi`. **Verified by name, not by count** — the two failing cases are `locale en` and `locale vi` under *"FE-1 (e) `legalContentReady === false` leaves an inert but reachable confirm control"*, 78 passed |
| 6 | `npm run test:localdb` | **0** | 16 passed, 0 todo — see Open Item I-7 |

All six run **separately**, each exit code read directly. This task changes no source file, and all six were still run per Open Item I-7 option (a) — the point of the rule is that a documentation commit is exactly where "it can't have broken anything" goes unchecked.

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording the gate evidence still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: read Gate A after the edit and confirm the A6 date, the engineer's name and the evidence location are **physically present**; independently confirm ZDR in the Groq console and the key's presence in both Vercel scopes.
- **Success criteria**: Gate A fully closed with a dated console check, a name and an evidence location.
- **Failure response**: if ZDR cannot be confirmed, **stop** — Phase E does not proceed, and `ESSAY_GRADING_ENABLED` stays absent in both Vercel scopes.
- **Verification level**: **L1**.

## Proof Obligations
- **Claim (AC-067)**: no production traffic reaches the provider before Zero Data Retention is confirmed **and dated**.
  - **Primary failure mode**: relying on the provider's default posture, which is **not** ZDR and permits temporary logging of input and output for up to 30 days — for a minor's exam writing.
  - **Boundary to exercise**: the Groq console (Data Controls) and both Vercel scopes.
  - **State assertion**: before → flag absent in both scopes; action → gate closed and dated; after → the flag may be set (Task E6), not before.
  - **Mock boundary rationale**: none — real console, real deployment configuration.
  - **Residual**: proves the posture at the moment of the check; the dated record is what makes its age readable later.

## Completion Criteria
- [ ] Gate A items A1–A7 all ticked
- [ ] A6 carries a **real date**, the engineer's **name** and an **evidence location**
- [ ] `ESSAY_GRADING_ENABLED` confirmed absent in both Vercel scopes up to this point (A7)
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks Tasks E2–E6.
- Scope boundary: no source file changes.
- The Gate A slots are **versioned evidence** — the date, the name and the evidence location exist nowhere else and are not derivable from code.
