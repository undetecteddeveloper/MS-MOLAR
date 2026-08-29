# Task E5 — OQ-1 / O-6: measure the round trip and confirm or adjust four time constants

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E5**
Layer: **process measurement** (may result in constant changes)

Metadata:
- Owner: **engineer**, **during or immediately after the first enabled runs on dev**.
- Dependencies: **Task E1** (Gate A closed — the run reaches the provider).
- Blocks: **Task E6** (the measurement informs the enabled state, and AC-061 must be respected when adjusting).
- Provides: recorded p50 / p95 for the round trip, and confirmation or adjustment of four time constants.
- Size: documentation only, unless a constant moves.
- Verification level: **L1** — 10 real gradings.

## Implementation Content

**Measure**: 10 real gradings, recording **p50/p95 from request emission to response receipt**.

The Singapore→Groq round trip is **unmeasured** (C4). `GROQ_CALL_DEADLINE_MS` (20 s), `GROQ_MAX_CONCURRENCY` (2), `ESSAY_PASS_BUDGET_MS` (4 min) and `ESSAY_PENDING_DEADLINE_MS` (10 min) were **all chosen by argument**.

### Escalation condition
If **p95 exceeds 20 s**, raise `GROQ_CALL_DEADLINE_MS` **and** recompute `ESSAY_PASS_BUDGET_MS`.

**The read-time deadline does NOT move with it (AC-061)** — it is anchored to **twice the platform's duration ceiling**, not to a latency estimate, which is what makes "no writer remains" a statement about the **platform** rather than a guess.

### Also revisit the two polling cadence constants (O-6, still open)
Against the measured latency. **The two caps were already re-anchored on 2026-08-29 (UI Spec v1.4): 30 refreshes / 240 000 ms**, with the elapsed cap set **equal to `ESSAY_PASS_BUDGET_MS`** rather than derived from any latency target — so **a latency measurement does not by itself move them; only a move of `ESSAY_PASS_BUDGET_MS` does**.

Note again that **the polling bound and the read-time deadline are different numbers and neither is derived from the other**.

### Slot to fill
Recorded p50 / p95: `____________ / ____________`

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Task E5's p50/p95 slot
- [ ] *(only if a constant moves)* `SOURCE/lib/essay/groqClient.ts` (`GROQ_CALL_DEADLINE_MS`), `SOURCE/lib/essay/gradeEssays.ts` (`GROQ_MAX_CONCURRENCY`, `ESSAY_PASS_BUDGET_MS`), `SOURCE/app/(layer2)/_components/EssayGradingPoller.tsx` (the two cadence constants)

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Open Questions carried forward — OQ-1, O-6, OQ-7; and AC-061's separation of the three numbers)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Assumed Behaviors / C4 — the Singapore→Groq round trip is unmeasured)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayGradingPoller — the five constants and the re-anchored caps, UI Spec v1.4)
- `SOURCE/lib/essay/groqClient.ts` (Task B1.2 — `GROQ_CALL_DEADLINE_MS = 20_000`, `GROQ_MAX_IN_PASS_RETRIES = 2`, `GROQ_RETRY_MAX_WAIT_MS = 8_000`)
- `SOURCE/lib/essay/gradeEssays.ts` (Task B1.4 — `GROQ_MAX_CONCURRENCY = 2`, `ESSAY_PASS_BUDGET_MS = 240_000`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `ESSAY_PENDING_DEADLINE_MS = 600_000`, **which does not move with latency**)
- `SOURCE/app/(layer2)/_components/EssayGradingPoller.tsx` (Task F-C2 — the five named polling constants; `ESSAY_POLL_MAX_ELAPSED_MS == ESSAY_PASS_BUDGET_MS`)

## Investigation Notes
_(Record here: the 10 measured round trips with p50/p95; the token counts logged from the first real run (they move `GROQ_BUDGET_DAILY_LIMIT` and `GROQ_MAX_CONCURRENCY` together — Task E2); which constants were confirmed and which moved.)_

