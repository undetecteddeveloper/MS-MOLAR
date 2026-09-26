# Phase 2 Completion: Public Read (List + View) + Anonymity/Projection + Hữu ích + Ghim

- **Plan**: `docs/plans/20260917-feature-community-solutions.md` (§ Phase 2)
- **Overview**: `docs/plans/tasks/_overview-20260917-feature-community-solutions.md`
- **Value delivered (plan)**: any eligible reader can browse the solutions list and open a solution, with anonymity correctly masked and Hữu ích/ghim working. Integration Test 3 created here; fixture-e2e J1 completes here.
- **Entry precondition**: Phase 1 completion signed off. (The v1.2 U1 gate is removed: U1 is resolved and final.)
- **Migration in this phase (plan v1.3)**: task 13 owns 5 functions (`community_solutions_list`, `community_solution_detail`, `set_community_solution_pin`, `add_community_solution_helpful`, `remove_community_solution_helpful`), the `community_solution_helpfuls` table block, and — table blocks only, per R2 — `community_solution_comments` and `community_content_reports`. Three tables carry RLS with every privilege revoked, no policies, no grants. Its test task is 16; Server Action unit tests for `toggleHelpful`/`setPin` are in 15.
- **Status**: 12/12 task files done. **PHASE 2 COMPLETE** (2026-09-26).

## Task Completion Checklist

| Done | # | File | Layer | Plan task | Commit |
|---|---|---|---|---|---|
| [x] | 13 | `20260917-feature-community-solutions-backend-task-13.md` | backend | P2-T1 | `e74b64a` |
| [x] | 14 | `20260917-feature-community-solutions-backend-task-14.md` | backend | P2-T2 | `b3492c9` |
| [x] | 15 | `20260917-feature-community-solutions-backend-task-15.md` | backend | P2-T3 | `a2a7e36` |
| [x] | 16 | `20260917-feature-community-solutions-backend-task-16.md` | backend | P2-T4 | `ac068cf` |
| [x] | 17 | `20260917-feature-community-solutions-frontend-task-17.md` | frontend | P2-T5 (split 1/2) | `cbf17de` |
| [x] | 18 | `20260917-feature-community-solutions-frontend-task-18.md` | frontend | P2-T5 (split 2/2) | `0526f18` |
| [x] | 19 | `20260917-feature-community-solutions-frontend-task-19.md` | frontend | P2-T6 (split 1/3) | `daef762` |
| [x] | 20 | `20260917-feature-community-solutions-frontend-task-20.md` | frontend | P2-T6 (split 2/3) | `4c5470d` |
| [x] | 21 | `20260917-feature-community-solutions-frontend-task-21.md` | frontend | P2-T6 (split 3/3) | `d04b245` |
| [x] | 22 | `20260917-feature-community-solutions-frontend-task-22.md` | frontend | P2-T7 | `06e8479` |
| [x] | 23 | `20260917-feature-community-solutions-frontend-task-23.md` | frontend | P2-T8 | `1abbe87` |
| [x] | 24 | `20260917-feature-community-solutions-frontend-task-24.md` | frontend | P2-T9 | `a8cb29e` |

Plan progress: 9/9 plan entries → 12 task files. All 12 committed.

## Phase Exit Criteria (verbatim from plan)

"Integration Test 3 green; `test-rls.ts` M5 null-value assertion green; fixture-e2e J1 green; a non-author eligible reader can browse the list, open a solution, mark Hữu ích, and the exam author can ghim — all through real UI against a masked-correct backend."

