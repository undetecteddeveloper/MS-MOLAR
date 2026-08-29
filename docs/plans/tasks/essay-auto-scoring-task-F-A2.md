# Task F-A2 — `EssayLifecycleBadge` + RTL test

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase F-A (Display Foundation, frontend slices V0 + V1), Task F-A2**
Layer: **frontend** (`SOURCE/components/essay/**`)

Metadata:
- Dependencies: **Task F-A1**.
- Blocks: **Task F-A3**, and through it F-B1, F-B3 and F-C2.
- Provides: the three lifecycle appearances as one pure label component, usable from both `(layer2)` and `(HM)`.
- Size: Small (2 files)
- Verification level: **L2**.

## Standing rule for every test in the frontend phases
Each case carries **at least one positive assertion** (`getByText`/`getByRole` that succeeds), **including** cases whose purpose is a negative assertion. A case made only of `expect(queryBy…).toBeNull()` passes against an **empty tree**, which is exactly the failure mode `renderServerTree.tsx:4-10` was written to describe.

## Implementation Content

Create `SOURCE/components/essay/EssayLifecycleBadge.tsx` as an **async Server Component**. It sits in `components/essay/` because **both `(layer2)` and `(HM)` use it** — the same reason `components/history/` and `components/billing/` exist outside the route tree.

Copy the **structure** of `SOURCE/components/billing/OrderStatusBadge.tsx:86-93`: a pill `<span>`, an `aria-hidden` glyph, then **text** as the accessible name — so the label survives black-and-white printing and a screen reader reads **only the words**.

### Do not copy the precedent's three defects (two of which that file documents about itself)
1. **No hard-coded hex** — every colour is a token.
2. **No `CONFIG[x] ?? CONFIG.default` and no `as`** — an unrecognised value gets its **own** appearance (here: it falls back to RS-0 via `deriveEssayView()` returning `null`, UI-D13).
3. **Do not borrow `#4F7942`** (the "correct answer" fern), for **three independent reasons**: it is a hard-coded hex violating the theme's hard rule; it is currently TBD-04 in `short-answer-scoring-ui-spec.md` and this feature does not duplicate a debt; and its **meaning is wrong** — a band is not a correctness verdict, `isCorrect` is `false` permanently (W1), so painting it "correct" asserts something untrue on screen.

### Appearance
| State | Style |
|---|---|
| `◌ Đang chấm` | `--muted-foreground` on `--card`, measured **5.26:1**, border `--border` — decorative, exempt from 1.4.11 because the **text** carries the information |
| `✓ Đã chấm` | `--foreground`, `font-medium` — there is **no `--success` token**, and weight plus full-strength foreground is how `OrderStatusBadge.paid` solved the same problem |
| `✕ Chấm thất bại` | `--destructive`, border `--destructive` — this border **does** carry information, so it meets 3:1 |

Label typography: `text-xs font-medium`.

### Render technique
`render(await EssayLifecycleBadge({ state }))` is **valid here** (AB-3, probed on React 19 / RTL 16 / vitest 4 / jsdom) because this component has **no async child**.

## Target Files
- [ ] `SOURCE/components/essay/EssayLifecycleBadge.tsx` (new)
- [ ] `SOURCE/components/essay/__tests__/EssayLifecycleBadge.test.tsx` (new)

## Investigation Targets
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayLifecycleBadge — verify pending + graded + failed states)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Open Item O-4 — no `--success` / `--warning` token exists; "Đã chấm" is marked by weight + `--foreground`)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Agreement Checklist Scope — `EssayLifecycleBadge` (new, async Server Component) + test)
- `docs/design/essay-auto-scoring-frontend-design.md` (§ Theme Token Map — zero new tokens, zero hard-coded hex outside `AttemptPdfTemplate`, zero box-shadow, zero gradient; `#4F7942` deliberately **not** used)
- `SOURCE/components/billing/OrderStatusBadge.tsx` (`:86-93` — the structure to copy; the two defects the file documents about itself)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — `EssayRenderState`, and `deriveEssayView()` returning `null` for an unrecognised value)
- `SOURCE/lib/i18n/dictionaries/en.ts` and `vi.ts` (Task F-A1 — the three badge strings, resolved from the **real** dictionary in the test)
- `SOURCE/components/history/` and `SOURCE/components/billing/` (the precedent for a shared component living outside the route tree)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| UI Spec (§ Component: EssayReviewBlock — RS table) | column/label set and order | RS-2 `◌ Đang chấm`; RS-3 `✓ Đã chấm`; RS-4 `✕ Chấm thất bại`; RS-5 `✕ Chấm thất bại` — "Giống RS-4 **từng chữ một** (UI-D6)"; RS-6 `✕ Chấm thất bại` + *"Câu này đã dùng hết lượt chấm. Hệ thống sẽ không tự chấm lại."*, retry control "Có mặt, `aria-disabled`" | The badge renders exactly `◌ Đang chấm`, `✓ Đã chấm`, `✕ Chấm thất bại` for the three lifecycle states, resolved from the real dictionary |

