// /profile — the display-name rule, in one place.
//
// The client-side filter below existed twice verbatim, in
// components/shared/HeaderProfile.tsx and features/auth/components/
// SidebarProfile.tsx, and /profile would have been the third copy. The server
// rules in updateProfile (features/auth/actions.ts) were a fourth statement of
// the same two constants, written as inline literals — so a change to the
// length cap had four places to miss.
//
// Client filtering is convenience, not enforcement: updateProfile re-checks
// every rule server-side (PRD AC-043–AC-045), because a crafted POST never runs
// the onChange handler.

export const DISPLAY_NAME_MAX = 12;

/** Letters (any script — `\p{L}` covers accented Vietnamese) and dots.
 *  Deliberately not `/g` or `/y`: a stateful regex reused across submissions
 *  alternates true/false on identical input. */
export const DISPLAY_NAME_RE = /^[\p{L}.]+$/u;

/** Drop every character the rule forbids, then cap the length — the shape a
 *  controlled input needs, where refusing a keystroke beats showing an error. */
export function filterDisplayNameInput(raw: string): string {
  return raw.replace(/[^\p{L}.]/gu, "").slice(0, DISPLAY_NAME_MAX);
}
