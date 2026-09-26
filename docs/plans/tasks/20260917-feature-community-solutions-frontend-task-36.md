# Task 36: `SolutionMenu` extended — "Báo cáo bài giải" + `ReportDialog` (solution variant)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P4-T5
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T5)
- **Dependencies**: task 19 (P2-T6 split 1/3, `SolutionMenu`), task 33 (P4-T2, `reportSolution`)
- **Provides**: `ReportDialog` (created once here, reused by task 37)
- **Size**: Small (2 files + component tests)

## Implementation Content

- `SolutionMenu` gains the working "Báo cáo bài giải" item for non-author viewers: task 19 already renders the item's two states from `SolutionDetail.iReported`; this task puts the `ReportDialog` behind the enabled item. The item is **absent** (not disabled) for the solution's own author (AC-074 — the author sees "Sửa bài giải" instead, AC-062).
- **Already-reported state is seeded from the read, flipped in-session** (frontend DD § Data Contracts `SolutionDetail`, "Within one page session…"; § Client State Design "Seeded-from-server state"; Element 10): the menu's local `reported` flag is `useState(iReported)`; it flips to `true` only on a `{ ok: true }` result from `reportSolution`, for **either** value of `alreadyReported`, and is never derived from the Server Action result alone and never written back. "Bạn đã báo cáo bài giải này." (`solutions.menu.reported`) with `aria-disabled="true"`, no native `disabled` and no handler is the one branch for both the seeded and the just-reported state (announced with `aria-live="polite"`); pressing it opens no dialog and calls `reportSolution` zero times. Every other menu item is unchanged.
- `ReportDialog` — built on `OverlaySheet`/dialog conventions from task 07; states: default, empty-reason (blocked with `role="alert"` `report.errorEmpty`, no submit), rate-limited (`{seconds}` via `profile.error.rateLimited`), generic failure (`{ ok: false, error: { code: "generic" } }` → dialog **stays open** with `report.errorGeneric`, the typed reason retained, the menu item still pressable). On `{ ok: true, alreadyReported }` (either value) the dialog **closes** and the menu shows the already-reported branch above; a duplicate report is not an error and has no separate state or DOM. A `variant: "solution" | "comment"` prop selects the title key (`report.commentTitle` for comments, used in task 37).
- `ReportDialog` lives in `SOURCE/features/solutions/components/`, modelled on `ReportExam`'s **shape, not its code**; it imports nothing from `SOURCE/features/exams/` (B4).

## Acceptance Criteria

From the plan (§ P4-T5): **AC-073, AC-074** (and, per frontend DD v1.6 EARS, AC-075/AC-076 in-session flip: "**When** a report succeeds in the current session, the system shall close `ReportDialog` and render the same already-reported branch for that target, for either value of `alreadyReported`, and shall leave every other item of the menu … unchanged").

Carried hard constraints that apply to this task:
- Actions only via `SOURCE/features/solutions/actions.ts`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`report.*` keys per UI Spec § "Chuỗi tiếng Việt cần thêm"); 360px floor; 44px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.
- Typed reason is never cleared on an error branch.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionMenu.tsx` (extend)
- [x] `SOURCE/features/solutions/components/ReportDialog.tsx` (new)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/features/solutions/components/SolutionMenu.tsx` (task 19 — data-driven items and the two `iReported` render states)
- `SOURCE/features/exams/components/ReportExam.tsx` (shape reference only — read, do not import)
- `SOURCE/components/shared/OverlaySheet.tsx`, `SOURCE/components/shared/ConfirmDialog.tsx` (task 07)
- `SOURCE/features/solutions/actions.ts` (`reportSolution` result shape, task 33: `{ ok: true, alreadyReported }` | `{ ok: false, error: { code: "empty" | "rateLimited" | "generic" } }`)
- `SOURCE/eslint.config.mjs` (B4 cross-feature rule)
- `docs/design/community-solutions-frontend-design.md` (§ Similar Component Search — "`ReportDialog` modeled on `ReportExam`'s shape, not its code")
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts `SolutionDetail` render rules; § Client State Design "Seeded-from-server state"; § Minimal Surface Alternatives Element 10; § UI Action - API Contract Mapping "Báo cáo bài giải/bình luận"; § Test Boundaries "Already-reported tests")
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra/dirty-close rows)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionMenu — verify extended (report, Phase 4) state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReportDialog — verify default + empty-reason + already-reported + rate-limited states)
- `docs/ui-spec/community-solutions-ui-spec.md` (`C-25`, `C-26`; § Yêu cầu trợ năng rows `C-25`, `C-26`)
- `docs/prd/community-solutions-prd.md` (AC-062, AC-073, AC-074)

