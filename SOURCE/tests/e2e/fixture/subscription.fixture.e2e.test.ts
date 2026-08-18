// Subscription (payOS prepaid period) — FIXTURE-E2E lane test skeleton
// Design Docs: docs/design/subscription-frontend-design.md (v1.2, Test Boundaries :1018)
//              docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.3) — see the CORRECTION
//              block below; UI-D17 / the C-06 delta are generated AGAINST the
//              correction, not against the shipped spec text.
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Generated:   2026-08-18 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// This file is a SKELETON: comments only, no imports, no test() blocks, no
// assertions. The implementing task adds them in the same commit as the UI work.
//
// HARNESS. `SOURCE/vitest.config.ts:19` collects lib/**, components/**, app/**
// only, so nothing under `SOURCE/tests/` runs under `npm test` — which is why
// the shipped fixture-e2e scripts live here. Follow the shipped convention in
// this same directory: a driver-based script written against the structural
// subset of Playwright that `supportFixtureData.ts` declares (see
// `support-widget-visibility.fixture.e2e.test.ts:9-17`,
// `history.fixture.e2e.test.ts`, `rating.fixture.e2e.test.ts`). Do NOT
// introduce MSW; the frontend DD states it is not used and is not introduced.
// The backend is fixture-driven: Server Actions are stubbed at the action
// module boundary and entitlement/order values are supplied as fixtures. No
// live payOS connection and no real money movement occurs in this lane.
//
// CONSTRAINTS BINDING ANY IN-PROCESS RENDER CASE ADDED ALONGSIDE THESE.
// The browser cases below are not subject to jsdom rules, but the companion
// component cases the frontend DD owns are, and the implementer will write both
// in the same task. Reproduced here so they are not re-derived:
//   - vitest has NO `setupFiles` in this repo, so `@testing-library/jest-dom`
//     matchers are UNAVAILABLE. Use plain Vitest matchers and raw DOM reads:
//     `el.getAttribute("aria-disabled") === "true"`,
//     `el.hasAttribute("disabled") === false`,
//     `(el as HTMLButtonElement).disabled === false`.
//   - jsdom is declared PER FILE as `// @vitest-environment jsdom` on LINE 1.
//   - `render()` does NOT auto-cleanup; scope every query to its own render's
//     `container` and clean up explicitly.
//   - Async server components: `render(await C(props))` with `vi.mock("server-only")`
//     and `vi.mock("next/headers")`. Precedents:
//     `SOURCE/components/tutor/ExplainStepAffordance.test.tsx:1,28-29,45` and
//     `SkillRecommendationCard.test.tsx:9-15,22-27`.
//   - Entitlement provider wrapping ALREADY SHIPS as `renderWith(entitlement)`:
//     `SOURCE/components/tutor/ExplainStepAffordance.paywall.test.tsx:39-55` and
//     `SOURCE/lib/billing/__tests__/entitlement.test.tsx:49`. Reuse one of those
//     two forms; do not invent a third.
//
// =============================================================================
// CORRECTION APPLIED — UI Spec UI-D17 and the C-06 delta are known-wrong
// =============================================================================
// The shipped UI Spec text says `TutorQuotaNote` is mounted "receiving
// `formattedResetDate` computed server-side". No such producer can exist: the
// mount site is an async server component holding no entitlement value, and the
// frontend DD's `code:02` forbids a second `readEntitlement()` path. The spec
// text is pending amendment.
//
// FE-2 below is generated against the CORRECTED behaviour:
//   the mount passes NO prop; `TutorQuotaNote` formats its own `resetsAt` from
//   PROVIDER CONTEXT, inside the existing `tutor.state === "known"` branch
//   (`SOURCE/components/billing/TutorQuotaNote.tsx:30`).
// Any assertion on a `formattedResetDate` prop is wrong and must not be added.
//
//
// =============================================================================
// FE-1 — RESERVED SLOT — Purchase journey: /pricing -> /pricing/checkout
// =============================================================================
// User journey (user-facing, multi-step; reserved fixture-e2e slot — emitted
// regardless of ROI): a signed-in user on S-01 `/pricing` with
// `canPurchase === true` reads the legal links, activates the purchase control,
// `createOrder()` resolves with an `orderCode`, the router navigates to S-06
// `/pricing/checkout?order={orderCode}`, and the transfer information is
// readable there — with the confirm control inert while the legal content is
// still a placeholder.
// Journey qualification: 2 distinct routes; state (the `orderCode`) carries from
// step 1 into step 2 and decides what step 2 renders; completion point is the
// rendered payment screen for that order.
// Source: UI Spec Transition Conditions S-01 -> S-06 (:442) and S-06 -> S-02/S-03
//   (:445); frontend DD C-13/C-14 and C-15 rows of the Mock boundary table.
// ACs: AC-039 (PRD :315 — legal links appear BEFORE the confirm control, not
//   after), AC-028 (PRD :290 — account number, amount and transfer memo also
//   rendered as TEXT beside the QR), AC-049/AC-054 (the inert-with-reason state
//   is the negative branch of the same control).
// EARS: "When" (purchase control activated) -> event-driven; plus "If-then" on
//   `legalContentReady`.
// ROI: 109 (BV:10 x Freq:9 + Legal:1x10 + Defect:9)
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — S-01 page, PurchaseCta, createOrder()
//   action module stubbed, S-06 page, C-12 QR slot, C-13/C-14 transfer block,
//   C-15 PaymentConfirm, the en/vi dictionaries
// @complexity: high
// Mock boundary (frontend DD): the ACTION MODULE is the sanctioned mock
//   boundary (`vi.mock` of the action module in unit tests; in this lane, a
//   fixture-stubbed action response). The rendered tree, the router navigation
//   and the dictionaries are REAL.
// @real-dependency: none — this lane runs entirely on fixtures. The real-DB half
//   of this journey is SVC-1 in
//   `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts`.
//
// Primary failure mode: the journey breaks at a seam no component test can see —
//   the purchase control activates but nothing navigates; or navigation lands on
//   `/pricing/checkout?order=…` and the screen renders its "no active payment"
//   Empty state for an order that is live (frontend DD FE-B-01's stated failure);
//   or the transfer block renders with blank values, which is the one failure
//   AC-028 exists to prevent; or the legal links render AFTER the confirm
//   control, which satisfies every "the link exists" assertion while failing
//   AC-039's actual requirement.
//
// Proof obligation:
//   - Traverse BOTH branches of the purchase control, not only the enabled one.
//     With `canPurchase === false` the control must be inert with a readable
//     reason and NO navigation must occur; the enabled branch alone stays green
//     while the fail-closed branch regresses into a purchasable state.
//   - AC-039 is an ORDER claim, not a presence claim. Assert the DOM position of
//     the two legal links relative to the confirm control (document order),
//     not merely that both links exist.
//   - Assert the transfer values are the ones the fixture supplied, byte for
//     byte — a blank-but-present `<dd>` passes a presence assertion.
//   - Only the action module may be stubbed. Do not stub the router, the
//     dictionaries or the components: the navigation seam is the thing under
//     test.
// Verification points / expected results / pass criteria:
//   (a) On `/pricing` with `canPurchase === true`: links to `/terms` and
//       `/refund-policy` are both present AND both precede the purchase control
//       in document order. (AC-039)
//   (b) Activating the purchase control with a stubbed `createOrder()` resolving
//       `{orderCode}` results in the URL being
//       `/pricing/checkout?order={that same orderCode}` — the same value, not
//       merely a well-formed one.
//   (c) On S-06 for that order: all four `<dl>` pairs render (account number,
//       account name, amount, memo) with the fixture's exact values, and the
//       amount carries a thousands separator.
//   (d) With `qrPayload` ABSENT from the fixture: all four `<dl>` pairs STILL
//       render and the screen remains completable from text alone. (AC-028,
//       frontend DD Risk R-4 / golden state 18)
//   (e) `legalContentReady === false` (the shipped state today): the confirm
//       control carries `aria-disabled="true"`, `hasAttribute("disabled")` is
//       false, it is reachable by Tab, and activating it performs NO action and
//       causes no navigation. (frontend DD C-15; Risk R-9)
//   (f) With `canPurchase === false`: activating the purchase control on S-01
//       causes NO navigation and a readable reason is rendered. (AC-049/AC-054)
//   (g) At a 360px viewport the S-06 screen has zero horizontal overflow with a
//       bigint `orderCode` beside an amount and a badge. (frontend DD Risk R-6 —
//       measured, not eyeballed)
//
//
// =============================================================================
// FE-2 — Quota-exhausted journey: the tutor surface tells the user WHY, shows
//        the counters, and leads to /pricing
// =============================================================================
// User journey (user-facing, multi-step): a signed-in Free user on the
// result-detail page (S-04) sees `TutorQuotaNote` with the remaining count and
// the reset date; on the exhausted branch the affordance states the quota reason
// distinctly from the generic error; activating the upgrade link lands on S-01
// `/pricing`.
// ACs: AC-042 (PRD :320 — remaining count AND reset date visible where the user
//   stands, both Must), AC-041 (PRD :319 — the exhausted message must NOT reuse
//   the generic `t("tutor.error")` string `ExplainStepAffordance.tsx` uses for
//   all four error codes; 0 conflations of out-of-quota into the error group).
// EARS: "While" (quota state is known / exhausted) -> state-condition test.
// ROI: 80 (BV:8 x Freq:9 + Legal:0 + Defect:8)
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — app/(layer2) layout + its
//   EntitlementProvider mount (backend DD D005 / I1), the result-detail page
//   (both ExplainStepAffordance call sites), components/billing/TutorQuotaNote.tsx,
//   components/tutor/ExplainStepAffordance.tsx, the en/vi dictionaries
// @complexity: high
// Mock boundary: entitlement is supplied as a FIXTURE at the real
//   `(layer2)` provider mount; the tutor action module is stubbed. The LAYOUT
//   TREE IS REAL AND UNMOCKED — backend DD Test Boundaries, "Provider coverage
//   (I1)" row: "nothing — render the real layout tree ... a mocked provider
//   would assert the mock".
// @real-dependency: app/(layer2)/layout.tsx and its EntitlementProvider mount
//   (marked "nothing mocked" in the backend DD's Mock Boundary Decisions table).
//   Requires backend DD step 1b (the `(layer2)` provider mount) to exist.
//
// WHY THIS IS A BROWSER CASE AND NOT A COMPONENT CASE — this is the whole point
//   of the slot. The frontend DD records it explicitly (Test Boundaries,
//   `TutorQuotaNote` row, and Risk R-12): wrapping the unit in
//   `EntitlementProvider` "supplies the very thing the production tree lacks",
//   so a provider-wrapped unit test passes against a permanently-null production
//   mount. The provider-wrapped unit case still belongs in the component's own
//   file for the `unknown => null` branch; it CANNOT discharge AC-042, and this
//   case exists to discharge it against the real route tree.
//
// Primary failure mode: `TutorQuotaNote` renders nothing at all, permanently,
//   for every user — because the route group above the mount site has no
//   `EntitlementProvider`, so `useEntitlement()` returns `FREE_FALLBACK` whose
//   quotas are `unknown` and the component returns `null` at
//   `TutorQuotaNote.tsx:30`. Every static gate stays green through this: lint,
//   build and the component's own unit test all pass. Second failure mode: the
//   out-of-quota state is rendered with the generic `t("tutor.error")` string,
//   so a user who simply ran out of allowance is told the product is broken.
//
// Proof obligation:
//   - Do NOT wrap the unit in a provider. Render the REAL route tree and let the
//     provider come from where production puts it. A test that supplies the
//     provider itself cannot fail for the primary failure mode above.
//   - Boundary path to traverse: the mount site renders the note beside BOTH
//     `ExplainStepAffordance` call sites on the result-detail page (frontend DD
//     names `:177` and `:230`). One call site rendering is not proof; the
//     affordance only mounts when `hasBeenWrongTwice === true`, decided
//     separately at each call site.
//   - CORRECTED CONTRACT, per the correction block at the top of this file: the
//     mount passes NO prop. Assert the reset date is derived from the fixture's
//     `tutor.resetsAt` through context. Do NOT assert a `formattedResetDate`
//     prop, and do not add one to satisfy the shipped UI Spec text.
//   - For AC-041, assert the rendered exhausted-state string is NOT EQUAL to the
//     resolved value of `t("tutor.error")` in the SAME locale — an inequality
//     against the actual dictionary value, not a substring heuristic, so the
//     assertion survives a copy change.
// Verification points / expected results / pass criteria:
//   (a) Signed-in user, entitlement fixture with `tutor: { state: "known",
//       used, limit, resetsAt }`: a `<p>` renders carrying BOTH the remaining
//       count and the reset date, beside BOTH affordance call sites. (AC-042)
//   (b) The rendered date equals the pinned-timezone formatting of the fixture's
//       `resetsAt` (Asia/Ho_Chi_Minh). A date one day off is a failure, not a
//       rounding difference — the frontend DD's early-verification failure
//       response says stop.
//   (c) No prop is passed at the mount site: the rendered output is unchanged
//       when the mount is invoked with no props at all.
//   (d) Entitlement fixture with `tutor: { state: "unknown" }`: the note renders
//       NOTHING, and the surrounding page still renders — a fail-OPEN quota must
//       not become a fail-CLOSED display. The rendered text contains neither
//       "0" nor "—" in place of the counters.
//   (e) Exhausted fixture (`used >= limit`): the affordance renders the
//       quota-specific message, and that string is NOT EQUAL to the resolved
//       `t("tutor.error")` value in the same locale. (AC-041)
//   (f) Activating the upgrade link from the exhausted state navigates to
//       `/pricing`. (UI Spec transition S-04 -> S-01)
//   (g) Every interactive element in the new states is Tab-reachable, none
//       carries native `disabled`, and each has a visible focus ring. (AC-043's
//       browser-observable half)
//
//
// =============================================================================
// FE-3 — Re-check outcome on /me/orders: still-pending reads as an instruction,
//        never as a failure; a dogpiled control refuses distinctly
// =============================================================================
// AC-036: "Cho một đơn chưa thanh toán, khi bấm kiểm tra lại, thì trạng thái
//          hiển thị vẫn là chờ, kèm hướng dẫn — 0 trường hợp cấp quyền lợi
//          nhầm." (PRD :310)
// AC-037: "Cho hành động kiểm tra lại, khi bị bấm dồn, thì được `guard()` theo
//          user chặn như mọi Server Action tốn tài nguyên khác." (PRD :311)
// EARS: "When" (control activated) -> event-driven, two outcome branches.
// ROI: 64 (BV:8 x Freq:7 + Legal:0 + Defect:8)
//
// LANE CHOICE AND ITS REASON. Both ACs are claimed by both Design Docs. The
//   behaviour each one PROMISES is observable in the rendered outcome, not in
//   the server value: AC-036's whole requirement is that a non-failure outcome
//   "must not read as a failure", which the frontend DD states rests ENTIRELY on
//   copy now that `role="alert"` is assertive and no polite role carries the
//   distinction; AC-037's requirement is that the refusal sentence is distinct
//   from every other outcome and from the generic error string. The server half
//   of each (zero writes; `guard()` classification in the DB-cost family with
//   `limit >= 15`) is a single-module assertion the backend DD already assigns
//   to `rateLimit.test.ts` and to a `settleOrder` unit case — pushed down, not
//   duplicated here. Each AC therefore has exactly ONE skeleton, this one.
//   AC-037's rendered outcome shares this case because it is produced by the
//   SAME control, on the SAME activation path, and the frontend DD's C-10 row
//   enumerates both in one boundary; splitting them would test the same
//   interaction twice.
//
// @category: fixture-e2e
// @lane: fixture-e2e
// @dependency: full-ui (mocked backend) — /me/orders page, C-07/C-08 OrderList,
//   C-09 OrderStatusBadge, C-10 RecheckOrderControl, C-11 PlanSummary,
//   recheckOrder action module stubbed, the en/vi dictionaries
// @complexity: medium
// Mock boundary (frontend DD, C-10 row): the ACTION MODULE is mocked. The
//   rendered tree, the badge, the summary panel and the dictionaries are real.
// @real-dependency: none in this lane. The ownership/RLS half of `recheckOrder`
//   is SVC-2 in `SOURCE/tests/e2e/service/subscription.service.e2e.test.ts`.
//
// Primary failure mode: the user has paid, the provider has not yet confirmed,
//   and the screen tells them something went wrong — so they either pay a second
//   time or abandon. The regression is silent: every "an alert appeared"
//   assertion still passes while the sentence inside it carries failure
//   vocabulary. The second failure mode: a dogpiled control fires the action
//   repeatedly and the rate-limited refusal is rendered as the generic error
//   string, which is exactly the conflation AC-037 forbids.
//
// Proof obligation:
//   - Assert the rendered sentence EQUALS a FIXED EXPECTED STRING per locale
//     (en and vi), not a substring match. The frontend DD makes this explicit:
//     AC-036's negative half has no observable criterion otherwise.
//   - Observable state before/after: capture the badge text and every
//     entitlement-derived value in C-11 BEFORE the activation and assert they
//     are unchanged after it. "No wrong grant" is only proven by a before/after
//     comparison; asserting the alert text alone leaves the grant unobserved.
//   - Boundary path to traverse: the SECOND synchronous activation. One
//     activation stays green while the dogpile guard regresses.
//   - Assert the action module was invoked EXACTLY ONCE under two synchronous
//     activations — a count, not "it was called".
//   - Only the action module may be stubbed; the copy must come from the real
//     dictionaries, because the copy is the thing under test.
// Verification points / expected results / pass criteria:
//   (a) Pending order, stubbed `recheckOrder()` resolving
//       `{settled:false, reason:"not_paid_yet"}`: a node carrying `role="alert"`
//       APPEARS (absent before the activation, present after).
//   (b) That node's text EQUALS the fixed expected `billing.recheck.stillPending`
//       sentence for the `en` locale, and separately for `vi`. Pass criterion:
//       string equality against a literal written in the test, so a copy edit
//       that reintroduces failure vocabulary fails here.
//   (c) The badge still reads the "awaiting payment" word, unchanged from before
//       the activation. (AC-036)
//   (d) Every entitlement-derived value rendered by C-11 above the list is
//       byte-identical before and after — 0 wrong grants. (AC-036)
//   (e) Focus is still on the activated control after the outcome lands, and the
//       control never carries native `disabled` in idle, busy or terminal state.
//       (frontend DD Risk R-1; AC-043)
//   (f) Two synchronous activations: the stubbed action module records EXACTLY 1
//       invocation.
//   (g) Stubbed rate-limited refusal: the rendered sentence EQUALS the fixed
//       expected `billing.recheck.rateLimited` string per locale, and is NOT
//       EQUAL to the generic error string nor to any other outcome sentence in
//       the same locale. (AC-037)
