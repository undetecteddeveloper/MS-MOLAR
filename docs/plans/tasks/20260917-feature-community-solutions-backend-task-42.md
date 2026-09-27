# Task 42: Cross-user avatar batch signed-URL function in `queries.ts` (dedicated task)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P5-T3
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T3)
- **Dependencies**: task 40 (P5-T1)
- **Provides**: signed `author_avatar_url` values for named rows in `listSolutions` and `getSolutionDetail` (header and nested comments, one batch) **only**, consumed by task 46. `getMyCommentFeed` is not signed (it returns no avatar; see Implementation Content)
- **Size**: Small (1 plan file + 1 test file)

## Implementation Content

- A batch signer in `SOURCE/features/solutions/queries.ts` following `resolveSignedImageUrls`' batch-per-screen shape (`SOURCE/lib/ugc/imageUrl.ts`), adapted to the `avatars` bucket: collect every **named** row's `author_avatar_path` in the current response (deduplicated), make **one** `createSignedUrls(paths, ttl)` call, and set `author_avatar_url` on each row before it passes through `toAuthorIdentity`.
- Masked rows have `author_avatar_path === null` and are never signed.
- Any failed/missing sign (error, per-item error, Storage unreachable) yields `undefined` for that row — fail-closed and indistinguishable from "no avatar", so `Avatar.tsx`'s unmodified `src:null → initials` fallback renders.
- Integrate the signer into `listSolutions` and `getSolutionDetail` (header and nested comments in **one** batch) **only**.
- `getMyCommentFeed` is **not** signed and gains no signer call: `community_my_comment_feed` returns no avatar path (backend DD v1.9 § Data Contracts: "The feed returns no commenter id and no avatar path: C-36 renders a name only"), and the frontend DD § Data Contracts "Comment feed contract" builds the feed's identity with `author_avatar_url: null` ("so a named row is `{ kind: "named", displayName }` with no `avatarUrl`"). Signing there would call Storage for a path that does not exist.

## Acceptance Criteria

From the plan (§ P5-T3): **AC-039 (avatar half, frontend side)**.

