# Task H3 — `lib/essay/parseGrade.ts` + `lib/essay/prompt.ts` + adversarial fixtures (RED first)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H3**
Layer: **backend** (`SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task H1** (`ESSAY_BANDS`).
- Blocks: **Task B1.2** (`groqClient.ts` and its chokepoint scan), and through it B1.4.
- Provides: the validator and the prompt builder that carry the whole R9/R-10 security claim, plus the committed adversarial and AC-069 deterministic fixture sets.
- Size: Medium (4 files + a fixture directory)
- Verification level: **L2**.

## Implementation Content

Create both modules as **pure** functions — no env, no DB, no knowledge of which model will receive the prompt.

**`parseGrade(rawText: string)`** returns
`{ ok: true; band: number; lowConfidence: boolean } | { ok: false; reason: "unparseable" | "band_out_of_set" | "confidence_not_boolean" }`.
It **never throws** — not on an empty string, not on truncated JSON, not on an array. It is the **only** place in the repo that compares a value against `ESSAY_BANDS`.

**`buildEssayPrompt(...)`** produces:
- a shared **rubric block** (one generic block; no rubric column, no rubric table, no author input — AC-039);
- a labelled **reference** region carrying `questions.essay_answer` exactly once;
- a labelled **data** region carrying the student's answer exactly once, placed **after** the instructions, **never** in an instruction position;
- an explicit **anti-injection sentence** stating that any instruction inside the data region is content to be evaluated;
- the output shape and the closed band set declared **in words**, even though `response_format` is set.

**Also commit the fixture sets**:
- the **adversarial** set — at least five, Vietnamese and English, including one zero-width/bidi variant;
- the **AC-069 deterministic** set — a number outside the set, free prose, empty output, broken JSON, a non-boolean confidence field.

### Not proven here
EG-BE-018 / AC-042 / AC-070 — score **inflation** is only observable against a **real provider**, because a recorded response cannot be inflated by any injection. That run is **Phase E (Task E3)**, and AC-032 binds it to every future model change.

## Target Files
- [ ] `SOURCE/lib/essay/parseGrade.ts` (new)
- [ ] `SOURCE/lib/essay/prompt.ts` (new)
- [ ] `SOURCE/lib/essay/__tests__/parseGrade.test.ts` (new)
- [ ] `SOURCE/lib/essay/__tests__/prompt.test.ts` (new)
- [ ] adversarial fixture files under `SOURCE/lib/essay/__tests__/fixtures/` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `parseGrade.ts` line: closed band set, strict boolean, never throws)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `prompt.ts` line: shared rubric block, labelled reference region, labelled data region)
- `docs/design/essay-auto-scoring-backend-design.md` (§ EG-BE-014 / EG-BE-015 / EG-BE-017)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Risks — R-10: six anti-injection layers; R-06: the design does not depend on `response_format`)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 2: the closed band set is declared once, in TypeScript; the SQL functions do not validate the band at all)
- `docs/adr/ADR-0005-multi-part-national-exam-format.md` (§ Decision — `questions.essay_answer` is the essay ground truth; `question_type` already includes `'essay'`, no enum widening)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `ESSAY_BANDS`, the only set this validator compares against)
- `SOURCE/lib/tutor/prompt.ts` (`buildTutorPrompt()` — the repo's existing prompt-builder shape and its region labelling)
- `SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts` (`:110-178` — the scan shape Task B1.2 copies; read here so the prompt module's structure does not accidentally create a second emission surface)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | The closed band set `{0, 0.25, 0.5, 0.75, 1}` is declared **once, in TypeScript**; the SQL functions do not validate the band value at all, and that omission is deliberate | `parseGrade()` imports `ESSAY_BANDS` from `lib/scoring/essayLifecycle.ts` and declares no second copy |
| `docs/adr/ADR-0005-multi-part-national-exam-format.md` (§ Decision) | persistence | `questions.essay_answer` is the essay ground truth; `question_type` already includes `'essay'` — no enum widening | `buildEssayPrompt()` reads the model answer from `essay_answer` and this task adds no enum change |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `gradeEssays()` → `api.groq.com` (cross-process HTTPS) |
|---|---|
| Owner (left) | `SOURCE/lib/essay/groqClient.ts` — the single emission point (Task B1.2) |
| Owner (right) | Groq OpenAI-compatible Chat Completions, `https://api.groq.com/openai/v1/chat/completions` |
| Serialized format | JSON POST body: model = `ESSAY_GRADER_MODEL`, **messages built by `lib/essay/prompt.ts`**, `response_format: {"type":"json_object"}` as noise reduction only |
| Consumer parse rule | **`parseGrade()` validates strictly and never throws**: band must `===` a member of `ESSAY_BANDS`; the confidence flag must be `typeof === "boolean"`; anything else is `{ ok: false, reason }` and settles `failed` |
| Expected signal | Chokepoint scan: the request-reachable emission surface is exactly one module (exhaustive `toEqual`), the offline-scripts list is **empty**, and the Gemini `EMIT_PATTERN` matches zero lines in the Groq module (AC-034) |

Roundtrip check this task owns: whatever `buildEssayPrompt()` asks for in words is exactly what `parseGrade()` accepts — a response shaped as the prompt describes parses to `{ ok: true }`, and anything else is `{ ok: false, reason }`.

## Investigation Notes
_(Record here: the observed RED failure per fixture before implementation; the exact anti-injection sentence used; the five adversarial fixtures and which language/technique each covers.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Commit the AC-069 deterministic fixtures and the adversarial fixture set (≥5, Vietnamese and English, including one zero-width/bidi variant)
- [ ] Write `parseGrade.test.ts` and `prompt.test.ts` covering every Proof Obligation below; confirm they fail because the modules do not exist

### 2. Green Phase
- [ ] Implement `parseGrade.ts` — strict validation, closed reason union, never throws
- [ ] Implement `prompt.ts` — rubric block, labelled reference region, labelled data region after the instructions, anti-injection sentence, output shape and band set in words
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm `ESSAY_BANDS` is compared in this file only (repo scan)
- [ ] Confirm neither module reads env, touches the DB, or imports `groqClient.ts`
- [ ] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: static types, the closed `reason` union — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit correctness; AC-069's deterministic recorded-response cases are **merge-blocking** — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: `GROQ_API_KEY` and `api.groq.com` never reach the client bundle (AC-029) — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**`
- AC-070 adversarial evaluation, real provider — Enforces: prompt-injection score inflation measured by **controlled comparison** — covers `SOURCE/lib/essay/{prompt,parseGrade}.ts`; **adopted but NOT a merge gate** — nightly/on demand, and **mandatory re-run on every `ESSAY_GRADER_MODEL` change** (AC-032). Runs in Phase E, Task E3.

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
| 7 | `npm run check:bundle` | | Gate E2 — this task's files match `SOURCE/lib/essay/**` |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run `parseGrade()` over the AC-069 deterministic fixture set (number outside the set, free prose, empty output, broken JSON, non-boolean confidence) and assert each returns the **specific** `{ ok: false, reason }` — never a throw, never a coerced value; run `buildEssayPrompt()` over a fixture and assert the model answer appears exactly once inside the labelled reference region and the student answer exactly once inside the labelled data region, positioned after the instructions.
- **Success criteria**: no input throws; every invalid input maps to its own reason; the two regions each contain their payload exactly once and the data region follows the instructions; the anti-injection sentence is present.
- **Failure response**: if any `ok: false` path is mapped to band 0 anywhere, **stop** — a rejected output must settle `failed`, never 0 (AC-007). If a fixture throws, the parser is not defensive enough; harden it rather than pre-filtering the input at the call site.
- **Verification level**: **L2** — new tests added and passing; nothing runs end to end in this phase.

## Proof Obligations
- **Claim (EG-BE-014 / Failure Mode Checklist: invalid option)**: a band outside `{0, 0.25, 0.5, 0.75, 1}` is **rejected** — no rounding, no clamping, no nearest-band mapping.
  - **Primary failure mode**: a "helpful" nearest-band snap turns a model's 0.6 into 0.5 and silently invents a score. **Boundary to exercise**: in-process unit. **State assertion**: N/A. **Mock boundary rationale**: none — the input is a string. **Residual**: none.
- **Claim (EG-BE-015 / invalid option)**: a confidence field that is absent, non-boolean, or free text is invalid output — **not** defaulted to `false`, **not** coerced by truthiness: `"true"`, `1`, `0`, `null` all fail.
  - **Primary failure mode**: truthiness coercion, so `"false"` (a non-empty string) reads as `true`. **Boundary to exercise**: in-process unit. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: none.
- **Claim (Failure Mode Checklist: empty input)**: `parseGrade()` must not throw on an empty string, truncated JSON, or an array.
  - **Primary failure mode**: an exception escaping the parser and being caught somewhere that turns it into band 0. **Boundary to exercise**: in-process unit. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: none.
- **Claim (EG-BE-017 / AC-068)**: the model answer appears exactly once inside the labelled reference region; the student answer exactly once inside the labelled data region, placed **after** the instructions.
  - **Primary failure mode**: the student's text concatenated into instruction position, so an instruction inside it is read as an instruction. **Boundary to exercise**: in-process unit over the built prompt string. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: proves **placement and neutralisation**, not that an attack fails — inflation is only observable against a real provider (AC-070, Task E3).
- **Claim (AC-069)**: the deterministic recorded-response cases are **merge-blocking**.
  - **Primary failure mode**: the cases exist but are `skip`ped or excluded, so they never execute. **Boundary to exercise**: the default vitest lane. **State assertion**: N/A. **Mock boundary rationale**: recorded responses only — no provider is reached, deliberately. **Residual**: a recorded response cannot be inflated by any injection, so this proves rejection logic, not attack resistance.
- **Claim (AC-007, the rule this task must not break)**: mapping `ok: false` to band 0 **anywhere** is forbidden. A rejected output settles **failed**, so a successful attack produces a stuck question the student can see, not a silent zero that looks like poor work.
  - **Primary failure mode**: a `?? 0` at any call site. **Boundary to exercise**: in-process unit plus a review of the return type's use in B1.4. **State assertion**: N/A here (B1.4 owns the settle). **Mock boundary rationale**: none. **Residual**: the settle path itself is proven in B1.4 (EG-BE-016).

## Completion Criteria
- [ ] **Implementation Complete** = both modules + both fixture sets committed
- [ ] **Quality Complete** = six verify gates green, plus `npm run check:bundle`
- [ ] **Integration Complete** = N/A until Task B1.4 wires them
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: `parseGrade()` is the consumer-side parse rule of the Groq boundary; `buildEssayPrompt()` builds its request body. Both are wired by Task B1.4.
- Scope boundary: neither module reads env, touches the DB, nor knows which model receives the prompt — the model constant lives in `SOURCE/lib/ai/models.ts` (Task H4) and the emission point in `groqClient.ts` (Task B1.2).
- Recorded for Phase E: changing `ESSAY_GRADER_MODEL` obliges a **full dated AC-070 re-run** (AC-032), not just a string edit.
