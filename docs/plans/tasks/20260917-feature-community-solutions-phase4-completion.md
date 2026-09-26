# Phase 4 Completion: Báo cáo + Kiểm duyệt admin + Trang quản trị

- **Plan**: `docs/plans/20260917-feature-community-solutions.md` (§ Phase 4)
- **Overview**: `docs/plans/tasks/_overview-20260917-feature-community-solutions.md`
- **Value delivered (plan)**: readers can report a solution or comment; admin can see the report queue in `/admin` and hide/restore/hard-delete with an audit log — all without touching `SOURCE/lib/supabase/service-role.ts`. Integration Test 1 created here.
- **Entry precondition**: Phase 3 completion signed off.
- **Migration in this phase (plan v1.3)**: task 32 owns 6 functions — `report_community_solution`, `report_community_comment`, `admin_moderate_community_solution`, `admin_moderate_community_comment`, `admin_list_community_reports` (queue row columns incl. `author_is_anonymous_to_readers`; a hidden solution stays in the queue), `admin_get_community_solution_notes` (3 columns). There is no table policy on `community_content_reports` (the v1.1 `community_reports_insert_own` policy is not written). Its test task is 35; Server Action unit tests for `reportSolution`/`reportComment` are in 33.
- **Status**: **8/8 task files done — PHASE 4 COMPLETE (2026-09-27)**.

## Task Completion Checklist

| Done | # | File | Layer | Plan task | Commit |
|---|---|---|---|---|---|
| [x] | 32 | `20260917-feature-community-solutions-backend-task-32.md` | backend | P4-T1 | `c6a3e85` |
| [x] | 33 | `20260917-feature-community-solutions-backend-task-33.md` | backend | P4-T2 | `6caa349` |
| [x] | 34 | `20260917-feature-community-solutions-backend-task-34.md` | backend | P4-T3 | `8434ca0` |
| [x] | 35 | `20260917-feature-community-solutions-backend-task-35.md` | backend | P4-T4 | `c3e5024` |
| [x] | 36 | `20260917-feature-community-solutions-frontend-task-36.md` | frontend | P4-T5 | `ea29cae` |
| [x] | 37 | `20260917-feature-community-solutions-frontend-task-37.md` | frontend | P4-T6 | `8d3f7bb` |
| [x] | 38 | `20260917-feature-community-solutions-frontend-task-38.md` | frontend | P4-T7 | `bb72d48` |
| [x] | 39 | `20260917-feature-community-solutions-frontend-task-39.md` | frontend | P4-T8 | `856de3c` |

Plan progress: 8/8 plan entries → 8 task files.

## Phase Exit Criteria (verbatim from plan)

"Integration Test 1 green; `serviceRoleSurface.test.ts` unmodified/green; `test-rls.ts` admin group green (all 4 RPCs); an admin can see and act on the report queue end-to-end against real Postgres, with zero touch to `service-role.ts` anywhere in this phase's diff."

- [x] `git diff` of this phase's commits shows zero change to `SOURCE/lib/supabase/service-role.ts` and to `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` — re-confirmed by every task's quality-fixer and independently in the phase-end gate re-run
- [x] AC-084 hard-delete cascade + single complete log row proven on real DB (task 35 — dependents counted before/after, exactly 1 log row with non-null `exam_id`/`target_user_id`)
- [x] `report_community_solution` / `report_community_comment` refusal + success groups green, each with a table-closure case (task 35); the four admin RPC groups green with the reason/transition cases and one log row per accepted call
- [x] `i_reported` per-caller case, `admin_get_community_solution_notes` shape, admin-queue cases (hidden comments, hidden solution stays in the queue, anonymity flags) and name-resolution regression green (task 35); the SN-1 hidden cases re-run through the real admin RPCs
- [x] Report actions unit-tested in task 33 (`alreadyReported` copied as-is, empty reason calls no RPC, `42501` → `generic`, a 1200-character reason sent cut to 1000); Test 1 in task 34 passes a `FormData` (SK-1)
- [x] `/admin` Reported* components import nothing from `@/features/solutions/**` (B4; task 38 wiring rule) — re-verified by source read in 2 integration-test-reviewer rounds

## Test Skeleton Files to Verify at Phase End

| Skeleton | Tests implemented by end of Phase 4 | Result (2026-09-27 re-run) |
|---|---|---|
| `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` | Test 1 (task 34), Test 2, Test 3 | green together, 29/29 (part of `npm test`) |
| `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` | J1, Test 2, Test 3 | green, 16/16 (`npm run test:fixture`) |
| `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` | none | comment-only; excluded from `test:localdb` per R1 (unchanged, task 47) |

