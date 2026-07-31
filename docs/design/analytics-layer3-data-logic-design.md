# Analytics (Layer 3) — Real Data Logic — Design Document

| | |
|---|---|
| **Version** | 1.0 |
| **Date** | 2026-07-21 |
| **Status** | Draft — pending user approval |
| **Scope** | Backend/data-logic pass on an already-UI-designed feature. Replaces the hardcoded fake analytics source with real per-user, RLS-scoped Supabase aggregates. No visual/design change; the only client change is a thin container rewire. |
| **Supersedes/extends** | `docs/design/analytics-layer3-design.md` (UI-only pass) — this doc implements that doc's explicitly-deferred "Real data" non-scope item. |

## Design Summary (Meta)

```yaml
design_type: "extension"            # existing rendered feature gains a real data source; chart contract unchanged
risk_level: "medium"                # touches an RLS-scoped read path across 3 tables; no writes, no schema, no migration
complexity_level: "medium"          # one query + a pure 3-range reduce; exclusion + omission + ordering rules
main_constraints:
  - "SubjectStats props contract (BarChartCard / DonutChartCard) MUST stay byte-identical — no chart-file edits."
  - "SUBJECT union + SUBJECT_COLORS unchanged (English 7-subject union); non-union subjects excluded, no 'Other' bucket."
  - "Aggregation is TypeScript-side (supabase-js select + TS reduce) — no Postgres view/RPC, no migration."
  - "Fetch all three ranges once in page.tsx; pass Record<TimeRange, SubjectStats[]> for instant tab/filter toggle."
biggest_risks:
  - "exams.subject vocabulary drift: if any exam stored a non-canonical subject string it is silently excluded. Mitigated: verified canonical English vocabulary is enforced at intake (lib/ugc/subjects.ts). Geography/Informatics/Civic Education are the intended real exclusions (canonical but outside the 7-subject analytics union)."
  - "server-only test blast radius: the pure reducer must be importable in vitest (which does NOT scan app/**). Mitigated: pure reducer lives in lib/analytics/ (matches vitest include glob), queries.ts (server-only) only orchestrates."
unknowns:
  - "None blocking. submitted_at non-null on submitted attempts is assumed (see Assumed Behaviors); reducer guards the null case defensively."
```

## Background and Context

The Analytics page at `/me/dashboard` (route group `(layer3)`) is fully built and visually approved. Its two charts (`BarChartCard`, `DonutChartCard`) render from `SubjectStats[]`. Today that data comes from `ANALYTICS_BY_RANGE` + `getSubjectStats(range)` in `SOURCE/lib/fake-data/analytics.ts` — three hardcoded per-range datasets. This pass replaces that fake source with real per-user aggregates computed from the user's submitted exam attempts, scoped by Supabase RLS, without changing any chart props or visual design.

### External Resources Used

Per the external-resource-context skill (feature tier). This is a backend/data-logic change against the project's own Supabase instance; no design-tool, mock server, or third-party API is introduced.

| Project-tier resource (label) | Feature-specific identifier |
|---|---|
| Supabase database schema (source of truth) | `SOURCE/supabase/schema.sql` — tables `exam_results`, `exam_attempts`, `exams`; RLS policies `results_select_own`, `attempts_select_own` |
| Supabase server client | `@/lib/supabase/server` `createClient()` — cookie-bound, RLS injects `auth.uid()` |

No `docs/project-context/external-resources.md` exists in the repo; the two rows above are the environment facts this feature relies on, captured inline. No new external resource is added by this change.

## Agreement Checklist

### Scope (what to change)
- Add `SOURCE/app/(layer3)/queries.ts` (server-only): fetch submitted results for the current user and return `Record<TimeRange, SubjectStats[]>`.
- Add `SOURCE/lib/analytics/aggregateAttempts.ts` (pure, no I/O): the reduce/exclusion/omission/ordering logic, testable without Supabase.
- Edit `SOURCE/app/(layer3)/me/dashboard/page.tsx`: call the query server-side, pass `dataByRange` prop.
- Edit `SOURCE/app/(layer3)/_components/AnalyticsDashboard.tsx`: accept `dataByRange`, drop `getSubjectStats`, keep tab/range/filterTouched state, add empty-state branch.
- Edit `SOURCE/lib/fake-data/analytics.ts`: remove `ANALYTICS_BY_RANGE` + `getSubjectStats`; keep all types/constants/helpers at the same path.
- Add `SOURCE/lib/analytics/__tests__/aggregateAttempts.test.ts`: pure unit test for the reducer.

### Non-scope (what NOT to change)
- No edits to `BarChartCard.tsx` / `DonutChartCard.tsx` (props contract frozen).
- No edits to `SUBJECT_COLORS`, the `Subject` union, `SUBJECT_ORDER`, `niceCeil`, `computeShares`, `NEEDS_REVIEW_THRESHOLD`, `RANGE_LABELS`, `DEFAULT_RANGE`.
- No schema change, no migration, no Postgres view/RPC.
- No new nav/route/header changes; page path stays `/me/dashboard`.
- No rename of `lib/fake-data/analytics.ts` in this pass (documented follow-up only).

### Constraints
- Chart props contract byte-identical; the only client change is the container rewire (`AnalyticsDashboard` + `page.tsx`).
- RLS-scoped to `auth.uid()` — no service-role client, no cross-user reads.
- Instant tab/filter toggling preserved: all three ranges fetched once, no per-range loading state.

### Performance requirements
- No numeric SLA required (single authenticated dashboard read, small per-user row count). No load test in scope. One round-trip DB read per page load is the target shape (not three).

### Assumed Behaviors (behavioral-claim verification)

