// @vitest-environment jsdom

// C-06 TutorQuotaNote — UI Spec UI-D17 (v1.4) / frontend Design Doc `ui:06`, X-13.
//
// Nghĩa vụ chứng minh của plan Task 2.4, và GIỚI HẠN của nó, nói thẳng ở đây vì
// đó là cái bẫy của chính task này:
//
//   Test dưới đây BỌC PROVIDER, tức là nó tự cấp đúng cái thứ mà production có
//   thể đang thiếu. Một mount trả `null` VĨNH VIỄN (thiếu EntitlementProvider ở
//   `(exams)/layout.tsx`) vẫn qua lint, qua build, và vẫn qua file này.
//   => File này KHÔNG chứng minh AC-042. AC-042 do FE-2 (plan Task 2.5, cây
//      route thật) và lượt kiểm thủ công (plan Task 6.5 mục iv) đóng.
//
// Vì thế mỗi case ở đây phải tự chống được kiểu hỏng "khẳng định xanh trên một
// cây DOM rỗng": mọi lần render đều đi qua một phần tử HOST có thật, và helper
// đọc note NÉM khi không có gì để đọc — presence trước, value sau, đúng tiền lệ
// `readBadge` ở OrderStatusBadge.test.tsx:35.
//
// render() không auto-cleanup (vitest.config.ts không có setupFiles) nên mỗi
// case tự gọi cleanup(); cũng vì vậy không có matcher jest-dom nào ở đây.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { EntitlementProvider } from "@/lib/billing/entitlement";
import type { Entitlement, Quota } from "@/lib/billing/types";
import { I18nProvider } from "@/lib/i18n/client";
import type { Locale } from "@/lib/i18n/locales";
import { TutorQuotaNote } from "./TutorQuotaNote";

afterEach(cleanup);

// Mốc CỐ Ý chọn lệch ngày giữa UTC và giờ Việt Nam: 2026-02-28T17:30:00Z là
// 00:30 ngày 01/03/2026 tại Asia/Ho_Chi_Minh. Một bản format không ghim múi giờ
// sẽ in ra 28/02/2026 trên CI (chạy UTC) — xem case "không đọc theo UTC".
const RESETS_AT = "2026-02-28T17:30:00Z";
const RESETS_AT_ICT = "01/03/2026";
const RESETS_AT_UTC = "28/02/2026";

// Mốc thứ hai, dùng để bắt kiểu hỏng "chuỗi ngày hardcode": hai `resetsAt` khác
// nhau phải in ra hai ngày khác nhau.
const OTHER_RESETS_AT = "2026-06-14T03:00:00Z";
const OTHER_RESETS_AT_ICT = "14/06/2026";

const KNOWN: Quota = { state: "known", used: 3, limit: 5, resetsAt: RESETS_AT };
// CÒN LƯỢT (3/5) so với HẾT LƯỢT (5/5) là trục phân biệt mới của component:
// ngày đặt lại chỉ in ở vế thứ hai. Hai fixture dùng CHUNG một `resetsAt` để
// mọi khác biệt quan sát được giữa chúng chỉ có thể đến từ bộ đếm.
const EXHAUSTED: Quota = { state: "known", used: 5, limit: 5, resetsAt: RESETS_AT };
const UNKNOWN: Quota = { state: "unknown" };

function entitlementWith(tutor: Quota): Entitlement {
  return {
    plan: "free",
    expiresAt: null,
    inGracePeriod: false,
    tutor,
    // `upload` cố tình để `unknown`: note này chỉ nói về hạn mức gia sư (C-06),
    // nên một thay đổi ở upload không được phép làm đổi thứ nó in ra.
    upload: { state: "unknown" },
  };
}

