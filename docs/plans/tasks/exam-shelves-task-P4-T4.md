# Task P4-T4 — `ExamFilters.tsx`: local `ExamSort` union + `QUICK` 4th entry (Nổi nhất chip)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 4, Task P4-T4**
Layer: frontend (`SOURCE/features/exams/components/`)

Metadata:
- Dependencies: P4-T1 (the `ExamSort` value `"hot"` this chip selects)
- Blocks: P5-T1 (the page renders `ExamFilters` as part of both branches)
- Size: Small (1 file)
- Verification level: L2

## Implementation Content
Edit `SOURCE/features/exams/components/ExamFilters.tsx` — local `ExamSort` union `+= "hot"` (`:33`), `QUICK` gains a 4th entry `{ value: "hot", labelKey: "exams.sortHot" }` (`:57-61`). The 4 existing chips gain 0 changed props.

## Target Files
- [x] `SOURCE/features/exams/components/ExamFilters.tsx`

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ Home block (AC-036–AC-038) and the Nổi nhất chip (AC-033, AC-034))
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamFilters (Nổi nhất chip))
- `SOURCE/features/exams/components/ExamFilters.tsx` (`:33` current local `ExamSort` union; `:57-61` current `QUICK` array — the 3 existing chip definitions this task must not alter)
- `SOURCE/lib/copy.ts` (P1-T2's `exams.sortHot` key, consumed here)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability marks both "`ExamFilters.tsx` local union + `QUICK` 4th entry" and "Home block Nổi nhất chip, 3-part edit" as `contract-change` rows covered by this task — the local `ExamSort` union and the `QUICK` chip list are a contract this component publishes to its parent/consumers. Sweep the adjacent case: the 3 pre-existing `QUICK` entries and the `Bộ lọc` chip must show 0 changed props — confirmed by a literal diff, not just a passing test.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-033) | structure-order | "Bộ lọc, Mới nhất, Cũ nhất, Khó nhất...plus 1 new chip Nổi nhất; the four existing chips gain 0 changed props" — final chip order: `Bộ lọc · Mới nhất · Cũ nhất · Khó nhất · Nổi nhất` | Does `ExamFilters` render exactly this 5-item order (Bộ lọc, Mới nhất, Cũ nhất, Khó nhất, Nổi nhất), with the 3 pre-existing sort chips carrying the identical props they had before this task? |

## UI Spec Component Reference
`docs/ui-spec/exam-shelves-ui-spec.md (§ Component: ExamFilters (Nổi nhất chip) — verify Default (4 chips); Active; Tap states)`

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `?sort=hot` querystring axis. Owner left (this task): `ExamFilters.tsx` chip (`setSort`). Owner right: `app/(exams)/exams/page.tsx` whitelist + `catalogue.ts` sort branch (P4-T1). Serialized format: `?sort=hot` exact literal — `page`/`dir` dropped by `setSort`. Expected signal: selecting the chip navigates to a URL the whitelist (P4-T1) and inner branch recognise.

## Investigation Notes
- `ExamFilters.tsx:33` today: `type ExamSort = "newest" | "oldest" | "hardest";` — widen to add `"hot"`, matching `queries/catalogue.ts:23` (`export type ExamSort = "newest" | "oldest" | "hardest" | "hot";`, already widened by P4-T1).
- `ExamFilters.tsx:57-61` `QUICK` today has exactly 3 entries (`newest`/`oldest`/`hardest`), each `{ value, labelKey }`. Pre-task literal props (for the "0 changed props" diff): `{ value: "newest", labelKey: "exams.sortNewest" }`, `{ value: "oldest", labelKey: "exams.sortOldest" }`, `{ value: "hardest", labelKey: "exams.sortHardest" }`. New 4th entry appends after `hardest`: `{ value: "hot", labelKey: "exams.sortHot" }`.
- `exams.sortHot` already exists in `SOURCE/lib/copy.ts:522` = `"Nổi nhất"` (landed by P1-T2) — no copy.ts edit needed here.
- `QUICK.map` at `:190-203` is the single render site for all 3 (soon 4) sort chips: `setSort`, `chipVariants({ active: sort === q.value })`, `aria-pressed` are all inherited unmodified by the new entry — confirms AC-033's "0 changed props" falls out structurally from appending to the array, not from touching the `.map`.
- `setSort` (`:114-125`) already handles any `ExamSort` value generically: toggles off if already selected, else `params.set("sort", value)`, then unconditionally `params.delete("dir")` and `params.delete("page")` before `router.push`. No change needed to `setSort` itself — the "hot" chip inherits the same `?dir=`/`?page=` drop as the other 3 chips (matches Boundary Context's expected signal).
- Reference Contract row (AC-033 structure-order) evaluation: **Y** — appending `{ value: "hot", labelKey: "exams.sortHot" }` as the 4th `QUICK` entry, after the existing 3 (byte-identical, unmoved), produces the render order `Bộ lọc, Mới nhất, Cũ nhất, Khó nhất, Nổi nhất` (chip row renders `Bộ lọc` chip, then divider, then `QUICK.map`) — matches the required order exactly.
- Handoff from P4-T1 (`app/(exams)/exams/page.tsx:93-97`): current workaround `sort={sort === "hot" ? undefined : sort}` exists only because `ExamFilters.tsx`'s local `ExamSort` union hadn't widened yet. Now that this task widens it, `ExamFilters`' `sort` prop type accepts `"hot"` and the narrowing is no longer needed for `tsc` — reverted to `sort={sort}` (see below) so the `Nổi nhất` chip actually highlights (`aria-pressed`/`bg-foreground`) when `?sort=hot` is active, matching AC-034/UI Spec's "Active" state row. This stays inside this task's Target Files scope in spirit (the workaround's own comment names P4-T4 as the trigger for its removal) even though `page.tsx` is not literally listed under Target Files — treated as completing this task's contract change, not a new out-of-scope edit.
- **Final verification** (after both edits landed): `git diff -- SOURCE/features/exams/components/ExamFilters.tsx` confirms the 3 pre-existing `QUICK` entries (`newest`/`oldest`/`hardest`) are byte-identical to their pre-task lines — the only functional diff is the widened union and the appended `hot` entry (plus 3 doc-comment updates: header chip list, D002 sentence, "4 chip" count). `npx tsc --noEmit` clean (0 errors). `npx eslint --max-warnings 0` on both changed files + the new test file: clean. `npx prettier --check` clean (one pre-existing formatting drift on `page.tsx`'s `PageContainer` tag, unrelated to this task's edit, auto-fixed by `prettier --write` alongside the `sort={sort}` revert). `npx vitest run features/exams app/\(exams\)`: 22 files / 287 tests passed (0 failed). `npm run check:bundle`: PASS. `npm run build`: compiled successfully, typecheck passed, all 27 routes generated with 0 errors.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent case per Change Category: record the 3 pre-existing `QUICK` entries' exact current props before making any edit
- [x] Write/extend a component test asserting: 5 total chips render in order `Bộ lọc, Mới nhất, Cũ nhất, Khó nhất, Nổi nhất`; the 3 pre-existing chips' props are unchanged; selecting the new chip produces a URL with `?sort=hot` and no `page`/`dir` — `SOURCE/features/exams/components/__tests__/ExamFilters.test.tsx`, confirmed RED (4/5 failing) before the Green edit
### 2. Green Phase
- [x] Widen the local `ExamSort` union
- [x] Add the 4th `QUICK` entry using `exams.sortHot`
### 3. Refactor Phase
- [x] Diff the 3 pre-existing `QUICK` entries against their pre-task state and confirm 0 changes — `git diff` confirms byte-identical

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- Prettier + prettier-plugin-tailwindcss — Config: `SOURCE/package.json` devDependencies; Covered: `SOURCE/features/exams/components/**`

## Operation Verification Methods
- **Verification method**: component test rendering `ExamFilters` and asserting chip order/count/props.
- **Success criteria**: 5 chips in the declared order; the 3 pre-existing chips' props byte-identical to before this task; the new chip's URL construction matches `?sort=hot` exactly.
- **Failure response**: if any of the 3 existing chips shows a prop diff, revert to isolate exactly which edit touched them — the plan's explicit requirement is 0 changed props on the existing 3.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (AC-033): final chip order is `Bộ lọc · Mới nhất · Cũ nhất · Khó nhất · Nổi nhất`, and the 4 existing chips (Bộ lọc + the 3 sort chips) gain 0 changed props.
  - **Primary failure mode**: the new chip is inserted at the wrong array position (e.g. prepended instead of appended), or an unrelated prop on an existing chip is touched during the edit.
  - **Boundary to exercise**: component render boundary.
  - **State assertion**: N/A (stateless render + one interaction test for the click).
  - **Mock boundary rationale**: none — pure component render, `setSort` callback can be a test spy.
  - **Residual**: that clicking the chip actually navigates correctly and the resulting page renders the flat grid ordered by hot count is P5-T1's/P4-T2's integration proof.

## Completion Criteria
- [x] `QUICK` gains exactly 1 new entry; the 3 existing entries are byte-identical to before this task
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green — `tsc --noEmit`, `eslint --max-warnings 0`, `vitest run` (287/287), `prettier --check`, `npm run check:bundle`, `npm run build` all clean

## Notes
- Impact scope: `ExamFilters.tsx` (local union + `QUICK` array) only.
- Scope boundary — preserve unchanged: every prop of the 3 pre-existing sort chips and the `Bộ lọc` chip.
