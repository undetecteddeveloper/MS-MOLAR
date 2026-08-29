# Task G0.1 — AC-067 Zero Data Retention gate (HUMAN ONLY)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase 0, Task G0.1**
Layer: **process gate** (no repository file; Gate A of the work plan is edited)
Status (2026-08-29): **BLOCKED ON THE ENGINEER.** A1 ✅ and A5 ✅ (Zero Data Retention already enabled). **A5b is blocked on A2 alone** — the rotated `GROQ_API_KEY` must be placed in `SOURCE/.env.local` by the engineer directly. Until A5b ticks, no task may perform a dev `L1` run. Stage 2 (A3, A4, A6, A7) is untouched.

Metadata:
- Owner: **engineer**. No agent can discharge this task and no test in the repository can check it.
- Dependencies: none.
- Blocks: **Stage 1 (A5b) blocks every task that performs a dev `L1` grading run** — Tasks **B1.5**, **B3.2**, **F-C2**, plus the `L1` criteria of Phases B1 and B3. **Stage 2 blocks Phase E.**
- Provides: the ticked A5b line and the dated A6 console check inside Gate A of the work plan — versioned evidence that exists nowhere else.
- Size: documentation only (Gate A of the work plan).

## Implementation Content

Grading ships **disabled**. `ESSAY_GRADING_ENABLED` absent ⇒ off. Complete Gate A in **two stages**, including the **dated console check** written into the work plan file.

**Stage 1 — A5b, and it blocks implementation, not just Phase E.** A1, A2 and A5 (account, key in `SOURCE/.env.local`, **Zero Data Retention enabled**) are the precondition for **any** Groq request, dev included. Engineer's decision, 2026-08-29. Several implementation tasks require a dev `L1` run and every one of those sends real text to `api.groq.com`; A5b is what makes them executable without "it's only dev" becoming a reason to skip ZDR.

- A1 — a Groq account exists and the organisation is the one that will own production traffic. **Confirmed 2026-08-29** (account model catalogue and rate limits read from `console.groq.com/settings/limits`).
- A2 — `GROQ_API_KEY` present in `SOURCE/.env.local`. The engineer places the key directly in the file rather than routing it through an assistant: the first key was pasted into a session transcript on 2026-08-29 and was rotated for that reason. The file is gitignored and untracked (verified via `git check-ignore`).
- A5 — Zero Data Retention **enabled** in Groq Data Controls (`https://console.groq.com/settings/data-controls`). **Confirmed enabled 2026-08-29.**
- A5b — tick and date it in Gate A the moment the rotated key is in `SOURCE/.env.local`.

**Stage 2 — A3, A4, A6, A7.** `GROQ_API_KEY` in the Vercel **Production** and **Preview** scopes; the **dated console check** (A6) with the engineer's name and an evidence location; and A7 — until A6 carries a real date, `ESSAY_GRADING_ENABLED` is **absent in both Vercel scopes** and Phase E is not started. A local dev `true` is governed by **A5b**, not by A7: it is permitted after A5b, **against seeded data only**.

**The rule no task may break**: no task in this plan may set `ESSAY_GRADING_ENABLED=true` anywhere — not even in a local `SOURCE/.env.local` — until A1, A2 and A5 are ticked. After A5b, a local dev `true` is permitted **only against seeded attempts**; never against a real student attempt, on any environment.

Why it is a gate and not a recommendation: the provider's **default** posture (no training on input/output, inference requests not stored) is **not** Zero Data Retention. Provider documentation states input and output **may be logged temporarily** for reliability troubleshooting or abuse investigation, retained for up to **30 days**. The users are minors and the data is their own writing produced during an exam.

**Do not read this task as "no gate applies before Phase E".** Code may be written and merged in the disabled state without any part of Gate A; the moment a task needs a real band to land on dev, A5b applies.

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate A checkboxes A2, A3, A4, A5b, A6, A7 and their date/name/evidence slots
- [ ] `SOURCE/.env.local` (engineer-owned, untracked — **not** edited by an agent)

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate A — AC-067 Zero Data Retention)
- `docs/prd/essay-auto-scoring-prd.md` (§ AC-067)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — item #10)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Risks — R-12)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ FE-AC-20 — the flag's copy precondition)
- `SOURCE/lib/env/checkEnv.ts` (the `GEMINI_API_KEY` registration shape at `:77-84` — how a key is declared here)

