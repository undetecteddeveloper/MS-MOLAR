# Task H5 — DDL authoring: three groups + fingerprint at both pin sites (one commit, nothing applied yet)

Plan mapping: `docs/plans/20260829-feature-essay-auto-scoring.md` — **Phase H (Foundation, horizontal slice), Task H5**
Layer: **backend** (`SOURCE/supabase/**`, `SOURCE/lib/schema/**`)

Metadata:
- Dependencies: **Task G0.2** (the real constraint names — Gate C, closed 2026-08-29), **Task G0.4** (baseline fingerprints — Gate B1, closed 2026-08-29), **Task H1** (key literals and the attempt cap must be settled before the function bodies are written).
- Blocks: **Task H6**, and through it H7 and everything downstream of H7.
- Provides: the three DDL groups in `schema.sql` and the new fingerprint literal at **both** pin sites. **Nothing is applied to any database by this task** — that is H7.
- Size: Medium (2 files, one commit)
- Verification level: **L3/L2** — the file type-checks and the suite is green; `verify:schema` is still red against the databases until H7, which is **expected and must be recorded, not worked around**.

## Change Category
`Change Category: boundary-change, state-change`

Three persisted boundaries move: the `attempt_answers` character ceiling, both `telemetry_log` CHECK constraints, and the `exam_results.per_question` write surface (two new privileged functions). Adjacent cases swept in the same commit: the inline `event_type` declaration, the inline `error_code` declaration, the existing `error_code` drop/add pair, the **new** `event_type` drop/add pair, and **both** fingerprint pin sites.

## Gate C — entry condition (CLOSED 2026-08-29)

The real constraint names are **`telemetry_log_event_type_check`** and **`telemetry_log_error_code_check`**, **identical on both projects** (prod `pebjdlbgbmizgfpuptjl`, dev `hynwleaxtbtjzkvpjsug`). Use them **verbatim**; do not re-predict them.

- The live `event_type` CHECK allows only `'adaptive_route'` and `'tutor_invoke'` — **two** values — so the **new pair must list three**.
- The live `error_code` CHECK allows **six** values (`gemini_unavailable, rate_limited, server, not_eligible, user_quota_exhausted, project_budget_exhausted`) — so the **new pair must list nine**, adding `groq_unavailable`, `invalid_output`, `duplicate_write`.

## Implementation Content

All of the following lands in **one commit**, in `SOURCE/supabase/schema.sql` unless stated otherwise.

### Group 1 — character ceiling (R11 / AC-048(1))
Edit the existing drop/add pair **in place** at `:472-474` to `check (answer is null or length(answer) <= 4000)`, keeping the explanatory comment and adding the recorded reason: no empirical basis — production has **0** submitted essays; chosen by argument; it **must** equal `LIMITS.MAX_ATTEMPT_ANSWER`, and `verify:schema` reads it back from a real DB. The inline `check (answer in ('A','B','C','D'))` at `:124` was already superseded by this pair and is **not** a second coupled site.

### Group 2 — `telemetry_log` (R13 / AC-055)
- Widen the inline `event_type` declaration at `:1383` to include `'essay_grade'`.
- Widen the inline `error_code` declaration at `:1390-1399` with `'groq_unavailable'`, `'invalid_output'`, `'duplicate_write'`.
- Extend the existing `error_code` drop/add pair at `:1818-1821`.
- **Write a new drop/add pair for `event_type`, which has never had one** — using the real constraint name recorded in Gate C, not a predicted one.

Editing only the inline declaration produces the exact TD-005 shape the comment at that site already names: correct in git, absent from every database (`create table if not exists` is a no-op on both live databases).

### Group 3 — two privileged functions (ADR-0018 Decision 1)
A new section placed **after §11** and cross-referenced from it, containing:
- `claim_essay_grading_attempt(p_attempt_id uuid, p_question_id text) returns table (claimed boolean, attempts int, reason text)`
- `record_essay_grade(p_attempt_id, p_question_id, p_state, p_earned, p_max, p_low_confidence)`

Both `language plpgsql`, `volatile`, `set search_path = public, pg_temp`, **`INVOKER` (never `SECURITY DEFINER`)**, **no `user_id` parameter**, with the §11b grant block mirrored **verbatim** (`revoke all on function … from public, anon, authenticated;` then `grant execute … to service_role;` — revoking only from `public` leaves both callable by students).

