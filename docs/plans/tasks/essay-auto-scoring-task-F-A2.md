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
- [x] `SOURCE/components/essay/EssayLifecycleBadge.tsx` (new) — async Server Component
- [x] `SOURCE/components/essay/__tests__/EssayLifecycleBadge.test.tsx` (new) — 11 cases

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

### AB-3 confirmed: `render(await ...)` gave a NON-EMPTY tree
Every rendering case asserts `container.textContent` contains a real string, so an empty tree fails rather than passing vacuously. That is the standing rule applied literally — including in the two cases whose *purpose* is negative (`[disabled]` absent, colour-independence), each of which carries a positive assertion alongside.

This component has **no async child**, which is exactly why the technique is valid here. F-A3 does have one (this badge), so it must use `renderServerTree()`.

### Expected strings come from the dictionary the component actually resolves
The first attempt hard-coded the Vietnamese strings and went red: `expected '◌Scoring' to contain 'Đang chấm'` — `DEFAULT_LOCALE` is **`en`**, not `vi`. Fixed by deriving them through `getDictionary(DEFAULT_LOCALE)` rather than picking a language. That is better than swapping in the English literals: hard-coding *either* language makes this test red the day someone changes the default locale, for a reason having nothing to do with the badge.

The three states resolve to three **distinct** strings — asserted directly, because if two collapsed to one string a student could not tell "being scored" from "scoring failed", and every per-state case would still pass.

### The source scan had to strip comments, and that is not a loophole
The three Theme-Token cases scan the component's source for hex, shadows, gradients and `?? CONFIG.default`. They went red on the first run — against the component's **own comments**, which explain *why* `#4F7942` is not borrowed and *why* there is no `?? default`. A raw scan punishes recording the reason. The scan now strips block and line comments first, so the reason stays in the file **and** the guard still measures the code. Same shape as the B4.1 citation problem.

### `#4F7942` is absent for three independent reasons, all recorded in the file
It is a hard-coded hex (theme hard rule); it is currently TBD-04 in another spec and this feature does not duplicate a debt; and its **meaning is wrong** — a band is not a correctness verdict, `isCorrect` is `false` permanently (W1), so painting it "correct" asserts something untrue on screen.

### UI-D13 is enforced earlier here than in the precedent
`OrderStatusBadge` needs a fifth `UNRECOGNISED` appearance because its prop is typed `string` (deliberately — the value crosses a database boundary). This badge does not: `deriveEssayView()` already returns `null` for an unrecognised `essayState`, so an unknown value never reaches the component, and `Record<EssayRenderState, Appearance>` is exhaustive so `tsc` guards the rest. **No `??`, no `as`** — asserted by the source scan.

### O-4 stays open and non-blocking
There is no `--success` token, so "Scored" is marked by `font-medium` + full-strength `--foreground` — the same solution `OrderStatusBadge.paid` used for the same problem. A real positive colour means adding a token and closing TBD-04: engineer/product, not this task.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and recorded key observations
- [x] Tests written first; observed red three times, each for a different real reason: module absent, then `document is not defined` (missing `// @vitest-environment jsdom`), then the locale mistake above

### 2. Green Phase
- [x] Component created: pill `<span>`, `aria-hidden` glyph, text as the accessible name, semantic token classes only, `text-xs font-medium`
- [x] `11 passed (11)`, exit **0**

### 3. Refactor Phase
- [x] No `?? CONFIG.default`, no `as` — asserted by the comment-stripped source scan
- [x] `#4F7942` appears nowhere in the code
- [x] Every case carries at least one positive assertion, including both negative-purpose cases

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the exhaustive `EssayRenderState` switch — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | The exhaustive `Record<EssayRenderState, Appearance>` is the gate: a new lifecycle state without an appearance is a compile error |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 1961 passed / 10 skipped / 0 todo (was 1950 — **+11**), 46.9 s |
| 4 | `npm run build` | **0** | |
| 5 | `npm run test:fixture` | **1** | Expected red, TD-030 baseline only. Snapshot CRLF churn reverted before commit |
| 6 | `npm run test:localdb` | **0** | 11 passed / 2 todo (SVC-1, SVC-2 — Task H8) |

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
- [x] **Implementation Complete** = component + three-state test (11 cases)
- [x] **Quality Complete** = six gates run separately; five at 0, `test:fixture` at the TD-030 baseline
- [x] **Integration Complete** = N/A until Task F-A3
- [x] Every case carries at least one positive assertion
- [x] Reference Contract = `Y`: the badge renders the three lifecycle strings resolved from the real dictionary, and they are distinct
- [x] Every exit-code cell filled

## Notes
- Impact scope: F-A3 (`EssayScoreLine`'s loading state), F-B1 (`EssayReviewBlock`'s RS-2…RS-6), F-B3 (`HistoryRow`'s meta-line badge).
- Scope boundary — preserve unchanged: `SOURCE/components/billing/OrderStatusBadge.tsx` (its **structure** is copied, not edited — and its three defects are deliberately not copied).
- **O-4 stays open, non-blocking**: there is no `--success`/`--warning` token, so "Đã chấm" is marked by weight + `--foreground`. Owner: engineer / product.
