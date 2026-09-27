# Task 44: `ProfileTabs` + `ReputationBlock` passed into `ProfileCard` through `reputationSlot`

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P5-T5
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T5)
- **Dependencies**: task 43 (P5-T4, `getMyReputation`); `markCommentsRead` from task 26. **No gate** — the decomposition-time placement question is resolved (see § Placement, resolved).
- **Provides**: profile tabs (`?tab=`) and the reputation block, consumed by task 45
- **Size**: Medium (5 files + tests)
- **Design Doc versions this file is written against**: frontend DD **v1.6**, work plan **v1.3**

## Placement (resolved — no longer an open item)

The decomposition-time blocker about where `ReputationBlock` lives and how server data reaches it is **resolved**, and the former "Blocking Unresolved Item U2" block is removed from this file. The engineer's final decision is recorded in frontend DD v1.6 § UI Spec Deviations DD-U1 and § Minimal Surface Alternatives **Element 4** (Alternative A, "engineer decision U2, 2026-09-17, final"):

- `ProfileCard` gains **exactly one** optional prop — `reputationSlot?: ReactNode` — and renders it immediately after the `AvatarUploader` block (which shows only while a file is picked) and immediately **before** the `PasswordRow` wrapper, with **no wrapper element** of its own. JSDoc on the prop states the contract: the parent page builds the element, the card only positions it (UI-D14).
- `ReputationBlock.tsx` stays in `SOURCE/features/solutions/components/`, as a **server** component (no `"use client"`, no data fetching, a plain synchronous function — not `async` — so `ProfileCard.test.tsx` can render it in jsdom).
- `SOURCE/app/(analytics)/profile/page.tsx` calls `getMyReputation()` on the account tab and passes `<ReputationBlock totalScore publishedCount helpfulCount pinnedCount />` as `reputationSlot`. On failure it passes **no slot**: no block, no banner.
- `ProfileCard` therefore imports **nothing** from `@/features/solutions/**` and B4 holds with no `eslint-disable`. The test file may import `ReputationBlock` because B4 ignores `**/__tests__/**` (`SOURCE/eslint.config.mjs:42`).
- Rejected and **not to be re-proposed**: moving the block into `features/profile/**` with a data prop (duplicates or relocates the reputation type), an unnamed `children` slot (implicit purpose), a B4 `eslint-disable` exception (violates B4's own "no new disable" rule).

## Implementation Content

- `ProfileTabs` — a `role="group"` `aria-label="Mục hồ sơ"` with two `Chip`s (`h-11`, `aria-pressed`): "Tài khoản" (default, **no** query param) and "Bình luận" (`?tab=comments`). Selecting pushes the URL via `router.push(…, { scroll: false })` inside `startTransition` (`ExamFilters.tsx` precedent). Clicking "Bình luận" calls `markCommentsRead()` as a silent background side effect (frontend DD rate-limit table: "silent retry-next-visit — no user-blocking error UI"), after the tab's server-rendered count has been shown.
- `SOURCE/app/(analytics)/profile/page.tsx` parses `searchParams.tab === "comments" ? "comments" : "account"` (unrecognized → account, never blank) and server-renders only the active tab's content (UI-D15), keeping the markdown/KaTeX chunk out of `/profile`'s first bundle. On the account tab it calls `getMyReputation()` and composes the `reputationSlot`.
- `ProfileCard` — the one new optional prop `reputationSlot?: ReactNode` at the position above. No new state, effect, heading or input; **with no slot the DOM is identical to today**; every other behaviour (avatar, display name, password, sign-out) is unchanged (AC-096).
- `ReputationBlock({ totalScore, publishedCount, helpfulCount, pinnedCount })` — the same field names as `getMyReputation()`'s success data (task 43). Root `border-border mt-5 border-t pt-4 flex flex-col gap-3`; **no heading** (eyebrow `<span>` only) and no resting `<input>`; total score + the two count lines; 3 badge tiers "Mở đường" / "Dẫn lối" / "Trụ cột" unlocking at `publishedCount` ≥ 1 / 5 / 20 with locked-state styling; states reputation-zero ("Chưa có bài giải nào đã đăng" + 3 locked tiles), default, tier-relock (a tier re-locks when the published count drops). `pinnedCount` is carried for parity with the query result and is **not rendered** (UI Spec `C-34` has no pinned line). `totalScore` is never recomputed on the client.
- **Copy keys owned here**: `profile.tabs.*` and `profile.reputation.*` added verbatim from the UI Spec list; the `profile.description` **value change** ("Tài khoản, uy tín và bình luận về bài giải của bạn."); and the three dead keys `profile.tab.info`, `profile.tab.usage`, `profile.eyebrow` **removed** (`MessageKey = keyof typeof copy` turns any surviving reader into a `tsc` error, which is the removal's own proof). Keys are cited by name, never by line number.

## Acceptance Criteria

From the plan (§ P5-T5): **AC-087, AC-089, AC-090, AC-095, AC-096**.

From frontend DD v1.6 § Acceptance Criteria, the rows this file owns:
- **When** `getMyReputation()` returns its success data on the `/profile` account tab, the system renders `ReputationBlock` inside `ProfileCard` (passed as `reputationSlot`) before the "Đổi mật khẩu" button, with zero headings and no `<input>` other than the file picker inside the card. (AC-087, UI-D14)
- **If** `getMyReputation()` returns its failure result or throws, **then** the system renders `ProfileCard` without the reputation block and **without any error banner**, with avatar, name, password and sign-out controls unchanged. (AC-096)

Carried hard constraints that apply to this task:
- B4 holds **by construction** (the page composes the slot; `ProfileCard` imports nothing from `@/features/solutions/**`) — never an `eslint-disable`; data only via `SOURCE/features/solutions/queries.ts`/`actions.ts`.
- `SOURCE/features/profile/__tests__/ProfileCard.test.tsx`'s existing constraints (no `<h1>`–`<h3>`, no resting `<input>` beyond the file picker) stay green, extended with a reputation case.
- Vietnamese strings only via `SOURCE/lib/copy.ts` (`profile.tabs.*`, `profile.reputation.*`; `profile.description` new value; dead keys `profile.tab.info`, `profile.tab.usage`, `profile.eyebrow` removed per UI Spec § Đổi giá trị / xoá); 360px floor; 44px chips; "Đêm hội" tokens only; motion only via existing `.motion-*` / `usePresence`.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/ProfileTabs.tsx` (new, client)
- [x] `SOURCE/features/solutions/components/ReputationBlock.tsx` (new, **server** — no `"use client"`, not `async`)
- [x] `SOURCE/app/(analytics)/profile/page.tsx` (tab parse + `getMyReputation()` + composes `reputationSlot`)
- [x] `SOURCE/features/profile/components/ProfileCard.tsx` (**one** new optional prop `reputationSlot?: ReactNode`)
- [x] `SOURCE/lib/copy.ts` (`profile.tabs.*`, `profile.reputation.*`, the `profile.description` value change, the 3 dead-key removals)
- [x] Tests: `SOURCE/features/profile/__tests__/ProfileCard.test.tsx` (two added cases) + component tests for `ProfileTabs`/`ReputationBlock`
  - Also added: `SOURCE/features/solutions/lib/profileTab.ts` (new — pure `parseProfileTab()` whitelist, Refactor-phase extraction shared by the page and by its own test) + `SOURCE/features/solutions/__tests__/profileTab.test.ts`, `SOURCE/features/solutions/components/__tests__/ProfileTabs.test.tsx`, `SOURCE/features/solutions/components/__tests__/ReputationBlock.test.tsx`, `SOURCE/app/(analytics)/profile/__tests__/page.test.tsx` (new — AC-096 failure/throw path, since that path is the page's responsibility, not `ReputationBlock`'s)

## Investigation Targets
- `SOURCE/features/profile/components/ProfileCard.tsx` (client component, `{ user }` prop, identity cluster → `PasswordRow` order)
- `SOURCE/features/profile/__tests__/ProfileCard.test.tsx` (lines ~36–65: no heading / no resting input constraint)
- `SOURCE/app/(analytics)/profile/page.tsx` (current composition)
- `SOURCE/features/exams/components/ExamFilters.tsx` (lines ~83–110: `useTransition` + `router.push` precedent)
- `SOURCE/eslint.config.mjs` (B4, lines ~27–56)
- `SOURCE/components/ui/chip.tsx`
- `SOURCE/features/solutions/queries.ts` (`getMyReputation`, task 43), `SOURCE/features/solutions/actions.ts` (`markCommentsRead`, task 26)
- `docs/design/community-solutions-frontend-design.md` (§ Main Components — `ProfileCard.tsx` "one new optional prop" incl. the exact insertion point, and `ReputationBlock.tsx`)
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives **Element 4** — `ProfileCard.reputationSlot`, Alternative A selected, engineer decision final, with the rejected-alternatives log)
- `docs/design/community-solutions-frontend-design.md` (§ UI Spec Deviations DD-U1)
- `docs/design/community-solutions-frontend-design.md` (§ Component Props Change Matrix)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — "`ProfileCard.test.tsx` extended with two cases (frontend task 44)", both spelled out)
- `docs/design/community-solutions-frontend-design.md` (§ UI Error State Design — the `ReputationBlock` row: failure means no slot, no banner)
- `docs/design/community-solutions-frontend-design.md` (§ Vietnamese Copy Keys — the `profile.description` value change and the three dead-key removals owned by this task)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — the reputation four-number row, and the `attemptId`/`q`/`comments`/`tab` URL params row)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ProfileTabs — verify account (default) + comments states)
- `docs/ui-spec/community-solutions-ui-spec.md` (§ Component: ReputationBlock — verify reputation-zero + default + tier-relock states)
- `docs/ui-spec/community-solutions-ui-spec.md` (`UI-D14`, `UI-D15`; golden state 12; § Yêu cầu trợ năng row `C-33`)
- `docs/prd/community-solutions-prd.md` (AC-087, AC-089, AC-090, AC-095, AC-096)

## Boundary Context
(From the work plan's Connection Map — "URL query string (`?q`, `?comments`, `?tab`) + `attemptId` path segment"; this task owns `?tab`)
- **Producer**: `ProfileTabs` (client, `router.push`) and `CommentNotificationCard` links (task 45).
- **Consumer**: `ProfilePage` Server Component parse.
- **Serialized format** (verbatim): "`?tab=comments` (whitelist)".
- **Consumer parse rule** (verbatim): "exact-string whitelist compare".
- **Expected signal**: `?tab=comments` renders the comments tab with its chip `aria-pressed="true"`; absent or any other value renders the account tab, never a blank state.
- **Roundtrip check**: clicking "Bình luận" produces `?tab=comments`, which the server parses back to the comments tab; clicking "Tài khoản" removes the param.

## Investigation Notes

**Key interfaces read before implementation:**
- `ProfileCard.tsx` (`SOURCE/features/profile/components/ProfileCard.tsx`): `"use client"`, `{ user: CurrentUserProfile }` props only prior to this task. Identity cluster (grid: avatar/name/email + avatar-change label) → `{avatarFile && <AvatarUploader/>}` → `<div className="border-border mt-5 border-t pt-4"><PasswordRow/></div>` → sign-out divider block. The exact insertion point for `reputationSlot` is between the `AvatarUploader` conditional and the `PasswordRow` wrapper `div`, confirmed against both the task file's § Placement and frontend DD `ProfileCard.tsx:234-246` citation.
- `ProfileCard.test.tsx`: existing constraints are `screen.queryByRole("heading")` must stay `null` and `container.querySelectorAll("input")` must stay `["file"]` at rest — both re-verified green after the change, and the two new required cases were added to the same file (B4-exempt `**/__tests__/**`, so it may import `ReputationBlock`).
- `ExamFilters.tsx:82-129`: `useRouter`/`usePathname`/`useSearchParams` + `useTransition`; `router.push(url, { scroll: false })` inside `startTransition`. `ProfileTabs` follows the same shape for the URL push, but adds local optimistic `useState` for the pressed chip because, unlike `ExamFilters`' `sort`/`selected` (which are pure server props with no optimistic layer), UI Spec's own matrix requires the just-clicked chip to show pressed *before* the transition/round-trip finishes (row "Đang chuyển ô": "chip vừa bấm đã ở trạng thái chọn — lạc quan").
- `eslint.config.mjs:27-56` (B4): per-feature `no-restricted-imports` blocking `@/features/<other>/**`; ignores `**/__tests__/**` and `**/*.test.{ts,tsx}`; does not restrict `app/**`. Confirmed `ProfileCard.tsx` has zero imports from `@/features/solutions/**` after the change (only a `ReactNode` type + existing `@/features/profile/**` imports).
- `chip.tsx`: `Chip` already sets `type="button"` and `aria-pressed={active}` internally (`Omit<ComponentProps<"button">, "type">`), so `ProfileTabs` never re-declares `type`.
- `queries.ts` `getMyReputation()` (task 43): returns `ReputationResult = ({ok:true} & ReputationSummary) | {ok:false}`; catches the RPC error and the "0 rows" defensive case itself (never throws for those). `ReputationBlock`'s prop names (`totalScore`/`publishedCount`/`helpfulCount`/`pinnedCount`) match `ReputationSummary` exactly.
- `actions.ts` `markCommentsRead()` (task 26): plain `user_profiles` update, not an RPC; its own doc comment instructs "gọi hàm này khi tab mở, KHÔNG BAO GIỜ gọi lúc component vừa mount trước khi dữ liệu … đã tải xong" — satisfied here because the call fires from the click handler itself (after the count was already server-rendered on a prior paint), never from a mount effect.

**Design decisions made during implementation (all within "implementation detail" — no escalation triggered):**
1. **`ProfileTabs` state model**: `activeTab: "account" | "comments"` prop (server-parsed, single source of truth for first paint and reload) + local `useState` for the pressed chip, synced on prop change via the React-docs "adjust state during render" pattern (`if (activeTab !== prevActiveTab) { setPrevActiveTab(activeTab); setTab(activeTab); }`) rather than `useEffect` — the effect version was written first and reverted because `eslint-plugin-react-hooks`'s `set-state-in-effect` rule flagged it (`--max-warnings 0`); the render-time version is React's own documented alternative for exactly this case ("adjusting state based on a prop change") and needed no rule exception.
2. **`getMyReputation()` call site**: `page.tsx` originally built the `<ReputationBlock/>` JSX directly inside the `try` block; `eslint-plugin-react-hooks`'s `error-boundaries` rule (`Avoid constructing JSX within try/catch`) flagged it. Fixed by extracting a `tryGetMyReputation()` helper that only awaits the query inside `try/catch` (returning `null` on throw), with JSX construction moved unconditionally after it — preserves the exact same AC-096 behavior (failure result or throw ⇒ no slot, no banner) without constructing JSX inside a catchable-but-uncaught render path.
3. **`parseProfileTab()` extraction**: put in a new, directive-free file `SOURCE/features/solutions/lib/profileTab.ts` (not inside `ProfileTabs.tsx`, which is `"use client"`) so the server `page.tsx` can import the pure whitelist function without pulling a client-module boundary into server code. This satisfies the Refactor-phase step "Tab parsing in one pure function" and is unit-tested directly (3 cases: `"comments"` → `"comments"`; `"xyz"` → `"account"`; `undefined` → `"account"`), which is also this file's executable proof for Required Test #4 ("Whitelist parse").
4. **Comments-tab content**: task 44's scope explicitly excludes `ProfileCommentsTab` (task 45, per plan § Technical Dependencies and Implementation Order Slice E and this task's own "Provides" line). `page.tsx`'s comments branch currently renders `null` with a comment pointing at task 45 — `ProfileTabs` itself and the account-tab path are fully wired and tested; the comments-tab body is an intentional, documented gap for the next task, not a defect of this one.
5. **`ReputationBlock` "Rỗng" (publishedCount === 0) right-side text**: UI Spec's `Rỗng` matrix row states one "dòng phụ" (singular), vs. the default state's two lines ("k bài giải đã đăng" / "h lượt hữu ích"). Implemented as: the whole two-line block is replaced by the single `profile.reputation.none` line when `publishedCount === 0`, rather than keeping the "helpful" line alongside it. Not covered by an explicit AC/test assertion either way; recorded here for visibility in case task 45 or review reads the zero state differently.
6. **Tier lock/unlock and "tier-relock"**: implemented as a pure function of `publishedCount` on every render (no stored high-water-mark) — `AC-088`'s "gỡ/ẩn một bài ⇒ huy hiệu khoá lại" is therefore automatically correct by construction (verified by a `rerender()` test going 5 → 4 published and confirming "Dẫn lối" re-locks), since the server always recomputes `totalScore`/`publishedCount` fresh (per `getMyReputation()`'s own doc comment, AC-086) and this component never caches a prior value.

**AC-096 "or throws" scope note**: `getMyReputation()`'s own contract says it never throws for RPC-error or 0-row cases (both map to `{ ok: false }`); the task file's AC-096 row and Required Test #8 nonetheless say "failure result or throws" as one rule, so `page.tsx` wraps the call in `try/catch` defensively for any *other* unexpected exception (e.g. a `createClient()` failure before `.rpc()` runs), converging both paths to "no slot, no banner." No design conflict found — this is additional defense-in-depth, not a contradiction of task 43's contract.

**Operation Verification (L1/L2):**
- L2 (tests): all 8 Required Tests written and green — 2 in `ProfileCard.test.tsx` (slot filled / no slot), 3 for `ProfileTabs`/page parse (`ProfileTabs.test.tsx` ×2 cases + `profileTab.test.ts` pure-function whitelist case), 3 for `ReputationBlock` (`ReputationBlock.test.tsx` covers tiers incl. relock + zero state; `app/(analytics)/profile/__tests__/page.test.tsx` covers the failure/throw path, since that branch is the page's responsibility, not the component's). Full `npm test` (2603 passed, 10 skipped, 0 failed), `npm run lint` (0 errors/warnings), `npx tsc --noEmit` (clean), and `npm run test:localdb -- --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` (7 files, 40 passed) all green — see the task-executor's final report for exact commands/output.
- L1 (real dev server, signed-in browser: open `/profile`, switch tabs, reload with `?tab=comments`): **NOT performed.** Per project convention (auto mode blocks Playwright/browser sign-in as the test account, `docs/plans/community-solutions-HANDOFF.md`), this step needs the engineer to log the shared Playwright CLI session in first. Recorded here as owed, not silently skipped — same status as every other L1 in this feature's completion notes.

## Required Tests (frontend DD v1.6 § Test Boundaries; work plan § P5-T5)

`getMyReputation` / `markCommentsRead` are mocked at the module boundary and the Next router is mocked. `ProfileCard.test.tsx` may import `ReputationBlock` because B4 ignores `**/__tests__/**`.

**`ProfileCard.test.tsx` — the two added cases, verbatim from the DD**
1. **Slot filled**: `render(<ProfileCard user={USER} reputationSlot={<ReputationBlock totalScore={32} publishedCount={2} helpfulCount={6} pinnedCount={0} />} />)` → `screen.queryByRole("heading")` is `null`; `Array.from(container.querySelectorAll("input")).map((i) => i.type)` equals `["file"]`; the text "Điểm uy tín" is present; the block's root **precedes** the "Đổi mật khẩu" button in document order (`compareDocumentPosition` returns `DOCUMENT_POSITION_FOLLOWING` for the button).
2. **No slot**: `render(<ProfileCard user={USER} />)` → no element with the text "Điểm uy tín"; the "Đổi mật khẩu" button (`profile.password.change`) and the "Đăng xuất" button (`common.signOut`) are present. **Every existing case in the file stays unchanged and green.**

**`ProfileTabs` / page parse**
3. **AC-095, both halves at once**: from the account tab (no param, account chip pressed), clicking "Bình luận" calls `router.push` with `?tab=comments` **and** leaves the comments chip `aria-pressed="true"`; clicking "Tài khoản" removes the param.
4. **Whitelist parse**: `?tab=xyz` (and an absent param) render the account tab, never a blank state.
5. **Mark-read side effect**: clicking "Bình luận" calls `markCommentsRead` exactly once; a rejected `markCommentsRead` renders **no** error UI of any kind.

**`ReputationBlock`**
6. **Tiers**: locked/unlocked states at `publishedCount` 0 / 1 / 5 / 20, including **tier-relock** when the published count drops.
7. **Zero state**: `publishedCount: 0` renders "Chưa có bài giải nào đã đăng" plus 3 locked tiles.
8. **Failure path**: with `getMyReputation()` failing or throwing, the page passes no slot — `/profile` renders with **no** reputation block **and no error banner**, and the avatar / name / password / sign-out controls are unchanged (AC-096).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write the failing tests in § Required Tests above, then run and confirm failure

### 2. Green Phase
- [x] Implement per § Placement (resolved): the `reputationSlot` prop, the server `ReputationBlock`, the page composition
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Tab parsing in one pure function
- [x] Confirm added tests and the existing `ProfileCard.test.tsx` cases pass

## Quality Assurance Mechanisms
- `features/profile/__tests__/ProfileCard.test.tsx` — Enforces: no heading, no resting `<input>` beyond the file picker inside `ProfileCard` — Covers: `ProfileCard.tsx` + `ReputationBlock.tsx`
- `npm run lint` (incl. B4) — Config: `SOURCE/eslint.config.mjs`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `npm run lint`; on the dev server as a writer with published solutions, open `/profile`, switch tabs, reload with `?tab=comments`.
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: tests and lint green; reputation block shows the RPC values; tab state survives reload via URL.
- **Failure response**: if lint reports a B4 violation, stop and re-read § Placement (resolved) — the page composes the slot and `ProfileCard` imports nothing from `@/features/solutions/**`; never add an `eslint-disable`.
- **Verification level**: L1 (profile page on dev) + L2 (new tests passing)

## Proof Obligations
- **Claim** (AC-095): URL reflects the selected tab **and** `aria-pressed` reflects it — both required simultaneously.
- **Primary failure mode**: the chip toggles visually but the URL is not updated (reload loses the tab), or the URL changes but `aria-pressed` lags.
- **Boundary to exercise**: rendered `ProfileTabs` with a mocked router + the page's server parse function.
- **State assertion**: account (no param, account chip pressed) → click "Bình luận" → `router.push` called with `?tab=comments` and comments chip `aria-pressed="true"`.
- **Mock boundary rationale**: Next router mocked; `markCommentsRead` mocked at the module boundary.
- **Residual**: unread chip count wiring in task 45.

- **Claim** (`ProfileCard.test.tsx` constraint): `ReputationBlock` adds no heading and no resting input.
- **Primary failure mode**: an `<h2>` for "Uy tín" breaks the card's heading contract.
- **Boundary to exercise**: rendered `ProfileCard` with reputation data.
- **State assertion**: N/A.
- **Mock boundary rationale**: none.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass; existing `ProfileCard.test.tsx` cases green
- [~] Operation verified per Operation Verification Methods above — L2 done (see Investigation Notes); L1 (real dev server, signed-in) **still owed to the engineer**, same as every other L1 in this feature per `docs/plans/community-solutions-HANDOFF.md`
- [x] Each Proof Obligation is met
- [x] `ProfileCard` has exactly **one** new prop (`reputationSlot?: ReactNode`) and imports nothing from `@/features/solutions/**`; with no slot its DOM is identical to before this task

## Notes
- Impact scope: task 45 adds the comments tab content, chip count, and re-measured skeleton.
- Scope boundary: other `ProfileCard` behaviour (avatar, display name, password, sign-out) unchanged; no second prop, no `children` slot.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
