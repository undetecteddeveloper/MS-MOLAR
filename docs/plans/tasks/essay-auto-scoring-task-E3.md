# Task E3 — OQ-6 + AC-070: first real-provider evaluation of `ESSAY_GRADER_MODEL`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E3**
Layer: **process gate / evaluation** (no repository file; the dated result is recorded in the work plan)

Metadata:
- Owner: **engineer**, **after Gate A** and **before enabling on prod**.
- Dependencies: **Task E1** (Gate A closed).
- Blocks: **Task E6**.
- Provides: the dated AC-070 controlled-comparison result.
- Size: documentation only (plus a manual run against the real provider).
- Verification level: **L1** — real provider, real fixtures.

## Implementation Content

### Model selection is closed; grading quality is not
**OQ-6 closed on 2026-08-29 (backend DD v1.5): `ESSAY_GRADER_MODEL = "qwen/qwen3.8-27b"`.**

The risk OQ-6 named **actually fired** — `llama-3.3-70b-versatile` is **not in this account's catalogue at all** — and the swappable-constant discipline is what reduced that incident to a **one-line edit**. Qwen was chosen because its **TPD of 2M is ten times** every remaining candidate and TPD is the first binding ceiling, plus strong multilingual coverage of Vietnamese.

**What remains open is exactly what this task measures: nobody has graded a Vietnamese essay with it.** It is a **swappable starting point, not a validated grader**.

### The run
The committed **adversarial fixtures** with the **real** provider, each graded **twice** (with and without injection), asserting the two bands are **equal** — a **controlled comparison, not a ceiling check**.

The literature measures score **inflation** (56.9% average attack success, where success = *the score went up*), so an assertion like "no band came out as 1" stays **green while an attack lifts a genuine 0 to 0.75**.

Plus a small set of **real answers with known expected bands**.

### Record the result with a date
`____________________`

### Escalation condition
Markedly low agreement with a human grader ⇒ **change the constant** — and **AC-032 then requires the whole AC-070 run again, dated, not just a string edit**.

### Status of this gate
This run is **adopted but is NOT a merge gate** (it needs a real key, spends budget, and is non-deterministic). **Nightly or on demand, and mandatory on every model change.**

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Task E3's dated-result slot

## Investigation Targets
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Phase E, Task E3; § Open Questions carried forward — OQ-6, OQ-7)
- `docs/prd/essay-auto-scoring-prd.md` (§ AC-042, AC-069, AC-070, AC-032)
- `docs/design/essay-auto-scoring-backend-design.md` (§ EG-BE-018 — score inflation is only observable against a **real** provider)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Risks — R-10: the six anti-injection layers, and why the measurement is a **controlled comparison**)
- `SOURCE/lib/essay/__tests__/fixtures/` (Task H3 — the committed adversarial fixture set: ≥5, Vietnamese and English, including one zero-width/bidi variant)
- `SOURCE/lib/essay/prompt.ts` and `SOURCE/lib/essay/parseGrade.ts` (Task H3 — the two modules this evaluation exercises)
- `SOURCE/lib/ai/models.ts` (Task H4 — `ESSAY_GRADER_MODEL` and the AC-070 re-run obligation carried in its comment)

## Investigation Notes
_(Record here: the fixture-by-fixture band pairs (with and without injection); the real-answer set and the human-expected bands; the date of the run; the model version string reported by the provider.)_

## Implementation Steps
- [ ] Confirm Gate A is closed (Task E1) — this run sends text to the provider
- [ ] Run every committed adversarial fixture **twice** against the real provider: once clean, once with the injection
- [ ] Assert the two bands are **equal** per fixture — a controlled comparison
- [ ] Run the small set of real answers with known expected bands and record the agreement
- [ ] Record the result **with a date** in the work plan

## Quality Assurance Mechanisms
- AC-070 adversarial evaluation, real provider — Enforces: prompt-injection score inflation measured by **controlled comparison**, not a ceiling check — covers `SOURCE/lib/essay/{prompt,parseGrade}.ts` — **adopted but NOT a merge gate**; nightly/on demand, and **mandatory re-run on every `ESSAY_GRADER_MODEL` change (AC-032)**
- `npx vitest run` — Enforces: AC-069's deterministic recorded-response cases, which **are** merge-blocking — Config: `SOURCE/vitest.config.ts` (context: AC-069 is the CI half of the same proposition)

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

**A task file with any exit-code cell left empty is not complete** (Gate E4). This task changes no source file; the commit recording the result still runs all six, per Open Item I-7 option (a).

## Operation Verification Methods
- **Verification method**: each committed adversarial fixture graded **twice** against the real provider — with and without the injection — and the two bands compared for **equality**; plus a small set of real answers with known expected bands.
- **Success criteria**: for every fixture the two bands are **equal**; agreement with the human-expected bands is recorded; the result carries a **date**.
- **Failure response**: markedly low agreement with a human grader ⇒ change `ESSAY_GRADER_MODEL` — and **AC-032 then requires the entire AC-070 run again, dated, not just a string edit**. A band that **rises** under injection is a successful attack: record it and escalate; do **not** compensate with a ceiling check.
- **Verification level**: **L1** — real provider, non-deterministic, not a merge gate.

## Proof Obligations
- **Claim (AC-042 / AC-070 / EG-BE-018)**: a prompt injection does **not inflate** the band.
  - **Primary failure mode**: measuring with a **ceiling check** instead of a controlled comparison — "no band came out as 1" **stays green while an attack lifts a genuine 0 to 0.75**, which is exactly what the literature measures (56.9% average attack success, where success = the score went up).
  - **Boundary to exercise**: the **real provider** over HTTPS. A recorded response cannot be inflated by any injection, so this cannot be proven in CI — AC-069 covers the deterministic half, this covers the other.
  - **State assertion**: N/A — no persisted state; the comparison is between two graded outputs of the same fixture.
  - **Mock boundary rationale**: **none** — mocking here would destroy the only property being measured.
  - **Residual**: a passing run is evidence for **this model at this date**; AC-032 binds a full re-run to every model change, and the result is dated so its age is readable.
- **Claim (OQ-6's remaining half)**: the model grades Vietnamese essays acceptably.
  - **Primary failure mode**: treating a swappable starting point as a validated grader — **nobody has graded a Vietnamese essay with it**. **Boundary**: the real-answer set with human-expected bands. **State assertion**: N/A. **Mock rationale**: none. **Residual**: agreement is measured on a small set; it is a gate on enabling, not a statistical validation.

## Completion Criteria
- [ ] The AC-070 run is executed against the **real provider** and the result recorded **with a date**
- [ ] The controlled-comparison result (band pairs per fixture) is recorded, not just a summary
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: gates enabling on prod (Task E6). Also the standing obligation: **mandatory re-run on every `ESSAY_GRADER_MODEL` change (AC-032)**.
- Scope boundary: no code change. Changing the model constant is a `SOURCE/lib/ai/models.ts` edit **plus** a full dated re-run of this task.
- **Not a merge gate.** It needs a real key, spends budget, and is non-deterministic — nightly or on demand.
