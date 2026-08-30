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
- [x] `SOURCE/lib/scoring/essayLifecycle.ts` (new)
- [x] `SOURCE/lib/scoring/__tests__/essayLifecycle.test.ts` (new)

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

### Investigation Targets — observations

- **backend DD § Agreement Checklist Scope (`:112`)** — the module is declared *thuần* (pure) and holds the five insert key literals plus `ESSAY_BANDS`, `ESSAY_MAX_ATTEMPTS`, `ESSAY_MAX_POINTS`, `ESSAY_PENDING_DEADLINE_MS` and the seven functions. `§ Implementation Path Mapping :355` adds the placement reason: it sits beside `computeScore.ts`/`wrongTwice.ts` because **both** the write path and the read path import it; `lib/essay/` would drag the read path into a `server-only` directory. No second module for the two array-level predicates (§ D-13).
- **backend DD § State Transitions and Invariants (`:1397`)** — RS-0…RS-6 ⇄ `deriveEssayView()` return value, row by row: RS-0/RS-1 ⇒ `null` (strange value ⇒ `null` + one `console.warn`); RS-2 `pending` when `now − createdAt ≤ deadline`; RS-3 `graded` with band + `lowConfidence`; RS-4 `failed` with `retryAvailable: true`; RS-5 stored `pending` past the deadline ⇒ `state: "failed"`, `retryAvailable: essayAttempts < 3`; RS-6 `failed` with `essayAttempts >= 3` ⇒ `retryAvailable: false`. Invariant I6: the terminal state is **derived at read time** — no cron, queue or sweeper. Invariant I7: one `deriveEssayView()`, two call sites, both passing `exam_results.created_at`.
- **backend DD § Field Propagation Map (`:1380`)** — the five insert keys travel verbatim `computeScore()` → `record_exam_result()` → jsonb (`service-role.ts:70` passes `score.perQuestion` unmodified). `essayAttempts` is **dropped at `deriveEssayView()`** — it exists only to compute `retryAvailable`. `created_at` is likewise an input to the derivation and is dropped after use; it never reaches `ExamResult`/`MyHistoryEntry`.
- **backend DD § Minimal Surface Alternatives — MSA-2 (`:845`)** — option (c) "five flat fields" was rejected precisely because it carries `essayAttempts` across the boundary. The chosen shape is one nested `essay?: EssayView`, and `EssayView` carrying no attempt field is a **structural** property, not a discipline.
- **backend DD § Hợp đồng khoá jsonb (`:664`)** — the six identifiers and their insert values; `essayGradedAt` deliberately absent at insert because a `null` there would read as "graded, time unknown". `camelCase` because `per_question` is `JSON.stringify`-ed straight from TypeScript with no `snake_case` mapping layer.
- **ADR-0018 § Decision 2 (`:78`)** — the closed band set is declared **once, in TypeScript**; the SQL functions do not validate the band at all, and that omission is deliberate (a second declaration is the two-clocks failure).
- **ADR-0018 § Decision 4 (`:94`)** — the cap is consumed at **claim** time, before the provider is contacted, and is never decremented; the initial counter is emitted by `computeScore()` at insert, which is what keeps `record_exam_result()`'s signature unchanged.
- **ADR-0018 § Implementation Guidance #8** — no background writer for stored `pending`, including "cleanup on next login". If a metric looks wrong, the metric's SQL is what changes.
- **`SOURCE/lib/scoring/computeScore.ts`** — `isScored()` returns `false` for `essay` at `:41` and stays that way; the branch B1.5 splits is the `.map()` early return at `:99-101`, which returns `{ questionId, selected, isCorrect: false, scored: false }`. That is the object `newEssayEntry()` spreads into, so the five keys must be a plain flat object with no shared reference between questions.
- **`SOURCE/types/result.ts`** — `PerQuestionResult` is a flat object shared by **every** question type, which is why the `essay` prefix is mandatory rather than decorative. `hasBeenWrongTwice` (`:19-24`) is the precedent this module follows: a field derived **at read time**, never stored, `undefined` when not applicable.
- **`SOURCE/lib/scoring/__tests__/computeScore.test.ts`** — the `essay()` fixture helper (`:68-79`) builds a `Question`; this task's fixtures build `PerQuestionResult` elements instead (the read side), so no helper is shared. `topicBreakdown` block (`:131-139`) confirms essay rows stay out of the denominator.
- **`SOURCE/lib/ugc/__tests__/geminiChokepoint.test.ts`** — the "phép quét điểm phát" technique the DD tells EG-BE-036 to copy: `walk()` over `SOURCE/**` skipping `node_modules`/`.next`, `codeLines()` dropping comment lines so a *mention* is not counted as a *site*, and an **exhaustive `toEqual([...])`** rather than `toContain`, so any new file makes the scan red.

