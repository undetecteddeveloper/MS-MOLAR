// Điểm phát Gemini DUY NHẤT + bảng giá mỗi thao tác (backend DD I10, AC-020/
// AC-021 — plan Task 5.2).
//
// Cái khó của bài test này: wrapper `generateContent()` KHÔNG thêm gì cả —
// không bắt lỗi, không retry, không phân loại. Nhìn từ ngoài nó gần như vô
// hình, nên MỘT ASSERTION TRÊN GIÁ TRỊ TRẢ VỀ KHÔNG PHÂN BIỆT ĐƯỢC GÌ: một
// caller gọi thẳng `client.models.generateContent()` trả về đúng y hệt. Vì thế
// mọi ca ở đây ĐẾM LỜI GỌI TẠI BIÊN và so DANH TÍNH của object đi qua, chứ
// không đọc trạng thái trả về:
//
//   1. Biên SDK (`@google/genai`) bị mock, ĐÚNG chỗ mà extractors.test.ts:13-16
//      và callTutor.test.ts:21-25 đã mock — nên bốn file test cũ vẫn xanh dù
//      bốn call site đổi đường đi.
//   2. Chính WRAPPER bị theo dõi bằng một `vi.fn()` UỶ QUYỀN cho bản thật
//      (`vi.fn(actual.generateContent)`), nên logic chạy là logic thật. Đây là
//      thứ duy nhất phân biệt "đi qua chokepoint" với "gọi thẳng SDK": gọi
//      thẳng thì wrapper đếm 0 còn SDK đếm 1.
//   3. Phép QUÉT MÃ NGUỒN bắt cái mà (1) và (2) không bao giờ bắt được — một
//      call site TƯƠNG LAI ở một file chưa tồn tại. Hai danh sách dưới đây phủ
//      kín mọi file mã NGOÀI TEST dưới `SOURCE/**`: bề mặt request-reachable
//      phải ĐÚNG BẰNG một module, và danh sách ngoại lệ script offline cũng
//      phải ĐÚNG BẰNG một file.

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

// gemini.ts `import "server-only"` — module đó ném khi nạp ngoài bundle server
// của Next. Stub theo lối hơn hai chục file test khác trong repo.
vi.mock("server-only", () => ({}));

const { generateContentMock, wrapperSpy } = vi.hoisted(() => ({
  generateContentMock: vi.fn(),
  wrapperSpy: vi.fn(),
}));

vi.mock("@google/genai", () => ({
  GoogleGenAI: class GoogleGenAIMock {
    models = { generateContent: generateContentMock };
  },
}));

// Wrapper thật vẫn chạy — `wrapperSpy` chỉ UỶ QUYỀN. Mọi thứ khác của module
// (getGeminiClient, makeDeadlineSignal, hằng số…) giữ nguyên bản thật.
vi.mock("@/lib/ugc/gemini", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../gemini")>();
  wrapperSpy.mockImplementation(actual.generateContent);
  return { ...actual, generateContent: wrapperSpy };
});

process.env.GEMINI_API_KEY = "test-key-not-real";

import { GEMINI_CALLS_PER_OPERATION, generateContent } from "../gemini";
import { extractQuestions } from "../extractQuestions";
import { extractAnswers } from "../extractAnswers";
import { extractMeta } from "../extractMeta";
import { generateHint } from "@/lib/tutor/callTutor";
import type { FileRef } from "../fileRef";
import type { TutorPromptInput } from "@/lib/tutor/prompt";

const PNG_FILE: FileRef = {
  bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
  mediaType: "image/png",
};

const TUTOR_INPUT: TutorPromptInput = {
  questionContent: "Đạo hàm của $f(x)=x^2$ tại $x=3$ bằng bao nhiêu?",
  questionType: "mcq",
  choices: [
    { id: "A", text: "3" },
    { id: "B", text: "6" },
    { id: "C", text: "9" },
    { id: "D", text: "2x" },
  ],
  studentAnswer: "C",
};

function stopMessage(payload: unknown) {
  return { candidates: [{ finishReason: "STOP" }], text: JSON.stringify(payload) };
}

beforeEach(() => {
  generateContentMock.mockReset();
  // `mockClear`, KHÔNG `mockReset`: reset sẽ xoá luôn phần uỷ quyền cho wrapper
  // thật và biến mọi ca dưới đây thành một bài test về `undefined`.
  wrapperSpy.mockClear();
});