- The `UPDATE` is scoped to the `per_question` column and to **one** array element; `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds` appear **nowhere** in either body.
- The rebuild uses `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality`.
- **Neither function validates the band value** — that omission is deliberate (Decision 2).
- The settle carries `… and <element>.essayState <> 'graded'` **in the same statement** and returns **zero rows affected as a value, not a raise**.
- The claim **increments** `essayAttempts` and **never decrements** it.
- Carry the full explanatory comment block: it is the thing a reader of §11 finds instead of searching for the amendment.

### Fingerprint
Compute the new literal and move it at **both** pin sites — `schema.sql:1871` and `SOURCE/lib/schema/schemaFingerprint.ts:41` — **in this same commit** (D-08, Gate B8, Gate H6). Record the new literal in **Gate B2** of the work plan.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/lib/schema/schemaFingerprint.ts` (`:41`)
- [x] `SOURCE/lib/tutor/telemetry.ts` — **added to scope 2026-08-29 by engineer decision** (Option 1, see § Blocker)
- [x] `SOURCE/lib/tutor/__tests__/telemetry.test.ts` (`:49`, `:265`) — same
- [x] `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` (`:133`, `:231`) — same; the **eighth** coupled site, absent from D-06 and Gate H5
- [ ] `docs/plans/20260829-feature-essay-auto-scoring.md` — Gate B2 (record the new literal) — **not written: work plan is out of scope for this run; the engineer is reconciling it. Literal to record: `9979c9deea52`**

## Investigation Targets
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 1 — the ceiling drop/add pair)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 2 / D-06 — all four telemetry SQL sites)
- `docs/design/essay-auto-scoring-backend-design.md` (§ Schema Changes Nhóm 3 — the two functions, placement after §11, the §11b grant block)
- `docs/design/essay-auto-scoring-backend-design.md` (§ D-08 — the fingerprint pinned at two sites)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision — Decisions 1, 1b, 2, 3, 4)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance — items #1 and #2: placement after §11, grant block mirrored verbatim)
- `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Amendment to ADR-0010 — the append-only property that remains)
- `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision — enforcement lives in SQL, not at the call site)
- `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision — a second privileged operation is a **separate function**, not a mode parameter on the first)
- `SOURCE/supabase/schema.sql` (`:124` the superseded inline check; `:472-474` the ceiling pair; `:849` the client write revoke; `:1354` the MASTERY WRITE filter — **not modified**; `:1383` inline `event_type`; `:1390-1399` inline `error_code`; `:1818-1821` the `error_code` drop/add pair; §11 and §11b; `:1871` the fingerprint block — it must remain the **last** statement in the file)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`:41`)
- `SOURCE/lib/scoring/essayLifecycle.ts` (Task H1 — the six key literals and `ESSAY_MAX_ATTEMPTS`, which the function bodies must match)
- `docs/plans/20260829-feature-essay-auto-scoring.md` (§ Gate C — the two real constraint names; § Gate B — the baseline fingerprints)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | placement | The band is written in place into `exam_results.per_question` by **two** `service_role`-only `INVOKER` SQL functions — `claim_essay_grading_attempt` and `record_essay_grade` — never by a TypeScript `.update()` call site, and never into a separate `essay_grades` table | Both functions exist in `schema.sql` as `INVOKER`, and this commit adds no `essay_grades` table and no TypeScript `.update()` on `exam_results` |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | Neither function takes a `user_id` parameter; ownership is derived from the attempt inside SQL, and `status = 'submitted'` is required. Neither body may name `total_score`, `correct`, `total`, `topic_breakdown` or `overtime_seconds` | A source scan of both bodies finds no `user_id` parameter and none of the five column names |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The element rewrite preserves array order explicitly: `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality` | Both bodies use `jsonb_agg(… order by ord)` over `… with ordinality` |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | contract_schema | The closed band set `{0, 0.25, 0.5, 0.75, 1}` is declared **once, in TypeScript**; the SQL functions do not validate the band value at all, and that omission is deliberate | Neither function body compares the band against any set |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | First-write-wins is a `WHERE … <> 'graded'` predicate inside the settle statement — zero rows affected is a **distinct return value, not an exception** — never a read-then-write in TypeScript. `failed` is not protected by the predicate; `graded` is absorbing | The settle carries the predicate in the same statement and returns a boolean/zero-row value rather than raising |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Decision) | data_flow | The retry cap is consumed at **claim** time, before the provider is contacted, and is never decremented. The initial counter value is emitted by `computeScore()` at insert, so `record_exam_result()`'s signature does not change | The claim increments `essayAttempts`; no statement anywhere decrements it; `record_exam_result()` is untouched |
| `docs/adr/ADR-0018-essay-async-grade-write.md` (§ Implementation Guidance) | placement | The two functions go in one new `schema.sql` section placed after §11 and cross-referenced from it, with ADR-0010's grant block mirrored verbatim (`revoke all on function … from public, anon, authenticated`, then `grant execute … to service_role`) | The new section sits after §11, §11 cross-references it, and the grant block is byte-equivalent to §11b's |
| `docs/adr/ADR-0010-score-write-trust-boundary.md` (§ Decision) | dependency_direction | Privileged operations are exposed as named operations from `lib/supabase/service-role.ts`; `serviceRoleClient()` stays private; enforcement lives in SQL, not at the call site; `import "server-only"`; the bundle scan stands | Enforcement (ownership, `status = 'submitted'`, the cap, first-write-wins) is inside the SQL bodies, not deferred to the caller |
| `docs/adr/ADR-0011-mastery-write-trust-boundary.md` (§ Decision) | placement | A second privileged operation is a **separate function**, not a mode parameter on the first — which is why claim and settle are two functions | Two independent functions exist; neither takes a mode/discriminator parameter |

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| ADR-0018 (§ Amendment to ADR-0010) | state-lifecycle-negative | "The append-only property that remains, and that this ADR does not weaken: **no client can write to `exam_results` by any path, and no writer other than `service_role` exists.**" | The grant block revokes from `public, anon, authenticated` and grants only to `service_role`, and `schema.sql:849`'s client revoke is unchanged |

