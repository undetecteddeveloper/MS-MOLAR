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
- [x] `SOURCE/app/(exams)/exams/[id]/page.tsx`
- [x] `SOURCE/features/exams/components/StartAttemptButton.tsx`

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

**Investigation targets read.** `attemptSource.ts` — `toAttemptSource(raw)` is the sole normalisation point; anything not byte-for-byte one of `practice|hot|explore|none` (incl. `undefined`, arrays, garbage) collapses to `'none'`, never throws. `actions.ts` — `startAttempt(examId, rawSource?)` inserts `source: toAttemptSource(rawSource)` and is the only writer of that column. `[id]/page.tsx` (before) had no `searchParams` param; `StartAttemptButton.tsx` (before) had the placeholder `startAttempt.bind(null, examId, undefined)` at `:18`. Both design docs' Field Propagation Map / attempt-source write path confirm the exact contract implemented below.

**Implementation.** `[id]/page.tsx` now takes `searchParams: Promise<{ from?: string }>`, reads it via `const [{ id }, { from }] = await Promise.all([params, searchParams])` (verbatim per frontend DD § Field Propagation Map), and passes `<StartAttemptButton examId={exam.id} source={from} />`. `StartAttemptButton.tsx` now accepts `source?: string` and does `startAttempt.bind(null, examId, source)`. **Confirmed**: `from` is read raw/untyped (typed `string | undefined`, not the `AttemptSource` union) and reaches `startAttempt` unmodified — 0 whitelist/validation logic added in either file; `toAttemptSource` inside `startAttempt` remains the only normalisation point (verified by a case asserting `source='totally-bogus'` passes through both hops unfiltered in the two new test files).

**Call-site sweep (Change Category: boundary-change).** `Grep: StartAttemptButton` across `SOURCE` → exactly 1 real call site (`[id]/page.tsx:127`); the only other match is `StartAttemptSubmit.tsx`'s doc comment (its child component, not a caller). `source` is optional, so this one call site is the only one requiring an edit and it compiles.

