# Task 37: `CommentItem` extended — "Báo cáo" + `ReportDialog` (comment variant)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P4-T6
- **Phase**: 4
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P4-T6)
- **Dependencies**: task 28 (P3-T5, `CommentItem`), task 33 (P4-T2, `reportComment`), task 36 (P4-T5, `ReportDialog`)
- **Provides**: comment reporting in the comment sheet
- **Size**: Small (1 file + component test)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, backend DD **v1.9**, work plan **v1.3**

## Implementation Content

- `CommentItem` gains the report affordance for comments not written by the viewer; the control of **either** kind is **absent** for the viewer's own comment (UI Spec `C-30`: "Xoá" on one's own comment **or** "Báo cáo" on someone else's).
- **Two branches from `iReported`, one rendering path (frontend DD v1.6 § Data Contracts `SolutionDetail`, "Render rule — COMMENT ROW")**: each comment row carries a **required boolean** `iReported`, read with the page from the backend's `i_reported` and never derived from a Server Action's return value. `false` → the ordinary "Báo cáo" button (`solutions.comments.report`); `true` → in its place the text `solutions.comments.reported` ("Bạn đã báo cáo bình luận này.") on a control carrying `aria-disabled="true"`, **no** native `disabled` and **no** `onClick`, so it opens no `ReportDialog`. The row's body, identity, "Người viết" badge and "Xoá" (when `isMine`) are unaffected. Because the state is seeded from the read, a reporter who reloads — or opens the solution days later — still sees it.
- Opens the **same** `ReportDialog` from task 36 with `variant="comment"` (title key `report.commentTitle`) and calls `reportComment(commentId, reason)`. No second dialog component, no duplicated validation.
- **In-session flip**: on `{ ok: true, alreadyReported }` — **either** value — the dialog closes and the component sets its local `reported` flag, which is seeded from `iReported`, never written back to it, and renders through the **same single branch**. There is no second "just reported" appearance. A `{ ok: false, error: { code: "generic" } }` keeps the dialog open with `report.errorGeneric` and leaves the control pressable.
- **Own admin-hidden row**: a row with `isHiddenByAdmin: true`, `hiddenReason`, `isMine: true` and `iReported: false` renders the UI-D19 dimmed variant with its reason, **no** "Xoá", and **no** report control of either kind. This is the only shape the backend can send for a hidden comment: it reaches only its own author, and nobody can report their own comment, so backend DD v1.9 pins the per-comment `i_reported` as always `false` on a row with `is_hidden_by_admin = true`. **A row that is both admin-hidden and already-reported cannot occur**; `CommentItem` keeps no branch and no test for that combination (v1.5's combination case is dropped in v1.6, not kept as a defensive test).
- **Copy keys added here**: `solutions.comments.report` ("Báo cáo") and `solutions.comments.reported` ("Bạn đã báo cáo bình luận này."), plus `report.commentTitle` ("Báo cáo bình luận") — the three keys the frontend DD's owning-task table assigns to this task, added verbatim from the UI Spec list. The rest of `solutions.comments.*` came with task 28.

## Acceptance Criteria

From the plan (§ P4-T6): **AC-074, AC-076** (and AC-070 for the hidden-row case).

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **While** a comment's `iReported` is `true`, the system renders, in place of that row's "Báo cáo" control, the text "Bạn đã báo cáo bình luận này." (`solutions.comments.reported`) with `aria-disabled="true"`, no native `disabled` and no click handler. (AC-074, AC-076, UI Spec `C-26` AC-074 row)
- **When** the page is loaded by a user who reported the comment in an **earlier** session, the already-reported state renders with no user action in between, because it is read from `iReported`. (AC-074)
- **When** a report succeeds in the current session, `ReportDialog` closes and the same already-reported branch renders, for **either** value of `alreadyReported`, leaving every other cell of the row unchanged. (AC-073, AC-075, AC-076)
- **While** a comment row carries `isHiddenByAdmin: true` — which the backend returns only to that comment's own author, so the row always has `isMine: true` and `iReported: false` — the row renders the `UI-D19` dimmed variant with its reason, **no** "Xoá" button, and **no** report control of either kind. (AC-070, AC-074)

Carried hard constraints that apply to this task:
- Actions only via `SOURCE/features/solutions/actions.ts`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (cited by key name, never by line); 44px touch target for "Báo cáo"; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.
- **ADR-0002**: comment body rendering path from task 28 unchanged.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/CommentItem.tsx` (extend)
- [x] Component test under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/features/solutions/components/CommentItem.tsx` (task 28)
- `SOURCE/features/solutions/components/ReportDialog.tsx` (task 36 — `variant` prop)
- `SOURCE/features/solutions/actions.ts` (`reportComment`, task 33 — `{ ok: true, alreadyReported }` | `{ ok: false, error: { code: "empty" | "rateLimited" | "generic" } }`)
- `SOURCE/features/solutions/components/SolutionMenu.tsx` (tasks 19/36 — the solution-side twin of the two `iReported` branches; same rule, same shape)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts `SolutionDetail` — per-comment `iReported`, "Render rule — COMMENT ROW", and the invariant that `iReported` and `isHiddenByAdmin` are never both true)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components `CommentSheet`/`CommentItem` — "Report affordance and the already-reported state (v1.5)")
- `docs/design/community-solutions-frontend-design.md` (§ Client State Design — "Seeded-from-server state (v1.5)"; § UI Action - API Contract Mapping — the report row)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "Already-reported tests → Task 37")
- `docs/design/community-solutions-backend-design.md` v1.9 (§ Data Contracts `community_solution_detail` — the per-comment `i_reported` expression)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentItem — verify default, already-reported (`C-26` AC-074 row) and own-hidden (`UI-D19`) states; `C-30` for which control a row may carry)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReportDialog — verify default + empty-reason + already-reported + rate-limited states, comment variant)
- `docs/prd/community-solutions-prd.md` (AC-076)

