import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RUNTIME_DIR = path.join(os.tmpdir(), "ms-molar-pw-cli");
const PORT_FILE = path.join(RUNTIME_DIR, "port");
const SERVER_SCRIPT = path.join(import.meta.dirname, "server.mjs");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function readPort() {
  if (!fs.existsSync(PORT_FILE)) return null;
  const port = Number(fs.readFileSync(PORT_FILE, "utf8").trim());
  return Number.isFinite(port) ? port : null;
}

async function isAlive(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/cmd`, {
      method: "POST",
      body: JSON.stringify({ cmd: "status" }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureServer() {
  let port = await readPort();
  if (port && (await isAlive(port))) return port;

  fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  const child = spawn(process.execPath, [SERVER_SCRIPT], {
    detached: true,
    stdio: "ignore",
    env: process.env,
  });
  child.unref();

  for (let i = 0; i < 100; i++) {
    await sleep(150);
    port = await readPort();
    if (port && (await isAlive(port))) return port;
  }
  throw new Error("pw-cli: server failed to start (check server.log in tmp)");
}

function parseArgs(argv) {
  const [cmd, ...rest] = argv;
  const args = {};
  let positionalIndex = 0;
  const positionalKeys = {
    goto: ["url"],
    click: ["selector"],
    fill: ["selector", "text"],
    type: ["selector", "text"],
    press: ["key"],
    wait: ["selector"],
    screenshot: ["path"],
    snapshot: ["selector"],
    text: ["selector"],
    html: ["selector"],
    eval: ["code"],
  }[cmd] || [];

  for (const token of rest) {
    if (token.startsWith("--")) {
      const [key, ...valParts] = token.slice(2).split("=");
      args[key] = valParts.length ? valParts.join("=") : true;
    } else if (positionalIndex < positionalKeys.length) {
      args[positionalKeys[positionalIndex]] = token;
      positionalIndex++;
    }
  }
  return { cmd, args };
}

async function main() {
  const { cmd, args } = parseArgs(process.argv.slice(2));
  if (!cmd || cmd === "--help" || cmd === "help") {
    console.log(`Usage: node scripts/pw/cli.mjs <command> [args] [--flags]

Commands:
  goto <url>                      navigate
  back | forward | reload
  click <selector>
  fill <selector> <text>
  type <selector> <text> [--delay=ms]
  press <key> [--selector=sel]    e.g. press Enter
  wait <selector> [--timeout=ms]
  screenshot [path] [--selector=sel] [--fullPage]
  snapshot [selector]             compact accessibility tree (aria snapshot)
  text [selector]                 innerText
  html [selector]                 outerHTML / full page HTML
  eval "<js code>"                runs in page context, returns JSON-able result
  console [--clear]               buffered console/page errors
  resize --width=W --height=H
  status                          current url/title
  close                           shuts down the browser + server

Env: PW_HEADLESS=0 to run headed (set before first 'goto'/any command that boots the server).
Session persists across calls (page stays open) until 'close' is run.`);
    return;
  }

  const port = await ensureServer();
  const res = await fetch(`http://127.0.0.1:${port}/cmd`, {
    method: "POST",
    body: JSON.stringify({ cmd, args }),
  });
  const data = await res.json();
  if (!data.ok) {
    console.error(`pw-cli error: ${data.error}`);
    process.exit(1);
  }
  console.log(JSON.stringify(data.result, null, 2));
}

main().catch((err) => {
  console.error(`pw-cli fatal: ${err.message}`);
  process.exit(1);
});
