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
- [x] `SOURCE/lib/format/datetime.ts` (new)
- [x] `SOURCE/lib/format/number.ts` (new)
- [x] `SOURCE/components/billing/OrderStatusBadge.tsx` (new)
- [x] `SOURCE/lib/i18n/dictionaries/en.ts`, `SOURCE/lib/i18n/dictionaries/vi.ts` (S-05 keys)

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
- [x] Read all Investigation Targets and record `StatusBadge.tsx` two defects explicitly, so neither is copied
- [x] Write failing tests first: formatters against `null`, `""`, `"not-a-date"`, an **ICT-midnight-crossing instant**, `0`, a negative amount, **and no throw**; C-09 with five cases including a fabricated status (`"refunded"`)
### 2. Green Phase
- [x] Implement the two format modules and C-09; add the S-05 keys to both dictionaries; run only the added tests
### 3. Refactor Phase
- [x] Re-run the i18n identical-string assertion and confirm it still passes

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
- [x] All added tests pass, including the fabricated-status case and the ICT-midnight-crossing instant
- [x] C-09 carries **no hex literals** and **no silent fallback**
- [x] S-05 keys present in **both** dictionaries; the identical-string ratio assertion still green
- [x] `SOURCE/app/(layer4)/_components/StatusBadge.tsx` unmodified (TBD-09)
- [x] Every Reference Contracts Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes
- [x] **No production deploy of this branch has occurred**

## Notes
- Impact scope: `SOURCE/lib/format/**`, `SOURCE/components/billing/OrderStatusBadge.tsx`, both dictionaries; downstream, plan Tasks 2.4, 3.6, 3.7, 4.3.
- **Name-collision note**: `ExamRow.tsx:68` already defines a module-local `formatDateTime(iso)` with **opposite** timezone semantics. It is unexported so a cross-import is impossible, but a mental substitution during review is not — **TBD-08** (a justified gap in this plan) is what eventually deletes the shadow.
- Scope boundary: `StatusBadge.tsx` is not edited; `SOURCE/lib/billing/types.ts` frozen.

## Investigation Notes

### A. Investigation Targets read

| Target | What was observed |
|---|---|
| `SOURCE/app/(layer4)/_components/StatusBadge.tsx` | `:12` `Status` union of 5 UGC values; `:14-43` `CONFIG: Record<Status, {glyph, labelKey, className}>`; `:53` `const cfg = CONFIG[status as Status] ?? CONFIG.processing`; `:55-64` the structure to copy — one `<span>` with `inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium`, then `<span aria-hidden>{glyph}</span>` followed by `{t(labelKey)}` as the accessible name. **Read only — not edited (TBD-09).** |
| `SOURCE/lib/i18n/translate.ts` | `:27-29` `template.replace(/\{(\w+)\}/g, (whole, name) => name in values ? String(values[name]) : whole)` — a raw `39000` substitutes as `"39000"`. `:25` a missing key returns the key itself, never `""`. |
| `SOURCE/lib/i18n/dictionaries/{en,vi}.ts` | Flat `"<area>.<key>": "value"` records, `en` is the key-set source of truth (`MessageKey = keyof typeof en`). Existing billing block ends at `billing.quota.upgradeLink`; naming is flat-camel (`billing.cta.unavailableReason`, `billing.quota.tutorExhausted`), i.e. the shipped names win over the UI Spec table's dotted variants. |
| `SOURCE/lib/i18n/__tests__/i18n.test.ts` | `:23` key-set equality, `:27` no empty value, `:36` placeholder-set parity between locales, `:54-59` identical-string ratio `< 0.1`. |
| `SOURCE/app/(layer4)/_components/ExamRow.tsx` | `:68` module-local, **unexported** `formatDateTime(iso)` built from `d.getDate()/getMonth()/getHours()` — the **runtime's** timezone, i.e. opposite semantics to the new module. No cross-import is possible; it is left untouched (TBD-08). |
| `SOURCE/supabase/schema.sql` | `payment_orders.status text not null default 'pending' check (status in ('pending', 'paid', 'expired', 'cancelled'))`, with the in-file comment stating there is deliberately **no** `'refunded'` value. |
| `docs/design/subscription-frontend-design.md` (§ Data Contracts, Decision 3) | Signatures `formatDate(iso: string \| null, locale)`, `formatDateTime(iso: string \| null, locale)`, `formatVnd(amount: number, locale)`; `"—"` for null-ish/unparseable/non-finite, never throws. Decision 3's five-row C-09 table (glyph, dictionary key, token classes). |
| `docs/ui-spec/subscription-ui-spec.md` (UI-D12, UI-D13, UI-D15, C-09) | Pinned `timeZone: "Asia/Ho_Chi_Minh"` **and** explicit locale; `formatVnd` before `t()`; C-09 props typed `{ status: string }` **on purpose** (a DB boundary — the union would turn a CHECK change into a silent mislabel); five branches; unrecognised = `?` + "Không xác định"/"Unrecognised" in `--destructive`. |

