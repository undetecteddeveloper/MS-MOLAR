// essayLifecycle — unit tests (Task H1, backend DD § Data Contracts :1005,
// § State Transitions :1397; ADR-0018 D2/D4 + Implementation Guidance #8).
//
// Ba điều làm bộ test này khác một bộ "gọi hàm rồi so kết quả":
//
//   1. ĐỒNG HỒ LÀ THAM SỐ. Mọi ca truyền `now` vào, không ca nào đọc đồng hồ
//      thật. Một `Date.now()` bên trong module sẽ biến ba ca biên hạn chờ
//      thành ba quả bom hẹn giờ: chúng xanh hôm nay và đỏ vào một buổi chiều
//      không ai đụng gì tới file này. Ca "biên loại trừ" dưới đây chỉ có nghĩa
//      khi khoảng cách `now − createdAt` là một con số DO TEST ĐẶT.
//   2. BA CA BIÊN, KHÔNG PHẢI MỘT. `deadline − 1s`, `deadline`, `deadline + 1s`.
//      Một `>=` thay cho `>` chỉ lật ĐÚNG ca giữa; bỏ ca giữa đi thì `>` và
//      `>=` cho kết quả giống hệt nhau và bài test không phân biệt được gì.
//   3. HAI PHÉP QUÉT MÃ NGUỒN (EG-BE-036 + literal khoá). Ca duy nhất bắt được
//      một call site TƯƠNG LAI ở một file CHƯA TỒN TẠI. Kỹ thuật chép nguyên
//      của `lib/ugc/__tests__/geminiChokepoint.test.ts`: `codeLines()` bỏ dòng
//      chú thích để phép quét đếm chỗ VIẾT chứ không đếm chỗ NHẮC TỚI, và so
//      bằng `toEqual` VÉT CẠN chứ không `toContain` — thêm một file bất kỳ
//      phải làm dòng đó đỏ.

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { PerQuestionResult } from "@/types/result";
import {
  ESSAY_BANDS,
  ESSAY_KEYS,
  ESSAY_MAX_ATTEMPTS,
  ESSAY_MAX_POINTS,
  ESSAY_PENDING_DEADLINE_MS,
  deriveEssayView,
  hasIncompleteEssay,
  hasUnresolvedEssay,
  isEssayIncomplete,
  isEssayUnresolved,
  newEssayEntry,
  summariseEssays,
  type EssayView,
} from "../essayLifecycle";

// ═══════════════════════════ Fixture helpers ════════════════════════════════

/** Phần tử `per_question` ĐỌC LÊN TỪ DB. `PerQuestionResult` không khai sáu
 *  khoá `essay*` (chúng tới lúc chạy, từ jsonb), nên fixture giao nó với một
 *  index signature thay vì ép kiểu — ép kiểu sẽ giấu mất lỗi gõ sai tên khoá ở
 *  đúng chỗ bộ test này tồn tại để bắt. */
type StoredElement = PerQuestionResult & Record<string, unknown>;

/** Bài làm của học sinh — NỘI DUNG UGC. Nó có mặt trong mọi fixture để ca
 *  EG-BE-025 chứng minh được rằng `console.warn` KHÔNG mang nó theo. */
const STUDENT_ANSWER = "Nguyễn Trãi viết Bình Ngô đại cáo năm 1428 vì…";

const CREATED_AT = "2026-08-29T10:00:00.000Z";
const CREATED_MS = Date.parse(CREATED_AT);

function at(offsetMs: number): Date {
  return new Date(CREATED_MS + offsetMs);
}

/** Một lượt đọc "vừa nộp xong" — chưa tới hạn chờ, nên không ca nào vô tình
 *  mượn phép suy diễn quá hạn khi nó đang muốn kiểm một thứ khác. */
const FRESH = at(1_000);
const OVERDUE = at(ESSAY_PENDING_DEADLINE_MS + 1_000);

function element(questionId: string, stored: Record<string, unknown> = {}): StoredElement {
  return {
    questionId,
    selected: STUDENT_ANSWER,
    isCorrect: false,
    scored: false,
    ...stored,
  };
}

/** Dòng ghi TRƯỚC khi tính năng ship: không mang khoá `essay*` nào. */
function legacyElement(questionId: string): StoredElement {
  return { questionId, selected: "A", isCorrect: true, scored: true };
}

