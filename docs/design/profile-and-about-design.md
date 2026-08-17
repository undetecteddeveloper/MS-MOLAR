# Design Doc — `/profile` account page and `/about` contact page

## Status

Draft — 2026-08-17.

**Scope note, stated so a later reader is not misled:** the fullstack recipe normally produces one Design Doc per layer. This is a single consolidated document covering backend and frontend. The merge was a deliberate compression, taken after four analysis agents had already produced ~800k tokens of verified fact and the remaining value of a second document round-trip was judgement, not discovery. Every *quality gate* is retained (code-verifier, security-reviewer, the four verify commands, `verify:schema`, `check:bundle`).

- PRD: `docs/prd/profile-and-about-prd.md` v1.1 (AC-001–AC-072, plus AC-033b and AC-063b).
- UI Spec: `docs/ui-spec/profile-and-about-ui-spec.md`.
- ADRs: `docs/adr/ADR-0016-avatar-storage-visibility-and-read-path.md`, `docs/adr/ADR-0017-about-page-public-path-admission.md`.

## Non-obvious constraints this design is shaped by

Each was verified against the repository this session. An implementation that violates one of these fails silently or in production, not in review.

| # | Constraint | Source |
|---|---|---|
| C1 | The cookie-bound Supabase client **writes session cookies**. Calling `signInWithPassword` on it to verify a current password mints a new session mid-request and rotates the caller's refresh token. Credential verification must use a throwaway client. | `SOURCE/lib/supabase/server.ts:13-40`, `cookieOptions.ts:22` |
| C2 | `guard()`'s first parameter is typed `keyof typeof RATE_LIMITS`. A new rate-limited action does not compile until `RATE_LIMITS` gains the key. | `SOURCE/lib/security/rateLimit.ts:187-192` |
| C3 | Editing `schema.sql` without regenerating the fingerprint in **two** places fails CI; regenerating without applying the DDL to **both** Supabase projects reproduces TD-005. | `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts:84-108` |
| C4 | `PUBLIC_PATHS` is asserted by exact array; `robots.ts` and `sitemap.ts` both carry comments requiring them to track it. | `SOURCE/lib/supabase/__tests__/publicPaths.test.ts:22-32` |
| C5 | `next.config.ts` declares no `images.remotePatterns`, so `next/image` cannot render a Supabase URL. Repo precedent is a plain `<img>` + inline eslint-disable + `isAllowedImageUrl` origin allowlist. | `SOURCE/next.config.ts`, `components/shared/QuestionFigure.tsx:26,50` |
| C6 | i18n CI asserts en/vi key parity, placeholder parity, non-empty values, and **under 10% byte-identical values**. Vietnamese copy must be real. | `SOURCE/lib/i18n/__tests__/i18n.test.ts:22-60` |
| C7 | Vitest has no `setupFiles`; `@testing-library/jest-dom` matchers are unavailable. Component tests need a `// @vitest-environment jsdom` first line and must assert on raw DOM. | `SOURCE/vitest.config.ts:17-20` |
| C8 | `components/ui/input.tsx` has **zero call sites** and violates the project's 44px touch floor and 4px input radius. Do not use it. | UI analysis; `MetadataFields.tsx:45-57` is the live convention |
| C9 | A `position: fixed` scrim inside a `backdrop-blur` ancestor collapses to a strip, with no CSS error. `SiteHeader` and `BottomNav` both use `backdrop-blur`. Only `DeleteDialog` portals. | `SOURCE/app/(layer4)/_components/DeleteDialog.tsx:7-16` |
| C10 | A live region whose text never changes is never announced after first mount. `SuccessToast`'s two-part markup is load-bearing, not decorative. | `SOURCE/components/ui/SuccessToast.tsx:13-20` |
| C11 | `EXT_BY_MIME` is already duplicated twice, each with a comment explaining why. A third copy crosses the Rule of Three. | `lib/support/actions.ts:22`, `app/(layer4)/actions.ts:55` |
| C12 | The auth module returns Supabase `error.message` **verbatim** to the client in six places. On a password path that is an oracle. | `SOURCE/app/(layer1)/actions.ts:42,81,128,144,187` |

## Data layer

### `user_profiles.avatar_url`

```sql
alter table public.user_profiles add column if not exists avatar_url text;
```

Nullable and additive. `handle_new_user()` (`schema.sql:29-54`) inserts a fixed column list and is unaffected — verified, not assumed. Stores the **object path** (`{uid}/{uuid}.{ext}`), never a fetchable URL (ADR-0016).

### `avatars` bucket

