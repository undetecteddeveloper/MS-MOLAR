# Task H1 — `lib/scoring/essayLifecycle.ts` + unit tests (RED first)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H1**
Layer: **backend** (`SOURCE/lib/scoring/**`)

Metadata:
- Dependencies: **Task G0.5** (TD-030 baseline captured before the first commit, or Gate E5's exit code is uninterpretable).
- Blocks: Tasks **H3** (`ESSAY_BANDS`), **H5** (key literals and the attempt cap must be settled before the SQL function bodies are written), **B1.1**, and every consumer of the six key literals.
- Provides: the single declaration of all six jsonb key literals, the four constants, the three types and the seven functions — everything else imports from here so no key string is ever hand-typed twice.
- Size: Small (2 files)
- Verification level: **L2** (pure functions with tests; nothing runs end to end in this phase, deliberately).

## Implementation Content

Create `SOURCE/lib/scoring/essayLifecycle.ts` as a **pure** module — no I/O, no `process.env`, no `server-only` — containing:

- **The six jsonb key literals**: `essayState`, `essayEarned`, `essayMax`, `essayLowConfidence`, `essayAttempts`, `essayGradedAt`.
- **The constants**: `ESSAY_BANDS = [0, 0.25, 0.5, 0.75, 1]`, `ESSAY_MAX_ATTEMPTS = 3`, `ESSAY_MAX_POINTS`, `ESSAY_PENDING_DEADLINE_MS = 600_000`.
- **The types**: `EssayRenderState`, `EssayView`, `EssaySummary`.
- **The functions**: `newEssayEntry()`, `deriveEssayView(entry, createdAt, now)`, `summariseEssays(rows, createdAt, now)`, `isEssayUnresolved(view)`, `isEssayIncomplete(view)`, `hasUnresolvedEssay(rows, createdAt, now)`, `hasIncompleteEssay(rows, createdAt, now)`.

Write the tests **first** and confirm they fail for the right reason.

### Contract decisions that are not open
- `isEssayIncomplete(view: EssayView)` keeps the **narrow** signature — it is **not** widened to `| undefined`. `null` means "not applicable", not "not incomplete", and the narrow signature is a deliberate barrier stopping pages from re-deriving instead of reading the published field.
- `EssayView` carries **no** attempt-count field of any name (MSA-2 / AC-044) — the client receives a boolean `retryAvailable`, and the count cannot cross the boundary because there is nothing to carry it.

### Time control
`now` is always **injected**, never `Date.now()` — a real clock turns every deadline test into a time bomb.

### Open Item I-5 (settle it here, once)
`EssaySummary`'s exact field set is stated in no single place: EG-BE-034 pins `unresolvedCount`, while the frontend consumes `pendingCount`, `failedCount`, `gradedCount`, `earned` and `max`. Nothing conflicts — this task exports **all six**. Settle the shape here, since every downstream consumer imports it. *Owner: engineer, at this task.*

## Target Files
- [ ] `SOURCE/lib/scoring/essayLifecycle.ts` (new)
- [ ] `SOURCE/lib/scoring/__tests__/essayLifecycle.test.ts` (new)

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Agreement Checklist Scope — the `essayLifecycle.ts` line)
- `docs/design/essay-auto-scoring-backend-design.md` (§ State Transitions and Invariants — EG-BE-007; RS-0…RS-6 as outputs of `deriveEssayView()`)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Field Propagation Map — `essayState`/`essayEarned`/`essayMax`/`essayLowConfidence`/`essayAttempts`/`essayGradedAt` across `computeScore` → jsonb → `deriveEssayView` → four surfaces)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Minimal Surface Alternatives — MSA-2: `EssayView` carries **no** attempt-count field)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Hợp đồng khoá jsonb — the six keys and their insert values)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decision 2 and Decision 4)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — item #8: no background writer, the final state is a read-time derivation)
- `SOURCE/lib/scoring/computeScore.ts` (`isScored()` at `:40-41`; the `.map()` callback's early return at `:99-101` — the branch Task B1.5 splits, and the shape this module must serve)
- `SOURCE/types/result.ts` (`PerQuestionResult`, and the `hasBeenWrongTwice` precedent at `:19-24`)
- `SOURCE/lib/scoring/__tests__/computeScore.test.ts` (the `essay()` fixture helper at `:68-79`, and the `topicBreakdown` block at `:131-139`)

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| backend DD (§ Hợp đồng khoá jsonb) | column/label set and order | `essayState` (`"pending" \| "graded" \| "failed"`, insert value `"pending"`), `essayEarned` (`number \| null`, insert `null`), `essayMax` (`number \| null`, insert `null`), `essayLowConfidence` (`boolean`, insert `false`), `essayAttempts` (`number` int, insert `0`), plus the sixth key `essayGradedAt` (`string` ISO 8601, **absent** at insert) | `newEssayEntry()` emits exactly the five insert keys with those exact values and types, and `essayGradedAt` is declared but not emitted at insert |
| backend DD (§ Hợp đồng khoá jsonb) | state-lifecycle-negative | "`essayGradedAt` **cố ý không** có mặt lúc insert: nó là dấu thời gian của một sự kiện chưa xảy ra, và một `null` ở đó sẽ ngụ ý 'đã chấm, không rõ lúc nào'." | `Object.keys(newEssayEntry(...))` does **not** contain `essayGradedAt` |
| backend DD (§ EG-BE-023) | derived-display | "Với `essayState = 'pending'` đã lưu và `now() − created_at` bằng `deadline − 1s`, `deadline`, `deadline + 1s`, hàm suy diễn **phải** trả lần lượt `pending`, `pending`, `failed`. Biên là **loại trừ** (`>`)." | The three boundary cases return `pending`, `pending`, `failed` and the comparison operator is `>` |
| backend DD (§ EG-BE-027) | derived-display | "**Trong khi** tính tổng điểm tự luận, chỉ câu ở `graded` **phải** đóng góp vào **cả hai** vế earned và max; `pending`, `failed` và câu không chấm được đóng góp **0 vào cả hai**." | `summariseEssays()` adds to `earned` and `max` only for `graded` elements |
| backend DD (§ EG-BE-034) | derived-display | "`hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`" | The equality holds over the same fixture set, asserted in one case |
| backend DD (§ EG-BE-036) | state-lifecycle-negative | "RS-6 **phải** được suy ra ở **đúng một chỗ**: biểu thức `state === \"failed\" && !retryAvailable` **phải không** xuất hiện ở bất kỳ file nào ngoài `SOURCE/lib/scoring/essayLifecycle.ts`." | A source scan finds the expression in this file only |
| backend DD (§ EG-BE-026) | state-lifecycle-negative | "Giá trị `retryAvailable` mà client nhận **phải** là một boolean, và payload gửi xuống client **phải không** chứa `essayAttempts` dưới bất kỳ tên nào." | `EssayView` declares `retryAvailable: boolean` and declares no attempt-count field under any name |

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | The closed band set `{0, 0.25, 0.5, 0.75, 1}` is declared **once, in TypeScript**; the SQL functions do not validate the band value at all, and that omission is deliberate | `ESSAY_BANDS` is declared in this file and nowhere else in the repository |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time, before the provider is contacted, and is never decremented. The initial counter value is emitted by `computeScore()` at insert, so `record_exam_result()`'s signature does not change | `newEssayEntry()` emits `essayAttempts: 0`, and `ESSAY_MAX_ATTEMPTS` is exported for the claim path to read |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | persistence | No background writer for stored `pending`, including "cleanup on next login" — no cron, no queue, no sweeper. The final state is a read-time derivation | `deriveEssayView()` computes the terminal state from `(entry, createdAt, now)` and this module writes nothing |

## Boundary Context (from the work plan's Connection Map)

| Boundary | `ESSAY_MAX_ATTEMPTS` (TypeScript) → the cap literal inside `claim_essay_grading_attempt()` |
|---|---|
| Owner (left) | `SOURCE/lib/scoring/essayLifecycle.ts` |
| Owner (right) | `schema.sql`'s function body |
| Serialized format | Integer, one declaration each side — the one unavoidable double declaration (ADR-0018 fixed the two-parameter signature) |
| Consumer parse rule | `verify-schema.ts` regex-extracts the literal from the function body and compares it to the imported constant |
| Expected signal | The pin gate fails with a message naming **both** values; SVC-2(c) uses the imported constant, never a typed `3`, so this does not become a third copy |

## Investigation Notes
_(Record here: the settled `EssaySummary` field set (I-5); the observed RED failure of each test before implementation; the result of the EG-BE-036 source scan.)_

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [ ] Read all Investigation Targets and record key observations
- [ ] Settle the `EssaySummary` field set (Open Item I-5) and record the decision
- [ ] Write `SOURCE/lib/scoring/__tests__/essayLifecycle.test.ts` covering every Proof Obligation below, with `now` **injected** in every case
- [ ] Run the tests and confirm they fail **for the right reason** (the module does not exist yet)

### 2. Green Phase
- [ ] Create `SOURCE/lib/scoring/essayLifecycle.ts` with the six literals, four constants, three types and seven functions
- [ ] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [ ] Run a repo scan confirming no second hand-typed copy of any of the six key strings exists
- [ ] Run the EG-BE-036 source scan (`state === "failed" && !retryAvailable` appears in this file only)
- [ ] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: static types; the exhaustive `EssayRenderState` switch — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit correctness (primary correctness-proof mechanism) — Config: `SOURCE/vitest.config.ts` (`lib/**`, `components/**`, `app/**`)
- ESLint (`--max-warnings 0`) — Enforces: lint and unused code — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: production build; catches a `server-only` import reaching a client tree — Config: `SOURCE/package.json` (project-wide)

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
- **Verification method**: run the new unit suite with `now` injected and frozen; assert `deriveEssayView()` over the three deadline boundary inputs and `summariseEssays()` over a fixture carrying one `graded`, one `pending` and one `failed` element; run the two source scans (no second copy of a key literal; the RS-6 expression in this file only).
- **Success criteria**: the three boundary cases return `pending`, `pending`, `failed`; EG-BE-034's equality holds over the same fixtures in one case; both source scans find exactly one site.
- **Failure response**: if the deadline boundary returns `failed` at exactly `deadline`, the comparison is `>=` where it must be `>` — fix the operator, do not adjust the fixture. If a source scan finds a second site, delete the copy rather than widening the scan.
- **Verification level**: **L2** — new tests added and passing. This is the slice that deliberately cannot prove itself end to end; there is no consumer yet.

## Proof Obligations
- **Claim (EG-BE-023)**: with `essayState = 'pending'` stored and `now − created_at` at `deadline − 1s`, `deadline`, `deadline + 1s`, the derivation returns `pending`, `pending`, `failed`; the boundary is **exclusive** (`>`).
  - **Primary failure mode**: `>=` instead of `>` at the deadline boundary, which flips one of the three cases and is invisible without all three.
  - **Boundary to exercise**: in-process unit, with `now` injected.
  - **State assertion**: N/A (pure derivation over stored input).
  - **Mock boundary rationale**: none — the clock is a parameter, not a dependency.
  - **Residual**: proves the derivation. Does not prove any caller passes the right `createdAt` — that is B2.1/B2.2.
- **Claim (EG-BE-024)**: a missing `essayState` key ⇒ `null`, and **no** log.
  - **Primary failure mode**: a legacy row (no essay keys at all) produces a warning per question per render.
  - **Boundary to exercise**: in-process unit with a spied `console.warn`.
  - **State assertion**: N/A. **Mock boundary rationale**: `console.warn` spied, nothing else. **Residual**: none.
- **Claim (EG-BE-025 / Failure Mode Checklist: invalid option)**: an unrecognised `essayState` value ⇒ `null` **and exactly one** server-side `console.warn` carrying **only** `questionId` and the strange value — never the student's answer.
  - **Primary failure mode**: the warning carries the whole entry, so student prose reaches the server log.
  - **Boundary to exercise**: in-process unit with a spied `console.warn`; assert the call count is 1 and the payload's key set.
  - **State assertion**: N/A. **Mock boundary rationale**: `console.warn` spied. **Residual**: none.
- **Claim (EG-BE-027)**: only `graded` contributes to **both** earned and max; `pending`, `failed` and ungradeable contribute **0 to both**.
  - **Primary failure mode**: a failed essay contributes 0 to earned and 1 to max — the silent zero AC-015 forbids.
  - **Boundary to exercise**: in-process unit over a mixed fixture. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: the arithmetic is re-proven end-to-end by INT-3(d) in Task B2.4.
- **Claim (EG-BE-034)**: `hasUnresolvedEssay(...) === (summariseEssays(...)?.unresolvedCount ?? 0) > 0`, over the same fixtures, in one case.
  - **Primary failure mode**: two independent derivations of "unresolved" that disagree on the empty case. **Boundary to exercise**: in-process unit. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: none.
- **Claim (EG-BE-036)**: `state === "failed" && !retryAvailable` exists **only** in this file, asserted by a source scan (same technique as the emission scan).
  - **Primary failure mode**: a page re-derives RS-6 locally, and the two derivations drift so the PDF annotation and the screen disagree. **Boundary to exercise**: a repository source scan. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: the scan proves the expression's absence, not that no consumer derives RS-6 by a differently-spelled equivalent.
- **Claim (RS-0…RS-6)**: each render state is mapped from `deriveEssayView()`'s return value.
  - **Primary failure mode**: a second hand-typed copy of a key string somewhere else in the tree. **Boundary to exercise**: in-process unit plus a repo scan for the six literals. **State assertion**: N/A. **Mock boundary rationale**: none. **Residual**: none.

## Completion Criteria
- [ ] **Implementation Complete** = module + tests written, all green
- [ ] **Quality Complete** = the six verify gates run individually with recorded exit codes
- [ ] **Integration Complete** = N/A (no consumer yet — this is the slice that deliberately cannot prove itself)
- [ ] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [ ] Open Item I-5 settled and the `EssaySummary` field set recorded
- [ ] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: every downstream task imports from this module — H5's function bodies, B1.5's `newEssayEntry()` call, B2.1/B2.2's derivations, and the four display surfaces.
- Scope boundary: `SOURCE/lib/scoring/computeScore.ts` is **not** modified here (that is B1.5 commit 1); `SOURCE/lib/scoring/wrongTwice.ts` is not touched at all by this feature.
- `ESSAY_MAX_ATTEMPTS` is the TypeScript half of the one unavoidable double declaration; the SQL half lives in `claim_essay_grading_attempt()` and the two are held together by `verify:schema`'s pin gate (Task H6), never by a third copy.