function pendingElement(questionId: string, attempts = 0): StoredElement {
  return element(questionId, {
    essayState: "pending",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: attempts,
  });
}

function failedElement(questionId: string, attempts: number): StoredElement {
  return element(questionId, {
    essayState: "failed",
    essayEarned: null,
    essayMax: null,
    essayLowConfidence: false,
    essayAttempts: attempts,
  });
}

function gradedElement(questionId: string, earned: number, lowConfidence = false): StoredElement {
  return element(questionId, {
    essayState: "graded",
    essayEarned: earned,
    essayMax: 1,
    essayLowConfidence: lowConfidence,
    essayAttempts: 1,
    essayGradedAt: "2026-08-29T10:00:42.000Z",
  });
}

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

beforeEach(() => {
  warnSpy.mockClear();
});

afterAll(() => {
  warnSpy.mockRestore();
});

// ═════════════════ 1. Hằng số — lời khai DUY NHẤT của repo ═══════════════════

describe("hằng số và literal khoá", () => {
  it("khai đúng sáu literal khoá jsonb, gõ tay từng chuỗi", () => {
    // KỲ VỌNG GÕ TAY, `toEqual` vét cạn: một khoá thứ bảy lén vào cũng đỏ, và
    // một chuỗi bị đổi (vd `essay_state`) đỏ ngay đây thay vì đỏ ở một hàm SQL
    // sáu task nữa. Đây là chỗ DUY NHẤT trong repo được phép gõ sáu chuỗi này.
    expect(ESSAY_KEYS).toEqual({
      state: "essayState",
      earned: "essayEarned",
      max: "essayMax",
      lowConfidence: "essayLowConfidence",
      attempts: "essayAttempts",
      gradedAt: "essayGradedAt",
    });
  });

  it("bốn hằng số mang đúng giá trị mà DD và ADR-0018 chốt", () => {
    // Tập band ĐÓNG (ADR-0018 D2) — SQL cố ý không lặp lại nó.
    expect(ESSAY_BANDS).toEqual([0, 0.25, 0.5, 0.75, 1]);
    // U2/AC-064: một lượt gốc + hai lượt chấm lại. Nửa TypeScript của cặp
    // lời-khai-đôi duy nhất; nửa SQL nằm trong claim_essay_grading_attempt().
    expect(ESSAY_MAX_ATTEMPTS).toBe(3);
    expect(ESSAY_MAX_POINTS).toBe(1);
    // 10 phút = 2× trần 300 s của nền tảng ⇒ không invocation nào còn sống.
    expect(ESSAY_PENDING_DEADLINE_MS).toBe(600_000);
  });
});

// ═══════════════════ 2. newEssayEntry() — hình dạng lúc insert ═══════════════

describe("newEssayEntry() — năm khoá lúc insert, không hơn không kém", () => {
  it("phát đúng năm khoá với đúng giá trị và đúng kiểu", () => {
    expect(newEssayEntry()).toEqual({
      essayState: "pending",
      essayEarned: null,
      essayMax: null,
      essayLowConfidence: false,
      essayAttempts: 0,
    });
  });

  it("KHÔNG phát essayGradedAt lúc insert (dấu thời gian của việc chưa xảy ra)", () => {
    // Đẳng thức trên TẬP KHOÁ, không phải `not.toContain`: `not.toContain` vẫn
    // xanh khi khoá thứ sáu lọt vào dưới một tên gõ sai (`essayGradetAt`), mà
    // đó đúng là hình dạng hỏng khó thấy nhất ở đây. Một `null` ở khoá này còn
    // ngụ ý "đã chấm, không rõ lúc nào" — sai về NGHĨA, không chỉ về hình dạng.
    expect(Object.keys(newEssayEntry()).sort()).toEqual([
      "essayAttempts",
      "essayEarned",
      "essayLowConfidence",
      "essayMax",
      "essayState",
    ]);
    expect(Object.keys(newEssayEntry())).not.toContain(ESSAY_KEYS.gradedAt);
  });

  it("trả object MỚI mỗi lần gọi — hai câu tự luận không dùng chung tham chiếu", () => {
    // Một hằng số module trả về cùng object vẫn qua được `toEqual` ở trên. Chỉ
    // `not.toBe` phân biệt được, và hậu quả của bản dùng chung là thật: một
    // call site nắn tại chỗ sẽ đổi luôn phần tử của câu bên cạnh.
    expect(newEssayEntry()).not.toBe(newEssayEntry());
  });
});

