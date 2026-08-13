// User Support System v1 — Widget Visibility & Layout Guard [fixture-e2e] Test
//   Skeleton
// Design Docs: docs/design/support-system-frontend-design.md (v1.2, Verification
//   Strategy item (1) — SupportWidget self-guard component test; note: item (1)'s
//   *own* method is a component test, RTL-mockable without a browser — this file
//   additionally covers AC-006, which genuinely requires a real browser's computed
//   layout, so both concerns are consolidated into one fixture-e2e candidate to stay
//   within this feature's integration-lane budget rather than splitting across two
//   lanes for closely related visibility concerns on the same component)
// UI Spec: docs/ui-spec/support-system-ui-spec.md (v1.1, Layout Constraints,
//   Accessibility Requirements)
// PRD: docs/prd/support-system-prd.md (v1.2, AC-003, AC-005, AC-006, metric 8,
//   metric 9, D1)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3 (this file is slot 2/3, additional-beyond-reserved), service-integration-e2e
//   1/2.
//
// Skeleton only — comments describing what the implementer must write; no imports, no
// executable driver code yet. Same `SupportDriver` structural-subset convention as the
// sibling submission-journey skeleton and this repo's existing
// rating.fixture.e2e.test.ts / history.fixture.e2e.test.ts files. AC-006 specifically
// requires real computed layout (`getBoundingClientRect()` intersection) — jsdom (the
// RTL/vitest environment used for this repo's `integration` lane) does not compute
// real layout, returning zeroed rects for every element, so this obligation cannot be
// proven by a mocked-render component test and must run in an actual browser (backend
// DD PRD v1.2's own review-finding-driven narrowing: this criterion only asserts
// zero intersection with `BottomNav`, not the exam timer/submit button, which the
// widget never coexists with — see AC-006 scope note).

// =============================================================================
// Obligation A — no widget when logged out (AC-003)
// =============================================================================
// AC: "Given no authenticated session, when any mounted page renders, then
//   `SupportWidget` returns `null` — no DOM node, not a hidden one." (AC-003)
// ROI: 44 (BV:6 x Freq:6 + Legal:0 + Defect:8)
// Behavior: navigate to a normal mounted route (e.g. `/exams`) as a logged-out fixture
//   session (`getCurrentUser` fixture resolving `null`) -> assert no element matching
//   the widget trigger's role/label exists anywhere in the page.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — getCurrentUser fixture-driven
// @complexity: low
// Primary failure mode: the widget renders but is merely visually hidden (e.g.
//   `display:none`/`opacity:0`) instead of the component returning `null` — a DOM node
//   for it still exists and would be found by a `querySelector`, contradicting the
//   "no DOM node, not a hidden one" requirement.
// Proof obligation:
//   (a) a query for the widget trigger's role/accessible name (e.g.
//       `getByRole("button", { name: /hỗ trợ|support/i })`) returns zero matches, not
//       one invisible match — assert absence via a count/queryBy-style check that
//       distinguishes "not in the DOM" from "in the DOM but not visible".

// =============================================================================
// Obligation B — no widget on the exam-attempt route, regardless of auth state
//   (AC-005, D1) — genuinely absent, not CSS-hidden
// =============================================================================
// AC: "Given a student on the `(layer2)` exam-attempt route during an active attempt,
//   when the page renders, then no support widget element exists in the DOM."
//   (AC-005)
// ROI: 78 (BV:9 x Freq:6 + Legal:0 + Defect:9) — highest-BV obligation in this file:
//   the backend DD's own biggest_risks / PRD Risk table names "widget overlaps the
//   exam timer or submit button at 360px" as a High-impact risk, structurally
//   eliminated only if this obligation actually holds.
// Behavior: navigate to the `(layer2)` exam-attempt route (a real attempt in
//   progress, per the fixture backend) as a logged-in fixture user -> assert no
//   element matching the widget trigger exists anywhere in the DOM -> repeat the same
//   navigation as a logged-out session, asserting the same absence (proving D1's
//   exclusion is unconditional on auth state, not merely redundant with AC-003 on
//   this route).
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — attempt-route rendering + getCurrentUser
//   fixture-driven
// @complexity: medium
// Primary failure mode: the widget mounts on the attempt route but is suppressed only
//   via CSS (still present in the DOM, still discoverable by assistive tech or a
//   stray z-index change) instead of the component itself returning `null` for that
//   route pattern — the exact distinction the PRD's own AC-005 wording draws ("no
//   support widget element exists in the DOM" vs. merely hidden).
// Proof obligation:
//   (a) on the attempt route as a logged-in user, a query for the widget trigger's
//       role/accessible name returns zero matches;
//   (b) the same query, run via the page's raw DOM query capability (not merely a
//       accessibility-tree query, to rule out a `display:none`/`aria-hidden` element
//       that an accessible-name query alone might also report as absent), likewise
//       returns zero matches — confirms no node exists, not merely no accessible node;
//   (c) the same route, logged out, also returns zero matches (D1's exclusion holds
//       independent of AC-003's own separate reason for absence).

// =============================================================================
// Obligation C — 360px viewport: zero bounding-box intersection with `BottomNav`
//   (AC-006, narrowed per PRD v1.2 review — BottomNav only)
// =============================================================================
// AC: "Given a viewport 360px wide on any page where the widget does render, when the
//   page is rendered at that width, then the widget's interactive bounding box has
//   zero bounding-box intersection with `BottomNav` ... and the widget's resting
//   position respects `env(safe-area-inset-bottom)` so it is not pushed under the
//   device's home indicator." (AC-006). Scope note (PRD v1.2): this criterion
//   deliberately says nothing about the exam timer, the submit button, or
//   `ExamPlayer`'s sticky cluster — those exist only on the `(layer2)` attempt route,
//   from which Obligation B removes the widget entirely, so there is no page on which
//   both operands would coexist. `BottomNav` is the sole operand here.
// ROI: 50 (BV:7 x Freq:6 + Legal:0 + Defect:8)
// Behavior: set the browser viewport to 360px width -> navigate to a normal mounted
//   page (not the attempt route) as a logged-in fixture user -> read the widget
//   trigger's `getBoundingClientRect()` and `BottomNav`'s `getBoundingClientRect()` ->
//   assert the two rectangles do not overlap on either axis.
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend); real browser viewport/layout (this
//   obligation is why this candidate cannot be an `integration`-lane RTL test — jsdom
//   does not compute real layout)
// @complexity: medium
// Primary failure mode: the widget trigger's computed bottom offset does not account
//   for `BottomNav`'s `--bottom-nav-h` custom property (or a future change to
//   `BottomNav`'s own height), producing a real overlap only visible under actual
//   layout computation, never caught by a jsdom-based test.
// Proof obligation:
//   (a) at 360px width, the widget trigger's rect and `BottomNav`'s rect satisfy
//       standard rectangle non-intersection (one rect's right edge is left of the
//       other's left edge, OR one's bottom edge is above the other's top edge — i.e.
//       zero-area overlap on both axes, not merely "mostly" non-overlapping);
//   (b) the widget trigger's own bottom-edge offset is verified to incorporate
//       `env(safe-area-inset-bottom)` (e.g. by asserting the computed `bottom`/margin
//       value references the CSS env() function rather than a hardcoded pixel value
//       that ignores device safe-area insets).
