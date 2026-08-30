// Hai thao tác đặc quyền của ADR-0018 — thao tác thứ 12 và 13 của
// `service-role.ts` (AC-045, ADR-0010 § trust boundary).
//
// THỨ FILE NÀY ĐI ĐO, và vì sao nó đáng một file riêng:
//
// PostgREST bind tham số THEO TÊN. Một khoá sai trong object đối số của
// `.rpc()` KHÔNG phải lỗi kiểu — TypeScript không biết gì về chữ ký SQL — mà là
// một thất bại RUNTIME thuộc họ `PGRST202`, và nó chỉ lộ ra khi có một database
// thật ở đầu kia. Đó chính là lý do chữ ký sáu tham số KHÔNG được gói vào một
// object: gói lại sẽ thêm một tầng ánh xạ mà không thao tác anh em nào trong
// file này có, ngay tại chỗ mà một lệch khoá im lặng là lỗi runtime.
//
// Nên các ca dưới đây khẳng định TỪNG KHOÁ, chép từ chữ ký trong `schema.sql`.
// Chúng không chứng minh SQL làm gì với các khoá đó — thứ ấy là của Task H8 với
// Postgres thật. Chúng chứng minh đúng một điều mà H8 không phân biệt được khi
// đỏ: lời gọi mang đúng hình dạng.
//
// BIÊN MOCK: `@supabase/supabase-js`, tức đúng chỗ `serviceRoleClient()` dựng
// client. Mock nông hơn thì cần database; mock sâu hơn thì kiểm dây nối.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("server-only", () => ({}));

const rpc = vi.fn();
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ rpc }),
}));

import { claimEssayGradingAttempt, recordEssayGrade } from "../service-role";

const ATTEMPT = "11111111-2222-3333-4444-555555555555";
const QUESTION = "q-essay-1";

beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  rpc.mockReset();
});

afterEach(() => {
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
});

describe("claimEssayGradingAttempt — hình dạng lời gọi", () => {
  it("gọi đúng tên hàm SQL với ĐÚNG HAI khoá `p_*`", async () => {
    rpc.mockResolvedValue({ data: [{ claimed: true, attempts: 1, reason: null }], error: null });

    await claimEssayGradingAttempt(ATTEMPT, QUESTION);

    expect(rpc).toHaveBeenCalledTimes(1);
    // Chép từ `schema.sql:1022-1025`. Đẳng thức VÉT CẠN trên object đối số:
    // một khoá THỪA cũng là một lệch hợp đồng, và `toMatchObject` sẽ bỏ qua nó.
    expect(rpc).toHaveBeenCalledWith("claim_essay_grading_attempt", {
      p_attempt_id: ATTEMPT,
      p_question_id: QUESTION,
    });
  });

  it("KHÔNG truyền `user_id` dưới bất kỳ tên nào — chủ nhân suy ra trong SQL", async () => {
    // AC-045. Hàm SQL suy chủ nhân từ attempt và đòi `status = 'submitted'`;
    // một tham số danh tính ở tầng TS là đúng thứ ADR-0010 cấm, vì nó cho phép
    // người gọi TỰ KHAI mình là ai.
    rpc.mockResolvedValue({ data: [{ claimed: true, attempts: 1, reason: null }], error: null });
    await claimEssayGradingAttempt(ATTEMPT, QUESTION);
    const args = rpc.mock.calls[0][1] as Record<string, unknown>;
    expect(Object.keys(args)).toEqual(["p_attempt_id", "p_question_id"]);
    expect(JSON.stringify(args)).not.toMatch(/user/i);
  });
});

describe("claimEssayGradingAttempt — giá trị trả về đi qua NGUYÊN VẸN", () => {
  it("`returns table` ⇒ PostgREST trả MẢNG; thao tác bóc dòng đầu", async () => {
    rpc.mockResolvedValue({ data: [{ claimed: true, attempts: 2, reason: null }], error: null });
    const r = await claimEssayGradingAttempt(ATTEMPT, QUESTION);
    expect(r).toEqual({ claimed: true, attempts: 2, reason: null, error: null });
  });

  it.each([
    ["not_submitted", 0],
    ["already_graded", 2],
    ["exhausted", 3],
  ] as const)("giữ nguyên lý do từ chối %o — ba nhánh, KHÔNG gộp", async (reason, attempts) => {
    // Ba lý do là ba NHÁNH khác nhau trong SQL. Gộp chúng thành một "từ chối"
    // chung ở tầng TS là vứt đi khả năng phân biệt mà UI cần: "hết lượt" và
    // "đã chấm rồi" dẫn tới hai màn hình khác nhau.
    rpc.mockResolvedValue({ data: [{ claimed: false, attempts, reason }], error: null });
    const r = await claimEssayGradingAttempt(ATTEMPT, QUESTION);
    expect(r).toEqual({ claimed: false, attempts, reason, error: null });
  });

  it("mảng RỖNG ⇒ không claim được, và KHÔNG ném", async () => {
    // Hàm SQL luôn `return query` một dòng, kể cả ở nhánh từ chối — nhưng nếu
    // schema chưa được apply thì `data` có thể rỗng. Lối này phải là một GIÁ
    // TRỊ, vì người gọi ở đường `after()` không có ai bắt hộ.
    rpc.mockResolvedValue({ data: [], error: null });
    const r = await claimEssayGradingAttempt(ATTEMPT, QUESTION);
    expect(r.claimed).toBe(false);
  });

  it("lỗi RPC được surface như GIÁ TRỊ, KHÔNG ném", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    const r = await claimEssayGradingAttempt(ATTEMPT, QUESTION);
    expect(r.claimed).toBe(false);
    expect(r.error).toEqual({ code: "PGRST202", message: "not found" });
  });
});

