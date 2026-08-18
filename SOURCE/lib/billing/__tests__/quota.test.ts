// Hạn mức theo gói + MỘT chỗ suy ra mốc bắt đầu kỳ (backend DD I004).
//
// Điều đáng test ở đây không phải "hàm có trả số không", mà là một hình dạng
// hỏng IM LẶNG rất cụ thể: đường ĐỌC (readEntitlement — hiện `used`/`resetsAt`)
// và đường GHI (consumeQuota — INCR ở cổng) cùng ghép chuỗi khoá
// `quota:{kind}:{userId}:{periodStartEpoch}`. Nếu hai bên suy ra `periodStart`
// bằng hai phép tính khác nhau — lệch một phép làm tròn, hay một bên tính bằng
// giây còn bên kia bằng mili giây — thì màn hình báo "còn n lượt" trong khi
// cổng từ chối, và KHÔNG CÓ GÌ ĐỎ. Vì thế mọi kỳ vọng dưới đây là **số literal
// tính độc lập bằng `Date.UTC`**, không bao giờ đọc ngược từ implementation.
//
// Mốc `createdAt` cố ý đặt ở 09:17:33.123Z — tức 16:17:33.123 giờ Asia/Saigon
// (UTC+7), KHÔNG phải nửa đêm ở cả hai múi. Nhờ vậy epoch kỳ vọng mang theo
// phần giờ-phút-giây-ms, và mọi implementation cắt về mốc NGÀY (theo UTC hay
// theo giờ máy) đều lệch — ở bất kỳ múi giờ nào CI hay máy dev đang chạy.

import { describe, expect, it } from "vitest";
import { PLAN_LIMITS, periodStartEpoch } from "../quota";
import * as frozenTypes from "../types";

/** 30 ngày, viết lại ở test bằng số học tường minh chứ không import từ module
 *  đang được test — một hằng đi chung với implementation thì không kiểm được
 *  implementation. */
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000; // 2_592_000_000

/** `user_profiles.created_at` của người dùng Free. 2026-01-15T09:17:33.123Z. */
const CREATED_AT_MS = Date.UTC(2026, 0, 15, 9, 17, 33, 123); // 1768468653123
/** `subscriptions.period_anchor_at`. 2026-03-03T14:45:10.500Z. */
const ANCHOR_MS = Date.UTC(2026, 2, 3, 14, 45, 10, 500); // 1772549110500

const daysAfterCreation = (days: number) =>
  new Date(CREATED_AT_MS + Math.round(days * 24 * 60 * 60 * 1000));

describe("PLAN_LIMITS", () => {
  it("đúng bốn con số của PRD R5/D5 và R6/D7", () => {
    expect(PLAN_LIMITS).toEqual({
      free: { tutor: 5, upload: 3 },
      premium: { tutor: 500, upload: 15 },
    });
  });

  it("KHÔNG nằm trong types.ts — hợp đồng đó đóng băng (DD I012)", () => {
    // Ca này đỏ đúng vào lúc có người "gom cho gọn" bảng hạn mức vào
    // types.ts. Đổi types.ts thì phải sửa UI Spec trước, nên nó không được
    // phép xảy ra lặng lẽ trong một commit backend.
    expect(Object.keys(frozenTypes)).not.toContain("PLAN_LIMITS");
  });
});

