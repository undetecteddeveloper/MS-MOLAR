# Task P7-T1 — Home block: guarded hot fetch (F-001)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 7 (Home Block Guarded Hot Fetch), Task P7-T1**
Layer: frontend (`SOURCE/app/page.tsx`)

Metadata:
- Dependencies: P3-T2 (`listHotExams`, already exists from Phase 3)
- Blocks: P8-T1, P8-T4 (Phase 8's verification runs against a fully-wired feature including this)
- Size: Small (1 file)
- Verification level: L1 — home block shows the hot order for signed-in visitors; 0 RPC calls for anonymous visitors

## Implementation Content
Edit `SOURCE/app/page.tsx:52-53,116-138` — `const hot = user ? await listHotExams(HOME_EXAM_COUNT) : null;` (guarded, not a bare swap); label `t("home.newExams")` → `t("home.hotExams")` (Phase 1's new key); empty guard widens to `hot !== null && hot.exams.length > 0`. Frame, `layout="stack"`, `HOME_EXAM_COUNT=3`, `Xem tất cả đề` link, `home-new-exams` id all unchanged.

## Target Files
- [x] `SOURCE/app/page.tsx`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (Integration Point I5 — Home guarded fetch (F-001), the guard rationale)
- `docs/design/exam-shelves-frontend-design.md` (§ Home block (AC-036–AC-038) — Data source / label / ribbon / empty-guard table)
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Component: HomeHotExamsSection — Default; Empty (site 0 attempts, or anon); Loading/Error N/A)
- `SOURCE/app/page.tsx` (`:52-53` current data-fetch call; `:116-138` current render block — read the full current implementation of this section before editing)
- `SOURCE/features/exams/queries/shelves.ts` (P3-T2 — `listHotExams`, called here)
- `SOURCE/lib/copy.ts` (P1-T2 — `home.hotExams`, the new label key)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability marks the frontend DD's "Home block table — Data source / label / ribbon / empty-guard rows" as `contract-change`. Sweep the adjacent case: this call site's data source is swapping from one query to another (`listNewExams`-shaped → `listHotExams`) — confirm no other part of `app/page.tsx` (or another page) still imports/relies on the old data source for the same visual section.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-038) | state-lifecycle-negative | "Given a site with 0 submitted attempts, when / renders for a signed-in visitor, then the block is absent (AC-024) and the page renders with 0 errors" | Does the home page's hot-exams section render nothing (not an empty frame) when `hot !== null` but `hot.exams.length === 0`, with 0 thrown errors? |
| docs/design/exam-shelves-backend-design.md (§ Integration Point I5); docs/design/exam-shelves-frontend-design.md (§ Home block) | state-lifecycle-negative | "An anonymous visitor therefore issues 0 RPC calls" — the guarded home fetch never executes `listHotExams` when `user === null` | Does the call site read `user ? await listHotExams(...) : null` (ternary guard), never an unconditional call followed by discarding the result? |

## UI Spec Component Reference
`docs/ui-spec/exam-shelves-ui-spec.md (§ Component: HomeHotExamsSection — verify Default; Empty (site 0 attempts, or anon); Loading/Error N/A states)`

## Investigation Notes

**Investigation Targets read**: `exam-shelves-backend-design.md` § Integration Point I5 (guard rationale: `exam_hot_counts` revokes `anon`, unguarded call ⇒ 42501 ⇒ error page replaces the signed-out hero); `exam-shelves-frontend-design.md` § Home block table (Data source / Label / Hot list empty rows — the exact target shape: `const hot = user ? await listHotExams(HOME_EXAM_COUNT) : null;`, `t("home.hotExams")`, `hot !== null && hot.exams.length > 0`); backend DD § Logging (`readBounded` labels `listHotExams.attempts`/`listHotExams.hotCounts`, already present in `shelves.ts`, no change needed here); `docs/ui-spec/exam-shelves-ui-spec.md` § Component HomeHotExamsSection (Default/Empty/Loading-N/A states); `app/page.tsx:52-53,116-138` (old composition: `listExamsRanked({}, 1)` sliced to 3, `exams.length > 0` guard, `t("home.newExams")` label); `features/exams/queries/shelves.ts` (`listHotExams(limit)` signature — 3 boundary calls, no `exam_results` read, returns `{exams, rung, grade, submittedExamIds}`, guard is the CALL SITE's job per its own JSDoc at `:194-196`); `lib/copy.ts:81-82` (`home.hotExams` = "Đề nổi nhất" already added by P1-T2, sits immediately after `home.newExams` = "Đề mới đăng" — both keys coexist; `home.newExams` becomes unused by this call site but stays in `copy.ts` since that file is outside this task's Target Files).