// ══════════ 3. EG-BE-023 — biên hạn chờ LOẠI TRỪ, đủ ba ca ══════════════════

describe("deriveEssayView() — biên hạn chờ là loại trừ (EG-BE-023)", () => {
  it("deadline − 1s ⇒ vẫn pending", () => {
    const view = deriveEssayView(
      pendingElement("q1"),
      CREATED_AT,
      at(ESSAY_PENDING_DEADLINE_MS - 1_000),
    );
    expect(view?.state).toBe("pending");
  });

  it("ĐÚNG BẰNG deadline ⇒ vẫn pending (đây là ca mà >= sẽ lật)", () => {
    // Ca quyết định. Với `>=` nó trả "failed" trong khi hai ca kia vẫn xanh.
    const view = deriveEssayView(pendingElement("q1"), CREATED_AT, at(ESSAY_PENDING_DEADLINE_MS));
    expect(view?.state).toBe("pending");
  });

  it("deadline + 1s ⇒ failed (suy ra lúc đọc, không có writer nào)", () => {
    const view = deriveEssayView(
      pendingElement("q1"),
      CREATED_AT,
      at(ESSAY_PENDING_DEADLINE_MS + 1_000),
    );
    expect(view?.state).toBe("failed");
  });

  it("giá trị LƯU vẫn là pending — phép suy diễn không ghi gì (I6, ADR #8)", () => {
    const row = pendingElement("q1");
    deriveEssayView(row, CREATED_AT, at(ESSAY_PENDING_DEADLINE_MS + 60_000));
    // Không sweeper, không cleanup-on-next-login: một bản dump SQL sau lượt đọc
    // này PHẢI vẫn thấy 'pending'. Nếu hàm suy diễn nắn row tại chỗ thì đường
    // ghi duy nhất của repo không còn là hai hàm SQL nữa.
    expect(row.essayState).toBe("pending");
    expect(row.essayAttempts).toBe(0);
  });

  it("createdAt không parse được ⇒ coi như now, giữ pending (an toàn)", () => {
    const view = deriveEssayView(pendingElement("q1"), "không-phải-ngày", FRESH);
    // Hướng an toàn là GIỮ pending: kết luận "thất bại" từ một dấu thời gian
    // không đọc được là dựng một trạng thái cuối trên dữ liệu rác.
    expect(view?.state).toBe("pending");
  });
});

// ═══════════ 4. RS-0…RS-6 — từng dòng của bảng ánh xạ trong DD ══════════════