describe("periodStartEpoch — Free: created_at + 30d × floor((now − created_at)/30d)", () => {
  it.each([
    ["ngày 0 (vừa tạo tài khoản)", 0, 1768468653123],
    ["ngày 15 — floor = 0, KHÔNG phải ceil", 15, 1768468653123],
    ["ngày 29 — floor = 0, KHÔNG phải round", 29, 1768468653123],
    ["ngày 29,999 — vẫn kỳ cũ", 29.999, 1768468653123],
    ["ngày 30 chẵn — biên: kỳ MỚI bắt đầu đúng tại đây", 30, 1771060653123],
    ["ngày 31 — vẫn kỳ thứ hai", 31, 1771060653123],
    ["ngày 61 — kỳ thứ ba", 61, 1773652653123],
  ])("%s", (_label, days, expected) => {
    expect(periodStartEpoch("free", null, new Date(CREATED_AT_MS), daysAfterCreation(days))).toBe(
      expected
    );
  });

  it("kỳ mới bắt đầu ĐÚNG tại mili giây thứ 2_592_000_000 — không sớm hơn một mili giây nào", () => {
    // Ca 29,999 ngày ở trên còn cách biên 86,4 GIÂY, nên nó KHÔNG phân biệt
    // được một implementation cấp kỳ mới sớm vài mili giây. Hai lời gọi dưới
    // đây kẹp đúng biên: mili giây CUỐI của kỳ cũ và mili giây ĐẦU của kỳ mới.
    // Cả hai kỳ vọng là literal, nên một biên bị dịch đi dù chỉ 1 ms là đỏ.
    const lastMsOfFirstPeriod = new Date(CREATED_AT_MS + THIRTY_DAYS_MS - 1);
    const firstMsOfSecondPeriod = new Date(CREATED_AT_MS + THIRTY_DAYS_MS);

    expect(
      periodStartEpoch("free", null, new Date(CREATED_AT_MS), lastMsOfFirstPeriod)
    ).toBe(1768468653123);
    expect(
      periodStartEpoch("free", null, new Date(CREATED_AT_MS), firstMsOfSecondPeriod)
    ).toBe(1771060653123);
  });

  it("trả MILI giây, không phải giây — hai đầu khoá không được quy đổi", () => {
    // 1768468653123 (ms) và 1768468653 (s) là hai khoá khác nhau; một bên đọc
    // theo giây còn bên kia theo ms là đúng lỗi I004 mô tả, và nó im lặng.
    const epoch = periodStartEpoch(
      "free",
      null,
      new Date(CREATED_AT_MS),
      daysAfterCreation(15)
    );
    expect(epoch).toBe(new Date(CREATED_AT_MS).getTime());
    expect(Number.isInteger(epoch)).toBe(true);
  });

  it("mốc kỳ luôn cách created_at đúng một bội của 30 ngày", () => {
    for (const days of [0, 15, 29, 30, 31, 61, 120]) {
      const epoch = periodStartEpoch("free", null, new Date(CREATED_AT_MS), daysAfterCreation(days));
      expect((epoch - CREATED_AT_MS) % THIRTY_DAYS_MS, `ngày ${days}`).toBe(0);
    }
  });

  it("BỎ QUA anchor khi gói là free — anchor của một thuê bao đã hết hạn không được kéo mốc kỳ", () => {
    expect(
      periodStartEpoch("free", new Date(ANCHOR_MS), new Date(CREATED_AT_MS), daysAfterCreation(31))
    ).toBe(1771060653123);
  });
});

describe("periodStartEpoch — Premium: đúng period_anchor_at", () => {
  it("trả thẳng anchor, không cộng thêm kỳ nào", () => {
    expect(
      periodStartEpoch("premium", new Date(ANCHOR_MS), new Date(CREATED_AT_MS), new Date(ANCHOR_MS + 5 * 86_400_000))
    ).toBe(1772549110500);
  });

  it("BỎ QUA created_at — người mua Premium không quay về lịch kỳ của ngày đăng ký", () => {
    const withOtherCreatedAt = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(Date.UTC(2024, 5, 1, 3, 4, 5, 6)),
      new Date(ANCHOR_MS + 5 * 86_400_000)
    );
    expect(withOtherCreatedAt).toBe(1772549110500);
  });

  it("premium mà thiếu anchor là dữ liệu sai — ném lỗi chứ không âm thầm rơi về công thức Free", () => {
    // `subscriptions.period_anchor_at` là `not null` (schema.sql:1689), nên ca
    // này chỉ tới được bằng dữ liệu hỏng. Rơi lặng lẽ về công thức Free sẽ đẻ
    // ra một khoá THỨ HAI cho cùng một người — đúng thứ hàm này tồn tại để
    // chặn.
    expect(() =>
      periodStartEpoch("premium", null, new Date(CREATED_AT_MS), daysAfterCreation(31))
    ).toThrow();
  });
});

describe("periodStartEpoch — ân hạn cho QUYỀN, không bao giờ cho HẠN MỨC (AC-011)", () => {
  // expires_at = anchor + 30 ngày; ân hạn kéo dài 3 ngày sau đó (PRD D8/R4).
  const EXPIRES_AT_MS = ANCHOR_MS + THIRTY_DAYS_MS; // 1775141110500

  it("giá trị TRƯỚC và SAU mốc hết hạn là MỘT — bộ đếm vẫn tính vào kỳ cũ", () => {
    const beforeExpiry = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(CREATED_AT_MS),
      new Date(EXPIRES_AT_MS - 1000)
    );
    const insideGrace = periodStartEpoch(
      "premium",
      new Date(ANCHOR_MS),
      new Date(CREATED_AT_MS),
      new Date(EXPIRES_AT_MS + 86_400_000)
    );

    // Cả hai là literal 1772549110500, không phải "bằng nhau" suông: một
    // implementation trả cùng một giá trị SAI ở cả hai lần gọi vẫn phải đỏ.
    expect(beforeExpiry).toBe(1772549110500);
    expect(insideGrace).toBe(1772549110500);
    expect(insideGrace).toBe(beforeExpiry);
  });

  it("cuối ân hạn (hết hạn + 3 ngày) vẫn chưa cấp mốc kỳ mới", () => {
    expect(
      periodStartEpoch(
        "premium",
        new Date(ANCHOR_MS),
        new Date(CREATED_AT_MS),
        new Date(EXPIRES_AT_MS + 3 * 86_400_000)
      )
    ).toBe(1772549110500);
  });
});
