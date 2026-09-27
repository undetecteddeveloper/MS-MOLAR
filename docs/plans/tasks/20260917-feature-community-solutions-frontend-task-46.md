# Task 46: `AuthorIdentity` avatar wiring across list / view / comments

Metadata:
- **Layer**: frontend → routed to `task-executor-frontend` + `quality-fixer-frontend`
- **Plan task**: P5-T7
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T7)
- **Dependencies**: task 40 (P5-T1), task 42 (P5-T3)
- **Provides**: real avatars for named non-self authors on list cards, the view header, and comments
- **Size**: Small (3 files + component test)

## Implementation Content

Primarily a verification + wiring pass: confirm every `AuthorIdentity`-consuming call site in `SolutionCard` (task 17), `SolutionAuthorCard` (task 19), and `CommentItem` (task 28) passes the mapped identity (with the now-live `avatarUrl` from task 42) straight through to `AuthorIdentity` → `Avatar`, with no self/non-self condition and no extra prop that could drop the URL. Change component code only where a call site does not already pass the URL through. The `is_mine` guard removal already happened in task 06.

## Acceptance Criteria

From the plan (§ P5-T7): **AC-039 (avatar half, end-to-end)**.

Carried hard constraints that apply to this task:
- `SOURCE/lib/solutions/identity.ts` and `SOURCE/components/shared/Avatar.tsx` unmodified.
- Anonymous identities still render `AnonymousAvatar` with no `<img>`.
- 360px floor; "Đêm hội" tokens only.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/features/solutions/components/SolutionCard.tsx` (props wiring only — edit this file only when this task's component test fails for it) — verified, test passed unmodified, no edit needed
- [x] `SOURCE/features/solutions/components/SolutionAuthorCard.tsx` (props wiring only — edit this file only when this task's component test fails for it) — verified, test passed unmodified, no edit needed
- [x] `SOURCE/features/solutions/components/CommentItem.tsx` (props wiring only — edit this file only when this task's component test fails for it) — verified, test passed unmodified, no edit needed
- [x] Component test under `SOURCE/features/solutions/components/__tests__/` — `AuthorIdentityAvatarWiring.test.tsx` (new)

## Investigation Targets
- `SOURCE/features/solutions/components/{SolutionCard,SolutionAuthorCard,CommentItem,AuthorIdentity}.tsx`
- `SOURCE/lib/solutions/identity.ts` and `SOURCE/lib/solutions/__tests__/identity.test.ts` (task 06's non-self pass-through case)
- `SOURCE/features/solutions/queries.ts` (task 42 signer integration)
- `SOURCE/components/shared/Avatar.tsx`
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives — Frontend Element 1: real avatar for every named author, Alternative A, confirmed)
- `docs/prd/community-solutions-prd.md` (AC-039)

## Boundary Context
(From the work plan's Connection Map — "`avatars` Storage object path → signed URL"; this task is the final render consumer)
- **Serialized format** (verbatim): "Storage object path `{owner_uuid}/{filename}` → signed URL string with expiry".
- **Consumer parse rule** (verbatim): "a `null`/failed sign is indistinguishable from 'no avatar' (fail-closed to `Avatar.tsx`'s initials fallback)".
- **Expected signal** (verbatim): "Named author's avatar renders for self AND non-self rows once the policy is live; renders initials with no error if not".
- **Roundtrip check**: a signed URL string on a non-self named item arrives unchanged as the `src` of the rendered `<img>` in all three components.

## Investigation Notes
(Append observations here before implementation begins. Record per call site whether a code change was needed.)

- **`SolutionCard.tsx`**: `AuthorIdentity` được gọi là `<AuthorIdentity identity={item.author} size={32} />` (dòng 84) — không điều kiện, không prop phụ nào giữa `item.author` và `AuthorIdentity`. `item.author` đến từ `mapSolutionListRow` (`queries.ts:320-336`), gọi `toAuthorIdentity({ author_display_name, author_avatar_url: resolvedAvatarUrl(...) })` — `resolvedAvatarUrl` tra `signedByPath` (task 42's `resolveAuthorAvatarUrls`, ký cả lô, không lọc theo `is_mine`). **Không cần sửa** — call site đã đúng từ trước.
- **`SolutionAuthorCard.tsx`**: `<AuthorIdentity identity={solution.author} size={32} />` (dòng 80) — tương tự, không điều kiện. `solution.author` đến từ `mapSolutionDetailRow` (`queries.ts:561-577`), cùng khuôn `resolvedAvatarUrl` + `signedByPath` từ `resolveAuthorAvatarUrls(supabase, collectNamedDetailAvatarPaths(row))` (một lượt ký cho cả header lẫn mọi bình luận, `getSolutionDetail`). **Không cần sửa**.
- **`CommentItem.tsx`**: `<AuthorIdentity identity={comment.author} size={28} />` (dòng 133) — tương tự. `comment.author` đến từ `mapSolutionDetailComment` (`queries.ts:467-485`), dùng CHUNG `signedByPath` với header (một lượt ký, task 42 Proof Obligation 1 "detail with 3 comments -> 1 call covering header + comments"). **Không cần sửa**. (Lưu ý riêng: `mapMyCommentFeedItem`/comment feed "Bình luận của tôi" — dòng ~657 — cố ý gửi `author_avatar_url: null` tường minh, "no batch avatar signer wired into this surface" — đây KHÔNG phải bề mặt của task này, không đụng tới.)
- **`AuthorIdentity.tsx`**: `Avatar` nhận `src={identity.avatarUrl ?? null}` không điều kiện self/non-self — không sửa (ngoài Target Files, chỉ đọc để xác nhận).
- **Kết luận Red Phase**: viết test mới `AuthorIdentityAvatarWiring.test.tsx` (9 case: 3 component × {non-self named có avatarUrl → `<img src>` đúng URL, named không avatarUrl → chữ cái đầu không lỗi, anonymous → không `<img>`}) — chạy ngay lần đầu, CẢ 9 case đều XANH ngay từ đầu (không phải Red→Green, mà Green ngay — xác nhận không component nào cần sửa). Không có prop phụ nào từng được thêm để mang avatar riêng, nên Refactor Phase không có gì để xoá.
- **L1 (dev, cross-user)**: bật `next dev` (SOURCE), THỬ session Playwright CLI dùng chung — `node scripts/pw/cli.mjs goto "http://localhost:3000/"` trả về trang chủ bình thường (route công khai, không tự nói lên trạng thái đăng nhập); thử tiếp `goto "http://localhost:3000/profile"` (route cần đăng nhập) → bị chuyển hướng `http://localhost:3000/?auth=signin`. Xác nhận session CHƯA đăng nhập. DỪNG L1 theo đúng chỉ dẫn, đã tắt `next dev` ngay sau đó — nợ lại: cần engineer đăng nhập user B trước (qua session Playwright CLI dùng chung), rồi verify cross-user avatar trên list/solution/comment sheet của user A named có avatar.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write a component test rendering each of the three components with a non-self named item carrying `avatarUrl: "https://…/signed?token=abc"` and asserting `<img src>` equals it; plus an item without `avatarUrl` → initials, no error; plus an anonymous item → no `<img>`
- [x] Run; if it already passes for a component, record that no change is needed there — all 9 cases passed on first run for all three components

