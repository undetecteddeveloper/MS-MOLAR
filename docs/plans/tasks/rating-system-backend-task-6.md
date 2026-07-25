# Task 6 (Backend): Backend write path (rateExam, getMyRating)

Metadata:
- Dependencies: `rating-system-backend-task-1.md` (RLS policies), `rating-system-backend-task-3.md` (`isValidPartScore`); resolve using the `vitest.config.ts` decision recorded by `rating-system-backend-task-4.md`
- Provides: `rateExam`/`getMyRating`, consumed by `rating-system-frontend-task-7.md` (`submitRating` adapter) and `rating-system-frontend-task-8.md` (result-page prefill)
- Size: Medium (2 files: `SOURCE/app/(layer2)/actions.ts`, `SOURCE/app/(layer2)/__tests__/rating.int.test.ts`)

## Implementation Content
`rateExam(examId, scores)` — validates via `isValidPartScore`, early eligibility precheck (UX; RLS remains authoritative), `.upsert(..., {onConflict:'exam_id,user_id'})`, maps DB errors to `{error:"server"}` without leaking, logs `console.error("[rateExam]", ...)`. `getMyRating(examId)` — reads the caller's own row via `ratings_select_own` RLS, returns `{partI,partII,partIII}|null`, throws on infra error. Both added beside `SOURCE/app/(layer2)/actions.ts`. Convert integration Test 1 (`rating.int.test.ts`) into a real vitest test against a mocked Supabase client boundary.

## Target Files
- [x] `SOURCE/app/(layer2)/actions.ts` (add `rateExam`, `getMyRating`)
- [x] `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (convert Test 1 only)

## Investigation Targets
- `SOURCE/app/(layer2)/actions.ts:101-104` (`submitExam` upsert idiom — pattern `rateExam` reuses)
- `SOURCE/app/(layer2)/actions.ts:50` vs `:127` (the two `submitExam` redirects — read-only awareness; Task 8 owns the `?rate=auto` edit at `:127`, this task must not touch either)
- `SOURCE/app/(layer4)/actions.ts:960-987` (`reportExam` — non-leaking `{ error? }` return-shape precedent)
- `SOURCE/app/(layer4)/actions.ts:62-69` (`requireUser` — auth-gate pattern, adapted here to a status object rather than redirect)
- `docs/design/rating-system-backend-design.md` (§ Data Contracts — `rateExam`, `getMyRating`)
- `docs/design/rating-system-backend-design.md` (§ Error Handling)
- `docs/design/rating-system-backend-design.md` (§ Logging and Monitoring)
- `docs/design/rating-system-backend-design.md` (§ Security Considerations)
- `docs/design/rating-system-backend-design.md` (§ Field Propagation Map — write side `scores.partI/II/III`)
- `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (Test 1 skeleton block)
- `SOURCE/app/(layer2)/_components/rating/submitRating.ts` (other side of the write boundary — created by Task 7; contract is defined by this task, consumed there)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0008-exam-difficulty-rating-and-on-read-aggregation.md (§ Decision) | dependency_direction | Rating-write eligibility enforced in BOTH layers: RLS is authoritative; the server-action check is UX ergonomics over the DB invariant, not the gate | `rateExam`'s eligibility precheck returns `{error:'ineligible'}` defensively but never bypasses or replaces the RLS with-check as the actual gate (a bypass of the precheck still cannot persist via RLS) |

## Investigation Notes
(Record the Compliance Check evidence — e.g., confirmation that the precheck is UX-only and RLS is unconditionally re-verified — here before marking complete.)

