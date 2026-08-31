// NGƯỠNG XÉT LẠI CỦA ADR-0010, viết thành một cổng chạy được (TECH-DEBT TD-029).
//
// ADR-0010 tự viết điều kiện khai tử cho chính nó:
//
//   "If `service-role.ts` grows beyond a handful of tightly-scoped operations,
//    or if a second caller needs privileged writes, revisit."
//
// TD-029 ghi nhận rằng CẢ HAI vế đã thoả — đếm thật ra 11 operation vào
// 2026-08-28, rồi 13 sau ADR-0018 — và rằng engineer CỐ Ý đi tiếp, vì thứ làm
// nổ ngưỡng là payments + support, nên chặn tính năng chấm tự luận lại không
// sửa được gì cả. Quyết định ấy giữ nguyên. File này KHÔNG lật nó.
//
// THỨ FILE NÀY SỬA LÀ RỦI RO CÒN LẠI, và TD-029 đặt tên cho nó chính xác:
//
//   "ngưỡng này mất tác dụng vĩnh viễn. Một tiêu chí khai tử đã nổ mà không ai
//    đọc thì bằng đúng với việc chưa từng viết ra — và lần sau người thêm
//    operation thứ 14 sẽ lại đọc ADR-0010, lại thấy ngưỡng, lại tưởng nó chưa
//    nổ."
//
// Repo này đã chứng minh một lần rằng một cảnh báo viết đúng, đặt đúng chỗ, vẫn
// không cứu được gì khi việc đọc nó phụ thuộc vào trí nhớ người (TD-005: §16
// đứng nguyên 3 ngày với một cảnh báo ĐÚNG mà không ai chạy). Nên ngưỡng "14"
// không được ở lại trong một file markdown: nó ở đây, nó chạy trong `npm test`,
// và nó dừng đúng người đang thêm operation thứ 14 — trong PR của họ, kèm câu
// hỏi họ cần trả lời.
//
// CÁI NÓ KHÔNG LÀM, nói thẳng để không ai đọc nhầm là nợ đã trả xong: nó KHÔNG
// giảm được một quyền nào. Mọi operation trong file kia vẫn chạy bằng
// `service_role` — khoá vạn năng vượt qua RLS — nên bán kính nổ của MỘT lỗi
// call site vẫn tăng theo số operation. Hai đường đi thật (role Postgres
// least-privilege qua kết nối trực tiếp; hoặc tách scoring ra sau một backend
// identity) vẫn còn nguyên trong TD-029, vẫn cần ADR + work plan riêng, và vẫn
// chưa được chọn.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MODULE_PATH = resolve(__dirname, "../service-role.ts");
const source = readFileSync(MODULE_PATH, "utf8");

/**
 * Ngưỡng của ADR-0010, phát biểu bằng số.
 *
 * 13 là con số ĐO ĐƯỢC sau ADR-0018 (TD-029 dự báo đúng con số này trước khi
 * hai operation cuối đáp xuống). Ngưỡng là 14 — operation kế tiếp.
 *
 * ⚠ NÂNG SỐ NÀY KHÔNG PHẢI CÁCH LÀM TEST XANH LẠI. Nếu nó xanh lại chỉ vì ai
 * đó sửa `14` thành `15` thì ngưỡng vừa bị gỡ bỏ đúng theo cái cách TD-029 nói
 * là không được để xảy ra. Nâng nó là hợp lệ khi VÀ CHỈ KHI đi kèm một quyết
 * định đã ghi lại — ADR mới, hoặc một mục trong TECH-DEBT.md — nói vì sao mẫu
 * hình `service_role` vẫn là mẫu hình đúng ở con số mới.
 */
const OPERATIONS_AT_LAST_REVIEW = 13;

/** Mọi operation được export của module — cùng phép đếm mà TD-029 dùng
 *  (`grep -c "^export async function"`), nên hai bên không thể ra hai số. */
function exportedOperations(): string[] {
  return [...source.matchAll(/^export async function (\w+)/gm)].map((m) => m[1]);
}

