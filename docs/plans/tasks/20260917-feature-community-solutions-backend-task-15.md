# Task 15: `actions.ts` — `toggleHelpful(solutionId)`, `setPin(examId, action, solutionId?)`

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P2-T3
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T3)
- **Dependencies**: task 02 (P1-T2), task 13 (P2-T1)
- **Provides**: `toggleHelpful(solutionId)` — **one argument, no target-state flag** — and `setPin(examId, action, solutionId?)`, consumed by task 19
- **Size**: Small (1 plan file + 1 test file; no `SOURCE/lib/copy.ts` change — see § Implementation Content)

## U1 is resolved (no gate on this task)

The v1.1 "plain-RLS writes" model is gone. Backend DD v1.2 replaced the five policies (`community_helpfuls_insert_own`, `community_helpfuls_delete_own`, `community_comments_insert_own`, `community_comments_delete_own`, `community_reports_insert_own`) and the `or cs.author_id = auth.uid()` self-exception with **six `SECURITY DEFINER` user-write RPCs**. `community_solution_helpfuls`, `community_solution_comments` and `community_content_reports` have **RLS on, every privilege revoked, no policy and no grant**: no client role has any direct write path to them, and a direct PostgREST write is an authorization denial (task 16 asserts that as a table-closure case). Every refusal from these RPCs is `42501` with one fixed message per function.

Consequence for this task: `toggleHelpful` is **two RPC calls, never an insert or a delete**, and no `23505` can reach it.

## Implementation Content

### `toggleHelpful(solutionId)` — backend DD v1.9 § Data Contracts "SECURITY DEFINER user-write RPCs" → Server Action contracts; Reference Contract Value #21

- `requireUser()` → `guard("communitySolutionHelpful")` → `.rpc("add_community_solution_helpful", { p_solution_id })`.
- If that call returns `added = true` → `{ ok: true, on: true }`.
- If it returns `added = false` (the row already exists — the RPC skips a repeat with `on conflict do nothing`) → then `.rpc("remove_community_solution_helpful", { p_solution_id })` → `{ ok: true, on: false }`.
- **`on` is the Helpful row's presence in the database after the call — never a client flag and never an echo of an argument.** The action takes **no** `next`/target-state argument.
- **One guard token per invocation**, even when two RPC calls are made (backend DD: "one guard token per action invocation, including the `toggleHelpful` call that makes two RPC calls").
- **No `.from("community_solution_helpfuls")` call of any kind**, and **no `23505` mapping exists** — the add RPC swallows a repeat itself, so a duplicate-key error is not a reachable state for this action.
- The frontend's burst behaviour (at most one call in flight, plus exactly one corrective call when `on !== desiredOn`) lives in `HelpfulButton` (task 19, frontend DD § Data Contracts "Helpful toggle contract"); this action performs one toggle per call.

### `setPin(examId, action, solutionId?)` — backend DD v1.9 § Data Contracts `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`; Reference Contract Value #22

- `requireUser()` → `guard("communitySolutionPin")` → validate `action ∈ {"pin","unpin"}` **before any call** → `.rpc("set_community_solution_pin", { p_exam_id: examId, p_action: action, p_solution_id: solutionId })`.
- The third argument is **forwarded**; the action never calls the RPC with two arguments. `'unpin'` ignores the value; the RPC re-checks that a `'pin'` target is a published solution of `p_exam_id` and raises `22023` otherwise.

### Error mapping (shared mapper from task 04 — backend DD § Data Contracts "Error signalling" clauses (a)/(b))

- `42501` → `{ code: "generic" }` — **deliberately does not name the reason** (AC-002 non-leak).
- `22023` (invalid pin target or invalid action reaching the RPC) → `{ code: "generic" }`.
- `23514` (CHECK backstop) and any other code or network failure → `{ code: "generic" }`; `console.error` carries the RPC name and code only.
- Rate limit → `{ code: "rateLimited", seconds }`, with `seconds` exactly the number `guard()` returned.
- **`error.message` is never read, for any code.** `error.details` is read by no action in this task — clause (b) whitelists it for `23514` on `saveSolution` / `setSolutionStatus` only.
- Never log request payloads.

