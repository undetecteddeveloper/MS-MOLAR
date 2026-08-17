---
name: perf-audit
description: Tool-driven performance audit of this repo — build bundle-size table, Next.js bundle-analyzer deep dive, Lighthouse Core Web Vitals against a production build, and the repo's own Supabase query-latency benchmark. Use when asked to check/audit/profile performance, investigate slow pages, or review a diff that touches data fetching, heavy client libs (pdf/canvas/image), or a hot route.
---

# Performance Audit

Stack: Next.js 16 App Router + React 19 + TypeScript + Supabase, on Vercel. App root is `SOURCE/`. Never profile against `next dev` — unminified + HMR overhead invalidates every number. Always build first.

## 1 — Bundle size (always run first, zero install)
```
cd SOURCE && npm run build
```
Next prints a per-route table (`Route`, `Size`, `First Load JS`) after build — read it directly, no extra tool needed for this pass.
- Flag any route's **First Load JS > ~170 KB** (compressed) — the standard mobile JS budget.
- Flag any single chunk **> 200 KB** — ~200ms of parse/compile on a mid-tier phone.
- Compare against the previous build (`git stash` + rebuild, or the last CI number) when reviewing a diff — the delta matters more than the absolute number.

## 2 — Bundle deep dive (only for routes flagged in step 1)
```
npm install -D @next/bundle-analyzer   # once; safe to keep (no-op unless ANALYZE=true)
```
Temporarily wrap `SOURCE/next.config.ts`'s export:
```ts
import bundleAnalyzer from "@next/bundle-analyzer";
const withBundleAnalyzer = bundleAnalyzer({ enabled: process.env.ANALYZE === "true" });
export default withBundleAnalyzer(nextConfig);
```
Run `ANALYZE=true npm run build` (PowerShell: `$env:ANALYZE="true"; npm run build`), inspect the treemap that opens, find the largest module(s) pulling the route over budget. Revert the `next.config.ts` edit afterward unless the wrapper should stay wired in permanently.
Common culprit in this repo: a heavy library (PDF/canvas/image processing — `jspdf`, `html2canvas`, `mupdf`, `sharp`, `katex`) imported at a shared module's top level instead of behind `next/dynamic({ ssr: false })` or a runtime `import()` inside the code path that actually needs it.

## 3 — Runtime: Core Web Vitals via Lighthouse
```
cd SOURCE && npm run build && npm run start &   # production server, keep running
```
Resolve a Chromium binary (system Chrome/Edge may not be on PATH — this repo already has Playwright's):
```
CHROME_PATH=$(node -e "console.log(require('playwright').chromium.executablePath())")
npx -y lighthouse http://localhost:3000/<route> --chrome-flags="--headless=new" \
  --only-categories=performance --output=json --output-path=./lh-<route>.json
```
(PowerShell: `$env:CHROME_PATH = node -e "console.log(require('playwright').chromium.executablePath())"`)
Pick 2–3 representative routes: the main list/landing page, the most interactive page (heaviest client components), and anything flagged in step 1.
Thresholds (p75 in production would be the real gate; a single local run is a proxy — treat borderline results as inconclusive, not pass/fail):
| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| LCP | < 2.5s | 2.5–4s | > 4s |
| INP | < 200ms | 200–500ms | > 500ms |
| CLS | < 0.1 | 0.1–0.25 | > 0.25 |
| Lighthouse Performance score | 90–100 | 50–89 | 0–49 |

## 4 — Backend: Supabase query latency
This repo already ships a benchmark for this — use it instead of writing a new one:
```
cd SOURCE && npx tsx scripts/perf-layers.ts
```
Signs in as a real test account and times the actual query chains per feature layer (RLS-evaluated, real round-trip), ranks slowest calls. Caveat noted in the script itself: its query chains are copy-pasted from each layer's `queries.ts`/`actions.ts` and can drift — if it flags a slow call, confirm against the current source before trusting the number.

## 5 — Static review checklist
- **Server/Client boundary**: no `"use client"` on a component that doesn't need interactivity — it drags its whole subtree's JS to the browser.
- **Data fetching**: sequential `await` calls that don't depend on each other → `Promise.all`. No unbounded `.select()` (fetch only needed columns) or unbounded list query (missing `.limit()`/pagination).
- **N+1**: a query inside a `.map()`/loop instead of one batched `.in()` call.
- **Images**: raw `<img>` where `next/image` would give lazy-load + sizing; unoptimized/uncompressed source assets.
- **Memoization**: expensive computation or large list re-render on every parent render with no `useMemo`/`memo`/key-stable list.
- **Streaming**: a slow data dependency blocking the whole route instead of behind `<Suspense>`.

## 6 — Report
Per finding: metric or `file:line`, measured value vs. threshold/budget, one-line cause, one-line fix. Sort by user-facing impact (LCP/INP on a high-traffic route first, dev-only or rare-path issues last).