## Boundary Context (from the work plan's Connection Map)

| Boundary | Detail |
|---|---|
| `record_essay_grade()` → `exam_results.per_question` (in-place element rewrite) | Left: `public.record_essay_grade()` (SQL). Right: the same jsonb array, read by four display surfaces. **Serialized format**: rebuilt array via `jsonb_agg(… order by ord)`; the target element gains `essayGradedAt` and updated `essayState`/`essayEarned`/`essayMax`/`essayLowConfidence`. **Consumer parse rule**: consumers re-read the array by index order; array order **is** the exam's question order. **Expected signal**: SVC-1(a) — the full `questionId` sequence is unchanged after grading the middle of three essays; SVC-1(b) — every other element is byte-identical. |
| TypeScript telemetry literals → `telemetry_log` CHECK constraints | Left: `SOURCE/lib/tutor/telemetry.ts`. Right: `public.telemetry_log` CHECKs. **Serialized format**: literal string sets duplicated across seven sites (two SQL inline, two SQL drop/add pairs, two TypeScript constants, three test pins). **Consumer parse rule**: Postgres rejects any value outside the CHECK. **Expected signal**: a `service_role` insert of `event_type = 'essay_grade'` on dev succeeds and is then deleted. |
| `LIMITS.MAX_ATTEMPT_ANSWER` (TypeScript) → `attempt_answers_answer_check` (Postgres) | **Serialized format**: integer ceiling, duplicated in two places (git and each database). **Consumer parse rule**: `verify:schema` probes behaviourally and discriminates by SQLSTATE (`23514` vs `23503`). **Expected signal**: `verify:schema` is **red** when the two ceilings differ — which is exactly why H7→B3.3 is a known-red window. |
| `ESSAY_MAX_ATTEMPTS` (TypeScript) → the cap literal inside `claim_essay_grading_attempt()` | **Consumer parse rule**: `verify-schema.ts` regex-extracts the literal from the function body and compares it to the imported constant. **Expected signal**: the pin gate fails with a message naming **both** values. |
| `SCHEMA_FINGERPRINT` (TypeScript) → `schema_version.fingerprint` | **Serialized format**: 12-character hex literal. **Expected signal**: both databases return the new literal **by real query** (Gate B6), not by a "success" message. |

Roundtrip checks this task owns: the cap literal written into the claim body equals `ESSAY_MAX_ATTEMPTS`; the fingerprint literal written at `schema.sql:1871` equals the one at `schemaFingerprint.ts:41`.

## Investigation Notes

_Recorded 2026-08-29 at execution time._

### New fingerprint literal — `9979c9deea52`

Computed by the real `computeSchemaFingerprint()` (via the failing `schemaFingerprint.test.ts` `howToFix` message, which is the only local path to it — no `tsx` binary is installed in `SOURCE/node_modules/.bin`). Written at **both** pin sites in the same edit:

- `SOURCE/supabase/schema.sql` (now `:2158`, was `:1871`) — `values (1, '9979c9deea52')`
- `SOURCE/lib/schema/schemaFingerprint.ts:41` — `export const SCHEMA_FINGERPRINT = "9979c9deea52";`

