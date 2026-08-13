# Task 01: Draft schema.sql additions + fingerprint sync + verify-schema.ts/setup-storage.ts wiring (Work Plan Phase 0, Task 0.1)

Metadata:
- Dependencies: none
- Provides: the DB shape (`support_tickets`, `support_ticket_notes`, `change_support_ticket_status`, `support-screenshots` bucket policy) that Task 02 (manual apply) and every downstream task read/write against
- Size: Medium (4 files: `schema.sql`, `schemaFingerprint.ts`, `verify-schema.ts`, `setup-storage.ts`)

## Implementation Content

Append, idempotently, before the `-- @schema-fingerprint-begin` marker in `SOURCE/supabase/schema.sql`:
1. `support_tickets` table (columns, `intent`/`status`/message-length CHECK constraints, insert-own + select-own RLS).
2. `support_ticket_notes` table — strict `exam_moderation_log`-form `revoke all`, **zero policies of any kind** (D4/R8/AC-048) — do not copy `telemetry_log`'s narrower revoke form.
3. `change_support_ticket_status` Postgres function — `SECURITY INVOKER`, explicit `revoke`/`grant`, RPC-only (D002 v1.2 fix), single atomic UPDATE whose CASE expression reads the row's own pre-update `status` in the same statement it writes (race-free under concurrent admin sessions).
4. `support-screenshots` `storage.objects` insert-own policy (no `authenticated`-facing select policy — AC-013's structural mechanism).

Run the 7-step apply order (per backend DD Schema & DB Enforcement) through step 5: edit → `npm test` → read the new fingerprint → set `schemaFingerprint.ts`'s `SCHEMA_FINGERPRINT` → set `schema.sql`'s §17 literal value → re-run `npm test` green, **in the same commit**.

Add `"support-screenshots"` to `setup-storage.ts`'s `BUCKETS` array with `fileSizeLimit`/`allowedMimeTypes` matching `MAX_SCREENSHOT_BYTES`/`ALLOWED_SCREENSHOT_MIME` (Task 04's constants — coordinate the literal values, do not diverge).

Add `"public.support_ticket_notes(ticket_id)"` to `verify-schema.ts`'s `deleteChain`, and a new `change_support_ticket_status` EXECUTE-grant probe (mirrors the `record_skill_mastery()`-style probe pattern this repo already uses for INVOKER, `service_role`-only functions).

## Target Files
- [x] `SOURCE/supabase/schema.sql` (append — new sections for `support_tickets`, `support_ticket_notes`, `change_support_ticket_status`, `support-screenshots` bucket policy, §17 fingerprint literal updated)
- [x] `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT` constant updated to match)
- [x] `SOURCE/supabase/verify-schema.ts` (`deleteChain` gains an entry; new EXECUTE-grant probe for `change_support_ticket_status`)
- [x] `SOURCE/supabase/setup-storage.ts` (`BUCKETS` array gains `"support-screenshots"`)

## Investigation Targets
- `docs/design/support-system-backend-design.md` (§ Agreement Checklist / Schema & DB Enforcement §1-§4 — literal SQL for `support_tickets`/`support_ticket_notes`/`change_support_ticket_status`/`support-screenshots` bucket policy; § Schema & DB Enforcement — apply order steps 1-7; § Data Representation Decision — why new tables/bucket, not reuse of `exam_reports`/`exam-images`; § Minimal Surface Alternatives Elements 1-3; § State Transitions and Invariants; § Migration Strategy)
- `SOURCE/supabase/schema.sql` (the `exam_moderation_log` table's exact strict `revoke all` form, as the sibling pattern `support_ticket_notes` must mirror; `telemetry_log`'s narrower revoke form, as the pattern **not** to copy; every other `grant select (...)`/`revoke all on function ...` statement, for the adjacent-defect sweep below; the `-- @schema-fingerprint-begin` marker and §17 block)
- `SOURCE/lib/schema/schemaFingerprint.ts` (`computeSchemaFingerprint()`, current `SCHEMA_FINGERPRINT` value)
- `SOURCE/supabase/verify-schema.ts` (all 7 checks, especially the `deleteChain` shape and any existing EXECUTE-grant probe for an INVOKER/`service_role`-only function to mirror)
- `SOURCE/supabase/setup-storage.ts` (current `BUCKETS` array shape — `fileSizeLimit`/`allowedMimeTypes` fields)
- `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`, `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`

