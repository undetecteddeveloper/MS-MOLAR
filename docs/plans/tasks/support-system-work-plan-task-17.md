# Task 17: ⚠ MANUAL — `ADMIN_USER_IDS` Vercel Preview-Scope Fix (TD-014) (Work Plan Final Phase, Task F.2)

Metadata:
- Dependencies: none (independent of every other task — a pre-existing repository gap this feature inherits as a launch dependency, not a defect this feature's code introduces)
- Provides: the ability to QA `/admin/tickets` off Production (Preview deployments), unblocking real pre-launch verification of Phase 3's admin surface
- Size: N/A (infrastructure step — no source files changed by this task itself)

## ⚠ MANUAL CHECKPOINT — READ BEFORE STARTING

**This task is entirely a human-in-the-loop step an executor agent cannot complete.** Adding an admin UUID to `ADMIN_USER_IDS` for Preview scope on Vercel requires interactive access to the Vercel dashboard or an authenticated Vercel CLI session that no automated agent in this environment has. **Do not attempt to work around this** (e.g. by hardcoding the UUID into a repo file as a substitute, by fabricating a "pass" result, or by marking this task done without the human having made the Vercel change). If you are an executor agent and reach this checkpoint, **stop, report the exact required action, and hand off explicitly** — do not silently skip this task or treat it as optional.

**This is a known, pre-existing gap this feature inherits — not a defect this feature's code introduces** — but is required before the admin surface (Phase 3) can be verified anywhere but Production.

## Implementation Content

Add the dev-project admin UUID to `ADMIN_USER_IDS` for **Preview scope** on Vercel (currently Production-scope only) so `/admin/tickets` can be QA'd off Production, per PRD Use Case 13's documented launch dependency.

## Target Files
- [ ] None — this is a Vercel environment-variable-scope change, not a repo source-file change.

## Investigation Targets
- `docs/design/support-system-backend-design.md` (§ PRD Use Case 13 / Risk table — `ADMIN_USER_IDS` currently Production-scope only on Vercel, TD-014, `/admin/tickets` 404s on every Preview deploy)
- `docs/prd/support-system-prd.md` (Use Case 13 — the launch dependency this fix unblocks)
- `SOURCE/lib/` (wherever `ADMIN_USER_IDS`/`isAdminUserId()` is currently read from, to confirm the exact environment-variable name this Vercel change must target — read-only, this task does not edit this file)

## Implementation Steps

Given this is a manual infrastructure step, the standard Red-Green-Refactor cycle does not apply.

### Handoff Checklist (for an executor agent reaching this task)
- [ ] Confirm the exact environment variable name (`ADMIN_USER_IDS`) and the dev-project admin UUID value to add, by reading the Investigation Targets above.
- [ ] Report to the user: "Task F.2 requires adding the dev-project admin UUID to `ADMIN_USER_IDS` for **Preview** scope on the Vercel dashboard for this project (it is currently Production-scope only). This unblocks QA of `/admin/tickets` off Production. Please confirm once complete."
- [ ] Stop. Do not fabricate a completion.

### ⚠ MANUAL CHECKPOINT (human-in-the-loop, not agent-completable)
- [ ] Engineer adds the dev-project admin UUID to `ADMIN_USER_IDS` for Preview scope via the Vercel dashboard or CLI.
- [ ] Engineer confirms `/admin/tickets` no longer 404s on a Preview deployment for the added admin account.

## Quality Assurance Mechanisms
(None apply — this is a Vercel dashboard/environment-variable change with no repo-level test coverage.)

## Operation Verification Methods
- **Verification method**: after the Vercel change, the engineer visits `/admin/tickets` on a Preview deployment while signed in as the added admin account.
- **Success criteria**: `/admin/tickets` renders the ticket queue (no `notFound()` 404) on the Preview deployment.
- **Failure response**: if it still 404s, re-confirm the exact env var name and scope (Preview, not just Production) were both set correctly on Vercel, and that the deployed Preview build has picked up the new environment variable (may require a redeploy).
- **Verification level**: L1 (functional — a real Preview deployment's admin page renders for the added account).

## Completion Criteria
- [ ] Dev-project admin UUID added to `ADMIN_USER_IDS` for Preview scope on Vercel
- [ ] `/admin/tickets` confirmed rendering (not 404ing) on a Preview deployment for the added admin account
- [ ] Human engineer has explicitly confirmed this checkpoint passed

## Notes
- Impact scope: Vercel project environment-variable configuration only — no repo source file is touched by this task.
- Scope boundary: this is a pre-existing repository condition this feature inherits as a launch dependency (PRD Use Case 13), not a defect this feature's code introduces — do not attempt to "fix" it by changing how `isAdminUserId()`/`ADMIN_USER_IDS` is read in code; the fix is purely an environment-scope change on Vercel.
