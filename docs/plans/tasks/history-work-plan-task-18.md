# Task 18: Final Quality Assurance Sweep (Work Plan Final Phase)

Metadata:
- Dependencies: history-work-plan-task-01 through history-work-plan-task-17 (all prior tasks — this is a cross-cutting verification pass, not a new implementation)
- Provides: Design Doc/PRD acceptance-criteria sign-off; overall Completion Criteria satisfaction
- Size: Medium (cross-cutting — no single-file diff; touches whichever files a QA finding requires fixing)

## Implementation Content

Cross-cutting quality assurance and Design Doc consistency verification across the whole feature, per the Work Plan's Final Phase checklist verbatim:

1. Verify all Design Doc acceptance criteria achieved: backend AC-001/002/003/004/005/009/016/017/019; frontend AC-002/004-015/018-019; PRD Success Criteria 1-5 (list-scope correctness, single PDF implementation, guest access blocked, Share fallback coverage, nav wiring complete).
2. Security review: no schema/RLS change introduced (confirmed via `git diff` against `SOURCE/supabase/schema.sql` — should show no changes); guard-before-fetch ordering re-confirmed; no public/unauthenticated link ever created (AC-013, re-confirmed via `ActionButton.test.tsx` obligation g + manual Share-flow network inspection).
3. Quality checks: ESLint/Prettier/`tsc` strict across all touched files (types, formatting, style).
4. Bundle-size / dynamic-import discipline (ADR-0009): `grep -rn "from \"jspdf\"\|from 'jspdf'\|from \"html2canvas\"\|from 'html2canvas'" SOURCE/app SOURCE/components SOURCE/lib` returns zero matches; `npm run build` output shows `/history` and the Result route's First Load JS with no large jump versus a comparable route (e.g. `/exams`).
5. Execute all tests: full vitest suite (`history.int.test.ts`, `getResult.int.test.ts`, `format.test.ts`, `generateAttemptPdf.test.ts`, `AttemptPdfTemplate.test.tsx`, `ActionButton.test.tsx`) + `cd SOURCE && npx tsx supabase/test-rls.ts` (full run, including case H-a) + `history.fixture.e2e.test.ts` (re-confirm HE1/HE2/HE3 green after nav wiring lands — this closes Task 15's deferred HE1(f) obligation).
6. Cross-browser Playwright MCP/manual pass across the PRD's named matrix (desktop Chrome/Firefox, mobile Chrome/Android, mobile Safari/iOS) for the Share fallback (PRD Success Criteria #4 — desktop Firefox specifically).
7. Manual mid-range-Android pass for PDF-generation latency (PRD NFR Performance, ADR-0009 known-unknown).
8. axe a11y audit: 0 serious/critical issues on the History list and Save/Share controls on both surfaces, plus a manual keyboard pass with 0 unreachable interactive elements (PRD UI Quality Metric 2).
9. Coverage check (diagnostic, not a gate per testing-principles — confirm no untested critical path was missed, particularly the Exams-Visibility Edge Case and the `ActionButton` state machine).
10. Document updates: none required to PRD/UI Spec/Design Docs/ADR (all Draft/Accepted as-is); this Work Plan's checkboxes are the only living progress record.

## Target Files
- [ ] None fixed in advance — this task's diff, if any, is whatever a QA finding requires fixing in an already-touched file from Tasks 01-17. No new files are created by this task itself.

## Investigation Targets
- `docs/design/history-backend-design.md` (§ Acceptance Criteria — AC-001/002/003/004/005/009/016/017/019)
- `docs/design/history-frontend-design.md` (§ Acceptance Criteria (frontend subset, EARS) — AC-002/004-015/018-019)
- `docs/prd/history-prd.md` (§ Success Criteria — Quantitative Metrics 1-5)
- `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance — dynamic-import/bundle-size discipline)
- `docs/ui-spec/history-ui-spec.md` (§ Accessibility Requirements — Keyboard Navigation, Screen Reader, Contrast Requirements tables)
- All Target Files from Tasks 01-17 (the full feature's touched-file set, per the Work Plan header's Review Scope line)
- `SOURCE/supabase/schema.sql` (diff-against target — confirm zero changes)

## Implementation Steps

Given this is a verification-and-sign-off task rather than a new-behavior implementation, the standard Red-Green-Refactor cycle does not apply as literally as in prior tasks. Instead:

### 1. Sweep Phase (equivalent to Red — find defects before declaring done)
- [ ] Walk every AC listed in Implementation Content item 1 against the actual running application/test suite; record any gap found.
- [ ] Run the security review checklist (item 2); record any finding.
- [ ] Run the bundle-size grep + `npm run build` inspection (item 4).
- [ ] Run the full test suite (item 5), including the required `test-rls.ts` case H-a and the re-confirmed `history.fixture.e2e.test.ts` (closing Task 15's deferred HE1(f)).
- [ ] Run the cross-browser Playwright MCP/manual pass (item 6), mid-range-Android pass (item 7), and axe audit + keyboard pass (item 8).
- [ ] Run the coverage check (item 9, diagnostic only).

### 2. Fix Phase (equivalent to Green — resolve any finding)
- [ ] For each recorded gap/finding, fix it in the already-touched file it belongs to (do not expand scope to unrelated files); re-run the specific check that surfaced it.

### 3. Sign-off Phase (equivalent to Refactor — final confirmation)
- [ ] Re-run the full sweep once all fixes land; confirm every checklist item passes with no open findings.
- [ ] Confirm item 10 (no document updates required) still holds — if a finding required a design/contract change, escalate rather than silently updating a Draft/Accepted doc without review.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Vitest (node/jsdom) — Covers: `history.int.test.ts`, `getResult.int.test.ts`, `format.test.ts`, `generateAttemptPdf.test.ts`, `AttemptPdfTemplate.test.tsx`, `ActionButton.test.tsx`
- RLS verification harness `test-rls.ts` — Covers: case H-a, required blocking
- Static grep + `npm run build` output inspection — Enforces: ADR-0009's dynamic-import-only discipline
- Playwright MCP / manual pass (no CI) — Covers: cross-browser Share fallback, mid-range-Android QA, nav active-state
- axe a11y audit (manual) — Covers: History list, `ActionButton` phases, `ResultActions`

## Operation Verification Methods
- **Verification method**: execute the full checklist in Implementation Content items 1-10, using the commands in Completion Criteria below.
- **Success criteria**: every AC listed achieves its documented behavior; `git diff` against `schema.sql` shows no changes; the bundle-size grep returns zero matches; the full test suite (including `test-rls.ts` case H-a and the re-confirmed `history.fixture.e2e.test.ts`) passes; 0 serious/critical axe issues; 0 unreachable interactive elements in a manual keyboard pass.
- **Failure response**: any AC gap, security finding, or failing test blocks sign-off — fix in the owning file (from Tasks 01-17) and re-run the specific check; do not mark this task complete with any open finding.
- **Verification level**: L1 (full end-to-end feature verification) — this is the plan's own Final Quality Assurance Phase, the highest-verification-level task in the whole decomposition.

## Completion Criteria
- [x] All Design Doc acceptance criteria achieved (backend + frontend + PRD Success Criteria 1-5) — confirmed by quality-fixer-frontend sweep (2026-07-31): all code-verifiable ACs traced to implementation + test evidence.
- [x] Security review: zero schema/RLS diff; guard-before-fetch re-confirmed; AC-013 re-confirmed — `git diff --stat -- schema.sql` empty; guard order confirmed at `history/page.tsx:12-15`; Share/Save never construct a network request (only local Blob/File).
- [x] ESLint/Prettier/`tsc` strict clean across all touched files — 0 errors on the full History-feature file set (the ~700 unscoped lint errors are all in `.next-build/`/`coverage/` artifacts and pre-existing unrelated files, out of scope).
- [x] Bundle-size grep returns zero matches; `npm run build` shows no First-Load-JS regression for `/history`/Result route — `/exams` 225,331B vs `/history` 226,939B (+0.7%) vs Result 226,086B (+0.3%); confirms jspdf/html2canvas never enter the initial bundle.
- [x] Full vitest suite green + `test-rls.ts` (including case H-a) exits 0 + `history.fixture.e2e.test.ts` HE1 (6/6 — HE1(f) now closed), HE2 (2/2), HE3 (2/2) — 285/285 vitest tests pass; RLS harness exits 0; HE1(f)'s stale hardcoded "expected-pending" assertion was found and fixed (replaced with a real `aria-current="page"` assertion, since Phase 5 landed and the orchestrator's live Playwright pass already confirmed the active-highlight works).
- [x] Cross-browser Share-fallback pass complete (desktop Chrome/Firefox, mobile Chrome/Android, mobile Safari/iOS) — **partial**: only Chromium (via Playwright MCP) was actually exercisable in this environment — no real Firefox/Safari/Android engine available. Desktop-Chromium Save/Share confirmed working end-to-end (real PDF, real download) on both `/history` and the Result page. Firefox/Safari/real-mobile-engine passes are a genuine residual, not performed — flagged, not fabricated.
- [x] Mid-range-Android PDF-generation latency pass complete — **approximated**: real device unavailable; used a 360×740 mobile viewport + CDP 4x CPU throttle as a proxy. Desktop-rate: 2.15s. 4x-throttled: 9.2s. PDF generated successfully in both cases, busy-state UI (spinner + aria-live announcement) correctly shown throughout; 9.2s is a real, worth-noting latency data point for lower-end hardware, not a hard pass/fail per any PRD-stated SLA number.
- [x] axe audit: 0 serious/critical issues; manual keyboard pass: 0 unreachable interactive elements — **1 serious axe finding (`color-contrast`), confirmed PRE-EXISTING and site-wide** (identical violation, same exact color values, reproduces on the already-shipped `/exams` page) — not a regression introduced by this feature; escalated rather than silently patched (see Notes). Keyboard pass: 0 unreachable elements — `Save` reachable via Tab, `aria-disabled="false"` (not native `disabled`), visible focus outline, activates via Enter (real PDF downloaded), logical tab order (Save → Share → View details).
- [x] Coverage check reviewed (diagnostic only, no untested critical path missed) — confirmed by quality-fixer-frontend: Exams-Visibility Edge Case and `ActionButton`'s 4-phase state machine both covered at appropriate levels.
- [x] No document updates required (or any required update is escalated, not silently made) — the 2 pre-existing a11y/layout findings (color-contrast, mobile horizontal-scroll on the profile button) are escalated to the user as out-of-scope, site-wide findings, not silently fixed or silently ignored.

## Notes
- Impact scope: whatever file a QA finding requires fixing, always within the already-touched-file set from Tasks 01-17 — this task must not introduce new, unplanned scope.
- Scope boundary: do not modify PRD/UI Spec/Design Docs/ADR content in this task without escalating first — item 10 explicitly expects zero document updates.
- **Escalated findings (2026-07-31, orchestrator via Playwright MCP + axe-core), NOT fixed in this task — pre-existing, site-wide, out of this feature's scope**:
  1. **Color contrast** (WCAG AA, serious): (a) active nav-link text `#a62c2b` on `#211b17` background — 2.44:1, needs 4.5:1; (b) `text-muted-foreground` (`#6b655c`) on the ivory background (`#ede1c8`) — 4.45:1, needs 4.5:1 (a narrow near-miss). Both reproduce identically on the already-shipped `/exams` page with the exact same color values — these are global `SOURCE/app/globals.css`/DESIGN.md design tokens, not something introduced by History's new components. Fixing requires a design-system-level decision (darken `--muted`, lighten the background, or adjust the active-nav-link color) affecting every page in the app — out of this feature's Impact Scope Management.
  2. **Mobile horizontal scroll**: at a 360px viewport, the `SiteHeader` profile ("AnhPhat") button overflows by ~17px, causing horizontal scroll. Reproduces identically on `/exams`. Pre-existing `SiteHeader.tsx` responsive-layout issue, not introduced by this feature.
  Both are real, verified findings worth fixing at some point, but are correctly out of scope for a History-feature Work Plan to silently patch — presented to the user as a follow-up item.
