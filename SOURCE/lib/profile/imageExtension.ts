// MIME → file extension for Storage object keys.
//
// RULE OF THREE, and the decision it forced (Design Doc C11). This map already
// exists twice — lib/support/actions.ts:22 (three image types) and
// app/(layer4)/actions.ts:55 (the same three plus application/pdf) — each with
// a comment explaining why it was written out rather than shared. changeAvatar
// would have been the third copy, which is where "two similar things" becomes
// "a thing that drifts", so it is extracted here instead.
//
// WHY UNDER lib/profile/ RATHER THAN lib/ugc/ OR A NEW lib/storage/: the two
// existing copies are not accidental duplication, they differ by their allowed
// SET, and the lib/ugc one deliberately includes PDF. Hoisting this into either
// of their modules means editing two shipped upload paths — exam upload and
// support tickets — for a change that has no other reason to touch them, and
// the riskier direction (avatars importing lib/ugc's PDF-bearing constants) is
// the exact mistake lib/support/validateScreenshot.ts:2-3 warns about. So the
// extraction lands in the feature that triggered it, exporting the generic half
// so the other two can converge here when either is next edited, rather than a
// fourth copy appearing.
//
// The MIME is only ever a string the browser supplied; checkAvatarFile has
// already restricted it to AVATAR_LIMITS.ALLOWED_MIME before this is reached.

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Extension for a Storage key, without the dot. Unknown MIME → `"bin"`,
 *  matching the `?? "bin"` fallback at lib/support/actions.ts:79 — an object
 *  with an odd extension is recoverable, a key built from `undefined` is not. */
export function extensionForMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? "bin";
}
