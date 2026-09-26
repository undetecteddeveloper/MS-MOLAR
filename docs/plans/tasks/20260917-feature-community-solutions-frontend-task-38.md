# Task 38: `ReportedSolutionsSection` / `ReportedSolutionRow` / `ReportedCommentItem` + `AdminPage` integration

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P4-T7
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T7)
- **Dependencies**: task 32 (P4-T1), task 34 (P4-T3, `adminActions.ts`)
- **Provides**: the admin report queue for community solutions on `/admin`
- **Size**: Medium (4 files + component tests)

## Implementation Content

- New section on `SOURCE/app/(admin)/admin/page.tsx`, beside (not replacing) the existing exam-report `ModerationSection`; non-admin → `notFound()` via the existing gate, unchanged.
- `ReportedSolutionsSection` — data from `listCommunityReports()`; parts "Chờ xử lý" and "Đã ẩn" computed from solution status (R17); states default and empty.
- `ReportedSolutionRow` — per UI Spec § Component: ReportedSolutionRow: `Card as="li" padding="compact"`; exam title + report-count `Badge` + status `Badge`; the author's **true** display name + "ẩn danh với người đọc" note when anonymous (S5, AC-081); `<details>` "Lý do báo cáo" rendered as **plain text**; `<details>` "Ghi chú của bài giải" via `getSolutionNotesForAdmin()` rendered as that UI Spec section specifies; `useActionState` + `<form action>` like `ModerationRow`.
  - Pending: `[Ẩn bài giải]` before `[Xoá hẳn]`; Hidden: `[Khôi phục]` (reason optional) + `[Xoá hẳn]`.
  - Reason `required` client-side for hide/delete (`role="alert"` "Bạn hãy nhập lý do.", no submit) **and** re-validated server-side in `adminActions.ts` (task 34).
  - "Xoá hẳn" goes through `ConfirmDialog variant="confirm"` with the exact consequence line: "Bài giải, mọi ghi chú và mọi bình luận dưới bài (của mọi người) sẽ mất, không khôi phục được."
  - Busy: `aria-busy` + `aria-disabled` (never native `disabled`); error: `role="alert"` in the row, status unchanged.
