# Task: `lib/ugc/gemini.ts` — the emit chokepoint and the cost table

Plan mapping: `docs/plans/subscription-work-plan.md` — **Phase 5, plan Task 5.2**
Layer: **backend** (`SOURCE/lib/ugc/**`, `SOURCE/lib/tutor/**`)

Metadata:
- Dependencies: backend-task-21 (plan Task 5.1 — `consumeQuota`, which consumes these per-operation numbers)
- Provides: the single emit site plan Tasks 5.3 and 5.4 gate in front of
- Size: Medium (5 files)

`Change Category: boundary-change`

The four Gemini call sites move behind one wrapper. Sweep the adjacent cases sharing that boundary — all four call sites plus `SOURCE/lib/security/rateLimit.test.ts:181-184` `GEMINI_REQUESTS_PER_CALL` — for the same class of defect: a second declaration of the per-operation cost, or a fifth call site bypassing the wrapper.

## Implementation Content

- Add `export const GEMINI_CALLS_PER_OPERATION = { tutor: 1, uploadTyped: 2, uploadAutomatic: 3 } as const;` **beside the emit point** — the only place the number is a fact rather than a copy — and make `rateLimit.test.ts:181-184` `GEMINI_REQUESTS_PER_CALL` a **consumer of it** rather than a second declaration.
- Add **one exported `generateContent` wrapper** and convert the four call sites: `extractQuestions.ts:262-263`, `extractAnswers.ts:163-164`, `extractMeta.ts:105-107`, `callTutor.ts:97-98`.
- **The wrapper adds no error handling, no retry and no classification** — `RETRY_ATTEMPTS = 3` stays the SDK business and the four callers keep their own classification. `getGeminiClient()` at `:29` is unchanged.
- **`callTutor.ts` responsibility is unchanged** — no access control, no quota, no budget enters that file.

## Target Files
- [ ] `SOURCE/lib/ugc/gemini.ts` (`GEMINI_CALLS_PER_OPERATION` + the exported wrapper)
- [ ] `SOURCE/lib/ugc/extractQuestions.ts` (`:262-263` converted)
- [ ] `SOURCE/lib/ugc/extractAnswers.ts` (`:163-164` converted)
- [ ] `SOURCE/lib/ugc/extractMeta.ts` (`:105-107` converted)
- [ ] `SOURCE/lib/tutor/callTutor.ts` (`:97-98` converted)

## Investigation Targets
- `SOURCE/lib/ugc/gemini.ts` (`:29` `getGeminiClient()`; the current emit shape)
- `SOURCE/lib/ugc/extractQuestions.ts` (`:262-263`), `SOURCE/lib/ugc/extractAnswers.ts` (`:163-164`), `SOURCE/lib/ugc/extractMeta.ts` (`:105-107`), `SOURCE/lib/tutor/callTutor.ts` (`:97-98`) — the four call sites, **adjacent cases for the boundary sweep**
- `SOURCE/lib/security/rateLimit.test.ts` (`:181-184` `GEMINI_REQUESTS_PER_CALL` — must become a consumer, not a second declaration) — **adjacent case for the boundary sweep**
- `SOURCE/lib/billing/quota.ts` (plan Task 5.1 — the consumer of these per-operation numbers)
- `docs/design/subscription-backend-design.md` (§ AC-021 / I10)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record all current `client.models.generateContent` occurrences with file:line
- [ ] **Boundary sweep**: confirm exactly four call sites and one `GEMINI_REQUESTS_PER_CALL` declaration exist today
- [ ] Write the failing **source-scan** assertion first: `client.models.generateContent` occurs in **exactly one module** under `SOURCE/`
### 2. Green Phase
- [ ] Add the constant and the wrapper; convert the four call sites; run only the added tests
### 3. Refactor Phase
- [ ] Confirm no caller error handling, retry or classification moved into the wrapper

## Quality Assurance Mechanisms
- `npm test` -> `vitest run` — Config: `SOURCE/package.json:10`
- `rateLimit.test.ts` three-family partition — Enforces: `RATE_LIMITS` classification and family invariants — Config: `SOURCE/lib/security/rateLimit.test.ts`
- `npx tsc --noEmit`, `npm run lint`, `npm run build` (project-wide)

## Operation Verification Methods
- **Verification method**: a **source scan** over `SOURCE/**` for `client.models.generateContent`, plus unit tests over each converted call site.
- **Success criteria**: `client.models.generateContent` is **resolvable in exactly one module**; each of the four call sites goes through the wrapper; `GEMINI_REQUESTS_PER_CALL` consumes `GEMINI_CALLS_PER_OPERATION`; no behaviour change in retry or classification.
- **Failure response**: if a call site cannot be converted without moving classification into the wrapper, **stop and escalate** — the wrapper adding classification would take error-shape ownership away from the four callers.
- **Verification level**: L2.

## Proof Obligations
- **Claim (AC-021)**: every Gemini request the repository can emit passes one chokepoint.
- **Primary failure mode**: a **future** call site is added elsewhere and is never counted — a per-call-site test only covers the four that exist today, so it cannot catch this.
- **Boundary to exercise**: the repository source text (`SOURCE/**`), scanned directly.
- **State assertion**: N/A.
- **Mock boundary rationale**: none — source text is read, not executed.
- **Residual**: the budget counts **logical** calls, so under a supplier incident that triggers retries real consumption can exceed the counter by up to **3×**. **Recorded, not fixed**; mitigated by `AI_BUDGET_DAILY_LIMIT` being an env var, so the ceiling can be lowered mid-incident without deploying logic.

## Completion Criteria
- [ ] All added tests pass; the source scan asserts exactly one module
- [ ] `GEMINI_CALLS_PER_OPERATION = { tutor: 1, uploadTyped: 2, uploadAutomatic: 3 }` declared once, beside the emit point
- [ ] `rateLimit.test.ts:181-184` consumes it rather than re-declaring it; no other existing assertion edited
- [ ] `getGeminiClient()` at `:29` unchanged; `callTutor.ts` gains no access control, quota or budget concern
- [ ] **Production deploy is permitted only after plan Task 5.8 is green**

## Notes
- Impact scope: five files across `SOURCE/lib/ugc/**` and `SOURCE/lib/tutor/**`; downstream, plan Tasks 5.3 and 5.4 gate in front of this chokepoint.
- Scope boundary: retry (`RETRY_ATTEMPTS = 3`) stays SDK business; the four callers keep their own classification.
