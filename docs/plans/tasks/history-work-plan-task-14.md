# Task 14: Wire `HistoryList` into `history/page.tsx` (Work Plan Phase 4, Task 4.2)

Metadata:
- Dependencies: history-work-plan-task-04 (Deliverable: `(HM)/history/page.tsx`'s guard + fetch, with temporary placeholder render), history-work-plan-task-13 (Deliverable: `HistoryList` component)
- Provides: `/history` renders real data end-to-end
- Size: Small (1 file)

## Implementation Content

Add the `+1 import + render line` to `SOURCE/app/(HM)/history/page.tsx` (frontend DD's own stated scope item): `import { HistoryList } from "./_components/HistoryList"` and render it with `listMyHistory()`'s entries, **replacing Task 04's temporary `return null` placeholder**.

## Target Files
- [x] `SOURCE/app/(HM)/history/page.tsx` (edit — replace placeholder render with real `HistoryList` import + render)

## Investigation Targets
- `SOURCE/app/(HM)/history/page.tsx` (Task 04's current placeholder implementation — the exact one-line comment marking where this task's change belongs)
- `SOURCE/app/(HM)/history/_components/HistoryList.tsx` (Task 13's output — exact prop shape `{ entries: MyHistoryEntry[] }`)
- `docs/design/history-backend-design.md` (§ Auth Guard and Layout — the backend DD's own code sample already shows `return <HistoryList entries={entries} />`)
- `docs/design/history-frontend-design.md` (§ Agreement Checklist / Scope — "One line added to backend-authored `SOURCE/app/(HM)/history/page.tsx` (import + render `HistoryList`)") — Design Traceability

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular confirming `HistoryList`'s prop shape matches what `history/page.tsx` already computes (`entries` from `listMyHistory()`).
- [x] No new automated test is required for this exact single-line change (frontend DD's own scope note) — proceed to a manual `npm run dev` verification plan instead of a new failing automated test; automated coverage of the resulting render is Task 15's fixture-e2e execution.

### 2. Green Phase
- [x] Add `import { HistoryList } from "./_components/HistoryList"` and replace `return null;` with `return <HistoryList entries={entries} />;`.

### 3. Refactor Phase
- [x] Confirm no leftover placeholder comment or unused import remains.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide

## Operation Verification Methods
- **Verification method**: manual `npm run dev` hit of `/history` as a seeded user; separately, `npm run build` to confirm no build regression.
- **Success criteria**: `/history` now renders real data end-to-end (rows, empty state, or error state depending on the seeded user's data); `tsc`/lint clean; build green.
- **Failure response**: if `HistoryList` fails to render (prop mismatch), re-verify Task 13's exported prop shape before assuming this task's one-line change is wrong.
- **Verification level**: L1 (`/history` now renders real data end-to-end) — this is the plan's own designated verification for this task.

## Completion Criteria
- [x] One import + one JSX line, matching frontend DD Agreement Checklist (Implementation)
- [x] `tsc`/lint clean, build green (Quality)
- [x] `/history` now renders real data end-to-end (Integration)

## Notes
- Impact scope: `SOURCE/app/(HM)/history/page.tsx` only (the 1-line diff scope explicitly named by the frontend DD).
- Scope boundary: do not modify the guard logic (`getCurrentUser()`/`redirect()`) established in Task 04 — this task only replaces the placeholder render.
- **Live-browser confirmation (2026-07-31, orchestrator via Playwright MCP)**: `/history` for the `smithnguyen247+rlstesta@gmail.com` test account renders 30+ real rows, correctly ordered newest-first, each with title/score/date/completion-time, working Save (real PDF downloaded, `%PDF-1.3` valid, 0 console errors) and Share buttons, and a working "View details" link — clicked one, correctly navigated to `/exams/[examId]/attempt/[attemptId]/result`. This closes the loop this task's own Green Phase could only static-verify (curl to an unauthenticated 307). No defects found; the full vertical slice (Tasks 01-14) works end-to-end.

## Investigation Notes
- `page.tsx` (Task 04 placeholder): guard (`getCurrentUser()`/`redirect`) ran first, then `await listMyHistory();` (result discarded), then a comment marking `return null;` as the exact spot for this task's change.
- `HistoryList.tsx` (Task 13): exported as `export function HistoryList({ entries }: { entries: MyHistoryEntry[] }): JSX.Element`, imported from `@/app/(HM)/queries` type `MyHistoryEntry`. Server Component, owns its own `<main>` wrapper (no wrapper needed from `page.tsx`).
- `history-backend-design.md` § Auth Guard and Layout: code sample shows `const entries = await listMyHistory(); return <HistoryList entries={entries} />;` — matches implementation exactly.
- `history-frontend-design.md` § Scope: confirms this is a 1-line-diff scope item ("One line added to backend-authored `page.tsx` (import + render `HistoryList`)").
- Implementation: added `import { HistoryList } from "./_components/HistoryList";`, changed `await listMyHistory();` to `const entries = await listMyHistory();`, replaced `return null;` (and its placeholder comment) with `return <HistoryList entries={entries} />;`. Guard logic untouched.
