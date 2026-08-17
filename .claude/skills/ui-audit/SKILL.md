---
name: ui-audit
description: Audit a live web page/UI for interaction-triggered bugs (layout shift, jank, elements jumping after click/hover/resize) and aesthetic/layout issues invisible to a single static screenshot. Use whenever the user asks to QA a website, check for "hidden" UI bugs, review a page before shipping, or reports layout jumping, elements moving, page freezing/stuttering ("nhảy", "khựng", "giật"). Do NOT just eyeball a screenshot and say "looks fine" — run the measurement script first; runtime bugs are often invisible in a static screenshot and models tend to under-flag them.
---

# UI Interaction Audit

Two independent passes. Run both. Do not skip Pass 1 in favor of visual judgment alone — layout-shift/jank bugs are measurable and get missed by eyeballing.

## Pass 1 — Runtime measurement (deterministic, do this first)

1. Ensure deps: `npm ls playwright || npm install playwright && npx playwright install chromium --with-deps`
2. Run: `node scripts/audit.mjs <url> --out=<output_dir>`
   - Loads page at 3 viewports (mobile 375, tablet 768, desktop 1440)
   - Clicks/hovers up to 15 interactive elements per viewport
   - Records: CLS (layout-shift entries + attributed DOM sources), long tasks (>50ms), console errors, failed network requests
   - Screenshots baseline + any screenshot where an interaction triggered a new layout shift
3. Read `<output_dir>/report.json`. Apply thresholds:

| Metric | Good | Needs improvement | Poor |
|---|---|---|---|
| cls_score (per viewport) | < 0.1 | 0.1–0.25 | > 0.25 |
| single long task | — | 50–200ms | > 200ms |
| long_tasks_total_ms | < 200 | 200–600 | > 600 |

4. Any entry in `interaction_triggered_shifts` = confirmed bug (element moved because of a user action, not page load). Report the element, the screenshot, and which interaction caused it.
5. Any `console_errors` or `failed_requests` = report verbatim, these are hard failures regardless of threshold.
6. `long_tasks_count` > 0 at any viewport = flag as jank risk even if under threshold; note the ms values so user can judge severity.

Note: this script approximates INP via Long Tasks (main-thread blocking during interaction), not true field INP — say so if reporting jank findings, don't claim a precise INP number.

## Pass 2 — Static/aesthetic review (subjective, do after Pass 1)

Only after Pass 1. Look at `baseline_screenshot` for each viewport plus any shift screenshots. Check against `references/aesthetic-checklist.md` — do not skip to "looks fine" without going through each item; that's the exact failure mode this skill exists to prevent.

## Output to user

Structured findings, grouped by severity:
- **Bugs (measured)**: from Pass 1, cite exact metric + threshold crossed
- **Bugs (visual)**: from Pass 2, cite exact checklist item violated
- **Not a bug**: anything under threshold and passing checklist — say so explicitly, don't leave it ambiguous

Never state "UI looks fine" without having run Pass 1. If the script can't run (no browser env, remote-only preview, etc.), say so explicitly and fall back to Pass 2 only, flagged as reduced-confidence/partial audit.
