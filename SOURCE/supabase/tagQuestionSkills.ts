// Batch gắn thẻ kỹ năng cho câu hỏi Toán (Engine 1, PRD R2, AC-005..008).
//
// Cách chạy (sau khi supabase/seedSkillTaxonomy.ts đã seed taxonomy):
//   cd SOURCE
//   npx tsx supabase/tagQuestionSkills.ts            # DRY-RUN (mặc định, không ghi)
//   npx tsx supabase/tagQuestionSkills.ts --apply    # ghi thật
//
// Chạy trên prod (đặt SCHEMA_ENV_FILE, cùng convention verify-schema.ts):
//   SCHEMA_ENV_FILE=.env.local.prod-backup npx tsx supabase/tagQuestionSkills.ts
//
// DRY-RUN LÀ MẶC ĐỊNH có chủ ý: AC-008 đòi engineer đọc 100% các đề xuất
// "tagged" TRƯỚC khi có bất cứ dòng nào được ghi. Report JSON ghi ra
// supabase/skill-tagging-report-<ISO>.json (đã gitignore) chính là vật liệu
// cho bước review đó.
//
// Corpus: subject in ('Math', 'Toán') — 10 dòng 'Toán' không chuẩn hoá vẫn là
// câu Toán thật (PRD R2), bỏ sót chúng là bỏ sót một phần corpus.
//
// Dùng service_role key (bypass RLS + column grant), CHỈ chạy local.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

import { SKILL_TAG_CONFIDENCE_THRESHOLD } from "../lib/adaptive/constants";
import { SKILL_NODES } from "../lib/adaptive/skillTaxonomy";
import { decideSkillTag, type SkillClassification } from "../lib/adaptive/tagDecision";

// --- Nạp env từ .env.local (tsx không tự load như Next.js) ----------------
/** File env đang dùng — đọc một lần để log ra đúng cái đã thật sự nạp. */
const ENV_FILE = process.env.SCHEMA_ENV_FILE?.trim() || ".env.local";

/**
 * Đọc env từ `.env.local`, hoặc từ file khác nếu đặt `SCHEMA_ENV_FILE` — cùng
 * convention với `verify-schema.ts` và `seedSkillTaxonomy.ts`. Ở script NÀY nó
 * còn quan trọng hơn: `--apply` ghi vào `questions` của DB đích, và report JSON
 * là vật liệu engineer duyệt theo AC-008 — một report không nói nó đọc corpus
 * của môi trường nào thì không duyệt được.
 */
function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "..", ENV_FILE), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

interface CorpusQuestion {
  id: string;
  content: string;
  subject: string | null;
  grade: number | null;
  topic: string | null;
  skill_node_id: string | null;
}

interface ReportEntry {
  questionId: string;
  subject: string | null;
  grade: number | null;
  contentPrefix: string;
  proposedSkillNodeId: string | null;
  confidence: number | null;
  decision: "tagged" | "left-null";
  reason: string;
  wrote: boolean;
}

const CLASSIFY_SCHEMA = {
  type: "object",
  properties: {
    skillNodeId: {
      type: "string",
      description: "id của node kỹ năng phù hợp nhất, hoặc chuỗi rỗng nếu không xếp được",
    },
    confidence: { type: "number", description: "độ tin cậy 0..1" },
  },
  required: ["skillNodeId", "confidence"],
} as const;

