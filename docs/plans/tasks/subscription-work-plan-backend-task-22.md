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
- [x] `SOURCE/lib/ugc/gemini.ts` (`GEMINI_CALLS_PER_OPERATION` + the exported wrapper)
- [x] `SOURCE/lib/ugc/extractQuestions.ts` (`:262-263` converted)
- [x] `SOURCE/lib/ugc/extractAnswers.ts` (`:163-164` converted)
- [x] `SOURCE/lib/ugc/extractMeta.ts` (`:105-107` converted)
- [x] `SOURCE/lib/tutor/callTutor.ts` (`:97-98` converted)

## Investigation Targets
- `SOURCE/lib/ugc/gemini.ts` (`:29` `getGeminiClient()`; the current emit shape)
- `SOURCE/lib/ugc/extractQuestions.ts` (`:262-263`), `SOURCE/lib/ugc/extractAnswers.ts` (`:163-164`), `SOURCE/lib/ugc/extractMeta.ts` (`:105-107`), `SOURCE/lib/tutor/callTutor.ts` (`:97-98`) — the four call sites, **adjacent cases for the boundary sweep**
- `SOURCE/lib/security/rateLimit.test.ts` (`:181-184` `GEMINI_REQUESTS_PER_CALL` — must become a consumer, not a second declaration) — **adjacent case for the boundary sweep**
- `SOURCE/lib/billing/quota.ts` (plan Task 5.1 — the consumer of these per-operation numbers)
- `docs/design/subscription-backend-design.md` (§ AC-021 / I10)

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record all current `client.models.generateContent` occurrences with file:line
- [x] **Boundary sweep**: confirm exactly four call sites and one `GEMINI_REQUESTS_PER_CALL` declaration exist today
- [x] Write the failing **source-scan** assertion first: `client.models.generateContent` occurs in **exactly one module** under `SOURCE/`
### 2. Green Phase
- [x] Add the constant and the wrapper; convert the four call sites; run only the added tests
### 3. Refactor Phase
- [x] Confirm no caller error handling, retry or classification moved into the wrapper

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
- [x] All added tests pass; the source scan asserts exactly one module
- [x] `GEMINI_CALLS_PER_OPERATION = { tutor: 1, uploadTyped: 2, uploadAutomatic: 3 }` declared once, beside the emit point
- [x] `rateLimit.test.ts:181-184` consumes it rather than re-declaring it; no other existing assertion edited
- [x] `getGeminiClient()` at `:29` unchanged; `callTutor.ts` gains no access control, quota or budget concern
- [ ] **Production deploy is permitted only after plan Task 5.8 is green** — NOT done: no production deployment of this branch has occurred

## Notes
- Impact scope: five files across `SOURCE/lib/ugc/**` and `SOURCE/lib/tutor/**`; downstream, plan Tasks 5.3 and 5.4 gate in front of this chokepoint.
- Scope boundary: retry (`RETRY_ATTEMPTS = 3`) stays SDK business; the four callers keep their own classification.

## Investigation Notes

### Current emit shape (`SOURCE/lib/ugc/gemini.ts`)
- `getGeminiClient()` at `:29` — singleton `GoogleGenAI`, key from `process.env.GEMINI_API_KEY`, `httpOptions.retryOptions.attempts = RETRY_ATTEMPTS` (`:26`, value `3`). Throws when the key is absent; callers map that to their own error code.
- Other exports: `logExtractorExit` (`:56`), `sdkErrorDetail` (`:65`), `FATAL_CALL_DEADLINE_MS` (`:95`), `makeDeadlineSignal` (`:102`), re-export of `ANSWER_MODEL`/`QUESTION_MODEL`.
- Module declares `import "server-only"` — anything importing it throws under plain `tsx`.

