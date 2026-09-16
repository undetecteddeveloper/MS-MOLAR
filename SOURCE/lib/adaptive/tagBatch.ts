// Phần THUẦN của batch tagger (supabase/tagQuestionSkills.ts) — dựng prompt
// theo lô, đọc phản hồi theo lô, đọc lại report đã duyệt, và so key Gemini.
//
// Tách khỏi script cùng lý do với tagDecision.ts: vitest.config.ts không thu
// supabase/**, nên logic để trong script là logic không được test. Không I/O,
// không đọc env, không gọi Gemini — mọi thứ được TIÊM vào.
//
// VÌ SAO THEO LÔ (2026-09-16): hạn ngạch free tier của Gemini là 20 request/
// NGÀY cho mỗi cặp (project, tên model) — xem lib/ai/models.ts và
// lib/security/rateLimit.ts. Bản trước gọi MỘT câu/request: 137 câu prod là
// 7 ngày. Gộp N câu vào một request thì cùng 20 request phủ 200 câu, và
// tính chất an toàn không đổi: mỗi câu vẫn đi qua decideSkillTag() riêng,
// ngưỡng tin cậy vẫn áp từng câu, câu không có mặt trong phản hồi vẫn là
// classification-error (không đoán).

import type { Subject } from "@/lib/analytics/constants";
import type { SkillClassification } from "./tagDecision";

export interface BatchQuestion {
  id: string;
  content: string;
  grade: number | null;
  questionType: string | null;
}

export interface CatalogueNode {
  id: string;
  labelVi: string;
}

/** Schema JSON Gemini phải trả cho một lô. `results` đúng một phần tử mỗi câu. */
export const CLASSIFY_BATCH_SCHEMA = {
  type: "object",
  properties: {
    results: {
      type: "array",
      items: {
        type: "object",
        properties: {
          questionId: { type: "string", description: "questionId của câu hỏi, giữ nguyên" },
          skillNodeId: {
            type: "string",
            description: "id của node kỹ năng phù hợp nhất, hoặc chuỗi rỗng nếu không xếp được",
          },
          confidence: { type: "number", description: "độ tin cậy 0..1" },
        },
        required: ["questionId", "skillNodeId", "confidence"],
      },
    },
  },
  required: ["results"],
} as const;

/**
 * Chỉ dẫn thêm theo môn — đúng những ranh giới mờ đã thấy khi rà corpus (ghi
 * ở mục "Điểm cần người duyệt để mắt" của từng draft) và ở lần chạy Toán
 * 2026-08-15 (câu lớp 11 bị xếp vào node lớp 12 ở confidence 0.85). Không phải
 * luật phân loại đầy đủ — chỉ là chỗ model hay lệch.
 */
