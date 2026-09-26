# Task 34: `adminActions.ts` — `listCommunityReports`, `getSolutionNotesForAdmin`, `moderateSolutionAction`, `moderateCommentAction` + Integration Test 1 (Red→Green)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P4-T3
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T3)
- **Dependencies**: task 02 (P1-T2), task 32 (P4-T1)
- **Provides**: `SOURCE/features/solutions/adminActions.ts` — `listCommunityReports()`, `getSolutionNotesForAdmin(solutionId)`, `moderateSolutionAction(prevState, formData)`, `moderateCommentAction(prevState, formData)`, consumed by task 38
- **Size**: Small (2 files)

## Implementation Content

### Interface (binding — backend DD v1.9 § Main Components `adminActions.ts`)

```
listCommunityReports()                      → AdminReportedSolution[]
getSolutionNotesForAdmin(solutionId)        → AdminSolutionNote[]
moderateSolutionAction(prevState, formData) → form-action result; a refusal is { error: string }
moderateCommentAction(prevState, formData)  → form-action result; a refusal is { error: string }
```

The two moderation functions are **form actions** (`useActionState` shape), exactly like `moderateExamAction` in `SOURCE/features/admin/actions.ts`: they take `(prevState, formData)` and return `{ error: string }` on refusal, where the string is a **fixed copy key** and never a database message (backend DD § Error Handling, infrastructure row; frontend DD § UI Action - API Contract Mapping, the admin rows). The row-level key is `admin.solutions.actionError`, owned and rendered by frontend task 38.

- Each of the four: `isAdminUserId()` app-layer pre-check (existing convention, `SOURCE/lib/auth/admin.ts`) before any call → refusal for non-admins with **zero** RPC calls; then `.rpc(...)` on the **session** client; the RPC's own `is_admin_user()` check is the real backstop.
  - `listCommunityReports()` → `.rpc("admin_list_community_reports")`
  - `getSolutionNotesForAdmin(solutionId)` → `.rpc("admin_get_community_solution_notes", { p_solution_id })`
  - `moderateSolutionAction(prevState, formData)` → `guard("communityAdminModerateSolution")`; reads `solutionId`, `action` and `reason` **from the `FormData`**; validates `action ∈ {hide, restore, delete}`; reason **required** (non-empty after trim) for `hide`/`delete`, optional for `restore` (AC-082/AC-106, re-validated here — never trust the client form); → `.rpc("admin_moderate_community_solution", { p_solution_id, p_action, p_reason })`
  - `moderateCommentAction(prevState, formData)` → same shape with `guard("communityAdminModerateComment")` and `.rpc("admin_moderate_community_comment", { p_comment_id, p_action, p_reason })`