- `ReportedCommentItem` — nested under the row's "Bình luận đã ẩn" sub-list, which stays visible whichever part the row is in (AC-107); hide/restore/delete via `moderateCommentAction`.
- **No "Bỏ qua" button** anywhere (AC-109). Reuse only `ModerationRow`'s **visual** pattern (compact Card, Badge counts, `<details>` reasons) — not its optional-reason/no-confirmation behaviour.
- **B4 wiring rule (deterministic, overview R7)**: `SOURCE/eslint.config.mjs` B4 forbids `features/admin/**` from importing `@/features/solutions/**`, while `app/` pages may compose features. Therefore `SOURCE/app/(admin)/admin/page.tsx` imports `listCommunityReports`, `getSolutionNotesForAdmin`, `moderateSolutionAction`, `moderateCommentAction` from `@/features/solutions/adminActions`, calls `listCommunityReports()` and, per row, `getSolutionNotesForAdmin(row.id)`, and passes the data plus the `onModerate` callbacks down as props. The three `features/admin/components/Reported*.tsx` files import nothing from `@/features/solutions/**`, matching the frontend DD interface `ReportedSolutionRow({ row: AdminReportedSolution, onModerate: (action, reason) => Promise<Result> })`.
- **Admin identity shape (v1.8, binding — `avatarUrl` dropped)**: admin rows take the plain `{ displayName: string; isAnonymousToReaders: boolean }` identity shape (`AdminReportedAuthor`, declared locally in `features/admin`) — **no `avatarUrl` field**. `AdminReportedAuthor` emits no avatar column at all: UI Spec `C-38`/`C-39` show the real display name with no avatar, AC-081 asks for a name and the "ẩn danh với người đọc" note and nothing else, and no admin component reads an avatar field. Never `AuthorIdentity`/`AnonymousAvatar` on `/admin` (those types belong to the masked, non-admin surfaces).
- **`notes: AdminSolutionNote[]` (required prop, v1.5, § Minimal Surface Alternatives Element 11)**: `ReportedSolutionRow` takes a required `notes: AdminSolutionNote[]` prop (`{ questionNumber: number; questionId: string; body: string }`, the twin of Reference Contract Value #16's 3-key set) and renders a `<details>` "Ghi chú của bài giải" with "Câu {questionNumber}" + `body` as **plain text** (no `RichText` on `/admin`) per entry, in array order (already `questionNumber` ascending — the component sorts nothing); `[]` → the `<details>` still exists and shows `solutions.row.noSolution` ("Chưa có lời giải"). `questionId` is the React list key only, never rendered.
- **`questionNumber: null` (current-question condition, v1.7)**: on both `ReportedSolutionRow`'s notes and `ReportedCommentItem`, a `questionNumber: null` entry (the question was deleted from the exam) renders **no** "Câu k" label while every other field (body, commenter line, report reasons, report count, action buttons) still renders.
- **Hidden row with 0 reports (Reference Contract Value #26)**: "a hidden solution is a row for as long as it is hidden, whatever its report count" — a `status: "hidden"` row with `reportCount: 0` still renders in "Đã ẩn" with `[Khôi phục]`/`[Xoá hẳn]`; the section never filters a row out for having no report of its own.

## Acceptance Criteria

From the plan (§ P4-T7): **AC-047, AC-081, AC-082, AC-085, AC-106–AC-109, S5**; Reference Contract Values #16 (`AdminSolutionNote` 3-key set), #26 (hidden row with 0 reports still queued).

Carried hard constraints that apply to this task:
- **TD-029 (explicit acceptance criterion)**: this task calls only `moderateSolutionAction`/`moderateCommentAction` (task 34) — never `moderateExamAction` or any `service-role.ts`-backed function; zero new imports of `SOURCE/lib/supabase/service-role` anywhere in this task's files.
- Existing `ModerationSection`/`ModerationRow` untouched.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`admin.solutions.*` keys); 360px floor; 44px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.

## Target Files
- [x] `SOURCE/features/admin/components/ReportedSolutionsSection.tsx` (new)
- [x] `SOURCE/features/admin/components/ReportedSolutionRow.tsx` (new)
- [x] `SOURCE/features/admin/components/ReportedCommentItem.tsx` (new)
- [x] `SOURCE/app/(admin)/admin/page.tsx` (add the section)
- [x] Component tests under `SOURCE/features/admin/components/__tests__/` (first admin component tests in the repo)

## Investigation Targets
- `SOURCE/app/(admin)/admin/page.tsx` (existing gate + `ModerationSection` usage at ~lines 55–63)
- `SOURCE/features/admin/components/ModerationRow.tsx` (visual pattern + `useActionState` form convention)
- `SOURCE/features/solutions/adminActions.ts` (task 34 result shapes)
- `SOURCE/components/shared/ConfirmDialog.tsx` (task 07)
- `SOURCE/eslint.config.mjs` (B4 rule, lines ~27–56: `features/admin/**` may not import `@/features/solutions/**`; `app/` is exempt)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `features/admin/components/ReportedSolutionsSection.tsx` / `ReportedSolutionRow.tsx` / `ReportedCommentItem.tsx`: `onModerate` prop interface and plain admin identity shape)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Admin report row contract" (`AdminReportedSolution`, `AdminReportedAuthor` without `avatarUrl`, `AdminHiddenCommentItem`), "Admin solution-notes contract" (`AdminSolutionNote`))
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives — Element 11 `AdminSolutionNote[]`)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "Admin hidden-comment item tests", "Admin notes `<details>` tests", "Admin visible-reported-comment `questionNumber` test", "Admin author-shape test", "Admin queue-membership test", "Admin refusal tests")
- `docs/design/community-solutions-frontend-design.md` (§ Fact Disposition Table — `AdminPage`)
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `AdminPage` composition (`ReportedSolutionsSection`))
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `/admin` page new section)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReportedSolutionsSection — verify default + empty states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReportedSolutionRow — verify default + hide-confirm + delete-confirm + restore states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReportedCommentItem — verify default (nested under "Bình luận đã ẩn") state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`C-37`–`C-39`; § Yêu cầu trợ năng row `C-38`/`C-39`)
- `docs/prd/community-solutions-prd.md` (R17, S5, AC-081, AC-082, AC-085, AC-106–AC-109)