## Implementation Steps
- [ ] Run 10 real gradings on dev (Gate A closed; **seeded data**)
- [ ] Record p50 and p95 from request emission to response receipt
- [ ] Log the **actual** prompt + completion token counts (they feed back into Task E2's limit — the ~3K figure is an estimate, not a measurement)
- [ ] If p95 > 20 s: raise `GROQ_CALL_DEADLINE_MS` **and** recompute `ESSAY_PASS_BUDGET_MS`
- [ ] Revisit the two polling **cadence** constants against the measured latency
- [ ] **Do not move `ESSAY_PENDING_DEADLINE_MS`** (AC-061)
- [ ] If `ESSAY_PASS_BUDGET_MS` moved, move `ESSAY_POLL_MAX_ELAPSED_MS` **with it** (they are anchored, not merely equal by coincidence)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` / `npx vitest run` — Enforces: any constant change keeps the poller cases (P-1…P-6) and the orchestrator tests green — Config: `SOURCE/tsconfig.json`, `SOURCE/vitest.config.ts`
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | if a poller constant moved, P-2/P-3/P-5 must be re-read, not merely re-run |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: 10 real gradings measured end to end; p50 and p95 recorded in the work plan; token counts logged.
- **Success criteria**: p50/p95 recorded; each of the four time constants explicitly **confirmed or adjusted**, with the read-time deadline explicitly **not moved**.
- **Failure response**: if p95 exceeds 20 s, raise `GROQ_CALL_DEADLINE_MS` and recompute `ESSAY_PASS_BUDGET_MS` — and remember that `ESSAY_POLL_MAX_ELAPSED_MS` is **anchored to `ESSAY_PASS_BUDGET_MS`**, so it moves with it. Do **not** move `ESSAY_PENDING_DEADLINE_MS`: it is anchored to the platform's duration ceiling, not to latency.
- **Verification level**: **L1**.

## Proof Obligations
- **Claim (OQ-1)**: the four time constants are consistent with the measured round trip.
  - **Primary failure mode**: adjusting the read-time deadline along with the latency constants, which breaks AC-061's separation — the deadline's meaning is "no writer remains", a statement about the **platform**, not a guess about latency.
  - **Boundary to exercise**: 10 real provider round trips, measured from emission to receipt.
  - **State assertion**: N/A — the measurement changes no state; a constant change is a code edit verified by the existing tests.
  - **Mock boundary rationale**: **none** — a mocked provider measures nothing.
  - **Residual**: 10 samples on dev; it does not characterise the tail under production load.
- **Claim (O-6, the still-open half)**: the two polling **cadence** constants are revisited against measured latency, while the two **caps** move only if `ESSAY_PASS_BUDGET_MS` moves.
  - **Primary failure mode**: re-deriving the caps from a latency target — **exactly how 120 000 became wrong**. The caps are anchored to the pass's own wall-clock budget, past which no band can still land, which is a checkable proposition about the writer rather than an estimate.
  - **Boundary to exercise**: the poller's cases P-2 (phase change), P-3 (count cap) and P-5 (elapsed cap) re-read after any change.
  - **State assertion**: N/A. **Mock rationale**: fake timers in the poller tests. **Residual**: none.

## Completion Criteria
- [ ] p50 / p95 recorded in the work plan
- [ ] The four time constants **confirmed or adjusted**, with the read-time deadline explicitly **not moved**
- [ ] If `ESSAY_PASS_BUDGET_MS` moved, `ESSAY_POLL_MAX_ELAPSED_MS` moved with it and the poller cases were re-read
- [ ] Token counts from the first real run recorded and fed back to Task E2
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: `groqClient.ts`, `gradeEssays.ts` and `EssayGradingPoller.tsx` if a constant moves; Task E2's limit if the token estimate was materially wrong.
- Scope boundary — preserve unchanged: `ESSAY_PENDING_DEADLINE_MS` (**AC-061** — the read-time deadline does **not** move with latency).
- The polling bound and the read-time deadline are **different numbers**, and neither is derived from the other.
