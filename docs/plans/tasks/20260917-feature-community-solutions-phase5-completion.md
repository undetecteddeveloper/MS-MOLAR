# Phase 5 Completion: Hồ sơ (Uy tín + Huy hiệu + Tab Bình luận) + Avatar cross-user + Dọn dẹp + Final Quality Assurance

- **Plan**: `docs/plans/20260917-feature-community-solutions.md` (§ Phase 5)
- **Overview**: `docs/plans/tasks/_overview-20260917-feature-community-solutions.md`
- **Value delivered (plan)**: reputation/badges on the profile page, a readable comment-notification tab, real avatars for non-self named authors, and feature close with both service-integration-e2e tests executed against real dev Postgres plus a full local + prod verification gate. This is the plan's final phase and required Quality Assurance phase.
- **Entry precondition**: Phase 4 completion signed off. (The v1.2 U2 gate is removed: U2 is resolved and final; task 44 waits only on tasks 43 and 26.)
- **Migrations in this phase (plan v1.3)**: task 40 owns `community_avatar_owner_visible(uuid)` and the Storage policy `avatars_select_community_visible`; task 41 owns `community_reputation_summary()` (if 40 and 41 land in one commit, one file carries the later fingerprint and task 41 owns no separate file). **Tasks 40 and 41 test their own migrations** (40: avatar cases for AC-004, S4, S7, AC-047, AC-048 in `test-rls.ts`; 41: the 84 → 104 → 74 → 104 → 54 → 104 → 74 vector and AC-088 rollback in `community-solutions-reputation.localdb.test.ts`). Task 40 also runs the S4 avatar assertion deferred from task 27 (SN-1).
- **Status**: 14/14 task files done. **PHASE 5 COMPLETE — FEATURE COMPLETE (2026-09-27).**

## Task Completion Checklist

| Done | # | File | Layer | Plan task |
|---|---|---|---|---|
| [x] | 40 | `20260917-feature-community-solutions-backend-task-40.md` | backend | P5-T1 |
| [x] | 41 | `20260917-feature-community-solutions-backend-task-41.md` | backend | P5-T2 |
| [x] | 42 | `20260917-feature-community-solutions-backend-task-42.md` | backend | P5-T3 |
| [x] | 43 | `20260917-feature-community-solutions-backend-task-43.md` | backend | P5-T4 |
| [x] | 44 | `20260917-feature-community-solutions-frontend-task-44.md` | frontend | P5-T5 |
| [x] | 45 | `20260917-feature-community-solutions-frontend-task-45.md` | frontend | P5-T6 |
| [x] | 46 | `20260917-feature-community-solutions-frontend-task-46.md` | frontend | P5-T7 |
| [x] | 47 | `20260917-feature-community-solutions-backend-task-47.md` | backend | P5-T8 |
| [x] | 48 | `20260917-feature-community-solutions-frontend-task-48.md` | frontend | P5-T9 |
| [x] | 49 | `20260917-feature-community-solutions-frontend-task-49.md` | frontend | P5-T10 |
| [x] | 50 | `20260917-feature-community-solutions-backend-task-50.md` | backend | P5-T11 |
| [x] | 51 | `20260917-feature-community-solutions-backend-task-51.md` | backend | P5-T12 |
| [x] | 52 | `20260917-feature-community-solutions-backend-task-52.md` | backend | P5-T13 |
| [x] | 53 | `20260917-feature-community-solutions-backend-task-53.md` | backend | P5-T14 |

Plan progress: 14/14 plan entries → 14 task files, 14/14 done.

## Phase Exit Criteria — feature-closing (verbatim from plan)

"SE1+SE2 green against real dev Postgres; full local gate green; `serviceRoleSurface.test.ts` confirmed unmodified across the whole feature; prod fingerprint matches dev; every AC has a covering task with a passing result."

