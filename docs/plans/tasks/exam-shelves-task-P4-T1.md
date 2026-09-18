# Task P4-T1 — `ExamSort` widening + `DEFAULT_ASCENDING.hot` + inner sort branch + page whitelist (SINGLE COMMIT — hard constraint)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 4 (The `?sort=hot` Axis), Task P4-T1 — MUST land in ONE commit**
Layer: backend/frontend boundary (`SOURCE/features/exams/queries/catalogue.ts`, `SOURCE/app/(exams)/exams/page.tsx`)

Metadata:
- Dependencies: P3-T2 (`shelves.ts` composition, whose `readHotCounts`/`orderIdsByHotCount` this axis reuses conceptually — though the actual reuse happens in P4-T2)
- Blocks: P4-T2 (the branch this task creates), P4-T4 (the chip that selects `sort=hot`), P5-T1 (the whitelist this task adds to `page.tsx`)
- Size: Small (2 files) — **but non-negotiably ONE commit**
- Verification level: L2

## THIS TASK IS A SINGLE-COMMIT HARD CONSTRAINT

`DEFAULT_ASCENDING` is a `Record<ExamSort, boolean>`. A widened `ExamSort` union with no matching record entry makes `tsc` fail at `catalogue.ts:32` (frontend DD Interface Change Matrix: "the union widening and the `hot: false` entry are one edit... or the build is red between them"). **Do not split this task's changes across multiple commits under any circumstance.**

## Implementation Content
Edit `SOURCE/features/exams/queries/catalogue.ts:21` (`ExamSort` union `+= "hot"`) AND `catalogue.ts:32-36` (`DEFAULT_ASCENDING` gains `hot: false`) AND the inner sort-branch case (`:105-117`, `else if (sort === "hot") query = .order("id")`) — **all in ONE commit**. Also edit `SOURCE/app/(exams)/exams/page.tsx:46-47` to admit `"hot"` into the sort literal whitelist, same commit.

