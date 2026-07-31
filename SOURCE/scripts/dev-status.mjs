// Dev status console — chạy song song `next dev`, in bản đồ pipeline (UGC
// upload + auto-scoring) và cổng server đang lắng nghe, để xem tiến trình
// dev server trong Debug Console / terminal thay vì phải đọc code.
//
// Chạy: `npm run dev:status` (terminal thường) hoặc qua VS Code Run & Debug
// (.vscode/launch.json) để log hiện trong Debug Console.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const NEXT_BIN = path.join(ROOT, "node_modules", "next", "dist", "bin", "next");
// Khớp path trong lib/ugc/quotaTracker.ts — kênh duy nhất để đọc chéo sang
// tiến trình server Next (dev-status.mjs không share bộ nhớ với nó).
const QUOTA_FILE_PATH = path.join(tmpdir(), "ms-molar-ugc-quota.json");
const QUOTA_INTERVAL_MS = 15_000;

const line = (ch = "─") => ch.repeat(72);

function banner() {
  console.log(line("═"));
  console.log("  MS-MOLAR — Dev Pipeline Map");
  console.log(line("═"));
  console.log("");
  console.log("Layers:");
  console.log("  (layer1) Auth            — login, reset-password");
  console.log("  (layer2) Exam taking     — browse, attempt, submit, result");
  console.log("  (layer3) —               — chưa có route (reserved)");
  console.log("  (layer4) UGC upload      — upload, review, publish, my-exams");
  console.log("");
  console.log(line());
  console.log("Pipeline: UGC Exam Upload  (lib/ugc/*, app/(layer4)/actions.ts)");
  console.log(line());
  console.log("  extractAndAssemble() — 8 stages, log prefix [ugc-pipeline]:");
  console.log("    1/8  Metadata          manual: validate ngay · automatic: AI đọc trang 1");
  console.log("    2/8  File check        loại, kích thước, số trang PDF (2 file bắt buộc)");
  console.log("    3/8  Exam record       tạo mới hoặc reset (status=processing)");
  console.log("    4/8  Storage upload    2 file gốc → bucket exam-uploads");
  console.log("    5/8  AI extraction     Gemini song song: questions/answers[/metadata]");
  console.log("    6/8  Crop images       cắt hình câu hỏi theo bounding box");
  console.log("    7/8  Assemble+validate ghép đáp án theo (part, number) + kiểm tra");
  console.log("    8/8  Persist           lưu DB → status = review | failed");
  console.log("");
  console.log("  Live: log [ugc-pipeline] sẽ xuất hiện bên dưới khi có ai upload đề.");
  console.log("");
  console.log(line());
  console.log("Pipeline: Auto-scoring  (lib/scoring/computeScore.ts, app/(layer2)/actions.ts)");
  console.log(line());
  console.log("  submitExam() — 6 steps (không log riêng, chạy trong 1 request):");
  console.log("    1/6  Load attempt      theo attemptId, RLS-scoped, idempotent nếu đã nộp");
  console.log("    2/6  Load questions    kèm correct_answer + sub_answers (server-only)");
  console.log("    3/6  Upsert answers    batch-insert attempt_answers");
  console.log("    4/6  computeScore()    pure — mcq + true_false auto-scored;");
  console.log("                          short_answer/essay: stored, not auto-scored");
  console.log("    5/6  Insert result     exam_results (total_score, per_question, topic)");
  console.log("    6/6  Lock attempt      status=submitted");
  console.log("");
  console.log(line("═"));
  console.log("");
}

/** Giờ/phút/giây hiện tại theo múi Pacific — quota ngày của Gemini reset lúc 00:00 giờ này. */
function pacificClock(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { hour: get("hour") % 24, minute: get("minute"), second: get("second") };
}

function secondsUntilPacificMidnight(now) {
  const { hour, minute, second } = pacificClock(new Date(now));
  return 86400 - (hour * 3600 + minute * 60 + second);
}

function pacificDayStartMs(now) {
  const { hour, minute, second } = pacificClock(new Date(now));
  return now - (hour * 3600 + minute * 60 + second) * 1000;
}