/**
 * Render note bên trong một HOST có thật và trả về host đó.
 *
 * NÉM khi host không tồn tại. Đây là chốt chặn quan trọng nhất của file: nếu
 * cây provider hỏng và không render gì cả, khẳng định "note không hiện" sẽ
 * XANH một cách vô nghĩa. Host tồn tại ⇒ cây đã mount ⇒ "rỗng" thực sự có
 * nghĩa là "component tự chọn không hiện gì".
 */
function renderHost(tutor: Quota, locale: Locale): HTMLElement {
  const { container } = render(
    <I18nProvider locale={locale}>
      <EntitlementProvider value={entitlementWith(tutor)}>
        <div data-testid="host">
          <TutorQuotaNote />
        </div>
      </EntitlementProvider>
    </I18nProvider>
  );
  const host = container.querySelector('[data-testid="host"]');
  if (!(host instanceof HTMLElement)) {
    throw new Error("cây provider không render gì cả — không tìm thấy phần tử host");
  }
  return host;
}

/** Đọc note đã render. NÉM khi thiếu `<p>` hoặc `<p>` rỗng — không bao giờ trả "". */
function readNote(host: HTMLElement): { text: string; className: string } {
  const p = host.querySelector("p");
  if (!(p instanceof HTMLParagraphElement)) {
    throw new Error(
      `TutorQuotaNote không render <p> nào; host.innerHTML = ${JSON.stringify(host.innerHTML)}`
    );
  }
  const text = p.textContent ?? "";
  if (text === "") throw new Error("TutorQuotaNote render một <p> rỗng");
  return { text, className: p.className };
}

// Đường dẫn dạng CHUỖI, không phải đối tượng URL: dưới môi trường jsdom, `URL`
// toàn cục là bản của jsdom chứ không phải của Node, và `readFileSync` từ chối
// nó với "The URL must be of scheme file".
const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE_PATH = resolve(
  HERE,
  "../../app/(exams)/exams/[id]/attempt/[attemptId]/result/detail/page.tsx"
);
const COMPONENT_PATH = resolve(HERE, "./TutorQuotaNote.tsx");

/** Đọc file nguồn. NÉM khi không đọc được — một chuỗi rỗng sẽ làm mọi khẳng
 *  định "không chứa X" thành đúng, tức khẳng định cấu trúc mất hết hiệu lực. */
function readSource(path: string): string {
  const text = readFileSync(path, "utf8");
  if (text.trim() === "") throw new Error(`file nguồn rỗng hoặc không đọc được: ${path}`);
  return text;
}

describe('nhánh `unknown` ⇒ null (TutorQuotaNote.tsx:30 — KHÔNG đổi ở task này)', () => {
  it.each<Locale>(["en", "vi"])("locale %s: host mount thật, nhưng note không in gì", (locale) => {
    const host = renderHost(UNKNOWN, locale);
    // renderHost đã đảm bảo host tồn tại (nó ném nếu không) — giờ "rỗng" mới có nghĩa.
    expect(host.innerHTML).toBe("");
    expect(host.querySelector("p")).toBeNull();
  });

  it("cùng một host ĐÓ có <p> khi state là `known` — chứng tỏ rỗng là do nhánh, không do harness hỏng", () => {
    // Case này là thứ phân biệt "note cố ý không hiện" với "test render vào hư
    // không". Thiếu nó, case trên vẫn xanh trên một harness hỏng hoàn toàn.
    const empty = renderHost(UNKNOWN, "en");
    expect(empty.innerHTML).toBe("");
    cleanup();
    const filled = renderHost(KNOWN, "en");
    expect(filled.innerHTML).not.toBe("");
    expect(readNote(filled).text).not.toBe("");
  });
});