// ═══════════════════════ 1. Bảng giá mỗi thao tác (AC-020) ═══════════════════

describe("GEMINI_CALLS_PER_OPERATION — bảng giá sống cạnh điểm phát", () => {
  it("khai đúng ba thao tác với số request GÕ TAY, không thừa không thiếu khoá", () => {
    // Ba con số này là KỲ VỌNG GÕ TAY, không bao giờ đọc ngược từ chính hằng số
    // đang được kiểm. `toEqual` trên cả object (chứ không kiểm từng khoá) nên
    // một khoá thứ tư lén vào cũng đỏ — bảng giá là bảng ĐẦY ĐỦ, không phải một
    // tập con tiện tay.
    expect(GEMINI_CALLS_PER_OPERATION).toEqual({
      tutor: 1,
      uploadTyped: 2,
      uploadAutomatic: 3,
    });
  });
});

// ═══════════════ 2. Quét mã nguồn — nghĩa vụ chứng minh của AC-021 ═══════════
//
// Ca duy nhất bắt được một call site TƯƠNG LAI. Bốn ca "đi qua wrapper" bên
// dưới chỉ phủ bốn chỗ tồn tại HÔM NAY.

const SOURCE_ROOT = process.cwd();

/** Bỏ dòng chú thích để phép quét đếm chỗ GỌI, không đếm chỗ NHẮC TỚI — cùng
 *  hàm mà quota.test.ts và readEntitlement.test.ts đã dùng cho phép quét khoá. */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
  });
}

/** Mọi đuôi mà một module CHẠY ĐƯỢC dưới SOURCE/ có thể mang. Quét riêng
 *  `.ts`/`.tsx` để hở đúng một lối: tsconfig bật `allowJs`, nên một route
 *  `.js`/`.mjs` cũng là mã request-reachable hợp lệ và sẽ tàng hình trước cả
 *  hai danh sách dưới đây. */
const SOURCE_FILE = /\.(?:[cm]?tsx?|[cm]?jsx?)$/;

/** Test KHÔNG nằm trên đường đi của request: chúng dựng mock quanh biên SDK,
 *  nên một lời gọi thẳng ở đó là hợp lệ chứ không phải đường vòng. */
const TEST_FILE = /\.test\.[cm]?[jt]sx?$/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".next")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SOURCE_FILE.test(entry) && !TEST_FILE.test(entry)) out.push(full);
  }
  return out;
}

/** Bề mặt phát của SDK, bắt theo `.models.generateContent(` chứ không theo tên
 *  biến nhận: `client.models…`, `ai.models…` và `getGeminiClient().models…`
 *  đều là CÙNG một lời gọi mạng, nên đổi tên biến không được phép làm nó tàng
 *  hình trước phép quét này. */