function buildClassifyPrompt(q: CorpusQuestion): string {
  const catalogue = SKILL_NODES.map((n) => `- ${n.id}: ${n.labelVi}`).join("\n");
  return [
    "Bạn phân loại câu hỏi Toán THPT Việt Nam vào MỘT node kỹ năng trong danh sách cố định dưới đây.",
    "",
    "Danh sách node (chỉ được trả về đúng một `id` trong danh sách này, không bịa id mới):",
    catalogue,
    "",
    "Quy tắc:",
    "- Chọn node mô tả kỹ năng CHÍNH mà câu hỏi kiểm tra, không phải mọi kỹ năng phụ liên quan.",
    "- `confidence` phản ánh mức chắc chắn thật: không chắc thì để thấp, đừng làm tròn lên.",
    "- Nếu câu hỏi không thuộc node nào trong danh sách, trả `skillNodeId` là chuỗi rỗng và `confidence` 0.",
    "",
    `Thông tin câu hỏi (lớp: ${q.grade ?? "không rõ"}, chủ đề: ${q.topic ?? "không rõ"}):`,
    q.content,
  ].join("\n");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Số lần thử phân loại MỘT câu. Cần thêm lớp này dù SDK đã bật
 * retryOptions.attempts: đo thực tế trên corpus 47 câu, hai lần dry-run liên
 * tiếp cho coverage 85.1% rồi 70.2% — chênh lệch toàn bộ là các câu rớt với
 * "fetch failed" (lỗi tầng mạng, SDK không xếp vào nhóm status retryable nên
 * không tự thử lại). Report là vật liệu engineer duyệt 100% (AC-008); một
 * report mà số dòng lỗi nhảy 1 → 8 giữa hai lần chạy giống hệt nhau thì không
 * duyệt được.
 */
const CLASSIFY_ATTEMPTS = 3;
/** Nghỉ giữa hai câu — giữ nhịp dưới rate limit của free tier. */
const THROTTLE_MS = 400;

async function classifyOnce(
  client: import("@google/genai").GoogleGenAI,
  model: string,
  q: CorpusQuestion,
): Promise<SkillClassification | null> {
  try {
    const response = await client.models.generateContent({
      model,
      contents: [{ text: buildClassifyPrompt(q) }],
      config: {
        // temperature 0: lời gọi phân loại phải bám sát tất định nhất có thể.
        // Nó KHÔNG phải là bảo đảm cho AC-006 (bảo đảm đó nằm ở nhánh
        // "already-tagged" của decideSkillTag), chỉ là giảm nhiễu.
        temperature: 0,
        maxOutputTokens: 2000,
        responseMimeType: "application/json",
        responseJsonSchema: CLASSIFY_SCHEMA as unknown as Record<string, unknown>,
      },
    });

    const text = response.text;
    if (!text) return null;

    const parsed = JSON.parse(text) as { skillNodeId?: unknown; confidence?: unknown };
    const skillNodeId =
      typeof parsed.skillNodeId === "string" && parsed.skillNodeId.length > 0
        ? parsed.skillNodeId
        : null;
    const confidence = typeof parsed.confidence === "number" ? parsed.confidence : null;

    return { skillNodeId, confidence };
  } catch (err) {
    // Một câu lỗi KHÔNG được làm sập cả batch — nó thành "left-null" với lý do
    // classification-error, cùng đường với câu dưới ngưỡng (backend DD On Error).
    console.warn(`  ⚠ lỗi phân loại câu ${q.id}: ${(err as Error).message ?? err}`);
    return null;
  }
}

async function classify(
  client: import("@google/genai").GoogleGenAI,
  model: string,
  q: CorpusQuestion,
): Promise<SkillClassification | null> {
  for (let attempt = 1; attempt <= CLASSIFY_ATTEMPTS; attempt++) {
    const result = await classifyOnce(client, model, q);
    if (result !== null) return result;
    if (attempt < CLASSIFY_ATTEMPTS) {
      const backoffMs = 1000 * 2 ** (attempt - 1);
      console.warn(`    ↻ thử lại câu ${q.id} sau ${backoffMs}ms (lần ${attempt + 1})`);
      await sleep(backoffMs);
    }
  }
  return null;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const geminiKey = env.GEMINI_API_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Thiếu NEXT_PUBLIC_SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY trong .env.local",
    );
  }
  if (!geminiKey) throw new Error("Thiếu GEMINI_API_KEY trong .env.local");

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  /** Ref của project đích, suy từ host — đi vào cả log lẫn tên file report. */
  const projectRef = new URL(url).host.split(".")[0];

  // Đọc thẳng skill_nodes từ DB chứ không dùng SKILL_NODES: khoá ngoại của
  // questions.skill_node_id trỏ vào DB, nên tập id hợp lệ phải lấy từ DB. Nếu
  // ai đó quên chạy seedSkillTaxonomy.ts thì phải fail ở đây, không phải fail
  // lúc UPDATE giữa batch.
  const nodesRes = await supabase.from("skill_nodes").select("id");
  if (nodesRes.error) throw nodesRes.error;
  const knownNodeIds = new Set((nodesRes.data ?? []).map((n) => n.id as string));
  if (knownNodeIds.size === 0) {
    throw new Error("skill_nodes rỗng — chạy `npx tsx supabase/seedSkillTaxonomy.ts` trước.");
  }
  const missing = SKILL_NODES.filter((n) => !knownNodeIds.has(n.id)).map((n) => n.id);
  if (missing.length > 0) {
    throw new Error(
      `DB thiếu node so với lib/adaptive/skillTaxonomy.ts: ${missing.join(", ")} — seed lại trước.`,
    );
  }

  const corpusRes = await supabase
    .from("questions")
    .select("id, content, subject, grade, topic, skill_node_id")
    .in("subject", ["Math", "Toán"])
    .order("id", { ascending: true });
  if (corpusRes.error) throw corpusRes.error;
  const corpus = (corpusRes.data ?? []) as CorpusQuestion[];

  console.log(
    `Chế độ: ${apply ? "--APPLY (ghi thật)" : "DRY-RUN (không ghi)"} · ` +
      `env ${ENV_FILE} → ${projectRef} · ` +
      `corpus ${corpus.length} câu · ngưỡng ${SKILL_TAG_CONFIDENCE_THRESHOLD} · ` +
      `${knownNodeIds.size} node`,
  );

  const { GoogleGenAI } = await import("@google/genai");
  const gemini = new GoogleGenAI({
    apiKey: geminiKey,
    httpOptions: { retryOptions: { attempts: 3 } },
  });
  // ANSWER_MODEL (gemini-3.1-flash-lite) — phân loại hàng loạt, cùng hạng
  // chi phí/độ khó với việc "đọc file đáp án" mà model này đã được ghim cho.
  const model = "gemini-3.1-flash-lite";

  const report: ReportEntry[] = [];

  for (const q of corpus) {
    // Câu đã có tag: KHÔNG gọi Gemini. Vừa tiết kiệm quota, vừa là chỗ bảo đảm
    // lần chạy --apply thứ hai không lật tag cũ sang node khác (AC-006).
    let classification: SkillClassification | null = null;
    if (q.skill_node_id === null) {
      classification = await classify(gemini, model, q);
      await sleep(THROTTLE_MS);
    }

    const d = decideSkillTag({
      existingSkillNodeId: q.skill_node_id,
      classification,
      knownNodeIds,
      threshold: SKILL_TAG_CONFIDENCE_THRESHOLD,
    });

    let wrote = false;
    if (apply && d.writeNeeded && d.skillNodeId !== null) {
      const upd = await supabase
        .from("questions")
        .update({ skill_node_id: d.skillNodeId })
        .eq("id", q.id)
        // Chỉ ghi khi cột vẫn đang NULL — nếu có tiến trình khác vừa gắn tag,
        // lần chạy này không đè lên.
        .is("skill_node_id", null);
      if (upd.error) throw upd.error;
      wrote = true;
    }

    report.push({
      questionId: q.id,
      subject: q.subject,
      grade: q.grade,
      contentPrefix: q.content.slice(0, 120),
      proposedSkillNodeId: d.skillNodeId,
      confidence: d.confidence,
      decision: d.decision,
      reason: d.reason,
      wrote,
    });

    const mark = d.decision === "tagged" ? "✓" : "·";
    console.log(
      `${mark} ${q.id} → ${d.skillNodeId ?? "NULL"} ` +
        `(${d.reason}${d.confidence === null ? "" : `, ${d.confidence.toFixed(2)}`})`,
    );
  }

  // Ref nằm trong TÊN file: hai môi trường sinh report cùng hình dạng, và
  // engineer duyệt 100% dòng "tagged" theo AC-008 dựa trên chính file này —
  // duyệt nhầm report của môi trường kia là lỗi không có gì bắt được.
  const reportPath = resolve(
    __dirname,
    `skill-tagging-report-${projectRef}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
  );
  writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf8");

  const tagged = report.filter((r) => r.decision === "tagged").length;
  const leftNull = report.filter((r) => r.decision === "left-null").length;
  const written = report.filter((r) => r.wrote).length;
  const coverage = corpus.length === 0 ? 0 : (tagged / corpus.length) * 100;

  console.log("");
  console.log(`Report: ${reportPath}`);
  console.log(
    `Tổng ${report.length} câu = ${tagged} tagged + ${leftNull} left-null ` +
      `(ghi lần này: ${written} dòng)`,
  );
  console.log(`Coverage: ${coverage.toFixed(1)}% (mốc dừng-xem-lại của PRD: 70%)`);

  // AC-007: mọi câu được xét phải có đúng một dòng trong report.
  if (report.length !== corpus.length) {
    throw new Error(
      `Report có ${report.length} dòng nhưng corpus có ${corpus.length} câu — có câu bị bỏ sót khỏi report.`,
    );
  }

  if (coverage < 70) {
    console.log(
      "⚠ Coverage dưới 70%: đây là tín hiệu DỪNG-XEM-LẠI, không tự động là lỗi " +
        "(có thể ngưỡng đang đúng mức thận trọng). Ghi lại quyết định trước khi đi tiếp.",
    );
  }

  console.log(
    apply
      ? "✅ Đã apply."
      : "✅ Dry-run xong. Đọc report, duyệt 100% các dòng 'tagged', rồi chạy lại với --apply.",
  );
}

main().catch((err) => {
  console.error("❌ Batch gắn thẻ thất bại:", err.message ?? err);
  process.exit(1);
});