describe("nhánh `known` — bộ đếm LUÔN in; ngày đặt lại CHỈ khi đã hết lượt", () => {
  it.each<[Locale, string]>([
    ["en", "3/5 tutor hints used this period."],
    ["vi", "Đã dùng 3/5 lượt gia sư trong kỳ này."],
  ])("locale %s, CÒN lượt: in đúng câu đã duyệt, KHÔNG kèm ngày", (locale, expected) => {
    // So với CHUỖI CỐ ĐỊNH chứ không tra lại từ điển: một khẳng định kiểu
    // `text === t(key, {...})` lệch cùng chiều với mọi thay đổi của từ điển và
    // của bộ format, nên nó không chứng minh được gì (tiền lệ
    // OrderStatusBadge.test.tsx:99-106).
    //
    // `toBe` trên TOÀN BỘ chuỗi, chứ không phải `not.toContain(ngày)`: chỉ nó
    // mới bắt được cả mẩu câu ngày còn sót LẪN khoảng trắng thừa ở cuối — hai
    // thứ một phép `contain` phủ định đều cho qua.
    expect(readNote(renderHost(KNOWN, locale)).text).toBe(expected);
  });

  it.each<[Locale, string]>([
    ["en", "5/5 tutor hints used this period. Resets on 01/03/2026."],
    ["vi", "Đã dùng 5/5 lượt gia sư trong kỳ này. Đặt lại vào 01/03/2026."],
  ])("locale %s, HẾT lượt: in đúng câu đã duyệt, KÈM ngày", (locale, expected) => {
    expect(readNote(renderHost(EXHAUSTED, locale)).text).toBe(expected);
  });

  it.each<Locale>(["en", "vi"])(
    "locale %s: cùng một `resetsAt`, ngày CHỈ xuất hiện ở vế hết lượt",
    (locale) => {
      // Case đối chứng, và là chốt chặn thật của thay đổi này: hai lần render
      // chỉ khác nhau ở `used`, nên sự có/không của ngày không thể do gì khác.
      // Thiếu nó, một component in ngày cho MỌI người vẫn xanh nếu ai đó lỡ tay
      // sửa fixture `KNOWN` thành 5/5.
      const stillHas = readNote(renderHost(KNOWN, locale)).text;
      cleanup();
      const ranOut = readNote(renderHost(EXHAUSTED, locale)).text;
      expect(stillHas).not.toContain(RESETS_AT_ICT);
      expect(ranOut).toContain(RESETS_AT_ICT);
    }
  );

  it("hết lượt tính bằng `used >= limit`, không phải `used === limit`", () => {
    // `isQuotaExhausted()` (lib/billing/types.ts:74) dùng `>=`. Một dòng đếm
    // VƯỢT trần (lượt bị trừ hai lần, hoặc `limit` bị hạ giữa kỳ) vẫn PHẢI là
    // hết lượt — nếu không thì đúng những người không còn lượt nào lại là
    // những người không được biết bao giờ có lại.
    const text = readNote(
      renderHost({ state: "known", used: 7, limit: 5, resetsAt: RESETS_AT }, "en")
    ).text;
    expect(text).toContain("7/5");
    expect(text).toContain(RESETS_AT_ICT);
  });

  it("ngày đến TỪ `tutor.resetsAt`, không phải một chuỗi hardcode", () => {
    const first = readNote(renderHost(EXHAUSTED, "en")).text;
    cleanup();
    const second = readNote(
      renderHost({ state: "known", used: 5, limit: 5, resetsAt: OTHER_RESETS_AT }, "en")
    ).text;
    expect(first).toContain(RESETS_AT_ICT);
    expect(second).toContain(OTHER_RESETS_AT_ICT);
    expect(second).not.toContain(RESETS_AT_ICT);
  });

  it("bộ đếm đến TỪ `tutor.used`/`tutor.limit`, không phải chuỗi hardcode", () => {
    const text = readNote(
      renderHost({ state: "known", used: 7, limit: 9, resetsAt: RESETS_AT }, "en")
    ).text;
    expect(text).toContain("7/9");
    expect(text).not.toContain("3/5");
  });

  it("ngày đọc theo giờ Việt Nam, KHÔNG theo UTC", () => {
    // GIỚI HẠN được ghi rõ: trên một máy có múi giờ môi trường đúng bằng ICT,
    // case này vẫn xanh kể cả khi bộ format không ghim múi giờ. Việc ghim là
    // hợp đồng của `lib/format/datetime.ts` (plan Task 2.3) và được test ở đó;
    // ở đây nó là chốt biên, không phải bằng chứng của việc ghim.
    const text = readNote(renderHost(EXHAUSTED, "en")).text;
    expect(text).toContain(RESETS_AT_ICT);
    expect(text).not.toContain(RESETS_AT_UTC);
  });

  it("giữ nguyên khung lớp của note", () => {
    const { className } = readNote(renderHost(KNOWN, "en"));
    expect(className).toContain("text-muted-foreground");
    expect(className).toContain("text-sm");
  });
});

