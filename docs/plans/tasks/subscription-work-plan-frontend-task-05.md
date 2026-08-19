# Task: Implement and run fixture-e2e FE-2 (quota-exhausted journey)

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.5**
Layer: **frontend** (`SOURCE/tests/e2e/fixture/**` rendering the real route tree)

Metadata:
- Dependencies: frontend-task-01 (the harness), frontend-task-02 (provider mounts), frontend-task-04 (the mount)
- Provides: the discharge of AC-042 that no unit test can give; also the **positive half of AC-041** that plan Task 5.3 must not move
- Size: Small (1 test file)

## Implementation Content

Fill `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` case **FE-2** against the harness from plan Task 0.7.

**Render the real route tree and let the provider come from where production puts it — do not wrap the unit in a provider.**

Assert:
- (a) a `<p>` carrying **both** the remaining count and the reset date beside **both** call sites;
- (b) the rendered date **equals** the pinned-timezone formatting of the fixture `resetsAt` — **one day off is a failure, not a rounding difference**;
- (c) **no prop is passed at the mount site** — output unchanged when invoked with no props;
- (d) `unknown` ⇒ the note renders **nothing** and the page still renders, with **no `0` and no `—`** in place of the counters;
- (e) the exhausted-state string is **NOT EQUAL** to the resolved `t("tutor.error")` value in the **same locale** — an inequality against the **actual dictionary value**, not a substring heuristic, so it survives a copy change;
- (f) the upgrade link navigates to `/pricing`;
- (g) every interactive element is **Tab-reachable**, **none carrying native `disabled`**, each with a **visible focus ring**.

**Test-case resolution for this phase: 1 fixture-e2e case of 3 (FE-2).**

## Target Files
- [x] `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-2 filled and executed**)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts` (**FE-2** `Proof obligation:` / `Primary failure mode:` annotation block)
- `SOURCE/tests/e2e/fixture/subscriptionFixtureData.ts` (plan Task 0.7 — entitlement fixtures `known` / `unknown` / exhausted)
- `SOURCE/components/billing/TutorQuotaNote.tsx` (plan Task 2.4 — the implemented component)
- `SOURCE/app/(layer2)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx` (`:177`, `:230` — the two mounts)
- `SOURCE/app/(layer2)/layout.tsx` (plan Task 2.2 — the provider mount the real route tree supplies)
- `SOURCE/components/tutor/ExplainStepAffordance.tsx` (**read only** — its blocked-quota branch becomes reachable here)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (`tutor.error` — the resolved value item (e) compares against)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `TutorQuotaNote` — C-06 — verify default (`known`) + empty (`unknown` ⇒ `null`) states)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `ExplainStepAffordance` (modified) — C-05 — verify default (idle) + loading (busy) + error + partial (hint-shown) + blocked-quota states)
- `docs/design/subscription-frontend-design.md` (§ Verification Strategy row 7 / FE-I8)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record FE-2 annotation block verbatim
- [x] Write items (a)…(g) and confirm each fails against a deliberately removed provider mount
### 2. Green Phase
- [x] Run the case against the real route tree; all seven items green
### 3. Refactor Phase
- [x] Re-run to confirm determinism (fixed fixture `resetsAt`, fixed locale)

