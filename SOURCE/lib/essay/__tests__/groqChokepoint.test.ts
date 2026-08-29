// Điểm phát Groq DUY NHẤT (AC-033) + negative control cho guard Gemini (AC-034).
//
// Chép cấu trúc của `lib/ugc/__tests__/geminiChokepoint.test.ts:110-178`, với
// ĐÚNG MỘT khác biệt, và khác biệt đó là bắt buộc chứ không phải khẩu vị:
//
//   PHÉP QUÉT NÀY KHOÁ VÀO ĐỊNH DANH HẰNG ENDPOINT, KHÔNG KHOÁ VÀO CHUỖI HOST.
//
// Chuỗi host `api.groq.com` đã có mặt trong `scripts/check-ai-key-bundle.mjs`
// (marker của AC-029, Task H4). File đó KHỚP `SOURCE_FILE` — regex cố ý gồm cả
// `.mjs` — và KHÔNG khớp `TEST_FILE`, còn `scripts` thì nằm trong
// `OFFLINE_SCRIPT_DIRS`. Nên một phép quét keyed theo host sẽ đẩy CHÍNH FILE
// BUNDLE-GUARD vào danh sách ngoại lệ offline, mà danh sách đó cũng là một
// `toEqual` VÉT CẠN. Guard mạnh nhất của repo khi ấy biến thành một danh sách
// ngoại lệ — đúng hình dạng hỏng mà AC-034 tồn tại để đặt tên.
//
// Vậy nên: guard bundle khoá vào CHUỖI HOST, phép quét này khoá vào ĐỊNH DANH.
// Hai chuỗi khác nhau THEO CẤU TRÚC, nên không guard nào bắt được file của
// guard kia. Ca "danh sách offline rỗng" bên dưới là thứ đi đỏ ngay giây phút
// ai đó đổi khoá quét sang host — nó không phải ca trang trí.

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SOURCE_ROOT = process.cwd();

/** Bỏ dòng chú thích để phép quét đếm chỗ DÙNG, không đếm chỗ NHẮC TỚI — cùng
 *  hàm mà `geminiChokepoint.test.ts:112-119` dùng. */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
  });
}

/** Mọi đuôi mà một module CHẠY ĐƯỢC dưới SOURCE/ có thể mang. Gồm cả `.mjs`:
 *  tsconfig bật `allowJs`, nên một route `.js`/`.mjs` cũng là mã
 *  request-reachable hợp lệ. Đây CHÍNH LÀ lý do `check-ai-key-bundle.mjs` lọt
 *  vào tầm quét, và vì thế là lý do khoá quét không được là chuỗi host. */
const SOURCE_FILE = /\.(?:[cm]?tsx?|[cm]?jsx?)$/;

/** Test KHÔNG nằm trên đường đi của request: chúng dựng mock quanh biên `fetch`,
 *  nên nhắc tới hằng endpoint ở đó là hợp lệ chứ không phải đường vòng. */
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

/** Bề mặt phát của Groq, bắt theo ĐỊNH DANH HẰNG ENDPOINT.
 *
 *  Bắt theo định danh chứ không theo `fetch(` cũng có lý do: repo dùng `fetch`
 *  ở nhiều chỗ hợp pháp chẳng liên quan gì tới AI, nên `fetch(` sẽ là một phép
 *  quét ồn tới mức vô dụng. Còn định danh này thì chỉ có một nghĩa. */
const EMIT_PATTERN = /GROQ_CHAT_COMPLETIONS_URL/;

/** Mẫu quét CỦA GEMINI, chép nguyên văn từ `geminiChokepoint.test.ts:143`.
 *  Dùng cho negative control AC-034 bên dưới. */
