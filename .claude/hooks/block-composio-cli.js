#!/usr/bin/env node
// PreToolUse hook (matcher: Bash|PowerShell) — chặn lệnh CLI `composio ...`
// vì nó không chạy trên Windows trong project này (.claude/MEMORY.md §2 Pha 1).
// Bắt buộc dùng MCP tool COMPOSIO_SEARCH_TOOLS -> COMPOSIO_MULTI_EXECUTE_TOOL.
let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const input = JSON.parse(data);
    const cmd = String((input.tool_input && input.tool_input.command) || "").trim();
    // Khớp "composio" ở đầu lệnh hoặc sau ;/&&/|| — tránh khớp nhầm chuỗi con
    // trong đường dẫn hay tên biến khác.
    if (/(^|[;&|]\s*)composio(\s|$)/.test(cmd)) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason:
              "Composio CLI không chạy trên Windows trong project MS-MOLAR (xem .claude/MEMORY.md §2 Pha 1 và .claude/CONVENTIONS.md §1). Dùng MCP tool COMPOSIO_SEARCH_TOOLS -> COMPOSIO_MULTI_EXECUTE_TOOL thay vì gọi `composio` qua shell.",
          },
        })
      );
    }
  } catch {
    // Parse lỗi thì bỏ qua, không chặn oan lệnh khác.
  }
  process.exit(0);
});
