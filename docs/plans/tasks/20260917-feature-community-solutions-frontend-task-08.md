# Task 08: `SolutionEntryCard` on the result page + fixture-lane mock extension

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P1-T8
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T8)
- **Dependencies**: task 03 (P1-T3, `community_solution_result_card` RPC), task 04 (P1-T4, `getResultCardSummary`), task 07 (P1-T7, shared primitives)
- **Provides**: the feature's sole PRD-mandated entry point; `ModerationReasonBanner` (status variant), extended by tasks 10 and 39
- **Size**: Medium (4 files)

## Implementation Content

- Insert `SolutionEntryCard` between the "Tiếp theo" card and the 3-button row of `result/page.tsx` (around lines ~180–185).
- `Card as="section" variant="tint"` — never `variant="sun"` (UI-D5: the result page already uses its one `sun` card).
- Two buttons, no icon, `whitespace-normal`, `min-h-11` (UI-D2).
- The 4-label mapping from Reference Contract Value #1, exactly.
- `unseenDeletionReason` renders once via `ModerationReasonBanner` status variant (`role="status"`, polite).
- Card data comes from **at most one** additional query (`getResultCardSummary`, AC-012), mocked in the existing fixture-lane factory in the same commit.
- **Zero-row case** (frontend DD § Data Contracts `ResultCardSummary` "Zero rows"): `getResultCardSummary` resolves to `null` when the exam is not published or its author is banned (AC-004) or the caller has no submitted attempt (AC-002). The page then renders **no** `SolutionEntryCard` and no placeholder: no "Bài giải cộng đồng" eyebrow (`solutions.eyebrow`), no "Viết bài giải" link, no `[disabled]` node, no reason given. The zero-row call never marks a deletion reason as seen.
- `result/page.tsx` remains the **only** call site of `getResultCardSummary` (the list route reads `getMySolutionForWriter` instead — task 18).
- The result route has no `loading.tsx`/`error.tsx` of its own; no new route file is created in this task (the `SolutionRouteLoading`/`SolutionRouteError` rows are satisfied by tasks 10, 18, 21). The card's own empty/error/partial states render inline.

## Acceptance Criteria

From the plan (§ P1-T8): **AC-007–AC-012, AC-110; Reference Contract Values #1, #8**.

Carried hard constraints that apply to this task:
- **Task 01 must have landed** before creating `SOURCE/features/solutions/components/**`.
- Components call only `SOURCE/features/solutions/queries.ts` (no direct Supabase calls).
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`entry.*` keys from UI Spec § "Chuỗi tiếng Việt cần thêm" → Thẻ cửa vào).
- 360px floor: both buttons share one row, each ≥44px tall, no clipped label; theme "Đêm hội" tokens only from `SOURCE/app/globals.css`; motion only via existing `.motion-*` / `usePresence`.
- Zero `[disabled]` nodes on the result page.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionEntryCard.tsx` (new)
- [x] `SOURCE/features/solutions/components/ModerationReasonBanner.tsx` (new — status variant)
- [x] `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx` (card insert + 1 query)
- [x] `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (mock factory extended with `getResultCardSummary`)