Confirmed stable: the literal sits inside the `@schema-fingerprint-begin/end` markers, which `computeSchemaFingerprint()` strips, so writing it does not move it. `schemaFingerprint.test.ts`'s three-way assertion (constant ↔ declared ↔ recomputed) is **green** after the move, and `verify:schema` independently prints `✓ schema.sql tự khai đúng vân tay của chính nó (9979c9deea52)`.

Baseline before this task: `29931beeb950` on both databases (Gate B1) — unchanged, because **nothing was applied**.

### The new `event_type` drop/add pair, verbatim as written

Gate C name used verbatim; **not** predicted. Three values, matching the live definition (`adaptive_route`, `tutor_invoke`) plus `essay_grade`:

```sql
alter table public.telemetry_log
  drop constraint if exists telemetry_log_event_type_check;
alter table public.telemetry_log
  add constraint telemetry_log_event_type_check check (
    event_type in ('adaptive_route', 'tutor_invoke', 'essay_grade')
  );
```

The `error_code` pair was extended in place from 6 to 9 (`groq_unavailable`, `invalid_output`, `duplicate_write` added), under its existing Gate C name `telemetry_log_error_code_check`. Both inline declarations were widened to match.

### Fingerprint block placement

`tail -8 schema.sql` ends with the `@schema-fingerprint-end` marker — the `insert into public.schema_version` block is still the **last** statement in the file. The new §"ESSAY GRADE WRITE" block was inserted after §11b's grant, ~1200 lines above it.

### Source scan of both function bodies (189 lines, `claim_essay_grading_attempt` + `record_essay_grade`)

| Check | Result |
|---|---|
| `user_id` **parameter** | **absent** — the only `user_id` occurrences are `a.user_id` (selected from `exam_attempts`) and the local `v_user_id`; every parameter is `p_`-prefixed and none names a user |
| `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds` | **0 occurrences** of all five (word-boundary grep over the extracted bodies) |
| `order by ord` | 2 (one per body) |
| `with ordinality` | 2 (one per body) |
| `security definer` | 0 — both are INVOKER |
| `p_earned in (...)` / any band literal | 0. `0.25`/`0.75` appear exactly **once** in the whole file, on comment line `:1011`, which states the set is declared in TypeScript. Comments are stripped by `computeSchemaFingerprint()`, so **no band literal entered the executable SQL** |
| first-write-wins | `get diagnostics v_rows = row_count; return v_rows = 1;` — a **value**. The `<> 'graded'` predicate is inside the same `update` statement's `where … exists (…)` |
| retry cap | `if v_attempts >= 3 then … 'exhausted'` in the **claim**, before any budget/provider call. `3` equals `ESSAY_MAX_ATTEMPTS` (`lib/scoring/essayLifecycle.ts:74`). `essayAttempts` is only ever written as `v_attempts + 1` — **no decrement anywhere** |

### Preserved-unchanged confirmation

`git diff` touches no existing statement: the only diff lines mentioning `record_exam_result`/`record_skill_mastery` are new **comments**. `revoke insert, update, delete on public.exam_results from anon, authenticated;` (now `:864`) unchanged; the MASTERY WRITE `scored` filter (now `:1610`) unchanged; `record_exam_result()`'s signature/body/grants unchanged; the `exam_results` column DDL unchanged; `SOURCE/supabase/test-rls.ts` shows clean in `git status`.

### Binding Decisions — evaluated against the final implementation

| # | Axis | Evaluation | Evidence |
|---|---|---|---|
| 1 | placement | **Y** | Both functions present as INVOKER; no `essay_grades` table; no TypeScript touched at all |
| 2 | contract_schema | **Y** | Source scan above — no `user_id` parameter, 0 occurrences of all five column names; `status = 'submitted'` required in both |
| 3 | data_flow | **Y** | `jsonb_agg(… order by ord)` over `jsonb_array_elements(…) with ordinality`, twice |
| 4 | contract_schema (band set) | **Y** | 0 band comparisons; the only `0.25`/`0.75` is a comment |
| 5 | data_flow (first-write-wins) | **Y** | Predicate in the same statement; returns `v_rows = 1`, never raises on duplicate |
| 6 | data_flow (claim-time cap) | **Y** | Cap consumed in the claim; `3` == `ESSAY_MAX_ATTEMPTS`; no decrement; `record_exam_result()` untouched |
| 7 | placement (§11 cross-ref) | **Y** | New section sits between §11b's grant and the VIEW RLS banner; §11's banner gained a `⚠ SỬA ĐỔI, ĐỌC KÈM` pointer; grant block is the §11b block with only the signature changed |
| 8 | dependency_direction | **Y** | Ownership, `submitted`, the cap and first-write-wins are all inside the SQL bodies |
| 9 | placement (two functions) | **Y** | Two independent functions; neither takes a mode/discriminator parameter |

