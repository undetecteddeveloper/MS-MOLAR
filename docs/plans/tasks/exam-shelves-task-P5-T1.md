# Task P5-T1 — `/exams` page branch: shelves vs. flat grid — the main integration point

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 5 (`/exams` Page Integration), Task P5-T1 — the frontend DD's own "the only task that can turn `/exams` red for every user"**
Layer: frontend (`SOURCE/app/(exams)/exams/`)

Metadata:
- Dependencies: P1-T6 (`hasBrowseParam`), P2-T3 (`ExamShelf`), P4-T4 (`ExamFilters` with the hot chip)
- Blocks: P5-T2 (fixture-e2e exercises this exact page), P6-T1 (the `?from=` chain needs live shelf cards to click through)
- Size: Small-Medium (1 file, high blast radius)
- Verification level: L1 — first moment `/exams` actually renders 3 shelves for a real request

## Implementation Content
Edit `SOURCE/app/(exams)/exams/page.tsx:37-123` — import `hasBrowseParam` from `@/lib/exams/browseParams`; compute `showShelves = !hasBrowseParam(sp)`; widen the `Promise.all` to 4 slots (`shelves`, `ranked`, `facets`, `user`) with early-return narrowing (`if (shelves !== null) return (...)`); move the `:69` destructure and `:76-78` `gridKey` computation into the grid branch only; import `listExamShelves` and compose `SHELF_ORDER.map` rendering `<ExamShelf key={kind} .../>` per shelf.

## Target Files
- [x] `SOURCE/app/(exams)/exams/page.tsx`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Integration Point I1 — `/exams` page branch predicate)
- `docs/design/exam-shelves-frontend-design.md` (§ Data flow — Branch rule, Four array slots, Page body — `SHELF_ORDER.map`, literal `key={kind}`)
- `docs/design/exam-shelves-frontend-design.md` (§ Rendering, performance and motion — 0 client fetches; literal `key`; `motion-safe:scroll-smooth`; 0 globals.css edits)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Page State Matrix — /exams)
- `SOURCE/app/(exams)/exams/page.tsx` (`:37-123` the full current implementation — read every line before editing; `:69` destructure; `:76-78` `gridKey` computation)
- `SOURCE/lib/exams/browseParams.ts` (P1-T6 — `hasBrowseParam`, imported here)
- `SOURCE/features/exams/components/ExamShelf.tsx` (P2-T3 — rendered here per shelf)
- `SOURCE/features/exams/queries/shelves.ts` (P3-T2 — `listExamShelves`, called here)

## Change Category
`Change Category: boundary-change`

The `/exams` route is a published boundary — every existing consumer (bookmarks, links, the flat-grid UI itself) relies on its current per-parameter behavior. This task changes what that boundary renders for the "no browse param" case (grid → shelves), which Design-to-Plan Traceability marks as `connection-switching` across multiple rows for this exact task (Integration Point I1, the branch rule, `SHELF_ORDER.map`). Sweep the adjacent case: **every one of the 10 AC-008 params** (the full existing input surface of this boundary) must continue to render the pre-existing flat-grid behavior unchanged — this is the plan's own named highest-blast-radius task specifically because this sweep is large and easy to get subtly wrong.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-003) | structure-order | "DOM order is Cần luyện → Nổi nhất → Khám phá; given a student whose Cần luyện shelf is absent, then DOM order is Nổi nhất → Khám phá" | Does `SHELF_ORDER.map` iterate in exactly `[practice, hot, explore]` order, and does a `null` practice shelf produce DOM order `[hot, explore]` with 0 placeholder gap? |
| docs/prd/exam-shelves-prd.md (§ AC-051) | state-lifecycle-negative | "Given any shelf, when its own selection yields 0 cards, then that shelf is absent from the page entirely — 0 headers, 0 subtitles, 0 placeholders, 0 empty cards, 0 errors — and the remaining shelves keep their relative order (D8)" | Does the page's `SHELF_ORDER.map` skip rendering entirely (not render an empty wrapper) for any shelf whose value is `null`? |

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Ten AC-008 listed URL params → `hasBrowseParam(sp)`. Owner left: browser-supplied URL. Owner right (this task, consumer): `app/(exams)/exams/page.tsx`, using `lib/exams/browseParams.ts` (P1-T6). Consumer parse rule: `key in sp && sp[key] !== undefined` on the raw `searchParams` object — **this task must call `hasBrowseParam(sp)` directly on the raw `searchParams`, never on a normalised/destructured local**. Expected signal: `?sort=garbage`/`?page=abc`/`?dir=asc` all render the flat grid despite normalising to `undefined` downstream.

