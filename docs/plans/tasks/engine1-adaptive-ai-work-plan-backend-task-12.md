# Task 12 (Backend): `lib/tutor/callTutor.ts` + telemetry payload builder (Work Plan Phase 3, Task 12)

Metadata:
- Dependencies: backend-task-11 (`TUTOR_CALL_DEADLINE_MS`, `TutorPromptInput`/`buildTutorPrompt()`'s shape, for consistency)
- Provides: `generateHint()`, `logTutorExit()`, the telemetry payload builder, consumed by backend-task-13 (`explainStep()`) and reconciled against backend-task-08's `getSkillRecommendation()` telemetry shape
- Size: Medium (3 files: `callTutor.ts`, `telemetry.ts` or co-located, `telemetry.test.ts`)

## Implementation Content

Implement `generateHint()` (reuses `getGeminiClient()`, `QUESTION_MODEL`, `makeDeadlineSignal()`, `sdkErrorDetail()` from `lib/ugc/gemini.ts` — **not** `logExtractorExit()` verbatim, its hardcoded `"[ugc-extract]"` prefix would mislabel tutor logs; add a small analogous helper instead) and `logTutorExit()`.

Extract the `telemetry_log` insert-payload construction into its own small, pure, unit-testable function per the skeleton's own suggestion (home: `lib/tutor/telemetry.ts`, new file, or co-located in `callTutor.ts` — implementer's choice), reused by both `explainStep()` (backend-task-13) and `getSkillRecommendation()` (backend-task-08, if not already using an equivalent inline shape — reconcile if so, since backend-task-08 landed first per the dependency graph).

Convert `telemetry.test.ts`'s 1 already-generated test into a real vitest test: every field of the constructed payload is either structurally safe (uuid/boolean/timestamp/closed enum) or, for `error_code`, strictly one of the 4 named literals — never a raw `Error.message`, across a fixture battery including a simulated error whose message contains an answer-key-shaped sentinel.

