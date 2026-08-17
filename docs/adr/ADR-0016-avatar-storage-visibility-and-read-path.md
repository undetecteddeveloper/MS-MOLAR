# ADR-0016 Avatar Storage Visibility and Read Path

## Status

Accepted — 2026-08-17. Resolves the blocking storage decision for PRD `docs/prd/profile-and-about-prd.md` D3 (avatar bucket visibility) and its dependent acceptance criteria AC-030 through AC-037, AC-038 through AC-042.

- PRD: `docs/prd/profile-and-about-prd.md` — R5 (avatar upload), R6 (avatar rendered in header and homepage sidebar), U3 (what happens to the previous object when an avatar is replaced).
- UI Spec: `docs/ui-spec/profile-and-about-ui-spec.md` — avatar uploader state matrix, including the signed-URL-failed state.
- Existing convention this ADR extends: `SOURCE/supabase/setup-storage.ts:25-36,58-61` (bucket registration), `SOURCE/lib/ugc/imageUrl.ts:13-37` (`resolveSignedImageUrl`, the private-bucket read path), `SOURCE/supabase/schema.sql:1521-1533` (`support_screenshots_insert_own`, the uid-prefix ownership idiom).
- Prior art deliberately NOT followed: `SOURCE/lib/ugc/cropImages.ts:98` calls `getPublicUrl` on the **private** `exam-images` bucket and stores the resulting string as a stable identifier, not as a fetchable URL. That is an identifier-shape convention, not a public-bucket precedent.

## Context

This is the first user-uploaded **personal** image in the project. Every prior upload is either exam content (`exam-images`, `exam-uploads`) or a support-ticket attachment (`support-screenshots`).

Three facts constrain the choice, each verified against the repository rather than assumed:

1. **Every existing bucket is private.** `SOURCE/supabase/setup-storage.ts:58-61` calls `createBucket(bucket, { public: false, ...BUCKET_OPTIONS[bucket] })` — the `public: false` literal is unconditional and sits *before* the options spread, so per-bucket visibility is not currently expressible by that script at all. There is no public-bucket read path anywhere in the codebase; every consumer of a storage URL goes through a signing step.

2. **The subject of every avatar is a minor.** MS-MOLAR is an exam-prep platform for Vietnamese secondary and high-school students. A public Supabase Storage bucket serves its objects over unauthenticated HTTPS with no expiry. An object written once stays world-readable for as long as it exists, and — because the natural implementation writes to a stable key so the stored URL does not have to change — a replaced avatar leaves an orphan that is *also* permanently world-readable unless it is explicitly deleted. The failure mode is not "a URL leaks"; it is "a photograph of a child remains fetchable by anyone who ever saw the link, indefinitely, including after the user replaced or deleted it in the UI."

3. **The read path is hot.** `getCurrentUserProfile()` (`SOURCE/lib/auth/getCurrentUser.ts:26`) is called by six route-group layouts and `app/page.tsx`. Anything added there runs on essentially every authenticated page render. The team has recently tuned this exact path for LCP (commit `d33ba1b`, "perf(header): ưu tiên tải logo — LCP 4.6s là do chính nó bị lazy-load"), so added latency here is not free.

Facts 2 and 3 pull in opposite directions, which is what makes this a decision rather than a default.

## Options Considered

### Option A — Public bucket, store the public URL on `user_profiles.avatar_url`

- Read cost: zero. `getPublicUrl` is a pure string construction, no network call.
- Makes the PRD's literal wording ("update the profiles table with the new avatar URL") true without indirection.
- Requires restructuring `setup-storage.ts` so `public` is per-bucket rather than a hardcoded literal.
- **Breaks the project-wide private-bucket invariant**, and does so for the one bucket whose contents are personal data about children.
- Orphan objects from a replaced avatar remain world-readable. Deleting on replace reduces but does not eliminate the exposure, because the window between upload and replacement is unbounded and any URL observed during it keeps working.

### Option B — Private bucket, store the object path, resolve a signed URL at read time

- Preserves the invariant. Access requires a signature the server mints; an observed URL expires.
- Read cost: one Storage API round trip wherever an avatar renders. On the header path that is once per authenticated page render, from a `sin1` function colocated with Supabase.
- Follows an existing, tested pattern (`resolveSignedImageUrl`), including its fail-closed behaviour.
- Orphans are still worth deleting, but an undeleted orphan is not externally reachable.

### Option C — Private bucket, but render the avatar only on `/profile`; header and sidebar keep initials

- Read cost: zero on the hot path.
- Contradicts PRD R6, and ships an upload whose result is invisible everywhere the user actually looks at their own identity.