## Investigation Notes

- `CommentItem.tsx` (task 28): `canDelete = comment.isMine && !comment.isHiddenByAdmin`; action row currently renders only "Xoá" when `canDelete`. Header comment explicitly says no "Báo cáo" here yet ("phạm vi task 37"). `comment.iReported` already flows through the `SolutionDetailComment` prop type but is unread by any branch. `deleteComment` imported from `actions.ts`; `t` from `@/lib/copy`.
- `ReportDialog.tsx` (task 36): `{ open, variant: "solution" | "comment", onSubmit: (reason) => Promise<ReportResult>, onCancel, onReported }`. Owns reason input, empty-guard (`report.errorEmpty`) BEFORE calling `onSubmit`, rate-limited/generic error rendering, and calls `onReported()` on `{ ok: true }` for **either** `alreadyReported` value. Does not own the "already reported" flag — that lives in the caller (`SolutionMenu`/`CommentItem`). Title picked via `variant`: `report.commentTitle` already exists in `copy.ts` (added by task 36).
- `actions.ts`: `reportComment(commentId, reason): Promise<ReportResult>` — identical shape/validation to `reportSolution` (`{ code: "empty" | "rateLimited" | "generic" }`, `{ ok: true; alreadyReported: boolean }`), only RPC name + `p_comment_id` differ.
- `SolutionMenu.tsx` (task 36 — twin pattern to copy): `const [reported, setReported] = useState(iReported)` (seed only, never written back except via `handleReported`); one DOM branch — `reported ? <button aria-disabled="true" aria-live="polite" (no onClick)>{t(".reported")}</button> : <button onClick={openReport}>{t(".report")}</button>`; `handleReported` sets `reported=true` and closes the dialog; `ReportDialog` rendered unconditionally with `open={reportOpen}`.
- `queries.ts` § `SolutionDetailComment`: `iReported: boolean` (required, mapped from `row.i_reported`, never optional); `isHiddenByAdmin?`/`hiddenReason?` present only on the comment's own author's view of their own hidden row (backend always sends `isMine: true`, `iReported: false` on that row — the combination "hidden AND iReported:true" cannot occur per backend DD v1.9). So `canReport = !comment.isMine` alone is sufficient — hidden rows already have `isMine: true` and are excluded without a separate `!isHiddenByAdmin` check.
- `docs/design/community-solutions-frontend-design.md` § Data Contracts "Render rule — COMMENT ROW": confirms exact copy keys, `aria-disabled="true"`, no native `disabled`, no `onClick`; body/identity/"Người viết"/"Xoá" unaffected; one rendering branch shared by seed and in-session flip.
- UI Spec § Component CommentItem `C-30`: action row is "Xoá" (mine) **or** "Báo cáo" (others), both ≥44px — mutually exclusive, never both.
- `copy.ts`: `report.commentTitle` already present (task 36). `solutions.comments.report` / `solutions.comments.reported` NOT yet defined — a stale comment block (lines ~1102-1106) explicitly reserves them for this task; will replace that comment and add the two keys there.
- `SolutionViewScreen.test.tsx` (task 21): its `iReported` threading describe block is explicitly scoped to "nửa đầu bài" (`SolutionMenu` half) only, with an inline note that "nửa bình luận cần task 37" — no assertion in that file currently exercises the comment half, and it is not in this task's Target Files, so left untouched.
- No Binding Decisions / Reference Contracts / Change Category sections present in this task file — those pre-implementation checks are not applicable.

