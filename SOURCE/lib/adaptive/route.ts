// Định tuyến thích ứng (Engine 1, PRD R3) — chọn kỹ năng học sinh nên luyện
// tiếp theo. Heuristic, KHÔNG phải IRT: corpus ~47 câu quá nhỏ để nuôi một mô
// hình tham số (PRD R-f, IRT bị cắt có chủ ý).
//
// Hàm THUẦN: mọi state (nodes/edges/mastery/threshold) được tiêm vào, không
// đọc Date.now(), không đọc biến module, không I/O (AC-016). Nhờ vậy
// getSkillRecommendation() gọi nó ở mỗi lần đọc dashboard mà không phải lo
// cache hay tác dụng phụ.

export interface RouteNode {
  id: string;
  labelVi: string;
}

export interface RouteEdge {
  /** Node này cần `prerequisiteNodeId` đạt ngưỡng trước. */
  skillNodeId: string;
  prerequisiteNodeId: string;
}

export interface RouteMastery {
  skillNodeId: string;
  correctCount: number;
  totalCount: number;
  /** ISO timestamp lần gần nhất trả lời sai node này; null nếu chưa từng sai. */
  lastWrongAt: string | null;
}

export interface RouteInput {
  nodes: readonly RouteNode[];
  edges: readonly RouteEdge[];
  /** CHỈ các dòng của một người dùng — trách nhiệm của caller (fetch có RLS). */
  mastery: readonly RouteMastery[];
  /** MASTERY_CLEARED_THRESHOLD. */
  threshold: number;
}

export type RouteReasonCode = "prerequisite-gate" | "lowest-mastery" | "recently-wrong";

export interface RouteResult {
  nodeId: string;
  labelVi: string;
  reasonCode: RouteReasonCode;
}

/**
 * Chọn node kỹ năng nên luyện tiếp theo, hoặc null khi chưa có dữ liệu nào.
 *
 * Không bao giờ ném lỗi: node vắng mặt trong `mastery` được coi là ratio 0
 * (chưa đụng tới = yếu nhất, khuyến khích thử lần đầu).
 *
 * Tiền đề: nodes/edges là DAG hợp lệ (AC-001/002). Hàm này KHÔNG validate lại
 * mỗi lần gọi vì lý do hiệu năng — cổng chặn nằm ở validateDag() lúc seed. Dù
 * vậy vòng walk vẫn giữ một visited-set phòng thủ: nếu dữ liệu DB có chu trình
 * (ví dụ ai đó sửa tay bảng skill_prerequisites), hàm phải thoát chứ không treo.
 */
export function recommendNextSkill(input: RouteInput): RouteResult | null {
  const { nodes, edges, mastery, threshold } = input;

  // Bước 1 — cold start thật sự. Có node/cạnh nhưng không có dòng mastery nào
  // nghĩa là hệ thống chưa biết gì về người này: trả null để tầng UI hiện
  // trạng thái cold-start tường minh, thay vì bịa ra một node "khởi đầu".
  if (mastery.length === 0) return null;

  const masteryById = new Map(mastery.map((m) => [m.skillNodeId, m]));

  // Bước 2 — ratio. totalCount 0 cũng cho 0 chứ không cho NaN: NaN so sánh kiểu
  // gì cũng false nên nó sẽ làm thứ tự sort phụ thuộc vị trí ban đầu, hỏng đúng
  // tính tất định mà AC-016 yêu cầu.
  const ratioOf = (nodeId: string): number => {
    const row = masteryById.get(nodeId);
    if (!row || row.totalCount <= 0) return 0;
    return row.correctCount / row.totalCount;
  };

  const lastWrongOf = (nodeId: string): string | null =>
    masteryById.get(nodeId)?.lastWrongAt ?? null;

  const prereqsOf = (nodeId: string): string[] =>
    edges.filter((e) => e.skillNodeId === nodeId).map((e) => e.prerequisiteNodeId);

  // Bước 3 — đúng nếu MỌI tiên quyết đã đạt ngưỡng (đúng hiển nhiên khi không
  // có tiên quyết nào).
  const isCleared = (nodeId: string): boolean =>
    prereqsOf(nodeId).every((p) => ratioOf(p) >= threshold);

  // Bước 4 — sortKey = [ratio ASC, lastWrongAt DESC NULLS LAST, id ASC].
  // Khoá thứ ba (id) là thứ bảo đảm tất định tuyệt đối: không có nó, hai node
  // trùng cả ratio lẫn lastWrongAt sẽ phụ thuộc vào tính ổn định của Array.sort.
  const compare = (a: RouteNode, b: RouteNode): number => {
    const ratioDiff = ratioOf(a.id) - ratioOf(b.id);
    if (ratioDiff !== 0) return ratioDiff;

    const aWrong = lastWrongOf(a.id);
    const bWrong = lastWrongOf(b.id);
    if (aWrong !== bWrong) {
      if (aWrong === null) return 1; // null xuống cuối
      if (bWrong === null) return -1;
      if (aWrong > bWrong) return -1; // mới hơn lên trước
      if (aWrong < bWrong) return 1;
    }

    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  };

  // Bước 5 — node yếu nhất. Sort trên BẢN SAO: hàm không được sửa đầu vào.
  const sorted = [...nodes].sort(compare);
  const weakest = sorted[0];
  if (!weakest) return null;

  // Bước 6 — tie có được phá bằng recency không? Chỉ đúng khi có node khác cùng
  // ratio VÀ node thắng có lastWrongAt không null (tức recency thật sự là thứ
  // đẩy nó lên trước, chứ không phải khoá id).
  const sameRatio = nodes.filter((n) => ratioOf(n.id) === ratioOf(weakest.id));
  const tieBrokenByRecency =
    sameRatio.length >= 2 &&
    lastWrongOf(weakest.id) !== null &&
    sameRatio.some((n) => n.id !== weakest.id && lastWrongOf(n.id) !== lastWrongOf(weakest.id));

  // Bước 7-8 — đi xuống theo các tiên quyết chưa đạt cho tới khi gặp node học
  // được ngay.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  let candidate = weakest;
  let substituted = false;
  const visited = new Set<string>();

  while (!isCleared(candidate.id)) {
    visited.add(candidate.id);

    const unmet = prereqsOf(candidate.id)
      .filter((p) => ratioOf(p) < threshold)
      .map((p) => nodeById.get(p))
      .filter((n): n is RouteNode => n !== undefined)
      .sort(compare);

    const next = unmet[0];
    // Phòng thủ: không đi tiếp được (tiên quyết trỏ tới node không tồn tại) hoặc
    // quay lại node đã qua (chu trình) → dừng, trả node hiện tại còn hơn treo.
    if (!next || visited.has(next.id)) break;

    candidate = next;
    substituted = true;
  }

  // Bước 9 — thứ tự ưu tiên cố định: thay thế trước, rồi recency, rồi mặc định.
  const reasonCode: RouteReasonCode = substituted
    ? "prerequisite-gate"
    : tieBrokenByRecency
      ? "recently-wrong"
      : "lowest-mastery";

  return { nodeId: candidate.id, labelVi: candidate.labelVi, reasonCode };
}
