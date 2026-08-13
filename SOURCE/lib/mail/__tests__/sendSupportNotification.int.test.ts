// User Support System v1 — sendSupportNotification / composeSupportNotificationSubject
//   [integration] Test Skeleton
// Design Doc: docs/design/support-system-backend-design.md (v1.2, Data Contracts
//   §sendSupportNotification, Test Boundaries — planned
//   `lib/mail/__tests__/sendSupportNotification.test.ts`)
// PRD: docs/prd/support-system-prd.md (v1.2, D10, R16, AC-043, AC-044, AC-045, AC-046,
//   metric 14)
// Generated: 2026-08-13 | Budget Used (whole feature): integration 3/3, fixture-e2e
//   3/3, service-integration-e2e 1/2 — this file is integration slot 2/3. See
//   SOURCE/lib/support/__tests__/actions.int.test.ts (slot 1/3) and
//   SOURCE/app/(admin)/admin/tickets/__tests__/actions.int.test.ts (slot 3/3).
//
// Skeleton only — comments describing what the implementer must write. No imports, no
// executable assertions yet. Mocked SMTP transport per backend DD Test Boundaries
// (`SOURCE/lib/mail/sendSupportNotification.ts`'s SMTP transport — "Yes (mock,
// transport boundary); no live Gmail account or credential exists in CI"). Subject
// composition and error-handling logic are exercised for real; only the network/SMTP
// call is stubbed.
//
// File path follows the backend DD's own Implementation Path Mapping
// (`SOURCE/lib/mail/__tests__/sendSupportNotification.test.ts`) with the `.int.` infix
// this repo's Server-Action-adjacent test files use uniformly — see the sibling
// skeleton's naming-convention note for the same reasoning.

// =============================================================================
// Group 1 — [report-ms] subject-prefix contract: leading position, all intents,
//   both locales, byte-identical prefix, and the failure-and-flag path (D10, R16)
// =============================================================================
// AC: "Given any notification email emitted by the support system, for any of the
//   three intents, when its subject line is inspected, then the subject begins at
//   character position 0 with the exact literal `[report-ms]` followed by a single
//   space — nothing precedes it." (AC-043)
// AC: "Given the same ticket with the app in the `vi` locale and in the `en` locale,
//   when the two generated subject lines are compared, then their `[report-ms]`
//   prefixes are byte-identical..." (AC-044, first half)
// AC: "Given the automated test suite, when it runs, then it contains an assertion
//   over the generated subject line that fails if (a) the `[report-ms]` prefix is
//   absent or not in leading position, or (b) the prefix differs between the `vi` and
//   `en` locales or between the three intents..." (AC-045)
// AC: "Given every code path in the support system that composes an outbound
//   notification — including a send that later fails and is logged and flagged per
//   D5 — when the subject is composed, then it carries the same `[report-ms]`
//   prefix; no code path composes a support notification subject without it."
//   (AC-046)
// ROI: 76 (BV:7 x Freq:10 + Legal:true(+10) + Defect:6) — Legal:true because this is a
//   D10-locked, PRD-mandated machine-matching contract (the maintainer's single Gmail
//   filter depends on it holding exactly), not merely a stylistic convention.
// Behavior: `composeSupportNotificationSubject({ intent, shortRef, translate })` is
//   called for the full 3-intent x 2-locale (vi, en) matrix -> assert every result's
//   first 12 characters equal the literal `"[report-ms] "` exactly, and that the two
//   locales' prefixes are byte-identical per intent; then `sendSupportNotification` is
//   called with the SMTP transport mocked to throw -> assert the subject composed on
//   that failing path (before the throw is caught) still carries the identical prefix
//   (AC-046 — "including the failure-and-flag path").
// @category: core-functionality
// @lane: integration
// @dependency: SOURCE/lib/mail/sendSupportNotification.ts (composeSupportNotificationSubject,
//   sendSupportNotification) + mocked SMTP transport (nodemailer) + real
//   SOURCE/lib/i18n/server.ts getTranslate() (vi/en, not mocked — a mocked translate
//   function would defeat the point of proving locale-invariance against the real
//   dictionaries)
// @complexity: medium
// Primary failure mode: a later edit to the subject template moves human-readable copy
//   ahead of the `[report-ms]` token, or the token is accidentally routed through
//   `translate()` and picks up a locale-dependent variant, or the failure-path subject
//   composition happens on a different code path than the success path and skips the
//   prefix.
// Proof obligation:
//   (a) for each of the 3 intents x 2 locales (6 combinations), the composed subject's
//       first 12 characters are exactly `"[report-ms] "` (literal string equality, not
//       a substring/regex match that could pass on a near-miss);
//   (b) for each intent, the `vi` and `en` results' first-12-character slices are
//       byte-identical to each other (`===`), even though the remainder of the subject
//       differs by locale;
//   (c) with the mocked SMTP transport forced to throw, the subject that was composed
//       immediately before the throw (captured via a spy on
//       `composeSupportNotificationSubject` or on the transport's `sendMail` call
//       arguments, whichever the implementation exposes) still carries the identical
//       `"[report-ms] "` prefix (AC-046).

