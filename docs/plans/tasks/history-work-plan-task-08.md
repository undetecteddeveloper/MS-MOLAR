# Task 08: `components/pdf/AttemptPdfTemplate.tsx` (Work Plan Phase 2, Task 2.3)

Metadata:
- Dependencies: none (uses design tokens directly)
- Provides: `AttemptPdfTemplate` component (consumed by Task 09's off-screen mount)
- Size: Small (2 files)

## Implementation Content

Create `SOURCE/components/pdf/AttemptPdfTemplate.tsx` (+ `AttemptPdfTemplate.test.tsx`, no skeleton — author fresh): presentational-only, every style a literal hex/rgb(a) value, no Tailwind `className`, no `components/ui/button.tsx` import (ADR-0009).

## Target Files
- [x] `SOURCE/components/pdf/AttemptPdfTemplate.tsx` (new)
- [x] `SOURCE/components/pdf/AttemptPdfTemplate.test.tsx` (new)

## Investigation Targets
- `docs/design/history-frontend-design.md` (§ PDF Generation Module — Deep Dive — the full `AttemptPdfTemplate` code excerpt, every literal hex/rgba value used)
- `docs/design/history-frontend-design.md` (§ Data Contracts — `AttemptPdfTemplate` yaml — `AttemptPdfTemplateProps` shape)
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Context point 2 — verified `oklch()`/`color-mix()` vs. html2canvas constraint; § Implementation Guidance — styling constraint)
- `SOURCE/app/globals.css` (lines 59-95 — confirmed-safe plain-hex/`rgb()` root tokens to read literal values from)
- `SOURCE/components/ui/button.tsx` (line 15 — the confirmed-unsafe `color-mix(in_oklch, ...)` hover state this component must never import or resemble)
- `docs/ui-spec/history-ui-spec.md` (§ Component: AttemptPdfTemplate — full visual layout spec: header/title/score/metadata-row/footer, exact colors)

## Investigation Notes

