import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RUNTIME_DIR = path.join(os.tmpdir(), "ms-molar-pw-cli");
const PORT_FILE = path.join(RUNTIME_DIR, "port");
const LOG_FILE = path.join(RUNTIME_DIR, "server.log");
fs.mkdirSync(RUNTIME_DIR, { recursive: true });

const log = (...args) => {
  const line = `[${new Date().toISOString()}] ${args.join(" ")}\n`;
  fs.appendFileSync(LOG_FILE, line);
};

const HEADLESS = process.env.PW_HEADLESS !== "0";
const VIEWPORT = { width: 1280, height: 720 };
const CONSOLE_LIMIT = 300;

const browser = await chromium.launch({ headless: HEADLESS });
const context = await browser.newContext({ viewport: VIEWPORT });
let page = await context.newPage();

let consoleBuf = [];
const attachPageListeners = (p) => {
  p.on("console", (msg) => {
    consoleBuf.push(`[${msg.type()}] ${msg.text()}`);
    if (consoleBuf.length > CONSOLE_LIMIT) consoleBuf.shift();
  });
  p.on("pageerror", (err) => {
    consoleBuf.push(`[pageerror] ${err.message}`);
    if (consoleBuf.length > CONSOLE_LIMIT) consoleBuf.shift();
  });
};
attachPageListeners(page);

context.on("page", (p) => {
  page = p;
  attachPageListeners(p);
});

const resolveScreenshotPath = (p) => {
  if (!p) {
    const dir = path.resolve(
      import.meta.dirname,
      "../../../SCREENSHOT/temporary_screenshot",
    );
    fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, `pw-${Date.now()}.png`);
  }
  return path.resolve(p);
};

const handlers = {
  async status() {
    return { url: page.url(), title: await page.title() };
  },
  async goto({ url, waitUntil }) {
    await page.goto(url, { waitUntil: waitUntil || "domcontentloaded" });
    return { url: page.url(), title: await page.title() };
  },
  async back() {
    await page.goBack();
    return { url: page.url() };
  },
  async forward() {
    await page.goForward();
    return { url: page.url() };
  },
  async reload() {
    await page.reload();
    return { url: page.url() };
  },
  async click({ selector }) {
    await page.click(selector);
    return { ok: true };
  },
  async fill({ selector, text }) {
    await page.fill(selector, text);
    return { ok: true };
  },
  async type({ selector, text, delay }) {
    await page.type(selector, text, { delay: delay || 0 });
    return { ok: true };
  },
  async press({ selector, key }) {
    if (selector) await page.locator(selector).press(key);
    else await page.keyboard.press(key);
    return { ok: true };
  },
  async wait({ selector, timeout }) {
    await page.waitForSelector(selector, { timeout: timeout || 10000 });
    return { ok: true };
  },
  async screenshot({ path: outPath, selector, fullPage }) {
    const resolved = resolveScreenshotPath(outPath);
    if (selector) {
      await page.locator(selector).screenshot({ path: resolved });
    } else {
      await page.screenshot({ path: resolved, fullPage: !!fullPage });
    }
    return { path: resolved };
  },
  async snapshot({ selector }) {
    const locator = selector ? page.locator(selector) : page.locator("body");
    const text = await locator.ariaSnapshot();
    return { snapshot: text };
  },
  async text({ selector }) {
    const text = await page.textContent(selector || "body");
    return { text };
  },
  async html({ selector }) {
    const html = selector
      ? await page.locator(selector).innerHTML()
      : await page.content();
    return { html };
  },
  async eval({ code }) {
    const result = await page.evaluate((src) => {
      return eval(src);
    }, code);
    return { result };
  },
  async console({ clear }) {
    const messages = [...consoleBuf];
    if (clear) consoleBuf = [];
    return { messages };
  },
  async resize({ width, height }) {
    // CLI args arrive as strings (argv text) — setViewportSize rejects non-integers.
    await page.setViewportSize({ width: Number(width), height: Number(height) });
    return { ok: true };
  },
  async storageState({ path: outPath }) {
    const resolved = path.resolve(outPath || "storageState.json");
    await context.storageState({ path: resolved });
    return { path: resolved };
  },
  async close() {
    setTimeout(async () => {
      await browser.close().catch(() => {});
      fs.rmSync(PORT_FILE, { force: true });
      process.exit(0);
    }, 50);
    return { ok: true, closing: true };
  },
};

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/cmd") {
    res.writeHead(404).end();
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { cmd, args } = JSON.parse(body || "{}");
      const handler = handlers[cmd];
      if (!handler) throw new Error(`Unknown command: ${cmd}`);
      const result = await handler(args || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, result }));
    } catch (err) {
      log("error", err.message);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  });
});

server.listen(0, "127.0.0.1", () => {
  const { port } = server.address();
  fs.writeFileSync(PORT_FILE, String(port));
  log(`listening on ${port}, headless=${HEADLESS}`);
});

process.on("SIGTERM", async () => {
  await browser.close().catch(() => {});
  process.exit(0);
});
