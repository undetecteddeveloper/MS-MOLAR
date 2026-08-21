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
- [x] `SOURCE/lib/tutor/telemetry.ts` (`:35` widened; `:33` and `:39` comments corrected)
- [x] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49` transcription; **`:261` unmodified**)
- [x] `SOURCE/app/(layer2)/tutorActions.ts` and `SOURCE/app/(layer4)/actions.ts` (the OK-04 mapping at each refusal site)

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
- [x] Read all Investigation Targets and record the six literals verbatim from the SQL side
- [x] **Boundary sweep**: confirm both SQL occurrences and the code-side constant are compared by `:261` and by the plan Task 1.2 parse case
- [x] Write the failing exhaustiveness test over `consumeQuota` three reasons ⇒ three telemetry codes
### 2. Green Phase
- [x] Widen `:35`; update `:49`; correct the two `§19` comments; implement the mapping at both refusal sites
### 3. Refactor Phase
- [x] Confirm `:261` passes **unmodified** and nothing else in `telemetry.ts` changed

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
- [x] All added tests pass; `telemetry.test.ts:261` passes **unmodified**
- [x] `TELEMETRY_ERROR_CODES` is exactly the six literals; `:37` and `:78` unchanged
- [x] The two phantom `§19` comments corrected to cite the header text
- [x] The OK-04 mapping is implemented **at the refusal sites**, not inside `consumeQuota()`
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — a deploy that writes a new telemetry code before the CHECK reaches prod fails **silently**

## Notes
- Impact scope: `SOURCE/lib/tutor/telemetry.ts` and the two refusal sites; downstream, plan Tasks 5.7 and 5.8.
- Scope boundary: `consumeQuota()` gains no telemetry concern; the client-visible union stays at four literals.

## Investigation Notes

### Boundary sweep (Change Category: boundary-change)

Both `schema.sql` `error_code in ( … )` occurrences carry the identical six literals in the
identical order — the inline CHECK inside `create table public.telemetry_log` (`:1382-1388`)
and the `drop constraint` / `add constraint telemetry_log_error_code_check` pair
(`:1813-1820`). `TELEMETRY_ERROR_CODES` (`telemetry.ts:35`) and the hand transcription
(`telemetry.test.ts:49`) carry the same six in the same order. Four lists, one order, no
widened-here-but-not-there residual. `schemaFingerprint.test.ts:138-139` plus its
`dropped = "'project_budget_exhausted'"` mutation case (`:224`) is the text-side guard that
finds *both* in-file lists.

### Compliance Check — Reference Contracts

| Row | Result | Rationale |
|---|---|---|
| structure-order (six literals, both SQL occurrences) | **Y** | Six literals present in schema order; `telemetry.test.ts:311` asserts elementwise against a hand transcription that deliberately does not import the constant. |
| state-lifecycle-negative (UI-D3, client union unchanged) | **Y** | `ExplainStepError` is still exactly the four client literals. A repo-wide scan for the two new literals finds them only in `quotaTelemetry.ts`, `telemetry.ts`, the schema-side guards and tests — never in a client-facing type or any component. |

### Compile-error property (OK-04), probed not assumed

A fourth `ConsumeResult` reason was injected at `quota.ts:127` (anchor verified to occur
exactly once by byte count) and `tsc --noEmit` produced exactly three errors, after which the
file was restored by byte copy and `cmp`-verified identical:

- `TS1360` at `quotaTelemetry.ts:34` — the `satisfies` (missing key).
- `TS7053` at `tutorActions.ts:222` and at `actions.ts:314` — both lookup sites.

So a future fourth reason is a compile error at three places, not a silent `null` in
`error_code`. The three reason-to-code pairs themselves are pinned at runtime by
`tutorActions.int.test.ts:623-695`, which seeds all three reasons and reads back hand-written
literals, plus an explicit `not.toBe` between the two policy refusals. Because both refusal
sites now index one shared declaration, the upload site's `project_budget` entry is pinned by
construction rather than by a second, drift-prone copy.

### Citation repair — the phantom `§19`

`schema.sql` has no `§19`; its numbered sections stop at `-- 17. Phiên bản schema`. The
telemetry block is an unnumbered named header, `TELEMETRY LOG (Engine 1 Adaptive AI, PRD
R4/AC-012/AC-013)` at `:1361`, with the table at `:1369`. Every `§19` in code pointed at a
section that does not exist.

Repaired with **non-rotting identifiers** rather than a new section number or a line number,
per backend DD v1.4's rule (cite the identifier plus a quoted phrase for artifacts under
concurrent revision): the constraint name `telemetry_log_error_code_check`, the table name
`public.telemetry_log`, the policy name `telemetry_insert_own`, and the quoted header text
`"TELEMETRY LOG"`. A section number would rot the moment sections are renumbered, and a line
number demonstrably rots — plan Task 1.1 shifted this very file by 227 lines and forced
backend DD v1.9 to repoint `:1597` to `:1824`. Identifiers move with the object they name and
stay greppable.

Sixteen occurrences repaired across four in-scope files; the edits are **comment-only**
(24 insertions / 24 deletions, every changed line a comment line, all four files identical in
line count before and after, so no code line moved). Comment *content* was preserved
throughout — only the pointer changed, including at `telemetry.ts:39` where the description of
the `event_type` CHECK is accurate and only its citation was wrong.

### Deliberately not changed (reported for the documentation-hygiene pass)

- `telemetry.test.ts:234` — `§19` sits inside an `it()` **title string**, a code line rather
  than a comment. Repairing it would forfeit the comment-only property that makes this diff
  auditable at a glance; it changes no assertion and is safe for the hygiene pass to take.
- `tutorActions.ts:52` — *"Hai tập trùng nhau hôm nay"* ("the two sets coincide today") became
  false when R13 widened the CHECK to six while the client union stayed at four. That is a
  **content** inaccuracy, not a citation one, so it fell outside this task's stated scope
  ("do not change any comment's meaning — only its citation").
- Out-of-scope files still carrying `§19`: `callTutor.ts:47,:87`; `callTutor.test.ts:60`
  (this one cites the *backend DD*'s §19, a different and possibly valid referent);
  `test-rls.ts:29,:133,:417,:1603,:1701`; `subscription.int.test.ts:884,:1271`;
  `recordSkillMastery.int.test.ts:44`; `tutorActions.int.test.ts:509`;
  `getSkillRecommendation.int.test.ts:114`.
- This task file's own Reference Contract cites `tutorActions.ts:51` for `ExplainStepError`;
  it is at `:55`.
- `docs/design/subscription-backend-design.md` cites `telemetry.test.ts:261` in **nine**
  places, not eight: `:133`, `:202`, `:253`, `:572`, `:575`, `:1032`, `:1077`, `:1157`,
  `:1404`. The assertion is now at **`:311`**, byte-identical and passing. Left untouched: the
  doc is at v1.9 and repointing needs a version bump plus a revision-history row.

### Gate results

`npx tsc --noEmit` 0 · `npm run lint` clean · `npm test` 1479 passed / 1 failed / 10 skipped
across 119 files, the single failure being the listed known flake
`ExplainStepAffordance.test.tsx` (passes 5/5 in isolation) · `npm run test:integration` 26
passed · `npm run check:bundle` PASS · `npm run build` 24/24. Baseline fully accounted for.

### Not verified here

Whether the widened CHECK exists on the dev/prod databases — that is plan Task 5.7 (real-DB
acceptance) and plan Task 5.8. No production deployment of this branch has occurred.