## Boundary Context
(From the work plan's Connection Map — "Rate-limit rejection → client copy")
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`; unsaved reason never cleared.
- **Roundtrip check**: the `seconds` number `reportSolution` returns appears verbatim in the dialog's alert; the reason textarea value is unchanged.

## Investigation Notes

- `SolutionMenu.tsx` (task 19 build, read in full): renders two mutually-exclusive branches after the pin/unpin branch — `isMine ? "Sửa bài giải" link : iReported ? reported-button : report-button`. The report/reported branches currently have **no `onClick`** and the reported branch has **no `aria-live`**. `iReported: boolean` is a required prop (not `?:`), consumed directly in the JSX condition — task 36 must introduce a local `reported` state seeded from it (`useState(iReported)`) and switch the condition to read that state instead of the prop directly, without touching the pin/edit branches. `close()` helper already exists (closes menu + returns focus to trigger) — reused when the dialog opens: opening the report dialog should also close the menu panel (same pattern as `Link onClick={close}` on "Sửa bài giải").
- `ReportExam.tsx` (shape reference, NOT imported): client component, `useState` for `reported/open/reason/submitting/error`; validates `reason.trim()` client-side BEFORE calling the Server Action (empty branch never calls `reportExam`); on `{ok:true}` or `duplicate` sets `reported=true` and closes; dialog is `role="dialog" aria-modal aria-labelledby` with scrim + `motion-scrim`/`motion-modal`, `Escape` closes via a local `useEffect` keydown listener (own focus trap, no shared `useModalLayer` — that hook did not exist when `ReportExam` was written). Reported state renders `<p aria-live="polite">` with a check icon + `report.reported`. Imports `reportExam` from `@/features/authoring/actions` with an `eslint-disable-next-line no-restricted-imports` — this is the pre-B4 cross-import task 36 must NOT repeat; `ReportDialog` copies the dialog **shape** (layout classes, validation order, retained-reason-on-error rule) but sources its modal mechanics from `useModalLayer`/`usePresence` (task 07) instead of a bespoke `useEffect`.
- `OverlaySheet.tsx`: exports `useModalLayer({active, rootRef, panelRef, initialFocusRef?, onEscape})` — the shared modal-layer primitive (inert outside, scroll lock, focus trap, Escape-to-topmost-layer, focus-return). `ConfirmDialog.tsx` is the closer structural model for `ReportDialog` (a centered/bottom-sheet **dialog**, not a full-height sheet): portal → scrim (`motion-scrim bg-foreground/40`) → panel (`cardVariants({variant:"plain", padding:"none"})` + `motion-modal`), `useModalLayer` wired with `initialFocusRef` on the primary input, `busyRef` for synchronous re-entrancy guard alongside `busy` state, dialog **stays mounted while busy** (no early return on submit).
- `actions.ts` (`reportSolution`, task 33): `reportSolution(solutionId: string, reason: string): Promise<ReportResult>` where `ReportResult = {ok:true, alreadyReported:boolean} | {ok:false, error:{code:"empty"}|{code:"rateLimited",seconds:number}|{code:"generic"}}`. The action itself ALSO validates+trims `reason` server-side and can return `{code:"empty"}` — but `ReportExam`'s convention (and the task's Red Phase list: "empty reason → action not called") is to block client-side first and never call the action for an empty reason; the action's own `{code:"empty"}` branch is a defensive backstop, mapped the same way as a client-side empty (both render `report.errorEmpty`).
- `lib/copy.ts`: `report.title`("Báo cáo")/`report.intro`/`report.placeholder`/`report.submit`/`report.submitting`/`report.reported`/`report.errorEmpty`/`report.errorGeneric` already exist (exam-scoped generic report dialog). `solutions.menu.report`("Báo cáo bài giải") and `solutions.menu.reported`("Bạn đã báo cáo bài giải này.") already exist (added by task 19 per its own comment at that file's lines 1130-1135, ahead of this task, exactly for `SolutionMenu`'s two branches). **Missing, must add in this task**: `report.solutionTitle` ("Báo cáo bài giải") and `report.commentTitle` ("Báo cáo bình luận") — pinned verbatim in UI Spec § "Chuỗi tiếng Việt cần thêm" (S-05 group) and in frontend DD § Vietnamese Copy Keys table ("`report.solutionTitle` | **36**", "`report.commentTitle` | **37**"). `report.intro`/`report.title` are NOT in the UI Spec's "Dùng lại" (reused) list for this component and no replacement key is pinned for an intro line in `ReportDialog`'s own spec bullet — `ReportDialog` renders no intro paragraph (title + textarea + buttons only), matching the pinned "Hình dạng" bullet exactly (UI Spec :1319) and avoiding an undocumented new key or a wrong-domain reuse of exam-scoped `report.intro`'s literal text ("đề này").
- ESLint B4 (`eslint.config.mjs:40-56`): `features/solutions/**/*.{ts,tsx}` (excluding `__tests__`/`*.test.*`) may import only `@/features/solutions` (itself), not `@/features/*` from another feature — enforced via `no-restricted-imports` group pattern. `ReportDialog.tsx` imports only `@/components/*`, `@/lib/*`; it does not import from `@/features/exams` anywhere, so no `eslint-disable` is needed (unlike `ReportExam.tsx:19`).
- Frontend DD § Client State Design "Seeded-from-server state" (binding): `SolutionMenu`'s `reported` flag is `useState(seed)` where seed = `SolutionDetail.iReported`; flips to `true` only on `{ok:true}` from `reportSolution` (either `alreadyReported` value); never written back to the server, never read from storage; a failed report leaves the flag untouched. § Data Contracts Element 10: `iReported` is a required `boolean` (not `?:`) on both the header and every comment row, backend-pinned; `alreadyReported` "stays as the in-session flip, never as the source" (rejected Alternative B, explicitly "Do not re-propose").
- § UI Action - API Contract Mapping "Báo cáo bài giải/bình luận" row (binding): request `{id, reason}` conceptually (actual call signature `reportSolution(solutionId, reason)`); response `{ok:true, alreadyReported}` / `{ok:false, error:{code:"empty"|"rateLimited"|"generic"}}` → `report.errorEmpty` / `profile.error.rateLimited` (`{seconds}`) / `report.errorGeneric` **inside `ReportDialog`**. On `{ok:true}` (either `alreadyReported` value) dialog closes and component flips local `reported` into the single rendering branch.
- § Error Handling "Business logic (duplicate)" row (binding): a duplicate report is not an error, no toast, UI shows the already-reported state directly — matches `ReportExam`'s existing convention. "Rate limiting" row (binding): `profile.error.rateLimited` with `{seconds}`, input/UI state untouched. "Infrastructure" row (binding): generic failures map to the component's own generic key (`report.errorGeneric` for this component) — role="alert", no new error class.
- PRD AC-062/AC-073/AC-074 (read verbatim): AC-062 — own solution's menu has "Sửa bài giải" instead of "Báo cáo bài giải" (item absent, not disabled). AC-073 — non-author menu → "Báo cáo bài giải" opens dialog with reason textarea + "Gửi báo cáo"; empty reason blocked with exact message; valid reason closes dialog and flips menu to reported state, not pressable a second time. AC-074 — DB accepts one row per (solution, reporter) pair; author cannot report own solution (item absent from menu; API also refuses); non-submitted users cannot report.
- `LIMITS.MAX_REPORT_REASON = 1000` (`SOURCE/lib/ugc/limits.ts:117`) — same ceiling `ReportExam`/`reportSolution` already use.
- No Binding Decisions section or Reference Contracts section present in this task file — skipped those pre-implementation sub-checks; the Boundary Context roundtrip (rate-limited `seconds` verbatim in the alert, reason untouched) is exercised directly by the Red Phase test list and re-checked at the Exit Gate.

### Session-2 addendum (continuation after rate-limit interruption)

- `ReportDialog.tsx` was already complete and unmodified from the prior session (verified by reading it in full before touching anything). Only `SolutionMenu.tsx` needed wiring: added `reportSolution`/`ReportDialog` imports, a `reported` state seeded from `iReported` (`useState(iReported)`), a `reportOpen` state for the dialog, `openReport()` (opens dialog + calls the existing `close()` to also close the menu panel, same pattern as the "Sửa bài giải" `Link onClick={close}`), and `handleReported()` (`setReported(true); setReportOpen(false)`). The pre-existing `iReported ? reported-branch : report-branch` ternary became `reported ? ... : ...` with no other structural change; the already-reported branch gained `onClick`-less `aria-live="polite"` (previously missing) and stayed the single DOM branch for both seed and in-session-flip sources.
- Red phase was genuinely verified, not just asserted: `git stash push -- SolutionMenu.tsx` (test file kept), ran the 13 new/extended tests against the pre-task-36 unwired component → 7 failed (every `ReportDialog`-touching case), 6 passed (pin tests + the `isMine` own-content test, which pre-date this task's wiring and do not depend on it). `git stash pop` restored the wiring; re-ran → 13/13 green.
- Boundary Context roundtrip re-checked directly: test "rate-limited -> alert với {seconds} nguyên vẹn..." asserts `reportSolution` was called with the exact trimmed reason string, and separately asserts the rendered alert text is `"Thao tác quá nhiều lần. Thử lại sau 42 giây."` (the `seconds: 42` mock value appears verbatim) while the textarea's `.value` is unchanged — satisfies the roundtrip check.
- **Proof Obligation 1 (AC-074, own-content exclusion + in-session flip)**: met. `describe("SolutionMenu — AC-074 own-content exclusion")` proves `isMine: true` renders neither "Báo cáo bài giải" nor "Bạn đã báo cáo…", only "Sửa bài giải", and `reportSolution` is never called. `describe("SolutionMenu — ReportDialog (task 36)")` proves: already-reported item opens no dialog and 0 calls; `{ok:true, alreadyReported:false}` and `{ok:true, alreadyReported:true}` both close the dialog and land on the identical "Bạn đã báo cáo bài giải này." branch (byte-identical `outerHTML` asserted between the seeded-`iReported:true` render and the just-flipped render).
- **Proof Obligation 2 (frontend DD § Data Contracts `SolutionDetail`, seeded-from-server state)**: met. `iReported: true` renders the already-reported branch on first render, no press needed (covered by the pre-existing Required Test 6 in the same file, re-confirmed still green). The `generic` failure test proves a failed report never flips `reported` — the item stays enabled "Báo cáo bài giải" after the dialog is cancelled, and the dialog stays open with `report.errorGeneric` plus the retained reason in the interim.
- **B4 (no cross-feature import)**: `npm run lint` (`eslint --max-warnings 0`) ran clean on the full repo, including the `no-restricted-imports` rule scoped to `features/solutions/**`; neither `SolutionMenu.tsx` nor `ReportDialog.tsx` imports anything from `@/features/exams` or `@/features/authoring`.
- **Test review classification**: this task's added tests are pure component/unit tests (React Testing Library + Vitest, mocked `@/features/solutions/actions` at the module boundary, no real DB, no skeleton-fixture fill) — not integration tests in the sense that would require `integration-test-reviewer` (that role applies to real-DB/service-boundary or skeleton-fixture work, per this repo's task 27/32/34/35 precedent). `requiresTestReview` is set to `false` accordingly; standard `quality-fixer-frontend` review is sufficient.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests (frontend DD § Test Boundaries, "Already-reported tests (v1.5)" → Task 36; `reportSolution` mocked at the module boundary):
  - menu for non-author contains "Báo cáo bài giải"; menu for the solution's own author has no such item; empty reason → `role="alert"`, action not called; rate-limited → alert with `{seconds}` and reason retained; no import from `features/exams` (lint).
  - **Already-reported item is inert**: pressing the already-reported item (`iReported: true`) opens no dialog (`screen.queryByRole("dialog")` is `null`) and calls `reportSolution` zero times.
  - **In-session flip**: with `iReported: false`, pressing "Báo cáo bài giải" opens the dialog, and a `{ ok: true, alreadyReported: false }` result closes it and leaves the menu showing "Bạn đã báo cáo bài giải này." with `aria-disabled="true"`.
  - **Identical DOM for both values**: a `{ ok: true, alreadyReported: true }` result produces the identical DOM (one branch, not two) — compare the rendered menu after each result.
  - **`generic` keeps the dialog open**: a `{ ok: false, error: { code: "generic" } }` result keeps the dialog open with `report.errorGeneric`, the typed reason retained, and leaves the item pressable.
- [x] Run and confirm failure — actually verified: `git stash` on `SolutionMenu.tsx` alone (keeping the new test file), re-ran the suite against the pre-task-36 (unwired) `SolutionMenu.tsx` → 7/13 failed as expected (all `ReportDialog`-touching cases: open-dialog, empty, rate-limited, generic, already-reported-inert, in-session-flip, identical-DOM; the 6 that passed were the pre-existing pin tests + the AC-074 own-content test, which do not depend on the new wiring); `git stash pop` restored the wired implementation, re-ran → 13/13 green again

### 2. Green Phase
- [x] Implement menu item + dialog — `SolutionMenu.tsx` wired: `reported` state seeded from `iReported`, `openReport()`/`handleReported()`, `<ReportDialog variant="solution" onSubmit={(reason) => reportSolution(solutionId, reason)} .../>`
- [x] Run only the added tests and confirm they pass — 13/13 green (`npx vitest run features/solutions/components/__tests__/SolutionMenu.test.tsx`)

### 3. Refactor Phase
- [x] Keep `variant` the only difference between solution/comment dialogs — `ReportDialog.tsx` unchanged from the prior session; `variant` only selects `report.solutionTitle`/`report.commentTitle`, nothing else branches on it
- [x] Confirm added tests still pass — full `npm test` green (2511 passed, 10 skipped, 189 files), `npm run lint` clean, `npx tsc --noEmit` clean, `npm run test:fixture` green (16/16)

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4 — no import from `features/exams/`) — Config: `SOURCE/eslint.config.mjs`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — J1 / Test 2 / Test 3 stay green
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test`, `npm run lint`, `test:fixture` inside `SOURCE/`.
- **Success criteria**: component tests green; lint green with B4 active.
- **Failure response**: if reuse of `ReportExam` code seems necessary, stop — B4 forbids the import; re-implement the shape locally.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (AC-074, verbatim): "một báo cáo mỗi người mỗi đối tượng; không báo cáo bài của mình (mục menu không có)."
- **Primary failure mode**: the author sees "Báo cáo bài giải" on their own solution, or a second report surfaces as an error instead of "đã báo cáo".
- **Boundary to exercise**: rendered `SolutionMenu` (own vs non-own) and `ReportDialog` with `features/solutions/actions.ts` mocked.
- **State assertion**: own → menu items exclude the report item; `{ ok: true, alreadyReported: false }` and `{ ok: true, alreadyReported: true }` → the same menu DOM ("Bạn đã báo cáo bài giải này.", `aria-disabled="true"`), dialog closed; already-reported item pressed → no dialog, `reportSolution` call count 0.
- **Mock boundary rationale**: Server Actions mocked at the module boundary; DB uniqueness/own-content refusal proven in task 35.
- **Residual**: none.

- **Claim** (frontend DD § Data Contracts `SolutionDetail`): the on-screen already-reported state "is `SolutionDetail.iReported`", not the Server Action result; "`alreadyReported` stays as the in-session flip, never as the source" (Element 10).
- **Primary failure mode**: the menu derives the reported state only from the press result, so a reload re-offers a report the server will no-op, or a `generic` failure flips the item to "reported".
- **Boundary to exercise**: rendered `SolutionMenu` seeded with `iReported: false`/`true`, `reportSolution` mocked to each result shape.
- **State assertion**: `iReported: true` on first render → already-reported branch with no press; `generic` → item still enabled "Báo cáo bài giải", dialog open with `report.errorGeneric`, reason retained.
- **Mock boundary rationale**: Server Action mocked; the `i_reported` column itself is proven in tasks 16 and 35.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass — 13/13 new + 2511/2521 full suite (10 pre-existing skips), `npm run test:fixture` 16/16
- [x] Operation verified per Operation Verification Methods above — L2: `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run test:fixture` all green
- [x] Each Proof Obligation is met — see Investigation Notes addendum below

## Notes
- Impact scope: task 37 reuses `ReportDialog` unchanged except for `variant="comment"`.
- Scope boundary: `SOURCE/features/exams/components/ReportExam.tsx` unmodified and not imported.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
