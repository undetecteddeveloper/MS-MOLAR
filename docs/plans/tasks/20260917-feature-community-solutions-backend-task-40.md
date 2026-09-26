# Task 40: DB Migration — avatar Storage policy `avatars_select_community_visible` (dedicated task)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`
- **Plan task**: P5-T1
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T1)
- **Dependencies**: task 13 (P2-T1 — published, non-anonymous solutions exist to test visibility), task 25 (P3-T1 — visible comments exist). Phase 4 completion signed off.
- **Provides** (backend DD v1.9 § Migration Strategy "Migration ownership", task-40 row — **1 function + 1 Storage policy**): `community_avatar_owner_visible(uuid)` + Storage policy `avatars_select_community_visible`, consumed by task 42 (batch signer) and task 46 (wiring)
- **Size**: Medium (5 files)

## Implementation Content

Edit `schema.sql` with the backend DD v1.9 SQL for:
1. **`community_avatar_owner_visible(p_owner_id)`** — `language sql`, `SECURITY DEFINER`, `stable`, `set search_path = public, pg_temp`; `true` only when the owner has **either** ≥1 **published** solution with `show_profile` on a **published** exam whose author is **not banned**, **or** ≥1 **visible, non-anonymous** comment under a **published** solution, on a **current** question, under a note of **≥15 words**, on such an exam — and **not** when that comment is the writer's own comment on their own `show_profile = false` solution (the S4 condition). Recomputed on every call (no cache); `revoke all … from public, anon` then `grant execute … to authenticated`.
2. **`avatars_select_community_visible`** on `storage.objects` — `for select to authenticated using (bucket_id = 'avatars' and community_avatar_owner_visible((storage.foldername(name))[1]::uuid))`. **Additive** to ADR-0016's `avatars_select_own` — `avatars_select_own` is not modified. Narrow scope: authenticated-only, same private bucket, short-lived signed URLs — explicitly not the "public author profiles"/"unauthenticated reads" scenario ADR-0016's Kill Criteria reserve for a new ADR.

**This task tests its own migration** (backend DD v1.9 § Integration Verification Points, binding "Task ownership": "tasks 40 and 41 test their own migrations"). Add these `test-rls.ts` Storage cases — a non-owner session tries `createSignedUrl` on the owner's avatar object after each state change, and the owner's own `avatars_select_own` path keeps working throughout:

- **Baseline / S14**: the owner has no visible non-anonymous community content → the non-owner's sign **fails**; the owner publishes a solution with `show_profile = true` → it **succeeds**; the owner switches `show_profile = false` on their only such content → it **fails again** immediately (the function recomputes on every call).
- **AC-004**: with the owner's only qualifying content on one exam, the harness setup client sets that exam `draft` → `community_avatar_owner_visible` is `false` and the sign fails; the same with the exam's author banned; restoring either restores the signature.
- **S4 (moved here from task 27 by work plan § Open Items SN-1, resolved 2026-09-20)**: the owner's only content besides their `show_profile = false` solution is their **own non-anonymous comment on that solution** → `community_avatar_owner_visible(<writer id>)` returns **`false`** and the viewer's session cannot sign the writer's avatar object. (Task 27 creates the same fixture for its identity-masking half but does not run this assertion.)
- **S7**: the owner's only qualifying comment is under a **draft** or **hidden** solution → `false`, sign fails; publishing/restoring the solution restores it.
- **AC-047**: the harness setup client removes the comment's question from `exams.question_ids` → `false`, sign fails; putting the id back restores it.
- **AC-048**: the harness setup client shortens that question's note below 15 words or deletes it → `false`, sign fails; restoring the 15-word note restores it.

Then run the fixed migration chain.

## Acceptance Criteria

From the plan (§ P5-T1): **AC-004, AC-039 (avatar half), AC-047, AC-048, AC-071, S4, S7, S14**.

Carried hard constraints that apply to this task:
- **Migration chain (fixed order)**: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint → `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` + §17 `schema_version` upsert (last statement) → `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_avatar_policy_<fingerprint>.sql` containing only this task's statements → apply to dev: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file <path>` → `npm run verify:schema`. **No PROD apply** (task 52 only).
- **Migration statement immutability**: no earlier statement redefined.
- `avatars_select_own` (schema.sql ~line 2134) unchanged.
- **TD-029 (global)**: zero exported operations and zero direct write surfaces added to `SOURCE/lib/supabase/service-role.ts`.

