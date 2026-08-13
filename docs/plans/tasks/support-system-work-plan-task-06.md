# Task 06: `RATE_LIMITS.submitTicket` + `lib/support/actions.ts` (`submitSupportTicket`) (Work Plan Phase 1, Task 1.3)

Metadata:
- Dependencies: support-system-work-plan-task-03 (Deliverable: real applied+verified schema/RLS), support-system-work-plan-task-04 (Deliverable: `checkScreenshotFile`/`TicketIntent`/`SubmitTicketResult` types), support-system-work-plan-task-05 (Deliverable: `sendSupportNotification`)
- Provides: `submitSupportTicket` (consumed by task-09's live-wiring pass and task-11's fixture-e2e journey — component tests mock this boundary and are not blocked); `flagSupportTicketNotifyFailed` (`SOURCE/lib/supabase/service-role.ts`)
- Size: Medium (3 files: `actions.ts`, `service-role.ts` addition, `rateLimit.ts` addition)

## Implementation Content

Add the `submitTicket: { limit: 15, windowMs: 60 * 60 * 1000 }` keyed entry to `RATE_LIMITS`. Implement `submitSupportTicket(formData)` per the backend DD's Data Flow steps 1-9: auth check (no redirect, `{ error: "unauthenticated" }`) → `guard("submitTicket", user.id)` → validate intent/message → parse metadata (never blocks, AC-010) → `checkScreenshotFile` + server-proxied upload to `support-screenshots` at `${user.id}/${uuid}.${ext}` (TBD-02 resolved) → INSERT `support_tickets` (best-effort orphan cleanup on insert failure) → `after(() => sendTicketNotificationSafely(...))` registered before the return → `return { ok: true, shortRef: ticket.id.slice(0, 8) }`. Add `flagSupportTicketNotifyFailed` to `SOURCE/lib/supabase/service-role.ts`. Implement `SOURCE/lib/support/__tests__/actions.int.test.ts` (mocked Supabase client + mocked `after()`, per the skeleton's 4 groups).

## Target Files
- [ ] `SOURCE/lib/security/rateLimit.ts` (additive — `RATE_LIMITS.submitTicket`)
- [ ] `SOURCE/lib/support/actions.ts` (new — `submitSupportTicket`)
- [ ] `SOURCE/lib/support/__tests__/actions.int.test.ts` (fill in the skeleton)
- [ ] `SOURCE/lib/supabase/service-role.ts` (additive — `flagSupportTicketNotifyFailed`)

