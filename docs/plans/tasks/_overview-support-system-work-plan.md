# Overall Design Document: User Support System v1

Generation Date: 2026-08-13
Target Plan Document: `docs/plans/support-system-work-plan.md`

> **⚠ Per-task files removed 2026-08-18, after the feature closed.** The 18 executor-instruction files (`support-system-work-plan-task-01…18.md`) were deleted to keep the workspace navigable; references to them here and in the `*-phaseN-completion.md` files are **dangling by intent**.
>
> Recoverable from git — last commit containing them is **`aabc3de`**:
> ```
> git show aabc3de:docs/plans/tasks/support-system-work-plan-task-01.md
> ```
> Kept instead: every `*-phaseN-completion.md` (outcomes and measurements) and this overview.

## Project Overview

### Purpose and Goals

Give a logged-in student a floating widget that files a bug/suggestion/question ticket with auto-captured technical context and at most one optional screenshot; persist tickets with read-own RLS; notify a single support inbox by fire-and-forget email carrying a machine-matchable `[report-ms]` subject prefix; and give the `ADMIN_USER_IDS` allowlist a queue page to triage tickets through `new → in_progress → resolved` and write internal notes the student can never read. Success is defined by the PRD's Success Criteria 1-15 and both Design Docs' Acceptance Criteria (AC-001 through AC-049).

### Background and Context

TrangNguyenDigi currently has exactly one inbound channel from a user (`ReportExam.tsx` → `exam_reports`), and it is content moderation, not support. This is the first version of a general support channel. Both Design Docs (v1.2) are Draft but mutually consistent; ADR-0012 (Accepted) resolves the Gmail SMTP + App Password transport decision and documents the existing `ADMIN_USER_IDS` allowlist model without redeciding it. The repo has **no migration tool** (TD-005) — `schema.sql` DDL is applied by hand into the Supabase SQL Editor, so this decomposition treats the schema-apply step (Task 0.2) and the `ADMIN_USER_IDS` Vercel Preview-scope fix (Final Phase Task F.2) as explicit, blocking, human-in-the-loop checkpoints an executor agent must stop at, not work around — mirroring the exact `⚠ MANUAL CHECKPOINT` convention this repo's `engine1-adaptive-ai-work-plan-backend-task-01.md`/`backend-task-14.md` already established.

## Task Division Design

### Division Policy

The work plan itself is Hybrid: a mandatory schema-foundation phase first (Phase 0, matching the backend DD's own Horizontal-slice ordering — a hard, blocking prerequisite), followed by three vertical feature-area slices (Phase 1 backend write path + mail; Phase 2 frontend widget; Phase 3 admin queue backend+frontend together), each carrying its own early integration verification, and a cross-cutting Final Phase. This decomposition preserves that shape exactly — one task file per work-plan implementation task that produces a code/content artifact (1 task = 1 commit = 1 logical change), in the work plan's own dependency order (per its Task Dependency Diagram, treated as authoritative and not re-derived).

Verifiability priority (per implementation-approach skill): L1 is used at both of the plan's own Early Verification Points (Task 0.3's real-Postgres RLS suite; Task 2.3's real-browser five-mount-point self-guard + 360px layout pass); L2 (tests passing) is the default for every other implementation task — each converts an already-generated skeleton test file (7 skeletons exist: 3 integration, 3 fixture-e2e, 1 service-integration-e2e) or, where no skeleton exists (`validateScreenshot.ts`'s boundary fixtures, most presentational admin components, i18n key parity), an AC-authored test into real, passing tests in the same commit as the implementation; L3 (`tsc`/lint/build clean) is the floor for every task via the project-wide Quality Assurance Mechanisms.

