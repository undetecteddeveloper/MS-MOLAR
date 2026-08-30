// rateLimit — unit tests (Security review 2026-08-03, Low).
// Dùng đồng hồ giả để kiểm hành vi cửa sổ trượt mà không phải chờ thật.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

// KHÔNG-OP HÔM NAY, và đó chính là lý do nó được ghi ra đây. Kể từ khi hai
// action của đường thanh toán vào bảng dưới, đồ thị module mà file này kéo theo
// chạm tới biên máy chủ — `guard()` là thứ chạy bên trong Server Action. Nếu
// `rateLimit.ts` hay bất kỳ thứ gì nó import thêm `import "server-only"`, module
// đó NÉM ngay khi được nạp ngoài bundle server của Next, và file này sẽ đỏ vì
// MÔI TRƯỜNG chứ không vì một khiếm khuyết. Stub là lưới đỡ đúng một dòng, cùng
// dạng hơn hai chục file test khác trong repo đang dùng.
vi.mock("server-only", () => ({}));

import { __resetRateLimitForTests, checkRateLimit, guard, RATE_LIMITS } from "./rateLimit";
// Bảng giá mỗi thao tác sống cạnh điểm phát Gemini — file này TIÊU THỤ nó, và
// cố ý không giữ một bản sao (backend DD `:1080`, AC-020).
import { GEMINI_CALLS_PER_OPERATION } from "@/lib/ugc/gemini";
// Cung ky luat: so nhan cua Groq doc TU CHINH diem phat, khong go lai o day.
import { GROQ_CALLS_PER_ESSAY } from "@/lib/essay/groqClient";

