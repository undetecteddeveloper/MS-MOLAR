# External Resources

Last updated: 2026-09-17 (diff-only refresh for the Community Solutions feature — engineer confirmed "no other external resources". Changed axes: Design Origin (theme is now dark-only "Đêm hội"; design canvases on claude.ai are the approved mockup source), Design System (current primitive inventory), Visual Verification (Playwright **CLI**, not the MCP server), Migration History + Schema Change Process (migration flow exists since 2026-08-31, TD-005 closed), Deployment Trigger (Composio `vercel` toolkit), Additional Resources (Composio MCP for the Notion progress log + PROD Supabase read-only queries). Previous refresh: 2026-08-16 (payOS).)

This file records the external resources available to this project and how to access them. AI agents and contributors consult this file when work depends on resources outside the repository. Feature-specific identifiers belong in the consuming UI Spec or Design Doc, not here — this file holds environment-stable facts only.

> Environment summary: MS-MOLAR is a Next.js 16 (App Router) + Supabase app, **deployed on Vercel** (region `sin1`/Singapore, region choice is deliberate — colocated with Supabase prod and VN users, not a default). Production branch is `main`; feature branches get automatic Preview deploys. **Two Supabase projects**: a dedicated prod project (`Production` env scope) and a separate dev project (`Preview` + local env scope) — deliberately split so preview deploys and local dev never touch real user data. DDL ships as Supabase CLI migrations in `SOURCE/supabase/migrations/` with `schema.sql` canonical (TD-005 closed 2026-08-31 — see Migration History). GitHub Actions CI (`.github/workflows/ci.yml`) blocks merge on lint (`eslint --max-warnings 0`), `tsc --noEmit`, and `npm test` (TD-010, closed 2026-08-04) — Vercel's own build does not run these.

## Frontend

### Design Origin
- Status: present
- Source type: token file in the repository (no separate spec doc)
- Location: `SOURCE/app/globals.css` — the sole source of truth for the tokens. **Theme since 2026-09-14 is dark-only "Đêm hội"** (no light mode, no `dark:` classes); rules and rationale in `docs/design/ui-refactor-san-truong-design.md` §8 (colors, "ánh sáng" glow classes) and §2–§5 (type, shape, layout), motion in §7. Older names "Ink & Lacquer" / "Sân trường" in file headers are stale labels.
- Approved page mockups: **design canvases published as claude.ai Artifacts** (Claude Design canvas editor, `.dc.html` artboards). The engineer approves directions on the canvas; each feature's UI Spec records the canvas URL and which artboards are approved. Read with the `Artifact` tool (`action: read`) or from the artboard source files kept with the feature docs.
- Access method: file read (`globals.css` for tokens; design doc for rules); Artifact tool / canvas URL for mockups

### Design System
- Status: present
- Source type: internal package / ad-hoc in-repo components (no external catalog, no Storybook)
- Location: `SOURCE/features/*/components/`, base primitives in `SOURCE/components/ui/` (8 files: button, badge, card, chip, input/textarea/select/label, progress, tooltip, SuccessToast — base-ui + cva), shared pieces in `SOURCE/components/shared/` (RichText, Avatar, FilterSheet bottom sheet, usePresence), layout shell in `SOURCE/components/layout/` (AppShell, SiteHeader, BottomNav, PageContainer, PageHeader); design tokens in `SOURCE/app/globals.css`. No Tabs / Dialog / Switch primitive — dialogs and sheets are hand-rolled per `FilterSheet` / `ReportExam`.
- Access method: file read / import within the repo

### Guidelines
- Status: present
- Source type: project files
- Location: `SOURCE/app/globals.css` + `.claude/MEMORY.md` §3 (visual rules — see Design Origin above), plus `PROJECT_OVERVIEW.md` (repo root) for process conventions. Session progress: Notion (see `.claude/MEMORY.md`); technical debt: `TECH-DEBT.md` (repo root, moved from `docs/` 2026-08-08)
- Access method: file read

### Visual Verification Environment
- Status: present
- Tool type: local dev server + Playwright **CLI** + manual inspection
- Entry: `npm run dev` (Next.js local dev server); `npx playwright` (v1.62, Chromium installed) run from inside `SOURCE/` for screenshots and the `ui-audit` measurement workflow (`.claude/skills/ui-audit/`). The Playwright MCP server in `.mcp.json` is NOT used for audits (project convention `.claude/CONVENTIONS.md` §3). Auto mode blocks automated sign-in as the test account — the engineer logs the shared CLI session in when a page needs auth.

## Backend

### Database Schema Source
- Status: present
- Source type: schema file in the repository (no database MCP)
- Location: `SOURCE/supabase/schema.sql` — tables `exams`, `questions`, `user_profiles`, RLS policies
- Access method: file read for the canonical source; DDL reaches a live database only through the migration flow below (see Migration History), not by ad-hoc SQL Editor edits

