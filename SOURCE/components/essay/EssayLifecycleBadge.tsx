// EssayLifecycleBadge — nhãn trạng thái vòng đời chấm tự luận (ADR-0018,
// UI Spec § Component: EssayLifecycleBadge).
//
// Ở `components/essay/` chứ không trong cây route, vì CẢ `(exams)` LẪN `(history)`
// đều dùng nó — cùng lý do `components/history/` và `components/billing/` tồn
// tại bên ngoài cây route.
//
// SERVER COMPONENT (async), khác `OrderStatusBadge` vốn là client: mọi chỗ
// dựng nó ở tính năng này đều đã nằm trong một Server Component, nên không có
// lý do đẩy thêm một client bundle xuống trình duyệt chỉ để đọc từ điển.
//
// ═══ HÌNH DẠNG: primitive Badge (theme "Sân trường", 2026-09-06) ═══
//
// Một viên thuốc tô nền, một glyph `aria-hidden`, rồi CHỮ làm tên khả truy
// cập. Nhờ vậy nhãn sống sót qua bản in trắng đen, và trình đọc màn hình đọc
// ĐÚNG CÁC TỪ chứ không đọc một ký hiệu. Màu lấy từ biến thể của Badge —
// không hex viết cứng, không viền (theme phân lớp bằng nền tô).
//
// KHÔNG `CONFIG[x] ?? CONFIG.default`, KHÔNG `as`: `deriveEssayView()` trả `null`
// cho một giá trị lạ, nên giá trị lạ KHÔNG BAO GIỜ tới được component này
// (UI-D13). Phần còn lại do `Record<EssayRenderState, …>` vét cạn canh — thêm
// một trạng thái vào union mà quên diện mạo là lỗi BIÊN DỊCH.
//
// ═══ VÌ SAO "Đã chấm" KHÔNG MANG MÀU XANH "ĐÚNG" ═══
//
// Một band không phải một phán quyết đúng/sai — `isCorrect` là `false` VĨNH
// VIỄN (W1) — nên tô nó màu "đúng" là khẳng định trên màn hình một điều không
// thật. "Đã chấm" dùng nền surface + chữ đủ đậm; "Chấm thất bại" mới mang màu
// đỏ (biến thể `wrong` của Badge) vì đó là trạng thái cần người dùng hành động.

import { Badge } from "@/components/ui/badge";
import { t } from "@/lib/copy";
import type { MessageKey } from "@/lib/copy";
import type { EssayRenderState } from "@/lib/scoring/essayLifecycle";

type Appearance = {
  glyph: string;
  labelKey: MessageKey;
  variant: "muted" | "surface" | "wrong";
};

/** Vét cạn theo `EssayRenderState`. Không có nhánh mặc định, và không cần: một
 *  `essayState` lạ đã bị `deriveEssayView()` chặn thành `null` từ tầng đọc. */
const APPEARANCE: Record<EssayRenderState, Appearance> = {
  pending: { glyph: "◌", labelKey: "result.essay.state.pending", variant: "muted" },
  graded: { glyph: "✓", labelKey: "result.essay.state.graded", variant: "surface" },
  failed: { glyph: "✕", labelKey: "result.essay.state.failed", variant: "wrong" },
};

export async function EssayLifecycleBadge({ state }: { state: EssayRenderState }) {
  const appearance = APPEARANCE[state];

  return (
    <Badge variant={appearance.variant}>
      <span aria-hidden>{appearance.glyph}</span>
      {t(appearance.labelKey)}
    </Badge>
  );
}
