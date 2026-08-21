// recommendNextSkill() [unit] — AC-014/015/016/017/028
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0)
//
// Skeleton gốc (sinh 2026-08-08) đã được chuyển thành test thật ở
// backend-task-07; các chú thích Behavior/Primary-failure-mode/Proof-obligation
// của skeleton được giữ lại ngay trên từng khối tương ứng.
//
// Mock boundary: KHÔNG mock gì cả — recommendNextSkill() là hàm thuần, toàn bộ
// state (nodes/edges/mastery/threshold) được tiêm vào theo đúng yêu cầu "no
// ambient reads" của AC-016.
// Test data: fixture DAG literal, tự viết độc lập — KHÔNG dùng nội dung
// curriculum thật (đó là deliverable nội dung, không phải deliverable test).
//
// Thuật toán đang test (backend DD § Data Contracts, recommendNextSkill()):
//   1. mastery.length === 0 -> return null (AC-028)
//   2. ratio(nodeId) = có dòng mastery ? correctCount/totalCount : 0
//   3. isCleared(nodeId) = mọi cạnh (nodeId -> prereq) có ratio(prereq) >= threshold
//   4. sortKey(node) = [ratio ASC, lastWrongAt DESC NULLS LAST, id ASC]  (AC-015/016)
//   5-8. đi từ node yếu nhất xuống các tiên quyết chưa đạt cho tới khi cleared
//   9. reasonCode = substituted ? "prerequisite-gate" : (tie-by-recency ? "recently-wrong" : "lowest-mastery")

import { describe, expect, it } from "vitest";

import { recommendNextSkill, type RouteInput } from "../route";

const THRESHOLD = 0.7;

// =============================================================================
// Test 1 — AC-014/AC-017: prerequisite-gate substitution trả về tiên quyết chưa
// đạt, không bao giờ trả node yếu nhất mà chính nó đang bị chặn
// =============================================================================
// Primary failure mode: bước 8 (walk) thiếu hoặc short-circuit, nên hàm trả
//   thẳng node yếu nhất ("A") dù tiên quyết của nó ("B") còn dưới ngưỡng —
//   âm thầm gợi ý một kỹ năng học sinh chưa thể học được.
describe("Test 1 — AC-014/AC-017: cổng tiên quyết", () => {
  it("trả về tiên quyết chưa đạt ('B'), không phải node yếu nhất bị chặn ('A')", () => {
    const input: RouteInput = {
      nodes: [
        { id: "A", labelVi: "Kỹ năng A" },
        { id: "B", labelVi: "Kỹ năng B" },
        { id: "C", labelVi: "Kỹ năng C" },
      ],
      edges: [{ skillNodeId: "A", prerequisiteNodeId: "B" }],
      mastery: [
        // A yếu nhất theo ratio thô (0.1), nhưng B (0.5) vẫn dưới ngưỡng 0.7.
        { skillNodeId: "A", correctCount: 1, totalCount: 10, lastWrongAt: null },
        { skillNodeId: "B", correctCount: 5, totalCount: 10, lastWrongAt: null },
        { skillNodeId: "C", correctCount: 9, totalCount: 10, lastWrongAt: null },
      ],
      threshold: THRESHOLD,
    };

    expect(recommendNextSkill(input)).toEqual({
      nodeId: "B",
      labelVi: "Kỹ năng B",
      reasonCode: "prerequisite-gate",
    });
  });

  it("mọi tiên quyết của node ĐƯỢC TRẢ VỀ đều đạt ngưỡng (bất biến AC-014, tính độc lập)", () => {
    const input: RouteInput = {
      nodes: [
        { id: "nen", labelVi: "Nền" },
        { id: "giua", labelVi: "Giữa" },
        { id: "ngon", labelVi: "Ngọn" },
      ],
      edges: [
        { skillNodeId: "giua", prerequisiteNodeId: "nen" },
        { skillNodeId: "ngon", prerequisiteNodeId: "giua" },
      ],
      mastery: [
        { skillNodeId: "nen", correctCount: 9, totalCount: 10, lastWrongAt: null },
        { skillNodeId: "giua", correctCount: 8, totalCount: 10, lastWrongAt: null },
        { skillNodeId: "ngon", correctCount: 5, totalCount: 10, lastWrongAt: null },
      ],
      threshold: THRESHOLD,
    };

    const result = recommendNextSkill(input);
    expect(result).not.toBeNull();

    // Tính lại điều kiện AC-014 từ fixture, KHÔNG hỏi lại hàm đang test.
    const ratioOf = (id: string) => {
      const row = input.mastery.find((m) => m.skillNodeId === id);
      return row ? row.correctCount / row.totalCount : 0;
    };
    const prereqs = input.edges
      .filter((e) => e.skillNodeId === result?.nodeId)
      .map((e) => e.prerequisiteNodeId);

    for (const p of prereqs) expect(ratioOf(p)).toBeGreaterThanOrEqual(THRESHOLD);
  });
});