## Investigation Notes
_(Record here: the date A5b was ticked; the A6 console-check date, the engineer's name and the evidence location; confirmation that `git check-ignore SOURCE/.env.local` still reports the file ignored.)_

## Implementation Steps
### 1. Stage 1 (A5b)
- [ ] Read Gate A in the work plan in full
- [ ] Confirm A1 and A5 are still true in the Groq console (account organisation; Data Controls → Zero Data Retention **enabled**)
- [ ] Place the rotated `GROQ_API_KEY` into `SOURCE/.env.local` directly (engineer only — never through a session transcript)
- [ ] Confirm `git check-ignore SOURCE/.env.local` reports it ignored
- [ ] Tick **A2** and **A5b** in Gate A and write the A5b date

### 2. Stage 2 (A3, A4, A6, A7)
- [ ] Add `GROQ_API_KEY` to the Vercel **Production** scope (A3)
- [ ] Add `GROQ_API_KEY` to the Vercel **Preview** scope (A4)
- [ ] Perform the console check and record the **date**, the **engineer's name** and the **screenshot/evidence location** in A6
- [ ] Confirm `ESSAY_GRADING_ENABLED` is **absent** in both Vercel scopes and record that against A7

## Quality Assurance Mechanisms
None automated. This is precisely why Gate A is a gate with a named owner: nothing in the repository can check any of it.

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer — an `&&` chain stops at the first failure and tells you nothing about the rest.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit that records the gate evidence still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: read Gate A of the work plan after the edit and confirm the A5b date, the A6 date, the engineer's name and the evidence location are **physically present** in the file; independently confirm in the Groq console that Zero Data Retention is enabled, and in Vercel that both scopes carry `GROQ_API_KEY` and neither carries `ESSAY_GRADING_ENABLED`.
- **Success criteria**: A5b carries a date; A6 carries a date, a name and an evidence location; A3/A4 ticked; A7 confirmed with `ESSAY_GRADING_ENABLED` absent from both Vercel scopes.
- **Failure response**: if ZDR cannot be enabled on this account, **stop** — no Groq request may be made from any environment, and every task carrying the A5b entry line (B1.5, B3.2, F-C2) stays blocked. Escalate to the engineer; this is not a decision an implementer may take.
- **Verification level**: L1 (the external system's configuration is the deliverable).

## Proof Obligations
- **Claim**: no essay text of any kind reaches Groq before Zero Data Retention is enabled, and no production traffic before the whole gate is ticked and the console check is dated (AC-067).
- **Primary failure mode**: the flag is set `true` somewhere — including a local `SOURCE/.env.local` — before A5b, so a real student's writing is sent to a provider that may retain it for up to 30 days.
- **Boundary to exercise**: the external provider account boundary (Groq Data Controls) and the deployment boundary (both Vercel scopes). Not in-process.
- **State assertion**: before → `ESSAY_GRADING_ENABLED` absent in both Vercel scopes and no key in `.env.local`; action → stage 1 then stage 2; after → key present, ZDR on, dated console check recorded, flag still absent in both Vercel scopes until Phase E.
- **Mock boundary rationale**: none — every check is against the real console and the real deployment configuration.
- **Residual**: proves the retention posture at the moment of the check. It does not prove the posture stays enabled; the console check is dated so its age is readable, and AC-032 binds a re-run of AC-070 to every model change.

## Completion Criteria
- [ ] **Implementation Complete** = A5b ticked and dated (stage 1), then Gate A fully ticked with a real A6 date (stage 2)
- [ ] **Quality Complete** = N/A (no code)
- [ ] **Integration Complete** = `ESSAY_GRADING_ENABLED` verified absent in both Vercel scopes until A6, and set to `true` locally only after A5b and only against seeded attempts
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: unblocks Tasks B1.5, B3.2, F-C2 (stage 1) and the whole of Phase E (stage 2).
- Scope boundary: no file under `SOURCE/` is modified by this task except `SOURCE/.env.local`, which is untracked and engineer-owned.
- The Gate A slots are **versioned evidence**. `git ls-files docs/plans/` lists this work plan — the dates and the engineer's name exist nowhere else and are not derivable from code.
