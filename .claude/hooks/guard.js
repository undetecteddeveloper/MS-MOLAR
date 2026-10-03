// PreToolUse hook — chặn CỨNG những thứ máy kiểm được (luật bằng chữ dễ bị quên):
//   - CLI `composio` qua shell (không chạy trên Windows; dùng MCP COMPOSIO_*);
//   - `supabase db push` (project linked của CLI là PROD);
//   - `git push` và `vercel deploy/--prod` khi lượt nhắn gần nhất của người dùng không có ý đó
//     (cờ do prompt-reminder.js ghi);
//   - Playwright MCP và Supabase MCP gọi trực tiếp (dùng Playwright CLI, Composio, supabase CLI).
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
const SUPABASE_DB_PUSH = /^(?:npx\s+(?:-y\s+)?)?supabase\s+db\s+push(?:\s|$)/i;
const COMPOSIO_CLI = /^composio(?:\s|$)/i;
const VERCEL = /^(?:npx\s+(?:-y\s+)?)?vercel(?:\s+(.*))?$/i;

function vercelDeploys(seg) {
  const m = VERCEL.exec(seg);
  if (!m) return false;
  const args = (m[1] || "").trim().split(/\s+/).filter(Boolean);
  const first = args.find((a) => !a.startsWith("-"));
  return args.includes("--prod") || !first || ["deploy", "promote", "rollback", "redeploy"].includes(first);
}

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data.replace(/^﻿/, ""));
    const tool = String(input.tool_name || "");

    if (tool.startsWith("mcp__playwright__") || tool.startsWith("mcp__supabase__")) {
      deny(
        "Không dùng Playwright MCP / Supabase MCP trực tiếp (CLAUDE.md §8). Trình duyệt: `node scripts/pw/cli.mjs` (Playwright CLI). Supabase: Composio (SUPABASE_*) hoặc `npx supabase db query --project-ref <ref dev>` (xem .claude/workflow/ops-db.md)."
      );
    } else {
      const cmd = String((input.tool_input && input.tool_input.command) || "");
      for (const seg of segments(cmd)) {
        if (COMPOSIO_CLI.test(seg)) {
          deny(
            "CLI `composio` không chạy trên Windows ở máy này. Dùng MCP COMPOSIO_SEARCH_TOOLS → COMPOSIO_MULTI_EXECUTE_TOOL. Nếu công cụ MCP không có trong phiên: báo THIẾU cho người dùng (CLAUDE.md §4, .claude/workflow/ops-env.md), không bỏ qua bước."
          );
          break;
        }
        if (SUPABASE_DB_PUSH.test(seg)) {
          deny(
            "`supabase db push` bị chặn: project linked của CLI là PROD. Dùng quy trình migration trong .claude/workflow/ops-db.md (áp dev bằng `db query --project-ref`; prod chỉ qua Composio khi người dùng yêu cầu rõ)."
          );
          break;
        }
        if ((GIT_PUSH.test(seg) || vercelDeploys(seg)) && !pushIntent()) {
          deny(
            'Chưa có yêu cầu push/deploy trong lượt nhắn gần nhất của người dùng. Luật (CLAUDE.md §6): xong việc thì commit trên nhánh rồi DỪNG. Báo người dùng đã commit xong và nói họ nhắn "push" (hoặc "deploy") nếu muốn đưa lên.'
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
