# Task 13 (Backend): `explainStep()` Server Action (Work Plan Phase 3, Task 13)

Metadata:
- Dependencies: backend-task-09 (`computeWrongTwiceQuestionIds()` — the actual security gate), backend-task-12 (`generateHint()`, telemetry payload builder)
- Provides: `explainStep()`, consumed by frontend-task-01 (`useTutorAction`/`ExplainStepAffordance`)
- Size: Medium (3 files: `tutorActions.ts`, `rateLimit.ts` extension, `tutorActions.int.test.ts`)

## Implementation Content

Implement `SOURCE/app/(layer2)/tutorActions.ts` — auth (inherited session), ownership check (RLS-scoped attempt read), **server-side re-verification of wrong-twice eligibility via `computeWrongTwiceQuestionIds()`** (backend-task-09 — the actual security gate, independent of client state), `guard("explainStep", userId)` rate limiting (add `RATE_LIMITS.explainStep` to `SOURCE/lib/security/rateLimit.ts`), safe-column question fetch (the plain authenticated client, never `claim_attempt_answer_key`/`exam_answer_key`), `buildTutorPrompt()` + `generateHint()` call, best-effort telemetry write (`event_type='tutor_invoke'`).

Confirm or explicitly set `export const maxDuration` on this Server Action's route segment against `TUTOR_CALL_DEADLINE_MS` (resolves the flagged, unverified Vercel Hobby-plan Assumed Behavior).

Convert `tutorActions.int.test.ts`'s 4 already-generated tests into real vitest tests against a mocked Supabase client + mocked `generateHint()`:
- Test 1 (AC-021, server-side re-verification is the real gate — 0 calls to `generateHint()` for an ineligible `questionId`)
- Test 2 (AC-012/013, telemetry fires with the right queryable shape on both success and failure)
- Test 3 (AC-029, untagged question still functions)
- Test 4 (AC-022, rate-limit rejects before any Gemini call)