const GEMINI_EMIT_PATTERN = /\.models\.generateContent\s*\(/;

/** Thư mục chạy TAY bằng `npx tsx`, không nằm trên đường đi của request nào. */
const OFFLINE_SCRIPT_DIRS = ["supabase", "scripts"];

function groqEmitSites(): { reachable: string[]; offlineScripts: string[] } {
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

describe("một điểm phát Groq duy nhất (AC-033)", () => {
  it("toàn bộ mã request-reachable dưới SOURCE/ phát Groq từ ĐÚNG MỘT module", () => {
    // Đẳng thức VÉT CẠN, không `toContain`, không `length === 1`: một file BẤT
    // KỲ khác mọc thêm lời gọi này phải làm dòng này đỏ, kể cả khi
    // lib/essay/groqClient.ts vẫn nằm trong danh sách.
    expect(groqEmitSites().reachable).toEqual(["lib/essay/groqClient.ts"]);
  });

  it("danh sách ngoại lệ script offline cho Groq là RỖNG — và phải ở lại rỗng", () => {
    // Rỗng chứ không phải "chưa xét": không script tsx nào chấm bài. Ca này bắt
    // được một script MỚI tự dựng lời gọi Groq, và nó cũng chính là ca đi đỏ
    // nếu ai đó đổi khoá quét sang chuỗi host — `check-ai-key-bundle.mjs` sẽ
    // hiện ra ở đây.
    expect(groqEmitSites().offlineScripts).toEqual([]);
  });

  it("khoá quét KHÔNG khớp bundle guard — hai guard, hai chuỗi", () => {
    // Khẳng định trực tiếp thứ mà hai ca trên chỉ suy ra được. Nếu ai đó đổi
    // EMIT_PATTERN thành /api\.groq\.com/ thì dòng này đỏ kèm đúng tên file bị
    // phân loại nhầm, thay vì để người đọc tự suy từ một danh sách dài ra.
    const bundleGuard = readFileSync(
      path.join(SOURCE_ROOT, "scripts/check-ai-key-bundle.mjs"),
      "utf8"
    );
    // Tiền đề của cả lập luận: file này THẬT SỰ chứa chuỗi host…
    expect(bundleGuard).toContain("api.groq.com");
    // …nhưng KHÔNG chứa định danh, nên phép quét không đụng tới nó.
    expect(codeLines(bundleGuard).some((l) => EMIT_PATTERN.test(l))).toBe(false);
  });
});

describe("negative control — guard Gemini KHÔNG phủ được Groq (AC-034)", () => {
  const groqCode = readFileSync(path.join(SOURCE_ROOT, "lib/essay/groqClient.ts"), "utf8");

  it("mẫu quét CỦA GEMINI khớp ZERO dòng trong module Groq", () => {
    // Ca quan trọng nhất trong file. Nó chứng minh TRONG CI rằng assertion vét
    // cạn của geminiChokepoint.test.ts sẽ ở nguyên MÀU XANH trong khi một
    // provider thứ hai hoàn toàn không được canh gác ship ra. Không có ca này,
    // "chúng tôi có một guard" và "guard của chúng tôi phủ được mọi AI traffic"
    // là hai câu không phân biệt được.
    expect(groqCode).not.toMatch(GEMINI_EMIT_PATTERN);
  });

  it("và chiều ngược lại cũng đúng: module Gemini không mang khoá quét Groq", () => {
    // Đối xứng, cùng một lý do. Hai guard phải ĐỘC LẬP; nếu chúng bắt đầu khớp
    // file của nhau thì hai `toEqual` vét cạn kia sẽ ràng buộc lẫn nhau và mọi
    // thay đổi ở một provider sẽ làm đỏ guard của provider kia.
    const geminiCode = readFileSync(path.join(SOURCE_ROOT, "lib/ugc/gemini.ts"), "utf8");
    expect(geminiCode).not.toMatch(EMIT_PATTERN);
  });
});

describe("kỷ luật khoá và log của module phát (AC-029, AC-056)", () => {
  const groqSource = readFileSync(path.join(SOURCE_ROOT, "lib/essay/groqClient.ts"), "utf8");

  it("`GROQ_API_KEY` chỉ được DÙNG bên trong module này", () => {
    const readers = walk(SOURCE_ROOT)
      .filter((full) => codeLines(readFileSync(full, "utf8")).some((l) => /GROQ_API_KEY/.test(l)))
      .map((full) => path.relative(SOURCE_ROOT, full).split(path.sep).join("/"))
      .sort();
    // Danh sách VÉT CẠN, ba phần tử, và chỉ MỘT trong ba thật sự dùng giá trị
    // của khoá — phân biệt đó là toàn bộ nội dung của ca này:
    //
    //   · lib/essay/groqClient.ts        — chỗ DUY NHẤT đọc giá trị để gọi mạng.
    //   · lib/env/checkEnv.ts            — chỉ hỏi CÓ HAY KHÔNG, để cảnh báo lúc
    //                                      khởi động; không bao giờ chạm giá trị.
    //   · scripts/check-ai-key-bundle.mjs — dùng TÊN BIẾN để dựng marker; đó là
    //                                      việc của guard, không phải chỗ dùng khoá.
    //
    // Một file thứ tư xuất hiện ở đây là tín hiệu thật: khoá vừa mọc thêm một
    // chỗ đọc, và câu "đọc duy nhất trong groqClient.ts" của § Security
    // Considerations vừa hết đúng.
    expect(readers).toEqual([
      "lib/env/checkEnv.ts",
      "lib/essay/groqClient.ts",
      "scripts/check-ai-key-bundle.mjs",
    ]);
  });

  it("module phát KHÔNG có lời gọi console nào", () => {
    // Cách rẻ nhất và kiểm được để thoả ba quy tắc log của AC-056: không có
    // console nào thì không console nào bê được bài làm của học sinh, prompt,
    // response thô hay `err.message` của nhà cung cấp đi đâu cả. Cấm hẳn dễ
    // kiểm hơn nhiều so với đi soi từng đối số.
    expect(codeLines(groqSource).some((l) => /\bconsole\./.test(l))).toBe(false);
  });

  it("module phát mang `import \"server-only\"`", () => {
    expect(groqSource).toMatch(/^import "server-only";$/m);
  });

  it("KHÔNG có SDK nào được thêm (ADR-0018 Decision 5)", () => {
    // Cấm cả `groq-sdk` lẫn OpenAI SDK chĩa vào endpoint tương thích của Groq.
    expect(groqSource).not.toMatch(/from "(?:groq-sdk|openai)"/);
    const pkg = JSON.parse(
      readFileSync(path.join(SOURCE_ROOT, "package.json"), "utf8")
    ) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = { ...pkg.dependencies, ...pkg.devDependencies };
    expect(Object.keys(deps)).not.toContain("groq-sdk");
    expect(Object.keys(deps)).not.toContain("openai");
  });
});
