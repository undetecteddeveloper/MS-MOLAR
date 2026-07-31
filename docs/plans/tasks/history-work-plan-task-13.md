# Task 13: `HistoryList`/`HistoryRow` + `loading.tsx`/`error.tsx` (Work Plan Phase 4, Task 4.1)

Metadata:
- Dependencies: history-work-plan-task-12 (Deliverable: proven `ActionButton`/formatters baseline), history-work-plan-task-03 (Deliverable: `MyHistoryEntry` shape)
- Provides: `HistoryList`/`HistoryRow` components (consumed by Task 14)
- Size: Medium (4 files)

## Implementation Content

Create `SOURCE/app/(HM)/history/_components/{HistoryList,HistoryRow}.tsx` (list container + empty state, bounded-height scroll container per D3; one row per entry — title, `X/10` score, submitted date + completion time, 2 `ActionButton`s, "View details" link) and `SOURCE/app/(HM)/history/{loading,error}.tsx` (skeleton mirroring `(layer4)/me/exams/loading.tsx`; `error.tsx` boundary with `reset()`-wired Retry, per D7).

## Target Files
- [x] `SOURCE/app/(HM)/history/_components/HistoryList.tsx` (new)
- [x] `SOURCE/app/(HM)/history/_components/HistoryRow.tsx` (new)
- [x] `SOURCE/app/(HM)/history/loading.tsx` (new)
- [x] `SOURCE/app/(HM)/history/error.tsx` (new)

