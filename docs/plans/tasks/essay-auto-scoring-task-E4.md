# Task E4 — OQ-5: decide what happens to `upload.essayStored`

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase E (Enable — human-owned), Task E4**
Layer: **process decision** (may result in an i18n-only change)

Metadata:
- Owner: **engineer**, **before enabling the flag**.
- Dependencies: **Task E1** (Gate A closed).
- Blocks: **Task E6** (it does not block ship; it blocks **treating the author surface as correct**).
- Provides: a recorded decision (a), (b) or (c).
- Size: Small (0 files if (a) or (c); 2 i18n files if (b)).
- Verification level: **L3** if a string changes; documentation otherwise.

## Implementation Content

That string (`vi.ts:271`, `en.ts:334`, rendered at `features/authoring/components/QuestionEditor.tsx:15`) tells the **exam author** that essays are "chưa chấm tự động". **It becomes false the moment Gate A passes.**

**Out of scope by boundary** — D6 keeps the author surface unchanged and the UI Spec's four screens exclude `(authoring)` — **but it is not allowed to stay silent.**

### Choose one and record it
- **(a)** leave it and **accept one false sentence** on the author screen;
- **(b)** change the string **in the same deploy as the flag** (an i18n-only change, no structural impact);
- **(c)** open a UI Spec section for `(authoring)`.

### Escalation condition
Does **not** block ship; it blocks **treating the author surface as correct**.

### Decision recorded here
**Decision 2026-08-30 by the engineer: option (b) — but implemented as TWO KEYS SELECTED BY THE FLAG, not as a rewritten string.**

The task's literal (b) ("change the string in the same deploy as the flag") would be false in the **other** direction whenever the flag is off — and this flag **has** an off path: E6 keeps a kill switch, and Preview need not carry the same variable as Production. A single string always has one state in which it lies.

So the decision mirrors what the player surface already does for the same problem (AC-051 / UI-D8, Task F-D1): keep `upload.essayStored` **verbatim** for the flag-off state and add `upload.essayScored` for flag-on, selected by the flag.

**Implementation (5 files + 1 test):**
- `lib/i18n/dictionaries/en.ts` — new key `upload.essayScored`; `en.ts` first, because `Dictionary` is derived from it (AB-12)
- `lib/i18n/dictionaries/vi.ts` — the same key
- `features/authoring/components/QuestionEditor.tsx` — new prop `essayGradingEnabled?: boolean`, **default `false`** (fail-closed, like all three existing flag reads: a call site that forgets the prop shows something merely stale rather than promising a feature that may be off), and the ternary at the footnote
- `features/authoring/components/AssembledQuestionList.tsx` — passes it through at **both** render sites. Missing one would leave multi-part exams showing the wrong sentence, which is exactly the kind of defect that only appears on multi-part exams
- `features/authoring/components/ReviewScreen.tsx` — passes it through
- `app/(authoring)/me/exams/[id]/page.tsx` — the **only** place that reads `process.env`, because it is the only server component in this chain; the other three are `"use client"`. Read rule identical to the other three sites (AC-013): only a trimmed `"true"` is on

**Test**: one case in `QuestionEditor.test.tsx` covering absent / `false` / `true`, asserting the expected string is present **and** the other absent. It was **proven red against an inverted ternary**, not merely green as written — a case that checks only one branch passes happily with the two keys swapped.

**Scope note:** this does *not* reverse D6. The author surface gains no new screen, no UI Spec section and no structural change — one sentence now tracks a flag that already exists. Option (c) remains unopened.

## Target Files
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Task E4's decision slot
- [ ] *(only if option (b))* `SOURCE/lib/i18n/dictionaries/en.ts` and `SOURCE/lib/i18n/dictionaries/vi.ts` — `upload.essayStored`
- [ ] *(only if option (c))* `docs/ui-spec/essay-auto-scoring-ui-spec.md` — a new `(authoring)` section

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-11 / OQ-5 — `upload.essayStored` tells the **exam author** essays are not auto-scored; it becomes false once Gate A passes)
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Open Questions carried forward — OQ-5)
- `SOURCE/lib/i18n/dictionaries/vi.ts` (`:271` `upload.essayStored`)
- `SOURCE/lib/i18n/dictionaries/en.ts` (`:334` `upload.essayStored`)
- `SOURCE/features/authoring/components/QuestionEditor.tsx` (`:15` — where the string renders)
- `docs/ui-spec/essay-auto-scoring-ui-spec.md` (the four screens — **`(authoring)` is excluded**, which is why this is a boundary decision rather than a defect)

## Investigation Notes
_(Record here: the option chosen, the reason, and — if (b) — the new wording in both dictionaries.)_

## Implementation Steps
- [ ] Read the string in both dictionaries and see it rendered at `QuestionEditor.tsx:15`
- [ ] Choose (a), (b) or (c) and **record the decision with a date**
- [ ] If **(b)**: change the string in `en.ts` **first**, then `vi.ts` (the `Dictionary` type is derived from `en.ts` — AB-12), and land it **in the same deploy as the flag**
- [ ] If **(c)**: open the `(authoring)` UI Spec section and record it as follow-up work

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: i18n key coverage across both dictionaries (AB-12) — Config: `SOURCE/tsconfig.json` (project-wide) — relevant only under option (b)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | | |
| 2 | `npx eslint --max-warnings 0` | | |
| 3 | `npx vitest run` | | |
| 4 | `npm run build` | | |
| 5 | `npm run test:fixture` | | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi` |
| 6 | `npm run test:localdb` | | see Open Item I-7 |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: the decision is **physically recorded** in the work plan with a date; under option (b), the changed string renders correctly at `QuestionEditor.tsx:15` in both locales.
- **Success criteria**: OQ-5 decided and recorded; under (b), both dictionaries updated and `tsc` green.
- **Failure response**: if no decision is made, the author screen carries a **false sentence** with nobody owning it — that is the outcome this task exists to prevent. It does not block ship, but it must not stay silent.
- **Verification level**: **L3** (or documentation only).

## Proof Obligations
- **Claim (OQ-5 / D-11)**: the exam-author surface does not silently carry a sentence this feature makes false.
  - **Primary failure mode**: the string left unexamined because `(authoring)` is out of the UI Spec's scope — so the boundary decision becomes an accidental omission rather than an accepted trade-off.
  - **Boundary to exercise**: the rendered author screen (`QuestionEditor.tsx:15`) in both locales, under option (b); the recorded decision otherwise.
  - **State assertion**: N/A.
  - **Mock boundary rationale**: none.
  - **Residual**: under option (a) the false sentence **remains, knowingly** — that is the recorded trade-off, not an oversight.

## Completion Criteria
- [ ] OQ-5 **decided and recorded** with a date
- [ ] Under option (b): both dictionaries updated (`en.ts` first) and landed **in the same deploy as the flag**
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: the `(authoring)` author screen only.
- Scope boundary — preserve unchanged unless option (b) is chosen: `SOURCE/lib/i18n/dictionaries/{en,vi}.ts`'s `upload.essayStored`; all other `(authoring)` surfaces.
- **Task B4.1 explicitly left this out of scope** and carried it here.
