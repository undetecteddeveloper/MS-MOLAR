# Task E2 — OQ-4: confirm `GROQ_BUDGET_DAILY_LIMIT` against the account's real limits

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E2**
Layer: **process gate / configuration** (no repository file; the confirmed value and date are recorded in the work plan)

Metadata:
- Owner: **engineer**, **before enabling the flag**.
- Dependencies: **Task E1** (Gate A closed).
- Blocks: **Task E6**.
- Provides: the confirmed `GROQ_BUDGET_DAILY_LIMIT` value with the date it was re-checked against the console.
- Size: documentation only.
- Verification level: **L1** — the account's real limits.

## Implementation Content

**OQ-4 was CLOSED on 2026-08-29 (backend DD v1.5, § D-17): `GROQ_BUDGET_DAILY_LIMIT = 600` requests.**

**This task is no longer a decision — it is a confirmation** that the closed value still matches the account when the flag is actually turned on.

### The arithmetic behind 600, recorded so a later reader can recompute it rather than re-guess it
`qwen/qwen3.8-27b` carries **TPD 2M**, and one request is **~3K tokens**, so **2M ÷ ~3K ≈ 660 requests/day** — which **binds before** the RPD limit of **1 000**. Setting the limit equal to RPD would therefore **over-permit**. **600** leaves headroom under **both** ceilings, which makes **our** refusal fire before the provider's: a clean `project_budget_exhausted` path instead of a 429 storm.

At the worst-case reservation of **3 per question** that is **~200 essays/day**; ~600 when each grades on the first pass.

### Escalation condition (unchanged)
If the value ever drops **below the essay count of one full exam (50)**, a single attempt cannot be fully graded in one day, and **that must be known in advance rather than discovered afterwards**. 600 clears this by an order of magnitude.

### The estimate this number rests on
**~3K tokens/request is an estimate, not a measurement** (backend DD v1.5 states this explicitly). The first real grading run must log **actual** prompt + completion token counts; if the real figure differs materially, **both `GROQ_BUDGET_DAILY_LIMIT` and `GROQ_MAX_CONCURRENCY` move with it** (OQ-1, Task E5).

### Slot to fill
Confirmed value and the date it was re-checked against the console: `____________________`

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Task E2's confirmed-value slot
- [ ] The environment configuration holding `GROQ_BUDGET_DAILY_LIMIT` (Vercel scopes and/or `SOURCE/.env.local`) — engineer-owned, not a tracked file

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Phase E, Task E2; § Open Questions carried forward — OQ-4, OQ-1, OQ-7)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-17 — the closed `GROQ_BUDGET_DAILY_LIMIT = 600` and its arithmetic)
- `SOURCE/lib/env/checkEnv.ts` (Task H4 — `GROQ_BUDGET_DAILY_LIMIT` registered fail-closed)
- `SOURCE/lib/essay/budget.ts` (Task B1.3 — the reservation shape: one `INCRBY` of `1 + GROQ_MAX_IN_PASS_RETRIES`)
- `SOURCE/lib/essay/groqClient.ts` (Task B1.2 — `GROQ_MAX_IN_PASS_RETRIES`, which sets the worst case per question)
- `SOURCE/lib/ai/models.ts` (Task H4 — `ESSAY_GRADER_MODEL = "qwen/qwen3.8-27b"`, whose TPD/RPD limits this arithmetic uses)

## Investigation Notes
_(Record here: the console's current TPD / RPD / TPM figures for the account and model; the confirmed value; the date of the re-check.)_

## Implementation Steps
- [ ] Read the account's current limits in the Groq console for `ESSAY_GRADER_MODEL`
- [ ] Recompute `TPD ÷ tokens-per-request` and confirm it still binds before RPD
- [ ] Confirm **600** still leaves headroom under **both** ceilings; if not, record the new value and the arithmetic
- [ ] Confirm the value is **not below 50** (one full exam's essay count)
- [ ] Record the confirmed value and the date in the work plan; set `GROQ_BUDGET_DAILY_LIMIT` in the environment

## Quality Assurance Mechanisms
- `npm run check:bundle` — Enforces: no key or host reaches the client bundle — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (context only; this task changes no code)
- `checkEnv.ts` startup validation — Enforces: `GROQ_BUDGET_DAILY_LIMIT` missing or invalid ⇒ **fail closed** — Config: `SOURCE/lib/env/checkEnv.ts`

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

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording the confirmation still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: read the account's real limits in the console and recompute the arithmetic; record the confirmed value **with a date** in the work plan.
- **Success criteria**: the value is confirmed against the console, leaves headroom under both TPD and RPD, and is well above 50.
- **Failure response**: if the recomputed figure differs materially from ~660, record the new arithmetic and adjust the limit — and note that `GROQ_MAX_CONCURRENCY` moves with it (OQ-1, Task E5).
- **Verification level**: **L1**.

## Proof Obligations
- **Claim (AC-031 / Failure Mode Checklist: missing config)**: the budget gate is **fail-closed** and bounded by a value confirmed against the account's real limits.
  - **Primary failure mode**: setting the limit equal to RPD, which **over-permits** because TPD binds first — so the provider's 429 storm arrives before our own clean `project_budget_exhausted` refusal.
  - **Boundary to exercise**: the provider account's published limits, read in the console.
  - **State assertion**: N/A here — the counter's fail-closed behaviour is proven by Task B1.3.
  - **Mock boundary rationale**: none — the real account is the source.
  - **Residual**: the ~3K tokens/request figure is an **estimate, not a measurement**; Task E5's first real run logs actual token counts, and a material difference moves both this limit and `GROQ_MAX_CONCURRENCY`.

## Completion Criteria
- [ ] The confirmed value and the date are recorded in the work plan
- [ ] The value is sanity-checked against a **50-essay attempt**
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: `GROQ_BUDGET_DAILY_LIMIT` is read by `SOURCE/lib/essay/budget.ts`; a wrong value is a denial of grading for every student that day.
- Scope boundary: no code change. `SOURCE/lib/essay/budget.ts` **reads** this value; it does not decide it.
- Recorded so it is not re-guessed: **TPD 2M ÷ ~3K ≈ 660 binds before RPD 1 000**; 600 leaves headroom under both.
