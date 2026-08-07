// Check phiên bản schema lúc khởi động (TECH-DEBT TD-005).
//
// Điều quan trọng nhất được kiểm ở đây KHÔNG phải "hàm có so chuỗi đúng không"
// mà là RANH GIỚI giữa `mismatch` và `unknown`. Gộp hai cái làm một là cách
// nhanh nhất để giết cổng này: nếu mất mạng cũng dựng khối báo động "SCHEMA
// LỆCH" thì vài lần báo giả là mọi người ngừng đọc, và lần lệch thật đi lọt.

import { describe, expect, it, vi } from "vitest";
import { checkSchemaVersion, formatSchemaVersionReport } from "../checkSchemaVersion";
import { SCHEMA_FINGERPRINT } from "../schemaFingerprint";

const ENV = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
};

/** `fetch` giả trả về một response PostgREST dựng sẵn. */
function fetchReturning(status: number, body: unknown): typeof fetch {
  return vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    })
  ) as unknown as typeof fetch;
}

describe("checkSchemaVersion", () => {
  it("match khi DB khai đúng vân tay của code", async () => {
    const res = await checkSchemaVersion(
      ENV,
      fetchReturning(200, [{ fingerprint: SCHEMA_FINGERPRINT }])
    );
    expect(res).toEqual({ status: "match", expected: SCHEMA_FINGERPRINT, actual: SCHEMA_FINGERPRINT });
  });

  it("mismatch khi DB khai vân tay khác", async () => {
    const res = await checkSchemaVersion(ENV, fetchReturning(200, [{ fingerprint: "000000000000" }]));
    expect(res.status).toBe("mismatch");
    expect(res.actual).toBe("000000000000");
  });

  it("mismatch (KHÔNG phải unknown) khi bảng chưa tồn tại — DB ở bản trước §17", async () => {
    // 404 của PostgREST ở đây có nghĩa rất cụ thể: schema.sql §17 chưa hề chạy
    // trên DB này. Đó là bằng chứng lệch bản, không phải thiếu thông tin.
    const res = await checkSchemaVersion(ENV, fetchReturning(404, { message: "not found" }));
    expect(res.status).toBe("mismatch");
    expect(res.actual).toBeNull();
  });

  it("mismatch khi bảng có nhưng rỗng — paste schema.sql đứt trước câu cuối", async () => {
    const res = await checkSchemaVersion(ENV, fetchReturning(200, []));
    expect(res.status).toBe("mismatch");
    expect(res.actual).toBeNull();
  });

  it("unknown khi thiếu env — checkEnv (TD-009) đã báo nguyên nhân đó rồi", async () => {
    const res = await checkSchemaVersion({}, fetchReturning(200, []));
    expect(res.status).toBe("unknown");
    expect(res.reason).toContain("env");
  });

  it("unknown khi mạng hỏng — không biết KHÁC với lệch", async () => {
    const failing = vi.fn(async () => {
      throw new Error("fetch failed");
    }) as unknown as typeof fetch;
    const res = await checkSchemaVersion(ENV, failing);
    expect(res.status).toBe("unknown");
    expect(res.reason).toBe("fetch failed");
  });

  it("unknown khi PostgREST trả 5xx", async () => {
    const res = await checkSchemaVersion(ENV, fetchReturning(503, {}));
    expect(res.status).toBe("unknown");
    expect(res.reason).toContain("503");
  });

  it("không bao giờ ném — mọi nhánh trả về kết quả", async () => {
    const exploding = vi.fn(() => {
      throw new Error("nổ ngay lúc gọi");
    }) as unknown as typeof fetch;
    await expect(checkSchemaVersion(ENV, exploding)).resolves.toMatchObject({ status: "unknown" });
  });
});

describe("formatSchemaVersionReport", () => {
  it("im lặng khi khớp", () => {
    expect(
      formatSchemaVersionReport({ status: "match", expected: "aaa", actual: "aaa" })
    ).toBe("");
  });

  it("khối lệch nói ra CẢ HAI vân tay và cách sửa", () => {
    const out = formatSchemaVersionReport({ status: "mismatch", expected: "aaa", actual: "bbb" });
    expect(out).toContain("aaa");
    expect(out).toContain("bbb");
    expect(out).toContain("schema.sql");
    expect(out).toContain("TD-005");
  });

  it("khối lệch nói rõ khi DB chưa có bảng, thay vì in `null`", () => {
    const out = formatSchemaVersionReport({ status: "mismatch", expected: "aaa", actual: null });
    expect(out).toContain("chưa có bảng");
    expect(out).not.toContain("null");
  });

  it("khối unknown KHÔNG đọc như báo động lệch bản", () => {
    const out = formatSchemaVersionReport({
      status: "unknown",
      expected: "aaa",
      actual: null,
      reason: "fetch failed",
    });
    expect(out).toContain("không kiểm được");
    expect(out).not.toContain("SCHEMA LỆCH");
  });
});