**No layer-aware file naming**: although this plan is fullstack, Phase 3 deliberately pairs backend (service-role functions, Server Actions, page guard) and frontend (rendering components) work in the same phase because "neither is independently valuable without the other" (work plan's own Phase 3 Purpose statement) — splitting into independent `backend-task-NN`/`frontend-task-NN` numbering sequences would obscure that intentional pairing and the Task 3.1→3.2 dependency edge. This mirrors this repo's `history-work-plan` precedent (also fullstack, also chose single sequential numbering over layer-aware numbering for the same reason). Task files use single sequential numbering: `support-system-work-plan-task-01.md` through `task-18.md`.

### Decomposition Scope Decision — Final Phase Tasks F.3-F.9

Final Phase Tasks F.3 (AC sweep), F.4 (security review), F.5 (quality checks), F.6 (full test run), F.7 (a11y pass), F.8 (coverage check), and F.9 (doc updates) are folded into a **single** task file (`support-system-work-plan-task-18.md`), not seven separate files. Reasoning, mirroring this repo's `history-work-plan-task-18.md` precedent (the exact same Final-Phase-QA-sweep shape):
- None of these seven items has its own `Target Files` list — they are a walk of already-built artifacts (AC checklist, security checklist, command re-runs, a manual a11y pass, a diagnostic coverage read, a "confirm no doc update needed" check). There is no independent "1 commit = 1 logical code change" unit to split them into.
- Splitting one continuous QA session into 7 near-empty files would manufacture artificial boundaries the work plan itself does not impose — all seven read directly off the same already-completed Phase 0-3 artifact set.
- Final Phase Tasks F.1 (RLS regression re-run + confirm skeleton reduced to pointer — has a concrete scriptable command and a concrete file-state check) and F.2 (MANUAL `ADMIN_USER_IDS` fix — explicit human-in-the-loop checkpoint per the work plan's own Notes) are each promoted to their own task file, mirroring engine1's treatment of its own Final-Phase manual-checkpoint task (`backend-task-14.md`) versus its folded Tasks 23-27.

### Inter-task Relationship Map

```
Phase 0 (schema foundation, BLOCKING)
  task-01 (T0.1 schema.sql + fingerprint + verify-schema.ts/setup-storage.ts wiring)
    -> task-02 (T0.2 MANUAL: apply schema.sql + verify:schema)
      -> task-03 (T0.3 RLS harness ST-a..ST-e — Early Verification Point, backend)
  -> phase0-completion

Phase 1 (backend write path)
  task-03 --------------------------------------------------> task-06 (T1.3 submitSupportTicket)
  task-04 (T1.1 limits/types/validateScreenshot) -----------> task-06
  task-05 (T1.2 mail module) --------------------------------> task-06
  -> phase1-completion

Phase 2 (frontend widget)
  task-07 (T2.0 fixture-e2e harness) -> task-10 (T2.3 widget-visibility)
  task-08 (T2.1 i18n keys) -> task-09 (T2.2 SupportWidget tree) -> task-10
  task-06 -> task-09 (real submitSupportTicket contract for live-wiring pass; component tests themselves mock the boundary)
  task-09 -> task-11 (T2.4 ticket-submission, RESERVED SLOT)
  task-07 -> task-11
  task-06 -> task-11 (contract shape)
  -> phase2-completion

Phase 3 (admin queue, backend + frontend)
  task-03 -> task-13 (T3.1 service-role + admin actions + page)
  task-04 -> task-13 (shared types)
  task-12 (T3.0 fixture-e2e harness) -> task-15 (T3.3 admin-triage)
  task-13 -> task-14 (T3.2 admin components) -> task-15
  task-12 -> task-14
  -> phase3-completion

Final Phase
  task-03 (regression rerun target) -> task-16 (F.1 full RLS regression + pointer confirm)
  task-16 -> task-18 (F.3-F.9 folded QA sweep)
  task-17 (F.2 MANUAL ADMIN_USER_IDS Preview-scope fix) -> task-18
  task-10, task-11, task-15 -> task-18
  -> phase4-completion
```

### Interface Change Impact Analysis

| Existing Interface | New Interface | Conversion Required | Corresponding Task |
|---|---|---|---|
| `(exams)/layout.tsx`, `(analytics)/layout.tsx`, `(authoring)/layout.tsx`, `(history)/layout.tsx`, `app/page.tsx` render trees | Same trees, each gains one additive sibling `<SupportWidget user={user} />` next to `<BottomNav />` | Additive only — no existing line removed | task-09 |
| `RATE_LIMITS` (`SOURCE/lib/security/rateLimit.ts`) | New member `RATE_LIMITS.submitTicket` | Additive only — no existing member's shape changes | task-06 |
| `checkEnv.ts` | 3 new optional/warn entries (`SUPPORT_NOTIFY_EMAIL`/`SUPPORT_SMTP_USER`/`SUPPORT_SMTP_APP_PASSWORD`) | Additive only | task-05 |
| `check-ai-key-bundle.mjs` SECRETS/marker list | Gains `SUPPORT_SMTP_APP_PASSWORD`/`SUPPORT_SMTP_USER`/`nodemailer` markers | Additive only | task-05 |
| `setup-storage.ts` `BUCKETS` array | Gains `"support-screenshots"` entry with `fileSizeLimit`/`allowedMimeTypes` | Additive only | task-01 |
| `verify-schema.ts` `deleteChain` | Gains `support_tickets → support_ticket_notes` + new EXECUTE-grant probe | Additive only | task-01 |
| `vi.ts`/`en.ts` dictionaries | Gain `support.*` (student-facing) and `support.admin.*` (admin-facing) blocks | Additive only | task-08 (student), task-14 (admin) |
| `SOURCE/supabase/test-rls.ts` | Gains cases ST-a..ST-e (ported from the skeleton) | Additive only | task-03 |
| `SOURCE/supabase/__tests__/support.rls.service.e2e.test.ts` | Reduced to a pointer comment once ST-a..ST-e are ported | Replacement of file body with a pointer, per the rating-system precedent | task-03 (initial reduction), task-16 (confirmed still a pointer at Final Phase) |
| `SOURCE/lib/supabase/service-role.ts` | Gains `flagSupportTicketNotifyFailed` (task-06), `listSupportTickets`/`changeSupportTicketStatus`/`addSupportTicketNote` (task-13) | Additive only | task-06, task-13 |

### Common Processing Points

- **`checkScreenshotFile`** (task-04, `SOURCE/lib/support/validateScreenshot.ts`) is the single screenshot-validation implementation, consumed only by `submitSupportTicket` (task-06). `ScreenshotAttachment` (task-09) performs its own **client-side pre-validation** against the same `LIMITS` constants but does not import or duplicate this server-side function — the two are deliberately parallel, not shared, per the frontend/backend trust-boundary split.
- **`SUPPORT_MAIL_SUBJECT_PREFIX`** (task-05, `SOURCE/lib/mail/sendSupportNotification.ts`) is the single source of the `[report-ms] ` literal — never routed through `vi.ts`/`en.ts` (R16), never re-declared anywhere else in the feature.
- **`TicketWithNotes`** (task-13, backend-exported type) is the single source of truth for the admin-side ticket shape — task-14 consumes it by `import type` reference only, never re-declares or widens it (Risk R-F2, deliberately retired early by sequencing task-13 immediately before task-14 within Phase 3).
- **`statusFormAction`/`noteFormAction`** local adapters (task-14) are the single bridge between `useActionState`'s `(prevState, formData)` shape and `changeTicketStatusAction`/`addTicketNoteAction`'s real signatures — no second adapter shape is introduced.
- **`SupportDriver`** fixture-e2e harness pattern (task-07 for the widget lanes, task-12 for the admin lane) both follow the exact same structural-subset-of-Playwright's-`Page`/`Locator`-API convention this repo's `rating.fixture.e2e.test.ts`/`history.fixture.e2e.test.ts` already establish — no new driver abstraction is invented.

## Implementation Considerations

### Principles to Maintain Throughout

1. `sendSupportNotification` never throws and never gates `submitSupportTicket`'s response — the mail send is scheduled via `after()` strictly after the ticket row commit succeeds (D5), proven at task-06's Proof Obligation Group 4.
2. `support_ticket_notes` uses the strict `exam_moderation_log`-form `revoke all` — zero `authenticated` privilege of any kind, not merely "no select policy" (D4/R8) — task-01 authors it, task-03 proves it (ST-c/ST-d).
3. Every admin Server Action independently re-derives the caller and re-checks `isAdminUserId()` — never trusts the page-level guard (task-13, mirrors `moderateExamAction`).
4. The `§17` schema-fingerprint recompute is a mandatory same-commit sub-step of task-01's schema change, gated by `schemaFingerprint.test.ts`.
5. `SupportWidget`'s five-mount-point self-guard (task-09) is verified for real, in a real browser, before Phase 3 begins (task-10's Early Verification Point) — an incorrect guard is a visibility bug independent of submission logic.

### Risks and Countermeasures

- **Risk**: A copy-by-proximity of `telemetry_log`'s narrower revoke form onto `support_ticket_notes` grants `authenticated` an insert path onto internal notes. **Countermeasure**: task-01's Change Category sweep (state-change, boundary-change) explicitly checks every other `revoke all on function ...`/table-grant statement in `schema.sql`; task-03's ST-c/ST-d assert both read-denial and write-denial with a row-count recheck.
- **Risk**: The client-side 20s timeout race in `SupportWidgetDialog` (task-09) cannot cancel the underlying Server Action call — a late real response after a shown timeout error, followed by a retry, could produce a duplicate ticket row. **Countermeasure**: accepted per the frontend DD (R-F1), bounded by `RATE_LIMITS.submitTicket` (task-06); no data-loss/security exposure.
- **Risk**: `TicketWithNotes`'s exact field set (frontend DD's own transcription of the backend DD's prose) could drift from the real backend type. **Countermeasure**: task-13 (backend, exports the real type) is sequenced immediately before task-14 (frontend, `import type` reference only) within the same phase; `tsc --noEmit` catches any mismatch at compile time.
- **Risk**: Phase 0's manual schema-apply checkpoint (task-02) and the Final Phase's `ADMIN_USER_IDS` Preview-scope fix (task-17) both require interactive human access no agent in this environment has. **Countermeasure**: both are their own dedicated task files carrying an explicit `⚠ MANUAL CHECKPOINT` marker instructing an executor agent to stop and hand off rather than attempt a workaround.

### Impact Scope Management

- **Allowed change scope**: `SOURCE/supabase/schema.sql` (new sections only, per task-01's literal DDL blocks), `SOURCE/lib/schema/schemaFingerprint.ts` (constant update only), `SOURCE/supabase/verify-schema.ts`/`setup-storage.ts`/`test-rls.ts` (additive), `SOURCE/lib/support/**` (new), `SOURCE/lib/mail/**` (new), `SOURCE/lib/ugc/limits.ts` (additive constants), `SOURCE/lib/security/rateLimit.ts` (additive `RATE_LIMITS` member), `SOURCE/lib/env/checkEnv.ts` (additive entries), `SOURCE/lib/supabase/service-role.ts` (additive exports), `SOURCE/lib/i18n/dictionaries/{vi,en}.ts` (additive blocks), `SOURCE/components/support/**` (new), `SOURCE/app/(admin)/admin/tickets/**` (new), `SOURCE/app/(layer2|layer3|layer4|HM)/layout.tsx` + `SOURCE/app/page.tsx` (additive sibling render only), `SOURCE/package.json` (additive `nodemailer`/`@types/nodemailer`), `SOURCE/scripts/check-ai-key-bundle.mjs` (additive SECRETS entries), `SOURCE/tests/e2e/fixture/**` (new).
- **Preserved areas (do not change)**: `exam_reports`/`exam_moderation_log`/`telemetry_log` tables and their existing RLS (read-only precedent, not touched); `moderateExamAction`'s own body (only its convention is mirrored, never imported/modified); `AnalyticsDashboard`, `BottomNav`, and every other component the widget mounts beside (sibling render only, zero prop/behavior change to the existing tree); any pre-existing `schema.sql` section outside the four new blocks (§9-equivalent new tables, §18-equivalent new function, storage policy — exact section numbers per task-01's own drafting, since this schema file does not reuse the engine1 plan's §9b/§18/§19 numbering).

## Task File Index

| # | File | Work Plan Task | Depends on |
|---|---|---|---|
| 01 | `support-system-work-plan-task-01.md` | Phase 0 Task 0.1 | — |
| 02 | `support-system-work-plan-task-02.md` | Phase 0 Task 0.2 (⚠ MANUAL, BLOCKING) | task-01 |
| 03 | `support-system-work-plan-task-03.md` | Phase 0 Task 0.3 (Early Verification Point, backend) | task-02 |
| — | `support-system-work-plan-phase0-completion.md` | Phase 0 completion | 01-03 |
| 04 | `support-system-work-plan-task-04.md` | Phase 1 Task 1.1 | — |
| 05 | `support-system-work-plan-task-05.md` | Phase 1 Task 1.2 | — |
| 06 | `support-system-work-plan-task-06.md` | Phase 1 Task 1.3 | task-03, task-04, task-05 |
| — | `support-system-work-plan-phase1-completion.md` | Phase 1 completion | 04-06 |
| 07 | `support-system-work-plan-task-07.md` | Phase 2 Task 2.0 | — |
| 08 | `support-system-work-plan-task-08.md` | Phase 2 Task 2.1 | — |
| 09 | `support-system-work-plan-task-09.md` | Phase 2 Task 2.2 | task-08, task-06 |
| 10 | `support-system-work-plan-task-10.md` | Phase 2 Task 2.3 (Early Verification Point, frontend) | task-09, task-07 |
| 11 | `support-system-work-plan-task-11.md` | Phase 2 Task 2.4 (RESERVED SLOT) | task-09, task-07, task-06 |
| — | `support-system-work-plan-phase2-completion.md` | Phase 2 completion | 07-11 |
| 12 | `support-system-work-plan-task-12.md` | Phase 3 Task 3.0 | — |
| 13 | `support-system-work-plan-task-13.md` | Phase 3 Task 3.1 | task-03, task-04 |
| 14 | `support-system-work-plan-task-14.md` | Phase 3 Task 3.2 | task-13, task-12 |
| 15 | `support-system-work-plan-task-15.md` | Phase 3 Task 3.3 | task-14, task-12 |
| — | `support-system-work-plan-phase3-completion.md` | Phase 3 completion | 12-15 |
| 16 | `support-system-work-plan-task-16.md` | Final Phase Task F.1 | task-03 |
| 17 | `support-system-work-plan-task-17.md` | Final Phase Task F.2 (⚠ MANUAL) | — |
| 18 | `support-system-work-plan-task-18.md` | Final Phase Tasks F.3-F.9 (folded) | task-16, task-17, all prior tasks |
| — | `support-system-work-plan-phase4-completion.md` | Final Phase completion (= plan's 5th phase, numbered continuing from Phase 0-3) | 16-18 |
