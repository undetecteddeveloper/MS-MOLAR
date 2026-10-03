// PreToolUse hook — chặn CỨNG những thứ máy kiểm được (luật bằng chữ dễ bị quên):
//   - dịch vụ ngoài (Supabase, Vercel) CHỈ đi qua Composio MCP: chặn CLI `supabase`, `vercel`,
//     `composio` qua shell, và mọi MCP Supabase/Vercel gọi trực tiếp (ngoài mcp__composio__*);
//   - Playwright MCP (dùng Playwright CLI: node scripts/pw/cli.mjs);
//   - `git push` khi lượt nhắn gần nhất của người dùng không có ý đó (cờ do prompt-reminder.js ghi).
// Hook tự hỏng thì lệnh vẫn đi qua (không chặn oan) nhưng báo lỗi ra stderr để người dùng thấy.
const fs = require("fs");
const os = require("os");
const path = require("path");

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: reason },
    })
  );
}

function pushIntent() {
  try {
    const flag = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "ms-molar-push-intent.json"), "utf8"));
    return flag.intent === true;
  } catch {
    return false;
  }
}

// Bỏ nội dung trong dấu nháy trước khi tách lệnh: chuỗi như 'git push|vercel deploy' hay
// commit message chứa "; git push" không phải là lệnh thật.
const stripQuoted = (cmd) => cmd.replace(/'[^']*'|"(?:[^"\\]|\\.)*"/g, '""');
const segments = (cmd) => stripQuoted(cmd).split(/&&|\|\||[;&|\r\n]/).map((s) => s.trim()).filter(Boolean);
const GIT_PUSH = /^git\s+(?:(?:-C|-c)\s+\S+\s+|--[\w-]+(?:=\S+)?\s+)*push(?:\s|$)/i;
const EXTERNAL_CLI = /^(?:npx\s+(?:-y\s+)?)?(supabase|vercel|composio)(?:\s|$)/i;

const VIA_COMPOSIO =
  "Dịch vụ ngoài (Supabase, Vercel…) CHỈ đi qua Composio MCP: COMPOSIO_SEARCH_TOOLS → COMPOSIO_MULTI_EXECUTE_TOOL (CLAUDE.md §8; tên công cụ và cách dùng: .claude/workflow/ops-db.md, ops-env.md). Nếu công cụ Composio không có trong phiên: báo THIẾU cho người dùng (CLAUDE.md §4), không dùng đường khác. ";

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data.replace(/^﻿/, ""));
    const tool = String(input.tool_name || "");

    if (tool.startsWith("mcp__playwright__")) {
      deny("Không dùng Playwright MCP (CLAUDE.md §8). Trình duyệt: `node scripts/pw/cli.mjs` (Playwright CLI).");
    } else if (tool.startsWith("mcp__") && !tool.startsWith("mcp__composio__") && /supabase|vercel/i.test(tool)) {
      deny(VIA_COMPOSIO + "MCP Supabase/Vercel gọi trực tiếp bị chặn.");
    } else {
      const cmd = String((input.tool_input && input.tool_input.command) || "");
      for (const seg of segments(cmd)) {
        const cli = EXTERNAL_CLI.exec(seg);
        if (cli) {
          deny(VIA_COMPOSIO + `CLI \`${cli[1].toLowerCase()}\` bị chặn.`);
          break;
        }
        if (GIT_PUSH.test(seg) && !pushIntent()) {
          deny(
            'Chưa có yêu cầu push trong lượt nhắn gần nhất của người dùng. Luật (CLAUDE.md §6): xong việc thì commit trên nhánh rồi DỪNG. Báo người dùng đã commit xong và nói họ nhắn "push" nếu muốn đưa lên.'
          );
          break;
        }
      }
    }
  } catch (e) {
    // Hook tự hỏng: KHÔNG được im lặng. Exit 1 = lỗi không chặn nhưng hiện ra cho người dùng thấy.
    process.stderr.write(`guard.js lỗi (${e.message}) — lớp bảo vệ KHÔNG chạy cho lệnh này\n`);
    process.exit(1);
  }
  process.exit(0);
});
