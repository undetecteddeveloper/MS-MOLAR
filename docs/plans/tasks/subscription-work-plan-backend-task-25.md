# Task: Telemetry codes, the two-layer guard, and the OK-04 mapping

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.5**
Layer: **backend** (`SOURCE/lib/tutor/**`, the two refusal sites)

Metadata:
- Dependencies: backend-task-21 (`consumeQuota` three reasons), backend-task-23 and backend-task-24 (the two refusal sites the mapping lives at)
- Provides: the distinct refusal codes plan Task 5.7 asserts and plan Task 5.8 must have on both databases
- Size: Small (2–3 files)

`Change Category: boundary-change`

The code-side literal list must match the SQL-side CHECK written in plan Task 1.1. Sweep the adjacent cases sharing that boundary — `SOURCE/supabase/schema.sql` both `error_code in ( … )` occurrences, `telemetry.ts:37` (the derived type), `telemetry.ts:78` (the runtime filter), `telemetry.test.ts:49` and `telemetry.test.ts:261` — for the same class of defect: one list widened and another not.

## Implementation Content

- `SOURCE/lib/tutor/telemetry.ts:35` — `TELEMETRY_ERROR_CODES` gains `user_quota_exhausted` and `project_budget_exhausted`. **Nothing else in the file changes** (the type at `:37` and the runtime filter at `:78` still read the same constant).
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts:49` hand transcription updated to the same six; **`:261` equality assertion must pass unmodified**.
- Correct the two phantom `§19` comments at `telemetry.ts:33` and `:39` to cite the header text.

### OK-04 — write the mapping explicitly, do not rely on string identity

The backend DD claims the two new codes are "the same strings" `consumeQuota()` returns. **They are not**: `consumeQuota` returns `"user_quota" | "project_budget" | "unavailable"`, and AC-022 writes a mapping.

Implement it **at the refusal site** (in `tutorActions.ts` / `actions.ts`), **not** inside `consumeQuota()`, which is provider-agnostic and has no notion of a telemetry event type:
- `"user_quota"` → `user_quota_exhausted`
- `"project_budget"` → `project_budget_exhausted`
- `"unavailable"` → `server` (**deliberately no code of its own** — it *is* an infrastructure fault on our side, and adding a third literal would exceed R13 stated scope)

## Target Files
- [ ] `SOURCE/lib/tutor/telemetry.ts` (`:35` widened; `:33` and `:39` comments corrected)
- [ ] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49` transcription; **`:261` unmodified**)
- [ ] `SOURCE/app/(layer2)/tutorActions.ts` and `SOURCE/app/(layer4)/actions.ts` (the OK-04 mapping at each refusal site)