### B. The two `StatusBadge.tsx` defects, and how each is avoided here

1. **Four hex colour literals** (`:26` `border-[#B8863B] text-[#8a6420]`, `:36` `border-[#3f7d4f] text-[#2f6b3f]`). C-09 carries **zero** hex: every one of its five class strings is a token (`border-border`, `text-muted-foreground`, `border-foreground`, `text-foreground`, `border-destructive`, `text-destructive`). `--destructive` (`app/globals.css:99`) is the token UI-D15 names for the unrecognised branch. Verified by grep for `#` over the component source **and** by a rendered-output assertion in the test (no `#`-hex in any of the five `className` strings).
2. **The silent `?? CONFIG.processing` coercion** (`:53`). This is the one that matters: it makes an unknown status read as a payment state the system is not in. C-09 instead narrows with an explicit type guard over the four schema literals and routes everything else to a **separate `UNRECOGNISED` appearance object** that is not a member of `CONFIG` — so no permitted branch can ever be reached by a non-permitted value. There is no `??`, no `as OrderStatus`, and no default-to-a-real-status anywhere in the file.

### C. Planned approach (per Reference Contracts row) — recorded before implementation

- **Row 1 (schema permitted set).** `CONFIG` is a `Record<OrderStatus, Appearance>` whose key type is the union of exactly `"pending" | "paid" | "expired" | "cancelled"` — the same four literals as the CHECK, in the same order. No `refunded` key is declared anywhere in the component or the dictionaries. A separate `UNRECOGNISED` constant supplies the fifth appearance. Compliance Check → **Y** (evidence in §E).
- **Row 2 (unrecognised is never `pending`/`paid`).** Narrowing is `isOrderStatus(status) ? CONFIG[status] : UNRECOGNISED`. The test's fabricated value is `"refunded"` — the plausible-looking value a reader would most expect to be tolerated — and the assertion asserts **presence first** (the badge element exists and its text is non-empty), then equality with the real `billing.status.unrecognised` value, then inequality against the real `billing.status.pending` and `billing.status.paid` values, in **both** locales. Compliance Check → **Y** (evidence in §E).

### D. Scope split for the S-05 dictionary keys

Plan Task 3.7 states "**All seven** [`billing.recheck.*`] keys land in **both** dictionaries in this task" and is titled "…and the **remaining** S-05 keys" (work plan `:646-647`). So this task lands the S-05 keys **3.7 does not own**: `billing.status.{pending,paid,expired,cancelled,unrecognised}` (C-09, consumed here), `billing.amount`, and `billing.orders.{title,empty,emptyHint,createdAt,orderCode,continuePaying,loadError}` (consumed by plan Task 3.6). Deliberately **not** added here: `billing.recheck.*`, `billing.quota.unavailable`, `billing.orders.{tutorRemaining,uploadRemaining}` — all C-10/C-11, i.e. Task 3.7.

### E. Results

**Files landed** — `SOURCE/lib/format/datetime.ts`, `SOURCE/lib/format/number.ts`, `SOURCE/components/billing/OrderStatusBadge.tsx`, plus co-located tests `lib/format/datetime.test.ts` (13), `lib/format/number.test.ts` (8), `components/billing/OrderStatusBadge.test.tsx` (29) = **50 new cases, all passing**. Full suite **1062 passed / 10 skipped across 96 files** (baseline 1012/10 across 93 — delta is exactly the 50 new cases in 3 new files). `npx tsc --noEmit` 0 errors; `npx eslint --max-warnings 0` project-wide clean.

