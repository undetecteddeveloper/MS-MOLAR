// Bộ đánh giá giọng Socratic 10 ca — PRD Success Criteria #9 (Work Plan Phase 5,
// Task 21). KHÔNG phải test hồi quy: nó gọi Gemini THẬT, tốn quota, và kết luận
// cuối cùng do NGƯỜI chấm. Vì thế nó tắt mặc định.
//
// Chạy:
//   cd SOURCE && TUTOR_TONE_EVAL=1 npx vitest run lib/tutor/__tests__/toneEval.manual.test.ts --reporter=basic
//   (PowerShell: $env:TUTOR_TONE_EVAL=1; npx vitest run ...)
//
// VÌ SAO LÀ FILE VITEST CHỨ KHÔNG PHẢI SCRIPT tsx: generateHint() nằm sau
// lib/ugc/gemini.ts vốn `import "server-only"` — tsx chạy ngoài bundle
// react-server nên import thẳng sẽ ném. Năm file *.int.test.ts trong repo này
// đã dựng sẵn lối đi: `vi.mock("server-only")`. Đi đường đó thì bộ đánh giá gọi
// ĐÚNG hàm production (cùng prompt, cùng model, cùng deadline, cùng retry) chứ
// không phải một bản chép lại — điều kiện tiên quyết để verdict có nghĩa.
//
// CÁCH CHẤM (bảng verdict ghi trong docs/plans/tasks/
// engine1-adaptive-ai-work-plan-phase5-completion.md):
//   - Tiếng Việt: Y/N          — ngưỡng đạt 10/10
//   - Đúng lối Socratic: Y/N   — ngưỡng đạt 10/10 (dẫn dắt bằng câu hỏi)
//   - Nêu đáp án cuối: Y/N     — ngưỡng đạt 0/10
// Một ca trượt là tín hiệu DỪNG-VÀ-CHỈNH: sửa chỉ dẫn trong buildTutorPrompt()
// rồi chạy lại CẢ 10 ca, không chỉ ca trượt.
//
// ⚠ HẠN NGẠCH — ĐỌC TRƯỚC KHI CHẠY (đo 2026-08-16, đọc thẳng thân lỗi 429):
//   quotaId `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, quotaValue
//   **20 request/NGÀY** cho `gemini-3.5-flash`, reset lúc nửa đêm giờ Thái Bình
//   Dương. Một lượt 10 ca tiêu ít nhất một NỬA hạn mức ngày, và tiêu hơn nữa
//   nếu generateHint() phải retry. Hệ quả: đừng chạy file này "để thử" — canh
//   chạy đúng một lượt trọn vẹn, và đừng dùng chung ngày với việc trích UGC
//   (cùng key, cùng model). Con số 20/ngày này còn là trần của CHÍNH TÍNH NĂNG
//   gia sư trên production, không riêng gì bộ đánh giá — đã ghi vào
//   engine1-adaptive-ai-work-plan-phase5-completion.md để Task 24 xử lý.
//
// Assertion trong file này CỐ Ý chỉ chặn phần máy đọc được (có trả về chuỗi,
// có dấu tiếng Việt, có ít nhất một dấu hỏi) — ba tiêu chí trên vẫn cần mắt
// người. Assertion máy đỏ = hỏng ở tầng thấp hơn tiêu chí giọng văn.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { TutorPromptInput } from "../prompt";

function loadEnvLocal(): void {
  const path = resolve(__dirname, "../../../.env.local");
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^"(.*)"$/, "$1");
    if (process.env[key] === undefined) process.env[key] = value;
  }
}
loadEnvLocal();

const ENABLED = process.env.TUTOR_TONE_EVAL === "1" && Boolean(process.env.GEMINI_API_KEY);

vi.mock("server-only", () => ({}));

const { generateHint } = await import("../callTutor");

/** 10 ca CỐ ĐỊNH — nội dung câu hỏi chép nguyên văn từ corpus Toán thật trên
 *  dev, đáp án học sinh là một lỗi sai hợp lý (không phải bừa) cho từng ca.
 *  Cố định để lần chạy sau so được với lần trước (PRD R-b: "một bài đánh giá
 *  không lặp lại được thì không phải bằng chứng"). */
