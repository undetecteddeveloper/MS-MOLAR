# Task B1.2 — `lib/essay/groqClient.ts` + emission-point scan + negative control (one commit)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase B1 (Automatic Grading Path, vertical slice V1), Task B1.2**
Layer: **backend** (`SOURCE/lib/essay/**`)

Metadata:
- Dependencies: **Task H3**, **Task H4**.
- Blocks: **Task B1.4**.
- Provides: the single Groq emission point, its chokepoint scan and the AC-034 negative control.
- Size: Medium (3 files, one commit)
- Verification level: **L2** + `npm run check:bundle`.

## Hard sequencing rule (Gate H8)
The emission module and its scan land in the **same commit**. A commit with the module and no scan is a window in which the repo's strongest AI-safety property is **false**.

## Implementation Content

Create `SOURCE/lib/essay/groqClient.ts` with:
- `import "server-only"` at the top;
- **one** exported endpoint constant `GROQ_CHAT_COMPLETIONS_URL = "https://api.groq.com/openai/v1/chat/completions"`;
- **one** `POST` via plain `fetch`;
- `GROQ_API_KEY` read from server env;
- **our own** retry loop;
- an `AbortController`-based call deadline;
- error classification into a **closed union**.

**No SDK** (ADR-0018 Decision 5).

Time constants — `GROQ_CALL_DEADLINE_MS = 20_000`, `GROQ_MAX_IN_PASS_RETRIES = 2`, `GROQ_RETRY_MAX_WAIT_MS = 8_000`, honouring the `retry-after` header on 429. All four chosen by argument; all four owned by **OQ-1** until measured (Phase E, Task E5).

### The chokepoint scan (same commit)
Create the scan under `SOURCE/lib/essay/__tests__/`, copying the structure of `SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts:110-178` with **one decisive difference**: the scan keys on the **endpoint-constant identifier or the module import — never the host string**.

`api.groq.com` is about to appear in `scripts/check-ai-key-bundle.mjs` (Task H4); that file matches the scan's `SOURCE_FILE` pattern (which deliberately includes `.mjs`) and does **not** match `TEST_FILE`, and `scripts/` sits inside `OFFLINE_SCRIPT_DIRS` — so a host-keyed scan would classify **the bundle guard itself** as an emission site and force it into one of two exhaustive `toEqual` lists, turning the repo's strongest AI guard into a list of exceptions.

Include the case asserting the **offline-scripts list is empty**, which goes red the moment anyone changes the scan key.

### The AC-034 negative control (same commit)
The Gemini `EMIT_PATTERN` (`/\.models\.generateContent\s*\(/`) matches **zero** lines inside the Groq module — the existing guard is blind to a second provider, and this is the case that proves the new guard is not blind in the same way. Template: `geminiChokepoint.test.ts:304-335` ("the chokepoint does not swallow anyone else's responsibility").

