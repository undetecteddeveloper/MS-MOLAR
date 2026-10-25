// computeWrongTwiceQuestionIds() [unit]
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0) — nửa backend của UI Spec D1
//   ("hasBeenWrongTwice được tính phía server trong getResult()...")
// Sinh ngày: 2026-08-08 | Chuyển từ skeleton: 2026-08-14 (backend task 09,
//   Red -> Green trong một commit, quy ước của repo này)
//
// KHÔNG thuộc ngân sách làn integration/fixture-e2e/service-integration-e2e —
// là độ phủ unit do Design Doc bắt buộc (Implementation Path Mapping của backend DD:
// "SOURCE/lib/scoring/__tests__/wrongTwice.test.ts", "Cross-attempt aggregation
// correctness"), được chọn làm hợp đồng xuyên tầng bắt buộc: CHÍNH hàm này
// là nguồn sự thật duy nhất mà cả getResult() (chặn hiển thị) lẫn
// explainStep() (kiểm lại phía server, ranh giới bảo mật thật) gọi
// — một lỗi ở đây là một lỗi ở hai nơi gọi cùng lúc.
//
// Ranh giới mock (Test Boundaries của backend DD): computeWrongTwiceQuestionIds() — Không,
//   cài đặt thật, unit test hàm thuần trực tiếp (không có I/O để mock).
// Hợp đồng đang kiểm (backend DD § Data Contracts):
//   computeWrongTwiceQuestionIds(attempts: {attemptId, perQuestion}[]): Set<string>
//   — questionId được chấm sai (scored !== false && isCorrect === false) trên
//   >=2 attemptId KHÁC NHAU, xuyên mọi lượt làm của một người dùng gồm cả lượt
//   đang xem.

import { describe, expect, it } from "vitest";

import { computeWrongTwiceQuestionIds } from "../wrongTwice";
import type { WrongTwiceAttempt } from "../wrongTwice";

// =============================================================================
// Test 1 — ngưỡng >=2-lượt-làm-khác-nhau xuyên lượt làm
// =============================================================================
// AC (D1, nửa backend): "...chỉ true khi chính hàng hiện tại có
//   scored !== false && isCorrect === false và câu hỏi đã được chấm
//   sai trên >=2 lượt làm đã nộp khác nhau của cùng người dùng (xuyên các đề)."
// ROI: 64 (BV:8 x Freq:7 + Legal:0 + Defect:8)
// Hành vi: một fixture literal 3 lượt làm trong đó questionId "Q1" được chấm sai
//   ở lượt 1 và 2, đúng ở lượt 3 -> computeWrongTwiceQuestionIds()
//   trả về một Set chứa "Q1"; một questionId sai chỉ ở 1 lượt trong
//   cùng fixture bị loại.
// @category: core-functionality
// @lane: unit
// @dependency: không có (hàm thuần; fixture attempt/perQuestion literal)
// @complexity: medium
// @real-dependency: N/A
// Kiểu hỏng chính: hàm đếm các LẦN XUẤT HIỆN sai trong một danh sách đã làm phẳng
//   (ví dụ một hàng trùng bên trong mảng perQuestion của chính một lượt làm) thay vì
//   attemptId KHÁC NHAU, gom thừa một câu chỉ từng làm một lần; hoặc
//   nó coi "sai ở đúng 1 lượt" là đã thoả ">=2" (lệch một đơn vị).
// Nghĩa vụ chứng minh: fixture literal 3 lượt làm (tự soạn độc lập, không
//   suy ra từ đầu ra computeScore() nào) — khẳng định Set trả về toEqual
//   (new Set(["Q1"])) CHÍNH XÁC (không chỉ toContain — chứng minh không có questionId nào khác
//   lọt vào), và một câu fixture song song sai ở đúng 1 lượt
//   chắc chắn vắng trong Set trả về.
describe("computeWrongTwiceQuestionIds — cross-attempt >=2-distinct-attempts threshold (Test 1)", () => {
  // Ba lượt làm, soạn tay (không do computeScore() tạo ra):
  //   Q1 — sai ở lượt-1 VÀ lượt-2, đúng ở lượt-3  -> đủ điều kiện.
  //   Q2 — sai HAI LẦN chỉ trong lượt-1 (một hàng trùng trong mảng riêng của
  //        một lượt làm), không bao giờ sai ở lượt thứ hai  -> không được đủ điều kiện.
  //   Q3 — sai ở đúng 1 lượt (mẫu dò lệch-một ">=2")  -> không được đủ điều kiện.
  const THREE_ATTEMPTS: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-1",
      perQuestion: [
        { questionId: "Q1", selected: "A", isCorrect: false, scored: true },
        { questionId: "Q2", selected: "B", isCorrect: false, scored: true },
        { questionId: "Q2", selected: "C", isCorrect: false, scored: true },
        { questionId: "Q3", selected: "D", isCorrect: false, scored: true },
      ],
    },
    {
      attemptId: "attempt-2",
      perQuestion: [
        { questionId: "Q1", selected: "B", isCorrect: false, scored: true },
        { questionId: "Q3", selected: "A", isCorrect: true, scored: true },
      ],
    },
    {
      attemptId: "attempt-3",
      perQuestion: [{ questionId: "Q1", selected: "A", isCorrect: true, scored: true }],
    },
  ];

  it("should return exactly the questions wrong on >=2 distinct attempts when a fixture mixes 2-attempt, same-attempt-duplicate and 1-attempt wrongs", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    // toEqual trên cả Set (không phải toContain): chứng minh không có questionId nào khác lọt vào.
    expect(wrongTwice).toEqual(new Set(["Q1"]));
  });

  it("should exclude a question wrong on exactly 1 attempt (>=2 is not satisfied by 1)", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    expect(wrongTwice.has("Q3")).toBe(false);
  });

  it("should count DISTINCT attemptIds, not wrong occurrences, when one attempt lists the same question wrong twice", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(THREE_ATTEMPTS);

    // Q2 sai hai lần, nhưng cả hai lần sai thuộc lượt-1 — 1 lượt làm khác nhau.
    expect(wrongTwice.has("Q2")).toBe(false);
  });
});