| Assumed behavior | Evidence | Confirmed |
|---|---|---|
| RLS already scopes `exam_results`/`exam_attempts` to `auth.uid()` on SELECT | `SOURCE/supabase/schema.sql:201-203` (`results_select_own`), `:160-162` (`attempts_select_own`) | Yes |
| `exams.subject` stores canonical English values matching the analytics union vocabulary | `SOURCE/lib/ugc/subjects.ts:8-19` (`SUBJECTS` canonical English), `:101-106` `normalizeSubject` maps intake to canonical; comment at `:4-6` states canonical kept English to match seed data | Yes (with nuance: canonical set is 10 subjects; analytics union is 7 → Geography/Informatics/Civic Education are legitimately excluded) |
| A submitted attempt (`status='submitted'`) has `submitted_at` set | `SOURCE/app/(layer2)/actions.ts:121-124` — `submitExam` sets `status:'submitted'` and `submitted_at` atomically in the same `.update({...}).eq('id', attemptId)` call | Yes (code-produced rows; legacy/out-of-band rows may still be null) |
| `exam_results.attempt_id` → `exam_attempts.id` and `exam_attempts.exam_id` → `exams.id` FKs exist (enable PostgREST embedding) | `SOURCE/supabase/schema.sql:119` (`attempt_id ... references exam_attempts`), `:102` (`exam_id ... references exams`) | Yes |
| `correct <= total` invariant holds on every `exam_results` row (so `wrong = total - correct >= 0`) | `SOURCE/lib/scoring/computeScore.ts:71-73` (`correct` counts a subset of `scored`; `total = scored.length`) | Yes |