- **`docs/design/history-frontend-design.md` (§ PDF Generation Module — Deep Dive, lines 697-737)**: canonical code excerpt for `AttemptPdfTemplate` — `AttemptPdfTemplateProps` is exactly `{ examTitle: string; totalScore: number; submittedDateLabel: string; completionTimeLabel: string; generatedAtLabel: string }`; every style is an inline `style={{...}}` object using literal hex strings (`#ede1c8`, `#1b1512`, `#a62c2b`, `#6b655c`, `#b8863b`, `#d8c9a8`) — zero `className` anywhere, plain `<img>` for the logo (not `next/image`), `totalScore.toFixed(1)` formatted inline by the component itself (not pre-formatted by the caller, unlike the 3 date/time string props).
- **`docs/design/history-frontend-design.md` (§ Data Contracts, lines 418-430)**: confirms the same Props shape verbatim (`Contract: AttemptPdfTemplate(props: AttemptPdfTemplateProps): JSX.Element`); `Invariants: contains no per-question content (AC-006) — structurally true because AttemptPdfTemplateProps has no field capable of carrying it`; `Preconditions: all string fields already formatted by the caller (this component does no date/number formatting)` — this refers to the 3 label strings, not `totalScore` (a `number`, formatted internally via `.toFixed(1)`).
- **`docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Context point 2, § Implementation Guidance)**: `html2canvas` throws `Error: Attempting to parse an unsupported color function "oklch"` on `oklch()`/`color-mix(in oklch, ...)` — confirmed via `SOURCE/components/ui/button.tsx:15`'s `secondary` variant hover (`hover:bg-[color-mix(in_oklch,var(--secondary),var(--foreground)_5%)]`), confirmed unsafe. Root `globals.css` tokens (plain hex, or `rgb(... / ...)` for `--sidebar-border`) are confirmed safe. Constraint: this component's styles must resolve exclusively to plain hex/rgb(a) — no shadcn `Button` composition, no Tailwind slash-opacity utility (compiles to `color-mix()` regardless of base color).
- **`SOURCE/app/globals.css` (lines 59-95)**: literal hex values used — `--background #ede1c8`, `--foreground #1b1512`, `--brand #a62c2b`, `--border #d8c9a8`, `--ring`/copper accent `#b8863b`, `--muted-foreground #6b655c`. These 6 values match the task's Red-phase checklist exactly.
- **`SOURCE/components/ui/button.tsx` (line 15)**: `color-mix(in_oklch, ...)` confirmed present — this component must never import `Button` from here nor resemble this pattern.
- **`docs/ui-spec/history-ui-spec.md` (§ Component: AttemptPdfTemplate, lines 268-293)**: visual layout — header (logo + copper rule), title (Source Serif 4, `#1b1512`), score block (`X/10` large Source Serif 4 `#a62c2b`, `/10` suffix `#6b655c`), metadata row (`submittedDateLabel · completionTimeLabel`, `#6b655c`, sans), footer (hairline `#d8c9a8` + caption + `generatedAtLabel`, `#6b655c`). No shadows/gradients. Matches the frontend DD code excerpt exactly — no divergence found.
- Confirmed via `Glob`: `SOURCE/components/pdf/` does not exist yet (new directory, this task creates it). `SOURCE/public/images/brand_logo.png` exists (same-origin static asset the excerpt's `<img src="/images/brand_logo.png">` references).
- Confirmed via `Read`: `SOURCE/components/history/ActionButton.test.tsx` is a Task 09/10 skeleton (not yet implemented, explicitly out of this task's scope) — left untouched.
- Test convention confirmed from `SOURCE/components/rating/DifficultyBadge.test.tsx`: `// @vitest-environment jsdom` docblock, `render` from `@testing-library/react`, `describe`/`it`/`expect` from `vitest`, no auto-cleanup assumed (each test scopes its own `container`). `SOURCE/vitest.config.ts` collects `components/**/*.test.{ts,tsx}`. Package manager: npm (`package-lock.json` present, no `packageManager` field in `package.json`); test script: `npm test` → `vitest run`.
- Per task Notes: `SOURCE/lib/history/format.ts` (Task 07) is explicitly **not** imported here — the task file states the caller (`generateAttemptPdf.ts`, Task 09) formats and passes already-formatted string props; this component only formats `totalScore` via `.toFixed(1)`, consistent with the Data Contract's "no date/number formatting" precondition (which excludes `totalScore`, the one field this component itself computes a display string for).
- **Binding Decision evaluation (pre-implementation and post-implementation, same result)**: Planned approach — implement `AttemptPdfTemplate.tsx` as a pure presentational component whose every `style={{...}}` value is a literal hex/rgba string copied verbatim from the frontend DD's code excerpt (`#ede1c8`, `#1b1512`, `#a62c2b`, `#6b655c`, `#b8863b`, `#d8c9a8`), zero `className` attributes anywhere, no import from `components/ui/button.tsx` or any other shadcn component. Row 1 (`contract_schema`, ADR-0009 § Implementation Guidance): Compliance Check "Does `AttemptPdfTemplate.tsx`'s source contain zero `className` attributes and zero `oklch(`/`color-mix(` substrings anywhere in its inline styles?" — **Y**. Verified by direct read of the final `SOURCE/components/pdf/AttemptPdfTemplate.tsx` source (zero `className=` occurrences, zero `oklch(`/`color-mix(` substrings) and by the guard test in `AttemptPdfTemplate.test.tsx` ("plain-hex/rgb guard" test), which asserts both the rendered inline-style output (`container.innerHTML`) and the raw source text against these two substrings, plus a dedicated assertion that no `components/ui/button.tsx` import exists — all assertions pass (`npx vitest run components/pdf/AttemptPdfTemplate.test.tsx`: 5/5 tests green).
- **Implementation deviation from the DD excerpt's file-level comment**: the file's leading comment (copied from the DD excerpt) contains the literal word "className" in prose ("No Tailwind className anywhere in this file"). The guard test's source-text assertion was written as `/className=/` (matching only the JSX attribute form) rather than `/className/` (which would false-positive on this legitimate prose usage) — confirmed correct via a first failing run, then fixed; both regex forms are otherwise equivalent for detecting actual `className` attribute usage since JSX attributes always take the `className=` form.
- **Verification commands run**: `npx vitest run components/pdf/AttemptPdfTemplate.test.tsx` (5 passed), `npx tsc --noEmit -p tsconfig.json` (clean, no output), `npx eslint components/pdf/AttemptPdfTemplate.tsx components/pdf/AttemptPdfTemplate.test.tsx` (0 errors; 1 expected warning — `@next/next/no-img-element` on the plain `<img>` logo, which the DD excerpt explicitly specifies over `next/image`).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | contract_schema | `AttemptPdfTemplate`'s styles must resolve exclusively to plain hex/rgb(a) — no `components/ui/button.tsx`, no Tailwind slash-opacity/`color-mix` utility, anywhere in that subtree | Does `AttemptPdfTemplate.tsx`'s source contain zero `className` attributes and zero `oklch(`/`color-mix(` substrings anywhere in its inline styles? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular the exact hex values (`#ede1c8`, `#1b1512`, `#a62c2b`, `#6b655c`, `#b8863b`, `#d8c9a8`) and the confirmed-unsafe `color-mix` example.
- [x] Write failing tests in `AttemptPdfTemplate.test.tsx`: (a) renders with all 5 required fields (`examTitle`, `totalScore`, `submittedDateLabel`, `completionTimeLabel`, `generatedAtLabel`); (b) plain-hex/rgb guard — rendered inline-style output contains zero `oklch(`/`color-mix(` substrings AND the component source contains zero `className` attributes; (c) structural AC-006 guard — `AttemptPdfTemplateProps`'s type shape has no field capable of carrying per-question content.
- [x] Run tests and confirm failure (component doesn't exist yet).

### 2. Green Phase
- [x] Implement `AttemptPdfTemplate` exactly per the frontend DD's code excerpt (literal hex/rgba inline styles only).
- [x] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [x] Improve code (maintain passing tests); re-confirm zero `className`/Tailwind usage remains after any cleanup.
- [x] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (jsdom, `// @vitest-environment jsdom`) — Enforces: component render/state-machine/DOM-shape correctness — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/components/pdf/AttemptPdfTemplate.test.tsx`
- `AttemptPdfTemplate` plain-hex/rgb guard test — Enforces: ADR-0009's styling constraint ("not statically enforced by any linter today") — Config: `AttemptPdfTemplate.test.tsx` — Covers: `SOURCE/components/pdf/AttemptPdfTemplate.tsx`

## Operation Verification Methods
- **Verification method**: run `AttemptPdfTemplate.test.tsx`'s guard test against the rendered inline-style output and the component's source text.
- **Success criteria**: guard test + rendering test green; `tsc`/lint clean; zero `oklch(`/`color-mix(` substrings; zero `className` attributes anywhere in the file.
- **Failure response**: if any style resolves through `color-mix`/`oklch` (e.g. a copied Tailwind utility class), replace with the literal `rgba()` equivalent before proceeding — this is the exact defect class ADR-0009 flags as its highest-named risk.
- **Verification level**: L2 (guard test + rendering test green) — full real-browser proof (html2canvas actually rasterizing without error) is Task 11's Early Verification Point, not this task's.

## Proof Obligations
- **Claim**: AC-006 — `AttemptPdfTemplate` never renders per-question content; AC-008 — visual style follows `DESIGN.md` tokens.
  - **Primary failure mode**: a future prop/field addition accidentally introduces a per-question-content-capable field, or a style value resolves through `oklch()`/`color-mix()` instead of a plain hex/rgba literal.
  - **Boundary to exercise**: in-process unit (jsdom render + source-text inspection).
  - **State assertion**: N/A (presentational, stateless component).
  - **Mock boundary rationale**: none — real render, no external dependency to mock (per frontend DD Test Boundaries: "`AttemptPdfTemplate`'s own rendering — No (real render) — the oklch/color-mix guard test needs the actual rendered inline-style output, not a mock").
  - **Residual**: this test proves the styling constraint at the jsdom/inline-style level; it does not prove `html2canvas` actually rasterizes the DOM node without a console error in a real browser — that residual is closed by Task 11's Early Verification Point.

## Completion Criteria
- [x] All added tests pass (guard test + rendering test)
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] `tsc`/lint clean
- [x] Every Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/components/pdf/AttemptPdfTemplate.tsx` + its test file only.
- Scope boundary: this component is never mounted for user visibility — do not add it to any route/page in this task. Do not import `SOURCE/lib/history/format.ts` here — the caller (`generateAttemptPdf.ts`, Task 09) formats and passes already-formatted string props.
