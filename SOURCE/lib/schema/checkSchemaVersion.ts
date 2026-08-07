// Hỏi DB đang chạy: "bạn đang ở bản schema.sql nào?" (TECH-DEBT TD-005).
//
// Chạy một lần lúc server khởi động, cùng chỗ với check env của TD-009. Đây là
// nơi DUY NHẤT trong vòng đời ứng dụng biết được CẢ HAI vế: vân tay của file
// trong git (hằng số bundle theo code) và vân tay DB tự khai (§17). Test trong
// CI chỉ so được vế thứ nhất với chính nó; `verify:schema` so được cả hai nhưng
// phải NHỚ chạy — mà quên chính là hình dạng của TD-005.
//
// Vì sao check lúc khởi động chứ không mỗi request: một truy vấn thêm vào mọi
// request là đánh đổi tệ cho một cảnh báo vận hành, và dự án đã tối ưu
// round-trip khá kỹ (xem getResult). Khởi động thì chỉ tốn một lần cho mỗi
// instance, và log nằm ngay đầu Vercel Runtime Logs — đúng chỗ người deploy
// đang nhìn.
//
// CỐ Ý KHÔNG throw, cùng lý do với checkEnv (TD-009): một deploy chạy trên DB
// lệch bản vẫn phục vụ được gần hết trang; làm sập cả site vì nó là đổi một
// hỏng hóc cục bộ lấy một sự cố toàn site. Ở đây in ra thật to rồi chạy tiếp.
//
// Cũng CỐ Ý fail-open khi không đọc được (mất mạng, RPC lỗi, thiếu key): không
// biết ≠ lệch. Báo "không kiểm được" và nói rõ hệ quả, chứ không dựng báo động
// giả — báo động giả lặp lại vài lần là cổng bị mọi người bỏ qua.

import { SCHEMA_FINGERPRINT } from "./schemaFingerprint";

/** Kết quả so vân tay. `unknown` = không đọc được, KHÔNG phải "lệch". */
export type SchemaVersionStatus = "match" | "mismatch" | "unknown";

export interface SchemaVersionResult {
  status: SchemaVersionStatus;
  /** Vân tay code đang mong đợi. */
  expected: string;
  /** Vân tay DB tự khai; `null` khi chưa đọc được hoặc §17 chưa apply. */
  actual: string | null;
  /** Vì sao `unknown` — chỉ có khi status là `unknown`. */
  reason?: string;
}

/** Timeout của lượt hỏi DB. Đây là đường KHỞI ĐỘNG, không phải đường người
 *  dùng đang chờ, nhưng để treo vô hạn thì một DB đang chập sẽ kéo dài cold
 *  start của mọi instance. 3s đủ rộng cho một truy vấn một dòng. */
const TIMEOUT_MS = 3_000;

/**
 * Đọc vân tay DB khai ở `public.schema_version` và so với hằng số của code.
 *
 * Gọi thẳng PostgREST bằng `fetch` chứ không dựng `@supabase/supabase-js`: đây
 * là một truy vấn một dòng chạy lúc khởi động, không cần cả một client kèm
 * quản lý phiên đăng nhập, và tránh kéo thêm module vào đường khởi động.
 *
 * Dùng service-role key vì §17 bật RLS và KHÔNG có policy nào — sơ đồ hệ thống
 * không phải thứ trình duyệt cần đọc được.
 */
export async function checkSchemaVersion(
  env: Readonly<Record<string, string | undefined>>,
  fetchImpl: typeof fetch = fetch
): Promise<SchemaVersionResult> {
  const expected = SCHEMA_FINGERPRINT;
  const url = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  // Thiếu env thì checkEnv (TD-009) đã kêu rồi — đừng kêu lần thứ hai về cùng
  // một nguyên nhân, người đọc log sẽ tưởng là hai sự cố.
  if (!url || !key) {
    return { status: "unknown", expected, actual: null, reason: "thiếu env Supabase" };
  }

  try {
    const res = await fetchImpl(
      `${url}/rest/v1/schema_version?select=fingerprint&id=eq.1`,
      {
        headers: { apikey: key, Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: "no-store",
      }
    );

    if (!res.ok) {
      // 404 ở đây nghĩa là bảng chưa tồn tại — tức schema.sql §17 chưa hề chạy
      // trên DB này. Đó KHÔNG phải "không đọc được", đó là lệch bản rõ ràng:
      // DB đang ở một bản có trước 2026-08-07.
      if (res.status === 404) {
        return { status: "mismatch", expected, actual: null };
      }
      return {
        status: "unknown",
        expected,
        actual: null,
        reason: `PostgREST trả ${res.status}`,
      };
    }

    const rows = (await res.json()) as Array<{ fingerprint?: string }>;
    const actual = rows[0]?.fingerprint ?? null;

    // Bảng có mà không có dòng nào = paste schema.sql bị đứt trước câu lệnh
    // cuối. §17 đặt insert ở cuối file chính vì tình huống này.
    if (actual === null) return { status: "mismatch", expected, actual: null };

    return { status: actual === expected ? "match" : "mismatch", expected, actual };
  } catch (err) {
    return {
      status: "unknown",
      expected,
      actual: null,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Định dạng báo cáo cho log server. Rỗng = khớp, không cần nói gì. */
export function formatSchemaVersionReport(result: SchemaVersionResult): string {
  if (result.status === "match") return "";

  if (result.status === "unknown") {
    return [
      "",
      `! SCHEMA: không kiểm được phiên bản DB (${result.reason}).`,
      "  App vẫn chạy, nhưng lượt khởi động này KHÔNG xác nhận được DB khớp",
      "  schema.sql. Chạy `npm run verify:schema` nếu vừa deploy bản có đổi SQL.",
      "",
    ].join("\n");
  }

  const dbSays =
    result.actual === null
      ? "chưa có bảng public.schema_version (DB ở bản trước 2026-08-07)"
      : `đang ở bản ${result.actual}`;

  return [
    "",
    "═".repeat(78),
    "SCHEMA LỆCH: DB không chạy cùng bản với code đang deploy",
    `  code mong đợi : ${result.expected}`,
    `  DB tự khai    : ${dbSays}`,
    "",
    "  Hệ quả: một bản vá nằm trong git mà CHƯA chạy trên DB này. Kiểu lệch này",
    "  KHÔNG lộ ra ở tsc/vitest/build — nó chỉ lộ khi có người dùng thật đi vào",
    "  đúng đường bị thiếu (đã xảy ra: bản vá §10 và bug xoá đề 2026-08-04).",
    "",
    "  Sửa: paste toàn bộ SOURCE/supabase/schema.sql vào Supabase SQL Editor",
    "       của CHÍNH môi trường này, rồi `npm run verify:schema`.",
    "  Nền: TECH-DEBT.md TD-005.",
    "═".repeat(78),
    "",
  ].join("\n");
}
