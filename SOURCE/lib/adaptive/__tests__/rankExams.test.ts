// rankExamIds() [unit] — PRD exam-recommendation v1.2
// AC-012/013/014/019/020/021/022/023/034/037-adjacent/038
// PRD: docs/prd/exam-recommendation-prd.md (v1.2)
// ADR: docs/adr/ADR-0015-personalised-exam-ranking-placement-and-telemetry.md
//
// Mock boundary: KHÔNG mock gì cả — rankExamIds() là hàm thuần, mọi state
// (candidates/attempts/weights) được tiêm vào theo đúng yêu cầu "no ambient
// reads" của AC-014. Cùng quy ước với route.test.ts.
//
// Khoá sắp xếp đang test (rankExams.ts):
//   [ band ASC, priorScore ASC NULLS LAST, affinity DESC, id ASC ]
//   affinity = gradeMatch * tỉ_trọng_lớp + recency * mới_cũ_chuẩn_hoá

import { describe, expect, it } from "vitest";

import { EXAM_RANK_GRADE_MATCH_WEIGHT, EXAM_RANK_RECENCY_WEIGHT } from "../constants";
import { rankExamIds, type RankAttempt, type RankExamCandidate } from "../rankExams";

const WEIGHTS = {
  gradeMatch: EXAM_RANK_GRADE_MATCH_WEIGHT,
  recency: EXAM_RANK_RECENCY_WEIGHT,
};

/** Đề: mặc định lớp 12, mốc thời gian tăng dần theo tham số cho dễ đọc. */
function exam(id: string, grade = 12, createdAt = "2026-01-01T00:00:00.000Z"): RankExamCandidate {
  return { id, grade, createdAt };
}

function attempt(
  examId: string,
  grade: number,
  submittedAt: string | null,
  totalScore: number | null
): RankAttempt {
  return { examId, grade, submittedAt, totalScore };
}