beforeEach(() => {
  __resetRateLimitForTests();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("checkRateLimit", () => {
  it("allows calls up to the limit, then blocks", () => {
    for (let i = 0; i < 3; i += 1) {
      expect(checkRateLimit("k", 3, 1000).ok).toBe(true);
    }
    expect(checkRateLimit("k", 3, 1000).ok).toBe(false);
  });

  it("keys are independent — one user's spam does not block another", () => {
    for (let i = 0; i < 3; i += 1) checkRateLimit("user-a", 3, 1000);
    expect(checkRateLimit("user-a", 3, 1000).ok).toBe(false);
    expect(checkRateLimit("user-b", 3, 1000).ok).toBe(true);
  });

  it("frees up as the window slides, not all at once at a fixed boundary", () => {
    checkRateLimit("k", 2, 1000); // t=0
    vi.advanceTimersByTime(600);
    checkRateLimit("k", 2, 1000); // t=600
    expect(checkRateLimit("k", 2, 1000).ok).toBe(false);

    // t=1001: only the t=0 call has left the window → exactly one slot back.
    vi.advanceTimersByTime(401);
    expect(checkRateLimit("k", 2, 1000).ok).toBe(true);
    expect(checkRateLimit("k", 2, 1000).ok).toBe(false);
  });

  it("reports a retryAfter that actually corresponds to a free slot", () => {
    checkRateLimit("k", 1, 10_000);
    const blocked = checkRateLimit("k", 1, 10_000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    vi.advanceTimersByTime(blocked.retryAfterSeconds * 1000);
    expect(checkRateLimit("k", 1, 10_000).ok).toBe(true);
  });

  // Nếu lần gọi bị CHẶN cũng được ghi nhận, kẻ spam sẽ tự đẩy thời gian chờ dài
  // vô hạn — và người dùng thật bấm nhầm 2 lần cũng bị phạt theo.
  it("does not count blocked calls, so hammering cannot extend the penalty", () => {
    checkRateLimit("k", 1, 10_000);
    const first = checkRateLimit("k", 1, 10_000);
    vi.advanceTimersByTime(1000);
    for (let i = 0; i < 50; i += 1) checkRateLimit("k", 1, 10_000);
    const afterSpam = checkRateLimit("k", 1, 10_000);
    expect(afterSpam.retryAfterSeconds).toBeLessThanOrEqual(first.retryAfterSeconds);
  });
});

describe("guard", () => {
  // Không cấu hình KV_REST_API_* trong test → `guard` dừng ở lớp RAM. Đó đúng
  // là nhánh cần ghim ở đây: hành vi khi Redis vắng mặt phải y hệt trước
  // 2026-08-07, vì đó là lưới đỡ khi Upstash chết (xem rateLimitStore.ts).
  it("uses per-action buckets, so hitting one action does not block another", async () => {
    for (let i = 0; i < RATE_LIMITS.reportExam.limit; i += 1) {
      expect((await guard("reportExam", "u1")).ok).toBe(true);
    }
    expect((await guard("reportExam", "u1")).ok).toBe(false);
    expect((await guard("submitExam", "u1")).ok).toBe(true);
  });

  // BA NHÓM TRẦN, vì có ba thứ KHÁC NHAU đang chặn chúng — không thể kiểm
  // bằng một bất biến chung:
  //   - Nhóm tốn DB của CHÍNH ta: thứ giới hạn chúng là chi phí của ta, mà ta
  //     tự nới được. Nên trần đặt rộng rãi và bất biến cần ghim là "đủ rộng để
  //     không làm phiền người dùng thật" — guard chống vòng lặp tự động thôi.
  //   - Nhóm tiêu hạn ngạch BÊN THỨ BA: thứ giới hạn chúng là hạn ngạch của nhà
  //     cung cấp, ta KHÔNG nới được. Trần vì thế phải chặt, và bất biến cần ghim
  //     ngược lại: nằm dưới trần nhà cung cấp, và cửa sổ trùng ĐƠN VỊ của hạn
  //     ngạch đó. Ghim cả windowMs vì hạ `limit` mà giữ cửa sổ theo giờ thì trần
  //     ngày không còn được đặt (xem lý lẽ đầy đủ ở RATE_LIMITS.explainStep).
  //   - Nhóm chặn LẠM DỤNG (2026-08-17, /profile): thứ giới hạn chúng không phải
  //     chi phí của ai cả — changePassword gần như miễn phí — mà là việc gọi dồn
  //     TỰ NÓ đã là tấn công. Bất biến vì thế NGƯỢC HẲN nhóm đầu: trần phải CHẶT,
  //     và "chặt" ở đây có nghĩa chính xác là chặt hơn mọi trần của nhóm tốn-DB.
  // Hai danh sách dưới đây liệt kê tường minh, không suy ra từ nhau: thêm action
  // mới vào RATE_LIMITS mà quên xếp nhóm sẽ làm case "phân loại" đỏ, thay vì
  // lọt qua cả hai nhánh mà không ai quyết định nó thuộc nhóm nào.
  const DB_COST_ACTIONS: readonly (keyof typeof RATE_LIMITS)[] = [
    "submitExam",
    "rateExam",
    "reportExam",
    "updateProfile",
    "submitTicket",
    // AC-037, backend DD § Rate-limit entries: cả hai chỉ tốn chi phí của CHÍNH
    // ta (một lượt ghi Postgres / một lượt hỏi payOS), không tiêu vào hạn ngạch
    // bên thứ ba và không nhận vào credential — nên chúng thuộc nhóm này, và do
    // đó chịu cả hai bất biến `limit >= 15` và `windowMs >= 60_000` bên dưới.
    "createOrder",
    "recheckOrder",
  ];
  // `uploadExam` thuộc nhóm này chứ KHÔNG phải nhóm tốn-DB, dù nó cũng ghi DB và
  // cũng nhận file: thứ giới hạn nó là hạn ngạch Gemini, y như explainStep, và
  // hai cái ăn CHUNG một hạn ngạch (TD-019). Xếp nhầm nó sang nhóm tốn-DB sẽ đòi
  // `limit >= 15` — tức là hợp thức hoá đúng cái lỗ vừa vá.
  // `as const satisfies` chứ không phải chú thích kiểu rộng: giữ được kiểu literal
  // của từng phần tử (để bảng GEMINI_REQUESTS_PER_CALL bên dưới ép đúng HAI khoá
  // này), đồng thời vẫn bắt lỗi ngay nếu ai gõ sai tên một action.
  const SUPPLIER_CAPPED_ACTIONS = [
    "explainStep",
    "uploadExam",
  ] as const satisfies readonly (keyof typeof RATE_LIMITS)[];
  // Hai action của /profile. `changePassword` NHẬN VÀO một credential (phải kiểm
  // mật khẩu hiện tại), nên mỗi lần gọi trả lời "chuỗi này có đúng không" — trần
  // ở đây đo TỐC ĐỘ DÒ chứ không đo chi phí. `uploadAvatar` cùng nhóm vì lý do
  // gần: nó ghi object vào Storage của ta, nhưng 10/giờ được chọn theo mức lạm
  // dụng chấp nhận được chứ không theo "rộng rãi để không phiền người dùng" —
  // xếp nó vào nhóm tốn-DB sẽ đòi limit >= 15, tức nới trần để chiều một bất biến
  // vốn không nói về nó.
  const ABUSE_CAPPED_ACTIONS: readonly (keyof typeof RATE_LIMITS)[] = [
    "changePassword",
    "uploadAvatar",
  ];
  // NHOM THU TU (2026-08-30, ADR-0018). Cung ho "tieu han ngach ben thu ba" voi
  // SUPPLIER_CAPPED_ACTIONS, nhung o mot NHA CUNG CAP KHAC — Groq, khong phai
  // Gemini — nen no khong nhap duoc vao danh sach ay: hai bat bien cua nhom do
  // do bang han ngach ngay cua Gemini (20) va bang GEMINI_REQUESTS_PER_CALL.
  // Nhet mot action tieu Groq vao do se do mot con so Groq bang mot tran
  // Gemini, tuc lam CA HAI bat bien cung noi doi, va no se "xanh" trong khi
  // khong ai con dang do dieu gi that.
  const GROQ_CAPPED_ACTIONS = [
    "retryEssayGrading",
  ] as const satisfies readonly (keyof typeof RATE_LIMITS)[];

  /** Trần free tier của Gemini: 20 request/NGÀY cho CẢ project (rateLimit.ts). */
  const SUPPLIER_DAILY_QUOTA = 20;
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  it("classifies every configured action into exactly one category", () => {
    // Xếp trùng hai nhóm cũng đỏ ở đây: mảng gộp sẽ dài hơn danh sách khoá.
    const classified = [
      ...DB_COST_ACTIONS,
      ...SUPPLIER_CAPPED_ACTIONS,
      ...ABUSE_CAPPED_ACTIONS,
      ...GROQ_CAPPED_ACTIONS,
    ].sort();
    expect(classified).toEqual(Object.keys(RATE_LIMITS).sort());
  });

  it("keeps every DB-cost limit generous enough not to hit a real user", () => {
    for (const action of DB_COST_ACTIONS) {
      expect(RATE_LIMITS[action].limit).toBeGreaterThanOrEqual(15);
      expect(RATE_LIMITS[action].windowMs).toBeGreaterThanOrEqual(60_000);
    }
  });

  it("keeps every abuse-capped limit tighter than every cost-capped one", () => {
    for (const abuseAction of ABUSE_CAPPED_ACTIONS) {
      for (const dbAction of DB_COST_ACTIONS) {
        expect(RATE_LIMITS[abuseAction].limit).toBeLessThan(RATE_LIMITS[dbAction].limit);
      }
    }
  });

  it("keeps abuse-capped windows hourly — the constrained resource is our own endpoint", () => {
    // KHÔNG phải cửa sổ ngày như nhóm nhà cung cấp: ở đây không có hạn ngạch nào
    // tính theo ngày để khớp đơn vị, và kéo cửa sổ dài ra chỉ khoá người dùng
    // thật ra ngoài lâu hơn (xem RATE_LIMITS.changePassword).
    for (const action of ABUSE_CAPPED_ACTIONS) {
      expect(RATE_LIMITS[action].windowMs).toBe(60 * 60 * 1000);
    }
  });

  it("keeps the credential-accepting ceiling low enough to be useless as a guessing loop", () => {
    // 5/giờ: rộng rãi cho người gõ nhầm, vô dụng cho một vòng lặp dò mật khẩu.
    expect(RATE_LIMITS.changePassword.limit).toBeLessThanOrEqual(5);
  });

  it("keeps every supplier-capped limit under the supplier quota, on its day unit", () => {
    for (const action of SUPPLIER_CAPPED_ACTIONS) {
      expect(RATE_LIMITS[action].windowMs).toBe(ONE_DAY_MS);
      expect(RATE_LIMITS[action].limit).toBeLessThanOrEqual(SUPPLIER_DAILY_QUOTA);
    }
  });

  // Bất biến THẬT của TD-019, và là cái mà hai case trên KHÔNG bắt được: kiểm
  // từng trần một thì 3 và 5 đều "dưới 20", trong khi cộng lại thì một tài khoản
  // vẫn vét được sạch hạn ngạch của cả project. Trần phải đọc theo SỐ REQUEST
  // GEMINI, không phải số lần bấm nút — explainStep 1 request/lần, uploadExam
  // 2–3 (extractQuestions + extractAnswers + extractMeta ở chế độ Automatic).
  //
  // Số nhân KHÔNG còn được gõ lại ở đây: nó ĐỌC từ GEMINI_CALLS_PER_OPERATION,
  // khai cạnh chính điểm phát Gemini (lib/ugc/gemini.ts, backend DD I10). Trước
  // đây hai con số này là một LỜI KHAI THỨ HAI của cùng một sự thật — thêm một
  // lời gọi AI thứ tư vào pipeline mà quên sửa ở đây thì trần vẫn "xanh" trong
  // khi một tài khoản đã vét sạch hạn ngạch project, và không có gì đỏ.
  //
  // `uploadExam` lấy nhánh `uploadAutomatic` (3) chứ không phải `uploadTyped`
  // (2): case dưới đây tính TRƯỜNG HỢP XẤU NHẤT của một tài khoản, và người
  // dùng chọn được chế độ Automatic cho cả 5 lượt/ngày.
  const GEMINI_REQUESTS_PER_CALL: Record<(typeof SUPPLIER_CAPPED_ACTIONS)[number], number> = {
    explainStep: GEMINI_CALLS_PER_OPERATION.tutor,
    uploadExam: GEMINI_CALLS_PER_OPERATION.uploadAutomatic,
  };

  // Tran ngan sach Groq cua DU AN den tu bien moi truong
  // (GROQ_BUDGET_DAILY_LIMIT), nen KHONG co hang bien dich nao de so sanh nhu
  // SUPPLIER_DAILY_QUOTA cua Gemini. Thu ghim duoc, va dang ghim, la HINH DANG:
  // cua so trung DON VI cua bo dem, va worst case cua MOT tai khoan bi chan tren
  // — doc qua GROQ_CALLS_PER_ESSAY chu khong go lai so 3, dung bai hoc TD-019.
  const GROQ_REQUESTS_PER_ACCOUNT_PER_DAY = 30;

  it("keeps the Groq-capped window on the counter's day unit", () => {
    // `groq:budget:{day}` tinh theo NGAY. Ha cua so xuong theo gio se bo han
    // tran ngay ma no ton tai de dat — cung lap luan comment explainStep viet.
    for (const action of GROQ_CAPPED_ACTIONS) {
      expect(RATE_LIMITS[action].windowMs).toBe(ONE_DAY_MS);
    }
  });

  it("keeps ONE account's worst-case daily Groq requests bounded", () => {
    // Doc theo SO REQUEST GROQ, khong theo so lan bam nut — dung bai hoc TD-019:
    // kiem "10 lan bam" khong noi len dieu gi khi moi lan bam tieu 3 request.
    const worstCase = GROQ_CAPPED_ACTIONS.reduce(
      (sum, action) => sum + RATE_LIMITS[action].limit * GROQ_CALLS_PER_ESSAY,
      0,
    );
    expect(worstCase).toBeLessThanOrEqual(GROQ_REQUESTS_PER_ACCOUNT_PER_DAY);
  });

  it("keeps ONE account's whole daily Gemini budget under the project quota", () => {
    const worstCasePerUser = SUPPLIER_CAPPED_ACTIONS.reduce(
      (sum, action) => sum + RATE_LIMITS[action].limit * GEMINI_REQUESTS_PER_CALL[action],
      0
    );
    expect(worstCasePerUser).toBeLessThanOrEqual(SUPPLIER_DAILY_QUOTA);
  });

  // B-01 (backend DD § Recorded Decision B-01): trần gia sư ĐI THEO cờ phát hành
  // trả phí, và nhánh BẬT chỉ đọc được sau MỘT LẦN NẠP LẠI module — `RATE_LIMITS`
  // được tính một lần lúc nạp, nên bảng đã import ở đầu file này vĩnh viễn là
  // nhánh cờ TẮT. Bỏ `vi.resetModules()` thì case vẫn chạy nhưng đọc lại đúng
  // bảng cũ, tức là vẫn xanh cả khi trần bị đóng cứng thành 3.
  //
  // Giá trị stub là " TRUE " chứ không phải "1", và đó là phần thứ hai của case:
  // chỉ `isPaidTierEnabled()` mới coi chuỗi đó là BẬT (có trim, không phân biệt
  // hoa thường). Một lần đọc thẳng `process.env.GEMINI_PAID_TIER_ENABLED === "1"`
  // viết lại trong rateLimit.ts sẽ đọc ra 3 ở đây — tức bản sao thứ hai của tập
  // giá trị "được coi là BẬT" bị bắt bằng HÀNH VI, không bằng lời hứa.
  //
  // KHÔNG áp bất biến SUPPLIER_DAILY_QUOTA (20) cho biến thể này, và đó là một
  // quyết định chứ không phải sơ suất: 20 là sự thật của bậc MIỄN PHÍ. Cờ chỉ
  // được bật SAU khi dự án đã bật thanh toán Google (AC-048); từ lúc đó thứ chặn
  // một tài khoản không còn là hạn ngạch 20/ngày của cả project mà là hạn ngạch
  // theo gói của chính người đó (lib/billing/quota.ts) và hoá đơn ta phải trả.
  it("follows the paid-tier release flag: the tutor ceiling rises with it, the window does not", async () => {
    vi.stubEnv("GEMINI_PAID_TIER_ENABLED", " TRUE ");
    vi.resetModules();
    try {
      const { RATE_LIMITS: PAID_TIER_LIMITS } = await import("./rateLimit");

      expect(PAID_TIER_LIMITS.explainStep.limit).toBeGreaterThanOrEqual(50);
      expect(PAID_TIER_LIMITS.explainStep.windowMs).toBe(24 * 60 * 60 * 1000);
      // HAI GIÁ TRỊ KHÁC NHAU trên cùng một khoá là thứ duy nhất phân biệt được
      // một điều kiện thật với một hằng số: bảng nạp lúc cờ TẮT vẫn phải đọc ra 3.
      expect(RATE_LIMITS.explainStep.limit).toBe(3);

      // Tripwire ĐỌC VĂN BẢN NGUỒN, nên TRUNG TÍNH VỀ HÀNH VI: một bản sao TRUNG
      // THỰC của tập AFFIRMATIVE chép vào rateLimit.ts sẽ chạy y hệt và không
      // case hành vi nào thấy được nó — chỉ nguồn mới thấy. (Bản sao KHÔNG trung
      // thực thì " TRUE " ở trên đã bắt.) Bỏ dòng chú thích trước khi quét, theo
      // đúng lối `codeLines` của lib/billing/__tests__/quota.test.ts: chính
      // comment của rateLimit.ts có nhắc tên biến môi trường đó.
      const rateLimitSource = readFileSync(
        path.join(process.cwd(), "lib/security/rateLimit.ts"),
        "utf8"
      );
      const codeOnly = rateLimitSource
        .split("\n")
        .filter((line) => !line.trim().startsWith("//"))
        .join("\n");
      expect(codeOnly).not.toContain("process.env");
    } finally {
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