## Change Category

`Change Category: state-change`

This task introduces new persisted state (`support_tickets`, `support_ticket_notes`, `change_support_ticket_status`, the `support-screenshots` bucket policy). Sweep required: check every other `revoke all on function ... from public, anon, authenticated` statement in `schema.sql` for the same by-name/by-signature precision `change_support_ticket_status` must also use, and confirm `support_ticket_notes`'s revoke form matches `exam_moderation_log`'s strict form exactly (zero policies), not `telemetry_log`'s narrower form (which does grant `authenticated` an own-row insert policy).

## Reference Contracts

| Source | Contract Type | Required Observable Value | Compliance Check |
|---|---|---|---|
| docs/design/support-system-backend-design.md (§ State Transitions and Invariants) | state-lifecycle-negative | "first_status_transition_at is null if and only if status has never left 'new' since creation" | Does `change_support_ticket_status`'s SQL CASE expression only ever set `first_status_transition_at` on the transition where the row's pre-update `status = 'new'`, and leave it untouched on every subsequent call (Y/N)? |

## Investigation Notes

- **`exam_moderation_log` strict revoke form** (`SOURCE/supabase/schema.sql:1092-1093`): `alter table ... enable row level security;` + `revoke all on public.exam_moderation_log from anon, authenticated;` — **zero `create policy` statements of any kind**. This is the exact form `support_ticket_notes` must mirror.
- **`telemetry_log` narrower form** (`SOURCE/supabase/schema.sql:1379-1390`, NOT to copy): `enable row level security;` + `revoke select, update, delete ... from anon, authenticated;` + `revoke insert ... from anon;` (leaves table-level INSERT grant to `authenticated` intact) + `create policy "telemetry_insert_own" ... for insert to authenticated with check (user_id = auth.uid());` — this grants `authenticated` an own-row INSERT path, which `support_ticket_notes` must NOT have (D4/R8/AC-048).
- **`record_exam_result` INVOKER precedent** (`schema.sql:879-937`): the calling-convention model `change_support_ticket_status` follows — `language plpgsql`, no `security definer`, `revoke all on function ...(uuid, numeric, int, int, jsonb, jsonb) from public, anon, authenticated;` then `grant execute ... to service_role;`, both statements naming the function by full signature (not bare name).
- **Design Doc's literal DDL** (`docs/design/support-system-backend-design.md` § Schema & DB Enforcement, lines 495-597) supplies the exact SQL text for all 4 sections (`support_tickets` §1, `support_ticket_notes` §2 strict form, `storage.objects` insert-own policy §3, `change_support_ticket_status` §4) — copied verbatim into `schema.sql`, in the placement order the Design Doc specifies at line 620: `support_tickets` → its RLS policies → `change_support_ticket_status` → `support_ticket_notes` → storage policy.
- **Adjacent-case sweep (Change Category: state-change)** — every existing `revoke all on function ...` statement in `schema.sql` (`grep -n "revoke all on function"`): line 783-784 (`exam_answer_key(text)`, `claim_attempt_answer_key(uuid)` — revoke from `public, anon` only, since these ARE granted to `authenticated` via column-level grants, different case), line 934 (`record_exam_result(uuid,numeric,int,int,jsonb,jsonb)` — `from public, anon, authenticated`), line 1005 (`exam_rating_aggregate()` — `from public`), line 1224 (`schema_foreign_keys()` — `from public, anon, authenticated`), line 1349 (`record_skill_mastery(uuid, jsonb)` — `from public, anon, authenticated`). All use explicit by-name-with-full-signature precision (never a bare function name, never relying on `PUBLIC`-only revoke for service-role-only functions). `change_support_ticket_status(uuid, text)` follows the same precision: `revoke all on function public.change_support_ticket_status(uuid, text) from public, anon, authenticated;` + `grant execute ... to service_role;` — consistent with the `record_exam_result`/`record_skill_mastery`/`schema_foreign_keys` group (service-role-only INVOKER functions), matching their pattern exactly.
- **`support_ticket_notes` revoke form confirmed**: matches `exam_moderation_log` exactly — `enable row level security;` + `revoke all on public.support_ticket_notes from anon, authenticated;`, zero policies. Does NOT match `telemetry_log`'s narrower form.