## Investigation Notes
(Append observations here before implementation begins. Record the `npm run lint` result proving the Reported* files import nothing from `@/features/solutions/**`.)

**2026-09-27 — task-executor-frontend, pre-implementation reading**

- `app/(admin)/admin/page.tsx`: async Server Component, `force-dynamic`; gate `getCurrentUser()` → `!user || !isAdminUserId(user.id)` → `notFound()` (AC-085, left as is). Reads `listReportedExams()` (service-role, pre-existing import — this task adds no new one) and renders a file-local `ModerationSection` twice ("Chờ xử lý" always, "Đã gỡ" only when non-empty). The new section is added AFTER those two blocks; nothing inside `ModerationSection`/`ModerationRow` changes.
- `features/admin/components/ModerationRow.tsx`: `"use client"`, `useActionState(moderateExamAction, null)`, `Card as="li" padding="compact"`, badge row (`admin.oneReport`/`admin.reportCount` + status badge, `variant="plain"`), `<details className="group/reasons">` with a rotating `ChevronDown`, reasons as plain `<li>` text. Visual pattern reused only; its optional reason, native `disabled` and one-click submit are NOT reused.
- `features/solutions/adminActions.ts` (task 34, read in full): exported types `AdminReportedAuthor {displayName, isAnonymousToReaders}` (no `avatarUrl`), `AdminReportedCommentItem {id, questionNumber: number|null, body: string, commenter, reportCount, reportReasons}`, `AdminHiddenCommentItem {id, questionNumber: number|null, body, commenter, hiddenReason, hiddenAt, reportCount}`, `AdminReportedSolution {id, examId, examTitle, author, status: "published"|"hidden", reportCount, reportReasons, reportedComments, hiddenComments}`, `AdminSolutionNote {questionNumber: number, questionId, body}`, `AdminModerationState = {ok:true,status} | {error:"admin.solutions.actionError"} | {error:"profile.error.rateLimited",seconds} | null`. Form actions `moderateSolutionAction(prev, formData)` / `moderateCommentAction(prev, formData)` read **`solutionId`** / **`commentId`** (confirmed at `readModerationForm(formData, target.formIdField)`, lines 253-261 / 299-324 — NOT `id`), plus `action` ∈ {hide, restore, delete} and `reason` (trimmed; required for hide/delete server-side). Success → `revalidatePath("/admin")`. Reads `listCommunityReports()` / `getSolutionNotesForAdmin(id)` throw on non-admin/RPC error.
  - Note: frontend DD § Data Contracts still types comment bodies as `bodyNode: ReactNode`; the shipped contract (task 34) is `body: string`. The admin components mirror the SHIPPED shape (plain string printed as text), which is the DD's own stated render rule ("plain text").
- `components/shared/ConfirmDialog.tsx`: `variant="confirm"` + `confirmLabel` + `destructive`; `onConfirm: () => Promise<void>`, busy until it settles; parent owns `open`. Portal to `<body>`, `role="dialog"` named by title, `aria-describedby` → body.
- `eslint.config.mjs` B4: `features/admin/**/*.{ts,tsx}` (non-test) may not import `@/features/<other>/**`; `__tests__` and `app/` exempt. ⇒ the admin components declare their OWN structural twins of the types above; `app/(admin)/admin/page.tsx` is the only production file importing `@/features/solutions/adminActions`.
- UI Spec `C-37`/`C-38`/`C-39` + copy list (§ Chuỗi tiếng Việt, "Quản trị (S-07, admin.*)"): keys `admin.solutions.{title, hiddenPart, author, anonymousNote, notes, hideAction, deleteAction, reasonRequired, reasonOptional, reasonMissing, deleteTitle, deleteBody}`, `admin.comments.{hideAction, hiddenGroup, deleteTitle, deleteBody}` — none in `lib/copy.ts` yet; plus DD key `admin.solutions.actionError` ("Thao tác chưa thành công. Bạn thử lại nhé."). Reused existing keys: `admin.awaitingReview`, `admin.reportedReasons`, `admin.oneReport`, `admin.reportCount`, `admin.nothingReported`, `status.published`, `solutions.status.hidden`, `common.restore`, `common.working`, `upload.questionLabel`, `solutions.row.noSolution`, `solutions.comments.hiddenByAdmin`, `profile.error.rateLimited`, `time.*` via `relativeTime(iso, now)`.
- `lib/copy.ts` is not listed in Target Files, but the DD's owning-task rule (§ Vietnamese Copy Keys, v1.4) makes task 38 the owner of `admin.solutions.*`/`admin.comments.*` and the task 34 hand-off requires `admin.solutions.actionError` here; the orchestrator's brief also directs it. Treated as in scope (additive keys only).