## Target Files
- [x] `SOURCE/supabase/schema.sql`
- [x] `SOURCE/supabase/migrations/<YYYYMMDDHHMMSS>_community_solutions_avatar_policy_<fingerprint>.sql` (new) → `20260928000000_community_solutions_avatar_policy_03b6b75d6ef5.sql`
- [x] `SOURCE/lib/schema/schemaFingerprint.ts`
- [x] `SOURCE/supabase/verify-schema.ts` (probe judged by the **message** per backend DD v1.9 § Migration Strategy "Probe rule (v1.3)": anon client → message starting `permission denied for function`; probe user → a returned `true`/`false`/rows with **no error** (rule 3 — this function's body never raises `42501`); plus the policy-existence check)
- [x] `SOURCE/supabase/test-rls.ts` (Storage case)

## Investigation Targets
- `SOURCE/supabase/schema.sql` (`avatars_select_own` at ~lines 2134–2165; Storage policy conventions)
- `SOURCE/supabase/setup-storage.ts` (avatars bucket configuration)
- `SOURCE/supabase/test-rls.ts` (existing Storage cases in Phần 2 R-a…R-o and Phần 8 ST-*)
- `SOURCE/features/auth/actions.ts` (`changeAvatar` — object key shape `{owner_uuid}/{filename}`)
- `SOURCE/components/shared/Avatar.tsx` (the fail-closed `src:null → initials` fallback that must keep working)
- `docs/design/community-solutions-backend-design.md` (§ Data Contracts — `user_profiles.community_comments_last_read_at` and `avatars_select_community_visible`)
- `docs/design/community-solutions-backend-design.md` (§ Minimal Surface Alternatives — Element 3: `avatars_select_community_visible` Storage policy, confirmed Alternative A)
- `docs/design/community-solutions-backend-design.md` (§ Integration Verification Points — the avatar parts of the M5/S4 case, the AC-004 gate, the AC-048 note condition and the AC-047 current-question case, each marked "task 40, which tests its own migration")
- `docs/plans/20260917-feature-community-solutions.md` (§ Open Items — SN-1: the S4 avatar assertion moves here from task 27)
- `docs/design/community-solutions-backend-design.md` (§ Integration Point Map — `avatars` Storage bucket new policy)
- `docs/adr/ADR-0016-avatar-storage-visibility-and-read-path.md` (§ Decision; § Kill Criteria)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance)
- `docs/prd/community-solutions-prd.md` (AC-039, S14)

## Change Category

`Change Category: boundary-change`

This task widens who may sign objects in the private `avatars` bucket. Adjacent cases to sweep: `avatars_select_own` (must be byte-identical), `SOURCE/features/auth/actions.ts` `changeAvatar` (writes the object path this policy parses), `SOURCE/lib/auth/getCurrentUser.ts` (self avatar signing), and `SOURCE/components/shared/Avatar.tsx` (fallback consumer).

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | dependency_direction | Grant `EXECUTE` explicitly and narrowly (`authenticated` only, never `anon`); `revoke all ... from public, anon` before every `grant` on a new function | `community_avatar_owner_visible` is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only, and the Storage policy is `to authenticated` |

## Boundary Context
(From the work plan's Connection Map — "`avatars` Storage object path → signed URL"; this task is the producer)
- **Producer**: backend `avatars_select_community_visible` policy + `community_avatar_owner_visible()`.
- **Consumer**: `features/solutions/queries.ts` cross-user avatar batch signer (task 42) → `AuthorIdentity.avatarUrl`.
- **Serialized format** (verbatim): "Storage object path `{owner_uuid}/{filename}` → signed URL string with expiry".
- **Consumer parse rule** (verbatim): "Batch-sign per screen render (one Storage call, not per-row), following `resolveSignedImageUrls`' shape; a `null`/failed sign is indistinguishable from 'no avatar' (fail-closed to `Avatar.tsx`'s initials fallback)".
- **Expected signal** (verbatim): "Named author's avatar renders for self AND non-self rows once the policy is live; renders initials with no error if not".
- **Roundtrip check this producer must satisfy**: the first path segment of an object key written by `changeAvatar` casts to the owner's uuid that `community_avatar_owner_visible` evaluates.

## Investigation Notes
(Append observations before implementation. Record the Binding Decision Compliance Check result.)

**Investigation Targets read (2026-09-27, pre-implementation):**
- `schema.sql` §"Storage policies — bucket avatars" (l.2114-2165): four `avatars_*_own` policies, all keyed on `bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text`; `avatars_select_own` is `for select to authenticated`. Community blocks are §20a-h (Phase 1), §21 (Phase 2), §22 (Phase 3), §23 (Phase 4, task 32), all placed before §17; §17 upsert is the last statement at fp `cb08928767f8`. New block goes in as §24 directly above §17.
- `setup-storage.ts`: `avatars` is private (`public:false`), size/MIME limits only — no Storage-side read rule; reads are decided by `storage.objects` RLS alone.
- `features/auth/actions.ts:282` `changeAvatar` writes key `${user.id}/${crypto.randomUUID()}.${ext}` → `(storage.foldername(name))[1]` is always the owner's uuid text, so the `::uuid` cast in the new policy is total for every key the app writes (roundtrip check of the Boundary Context). `avatars_insert_own` stops any `authenticated` write outside the owner's own uuid folder, so no non-uuid first segment can exist in `avatars` from a client.
- `lib/auth/getCurrentUser.ts:113-136` signs the caller's OWN avatar with the session client (`createSignedUrl`) — served by `avatars_select_own`, untouched; policies are OR-combined, so an additive policy cannot narrow it.
- `components/shared/Avatar.tsx`: `src:null` / failed load → initials; a refused sign is indistinguishable from "no avatar" (fail-closed), unchanged by this task.
- `test-rls.ts`: AV-a…AV-d (Phần 8) cover `avatars_*_own` (AV-c: A cannot sign B's avatar — stays true because B has no community content at that point; every community Phần cleans its fixture). Community Phần 10-13 use service_role as the harness setup client, `ensureUser`/`signInAs` for A/B/C/D, `ban_duration: "24h"`/`"none"` for AC-004 bans.
- `verify-schema.ts`: probe rule (v1.3) — anon → message starts `permission denied for function`; probe user rule 3 → no error. The probe user is `rlstesta` (A in test-rls). There is no catalog read path for policies (only `schema_foreign_keys()` for FKs) and the DD ownership table allows task 40 exactly 1 function + 1 policy, so the policy-existence check must be behavioural (dev-only fixture, cleaned in `finally`, same precedent as mục 5's draft-exam fixture).
- DD v1.9 § Data Contracts `avatars_select_community_visible` (l.2337-2422): SQL copied verbatim (function body, revoke/grant, leading comment, drop/create policy); the `alter table user_profiles add column community_comments_last_read_at` in that block is task 25's (already landed) — not repeated.
- ADR-0016 Kill Criteria: only unauthenticated reads / public bucket require a new ADR — this policy is `to authenticated`, bucket stays private. ADR-0021 Implementation Guidance: `revoke all … from public, anon` before `grant execute … to authenticated`.

**Adjacent case sweep (Change Category boundary-change):** `avatars_select_own` byte-identical (not edited); `changeAvatar` key shape is uuid-first (above); `getCurrentUser` self-sign path = `avatars_select_own`, asserted in every new state as "owner still signs own avatar"; `Avatar.tsx` fallback unchanged. Residual noted: the new policy's `::uuid` cast would raise on an `avatars` row whose first folder segment is not a uuid — impossible via `authenticated` writes (insert policy), possible only via a service_role write; no current code path does that. Planner evaluates `bucket_id = 'avatars'` (cheap qual) before the SECURITY DEFINER call (cost 100, not inlinable), so objects in other buckets never reach the cast — confirmed by R-m/R-n/R-o/ST-e staying green after apply.

**Planned approach (Binding Decisions, axis dependency_direction):** the function is followed by `revoke all on function public.community_avatar_owner_visible(uuid) from public, anon;` then `grant execute … to authenticated;` only, and the policy is `for select to authenticated` — pre-implementation evaluation: **Y**.

**Implementation record (2026-09-27):**
- `schema.sql` §24 (above §17): DD v1.9 SQL verbatim — `create or replace function public.community_avatar_owner_visible` (sql, stable, security definer, `search_path = public, pg_temp`), `revoke all … from public, anon`, `grant execute … to authenticated`, DD's "Additive to ADR-0016…" comment, `drop policy if exists` + `create policy "avatars_select_community_visible" … for select to authenticated`. `avatars_select_own` untouched (the only `-` line in the schema.sql diff is the old §17 fingerprint).
- Fingerprint `cb08928767f8` → **`03b6b75d6ef5`** (`schema:plan`: 416 statements, 5 new = #408-#412); `SCHEMA_FINGERPRINT` + §17 upsert updated. Migration `SOURCE/supabase/migrations/20260928000000_community_solutions_avatar_policy_03b6b75d6ef5.sql` = §24 block + upsert only.
- Applied to DEV only (`hynwleaxtbtjzkvpjsug`, `supabase db query --linked --file`). Catalog read-back: `schema_version.fingerprint = 03b6b75d6ef5`; function ACL `{postgres, authenticated, service_role}` (no `anon`, no `PUBLIC`), `prosecdef = true`; `pg_policies` shows `avatars_select_community_visible` SELECT `{authenticated}` with qual `bucket_id = 'avatars' AND community_avatar_owner_visible(((storage.foldername(name))[1])::uuid)`, and `avatars_select_own` qual unchanged. Dev `avatars` bucket: 0 objects with a non-uuid first segment. NOT applied to PROD (task 52).
- `verify-schema.ts` mục 15: anon → `permission denied for function` (rule 1); probe user → boolean, no error (rule 3); policy-existence measured behaviourally on a dev-only self-cleaning fixture (published exam + owner B's published `show_profile=true` solution + avatar object in B's folder): probe user (A ≠ owner) signs → policy present; anon cannot sign (Kill Criteria); `show_profile=false` → next sign refused (policy wired to the function). Skipped with ⊘ on non-dev targets.
- `test-rls.ts` Phần 14 (32 checks; owner B, viewer C, other commenter D, exam author A): every state measures function value + C's `createSignedUrl` + owner's own sign. Cases: baseline; S14 (on → off → on); Kill Criteria anon; AC-004 solution branch (exam draft/restore, author ban/unban); S4 (writer's own non-anonymous comment on own `show_profile=false` solution → false; D's comment on the same solution → D signable, B still not); comment branch positive; AC-039 anonymous comment and S19 hidden comment (each restored); S7 draft + hidden (each restored); AC-047 (question removed/restored); AC-048 (14 words/restore, note deleted/recreated); AC-004 comment branch. `finally` unbans A if still banned, removes both avatar objects, cleans the fixture.
- RED (before migration): 31 of the 32 new checks failed (`PGRST202`, and `C ký=false` in every "visible" state); the anon Kill-Criteria check passed as expected. GREEN (after): 32/32 pass; R-m/R-n/R-o/ST-e/AV-a…AV-d remain green (other buckets unaffected by the `::uuid` cast). Whole file: only the 4 pre-existing Rating failures (R-p/R-r/R-t/R-u, unrelated, see work plan row 16). Residue check on dev after both runs: 0 fixture exams, 0 fixture objects, 0 banned rls-test accounts.
- TD-029: `SOURCE/lib/supabase/service-role.ts` not touched.

**Binding Decision Compliance Check (Exit Gate re-evaluation):**
| Axis | Compliance Check | Result | Evidence |
|---|---|---|---|
| dependency_direction | `community_avatar_owner_visible` is followed by `revoke all … from public, anon` then `grant execute … to authenticated` only, and the Storage policy is `to authenticated` | **Y** | schema.sql §24 statement order (#408 create → #409 revoke → #410 grant); dev `proacl` has no `anon`/`=X` PUBLIC entry; `pg_policies.roles = {authenticated}`; verify:schema anon probe "permission denied for function" ✓; test-rls + verify:schema anon sign refused ✓ |

**Boundary roundtrip:** a `changeAvatar`-shaped key `{owner_uuid}/{filename}` (test fixture `${userId}/rls-cs40-avatar.png`) parses via `(storage.foldername(name))[1]::uuid` to the owner id the function evaluates — proven by the S14/S4/comment-branch "C KÝ ĐƯỢC" states passing.

## Implementation Steps (TDD: Red-Green-Refactor)

### 1. Red Phase
- [x] Read all Investigation Targets and record key observations
- [x] Sweep the adjacent cases named in Change Category
- [x] Write the `test-rls.ts` Storage cases (baseline/S14, AC-004, S4, S7, AC-047, AC-048); run them before the migration and confirm the "can sign once visible" assertion fails

### 2. Green Phase
- [x] Complete `schema.sql`; `npm run schema:plan`; constant + upsert; migration; apply to dev; `npm run verify:schema`
- [x] Run the Storage cases and confirm every state passes (baseline/S14's three states plus the AC-004, S4, S7, AC-047 and AC-048 cases, each with its restore step)

### 3. Refactor Phase
- [x] Keep the policy comment explaining why it is additive to ADR-0016
- [x] Confirm all checks remain green

## Quality Assurance Mechanisms
- `schemaFingerprint.test.ts` + `migrationsMatchSchema.test.ts` + `parseForeignKeys` + `bannedAuthorVisibility.test.ts` — Config: `SOURCE/lib/schema/__tests__/*.test.ts`
- `npm run verify:schema` — Config: `SOURCE/supabase/verify-schema.ts`
- `npx tsx supabase/test-rls.ts` — Config: `SOURCE/supabase/test-rls.ts`
- `npm test`, `npx tsc --noEmit`, commit gate list (run inside `SOURCE/`)
- **Skeleton lane rule (decomposer resolution R1)**: `test:localdb` with `--exclude "tests/e2e/service/community-solutions.service.e2e.test.ts"` until task 47.

## Operation Verification Methods
- **Verification method**: run the migration chain against dev; `npm run verify:schema`; `npx tsx supabase/test-rls.ts`.
- **Success criteria**: `verify:schema` green; every Storage case green — baseline/S14 (no content → refused; visible content → signs; `show_profile` off → refused again) plus AC-004 (exam `draft`, author banned), S4 (writer's own non-anonymous comment on their anonymous solution → `false`), S7 (comment under a draft/hidden solution), AC-047 (question removed from `question_ids`) and AC-048 (note shortened below 15 words or deleted), each restored afterwards.
- **Failure response**: if unauthenticated signing becomes possible, stop — that is ADR-0016's Kill Criteria scenario and requires a new ADR.
- **Verification level**: L2 (real-DB Storage case added and passing)

## Proof Obligations
- **Claim** (backend DD, verbatim): "`community_avatar_owner_visible()` recomputes on every call (no cache) — toggling `show_profile` off immediately removes visibility for future signs, matching S14."
- **Primary failure mode**: a non-owner can still sign the avatar after the owner switches to anonymous, re-identifying them.
- **Boundary to exercise**: live Storage `createSignedUrl` from user B's session against user A's avatar object.
- **State assertion**: A has no visible content → B's sign fails; A publishes with `show_profile=true` → B's sign succeeds; A sets `show_profile=false` (only content) → B's sign fails again.
- **Mock boundary rationale**: none — real dev Storage + Postgres.
- **Residual**: the batch-per-screen consumer behaviour is proven in task 42.

- **Claim** (S4, moved here by SN-1): a writer's own non-anonymous comment on their own `show_profile = false` solution does **not** make their avatar signable — `community_avatar_owner_visible(<writer id>)` is `false`.
- **Primary failure mode**: the comment branch omits the S4 carve-out, so the writer of an anonymous solution is re-identified by the avatar of the one comment they wrote under it.
- **Boundary to exercise**: live `community_avatar_owner_visible` and a live `createSignedUrl` from another eligible viewer's session against the writer's avatar object.
- **State assertion**: writer's only content = the anonymous solution + their own non-anonymous comment on it → `false` and sign refused; a non-anonymous comment by a **different** user on the same solution makes that user's avatar signable, not the writer's.
- **Mock boundary rationale**: none — task 27 creates the same fixture for the identity half but does not run this assertion (SN-1).
- **Residual**: the identity-masking half of S4 is task 27's.

## Completion Criteria
- [x] All added probes/tests pass
- [x] Operation verified per Operation Verification Methods above
- [x] Each Proof Obligation is met
- [x] Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: tasks 42 and 46; task 47 (SE2) asserts the masked avatar path is `null` for anonymous rows independently of this policy.
- Scope boundary: `avatars_select_own` untouched; no PROD apply.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`. Stage only this task's files by explicit path.
