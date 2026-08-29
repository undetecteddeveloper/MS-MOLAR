// CỔNG CHO CHÍNH CỔNG: `verify-schema.ts` không được đăng nhập trên prod.
//
// VÌ SAO TEST NÀY TỒN TẠI, và vì sao nó là TEST chứ không phải comment:
// `verify-schema.ts` có một nhánh `signInProbeUser()` TẠO-hoặc-ĐẶT-LẠI password
// cho `smithnguyen247+rlstesta@gmail.com`, mà password đó là hằng nằm trong
// source ĐÃ COMMIT. Chĩa script vào prod = cấp cho auth tenant production một
// tài khoản đã xác thực mà ai đọc repo cũng đăng nhập được.
//
// Chuyện đó đã được cảnh báo bằng comment ở đầu mục 9 của script, và comment ĐÃ
// BỊ VƯỢT MẶT HAI LẦN. Lần thứ hai (2026-08-29, khi đóng Gate B7) lane thật sự
// chạy trên prod và tài khoản probe được tìm thấy đang SỐNG trên production —
// phải ban, thu hồi phiên và xoay password để dọn (TD-032). Kết luận rút ra
// không phải "viết cảnh báo to hơn" mà là "cảnh báo không chặn được gì".
//
// Không cần DB, không cần credential: test đọc FILE THẬT và soi HÌNH DẠNG của
// cổng. Nó chạy trong `npx vitest run` nên nổ ngay ở PR.
//
// Phân công với TypeScript — đọc kỹ chỗ này trước khi sửa test:
// tsc mới là thứ cưỡng chế từng chỗ DÙNG `probe`. Vì `probe` được khai bằng
// ternary có nhánh `null`, kiểu của nó là `SupabaseClient | null`, nên MỌI
// `probe.<gì đó>` không nằm sau một guard đều là lỗi biên dịch. Test này không
// đi đếm các chỗ dùng đó — nó bảo vệ đúng cái HÌNH DẠNG khiến tsc làm được việc
// ấy. Đổi ternary thành `!` hay thành `as SupabaseClient` là gỡ luôn tsc khỏi
// vai trò của nó, và đó chính là thứ khẳng định đầu tiên bắt.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT_PATH = resolve(__dirname, "../../../supabase/verify-schema.ts");
const script = readFileSync(SCRIPT_PATH, "utf8");

/**
 * Chỉ các dòng MÃ — bỏ dòng comment thuần.
 *
 * Cần tách vì script này giải thích rất nhiều bằng comment, và `signInProbeUser`
 * được NHẮC TỚI trong sáu chỗ giải thích khác nhau. Đếm trên nguyên văn file sẽ
 * ra 7 và khẳng định "gọi đúng một lần" biến thành vô nghĩa — nó sẽ đo mật độ
 * comment chứ không đo số chỗ gọi.
 */
const codeOnly = script
  .split("\n")
  .filter((line) => {
    const t = line.trim();
    return t !== "" && !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  })
  .join("\n");

/** Ref của project PRODUCTION. Không bao giờ được nằm trong allowlist. */
const PROD_REF = "pebjdlbgbmizgfpuptjl";
const DEV_REF = "hynwleaxtbtjzkvpjsug";

