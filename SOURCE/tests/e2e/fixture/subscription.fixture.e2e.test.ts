// @vitest-environment jsdom

// Subscription (payOS prepaid period) — FIXTURE-E2E lane
// Design Docs: docs/design/subscription-frontend-design.md (v1.2, Test Boundaries :1018)
//              docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.4) — UI-D17 AS AMENDED;
//              see the AMENDMENT block below.
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Generated:   2026-08-18 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
// FE-2 filled: 2026-08-19 (plan Task 2.5) — fixture-e2e 1/3 resolved.
// FE-3 filled: 2026-08-19 (plan Task 3.9) — fixture-e2e 2/3 resolved.
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// FE-2 AND FE-3 ARE FILLED AND EXECUTABLE. FE-1 is still a comment-only reserved
// slot (plan Task 4.6). The `@vitest-environment jsdom` directive on LINE 1 is a
// per-file declaration, per the repo convention, and both cases depend on it.
//
// HOW THIS LANE RUNS:  `npm run test:fixture`  (from `SOURCE/`).
//
// READ THE NEXT PARAGRAPH BEFORE TRUSTING ANYTHING IN THIS FILE. Until plan
// Task 2.5, THIS LANE HAD NO RUNNER AT ALL. None of the three committed configs
// collected `tests/e2e/fixture/**` — `vitest.config.ts` takes lib/**,
// components/** and app/**; `vitest.integration.config.ts` takes
// tests/integration/**; `vitest.localdb.config.ts` takes tests/e2e/service/**
// — and no `test:fixture` script existed. The omission was mechanical (plan
// Task 0.7 emitted three lane skeletons and wired two lanes), but its effect
// was not: a case in this file could be written, reviewed and merged while
// never executing anywhere. That is the same "an artifact claiming a
// discriminating power it does not have" failure this feature keeps producing,
// one level up — at the LANE rather than at the assertion. `vitest.fixture.config.ts`
// and the `test:fixture` script were added in plan Task 2.5 under an explicit
// orchestrator authorisation, and FE-2 is the first case in this directory ever
// to have run in a committed lane.
//
// Note for anyone reaching for a shortcut: a positional filter
// (`npx vitest run tests/e2e/fixture/...`) collects NOTHING, because it only
// narrows the configured `include`, and vitest 4 has no `--include` CLI
// override — it errors with "Unknown option --include". The config is the only
// way in.
//
// WHY THE LANE IS SEPARATE FROM `npm test`, stated plainly because the reason
// is NOT the reason the other two lanes are separate. `test:integration` and
// `test:localdb` are held out of CI because they need a real Supabase dev
// database. This lane needs no database, no credentials and no network, so it
// COULD safely join the CI gate. It is separate for a mechanical reason: the
// six other `*.fixture.e2e.test.ts` files here are Playwright-subset DRIVER
// SCRIPTS with no `test()` blocks, so a directory-wide collection reports "No
// test suite found in file" for each and exits 1 (measured). They are excluded
// by name in `vitest.fixture.config.ts`; when that exclude list empties, this
// lane can fold into `npm test`.
//
// `npx tsc --noEmit` and `eslint --max-warnings 0` cover this file as well
// (tsconfig `include` is `**/*.ts` + `**/*.tsx`).
//
// WHY FE-2 IS AN IN-PROCESS RENDER OF THE REAL ROUTE TREE, NOT A DRIVER SCRIPT.
// The six shipped siblings in this directory (`history.`, `rating.`,
// `short-answer-scoring.`, the three `support-*.`) are driver scripts written
// against a structural subset of Playwright, because this repo has no
// `@playwright/test` and no committed `playwright.config.ts`; each records the
// same residual — nothing executes them. That convention cannot discharge
// AC-042, which is the only reason this slot exists: the claim is that the
// UI-D17 mount ACTUALLY RENDERS, and a script no runner executes proves nothing
// about what renders. So FE-2 keeps the convention's SUBSTANCE — the real route
// tree, only the action module and the two data sources stubbed, real
// dictionaries, no MSW — and drops its FORM, composing
// `RootLayout -> (layer2)/layout -> the result-detail page` exactly as
// production composes them and rendering that through
// `@testing-library/react`. The provider therefore comes from where production
// puts it (`app/(layer2)/layout.tsx:41`), which is the whole point: delete that
// mount and FE-2 goes red — which is exactly what a provider-wrapped unit test
// cannot do. Precedent for rendering a real layout tree this way:
// `SOURCE/app/(layer2)/__tests__/layout.test.tsx` (plan Task 2.2).
//
// WHAT THIS FORM CANNOT COVER, recorded rather than quietly dropped: jsdom
// paints nothing and lays nothing out, so the PAINTED focus ring, the 360px
// layout and real client-side navigation stay with the manual browser pass
// (plan Task 6.5 item iv). FE-2 asserts their structural preconditions — the
// focus indicator is not suppressed, the upgrade target is `/pricing` — and
// says so at the assertion itself.
//
// HARNESS MODULE — `./subscriptionFixtureData.ts`. It holds everything the
// three cases below run on:
//   - entitlement fixtures: FIXTURE_ENTITLEMENT_KNOWN / _UNKNOWN / _EXHAUSTED,
//     built by spreading FREE_FALLBACK, with FIXTURE_RESETS_AT deliberately on
//     a different calendar day in ICT than in UTC (FE-2(b)). FE-2(b) MUST first
//     pin the ambient zone to FIXTURE_BROWSER_TIMEZONE: on an ICT developer
//     machine an unpinned formatter renders the right date for the wrong reason
//     and the case passes by accident. THE MACHINE THIS WAS WRITTEN ON REPORTS
//     `Asia/Saigon`, so that hazard is live rather than theoretical — FE-2 pins
//     `process.env.TZ` itself and asserts the pin took effect, instead of
//     trusting the runner's ambient environment;
//   - order fixtures: FIXTURE_ORDER_PENDING and _PENDING_NO_QR, _PAID,
//     _EXPIRED, _CANCELLED, _UNRECOGNISED, plus FIXTURE_ORDER_ROWS for S-05,
//     all pinned against FIXTURE_NOW;
//   - the action-module stub layer: createSubscriptionActionStubs(), exposing
//     createOrderCallCount / recheckOrderCallCount, which are what FE-1's
//     no-navigation branch and FE-3(f)'s "exactly 1 invocation" assert on. Both
//     simulate* methods are ASYNC, and holdNextRecheck()/releaseHeldRecheck()
//     keep a call outstanding: the dogpile guard and the busy state only exist
//     inside an in-flight window, so FE-3(a)/(e)/(f) drive them through it;
//   - the driver: SubscriptionDriver / SubscriptionLocator.
// FE-2 consumes the entitlement fixtures, the route/identity constants and the
// timezone pin; FE-3 consumes the order fixtures and the counted action-stub
// layer. `SubscriptionDriver` stays unimported until FE-1 exists — an unused
// import is fatal under `eslint --max-warnings 0`.
//
// NO MSW; the sanctioned mock boundary is the ACTION MODULE. FE-2 stubs
// `explainStep()` (the tutor action module) and the two DATA SOURCES the two
// server components read from — `readEntitlement()` for the layout and
// `getResult()` for the page. The layouts, the provider, the page, the
// components, the dictionaries and the date formatter are all REAL.
// `readEntitlement()` is a data source and not the thing under test: the
// skeleton's own mock boundary reads "entitlement is supplied as a FIXTURE at
// the real (layer2) provider mount", and the entitlement fixtures are
// `Entitlement` VALUES, which is the shape that arrives at that mount. Stubbing
// it does not weaken the primary failure mode, because the mount, the context
// and every consumer below it stay real. (`layout.test.tsx` stubs one layer
// lower — Supabase plus Redis — because its own claim is about the DERIVATION;
// FE-2's claim is about what renders.)
//
// CONSTRAINTS BINDING ANY IN-PROCESS RENDER CASE IN THIS FILE:
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
//   - Entitlement provider wrapping ships as `renderWith(entitlement)` in
//     `SOURCE/components/tutor/ExplainStepAffordance.paywall.test.tsx:39-55` and
//     `SOURCE/lib/billing/__tests__/entitlement.test.tsx:49`. FE-2 MUST NOT use
//     either form: a case that supplies the provider supplies the very thing a
//     broken production tree would be missing.
//
// =============================================================================
// AMENDMENT LANDED — UI Spec v1.4 § UI-D17 and the C-06 delta now state the
//                    corrected behaviour
// =============================================================================
// HISTORY. The earlier UI Spec text said `TutorQuotaNote` is mounted "receiving
// `formattedResetDate` computed server-side". No such producer can exist: the
// mount site is an async server component holding no entitlement value, and the
// frontend DD's `code:02` forbids a second `readEntitlement()` path.
//
// STATUS: AMENDED AND IMPLEMENTED — this is no longer pending.
//   - plan Task 0.3 landed the amendment: UI Spec v1.4 § UI-D17 (and the C-06
//     delta) now state the corrected behaviour directly, and frontend DD X-13
//     records the same resolution.
//   - plan Task 2.4 (commit d5ba7d7) implemented it: `TutorQuotaNote` takes NO
//     props and formats its own `tutor.resetsAt` from PROVIDER CONTEXT inside
//     the existing `tutor.state === "known"` branch
//     (`SOURCE/components/billing/TutorQuotaNote.tsx:43`).
//
// THE PROHIBITION STILL STANDS, and it is why this block survives its own
// amendment: any assertion on a `formattedResetDate` prop is wrong and must not
// be added. Re-adding the prop is the silent failure X-13 names — the mount can
// pass nothing, the old ternary swallows the date branch, and the note prints
// the counters with NO date, for everyone, forever, while lint, build and a
// provider-wrapped unit test all stay green. FE-2(c) is the runtime half of
// that prohibition.
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

// -----------------------------------------------------------------------------
// FE-2 — IMPLEMENTATION (plan Task 2.5). Everything above this line is the
// generated annotation block, kept verbatim; everything below is the case.
// -----------------------------------------------------------------------------

