// Cây kỹ năng Toán (Engine 1 Adaptive AI & Feedback, PRD R1/D1) — dữ liệu đã
// được engineer duyệt + hàm kiểm tra tính hợp lệ của DAG.
//
// Nguồn nội dung: docs/plans/analysis/engine1-math-skill-dag-draft.md (mục
// "Engineer Approval" đã tick). Sửa nội dung ở đây thì phải sửa cả file draft
// đó — draft là bản engineer review, file này chỉ là bản mã hoá.
//
// Đặt ở lib/ (KHÔNG phải supabase/) vì vitest.config.ts chỉ thu test dưới
// lib/**|components/**|app/**; seedSkillTaxonomy.ts ở supabase/ nhập ngược lên
// đây để lấy dữ liệu, nhờ vậy dữ liệu ship và dữ liệu được test là một.
//
// Phạm vi: chỉ lớp 10 và lớp 12 — đúng hai khối lớp corpus hiện có (PRD A2:
// 32 câu lớp 12, 5 câu lớp 10). Thông tin lớp KHÔNG đi vào dữ liệu này vì
// bảng skill_nodes không có cột grade (backend DD §9b).

/** Một node kỹ năng. `id` là slug ổn định, dùng làm khoá chính `skill_nodes.id`. */
export interface SkillNode {
  id: string;
  /** Nhãn tiếng Việt hiển thị cho học sinh (AC-004) — không dịch sang tiếng Anh. */
  labelVi: string;
}

/** Cạnh tiên quyết: học `skillNodeId` cần `prerequisiteNodeId` đạt ngưỡng trước. */
export interface SkillPrerequisiteEdge {
  skillNodeId: string;
  prerequisiteNodeId: string;
}

export interface DagValidationResult {
  /** true khi 0 chu trình VÀ 0 cạnh treo. */
  valid: boolean;
  /** Id các node nằm trong ít nhất một chu trình (rỗng khi hợp lệ). Đã sắp xếp. */
  cycleNodeIds: string[];
  /** Các cạnh trỏ tới (hoặc xuất phát từ) một id không có trong `nodes`. */
  danglingEdges: SkillPrerequisiteEdge[];
}

/**
 * 20 node — lớp 10 (6, nền tảng) + lớp 12 (14, trọng tâm ôn thi). Nằm trong
 * khoảng 15–25 mà AC-003 kỳ vọng cho corpus ~47 câu Toán hiện có.
 */
export const SKILL_NODES: readonly SkillNode[] = [
  // --- Lớp 10 (nền tảng) ---
  { id: "menh-de-tap-hop", labelVi: "Mệnh đề và tập hợp" },
  { id: "bpt-bac-nhat-hai-an", labelVi: "Bất phương trình bậc nhất hai ẩn" },
  { id: "ham-so-bac-hai", labelVi: "Hàm số bậc hai" },
  { id: "bpt-bac-hai-mot-an", labelVi: "Bất phương trình bậc hai một ẩn" },
  { id: "he-thuc-luong-tam-giac", labelVi: "Hệ thức lượng trong tam giác" },
  { id: "thong-ke-xs-lop10", labelVi: "Thống kê và xác suất cơ bản" },

  // --- Lớp 12 (trọng tâm ôn thi) ---
  { id: "tinh-don-dieu-cuc-tri", labelVi: "Tính đơn điệu và cực trị của hàm số" },
  {
    id: "gtln-gtnn-tiem-can",
    labelVi: "Giá trị lớn nhất, giá trị nhỏ nhất và tiệm cận của hàm số",
  },
  { id: "khao-sat-ve-do-thi", labelVi: "Khảo sát và vẽ đồ thị hàm số" },
  {
    id: "ung-dung-do-thi-bien-luan",
    labelVi: "Ứng dụng đồ thị hàm số để biện luận phương trình, bất phương trình",
  },
  {
    id: "ham-so-luy-thua-mu-logarit",
    labelVi: "Hàm số lũy thừa, hàm số mũ và hàm số lôgarit",
  },
  { id: "pt-bpt-mu-logarit", labelVi: "Phương trình, bất phương trình mũ và lôgarit" },
  { id: "nguyen-ham", labelVi: "Nguyên hàm" },
  { id: "tich-phan", labelVi: "Tích phân" },
  { id: "ung-dung-tich-phan", labelVi: "Ứng dụng tích phân tính diện tích, thể tích" },
  { id: "so-phuc", labelVi: "Số phức" },
  { id: "the-tich-khoi-da-dien", labelVi: "Thể tích khối đa diện" },
  { id: "mat-non-mat-tru-mat-cau", labelVi: "Mặt nón, mặt trụ, mặt cầu" },
  { id: "pp-toa-do-khong-gian", labelVi: "Phương pháp tọa độ trong không gian Oxyz" },
  { id: "xac-suat-co-dieu-kien", labelVi: "Xác suất có điều kiện" },
];

