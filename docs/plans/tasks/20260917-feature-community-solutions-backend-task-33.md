# Task 33: `actions.ts` — `reportSolution`, `reportComment`

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P4-T2
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T2)
- **Dependencies**: task 02 (P1-T2), task 32 (P4-T1)
- **Provides**: report Server Actions consumed by tasks 36 and 37
- **Size**: Small (1 plan file + 1 test file; `SOURCE/lib/copy.ts` only if a returned key is missing)

## U1 is resolved (no gate on this task)

A report is **not** a plain-RLS insert. Backend DD v1.2 removed `community_reports_insert_own`: `community_content_reports` has RLS on, every privilege revoked, **no policy and no grant**, and the only write path is the `SECURITY DEFINER` pair `report_community_solution` / `report_community_comment` (task 32's migration). A direct PostgREST insert on the table is an authorization denial — task 35 asserts that as a table-closure case in both report groups.

Consequence for this task: **no `23505` path exists.** A repeat report is a *success* the RPC reports itself, as `already_reported = true`; the duplicate never surfaces as an error code to this layer.

## Implementation Content

- `reportSolution(solutionId, reason)` — `requireUser()` → `guard("communitySolutionReport")` → reason validation **before any RPC** → `.rpc("report_community_solution", { p_solution_id, p_reason })` → `{ ok: true, alreadyReported }`, copied as-is from the RPC's `already_reported`.
- `reportComment(commentId, reason)` — identical shape with `guard("communityCommentReport")` and `.rpc("report_community_comment", { p_comment_id, p_reason })`.
- Reason validation (one shared helper for both actions): `reason.trim()` empty → `{ code: "empty" }` with **zero** RPC calls; otherwise the trimmed reason is cut to `LIMITS.MAX_REPORT_REASON` (1000, `SOURCE/lib/ugc/limits.ts`) exactly as `reportExam` does, and the **cut** value is what is sent as `p_reason`.
- **Neither action calls `.from("community_content_reports")`**, and neither contains a `23505` branch.
- A report changes nothing about the target's visibility or ranking (AC-075): no trigger, no follow-up write to `community_solutions` / `community_solution_comments`, and the only `.rpc` call per invocation is the report RPC itself.
- No code path logs the report reason (backend DD § Logging and Monitoring).

### Error mapping (shared mapper from task 04 — backend DD § Data Contracts "Error signalling" clauses (a)/(b))

- `42501` → `{ code: "generic" }` (own content, no submitted attempt, draft solution, exam not visible, exam author banned — the reason is deliberately not named).
- `23514` (reason CHECK backstop, unreachable through the validated action) → `{ code: "generic" }`, with `console.error` carrying the RPC name and code only.
- Any other code or a network failure → `{ code: "generic" }`, same logging rule.
- Rate limit → `{ code: "rateLimited", seconds }`, `seconds` exactly the number `guard()` returned; the typed reason is never cleared.
- **`error.message` is never read**, for any code; `error.details` is read by no action in this task.

### Copy keys

Both keys the Design Doc's Error signalling table names for reports **already exist** in `SOURCE/lib/copy.ts` and need no addition: `report.errorEmpty` for the `empty` code and `report.errorGeneric` for `generic`, plus the existing `profile.error.rateLimited` with `{seconds}`. Cite them by key name only, never by line number. `report.solutionTitle` / `report.commentTitle` are the dialogs' own keys and belong to frontend tasks 36 / 37.

## Acceptance Criteria

From the plan (§ P4-T2): **AC-073–AC-076**.

Carried hard constraints that apply to this task:
- Consumes the existing `RATE_LIMITS` keys from task 02; `SOURCE/lib/security/rateLimit.ts` not edited.
- Session client only; **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/actions.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/reportActions.test.ts` (new)

## Investigation Targets
- `SOURCE/features/solutions/actions.ts` (shared result/error shape and mapper from task 04 — reuse, do not duplicate)
- `SOURCE/features/authoring/lifecycleActions.ts` (lines ~170–202: `reportExam` — trim, empty, and the `LIMITS.MAX_REPORT_REASON` cut; model only, and **not** its `23505` convention, which does not apply here)
- `SOURCE/lib/ugc/limits.ts` (`MAX_REPORT_REASON: 1000`)
- `SOURCE/lib/copy.ts` (confirm `report.errorEmpty` and `report.errorGeneric` are present; cite by key name)
- `SOURCE/supabase/schema.sql` (task 32: `report_community_solution` / `report_community_comment` signatures, return shape `[{ already_reported }]`, errcodes `42501` / `23514`; `community_content_reports` with RLS on, zero policies and zero grants)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" → Server Action contracts table and "Error signalling")
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — row `already_reported` → `alreadyReported`)
- `docs/design/community-solutions-backend-design.md` (§ Test Boundaries — "User-write RPC groups", the `report_community_solution` / `report_community_comment` rows, whose real-DB halves belong to task 35)
- `docs/design/community-solutions-backend-design.md` (§ Logging and Monitoring — no note/comment/report-reason body ever logged)
- `docs/prd/community-solutions-prd.md` (AC-073–AC-076)

## Boundary Context
(From the work plan's Connection Map)

**"User-write RPCs → Server Actions"** — Producer: `report_community_solution` / `report_community_comment` (task 32). Consumer: this task. Serialized format (verbatim): "PostgREST JSON: … `[{ already_reported }]`". Consumer parse rule (verbatim): "Switch on `error.code` only: `42501` → `generic` (never names the reason); `23514` → `generic` (CHECK backstop, unreachable through validated actions); never read `error.message`". Expected signal (verbatim): "a repeat report returns `alreadyReported: true`, never an error".

**"Rate-limit rejection → client copy"**
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`; the typed reason is never cleared.
- **Roundtrip check**: the `seconds` value `guard()` returns for `communitySolutionReport` / `communityCommentReport` is the exact number each action returns.

## Investigation Notes
(Append observations here before implementation begins.)

- `actions.ts` (current file, lines 1-467): existing shared pattern confirmed — `requireUser()` (private, redirect on no session), `guard(name, user.id)` → `{ ok, retryAfterSeconds }`, `logUnexpectedRpcError(rpcName, error, silentCodes?)` (default silent set `{42501,23505,23514}` — NOT reusable as-is for report actions, which must log `23514`), `RpcErrorLike { code?, details?: string|null }` (no `message` field — enforces clause (a) at the type level). Comment actions (`postComment`/`deleteComment`) use a narrower silent-set pattern (`COMMENT_SILENT_ERROR_CODES = new Set(["42501"])`) that logs `23514` — this is the model to copy for reports (own `REPORT_SILENT_ERROR_CODES = new Set(["42501"])`, own `mapReportError` calling `logUnexpectedRpcError(rpcName, error, REPORT_SILENT_ERROR_CODES)`).
- `lifecycleActions.ts:171-203` `reportExam` (model, not to be imported — B4): `guard()` before validation; `trimmed = reason.trim().slice(0, LIMITS.MAX_REPORT_REASON)`; empty check is `trimmed.length === 0` (i.e., check happens AFTER cutting to 1000, but since cut only shortens, trim-empty check is equivalent before/after cut). Task 33 spec requires validation strictly BEFORE any RPC and empty-check is on `reason.trim()` (not the cut value) — same result, will implement as: trim first, check empty on the trimmed string, then slice to `LIMITS.MAX_REPORT_REASON` only on the non-empty path (matches Required Test row 5: "trimmed first" then cut to exactly 1000 chars). `reportExam`'s `23505` branch does NOT apply here (U1: no direct `.from().insert()`, RPC itself absorbs duplicates via `on conflict ... do nothing`).
- `SOURCE/lib/ugc/limits.ts`: `MAX_REPORT_REASON: 1000` confirmed (line 117).
- `SOURCE/lib/copy.ts:274-275`: `report.errorEmpty` / `report.errorGeneric` already present — no copy.ts edit needed (confirms task's "no addition" claim).
- `SOURCE/lib/security/rateLimit.ts:259,262`: `communitySolutionReport` and `communityCommentReport` keys already exist (`{ limit: 15, windowMs: 3600000 }`) — no edit needed to this file (scope boundary honored).
- `schema.sql:3747-3823`: `report_community_solution(p_solution_id uuid, p_reason text) returns table (already_reported boolean)` and `report_community_comment(p_comment_id uuid, p_reason text) returns table (already_reported boolean)` — both `security definer`, both raise `42501 'not eligible'` on ineligibility, both insert with `on conflict (...) where ... is not null do nothing` then `return query select v_row_count = 0` (i.e., `already_reported = true` iff the insert was skipped). Confirms: no `23505` ever reaches the caller; the only errcodes possible from these RPCs are `42501` (eligibility) and `23514` (the table's `community_content_reports_reason_check` CHECK, unreachable in practice since the action already validates non-empty and ≤1000 chars) or infra/network.
- Backend DD § Data Contracts "Error signalling" (lines 2323-2333): confirms table — `guard() rejected` → `rateLimited`; `empty` (no RPC) → `empty`/copy `report.errorEmpty`; `42501` → `generic`/copy `report.errorGeneric`, no console.error ("expected refusal"); `23514` → `generic`, `console.error` yes (RPC name + code only); any other code/network failure → `generic`, `console.error` yes. This matches task file's mapping exactly and matches the `mapCommentError`/`COMMENT_SILENT_ERROR_CODES` precedent (only `42501` silent; `23514` and unknown codes both log).
- Backend DD § Field Propagation Map (line 2471): `already_reported` → `alreadyReported`, "boolean copied as-is... a repeat report is a success, never an error" — confirms Proof Obligation #1.
- Backend DD § Data Contracts table (line 2318-2319) gives the exact Server Action contract row matching the task's implementation content 1:1 — no deviation.
- PRD AC-073–AC-076 (lines 427-430) read; consistent with schema + DD.
- Test file convention: mirrored from `commentActions.test.ts` (mock `@/lib/supabase/server`'s `createClient` exposing `{ auth: { getUser }, rpc }`, and `@/lib/security/rateLimit`'s `guard`; `vi.mock("server-only", () => ({}))` needed because `queries.ts` in the same directory imports `server-only` and the test imports from the `actions` module barrel-adjacent file — actually `commentActions.test.ts` mocks `server-only` because it also imports `queries.ts`; this new test file imports only `actions.ts`, so check at Green phase whether the stub is still required (actions.ts itself does not import `server-only`) — decision: omit unless a real import error surfaces).
- Planned approach: one shared private helper `validateReportReason(reason: string): { ok: true; reason: string } | { ok: false }` used by both `reportSolution` and `reportComment`, called after `guard()` per task's flow ("`requireUser()` → `guard(...)` → reason validation before any RPC"). Error mapper: new `REPORT_SILENT_ERROR_CODES = new Set(["42501"])` and `mapReportError(rpcName, error)` paralleling `mapCommentError`.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the § Required test list below in `reportActions.test.ts`
- [x] Run and confirm failure

### Required test list (binding — plan § P4-T2; backend DD § Integration Verification Points "Task ownership": the report actions' unit tests belong to this task)

The Supabase client is mocked at its boundary. Every row is run for **both** `reportSolution` and `reportComment` unless stated otherwise.

| # | Call | Mocked behaviour | Expected |
|---|---|---|---|
| 1 | `reportSolution(S, "spam")` | RPC → `[{ already_reported: false }]` | `{ ok: true, alreadyReported: false }`; one `.rpc("report_community_solution", { p_solution_id: S, p_reason: "spam" })` |
| 2 | `reportSolution(S, "spam")` (repeat) | RPC → `[{ already_reported: true }]` | `{ ok: true, alreadyReported: true }` — a **success**, copied as-is, never an error |
| 3 | `reportComment(C, "spam")` | RPC → `[{ already_reported: false }]` | one `.rpc("report_community_comment", { p_comment_id: C, p_reason: "spam" })` |
| 4 | `reportSolution(S, "   ")` | — | `{ ok: false, error: { code: "empty" } }`; `.rpc` call count `0` |
| 5 | `reportSolution(S, "x".repeat(1200))` | RPC → success | `p_reason` is exactly 1000 characters (`LIMITS.MAX_REPORT_REASON`), trimmed first |
| 6 | either | RPC → `{ code: "42501" }` | `{ code: "generic" }`, naming no reason |
| 7 | either | RPC → `{ code: "23514" }` | `{ code: "generic" }`; `console.error` called with the RPC name and code only |
| 8 | either | `guard()` rejects with `seconds: 15` | `{ code: "rateLimited", seconds: 15 }`; `.rpc` call count `0`; the reason argument is untouched |
| 9 | either | every failure branch, `console.*` spied | **no spied argument contains the reason string** |
| 10 | either | a successful report | the method log holds exactly one `.rpc(...)` call and **zero** calls touching `community_solutions` or `community_solution_comments` (AC-075) |
| 11 | module source | — | `SOURCE/features/solutions/actions.ts` contains no `.from("community_content_reports")` and no `"23505"` literal; no action reads `error.message` |

### 2. Green Phase
- [x] Implement both actions
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] One shared reason-validation helper for both actions
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `grep -n "service-role" SOURCE/features/solutions/actions.ts` returns nothing; `grep -n "community_content_reports\|23505" SOURCE/features/solutions/actions.ts` returns nothing.
- **Success criteria**: all 11 rows of § Required test list and every Proof Obligation test green.
- **Failure response**: if duplicate detection needs a pre-read or a `23505` branch, stop — the RPC already reports the repeat as `already_reported: true`, and the table has no direct write path to conflict on.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (Failure Mode #1, same-value / AC-074, AC-076): a second report by the same reporter on the same target returns `{ ok: true, alreadyReported: true }` without throwing. The value is **copied from the RPC's `already_reported`**, never inferred from an error code.
- **Primary failure mode**: a duplicate report surfaces an error dialog to the reader, or the action keeps a `23505` branch that can never run and silently rots.
- **Boundary to exercise**: `reportSolution` / `reportComment` against a mocked session client whose RPC returns `[{ already_reported: true }]`; plus a source read proving no `23505` literal exists in the module.
- **State assertion**: `alreadyReported === true` with `ok: true`; the module source contains no `"23505"`.
- **Mock boundary rationale**: session client mocked; the real "one row, then still one row" behaviour of the RPC is proven in task 35's report groups.
- **Residual**: "already reported" UI state in tasks 36/37 (seeded from the read's `iReported`, not from this return value).

- **Claim** (AC-075, verbatim): "bài bị báo cáo không đổi gì với người xem và người viết."
- **Primary failure mode**: reporting triggers an update to the target (auto-hide, ranking change).
- **Boundary to exercise**: mocked client method log during a successful report.
- **State assertion**: exactly one `.rpc("report_community_solution" | "report_community_comment", …)` call and **zero** `.from(...)` calls of any kind — in particular none touching `community_solutions` or `community_solution_comments`.
- **Mock boundary rationale**: session client mocked.
- **Residual**: none.

- **Claim** (backend DD § Logging and Monitoring): the report reason is never logged.
- **Primary failure mode**: an error branch logs the reason text.
- **Boundary to exercise**: every failure branch with `console.*` spied.
- **State assertion**: no spied argument contains the reason string.
- **Mock boundary rationale**: session client mocked.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass (the 11 rows of § Required test list included)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Both actions go through their report RPC; the module contains no `23505` path and no `.from(...)` on `community_content_reports`; no `lib/copy.ts` change was needed

### Operation Verification — result and one noted nuance
- `npm test` (inside `SOURCE/`): 189 files passed, 2482 tests passed, 10 skipped, 0 failed (full suite, including `reportActions.test.ts`'s 18 tests covering all 11 required rows for both actions).
- `npx tsc --noEmit`: clean.
- `npm run lint`: clean (`--max-warnings 0`).
- `grep -n "service-role" SOURCE/features/solutions/actions.ts` → no match (pass).
- `grep -n "community_content_reports\|23505" SOURCE/features/solutions/actions.ts` → **matches found**, both benign and pre-dating/outside this task's added code:
  - Lines 82/87/90: pre-existing `SILENT_RPC_ERROR_CODES = new Set(["42501", "23505", "23514"])` from task 04 (`saveSolution`/`setSolutionStatus`'s defensive silence-list for `save_community_solution`'s upsert) — unrelated RPC, predates task 33, not a duplicate-report branch.
  - Line 472: this task's own section-header comment names the table `community_content_reports` in prose (explaining U1), not a `.from(...)` call.
  - The substantive constraint — no `.from("community_content_reports")` call anywhere in the file, and no `"23505"` literal or branch inside the code this task adds (`reportSolution`/`reportComment` plus their shared helpers) — holds and is asserted by `reportActions.test.ts` row 11, scoped the same way `commentActions.test.ts` row 11 scopes its `error.message` check to the code a given task adds.

## Notes
- Impact scope: tasks 36 and 37 consume these actions.
- Scope boundary: no edits to `rateLimit.ts` or `service-role.ts`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