const EMIT_PATTERN = /\.models\.generateContent\s*\(/;

/** Thư mục chạy TAY bằng `npx tsx`, không nằm trên đường đi của bất kỳ request
 *  nào. Chúng KHÔNG import được lib/ugc/gemini.ts: module đó `import
 *  "server-only"` và gói đó ném dưới tsx (lý do ghi ở lib/ai/models.ts:3-8). */
const OFFLINE_SCRIPT_DIRS = ["supabase", "scripts"];

function emitSites(): { reachable: string[]; offlineScripts: string[] } {
  const reachable: string[] = [];
  const offlineScripts: string[] = [];
  for (const full of walk(SOURCE_ROOT)) {
    if (!codeLines(readFileSync(full, "utf8")).some((l) => EMIT_PATTERN.test(l))) continue;
    const rel = path.relative(SOURCE_ROOT, full).split(path.sep).join("/");
    if (OFFLINE_SCRIPT_DIRS.includes(rel.split("/")[0])) offlineScripts.push(rel);
    else reachable.push(rel);
  }
  return { reachable: reachable.sort(), offlineScripts: offlineScripts.sort() };
}

describe("một điểm phát Gemini duy nhất (AC-021)", () => {
  it("toàn bộ mã request-reachable dưới SOURCE/ phát Gemini từ ĐÚNG MỘT module", () => {
    // Đẳng thức VÉT CẠN, không phải `toContain` hay `length === 1`: một file
    // BẤT KỲ khác mọc thêm lời gọi này phải làm dòng này đỏ, kể cả khi
    // lib/ugc/gemini.ts vẫn nằm trong danh sách.
    expect(emitSites().reachable).toEqual(["lib/ugc/gemini.ts"]);
  });

  it("danh sách ngoại lệ script offline cũng ĐÓNG — đúng một file, có tên", () => {
    // Ngoại lệ được GHIM chứ không được miễn trừ: hợp của hai ca này phủ kín
    // mọi file mã ngoài test dưới SOURCE/**, nên một script MỚI tự dựng client
    // Gemini vẫn đỏ ở đây thay vì lọt qua kẽ hở "à, thư mục script thì bỏ qua".
    expect(emitSites().offlineScripts).toEqual(["supabase/tagQuestionSkills.ts"]);
  });
});

// ═════════════════ 3. Hành vi wrapper — KHÔNG thêm gì hết ════════════════════

describe("generateContent() — ống dẫn trong suốt, không bọc thêm gì", () => {
  it("chuyển CHÍNH object request xuống SDK, đúng một lần", async () => {
    const response = { candidates: [{ finishReason: "STOP" }], text: "ok" };
    generateContentMock.mockResolvedValue(response);
    const request = { model: "gemini-3.5-flash", contents: [{ text: "xin chào" }] };

    await generateContent(request);

    expect(generateContentMock).toHaveBeenCalledTimes(1);
    // `toBe`, không `toEqual`: một wrapper "chuẩn hoá" request bằng cách sao
    // chép object vẫn qua được `toEqual`, và bản sao đó là chỗ một field lặng
    // lẽ rơi mất (abortSignal, responseJsonSchema) trong lần sửa sau.
    expect(generateContentMock.mock.calls[0][0]).toBe(request);
  });

  it("trả về CHÍNH response của SDK, không đọc, không nắn", async () => {
    const response = { candidates: [{ finishReason: "STOP" }], text: "ok" };
    generateContentMock.mockResolvedValue(response);

    const returned = await generateContent({ model: "gemini-3.5-flash", contents: [] });

    expect(returned).toBe(response);
  });

  it("để lỗi đi thẳng lên: cùng instance, và KHÔNG thử lại lần nào", async () => {
    // Đây là hai wrapper sai mà ca này loại: (a) wrapper bắt lỗi rồi map thành
    // Result/UgcError — quyền sở hữu hình dạng lỗi phải ở lại bốn caller;
    // (b) wrapper tự retry — retry là việc của SDK (RETRY_ATTEMPTS = 3), thêm
    // một tầng nữa ở đây nhân ba chi phí thật mà bộ đếm ngân sách không thấy.
    const failure = new Error("503 overloaded");
    generateContentMock.mockRejectedValue(failure);

    const thrown = await generateContent({ model: "gemini-3.5-flash", contents: [] }).catch(
      (e: unknown) => e
    );

    expect(thrown).toBe(failure);
    expect(generateContentMock).toHaveBeenCalledTimes(1);
  });

  it("không giữ trạng thái giữa hai lượt — mỗi request xuống SDK y như nó tới", async () => {
    generateContentMock.mockResolvedValue({ candidates: [{ finishReason: "STOP" }], text: "ok" });
    // HAI GIÁ TRỊ KHÁC NHAU cho cùng một field: nếu wrapper ghim/nhớ request
    // đầu (một singleton "config" đặt nhầm chỗ) thì lượt hai vẫn xanh với hai
    // giá trị giống nhau, và chỉ hai giá trị khác nhau mới tố cáo nó.
    const first = { model: "gemini-3.5-flash", contents: [{ text: "một" }] };
    const second = { model: "gemini-3.1-flash-lite", contents: [{ text: "hai" }] };

    await generateContent(first);
    await generateContent(second);

    expect(generateContentMock).toHaveBeenCalledTimes(2);
    expect(generateContentMock.mock.calls[0][0]).toBe(first);
    expect(generateContentMock.mock.calls[1][0]).toBe(second);
  });
});

// ══════════ 4. Bốn call site ĐI QUA wrapper, không gọi thẳng SDK ═════════════
//
// `wrapperSpy` đếm 0 mà `generateContentMock` đếm 1 = caller gọi thẳng SDK.
// Đó chính xác là hình dạng hỏng mà bốn ca này tồn tại để bắt.

/** Một call site đã đi qua chokepoint: wrapper đúng 1 lượt, SDK đúng 1 lượt, và
 *  object SDK nhận CHÍNH LÀ object wrapper nhận. */
function expectRoutedThroughChokepoint(expectedModel: string) {
  expect(wrapperSpy).toHaveBeenCalledTimes(1);
  expect(generateContentMock).toHaveBeenCalledTimes(1);
  expect(generateContentMock.mock.calls[0][0]).toBe(wrapperSpy.mock.calls[0][0]);
  expect(generateContentMock.mock.calls[0][0].model).toBe(expectedModel);
}

describe("bốn call site đi qua chokepoint", () => {
  it("extractQuestions phát qua wrapper, không gọi thẳng SDK", async () => {
    generateContentMock.mockResolvedValue(stopMessage({ parts: [], questions: [] }));

    await extractQuestions(PNG_FILE);

    expectRoutedThroughChokepoint("gemini-3.6-flash");
  });

  it("extractAnswers phát qua wrapper, không gọi thẳng SDK", async () => {
    generateContentMock.mockResolvedValue(stopMessage({ answers: [] }));

    await extractAnswers(PNG_FILE);

    // Model KHÁC extractQuestions (model rẻ) — hai kỳ vọng khác nhau, nên một
    // implementation nối nhầm hai extractor vào nhau không thể xanh cả hai ca.
    expectRoutedThroughChokepoint("gemini-3.5-flash-lite");
  });

  it("extractMeta phát qua wrapper, không gọi thẳng SDK", async () => {
    generateContentMock.mockResolvedValue(
      stopMessage({
        title: "Đề thi thử",
        subject: "Toán",
        grade: 12,
        durationMinutes: 90,
        school: null,
        schoolYear: null,
        semester: null,
      })
    );

    await extractMeta(PNG_FILE);

    expectRoutedThroughChokepoint("gemini-3.5-flash-lite");
  });

  it("generateHint (gia sư) phát qua wrapper, không gọi thẳng SDK", async () => {
    generateContentMock.mockResolvedValue({
      candidates: [{ finishReason: "STOP" }],
      text: "Em thử tính đạo hàm bậc nhất trước xem sao?",
    });

    await generateHint(TUTOR_INPUT);

    expectRoutedThroughChokepoint("gemini-3.6-flash");
  });
});

// ═══════ 5. Chokepoint KHÔNG nuốt trách nhiệm của ai (ranh giới task) ════════

describe("ranh giới trách nhiệm sau khi gom về một điểm phát", () => {
  const geminiCode = codeLines(
    readFileSync(path.join(SOURCE_ROOT, "lib/ugc/gemini.ts"), "utf8")
  ).join("\n");

  it("retry vẫn là việc của SDK — cấu hình ở getGeminiClient() y nguyên", () => {
    // Hai dòng này là toàn bộ chính sách retry của repo. Wrapper không được
    // đụng vào chúng, và cũng không được mọc một tầng thứ hai bên cạnh.
    expect(geminiCode).toMatch(/const RETRY_ATTEMPTS = 3;/);
    expect(geminiCode).toMatch(/httpOptions: \{ retryOptions: \{ attempts: RETRY_ATTEMPTS \} \}/);
  });

  it("chokepoint không kéo từ vựng PHÂN LOẠI LỖI của caller vào", () => {
    // Bốn caller giữ hình dạng lỗi của riêng mình (EXTRACTION_FAILED,
    // META_EXTRACTION_FAILED, TutorCallError). Ngày nào một trong ba cái tên
    // này xuất hiện trong gemini.ts là ngày wrapper bắt đầu quyết định thay
    // caller — và bốn thông báo lỗi khác nhau gộp thành một.
    expect(geminiCode).not.toMatch(/makeUgcError|EXTRACTION_FAILED|TutorCallError/);
  });

  it("callTutor.ts không mọc thêm quyền truy cập, hạn mức hay ngân sách", () => {
    // Trách nhiệm của file đó là "gọi model và phân loại thất bại"; quyền truy
    // cập/hạn mức/ngân sách thuộc explainStep() ở features/exams/tutorActions.ts.
    // Kiểm trên DÒNG MÃ nên câu chú thích đầu file nói về đúng ranh giới này
    // không tự làm ca test xanh giả.
    const callTutorCode = codeLines(
      readFileSync(path.join(SOURCE_ROOT, "lib/tutor/callTutor.ts"), "utf8")
    ).join("\n");
    expect(callTutorCode).not.toMatch(
      /consumeQuota|readEntitlement|PLAN_LIMITS|Entitlement|checkRateLimit|\bguard\(/
    );
  });
});