**A test-environment fact that had to be forced, or the whole timezone claim would have been hollow.** This dev machine runs `TZ=Asia/Saigon` — the *same* zone the module pins. An implementation that forgot `timeZone` would therefore have rendered identical output here and the suite would have been green for no reason (Vercel runs UTC, so the defect would only surface in production). `datetime.test.ts` sets `process.env.TZ = "UTC"` and carries a guard case asserting `Intl.DateTimeFormat().resolvedOptions().timeZone === "UTC"`, so if the override ever stops taking effect the file fails loudly instead of quietly losing its discriminating power.

**Formatter edge cases** (all under forced `TZ=UTC`):

| Input | `formatDate` | `formatDateTime` | Note |
|---|---|---|---|
| `null` | `—` | `—` | no throw |
| `""` | `—` | `—` | no throw |
| `"not-a-date"` | `—` | `—` | no throw |
| `2026-08-18T17:30:00Z` (**ICT-midnight-crossing**) | `19/08/2026` | `19/08/2026 00:30` | UTC calendar day is **18**, ICT is **19** — this instant is the only one in the file that can catch a missing `timeZone` pin |
| `2026-08-18T17:00:00Z` (exact ICT midnight) | `19/08/2026` | `19/08/2026 00:00` | `hourCycle: "h23"` — prints `00:00`, not `24:00` |
| `2026-08-18T07:32:00Z` (midday both zones) | `18/08/2026` | `18/08/2026 14:32` | control case; deliberately **cannot** detect a missing pin |

| Input | `formatVnd(_, "vi")` | `formatVnd(_, "en")` |
|---|---|---|
| `39000` | `39.000` | `39,000` |
| `1234567` | `1.234.567` | `1,234,567` |
| `0` | `0` | `0` (a valid amount, **not** `—`) |
| `-39000` | `-39.000` | `-39,000` |
| `NaN` / `±Infinity` | `—` | `—` (no throw) |

`t("billing.amount", { amount: formatVnd(39000, "vi") })` → `"39.000 VNĐ"`. The negative control is asserted too: `t("billing.amount", { amount: 39000 })` → `"39000 VNĐ"`, so the defect UI-D13 exists to prevent has a named, pinned shape in the suite.

**Mutation → caught/survived.** Each mutation was applied to the shipped file, the relevant suite run, then the file restored from a byte-compared backup.

| # | Mutation | Result | Evidence |
|---|---|---|---|
| M1 | drop the `timeZone: TIME_ZONE` pin | **caught** | 5 failed / 8 passed — `expected '18/08/2026' to be '19/08/2026'`, `expected '18/08/2026 17:30' to be '19/08/2026 00:30'` |
| M2 | drop the explicit locale (`Intl.DateTimeFormat(undefined, …)`) | **caught** | 6 failed / 7 passed — `expected '08/19/2026' to be '19/08/2026'`. *Caveat recorded honestly*: both `en-GB` and `vi-VN` render DD/MM/YYYY by design, so this catch rests on the runner's ambient default being `en-US`. M6 below covers the same mutation class with no ambient dependency |
| M3 | replace the unrecognised branch with `CONFIG[status as OrderStatus] ?? CONFIG.pending` | **caught** | 11 failed / 13 passed — `expected 'Awaiting payment' to be 'Unrecognised'`, `expected 'Chờ thanh toán' not to be 'Chờ thanh toán'`, `expected … to contain 'border-destructive'` |
| M4 | `formatVnd` returns the raw number (`String(amount)`) | **caught** | 6 failed / 2 passed — `expected '39000' to be '39.000'`, `expected '39000 VNĐ' to be '39.000 VNĐ'` |
| M5 | swap two dictionary values (`en` `billing.status.pending` ↔ `.paid`) | **SURVIVED at first (24/24 green) → test fixed → now caught** | The original cases asserted `word === en["billing.status.pending"]`, so a swap moved *both* sides of the equality. Five fixed-literal cases per locale were added (`OrderStatusBadge.test.tsx`); re-run gives 2 failed / 27 passed — `expected 'Paid' to be 'Awaiting payment'` |
| M6 | drop the explicit locale in `number.ts` | **caught, ambient-independent** | 4 failed / 4 passed — `expected '39,000' to be '39.000'`. The `vi`/`en` pair uses dot vs comma, so any single ambient default fails one of the two |
| M7 | mis-key a `CONFIG` entry (`cancelled` → `billing.status.pending`) | **caught** | 3 failed / 26 passed — `expected 'Awaiting payment' to be 'Cancelled'`, `expected 3 to be 4` (glyph/word distinctness) |