## Investigation Targets
- `SOURCE/lib/tutor/telemetry.ts` (`:33`, `:35`, `:37`, `:39`, `:78`)
- `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49` the hand transcription; `:261` the two-layer guard) — **adjacent cases for the boundary sweep**
- `SOURCE/supabase/schema.sql` (both `error_code in ( … )` occurrences written in plan Task 1.1) — **adjacent case for the boundary sweep**
- `SOURCE/lib/billing/quota.ts` (`consumeQuota` return union — the mapping source)
- `SOURCE/app/(layer2)/tutorActions.ts`, `SOURCE/app/(layer4)/actions.ts` (the refusal sites)
- `docs/design/subscription-backend-design.md` (§ Integration Point I11 (AC-046))
- `docs/design/subscription-backend-design.md` (§ Design — where the write happens / OK-04)
- `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, telemetry alter) | structure-order | `'gemini_unavailable', 'rate_limited', 'server', 'not_eligible', 'user_quota_exhausted', 'project_budget_exhausted'` | `TELEMETRY_ERROR_CODES` contains exactly these six literals and matches both SQL occurrences |
| `docs/ui-spec/subscription-ui-spec.md` (§ UI-D3 — This phase does NOT split the four tutor error codes) | state-lifecycle-negative | **"When the backend later introduces a distinct quota code, the split must preserve `not_eligible`, `server` and `gemini_unavailable` as one indistinguishable group"** … The client-visible union stays exactly `"not_eligible" \| "rate_limited" \| "gemini_unavailable" \| "server"` (`tutorActions.ts:51`) and all four keep rendering **one** message | The two new codes appear only in `telemetry_log.error_code`; the client-visible union is unchanged |

## Boundary Context (from the plan Connection Map)

**Boundary — Refusal branches → `telemetry_log`.**
- Owners: `SOURCE/app/(layer2)/tutorActions.ts`, `SOURCE/app/(layer4)/actions.ts` (via `SOURCE/lib/tutor/telemetry.ts`) ↔ `public.telemetry_log` under `telemetry_insert_own`.
- **Serialized Format**: `error_code` is one of the six CHECK literals; the runtime filter nulls unknown codes rather than throwing.
- **Consumer Parse Rule**: the widened CHECK must already exist on the target database, or the insert fails and the best-effort write is lost **silently**.
- **Expected Signal**: three causes ⇒ three distinct `error_code` values, and **all three inserts are accepted**.
- **Roundtrip check**: the literal the code emits is a literal the CHECK admits — asserted here against the code-side constant, and against a real database in plan Task 5.7.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record the six literals verbatim from the SQL side
- [ ] **Boundary sweep**: confirm both SQL occurrences and the code-side constant are compared by `:261` and by the plan Task 1.2 parse case
- [ ] Write the failing exhaustiveness test over `consumeQuota` three reasons ⇒ three telemetry codes
### 2. Green Phase
- [ ] Widen `:35`; update `:49`; correct the two `§19` comments; implement the mapping at both refusal sites
### 3. Refactor Phase
- [ ] Confirm `:261` passes **unmodified** and nothing else in `telemetry.ts` changed

## Quality Assurance Mechanisms
- `telemetry.test.ts:261` two-layer guard — Enforces: `TELEMETRY_ERROR_CODES` matches the CHECK constraint; **must pass unmodified** — Config: `SOURCE/lib/tutor/__tests__/telemetry.test.ts`
- `schemaFingerprint.test.ts` (text-side, with the plan Task 1.2 added parse case) — Enforces: both in-file literal lists agree with the constant
- `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests plus the two text-side guards; the real-database acceptance proof is plan Task 5.7.
- **Success criteria**: `telemetry.test.ts:261` passes **unmodified**; the added schema-parse case finds **both** in-file literal lists; the exhaustiveness test maps all three `consumeQuota` reasons.
- **Failure response**: if `:261` needs editing to pass, the constant and the CHECK disagree — **fix the disagreement, not the assertion**.
- **Verification level**: L2.

## Proof Obligations
- **Claim (AC-022 / OK-04)**: `consumeQuota` three reasons map to exactly three telemetry codes.
- **Primary failure mode**: relying on string identity — a future fourth reason silently writes `null` instead of failing.
- **Boundary to exercise**: the refusal sites mapping function (in-process unit).
- **State assertion**: each reason produces its mapped literal; a fabricated fourth reason is a **compile error**, not a silent `null`.
- **Mock boundary rationale**: none needed — the mapping is pure.
- **Residual**: harmless today while nothing renders a code; a real cross-layer defect the moment something does. Whether the database **accepts** the inserts is proven in plan Task 5.7.

## Completion Criteria
- [ ] All added tests pass; `telemetry.test.ts:261` passes **unmodified**
- [ ] `TELEMETRY_ERROR_CODES` is exactly the six literals; `:37` and `:78` unchanged
- [ ] The two phantom `§19` comments corrected to cite the header text
- [ ] The OK-04 mapping is implemented **at the refusal sites**, not inside `consumeQuota()`
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — a deploy that writes a new telemetry code before the CHECK reaches prod fails **silently**

## Notes
- Impact scope: `SOURCE/lib/tutor/telemetry.ts` and the two refusal sites; downstream, plan Tasks 5.7 and 5.8.
- Scope boundary: `consumeQuota()` gains no telemetry concern; the client-visible union stays at four literals.

## Investigation Notes
(Record the boundary sweep and each Compliance Check result here.)