- [x] Tasks 40 and 41 green against their own migrations (avatar cases; reputation fixed vector and AC-088 rollback)
- [x] Task 42 signer covers `listSolutions` and `getSolutionDetail` (header + comments in one batch) only — `getMyCommentFeed` returns no avatar and is not signed; exactly one Storage call per screen render
- [x] Task 44: `ProfileCard.test.tsx` slot-filled and no-slot cases green; `ProfileCard` imports nothing from `@/features/solutions/**`
- [x] SE1 + SE2 green in one continuous run (task 47): SE1's word-count rejection asserts `23514` with DETAIL = the decimal missing count; SE2's anonymous comment is created through `post_community_comment(..., p_is_anonymous => true)` under a ≥15-word note; SE2's admin leg reads through `admin_list_community_reports()` (SK-2, resolved 2026-09-20 — not overruled)
- [x] Fixture suite + bundle budget: three new routes ≤ ~170KB gzip first-load JS, no markdown/KaTeX chunk (task 48) — measured 56.3-72.3KB
- [x] Visual measurement deliverable `docs/plans/analysis/20260917-community-solutions-visual-measurement.md` all passing (task 49) — PASS all 5 surfaces × 3 viewports after 5 runs; 3 real bugs found and fixed (`acfa528`/`43c7c58`)
- [x] Six-gate local sequence + `check:bundle` green with no `--exclude` flag left (task 50); `npm run test:integration` exits 0 as a regression lane (INT-1 stays quarantined by name, TD-034; `vitest.integration.config.ts` untouched)
- [x] `git diff af05f28 -- SOURCE/lib/supabase/service-role.ts` empty; surface test unmodified; 11 `RATE_LIMITS` keys intact (task 51)
- [x] Engineer precondition confirmed before task 52: all six migrations (03, 13, 25, 32, 40, 41) applied to prod in dev order, then the `admin_users` prod seed — **applied by the agent in-session per the engineer's explicit direct request** (deviation from the original "engineer applies before task starts" design, recorded in task 52's Investigation Notes)
- [x] Prod `schema_version.fingerprint` = `SCHEMA_FINGERPRINT`; prod `admin_users` count = prod `ADMIN_USER_IDS` count (task 52) — fingerprint `13a8e93ea8e7` matches dev exactly; admin count 1 = 1
- [x] AC closure deliverable `docs/plans/analysis/20260917-community-solutions-ac-closure.md` with zero unexplained gaps (task 53) — 110/110 AC covered, 110/110 `passed`

## Test Skeleton Files to Verify at Phase End (all must be fully implemented)

| Skeleton | Tests | Expected state |
|---|---|---|
| `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` | Test 1, Test 2, Test 3 | all green in `npm test` |
| `SOURCE/tests/e2e/fixture/community-solutions.fixture.e2e.test.ts` | J1, Test 2 (S-03/S-05/O-02), Test 3 | all green in `npm run test:fixture` |
| `SOURCE/tests/e2e/service/community-solutions.service.e2e.test.ts` | SE1, SE2 (task 47 only) | green in `npm run test:localdb` — **R1 exclude flag no longer used from task 47 on** |

Other feature test files to include in the final runs: `SOURCE/lib/solutions/__tests__/{identity,countWords,unreadComments}.test.ts`; `SOURCE/features/solutions/__tests__/{helpfulPinActions,commentActions,reportActions,avatarSigner,reputationQuery}.test.ts`; `SOURCE/features/solutions/components/__tests__/*` (incl. `noStaticRichTextImport.test.ts`); `SOURCE/features/admin/components/__tests__/*`; `SOURCE/features/profile/__tests__/ProfileCard.test.tsx`; `SOURCE/components/shared/__tests__/RichText.xss.test.tsx`; `SOURCE/tests/e2e/service/community-solutions-{write-gate,list-order,comment-feed,reputation}.localdb.test.ts`; `SOURCE/supabase/test-rls.ts`.

## Phase-End Gate Commands (run inside `SOURCE/`)

1. `npx tsc --noEmit`
2. `npm run lint`
3. `npm test`
4. `npm run build`
5. `npm run test:fixture`
6. `npm run verify:schema` then `npm run test:localdb` (no exclude; a red file is re-run alone once before it is treated as a defect)
7. `npx tsx supabase/test-rls.ts`
8. `npm run check:bundle`
9. `npm run test:integration` (regression; must exit 0)

## Feature Close

- [x] Progress record closed (Notion row named in `docs/plans/community-solutions-HANDOFF.md`, page `3de78ba6-ae12-8175-97d7-c6c88cf8c79d`): status, verification results with numbers, the U1/U2 resolutions as recorded — appended via Composio MCP 2026-09-27; final "feature complete" update still to append once engineer confirms ship.
- [ ] `docs/plans/community-solutions-HANDOFF.md` removed only when the engineer confirms the feature has shipped (per that file's own instruction) — **all 53/53 tasks + task 49 now done; waiting on engineer's explicit ship confirmation, not on any remaining work.**

## Notes

- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `docs/project-context/external-resources.md`, `SOURCE/app/layout.tsx`.