// =============================================================================
// Test 2 — loại trừ scored:false + tương đương quy ước "undefined = đã chấm"
// =============================================================================
// Không có số AC riêng — Bất biến nêu thẳng trong backend DD § Data
//   Contracts: "'scored !== false' phản chiếu đúng quy ước isScored()
//   của chính computeScore.ts (undefined = đã chấm)."
// ROI: 60 (BV:7 x Freq:7 + Legal:0 + Defect:8)
// Hành vi: một hàng perQuestion có scored: false và isCorrect: false, sai ở 2
//   lượt làm, KHÔNG được đếm. Một hàng song song với scored bị bỏ hẳn
//   (undefined) và isCorrect: false, sai ở 2 lượt làm, ĐƯỢC đếm.
//   Vì sao các hàng tự luận rơi về phía bị loại, nêu chính xác vì ADR-0018
//   đổi lý do chứ không đổi kết quả: một hàng tự luận là `scored: false` — band
//   được ghi bởi đường bất đồng bộ, ngoài computeScore(), và hàng vẫn
//   nằm ngoài mẫu số điểm. Nó vẫn không bao giờ đủ điều kiện wrong-twice,
//   nhưng vì `isCorrect` là vị từ NHỊ PHÂN mà một band không trả lời được, KHÔNG PHẢI vì
//   bài tự luận không được chấm.
// @category: edge-case
// @lane: unit
// @dependency: không có
// @complexity: low
// @real-dependency: N/A
// Kiểu hỏng chính: vị từ bị viết là `scored === true` thay vì
//   `scored !== false`, lặng lẽ loại mọi câu mà trường scored chưa bao giờ
//   được đặt tường minh là true — phá sự tương đương với quy ước isScored()
//   của chính computeScore.ts mà hàm này phải phản chiếu (Code Inspection
//   Evidence: computeScore.ts:36-42).
// Nghĩa vụ chứng minh: hai fixture literal song song (một scored:false, một
//   scored:undefined/bỏ hẳn), cả hai còn lại giống hệt và sai ở 2 lượt làm
//   khác nhau — khẳng định id của câu scored:false vắng trong Set trả về
//   và id của câu scored:undefined có mặt.
describe("computeWrongTwiceQuestionIds — scored:false exclusion and scored:undefined inclusion (Test 2)", () => {
  // Hai câu, giống hệt nhau ở mọi mặt trừ trường `scored`, cùng
  // sai ở CÙNG 2 lượt làm khác nhau:
  //   Q-ESSAY  — scored: false          (không bao giờ đủ điều kiện: không có isCorrect nhị phân)
  //   Q-LEGACY — `scored` omitted       (row cũ trước v2.1: undefined = scored)
  const PARALLEL_SCORED_FIXTURES: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-1",
      perQuestion: [
        { questionId: "Q-ESSAY", selected: "bài làm", isCorrect: false, scored: false },
        { questionId: "Q-LEGACY", selected: "bài làm", isCorrect: false },
      ],
    },
    {
      attemptId: "attempt-2",
      perQuestion: [
        { questionId: "Q-ESSAY", selected: "bài làm", isCorrect: false, scored: false },
        { questionId: "Q-LEGACY", selected: "bài làm", isCorrect: false },
      ],
    },
  ];

  it("should exclude a scored:false question even when it is wrong on 2 distinct attempts", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(PARALLEL_SCORED_FIXTURES);

    expect(wrongTwice.has("Q-ESSAY")).toBe(false);
  });

  it("should include a question whose scored field is omitted (undefined = scored, mirroring computeScore.ts)", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(PARALLEL_SCORED_FIXTURES);

    expect(wrongTwice.has("Q-LEGACY")).toBe(true);
    // Khẳng định trên cả Set: hàng scored:false không đóng góp gì cả.
    expect(wrongTwice).toEqual(new Set(["Q-LEGACY"]));
  });
});

