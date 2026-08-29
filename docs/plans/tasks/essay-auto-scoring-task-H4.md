# Task H4 — `checkEnv.ts` three variables + `SECRETS` entry with both pins + `ESSAY_GRADER_MODEL` (one commit)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H4**
Layer: **backend** (`SOURCE/lib/env/**`, `SOURCE/scripts/**`, `SOURCE/lib/security/**`, `SOURCE/lib/ai/**`)

Metadata:
- Dependencies: **none**.
- Blocks: **Task B1.2** (the bundle marker must exist before the emission module does).
- Provides: the three registered env variables, the eighth `SECRETS` entry with both pins moved, and `ESSAY_GRADER_MODEL`.
- Size: Medium (4 files, one commit)
- Verification level: **L2** + `npm run check:bundle`.

## Change Category
`Change Category: boundary-change`

`SECRETS` is a published contract with two pinned assertions in a coupled test file. The adjacent cases to sweep: the exhaustive `toEqual` over label+markers at `checkAiKeyBundleSecrets.test.ts:34` and the count pin at `:74` — **both** move in this commit, or the "Lint · Types · Tests" job goes red.

## Implementation Content

All four edits land in **one commit** (Gate H1).

- **`SOURCE/lib/env/checkEnv.ts`**: register
  - `GROQ_API_KEY` — following the `GEMINI_API_KEY` shape at `:77-84`;
  - `GROQ_BUDGET_DAILY_LIMIT` — following `AI_BUDGET_DAILY_LIMIT` at `:217-239`, **fail-closed**;
  - `ESSAY_GRADING_ENABLED` at level **`warn`** — **not** `error` — with the operator-visible consequence spelled out: an environment with grading off is a fully valid environment, and it is the shipping state.
- **`SOURCE/scripts/check-ai-key-bundle.mjs`**: add the `SECRETS` entry
  `{ label: "Groq API key (ADR-0018)", value: read("GROQ_API_KEY"), markers: ["GROQ_API_KEY", "api.groq.com"] }`.
  **Never** an SDK package name as a marker — there is no SDK.
