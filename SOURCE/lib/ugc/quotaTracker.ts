// UGC AI usage tracker — ghi lại token/request đã gọi Gemini (dev-only, xem
// scripts/dev-status.mjs). Gemini API KHÔNG expose "hạn mức còn lại"/thời gian
// reset qua API — chỉ có thể tự đếm số lượng đã gọi. Ghi ra file tmp vì
// dev-status.mjs chạy ở tiến trình Node RIÊNG (spawn next dev làm con), không
// share bộ nhớ với tiến trình server Next — file là kênh duy nhất để đọc chéo.
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

export type QuotaRole = "questions" | "answers" | "metadata";

export interface UsageRecord {
  ts: number;
  role: QuotaRole;
  model: string;
  totalTokens: number;
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

/** Ghi lại 1 lượt gọi Gemini. Best-effort — lỗi ghi file không chặn pipeline. */
export function recordUsage(
  role: QuotaRole,
  model: string,
  usage: { totalTokenCount?: number | null } | null | undefined,
): void {
  if (!ENABLED) return;
  load();
  records.push({ ts: Date.now(), role, model, totalTokens: usage?.totalTokenCount ?? 0 });
  const cutoff = Date.now() - RETENTION_MS;
  records = records.filter((r) => r.ts >= cutoff);
  try {
    writeFileSync(QUOTA_FILE_PATH, JSON.stringify(records));
  } catch {
    // best-effort, xem comment trên
  }
}
