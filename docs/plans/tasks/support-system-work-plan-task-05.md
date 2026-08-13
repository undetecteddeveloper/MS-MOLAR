# Task 05: `lib/mail/sendSupportNotification.ts` + `checkEnv.ts` + secret-scan + `nodemailer` dependency (Work Plan Phase 1, Task 1.2)

Metadata:
- Dependencies: none (independent of Phase 0's DB work — can proceed in parallel)
- Provides: `sendSupportNotification`/`composeSupportNotificationSubject` (consumed by task-06's `after()`-scheduled callback)
- Size: Medium (5 files: `sendSupportNotification.ts`, `checkEnv.ts`, `check-ai-key-bundle.mjs`, `package.json`, `i18n.test.ts`)

## Implementation Content

Add `nodemailer`/`@types/nodemailer` to `package.json`. Implement `sendSupportNotification`/`composeSupportNotificationSubject` in `SOURCE/lib/mail/sendSupportNotification.ts` (module-level `SUPPORT_MAIL_SUBJECT_PREFIX = "[report-ms] "` constant, named-constant SMTP timeouts `connectionTimeout=8000ms`/`greetingTimeout=5000ms`/`socketTimeout=8000ms`, never throws — degrades to `{ ok: false, error }` on any failure including an unconfigured env). Register `SUPPORT_NOTIFY_EMAIL`/`SUPPORT_SMTP_USER`/`SUPPORT_SMTP_APP_PASSWORD` in `checkEnv.ts` as optional/warn (extend `checkEnv.test.ts`'s `goodEnv()` + add 3 per-variable cases). Add the two new credential markers + `nodemailer` to `check-ai-key-bundle.mjs`'s SECRETS list. Implement `SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts` (mocked SMTP transport per the skeleton's Group 1-3), and add the **new** absence assertion to `SOURCE/lib/i18n/__tests__/i18n.test.ts` confirming neither `vi.ts` nor `en.ts` contains the substring `report-ms`.

## Target Files
- [ ] `SOURCE/package.json` (additive — `nodemailer`, `@types/nodemailer`)
- [ ] `SOURCE/lib/mail/sendSupportNotification.ts` (new)
- [ ] `SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts` (fill in the skeleton)
- [ ] `SOURCE/lib/env/checkEnv.ts` (additive — 3 new optional/warn entries)
- [ ] `SOURCE/lib/env/__tests__/checkEnv.test.ts` (extend `goodEnv()` + 3 new per-variable cases)
- [ ] `SOURCE/scripts/check-ai-key-bundle.mjs` (additive — SECRETS/marker list)
- [ ] `SOURCE/lib/i18n/__tests__/i18n.test.ts` (additive — new `report-ms`-absence assertion)

## Investigation Targets
- `SOURCE/lib/mail/__tests__/sendSupportNotification.int.test.ts` (full file — Group 1-3 Behavior/Proof Obligation blocks to implement against, including the `[report-ms] ` byte-identical-prefix matrix and the never-throws battery)
- `docs/design/support-system-backend-design.md` (§ Data Contracts — `sendSupportNotification`/`composeSupportNotificationSubject` literal code; § Integration Point Map — Env validation, Mail transport; § Logging and Monitoring — sensitive-data rule)
- `docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md` (§ Decision, § Implementation Guidance — Gmail SMTP + App Password transport, placement, data_flow, contract_schema, dependency_direction axes)
- `docs/prd/support-system-prd.md` (§ D10, § R16 — the `[report-ms] ` prefix contract, never localized)
- `SOURCE/lib/env/checkEnv.ts` + `SOURCE/lib/env/__tests__/checkEnv.test.ts` (current `goodEnv()` shape and an existing optional/warn entry to mirror, e.g. `GEMINI_API_KEY`)
- `SOURCE/scripts/check-ai-key-bundle.mjs` (current SECRETS list shape)
- `SOURCE/lib/i18n/dictionaries/vi.ts`, `en.ts` + `SOURCE/lib/i18n/__tests__/i18n.test.ts` (existing parity assertion — the new absence assertion is additive to this file)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Decision) | placement | Gmail SMTP + App Password via `nodemailer`, called only from the ticket-creation Server Action (Node runtime by construction); the mail module has no `"use client"` / Edge markers | Does `SOURCE/lib/mail/sendSupportNotification.ts` contain no `"use client"` directive and no Edge-runtime export, and is it importable only from a Node-runtime Server Action context (Y/N)? |
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | data_flow | "Wrap the entire send in a single try/catch; on any failure ... log full context ... and set the AC-032 notification-failure flag. Do not distinguish failure causes in the student-facing path — the student always sees success" | Does `sendSupportNotification` wrap its entire SMTP send in one try/catch, log full failure context, and return a uniform `{ ok: false, error }` shape regardless of failure cause (Y/N)? |
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | contract_schema | "Compose the D10 [report-ms] subject prefix from a single non-localized constant inside the mail module, applied identically regardless of transport (R16) — do not route it through SOURCE/lib/i18n/dictionaries/{vi,en}.ts" | Is `SUPPORT_MAIL_SUBJECT_PREFIX` a module-level constant in `sendSupportNotification.ts`, never a dictionary key, and does neither `vi.ts` nor `en.ts` contain the substring `report-ms` (Y/N)? |
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | placement | "Register the new SMTP credential variables in checkEnv.ts as optional/warn, mirroring the GEMINI_API_KEY and SUPPORT_NOTIFY_EMAIL precedents" | Are `SUPPORT_NOTIFY_EMAIL`/`SUPPORT_SMTP_USER`/`SUPPORT_SMTP_APP_PASSWORD` registered in `checkEnv.ts` as optional/warn (not required/error) entries (Y/N)? |
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | dependency_direction | "Keep the mail module's only caller the ticket-creation Server Action; do not give proxy.ts or instrumentation.ts any reason to import it" | Does a repo-wide search for imports of `sendSupportNotification` show `SOURCE/lib/support/actions.ts` (task-06) as the only caller, with no import from `proxy.ts` or `instrumentation.ts` (Y/N)? |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/support-system-backend-design.md (§ Data Contracts — `sendSupportNotification`/`composeSupportNotificationSubject`) | state-lifecycle-negative | "SUPPORT_MAIL_SUBJECT_PREFIX (\"[report-ms] \") is prepended to every subject this module ever composes, including on the path that is about to report a failure (AC-046)" | Does every code path through `sendSupportNotification` — including the one immediately before a caught failure is logged/flagged — compose a subject beginning with the exact literal `"[report-ms] "` (Y/N)? |
| docs/design/support-system-backend-design.md (§ Data Contracts — `composeSupportNotificationSubject`) | derived-display | "return value always starts with the exact literal \"[report-ms] \" (AC-043); the same call with two different translate functions (one per locale) yields two strings whose first 12 characters are byte-identical (AC-044); the token itself is a module-level constant, never a dictionary key, never passed through vi.ts/en.ts (R16)" | Does `composeSupportNotificationSubject`'s return value's first 12 characters equal `"[report-ms] "` literally for every intent × locale combination, and are the first 12 characters byte-identical between `vi` and `en` for the same intent (Y/N)? |
| docs/prd/support-system-prd.md (§ D10 / R16) | state-lifecycle-negative | "The token sits at the very start of the subject, is byte-identical in every email, and never varies by intent, by status, or by locale... is therefore not routed through SOURCE/lib/i18n/dictionaries/vi.ts / en.ts, is never localized or translated" | Does neither `vi.ts` nor `en.ts` contain the substring `report-ms` in any key or value (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `sendSupportNotification` (Node.js mail module) → Gmail SMTP inbox. This task owns the **left-side / producer** owner (`SOURCE/lib/mail/sendSupportNotification.ts`); the right side is an external Gmail SMTP mailbox (`SUPPORT_NOTIFY_EMAIL`), not a repo file.

- **Serialized Format**: RFC 5322 `Subject:` header, UTF-8, `[report-ms] ` leading literal.
- **Consumer Parse Rule**: the maintainer's own Gmail filter rule matches on the literal leading bytes (not app-controlled — this repo cannot verify the Gmail-side rule, only that the producer always emits the literal prefix).
- **Roundtrip check this task must satisfy**: every subject this module composes, on every code path including the failure-and-flag path, begins with the exact byte sequence `"[report-ms] "` — a Gmail filter matching on those leading bytes catches every notification email and misses none.
- **Expected Signal**: every notification email emitted by this module is captured by a single fixed Gmail filter; none is missed (proven by the Group 1 subject-prefix matrix in `sendSupportNotification.int.test.ts`, not by an actual Gmail inbox in this repo's test suite).

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular `checkEnv.ts`'s exact optional/warn registration pattern (mirroring `GEMINI_API_KEY`) and `check-ai-key-bundle.mjs`'s current SECRETS list shape.
- [ ] Write failing tests per the skeleton's Group 1-3 (subject-prefix matrix across 3 intents × 2 locales + failure-path prefix; `report-ms` absence in `vi.ts`/`en.ts`; never-throws battery for sync-throw/reject/unconfigured-env).
- [ ] Write failing `checkEnv.test.ts` cases for the 3 new variables.
- [ ] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [ ] Add `nodemailer`/`@types/nodemailer` to `package.json`.
- [ ] Implement `sendSupportNotification`/`composeSupportNotificationSubject` exactly per the backend DD's Data Contracts.
- [ ] Register the 3 env vars in `checkEnv.ts` as optional/warn.
- [ ] Add the 2 credential markers + `nodemailer` to `check-ai-key-bundle.mjs`'s SECRETS list.
- [ ] Add the `report-ms`-absence assertion to `i18n.test.ts`.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); re-confirm each Binding Decision's Compliance Check.
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: unit/integration coverage — Config: `SOURCE/vitest.config.ts` (`include: lib/**`)
- i18n dictionary contract tests — Enforces: vi/en key parity, no empty values, placeholder parity, new `report-ms`-absence assertion — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- `checkEnv` contract tests — Enforces: a fully-configured env produces zero problems; each new silent-failure mode caught with its concrete consequence string — Config: `SOURCE/lib/env/__tests__/checkEnv.test.ts`
- Production build in CI (`npx next build`) — Enforces: build correctness incl. Edge-bundle boundary violations — Config: `.github/workflows/ci.yml:74-80`
- Client-bundle secret scan (`npm run check:bundle`) — Enforces: scans for secret values/marker strings in client bundle output — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`

## Operation Verification Methods
- **Verification method**: `sendSupportNotification.test.ts`'s subject assertions across the full intent × locale matrix plus the failure branch, run against a mocked SMTP transport.
- **Success criteria**: all 3 skeleton groups green (8 proof obligations); `checkEnv.test.ts`'s 3 new per-variable cases green; `i18n.test.ts`'s new absence assertion green; `npm run check:bundle` recognizes the new markers.
- **Failure response**: if a locale/intent combination's prefix differs, check whether the prefix constant was accidentally routed through `translate()` instead of being prepended outside it. If the failure branch's subject differs from the success branch's, check whether failure-path subject composition uses a separate code path that skips the prefix.
- **Verification level**: L2 (new tests added and passing); the live-SMTP-latency unknown (backend DD `unknowns`) is a separate, non-blocking manual Integration Verification Point — verify once, early, with a real `after()`-scheduled send against the real dev SMTP credentials once Task 06 exists, tracked as a residual of this task.

## Proof Obligations
- **Claim**: every generated subject carries the exact `[report-ms] ` prefix at position 0, byte-identical across all 3 intents × 2 locales, including on the failure-and-flag path (AC-043, AC-044, AC-045, AC-046).
- **Primary failure mode**: a later edit moves human-readable copy ahead of the token, or the token is accidentally routed through `translate()` and picks up a locale-dependent variant, or the failure-path subject composition happens on a different code path than the success path and skips the prefix.
- **Boundary to exercise**: in-process unit/integration (mocked SMTP transport; real `SOURCE/lib/i18n/server.ts` `getTranslate()`, not mocked — a mocked translate function would defeat the point of proving locale-invariance).
- **State assertion**: N/A (pure composition + mocked transport, no persisted state).
- **Mock boundary rationale**: SMTP transport mocked per backend DD Test Boundaries (no live Gmail account/credential in CI); translate function real, to prove locale-invariance against the actual dictionaries.
- **Residual**: none — this is a fully provable-by-test claim.
- **Claim**: `sendSupportNotification` never throws or rejects out of its own boundary, including when the 3 SMTP/recipient env vars are unset (D5 backstop, `missing config`/`unavailable boundary` Failure Mode Checklist categories).
- **Primary failure mode**: an unconfigured-env case throws during module import or transport construction instead of degrading to `{ ok: false }`.
- **Boundary to exercise**: in-process unit (mocked transport forced to throw synchronously, forced to reject, and unset env vars).
- **State assertion**: N/A.
- **Mock boundary rationale**: SMTP transport and env vars mocked/unset for determinism.
- **Residual**: none.
- **Claim**: neither `vi.ts` nor `en.ts` contains the substring `report-ms` in any key or value (AC-044, second half).
- **Primary failure mode**: a future edit adds a `support.*` dictionary key/value containing the literal string `report-ms`, reintroducing a locale-dependent variant the D10 contract forbids.
- **Boundary to exercise**: in-process unit (source-text/dictionary-object read, not mocked).
- **State assertion**: N/A.
- **Mock boundary rationale**: none — dictionaries read directly.
- **Residual**: none.

## Completion Criteria
- [ ] All added tests pass (8 skeleton proof obligations + `checkEnv.test.ts` 3 new cases + `i18n.test.ts` new assertion)
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [ ] Matches the backend DD's Data Contracts §sendSupportNotification exactly, including never being importable from `proxy.ts`/`instrumentation.ts`'s unguarded scope
- [ ] `tsc`/lint clean; `npm run check:bundle` recognizes the new markers
- [ ] Production build (`npx next build`) shows no Edge-bundle boundary violation from this module
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/lib/mail/`, `SOURCE/lib/env/checkEnv.ts` (+ its test), `SOURCE/scripts/check-ai-key-bundle.mjs`, `SOURCE/lib/i18n/__tests__/i18n.test.ts` (additive only), `SOURCE/package.json` (additive only).
- Scope boundary: do not wire `sendSupportNotification` into `submitSupportTicket`'s `after()` callback here — that is task-06's responsibility; this task only builds and proves the mail module in isolation. Do not add any `support.*` key containing `report-ms` to `vi.ts`/`en.ts` — the prefix stays a module-level constant only.