### Open Item I-5 — settled `EssaySummary` field set

**All six fields**, exactly as the backend DD § Data Contracts declares them, and no seventh:

```ts
export interface EssaySummary {
  earned: number;          // Σ essayEarned over graded elements
  max: number;             // gradedCount * ESSAY_MAX_POINTS
  gradedCount: number;     // AC-059 denominator
  pendingCount: number;    // RS-2
  failedCount: number;     // RS-4 + RS-5 + RS-6
  unresolvedCount: number; // RS-2 + RS-4 + RS-5 (PDF gate, AC-058) — NOT RS-6
}
```

Nothing conflicts between EG-BE-034 (which pins `unresolvedCount`) and the frontend's five consumers; the DD already names one UI Spec display string per field, so no field exists without a named consumer. Settled here because every downstream consumer imports the type.

### Planned approach — Binding Decisions

- **contract_schema** — `ESSAY_BANDS = [0, 0.25, 0.5, 0.75, 1] as const` is exported from `essayLifecycle.ts` and from nowhere else; a repo grep before implementation found **0** pre-existing declarations anywhere under `SOURCE/`. The module contains no SQL and validates no band value, so this task cannot create a second declaration. ⇒ **Y**
- **data_flow** — `newEssayEntry()` emits `essayAttempts: 0` as one of exactly five keys, and `ESSAY_MAX_ATTEMPTS = 3` is exported for the claim path (H5/SVC-2c) to import rather than re-type. This task adds no signature change to `record_exam_result()`. ⇒ **Y**
- **persistence** — `deriveEssayView(entry, createdAt, now)` computes the terminal state from its three arguments only; the module has no import of `server-only`, no Supabase client, no `fetch`, no `process.env` and no write of any kind. There is no sweeper here to add. ⇒ **Y**

### Planned approach — Reference Contracts

