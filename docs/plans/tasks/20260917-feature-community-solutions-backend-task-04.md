# Task 04: Server Actions/queries — `saveSolution`, `setSolutionStatus`, `getMySolutionForWriter`, `getResultCardSummary` + Integration Test 2 (Red→Green)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P1-T4
- **Phase**: 1
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P1-T4)
- **Dependencies**: task 02 (P1-T2, rate-limit keys), task 03 (P1-T3, RPCs exist on dev)
- **Provides**: `SOURCE/features/solutions/actions.ts` (`saveSolution(examId, patch)`, `setSolutionStatus(examId, action)` — the two result unions pinned below), `SOURCE/features/solutions/queries.ts` (`getMySolutionForWriter(examId) → SolutionEditorState | null`, `getResultCardSummary(examId) → ResultCardSummary | null`), `SOURCE/lib/solutions/countWords.ts`, and the **shared Server Action error mapper** tasks 15, 26 and 33 reuse — consumed by tasks 05, 08, 10, 11, 15, 18, 26, 33
- **Size**: Medium (plan list: 5 files — the 4 below plus the Server Action/mapper unit test file; plus 2 supporting files)

## Implementation Content

- `saveSolution(examId, patch)` — `requireUser()` → `guard("communitySolutionSave", uid)` → `.rpc("save_community_solution", …)` on the **session** client.
- `setSolutionStatus(examId, action)` — `requireUser()` → `guard("communitySolutionStatus", uid)` → `.rpc("set_community_solution_status", …)`.
- `getMySolutionForWriter(examId)` / `getResultCardSummary(examId)` wrap `community_solution_for_writer` / `community_solution_result_card`.
- `countWords()` is the TS twin of SQL `count_words()` — one formula, used by the client counter in task 11.
- Fill **Test 2** in the existing skeleton `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` Red→Green in this commit. Do not touch the Test 1 / Test 3 comment blocks.

### Result unions (binding, backend DD v1.9 § Main Components `actions.ts` "Result unions of the two write-screen actions"; Reference Contract Values #10, #11)

```
saveSolution(examId, patch)
  →  { ok: true, solutionId, status }
  |  { ok: false, error: { code: "rateLimited", seconds: number } | { code: "belowWordCount" } | { code: "generic" } }

setSolutionStatus(examId, action)
  →  { ok: true, status }
  |  { ok: false, error: { code: "belowWordCount", missingCount: number } | { code: "rateLimited", seconds: number } | { code: "generic" } }
```

