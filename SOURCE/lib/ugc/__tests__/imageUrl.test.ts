// resolveSignedImageUrls — ký cả lô (A3, 2026-09-03).
//
// Ghim ba tính chất mà chỗ gọi dựa vào:
//   1. MỘT lượt gọi Storage cho cả danh sách, không phải N — đây là toàn bộ lý
//      do hàm này tồn tại; một lần refactor làm nó gọi lại từng cái sẽ xanh mọi
//      test khác mà mất sạch cái đã mua.
//   2. FAIL CLOSED theo từng mục: mục hỏng là undefined, mục khác vẫn có URL
//      (Storage trả `error` THEO TỪNG MỤC — đo trên dev 2026-09-03: path không
//      tồn tại trả "Either the object does not exist or you do not have access
//      to it" cho đúng mục đó, mục hợp lệ bên cạnh vẫn ký được).
//   3. Cả lô hỏng (error toàn cục hoặc ném) → mọi mục undefined, KHÔNG ném —
//      một ảnh vỡ không được làm hỏng cả trang (ADR-0016).
//
// Không có ngăn xếp mạng thật ở đây: client giả chỉ ghi lại tham số và trả về
// hình dạng response của storage-js (`{ data: [{ path, signedUrl, error }] }`).

import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { imagePathFromUrl, resolveSignedImageUrls } from "../imageUrl";

const ORIGIN = "https://example.supabase.co/storage/v1/object/public/exam-images/";
const url = (path: string) => ORIGIN + path;

type Item = { path: string | null; signedUrl: string | null; error: string | null };

function fakeSupabase(impl: (paths: string[]) => Promise<unknown>) {
  const createSignedUrls = vi.fn(impl);
  const supabase = {
    storage: { from: () => ({ createSignedUrls }) },
  } as unknown as SupabaseClient;
  return { supabase, createSignedUrls };
}

const signOk = (paths: string[]): Item[] =>
  paths.map((path) => ({ path, signedUrl: `signed:${path}`, error: null }));

describe("resolveSignedImageUrls", () => {
  it("ký MỘT lượt cho cả danh sách, mỗi path đúng một lần, tra được theo URL đã lưu", async () => {
    const { supabase, createSignedUrls } = fakeSupabase(async (paths) => ({
      data: signOk(paths),
      error: null,
    }));
    const a = url("exam-1/q1.png");
    const b = url("exam-1/q2.png");
    // Cùng object nhưng URL lưu khác nhau (token cũ khác nhau) → chỉ ký 1 path.
    const bAgain = url("exam-1/q2.png?token=old");

    const signed = await resolveSignedImageUrls(supabase, [a, b, null, undefined, bAgain, a]);

    expect(createSignedUrls).toHaveBeenCalledTimes(1);
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["exam-1/q1.png", "exam-1/q2.png"]);
    expect(signed.get(a)).toBe("signed:exam-1/q1.png");
    expect(signed.get(b)).toBe("signed:exam-1/q2.png");
    expect(signed.get(bAgain)).toBe("signed:exam-1/q2.png");
  });

  it("mục ký hỏng là undefined, mục khác vẫn có URL (fail closed theo từng mục)", async () => {
    const { supabase } = fakeSupabase(async (paths) => ({
      data: paths.map((path): Item =>
        path.endsWith("missing.png")
          ? { path, signedUrl: null, error: "Either the object does not exist or you do not have access to it" }
          : { path, signedUrl: `signed:${path}`, error: null }
      ),
      error: null,
    }));
    const ok = url("exam-1/q1.png");
    const missing = url("exam-1/missing.png");

    const signed = await resolveSignedImageUrls(supabase, [ok, missing]);

    expect(signed.get(ok)).toBe("signed:exam-1/q1.png");
    expect(signed.get(missing)).toBeUndefined();
    expect(signed.has(missing)).toBe(true);
  });

  it("cả lô hỏng (error toàn cục) → mọi mục undefined, không ném", async () => {
    const { supabase } = fakeSupabase(async () => ({
      data: null,
      error: { message: "boom", name: "StorageError" },
    }));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = url("exam-1/q1.png");

    await expect(resolveSignedImageUrls(supabase, [a])).resolves.toEqual(
      new Map([[a, undefined]])
    );
    warn.mockRestore();
  });

  it("Storage ném → mọi mục undefined, không ném tiếp", async () => {
    const { supabase } = fakeSupabase(async () => {
      throw new Error("fetch failed");
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const a = url("exam-1/q1.png");

    await expect(resolveSignedImageUrls(supabase, [a])).resolves.toEqual(
      new Map([[a, undefined]])
    );
    warn.mockRestore();
  });

  it("không có URL nào bóc được path → KHÔNG gọi Storage", async () => {
    const { supabase, createSignedUrls } = fakeSupabase(async (paths) => ({
      data: signOk(paths),
      error: null,
    }));
    const junk = "https://example.supabase.co/storage/v1/object/public/other-bucket/x.png";
    expect(imagePathFromUrl(junk)).toBeNull();

    const signed = await resolveSignedImageUrls(supabase, [null, undefined, "", junk]);

    expect(createSignedUrls).not.toHaveBeenCalled();
    expect(signed.size).toBe(0);
  });
});