// =============================================================================
// Test 3 — danh tính câu hỏi xuyên đề (toàn cục, không theo từng đề)
// =============================================================================
// Không có số AC riêng — Bất biến của backend DD § Data Contracts: "Xuyên ĐỀ:
//   một câu hỏi dùng chung bởi question_id của hai đề khác nhau vẫn tính vào
//   cùng ngưỡng (danh tính câu hỏi là toàn cục, theo cách đặt vấn đề của PRD A4)."
// ROI: 56 (BV:7 x Freq:6 + Legal:0 + Defect:8)
// Hành vi: cùng một questionId xuất hiện ở lượt làm của hai đề khác nhau — sai
//   ở một lượt thuộc đề X và một lượt thuộc đề Y -> hai lần sai đó vẫn
//   tính vào cùng ngưỡng >=2-lượt-làm-khác-nhau.
// @category: edge-case
// @lane: unit
// @dependency: không có
// @complexity: low
// @real-dependency: N/A
// Kiểu hỏng chính (đã sửa — cách viết gốc của skeleton nêu một kiểu hỏng
//   mà hàm này không thể có): phân phạm vi theo từng đề là KHÔNG BIỂU DIỄN ĐƯỢC ở đây.
//   WrongTwiceAttempt không mang định danh đề nào, nên không phép đột biến nào của wrongTwice.ts
//   nhóm theo đề được; test này chỉ hỏng được nếu phép gộp thôi
//   khoá theo questionId. Rủi ro phân phạm vi theo đề/theo lượt làm thật nằm
//   ở một tầng trên, trong hình dạng truy vấn của NƠI GỌI — một `.eq()` thu hẹp lượt đọc
//   lịch sử xuống dưới "mọi lượt làm của người dùng này" — và được phủ bởi nghĩa vụ (f)
//   của features/exams/__tests__/getResult.int.test.ts. Test này được giữ như
//   tài liệu chạy được rằng hợp đồng là toàn cục theo cấu trúc.
// Nghĩa vụ chứng minh: một fixture literal 2 lượt làm từ hai lượt làm thuộc
//   hai ngữ cảnh đề khác nhau, chia sẻ một questionId, cả hai sai -> khẳng định
//   questionId đó có mặt trong Set trả về.
describe("computeWrongTwiceQuestionIds — cross-exam (global) question identity (Test 3)", () => {
  // Kiểu đầu vào của hợp đồng cố ý KHÔNG mang định danh đề — chính sự vắng mặt đó
  // là lý do phép gộp mang tính toàn cục. Hai đề được mô hình hoá ở đây bằng hai
  // lượt làm có tập câu hỏi rời nhau trừ Q-SHARED:
  //   attempt-exam-X: Q-X-ONLY + Q-SHARED (cả hai sai)
  //   attempt-exam-Y: Q-Y-ONLY + Q-SHARED (cả hai sai)
  const TWO_EXAMS: WrongTwiceAttempt[] = [
    {
      attemptId: "attempt-exam-X",
      perQuestion: [
        { questionId: "Q-X-ONLY", selected: "A", isCorrect: false, scored: true },
        { questionId: "Q-SHARED", selected: "A", isCorrect: false, scored: true },
      ],
    },
    {
      attemptId: "attempt-exam-Y",
      perQuestion: [
        { questionId: "Q-Y-ONLY", selected: "C", isCorrect: false, scored: true },
        { questionId: "Q-SHARED", selected: "B", isCorrect: false, scored: true },
      ],
    },
  ];

  it("should count a question shared by two different exams' attempts toward the same >=2 threshold", () => {
    const wrongTwice = computeWrongTwiceQuestionIds(TWO_EXAMS);

    expect(wrongTwice.has("Q-SHARED")).toBe(true);
    // Mỗi câu riêng của một đề chỉ sai ở đúng một lượt làm của chính nó.
    expect(wrongTwice).toEqual(new Set(["Q-SHARED"]));
  });
});