## Quality Assurance Mechanisms
- Manual browser pass at 360px + greyscale (`npm run pw` + a real mid-range Android) — **the load-bearing accessibility and layout check** — Config: `SOURCE/package.json:14`, `SOURCE/scripts/pw/cli.mjs` (executed in plan Task 6.5; FE-2 covers the automatable subset)
- `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: fixture-e2e browser journey against the **real route tree**, with only the action modules stubbed.
- **Success criteria**: all seven items (a)…(g) green.
- **Failure response**: if the rendered date is one day off, **stop** — the `timeZone` pin is missing or a legacy formatter was used. If the note renders `null` for a `known` quota, **stop** — the provider mount is wrong, and every downstream test would pass while the screen lied.
- **Verification level**: L1 (a real user journey through the real route tree).

## Proof Obligations
- **Claim (AC-042)**: the UI-D17 mount **actually renders**.
- **Primary failure mode**: a provider-wrapped unit test supplies the very thing production would be missing, so a permanently-`null` mount ships green.
- **Boundary to exercise**: the **real route tree** — layouts, provider and page as production composes them.
- **State assertion**: `known` fixture ⇒ a `<p>` beside **both** call sites with the count and the date; `unknown` fixture ⇒ nothing rendered, and the page still renders with **no `0` and no `—`**.
- **Mock boundary rationale**: only the action modules are stubbed; the provider and route tree stay real — that is the point of this lane.
- **Residual**: FE-AC-26 also requires the manual pass (plan Task 6.5, item iv) against a real signed-in user.

- **Claim (AC-041, positive half)**: the exhausted state is distinguishable from a generic failure **before** the press.
- **Primary failure mode**: a substring heuristic passes while the two strings are in fact the same copy; or the distinction is moved to a post-failure error code, reopening the disclosure surface UI-D3 closed.
- **Boundary to exercise**: rendered text compared against the **resolved dictionary value** in the same locale.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — real dictionary values are resolved.
- **Residual**: the error-path half of AC-041 is backend-owned (plan Task 5.3) and lives only in telemetry.

## Completion Criteria
- [x] FE-2 passes against the **real route tree**, all items (a)…(g)
- [x] Item (e) is an inequality against the resolved `t("tutor.error")` value, not a substring heuristic
- [x] Item (c) asserts the mount passes **no** prop
- [x] Test-case resolution: **fixture-e2e 1/3 (FE-2)**
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: test only.
- Scope boundary: do not wrap the unit in a provider; do not introduce MSW.

## Investigation Notes

Recorded 2026-08-19 while executing plan Task 2.5. Every Investigation Target was read in full before any assertion was written.

### FE-2 annotation block — recorded verbatim (the Red Phase requires it)

From `SOURCE/tests/e2e/fixture/subscription.fixture.e2e.test.ts`, FE-2 slot:

> Primary failure mode: `TutorQuotaNote` renders nothing at all, permanently,
>   for every user — because the route group above the mount site has no
>   `EntitlementProvider`, so `useEntitlement()` returns `FREE_FALLBACK` whose
>   quotas are `unknown` and the component returns `null` at
>   `TutorQuotaNote.tsx:30`. Every static gate stays green through this: lint,
>   build and the component's own unit test all pass. Second failure mode: the
>   out-of-quota state is rendered with the generic `t("tutor.error")` string,
>   so a user who simply ran out of allowance is told the product is broken.
>
> Proof obligation:
>   - Do NOT wrap the unit in a provider. Render the REAL route tree and let the
>     provider come from where production puts it. A test that supplies the
>     provider itself cannot fail for the primary failure mode above.
>   - Boundary path to traverse: the mount site renders the note beside BOTH
>     `ExplainStepAffordance` call sites on the result-detail page (frontend DD
>     names `:177` and `:230`). One call site rendering is not proof; the
>     affordance only mounts when `hasBeenWrongTwice === true`, decided
>     separately at each call site.
>   - CORRECTED CONTRACT, per the correction block at the top of this file: the
>     mount passes NO prop. Assert the reset date is derived from the fixture's
>     `tutor.resetsAt` through context. Do NOT assert a `formattedResetDate`
>     prop, and do not add one to satisfy the shipped UI Spec text.
>   - For AC-041, assert the rendered exhausted-state string is NOT EQUAL to the
>     resolved value of `t("tutor.error")` in the SAME locale — an inequality
>     against the actual dictionary value, not a substring heuristic, so the
>     assertion survives a copy change.

### What each Investigation Target established

- **`subscriptionFixtureData.ts`** — `FIXTURE_RESETS_AT = 2026-09-15T19:30:00.000Z` sits on **16/09 in ICT and 15/09 in UTC**, and `FIXTURE_BROWSER_TIMEZONE = "UTC"` exists precisely because an unpinned formatter renders the right day for the wrong reason on an ICT machine. **This machine reports `Asia/Saigon`** (verified: `Intl.DateTimeFormat().resolvedOptions().timeZone`), so the hazard is live, not theoretical. FE-2 therefore pins `process.env.TZ = FIXTURE_BROWSER_TIMEZONE` itself and asserts both that the pin took and that the pinned zone is **not** `Asia/Ho_Chi_Minh`.
- **`TutorQuotaNote.tsx`** — takes no parameter (arity 0), returns `null` when `tutor.state !== "known"` (`:43`), and formats `formatDate(tutor.resetsAt, locale)` itself (`:51`). Values come from `useEntitlement()` + `useLocale()` — context only.
- **`result/detail/page.tsx`** — two branches (short-answer `:165-181`, mcq `:182-236`); each ends with `{r.hasBeenWrongTwice === true && <ExplainStepAffordance …/>}` followed by `<TutorQuotaNote />` **outside** the gate. Both mounts are attribute-free.
- **`(layer2)/layout.tsx`** — `readEntitlement(user?.id ?? null)` once at `:35`, `<EntitlementProvider value={entitlement}>` at `:41` wrapping `#main-content` which holds `children`. This is the only thing that puts the provider above the page.
- **`ExplainStepAffordance.tsx`** — exhausted branch at `:111-129`: a dashed-border block with `t("billing.quota.tutorExhausted")` in a `<p>` and a `<Link href="/pricing">` carrying `t("billing.quota.upgradeLink")`; **no** `role="alert"` (mount-time state), **no** native `disabled` anywhere, and the generic `t("tutor.error")` lives on a different branch (`:157`).
- **Dictionaries** — `tutor.error` resolves to `"Couldn't load a hint. Try again."` (en) and `"Chưa lấy được gợi ý. Bạn thử lại nhé."` (vi); `billing.quota.tutorExhausted` to `"You've used all your tutor hints for this period."` / `"Bạn đã dùng hết lượt gia sư của kỳ này."`.
- **UI Spec v1.4 § UI-D17** — states the amended behaviour directly ("**The mount passes no prop.**") and records the retirement of `formattedResetDate` by plan Task 2.4. **The "pending amendment" banner in the FE-2 file was stale and is rewritten** (see below).
- **Frontend DD § FE-I8 / FE-AC-26** — both say a provider-wrapped unit test "passes while production renders nothing", and both nominate the *manual* pass as the real check. FE-2 now supplies an automated check of the same claim; the manual pass (plan Task 6.5 item iv) remains as the residual for the painted/laid-out half.

