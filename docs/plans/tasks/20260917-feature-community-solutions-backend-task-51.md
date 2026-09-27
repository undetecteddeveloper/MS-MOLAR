# Task 51: `serviceRoleSurface.test.ts` + `rateLimit.test.ts` final check (feature-wide TD-029 close)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`. **Layer determination**: verification-only task with no target files; both checks guard backend surfaces (`SOURCE/lib/supabase/service-role.ts`, `SOURCE/lib/security/rateLimit.ts`).
- **Plan task**: P5-T12
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T12)
- **Dependencies**: task 02 (P1-T2), task 32 (P4-T1), task 34 (P4-T3); runs after task 50
- **Provides**: the feature-wide TD-029 closing check, complementary to the per-task criteria in tasks 03, 05, 32, 34, 35, 38, 47
- **Size**: Small (no files)

## Implementation Content

1. Confirm `SOURCE/lib/supabase/service-role.ts` still has exactly 13 exported operations, 4 direct writers, 1 env read, 1 `createClient(` call, and **zero diff across the entire feature branch**: `git diff af05f28 -- SOURCE/lib/supabase/service-role.ts` is empty.
2. Confirm the assertions in `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` were not modified: `git diff af05f28 -- SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts` is empty.
3. Confirm all 11 `RATE_LIMITS` keys remain present, classified in `DB_COST_ACTIONS`, with `limit ≥ 15` and `windowMs ≥ 60_000`, with values equal to task 02's table; and that `git diff af05f28 -- SOURCE/lib/security/rateLimit.test.ts` contains only additions (no removed or relaxed pre-existing assertion).
4. Run both test files; both green.

(`af05f28` is the branch point of `feat/community-solutions` from `origin/main`.)

## Acceptance Criteria

From the plan (§ P5-T12): **M9, S16**.

Carried hard constraints that apply to this task:
- **TD-029 (explicit)**: zero exported functions and zero direct table writers added to `SOURCE/lib/supabase/service-role.ts` across the whole feature; no gate-logic modification in either test.

## Target Files
- [ ] None (verification-only). Record command outputs in Investigation Notes.