Registered in `setup-storage.ts` `BUCKETS`, with `BUCKET_OPTIONS.avatars = { fileSizeLimit: "2MB", allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"] }`. Created private by the existing unconditional `public: false`.

### Storage RLS

Four policies on `storage.objects`, each preceded by its own `drop policy if exists` line per the file's idempotency idiom, all using the uid-prefix predicate copied from `support_screenshots_insert_own`:

```sql
bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
```

`insert`, `update`, `delete`, and — unlike `support-screenshots` — **`select` as well**, because unlike support screenshots the owner reads their own object back through their own session client to mint the signed URL.

## Backend contracts

### `lib/profile/limits.ts`

```ts
export const AVATAR_LIMITS = {
  MAX_BYTES: 2 * 1024 * 1024,
  ALLOWED_MIME: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;
```

Declared here rather than extended onto `lib/ugc/limits.ts` because that module's own header warns against reusing its image constants across features (`validateScreenshot.ts:2-3` makes the same point).

**Correction (post-implementation).** This section originally specified a `"2MB"` string in `setup-storage.ts`, mirroring how `support-screenshots` declares `"8MB"`. That was a defect: Supabase parses `"2MB"` as **decimal** 2,000,000 bytes, while `MAX_BYTES` is binary 2,097,152 — a 97KB band in which a file passes the Server Action's check and is then rejected by Storage, surfacing to the user as "the picture was not saved, try again," advice that can never succeed. `setup-storage.ts` therefore imports `AVATAR_LIMITS` and passes the exact byte count, so the mirror is real rather than a comment asserting it is one. `support-screenshots` has the identical `"8MB"` vs 8,388,608 discrepancy; it was left alone deliberately, because "fixing" it would silently raise a live limit on a shipped upload path.

### `lib/profile/validateAvatar.ts`

```ts
export type AvatarCheck = { ok: true } | { ok: false; reason: "too_large" | "invalid_type" };
export function checkAvatarFile(file: { type: string; size: number }): AvatarCheck;
```

Pure, no I/O, takes a structural type rather than `File` so it is unit-testable and usable on both client and server — mirroring `checkScreenshotFile` exactly. MIME is checked **before** size, matching the existing validator's order. MIME is the browser-supplied string; there is no magic-byte sniffing anywhere in this repo and this design does not introduce it. The Storage-level `allowedMimeTypes` is the second layer.

### `lib/profile/initials.ts`

```ts
export function deriveInitials(displayName: string): string;
```

Display names match `/^[\p{L}.]+$/u` and are ≤12 chars, so **no spaces are possible** — the dot is the only available separator. Rule: split on `.`, drop empty segments, take the first character of the first two segments, uppercase. Single-token name yields one character. Empty or unusable input yields `""`, and the caller renders a neutral glyph rather than an empty circle. Uses `Array.from()` rather than index access so a Vietnamese precomposed character is taken whole.

### `changeAvatar` — `app/(layer1)/actions.ts`

```ts
export async function changeAvatar(_prev: AuthState, formData: FormData): Promise<AuthState>;
```

Order is fixed and mirrors `submitSupportTicket`, the repo's only end-to-end upload path:

1. `auth.getUser()` → `{ error: <i18n key> }` if absent.
2. `guard("uploadAvatar", user.id)`.
3. `checkAvatarFile({ type, size })`.
4. Key = `${user.id}/${crypto.randomUUID()}.${ext}` — a **fresh key per upload** (PRD U3), never a stable one, because a stable key plus a 3600s signed TTL means the old image keeps being served from cache under a still-valid signature.
5. `storage.from("avatars").upload(key, file, { contentType: file.type })`.
6. Read the previous `avatar_url`, write the new one to `user_profiles`.
7. Best-effort `storage.remove([previous])` — logged on failure, never blocking, never surfaced.
8. **Compensating cleanup on a failed DB write** (added during implementation, not in the original draft): if step 6's `user_profiles` update fails, the object uploaded in step 5 is already orphaned — the database points at nothing. It is removed before returning, mirroring `lib/support/actions.ts:106-114`. Logged by key only; the error is never masked.

Two supporting modules exist beyond the three listed below, both created during implementation:
- `lib/profile/avatarStorage.ts` — `AVATARS_BUCKET` and `AVATAR_SIGNED_URL_TTL_SECONDS`. This is a genuine **cross-slice contract**: the write path (`actions.ts`) and the read path (`getCurrentUser.ts`) must name the same bucket, and a typo between them produces initials everywhere with no error (PRD R-f). It is a shared constant precisely so that typo is impossible.
- `lib/profile/imageExtension.ts` — `extensionForMime`, the C11 Rule-of-Three extraction. The two pre-existing `EXT_BY_MIME` copies differ by allowed set (the UGC one includes `application/pdf`), so hoisting into either would mean editing a shipped upload path this change has no reason to touch — and pointing avatars at the PDF-bearing constants is the exact mistake `validateScreenshot.ts:2-3` warns about. The extraction therefore lands in the feature that triggered it and exports the generic half, so the other two can converge here when either is next edited rather than a fourth copy appearing.

