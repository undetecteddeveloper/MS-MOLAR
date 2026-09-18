# Task P2-T2 — `ExamCard.tsx`: 3 optional props (`ribbon`, `from`, `className`) — the AC-043 moment

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 2, Task P2-T2**
Layer: frontend (`SOURCE/features/exams/components/`)

Metadata:
- Dependencies: **P1-T1** (the pre-change snapshot MUST be committed before this task touches `ExamCard.tsx`)
- Blocks: P2-T3 (ExamShelf renders `<ExamCard>` with these props), P6-T1 (consumes the `?from=` producer boundary this task creates)
- Size: Small (2 files)
- Verification level: L2 — **this is the frontend DD's own named early verification checkpoint**

## THIS TASK CARRIES A HARD STOP CONDITION (frontend DD Risk R-2)

If the bare-card snapshot case requires `-u` to pass after this edit, **STOP and explain every diff hunk before continuing — do not run `-u` reflexively.** A bare-card diff means the prop addition leaked into the no-prop render path, which is exactly the regression AC-043 exists to catch.

## Implementation Content
Edit `SOURCE/features/exams/components/ExamCard.tsx:11-16,33-80` — add 3 optional props (`ribbon?`, `from?`, `className?`); href becomes conditional (`from ? .../${id}?from=${from} : .../${id}`); root class merges `className` via `cn("card-linked relative h-full", className)`; ribbon rendered as the **last** direct child of `Card` via `{ribbon ? <ExamRibbon label={ribbon} /> : null}` — never `{ribbon && …}`. Run Prettier + prettier-plugin-tailwindcss, then extend the AC-043 snapshot with 2 new cases (`from="hot"`, `ribbon="Hot nhất"`) — the bare-card case must **not** require `-u`.

## Target Files
- [ ] `SOURCE/features/exams/components/ExamCard.tsx`
- [ ] `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx`