### Form of the case, and why it deviates from the shipped driver-script convention

The six shipped fixture-e2e siblings are Playwright-subset **driver scripts that nothing executes** — this repo has no `@playwright/test` and no committed `playwright.config.ts`. That form cannot discharge AC-042, whose entire claim is "the mount actually renders". FE-2 therefore keeps the convention's substance (real route tree, only the action module + the two data sources stubbed, real dictionaries, no MSW) and drops its form: it composes `RootLayout → (layer2)/layout → result/detail/page` exactly as production composes them and renders that in jsdom. `RootLayout` is included because item (e) is a per-locale claim and the locale must arrive the production way (cookie → `getLocale()` → `I18nProvider`).

**Stub boundary**: `explainStep` (the sanctioned action module), plus the data sources `getCurrentUserProfile`, `readEntitlement`, `getResult`. Runtime-only substitutions (`server-only`, `next/headers`, `next/font/google`, `@vercel/analytics/next`, `next/navigation`, the async `SkipLink`) follow `app/(layer2)/__tests__/layout.test.tsx`. **`EntitlementProvider` is not supplied by the test at any point.**

### The fixture-e2e lane had NO RUNNER — found here, fixed here under orchestrator authorisation

**The single most important thing in this file for the next session.** Before plan Task 2.5, **not one of the three committed vitest configs collected `tests/e2e/fixture/**`** — `vitest.config.ts` takes lib/components/app, `vitest.integration.config.ts` takes tests/integration, `vitest.localdb.config.ts` takes tests/e2e/service — and there was no `test:fixture` script. **FE-2, and every one of the six sibling fixture-e2e scripts, had never executed in a committed lane.** The gap was mechanical: the plan names three lanes and acceptance-test-generator emitted three skeletons, but plan Task 0.7 wired only two.

