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
// ═══ CẤU TRÚC CHÉP TỪ `OrderStatusBadge.tsx:86-93`, BA KHUYẾT TẬT THÌ KHÔNG ═══
//
// Chép: một <span> viên thuốc, một glyph `aria-hidden`, rồi CHỮ làm tên khả
// truy cập. Nhờ vậy nhãn sống sót qua bản in trắng đen, và trình đọc màn hình
// đọc ĐÚNG CÁC TỪ chứ không đọc một ký hiệu.
//
// KHÔNG chép ba thứ:
//   1. KHÔNG hex viết cứng — mọi màu là token.
//   2. KHÔNG `CONFIG[x] ?? CONFIG.default`, KHÔNG `as`. Ở đây điều đó được bảo
//      đảm SỚM HƠN cả nhánh thứ năm của tiền lệ: `deriveEssayView()` trả `null`
//      cho một giá trị lạ, nên giá trị lạ KHÔNG BAO GIỜ tới được component này
//      (UI-D13). Phần còn lại do `Record<EssayRenderState, …>` vét cạn canh —
//      thêm một trạng thái vào union mà quên diện mạo là lỗi BIÊN DỊCH.
//   3. KHÔNG mượn `#4F7942` (màu "đáp án đúng"), vì BA lý do độc lập: nó là
//      hex viết cứng, phạm quy tắc cứng của theme; nó đang là TBD-04 ở
//      `short-answer-scoring-ui-spec.md` và tính năng này không nhân bản một
//      món nợ; và NGHĨA của nó SAI — một band không phải một phán quyết
//      đúng/sai, `isCorrect` là `false` VĨNH VIỄN (W1), nên tô nó màu "đúng"
//      là khẳng định trên màn hình một điều không thật.
//
// ═══ VÌ SAO "Đã chấm" CHỈ CÓ ĐỘ ĐẬM, KHÔNG CÓ MÀU XANH ═══
//
// Repo KHÔNG có token `--success` (Open Item O-4). Cách giải là cách
// `OrderStatusBadge.paid` đã giải cùng bài toán: `--foreground` đủ mạnh cộng
// `font-medium`. Muốn một màu dương thật thì phải THÊM token `--success` và
// đóng TBD-04 — đó là việc của kỹ sư/product, và nó KHÔNG chặn ship.

import { getTranslate } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translate";
import type { EssayRenderState } from "@/lib/scoring/essayLifecycle";

type Appearance = { glyph: string; labelKey: MessageKey; className: string };

/** Vét cạn theo `EssayRenderState`. Không có nhánh mặc định, và không cần: một
 *  `essayState` lạ đã bị `deriveEssayView()` chặn thành `null` từ tầng đọc. */
const APPEARANCE: Record<EssayRenderState, Appearance> = {
  // Viền `--border` ở đây là trang trí — CHỮ mang thông tin — nên nó được miễn
  // ngưỡng 1.4.11. Chữ `--muted-foreground` trên `--card` đo được 5.26:1.
  pending: {
    glyph: "◌",
    labelKey: "result.essay.state.pending",
    className: "border-border bg-card text-muted-foreground",
  },
  graded: {
    glyph: "✓",
    labelKey: "result.essay.state.graded",
    className: "border-foreground text-foreground",
  },
  // Viền `--destructive` ở đây CÓ mang thông tin, nên nó đạt ngưỡng 3:1.
  failed: {
    glyph: "✕",
    labelKey: "result.essay.state.failed",
    className: "border-destructive text-destructive",
  },
};

export async function EssayLifecycleBadge({ state }: { state: EssayRenderState }) {
  const t = await getTranslate();
  const appearance = APPEARANCE[state];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${appearance.className}`}
    >
      <span aria-hidden>{appearance.glyph}</span>
      {t(appearance.labelKey)}
    </span>
  );
}