describe("verify-schema.ts — cổng chặn probe hành vi trên non-dev", () => {
  it("`probe` khai bằng ternary có nhánh null, nên tsc cưỡng chế mọi chỗ dùng", () => {
    // Đây là khẳng định NỀN. Nếu hình dạng này mất thì mọi khẳng định còn lại
    // trong file vẫn xanh trong khi cổng đã hở — vì thứ thật sự chặn từng chỗ
    // dùng `probe` là kiểu `SupabaseClient | null`, không phải test này.
    expect(script).toMatch(
      /const probe = behavioural \? await signInProbeUser\(url, anon, service\) : null;/
    );
  });

  it("signInProbeUser được GỌI đúng một lần, và chỉ ở chỗ đã guard", () => {
    // Đếm `await signInProbeUser(` chứ không đếm tên trần: tên trần còn xuất
    // hiện ở dòng ĐỊNH NGHĨA hàm và trong chuỗi banner in ra lúc chạy non-dev
    // ("`signInProbeUser()` KHÔNG được gọi"). Hàm là `async` và trả Promise nên
    // chỗ gọi thật buộc phải có `await` — đếm như vậy vừa chính xác vừa không
    // phụ thuộc vào chữ nghĩa của comment hay của banner.
    const callSites = codeOnly.match(/await signInProbeUser\(/g) ?? [];
    expect(callSites).toHaveLength(1);
  });

  it("KHÔNG dùng `!` hay ép kiểu để đi vòng qua nhánh null của probe", () => {
    // `probe!.x` và `(probe as SupabaseClient).x` đều biên dịch trót lọt và đều
    // vô hiệu hoá đúng cơ chế bảo vệ ở khẳng định đầu tiên.
    expect(script).not.toMatch(/\bprobe!/);
    expect(script).not.toMatch(/probe as SupabaseClient/);
  });

  it("allowlist CÓ dev và KHÔNG CÓ prod", () => {
    const decl = /const BEHAVIOURAL_PROBE_ALLOWED_REFS = new Set\(\[([^\]]*)\]\)/.exec(script);
    expect(decl).not.toBeNull();
    const refs = decl![1];
    expect(refs).toContain(DEV_REF);
    // Khẳng định GIÁ TRỊ CAO NHẤT của cả file này: thêm ref prod vào allowlist
    // là cách trực tiếp nhất để mở lại đúng lỗ đã phải dọn bằng TD-032.
    expect(refs).not.toContain(PROD_REF);
  });

  it("cả file không có ref prod ở bất kỳ đâu", () => {
    // Chặn cả đường vòng: một `if (ref === "pebj…")` đặc cách ở giữa file sẽ
    // lọt qua khẳng định allowlist ở trên.
    expect(script).not.toContain(PROD_REF);
  });

  it("quyết định dựa trên project ref của URL, KHÔNG dựa trên tên file env", () => {
    // Thói quen cũ — chính comment của `loadEnv()` ghi lại — là kiểm prod bằng
    // cách ĐỔI TÊN file credential prod thành `.env.local`. Một cổng đọc
    // `SCHEMA_ENV_FILE` sẽ mở toang trước đúng thao tác đó, và mở im lặng.
    expect(script).toMatch(/const ref = projectRefOf\(url\);/);
    expect(script).toMatch(
      /const behavioural = ref !== null && BEHAVIOURAL_PROBE_ALLOWED_REFS\.has\(ref\);/
    );
    // `behavioural` không được suy ra từ SCHEMA_ENV_FILE ở bất kỳ đâu.
    expect(script).not.toMatch(/behavioural[^\n]*SCHEMA_ENV_FILE/);
  });

  it("ref không phân giải được thì đi nhánh AN TOÀN (mặc định đóng)", () => {
    // `projectRefOf()` trả null cho một URL lạ (self-host, localhost, gõ sai).
    // `ref !== null && …` khiến null rơi vào nhánh chỉ-đọc. Sai theo hướng bỏ
    // sót phép đo thì chỉ mất thông tin; sai hướng ngược lại thì ghi vào một
    // database thật.
    expect(script).toMatch(/ref !== null &&/);
  });

  it("lượt chạy PHẦN không in ra câu của lượt chạy ĐỦ", () => {
    // Nếu một lượt bỏ qua 7 mục vẫn in dấu ✅ giống hệt lượt đủ, thì log đó sẽ
    // được dán vào work plan làm bằng chứng cho những thứ nó chưa hề đo.
    expect(script).toMatch(/failures === 0 && skipped === 0/);
    expect(script).toContain("PASS PHẦN");
  });

  it("mục bị bỏ qua được ĐẾM riêng, không gộp vào failures", () => {
    // Gộp vào failures sẽ làm lượt chạy non-dev đỏ, và một cổng đỏ theo thiết
    // kế là cổng sẽ bị tắt. Đếm riêng giữ được cả hai: exit code còn nghĩa, và
    // độ phủ vẫn hiện ra.
    expect(script).toMatch(/function skip\(msg: string\)/);
    expect(script).toMatch(/skipped \+= 1;/);
    expect(script).not.toMatch(/function skip\([^)]*\)\s*\{[^}]*failures \+= 1/);
  });
});