describe("recordEssayGrade — hình dạng lời gọi", () => {
  it("gọi đúng tên hàm SQL với ĐÚNG SÁU khoá `p_*`, đúng thứ tự chữ ký", async () => {
    rpc.mockResolvedValue({ data: true, error: null });

    await recordEssayGrade(ATTEMPT, QUESTION, "graded", 0.75, 1, false);

    // Chép từ `schema.sql:1119-1126`. Đây là ca mà cả task tồn tại vì nó: sáu
    // khoá, không gói object, và một chữ sai ở bất kỳ khoá nào là PGRST202 lúc
    // chạy chứ không phải một dòng đỏ ở `tsc`.
    expect(rpc).toHaveBeenCalledWith("record_essay_grade", {
      p_attempt_id: ATTEMPT,
      p_question_id: QUESTION,
      p_state: "graded",
      p_earned: 0.75,
      p_max: 1,
      p_low_confidence: false,
    });
  });

  it("`failed` đi kèm band NULL — không bao giờ band 0", async () => {
    // Một câu hỏng KHÔNG phải một câu được 0 điểm. Ghi 0 vào `earned` sẽ kéo
    // điểm thật của học sinh xuống vì một sự cố hạ tầng.
    rpc.mockResolvedValue({ data: true, error: null });
    await recordEssayGrade(ATTEMPT, QUESTION, "failed", null, null, false);
    expect(rpc).toHaveBeenCalledWith("record_essay_grade", {
      p_attempt_id: ATTEMPT,
      p_question_id: QUESTION,
      p_state: "failed",
      p_earned: null,
      p_max: null,
      p_low_confidence: false,
    });
  });
});

describe("recordEssayGrade — `false` là GIÁ TRỊ, không phải ngoại lệ (ADR-0018 D3)", () => {
  it("settle bị từ chối (ghi-lần-đầu-thắng) trả `false`, KHÔNG ném", async () => {
    // Đây là nghĩa vụ chứng minh sắc nhất của file. Một wrapper ném khi thấy
    // `false` biến một cuộc đua BÌNH THƯỜNG (AC-063) thành đường lỗi, và ở hạ
    // nguồn thành một thất bại mà học sinh nhìn thấy. Bản ghi trùng bị từ chối
    // là telemetry, không phải sự cố.
    rpc.mockResolvedValue({ data: false, error: null });
    const r = await recordEssayGrade(ATTEMPT, QUESTION, "graded", 1, 1, false);
    expect(r).toEqual({ written: false, error: null });
  });

  it("settle thành công trả `true`", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const r = await recordEssayGrade(ATTEMPT, QUESTION, "graded", 1, 1, false);
    expect(r).toEqual({ written: true, error: null });
  });

  it("lỗi RPC ⇒ `written: false` kèm error, vẫn KHÔNG ném", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "23514", message: "check_violation" },
    });
    const r = await recordEssayGrade(ATTEMPT, QUESTION, "graded", 1, 1, false);
    expect(r).toEqual({ written: false, error: { code: "23514", message: "check_violation" } });
  });
});

describe("ranh giới tin cậy của file (ADR-0010, TD-029)", () => {
  const SOURCE_ROOT = process.cwd();
  const source = readFileSync(path.join(SOURCE_ROOT, "lib/supabase/service-role.ts"), "utf8");

  function codeLines(src: string): string[] {
    return src.split("\n").filter((l) => {
      const t = l.trim();
      return !(t.startsWith("//") || t.startsWith("*") || t.startsWith("/*"));
    });
  }

  it("`serviceRoleClient()` vẫn PRIVATE", () => {
    // Toàn bộ ADR-0010 đứng trên một câu: ra ngoài chỉ có thao tác đã đặt tên,
    // không có client. Một `export` ở đây là mất cả ranh giới, không phải nới
    // lỏng nó.
    expect(source).toMatch(/^function serviceRoleClient\(\): SupabaseClient \{$/m);
    expect(source).not.toMatch(/export\s+(async\s+)?function serviceRoleClient/);
  });

  it("file vẫn mang `import \"server-only\"`", () => {
    expect(source).toMatch(/^import "server-only";$/m);
  });

  it("file có ĐÚNG 13 thao tác sau task này (TD-029 đếm bằng con số này)", () => {
    // Phép đếm VÉT CẠN, không phải `toBeGreaterThan`: TD-029 nói thao tác thứ
    // MƯỜI BỐN buộc phải xét lại ADR-0010, nên con số phải là một khẳng định
    // chính xác. Ca này là thứ đỏ vào đúng lúc ai đó thêm thao tác 14.
    const ops = codeLines(source).filter((l) => /^export (async )?function /.test(l));
    expect(ops).toHaveLength(13);
  });

  it("ghi chú TD-029 có mặt, và nêu tên CẢ HAI điều kiện xét lại", () => {
    // Ghi chú nằm ở file này chứ không ở một ADR vì đây là dòng mà người sắp
    // thêm thao tác 14 đang nhìn vào.
    expect(source).toMatch(/TD-029/);
    expect(source).toMatch(/14|mười bốn/i);
    expect(source).toMatch(/exam_results/);
  });

  it("hai thao tác mới KHÔNG tự cưỡng chế lại luật đã sống trong SQL", () => {
    // ADR-0010: cưỡng chế ở SQL, không ở call site. Một `if (attempts >= 3)`
    // hay một kiểm `status === 'submitted'` ở đây là bản sao thứ hai của một
    // luật, và bản sao sẽ trôi lệch.
    const block = source.slice(source.indexOf("export async function claimEssayGradingAttempt"));
    expect(block).not.toMatch(/ESSAY_MAX_ATTEMPTS|submitted|>= *3/);
  });
});
