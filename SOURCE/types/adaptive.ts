// Kiểu dùng chung giữa backend và UI cho gợi ý kỹ năng (Engine 1).
// Hợp đồng đúng bằng UI Spec D6 — xem docs/ui-spec/engine1-adaptive-ai-ui-spec.md.

import type { RouteReasonCode } from "@/lib/adaptive/route";

/**
 * Gợi ý "nên luyện gì tiếp theo" mà `SkillRecommendationCard` nhận.
 *
 * `null` = cold start THẬT SỰ (chưa có dòng mastery nào) — UI hiện trạng thái
 * cold-start tường minh chứ không hiện thẻ rỗng.
 *
 * CỐ Ý KHÔNG có `nodeId`: id trong DAG là chuyện nội bộ backend, UI không cần
 * và không được phụ thuộc vào nó (Field Propagation Map của backend DD). Thêm
 * `nodeId` vào đây là mở rộng bề mặt hợp đồng, phải qua một vòng Minimal
 * Surface Alternatives trước.
 */
export type SkillRecommendation = {
  /** Nhãn tiếng Việt của kỹ năng — `labelVi` của node được chọn. */
  skillLabel: string;
  /** Vì sao node này được chọn; UI dùng để chọn câu giải thích. */
  reasonCode: RouteReasonCode;
} | null;