## Investigation Targets
- `SOURCE/lib/supabase/service-role.ts`
- `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- `SOURCE/lib/security/rateLimit.ts`, `SOURCE/lib/security/rateLimit.test.ts`
- `docs/plans/tasks/20260917-feature-community-solutions-backend-task-02.md` (the 11 pinned values)
- `docs/adr/ADR-0019-continuing-with-service-role.md`
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing | `git diff af05f28 -- SOURCE/lib/supabase/service-role.ts` is empty and `serviceRoleSurface.test.ts` passes with an empty diff to its own file |

## Investigation Notes
(Append the four command outputs and the Binding Decision Compliance Check result.)

**task-executor, 2026-09-27 (HEAD `324cb3a`, branch point `af05f28`)**

Read `SOURCE/lib/supabase/service-role.ts`, `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`, `SOURCE/lib/security/rateLimit.ts`, `SOURCE/lib/security/rateLimit.test.ts`, task 02, ADR-0019, ADR-0021 (§ Implementation Guidance) in full before running any command.

**1. `git diff af05f28 -- SOURCE/lib/supabase/service-role.ts`** → empty (`wc -l` = 0). Manual re-count of the current file confirms: exactly 13 `export async function` (`recordExamResult`, `recordSkillMastery`, `listReportedExams`, `moderateExam`, `flagSupportTicketNotifyFailed`, `listSupportTickets`, `changeSupportTicketStatus`, `addSupportTicketNote`, `readPaymentOrderForSettlement`, `recordPaymentSettlement`, `recordPaymentOrder`, `claimEssayGradingAttempt`, `recordEssayGrade`); exactly 4 direct writers (`moderateExam`, `flagSupportTicketNotifyFailed`, `addSupportTicketNote`, `recordPaymentOrder` — matches `DIRECT_WRITERS_AT_ADR_0019` verbatim); exactly 1 `process.env.SUPABASE_SERVICE_ROLE_KEY` read (line 36); exactly 1 `createClient(` call (line 43 — the import statement on line 25 has no trailing `(` after `createClient` so the regex does not match it). **PASS.**

**2. `git diff af05f28 -- SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`** → empty (`wc -l` = 0). **PASS.**

**3. `RATE_LIMITS` 11-key check** — all 11 keys present in `rateLimit.ts` (lines 247-274) with values equal to task 02's pinned table (`60*60*1000` in the file is the identical value to the DD's `3_600_000` used in the task-02 table, per task 02's own Investigation Notes: "not a value difference, so no escalation"):

  | Key | File value | Task 02 table | Match |
  |---|---|---|---|
  | `communitySolutionSave` | `60, 60*60*1000` | `60, 3_600_000` | Y |
  | `communitySolutionStatus` | `15, 60*60*1000` | `15, 3_600_000` | Y |
  | `communitySolutionHelpful` | `40, 60*60*1000` | `40, 3_600_000` | Y |
  | `communitySolutionComment` | `30, 60*60*1000` | `30, 3_600_000` | Y |
  | `communitySolutionCommentDelete` | `15, 60*60*1000` | `15, 3_600_000` | Y |
  | `communitySolutionReport` | `15, 60*60*1000` | `15, 3_600_000` | Y |
  | `communityCommentReport` | `15, 60*60*1000` | `15, 3_600_000` | Y |
  | `communitySolutionPin` | `15, 60*60*1000` | `15, 3_600_000` | Y |
  | `communityCommentsMarkRead` | `60, 60*60*1000` | `60, 3_600_000` | Y |
  | `communityAdminModerateSolution` | `30, 60*60*1000` | `30, 3_600_000` | Y |
  | `communityAdminModerateComment` | `30, 60*60*1000` | `30, 3_600_000` | Y |

  All 11 spread into `DB_COST_ACTIONS` via `COMMUNITY_SOLUTIONS_ACTIONS` (rateLimit.test.ts:117-129,146). All satisfy `limit ≥ 15` and `windowMs ≥ 60_000` (`60*60*1000 = 3,600,000`). `git diff af05f28 -- SOURCE/lib/security/rateLimit.test.ts` contains only added lines (`+`) — the new `COMMUNITY_SOLUTIONS_ACTIONS` const, the `...COMMUNITY_SOLUTIONS_ACTIONS` spread, and one new `it(...)` block; no pre-existing line was removed or altered (confirmed by reading the full diff — every hunk shows additions only, all surrounding context lines unchanged). **PASS.**

**4. `npx vitest run lib/supabase/__tests__/serviceRoleSurface.test.ts lib/security/rateLimit.test.ts`** (run from `SOURCE/`) → `Test Files 2 passed (2)`, `Tests 23 passed (23)`. **PASS.**

**No violations found.** No task in the feature branch touched `service-role.ts` or its surface test; the only change to `rateLimit.test.ts` since `af05f28` is task 02's additive classification of the 11 community-solutions keys, already reviewed and accepted in task 02's own record.

**Binding Decision Compliance Check** (Source: ADR-0021 § Implementation Guidance, Axis: dependency_direction, Decision: "Do not add, rename, or widen the write-target set of any function in `service-role.ts` for this feature, under any framing"):
- Planned approach: read-only verification via the 4 git-diff/test commands above; no source edits made.
- Compliance Check ("`git diff af05f28 -- SOURCE/lib/supabase/service-role.ts` is empty and `serviceRoleSurface.test.ts` passes with an empty diff to its own file") → **Y**. Both diffs are empty and the test passes (6/23 of the combined run belong to `serviceRoleSurface.test.ts`, all green).

## Implementation Steps
- [x] Run the three `git diff af05f28 -- …` commands and record outputs
- [x] Compare the 11 key/value pairs against task 02's table
- [x] Run `npx vitest run lib/supabase/__tests__/serviceRoleSurface.test.ts lib/security/rateLimit.test.ts` from `SOURCE/`

## Quality Assurance Mechanisms
- `serviceRoleSurface.test.ts` — Enforces: ≤13 exported ops, exactly 4 direct writers, 1 env read, 1 `createClient(` — Config: same file
- `rateLimit.test.ts` classification invariants — Enforces: every key in exactly one category, DB-cost floor — Config: same file

## Operation Verification Methods
- **Verification method**: the git diffs and the targeted vitest run above.
- **Success criteria**: `service-role.ts` and its surface test have empty diffs from `af05f28`; `rateLimit.test.ts` diff is additions only; all 11 values match; both tests green.
- **Failure response**: any non-empty diff to `service-role.ts` or its test blocks feature close — revert that change and re-route the need through an `is_admin_user()`-gated RPC per ADR-0021.
- **Verification level**: L2 (tests passing) + evidence diffs

## Proof Obligations
- **Claim** (AC-085/M9 EARS, verbatim): "shall add zero exported functions and zero direct table writers to `SOURCE/lib/supabase/service-role.ts`."
- **Primary failure mode**: a late task quietly adds a helper to `service-role.ts` and adjusts the surface test's counts to match.
- **Boundary to exercise**: git history of both files from the branch point + test run.
- **State assertion**: diff at branch point (empty) → end of feature (still empty).
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All four checks recorded and passing
- [x] Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Scope boundary: no source changes.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`.