### Copy keys

This task adds **no** `SOURCE/lib/copy.ts` key and returns codes only. The Vietnamese text for these two actions is owned by frontend task 19: `solutions.view.helpfulError` ("Chưa ghi nhận được lượt Hữu ích. Bạn thử lại nhé.") for a `generic` Helpful failure, `solutions.menu.pinError` for a `generic` pin failure, and the existing `profile.error.rateLimited` with `{seconds}`. Cite these by key name only, never by `lib/copy.ts` line number.

## Acceptance Criteria

From the plan (§ P2-T3): **AC-064, AC-066, AC-077, AC-078, AC-080; Reference Contract Values #21, #22**.

Carried hard constraints that apply to this task:
- Consumes the existing `RATE_LIMITS` keys from task 02; `SOURCE/lib/security/rateLimit.ts` is not edited.
- Session client only; **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/actions.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/helpfulPinActions.test.ts` (new)

## Investigation Targets
- `SOURCE/features/solutions/actions.ts` (task 04 result/error shape and the shared error mapper — reuse it, do not add a parallel one)
- `SOURCE/features/authoring/lifecycleActions.ts` (`reportExam` — `guard()` + session client + `requireUser()` ordering; model only, and **not** its `23505` convention, which does not apply here)
- `SOURCE/lib/security/rateLimit.ts` (`guard()`; keys `communitySolutionHelpful`, `communitySolutionPin` from task 02)
- `SOURCE/supabase/schema.sql` (task 13: `add_community_solution_helpful` / `remove_community_solution_helpful` / `set_community_solution_pin` signatures, return shapes and errcodes `42501` / `22023`; `community_solution_helpfuls` with RLS on and zero policies/grants)
- `docs/design/community-solutions-backend-design.md` (§ Main Components — `features/solutions/actions.ts` interface, incl. `toggleHelpful(solutionId)` and `setPin(examId, action, solutionId?)`)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "SECURITY DEFINER user-write RPCs: Helpful, comments, reports" → Server Action contracts table and "Error signalling")
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "Pin atomicity (v1.8)" → "The target argument (v1.9, CS-01)", which assigns the `setPin` unit test to **this** task)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — rows `added` → `on`, `solutionId` → `p_solution_id`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Helpful toggle contract (`HelpfulButton`, v1.2)")
- `docs/prd/community-solutions-prd.md` (AC-064, AC-066, AC-077, AC-078, AC-080)

## Boundary Context
(From the work plan's Connection Map)

**"User-write RPCs → Server Actions"** — Producer: the Helpful RPCs of task 13. Consumer: this task. Serialized format (verbatim): "PostgREST JSON: `[{ added }]` … or no data for the two `void` RPCs". Consumer parse rule (verbatim): "Switch on `error.code` only: `42501` → `generic` (never names the reason); `23514` → `generic` (CHECK backstop, unreachable through validated actions); never read `error.message`". Expected signal (verbatim): "`toggleHelpful` returns `on` = database state after the call".

**"Pin target"** — Producer: the `SolutionMenu` pin item (task 19) passes the row's own `id`. Consumer: `setPin(examId, action, solutionId?)` → `set_community_solution_pin(p_exam_id, p_action, p_solution_id)`. Serialized format: in-memory Server Action argument → RPC body. Consumer parse rule (verbatim): "RPC re-checks the id is a published solution of `p_exam_id`, else `22023`; `'unpin'` ignores it". Expected signal: the named solution becomes the only pinned row (proven on real DB in task 16).

**"Rate-limit rejection → client copy"**
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`; unsaved input never cleared.
- **Roundtrip check**: the `seconds` value `guard()` returns for `communitySolutionHelpful` / `communitySolutionPin` is the exact number each action returns.

## Investigation Notes
(Append observations here before implementation begins.)

