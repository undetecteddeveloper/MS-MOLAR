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
//   affinity = gradeMatch * tỉ_trọng_lớp
//            + subjectWeakness * độ_yếu_môn
//            + recency * mới_cũ_chuẩn_hoá
//
// Số hạng ĐỘ YẾU MÔN thêm ở TD-028 (2026-08-31) — Test 7 và Test 8 ở cuối file
// là phần ghim của nó. Mọi ca có TRƯỚC đó dùng MỘT môn duy nhất cho cả đề lẫn
// lượt làm, nên số hạng mới bằng nhau ở mọi ứng viên và KHÔNG đổi được thứ tự
// nào: đó là lý do các kỳ vọng cũ đứng nguyên, không phải may mắn.

import { describe, expect, it } from "vitest";

import {
  EXAM_RANK_GRADE_MATCH_WEIGHT,
  EXAM_RANK_RECENCY_WEIGHT,
  EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
} from "../constants";
import { rankExamIds, type RankAttempt, type RankExamCandidate } from "../rankExams";

const WEIGHTS = {
  gradeMatch: EXAM_RANK_GRADE_MATCH_WEIGHT,
  recency: EXAM_RANK_RECENCY_WEIGHT,
  subjectWeakness: EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT,
};

/** Môn mặc định của mọi fixture cũ — xem khối đầu file. */
const DEFAULT_SUBJECT = "Math";

/** Đề: mặc định lớp 12, mốc thời gian tăng dần theo tham số cho dễ đọc. */
function exam(
  id: string,
  grade = 12,
  createdAt = "2026-01-01T00:00:00.000Z",
  subject = DEFAULT_SUBJECT
): RankExamCandidate {
  return { id, grade, subject, createdAt };
}

