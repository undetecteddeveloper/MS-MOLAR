# Task 6.1 — Navbar/profile — Upload + My exams (no admin)

**Phase**: 6 · **Depends on**: 4.3 · **Type**: Connection

## Goal
In `SiteHeader` and `HomeSidebar`, change `{label:"Import",href:"/admin/import"}` → `{label:"Upload",href:"/upload"}` for all users. **Do not add any admin "Review" item** (admin removed). Add "My exams" → `/me/exams` to `HeaderProfile`/`SidebarProfile` (between Edit and Sign out) (UI Spec D7).

## Files
`SOURCE/components/layout/SiteHeader.tsx`, `SOURCE/features/auth/components/HomeSidebar.tsx`, `SOURCE/components/shared/HeaderProfile.tsx`, `SOURCE/features/auth/components/SidebarProfile.tsx` (edits).

## ACs / metrics
AC-001. UI Spec §SiteHeader (nav extension), D7.

## Verification / Acceptance
Navbar reads "Upload" and routes to `/upload`; no admin item appears for anyone; "My exams" appears in the profile dropdown and routes to `/me/exams`.

## References
UI Spec D7, §SiteHeader.
