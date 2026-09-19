# Task FQA-T9 — Documentation confirmation

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Final Phase, Task FQA-T9**
Layer: cross-cutting (verification only — no source files changed unless a gap is found)

Metadata:
- Dependencies: Phase 0 (P0-T2, P0-T7, P8-T1's header corrections) and PRD finalization complete
- Blocks: none
- Size: Small (0-2 files; confirmation only, edits only if a gap is found)
- Verification level: L2

## Implementation Content
Documentation — confirm `docs/project-context/external-resources.md` still reflects this feature's entries; confirm PRD Undetermined Items U1-U4 remain closed as recorded in PRD v1.2 (no action expected, confirm only).

## Target Files
- [x] `docs/project-context/external-resources.md` (confirmation only — edit only if a genuine gap is found; confirmed, 0 edits needed)

## Investigation Targets
- `docs/project-context/external-resources.md` (current state — already shown as modified in git status at plan-creation time, per the plan's own Notes section, "already corrected in a separate pass per frontend DD Open Items (TBD-03), not an action item of this plan")
- `docs/prd/exam-shelves-prd.md` (§ Undetermined Items U1-U4 — confirm all remain closed as recorded in v1.2)
- `docs/design/exam-shelves-backend-design.md`, `docs/design/exam-shelves-frontend-design.md` (§ External Resources Used sections — cross-check against the project-context file)

## Investigation Notes

**`external-resources.md` cross-check against both Design Docs (all 10 citations found, none stale/missing):**
- Backend DD § External Resources Used cites 5 project-tier labels: Database Schema Source, Migration History, Schema Change Process, Schema version fingerprint, RLS verification harness. All 5 present in `external-resources.md` (first three under `## Backend`/`## API`, last two under `## Additional Resources`) with matching file paths (`schema.sql`, `supabase/migrations/`, `schemaFingerprint.ts`, `test-rls.ts`).
- Frontend DD § External Resources Used cites 5 project-tier labels: Design Origin, Design System, Guidelines, Visual Verification Environment, API Schema Source. First 4 present under `## Frontend` with matching content (Đêm hội theme in `globals.css`, `SOURCE/features/exams/components/`, Playwright CLI via `npm run pw`). "API Schema Source" is listed in `external-resources.md` under `## API` as `Status: not applicable — ... the API surface is code-first`; the frontend DD's citation (`SOURCE/features/exams/queries/shelves.ts` — `listExamShelves`, `listHotExams`) is consistent with that code-first status, not a contradiction — it is the feature-specific identifier for the code-first "contract," not a separate OpenAPI/proto source the project-tier file failed to record. No edit needed.
- `external-resources.md`'s header note ("Last updated: 2026-09-18 ... drift-only correction") matches the UI Spec's Revision History (`docs/ui-spec/exam-shelves-ui-spec.md` line 332: "TBD-01 closed with measured contrast, TBD-03 dropped") and line 325 ("TBD-03 (stale `external-resources.md`) was fixed in a separate pass") — confirms the plan's own Notes section claim that this file was already corrected outside this plan's task list. No gap found; **0 edits made to `external-resources.md`**.

**PRD Undetermined Items U1-U4 — confirmed still closed, no reopening trigger found:**
- PRD's own `[ ]` checkboxes on U1-U4 (`docs/prd/exam-shelves-prd.md` lines 255-258) stay unchecked by the PRD's own convention (each item states a default + "a one-word ok locks them" / "one-line constant change" — the checkbox marks a still-open invitation to override the default, not "unresolved"). The actual closure record is backend DD's Agreement Checklist "PRD open items" row (`docs/design/exam-shelves-backend-design.md:44`, dated 2026-09-18, same day as PRD v1.2): "All four closed by the engineer on 2026-09-18, with no open alternative" — U1 subtitles accepted as written (AC-019–AC-023), U2 the 15% share is a review trigger not a ship gate, U3 keeps the three site-scope rungs, U4 `HOT_SHELF_MIN_CARDS` stays 5.
- Cross-checked against shipped code, confirming the defaults were implemented as recorded (no drift that would reopen any item):
  - U4: `HOT_SHELF_MIN_CARDS = 5` at `SOURCE/lib/adaptive/constants.ts:191`.
  - U3: three site-wide rungs (`site-recent`, `site-30d`, `site-all`) present in `SOURCE/lib/adaptive/examShelves.ts:30,117-119,126` and their copy strings (`Toàn hệ thống, tuần này` / `, 30 ngày qua` / `, từ trước tới nay`) in `SOURCE/lib/copy.ts:141-143`.
  - U1: AC-019–AC-023 subtitle copy present in `lib/copy.ts` per the Appendix's copy-key list; no replacement string was introduced during implementation.
  - U2: no 14-day reading exists yet to trigger a number replacement (review trigger, not a gate) — nothing to act on, consistent with "review trigger, not ship gate."
- No new information surfaced during FQA-T1–T8 (security review, CLS/accessibility deferrals, test-coverage check) that bears on any of U1-U4's subject matter. **No reopening warranted; no escalation needed.**

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read `external-resources.md`'s current state and both Design Docs' § External Resources Used sections
- [x] Read PRD § Undetermined Items U1-U4
### 2. Green Phase
- [x] Cross-check `external-resources.md` against both Design Docs — confirm no entry is stale or missing
- [x] Confirm each of U1-U4 remains closed with no new information from implementation that would reopen it
### 3. Refactor Phase
- [x] If a genuine gap is found (a resource cited in a Design Doc but missing from `external-resources.md`), correct it in this task — otherwise, no edit is made (no gap found; no edit made)

## Operation Verification Methods
- **Verification method**: cross-reference review of `external-resources.md` against both Design Docs and the PRD's Undetermined Items section.
- **Success criteria**: `external-resources.md` reflects every resource cited by either Design Doc; U1-U4 all confirmed still closed.
- **Failure response**: if a stale/missing entry is found, correct it directly (this is a small, low-risk documentation fix); if an Undetermined Item appears to need reopening based on something discovered during implementation, escalate rather than silently reopening or silently ignoring it.
- **Verification level**: L2.

## Completion Criteria
- [x] `external-resources.md` confirmed to reflect this feature's entries (or corrected if a gap was found)
- [x] PRD Undetermined Items U1-U4 confirmed still closed
- [x] Investigation Notes record the confirmation

## Notes
- Impact scope: `external-resources.md` only, and only if a genuine gap is found — the plan's own Notes section already records this file as pre-corrected in a separate pass, so this task is expected to find 0 changes needed.
- Scope boundary: do not reopen any PRD Undetermined Item without escalating first.
