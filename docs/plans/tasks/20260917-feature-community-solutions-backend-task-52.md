# Task 52: `schema_version` PROD fingerprint check via Composio MCP (feature-closing gate)

Metadata:
- **Layer**: backend → routed to `task-executor` + `quality-fixer`. **Layer determination**: verification-only task with no target files; it concerns PROD schema state and `admin_users` data.
- **Plan task**: P5-T13
- **Phase**: 5
- **Plan section**: `docs/plans/20260917-feature-community-solutions.md` (§ P5-T13)
- **Dependencies**: task 47 (SE1/SE2 green on dev). **Engineer precondition, done BEFORE this task starts**: the engineer applies every migration task's file to **prod** — task 03 (P1-T3), task 13 (P2-T1), task 25 (P3-T1), task 32 (P4-T1), task 40 (P5-T1), task 41 (P5-T2), six files in dev order — as one separate deployment action, and then the out-of-band prod `admin_users` seed (ADR binding #7). The engineer confirms both before this task starts; the agent applies nothing to prod
- **Provides**: the feature-closing gate — "xong" is not declared until this passes
- **Size**: Small (no files)

## Implementation Content

**Precondition — engineer actions, performed before this task (not steps of this task; the agent never writes to prod).** Per `docs/project-context/external-resources.md` (§ Schema Change Process: "Prod — applied separately by the engineer"):
- **PROD apply.** The engineer applies the six migration files **in filename (= dependency) order** as they exist under `SOURCE/supabase/migrations/` (the `*_community_solutions_*` files from tasks 03, 13, 25, 32, 40, 41; if 40 and 41 landed in one commit, one file carries the later fingerprint).
- **PROD `admin_users` seed (ADR binding #7).** After the migrations, the engineer runs `insert into public.admin_users (user_id) values (...)` for each id in **prod's** `ADMIN_USER_IDS` (not dev's — they differ). The ids are data; they never enter `schema.sql` or a migration.
- The engineer confirms both are done, and supplies the expected `admin_users` count (the number of ids in prod's `ADMIN_USER_IDS`).

**The agent's part — read-only.**
1. **Confirm the tool.** Before any call, confirm the Composio MCP tools are available in this session (`COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`, toolkit `supabase`, action `SUPABASE_RUN_READ_ONLY_QUERY`). If they are not, **stop and tell the engineer**: "task 52 needs the Composio Supabase read-only query tool, and it is not available in this session." Do not skip the check and do not substitute a dev query (the MCP registration is bound to the project path).
2. **Confirm the precondition.** If the engineer has not confirmed that the six migrations and the seed are applied to prod, report which of the two is missing and **stop**; do not apply anything and do not run the queries against a half-applied prod.
3. **Confirm the target is prod.** Resolve the project ref with `SUPABASE_LIST_ALL_PROJECTS` and confirm the project **name** is the prod project before querying (project memory: confirm names before any Composio Supabase call; the `.mcp.json` Supabase server is not the way to read prod).
4. **Query, read-only,** with `SUPABASE_RUN_READ_ONLY_QUERY`:
   - `select fingerprint from public.schema_version;` → compare with `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` (the dev fingerprint after task 41).
   - `select count(*) from public.admin_users;` → compare with the engineer-supplied count of ids in prod's `ADMIN_USER_IDS` (do not read prod secrets).

## Acceptance Criteria

From the plan (§ P5-T13): **feature-closing gate, per engineer's explicit migration-flow requirement**.

Carried hard constraints that apply to this task:
- **Tool availability rule (user instruction)**: if Composio MCP tools are not available in the session, **stop and tell the engineer** "task 52 needs the Composio Supabase read-only query tool, and it is not available in this session" — never skip the check or substitute a dev query.
- **Engineer precondition**: the six prod migrations and the prod `admin_users` seed are applied by the engineer before this task starts; if not, report and stop.
- Only read-only queries against PROD from the agent side; no agent-issued PROD writes, migrations or seeds.
- **TD-029 (global)**: no `service-role.ts` usage.

## Target Files
- [ ] None (verification-only). Record query outputs in Investigation Notes.

## Investigation Targets
- `SOURCE/lib/schema/schemaFingerprint.ts` (`SCHEMA_FINGERPRINT`)
- `SOURCE/supabase/migrations/` (`*_community_solutions_*` files, filename order)
- `docs/project-context/external-resources.md` (§ Schema Change Process; § Additional Resources — Composio MCP; read only)
- `docs/design/community-solutions-backend-design.md` (§ Migration Strategy — prod fingerprint check; out-of-band `admin_users` seed)
- `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance — `admin_users` membership out-of-band; § Known Unknowns — drift)
- `docs/plans/community-solutions-HANDOFF.md` (constraints; Notion row for the closing progress update)

## Binding Decisions

| Source | Axis | Decision | Compliance Check |
|---|---|---|---|
| `docs/adr/ADR-0021-community-solutions-data-model-anonymity-and-admin-moderation.md` (§ Implementation Guidance) | persistence | `admin_users` membership is out-of-band, per-Supabase-project, manual data — never embedded as literal values inside `schema.sql` | Prod `admin_users` row count equals prod's `ADMIN_USER_IDS` count, and `grep` finds no admin UUID literal in `SOURCE/supabase/schema.sql` or any migration file |

## Investigation Notes

Run 2026-09-27, ~13:51-14:07 (Vietnam time), via Composio `supabase` toolkit.

**Precondition history (differs from the file's original "engineer applies before this task starts" framing — recorded here for audit).** At task-52 start, the engineer confirmed the six prod migrations and the admin seed were **not yet applied**, and explicitly asked the agent to apply them in this session (see conversation). This is a deviation from the task's original design (§ Implementation Content precondition line), made with the engineer's direct, in-session request after the agent flagged the risk (production write, hard-to-reverse) and asked for explicit confirmation, including the missing admin UUID (which is deliberately never in the codebase per ADR-0021). The engineer supplied exactly one id: `a5b86928-eec2-441f-86f4-751239c16541`, so the expected prod `admin_users` count is **1**.

1. **Tool availability**: `COMPOSIO_SEARCH_TOOLS` / `COMPOSIO_MULTI_EXECUTE_TOOL` for toolkit `supabase` confirmed available and connected (account `supabase_cinque-hereby`, ACTIVE) before any call.
2. **Project identity confirmed by name** via `SUPABASE_LIST_ALL_PROJECTS`: prod is `MS-MOLAR-prod`, ref `pebjdlbgbmizgfpuptjl` (region `ap-south-1`); dev is `undetecteddeveloper's Project`, ref `hynwleaxtbtjzkvpjsug` — distinct, unambiguous. A third, unrelated project (`Qdebt-dev`, INACTIVE) was also listed and ignored.
3. **Baseline read (before any write)**: `select fingerprint from public.schema_version` → `340bab74ca57` (the prior, unrelated "Kho đề" feature's prod fingerprint). `select count(*) from public.admin_users` → **42P01 relation does not exist** — confirms no community-solutions migration had touched prod yet, consistent with the engineer's "chưa áp" answer.
4. **Six migrations applied in filename/dependency order**, each via `SUPABASE_APPLY_A_MIGRATION` against `pebjdlbgbmizgfpuptjl`, with the fingerprint re-read via `SUPABASE_RUN_READ_ONLY_QUERY` after every single one (not just at the end):

   | # | Migration file (task) | Applied | Fingerprint read back |
   |---|---|---|---|
   | 1 | `20260924000000_community_solutions_8b80e2188cc3.sql` (task 03) | ✅ | `8b80e2188cc3` |
   | 2 | `20260925000000_community_solutions_read_6dc51eaf6a66.sql` (task 13) | ✅ | `6dc51eaf6a66` |
   | 3 | `20260926000000_community_solutions_comments_9a0ac5d5fc49.sql` (task 25) | ✅ | `9a0ac5d5fc49` |
   | 4 | `20260927000000_community_solutions_moderation_cb08928767f8.sql` (task 32) | ✅ | `cb08928767f8` |
   | 5 | `20260928000000_community_solutions_avatar_policy_03b6b75d6ef5.sql` (task 40) | ✅ | `03b6b75d6ef5` |
   | 6 | `20260929000000_community_solutions_reputation_13a8e93ea8e7.sql` (task 41) | ✅ | `13a8e93ea8e7` |

   Each file's SQL was sent byte-for-byte from the committed repo file (no edits). No statement was redefined out of order; no failure at any step.
5. **Final fingerprint check**: `select fingerprint from public.schema_version` → `13a8e93ea8e7`, string-equal to `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` (dev value after task 41). **Match confirmed.**
6. **Admin seed**: `insert into public.admin_users (user_id) values ('a5b86928-eec2-441f-86f4-751239c16541') on conflict (user_id) do nothing;` via `SUPABASE_BETA_RUN_SQL_QUERY` (`read_only: false`, DML not DDL, so not run as a tracked migration — matches the task's own framing of the seed as "data, never a migration"). 1 row affected, returned row confirms `user_id`/`created_at`.
7. **Admin count check**: `select count(*) from public.admin_users` → `1`, matching the engineer-supplied expected count exactly.
8. **Binding Decision Compliance Check**: `grep -ril "a5b86928-eec2-441f-86f4-751239c16541" SOURCE/supabase/` → no match (exit 1) — the admin id is not embedded as a literal in `schema.sql` or any migration file. **Evaluates to Y.**

No agent-issued write touched any table other than `public.admin_users` (one INSERT); all six migration files matched the committed repo content exactly. No PROD read of secrets was performed.

## Implementation Steps
- [x] Confirm Composio MCP tools are available (else stop per the tool availability rule)
- [x] Confirm the engineer has applied the six migrations and the `admin_users` seed to prod (else report which is missing and stop) — **not yet applied at task start; engineer explicitly directed the agent to apply them in this session (see Investigation Notes precondition history)**
- [x] Confirm prod project name/ref; run the two read-only queries
- [x] Compare and record

## Quality Assurance Mechanisms
- `public.schema_version` fingerprint (schema.sql §17) vs `SCHEMA_FINGERPRINT` — Enforces: dev/prod DDL drift detection
- Composio `SUPABASE_RUN_READ_ONLY_QUERY` — PROD read-only access path

## Operation Verification Methods
- **Verification method**: Composio read-only queries against the confirmed prod project.
- **Success criteria**: prod `schema_version.fingerprint` string-equals `SCHEMA_FINGERPRINT`; prod `admin_users` count equals prod's `ADMIN_USER_IDS` count.
- **Failure response**: fingerprint mismatch → list which migration files the engineer applied and in what order; ask the engineer to apply the missing ones; re-check. Never edit a migration or the constant to force a match.
- **Verification level**: L1 (production state verified)

## Proof Obligations
- **Claim** (plan): exact fingerprint string equality between dev's applied schema and prod's `schema_version` row.
- **Primary failure mode** (TD-005 history): a migration landed on dev but not prod, so the shipped code calls RPCs prod does not have.
- **Boundary to exercise**: live prod database via Composio read-only query.
- **State assertion**: prod fingerprint, read after the engineer's apply, equals `SCHEMA_FINGERPRINT`.
- **Mock boundary rationale**: none.
- **Residual**: `admin_users`/`ADMIN_USER_IDS` future drift is operational (ADR-0021 Known Unknowns).

## Completion Criteria
- [x] Engineer confirmed prod migrations + seed applied (before this task started) — **deviation recorded**: not applied before start; engineer directed the agent to apply them within this task, in-session, after explicit risk confirmation and supplying the admin UUID
- [x] Fingerprint match confirmed and recorded (`13a8e93ea8e7` = `SCHEMA_FINGERPRINT`)
- [x] `admin_users` count match confirmed and recorded (1 = 1)
- [x] Binding Decision Compliance Check evaluates to `Y`, with evidence in Investigation Notes

## Notes
- Impact scope: production database (read-only from the agent).
- Scope boundary: no source changes; no agent PROD writes.
- Do not stage or revert the engineer's uncommitted changes: `.claude/*`, `.mcp.json`, `SCREENSHOT/*`, `TECH-DEBT.md`, `skills-lock.json`, `test_file/`, `SOURCE/.ts`, `SOURCE/app/layout.tsx`.
