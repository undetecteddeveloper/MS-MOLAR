---
name: security-audit
description: Tool-driven security vulnerability scan of this repo — dependency CVEs (SCA), static analysis (SAST via Semgrep), secret leaks, Supabase RLS/schema gaps, and a manual pass mapped to OWASP Top 10:2025. Use when asked to check/audit/review for security vulnerabilities, find security bugs, or before shipping auth/data-access/payment-adjacent changes. Not for reviewing a small diff only in plain English — that's the general `security-review` skill; this one runs real scanners.
---

# Security Audit

Stack: Next.js 16 App Router + React 19 + TypeScript + Supabase (Postgres/RLS), on Vercel. App root is `SOURCE/`. Run everything below from repo root unless noted.

**Scope**: no target given → full `SOURCE/` (excluding `node_modules`, `.next*`). "Review my changes" → still run steps 1–4 in full (they're not diffable), but weight findings toward changed files in step 5. Never print `.env*` contents in output — only note existence/gitignore status.

## 1 — Dependencies (SCA)
```
cd SOURCE && npm audit --omit=dev   # blocking: prod-impact CVEs
cd SOURCE && npm audit              # informational: full tree
```
Zero install. Limitation: no reachability analysis — a hit means "triage," not automatically "fix." Cross-check the advisory actually covers a code path this repo calls.

## 2 — Static analysis (SAST): Semgrep
Install/run via `uv` (isolates its own Python — required on this box: system Python is a pre-release build and breaks Semgrep's compiled deps with `TypeError: Metaclasses with custom tp_new are not supported`; if you hit that error, you used the wrong interpreter):
```
uvx --python 3.12 --from semgrep semgrep scan \
  --config p/owasp-top-ten --config p/nextjs --config p/react --config p/typescript --config p/secrets \
  SOURCE --exclude '**/*.test.ts' --exclude '.next*' --json --output semgrep-report.json
```
First run downloads ~55 MB once, then cached. No `uv` → install it first (`pip install uv`, works from any interpreter) rather than `pip install semgrep` directly — a machine with multiple Pythons on PATH can silently resolve the installed `semgrep`/`pysemgrep` console script to the wrong interpreter and reproduce the same crash. Semgrep scans git-tracked files by default — `git add` brand-new untracked files first, or it silently skips them.
Triage: `ERROR` severity = must-fix. `WARNING` = report with reasoning. `INFO` = skip unless it lands on lines touched by the current change.

## 3 — Secrets
Covered by `p/secrets` in step 2. If `gitleaks` happens to be on PATH, run a deeper pass: `gitleaks detect --source . -v` (scans history too). Don't install a raw binary just for this — the Semgrep pass is the baseline and is sufficient by default.

## 4 — Supabase / RLS
- If `supabase/config.toml` exists and the project is linked: `npx supabase db lint` — flags `rls_disabled_in_public`, `policy_exists_rls_disabled`, `security_definer_view`, `extension_in_public`, etc.
- Otherwise, grep `supabase/**/*.sql` manually: every `CREATE TABLE` in the `public` schema needs a matching `ALTER TABLE … ENABLE ROW LEVEL SECURITY` plus ≥1 `CREATE POLICY`. Any `SECURITY DEFINER` function/view bypasses RLS by design — verify it re-checks the caller (`auth.uid()`) internally.
- Grep server code for `SUPABASE_SERVICE_ROLE_KEY` / service-role client construction — must stay server-only (no `"use client"` file, never `NEXT_PUBLIC_`-prefixed, never returned to the client).

## 5 — Manual pass, mapped to OWASP Top 10:2025
| Code | Category | What to check in this stack |
|---|---|---|
| A01 | Broken Access Control | Every Server Action / Route Handler re-checks auth + resource ownership server-side — never trust a client-supplied `userId`/`role`. Middleware is routing only, not a security boundary (see CVE-2025-29927) — the real check lives in the action/handler/DAL. |
| A02 | Security Misconfiguration | `next.config.ts` security headers (CSP/HSTS/X-Frame-Options) present and not weakened by the diff; no env-branch that disables auth; no debug/test route reachable in prod. |
| A03 | Software Supply Chain | Step 1 output, plus check `package.json` diffs for unpinned/typosquatted additions. |
| A04 | Cryptographic Failures | Session cookies `httpOnly` + `secure` + `sameSite`; no secret/token in a `NEXT_PUBLIC_*` var or client bundle (`grep -r NEXT_PUBLIC_ SOURCE/.env* SOURCE/**/*.ts`); no password/token in logs. |
| A05 | Injection | No string-built SQL; Supabase calls use `.eq()`/`.in()`/`.rpc(name, params)` param binding, never interpolated strings; any `dangerouslySetInnerHTML` or markdown/HTML-from-user-content path goes through `rehype-sanitize`. |
| A06 | Insecure Design | New privileged flow (authoring, rating, review, payment) has a stated trust boundary: who can call it, what it can mutate. |
| A07 | Authentication Failures | Rate limiting present on auth/submit endpoints (pattern: `lib/security/rateLimit.ts`); no timing-unsafe token comparison. |
| A08 | Software/Data Integrity | Server Actions re-validate payload shape/size server-side, not just client-side; file uploads re-check type/size server-side. |
| A09 | Logging & Alerting | Errors logged without leaking secrets/PII; failed-auth attempts land somewhere actionable. |
| A10 | Mishandling Exceptions | `try/catch` around external calls (Supabase, Gemini) doesn't leak stack traces/internal errors into the client response. |

## 6 — Report
Per finding: `file:line`, OWASP code, severity, one-line impact, one-line fix.
- **Critical/High** — exploitable now, no auth or trivial privilege needed.
- **Medium** — needs a specific precondition (race, non-default config, insider access).
- **Low** — defense-in-depth, no direct exploit path found.
Sort by severity. Skip findings confined to test/mock files or `node_modules`.
