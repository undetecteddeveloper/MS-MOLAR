# Task P4-T2 — `ranking.ts`: `sort === "hot"` branch (4th `Promise.all` member)

Plan mapping: `docs/plans/20260918-feature-exam-shelves.md` — **Phase 4, Task P4-T2**
Layer: backend (`SOURCE/features/exams/queries/`)

Metadata:
- Dependencies: P4-T1 (the `ExamSort` widening + `catalogue.ts` branch this reuses)
- Blocks: P4-T3 (the test fill-in that proves this branch's behavior)
- Size: Small (1-2 files)
- Verification level: L2

## Implementation Content
In `SOURCE/features/exams/queries/ranking.ts`, add the `sort === "hot"` branch — a 4th `Promise.all` member that is `Promise.resolve([])` unless `filters.sort === "hot"`, in which case it calls `readHotCounts` (Phase 3) and reorders the fetched exams via `orderIdsByHotCount` (Phase 1) before `paginateExams`.

## Target Files
- [x] `SOURCE/features/exams/queries/ranking.ts`
- [x] `SOURCE/features/exams/queries/index.ts` (re-export, if needed) — not needed: `listExamsRanked`'s signature and exports are unchanged (`ExamFilters.sort` already admits `"hot"` since P4-T1), so `index.ts:29`'s existing `export { listExamsRanked } from "./ranking";` covers it verbatim. 0 lines changed.

## Investigation Targets
- `docs/design/exam-shelves-backend-design.md` (§ The `?sort=hot` axis — full pseudocode)
- `docs/design/exam-shelves-backend-design.md` (§ Logging and Monitoring — `readBounded` labels per call site)
- `SOURCE/features/exams/queries/ranking.ts` (the current `Promise.all` composition this task adds a 4th member to)
- `SOURCE/features/exams/queries/hotCounts.ts` (P3-T1 — `readHotCounts`, reused here, not re-implemented)
- `SOURCE/lib/adaptive/examShelves.ts` (P1-T4 — `orderIdsByHotCount`, reused here, not re-implemented)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/prd/exam-shelves-prd.md (§ AC-018) | structure-order | "submitted attempt count DESC, exam id ASC, where the count includes attempts by all students, not only the caller" | Does the `?sort=hot` branch order the flat-grid results using `orderIdsByHotCount`'s cross-user total, with 0 fallback to a per-caller count? |

## Investigation Notes

**Investigation Targets read:**
- `docs/design/exam-shelves-backend-design.md` § The `?sort=hot` axis (:468-489) — the exact pseudocode: `listExamsRanked` "keeps its three and adds a fourth member that is `Promise.resolve([])` unless `filters.sort === "hot"`" (:380). The real ordering is applied AFTER the fetch, Node-side: `orderIdsByHotCount(candidates, counts)` then `paginateExams`. `?dir` has no effect on this axis but is still accepted (not rejected) — no code path may reject/throw on it.
- `docs/design/exam-shelves-backend-design.md` § Logging and Monitoring (:584) — the only new log is `readBounded`'s existing `console.error` with label `listExamsRanked.hotCounts` (alongside `listExamShelves.hotCounts`); no new log carries a user id/attempt id/source value. Confirms the label string to pass to `readHotCounts`.
- `SOURCE/features/exams/queries/ranking.ts` — current 3-member `Promise.all` (`fetchExamRows`, `readMyAttemptRows`, `exam_results` read). The `filters?.sort` branch at :98-100 returns DB-side order via `rows.map(toExam)` unchanged for non-hot explicit sorts; this is where the hot reorder must be inserted.
- `SOURCE/features/exams/queries/hotCounts.ts` — `readHotCounts(supabase, label, now): Promise<Map<string, HotCounts>>`, single RPC call site, label forwarded verbatim into `readBounded`. Imported, not re-implemented.
- `SOURCE/lib/adaptive/examShelves.ts` — `orderIdsByHotCount(candidates: readonly ShelfCandidate[], counts: ReadonlyMap<string, HotCounts>): string[]` sorts by `counts.get(c.id)?.total ?? 0` DESC, `c.id` ASC (0 fallback, cross-user `total` field — matches the Reference Contract row). Imported, not re-implemented. Only `c.id` is read at runtime, but the parameter type is the full `ShelfCandidate` shape (`id, grade, subject, school, createdAt`).

**Confirmations:**
- `readHotCounts` and `orderIdsByHotCount` are imported from `./hotCounts` and `@/lib/adaptive/examShelves` respectively and called directly — not re-implemented in `ranking.ts`.
- `?dir` is accepted (not validated/rejected anywhere in `ranking.ts`) but has no ordering effect on the hot axis: the hot branch never reads `filters.dir`, matching `orderIdsByHotCount`'s single-directional (`total DESC, id ASC`) order.
- `shelves.ts`'s private `candidatesFromRows(rows): ShelfCandidate[]` helper (not exported, not a Target File of this task) performs the identical `ExamRow -> ShelfCandidate` structural mapping this task also needs to satisfy `orderIdsByHotCount`'s parameter type. Rather than expand scope to export it from `shelves.ts` (out of Target Files), this task defines a local, unexported equivalent in `ranking.ts` — a trivial 5-field structural passthrough with no business logic/branching. Rule of Three: this is the 2nd occurrence of the mapping (1st in `shelves.ts`, serving 2 call sites internally); consolidation is deferred, not mandatory, per `ai-development-guide` Rule of Three table ("2nd time: consider future consolidation"). Flagged here for a future refactor task if a 3rd occurrence appears.

**Reference Contract evaluation (AC-018 row):** Planned approach — the hot branch computes `hotCounts` via the 4th `Promise.all` member (`readHotCounts` when `sort==="hot"`, else a pre-resolved empty `Map`), then reorders the full fetched candidate set with `orderIdsByHotCount(candidates, hotCounts)` before `paginateExams`. `orderIdsByHotCount` sorts by `counts.get(c.id)?.total ?? 0` DESC, id ASC, where `counts` is the RPC's cross-user aggregate (not any per-caller count) and the fallback for an exam absent from the aggregate is a literal `0`, not a per-caller substitute. Compliance Check ("Does the branch order using `orderIdsByHotCount`'s cross-user total, with 0 fallback to a per-caller count?") = **Y** — `readHotCounts` is the sole RPC call site (`exam_hot_counts`, cross-user by definition, RLS-independent `security definer`), and the 0 fallback is `orderIdsByHotCount`'s own `?? 0`, never a locally-computed per-caller count.

**Type-safety note (implementation detail, not a design deviation):** the 4th `Promise.all` member's non-hot branch is typed `Promise.resolve<Map<string, HotCounts>>(new Map())` rather than a literal `Promise.resolve([])` — both are "0 extra calls, empty/no-op result" at runtime; the `Map` type keeps the ternary's two branches structurally identical (`Promise<Map<string, HotCounts>>`) so `orderIdsByHotCount`'s `ReadonlyMap<string, HotCounts>` parameter type-checks without a cast or a runtime `Array.isArray` guard. Behavior (0 extra network calls on every non-hot path) is unchanged from the DD's literal wording.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write/extend integration-test cases (in coordination with P4-T3's fill-in scope, or as a preliminary local check) confirming: for `sort !== "hot"`, the 4th `Promise.all` member resolves `Promise.resolve([])` and issues 0 extra calls; for `sort === "hot"`, it calls `readHotCounts` and the result feeds `orderIdsByHotCount` before `paginateExams` — done as a **preliminary local check** (`ranking.hot.local.test.ts`, temporary, not a Target File — the officially tracked assertions with independently-computed literal expected order are P4-T3's scope per `it.todo` at `rating.int.test.ts:825-832`, not duplicated here). Confirmed RED before the Green phase edit, GREEN after, then deleted so the final diff stays within Target Files.
### 2. Green Phase
- [x] Add the 4th `Promise.all` member per the DD pseudocode — `ranking.ts:118-128`, guarded on `filters?.sort === "hot"`, `Promise.resolve<Map<string, HotCounts>>(new Map())` on every other path (see Investigation Notes' type-safety note for why `Map` rather than a literal `[]`)
- [x] Wire `readHotCounts` → `orderIdsByHotCount` → `paginateExams` for the hot branch — `applyHotOrder()` (`ranking.ts:47-58`) reorders the fetched `ExamRow[]` via `orderIdsByHotCount`, called from the `filters.sort === "hot"` branch at `ranking.ts:148-151`, then `paginateExams` as before
### 3. Refactor Phase
- [x] Confirm `?dir` is still accepted (not rejected) on the hot axis even though it has no ordering effect — an old bookmarked link with `?dir=` must keep working. Verified: `ranking.ts` never reads `filters.dir` anywhere; `fetchExamRows`/`catalogue.ts` (P4-T1, unmodified by this task) already accepts `?dir` unconditionally for every sort value including `"hot"` with no rejection path. No new validation was added.

## Quality Assurance Mechanisms
- `npx tsc --noEmit` — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx eslint --max-warnings 0` — Config: `SOURCE/eslint.config.mjs:27-56` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts:17-28` (covers `features/exams/**`)
- `npm run build` — Config: `SOURCE/next.config.ts` (project-wide)
- `npm run check:bundle` — Config: `SOURCE/scripts/check-ai-key-bundle.mjs` (project-wide)

## Operation Verification Methods
- **Verification method**: integration test (finalized in P4-T3) asserting the 4th `Promise.all` member's behavior for both `sort === "hot"` and every other sort value.
- **Success criteria**: for non-hot sorts, 0 extra calls issued by the 4th member; for `sort === "hot"`, exactly the calls `readHotCounts` itself issues, and the final exam order matches `orderIdsByHotCount`'s output.
- **Failure response**: if a non-hot sort triggers an RPC call via the 4th member, the round-trip budget is silently violated — fix the guard condition (`filters.sort === "hot"`) rather than the test.
- **Verification level**: L2 (fully exercised by P4-T3's fill-in).

## Proof Obligations
- **Claim** (AC-018, AC-034): `?dir` on the hot axis has no ordering effect (Node-side, single-directional) but is still **accepted**, not rejected, so an old link keeps working.
  - **Primary failure mode**: the hot branch throws or 400s on an unrecognised/inapplicable `?dir` value instead of silently ignoring it, breaking a previously-valid bookmarked URL that happens to also carry `?dir=asc`.
  - **Boundary to exercise**: integration test (finalized in P4-T3), mocked Supabase client boundary.
  - **State assertion**: N/A (read-only query composition).
  - **Mock boundary rationale**: Supabase client mocked at its established `ranking.ts` test boundary.
  - **Residual**: the literal expected hot-order array (independently computed) is P4-T3's proof obligation, not this task's — this task proves the branch is wired correctly; P4-T3 proves its output is correct.

## Completion Criteria
- [x] 4th `Promise.all` member added, guarded correctly on `filters.sort === "hot"`
- [x] `readHotCounts` and `orderIdsByHotCount` reused (not reimplemented)
- [x] Every Reference Contract's Compliance Check evaluates to `Y`
- [x] Gates 1-6 green — `tsc --noEmit` clean; `eslint --max-warnings 0` clean on `ranking.ts`; `vitest run features/exams` 272 passed/2 todo (P4-T3's reserved `it.todo`s); `npm run build` succeeds; `npm run check:bundle` PASS. One pre-existing, unrelated failure noted: `lib/security/rateLimit.test.ts` ("keeps ONE account's whole daily Gemini budget under the project quota") fails on this worktree with no files of this task touching `lib/security/` — out of this task's scope, not introduced by this change.

## Notes
- Impact scope: `ranking.ts` (1 new `Promise.all` member + hot-branch wiring), `index.ts` (re-export only, if needed).
- Scope boundary — preserve unchanged: the existing 3 `Promise.all` members and their behavior for non-hot sorts.
