# Task 03: RLS harness ST-a..ST-e (blocking Early Verification Point, backend) (Work Plan Phase 0, Task 0.3)

Metadata:
- Dependencies: support-system-work-plan-task-02 (Deliverable: real applied dev-database schema + RLS + bucket policy)
- Provides: proven RLS isolation — the authorization layer every Phase 1+ task builds on top of
- Size: Medium (2 files: `test-rls.ts` append, `support.rls.service.e2e.test.ts` reduced to pointer)

Certainty: low (Reason: ST-e — AC-013's screenshot bucket cross-student read denial — is plan-added, not present in the skeleton file; it must extend the harness's existing Storage-RLS idiom used for `exam-images`/`exam-uploads`, an idiom this task's author must locate and confirm still applies to a new bucket before writing ST-e).
Exploratory implementation: true.
Fallback: if the harness's existing `exam-images`/`exam-uploads` Storage-RLS pattern (`error != null && data == null` check) cannot be directly mirrored for the `support-screenshots` bucket (e.g. because the seed/download API shape differs), fall back to the harness's own `ensureUser`/`signInAs` conventions plus a service-role `.storage.from("support-screenshots").list()` state-recount, discriminating the denial by the Supabase Storage client's specific error shape for a permission-denied download — record the exact mechanism chosen in Investigation Notes rather than leaving ST-e's implementation ambiguous.

## Implementation Content

Port `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts`'s ST-a..ST-d cases directly into `SOURCE/supabase/test-rls.ts` (the skeleton's own stated preferred implementation, mirroring this repo's rating-system precedent), following the harness's existing `ensureUser`/`signInAs`/error-class-discrimination/state-recount conventions:
- **ST-a** — read-own isolation on `support_tickets` (AC-015): two real users, each with one seeded ticket; each user's own signed-in client returns only their own row(s), symmetric in both directions.
- **ST-b** — positive control: a service-role select confirms a seeded internal note on A's ticket actually exists, before any RLS-denial assertion is trusted (mirrors TL-a/S-a's bundling convention).
- **ST-c** — internal notes unreadable by the ticket's own author (AC-025): A's own signed-in session selecting `support_ticket_notes` filtered to A's own ticket returns zero rows or a permission-denied error, discriminated the same way the harness's MM-b case discriminates error classes.
- **ST-d** — non-admin (including the ticket's own author) cannot INSERT into `support_ticket_notes` (AC-048): A's direct INSERT attempt is rejected with a grant-level (`42501`/permission-denied) error; a service-role row-count recheck before/after confirms no row landed.

**Additionally add ST-e** (plan-added — not present in the skeleton, closes document review finding I001, AC-013): seed a screenshot object under student A's folder path in the `support-screenshots` bucket via a service-role upload; confirm via a service-role list/download that the object genuinely exists (state-recount positive control, mirroring ST-b's convention); then attempt to download that same object path using student B's signed-in session and assert the read is denied, discriminating the denial by its specific error class/shape rather than a bare `error !== null` — matching this harness's existing storage-RLS idiom for `exam-images`/`exam-uploads`.