### `changePassword` — `app/(layer1)/actions.ts`

```ts
export async function changePassword(_prev: AuthState, formData: FormData): Promise<AuthState>;
```

Fields: `currentPassword`, `password`, `confirm`.

1. `auth.getUser()`; capture `user.email`.
2. `guard("changePassword", user.id)` — **before** the credential check, so the endpoint cannot be used as a password-guessing oracle at speed.
3. `validatePassword(newPassword)`; `password !== confirm` → mismatch error.
4. **Current-password verification on a throwaway client** (C1):
   ```ts
   const probe = createSupabaseClient(url, anonKey, {
     auth: { persistSession: false, autoRefreshToken: false },
   });
   const { error } = await probe.auth.signInWithPassword({ email, password: currentPassword });
   ```
   This shape already appears 10+ times in `supabase/` scripts and tests; this is its first use in runtime code. It must **not** be the cookie-bound client.
5. `supabase.auth.updateUser({ password })` on the real session client.
6. `supabase.auth.signOut({ scope: "others" })` — revokes other refresh tokens, keeps the caller's session. Already-issued access tokens survive until expiry; the UI copy says "other devices will need to sign in again", never "signed out everywhere, immediately".

**Logging prohibition (C12).** No `console.*` on this path may receive `formData`, a password variable, or a raw Supabase `error` object. Supabase error strings are mapped to fixed i18n keys and never passed through — `updateUser` rejects with "new password should be different from the old password", which is itself an oracle. A wrong current password and a rate-limited request return distinguishable messages (the user needs to know which happened), but neither echoes provider text.

### `RATE_LIMITS` additions (C2)

```ts
changePassword: { limit: 5,  windowMs: 60 * 60 * 1000 },
uploadAvatar:   { limit: 10, windowMs: 60 * 60 * 1000 },
```

`changePassword: 5/hour` is deliberately far tighter than the surrounding entries (which are 15–40/hour), and the reason must be written inline in the house style: every other rate-limited action costs a row in our own database, whereas this one **accepts a credential** and therefore doubles as a guessing oracle. A real user changes their password approximately never; 5 is generous for a human and hostile to a loop. Window stays hourly because the constrained resource is our own auth endpoint, not a third-party per-day quota — the unit-matching rule at `rateLimit.ts:123-128` only forces a 24h window when the provider's quota is daily.

### `CurrentUserProfile`

Gains `avatarUrl: string | null` — the **resolved signed URL**, not the stored path, so consumers need no knowledge of storage. `getCurrentUserProfile()` selects `display_name, avatar_url` and resolves the signature, failing closed to `null`. `MenuUser` and `HomeSidebar`'s inline prop type widen to carry it; without that the field is fetched on seven hot paths and consumed by nothing.

**ADR-0016 measurement obligation:** the added `createSignedUrl` round trip must be measured before this is considered done. If it regresses the header path, take the escape hatch (photo on `/profile` only, initials in header) — never make the bucket public.

## Frontend contracts

Component decomposition is the UI Spec's; this section records only what binds it to the backend.

- `components/shared/Avatar.tsx` — NEW. Props `{ src: string | null; name: string; size: number; className?: string }`. Renders a plain `<img>` behind `isAllowedImageUrl` (C5) with the inline eslint-disable and a stated reason; falls back to `deriveInitials(name)` whenever `src` is null, fails the allowlist, or errors. Never renders a broken image (AC-033b).
- `app/(layer3)/profile/_components/ChangePasswordDialog.tsx` — copies the `SupportWidgetDialog` a11y pattern **and adds a real focus trap**, which no existing modal in this repo has. Portals to `document.body` and locks body scroll, following `DeleteDialog` (C9). Focus return to the trigger is the parent's job.
- `app/(layer3)/profile/_components/AvatarUploader.tsx` — copies the `ScreenshotAttachment` peer/`sr-only` picker (C8-adjacent): the real input stays in the a11y tree and keeps its tab stop, `e.target.value` resets on change so re-picking the same file re-fires, and the preview object URL is created in `useMemo` and revoked in an effect cleanup.
- Display-name editing reuses `updateProfile`. Its **behaviour** is unchanged — same rules, same emitted strings — but the function itself was edited: it now reads `DISPLAY_NAME_MAX` and `DISPLAY_NAME_RE` from `lib/profile/displayName.ts` instead of inline literals. `/profile` would have been the third client-side copy of the `/[^\p{L}.]/gu` + `slice(0,12)` filter (`HeaderProfile.tsx`, `SidebarProfile.tsx`); counting the server's own inline literals it is the fourth statement of the same constants. Both existing widgets import the shared module now.
- Success feedback is `SuccessToast` with a consumer-owned counter (C10).