### Reference Contracts

| Contract | Evaluation | Evidence |
|---|---|---|
| state-lifecycle-negative (append-only property that remains) | **Y** | Both grant blocks `revoke all … from public, anon, authenticated` then `grant execute … to service_role`; `schema.sql:864`'s client revoke unchanged |

### Roundtrip checks this task owns

- Cap literal `3` in the claim body == `ESSAY_MAX_ATTEMPTS` (`3`). ✅
- `schema.sql`'s declared literal == `schemaFingerprint.ts`'s constant == recomputed value (`9979c9deea52`). ✅ Proven by `schemaFingerprint.test.ts`'s three-way assertion passing, and independently by `verify:schema`.

### ⛔ Blocker — RESOLVED by engineer decision (Option 1), recorded in full because the enumeration it corrects is still wrong upstream

**Group 2's `error_code` widening turns three assertions red in `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`.** Measured, not predicted: `npx vitest run` = **exit 1**, `3 failed | 1711 passed`, all three in that one file.

| Failing case | Line | Why |
|---|---|---|
| `đúng HAI occurrence, đúng hai loại câu lệnh, mỗi bên đúng sáu literal` | `:213` | `toEqual` against `SCHEMA_TELEMETRY_ERROR_CODES` — a hand-copied **six**-literal list at `:133` |
| `thiếu MỘT literal ở MỘT trong hai chỗ là đủ để ca trên đỏ` | `:231` | same hand-copied list, used as the mutation baseline |
| `hằng TS và CẢ HAI danh sách SQL trùng khít` | `:256` | `toEqual` against `TELEMETRY_ERROR_CODES` from `lib/tutor/telemetry.ts` — still **six** |

**This is an eighth coupled site that D-06 and Gate H5 do not enumerate.** D-06 lists three TypeScript test pins, all in `telemetry.test.ts` (`:49`, `:265`, `:311`). Those three are **still green** — they compare TypeScript against a hand copy and never read `schema.sql`. The site that actually reads `schema.sql` is `schemaFingerprint.test.ts`, and it is missing from every enumeration in the plan and the Design Doc.

**No additive fix exists inside this task's Target Files.** Extending `SCHEMA_TELEMETRY_ERROR_CODES` to nine would close the first two, but the third compares the SQL lists to `TELEMETRY_ERROR_CODES` in `lib/tutor/telemetry.ts`. That constant is Task **B3.1**'s (work plan `:1074`), and moving it cascades into `telemetry.test.ts:49`, `:265`, `:311`. Weakening the third assertion is not available: its own comment forbids it (*"KHÔNG làm nhẹ thành `toContain`"*), and it is the gate Gate H5 exists to be.

**The plan contradicts itself here.** Gate H5 (`:160`) requires all seven telemetry sites to move *in one commit* "or CI goes red"; the Connection Map (`:497`) names H5's expected signal as the telemetry pins *staying green*; but the work plan assigns the SQL sites to H5 and the TypeScript sites to B3.1, which are separated by all of Phase H. Equivalent engineers would disagree on which side moves, so this is escalated rather than resolved unilaterally.

Options, with costs:

1. **Widen the TypeScript sites in this same commit** (Gate H5 in full): `lib/tutor/telemetry.ts` (`TelemetryEventType`, `TELEMETRY_ERROR_CODES`), `lib/tutor/__tests__/telemetry.test.ts` (`:49`, `:265`, `:311`), and `lib/schema/__tests__/schemaFingerprint.test.ts:133`. Five extra files, all outside this task's Target Files, and it takes B3.1's implementation (whose task file would go stale). Runtime risk is nil — the new literals are inert until `gradeEssays.ts` exists, and H7 applies the DDL before Phase B. **This is the option that satisfies Gate H5 as written.**
2. **Land Group 2 without the `error_code` widening** (only the inline `event_type` and the new `event_type` pair, neither of which the guard reads). Keeps `vitest` green, but the DDL applied at H7 would lack three error codes, so B3.1 would have to edit `schema.sql` again, move the fingerprint again, and re-apply to both databases — exactly the TD-005 shape this task exists to avoid.
3. **Land all three groups and accept a documented known-red window** on those three assertions until B3.1, the same way `verify:schema`'s ceiling gate is a blessed known-red from H7→B3.3. Cheapest, but it puts a red lane on the branch for ~12 commits and the plan's own H5 completion criterion says "six verify gates green".