## Investigation Targets
- `SOURCE/lib/support/__tests__/actions.int.test.ts` (full file — Group 1-4 Behavior/Proof Obligation blocks, especially Group 4's fire-and-forget mail decoupling — this feature's single highest-value proof)
- `docs/design/support-system-backend-design.md` (§ Data Contracts — `submitSupportTicket` Data Flow steps 1-9 + Invariants; § Schema & DB Enforcement / TBD-02 resolution — server-proxied screenshot upload, Storage-native limits as backstop not primary gate; § Minimal Surface Alternatives Element 1 — `shortRef` derivation; § Field Propagation Map — screenshot File → Storage object path, `notify_failed` round trip; § Integration Point Map — Rate limiting, Storage upload; § Error Handling — student-path error matrix)
- `docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md` (§ Implementation Guidance — data_flow "call the mail send exactly once, from inside the ticket-creation Server Action, after the ticket row commit succeeds"; dependency_direction — mail module's only caller)
- `SOURCE/lib/support/types.ts`, `SOURCE/lib/support/validateScreenshot.ts` (task-04's output — `checkScreenshotFile`/closed unions this action consumes)
- `SOURCE/lib/mail/sendSupportNotification.ts` (task-05's output — the function this action's `after()` callback calls)
- `SOURCE/lib/security/rateLimit.ts` (current `RATE_LIMITS`/`guard()` shape — an existing entry to mirror)
- `SOURCE/lib/supabase/service-role.ts` (existing service-role function shape to mirror for `flagSupportTicketNotifyFailed`)
- A reference implementation of the `requireUser()`-vs-no-redirect deviation this action deliberately makes (backend DD's own documented rationale) — read the backend DD's Error Handling / Data Contracts sections for the exact wording to preserve in a comment.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/support-system-backend-design.md (§ Minimal Surface Alternatives Element 1 / Data Contracts §submitSupportTicket) | derived-display | "First 8 hex chars of id" — `shortRef` derivation, returned as `{ ok: true, shortRef: ticket.id.slice(0, 8) }` | Does the success response's `shortRef` field equal `ticket.id.slice(0, 8)` exactly, computed at read time with no stored column (Y/N)? |
| docs/design/support-system-backend-design.md (§ Data Contracts — `submitSupportTicket` Invariants) | state-lifecycle-negative | "sendSupportNotification is called at most once per submission, only after the INSERT has succeeded (D5), and only via an after()-registered callback that Next.js guarantees runs after this action's response has already been sent to the client" | Is `after()` called with the mail-send callback only after the INSERT resolves successfully, and does the action's returned promise resolve before that callback has been invoked or its inner `sendSupportNotification` promise even created (Y/N)? |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | data_flow | "Call the mail send exactly once, from inside the ticket-creation Server Action, after the ticket row commit succeeds — never before (D5)" | Is `sendSupportNotification` invoked exactly once per submission, only inside the `after()` callback registered after the INSERT has already succeeded, never before or outside it (Y/N)? |
| docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md (§ Implementation Guidance) | dependency_direction | "Keep the mail module's only caller the ticket-creation Server Action; do not give proxy.ts or instrumentation.ts any reason to import it" | Does `submitSupportTicket` (in `SOURCE/lib/support/actions.ts`) remain the only caller of `sendSupportNotification`, confirmed via a repo-wide import search (Y/N)? |

## Boundary Context (Connection Map)

**Boundary**: `SupportWidgetDialog` (browser) → `submitSupportTicket` (Server Action). This task owns the **right-side / server** owner (`SOURCE/lib/support/actions.ts`); the left-side client owner (`SOURCE/components/support/SupportWidgetDialog.tsx`) is task-09.

- **Serialized Format**: `multipart/form-data` (`intent`, `message`, `pageUrl`, `userAgent`, `screenWidth`, `screenHeight`, optional `screenshot` File).
- **Consumer Parse Rule**: `formData.get(name)` per field server-side; screenshot via `formData.get("screenshot")` as `File`.
- **Roundtrip check this task must satisfy**: every field the client sends by that exact key name is read by that exact key name server-side; a missing optional field (`pageUrl`/`userAgent`/`screenWidth`/`screenHeight`) parses to `null`, never throws or blocks the submission (AC-010).
- **Expected Signal**: the response matches the closed `SubmitTicketResult` union — proven by task-06's own `actions.int.test.ts` (server side) and task-09's mocked-boundary component tests (client side), reconciled for real once both exist.

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact `after()` mock boundary shape the skeleton's Group 4 requires.
- [ ] Write failing tests per the skeleton's 4 groups (metadata/intent capture; single-screenshot structural constraint; rate limiting; fire-and-forget mail decoupling).
- [ ] Run tests and confirm failure (module doesn't exist yet).

### 2. Green Phase
- [ ] Add `RATE_LIMITS.submitTicket`.
- [ ] Implement `submitSupportTicket` exactly per the backend DD's Data Flow steps 1-9.
- [ ] Add `flagSupportTicketNotifyFailed` to `service-role.ts`.
- [ ] Run only the added tests and confirm they pass.

### 3. Refactor Phase
- [ ] Improve code (maintain passing tests); re-confirm each Binding Decision and Reference Contract's Compliance Check.
- [ ] Confirm added tests still pass.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness (a `TicketWithNotes` field mismatch is a compile error) — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: unit/integration coverage — Config: `SOURCE/vitest.config.ts` (`include: lib/support/`)
- Production build in CI (`npx next build`) — Enforces: build correctness — Config: `.github/workflows/ci.yml:74-80`

## Operation Verification Methods
- **Verification method**: `submitSupportTicket`'s action-level test (mocked Supabase client, mocked `after()`) asserting the response resolves before the mail send's callback is invoked.
- **Success criteria**: all 4 skeleton groups green (14 proof obligations total); the action's response is provably not gated on the mail send at the call-construction level (Group 4a).
- **Failure response**: if Group 4a fails (response gated on mail send), check for an accidental `await` on `sendSupportNotification` or its wrapping promise before the return statement — this exactly reopens the I003 duplicate-submission risk the backend DD's v1.1 revision exists to close.
- **Verification level**: L2 (new tests added and passing) — the real `after()` post-response scheduling guarantee is a Next.js platform behavior this repo's test runner cannot reproduce end-to-end; this test proves the call-shape contract that stands in for the platform guarantee.

## Proof Obligations
- **Claim**: the three fixed intents + auto-captured metadata never block submission on a missing field, and no intent/empty-message reaches the insert (AC-002 server half, AC-004, AC-008, AC-009, AC-010, AC-028).
- **Primary failure mode**: a metadata field's absence throws or short-circuits before the insert instead of writing null and proceeding; or an intent outside `{bug,suggestion,question}` or an empty/whitespace-only message reaches the insert; or the action sets a `status` value, racing the DB's own `default 'new'`.
- **Boundary to exercise**: in-process integration (mocked Supabase client boundary — the real RLS insert-own path and cross-student isolation are proven by task-03, not here).
- **State assertion**: N/A (mocked client — the constructed insert payload is what's asserted, not real persisted state).
- **Mock boundary rationale**: Supabase client mocked per backend DD Test Boundaries; RLS insert-own re-verification and DB CHECK constraints covered by task-03.
- **Residual**: real-DB insert behavior (CHECK constraints, RLS insert-own) is proven by task-03, not this task.
- **Claim**: the insert payload's `screenshot_path` is a single scalar field, never an array or a second column (AC-011 schema-shape half, metric 7).
- **Primary failure mode**: a future edit adds a second screenshot-related field/array to the insert payload without any test catching it.
- **Boundary to exercise**: in-process integration (mocked Supabase client + mocked Storage upload).
- **State assertion**: N/A.
- **Mock boundary rationale**: Storage upload mocked; the DB's own scalar-column enforcement is a separate, structural backstop.
- **Residual**: the UI-replace-not-append half (AC-011's UI behavior) is task-11's fixture-e2e responsibility, not this task's.
- **Claim**: a rate-limited call never reaches the insert and never registers the `after()`-scheduled mail callback (AC-018, AC-019).
- **Primary failure mode**: a rate-limited call still reaches the insert (double-writes for a request the student was told was refused) or still registers the mail callback (an email queued for a refused request).
- **Boundary to exercise**: in-process integration (mocked `guard()` refusal).
- **State assertion**: N/A.
- **Mock boundary rationale**: `guard()` mocked for determinism.
- **Residual**: none.
- **Claim**: the response is not gated on the mail send in any way; a mail failure sets the notify-failed flag, a mail success does not (D5, AC-031, AC-032, this feature's single highest-value proof).
- **Primary failure mode**: `submitSupportTicket` awaits `sendSupportNotification` inline before returning (reopens I003); or a mail failure changes the action's return value; or `flagSupportTicketNotifyFailed` is never called on failure or is called even on success.
- **Boundary to exercise**: in-process integration (mocked `after()` + mocked `sendSupportNotification` + mocked `flagSupportTicketNotifyFailed`).
- **State assertion**: before = ticket row does not exist; action = `submitSupportTicket` resolves; after = `{ ok: true, shortRef }` is returned before the `after()` callback has been invoked; invoking the callback separately with a mocked failure/success asserts the flag call happens on failure only.
- **Mock boundary rationale**: `after()`'s real post-response scheduling is a Next.js platform behavior no test runner in this repo reproduces end-to-end; this test proves the call-shape contract (registered before return; callback invocable and testable independent of the response) that stands in for the platform guarantee.
- **Residual**: the real `after()` platform guarantee itself is not exercised by this test — accepted per backend DD Mock Boundary Decisions.
- **Claim**: a screenshot failing `checkScreenshotFile` (disallowed MIME or over-size) is rejected before any Storage upload or insert call, and a genuine Storage upload failure resolves to `{ error: "server" }` with best-effort orphan cleanup (`invalid option` + `unavailable boundary` Failure Mode Checklist categories, AC-012).
- **Primary failure mode**: a rejected screenshot still reaches the Storage upload call or the insert call; or a Storage upload failure throws instead of resolving to the documented error shape, or leaves an orphaned object with no cleanup attempt.
- **Boundary to exercise**: in-process integration (mocked `checkScreenshotFile` returning a rejection; mocked Storage client returning an upload failure).
- **State assertion**: before = no Storage object, no ticket row; action = submit with a rejected/failing screenshot; after = no Storage upload call is made in the rejection case; in the Storage-failure case, no ticket row is inserted and a best-effort cleanup call is attempted for any partially-uploaded object.
- **Mock boundary rationale**: `checkScreenshotFile` and the Storage client both mocked per backend DD Test Boundaries.
- **Residual**: real Storage-native `fileSizeLimit`/`allowedMimeTypes` enforcement (the backstop, not the primary gate) is proven by task-01's bucket policy, not by this task's mocked-client test.

## Completion Criteria
- [ ] All added tests pass (4 skeleton groups, 14 proof obligations)
- [ ] Operation verified per Operation Verification Methods above
- [ ] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [ ] Matches the backend DD's Data Contracts §submitSupportTicket exactly, including the deliberate `requireUser()`-redirect deviation (documented rationale in a code comment)
- [ ] `tsc`/lint clean
- [ ] Every Binding Decision's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] Every Reference Contract's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/lib/support/actions.ts`, `SOURCE/lib/security/rateLimit.ts` (additive), `SOURCE/lib/supabase/service-role.ts` (additive).
- Scope boundary: do not implement any frontend component here (task-09's responsibility) — component tests mock this action's boundary and are not blocked by this task's own completion, only by Phase 1 completing before Phase 2's live-wiring pass. Do not implement the admin-side service-role functions here — those are task-13's responsibility.
