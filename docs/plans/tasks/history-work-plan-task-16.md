# Task 16: `SiteHeader.tsx` Nav `href` Fix (Work Plan Phase 5, Task 5.1)

Metadata:
- Dependencies: history-work-plan-task-14 (Deliverable: `/history` fully rendering, so there is something to navigate to)
- Provides: real "History" nav destination in `SiteHeader`
- Size: Small (1 file)

## Implementation Content

`SOURCE/app/(layer2)/_components/SiteHeader.tsx:27`: `{ label: "History", href: "#" }` → `{ label: "History", href: "/history" }`. No other change — `isActive` (`:63-65`) already handles any real `href` (Assumed Behavior #2 / code:F3).

## Target Files
- [x] `SOURCE/app/(layer2)/_components/SiteHeader.tsx` (line 27, literal value edit only)

## Investigation Targets
- `SOURCE/app/(layer2)/_components/SiteHeader.tsx` (lines 22-30 — the `NAV` array; lines 63-65 — the `isActive` logic that requires no code change beyond the `href` value)
- `docs/design/history-frontend-design.md` (§ Nav Wiring — `SiteHeader.tsx:27` change; § Assumed Behavior #2 / code:F3 — confirms `isActive` already handles any real `href`)
- `docs/ui-spec/history-ui-spec.md` (§ D5 — nav wiring requires no new active-state logic; § Component: SiteHeader (nav extension) — verify default state)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations — confirm `isActive`'s exact logic (`item.href !== "#" && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))`) requires no change.
- [x] No new automated test — this is a single literal-value edit with no new logic branch; proceed to a manual click-through verification plan.

### 2. Green Phase
- [x] Change `{ label: "History", href: "#" }` to `{ label: "History", href: "/history" }` at line 27.

### 3. Refactor Phase
- [x] Confirm no other line in the file changed.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide

## Operation Verification Methods
- **Verification method**: manual click-through — click "History" in `SiteHeader` from any route, confirm navigation to `/history` and active-highlight (brand-red text + underline) on any `/history*` route.
- **Success criteria**: navigation succeeds; active-highlight renders correctly per `isActive`'s existing logic, with zero code changes beyond the literal `href` value.
- **Failure response**: if active-highlight does not render, re-inspect `isActive`'s logic for an unexpected edge case (e.g. a mismatched `pathname.startsWith` prefix) — this would indicate Assumed Behavior #2 was wrong, not merely a typo in this task's edit.
- **Verification level**: L1 (manual click-through confirms navigation + active-highlight on any `/history*` route).

## Completion Criteria
- [x] One literal-value edit (Implementation)
- [x] `tsc`/lint clean (Quality)
- [x] Manual click-through confirms navigation + active-highlight on any `/history*` route (Integration) — **CONFIRMED (2026-07-31, orchestrator via Playwright MCP)**: navigated to `/history` as the test account; screenshot shows "HISTORY" rendered in brand-red with the active underline, matching the same treatment already proven correct for sibling nav items.

## Notes
- Impact scope: `SOURCE/app/(layer2)/_components/SiteHeader.tsx` line 27 only.
- Scope boundary: do not touch `isActive`'s logic (lines 63-65) — it already handles this case correctly, per Assumed Behavior #2.

## Investigation Notes
- `SiteHeader.tsx` (lines 20-36, 61-88): `NAV` is a `NavItem[]` (`{label, href}`) rendered via `usePathname()`-derived `isActive` at lines 63-65: `item.href !== "#" && (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))`. Line 27 is `{ label: "History", href: "#" }`, the sole reference to `"#"` in `NAV`/`GUEST_NAV`. No other line reads or branches on this specific `href` value — `isActive` is generic over any `NavItem`. Confirmed the logic requires zero changes for a `"/history"` value: `pathname.startsWith("/history")` will be `true` on `/history` and any `/history/*` subpath, `false` elsewhere.
- `docs/design/history-frontend-design.md` § Nav Wiring (line 911-913) and code:F3 (line 266): confirms exactly this literal edit, `isActive` preserved as-is (`preserve` transform type).
- `docs/ui-spec/history-ui-spec.md` § Component: SiteHeader (nav extension) (line 150-152) and § D5/AC-015 (line 84): confirms the same edit, "no other change" — active highlight is Default state, no new visual state introduced.
- Dependency verified: `SOURCE/app/(HM)/history/page.tsx` exists (task-14 deliverable), so `/history` is a valid navigation target.
- No test environment gap: this is a literal-value edit with no new logic branch — task file specifies no new automated test, proceed to manual/build verification only.