**Guard confirmed as a ternary at the call site** (`app/page.tsx:56`): `const hot = user ? await listHotExams(HOME_EXAM_COUNT) : null;` — a direct conditional expression, not a try/catch, not a post-hoc discard. Verified this is load-bearing, not cosmetic: temporarily rewrote it to the post-hoc-discard failure mode named in Proof Obligations (`const hotUnguarded = await listHotExams(HOME_EXAM_COUNT); const hot = user ? hotUnguarded : null;`) and re-ran `app/__tests__/page.test.tsx` — the anonymous-visitor case failed exactly as expected (`fromMock`/`rpcMock` called 2 times instead of 0), then reverted to the real guarded line and re-ran green. This is the regression the automated test is proven to catch, not merely something it happens to pass today.

**Automated test — closes the P3-T2 residual**: `SOURCE/app/__tests__/page.test.tsx` (new) imports the REAL default export `Home` from `@/app/page` and invokes it directly (`await Home({ searchParams })`), with `getCurrentUserProfile` mocked (user-lookup) and `@/lib/supabase/server`'s `createClient` mocked as `{ from, rpc }` (Supabase client boundary — same technique as `shelves.int.test.ts`). `listHotExams` itself runs UNMOCKED. Three cases: (1) anonymous → `getCurrentUserProfileMock` resolves `null` → asserts `fromMock`/`rpcMock` never called and no `aria-labelledby="home-new-exams"` element in the returned (un-rendered) element tree — Reference Contract row 2 (F-001); (2) signed-in, 0 submitted attempts sitewide (empty `exam_attempts`/hot-rpc fixtures) → asserts the fetch DOES run (`fromMock`/`rpcMock` called) but the section is still absent — Reference Contract row 1 (AC-038); (3) signed-in with 5 qualifying candidates → asserts the label text is "Đề nổi nhất" (never "Đề mới đăng"), the `ExamBrowser` element receives exactly 3 exams (proving `HOME_EXAM_COUNT=3` still flows into the real `listHotExams(limit)` call), `layout="stack"`, `isLoggedIn`, and `submittedExamIds` sourced from the same attempt read. Why a plain function call instead of `renderServerTree`: `Home`'s own function body (containing the guarded expression) completes before any child component is invoked — JSX children are un-executed `{type, props}` descriptors until a renderer walks them — so inspecting the returned element tree as data exercises the real call site without needing to mock every child component's own environment (`SiteHeader`, `HeaderSearch`, `SupportWidget`, etc.), none of which this task's Reference Contracts concern.

