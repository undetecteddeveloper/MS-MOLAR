// AI usage tracker — ghi lại token/request đã gọi Gemini (dev-only trừ khi bật
// UGC_QUOTA_LOG=1, xem scripts/dev-status.mjs). Gemini API KHÔNG expose "hạn
// mức còn lại"/thời gian reset qua API — chỉ có thể tự đếm số lượng đã gọi. Ghi
// ra file tmp vì dev-status.mjs chạy ở tiến trình Node RIÊNG (spawn next dev
// làm con), không share bộ nhớ với tiến trình server Next — file là kênh duy
// nhất để đọc chéo.
//
// ⚠ GIỚI HẠN PHẢI BIẾT TRƯỚC KHI DỰA VÀO FILE NÀY ĐỂ TÍNH TIỀN (Subscription
// PRD U2): đích ghi là file tạm của TIẾN TRÌNH. Trên Vercel serverless mỗi
// instance có tmpdir riêng và bị huỷ khi instance chết, nên bật UGC_QUOTA_LOG=1
// trên production KHÔNG cho một tổng cộng dồn đáng tin — nó chỉ cho số của một
// instance, trong vòng đời của instance đó. Muốn đo thật trên production thì
// phải đổi đích ghi sang DB; đó là quyết định có DDL nên thuộc Design Doc
// (schema mới = apply tay trên 2 database, TD-005), không phải sửa ở đây.
import "server-only";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ENABLED =
  process.env.NODE_ENV !== "production" || process.env.UGC_QUOTA_LOG === "1";

export const QUOTA_FILE_PATH = path.join(tmpdir(), "ms-molar-ugc-quota.json");

// Giữ dư 25h (quota ngày reset theo giờ Pacific, dư 1h so với UTC day để
// khỏi cắt nhầm record còn cần cho "hôm nay" ở múi giờ Pacific).
const RETENTION_MS = 25 * 60 * 60 * 1000;

// "tutor" là đường gia sư Engine 1 (lib/tutor/callTutor.ts) — KHÔNG phải UGC,
// nhưng dùng chung key Gemini và chung trần request/ngày, nên phải đếm chung
// một chỗ. Subscription PRD U2 đòi đơn giá của CẢ HAI đường; tách file thì có
// hai nguồn sự thật cho cùng một hạn ngạch.
export type QuotaRole = "questions" | "answers" | "metadata" | "tutor";

/** Hình dạng `usageMetadata` của @google/genai mà tracker này cần. */
export interface UsageMetadataLike {
  promptTokenCount?: number | null;
  candidatesTokenCount?: number | null;
  thoughtsTokenCount?: number | null;
  totalTokenCount?: number | null;
}

export interface UsageRecord {
  ts: number;
  role: QuotaRole;
  model: string;
  /** Giữ nguyên tên cũ — scripts/dev-status.mjs đọc trường này. */
  totalTokens: number;
  /** `promptTokenCount`. Tính tiền theo ĐƠN GIÁ INPUT. */
  inputTokens: number;
  /**
   * `candidatesTokenCount` + `thoughtsTokenCount`. Tính tiền theo ĐƠN GIÁ
   * OUTPUT — token suy luận (thinking) tính giá output, nên gộp vào đây chứ
   * không bỏ: bỏ nó là báo thiếu tiền ở đúng phần đắt nhất.
   */
  outputTokens: number;
}

let records: UsageRecord[] = [];
let loaded = false;

function load(): void {
  if (loaded) return;
  loaded = true;
  try {
    if (existsSync(QUOTA_FILE_PATH)) {
      records = JSON.parse(readFileSync(QUOTA_FILE_PATH, "utf8"));
    }
  } catch {
    records = [];
  }
}

const num = (v: number | null | undefined): number =>
  typeof v === "number" && Number.isFinite(v) ? v : 0;

/**
 * Ghi lại 1 lượt gọi Gemini. Best-effort — lỗi ghi file không chặn pipeline.
 *
 * Tách input/output vì đơn giá hai bên chênh ~8 lần ($0,30 vs $2,50 / 1M);
 * chỉ có `totalTokenCount` thì KHÔNG quy ra tiền được, mà quy ra tiền chính là
 * việc Subscription PRD U2 cần làm trước khi chốt hạn mức.
 */
export function recordUsage(
  role: QuotaRole,
  model: string,
  usage: UsageMetadataLike | null | undefined,
): void {
  if (!ENABLED) return;
  load();
  const inputTokens = num(usage?.promptTokenCount);
  const outputTokens = num(usage?.candidatesTokenCount) + num(usage?.thoughtsTokenCount);
  records.push({
    ts: Date.now(),
    role,
    model,
    // Ưu tiên số của nhà cung cấp; nếu thiếu thì tự cộng lại để dòng ghi không
    // rỗng (ca này có thật: một số lối thất bại trả usageMetadata khuyết).
    totalTokens: num(usage?.totalTokenCount) || inputTokens + outputTokens,
    inputTokens,
    outputTokens,
  });
  const cutoff = Date.now() - RETENTION_MS;
  records = records.filter((r) => r.ts >= cutoff);
  try {
    writeFileSync(QUOTA_FILE_PATH, JSON.stringify(records));
  } catch {
    // best-effort, xem comment trên
  }
}
