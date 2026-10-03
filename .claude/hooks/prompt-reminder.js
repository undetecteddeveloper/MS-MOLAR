// UserPromptSubmit hook — hai việc:
//   1) bơm lại 6 dòng nhắc (luật đầy đủ nằm ở CLAUDE.md, không chép vào đây);
//   2) ghi cờ "người dùng có nói push/deploy trong lượt nhắn này không" cho guard.js đọc.
const fs = require("fs");
const os = require("os");
const path = require("path");

const REMINDER = [
  "[NHẮC — MS-MOLAR] Luật đầy đủ: CLAUDE.md.",
  '1) Đầu việc nói "Tôi coi đây là <loại>", rồi đọc .claude/workflow/<loại>.md. Chỉ hỏi người dùng về hướng SẢN PHẨM; kỹ thuật tự quyết.',
  '2) Công cụ thiếu/lỗi: thử lại 1 lần → báo ngay → ghi CHƯA LÀM → không nói "xong". Composio hoặc cổng kiểm tra thiếu = dừng phần liên quan.',
  "3) Việc không hoàn tác: nói hệ quả bằng lời thường rồi hỏi có/không.",
  "4) Xong việc: cổng kiểm tra → commit trên nhánh → DỪNG. Push, main, deploy chỉ khi người dùng nói.",
  '5) Báo cáo cuối: dòng đầu "ĐỦ BƯỚC" hoặc "THIẾU n BƯỚC: <bước> — <lý do> — <người dùng cần làm gì>".',
].join("\n");

const PUSH_INTENT =
  /(^|[^\p{L}\p{N}])(push|deploy|ship|release|đẩy|đưa lên|lên main|lên prod|triển khai)([^\p{L}\p{N}]|$)/iu;

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const prompt = String(JSON.parse(data.replace(/^﻿/, "")).prompt || "").normalize("NFC");
    fs.writeFileSync(
      path.join(os.tmpdir(), "ms-molar-push-intent.json"),
      JSON.stringify({ intent: PUSH_INTENT.test(prompt), at: Date.now() })
    );
  } catch {
    // Không ghi được cờ thì guard.js coi như chưa có ý push (an toàn hơn).
  }
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: "UserPromptSubmit", additionalContext: REMINDER } })
  );
  process.exit(0);
});
