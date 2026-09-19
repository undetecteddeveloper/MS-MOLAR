# Task FQA-T1 — Design-to-Plan Traceability coverage check

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase (Quality Assurance), Task FQA-T1**
Layer: cross-cutting (verification only — no source files changed)

Metadata:
- Dependencies: Phase 8 complete (all feature test files filled in)
- Blocks: FQA-T2..T10 conceptually run after/alongside this, but this is the structural check that confirms nothing was missed before the rest of Final QA proceeds
- Size: Small (0 files; 1 verification pass over the plan's own table)
- Verification level: L2 (documentation/traceability check)

## Implementation Content
Run the full Design-to-Plan Traceability table coverage check (`docs/plans/20260918-feature-exam-shelves.md`, the table beginning "## Design-to-Plan Traceability") — confirm every row's covering task(s) landed; confirm 0 unjustified `gap` rows remain.

## Target Files
- [ ] None (verification-only task; no source files changed)

## Investigation Targets
- `docs/plans/20260918-feature-exam-shelves.md` (§ Design-to-Plan Traceability — the full table, all rows)
- every task file `exam-shelves-task-P0-T1.md` through `exam-shelves-task-P8-T4.md` (cross-reference each row's "Covered By Task(s)" against the corresponding task file's Completion Criteria)

## Investigation Notes

**Method**: read the full Design-to-Plan Traceability table (66 data rows, `docs/plans/20260918-feature-exam-shelves.md:75-142`). For every distinct task named in the table (P0-T1..P0-T7, P1-T1..P1-T6, P2-T1..P2-T4, P3-T1/T2, P4-T1..P4-T4, P5-T1/T2, P6-T1, P7-T1, P8-T1..P8-T4, FQA-T2, FQA-T7 — 30 of the 31 landed tasks plus 2 Final-QA-phase tasks not yet run): confirmed the task file exists, counted `- [ ]`/`- [x]` checkboxes to find any left incomplete, then read the outlier files in full. Independently verified a representative cross-section of the claimed artifacts directly against the repo (not just trusting each task file's own "Done" narrative): `ls` for 17 key new files (all present), `git show --stat`/`git diff` on the P4-T1 single-commit constraint (confirmed both `catalogue.ts` union+record+branch AND `page.tsx` whitelist landed in exactly one commit, `930e350`), `grep` for the `exam_hot_counts` RPC probes in `verify-schema.ts` (present, 3 probes: authenticated-exists, service_role-exists, anon-42501), `grep` for Phần 10 HS-a..HS-g in `test-rls.ts` (present), `grep` for the §20a/20b/20c SQL objects in `schema.sql` (present), `buildSubjectWeakness` export + its extended test cases in `rankExams.ts`/`rankExams.test.ts` (present), the `hot` branch in `ranking.ts` (present), the 4-slot `Promise.all` + `hasBrowseParam` + `SHELF_ORDER.map` in `exams/page.tsx` (present), the 3 optional `ExamCard` props (present), the `ExamFilters` `hot` QUICK entry (present), the home page's guarded `listHotExams` call (present), the exact copy-key count (16, confirmed by grep across the 3 destinations: 13 shelf/sort keys + `home.hotExams` + `exams.hotRibbon` = 16), and confirmed 0 active `it.todo`/`it.skip` calls remain in the 4 filled-in skeleton test files (only stale explanatory comments mention `it.todo`, not live calls). `git status --porcelain` is clean — nothing uncommitted.

**Row-by-row confirmation** (DD Item abbreviated to match the table's own text; all 66 rows' Gap Status is `covered` in the table):

| # | DD Item (abbreviated) | Covered By Task(s) | Landed Y/N |
|---|---|---|---|
| 1 | `exam_attempts.source` column | P0-T1 | Y |
| 2 | Index `exam_attempts_status_submitted_idx` | P0-T1 | Y |
| 3 | `exam_hot_counts()` function + revoke/grant | P0-T1 | Y |
| 4 | Migration file creation | P0-T3 | Y |
| 5 | Dev apply | P0-T4 | Y |
| 6 | Dev read-back | P0-T4 | Y |
| 7 | `verify:schema` full mode green on dev | P0-T5 | Y (exit 0 confirmed after coordinator deleted an unrelated stray TD-016 row; unrelated to this feature) |
| 8 | Production apply | FQA-T7 | N/A — deploy-time, explicitly not implementation scope; correctly not yet run |
| 9 | `examShelves.ts` 4 pure functions + types | P1-T4 | Y |
| 10 | 4 new constants | P1-T4 | Y |
| 11 | `buildSubjectWeakness` export + widened return | P1-T3 | Y |
| 12 | `attemptSource.ts` | P1-T5 | Y |
| 13 | `browseParams.ts` | P1-T6 | Y |
| 14 | `attempts.ts` extraction | P2-T4 | Y |
| 15 | `hotCounts.ts` | P3-T1 | Y |
| 16 | `shelves.ts` | P3-T2 | Y |
| 17 | `ExamSort` widening + `DEFAULT_ASCENDING.hot` + inner branch | P4-T1 | Y — verified via `git show 930e350`: both edits landed in exactly ONE commit as required (task file's own checkboxes are stale — still say "PENDING orchestrator's commit" — but the commit exists and working tree is clean) |
| 18 | `ranking.ts` 4th `Promise.all` member | P4-T2 | Y |
| 19 | `startAttempt(examId, rawSource?)` | P1-T5 | Y |
| 20 | `/exams` page branch predicate | P5-T1 | Y |
| 21 | Home guarded fetch (F-001) | P7-T1 | Y |
| 22 | `verify-schema.ts`/`test-rls.ts` new probes | P8-T1, P8-T2 | Y |
| 23 | `examShelves.test.ts` | P1-T4 | Y |
| 24 | `rankExams.test.ts` extension | P1-T3 | Y |
| 25 | `attemptSource.test.ts` + `browseParams.test.ts` | P1-T5, P1-T6 | Y |
| 26 | `shelves.int.test.ts` fill-in | P3-T2 | Y — 0 `it.todo` remain |
| 27 | `rating.int.test.ts` changed (candidate 3/3) | P4-T3 | Y — committed (`6a8978d`), 0 `it.todo` remain |
| 28 | `exam-hot-counts.service.e2e.test.ts` + fixtures | P8-T3, P8-T4 | Y — 0 `it.todo` remain, 25/25 pass live on dev per P8-T4's notes |
| 29 | `test-rls.ts` Phần 10 HS-a..HS-g | P8-T2 | Y |
| 30 | `verify-schema.ts` RPC probes | P8-T1 | Y |
| 31 | Security Considerations (RLS, grant, `?from` norm, hour-snap) | P0-T1, P1-T5, P8-T2 | Y |
| 32 | Logging: `readBounded` labels, no identity in logs | P3-T1, P3-T2, P4-T2, P7-T1 | Y |
| 33 | `source` no transition, INSERT-only, CHECK invariant | P0-T1, P1-T5 | Y |
| 34 | `ExamSort` value `"hot"` — 4th value on existing axis | P4-T1 | Y |
| 35 | Minimal Surface Element 2 — `examShelves.ts` + widened weakness | P1-T3, P1-T4 | Y |
| 36 | Data Representation — `ShelfAttempt`, 3 shelf types | P1-T4, P2-T4, P3-T2 | Y |
| 37 | `source` field chain (5 boundary rows) | P1-T5, P2-T2, P6-T1 | Y (code side); see Finding 2 below for P6-T1's separate, already-tracked residual |
| 38 | `ExamShelf.tsx` | P2-T3 | Y |
| 39 | `ExamRibbon.tsx` | P2-T1 | Y |
| 40 | `ExamCard.snapshot.test.tsx` (pre-change baseline) | P1-T1, P2-T2 | Y — P1-T1 confirmed to precede P2-T2 (P1-T1 committed first, snapshot baseline exists before any `ExamCard` prop edit) |
| 41 | `ExamShelf.test.tsx` | P2-T3 | Y |
| 42 | `exam-shelves.fixture.e2e.test.ts` fill-in | P5-T2 | Y — 0 `it.todo` remain |
| 43 | `page.tsx` branch + `"hot"` whitelist | P4-T1, P5-T1 | Y |
| 44 | `ExamCard.tsx` 3 optional props | P2-T2 | Y — `ribbon?`, `from?`, `className?` confirmed present |
| 45 | `ExamFilters.tsx` local union + `QUICK` 4th entry | P4-T4 | Y |
| 46 | `catalogue.ts` `ExamSort` re-export widening | P4-T1 | Y |
| 47 | `[id]/page.tsx` gains `searchParams`, `source={from}` | P6-T1 | Y (code landed, automated roundtrip tests pass); manual dev smoke test residual — see Finding 2 |
| 48 | `StartAttemptButton.tsx` gains `source?: string` | P6-T1 | Y (code landed); same residual as row 47 |
| 49 | `app/page.tsx` guarded data source + label | P7-T1 | Y |
| 50 | `lib/copy.ts` 16 keys, 3 destinations | P1-T2 | Y — exact count confirmed: 16 |
| 51 | `hasBrowseParam(sp)` consumption at the page | P5-T1 | Y |
| 52 | Early-return narrowing, 4-slot `Promise.all` | P5-T1 | Y |
| 53 | `shelfSubtitle()`, `HOT_SUBTITLE` map | P2-T3 | Y |
| 54 | `SHELF_ORDER.map`, literal `key={kind}` | P5-T1 | Y |
| 55 | `ExamShelf` 5-prop contract, 0 optional | P2-T3 | Y — interface confirmed: exactly 5 required props |
| 56 | ExamCard containment proof (href/class/ribbon) | P2-T2 | Y |
| 57 | `?from=` chain (7 boundary rows) | P2-T2, P6-T1 | Y (code side); same residual as row 47 |
| 58 | Home block table (data source/label/ribbon/guard) | P7-T1 | Y |
| 59 | Nổi nhất chip, 3-part edit | P4-T4 | Y |
| 60 | 0 client fetches; literal key; motion-safe scroll; 0 globals.css edits | P2-T3, P5-T1 | Y |
| 61 | `ExamCard.from` — selected A | P2-T2 | Y |
| 62 | `ExamCard.className` — selected A | P2-T2 | Y |
| 63 | `ExamShelf` component split — selected A | P2-T3 | Y |
| 64 | Fixture lane MOCKED/REAL declarations | P5-T2 | Y |
| 65 | Stale theme-name comments (layout.tsx, AppShell.tsx) | P0-T7 | Y |
| 66 | AC-045 — 0 new deps, icons from `lucide-react` | FQA-T2 | N/A — scheduled next in Final QA, not yet run; correctly not claimed done. Spot-checked anyway: `ExamShelf.tsx` icons confirmed from `lucide-react` |

**Result**: 0 unjustified gap rows. Every row's covering task exists, and its specific DD artifact is verifiably present in the committed code (or, for rows 8/66, correctly not-yet-run because they are explicitly scheduled later in the Final QA phase, not because anything was missed).

**Finding 1 (documentation hygiene, not a functional gap)**: P4-T1's own task file still shows several checkboxes unchecked ("Stage and commit... DEFERRED BY DESIGN", "PENDING orchestrator's commit") because it was written before the orchestrator performed the actual commit step. `git show 930e350` confirms the commit landed exactly as the hard single-commit constraint required (both `catalogue.ts`'s union/record/branch and `page.tsx`'s whitelist in one commit). Same pattern found in the work plan's own Phase 4 "Phase Completion Criteria" sub-checklist (`:476-479`, all 4 items still `[ ]`) despite P4-T1/T2/T3/T4 all being committed and the work plan's own per-task lines (`:467-473`) narrating completion. P4-T1.md/the Phase 4 Completion Criteria checkboxes are outside this task's Target Files (`None`) and the allowed-file list, so left as-is; flagged here for whoever next touches those files.

**Finding 2 (real, but already-tracked, not hidden by this table)**: P6-T1's and P7-T1's DD-attributed code artifacts (rows 37, 47, 48, 57) are genuinely landed and covered by automated roundtrip tests. What is NOT done is each task's own separate manual L1 dev-smoke-test obligation (P6-T1: start an attempt from a `?from=hot` card, read `exam_attempts.source` back on dev; P7-T1: confirm the home block shows real hot data to an actual signed-in browser session) — blocked in every session so far by Auto Mode's Playwright test-account sign-in restriction (no dev server + no signed-in session available). This is **not a silently-missed item**: the work plan itself already marks Phase 6's and Phase 7's Completion Criteria as `[🔄]` (partial) for exactly this reason (`docs/plans/20260918-feature-exam-shelves.md:506-510,520-525`), and FQA-T10's own Dependencies line explicitly names "real written data from Phase 6/7's smoke tests" as a prerequisite it needs. This residual therefore does not fail this task's own Traceability-table check (no row here claims something false), but it **does block genuine completion of FQA-T10** downstream, and needs an engineer to sign in to the shared Playwright CLI session as the test account (or add a Bash allow-rule) and run both smoke tests before FQA-T10 can be truthfully confirmed.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read the full Design-to-Plan Traceability table
- [x] For each row, identify the covering task(s) and confirm they exist and are marked complete
### 2. Green Phase
- [x] Where a row's `Gap Status` is not `covered`, investigate and either close the gap or escalate — the plan's own review already closed all known gaps (AC-045 into FQA-T2, AC-035/AC-049/AC-030 into existing tasks' AC lists); this check found 0 new gaps in the table itself (see Investigation Notes Finding 1 and Finding 2 for two non-table-row residuals recorded for visibility, neither of which is a false `covered` claim in the table)
### 3. Refactor Phase
- [x] N/A — this task changes no source files

## Operation Verification Methods
- **Verification method**: manual/systematic row-by-row walkthrough of the Traceability table against landed task completions.
- **Success criteria**: every row shows `covered`, and every covering task is confirmed complete per its own Completion Criteria.
- **Failure response**: if a row is found uncovered, this blocks Final QA sign-off — identify which task should have covered it and confirm whether it was missed entirely or implemented but not verified against this specific DD item.
- **Verification level**: L2.

## Completion Criteria
- [x] Every Traceability table row confirmed `covered` with a landed, complete task
- [x] 0 unjustified `gap` rows found
- [x] Investigation Notes record the full row-by-row confirmation

## Notes
- Impact scope: none — verification only.
- Scope boundary: no source files touched by this task.