// =============================================================================
// Group 2 — `report-ms` token absent from both i18n dictionaries (AC-044, second half)
// =============================================================================
// AC: "...and given `vi.ts` and `en.ts`, when they are inspected, then neither
//   contains the token `report-ms` in any key or value — the prefix is supplied by a
//   single constant outside the i18n path." (AC-044, second half)
// ROI: 38 (BV:4 x Freq:4 + Legal:true(+10) + Defect:4) — Legal:true for the same D10
//   machine-matching-contract reason as Group 1; low BV/Freq because this is a static
//   drift guard, not a per-submission behavior.
// Behavior: read `SOURCE/lib/i18n/dictionaries/vi.ts` and `en.ts` as source text (or
//   their exported dictionary objects, whichever the implementation makes easiest to
//   assert against) -> assert the substring `report-ms` does not occur anywhere in
//   either file's keys or values. This is genuinely new coverage: the existing
//   `SOURCE/lib/i18n/__tests__/i18n.test.ts` parity test (vi/en key-set equality) has
//   no absence-of-a-specific-token assertion (backend DD Quality Assurance
//   Mechanisms, "adopted (new `support.*` keys must satisfy this; the `report-ms`
//   token must NOT appear in either file — this design adds a new absence
//   assertion)").
// @category: edge-case
// @lane: integration
// @dependency: SOURCE/lib/i18n/dictionaries/vi.ts, en.ts (read directly, not mocked)
// @complexity: low
// Primary failure mode: a future edit adds a `support.*` dictionary key or value that
//   contains the literal string `report-ms` (e.g. a well-meaning translator copies the
//   subject example verbatim into a help-text key), silently reintroducing a
//   locale-dependent variant of the token that AC-044 forbids, with nothing catching
//   it until the maintainer's Gmail filter quietly stops matching.
// Proof obligation:
//   (a) `Object.entries(vi)` (or the dictionary's actual export shape) contains no key
//       and no string value with `report-ms` as a substring;
//   (b) same assertion against `en`'s export.

// =============================================================================
// Group 3 — sendSupportNotification never throws (D5 backstop; unconfigured env
//   treated as an ordinary failure, not a thrown error)
// =============================================================================
// AC: "Given the mail transport throws, times out, or is unconfigured, when a student
//   submits, then the ticket row is still committed and the student sees the success
//   acknowledgement." (AC-031, the mail-module half — the caller-side half is proven
//   by the sibling submitSupportTicket skeleton's Group 4)
// ROI: 58 (BV:6 x Freq:7 + Legal:0 + Defect:8)
// Behavior: `sendSupportNotification` is called (a) with the mocked transport
//   configured to throw synchronously, (b) with it configured to reject the returned
//   promise, and (c) with `SUPPORT_SMTP_USER`/`SUPPORT_SMTP_APP_PASSWORD`/
//   `SUPPORT_NOTIFY_EMAIL` all unset -> every case resolves to `{ ok: false, error }`,
//   none of them rejects or throws out of `sendSupportNotification` itself.
// @category: edge-case
// @lane: integration
// @dependency: SOURCE/lib/mail/sendSupportNotification.ts + mocked SMTP transport +
//   mocked/unset env vars
// @complexity: low
// Primary failure mode: an unconfigured-env case throws during module import or
//   transport construction instead of degrading to `{ ok: false }` — this is exactly
//   the failure mode the backend DD calls out as needing to "keep the CI
//   placeholder-env build from breaking on import" (mirrors checkSchemaVersion.ts's
//   degrade-on-missing-env pattern).
// Proof obligation:
//   (a) a synchronous throw from the mocked transport is caught inside
//       `sendSupportNotification` and surfaces as `{ ok: false, error }`, never
//       propagated to the caller as a thrown exception or rejected promise;
//   (b) a rejected transport promise likewise resolves to `{ ok: false, error }`;
//   (c) with the three SMTP/recipient env vars unset, `sendSupportNotification`
//       resolves `{ ok: false, error }` without throwing at import time or call time.
