# External Resources

Last updated: 2026-09-18 (drift-only correction — theme name, migration flow and the two-environment split brought back in line with the repo; no new resources, nothing else re-verified since the 2026-08-16 refresh)

This file records the external resources available to this project and how to access them. AI agents and contributors consult this file when work depends on resources outside the repository. Feature-specific identifiers belong in the consuming UI Spec or Design Doc, not here — this file holds environment-stable facts only.

> Environment summary: MS-MOLAR is a Next.js 16 (App Router) + Supabase app, **deployed on Vercel** (region `sin1`/Singapore, region choice is deliberate — colocated with Supabase prod and VN users, not a default). Production branch is `main`; feature branches get automatic Preview deploys. **Two Supabase projects**: a dedicated prod project (`Production` env scope) and a separate dev project (`Preview` + local env scope) — deliberately split so preview deploys and local dev never touch real user data. DDL ships as Supabase CLI migrations in `SOURCE/supabase/migrations/` with `schema.sql` canonical (TD-005 closed 2026-08-31 — see Migration History). GitHub Actions CI (`.github/workflows/ci.yml`) blocks merge on lint (`eslint --max-warnings 0`), `tsc --noEmit`, and `npm test` (TD-010, closed 2026-08-04) — Vercel's own build does not run these.

## Frontend

### Design Origin
- Status: present
- Source type: token file in the repository (no separate spec doc)
- Location: `SOURCE/app/globals.css` — the sole source of truth for the tokens of the **"Đêm hội"** theme (dark, shipped 2026-09-14). There is **no light mode**: the file states it outright — no `.dark` block, no toggle, no `dark:` class in the repo; adding one later means building a second contrast table, not flipping a variant. ("Mực & Sơn Mài" is an earlier, replaced palette.) `PROJECT_OVERVIEW.md §2` (repo root) was **deleted 2026-08-06** (deliberate — see `.claude/MEMORY.md` §3); design rationale/history lives in `.claude/MEMORY.md` §3 and `docs/design/ui-refactor-san-truong-design.md`, not in a repo file.
- Access method: file read (`globals.css` for tokens; `.claude/MEMORY.md` for rationale/hard rules)

### Design System
- Status: present
- Source type: internal package / ad-hoc in-repo components (no external catalog, no Storybook)
- Location: `SOURCE/features/exams/components/`, `SOURCE/features/auth/components/`, base primitives in `SOURCE/components/ui/` (base-ui + cva); design tokens in `SOURCE/app/globals.css`
- Access method: file read / import within the repo

### Guidelines
- Status: present
- Source type: project files
- Location: `SOURCE/app/globals.css` + `.claude/MEMORY.md` §3 (visual rules — see Design Origin above), plus `PROJECT_OVERVIEW.md` (repo root) for process conventions. Session progress: Notion (see `.claude/MEMORY.md`); technical debt: `TECH-DEBT.md` (repo root, moved from `docs/` 2026-08-08)
- Access method: file read

### Visual Verification Environment
- Status: present
- Tool type: local dev server + browser automation CLI + manual inspection
- Entry: `npm run dev` (Next.js local dev server); UI audits drive the **Playwright CLI from inside `SOURCE/`** — `npm run pw` (`SOURCE/scripts/pw/cli.mjs`), the project convention recorded in `.claude/MEMORY.md` §"Pha 3" item 2, *not* the MCP server
- Known gap (not fixed here): the `playwright` MCP server declared in `.mcp.json` writes to `--output-dir E:/StemWeb_project/MS-MOLAR/…`, a path that is not this checkout. Left as-is deliberately — `.mcp.json` is engineer-owned.

## Backend

### Database Schema Source
- Status: present
- Source type: schema file in the repository (no database MCP)
- Location: `SOURCE/supabase/schema.sql` — tables `exams`, `questions`, `user_profiles`, RLS policies
- Access method: file read for the canonical source; DDL reaches a live database only through the migration flow below (see Migration History), not by ad-hoc SQL Editor edits

### Migration History
- Status: present
- Tool: **Supabase CLI migrations** (landed 2026-08-31 on both databases; TD-005 closed — `TECH-DEBT.md`). `SOURCE/supabase/schema.sql` stays **canonical** — it is what a human writes and the only place the schema is explained; `SOURCE/supabase/migrations/` is the **apply mechanism**, answering "how far has this database run", which an idempotent file cannot.
- Location: `SOURCE/supabase/migrations/` — 8 files named `<timestamp>_<description>_<12-hex fingerprint>.sql`, the fingerprint being `schema.sql`'s value **after** that migration (head: `20260913000000_attempt_answer_ceiling_8000_187d3ed24f0c.sql`). Drift gate: `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` goes red both ways — `schema.sql` edited without a migration, or a migration written without updating `schema.sql`.
- Apply trigger: **manual, one statement at a time.** `npm run schema:plan` (`SOURCE/scripts/schema-plan.ts`) splits `schema.sql` into a numbered statement list (`-- --emit <dir>` writes one file each) and refuses when the declared fingerprint differs from the computed one; the migration file replays those statements verbatim; then `npm run verify:schema` (`SOURCE/supabase/verify-schema.ts`) reads the fingerprint back with a real query. One statement per apply is the *unit*, not extra caution: the tooling has been observed to run the first half of a `revoke …; grant …;` pair, swallow the second, and still report success.
- Still **not a full migration framework**: no rollback/down-migration, and the drift gate is syntactic rather than SQL-semantic (proving "baseline + migrations = schema.sql" needs a shadow DB via `supabase db diff`, i.e. Docker, unavailable on this machine).