**Investigation Targets read:**
- `actions.ts:101-104` (`submitExam` upsert): `.upsert(answerRows, { onConflict: "attempt_id,question_id" })` — idiom `rateExam` reuses with `onConflict: "exam_id,user_id"`.
- `actions.ts:50`/`:127` (`submitExam` redirects): read-only, untouched — both remain exactly as-is; Task 8 owns `:127`.
- `(layer4)/actions.ts:960-987` (`reportExam`): `requireUser()` gate, `{ error? }` return shape, `error.code === "23505"` PG mapping, `console.error("[reportExam]", error.code, error.message)` then `{ error: "server" }` — no raw message/code returned to caller. `rateExam` mirrors the return-shape/logging idiom but does NOT reuse `requireUser()` verbatim (that redirects); the not-authed case naturally falls into the eligibility precheck instead (see below), matching the backend DD Error Handling table row "Business (eligibility) | no submitted attempt / not authed ... -> { error: 'ineligible' }".
- `(layer4)/actions.ts:62-69` (`requireUser`): `supabase.auth.getUser()` + `redirect(...)` if absent. Not reused directly (status-object requirement); `getMyRating`/`rateExam` rely on RLS session-scoping (`ratings_select_own`/`attempts_select_own`) instead of an explicit `auth.getUser()` call, consistent with `hasReported`/`listMySubmittedExamIds` precedent (no explicit user id passed — RLS scopes to `auth.uid()` implicitly).
- Backend DD §Data Contracts `rateExam`/`getMyRating` (lines 581-611): exact contract signatures, validation order (isValidPartScore before any DB call, per skeleton line 59), eligibility precheck via "exists submitted attempt", upsert shape, non-leaking mapping; `getMyRating` throws on infra error (Server Component boundary, consistent with `getExam`/`getResult`).
- Backend DD §Error Handling (lines 687-696) and §Logging (698-701): `console.error("[rateExam]", error.code, error.message)` on DB error only; no success-path logging; fail-fast (reads throw, no silent fallback).
- Backend DD §Security Considerations (725-729): RLS is the authoritative gate; action precheck is UX ergonomics only; `user_id` always `auth.uid()`-defaulted, never taken from input — so the upsert payload must NOT include `user_id`.
- Backend DD §Field Propagation Map (653): `scores.partI/II/III` -> validated by `isValidPartScore` -> written to `score_part1..3`.
- `rating.int.test.ts` Test 1 skeleton (lines 48-83): proof obligations (a)(b)(c) — converted below.
- `SOURCE/app/(layer2)/_components/rating/submitRating.ts`: does not exist yet (created by Task 7); confirms this task only defines the server contract, no client adapter here.
- `schema.sql:471-540`: `exam_difficulty_ratings` columns (`exam_id text`, `user_id uuid default auth.uid()`, `score_part1/2/3 int`), `unique(exam_id, user_id)`; `ratings_insert_own`/`ratings_update_own` with-check AND `user_id=auth.uid()` + published EXISTS + submitted-attempt EXISTS; `ratings_select_own` scoped to own row. `exam_attempts` has `attempts_select_own` (own-row RLS), matching the no-explicit-user-id-filter precedent already used by `listMySubmittedExamIds` in `queries.ts:179-187`.

**Binding Decision Compliance Check evaluation:**
- Axis `dependency_direction` (ADR-0008 § Decision): planned approach — `rateExam` validates scores first (no DB call for invalid input), then runs an eligibility precheck (`exam_attempts` count where `status='submitted'` for the given `examId`, scoped implicitly to the caller by `attempts_select_own` RLS) and returns `{error:'ineligible'}` defensively if absent, then performs the upsert whose row omits `user_id` (DB-defaulted to `auth.uid()`) so the RLS with-check (`user_id=auth.uid()` AND published EXISTS AND submitted-attempt EXISTS) re-verifies independently and unconditionally on every write — a bypass of the action's precheck (e.g., a direct Supabase-client call) still cannot persist because the RLS with-check runs regardless of what the action layer decided. Evaluation: **Y** — the precheck never replaces or short-circuits the RLS check; it is a separate, non-authoritative, defensive read solely for UX messaging.

