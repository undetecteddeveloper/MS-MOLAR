# Task 10: `SolutionEditorScreen` + write route + `attemptId` URL boundary

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P1-T9 (split 2/2) — the plan entry lists 9 target files (> 5), so it is split: task 09 = child components; this file = the screen that owns state, the route files, and the `attemptId` boundary
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T9)
- **Dependencies**: task 04 (P1-T4, `saveSolution`/`setSolutionStatus`/`getMySolutionForWriter`), task 09 (P1-T9 split 1/2); transitively task 01 and task 07
- **Provides**: route `/exams/[id]/attempt/[attemptId]/solution` and `SolutionEditorScreen` (keyed `useReducer`), consumed by tasks 11, 23, 39
- **Size**: Medium (5 files + component tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, backend DD **v1.9** (the `setSolutionStatus` / `saveSolution` result unions this screen consumes), work plan **v1.3**

## Implementation Content

- Route `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page.tsx` (Server Component): read `attemptId` from the **path segment** (UI-D1 — never a hidden state field); server re-validates that the attempt belongs to the caller and is `submitted` before rendering; otherwise redirect per S11. Loads data via `getMySolutionForWriter(examId)`.
- **Writer load branches (frontend DD § Data Contracts "Writer load contract")** — three cases, no fourth:
  - `null` (the RPC returned zero rows: no submitted attempt / exam not published / exam author banned) → `redirect("/exams/<id>")` **before any client component renders**; no editor markup, no "not eligible" message, no hint about why (AC-002 non-leak). A thrown query error is *not* converted into a redirect — it reaches `error.tsx`.
  - `solutionId === null` (and therefore `status === null`) → render the editor's **"none" state**: every note `""`, "Hiện hồ sơ" on, "Hiện điểm" off, **no status badge**.
  - `solutionId` set → render with the saved notes and `status`.
- `loading.tsx` / `error.tsx` for the route (UI Spec `SolutionRouteLoading` / `SolutionRouteError`: `aria-busy` + sr-only "Đang tải"; `role="alert"`, `tabIndex={-1}`, focused).
- `SolutionEditorScreen` — keyed `useReducer` (`SolutionEditorState`): saving note `i` re-renders only row `i` + progress bar + bottom bar (NFR Hiệu năng). Publish is **non-optimistic**: the published state appears only after `setSolutionStatus` resolves successfully. A rejected save/publish never clears `state.questions[i].note`.
- **`status: SolutionStatus | null` (frontend DD v1.6)** — `type SolutionStatus = "draft" | "published" | "hidden"`, and the reducer's state type carries `SolutionStatus | null`. `status === null` holds **if and only if** `solutionId === null`. A component rendering the status badge must handle `null` by rendering **no badge**; an unguarded `solutions.status.${status}` key is a `tsc` error, which is the rule's own proof. The mapper (backend task 04) copies the backend's SQL `null` as-is — this screen never substitutes `"draft"`.
- **Publish refusal (Reference Contract Values #11, #27; frontend DD § Error Handling "Validation (word count, client mirror)")**: `setSolutionStatus(examId, "publish")` resolves to `{ ok: true, status: "published" }` or `{ ok: false, error: { code: "belowWordCount", missingCount: number } | { code: "rateLimited", seconds } | { code: "generic" } }` — **backend DD v1.9's pinned union; there is no `notEligible` and no `hidden` code**. On `belowWordCount` the screen renders `solutions.bar.remaining` in a `role="alert"` line above the bar's button row with `{count}` = `error.missingCount` **from the result** and `{total}` = the current-question count the screen already holds. The count is **never** recomputed on the client from `countWords()` state and **never** parsed out of the exception message; a DETAIL the action could not parse arrives as `{ code: "generic" }`, so the bar has no branch for a `belowWordCount` without a count. On `belowWordCount` and on `generic` alike, the status badge, both bar buttons and every note body stay unchanged.
- **Other error surfaces owned here**: `generic` from `setSolutionStatus` (the backend's `42501` "not submitted" / "exam not visible" / "solution is hidden", which the client never names) → the bar's generic line for "Đăng", and `ConfirmDialog`'s `error` prop for "Gỡ về nháp" with the dialog staying open and the status unchanged; `rateLimited` → `profile.error.rateLimited` with `{seconds}`; a `saveSolution` failure triggered by a `SettingSwitch` change → `solutions.editor.settingsSaveError`, and by the bar's "Lưu nháp" → `solutions.note.saveError`.
- `ModerationReasonBanner` gains the `alert` variant (`role="alert"`), wired into the screen but exercised fully in task 39.
- Composes task 09's `SolutionEditorHeader`, `SolutionSettingsPanel`, `NoteQuestionRow`, `SolutionPublishBar`. The read-only settings row uses task 09's `SettingSwitch.lockReasonId`.
- **Copy keys added here** (frontend DD § Vietnamese Copy Keys owning-task table, verbatim UI Spec values, cited by key name): `solutions.routeError`, `solutions.hiddenBanner`, `solutions.toast.*`, `solutions.unpublish.*`, and the DD-pinned `solutions.editor.settingsSaveError` ("Chưa lưu được cài đặt. Bạn thử lại nhé."). `solutions.bar.remaining` and the rest of `solutions.bar.*`/`solutions.row.*` are added by task 09 and only consumed here.

## Acceptance Criteria

From the plan (§ P1-T9), rows that apply to these files: **AC-042, AC-030 (screen/state half), AC-027 + AC-028 (composition)**; Reference Contract Values **#7, #11, #17, #27**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **If** `getMySolutionForWriter(examId)` returns `null`, **then** the write route redirects to `/exams/[id]` before rendering any editor content; **when** it returns a state with `solutionId === null`, the route renders the empty writer. (AC-002, AC-004, S11)
- **When** `community_solution_for_writer` returns the "no solution yet" row, the write route renders the editor's "none" state: every note textarea empty, "Hiện hồ sơ" on, "Hiện điểm" off, and **no** status badge. (AC-053, R6)
- **When** `setSolutionStatus(examId, "publish")` returns `{ ok: false, error: { code: "belowWordCount", missingCount } }`, the screen renders a `role="alert"` line above the publish bar's button row reading `solutions.bar.remaining` with `{count}` = `error.missingCount` and `{total}` = the current-question count, leaves the status badge and both buttons unchanged, and leaves every note body untouched. (AC-029, UI Spec `C-14` AC-029 row)
- **When** the publish refusal is surfaced, the number comes from the result's structured `missingCount` only — never from the refusal's exception message and never from a count recomputed on the client. (AC-029)
- **When** `setSolutionStatus` returns `{ code: "generic" }`, the current status badge and bottom-bar state stay unchanged and the error shows in a `role="alert"` line on the surface that triggered it (`SolutionPublishBar` for "Đăng", the open `ConfirmDialog` for "Gỡ về nháp"). (AC-029, AC-033, AC-002)

Carried hard constraints that apply to this task:
- **Task 01 must have landed** before creating files under `SOURCE/features/solutions/components/**`.
- Components call only `SOURCE/features/solutions/{queries,actions}.ts`.
- Vietnamese strings only via `SOURCE/lib/copy.ts`; 360px floor; 44px touch targets; "Đêm hội" tokens only from `SOURCE/app/globals.css`; motion only via existing `.motion-*` / `usePresence`; never fade page content on load.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionEditorScreen.tsx` (new)
- [x] `SOURCE/features/solutions/components/ModerationReasonBanner.tsx` (extend: `alert` variant)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/page.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/loading.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/error.tsx` (new)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/` (+ route test under the route's own `__tests__/`, § Notes)

## Investigation Targets
- Task 09 deliverables: `SOURCE/features/solutions/components/{SolutionEditorHeader,SolutionSettingsPanel,NoteQuestionRow,SolutionPublishBar}.tsx`
- `SOURCE/features/solutions/components/ModerationReasonBanner.tsx` (task 08, status variant)
- `SOURCE/features/solutions/actions.ts`, `SOURCE/features/solutions/queries.ts` (task 04 — result/error shapes)
- `SOURCE/app/(analytics)/profile/loading.tsx`, `SOURCE/app/(analytics)/profile/error.tsx` (existing route loading/error conventions)
- `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx` (how the result route validates attempt ownership)
- `docs/design/community-solutions-frontend-design.md` (§ Technical Dependencies — Slice B)
- `docs/design/community-solutions-frontend-design.md` (§ Client State Design — `SolutionEditorState` `useReducer`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — SolutionEditorScreen draft state)
- `docs/design/community-solutions-frontend-design.md` (§ State Transitions — client-perceived lifecycle mirrors backend, non-optimistic publish)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `attemptId`/`q`/`comments`/`tab` URL params)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Writer load contract" and Note-authoring contract "Mapper rules" / "Consumers of status === null")
- `docs/design/community-solutions-frontend-design.md` (§ UI Action - API Contract Mapping — the `setSolutionStatus` "Đăng" and "Gỡ về nháp" rows, and the `saveSolution` row for the settings switch)
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra/dirty-close rows)
- `docs/design/community-solutions-frontend-design.md` (§ Acceptance Criteria — "Mapper rules for score-gated fields, empty notes and the no-solution status (v1.6)" and the v1.5 publish-refusal rows; § Test Boundaries — "Publish refusal count test", "No-solution state tests", "Zero-row read branches")
- `docs/design/community-solutions-backend-design.md` v1.9 (§ Main Components `actions.ts` — the `setSolutionStatus` / `saveSolution` result unions consumed here)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionEditorScreen — verify none + draft + published states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteLoading (loading.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteError (error.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D1`, `UI-D25`; § Yêu cầu trợ năng rows `C-15`, `C-40`, `C-41`)
- `docs/prd/community-solutions-prd.md` (AC-027, AC-028, AC-030, AC-042)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — SolutionEditorScreen draft state) | state-lifecycle-negative | "a rejected save/publish never clears `state.questions[i].note` — the reducer only applies a server response on success; on failure it dispatches an error message... leaving the draft text untouched (AC-032)" | After a mocked failing `saveSolution` or `setSolutionStatus`, `state.questions[i].note` deep-equals its pre-call value and an error message is present in state |
| Work plan § Reference Contract Values #11 (backend DD v1.9 § Main Components `actions.ts`) | result-union | "`setSolutionStatus(examId, action)` → `{ ok: true, status }` \| `{ ok: false, error: { code: \"belowWordCount\", missingCount: number } \| { code: \"rateLimited\", seconds: number } \| { code: \"generic\" } }`." | The screen's publish handler switches over exactly these three codes; `tsc` shows no `notEligible`/`hidden` branch anywhere in the file |
| Work plan § Reference Contract Values #17 (backend DD v1.9 § Data Contracts `community_solution_for_writer`) | state-lifecycle-negative | `status` "is `null` there and only there, so it is `null` if and only if `solution_id` is `null`. The mapper copies that `null` as-is into `SolutionEditorState.status: SolutionStatus \| null`" | A state with `solutionId: null, status: null` renders no status badge; the reducer's state type is `SolutionStatus \| null` and no code path substitutes `"draft"` |
| Work plan § Reference Contract Values #27 (frontend DD v1.6 § Test Boundaries, task 10) | derived-display | Publish refusal line: "Còn 3 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được." (`solutions.bar.remaining`, `{count}` = `missingCount`, `{total}` = current questions) | A mocked `{ code: "belowWordCount", missingCount: 3 }` with 12 current questions renders that exact sentence in a `role="alert"`; a mocked `missingCount: 5` against client state that would compute `0` still renders "Còn 5 câu" |

## Boundary Context
(From the work plan's Connection Map — "URL query string (`?q`, `?comments`, `?tab`) + `attemptId` path segment"; this task owns the `attemptId` half)
- **Producer**: link-generating components (the result page's `SolutionEntryCard`, task 08).
- **Consumer**: this route's Server Component parse (`SolutionEditorPage`).
- **Serialized format** (verbatim): "`[attemptId]` dynamic segment (opaque UUID)".
- **Consumer parse rule** (verbatim): "server re-validates `attemptId` ownership+submitted status, never trusts the URL alone".
- **Expected signal**: a valid own submitted attempt renders the editor; any other `attemptId` (someone else's, unsubmitted, malformed) redirects per S11 without rendering editor content.
- **Roundtrip check**: the `attemptId` the entry card writes into the link parses to the same attempt the server re-validates and the solution links to (AC-042 — score/original answers come from the attempt linked to the solution).

## Investigation Notes
(Append observations here before implementation begins. Record the Reference Contract Compliance Check result.)

- Task 09 deliverables (`SolutionEditorHeader`, `SolutionSettingsPanel`, `NoteQuestionRow`, `SolutionPublishBar`) read in full. Key interfaces: `SolutionEditorHeader({status, questionStates: NoteRowState[], onJump})` derives its own `a/N` count via `questionStates.filter(s => s === "noted")` — a "changed" row does NOT count toward `a` (consistent with UI-D26's 3-way cell classification, which this task's `deriveRowState()` mirrors: `hasChanged` wins over word-count classification). `SolutionSettingsPanel` has **no** `error` prop — a settings-save failure must be rendered by the caller (this task renders a `role="alert"` line immediately after the panel). `SolutionPublishBar` has no dedicated "0 current questions" branch — its `incompleteCount`/`error` props are the only override surface, so this task forces `incompleteCount=1` and `error=t("solutions.emptyExam")` when `totalCount===0` to reach the UI Spec's Rỗng behavior (Đăng aria-disabled with that reason) without editing the out-of-scope file. `SolutionPublishBar`'s own `status==="hidden" → null` branch already covers "Bị ẩn ⇒ no bottom bar" — no extra guard needed here.
- `ModerationReasonBanner` (task 08) read in full — `status` variant unchanged; added `variant?: "status"|"alert"` (default `"status"`, backward compatible) and an optional `id` prop (needed for `SolutionSettingsPanel.lockReasonId`'s `aria-describedby` target).
- `actions.ts`/`queries.ts` (task 04) read in full. `saveSolution`/`setSolutionStatus` result unions copied verbatim (no `notEligible`/`hidden`). `SolutionEditorQuestion` (`queries.ts`) carries `stem`/`correctAnswer`/`myResult` as `unknown` — task 04's own Investigation Notes record this as a deliberate scope-narrowing concretization deferring `ReactNode` production (UI-D22) to "the owning frontend task"; re-checked against *this* task's Investigation Targets/Required Tests/Reference Contracts and **none** of them exercise stem/correctAnswer/myResult rendering (`NoteQuestionRow` only ever reads `note`/`wordCount`/`hasChanged`). Applying the same resolution here: these three fields stay `unknown`, unrendered, passed through opaquely in `EditorQuestion` — UI-D22's actual rendering is deferred again, now to task 11's `QuestionAnswerSummary` (the first real consumer).
- `(analytics)/profile/loading.tsx` / `error.tsx` read for the route-loading/error convention (`aria-busy` + sr-only `common.loading`; `role="alert"` + `tabIndex={-1}` + focus-on-mount + `reset()`). Reused verbatim for the three new route files (`solutions.routeError` in place of `profile.error.generic`).
- `result/page.tsx` read for the attempt-ownership pattern: `getResult(attemptId)` filters by `attemptId` directly (RLS + explicit `published` filter) and returns `null` on any mismatch → `redirect`. `getMySolutionForWriter(examId)` has **no** `attemptId` parameter — it derives the caller's own linked-or-latest-submitted attempt server-side and returns it as `state.attemptId` (frontend DD § Data Contracts "Note-authoring contract": "the attempt this solution IS (or would be) linked to"). The Boundary Context re-validation is therefore implemented as `state.attemptId !== attemptId (URL) → redirect` in `page.tsx` — this covers foreign/unsubmitted/malformed segments identically, because none of them can equal the value the RPC itself derived.
- Frontend DD §§ Data Contracts ("Writer load contract", "Note-authoring contract" incl. Mapper rules/Consumers of status===null), Field Propagation Map (`attemptId` row), State Transitions, Client State Design, UI Action-API Contract Mapping, Error Handling, and the Vietnamese Copy Keys owning-task table all read in full. UI Spec §§ SolutionEditorScreen/Header/SettingsPanel/PublishBar/ModerationReasonBanner/SolutionRouteLoading/SolutionRouteError, UI-D1/UI-D22/UI-D25/UI-D26 read in full.
- **Unimplemented Dependency Handling (NoteSheet, task 11) — local, reversible construct.** `SolutionEditorScreen`'s Dependencies list (`NoteQuestionRow`, `NoteSheet`, `SolutionSettingsPanel`, `SolutionPublishBar`, ...) names `NoteSheet`, which does not exist yet (task 11's own scope, "Notes: task 11 adds the note sheet"). Required Test #9 (keyed re-render on saving note *i*) and, less strictly, #7 (failed save keeps the draft) need a way to save an individual note. Resolution: `NoteQuestionRow.onOpen` dispatches `OPEN_NOTE` (sets `state.activeNote`), and `SolutionEditorScreen.tsx` renders a **minimal internal scaffold** (`NoteEditorScaffold`, not exported, not a new file — plain `<textarea>` + Lưu/Đóng, no RichText/FormulaPreview/dirty-close `ConfirmDialog`) that calls `saveSolution(examId, {..., notes: [{questionId, body}]})` for exactly one question. Integration handoff for task 11: replace `NoteEditorScaffold`'s conditional block with `<NoteSheet .../>`, reusing `state.activeNote`/the exported `saveNote`-shaped dispatch actions (`OPEN_NOTE`/`CLOSE_NOTE`/`NOTE_SAVE_START`/`NOTE_SAVE_SUCCESS`/`NOTE_SAVE_FAILURE`) already defined in `solutionEditorReducer` — task 11 does not need to touch the reducer, only swap the rendered scaffold for the real sheet component. Test 7 itself uses the simpler "Lưu nháp" (whole-draft save) path, which needs no scaffold.
- **Generic bar/dialog copy key resolution.** Neither the UI Spec's "Chuỗi tiếng Việt cần thêm" list nor this task's own "Copy keys added here" list names a distinct key for "Đăng"/"Gỡ về nháp" generic failures — the DD's Error Handling row only says "the bar's generic line for a status change" without pinning a literal. Resolution: reuse `solutions.note.saveError` ("Chưa lưu được. Bạn thử lại nhé.") for `saveSolution` generic (Lưu nháp/settings-switch fallback text differs: `solutions.editor.settingsSaveError`) **and** for `setSolutionStatus` generic (Đăng/Gỡ về nháp), consistent with the DD's own framing of it as "the component's own generic key" reused across those three surfaces; per the DD's general owning-task rule ("first task in execution order that renders it"), this task adds `solutions.note.saveError` even though its namespace visually groups with task 11's `NoteSheet` keys — task 11 only consumes it.
- `common.close` ("Đóng") and `solutions.editor.crumb` ("Bài giải của bạn") are UI-Spec-listed keys with no earlier renderer (task 09's four components never render a breadcrumb or a close button) — added here under the same "first renderer" rule.

### Reference Contract Compliance Check
| # | Result | Evidence |
|---|---|---|
| state-lifecycle-negative (draft note untouched on failure) | Y | `solutionEditorReducer`'s `NOTE_SAVE_FAILURE`/`SAVE_DRAFT_FAILURE`/`PUBLISH_FAILURE` cases never write `note`/`wordCount` — only `*Error`/`*ing` flags change. `SolutionEditorScreen.test.tsx` "failed save keeps the draft" (row 7) and "Đăng generic"/"Gỡ về nháp generic" (row 5) assert the note text / status stay put after a mocked failure. |
| result-union (#11, `setSolutionStatus` exactly 3 codes) | Y | `publishErrorText()`'s `switch` over `error.code` has exactly `"belowWordCount" \| "rateLimited" \| "generic"` branches; `tsc --noEmit` passes with no `default`/`notEligible`/`hidden` branch anywhere in `SolutionEditorScreen.tsx` (exhaustive switch, exhaustiveness enforced by the imported union type). |
| state-lifecycle-negative (#17, `status===null` iff `solutionId===null`, no badge, no `"draft"` substitution) | Y | `SolutionEditorHeader` (task 09, unmodified) already renders no badge when `status===null` (`badge = status !== null ? ... : null`); `EditorState.status: SolutionStatus \| null` is copied as-is from `initialState.status` in `initEditorState()`, never defaulted. "none state" test (row 2) asserts no "Nháp"/"Đã đăng"/"Bị ẩn" badge text is present. |
| derived-display (#27, exact `bar.remaining` sentence from server `missingCount`) | Y | `publishErrorText()`'s `belowWordCount` branch interpolates `error.missingCount` (never `countWords()`/client state) into `t("solutions.bar.remaining", {count, total})`. Tests "belowWordCount missingCount=3..." and "không tự tính lại phía client: missingCount=5..." (rows 3-4) assert the exact rendered sentence for both a plausible and an implausible-if-recomputed count. |

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P1-T9 "Task 10 tests")

Queries and actions are mocked at the module boundary (`@/features/solutions/queries`, `@/features/solutions/actions`); `lib/solutions/identity.ts` and `RichText` stay real.

1. **Writer load `null` → redirect**: `getMySolutionForWriter` resolving to `null` makes the route call `redirect("/exams/E1")` and render **no** editor (no textarea, no "Lưu nháp"/"Đăng" control).
2. **No-solution ("none") state**: `getMySolutionForWriter` resolving to `{ solutionId: null, status: null, attemptId: "A1", showProfile: true, showScore: false, questions: [{ note: "", wordCount: 0, … }] }` renders every note textarea with value `""`, the "Hiện hồ sơ" switch `aria-checked="true"`, the "Hiện điểm" switch `aria-checked="false"`, and **no** "Nháp" / "Đã đăng" / "Bị ẩn" badge.
3. **Publish refusal renders the server's count**: `setSolutionStatus` resolving to `{ ok: false, error: { code: "belowWordCount", missingCount: 3 } }` with the screen holding 12 current questions renders a `role="alert"` containing "Còn 3 câu chưa có ghi chú. Ghi chú đủ 12 câu mới đăng được.", leaves the status badge reading the draft value, leaves both bar buttons pressable, and leaves every note body in the editor unchanged.
4. **No client recomputation**: the same call with `missingCount: 5` while the screen's own `countWords()` state would compute `0` still renders "Còn 5 câu" — the executable form of "server is authoritative" (AC-029).
5. **`generic` status change**: `setSolutionStatus` resolving to `{ ok: false, error: { code: "generic" } }` for "Đăng" leaves the status badge and both bar buttons unchanged and shows the generic line in the bar's `role="alert"`; the same code on "Gỡ về nháp" leaves the `ConfirmDialog` open with the text in its `error` prop and the status unchanged.
6. **Rate limit**: `{ code: "rateLimited", seconds: 42 }` renders `profile.error.rateLimited` with "42" and clears no input.
7. **Failed save/publish keeps the draft** (Reference Contract #7): note text "abc…" → failing `saveSolution`/`setSolutionStatus` → the note text is still "abc…" and an error message is visible.
8. **Non-optimistic publish**: the "Đã đăng" state appears only after the `setSolutionStatus` promise resolves `{ ok: true, status: "published" }` — never while it is pending.
9. **Keyed-reducer re-render scope** (NFR Hiệu năng proxy): saving note `i` re-renders only row `i`, the progress bar and the bottom bar (render-count spy per row).
10. **Route guard**: a foreign / unsubmitted / malformed `attemptId` redirects per S11 and renders no editor content; an own submitted attempt renders the editor.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above (all ten), then run and confirm failure

### 2. Green Phase
- [x] Implement reducer, screen composition, route files, banner `alert` variant
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep reducer actions minimal and typed; no derived state duplicated in the reducer
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs` — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- `next build` (manual manifest read) — Enforces: per-route first-load JS ≤~170KB gzip for this new route; markdown/KaTeX chunk absent from its first bundle — measured formally in task 48
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; then start the dev server against dev Supabase and, as a submitted test user, open `/exams/[id]/attempt/[attemptId]/solution` from the result page card, write notes, save a draft, publish, and re-open.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: component tests green; through the real UI a submitted user can write → save-draft → publish → re-open their own solution against real dev Postgres (Phase 1 exit criterion); a foreign `attemptId` in the URL redirects.
- **Failure response**: if the route guard must trust a client-supplied flag to decide eligibility, stop — server re-validation is mandatory.
- **Verification level**: L1 (end-user write/publish flow on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (Reference Contract #7, AC-032): a rejected save/publish never clears the draft note text.
- **Primary failure mode**: the reducer resets `questions[i].note` from a failed server response, losing typed text.
- **Boundary to exercise**: `SolutionEditorScreen` with `features/solutions/actions.ts` mocked at the module boundary.
- **State assertion**: note text "abc…" → failing save → note text still "abc…" and error visible.
- **Mock boundary rationale**: Server Actions mocked at the module boundary (sole component entry point).
- **Residual**: the full browser chain is proven in task 23 (J1).

- **Claim** (NFR Hiệu năng proxy): saving note `i` re-renders only row `i` + progress bar + bottom bar.
- **Primary failure mode**: every row re-renders on each save, degrading INP on 40-question exams.
- **Boundary to exercise**: in-process render-count instrumentation.
- **State assertion**: render counts for rows ≠ i unchanged across a save of row i.
- **Mock boundary rationale**: actions mocked.
- **Residual**: real INP is not measurable without a live build (Frontend DD § Verification Strategy).

- **Claim** (Reference Contract #27 / AC-029): the publish refusal line names the **server's** missing count.
- **Primary failure mode**: the bar recomputes the count with `countWords()` (or parses it out of the refusal message), so a client/server drift shows a number that did not block the publish.
- **Boundary to exercise**: `SolutionEditorScreen` with `setSolutionStatus` mocked at the module boundary, returning `missingCount: 5` against client state that would compute `0`.
- **State assertion**: the alert reads "Còn 5 câu…"; the status badge, both bar buttons and every note body are unchanged.
- **Mock boundary rationale**: Server Actions mocked; the DETAIL parse itself is backend task 04's test, the real-DB DETAIL `3`/`2` is task 05's.
- **Residual**: none on this layer.

- **Claim** (Connection Map, `attemptId`): the server never trusts the URL `attemptId` alone.
- **Primary failure mode**: a user edits the URL to another user's attempt and the editor links their solution to it.
- **Boundary to exercise**: route Server Component with mocked query returning ownership/submitted results.
- **State assertion**: foreign attempt → redirect issued, editor not rendered.
- **Mock boundary rationale**: query module mocked; DB-level ownership re-derivation lives in the RPC (task 03).
- **Residual**: none beyond the RPC's own gate.

## Completion Criteria
- [x] All added tests pass
- [~] Operation verified per Operation Verification Methods above — L2 (npm test) done; L1 (real-browser write→save-draft→publish→re-open on dev) blocked on a Playwright sign-in step this session's auto-mode classifier denies, deferred like task 08's 360px measurement (see final report)
- [x] Each Proof Obligation is met
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: task 11 adds the note sheet; task 39 adds hidden read-only rendering; task 23 drives this screen end to end.
- Scope boundary: `ModerationReasonBanner`'s status variant (task 08) keeps its behaviour unchanged.
- Route-level tests (Required Tests #1, #10) live in `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/solution/__tests__/page.test.tsx`, colocated with the route files per the repo's existing `(exams)/__tests__/layout.test.tsx` convention (this repo has no other `page.tsx` unit test — `result/page.tsx` etc. rely on L1 verification only; this task adds one because two Required Tests explicitly target route behaviour).
- Task 11 integration handoff: `SolutionEditorScreen`'s minimal internal `NoteEditorScaffold` (opened via `OPEN_NOTE`/`state.activeNote`) is a scaffold standing in for the real `NoteSheet` — see Investigation Notes "Unimplemented Dependency Handling" for the exact swap point and the reducer actions task 11 reuses as-is.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
