// @vitest-environment jsdom

// Subscription (payOS prepaid period) — FIXTURE-E2E lane
// Design Docs: docs/design/subscription-frontend-design.md (v1.2, Test Boundaries :1018)
//              docs/design/subscription-backend-design.md (v1.4, Test Boundaries :1121)
// UI Spec:     docs/ui-spec/subscription-ui-spec.md (v1.4) — UI-D17 AS AMENDED;
//              see the AMENDMENT block below.
// PRD:         docs/prd/subscription-prd.md (v1.6)
// Generated:   2026-08-18 | Budget used: integration 3/3, fixture-e2e 3/3, service-e2e 2/2
// FE-2 filled: 2026-08-19 (plan Task 2.5) — fixture-e2e 1/3 resolved.
//
// =============================================================================
// FILE STATUS — read before editing
// =============================================================================
// FE-2 IS FILLED AND EXECUTABLE. FE-1 and FE-3 are still comment-only reserved
// slots (plan Tasks 4.6 and 3.9). The `@vitest-environment jsdom` directive on
// LINE 1 exists for FE-2 and is a per-file declaration, per the repo convention.
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
// timezone pin. `SubscriptionDriver` and the action-stub layer stay unimported
// until FE-1 and FE-3 exist — an unused import is fatal under
// `eslint --max-warnings 0`.
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

import { createElement, type ReactNode } from "react";
import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The two hoisted string constants below are duplicated INSIDE `vi.hoisted`
// rather than imported, because a `vi.mock` factory runs before this module's
// import bindings are initialised and would hit a TDZ error. Both are pinned
// back to their shipped sources by the "fixture preconditions" block, so a
// rename fails there instead of silently rendering the default locale (or the
// wrong route) underneath every assertion in this file.
const { cookieName, routePath, state, getCurrentUserProfileMock, readEntitlementMock, getResultMock, explainStepMock } =
  vi.hoisted(() => ({
    cookieName: "ms_locale",
    routePath: "/exams/exam-subscription-fixture/attempt/attempt-subscription-fixture/result/detail",
    state: { locale: "en" as "en" | "vi" },
    getCurrentUserProfileMock: vi.fn(),
    readEntitlementMock: vi.fn(),
    getResultMock: vi.fn(),
    explainStepMock: vi.fn(),
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
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn(), back: vi.fn() }),
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
vi.mock("@/lib/auth/getCurrentUser", () => ({ getCurrentUserProfile: getCurrentUserProfileMock }));
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
