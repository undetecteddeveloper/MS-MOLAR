# Task P2-T3 — `ExamShelf.tsx` (+ module-local `ExamShelfTile`, `shelfSubtitle()`)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 2, Task P2-T3**
Layer: frontend (`SOURCE/features/exams/components/`)

Metadata:
- Dependencies: P1-T2 (copy keys), P1-T4 (examShelves types), P2-T2 (ExamCard's 3 props)
- Blocks: P5-T1 (the `/exams` page renders `<ExamShelf>` per shelf)
- Size: Medium (2 new files)
- Verification level: L2

## Implementation Content
Create `SOURCE/features/exams/components/ExamShelf.tsx` (`ExamShelf` async server component, module-local `SHELF` map, module-local `ExamShelfTile`, exported `shelfSubtitle()`). Create `SOURCE/features/exams/components/__tests__/ExamShelf.test.tsx`.

## Target Files
- [ ] `SOURCE/features/exams/components/ExamShelf.tsx` (new)
- [ ] `SOURCE/features/exams/components/__tests__/ExamShelf.test.tsx` (new)

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ Data flow "Facts → strings", § Shelf composition table — SHELF map)
- `docs/design/exam-shelves-frontend-design.md` (§ Data contracts — `ExamShelf` 5-prop contract, 0 optional)
- `docs/design/exam-shelves-frontend-design.md` (Minimal Surface Alternatives, Element 3 — `ExamShelf` component split, selected A, `ExamBrowser` byte-untouched)
- `docs/design/exam-shelves-frontend-design.md` (§ Rendering, performance and motion — 0 client fetches; literal `key`; `motion-safe:scroll-smooth`; 0 globals.css edits)
- `docs/design/exam-shelves-backend-design.md` (§ Shelf composition, the SHELF map — `viewAllHref` templates)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamShelf — Default, Loading N/A server-rendered, Empty returns null, Error no per-shelf boundary, Partial not modelled)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Shelf composition (the SHELF map))
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Layout and scroll)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamShelfTile (Xem toàn bộ kho đề) — Default; Empty/Loading/Error N/A)
- `SOURCE/tests/helpers/renderServerTree` (same empty-tree hazard as `ExamCard` — a positive assertion must precede any negative/absence assertion)
- `SOURCE/lib/adaptive/examShelves.ts` (P1-T4 — the types/shapes this component's props are built from)
- `SOURCE/lib/copy.ts` (P1-T2 — the 16 keys, incl. `HOT_SUBTITLE`-mapped ones, this component consumes)
- `SOURCE/features/exams/components/ExamCard.tsx`, `SOURCE/features/exams/components/ExamRibbon.tsx` (P2-T2, P2-T1 — composed here)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability marks "§ Data contracts — ExamShelf 5-prop contract, 0 optional" and "§ Data flow — Facts → strings, shelfSubtitle(), HOT_SUBTITLE map" as `contract-change`. Sweep the adjacent case: this is a brand-new component with no prior consumer, so the sweep is forward-looking — confirm the 5-prop contract shape matches exactly what P5-T1 (the only consumer) will need, per the frontend DD's own data-flow pseudocode, to avoid a second contract revision at integration time.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/exam-shelves-backend-design.md (§ Shelf composition, the SHELF map); docs/ui-spec/exam-shelves-ui-spec.md (§ Shelf composition (the SHELF map)) | derived-display | SHELF map `viewAllHref` per shelf: `practice` → `/exams?subject={encodeURIComponent(exams[0].subject)}` (AC-050); `hot` → constant `/exams?sort=hot` (AC-035); `explore` → `null` — no header link at any breakpoint (AC-004) | Do all 3 shelves' header-link hrefs match these exact templates, and does the explore shelf render 0 header links at every breakpoint? |
| docs/prd/exam-shelves-prd.md (§ AC-012); docs/ui-spec/exam-shelves-ui-spec.md (§ Page State Matrix) | derived-display | "{subject} đang là môn điểm trung bình thấp nhất của bạn", where `{subject}` = `subjectLabel(subject)` — so `Chemistry` reads `Hóa học`, not the canvas shorthand `Hoá` | Does the practice shelf's subtitle interpolate `subjectLabel(subject)` (not the raw subject code or a shorthand) into the copy template? |
| docs/ui-spec/exam-shelves-ui-spec.md (§ Copy Keys) | derived-display | The 6 `HOT_SUBTITLE` rung→string mappings (see P1-T2's Reference Contracts table for the full list) | Does `HOT_SUBTITLE` map each of the 6 `HotRung` values to its declared copy key exactly, with 0 fallback to a generic string? |
| docs/prd/exam-shelves-prd.md (§ AC-026) | structure-order | "exactly 1 card (rank 1) carries the ribbon Hot nhất and ranks 2–10 carry 0 ribbons" | Does the hot shelf's card row render the ribbon prop on exactly the first card, and 0 ribbons on every other card, regardless of shelf size? |
| docs/prd/exam-shelves-prd.md (§ AC-032) | structure-order | "its last item is the Xem toàn bộ kho đề tile...the row holds at most 10 cards plus that tile" | Does `ExamShelfTile` render as the last `<li>` of the explore shelf's row only, with the row containing at most 10 `ExamCard`s plus the tile? |

## UI Spec Component References
- `docs/ui-spec/exam-shelves-ui-spec.md (§ Component: ExamShelf — verify Default + Loading (N/A, server-rendered) + Empty (returns null) + Error (no per-shelf boundary) + Partial (not modelled) states)`
- `docs/ui-spec/exam-shelves-ui-spec.md (§ Component: ExamShelfTile (Xem toàn bộ kho đề) — verify Default; Empty/Loading/Error N/A)`

## Failure Mode Checklist Coverage
- **shared-state dependency**: `ExamShelf`'s duplicated eligibility predicate consuming the ONE `submittedExamIds` set (see Proof Obligations).

## Investigation Notes
_(Record here: confirmation the practice/hot/explore `viewAllHref` values match the templates exactly; confirmation `subjectLabel()` is used, not a raw code; confirmation of the positive-assertion-before-empty-tree-check pattern used in the tests.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write failing cases for: AC-004 (icon+h2+subtitle+link per SHELF, no link on explore), AC-026 (1 ribbon at index 0, 0 at 1..9), AC-032 (tile last `<li>` on explore only), AC-035 (hot shelf header link = `/exams?sort=hot`, mirroring the AC-050 practice-shelf assertion), AC-039 (every card href carries the shelf's `?from=`), AC-051 (`exams: []` ⇒ returns `null`), AC-047 (every card a focusable link in DOM order, row has no `tabIndex`/`role`)
- [ ] Confirm each fails because the component does not yet exist
### 2. Green Phase
- [ ] Implement `ExamShelf.tsx`: the module-local `SHELF` map, `ExamShelfTile`, exported `shelfSubtitle()`, and the async server component itself
- [ ] Run tests and confirm all pass
### 3. Refactor Phase
- [ ] Confirm a positive assertion (a real shelf title/card) precedes every negative/absence assertion in the test file (same empty-tree hazard as `ExamCard`)
- [ ] Confirm 0 client fetches, literal `key` usage (no array-index keys), `motion-safe:scroll-smooth` class present, 0 edits to `globals.css`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- Prettier + prettier-plugin-tailwindcss — Config: `SOURCE/package.json` devDependencies; Covered: `SOURCE/features/exams/components/**`

## Operation Verification Methods
- **Verification method**: `npx vitest run features/exams/components/__tests__/ExamShelf.test.tsx`, via `renderServerTree`; a positive assertion (a real shelf title) must be found before any negative/empty assertion, matching the same hazard pattern the plan calls out for `ExamCard`.
- **Success criteria**: all AC-002/003/004/026/032/035/039/047/050/051 cases pass; the `viewAllHref`/`HOT_SUBTITLE` Reference Contracts match exactly.
- **Failure response**: if `exams: []` returns anything other than `null` (e.g. an empty `<section>`), fix to return `null` exactly — a present-but-empty shelf violates AC-051's "0 headers, 0 subtitles, 0 placeholders" requirement.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (AC-051, empty input): `exams: []` makes `ExamShelf` return exactly `null` — 0 headers, 0 subtitles, 0 placeholders, 0 empty-state cards, 0 errors.
  - **Primary failure mode**: the component renders a `<section>` wrapper with an empty body instead of returning `null`, leaving a visible-but-content-free gap on the page.
  - **Boundary to exercise**: component render boundary via `renderServerTree`.
  - **State assertion**: N/A (rendering).
  - **Mock boundary rationale**: none — props are supplied directly by the test.
  - **Residual**: that the page (P5-T1) correctly omits this shelf from `SHELF_ORDER.map`'s DOM output (rather than rendering a `null` placeholder that still occupies a list slot) is P5-T1's proof obligation.
- **Claim** (AC-026): exactly 1 card (rank 1) carries the ribbon; ranks 2-10 carry 0.
  - **Primary failure mode**: the ribbon condition is based on array index parity or a miscomputed rank instead of literal index 0.
  - **Boundary to exercise**: component render boundary.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: none.
- **Claim** (Failure Mode: shared-state dependency): `ExamShelf`'s per-card eligibility predicate (e.g. "already submitted, don't highlight as new") consumes the **same** `submittedExamIds` set the composition layer (P3-T2) computed once — it does not recompute or re-derive its own submitted-set.
  - **Primary failure mode**: `ExamShelf` independently re-derives which exams are submitted (e.g. from a prop it wasn't given, or by re-fetching), creating two sources of truth that can silently disagree once real data flows through in Phase 5.
  - **Boundary to exercise**: component render boundary + prop-shape inspection (does `ExamShelf`'s prop interface receive `submittedExamIds`/equivalent as data, or does it compute its own?).
  - **State assertion**: N/A at this pure-component layer; the shared-state proof is completed once P3-T2's single attempt-read composition is wired through P5-T1.
  - **Mock boundary rationale**: the composition-layer data is mocked/constructed directly in this task's test — the real single-read proof is P3-T2's.
  - **Residual**: full end-to-end proof that only ONE attempt read feeds all 3 shelves is P3-T2's Proof Obligation, not this component's; this task only proves the component's prop contract doesn't invite a second, parallel computation.

## Completion Criteria
- [ ] All added tests pass, covering the full AC list above
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`
- [ ] Gates 1-6 green

## Notes
- Impact scope: `ExamShelf.tsx` (new, incl. module-local `ExamShelfTile`), its test file (new). `ExamBrowser` is explicitly **not** touched (Minimal Surface Alternatives Element 3 — byte-untouched).
- Scope boundary — preserve unchanged: `globals.css` (0 edits, per frontend DD § Rendering, performance and motion).
