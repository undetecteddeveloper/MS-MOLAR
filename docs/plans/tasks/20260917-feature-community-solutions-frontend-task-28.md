# Task 28: `CommentSheet` + `CommentItem` + `CommentComposer` — RichText XSS acceptance criterion

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P3-T5
- **Phase**: 3
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P3-T5)
- **Dependencies**: task 07 (P1-T7, `OverlaySheet`/`ConfirmDialog`), task 17 (P2-T5 split 1/2, `AuthorIdentity`), task 26 (P3-T2) — plan labels P1-T7, P2-T5, P3-T2; plus task 21 (P2-T6 split 3/3), because the sheet is mounted on `SolutionViewScreen` and consumes its parsed `?comments=1` flag
- **Provides**: the per-question comment sheet; `CommentItem` extended with "Báo cáo" in task 37 and real avatars in task 46
- **Size**: Medium (plan list: 4 files; plus the one-screen mount wiring below)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, backend DD **v1.9** (the `postComment` / `deleteComment` result unions consumed here), work plan **v1.3**

## Implementation Content

- `CommentSheet` — built on `OverlaySheet` (comment instance, `aria-labelledby` → "Bình luận · Câu k"); states default, empty ("Chưa có bình luận nào…"), loading, error; opened from `SolutionQuestionRow`'s comment button and pre-opened when `SolutionViewScreen` parsed `?comments=1` for question k (task 21). Dirty close with unsent composer text → `ConfirmDialog variant="dirty-close"` (AC-104).
- **The header count comes from `note.commentCount`, never from `comments.length`**: the author's own admin-hidden comment is listed for them but counted nowhere (S19), so the two legitimately disagree.
- `CommentItem` — identity via `AuthorIdentity`; "Người viết" badge from `isSolutionAuthor`; "Xoá" from `isMine` **alone**; comment body `RichText` **dynamic-imported** (`dynamic(…, { ssr: false })` + `warmRichText()` on first open) — never in the first bundle (M12); own visible comment → "Xoá" with `ConfirmDialog` confirm variant; own **admin-hidden** comment (S19) → rendered per UI-D19 (`text-foreground/60` + dashed border — never `opacity` on the whole block) with "Bình luận đã bị ẩn bởi quản trị viên. Lý do: {reason}" (`solutions.comments.hiddenByAdmin`) and **no** "Xoá" control.
- **Masked identity on rows the viewer wrote (AC-105, S4)**: the backend masks comment identity for **every** non-admin viewer, the commenter and the solution's writer included. A row can therefore arrive as `{ kind: "anonymous" }` with `isSolutionAuthor: true` and `isMine: true`; it still renders "Ẩn danh", the "Người viết" badge and "Xoá". No component compares a rendered name with the current user.
- **`bodyNode` is always a real node.** The v1.1/v1.2 "hidden-by-admin and not mine → `bodyNode: null`" branch is **removed**: the backend returns a hidden comment only to its own author, so that combination cannot occur and no component keeps a null-body path.
- `CommentComposer` — "Ẩn danh" checkbox defaults **off** (S18); `lockedAnonymous` (derived from the **solution**: `isMine && !showProfile`, never from the viewer's own display name, which the anonymous header no longer carries) renders the checkbox **checked + `aria-disabled`** with a describing line (`solutions.comments.anonymousLocked`, S4/UI-D12) and always sends `isAnonymous: true`; empty-rejected, too-long (2000), rate-limited states; text and the "Ẩn danh" choice retained verbatim on every error branch (AC-069). The optimistically appended row after a successful send carries the **same masking the server will apply on the next read** — `{ kind: "anonymous" }` whenever `isAnonymous` is true or the composer is locked — so a reload does not change what the row looks like.
- **Send failure (`postComment`)**: `{ code: "generic" }` → `solutions.comments.sendError` ("Chưa gửi được bình luận. Bạn thử lại nhé.") in the composer's `role="alert"` line, the same slot as `solutions.comments.emptyError`; `rateLimited` → `profile.error.rateLimited` with `{seconds}`; `empty` / `tooLong` → the key the action returns. The typed text and the checkbox state never change. This `generic` also covers the backend's `42501` note-gate race (the writer shortened the note between render and send) — the client never names a reason (AC-002).
- **DD-U3 — delete failure (`deleteComment`)**: delete is **non-optimistic**. "Xoá" opens `ConfirmDialog` (`solutions.comments.deleteTitle` / `deleteBody`); while it runs the row carries `aria-busy="true"`. On `{ ok: false }` the **dialog closes**, the **comment stays in the list**, and a `role="alert"` line **under that row** shows `solutions.comments.deleteError` ("Chưa xoá được bình luận. Bạn thử lại nhé.") — or `profile.error.rateLimited` with `{seconds}` — plus a "Thử lại" button (`common.retry`) that calls delete again **with the same comment id** and **without reopening the dialog** (the user already confirmed this exact comment). A later success removes the row and the line with it.
- **DD-U5 — dirty-close "Lưu" (send) failure (Reference Contract Value #24)**: the dialog **stays open** with the failure text in `ConfirmDialog`'s `error` prop (`role="alert"` inside the dialog) and "Lưu" pressable again; the sheet stays open underneath with its text **and its "Ẩn danh" choice** untouched; "Bỏ" and "Ở lại" keep their meanings; nothing is cleared on either layer. A second, successful "Lưu" closes both layers. The dialog's `open` and `error` live in `CommentSheet`; `ConfirmDialog` owns only its internal `busy` flag.
- **No report control in this task.** The comment row's report affordance (both its `iReported` branches) is task 37's; this task must not render "Báo cáo" or "Bạn đã báo cáo bình luận này." and must not add `solutions.comments.report` / `solutions.comments.reported` to `lib/copy.ts` (those two keys belong to task 37 per the frontend DD's owning-task table).
- Add a **comment-body fixture group** to `RichText.xss.test.tsx` (`<script>`, `<img onerror>`, `javascript:` link, HTML in a formula block).
- **Copy keys added here**: the rest of `solutions.comments.*` from the UI Spec list, including the DD-pinned `solutions.comments.sendError` and `solutions.comments.deleteError`.

## Acceptance Criteria

From the plan (§ P3-T5): **AC-068–AC-071, AC-104 (dirty-close, DD-U5), AC-105, AC-107, S4, S18, S19**; Reference Contract Value **#24**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** `postComment` returns `{ code: "generic" }`, the system shows "Chưa gửi được bình luận. Bạn thử lại nhé." in a `role="alert"` line inside `CommentComposer` and keeps the typed text and the "Ẩn danh" choice unchanged. (AC-069)
- **When** `deleteComment` returns `{ code: "generic" }`, the system closes the confirm dialog, keeps the comment in the list, and shows "Chưa xoá được bình luận. Bạn thử lại nhé." plus a "Thử lại" button in a `role="alert"` line under that comment. (AC-070, DD-U3)
- **While** a comment is the solution author's own on an anonymous solution, or is any commenter's own anonymous comment, it renders as "Ẩn danh" for that same viewer, keeps the "Người viết" badge when `isSolutionAuthor` is true, and still renders "Xoá" when `isMine` is true. (AC-105, S4, D42)
- **When** the viewer is the writer of an anonymous solution, `CommentComposer` renders the "Ẩn danh" checkbox checked with `aria-disabled="true"` and sends `isAnonymous: true` regardless of user interaction. (S4, S18, UI-D12)
- **If** a comment row carries `isHiddenByAdmin`, **then** it renders in the `UI-D19` dimmed variant with its reason and **no** "Xoá" button; there is no code path that renders a hidden comment for a viewer other than its author. (S19, AC-070, AC-107)
- **If** the "Lưu" choice of the 3-choice dirty-close dialog fails, **then** the dialog stays open with the failure text in a `role="alert"` line inside it and "Lưu" pressable again, and the sheet stays open underneath with its text and its "Ẩn danh" choice unchanged. (AC-104, DD-U5)

Carried hard constraints that apply to this task:
- **ADR-0002 (explicit acceptance criterion)**: comment content renders only through the existing `SOURCE/components/shared/RichText.tsx`; the `RichText.xss.test.tsx` comment-body fixture group is green **in this commit** (M8). No `dangerouslySetInnerHTML`.
- No static `import { RichText }` in any `"use client"` file under `SOURCE/features/solutions/`; `warmRichText()` modelled on `SOURCE/features/authoring/components/QuestionEditor.tsx` (~71–90), not imported from it (B4).
- Actions only via `SOURCE/features/solutions/actions.ts`; identity only via `AuthorIdentity`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`comments.*` keys); 360px floor; 44px touch targets; "Đêm hội" tokens only (hidden comment `text-foreground/60` on `--surface`, 6.6:1); motion only via `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/CommentSheet.tsx` (new)
- [x] `SOURCE/features/solutions/components/CommentItem.tsx` (new)
- [x] `SOURCE/features/solutions/components/CommentComposer.tsx` (new)
- [x] `SOURCE/components/shared/__tests__/RichText.xss.test.tsx` (add comment-body fixture group)

Integration edit (mount point required for the sheet to be reachable):
- [x] `SOURCE/features/solutions/components/SolutionViewScreen.tsx` (open `CommentSheet` from the row callback and from the parsed `?comments=1` flag)

Additional integration edits beyond the literal list above, both required for the
mount to have real data to show (see Investigation Notes "Integration handoff"):
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/[solutionId]/page.tsx` — thread `question.comments` into `SolutionViewQuestionNode.comments` (new optional field) and fetch/pass `viewerIdentity` (via already-cached `getCurrentUserProfile()`)
- [x] `SOURCE/features/solutions/components/__tests__/SolutionViewPage.test.tsx` — added a `getCurrentUserProfile` mock so the pre-existing tests keep compiling/passing after the page.tsx change above
- [x] `SOURCE/lib/copy.ts` — added the rest of `solutions.comments.*`

Supporting tests:
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/` (new: `CommentSheet.test.tsx`, `CommentItem.test.tsx`, `CommentComposer.test.tsx`; extended: `SolutionViewScreen.test.tsx` with 2 new describe blocks for Required Tests #7/#11)

## Investigation Targets
- `SOURCE/components/shared/OverlaySheet.tsx`, `SOURCE/components/shared/ConfirmDialog.tsx` (task 07)
- `SOURCE/features/solutions/components/AuthorIdentity.tsx` (task 17)
- `SOURCE/features/solutions/components/SolutionViewScreen.tsx`, `SolutionQuestionRow.tsx` (tasks 20/21 — `onOpenComments`, parsed `?comments=1`)
- `SOURCE/features/solutions/components/FormulaPreview.tsx` (task 11 — the existing `dynamic` + `warmRichText` pattern inside this feature)
- `SOURCE/features/solutions/actions.ts` (`postComment`, `deleteComment` result shapes, task 26)
- `SOURCE/components/shared/RichText.tsx`, `SOURCE/components/shared/__tests__/RichText.xss.test.tsx` (task 11's note group as the shape to mirror)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `CommentSheet` / `CommentItem` / `CommentComposer`, incl. "Send failure", "Delete" (DD-U3) and the admin-hidden-comment paragraph)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Comment-authoring contract"; `SolutionDetail` comment-row invariants: masked own rows, `bodyNode` always present, `note.commentCount` vs `comments.length`)
- `docs/design/community-solutions-frontend-design.md` (§ Client State Design — "Pending state (non-optimistic, v1.2/v1.3)": who owns the delete `busy`/`error` and the dirty-close dialog's `open`/`error`)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "`CommentComposer` / `CommentItem` component tests", "Identity self-masking tests", "Hidden-comment tests", "Dirty-close failure tests")
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `RichText` two consumption patterns: server-direct, dynamic import)
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra rows and the "Overlay dirty-close" row, DD-U5)
- `docs/design/community-solutions-backend-design.md` v1.9 (§ Data Contracts — the user-write RPCs' "Error signalling": every refusal reaches the client as `{ code: "generic" }`)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: OverlaySheet — verify open + closing (usePresence) + dirty-close states, comment instance)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentSheet — verify default + empty + loading + error states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentItem — verify default + own-hidden-comment (S19) + delete-confirm states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: CommentComposer — verify default + empty-rejected + too-long + rate-limited + locked-anonymous (S4) states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: AuthorIdentity — verify named + anonymous states)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D10`, `UI-D12`, `UI-D19`; golden state 11)
- `docs/adr/ADR-0002-published-content-rendering-and-sanitization.md`
- `docs/prd/community-solutions-prd.md` (AC-068–AC-071, AC-104, AC-105, S4, S18, S19)

## Boundary Context
(From the work plan's Connection Map — "Rate-limit rejection → client copy")
- **Serialized format**: plain number in the Server Action's JS return value (same-process).
- **Consumer parse rule**: interpolated verbatim into `profile.error.rateLimited`; input/state untouched.
- **Expected signal**: `role=alert` line with `{seconds}`; unsent comment text never cleared.
- **Roundtrip check**: the `seconds` number `postComment` returns appears verbatim in the composer's alert, and the textarea value is unchanged.

## Investigation Notes

- `OverlaySheet`/`ConfirmDialog` (task 07): shell pure component, `open`/`onRequestClose: () => "closed"|"kept"`; `ConfirmDialog` variants `confirm`/`dirty-close`, manages its own `busy`, never auto-closes — caller decides `open` after `onConfirm` settles, and `error` is the caller's to set. Confirmed via source read.
- `AuthorIdentity` (task 17): `{identity, size, isSolutionAuthor?}` — `isSolutionAuthor` prop declared but UNUSED by the component itself (task 17 left it for a later consumer to render the badge externally). This task follows that precedent: `CommentItem` renders the "Người viết" `Badge` itself, beside `<AuthorIdentity>`, not inside it.
- `SolutionQuestionRow`/`SolutionViewScreen` (tasks 20/21): row already emits `onOpenComments(questionId)` and reads `note.commentCount` (never `comments.length`) for its own header text — that existing code is untouched by this task. `SolutionViewScreen`'s prior placeholder `onOpenComments={() => {}}` and unused `initialCommentsOpen` prop are now wired.
- `FormulaPreview` (task 11): the exact `dynamic(...,{ssr:false})` + `warmRichText()` + manual `import()` state-tracking pattern this task mirrors for `CommentItem`/`CommentSheet` — modelled on it (not imported from it, B4).
- `actions.ts` (task 26, committed): `postComment(solutionId, questionId, body, isAnonymous)` returns `{ok:true, comment: PostedComment}` (raw `body: string`, no author fields) or `{ok:false, error:{code:"empty"|"tooLong"|"rateLimited"|"generic", seconds?}}`. `deleteComment(commentId)` returns `{ok:true}` or `{ok:false, error:{code:"rateLimited"|"generic", seconds?}}`.
- `RichText.tsx`/`RichText.xss.test.tsx` (task 11's note group): mirrored shape for the new comment-body fixture group (4 vectors), green in this commit.
- `queries.ts` (already committed by an earlier task, not this one): `SolutionDetailComment` interface already exists — `{id, author, isSolutionAuthor, isMine, body: string, isHiddenByAdmin?, hiddenReason?, iReported, createdAt}`. `body` is RAW markdown (NOT a pre-rendered `bodyNode` like `note.body`→`note.bodyNode`) — this is exactly why `CommentItem` needs the dynamic RichText import (M12), unlike `note.bodyNode`/`stemNode` which are server-prerendered (UI-D22). `SolutionDetailQuestion.comments: SolutionDetailComment[]` already exists on the query layer but was **not yet threaded through `page.tsx` → `SolutionViewScreen`** before this task.

**Integration handoff (page.tsx, beyond the task's literal Target Files list):** `SolutionViewScreen`'s mount cannot show real comments without a data path from `page.tsx`'s already-fetched `SolutionDetail.questions[].comments` down through `SolutionViewQuestionNode`. This is the same object `page.tsx`'s `buildQuestionNode()` already builds for `note`/`stemNode` — I added one more field (`comments: question.comments`, passed through unmodified, no ReactNode-building needed since `CommentItem` renders it client-side). Similarly, the composer's "named" optimistic-append case needs the viewer's own display identity (frontend DD § Comment-authoring contract: "the composer already knows the current user's own identity"), which `page.tsx` now supplies via the already-cached `getCurrentUserProfile()` (called elsewhere per-request already, `React.cache()`-deduped, zero extra round-trip) as a new `viewerIdentity` prop. Both new fields (`SolutionViewQuestionNode.comments` and `SolutionViewScreenProps.viewerIdentity`) are declared **optional** with safe defaults (`[]` / `{kind:"anonymous"}`) specifically so `SolutionViewScreen.test.tsx`'s existing fixtures (task 20-22, not touched) keep compiling unchanged. `SolutionViewPage.test.tsx` (task 21) DID need one addition — a `getCurrentUserProfile` mock — since it renders the real, unmocked `page.tsx`.

**Binding Decisions evaluation (informal — no formal table in this task file, but recorded per the 5 binding rules given in the invocation prompt):**
1. ADR-0002/M12 dynamic import — planned approach: `dynamic(...,{ssr:false})` + `warmRichText()` defined once in `CommentItem.tsx` (module scope), no static `import {RichText}` anywhere under `features/solutions/**`. Evaluation: **Y** (verified: `grep` for static RichText import inside `features/solutions` only matches the two pre-existing non-"use client" files, `SolutionNoteBlock.tsx`/`writerQuestionNodes.tsx`, neither touched by this task).
2. AC-105/S4 masked-own-row — planned approach: `CommentItem` reads only `isMine`/`isSolutionAuthor`/`author.kind`, no name comparison anywhere. Evaluation: **Y** (Required Test #3 green).
3. `lockedAnonymous` derivation — planned approach: computed in `SolutionViewScreen` as `solution.isMine && solution.author.kind === "anonymous"`, passed down; checkbox `checked` always reflects it, `onChange` no-ops when locked, submitted value always effectively-true when locked. Evaluation: **Y** (Required Test #4 green).
4. DD-U3 non-optimistic delete — planned approach: `CommentItem` never calls `onDeleted` until `deleteComment` resolves `{ok:true}`; on failure the `ConfirmDialog` always closes but the row/error/retry stay, retry reuses the same `comment.id`. Evaluation: **Y** (Required Test #2 green).
5. DD-U5 dirty-close failure (Reference Contract #24) — planned approach: `performSend()` never sets either error state itself; the dirty-close caller (`confirmDirtySave`) sets only `dirtyError`, the normal-send caller (`handleSendClick`) sets only `sendError` — so a dirty-close failure never touches the composer's own alert line. Evaluation: **Y** (Required Test #8 explicitly asserts exactly one occurrence of the failure text, inside the dialog).

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P3-T5 "Task 28 tests")

`@/features/solutions/actions` is mocked at the module boundary; `lib/solutions/identity.ts` and `RichText` stay real.

1. **Send `generic`**: `postComment` → `{ code: "generic" }` renders "Chưa gửi được bình luận. Bạn thử lại nhé."; the textarea value **and** the "Ẩn danh" checkbox state are unchanged.
2. **Delete `generic` (DD-U3)**: `deleteComment` → `{ code: "generic" }` closes the dialog, **keeps the comment in the list**, shows "Chưa xoá được bình luận. Bạn thử lại nhé." under that row, and pressing "Thử lại" calls `deleteComment` again **with the same id** (and does not reopen the dialog).
3. **Masked own row (AC-105, S4)**: a comment with `author: { kind: "anonymous" }`, `isSolutionAuthor: true`, `isMine: true` renders "Ẩn danh", the "Người viết" badge and the "Xoá" button, and renders **no** display name anywhere in the row.
4. **`lockedAnonymous` (S4, UI-D12)**: the composer renders the "Ẩn danh" checkbox checked with `aria-disabled="true"` and its describing line; the optimistically appended row after a successful send is "Ẩn danh" as well.
5. **"Ẩn danh" default**: with `lockedAnonymous` false, the checkbox is unchecked on first render (S18).
6. **Hidden own comment (S19, UI-D19)**: a row with `isHiddenByAdmin: true`, `hiddenReason: "…"`, `isMine: true` renders the dimmed variant with the reason and **no** "Xoá" button.
7. **Count comes from `commentCount`**: a question whose `note.commentCount` is `3` while `comments.length` is `4` renders "3 bình luận".
8. **Dirty-close failure (DD-U5)**: with the sheet dirty, closing opens the 3-choice dialog; a failed "Lưu" leaves the dialog **open** with a `role="alert"` message inside it and "Lưu" pressable again, and leaves the sheet's textarea value **and** the "Ẩn danh" checkbox state unchanged; a second "Lưu" that succeeds closes **both** layers.
9. **Rate limit**: `postComment` → `{ code: "rateLimited", seconds }` renders `profile.error.rateLimited` with that number verbatim; text and checkbox unchanged.
10. **Empty body**: sending an empty/whitespace body renders `solutions.comments.emptyError` and calls no action.
11. **Deep link**: `?comments=1` for question k opens the sheet for that question (mount wiring in `SolutionViewScreen`).
12. **No report control here**: the rendered row matches neither `/Báo cáo/` nor `/Bạn đã báo cáo/` — that affordance is task 37's.
13. **XSS**: the comment-body fixture group in `RichText.xss.test.tsx` is green **in this commit** (M8, ADR-0002).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Add the comment-body XSS group; it exercises the existing sanitizer — escalate if any case fails before implementation (all 4 passed against the existing sanitizer, no escalation needed)
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement the three components and the screen mount
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] One `LazyRichText` definition shared by `CommentItem` instances
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `components/shared/__tests__/RichText.xss.test.tsx` — Covers: comment rendering (M8)
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — J1 / Test 2 (S-03, S-05) must stay green after the screen mount
- `next build` (manual manifest read) — markdown/KaTeX chunk absent from the view route's first bundle (formal measurement task 48)
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `test:fixture` inside `SOURCE/`; on the dev server as an eligible user open a solution, open a question's comments, post a named and an anonymous comment, delete one's own comment.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: comment XSS group green; component tests green; comments post/delete/anonymize end to end against real dev Postgres (Phase 3 exit criterion).
- **Failure response**: if the sheet requires a static RichText import, stop — dynamic import is binding (M12).
- **Verification level**: L1 (post/delete/anonymize on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (S4, verbatim): "bình luận của chính người viết trên bài giải của mình luôn mang nhãn 'Người viết'... bài đang ẩn danh → bình luận của người viết hiện 'Ẩn danh' bất kể lựa chọn ẩn danh của từng bình luận (ô 'Ẩn danh' khoá bật)."
- **Primary failure mode**: the writer comments on their own anonymous solution with "Ẩn danh" unchecked, revealing the solution's author through the comment identity.
- **Boundary to exercise**: rendered `CommentComposer` + `CommentItem` with fixture props (writer on anonymous solution).
- **State assertion**: composer checkbox `checked` and `aria-disabled="true"`; the rendered writer comment shows "Người viết" + anonymous identity and no name/avatar.
- **Mock boundary rationale**: `features/solutions/actions.ts` mocked at the module boundary.
- **Residual**: server-side enforcement of S4 is the RPC/policy's concern (tasks 25/27).

- **Claim** (Failure Mode #3, empty input / AC-069): an empty comment is rejected client-side and the text is retained verbatim on every error branch.
- **Primary failure mode**: a failed post clears the textarea, losing the user's comment.
- **Boundary to exercise**: rendered `CommentComposer` with `postComment` mocked to return empty-rejected, rate-limited, and infra errors in turn.
- **State assertion**: textarea value before = after for each error branch.
- **Mock boundary rationale**: Server Actions mocked.
- **Residual**: none.

- **Claim** (DD-U3, frontend DD § Main Components "Delete"): a failed delete never removes the comment from the screen.
- **Primary failure mode**: the row is removed optimistically (or on any settled promise), so a refused delete looks like a success and the comment reappears only on the next navigation.
- **Boundary to exercise**: `CommentItem` + `ConfirmDialog` with `deleteComment` mocked to fail once, then succeed.
- **State assertion**: after the failure the dialog is closed, the comment is still in the list, the alert + "Thử lại" are under that row, and "Thử lại" calls `deleteComment` with the same id; after the success the row and the line are both gone.
- **Mock boundary rationale**: Server Actions mocked at the module boundary.
- **Residual**: the server-side refusal itself is proven in task 27.

- **Claim** (Reference Contract Value #24, DD-U5, verbatim): "The **dialog stays open** with the failure text in its `error` prop (`role="alert"` inside the dialog) and "Lưu" pressable again; the sheet stays open underneath with its text and its "Ẩn danh" choice untouched; "Bỏ" and "Ở lại" keep their meanings. Nothing is cleared on either layer."
- **Primary failure mode**: a failed send closes the dialog or the sheet and the typed comment (or the "Ẩn danh" choice) is lost — the silent-data-loss case AC-104 exists to prevent.
- **Boundary to exercise**: `CommentSheet` + `ConfirmDialog` with `postComment` mocked to fail once, then succeed.
- **State assertion**: dialog still in the DOM with a `role="alert"` inside it; textarea value and checkbox state equal their pre-press values; the second, successful "Lưu" removes both layers.
- **Mock boundary rationale**: Server Actions mocked; `ConfirmDialog` renders for real.
- **Residual**: the note-sheet twin of this behaviour is task 11.

- **Claim** (ADR-0002 / M8): comment bodies render only through sanitized `RichText`.
- **Primary failure mode** (fixture skeleton Test 3): "a future change to the note/comment render path bypasses RichText (e.g. a raw dangerouslySetInnerHTML shortcut), or RichText's sanitizer regresses."
- **Boundary to exercise**: `RichText.xss.test.tsx` comment group (unit) with real `RichText`.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: browser-level proof through the real screen is task 31.

## Completion Criteria
- [x] All added tests pass, including the `RichText.xss.test.tsx` comment-body group (explicit acceptance criterion)
- [x] Operation verified per Operation Verification Methods above — L2 fully done (see below); **L1 deferred** (sign-in-gated, see report)
- [x] Each Proof Obligation is met (evidence: Required Tests #2/#3/#4/#6/#8/#13, all green)

## Notes
- Impact scope: task 30 proves anonymity in this sheet at browser level; task 31 proves XSS inertness; task 37 adds "Báo cáo"; task 46 wires avatars.
- Scope boundary: `SolutionViewScreen.tsx` changes are limited to mounting the sheet.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