## Investigation Targets
- `SOURCE/app/(HM)/queries.ts` (Task 03's output — `MyHistoryEntry`'s exact field shape)
- `SOURCE/components/history/ActionButton.tsx` (Task 10/12's output — the shared Save/Share atom, exact prop shape `{action, pdfInput, idPrefix}`)
- `SOURCE/lib/history/format.ts` (Task 07's output — `formatSubmittedDate`/`formatCompletionTime`, the shared formatters this row must reuse, not reimplement)
- `SOURCE/app/(layer4)/_components/MyExamsList.tsx` (lines 25-31 — `ExamListScroll`'s bounded-height scroll container pattern, D3's precedent; empty-state-with-CTA shape)
- `SOURCE/app/(layer4)/_components/ExamRow.tsx` (lines 56-60, 94-98, 109 — `<li>` shell classes, `" · "`-joined metadata line convention)
- `SOURCE/app/(layer4)/me/exams/loading.tsx` (the exact skeleton pattern to mirror for `(HM)/history/loading.tsx`)
- `docs/design/history-frontend-design.md` (§ HistoryList / HistoryRow; § Data Contracts — `HistoryList`/`HistoryRow` yaml; § `HistoryList` states table — Next.js route conventions, D7)
- `docs/design/history-frontend-design.md` (§ Agreement Checklist / Scope — the HistoryList/HistoryRow/loading/error scope item) — Design Traceability
- `docs/ui-spec/history-ui-spec.md` (§ Component: HistoryList — verify default + loading + empty + error states)
- `docs/ui-spec/history-ui-spec.md` (§ Component: HistoryRow — verify default + partial states)
- `docs/ui-spec/history-ui-spec.md` (§ D3 — bounded-scroll pagination-deferral)

## Investigation Notes

- `(HM)/queries.ts` — `MyHistoryEntry = { attemptId, examId, examTitle, totalScore, startedAt, submittedAt }` (all `string` except `totalScore: number`; `submittedAt`/`startedAt` are non-null `string` on every resolved entry — `listMyHistory()` only returns `status='submitted'` rows). `listMyHistory()` throws on any of its 3 Supabase steps failing (never resolves to a partial/silent result) — confirms `error.tsx` is reachable via a real thrown error, not just a defensive stub.
- `ActionButton.tsx` (Task 10/12 output) — `ActionButtonProps = { action: "save" | "share", pdfInput: AttemptPdfData, idPrefix: string }`; `"use client"`; single in-flow `<button>` per instance in every phase (D2 DOM-shape fix already proven). `idPrefix` must be unique per rendered instance (doc comment: "keeps the sr-only reason span's id unique across N HistoryRow instances, e.g. `history-${attemptId}`") — used `history-${entry.attemptId}` verbatim per that suggestion.
- `lib/history/format.ts` — `formatSubmittedDate(submittedAt: string | null): string` ("DD/MM/YYYY", never throws, "—" fallback) and `formatCompletionTime(startedAt: string, submittedAt: string | null): string` ("Hh Mm"/"Mm Ss"/"Ss", never throws, "—" fallback per Reference Contract). Both pure, no local reimplementation needed — imported directly into `HistoryRow`.
- `MyExamsList.tsx` (lines 25-31, 70-81) — `ExamListScroll` bounded-height pattern: `<ul className="flex max-h-[30rem] flex-col gap-3 overflow-y-auto pr-2">`; empty-state-with-CTA shape: dashed border, message + Link. Note: `MyExamsList`'s own empty-state CTA ("Upload an exam") is a plain underlined text link, but the frontend DD/UI Spec explicitly calls History's empty-state CTA a "primary Link" — implemented as a brand-filled button (matching this repo's other primary-action treatment, e.g. `MyExamsList`'s header "Upload an exam" button) rather than copying `MyExamsList`'s own empty-state link styling verbatim.
- `ExamRow.tsx` (lines 56-60, 94-98, 109) — `<li>` shell: `flex flex-col gap-3 rounded-lg border border-border p-5 sm:flex-row sm:items-center sm:justify-between`; `" · "`-joined metadata `<p className="mt-1 text-sm text-muted-foreground">`; local `formatDateTime` helper — explicitly NOT reused (this task reuses `lib/history/format.ts`'s shared formatters instead, per the task's own instruction and the Data Contracts Reference Contract).
- `(layer4)/me/exams/loading.tsx` — skeleton pattern: heading skeleton `h-8 w-40 animate-pulse rounded bg-border/60` (adapted to `w-32` here, no fixed width mandated) + `[0,1,2].map` row placeholders `h-20 animate-pulse rounded-lg border border-border bg-card/40` (adapted to `[0,1,2,3]` — 4 rows per the frontend DD's `HistoryList` states table).
- Frontend DD § HistoryList/HistoryRow (lines 905-909) — layout mirrors `MyExamsList`: heading "History" (serif) + rule-divider, bounded-height scroll container (`max-h-[30rem] overflow-y-auto`, D3); `HistoryRow` mirrors `ExamRow`'s `<li>` shell verbatim; `{totalScore.toFixed(1)}/10 · {formatSubmittedDate(...)} · {formatCompletionTime(...)}`; 2 `ActionButton`s + "View details" `Link`. Confirmed `HistoryList` owns its own page-level wrapper (`max-w-2xl mx-auto px-6 py-10`) since `(HM)/history/page.tsx`'s own comment states it will be replaced with a bare `return <HistoryList entries={entries} />;` (Task 14), with no wrapping `<main>` of its own — unlike `MyExamsPage`, which wraps `MyExamsList` itself.
- Frontend DD § HistoryList states table (line 507-516) / Data Contracts (lines 451-463) — `Invariants: never re-sorts or re-filters entries` confirmed as a hard contract; `HistoryList`/`HistoryRow` Contract signatures matched exactly (`HistoryList(props: { entries: MyHistoryEntry[] })`, `HistoryRow(props: { entry: MyHistoryEntry })`).
- Frontend DD § Agreement Checklist / Scope (lines 74-76, 130-133, 147) — confirms this task's 4 files are the exact scope item, and confirms the "no vitest precedent for these Server Components" QA gap is a pre-acknowledged, not-escalation-worthy note.
- UI Spec § Component: HistoryList (lines 174-191) / § Component: HistoryRow (lines 195-213) / § D3 (line 58) — State x Display Matrices and AC-001/002/003/004/005/019 mapped 1:1 into the implementation; empty-state copy ("No results yet" / "Finish an exam to see it here." / "Browse exams") and error copy ("Couldn't load your history right now." / "Retry") reproduced verbatim.
- `ExtractionErrorPanel.tsx` — `role="alert"` panel styled `rounded-lg border border-brand bg-brand/8 px-4 py-3 text-sm text-brand`; confirmed it has **no** Retry control — `error.tsx` closes this gap with a dedicated "Retry" button wired to Next.js's `reset()`, per D7/UI Spec's explicit note that this is the first extension of that pattern with a Retry control.

**Binding Decision compliance** (pre-implementation plan, re-evaluated against final code):
- Planned approach (single Axis: `dependency_direction`): `HistoryRow.tsx` imports `ActionButton` only from `@/components/history/ActionButton` (the exact path `ResultActions.tsx` already uses) and `AttemptPdfData` only as a type-only import from `@/lib/pdf/generateAttemptPdf` (matching `ResultActions.tsx`'s own precedent of importing that type without calling the generation pipeline directly); both `<ActionButton>` instances receive `pdfInput` and reach the PDF pipeline exclusively through that shared component.
- Compliance Check ("Does `HistoryRow.tsx` reach the PDF pipeline exclusively through 2 `<ActionButton>` instances importing from the same path `ResultActions.tsx` (Task 12) already uses, with no direct import of `generateAttemptPdf.ts`?"): **Y** — confirmed by reading the final `HistoryRow.tsx`: only imports are `import { ActionButton } from "@/components/history/ActionButton"` and `import type { AttemptPdfData } from "@/lib/pdf/generateAttemptPdf"` (type-only, mirrors `ResultActions.tsx`'s identical import exactly); no reference anywhere in the file to `generateAttemptPdfFile`/`generateAttemptPdf.ts`'s runtime exports.

**Reference Contract compliance** (pre-implementation plan, re-evaluated against final code):
- Planned approach: `HistoryRow` renders `{formatCompletionTime(entry.startedAt, entry.submittedAt)}` verbatim (imported from `@/lib/history/format`, not reimplemented locally) inside the `" · "`-joined metadata line.
- Compliance Check: **Y** — confirmed by reading the final `HistoryRow.tsx`: the metadata `<p>` renders `{entry.totalScore.toFixed(1)}/10 · {formatSubmittedDate(entry.submittedAt)} · {formatCompletionTime(entry.startedAt, entry.submittedAt)}` with no local date-arithmetic anywhere in the file.

**Static/build verification performed** (this session): `npx tsc --noEmit` — clean; `npx eslint "app/(HM)/history/**/*.tsx"` — clean; `npm run build` — succeeds, `/history` route compiles with no errors (all 14 routes generated).

**Manual real-browser verification — not independently performed by this agent invocation**: no browser-automation tool (Playwright MCP or equivalent) is available in this agent's declared tool surface — same subagent-vs-orchestrator tool-propagation gap already documented in Tasks 11/12's Investigation Notes. Per this task's own Verification Level definition ("L2 as the floor... L1 proven at Task 15's fixture-e2e execution") and Proof Obligations' own "Residual: automated proof is completed by Task 15, not this task" note, L2 (types/build clean, confirmed above) is the designated floor for this task; the manual `npm run dev` + Playwright MCP pass rendering `HistoryList`/`HistoryRow` across Default/Loading/Empty/Error/Partial states is deferred to whichever session/agent has Playwright MCP access (as was resolved for Tasks 11/12), before Task 14 wires this into the real page and Task 15's fixture-e2e execution provides the automated L1 proof. `(HM)/history/page.tsx` was deliberately left untouched (still the Task-14-owned placeholder returning `null`) per this task's explicit scope boundary, so no live route currently renders these components end-to-end — that wiring, and its accompanying live verification, is Task 14's job.

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/history-frontend-design.md` (§ Data Contracts — `lib/history/format.ts`) | derived-display + state-lifecycle-negative | `"Contract: formatCompletionTime... Output: Type: string — \"Hh Mm\" (>=60min), \"Mm Ss\" (>=60s, <60min), \"Ss\" (<60s), per UI Spec HistoryRow format spec Guarantees: never throws; returns \"—\" when submittedAt is null, unparseable, or the computed diff is negative"` | Does `HistoryRow` render `formatCompletionTime(entry.startedAt, entry.submittedAt)`'s output verbatim (never a locally reimplemented time-diff calculation)? |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0009-pdf-generation-library-choice.md` (§ Implementation Guidance) | dependency_direction | Enforce the single-implementation requirement (AC-007) structurally — both `HistoryRow` and `ResultActions` import the same module; no second, parallel PDF-generation path may form | Does `HistoryRow.tsx` reach the PDF pipeline exclusively through 2 `<ActionButton>` instances importing from the same path `ResultActions.tsx` (Task 12) already uses, with no direct import of `generateAttemptPdf.ts`? |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations, in particular `HistoryList`'s stated Invariant ("never re-sorts or re-filters entries — that is entirely the backend's responsibility").
- [x] No dedicated vitest skeleton exists for these Server Components (frontend DD's own noted QA gap — matches `ExamRow`/`MyExamsList`'s own untested precedent, not treated as a gap requiring escalation). Proceed to implementation with manual `npm run dev` + Playwright MCP verification as the primary proof, deferred to Task 15's fixture-e2e execution for automated coverage.

### 2. Green Phase
- [x] Implement `HistoryList` (heading + `rule-divider` + bounded-height scroll container wrapping `entries.map(HistoryRow)`, or the empty-state block when `entries.length === 0`) exactly per the frontend DD's description and UI Spec state matrix.
- [x] Implement `HistoryRow` (`<li>` shell mirroring `ExamRow`; title, `{totalScore.toFixed(1)}/10 · {formatSubmittedDate(...)} · {formatCompletionTime(...)}`; 2 `ActionButton`s + "View details" `Link`) exactly per the frontend DD's description.
- [x] Implement `loading.tsx` (skeleton mirroring `(layer4)/me/exams/loading.tsx`) and `error.tsx` (Next.js error boundary, `role="alert"` + "Retry" wired to `reset()`, per D7).

### 3. Refactor Phase
- [x] Improve code (maintain manual-verification parity with the UI Spec's state x display matrices); confirm no client-side re-sort/re-filter logic was accidentally introduced in `HistoryList`.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root) — Covers: project-wide
- Playwright MCP / manual pass (no CI) — Covers: Save/Share e2e, `error.tsx` retry — Config: local `npm run dev` session — Covers: `/history`, Result page

## Operation Verification Methods
- **Verification method**: manual `npm run dev` pass rendering `HistoryList`/`HistoryRow` with real (or Task 01's fixture) data across Default/Loading/Empty/Error/Partial states; automated coverage deferred to Task 15's fixture-e2e execution.
- **Success criteria**: matches the frontend DD's `HistoryList`/`HistoryRow` code description and UI Spec state matrices for every state; `tsc`/lint clean.
- **Failure response**: if a state doesn't render per the UI Spec matrix (e.g. the empty-state CTA missing, or `error.tsx`'s Retry not calling `reset()`), fix before Task 14 wires this into the real page.
- **Verification level**: L2 (types/build clean, since no unit-test precedent exists for Server Components in this repo) as the floor; L1 proven at Task 15's fixture-e2e execution.

## Proof Obligations
- **Claim**: AC-002 / Failure Mode `empty input` — `HistoryList` renders the dashed-border empty state with a "Browse exams" CTA when `entries.length === 0`.
  - **Primary failure mode**: the empty state renders as a generic error or a blank page instead of the dashed-border CTA block.
  - **Boundary to exercise**: integration (manual `npm run dev` render + Task 15's fixture-e2e HE2 obligation (a)).
  - **State assertion**: before — a fixture/seeded user with zero completed+scored attempts; action — navigate to `/history`; after — dashed-border block with "No results yet" + "Browse exams" link to `/exams` renders.
  - **Mock boundary rationale**: none for this task's own manual check; Task 15's fixture-e2e execution provides the automated proof.
  - **Residual**: automated proof is completed by Task 15, not this task (no vitest precedent for Server Components in this repo).
- **Claim**: AC-019 / Failure Mode `unavailable boundary` — a `listMyHistory()` throw renders `(HM)/history/error.tsx`'s `role="alert"` + Retry, not a blank page or crash.
  - **Primary failure mode**: a thrown DB/network error crashes the page (unhandled exception) or renders a blank screen instead of the `error.tsx` boundary; or "Retry" does not actually re-attempt the read.
  - **Boundary to exercise**: integration (manual simulated failure + Task 15's fixture-e2e HE3 obligation (a)).
  - **State assertion**: before — a fixture/seeded state configured to throw from the list read; action — navigate to `/history`; after — `role="alert"` renders with the exact copy "Couldn't load your history right now." and a "Retry" control; clicking Retry re-attempts the read.
  - **Mock boundary rationale**: none for this task's own manual check; Task 15 provides the automated call-count-spy proof.
  - **Residual**: automated proof (Retry incrementing a call-count spy) is completed by Task 15.

## Completion Criteria
- [x] Matches the frontend DD's `HistoryList`/`HistoryRow` code description and UI Spec state matrices (Implementation)
- [x] `tsc`/lint clean (Quality) — `tsc --noEmit`, `eslint`, and `npm run build` all confirmed clean this session
- [ ] Proven at Task 15 (Integration) — not this task's job; tracked forward per this task's own designated L2 floor
- [ ] Each Proof Obligation's manual half is met; automated half tracked to Task 15 — manual `npm run dev` + Playwright MCP pass not independently performed by this agent invocation (no browser-automation tool in this agent's declared tool surface, same gap documented in Tasks 11/12); deferred to a session with Playwright MCP access, before Task 14 wires this into the real page
- [x] Every Reference Contract / Binding Decision Compliance Check evaluates to `Y` against the final implementation, with evidence recorded in Investigation Notes

## Notes
- Impact scope: `SOURCE/app/(HM)/history/_components/{HistoryList,HistoryRow}.tsx`, `SOURCE/app/(HM)/history/{loading,error}.tsx` only.
- Scope boundary: do not edit `SOURCE/app/(HM)/history/page.tsx` in this task — the render wiring is Task 14's, kept as a separate single-line-change commit per the frontend DD's own stated scope.