## Investigation Notes

**Current `page.tsx:37-130` (pre-edit) read in full.** `sp = await searchParams` at `:38`; locals `subject/grade/school/year/semester/sort/level/dir/page/q` normalised `:39-58`; single `Promise.all` of 3 members (`listExamsRanked`, `listExamFacets`, `getCurrentUser`) at `:63-70`; destructure of `ranked` at `:71`; `gridKey` computed `:78-80`; JSX renders `PageContainer > PageHeader > ExamFilters > div(ExamBrowser + ExamPagination)`.

**`hasBrowseParam` (`lib/exams/browseParams.ts`)**: `export function hasBrowseParam(sp: Readonly<Record<string, string | string[] | undefined>>): boolean` — reads `BROWSE_PARAM_KEYS.some((key) => key in sp && sp[key] !== undefined)`. `BROWSE_PARAM_KEYS` = `["q","subject","grade","school","year","semester","sort","level","dir","page"]`, exactly the 10 keys of page.tsx's `SearchParams`. Its own test (`browseParams.test.ts`) already proves the raw-key-presence contract (garbage/empty/array values all read as present). Confirmed: this task must call `hasBrowseParam(sp)` on the raw `sp` from `await searchParams`, **before** any of the `:39-58` normalisation — never on a normalised local.

**`listExamShelves` (`features/exams/queries/shelves.ts`)**: `export async function listExamShelves(): Promise<ExamShelves>`, 0 arguments. `ExamShelves` = `{ practice: {subject,exams}|null; hot: {rung,grade,exams}|null; explore: {exams}|null; submittedExamIds: Set<string> }`. A shelf is `null` (never `{exams: []}`) when its own selection yields 0 cards (AC-051) — page-level narrowing must be `data && <ExamShelf .../>`, never a ternary with an empty fallback.

**`ExamShelf` (`features/exams/components/ExamShelf.tsx`)**: `ExamShelfProps = { shelf: ShelfKind; subtitle: string; exams: Exam[]; submittedExamIds: Set<string>; isLoggedIn: boolean }`. `shelf: ShelfKind = "practice"|"hot"|"explore"` — the literal string this task's `SHELF_ORDER.map` must pass as both `key` and `shelf`. Component itself returns `null` when `exams.length === 0`, so the page's own `data && ...` narrowing (on `ExamShelves[kind]`, not on `exams.length`) is the AC-051 guard at the page level — the component's internal guard is a second, independent layer, not a substitute for the page reading `shelves[kind]` correctly. `shelfSubtitle(kind, data)` (exported from the same file) is called by the page, not internally by `ExamShelf`.