## UI Spec Components covered
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (§ Component: EssayLifecycleBadge — verify pending + graded + failed states)

## Investigation Notes
_(Record here: the exact strings resolved from the real dictionary; confirmation that no hard-coded hex appears in the file; confirmation that `render(await …)` produced a non-empty tree (AB-3).)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write one case per lifecycle state asserting the exact string from the **real** dictionary, plus the a11y and no-hex assertions; observe failure

### 2. Green Phase
- [ ] Create the component: pill `<span>`, `aria-hidden` glyph, text as the accessible name, tokens only, `text-xs font-medium`
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Confirm there is **no** `CONFIG[x] ?? CONFIG.default` and **no** `as`
- [ ] Confirm `#4F7942` appears nowhere
- [ ] Confirm every case carries at least one **positive** assertion

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the exhaustive `EssayRenderState` switch — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: RTL, one case per lifecycle state, rendering via `render(await EssayLifecycleBadge({ state }))` and asserting the **exact string from the real dictionary**, the glyph's `aria-hidden`, the accessible name, the absence of any `disabled` attribute, and the absence of hard-coded hex in the file.
- **Success criteria**: three states, three exact strings; the accessible name is the **text**, not the glyph; no element carries `disabled`; no hex literal in the file.
- **Failure response**: if the rendered tree is empty, the component gained an async child — switch to `renderServerTree()` (that is F-A3's situation, not this one) **and** add a positive assertion to every case. If a colour is needed that no token provides, **stop** — adding a real positive colour means adding a `--success` token and closing `short-answer-scoring-ui-spec.md` TBD-04; that is Open Item **O-4**, owned by engineer/product, and it does **not** block ship.
- **Verification level**: **L2**; Integration Complete is N/A until F-A3.

## Proof Obligations
- **Claim**: each lifecycle state has exactly one appearance, readable by keyboard and by screen reader.
  - **Primary failure mode**: information conveyed by colour or by the glyph alone, so the state is lost in black-and-white printing and to a screen reader.
  - **Boundary to exercise**: RTL over the rendered tree, with the **real** dictionary.
  - **State assertion**: N/A (pure label).
  - **Mock boundary rationale**: none — no I/O; the dictionary is real so cases assert the right **key resolved to the right string** rather than "some string".
  - **Residual**: proves the three appearances in isolation; their placement in each surface is F-A3's, F-B1's and F-B3's.
- **Claim (UI-D13)**: an unrecognised value gets its **own** appearance — it falls back to RS-0 via `deriveEssayView()` returning `null`, **not** through `CONFIG[x] ?? CONFIG.default`.
  - **Primary failure mode**: a `?? default` silently painting an unknown state as a known one. **Boundary**: RTL plus a read of the component's source. **State assertion**: N/A. **Mock rationale**: none. **Residual**: the `null` derivation itself is proven in Task H1 (EG-BE-024/025).
- **Claim (Theme Token Map)**: zero new tokens, zero hard-coded hex, zero box-shadow, zero gradient; `#4F7942` used **nowhere**.
  - **Primary failure mode**: borrowing the "correct answer" fern, which asserts something **untrue** — a band is not a correctness verdict and `isCorrect` is `false` permanently (W1). **Boundary**: a source scan of the file. **State assertion**: N/A. **Mock rationale**: none. **Residual**: O-4 stays open (non-blocking) — if the product wants a real positive colour, that is a `--success` token plus TBD-04, not a copied hex.

## Completion Criteria
- [ ] **Implementation Complete** = component + three-state test
- [ ] **Quality Complete** = six verify gates green
- [ ] **Integration Complete** = N/A until Task F-A3
- [ ] Every case carries at least one **positive** assertion
- [ ] Every Reference Contract Compliance Check evaluates to `Y`
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: F-A3 (`EssayScoreLine`'s loading state), F-B1 (`EssayReviewBlock`'s RS-2…RS-6), F-B3 (`HistoryRow`'s meta-line badge).
- Scope boundary — preserve unchanged: `SOURCE/components/billing/OrderStatusBadge.tsx` (its **structure** is copied, not edited — and its three defects are deliberately not copied).
- **O-4 stays open, non-blocking**: there is no `--success`/`--warning` token, so "Đã chấm" is marked by weight + `--foreground`. Owner: engineer / product.
