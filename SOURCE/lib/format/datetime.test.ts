// Hợp đồng của lib/format/datetime.ts (UI Spec UI-D12, plan Task 2.3).
//
// Ba thứ file này phải chứng minh, và lý do từng thứ có mặt:
//
//  1. MÚI GIỜ ĐƯỢC GHIM. Máy dev ở đây chạy TZ=Asia/Saigon — trùng đúng múi
//     giờ cần ghim — nên một implementation QUÊN `timeZone` vẫn ra kết quả
//     đúng y hệt trên máy này và test sẽ xanh một cách vô nghĩa. Vercel thì
//     chạy UTC. Vì vậy file này TỰ ÉP `process.env.TZ = "UTC"` và có một
//     assertion canh gác: nếu ép không ăn thì test đỏ, chứ không âm thầm mất
//     khả năng phân biệt.
//  2. THỜI ĐIỂM VẮT QUA NỬA ĐÊM ICT. Instant được chọn là 17:30Z: ở UTC là
//     ngày 18, ở ICT (UTC+7) là 00:30 ngày 19 — LỆCH NGÀY LỊCH, không chỉ lệch
//     giờ. Một instant kiểu 03:00Z sẽ ra cùng ngày ở cả hai múi và không chứng
//     minh được gì.
//  3. KHÔNG BAO GIỜ NÉM. `null` / `""` / chuỗi rác đều ra "—", theo đúng hợp
//     đồng sẵn có của lib/history/format.ts chứ không đẻ quy ước thứ hai.

process.env.TZ = "UTC";

import { describe, expect, it } from "vitest";
import { formatDate, formatDateTime } from "./datetime";

/** 17:30Z = 00:30 ICT của NGÀY HÔM SAU — vắt qua nửa đêm ICT. */
const CROSSES_ICT_MIDNIGHT = "2026-08-18T17:30:00.000Z";
/** 17:00Z = đúng 00:00 ICT ngày hôm sau — mép chính xác của biên. */
const EXACTLY_ICT_MIDNIGHT = "2026-08-18T17:00:00.000Z";
/** Một thời điểm giữa ban ngày ở cả hai múi — bản đối chứng "bình thường". */
const MIDDAY = "2026-08-18T07:32:00.000Z";

describe("môi trường test", () => {
  it("chạy dưới TZ khác ICT, nếu không thì mọi khẳng định về việc ghim múi giờ đều vô nghĩa", () => {
    // Không có chốt này, cả file vẫn xanh trên một implementation KHÔNG ghim
    // `timeZone` khi máy chạy test tình cờ ở Asia/Saigon (máy dev của repo
    // này đúng là như vậy).
    const ambient = Intl.DateTimeFormat().resolvedOptions().timeZone;
    expect(ambient).toBe("UTC");
    expect(new Date(CROSSES_ICT_MIDNIGHT).getUTCDate()).toBe(18);
  });
});

describe("formatDate", () => {
  it('trả "—" cho null, không ném', () => {
    expect(() => formatDate(null, "vi")).not.toThrow();
    expect(formatDate(null, "vi")).toBe("—");
    expect(formatDate(null, "en")).toBe("—");
  });

  it('trả "—" cho chuỗi rỗng, không ném', () => {
    expect(() => formatDate("", "vi")).not.toThrow();
    expect(formatDate("", "vi")).toBe("—");
    expect(formatDate("", "en")).toBe("—");
  });

  it('trả "—" cho chuỗi không phải ngày, không ném', () => {
    expect(() => formatDate("not-a-date", "vi")).not.toThrow();
    expect(formatDate("not-a-date", "vi")).toBe("—");
    expect(formatDate("not-a-date", "en")).toBe("—");
  });

  it("đọc 17:30Z thành NGÀY 19 theo giờ ICT, không phải ngày 18 của UTC", () => {
    // Đây là case duy nhất phân biệt được implementation quên `timeZone`:
    // không ghim thì cùng instant này ra "18/08/2026".
    expect(formatDate(CROSSES_ICT_MIDNIGHT, "vi")).toBe("19/08/2026");
    expect(formatDate(CROSSES_ICT_MIDNIGHT, "en")).toBe("19/08/2026");
  });

  it("đọc đúng mép 17:00Z thành 19/08/2026 (00:00 ICT)", () => {
    expect(formatDate(EXACTLY_ICT_MIDNIGHT, "vi")).toBe("19/08/2026");
    expect(formatDate(EXACTLY_ICT_MIDNIGHT, "en")).toBe("19/08/2026");
  });

  it("giữ DD/MM/YYYY ở CẢ hai ngôn ngữ — locale ngầm định (en-US) sẽ ra MM/DD/YYYY", () => {
    expect(formatDate(MIDDAY, "vi")).toBe("18/08/2026");
    expect(formatDate(MIDDAY, "en")).toBe("18/08/2026");
  });

  it("server và browser ra CÙNG MỘT chuỗi byte cho cùng instant và cùng ngôn ngữ", () => {
    // Hai lần gọi độc lập phải khớp tuyệt đối: đó là điều kiện đủ để một
    // client component tự format mà không lệch hydration.
    expect(formatDate(MIDDAY, "vi")).toBe(formatDate(MIDDAY, "vi"));
    expect(formatDate(MIDDAY, "en")).toBe(formatDate(MIDDAY, "vi"));
  });
});

describe("formatDateTime", () => {
  it('trả "—" cho null / "" / chuỗi rác, không ném', () => {
    expect(() => formatDateTime(null, "en")).not.toThrow();
    expect(() => formatDateTime("", "en")).not.toThrow();
    expect(() => formatDateTime("not-a-date", "en")).not.toThrow();
    expect(formatDateTime(null, "vi")).toBe("—");
    expect(formatDateTime("", "vi")).toBe("—");
    expect(formatDateTime("not-a-date", "vi")).toBe("—");
  });

  it("đọc 17:30Z thành 19/08/2026 00:30 giờ ICT — lệch CẢ ngày lẫn giờ so với UTC", () => {
    // Không ghim múi giờ thì cùng instant ra "18/08/2026 17:30".
    expect(formatDateTime(CROSSES_ICT_MIDNIGHT, "vi")).toBe("19/08/2026 00:30");
    expect(formatDateTime(CROSSES_ICT_MIDNIGHT, "en")).toBe("19/08/2026 00:30");
  });

  it("dùng đồng hồ 24 giờ, không hậu tố SA/CH hay AM/PM", () => {
    expect(formatDateTime(MIDDAY, "vi")).toBe("18/08/2026 14:32");
    expect(formatDateTime(MIDDAY, "en")).toBe("18/08/2026 14:32");
  });

  it("in 00:00 chứ không phải 24:00 tại đúng nửa đêm ICT", () => {
    expect(formatDateTime(EXACTLY_ICT_MIDNIGHT, "vi")).toBe("19/08/2026 00:00");
    expect(formatDateTime(EXACTLY_ICT_MIDNIGHT, "en")).toBe("19/08/2026 00:00");
  });

  it("ngăn cách ngày và giờ bằng đúng MỘT dấu cách, không dấu phẩy", () => {
    // ICU của một số phiên bản chèn ", " khi gộp ngày+giờ trong cùng một
    // formatter; hợp đồng in ra là "18/08/2026 14:32".
    expect(formatDateTime(MIDDAY, "en")).not.toContain(",");
    expect(formatDateTime(MIDDAY, "vi")).not.toContain(",");
  });
});