### Secret Store
- Status: present
- Service: **local** — environment variables loaded from `SOURCE/.env.local` (gitignored, never committed). **Deployed** — Vercel Environment Variables, scoped per-environment (`Production` vs `Preview`; see deployment note below and `NEXT_PUBLIC_SITE_URL`/`ADMIN_USER_IDS` caveats there).
- Access method: Next.js loads env vars at runtime; local scripts read `SOURCE/.env.local` directly; deployed functions read Vercel's injected env. Keys present (local `.env.local`, confirmed 2026-08-08): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + server via `@supabase/ssr`), `SUPABASE_SERVICE_ROLE_KEY` (server/scripts only — bypasses RLS, never shipped to client, guarded by `npm run check:bundle` in CI), `GEMINI_API_KEY` (server-only, `SOURCE/lib/ugc/gemini.ts`, guards import via `server-only` package), `ADMIN_USER_IDS`, `KV_REST_API_URL` / `KV_REST_API_TOKEN` (Upstash Redis — see Rate Limit Store below). (Record only the mechanism, never secret values.)

### Rate Limit Store (Upstash Redis)
- Status: present — added 2026-08-07 (TD-008)
- Service: Upstash for Redis, provisioned via Vercel Marketplace, region `sin1` (colocated with the Vercel function region), free tier (`autoUpgrade=false`)
- Location: `SOURCE/lib/security/rateLimitStore.ts` (Redis-backed authoritative counter) + `SOURCE/lib/security/rateLimit.ts` (in-process RAM fallback if Redis is unreachable — fails closed, never opens the gate)
- Access method: `@upstash/redis` client reading `KV_REST_API_URL` / `KV_REST_API_TOKEN` from env
- Known gap: keyed on `user.id` only — unauthenticated traffic is uncounted (TD-013, open; blocked on a Vercel Pro plan decision for edge-level protection)

### Payment Gateway (payOS)
- Status: **decided, NOT yet provisioned** — the merchant account exists but **eKYC is not activated**, so no credential can be issued yet. This is the stated reason the Subscription feature is being built **UI-first with the backend deferred**. Recorded here as a *pending* resource on purpose: a downstream agent must not read its absence as "no payment provider chosen".
- Service: **payOS** (A2A / VietQR, by Casso). Selected in `docs/adr/ADR-0013-payment-provider-and-prepaid-period-model.md`; product rationale in `docs/prd/subscription-prd.md` D3. Individual merchant registration via CCCD; no per-transaction fee for individuals/HKD from 2026-01-23.
- Access method (once provisioned): HTTPS to the single documented base URL `https://api-merchant.payos.vn`. `POST /v2/payment-requests` creates an order (`orderCode`, `amount`, `description`, `returnUrl`, `cancelUrl`, `signature`, optional `expiredAt`); `GET /v2/payment-requests/{id}` queries status by `orderCode` (`PENDING` / `SUCCEEDED` / `CANCELLED`) — this is what makes active reconciliation a supported query rather than a workaround. Webhooks are signed HMAC-SHA256 over the alphabetically key-sorted `key=value&…` serialisation, keyed by a rotatable per-integration **checksum key**.
- Credentials: **none present in any environment yet.** When issued they follow the existing Secret Store mechanism (Vercel env vars, per-environment scope; `SOURCE/.env.local` locally) — client id / api key / checksum key, server-only, never `NEXT_PUBLIC_*`. Register them in `SOURCE/lib/env/checkEnv.ts` in the same change that first reads them.
- **No sandbox is documented** (`payos.vn/docs/api` lists only the production host, verified 2026-08-16). PRD **U1** is open and owned by the engineer; its stated default if unanswered is "no sandbox", meaning end-to-end verification costs a small real-money transaction on production, pre-approved. Do not assume a test environment exists.
- Environment caveat that bites here specifically: `webhooks.confirm(url)` needs a **stable public URL**, and Vercel Preview deploys get a new URL every build (see Deployment Trigger below). The webhook can therefore only be registered against the **production domain**; Preview deploys will never receive one, and any end-to-end test on Preview must go through the active-reconciliation path instead.
- Deferred decision: webhook trust boundary, signature-verification placement, replay defence, and the `PUBLIC_PATHS` change — **ADR-0014, not yet written**, belongs with the backend Design Doc.

### Background Job Infrastructure
- Status: not applicable — no queue/worker/cron in this project. Batch scripts (e.g. seeding, skill tagging) are manually-triggered one-off runs via `npx tsx`, not scheduled or queued jobs.

## API