Why it mattered enough to fix rather than only report: a case that discharges AC-042 and is never run discharges nothing. It is the same "an artifact claiming a discriminating power it does not have" failure this feature keeps producing — one level up, at the **lane** rather than at the assertion.

It was **outside this task's Target Files**, so it was reported first and only then implemented, **on explicit orchestrator authorisation** given mid-task. Delivered:

- **`SOURCE/vitest.fixture.config.ts`** — follows the two existing lane configs exactly (`defineConfig` from `vitest/config`, alias derived via `fileURLToPath(new URL("./", import.meta.url))`, `environment: "node"`, Vietnamese rationale comment in the same register).
- **`SOURCE/package.json`** — `"test:fixture": "vitest run --config vitest.fixture.config.ts"`, in the same idiom as its two siblings.

**Why the lane is separate from `npm test`, and it is NOT the reason the other two are.** `test:integration` / `test:localdb` are held out of CI because they need a real Supabase dev database ("CI has no database"). This lane needs **no database, no credentials, no network** — only the action module and two data sources are stubbed — so it **could safely join the CI gate**. It is separate for a mechanical reason, measured not assumed: the six other `*.fixture.e2e.test.ts` files in that directory are Playwright-subset **driver scripts with no `test()` blocks**, so a directory-wide collection reports "No test suite found in file" for each and **exits 1**. The config therefore uses the directory glob (a new fixture-e2e case is picked up automatically) plus an `exclude` naming those six; **when that exclude list empties, the lane folds into `npm test`**, and removing one line is all it takes. No `--passWithNoTests` anywhere.

Shortcut that does not work, recorded so it is not retried: a positional filter (`npx vitest run tests/e2e/fixture/...`) collects nothing — it only narrows the configured `include` — and vitest 4 rejects `--include` outright (`CACError: Unknown option --include`). The config is the only way in.

**Command and exit code:** `cd SOURCE && npm run test:fixture` → **23 passed / 23, exit 0.** The ad-hoc scratchpad config used during development has been **deleted**, so nothing can later be mistaken for the real runner.

### Red evidence — provider mount deliberately removed from `(layer2)/layout.tsx`

Two rounds, restored byte-clean between (verified by `git status --porcelain`).

Round 1 (12 of 23 red) exposed **two items that were measuring the harness**, both now fixed:

- **(d) "no note, no 0, no —" stayed GREEN.** With no provider every quota is `unknown`, so the absence assertions were trivially true against exactly the tree AC-042 exists to catch. Fixed with a positive control in the same case: the same harness fed a `known` quota must produce the note.
- **(g) all three rows stayed GREEN.** Naming a state is not reaching it — with no provider the `known` and `exhausted` rows scanned the same idle button the `unknown` row scans. Fixed with `assertStateMaterialised()`, which throws unless the named state actually reached the DOM.

Round 2, after strengthening: **16 of 23 red.** The only non-precondition cases still green are the two that are provider-independent **by design**, and both are documented as such in the file:

| Item | Cases red with the provider removed | Wrong implementation the item rejects |
|---|---|---|
| (a) | 2/2 | a mount that renders no note; a note beside only one call site; a note that kept the counters and lost the date |
| (b) | 2/2 | a formatter without `timeZone: "Asia/Ho_Chi_Minh"` (renders 15/09 instead of 16/09) |
| (c) | 1/2 — the arity case is a static signature claim and cannot depend on a provider | a re-declared `formattedResetDate` prop; a mount that feeds the component anything |
| (d) | 4/4 | a fail-OPEN quota rendered fail-CLOSED; `0` or `—` standing in for a counter; a page that lost content along with the note |
| (e) | 3/3 | the exhausted state rendered with the generic error string; the exhausted branch never reached |
| (f) | 2/2 | an upgrade target that is not exactly `/pricing` |
| (g) | 2/3 — the `unknown` row *is* the no-provider state and correctly cannot discriminate | a native `disabled`; a negative `tabindex`; a suppressed focus indicator |

### Mutation → caught/survived