## Required Tests (frontend DD v1.6 § Test Boundaries, "Already-reported tests → Task 37"; work plan § P4-T6)

`@/features/solutions/actions` is mocked at the module boundary; `ReportDialog` renders for real. The first four are the task-36 assertions repeated on the comment row with `solutions.comments.reported`.

1. **Already-reported item is inert**: a row with `iReported: true` renders "Bạn đã báo cáo bình luận này." with `aria-disabled="true"` and no `disabled` attribute; pressing it opens **no** dialog (`screen.queryByRole("dialog")` is `null`) and calls `reportComment` **zero** times.
2. **Not-yet-reported opens the dialog**: with `iReported: false`, pressing "Báo cáo" opens the dialog, and a `{ ok: true, alreadyReported: false }` result closes it and leaves the row showing "Bạn đã báo cáo bình luận này." with `aria-disabled="true"`.
3. **Identical DOM for either value**: a `{ ok: true, alreadyReported: true }` result produces the **identical** DOM as the previous case (one branch, not two).
4. **`generic` keeps the dialog open**: `{ ok: false, error: { code: "generic" } }` keeps the dialog open with `report.errorGeneric` and leaves the control pressable.
5. **Own-hidden row**: a row built from the shape the backend actually sends — `isHiddenByAdmin: true`, `hiddenReason: "spam"`, `isMine: true`, `iReported: false` — renders the `UI-D19` dimmed variant and the reason, and renders **no** "Xoá" button, **no** "Báo cáo" control and **no** text matching `/Bạn đã báo cáo/`.
6. **Own visible comment**: a row with `isMine: true` and `isHiddenByAdmin` absent renders "Xoá" and no report control of either kind.
7. **Right action, right id, right title**: submitting a reason calls `reportComment` (never `reportSolution`) with the **comment's** id, and the dialog's title uses `report.commentTitle`.
8. **Same rules as the solution variant**: an empty reason calls `reportComment` zero times and shows `report.errorEmpty`.

**Not tested — and no code path for it**: the "hidden **and** `iReported: true`" combination. Backend DD v1.9 cannot produce that row (a hidden comment reaches only its own author, and nobody can report their own comment), so v1.5's combination case is **dropped** in v1.6 rather than kept as a defensive test.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Wire the control and dialog
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] No duplicated dialog state in `CommentItem`, and **one** rendering branch for the already-reported state (the seeded value and the in-session flip must not become two appearances)
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — Test 2 (O-02) and Test 3 stay green
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `test:fixture` inside `SOURCE/`.
- **Success criteria**: component tests green; fixture Test 2/3 unaffected.
- **Failure response**: if the comment variant needs different validation, stop — AC-076 requires "cùng hộp thoại, cùng luật".
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (AC-076, verbatim): "cùng hộp thoại, cùng luật."
- **Primary failure mode**: a separate comment report dialog drifts from the solution dialog's rules (e.g. allows an empty reason), or the own comment offers "Báo cáo".
- **Boundary to exercise**: rendered `CommentItem` + real `ReportDialog` with `features/solutions/actions.ts` mocked.
- **State assertion**: empty reason → `reportComment` call count 0 and alert shown (same as solution variant).
- **Mock boundary rationale**: Server Actions mocked at the module boundary.
- **Residual**: none.

- **Claim** (AC-074, frontend DD v1.6 § Data Contracts `SolutionDetail`): the already-reported state comes from the read, not from a Server Action's return value.
- **Primary failure mode**: the row derives "Đã báo cáo" only from a successful `reportComment` in the current session, so a reporter who reloads (or returns days later) is offered the report control again and sends a duplicate.
- **Boundary to exercise**: `CommentItem` rendered from a literal comment row with `iReported: true` and **no** user interaction and **no** action call.
- **State assertion**: "Bạn đã báo cáo bình luận này." with `aria-disabled="true"` is present on first render; `reportComment` call count is `0`.
- **Mock boundary rationale**: Server Actions mocked (to prove they are *not* called); the `i_reported` column itself is proven on real DB in task 35.
- **Residual**: none on this layer.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: comment sheet only.
- Scope boundary: `ReportDialog.tsx` behaviour unchanged.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