## Decision

**Option B.** The `avatars` bucket is created private, with a 2MB `fileSizeLimit` and `allowedMimeTypes` of `image/jpeg`, `image/png`, `image/webp` as a storage-layer backstop. `user_profiles.avatar_url` stores the **object path**, not a fetchable URL. Reads resolve a signed URL through the `resolveSignedImageUrl` pattern, failing closed to `undefined` so the UI falls back to initials rather than a broken image.

Write access is restricted by an RLS policy on `storage.objects` using the project's established uid-prefix idiom, `(storage.foldername(name))[1] = auth.uid()::text`, copied from `support_screenshots_insert_own`. Object keys are therefore `{auth.uid()}/{filename}`.

### Decision Details

| Item | Content |
|------|---------|
| **Decision** | Private `avatars` bucket; store object path; resolve signed URLs at read time; initials fallback when signing fails. |
| **Why now** | Bucket visibility cannot be changed after creation by `setup-storage.ts`, whose idempotency is "skip if exists" (`:54-57`) — it never reconciles the options or the `public` flag of an existing bucket. Getting this wrong means manual dashboard intervention on two Supabase projects, and in the public-first direction it means a window during which real user photographs were world-readable. |
| **Why this** | Fact 2 is a child-safety property and outranks Fact 3, which is a latency property with a known mitigation. The private path also costs nothing new to build: `resolveSignedImageUrl` already exists, is already fail-closed, and is already the shape every other storage consumer uses. Option A's only real advantage — zero read cost — is recoverable later without re-exposing anything (see Kill criteria), whereas Option A's disadvantage is not recoverable at all once objects have been served publicly. |
| **Accepted cost** | One Storage API round trip added to `getCurrentUserProfile()`, on ~7 call sites covering essentially every authenticated page render. Not yet measured. Must be measured during implementation; the measurement, not an estimate, decides whether the escape hatch below is taken. |
| **Known unknowns** | Real added latency of `createSignedUrl` from `sin1` against the colocated Supabase project. Whether signed-URL churn interacts badly with browser image caching when the TTL is short — mitigated by choosing a 1-hour TTL, matching `SIGNED_URL_TTL_SECONDS` in `lib/ugc/imageUrl.ts:13`, rather than a short one. |
| **Escape hatch** | If measurement shows the added round trip materially regresses the header path, fall back to Option C — keep the private bucket, render the avatar on `/profile` only, and let header and sidebar show initials. This preserves the safety property and costs only a feature, and it does not require touching storage at all. Do **not** resolve a latency problem by making the bucket public. |
| **Kill criteria** | If a future requirement genuinely needs unauthenticated avatar reads (e.g. public author profiles on shared exams), that is a new decision requiring its own ADR, an explicit consent surface, and a distinct bucket — not a visibility flip on this one. |

## Consequences

- `SOURCE/supabase/setup-storage.ts` gains an `avatars` entry in `BUCKETS` and a `BUCKET_OPTIONS` record. The `public: false` literal stays as-is (correct for this bucket), so no restructuring is needed.
- `SOURCE/supabase/schema.sql` gains `user_profiles.avatar_url text` (nullable, additive — the `handle_new_user()` trigger at `:29-54` inserts a fixed column list and is unaffected) and four `storage.objects` policies for the `avatars` bucket, each preceded by its own `drop policy if exists` line per the file's idempotency idiom.
- The schema fingerprint must be regenerated in the same change: run `npm test`, read the computed value out of the `schemaFingerprint.test.ts` failure message, write it into both `SOURCE/lib/schema/schemaFingerprint.ts` and the `insert into public.schema_version` block at the end of `schema.sql`, then re-run.
- **The DDL must be applied by hand to both Supabase projects** (`hynwleaxtbtjzkvpjsug` dev, `pebjdlbgbmizgfpuptjl` prod). There is no migration tool (TD-005). Both projects were verified at fingerprint `f525e3095339` on 2026-08-17 before this change, so there is no pre-existing drift to disentangle.
- `CurrentUserProfile` gains `avatarUrl: string | null`. Its two structurally-typed downstream consumers (`MenuUser` in `HeaderProfile.tsx:17`, and `HomeSidebar`'s inline prop type) must be widened deliberately, or the field will be fetched on seven hot paths and consumed by nothing.
- Replacing an avatar deletes the previous object on a best-effort basis, following the compensating-cleanup convention at `SOURCE/lib/support/actions.ts:106-114` — logged, never blocking the response. With a private bucket an undeleted orphan is not externally reachable, so this is hygiene rather than a security control.