- Error mapping for the two moderation actions: `42501` (not an admin), `22023` (invalid action / reason required / invalid transition) and `P0002` (not found) all become an error result carrying the fixed key; `error.message` is never read and never forwarded.
- **This file imports nothing from `@/lib/supabase/service-role`.**
- Fill **Test 1** in `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (Tests 2 and 3 already implemented).

### SK-1 — how Test 1's call is written (plan § Open Items, resolved 2026-09-20)

The skeleton's Test 1 writes the call as `moderateSolutionAction(id, "hide", reason)`, while both Design Docs declare `(prevState, formData)`. **Plan resolution, binding: the test passes a `FormData` carrying the id, `"hide"` and the reason**, and the skeleton's three proof obligations are unchanged (one `.rpc` with the exact RPC name, zero `.from(...)` writes, no `service-role` import). Do **not** add a positional-argument overload to make the skeleton's literal wording compile — the declared signature is the contract.

### Mappers (no masking on any admin row)

`listCommunityReports()` maps each queue row snake_case → camelCase, with **no `toAuthorIdentity` and no `toScoreField` anywhere on an admin path** — S5 gives the admin the real values by design:

- row: `id`, `exam_id` → `examId`, `exam_title` → `examTitle`, `status` (`"published" | "hidden"`), `report_count` → `reportCount`, `report_reasons` → `reportReasons`
- `author`: `{ displayName: author_display_name, isAnonymousToReaders: author_is_anonymous_to_readers }` — an `AdminReportedAuthor` with **exactly two fields**. **`avatarUrl` does not exist** on this type (frontend DD v1.5 deleted it; the RPC emits no avatar column), so the mapper must not invent one.
- `reported_comments` → `reportedComments: AdminReportedCommentItem[]`, each `{ id, questionNumber, body, commenter: { displayName, isAnonymousToReaders }, reportCount, reportReasons }` with **`questionNumber: number | null`** — `null` once the comment's question has left the exam (AC-047); the mapper copies the `null` through and never substitutes `0` or drops the key.
- `hidden_comments` → `hiddenComments: AdminHiddenCommentItem[]`, each `{ id, questionNumber (number | null), body, commenter: { displayName, isAnonymousToReaders }, hiddenReason, hiddenAt, reportCount }`. An empty array is `[]`, never `null`/absent.
- A row with `status: "hidden"` may legally arrive with `reportCount: 0`, `reportReasons: []` and `reportedComments: []` — **a hidden solution stays in the queue whatever its report count** (Reference Contract Value #26). The mapper filters no row out.

`getSolutionNotesForAdmin(solutionId)` maps `{question_number, question_id, body}` → `AdminSolutionNote { questionNumber, questionId, body }` **in array order** (already ascending by `questionNumber`); it does no sorting and no re-rendering — `body` stays the raw markdown string, printed as plain text on `/admin` with no `RichText` (Reference Contract Value #16). An empty array is a legal, non-error state.

## Acceptance Criteria

From the plan (§ P4-T3): **AC-082, AC-085, AC-106–AC-109; PRD NFR Bảo mật, M9; Reference Contract Values #16, #26**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit acceptance criterion)**: "no operation added to `SOURCE/lib/supabase/service-role.ts`" — verified by Test 1's static-import check plus `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` staying green with no diff to `service-role.ts`.
- Consumes the existing `RATE_LIMITS` keys from task 02; `SOURCE/lib/security/rateLimit.ts` not edited.
- No report reason or note body logged.

## Target Files
- [x] `SOURCE/features/solutions/adminActions.ts` (new)
- [x] `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (fill **Test 1**)

