# Task P2-T1 — `ExamRibbon.tsx`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 2 (ExamCard Visual Extension, ExamRibbon, ExamShelf Component + Attempt-Read Extraction), Task P2-T1**
Layer: frontend (`SOURCE/features/exams/components/`)

Metadata:
- Dependencies: none within Phase 2 (independent of P2-T2/T3/T4)
- Blocks: P2-T2 (ExamCard renders `<ExamRibbon>` as its last child when `ribbon` is set), P2-T3 (ExamShelf's card row uses ribbon for rank-1 cards)
- Size: Small (1 new file)
- Verification level: L2

## Implementation Content
Create `SOURCE/features/exams/components/ExamRibbon.tsx` (`ExamRibbon({ label })`, `data-slot="ribbon"`, `aria-hidden`, `pointer-events-none`, clip-square + band + text per UI Spec § Component: ExamRibbon).

## Target Files
- [x] `SOURCE/features/exams/components/ExamRibbon.tsx` (new)
- [x] `SOURCE/features/exams/components/__tests__/ExamRibbon.test.tsx` (new — component test proving the structural/accessibility contract below)

## Investigation Targets
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamRibbon)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: ExamRibbon — verify default state; Empty/Loading/Error N/A)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Design Tokens Used — the clip-square/band/text tokens this component must use, not new ad-hoc values)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Accessibility Requirements — why the ribbon is `aria-hidden`, `pointer-events-none`)
- `SOURCE/features/exams/components/ExamCard.tsx` (the pre-P2-T2 structure this ribbon will be composed into)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/ui-spec/exam-shelves-ui-spec.md (§ Component: ExamRibbon) | derived-display | Ribbon text "Hot nhất" (stored sentence-case; CSS uppercases) | Does `ExamRibbon` render the `label` prop's text sentence-case in the DOM, with uppercasing applied only via CSS (`text-transform`), not by transforming the string in JS? |

## UI Spec Component Reference
`docs/ui-spec/exam-shelves-ui-spec.md (§ Component: ExamRibbon — Default; Empty/Loading/Error N/A — no data owned)`

## Investigation Notes
- UI Spec § Component: ExamRibbon (lines 142-157): decorative, `aria-hidden`, `pointer-events-none`, rendered on exactly one card per page. Structure = clip square (outer, `rounded-tr-card pointer-events-none absolute top-0 right-0 z-10 size-[76px] overflow-hidden`) → band (`bg-sun glow-sun text-[color:var(--sun-on-solid)] absolute top-4 -right-[30px] w-[124px] rotate-45 py-[3px] text-center text-[8.5px] leading-[1.2] font-extrabold tracking-[.06em] uppercase`) → text (`Hot nhất`, key `exams.hotRibbon`, stored sentence-case, CSS `uppercase` does the visual capitalisation). Confirmed: `pointer-events-none` is part of the clip-square's own class string (not a separate concern), and `aria-hidden` sits on that same outer element per the task's `ExamRibbon({ label })`, `data-slot="ribbon"` contract.
- UI Spec § Component: ExamCard (lines 123-141): `ribbon` prop is `string | undefined`; ExamCard will render `<ExamRibbon label={ribbon} />` as the **last** direct child of `Card` (P2-T2's job, not this task's). Confirms `ExamRibbon` takes exactly one prop, `label: string`, and owns no data of its own — text rendered is exactly what the caller passes, not derived via `t()` inside `ExamRibbon` itself.
- UI Spec § Design Tokens Used (lines 214-227): ribbon-only tokens are `--sun` / `--sun-on-solid` / `.glow-sun` (row "Ribbon only (AC-044)") and `--radius-card` (`rounded-tr-card`, shared with card corners). No new token; `bg-sun`/`glow-sun`/`text-[color:var(--sun-on-solid)]`/`rounded-tr-card` are the only color/radius classes this component may use — matches the class strings above verbatim.
- UI Spec § Accessibility Requirements (line 244, "Colour independence"): ribbon is `aria-hidden` + `pointer-events-none` because "hot" meaning is carried in text by the shelf title/subtitle elsewhere — the ribbon itself must not be reachable by assistive tech or touch, confirming both attributes belong on the root/clip-square element, not just the inner band.
- `SOURCE/features/exams/components/ExamCard.tsx` (pre-P2-T2): confirms the `data-slot`-on-root, `aria-hidden` + `pointer-events-none`-as-decorative-marker idiom already used at `ExamCard.tsx:70-75` for the "Làm đề" pill — same repo convention this task follows for `ExamRibbon`'s root element.
- Confirmation for Reference Contract row: `label` prop text is rendered as `{label}` directly (JS does no case transformation); uppercasing is solely the Tailwind `uppercase` utility (`text-transform: uppercase`) on the band's class string — DOM `textContent` stays sentence-case exactly as passed in.
- **Reference Contract evaluation (post-implementation)**: row "Ribbon text sentence-case; CSS uppercases" → **Y**. `ExamRibbon.tsx` renders `{label}` with no `.toUpperCase()`/`.toLocaleUpperCase()` or similar call anywhere in the component; the only case transform is the `uppercase` Tailwind class on the band `<span>`. Verified by `ExamRibbon.test.tsx` ("hiện đúng nguyên văn label..." test): `container.textContent` equals `"Hot nhất"` exactly and is asserted `not.toBe("HOT NHẤT")`. Test passed (`npx vitest run features/exams/components/__tests__/ExamRibbon.test.tsx` — 5/5 green).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing cases: `data-slot="ribbon"` present; `aria-hidden="true"` present; `pointer-events-none` class present; rendered text content equals the `label` prop exactly (sentence-case, not uppercased in markup)
### 2. Green Phase
- [x] Implement `ExamRibbon({ label })` per the UI Spec's clip-square + band + text structure
- [x] Run tests and confirm all pass
### 3. Refactor Phase
- [x] Confirm design tokens used match the UI Spec's Design Tokens Used table (no ad-hoc color/spacing values)

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)
- Prettier + prettier-plugin-tailwindcss — Config: `SOURCE/package.json` devDependencies; Covered: `SOURCE/features/exams/components/**`

## Operation Verification Methods
- **Verification method**: `npx vitest run features/exams/components/__tests__/ExamRibbon.test.tsx`.
- **Success criteria**: `data-slot="ribbon"`, `aria-hidden`, `pointer-events-none` all present; text content matches `label` exactly.
- **Failure response**: if `aria-hidden` is missing, the ribbon becomes announced to screen readers as card content unrelated to the exam itself — fix immediately, this is an accessibility requirement (AC-044), not a style preference.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (AC-026, AC-044): `ExamRibbon` renders a purely decorative, accessibility-inert badge whose text matches its `label` prop exactly.
  - **Primary failure mode**: the component is announced to assistive technology as part of the card's accessible name (missing `aria-hidden`), or its text is silently transformed/truncated from the `label` prop.
  - **Boundary to exercise**: component render boundary (via `renderServerTree` or the project's standard component-test render).
  - **State assertion**: N/A (stateless presentational component).
  - **Mock boundary rationale**: none — no data dependency beyond the `label` prop.
  - **Residual**: this proves the component in isolation; its correct placement as `ExamCard`'s last child, and that exactly 1 renders per hot-shelf row, are P2-T2's and P2-T3's proof obligations respectively.

## Completion Criteria
- [x] All added tests pass
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green

## Notes
- Impact scope: 1 new component + its test file. No existing file is touched by this task.
- Scope boundary: this component owns no data — it renders exactly what its `label` prop provides.
