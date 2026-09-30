# Quy ước bắt buộc — MS-MOLAR

> File này được hook `UserPromptSubmit` bơm lại vào context ở MỖI lượt prompt.
> Giữ NGẮN — chỉ những quy tắc đã từng bị vi phạm thật, có bằng chứng trong
> `.claude/MEMORY.md`. Đừng chép nguyên văn cả MEMORY.md vào đây, sẽ mất tác
> dụng (loãng lại chính là vấn đề file này tồn tại để giải quyết).

## 1. Composio trên Windows
- Toolkit đã connect: `notion`, `supabase`, `vercel`, `google drive`.
- **KHÔNG** gọi CLI `composio search` / `composio execute` qua Bash hay
  PowerShell — CLI không chạy trên Windows trong máy này (đã xác nhận nhiều
  lần, xem `.claude/MEMORY.md` §2 Pha 1).
- Dùng **MCP tool**: `COMPOSIO_SEARCH_TOOLS` → `COMPOSIO_MULTI_EXECUTE_TOOL`.
- Có hook `PreToolUse` chặn cứng lệnh `composio ...` gọi qua Bash/PowerShell —
  nếu bị chặn, đây là lý do.

## 2. Supabase — hai đường, đừng lẫn
- MCP server `supabase` trực tiếp (`.mcp.json`, `mcp__supabase__*`) chỉ bind
  cứng vào **một** project ref cố định (project dev/preview) — dùng cho đọc
  schema/dữ liệu dev hằng ngày.
- Khi cần kiểm tra **prod** (đặc biệt: so `schema_version` fingerprint trước
  khi coi một feature có bảng/cột mới là "xong" — xem MEMORY.md Pha 3.5, đã nổ
  4 lần) → PHẢI qua Composio (`SUPABASE_RUN_READ_ONLY_QUERY`, ref lấy từ
  `SUPABASE_LIST_ALL_PROJECTS`). MCP trực tiếp không thấy được project prod.

## 3. UI audit
- Dùng **Playwright CLI**, không dùng bản MCP server, cho workflow
  `ui-interaction-audit.skill`.

## 4. Screenshot
- Playwright MCP ghi ảnh vào path khai trong `--output-dir` của `.mcp.json`
  (hiện tại: `E:/WebApp-project/MS-MOLAR/SCREENSHOT/temporary_screenshot`).
  Nếu path đó lệch với vị trí project thật (vd sau khi đổi tên/di chuyển thư
  mục), ảnh sẽ rơi sai chỗ — kiểm `.mcp.json` trước khi nghi ngờ do quên quy
  ước.
