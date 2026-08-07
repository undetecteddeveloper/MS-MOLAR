# External Resources

Last updated: 2026-08-06

This file records the external resources available to this project and how to access them. AI agents and contributors consult this file when work depends on resources outside the repository. Feature-specific identifiers belong in the consuming UI Spec or Design Doc, not here — this file holds environment-stable facts only.

> Environment summary: MS-MOLAR is a Next.js (App Router) + Supabase app, **local-only and pre-launch** (no hosted environment, no CI/CD, a single Supabase project used for development). DDL is applied by hand; there is no migration framework.

## Frontend

### Design Origin
- Status: present
- Source type: specification file in the repository
- Location: `DESIGN.md` (repo root) — the "Ink & Lacquer" / "Mực & Sơn Mài" theme definition
- Access method: file read

### Design System
- Status: present
- Source type: internal package / ad-hoc in-repo components (no external catalog, no Storybook)
- Location: `SOURCE/app/(layer2)/_components/`, `SOURCE/app/(layer1)/_components/`, base primitives in `SOURCE/components/ui/` (base-ui + cva); design tokens in `SOURCE/app/globals.css`
- Access method: file read / import within the repo

### Guidelines
- Status: present
- Source type: project files
- Location: `DESIGN.md` (visual rules), plus `PROJECT_OVERVIEW.md` (repo root) for process conventions. Session progress: Notion (see `.claude/MEMORY.md`); technical debt: `TECH-DEBT.md`
- Access method: file read

### Visual Verification Environment
- Status: present
- Tool type: local dev server + browser automation MCP + manual inspection
- Entry: `npm run dev` (Next.js local dev server); Playwright MCP server named `playwright` (declared in `.mcp.json`) for automated browser inspection/screenshots

## Backend

### Database Schema Source
- Status: present
- Source type: schema file in the repository (no database MCP)
- Location: `SOURCE/supabase/schema.sql` — tables `exams`, `questions`, `user_profiles`, RLS policies
- Access method: file read for the canonical source; the live database is inspected/modified manually via the Supabase dashboard **SQL Editor**

### Migration History
- Status: present (no migration tool)
- Tool: none — a single idempotent `schema.sql` is the source of truth
- Location: `SOURCE/supabase/schema.sql`
- Apply trigger: **manual** — the engineer pastes/re-runs the idempotent `schema.sql` in the Supabase SQL Editor

### Secret Store
- Status: present
- Service: environment variables loaded from `SOURCE/.env.local` (development only; gitignored — never committed)
- Access method: Next.js loads env vars at runtime; local scripts read `SOURCE/.env.local` directly. Keys present: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client + server via `@supabase/ssr`), and a Supabase `service_role` key used **only by local scripts** (`SOURCE/supabase/seed.ts`, `SOURCE/supabase/test-rls.ts`) — never shipped to the client. (Record only the mechanism, never secret values.)

### Background Job Infrastructure
- Status: not applicable — no asynchronous/background work in this project

## API

### API Schema Source
- Status: not applicable — no separate API contract (no OpenAPI/GraphQL/proto). Server logic is Next.js Server Actions (`SOURCE/app/(layer1)/actions.ts`, `SOURCE/app/(layer2)/actions.ts`, `queries.ts`) calling the Supabase client directly; the API surface is code-first.

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
- Process: edit the idempotent `SOURCE/supabase/schema.sql` and re-apply it in the Supabase SQL Editor; verify RLS with `SOURCE/supabase/test-rls.ts` (`cd SOURCE && npx tsx supabase/test-rls.ts`)

## Infrastructure

### IaC Source
- Status: not applicable — infrastructure is configured manually in the Supabase console; no Terraform/Pulumi/CDK/K8s

### Environment Configuration
- Status: present
- Mechanism: single shared configuration (one `.env.local`)
- Environments: one — local development against a single Supabase project. Pre-launch: no staging/production split.

### Secrets in Infrastructure
- Status: not applicable — no IaC (see Secret Store for runtime/script secrets)

### Deployment Trigger
- Status: not applicable — local-only pre-launch; no hosting platform, no CI/CD, no deploy trigger

## Additional Resources

Free-form list captured during the self-declaration phase. Each entry: name, purpose, location, access method.

- RLS verification harness: verifies database-level data isolation and pending-content non-leak (supports the UGC PRD's zero-leak success metric) — `SOURCE/supabase/test-rls.ts` — `cd SOURCE && npx tsx supabase/test-rls.ts` (reads `.env.local`)
- Seed script: loads sample exams into Supabase for local dev (idempotent upsert, uses `service_role`) — `SOURCE/supabase/seed.ts` — `cd SOURCE && npx tsx supabase/seed.ts`