/**
 * Cạnh tiên quyết. 5 node gốc (không có tiên quyết): `menh-de-tap-hop`,
 * `bpt-bac-nhat-hai-an`, `ham-so-bac-hai`, `he-thuc-luong-tam-giac`,
 * `thong-ke-xs-lop10`.
 */
export const SKILL_PREREQUISITES: readonly SkillPrerequisiteEdge[] = [
  { skillNodeId: "bpt-bac-hai-mot-an", prerequisiteNodeId: "ham-so-bac-hai" },
  { skillNodeId: "tinh-don-dieu-cuc-tri", prerequisiteNodeId: "ham-so-bac-hai" },
  { skillNodeId: "gtln-gtnn-tiem-can", prerequisiteNodeId: "tinh-don-dieu-cuc-tri" },
  { skillNodeId: "khao-sat-ve-do-thi", prerequisiteNodeId: "gtln-gtnn-tiem-can" },
  { skillNodeId: "ung-dung-do-thi-bien-luan", prerequisiteNodeId: "khao-sat-ve-do-thi" },
  { skillNodeId: "ham-so-luy-thua-mu-logarit", prerequisiteNodeId: "ham-so-bac-hai" },
  { skillNodeId: "pt-bpt-mu-logarit", prerequisiteNodeId: "ham-so-luy-thua-mu-logarit" },
  { skillNodeId: "nguyen-ham", prerequisiteNodeId: "tinh-don-dieu-cuc-tri" },
  { skillNodeId: "tich-phan", prerequisiteNodeId: "nguyen-ham" },
  { skillNodeId: "ung-dung-tich-phan", prerequisiteNodeId: "tich-phan" },
  { skillNodeId: "so-phuc", prerequisiteNodeId: "bpt-bac-hai-mot-an" },
  { skillNodeId: "the-tich-khoi-da-dien", prerequisiteNodeId: "he-thuc-luong-tam-giac" },
  { skillNodeId: "mat-non-mat-tru-mat-cau", prerequisiteNodeId: "the-tich-khoi-da-dien" },
  { skillNodeId: "pp-toa-do-khong-gian", prerequisiteNodeId: "mat-non-mat-tru-mat-cau" },
  { skillNodeId: "xac-suat-co-dieu-kien", prerequisiteNodeId: "thong-ke-xs-lop10" },
];

/**
 * Kiểm tra cây kỹ năng là DAG hợp lệ: 0 chu trình (AC-001) và 0 cạnh treo
 * (AC-002).
 *
 * Chu trình phát hiện bằng Kahn (topological peel): bóc dần các node đã hết
 * tiên quyết chưa xử lý; node nào còn sót lại sau khi bóc hết chính là node
 * nằm trong (hoặc bị chặn bởi) một chu trình. Chọn Kahn thay vì DFS đệ quy vì
 * nó không có nguy cơ tràn stack và trả thẳng ra TẬP node còn kẹt — đủ để báo
 * lỗi, không cần dựng lại đường đi cụ thể.
 *
 * Cạnh treo được loại khỏi phép đếm bậc trước khi bóc, để một cạnh treo không
 * bị báo nhầm thành chu trình.
 *
 * Thuần tuý, không I/O, không sửa tham số đầu vào.
 */
export function validateDag(
  nodes: readonly SkillNode[],
  edges: readonly SkillPrerequisiteEdge[],
): DagValidationResult {
  const nodeIds = new Set(nodes.map((n) => n.id));

  const danglingEdges = edges.filter(
    (e) => !nodeIds.has(e.skillNodeId) || !nodeIds.has(e.prerequisiteNodeId),
  );
  const realEdges = edges.filter(
    (e) => nodeIds.has(e.skillNodeId) && nodeIds.has(e.prerequisiteNodeId),
  );

  // remainingPrereqs[x] = số tiên quyết của x chưa được bóc.
  // dependents[p] = các node có p là tiên quyết.
  const remainingPrereqs = new Map<string, number>([...nodeIds].map((id) => [id, 0]));
  const dependents = new Map<string, string[]>();

  for (const e of realEdges) {
    remainingPrereqs.set(e.skillNodeId, (remainingPrereqs.get(e.skillNodeId) ?? 0) + 1);
    const list = dependents.get(e.prerequisiteNodeId);
    if (list) list.push(e.skillNodeId);
    else dependents.set(e.prerequisiteNodeId, [e.skillNodeId]);
  }

  const queue = [...nodeIds].filter((id) => remainingPrereqs.get(id) === 0);
  const peeled = new Set<string>();

  while (queue.length > 0) {
    const id = queue.shift() as string;
    if (peeled.has(id)) continue;
    peeled.add(id);

    for (const dependent of dependents.get(id) ?? []) {
      const left = (remainingPrereqs.get(dependent) ?? 0) - 1;
      remainingPrereqs.set(dependent, left);
      if (left === 0) queue.push(dependent);
    }
  }

  const cycleNodeIds = [...nodeIds].filter((id) => !peeled.has(id)).sort();

  return {
    valid: cycleNodeIds.length === 0 && danglingEdges.length === 0,
    cycleNodeIds,
    danglingEdges,
  };
}