## i18n

All new strings go into `en.ts` and `vi.ts` under a new `profile.*` area plus `about.*`, per the UI Spec's key table.

**Correction (post-implementation).** An earlier draft of this section said the five hardcoded English error strings in `updateProfile` would "gain keys and be returned as keys rather than sentences." That was wrong, and it contradicted its own upstream UI Spec. UI-D9 had already rejected changing `updateProfile`'s return shape, for a concrete reason: `HeaderProfile.tsx` and `SidebarProfile.tsx` render `state.error` **raw**, so switching the action to return keys would make those two widgets display `profile.name.errorEmpty` to users. The implementation follows UI-D9 — `updateProfile` still returns sentences, and `/profile` localises them client-side by exact-literal match in `app/(layer3)/profile/_components/errorMessages.ts`, guarded by a build-gate test that fails if the map drifts from `passwordPolicy.ts` or `updateProfile`. `resolveDisplayNameError` defaults any unrecognised string to `profile.error.generic` rather than displaying it, so `/profile` does **not** inherit the raw-passthrough the two dropdowns still have. Fixing those two widgets is separate work.

**`/about` placeholder values are deliberately NOT in the dictionaries.** The UI Spec's key table listed `about.owner.value` / `about.email.value` / `about.phone.value`; those were not created. A person's name, an email address and a phone number are byte-identical in both locales, and CI fails when more than 10% of dictionary values match byte-for-byte across locales (C6) — adding three guaranteed-identical entries spends that budget for nothing. Labels are translated; the three values live in one `CONTACT` const in `app/(billing)/about/page.tsx`, each marked `TODO: replace with real contact info`, which also makes swapping in real data a single-file edit.

**Cross-slice error wire format.** Server Actions return i18n **keys**, with one parsed exception: rate-limit rejections return `` `profile.error.rateLimited:${seconds}` ``. Producer is `rateLimitedKey()` in `app/(layer1)/actions.ts`; the consumer splits on the **last** `:` and passes `{ seconds }` to `t()`. This is the one part of the contract with a parsing rule, so it is written down here — a mismatch would typecheck on both sides and fail at runtime. `validatePassword`'s four sentences are the second exception: they arrive verbatim in English and are mapped client-side (UI-D10), because keying them server-side would create a second copy of the password policy.

## Testing

| Level | What it proves | Where |
|---|---|---|
| Unit | `checkAvatarFile` boundaries (exactly 2MB, 2MB+1, each allowed MIME, a rejected MIME), `deriveInitials` (single token, dotted, leading dot, empty, Vietnamese precomposed char) | `lib/profile/__tests__/` |
| Integration | `changePassword` rejects a wrong current password **and the caller's session survives**; succeeds and the session survives; never logs a credential. `changeAvatar` rejects bad MIME/size before upload. Supabase client mocked per `lib/support/__tests__/actions.int.test.ts` style | `app/(layer1)/__tests__/profileActions.int.test.ts` |
| Component | Avatar initials fallback; dialog focus trap and Escape; uploader rejection states. `// @vitest-environment jsdom` (C7) | colocated `__tests__/` |
| Policy | Real-Postgres proof that a user can read/write only their own `avatars` objects. **Vitest cannot prove this** — it mocks the Supabase client entirely | `supabase/test-rls.ts`, following the ST-a..ST-e precedent |

The session-survival assertion is the early verification point: it is the failure mode that otherwise surfaces only as sporadic random logouts in production, and it is cheap here and expensive later.

## Rollout

1. Data foundation → `npm test` (read the new fingerprint from the failure) → apply DDL to **dev** → `npm run verify:schema`.
2. Pure logic + tests.
3. Server Actions + integration tests.
4. `/about` + `PUBLIC_PATHS` + test + sitemap/robots (independent, lowest risk, ships alone).
5. `/profile` UI.
6. Header/sidebar avatar propagation + latency measurement.
7. Four verify gates + `check:bundle` + `verify:schema`.

**Production DDL is not applied by this change.** Per project Pha 3.5 the prod apply is an engineer decision on real data; both projects were verified at `f525e3095339` on 2026-08-17, so prod is currently in sync and will drift by exactly this change until applied.
