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
- [ ] `SOURCE/app/(layer2)/tutorActions.ts` (new — `explainStep()`)
- [ ] `SOURCE/lib/security/rateLimit.ts` (additive — `RATE_LIMITS.explainStep`)
- [ ] `SOURCE/app/(layer2)/__tests__/tutorActions.int.test.ts` (fill in the existing skeleton's 4 tests)

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
- [ ] Read all Investigation Targets, in particular the skeleton's terminology note (this file mocks Supabase + `generateHint()`, unlike backend-task-10's real-DB file) and all 4 tests' annotations.
- [ ] Convert the 4 skeleton tests into real vitest tests against a mocked Supabase client and mocked `generateHint()`.
- [ ] Run the tests and confirm all 4 fail (no `explainStep()` implementation exists yet).

### 2. Green Phase
- [ ] Add `RATE_LIMITS.explainStep` to `rateLimit.ts`, matching the existing member shape (`{limit, windowMs}`).
- [ ] Implement `explainStep(attemptId: string, questionId: string)`: inherited-session auth → RLS-scoped ownership check on the attempt → `guard("explainStep", userId)` (must run before any Gemini-facing call) → server-side re-verification via `computeWrongTwiceQuestionIds()` against the questionId (must run before `generateHint()`, independent of any client-supplied eligibility claim) → safe-column question fetch (plain authenticated client only) → `buildTutorPrompt()` + `generateHint()` → best-effort telemetry write (`event_type='tutor_invoke'`, via backend-task-12's shared payload builder).
- [ ] Set/confirm `export const maxDuration` on this route segment, checked against `TUTOR_CALL_DEADLINE_MS`.
- [ ] Run `npx vitest run app/\(layer2\)/__tests__/tutorActions.int.test.ts` — confirm all 4 pass.

### 3. Refactor Phase
- [ ] Confirm the exact call order (`guard()` before `computeWrongTwiceQuestionIds()` before `generateHint()`, or whichever order the tests actually require — re-verify Test 1's "0 calls to `generateHint()`" and Test 4's "0 calls to `generateHint()`, rejects before Gemini" both hold simultaneously).

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
- [ ] `explainStep()` implemented; `RATE_LIMITS.explainStep` added; `maxDuration` set/confirmed against `TUTOR_CALL_DEADLINE_MS`
- [ ] All 4 `tutorActions.int.test.ts` tests pass
- [ ] Each Proof Obligation is met

## Notes
- Impact scope: `SOURCE/app/(layer2)/tutorActions.ts` (new), `SOURCE/lib/security/rateLimit.ts` (additive member only).
- Scope boundary: do not modify `submitExam()`'s own `guard("submitExam", ...)` call or any other existing `RATE_LIMITS` member; do not implement `useTutorAction.ts`/`ExplainStepAffordance.tsx` here (frontend-task-01).