- [x] Task 13 migration applied to dev incl. the R2 table blocks (`community_solution_comments`, `community_content_reports`) with zero policies and zero grants; `npm run verify:schema` green with one probe per new RPC, judged by message — re-confirmed 2026-09-26 (Phase 2 close), all Community Solutions Phase 1 + Phase 2 probes green
- [x] `test-rls.ts` M5 group (anonymous **solution**), writer self-read (AC-062), both Helpful RPC groups (AC-065, each with a table-closure case), pin atomicity and refusals (`22023`), score-grading on list and detail, detail key sets 14 / 7 / 11 green (task 16) — re-confirmed 2026-09-26; anonymous-**comment** half deferred to task 27 per R3; the hidden-comment and draft/hidden-solution cases use the SN-1 harness setup until task 32 exists. **Only 4 unrelated pre-existing failures remain in the file** (Rating section R-p/R-r/R-t/R-u, confirmed by two independent reviewer passes + this phase-close re-run to be a pre-existing, out-of-scope issue, not a Community Solutions regression)
- [x] S12 ordering stable (task 16 localdb file) — re-confirmed 2026-09-26 (5 files/25 tests, localdb lane)
- [x] `toggleHelpful(solutionId)` and `setPin(examId, action, solutionId?)` unit tests green (task 15), incl. the forwarded `p_solution_id`
- [x] fixture-e2e Test 2 S-03/S-05 portions green (task 24), with a genuine RED-phase discrimination proof independently re-run by integration-test-reviewer; O-02 portion pending task 30
- [x] View-screen and list-screen component tests for the v1.3 contracts green (tasks 17–22): score-hidden rows render no result label, comment affordance iff `commentCount` present, `iReported` states, list route never calls `getResultCardSummary`, empty palette trigger (DD-U4)

**Known follow-ups carried into Phase 3+ (not exit blockers for Phase 2):**
- ~~Reader-side `community_solution_detail` still lacks `question_type`/`choices`/`sub_answers`/`essay_answer` per question~~ — **RESOLVED 2026-09-26, commit `06b12ed`** (see `community-solutions-HANDOFF.md` § "Sự cố đã xử lý"). Data now reaches `SolutionDetailQuestion` in `queries.ts`; no UI consumes it yet (future task).
- 3 L1 real-browser walkthroughs still deferred (tasks 08, 10, 18) on the standing Playwright sign-in block — need the engineer to run the shared CLI sign-in before these can close out.
- `SolutionMenu`'s current-question-highlight reading (task 22: only moves on palette selection, not plain row-header click) needs engineer sign-off.
- `SolutionEditorScreen`'s `NOTE_SAVE_SUCCESS` reducer case still doesn't apply `result.status` (only `solutionId` was fixed in task 23, since that's what blocked AC-030) — noted, not yet fixed, not currently blocking anything.

## Test Skeleton Files to Verify at Phase End

| Skeleton | Tests implemented by end of Phase 2 | Expected state |
|---|---|---|
| `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` | Test 2 (task 04), Test 3 (task 14) | Tests 2, 3 green; Test 1 still a comment block |
| `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` | J1 (task 23), Test 2 S-03/S-05 (task 24) | J1 + Test 2 partial green; Test 3 comment block; **runs without exclude from task 23 on** |
| `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` | none | comment-only; excluded from `test:localdb` per R1 |

Phase-2-created real-DB test files: `SOURCE/tests/e2e/service/community-solutions-list-order.localdb.test.ts` (task 16); new groups in `SOURCE/supabase/test-rls.ts` (task 16). Phase-2 unit tests: `SOURCE/features/solutions/__tests__/helpfulPinActions.test.ts` (task 15); the mapper test beside Test 3 (task 14). Fixture data module: `SOURCE/tests/e2e/fixture/communitySolutionsFixtureData.ts` (task 23).

## Phase-End Gate Commands (run inside `SOURCE/`)

1. `npx tsc --noEmit` — ✅ clean (re-run 2026-09-26)
2. `npm run lint` — ✅ clean, 0 warnings (re-run 2026-09-26)
3. `npm test` — ✅ 183 files/2402 tests passed, 10 pre-existing unrelated skips (re-run 2026-09-26; FormulaPreview flake did not reproduce this run)
4. `npm run build` — ✅ (verified in task 24's quality-fixer pass)
5. `npm run test:fixture` (no exclude) — ✅ 2 files/14 tests (re-run 2026-09-26)
6. `npm run verify:schema` then `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` — ✅ both green (re-run 2026-09-26; localdb 5 files/25 tests)
7. `npx tsx supabase/test-rls.ts` — ✅ every Community Solutions check green (re-run 2026-09-26); only the 4 known pre-existing, out-of-scope Rating-section failures (R-p/R-r/R-t/R-u) remain, unrelated to this feature

## Before Starting Phase 3

- [ ] Progress record updated (Notion row named in `docs/plans/community-solutions-HANDOFF.md`) with Phase 2 measurements and reasons.
- [ ] Engineer decision needed on the `community_solution_detail` reader-side column gap (see "Known follow-ups" above) before task 25 starts.

## Notes

- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `docs/project-context/external-resources.md`, `SOURCE/app/layout.tsx`.
