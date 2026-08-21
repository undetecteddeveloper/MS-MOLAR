// /profile — initials for the avatar fallback (Design Doc §Backend contracts).
//
// The dot is the ONLY separator worth handling: a display name must match
// DISPLAY_NAME_RE (letters and dots), so a space cannot occur in a stored name.
// Splitting on whitespace as well would be dead code pretending to be defensive.
//
// Never throws and never returns undefined — the caller renders this instead of
// an image, and an exception on that path turns "no photo" into "no page"
// (PRD AC-033b, AC-040).

/** First letter of each of the first two dot-separated segments, uppercased.
 *  One segment yields one character; nothing usable yields `""`. */
export function deriveInitials(displayName: string): string {
  return displayName
    .split(".")
    .filter((segment) => segment.length > 0)
    .slice(0, 2)
    .map(firstCharacter)
    .join("")
    .toUpperCase();
}

/** `Array.from` rather than `[0]`: index access returns a UTF-16 code unit, so
 *  a character outside the BMP would be cut in half into an unrenderable half
 *  surrogate. Vietnamese precomposed letters (Đ, Ứ) are inside the BMP today,
 *  which is exactly why the wrong version of this line would look correct. */
function firstCharacter(segment: string): string {
  return Array.from(segment)[0] ?? "";
}