### 2. Green Phase
- [x] Fix only the call sites that fail — none failed, no fixes needed
- [x] Run the test and confirm it passes

### 3. Refactor Phase
- [x] Remove any now-unused prop introduced earlier to carry avatars separately — none found
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm run lint` (incl. B4) — Covers: `SOURCE/features/solutions/**`
- `npm test` — Config: `SOURCE/vitest.config.ts`
- `npm run test:fixture` — Test 2 anonymity assertions stay green
- `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` and `test:fixture`; on the dev server as user B, open a list/solution/comment sheet authored by user A (named, with an avatar).
- **Sign-in precondition** (project memory): auto mode denies Playwright/browser sign-in as the test account — before any signed-in browser step, ask the engineer to log the shared Playwright CLI session in; if that session is unavailable in this run, stop and report which step needs it (never skip the step silently). Run the Playwright CLI from inside `SOURCE/`, never while `next build` is running.
- **Success criteria**: A's real avatar renders for B on all three surfaces; an anonymous row still shows `AnonymousAvatar`; fixture Test 2 green.
- **Failure response**: if the avatar renders only for self rows, look for a reintroduced `is_mine` condition and remove it — never add one.
- **Verification level**: L1 (avatars visible cross-user on dev) + L2 (component test passing)

## Proof Obligations
- **Claim** (EARS, verbatim): "the system shall set `avatarUrl` on the resulting `AuthorIdentity` regardless of whether `isMine` is `true` or `false`."
- **Primary failure mode**: a component drops `avatarUrl` for non-self rows, so other users see initials despite a live policy.
- **Boundary to exercise**: rendered components with a real signed-URL string (non-self named item).
- **State assertion**: N/A.
- **Mock boundary rationale**: none — components render with fixture props.
- **Residual**: Storage policy behaviour proven in task 40; batch signing in task 42.

## Completion Criteria
- [x] Added test passes for all three components — 9/9 in `AuthorIdentityAvatarWiring.test.tsx`
- [x] Operation verified per Operation Verification Methods above — L2 done (component tests green); L1 attempted per protocol, shared Playwright CLI session not signed in (`/profile` → `/?auth=signin`), stopped without self-signing in — recorded as debt for engineer (see Investigation Notes)
- [x] Each Proof Obligation is met — roundtrip test exercises the non-self named boundary with a real signed-URL string across all three components

## Notes
- Impact scope: list, view, comment sheet.
- Scope boundary: `identity.ts` and `Avatar.tsx` unchanged.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`. Stage only this task's files by explicit path.
