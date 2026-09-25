# Task 18: `SolutionList` + list route `/exams/[id]/solutions` (server-side S11 guard)

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P2-T5 (split 2/2) — the plan entry lists 7 target files (> 5), so it is split: task 17 = card-level components; this file = `SolutionList` + route files + guard
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T5)
- **Dependencies**: task 14 (P2-T2, `listSolutions`), task 17 (P2-T5 split 1/2)
- **Provides**: route `/exams/[id]/solutions`, consumed by tasks 23, 24, 29, 49
- **Size**: Medium (4 files + tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, work plan **v1.3**

## Implementation Content

- Route `SOURCE/app/(exams)/exams/[id]/solutions/page.tsx` (Server Component): **exactly two fixed reads** — `listSolutions(examId)` and **one** `getMySolutionForWriter(examId)` — plus the exam read the page header/breadcrumb already performs for the title (AC-052). Neither read is per row: a hundred published solutions add no query (AC-057).
- **`getResultCardSummary(examId)` must NOT be called from this route** (frontend DD § Data Contracts "Own-solution block contract"; work plan Reference Contract table, AC-110/S20). It is the one read in this feature with a "read consumes" contract — reading it marks the one-time hard-delete reason seen — so a call here would consume AC-110's line on a screen that cannot render it, and the writer would never see it on the result card it belongs to. Its single call site in this design is `result/page.tsx`. Task 18's test asserts `expect(getResultCardSummary).not.toHaveBeenCalled()`.
- **`OwnSolutionSummary` derived on the server** from the `SolutionEditorState` that `getMySolutionForWriter` returns, and passed down as the only own-solution data: `status = state.status`, `attemptId = state.attemptId`, `notedCount = questions.filter(q => q.wordCount >= 15).length`, `questionCount = questions.length`, `changedQuestionCount = questions.filter(q => q.hasChanged).length`. `editHref` = `/exams/${examId}/attempt/${own.attemptId}/solution`, built once here and handed to the single own row (task 17's `SolutionCard.editHref?`).
- **No note text reaches the client**: the note bodies, the per-question array and the linked attempt's answers that `getMySolutionForWriter` also returns stay on the server. The write route is the only screen that ships note text.
- **`status: SolutionStatus | null` (frontend DD v1.6)**: `null` means "no solution yet" and is passed through to `OwnSolutionBlock` unchanged (`null` → "Viết bài giải của bạn"; `"draft"` → "Viết tiếp"; `"hidden"` → "Xem lý do"; `"published"` → the block renders nothing and the own card carries "Sửa"). The route never substitutes `"draft"` for `null`.
- **Zero rows → redirect**: `getMySolutionForWriter` returning `null` makes the route `redirect("/exams/<id>")` before rendering any list content (S11/AC-002/AC-004) — it never renders "the list without the block", because a caller who may not write may not read either under the same R1 gate. A thrown query error is **not** converted into a redirect and does not degrade to a partial render; it reaches `error.tsx`.
- Header per AC-052: breadcrumb "Kho đề › <tên đề> › Kết quả › Bài giải", eyebrow "Bài giải cộng đồng", title, description with count.
- `SolutionList({ examId, items, own, now })` renders `OwnSolutionBlock` then `SolutionCard`s in the exact order received (no client re-sort, UI-D24); `now` is one `Date` created once per render and passed down so every relative time in one render reads one clock; empty state is the dashed frame "Chưa có bài giải nào. Hãy là người đầu tiên." below the own block (AC-056).
- `loading.tsx` (skeleton height equals the real block height; `aria-busy` + sr-only "Đang tải") and `error.tsx` (`role="alert"`, `tabIndex={-1}`, focused).
- **Copy keys added here**: `solutions.list.*` (frontend DD § Vietnamese Copy Keys owning-task table, verbatim UI Spec values, cited by key name). `solutions.own.*` / `solutions.card.*` are added by task 17.

## Acceptance Criteria

From the plan (§ P2-T5), rows that apply to these files: **AC-052, AC-054, AC-056, AC-057, AC-110 (not consumed here)**, plus the server-side guard (S11, AC-002, AC-004); Reference Contract Value **#17**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** the list route renders, the system shall call `getMySolutionForWriter(examId)` exactly once and shall **not** call `getResultCardSummary(examId)`, so the one-time hard-delete reason stays unseen until the result card can render it. (AC-110, S20)
- **If** `getMySolutionForWriter(examId)` returns `null` on the list route, **then** the route shall redirect to `/exams/[id]` before rendering any list content. (AC-002, AC-004, S11)
- **When** the list route receives a state with `status: null`, it shall pass `status: null` to `OwnSolutionBlock`, which shall render the "Viết bài giải của bạn" branch. (AC-053)

Carried hard constraints that apply to this task:
- Data only via `SOURCE/features/solutions/queries.ts`.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`list.*` keys); 360px floor, no horizontal scroll; 44px touch targets; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`; never fade page content on load.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionList.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/page.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/loading.tsx` (new)
- [x] `SOURCE/app/(exams)/exams/[id]/solutions/error.tsx` (new)
- [x] Tests under `SOURCE/features/solutions/components/__tests__/` (`SolutionList.test.tsx`, `SolutionsListPage.test.tsx`)

## Investigation Targets
- Task 17 deliverables: `SOURCE/features/solutions/components/{SolutionCard,OwnSolutionBlock,AuthorIdentity}.tsx`
- `SOURCE/features/solutions/queries.ts` (`listSolutions`, `getMySolutionForWriter`)
- `SOURCE/app/(exams)/exams/[id]/page.tsx` (redirect target `/exams/[id]` and breadcrumb convention)
- `SOURCE/app/(analytics)/profile/loading.tsx`, `SOURCE/app/(analytics)/profile/error.tsx` (route loading/error conventions)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `SolutionList.tsx` + `SolutionCard.tsx`: the `editHref` and `now` props)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Own-solution block contract": the derivation, the `attemptId` rule table, the route query-count note, and why `getResultCardSummary` is forbidden here; "Writer load contract"; `ResultCardSummary` "Single call site (binding, v1.4)")
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives Element 9 — the list route's own-solution data source)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "Own-solution block tests" → "Route wiring (task 18)"; "No-solution state tests")
- `docs/design/community-solutions-frontend-design.md` (§ UI Error State Design — the `SolutionsListPage` row: a `null` writer result is a redirect, not a partial render)
- `docs/design/community-solutions-frontend-design.md` (§ Error Handling — validation/rate-limit/business-logic/infra/dirty-close rows)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionList — verify default + empty states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteLoading (loading.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: SolutionRouteError (error.tsx × 3) — verify default state)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D24`; golden states 3–4; § Ràng buộc bố cục; § Cách đo row "Không nhảy bố cục")
- `docs/prd/community-solutions-prd.md` (AC-002, AC-004, AC-052, AC-054, AC-056, AC-057, S11)

## Investigation Notes

- **Task 17 deliverables** (`SolutionCard.tsx`, `OwnSolutionBlock.tsx`, `AuthorIdentity.tsx`): interfaces used exactly as committed, no changes needed (no genuine contract mismatch found). `SolutionCard({ item, examId, now, editHref? })` — `editHref` supplied only for the `isMine` row, built by the parent, never re-derived inside the card. `OwnSolutionBlock({ summary, examId })` — `OwnSolutionSummary` exported from this file; four branches keyed on `summary.status` (`null`/`draft`/`hidden`/`published`→renders `null`). Both are plain server function components (no `"use client"`), safe to compose from a Server Component page.
- **`queries.ts`**: `getMySolutionForWriter(examId): Promise<SolutionEditorState | null>` — 0 rows ⇒ `null` (ineligible); `SolutionEditorState.status` is `SolutionStatus | null`, copied verbatim from SQL (never remapped to `"draft"`). `listSolutions(examId): Promise<SolutionListItem[]>` — server-ordered (pinned/helpful/updatedAt/id), never re-sorted by the frontend. `getResultCardSummary` exists in the same module — imported nowhere in this task's new files, only referenced (mocked) in tests to make the "never called" assertion meaningful.
- **`exams/[id]/page.tsx`**: redirect target convention confirmed (`notFound()` on missing exam via `getExam`); breadcrumb pattern is `Breadcrumbs`/`PageHeader` with `t("nav.exams")` as the first crumb. `getExam` comes from `@/features/exams/queries` (barrel over `queries/catalogue.ts`), returns `Exam | null` with `.title`.
- **`(analytics)/profile/loading.tsx` / `error.tsx`**: confirmed `loading.tsx` skeleton convention (`aria-busy`, `sr-only` "Đang tải", `bg-surface animate-pulse` blocks matching page's `PageContainer` size/padding exactly) and `error.tsx` convention (`"use client"`, `role="alert" tabIndex={-1}` focused in `useEffect`, "Thử lại" → `reset()`). The **closer** reference actually used is the sibling route already built in this same feature, `(exams)/attempt/[attemptId]/solution/{loading,error}.tsx` (task 10) — same `solutions.routeError`/`common.loading` keys, same structure; this task's `loading.tsx`/`error.tsx` are near-identical, only the skeleton block order changed (page header + own block + 3 cards, vs. editor header + settings row + 8 question rows + bottom bar).
- **Skeleton vs real block height**: NOT measured on a real browser this run (no active signed-in Playwright CLI session available — see Operation Verification Methods note below, same block as tasks 08/10). `loading.tsx` matches block **order and count**, not exact px; task 10's own `loading.tsx` (already committed) also carries no exact-px comment, only structural order — followed the same precedent rather than inventing unmeasured numbers.
- **Frontend DD § Data Contracts "Own-solution block contract"**: derivation is `status = state.status`, `attemptId = state.attemptId`, `notedCount = questions.filter(q => q.wordCount >= 15).length`, `questionCount = questions.length`, `changedQuestionCount = questions.filter(q => q.hasChanged).length` — implemented verbatim in `page.tsx`. `getResultCardSummary` confirmed as having exactly one call site in the whole design (`result/page.tsx`, task 08) — not imported here.
- **Frontend DD § Main Components "SolutionList.tsx"**: interface pinned as `SolutionList({ examId, items, own, now })` — no `examTitle`/breadcrumb-related prop. Since AC-052's breadcrumb needs the exam's title (which only `page.tsx` reads), the page header (breadcrumb + eyebrow + title + description) is built in `page.tsx` itself, not inside `SolutionList` — `SolutionList` owns only the own-block slot, the `ul` of cards and the AC-056 empty frame. This keeps the pinned `SolutionList` Props signature unchanged while still satisfying AC-052 (implementation-detail choice, not a Design Doc deviation — no interface was altered from what is pinned).
- **UI Spec § "Ràng buộc bố cục" / spacing table**: the generic "Khoảng cách" table says `gap-6` for "trang danh sách", but the more specific "Component: SolutionList" section's own "Dùng lại" line pins `className="flex flex-col gap-5 px-4 py-6 sm:px-6 sm:py-8"` verbatim. Followed the component-specific, more binding quote (`gap-5`), consistent with the sibling route's own `gap-5` (task 10) — no test in § Required Tests checks this value, so this is a non-blocking implementation detail, not a design-compliance gap.
- **UI-D24 / "Không nhảy bố cục"**: confirmed no client re-sort exists anywhere in `SolutionList`/`page.tsx` — `items.map` renders the array exactly as `listSolutions` returned it.

### Binding rules re-verified against the final implementation (Exit Gate)
- `getResultCardSummary` is mocked in `SolutionsListPage.test.tsx` and asserted `not.toHaveBeenCalled()` — never imported by `page.tsx`/`SolutionList.tsx`. **Y**.
- `getMySolutionForWriter` returning `null` → `redirect("/exams/[id]")` runs before `listSolutions`/`getExam` are even called (verified in the test: both mocks assert zero calls on the redirect path) — no content render, no partial list. **Y**.
- No note text (`SolutionEditorQuestion.note`, per-question array, linked attempt's answers) crosses into `OwnSolutionSummary` or any client-visible prop — only `status`/`attemptId`/`notedCount`/`questionCount`/`changedQuestionCount` are passed down. Verified with a sentinel-string test asserting it never appears in the rendered DOM. **Y**.
- `status: null` passed through unchanged to `OwnSolutionBlock` (no substitution to `"draft"`). **Y**.

### Operation Verification — L1 real-browser check (deferred)
Per the same standing block hit by tasks 08 and 10 (`docs/plans/community-solutions-HANDOFF.md` § "Phép đo qua browser thật"): auto-mode denies Claude driving the Playwright-CLI sign-in submit itself, and no already-signed-in shared CLI session was available in this run. The L1 walkthrough (eligible submitter sees own block + cards in server order; non-submitter is redirected with no content flash; empty exam shows the dashed frame) is **deferred**, not skipped — it must run on dev before this feature is declared visually done, same as tasks 08/10's Completion Criteria note. L2 (all 10 new tests, `npx tsc --noEmit`, targeted `eslint`) was run in full and is green.

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P2-T5 "Task 18 tests")

`getMySolutionForWriter`, `listSolutions` and `getResultCardSummary` are all mocked at the module boundary (`@/features/solutions/queries`) — `getResultCardSummary` must be `vi.mock`ed even though this route may never call it, because its call count is the assertion.

1. **`getResultCardSummary` is never called**: rendering the list page with `getMySolutionForWriter` resolving to a state with 50 questions asserts `expect(getResultCardSummary).not.toHaveBeenCalled()` — the executable form of the AC-110/S20 rule.
2. **One writer read**: `getMySolutionForWriter` is called **exactly once** per render.
3. **No note text on the client**: a sentinel string planted in `questions[0].note` of the mocked state appears **nowhere** in the rendered output.
4. **Zero rows → redirect**: with `getMySolutionForWriter` resolving to `null`, the page calls `redirect("/exams/E1")` and renders no list.
5. **`status: null` branch**: with `getMySolutionForWriter` resolving to a state with `status: null`, the page renders exactly **one** link named "Viết bài giải của bạn" and **no** "Viết tiếp" / "Xem lý do" link.
6. **Server order preserved**: fixture items render in exactly the order received (UI-D24) — DOM card ids in order equal fixture ids in order.
7. **Empty list**: `listSolutions` → `[]` renders the dashed "Chưa có bài giải nào. Hãy là người đầu tiên." frame below the own block (AC-056).
8. **Query count**: one `listSolutions` call per render, independent of the number of items (AC-057).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement `SolutionList` and the route files
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep eligibility decision in the page (server), not in `SolutionList`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `next build` (manual manifest read) — per-route first-load JS ≤~170KB gzip; markdown/KaTeX chunk absent (formal measurement task 48)
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test`; then on the dev server against dev Supabase, as an eligible non-author submitted test user open `/exams/[id]/solutions`; as a non-submitter open the same URL.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: eligible user sees the own block + solution cards in server order; non-submitter is redirected to `/exams/[id]` with no list content flashed; empty exam shows the dashed frame.
- **Failure response**: if the redirect happens client-side after content renders, stop — the guard must run in the Server Component.
- **Verification level**: L1 (browse the list on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (Failure Mode #6, unavailable boundary / S11 / AC-002): an ineligible caller's empty masking-RPC result redirects server-side, never error-renders.
- **Primary failure mode**: an empty result renders the route error page or an empty list, revealing that the caller reached a gated page.
- **Boundary to exercise**: the route Server Component with `features/solutions/queries.ts` mocked at the module boundary.
- **State assertion**: N/A.
- **Mock boundary rationale**: query module mocked (sole component entry point); the RPC's own gate is proven on real DB in task 16.
- **Residual**: browser-level redirect is exercised in task 49's walkthrough.

- **Claim** (AC-110 / S20, frontend DD § Data Contracts "Own-solution block contract"): this route never consumes the one-time hard-delete reason.
- **Primary failure mode**: the route calls `getResultCardSummary` for the own-solution status, which marks AC-110's reason seen on a screen that cannot render it — the writer then never sees it on the result card, and nothing anywhere reports the loss.
- **Boundary to exercise**: the route Server Component with `@/features/solutions/queries` mocked at the module boundary.
- **State assertion**: `expect(getResultCardSummary).not.toHaveBeenCalled()` and `getMySolutionForWriter` call count `1`.
- **Mock boundary rationale**: query module mocked (sole component entry point); the "read consumes" semantics themselves are the backend's (tasks 03/05).
- **Residual**: none on this layer.

- **Claim** (Failure Mode #9, missing-sort-key ordering / UI-D24 / AC-054): the list renders items in exactly the order received.
- **Primary failure mode**: a client-side sort by helpful count reorders ties differently from the server's `updated_at`/`id` tie-break.
- **Boundary to exercise**: rendered `SolutionList` DOM order vs fixture order.
- **State assertion**: DOM card ids in order = fixture ids in order.
- **Mock boundary rationale**: none.
- **Residual**: server order stability proven in task 16.

## Completion Criteria
- [x] All added tests pass
- [🔄] Operation verified per Operation Verification Methods above — L2 (`npm test` on the 10 new tests, `npx tsc --noEmit`, scoped `eslint`) done and green; L1 real-browser walkthrough deferred, same standing sign-in block as tasks 08/10 (see Investigation Notes) — must run before this feature is declared visually done
- [x] Each Proof Obligation is met (see Investigation Notes "Binding rules re-verified against the final implementation")

## Notes
- Impact scope: task 24 proves anonymity on this route at browser level; task 29 adds the unread badge to the viewer's own card here.
- Scope boundary: no changes to `SOURCE/app/(exams)/exams/[id]/page.tsx`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