**Manual smoke test**:
- **Signed-out `/`** — completed via the shared `scripts/pw/cli.mjs` browser (a real browser, not just an HTTP check): navigated to `http://localhost:3000/` against the local dev server, extracted `main` text — renders the guest hero + "Nền tảng công nghệ" (TechStack: Next.js/Supabase/Gemini/Groq/Claude Code cards), 0 occurrences of "Đề nổi nhất" or "Đề mới đăng" anywhere in the page text, HTTP 200, no error-page copy. Confirms the guarded fetch never fires an unguarded RPC that would 42501 and replace the hero with an error page.
- **Signed-in `/` (with and without site-wide submitted attempts)** — **NOT completed by this agent**: this session's toolset has no browser/Playwright MCP tool and no stored test-account credentials, and per this repo's own recorded workflow note ("Auto mode blocks test sign-in" — the classifier denies every form of Playwright sign-in as the test account), attempting a sign-in flow here would be blocked. The pw-cli's shared browser session was confirmed fresh (`about:blank` before this task's own `goto`), i.e. no pre-authenticated session to reuse. The automated test's cases 2 and 3 above exercise the equivalent signed-in composition (real `listHotExams` against a mocked Supabase boundary) and are a strictly more precise proof of the specific claims (call counts, exact exam count, label text) than a browser click-through would be — but they do not substitute for an actual browser render. **Residual for the engineer / Phase 8 verification**: sign in as the test account on `/` and confirm visually — with submitted attempts present, "Đề nổi nhất" + up to 3 stacked cards; with 0 sitewide submitted attempts, the whole right column collapses cleanly (no empty frame, no layout jump).

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write/extend a test (integration or fixture-lane, coordinated with existing home-page test coverage if any) confirming: anonymous (`user === null`) render issues 0 `.from`/`.rpc` calls of any kind; signed-in render with 0 submitted attempts site-wide renders the whole section absent (not an empty frame). Must exercise the REAL `app/page.tsx` `Home` composition (mocked user-lookup + mocked Supabase client) — a hardcoded literal `user`/`currentUser` variable evaluated against a re-declared guard expression does not satisfy this (see the binding Completion Criterion below) — `SOURCE/app/__tests__/page.test.tsx`, confirmed RED against the post-hoc-discard failure mode before confirming GREEN against the real guard (see Investigation Notes)
### 2. Green Phase
- [x] Replace the data-fetch call with the guarded ternary `user ? await listHotExams(HOME_EXAM_COUNT) : null`
- [x] Swap the label to `t("home.hotExams")`
- [x] Widen the empty guard to `hot !== null && hot.exams.length > 0`
### 3. Refactor Phase
- [x] Confirm `layout="stack"`, `HOME_EXAM_COUNT=3`, the `Xem tất cả đề` link, and the `home-new-exams` id are all unchanged
- [x] Manual smoke test: `/` signed-in (with and without site-wide submitted attempts) and `/` signed-out — signed-out done (real browser via `scripts/pw/cli.mjs`); signed-in NOT done this session (no browser tool + no test credentials + sign-in flows are blocked for this agent per this repo's own recorded workflow note) — see Investigation Notes residual

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `app/page.tsx`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: automated test (call-count assertion for the anonymous case) + manual smoke test on `/` signed-in and signed-out.
- **Success criteria**: anonymous visitor's render issues 0 `.from`/`.rpc` calls of any kind; signed-in visitor sees "Đề nổi nhất" + up to 3 hot exams when data exists, and the whole section absent when the site has 0 submitted attempts.
- **Failure response**: if an anonymous visitor's render issues any call, this is exactly the F-001 violation the guard exists to prevent — fix by moving the `listHotExams` call inside the ternary's truthy branch, not by adding a post-hoc early return after the call already fired.
- **Verification level**: L1.

## Proof Obligations
- **Claim** (F-001, "0 RPC calls"): an anonymous visitor's render issues 0 `.from`/`.rpc` calls of any kind.
  - **Primary failure mode**: the guard is implemented as a post-hoc conditional render (call `listHotExams` unconditionally, then check `user` before rendering the result) instead of a call-site guard — this still issues the RPC call for every anonymous visitor, silently defeating the security intent (the RPC is granted to `authenticated`/`service_role` only, so an anon call would 42501, but issuing it anyway is wasted work and a probe of the boundary from an unauthenticated context).
  - **Boundary to exercise**: this task's own local test (a call-count assertion against a mocked data layer, or the same proof pattern P3-T2 already established at the query layer) + manual smoke test.
  - **State assertion**: before → `user === null`; after → 0 total calls issued.
  - **Mock boundary rationale**: the query layer itself was already proven zero-call-when-null at P3-T2 (the "shared-state dependency"/guarded-composition proof); this task's residual proof is specifically that the **call site** in `app/page.tsx` actually uses the guard, not a discarded-result pattern.
  - **Residual**: none — this closes the loop P3-T2 opened at the query layer.
- **Claim** (AC-038): a site with 0 submitted attempts renders the whole section absent for a signed-in visitor, with 0 errors.
  - **Primary failure mode**: the empty guard checks only `hot.exams.length > 0` without first checking `hot !== null`, throwing on `null.exams` for the anonymous case, or rendering an empty frame instead of omitting the section entirely.
  - **Boundary to exercise**: this task's own local test + manual smoke test.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: mocked data layer for the automated case; real dev for the manual smoke test.
  - **Residual**: none.

## Completion Criteria
- [x] **Binding — closes a P3-T2 residual (integration-test-reviewer finding, 2026-09-18)**: a real, executable test asserts 0 Supabase calls of any kind when `getCurrentUser`/`getCurrentUserProfile` resolves `null`, exercised through the ACTUAL `app/page.tsx` `Home` composition (real import, mocked user-lookup + mocked Supabase client) — not a local/hardcoded literal `user`/`currentUser` variable evaluated in isolation. `P3-T2`'s `shelves.int.test.ts` only proved the ternary guard pattern (`user ? await listHotExams(...) : null`) is syntactically correct against a hardcoded literal `null`; because that variable can never take the other branch, that test cannot fail regardless of what this task's real call site does, and therefore does not close this obligation on its own. This criterion is not satisfied by "wiring the guard in" alone — the test must import and invoke the real `Home` composition (or the smallest real slice that includes the actual `user ? await listHotExams(...) : null` expression), not re-declare the guard inline. — `SOURCE/app/__tests__/page.test.tsx`, case 1
- [x] Guarded ternary call site confirmed (not a post-hoc discard) — `app/page.tsx:56`; verified this specific failure mode is caught (see Investigation Notes)
- [x] Label swapped to `home.hotExams`
- [x] Empty guard widened correctly; whole section absent (not empty frame) when appropriate
- [x] Manual smoke test on `/` signed-in and signed-out recorded in Investigation Notes — signed-out recorded (real browser); signed-in recorded as a residual, not performed this session (see Investigation Notes)
- [x] Every Reference Contract's Compliance Check evaluates to `Y` (see Investigation Notes / Reference Contracts table)
- [x] Gates 1-4 green for this diff (`tsc --noEmit` clean; `eslint app/page.tsx app/__tests__/page.test.tsx --max-warnings 0` clean; `npm run build` succeeds; `npm run check:bundle` passes). Full-suite `npx vitest run`: this task's own test file (`app/__tests__/page.test.tsx`) passes 3/3, and every other test file passes — one PRE-EXISTING, unrelated failure observed in `lib/security/rateLimit.test.ts` (Gemini daily-quota budget assertion, last touched by unrelated `feat(security)`/`feat(subscription)` commits, nothing to do with `app/page.tsx` or exam shelves) — flagged for the quality-assurance process, not caused by this task's diff.

## Notes
- Impact scope: `app/page.tsx`'s hot-exams section only.
- Scope boundary — preserve unchanged: `layout="stack"`, `HOME_EXAM_COUNT=3`, the `Xem tất cả đề` link, the `home-new-exams` DOM id, and every other section of the home page.

## Signed-in home smoke test — DONE 2026-09-19 (closes the residual above)
Real signed-in browser render of `/` on dev: region "Đề nổi nhất" with exactly 3 real exams — `exam-ly-10`, `exam-hoa-10`, `ugc-e3048c6e-…` ("KIỂM TRA CUỐI HỌC KÌ 2") — identical order to the top 3 of the `/exams` hot shelf; the old "Đề mới đăng" heading is absent; "Xem tất cả đề" links to `/exams`.
