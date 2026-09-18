# Task P3-T1 — `features/exams/queries/hotCounts.ts` (`hotWindows`, `readHotCounts`)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 3 (Backend Shelves Composition — Integration Point), Task P3-T1**
Layer: backend (`SOURCE/features/exams/queries/`)

Metadata:
- Dependencies: P1-T4 (constants: `HOT_WINDOW_RECENT_DAYS`, `HOT_WINDOW_WIDE_DAYS`)
- Blocks: P3-T2 (`shelves.ts` calls `readHotCounts`), P4-T2 (`ranking.ts`'s hot branch calls it too), P7-T1 (home's `listHotExams`, itself inside `shelves.ts`)
- Size: Small (1 new file)
- Verification level: L2

## Implementation Content
Create `SOURCE/features/exams/queries/hotCounts.ts` (`hotWindows(now)`, `readHotCounts(supabase, label, now)`) — the single RPC call site and single window computation, shared by `shelves.ts`, `ranking.ts`'s hot branch (Phase 4), and home's `listHotExams` (Phase 7).

## Target Files
- [ ] `SOURCE/features/exams/queries/hotCounts.ts` (new)
- [ ] `SOURCE/features/exams/queries/__tests__/hotCounts.test.ts` (new — unit test with a mocked Supabase client, proving the window computation and RPC call shape)

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ Query layer "hotCounts.ts")
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `docs/adr/ADR-0021-cross-user-hot-aggregate-and-attempt-source.md` (§ Decision D4 — the ladder is evaluated in Node; the clock is read once, in the query layer — never inside `lib/adaptive`)
- `SOURCE/lib/adaptive/constants.ts` (P1-T4's `HOT_WINDOW_RECENT_DAYS`, `HOT_WINDOW_WIDE_DAYS`)
- `SOURCE/features/exams/queries/` (an existing `readBounded`-style query module, as a structural precedent for the labeled-call convention)
- `SOURCE/lib/adaptive/constants.ts` (`LIST_ROW_CEILING` — the constant this module's `p_max_rows` argument must import, never hand-copy)

## Boundary Context (from the work plan's Connection Map)
- **Boundary**: Node query layer → Postgres RPC `exam_hot_counts`. Owner left (this task): `features/exams/queries/hotCounts.ts`. Owner right: `supabase/schema.sql` §20c function (P0-T1). Expected signal: response rows are `(exam_id, recent_count, wide_count, total_count)`; `anon` gets 42501. This task owns the **left-side call site** — the single place in the codebase that calls this RPC.

## Investigation Notes
_(Record here: confirmation `hotWindows(now)` takes `now` as a parameter, not `Date.now()` internally; confirmation `p_max_rows` is `LIST_ROW_CEILING + 1` via import, not a literal; the exact `readBounded` label string used.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Write failing cases: `hotWindows(now)` computes `p_since_recent`/`p_since_wide` correctly for a fixed `now` (hour-snapped per the backend DD); `readHotCounts` calls `.rpc("exam_hot_counts", {...})` exactly once per invocation with `p_max_rows = LIST_ROW_CEILING + 1`
### 2. Green Phase
- [ ] Implement `hotWindows(now)` and `readHotCounts(supabase, label, now)`
- [ ] Run tests and confirm all pass
### 3. Refactor Phase
- [ ] Confirm 0 `Date.now()`/`new Date()` calls exist anywhere else in this module besides the single `now` parameter's use
- [ ] Confirm `p_max_rows` is derived from the imported `LIST_ROW_CEILING`, not a hand-copied literal

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: `npx vitest run features/exams/queries/__tests__/hotCounts.test.ts` with a mocked Supabase client; assert on the exact arguments passed to `.rpc(...)`.
- **Success criteria**: `p_max_rows` argument equals `LIST_ROW_CEILING + 1` (imported, checked by reference/value against the constant, not re-typed); the window boundaries are computed from the single `now` parameter passed in, not read internally.
- **Failure response**: if `p_max_rows` is a hand-copied literal that happens to match today but would silently drift if `LIST_ROW_CEILING` ever changes, fix by importing the constant — this is exactly the "missing-sort-key ordering"/consistency class of defect the plan's ADR binding exists to prevent.
- **Verification level**: L2.

## Proof Obligations
- **Claim** (ADR-0021 D4): the clock is read ONCE per composition, here — never inside `lib/adaptive`.
  - **Primary failure mode**: a downstream consumer (`shelves.ts` or `ranking.ts`'s hot branch) reads its own `now` independently, causing the recent/wide window boundaries to drift between the hot-shelf pick and the hot-sort branch within the same request.
  - **Boundary to exercise**: in-process unit test + static grep across `lib/adaptive/**` for `Date.now()`/`new Date()` calls (should be 0).
  - **State assertion**: N/A (pure computation over a passed-in `now`).
  - **Mock boundary rationale**: the Supabase client is mocked at its call boundary (`.rpc`) — the window-computation half is pure and needs no mock.
  - **Residual**: that every consumer (P3-T2, P4-T2, P7-T1) actually passes the same `now` value through a single composition-level read is those tasks' own proof obligation — this task only proves `hotCounts.ts` itself doesn't introduce a second clock read.
- **Claim**: `p_max_rows = LIST_ROW_CEILING + 1`, imported, never hand-copied.
  - **Primary failure mode**: a literal number is used instead of importing the constant, silently drifting from the row-ceiling clamp if `LIST_ROW_CEILING` is ever retuned elsewhere.
  - **Boundary to exercise**: in-process unit test asserting the exact argument value against the imported constant.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: Supabase client mocked at `.rpc` boundary.
  - **Residual**: the actual clamp behavior against a real row-ceiling-exceeding dataset is P8-T4's obligation (d) (row-ceiling clamp).

## Completion Criteria
- [ ] All added tests pass
- [ ] Confirmed 0 `Date.now()`/`new Date()` calls anywhere in `lib/adaptive/**`
- [ ] `p_max_rows` confirmed to import `LIST_ROW_CEILING`, not hand-copy it
- [ ] Gates 1-6 green

## Notes
- Impact scope: `hotCounts.ts` (new), its test file (new).
- Scope boundary: this module is the **only** place `exam_hot_counts` is called from Node — no other file should call `.rpc("exam_hot_counts", ...)` directly.
