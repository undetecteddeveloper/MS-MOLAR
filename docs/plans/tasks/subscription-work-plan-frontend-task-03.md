# Task: Frontend foundation — the two format modules, C-09, and the S-05 dictionary keys

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 2, plan Task 2.3**
Layer: **frontend** (`SOURCE/lib/format/**`, `SOURCE/components/**`, `SOURCE/lib/i18n/**`)

Metadata:
- Dependencies: none (independent of the provider work in the same phase)
- Provides: `formatDate` / `formatDateTime` / `formatVnd`, C-09 `OrderStatusBadge`, and the S-05 `billing.*` keys — consumed by plan Tasks 2.4, 3.6, 3.7, 4.3
- Size: Medium (5 files)

## Implementation Content

- **`SOURCE/lib/format/datetime.ts`** — `formatDate`, `formatDateTime`, with **`timeZone: "Asia/Ho_Chi_Minh"` pinned** *and* an **explicit `locale`**, so server and browser produce **byte-identical** output and a client component can format without a hydration mismatch.
- **`SOURCE/lib/format/number.ts`** — `formatVnd`, formatted **before** `t()` substitutes (`translate.ts:27` renders `String(value)`, so a raw `39000` would appear beside a QR carrying `39.000 VNĐ`).
- **`SOURCE/components/billing/OrderStatusBadge.tsx`** (C-09) — structure copied from `StatusBadge.tsx:55-64`, **neither of its two defects**: **no hex literals**, **no silent `?? CONFIG.processing` fallback**.
  **C-09 five branches are defined against the schema permitted set, which is exactly `('pending', 'paid', 'expired', 'cancelled')`** — four recognised branches plus the unrecognised one. **There is no `refunded` status**; anything outside those four takes the **unrecognised** branch and is **never coerced** into one of them.
- Add the **S-05 `billing.*` keys to both dictionaries**.
- **Do not edit `SOURCE/app/(layer4)/_components/StatusBadge.tsx`** (TBD-09).

## Target Files
- [ ] `SOURCE/lib/format/datetime.ts` (new)
- [ ] `SOURCE/lib/format/number.ts` (new)
- [ ] `SOURCE/components/billing/OrderStatusBadge.tsx` (new)
- [ ] `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (S-05 keys)

## Investigation Targets
- `SOURCE/app/(layer4)/_components/StatusBadge.tsx` (`:55-64` — the structure to copy; **read only, not edited** — its four hex literals and its silent `?? CONFIG.processing` fallback are TBD-09 and must not be reproduced)
- `SOURCE/lib/i18n/translate.ts` (`:27` — `String(value)` substitution, the reason amounts are formatted **before** `t()`)
- `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (key style and the identical-string budget)
- `SOURCE/lib/i18n/__tests__/i18n.test.ts` (`:55-59` — the identical-string ratio assertion)
- `SOURCE/app/(layer4)/_components/ExamRow.tsx` (`:68` — the module-local `formatDateTime(iso)` with **opposite** timezone semantics; **name-collision hazard**)
- `SOURCE/supabase/schema.sql` (the `payment_orders.status` CHECK — the four permitted literals C-09 branches against)
- `docs/design/subscription-frontend-design.md` (§ Implementation Plan slice F)
- `docs/design/subscription-frontend-design.md` (§ Main Components)
- `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderStatusBadge` — C-09 — verify default (four permitted statuses) + partial (unrecognised) states)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/subscription-backend-design.md` (§ Schema, `payment_orders`) | structure-order | `status        text not null default 'pending'` `check (status in ('pending', 'paid', 'expired', 'cancelled'))` — the permitted set is **exactly** these four literals. **No `'refunded'` value**: *"refunds are a bank action plus a hand-written SQL correction (D10). Inventing a status the code never sets would be a state reachable only by a code path that does not exist"*. C-09 five branches (four permitted + unrecognised) are defined against this exact set | C-09 renders one branch per permitted literal plus one unrecognised branch, and declares no `refunded` branch |
| `docs/ui-spec/subscription-ui-spec.md` (§ Component: `OrderStatusBadge` — C-09) | state-lifecycle-negative | **Unrecognised status**: `?` + "Không xác định" / "Unrecognised" in `--destructive`. Never `pending`, never `paid` | A fabricated status renders the unrecognised glyph and word, and the rendered word is **neither** the `pending` word **nor** the `paid` word |

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record `StatusBadge.tsx` two defects explicitly, so neither is copied
- [ ] Write failing tests first: formatters against `null`, `""`, `"not-a-date"`, an **ICT-midnight-crossing instant**, `0`, a negative amount, **and no throw**; C-09 with five cases including a fabricated status (`"refunded"`)
### 2. Green Phase
- [ ] Implement the two format modules and C-09; add the S-05 keys to both dictionaries; run only the added tests
### 3. Refactor Phase
- [ ] Re-run the i18n identical-string assertion and confirm it still passes

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `i18n.test.ts:55-59` identical-string budget — Enforces: identical-key ratio stays `< 0.1` — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts` — Covered: `SOURCE/lib/i18n/dictionaries/{en,vi}.ts`
- `npx tsc --noEmit` — Enforces: i18n key parity (an `en.ts` key missing from `vi.ts` is a compile error)
- `npm run build`, `npm run lint` (project-wide)

