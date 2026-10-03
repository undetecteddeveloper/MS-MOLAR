// SessionStart hook — in sẵn dữ liệu đầu phiên để Claude không phải nhớ:
//   1) kiểm CƠ HỌC các công cụ chính (hook không gọi được MCP, nên chỉ kiểm cấu hình/file);
//   2) phần "Đang mở" của PROGRESS.md.
// Claude vẫn phải làm CLAUDE.md §2 (ToolSearch xác nhận Composio, báo một dòng).
// Gốc project suy từ vị trí file này, không từ cwd: cwd đổi khi Claude `cd SOURCE`.
const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.resolve(__dirname, "..", "..");
const norm = (p) => p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

function composioRegistration() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(os.homedir(), ".claude.json"), "utf8"));
    if (cfg.mcpServers && cfg.mcpServers.composio) return "user";
    const want = norm(root);
    for (const [key, val] of Object.entries(cfg.projects || {})) {
      if (norm(key) === want && val && val.mcpServers && val.mcpServers.composio) return "project";
    }
    return null;
  } catch {
    return "unknown";
  }
}

function openProgress() {
  try {
    const text = fs.readFileSync(path.join(root, "PROGRESS.md"), "utf8").replace(/\r/g, "");
    const start = text.indexOf("## Đang mở");
    if (start < 0) return "(PROGRESS.md không có mục '## Đang mở' — báo người dùng)";
    const end = text.indexOf("\n## ", start + 5);
    const lines = text.slice(start, end < 0 ? undefined : end).split("\n").slice(0, 45);
    return lines.map((l) => (l.length > 420 ? l.slice(0, 420) + "…" : l)).join("\n");
  } catch {
    return "(không đọc được PROGRESS.md — báo người dùng)";
  }
}

const reg = composioRegistration();
const composioLine =
  reg === "user" || reg === "project"
    ? `đã đăng ký (${reg}) — vẫn PHẢI xác nhận bằng ToolSearch "composio"`
    : reg === "unknown"
      ? "không đọc được ~/.claude.json — xác nhận bằng ToolSearch \"composio\""
      : `KHÔNG thấy đăng ký cho ${root} — báo THIẾU, đưa người dùng lệnh ở .claude/workflow/ops-env.md (mục "Composio mất khi đổi đường dẫn")`;

const src = path.join(root, "SOURCE");
const missingGates = [["typescript", "tsc"], ["eslint", "eslint"], ["vitest", "vitest"]]
  .filter(([dir]) => !fs.existsSync(path.join(src, "node_modules", dir)))
  .map(([, name]) => name);
const gatesLine = missingGates.length
  ? `THIẾU ${missingGates.join(", ")} trong SOURCE/node_modules — cần \`npm install\` trong SOURCE/ (cổng kiểm tra không chạy được)`
  : "đủ (tsc, eslint, vitest có trong SOURCE/node_modules)";
const pwLine = fs.existsSync(path.join(src, "scripts", "pw", "cli.mjs"))
  ? "có SOURCE/scripts/pw/cli.mjs"
  : "THIẾU SOURCE/scripts/pw/cli.mjs";

const context = [
  "[PHIÊN MỚI — MS-MOLAR] Làm CLAUDE.md §2 NGAY, trước việc đầu tiên: báo MỘT dòng về công cụ, rồi ≤3 dòng việc dang dở và hỏi có tiếp không.",
  "Hook đã kiểm cơ học:",
  `- Composio MCP: ${composioLine}`,
  `- Cổng kiểm tra: ${gatesLine}`,
  `- Playwright CLI: ${pwLine}`,
  "--- PROGRESS.md ---",
  openProgress(),
].join("\n");

process.stdout.write(
  JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } })
);
process.exit(0);