describe("prop `formattedResetDate` đã được KHAI TỬ (plan Task 2.4)", () => {
  it("component không nhận tham số nào — chữ ký rỗng, không phải props bị destructure", () => {
    // `function f({ formattedResetDate })` có arity 1; `function f()` có arity 0.
    // Đây là cách duy nhất bắt được ở runtime việc khai báo prop còn sót lại —
    // prop optional không đổi hành vi render nên mọi khẳng định DOM đều mù với nó.
    expect(TutorQuotaNote.length).toBe(0);
  });

  it("chữ `formattedResetDate` không còn trong mã nguồn component", () => {
    expect(readSource(COMPONENT_PATH)).not.toContain("formattedResetDate");
  });
});

describe("mount tại CẢ HAI chỗ gọi ExplainStepAffordance (UI-D17)", () => {
  // Đây là khẳng định CẤU TRÚC trên mã nguồn, và nó chỉ chứng minh đúng một
  // điều: hai mount có tồn tại, cạnh hai chỗ gọi affordance, và không chỗ nào
  // truyền prop. Nó KHÔNG chứng minh note render ra gì trên cây route thật —
  // việc đó là của FE-2 (plan Task 2.5). Trang là async server component nên
  // không render được trong unit test này.
  const source = readSource(PAGE_PATH);

  it("có ĐÚNG hai mount, khớp với đúng hai chỗ gọi affordance", () => {
    const mounts = source.match(/<TutorQuotaNote\b/g) ?? [];
    const affordances = source.match(/<ExplainStepAffordance\b/g) ?? [];
    expect(affordances).toHaveLength(2);
    expect(mounts).toHaveLength(2);
  });

  it("không mount nào truyền prop", () => {
    expect(source).not.toContain("formattedResetDate");
    const tags = source.match(/<TutorQuotaNote\b[^>]*>/g) ?? [];
    // Đếm TRƯỚC khi duyệt: một vòng lặp trên mảng rỗng xanh vô nghĩa, tức là
    // "xoá sạch mount" sẽ qua được case này. Presence trước, value sau.
    expect(tags).toHaveLength(2);
    for (const tag of tags) {
      expect(tag).toBe("<TutorQuotaNote />");
    }
  });

  it("mount nằm NGOÀI cổng `hasBeenWrongTwice`", () => {
    // Lý do sống còn của C-06 (TutorQuotaNote.tsx:8-12): affordance chỉ mount
    // khi người dùng đã sai hai lần cùng một câu. Đặt note bên trong cổng đó
    // thì người dùng Free chưa từng sai hai lần KHÔNG BAO GIỜ thấy hạn mức —
    // đúng thứ AC-042 cấm.
    const gates = source.match(/hasBeenWrongTwice === true && \([\s\S]*?\n\s*\)\}/g) ?? [];
    // Đếm trước, cùng lý do như case trên: nếu regex không khớp gì (vì trang đổi
    // hình dạng), vòng lặp rỗng sẽ xanh và khẳng định này im lặng mất hiệu lực.
    expect(gates).toHaveLength(2);
    for (const gate of gates) {
      expect(gate).not.toContain("TutorQuotaNote");
    }
  });
});
