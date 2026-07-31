# Task 01: Fixture-e2e Harness Setup — Fixture Data + Mock/Override Boundary (Work Plan Phase 0, Task 0.1)

Metadata:
- Dependencies: none
- Provides: `SOURCE/tests/e2e/fixture/historyFixtureData.ts` (new fixture-data module — consumed by Task 15 / `history-work-plan-task-15.md`)
- Size: Small (1 file)

Certainty: low (Reason: this repo has no existing request/route-mocking layer — no MSW, no test-mode query override; `rating.fixture.e2e.test.ts`'s own header note confirms the same gap was left unresolved for the Rating feature, so there is no working in-repo example of this interception actually wired end-to-end).
Exploratory implementation: true.
Fallback: if investigation shows no feasible way to intercept the server-side Supabase calls made by Next.js Server Components (`listMyHistory()`/`getResult()`/`getCurrentUser()`) without modifying those query modules — which are out of this task's Target Files (they belong to Tasks 03/04, not yet built when this task runs) — fall back to **real-Postgres seeding** instead of mocking: seed an actual local-Supabase test user's rows via a service-role script mirroring `SOURCE/supabase/test-rls.ts`'s established `setupXFixtures`/`cleanupXFixtures` pattern (already proven for real-Postgres verification in this exact repo). Record this decision explicitly in Investigation Notes rather than leaving the boundary mechanism unresolved.

## Implementation Content

Build the fixture data + a mock/override boundary that `history.fixture.e2e.test.ts` (Task 15) needs before it can run: four profiles — empty-list, null-user, error-throwing, valid multi-row — for `listMyHistory()`/`getResult()`/`getCurrentUser()`. Confirm the Playwright MCP driver pattern against `rating.fixture.e2e.test.ts`'s established structural-subset-of-Playwright's-Page/Locator-API style.

## Target Files
- [ ] `SOURCE/tests/e2e/fixture/historyFixtureData.ts` (new — fixture profiles + documented override-boundary mechanism; naming decision recorded below)

## Investigation Targets
- `SOURCE/tests/e2e/fixture/rating.fixture.e2e.test.ts` (lines 1-70+ — driver interface `FE2Driver`/`FE2Locator`, fixture-data style, and its own explicit "residual, out of Target Files" admission for the same wiring gap)
- `SOURCE/tests/e2e/fixture/history.fixture.e2e.test.ts` (the skeleton this fixture data must support — read the full obligations list for HE1/HE2/HE3 to know exactly which profiles/shapes are required)
- `SOURCE/supabase/test-rls.ts` (lines ~1-80 for `setupRatingFixtures`/`cleanupRatingFixtures` pattern — the fallback seeding approach's structural precedent)
- `docs/design/history-backend-design.md` (§ Data Contracts — `MyHistoryEntry`/`ExamResult` deltas — exact field shapes the fixture profiles must match)

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular: does `rating.fixture.e2e.test.ts` demonstrate any actual live-wired interception, or only an unresolved residual? (Expected finding, per the header read during decomposition: only the latter.)
- [ ] Decide and record the override-boundary mechanism (see Certainty/Fallback above) in Investigation Notes before writing any fixture data — this is a genuine open technical decision, not a formality.
- [ ] Author the 4 fixture profiles (empty-list, null-user, error-throwing, valid multi-row with 2+ entries spanning different `submitted_at` values) matching `MyHistoryEntry`/`ExamResult`'s exact field shapes.
- [ ] Write a minimal Node/vitest import-check (or equivalent) that fails until the fixture module exists and exports typed, structurally-valid profiles.

### 2. Green Phase
- [ ] Add the fixture-data module with the 4 profiles + the decided override-boundary mechanism (or the documented real-Postgres-seeding fallback script).
- [ ] Confirm the import-check passes.

### 3. Refactor Phase
- [ ] Clean up naming/typing; ensure profiles are easily importable by Task 15's driver script without further shape changes.

## Quality Assurance Mechanisms
- ESLint / Prettier / `tsc` strict — Enforces: style, formatting, types — Config: `SOURCE/eslint.config.mjs` (repo root)

## Operation Verification Methods
- **Verification method**: import the fixture module from a throwaway script/test and confirm each of the 4 profiles is structurally valid against `MyHistoryEntry[]`/`ExamResult`/`getCurrentUser()`'s return shapes; separately, open a throwaway Playwright MCP session against `npm run dev` and attempt to exercise the chosen override-boundary mechanism once.
- **Success criteria**: fixture profiles import cleanly with no type errors; the throwaway MCP session either (a) successfully observes the override taking effect on a real page load, or (b) if the fallback (real-Postgres seeding) was chosen instead, a seeded user's `/history` page load reflects the seeded rows.
- **Failure response**: if neither the override mechanism nor the seeding fallback can be made to work within this task's Target Files scope, document the specific blocker in Investigation Notes and escalate — do not silently narrow Task 15's later scope without a recorded reason.
- **Verification level**: L3 (fixture module builds/type-checks cleanly) as the floor; L1 (a real `npm run dev` page load reflects fixture/seeded data) as the target, per the plan's own Completion criterion.

## Completion Criteria
- [ ] Fixture profiles exist and are importable by the harness (Implementation)
- [ ] No lint/type errors (Quality)
- [ ] Confirmed loadable by a throwaway Playwright MCP session against `npm run dev`, with the chosen override/seeding mechanism intercepting or supplying data for all three of `listMyHistory()`/`getResult()`/`getCurrentUser()` (Integration) — or, if infeasible without out-of-scope file changes, the blocker is explicitly recorded in Investigation Notes for Task 15 to resolve

## Notes
- Impact scope: `SOURCE/tests/e2e/fixture/` only — this task must not modify `SOURCE/app/(HM)/**` or any production query module (those don't exist yet at this point in the dependency graph).
- Scope boundary: do not implement `listMyHistory()`/`getResult()` here — those are Tasks 03/02's responsibility. This task only prepares data/harness that later tasks (chiefly Task 15) will consume.
