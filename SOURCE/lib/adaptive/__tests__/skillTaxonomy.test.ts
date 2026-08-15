// skillTaxonomy [unit] — AC-001/002/003/004
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// Nội dung DAG: docs/plans/analysis/engine1-math-skill-dag-draft.md (đã duyệt)
//
// File này KHÔNG có skeleton sinh sẵn (backend-task-04): các assertion được
// viết thẳng từ AC-001..AC-004, mỗi AC một khối độc lập chứ không gộp chung.
//
// Hai lớp kiểm tra, cố ý tách:
//   (a) validateDag() có THỰC SỰ bắt lỗi không — chứng bằng fixture literal cố
//       tình sai (chu trình / cạnh treo). Không có lớp này thì một validateDag()
//       luôn trả `valid: true` vẫn làm mọi assertion AC-001/002 dưới đây xanh.
//   (b) dữ liệu curriculum THẬT (SKILL_NODES/SKILL_PREREQUISITES) thoả AC.

import { describe, expect, it } from "vitest";

import {
  SKILL_NODES,
  SKILL_PREREQUISITES,
  validateDag,
  type SkillNode,
  type SkillPrerequisiteEdge,
} from "../skillTaxonomy";

// Ít nhất một ký tự có dấu tiếng Việt (bao gồm cả đ/Đ). Đây là cách bắt được
// nhãn bị bỏ quên ở dạng tiếng Anh/placeholder ("Logarithms", "TODO") — mọi
// nhãn trong bản DAG đã duyệt đều có dấu, nên phép thử này không vacuous.
const HAS_VIETNAMESE_DIACRITIC =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỹỴĐ]/;

describe("validateDag() — bắt được lỗi thật (điều kiện cần để AC-001/002 có nghĩa)", () => {
  it("báo cạnh treo khi prerequisite trỏ tới node không tồn tại (AC-002, mặt trái)", () => {
    const nodes: SkillNode[] = [{ id: "a", labelVi: "A" }];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "a", prerequisiteNodeId: "khong-ton-tai" },
    ];

    const result = validateDag(nodes, edges);

    expect(result.valid).toBe(false);
    expect(result.danglingEdges).toEqual([
      { skillNodeId: "a", prerequisiteNodeId: "khong-ton-tai" },
    ]);
  });

  it("báo cạnh treo khi CHÍNH skillNodeId không tồn tại", () => {
    const nodes: SkillNode[] = [{ id: "a", labelVi: "A" }];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "khong-ton-tai", prerequisiteNodeId: "a" },
    ];

    expect(validateDag(nodes, edges).valid).toBe(false);
  });

  it("báo chu trình 2 node (AC-001, mặt trái)", () => {
    const nodes: SkillNode[] = [
      { id: "a", labelVi: "A" },
      { id: "b", labelVi: "B" },
    ];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "a", prerequisiteNodeId: "b" },
      { skillNodeId: "b", prerequisiteNodeId: "a" },
    ];

    const result = validateDag(nodes, edges);

    expect(result.valid).toBe(false);
    expect(result.cycleNodeIds.sort()).toEqual(["a", "b"]);
  });

  it("báo chu trình dài 3 node (không chỉ bắt được self-loop/2 node)", () => {
    const nodes: SkillNode[] = [
      { id: "a", labelVi: "A" },
      { id: "b", labelVi: "B" },
      { id: "c", labelVi: "C" },
      { id: "roi", labelVi: "Rời" },
    ];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "a", prerequisiteNodeId: "b" },
      { skillNodeId: "b", prerequisiteNodeId: "c" },
      { skillNodeId: "c", prerequisiteNodeId: "a" },
    ];

    const result = validateDag(nodes, edges);

    expect(result.valid).toBe(false);
    expect(result.cycleNodeIds.sort()).toEqual(["a", "b", "c"]);
  });

  it("chấp nhận DAG hợp lệ có node đa cha (multi-parent, không phải cây)", () => {
    const nodes: SkillNode[] = [
      { id: "goc", labelVi: "Gốc" },
      { id: "trai", labelVi: "Trái" },
      { id: "phai", labelVi: "Phải" },
      { id: "chung", labelVi: "Chung" },
    ];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "trai", prerequisiteNodeId: "goc" },
      { skillNodeId: "phai", prerequisiteNodeId: "goc" },
      { skillNodeId: "chung", prerequisiteNodeId: "trai" },
      { skillNodeId: "chung", prerequisiteNodeId: "phai" },
    ];

    expect(validateDag(nodes, edges)).toEqual({
      valid: true,
      cycleNodeIds: [],
      danglingEdges: [],
    });
  });
});