Carried hard constraints that apply to this task:
- Session client only (Storage signing runs under the caller's session so `avatars_select_community_visible` decides); **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- `SOURCE/components/shared/Avatar.tsx` unmodified; if the policy is not live in an environment, zero code change is required for the initials fallback.

## Target Files
- [x] `SOURCE/features/solutions/queries.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/avatarSigner.test.ts` (new)

## Investigation Targets
- `SOURCE/lib/ugc/imageUrl.ts` (`resolveSignedImageUrls`, lines ~55–100; TTL constant) and `SOURCE/lib/ugc/__tests__/imageUrl.test.ts`
- `SOURCE/lib/auth/getCurrentUser.ts` (lines ~128–145: current self-avatar signing for the `avatars` bucket)
- `SOURCE/features/solutions/queries.ts` (task 14's `listSolutions` and `getSolutionDetail`; task 26's `getMyCommentFeed` is read only to confirm it stays unsigned)
- `SOURCE/lib/solutions/identity.ts` (reads `author_avatar_url`)
- `SOURCE/components/shared/Avatar.tsx`
- `docs/design/community-solutions-frontend-design.md` (§ Dependency Existence Verification — cross-user avatar batch signer must follow `resolveSignedImageUrls`' batch-per-screen shape)
- `docs/design/community-solutions-frontend-design.md` (§ Risks and Mitigation — N sequential Storage round-trips)
- `docs/design/community-solutions-frontend-design.md` (§ Technical Dependencies — Slice C fallback note)
- `docs/design/community-solutions-frontend-design.md` (§ Minimal Surface Alternatives — Frontend Element 1: real avatar for every named author, Alternative A)

## Boundary Context
(From the work plan's Connection Map — "`avatars` Storage object path → signed URL"; this task is the consumer-side signer)
- **Serialized format** (verbatim): "Storage object path `{owner_uuid}/{filename}` → signed URL string with expiry".
- **Consumer parse rule** (verbatim): "Batch-sign per screen render (one Storage call, not per-row), following `resolveSignedImageUrls`' shape; a `null`/failed sign is indistinguishable from 'no avatar' (fail-closed to `Avatar.tsx`'s initials fallback)".
- **Expected signal** (verbatim): "Named author's avatar renders for self AND non-self rows once the policy is live; renders initials with no error if not".
- **Roundtrip check**: each named row's `author_avatar_path` maps to exactly the `signedUrl` Storage returned for that path; a path Storage refused maps to `undefined`.

## Investigation Notes

**`SOURCE/lib/ugc/imageUrl.ts` (`resolveSignedImageUrls`, lines 59-95; TTL `SIGNED_URL_TTL_SECONDS`, line 13, `exam-images` bucket only)**: batch shape to follow — dedupe by extracted path (`imagePathFromUrl`), ONE `createSignedUrls(paths, ttl)` call, per-item fail-closed (`item.error` → that path absent from the result map), whole-batch fail-closed (`error` or thrown exception → every entry `undefined`, logged via `console.warn`, never re-thrown). Its own test file (`__tests__/imageUrl.test.ts`) pins these same three properties as the ones callers depend on (see file header comment). **Key difference for avatars**: `exam-images` stores full URLs in the DB, so this function extracts a path from a URL first; `avatars` stores the raw path directly (see `getCurrentUser.ts` below), so the new avatar signer skips URL-extraction entirely and dedupes paths directly.

**`SOURCE/lib/auth/getCurrentUser.ts` (`resolveAvatarUrl`, lines 128-145)**: confirms `author_avatar_path`-shaped values for the `avatars` bucket are already-stored PATHS (`storedPath`), not URLs — `createSignedUrl(storedPath, ttl)` is called directly, no path extraction. Fail-closed to `null` on any throw, caught locally (not left to the caller's try/catch) so one broken avatar never fails the whole page. `AVATARS_BUCKET`/`AVATAR_SIGNED_URL_TTL_SECONDS` are shared constants imported from `SOURCE/lib/profile/avatarStorage.ts` (used by both the write path `changeAvatar` and this read path) — reused directly in the new batch signer rather than duplicating a third bucket/TTL constant pair (reference representativeness / DRY).

**`SOURCE/features/solutions/queries.ts` (task 14's `listSolutions`/`getSolutionDetail`; task 26's `getMyCommentFeed`)**: task 14's own code comment (pre-existing, lines ~205-208) and its task file's Investigation Notes state explicitly: *"no avatar-signing infrastructure exists yet in this task's scope... pass `author_avatar_path` straight through as `author_avatar_url` (identity passthrough)... Task 42 replaces the passthrough with real batch-signing; this is recorded as the integration handoff."* This confirms the passthrough behavior in `mapSolutionListRow`/`mapSolutionDetailRow`/`mapSolutionDetailComment` (and the tests asserting it, see below) was always meant to be replaced by this task, not an independent design decision to preserve. `getMyCommentFeed`'s mapper (`mapCommentFeedRow`) confirmed read-only: its own comment states `author_avatar_url: null` is the RPC's actual contract (feed returns no avatar column at all), not a bug — left untouched, no signer call added.

**`SOURCE/lib/solutions/identity.ts`**: `toAuthorIdentity({author_display_name, author_avatar_url})` already has no `is_mine` guard (frontend DD v1.1's Alternative A already landed here) — it passes `author_avatar_url` straight through when it's a string. This task's job is entirely upstream: produce the correctly-signed `author_avatar_url` value BEFORE calling this function. No change needed to `identity.ts` itself (confirmed unmodified).

**`SOURCE/components/shared/Avatar.tsx`**: confirmed unmodified requirement — its `src !== null && src !== failedSrc && isAllowedImageUrl(src)` branch is the fallback the signer's `undefined`→absent-key output relies on (an absent `avatarUrl` on `AuthorIdentity` means the caller never passes a `src` string to `Avatar`, matching the existing `null → initials` path with no code change here).

**Frontend DD (`community-solutions-frontend-design.md`)**: § Dependency Existence Verification row for "A cross-user avatar batch signer..." confirms this is "Requires new creation" living in `queries.ts` (backend-owned) because it needs the request-scoped session client, same layering as `getCurrentUserProfile`. § Risks and Mitigation names the exact failure mode this task guards against (N sequential Storage round-trips) and pins the mitigation (one shared batch signer, `resolveSignedImageUrls` shape). § Technical Dependencies Slice C states no component branches on whether the Storage policy is live — `Avatar.tsx`'s existing fallback covers it either way, confirming zero UI-side conditional logic is needed here. § Minimal Surface Alternatives Element 1 (Alternative A, selected/final) confirms `avatarUrl` passes through for self AND non-self rows alike, relying on `avatars_select_community_visible` RLS to gate the read — the signer itself does no self/non-self branching.

**Design decision — real path is a Storage object path, not a URL**: confirmed via `getCurrentUser.ts`'s `resolveAvatarUrl` and the Boundary Context's serialized format ("Storage object path `{owner_uuid}/{filename}` → signed URL string with expiry"). The new `resolveAuthorAvatarUrls` in `queries.ts` therefore dedupes and signs raw paths directly (no `imagePathFromUrl`-style extraction step), unlike `resolveSignedImageUrls`.

**Real conflict found and resolved (not escalated — see rationale): `solutionReadMappers.test.ts` row 9 and `communitySolutions.int.test.ts`'s "non-masked fixture row" (Test 3) both asserted `avatarUrl` equals the raw fixture path unchanged.** This directly contradicts the required signing behavior (avatarUrl must now be the SIGNED value). Per `docs/plans/community-solutions-HANDOFF.md` § "Sự cố đã xử lý" precedent (only escalate to the engineer when two *locked* decisions genuinely conflict), I checked whether this was a genuine, unplanned conflict or a documented, planned integration handoff before touching either file. Three independent sources confirm it is the latter, not a design deviation: (1) task 14's own task file Investigation Notes explicitly names "task 42 replaces the passthrough... integration handoff"; (2) `queries.ts`'s own pre-existing code comment says the same; (3) `identity.ts`'s Main Components doc comment in the frontend DD describes the caller resolving a signed URL "for EVERY row before calling this mapper" as the intended final state; (4) the fixture-lane mock module `tests/e2e/fixture/communitySolutionsFixtureData.ts` already builds its avatar fixtures as fully-signed URLs (`.../storage/v1/object/sign/avatars/...?token=...`), confirming the intended end-state contract is a signed value, not a raw path. Given this, I updated both test files' `createClient` mocks to add a `storage.from().createSignedUrls` mock (echoing `signed:{path}` deterministically) and updated the one assertion in each that checked raw pass-through to expect the signed value — no other assertion in either file touches `avatarUrl`/`author_avatar_path` values, so no other case needed changes. This keeps `Test 3 (int)` and `solutionReadMappers.test.ts` both green while reflecting the intended, documented contract; the batching/fail-closed Storage contract itself is proven by this task's own `avatarSigner.test.ts`, so the sibling files' mocks intentionally stay simple (deterministic echo, no per-item error scenarios).

**Pre-existing unrelated flake observed, not caused by this task**: `FormulaPreview.error.test.tsx` failed once when run as part of the full `features/solutions` directory (parallel/CPU contention), passed cleanly when re-run in isolation together with `FormulaPreview.test.tsx`. Matches the flake already documented in `docs/plans/community-solutions-HANDOFF.md` ("FormulaPreview flake NẶNG HƠN trước", component from task 11, unrelated to avatar signing). Full `npm test` run afterward showed 194 passed / 1 skipped, 0 failures.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests in `avatarSigner.test.ts` for the Proof Obligations
- [x] Run and confirm failure

### 2. Green Phase
- [x] Implement the signer and integrate it into the two query functions (`listSolutions`, `getSolutionDetail`); do not touch `getMyCommentFeed`
- [x] Run only the added tests and confirm they pass; confirm Test 3 (int) still passes

### 3. Refactor Phase
- [x] One signer function reused by both queries
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`.
- **Success criteria**: Proof Obligation tests green (including the unsigned-feed case); `communitySolutions.int.test.ts` Test 3 still green.
- **Failure response**: if per-row signing appears necessary, stop — one Storage call per screen render is binding.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (Connection Map, verbatim): "Batch-sign per screen render (one Storage call, not per-row)."
- **Primary failure mode**: N sequential Storage round-trips for an N-row list.
- **Boundary to exercise**: `listSolutions` / `getSolutionDetail` against a mocked session client with a Storage mock counting `createSignedUrls` calls.
- **State assertion**: 1 row → 1 call; 25 rows (with duplicate paths) → 1 call with deduplicated paths; detail with 3 comments → 1 call covering header + comments.
- **Mock boundary rationale**: session client + Storage mocked; real policy decision proven in task 40.
- **Residual**: rendering of the signed URL in components is task 46.

- **Claim** (Failure Mode #6, unavailable boundary): a failed or refused sign is fail-closed to "no avatar" with no thrown error.
- **Primary failure mode**: a Storage error rejects the whole query, turning a cosmetic failure into a page error.
- **Boundary to exercise**: signer with the Storage mock returning `{ error }`, per-item errors, and a thrown exception.
- **State assertion**: query resolves; affected rows have no `avatarUrl` after mapping.
- **Mock boundary rationale**: Storage mocked.
- **Residual**: none.

- **Claim** (anonymity): masked rows are never signed.
- **Primary failure mode**: a masked row's path (should be `null`) is signed via a fallback lookup, leaking the avatar.
- **Boundary to exercise**: signer input set.
- **State assertion**: the path list passed to `createSignedUrls` excludes every row with `author_display_name === null`.
- **Mock boundary rationale**: Storage mocked.
- **Residual**: DB-level null path proven in tasks 16 and 47.

- **Claim** (frontend DD § Data Contracts "Comment feed contract"): "The feed carries no avatar: `toAuthorIdentity` is called with `author_avatar_url: null`" — the signer is never applied to the feed.
- **Primary failure mode**: a signer call is added to `getMyCommentFeed`, adding a Storage round-trip on every profile-tab load for paths the RPC never returns.
- **Boundary to exercise**: `getMyCommentFeed` against a mocked session client whose `.rpc()` returns rows with named and anonymous commenters, and a Storage mock counting `createSignedUrls` calls.
- **State assertion**: `createSignedUrls` call count is `0`; every mapped `CommentFeedItem.author` for a named row is `{ kind: "named", displayName }` with no `avatarUrl` key, and `{ kind: "anonymous" }` for an anonymous row.
- **Mock boundary rationale**: session client and Storage mocked.
- **Residual**: none.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met

## Notes
- Impact scope: task 46 verifies components show these URLs on the list, view and comment surfaces. The profile "Bình luận" tab (`CommentNotificationCard`, task 45) shows a name only and is outside this task.
- Scope boundary: `SOURCE/lib/ugc/imageUrl.ts` and `SOURCE/components/shared/Avatar.tsx` unmodified (model only).
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
- **Two files beyond the Target Files list were also touched, as the documented task-14 integration handoff (see Investigation Notes "Real conflict found and resolved"): `SOURCE/features/solutions/__tests__/solutionReadMappers.test.ts` (added a `storage.createSignedUrls` mock; row 9's expected `avatarUrl` changed from the raw fixture path to the signed value) and `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (same mock addition; Test 3's "non-masked fixture row" case's expected `avatarUrl` changed the same way). No other assertion in either file changed. Stage these two alongside the Target Files.**