**Planned approach / decisions**

- Interface reconciliation (DD `onModerate: (action, reason) => Promise<Result>` vs. UI Spec/DD "`useActionState` + `<form action>` like ModerationRow"): `onModerate` is the Server Action itself (`(prev, formData) => Promise<state>`), passed as a prop by the page and fed to `useActionState`. The component builds the `FormData` explicitly (`solutionId`|`commentId`, `action`, `reason`) and dispatches inside `startTransition` after client validation / the confirm step — so the delete path cannot bypass `ConfirmDialog`, Enter in the reason field submits the primary action, and B4 holds (no import of the action module).
- Shared reason field + validation (Refactor step): one `ModerationReasonForm` exported from `ReportedCommentItem.tsx` (the leaf, so no import cycle) used by both the row and the item — kept inside the Target Files rather than adding a fifth file.
- `ReportedSolutionsSection` takes `items: { row, notes }[]` (notes paired per row by the page, no `?? []` fallback that could fake "Chưa có lời giải"), `now: Date`, and the two actions. Parts split by `row.status` only; no filter on counts.
- Adjacent residual (not in scope): none found — `ModerationRow` still uses native `disabled`, which is the pre-existing exam section and explicitly out of scope.

**2026-09-27 — implementation results**

- Files: `features/admin/components/ReportedCommentItem.tsx` (local types + `AdminAuthorLine` + shared `ModerationReasonForm` + item), `ReportedSolutionRow.tsx`, `ReportedSolutionsSection.tsx` (no `"use client"`, stateless), `app/(admin)/admin/page.tsx` (additive: `Promise.all([listReportedExams(), listCommunityReports()])`, then `getSolutionNotesForAdmin(row.id)` per row, fixed `now`, section after the two exam sections), `lib/copy.ts` (+17 keys: 12 `admin.solutions.*` from the UI Spec list verbatim, `admin.solutions.actionError`, 4 `admin.comments.*`).
- Tests (4 new files, 46 cases): `__tests__/ReportedCommentItem.test.tsx` (14), `ReportedSolutionRow.test.tsx` (19), `ReportedSolutionsSection.test.tsx` (9), `AdminPage.test.tsx` (4 — AC-085 gate + per-row notes wiring). Note: the repo already had admin component tests under `features/admin/components/tickets/__tests__/` — "first admin component tests" in the task file is stale; not a problem.
- Form field names: every dispatched `FormData` carries `solutionId` (row) / `commentId` (item), asserted in tests with `formData.has("id") === false`.
- `npm run lint` (eslint --max-warnings 0, incl. B4): clean. `grep "features/solutions" features/admin/components/Reported*.tsx` → only the three B4 comments, no import. `grep "service-role\|moderateExamAction" features/admin/components/Reported*.tsx` → nothing. `page.tsx`'s `service-role` import is the pre-existing `listReportedExams` line (diff context, not added). `serviceRoleSurface.test.ts` green (6/6), unmodified.
- `npx tsc --noEmit`: clean. avatarUrl proof: removing the two `@ts-expect-error` lines in `ReportedCommentItem.test.tsx` makes tsc fail with `TS2353 … 'avatarUrl' does not exist in type 'AdminReportedAuthor'` at both fixtures (admin-local type AND adminActions' type); file restored afterwards.
- `npm test`: 193 files passed / 1 skipped, 2564 tests passed / 10 skipped. `npm run test:fixture`: 2 files, 16 tests passed.
- Proof Obligations: #1 AC-109 (`ReportedSolutionsSection.test.tsx` "Proof Obligation #1"), #2 AC-082/AC-106 (`ReportedSolutionRow.test.tsx` "Proof Obligation #2": empty/whitespace reason → 0 calls + alert; exact consequence line; cancel → 0; confirm → 1 call `action=delete`), #3 AC-107 (section "Proof Obligation #3", rerender transitions incl. delete → absent from both parts), #4 Ref. Contract #16 (row "Admin notes <details> tests"), #5 `questionNumber: null` (item tests, both variants), #6 author shape (tsc proof + no `<img>` DOM check), #7 Ref. Contract #26 (section "queue-membership") — all green.
- **L1 status (BLOCKED, not skipped)**: the Operation Verification's signed-in step (sign in as dev admin, create a report as a test user, hide → restore → hard-delete on `/admin`) was NOT run. At run time the dev server was not up (`localhost:3000` unreachable) and there was no signed-in shared Playwright CLI session; per project memory auto mode denies Claude's own sign-in submit. Engineer action needed: start `npm run dev` in `SOURCE/`, sign the shared Playwright CLI session in as the dev admin (and a test user for the report) from their own terminal, then re-run the L1 steps. Also needs the non-admin → 404 browser check.

**2026-09-27 — test hardening after integration-test-reviewer (findings raised by the reviewer, now fixed)**

The reviewer found no production path that skips the reason check or the confirm step. The problem was in the tests: they did not lock the two riskiest permanent-delete paths. Fixes:
- Fix 1 (`ReportedSolutionRow.test.tsx`): `published` row, reason `"   "` + "Xoá hẳn" → alert "Bạn hãy nhập lý do.", `queryByRole("dialog")` null, 0 calls.
- Fix 2 (`ReportedSolutionRow.test.tsx`, new describe "'Xoá hẳn' từ hàng 'Đã ẩn'"): `hidden` row `sol-h` (0 reports). The primary action there is `restore` (reason optional), so delete from THIS row needed its own lock. Tests: (a) empty reason + "Xoá hẳn" → alert, no dialog, 0 calls; (b) valid reason → ConfirmDialog with the exact consequence line → confirm → exactly 1 call, `solutionId=sol-h`, `action=delete`, reason as typed. This is the Reference Contract Value #26 path.
- Fix 3 (`ReportedCommentItem.test.tsx`): reason `"   "` for "Ẩn bình luận" (0 calls) and for "Xoá hẳn" on both the reported and the hidden comment (alert, no dialog, 0 calls).
- Optional fix, APPLIED: added `if (pending) return;` at the top of `confirmDelete` in `ModerationReasonForm` (`ReportedCommentItem.tsx`). This one form serves both the solution row and the comment item, so `ReportedSolutionRow.tsx` has no separate `confirmDelete` and needs no guard of its own. Why ConfirmDialog's `busyRef` was not enough: `confirmDelete` returns straight away, so `busyRef` only blocks clicks in the same tick. After that, the closing panel stays in the DOM for `MODAL_EXIT_MS` and only `inert` stops clicks on it. RED evidence: the new test enables the exit animation with a stubbed `matchMedia` and clicks confirm twice, one tick apart, while the action hangs. It failed with "called 2 times" (`useActionState` queued a second delete), then passed with the guard.
- Gates: `npx vitest run features/admin` 11 files / 79 tests pass; `npm run lint` clean; `npx tsc --noEmit` clean; `npm test` 193 files passed / 1 skipped, 2571 passed / 10 skipped; `npm run test:fixture` 2 files / 16 tests pass.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests for each Proof Obligation plus (frontend DD § Test Boundaries):
  - anonymous solution row shows true name + "ẩn danh với người đọc"; report reasons render as plain text (an HTML-looking reason shows as literal text); busy state uses `aria-disabled`, not `disabled`.
  - **Admin hidden-comment item tests**, `ReportedCommentItem` with literal `AdminHiddenCommentItem` objects: `{ questionNumber: 4, commenter: { displayName: "Lan", isAnonymousToReaders: false }, hiddenReason: "spam", hiddenAt: "2026-09-17T10:00:00Z", reportCount: 2, … }` → "Câu 4" present, "Lan" present, no text matching `/ẩn danh với người đọc/`; the same object with `isAnonymousToReaders: true` → "Lan" **and** "ẩn danh với người đọc" both present, the real name never replaced; `questionNumber: null` → no text matching `/^Câu \d/` anywhere, while body, "Lan", reason, relative `hiddenAt`, report count and both buttons ("Khôi phục", "Xoá hẳn") are all present; `reportCount: 0` → both buttons still render.
  - **Admin notes `<details>` tests**, `ReportedSolutionRow` with a literal `notes` prop: `[{ questionNumber: 1, questionId: "q1", body: "Giải thích dài…" }, { questionNumber: 3, questionId: "q3", body: "Ghi chú hai" }]` → a `<details>` summary "Ghi chú của bài giải" exists; opening it shows "Câu 1" before "Câu 3" in document order, both bodies as plain text; `notes: []` → the `<details>` still exists and contains "Chưa có lời giải". Companion assertion: the rendered output contains no element produced by `RichText` (assert the raw `body` string appears verbatim, including any markdown markers).
  - **Admin visible-reported-comment `questionNumber` test**: an `AdminReportedCommentItem` with `questionNumber: null` renders no text matching `/^Câu \d/` anywhere, while body, commenter line, report reasons, report count and both action buttons are all present.
  - **Admin author-shape test**: `AdminReportedAuthor` fixtures are built with exactly `{ displayName, isAnonymousToReaders }`; `tsc` rejects an `avatarUrl` key on that type, and no assertion in the admin test files references an avatar image.
  - **Admin queue-membership test**: an `AdminReportedSolution` with `status: "hidden"`, `reportCount: 0`, `reportReasons: []`, `reportedComments: []` and one entry in `hiddenComments` renders in "Đã ẩn" with `[Khôi phục]`/`[Xoá hẳn]` and its "Bình luận đã ẩn" subsection.
  - **Admin refusal tests**: `moderateSolutionAction`/`moderateCommentAction` resolving to an error result render `admin.solutions.actionError` in the row/item's `role="alert"`, return the button to idle, leave the rendered status unchanged; a submit with an empty reason on "Ẩn bài giải"/"Xoá hẳn" shows "Bạn hãy nhập lý do." and calls no action. A row with non-empty `hiddenComments` renders the subsection in both parts of the queue; with `[]` it renders none.
- [x] Run and confirm failure

### 2. Green Phase
- [x] Implement the three components and the page section
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Share one reason field + validation between hide/delete forms
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs`
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `serviceRoleSurface.test.ts` — re-run; must stay green unmodified
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `npm run lint`; `grep -rn "service-role\|moderateExamAction" SOURCE/features/admin/components/Reported*.tsx` returns nothing; on the dev server, sign in as the dev admin, create a report as a test user, then hide → restore → hard-delete from `/admin`.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: component tests green; an admin sees and acts on the queue end to end against real dev Postgres (Phase 4 exit criterion); non-admin gets 404.
- **Failure response**: if the delete path can run without the confirm step, stop — AC-106 requires it.
- **Verification level**: L1 (admin queue on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (AC-109, verbatim): "không có nút 'Bỏ qua'; hàng ra/vào hàng đợi theo trạng thái bài."
- **Primary failure mode**: a dismiss control is added (soft state), or a row's part is decided by something other than solution status.
- **Boundary to exercise**: rendered `ReportedSolutionsSection` with fixture rows in both statuses.
- **State assertion**: no element with accessible name "Bỏ qua"; `published` row under "Chờ xử lý", `hidden` row under "Đã ẩn".
- **Mock boundary rationale**: `adminActions.ts` mocked at the module boundary.
- **Residual**: DB queue computation proven by task 35's admin list success case.

- **Claim** (AC-082 / AC-106): hide and hard-delete require a non-empty reason (client + server) and hard-delete requires confirmation with the exact consequence line.
- **Primary failure mode**: an admin hard-deletes with one click or with no reason.
- **Boundary to exercise**: rendered `ReportedSolutionRow` with `moderateSolutionAction` mocked.
- **State assertion**: empty reason → action call count 0 + alert; reason + "Xoá hẳn" → `ConfirmDialog` shows the exact line; cancel → call count 0; confirm → called once with `"delete"`.
- **Mock boundary rationale**: Server Actions mocked; server-side reason re-validation proven in task 34.
- **Residual**: none.

- **Claim** (Failure Mode #8, rollback-only visibility / AC-107): hidden comments stay listed under "Bình luận đã ẩn" inside their row regardless of which part the row is in, and a hard-deleted row disappears from both parts.
- **Primary failure mode**: hiding a comment moves the whole solution row, or a deleted row lingers in "Đã ẩn".
- **Boundary to exercise**: rendered section across fixture transitions (re-render with post-action fixture data).
- **State assertion**: row with 1 hidden comment in "Chờ xử lý" → sub-list visible; after delete fixture → row absent from both parts.
- **Mock boundary rationale**: `adminActions.ts` mocked.
- **Residual**: none.

- **Claim** (Reference Contract Value #16 / § Minimal Surface Alternatives Element 11): `AdminSolutionNote`'s keys equal exactly `{questionNumber, questionId, body}`, rendered as a `<details>` "Ghi chú của bài giải" with plain-text bodies, in array order.
- **Primary failure mode**: notes render through `RichText` (a second markdown-rendering surface on `/admin`), or an empty array hides the `<details>` instead of showing "Chưa có lời giải".
- **Boundary to exercise**: `ReportedSolutionRow` rendered directly with the literal `notes` fixtures above.
- **State assertion**: "Câu 1" precedes "Câu 3" in document order; raw body string (incl. markdown markers) appears verbatim; `[]` → `<details>` present with "Chưa có lời giải".
- **Mock boundary rationale**: none — component rendered for real.
- **Residual**: the RPC's own column set is proven in tasks 32/34/35.

- **Claim** (v1.5/v1.7, `questionNumber: null` current-question condition): a note or comment whose question was deleted from the exam shows no "Câu k" label while every other field still renders.
- **Primary failure mode**: the row throws or shows "Câu null"/"Câu undefined" instead of omitting the label.
- **Boundary to exercise**: `ReportedSolutionRow`'s notes `<details>` and `ReportedCommentItem` each with one entry carrying `questionNumber: null`.
- **State assertion**: no text matching `/^Câu \d/` for that entry; body/commenter/reason/count/buttons unaffected.
- **Mock boundary rationale**: none.
- **Residual**: none.

- **Claim** (v1.8, admin author shape): `AdminReportedAuthor` is `{ displayName, isAnonymousToReaders }` only — `avatarUrl` was dropped and must not reappear.
- **Primary failure mode**: a later edit re-adds an `avatarUrl` field, silently reintroducing an avatar-signing dependency `/admin` was designed not to need.
- **Boundary to exercise**: `tsc --noEmit` against a fixture literal that includes `avatarUrl`, plus a grep-style DOM assertion that no admin test renders an `<img>`/avatar.
- **State assertion**: the `avatarUrl` fixture fails to compile; no admin component test references an avatar image.
- **Mock boundary rationale**: none — compile-time proof.
- **Residual**: none.

- **Claim** (Reference Contract Value #26): "a hidden solution is a row for as long as it is hidden, whatever its report count."
- **Primary failure mode**: the section filters out a `reportCount: 0` hidden row, so an admin who hides a solution loses the ability to restore or hard-delete it once its reports are all resolved.
- **Boundary to exercise**: `ReportedSolutionsSection` with a literal `AdminReportedSolution` `{ status: "hidden", reportCount: 0, reportReasons: [], reportedComments: [], hiddenComments: [one entry] }`.
- **State assertion**: the row renders in "Đã ẩn" with `[Khôi phục]`/`[Xoá hẳn]` and the "Bình luận đã ẩn" subsection.
- **Mock boundary rationale**: `adminActions.ts` mocked.
- **Residual**: DB queue computation proven by task 35.

## Completion Criteria
- [x] All added tests pass
- [🔄] Operation verified per Operation Verification Methods above — L2 done (tests/lint/grep); **L1 (signed-in `/admin` on dev) BLOCKED, waiting on the engineer** (see Investigation Notes "L1 status")
- [x] Each Proof Obligation is met
- [x] Zero imports of `SOURCE/lib/supabase/service-role` and zero calls to `moderateExamAction` in this task's files (TD-029)
- [x] `AdminReportedAuthor` compiles with exactly `{ displayName, isAnonymousToReaders }`; a fixture adding `avatarUrl` fails `tsc`

## Notes
- Impact scope: `/admin` only.
- Scope boundary: `SOURCE/features/admin/components/ModerationRow.tsx` and the existing exam-report section unmodified.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