## Operation Verification Methods
- **Verification method**: unit tests over both formatters and C-09; plus the i18n parity and ratio gates.
- **Success criteria**: formatters return a stable, timezone-pinned string for every listed input **and never throw**; C-09 renders five distinct branches; the fabricated status renders the unrecognised branch; both dictionaries carry the S-05 keys.
- **Failure response**: if a rendered date is one day off, **stop** — the `timeZone` pin is missing or a legacy formatter was used. This is not a defect to work around.
- **Verification level**: L2.

## Proof Obligations
- **Claim (invalid option)**: a status value outside the permitted set renders **its own** appearance and is **never coerced** to a permitted one.
- **Primary failure mode**: a silent fallback (the `?? CONFIG.processing` shape in `StatusBadge.tsx`) makes an unknown status read as `pending` or `paid` — a payment state the system is not in.
- **Boundary to exercise**: C-09 rendered output (component boundary).
- **State assertion**: N/A (pure render).
- **Mock boundary rationale**: none — real dictionary values are resolved so the assertions compare against real copy.
- **Residual**: the badge behaviour **after** a re-check re-render is asserted in plan Task 3.7 / FE-3.

- **Claim**: server and browser produce byte-identical formatted dates and amounts.
- **Primary failure mode**: an unpinned timezone or an implicit locale produces a hydration mismatch, or a date that is one day off in ICT.
- **Boundary to exercise**: the formatter functions (in-process unit) with an ICT-midnight-crossing instant.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — the real `Intl` implementation is the behaviour under test.
- **Residual**: real-browser confirmation is part of the manual pass (plan Task 6.5).

## Completion Criteria
- [ ] All added tests pass, including the fabricated-status case and the ICT-midnight-crossing instant
- [ ] C-09 carries **no hex literals** and **no silent fallback**
- [ ] S-05 keys present in **both** dictionaries; the identical-string ratio assertion still green
- [ ] `SOURCE/app/(layer4)/_components/StatusBadge.tsx` unmodified (TBD-09)
- [ ] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [ ] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/format/**`, `SOURCE/components/billing/OrderStatusBadge.tsx`, both dictionaries; downstream, plan Tasks 2.4, 3.6, 3.7, 4.3.
- **Name-collision note**: `ExamRow.tsx:68` already defines a module-local `formatDateTime(iso)` with **opposite** timezone semantics. It is unexported so a cross-import is impossible, but a mental substitution during review is not — **TBD-08** (a justified gap in this plan) is what eventually deletes the shadow.
- Scope boundary: `StatusBadge.tsx` is not edited; `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes
(Record the two copied-from defects avoided, the formatter edge-case results, and each Compliance Check result here.)