const CASES: Array<{ label: string; input: TutorPromptInput }> = [
  {
    label: "01 mcq · tập xác định",
    input: {
      questionType: "mcq",
      questionContent: "Tập xác định của hàm số y = 1 / (x - 2) là?",
      choices: [
        { id: "A", text: "ℝ" },
        { id: "B", text: "ℝ \\ {2}" },
        { id: "C", text: "ℝ \\ {0}" },
        { id: "D", text: "(2; +∞)" },
      ],
      studentAnswer: "A",
    },
  },
  {
    label: "02 mcq · phương trình bậc nhất",
    input: {
      questionType: "mcq",
      questionContent: "Nghiệm của phương trình 2x + 6 = 0 là?",
      choices: [
        { id: "A", text: "x = 3" },
        { id: "B", text: "x = -3" },
        { id: "C", text: "x = 6" },
        { id: "D", text: "x = -6" },
      ],
      studentAnswer: "A",
    },
  },
  {
    label: "03 mcq · đỉnh parabol",
    input: {
      questionType: "mcq",
      questionContent: "Parabol y = x² - 4x + 3 có tọa độ đỉnh là?",
      choices: [
        { id: "A", text: "(2; -1)" },
        { id: "B", text: "(-2; -1)" },
        { id: "C", text: "(2; 1)" },
        { id: "D", text: "(1; 0)" },
      ],
      studentAnswer: "B",
    },
  },
  {
    label: "04 mcq · số điểm cực trị",
    input: {
      questionType: "mcq",
      questionContent: "Cho hàm số y = x^3 - 3x + 1. Số điểm cực trị của hàm số là:",
      choices: [
        { id: "A", text: "0" },
        { id: "B", text: "1" },
        { id: "C", text: "2" },
        { id: "D", text: "3" },
      ],
      studentAnswer: "A",
    },
  },
  {
    label: "05 mcq · tập nghiệm bậc hai",
    input: {
      questionType: "mcq",
      questionContent: "Phương trình x² - 5x + 6 = 0 có tập nghiệm là?",
      choices: [
        { id: "A", text: "{1; 6}" },
        { id: "B", text: "{-2; -3}" },
        { id: "C", text: "{2; 3}" },
        { id: "D", text: "{-1; -6}" },
      ],
      studentAnswer: "B",
    },
  },
  {
    label: "06 true_false · khảo sát parabol",
    input: {
      questionType: "true_false",
      questionContent: "Cho hàm số y = x^2 - 4x + 3. Xét tính đúng sai của các khẳng định sau:",
      subItems: [
        { id: "a", text: "Hàm số nghịch biến trên khoảng (-∞; 2)." },
        { id: "b", text: "Đồ thị hàm số cắt trục hoành tại hai điểm phân biệt." },
        { id: "c", text: "Giá trị nhỏ nhất của hàm số bằng -1." },
        { id: "d", text: "Đồ thị hàm số đi qua điểm (0; 4)." },
      ],
      studentAnswer: "a:S,b:Đ,c:Đ,d:Đ",
    },
  },
  {
    label: "07 true_false · nguyên hàm",
    input: {
      questionType: "true_false",
      questionContent: "Hàm số F(x) là một nguyên hàm của hàm số f(x) = 6x^2 - 3 trên R và có F(-1) = 3.",
      subItems: [
        {
          id: "a",
          text: "Diện tích hình phẳng giới hạn bởi đồ thị hàm số f(x) = 6x^2 - 3 và g(x) = 1 + 2x là S = 125/27",
        },
        { id: "b", text: "F(1) = 1" },
        { id: "c", text: "integral from 0 to 1 of f(x) dx = 1" },
        { id: "d", text: "F(x) = 3x^3 - 3x - 2" },
      ],
      studentAnswer: "a:Đ,b:Đ,c:S,d:S",
    },
  },
  {
    label: "08 true_false · tính đơn điệu",
    input: {
      questionType: "true_false",
      questionContent: "Cho hàm số y = 2x - 1. Xét tính đúng sai của các khẳng định sau:",
      subItems: [
        { id: "a", text: "Hàm số đồng biến trên ℝ." },
        { id: "b", text: "Đồ thị hàm số cắt trục tung tại điểm (0; -1)." },
        { id: "c", text: "Hàm số có giá trị nhỏ nhất bằng -1." },
        { id: "d", text: "Đồ thị hàm số là một đường thẳng." },
      ],
      studentAnswer: "a:S,b:Đ,c:Đ,d:Đ",
    },
  },
  {
    label: "09 short_answer · đạo hàm tại một điểm",
    input: {
      questionType: "short_answer",
      questionContent: "Tính đạo hàm của hàm số y = 3x^2 - 2x + 5 tại x = 1.",
      studentAnswer: "6",
    },
  },
  {
    label: "10 short_answer · diện tích hình chữ nhật",
    input: {
      questionType: "short_answer",
      questionContent:
        "Một hình chữ nhật có chiều dài 8 cm và chiều rộng 5 cm. Tính diện tích hình chữ nhật đó (đơn vị: cm^2).",
      studentAnswer: "26",
    },
  },
];