#### Resolution — Option 1, taken 2026-08-29

The engineer approved Option 1 and widened this commit's scope by three files. The deciding evidence was the failing assertion's **own message**: *"Sửa CẢ BA chỗ trong cùng một commit: hai danh sách SQL + lib/tutor/telemetry.ts."* The guard already in the repo instructs the one-commit fix; the work plan's H5/B3.1 split contradicts a rule the codebase was enforcing before this feature existed.

Options 2 and 3 were rejected on the record: Option 3 would leave the **default** vitest lane red for ~12 commits (the exact TD-030 failure mode — a red lane inside which no real regression is distinguishable); Option 2 would mean hand-applying DDL to both live databases **twice** (the TD-005 shape, already fired four times).

What moved, and what deliberately did not:

| Site | Change | Note |
|---|---|---|
| `lib/tutor/telemetry.ts:35` | `TELEMETRY_ERROR_CODES` 6 → 9 | order matches both SQL lists exactly |
| `lib/tutor/telemetry.ts:40` | `TelemetryEventType` += `'essay_grade'` | no exhaustive `switch` anywhere consumes this type — grep-verified, so widening is inert |
| `lib/tutor/__tests__/telemetry.test.ts:49` | `SCHEMA_ERROR_CODES` 6 → 9 | **still hand-written**; reads nothing |
| `lib/tutor/__tests__/telemetry.test.ts:265` | `event_type` allowlist += `'essay_grade'` | |
| `lib/tutor/__tests__/telemetry.test.ts:311` | **unchanged** | per-element equality needed no edit — both sides moved to nine |
| `lib/schema/__tests__/schemaFingerprint.test.ts:133` | `SCHEMA_TELEMETRY_ERROR_CODES` 6 → 9 | **still hand-written**; reads nothing |
| `lib/schema/__tests__/schemaFingerprint.test.ts:231` | mutation literal `'project_budget_exhausted'` → `'duplicate_write'`, `.slice(0, 5)` → `.slice(0, 8)` | see below |
| `:256` assertion | **unchanged, not weakened** | still an exhaustive `toEqual` over both SQL sites against the TypeScript constant; never softened to `toContain` |

The mutation-case edit at `:231` was forced, not optional: that case removes one literal and asserts the second site is a **tail truncation** of the expected list. `'project_budget_exhausted'` is no longer the last literal, so a `.slice()` cut-from-the-end no longer describes the perturbation. Retargeting to the new last literal `'duplicate_write'` keeps the assertion's strength identical — site[0] still holds all nine, site[1] holds eight, and the two still must differ — while also making the mutant the **newest** code, which is the one a real widening is most likely to forget.

**No hand copy was made to read from another.** All three remain independent transcriptions, which is the whole reason they catch a wrong-but-consistent pair.

**Still owed upstream (engineer is reconciling; deliberately not touched here):** D-06 in the backend Design Doc and Gate H5 in the work plan both enumerate **seven** sites and must be amended to name `schemaFingerprint.test.ts` as the eighth. Task B3.1 must be trimmed to the `gradeEssays.ts` call-site wiring it still owns, since its telemetry constant work landed here.

**Re-run after the widening — no ninth coupled site appeared.** `npx vitest run` went from `3 failed | 1711 passed` to `1714 passed`, exit **0**. The fingerprint did **not** move (`9979c9deea52` at both pins, re-confirmed) because `schema.sql` was not touched again.

## Implementation Steps (TDD: Red-Green-Refactor)
### 1. Red Phase
- [x] Read all Investigation Targets, including Gate C's two recorded names and Gate B1's baseline fingerprints
- [x] **Sweep the adjacent cases** (Change Category: boundary-change / state-change): all four telemetry SQL sites, the ceiling pair, the superseded inline check at `:124`, and both fingerprint pin sites — enumerate them before editing
- [x] Confirm the current state of each site so a partially-applied edit is detectable

### 2. Green Phase
- [x] Group 1: widen the ceiling drop/add pair at `:472-474` to 4000, keeping and extending the comment
- [x] Group 2: widen both inline declarations, extend the `error_code` pair, and write the **new** `event_type` pair using `telemetry_log_event_type_check` verbatim
- [x] Group 3: add the new section after §11 with both functions, the §11b grant block mirrored verbatim, and the full explanatory comment block; cross-reference it from §11
- [x] Compute the new fingerprint (`9979c9deea52`) and move it at **both** pin sites — Gate B2 of the work plan left unwritten (scope boundary)

