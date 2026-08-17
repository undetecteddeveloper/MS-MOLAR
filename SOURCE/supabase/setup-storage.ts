// Setup Storage (UGC v2.0, Task 1.1) — tạo 2 bucket exam-images & exam-uploads.
//
// Idempotent: bucket đã tồn tại → bỏ qua. Cả 2 bucket đều PRIVATE (public=false);
// quyền đọc/ghi do RLS policies trên storage.objects quyết định (schema.sql §8).
//
// Cách chạy:  cd SOURCE && npx tsx supabase/setup-storage.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
// Import tương đối chứ không qua alias "@/": script này chạy bằng `npx tsx`
// ngoài pipeline build của Next, nên đừng phụ thuộc vào việc alias được phân
// giải ở đó.
import { AVATAR_LIMITS } from "../lib/profile/limits";

function loadEnv(): Record<string, string> {
  const raw = readFileSync(resolve(__dirname, "../.env.local"), "utf8");
  const env: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const BUCKETS = ["exam-images", "exam-uploads", "support-screenshots", "avatars"] as const;

// support-screenshots: private, giới hạn kích thước/MIME ở tầng Storage (backstop) —
// xem node_modules/@supabase/storage-js/dist/index.d.mts:1809-1812 cho field names.
// ⚠ fileSizeLimit: CHUỖI kiểu "2MB" được Supabase hiểu theo hệ THẬP PHÂN —
// "2MB" = 2.000.000 byte, KHÔNG phải 2 × 1024 × 1024 = 2.097.152. Trần trong
// code (AVATAR_LIMITS.MAX_BYTES) là nhị phân. Để lệch thì có một khe 97KB mà
// file lọt qua kiểm tra ở Server Action rồi bị chính Storage từ chối — người
// dùng nhận "chưa lưu được ảnh, thử lại", một lời khuyên không bao giờ đúng.
// Nên ở đây truyền SỐ BYTE lấy thẳng từ hằng số, để "mirror" là mirror thật
// chứ không phải một comment nói rằng nó là mirror.
//
// (support-screenshots vẫn để "8MB" = 8.000.000 vs LIMITS.MAX_SCREENSHOT_BYTES
// = 8.388.608 — cùng loại lệch, nhưng nó nằm trên một đường upload ĐANG CHẠY và
// sửa ở đây là nới trần thật của tính năng khác. Ghi lại, không đụng.)
const BUCKET_OPTIONS: Partial<
  Record<(typeof BUCKETS)[number], { fileSizeLimit: string | number; allowedMimeTypes: string[] }>
> = {
  "support-screenshots": {
    fileSizeLimit: "8MB", // LIMITS.MAX_SCREENSHOT_BYTES mirror
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"], // LIMITS.ALLOWED_SCREENSHOT_MIME mirror
  },
  // avatars (ADR-0016): private như mọi bucket khác — ảnh của trẻ vị thành niên,
  // đọc bằng signed URL. Options CHỈ được áp lúc TẠO: script idempotent bằng cách
  // BỎ QUA bucket đã có (`:54-57`), không bao giờ reconcile lại — sai ở đây thì
  // phải sửa tay trên dashboard của cả 2 project (AC-035).
  avatars: {
    fileSizeLimit: AVATAR_LIMITS.MAX_BYTES, // byte chính xác — xem cảnh báo ở trên
    allowedMimeTypes: [...AVATAR_LIMITS.ALLOWED_MIME],
  },
};

async function main() {
  const env = loadEnv();
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !service)
    throw new Error("Thiếu URL / SERVICE_ROLE_KEY trong .env.local");

  const admin = createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const existing = await admin.storage.listBuckets();
  if (existing.error) throw existing.error;
  const names = new Set(existing.data.map((b) => b.name));

  for (const bucket of BUCKETS) {
    if (names.has(bucket)) {
      console.log(`✓ Bucket "${bucket}" đã tồn tại — bỏ qua.`);
      continue;
    }
    const { error } = await admin.storage.createBucket(bucket, {
      public: false,
      ...BUCKET_OPTIONS[bucket],
    });
    if (error) throw error;
    console.log(`✓ Đã tạo bucket "${bucket}" (private).`);
  }

  console.log("✅ Storage setup xong.");
}

main().catch((err) => {
  console.error("❌ Storage setup lỗi:", err.message ?? err);
  process.exit(1);
});