Phase-4-created test files: `SOURCE/features/solutions/__tests__/reportActions.test.ts` (task 33); `SOURCE/features/solutions/components/__tests__/{SolutionMenu,CommentItem}.test.tsx` extensions + new `ReportDialog` coverage (tasks 36-37); admin component tests under `SOURCE/features/admin/components/__tests__/` (task 38, 80 tests); `SolutionEditorScreen.test.tsx` extension (task 39); new "Phần 13" groups in `SOURCE/supabase/test-rls.ts` (task 35, 99 checks).

## Phase-End Gate Commands (run inside `SOURCE/`) — re-run 2026-09-27

1. `npx tsc --noEmit` — ✅ clean, no output
2. `npm run lint` — ✅ clean (`eslint --max-warnings 0`)
3. `npm test` — 1 transient failure on first run (`CommentSheet.test.tsx:92`, a `findByText` racing a dynamic-import chunk under parallel worker load — the known pre-existing flake documented since task 31); re-ran that file alone → 6/6 green. Full suite otherwise: 192/193 files, 2573/2584 tests passed, 10 pre-existing skips
4. `npm run build` — ✅ compiled successfully, 22/22 static pages generated
5. `npm run test:fixture` — ✅ 2 files, 16/16 (J1 + Test 2 + Test 3 together)
6. `npm run verify:schema` then `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` — ✅ schema matches dev (fingerprint `cb08928767f8`), no TD-016 issues this run; localdb lane 6 files, 31/31, against the real dev DB
7. `npx tsx supabase/test-rls.ts` — 4 checks failed: `R-p`/`R-r`/`R-t`/`R-u` (Rating section) — **pre-existing, unrelated to Bài giải cộng đồng**, confirmed across every phase so far; every Community Solutions group (incl. the new Phase 4 admin/report/queue groups) passed

Net result: **all Phase 4 gates pass**; the only reds are the 4 known pre-existing Rating-section cases and one confirmed-flaky test that passes in isolation, both out of scope.

## Before Starting Phase 5

- The v1.2 "Blocking Unresolved Item U2" gate is removed: U2 is resolved (engineer decision 2026-09-17, frontend DD v1.2 DD-U1) — `ProfileCard` gets `reputationSlot?: ReactNode` and `/profile` passes `<ReputationBlock/>` from `features/solutions/components/`. Task 44 waits only on tasks 43 and 26.
- Engineer action, needed before task 52 (not before task 40): apply the six migrations (03, 13, 25, 32, 40, 41) to prod in dev order, then the out-of-band `admin_users` seed.
- [x] Progress record updated in this file, the work plan, the overview, and `community-solutions-HANDOFF.md`.
- [ ] Notion row (`3de78ba6-ae12-8175-97d7-c6c88cf8c79d`) still needs a manual status update — not automated in this session.

## Notes

- **Carried-forward, non-blocking items owed to the engineer**:
  - **L1 (real `/admin` on dev via Playwright) still blocked** (task 38) — needs the engineer to sign the shared Playwright CLI session in first, then: sign in as dev admin, create a report as a test user, hide → restore → hard-delete from `/admin`, confirm non-admin gets 404.
  - **`test-rls.ts` now signs into the real dev admin account** (task 35, `a9be2b48…`) via a magic-link token each run (not service-role), signed out in try/finally even on crash. Not a security issue but worth the engineer's awareness before running the file manually; would only touch prod if `SCHEMA_ENV_FILE` pointed there, which nothing in the repo does.
  - **Double-submit bug found and fixed** (task 38): `ModerationReasonForm.confirmDelete` (shared by `ReportedSolutionRow`/`ReportedCommentItem`) had no guard against a second confirm click during the ConfirmDialog's ~150ms close animation, which would have fired the delete RPC twice. Fixed with `if (pending) return;`, verified by a real RED→GREEN test.
  - **Form field naming discrepancy** (task 34→38): `moderateSolutionAction`/`moderateCommentAction` FormData uses `solutionId`/`commentId`, not the `id` the frontend DD's UI Action mapping named — task 38's form was built against the actual shipped `adminActions.ts` shape, which is authoritative here.
  - Unchanged from earlier phases: production `markCommentsRead()`'s latent clock-skew hazard (task 27, not fixed); `SolutionMenu`'s AC-051 palette-only highlight needs an explicit engineer sign-off (task 22); FormulaPreview flake elevated in severity; 2 TD-016 `verify:schema` non-canonical-subject rows (fix script exists, engineer's call).
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `docs/project-context/external-resources.md`, `SOURCE/app/layout.tsx`.