| # | Mutation | Result |
|---|---|---|
| M0 | `EntitlementProvider` removed from `(layer2)/layout.tsx` | **caught** — 16/23 red |
| M1 | one of the two `<TutorQuotaNote />` mounts deleted from the page | **caught** — (a)(b)(c)(d)(e-counters)(g) |
| M2 | `timeZone: TIME_ZONE` dropped from `DATE_OPTIONS` in `lib/format/datetime.ts` | **caught** — (a)(b)(c)(d)(e-counters)(g) |
| M3 | fixture `resetsAt` shifted one day earlier | **caught** — precondition + (a)(b)(c)(d)(e-counters)(g) |
| M4 | `tutor.error` (en) set equal to the exhausted copy | **caught, isolated to (e)-en only** — 1/23 red, at `expect(rendered).not.toBe(genericError)` |
| M5 | upgrade link `href` → `/pricing/checkout` | **caught** — (f) both locales + (g)-exhausted |
| M6 | native `disabled` added to the tutor `Button` | **caught** — (g) known + unknown |
| M7 | `formattedResetDate` prop re-added and consumed | **caught** — (c) both cases, plus (a)(b)(d)(e-counters)(g) |
| M8 | `outline-none` added to the upgrade link with no `focus-visible:` replacement | **caught, isolated to (g)-exhausted only** |

Zero survivors.

### Stale banner rewritten (the one edit this task grants outside the FE-2 slot)

The block headed "CORRECTION APPLIED — UI Spec UI-D17 and the C-06 delta are known-wrong", ending "The spec text is pending amendment", has been false since plan Task 0.3. It now reads **"AMENDMENT LANDED"** and names UI Spec v1.4 § UI-D17, the C-06 delta and frontend DD X-13, plus commit `d5ba7d7` as the implementation. **The operative prohibition survived verbatim**: "any assertion on a `formattedResetDate` prop is wrong and must not be added", with the silent-failure reasoning kept and a pointer to FE-2(c) as its runtime half. The identifier therefore still appears in the file as a prohibition, not as a contract.

### Transcription drift observed (reported, not fixed — the fixture module is outside Target Files)

- FE-2 depends on no hand-copied backend constant. `subscriptionFixtureData.ts:203`'s `39_000` is an order value; FE-2 touches no order. `TutorQuotaNote` prints whatever the entitlement carries and never consults `PLAN_LIMITS`, so `FIXTURE_TUTOR_LIMIT` is arbitrary from FE-2's point of view — coupling FE-2 to `PLAN_LIMITS.premium.tutor` would have created a test that fails for a reason unrelated to its own claims. FE-2 instead pins its hardcoded literals to the **fixture's own** numbers and date, so a fixture edit fails loudly (proved by M3).
- **Finding for whoever owns the fixture module**: `FIXTURE_ENTITLEMENT_KNOWN` / `_EXHAUSTED` spread `FREE_FALLBACK` (so `plan: "free"`) while carrying `FIXTURE_TUTOR_LIMIT = 500`, which is `PLAN_LIMITS.premium.tutor`; the free tutor limit is `5`. Harmless to FE-2, but the fixtures describe a user shape the backend cannot produce.

### Gates

- FE-2 via the **committed** runner `npm run test:fixture`: **23 passed / 23**, exit 0, run repeatedly (3.50 s / 4.82 s) — deterministic.
- `npm test`: **1078 passed / 10 skipped across 97 files**, exit 0 — the stated baseline, unchanged, re-verified after the new config landed.
- `npx tsc --noEmit`: 0 errors. `npm run lint`: clean at `--max-warnings 0`.
- `npm run test:integration` / `npm run test:localdb`: still exit 1 with "No test suite found in file" — **unchanged**, re-verified after the new config landed. That red is deliberate (their skeletons are comment-only) and no `--passWithNoTests` was added anywhere.
- `npm run build` deliberately not run (it hangs under the default sandbox); left to quality-fixer-frontend.
- **No production deploy of this branch has occurred.**

### Residual

FE-AC-26 still requires the manual browser pass at 360px + greyscale against a real signed-in user (plan Task 6.5 item iv). jsdom paints nothing and lays nothing out, so the *painted* focus ring, the 360px layout and real client-side navigation remain manual; FE-2 asserts their structural preconditions only, and says so at each assertion.