export const SUBJECT_TAGGING_GUIDANCE: Partial<Record<Subject, readonly string[]>> = {
  Math: [
    "- Câu thuộc kiến thức lớp 11 (đạo hàm tại một điểm, giới hạn, cấp số, tổ hợp – xác suất lớp 11) hoặc THCS (lớp 6–9) KHÔNG có node — trả chuỗi rỗng.",
    "- Hàm số bậc nhất, tập xác định của hàm số nói chung không phải `ham-so-bac-hai` hay `menh-de-tap-hop` — trả chuỗi rỗng nếu không có node đúng.",
  ],
  Physics: [
    "- Khúc xạ, phản xạ toàn phần, lăng kính, thấu kính, mắt, kính lúp/hiển vi → `ly-quang-hinh`.",
    "- Từ trường, lực từ, lực Lorentz, từ thông, suất điện động cảm ứng, tự cảm, độ tự cảm → `ly-tu-truong-cam-ung`.",
  ],
  Chemistry: [
    "- Hạt cơ bản, cấu hình electron, đồng vị, kí hiệu nguyên tử → `hoa-cau-tao-nguyen-tu`; vị trí trong bảng tuần hoàn, xu hướng biến đổi tính chất, cấu hình electron hoá trị của một NHÓM → `hoa-bang-tuan-hoan`.",
    "- Quy tắc octet, công thức Lewis, độ âm điện, loại liên kết, năng lượng liên kết → `hoa-lien-ket-hoa-hoc`; số oxi hoá, chất khử/chất oxi hoá, cân bằng phản ứng bằng thăng bằng electron, bài toán kim loại + acid có sản phẩm khử → `hoa-phan-ung-oxi-hoa-khu`.",
  ],
  Biology: [
    "- Tính tần số alen/kiểu gen, cân bằng Hardy–Weinberg, tự thụ phấn/giao phối gần → `sinh-di-truyen-quan-the`.",
    "- Quan niệm Darwin/hiện đại, vai trò của chọn lọc tự nhiên, đột biến, phiêu bạt, dòng gene, nguyên liệu tiến hoá → `sinh-hoc-thuyet-nhan-to-tien-hoa`.",
    "- Cách li địa lí, cách li sinh sản (trước/sau hợp tử), hình thành loài (địa lí, sinh thái, lai xa – đa bội) → `sinh-loai-hinh-thanh-loai`.",
    "- Cơ quan tương đồng/tương tự/thoái hoá, bằng chứng phân tử, hoá thạch → `sinh-bang-chung-tien-hoa`.",
  ],
  Literature: [
    "- Câu hỏi về biện pháp tu từ, từ ngữ, ngữ pháp, lỗi câu — kể cả khi hỏi trên ngữ liệu đọc hiểu — → `van-tieng-viet` (kỹ năng chính là tiếng Việt).",
    "- Câu hỏi về nội dung, nhân vật trữ tình, hình ảnh, thông điệp, liên hệ bản thân trên ngữ liệu → node đọc hiểu theo THỂ LOẠI của ngữ liệu (thơ / truyện–kí–kịch / nghị luận–thông tin).",
    "- Yêu cầu viết đoạn/bài về một tác phẩm, đoạn trích, hình tượng → `van-nghi-luan-van-hoc`; về một tư tưởng, hiện tượng đời sống → `van-nghi-luan-xa-hoi`.",
  ],
  English: [
    "- Giới từ đi theo động từ/tính từ cố định, cụm động từ, collocation, nghĩa của từ, dạng từ → `anh-tu-vung`; thì, dạng động từ (gerund/infinitive), mệnh đề, câu hỏi đuôi, câu điều kiện, bị động → `anh-ngu-phap`.",
    "- Câu có nội dung rỗng hoặc chỉ là lời dẫn chung của một phần đề (không có câu hỏi cụ thể) → chuỗi rỗng.",
    "- Đề bài 'Listen to…' → `anh-nghe-hieu` dù không có audio.",
  ],
};

/**
 * Prompt cho MỘT lô. Danh mục chỉ gồm node của môn đang gắn thẻ — đưa cả 91
 * node 7 môn vào là mời model xếp câu Lý vào node Toán; tập id hợp lệ ở
 * decideSkillTag() cũng chỉ là tập của môn đó nên một id lạc môn sẽ thành
 * unknown-node, nhưng tốt hơn là đừng gợi ý nó ngay từ đầu.
 */