describe("deriveEssayView() — bảy trạng thái render", () => {
  it("RS-2 Pending: chưa tới hạn ⇒ pending, không band, không chấm lại", () => {
    expect(deriveEssayView(pendingElement("q1"), CREATED_AT, FRESH)).toEqual({
      state: "pending",
      earned: null,
      max: null,
      lowConfidence: false,
      retryAvailable: false,
    });
  });

  it("RS-3 Graded: band + cờ tin cậy đi qua, không chấm lại", () => {
    expect(deriveEssayView(gradedElement("q1", 0.75, true), CREATED_AT, FRESH)).toEqual({
      state: "graded",
      earned: 0.75,
      max: 1,
      lowConfidence: true,
      retryAvailable: false,
    });
  });

  it("RS-3 hấp thụ hạn chờ: graded quá 10 phút vẫn là graded", () => {
    // Hạn chờ CHỈ áp cho 'pending'. Một `now - createdAt > deadline` áp cho mọi
    // trạng thái sẽ biến mọi lượt thi cũ thành "chấm thất bại" khi mở lại.
    const view = deriveEssayView(
      gradedElement("q1", 1),
      CREATED_AT,
      at(ESSAY_PENDING_DEADLINE_MS * 10),
    );
    expect(view).toMatchObject({ state: "graded", earned: 1, retryAvailable: false });
  });

  it("RS-4 Failed còn lượt: essayAttempts < 3 ⇒ retryAvailable true", () => {
    expect(deriveEssayView(failedElement("q1", 1), CREATED_AT, FRESH)).toEqual({
      state: "failed",
      earned: null,
      max: null,
      lowConfidence: false,
      retryAvailable: true,
    });
  });

  it("RS-5 Stuck-pending còn lượt: pending quá hạn ⇒ failed nhưng chấm lại được", () => {
    const view = deriveEssayView(pendingElement("q1", 1), CREATED_AT, OVERDUE);
    expect(view).toEqual({
      state: "failed",
      earned: null,
      max: null,
      lowConfidence: false,
      retryAvailable: true,
    });
  });

  it("RS-5 hết lượt: pending quá hạn với 3 lượt đã tiêu ⇒ không chấm lại được", () => {
    // Hai đường vào RS-6 phải hội tụ về CÙNG một hình dạng, nếu không
    // isEssayIncomplete() sẽ nói dối ở đúng một trong hai đường.
    const view = deriveEssayView(pendingElement("q1", ESSAY_MAX_ATTEMPTS), CREATED_AT, OVERDUE);
    expect(view).toMatchObject({ state: "failed", retryAvailable: false });
  });

  it("RS-6 Exhausted: failed với 3 lượt đã tiêu ⇒ trạng thái cuối vĩnh viễn", () => {
    expect(
      deriveEssayView(failedElement("q1", ESSAY_MAX_ATTEMPTS), CREATED_AT, FRESH),
    ).toMatchObject({ state: "failed", retryAvailable: false });
  });

  it("essayAttempts vượt 3 (dữ liệu lệch) vẫn là hết lượt, không quay vòng", () => {
    expect(deriveEssayView(failedElement("q1", 9), CREATED_AT, FRESH)?.retryAvailable).toBe(false);
  });
});

// ═════ 5. EG-BE-024 / EG-BE-025 — khoá vắng mặt và giá trị lạ ═══════════════