describe("AC-001 — cây kỹ năng đã ship có 0 chu trình", () => {
  it("validateDag() trên dữ liệu THẬT không báo chu trình", () => {
    expect(validateDag(SKILL_NODES, SKILL_PREREQUISITES).cycleNodeIds).toEqual([]);
  });
});

describe("AC-002 — 100% cạnh tiên quyết trỏ tới node tồn tại (0 cạnh treo)", () => {
  it("validateDag() trên dữ liệu THẬT không báo cạnh treo", () => {
    expect(validateDag(SKILL_NODES, SKILL_PREREQUISITES).danglingEdges).toEqual([]);
  });

  it("mọi id trong SKILL_PREREQUISITES đều nằm trong SKILL_NODES (kiểm độc lập với validateDag)", () => {
    const ids = new Set(SKILL_NODES.map((n) => n.id));
    const unknown = SKILL_PREREQUISITES.flatMap((e) =>
      [e.skillNodeId, e.prerequisiteNodeId].filter((id) => !ids.has(id)),
    );

    expect(unknown).toEqual([]);
  });

  it("không có cạnh tự tham chiếu (ràng buộc skill_prerequisites_no_self_check của schema)", () => {
    const selfEdges = SKILL_PREREQUISITES.filter(
      (e) => e.skillNodeId === e.prerequisiteNodeId,
    );

    expect(selfEdges).toEqual([]);
  });
});

describe("AC-003 — số node nằm trong khoảng 15–25 của corpus hiện có", () => {
  it("SKILL_NODES.length trong [15, 25]", () => {
    expect(SKILL_NODES.length).toBeGreaterThanOrEqual(15);
    expect(SKILL_NODES.length).toBeLessThanOrEqual(25);
  });

  it("đúng 20 node như bản draft đã duyệt (bắt trường hợp mã hoá làm rơi/nhân đôi node)", () => {
    // 20 = con số chốt ở docs/plans/analysis/engine1-math-skill-dag-draft.md.
    // Khoảng [15,25] ở trên là AC-003; dòng này bắt sai lệch so với nội dung
    // engineer đã duyệt — sửa DAG thì phải sửa cả draft lẫn số này, có chủ ý.
    expect(SKILL_NODES.length).toBe(20);
  });

  it("id node là duy nhất", () => {
    expect(new Set(SKILL_NODES.map((n) => n.id)).size).toBe(SKILL_NODES.length);
  });

  it("id node là slug ổn định (chữ thường ASCII, số, gạch ngang) — dùng làm khoá chính skill_nodes.id", () => {
    const badIds = SKILL_NODES.map((n) => n.id).filter((id) => !/^[a-z0-9-]+$/.test(id));

    expect(badIds).toEqual([]);
  });
});

describe("AC-004 — mọi node có nhãn tiếng Việt hiển thị được cho học sinh", () => {
  it("labelVi không rỗng ở mọi node", () => {
    const empty = SKILL_NODES.filter((n) => n.labelVi.trim().length === 0).map((n) => n.id);

    expect(empty).toEqual([]);
  });

  it("labelVi có dấu tiếng Việt ở mọi node (bắt nhãn còn để tiếng Anh/placeholder)", () => {
    const withoutDiacritic = SKILL_NODES.filter(
      (n) => !HAS_VIETNAMESE_DIACRITIC.test(n.labelVi),
    ).map((n) => n.id);

    expect(withoutDiacritic).toEqual([]);
  });
});