describe("ADR-0010 — ngưỡng xét lại của service-role.ts (TD-029)", () => {
  it("chưa có operation thứ 14", () => {
    const operations = exportedOperations();
    expect(
      operations.length,
      `\nADR-0010 tự đặt ngưỡng: thêm operation thứ ${OPERATIONS_AT_LAST_REVIEW + 1} vào\n` +
        "lib/supabase/service-role.ts thì PHẢI xét lại mẫu hình, không phải thêm rồi đi tiếp.\n" +
        `Hiện có ${operations.length}: ${operations.join(", ")}\n\n` +
        "Ngưỡng này ĐÃ NỔ MỘT LẦN (TD-029, 2026-08-28) và lần đó engineer chọn đi tiếp\n" +
        "có ghi lý do. Lần này cần một quyết định MỚI, không phải một lần nâng số:\n" +
        "  (a) role Postgres least-privilege qua kết nối trực tiếp (ADR-0010 nêu tên);\n" +
        "  (b) tách scoring ra sau một backend identity thật;\n" +
        "  (c) đi tiếp — thì ghi lý do vào TECH-DEBT.md TD-029 rồi nâng\n" +
        "      OPERATIONS_AT_LAST_REVIEW trong CÙNG commit đó.\n" +
        "Mọi operation ở đây chạy bằng service_role (vượt RLS), nên bán kính nổ của\n" +
        "MỘT lỗi call site tăng theo con số này."
    ).toBeLessThanOrEqual(OPERATIONS_AT_LAST_REVIEW);
  });

  it("phép đếm KHÔNG bị tự thoả mãn bởi một file rỗng hay một regex trượt", () => {
    // Ca đối chứng. Nếu `service-role.ts` bị đổi tên, chuyển sang `export const`,
    // hay regex trượt vì một lý do nào đó, thì phép kiểm trên trở thành
    // `0 <= 13` — xanh vĩnh viễn, và cổng biến mất mà không ai thấy.
    const operations = exportedOperations();
    expect(operations.length).toBeGreaterThan(0);
    // Ba operation neo, mỗi cái từ một hệ thống KHÁC nhau — chính ba hệ thống
    // mà TD-029 nói là đã cùng nhau đẩy con số qua "a handful": scoring,
    // payments, chấm tự luận.
    expect(operations).toContain("recordExamResult");
    expect(operations).toContain("recordPaymentSettlement");
    expect(operations).toContain("recordEssayGrade");
  });

  it("mọi operation đều dùng CHUNG một chỗ dựng client đặc quyền", () => {
    // Một client `service_role` dựng tại chỗ trong một hàm là cách con số ở
    // trên đếm hụt: operation thứ 14 khi đó không cần `export async function`
    // nào mới — nó chỉ cần một `createClient` thứ hai bên trong một hàm đã có.
    //
    // Đếm LƯỢT ĐỌC ENV và LƯỢT DỰNG CLIENT, không đếm chuỗi trần: tên biến
    // xuất hiện thêm hai lần nữa trong file (một comment và một câu lỗi), và
    // một phép đếm chuỗi trần sẽ đỏ vì một dòng chú thích — cổng nào đỏ vì
    // chú thích thì cũng sẽ bị tắt đi.
    const envReads = source.match(/process\.env\.SUPABASE_SERVICE_ROLE_KEY/g)?.length ?? 0;
    expect(envReads).toBe(1);
    const clientBuilds = source.match(/\bcreateClient\(/g)?.length ?? 0;
    expect(clientBuilds).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// HÌNH DẠNG GHI (ADR-0019 — engineer chọn đường (c) ngày 2026-08-31).
//
// Chọn (c) nghĩa là GIỮ NGUYÊN `service_role`, không đổi identity. Quyết định
// ấy chỉ đứng vững nếu bề mặt không âm thầm xấu đi, nên nó phải đi kèm một
// ràng buộc đo được — nếu không thì "để mở" và "bỏ quên" là cùng một thứ.
//
// Ràng buộc: MỘT LƯỢT GHI ĐẶC QUYỀN PHẢI ĐI QUA `.rpc()`.
//
// Vì sao đúng chỗ này chứ không phải chỗ khác: `service_role` vượt RLS, nên
// một `.from("x").update(...)` ở đây tin hoàn toàn vào tham số mà call site
// truyền xuống. Một call site truyền nhầm id = ghi nhầm bảng, không có lớp nào
// chặn. Còn `.rpc()` gọi vào một hàm SQL tự suy chủ thể và tự kiểm điều kiện
// (đúng như ADR-0010 §"Enforcement lives in SQL": `record_exam_result()` KHÔNG
// nhận user_id, nó suy từ attempt) — call site sai vẫn không ghi được bậy.
//
// 6/13 operation đã ở dạng an toàn đó. 4 lượt ghi thẳng dưới đây có trước
// quyết định (c) và được GIỮ LẠI có tên — không phải vì chúng đúng hơn, mà vì
// chuyển chúng sang RPC là đổi schema trên cả hai database, tức là đúng cái
// chi phí mà (c) từ chối trả lúc này.
//
// ⚠ THÊM TÊN VÀO DANH SÁCH NÀY LÀ ĐI NGƯỢC QUYẾT ĐỊNH (c), không phải làm test
// xanh lại. Lượt ghi đặc quyền thứ 5 đi thẳng bảng cần một dòng trong
// TECH-DEBT.md TD-029 nói vì sao nó không thể là một hàm SQL.

/** 4 lượt ghi thẳng có trước ADR-0019, giữ lại có tên và có ngày. */
const DIRECT_WRITERS_AT_ADR_0019 = [
  "moderateExam", // exams.update + exam_moderation_log.insert
  "flagSupportTicketNotifyFailed", // support_tickets.update
  "addSupportTicketNote", // support_ticket_notes.insert
  "recordPaymentOrder", // payment_orders.insert
];

/** Cắt file thành từng khối theo ranh giới `export async function` — cùng mốc
 *  neo mà phép đếm ở trên dùng, nên hai cổng không thể bất đồng về "operation
 *  này gồm những dòng nào". */
function operationBlocks(): { name: string; body: string }[] {
  const starts = [...source.matchAll(/^export async function (\w+)/gm)];
  return starts.map((match, i) => ({
    name: match[1],
    body: source.slice(match.index!, starts[i + 1]?.index ?? source.length),
  }));
}

/** Bỏ comment trước khi soi. KHÔNG phải chi tiết vặt: doc comment của một
 *  operation nằm TRƯỚC dòng `export` của nó, nên phép cắt ở trên gán nó cho
 *  khối LIỀN TRƯỚC — và `changeSupportTicketStatus` có một comment viết đúng
 *  chữ ".from().update()" để dặn người sau đừng làm thế. Bản đầu của cổng này
 *  đỏ vì đúng dòng chữ ấy, tức là tố cáo `listSupportTickets` về một lượt ghi
 *  nó không hề thực hiện.
 *
 *  Ghi lại vì file này đã tự cảnh báo đúng cái bẫy đó ở ca dưới — và vẫn vấp:
 *  một cổng đỏ vì chú thích thì sẽ bị tắt đi, và tắt xong thì lượt ghi thật
 *  cũng không ai chặn nữa. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\/\/[^\n]*/g, " ");
}

/** Một lượt GHI thẳng vào bảng: có `.from(` và có động từ ghi trong cùng khối.
 *  `.select(` không tính — đọc bằng `service_role` là một rủi ro KHÁC (rò dữ
 *  liệu), do allowlist admin của ADR-0012 gánh, và cổng này không giả vờ phủ. */
function writesDirectly(body: string): boolean {
  const code = stripComments(body);
  return /\.from\(/.test(code) && /\.(insert|update|upsert|delete)\(/.test(code);
}

describe("ADR-0019 — ghi đặc quyền phải đi qua .rpc() (TD-029, đường (c))", () => {
  it("không có lượt ghi thẳng nào NGOÀI 4 lượt đã ghi nhận", () => {
    const found = operationBlocks().filter((op) => writesDirectly(op.body)).map((op) => op.name);
    const unexpected = found.filter((name) => !DIRECT_WRITERS_AT_ADR_0019.includes(name));
    expect(
      unexpected,
      `\nLƯỢT GHI ĐẶC QUYỀN MỚI ĐI THẲNG VÀO BẢNG: ${unexpected.join(", ")}\n\n` +
        "`service_role` vượt qua toàn bộ RLS, nên một `.from(...).insert/update(...)` ở đây\n" +
        "tin hoàn toàn vào tham số call site truyền xuống — truyền nhầm id là ghi nhầm dòng,\n" +
        "không lớp nào chặn.\n\n" +
        "Cách làm đúng là một hàm SQL `security definer` gọi qua `.rpc()`, tự suy chủ thể và\n" +
        "tự kiểm điều kiện (mẫu của `record_exam_result()`: nó KHÔNG nhận user_id).\n" +
        "6/13 operation đã ở dạng đó.\n\n" +
        "Nếu thật sự không diễn tả được bằng SQL: ghi lý do vào TECH-DEBT.md TD-029 rồi thêm\n" +
        "tên vào DIRECT_WRITERS_AT_ADR_0019 trong CÙNG commit đó."
    ).toEqual([]);
  });

  it("danh sách 4 lượt ghi thẳng KHÔNG mục — mọi tên trong đó vẫn còn ghi thẳng", () => {
    // Chiều ngược lại, và nó đỏ khi có TIN VUI. Một tên còn nằm đây sau khi đã
    // chuyển sang `.rpc()` làm danh sách nói dối, và một danh sách nói dối thì
    // lần sau không ai dám dựa vào để biết bề mặt rộng bao nhiêu.
    const writers = new Set(
      operationBlocks().filter((op) => writesDirectly(op.body)).map((op) => op.name)
    );
    const stale = DIRECT_WRITERS_AT_ADR_0019.filter((name) => !writers.has(name));
    expect(
      stale,
      `\n${stale.join(", ")} không còn ghi thẳng vào bảng nữa — bề mặt đặc quyền vừa HẸP LẠI.\n` +
        "Xoá tên đó khỏi DIRECT_WRITERS_AT_ADR_0019 (và ghi một dòng vào TD-029) là xong."
    ).toEqual([]);
  });

  it("mọi tên trong danh sách đều là operation CÓ THẬT", () => {
    // Một tên gõ sai làm ca đầu nới lỏng trong im lặng: nó sẽ tha thứ cho một
    // operation không tồn tại, trong khi operation thật vẫn bị bắt — nhưng nếu
    // gõ sai ĐÚNG tên của một lượt ghi thật thì ca đầu xanh oan.
    const names = new Set(exportedOperations());
    for (const name of DIRECT_WRITERS_AT_ADR_0019) {
      expect(names.has(name), `\`${name}\` không phải operation nào trong service-role.ts`).toBe(true);
    }
  });
});
