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
- [x] `SOURCE/features/exams/queries/catalogue.ts`
- [x] `SOURCE/app/(exams)/exams/page.tsx` (whitelist only — the branch/render logic for shelves-vs-grid is Phase 5's, P5-T1)

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

**Design Doc key observations**:
- Backend DD `§ The ?sort=hot axis` (:468-489): pseudocode is exactly
  `else if (sort === "hot") query = .order("id")` as the "only edit" to the
  inner case list; leaving the outer `else` alone is what keeps
  `rating.int.test.ts:393-401`/`:447-456` green (:485); `.order("id")` only
  gives a deterministic Node-side input — the real hot order is built later
  in `listExamsRanked` via `orderIdsByHotCount` (P4-T2, not this task).
- Backend DD Interface Change Matrix (:156, :120): `DEFAULT_ASCENDING` is
  `Record<ExamSort, boolean>` so tsc enumerates every site — confirmed
  empirically below (Red phase).
- Backend DD Minimal Surface Alternatives Element 1 (:565): `"hot"` selected
  as "a fourth value on the existing axis" (option c) — alternatives (a)/(b)
  rejected for failing AC-034/AC-035.
- Frontend DD Implementation Path Mapping (:60, :63, :116, :335-337):
  `page.tsx:46-47` gets `"hot"` in the whitelist (this task); a **separate**
  row (:62) gives `ExamFilters.tsx`'s own local `ExamSort` copy `+= "hot"`
  plus the `QUICK` 4th entry — explicitly a **different** existing-file row,
  owned by P4-T4 per this task's own Boundary Context ("Owner left:
  ExamFilters.tsx chip (setSort, P4-T4)"). Frontend DD :337 explicitly warns
  "Both or tsc fails" for the two-union coupling (queries-side + local copy).
- `rating.int.test.ts:393-401`/`:447-456`: the two pinned cases this task's
  outer-structure preservation must keep green (no-sort → `.order("id")`;
  `dir` without `sort` → same). Read in full; unmodified by this task.
- `rating.int.test.ts:780-832`: two **pre-existing `it.todo`** placeholders
  for `listExamsRanked({sort:"hot"})`'s rpc-budget assertions — explicitly
  scoped to `ranking.ts`'s not-yet-implemented `sort==="hot"` branch (P4-T2),
  not to `catalogue.ts`/`listExams`. Correctly out of this task's scope; left
  untouched as `.todo`.

**Grep sweep** (`grep -rn "Record<ExamSort" SOURCE` and `grep -rn "ExamSort" SOURCE`):
confirmed `DEFAULT_ASCENDING` (`catalogue.ts:32`, now :35-40) is the **only**
`Record<ExamSort, ...>`-typed object in the repo. `ExamFilters.tsx:33` has its
own **separate, non-`Record`-typed** local `type ExamSort = "newest" | "oldest"
| "hardest"` declaration (not a re-export of `catalogue.ts`'s type) — out of
this task's Target Files, unchanged here, owned by P4-T4.

**Red phase (concrete demonstration, not just trusting the DD's claim)**:
widened `ExamSort` union alone (added `"hot"`) with `DEFAULT_ASCENDING`
untouched → `npx tsc --noEmit` failed with exactly the predicted error:
`catalogue.ts(34,7): error TS2741: Property 'hot' is missing in type
'{ newest: false; oldest: true; hardest: false; }' but required in type
'Record<ExamSort, boolean>'.` Confirms the hard single-commit constraint is
real, not just documented.

**Green phase**: added `DEFAULT_ASCENDING.hot: false`, the inner
`else if (filters.sort === "hot") { query = query.order("id"); }` branch, and
`page.tsx`'s `sp.sort === "hot"` whitelist arm together. `npx tsc --noEmit`
then surfaced a **second, cross-file** error not named in this task's own
scope: `page.tsx:93` passes `sort={sort}` (now widened to include `"hot"`)
into `<ExamFilters sort={...} />`, whose **own local** `ExamSort` type
(`ExamFilters.tsx:33`, out of Target Files, owned by P4-T4) has not widened
yet — exactly the coupling the frontend DD warns about at :337 ("Both or tsc
fails"), but the two sides landed in different tasks (P4-T1 vs P4-T4) with no
documented intermediate-green state.

**Unimplemented Dependency Handling applied**: `ExamFilters.tsx`'s local
`ExamSort` widening is the "unimplemented dependency" (owned by P4-T4, not
yet landed). Found one local, reversible, contract-preserving construct
scoped to `page.tsx` (in Target Files): narrow the value passed into the
`ExamFilters` `sort` prop specifically — `sort={sort === "hot" ? undefined :
sort}` — via TS control-flow narrowing (not an unsafe cast; the `: sort`
branch is statically narrowed to exclude `"hot"`, so it type-checks against
`ExamFilters`' current 3-value union). This preserves both contracts: (1)
`listExamsRanked` below still receives the full, un-narrowed `sort` value
including `"hot"` — the actual purpose of this task; (2) `ExamFilters`
receives exactly the value range it receives today (no `"hot"` chip exists
yet, so none highlights — 0 behavior change). **Integration handoff for
P4-T4**: once `ExamFilters.tsx`'s local `ExamSort` widens and the `hot` QUICK
entry is added, this ternary should be revisited — most likely reverted to
`sort={sort}` — or the `"hot"` chip will never highlight even when selected,
since this narrowing always substitutes `undefined` for `"hot"`.

**Outer if/else structure preservation** (`catalogue.ts:105-117`, now
:110-127 after doc-comment growth): confirmed via `git diff` — the outer
`if (filters?.sort) {...} else { query = query.order("id"); }` shape is
byte-identical; the only structural change is one new `else if
(filters.sort === "hot") {...}` arm inserted into the existing inner
`if (filters.sort === "hardest") {...} else {...}` chain, between the
`"hardest"` branch and the final `else` (which still handles
`"newest"`/`"oldest"` exactly as before).

**Verification run**: `npx tsc --noEmit` → clean (0 errors) with all 5 edits
staged together (4 required by the task + the 1 local page.tsx narrowing
fix). `npx eslint --max-warnings 0` on both changed files → clean.
`npx vitest run features/exams/__tests__/rating.int.test.ts` → 29 passed, 2
todo (the pre-existing P4-T2-scoped placeholders above), 0 failed;
`:393-401`/`:447-456` both present and green among the 29.

**Boundary Context roundtrip note**: the work plan's Connection Map lists this
boundary's producer as `ExamFilters.tsx` chip (`setSort`, **P4-T4**) and
consumer as `page.tsx` whitelist (**this task**) — the map itself attributes
the row to `P4-T1, P4-T4` jointly. With the producer not yet built, no
chip exists to emit `?sort=hot`, so a real producer→consumer roundtrip test
cannot be constructed inside this task alone; the fixture-lane `?sort=hot`
case that exercises the full roundtrip (frontend DD `:411`, "second case
?sort=hot ⇒ 0 sections + ExamBrowser present") additionally depends on
`page.tsx`'s shelves-vs-grid branch, which is explicitly P5-T1's, not built
yet either. This task's own Proof Obligations (below) scope its test burden
to non-regression of the 3 pre-existing sort paths — the new `hot` branch's
correctness is explicitly deferred to P4-T2/P4-T3 ("that the new `hot`
branch itself produces correct output is P4-T2's/P4-T3's proof obligation").

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Grep the codebase for `Record<ExamSort` and `ExamSort` usages to confirm the full set of places needing a `hot` entry
- [x] Write/stage the change locally and confirm `tsc` genuinely fails if the union is widened without a matching `DEFAULT_ASCENDING` entry (a concrete demonstration of the hard-commit-boundary rationale, not just trusting the DD's claim)
### 2. Green Phase
- [x] Widen `ExamSort` union `+= "hot"`
- [x] Add `hot: false` to `DEFAULT_ASCENDING`
- [x] Add the inner sort-branch case: `else if (sort === "hot") query = .order("id")`, inside the existing outer `if (filters?.sort) {...} else {...}` structure, changing only the inner case list
- [x] Add `"hot"` to `page.tsx`'s sort literal whitelist
- [ ] Stage and commit all of the above as **one single commit** — DEFERRED BY DESIGN: orchestrator makes the actual commit after quality-checking (per task invocation instructions); all 4 edits (plus the 1 local `page.tsx` narrowing fix documented above) sit together, unstaged, in the working tree as one coherent set — none committed separately
### 3. Refactor Phase
- [ ] Run `git log` and confirm exactly one commit touches both the union and the record entry — DEFERRED: no commit exists yet (orchestrator's step); working-tree diff inspected instead (see Investigation Notes) and confirms all edits are co-resident
- [x] Run `npx vitest run features/exams/__tests__/rating.int.test.ts` and confirm `:393-401`/`:447-456` still pass — 29 passed, 2 todo (pre-existing, P4-T2-scoped), 0 failed

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
- [ ] `git log` confirms exactly ONE commit touches both the union widening and the `DEFAULT_ASCENDING` entry (plus the inner branch and the page whitelist) — PENDING orchestrator's commit; working tree currently holds all 4 required edits (+1 local narrowing fix) together, unstaged, none committed separately
- [x] `tsc --noEmit` passes
- [x] `rating.int.test.ts:393-401`/`:447-456` pass unmodified
- [x] Every adjacent `Record<ExamSort, ...>`-typed object (per the Change Category sweep) confirmed updated in the same commit — `DEFAULT_ASCENDING` is the only one (grep-confirmed); `ExamFilters.tsx:33`'s local `ExamSort` is a separate non-`Record`-typed declaration, out of scope, owned by P4-T4
- [ ] Gates 1-6 green — PENDING orchestrator's quality-check pass; `tsc`, targeted `eslint`, and targeted `vitest` verified clean by this task (see Investigation Notes); full-suite/build gates not run here per Responsibility Boundaries

## Notes
- Impact scope: `catalogue.ts` (union, record, inner branch), `page.tsx` (whitelist only — no branch/render logic here, that is P5-T1).
- Scope boundary — preserve unchanged: `catalogue.ts:105-117`'s outer `if/else` structure; `page.tsx`'s shelves-vs-grid branch logic (explicitly out of scope for this task, reserved for P5-T1).