**Automated roundtrip proof (two boundaries, per the task's own Boundary Context split).**
- `app/(exams)/exams/[id]/__tests__/page.test.tsx` (new) — mocks `getExam`/`hasReported`/`getCurrentUser` (data layer) and `StartAttemptButton` (capturing stub) per the task's own boundary split; renders via `renderServerTree` (AuthorByline is an async child, same empty-tree hazard as `ExamShelf.test.tsx`); asserts `StartAttemptButton` receives `{ examId, source }` for `?from=hot`, absent `?from=` (`source: undefined`), and `?from=totally-bogus` (passed through raw, unfiltered) — proves the URL → page hop of the Boundary Context's roundtrip check.
- `features/exams/components/__tests__/StartAttemptButton.test.tsx` (new) — mocks `@/features/exams/actions`' `startAttempt`; renders `await StartAttemptButton(props)` via `@testing-library/react`'s `render` (no async child, `SkillRecommendationCard.test.tsx` precedent) and `fireEvent.submit`s the form (React 19 client-side form-action interception, same mechanism `DisplayNameEditor.test.tsx` relies on); asserts `startAttempt` is called with `(examId, source, FormData)` for `source='hot'`, absent `source` (`undefined`), and `source='totally-bogus'` (raw passthrough) — proves the page → `startAttempt` hop.
- Together the two files exercise the full chain end-to-end at the automated level: the value read from `searchParams.from` is exactly the value that reaches `startAttempt`'s second argument, unmodified at both hops.

**Revision round (integration-test-reviewer, needs_revision).** Both new test files were missing this feature's established skeleton-annotation convention (`AC:`, `ROI:`, `Behavior:`, `@category:`, `@lane:`, `@dependency:`, `@complexity:`, `@real-dependency:`, `Primary failure mode:`, `Proof obligation:` — see `shelves.int.test.ts`/`rating.int.test.ts` "Test 1"/"Candidate 1" blocks). Fixed: added one such block above each file's `describe(...)` (mirroring the reference files' "one candidate block covering obligations (a)/(b)/(c)" shape, since each file's 3 `it()` cases are one coherent claim tested across 3 input variations, not 3 independent candidates), and relabelled the 3 `it()` titles in each file with `obligation (a)/(b)/(c)` prefixes to match. Re-ran `npx tsc --noEmit` (clean), `npx eslint --max-warnings 0` project-wide (clean — the reviewer's own session hit a sandbox block on these gates; unblocked in this session, so both ran to completion), and `npx vitest run` on both files (6/6 still green). The manual dev smoke test checkbox is intentionally left as before — the coordinator is handling that directly with the engineer.

**Manual dev smoke test (L1, Proof Obligations' "real end-to-end write to dev") — NOT completed in this session.** Attempted: (1) `node scripts/pw/cli.mjs status` — no existing browser session (`about:blank`), so a fresh Playwright sign-in as the test account would be required; per this repo's own recorded constraint (`auto-mode-blocks-test-signin`), Auto Mode's Bash classifier denies every form of Playwright sign-in as the test account. (2) No dev server was running (`curl localhost:3000/exams` → no response) and starting one plus signing in was therefore not attempted further, to avoid repeatedly hitting a documented block. **This step still needs to run** before this task can be considered L1-verified: start dev (`npm run dev`), sign in as the shared test account, click a `?from=hot` shelf card on `/exams`, submit "Làm bài", then read back `exam_attempts.source` for the newly created row (expect `'hot'`); repeat once via the flat grid / home block (no `?from=`) and expect `'none'`. Needs an engineer (or a session with the Playwright sign-in allow-rule) to run.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write/extend a component or integration test confirming: `[id]/page.tsx` reads `from` from `searchParams` and passes it as `source` to `StartAttemptButton`; `StartAttemptButton` binds `source` into `startAttempt`'s second argument
### 2. Green Phase
- [x] Edit `[id]/page.tsx` to accept `searchParams`, read `from`, pass `source={from}`
- [x] Edit `StartAttemptButton.tsx` to accept `source?: string` and bind it into `startAttempt`
### 3. Refactor Phase
- [x] Confirm `from` is read raw/untyped — 0 client-side validation before it reaches `toAttemptSource` at the server-action boundary
- [ ] Manual smoke test: start an attempt from a shelf card, read `exam_attempts.source` back on dev, confirm it matches the shelf followed from; start an attempt from the flat grid/home block, confirm `source='none'` — **NOT run this session** (see Investigation Notes: no dev server running, Auto Mode blocks Playwright test-account sign-in; needs an engineer)

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
- [x] `[id]/page.tsx` reads `searchParams`, extracts `from`, passes `source={from}`
- [x] `StartAttemptButton` accepts `source?: string`, binds it into `startAttempt`
- [ ] Manual smoke test confirms `?from=hot` → `source='hot'`; no-`from` → `source='none'`, read back on dev — **not run this session** (see Investigation Notes)
- [x] Every existing `StartAttemptButton` call site confirmed still compiling (Change Category sweep) — 1 real call site (`[id]/page.tsx:127`), compiles; `npx tsc --noEmit` project-wide clean
- [x] Gates 1-4 green — `tsc --noEmit` clean, `eslint --max-warnings 0` clean (project-wide), `npm run build` succeeds, `npm run check:bundle` PASS; `npx vitest run` is green for every file this task touches (1 pre-existing, unrelated failure in `lib/security/rateLimit.test.ts` — not touched by this task, present before this task started)

## Notes
- Impact scope: `[id]/page.tsx` (searchParams + prop pass-through), `StartAttemptButton.tsx` (1 new optional prop + bind argument).
- Scope boundary — preserve unchanged: every other prop/behavior of both files not named above.