## Target Files
- [x] `SOURCE/lib/essay/groqClient.ts` (new)
- [x] `SOURCE/lib/essay/__tests__/groqClient.test.ts` (new)
- [x] `SOURCE/lib/essay/__tests__/groqChokepoint.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `groqClient.ts` line: `server-only`, one endpoint constant, one `fetch` POST, own retry loop, closed error union)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Điểm phát Groq / D-07 — the scan keys on the endpoint-constant identifier, never the host string; the AC-034 negative control)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Security Considerations — `GROQ_API_KEY` read only inside `groqClient.ts`; the three console-logging rules)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Risks — R-03: a host-keyed scan pulls the bundle guard into an exception list; R-06: the design does not depend on `response_format`)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 5: plain `fetch`, one endpoint constant, our own retry loop, **no SDK**)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — items #5 and #5b)
- `SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts` (`:110-178` the scan structure to copy; `:304-335` the negative-control template; `SOURCE_FILE`, `TEST_FILE`, `OFFLINE_SCRIPT_DIRS`, `EMIT_PATTERN`)
- `SOURCE/scripts/check-ai-key-bundle.mjs` (after Task H4 — it now contains `api.groq.com`; this is the file a host-keyed scan would wrongly classify)
- `SOURCE/lib/essay/prompt.ts` and `SOURCE/lib/essay/parseGrade.ts` (Task H3 — the request body builder and the response parse rule this client sits between)
- `SOURCE/lib/ai/models.ts` (Task H4 — `ESSAY_GRADER_MODEL`, read from here, **not** redeclared)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | dependency_direction | Groq is reached with plain `fetch` against one exported endpoint constant, with our own retry loop, from one `server-only` module. **No SDK is added** — not `groq-sdk`, not the OpenAI SDK pointed at Groq's compatible endpoint | `groqClient.ts` imports no SDK, `package.json` gains no SDK dependency, and the module carries `import "server-only"` |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | contract_schema | `SECRETS` gains a `GROQ_API_KEY` entry with markers `["GROQ_API_KEY", "api.groq.com"]`; the emission scan keys on the **endpoint-constant identifier or the module import — never the host string**, so the bundle marker and the scan key are different strings by construction | The scan's key is the endpoint-constant identifier or the module import, and the string `api.groq.com` is **not** used as a scan key |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `gradeEssays()` → `api.groq.com` (cross-process HTTPS) |
|---|---|
| Owner (left) | `SOURCE/lib/essay/groqClient.ts` — **the single emission point** |
| Owner (right) | Groq OpenAI-compatible Chat Completions, `https://api.groq.com/openai/v1/chat/completions` |
| Serialized format | JSON POST body: model = `ESSAY_GRADER_MODEL`, messages built by `lib/essay/prompt.ts`, `response_format: {"type":"json_object"}` **as noise reduction only** |
| Consumer parse rule | `parseGrade()` validates strictly and never throws: band must `===` a member of `ESSAY_BANDS`; the confidence flag must be `typeof === "boolean"`; anything else is `{ ok: false, reason }` and settles `failed` |
| Expected signal | Chokepoint scan: the request-reachable emission surface is **exactly one module** (exhaustive `toEqual`), the offline-scripts list is **empty**, and the Gemini `EMIT_PATTERN` matches **zero** lines in the Groq module (AC-034) |

Roundtrip check this task owns: the body this client emits is the one `prompt.ts` built, and the text it returns is the one `parseGrade()` is written to validate — the design never depends on `response_format` being honoured (R-06).

## Investigation Notes

**Scan key chosen: `/GROQ_CHAT_COMPLETIONS_URL/`** — the endpoint-constant identifier.

Why it cannot collide with the bundle marker: the two guards key on **structurally different strings**. The bundle guard's markers are `["GROQ_API_KEY", "api.groq.com"]` (`scripts/check-ai-key-bundle.mjs:147`); this scan's key is an identifier that appears nowhere in that file. Verified as an assertion, not an assumption — `groqChokepoint.test.ts` asserts both halves: `check-ai-key-bundle.mjs` **does** contain `api.groq.com` (so the premise is real) and **does not** match the scan key (so the scan cannot classify it). A host-keyed scan would have pulled the bundle guard into the offline-scripts `toEqual`, because `.mjs` matches `SOURCE_FILE`, does not match `TEST_FILE`, and `scripts` is in `OFFLINE_SCRIPT_DIRS` — R-03 exactly.

**Offline-scripts list: `[]`** — empty, as required, and asserted by exhaustive `toEqual`. This is the case that goes red the moment anyone switches the scan key to the host string.

**Emission surface: `["lib/essay/groqClient.ts"]`** — exhaustive `toEqual`, one module.

**AC-034 negative control: passes.** The Gemini `EMIT_PATTERN` (`/\.models\.generateContent\s*\(/`) matches **0** lines in `groqClient.ts`. The symmetric case is asserted too — `lib/ugc/gemini.ts` does not contain the Groq scan key — so the two guards stay independent and neither can make the other's exhaustive list red.

**`npm run check:bundle`: exit 0** — `✅ Server-secret bundle check PASS — 8 bí mật server-only không xuống client.` (`SECRETS.length` is 8, the H4 value.) The three payOS `⚠ Không đọc được giá trị …` lines are pre-existing marker-only-scan warnings, unrelated to this task.