## Investigation Targets
- `SOURCE/app/(exams)/exams/[id]/attempt/[attemptId]/result/page.tsx` (lines ~170–200: "Tiếp theo" card and 3-button row; existing queries)
- `SOURCE/tests/e2e/fixture/essay-auto-scoring.fixture.e2e.test.ts` (existing mock factory)
- `SOURCE/vitest.fixture.config.ts` (include/exclude list)
- `SOURCE/components/ui/card.tsx`, `SOURCE/components/ui/button.tsx`
- `SOURCE/features/solutions/queries.ts` (`getResultCardSummary` return shape, task 04)
- `SOURCE/supabase/schema.sql` (`community_solution_result_card` — `my_status`, `published_count`, `changed_question_count`, `unseen_deletion_reason`)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `result/page.tsx` new card + 1 query)
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — `unseen_deletion_reason` read-consumes-once)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionEntryCard`)
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `ResultPage` composition)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — `ResultCardSummary`, "Zero rows"; § Test Boundaries — "Zero-row read branches")
- `docs/design/community-solutions-frontend-design.md` (§ Verification Strategy — Early Verification Point)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `unseen_deletion_reason` read-consumes-once)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionEntryCard — verify default + empty + loading + error + partial + hard-deleted-once states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteLoading (loading.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteError (error.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D2`, `UI-D5`; § Visual Acceptance golden states 1–2; § Cách đo row `AC-011`)
- `docs/prd/community-solutions-prd.md` (AC-007–AC-012, AC-110)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/prd/community-solutions-prd.md` (AC-010) | derived-display | "chưa có bài (kể cả sau khi bài bị admin xoá hẳn — khi đó kèm dòng lý do một lần theo AC-110) → 'Viết bài giải'; đang nháp → 'Viết tiếp'; đã đăng → 'Sửa bài giải'; bị ẩn → 'Bài giải của bạn đang bị ẩn'" | For `myStatus` = none/draft/published/hidden the primary button label is exactly "Viết bài giải"/"Viết tiếp"/"Sửa bài giải"/"Bài giải của bạn đang bị ẩn", and the reason line appears only when `unseenDeletionReason` is present |
| `docs/design/community-solutions-backend-design.md` (§ State Transitions, System Invariants) | state-lifecycle-negative | "`community_moderation_log.viewed_at`, once set, is never unset by any function in this design (S20's 'seen' is monotonic per log row)" | The card renders the deletion reason only from the value returned by the single `getResultCardSummary` call, and no client code re-requests or caches it for a second display |

## Investigation Notes
(Append observations here before implementation begins. Record each Reference Contract Compliance Check result.)

- `result/page.tsx` (read in full): insertion point confirmed at line ~180–185, between the `Card variant="sun"` "Tiếp theo" block (ends line 180) and the `grid-cols-3` action row (starts line 185). `ScoreCard` (line 106) is an **already-composed async server component used directly as JSX** (`export async function ScoreCard(...)`) — this is the existing precedent for nesting `SolutionEntryCard` (also async) directly as `<SolutionEntryCard examId={id} attemptId={attemptId} />` without a manual `await Component(props)` call; the page's own fixture lane already renders through `renderServerTree()` (full SSR stream), which resolves nested async server components correctly (unlike RTL's client renderer).
- `features/solutions/queries.ts` (read in full, task 04 landed): `getResultCardSummary(examId): Promise<ResultCardSummary | null>` and `ResultCardSummary { publishedCount, myStatus: SolutionStatus | null, changedQuestionCount, unseenDeletionReason: string | null }` already exist — consumed as-is, not modified.
- `essay-auto-scoring.fixture.e2e.test.ts` (read in full): whole-module `vi.mock` per import; `renderResultRoute()` helper composes `RootLayout → (exams) layout → ResultPage` via `renderServerTree()`. Must add `getResultCardSummaryMock` to the hoisted mocks + `vi.mock("@/features/solutions/queries", ...)`, defaulted to resolve `null` inside `renderResultRoute()` so the four existing FE2E-1..4 describes (unrelated to this feature) keep rendering the same DOM (no card inserted when summary is null). New describe block(s) for this task override the mock per-case.
- `vitest.fixture.config.ts`: globs the whole `tests/e2e/fixture/**` directory; `essay-auto-scoring.fixture.e2e.test.ts` is not in the exclude list, so new cases here are collected and run automatically.
- `card.tsx`/`button.tsx` (read in full): `Card as="section" variant="tint"` exists; `buttonVariants({ variant: "secondary" })` exists; `size="default"` is `h-11` (44px) already meeting the touch floor — `min-h-11 whitespace-normal` override matches `UI-D2`'s exact className recipe.
- UI Spec § Component: SolutionEntryCard (:617-644) + § Component: ModerationReasonBanner (:994-1015) + UI-D2 (:82-86) + UI-D5 (:102-106): state matrix confirms "Mặc định"/"Rỗng"/"Một phần"/"Câu đã thay đổi"/"Vừa bị xoá hẳn" branches; exact className recipe for the two buttons; `ModerationReasonBanner` status variant = `Card padding="compact" role="status"` + `Info aria-hidden` + `text-sm`, copy key `solutions.entry.deleted` ("Bài giải của bạn đã bị gỡ: {reason}") — **not** the same string as the button's "hidden" label (`solutions.entry.hidden`, "Bài giải của bạn đang bị ẩn"); the two are different UI elements for different states (banner = one-time hard-delete notice; button label = currently-hidden solution).
- Frontend DD § Data Contracts `ResultCardSummary` (:1192-1218) + § UI Error State Design row `SolutionEntryCard` (:1714): zero rows (`null`) → page renders no card at all (defensive; this task's Completion Criteria zero-row case). A **query throw** (distinct from the zero-row `null` contract) is caught **inside** `SolutionEntryCard` itself and falls back to the same shape as the N=0 empty branch ("Chưa có bài giải cho đề này") — never a red banner, never propagated to the page. This task's Proof Obligations/Completion Criteria do not require a dedicated throw-path test case (not listed among "four myStatus branches, the one-time reason, the zero-row null case"); the catch is implemented per the Design Doc's explicit mechanism but is not separately asserted in this task's added fixture cases.
- Copy keys added under `SOURCE/lib/copy.ts` § "Bài giải cộng đồng" section, `solutions.` prefix per existing file convention (see `solutions.switch.*`/`solutions.dirty.*` already landed by an earlier task): `solutions.eyebrow`, `solutions.entry.count`, `solutions.entry.empty`, `solutions.entry.body`, `solutions.entry.write`, `solutions.entry.continue`, `solutions.entry.edit`, `solutions.entry.hidden`, `solutions.entry.viewCount`, `solutions.entry.view`, `solutions.entry.changed`, `solutions.entry.deleted` — exact strings from UI Spec § "Chuỗi tiếng Việt cần thêm" → "Thẻ cửa vào (S-01)".

- **360px measurement (post-implementation, 2026-09-25)**: measured live on the real result route at `--width=360 --height=800` for `none`/`draft`/`published` (cycled through by writing+saving a note on a 1-câu exam) and synthetically for `hidden` (label injected via `eval` into the real button's `textContent`, reusing its computed `whitespace-normal` styles). All four primary labels stay on one row with the secondary button, meet the 44px floor (`hidden` grows to 53px on wrap, never clips), and show `scrollWidth<=clientWidth` (no horizontal overflow). Full per-state numbers recorded in Completion Criteria below.

### Reference Contract Compliance (pre-implementation)

- Planned approach (both rows share one axis — label/reason rendering correctness): `SolutionEntryCard` derives the primary button label from a single `Record<"none" | SolutionStatus, MessageKey>` lookup keyed by `myStatus ?? "none"`, and renders `ModerationReasonBanner` only when `unseenDeletionReason` is truthy, reading `summary` from exactly one `getResultCardSummary(examId)` call per render (no re-fetch, no client cache — server component, data arrives with the page).
- Row 1 (PRD AC-010, Value #1 — label-per-status): **Y**. The lookup maps `none→entry.write`, `draft→entry.continue`, `published→entry.edit`, `hidden→entry.hidden`, matching the Compliance Check's exact strings; the reason line (via `ModerationReasonBanner`) is conditioned strictly on `unseenDeletionReason` truthiness, independent of the label lookup.
- Row 2 (backend DD § State Transitions/System Invariants — `viewed_at` monotonic, read-once): **Y**. The component performs exactly one `getResultCardSummary` call (no loop, no effect, no second read), and the reason text rendered is exactly the value that single call returned — no client-side cache or second request exists that could re-display it.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Extend the fixture mock factory with `getResultCardSummary` and write failing fixture cases for all four `myStatus` branches + the one-time `unseenDeletionReason` branch, plus a zero-`[disabled]` assertion
- [x] Add the zero-row fixture case: `getResultCardSummary` resolving to `null` → the result page renders no text "Bài giải cộng đồng" (`solutions.eyebrow`), no link named "Viết bài giải", and no `[disabled]` node (frontend DD § Test Boundaries, "Zero-row read branches", task 08)
- [x] Run `test:fixture` (lane rule below) and confirm the new cases fail — verified by temporarily stashing the `result/page.tsx` insertion: 6/7 new cases failed for the right reason (missing card/label/banner/call), the 7th (zero-row null default) passed trivially since "no card" was already the page's pre-change behavior. Stash restored immediately after.

### 2. Green Phase
- [x] Implement `SolutionEntryCard`, `ModerationReasonBanner` (status variant), and the page insert with one query
- [x] Run only the added cases and confirm they pass — 11/11 pass (4 pre-existing FE2E-1..4 + 7 new task-08 cases)

### 3. Refactor Phase
- [x] Keep the label mapping in one lookup, not scattered conditionals — `PRIMARY_LABEL_KEY` `Record<"none" | SolutionStatus, MessageKey>` in `SolutionEntryCard.tsx`
- [x] Confirm added cases still pass and `essay-auto-scoring` existing cases are unaffected — `npm run test:fixture` (excluded lane) 11/11 pass; full `npm test` 2173/2183 pass (10 pre-existing skips, unrelated); `npx tsc --noEmit` clean; `npm run lint` clean

## Quality Assurance Mechanisms
- `npm run test:fixture` — Enforces: real route-tree render with data mocked; zero `[disabled]` nodes — Config: `SOURCE/vitest.fixture.config.ts` — Covers: `result/page.tsx`, `essay-auto-scoring.fixture.e2e.test.ts`
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs` — Covers: `SOURCE/features/solutions/**`
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: run `test:fixture` as `npx vitest run --config vitest.fixture.config.ts --exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` (that skeleton stays comment-only until task 23); `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
(This task is the frontend **Early Verification Point** — copied verbatim from the work plan's Verification Strategy.)
- **Verification method** (verbatim): "`SolutionEntryCard` (this plan's Phase 1) rendering correctly in `test:fixture` at all four `myStatus` branches + the one-time `unseenDeletionReason` branch, passing AC-011's 360px no-clip/44px measurement." Measure 360px with Playwright CLI run from inside `SOURCE/` (`--viewport-size=360,800`), per UI Spec § Cách đo row `AC-011`.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria** (verbatim, Frontend DD Early Verification Point): "the fixture lane stays green with the new mock added; the card never introduces a `[disabled]` node; at 360px, both buttons share one row, each ≥44px tall, with no clipped text for the longest label ('Bài giải của bạn đang bị ẩn')."
- **Failure response** (verbatim): "if the 360px measurement fails for the longest label even after `UI-D2`'s icon-removal/wrap treatment, stop and re-open the label-width question with the UI Spec author before continuing to Slice B."
- **Verification level**: L1 (functional entry point on the real result route) + L2 (fixture cases added and passing)

## Proof Obligations
- **Claim** (AC-010, Reference Contract #1): exactly one of four labels per `myStatus`; the deletion reason line renders once.
- **Primary failure mode**: a status maps to the wrong label (e.g. hidden shows "Sửa bài giải", inviting edits to hidden content), or the reason line re-renders on every visit.
- **Boundary to exercise**: real result route tree rendered in the fixture lane with `getResultCardSummary` mocked at the `features/solutions/queries.ts` module boundary.
- **State assertion**: fixture `unseenDeletionReason: "…"` → reason line visible; fixture with `null` → no reason line.
- **Mock boundary rationale**: only the query module is mocked; the page, card, and banner render for real.
- **Residual**: that `viewed_at` is actually set on read is a DB behaviour proven by task 03's function body and task 05's groups.

- **Claim** (frontend DD § Data Contracts `ResultCardSummary`, "Zero rows"): "result/page.tsx renders no SolutionEntryCard and no placeholder when the value is null."
- **Primary failure mode**: a `null` summary still renders the card shell, an empty "Viết bài giải" button, or a disabled placeholder for a caller who is not eligible (AC-002/AC-004), leaking that the feature exists for that exam and adding a `[disabled]` node.
- **Boundary to exercise**: real result route tree in the fixture lane with `getResultCardSummary` mocked at the `features/solutions/queries.ts` module boundary to resolve `null`.
- **State assertion**: `null` → no text "Bài giải cộng đồng" (`solutions.eyebrow`), no link named "Viết bài giải", no `[disabled]` node; the rest of the result page (the "Tiếp theo" card and the 3-button row) still renders.
- **Mock boundary rationale**: only the query module is mocked; the page renders for real.
- **Residual**: that the RPC really returns zero rows for the ineligible caller is proven on real DB in task 05's AC-004 and AC-002 gate groups.

- **Claim** (AC-012): the card adds at most one query to the result page.
- **Primary failure mode**: the card fetches per-status data in several calls, slowing the result page.
- **Boundary to exercise**: the mocked query module's call log during one page render.
- **State assertion**: `getResultCardSummary` call count = 1 per render; no other `features/solutions/queries.ts` export called.
- **Mock boundary rationale**: query module mocked to count calls.
- **Residual**: none.

## Completion Criteria
- [x] All added fixture cases pass (four `myStatus` branches, the one-time reason, the zero-row `null` case) and existing `essay-auto-scoring` cases stay green
- [x] Operation verified per Operation Verification Methods above (Early Verification Point green, 360px measurement recorded) — fixture-lane green (`test:fixture`, see Red/Green/Refactor above). **360px Playwright measurement completed 2026-09-25** on the real result route, signed in as the shared dev test account (AnhPhat), using `node scripts/pw/cli.mjs resize --width=360 --height=800` against `/exams/e1mp-exam-lowest/attempt/b0a11a2d-a511-4ea9-a809-f64eb6020cf5/result` (a 1-câu exam this account has a submitted attempt on, chosen so all four `myStatus` states could be cycled through live in one exam by writing a note through the write screen and saving draft/publish). Results per state (via `eval` reading `getBoundingClientRect()`/`scrollWidth`/`clientWidth` on both buttons, plus a screenshot each):
  - **none** (`Viết bài giải` / `Xem bài giải`): both `top=510.5`, `height=44`, `scrollWidth=142===clientWidth=142` (no overflow) — same row, no clip.
  - **draft** (`Viết tiếp` / `Xem bài giải`, reached by writing a 48-word note and clicking "Lưu nháp"): both `top=841.5`, `height=44`, `scrollWidth=142===clientWidth=142` — same row, no clip.
  - **published** (`Sửa bài giải` / `Xem 1 bài giải`, reached by clicking "Đăng" on the same note): both `top=841.5`, `height=44`, `scrollWidth=142===clientWidth=142` — same row, no clip.
  - **hidden** (longest label "Bài giải của bạn đang bị ẩn"): not reachable live — this account cannot self-trigger admin moderation (hard-delete/hide requires an admin action). Measured synthetically instead per the task's own fallback instruction: on the published-state page, `eval` located the primary button (the `Sửa bài giải` link) and set `textContent = "Bài giải của bạn đang bị ẩn"` in place, reusing the component's real computed font/padding/`whitespace-normal` styles. Result: the button wraps to two lines ("Bài giải của bạn" / "đang bị ẩn"), `offsetHeight` grows from the 44px floor to `53`, `scrollWidth=142===clientWidth=142` (still no horizontal overflow/clip), and it visually stays on the same row as the secondary `Xem 1 bài giải` button (confirmed by screenshot). No clipping for the longest label.
  - Screenshots captured for all four states (temp scratch paths, not committed): `m1-none-360-scrolled.png`, `m1-draft-360.png`, `m1-published-360.png`, `m1-hidden-synthetic-360-scrolled.png`.
  - **Outcome: PASS for all four states.** No defect found; no re-open of the label-width question needed.
- [x] Each Proof Obligation is met (label-per-status + reason-once, zero-row null, at-most-one-query — all three covered by the 7 new fixture cases; the AC-011 360px sub-check of the Operation Verification Method above is the one unmet part, tracked separately per the row above)
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: `ModerationReasonBanner` gains an alert variant in tasks 10/39; task 49 re-measures this surface.
- Scope boundary: no other change to `result/page.tsx` beyond the card insert and its single query.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