### Reflection in design
- [x] Chart contract frozen → reducer emits `SubjectStats[]` with exactly `{ subject, correct, wrong, sessions }`; no chart file touched.
- [x] RLS scoping → query uses the cookie-bound `createClient()`; no explicit `user_id` filter needed (RLS enforces it), mirroring `getResult()` in `(layer2)/queries.ts`.
- [x] Non-union exclusion (decision #3) → reducer membership-tests against `SUBJECT_ORDER`.
- [x] Zero-attempt omission (decision #4) → reducer emits only subjects with ≥1 counted attempt, ordered by `SUBJECT_ORDER`.
- [x] Empty state (decision #5) → handled in `AnalyticsDashboard`, not in chart components.
- [x] Fetch-once strategy (decision #6) → single query, TS buckets into three ranges.
- [x] TS-side aggregation (decision #7) → no view/RPC/migration.
- No agreement is left unreflected.

## Applicable Standards

| Standard | Type | Reflection |
|---|---|---|
| Server reads live in a `queries.ts` module with `import "server-only"`, use `createClient` from `@/lib/supabase/server`, called from Server Components, results passed as props | explicit (observed and consistent across `(layer2)/queries.ts`) | `(layer3)/queries.ts` follows this exactly |
| snake_case DB columns mapped to camelCase/domain shapes at the read boundary | explicit (`(layer2)/queries.ts:12-47` mappers) | reducer input `AttemptRow` uses camelCase `submittedAt`; query normalizes the embedded rows |
| Pure domain logic isolated from I/O in its own `lib/` module with a co-located `__tests__` unit test (`computeScore`) | explicit (`lib/scoring/computeScore.ts` + `lib/scoring/__tests__/computeScore.test.ts`) | reducer placed in `lib/analytics/` with `lib/analytics/__tests__/` |
| RLS-first data access — no explicit user filter in query, RLS injects `auth.uid()` | explicit (`(layer2)/queries.ts:241-258` `getResult` relies on RLS, no `user_id` predicate) | analytics query adds no `user_id` predicate |
| `data as unknown as Row[]` cast at the supabase-js boundary for untyped selects | implicit (repeated in `(layer2)/queries.ts`) | query casts the embedded-select result the same way — **confirmed: adopt existing `(layer2)/queries.ts` convention** |
| Vietnamese code comments, English identifiers | implicit (repo-wide) | new files follow the same convention |

Implicit standards flagged above are adopted for consistency with surrounding code; confirm before implementation if a different convention is preferred.

## Quality Assurance Mechanisms

No codebase-analysis `qualityAssurance` input was provided; the list below is from scanning `SOURCE/package.json` scripts and `SOURCE/vitest.config.ts`.

| Mechanism | Command / config | Covers this change? | Status |
|---|---|---|---|
| TypeScript type check | `npx tsc --noEmit` | Yes — new module signatures, prop type, embedded-select row typing | adopted |
| ESLint | `npm run lint` (`eslint`) | Yes — new files | adopted |
| Vitest unit runner | `npm run test` (`vitest run`); include glob `lib/**/*.test.{ts,tsx}`, `components/**/*.test.{ts,tsx}` | Yes — pure reducer test at `lib/analytics/__tests__/…` matches the glob | adopted |
| AI-key bundle guard | `node scripts/check-ai-key-bundle.mjs` | No — unrelated to analytics read path | noted (not relevant to this change area) |

**Domain constraint (decisive):** the Vitest `include` glob does **not** cover `app/**`. A test placed under `app/(layer3)/**` would silently never run. This is the primary reason the pure reducer lives in `lib/analytics/` rather than beside `queries.ts`.

## Existing Codebase Analysis

### Implementation Path Mapping

| Path | Status | Role |
|---|---|---|
| `SOURCE/lib/fake-data/analytics.ts` | existing (edit) | Owns `Subject`, `TimeRange`, `SubjectStats`, `SUBJECT_ORDER`, `SUBJECT_COLORS`, `RANGE_LABELS`, `NEEDS_REVIEW_THRESHOLD`, `DEFAULT_RANGE`, `niceCeil`, `computeShares` (all kept) + `ANALYTICS_BY_RANGE`, `getSubjectStats` (removed) |
| `SOURCE/app/(layer3)/queries.ts` | **requires new creation** | server-only read: fetch submitted results, delegate to pure reducer |
| `SOURCE/lib/analytics/aggregateAttempts.ts` | **requires new creation** | pure reducer (no I/O) |
| `SOURCE/lib/analytics/__tests__/aggregateAttempts.test.ts` | **requires new creation** | pure unit test |
| `SOURCE/app/(layer3)/me/dashboard/page.tsx` | existing (edit) | server component; add query call + prop |
| `SOURCE/app/(layer3)/_components/AnalyticsDashboard.tsx` | existing (edit) | client container; accept prop, drop fake lookup, add empty-state branch |
| `SOURCE/app/(layer3)/_components/BarChartCard.tsx` | existing (untouched) | consumes `SubjectStats[]` + pure helpers/constants |
| `SOURCE/app/(layer3)/_components/DonutChartCard.tsx` | existing (untouched) | consumes `SubjectStats[]` + `SUBJECT_COLORS`/`computeShares` |

### Existing Interface Investigation (module being changed)

`SOURCE/lib/fake-data/analytics.ts` public surface — kept vs removed:

- Kept (imported by chart files and the new reducer): `Subject`, `TimeRange`, `SubjectStats`, `SUBJECT_ORDER`, `SUBJECT_COLORS`, `RANGE_LABELS`, `NEEDS_REVIEW_THRESHOLD`, `DEFAULT_RANGE`, `niceCeil(rawMax)`, `computeShares(stats)`.
- Removed (only fake): `getSubjectStats(range: TimeRange): SubjectStats[]`, `const ANALYTICS_BY_RANGE`.

Call sites of the removed symbols (Grep `fake-data/analytics`):
- `AnalyticsDashboard.tsx:17` imports `getSubjectStats` → **rewired** to use the `dataByRange` prop.
- `BarChartCard.tsx:15`, `DonutChartCard.tsx:16` import only kept symbols → **untouched**.
- `me/dashboard/page.tsx` references the module only in a comment (line 3), no actual import today → will **add** an import of `getAnalyticsByRange` from `(layer3)/queries.ts` (not from fake-data).

> Fact correction to the brief: the fake-data module is imported by **3** files today (`AnalyticsDashboard`, `BarChartCard`, `DonutChartCard`); `page.tsx` only mentions it in a comment. This does not change any decision — the chart files remain the only importers that must stay untouched.

### Similar Functionality Search and Decision (Pattern 5 prevention)

- Searched for existing per-user aggregation reads: none exist for analytics. `getResult()` in `(layer2)/queries.ts` reads a single attempt's stored result; it does not aggregate across attempts.
- Searched for an existing pure "reduce rows to stats" domain function: `computeScore` (`lib/scoring/computeScore.ts`) is the precedent — pure, no I/O, co-located test. **Decision:** follow that pattern (new pure module + co-located test); do not extend `computeScore` (different responsibility: it scores one attempt, we aggregate many).
- Searched for subject canonicalization: `lib/ugc/subjects.ts` owns intake canonicalization. **Decision:** do not re-canonicalize at read time — trust stored values and membership-test against `SUBJECT_ORDER` (the union is the read-side source of truth per confirmed decision #1).

### Dependency Existence Verification

| Dependency | Location | Result |
|---|---|---|
| `createClient` (server) | `SOURCE/lib/supabase/server.ts:12` | verified existing |
| `exam_results(correct, total, attempt_id, user_id)` | `schema.sql:117-127` | verified existing |
| `exam_attempts(id, exam_id, status, submitted_at)` | `schema.sql:99-106` | verified existing |
| `exams(id, subject)` | `schema.sql:70-82` | verified existing |
| FK `exam_results.attempt_id → exam_attempts.id` | `schema.sql:119` | verified existing (enables embedding) |
| FK `exam_attempts.exam_id → exams.id` | `schema.sql:102` | verified existing (enables nested embedding) |
| RLS `results_select_own`, `attempts_select_own` | `schema.sql:201-203`, `160-162` | verified existing |
| Types/constants (`SubjectStats`, `SUBJECT_ORDER`, `TimeRange`, `Subject`) | `lib/fake-data/analytics.ts:6-57` | verified existing |
| `getAnalyticsByRange`, `aggregateAttemptsByRange` | — | requires new creation |

### Code Inspection Evidence

| File / function | Relevance |
|---|---|
| `SOURCE/app/(layer2)/queries.ts` (`getResult`, `listExams`, mappers) | pattern reference: server-only read + RLS + snake→camel mapping |
| `SOURCE/lib/scoring/computeScore.ts` | pattern reference: pure domain reduce with co-located test |
| `SOURCE/lib/scoring/__tests__/computeScore.test.ts` | pattern reference: vitest structure, literal expected values |
| `SOURCE/lib/fake-data/analytics.ts` | integration point: types kept, fake source removed; `computeShares` sessions=0 guard at `:106` |
| `SOURCE/app/(layer3)/_components/AnalyticsDashboard.tsx` | integration point: state owner being rewired |
| `SOURCE/app/(layer3)/_components/BarChartCard.tsx` / `DonutChartCard.tsx` | contract reference: exact `SubjectStats[]` consumption, must stay untouched |
| `SOURCE/lib/ugc/subjects.ts` | evidence for subject vocabulary (canonical English) |
| `SOURCE/lib/supabase/server.ts` | dependency: cookie-bound RLS client |
| `SOURCE/vitest.config.ts` | decisive constraint: include glob excludes `app/**` |

## Fact Disposition Table

Derived from the brief's verified codebase facts (`code:` prefixed fact ids). No formal Codebase Analysis JSON was supplied; these bind the brief's asserted facts to a disposition.

| Fact ID | Focus Area | Disposition | Rationale | Evidence |
|---|---|---|---|---|
| `code:fake-source-importers` | Who imports the fake module | transform | Fake symbols removed; chart files keep importing kept symbols from the same path; `AnalyticsDashboard` switches to the prop. New outcome: only `getSubjectStats`/`ANALYTICS_BY_RANGE` disappear. | Grep `fake-data/analytics`: `AnalyticsDashboard.tsx:17`, `BarChartCard.tsx:15`, `DonutChartCard.tsx:16` |
| `code:server-read-pattern` | Established server-read pattern | preserve | `(layer3)/queries.ts` copies the `server-only` + `createClient` + props pattern verbatim. | `SOURCE/app/(layer2)/queries.ts:4-6`, `:241-258` |
| `code:schema-join-path` | `exam_results → exam_attempts → exams.subject` | preserve | Join path and filter columns used exactly as described. | `schema.sql:99-127`, `:70-82` |
| `code:rls-scoping` | RLS scopes results/attempts to `auth.uid()` | preserve | Query relies on RLS; no explicit user predicate added. | `schema.sql:160-162`, `:201-203` |
| `code:kept-types` | Types/constants/helpers location | preserve | All kept at `lib/fake-data/analytics.ts`; charts untouched. | `lib/fake-data/analytics.ts:6-122` |
| `code:dashboard-state-owner` | `AnalyticsDashboard` owns tab+range, calls `getSubjectStats(range)` | transform | Keeps tab/range/filterTouched state; swaps sync fake lookup for `dataByRange[range]`; adds empty-state branch. | `AnalyticsDashboard.tsx:28-33`, `:85-91` |
| `code:page-auth-guard` | `page.tsx` server auth guard renders dashboard | transform | Guard preserved; adds `getAnalyticsByRange()` call and `dataByRange` prop. | `me/dashboard/page.tsx:9-33` |
| `code:subject-vocabulary` | Stored subject vocabulary | preserve | Canonical English at intake → read-side membership test against the union is valid; non-union canonical subjects (Geography/Informatics/Civic Education) intentionally excluded. | `lib/ugc/subjects.ts:8-19`, `:101-106` |
| `code:vitest-include-glob` | Test discovery scope | preserve (constrains design) | `app/**` not scanned → pure reducer placed under `lib/**`. | `vitest.config.ts:15` |

## Data Representation Decision

New/modified data structures introduced: `AttemptRow` (reducer input) and the reducer output type (reuses existing `SubjectStats`).

| Structure | Reuse-vs-New | Decision | Rationale |
|---|---|---|---|
| Reducer output | existing `SubjectStats` | **Reuse** | Semantic/responsibility/lifecycle/boundary fit all pass — it is the exact chart contract; inventing a new type would force a mapping layer before the charts. |
| `AttemptRow` (reducer input: `{ correct, total, submittedAt, subject }`) | new | **New (minimal)** | No existing type describes "a submitted result flattened with its attempt's `submitted_at` and its exam's `subject`". It is the narrowest projection of the join needed to aggregate. Semantic fit of any existing type (`ExamResult`, `ScoreResult`) fails (they carry per-question/topic payloads irrelevant here) → 3+ criteria fail → new structure justified. |
| `dataByRange` prop type | existing `Record<TimeRange, SubjectStats[]>` | **Reuse** | Same shape the fake `ANALYTICS_BY_RANGE` already had; charts already consume `SubjectStats[]`. |

## Minimal Surface Alternatives

In-scope elements introduced: (A) fetch/return shape `Record<TimeRange, SubjectStats[]>` crossing server→client, (B) the `wrong` field, (C) the pure reducer abstraction. Each is evaluated against the current requirements only.

### Element A — the server→client analytics payload

1. **Fixed requirements:** AC-01..AC-06 (correct per-range aggregates), AC-07 (instant tab/filter toggle with no per-range loading state — confirmed decision #6), constraint "one DB round-trip per load".

2. **Alternatives:**
   - **A1 (selected):** one query fetches all submitted rows; TS buckets into all three ranges; return `Record<TimeRange, SubjectStats[]>` as a single prop.
   - **A2 (subtractive on payload, additive on fetches):** fetch/aggregate one range at a time on demand (client re-request on filter change) — smaller payload but adds per-range loading state and network round-trips.
   - **A3 (subtractive on shape):** return the flat `AttemptRow[]` to the client and bucket in the browser — moves reduce to the client, re-runs on every render.

3. **Compare:**

   | Alternative | Reqs covered | New persistent state | New concept/mode/flag | Crosses boundary | Breaking change/migration | Subjective cost notes |
   |---|---|---|---|---|---|---|
   | A1 | AC-01..07 + round-trip | 0 | 0 (shape already existed as fake) | yes (1 prop) | no | server does the reduce once; matches decision #6 |
   | A2 | AC-01..06; **fails AC-07** | 0 | 1 (per-range loading state) | yes | no | adds loading UI + N round-trips |
   | A3 | AC-01..07 | 0 | 0 | yes (1 prop) | no | ships raw rows to client, re-reduces per render, leaks row-level data to the client bundle |

4. **Converge:** A1. A2 fails the fixed AC-07 (instant toggle, no loading state). A3 covers the ACs but pushes aggregation and raw per-attempt rows to the client (larger data surface crossing the boundary, re-computation per render); A1 keeps the reduce server-side and ships only the already-required chart shape. A1 is also the confirmed decision #6.

5. **Rejected:** A2 — per-range fetch, rejected: reintroduces loading states decision #6 forbids. A3 — ship raw rows, rejected: crosses the boundary with more data than the chart needs and moves reduce to the client.

### Element B — the `wrong` field on `SubjectStats`

1. **Fixed requirements:** bar chart needs `wrong` per subject (AC-02); `SubjectStats` contract already includes `wrong` (frozen contract).
2. **Alternatives:** **B1 (selected):** compute `wrong = total - correct` in the reducer, store in the emitted `SubjectStats`. **B2 (subtractive):** omit `wrong`, have the chart derive it — rejected because the chart contract is frozen (`SubjectStats.wrong` exists and `BarChartCard` reads `stat.wrong`).
3-5. `wrong` is not persistent state (computed on demand, no DB column — satisfies decision #7). B1 selected; B2 would require editing the frozen chart contract. No new persistent surface introduced.

### Element C — the pure reducer as a reusable abstraction

1. **Fixed requirements:** testability (a pure unit test is warranted for exclusion/omission/ordering) + separation from I/O so vitest can import it.
2. **Alternatives:** **C1 (selected):** extract the reduce into `lib/analytics/aggregateAttempts.ts` (pure). **C2 (subtractive):** inline the reduce inside `queries.ts` — rejected: `queries.ts` carries `import "server-only"`, and vitest does not scan `app/**`, so the logic would be untestable without adding server-only stubbing and a new include glob.
3-5. C1 selected; the abstraction is justified by the current testability requirement + the vitest include-glob constraint, not by speculative reuse.

## Implementation Approach Decision

**Selected strategy: Vertical Slice (single feature unit).** The change is one thin vertical: DB read → pure reduce → prop → existing charts. There is no shared foundation to build first and no second consumer; a horizontal (layer-by-layer) split would add coordination cost with no benefit.

- **Alternatives considered:** Horizontal slice (build a generic analytics data layer first) — rejected: only one consumer, no reuse requirement, violates YAGNI/minimal-surface. Hybrid — rejected: requirements are fully known and fixed.
- **Risk mitigation (Phase 3):** subject-vocabulary drift → membership-test guard + explicit exclusion semantics; `submitted_at` null anomaly → reducer defensive rule (see R-1); test blast radius → pure module under `lib/**`.
- **Constraint compliance (Phase 4):** no new dependency (supabase-js already present); no schema/migration; RLS-only access; chart contract frozen.

### Integration Point Definition
The whole feature becomes operational the moment `page.tsx` passes real `dataByRange` and `AnalyticsDashboard` reads the prop — a single integration point. Verification level: **L1 (functional)** — the page renders real per-user charts — backed by **L2** (pure reducer unit test).

### Verification Strategy

- **Correctness definition:** for a fixed set of `AttemptRow` inputs and a fixed `now`, the reducer produces the exact `Record<TimeRange, SubjectStats[]>` with correct sums, correct non-union exclusion, correct zero-attempt omission, and `SUBJECT_ORDER` ordering.
- **Method (extension design_type — regression + new behavior):**
  - *Regression (existing behavior preserved):* the chart components render unchanged. Prove by diffing the props they receive — both before (fake) and after (real) the input is `SubjectStats[]` with identical field names; no chart file changes (git diff of `BarChartCard.tsx`/`DonutChartCard.tsx` must be empty).
  - *New behavior (real aggregation):* pure unit test (`aggregateAttempts.test.ts`) with literal expected values, independent of the implementation.
- **Output comparison (replaces fake source):** identical-input comparison at the `SubjectStats[]` level. Feed a crafted row set and assert the emitted array equals a hand-computed literal (subjects, `correct`, `wrong`, `sessions`, order). This is the concrete diff method: same input shape (`SubjectStats[]`) the charts consumed from the fake source, now produced by the reducer.
- **Early verification point:** the first thing to prove is one representative case of the reducer — a multi-subject, multi-range row set including one non-union subject and one subject with attempts only outside the week window — asserting the three range arrays match hand-computed literals. This proves the exclusion + range-bucketing + ordering approach before wiring the query.

## Prerequisite ADRs

- Searched `docs/adr/` for `ADR-COMMON-*` covering server reads / error handling / RLS access. None found governing this area. No common technical decision is introduced here (no new logging/error-handling/contract convention) — the change follows the established `(layer2)/queries.ts` read pattern. **No new ADR required** (no architecture/data-flow/contract-system change per documentation-criteria; the SubjectStats contract is unchanged, storage location unchanged, data-passing method unchanged).

## Data Contracts

### `aggregateAttemptsByRange` (pure)

```
aggregateAttemptsByRange(rows: AttemptRow[], now: Date): Record<TimeRange, SubjectStats[]>
```

- **Input `AttemptRow`:** `{ correct: number; total: number; submittedAt: string | null; subject: string }` — one flattened submitted result. `correct`/`total` from `exam_results`; `submittedAt` from `exam_attempts.submitted_at` (ISO string); `subject` raw from `exams.subject` (may be non-union).
- **Input `now`:** the reference instant for range boundaries (injected for determinism/testability, mirroring how `computeScore` avoids hidden inputs).
- **Preconditions:** none on ordering; `rows` may be empty; `subject` may be any string; `correct <= total` (DB invariant, not re-validated).
- **Guarantees / output:** for each `TimeRange`, a `SubjectStats[]` where:
  - only subjects in the union (`SUBJECT_ORDER`) appear (non-union rows dropped — decision #3),
  - only subjects with ≥1 counted attempt in the range appear (zero-attempt omission — decision #4),
  - ordering follows `SUBJECT_ORDER` among present subjects,
  - per subject: `correct = Σ row.correct`, `wrong = Σ (row.total - row.correct)`, `sessions = count of counted rows`.
- **Range boundaries (from `now`):** `week` = `submittedAt >= now - 7d`; `month` = `submittedAt >= now - 30d`; `all` = no lower bound.
- **Error behavior:** pure, throws nothing; invalid/missing `submittedAt` handled by the defensive rule below (never throws).

**Defensive rule for `submittedAt`:** `all` counts every submitted row (no date needed). `week`/`month` require a parseable `submittedAt >= boundary`; a row with `null`/unparseable `submittedAt` is skipped for `week`/`month` but still counted in `all`. (Covers R-1 without failing the read.)

### `getAnalyticsByRange` (server-only)

```
getAnalyticsByRange(): Promise<Record<TimeRange, SubjectStats[]>>
```

- **Input:** none (identity from the RLS-bound cookie session).
- **Supabase query shape (single read):**
  - `from("exam_results").select("correct, total, exam_attempts!inner(submitted_at, status, exams!inner(subject))").eq("exam_attempts.status", "submitted")`
  - `exam_results` is RLS-scoped to `auth.uid()` (no explicit `user_id` predicate). `!inner` on `exam_attempts` and `exams` makes the embedded filters/joins row-filtering.
  - Columns read: `exam_results.correct`, `exam_results.total`, `exam_attempts.submitted_at`, `exam_attempts.status`, `exams.subject`. No answer/PII columns selected.
- **Normalization:** map each embedded row to `AttemptRow` (`submitted_at → submittedAt`, `exams.subject → subject`), cast via `data as unknown as Row[]` per the repo boundary convention.
- **Output:** `aggregateAttemptsByRange(rows, new Date())`.
- **On error:** `if (error) throw error` (fail-fast, matches `(layer2)/queries.ts`; no silent fallback per ai-development-guide). The Server Component boundary surfaces it.

### Reducer input row (PostgREST embedded shape)

```
type Row = {
  correct: number;
  total: number;
  exam_attempts: { submitted_at: string | null; status: string; exams: { subject: string } };
};
```

## State Transitions

Not applicable — no stateful component is introduced. `AnalyticsDashboard` retains its existing UI state (`tab`, `range`, `filterTouched`); this pass adds no new state machine. The only added branch is a pure render condition (`data.length === 0 → empty state`).

## Data Flow

```mermaid
flowchart TD
  A["/me/dashboard page.tsx (server)"] -->|auth guard: getCurrentUser| B{authed?}
  B -->|no| R["redirect /?auth=signin"]
  B -->|yes| C["getAnalyticsByRange() — (layer3)/queries.ts (server-only)"]
  C -->|createClient RLS| D[("Supabase: exam_results ⋈ exam_attempts ⋈ exams (status='submitted', auth.uid())")]
  D -->|rows| E["normalize → AttemptRow[]"]
  E --> F["aggregateAttemptsByRange(rows, now) — lib/analytics (pure)"]
  F -->|Record<TimeRange, SubjectStats[]>| G["<AnalyticsDashboard dataByRange={...} /> (client)"]
  G -->|data = dataByRange[range]| H{data.length === 0?}
  H -->|yes| I["Empty state panel (+ range filter)"]
  H -->|no, tab=bar| J["<BarChartCard data={data} /> (unchanged)"]
  H -->|no, tab=donut| K["<DonutChartCard data={data} /> (unchanged)"]
```

## Architecture Diagram

```mermaid
flowchart LR
  subgraph server["Server (RLS-scoped)"]
    Q["queries.ts\ngetAnalyticsByRange()"]
    SB["@/lib/supabase/server\ncreateClient()"]
  end
  subgraph pure["lib/analytics (pure, testable)"]
    AG["aggregateAttempts.ts\naggregateAttemptsByRange()"]
  end
  subgraph client["Client island"]
    AD["AnalyticsDashboard\n(tab/range/filterTouched + empty branch)"]
    BC["BarChartCard (unchanged)"]
    DC["DonutChartCard (unchanged)"]
  end
  subgraph types["lib/fake-data/analytics.ts\n(types/constants/helpers kept)"]
    T["SubjectStats, Subject, TimeRange,\nSUBJECT_ORDER, SUBJECT_COLORS,\nniceCeil, computeShares"]
  end
  Q --> SB
  Q --> AG
  AG -.imports types.-> T
  Q -->|Record<TimeRange, SubjectStats[]>| AD
  AD --> BC
  AD --> DC
  BC -.imports.-> T
  DC -.imports.-> T
```

## Aggregation Algorithm (reference)

Pseudocode for `aggregateAttemptsByRange` (the reduce is the load-bearing logic; expressed in prose + a minimal snippet since the exclusion/omission/ordering interplay is easy to get wrong):

```
UNION = SUBJECT_ORDER                       // the 7-subject English union
RANGE_DAYS = { week: 7, month: 30, all: null }

for range in ["week","month","all"]:
    lowerBound = RANGE_DAYS[range] == null ? null : now - days
    acc = Map<Subject, {correct,wrong,sessions}>
    for r in rows:
        if r.subject not in UNION: continue                 // decision #3 exclusion
        if lowerBound != null:
            if r.submittedAt is null: continue              // defensive (R-1); still counted in 'all'
            if parse(r.submittedAt) < lowerBound: continue  // range filter
        e = acc.get(r.subject) or {correct:0,wrong:0,sessions:0}
        e.correct  += r.correct
        e.wrong    += (r.total - r.correct)
        e.sessions += 1
        acc.set(r.subject, e)
    output[range] = UNION.filter(s => acc.has(s))            // decision #4 omission + ordering
                         .map(s => ({subject:s, ...acc.get(s)}))
```

Ordering is guaranteed by iterating `SUBJECT_ORDER` at emit time (not by insertion order), so the bar chart's fixed x-axis order holds regardless of row arrival order. The donut re-sorts by share internally (`DonutChartCard` line 41), unaffected.

## Cleanup of `lib/fake-data/analytics.ts`

- Remove `const ANALYTICS_BY_RANGE` (lines 59-89) and `export function getSubjectStats` (lines 91-93).
- Update the module's top comment: it currently says data is fake and "GĐ sau thay bằng aggregate thật" — reword to note that aggregation now lives in `(layer3)/queries.ts` + `lib/analytics/aggregateAttempts.ts` and that this file now holds only shared types/constants/helpers.
- Keep everything else at the same path so the three chart imports resolve unchanged.

### Naming-smell follow-up (documented, NOT done in this pass)

The kept symbols are domain types/helpers, but they live under `lib/fake-data/` — misleading now that no fake data remains. **Do not rename in this pass**: the path is imported by the two frozen chart files (and the reducer), so a rename ripples into files this pass must not touch and expands the diff/review surface for no current requirement.

**Re-export shim tradeoff (considered, rejected):** one could create `lib/analytics/types.ts` as the "real" home and re-export from `lib/fake-data/analytics.ts` for back-compat. Rejected — it adds an indirection layer and a second path for the same symbols (larger surface, split source of truth) to solve a naming aesthetic, with no current requirement served (minimal-surface principle). Cleaner is a single future rename-and-update-imports commit when a maintainer chooses to touch all importers together. Logged as a follow-up, not a blocker.

## Client Rewire Detail

### `page.tsx` (server)
- Keep the auth guard (`getCurrentUser` → redirect). After the guard, `const dataByRange = await getAnalyticsByRange();`.
- Render `<AnalyticsDashboard dataByRange={dataByRange} />`. All page chrome (`preload-fade`, title, divider) unchanged.

### `AnalyticsDashboard.tsx` (client)
- New signature: `AnalyticsDashboard({ dataByRange }: { dataByRange: Record<TimeRange, SubjectStats[]> })`.
- Drop the `getSubjectStats` import; import `SubjectStats` type from `@/lib/fake-data/analytics` (kept path). Keep `DEFAULT_RANGE`, `RANGE_LABELS`, `TimeRange`.
- Replace `const data = getSubjectStats(range)` with `const data = dataByRange[range]`.
- Keep `tab`, `range`, `filterTouched` state and the `filterSlot` exactly as-is (including hidden-feature #1 "Filter" placeholder behavior).
- **Empty-state branch (decision #5):** when `data.length === 0`, render an empty-state panel *in place of the chart card*, but still render the tab nav and the range `filterSlot` so the user can switch to a populated range. Suggested copy: heading "No data yet" + line "Complete a submitted attempt in this range to see analytics." Styling reuses the existing `rounded-md border border-border bg-card p-5` card recipe (no new tokens). Chart components are never called with an empty array — this guards `computeShares` (sessions total 0 → degenerate donut) before it can render.

## Integration Point Map

| # | Existing component / method | Integration method | Impact level | Contract (In / Out / On Error) | Required test coverage |
|---|---|---|---|---|---|
| 1 | `me/dashboard/page.tsx` (server) → new `getAnalyticsByRange()` | call | High (adds a DB read to page load) | In: none (RLS session). Out: `Record<TimeRange, SubjectStats[]>` (async/await). On Error: query error thrown, surfaces at the Server Component (no fallback). | manual L1 render; error path is fail-fast (no test asset) |
| 2 | `page.tsx` → `AnalyticsDashboard` | prop (`dataByRange`) | High (data source swap) | In: `Record<TimeRange, SubjectStats[]>`. Out: rendered charts/empty state (sync). On Error: n/a (pure render). | manual L1 render + empty-state visual check |
| 3 | `AnalyticsDashboard` → `BarChartCard`/`DonutChartCard` | prop (`data: SubjectStats[]`) | Low (contract unchanged; read-only) | In: `SubjectStats[]` (never empty). Out: SVG. On Error: n/a. | git-diff of chart files must be empty (regression) |
| 4 | `queries.ts` → Supabase (`exam_results ⋈ exam_attempts ⋈ exams`) | data reference (read) | Medium (new read; RLS-scoped) | In: cookie session. Out: embedded rows. On Error: throw. | data-layer correctness verified by review against schema (mock cannot verify joins); reducer covered by unit test |
| 5 | `queries.ts` → `aggregateAttemptsByRange` | call | Medium | In: `AttemptRow[]`, `now`. Out: `Record<TimeRange, SubjectStats[]>`. On Error: none (pure). | pure unit test (primary) |

**Conflict check:** no naming/priority conflict — `getAnalyticsByRange` is a new symbol; the query adds no `status`/`subject` semantics beyond those the schema already defines; RLS priority is unchanged (read follows existing `results_select_own`).

## Change Impact Map

```yaml
Change Target: "Analytics Layer 3 data source (getSubjectStats fake → getAnalyticsByRange real)"
Direct Impact:
  - SOURCE/app/(layer3)/queries.ts (new file — server-only read)
  - SOURCE/lib/analytics/aggregateAttempts.ts (new file — pure reducer)
  - SOURCE/lib/analytics/__tests__/aggregateAttempts.test.ts (new file — unit test)
  - SOURCE/app/(layer3)/me/dashboard/page.tsx (call query, pass prop)
  - SOURCE/app/(layer3)/_components/AnalyticsDashboard.tsx (accept prop, drop fake lookup, empty-state branch)
  - SOURCE/lib/fake-data/analytics.ts (remove ANALYTICS_BY_RANGE + getSubjectStats; keep rest)
Indirect Impact:
  - Page load now performs one authenticated Supabase read (previously zero) — added latency, no new loading UI (fetched server-side before render)
No Ripple Effect:
  - SOURCE/app/(layer3)/_components/BarChartCard.tsx (imports only kept symbols — untouched)
  - SOURCE/app/(layer3)/_components/DonutChartCard.tsx (imports only kept symbols — untouched)
  - SOURCE/app/(layer3)/layout.tsx (session/header shell — unrelated)
  - SUBJECT_COLORS, Subject union, SUBJECT_ORDER, niceCeil, computeShares, RANGE_LABELS, DEFAULT_RANGE (unchanged)
  - schema.sql / RLS / migrations (no change)
```

## Field Propagation Map

Fields crossing component boundaries. Server→client is an in-memory RSC prop (not serialized across a text medium in the query-string sense, but React serializes props for the client island — values are plain JSON-safe numbers/strings, so no custom format needed).

| Field | Origin | At `queries.ts` (normalize) | At server→client prop boundary | At chart consumption | Status | Serialized Format | Consumer Parse Rule |
|---|---|---|---|---|---|---|---|
| `correct` | `exam_results.correct` (int) | summed per subject into `SubjectStats.correct` | carried in `dataByRange` | `BarChartCard` bar height | transformed (row → per-subject sum) | JSON number | React prop deserialize (number) |
| `total` | `exam_results.total` (int) | consumed to derive `wrong = total - correct` | not carried as `total`; only `wrong` | `BarChartCard` bar height | transformed then dropped (only `wrong` survives) | — | — |
| `wrong` | derived (`total - correct`) | summed per subject | carried in `dataByRange` | `BarChartCard` | transformed (derived) | JSON number | number |
| `submitted_at` | `exam_attempts.submitted_at` | used for range bucketing only | not carried | — | dropped (used server-side, not shipped) | — | — |
| `status` | `exam_attempts.status` | filter predicate only | not carried | — | dropped | — | — |
| `subject` | `exams.subject` (text) | membership-tested vs union; becomes `SubjectStats.subject` | carried | `BarChartCard` label / `DonutChartCard` color key | preserved (union members) / dropped (non-union) | JSON string | number/string prop; used as `SUBJECT_COLORS[subject]` key |
| `sessions` | count (derived) | per-subject count | carried | `computeShares` share denominator | transformed (derived) | JSON number | number |

## Interface Change Impact Analysis

| Existing Operation | New Operation | Conversion Required | Adapter Required | Compatibility Method |
|---|---|---|---|---|
| `getSubjectStats(range): SubjectStats[]` (sync, fake) | `getAnalyticsByRange(): Promise<Record<TimeRange, SubjectStats[]>>` (async, real) | Yes (sync per-range lookup → async all-ranges fetch) | No | Call moves from client to server (`page.tsx`); client reads `dataByRange[range]` — same `SubjectStats[]` element type, so charts need no adapter |
| `AnalyticsDashboard()` (no props) | `AnalyticsDashboard({ dataByRange })` | Yes (new required prop) | No | `page.tsx` supplies the prop; internal state/API otherwise identical |
| `BarChartCard({ data, filterSlot, highlightWeakest? })` | unchanged | No | Not required | — |
| `DonutChartCard({ data, rangeLabel, filterSlot, donutHighlightCount? })` | unchanged | No | Not required | — |

## Acceptance Criteria

Highest priority first. Each is verifiable against the pure reducer (unit) unless marked (render).

- **AC-01 (exam-level correct/wrong sum):** Given two submitted attempts for the same union subject in-range with `(correct,total)=(8,10)` and `(5,10)`, that subject's stats are `correct=13`, `wrong=(2+5)=7`, `sessions=2`.
- **AC-02 (wrong = total − correct):** Given `(correct,total)=(3,10)`, the emitted `wrong` is `7` (not read from any stored `wrong`).
- **AC-03 (sessions = submitted attempt count):** N submitted attempts for a subject in-range ⇒ `sessions=N`, regardless of `correct`/`total`.
- **AC-04 (non-union exclusion — decision #3):** A submitted attempt whose `exams.subject` is `"Geography"` (canonical but outside the union) contributes to **no** range's output; no `"Other"` bucket appears.
- **AC-05 (zero-attempt omission + ordering — decision #4):** Only subjects with ≥1 in-range attempt appear; among those, order follows `SUBJECT_ORDER` (e.g. rows for English then Math emit `[Math, English]`).
- **AC-06 (range boundaries):** With `now` fixed, an attempt submitted 3 days ago appears in `week`, `month`, `all`; one submitted 20 days ago appears in `month` and `all` but not `week`; one submitted 200 days ago appears only in `all`.
- **AC-07 (instant toggle, render):** Switching tab or range never triggers a network request or loading state — all three ranges are already in `dataByRange` (single server fetch). (render)
- **AC-08 (empty state — user with zero attempts, render):** A user with no submitted attempts sees the empty-state panel (not charts) for every range; the range filter and tabs remain interactive.
- **AC-09 (empty state per-range, render):** When `week` has zero in-range attempts but `month` has data, the `week` view shows the empty state and switching to `month` shows charts — without reload.
- **AC-10 (degenerate-donut guard, render):** `DonutChartCard` is never rendered with an empty `data` array; the empty-state branch intercepts before `computeShares` runs on a zero-session set.
- **AC-11 (RLS scoping):** The query returns only the calling user's data (no `user_id` predicate; RLS enforces). Verified by review against `results_select_own`/`attempts_select_own`; not by a cross-user integration test in CI.
- **AC-12 (chart contract untouched — regression):** `git diff` of `BarChartCard.tsx` and `DonutChartCard.tsx` is empty after the change.
- **AC-13 (submitted-only):** In-progress attempts (`status='in_progress'`, no `exam_results` row and/or `status != 'submitted'`) never contribute to any range.

### Non-functional Requirements
- One authenticated Supabase read per page load (not three). No numeric latency SLA; server-side fetch means no client loading state. Type-check, lint, and unit tests pass (Quality Assurance Mechanisms table).

## Edge Cases

| Edge case | Handling |
|---|---|
| User with zero submitted attempts | Query returns `[]` → reducer returns `{week:[],month:[],all:[]}` → empty state for all ranges (AC-08). |
| Range with zero attempts, others populated | Per-range reduce is independent → that range's array is `[]`, others populated (AC-09). |
| Non-union subjects mixed in (`Geography`/`Informatics`/`Civic Education`, or any non-canonical string) | Membership test drops them before accumulation (AC-04). |
| `sessions=0` degenerate donut | Impossible to reach a chart: empty-state branch triggers when `data.length===0`; any present subject has `sessions>=1`, so `computeShares` total is ≥1 (AC-10). |
| Submitted attempt with `null` submitted_at (data anomaly, R-1) | Counted in `all`; skipped for `week`/`month` (defensive rule) — never throws. |
| Attempt without an `exam_results` row | Naturally excluded — the query starts from `exam_results`; an attempt with no result contributes nothing. |
| `wrong` would be negative | Cannot occur: `correct <= total` invariant (computeScore). Reducer does not clamp; documented as relying on the invariant. |

## Risks and Mitigation

| ID | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R-1 | A `status='submitted'` attempt has `null` `submitted_at`, so it is mis-bucketed | Very low | Resolved: `submitExam` sets `status:'submitted'` and `submitted_at` atomically (`SOURCE/app/(layer2)/actions.ts:121-124`), so code-produced rows always have `submitted_at`. The reducer's rule (count a `null`-`submitted_at` submitted row only in `all`, never throw) is retained as harmless-conservative handling for any legacy/out-of-band row, not as a load-bearing mitigation. |
| R-2 | An exam stored a non-canonical / legacy subject string (pre-`normalizeSubject`) and is silently excluded | Low | Intake canonicalization enforces English union (`subjects.ts`); exclusion is the intended, documented behavior (AC-04). If unexpected data loss is observed, surface via a follow-up data audit — not a silent fallback. |
| R-3 | PostgREST embedded-select shape differs from assumed (`exam_attempts` returned as array vs object) | Low | Normalize step handles the to-one embed; if runtime shape differs, the `data as unknown as Row[]` cast + normalize is the single adjustment point; verified at first L1 render. |
| R-4 | Vitest silently not running the new test (wrong path) | Low | Test placed under `lib/analytics/__tests__/` to match the `lib/**` include glob; confirm by seeing the test count increase in `npm run test`. |

## References

- Existing UI-only design: `docs/design/analytics-layer3-design.md`
- Server-read pattern: `SOURCE/app/(layer2)/queries.ts`
- Pure-domain-logic precedent: `SOURCE/lib/scoring/computeScore.ts` (+ its `__tests__`)
- Subject vocabulary: `SOURCE/lib/ugc/subjects.ts`
- Schema: `SOURCE/supabase/schema.sql` (tables at `:70-127`, RLS at `:160-203`)
- Supabase embedded/nested resource selects (supabase-js `.select()` FK embedding) — supabase-js v2 (`@supabase/supabase-js ^2.107.0`, per `SOURCE/package.json`).

## Verification of Mapped Rules

- Skills applied → concrete design rules:
  - `documentation-criteria` → single Design Doc (no ADR: no architecture/data-flow/contract change; SubjectStats contract unchanged, storage unchanged). 3-5 file scope → Design Doc required, matched.
  - `coding-principles` (Minimum Surface) → Minimal Surface Alternatives section; `wrong` computed not stored; no re-export shim; pure reducer justified by current testability requirement.
  - `testing-principles` → pure reducer with literal-expected-value unit test; data-layer join correctness flagged as review-verified (mocks insufficient), reducer covered by real unit test.
  - `ai-development-guide` → fail-fast (`throw error`, no silent fallback); Pattern 5 similar-functionality search (computeScore reuse-vs-extend decision documented).
  - `implementation-approach` → Vertical Slice selected with alternatives + rationale.
  - `external-resource-context` → feature-tier "External Resources Used" filled; no new external resource.
  - `llm-friendly-context` → explicit paths, exact signatures, decision rules, no unresolved "TBD".
- Cross-checks passed: chart files in "No Ripple Effect"; every architectural claim about existing code cites file:line; the one factual discrepancy in the brief (importer count) is reported inline; the decisive vitest-glob constraint drives the module placement.
