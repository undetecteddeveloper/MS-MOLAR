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
- [ ] `SOURCE/features/exams/components/ExamFilters.tsx`

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
_(Record here: confirmation the 3 pre-existing `QUICK` entries have 0 changed properties — a literal diff of those 3 lines should be empty; confirmation `setSort` drops `page`/`dir` when the hot chip is selected, matching the other 3 chips' existing behavior.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Sweep the adjacent case per Change Category: record the 3 pre-existing `QUICK` entries' exact current props before making any edit
- [ ] Write/extend a component test asserting: 5 total chips render in order `Bộ lọc, Mới nhất, Cũ nhất, Khó nhất, Nổi nhất`; the 3 pre-existing chips' props are unchanged; selecting the new chip produces a URL with `?sort=hot` and no `page`/`dir`
### 2. Green Phase
- [ ] Widen the local `ExamSort` union
- [ ] Add the 4th `QUICK` entry using `exams.sortHot`
### 3. Refactor Phase
- [ ] Diff the 3 pre-existing `QUICK` entries against their pre-task state and confirm 0 changes

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
- [ ] `QUICK` gains exactly 1 new entry; the 3 existing entries are byte-identical to before this task
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `ExamFilters.tsx` (local union + `QUICK` array) only.
- Scope boundary — preserve unchanged: every prop of the 3 pre-existing sort chips and the `Bộ lọc` chip.