function formatHms(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

function loadQuotaRecords() {
  try {
    if (!existsSync(QUOTA_FILE_PATH)) return [];
    return JSON.parse(readFileSync(QUOTA_FILE_PATH, "utf8"));
  } catch {
    return [];
  }
}

const QUOTA_ROLES = ["questions", "answers", "metadata"];

function printQuotaUsage() {
  const records = loadQuotaRecords();
  const now = Date.now();
  const windowStart = now - 60_000;
  const dayStart = pacificDayStartMs(now);
  const sumTokens = (arr) => arr.reduce((acc, r) => acc + (r.totalTokens || 0), 0);

  console.log(line());
  console.log("AI usage (Gemini) — cập nhật mỗi 15s (Gemini không có API tra hạn mức còn lại, chỉ tự đếm)");
  console.log(line());
  if (records.length === 0) {
    console.log("  (chưa có lượt gọi AI nào kể từ khi dev server khởi động)");
  } else {
    for (const role of QUOTA_ROLES) {
      const roleRecords = records.filter((r) => r.role === role);
      if (roleRecords.length === 0) {
        console.log(`  ${role.padEnd(10)} — chưa có lượt gọi`);
        continue;
      }
      const model = roleRecords[roleRecords.length - 1].model;
      const last60 = roleRecords.filter((r) => r.ts >= windowStart);
      const today = roleRecords.filter((r) => r.ts >= dayStart);
      console.log(`  ${role.padEnd(10)} (${model})`);
      console.log(`    60s gần nhất : ${last60.length} request · ${sumTokens(last60)} token`);
      console.log(`    hôm nay      : ${today.length} request · ${sumTokens(today)} token`);
    }
  }
  console.log(
    `  → bộ đếm "hôm nay" reset sau ${formatHms(secondsUntilPacificMidnight(now))} (00:00 giờ Pacific)`,
  );
  console.log(line());
  console.log("");
}

/**
 * env cho tiến trình `next dev` con — bỏ biến VS Code dùng để tự gắn debugger
 * vào tiến trình con (NODE_OPTIONS="--require .../bootloader.js",
 * VSCODE_INSPECTOR_OPTIONS). Khi chạy dev-status.mjs qua Run & Debug, VS Code
 * tiêm 2 biến này để auto-attach debugger vào MỌI process con nó thấy — next
 * dev lại spawn thêm process con cho Turbopack/native module (sharp, mupdf
 * WASM), và debugger cố gắn vào các process đó gây crash fastfail Windows
 * (thoát code 3221226505 = 0xC0000409 STATUS_STACK_BUFFER_OVERRUN). Ta chỉ
 * cần stdout/stderr của next dev, không cần đặt breakpoint vào code Next nội
 * bộ, nên tắt hẳn auto-attach cho tiến trình con là an toàn.
 */
function childEnv() {
  const env = { ...process.env };
  delete env.NODE_OPTIONS;
  delete env.VSCODE_INSPECTOR_OPTIONS;
  return env;
}

function startNextDev() {
  if (!existsSync(NEXT_BIN)) {
    console.error(`✗ Không thấy ${NEXT_BIN} — chạy \`npm install\` trong SOURCE trước.`);
    process.exit(1);
  }
  console.log("▶ Starting `next dev` …\n");

  const child = spawn(process.execPath, [NEXT_BIN, "dev"], {
    cwd: ROOT,
    env: childEnv(),
    stdio: ["inherit", "pipe", "pipe"],
  });

  let portReported = false;
  const watchForPort = (chunk) => {
    if (portReported) return;
    const match = chunk.match(/https?:\/\/localhost:(\d+)/);
    if (match) {
      portReported = true;
      console.log("");
      console.log(line());
      console.log(`✓ Dev server đang lắng nghe cổng ${match[1]} (http://localhost:${match[1]})`);
      console.log(`  → Xem tab "Ports" của VS Code để thấy cổng này được forward.`);
      console.log(line());
      console.log("");
    }
  };

  child.stdout.on("data", (data) => {
    const text = data.toString();
    watchForPort(text);
    process.stdout.write(text);
  });
  child.stderr.on("data", (data) => {
    watchForPort(data.toString());
    process.stderr.write(data);
  });

  child.on("exit", (code) => {
    console.log(`\n■ next dev exited (code ${code}).`);
    process.exit(code ?? 0);
  });

  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => child.kill(sig));
  }
}

banner();
startNextDev();
printQuotaUsage();
setInterval(printQuotaUsage, QUOTA_INTERVAL_MS);