## Investigation Targets
- `docs/design/exam-shelves-frontend-design.md` (§ ExamCard extension and the containment proof (AC-043))
- `docs/design/exam-shelves-frontend-design.md` (§ Field Propagation Map — the `?from=` chain, 7 boundary rows incl. "dropped, deliberately")
- `docs/design/exam-shelves-frontend-design.md` (Minimal Surface Alternatives, Element 1 — `ExamCard.from`, selected A)
- `docs/design/exam-shelves-frontend-design.md` (Minimal Surface Alternatives, Element 2 — `ExamCard.className`, selected A)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamCard (shelf-aware props))
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Containment Rule (AC-043))
- `SOURCE/features/exams/components/ExamCard.tsx` (`:11-16` current prop interface; `:33-80` current render body — the exact lines this task edits)
- `SOURCE/features/exams/components/__tests__/ExamCard.snapshot.test.tsx` (P1-T1's committed baseline — this task extends it, never recreates it)
- `SOURCE/features/exams/components/ExamRibbon.tsx` (P2-T1 — the component rendered when `ribbon` is set)

## Change Category
`Change Category: boundary-change`

Multiple Design-to-Plan Traceability rows mark this task's changes as `contract-change`: the 3 new props, the containment proof itself, `ExamCard.from` (Minimal Surface Element 1), `ExamCard.className` (Minimal Surface Element 2), and the `?from=` Field Propagation Map. Sweep the adjacent case: every existing call site of `ExamCard` (flat grid, home block) must continue to compile and render byte-identically with 0 of the 3 new props supplied.

## Binding Decisions
(none — this task is covered by Reference Contracts and Boundary Context, not an ADR Bindings row)

## Reference Contracts
(none directly assigned to P2-T2 in the work plan's Reference Contract Values table — its correctness is governed by the containment proof / Proof Obligations below instead)

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `ExamCard`/`ExamShelf` → browser URL `?from=` → exam detail page. Owner left (this task, producer): `features/exams/components/ExamCard.tsx`. Owner right: `app/(exams)/exams/[id]/page.tsx` (P6-T1, consumer). Serialized format: `?from=practice|hot|explore` — lowercase ASCII, single key, appended to `/exams/{id}`. Consumer parse rule: `searchParams: Promise<{from?: string}>`, read raw and untyped, no validation until `toAttemptSource()` (P1-T5). Expected signal: detail page's `from` value matches the shelf the card was followed from. **Roundtrip check this task owns**: the href this task emits (`/exams/{id}?from={from}`) must parse, at the consumer side, to exactly the `from` value this task was given — no encoding mismatch, no case transformation.

## Investigation Notes
_(Record here: the exact diff hunks for the bare-card case, confirmed empty/non-semantic; the `h3`/ribbon-count/href assertions' actual results for the 2 new cases.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Confirm P1-T1's snapshot is committed and green **before making any edit**
- [ ] Write the 2 new snapshot cases (`from="hot"`, `ribbon="Hot nhất"`) plus explicit structural assertions (see Proof Obligations) as failing tests first
### 2. Green Phase
- [ ] Add the 3 optional props to `ExamCard.tsx`'s interface
- [ ] Make href conditional on `from`
- [ ] Merge `className` via `cn("card-linked relative h-full", className)`
- [ ] Render `{ribbon ? <ExamRibbon label={ribbon} /> : null}` as the **last** direct child of `Card` (never `{ribbon && …}`, which would render a stray `0`/falsy value when `ribbon` is absent)
- [ ] Run Prettier + prettier-plugin-tailwindcss
- [ ] Generate/extend the snapshot for the 2 new cases only
### 3. Refactor Phase
- [ ] Run the bare-card case with **no `-u`** and confirm 0 diff — if any diff appears, STOP per the hard-stop condition above and explain every hunk before proceeding
- [ ] Confirm the 2 new cases' structural assertions all pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- Prettier + prettier-plugin-tailwindcss — Enforces: class-string order (must run before generating the AC-043 snapshot) — Config: `SOURCE/package.json` devDependencies; Covered: `SOURCE/features/exams/components/**`

## Operation Verification Methods
- **Verification method**: run `npx vitest run features/exams/components/__tests__/ExamCard.snapshot.test.tsx` with no `-u` flag; inspect the diff output directly rather than trusting a green summary line.
- **Success criteria**: bare-card case shows 0 diff against P1-T1's committed snapshot; `from="hot"` case's stretched-link href equals `/exams/{id}?from=hot`; `ribbon="Hot nhất"` case shows exactly 1 `[data-slot="ribbon"]`, `aria-hidden` count = bare count + 1, and `card.firstElementChild` still carries the `card-link` class.
- **Failure response** (frontend DD Risk R-2): **STOP, explain every diff hunk before continuing — do not run `-u` reflexively.**
- **Verification level**: L2 — this is the frontend DD's own named early verification checkpoint for the whole `ExamCard` extension.

## Proof Obligations
- **Claim** (AC-043): the bare-card snapshot survives with **no `-u`** after the 3-prop addition.
  - **Primary failure mode**: a prop default, a conditional branch, or a class-merge order change alters the bare-card render path even when none of the 3 props are supplied.
  - **Boundary to exercise**: component render boundary via `renderServerTree`/the project's snapshot-test render.
  - **State assertion**: N/A (rendering, not a state transition).
  - **Mock boundary rationale**: none — `ExamCard` at this point has no external data dependency beyond its props.
  - **Residual**: none — this is the containment proof itself, fully closed by the unmodified snapshot diff.
- **Claim**: `from="hot"` produces a stretched-link href of exactly `/exams/{id}?from=hot`.
  - **Primary failure mode**: the conditional href construction drops the query string, double-encodes it, or applies it to the wrong anchor element (not the stretched link).
  - **Boundary to exercise**: component render boundary.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: that the consumer side (`/exams/[id]/page.tsx`) actually reads this `from` value correctly is P6-T1's proof obligation — this task only proves the producer emits it correctly.
- **Claim** (AC-026, AC-044): `ribbon="Hot nhất"` renders exactly 1 `[data-slot="ribbon"]`, increases the page's `aria-hidden` count by exactly 1 over the bare-card baseline, and does not disturb `card.firstElementChild`'s `card-link` class.
  - **Primary failure mode**: `{ribbon && <ExamRibbon .../>}` used instead of the ternary, causing a stray falsy node (`0` or `false`) to render when `ribbon` is absent — the specific anti-pattern the plan explicitly forbids.
  - **Boundary to exercise**: component render boundary.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: that exactly 1 ribbon renders per **shelf** (not per card in isolation) is P2-T3's proof obligation (AC-026, rank 1 only).

## Completion Criteria
- [ ] Bare-card snapshot case shows 0 diff with no `-u`
- [ ] Both new snapshot cases pass with all stated structural assertions
- [ ] Every existing `ExamCard` call site confirmed still compiling with 0 props supplied (Change Category sweep)
- [ ] Boundary Context roundtrip check confirmed at the producer side (href format correct; consumer-side confirmation deferred to P6-T1)
- [ ] Gates 1-6 green

## Notes
- Impact scope: `ExamCard.tsx` (3 new optional props, conditional href, class merge, ribbon slot), its snapshot test (2 new cases, extending — not replacing — P1-T1's baseline).
- Scope boundary — preserve unchanged: every other prop and render branch of `ExamCard.tsx` not named above; `ExamBrowser` (byte-untouched per frontend DD Minimal Surface Alternatives Element 3, not this task's concern but a sibling constraint).
- **This task must not begin before P1-T1's snapshot is committed.**