- **`SOURCE/lib/security/checkAiKeyBundleSecrets.test.ts`**: update the exhaustive `toEqual` over label+markers at `:34`, and change `expect(SECRETS.length).toBe(7)` to `toBe(8)` at `:74`.
- **`SOURCE/lib/ai/models.ts`**: add `ESSAY_GRADER_MODEL = "qwen/qwen3.8-27b"`. It lives **here**, not in `groqClient.ts`, because this module has **no** `import "server-only"` and is therefore the only place both the Next bundle and a `tsx` script can read — the incident recorded at `models.ts:9-13` (a script hard-coding a model name and drifting from the bundle's constant, unnoticed) recurs verbatim otherwise. Carry the AC-070 re-run obligation in a comment beside the constant.

### Hard sequencing rule (Gate H1)
`SECRETS` and its **two** pins land in **this one commit**. Missing either turns the "Lint · Types · Tests" job red. The file's own header (`:20-22`) explains why there are two pins and not just a count: a count stays green after losing exactly the most valuable marker.

## Target Files
- [ ] `SOURCE/lib/env/checkEnv.ts`
- [ ] `SOURCE/scripts/check-ai-key-bundle.mjs`
- [ ] `SOURCE/lib/security/checkAiKeyBundleSecrets.test.ts`
- [ ] `SOURCE/lib/ai/models.ts`

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `checkEnv.ts` line: three variables, `ESSAY_GRADING_ENABLED` at level `warn`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Điểm phát Groq — `SECRETS` and the two pins; `ESSAY_GRADER_MODEL` under `lib/ai/models.ts` discipline)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Minimal Surface Alternatives — MSA-4: `GROQ_BUDGET_DAILY_LIMIT` as the env var name)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 5: plain `fetch`, one endpoint constant, our own retry loop, **no SDK**)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — items #5 and #5b: `SECRETS` markers `["GROQ_API_KEY", "api.groq.com"]`; the emission scan keys on the **endpoint-constant identifier or the module import — never the host string**)
- `docs/adr/ADR-0006-gemini-extraction-protocol.md` (§ Decision — free-tier limits are **per project, not per user**, and the model catalogue has broken once with a real key)
- `SOURCE/lib/env/checkEnv.ts` (`:77-84` `GEMINI_API_KEY`; `:217-239` `AI_BUDGET_DAILY_LIMIT`)
- `SOURCE/scripts/check-ai-key-bundle.mjs` (the `SECRETS` array and the `read()` helper)
- `SOURCE/lib/security/checkAiKeyBundleSecrets.test.ts` (`:20-22` the header explaining the two pins; `:34` the exhaustive `toEqual`; `:74` `expect(SECRETS.length).toBe(7)`)
- `SOURCE/lib/ai/models.ts` (`:9-13` — the recorded 2026-07-17 incident that fixes where this constant lives)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | dependency_direction | Groq is reached with plain `fetch` against one exported endpoint constant, with our own retry loop, from one `server-only` module. **No SDK is added** — not `groq-sdk`, not the OpenAI SDK pointed at Groq's compatible endpoint | `package.json` gains no Groq or OpenAI SDK dependency, and no `SECRETS` marker names an SDK package |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | contract_schema | `SECRETS` gains a `GROQ_API_KEY` entry with markers `["GROQ_API_KEY", "api.groq.com"]`; the emission scan keys on the **endpoint-constant identifier or the module import — never the host string**, so the bundle marker and the scan key are different strings by construction | The new `SECRETS` entry carries exactly those two markers, and this commit adds no scan keyed on the host string |
| `docs/adr/ADR-0006-gemini-extraction-protocol.md` (§ Decision) | placement | Free-tier limits are **per project, not per user**, and the model catalogue has broken once with a real key — which is why the model name is a constant under `lib/ai/models.ts` discipline | `ESSAY_GRADER_MODEL` is declared in `SOURCE/lib/ai/models.ts` and nowhere else |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_GRADING_ENABLED` (server env) → three server read sites → one client prop |
|---|---|
| Owner (left) | Vercel / `.env.local` |
| Owner (right) | `submitExam()` (behaviour gate), `retryEssayGrading()` (behaviour gate), the player route segment (copy gate) → `ExamPlayer` → `QuestionRenderer` |
| Serialized format | Env string; **only** `"true"` (trimmed) means on. Crosses the server/client boundary as a **pre-read boolean prop** `essayGradingEnabled?: boolean`, optional, defaulting to `false`. **Never** `NEXT_PUBLIC_*` (UI-D7) |
| Consumer parse rule | The client component treats an absent prop as `false` and selects `player.essayNotScored`; **`checkEnv.ts` registers the variable at level `warn` with the operator-visible consequence spelled out** |
| Expected signal | INT-1(d): four spellings (absent, `""`, `"TRUE"`, `"1"`) all mean off, with a trimmed `"true"` as the single positive control; FE2E-1: no essay node, no timer, zero refreshes |

Roundtrip check this task owns: the variable registered here is the **same one** all three read sites read, so they flip together in a single deploy.

## Investigation Notes
_(Record here: the exact `SECRETS` entry added; the before/after of both pins; confirmation that `models.ts` still has no `import "server-only"`; `npm run check:bundle` output.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] **Sweep the adjacent cases** (Change Category: boundary-change): both pins in `checkAiKeyBundleSecrets.test.ts` (`:34` exhaustive `toEqual`, `:74` count) — confirm there is no third assertion over `SECRETS` anywhere else
- [ ] Update the two pins **first** and observe the suite go red (7 ≠ 8, and the `toEqual` missing the new entry)

### 2. Green Phase
- [ ] Add the `SECRETS` entry with both markers
- [ ] Register the three variables in `checkEnv.ts` (`ESSAY_GRADING_ENABLED` at level `warn`)
- [ ] Add `ESSAY_GRADER_MODEL = "qwen/qwen3.8-27b"` to `lib/ai/models.ts` with the AC-070 comment
- [ ] Run the suite and `npm run check:bundle`; confirm green

### 3. Refactor Phase
- [ ] Confirm no marker names an SDK package, and no SDK dependency was added
- [ ] Confirm `lib/ai/models.ts` still carries **no** `import "server-only"`
- [ ] Confirm the added/updated tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: both `SECRETS` pins — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: `GROQ_API_KEY` and `api.groq.com` never reach the client bundle (AC-029) — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**`, all client components

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
| 7 | `npm run check:bundle` | | Gate E2 — this task's files match `SOURCE/scripts/check-ai-key-bundle.mjs` |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run `npm run check:bundle` and the default vitest lane; read `checkEnv.ts`'s output for a shell with `ESSAY_GRADING_ENABLED` absent and confirm it produces a **warning**, not an error.
- **Success criteria**: `SECRETS.length === 8`; the exhaustive `toEqual` includes the new label and both markers; `npm run check:bundle` green; an environment without `ESSAY_GRADING_ENABLED` starts cleanly with an operator-visible warning; a missing or invalid `GROQ_BUDGET_DAILY_LIMIT` is reported fail-closed.
- **Failure response**: if only one of the two pins was moved, the job goes red — move the other in the **same** commit rather than splitting them; a count-only pin stays green after losing exactly the most valuable marker, which is why both exist.
- **Verification level**: **L2** — new/updated tests and the bundle guard passing.

