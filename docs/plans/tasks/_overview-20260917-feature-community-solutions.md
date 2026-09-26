# Overall Design Document: Bài giải cộng đồng (Community Solutions)

Generation Date: 2026-09-17 (updated 2026-09-20 to work plan v1.3)
Target Plan Document: `docs/plans/20260917-feature-community-solutions.md` (**v1.3**, 2026-09-19; the v1.2 task files were regenerated against it)
Decomposer note: `TaskCreate`/`TaskUpdate` were not available in the decomposition session — progress is tracked in § Progress Tracking at the bottom of this file and in the Notion row named in `docs/plans/community-solutions-HANDOFF.md`.
v1.3 status: **15 of 53 task files done** (01–15), plus non-task commit `707df1f` (TD-034) and post-commit fix `4b0ea52` (task 03 AC-022 data gap). Task numbers 01–53 and the five phases are unchanged; both Design Docs cite them.

## Project Overview

### Purpose and Goals
Ship "Bài giải cộng đồng" end to end: a submitted user can write/publish their own solution for an exam, eligible readers can browse and open other users' solutions with anonymity correctly masked, per-question comments work, readers can report content, admins can moderate from `/admin` with an audit log, and the profile page surfaces reputation, badges, and a comment-notification tab.

### Background and Context
The design phase is complete and approved (PRD v1.3, backend DD **v1.9**, frontend DD **v1.6**, UI Spec v1.0, ADR-0021 with its 2026-09-17 amendment note under Decision 2). Batch approval for the whole implementation phase has been granted. All three test skeleton lanes already exist on disk and must be **filled in**, never regenerated:
- integration: `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (Test 2 → task 04, Test 3 → task 14, Test 1 → task 34)
- fixture-e2e: `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` (J1 → task 23, Test 2 → tasks 24 + 30, Test 3 → task 31)
- service-integration-e2e: `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` (SE1 + SE2 → task 47 **only**)

## Resolved Decisions and Open Items (v1.3)

The v1.2 "Blocking Unresolved Items" section is removed: both engineer decisions it listed are final, and no task file carries a gate for them any more. Nothing in the plan re-opens a product decision.

| Id | Was | Resolution (final) | Where it lands |
|---|---|---|---|
| **U1** (engineer, 2026-09-17; backend DD v1.2) | Plain-RLS writes on `community_solution_helpfuls`, `community_solution_comments` and `community_content_reports` were refused by the design's own `revoke all`. | The three write tables have RLS on, every privilege revoked from `anon`/`authenticated`, **no policies and no grants**. Writes go through six `SECURITY DEFINER` RPCs: `add_`/`remove_community_solution_helpful` (task 13), `post_`/`delete_community_comment` (task 25), `report_community_solution`/`report_community_comment` (task 32). Repeats are no-ops (`added = false`, `already_reported = true`); every refusal is `42501`. The five v1.1 policies are gone from the design; no database ever received them, so no `drop policy` is needed. | 13, 15, 16, 25, 26, 27, 32, 33, 35, 47 |
| **U2** (engineer, 2026-09-17; frontend DD v1.2 DD-U1) | `ReputationBlock` placement versus the B4 import boundary. | `ProfileCard` gets exactly one optional prop, `reputationSlot?: ReactNode`; `/profile` passes `<ReputationBlock/>` from `features/solutions/components/`. `ProfileCard` imports nothing from `@/features/solutions/**`. | 44, 45 |
| **SK-1** (orchestrator, 2026-09-20) | The integration skeleton writes `moderateSolutionAction(id, "hide", reason)`; the Design Docs declare `(prevState, formData)`. | The test passes a `FormData` carrying id, `"hide"` and reason. Proof obligations (one `.rpc` with the exact RPC name, zero `.from(...)` writes, no `service-role` import) are unchanged. | 34 |
| **SK-2** (orchestrator, 2026-09-20; the engineer may overrule before task 47 starts) | The service skeleton's SE2 expects the list/detail RPCs to show the TRUE identity to an `admin_users` session; backend DD v1.6+ masks those two functions by `show_profile` alone for every caller (AC-062). | SE2's admin leg reads the same rows through `admin_list_community_reports()` and asserts the real display name and `author_is_anonymous_to_readers = true` (the skeleton's own "admin-scoped equivalent read" allowance). | 47 |
| **SN-1** (orchestrator, 2026-09-20) | Some cases are assigned to a test task earlier than the migration that creates a function they call: hidden-comment and draft/hidden-solution cases in 16 hide a comment through `admin_moderate_community_comment` (task 32); the S4 avatar assertion in 27 calls `community_avatar_owner_visible` (task 40); the hidden-solution save refusal in 05 hides a solution through `admin_moderate_community_solution` (task 32). | Until the later migration exists, the harness setup client sets `status = 'hidden'` and inserts the `community_moderation_log` `hide` row directly; the avatar assertions run in task 40 (which tests its own migration); task 35 re-runs the hidden cases through the real admin RPCs. | 05, 16, 27, 35, 40 |

Engineer-owned actions outside the task files: the six migrations (03, 13, 25, 32, 40, 41) and then the out-of-band `admin_users` seed are applied to **prod** by the engineer, in dev order, as one action before task 52 starts (`docs/project-context/external-resources.md` § Schema Change Process). No task writes to prod.

## Migration Ownership and Test-Task Rule (v1.3, binding; copied from backend DD § Migration Strategy and § Integration Verification Points)

Six migration tasks own every object exactly once: **23 SQL functions**, 1 additive column, 1 Storage policy, 111 statements (each RPC lands as `drop function if exists`, `create function`, `revoke all … from public, anon`, `grant execute … to authenticated`).

| Migration task | Test task | Objects owned |
|---|---|---|
| 03 | 05 | `is_admin_user`, `count_words`, `question_content_fingerprint`, `save_community_solution`, `set_community_solution_status`, `community_solution_for_writer`, `community_solution_result_card` (7 functions); table blocks `admin_users`, `community_solutions`, `community_solution_notes`, `community_moderation_log` |
| 13 | 16 | `community_solutions_list`, `community_solution_detail`, `set_community_solution_pin`, `add_community_solution_helpful`, `remove_community_solution_helpful` (5 functions); table block `community_solution_helpfuls`; table blocks **only** of `community_solution_comments` and `community_content_reports` (R2) |
| 25 | 27 | `post_community_comment`, `delete_community_comment`, `community_my_comment_feed` (3 functions); column `user_profiles.community_comments_last_read_at` |
| 32 | 35 | `report_community_solution`, `report_community_comment`, `admin_moderate_community_solution`, `admin_moderate_community_comment`, `admin_list_community_reports`, `admin_get_community_solution_notes` (6 functions) |
| 40 | 40 (its own) | `community_avatar_owner_visible` (1 function); Storage policy `avatars_select_community_visible` |
| 41 | 41 (its own) | `community_reputation_summary` (1 function). If 40 and 41 land in one commit, one file carries the later fingerprint and task 41 owns no separate file |

Test-task rule: migrations 03 / 13 / 25 / 32 are tested in **05 / 16 / 27 / 35**; tasks **40 and 41 test their own migrations**. Server Action unit tests (vitest, Supabase client mocked at its boundary) go in the task that writes the action: **04** (`saveSolution`, `setSolutionStatus`), **15** (`toggleHelpful`, `setPin`), **26** (comment actions), **33** (report actions). The `i_reported` case, the admin-notes case and every admin-queue case are in **35**. The three write tables get one table-closure case in each refusal group (direct insert/delete denied, zero rows changed).

## Decomposer Resolutions (deterministic rules applied without changing any design decision)

| Id | Rule | Why | Where applied |
|---|---|---|---|
| **R1** | **Skeleton lane rule.** Until a lane's skeleton gets its first real suite, run that lane with the skeleton path excluded: `npm test` → `npx vitest run --exclude "features/solutions/__tests__/communitySolutions.int.test.ts"` (until task 04; task 03 is the only open task this still applies to); `test:fixture` → `npx vitest run --config vitest.fixture.config.ts --exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` (tasks 03–22; ends at task 23); `test:localdb` → `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` (tasks 03–46; ends at task 47). Tasks 01 and 02 are done. Every other collected file must pass. Skeletons are never edited to add placeholder suites, and the exclusions are CLI flags, never edits to a vitest config file. The integration lane (`npm run test:integration`) needs no exclusion: it is green since `707df1f` (INT-1 quarantined by name, TD-034), this feature adds no file under `SOURCE/tests/integration/`, and task 50 only runs it as a regression check (must exit 0). | Verified: vitest 4.1.10 reports `Error: No test suite found in file` for the comment-only int skeleton, turning `npm test` red; `vitest.config.ts` collects `features/**`, `vitest.fixture.config.ts` collects `tests/e2e/fixture/**`, and `vitest.localdb.config.ts` collects `tests/e2e/service/**`. | QA section of every task |
| **R2** | Task 13's migration also creates the **table blocks only** (table, CHECKs, indexes, `enable row level security`, `revoke`) of `community_solution_comments` and `community_content_reports`. Their write RPCs stay in tasks 25 (`post_`/`delete_community_comment`) and 32 (`report_community_solution`/`report_community_comment`); the tables never get a policy or a grant (U1, final). | `community_solutions_list` is `language sql` and its DD-verbatim body joins `community_solution_comments` (validated at `CREATE`); `community_solution_detail` reads comments and reports. `migrationsMatchSchema.test.ts` requires every migration statement to stay verbatim in `schema.sql`, so an interim function redefined later would break the gate. | Tasks 13, 25, 32 |
| **R3** | The anonymous-**comment** M5 real-DB null-value assertion is written in task 27 (P3-T4), not task 16 (P2-T4). | No comment can be created until task 25's `post_community_comment` exists (the table has no insert path of its own). | Tasks 16, 27 |
| **R4** | Localdb-lane real-DB test files live under `SOURCE/tests/e2e/service/` as `community-solutions-{write-gate,list-order,comment-feed,reputation}.localdb.test.ts` with `describe.skipIf(!HAS_LIVE_DB)`. They are behavioural proofs, not extra service-integration-e2e journeys (SE budget stays SE1/SE2). The file of a migration's test task holds that migration's real-DB cases (05 for 03, 16 for 13, 27 for 25); task 41 tests its own migration in `community-solutions-reputation.localdb.test.ts`. | The plan names "localdb-scoped test files" without paths; `vitest.localdb.config.ts` only collects `tests/e2e/service/**`. | Tasks 05, 16, 27, 41 |
| **R5** | Every migration task lists `SOURCE/lib/schema/schemaFingerprint.ts` and `SOURCE/supabase/verify-schema.ts` (one probe per new RPC) as targets, and follows **migration statement immutability** (no later task redefines an earlier statement with different text). Migration files: `<YYYYMMDDHHMMSS>_community_solutions[_read|_comments|_moderation|_avatar_policy|_reputation]_<fingerprint>.sql`. Verify probes are judged by the error **message**, never by `error.code` alone (backend DD § Migration Strategy "Probe rule (v1.3)"). | Backend DD § Migration Strategy + `migrationsMatchSchema.test.ts`. | Tasks 03, 13, 25, 32, 40, 41 |
| **R6** | One shared unread-count formula: `countUnreadComments(rows, {solutionId?})` in `SOURCE/lib/solutions/unreadComments.ts` + `getMyUnreadCommentCount()` in `queries.ts` (pages the newest-first feed until the read boundary), both in task 26; the real-data AC-091 exclusion proof (own / S7 / S19 excluded, S8 listed but not counted) is in task 27; tasks 29 and 45 consume and re-run them. | Plan requires "one formula, two call sites" and "a test (integration or RLS)" for the exclusions; no count RPC exists and the feed is paginated; frontend executors should not author RLS tests. | Tasks 26, 27, 29, 45 |
| **R7** | `/admin`: `app/(admin)/admin/page.tsx` imports `adminActions.ts` and passes data + `onModerate` callbacks to `features/admin/components/Reported*.tsx`, which import nothing from `@/features/solutions/**`. | B4 forbids `features/admin → features/solutions`; the frontend DD already specifies `ReportedSolutionRow({ row, onModerate })`. | Task 38 |
| **R8** | Backend action tasks return copy keys (as task 04's Test 2 requires) and add any missing key to `SOURCE/lib/copy.ts` verbatim from UI Spec § "Chuỗi tiếng Việt cần thêm". Where the Design Doc contract pins a result code instead of a key (tasks 04 and 15 return codes such as `belowWordCount`, `generic`), the action returns the code and the frontend task renders the key. Task files cite keys by name, never by `lib/copy.ts` line. | `MessageKey = keyof typeof copy` makes a missing key a `tsc` error. | Tasks 04, 15, 26, 33 |
| **R9** | Supplementary per-DDL-object groups: pin group (task 16), report RPC group (task 35). | Backend DD Verification Strategy: "one refusal + one success group per new DDL object"; no plan task covered these two objects. | Tasks 16, 35 |
| **R10** | **Sign-in precondition** for every signed-in browser step: auto mode denies Playwright sign-in as the test account (project memory) — ask the engineer to log the shared Playwright CLI session in; if unavailable, stop and report. Run the Playwright CLI from inside `SOURCE/`, never during `next build`. | Project memory + user rule "never silently skip a step when a tool is missing". | Tasks 08, 10, 18, 21, 28, 38, 44, 45, 46, 49 |

Dependency labels added beyond the plan's own (each stated in the task header): task 20 + task 11 (extends `QuestionAnswerSummary`); task 24 + task 23 (driver/fixture module); task 28 + task 21 (mount point); task 29 + tasks 18, 27; task 45 + task 27; task 18 + task 04 (`getMySolutionForWriter`); task 44 + task 26. PROD apply of the six migrations and the `admin_users` seed is an **engineer** action per `docs/project-context/external-resources.md` § Schema Change Process, done before task 52; the agent only runs the Composio read-only check in task 52.

## Task Division Design

### Division Policy
The work plan's 49 `Pn-Tm` entries are already authored at ~1-commit granularity, so they are the decomposition baseline: **one task file per plan entry**, plan order preserved, dependency labels preserved. A plan entry was split only when its own "Target files" list exceeds 5 files (see § Split Decisions). Result: **53 task files** from 49 plan entries.

- Slice shape: vertical slice (engineer-specified), Hybrid per both Design Docs — one mandatory foundation slice (Phase 1) then feature-driven slices in dependency order.
- Verification levels: **L1** (end-user functional) for UI tasks that close a user journey (08, 10, 18, 21, 28, 38, 44, 45, 46, 49, 52); **L2** (new tests added and passing) for every backend RPC/action/query task and every other component task; **L3** never stands alone — the build-measurement task 48 pairs it with L2.

### Layer Determination (routing contract)
Layer is a factual determination from each task's Target files, per the orchestrator's filename routing:
- `…-backend-task-NN.md` → `task-executor` + `quality-fixer`. Backend paths: `SOURCE/supabase/**`, `SOURCE/features/solutions/{actions,adminActions,queries}.ts`, `SOURCE/features/solutions/__tests__/**`, `SOURCE/lib/security/rateLimit.ts`, `SOURCE/lib/solutions/**`, `SOURCE/lib/schema/**`, `SOURCE/scripts/**`, `SOURCE/tests/e2e/service/**`.
- `…-frontend-task-NN.md` → `task-executor-frontend` + `quality-fixer-frontend`. Frontend paths: `SOURCE/components/**`, `SOURCE/features/solutions/components/**`, `SOURCE/features/admin/components/**`, `SOURCE/features/profile/**`, `SOURCE/app/**`, `SOURCE/lib/copy.ts`, `SOURCE/lib/format/**`, `SOURCE/tests/e2e/fixture/**`, `SOURCE/eslint.config.mjs`.

Determinations restated in the task headers:
- **Task 06 (`P1-T6`, `lib/solutions/identity.ts`)** — authored by the frontend DD, but both target files live under `SOURCE/lib/solutions/**` → **backend**.
- **Tasks 50–53 (`P5-T11`…`P5-T14`)** — verification-only, no target source files, gates dominated by DB-lane/repo-wide/PROD checks → **backend**.
- **Task 49 (`P5-T10`)** — verification-only, entirely browser measurement → **frontend**.
- Backend action tasks that add a copy key to `SOURCE/lib/copy.ts` (R8) stay **backend** (majority of target files).

`{NN}` is a global zero-padded execution-order number across all 5 phases, not a per-phase counter.

### Split Decisions
| Plan entry | Reason | Resulting task files |
|---|---|---|
| `P1-T9` | Plan "Target files" lists 9 files (5 components + `ModerationReasonBanner` + 3 route files) > 5 | task **09** (4 files: prop-driven editor children `SolutionEditorHeader`/`SolutionSettingsPanel`/`NoteQuestionRow`/`SolutionPublishBar`, plus the additive `lockReasonId?: string` prop on `SettingSwitch.tsx` and the 0-question blocked "Bảng câu hỏi" trigger, DD-U4) → task **10** (5 files: `SolutionEditorScreen` reducer + `ModerationReasonBanner` alert variant + `solution/{page,loading,error}.tsx`; owns the `attemptId` URL boundary) |
| `P2-T5` | Plan "Target files" lists 7 files (4 components + 3 route files) > 5 | task **17** (3 files: `SolutionCard`/`AuthorIdentity`/`OwnSolutionBlock`) → task **18** (4 files: `SolutionList` + `solutions/{page,loading,error}.tsx` + the S11 server-side guard) |
| `P2-T6` | Plan "Target files" lists 9 files (6 components + 3 route files) > 5 | task **19** (3 files: `SolutionAuthorCard`/`HelpfulButton`/`SolutionMenu` with the pin items and the `iReported` render of the report item; the report dialog comes in task 36) → task **20** (2 files + `QuestionAnswerSummary` reader variant: `SolutionQuestionRow`/`SolutionNoteBlock`; owns Reference Contract Value #2 + server-direct `RichText`) → task **21** (4 files: `SolutionViewScreen` + `solutions/[solutionId]/{page,loading,error}.tsx`; owns the `?q`/`?comments` URL boundary) |

Each split file keeps its originating `Pn-Tm` id visible in its header (e.g. `Plan task: P2-T6 (split 2/3)`) and carries the parent entry's Acceptance criteria rows that apply to its own files. No other plan entry exceeded 5 target files; none was merged.

### Inter-task Relationship Map (execution order)

Filename prefix for every row: `20260917-feature-community-solutions`. **Status** is as of 2026-09-20 (work plan v1.3 § Task Index): 5 of 53 done. The Gate column no longer carries U1/U2 (both resolved, see § Resolved Decisions and Open Items); it names the Early Verification Points, the migration/test-task roles, the R1 exclusion endings and the open items each task touches.

| # | File | Layer | Plan task | Phase | Depends on (task #) | Status | Gate |
|---|---|---|---|---|---|---|---|
| 01 | `…-frontend-task-01.md` | frontend | P1-T1 | 1 | — (first task overall) | **DONE** `80dc246` | |
| 02 | `…-backend-task-02.md` | backend | P1-T2 | 1 | 01 | **DONE** `cc685a1` (after `08f8b1f`: `uploadExam` cap reverted to 5/day) | |
| 03 | `…-backend-task-03.md` | backend | P1-T3 | 1 | 01, 02 | 🔄 implemented + verified on dev (fingerprint `7cd454572675`), pending commit | Owns migration 03 (7 functions, 4 table blocks); real-DB cases live in 05 |
| 04 | `…-backend-task-04.md` | backend | P1-T4 | 1 | 02, 03 | open | Unit tests of `saveSolution`/`setSolutionStatus`; R1 unit exclude ends |
| 05 | `…-backend-task-05.md` | backend | P1-T5 | 1 | 03, 04 | open | Early Verification Point (backend); test task of 03; SN-1 |
| 06 | `…-backend-task-06.md` | backend | P1-T6 | 1 | 01 | **DONE** `6d656ef` | |
| 07 | `…-frontend-task-07.md` | frontend | P1-T7 | 1 | 01 | **DONE** `e4b278d` (`useModalLayer` exported from `OverlaySheet.tsx`) | |
| 08 | `…-frontend-task-08.md` | frontend | P1-T8 | 1 | 03, 04, 07 | open | Early Verification Point (frontend) |
| 09 | `…-frontend-task-09.md` | frontend | P1-T9 (split 1/2) | 1 | 01, 07 | 🔄 implemented, pending commit | Adds `SettingSwitch.lockReasonId?`, DD-U4 trigger |
| 10 | `…-frontend-task-10.md` | frontend | P1-T9 (split 2/2) | 1 | 04, 09 | open | |
| 11 | `…-frontend-task-11.md` | frontend | P1-T10 | 1 | 07, 10 | open | DD-U5 |
| 12 | `…-frontend-task-12.md` | frontend | P1-T11 | 1 | — (independent) | **DONE** `a5736cf` | |
| 13 | `…-backend-task-13.md` | backend | P2-T1 | 2 | 03 | open | Owns migration 13 (5 functions + Helpful table + comment/report table blocks, R2) |
| 14 | `…-backend-task-14.md` | backend | P2-T2 | 2 | 06, 13 | open | |
| 15 | `…-backend-task-15.md` | backend | P2-T3 | 2 | 02, 13 | open | Unit tests of `toggleHelpful`/`setPin` |
| 16 | `…-backend-task-16.md` | backend | P2-T4 | 2 | 13 | open | Test task of 13; SN-1 |
| 17 | `…-frontend-task-17.md` | frontend | P2-T5 (split 1/2) | 2 | 06, 07, 14 | open | |
| 18 | `…-frontend-task-18.md` | frontend | P2-T5 (split 2/2) | 2 | 04, 14, 17 | open | |
| 19 | `…-frontend-task-19.md` | frontend | P2-T6 (split 1/3) | 2 | 15, 17 | open | |
| 20 | `…-frontend-task-20.md` | frontend | P2-T6 (split 2/3) | 2 | 11, 14 | open | |
| 21 | `…-frontend-task-21.md` | frontend | P2-T6 (split 3/3) | 2 | 14, 19, 20 | open | |
| 22 | `…-frontend-task-22.md` | frontend | P2-T7 | 2 | 01, 21 | open | DD-U4 trigger on the view screen |
| 23 | `…-frontend-task-23.md` | frontend | P2-T8 | 2 | 10, 11, 18, 21 | open | R1 fixture exclude ends |
| 24 | `…-frontend-task-24.md` | frontend | P2-T9 | 2 | 18, 21, 23 | open | |
| 25 | `…-backend-task-25.md` | backend | P3-T1 | 3 | 03, 13 | open | Owns migration 25 (3 functions + `last_read_at` column) |
| 26 | `…-backend-task-26.md` | backend | P3-T2 | 3 | 02, 25 | open | Unit tests of the comment actions; R6 formula |
| 27 | `…-backend-task-27.md` | backend | P3-T4 | 3 | 25, 26 | open | Test task of 25; SN-1 (S4 avatar assertion runs in 40) |
| 28 | `…-frontend-task-28.md` | frontend | P3-T5 | 3 | 07, 17, 21, 26 | open | DD-U3, DD-U5 |
| 29 | `…-frontend-task-29.md` | frontend | P3-T6 | 3 | 17, 18, 25, 26, 27 | open | |
| 30 | `…-frontend-task-30.md` | frontend | P3-T7 | 3 | 24, 28 | open | |
| 31 | `…-frontend-task-31.md` | frontend | P3-T8 | 3 | 20, 28 | open | |
| 32 | `…-backend-task-32.md` | backend | P4-T1 | 4 | 03, 13, 25 | open | Owns migration 32 (6 functions) |
| 33 | `…-backend-task-33.md` | backend | P4-T2 | 4 | 02, 32 | open | Unit tests of `reportSolution`/`reportComment` |
| 34 | `…-backend-task-34.md` | backend | P4-T3 | 4 | 02, 32 | open | SK-1 |
| 35 | `…-backend-task-35.md` | backend | P4-T4 | 4 | 32 | open | Test task of 32 (report and admin RPC groups, `i_reported`, notes, queue); re-runs the SN-1 cases through the real admin RPCs |
| 36 | `…-frontend-task-36.md` | frontend | P4-T5 | 4 | 19, 33 | open | |
| 37 | `…-frontend-task-37.md` | frontend | P4-T6 | 4 | 28, 33, 36 | open | |
| 38 | `…-frontend-task-38.md` | frontend | P4-T7 | 4 | 32, 34 | open | |
| 39 | `…-frontend-task-39.md` | frontend | P4-T8 | 4 | 10, 32 | done | AC-083 read-only already existed from tasks 10/11; task 39 added the proof test + `isReadOnly` rename |
| 40 | `…-backend-task-40.md` | backend | P5-T1 | 5 | 13, 25 | open | Owns migration 40 and tests it (avatar cases for AC-004, S4, S7, AC-047, AC-048) |
| 41 | `…-backend-task-41.md` | backend | P5-T2 | 5 | 03, 13, 32 | open | Owns migration 41 and tests it (fixed vector, AC-088) |
| 42 | `…-backend-task-42.md` | backend | P5-T3 | 5 | 40 | open | Signer covers `listSolutions` and `getSolutionDetail` only |
| 43 | `…-backend-task-43.md` | backend | P5-T4 | 5 | 41 | open | |
| 44 | `…-frontend-task-44.md` | frontend | P5-T5 | 5 | 43 (+ 26) | open | `reputationSlot?: ReactNode` |
| 45 | `…-frontend-task-45.md` | frontend | P5-T6 | 5 | 26, 27, 44 | open | |
| 46 | `…-frontend-task-46.md` | frontend | P5-T7 | 5 | 40, 42 | open | |
| 47 | `…-backend-task-47.md` | backend | P5-T8 | 5 | 03, 13, 25, 32, 40, 41 | open | R1 localdb exclude ends; SK-2 |
| 48 | `…-frontend-task-48.md` | frontend | P5-T9 | 5 | 23, 30, 31 | open | |
| 49 | `…-frontend-task-49.md` | frontend | P5-T10 | 5 | all UI tasks (01, 07–12, 17–22, 28, 29, 36–39, 44–46) | open | R10 |
| 50 | `…-backend-task-50.md` | backend | P5-T11 | 5 | 01–49 | open | Also runs `npm run test:integration` (must exit 0; INT-1 stays quarantined, TD-034); no `--exclude` flags left |
| 51 | `…-backend-task-51.md` | backend | P5-T12 | 5 | 02, 32, 34 (after 50) | open | Diff base `af05f28` |
| 52 | `…-backend-task-52.md` | backend | P5-T13 | 5 | 03, 13, 25, 32, 40, 41 and the `admin_users` seed applied to PROD by the engineer; 47 | open | Composio MCP (read-only) |
| 53 | `…-backend-task-53.md` | backend | P5-T14 | 5 | 01–52 | open | |

Non-task commit on the branch: `707df1f` — the INT-1 quota tests moved to `SOURCE/tests/integration/pending/subscription-quota.int.test.ts` and excluded by name in `SOURCE/vitest.integration.config.ts` (TD-034), so `npm run test:integration` exits 0. No task re-enables INT-1 or edits that config.

### Dependency Graph (execution edges)

```
Phase 1: 01 ─┬─ 02 ── 03 ── 04 ── 05            (05 = backend Early Verification Point; 01, 02, 06, 07, 12 are DONE)
             ├─ 06
             ├─ 07 ─┬─ 08                       (08 also needs 03, 04; frontend EVP)
             │      └─ 09 ── 10 ── 11            (10 also needs 04)
             └─ 12 (independent)
Phase 2: 03 ── 13 ─┬─ 14 ─┬─ 17 ── 18 (+04) ──┐
                   │      └─ 20 (+11) ─┐       ├─ 23 ── 24
                   ├─ 15 ── 19 (+17) ──┴─ 21 ─┴─ 22
                   └─ 16
Phase 3: 03,13 ── 25 ── 26 ─┬─ 27 ─────────────┐
                            ├─ 28 (+07,17,21) ─┼─ 30 (+24)
                            │                  └─ 31 (+20)
                            └─ 29 (+17,18,27)
Phase 4: 03,13,25 ── 32 ─┬─ 33 ── 36 (+19) ── 37 (+28)
                         ├─ 34 ── 38
                         ├─ 35
                         └─ 39 (+10)
Phase 5: 13,25 ── 40 ── 42 ── 46
         03,13,32 ── 41 ── 43 ── 44 ── 45 (+26,27)
         03,13,25,32,40,41 ── 47 ── 52
         23,30,31 ── 48 ;  all UI ── 49 ;  01–49 ── 50 ── 51 ;  01–52 ── 53
```

The v1.2 "U1 resolved" and "U2 resolved" gate lines are gone from the graph: both decisions are final and no task waits on them (the tasks they touched keep only their normal edges).

Phase boundaries are hard: Phase N+1's first task does not start until Phase N's completion file is signed off.

### Interface Change Impact Analysis
| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|---|---|---|---|
| `features/exams/components/QuestionPaletteDock` (`answeredIndices`, `flaggedIndices`) | `components/shared/QuestionPaletteDock` (+ optional `cells?`, `triggerLabel?`, `panelTitle?`, `panelMeta?`) | No — additive/optional; `ExamPlayer.tsx` keeps its 2 props, only its 2 import lines change | 01 (09, 22 consume) |
| `features/exams/components/QuestionPagination` | `components/shared/QuestionPagination` | No — import path only | 01 |
| `copy.common.share` = "Chia sẻ" | "Xuất PDF" (+ `history.sharing`, `result.essay.pdfBlocked`; `history.shareUnsupported` removed) | Yes — 10 pinned assertions updated in the same commit | 12 |
| `SupportWidgetTrigger` hide selector (`data-filter-sheet`) | also `[data-app-overlay]` | No — additive clause | 07 |
| `ModerationReasonBanner` (status variant) | + `alert` variant | No — additive | 08 → 10, 39 |
| `SettingSwitch` (task 07) | + optional `lockReasonId?: string` (`aria-describedby` = description id, then the lock-reason id) | No — additive; every existing `SettingSwitch.test.tsx` case stays green | 09 (10 uses it) |
| `SolutionMenu` (pin/edit) | + report item ("Báo cáo bài giải", or the `iReported` "Bạn đã báo cáo bài giải này." state) | No — additive; the report dialog lands in task 36 | 19 → 36 |
| `user_profiles` | + `community_comments_last_read_at timestamptz` | No — additive nullable | 25 |
| Storage policy `avatars_select_own` | + sibling `avatars_select_community_visible` | No — additive | 40 |
| `ProfileCard({ user })` | `ProfileCard({ user, reputationSlot? })`, `reputationSlot?: ReactNode` (U2, final) | No — one additive optional prop; `/profile` passes `<ReputationBlock/>` from `features/solutions/components/`; no slot renders exactly as today | 44 |

### Common Processing Points (avoid duplicate implementation)
- `countWords()` (`SOURCE/lib/solutions/countWords.ts`, task 04) is the single TS twin of SQL `count_words()`; task 05 proves agreement on real DB; task 11 imports it.
- `toAuthorIdentity()`/`toScoreField()` (`SOURCE/lib/solutions/identity.ts`, task 06) is the only masking mapper; tasks 14, 17, 19, 26, 28, 42, 46 route through it.
- `OverlaySheet`/`ConfirmDialog`/`AnonymousAvatar`/`SettingSwitch`/`relativeTime` (task 07) are built once and reused by tasks 09–11, 17, 28, 36, 38.
- `ReportDialog` is created once in task 36 and reused by task 37 (`variant="comment"`).
- `ModerationReasonBanner` — one component, two variants (tasks 08, 10, 39).
- Unread-comment count — one formula + one paging helper (task 26, R6), two call sites (tasks 29, 45).
- Relocated `QuestionPaletteDock` — one component for the write screen (task 09) and view screen (task 22).
- Error mapping for Server Actions — one mapper established in task 04 and reused by tasks 15, 26, 33. Every action reads `error.details` only for `23514` on `saveSolution` (exact `below_word_count`) and `setSolutionStatus` (decimal missing count, parse-int ≥ 1); `error.message` is never read; `42501` maps to `generic`.
- `RATE_LIMITS` — done in `cc685a1`; the 11 keys are in place and no task edits `SOURCE/lib/security/rateLimit.ts` again.

## Implementation Considerations

### Principles to Maintain Throughout
1. **Task 01 gates the whole feature.** No file under `SOURCE/features/solutions/` (other than the pre-existing int skeleton) is created before task 01 lands (`QuestionPaletteDock`/`QuestionPagination` relocated to `SOURCE/components/shared/`, `'solutions'` added to `SOURCE/eslint.config.mjs` `FEATURES`).
2. **TD-029 is absolute.** No task adds a 14th exported operation or a 5th direct write surface to `SOURCE/lib/supabase/service-role.ts`; `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` stays green with zero modification. Admin moderation goes through `admin_users` / `is_admin_user()` + dedicated RPCs (ADR-0021). Explicit re-run criteria: tasks 03, 05, 32, 34, 35, 38, 47, 51.
3. **ADR-0002 is absolute.** Notes and comments render only through `SOURCE/components/shared/RichText.tsx`. XSS fixtures: note group (task 11), comment group (task 28), browser-level proof (task 31), static-import guard + bundle read (task 48).
4. **Migration chain is fixed and per-phase** (tasks 03, 13, 25, 32, 40, 41): edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` (+ §17 `schema_version` upsert) → fingerprint-named migration file → `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. Each migration task owns exactly the objects in § Migration Ownership and the test task named there proves them against real dev Postgres. PROD: the engineer applies all six migrations in dev order, then the out-of-band `admin_users` seed, as one separate action before task 52; the agent only reads prod, in task 52, via Composio MCP.
5. **Vietnamese UI strings go through `SOURCE/lib/copy.ts`** (UI Spec § "Chuỗi tiếng Việt cần thêm"). Mobile-first, 360px floor; theme "Đêm hội" using only tokens in `SOURCE/app/globals.css`; 44px touch targets (56px question rows); motion only via existing `.motion-*` classes and `usePresence`; never fade page content on load.
6. **`features/solutions/{queries,actions,adminActions}.ts` is the sole data entry point for components.** Fixture-e2e tests mock at that module boundary and leave `lib/solutions/identity.ts` + `RichText` real.

### Risks and Countermeasures
- Risk: R1 gate in `save_community_solution()` diverges from `exam_answer_key()`. Countermeasure: task 05 (backend Early Verification Point) stops the plan on divergence.
- Risk: longest entry-card label clips at 360px. Countermeasure: task 08 (frontend Early Verification Point) stops Phase 1 write-screen tasks; task 49 re-measures.
- Risk: a user-write RPC is reachable by an ineligible caller, or a closed write table (Helpful, comments, reports) regains a policy or grant. Countermeasure: U1 is final (six `SECURITY DEFINER` RPCs, no policies, no grants); each refusal group in tasks 16, 27 and 35 includes a table-closure case; executors may not invent grants or policies.
- Risk: `ProfileCard` grows past its one new prop or imports `features/solutions/**`. Countermeasure: U2 is final (`reputationSlot?: ReactNode`); `ProfileCard.test.tsx` covers the slot-filled and no-slot cases (task 44).
- Risk: an executor re-enables INT-1 or edits `SOURCE/vitest.integration.config.ts`. Countermeasure: `707df1f` quarantined INT-1 (TD-034); no task in this feature touches that lane except task 50's regression run.
- Risk: static `RichText` import in a client file (+~122KB gzip). Countermeasure: task 48 grep test + `next build` manifest read.
- Risk: `admin_users` membership drift dev/prod. Countermeasure: dev seed in task 03; prod seed by engineer + count check in task 52.
- Risk: migration on dev but not prod (TD-005 history). Countermeasure: task 52 fingerprint equality is the feature-closing gate.
- Risk: localdb lane flakes when dev DB is slow. Countermeasure: re-run the failing file alone once before treating it as a defect (tasks 47, 50).

### Impact Scope Management
- **Allowed change scope**: the work plan's § Review Scope path list, plus the decomposer-named supporting files (localdb test files per R4, `SOURCE/lib/solutions/unreadComments.ts` per R6, fixture/service fixture modules, component test files, `SOURCE/supabase/verify-schema.ts` and `SOURCE/lib/schema/schemaFingerprint.ts` per R5, `SOURCE/components/support/SupportWidgetTrigger.tsx` one-line selector, deliverables under `docs/plans/analysis/`).
- **Preserved areas (never modified)**: `SOURCE/lib/supabase/service-role.ts`; assertions in `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`; `SOURCE/features/admin/components/ModerationRow.tsx` and the existing exam-report section; `SOURCE/components/shared/Avatar.tsx`; `SOURCE/components/shared/RichText.tsx`; `SOURCE/features/exams/components/ExamPlayer.tsx` beyond its 2 import lines; `exam_reports`/`exam_moderation_log`/`moderateExam()`; `avatars_select_own`; `SOURCE/features/exams/components/ReportExam.tsx`; `SOURCE/features/authoring/components/QuestionEditor.tsx` (pattern model only); `SOURCE/vitest.integration.config.ts` and `SOURCE/tests/integration/pending/` (INT-1 quarantine, `707df1f`, TD-034).
- **Uncommitted engineer changes that must never be staged, reverted, or cleaned by any executor**: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, plus the already-modified `docs/project-context/external-resources.md` and `SOURCE/app/layout.tsx` (read-only for this feature). Always run `git status` before any `checkout`/`restore`/`reset`/`clean`; stage only the current task's own files by explicit path (never `git add -A` / `git add .`).
- Branch: `feat/community-solutions` (branched from `af05f28` = `origin/main`; `af05f28` is the diff base in task 51).

## Progress Tracking (updated by the orchestrator after each task commit)

- [ ] Phase 1 — tasks 01–12 (plan P1-T1…P1-T11: 11 entries → 12 files): **12/12 done** — 01 `80dc246`, 02 `cc685a1`, 03 `74ba95b` (fingerprint corrected `4b0ea52`, AC-022 data gap), 04 `e25e1b6`, 05 `c4dfddf`, 06 `6d656ef`, 07 `e4b278d`, 08 `27d61cd` (360px measurement deferred), 09 `18bd280`, 10 `b2b01fb` (L1 browser flow deferred), 11 `dc309eb`, 12 `a5736cf` — Phase 1 COMPLETE; 2 live-browser measurements still owed before Phase 1 is visually signed off (task 08's 360px, task 10's write→publish flow) — completion file `20260917-feature-community-solutions-phase1-completion.md`
- [x] U1 resolved (engineer decision 2026-09-17, backend DD v1.2) — no gate
- [x] Phase 2 — tasks 13–24 (plan P2-T1…P2-T9: 9 entries → 12 files): **12/12 done — PHASE 2 COMPLETE (2026-09-26)** — 13 `e74b64a`, 14 `b3492c9`, 15 `a2a7e36` (kept task 04's `SILENT_RPC_ERROR_CODES` after engineer-reviewed conflict), 16 `ac068cf` (real-DB proof migration 13), 17 `cbf17de`, 18 `0526f18` (P2-T5), 19 `daef762`, 20 `4c5470d`, 21 `d04b245` (P2-T6, 2 engineer-resolved escalations), 22 `06e8479` (P2-T7), 23 `1abbe87` (P2-T8, fixed a real task-10 bug, `test:fixture` no longer needs `--exclude`), 24 `a8cb29e` (P2-T9). Phase-end gate re-run clean 2026-09-26 (tsc/lint/test/build/fixture/localdb/test-rls, only 4 pre-existing unrelated Rating-section reds). Full detail and open follow-ups in `20260917-feature-community-solutions-phase2-completion.md`
- [x] Phase 3 — tasks 25–31 (plan P3-T1, T2, T4, T5, T6, T7, T8 → 7 files): **7/7 done — PHASE 3 COMPLETE (2026-09-26)** — task 25 `00dcc38` (migration fingerprint `9a0ac5d5fc49` — `post_community_comment`/`delete_community_comment`/`community_my_comment_feed` + `user_profiles.community_comments_last_read_at` no-default column, verified via direct dev-DB queries by quality-fixer; `community_solution_comments` still 0 policies/0 grants; real-DB behavioral tests deferred to task 27 by design), task 26 `1a2939e` (`postComment`/`deleteComment`/`markCommentsRead`/`getMyCommentFeed` + shared `countUnreadComments`/`getMyUnreadCommentCount` — the one formula tasks 29/45 both reuse; paging early-termination logic and `isUnread && examVisible` guard both mutation-tested by quality-fixer), task 27 `8fab6aa` (test task of migration 25 — comment RPC groups incl. table-closure, M5 comment half + S4, feed columns/unread cursor/ordering/AC-091 exclusion proof; found+fixed a real clock-skew race in the unread-cursor test across 2 reviewer rounds; **flagged for engineer**: production `markCommentsRead()` may share the same latent hazard, not fixed here), task 28 `584730c` (`CommentSheet`/`CommentItem`/`CommentComposer` + XSS fixture group; masked-own-row/`lockedAnonymous`/DD-U3/DD-U5 all mutation-verified across 2 reviewer rounds, one required fix applied for the lockedAnonymous composite proof; L1 deferred), task 29 `90a2f69` (unread-comment red dot on the writer's own `SolutionCard`; reuses task 26's `countUnreadComments`/`getMyUnreadCommentCount` formula verbatim, count-derivation test confirmed wired to the real formula not a hand-typed number, task 27's real-DB exclusion proof re-confirmed twice more), task 30 `e71b258` (fixture-e2e Test 2 finalize — O-02 comment-sheet portion; named/anonymous/writer-also-anonymous comment rows opened via the real `?q=1&comments=1` deep link; RED-phase proof independently re-run by reviewer; skeleton Test 2 fully closed — J1+S-03+S-05+O-02 all green together), task 31 `49f67d8` (fixture-e2e Test 3 — shared XSS payload applied to a note fixture and a comment fixture, opened together, `assertPayloadInert` checked independently per subtree; RED-phase proof for both surfaces; quality-fixer-frontend re-verified all gates incl. production build and localdb lane — **skeleton fully closed, J1+Test 2+Test 3 all green together (16/16)**). Phase-end gate re-run clean 2026-09-26 (tsc/lint/test/build/fixture/verify:schema/localdb/test-rls, only 4 pre-existing unrelated Rating-section reds). Full detail and open follow-ups in `20260917-feature-community-solutions-phase3-completion.md`
- [x] Phase 4 — tasks 32–39 (plan P4-T1…P4-T8 → 8 files): **8/8 done — PHASE 4 COMPLETE (2026-09-27)** — task 32 `c6a3e85` (P4-T1, migration §23: 6 SECURITY DEFINER functions — 2 report RPCs, 2 admin moderation RPCs, `admin_list_community_reports`, `admin_get_community_solution_notes`; fingerprint `9a0ac5d5fc49` → `cb08928767f8`; admin gate order proven by 16 message-judged probes incl. 4 gate-order probes closing a real gap found across 3 integration-test-reviewer rounds; TD-029 clean; behavioral real-DB tests deferred to task 35 by design), task 33 `6caa349` (P4-T2, `reportSolution`/`reportComment` in `actions.ts` — shared `validateReportReason` helper, no `23505` branch in the new code, RPC's own `already_reported` copied verbatim for repeats, AC-075 mutation-verified via method-log check, report reason never logged; 18 unit tests, quality-fixer re-ran all constraints independently), task 34 `8434ca0` (P4-T3, `adminActions.ts` + skeleton Test 1 — admin gate always before RPC, server re-validates action/reason from FormData per SK-1, no masking mapper on the admin path, log contract proven both directions (42501 logged with RPC+code, 22023/P0002 silent); skeleton `communitySolutions.int.test.ts` all 3 tests green together 29/29, 9 mutation tests confirmed red at the right assertion), task 35 `c3e5024` (P4-T4, real-DB behavioral tests for all 6 task-32 RPCs in `test-rls.ts` Phần 13 — 99 checks green: AC-085 admin gate incl. delete-action refusal, AC-084 cascade+log, RCV #26 hidden-solution-stays-in-queue, RCV #16 admin notes shape, per-caller `i_reported`, report table-closure/AC-004, anonymity flags, name-resolution regression; SN-1 re-ran tasks 05/16/27's hidden fixtures through real admin RPCs instead of the harness setup client; real dev-admin session (magic-link, not service-role) now revoked in try/finally even on crash; zero schema.sql changes), task 36 `ea29cae` (P4-T5, "Báo cáo bài giải" + `ReportDialog` — reported state seeded-from-server per frontend DD, flips only on RPC success for either `alreadyReported` value, own-author has no report item, identical DOM branch for seed vs in-session flip; 13 tests, RED-phase re-confirmed via `git stash`; first frontend task of Phase 4), task 37 `8d3f7bb` (P4-T6, "Báo cáo" in `CommentItem` reusing `ReportDialog` variant="comment" verbatim — AC-076 "same dialog, same rules"; own-hidden-admin row keeps no control of either kind; 8 tests + 2 task-28 placeholder tests updated to the now-correct behavior (both files explicitly earmarked this to task 37); RED-phase re-confirmed via `git stash`), task 38 `bb72d48` (P4-T7, admin report queue on `/admin` — 3 new B4-clean components, "Xoá hẳn" always confirmed with the exact consequence line, reason required incl. whitespace-only on every hide/delete path, form fields match `adminActions.ts` exactly, no `avatarUrl` (compile-time proof), no "Bỏ qua" (AC-109), hidden-zero-report row still queued (RCV #26); 2 reviewer rounds closed 3 real permanent-delete gaps AND caught+fixed a real double-submit bug (`if (pending) return` guard); L1 still blocked pending engineer sign-in), task 39 `856de3c` (P4-T8, final Phase 4 task — investigation found the AC-083 read-only behavior already fully wired by tasks 10/11 (`ModerationReasonBanner` alert banner, `NoteSheet` readOnly/hiddenReason, `SolutionPublishBar`'s own `status === "hidden" → null`, `SolutionSettingsPanel`'s `lockReasonId`); this task added 2 explicit proof tests to `SolutionEditorScreen.test.tsx` (no Lưu/Đăng/Gỡ + alert banner; open-row shows the note with no textarea/save control) and renamed the single derived flag `hidden` → `isReadOnly`; RED-phase proof done by temporarily disabling the guard mechanism itself, since no uncommitted implementation diff existed to `git stash`; full `npm test` 2574 passed/10 pre-existing skips, `test:fixture` 16/16, `lint`/`tsc --noEmit` clean). Phase-end gate re-run clean 2026-09-27 (tsc/lint/test/build/fixture/verify:schema/localdb/test-rls; only 4 pre-existing unrelated Rating-section reds + 1 confirmed-flaky test that passes in isolation). Full detail and open follow-ups in `20260917-feature-community-solutions-phase4-completion.md`
- [x] U2 resolved (engineer decision 2026-09-17, frontend DD v1.2 DD-U1) — no gate
- [ ] Phase 5 — tasks 40–53 (plan P5-T1…P5-T14 → 14 files): 0/14 — `…-phase5-completion.md`
- [ ] **Total: 39/53 task files complete (39/49 plan entries)**. Non-task commits also on the branch, not counted: `707df1f` (INT-1 quarantine, TD-034), `4b0ea52` (post-commit fix to task 03's migration, AC-022 data gap), `06b12ed` (post-Phase-2 fix to task 13's migration — `community_solution_detail` had the same AC-022-class gap, engineer-approved after discovering it conflicted with task 16's already-verified 7-key contract; backend DD bumped to v1.10, Reference Contract Value #14 now 11 keys). Pre-existing, unrelated to any task: 2 TD-016 `verify:schema` failures (non-canonical `subject` "Toán" on leftover `rls-*` test rows on dev; fix script exists at `supabase/one-off/2026-08-14-td016-canonical-subject.sql`, engineer's call).