- `SOURCE/features/solutions/actions.ts` (task 04, read in full): `requireUser()` (private, non-exported) calls `createClient()` from `@/lib/supabase/server`, reads `auth.getUser()`, redirects to `/?auth=signin` when absent, returns `{ supabase, user }`. Result shape convention: `{ ok: true, ... } | { ok: false, error: {...} }`. Shared logging helper `logUnexpectedRpcError(rpcName, error)` — skips `console.error` for codes in module-level `SILENT_RPC_ERROR_CODES = new Set(["42501","23505","23514"])` (this set encodes save/status's own anticipated-refusal list, where `23514` is a HANDLED case via `error.details`). `mapSaveSolutionError`/`mapSetSolutionStatusError` are bespoke per-action mappers, each calling `logUnexpectedRpcError` then branching on `error.code === "23514"` to read `error.details` (clause (b), applies to exactly these two actions only). `setSolutionStatus` validates `action` before calling `requireUser()` (validation-first pattern, matches Failure Mode #4 for `setPin`).
- `SOURCE/features/authoring/lifecycleActions.ts` (`reportExam`, read in full): confirms `requireUser()` → `guard(key, user.id)` → RPC/write ordering; `reportExam`'s `23505` duplicate-key handling is specific to `exam_reports`' unique constraint and explicitly does NOT apply to `toggleHelpful` (task 15 line 16: add RPC already swallows repeats server-side).
- `SOURCE/lib/security/rateLimit.ts` (read in full): confirmed `RATE_LIMITS.communitySolutionHelpful = { limit: 40, windowMs: 3600000 }` and `RATE_LIMITS.communitySolutionPin = { limit: 15, windowMs: 3600000 }` both already exist (task 02). `guard(action, userId)` takes two args — real signature, not one.
- `SOURCE/supabase/schema.sql` (task 13 functions, read in full, lines 3392-3531): `add_community_solution_helpful(p_solution_id uuid) returns table (added boolean)` — insert `on conflict (solution_id, user_id) do nothing`, `added = (row_count = 1)`, raises `42501` on ineligibility. `remove_community_solution_helpful(p_solution_id uuid) returns void` — delete, no error on zero rows removed, raises `42501` on ineligibility. `set_community_solution_pin(p_exam_id text, p_action text, p_solution_id uuid default null) returns table (pinned_solution_id uuid)` — raises `42501` for exam-visibility/author-identity/not-submitted checks (checked first, in that order), raises `22023` for invalid target (`'pin'` case) or invalid action (else branch). No `23505` surfaces on any of these three RPCs directly to callers (Helpful table's own conflict is swallowed by `add_community_solution_helpful`; the pin's partial unique index is a DB-internal backstop exercised in task 16, not reachable via `set_community_solution_pin`'s own logic).
- `docs/design/community-solutions-backend-design.md` § Data Contracts "Server Action contracts" table (line ~2312-2318): confirms `toggleHelpful(solutionId)` row exactly as task file states. `setPin` is NOT in this 5-row table (it has its own dedicated YAML contract block at line 1310, and its own Server Action wiring is only in § Field Propagation Map / frontend DD, not in this specific table) — the Error signalling table right below (lines 2326-2332) is written for "all five actions" in that table, so its exact log/no-log split (`42501` no log, `23514`+other yes log) is the DESIGN-WIDE convention for every action EXCEPT save/status (which are the two `clause (b)` exceptions with their own `SILENT_RPC_ERROR_CODES` history). Task 15's own Implementation Content text (line 37-39) mirrors this exactly for its own two actions: `42501` and `22023` bullets carry no console.error mention; the `23514`-and-other bullet explicitly does. Decision: `toggleHelpful`/`setPin` need their OWN silent-error-code set (`{"42501","22023"}`), distinct from save/status's `SILENT_RPC_ERROR_CODES` (`{"42501","23505","23514"}`) — reusing `logUnexpectedRpcError` as-is would wrongly silence `23514` and wrongly log `22023` for these two actions. Chosen approach: extend `logUnexpectedRpcError` with an optional third parameter (silent-code set, defaulting to the existing `SILENT_RPC_ERROR_CODES` so save/status's behavior is provably unchanged) rather than writing a second console.error call site — keeps exactly one logging primitive in the file (Minimum Surface).
- `docs/design/community-solutions-backend-design.md` § Field Propagation Map (line 2469): `added` → `on`, confirms `on = added` when `added = true`; when `added = false` the action calls `remove_community_solution_helpful` and returns `on: false` — matches task file exactly.
- `docs/design/community-solutions-backend-design.md` § Integration Verification Points "Pin atomicity" → "The target argument" (line 2694): confirms task 15 owns exactly one `vitest` unit test asserting `setPin(examId, 'pin', A)` calls `.rpc('set_community_solution_pin', { p_exam_id: examId, p_action: 'pin', p_solution_id: A })` — matches Required test list row 8.
- `docs/design/community-solutions-frontend-design.md` § Data Contracts "Helpful toggle contract" (line 1479-1501) and the action-wiring table (line 1751): confirms `toggleHelpful` return type `{ ok: true; on: boolean } | { ok: false; error: { code: "rateLimited"; seconds: number } | { code: "generic" } }`, and `setPin` success return type `{ ok: true, pinnedSolutionId: string | null }` (line 1751) — this exact field name (`pinnedSolutionId`, camelCase of `pinned_solution_id`) is adopted for `setPin`'s success shape since no other source defines it and the frontend DD's action-wiring table is the authoritative name the frontend (task 19) will consume.
- `docs/prd/community-solutions-prd.md` AC-064/066/077/078/080 read; content matches task file's Implementation Content and Proof Obligations verbatim, no additional constraint found.
- Pattern reference: `SOURCE/features/solutions/__tests__/writerActions.test.ts` (task 04's test file) shows the `vi.hoisted` + `vi.mock("@/lib/supabase/server", ...)` mock-client pattern used across this feature's tests. This task's Red Phase instruction (mocked `guard`, not real rate-limiting) differs deliberately from `writerActions.test.ts`'s real-`guard()`-with-fake-timers approach — task 15's own text is explicit ("mocked session client + mocked `guard`"), so `@/lib/security/rateLimit` is mocked wholesale in the new test file (`guard` only, since that's the only export `actions.ts` imports from it).

**Spec conflict found, escalated to the engineer, resolved 2026-09-25 (do not re-open):** the Operation Verification Method's `grep -n "23505" SOURCE/features/solutions/actions.ts` and Required test row 7's literal-string check, read as a whole-file ban, collide with the backend DD's own binding § Logging and Monitoring rule ("log unexpected (non-`42501`/`23505`/`23514`) RPC errors") — a rule task 04's own task file cites by name and that this feature's already-committed, already-verified `SILENT_RPC_ERROR_CODES = new Set(["42501","23505","23514"])` implements. The executor's first pass removed `"23505"` from that set to make row 7's whole-file grep pass, reasoning it was unreachable dead code since `save_community_solution` uses `on conflict ... do update` (true, but irrelevant — the DD's logging rule is written for the whole file, not conditioned on reachability, and unilaterally changing an already-verified prior task's committed behavior to satisfy this task's own test wording is exactly the class of decision the engineer asked to review before, not after, the fact — see `docs/plans/community-solutions-HANDOFF.md` § "Sự cố đã xử lý", AC-022 precedent).
- **Engineer decision (2026-09-25):** keep task 04's binding logging rule; `"23505"` stays in `SILENT_RPC_ERROR_CODES`, unchanged from its committed form. Required test row 7 and the Operation Verification Method are **narrowed** to their evident intent — that `toggleHelpful`/`setPin`'s own new code (not the whole module) adds no `23505` handling and no direct `community_solution_helpfuls` table access — rather than read as a literal whole-file ban that no version of this file could satisfy once task 04 landed. `helpfulPinActions.test.ts` row 7 now slices the source from `export async function toggleHelpful` onward (same pattern row 13 already uses) before asserting, instead of scanning the whole file.
- `toggleHelpful`'s docstring was also rewritten to describe the "no `23505` path exists for Helpful" fact in prose without quoting the literal substrings `"23505"`/`.from("community_solution_helpfuls")` — kept as-is (harmless, arguably clearer prose), independent of the resolution above.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the § Required test list below in `helpfulPinActions.test.ts` (mocked session client + mocked `guard`)
- [x] Run and confirm failure

### Required test list (binding — plan § P2-T3; backend DD § Integration Verification Points "Pin atomicity" → "The target argument")

The Supabase client is mocked at its boundary; every case asserts on the mocked client's **method log** (RPC names and argument objects), not on a typed wrapper.

| # | Call | Mocked RPC behaviour | Expected |
|---|---|---|---|
| 1 | `toggleHelpful(S)` | `add_community_solution_helpful` → `[{ added: true }]` | `{ ok: true, on: true }`; **exactly one** `.rpc` call, named `add_community_solution_helpful`, with `{ p_solution_id: S }`; zero `remove_*` calls |
| 2 | `toggleHelpful(S)` | add → `[{ added: false }]`, then `remove_community_solution_helpful` → no data | `{ ok: true, on: false }`; the method log is exactly `[add, remove]`, in that order, both with `{ p_solution_id: S }` |
| 3 | `toggleHelpful(S)` | add → `{ code: "42501" }` | `{ ok: false, error: { code: "generic" } }`; **no** `remove` call; the returned object names no reason |
| 4 | `toggleHelpful(S)` | `guard()` rejects with `seconds: 42` | `{ ok: false, error: { code: "rateLimited", seconds: 42 } }`; `.rpc` call count `0` |
| 5 | `toggleHelpful(S)` | add → `[{ added: false }]`, remove → `{ code: "42501" }` | `{ code: "generic" }`; still exactly two `.rpc` calls |
| 6 | `toggleHelpful(S)` | any branch | **one** `guard("communitySolutionHelpful")` call per invocation, even in case 2 where two RPCs are called |
| 7 | `toggleHelpful` / `setPin` | any error branch | `toggleHelpful`'s and `setPin`'s own source (not the whole module — task 04's pre-existing, DD-binding `SILENT_RPC_ERROR_CODES` legitimately keeps `"23505"` for save/status, see Investigation Notes) contains no `.from("community_solution_helpfuls")` and no `"23505"` literal (assert by reading the module source, the same static-check style Test 1 uses) |
| 8 | `setPin(examId, "pin", A)` | success | `.rpc` called with exactly `('set_community_solution_pin', { p_exam_id: examId, p_action: "pin", p_solution_id: A })` — **the forwarded third argument**, verbatim from Reference Contract Value #22 |
| 9 | `setPin(examId, "unpin")` | success | one `.rpc` call with `p_action: "unpin"`; `p_solution_id` is `undefined`, and no second call is made |
| 10 | `setPin(examId, "purge" as never, A)` | — | rejected before any call: `.rpc` call count `0` |
| 11 | `setPin(examId, "pin", A)` | `{ code: "22023" }` | `{ code: "generic" }` |
| 12 | `setPin(examId, "pin", A)` | `guard()` rejects | `{ code: "rateLimited", seconds }`; `.rpc` call count `0` |
| 13 | both actions | any branch | no code path reads `error.message` (assert by source read, and by a case whose error carries **only** a `message`, which must still map to `generic`) |

### 2. Green Phase
- [x] Implement both actions
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Reuse task 04's error-mapping helper rather than adding a parallel one
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `grep -n "service-role" SOURCE/features/solutions/actions.ts` returns nothing; within `toggleHelpful`'s and `setPin`'s own source only (not the whole module — see Investigation Notes for why a whole-file grep cannot hold), no `23505` literal and no `community_solution_helpfuls` direct table access (no duplicate-key path and no direct table access exist for Helpful).
- **Success criteria**: all 13 rows of § Required test list and every Proof Obligation test green.
- **Failure response**: if a Helpful case can only pass by inserting into or deleting from `community_solution_helpfuls` directly, stop — the table has RLS on with zero policies and zero grants, so that path is refused by design; the contract is the add-then-remove RPC pair. If `setPin` is written with two RPC arguments, stop — Reference Contract Value #22 pins the third.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (AC-064 "bấm dồn chỉ giữ trạng thái cuối", AC-066): `on` follows the database, not the client — an add that returns `added: true` yields `on: true` with one RPC call, and an add that returns `added: false` yields `on: false` only after the remove RPC actually ran.
- **Primary failure mode**: the action echoes a client-supplied target state (the removed `next` argument) or re-derives `on` from its own bookkeeping, so a double-press leaves the UI and the database disagreeing.
- **Boundary to exercise**: `toggleHelpful` against a mocked session client whose `add_community_solution_helpful` returns `[{ added: false }]`.
- **State assertion**: the method log is exactly `[add, remove]` and the result is `{ ok: true, on: false }`; the function signature takes one parameter.
- **Mock boundary rationale**: session client mocked; the real refusals for own/unsubmitted/draft/banned callers and the table-closure case are proven in task 16 (AC-065).
- **Residual**: the one-call-in-flight + one-corrective-call burst behaviour and the optimistic revert on error are proven in task 19.

- **Claim** (Failure Mode #4, invalid option): `setPin` rejects any action outside `{pin, unpin}` without calling the RPC.
- **Primary failure mode**: an arbitrary action string reaches `set_community_solution_pin`.
- **Boundary to exercise**: `setPin` input validation.
- **State assertion**: mocked `.rpc` call count = 0 for an invalid action.
- **Mock boundary rationale**: session client mocked.
- **Residual**: the RPC's own `22023` branch is exercised in task 16.

- **Claim** (AC-078 / Reference Contract Value #22, verbatim): "`setPin(examId, 'pin', A)` calls `.rpc('set_community_solution_pin', { p_exam_id: examId, p_action: 'pin', p_solution_id: A })`, so the action forwards its third argument and does not call the RPC with two."
- **Primary failure mode**: the action drops `solutionId`, so the RPC has to guess a target; or it performs unpin + pin as two round trips, leaving a window with zero pins or a failure between them.
- **Boundary to exercise**: mocked client method log during `setPin(examId, "pin", id)`.
- **State assertion**: exactly one `.rpc("set_community_solution_pin", …)` call, whose argument object deep-equals `{ p_exam_id, p_action, p_solution_id }`.
- **Mock boundary rationale**: session client mocked; DB atomicity and the `null` / foreign-exam / draft-target `22023` refusals are proven in task 16.
- **Residual**: none beyond the DB half.

- **Claim** (backend DD "Error signalling" clause (a)): no code path in either action reads `error.message`, and no `42501` refusal names its reason.
- **Primary failure mode**: the action branches on message text, or surfaces "bạn là người viết" / "chưa nộp đề" to the reader, leaking the eligibility reason AC-002 keeps closed.
- **Boundary to exercise**: both actions with a `42501` error, and with an error carrying only a `message`.
- **State assertion**: both return `{ code: "generic" }`; the module source contains no `error.message` read.
- **Mock boundary rationale**: session client mocked.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass (the 13 rows of § Required test list included)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] `toggleHelpful` takes exactly one parameter; `setPin` forwards `p_solution_id`; `toggleHelpful`/`setPin`'s own code contains no `23505` path and no `.from(...)` on `community_solution_helpfuls` (task 04's pre-existing, DD-binding `SILENT_RPC_ERROR_CODES` keeps `"23505"` for save/status — see Investigation Notes, engineer-confirmed 2026-09-25)

## Notes
- Impact scope: task 19's `HelpfulButton`/`SolutionMenu` consume these.
- Scope boundary: no edits to `rateLimit.ts` or `service-role.ts`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