Once ported, reduce `support.rls.service.e2e.test.ts` to a pointer comment (mirrors the rating precedent's own post-port state).

## Target Files
- [x] `SOURCE/supabase/test-rls.ts` (append — new per-family section for ST-a..ST-e, mirroring the existing `MM-a`/`MM-b`/`TL-a`/`TL-b` pattern)
- [x] `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` (reduced to a pointer comment once ported)

## Investigation Targets
- `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` (full file — the exact ST-a..ST-d Behavior/Proof Obligation blocks to port verbatim into `test-rls.ts`, plus this file's own header note on the preferred append-target)
- `SOURCE/supabase/test-rls.ts` (the `ensureUser`/`signInAs` helpers; the existing per-family section pattern, e.g. `MM-a`/`MM-b`/`TL-a`/`TL-b`; the harness's existing Storage-RLS idiom for `exam-images`/`exam-uploads` — the `error != null && data == null` discrimination convention ST-e must extend; any existing `setupXFixtures`/`cleanupXFixtures` pattern to mirror for `support_tickets`/`support_ticket_notes`/`support-screenshots`)
- `docs/design/support-system-backend-design.md` (§ Verification Strategy — Early Verification Point, backend, success criteria and failure response; § Test Boundaries / RLS suite — ST-a..ST-d table; § Acceptance Criteria — AC-013)
- `docs/prd/support-system-prd.md` (AC-013, AC-015, AC-025, AC-048, metrics 1-3)

## Reference Contracts

(No Reference Contract Values table row is assigned to this task — the Reference Contract for `first_status_transition_at`'s write-once invariant is owned by task-01's DDL authorship and task-13's admin-action proof, not by this RLS-only task.)

## Investigation Notes
- `support.rls.service.e2e.test.ts` (full file read): confirmed the exact Behavior/Proof Obligation text for ST-a..ST-d, and the file's own header directive that the preferred implementation is to append directly into `test-rls.ts` (mirrors rating precedent) and reduce this file to a pointer once ported.
- `test-rls.ts` `ensureUser`/`signInAs` (lines ~119-155): Admin-API user creation + anon-key sign-in, unchanged, reused as-is for A/B.
- `test-rls.ts` MM-a/MM-b/TL-a/TL-b (Phần 7, ~1372-1495): per-family section pattern — `console.log` header block, `cleanupXFixtures`/`setupXFixtures` pair (service-role, idempotent, called before AND after), positive control before a denial assertion, `assert()` helper. MM-b's error-class discrimination checks `.error.code === "42501"` (or a message regex) rather than a bare `error !== null`; TL-b re-counts rows via service role before/after a blocked write instead of trusting the write's own response. Mirrored this exact shape for the new "Phần 8" section.
- Storage-RLS idiom for `exam-images`/`exam-uploads` (R-m/R-n/R-o, lines ~712-746): `download()` denial is discriminated as `error != null && data == null`; a successful/positive-control read is `error == null && data != null`. This idiom still applies unchanged to the new `support-screenshots` bucket (same `@supabase/supabase-js` Storage client, same `.download()` API shape) — no fallback needed. Mirrored directly for ST-e (service-role positive-control download, then B's signed-in session download denial).
- `docs/design/support-system-backend-design.md` §Test Boundaries (RLS suite table, Early Verification Point) and §Schema & DB Enforcement (`support_tickets_select_own`, `support_ticket_notes` strict `revoke all` + zero policies, `support_screenshots_insert_own` bucket policy with no select policy for `authenticated`) confirm the exact policy shapes the 5 cases exercise. AC-013/015/025/048 wording matches PRD.
- `schema.sql` (support system section, ~1392-1533): `support_tickets.id` is `uuid default gen_random_uuid()` — no fixed text PK to use as a fixture-id prefix like other sections' fixtures (`exams.id` etc. are `text`). Chose to key fixture cleanup off `user_id in (authorAId, authorBId)` (the two dedicated RLS test accounts, which hold no legitimate tickets) instead; `support_ticket_notes` rows cascade-delete automatically via `ticket_id ... on delete cascade` when the parent ticket is deleted, so no separate notes cleanup step is needed.
- ST-e mechanism decision (Certainty: low → resolved): the harness's `error != null && data == null` Storage-RLS idiom (R-m/R-n) directly applies to `support-screenshots` without modification — the primary path in the task's Certainty/Fallback note, not the fallback. Recorded here per the Red-phase requirement to decide and record the mechanism before writing the case.
- Verification: `setup-storage.ts` had not yet created the `support-screenshots` bucket in the dev project (Task 02 applied the SQL schema but the bucket itself is created by this idempotent script, not by `schema.sql`) — ran `npx tsx supabase/setup-storage.ts` once (idempotent, pre-existing script, not a Target File of this task) to create it before ST-e could run; confirmed idempotent — re-running `setup-storage.ts` a second time reports the bucket already exists.
- Post-run verification: queried `support_tickets`/`support_ticket_notes` for any row matching the `[rls-support]` fixture marker, and listed the `support-screenshots` bucket's top level — all empty after two consecutive `test-rls.ts` runs, confirming cleanup is idempotent and leaves no residual fixture data in the dev project.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations — in particular, locate the harness's exact Storage-RLS error-discrimination idiom for `exam-images`/`exam-uploads` before drafting ST-e.
- [x] Decide and record the ST-e mechanism (see Certainty/Fallback above) in Investigation Notes before writing the case.
- [x] Write ST-a..ST-e as failing cases in `test-rls.ts` (they will fail until Task 02's schema is confirmed applied and the fixture seeding is correct).

### 2. Green Phase
- [x] Run `cd SOURCE && npx tsx supabase/test-rls.ts` and iterate until all five cases pass with real error-class discrimination and state-recounts, not bare `error !== null` checks.
- [x] Reduce `support.rls.service.e2e.test.ts` to a pointer comment once ST-a..ST-e are confirmed ported and passing.

### 3. Refactor Phase
- [x] Re-read the ported cases once more for naming/structure consistency with the harness's existing `MM-a`/`TL-a` sections.
- [x] Confirm the pointer comment in `support.rls.service.e2e.test.ts` correctly references the new `test-rls.ts` section.

## Quality Assurance Mechanisms
- `npx tsx supabase/test-rls.ts` (manual, not in CI) — Enforces: RLS isolation against real Postgres, two real users, anon key — Config: `SOURCE/supabase/test-rls.ts` — this task's own acceptance mechanism (PRD metrics 1-3)
- ESLint / `tsc --noEmit` — Enforces: style, types — Config: `SOURCE/eslint.config.mjs`, project `tsconfig.json`

## Operation Verification Methods
(Copied and instantiated from Verification Strategy's First Verification Target — this task IS the required, blocking Early Verification Point, backend.)
- **Verification method**: `test-rls.ts` cases ST-a..ST-e against a real local Supabase instance, immediately after Task 02's DB foundation apply — ST-e (screenshot bucket cross-student read denial, AC-013) is plan-added beyond the DD's own 4-case Test Boundaries table, closing document review finding I001.
- **Success criteria**: all five cases pass with the harness's own state-recount and error-class-discrimination discipline (not a bare `error !== null`), and `npm run verify:schema` (already confirmed at Task 02) shows no FK/fingerprint drift.
- **Failure response**: stop and correct the schema before proceeding to Phase 1 (do not build `lib/support/`/`lib/mail/`/the admin route on top of an unverified authorization layer) — reassess the specific policy clause against the `exam_moderation_log`/`exam_reports` precedents this design claims to follow.
- **Verification level**: L1 (functional — real RLS isolation proven against a real Postgres instance, the highest-consequence security guarantee in this feature).

## Proof Obligations
- **Claim**: A cannot read B's `support_tickets` rows and vice versa (AC-015).
- **Primary failure mode**: a missing or malformed `using (user_id = auth.uid())` clause on `support_tickets_select_own` lets any authenticated user read any other student's ticket rows.
- **Boundary to exercise**: real local Postgres (service-role setup + two real signed-in users).
- **State assertion**: before = A and B each have one seeded ticket row via service-role; action = each user's own signed-in client selects `support_tickets`; after = A's client sees only A's row(s), B's client sees only B's row(s) — symmetric in both directions.
- **Mock boundary rationale**: none — RLS cannot be proven by a mocked client.
- **Residual**: none.
- **Claim**: no `authenticated` session, including the ticket's own author, can read or write `support_ticket_notes` under any circumstance (AC-025, AC-048).
- **Primary failure mode**: a well-intentioned "ticket owner can see triage status" policy is added, or `support_ticket_notes` is copy-pasted from `telemetry_log`'s narrower revoke form instead of `exam_moderation_log`'s strict form, granting `authenticated` a read or insert path.
- **Boundary to exercise**: real local Postgres.
- **State assertion**: ST-b confirms a seeded note exists (service-role state-recount) before ST-c's denial is trusted; ST-d's service-role row count is identical before and after A's direct INSERT attempt.
- **Mock boundary rationale**: none — the table-level `revoke all` (not merely "no policy") is what this proves; a mock cannot distinguish "no policy grants insert" from "the table-level privilege itself was revoked".
- **Residual**: none.
- **Claim**: a stored screenshot is not readable by a user who is neither its author nor an admin (AC-013, plan-added ST-e, closes document review finding I001).
- **Primary failure mode**: the `support-screenshots` bucket's insert-own policy is accidentally paired with an overly broad select policy (or none at all is intended but a default-permissive Storage setting leaks through), letting any authenticated user download any other student's screenshot.
- **Boundary to exercise**: real local Postgres + Supabase Storage (service-role seed, student B's real signed-in session download attempt).
- **State assertion**: before = a service-role state-recount confirms the seeded screenshot object exists under A's path; action = B's signed-in session attempts to download that object; after = the download is denied with a discriminated, non-bare error class, and no object bytes are returned to B.
- **Mock boundary rationale**: none — Storage RLS cannot be proven by a mocked client.
- **Residual**: none once this case passes; this closes document review finding I001.

## Completion Criteria
- [x] ST-a..ST-d written per the skeleton's Behavior/Proof Obligation blocks
- [x] ST-e written per this task's own Behavior/Proof Obligation description above (AC-013)
- [x] `npx tsx supabase/test-rls.ts` exits 0, all five cases pass with real error-class discrimination and state-recount discipline
- [x] `support.rls.service.e2e.test.ts` reduced to a pointer comment
- [x] Each Proof Obligation above is met: the case turns red under its primary failure mode and exercises real Postgres

## Notes
- Impact scope: `SOURCE/supabase/test-rls.ts` (new section, append-only) and `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` (reduced to pointer).
- Scope boundary: do not modify any pre-existing `test-rls.ts` section (`MM-a`/`MM-b`/`TL-a`/`TL-b` etc. are read-only reference for the pattern, not edited); a failure here **stops progress into Phase 1** per the backend DD's own Failure response — do not proceed to Task 04/05/06 until this task is green.
