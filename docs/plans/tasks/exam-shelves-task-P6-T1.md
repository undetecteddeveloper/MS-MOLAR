# Task P6-T1 — `?from=` chain wiring: detail page + `StartAttemptButton`

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 6 (Attempt-Source `?from=` Chain Wiring), Task P6-T1**
Layer: frontend (`SOURCE/app/(exams)/exams/[id]/page.tsx`, `SOURCE/features/exams/components/StartAttemptButton.tsx`)

Metadata:
- Dependencies: P1-T5 (`toAttemptSource`), P2-T2 (`ExamCard`'s `?from=` producer), P5-T1 (live shelf cards to click through)
- Blocks: P8-T1 (Phase 8 depends on this chain being wired for full-feature verification)
- Size: Small (2 files)
- Verification level: L1 — starting an attempt from a shelf card writes the correct `source` value

## Implementation Content
Edit `SOURCE/app/(exams)/exams/[id]/page.tsx:30-32,127` — accept `searchParams`, read `from`, pass `source={from}` to `StartAttemptButton`. Edit `SOURCE/features/exams/components/StartAttemptButton.tsx:17-18` — add `source?: string` prop; `startAttempt.bind(null, examId, source)` replaces `bind(null, examId)`.

## Target Files
- [ ] `SOURCE/app/(exams)/exams/[id]/page.tsx`
- [ ] `SOURCE/features/exams/components/StartAttemptButton.tsx`

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The attempt-source write path — full chain)
- `docs/design/exam-shelves-frontend-design.md` (§ Field Propagation Map — the `?from=` chain)
- `docs/design/exam-shelves-frontend-design.md` (Implementation Path Mapping — `[id]/page.tsx` gains `searchParams`; `StartAttemptButton.tsx` gains `source?: string`)
- `SOURCE/app/(exams)/exams/[id]/page.tsx` (`:30-32` current signature without `searchParams`; `:127` the `StartAttemptButton` call site)
- `SOURCE/features/exams/components/StartAttemptButton.tsx` (`:17-18` current props; the `bind(null, examId)` call this task extends)
- `SOURCE/lib/exams/attemptSource.ts` (P1-T5 — `toAttemptSource`, the single normalisation point this chain relies on)
- `SOURCE/features/exams/actions.ts` (P1-T5 — `startAttempt(examId, rawSource?)`, the consumer this chain feeds)

## Change Category
`Change Category: boundary-change`

Design-to-Plan Traceability marks `[id]/page.tsx` gaining `searchParams` and `StartAttemptButton.tsx` gaining `source?: string` as `connection-switching`/`contract-change` rows, and the `?from=` Field Propagation Map (7 boundary rows, P2-T2 + P6-T1) as `contract-change`. Sweep the adjacent case: every other call site of `StartAttemptButton` (if any exist beyond the detail page) must continue to compile with the new optional `source` prop, defaulting through to `startAttempt`'s own `rawSource?` default.

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: `ExamCard`/`ExamShelf` → browser URL `?from=` → exam detail page. Owner left: `features/exams/components/ExamCard.tsx` (P2-T2, producer, already landed). Owner right (this task, consumer): `app/(exams)/exams/[id]/page.tsx`. Serialized format: `?from=practice|hot|explore` — lowercase ASCII, single key, appended to `/exams/{id}`. Consumer parse rule: `searchParams: Promise<{from?: string}>`, read raw and untyped, no validation until `toAttemptSource()`. Expected signal: detail page's `from` value matches the shelf the card was followed from. **Roundtrip check this task owns**: the `from` value this task reads from `searchParams` must be exactly what P2-T2's producer emitted — no re-encoding, no case change — and must reach `startAttempt` unmodified (validation/normalisation happens only inside `toAttemptSource`, at the server-action boundary, not here).
- **Boundary**: `StartAttemptButton` (client) → `startAttempt` (server action). Owner left (this task, producer): `features/exams/components/StartAttemptButton.tsx`. Owner right: `features/exams/actions.ts` (P1-T5, consumer, already landed). Serialized format: server-action closure bound argument (React serializes bound args). Consumer parse rule: `startAttempt(examId, rawSource?)` → `toAttemptSource(rawSource)`. Expected signal: inserted `exam_attempts.source` matches the normalised value.

## Investigation Notes
_(Record here: the manual smoke-check result — the actual `exam_attempts.source` value read back on dev after starting an attempt from a `?from=hot` card; confirmation `searchParams` is read as `Promise<{from?: string}>`, untyped, with 0 client-side validation.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write/extend a component or integration test confirming: `[id]/page.tsx` reads `from` from `searchParams` and passes it as `source` to `StartAttemptButton`; `StartAttemptButton` binds `source` into `startAttempt`'s second argument
### 2. Green Phase
- [ ] Edit `[id]/page.tsx` to accept `searchParams`, read `from`, pass `source={from}`
- [ ] Edit `StartAttemptButton.tsx` to accept `source?: string` and bind it into `startAttempt`
### 3. Refactor Phase
- [ ] Confirm `from` is read raw/untyped — 0 client-side validation before it reaches `toAttemptSource` at the server-action boundary
- [ ] Manual smoke test: start an attempt from a shelf card, read `exam_attempts.source` back on dev, confirm it matches the shelf followed from; start an attempt from the flat grid/home block, confirm `source='none'`

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`, `app/(exams)/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: manual smoke test on dev — start an attempt from a `?from=hot` shelf card and read `exam_attempts.source` back; start one from the flat grid/home block and confirm `source='none'`.
- **Success criteria**: `?from=hot` card start writes `source='hot'`; a flat-grid/home-block start (no `from`) writes `source='none'`.
- **Failure response**: if the wrong value is written, trace the chain backward from the DB column through `startAttempt` → `StartAttemptButton` → `[id]/page.tsx` → `searchParams`, checking each hop against this task's Boundary Context roundtrip checks.
- **Verification level**: L1 — real end-to-end functional proof on dev.

## Proof Obligations
- **Claim**: `?from=` is read as `searchParams: Promise<{from?:string}>`, untyped, with 0 client-side validation — normalisation happens only inside `toAttemptSource` (Phase 1) at the server-action boundary.
  - **Primary failure mode**: this task adds its own validation/whitelist check on `from` before passing it along, creating a second normalisation point that can silently disagree with `toAttemptSource`'s rules.
  - **Boundary to exercise**: component + server-action integration (manual smoke test, real dev DB write).
  - **State assertion**: before → student clicks a `?from=hot` card; after → `exam_attempts` row inserted with `source='hot'`.
  - **Mock boundary rationale**: none for the manual smoke test — this is a real end-to-end write to dev.
  - **Residual**: the full `?from=` chain's producer-side correctness (P2-T2) and consumer-side normalisation correctness (P1-T5) were each proven in isolation earlier; this task's residual is exactly the wiring between them, closed by the manual smoke test.

## Completion Criteria
- [ ] `[id]/page.tsx` reads `searchParams`, extracts `from`, passes `source={from}`
- [ ] `StartAttemptButton` accepts `source?: string`, binds it into `startAttempt`
- [ ] Manual smoke test confirms `?from=hot` → `source='hot'`; no-`from` → `source='none'`, read back on dev
- [ ] Every existing `StartAttemptButton` call site confirmed still compiling (Change Category sweep)
- [ ] Gates 1-4 green

## Notes
- Impact scope: `[id]/page.tsx` (searchParams + prop pass-through), `StartAttemptButton.tsx` (1 new optional prop + bind argument).
- Scope boundary — preserve unchanged: every other prop/behavior of both files not named above.