### 3. Refactor Phase
- [x] Source-scan both function bodies: no `user_id` parameter, none of `total_score`, `correct`, `total`, `topic_breakdown`, `overtime_seconds`
- [x] Confirm `jsonb_agg(… order by ord)` over `… with ordinality` in both
- [x] Confirm the fingerprint block is the **last** statement in `schema.sql`
- [x] Confirm `SOURCE/supabase/test-rls.ts` is untouched, and `schema.sql:1354` (MASTERY WRITE), `record_exam_result()` and the `exam_results` column DDL are unchanged

## Quality Assurance Mechanisms
- `npx tsc --noEmit` (strict) — Enforces: the moved fingerprint literal type-checks — Config: `SOURCE/tsconfig.json` (project-wide)
- `npx vitest run` — Config: `SOURCE/vitest.config.ts`
- ESLint (`--max-warnings 0`) — Config: `SOURCE/eslint.config.mjs` (project-wide)
- `npm run build` — Config: `SOURCE/package.json` (project-wide)
- `npm run verify:schema` — Enforces: grants on both new functions, the character ceiling read back from a real DB, the schema fingerprint, the `ESSAY_MAX_ATTEMPTS` pin — Config: `SOURCE/supabase/verify-schema.ts`; covers `SOURCE/supabase/**`, `SOURCE/lib/schema/schemaFingerprint.ts`. **Expected red against the databases until H7 applies the DDL** — record it, do not work around it.
- `telemetry_log` CHECK constraints — Enforces: `event_type` / `error_code` accept closed literal sets only — Config: `schema.sql:1383`, `:1390-1399`, `:1818-1821` + the new `event_type` drop/add pair
- `attempt_answers_answer_check` — Enforces: student answer length ceiling — Config: `schema.sql:472-474` (widened 500 → 4000)

## Gate E4 — Six verify gates, this commit (fill in at execution time)

Run each command **separately** from `SOURCE/` and record its **real exit code**. Do not chain with `&&` and infer.

| # | Command (from `SOURCE/`) | Exit code | Notes |
|---|---|---|---|
| 1 | `npx tsc --noEmit` | **0** | green |
| 2 | `npx eslint --max-warnings 0` | **0** | green |
| 3 | `npx vitest run` | **0** | `1714 passed \| 10 skipped \| 3 todo (1727)`, `127 files passed \| 2 skipped`. First run was **1** (`3 failed \| 1711 passed`) — see § Blocker; resolved by the engineer-approved Option 1 scope widening, not by weakening any assertion |
| 4 | `npm run build` | **0** | green |
| 5 | `npm run test:fixture` | **1** | **exactly** the TD-030 baseline: `2 failed \| 75 passed \| 3 todo (80)`, both `subscription.fixture.e2e.test.ts` FE-1(e) — `locale en` and `locale vi`. Nothing beyond |
| 6 | `npm run test:localdb` | **0** | `11 passed \| 2 todo (13)`, `1 file passed \| 1 skipped` |
| 8 | `npm run verify:schema` | **1** | Against **dev** (`.env.local` → `hynwleaxtbtjzkvpjsug`); read/probe only, **no DDL**. Exactly **one** failing check, and it is the expected one: `✗ DB đang ở bản 29931beeb950, git đang ở 9979c9deea52 — có bản vá trong git CHƯA chạy trên DB này.` Every other check green, including `✓ schema.sql tự khai đúng vân tay của chính nó (9979c9deea52)`. **Not worked around** — the pin was not reverted |

**A task file with any exit-code cell left empty is not complete** (Gate E4).

## Operation Verification Methods
- **Verification method**: read the edited `schema.sql` against the Gate C names and the enumerated site list; source-scan both new function bodies for the forbidden parameter and column names; confirm both fingerprint pin sites carry the identical new literal.
- **Success criteria**: all three groups present in one commit; both fingerprint sites moved together; both new function bodies free of `user_id` and the five column names; `jsonb_agg(… order by ord)` present in both; the settle's predicate in the same statement; the grant block byte-equivalent to §11b's.
- **Failure response**: if the recorded Gate C name does not appear verbatim in the new `event_type` pair, stop — a predicted name makes `drop constraint if exists` a **silent no-op** and the migration will appear to succeed while `'essay_grade'` stays rejected. If `verify:schema` is red for any assertion **other** than the ones expected pre-application, resolve it before H7.
- **Verification level**: **L3/L2** — the file and the suite are green; database-side verification is deferred to H7 by design.

