# Task 14: `queries.ts` — `listSolutions`, `getSolutionDetail` + Integration Test 3 (Red→Green)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P2-T2
- **Phase**: 2
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P2-T2)
- **Dependencies**: task 06 (P1-T6, `identity.ts`), task 13 (P2-T1)
- **Provides**: `listSolutions(examId)` → `SolutionListItem[]`, `getSolutionDetail(solutionId)` → `SolutionDetail | null`, consumed by tasks 17–21, 23, 24
- **Size**: Small (3 files)

## Implementation Content

- `listSolutions(examId)` → exactly one `.rpc("community_solutions_list", { p_exam_id })`.
- `getSolutionDetail(solutionId)` → exactly one `.rpc("community_solution_detail", { p_solution_id })`.
- Never `.from("community_solutions" | "community_solution_notes" | "community_solution_comments").select(...)`.
- Every row — the list rows, the detail header, **and each nested per-question comment row** — passes through `toAuthorIdentity` / `toScoreField` before leaving this module. (Comment rows exist in the detail shape from task 13; real comment rows arrive only once task 25's `post_community_comment` RPC lands, but the mapping path is built and tested now.)
- Ineligible/nonexistent → the RPC returns an empty result; `getSolutionDetail` returns `null` and `listSolutions` returns `[]` so the route can redirect (S11/AC-063), never throw.
- Rows keep the server order verbatim; no client-side sort.
- Fill **Test 3** in `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts`; leave Test 1's comment block untouched.

### Mapper rules (binding — backend DD v1.9 § Data Contracts `community_solutions_list` / `community_solution_detail` "Output columns"; frontend DD v1.6 § Data Contracts `SolutionListItem` / `SolutionDetail`)

- **Score pair.** `score` SQL `null` ⇒ **both** `score` and `scoreGrading` are **absent** keys (`toScoreField`'s one null-to-absent convention). Never `score: null`, never `scoreGrading` without `score`. `score_grading` is `null` exactly when `score` is (Reference Contract Value #18's producer side).
- **Score-gated per-question fields (frontend DD v1.6).** The header's `per_question` column is the single source of `writerChoiceNode?`, `result?`, `notAutoScored?` and `essayScore?`. When `per_question` is SQL `null` — i.e. whenever `score` is absent — **all four keys are absent on every question**. The mapper never writes `notAutoScored: false` or any other stand-in (Reference Contract Value #19).
- **Comment count.** A question's `comment_count` SQL `null` ⇒ the `note.commentCount` key is **dropped**, never `0`. A `comment_count` of `0` is a real value and is kept: it means "the comment surface exists and no visible comment is under it yet" (Reference Contract Value #20). `comments` is `[]` whenever `commentCount` is absent.
- **`i_reported` → `iReported`** on the detail header **and on every comment entry**: a **required** `boolean`, never optional and never dropped — `false` is the meaningful "not yet reported" value.
- `is_hidden_by_admin` / `hidden_reason` → optional `isHiddenByAdmin?` / `hiddenReason?`: the mapper drops the backend's `false` / `null`, so the keys appear only on the comment author's own hidden row.
- `helpful_count` / `i_marked_helpful` → required `helpfulCount` / `iMarkedHelpful`; `is_pinned` → `isPinned`; `is_mine` → `isMine`; `updated_at` / `created_at` pass through as ISO 8601 strings.
- Identity columns (`author_id`, `author_display_name`, `author_avatar_path` → the signed `author_avatar_url`) go through `toAuthorIdentity` only; masking follows `show_profile` alone, with **no self-exception** — the writer's own anonymous row maps to `{ kind: "anonymous" }` with `isMine: true` (AC-062).
- The detail's column sets are the 14 header / 7 per-question / 11 per-comment lists of Reference Contract Value #14; set equality on the real RPC is proven in task 16, not here.

## Acceptance Criteria

From the plan (§ P2-T2): **AC-039, AC-040, AC-041, AC-048, AC-060, AC-105 (mapping-layer half); Reference Contract Values #14, #19, #20**.

Carried hard constraints that apply to this task:
- Session client only; **TD-029**: zero imports of `@/lib/supabase/service-role`; zero exported operations or direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.
- `lib/solutions/identity.ts` is the only place null-to-absent normalization happens.

## Target Files
- [x] `SOURCE/features/solutions/queries.ts` (extend)
- [x] `SOURCE/features/solutions/__tests__/solutionReadMappers.test.ts` (new — the mapper unit cases listed under § Required test list)
- [x] `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (fill **Test 3**)

## Investigation Targets
- `SOURCE/features/solutions/__tests__/communitySolutions.int.test.ts` (Test 3 annotations; Test 2 as filled in task 04 for the runner shape)
- `SOURCE/features/solutions/queries.ts` (task 04 functions and client helper)
- `SOURCE/lib/solutions/identity.ts` (task 06)
- `SOURCE/supabase/schema.sql` (`community_solutions_list`, `community_solution_detail` return shapes from task 13)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `community_solutions_list(p_exam_id)` "Output columns" and "Score-grading condition"; `community_solution_detail(p_solution_id)` "Output columns (binding, v1.9)" — the 14 / 7 / 11 lists, "Comment count presence condition", "Comment row condition", "Hidden-comment columns")
- `docs/design/community-solutions-backend-design.md` (§ Field Propagation Map — rows `score` / `per_question`, `comment_count`, `score_grading`, `i_reported`, `is_hidden_by_admin` / `hidden_reason`)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — "Detail payload column enumeration (v1.9)", proven in task 16, not here)
- `docs/design/community-solutions-backend-design.md` (§ Security Considerations — identity masked at SQL projection layer only)
- `docs/design/community-solutions-frontend-design.md` (§ Data Contracts — `SolutionListItem` / `SolutionDetail`, incl. the "Score-gated per-question fields (v1.6, mapper rule)" invariant)
- `docs/design/community-solutions-frontend-design.md` (§ Test Boundaries — the "Mapper rule tests (v1.6)" bullet for backend task 14)
- `docs/design/community-solutions-frontend-design.md` (§ Field Propagation Map — `author_id`/`author_display_name`/`author_avatar_path` masking (D003); `score`/`per_question` absent-not-null)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `user_profiles` cross-user read; `exam_results` cross-user read (show_score))
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Decision) | contract_schema | No `SELECT` grant to `anon`/`authenticated` on any new content table; every public read goes through a `SECURITY DEFINER` function projecting `case when <show-flag> then <column> end` | `queries.ts` contains zero `.from("community_solutions")`, `.from("community_solution_notes")`, `.from("community_solution_comments")` calls; every public read is an `.rpc(...)` |
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | contract_schema | Every identity-bearing column returned to a non-author/non-admin caller must be produced by a `case when <visibility flag> then <column> end` expression, never a raw column reference — including any read path added later | Every identity-bearing field leaving `queries.ts` is produced by `toAuthorIdentity`/`toScoreField`, never copied from a raw row field |

## Reference Contracts

(Contract Type is derived during decomposition — the work plan's Reference Contract Values table has no Contract Type column.)

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solutions_list`) | structure-order | `order by cs.is_pinned desc, coalesce(h.helpful_count, 0) desc, cs.updated_at desc, cs.id` | `listSolutions` returns rows in the exact order the RPC returned them (no `.sort`, no re-grouping) |
| `docs/design/community-solutions-frontend-design.md` (§ Main Components `lib/solutions/identity.ts`) | state-lifecycle-negative | "Returns `{ kind: 'anonymous' }` iff `author_display_name` is null... `avatarUrl` passes `row.author_avatar_url` through as-is for every named row, self or non-self" | For a masked fixture row the mapped item's identity is exactly `{kind:"anonymous"}`; for a named row `avatarUrl` equals the fixture value |
| `docs/design/community-solutions-frontend-design.md` (§ Main Components `lib/solutions/identity.ts`) | state-lifecycle-negative | "Deletes the `score` key entirely when `row.score` is null; never emits `score: null`." | For a `score: null` fixture row the mapped item has no `score` key |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` "Output columns (binding, v1.9)"; Reference Contract Value #14) | structure-enumeration | Header keys `{id, author_id, author_display_name, author_avatar_path, is_pinned, updated_at, score, score_grading, per_question, is_mine, helpful_count, i_marked_helpful, i_reported, questions}`; per-question keys `{question_id, stem, correct_answer, has_changed, note, comment_count, comments}`; per-comment keys `{id, author_id, author_display_name, author_avatar_path, is_solution_author, is_mine, body, is_hidden_by_admin, hidden_reason, i_reported, created_at}` | The fixture rows this task's tests use carry exactly these key sets, so a mapper that reads a column the RPC does not return fails here; set equality against the **live** RPC is task 16's case |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` (`per_question`); Reference Contract Value #19) | state-lifecycle-negative | "When this column is SQL `null`, the mapper leaves all four keys absent on every question and never writes a stand-in such as `notAutoScored: false`." | For a `per_question: null` fixture, `"writerChoiceNode" in q`, `"result" in q`, `"notAutoScored" in q` and `"essayScore" in q` are all `false` on every question |
| `docs/design/community-solutions-backend-design.md` (§ Data Contracts `community_solution_detail` "Comment count presence condition"; Reference Contract Value #20) | state-lifecycle-negative | `comment_count`: "SQL `null` (never `0`) when the question carries no comment surface, an integer when it does" | A `comment_count: null` question maps to a `note` with no `commentCount` key; a `comment_count: 0` question maps to `commentCount: 0` |

## Boundary Context
(From the work plan's Connection Map — "Backend masking RPCs → frontend query layer"; this task is the consumer. Integration Test 3 proves this boundary.)
- **Serialized format** (verbatim): "PostgREST JSON, `RETURNS TABLE` row — masked identity/score columns are JSON `null`, key always present (D003)".
- **Consumer parse rule** (verbatim): "`toAuthorIdentity()`/`toScoreField()` treat `author_display_name===null` / `score===null` as the sole discriminant; never independent per-field checks".
- **Expected signal** (verbatim): "Mapped TS object has no `displayName`/`avatarUrl`/`authorId` key for a masked row; unmasked row carries fixture's own values unchanged".
- **Roundtrip check**: a fixture row shaped exactly as the RPC serializes it (every key present, masked values `null`) parses to an object whose keys exclude identity fields; an unmasked fixture row parses to identity values equal to the fixture's own.

## Investigation Notes
(Append observations here before implementation begins. Record each Compliance Check result.)

**Investigation Targets read (2026-09-25):**
- `communitySolutions.int.test.ts`: Test 1 skeleton comment block untouched (verified not to touch it); Test 2 (filled, task 04) shows the repo's `.rpc` mock shape (`vi.hoisted` + `vi.mock("@/lib/supabase/server")`, `rpcMock`); Test 3's comment block (lines 205-256) states the exact four verification points to implement as real assertions: (1) exactly one `.rpc("community_solutions_list", {p_exam_id})` for `listSolutions`, (2) exactly one `.rpc("community_solution_detail", {p_solution_id})` for `getSolutionDetail`, (3) masked fixture row → mapped object has no identity keys, (4) non-masked fixture row → identity values equal fixture's own.
- `queries.ts` (existing, task 04): session-client pattern is `const supabase = await createClient(); const { data, error } = await supabase.rpc(name, params); if (error) throw error;`; `import "server-only"` at top; zero rows → `null`/`[]`, never throw. Extended this file in place (did not create a new file).
- `identity.ts` (task 06): `toAuthorIdentity({author_display_name, author_avatar_url})` — discriminant is `typeof author_display_name === "string"` only; masks nothing else. `toScoreField<T extends {score: number|null}>(row)` drops `score` key when null/undefined, keeps everything else in `row` untouched. Both are the ONLY place identity/score null→absent masking happens — reused directly, not reimplemented.
- `schema.sql` (`community_solutions_list` lines 3157-3247, `community_solution_detail` lines 3265-3390): confirmed actual `returns table` column lists match Reference Contract Value #14 exactly (14 header / 7 per-question / 11 per-comment). `community_solutions_list.comment_count` is `coalesce(c.comment_count, 0)` — **always** an integer, never SQL null (unlike detail's per-question `comment_count`, which is null when the comment-count presence condition fails). `community_solutions_list` also returns `status` (always `'published'`, the only status this RPC ever returns) — `SolutionListItem` declares no `status` field, so it is read from the row and dropped, not forwarded.
- Backend DD § Data Contracts (both RPCs' "Output columns", Score-grading condition, Comment count presence/count conditions) and § Field Propagation Map: confirms `per_question` folds into the detail's 4 per-question fields (`writerChoiceNode?`, `result?`, `notAutoScored?`, `essayScore?`) **inside `queries.ts`** — unlike `stem`/`correct_answer`, which the DD explicitly assigns to "the frontend" (a later rendering task) to pre-render into `stemNode`/`correctAnswerNode`. `author_avatar_path` is the RPC column name; its value is `user_profiles.avatar_url` (stored a path/URL as-is — schema does not sign it). `identity.ts`'s own header comment states signing is `queries.ts`'s job, "done BEFORE calling into here" — but this task's own Notes section says "task 42 later adds the avatar batch signer to this same module." **Decision (Unimplemented Dependency Handling)**: no avatar-signing infrastructure exists yet in this task's scope (no Investigation Target, no Target File references a signer); pass `author_avatar_path` straight through as `author_avatar_url` (identity passthrough) — a local, reversible, contract-preserving stub that satisfies `toAuthorIdentity`'s existing signature without inventing new signing logic. Task 42 replaces the passthrough with real batch-signing; this is recorded as the integration handoff.
- `docs/design/community-solutions-frontend-design.md` § Data Contracts `SolutionListItem`/`SolutionDetail`: confirms `scoreGrading` presence is gated 1:1 by `score` presence (never independently null-checked) — implemented by deriving `scoreGrading`'s inclusion from whether `toScoreField`'s result contains a `score` key, not from a second `=== null` check on `score_grading` (keeps the "only identity.ts does null→absent" boundary intact: the actual null-check lives inside `toScoreField`, this module only mirrors its outcome for a second field).
- `SOURCE/features/solutions/lib/questionOutcome.ts` (existing, task 10/11): `toWriterQuestionOutcome`, `outcomeBranch`, `resultLabel` already implement the exact branch classification (`essay` / `notAutoScored` / `mcq` / `shortAnswerScored` / `unknown`) the detail's per-question fold needs, over the same `PerQuestionResult` shape `exam_results.per_question` (and therefore the detail's `per_question` column) carries. Reused directly for `result`/`notAutoScored`/`essayScore` derivation — avoids a second, duplicate branch-classification implementation (Rule of Three / DRY).
- ADR-0021 § Decision / § Implementation Guidance: confirms Binding Decision row 1 (no `SELECT` grant, every public read via RPC) and row 2 (every identity column via `case when` projection, mirrored client-side as "every identity field leaves `queries.ts` only via `toAuthorIdentity`/`toScoreField`").

**Binding Decisions — planned approach and compliance (pre-implementation):**
- Axis `contract_schema` (both rows), planned approach: `listSolutions`/`getSolutionDetail` each issue exactly one `.rpc(...)` call and never construct a `.from("community_solutions"|"community_solution_notes"|"community_solution_comments")` query; every identity-bearing field (`author`, and each comment's `author`) is produced exclusively by passing the raw row through `toAuthorIdentity`, never by copying `row.author_display_name` etc. directly into the output object.
  - Row 1 (zero `.from()` calls, every read is `.rpc()`): **Y** — verified by code inspection after Green phase and by `grep -n "\.from(" queries.ts` in Operation Verification.
  - Row 2 (identity columns only via `case when` / `toAuthorIdentity`): **Y** — every `author`/comment `author` field is `toAuthorIdentity({...})`, no raw `author_display_name`/`author_avatar_path` field is ever assigned directly to an output key.

**Reference Contracts — planned approach and compliance (pre-implementation):**
- Row 1 (structure-order, `listSolutions` preserves RPC order): planned — `rows.map(mapSolutionListRow)`, no `.sort()`/re-grouping anywhere. **Y**.
- Row 2 (`{kind:"anonymous"}` iff no display name; `avatarUrl` passes through unchanged): delegated entirely to `toAuthorIdentity`, already proven in task 06. **Y**.
- Row 3 (`score: null` → key deleted, never `score: null`): delegated to `toScoreField`. **Y**.
- Row 4 (structure-enumeration, 14/7/11 exact key sets): test fixtures for `solutionReadMappers.test.ts` and Test 3 built with exactly these column names (verified against `schema.sql`'s actual `returns table`/`jsonb_build_object` column lists above); mapper reads only documented columns. **Y**.
- Row 5 (`per_question: null` → all 4 keys absent on every question): implemented as a single gate — `mapPerQuestionFields` returns `{}` immediately when the header's `per_question` array is `null`, before any per-question branch logic runs. **Y**.
- Row 6 (`comment_count: null` → `note.commentCount` dropped; `comment_count: 0` kept): implemented via `row.comment_count !== null ? {commentCount: row.comment_count} : {}`, mirroring `toScoreField`'s presence-check pattern but scoped to a field outside identity/score (task's "only identity.ts does null→absent" note is scoped to identity/score masking specifically — identity.ts's own file header says "the only place **identity/score**-masked columns become absent fields"; `comment_count`/`is_hidden_by_admin`/`hidden_reason` are separate, non-identity, non-score fields this task's own Mapper rules assign to `queries.ts`). **Y**.

**Boundary Context roundtrip**: satisfied by Test 3's masked/unmasked fixture-row assertions (identical mechanism the Reference Contract rows above already cover). **Y**.

**Post-implementation re-evaluation (Exit Gate, 2026-09-25).** Final implementation matches the planned approach above with no divergence. All 21 new tests pass (9 in `communitySolutions.int.test.ts` Test 3 + 12 in `solutionReadMappers.test.ts`), full `npm test` (2290 passed, 10 skipped, unrelated), `npx tsc --noEmit` clean, `npm run lint` clean, `grep -n "\.from(" SOURCE/features/solutions/queries.ts` returns zero matches.
- Binding Decision row 1 (zero `.from()`, every read via `.rpc()`): **Y** — grep confirms zero `.from(` occurrences; `listSolutions`/`getSolutionDetail` each issue exactly one `.rpc()` call (asserted by Test 3's call-count/call-args assertions).
- Binding Decision row 2 (identity columns only via `toAuthorIdentity`): **Y** — every `author`/comment-`author` field in `mapSolutionListRow`/`mapSolutionDetailRow`/`mapSolutionDetailComment` is produced by `toAuthorIdentity({...})`; no raw `author_display_name`/`author_avatar_path` is assigned to an output key anywhere in `queries.ts`.
- Reference Contract row 1 (order preservation): **Y** — `mapSolutionListRow` used inside a plain `.map()`, no `.sort()`; row 11's test confirms `["sol-c","sol-a","sol-b"]` order preserved.
- Reference Contract row 2 (`toAuthorIdentity` anonymous/named + `avatarUrl` passthrough): **Y** — delegated to task 06's already-proven function; rows 8/9/10 assert both branches.
- Reference Contract row 3 (`score: null` → key deleted): **Y** — `mapScoreFields` delegates the null-check to `toScoreField`; row 1's test confirms `"score" in detail` is `false`.
- Reference Contract row 4 (14/7/11 exact key sets): **Y** — all fixture rows in both test files use exactly the column names from `schema.sql`'s actual `returns table`/`jsonb_build_object` lists (cross-checked during investigation); no extra/renamed columns read anywhere in the mapper.
- Reference Contract row 5 (`per_question: null` → all 4 keys absent on every question): **Y** — `mapPerQuestionFields` returns `{}` immediately on `perQuestion === null`, before any branch logic; row 1's test confirms all four keys absent on both questions.
- Reference Contract row 6 (`comment_count: null`→ dropped, `0` kept): **Y** — rows 3/4's tests confirm both cases directly.
- Boundary Context roundtrip: **Y** — Test 3's masked/non-masked assertions and `solutionReadMappers.test.ts` rows 8-10 exercise the roundtrip both ways.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Replace Test 3's runner section with real imports + `describe`/`it` + the four verification-point assertions; add cases for the empty-result → `[]`/`null` path and a nested masked comment row
- [x] Write the § Required test list below in `solutionReadMappers.test.ts`
- [x] Run and confirm failure

### Required test list (binding — frontend DD § Test Boundaries "Mapper rule tests (v1.6)", backend task 14; plan § P2-T2)

`.rpc()` is mocked at the Supabase client boundary and fed literal rows shaped exactly as the RPC serializes them (every declared key present, masked values `null`).

| # | Fixture row | Expected mapping |
|---|---|---|
| 1 | detail row with `score: null, score_grading: null, per_question: null` and two questions (one `true_false`, one essay) | on **every** question `"notAutoScored" in q`, `"essayScore" in q`, `"result" in q` and `"writerChoiceNode" in q` are all `false`; the header has no `score` and no `scoreGrading` key |
| 2 | the same row with a non-null `score` and a `per_question` marking the first question `scored: false` | that question maps to `notAutoScored: true`; `score` and `scoreGrading` are present on the header |
| 3 | a question with `comment_count: null` | no `commentCount` key on `note`, and `comments` is `[]` |
| 4 | a question with `comment_count: 0` | `commentCount: 0` (a real value, not dropped) |
| 5 | header and comment rows with `i_reported: false` / `true` | `iReported` present as a `boolean` on the header **and** on every comment row in both cases (never dropped, never optional) |
| 6 | a comment row with `is_hidden_by_admin: false, hidden_reason: null` | neither `isHiddenByAdmin` nor `hiddenReason` key present |
| 7 | a comment row with `is_hidden_by_admin: true, hidden_reason: "spam"` | both keys present with those values |
| 8 | a **masked** list row and a masked detail header (`author_display_name: null`) | the mapped object has no `displayName`, no `avatarUrl` and no `authorId` key; identity is exactly `{ kind: "anonymous" }` — including when `is_mine: true` (AC-062, no self-exception) |
| 9 | a **non-masked** row | identity values equal the fixture's own, unchanged (no transformation drift) |
| 10 | a nested masked **comment** row | same as #8, with `isSolutionAuthor` and `isMine` still present and correct |
| 11 | list rows supplied in a deliberately non-sorted order | output ids equal input ids in the same order (no client sort) |
| 12 | `community_solution_detail` returning `[]` | `getSolutionDetail` returns `null`; `community_solutions_list` returning `[]` → `listSolutions` returns `[]` (no throw) |

### 2. Green Phase
- [x] Implement `listSolutions` / `getSolutionDetail` with the mapper applied to every row
- [x] Run only the added tests and confirm they pass

### 3. Refactor Phase
- [x] One row-mapping function per RPC; no duplicated mapping logic
- [x] Confirm added tests still pass

## Quality Assurance Mechanisms
- `npm test` (vitest default lane) — Config: `SOURCE/vitest.config.ts` — Covers: `SOURCE/features/**`
- `npm run lint` (incl. B4), `npx tsc --noEmit` (RPC-return types, `AuthorIdentity`/`SolutionListItem`), commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:fixture` with `--exclude "tests/e2e/fixture/community-solutions.fixture.e2e.test.ts"` until task 23; `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run `npm test` inside `SOURCE/`; `grep -n "\.from(" SOURCE/features/solutions/queries.ts`.
- **Success criteria**: Test 3's four assertions and all 12 rows of § Required test list hold in one run; no `.from("community_solutions"|"community_solution_notes"|"community_solution_comments")` in `queries.ts`.
- **Failure response**: if a caller needs a field the RPC does not return, stop — extend the RPC contract through the DD, never add a raw table read.
- **Verification level**: L2 (new tests added and passing)

## Proof Obligations
- **Claim** (skeleton Test 3, verbatim): "listSolutions() -> exactly one .rpc('community_solutions_list', { p_exam_id }); getSolutionDetail() -> exactly one .rpc('community_solution_detail', { p_solution_id }); masked fixture row -> mapped object has no identity keys present; non-masked fixture row -> mapped object has identity keys equal to the fixture's own values (no transformation drift)."
- **Primary failure mode** (skeleton): "a future change to queries.ts reads .from('community_solutions') directly (bypassing the masking RPC) for a 'quick' list query, or the TS mapper reads row.author_display_name without checking for null and forwards a stray/placeholder value instead of omitting the field."
- **Boundary to exercise**: `features/solutions/queries.ts` public functions against a mocked session client's method log.
- **State assertion**: N/A (read-only).
- **Mock boundary rationale**: session client mocked with hand-built fixture rows matching the RPC's documented masked shape (skeleton `@real-dependency: none`).
- **Residual** (skeleton): whether the real RPC produces that shape is proven only on real DB — task 16 and task 47 (SE2).

- **Claim** (Failure Mode #6, unavailable boundary / AC-063): an ineligible caller's empty RPC result maps to `[]` / `null`, never an exception, so the route redirects instead of error-rendering.
- **Primary failure mode**: an empty detail result throws, rendering the route error page and revealing that the id exists.
- **Boundary to exercise**: `getSolutionDetail` with the mocked RPC returning `[]`.
- **State assertion**: N/A.
- **Mock boundary rationale**: session client mocked.
- **Residual**: the redirect itself is proven in tasks 18 and 21.

- **Claim** (Failure Mode #9, missing-sort-key ordering / S12): the module never re-sorts server rows.
- **Primary failure mode**: a client sort by helpful count drops the `updated_at`/`id` tie-breaks and reorders ties between renders.
- **Boundary to exercise**: `listSolutions` with fixture rows in a deliberately non-alphabetical, non-helpful-sorted order.
- **State assertion**: output ids equal input ids in the same order.
- **Mock boundary rationale**: session client mocked.
- **Residual**: server-side ordering stability proven in task 16.

## Completion Criteria
- [x] All added tests pass (Test 3 + the 12 rows of § Required test list + unavailable-boundary + order-preservation cases)
- [x] The mapper never emits `score: null`, `notAutoScored: false` as a stand-in, or `commentCount: 0` for a SQL-`null` `comment_count`; `iReported` is present on the header and on every comment row
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Every Binding Decision and Reference Contract Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Test 1's comment block in the int skeleton is unchanged

## Notes
- Impact scope: every reader component consumes these typed shapes; task 42 later adds the avatar batch signer to this same module.
- Scope boundary: no change to `SOURCE/lib/solutions/identity.ts` behaviour.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
