#!/usr/bin/env node
// Usage: node audit.mjs <url> [--out=./ui-audit-output]
// Measures CLS, long tasks, console errors, failed requests at 3 viewports.
// Clicks/hovers interactive elements and flags any layout shift caused by interaction.

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const url = args[0];
if (!url) {
  console.error('Usage: node audit.mjs <url> [--out=./ui-audit-output]');
  process.exit(1);
}
const outArg = args.find(a => a.startsWith('--out='));
const outDir = outArg ? outArg.split('=')[1] : './ui-audit-output';
fs.mkdirSync(outDir, { recursive: true });

const storageStateArg = args.find(a => a.startsWith('--storage-state='));
const storageStatePath = storageStateArg ? storageStateArg.split('=')[1] : undefined;

const viewports = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

const initScript = `
window.__auditData = { shifts: [], longTasks: [] };
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (!entry.hadRecentInput) {
        window.__auditData.shifts.push({
          value: entry.value,
          time: entry.startTime,
          sources: (entry.sources || []).map(s => {
            if (!s.node) return 'unknown';
            const el = s.node;
            const cls = el.className && typeof el.className === 'string'
              ? '.' + el.className.trim().split(/\\s+/).join('.') : '';
            return el.tagName + (el.id ? '#' + el.id : '') + cls;
          })
        });
      }
    }
  }).observe({ type: 'layout-shift', buffered: true });
} catch (e) {}
try {
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      window.__auditData.longTasks.push({ duration: entry.duration, start: entry.startTime });
    }
  }).observe({ type: 'longtask', buffered: true });
} catch (e) {}
`;

const report = { url, generated_at: new Date().toISOString(), viewports: {} };

const browser = await chromium.launch();

for (const vp of viewports) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    ...(storageStatePath ? { storageState: storageStatePath } : {}),
  });
  await context.addInitScript(initScript);
  const page = await context.newPage();

  const consoleErrors = [];
  const failedRequests = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', req => {
    failedRequests.push({ url: req.url(), failure: req.failure()?.errorText || 'unknown' });
  });

  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch (e) {
    report.viewports[vp.name] = { error: `goto failed: ${e.message}` };
    await context.close();
    continue;
  }
  await page.waitForTimeout(500);

  const baselineShot = path.join(outDir, `${vp.name}-baseline.png`);
  await page.screenshot({ path: baselineShot, fullPage: true });

  // tag interactive elements
  const candidates = await page.$$eval(
    'button, a, [role="button"], input[type="checkbox"], input[type="radio"], select, [onclick], [aria-haspopup], summary',
    els => els.slice(0, 15).map((el, i) => {
      el.setAttribute('data-audit-idx', String(i));
      const r = el.getBoundingClientRect();
      return { idx: i, tag: el.tagName, text: (el.textContent || '').trim().slice(0, 30), visible: r.width > 0 && r.height > 0 };
    })
  );

  const interactions = [];
  for (const c of candidates.filter(c => c.visible)) {
    try {
      const before = await page.evaluate(() => window.__auditData.shifts.length);
      const target = page.locator(`[data-audit-idx="${c.idx}"]`);
      await target.hover({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(150);
      await target.click({ timeout: 2000 }).catch(() => {});
      await page.waitForTimeout(300);
      const after = await page.evaluate(() => window.__auditData.shifts.length);
      if (after > before) {
        const shotPath = path.join(outDir, `${vp.name}-shift-idx${c.idx}.png`);
        await page.screenshot({ path: shotPath, fullPage: true });
        interactions.push({ element: c, new_shift_count: after - before, screenshot: shotPath });
      }
    } catch (e) {
      // ignore individual element failures, continue auditing others
    }
  }

  const data = await page.evaluate(() => window.__auditData);
  const cls = data.shifts.reduce((sum, s) => sum + s.value, 0);
  const longTaskTotal = data.longTasks.reduce((sum, t) => sum + t.duration, 0);

  report.viewports[vp.name] = {
    cls_score: Number(cls.toFixed(4)),
    cls_rating: cls < 0.1 ? 'good' : cls < 0.25 ? 'needs-improvement' : 'poor',
    layout_shifts: data.shifts,
    long_tasks_count: data.longTasks.length,
    long_tasks_total_ms: Math.round(longTaskTotal),
    long_tasks: data.longTasks,
    console_errors: consoleErrors,
    failed_requests: failedRequests,
    interaction_triggered_shifts: interactions,
    baseline_screenshot: baselineShot,
  };

  await context.close();
}

await browser.close();

const reportPath = path.join(outDir, 'report.json');
fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`Report written to ${reportPath}`);
console.log(JSON.stringify(report, null, 2));
