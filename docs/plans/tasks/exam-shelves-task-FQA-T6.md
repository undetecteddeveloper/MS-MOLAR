# Task FQA-T6 (manual, not automatable) — Accessibility pass: keyboard + TalkBack

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T6**
Layer: cross-cutting (manual verification — no source files changed unless a defect is found)

Metadata:
- Dependencies: Phase 5 (page integration) complete
- Blocks: none (required sign-off gate per Success Criteria #8)
- Size: Small (0 files; 1 manual audit)
- Verification level: L1 (manual, real assistive-technology check)

## Implementation Content
Accessibility pass — keyboard + TalkBack at 360 and 1280: every card reachable in DOM order, shelf headings announced, ribbon absent from the accessible name; confirm the already-measured contrast values hold in shipped markup (ribbon 11.0:1, subtitle 9.0:1). Target: 0 defects (Success Criteria #8).

## Target Files
- [ ] None expected (manual audit task; source files change only if a defect is found and fixed as a follow-up)

## Investigation Targets
- `docs/ui-spec/exam-shelves-ui-spec.md` (§ Accessibility Requirements)
- `SOURCE/features/exams/components/ExamRibbon.tsx` (P2-T1 — `aria-hidden`, confirmed absent from accessible name)
- `SOURCE/features/exams/components/ExamShelf.tsx` (P2-T3 — shelf heading structure, card focus order)
- `SOURCE/features/exams/components/ExamCard.tsx` (P2-T2 — the stretched-link pattern that makes each card a single focusable unit)

## Investigation Notes
_(Record here: the keyboard tab-order trace at 360 and 1280; the TalkBack announcement text for a shelf heading and for a ribboned card, confirmed to exclude the ribbon's text from the card's accessible name; the measured contrast values in the shipped markup, confirmed to match 11.0:1 (ribbon) and 9.0:1 (subtitle).)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Confirm the specific keyboard/TalkBack test procedure to follow (tab through the page at 360px width, then 1280px width; enable TalkBack or an equivalent screen reader)
### 2. Green Phase
- [ ] Keyboard: tab through `/exams` at both widths, confirm every card is reachable in DOM order (practice→hot→explore, left-to-right within each shelf)
- [ ] TalkBack: confirm shelf headings are announced; confirm a ribboned card's accessible name does not include the ribbon's text
- [ ] Contrast: confirm the ribbon (11.0:1) and subtitle (9.0:1) contrast values hold in the shipped markup, not just the design tokens
### 3. Refactor Phase
- [ ] If any defect is found, record it precisely (which element, which width, which check) before escalating

## Operation Verification Methods
- **Verification method**: manual keyboard tab-through + TalkBack (or equivalent screen reader) pass at 360 and 1280 widths; manual contrast measurement against shipped markup.
- **Success criteria**: every card reachable in DOM order; shelf headings announced; ribbon excluded from accessible names; contrast values confirmed at 11.0:1 (ribbon) and 9.0:1 (subtitle).
- **Failure response**: any defect blocks sign-off — this is a manual, non-automatable gate (Success Criteria #8 requires 0 defects, not "mostly accessible").
- **Verification level**: L1.

## Proof Obligations
- **Claim** (Success Criteria #8): every card is keyboard-reachable in DOM order, shelf headings are announced by assistive technology, the ribbon is excluded from every card's accessible name, and the ribbon/subtitle contrast ratios hold in shipped markup — 0 defects across all checks at both 360 and 1280 widths.
  - **Primary failure mode**: `ExamRibbon`'s `aria-hidden` (proven in isolation at P2-T1's component boundary) is defeated by a different ancestor's ARIA attribute or DOM restructuring once composed inside the real `ExamCard`/`ExamShelf`/page tree — a composition-level regression that no single component's own unit test can catch, since each component was tested in isolation.
  - **Boundary to exercise**: real browser + real assistive technology (TalkBack or equivalent) — not a mock, not a jsdom-based accessibility-tree approximation.
  - **State assertion**: N/A (an accessibility-tree/contrast measurement, not a data-state transition).
  - **Mock boundary rationale**: none — accessible-name computation and contrast rendering both depend on real browser/AT behavior that cannot be reliably approximated by a mock.
  - **Residual**: this audit exercises the specific 2 breakpoints named by the plan and the specific interaction patterns (tab order, shelf heading announcement, ribbon exclusion); it is not an exhaustive WCAG audit of the whole page.

## Completion Criteria
- [ ] Keyboard tab-order confirmed correct at both widths
- [ ] TalkBack announcements confirmed correct (shelf headings announced, ribbon excluded from accessible name)
- [ ] Contrast values confirmed at both target ratios in shipped markup
- [ ] 0 defects found (or every found defect resolved and re-verified before sign-off)

## Notes
- Impact scope: none expected; if a defect is found, the fix is a follow-up task outside this plan's original scope (escalate rather than silently expanding scope).
- Scope boundary: this task does not implement fixes — it audits and reports.