**Final implementation + live-DB confirmation:**
- Implemented `rateExam`/`getMyRating` in `SOURCE/app/(layer2)/actions.ts`; converted `rating.int.test.ts` Test 1 into 4 real `it` blocks for `rateExam` (obligations a/b/c + an added ineligible-precheck regression test) and 3 for `getMyRating` (row/null/throw) — all mocked at the Supabase client boundary per backend DD Test Boundaries. `npx vitest run` on the file: 16/16 passed.
- Re-ran `cd SOURCE && npx tsx supabase/test-rls.ts` (Task 2's harness, service_role key from `.env.local` — Supabase MCP was disconnected this session so this Node script stood in for a live-DB check) — all cases passed including `R-p…R-u` (insert-eligible succeeds; R-q no-submitted-attempt blocked at RLS; R-r upsert re-rate keeps 1 row with newest scores; R-s unpublished blocked; R-t raw duplicate insert blocked by unique constraint; R-u cross-user select-own isolation). This confirms the RLS with-check this task's precheck defers to is live and unconditional — the mocked unit test proves the JS call construction (obligation evaluation above), and this run proves the real DB gate independently accepts/rejects the same shapes `rateExam` produces.
- **Coverage split for Task 9 QA gate**: covered here — RLS harness (R-p..R-u, live DB) + this task's mocked unit tests (validation order, upsert call shape, non-leaking error mapping, ineligible precheck). NOT covered here (remains for Task 9 / later tasks): an actual authenticated `rateExam()` call through a real Next.js server-action boundary (this task only proves the mocked-client JS path + the separate RLS harness, not the two wired end-to-end); the frontend `submitRating` adapter consuming `rateExam`'s error union (Task 7); the `getMyRating` prefill wired into the rate page/modal (Task 7/8); no Supabase MCP-based live query was run in this session (harness script used instead — functionally equivalent, direct DB access via service_role key).
- Binding Decision `dependency_direction` compliance re-evaluated against the final code: **Y** — `rateExam`'s precheck (lines calling `exam_attempts`) only gates the return value with `{error:'ineligible'}`; the upsert call is unconditional on RLS's own AND-clauses (verified live via R-p/R-q/R-s above), and the action never sets `user_id` from input.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Review dependency deliverables: Task 1's RLS policies; Task 3's `isValidPartScore`; the `vitest.config.ts` resolution recorded by Task 4
- [x] Convert Test 1's skeleton comments into real `describe`/`it` blocks against a mocked Supabase client boundary; write a `getMyRating` test alongside it (not explicitly in the skeleton — see Proof Obligations); run and confirm failure

### 2. Green Phase
- [x] Add the minimal `rateExam`/`getMyRating` implementation to pass tests
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Improve code (maintain passing tests) — confirm the error-mapping mirrors `reportExam`'s non-leaking pattern exactly
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: project root

## Operation Verification Methods
- **Verification method**: convert integration Test 1 (`rating.int.test.ts`) into a real vitest test against a mocked Supabase client boundary (`createClient()`), asserting validation-before-write ordering, exact upsert call shape, and non-leaking error mapping.
- **Success criteria**: all Test 1 assertions (plus the added `getMyRating` assertion) pass; the returned `{error?}` object never contains extra keys or leaked Supabase error content.
- **Failure response**: a leaking or malformed error response is a security/UX defect — fix before Task 7 wires the client adapter against this contract.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
(Source: skeleton `rating.int.test.ts` Test 1 proof obligations (a)-(c), plus one added for `getMyRating` (not covered by the skeleton, derived from AC-013), plus Failure Mode Checklist entries `same-value`, `invalid option`, `unavailable boundary` mapped to this task.)
- **Claim** (invalid option): a call with any part score non-integer or outside `[1,10]` resolves to `{error:"invalid"}`, and the mocked client's upsert is never invoked (AC-002).
  - **Primary failure mode**: an out-of-range or non-integer part score reaches the upsert call.
  - **Boundary to exercise**: integration — mocked Supabase client boundary (sanctioned mock per backend DD Test Boundaries).
  - **State assertion**: N/A (no write attempted).
  - **Mock boundary rationale**: the Supabase client is mocked; `rateExam`'s own validation and control flow run for real.
  - **Residual**: the real DB CHECK-constraint backstop (belt-and-suspenders) is proven only by Task 2's RLS suite, not this unit test.
- **Claim** (same-value): a call with three valid scores invokes `upsert(..., { onConflict: "exam_id,user_id" })` exactly once, with `score_part1/2/3` mapped from `partI/partII/partIII` — the re-rate idempotency guarantee (AC-012).
  - **Primary failure mode**: a re-rate issues a bare INSERT instead of an upsert keyed on `(exam_id, user_id)`.
  - **Boundary to exercise**: integration — mocked Supabase client boundary.
  - **State assertion**: before (mock has no prior recorded call) → action (`rateExam(examId, validScores)`) → after (upsert mock called exactly once with the mapped columns and `onConflict` key).
  - **Mock boundary rationale**: same.
  - **Residual**: the real upsert-vs-RLS interaction (insert-own vs. update-own path) is proven by Task 2's R-r case, not this mocked unit test.
- **Claim** (unavailable boundary): a simulated Supabase error on upsert resolves to exactly `{error:"server"}` — no leaked message/code (AC-025 non-leaking mapping).
  - **Primary failure mode**: a simulated DB error leaks raw Supabase error detail to the caller instead of the mapped `{ error: "server" }`.
  - **Boundary to exercise**: integration — mocked Supabase client boundary (simulated error).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: same.
  - **Residual**: none.
- **Claim**: `getMyRating(examId)` returns the caller's own three stored scores, or `null` if none, reading only via `ratings_select_own` RLS (AC-013 — not covered by the skeleton, derived from the AC).
  - **Primary failure mode**: `getMyRating` returns another user's row, throws instead of returning `null` when no rating exists, or silently swallows an infra error instead of throwing.
  - **Boundary to exercise**: integration — mocked Supabase client boundary.
  - **State assertion**: before (mock returns a row or `null`) → action (`getMyRating(examId)`) → after (`{partI,partII,partIII}` or `null` returned accordingly).
  - **Mock boundary rationale**: Supabase client mocked (query boundary), consistent with `rateExam`'s mock boundary.
  - **Residual**: real select-own RLS confinement (cross-user isolation) is proven by Task 2's R-u case, not this mocked unit test.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] Phase 2 completion (shared with Task 7): `rateExam`/`getMyRating` contracts match the backend DD exactly (status object, never redirect; non-leaking error mapping)

## Notes
- Impact scope: `SOURCE/app/(layer2)/actions.ts` (additions only) and the Test 1 block of `rating.int.test.ts`.
- Scope boundary: do not touch the `submitExam` redirects at `:50`/`:127` — that edit belongs to Task 8. Do not add any UI/component code here.