// =============================================================================
// Test 1 — AC-019: băng "chưa làm" đứng trên MỌI đề đã nộp, 0 nghịch đảo
// =============================================================================
// Primary failure mode: băng bị cài thành một số hạng có trọng số thay vì khoá
//   cứng, nên một đề đã nộp mà "hợp gu" vẫn leo lên trên một đề chưa làm —
//   đúng thứ D5 cấm.
describe("Test 1 — AC-019: băng đã-làm bị đẩy xuống dưới, không phải bị đánh trọng số", () => {
  it("mọi đề chưa làm đứng trên mọi đề đã nộp, kể cả khi đề đã nộp mới hơn và đúng lớp", () => {
    const order = rankExamIds({
      candidates: [
        // Đề đã nộp: mới nhất VÀ đúng lớp học sinh hay làm — mọi tín hiệu mềm
        // đều ủng hộ nó. Băng vẫn phải dìm nó xuống.
        exam("done-perfect", 12, "2026-06-01T00:00:00.000Z"),
        // Đề chưa làm: cũ nhất VÀ sai lớp — mọi tín hiệu mềm đều chống lại nó.
        exam("fresh-worst", 9, "2020-01-01T00:00:00.000Z"),
      ],
      attempts: [attempt("done-perfect", 12, "2026-06-02T00:00:00.000Z", 9.5)],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["fresh-worst", "done-perfect"]);
  });

  it("với nhiều đề mỗi băng, 0 đề đã nộp lọt lên trên bất kỳ đề chưa làm nào", () => {
    const candidates = [
      exam("a", 12, "2026-01-01T00:00:00.000Z"),
      exam("b", 12, "2026-02-01T00:00:00.000Z"),
      exam("c", 12, "2026-03-01T00:00:00.000Z"),
      exam("d", 12, "2026-04-01T00:00:00.000Z"),
    ];
    const order = rankExamIds({
      candidates,
      attempts: [
        attempt("a", 12, "2026-05-01T00:00:00.000Z", 2),
        attempt("c", 12, "2026-05-02T00:00:00.000Z", 8),
      ],
      weights: WEIGHTS,
    });

    const submitted = new Set(["a", "c"]);
    const lastFreshIndex = Math.max(...order.map((id, i) => (submitted.has(id) ? -1 : i)));
    const firstSubmittedIndex = Math.min(
      ...order.map((id, i) => (submitted.has(id) ? i : Number.POSITIVE_INFINITY))
    );
    expect(lastFreshIndex).toBeLessThan(firstSubmittedIndex);
  });
});

// =============================================================================
// Test 2 — AC-020: trong băng đã nộp, điểm ĐẠI DIỆN tệ hơn lên trước
// =============================================================================
// Primary failure mode (chính là lỗ hổng review I003 đã bắt): "điểm cũ" không
//   xác định được khi một đề bị làm nhiều lần, nên ba luật loại trừ nhau
//   (latest/best/worst) đều pass cùng một test mà cho ba thứ tự production khác
//   nhau. Fixture thứ hai dưới đây tồn tại để ghim đúng luật đã chọn: LẦN NỘP
//   GẦN NHẤT.
describe("Test 2 — AC-020: thứ tự trong băng đã nộp theo điểm đại diện", () => {
  it("mỗi đề một lượt: điểm tệ hơn lên trước", () => {
    const order = rankExamIds({
      candidates: [exam("good"), exam("bad")],
      attempts: [
        attempt("good", 12, "2026-05-01T00:00:00.000Z", 9),
        attempt("bad", 12, "2026-05-01T00:00:00.000Z", 3),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["bad", "good"]);
  });

  it("ba lượt khác điểm trên một đề: lượt GẦN NHẤT là đại diện — không phải tốt nhất, không phải tệ nhất", () => {
    // "retaken" từng làm rất tệ (1.0) nhưng lượt gần nhất đã 9.0 — học sinh đã
    // làm chủ được nó. "steady" luôn ở 5.0.
    //  - luật "gần nhất" (đang ship) -> steady(5.0) trước retaken(9.0)
    //  - luật "tệ nhất"              -> retaken(1.0) trước steady(5.0)   [khác]
    //  - luật "tốt nhất"             -> steady(5.0) trước retaken(9.0)   [trùng]
    // Nên bổ sung một cặp thứ hai để tách "gần nhất" khỏi "tốt nhất".
    const order = rankExamIds({
      candidates: [exam("retaken"), exam("steady")],
      attempts: [
        attempt("retaken", 12, "2026-01-01T00:00:00.000Z", 1),
        attempt("retaken", 12, "2026-03-01T00:00:00.000Z", 4),
        attempt("retaken", 12, "2026-05-01T00:00:00.000Z", 9),
        attempt("steady", 12, "2026-05-01T00:00:00.000Z", 5),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["steady", "retaken"]);
  });

  it("lượt gần nhất TỆ hơn lượt cũ: đề đó lên trước — tách 'gần nhất' khỏi 'tốt nhất'", () => {
    // "slipped" từng đạt 9.0 nhưng lượt gần nhất tụt còn 2.0.
    //  - luật "gần nhất" (đang ship) -> slipped(2.0) trước steady(5.0)
    //  - luật "tốt nhất"             -> steady(5.0) trước slipped(9.0)   [khác]
    const order = rankExamIds({
      candidates: [exam("slipped"), exam("steady")],
      attempts: [
        attempt("slipped", 12, "2026-01-01T00:00:00.000Z", 9),
        attempt("slipped", 12, "2026-05-01T00:00:00.000Z", 2),
        attempt("steady", 12, "2026-05-01T00:00:00.000Z", 5),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["slipped", "steady"]);
  });
});

// =============================================================================
// Test 3 — AC-038: lượt đã nộp KHÔNG có dòng exam_results
// =============================================================================
// Primary failure mode: coi thiếu điểm là 0 điểm, tức bịa ra rằng học sinh làm
//   dở nhất và đẩy đề đó lên đầu băng — hoặc tệ hơn, ném lỗi / loại đề khỏi
//   danh sách. Cả hai đều là suy diễn từ chỗ không có dữ liệu.
describe("Test 3 — AC-038: đề đã nộp nhưng thiếu dòng kết quả", () => {
  it("vẫn nằm trong băng đã nộp, xuống CUỐI băng, không bị coi là 0 điểm", () => {
    const order = rankExamIds({
      candidates: [exam("fresh"), exam("scored-bad"), exam("no-result"), exam("scored-good")],
      attempts: [
        attempt("scored-bad", 12, "2026-05-01T00:00:00.000Z", 2),
        attempt("no-result", 12, "2026-05-01T00:00:00.000Z", null),
        attempt("scored-good", 12, "2026-05-01T00:00:00.000Z", 8),
      ],
      weights: WEIGHTS,
    });

    // Nếu null bị coi là 0 thì "no-result" đã đứng đầu băng, trước scored-bad.
    expect(order).toEqual(["fresh", "scored-bad", "scored-good", "no-result"]);
  });

  it("0 đề bị loại: đếm vào = đếm ra (AC-021)", () => {
    const candidates = [exam("a"), exam("b"), exam("c")];
    const order = rankExamIds({
      candidates,
      attempts: [attempt("b", 12, null, null)],
      weights: WEIGHTS,
    });

    expect(order).toHaveLength(candidates.length);
    expect([...order].sort()).toEqual(["a", "b", "c"]);
  });
});

// =============================================================================
// Test 4 — tín hiệu lớp: tỉ trọng, và trần ảnh hưởng của tín hiệu mới-cũ
// =============================================================================
// Primary failure mode: trọng số mới-cũ đặt quá cao nên một đề mới tinh SAI lớp
//   vượt được một đề cũ ĐÚNG lớp — làm tín hiệu cá nhân hoá duy nhất của v1 trở
//   nên vô nghĩa mà không có gì trên màn hình để lộ ra.
describe("Test 4 — khớp lớp đè lên mới-cũ", () => {
  it("đề cũ ĐÚNG lớp thắng đề mới nhất SAI lớp", () => {
    const order = rankExamIds({
      candidates: [
        exam("new-wrong-grade", 9, "2026-12-01T00:00:00.000Z"),
        exam("old-right-grade", 12, "2020-01-01T00:00:00.000Z"),
      ],
      attempts: [attempt("history", 12, "2026-05-01T00:00:00.000Z", 7)],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["old-right-grade", "new-wrong-grade"]);
  });

  it("cùng lớp thì mới-cũ quyết định — mới hơn lên trước", () => {
    const order = rankExamIds({
      candidates: [
        exam("older", 12, "2026-01-01T00:00:00.000Z"),
        exam("newer", 12, "2026-06-01T00:00:00.000Z"),
      ],
      attempts: [attempt("history", 12, "2026-05-01T00:00:00.000Z", 7)],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["newer", "older"]);
  });

  it("tỉ trọng chứ không phải cờ nhị phân: lớp học sinh làm NHIỀU hơn xếp trên", () => {
    // 3 lượt lớp 12, 1 lượt lớp 9 -> tỉ trọng 0.75 vs 0.25, chênh 0.5 > 0.25 nên
    // mới-cũ không lật được, dù đề lớp 9 mới hơn.
    const order = rankExamIds({
      candidates: [
        exam("g9", 9, "2026-06-01T00:00:00.000Z"),
        exam("g12", 12, "2026-01-01T00:00:00.000Z"),
      ],
      attempts: [
        attempt("h1", 12, "2026-05-01T00:00:00.000Z", 7),
        attempt("h2", 12, "2026-05-02T00:00:00.000Z", 7),
        attempt("h3", 12, "2026-05-03T00:00:00.000Z", 7),
        attempt("h4", 9, "2026-05-04T00:00:00.000Z", 7),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["g12", "g9"]);
  });
});

// =============================================================================
// Test 5 — AC-022/023/034: cold start — thứ tự XÁC ĐỊNH, và không đoán lớp
// =============================================================================
// Primary failure mode: mặc định học sinh mới về lớp 12 (hoặc Toán) — kiểu
//   sai-mà-tự-tin mà Engine 1 R-a đã ghi lại một lần. Từ đầu ra thì "vắng mặt"
//   và "bằng 0" nhìn giống hệt nhau, nên test dưới đây dựng fixture mà HAI
//   nhánh đó cho hai thứ tự KHÁC nhau (I010).
describe("Test 5 — cold start: mới-cũ rồi tới id, và tuyệt đối không đoán lớp", () => {
  it("0 lượt làm bài: toàn bộ kho đề vẫn ra, xếp theo mới-cũ rồi id", () => {
    const order = rankExamIds({
      candidates: [
        exam("old", 9, "2026-01-01T00:00:00.000Z"),
        exam("newest", 9, "2026-03-01T00:00:00.000Z"),
        exam("middle", 12, "2026-02-01T00:00:00.000Z"),
      ],
      attempts: [],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["newest", "middle", "old"]);
  });

  it("KHÔNG mặc định lớp 12: một đề lớp 12 cũ hơn vẫn thua đề lớp 9 mới hơn", () => {
    // Nếu cold start bị gán ngầm "lớp 12" thì g12 được +1.0 affinity và sẽ đứng
    // đầu. Thứ tự đúng là thuần mới-cũ.
    const order = rankExamIds({
      candidates: [
        exam("g12-old", 12, "2026-01-01T00:00:00.000Z"),
        exam("g9-new", 9, "2026-06-01T00:00:00.000Z"),
      ],
      attempts: [],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["g9-new", "g12-old"]);
  });

  it("cold start KHÔNG được miễn trừ tính tất định (AC-023)", () => {
    const input = {
      candidates: [exam("a", 12, "2026-01-01T00:00:00.000Z"), exam("b", 9, "2026-01-01T00:00:00.000Z")],
      attempts: [],
      weights: WEIGHTS,
    };
    expect(rankExamIds(input)).toEqual(rankExamIds(input));
  });
});

// =============================================================================
// Test 6 — AC-012/013: tất định, tie-break theo id, và mẫu số 0 không ra NaN
// =============================================================================
// Primary failure mode: mẫu số 0 (mọi đề cùng mốc thời gian) cho NaN; NaN so
//   sánh kiểu gì cũng false nên thứ tự rơi về vị trí ban đầu của mảng — đúng
//   lỗi mà route.ts:67-74 đã ghi lại một lần.
describe("Test 6 — tất định tuyệt đối", () => {
  it("100 lần chạy trên cùng state cho thứ tự giống hệt nhau, từng phần tử", () => {
    const input = {
      candidates: [
        exam("e3", 12, "2026-03-01T00:00:00.000Z"),
        exam("e1", 9, "2026-01-01T00:00:00.000Z"),
        exam("e2", 12, "2026-02-01T00:00:00.000Z"),
      ],
      attempts: [
        attempt("e1", 9, "2026-04-01T00:00:00.000Z", 4),
        attempt("h", 12, "2026-04-02T00:00:00.000Z", 6),
      ],
      weights: WEIGHTS,
    };

    const first = rankExamIds(input);
    for (let i = 0; i < 100; i += 1) {
      expect(rankExamIds(input)).toEqual(first);
    }
  });

  it("trùng mọi khoá thì tie-break theo id tăng dần, KHÔNG theo vị trí trong mảng", () => {
    const candidates = [
      exam("zeta", 12, "2026-01-01T00:00:00.000Z"),
      exam("alpha", 12, "2026-01-01T00:00:00.000Z"),
      exam("mid", 12, "2026-01-01T00:00:00.000Z"),
    ];

    expect(rankExamIds({ candidates, attempts: [], weights: WEIGHTS })).toEqual([
      "alpha",
      "mid",
      "zeta",
    ]);
    // Đảo thứ tự đầu vào phải cho CÙNG kết quả — nếu mẫu số 0 ra NaN thì không.
    expect(rankExamIds({ candidates: [...candidates].reverse(), attempts: [], weights: WEIGHTS })).toEqual(
      ["alpha", "mid", "zeta"]
    );
  });

  it("không sửa mảng đầu vào của caller", () => {
    const candidates = [exam("b"), exam("a")];
    const snapshot = candidates.map((c) => c.id);
    rankExamIds({ candidates, attempts: [], weights: WEIGHTS });
    expect(candidates.map((c) => c.id)).toEqual(snapshot);
  });

  it("kho đề rỗng trả mảng rỗng, không ném lỗi", () => {
    expect(rankExamIds({ candidates: [], attempts: [], weights: WEIGHTS })).toEqual([]);
  });

  it("mốc thời gian không parse được vẫn ra danh sách đầy đủ, tất định", () => {
    const input = {
      candidates: [exam("bad", 12, "not-a-date"), exam("good", 12, "2026-01-01T00:00:00.000Z")],
      attempts: [],
      weights: WEIGHTS,
    };
    const order = rankExamIds(input);
    expect([...order].sort()).toEqual(["bad", "good"]);
    expect(rankExamIds(input)).toEqual(order);
  });
});
