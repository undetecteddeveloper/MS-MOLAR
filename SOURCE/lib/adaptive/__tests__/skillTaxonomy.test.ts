// skillTaxonomy [unit] — AC-001/002/003/004, mở rộng cho 7 môn (2026-09-16).
// PRD: docs/prd/engine1-adaptive-ai-prd.md (v1.0)
// Design Doc: docs/design/engine1-adaptive-ai-backend-design.md (v1.0)
// Nội dung DAG: docs/plans/analysis/engine1-<môn>-skill-dag-draft.md
//
// Ba lớp kiểm tra, cố ý tách:
//   (a) validateDag() có THỰC SỰ bắt lỗi không — chứng bằng fixture literal cố
//       tình sai (chu trình / cạnh treo). Không có lớp này thì một validateDag()
//       luôn trả `valid: true` vẫn làm mọi assertion AC-001/002 dưới đây xanh.
//   (b) dữ liệu curriculum THẬT (SKILL_NODES/SKILL_PREREQUISITES) thoả AC, cho
//       từng môn và cho bản gộp — bản gộp là thứ seedSkillTaxonomy.ts ghi.
//   (c) bản mã hoá khớp bản draft mà người duyệt đọc: id/cạnh trong file .md
//       của mỗi môn phải bằng đúng tập id/cạnh trong code. Thiếu lớp này thì
//       "sửa code phải sửa draft" chỉ là lời hứa.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { SUBJECT_ORDER, type Subject } from "@/lib/analytics/constants";
import {
  SKILL_ID_PREFIX,
  SKILL_NODES,
  SKILL_PREREQUISITES,
  SKILL_TAXONOMY,
  skillEdgesForSubject,
  skillNodesForSubject,
  subjectOfSkillNodeId,
  validateDag,
  type SkillNode,
  type SkillPrerequisiteEdge,
} from "../skillTaxonomy";

// Ít nhất một ký tự có dấu tiếng Việt (bao gồm cả đ/Đ). Đây là cách bắt được
// nhãn bị bỏ quên ở dạng tiếng Anh/placeholder ("Logarithms", "TODO") — mọi
// nhãn trong các bản DAG đều có dấu, nên phép thử này không vacuous. Với Hoá,
// danh pháp IUPAC ("Ester", "Polymer") là tiếng Anh theo CT 2018, nên nhãn
// phải kèm phần giải thích tiếng Việt để qua được cổng này — có chủ ý.
const HAS_VIETNAMESE_DIACRITIC =
  /[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđÀÁẢÃẠĂẰẮẲẴẶÂẦẤẨẪẬÈÉẺẼẸÊỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌÔỒỐỔỖỘƠỜỚỞỠỢÙÚỦŨỤƯỪỨỬỮỰỲÝỶỹỴĐ]/;

/**
 * Số node chốt theo từng draft đã rà (2026-09-16). Khoảng [15,25] của AC-003
 * chỉ áp cho Toán (corpus lúc viết AC); các môn khác chia theo corpus THẬT của
 * chúng — Văn 6 và Sử 10 cố ý thô (7 và 0 câu trên prod). Sửa DAG thì phải sửa
 * cả draft lẫn số này, có chủ ý.
 */
const EXPECTED_NODE_COUNT: Record<Subject, number> = {
  Math: 20,
  Physics: 15,
  Chemistry: 15,
  Biology: 16,
  Literature: 6,
  English: 9,
  History: 10,
};

const EXPECTED_EDGE_COUNT: Record<Subject, number> = {
  Math: 15,
  Physics: 10,
  Chemistry: 12,
  Biology: 9,
  Literature: 0,
  English: 3,
  History: 0,
};

