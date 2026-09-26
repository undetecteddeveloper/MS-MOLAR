# Phase 3 Completion: Bình luận (Viết/Xoá/Ẩn danh) + Tấm trượt bình luận + Thông báo nhẹ

- **Plan**: `docs/plans/20260917-feature-community-solutions.md` (§ Phase 3)
- **Overview**: `docs/plans/tasks/_overview-20260917-feature-community-solutions.md`
- **Value delivered (plan)**: per-question comments work end-to-end (post/delete, per-comment anonymity, S4's "Người viết" exception), plus the light in-web notification signal (D21). fixture-e2e Test 2 finalized and Test 3 (XSS) lands here.
- **Entry precondition**: Phase 2 completion signed off.
- **Migration in this phase (plan v1.3)**: task 25 owns 3 functions (`post_community_comment`, `delete_community_comment`, `community_my_comment_feed` with its ten columns) and the column `user_profiles.community_comments_last_read_at`. The comment table block already exists from task 13 (R2); there is no table policy. Its test task is 27; Server Action unit tests for the comment actions are in 26.
- **Status**: **7/7 task files done — PHASE 3 COMPLETE (2026-09-26)**.

## Task Completion Checklist

| Done | # | File | Layer | Plan task | Commit |
|---|---|---|---|---|---|
| [x] | 25 | `20260917-feature-community-solutions-backend-task-25.md` | backend | P3-T1 | `00dcc38` |
| [x] | 26 | `20260917-feature-community-solutions-backend-task-26.md` | backend | P3-T2 | `1a2939e` |
| [x] | 27 | `20260917-feature-community-solutions-backend-task-27.md` | backend | P3-T4 | `8fab6aa` |
| [x] | 28 | `20260917-feature-community-solutions-frontend-task-28.md` | frontend | P3-T5 | `584730c` |
| [x] | 29 | `20260917-feature-community-solutions-frontend-task-29.md` | frontend | P3-T6 | `90a2f69` |
| [x] | 30 | `20260917-feature-community-solutions-frontend-task-30.md` | frontend | P3-T7 | `e71b258` |
| [x] | 31 | `20260917-feature-community-solutions-frontend-task-31.md` | frontend | P3-T8 | `49f67d8` |

Plan progress: 7/7 plan entries (P3-T1, T2, T4, T5, T6, T7, T8) → 7 task files. (The plan has no P3-T3.)

Also on the branch, not counted in the 7: `06b12ed` (post-Phase-2 independent fix, `community_solution_detail` 4-column gap — see HANDOFF § Sự cố đã xử lý).

## Phase Exit Criteria (verbatim from plan)

"comments post/delete/anonymize end-to-end against real Postgres; `RichText.xss.test.tsx` green for both note and comment fixture groups; fixture-e2e Test 2 (full) and Test 3 green."

- [x] Task 25 migration applied to dev (3 functions + `last_read_at` column, no table policy); `post_community_comment` and `delete_community_comment` refusal + success groups, each with a table-closure case, green (task 27) — re-confirmed live via `npx tsx supabase/test-rls.ts` 2026-09-26
- [x] Anonymous-comment M5 null-value assertion and the S4 writer-comment case green on real DB (task 27, R3); the S4 avatar assertion (`community_avatar_owner_visible`) still deferred to task 40 (SN-1, unchanged)
- [x] Feed columns, unread cursor (`is_unread`, `exam_visible`, new-count 2 → 0 → 1) and AC-004 / AC-002 / name-resolution cases green (task 27)
- [x] AC-091 exclusion proof green on real data (task 27, R6) and shared formula tests green (task 26: `isUnread && examVisible`, per-`examId`, paging stops at the first read row)
- [x] Comment actions unit-tested in task 26 (empty/over-long body calls no RPC; `42501`/`23514` → `generic`; no comment body logged)
- [x] Unread badge only on the viewer's own card, no layout query (task 29, D38/AC-094)

## Test Skeleton Files to Verify at Phase End

| Skeleton | Tests implemented by end of Phase 3 | Result (2026-09-26 re-run) |
|---|---|---|
| `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` | Tests 2, 3 | green (part of `npm test`, 188 files / 2464 tests passed); Test 1 still a comment block |
| `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` | J1, Test 2 (S-03/S-05/O-02, tasks 24+30), Test 3 (task 31) | **green together, 16/16** (`npm run test:fixture`, 2 files passed) |
| `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` | none | comment-only; excluded from `test:localdb` per R1 (unchanged, task 47) |

Phase-3-created test files: `SOURCE/tests/e2e/service/community-solutions-comment-feed.localdb.test.ts` and new groups in `SOURCE/supabase/test-rls.ts` (task 27), `SOURCE/features/solutions/__tests__/commentActions.test.ts` and `SOURCE/lib/solutions/__tests__/unreadComments.test.ts` (task 26); `RichText.xss.test.tsx` comment group (task 28), extended by task 31's Test 3 companion re-run (26/26).

## Phase-End Gate Commands (run inside `SOURCE/`) — re-run 2026-09-26

1. `npx tsc --noEmit` — ✅ clean, no output
2. `npm run lint` — ✅ clean (`eslint --max-warnings 0`)
3. `npm test` — ✅ 188 passed | 1 skipped (189 files); 2464 passed | 10 skipped (2474 tests); none of the known flakes (FormulaPreview*, CommentItem/SolutionViewScreen race) showed up this run
4. `npm run build` — ✅ compiled successfully, 22/22 static pages generated
5. `npm run test:fixture` — ✅ 2 files passed, 16/16 tests (J1 + Test 2 ×3 + Test 3, all together)
6. `npm run verify:schema` then `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` — ✅ schema matches dev (23 SQL functions, additive column, §17 fingerprint `9a0ac5d5fc49`); localdb lane 6 files passed, 31/31 tests, against the real dev DB
7. `npx tsx supabase/test-rls.ts` — 4 checks failed: `R-p`/`R-r`/`R-t`/`R-u` (Rating section) — **pre-existing, unrelated to Bài giải cộng đồng**, confirmed across multiple independent reviews in Phase 2/3; every Community Solutions RLS/RPC group in the file passed

Net result: **all Phase 3 gates pass**; the only reds are the 4 known pre-existing Rating-section cases, out of scope.

## Before Starting Phase 4

- [x] Progress record updated in this file, the work plan, the overview, and `community-solutions-HANDOFF.md`.
- [ ] Notion row (`3de78ba6-ae12-8175-97d7-c6c88cf8c79d`) still needs a manual status update — not automated in this session.

## Notes

- **Carried-forward, non-blocking items** (unchanged from Phase 2, still owed): production `markCommentsRead()`'s latent clock-skew hazard (flagged, not fixed — task 27); `SolutionMenu`'s AC-051 palette-only highlight needs an explicit engineer sign-off (task 22); 3 deferred L1 browser walkthroughs (tasks 08, 10, 18) — **08 and 10 have since been completed live via Playwright CLI** (see HANDOFF § Sự cố đã xử lý, "Phép đo qua browser thật"), only task 18's redirect/own-block measurement is still owed; FormulaPreview flake elevated in severity (reproduces in isolation now, not just under parallel load) — recommend a `TECH-DEBT.md` entry when the engineer is free (that file has the engineer's own uncommitted changes, not touched here).
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `docs/project-context/external-resources.md`, `SOURCE/app/layout.tsx`.