**Reference Contract evaluation** (state-lifecycle-negative, `first_status_transition_at is null iff status has never left 'new'`): the function's single `update ... returning` statement reads `t.status` (the row's own pre-update value, via the `CASE` expression evaluated in the same `UPDATE`'s `SET` clause) and only assigns `now()` when `t.status = 'new' and p_status <> 'new'`; on every other call (including a second `new`→other, or any `in_progress`/`resolved`→anything call) it falls through to `else t.first_status_transition_at` (unchanged, re-read from the same pre-update row). No read-then-write gap exists because both the guard and the write happen inside one atomic `UPDATE`. **Compliance Check: Y** — evidence: `SOURCE/supabase/schema.sql` (function body, inserted per this task, mirrors `docs/design/support-system-backend-design.md:655-663` verbatim).

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations — in particular, confirm `exam_moderation_log`'s exact strict-revoke SQL text to mirror for `support_ticket_notes`.
- [x] Sweep the adjacent cases per Change Category above; record findings in Investigation Notes.
- [x] Confirm `schemaFingerprint.test.ts`'s current expected value (it will fail once the DDL below changes but the constant hasn't been updated yet — this is the intended failing state before the Green phase's fingerprint update). Confirmed: `npx vitest run lib/schema` failed with `expected 'f525e3095339' to be '2ce144118c30'` before the sync.

### 2. Green Phase
- [x] Author the 4 DDL blocks exactly per Implementation Content above, placed before the `-- @schema-fingerprint-begin` marker.
- [x] Add the `deleteChain` entry + EXECUTE-grant probe to `verify-schema.ts`.
- [x] Add `"support-screenshots"` to `setup-storage.ts`'s `BUCKETS` array.
- [x] Run `computeSchemaFingerprint()` against the finalized `schema.sql` text; update `SCHEMA_FINGERPRINT` in `schemaFingerprint.ts` and the literal in `schema.sql`'s §17 block to match, in the same commit. New fingerprint: `f525e3095339`.
- [x] Run `npm test` (schema fingerprint + FK-parser suites) and confirm green. Confirmed: `npx vitest run lib/schema` → 3 files, 39 tests passed.

### 3. Refactor Phase
- [x] Re-read the full staged diff once more for the `support_ticket_notes` strict-revoke risk and the `change_support_ticket_status` revoke-by-name risk before handing off to Task 02. Confirmed via `git diff`: `support_ticket_notes` uses `revoke all on public.support_ticket_notes from anon, authenticated;` with zero `create policy` statements; `change_support_ticket_status` uses `revoke all on function public.change_support_ticket_status(uuid, text) from public, anon, authenticated;` naming the full signature, then `grant execute ... to service_role;`.

## Quality Assurance Mechanisms
- ESLint (`npm run lint`, `--max-warnings 0`) — Enforces: zero new lint errors/warnings — Config: `SOURCE/eslint.config.mjs`
- TypeScript (`npx tsc --noEmit`) — Enforces: type correctness — Config: `.github/workflows/ci.yml:51-52`
- Vitest (`npm test`) — Enforces: pure-function unit coverage — Config: `SOURCE/vitest.config.ts`
- Schema fingerprint three-way assertion (part of `npm test`) — Enforces: `SCHEMA_FINGERPRINT` ≡ `schema.sql` §17 declared value ≡ recomputed hash — Config: `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts`
- Foreign-key text parser tests (part of `npm test`) — Enforces: every new FK parseable with explicit `on delete` — Config: `SOURCE/lib/schema/__tests__/parseForeignKeys.test.ts`
- `npm run verify:schema` (manual, not in CI) — Enforces: seven checks against a live DB incl. FK reconciliation and fingerprint match — Config: `SOURCE/supabase/verify-schema.ts` — run for real at Task 02

