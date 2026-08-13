# Task 08: `support.*` i18n Key Inventory (Student-Facing) (Work Plan Phase 2, Task 2.1)

Metadata:
- Dependencies: none
- Provides: `support.*` i18n keys (consumed by task-09's `SupportWidget` tree)
- Size: Small (2 files: `vi.ts`, `en.ts`)

## Implementation Content

Add every key in the frontend DD's i18n Key Inventory (trigger, dialog, intent, message, screenshot, submit, error, ack keys) to `vi.ts`/`en.ts`; confirm `common.cancel`/`common.retry`/`common.working` are reused, not duplicated.

## Target Files
- [ ] `SOURCE/lib/i18n/dictionaries/vi.ts` (additive — `support.*` block)
- [ ] `SOURCE/lib/i18n/dictionaries/en.ts` (additive — `support.*` block)

## Investigation Targets
- `docs/design/support-system-frontend-design.md` (§ i18n Key Inventory — the full `support.*` key list: trigger, dialog, intent, message, screenshot, submit, error, ack keys, with their exact key names)
- `SOURCE/lib/i18n/dictionaries/vi.ts`, `en.ts` (current structure — where `common.cancel`/`common.retry`/`common.working` are already defined, to confirm reuse rather than duplication)
- `SOURCE/lib/i18n/__tests__/i18n.test.ts` (the existing vi/en key-parity assertion this task's additions must satisfy)

## Investigation Notes

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations, in particular the exact key names from the frontend DD's inventory and confirmation that `common.cancel`/`common.retry`/`common.working` already exist.
- [ ] Confirm `i18n.test.ts`'s parity assertion currently passes (baseline before this task's additions).

### 2. Green Phase
- [ ] Add every `support.*` key from the frontend DD's inventory to both `vi.ts` and `en.ts`, with matching key sets.
- [ ] Run `i18n.test.ts` and confirm the parity assertion still passes.

### 3. Refactor Phase
- [ ] Re-read the added keys once more to confirm no accidental duplication of `common.*` keys and no hard-coded value drifting from the frontend DD's literal Vietnamese/English text.

## Quality Assurance Mechanisms
- i18n dictionary contract tests — Enforces: vi/en key parity, no empty values, placeholder parity, `report-ms`-absence assertion (unaffected by this task) — Config: `SOURCE/lib/i18n/__tests__/i18n.test.ts`
- ESLint / `tsc` strict — Enforces: style, types — Config: `SOURCE/eslint.config.mjs`

## Operation Verification Methods
- **Verification method**: run `i18n.test.ts`'s existing parity assertion against the updated `vi.ts`/`en.ts`.
- **Success criteria**: parity assertion green (every `support.*` key present in both files, no empty values); the `report-ms` absence assertion (task-05) remains unaffected — no `support.*` key/value contains the substring `report-ms`.
- **Failure response**: if parity fails, diff the two files' `support.*` key sets and add the missing key(s) to whichever file is short.
- **Verification level**: L2 (new/extended test passing) — this is a pure content addition with no runtime logic of its own.

## Proof Obligations
- **Claim**: every `support.*` key required by task-09's components exists in both `vi.ts` and `en.ts`, with no hard-coded display string left for any of them (AC-035, AC-036).
- **Primary failure mode**: a key is added to one dictionary but not the other (parity break), or a key's value is left as a placeholder/empty string.
- **Boundary to exercise**: in-process unit (`i18n.test.ts`'s parity assertion).
- **State assertion**: N/A.
- **Mock boundary rationale**: none — dictionaries read directly.
- **Residual**: AC-035's "no hard-coded string anywhere in the component tree" claim is only fully provable once task-09's components exist and are code-reviewed — this task only guarantees the *dictionary side* is complete; the *consumption side* (every component actually calling `useT()`/`getTranslate()` instead of inlining text) is a code-review gate at task-09, per the work plan's own recorded QA gap (no automated `jsx-no-literals`-equivalent rule exists in this repo).

## Completion Criteria
- [ ] Every key from the frontend DD's inventory present in both `vi.ts` and `en.ts`
- [ ] `i18n.test.ts` parity assertion green
- [ ] `common.cancel`/`common.retry`/`common.working` reused, not duplicated
- [ ] The `report-ms` absence assertion (task-05) remains unaffected

## Notes
- Impact scope: `SOURCE/lib/i18n/dictionaries/vi.ts`/`en.ts` (`support.*` block only).
- Scope boundary: do not add `support.admin.*` keys here — those are task-14's responsibility; do not modify any pre-existing dictionary block.
