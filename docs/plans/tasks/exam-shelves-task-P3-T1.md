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
- [x] `SOURCE/features/exams/queries/hotCounts.ts` (new)
- [x] `SOURCE/features/exams/queries/__tests__/hotCounts.test.ts` (new — unit test with a mocked Supabase client, proving the window computation and RPC call shape)

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

- **Backend DD § Query layer "hotCounts.ts"** (`:338-392`): exact signatures `hotWindows(now: Date): { sinceRecent: string; sinceWide: string }` and `readHotCounts(supabase, label, now): Promise<Map<string, HotCounts>>`. `readHotCounts` computes both boundaries via `hotWindows(now)` and calls `readBounded(label, supabase.rpc("exam_hot_counts", { p_since_recent, p_since_wide, p_max_rows: LIST_ROW_CEILING + 1 }))`. The `date_trunc('hour', …)` snap happens **server-side inside the SQL function** (`schema.sql` §20c), not in `hotWindows()` — Node only subtracts `HOT_WINDOW_RECENT_DAYS`/`HOT_WINDOW_WIDE_DAYS` days from `now` and returns ISO strings via `toISOString()`. Confirmed `hotWindows(now)` takes `now` as a parameter, never reads `Date.now()`/`new Date()` internally.
- **Backend DD § Logging** (`:584`, the section is titled "Error Handling" with an inline "**Logging**:" paragraph, not a separate "Logging and Monitoring" heading): the only new log is `readBounded`'s existing `console.error`, with labels `listExamShelves.hotCounts` / `listExamsRanked.hotCounts` (and by the same convention `listHotExams.hotCounts`, named in the Query layer code comment at `:384`). Confirmed: the label string is **passed in by the caller** as `readHotCounts`'s `label` parameter — `hotCounts.ts` itself does not compute or hardcode a label; it only forwards whatever string the caller passes straight into `readBounded`.
- **ADR-0021 D4** (`:78-82`): the ladder is evaluated in a pure `lib/adaptive` helper; the clock is read ONCE per render/composition, in the query layer (`createClient()`'s impure boundary), never inside `lib/adaptive`. `hotCounts.ts` is exactly that query-layer clock-reading site — `now: Date` arrives as a caller-supplied parameter, so a second clock read never happens inside this module.
- **`SOURCE/lib/adaptive/constants.ts:217, :233`**: `HOT_WINDOW_RECENT_DAYS = 7` and `HOT_WINDOW_WIDE_DAYS = 30` (P1-T4, already landed) — imported, not re-declared.
- **`SOURCE/features/exams/queries/attempts.ts`** (structural precedent, P2-T4): labeled `readBounded` call convention — `type SupabaseClient = Awaited<ReturnType<typeof createClient>>;` declared locally, `readBounded(label, supabase.from(...)...)` pattern, `"server-only"` import at top, Vietnamese header comment recording extraction history and cross-consumer sharing rationale. `hotCounts.ts` follows the same shape: local `SupabaseClient` type alias, `"server-only"` import, header comment.
- **`SOURCE/lib/supabase/boundedRead.ts:74, :84-89, :113`**: `LIST_ROW_CEILING = 500` (imported, never hand-copied per this task's Completion Criteria); `readBounded(label: string, query: BoundedListQuery): Promise<unknown[]>` expects a query object with only a `.limit()` method — `supabase.rpc(...)` (a `PostgrestFilterBuilder`) satisfies this shape, confirmed by the DD's own code sample at `:386-390` and by `rating.int.test.ts:791` ("client boundary -> exactly 3 .from(...) calls + 1 .rpc(...) call").
- **Data Contract / Field Propagation Map** (`:518-527, :550`): RPC output rows are `(exam_id text, recent_count bigint, wide_count bigint, total_count bigint)`; bigint "may arrive as number" over PostgREST — propagation rule is `Number(...)`, non-finite ⇒ `0`. Same defensive-coercion pattern already used for `exam_results.total_score` in `ranking.ts:87-92` (`numeric` arrives as `number | string`, coerced via `Number(...)`, `Number.isFinite` guards). `hotCounts.ts` applies the identical coercion to all three count columns when building the returned `Map<string, HotCounts>`.
- **`SOURCE/lib/adaptive/examShelves.ts:33-37`**: `HotCounts` is already exported there (`{ recent: number; wide: number; total: number }`) — `hotCounts.ts` imports this type rather than redeclaring it, per the DD's "declared once, in the module whose helpers consume them" rule (`:328-336`).
- No Reference Contracts / Binding Decisions section present in this task file — those pre-implementation checks are not applicable.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing cases: `hotWindows(now)` computes `p_since_recent`/`p_since_wide` correctly for a fixed `now` (hour-snapped per the backend DD); `readHotCounts` calls `.rpc("exam_hot_counts", {...})` exactly once per invocation with `p_max_rows = LIST_ROW_CEILING + 1`
### 2. Green Phase
- [x] Implement `hotWindows(now)` and `readHotCounts(supabase, label, now)`
- [x] Run tests and confirm all pass
### 3. Refactor Phase
- [x] Confirm 0 `Date.now()`/`new Date()` calls exist anywhere else in this module besides the single `now` parameter's use
- [x] Confirm `p_max_rows` is derived from the imported `LIST_ROW_CEILING`, not a hand-copied literal

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
- [x] All added tests pass
- [x] Confirmed 0 `Date.now()`/`new Date()` calls anywhere in `lib/adaptive/**`
- [x] `p_max_rows` confirmed to import `LIST_ROW_CEILING`, not hand-copy it
- [x] Gates 1-6 green (gates 1-5 run directly: `tsc --noEmit`, `eslint --max-warnings 0`, `vitest run`, `npm run build`, `check:bundle` all pass; gate 6 `test:localdb` needs the dev database and is out of this task's L2 scope — the RPC itself landed on dev in Phase 0 per the task's context note. One pre-existing, unrelated failure in `lib/security/rateLimit.test.ts` — a Gemini budget/quota test untouched by this change — was observed in the full `vitest run` and is not part of this task's scope.)

## Notes
- Impact scope: `hotCounts.ts` (new), its test file (new).
- Scope boundary: this module is the **only** place `exam_hot_counts` is called from Node — no other file should call `.rpc("exam_hot_counts", ...)` directly.