## Target Files
- [x] `SOURCE/app/(layer2)/tutorActions.ts` (new — `explainStep()`)
- [x] `SOURCE/lib/security/rateLimit.ts` (additive — `RATE_LIMITS.explainStep`)
- [x] `SOURCE/app/(layer2)/__tests__/tutorActions.int.test.ts` (fill in the existing skeleton's 4 tests)

## Investigation Targets
- `SOURCE/app/(layer2)/__tests__/tutorActions.int.test.ts` (already generated — read in full: the BUDGET NOTE and IMPORTANT terminology note distinguishing this mocked-boundary file from `recordSkillMastery.int.test.ts`'s real-DB lane, all 4 tests' exact annotations)
- `SOURCE/lib/scoring/wrongTwice.ts` (backend-task-09 — `computeWrongTwiceQuestionIds()`, real, in-process, not mocked in this test file)
- `SOURCE/lib/tutor/callTutor.ts`, `SOURCE/lib/tutor/prompt.ts` (backend-task-12/11 — `generateHint()` mocked in this test file; `buildTutorPrompt()` real)
- `SOURCE/lib/security/rateLimit.ts` (existing `RATE_LIMITS` shape, `guard()` signature at line ~131 — add `explainStep` as a new member matching the existing member shape)
- `SOURCE/app/(layer2)/actions.ts` (`submitExam()`'s own `guard("submitExam", ...)` call, line ~74 — the exact rate-limit invocation pattern to mirror)
- `docs/design/engine1-adaptive-ai-backend-design.md` (§ `app/(layer2)/tutorActions.ts` — `explainStep()` Server Action; § `lib/security/rateLimit.ts` — `RATE_LIMITS.explainStep`; § Assumed Behaviors (unconfirmed) — Vercel Hobby-plan function duration vs. `TUTOR_CALL_DEADLINE_MS=30s`; § Security Considerations)

## Boundary Context (Connection Map)

**Boundary**: `ExplainStepAffordance`/`useTutorAction` (client, browser) → `explainStep()` (Next.js Server Action). This task owns the **right-side / server** owner (`SOURCE/app/(layer2)/tutorActions.ts`) — the left-side client caller (`SOURCE/components/tutor/useTutorAction.ts`) is frontend-task-01.

- **Serialized Format**: — (no encoding boundary; the Server Action call uses the shared TS function signature).
- **Consumer Parse Rule**: `explainStep()`'s own typed-result branch (`"hint" in result`).
- **Expected Signal**: response matches `{hint: string} | {error: "not_eligible"|"rate_limited"|"gemini_unavailable"|"server"}`; `explainStep` is called with the exact `(attemptId, questionId)` order — this task defines the parameter order the function expects; frontend-task-01 proves the caller matches it (the actual risk here is call-site argument order, not encoding — no roundtrip parse check applies).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets, in particular the skeleton's terminology note (this file mocks Supabase + `generateHint()`, unlike backend-task-10's real-DB file) and all 4 tests' annotations.
- [x] Convert the 4 skeleton tests into real vitest tests against a mocked Supabase client and mocked `generateHint()`.
- [x] Run the tests and confirm all 4 fail (no `explainStep()` implementation exists yet).

### 2. Green Phase
- [x] Add `RATE_LIMITS.explainStep` to `rateLimit.ts`, matching the existing member shape (`{limit, windowMs}`).
- [x] Implement `explainStep(attemptId: string, questionId: string)`: inherited-session auth → RLS-scoped ownership check on the attempt → `guard("explainStep", userId)` (must run before any Gemini-facing call) → server-side re-verification via `computeWrongTwiceQuestionIds()` against the questionId (must run before `generateHint()`, independent of any client-supplied eligibility claim) → safe-column question fetch (plain authenticated client only) → `buildTutorPrompt()` + `generateHint()` → best-effort telemetry write (`event_type='tutor_invoke'`, via backend-task-12's shared payload builder).
- [x] Set/confirm `export const maxDuration` on this route segment, checked against `TUTOR_CALL_DEADLINE_MS`.
- [x] Run `npx vitest run app/\(layer2\)/__tests__/tutorActions.int.test.ts` — confirm all 4 pass.

### 3. Refactor Phase
- [x] Confirm the exact call order (`guard()` before `computeWrongTwiceQuestionIds()` before `generateHint()`, or whichever order the tests actually require — re-verify Test 1's "0 calls to `generateHint()`" and Test 4's "0 calls to `generateHint()`, rejects before Gemini" both hold simultaneously).

## Quality Assurance Mechanisms
- ESLint / `tsc --noEmit` / `next build` — project-wide
- `vitest run` — Covered: `app/(layer2)/__tests__/`
- `check-ai-key-bundle.mjs` — Covered: `.next` build output (this Server Action indirectly triggers `GEMINI_API_KEY` usage via `generateHint()`)

## Operation Verification Methods
- **Verification method**: run `npx vitest run app/\(layer2\)/__tests__/tutorActions.int.test.ts` against the mocked Supabase + `generateHint()` boundary.
- **Success criteria**: `explainStep()`'s server-side re-verification is proven to be the actual eligibility gate, independent of client-supplied state; rate limiting proven to block before any Gemini call fires (Phase 3 Completion Criteria).
- **Failure response**: if Test 1 shows `generateHint()` was called for an ineligible questionId, treat as a critical security defect (the exact abuse case UI Spec D1's security note flags) — do not proceed to frontend-task-01 until fixed.
- **Verification level**: L2 (new tests added and passing); the real end-to-end round trip (L1) is proven later by the manual Phase 5 Playwright pass, per the Verification Strategy's Second Verification Target.

## Proof Obligations
(Sourced verbatim from `tutorActions.int.test.ts`'s own annotations.)
- **Claim**: Test 1 — server-side wrong-twice re-verification is the real eligibility gate; for a questionId NOT in the server-recomputed set, `explainStep()` resolves `{error: "not_eligible"}` WITHOUT ever invoking `generateHint()`/`callTutor.ts` (AC-021).
- **Primary failure mode**: `explainStep()` trusts a client-supplied eligibility signal or skips server-side recomputation entirely for latency reasons, letting a forged/stale `questionId` reach `generateHint()`/Gemini.
- **Boundary to exercise**: integration, mocked Supabase client + mocked `generateHint()`; `computeWrongTwiceQuestionIds()` real, in-process.
- **State assertion**: N/A (no persisted state changes on the rejection path).
- **Mock boundary rationale**: Supabase client and `generateHint()`/`callTutor.ts` mocked per this project's sanctioned precedent and this feature's own Mock Boundary Decisions; `computeWrongTwiceQuestionIds()` runs for real to prove `explainStep()` actually calls it with the right fixture data.
- **Residual**: none.
- **Claim**: Test 2 — telemetry insert fires with a queryable, containment-safe shape on both success and failure outcomes (AC-012/013).
- **Primary failure mode**: the telemetry insert is skipped entirely on the FAILURE path, making "how many tutor calls failed" permanently unanswerable in production.
- **Boundary to exercise**: integration, mocked Supabase client + mocked `generateHint()`.
- **State assertion**: N/A (mocked insert-call-shape assertion, not a real DB read-back).
- **Mock boundary rationale**: same as Test 1.
- **Residual**: complements backend-task-12's own unit-level containment proof; this test proves the call-site actually fires on both outcomes.
- **Claim**: Test 3 — a wrong-twice-eligible question with `skill_node_id: null` still functions (AC-029).
- **Primary failure mode**: a future maintainer adds a "`skill_node_id IS NOT NULL`" precondition, silently breaking the tutor for the unclassified-content subset of the corpus.
- **Boundary to exercise**: integration, mocked Supabase client + mocked `generateHint()`.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1.
- **Residual**: none.
- **Claim**: Test 4 — rate limiting rejects before any Gemini call fires (AC-022; Failure Mode Checklist `unavailable boundary`).
- **Primary failure mode**: a rate-limit rejection is miscoded as a generic `"server"` error instead of `"rate_limited"`; or the rate-limit check runs AFTER the Gemini call instead of before it, defeating its purpose as a cost guard.
- **Boundary to exercise**: integration, mocked Supabase client + mocked `generateHint()` + mocked `guard()`.
- **State assertion**: N/A.
- **Mock boundary rationale**: same as Test 1, plus `guard()` mocked to simulate rate-limit-exceeded.
- **Residual**: none.
- **Claim** (Failure Mode Checklist `unavailable boundary`) — Gemini 503/429/timeout maps to typed `gemini_unavailable`/`server` error (AC-021); the Vercel Hobby-plan function-duration limit vs. `TUTOR_CALL_DEADLINE_MS` is an unverified Assumed Behavior this task must resolve.
- **Primary failure mode**: the Gemini failure-mode mapping is incomplete (e.g. a timeout silently mapped to `"server"` when it should be `"gemini_unavailable"`, or vice versa per the DD's own mapping table); OR `maxDuration` is left unset/misconfigured and the platform kills the function before `TUTOR_CALL_DEADLINE_MS` elapses, producing an unhandled/opaque failure instead of the typed error path.
- **Boundary to exercise**: integration (mocked `generateHint()` rejection scenarios) for the error-mapping half; code inspection/manual confirmation for the `maxDuration` half (not unit-testable — Vercel's actual runtime behavior cannot be exercised in vitest).
- **State assertion**: N/A.
- **Mock boundary rationale**: `generateHint()` mocked to simulate each failure class.
- **Residual**: the `maxDuration` setting's actual effectiveness against Vercel's real Hobby-plan limits is not provable until Phase 5's real deployment/manual pass — this task only ensures the setting is explicitly present and reasoned about, not silently left to platform defaults.

## Completion Criteria
- [x] `explainStep()` implemented; `RATE_LIMITS.explainStep` added; `maxDuration` set/confirmed against `TUTOR_CALL_DEADLINE_MS`
- [x] All 4 `tutorActions.int.test.ts` tests pass
- [x] Each Proof Obligation is met

## Investigation Notes (recorded during execution)

**Interfaces read (exact signatures the implementation binds to)**
- `computeWrongTwiceQuestionIds(attempts: WrongTwiceAttempt[]): Set<string>` where `WrongTwiceAttempt = {attemptId, perQuestion: PerQuestionResult[]}` (`lib/scoring/wrongTwice.ts`) — pure, never throws, counts a questionId wrong on ≥2 *distinct* attemptIds, skips `scored === false`. Reused verbatim by `explainStep()`; no re-derivation.
- `generateHint(input: TutorPromptInput): Promise<string>` + `class TutorCallError { code: "gemini_unavailable" | "server" }` (`lib/tutor/callTutor.ts`). `generateHint()` calls `buildTutorPrompt()` itself (line 99) → `explainStep()` builds only the `TutorPromptInput` and must NOT call `buildTutorPrompt()` a second time.
- `buildTelemetryPayload(event: TelemetryEvent): TelemetryLogInsert` (`lib/tutor/telemetry.ts`) — the only permitted way to shape the `telemetry_log` insert.
- `guard(action: keyof typeof RATE_LIMITS, userId: string): Promise<RateLimitResult>` (`lib/security/rateLimit.ts:132`); `RATE_LIMITS` is a closed `as const` object of `{limit, windowMs}` — `explainStep` added as a 6th member (the closed type is itself the tsc-level proof the member exists).
- `submitExam()`'s pattern (`app/(layer2)/actions.ts:74`): the rate-limit key comes from the RLS-filtered attempt row already read, not a second `auth.getUser()` round trip. Mirrored here.
- `rateExam()` (`actions.ts:177-229`): typed-result convention (`return {error: "..."}`, never throw/redirect, never leak `error.details`/`hint` into logs). Mirrored here.

**Control/data flow chosen (side effects marked)**
`createClient()` → read `exam_attempts(user_id)` RLS-scoped [I/O] → `guard("explainStep", userId)` [I/O, Redis] → read `exam_results(attempt_id, per_question)` unscoped-but-RLS-filtered [I/O] → `computeWrongTwiceQuestionIds()` [pure] → read `questions(content, question_type, choices)` safe columns only [I/O] → `generateHint()` [I/O, Gemini] → `telemetry_log` insert [I/O, best-effort, never alters the return value].

**Declared deviations and their accepted trade-offs**

1. *Gate order vs. the DD's numbered Validation list* (which places `guard()` third, after re-verification): the task file's Green Phase orders `guard()` *before* re-verification, and that is what is implemented. Both orders satisfy every DD invariant (`guard()` before any Gemini-facing call; re-verification before `generateHint()`); guard-first is the stricter cost guard — a rate-limited caller costs one attempt read instead of a full cross-attempt history scan.
   - **Accepted cost of guard-first**: the quota is consumed by *every* invocation, including ones later rejected for non-Gemini reasons. Concretely, during a transient `exam_results` outage a user retrying the affordance burns all 20 hourly attempts on calls that never reach Gemini, and stays locked out for the remainder of the window after the DB recovers. Judged acceptable for a Sprint-1 affordance: the alternative (charge quota only for calls that reach the model) means doing the full history scan before the cost guard, which is exactly the loop an automated caller would exploit. Revisit if support reports "tutor says try again later" after an incident.
2. *Telemetry is skipped on the two no-userId early exits* (attempt row missing/not owned, and attempt read failed) — a deliberate narrowing of the DD invariant "Every invocation (success or failure) attempts a best-effort `telemetry_log` insert". Reason: §19's `telemetry_insert_own` is `with check (user_id = auth.uid())`, so a NULL-`user_id` row is rejected outright for the `authenticated` role — the insert would not produce an unattributed row, it would produce no row plus a warning. Neither path is a tutor invocation in the AC-012 sense ("how many tutor calls happened, for whom"). Every path that *does* have a userId — including `rate_limited` and `not_eligible` — writes its row, which is why §19's `error_code` CHECK enumerates those two codes at all.

**Carried-forward items resolved**
1. *`TelemetryEvent.userId` null vs. §19 `with check (user_id = auth.uid())`*: `explainStep()` never passes `null`. The userId is read from the RLS-filtered `exam_attempts` row, so it is by construction `auth.uid()`, and the insert always satisfies the policy. The only path with no userId (attempt missing/not owned, or the attempt read itself failing) writes no telemetry at all — an insert there would be rejected by the policy and the row lost anyway, and that path is not a tutor invocation. Recorded in the code comment at the telemetry helper.
2. *Re-verification history read must not degrade to empty*: `getResult()`'s private `fetchWrongTwiceAttempts()` (`queries.ts:329`) returns `[]` on error deliberately (display enrichment). `explainStep()` deliberately does NOT reuse it (it is also not exported): here the same read is a security boundary, so a failed read returns the typed `"server"` error instead of an empty history that would be indistinguishable from `"not_eligible"`. Only the *aggregation* is shared (`computeWrongTwiceQuestionIds`), which is what the overview's single-source-of-truth rule covers.
3. *`TUTOR_CALL_DEADLINE_MS` (30s) vs. platform function duration* — **resolved by confirmed platform default, not by an export.** Two facts, both verified during this task: (a) Next.js 16.3.0's bundled docs (`node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/02-route-segment-config/maxDuration.md`) state `maxDuration` is a route-segment export (`layout.tsx | page.tsx | route.ts`) and that for Server Actions it must be set *at the page level* — a `"use server"` module is not a route segment and may only export async functions, so no export in `tutorActions.ts` could ever take effect. The page in question (`.../result/detail/page.tsx`) is frontend-task-01's file and outside this task's Target Files, so it was not edited. (b) Vercel's own duration documentation (`https://vercel.com/docs/functions/configuring-functions/duration`, fetched 2026-08-14, page last updated 2026-07-01) states that with fluid compute (**enabled by default**) the **default** duration is **300s on Hobby, Pro and Enterprise alike** (Hobby max also 300s). 30s therefore sits inside the platform default with a 10× margin, and `SOURCE/vercel.json` contains no `functions.maxDuration` override that could lower it. Residual (matching this task's own Proof Obligation): the dashboard-level "Default Max Duration" project setting is not readable from the repository — if it is ever lowered below 30s, or fluid compute is disabled, the page segment must export `maxDuration >= 30`. Recorded verbatim in `tutorActions.ts`'s header comment so the next maintainer of that page sees it.

**Mutation (non-vacuity) evidence** — see the task report; every test was proven to fail against a deliberately broken, compile-clean implementation before being accepted. Twelve mutations in total: six from the first round (drop the wrong-twice recomputation; skip telemetry on the failure path; require a non-null `skill_node_id`; miscode `rate_limited` as `server`; degrade the history read to `[]`; move `guard()` after `generateHint()`), and six added after the integration-test review found the answer-key containment claim was proven only on the telemetry path (`studentAnswer` sourced from `PerQuestionResult.correct`; the answer key appended to `questionContent`; the question select widened to `"*"`; the per-attempt half of the eligibility gate deleted; the attempt read's `.eq("id", attemptId)` dropped; the question read filtered by `attemptId` instead of `questionId`).

## Notes
- Impact scope: `SOURCE/app/(layer2)/tutorActions.ts` (new), `SOURCE/lib/security/rateLimit.ts` (additive member only).
- Scope boundary: do not modify `submitExam()`'s own `guard("submitExam", ...)` call or any other existing `RATE_LIMITS` member; do not implement `useTutorAction.ts`/`ExplainStepAffordance.tsx` here (frontend-task-01).