## Target Files
- [ ] `SOURCE/features/exams/queries/catalogue.ts`
- [ ] `SOURCE/app/(exams)/exams/page.tsx` (whitelist only — the branch/render logic for shelves-vs-grid is Phase 5's, P5-T1)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The `?sort=hot` axis)
- `docs/design/exam-shelves-backend-design.md` (Interface Change Matrix — the `ExamSort` widening row, verbatim "one edit or the build is red between them")
- `docs/design/exam-shelves-backend-design.md` (Minimal Surface Alternatives, Element 1 — `ExamSort` value `"hot"`, selected: fourth value on existing axis)
- `docs/design/exam-shelves-frontend-design.md` (Implementation Path Mapping — `page.tsx` branch + `"hot"` whitelist row, and `catalogue.ts`'s `ExamSort` re-export widening row)
- `SOURCE/features/exams/queries/catalogue.ts` (`:21` current `ExamSort` union; `:32-36` `DEFAULT_ASCENDING`; `:105-117` the outer `if (filters?.sort) {...} else {...}` structure and its inner case list)
- `SOURCE/app/(exams)/exams/page.tsx` (`:46-47` current sort literal whitelist)
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (`:393-401`, `:447-456` — the existing cases this task's outer-structure preservation must keep green)

## Change Category
`Change Category: boundary-change`

`ExamSort`'s union widening is a `contract-change` per Design-to-Plan Traceability (both the backend and frontend DD rows), and this is explicitly the "must land in ONE commit" row. Sweep the adjacent case: every other `Record<ExamSort, ...>`-typed object in the codebase (if any beyond `DEFAULT_ASCENDING`) must also gain a `hot` entry in this same commit, or `tsc` will fail — grep for `Record<ExamSort` before committing.

## Reference Contracts
(none directly assigned to P4-T1 in the Reference Contract Values table — its correctness is governed by the Proof Obligations below and by the Connection Map's boundary check)

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `?sort=hot` querystring axis. Owner left: `ExamFilters.tsx` chip (`setSort`, P4-T4) + `ExamShelf`'s hot `viewAllHref` builder (P2-T3). Owner right (this task): `app/(exams)/exams/page.tsx` whitelist + `catalogue.ts` sort branch. Serialized format: `?sort=hot` exact literal — `page`/`dir` dropped by `setSort`. Consumer parse rule: literal whitelist in `page.tsx`; unknown ⇒ `undefined`. Expected signal: flat grid renders ordered by AC-018's cross-user count.

## Investigation Notes
_(Record here: confirmation this landed as exactly ONE commit via `git log`; a grep result confirming `DEFAULT_ASCENDING` is the only `Record<ExamSort, ...>`-typed object needing an update; confirmation the outer `if/else` structure at `:105-117` has 0 changes besides the inner case addition.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Grep the codebase for `Record<ExamSort` and `ExamSort` usages to confirm the full set of places needing a `hot` entry
- [ ] Write/stage the change locally and confirm `tsc` genuinely fails if the union is widened without a matching `DEFAULT_ASCENDING` entry (a concrete demonstration of the hard-commit-boundary rationale, not just trusting the DD's claim)
### 2. Green Phase
- [ ] Widen `ExamSort` union `+= "hot"`
- [ ] Add `hot: false` to `DEFAULT_ASCENDING`
- [ ] Add the inner sort-branch case: `else if (sort === "hot") query = .order("id")`, inside the existing outer `if (filters?.sort) {...} else {...}` structure, changing only the inner case list
- [ ] Add `"hot"` to `page.tsx`'s sort literal whitelist
- [ ] Stage and commit all of the above as **one single commit**
### 3. Refactor Phase
- [ ] Run `git log` and confirm exactly one commit touches both the union and the record entry
- [ ] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and confirm `:393-401`/`:447-456` still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Enforces: type correctness incl. `ExamSort` whitelist parity across its 3 declaration sites — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`, `app/(exams)/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx tsc --noEmit` immediately after staging all 4 edits together; `git log` inspection to confirm single-commit landing; `npx vitest run features/exams/__tests__/rating.int.test.ts` for the outer-structure preservation check.
- **Success criteria**: `tsc` passes with all 4 edits present; `git log` shows exactly 1 commit touching both `catalogue.ts:21` and `catalogue.ts:32-36`; `rating.int.test.ts:393-401`/`:447-456` unchanged and green.
- **Failure response**: if `tsc` fails partway through staging, that is the expected demonstration of why this must be one commit — do not commit the partial state; keep staging until all 4 edits are present, then commit.
- **Verification level**: L2.

## Proof Obligations
- **Claim**: the outer `if (filters?.sort) {...} else {...}` structure at `catalogue.ts:105-117` stays untouched — only the inner case list gains one branch.
  - **Primary failure mode**: refactoring the outer structure while adding the inner branch (e.g. restructuring the if/else into a switch) risks silently changing behavior for the 3 existing sort values or the no-sort default path.
  - **Boundary to exercise**: integration test (`rating.int.test.ts:393-401`, `:447-456`).
  - **State assertion**: N/A (query construction, no state transition).
  - **Mock boundary rationale**: `rating.int.test.ts` mocks the Supabase client at its established boundary, unchanged by this task.
  - **Residual**: this proves the existing 3-sort-value paths are undisturbed; that the new `hot` branch itself produces correct output is P4-T2's/P4-T3's proof obligation.
- **Claim** (no-op, Failure Mode Checklist): `DEFAULT_ASCENDING.hot: false` is inert until `?sort=hot` is actually chosen — adding this record entry causes 0 behavior change for any existing sort value.
  - **Primary failure mode**: the new record key accidentally becomes the object's default/fallback value for an undefined sort key, changing behavior for requests with no `sort` param at all.
  - **Boundary to exercise**: integration test — confirm the no-`sort`-param default path is unaffected.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none beyond the existing test's mock boundary.
  - **Residual**: none.
- **Claim** (single-commit boundary itself): the union widening and the `DEFAULT_ASCENDING` entry cannot be split across commits without an intermediate red `tsc` state.
  - **Primary failure mode**: a well-intentioned "smaller commits" instinct splits this into 2 commits, leaving an intermediate commit that fails `tsc` — which the plan's hard constraint explicitly forbids being shippable even momentarily.
  - **Boundary to exercise**: `tsc --noEmit` at the commit boundary.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none — this is a static type-check, not a runtime test.
  - **Residual**: none — this is a process constraint, fully verifiable by `git log` + `tsc`.

## Completion Criteria
- [ ] `git log` confirms exactly ONE commit touches both the union widening and the `DEFAULT_ASCENDING` entry (plus the inner branch and the page whitelist)
- [ ] `tsc --noEmit` passes
- [ ] `rating.int.test.ts:393-401`/`:447-456` pass unmodified
- [ ] Every adjacent `Record<ExamSort, ...>`-typed object (per the Change Category sweep) confirmed updated in the same commit
- [ ] Gates 1-6 green

## Notes
- Impact scope: `catalogue.ts` (union, record, inner branch), `page.tsx` (whitelist only — no branch/render logic here, that is P5-T1).
- Scope boundary — preserve unchanged: `catalogue.ts:105-117`'s outer `if/else` structure; `page.tsx`'s shelves-vs-grid branch logic (explicitly out of scope for this task, reserved for P5-T1).