## Investigation Targets
- `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (Test 1 annotations; Tests 2/3 runner shape)
- `SOURCE/features/admin/actions.ts` (`moderateExamAction` — shape to mirror; model only, do not import across features)
- `SOURCE/lib/auth/admin.ts` (`isAdminUserId`)
- `SOURCE/lib/supabase/service-role.ts` and `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `SOURCE/supabase/schema.sql` (task 32 RPC signatures and errcodes `42501`/`22023`/`P0002`)
- `docs/design/community-solutions-backend-design.md` (§ Main Components — `adminActions.ts`, incl. the `(prevState, formData)` interface)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — Admin RPCs: "Queue row condition", "Entry condition", "Queue row columns (binding, v1.8)", "Hidden-comment columns (binding, v1.7)", and the `admin_moderate_*` On Error lines)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "Contract-only column lists", the `admin_get_community_solution_notes` row)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — the admin rows)
- `docs/design/community-solutions-backend-design.md` (§ Error Handling — the infrastructure row's `{ error: string }` shape for the admin form actions)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `SOURCE/lib/supabase/service-role.ts` deliberately zero integration)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Admin report row contract" (`AdminReportedAuthor`, `AdminReportedCommentItem`, `AdminHiddenCommentItem`, `AdminReportedSolution`) and "Admin solution-notes contract" (`AdminSolutionNote`))
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — **SK-1**, the resolved form of Test 1's call)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-082, AC-085, AC-106–AC-109, M9)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision) | placement | `admin_users`(user_id) table (RLS-locked, zero policies) + `is_admin_user()` gate new RPCs granted to `authenticated`; zero new exports/writers in `service-role.ts` | Every admin write in `adminActions.ts` is an `.rpc()` to an `is_admin_user()`-gated function, and `service-role.ts` has no diff |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing | `adminActions.ts` contains zero `service-role` import paths and `serviceRoleSurface.test.ts` is green unmodified |

## Boundary Context
(From the work plan's Connection Map — "Admin moderation RPCs → `adminActions.ts`"; this task is the consumer. Integration Test 1 proves this boundary.)
- **Serialized format** (verbatim): "PostgREST JSON — unmasked (S5): `author_display_name` + `author_is_anonymous_to_readers`, `reported_comments` and `hidden_comments` jsonb arrays, notes `{question_number, question_id, body}`".
- **Consumer parse rule** (verbatim): "`adminActions.ts` never imports `@/lib/supabase/service-role`; calls `.rpc()` on the session client only; admin rows never pass through `toAuthorIdentity`; form actions return `{ error: string }` on refusal".
- **Expected signal** (verbatim): "Mocked session client's `.rpc()` called with exactly the RPC name; zero `.from("community_solutions").update(...)` calls".
- **Roundtrip check**: the admin list row's unmasked identity fields pass through to the returned object unchanged (no masking mapper applied on the admin path), and a `question_number` of `null` arrives as `questionNumber: null`.

## Investigation Notes
(Append observations here before implementation begins. Record each Binding Decision Compliance Check result.)

**Observations (2026-09-26, task-executor)**
- `communitySolutions.int.test.ts`: shared `vi.mock("@/lib/supabase/server")` returns `{ auth: { getUser }, rpc }` (no `.from`); `server-only` stubbed; Tests 2/3 use the real `guard()` and reset `rpcMock` in their own `beforeEach`. Test 1 is comment-only (skeleton wording `moderateSolutionAction(id, "hide", reason)` — superseded by SK-1).
- `features/admin/actions.ts` `moderateExamAction(_prev, formData)`: reads `examId`/`action`/`reason` via `String(formData.get(x) ?? "")`, validates action before auth, then `createClient()` → `auth.getUser()` → `!user || !isAdminUserId(user.id)` → `{ error }`; success → `revalidatePath("/admin")`. Its `{ error }` carries `t(...)` text; it imports `moderateExam` from service-role (the path this task must NOT take). Model only, not imported (B4).
- `lib/auth/admin.ts` `isAdminUserId(userId: string | null | undefined): boolean` — env allowlist `ADMIN_USER_IDS`, fail-closed; module imports `server-only`.
- `lib/copy.ts` `t` is typed to `MessageKey`; `admin.solutions.actionError` is NOT yet in copy.ts (owned by frontend task 38) → the form actions return the literal key string, never `t(...)`, never a DB message.
- Migration `20260927000000_community_solutions_moderation_cb08928767f8.sql`: `admin_moderate_community_solution(p_solution_id uuid, p_action text, p_reason text) returns table(status text)` — 42501 (not admin, first) → 22023 invalid action → 22023 reason required (hide/delete, btrim) → P0002 not found → 22023 invalid transition. Comment twin identical with `p_comment_id`, statuses `hidden|visible|deleted`. `admin_list_community_reports()` returns `id, exam_id, exam_title, author_display_name, author_is_anonymous_to_readers, status, report_count, report_reasons text[], reported_comments jsonb, hidden_comments jsonb` (both jsonb `coalesce(..., '[]')`, never null; no avatar column). `admin_get_community_solution_notes(p_solution_id)` returns `question_number int, question_id text, body text` ordered by position. All four `revoke ... from public, anon; grant ... to authenticated`.
- `lib/security/rateLimit.ts`: `guard(key, userId) → { ok, retryAfterSeconds }`; keys `communityAdminModerateSolution` / `communityAdminModerateComment` exist (task 02). Not edited.
- Frontend DD § Rate-limit mapping: admin rate-limit rejection surfaces `profile.error.rateLimited` with `{seconds}` → the error branch carries `{ error: "profile.error.rateLimited", seconds }` (still an `{ error: string }` refusal).
- Frontend DD § UI Action mapping names the form fields `FormData { id, action, reason }` while this task file (binding for this task) says the solution action reads `solutionId`. Implemented per the task file: `solutionId` / `commentId` (the `examId` precedent of `moderateExamAction`). **Coordination note for task 38**: post `solutionId` (solution rows) and `commentId` (comment items).
- Success shape per frontend DD: `{ ok: true, status }` (status copied from the RPC's `status` column). `revalidatePath("/admin")` + `revalidatePath("/exams/[id]/solutions", "page")` + `revalidatePath("/exams/[id]/solutions/[solutionId]", "page")` (backend DD data flow; Next docs: a dynamic-segment pattern requires the `type` arg).
- Reads (`listCommunityReports`, `getSolutionNotesForAdmin`): non-admin → throw a fixed-message Error with zero RPC calls; RPC error → log RPC name + code only, throw a fixed-message Error (frontend DD: "a thrown error reaches the app-level error.tsx"). No `[]` fallback.
- `toAuthorIdentity` / `toScoreField` live in `lib/solutions/identity.ts` (used by `queries.ts`); `adminActions.ts` imports neither.
- `serviceRoleSurface.test.ts` reads `service-role.ts` source and pins 13 exports / 4 direct writers — this task adds no import and no edit there.

**Binding Decision check (pre-implementation)**
- placement: every admin write in `adminActions.ts` is a session-client `.rpc("admin_moderate_community_solution"|"admin_moderate_community_comment")`, both `is_admin_user()`-gated in the migration; `service-role.ts` untouched → **Y**.
- dependency_direction: `adminActions.ts` imports only `next/cache`, `@/lib/supabase/server`, `@/lib/auth/admin`, `@/lib/security/rateLimit` — zero `service-role` path; `serviceRoleSurface.test.ts` not modified → **Y**.

**Adjacent notes**: no Change Category field; no Reference Contracts section (Values #16/#26 covered by Required rows 12/15/16).

**Exit Gate evidence (post-implementation)**
- Red: `vitest run communitySolutions.int.test.ts` failed with "Cannot find package '@/features/solutions/adminActions'" (module absent). Green: 29/29 in one run (Test 1 = 3, Test 2 = 3, Test 3 = 6, rows 4-8 = 9, rows 9-16 = 8). Mutation spot-check: dropping the reason rule and the admin pre-check turned rows 5 / 7 / 7-signed-out red (then restored).
- `npm test` 189 files / 2502 tests passed (10 skipped, pre-existing, none in this file); `npx tsc --noEmit` clean; `npm run lint` (`--max-warnings 0`) clean.
- `serviceRoleSurface.test.ts` 6/6 green; `git diff --stat` empty for `service-role.ts`, `serviceRoleSurface.test.ts`, `rateLimit.ts`, `features/admin/actions.ts`; `grep service-role adminActions.ts` → no match.
- Binding Decision re-evaluation: placement **Y** (only two writes, both `.rpc` to `is_admin_user()`-gated functions; Test 1 asserts zero `.from(`); dependency_direction **Y** (zero service-role path, surface test unmodified and green).
- Proof Obligations: Test 1 (a)/(b)/(c) met; Failure Mode #4 met (rows 4-5, `.rpc` count 0 on hand-built FormData); Failure Mode #8 met (row 7, all four functions, `.rpc` count 0).
- Roundtrip (Boundary Context): row 9 unmasked name + flag pass through unchanged; rows 10/11 `question_number: null` → `questionNumber: null`.
- Refactor: one shared `requireAdmin()` + `readModerationForm()` + `moderate()` used by both form actions.
- Coordination for task 38: form fields `solutionId` / `commentId` + `action` + `reason`; refusal `{ error: "admin.solutions.actionError" }` (key, not text — add the key to copy.ts); rate-limit `{ error: "profile.error.rateLimited", seconds }`; success `{ ok: true, status }`; the two reads throw on non-admin / RPC error.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Replace Test 1's runner section with real imports + `describe`/`it` + its three verification points, calling the form actions with a `FormData` per SK-1
- [x] Write the § Required test list below (mapper and validation cases)
- [x] Run and confirm failure

### Required test list (binding — plan § P4-T3; frontend DD § Test Boundaries, the admin bullets)

The session client is mocked at its boundary; `isAdminUserId` is mocked for the refusal cases.

| # | Call | Input / mocked behaviour | Expected |
|---|---|---|---|
| 1 | `moderateSolutionAction(undefined, fd)` with `fd` carrying the id, `"hide"` and a reason | RPC → success | `.rpc` called **exactly once** with `"admin_moderate_community_solution"`; **zero** `.from("community_solutions")` calls (skeleton Test 1(b)) |
| 2 | `moderateCommentAction(undefined, fd)` with `"hide"` + reason | RPC → success | same shape with `"admin_moderate_community_comment"` |
| 3 | module source | — | **zero** occurrences of a `"service-role"` import path in `adminActions.ts` (skeleton Test 1(a)/(c)) |
| 4 | `moderateSolutionAction` / `moderateCommentAction` | `action` outside `{hide, restore, delete}` (e.g. a crafted `action=purge`) | rejected before any call: `.rpc` count `0`; result is `{ error: <key> }` |
| 5 | both | `"hide"` or `"delete"` with an empty / whitespace-only reason | `.rpc` count `0`; `{ error: <key> }` (AC-082, AC-106) |
| 6 | both | `"restore"` with no reason | accepted — the RPC is called (reason is optional for restore) |
| 7 | all four functions | `isAdminUserId` → `false` | refusal with `.rpc` count `0` for each (AC-085) |
| 8 | both moderation actions | RPC → `{ code: "42501" }` / `{ code: "22023" }` / `{ code: "P0002" }` | an error result carrying the fixed key; `error.message` is not read and not forwarded |
| 9 | `listCommunityReports()` | a queue row with `author_is_anonymous_to_readers: true` | `author.isAnonymousToReaders === true` **and** `author.displayName` equal to the row's real name (never replaced by "Ẩn danh"); `"avatarUrl" in author` is `false` |
| 10 | `listCommunityReports()` | a `hidden_comments` entry with `question_number: null` | `questionNumber: null` (key present, value `null`) |
| 11 | `listCommunityReports()` | a `reported_comments` entry with `question_number: null` | `questionNumber: null` — the visible half is nullable too (frontend DD v1.5) |
| 12 | `listCommunityReports()` | a row with `status: "hidden"`, `report_count: 0`, `report_reasons: []`, `reported_comments: []`, one `hidden_comments` entry | the row is **returned**, not filtered out (Reference Contract Value #26); `hiddenComments` has one item |
| 13 | `listCommunityReports()` | a row with no hidden comment | `hiddenComments` is `[]`, never `null` or absent |
| 14 | `listCommunityReports()` | any row | no value passes through `toAuthorIdentity` / `toScoreField` (assert by source read: the module imports neither) |
| 15 | `getSolutionNotesForAdmin(S)` | RPC → rows for question positions `1` and `3` | `[{ questionNumber: 1, questionId, body }, { questionNumber: 3, … }]` in that array order; `body` is the raw string, unchanged |
| 16 | `getSolutionNotesForAdmin(S)` | RPC → `[]` | `[]` returned as a legal, non-error state (task 38 renders "Chưa có lời giải") |

### 2. Green Phase
- [x] Implement `adminActions.ts`
- [x] Run only the added tests and confirm they pass; re-run `serviceRoleSurface.test.ts`

### 3. Refactor Phase
- [x] One shared admin pre-check + reason validation used by both moderate actions
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `serviceRoleSurface.test.ts` — Enforces: `service-role.ts` surface frozen — Config: `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `grep -n "service-role" SOURCE/features/solutions/adminActions.ts` returns nothing; `git diff --stat SOURCE/lib/supabase/service-role.ts` is empty.
- **Success criteria**: Test 1's three checks hold; all 16 rows of § Required test list green; `serviceRoleSurface.test.ts` green.
- **Failure response**: if any admin read needs cross-user data the RPCs do not return, stop and escalate — never reach for `service-role.ts`.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (skeleton Test 1, verbatim): "(a) static-import check — features/solutions/adminActions.ts contains zero imports of '@/lib/supabase/service-role'; (b) call-pattern assertion — the mocked session client's .rpc() is called with exactly 'admin_moderate_community_solution' / 'admin_moderate_community_comment', never a direct .from('community_solutions').update(...) write; (c) note that SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts (13 exports / 4 direct writers, unmodified) is the complementary repo-wide proof this test does not duplicate."
- **Primary failure mode** (skeleton): "a future edit routes admin moderation through lib/supabase/service-role.ts (a 14th exported operation or a 5th direct writer), silently reopening the frozen surface TD-029/ADR-0019 forbids."
- **Boundary to exercise**: `adminActions.ts` public functions against a mocked session client; source text read for the static check.
- **State assertion**: `moderateSolutionAction(prevState, formData)` — the `FormData` carrying the id, `"hide"` and the reason (SK-1) — → `.rpc` called exactly once with `"admin_moderate_community_solution"`, zero `.from("community_solutions")`; same shape for comments.
- **Mock boundary rationale** (skeleton `@real-dependency`): "the session client is the sanctioned mock boundary here; the real is_admin_user() DB-layer rejection for a non-admin caller is proven in … Test SE2's admin-vs-non-admin read" — plus task 35's admin group.
- **Residual**: DB-layer rejection proven in tasks 35 and 47.

- **Claim** (Failure Mode #4, invalid option / AC-082, AC-106): an action outside `{hide, restore, delete}` or a missing reason for `hide`/`delete` is rejected before any RPC call, reading both values out of the `FormData` server-side rather than trusting the client's own validation.
- **Primary failure mode**: a crafted form posts `action=purge` or an empty reason and reaches the RPC.
- **Boundary to exercise**: `moderateSolutionAction` / `moderateCommentAction` validation, called with a hand-built `FormData`.
- **State assertion**: mocked `.rpc` call count = 0.
- **Mock boundary rationale**: session client mocked.
- **Residual**: the RPC's own `22023` branch proven in task 35.

- **Claim** (Failure Mode #8 / AC-085): a non-admin caller (per `isAdminUserId`) gets a refusal and no RPC call.
- **Primary failure mode**: the app-layer pre-check is skipped, relying solely on the DB.
- **Boundary to exercise**: all four functions with `isAdminUserId` returning false.
- **State assertion**: mocked `.rpc` call count = 0 for each.
- **Mock boundary rationale**: session client + auth mocked.
- **Residual**: DB backstop in task 35.

## Completion Criteria
- [x] All added tests pass (Test 1 + the 16 rows of § Required test list)
- [x] The two moderation functions are declared `(prevState, formData)` and return `{ error: string }` on refusal; no admin row passes through a masking mapper; `AdminReportedAuthor` carries exactly `{ displayName, isAnonymousToReaders }`
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] All three int skeleton tests (1, 2, 3) now implemented and green in one run

## Notes
- Impact scope: task 38 is the only consumer.
- Scope boundary: `SOURCE/features/admin/actions.ts` (`moderateExamAction`) unmodified; no edits to `service-role.ts` or `rateLimit.ts`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