import { cloneElement, createElement, isValidElement, type ReactNode } from "react";
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The two hoisted string constants below are duplicated INSIDE `vi.hoisted`
// rather than imported, because a `vi.mock` factory runs before this module's
// import bindings are initialised and would hit a TDZ error. Both are pinned
// back to their shipped sources by the "fixture preconditions" block, so a
// rename fails there instead of silently rendering the default locale (or the
// wrong route) underneath every assertion in this file.
const {
  cookieName,
  routePath,
  state,
  getCurrentUserProfileMock,
  readEntitlementMock,
  getResultMock,
  explainStepMock,
  refreshMock,
} = vi.hoisted(() => ({
    cookieName: "ms_locale",
    routePath: "/exams/exam-subscription-fixture/attempt/attempt-subscription-fixture/result/detail",
    state: { locale: "en" as "en" | "vi" },
    getCurrentUserProfileMock: vi.fn(),
    readEntitlementMock: vi.fn(),
    getResultMock: vi.fn(),
    explainStepMock: vi.fn(),
    // COUNTED, not a throwaway `vi.fn()`: `router.refresh()` is step 5 of
    // C-10's handler and the ONLY mechanism by which the badge, the row and
    // C-11 catch up with an outcome. Left uncounted, its deletion is invisible
    // here — the user reads "Paid — your Premium period runs to …" under a
    // badge still saying "Awaiting payment" and a C-11 still saying "Free",
    // until they reload by hand. That is the divergence UI-D16 exists to
    // prevent, so FE-3 (d) reads this counter.
    refreshMock: vi.fn().mockName("router.refresh"),
  }));

// --- Runtime substitutions (NOT product stubs) -------------------------------
// These stand in for pieces of the Next runtime that only exist inside a real
// server/build: none of them is a seam FE-2 makes a claim about.

vi.mock("server-only", () => ({}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === cookieName ? { value: state.locale } : undefined),
  }),
}));

// `next/font/google` is a compiler transform; called as a plain function it
// throws. Returning the CSS-variable name each call site asked for keeps the
// real root-layout code path (the `className` interpolation) intact.
vi.mock("next/font/google", () => {
  const font = (options: { variable?: string }) => ({
    variable: options.variable ?? "",
    className: "",
  });
  return { Geist_Mono: font, Source_Serif_4: font, Be_Vietnam_Pro: font };
});

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

vi.mock("next/navigation", () => ({
  usePathname: () => routePath,
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: refreshMock, back: vi.fn() }),
  // The page redirects when `getResult()` returns null. That never happens on
  // this fixture, so a call here means the harness is wrong — it must be loud,
  // not a no-op that leaves a half-rendered tree for the assertions to read.
  redirect: (url: string) => {
    throw new Error(`FE-2: unexpected redirect(${url}) — the result fixture should have rendered`);
  },
}));

// `SkipLink` is an async Server Component. React 19's client renderer refuses
// one outright: it suspends and the WHOLE tree comes back empty, i.e. the case
// would be red for the wrong reason. Same environment limit, same treatment and
// same reasoning as `app/(layer2)/__tests__/layout.test.tsx:70`. It sits OUTSIDE
// the provider, so it stands between no assertion in this file.
vi.mock("@/components/shared/SkipLink", () => ({ SkipLink: () => null }));

// NOT required for the render: the reviewer removed all three and the lane
// still passed 23/23. They are defensive isolation. These action modules are
// reachable from the client components the two layouts mount (SiteHeader /
// LanguageToggle / SupportWidget / HeaderProfile), and at MODULE SCOPE they
// pull in the Supabase server client, the redis-backed rate-limit `guard` and
// nodemailer. Stubbing them keeps that construction cost and any future
// import-time side effect out of a lane whose whole point is needing no
// database, no credentials and no network.
vi.mock("@/lib/support/actions", () => ({ submitSupportTicket: vi.fn() }));
vi.mock("@/lib/i18n/actions", () => ({ setLocale: vi.fn() }));
vi.mock("@/app/(layer1)/actions", () => ({ signOut: vi.fn() }));

