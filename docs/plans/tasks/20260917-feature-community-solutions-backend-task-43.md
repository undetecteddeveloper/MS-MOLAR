# Task 43: `queries.ts` — `getMyReputation()`

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P5-T4
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T4)
- **Dependencies**: task 41 (P5-T2)
- **Provides**: `getMyReputation()` → `{ totalScore, publishedCount, helpfulCount, pinnedCount }`, consumed by task 44
- **Size**: Small (1 plan file + 1 test file)

## Implementation Content

Thin wrapper: exactly one `.rpc("community_reputation_summary")` on the session client; map the snake_case row to `ReputationBlock`'s camelCase prop shape (`totalScore`, `publishedCount`, `helpfulCount`, `pinnedCount`). On RPC error, return a failure result that makes the caller render **no** reputation block (frontend DD: "Fetch failure → block does not render at all").

## Acceptance Criteria

From the plan (§ P5-T4): **AC-086**.

Carried hard constraints that apply to this task:
- Session client only; **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- No client-side recomputation of `total_score` — the value comes from the RPC.

## Target Files
- [x] `SOURCE/features/solutions/queries.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/reputationQuery.test.ts` (new)

## Investigation Targets
- `SOURCE/features/solutions/queries.ts`
- `SOURCE/supabase/schema.sql` (`community_reputation_summary` return columns, task 41)
- `docs/design/community-solutions-backend-design.md` (§ Main Components — `queries.ts`)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_reputation_summary()`)
- `docs/design/community-solutions-frontend-design.md` (§ Integration Point Map — `ProfileCard` reputation insertion: input shape and on-error behaviour)
- `docs/prd/community-solutions-prd.md` (AC-086)

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Acceptance Criteria (AC-086)) | derived-display | "compute a caller's own reputation on read as `10 × published_count + 2 × helpful_count_on_published + 20 × pinned_published_count`, with no stored total." | `getMyReputation` returns `totalScore` equal to the RPC's `total_score` unchanged, and the unit test's expected literal is computed independently from the formula (not copied from the mock) |

## Investigation Notes
(Append observations here before implementation begins. Record the Reference Contract Compliance Check result.)

- `SOURCE/features/solutions/queries.ts` (read in full): every existing read function follows the same thin-wrapper shape — `const supabase = await createClient(); const { data, error } = await supabase.rpc(name, args); if (error) throw error; const rows = (data ?? []) as RawXRow[]; ...map`. Two exceptions of note for this task: (1) every existing function **throws** on `error`, never returns a failure result — task 43 deliberately breaks this convention because the frontend DD's boundary contract requires a returned failure value, not a throw, for the RPC-error path (see below); (2) `RawXRow` interfaces + a `mapXRow` function are the established naming/structure pattern this task follows for `RawReputationRow`/`mapReputationRow`.
- `SOURCE/supabase/schema.sql:4206-4245` (`community_reputation_summary()`, task 41): no parameters (`auth.uid()` only); `returns table (total_score int, published_count int, helpful_count int, pinned_count int)`; body is a single `with mine as (...) select 10*n_published + 2*n_helpful + 20*n_pinned, n_published, n_helpful, n_pinned from mine` — an aggregate with no `group by`, so the query always yields **exactly one row** (never zero), including the "0 published solutions" case (all four columns are 0, per AC-090). No stored total anywhere; `total_score` is computed fresh in SQL every call.
- `docs/design/community-solutions-backend-design.md` § Main Components `queries.ts`: interface line explicitly lists `getMyReputation()` as one of the module's exports, confirming this task's function belongs alongside the existing five. § Data Contracts `community_reputation_summary()`: `Output.Type: { total_score int, published_count int, helpful_count int, pinned_count int }`; `Guarantees: total_score = 10*published_count + 2*helpful_count + 20*pinned_count, computed fresh on every call (AC-086) — no stored total anywhere`; `On Error: none — a writer with zero published solutions gets all-zero fields (AC-090)` (i.e. the RPC body itself never errors/returns zero rows by design; any `error` `getMyReputation()` sees is an infra-level failure, e.g. auth/session/network, not a domain "ineligible" case).
- `docs/design/community-solutions-frontend-design.md` § Integration Point Map, "`ProfileCard` reputation insertion" boundary contract: on success, `getMyReputation()`'s return value **is** the plain shape `{ totalScore: number; publishedCount: number; helpfulCount: number; pinnedCount: number }` (the page destructures these fields directly into `<ReputationBlock totalScore={…} .../>`); "On Error: when `getMyReputation()` returns its failure result, or throws ... the page passes no `reputationSlot`". § Data Flow line 1776: "Server-side, `ProfilePage` logs a thrown `getMyReputation()` with `console.error`" — only the **thrown** path is logged by the page; the **returned failure result** path is silent at the page level. This means `getMyReputation()` itself must distinguish "RPC returned an `error` object" (→ return a failure result, no throw, no log here) from any other unexpected exception (which is not this function's concern — it doesn't try/catch around `createClient()`/`.rpc()` beyond reading `error`).
- `docs/prd/community-solutions-prd.md` AC-086 (via backend DD's Traceability row and R18): "Điểm uy tín +10 / +2 / +20 ... chỉ tính bài đã đăng" — 10 điểm/bài đã đăng, 2 điểm/Hữu ích trên bài đã đăng, 20 điểm/bài đã đăng đang ghim; test fixture AC-086 splits two cases ("gỡ bài không ghim (10 Hữu ích) → 74" and "gỡ bài đang ghim (10 Hữu ích) → 54") which live in task 41's RPC-level tests, not this task's mapper test.
- Decision: return type is a discriminated union `ReputationResult = { ok: true; totalScore; publishedCount; helpfulCount; pinnedCount } | { ok: false }`, matching the repo's existing `{ ok: true; ... } | { ok: false; ... } ` result-union convention already used in `SOURCE/features/solutions/actions.ts` (`SaveSolutionResult`, `SetSolutionStatusResult`, etc.), adapted here with no `error` payload on the `ok: false` branch since neither the frontend DD's boundary contract nor Reference Contract #4 requires the caller to inspect an error code — the page's only decision is render-block-or-not.

### Reference Contract Compliance Check
| Source | Axis | Planned approach | Evaluation | Rationale |
|---|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` § Acceptance Criteria (AC-086) | derived-display | `getMyReputation()` maps `row.total_score` straight to `totalScore` with no arithmetic in `queries.ts`; the unit test's expected `totalScore` literal (`56`) is derived independently in a comment as `10×2 + 2×8 + 20×1`, not copied from the mock's `total_score` field, before being asserted equal to the mock's value | Y | The formula ownership stays entirely in the RPC (task 41, already landed); this task's wrapper performs zero recomputation — it only renames snake_case keys to camelCase — and the test proves the mock's `56` actually equals the formula's output rather than merely echoing it |

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write failing tests: mock row `{ total_score: 56, published_count: 2, helpful_count: 8, pinned_count: 1 }` → mapped object; expected `totalScore` asserted as the literal `56` with a comment deriving it (10×2 + 2×8 + 20×1); one `.rpc` call; RPC error → failure result
- [x] Run and confirm failure

### 2. Green Phase
- [x] Implement `getMyReputation`
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Export the mapped type for `ReputationBlock`
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`.
- **Success criteria**: all cases green.
- **Failure response**: if the RPC row shape differs from task 41's return columns, fix the mapping to the real columns — do not change the RPC in this task.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (same as task 41 — Reference Contract #4): reputation is `10×published + 2×helpful + 20×pinned`, with no stored total.
- **Primary failure mode**: the wrapper recomputes or transforms the total (drift from the DB formula), or the test's expected value is copied from the mock and proves nothing.
- **Boundary to exercise**: `getMyReputation` against a mocked session client.
- **State assertion**: N/A (read).
- **Mock boundary rationale**: session client mocked; the formula itself is proven on real DB in task 41.
- **Residual**: rendering in task 44.

## Completion Criteria
- [x] All added tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: task 44 only.
- Scope boundary: no schema change.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