// =============================================================================
// Test 2 — AC-015/AC-016: tie-break theo recency + tất định qua nhiều lần gọi
// =============================================================================
// Primary failure mode: cặp ratio bằng nhau được phá bằng thứ tự mảng hoặc
//   object identity thay vì lastWrongAt; HOẶC hàm đọc Date.now()/state ngoài
//   nên hai lần gọi cùng đầu vào ra kết quả khác nhau.
describe("Test 2 — AC-015/AC-016: recency tie-break + tất định", () => {
  const makeInput = (): RouteInput => ({
    nodes: [
      { id: "cu", labelVi: "Sai lâu rồi" },
      { id: "moi", labelVi: "Sai gần đây" },
      { id: "gioi", labelVi: "Đã vững" },
    ],
    edges: [],
    mastery: [
      // "cu" và "moi" cùng ratio 0.5 — chỉ lastWrongAt phân biệt được.
      { skillNodeId: "cu", correctCount: 5, totalCount: 10, lastWrongAt: "2026-01-01T00:00:00Z" },
      { skillNodeId: "moi", correctCount: 5, totalCount: 10, lastWrongAt: "2026-08-01T00:00:00Z" },
      { skillNodeId: "gioi", correctCount: 9, totalCount: 10, lastWrongAt: null },
    ],
    threshold: THRESHOLD,
  });

  it("chọn node sai GẦN ĐÂY hơn khi ratio bằng nhau, reasonCode 'recently-wrong'", () => {
    expect(recommendNextSkill(makeInput())).toEqual({
      nodeId: "moi",
      labelVi: "Sai gần đây",
      reasonCode: "recently-wrong",
    });
  });

  it("thứ tự mảng nodes/mastery không đổi được kết quả", () => {
    const base = makeInput();
    const reversed: RouteInput = {
      ...base,
      nodes: [...base.nodes].reverse(),
      mastery: [...base.mastery].reverse(),
    };

    expect(recommendNextSkill(reversed)?.nodeId).toBe("moi");
  });

  it("hai lần gọi với hai object literal khác reference nhưng cùng giá trị → deep-equal", () => {
    expect(recommendNextSkill(makeInput())).toEqual(recommendNextSkill(makeInput()));
  });

  it("không sửa đổi tại chỗ nodes/edges/mastery", () => {
    const input = makeInput();
    const snapshot = JSON.stringify(input);

    recommendNextSkill(input);

    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

// =============================================================================
// Test 3 — AC-028: cold start thật sự trả null, không bịa ra gợi ý
// =============================================================================
// Primary failure mode: hàm rơi vào quy tắc "vắng mặt trong mastery = ratio 0"
//   rồi trả về MỘT node nào đó cho người dùng chưa có dữ liệu nào — một gợi ý
//   bịa ra, trái hẳn với "say less when it knows less" của PRD.
describe("Test 3 — AC-028: cold start", () => {
  it("mastery rỗng trên DAG KHÔNG tầm thường → strictly null", () => {
    const input: RouteInput = {
      nodes: [
        { id: "a", labelVi: "A" },
        { id: "b", labelVi: "B" },
        { id: "c", labelVi: "C" },
      ],
      edges: [
        { skillNodeId: "b", prerequisiteNodeId: "a" },
        { skillNodeId: "c", prerequisiteNodeId: "b" },
      ],
      mastery: [],
      threshold: THRESHOLD,
    };

    // Dùng DAG không rỗng có chủ ý: chứng nhánh null đến từ phép kiểm
    // "mastery.length === 0" (bước 1), không phải tác dụng phụ của đồ thị rỗng.
    expect(recommendNextSkill(input)).toBe(null);
  });
});

// =============================================================================
// Test 4 — Bất biến Data Contract: node vắng mặt trong mastery không gây crash
// =============================================================================
// Primary failure mode: đọc ratio của node chưa đụng tới thì ném lỗi (truy cập
//   thuộc tính trên undefined) thay vì mặc định 0; hoặc node đó bị loại khỏi
//   danh sách ứng viên thay vì được xếp là yếu nhất.
describe("Test 4 — node vắng mặt trong mastery = ratio 0", () => {
  it("không ném lỗi và chọn đúng node chưa từng đụng tới", () => {
    const input: RouteInput = {
      nodes: [
        { id: "da-lam", labelVi: "Đã làm" },
        { id: "chua-dung", labelVi: "Chưa đụng tới" },
      ],
      edges: [],
      mastery: [
        { skillNodeId: "da-lam", correctCount: 5, totalCount: 10, lastWrongAt: null },
      ],
      threshold: THRESHOLD,
    };

    expect(() => recommendNextSkill(input)).not.toThrow();
    expect(recommendNextSkill(input)).toEqual({
      nodeId: "chua-dung",
      labelVi: "Chưa đụng tới",
      reasonCode: "lowest-mastery",
    });
  });

  it("dòng mastery có totalCount 0 không tạo ra NaN ratio", () => {
    const input: RouteInput = {
      nodes: [
        { id: "khong-mau", labelVi: "Không mẫu" },
        { id: "binh-thuong", labelVi: "Bình thường" },
      ],
      edges: [],
      mastery: [
        { skillNodeId: "khong-mau", correctCount: 0, totalCount: 0, lastWrongAt: null },
        { skillNodeId: "binh-thuong", correctCount: 8, totalCount: 10, lastWrongAt: null },
      ],
      threshold: THRESHOLD,
    };

    // NaN so sánh kiểu gì cũng false, nên một ratio NaN lọt vào sort sẽ làm thứ
    // tự phụ thuộc vị trí ban đầu — hỏng đúng tính tất định của AC-016.
    expect(recommendNextSkill(input)?.nodeId).toBe("khong-mau");
  });
});
