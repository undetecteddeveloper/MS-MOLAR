// /profile — avatar input limits (Design Doc profile-and-about-design.md
// §Backend contracts; ADR-0016 §Decision).
//
// WHY THIS IS NOT AN ADDITION TO lib/ugc/limits.ts, which already holds every
// other upload ceiling in this repo: that module's `LIMITS.ALLOWED_MIME`
// includes `application/pdf`, because it serves exam upload. Anything that
// reaches for the nearest constant there is one autocomplete away from letting
// a PDF through as a profile picture. `lib/support/validateScreenshot.ts:2-3`
// already had to write that warning down once — this file is the same warning
// expressed as a separate module instead of a comment somebody has to read.
//
// MAX_BYTES and ALLOWED_MIME are mirrored, with citations, by the `avatars`
// entry in supabase/setup-storage.ts. That mirror is the Storage-layer backstop
// (PRD AC-035); the enforcement point is the Server Action (AC-027–AC-030).

export const AVATAR_LIMITS = {
  MAX_BYTES: 2 * 1024 * 1024,
  ALLOWED_MIME: ["image/jpeg", "image/png", "image/webp"] as const,
} as const;

export type AllowedAvatarMime = (typeof AVATAR_LIMITS.ALLOWED_MIME)[number];