### API Schema Source
- Status: not applicable — no separate API contract (no OpenAPI/GraphQL/proto). Server logic is Next.js Server Actions (`SOURCE/features/auth/actions.ts`, `SOURCE/features/exams/actions.ts`, `queries.ts`) calling the Supabase client directly; the API surface is code-first.

### Mock Environment
- Status: present
- Source type: hand-written fixtures + live local dev server
- Entry: `SOURCE/lib/fake-data/` (e.g. `exams.ts`) as seed/mock data; `npm run dev` for the running app

### Authentication Method
- Status: present
- Mechanism: session cookie via `@supabase/ssr` (`SOURCE/lib/supabase/server.ts`, `client.ts`, `middleware.ts`); Supabase Auth (email/password + OAuth callback at `SOURCE/app/auth/callback/route.ts`)
- Credential source: Supabase project keys in `SOURCE/.env.local` (see Secret Store)

### Schema Change Process
- Status: present
- Process: edit `SOURCE/supabase/schema.sql` (canonical) and move its fingerprint in the same change (`schema.sql` §17 + `SOURCE/lib/schema/schemaFingerprint.ts`); `npm run schema:plan` for the numbered statement list; add a file under `SOURCE/supabase/migrations/` that replays those statements verbatim and carries the new fingerprint in its name; apply **one statement at a time** to each database; then `npm run verify:schema`, and verify RLS with `SOURCE/supabase/test-rls.ts` (`cd SOURCE && npx tsx supabase/test-rls.ts`)

## Infrastructure

### IaC Source
- Status: not applicable — infrastructure is configured manually in the Supabase console; no Terraform/Pulumi/CDK/K8s

### Environment Configuration
- Status: present
- Mechanism: per-environment configuration — `SOURCE/.env.local` locally, Vercel Environment Variables scoped `Production` vs `Preview` when deployed (see Secret Store and Deployment Trigger)
- Environments: two Supabase projects — **production** `pebjdlbgbmizgfpuptjl` ("MS-MOLAR-prod"), behind the Vercel `Production` scope, and **dev/preview** `hynwleaxtbtjzkvpjsug`, behind the `Preview` scope and local dev. Both databases confirmed at schema fingerprint `187d3ed24f0c` on 2026-09-18.

### Secrets in Infrastructure
- Status: not applicable — no IaC (see Secret Store for runtime/script secrets)

### Deployment Trigger
- Status: present — added between the 2026-08-06 baseline and now
- Mechanism: `git push` to `main` → Vercel builds and deploys to Production automatically; any other branch push → automatic Preview deploy on its own URL. GitHub Actions CI (`.github/workflows/ci.yml`) runs on push-to-main and on every PR, gating merge on lint/types/tests — independent of and in addition to Vercel's own build (which does not run tests). Root Directory is `SOURCE` (app is not at repo root); function region is pinned `sin1` in `SOURCE/vercel.json` (deliberate — colocated with Supabase and VN users, not Vercel's default).
- Caveat inherited from the deleted `docs/DEPLOYMENT.md` (content preserved in git history, commit `6d1a6d1`): `Preview` env scope points at the **dev** Supabase project, `Production` scope at a separate **prod** project — never copy prod keys into the `Preview` scope. `ADMIN_USER_IDS` has historically drifted to `Production`-only scope (TD-014, open) — `/admin` on any Preview deploy 404s for everyone until that's fixed.

## Additional Resources

Free-form list captured during the self-declaration phase. Each entry: name, purpose, location, access method.

- RLS verification harness: verifies database-level data isolation and pending-content non-leak (supports the UGC PRD's zero-leak success metric) — `SOURCE/supabase/test-rls.ts` — `cd SOURCE && npx tsx supabase/test-rls.ts` (reads `.env.local`)
- Seed script: loads sample exams into Supabase for local dev (idempotent upsert, uses `service_role`) — `SOURCE/supabase/seed.ts` — `cd SOURCE && npx tsx supabase/seed.ts`
- Third-party AI service — Google Gemini API (`@google/genai`): used for UGC exam extraction (OCR/parsing PDF uploads) today, and is the integration Engine 1 (Adaptive AI & Feedback) reuses for skill auto-tagging and the Socratic tutor. Server-only client, singleton, SDK retry enabled (3 attempts) — `SOURCE/lib/ugc/gemini.ts`. Models are pinned by empirical necessity, not preference (comment in that file records the originally-chosen model line becoming uncallable for new API keys): `QUESTION_MODEL = "gemini-3.5-flash"`, `ANSWER_MODEL = "gemini-3.1-flash-lite"`. No quota-remaining API exists; `SOURCE/lib/ugc/quotaTracker.ts` self-counts calls (dev-only visibility unless `UGC_QUOTA_LOG=1`). Key: `GEMINI_API_KEY` (see Secret Store).
- Schema version fingerprint: `public.schema_version` (schema.sql §17) + `SOURCE/lib/schema/schemaFingerprint.ts` — detects (does not prevent) dev/prod DDL drift by answering the one question migrations alone cannot — "is this database running the `schema.sql` that is in git?" (TD-005). Any new DDL change must update the fingerprint constant in the same change or `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` fails CI.