if (!ENABLED) {
  console.warn(
    "! toneEval.manual.test.ts BỎ QUA: cần TUTOR_TONE_EVAL=1 và GEMINI_API_KEY. " +
      "File này gọi Gemini thật và chỉ chạy khi có người ngồi chấm kết quả."
  );
}

/** Đích ghi báo cáo — tên CỐ ĐỊNH, ghi đè mỗi lần chạy: bằng chứng phải là
 *  "lần chạy mới nhất", không phải một đống file tích tụ như
 *  supabase/skill-tagging-report-*.json đã thành. Verdict của người chấm ghi ở
 *  engine1-adaptive-ai-work-plan-phase5-completion.md, không ghi vào đây (file
 *  này bị ghi đè). */
const REPORT_PATH = resolve(
  __dirname,
  "../../../../docs/plans/tasks/engine1-adaptive-ai-tone-eval-report.md"
);
const report: string[] = [
  "# Tone eval — 10 ca gia sư Socratic (PRD Success Criteria #9)",
  "",
  "Sinh tự động bởi `SOURCE/lib/tutor/__tests__/toneEval.manual.test.ts`.",
  "GHI ĐÈ mỗi lần chạy. Verdict của người chấm nằm ở",
  "`engine1-adaptive-ai-work-plan-phase5-completion.md`, không nằm ở đây.",
  "",
  `Chạy lúc: ${new Date().toISOString()}`,
  "",
];

afterAll(() => {
  if (!ENABLED) return;
  writeFileSync(REPORT_PATH, report.join("\n"), "utf8");
});

/** Giãn cách giữa hai ca — mặc định 0.
 *
 *  Giãn cách KHÔNG cứu được hạn ngạch: ràng buộc thật là
 *  `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, **20 request/NGÀY** cho
 *  `gemini-3.5-flash` (đọc thẳng từ thân 429 ngày 2026-08-16 — xem chú thích
 *  "HẠN NGẠCH" ở đầu file). Một lượt 10 ca ăn ít nhất 10/20, và ăn nhiều hơn
 *  nếu generateHint() phải retry. Biến này để dành cho tài khoản trả phí, nơi
 *  trần là theo PHÚT và giãn cách mới có tác dụng. */
const PACING_MS = Number(process.env.TUTOR_TONE_EVAL_PACING_MS ?? 0);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe.skipIf(!ENABLED)("PRD Success Criteria #9 — 10 ca đánh giá giọng Socratic", () => {
  CASES.forEach((c, index) => {
    it(
      c.label,
      async () => {
        if (index > 0) await sleep(PACING_MS);
        const hint = await generateHint(c.input);

        report.push(
          `## ${c.label} (${c.input.questionType})`,
          "",
          `**Đề:** ${c.input.questionContent}`,
          "",
          `**Học sinh trả lời:** \`${c.input.studentAnswer}\``,
          "",
          "**Gợi ý gia sư:**",
          "",
          ...hint.split("\n").map((l) => `> ${l}`),
          ""
        );

        expect(hint.trim().length).toBeGreaterThan(0);
        // Có dấu tiếng Việt — chặn trường hợp model rơi sang tiếng Anh hoàn toàn.
        expect(hint).toMatch(/[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]/i);
        // Có ít nhất một câu hỏi — điều kiện CẦN (không đủ) của lối Socratic.
        expect(hint).toContain("?");
      },
      // PACING_MS + 30s deadline của generateHint + biên cho retry nội bộ.
      PACING_MS + 90_000
    );
  });
});