- **Hợp đồng khoá jsonb / column-label set** — `newEssayEntry()` returns an object literal with exactly `essayState: "pending"`, `essayEarned: null`, `essayMax: null`, `essayLowConfidence: false`, `essayAttempts: 0`; `essayGradedAt` is declared once in `ESSAY_KEYS` and typed on the stored-entry shape, but is never emitted at insert. ⇒ **Y**
- **state-lifecycle-negative / `essayGradedAt` absent** — asserted directly with an exhaustive `Object.keys(newEssayEntry()).sort()` equality (not `not.toContain`, which would pass on a typo'd sixth key). ⇒ **Y**
- **EG-BE-023 / exclusive deadline** — the comparison is written `elapsedMs > ESSAY_PENDING_DEADLINE_MS`, and all three boundary inputs (`deadline − 1s`, `deadline`, `deadline + 1s`) are asserted in one test each with `now` injected. ⇒ **Y**
- **EG-BE-027 / summing** — `summariseEssays()` adds `view.earned` to `earned` and `ESSAY_MAX_POINTS` to `max` only inside the `state === "graded"` branch; `pending`/`failed`/ungradeable elements pass through no accumulator at all. ⇒ **Y**
- **EG-BE-034 / equality** — asserted in a single case over the same fixture array used by the summing case, comparing `hasUnresolvedEssay(...)` with `(summariseEssays(...)?.unresolvedCount ?? 0) > 0`, including the empty-array case where the summary is `undefined`. ⇒ **Y**
- **EG-BE-036 / one derivation site** — `isEssayIncomplete()` destructures its parameter so the body reads literally `state === "failed" && !retryAvailable`, and a `geminiChokepoint`-style exhaustive source scan asserts the matching file list is exactly `["lib/scoring/essayLifecycle.ts"]`. ⇒ **Y**
- **EG-BE-026 / no attempt count crosses the boundary** — `EssayView` declares `retryAvailable: boolean` and five fields total; the test pins the key set with an exhaustive `Object.keys().sort()` equality **and** scans every key name for `attempt`, so a field named `tries`/`retriesLeft` is caught by the first assertion and one named `essayAttempts` by the second. ⇒ **Y**

### Judgement calls made where the task file left room

1. **Shape of the six key literals.** The task says "the six jsonb key literals" without fixing whether they are six separate exports or one object. Chosen: one frozen `ESSAY_KEYS` object keyed by role (`state`, `earned`, `max`, `lowConfidence`, `attempts`, `gradedAt`), tied to the stored-entry type by `satisfies`, so a renamed field cannot leave a stale literal behind. Six loose exports would have been six import statements at every consumer for no gain.
2. **`view.earned` / `view.max` on a malformed `graded` element.** The DD's RS-3 row writes `max: 1`, but nothing says whether the view should read the stored `essayMax` or substitute `ESSAY_MAX_POINTS`. Chosen: read the stored value and return `null` when it is not a finite number — inventing a `1` there would be a silent fallback that makes a broken write look healthy. `summariseEssays()` is unaffected because the DD fixes its `max` as `gradedCount * ESSAY_MAX_POINTS` independently.
3. **`lowConfidence` on non-`graded` states.** The DD spells it `false` for RS-2 and elides it for RS-4/5/6. Chosen: `false` for every non-`graded` state, since `record_essay_grade()` is the only writer of that key and it writes it together with the band.
4. **`summariseEssays()` on an array whose only essay element carries a *strange* `essayState`.** The DD fixes `undefined` for "no element carries `essayState`" and separately maps a strange value to RS-0. Chosen: the summary is `undefined` when no element yields a view, which makes a strange value behave exactly like a legacy row — the same collapse RS-0 already performs.
5. **Scope of the two source scans.** Chosen: `codeLines()` + non-test files under `SOURCE/**`, copying `geminiChokepoint.test.ts` verbatim in technique. Test files are excluded on that file's stated reasoning (a test is not on the request path); the failure mode EG-BE-036 names — "a page re-derives RS-6" — lives in shipped code. The RS-6 regex tolerates a receiver prefix (`view.state === "failed" && !view.retryAvailable`) so a consumer cannot dodge the scan by naming a variable.

### Execution evidence

**RED (trước khi có module).** `npx vitest run lib/scoring/__tests__/essayLifecycle.test.ts` ⇒ exit **1**, `Test Files 1 failed (1)`, `Tests no tests`:

```
Error: Cannot find module '../essayLifecycle' imported from
  E:/WebApp-project/MS-MOLAR/SOURCE/lib/scoring/__tests__/essayLifecycle.test.ts
```

Đỏ vì **module chưa tồn tại** — đúng lý do cần đỏ, không phải vì một assertion viết sai.

**GREEN.** Cùng lệnh sau khi tạo module ⇒ exit **0**, `Tests 39 passed (39)`.

**Kiểm ba ca biên có thật sự phân biệt được không (mutation check).** Đổi `>` thành `>=` ở `isPastDeadline()` rồi chạy lại: `Tests 1 failed | 38 passed` — đỏ **đúng một ca**, ca `ĐÚNG BẰNG deadline ⇒ vẫn pending`. Hai ca `deadline − 1s` và `deadline + 1s` vẫn xanh dưới phép đột biến, tức là **một mình chúng không phân biệt được `>` với `>=`** — đây là lý do EG-BE-023 đòi đủ ba ca. Toán tử đã được khôi phục về `>` và bộ test xanh lại 39/39.

**Phép quét EG-BE-036.** Regex chịu tiền tố người nhận, quét mọi file `.ts/.tsx/.js/.mjs` ngoài test dưới `SOURCE/**` (bỏ dòng chú thích): kết quả `["lib/scoring/essayLifecycle.ts"]` — đúng một site. Đẳng thức là `toEqual` vét cạn, nên phép quét cũng đồng thời chứng minh biểu thức **có mặt** trong file này (một cài đặt đánh vần khác đi sẽ làm danh sách rỗng và ca đỏ).

**Phép quét sáu literal khoá.** Sáu vòng lặp riêng, mỗi khoá một phép quét: cả sáu trả `["lib/scoring/essayLifecycle.ts"]`. Không có bản sao gõ tay thứ hai nào trong cây. `ESSAY_BANDS` cũng được KHAI đúng một chỗ.

### Exit-gate re-evaluation (đối chiếu với cài đặt CUỐI, không phải với kế hoạch)

| Check | Kết quả | Bằng chứng |
|---|---|---|
| BD contract_schema — `ESSAY_BANDS` khai một chỗ | **Y** | ca `ESSAY_BANDS được KHAI đúng một chỗ`; module không chứa SQL và không validate band |
| BD data_flow — `essayAttempts: 0` + `ESSAY_MAX_ATTEMPTS` export | **Y** | ca `newEssayEntry()` + ca hằng số; `ESSAY_MAX_ATTEMPTS = 3` exported |
| BD persistence — suy diễn lúc đọc, không ghi | **Y** | ca `giá trị LƯU vẫn là pending`; ca "module là THUẦN" (không `server-only`/`process.env`/`fetch(`/`createClient`) |
| RC khoá jsonb — năm khoá insert đúng giá trị | **Y** | `toEqual` vét cạn trên `newEssayEntry()` |
| RC `essayGradedAt` vắng mặt lúc insert | **Y** | `Object.keys(...).sort()` vét cạn (không dùng `not.toContain`, vốn xanh cả khi khoá thứ sáu vào dưới tên gõ sai) |
| RC EG-BE-023 — biên loại trừ | **Y** | ba ca biên + mutation check ở trên |
| RC EG-BE-027 — chỉ `graded` vào cả hai vế | **Y** | `max: 2` (không phải 6) trên fixture bảy phần tử |
| RC EG-BE-034 — đẳng thức | **Y** | một ca, năm bộ đầu vào gồm cả mảng rỗng và dòng cũ |
| RC EG-BE-036 — một chỗ suy diễn | **Y** | phép quét ở trên |
| RC EG-BE-026 — không trường số lượt | **Y** | tập khoá vét cạn + lưới tên `/attempt\|retr(y\|ies)\|remain\|count\|left/i` + `Object.values` không chứa con số lượt |

Không dòng nào còn ở `Unknown`. Không phát sinh sai lệch nào giữa kế hoạch và cài đặt cuối.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Settle the `EssaySummary` field set (Open Item I-5) and record the decision
- [x] Write `SOURCE/lib/scoring/__tests__/essayLifecycle.test.ts` covering every Proof Obligation below, with `now` **injected** in every case
- [x] Run the tests and confirm they fail **for the right reason** (the module does not exist yet)

### 2. Green Phase
- [x] Create `SOURCE/lib/scoring/essayLifecycle.ts` with the six literals, four constants, three types and seven functions
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Run a repo scan confirming no second hand-typed copy of any of the six key strings exists
- [x] Run the EG-BE-036 source scan (`state === "failed" && !retryAvailable` appears in this file only)
- [x] Confirm the added tests still pass

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: static types; the exhaustive `EssayRenderState` switch — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Enforces: unit correctness (primary correctness-proof mechanism) — Config: `SOURCE/vitest.config.ts` (`lib/**`, `components/**`, `app/**`)
- ESLint (`--max-warnings 0`) — Enforces: lint and unused code — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Enforces: production build; catches a `server-only` import reaching a client tree — Config: `SOURCE/package.json` (project-wide)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | Chạy riêng, không nối `&&`. |
| 2 | `npx eslint --max-warnings 0` | **0** | |
| 3 | `npx vitest run` | **0** | 126 file (124 passed / 2 skipped), 1592 ca — trong đó 39 ca mới của `essayLifecycle.test.ts`. |
| 4 | `npm run build` | **0** | Bắt được lỗi ranh giới server/client mà `tsc` không thấy; module này không import `server-only` nên không lối đọc nào bị kéo vào cây server. |
| 5 | `npm run test:fixture` | **1** | expected red = TD-030 baseline only (Gate F1): exactly 2 failures, both `subscription.fixture.e2e.test.ts` FE-1(e) `en` + `vi`. **Đã đối chiếu: đúng 2 ca đó, không ca nào khác** (`2 failed | 75 passed | 3 todo`); cả hai đỏ ở `:3017` trên `aria-describedby`, không liên quan tới `lib/scoring/**`. Không sửa TD-030 trong commit này. |
| 6 | `npm run test:localdb` | **0** | `11 passed | 2 todo`; hai `todo` là khung cho Task H5/B-service, chưa thuộc task này. |

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
- [x] **Implementation Complete** = module + tests written, all green
- [x] **Quality Complete** = the six verify gates run individually with recorded exit codes
- [x] **Integration Complete** = N/A (no consumer yet — this is the slice that deliberately cannot prove itself)
- [x] Every Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Open Item I-5 settled and the `EssaySummary` field set recorded
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: every downstream task imports from this module — H5's function bodies, B1.5's `newEssayEntry()` call, B2.1/B2.2's derivations, and the four display surfaces.
- Scope boundary: `SOURCE/lib/scoring/computeScore.ts` is **not** modified here (that is B1.5 commit 1); `SOURCE/lib/scoring/wrongTwice.ts` is not touched at all by this feature.
- `ESSAY_MAX_ATTEMPTS` is the TypeScript half of the one unavoidable double declaration; the SQL half lives in `claim_essay_grading_attempt()` and the two are held together by `verify:schema`'s pin gate (Task H6), never by a third copy.
