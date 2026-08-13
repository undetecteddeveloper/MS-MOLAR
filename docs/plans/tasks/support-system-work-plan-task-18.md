# Task 18: Final Quality Assurance Sweep (Work Plan Final Phase, Tasks F.3-F.9)

Metadata:
- Dependencies: support-system-work-plan-task-16 (Deliverable: full RLS regression confirmed green), support-system-work-plan-task-17 (Deliverable: `ADMIN_USER_IDS` Preview-scope fix confirmed — needed for a real off-Production admin-surface pass), all prior tasks (task-01 through task-15 — this is a cross-cutting verification pass, not a new implementation)
- Provides: Design Doc/PRD acceptance-criteria sign-off; overall Completion Criteria satisfaction
- Size: Medium (cross-cutting — no single-file diff; touches whichever files a QA finding requires fixing)

## Implementation Content

Cross-cutting quality assurance and Design Doc consistency verification across the whole feature, per the Work Plan's Final Phase checklist verbatim (Tasks F.3-F.9):

1. **(F.3) Verify all Design Doc acceptance criteria achieved**: backend AC-002/004/008-012/AC-013/AC-014/015-019/021/022/AC-023/024-034/036/041/043-049 (AC-013, AC-014, and AC-023 listed explicitly per document review findings I002 and I004 — AC-013 closed by task-03's ST-e; AC-014 closed by task-14's `<img>`-only render-path proof obligation; AC-023 closed by task-15 and Phase 3 Completion Criteria); frontend AC-001/003/005-007/020/035/037-040/042; PRD Success Criteria 1-15.
2. **(F.4) Security review**: RLS AND-clauses/strict-revoke re-confirmed (Phase 0/task-16); `submitSupportTicket`/both admin actions never leak raw DB/Storage error text; `user_id`/`adminId` never taken from client input; `SUPPORT_SMTP_APP_PASSWORD` never logged and covered by `check-ai-key-bundle.mjs`.
3. **(F.5) Quality checks**: `cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npx vitest run && npm run build` — zero errors across the whole feature.
4. **(F.6) Execute all tests**: full vitest suite (all `lib/support/`, `lib/mail/`, `components/support/`, `app/(admin)/admin/tickets/` test files) + full `test-rls.ts` (task-16) + all 3 fixture-e2e journeys (task-10, task-11, task-15) re-confirmed green.
5. **(F.7) Manual keyboard + jsx-a11y-lint pass** (axe not adopted in this repo's toolchain — recorded gap, see Quality Assurance Mechanisms): 0 unreachable interactive elements across the widget (trigger, dialog, all three intents, attachment control, acknowledgement, error states) and the admin ticket page.
6. **(F.8) Coverage check** (diagnostic, not a gate): confirm no untested critical path was missed, particularly the fire-and-forget mail decoupling (task-06 Group 4) and the internal-notes RLS strict-revoke form (task-03).
7. **(F.9) Document updates**: none required to PRD/UI Spec/Design Docs/ADR (all already reflect the shipped contracts); this work plan's checkboxes are the only living progress record.

## Target Files
- [ ] None fixed in advance — this task's diff, if any, is whatever a QA finding requires fixing in an already-touched file from task-01 through task-17. No new files are created by this task itself.

## Investigation Targets
- `docs/design/support-system-backend-design.md` (§ Acceptance Criteria — the full backend AC list named in item 1 above)
- `docs/design/support-system-frontend-design.md` (§ Acceptance Criteria (frontend subset, EARS) — the full frontend AC list named in item 1 above; § Verification Strategy correctness definition items — cross-check against task-09/task-14's proof obligations)
- `docs/prd/support-system-prd.md` (§ Success Criteria — Quantitative Metrics 1-15)
- `docs/adr/ADR-0012-support-system-email-transport-and-admin-allowlist.md` (§ Decision, § Implementation Guidance — re-confirm every Binding Decision from task-05/task-06 still holds)
- `docs/ui-spec/support-system-ui-spec.md` (§ Accessibility Requirements — keyboard navigation, screen reader tables — the basis for item 5's manual pass)
- All Target Files from task-01 through task-17 (the full feature's touched-file set, per the Work Plan header's Review Scope line)
- `SOURCE/scripts/check-ai-key-bundle.mjs` (confirm the `SUPPORT_SMTP_APP_PASSWORD`/`SUPPORT_SMTP_USER`/`nodemailer` markers are present and the client-bundle scan is clean)

## Implementation Steps

Given this is a verification-and-sign-off task rather than a new-behavior implementation, the standard Red-Green-Refactor cycle does not apply as literally as in prior tasks. Instead:

### 1. Sweep Phase (equivalent to Red — find defects before declaring done)
- [ ] Walk every AC listed in Implementation Content item 1 against the actual running application/test suite; record any gap found.
- [ ] Run the security review checklist (item 2); record any finding — pay particular attention to error-message text returned by `submitSupportTicket`/`changeTicketStatusAction`/`addTicketNoteAction` for any leaked raw DB/Storage error string.
- [ ] Run `cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npx vitest run && npm run build` (item 3).
- [ ] Run the full test suite (item 4), including `test-rls.ts` (task-16, already confirmed) and all 3 fixture-e2e journeys.
- [ ] Run the manual keyboard pass + jsx-a11y-lint review (item 5).
- [ ] Run the coverage check (item 6, diagnostic only).

### 2. Fix Phase (equivalent to Green — resolve any finding)
- [ ] For each recorded gap/finding, fix it in the already-touched file it belongs to (do not expand scope to unrelated files); re-run the specific check that surfaced it.

### 3. Sign-off Phase (equivalent to Refactor — final confirmation)
- [ ] Re-run the full sweep once all fixes land; confirm every checklist item passes with no open findings.
- [ ] Confirm item 7 (no document updates required) still holds — if a finding required a design/contract change, escalate rather than silently updating a Draft/Accepted doc without review.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs` — Covers: project-wide
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness — Config: `.github/workflows/ci.yml:51-52` — Covers: project-wide
- Vitest (`npm test`) — Covers: `SOURCE/lib/support/`, `SOURCE/lib/mail/`, `SOURCE/lib/ugc/limits.ts`, `SOURCE/components/support/**`, `SOURCE/app/(admin)/admin/tickets/**`
- Schema fingerprint three-way assertion + FK-parser tests (part of `npm test`) — re-confirmed clean
- i18n dictionary contract tests — Enforces: vi/en key parity, `report-ms`-absence — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- `checkEnv` contract tests — Config: `SOURCE/lib/env/__tests__/checkEnv.test.ts`
- Production build in CI (`npx next build`) — Config: `.github/workflows/ci.yml:74-80`
- Client-bundle secret scan (`npm run check:bundle`) — Config: `SOURCE/scripts/check-ai-key-bundle.mjs`
- `npx tsx supabase/test-rls.ts` (manual, not in CI) — re-confirmed green at task-16
- Manual keyboard pass + jsx-a11y ESLint rules (no axe integration exists in this repo's toolchain — recorded QA gap, not silently assumed covered, per the work plan's own "Known QA gaps" note)

## Operation Verification Methods
- **Verification method**: execute the full checklist in Implementation Content items 1-7, using the commands in Completion Criteria below.
- **Success criteria**: every AC listed achieves its documented behavior; the security review finds no client-input-derived `user_id`/`adminId` and no leaked raw error text; the full test suite (including `test-rls.ts` and all 3 fixture-e2e journeys) passes; 0 unreachable interactive elements in the manual keyboard pass.
- **Failure response**: any AC gap, security finding, or failing test blocks sign-off — fix in the owning file (from task-01 through task-17) and re-run the specific check; do not mark this task complete with any open finding.
- **Verification level**: L1 (full end-to-end feature verification) — this is the plan's own Final Quality Assurance Phase, the highest-verification-level task in the whole decomposition.

## Completion Criteria
- [ ] All Design Doc acceptance criteria achieved (backend + frontend + PRD Success Criteria 1-15), with AC-013/AC-014/AC-023 explicitly confirmed per document review findings I002/I004
- [ ] Security review: RLS AND-clauses/strict-revoke re-confirmed; no leaked raw DB/Storage error text; `user_id`/`adminId` never client-supplied; `SUPPORT_SMTP_APP_PASSWORD` never logged and covered by the secret scan
- [ ] `cd SOURCE && npx tsc --noEmit && npx eslint --max-warnings 0 && npx vitest run && npm run build` — zero errors
- [ ] Full vitest suite green + `test-rls.ts` (task-16) exits 0 + all 3 fixture-e2e journeys (task-10, task-11, task-15) re-confirmed green
- [ ] Manual keyboard pass: 0 unreachable interactive elements across the widget and the admin ticket page
- [ ] Coverage check reviewed (diagnostic only, no untested critical path missed — particularly the fire-and-forget mail decoupling and the internal-notes RLS strict-revoke form)
- [ ] No document updates required (or any required update is escalated, not silently made)

## Notes
- Impact scope: whatever file a QA finding requires fixing, always within the already-touched-file set from task-01 through task-17 — this task must not introduce new, unplanned scope.
- Scope boundary: do not modify PRD/UI Spec/Design Docs/ADR content in this task without escalating first — item 7 explicitly expects zero document updates.
- The axe automated accessibility audit and the no-hard-coded-display-string lint rule (AC-035) are both recorded, adopted-not-covered QA gaps per the work plan's own header — this task's manual keyboard pass and code-review discipline substitute for them; do not silently claim automated coverage that does not exist.