**Guard against the recurring "artifact with no discriminating power" class.** `readBadge()` in the C-09 test **throws** when the badge element, the `aria-hidden` glyph, or the word is missing or empty — it never returns `""`. Without this, every "the word is **not** the pending word" assertion would pass against a tree that rendered nothing at all. Presence is established first, value second.

**i18n identical-string budget**: 4 identical pairs / **514** keys = **0.00778** before → 4 / **527** = **0.00759** after (13 keys added, none identical across locales), against the `< 0.1` assertion at `i18n.test.ts:55-59`. Ratio moved *down*. `i18n.test.ts` 12/12 green (key-set parity, no-empty, placeholder parity all still hold — `{amount}` appears in both locales).

**Compliance Checks — final evaluation against the shipped implementation**

| Row | Check | Result | Evidence |
|---|---|---|---|
| 1 | C-09 renders one branch per permitted literal plus one unrecognised branch, and declares no `refunded` branch | **Y** | `CONFIG: Record<OrderStatus, Appearance>` with `OrderStatus = "pending" \| "paid" \| "expired" \| "cancelled"` — the CHECK's four literals, no more; `UNRECOGNISED` is a separate constant outside `CONFIG`. `grep -nE "refunded" OrderStatusBadge.tsx` over code lines (comments stripped) → **no match**; the only occurrence is the comment recording *why* there is no such status. Tests: four permitted branches each assert their own word **and** their own glyph, plus a distinctness case (`new Set(words).size === 4`, `new Set(glyphs).size === 4`). Neither dictionary carries a `billing.status.refunded` key |
| 2 | A fabricated status renders the unrecognised glyph and word, and the rendered word is neither the `pending` word nor the `paid` word | **Y** | `"refunded"` (chosen precisely because it is the plausible-looking value) renders `?` + `Unrecognised` / `Không xác định` in **both** locales, with `border-destructive text-destructive` and **no** `text-muted-foreground`; `not.toBe(pending)` and `not.toBe(paid)` asserted per locale for both word and glyph, after `readBadge()` has already proved presence. Five further fabricated values (`""`, `" "`, `"PENDING"`, `"Paid"`, `"unknown"`) take the same branch. M3 proves the assertions bite: reintroducing the `?? CONFIG.pending` coercion turns 11 cases red |

**Both `StatusBadge.tsx` defects verified absent from C-09** — `grep -n "#" components/billing/OrderStatusBadge.tsx` → **no match at all** (zero hex literals anywhere in the file, comments included); `grep -nE "\?\?|as OrderStatus"` over code lines (comments stripped) → **no match**. `git status --porcelain -- "app/(layer4)/_components/StatusBadge.tsx" "lib/billing/types.ts"` → **empty**, i.e. TBD-09's file and the frozen types file are untouched. `ExamRow.tsx:68`'s shadowed `formatDateTime` was left in place (TBD-08); no cross-import exists in either direction.

**Implementation choice worth recording**: `Locale` is mapped to a BCP-47 tag (`en → en-GB`, `vi → vi-VN`) rather than passed through raw. Raw `"en"` resolves to `en-US`, which renders `MM/DD/YYYY` — that would contradict the `DD/MM/YYYY` the Design Doc prints and the `DD/MM/YYYY HH:mm` plan Task 3.8 verifies against, and it would make `08/09` readable as two different dates. `formatDateTime` composes a date formatter and a time formatter joined by one space rather than using a single combined formatter, because the combined form inserts an ICU-version-dependent separator (`", "` on this runtime) — which would defeat the byte-identical guarantee the whole pinning exercise exists for.
