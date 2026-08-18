# Task: Gate A — text-side assertions, including the two new ones

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 1, plan Task 1.2**
Layer: **backend** (schema test code)

Metadata:
- Dependencies: backend-task-09 (plan Task 1.1 — the DDL text these assertions read)
- Provides: gate A green — the **precondition for plan Task 1.3** (the dev apply); also carries P-1 structural half for plan Task 3.1
- Size: Small (1–2 test files)

## Implementation Content

`npm test` must be green with **four** text-side assertions over `SOURCE/supabase/schema.sql`, using `readFileSync` — **no database, no credential**:

1. `parseForeignKeys.test.ts` — both new FKs declare `on delete`; the four `text` transfer columns add none.
2. `schemaFingerprint.test.ts` — the three fingerprint values agree.
3. **New allowlist assertion** — the `payment_orders` block column set is **exactly** the eleven declared. This is P-1 structural half: an **allowlist, not a blocklist**, so any twelfth column fails the case.
4. **New parse case** — every `error_code in ( … )` occurrence in `schema.sql` — **there are now two** — yields exactly `TELEMETRY_ERROR_CODES`.

## Target Files
- [ ] `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` (new allowlist case; existing cases unmodified)
- [ ] `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (new `error_code in ( … )` parse case; existing cases unmodified)

## Investigation Targets
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts` (existing case shape and the `readFileSync` idiom)
- `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (existing case shape)
- `SOURCE/lib/schema/parseForeignKeys.ts` (the parser these cases drive)
- `SOURCE/supabase/schema.sql` (the `payment_orders` block from plan Task 1.1; **both** `error_code in ( … )` occurrences — the inline one near `:1381-1382` and the new drop/add pair)
- `SOURCE/lib/tutor/telemetry.ts` (`:35` `TELEMETRY_ERROR_CODES` — the constant the parse case compares against)
- `docs/design/subscription-backend-design.md` (§ Verification Strategy)
- `docs/design/subscription-backend-design.md` (§ Security / P-1)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `payment_orders`) | structure-order | The `payment_orders` column set is **exactly** the eleven declared: `order_code`, `user_id`, `amount`, `status`, `created_at`, `pending_until`, `settled_at`, `qr_payload`, `account_number`, `account_name`, `memo` — an allowlist, not a blocklist | The allowlist assertion enumerates exactly these eleven names and fails on any twelfth column |
| `docs/design/subscription-backend-design.md` (§ Sensitivity / P-1) | state-lifecycle-negative | **P-1 (normative).** No field of the provider `transactions[]` may be persisted to any column or reach any log. `settleOrder()` reads exactly **two** values from the provider response — the order `status` and its `amount` | The allowlist case is the structural half of P-1: a persisted `transactions[]`-derived column cannot pass it |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record both `error_code in ( … )` line locations
- [ ] Write the allowlist case and the two-occurrence parse case; confirm each **fails** first against a deliberately perturbed copy of the schema text (a twelfth column; a one-literal-short list) — a case that cannot go red proves nothing
### 2. Green Phase
- [ ] Point the cases at the real `schema.sql`; run `npm test` and confirm green
### 3. Refactor Phase
- [ ] Confirm the existing `parseForeignKeys` and `schemaFingerprint` cases are unmodified and still pass

## Quality Assurance Mechanisms
- `parseForeignKeys.test.ts` (text-side, `readFileSync`, no DB) — Enforces: TD-011, every FK declares `on delete` — Config: `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`
- `schemaFingerprint.test.ts` (text-side) — Enforces: TD-005 — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`
- `npm test`, `npx tsc --noEmit`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: run `npm test` from `SOURCE/`. All four assertions read `schema.sql` from disk; no database is contacted.
- **Success criteria**: `parseForeignKeys.test.ts`, `schemaFingerprint.test.ts` and the two added cases are all green; the added `error_code in ( … )` case reports **two** matched occurrences.
- **Failure response**: a failure in **either** gate **stops the phase** — do not proceed to implementation and do not apply the DDL to any database.
- **Verification level**: L2 (new tests added and passing).

## Proof Obligations
- **Claim**: the DDL text in git carries exactly the designed structure, and both telemetry literal lists agree with the code-side constant.
- **Primary failure mode**: **the parse case finds one occurrence and passes** — the drift this assertion exists to prevent, where the inline list is widened and the drop/add pair is not (or vice versa), and only one of the two databases ends up correct.
- **Boundary to exercise**: the schema file read from disk (`readFileSync`) — no DB boundary.
- **State assertion**: N/A (no state is written).
- **Mock boundary rationale**: none — the real file is read; mocking the file would assert the mock.
- **Residual**: gate A proves nothing about any database. Gate B (plan Tasks 1.3, 5.8) does, and a matching fingerprint proves which build is running, not that the content is present.

## Completion Criteria
- [ ] All added tests pass; `npm test` green (gate A)
- [ ] The added parse case asserts it matched **both** `error_code in ( … )` occurrences, not merely that one matched
- [ ] The allowlist case fails against a fabricated twelfth column (demonstrated in the Red phase)
- [ ] Existing assertions in both test files are unmodified
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: schema text-side tests; downstream, plan Task 1.3 may not start until this is green.
- Scope boundary: no DDL is edited here; `SOURCE/lib/tutor/telemetry.ts` is not edited (plan Task 5.5 owns it).

## Investigation Notes
(Record the two matched `error_code in ( … )` locations and the Red-phase perturbation results here.)
