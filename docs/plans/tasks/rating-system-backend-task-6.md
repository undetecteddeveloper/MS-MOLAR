# Task 6 (Backend): Backend write path (rateExam, getMyRating)

Metadata:
- Dependencies: `rating-system-backend-task-1.md` (RLS policies), `rating-system-backend-task-3.md` (`isValidPartScore`); resolve using the `vitest.config.ts` decision recorded by `rating-system-backend-task-4.md`
- Provides: `rateExam`/`getMyRating`, consumed by `rating-system-frontend-task-7.md` (`submitRating` adapter) and `rating-system-frontend-task-8.md` (result-page prefill)
- Size: Medium (2 files: `SOURCE/app/(layer2)/actions.ts`, `SOURCE/app/(layer2)/__tests__/rating.int.test.ts`)

## Implementation Content
`rateExam(examId, scores)` — validates via `isValidPartScore`, early eligibility precheck (UX; RLS remains authoritative), `.upsert(..., {onConflict:'exam_id,user_id'})`, maps DB errors to `{error:"server"}` without leaking, logs `console.error("[rateExam]", ...)`. `getMyRating(examId)` — reads the caller's own row via `ratings_select_own` RLS, returns `{partI,partII,partIII}|null`, throws on infra error. Both added beside `SOURCE/app/(layer2)/actions.ts`. Convert integration Test 1 (`rating.int.test.ts`) into a real vitest test against a mocked Supabase client boundary.

## Target Files
- [ ] `SOURCE/app/(layer2)/actions.ts` (add `rateExam`, `getMyRating`)
- [ ] `SOURCE/app/(layer2)/__tests__/rating.int.test.ts` (convert Test 1 only)

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

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Review dependency deliverables: Task 1's RLS policies; Task 3's `isValidPartScore`; the `vitest.config.ts` resolution recorded by Task 4
- [ ] Convert Test 1's skeleton comments into real `describe`/`it` blocks against a mocked Supabase client boundary; write a `getMyRating` test alongside it (not explicitly in the skeleton — see Proof Obligations); run and confirm failure

### 2. Green Phase
- [ ] Add the minimal `rateExam`/`getMyRating` implementation to pass tests
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests) — confirm the error-mapping mirrors `reportExam`'s non-leaking pattern exactly
- [ ] Confirm added tests still pass

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
- [ ] All added tests pass
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Phase 2 completion (shared with Task 7): `rateExam`/`getMyRating` contracts match the backend DD exactly (status object, never redirect; non-leaking error mapping)

## Notes
- Impact scope: `SOURCE/app/(layer2)/actions.ts` (additions only) and the Test 1 block of `rating.int.test.ts`.
- Scope boundary: do not touch the `submitExam` redirects at `:50`/`:127` — that edit belongs to Task 8. Do not add any UI/component code here.