### Migration History
- Status: present — migration flow added 2026-08-31 (TD-005 closed)
- Tool: idempotent `SOURCE/supabase/schema.sql` remains the source of truth; per-change migration files in `SOURCE/supabase/migrations/<timestamp>_<slug>_<fingerprint>.sql` (statements copied verbatim; `SOURCE/lib/schema/__tests__/migrationsMatchSchema.test.ts` checks they match `schema.sql`)
- Fingerprint: `npm run schema:plan` prints the new fingerprint → update `SCHEMA_FINGERPRINT` in `SOURCE/lib/schema/schemaFingerprint.ts` and the `schema_version` upsert (schema.sql §17) in the same change
- Apply trigger: **dev** — Supabase CLI linked to the dev project: `npx supabase db query --linked --project-ref hynwleaxtbtjzkvpjsug --file supabase/migrations/<file>.sql`, then `npm run verify:schema`. **Prod** — applied separately by the engineer; before a feature with new DDL counts as done, compare `select fingerprint from public.schema_version` on PROD via Composio `SUPABASE_RUN_READ_ONLY_QUERY` (TD-005 history: prod drift bit four times).

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
- Process: edit `SOURCE/supabase/schema.sql` → `npm run schema:plan` → fingerprint constant → migration file → apply to dev via Supabase CLI `--file` → `npm run verify:schema` (add probes for new RPCs) → RLS cases in `SOURCE/supabase/test-rls.ts` (`cd SOURCE && npx tsx supabase/test-rls.ts`) and service tests in `SOURCE/tests/e2e/service/`. Prod applied separately; fingerprint compared via Composio before closing the feature.

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
- Mechanism: `git push` to `main` → Vercel builds and deploys to Production automatically; any other branch push → automatic Preview deploy on its own URL. Manual deploys/promotions go through the Composio MCP `vercel` toolkit (the local Vercel CLI is not logged in; when it is, run `npx vercel` from the repo root, not from `SOURCE/`, because Root Directory is `SOURCE`). Turbopack build cache is disabled in `SOURCE/next.config.ts` (TD-024: stale CSS shipped four times); `npm run verify:deployed` compares deployed CSS token values with the local build. GitHub Actions CI (`.github/workflows/ci.yml`) runs on push-to-main and on every PR, gating merge on lint/types/tests — independent of and in addition to Vercel's own build (which does not run tests). Root Directory is `SOURCE` (app is not at repo root); function region is pinned `sin1` in `SOURCE/vercel.json` (deliberate — colocated with Supabase and VN users, not Vercel's default).
- Caveat inherited from the deleted `docs/DEPLOYMENT.md` (content preserved in git history, commit `6d1a6d1`): `Preview` env scope points at the **dev** Supabase project, `Production` scope at a separate **prod** project — never copy prod keys into the `Preview` scope. `ADMIN_USER_IDS` has historically drifted to `Production`-only scope (TD-014, open) — `/admin` on any Preview deploy 404s for everyone until that's fixed.

## Additional Resources

Free-form list captured during the self-declaration phase. Each entry: name, purpose, location, access method.

- Composio MCP (claude.ai connector; toolkits `notion`, `supabase`, `vercel`, `googledrive`): progress log = Notion database **MS-MOLAR** `3b378ba6-ae12-803c-8500-c572b6fc745f` (one row per feature/session; body records measurements and reasons); PROD Supabase read-only queries (`SUPABASE_RUN_READ_ONLY_QUERY`, project ref from `SUPABASE_LIST_ALL_PROJECTS`); Vercel deploys. Access: MCP tools `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`. The Composio CLI does not run on this Windows machine (a PreToolUse hook blocks it). Registration is per project path in `~/.claude.json`; moving the repo folder drops it (happened 2026-09-17).
- Supabase MCP server `supabase` in `.mcp.json`: bound to ONE fixed project ref (dev/preview); it cannot see prod.

- RLS verification harness: verifies database-level data isolation and pending-content non-leak (supports the UGC PRD's zero-leak success metric) — `SOURCE/supabase/test-rls.ts` — `cd SOURCE && npx tsx supabase/test-rls.ts` (reads `.env.local`)
- Seed script: loads sample exams into Supabase for local dev (idempotent upsert, uses `service_role`) — `SOURCE/supabase/seed.ts` — `cd SOURCE && npx tsx supabase/seed.ts`
- Third-party AI service — Google Gemini API (`@google/genai`): used for UGC exam extraction (OCR/parsing PDF uploads) today, and is the integration Engine 1 (Adaptive AI & Feedback) reuses for skill auto-tagging and the Socratic tutor. Server-only client, singleton, SDK retry enabled (3 attempts) — `SOURCE/lib/ugc/gemini.ts`. Models are pinned by empirical necessity, not preference (comment in that file records the originally-chosen model line becoming uncallable for new API keys): `QUESTION_MODEL = "gemini-3.5-flash"`, `ANSWER_MODEL = "gemini-3.1-flash-lite"`. No quota-remaining API exists; `SOURCE/lib/ugc/quotaTracker.ts` self-counts calls (dev-only visibility unless `UGC_QUOTA_LOG=1`). Key: `GEMINI_API_KEY` (see Secret Store).
- Schema version fingerprint: `public.schema_version` (schema.sql §17) + `SOURCE/lib/schema/schemaFingerprint.ts` — detects (does not prevent) dev/prod DDL drift by answering the one question migrations alone cannot — "is this database running the `schema.sql` that is in git?" (TD-005). Any new DDL change must update the fingerprint constant in the same change or `SOURCE/lib/schema/__tests__/schemaFingerprint.test.ts` fails CI.