## Proof Obligations
- **Claim (AC-029)**: `GROQ_API_KEY` and `api.groq.com` never appear in the client bundle.
  - **Primary failure mode**: the key reaches a client component through an unguarded import and no marker exists to catch it. **Boundary to exercise**: the built client bundle, via `npm run check:bundle` (process boundary). **State assertion**: N/A. **Mock boundary rationale**: none — the real build output is scanned. **Residual**: proves absence from the bundle; the emission-surface claim (exactly one module) is Task B1.2's.
- **Claim (AC-032)**: the model constant lives under `lib/ai/models.ts` discipline and carries the AC-070 re-run obligation in a comment.
  - **Primary failure mode**: the constant is declared inside `groqClient.ts`, which carries `server-only`, so a `tsx` script cannot read it and hard-codes its own copy — the recorded 2026-07-17 incident, verbatim. **Boundary to exercise**: in-process import from both a bundle module and a script context. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: none.
- **Claim (AC-031 precondition / Failure Mode Checklist: missing config)**: `GROQ_BUDGET_DAILY_LIMIT` is gated at startup; missing or invalid ⇒ refuse to grade, **never** pass unmetered.
  - **Primary failure mode**: an unset limit read as `Infinity` or `0` and treated as "no ceiling", so a day of heavy use is unbounded. **Boundary to exercise**: in-process `checkEnv` evaluation with the variable absent and with an invalid value. **State assertion**: N/A here; the refusal behaviour is proven in B1.3. **Mock boundary rationale**: env read directly. **Residual**: the fail-closed **refusal** is B1.3's obligation; this task proves only the registration.
- **Claim (Failure Mode Checklist: shared-state dependency)**: `ESSAY_MAX_ATTEMPTS` in TypeScript versus the SQL literal is the one unavoidable double declaration, held together by a `verify:schema` pin gate rather than a third copy.
  - **Primary failure mode**: a third copy appears — e.g. an env variable or a script constant — and the pin gate no longer covers every site. **Boundary to exercise**: repo scan. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: the pin gate itself is written in Task H6.
- **Claim (the failure mode this task guards against)**: a host marker chosen for the **scan key** as well. The bundle marker **is** the host string; the scan key must be a **different string by construction** (Task B1.2).
  - **Primary failure mode**: `scripts/check-ai-key-bundle.mjs` — which now contains `api.groq.com` — is classified as an emission site by a host-keyed scan and forced into an exhaustive `toEqual` exception list, turning the repo's strongest AI guard into a list of exceptions. **Boundary to exercise**: reviewed at B1.2 against this commit's marker. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: B1.2 owns the scan.

## Completion Criteria
- [ ] **Implementation Complete** = four files edited in **one** commit
- [ ] **Quality Complete** = six verify gates **plus** `npm run check:bundle` green
- [ ] **Integration Complete** = the guard is in place **before** anything it guards exists
- [ ] `SECRETS.length === 8` with **both** pins moved in this commit
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B1.2 (the emission module) depends on this marker existing first; Tasks B1.5, B3.2 and F-D1 read the variable registered here.
- Scope boundary — preserve unchanged: every existing `SECRETS` entry and its markers; `GEMINI_API_KEY`'s and `AI_BUDGET_DAILY_LIMIT`'s registrations (they are the shape being followed, not edited); every existing constant in `lib/ai/models.ts`.
- `ESSAY_GRADING_ENABLED` is registered at `warn` on purpose: an environment with grading off is a **fully valid** environment, and it is the state this feature ships in.
