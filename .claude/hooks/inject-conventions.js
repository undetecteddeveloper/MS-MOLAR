#!/usr/bin/env node
// UserPromptSubmit hook — bơm lại .claude/CONVENTIONS.md vào context mỗi lượt
// prompt, thay vì trông chờ nó tự "nhớ" giữa một context đang đầy dần.
const fs = require("fs");
const path = require("path");

let data = "";
process.stdin.on("data", (c) => (data += c));
process.stdin.on("end", () => {
  try {
    const conventionsPath = path.join(__dirname, "..", "CONVENTIONS.md");
    const content = fs.readFileSync(conventionsPath, "utf8");
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "UserPromptSubmit",
          additionalContext: content,
        },
      })
    );
  } catch {
    // Thiếu file hay lỗi đọc thì im lặng bỏ qua — không được làm hỏng lượt prompt.
  }
  process.exit(0);
});