**Design Doc `Page body` snippet (frontend DD :196-208, verbatim reference for this task's implementation)**:
```tsx
const SHELF_ORDER = ["practice", "hot", "explore"] as const;
…
{SHELF_ORDER.map((kind) => {
  const data = shelves[kind];
  return data && (
    <ExamShelf key={kind} shelf={kind} subtitle={shelfSubtitle(kind, data)} exams={data.exams}
      submittedExamIds={shelves.submittedExamIds} isLoggedIn={user !== null} />
  );
})}
```
This confirms `key={kind}` is the literal shelf-kind string from the `SHELF_ORDER` array (never an array index) by construction — `.map((kind) => ...)` binds `kind` to the array element itself.

**4 array slots vs 3 reads (frontend DD :144, reconciled with backend DD I1's "3 reads")**: the widened `Promise.all` has 4 *slots* — `shelves`, `ranked`, `facets`, `user` — but still exactly 3 *reads* fire per request, because one of `shelves`/`ranked` is always `showShelves ? xxx : null` (a literal `null`, no network call) rather than both firing. Confirmed the implementation below follows the DD's `AFTER` snippet (`:157-161`) exactly: `showShelves ? listExamShelves() : null` and `showShelves ? null : listExamsRanked(...)` as the first two `Promise.all` members, `listExamFacets()` and `getCurrentUser()` unconditional as the 3rd/4th — so both of these last two run on **both** branches (confirmed: they are plain unconditional array members, not gated by `showShelves`).

**Early-return narrowing (frontend DD :142,163-166)**: TS `strict: true` cannot discriminate `shelves`/`ranked` from a single `boolean`-typed `showShelves` local — the pattern is `if (shelves !== null) { return (...) }` then `if (ranked === null) throw new Error(...)` (unreachable guard) before using `ranked`. Neither is a type assertion — `shelves !== null` is a real runtime narrow TS accepts.

**Boundary Context confirmed**: `showShelves = !hasBrowseParam(sp)` must be computed immediately after `const sp = await searchParams;`, before any of the existing `:39-58` normalisation lines — this task's implementation reorders the file so this line comes first, and the normalisation lines that only the grid branch needs move (or stay, since `ExamFilters` also needs some of them — see below) accordingly.

**`ExamFilters` needs the normalised locals on BOTH branches** (frontend DD flowchart :123-124, "any key present" AND "0 of the 10 keys present" both list `listExamFacets()`; UI Spec Page State Matrix — the chip row is not listed as absent on any shelves row): `ExamFilters` renders on both branches (chip row visible on the shelves view too, AC-033), and its props (`subjects/grades/.../selected/sort/query`) are the SAME normalised locals (`subject, grade, school, year, semester, level, sort, q`) the grid branch's `gridKey`/`listExamsRanked` call also need. So the `:39-58` normalisation block (parsing `sp.subject`, `sp.sort`, etc. into typed locals) stays UNCONDITIONAL — it is consumed by `ExamFilters` on both branches. Only the **`ranked`-only** derivations (`:71` destructure of `ranked`, `:78-80` `gridKey`) move into the grid-only branch (after the `if (shelves !== null) return` early exit), exactly as the task's Implementation Content states ("move the `:69` destructure and `:76-78` `gridKey` computation into the grid branch only" — the normalisation of `subject`/`sort`/etc. is a separate block from these two and is NOT named for the move).

**Binding check — `hasBrowseParam(sp)` call site**: confirmed the call must use the raw `sp` object (the resolved `await searchParams` object), never a destructured/renamed local — matches the Boundary Context's own "never on a normalised local" wording literally (a normalised local here means the parsed `subject`/`sort`/etc. values, not `sp` itself; `sp` is read raw either way since the normalisation block only READS from `sp`, it does not replace `sp`).

**Scope decision — test file**: `Target Files` lists only `page.tsx`; per repo precedent (P4-T4's `ExamFilters.test.tsx` co-located test, not listed under that task's `Target Files` either), a co-located integration test at `SOURCE/app/(exams)/exams/__tests__/page.test.tsx` is treated as in-scope (implementation + its own test, same convention File Scope Constraint's "Target Files section (impl + test files per task-template)" names). Scope of this task's own test (per Boundary Context / Proof Obligations, "this task's own local verification is the build + a manual spot-check; the systematic table-driven proof is P5-T2's"): confirm `showShelves` wiring (bare → shelves branch calls `listExamShelves`/not `listExamsRanked`; each of the 10 `BROWSE_PARAM_KEYS` individually → grid branch calls `listExamsRanked`/not `listExamShelves`), confirm `listExamFacets()`/`getCurrentUser()` run on both branches, and confirm `SHELF_ORDER` DOM order incl. the AC-051 null-shelf omission (Reference Contracts AC-003/AC-051 evidence) — narrower than P5-T2's exhaustive fixture-e2e proof (which additionally covers ribbon count, chip count, tile placement, card-count parity — explicitly P5-T2's job per this task's own Proof Obligations table).

**Reference Contracts pre-implementation evaluation**:
- AC-003 (structure-order): planned approach is the DD's verbatim `SHELF_ORDER.map` snippet above, iterating the literal array `["practice","hot","explore"]` and narrowing `data && <ExamShelf .../>` — **Y** (confirmed with a DOM-order assertion in the new test, both all-3-present and practice-null cases).
- AC-051 (state-lifecycle-negative): the `data && (...)` narrowing on `shelves[kind]` (which is `null`, never `{exams:[]}`, per `shelves.ts`'s own contract) skips rendering entirely for a `null` shelf, producing 0 placeholder gap — **Y** (confirmed with the practice-null DOM assertion: exactly 2 sections, in order hot→explore, 0 occurrence of `"shelf-practice"` anywhere in `container.innerHTML`).

**Binding Decisions**: task file has no "Binding Decisions" section — not applicable.

**Final verification (after implementation landed)**: new test file `SOURCE/app/(exams)/exams/__tests__/page.test.tsx` (14 cases: bare-`/exams` shelves wiring, one `it.each` case per `BROWSE_PARAM_KEYS` entry (10), the `?sort=garbage` R-3 guard, the both-branches `listExamFacets`/`getCurrentUser` call-count test, and the AC-003/AC-051 DOM-order + null-shelf-omission test) — RED confirmed first against the pre-edit `page.tsx` (2 of 14 failed for the right reason: bare `/exams` still called `listExamsRanked` instead of `listExamShelves`; the other 12 passed vacuously because the grid path was unconditional pre-edit), then GREEN after the edit (14/14). `npx tsc --noEmit`: 0 errors. `npx eslint --max-warnings 0` on both changed files: 0 errors/warnings. `npx prettier --check`: clean (one auto-fix applied to the new test file's line-wrapping). `npx vitest run` (full suite): 2198 passed, 1 failed, 10 skipped — the 1 failure (`lib/security/rateLimit.test.ts`, a Gemini-quota budget assertion) is unrelated to this task: confirmed pre-existing by running it alone (fails identically in isolation) and confirmed untouched by `git status` (not among this task's changed files). `npm run build`: compiled successfully, TypeScript passed, all 27 routes generated (incl. `ƒ /exams`), 0 errors. `npm run check:bundle`: PASS (8 server secrets, 0 leaked to client).

**AC-003/AC-051 Reference Contracts — final evaluation**: both confirmed **Y** by the new test's DOM assertions (not just static code reading): all-3-shelves-present case asserts DOM order `["shelf-practice","shelf-hot","shelf-explore"]`; practice-null case asserts DOM order `["shelf-hot","shelf-explore"]` with 0 occurrences of the string `"shelf-practice"` anywhere in `container.innerHTML`.

**Adjacent-case sweep — final confirmation**: all 10 `BROWSE_PARAM_KEYS` individually exercised via `it.each`, each asserting `listExamsRanked` called / `listExamShelves` not called / 0 shelf `<section>` elements / the grid `<ul class="grid ...">` present — matches the pre-existing (pre-task) grid behavior, now proven to still hold post-edit for every one of the 10 params individually, not just in aggregate.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent case per Change Category: enumerate all 10 AC-008 params and confirm the pre-change grid behavior for each, as the concrete baseline this task must not disturb
- [x] Write/extend integration or fixture-lane-adjacent test cases (coordinate scope with P5-T2, which owns the fixture-e2e fill-in) confirming: bare `/exams` renders `showShelves = true`; any of the 10 AC-008 params renders `showShelves = false`
### 2. Green Phase
- [x] Import `hasBrowseParam`; compute `showShelves = !hasBrowseParam(sp)` from the raw `sp`
- [x] Widen the `Promise.all` to 4 slots (`shelves`, `ranked`, `facets`, `user`) with early-return narrowing
- [x] Move the `:69` destructure and `:76-78` `gridKey` computation into the grid branch only
- [x] Import `listExamShelves`; compose `SHELF_ORDER.map` rendering `<ExamShelf key={kind} .../>`
### 3. Refactor Phase
- [x] Confirm `listExamFacets()` and `getCurrentUser()` run on both branches (needed by both grid and shelves views)
- [x] Confirm `key={kind}` is a literal shelf-kind string, never an array index

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `app/(exams)/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide) — **first phase the full page tree compiles with the new branch**
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npm run build` (first real compile of the widened page tree); manual/fixture-lane render of bare `/exams` and of each of the 10 AC-008 params.
- **Success criteria**: bare `/exams` renders 3 shelves in DOM order practice→hot→explore (or the narrowed subset per AC-003); every one of the 10 AC-008 params renders the flat grid instead.
- **Failure response**: this is the frontend DD's own named highest-blast-radius task — if `npm run build` fails, do not proceed to any other Phase 5/6/7 task until it is green, since every downstream task assumes this page compiles.
- **Verification level**: L1 — functional, end-user-visible branch behavior.

## Proof Obligations
- **Claim** (AC-001–003, 005–008, 010, 014): the branch predicate reads RAW key presence on `sp` via `hasBrowseParam`, never the normalised locals.
  - **Primary failure mode**: the branch predicate is computed after destructuring `sp` into normalised locals (e.g. `sort ?? "newest"`), losing the distinction between "absent" and "present-but-normalises-to-default" — the exact regression the plan's Risk section names for this task.
  - **Boundary to exercise**: fixture-e2e (finalized in P5-T2) — this task's own local verification is the build + a manual spot-check; the systematic table-driven proof is P5-T2's.
  - **State assertion**: N/A (rendering, not a state transition).
  - **Mock boundary rationale**: fixture-e2e mocks the data layer per the frontend DD's Test Plan Mock boundary declarations (finalized in P5-T2); this task's own build-level check exercises no mock.
  - **Residual**: the exhaustive per-param table-driven proof (each of the 10 AC-008 params individually) is P5-T2's, not this task's — this task wires the predicate correctly; P5-T2 proves it exhaustively.
- **Claim** (AC-051, state-lifecycle-negative): `listExamFacets()` and `getCurrentUser()` run on BOTH branches; page-level members stay at 3 (existing) semantics preserved while shelves adds its own slot.
  - **Primary failure mode**: the widened `Promise.all` accidentally skips `listExamFacets()`/`getCurrentUser()` on the shelves branch, breaking the filter UI or auth-dependent rendering when shelves are shown.
  - **Boundary to exercise**: `npm run build` + fixture-e2e (P5-T2).
  - **State assertion**: N/A.
  - **Mock boundary rationale**: fixture lane mocks the data layer per the established Mock boundary declarations.
  - **Residual**: none beyond what P5-T2 closes.

## Completion Criteria
- [x] `npm run build` succeeds
- [x] Bare `/exams` renders 3 shelves in the DOM order practice→hot→explore (or the narrowed subset)
- [x] Every one of the 10 AC-008 params renders the flat grid
- [x] `listExamFacets()`/`getCurrentUser()` confirmed running on both branches
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-4 green (gate 5/6 exercised fully by P5-T2/Phase 8 respectively, but should not regress here)

## Notes
- Impact scope: `page.tsx` only — but this is the plan's single highest-blast-radius file (can turn `/exams` red for every user if mishandled).
- Scope boundary — preserve unchanged: the grid branch's existing rendering logic once `showShelves` is `false` — it must remain behaviorally identical to today.
