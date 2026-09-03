# Task 4.3 — app/(authoring)/layout.tsx

**Phase**: 4 · **Depends on**: 4.1 · **Type**: Connection/Integration

## Goal
Add `SOURCE/app/(authoring)/layout.tsx` mirroring `(exams)/layout.tsx`, rendering `SiteHeader`. **No admin route gate** (admin removed): the `(authoring)` pages (`/upload`, `/me/exams`, `/me/exams/[id]`) require only authentication (page guard → `/?auth=signin` for logged-out). Owner-only routes do not exist in this feature (the owner removes bad content out-of-band, Design Doc O-6).

## Files
New: `SOURCE/app/(authoring)/layout.tsx`.

## ACs / metrics
AC-002 (auth guard). No admin AC.

## Verification / Acceptance
A logged-out visit to `/upload` (or `/me/exams`) redirects to `/?auth=signin`; a logged-in user reaches the screens. No admin/role logic present.

## References
Design Doc §Change Impact Map (Indirect — layout); UI Spec S-01…S-03 entry conditions.