export function buildBatchPrompt(input: {
  subject: Subject;
  subjectLabel: string;
  catalogue: readonly CatalogueNode[];
  questions: readonly BatchQuestion[];
}): string {
  const { subject, subjectLabel, catalogue, questions } = input;
  const catalogueLines = catalogue.map((n) => `- ${n.id}: ${n.labelVi}`).join("\n");
  const guidance = SUBJECT_TAGGING_GUIDANCE[subject] ?? [];

  const questionBlocks = questions.map((q) =>
    [
      `### questionId=${q.id} (lớp: ${q.grade ?? "không rõ"}, dạng: ${q.questionType ?? "không rõ"})`,
      q.content.trim().length > 0 ? q.content : "(nội dung rỗng)",
    ].join("\n"),
  );

  return [
    `Bạn phân loại TỪNG câu hỏi ${subjectLabel} THPT Việt Nam dưới đây vào MỘT node kỹ năng (dạng bài) trong danh sách cố định.`,
    "",
    "Danh sách node (chỉ được trả về đúng một `id` trong danh sách này, không bịa id mới):",
    catalogueLines,
    "",
    "Quy tắc:",
    "- Chọn node mô tả kỹ năng CHÍNH mà câu hỏi kiểm tra, không phải mọi kỹ năng phụ liên quan.",
    "- `confidence` phản ánh mức chắc chắn thật: không chắc thì để thấp, đừng làm tròn lên.",
    "- Nếu câu hỏi không thuộc node nào trong danh sách (kiến thức ngoài chương trình THPT, nội dung rỗng hoặc không đọc được), trả `skillNodeId` là chuỗi rỗng và `confidence` 0.",
    "- Trả về ĐÚNG một phần tử cho MỖI câu hỏi, giữ nguyên `questionId`. Mỗi câu xét độc lập với các câu còn lại.",
    ...guidance,
    "",
    `Các câu hỏi (${questions.length} câu):`,
    "",
    questionBlocks.join("\n\n"),
  ].join("\n");
}

export interface BatchParseResult {
  /** questionId → phân loại; `null` = câu thiếu/hỏng trong phản hồi → classification-error. */
  byQuestionId: Map<string, SkillClassification | null>;
  /** Mô tả từng chỗ lệch, để đi vào log của script (không phải report). */
  warnings: string[];
}

/**
 * Đọc phản hồi JSON của một lô. Mọi đường lệch đều rơi về `null` cho câu đó
 * (classification-error) thay vì đoán: JSON hỏng → cả lô null; questionId lạ →
 * bỏ (kèm warning); trùng questionId → giữ phần tử đầu; thiếu câu → null.
 * `skillNodeId` rỗng → null (no-matching-node ở decideSkillTag); `confidence`
 * không phải số → null (classification-error ở decideSkillTag).
 */
export function parseBatchResponse(
  text: string | undefined,
  expectedIds: readonly string[],
): BatchParseResult {
  const byQuestionId = new Map<string, SkillClassification | null>(
    expectedIds.map((id) => [id, null]),
  );
  const warnings: string[] = [];

  if (!text) {
    warnings.push("phản hồi rỗng");
    return { byQuestionId, warnings };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    warnings.push("phản hồi không phải JSON hợp lệ");
    return { byQuestionId, warnings };
  }

  const results = (parsed as { results?: unknown })?.results;
  if (!Array.isArray(results)) {
    warnings.push("phản hồi thiếu mảng `results`");
    return { byQuestionId, warnings };
  }

  const expected = new Set(expectedIds);
  const seen = new Set<string>();

  for (const item of results as Array<Record<string, unknown>>) {
    const questionId = typeof item?.questionId === "string" ? item.questionId : null;
    if (questionId === null || !expected.has(questionId)) {
      warnings.push(`questionId lạ trong phản hồi: ${String(questionId)}`);
      continue;
    }
    if (seen.has(questionId)) {
      warnings.push(`questionId lặp trong phản hồi: ${questionId} (giữ phần tử đầu)`);
      continue;
    }
    seen.add(questionId);

    const skillNodeId =
      typeof item.skillNodeId === "string" && item.skillNodeId.length > 0
        ? item.skillNodeId
        : null;
    const confidence = typeof item.confidence === "number" ? item.confidence : null;
    byQuestionId.set(questionId, { skillNodeId, confidence });
  }

  for (const id of expectedIds) {
    if (!seen.has(id)) warnings.push(`câu ${id} không có trong phản hồi`);
  }

  return { byQuestionId, warnings };
}

/** Chia corpus thành các lô tối đa `size` câu, giữ thứ tự. */
export function chunkBatches<T>(items: readonly T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) throw new Error(`batch size không hợp lệ: ${size}`);
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// --- Report ------------------------------------------------------------------