**Two repo conventions found during the Red phase, both corrected rather than worked around:**

1. `groqClient.ts` carries `import "server-only"`, which throws under vitest. The repo idiom is `vi.mock("server-only", () => ({}))` hoisted above the import — used at `quota.test.ts:36`, `budgetDay.test.ts:9`, `geminiChokepoint.test.ts:30`. Adopted.
2. The "`GROQ_API_KEY` is read only in this module" assertion initially failed: `lib/env/checkEnv.ts:245` also names it. That reader is **legitimate and different in kind** — it asks only *whether the variable is present*, to emit a startup `warn`, and never touches the value. The assertion now pins an exhaustive list of **three** files with the distinction written out: `groqClient.ts` (the only value reader), `checkEnv.ts` (presence only), `check-ai-key-bundle.mjs` (variable name as a marker). A fourth entry appearing is a real signal.

**Mutation testing — the behavioural tests were checked for the ability to fail**, because a retry/classification test that cannot fail is worse than none:

| Mutation applied to `groqClient.ts` | Result |
|---|---|
| non-429 failures made retryable | **10 failed** / 19 passed |
| the `retry-after > GROQ_RETRY_MAX_WAIT_MS` bail-out removed | **1 failed** / 28 passed |
| one shared `AbortController` across the whole retry chain | **1 failed** / 28 passed |

Each was caught by the assertion written to catch it, and the module was restored from backup after each.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write `groqChokepoint.test.ts` (exhaustive `toEqual` on the emission surface, the empty offline-scripts case, the AC-034 negative control) and `groqClient.test.ts` (retry loop, error classification, deadline) — observe them fail because the module does not exist
- [x] Confirm the chosen scan key does **not** match `scripts/check-ai-key-bundle.mjs`

### 2. Green Phase
- [x] Create `groqClient.ts`: `server-only`, one endpoint constant, one `fetch` POST, own retry loop with `retry-after` honoured on 429, `AbortController` deadline, closed error union, the four time constants
- [x] Run only the added tests and confirm they pass
- [x] Run `npm run check:bundle`

