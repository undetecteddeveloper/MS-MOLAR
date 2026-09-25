# Task 17: `SolutionCard` + `AuthorIdentity` + `OwnSolutionBlock`

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T5 (split 1/2) — the plan entry lists 7 target files (> 5), so it is split: this file = card-level components; task 18 = `SolutionList` + list route + server guard
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T5)
- **Dependencies**: task 06 (P1-T6, `identity.ts`), task 07 (P1-T7, `AnonymousAvatar`), task 14 (P2-T2, `SolutionListItem`). Phase 1 completion signed off.
- **Provides**: `AuthorIdentity` rendering component (reused by tasks 19, 28, 46), `SolutionCard` (extended by tasks 29, 46), `OwnSolutionBlock`
- **Size**: Small (3 files + component tests)

## Implementation Content

- `AuthorIdentity` component switches on `identity.kind`: `"named"` → `Avatar` (with `avatarUrl` when present, initials fallback otherwise) + display name; `"anonymous"` → `AnonymousAvatar` + "Ẩn danh". No code path can read a name/avatar field from an anonymous identity (type-level guarantee).
- `SolutionCard({ item, examId, now, editHref })` — renders a `SolutionListItem` in server-computed order (never re-sorts, UI-D24): identity, pinned label "Tác giả đề ghim" (AC-079 — still "Ẩn danh" when anonymous), helpful count, updated time via `relativeTime(iso, now)` (one `now` `Date` from the route; never the default argument).
  - **Score badge — exactly two shapes and no third** (Reference Contract Value #18, dot decimal, `UI-D3`/D47): `score` present and `scoreGrading` absent-or-false → `t("result.outOfTen", { score })` ("7.5 trên 10"); `score` present and `scoreGrading === true` → `t("solutions.scorePending", { score })` ("7.5 trên 10 · đang chấm"); `score` absent → **no badge at all** (AC-040), whatever `scoreGrading` says.
  - **Ownership signals come from `isMine` only** (AC-053, AC-062): the "Bài của bạn" badge and the "Sửa" link (never from comparing `author.displayName` with the current user). The writer's own row of an anonymous solution arrives masked (`author: { kind: "anonymous" }`), so it renders "Ẩn danh" **and** "Bài của bạn" **and** "Sửa".
  - **`editHref?: string`**: supplied by the parent **only** for the row whose `item.isMine` is true (`/exams/${examId}/attempt/${own.attemptId}/solution`); renders the "Sửa" link (`z-10`, above the card-covering link). A card with no `editHref` renders no "Sửa" link.
- `OwnSolutionBlock({ summary, examId })` — renders from a literal `OwnSolutionSummary { status: SolutionStatus | null; attemptId; notedCount; questionCount; changedQuestionCount }` (frontend DD § Data Contracts "Own-solution block contract"); server component, no `"use client"`, no query of its own, no `now`/callback prop; one href `/exams/${examId}/attempt/${summary.attemptId}/solution`. Four branches (AC-053):
  - `status === null` → `Card variant="plain"` with one full-width `Button size="lg"` "Viết bài giải của bạn"; no progress bar, no counts.
  - `status === "draft"` → title "Bài giải của bạn" + "Nháp" badge + "Đã ghi chú {a}/{N} câu" + `Progress` whose `aria-labelledby` points at that line + "{k} câu hỏi đã thay đổi, hãy cập nhật" **only when `k > 0`** + "Viết tiếp" link.
  - `status === "hidden"` → "Bị ẩn" badge + "Bài giải của bạn đã bị ẩn bởi quản trị viên." + "Xem lý do" link (the reason itself is not read here; it lives on the write screen's banner).
  - `status === "published"` → renders nothing (`null`); the own card sits in the list instead.

## Acceptance Criteria

From the plan (§ P2-T5), rows that apply to these files: **AC-040, AC-041, AC-053, AC-055, AC-062, AC-079, AC-080**; Reference Contract Values #17 (`status: null` → "Viết bài giải của bạn") and #18 (score badge shapes).

Carried hard constraints that apply to this task:
- Components receive already-mapped data from `SOURCE/features/solutions/queries.ts`; no component reads raw RPC fields or calls Supabase.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`solutions.*`, `list.*` keys from UI Spec § "Chuỗi tiếng Việt cần thêm"); 360px floor; 44px touch targets; "Đêm hội" tokens only from `SOURCE/app/globals.css`; motion only via existing `.motion-*` / `usePresence`.
- `SOURCE/components/shared/Avatar.tsx` is reused unmodified.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/AuthorIdentity.tsx` (new)
- [x] `SOURCE/features/solutions/components/SolutionCard.tsx` (new)
- [x] `SOURCE/features/solutions/components/OwnSolutionBlock.tsx` (new)
- [x] Component tests under `SOURCE/features/solutions/components/__tests__/`

## Investigation Targets
- `SOURCE/lib/solutions/identity.ts` (task 06 union)
- `SOURCE/features/solutions/queries.ts` (task 14 `SolutionListItem` shape)
- `SOURCE/components/shared/Avatar.tsx`, `SOURCE/components/shared/AnonymousAvatar.tsx`, `SOURCE/components/shared/AuthorByline.tsx` (existing byline convention)
- `SOURCE/components/ui/card.tsx`, `SOURCE/components/ui/badge.tsx`, `SOURCE/components/ui/progress.tsx`
- `SOURCE/lib/format/relativeTime.ts` (task 07), `SOURCE/lib/format/number.ts` (dot-decimal formatting)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `AuthorIdentity`, `OwnSolutionBlock.tsx`, `SolutionList.tsx`/`SolutionCard.tsx` incl. `editHref` and `now`)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — `SolutionListItem` invariants (score badge shapes, `isMine` ownership signals); "Own-solution block contract" (`OwnSolutionSummary`))
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives — Element 9 (`editHref`); § Test Boundaries — "Own-solution block tests", "Score badge tests", "Identity self-masking tests")
- `docs/design/community-solutions-frontend-design.md` (§ Security Considerations — `AuthorIdentity` union as primary client-side protection)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionCard — verify default + pinned + anonymous states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: AuthorIdentity — verify named + anonymous states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: OwnSolutionBlock — verify none + draft + hidden + published-not-visible states)
- `docs/ui-spec/community-solutions-ui-spec.md` (`C-04`–`C-08`, `UI-D24`; golden state 3)
- `docs/prd/community-solutions-prd.md` (AC-053, AC-055, AC-079, AC-080, M5)

## Investigation Notes

- `lib/solutions/identity.ts` (commit `6d656ef`): `AuthorIdentity = { kind:"named"; displayName; avatarUrl? } | { kind:"anonymous" }`. `toAuthorIdentity`/`toScoreField` are the only null-to-absent mappers; components never see raw RPC fields. `AuthorIdentity.tsx` (this task) is the render-side consumer of the same type, imported directly (no re-derivation).
- `features/solutions/queries.ts`: `SolutionListItem` matches the task's pinned shape exactly (`score?`, `scoreGrading?` present iff `score` present, `commentCount`/`helpfulCount` always numbers, `author: AuthorIdentity`, `isMine: boolean`). `SolutionStatus = "draft"|"published"|"hidden"` re-exported and reused for `OwnSolutionSummary.status` (type-only import, erased at compile time — same pattern already used by `NoteSheet.tsx`/`QuestionAnswerSummary.tsx`/`SolutionEditorScreen.tsx` importing types from this `server-only` module).
- `Avatar.tsx`/`AnonymousAvatar.tsx`: `Avatar` takes `src: string|null`, fails closed to initials on disallowed origin/runtime `<img>` error; `AnonymousAvatar` takes only `size: 28|32`, no `src`/`name` prop exists on it — structurally cannot leak identity. `AuthorIdentity` composes these two exactly as pinned by frontend DD § Main Components: `{ identity: AuthorIdentity; size: 28|32; isSolutionAuthor?: boolean }`. `isSolutionAuthor`'s "Người viết" badge (S4/AC-068) has no copy.ts key yet (owned by a later comment-sheet task per frontend DD ownership table, line ~1802) — declared in the prop type to match the pinned contract, not wired to any render branch in this task (no caller passes it yet; avoids introducing a key this task doesn't own).
- `card.tsx`/`badge.tsx`/`progress.tsx`: `Card` variants used — `tint` (SolutionCard), `plain` (OwnSolutionBlock). `Badge` variants — `sun` (pinned), `plain tabular-nums` (score), `surface` (Bài của bạn), `muted`/`wrong` (Nháp/Bị ẩn). `Progress` spreads `...props` so `aria-labelledby` passes through unmodified; `value`/`max` clamp internally.
- `relativeTime.ts`/`number.ts`: `relativeTime(iso, now)` — `now` must be the one fixed `Date` the route creates once (v1.4 rule), never the default arg; `number.ts` only has `formatVnd` (irrelevant here) — score formatting done inline via `score.toFixed(1)` (dot decimal, same convention as `ScoreCard.tsx`), no shared formatter exists or is needed for one call site each in two components.
- Frontend DD § Main Components pins `AuthorIdentity`/`OwnSolutionBlock`/`SolutionCard` interfaces verbatim (read `docs/design/community-solutions-frontend-design.md:790-835`); § Data Contracts pins `SolutionListItem` (line ~1220) and `OwnSolutionSummary` (line ~1353) including the exact score-badge two-shape rule and the `isMine`-only ownership rule.
- UI Spec § "Chuỗi tiếng Việt cần thêm" → "Danh sách (S-03)" (line 1870) pins the exact new copy.ts keys this task owns: `solutions.own.{title,noted,progress,writeCta,continue,hiddenLine,seeReason}`, `solutions.card.{mine,updated,helpfulCount,commentCount,pinned,openLabel}`, plus `solutions.identity.anonymous` and `solutions.scorePending` under "Chung". The k-changed line reuses the already-landed `solutions.entry.changed` (no separate `own.changed` key — confirmed absent from the UI Spec's S-03 key list). `result.outOfTen`/`common.edit`/`solutions.status.draft`/`solutions.status.hidden` are reused unchanged (UI Spec § "Dùng lại (không thêm mới)").
- `t()` (`lib/copy.ts:1054`) only substitutes `{name}` placeholders present in `values`; `result.outOfTen`'s value is the static suffix "trên 10" (no `{score}` placeholder, matches its two other call sites in `ScoreCard.tsx`/`SubjectBarChart.tsx`) — so the non-grading score badge composes `score.toFixed(1) + " " + t("result.outOfTen")` as one JS string (one text node, exact-matchable), never a second `{score}`-shaped key.
- `ExamCard.tsx:35-40` is the card-covering-link precedent (`card-link absolute inset-0 z-0 rounded-card ... aria-label`); `MyExamsList.tsx:57`/`ExamRow.tsx:95-96`/`SolutionPublishBar.tsx:83` are the `Button render={<Link/>} nativeButton={false}` precedent for `OwnSolutionBlock`'s three link-buttons. Confirmed via `useButton.js` (base-ui) and `SolutionPublishBar.test.tsx:78` that `nativeButton={false}` sets `role="button"` explicitly on the rendered `<a>` — so this task's own tests query those three OwnSolutionBlock actions via `getByRole("button", ...)`, not `getByRole("link", ...)`. The `SolutionCard` "Sửa" link is a **plain** `<Link>` (not wrapped in `Button`), per the task's own Red-Phase text explicitly using `queryByRole("link", { name: "Sửa" })` — confirmed this renders a genuine `role="link"` anchor with no override.
- `examId` is SolutionCard's only means of building the card-covering view link (`/exams/{examId}/solutions/{item.id}`) — nothing else in the task's Implementation Content bullets uses it, and the Component's own "Vai trò"/"Dùng lại" line ("cả thẻ là một liên kết tới màn xem", AC-055) confirms this is in scope for task 17 (not deferred to task 18/`SolutionList`). Comment count ("y bình luận") is likewise in scope: AC-055 is one of this task's listed ACs and its EARS text explicitly includes "y bình luận" alongside "x hữu ích" — implemented as a second counter next to helpful count.
- No genuine data-shape gap found: `SolutionListItem`/`OwnSolutionSummary` as committed/pinned fully support every rendering case this task's ACs require. No escalation needed.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests (frontend DD § Test Boundaries; `queries.ts` not involved — components rendered with literal objects):
  - Anonymity: an anonymous fixture item renders no name, no `<img>`, no score text anywhere in the card subtree (DOM query) and passes no `displayName`/`avatarUrl` prop to any child; a named item renders its own name/avatar; pinned + anonymous shows both "Tác giả đề ghim" and "Ẩn danh".
  - **Score badge, two shapes** (`SolutionCard`, literal items): `{ score: 7.5 }` → badge text "7.5 trên 10"; `{ score: 7.5, scoreGrading: true }` → "7.5 trên 10 · đang chấm"; `{ score: 7.5, scoreGrading: false }` → "7.5 trên 10" (identical to the first); an item with **no** `score` and `scoreGrading: true` → no badge and no text matching `/trên 10/` (AC-040 wins over AC-041 when the score switch is off). Decimal point, not comma.
  - **Own card and `editHref`**: a `SolutionListItem` with `isMine: true` rendered **with** `editHref="/exams/E1/attempt/A1/solution"` → a link named "Sửa" with that href; the same item rendered **without** `editHref` → `screen.queryByRole("link", { name: "Sửa" })` is `null`; a row with `isMine: false` is rendered without the prop and shows neither "Bài của bạn" nor "Sửa".
  - **Anonymous own row**: an item with `author: { kind: "anonymous" }` and `isMine: true` (with `editHref`) renders "Ẩn danh" **and** "Bài của bạn" **and** the "Sửa" link (AC-062, AC-053).
  - **Four `OwnSolutionBlock` branches**, literal `OwnSolutionSummary` with `examId="E1"`: `{ status: null, attemptId: "A1", notedCount: 0, questionCount: 12, changedQuestionCount: 0 }` → exactly one link named "Viết bài giải của bạn" with `href="/exams/E1/attempt/A1/solution"`, `screen.queryByRole("progressbar")` is `null`, no text matching `/Đã ghi chú/`; `{ status: "draft", attemptId: "A1", notedCount: 3, questionCount: 12, changedQuestionCount: 0 }` → the text "Đã ghi chú 3/12 câu", one `progressbar` whose accessible name is that same text, a "Nháp" badge, a "Viết tiếp" link to the same href, and **no** text matching `/đã thay đổi/`; the same object with `changedQuestionCount: 2` → the line "2 câu hỏi đã thay đổi, hãy cập nhật" present; `{ status: "hidden", … }` → the "Bị ẩn" badge, "Bài giải của bạn đã bị ẩn bởi quản trị viên.", a "Xem lý do" link to the same href, no progress bar; `{ status: "published", … }` → `container.firstChild` is `null`.
- [x] Run and confirm failure

### 2. Green Phase
- [x] Implement the three components
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep identity rendering only inside `AuthorIdentity` (cards never render names directly)
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs` — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit` (discriminated-union exhaustiveness), commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; read the anonymous-card DOM assertions.
- **Success criteria**: anonymous card subtree contains none of the fixture's real name/avatar URL/score strings; named card contains them; the score badge renders in exactly the two shapes (and no badge without `score`); the own card shows "Sửa" only with `editHref`; the anonymous own row keeps "Bài của bạn" and "Sửa"; 4 `OwnSolutionBlock` branches pass (published renders nothing).
- **Failure response**: if a component needs a raw row field, stop — extend the mapped type via task 14's module, never bypass the mapper.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (AC-039/M5 EARS, verbatim): "the system shall render `AuthorIdentity` as `{kind:'anonymous'}` and never pass a `displayName`/`avatarUrl`... to any component."
- **Primary failure mode** (fixture skeleton Test 2): "a component renders row.author_display_name directly (bypassing the AuthorIdentity mapper/discriminated union), so an anonymous-fixture row's real name leaks into the DOM."
- **Boundary to exercise**: rendered `SolutionCard` DOM for an anonymous item whose fixture source row carried a real name elsewhere in the fixture set.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — components render for real with mapped fixture items.
- **Residual**: browser-level list proof is task 24.

- **Claim** (Reference Contract Value #18, verbatim): "`true` renders the badge as `{score} trên 10 · đang chấm` (`solutions.scorePending`), `false` as `{score} trên 10`; absent means no score badge at all (AC-040)."
- **Primary failure mode**: a third badge shape appears (e.g. "đang chấm" shown without a score, or a comma decimal), or the badge renders when the writer hid the score.
- **Boundary to exercise**: rendered `SolutionCard` with the four literal items listed in the Red Phase.
- **State assertion**: "7.5 trên 10" / "7.5 trên 10 · đang chấm" / "7.5 trên 10" / no badge and no `/trên 10/` text.
- **Mock boundary rationale**: none — components render for real.
- **Residual**: the SQL projection of `score_grading` is proven in task 16.

- **Claim** (AC-053 / AC-062, frontend DD § Data Contracts `SolutionListItem`): "`isMine` is the ONLY ownership signal — 'Bài của bạn', the 'Sửa' link and the unread 'k bình luận mới' dot are driven by isMine, never by comparing author.displayName with the current user."
- **Primary failure mode**: the writer's own anonymous row (masked identity) loses "Bài của bạn"/"Sửa", or "Sửa" shows on a card that was not handed an `editHref`.
- **Boundary to exercise**: rendered `SolutionCard` for `{ kind: "anonymous" }` + `isMine: true` with and without `editHref`.
- **State assertion**: with `editHref` → "Ẩn danh", "Bài của bạn" and a "Sửa" link with that href; without → no "Sửa" link.
- **Mock boundary rationale**: none.
- **Residual**: the route that builds `editHref` for the single own row is task 18.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: task 18 renders these components (building `OwnSolutionSummary` and `editHref` on the server); task 29 adds the unread badge to `SolutionCard`; task 46 wires real avatars; tasks 19 and 28 reuse `AuthorIdentity`.
- Scope boundary: `SOURCE/components/shared/Avatar.tsx` unmodified.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