// --- The sanctioned mock boundary + the two data sources ---------------------
// `explainStep` is the ACTION MODULE (the frontend DD's sanctioned boundary).
// `getCurrentUserProfile` and `readEntitlement` are the layout's data sources;
// `getResult` is the page's. The layouts, the EntitlementProvider mount, the
// page, TutorQuotaNote, ExplainStepAffordance, the dictionaries and
// `lib/format/datetime.ts` all run REAL.
vi.mock("@/app/(layer2)/tutorActions", () => ({ explainStep: explainStepMock }));
// `getCurrentUser` is FE-3's addition: a factory replaces the WHOLE module, and
// S-05's login gate reads `getCurrentUser` while FE-2's route reads
// `getCurrentUserProfile`. Without both names on one factory the other lane's
// route calls `undefined()` before it renders anything.
vi.mock("@/lib/auth/getCurrentUser", () => ({
  getCurrentUserProfile: getCurrentUserProfileMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock("@/lib/billing/readEntitlement", () => ({ readEntitlement: readEntitlementMock }));
vi.mock("@/app/(layer2)/queries", () => ({ getResult: getResultMock }));

import RootLayout from "@/app/layout";
import Layer2Layout from "@/app/(layer2)/layout";
import ResultDetailPage from "@/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page";
import type { ExamResult } from "@/app/(layer2)/queries";
import { TutorQuotaNote } from "@/components/billing/TutorQuotaNote";
import type { Entitlement } from "@/lib/billing/types";
import { LOCALES, type Locale } from "@/lib/i18n/locales";
import { createTranslate, getDictionary } from "@/lib/i18n/translate";
import {
  FIXTURE_ATTEMPT_ID,
  FIXTURE_BROWSER_TIMEZONE,
  FIXTURE_ENTITLEMENT_EXHAUSTED,
  FIXTURE_ENTITLEMENT_KNOWN,
  FIXTURE_ENTITLEMENT_UNKNOWN,
  FIXTURE_EXAM_ID,
  FIXTURE_LOCALE_COOKIE,
  FIXTURE_RESETS_AT,
  FIXTURE_RESETS_AT_ICT_DATE,
  FIXTURE_RESETS_AT_UTC_DATE,
  FIXTURE_RESULT_DETAIL_ROUTE,
  FIXTURE_USER,
} from "./subscriptionFixtureData";

// =============================================================================
// The timezone pin — `driver.setTimezone(FIXTURE_BROWSER_TIMEZONE)`'s in-process
// equivalent, and the single most deletable-looking line in this file.
// =============================================================================
// `FIXTURE_RESETS_AT` is 19:30Z, which is 02:30 the NEXT calendar day in ICT.
// The formatter under test pins `timeZone: "Asia/Ho_Chi_Minh"` itself
// (`lib/format/datetime.ts:34`), so on a machine whose ambient zone ALREADY is
// ICT a formatter that DROPPED that pin renders byte-identical output and
// FE-2(b) passes for the wrong reason. The machine this was written on reports
// `Asia/Saigon`. Node re-reads `process.env.TZ` on assignment, so pinning it
// here (before any `Intl.DateTimeFormat` is constructed — `formatDate` builds a
// fresh one per call and caches nothing) reproduces the browser-context pin
// without depending on how the runner was invoked.
process.env.TZ = FIXTURE_BROWSER_TIMEZONE;

// =============================================================================
// Fixtures
// =============================================================================

/** `FIXTURE_RESETS_AT` as the two calendar days it falls on, in the DD/MM/YYYY
 *  shape `formatDate` renders — built by REORDERING the fixture module's own
 *  ISO date constants, never by calling the formatter. A value derived from the
 *  thing under test moves in lockstep with it and proves nothing. */
const ICT_DATE = FIXTURE_RESETS_AT_ICT_DATE.split("-").reverse().join("/"); // 16/09/2026
const UTC_DATE = FIXTURE_RESETS_AT_UTC_DATE.split("-").reverse().join("/"); // 15/09/2026

/** Rendered note, per fixture and locale. Fixed literals typed out by hand
 *  (repo precedent: `TutorQuotaNote.test.tsx:139-148`, `OrderStatusBadge.test.tsx:99`)
 *  — an expectation rebuilt from `t(key, values)` drifts with the dictionary and
 *  with the formatter at once, so it can never fail. The "fixture preconditions"
 *  block below ties these literals back to the fixture's own numbers and date. */
const NOTE = {
  known: {
    en: "12/500 tutor hints used this period. Resets on 16/09/2026.",
    vi: "Đã dùng 12/500 lượt gia sư trong kỳ này. Đặt lại vào 16/09/2026.",
  },
  exhausted: {
    en: "500/500 tutor hints used this period. Resets on 16/09/2026.",
    vi: "Đã dùng 500/500 lượt gia sư trong kỳ này. Đặt lại vào 16/09/2026.",
  },
} as const satisfies Record<string, Record<Locale, string>>;

/** `billing.quota.tutorExhausted` / `billing.quota.upgradeLink`, per locale. */
const EXHAUSTED_COPY = {
  en: "You've used all your tutor hints for this period.",
  vi: "Bạn đã dùng hết lượt gia sư của kỳ này.",
} as const satisfies Record<Locale, string>;

const UPGRADE_LABEL = {
  en: "See plans",
  vi: "Xem các gói",
} as const satisfies Record<Locale, string>;

const SHORT_QID = "question-short-answer-fixture";
const MCQ_QID = "question-mcq-fixture";

/** Two questions, both `hasBeenWrongTwice: true`, one per BRANCH of the page —
 *  the short-answer branch (`page.tsx:165-181`) and the mcq branch
 *  (`page.tsx:182-236`). Each branch decides its own `ExplainStepAffordance`
 *  mount and carries its own `TutorQuotaNote` mount, so one rendered branch is
 *  not proof for the other. That is the "BOTH call sites" half of AC-042.
 *
 *  DELIBERATE ABSENCE OF `0` AND OF `—` everywhere except the note: FE-2(d)
 *  asserts neither character stands in for a counter when the quota is
 *  `unknown`, and it can only do that if nothing ELSE inside a question item
 *  produces one. Hence non-empty answers (an empty one renders
 *  `result.skipped` = "— skipped —"), and `correct`/`total` chosen away from 0. */
const FIXTURE_RESULT: ExamResult = {
  examId: FIXTURE_EXAM_ID,
  examTitle: "Fixture exam: photosynthesis",
  result: {
    totalScore: 5,
    correct: 1,
    total: 2,
    topicBreakdown: [],
    perQuestion: [
      {
        questionId: SHORT_QID,
        selected: "chlorophyll",
        isCorrect: false,
        scored: true,
        hasBeenWrongTwice: true,
      },
      {
        questionId: MCQ_QID,
        selected: "B",
        correct: "A",
        isCorrect: false,
        scored: true,
        hasBeenWrongTwice: true,
      },
    ],
  },
  questions: {
    [SHORT_QID]: {
      content: "Which pigment captures light inside a leaf?",
      choices: [],
      questionType: "short_answer",
      essayAnswer: "chlorophyll",
    },
    [MCQ_QID]: {
      content: "Where does photosynthesis mostly happen?",
      choices: [
        { id: "A", text: "In the chloroplast" },
        { id: "B", text: "In the nucleus" },
      ],
      questionType: "mcq",
    },
  },
  startedAt: "2026-08-18T11:00:00.000Z",
  submittedAt: "2026-08-18T11:40:00.000Z",
  overtimeSeconds: 0,
};

// =============================================================================
// The render — the REAL route tree, composed the way production composes it
// =============================================================================

/**
 * `RootLayout -> (layer2)/layout -> result-detail page`.
 *
 * NOTHING here supplies `EntitlementProvider`: it is reached only because
 * `app/(layer2)/layout.tsx` mounts it. Delete that mount and every assertion
 * about the note dies — which is the one thing a provider-wrapped unit test
 * can never do (frontend DD Risk R-12).
 *
 * `RootLayout` is in the composition rather than skipped because item (e) is a
 * per-LOCALE claim: the locale has to arrive the way production delivers it
 * (cookie -> `getLocale()` -> `I18nProvider` at the root), not from a wrapper
 * this file chooses.
 */
async function renderRoute(entitlement: Entitlement, locale: Locale, child?: ReactNode) {
  state.locale = locale;
  readEntitlementMock.mockResolvedValue(entitlement);
  getResultMock.mockResolvedValue(FIXTURE_RESULT);

  const inner =
    child ??
    (await ResultDetailPage({
      params: Promise.resolve({ id: FIXTURE_EXAM_ID, attemptId: FIXTURE_ATTEMPT_ID }),
    }));

  return render(await RootLayout({ children: await Layer2Layout({ children: inner }) }));
}

/** The `<li>` for one question. THROWS when it is missing: an `undefined` here
 *  would make every "the note is absent" and every "no 0, no —" assertion below
 *  vacuously true on a tree that rendered nothing at all. Presence first, value
 *  second. Document order puts the question's own `<li>` before the choice
 *  `<li>`s nested inside it, so `find` returns the outer one. */
function questionItem(container: HTMLElement, questionText: string): HTMLElement {
  const item = Array.from(container.querySelectorAll("li")).find((el) =>
    (el.textContent ?? "").includes(questionText)
  );
  if (!item) {
    throw new Error(
      `FE-2: no <li> carrying ${JSON.stringify(questionText)} — the page did not render its question list`
    );
  }
  return item;
}

/** Both question items, in page order. */
function questionItems(container: HTMLElement): [HTMLElement, HTMLElement] {
  return [
    questionItem(container, FIXTURE_RESULT.questions[SHORT_QID].content),
    questionItem(container, FIXTURE_RESULT.questions[MCQ_QID].content),
  ];
}

/** Every `<p>` whose text is EXACTLY the expected note. Exact, not `includes`:
 *  `RichText` renders question content into `<p>` too, and a substring match
 *  would let a note that lost its date still answer here. */
function notesIn(root: HTMLElement, expected: string): HTMLElement[] {
  return Array.from(root.querySelectorAll("p")).filter((p) => (p.textContent ?? "") === expected);
}

/** The affordance's idle button for one question — anchored on the id the
 *  component derives from the questionId (`ExplainStepAffordance.tsx:55`), so
 *  it proves THIS call site mounted rather than "some button exists". */
function idleButtonIn(item: HTMLElement, questionId: string): HTMLElement | null {
  return item.querySelector(`button[aria-describedby="tutor-${questionId}-reason"]`);
}

const INTERACTIVE = "a[href], button, input, select, textarea, [tabindex]";

/** Suppresses the UA focus ring without replacing it (the failure) vs restores
 *  one with a `focus-visible:` utility (fine) vs leaves the UA default alone
 *  (also fine). jsdom paints nothing, so this is the structural precondition of
 *  a visible ring, not the ring itself — the painted check is the manual pass
 *  (plan Task 6.5 item iv). Same shape as the shipped structural check in
 *  `support-widget-visibility.fixture.e2e.test.ts:112-128`. */
function focusRingVerdict(el: Element): "restored" | "ua-default" | "suppressed" {
  const cls = el.getAttribute("class") ?? "";
  if (/focus-visible:(ring|outline|border|shadow)/.test(cls)) return "restored";
  if (/(^|\s)(outline-none|outline-hidden)(\s|$)/.test(cls)) return "suppressed";
  return "ua-default";
}

type QuotaStateName = "known" | "unknown" | "exhausted";

/**
 * THROWS unless the quota state named actually reached the DOM.
 *
 * This exists because of a measured near-miss, and deleting it silently
 * un-does the fix: a missing `EntitlementProvider` collapses every quota to
 * `unknown`, so a case that merely *says* "exhausted" scans the ordinary idle
 * button and passes. Naming a state is not reaching it.
 */
function assertStateMaterialised(
  container: HTMLElement,
  items: readonly HTMLElement[],
  state: QuotaStateName
): void {
  if (state === "exhausted") {
    const upgrades = Array.from(container.querySelectorAll('a[href="/pricing"]'));
    if (upgrades.length !== items.length) {
      throw new Error(
        `FE-2: the exhausted state did not render — expected ${items.length} upgrade links, found ${upgrades.length}`
      );
    }
    if (notesIn(container, NOTE.exhausted.en).length !== items.length) {
      throw new Error("FE-2: the exhausted state rendered without its counters");
    }
    return;
  }
  const notes = notesIn(container, NOTE.known.en).length;
  const expected = state === "known" ? items.length : 0;
  if (notes !== expected) {
    throw new Error(`FE-2: the ${state} state did not render — expected ${expected} notes, found ${notes}`);
  }
  for (const [index, item] of items.entries()) {
    if (!idleButtonIn(item, index === 0 ? SHORT_QID : MCQ_QID)) {
      throw new Error(`FE-2: the ${state} state must keep the tutor button at call site ${index + 1}`);
    }
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  getCurrentUserProfileMock.mockResolvedValue({
    id: FIXTURE_USER.id,
    email: FIXTURE_USER.email,
    displayName: "Fixture Learner",
    avatarUrl: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// =============================================================================
// Fixture preconditions — every literal in this file, tied back to its source
// =============================================================================
// None of these is a claim about the product. They exist so that a rename or a
// fixture edit fails HERE, legibly, instead of silently turning one of the
// seven items below into an assertion about the wrong thing.

describe("FE-2 preconditions", () => {
  it("the ambient zone is pinned, and it is NOT the zone the formatter pins", () => {
    const ambient = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(ambient).toBe(FIXTURE_BROWSER_TIMEZONE);
    // The whole discriminating power of (b) rests on this inequality: pinned to
    // Asia/Ho_Chi_Minh, a formatter that dropped its own `timeZone` option
    // would still render the ICT date and (b) would pass while broken.
    expect(ambient).not.toBe("Asia/Ho_Chi_Minh");
  });

  it("the two calendar days really do differ, so (b) can discriminate at all", () => {
    expect(ICT_DATE).not.toBe(UTC_DATE);
    expect(new Date(FIXTURE_RESETS_AT).toISOString().slice(0, 10)).toBe(FIXTURE_RESETS_AT_UTC_DATE);
  });

  it("the hardcoded note literals carry the fixture's own numbers and ICT date", () => {
    const known = FIXTURE_ENTITLEMENT_KNOWN.tutor;
    const exhausted = FIXTURE_ENTITLEMENT_EXHAUSTED.tutor;
    if (known.state !== "known" || exhausted.state !== "known") {
      throw new Error("FE-2: the known/exhausted entitlement fixtures must both carry a known quota");
    }
    expect(exhausted.used).toBe(exhausted.limit); // the branch `isQuotaExhausted` answers true for
    expect(known.used).toBeLessThan(known.limit);
    expect(known.resetsAt).toBe(FIXTURE_RESETS_AT);
    expect(exhausted.resetsAt).toBe(FIXTURE_RESETS_AT);

    for (const locale of LOCALES) {
      expect(NOTE.known[locale]).toContain(`${known.used}/${known.limit}`);
      expect(NOTE.known[locale]).toContain(ICT_DATE);
      expect(NOTE.exhausted[locale]).toContain(`${exhausted.used}/${exhausted.limit}`);
      expect(NOTE.exhausted[locale]).toContain(ICT_DATE);
    }
  });

  it("`unknown` fixture really is the fail-OPEN one", () => {
    expect(FIXTURE_ENTITLEMENT_UNKNOWN.tutor.state).toBe("unknown");
  });

  it("the hoisted cookie name and route path match the shipped constants", () => {
    // `vi.mock` factories cannot import, so these two travel as literals inside
    // `vi.hoisted`. A rename of either shipped constant lands here.
    expect(cookieName).toBe(FIXTURE_LOCALE_COOKIE);
    expect(routePath).toBe(FIXTURE_RESULT_DETAIL_ROUTE);
  });
});

// =============================================================================
// (a) AC-042 — a <p> with BOTH the count and the reset date, beside BOTH call
//     sites, on the real route tree
// =============================================================================

describe("FE-2 (a) the note renders beside both ExplainStepAffordance call sites", () => {
  it.each(LOCALES)("locale %s — one note per question item, each carrying count AND date", async (locale) => {
    const { container } = await renderRoute(FIXTURE_ENTITLEMENT_KNOWN, locale);
    const expected = NOTE.known[locale];

    // Presence of the page itself, before anything is read out of it.
    const [shortItem, mcqItem] = questionItems(container);

    // Both affordance call sites mounted — one per branch, each identified by
    // ITS OWN questionId. Without this, "two notes" could both be sitting
    // beside the same call site.
    expect(idleButtonIn(shortItem, SHORT_QID)).not.toBeNull();
    expect(idleButtonIn(mcqItem, MCQ_QID)).not.toBeNull();

    // Exactly two notes on the whole page: one per call site, no more.
    expect(notesIn(container, expected)).toHaveLength(2);

    for (const item of [shortItem, mcqItem]) {
      const notes = notesIn(item, expected);
      expect(notes).toHaveLength(1);
      const note = notes[0];
      expect(note.tagName).toBe("P");
      // "Beside" is positional: the note is the item's last element child, i.e.
      // it sits after the affordance inside the same question, not somewhere
      // else on the page that happens to be inside the same <li>.
      expect(item.lastElementChild).toBe(note);
      // BOTH values, asserted separately — a note that kept the counters and
      // lost the date is the exact silent failure UI-D17 names.
      expect(note.textContent).toContain("12/500");
      expect(note.textContent).toContain(ICT_DATE);
      expect(note.textContent).toBe(expected);
    }
  });
});

// =============================================================================
// (b) the rendered date is the PINNED-timezone formatting of the fixture
// =============================================================================

describe("FE-2 (b) the reset date is the Asia/Ho_Chi_Minh calendar day", () => {
  it.each(LOCALES)("locale %s — the ICT day, and never the UTC day one earlier", async (locale) => {
    const { container } = await renderRoute(FIXTURE_ENTITLEMENT_KNOWN, locale);
    const notes = notesIn(container, NOTE.known[locale]);
    expect(notes).toHaveLength(2);

    for (const note of notes) {
      const text = note.textContent ?? "";
      expect(text).toContain(ICT_DATE);
      // One day off is a FAILURE, not a rounding difference (frontend DD's
      // early-verification failure response: stop). Under the UTC pin above,
      // a formatter that lost `timeZone: "Asia/Ho_Chi_Minh"` renders exactly
      // this and nothing else changes.
      expect(text).not.toContain(UTC_DATE);
    }
  });
});

// =============================================================================
// (c) the mount passes NO prop
// =============================================================================

describe("FE-2 (c) no prop is passed at the mount site", () => {
  it("the note the PAGE renders is byte-identical to <TutorQuotaNote /> with no props", async () => {
    const fromPage = await renderRoute(FIXTURE_ENTITLEMENT_KNOWN, "en");
    const pageNotes = notesIn(fromPage.container, NOTE.known.en);
    expect(pageNotes).toHaveLength(2);
    const pageHtml = pageNotes[0].outerHTML;
    cleanup();

    // Same real layout tree, same real provider, same fixture — but the note is
    // invoked here with NO props at all. Identical output is the runtime half
    // of the `formattedResetDate` prohibition: if the page were feeding the
    // component anything, these two would differ.
    const bare = await renderRoute(
      FIXTURE_ENTITLEMENT_KNOWN,
      "en",
      createElement(TutorQuotaNote)
    );
    const bareNotes = notesIn(bare.container, NOTE.known.en);
    expect(bareNotes).toHaveLength(1);
    expect(bareNotes[0].outerHTML).toBe(pageHtml);
  });

  it("the component declares no parameter at all — arity 0, not a destructured props object", () => {
    // `function f({ formattedResetDate })` has arity 1; `function f()` has 0.
    // An optional prop changes no rendered output, so every DOM assertion in
    // this file is blind to a re-added declaration. This is not.
    expect(TutorQuotaNote.length).toBe(0);
  });
});

// =============================================================================
// (d) `unknown` => the note renders NOTHING and the page still renders
// =============================================================================

describe("FE-2 (d) fail-OPEN: unknown quota hides the note without breaking the page", () => {
  it.each(LOCALES)("locale %s — no note, no 0 and no — standing in for the counters", async (locale) => {
    const unknown = await renderRoute(FIXTURE_ENTITLEMENT_UNKNOWN, locale);
    const [shortItem, mcqItem] = questionItems(unknown.container);

    // The page still renders: both question items exist AND both affordance
    // call sites still mounted. A fail-OPEN quota must not become a
    // fail-CLOSED display.
    expect(idleButtonIn(shortItem, SHORT_QID)).not.toBeNull();
    expect(idleButtonIn(mcqItem, MCQ_QID)).not.toBeNull();
    expect(notesIn(unknown.container, NOTE.known[locale])).toHaveLength(0);

    for (const item of [shortItem, mcqItem]) {
      const text = item.textContent ?? "";
      // Literal reading of the requirement, and it is only meaningful because
      // the fixture keeps both characters out of every OTHER part of a question
      // item (see FIXTURE_RESULT).
      expect(text).not.toContain("0");
      expect(text).not.toContain("—");
      // The note is not merely empty-of-text: no <p> of the note's shape is
      // rendered at all.
      expect(item.lastElementChild?.tagName).not.toBe("P");
    }

    // THE POSITIVE CONTROL, and it is the only reason the four assertions above
    // mean anything. Mutation-checked: with `EntitlementProvider` deleted from
    // `(layer2)/layout.tsx` every quota is `unknown`, so "no note, no 0, no —"
    // is trivially true and this case stayed GREEN against exactly the tree
    // AC-042 exists to catch. Feeding the SAME harness a `known` quota has to
    // produce the note — otherwise "absent" means "broken", not "fail-OPEN".
    // Same shape as `TutorQuotaNote.test.tsx:126-135`.
    cleanup();
    const known = await renderRoute(FIXTURE_ENTITLEMENT_KNOWN, locale);
    expect(notesIn(known.container, NOTE.known[locale])).toHaveLength(2);
  });

  it.each(LOCALES)("locale %s — the ONLY difference from the known render is the note itself", async (locale) => {
    // The subtraction identity. Without it, "no note" would also pass on a tree
    // that quietly dropped half the question item, and "no 0 / no —" would pass
    // on a blank one.
    const unknown = await renderRoute(FIXTURE_ENTITLEMENT_UNKNOWN, locale);
    const unknownTexts = questionItems(unknown.container).map((el) => el.textContent ?? "");
    cleanup();

    const known = await renderRoute(FIXTURE_ENTITLEMENT_KNOWN, locale);
    const knownTexts = questionItems(known.container).map((el) => el.textContent ?? "");

    expect(unknownTexts[0]).not.toBe("");
    expect(knownTexts).toEqual(unknownTexts.map((text) => text + NOTE.known[locale]));
  });
});

// =============================================================================
// (e) AC-041 — the exhausted string is NOT the generic error string
// =============================================================================

describe("FE-2 (e) the exhausted state is distinguishable from a generic failure", () => {
  it.each(LOCALES)("locale %s — NOT EQUAL to the resolved t(\"tutor.error\") value", async (locale) => {
    const { container } = await renderRoute(FIXTURE_ENTITLEMENT_EXHAUSTED, locale);
    const [shortItem, mcqItem] = questionItems(container);

    // The generic string is resolved at RUNTIME from the real dictionary in the
    // locale under test — the same lookup `ExplainStepAffordance.tsx:157` makes
    // for all four explainStep error codes. Not a substring heuristic, not a
    // literal copied into this file: a copy edit to `tutor.error` moves this
    // value and the inequality still means what it says.
    const genericError = createTranslate(getDictionary(locale))("tutor.error");
    expect(genericError).not.toBe("tutor.error"); // a missing key echoes its own name back
    expect(genericError.length).toBeGreaterThan(0);

    for (const item of [shortItem, mcqItem]) {
      // Presence first: the exhausted branch replaced the button entirely.
      expect(idleButtonIn(item, SHORT_QID)).toBeNull();
      expect(idleButtonIn(item, MCQ_QID)).toBeNull();
      const reason = Array.from(item.querySelectorAll("p")).find(
        (p) => (p.textContent ?? "") === EXHAUSTED_COPY[locale]
      );
      if (!reason) {
        throw new Error(
          `FE-2(e): the exhausted reason did not render; item.textContent = ${JSON.stringify(item.textContent)}`
        );
      }
      const rendered = reason.textContent ?? "";
      expect(rendered.length).toBeGreaterThan(0);

      // AC-041, the whole of it.
      expect(rendered).not.toBe(genericError);
    }

    // Stronger than the per-node inequality and cheap: the generic error string
    // appears NOWHERE on a page whose only tutor state is "out of allowance".
    expect(container.textContent ?? "").not.toContain(genericError);

    // The refusal is derived BEFORE the press, from entitlement — not from an
    // error code returned after one (UI-D3). Zero action calls prove it.
    expect(explainStepMock).not.toHaveBeenCalled();
  });

  it("the counters are still readable in the exhausted state", async () => {
    // AC-042 does not stop applying once the allowance is gone — that is
    // precisely when the reset date is the thing the user needs.
    const { container } = await renderRoute(FIXTURE_ENTITLEMENT_EXHAUSTED, "en");
    expect(notesIn(container, NOTE.exhausted.en)).toHaveLength(2);
  });
});

// =============================================================================
// (f) the upgrade link goes to /pricing
// =============================================================================

describe("FE-2 (f) the exhausted state leads to S-01 /pricing", () => {
  it.each(LOCALES)("locale %s — one upgrade link per call site, href exactly /pricing", async (locale) => {
    const { container } = await renderRoute(FIXTURE_ENTITLEMENT_EXHAUSTED, locale);
    const items = questionItems(container);

    for (const item of items) {
      const links = Array.from(item.querySelectorAll("a")).filter(
        (a) => (a.textContent ?? "") === UPGRADE_LABEL[locale]
      );
      expect(links).toHaveLength(1);
      // Exact equality, not `startsWith`/`includes`: "/pricing/checkout" and
      // "/pricing?x" both satisfy a loose check and neither is the S-04 -> S-01
      // transition.
      expect(links[0].getAttribute("href")).toBe("/pricing");
    }
  });
});

// =============================================================================
// (g) AC-043's browser-observable half
// =============================================================================

describe("FE-2 (g) every interactive element in the new states is reachable and un-suppressed", () => {
  const cases: Array<[QuotaStateName, Entitlement]> = [
    ["known", FIXTURE_ENTITLEMENT_KNOWN],
    ["unknown", FIXTURE_ENTITLEMENT_UNKNOWN],
    ["exhausted", FIXTURE_ENTITLEMENT_EXHAUSTED],
  ];

  it.each(cases)("%s — Tab-reachable, no native disabled, focus indicator not suppressed", async (name, entitlement) => {
    const { container } = await renderRoute(entitlement, "en");
    const items = questionItems(container);

    // WITHOUT THIS, THIS WHOLE BLOCK MEASURES THE HARNESS. Mutation-checked:
    // with `EntitlementProvider` deleted from `(layer2)/layout.tsx`, every
    // quota is `unknown`, so the `known` and `exhausted` rows below scan the
    // very same idle button the `unknown` row scans — and all three stayed
    // GREEN against a tree where the state under test never existed. The
    // assertion is now made against the state, not merely in its name.
    assertStateMaterialised(container, items, name);

    const interactive = items.flatMap((item) => Array.from(item.querySelectorAll(INTERACTIVE)));
    // Count BEFORE iterating: a loop over an empty list is green and silent,
    // and "there are no interactive elements" is exactly what a tree that
    // rendered nothing looks like. One control per call site, at minimum.
    expect(interactive.length).toBeGreaterThanOrEqual(items.length);

    for (const el of interactive) {
      // No jest-dom matchers in this repo — raw DOM reads.
      expect(el.hasAttribute("disabled")).toBe(false);
      expect((el as HTMLButtonElement).disabled === true).toBe(false);
      expect(el.getAttribute("aria-disabled")).not.toBe("true");

      const tabindex = el.getAttribute("tabindex");
      expect(tabindex === null || Number(tabindex) >= 0).toBe(true);

      (el as HTMLElement).focus();
      expect(container.ownerDocument.activeElement).toBe(el);

      expect(focusRingVerdict(el)).not.toBe("suppressed");
    }
  });
});

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
//
// -----------------------------------------------------------------------------
// FE-3 — IMPLEMENTATION (plan Task 3.9). Everything above this line is the
// generated annotation block, kept verbatim; everything below is the case.
// -----------------------------------------------------------------------------
//
// WHAT THIS SECTION ADDS TO THE SHARED HARNESS ABOVE — stated here because FE-2
// and FE-3 live in ONE module and therefore share every `vi.mock` in it:
//   - `getCurrentUser` was appended to the EXISTING `@/lib/auth/getCurrentUser`
//     factory (see there). S-05's login gate reads it; FE-2's route reads
//     `getCurrentUserProfile`.
//   - two NEW module boundaries: `listMyOrders()` — S-05's data source, the same
//     kind of seam FE-2 opens for `getResult()` — and `recheckOrder()`, which is
//     THE sanctioned mock boundary for this case and is routed into the COUNTED
//     stub from `subscriptionFixtureData.ts` rather than into a bare `vi.fn()`,
//     because (f) asserts an invocation COUNT and (a)/(e) need the in-flight
//     window that `holdNextRecheck()` provides.
//   - `resolveServerTree()` — see its own comment.
// The route tree ITSELF is real: `app/layout.tsx`, `(billing)/layout.tsx`
// (hence the `EntitlementProvider` mount, which is where C-11's four values
// come from), `me/orders/page.tsx`, C-07, C-08, C-09, C-10, C-11, both
// dictionaries and `lib/format/datetime.ts`. The copy is the thing under test,
// so no dictionary value is stubbed and no expected sentence below is computed
// from `t()`.
//
// THE FULL SET OF MODULE DOUBLES REACHING THE RENDERED S-05 TREE — six
// modules, not one, and each named here because "only the action module is
// stubbed" reads as a guarantee that nothing else can be hiding a regression:
//   1. `@/lib/billing/orderActions` — the SANCTIONED boundary (counted).
//   2. `@/app/(billing)/queries` — `listMyOrders()`, the data source.
//   3. `@/lib/auth/getCurrentUser` — S-05's login gate.
//   4. `@/lib/billing/readEntitlement` — the value `(billing)/layout.tsx`
//      hands to the real `EntitlementProvider`.
//   5. `next/navigation` — the whole module, FE-2's factory, four names:
//      `usePathname()` answers FE-2's result-detail route (nothing on S-05
//      reads it but nav highlighting, and no assertion below touches it);
//      `useSearchParams()` answers an empty `URLSearchParams`; `redirect()`
//      throws loudly; and `useRouter().refresh` is `refreshMock` — a REAL
//      seam under C-10's handler, not a runtime substitution, which is why
//      (d) counts it instead of ignoring it.
//   6. `@/components/shared/SkipLink` — stubbed to `null` inside
//      `(billing)/layout.tsx` (async Server Component; see its own comment).
// Nothing else in the tree is replaced.

const { listMyOrdersMock, getCurrentUserMock, recheckOrderMock } = vi.hoisted(() => ({
  listMyOrdersMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  recheckOrderMock: vi.fn(),
}));

vi.mock("@/app/(billing)/queries", () => ({ listMyOrders: listMyOrdersMock }));
vi.mock("@/lib/billing/orderActions", () => ({ recheckOrder: recheckOrderMock }));

import BillingLayout from "@/app/(billing)/layout";
import MyOrdersPage from "@/app/(billing)/me/orders/page";
import type { MyOrderRow } from "@/app/(billing)/queries";
import type { RecheckOutcome } from "@/lib/billing/orderActions";
import {
  createSubscriptionActionStubs,
  FIXTURE_NOW,
  FIXTURE_ORDER_CANCELLED,
  FIXTURE_ORDER_EXPIRED,
  FIXTURE_ORDER_PAID,
  FIXTURE_ORDER_PENDING,
  FIXTURE_ORDER_PENDING_NO_QR,
  FIXTURE_ORDER_ROWS,
  FIXTURE_ORDER_UNRECOGNISED,
  FIXTURE_RECHECK_OUTCOMES,
} from "./subscriptionFixtureData";

// =============================================================================
// Expected copy — FIXED LITERALS, typed out by hand
// =============================================================================
// Same rule as FE-2's `NOTE`, and for FE-3 it is the whole point of the case:
// AC-036's negative half ("must not read as a failure") has NO observable
// criterion other than string EQUALITY against an approved sentence. An
// expectation rebuilt from `t("billing.recheck.stillPending")` moves with the
// dictionary, so a copy edit that reintroduces failure vocabulary would edit
// the test at the same time and the case could never fail. Substring matching
// is the same defect one step weaker: "Something went wrong. Still awaiting
// payment." contains the approved sentence.

const STILL_PENDING: Record<Locale, string> = {
  en: "Still awaiting payment. Transfer the exact amount with the transfer note shown on the payment screen, then check again.",
  vi: "Vẫn đang chờ khoản chuyển. Bạn chuyển đúng số tiền kèm nội dung chuyển khoản ghi trên màn hình thanh toán, rồi kiểm tra lại.",
};

const RATE_LIMITED: Record<Locale, string> = {
  en: "You checked several times in a row. Wait a moment, then check again.",
  vi: "Bạn vừa kiểm tra liên tiếp nhiều lần. Chờ một chút rồi kiểm tra lại nhé.",
};

/** The sentence a TERMINAL row's control carries as its reason — the shipped
 *  `billing.recheck.notPending` string, reused rather than duplicated (C-10). */
const ALREADY_CLOSED: Record<Locale, string> = {
  en: "This order is already closed, so re-checking will not change it.",
  vi: "Đơn này đã đóng rồi, nên kiểm tra lại cũng không đổi được gì.",
};

/** C-10's IN-FLIGHT reason (idiom 3), the sentence the screen-reader user
 *  hears while the call is outstanding. Pinned like the four above, and for the
 *  same reason: a length check cannot tell this sentence from
 *  `billing.recheck.amountMismatch` — one dictionary key over — and swapping
 *  the two announces a manufactured payment failure ("a person has to settle
 *  this one") before any result exists. That is the AC-036 vocabulary
 *  regression, moved from the outcome node into the busy node.
 *  Written as escapes on purpose: the trailing character is U+2026 HORIZONTAL
 *  ELLIPSIS, and three periods typed in its place look identical in a diff
 *  while failing the equality below. Both values verified byte-for-byte
 *  against `lib/i18n/dictionaries/{en,vi}.ts`.
 *
 *  HONEST LIMIT: only the `en` value is compared to rendered output — the busy
 *  window is reachable in exactly one case below, and that case is `en`-only.
 *  The `vi` value is held by the distinctness precondition alone until a `vi`
 *  in-flight case exists. */
const BUSY: Record<Locale, string> = {
  en: "Checking with the payment provider\u2026",
  vi: "\u0110ang h\u1ecfi l\u1ea1i nh\u00e0 cung c\u1ea5p thanh to\u00e1n\u2026",
};

/** C-09's word for `pending`. (c) asserts the badge still reads THIS after a
 *  `not_paid_yet` re-check — the "still waiting" half of AC-036. */
const AWAITING_PAYMENT: Record<Locale, string> = {
  en: "Awaiting payment",
  vi: "Chờ thanh toán",
};

/** C-11's four AC-056 rows for `FIXTURE_ENTITLEMENT_KNOWN`, in document order.
 *  These are the values (d) compares byte-for-byte across the activation, and
 *  they are pinned to literals FIRST so that "unchanged" cannot be satisfied by
 *  a C-11 that rendered nothing, or rendered "0"/"—", at both ends. */
const SUMMARY_TERMS: Record<Locale, readonly string[]> = {
  en: ["Current plan", "Period resets", "Tutor hints", "Exam uploads"],
  vi: ["Gói hiện tại", "Kỳ đặt lại vào", "Lượt gia sư", "Lượt tải đề"],
};

const SUMMARY_VALUES: Record<Locale, readonly string[]> = {
  en: ["Free", "16/09/2026", "488 of 500 hints left", "4 of 5 uploads left"],
  vi: ["Miễn phí", "16/09/2026", "Còn 488/500 lượt gia sư", "Còn 4/5 lượt tải đề"],
};

/** The six other sentences C-10 can render in the SAME locale, as dictionary
 *  KEYS. (g) resolves them at runtime and asserts the rate-limited sentence
 *  equals none of them: an inequality against a runtime value keeps meaning
 *  what it says after a copy edit, which is exactly the opposite of the
 *  equality above. `billing.orders.loadError` is the generic string AC-037
 *  forbids conflating with; `profile.error.sessionExpired` is C-10's seventh
 *  branch (`unauthenticated`), reused rather than given its own key. */
const OTHER_OUTCOME_KEYS = [
  "billing.recheck.settled",
  "billing.recheck.stillPending",
  "billing.recheck.notPending",
  "billing.recheck.unknownOrder",
  "billing.recheck.amountMismatch",
  "billing.recheck.providerUnavailable",
  "profile.error.sessionExpired",
  "billing.orders.loadError",
] as const;

// =============================================================================
// The action-module stub — counted, and shared by every case below
// =============================================================================
// `createSubscriptionActionStubs()` rather than a bare `vi.fn()`: the counters,
// `holdNextRecheck()` and `releaseHeldRecheck()` are the contract plan Task 0.7
// wrote for exactly these obligations, and re-implementing them here would put
// FE-3's (f) on a second, unreviewed copy of the guard's own test double.
// `renderOrdersRoute()` resets it, so no case inherits another's count.

const stubs = createSubscriptionActionStubs();

const PENDING_CODE = FIXTURE_ORDER_PENDING.orderCode;

/** The three rows whose control must be MOUNTED-BUT-REFUSING, and the three
 *  whose control must be fully active. `refunded` sits in the second group on
 *  purpose (FE-AC-10): re-checking is the only action that can clear an
 *  unrecognised status, so a `status !== "pending"` terminal test — which agrees
 *  with the shipped set on the other five rows — must fail here. */
const TERMINAL_ORDERS = [FIXTURE_ORDER_PAID, FIXTURE_ORDER_EXPIRED, FIXTURE_ORDER_CANCELLED];
const ACTIVE_ORDERS = [FIXTURE_ORDER_PENDING, FIXTURE_ORDER_PENDING_NO_QR, FIXTURE_ORDER_UNRECOGNISED];

// =============================================================================
// The render — S-05 on the REAL route tree
// =============================================================================

/**
 * Resolve every ASYNC SERVER COMPONENT in a tree to the elements it returns,
 * leaving client components untouched for `render()` to run.
 *
 * WHY IT EXISTS. FE-2's `render(await Page(props))` works only while the awaited
 * component has no async CHILD. S-05 has two: `page.tsx` renders C-07
 * `OrderList`, which renders C-08 `OrderRow`. React 19's client renderer refuses
 * an async component outright — it suspends and hands back an EMPTY tree, which
 * is worse than red, because "the alert is absent" and "the summary did not
 * change" are both trivially true of nothing at all
 * (`me/orders/__tests__/renderServerTree.tsx` records the same limit).
 *
 * The shipped alternative, `renderToReadableStream` + `innerHTML`, cannot be
 * used here: it produces STRINGS, and FE-3 needs focus, a click and a state
 * update. So the server half is resolved the way the server resolves it —
 * by awaiting it — and the client half is then rendered by
 * `@testing-library/react`, which is exactly the split Next makes.
 *
 * The composition itself is NOT rebuilt here: `page.tsx` still decides that
 * C-11 sits between the header and C-07, `(billing)/layout.tsx` still decides
 * where `EntitlementProvider` mounts, and C-08 still decides that C-10 is
 * mounted per row with the row's own status. Delete any of those and every
 * assertion below dies — which is the property a hand-composed tree would lose.
 */
async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) {
    return Promise.all(node.map((child: ReactNode) => resolveServerTree(child)));
  }
  if (!isValidElement<{ children?: ReactNode }>(node)) return node;
  // `async function f() {}` has `f.constructor.name === "AsyncFunction"`; a
  // client component is an ordinary Function and must NOT be called here (it
  // would run hooks outside a renderer).
  if (typeof node.type === "function" && node.type.constructor.name === "AsyncFunction") {
    const component = node.type as (props: unknown) => Promise<ReactNode>;
    return resolveServerTree(await component(node.props));
  }
  const { children } = node.props;
  if (children === undefined) return node;
  return cloneElement(node, undefined, await resolveServerTree(children));
}

/**
 * `RootLayout -> (billing)/layout -> /me/orders/page`, composed the way
 * production composes them and fed the same way: the entitlement arrives as a
 * `readEntitlement()` VALUE at the real provider mount, and the rows arrive as
 * a `listMyOrders()` value at the real page.
 *
 * Resets the action stub and asserts the count is zero AFTER the render: a
 * count read later means nothing unless the render itself contributed none, and
 * a page that re-checks every row on mount is a real (and expensive) mistake.
 *
 * PINS THE CLOCK to `FIXTURE_NOW`. `subscriptionFixtureData.ts` writes every
 * timestamp relative to that instant and says the harness pins it via
 * `driver.clock.setFixedTime` — true of the browser-driver harness, but this
 * lane is in-process and has no driver, so the pin is made HERE instead.
 * Unpinned, `OrderRow.isWindowStillOpen()` reads the real `Date.now()`,
 * `FIXTURE_PENDING_UNTIL_FUTURE` (12:25 on 2026-08-18) is already past, and
 * S-05 silently renders WITHOUT the "continue paying" link the fixture was
 * built to produce. Nothing is red today because no assertion reads that link
 * — but `before.html`/`after.html` are whole-page strings, so every future
 * assertion on them would be wall-clock dependent, i.e. green until some
 * Tuesday. `toFake: ["Date"]` and nothing else: faking `setTimeout` too would
 * put React's scheduler on a clock this file never advances. `afterEach`
 * restores the real one.
 */
async function renderOrdersRoute(options: {
  entitlement: Entitlement;
  locale: Locale;
  rows?: readonly MyOrderRow[];
}) {
  const { entitlement, locale, rows = FIXTURE_ORDER_ROWS } = options;
  state.locale = locale;
  vi.useFakeTimers({ toFake: ["Date"], now: new Date(FIXTURE_NOW) });
  stubs.reset();
  // Reset beside the action stub, for the same reason: a count read after an
  // activation means nothing unless this render started at zero.
  refreshMock.mockClear();
  recheckOrderMock.mockImplementation((orderCode: number) => stubs.simulateRecheckOrder(orderCode));
  getCurrentUserMock.mockResolvedValue({ id: FIXTURE_USER.id });
  readEntitlementMock.mockResolvedValue(entitlement);
  listMyOrdersMock.mockResolvedValue([...rows]);

  // Children as the third argument, not as a prop: `react/no-children-prop` is
  // an error under `--max-warnings 0`, and the two forms build the same element.
  const tree = await resolveServerTree(
    createElement(RootLayout, null, createElement(BillingLayout, null, createElement(MyOrdersPage)))
  );
  if (!isValidElement(tree)) {
    throw new Error("FE-3: the route tree did not resolve to an element");
  }
  const view = render(tree);
  if (stubs.recheckOrderCallCount !== 0) {
    throw new Error(
      `FE-3: rendering S-05 called recheckOrder ${stubs.recheckOrderCallCount} times — every count below would be reading the render, not the activation`
    );
  }
  return view;
}

// =============================================================================
// Readers — each one THROWS on absence
// =============================================================================
// A `null` here would make "the alert is absent", "nothing changed" and "the
// badge still says X" all vacuously true against a tree that rendered nothing.
// Presence first, value second (FE-2's `questionItem` idiom).

function recheckButtonFor(container: HTMLElement, orderCode: number): HTMLButtonElement {
  // Anchored on the id C-10 derives from the order code
  // (`RecheckOrderControl.tsx`: `recheck-${orderCode}-reason`), so it proves
  // THIS row's control mounted rather than "some button exists".
  const button = container.querySelector(`button[aria-describedby="recheck-${orderCode}-reason"]`);
  if (!(button instanceof HTMLButtonElement)) {
    throw new Error(`FE-3: no re-check control for order ${orderCode} — C-08 did not mount C-10 on that row`);
  }
  return button;
}

function rowFor(container: HTMLElement, orderCode: number): HTMLElement {
  const row = recheckButtonFor(container, orderCode).closest("li");
  if (!(row instanceof HTMLElement)) {
    throw new Error(`FE-3: the control for order ${orderCode} is not inside an <li>`);
  }
  return row;
}

function reasonFor(container: HTMLElement, orderCode: number): string {
  const reason = container.querySelector(`#recheck-${orderCode}-reason`);
  if (!reason) throw new Error(`FE-3: no reason node for order ${orderCode}`);
  return reason.textContent ?? "";
}

function alertsIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll('[role="alert"]'));
}

function theOnlyAlert(container: HTMLElement): HTMLElement {
  const alerts = alertsIn(container);
  if (alerts.length !== 1) {
    throw new Error(`FE-3: expected exactly one role="alert" node, found ${alerts.length}`);
  }
  return alerts[0];
}

/** C-09's word, with the decorative glyph removed — same reading as the shipped
 *  `RecheckOrderControl.test.tsx`. The badge is the one `<span>` in the row
 *  whose first child is `aria-hidden` (that glyph). */
function badgeTextIn(row: HTMLElement): { full: string; word: string } {
  const badges = Array.from(row.querySelectorAll("span")).filter((el) =>
    el.firstElementChild?.hasAttribute("aria-hidden")
  );
  if (badges.length !== 1) {
    throw new Error(`FE-3: expected exactly one status badge in the row, found ${badges.length}`);
  }
  const full = badges[0].textContent ?? "";
  const glyph = badges[0].firstElementChild?.textContent ?? "";
  const word = full.slice(glyph.length);
  if (word === "") throw new Error("FE-3: the badge rendered an empty word");
  return { full, word };
}

/** C-11's four rows. `<dl>` is C-11's fingerprint on this screen: C-07 and C-08
 *  build no definition list, so exactly one `<dl>` must exist (the same
 *  identification `pageMountsPlanSummary.test.tsx` uses). */
function summaryOf(container: HTMLElement): { terms: string[]; values: string[]; html: string } {
  const lists = container.querySelectorAll("dl");
  if (lists.length !== 1) {
    throw new Error(`FE-3: expected exactly one C-11 <dl>, found ${lists.length}`);
  }
  const list = lists[0];
  return {
    terms: Array.from(list.querySelectorAll("dt")).map((n) => n.textContent ?? ""),
    values: Array.from(list.querySelectorAll("dd")).map((n) => n.textContent ?? ""),
    html: list.outerHTML,
  };
}

/** The whole `<main>`, with any outcome node subtracted. (d)'s subtraction
 *  identity reads this: the ONLY thing a non-settling re-check may add to the
 *  screen is the alert. Anything else — a locally patched badge, a summary
 *  recomputed from an optimistic value, a control that swaps itself out — moves
 *  this string. */
function pageHtmlWithoutOutcome(container: HTMLElement): string {
  const main = container.querySelector("main");
  if (!main) throw new Error("FE-3: the page rendered no <main>");
  const clone = main.cloneNode(true) as HTMLElement;
  for (const alert of Array.from(clone.querySelectorAll('[role="alert"]'))) alert.remove();
  return clone.innerHTML;
}

function activeElementOf(container: HTMLElement): Element | null {
  return container.ownerDocument.activeElement;
}

/** No jest-dom matchers in this repo: the two native-`disabled` reads are made
 *  raw, and BOTH are made. The attribute and the property are set by different
 *  mistakes — `disabled={busy}` sets the property with no attribute in some
 *  renderers — and either one drops the control out of the tab order. */
function assertNeverNativelyDisabled(button: HTMLButtonElement, where: string): void {
  // The `if` exists only to name WHICH state failed — three call sites read the
  // same two properties, and "expected true to be false" alone does not say
  // whether idle, busy or terminal broke.
  if (button.hasAttribute("disabled") || button.disabled) {
    throw new Error(`FE-3: the re-check control carries native \`disabled\` in the ${where} state`);
  }
  expect(button.hasAttribute("disabled")).toBe(false);
  expect(button.disabled).toBe(false);
}

// =============================================================================
// The drive — one activation of the pending row's control
// =============================================================================
// Every "before" value is READ AND COPIED before the click; the "after" values
// are read from the same live DOM afterwards. `before` is never recomputed from
// the fixture at the end, because a value recomputed from the input is not an
// observation of what was on the screen.

interface Activation {
  container: HTMLElement;
  button: HTMLButtonElement;
  row: HTMLElement;
  before: { alerts: number; badge: string; summary: ReturnType<typeof summaryOf>; html: string };
  after: { alerts: number; badge: string; summary: ReturnType<typeof summaryOf>; html: string };
}

async function activatePendingRow(locale: Locale, outcome: RecheckOutcome): Promise<Activation> {
  const { container } = await renderOrdersRoute({ entitlement: FIXTURE_ENTITLEMENT_KNOWN, locale });
  stubs.setRecheckOutcome(outcome);

  const row = rowFor(container, PENDING_CODE);
  const button = recheckButtonFor(container, PENDING_CODE);
  const before = {
    alerts: alertsIn(container).length,
    badge: badgeTextIn(row).full,
    summary: summaryOf(container),
    html: pageHtmlWithoutOutcome(container),
  };

  // A keyboard user is on the control when it is activated — which is the only
  // way (e)'s "focus is still there afterwards" can mean anything.
  button.focus();
  expect(activeElementOf(container)).toBe(button);

  await act(async () => {
    button.click();
  });

  return {
    container,
    button,
    row,
    before,
    after: {
      alerts: alertsIn(container).length,
      badge: badgeTextIn(row).full,
      summary: summaryOf(container),
      html: pageHtmlWithoutOutcome(container),
    },
  };
}

// =============================================================================
// Fixture preconditions — every literal above, tied back to its source
// =============================================================================
// None of these is a claim about the product. They exist so that a fixture edit
// or a rename fails HERE, legibly, instead of turning one of the seven items
// below into an assertion about the wrong thing.

describe("FE-3 preconditions", () => {
  it("the row FE-3 activates is `pending`, and the six fixture rows are the six the cases assume", () => {
    const rowsByCode = new Map(FIXTURE_ORDER_ROWS.map((row) => [row.orderCode, row]));
    expect(rowsByCode.get(PENDING_CODE)?.status).toBe("pending");

    // The terminal/active split below IS the partition of the rendered page, so
    // a seventh fixture row (or a status change) must land here.
    expect([...TERMINAL_ORDERS, ...ACTIVE_ORDERS].map((o) => o.orderCode).sort()).toEqual(
      FIXTURE_ORDER_ROWS.map((row) => row.orderCode).sort()
    );
    for (const order of TERMINAL_ORDERS) {
      expect(rowsByCode.get(order.orderCode)?.status).toBe(order.status);
      expect(["paid", "expired", "cancelled"]).toContain(order.status);
    }
    // FE-AC-10: an unrecognised status is NOT terminal.
    expect(FIXTURE_ORDER_UNRECOGNISED.status).toBe("refunded");
  });

  it("the clock really is pinned to FIXTURE_NOW, so the fixture's payment window is open", async () => {
    // Without this case the pin can be deleted and nothing goes red: no
    // assertion in FE-3 reads the continue-paying link, and every before/after
    // comparison stays true of a page missing it at BOTH ends. What it costs is
    // that `before.html` becomes a function of the wall clock.
    const { container } = await renderOrdersRoute({
      entitlement: FIXTURE_ENTITLEMENT_KNOWN,
      locale: "en",
    });
    expect(Date.now()).toBe(Date.parse(FIXTURE_NOW));
    expect(Date.parse(FIXTURE_ORDER_PENDING.pendingUntil)).toBeGreaterThan(Date.now());

    // The observable consequence, read off the rendered row (FE-AC-11): the
    // window is open, so C-08 offers the way back to the payment screen. The
    // terminal rows must not.
    const link = rowFor(container, PENDING_CODE).querySelector(
      `a[href="/pricing/checkout?order=${PENDING_CODE}"]`
    );
    expect(link).not.toBeNull();
    for (const order of TERMINAL_ORDERS) {
      expect(rowFor(container, order.orderCode).querySelector('a[href^="/pricing/checkout"]')).toBeNull();
    }
  });

  it("the hardcoded C-11 literals carry the fixture's own numbers and its ICT reset date", () => {
    const { tutor, upload } = FIXTURE_ENTITLEMENT_KNOWN;
    if (tutor.state !== "known" || upload.state !== "known") {
      throw new Error("FE-3: the known entitlement fixture must carry both quotas known");
    }
    // Two fields of the same shape seeded with DIFFERENT values: equal ones make
    // a tutor/upload swap invisible in (d).
    expect(tutor.limit).not.toBe(upload.limit);
    expect(tutor.used).not.toBe(upload.used);

    for (const locale of LOCALES) {
      const values = SUMMARY_VALUES[locale];
      expect(values[1]).toBe(ICT_DATE); // the same cross-day instant FE-2(b) uses
      expect(values[2]).toContain(String(tutor.limit - tutor.used));
      expect(values[2]).toContain(String(tutor.limit));
      expect(values[3]).toContain(String(upload.limit - upload.used));
      expect(values[3]).toContain(String(upload.limit));
      // AC-056 asks for what is LEFT, not what was used. A summary printing
      // `used` renders the fixture's 12 and would still pass the
      // contains-the-limit check above.
      expect(values[2]).not.toContain(String(tutor.used));
      // No item may collapse into another — (d) compares four values, and two
      // equal ones would hide a swap between them.
      expect(new Set(values).size).toBe(values.length);
      expect(new Set(SUMMARY_TERMS[locale]).size).toBe(SUMMARY_TERMS[locale].length);
    }
  });

  it("the five expected sentences are distinct from each other in both locales", () => {
    for (const locale of LOCALES) {
      const sentences = [
        STILL_PENDING[locale],
        RATE_LIMITED[locale],
        ALREADY_CLOSED[locale],
        AWAITING_PAYMENT[locale],
        // BUSY belongs in this set or the equality that pins it is worth
        // nothing: a busy string that collided with an outcome string would
        // satisfy both assertions at once.
        BUSY[locale],
      ];
      expect(new Set(sentences).size).toBe(sentences.length);
      for (const sentence of sentences) expect(sentence.length).toBeGreaterThan(0);
    }
    // And across locales: an `en` sentence rendered under the `vi` cookie is a
    // locale-plumbing failure, not a copy failure, and the per-locale equality
    // assertions only separate the two if the two differ.
    expect(STILL_PENDING.en).not.toBe(STILL_PENDING.vi);
    expect(RATE_LIMITED.en).not.toBe(RATE_LIMITED.vi);
    expect(BUSY.en).not.toBe(BUSY.vi);
  });
});

// =============================================================================
// (a) the outcome node APPEARS — absent before, present after
// =============================================================================

describe("FE-3 (a) a role=\"alert\" node is absent before the activation and present after", () => {
  it.each(LOCALES)("locale %s — nothing on S-05 carries role=alert until the control is activated", async (locale) => {
    const { container, row, before, after } = await activatePendingRow(
      locale,
      FIXTURE_RECHECK_OUTCOMES.stillPending
    );

    // ABSENT BEFORE, page-wide. A case that only checks "present after" stays
    // green against a control that renders its alert node unconditionally —
    // and an alert present at mount announces, to a screen reader, that
    // something happened when nothing did (C-07's empty state records the same
    // reasoning for itself).
    expect(before.alerts).toBe(0);
    // PRESENT AFTER, and exactly one page-wide: the five OTHER rows' controls
    // must not have produced an outcome node of their own.
    expect(after.alerts).toBe(1);

    const alert = theOnlyAlert(container);
    expect(row.contains(alert)).toBe(true);
    expect(alert.getAttribute("role")).toBe("alert");
    // No `aria-live` on the node (C-10, idiom 1): `role="alert"` is announced on
    // INSERTION, while a pre-inserted live region may never be read at all —
    // this repo's own SuccessToast finding. A node carrying both is a node
    // someone re-introduced the pre-inserted region under.
    expect(alert.hasAttribute("aria-live")).toBe(false);
    expect((alert.textContent ?? "").length).toBeGreaterThan(0);
  });
});

// =============================================================================
// (b) the sentence EQUALS the approved `billing.recheck.stillPending` string
// =============================================================================

describe("FE-3 (b) the still-pending outcome reads as an instruction, per locale", () => {
  it.each(LOCALES)("locale %s — string EQUALITY against the approved sentence", async (locale) => {
    const { container } = await activatePendingRow(locale, FIXTURE_RECHECK_OUTCOMES.stillPending);

    // Equality, not `toContain`: a sentence that PREFIXES failure vocabulary
    // onto the approved text ("Something went wrong. Still awaiting payment…")
    // satisfies every substring check and is the exact regression AC-036 names.
    expect(theOnlyAlert(container).textContent).toBe(STILL_PENDING[locale]);
  });

  it("the two locales really do render different text from the same fixture", async () => {
    // Without this, both per-locale assertions above could be reading the same
    // hardcoded `en` string through a locale that never reached the tree.
    const en = await activatePendingRow("en", FIXTURE_RECHECK_OUTCOMES.stillPending);
    const sentenceEn = theOnlyAlert(en.container).textContent;
    cleanup();
    const vi = await activatePendingRow("vi", FIXTURE_RECHECK_OUTCOMES.stillPending);
    expect(theOnlyAlert(vi.container).textContent).not.toBe(sentenceEn);
  });
});

// =============================================================================
// (c) the badge still reads "awaiting payment" (AC-036)
// =============================================================================

describe("FE-3 (c) the status badge is unchanged by a re-check that did not settle", () => {
  it.each(LOCALES)("locale %s — still the `pending` word, before and after", async (locale) => {
    const { row, before, after } = await activatePendingRow(locale, FIXTURE_RECHECK_OUTCOMES.stillPending);

    // Pinned to a literal FIRST: "unchanged" is worthless if the badge read
    // "Paid" at both ends, or rendered an empty pill at both ends.
    expect(badgeTextIn(row).word).toBe(AWAITING_PAYMENT[locale]);
    // Byte-identical, glyph included — C-09 marks `paid` with a different glyph
    // AND different classes, so a locally patched badge moves this string even
    // if the word survived.
    expect(after.badge).toBe(before.badge);
  });
});

// =============================================================================
// (d) 0 WRONG GRANTS — every entitlement-derived value byte-identical
// =============================================================================

describe("FE-3 (d) a re-check that does not settle changes nothing about entitlement", () => {
  it.each(LOCALES)("locale %s — C-11's four AC-056 values are byte-identical across the activation", async (locale) => {
    const { before, after } = await activatePendingRow(locale, FIXTURE_RECHECK_OUTCOMES.stillPending);

    // NON-DEGENERACY FIRST, against fixed literals. Two empty arrays are
    // byte-identical, and so are two copies of a summary that says "Premium"
    // at both ends. Without this half, the comparison below cannot tell "no
    // wrong grant" from "no summary".
    expect(before.summary.terms).toEqual([...SUMMARY_TERMS[locale]]);
    expect(before.summary.values).toEqual([...SUMMARY_VALUES[locale]]);

    // HONEST NOTE ON WHAT THE NEXT FOUR LINES CAN AND CANNOT FAIL FOR. In THIS
    // harness the before/after comparison cannot fail for any single-file
    // product mutant, and that is a property of the harness, not of the
    // product: (i) `EntitlementContext` (`lib/billing/entitlement.tsx:21`)
    // holds a STATIC value handed down by an async server layout and read via
    // `use(context)`, so nothing on the client can move it; (ii) there is no
    // shared store between C-10 and its siblings, so C-10 has no reachable path
    // to the badge or the summary; (iii) the one path that WOULD legitimately
    // move them — `router.refresh()` — is `refreshMock` here, so the server
    // re-render never lands. The discriminating power of (c)/(d) therefore
    // lives in the literal comparisons (the badge word above and the two
    // non-degeneracy literals just above) and in the whole-page subtraction
    // identity below, which IS a genuine before/after measurement. The
    // `refreshMock` count added at the end of this case is what restores
    // meaning to the after-half: it measures that the catch-up was scheduled.
    // KEPT DELIBERATELY: it guards a future shape this screen may take — an
    // optimistic local patch, or a client-side entitlement store — under which
    // it becomes the assertion that fails first.
    //
    // The comparison itself: captured BEFORE the click, compared against the
    // live DOM after it.
    expect(after.summary.terms).toEqual(before.summary.terms);
    expect(after.summary.values).toEqual(before.summary.values);
    expect(after.summary.html).toBe(before.summary.html);

    // The subtraction identity: the ONLY difference the whole page is allowed
    // to show is the outcome node itself. A control that optimistically patched
    // the badge, or a summary recomputed from a client-side guess, moves this
    // string even when the four values above happen to survive.
    expect(after.html).toBe(before.html);

    // …AND the screen is scheduled to catch up. "Nothing moved" is the right
    // answer here only because the server re-render is what MAY move it: step 5
    // of C-10's handler is `router.refresh()`, the ONLY mechanism by which the
    // badge, the row and C-11 ever reflect an outcome. Delete it and this whole
    // describe stays green while a user who re-checks a PAID order reads
    // "Paid — your Premium period runs to …" under a badge still saying
    // "Awaiting payment" and a C-11 still saying "Free", for ever. Exactly one
    // call per activation: none is the regression above, two is a double
    // re-render of the whole route.
    expect(refreshMock).toHaveBeenCalledTimes(1);
  });

  it("a settled outcome would be a DIFFERENT screen — the harness can see entitlement change at all", async () => {
    // The positive control for the case above, and the reason its equality is
    // not vacuous: the same harness, fed a premium entitlement, renders values
    // that differ from every one of the four asserted `en` values. So "nothing
    // changed" is a measurement, not a property of a harness that could never
    // show a change.
    const premium: Entitlement = {
      ...FIXTURE_ENTITLEMENT_KNOWN,
      plan: "premium",
      expiresAt: "2026-08-18T17:30:00.000Z", // 19/08/2026 in ICT, 18/08 in UTC
    };
    const { container } = await renderOrdersRoute({ entitlement: premium, locale: "en" });
    const summary = summaryOf(container);
    expect(summary.values[0]).not.toBe(SUMMARY_VALUES.en[0]);
    expect(summary.values[0]).toBe("Premium · until 19/08/2026");
  });
});

// =============================================================================
// (e) focus survives the outcome, and no state carries native `disabled`
// =============================================================================

describe("FE-3 (e) the control keeps focus and is never natively disabled", () => {
  it.each(LOCALES)("locale %s — focus is still on the activated control after the outcome lands", async (locale) => {
    const { container, button } = await activatePendingRow(locale, FIXTURE_RECHECK_OUTCOMES.stillPending);

    // C-10 never unmounts itself after an outcome (UI-D16), so the keyboard
    // user is still where they were. A control that swapped itself for its own
    // alert would send focus to <body> and the sentence would be unreachable by
    // the very user who most needs it.
    expect(activeElementOf(container)).toBe(button);
    assertNeverNativelyDisabled(button, "after the outcome");
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(button.getAttribute("aria-busy")).toBe("false");
  });

  it("idle, BUSY and settled: aria-disabled announces, native `disabled` never appears", async () => {
    const { container } = await renderOrdersRoute({
      entitlement: FIXTURE_ENTITLEMENT_KNOWN,
      locale: "en",
    });
    const button = recheckButtonFor(container, PENDING_CODE);

    // IDLE.
    assertNeverNativelyDisabled(button, "idle");
    expect(button.getAttribute("aria-disabled")).toBe("false");
    expect(alertsIn(container)).toHaveLength(0);

    // BUSY — only observable inside the in-flight window, which is what the
    // hold is for. A synchronous stub has no such window and this state would
    // never be reached.
    stubs.holdNextRecheck();
    button.focus();
    await act(async () => {
      button.click();
    });
    expect(stubs.recheckOrderCallCount).toBe(1);
    expect(button.getAttribute("aria-busy")).toBe("true");
    expect(button.getAttribute("aria-disabled")).toBe("true");
    assertNeverNativelyDisabled(button, "busy");
    expect(activeElementOf(container)).toBe(button);
    // The busy REASON changes text (C-10 idiom 3) and the outcome node is still
    // absent: a screen that announces the result before it has one is announcing
    // a guess. EQUALITY, not a length: the neighbouring dictionary key
    // (`billing.recheck.amountMismatch`) is also non-empty, and rendering IT
    // here tells the screen-reader user the payment failed while the call is
    // still in flight. A length check cannot see the difference; this is the
    // one rendered C-10 string FE-3 would otherwise never compare to a literal.
    expect(reasonFor(container, PENDING_CODE)).toBe(BUSY.en);
    expect(alertsIn(container)).toHaveLength(0);

    // RELEASED.
    await act(async () => {
      stubs.releaseHeldRecheck();
    });
    expect(alertsIn(container)).toHaveLength(1);
    assertNeverNativelyDisabled(button, "after release");
    expect(activeElementOf(container)).toBe(button);
  });

  it.each(LOCALES)(
    "locale %s — a TERMINAL row keeps a focusable control that states its reason and calls nothing",
    async (locale) => {
      const { container } = await renderOrdersRoute({ entitlement: FIXTURE_ENTITLEMENT_KNOWN, locale });

      for (const order of TERMINAL_ORDERS) {
        const button = recheckButtonFor(container, order.orderCode);
        // Mounted, focusable, and NOT natively disabled — the person with an
        // order that looks closed is exactly the person who needs to reach this
        // control and read WHY re-checking will not help (C-10).
        assertNeverNativelyDisabled(button, `terminal ${order.status}`);
        button.focus();
        expect(activeElementOf(container)).toBe(button);
        expect(button.getAttribute("aria-disabled")).toBe("true");
        expect(reasonFor(container, order.orderCode)).toBe(ALREADY_CLOSED[locale]);

        // The handler returns EARLY: no action call, no busy phase, no outcome
        // node. `aria-disabled` only announces — it does not block a DOM click.
        await act(async () => {
          button.click();
        });
        expect(stubs.recheckOrderCallCount).toBe(0);
        expect(alertsIn(container)).toHaveLength(0);
        expect(button.getAttribute("aria-busy")).toBe("false");
      }

      // THE POSITIVE CONTROL, and the reason the block above is not vacuous: a
      // control that refused EVERY row would pass all of it. `refunded` is not
      // terminal (FE-AC-10) — re-checking is the only action that clears an
      // unrecognised status — so its control must be fully active and must
      // actually call.
      for (const order of ACTIVE_ORDERS) {
        const button = recheckButtonFor(container, order.orderCode);
        expect(button.getAttribute("aria-disabled")).toBe("false");
        expect(reasonFor(container, order.orderCode)).toBe("");
      }
      const unrecognised = recheckButtonFor(container, FIXTURE_ORDER_UNRECOGNISED.orderCode);
      await act(async () => {
        unrecognised.click();
      });
      expect(stubs.recheckOrderCallCount).toBe(1);
      expect(stubs.recheckedOrderCodes).toEqual([FIXTURE_ORDER_UNRECOGNISED.orderCode]);
    }
  );
});

// =============================================================================
// (f) AC-037 — two synchronous activations, EXACTLY ONE invocation
// =============================================================================

describe("FE-3 (f) a dogpiled control calls the action exactly once", () => {
  it("two synchronous activations inside one in-flight window record 1 call, not 2", async () => {
    const { container } = await renderOrdersRoute({
      entitlement: FIXTURE_ENTITLEMENT_KNOWN,
      locale: "en",
    });
    const button = recheckButtonFor(container, PENDING_CODE);

    // The hold keeps the first call outstanding, so the second activation lands
    // INSIDE the window the guard exists for. Without it the guard has nothing
    // to suppress and the count would be decided by microtask timing.
    stubs.holdNextRecheck();
    await act(async () => {
      button.click();
      button.click();
    });

    // A COUNT, not "it was called": one activation stays green while the guard
    // regresses. The guard is a ref read before any setState and before any
    // await — a `phase === "busy"` guard reads the PREVIOUS render's value and
    // lets the second click through, which is precisely the 2 this rejects.
    expect(stubs.recheckOrderCallCount).toBe(1);
    // One call against the WRONG order is still a count of one.
    expect(stubs.recheckedOrderCodes).toEqual([PENDING_CODE]);

    await act(async () => {
      stubs.releaseHeldRecheck();
    });
    expect(stubs.recheckOrderCallCount).toBe(1);
    expect(theOnlyAlert(container).textContent).toBe(STILL_PENDING.en);

    // And the guard RELEASES: a lock that never opens would also record 1 here,
    // and would leave the control dead for the rest of the session.
    await act(async () => {
      button.click();
    });
    expect(stubs.recheckOrderCallCount).toBe(2);
  });
});

// =============================================================================
// (g) AC-037 — the rate-limited refusal is its own sentence
// =============================================================================

describe("FE-3 (g) the rate-limited refusal is distinct from every other outcome", () => {
  it.each(LOCALES)("locale %s — EQUALS its approved string, EQUALS no other outcome", async (locale) => {
    const { container, before, after } = await activatePendingRow(
      locale,
      FIXTURE_RECHECK_OUTCOMES.rateLimited
    );

    expect(before.alerts).toBe(0);
    const sentence = theOnlyAlert(container).textContent ?? "";
    expect(sentence).toBe(RATE_LIMITED[locale]);

    // The six other outcome sentences plus the GENERIC error string, resolved
    // at RUNTIME from the real dictionary in the locale under test — the same
    // lookups C-10 makes. Not literals copied into this file: a copy edit moves
    // these values and the inequalities still mean what they say. Conflating
    // the refusal with `billing.orders.loadError` is exactly what AC-037
    // forbids, and it is the shape this regression actually takes.
    const t = createTranslate(getDictionary(locale));
    for (const key of OTHER_OUTCOME_KEYS) {
      const other = t(key);
      expect(other).not.toBe(key); // a missing key echoes its own name back
      expect(other.length).toBeGreaterThan(0);
      expect(sentence).not.toBe(other);
    }
    // Mutually distinct as a SET, in this locale — the property Task 3.7
    // claimed and this case measures rather than assumes.
    const all = OTHER_OUTCOME_KEYS.map((key) => t(key)).concat(sentence);
    expect(new Set(all).size).toBe(all.length);

    // A refusal is not a settlement either: nothing about entitlement moved.
    expect(after.summary.values).toEqual(before.summary.values);
    expect(after.html).toBe(before.html);
  });
});