### 3. Refactor Phase
- [x] Confirm `GROQ_API_KEY` is read **only** inside this module
- [x] Confirm no `console` call in this module can carry the student's answer, the prompt, the raw response or the provider's `err.message`
- [x] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the closed error union — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: a `server-only` import does not leak into a client tree — Config: `SOURCE/package.json` (project-wide)
- `npm run check:bundle` — Enforces: `GROQ_API_KEY` and `api.groq.com` never reach the client bundle (AC-029) — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`; covers `SOURCE/lib/essay/**`
- Emission-point (chokepoint) scan — Enforces: the request-reachable Groq emission surface is **exactly one module** (AC-033) plus a negative control (AC-034) — Config: new test under `SOURCE/lib/essay/__tests__/`, shaped after `SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts:110-178`; covers `SOURCE/lib/essay/groqClient.ts`

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | The closed `GroqFailure` union type-checks; `strict` on |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1761 passed / 10 skipped / 3 todo. +38 from this task (29 client, 9 chokepoint) |
| 4 | `npm run build` | **0** | `server-only` did not leak into any client tree |
| 5 | `npm run test:fixture` | **1** | **Expected red, TD-030 baseline EXACTLY as Gate F1 names it**: 2 failures, both `subscription.fixture.e2e.test.ts` › FE-1 (e) — `locale en` and `locale vi`. Case names captured, not inferred from the count |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo. Run **alone**: chaining it behind `build` + `test:fixture` earlier in the session produced a contention timeout that a clean run refuted |
| 7 | `npm run check:bundle` | **0** | `SECRETS.length === 8`; `GROQ_API_KEY` and `api.groq.com` absent from the client bundle |

**Also recorded — the known-red window (Gate E4 requires it at every commit inside it):** `npm run verify:schema` (dev) → exit **1**, exactly **1** failing assertion, and it is the character-ceiling gate (`LIMITS.MAX_ATTEMPT_ANSWER` = 500 vs a DB ceiling of 4000). Red **by design** from Task H7 until Task B3.3. Any *other* assertion red would be a regression.

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: run the chokepoint scan and read its exhaustive `toEqual` result; run `groqClient.test.ts` with `fetch` mocked **at the `fetch` boundary and no deeper**, so the retry loop, error classification and deadline run **real code**; run `npm run check:bundle`.
- **Success criteria**: the emission surface list equals exactly `["SOURCE/lib/essay/groqClient.ts"]`; the offline-scripts list is **empty**; the Gemini `EMIT_PATTERN` matches **0** lines in the Groq module; a 429 with retries left is retried (not terminal) while a non-429 error and 429-exhaustion are **different** terminal causes; `check:bundle` green.
- **Failure response**: if the scan classifies `scripts/check-ai-key-bundle.mjs` as an emission site, the scan key is the host string — change the **key**, never add an exception to the list. If the offline-scripts case goes red, someone changed the scan key; that is the signal it exists to give.
- **Verification level**: **L2**.

## Proof Obligations
- **Claim (AC-033)**: the request-reachable Groq emission surface is **exactly one module**, asserted by exhaustive `toEqual`.
  - **Primary failure mode**: a second module gains a `fetch` to Groq and nothing notices, so the key-handling and logging rules apply in one place and not the other. **Boundary**: a repository source scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: proves the surface at scan time; a dynamically constructed URL would evade it, which is why the key is the **endpoint-constant identifier or module import**.
- **Claim (AC-034)**: the Gemini `EMIT_PATTERN` matches **zero** lines inside the Groq module.
  - **Primary failure mode**: the new guard is blind in the same way the old one is — each provider's guard silently ignoring the other's emission shape. **Boundary**: source scan. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (AC-029)**: `GROQ_API_KEY` and `api.groq.com` never reach the client bundle; the host marker is in place from Task H4.
  - **Primary failure mode**: the module is imported (even transitively) from a client tree. **Boundary**: the built bundle, via `npm run check:bundle`, plus `npm run build`'s `server-only` check. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.
- **Claim (the retry loop's own behaviour, AC-024 / AC-065)**: a 429 with retries left is **not terminal**; a non-429 error and 429-exhaustion are **different** terminal causes — because the lifecycle decision depends on *why* a call failed.
  - **Primary failure mode**: collapsing all failures into one cause, so a rate limit and an invalid response settle identically and the telemetry cannot tell them apart. **Boundary**: in-process, with `fetch` mocked **at the `fetch` boundary and no deeper**, so the retry loop, error classification and deadline are real code. **State assertion**: N/A (the budget reservation is B1.3's; a retry inside the pass must **not** emit a second `INCRBY` — asserted in B1.4). **Mock rationale**: `fetch` is the external I/O boundary; mocking deeper would verify wiring instead of behaviour. **Residual**: the settle decision per cause is B1.4's (EG-BE-016).
- **Claim (Gate H8)**: the emission module and the scan land in the **same commit**.
  - **Primary failure mode**: a commit exists in which the property "exactly one emission surface" is false and nothing says so. **Boundary**: the commit itself. **State assertion**: N/A. **Mock rationale**: none. **Residual**: none.

## Completion Criteria
- [x] **Implementation Complete** = module + **both** scan cases in one commit
- [x] **Quality Complete** = six verify gates **plus** `npm run check:bundle` green (gate 5 red = TD-030 baseline only)
- [x] **Integration Complete** = the emission surface is **provably one module before anything calls it** — B1.4, the only caller, does not exist yet
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: Task B1.4 is the only caller; Task B3.2's retry path drives the same client through `gradeEssays`.
- Scope boundary — preserve unchanged: `SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts` (its structure is **copied**, not edited); `SOURCE/scripts/check-ai-key-bundle.mjs` (owned by H4 — and the file this scan must **not** classify as an emission site).
- The four time constants are owned by **OQ-1** until measured in Phase E, Task E5 — do not treat them as verified numbers.