### Boundary sweep — every `client.models.generateContent` under `SOURCE/` today
| # | file:line | in scope of this task | note |
|---|---|---|---|
| 1 | `lib/ugc/extractQuestions.ts:263` | yes | `getGeminiClient()` at `:262`, deadline signal, `QUESTION_MODEL` |
| 2 | `lib/ugc/extractAnswers.ts:164` | yes | `getGeminiClient()` at `:163`, deadline signal, `ANSWER_MODEL` |
| 3 | `lib/ugc/extractMeta.ts:107` | yes | `getGeminiClient()` at `:105`, NO deadline (AC-040 non-fatal) |
| 4 | `lib/tutor/callTutor.ts:98` | yes | `getGeminiClient()` at `:97`, `TUTOR_CALL_DEADLINE_MS` |
| 5 | **`supabase/tagQuestionSkills.ts:129`** | **NO — not in Target Files** | offline batch script run by hand via `npx tsx`; it builds its own `GoogleGenAI` and **cannot** import `lib/ugc/gemini.ts` because that module `import "server-only"` throws under tsx (the script says so at `:25-28`) |

**Design-vs-reality mismatch, resolved without weakening the claim.** Backend DD `:1155` writes AC-021's gate as *"assert `client.models.generateContent` occurs in exactly one module under `SOURCE/`"*, but five occurrences exist, not four — the DD never counted the offline script. AC-021's own text (`:920`) scopes the claim to *"cả hai đường gọi Gemini"* (the tutor path and the upload path); the batch tagging script is neither, is never reachable from a request, and converting it is both out of Target Files scope and impossible without breaking it.

Resolution: **two exhaustive equalities whose union covers all of `SOURCE/**`** — the request-reachable surface must be exactly `["lib/ugc/gemini.ts"]`, and the offline-script exception list must be exactly `["supabase/tagQuestionSkills.ts"]`. A new occurrence anywhere under `SOURCE/` turns exactly one of the two RED, so nothing is left unasserted and the "future call site" failure mode stays covered. Recorded here as a deviation-with-rationale from the DD's literal single-list wording.

### `GEMINI_REQUESTS_PER_CALL` (`lib/security/rateLimit.test.ts:181-184`, now `:197-200`)
- Second declaration today: `{ explainStep: 1, uploadExam: 3 }`. Becomes a consumer — `explainStep: GEMINI_CALLS_PER_OPERATION.tutor`, `uploadExam: GEMINI_CALLS_PER_OPERATION.uploadAutomatic` (worst case, which is what the ceiling test means).
- Arithmetic that proves consumption: `RATE_LIMITS.explainStep.limit = 3`, `RATE_LIMITS.uploadExam.limit = 5`, `SUPPLIER_DAILY_QUOTA = 20`; worst case `3×1 + 5×3 = 18 ≤ 20`. Bumping `uploadAutomatic` to `4` gives `23 > 20` ⇒ RED; bumping `tutor` to `2` gives `21 > 20` ⇒ RED.

### Existing tests mock the SDK, not the wrapper
`lib/ugc/__tests__/extractors.test.ts:13-16`, `lib/ugc/__tests__/extractMeta.test.ts:13-16` and `lib/tutor/__tests__/callTutor.test.ts` all `vi.mock("@google/genai")` at the SDK boundary, so routing the four callers through a wrapper leaves them green without edits — which is exactly why a per-call-site test alone cannot tell "went through the wrapper" from "called the SDK directly". The new file therefore spies the **wrapper** with a delegating `vi.fn(actual.generateContent)` while the SDK stays mocked, so a direct call shows up as `wrapperSpy` 0 / SDK 1.

### Ordering detail accepted in `extractMeta.ts`
Today `getGeminiClient()` runs **before** `firstPageRef(file)`, so a missing `GEMINI_API_KEY` throws before the PDF page is rasterised. After conversion the client is acquired inside the wrapper, i.e. after `firstPageRef`. Same `catch`, same `META_EXTRACTION_FAILED`, same non-fatal contract — only wasted work on a misconfigured server changes.