export interface ReportEntry {
  questionId: string;
  subject: string | null;
  grade: number | null;
  contentPrefix: string;
  /** Node model đề xuất THÔ (kể cả khi bị từ chối) — để người duyệt thấy model nói gì. */
  modelSkillNodeId: string | null;
  /** Giá trị questions.skill_node_id SAU lần chạy (đầu ra decideSkillTag). */
  proposedSkillNodeId: string | null;
  confidence: number | null;
  decision: "tagged" | "left-null";
  reason: string;
  wrote: boolean;
}

export interface TaggingReport {
  meta: {
    projectRef: string;
    subject: Subject;
    envFile: string;
    model: string;
    threshold: number;
    batchSize: number;
    apply: boolean;
    fromReport: string | null;
    /** sha256 8 hex đầu của key Gemini đã dùng (null khi --from-report). */
    geminiKeyFingerprint: string | null;
    generatedAt: string;
    corpusCount: number;
  };
  entries: ReportEntry[];
}

/**
 * Đọc lại phân loại từ một report (bản mới `{meta, entries}` hoặc bản cũ là
 * mảng). Dùng cho `--apply --from-report`: thứ được ghi là ĐÚNG thứ người
 * duyệt đã đọc, không phải một lượt gọi Gemini mới (temperature 0 vẫn không
 * tất định tuyệt đối) — và tốn 0 request.
 *
 * - `classification-error` (và dòng không đọc được) → `null` (vẫn là lỗi, một
 *   lần chạy thường sau đó sẽ phân loại lại vì cột còn NULL).
 * - Mọi dòng khác → `{ skillNodeId: modelSkillNodeId ?? proposedSkillNodeId,
 *   confidence }` — decideSkillTag() áp lại ngưỡng/tập id trên DB HIỆN TẠI,
 *   nên một report cũ hơn DB (câu đã được tag bằng tay) không đè được gì.
 */
export function classificationsFromReport(
  report: unknown,
): Map<string, SkillClassification | null> {
  const entries: unknown = Array.isArray(report)
    ? report
    : (report as { entries?: unknown })?.entries;
  if (!Array.isArray(entries)) throw new Error("report không có mảng entries");

  const map = new Map<string, SkillClassification | null>();
  for (const raw of entries as Array<Record<string, unknown>>) {
    const questionId = typeof raw?.questionId === "string" ? raw.questionId : null;
    if (questionId === null) continue;

    if (raw.reason === "classification-error") {
      map.set(questionId, null);
      continue;
    }

    const model = typeof raw.modelSkillNodeId === "string" ? raw.modelSkillNodeId : null;
    const proposed =
      typeof raw.proposedSkillNodeId === "string" ? raw.proposedSkillNodeId : null;
    const confidence = typeof raw.confidence === "number" ? raw.confidence : null;
    map.set(questionId, { skillNodeId: model ?? proposed, confidence });
  }
  return map;
}

// --- Key riêng ---------------------------------------------------------------

/**
 * Tìm file env của APP có cùng key Gemini với key sắp dùng để gắn thẻ. Key
 * app nằm ở free tier 20 request/ngày cho CẢ project và đã bị vét sạch một
 * lần bởi chính việc gọi AI hàng loạt (TD-019) — gắn thẻ bằng key đó là lấy
 * suất của học sinh đang dùng gia sư. Trả tên file trùng (để lỗi nói rõ trùng
 * với cái gì), hoặc null nếu key thật sự riêng.
 */
export function findSharedKeyMatch(
  taggingKey: string,
  appKeys: ReadonlyArray<{ file: string; key: string | undefined }>,
): string | null {
  const normalized = taggingKey.trim();
  if (normalized.length === 0) return null;
  for (const { file, key } of appKeys) {
    if (key !== undefined && key.trim() === normalized) return file;
  }
  return null;
}