describe("deriveEssayView() — dòng cũ và giá trị lạ", () => {
  it("EG-BE-024: khoá essayState VẮNG MẶT ⇒ null, và KHÔNG log", () => {
    expect(deriveEssayView(legacyElement("q1"), CREATED_AT, FRESH)).toBeNull();
    // Chế độ hỏng thật: một lượt thi cũ 40 câu sinh 40 dòng cảnh báo MỖI LƯỢT
    // RENDER, và log server thành vô dụng đúng lúc cần đọc nó.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("EG-BE-025: giá trị lạ ⇒ null + ĐÚNG MỘT console.warn", () => {
    expect(deriveEssayView(element("q1", { essayState: "grading" }), CREATED_AT, FRESH)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("EG-BE-025: cảnh báo mang DUY NHẤT questionId và giá trị lạ", () => {
    deriveEssayView(element("q42", { essayState: "grading" }), CREATED_AT, FRESH);

    const payload = warnSpy.mock.calls[0].find(
      (arg): arg is Record<string, unknown> => typeof arg === "object" && arg !== null,
    );
    // Đẳng thức vét cạn trên TẬP KHOÁ của payload: `toMatchObject` vẫn xanh kể
    // cả khi cả `row` được nhét vào cạnh hai trường này — mà đó chính là hình
    // dạng hỏng AC-056 tồn tại để chặn.
    expect(Object.keys(payload ?? {}).sort()).toEqual(["essayState", "questionId"]);
    expect(payload).toEqual({ questionId: "q42", essayState: "grading" });
  });

  it("EG-BE-025: bài làm của học sinh KHÔNG BAO GIỜ vào log", () => {
    deriveEssayView(element("q1", { essayState: "grading" }), CREATED_AT, FRESH);

    // Kiểm trên TOÀN BỘ đối số đã serialize, không chỉ trên payload đã bóc ở ca
    // trên: một `console.warn(...JSON.stringify(row))` nhét bài làm vào CHUỖI
    // chứ không vào object, và ca trên sẽ không thấy.
    const serialised = JSON.stringify(warnSpy.mock.calls);
    expect(serialised).not.toContain(STUDENT_ANSWER);
    expect(serialised).not.toContain("Nguyễn Trãi");
  });

  it("essayState = null (jsonb null) là giá trị LẠ, không phải khoá vắng mặt", () => {
    // Khoá có mặt mang null nghĩa là một writer đã ghi hỏng — im lặng ở đây sẽ
    // xoá đúng tín hiệu cần để tìm ra writer đó.
    expect(deriveEssayView(element("q1", { essayState: null }), CREATED_AT, FRESH)).toBeNull();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});

// ══════ 6. EG-BE-026 — số lượt KHÔNG băng qua biên, theo CẤU TRÚC ═══════════

describe("EssayView — không mang số lượt dưới bất kỳ tên nào (EG-BE-026/MSA-2)", () => {
  it("đúng năm trường, và retryAvailable là boolean thật", () => {
    const view = deriveEssayView(failedElement("q1", 2), CREATED_AT, FRESH);

    expect(Object.keys(view ?? {}).sort()).toEqual([
      "earned",
      "lowConfidence",
      "max",
      "retryAvailable",
      "state",
    ]);
    expect(typeof view?.retryAvailable).toBe("boolean");
  });

  it("không trường nào mang con số lượt, kể cả dưới một tên khác", () => {
    // Hai lưới, vì hai cách rò khác nhau: TÊN khoá (`attempts`, `retriesLeft`)
    // và GIÁ TRỊ (một trường tên vô hại mang đúng con số). Fixture đặt
    // `essayAttempts: 2`, nên 2 là con số phải không xuất hiện ở đâu cả.
    const view = deriveEssayView(failedElement("q1", 2), CREATED_AT, FRESH);

    expect(
      Object.keys(view ?? {}).filter((key) => /attempt|retr(y|ies)|remain|count|left/i.test(key)),
    ).toEqual(["retryAvailable"]);
    expect(Object.values(view ?? {})).not.toContain(2);
  });
});

// ═══════ 7. EG-BE-027 — chỉ graded đóng góp, vào CẢ HAI vế ══════════════════

/** Fixture dùng chung cho ca cộng dồn và ca đẳng thức EG-BE-034 — cùng mảng,
 *  cùng `createdAt`, đúng như EG-BE-034 đòi ("trên cùng đầu vào"). */
const MIXED_ROWS: StoredElement[] = [
  gradedElement("g1", 0.5),
  gradedElement("g2", 1),
  pendingElement("p1"),
  failedElement("f1", 1),
  failedElement("f2", ESSAY_MAX_ATTEMPTS),
  pendingElement("s1"),
  legacyElement("legacy"),
];

// ═══════ 7b. AC-059 (sửa lại ở B1) — hai vế điểm là THANG CỦA ĐỀ ════════════
//
// Trước B1, dòng tự luận in tổng BAND trên `số câu đã chấm × 1`. Với đề CÓ
// TRỌNG SỐ điều đó nói sai: một bài NLVH 5 điểm được band 0.25 hiện "0.25 / 1
// điểm" trong khi nó đóng góp 1.25 điểm vào ô điểm lớn ngay bên trên. Bộ này
// canh cả nhánh mới lẫn nhánh lui về, vì nhánh lui về mới là thứ giữ AC-012.

/** Phần tử tự luận ĐÃ CHẤM, có kèm KÊNH ĐIỂM của B1. */
function weightedGradedElement(
  questionId: string,
  band: number,
  maxPoints: number,
): StoredElement {
  return {
    ...gradedElement(questionId, band),
    earnedPoints: band * maxPoints,
    maxPoints,
  } as StoredElement;
}

describe("summariseEssays() — AC-059: thang điểm của ĐỀ, không phải thang band", () => {
  it("đề Văn có trọng số: cộng theo điểm thật, không theo band", () => {
    // NLXH 2 điểm band 0.5 ⇒ 1.0đ; NLVH 5 điểm band 0.25 ⇒ 1.25đ.
    // Thang band cũ sẽ cho "0.75 / 2 điểm" — sai cả hai vế.
    const rows: StoredElement[] = [
      weightedGradedElement("nlxh", 0.5, 2),
      weightedGradedElement("nlvh", 0.25, 5),
    ];
    const summary = summariseEssays(rows, CREATED_AT, FRESH);
    expect(summary?.earned).toBeCloseTo(2.25, 10);
    expect(summary?.max).toBe(7);
    expect(summary?.gradedCount).toBe(2);
  });

  it("dòng CŨ (không mang maxPoints) vẫn đọc ra thang band — AC-012", () => {
    // Đây là nhánh giữ cho một lượt thi ghi TRƯỚC B1 không đổi một con số nào.
    const summary = summariseEssays(
      [gradedElement("g1", 0.5), gradedElement("g2", 1)],
      CREATED_AT,
      FRESH,
    );
    expect(summary?.earned).toBe(1.5);
    expect(summary?.max).toBe(2);
  });

  it("trộn dòng cũ và dòng mới: mỗi dòng tính theo thang của CHÍNH nó", () => {
    // Ca này chỉ xảy ra nếu backfill chạy dở, nhưng nó phải cộng được chứ không
    // được ném hay trả NaN.
    const summary = summariseEssays(
      [gradedElement("cu", 0.5), weightedGradedElement("moi", 0.5, 4)],
      CREATED_AT,
      FRESH,
    );
    expect(summary?.earned).toBe(2.5); // 0.5 (band) + 2.0 (0.5 × 4)
    expect(summary?.max).toBe(5); // 1 (band) + 4
  });

  it("câu CHƯA graded không vào mẫu số dù mang maxPoints — AC-015", () => {
    // `record_essay_grade()` áp cùng quy tắc lúc tính lại `total_score`. Ba chỗ
    // (SQL, script backfill, dòng hiển thị này) phải nói một chuyện.
    const rows: StoredElement[] = [
      weightedGradedElement("g", 1, 3),
      { ...pendingElement("p"), earnedPoints: 0, maxPoints: 5 } as StoredElement,
      { ...failedElement("f", 1), earnedPoints: 0, maxPoints: 2 } as StoredElement,
    ];
    const summary = summariseEssays(rows, CREATED_AT, FRESH);
    expect(summary?.earned).toBe(3);
    expect(summary?.max).toBe(3);
  });
});

describe("summariseEssays() — chỉ graded vào earned VÀ max (EG-BE-027)", () => {
  it("cộng dồn đúng trên fixture trộn, ở mốc CHƯA quá hạn", () => {
    expect(summariseEssays(MIXED_ROWS, CREATED_AT, FRESH)).toEqual({
      earned: 1.5,
      // 2 câu graded × ESSAY_MAX_POINTS. KHÔNG phải 6: đây chính là con số mà
      // "failed đóng góp 0 vào earned và 1 vào max" (số 0 im lặng AC-015 cấm)
      // làm sai, và nó sai ở vế MẪU SỐ chứ không ở vế tử số — nên một test chỉ
      // kiểm `earned` sẽ xanh suốt.
      max: 2,
      gradedCount: 2,
      pendingCount: 2,
      failedCount: 2,
      unresolvedCount: 3,
    });
  });

  it("cộng dồn không đổi khi hai câu pending trôi qua hạn chờ", () => {
    // earned/max/gradedCount BẤT BIẾN theo thời gian; chỉ ba bộ đếm vòng đời
    // dịch chuyển. Một cài đặt cộng `pending` vào mẫu số sẽ làm điểm tự luận
    // của cùng một lượt thi đổi giá trị chỉ vì học sinh mở lại trang muộn hơn.
    expect(summariseEssays(MIXED_ROWS, CREATED_AT, OVERDUE)).toEqual({
      earned: 1.5,
      max: 2,
      gradedCount: 2,
      pendingCount: 0,
      failedCount: 4,
      unresolvedCount: 3,
    });
  });

  it("câu không chấm được / dòng cũ đóng góp 0 vào cả hai vế", () => {
    expect(
      summariseEssays([gradedElement("g1", 1), legacyElement("l1"), legacyElement("l2")], CREATED_AT, FRESH),
    ).toEqual({
      earned: 1,
      max: 1,
      gradedCount: 1,
      pendingCount: 0,
      failedCount: 0,
      unresolvedCount: 0,
    });
  });

  it("undefined khi KHÔNG phần tử nào mang essayState (AC-012)", () => {
    // `undefined`, không phải một summary rỗng: getResult() của một dòng cũ
    // KHÔNG được mọc thêm trường nào có giá trị.
    expect(summariseEssays([legacyElement("q1"), legacyElement("q2")], CREATED_AT, FRESH)).toBeUndefined();
    expect(summariseEssays([], CREATED_AT, FRESH)).toBeUndefined();
  });
});

// ═══════ 8. EG-BE-034 — hai lối tính một sự thật, ghim bằng đẳng thức ═══════

describe("hasUnresolvedEssay / hasIncompleteEssay (EG-BE-034/O-8)", () => {
  it("đẳng thức EG-BE-034 đúng trên cùng fixture, ở mọi mốc thời gian", () => {
    // Chế độ hỏng: hai phép suy diễn độc lập bất đồng ở ca RỖNG — `some()` trả
    // false còn `summary?.unresolvedCount` là undefined, và `undefined > 0` là
    // false chỉ vì JavaScript, không vì ai đã nghĩ tới ca đó.
    const cases: { rows: StoredElement[]; now: Date }[] = [
      { rows: MIXED_ROWS, now: FRESH },
      { rows: MIXED_ROWS, now: OVERDUE },
      { rows: [legacyElement("q1")], now: FRESH },
      { rows: [], now: FRESH },
      { rows: [failedElement("q1", ESSAY_MAX_ATTEMPTS)], now: FRESH },
    ];

    for (const { rows, now } of cases) {
      expect(hasUnresolvedEssay(rows, CREATED_AT, now)).toBe(
        (summariseEssays(rows, CREATED_AT, now)?.unresolvedCount ?? 0) > 0,
      );
    }
  });

  it("LUÔN là boolean, không bao giờ undefined — kể cả mảng rỗng và dòng cũ", () => {
    expect(hasUnresolvedEssay([], CREATED_AT, FRESH)).toBe(false);
    expect(hasIncompleteEssay([], CREATED_AT, FRESH)).toBe(false);
    expect(hasIncompleteEssay([legacyElement("q1")], CREATED_AT, FRESH)).toBe(false);
  });

  it("hasIncompleteEssay chỉ true khi có câu ở RS-6 (điều kiện in PDF, O-8)", () => {
    expect(hasIncompleteEssay([failedElement("q1", 1)], CREATED_AT, FRESH)).toBe(false);
    expect(hasIncompleteEssay([failedElement("q1", ESSAY_MAX_ATTEMPTS)], CREATED_AT, FRESH)).toBe(true);
    // Đường vào RS-6 thứ hai: pending quá hạn đã tiêu hết ba lượt.
    expect(hasIncompleteEssay([pendingElement("q1", ESSAY_MAX_ATTEMPTS)], CREATED_AT, OVERDUE)).toBe(true);
  });

  it("hasUnresolvedEssay KHÔNG bị RS-6 kích hoạt — chốt PDF không vĩnh viễn", () => {
    // AC-058 chặn xuất PDF khi còn câu CHƯA giải quyết. RS-6 là trạng thái
    // CUỐI: nếu nó tính là unresolved thì nút xuất PDF tắt vĩnh viễn.
    expect(hasUnresolvedEssay([failedElement("q1", ESSAY_MAX_ATTEMPTS)], CREATED_AT, FRESH)).toBe(false);
  });
});

// ═══════ 9. Hai vị từ mức-câu: rời nhau theo cấu trúc ═══════════════════════

describe("isEssayUnresolved / isEssayIncomplete — rời nhau, phủ hết", () => {
  const views: Record<string, EssayView> = {
    "RS-2 pending": { state: "pending", earned: null, max: null, lowConfidence: false, retryAvailable: false },
    "RS-3 graded": { state: "graded", earned: 0.5, max: 1, lowConfidence: false, retryAvailable: false },
    "RS-4/5 failed còn lượt": { state: "failed", earned: null, max: null, lowConfidence: false, retryAvailable: true },
    "RS-6 hết lượt": { state: "failed", earned: null, max: null, lowConfidence: false, retryAvailable: false },
  };

  it("không view nào thoả CẢ HAI vị từ", () => {
    for (const view of Object.values(views)) {
      expect(isEssayUnresolved(view) && isEssayIncomplete(view)).toBe(false);
    }
  });

  it("unresolved = RS-2 + RS-4/5 còn lượt; incomplete = RS-6", () => {
    expect(Object.keys(views).filter((key) => isEssayUnresolved(views[key]))).toEqual([
      "RS-2 pending",
      "RS-4/5 failed còn lượt",
    ]);
    expect(Object.keys(views).filter((key) => isEssayIncomplete(views[key]))).toEqual(["RS-6 hết lượt"]);
  });
});

// ═══════════════ 10. Hai phép quét mã nguồn (EG-BE-036 + literal) ═══════════

const SOURCE_ROOT = process.cwd();
const MODULE_PATH = "lib/scoring/essayLifecycle.ts";

/** Bỏ dòng chú thích để phép quét đếm chỗ VIẾT, không đếm chỗ NHẮC TỚI — cùng
 *  hàm mà `geminiChokepoint.test.ts` dùng cho phép quét điểm phát. */
function codeLines(source: string): string[] {
  return source.split("\n").filter((line) => {
    const trimmed = line.trim();
    return !(trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*"));
  });
}

const SOURCE_FILE = /\.(?:[cm]?tsx?|[cm]?jsx?)$/;
/** Test KHÔNG nằm trên đường đi của request; chế độ hỏng mà EG-BE-036 nêu tên
 *  ("một trang tự suy lại RS-6") sống trong mã ship, không trong test. */
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

/** Đọc cây MỘT lần: tám phép quét dưới đây dùng chung kết quả. */
const SCANNED_FILES: { rel: string; code: string }[] = walk(SOURCE_ROOT).map((full) => ({
  rel: path.relative(SOURCE_ROOT, full).split(path.sep).join("/"),
  code: codeLines(readFileSync(full, "utf8")).join("\n"),
}));

function filesMatching(pattern: RegExp): string[] {
  return SCANNED_FILES.filter(({ code }) => pattern.test(code))
    .map(({ rel }) => rel)
    .sort();
}

describe("phép quét mã nguồn — một lời khai, một chỗ suy diễn", () => {
  it("EG-BE-036: biểu thức RS-6 chỉ xuất hiện ở essayLifecycle.ts", () => {
    // Regex chịu được TIỀN TỐ NGƯỜI NHẬN (`view.state === "failed" &&
    // !view.retryAvailable`), nên một consumer không né được phép quét chỉ bằng
    // cách đặt tên biến. `toEqual` vét cạn: một file thứ hai làm dòng này đỏ.
    expect(
      filesMatching(/(?:\w+\.)?state\s*===\s*"failed"\s*&&\s*!\s*(?:\w+\.)?retryAvailable/),
    ).toEqual([MODULE_PATH]);
  });

  it("sáu literal khoá jsonb chỉ được gõ ở essayLifecycle.ts", () => {
    // Chế độ hỏng mà RS-0…RS-6 nêu tên: một bản sao GÕ TAY của một chuỗi khoá ở
    // đâu đó trong cây. Quét từng chuỗi riêng để thông báo lỗi nói ĐÚNG khoá
    // nào bị chép, thay vì "một trong sáu khoá".
    for (const key of Object.values(ESSAY_KEYS)) {
      expect(filesMatching(new RegExp(`["'\`]${key}["'\`]`))).toEqual([MODULE_PATH]);
    }
  });

  it("ESSAY_BANDS được KHAI đúng một chỗ (ADR-0018 D2)", () => {
    expect(filesMatching(/(?:const|let|var)\s+ESSAY_BANDS\b/)).toEqual([MODULE_PATH]);
  });

  it("module là THUẦN: không server-only, không process.env, không đồng hồ ẩn", () => {
    const source = SCANNED_FILES.find(({ rel }) => rel === MODULE_PATH)?.code ?? "";
    expect(source).not.toBe("");
    expect(source).not.toMatch(/server-only|process\.env|createClient|fetch\(/);
    // Đây là thứ giữ ba ca biên hạn chờ khỏi thành ba quả bom hẹn giờ: đồng hồ
    // là THAM SỐ. Một `Date.now()` hay `new Date()` không đối số ở đây làm mọi
    // ca trên xanh hôm nay và đỏ vào một ngày không ai đụng tới file này.
    expect(source).not.toMatch(/Date\.now\s*\(|new Date\s*\(\s*\)/);
  });
});
