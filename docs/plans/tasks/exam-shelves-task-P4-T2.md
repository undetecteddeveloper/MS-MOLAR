# Task P4-T2 — `ranking.ts`: `sort === "hot"` branch (4th `Promise.all` member)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 4, Task P4-T2**
Layer: backend (`SOURCE/features/exams/queries/`)

Metadata:
- Dependencies: P4-T1 (the `ExamSort` widening + `catalogue.ts` branch this reuses)
- Blocks: P4-T3 (the test fill-in that proves this branch's behavior)
- Size: Small (1-2 files)
- Verification level: L2

## Implementation Content
In `SOURCE/features/exams/queries/ranking.ts`, add the `sort === "hot"` branch — a 4th `Promise.all` member that is `Promise.resolve([])` unless `filters.sort === "hot"`, in which case it calls `readHotCounts` (Phase 3) and reorders the fetched exams via `orderIdsByHotCount` (Phase 1) before `paginateExams`.

## Target Files
- [ ] `SOURCE/features/exams/queries/ranking.ts`
- [ ] `SOURCE/features/exams/queries/index.ts` (re-export, if needed)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The `?sort=hot` axis — full pseudocode)
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `SOURCE/features/exams/queries/ranking.ts` (the current `Promise.all` composition this task adds a 4th member to)
- `SOURCE/features/exams/queries/hotCounts.ts` (P3-T1 — `readHotCounts`, reused here, not re-implemented)
- `SOURCE/lib/adaptive/examShelves.ts` (P1-T4 — `orderIdsByHotCount`, reused here, not re-implemented)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-018) | structure-order | "submitted attempt count DESC, exam id ASC, where the count includes attempts by all students, not only the caller" | Does the `?sort=hot` branch order the flat-grid results using `orderIdsByHotCount`'s cross-user total, with 0 fallback to a per-caller count? |

## Investigation Notes
_(Record here: confirmation `readHotCounts` and `orderIdsByHotCount` are imported and reused, not duplicated; confirmation `?dir` is accepted but has no ordering effect on this axis.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write/extend integration-test cases (in coordination with P4-T3's fill-in scope, or as a preliminary local check) confirming: for `sort !== "hot"`, the 4th `Promise.all` member resolves `Promise.resolve([])` and issues 0 extra calls; for `sort === "hot"`, it calls `readHotCounts` and the result feeds `orderIdsByHotCount` before `paginateExams`
### 2. Green Phase
- [ ] Add the 4th `Promise.all` member per the DD pseudocode
- [ ] Wire `readHotCounts` → `orderIdsByHotCount` → `paginateExams` for the hot branch
### 3. Refactor Phase
- [ ] Confirm `?dir` is still accepted (not rejected) on the hot axis even though it has no ordering effect — an old bookmarked link with `?dir=` must keep working

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: integration test (finalized in P4-T3) asserting the 4th `Promise.all` member's behavior for both `sort === "hot"` and every other sort value.
- **Success criteria**: for non-hot sorts, 0 extra calls issued by the 4th member; for `sort === "hot"`, exactly the calls `readHotCounts` itself issues, and the final exam order matches `orderIdsByHotCount`'s output.
- **Failure response**: if a non-hot sort triggers an RPC call via the 4th member, the round-trip budget is silently violated — fix the guard condition (`filters.sort === "hot"`) rather than the test.
- **Verification level**: L2 (fully exercised by P4-T3's fill-in).

## Proof Obligations
- **Claim** (AC-018, AC-034): `?dir` on the hot axis has no ordering effect (Node-side, single-directional) but is still **accepted**, not rejected, so an old link keeps working.
  - **Primary failure mode**: the hot branch throws or 400s on an unrecognised/inapplicable `?dir` value instead of silently ignoring it, breaking a previously-valid bookmarked URL that happens to also carry `?dir=asc`.
  - **Boundary to exercise**: integration test (finalized in P4-T3), mocked Supabase client boundary.
  - **State assertion**: N/A (read-only query composition).
  - **Mock boundary rationale**: Supabase client mocked at its established `ranking.ts` test boundary.
  - **Residual**: the literal expected hot-order array (independently computed) is P4-T3's proof obligation, not this task's — this task proves the branch is wired correctly; P4-T3 proves its output is correct.

## Completion Criteria
- [ ] 4th `Promise.all` member added, guarded correctly on `filters.sort === "hot"`
- [ ] `readHotCounts` and `orderIdsByHotCount` reused (not reimplemented)
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `ranking.ts` (1 new `Promise.all` member + hot-branch wiring), `index.ts` (re-export only, if needed).
- Scope boundary — preserve unchanged: the existing 3 `Promise.all` members and their behavior for non-hot sorts.