function attempt(
  examId: string,
  grade: number,
  submittedAt: string | null,
  totalScore: number | null,
  subject: string | null = DEFAULT_SUBJECT
): RankAttempt {
  return { examId, grade, subject, submittedAt, totalScore };
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
// =============================================================================
// Test 7 — TD-028: môn học sinh YẾU được đẩy lên đầu băng chưa-làm
// =============================================================================
// Primary failure mode: tín hiệu môn được nối vào nhưng ĐẶT SAI DẤU — "yếu" bị
//   đọc thành "giỏi", nên hệ thống chăm chỉ gợi ý đúng những môn học sinh đã
//   vững. Kiểu hỏng này KHÔNG hiện ra ở đâu cả: danh sách vẫn đủ đề, vẫn tất
//   định, chỉ vô duyên — đúng thứ TD-028 mô tả là "không có cách nào phát hiện
//   bằng số liệu".
describe("Test 7 — TD-028: điểm yếu theo môn xếp trước, trong CÙNG một lớp", () => {
  it("đề của môn điểm thấp đứng trên đề của môn điểm cao, khi mọi thứ khác bằng nhau", () => {
    const order = rankExamIds({
      candidates: [
        exam("bio-fresh", 12, "2026-01-01T00:00:00.000Z", "Biology"),
        exam("math-fresh", 12, "2026-01-01T00:00:00.000Z", "Math"),
      ],
      // Cùng lớp, cùng số lượt: chỉ ĐIỂM phân biệt hai môn. Toán 9/10 (yếu 0.1),
      // Sinh 2/10 (yếu 0.8).
      attempts: [
        attempt("math-done", 12, "2026-02-01T00:00:00.000Z", 9, "Math"),
        attempt("bio-done", 12, "2026-02-02T00:00:00.000Z", 2, "Biology"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["bio-fresh", "math-fresh"]);
  });

  it("ĐỐI CHỨNG ĐẢO DẤU: đảo hai điểm số thì đảo luôn thứ tự — không phải id, không phải thứ tự mảng", () => {
    // Cùng đúng hai ứng viên, cùng thứ tự mảng, cùng id. Chỉ hai con số điểm
    // đổi chỗ cho nhau. Nếu kỳ vọng ở ca trên được thoả bởi tie-break id
    // ("bio-fresh" < "math-fresh") thì ca này cũng ra hệt như thế và hỏng.
    const order = rankExamIds({
      candidates: [
        exam("bio-fresh", 12, "2026-01-01T00:00:00.000Z", "Biology"),
        exam("math-fresh", 12, "2026-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("math-done", 12, "2026-02-01T00:00:00.000Z", 2, "Math"),
        attempt("bio-done", 12, "2026-02-02T00:00:00.000Z", 9, "Biology"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["math-fresh", "bio-fresh"]);
  });

  it("MÔN CHƯA THỬ BAO GIỜ không được coi là yếu — nó xếp như một môn đã vững", () => {
    // "Không biết" khác "yếu". Một môn không có dòng điểm nào nhận số hạng 0, y
    // như một môn 10/10. Nhánh ngược lại — coi môn chưa thử là yếu tuyệt đối —
    // biến bộ xếp hạng thành một máy đẩy nội dung lạ lên đầu.
    const order = rankExamIds({
      candidates: [
        exam("chem-fresh", 12, "2026-01-01T00:00:00.000Z", "Chemistry"),
        exam("bio-fresh", 12, "2026-01-01T00:00:00.000Z", "Biology"),
      ],
      attempts: [attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", 3, "Biology")],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["bio-fresh", "chem-fresh"]);
  });

  it("COLD START: chưa có điểm nào thì tín hiệu môn CÂM, thứ tự vẫn là AC-022 (mới-cũ rồi id)", () => {
    const order = rankExamIds({
      candidates: [
        exam("old-bio", 12, "2026-01-01T00:00:00.000Z", "Biology"),
        exam("new-math", 12, "2026-06-01T00:00:00.000Z", "Math"),
      ],
      attempts: [],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["new-math", "old-bio"]);
  });

  it("LƯỢT ĐÃ NỘP MÀ KHÔNG CÓ ĐIỂM không bị đọc thành 0 điểm", () => {
    // `record_exam_result()` hỏng SAU khi lượt làm đã commit là chuyện xảy ra
    // thật (PRD AC-038). Đọc lượt ấy thành 0 điểm là biến một sự cố ghi dữ liệu
    // thành lời khẳng định "em này yếu Sinh". Ở đây Sinh chỉ có lượt KHÔNG
    // điểm, Toán có 2/10 — nên Toán mới là môn yếu, và đề Toán phải lên trước.
    const order = rankExamIds({
      candidates: [
        exam("bio-fresh", 12, "2026-01-01T00:00:00.000Z", "Biology"),
        exam("math-fresh", 12, "2026-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", null, "Biology"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 2, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["math-fresh", "bio-fresh"]);
  });

  it("MÔN THIẾU trên một lượt chỉ làm câm tín hiệu MÔN, không làm câm tín hiệu LỚP", () => {
    // Lượt duy nhất của học sinh không giao được môn (embed lệch hình dạng),
    // nhưng LỚP của nó thì có. Tỉ trọng lớp phải vẫn chạy: đề lớp 9 lên trước
    // đề lớp 12, dù đề lớp 12 mới hơn.
    const order = rankExamIds({
      candidates: [
        exam("g12-new", 12, "2026-06-01T00:00:00.000Z", "Math"),
        exam("g9-old", 9, "2026-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [attempt("done", 9, "2026-02-01T00:00:00.000Z", 3, null)],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["g9-old", "g12-new"]);
  });

  it("MỘT ĐỀ LÀM LẠI NĂM LẦN không đè bẹp trung bình của môn", () => {
    // Trung bình tính trên lượt ĐẠI DIỆN (nộp gần nhất mỗi đề), đúng định nghĩa
    // `priorScore` đã dùng. Ở đây Toán có MỘT đề bị làm lại 5 lần với điểm rất
    // thấp ở các lượt cũ nhưng 10/10 ở lượt gần nhất; Sinh có một đề 4/10.
    // Đếm cả 5 lượt thì Toán thành môn yếu nhất và đề Toán sẽ leo lên đầu.
    const order = rankExamIds({
      candidates: [
        exam("bio-fresh", 12, "2026-01-01T00:00:00.000Z", "Biology"),
        exam("math-fresh", 12, "2026-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("math-done", 12, "2026-02-01T00:00:00.000Z", 0, "Math"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 1, "Math"),
        attempt("math-done", 12, "2026-02-03T00:00:00.000Z", 0, "Math"),
        attempt("math-done", 12, "2026-02-04T00:00:00.000Z", 2, "Math"),
        attempt("math-done", 12, "2026-02-05T00:00:00.000Z", 10, "Math"),
        attempt("bio-done", 12, "2026-02-06T00:00:00.000Z", 4, "Biology"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["bio-fresh", "math-fresh"]);
  });
});

// =============================================================================
// Test 8 — TD-028: hai tính chất số học mà trọng số 0.5 được CHỌN để có
// =============================================================================
// Primary failure mode: ai đó chỉnh EXAM_RANK_SUBJECT_WEAKNESS_WEIGHT theo cảm
//   giác ("cho nó mạnh hơn tí"), và hai tính chất dưới đây im lặng mất hiệu
//   lực. Chúng là lý do con số là 0.5 chứ không phải một số khác, nên chúng
//   phải hỏng ồn ào khi con số đổi — các ca dưới ghim CHÍNH hằng số đang ship,
//   không phải một bộ trọng số bịa riêng cho test.
describe("Test 8 — trật tự giữa ba số hạng của affinity", () => {
  it("LỚP ĐÈ MÔN: đề SAI lớp của môn yếu nhất vẫn đứng dưới đề ĐÚNG lớp của môn đã vững", () => {
    // Học sinh chỉ làm bài lớp 12 nên tỉ trọng lớp là 1.0 / 0. Cận trên của đề
    // sai lớp là 0 + 0.5 + 0.25 = 0.75; cận dưới của đề đúng lớp là 1.0. Đẩy
    // nội dung sai lớp lên đầu tệ hơn hẳn việc gợi ý một môn đã vững.
    const order = rankExamIds({
      candidates: [
        // sai lớp, môn yếu tuyệt đối, VÀ mới nhất — mọi tín hiệu mềm ủng hộ nó
        exam("g8-bio-new", 8, "2026-06-01T00:00:00.000Z", "Biology"),
        // đúng lớp, môn đã vững, và cũ nhất
        exam("g12-math-old", 12, "2020-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", 0, "Biology"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 10, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["g12-math-old", "g8-bio-new"]);
  });

  it("MÔN ĐÈ MỚI-CŨ khi điểm yếu là THẬT: môn 0 điểm thắng lợi thế mới nhất", () => {
    const order = rankExamIds({
      candidates: [
        exam("bio-oldest", 12, "2020-01-01T00:00:00.000Z", "Biology"),
        exam("math-newest", 12, "2026-06-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", 0, "Biology"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 10, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["bio-oldest", "math-newest"]);
  });

  it("MỚI-CŨ ĐÈ MÔN khi điểm yếu chỉ hơi hơi: chênh 0.4 điểm không lật được đề mới nhất", () => {
    // Sinh 8.0/10 (số hạng 0.5 × 0.2 = 0.10), Toán 8.4/10 (0.5 × 0.16 = 0.08).
    // Chênh 0.02 nhỏ hơn 0.25 của mới-cũ nên đề mới hơn thắng. Đây là nửa còn
    // lại của tính chất: tín hiệu môn KHÔNG được phép là một khoá cứng trá hình.
    const order = rankExamIds({
      candidates: [
        exam("bio-oldest", 12, "2020-01-01T00:00:00.000Z", "Biology"),
        exam("math-newest", 12, "2026-06-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", 8, "Biology"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 8.4, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["math-newest", "bio-oldest"]);
  });

  it("BĂNG VẪN LÀ KHOÁ CỨNG: đề ĐÃ LÀM của môn yếu nhất vẫn nằm dưới MỌI đề chưa làm", () => {
    // TD-028 kê việc xét lại `band` như một việc RIÊNG và bản này cố ý không
    // làm. Ca này ghim quyết định đó, nên một lần "cải tiến" âm thầm cho phép
    // đề đã làm vượt lên sẽ hỏng ở đây chứ không hỏng ở màn hình người dùng.
    const order = rankExamIds({
      candidates: [
        exam("bio-done", 12, "2026-06-01T00:00:00.000Z", "Biology"),
        exam("math-fresh", 8, "2020-01-01T00:00:00.000Z", "Math"),
      ],
      attempts: [
        attempt("bio-done", 12, "2026-02-01T00:00:00.000Z", 0, "Biology"),
        attempt("math-done", 12, "2026-02-02T00:00:00.000Z", 10, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toEqual(["math-fresh", "bio-done"]);
  });

  it("ĐIỂM NGOÀI THANG bị kẹp, không sinh ra số hạng âm", () => {
    // Một dòng `total_score` lớn hơn 10 (dữ liệu hỏng, hoặc thang điểm đổi mà
    // chỗ này chưa đổi theo) cho `1 − mean/10` âm. Không kẹp thì môn ấy tụt
    // xuống DƯỚI cả môn không có tín hiệu gì — một dòng lạ đổi thứ tự theo cách
    // không ai giải thích được. Kẹp về 0 nghĩa là nó xếp ngang một môn đã vững,
    // tức ngang với "chưa thử".
    const order = rankExamIds({
      candidates: [
        exam("bad-fresh", 12, "2026-01-01T00:00:00.000Z", "Bad"),
        exam("chem-fresh", 12, "2026-01-01T00:00:00.000Z", "Chemistry"),
      ],
      attempts: [attempt("bad-done", 12, "2026-02-01T00:00:00.000Z", 99, "Bad")],
      weights: WEIGHTS,
    });

    // Cả hai số hạng môn bằng 0 nên mọi khoá bằng nhau, tie-break id tăng dần.
    expect(order).toEqual(["bad-fresh", "chem-fresh"]);
  });

  it("BẤT BIẾN ĐẾM VÀO = ĐẾM RA giữ nguyên với tín hiệu mới (AC-021)", () => {
    const candidates = [
      exam("a", 12, "2026-01-01T00:00:00.000Z", "Math"),
      exam("b", 9, "2026-02-01T00:00:00.000Z", "Biology"),
      exam("c", 12, "2026-03-01T00:00:00.000Z", "Chemistry"),
      exam("d", 11, "2026-04-01T00:00:00.000Z", "Physics"),
    ];
    const order = rankExamIds({
      candidates,
      attempts: [
        attempt("b", 9, "2026-05-01T00:00:00.000Z", 1, "Biology"),
        attempt("z", 12, "2026-05-02T00:00:00.000Z", 7, "Math"),
      ],
      weights: WEIGHTS,
    });

    expect(order).toHaveLength(candidates.length);
    expect([...order].sort()).toEqual(["a", "b", "c", "d"]);
  });
});
