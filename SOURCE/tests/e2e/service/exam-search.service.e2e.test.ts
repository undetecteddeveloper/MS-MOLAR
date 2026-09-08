// Tìm đề theo tên (ADR-0020) — làn SERVICE (Postgres dev THẬT, không mock).
//
// Vì sao ở làn này chứ không ở vitest mặc định: những điều dưới đây là TÍNH
// CHẤT CỦA POSTGRES THẬT mà một client giả không chứng minh được —
//   (a) `search_normalize` SQL và `normalizeSearch` JS cho CÙNG kết quả trên
//       cùng một chuỗi tiếng Việt (nếu lệch, bộ lọc `?q=` của Kho đề gửi một
//       chuỗi mà cột `title_search` không bao giờ chứa — tìm không ra dù đề có
//       thật, và không có gì kêu);
//   (b) `search_exams` khớp không dấu / không phân biệt hoa thường / chịu lỗi
//       gõ (`<%`, pg_trgm) và CHỈ trả đề published;
//   (c) quyền EXECUTE: học sinh (JWT thật) gọi được, anon bị 42501.
//
// TIỀN ĐIỀU KIỆN (TD-005): migration 20260908000000_exam_title_search_* đã áp
// lên dev. Đỏ với PGRST202 / 42703 = DATABASE chưa áp, SỬA DATABASE, đừng sửa
// test. Chạy: `npm run test:localdb` (từ SOURCE/).

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { normalizeSearch } from "@/lib/search/normalize";
import {
  HAS_LIVE_DB,
  seededTitles,
  serviceClient,
  setUp,
  tearDown,
  anonClient,
  type SearchFixture,
} from "./examSearchFixtures";

const SLOT = "search1";

describe.skipIf(!HAS_LIVE_DB)("search_exams / search_normalize — Postgres dev thật (ADR-0020)", () => {
  const admin = serviceClient();
  let fx: SearchFixture | undefined;

  beforeAll(async () => {
    fx = await setUp(admin, SLOT);
  }, 60_000);

  afterAll(async () => {
    await tearDown(admin, fx, SLOT);
  }, 60_000);

  it("(a) search_normalize (SQL) và normalizeSearch (JS) cho cùng kết quả trên chuỗi tiếng Việt", async () => {
    const samples = [
      seededTitles(SLOT).toan,
      seededTitles(SLOT).hoa,
      "ĐỀ KIỂM TRA HỌC KỲ I — Vật Lý 10 (ấ ầ ẩ ẫ ậ ế ề ể ễ ệ ố ồ ổ ỗ ộ ớ ờ ở ỡ ợ ứ ừ ử ữ ự đ Đ)",
      "  100% _toán_ \\ (a,b)  ",
    ];
    for (const sample of samples) {
      const { data, error } = await admin.rpc("search_normalize", { input: sample });
      expect(error).toBeNull();
      expect(data).toBe(normalizeSearch(sample));
    }
  });

  it("(b) học sinh tìm không dấu, hoa thường lẫn lộn, lỗi gõ — chỉ ra đề published", async () => {
    const student = fx!.studentClient;
    const { toan, hoa } = fx!.publishedIds;

    // Không dấu, thường hoá — tiền tố cách ly nằm trong tiêu đề nên từ khoá
    // mang nó để nhắm đúng đề gieo, không phụ thuộc dữ liệu có sẵn trên dev.
    const plain = await student.rpc("search_exams", { q: `${SLOT} de luyen toan`, max_results: 6 });
    expect(plain.error).toBeNull();
    expect(plain.data.map((r: { id: string }) => r.id)).toContain(toan);
    // Dòng đầu là đề khớp chuỗi con — cột trả đủ bốn trường cho ô gợi ý.
    expect(plain.data[0]).toMatchObject({ id: toan, subject: "Math", grade: 10 });
    expect(typeof plain.data[0].title).toBe("string");

    // CÓ dấu và HOA cũng ra cùng đề.
    const accented = await student.rpc("search_exams", { q: `${SLOT} ĐỀ LUYỆN TOÁN`, max_results: 6 });
    expect(accented.data.map((r: { id: string }) => r.id)).toContain(toan);

    // Lỗi gõ một ký tự: "nguyen han giua ki" thay vì "nguyên hàm giữa kì" —
    // `word_similarity` so từ khoá với một ĐOẠN LIỀN của tiêu đề, nên từ khoá
    // thử phải là một cụm liền (tiền tố cách ly đứng xa cụm này thì không được
    // đưa vào — đó là hành vi đúng của thuật toán, không phải lỗi).
    const typo = await student.rpc("search_exams", { q: "nguyen han giua ki", max_results: 20 });
    expect(typo.data.map((r: { id: string }) => r.id)).toContain(toan);

    // Dấu hai chấm, chữ hoa trong tiêu đề Hóa không cản trở.
    const chem = await student.rpc("search_exams", { q: `${SLOT} hoa hoc 11`, max_results: 6 });
    expect(chem.data.map((r: { id: string }) => r.id)).toContain(hoa);

    // Đề NHÁP cùng chữ "Toán" KHÔNG bao giờ lộ qua gợi ý.
    const all = await student.rpc("search_exams", { q: `${SLOT}`, max_results: 20 });
    expect(all.data.map((r: { id: string }) => r.id)).not.toContain(fx!.draftId);

    // Từ khoá quá ngắn → rỗng, không lỗi.
    const short = await student.rpc("search_exams", { q: "a", max_results: 6 });
    expect(short.error).toBeNull();
    expect(short.data).toEqual([]);
  });

  it("(c) anon bị từ chối EXECUTE (42501); Kho đề lọc ?q= qua view thấy cột title_search", async () => {
    const anon = await anonClient().rpc("search_exams", { q: `${SLOT} de luyen toan`, max_results: 6 });
    expect(anon.error?.code).toBe("42501");

    // Cùng vị từ mà fetchExamRows phát ra, chạy bằng JWT học sinh qua view:
    // cột `title_search` phải có mặt trên VIEW (view đã dựng lại), và RLS vẫn
    // chỉ cho thấy đề published. Từ khoá là CHUỖI CON liền của tiêu đề đã chuẩn
    // hoá ("… search1 de luyen toan 10 …"), đúng như ILIKE đòi.
    const rows = await fx!.studentClient
      .from("exams_with_difficulty")
      .select("id, title_search")
      .eq("status", "published")
      .ilike("title_search", `%${normalizeSearch(`${SLOT} de luyen toan`)}%`);
    expect(rows.error).toBeNull();
    expect(rows.data?.map((r) => r.id)).toContain(fx!.publishedIds.toan);
    expect(rows.data?.map((r) => r.id)).not.toContain(fx!.draftId);
  });
});