## Proof Obligations
Authored here, **proven** in H6/H8:
- **Claim (EG-BE-005 / Failure Mode Checklist: missing-sort-key ordering)**: the element rewrite leaves the `questionId` sequence unchanged.
  - **Primary failure mode**: a missing `order by ord` in `jsonb_agg` shuffles `per_question` the first time any essay is graded — every question on the review page pairs with the wrong answer, and **every "the band landed" assertion stays green**. **Boundary to exercise**: real Postgres (SVC-1(a), Task H8). **State assertion**: before → captured `questionId` literal; action → settle the second of three essays; after → identical sequence. **Mock boundary rationale**: none — a mocked client cannot prove `jsonb_agg` ordering. **Residual**: authored here, proven in H8.
- **Claim (EG-BE-006)**: a duplicate settle returns `false`/zero rows and does **not** raise. **Primary failure mode**: a read-then-write in TypeScript, or a raise where a value is required. **Boundary**: real Postgres (SVC-1(d)). **State assertion**: before → band from first write; action → settle with a **different** band; after → the stored band still equals the **first** write. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-007)**: `failed` is **not** absorbing; `graded` is. **Primary failure mode**: the predicate blocks everything, so a legitimate `failed → graded` retry can never land. **Boundary**: real Postgres (SVC-1(e)). **State assertion**: `failed` → settle → `graded`, then a further settle returns `false`. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-008)**: on a non-`submitted` attempt, the **claim** returns a row with `reason = 'not_submitted'` while the **settle raises `check_violation`** — the asymmetry is deliberate. **Primary failure mode**: collapsing the two into one behaviour. **Boundary**: real Postgres (SVC-1(f), SVC-2(f)); assert the **SQLSTATE**, not the message text. **State assertion**: N/A. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (EG-BE-009)**: no `user_id` parameter, no forbidden column names. **Primary failure mode**: ownership pushed to the call site, so a wrong caller can write another student's row. **Boundary**: a source-text scan of both bodies (SVC-1(g)). **State assertion**: N/A. **Mock rationale**: none. **Residual**: the scan proves the text; the grants are proven by SVC-2(g) and `verify:schema`.
- **Claim (EG-BE-010/011/012)**: claim-time cap, `exhausted`, `already_graded` — three **distinct** reasons. **Primary failure mode**: one generic refusal collapsing three branches. **Boundary**: real Postgres (SVC-2(a)(b)(e)). **State assertion**: `essayAttempts` increments by exactly 1 per successful claim and is never decremented. **Mock rationale**: none. **Residual**: proven in H8.
- **Claim (Failure Mode Checklist: no-op)**: this task's own primary failure mode — `drop constraint if exists` against a **wrongly predicted** name silently doing nothing while the migration reports success.
  - **Primary failure mode**: every grading telemetry write is rejected forever, silently, because the write is best-effort. **Boundary to exercise**: the live catalogue — closed by **Gate C being a prerequisite**, and confirmed at H7 step 5 by inserting one `event_type = 'essay_grade'` row on dev and deleting it. **State assertion**: N/A here. **Mock rationale**: none. **Residual**: authored here, confirmed at H7.

## Completion Criteria
- [x] **Implementation Complete** = all three groups + **both** fingerprint sites + the four telemetry TypeScript sites, in one commit
- [x] **Quality Complete** = gates 1/2/3/4/6 green; gate 5 red = TD-030 baseline only; `verify:schema` red = the fingerprint comparison only, expected until H7 (`verify:schema` will still be red against the databases until H7 — **expected**, and must be **recorded**, not worked around)
- [ ] **Integration Complete** = deferred to Task H7
- [ ] The new fingerprint literal recorded in Gate B2 of the work plan
- [x] Every Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes
- [x] Every Reference Contract Compliance Check evaluates to `Y`
- [x] Every exit-code cell in the Gate E4 table above is filled

## Notes
- Impact scope: H6 writes the gates over these objects; H7 applies them to both databases; H8 proves them against real Postgres; B1.3b calls them from TypeScript.
- Scope boundary — preserve unchanged: `schema.sql:1354` (the MASTERY WRITE filter), `record_exam_result()`'s signature/body/grants, the `exam_results` column DDL, `schema.sql:849`'s client revoke, and `SOURCE/supabase/test-rls.ts` (**not modified by this plan** — I-1 closed in favour of the runnable service lane).
- Nothing is applied to any database by this task. Gate B items B3–B8 belong to Task H7.