## Target Files
- [x] `SOURCE/lib/tutor/callTutor.ts` (new — `generateHint()`, `logTutorExit()`)
- [x] `SOURCE/lib/tutor/telemetry.ts` (new, or co-located in `callTutor.ts` per implementer's choice — telemetry payload builder, e.g. `buildTelemetryPayload()`) — landed as its own file
- [x] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (fill in the existing skeleton's 1 test)

## Investigation Targets
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (already generated — read in full: the Implementer note explaining why a standalone payload-builder function must be extracted, and the exact test annotation)
- `SOURCE/lib/ugc/gemini.ts` (`getGeminiClient()` line ~33, `QUESTION_MODEL` line ~18, `makeDeadlineSignal()` line ~106, `sdkErrorDetail()` line ~69, `logExtractorExit()` line ~60 — reuse all but the last verbatim; author a tutor-specific analog of `logExtractorExit()` instead)
- `SOURCE/app/(layer3)/queries.ts` (backend-task-08's `getSkillRecommendation()` — its existing inline `telemetry_log` insert shape, to reconcile with the extracted builder here)
- `SOURCE/supabase/schema.sql` (§18/§19 — `telemetry_log`'s exact column shape and `error_code`'s CHECK constraint, verbatim source for the Reference Contract below)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `lib/tutor/callTutor.ts` — `generateHint()`; § Telemetry payload builder (AC-013); § Logging and Monitoring — `telemetry_log.error_code` closed enum, never free text)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/engine1-adaptive-ai-backend-design.md (§18 schema, `telemetry_log.error_code`) | state-lifecycle-negative | "error_code text check (error_code is null or error_code in ('gemini_unavailable', 'rate_limited', 'server', 'not_eligible'))" — "Mã có cấu trúc, KHÔNG BAO GIỜ free-text/exception message" | Does the telemetry payload builder ever assign `error_code` a value outside these 4 literals (or `null`) — specifically never a raw caught-`Error`'s `.message` — verified across the fixture battery including a simulated error with an answer-key-shaped message (Y/N)? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular `gemini.ts`'s exported utilities and `telemetry.test.ts`'s single test annotation.
- [x] Convert the skeleton test into a real vitest test: a fixture battery of success/failure × `tutor_invoke`/`adaptive_route` event types, including a simulated caught `Error` whose `.message` contains a sentinel answer-key-shaped string (mirroring `prompt.test.ts`'s sentinel technique). — 6 fixtures: the 4 outcome × event-type combinations plus 2 adversarial ones (cast `err.message`, whole over-broad error context).
- [x] Run the test and confirm it fails (no payload builder exists yet). — failed with `Cannot find module '../telemetry'`.

### 2. Green Phase
- [x] Implement `generateHint()` reusing `getGeminiClient()`/`QUESTION_MODEL`/`makeDeadlineSignal()`/`sdkErrorDetail()`; implement a small tutor-specific `logTutorExit()` analog to `logExtractorExit()` (not reusing its hardcoded `"[ugc-extract]"` prefix). — prefix is `[tutor]`.
- [x] Implement the telemetry payload builder — every field either structurally safe or, for `error_code`, strictly one of the 4 named literals, never `err.message`.
- [x] Reconcile with backend-task-08's existing inline telemetry-insert shape in `getSkillRecommendation()` if it does not already use an equivalent structure — refactor `getSkillRecommendation()` to call this shared builder if straightforward, or document why not if reconciliation would expand this task's scope beyond its Target Files (escalate if so). — nothing to reconcile; see "Reconciliation decision" in Investigation Notes. `queries.ts` untouched.
- [x] Run `npx vitest run lib/tutor/__tests__/telemetry.test.ts` — confirm the test passes. — 1/1 passed.

### 3. Refactor Phase
- [x] Confirm `generateHint()`'s deadline handling correctly uses `TUTOR_CALL_DEADLINE_MS` (backend-task-11) via `makeDeadlineSignal()`, not a hardcoded value. — `makeDeadlineSignal(TUTOR_CALL_DEADLINE_MS)` imported from `./constants`; no numeric literal anywhere in `callTutor.ts` except the retryable-HTTP-status list.

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `lib/tutor/`
- `check-ai-key-bundle.mjs` — Covered: `lib/tutor/` — relevant since `callTutor.ts` touches `GEMINI_API_KEY` via `getGeminiClient()`

## Operation Verification Methods
- **Verification method**: run `npx vitest run lib/tutor/__tests__/telemetry.test.ts` against the fixture battery, with particular attention to the simulated-error-with-sentinel-message case.
- **Success criteria**: every field of the constructed payload is either structurally safe or, for `error_code`, strictly one of the 4 named literals; answer-key containment proven with 0 occurrences across the telemetry-payload fixture battery (Phase 3 Completion Criteria).
- **Failure response**: if the sentinel leaks into any payload field, treat as equally high-priority as backend-task-11's prompt-containment defect (same class of risk, different surface) — fix before backend-task-13 wires this builder into `explainStep()`.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
(Sourced verbatim from `telemetry.test.ts`'s own annotation.)
- **Claim**: 0 occurrences of answer-key material in the constructed `telemetry_log` insert payload, across a fixture battery including simulated error paths (AC-013).
- **Primary failure mode**: a future maintainer routes a caught exception's `err.message` (which could echo attacker-influenced UGC question content) into `error_code` or any other telemetry column instead of the constrained 4-member enum — reopening the exact leak path the schema's own CHECK constraint and this unit test both exist to prevent.
- **Boundary to exercise**: in-process unit (pure payload-construction function, no I/O — the actual DB insert call is a separate concern exercised by backend-task-08/13's integration tests).
- **State assertion**: N/A (pure function).
- **Mock boundary rationale**: none — no I/O at this layer.
- **Residual**: this test proves the payload-builder's own output is safe; it does not itself prove `explainStep()`/`getSkillRecommendation()` actually call this builder for every insert path rather than constructing an ad-hoc payload — that call-site discipline is proven by backend-task-13's `tutorActions.int.test.ts` Test 2 and backend-task-08's `getSkillRecommendation.int.test.ts` Test 1.

## Completion Criteria
- [x] `callTutor.ts`/telemetry payload builder implemented; `telemetry.test.ts` passes
- [x] Reconciliation with backend-task-08's existing telemetry-insert shape confirmed (either refactored to share the builder, or the decision not to documented) — no shape exists yet; decision + the contract task 08 must adopt are recorded in Investigation Notes
- [x] Reference Contract's Compliance Check evaluates to `Y`, evidence recorded in Investigation Notes
- [x] Each Proof Obligation is met — claim (0 occurrences) proven on the 6-fixture battery; primary failure mode exercised directly by the two adversarial fixtures and confirmed non-vacuous by mutation; boundary is in-process unit with no I/O and no mocks; state assertion N/A (pure function). Residual stands unchanged: call-site discipline (that `explainStep()`/`getSkillRecommendation()` actually route every insert through this builder) is backend-task-13's and backend-task-08's to prove.

## Investigation Notes
(Recorded 2026-08-14 during execution, per the executor's Step 2 gate.)

### Investigation Targets read

- **`SOURCE/lib/tutor/__tests__/telemetry.test.ts`** (comment-only skeleton, 65 lines): Implementer note mandates extracting a standalone pure `buildTelemetryPayload(...)` so the payload construction is unit-testable in isolation from the Supabase insert (mirroring `buildTutorPrompt()`'s pure-function shape). Mock boundary: none — no I/O at this layer. Proof obligation: over a battery (success/failure × `tutor_invoke`/`adaptive_route`, including a simulated caught `Error` whose `.message` carries an answer-key-shaped sentinel), every payload field is structurally safe, and `error_code` is strictly one of the 4 literals or `null`.
- **`SOURCE/lib/ugc/gemini.ts`**: `QUESTION_MODEL = "gemini-3.5-flash"` (L18); `getGeminiClient()` (L33) — singleton, `httpOptions.retryOptions.attempts = 3`, throws when `GEMINI_API_KEY` is absent, `import "server-only"` at module top (L9) so every importer is transitively server-only; `logExtractorExit(site, detail)` (L60) — `console.error` with a hardcoded `[ugc-extract]` prefix, `JSON.stringify` wrapped in try/catch; `sdkErrorDetail(err)` (L69) → `{name, status, code, message, cause}` (note: **carries `message`** — server-console only, never a DB column); `makeDeadlineSignal(ms)` (L106) → `{signal, clear}`, abort surfaces as an SDK error with `name === "AbortError"`.
- **Call-shape precedent `SOURCE/lib/ugc/extractAnswers.ts` L156-216**: `makeDeadlineSignal(...)` before `try`, `client.models.generateContent({ model, contents, config: { abortSignal, ... } })`, then four distinct exits (`finishReason !== "STOP"`, empty `text`, mapping failure, `catch`), each logging safe metadata + `elapsedMs`, with `deadline.clear()` in `finally`. `generateHint()` follows this exact control flow, minus the JSON/schema mapping exit (the tutor returns free prose, not structured output).
- **`SOURCE/app/(layer3)/queries.ts`** (41 lines): contains only `getAnalyticsByRange()`. **`getSkillRecommendation()` does not exist yet** — backend-task-08 has not landed despite being earlier in the dependency graph. See "Reconciliation decision" below.
- **`SOURCE/supabase/schema.sql` §19 (L1352-1390)**: `telemetry_log(id uuid default gen_random_uuid(), user_id uuid null on delete set null, event_type text not null check in ('adaptive_route','tutor_invoke'), question_id text null, skill_node_id text null, success boolean not null, error_code text check (null or in ('gemini_unavailable','rate_limited','server','not_eligible')), created_at timestamptz not null default now())`. `id` and `created_at` are DB-generated defaults, so the insert payload deliberately omits them (6 columns, not 8).
- **`docs/design/engine1-adaptive-ai-backend-design.md`**: L793-797 — `generateHint(input: TutorPromptInput): Promise<string>`, throws a typed error, dependencies are exactly `getGeminiClient()`/`QUESTION_MODEL`/`makeDeadlineSignal()`/`sdkErrorDetail()`/`buildTutorPrompt()`; L247 — `callTutor.ts` provides `generateHint()`, `logTutorExit()`; L813 — `getSkillRecommendation()`'s `adaptive_route` write mirrors `explainStep()`'s shape, fire-and-forget; L966-972 — the 4 error codes are also `explainStep()`'s return union, and every invocation (success or failure) attempts a best-effort insert; L1061 — "`telemetry_log.error_code` is a constrained enum, not free text, specifically to prevent a future maintainer from routing an exception message … into a stored log row". Work plan L146 — "Gemini 503/429/timeout → typed `gemini_unavailable`/`server` error".

### Planned approach (per Reference Contracts row)

`buildTelemetryPayload()` reproduces the schema's closed `error_code` enum with **two layers**, deliberately mirroring `prompt.ts`'s own two-layer containment: (1) its input type `TelemetryEvent` has no field capable of holding free text — `errorCode` is the 4-member union derived from a single `TELEMETRY_ERROR_CODES` tuple; (2) its body names all 6 columns explicitly (no spread, no `JSON.stringify`, no `Object.entries`) and routes `errorCode` through a runtime membership check against that same tuple, so a value smuggled in past the type (a cast `err.message`) becomes `null`, never a stored string.

### Reference Contracts compliance evaluation

| Source | Evaluation | Rationale |
|---|---|---|
| backend-design §18 schema, `telemetry_log.error_code` | **Y** | The builder can emit only a `TELEMETRY_ERROR_CODES` member or `null` for `error_code` — the closed tuple is both the type's source and the runtime filter's source, so the two can never drift apart. Proven at runtime by `telemetry.test.ts`: 0 sentinel occurrences across the 6-fixture battery (success/failure × `tutor_invoke`/`adaptive_route` + the two adversarial fixtures), where the adversarial fixtures feed a simulated caught `Error` whose `.message` embeds `SENTINEL-CORRECT-ANSWER-…` both as a cast `errorCode` and as a whole over-broad error-context object. Non-vacuity confirmed by mutation (see Mutation evidence). |

### Reconciliation decision (backend-task-08)

Nothing to reconcile: `app/(layer3)/queries.ts` has no `getSkillRecommendation()` and no `telemetry_log` insert of any kind, so no inline shape exists to refactor and `queries.ts` was left untouched (editing it would mean implementing part of backend-task-08 here). This task therefore *establishes* the shape. Contract for backend-task-08 to adopt verbatim: `buildTelemetryPayload({ eventType: "adaptive_route", userId, skillNodeId, success, errorCode })` → the 6-column insert object; `questionId` is omitted for routing events and lands as `null`. The `adaptive_route` half is already exercised by this task's fixture battery, so task 08 adopts a builder that is proven for its own event type, not just the tutor's.

### `logTutorExit()` vs. `logExtractorExit()` — duplication check

Step 3's indicator count is high (same responsibility, same signature, same body shape), but this is a **pre-adjudicated** duplication, not an open one: the backend Design Doc (L247) names `logTutorExit()` as a `callTutor.ts` deliverable and this task file explicitly forbids reusing `logExtractorExit()` verbatim, with the reason stated (its hardcoded `[ugc-extract]` prefix would mislabel tutor logs). The parameterize-the-prefix alternative would require editing `SOURCE/lib/ugc/gemini.ts`, which is outside both this task's Target Files and the overview doc's "Allowed change scope" — so the documented approach is also the only in-scope one. Proceeded as instructed rather than escalating a decision the authoritative documents already made.

### Fail-fast note on the `null` coercion

Dropping an unrecognized `error_code` to `null` is containment, not error suppression: the failure itself is still recorded in the row (`success: false`, which is what AC-012's count/outcome query reads), and the real diagnostic detail — including `sdkErrorDetail()`'s `message` field — is preserved server-side through `logTutorExit()` at the call site. This is the same split `gemini.ts` already uses (log rich metadata to the server console, never persist the payload); a `throw` here would instead turn a best-effort observability write into a second failure point for the student-facing read, which the Design Doc (L813, L972) explicitly forbids.

### Mutation evidence (non-vacuity)

With `buildTelemetryPayload()` mutated to pass `errorCode` through unchecked (`error_code: (event.errorCode ?? null) as TelemetryErrorCode | null` — i.e. exactly the "primary failure mode" the skeleton names: `err.message` routed into `error_code`), `npx vitest run lib/tutor/__tests__/telemetry.test.ts` **fails** on the leak assertion with 4 entries:

```
AssertionError: expected [ …(4) ] to deeply equal []
+ [ "error-message-cast-as-code/error_code: SENTINEL-CORRECT-ANSWER-leak",
+   "error-message-cast-as-code/error_code: SENTINEL-ESSAY-ANSWER-leak",
+   "broad-error-context/error_code: SENTINEL-CORRECT-ANSWER-leak",
+   "broad-error-context/error_code: SENTINEL-ESSAY-ANSWER-leak" ]
```

Both the cast-`err.message` fixture and the over-broad error-context fixture are caught, and the failure names the leaking column. Mutation reverted; the unmutated implementation passes (1/1). The battery is therefore not vacuous.

## Notes
- Impact scope: `SOURCE/lib/tutor/callTutor.ts`, `SOURCE/lib/tutor/telemetry.ts` (or co-located) and their test file; a possible small refactor of `SOURCE/app/(layer3)/queries.ts`'s existing inline telemetry-insert call if reconciliation is straightforward.
- Scope boundary: do not implement `explainStep()` itself (backend-task-13) here — this task only produces the Gemini-calling wrapper and the shared payload builder.