## Operation Verification Methods
- **Verification method**: `npm test` (schema fingerprint + FK-parser suites) run immediately after the DDL is staged, before any manual apply — the smallest unit that proves the staged text is internally consistent before Task 02's live-DB step.
- **Success criteria**: `schemaFingerprint.test.ts` and `parseForeignKeys.test.ts` both green; the §17 literal and `SCHEMA_FINGERPRINT` constant agree.
- **Failure response**: if the fingerprint test fails, re-run `computeSchemaFingerprint()` against the exact finalized text and re-sync both locations before proceeding — do not hand off to Task 02 with a known-stale fingerprint (TD-005's exact failure shape).
- **Verification level**: L3 (staged DDL text + fingerprint update are internally consistent) — the L1 target (a real dev DB shape) is Task 02's responsibility, not this task's.

## Proof Obligations
- **Claim**: `support_ticket_notes` grants `authenticated` (and `anon`) zero privilege of any kind — no select, no insert, no update, no delete (D4/R8/AC-048).
- **Primary failure mode**: a copy-by-proximity of `telemetry_log`'s narrower revoke form (which does grant `authenticated` an own-row insert policy) is used instead of `exam_moderation_log`'s strict form, silently reopening a write/read path on internal triage notes on a minors' product.
- **Boundary to exercise**: DB-level grant/RLS-policy DDL (proven for real, end-to-end, by Task 03's ST-c/ST-d against a live Postgres instance — this task only authors the DDL correctly, it does not itself run against a live DB).
- **State assertion**: N/A at this task's own scope (no code runs against a live DB yet).
- **Mock boundary rationale**: none — this task is pure DDL authorship, no I/O.
- **Residual**: this task's own verification is limited to `npm test`'s fingerprint/FK-parser checks — it does NOT itself prove the revoke is unbypassable by a real JWT; that is Task 03's job, deliberately sequenced after Task 02's apply.
- **Claim**: `change_support_ticket_status` writes `first_status_transition_at` exactly once, on the first transition away from `'new'`, and never overwrites it on a subsequent call (AC-047, `same-value` Failure Mode Checklist category).
- **Primary failure mode**: the CASE expression's guard condition is malformed (e.g. checks the *new* status instead of the row's pre-update status), causing a second/no-op status change to re-stamp or clear the timestamp.
- **Boundary to exercise**: DB-level function DDL (proven for real by Task 13's admin-action int test Group 1, two consecutive calls).
- **State assertion**: N/A at this task's own scope.
- **Mock boundary rationale**: none.
- **Residual**: this task authors the guard condition; Task 13 proves it end-to-end against a live-schema-shaped mocked client, and Task 03/Task 16's RLS regression prove the surrounding grant is correct.
- **Claim**: `intent`/`status` values outside the fixed closed sets are rejected at the DB layer, and `change_support_ticket_status` itself validates `p_status` before writing (`invalid option` Failure Mode Checklist category).
- **Primary failure mode**: a CHECK constraint is missing or too permissive on `intent`/`status`, or `change_support_ticket_status`'s own `if p_status not in (...)` validation is absent, letting an out-of-range value reach persistence through a path that bypasses the application-layer check (task-06/task-13).
- **Boundary to exercise**: DB-level CHECK constraint + function validation DDL (proven for real by Task 03's schema apply plus task-06/task-13's defensive application-layer checks).
- **State assertion**: N/A at this task's own scope.
- **Mock boundary rationale**: none.
- **Residual**: this task authors the CHECK constraints and the function's own validation; the application-layer defensive checks are task-06 (intent) and task-13 (status) responsibilities.

## Completion Criteria
- [x] SQL matches the backend DD's literal blocks exactly for all 4 sections
- [x] `SCHEMA_FINGERPRINT` and the schema.sql §17 value agree, updated in the same commit (`f525e3095339`)
- [x] `npm test` (schema fingerprint + FK-parser suites) green
- [x] `setup-storage.ts`'s `BUCKETS` array and `verify-schema.ts`'s `deleteChain`/EXECUTE-grant probe updated
- [x] The Reference Contract's Compliance Check evaluates to `Y`, with evidence recorded in Investigation Notes (`SOURCE/supabase/schema.sql` function body, see Investigation Notes)
- [x] Each Proof Obligation's DDL-authorship half is met (the DB-level proof itself is Task 03's responsibility)

## Notes
- Impact scope: `SOURCE/supabase/schema.sql` (new sections only, placed before the fingerprint marker), `SOURCE/lib/schema/schemaFingerprint.ts`, `SOURCE/supabase/verify-schema.ts`, `SOURCE/supabase/setup-storage.ts`.
- Scope boundary: do not touch any pre-existing section of `schema.sql` (e.g. `exam_moderation_log`/`telemetry_log` are read-only reference, not edited); do not apply this DDL to any live database in this task — that is Task 02's explicitly separate, manual step; do not implement any TS code that reads/writes the new tables/function here — that begins at Phase 1.