Error mapping (deterministic — backend DD § Data Contracts "Error signalling" clauses (a)/(b)):
- **Clause (a): no code path reads `error.message`**, for any code, on either action. A message is server-log material only.
- **Clause (b): `error.details` is read for exactly one code, `23514`, on exactly these two actions.**
  - `saveSolution`: `{ code: "belowWordCount" }` **if and only if** `error.code === "23514"` **and** `error.details === "below_word_count"` (exact string equality). There is **no** `missingCount` on this action. Any other DETAIL — the `community_solution_notes` body-length CHECK's own "Failing row contains (…)" text included — is `{ code: "generic" }` (Reference Contract Value #13).
  - `setSolutionStatus`: on `error.code === "23514"`, read `error.details`, parse with `Number.parseInt(details, 10)` and require a **finite integer ≥ 1**; that value is `missingCount`. Anything else (`"0"`, `"-1"`, `""`, `"abc"`, a missing DETAIL) returns `{ code: "generic" }` rather than a guessed number (Reference Contract Value #12).
- Rate-limit rejection from `guard()` before any RPC → `{ code: "rateLimited", seconds }`; `seconds` is exactly the number `guard()` returned.
- **Every other code, every `42501`, `P0002`, `22023` and any network failure → `{ code: "generic" }`.** There is **no `notEligible` and no `hidden` result code** on either action: a hidden solution's editor has no save button at all (UI Spec `C-17`, AC-083), so the UI Spec gives those refusals no copy of their own.
- `console.error` carries the RPC name and code only — never a note body, a comment body or a report reason (backend DD § Logging and Monitoring).

### Mapper rules — `getMySolutionForWriter` (frontend DD v1.6 § Data Contracts "Writer load contract" + "Note-authoring contract" → Mapper rules; Reference Contract Values #15, #17)

- The RPC returns **exactly 7 columns**, in `SolutionEditorState`'s own declared order: `{ solution_id, attempt_id, status, show_profile, show_score, hidden_reason, questions }`. There is **no `changed_question_count` column** — the list route derives `changedQuestionCount` from `questions[].has_changed` (task 18).
- **Zero rows → `null`** (ineligible caller: no submitted attempt, exam not published, or exam author banned). The write route redirects on `null` (S11); this module never throws for it.
- The "no solution yet" row maps to `solutionId: null` **and** `status: null`. `status` is typed `SolutionStatus | null` and is `null` **if and only if** `solutionId` is `null` — never `"draft"`, never an absent key.
- Each question's `note`: SQL `null` (no note row) maps to `""` (`row.note ?? ""`), never `null` and never absent, with `wordCount` taken from the RPC's `word_count` as-is (`0` for a missing note) — the mapper does not recompute it.
- `attemptId` from `attempt_id`; `hiddenReason` from `hidden_reason` (present only when `status === "hidden"`).
- `getResultCardSummary(examId)`: zero rows → `null` (no card, no placeholder — task 08 renders the branch). This read **consumes** the one-time hard-delete reason server-side (AC-110, S20), so it has exactly one call site, `result/page.tsx`; the solutions list route must never call it (task 18 asserts that).

### Copy keys (R8, as the plan reads it for this task)

The plan (§ P1-T4) states: *"R8 applies only where the Design Doc contract carries a key. These two actions return codes; the frontend renders them (tasks 10, 11)."* So this task adds **no** `lib/copy.ts` key and returns **no** key and no Vietnamese text — only the result codes above. For reference, the owning tasks of the strings these codes become are: `solutions.bar.remaining` (task 10 renders it with `{count}` = `missingCount`, `{total}` = the screen's current question count; key owned by task 09), `solutions.note.tooShortPublished` and `solutions.note.saveError` (task 11), and the existing `profile.error.rateLimited` with `{seconds}`. Cite these by key name only, never by `lib/copy.ts` line number.

## Acceptance Criteria

From the plan (§ P1-T4): **AC-018 through AC-032 (backend-verifiable subset), AC-024, AC-029, AC-034, S1; Reference Contract Values #10–#13, #15, #17**.

Carried hard constraints that apply to this task:
- **Task 01 must have landed** (`"solutions"` in `SOURCE/eslint.config.mjs` `FEATURES`) — this is the first task that creates source files under `SOURCE/features/solutions/`.
- Every write action consumes its **existing** `RATE_LIMITS` key from task 02 (`communitySolutionSave`, `communitySolutionStatus`); `SOURCE/lib/security/rateLimit.ts` is not edited.
- Actions call `.rpc(...)` on the session client only. **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- No note body, comment body, or report reason is ever logged (backend DD § Logging and Monitoring).
- The actions return **result codes**, never literal Vietnamese text and (per the plan's R8 reading above) never a copy key.

## Target Files
- [x] `SOURCE/features/solutions/actions.ts` (new)
- [x] `SOURCE/features/solutions/queries.ts` (new)
- [x] `SOURCE/lib/solutions/countWords.ts` (new)
- [x] `SOURCE/features/solutions/__tests__/writerActions.test.ts` (new — the Server Action + mapper unit tests listed under Proof Obligations; name follows the `*Actions.test.ts` convention tasks 15/26/33 use)
- [x] `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (fill **Test 2 only**)

Supporting files:
- [x] `SOURCE/lib/solutions/__tests__/countWords.test.ts` (new — AC-023 word-count cases, UI Spec § "Cách đo" row "Đếm từ")

`SOURCE/lib/copy.ts` is **not** a target file of this task (see § Implementation Content → Copy keys).

## Investigation Targets
- `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (Test 2 skeleton annotations: `@dependency`, Primary failure mode, Proof obligation, Verification points)
- `SOURCE/features/exams/__tests__/rating.int.test.ts` (the skeleton's named precedent for filling an int test Red→Green)
- `SOURCE/features/authoring/lifecycleActions.ts` (`reportExam` — `guard()` + session client + error-code mapping convention; model only, do not import across features)
- `SOURCE/lib/security/rateLimit.ts` (`guard()` signature and return shape)
- `SOURCE/lib/copy.ts` (`MessageKey` type; existing `profile.error.rateLimited`)
- `SOURCE/lib/search/normalize.ts` (TS/SQL twin precedent for `countWords()`/`count_words()`)
- `SOURCE/supabase/schema.sql` (`count_words`, `save_community_solution`, `set_community_solution_status`, `community_solution_for_writer`, `community_solution_result_card` as applied in task 03)
- `docs/design/community-solutions-backend-design.md` (§ Main Components — `features/solutions/actions.ts` "Result unions of the two write-screen actions (binding, v1.9)" / `queries.ts`)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — "Error signalling" clauses (a)/(b))
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `save_community_solution(...)` "Save refusal carrier" and "Server Action result")
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `set_community_solution_status(p_exam_id, p_action)` "Missing-count carrier" and "Why the count is a DETAIL, not an output column")
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_solution_for_writer(p_exam_id)` "Output columns (binding, v1.8; reordered and narrowed in v1.9)")
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — rows `missing_count` → `missingCount`, `below_word_count`, `attempt_id`)
- `docs/design/community-solutions-backend-design.md` (§ Data Flow — "Writer saves a draft")
- `docs/design/community-solutions-backend-design.md` (§ Error Handling — validation (word count) and infrastructure rows)
- `docs/design/community-solutions-backend-design.md` (§ Logging and Monitoring)
- `docs/design/community-solutions-backend-design.md` (§ Verification Strategy — Early Verification Point, Slice 2)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "Save refusal token", "Publish refusal carries the missing count", "Writer payload has no `changed_question_count`")
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `attempt_answers` self-read for essay prefill)
- `docs/design/community-solutions-backend-design.md` (§ Security Considerations — every write re-derives its own eligibility gate)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — "Writer load contract", "Note-authoring contract" → Mapper rules (v1.6), `ResultCardSummary`)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — the "Mapper rule tests (v1.6)" and "`saveSolution` error-code tests (v1.6)" bullets for backend task 04)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Every new public-read RPC must re-derive its own eligibility gate inside its own body, never assume the caller already passed RLS | `actions.ts`/`queries.ts` contain no client-side eligibility shortcut that skips the RPC call, and every call routes through the RPC whose body carries the gate |

## Boundary Context
(From the work plan's Connection Map)
- **Backend masking RPCs → frontend query layer** (this task consumes `community_solution_for_writer` and `community_solution_result_card`). Serialized format: PostgREST JSON, `RETURNS TABLE` row — masked identity/score columns are JSON `null`, key always present (D003). Consumer parse rule: `toAuthorIdentity()`/`toScoreField()` treat `author_display_name===null` / `score===null` as the sole discriminant. Expected signal: the mapped TS object has no `displayName`/`avatarUrl`/`authorId` key for a masked row. (Both RPCs in this task return the caller's own data — unmasked — so this task only maps their rows into typed objects; the masking mapper itself lands in task 06.)
- **Publish refusal count (serialized)** — Producer: `set_community_solution_status`'s `23514` with `detail = v_missing_count::text` (task 03). Consumer: `setSolutionStatus` (this task) → `SolutionPublishBar` alert (task 10). Serialized format (verbatim): "Decimal string of a positive integer in the PostgREST error body's `details`, e.g. `3`". Consumer parse rule (verbatim): "Read `error.details` only when `error.code === '23514'`; `Number.parseInt(details, 10)`; finite integer ≥ 1 else `generic`". Expected signal: alert "Còn {count} câu chưa có ghi chú…" with the **server's** number, never a client recount. **This is the only serialized field crossing in the whole design.**
- **Save refusal token (serialized)** — Producer: `save_community_solution`'s `23514` with `detail = 'below_word_count'` (task 03). Consumer: `saveSolution` (this task) → `NoteSheet` alert (task 11). Serialized format (verbatim): "Literal ASCII `below_word_count` in `details`". Consumer parse rule (verbatim): "Exact string equality; the body-length CHECK's 'Failing row contains (…)' DETAIL → `generic`". Expected signal: the `solutions.note.tooShortPublished` line; the text stays in the sheet.
- **Rate-limit rejection → client copy**: Serialized format: plain number in the Server Action's JS return value. Consumer parse rule: interpolated verbatim into `profile.error.rateLimited`; input/state untouched. Expected signal: `role=alert` line with `{seconds}`; unsaved input never cleared. Roundtrip check this task must satisfy: the `seconds` value `guard()` returns is the exact number the action returns.

## Investigation Notes
(Append observations here before implementation begins. Record the resolved full copy keys and the Binding Decision Compliance Check result.)

- RPC signatures confirmed in `SOURCE/supabase/schema.sql`: `save_community_solution(p_exam_id text, p_attempt_id uuid, p_show_profile boolean, p_show_score boolean, p_notes jsonb) returns table(solution_id uuid, status text)`; `set_community_solution_status(p_exam_id text, p_action text) returns table(status text)`; `community_solution_for_writer(p_exam_id text) returns table(solution_id uuid, attempt_id uuid, status text, show_profile boolean, show_score boolean, hidden_reason text, questions jsonb)`; `community_solution_result_card(p_exam_id text) returns table(published_count int, my_status text, changed_question_count int, unseen_deletion_reason text)`. `count_words(p_text text)`: `btrim(coalesce(p_text,''))=''` → 0, else `array_length(regexp_split_to_array(btrim(p_text),'\s+'),1)` — TS twin: `text.trim() === "" ? 0 : text.trim().split(/\s+/).length`.
- `save_community_solution`'s `23514` DETAIL is the fixed token `below_word_count`; any other DETAIL (incl. the notes body-length CHECK's own Postgres-generated "Failing row contains (…)") is `generic`. Every `42501` of both write RPCs is `generic`, no DETAIL. `set_community_solution_status`'s `23514` DETAIL is `v_missing_count::text`, always ≥ 1 by construction when raised.
- Error signalling clauses (a)/(b), backend DD § Data Contracts "Error signalling": (a) no Server Action in this feature ever reads/matches/splits/interpolates `error.message`. (b) `error.details` is read for exactly code `23514`, on exactly `saveSolution` (exact-match `below_word_count` token) and `setSolutionStatus` (parse decimal via `Number.parseInt`, finite integer ≥ 1 else `generic`) — nowhere else.
- Logging rule, backend DD § Logging and Monitoring: Server Actions `console.error` only "unexpected" RPC errors — codes other than `42501`/`23505`/`23514` — with RPC name + code only, never message/body/reason content. Implemented as one shared `logUnexpectedRpcError(rpcName, error)` helper used by both action mapping functions (Refactor Phase: one mapping path per action family, no duplicated table).
- B4 (`SOURCE/eslint.config.mjs`): `features/solutions/**` may not import `features/authoring/**` (or any other feature). `features/authoring/lifecycleActions.ts`'s `reportExam` (guard() → session-client `.rpc`/`.from` → error-code switch, never `error.message`) and `internals.ts`'s `requireUser()` are **model only** — re-implemented as a small **private, unexported** `requireUser()` helper directly inside `actions.ts` (not a new `internals.ts` file — that file is not in this task's Target Files, and a private helper needs no exported-async constraint under `"use server"`). `queries.ts` does not need `requireUser()`: both RPCs re-derive `auth.uid()` internally and already return zero rows for an unauthenticated/ineligible caller, which this module maps to `null` uniformly (no separate auth branch needed) — mirrors `getMyRating`'s "throws on infra error, no auth check of its own" precedent in `rating.int.test.ts`.
- `SolutionEditorState`'s `stemNode`/`correctAnswerNode`/`myResultNode` (frontend DD § "Note-authoring contract") are `ReactNode` — rendering markdown to `ReactNode` is a frontend-rendering concern with no Investigation Target, Required-test-list row, or Reference Contract in *this* task pointing at it, and no shared (non-feature-scoped) rendering helper was found reachable without a B4 cross-feature import (`features/exams/components/questionNodes.tsx` is feature-scoped to `exams`). This task's own binding "Mapper rules" section (§ Implementation Content) is narrower and covers only `note`/`wordCount`/`attemptId`/`hiddenReason`/`status`/`solutionId` mapping — no rendering. Resolution: `queries.ts`'s `SolutionEditorState`/question type carries the raw `stem`/`correctAnswer`/`myResult` values unrendered (plain data), deferring `ReactNode` production to the owning frontend task (frontend DD names frontend task 10 as the write-route page owner). This is a scope-narrowing concretization, not a contract violation — no test in this task's Required test list or mapper-cases table exercises these three fields.
- Copy keys: this task adds **zero** entries to `SOURCE/lib/copy.ts` and returns **zero** copy keys — confirmed no `lib/copy.ts` target file, per § Implementation Content → Copy keys. The owning keys for later rendering are (by name only): `solutions.bar.remaining` (task 10, `{count}`=`missingCount`), `solutions.note.tooShortPublished` / `solutions.note.saveError` (task 11), existing `profile.error.rateLimited` (`{seconds}`).
- Mock boundary: unit tests (`writerActions.test.ts`, `countWords.test.ts`) and Test 2 of `communitySolutions.int.test.ts` mock only `@/lib/supabase/server`'s `createClient()` (session client `.rpc`/`auth.getUser`), per the skeleton's own Mock Boundary Decision. `guard()`/`checkRateLimit()` run for real (not mocked) — the rate-limited test row exhausts the real in-memory counter directly via `guard()` calls under frozen fake timers (`vi.useFakeTimers()`) so the seconds the action returns can be compared byte-for-byte against a second real `guard()` call at the same frozen instant (Boundary Context roundtrip check).

### Binding Decision Compliance Check
- Row 1 (ADR-0021 § Implementation Guidance, dependency_direction — every new public-read RPC re-derives its own eligibility gate, never assumes RLS already passed): Planned approach — `getMySolutionForWriter`/`getResultCardSummary` call `.rpc("community_solution_for_writer"|"community_solution_result_card", { p_exam_id })` only; no `.from("community_solutions"|...)` shortcut is added anywhere in `queries.ts`/`actions.ts`, and both RPC bodies (read above from `schema.sql`) re-run their own `exams.status='published' and not is_author_banned(...)` + submitted-attempt checks internally. Evaluation: **Y** — every read/write in this task routes through one of the four RPCs named in Target Files/Implementation Content; no direct table select/update is introduced for solution data.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Write `countWords.test.ts` with the AC-023 cases; confirm it fails
- [x] Replace the Test 2 comment block's runner section with real imports + `describe`/`it` + assertions per its Verification points (mocked session client returning a simulated `23514`, then a simulated infra error); confirm it fails because `actions.ts` does not exist
- [x] Write the full unit-test list below (§ Required test list) in `writerActions.test.ts`; confirm every case fails
- [x] Add unit cases for Failure Modes #1–#4 (see Proof Obligations); confirm they fail

### Required test list (binding — backend DD § Integration Verification Points "Save refusal token"; frontend DD § Test Boundaries, backend task 04)

`.rpc()` is mocked at the Supabase client boundary and fed **literal** error objects; no test constructs a `PostgrestError` from a message.

| # | Call | Mocked `.rpc()` result | Expected return |
|---|---|---|---|
| 1 | `saveSolution` | `{ code: "23514", details: "below_word_count" }` | `{ ok: false, error: { code: "belowWordCount" } }` — assert `"missingCount" in error` is `false` |
| 2 | `saveSolution` | `{ code: "23514", details: "Failing row contains (…)" }` | `{ code: "generic" }` (the notes body-length CHECK) |
| 3 | `saveSolution` | `{ code: "23514", details: "" }` | `{ code: "generic" }` |
| 4 | `saveSolution` | `{ code: "23514", details: "", message: "note below 15 words" }` (message contains "15 words", DETAIL empty) | `{ code: "generic" }` — proves the message is not read |
| 5 | `saveSolution` | `{ code: "", details: "", message: "below_word_count" }` (**message-only literal**) | `{ code: "generic" }` — clause (a) |
| 6 | `saveSolution` | `{ code: "42501", … }` | `{ code: "generic" }` |
| 7 | `saveSolution` | `guard()` rejects | `{ code: "rateLimited", seconds }` with `seconds` equal to `guard()`'s number, and `.rpc` call count `0` |
| 8 | `setSolutionStatus` | `{ code: "23514", details: "3" }` | `{ ok: false, error: { code: "belowWordCount", missingCount: 3 } }` |
| 9 | `setSolutionStatus` | `{ code: "23514", details: "0" }` / `"-1"` / `""` / `"abc"` (four cases) | `{ code: "generic" }` each — `Number.parseInt(details, 10)` + finite integer ≥ 1, verbatim from Reference Contract Value #12 |
| 10 | `setSolutionStatus` | `{ code: "42501" }` / `{ code: "P0002" }` / `{ code: "22023" }` | `{ code: "generic" }` each |
| 11 | any | — | **No input produces `notEligible` or `hidden`** (assert the union's codes over the whole suite) |

Mapper cases (`.rpc()` mocked with literal rows):

| # | Row | Expected mapping |
|---|---|---|
| 12 | writer row whose `questions` has one entry `{ note: null, word_count: 0 }` and one `{ note: "abc", word_count: 1 }` | `note: ""` / `wordCount: 0` and `note: "abc"` / `wordCount: 1`; assert `typeof q.note === "string"` for **both** |
| 13 | the "no solution yet" row (`solution_id: null, status: null`) | `solutionId: null` **and** `status: null` — not `"draft"`, not an absent key |
| 14 | zero rows from `community_solution_for_writer` | `getMySolutionForWriter` returns `null` (no throw) |
| 15 | zero rows from `community_solution_result_card` | `getResultCardSummary` returns `null` (no throw) |

### 2. Green Phase
- [x] Implement `countWords.ts`, `actions.ts`, `queries.ts`; add missing copy keys (none needed — this task returns codes only, § Implementation Content → Copy keys)
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] Keep one error-mapping function per action family; no duplicated mapping tables
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` (vitest default lane) — Enforces: unit/integration tests incl. `features/**`, `lib/**` — Config: `SOURCE/vitest.config.ts`
- `npm run lint` (eslint `--max-warnings 0`, incl. B4) — Enforces: no cross-feature import from `features/solutions/` — Config: `SOURCE/eslint.config.mjs`
- `npx tsc --noEmit` — Enforces: RPC-return types — Config: `SOURCE/tsconfig.json`
- `serviceRoleSurface.test.ts` — Enforces: `service-role.ts` surface frozen — Config: `SOURCE/lib/supabase/__tests__/serviceRoleSurface.test.ts`
- Commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: from this task on, `npm test` runs without an exclude (Test 2 gives the int skeleton its first real suite). Until task 23 run `test:fixture` as `npx vitest run --config vitest.fixture.config.ts --exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"`; until task 47 run `test:localdb` as `npx vitest run --config vitest.localdb.config.ts --exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"`.

## Operation Verification Methods
- **Verification method**: run `npm test` from inside `SOURCE/`; confirm Test 2 and the new unit tests pass; `grep -n "service-role" SOURCE/features/solutions/actions.ts SOURCE/features/solutions/queries.ts` returns nothing; `grep -n "error\.message\|err\.message" SOURCE/features/solutions/actions.ts SOURCE/features/solutions/queries.ts` returns nothing (clause (a)).
- **Success criteria**: Test 2's verification points all hold (the simulated `23514` maps to the pinned AC-029 result `{ code: "belowWordCount", missingCount }` rather than a raw Postgres code/string; the simulated infra error maps to the distinct `generic` result; the note text passed in is untouched on both failure branches); all 15 rows of § Required test list pass; `countWords` AC-023 cases pass; no service-role import.
- **Failure response**: if Test 2 can only pass by asserting on a raw Postgres code/string, or if any case can only pass by reading `error.message`, stop — the mapping is wrong, not the test.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (skeleton Test 2, verbatim): "assert the mapped result object for the simulated 23514 case carries the AC-029 message key/copy — not the raw Postgres error code/string; assert the simulated infra-error case carries a different, generic message key; assert neither failure branch's return value or side effect references clearing/resetting the note text parameter."
- **v1.3 reading of "message key/copy" (plan § P1-T4, binding)**: the AC-029 "message key/copy" is carried by the pinned result code `{ code: "belowWordCount", missingCount }`, which task 10 renders through `solutions.bar.remaining` (Reference Contract Value #27). Test 2 asserts the **result code and count**, not a copy key string, because this action returns codes (§ Implementation Content → Copy keys).
- **Primary failure mode** (skeleton): "a 9-word note is allowed to publish because the server's 23514 response is swallowed or mis-mapped to a generic message instead of the AC-029 'chưa đạt' wording, or the caller's typed note text is cleared on the failed-publish branch."
- **Boundary to exercise**: `features/solutions/actions.ts` public functions against a mocked session Supabase client.
- **State assertion**: the note-text argument passed in is deep-equal before and after each failing call.
- **Mock boundary rationale**: session client mocked per the skeleton's Mock Boundary Decision; the real `count_words()` evaluation and whole-call rollback are proven in task 05 and task 47 (SE1).
- **Residual**: no real-DB proof in this task.

- **Claim** (Failure Mode #1, same-value / AC-031): saving a note with unchanged text is idempotent — a second identical `saveSolution` call returns success and produces the same result shape as the first.
- **Primary failure mode**: a repeat save with identical text is reported as an error or triggers a different result shape.
- **Boundary to exercise**: `saveSolution` against the mocked session client returning the same RPC response twice.
- **State assertion**: result of call 1 deep-equals result of call 2.
- **Mock boundary rationale**: session client mocked; DB-level idempotency is proven in task 05.
- **Residual**: none beyond the real-DB half.

- **Claim** (Failure Mode #2, no-op): calling publish on an already-published solution is re-entrant and returns success, not an error.
- **Primary failure mode**: a double-click on "Đăng" surfaces an error to the user.
- **Boundary to exercise**: `setSolutionStatus(examId, "publish")` with a mocked RPC response for an already-published row.
- **State assertion**: N/A (mocked).
- **Mock boundary rationale**: session client mocked.
- **Residual**: real re-entrancy of `set_community_solution_status` proven in task 05.

- **Claim** (Failure Mode #3, empty input / AC-024): a 0-word note is accepted on a draft and rejected on publish with `{ code: "belowWordCount", missingCount }`; `countWords("")` returns 0.
- **Primary failure mode**: empty notes are either rejected on draft save or let through on publish.
- **Boundary to exercise**: `countWords` (in-process unit) + `setSolutionStatus` error mapping.
- **State assertion**: N/A.
- **Mock boundary rationale**: session client mocked.
- **Residual**: DB CHECK enforcement proven in task 05.

- **Claim** (Failure Mode #4, invalid option): `setSolutionStatus` accepts only `"publish" | "draft"`; any other value is rejected before an RPC call.
- **Primary failure mode**: an arbitrary action string reaches the RPC.
- **Boundary to exercise**: `setSolutionStatus` input validation.
- **State assertion**: mocked client `.rpc` call count is 0 for an invalid action.
- **Mock boundary rationale**: session client mocked.
- **Residual**: the RPC's own `p_action` check is proven on real DB in task 05.

## Completion Criteria
- [x] All added tests pass (Test 2, the 15 rows of § Required test list, countWords, failure-mode unit cases)
- [x] Neither `actions.ts` nor `queries.ts` reads `error.message`; neither returns a `notEligible` or `hidden` code
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met: the test turns red under its primary failure mode and exercises the stated boundary
- [x] Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Test 1 and Test 3 comment blocks in the int skeleton are unchanged

## Notes
- Impact scope: tasks 08, 10, 11 consume these functions; task 05 proves their RPCs on real DB.
- Scope boundary: do not edit `SOURCE/lib/security/rateLimit.ts` or `SOURCE/lib/supabase/service-role.ts`.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