describe("validateDag() — bắt được lỗi thật (điều kiện cần để AC-001/002 có nghĩa)", () => {
  it("báo cạnh treo khi prerequisite trỏ tới node không tồn tại (AC-002, mặt trái)", () => {
    const nodes: SkillNode[] = [{ id: "a", labelVi: "A", subject: "Math" }];
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
    const nodes: SkillNode[] = [{ id: "a", labelVi: "A", subject: "Math" }];
    const edges: SkillPrerequisiteEdge[] = [
      { skillNodeId: "khong-ton-tai", prerequisiteNodeId: "a" },
    ];

    expect(validateDag(nodes, edges).valid).toBe(false);
  });

  it("báo chu trình 2 node (AC-001, mặt trái)", () => {
    const nodes: SkillNode[] = [
      { id: "a", labelVi: "A", subject: "Math" },
      { id: "b", labelVi: "B", subject: "Math" },
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
      { id: "a", labelVi: "A", subject: "Math" },
      { id: "b", labelVi: "B", subject: "Math" },
      { id: "c", labelVi: "C", subject: "Math" },
      { id: "roi", labelVi: "Rời", subject: "Math" },
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
      { id: "goc", labelVi: "Gốc", subject: "Math" },
      { id: "trai", labelVi: "Trái", subject: "Math" },
      { id: "phai", labelVi: "Phải", subject: "Math" },
      { id: "chung", labelVi: "Chung", subject: "Math" },
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

  it("chấp nhận tập cạnh RỖNG (Văn/Sử ship không có tiên quyết — phải qua cổng seed)", () => {
    const nodes: SkillNode[] = [{ id: "a", labelVi: "A", subject: "History" }];

    expect(validateDag(nodes, [])).toEqual({ valid: true, cycleNodeIds: [], danglingEdges: [] });
  });
});

describe("AC-001 — cây kỹ năng đã ship có 0 chu trình", () => {
  it("validateDag() trên dữ liệu gộp 7 môn không báo chu trình", () => {
    expect(validateDag(SKILL_NODES, SKILL_PREREQUISITES).cycleNodeIds).toEqual([]);
  });

  it.each(SUBJECT_ORDER)("validateDag() trên riêng môn %s hợp lệ", (subject) => {
    expect(validateDag(skillNodesForSubject(subject), skillEdgesForSubject(subject))).toEqual({
      valid: true,
      cycleNodeIds: [],
      danglingEdges: [],
    });
  });
});

describe("AC-002 — 100% cạnh tiên quyết trỏ tới node tồn tại (0 cạnh treo)", () => {
  it("validateDag() trên dữ liệu gộp không báo cạnh treo", () => {
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

  it("không có cạnh nối hai môn khác nhau — tiên quyết là chuyện nội bộ một môn", () => {
    const subjectOf = new Map(SKILL_NODES.map((n) => [n.id, n.subject]));
    const crossing = SKILL_PREREQUISITES.filter(
      (e) => subjectOf.get(e.skillNodeId) !== subjectOf.get(e.prerequisiteNodeId),
    );

    expect(crossing).toEqual([]);
  });
});

describe("AC-003 — số node theo môn đúng bản draft đã rà", () => {
  it("Toán giữ nguyên 20 node trong khoảng [15, 25] của AC-003 (không đổi id đã có mastery)", () => {
    const math = skillNodesForSubject("Math");
    expect(math.length).toBeGreaterThanOrEqual(15);
    expect(math.length).toBeLessThanOrEqual(25);
    expect(math.length).toBe(20);
  });

  it.each(SUBJECT_ORDER)("%s có đúng số node/cạnh của draft", (subject) => {
    expect(skillNodesForSubject(subject).length).toBe(EXPECTED_NODE_COUNT[subject]);
    expect(skillEdgesForSubject(subject).length).toBe(EXPECTED_EDGE_COUNT[subject]);
  });

  it("SKILL_NODES gộp đúng bằng tổng các môn, theo thứ tự SUBJECT_ORDER", () => {
    const expected = SUBJECT_ORDER.flatMap((s) => SKILL_TAXONOMY[s].nodes);
    expect(SKILL_NODES).toEqual(expected);
    expect(SKILL_NODES.length).toBe(
      Object.values(EXPECTED_NODE_COUNT).reduce((a, b) => a + b, 0),
    );
  });

  it("id node là duy nhất TOÀN CỤC — skill_nodes.id là khoá chính chung cho mọi môn", () => {
    expect(new Set(SKILL_NODES.map((n) => n.id)).size).toBe(SKILL_NODES.length);
  });

  it("id node là slug ổn định (chữ thường ASCII, số, gạch ngang) — dùng làm khoá chính skill_nodes.id", () => {
    const badIds = SKILL_NODES.map((n) => n.id).filter((id) => !/^[a-z0-9-]+$/.test(id));

    expect(badIds).toEqual([]);
  });

  it("mỗi node mang đúng subject của cây chứa nó", () => {
    for (const subject of SUBJECT_ORDER) {
      const wrong = skillNodesForSubject(subject).filter((n) => n.subject !== subject);
      expect(wrong).toEqual([]);
    }
  });

  it("id của môn khác Toán bắt đầu bằng tiền tố môn; id Toán không mang tiền tố của môn nào", () => {
    const nonMathPrefixes = SUBJECT_ORDER.filter((s) => s !== "Math").map(
      (s) => SKILL_ID_PREFIX[s],
    );

    for (const subject of SUBJECT_ORDER) {
      const prefix = SKILL_ID_PREFIX[subject];
      const ids = skillNodesForSubject(subject).map((n) => n.id);
      if (subject === "Math") {
        expect(ids.filter((id) => nonMathPrefixes.some((p) => id.startsWith(p)))).toEqual([]);
      } else {
        expect(prefix.length).toBeGreaterThan(0);
        expect(ids.filter((id) => !id.startsWith(prefix))).toEqual([]);
      }
    }
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

  it("labelVi là duy nhất trong một môn — hai dạng bài cùng tên thì học sinh không phân biệt được", () => {
    for (const subject of SUBJECT_ORDER) {
      const labels = skillNodesForSubject(subject).map((n) => n.labelVi);
      expect(new Set(labels).size).toBe(labels.length);
    }
  });
});

describe("subjectOfSkillNodeId() — suy môn từ tiền tố id (cổng lọc định tuyến D2)", () => {
  it("trả đúng subject cho MỌI node đã ship", () => {
    const wrong = SKILL_NODES.filter((n) => subjectOfSkillNodeId(n.id) !== n.subject).map(
      (n) => n.id,
    );

    expect(wrong).toEqual([]);
  });

  it("id không tiền tố (kể cả id fixture của test tích hợp) đọc là Toán", () => {
    expect(subjectOfSkillNodeId("node-x")).toBe("Math");
    expect(subjectOfSkillNodeId("tich-phan")).toBe("Math");
  });

  it("chỉ khớp tiền tố ở ĐẦU id — 'so-phuc' không phải Sử dù chứa 'su'", () => {
    expect(subjectOfSkillNodeId("so-phuc")).toBe("Math");
    expect(subjectOfSkillNodeId("su-bien-dong")).toBe("History");
  });
});

// --- (c) Bản mã hoá khớp bản draft --------------------------------------------

const DRAFT_DIR = fileURLToPath(new URL("../../../../docs/plans/analysis/", import.meta.url));

/**
 * Đọc id node và cạnh từ các bảng markdown của một draft. Quy ước bảng (bản
 * Toán đặt ra, sáu bản sau theo): hàng node = `| \`id\` | nhãn | lớp |` (ô đầu
 * backtick, ô hai không); hàng cạnh = `| \`skill\` | \`prereq\` |` (hai ô đầu
 * đều backtick). Hàng tiêu đề bảng cạnh (`skill_node_id`) bị loại đích danh
 * chứ không lọc "id không có trong code" — lọc kiểu sau sẽ nuốt luôn một id
 * gõ sai trong draft, tức đúng lỗi lớp này tồn tại để bắt.
 */
function parseDraft(subject: Subject): { nodeIds: string[]; edges: string[] } {
  const file = `${DRAFT_DIR}engine1-${subject.toLowerCase()}-skill-dag-draft.md`;
  const nodeIds: string[] = [];
  const edges: string[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .slice(1, -1)
      .split("|")
      .map((c) => c.trim());
    const first = cells[0]?.match(/^`([^`]+)`$/);
    if (!first || first[1] === "skill_node_id") continue;
    const second = cells[1]?.match(/^`([^`]+)`$/);
    if (second) edges.push(`${first[1]}→${second[1]}`);
    else nodeIds.push(first[1]);
  }
  return { nodeIds, edges };
}

describe("bản draft (.md) và bản mã hoá (.ts) là một", () => {
  it.each(SUBJECT_ORDER)("%s: tập id node và tập cạnh trong draft bằng đúng code", (subject) => {
    const draft = parseDraft(subject);
    const codeNodeIds = skillNodesForSubject(subject).map((n) => n.id);
    const codeEdges = skillEdgesForSubject(subject).map(
      (e) => `${e.skillNodeId}→${e.prerequisiteNodeId}`,
    );

    expect([...draft.nodeIds].sort()).toEqual([...codeNodeIds].sort());
    expect([...draft.edges].sort()).toEqual([...codeEdges].sort());
  });
});
