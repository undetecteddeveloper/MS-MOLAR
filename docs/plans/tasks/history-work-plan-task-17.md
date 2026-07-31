# Task 17: `HomeSidebar.tsx` Nav `href` Fix (Work Plan Phase 5, Task 5.2)

Metadata:
- Dependencies: history-work-plan-task-14 (Deliverable: `/history` fully rendering, so there is something to navigate to)
- Provides: real "History" nav destination in `HomeSidebar`
- Size: Small (1 file)

## Implementation Content

`SOURCE/app/(layer1)/_components/HomeSidebar.tsx:22`: `{ label: "History", href: "#" }` → `{ label: "History", href: "/history" }`. No `activeLabel` logic change (D5 — `HomeSidebar` never renders while a user is "on" `/history`, confirmed via Assumed Behavior #1/code:F4).

## Target Files
- [x] `SOURCE/app/(layer1)/_components/HomeSidebar.tsx` (line 22, literal value edit only)

## Investigation Targets
- `SOURCE/app/(layer1)/_components/HomeSidebar.tsx` (lines 18-25 — the `NAV` array; line 37/40 — `activeLabel` computation, a closed 2-value set `"Home"`/`"Account"` that never needs to represent `"History"`)
- `SOURCE/app/page.tsx` (lines 2, 37 — the sole caller of `HomeSidebar`, confirming the static `activeLabel` prop is always `"Home"` or `"Account"`)
- `docs/design/history-frontend-design.md` (§ Nav Wiring — `HomeSidebar.tsx:22` change, full 4-point resolution: sole caller, closed 2-value `activeLabel` set, `HomeSidebar` only renders on `/`, therefore no active-state gap exists to close; § Assumed Behavior #1 / code:F4)
- `docs/ui-spec/history-ui-spec.md` (§ D5 — nav wiring requires no new active-state logic; § Component: HomeSidebar (nav extension) — verify default state)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations — confirm `app/page.tsx` is genuinely `HomeSidebar`'s only caller (a fresh grep, not merely trusting the Design Doc's prior finding) and that `activeLabel` is never derived from `NAV`'s `href` values.
- [x] No new automated test — this is a single literal-value edit with no active-logic change; proceed to a manual click-through verification plan.

### 2. Green Phase
- [x] Change `{ label: "History", href: "#" }` to `{ label: "History", href: "/history" }` at line 22. No other change.

### 3. Refactor Phase
- [x] Confirm no other line in the file changed, and `activeLabel`'s computation (line 40) is untouched.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide

## Operation Verification Methods
- **Verification method**: manual click-through — click "History" from the homepage sidebar, confirm navigation to `/history`.
- **Success criteria**: navigation succeeds to `/history`; no active-state regression on the homepage's own `"Home"`/`"Account"` highlighting.
- **Failure response**: if a future caller of `HomeSidebar` is ever added that could render while a user is "on" `/history", re-open the D5 resolution — this task's edit alone would not suffice in that hypothetical, since `activeLabel` would need `"History"` as a third value. Not applicable today (only caller confirmed to be `app/page.tsx`).
- **Verification level**: L1 (manual click-through from the homepage sidebar confirms navigation to `/history`).

## Completion Criteria
- [x] One literal-value edit (Implementation)
- [x] `tsc`/lint clean (Quality)
- [x] Manual click-through from the homepage sidebar confirms navigation to `/history` (Integration)

## Notes
- Impact scope: `SOURCE/app/(layer1)/_components/HomeSidebar.tsx` line 22 only.
- Scope boundary: do not add any `"History"` value to `activeLabel`'s closed 2-value set — D5 explicitly resolves this as unnecessary, since `HomeSidebar` never renders while `/history` is the current route.

## Investigation Notes
- `HomeSidebar.tsx:18-25` (`NAV` array): `{ label: "History", href: "#" }` at line 22 is the sole target of this edit. Lines 37/40: `activeLabel = authOpen ? "Account" : "Home"` — a closed 2-value set never derived from `NAV`'s `href` values; confirmed untouched by this task.
- `app/page.tsx:2,37`: fresh `grep -rn "HomeSidebar"` across `SOURCE/app` returns 3 files — `app/page.tsx` (import line 2, JSX usage line 37), `HomeSidebar.tsx` itself (definition), and `(layer2)/_components/SiteHeader.tsx` (3 comment-only references to the *pattern*, no import/JSX usage). Confirms `app/page.tsx` is genuinely `HomeSidebar`'s only caller, and its `activeLabel` prop (`authOpen ? "Account" : "Home"`) is a closed 2-value set never depending on `"History"`.
- `history-frontend-design.md` § Nav Wiring (line 915-922): 4-point resolution — sole caller `app/page.tsx`, closed 2-value `activeLabel` set, `HomeSidebar` renders only on `/` (never on `/history`, which renders `(HM)/layout.tsx` → `SiteHeader`), therefore no active-state gap exists. Matches fresh investigation above.
- `history-ui-spec.md` § D5 / § Component: HomeSidebar (nav extension) (line 162-164): confirms the same single-line `href` edit, no `activeLabel` logic change, Default state only (AC-015).
- `SiteHeader.tsx:27` still has `href: "#"` (unchanged) — that fix belongs to task-16 (Work Plan Phase 5.1), a separate task, out of scope here per Target Files/Notes.
