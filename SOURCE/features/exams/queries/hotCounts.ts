// Cửa sổ đếm "nổi nhất" + điểm gọi RPC DUY NHẤT cho `exam_hot_counts` — dùng
// chung bởi `listExamShelves` (P3-T2), nhánh `?sort=hot` của `listExamsRanked`
// (P4-T2) và `listHotExams` của trang chủ (P7-T1), nên hai thứ không thể trôi
// lệch giữa các nơi gọi: (1) cách tính hai mốc thời gian cửa sổ, (2) hình dạng
// tham số gửi cho RPC (backend DD § Query layer "hotCounts.ts").
//
// ADR-0021 D4: đồng hồ chỉ được đọc MỘT LẦN mỗi lượt render, ở TẦNG QUERY này
// — không bao giờ bên trong `lib/adaptive` (nơi đó vẫn giữ nguyên quy ước
// thuần: state tiêm vào, không `Date.now()`, không I/O). `hotWindows(now)`
// nhận `now` làm THAM SỐ — nó không tự đọc đồng hồ hệ thống; `new Date(now.
// getTime() - …)` ở dưới chỉ PHÂN TÍCH giá trị `now` đã cho để suy ra hai mốc
// lùi lại, không phải một lượt đọc đồng hồ thứ hai (cùng lý lẽ `examShelves.
// ts` dùng cho `Date.parse()` trên một chuỗi đầu vào có sẵn).
//
// Việc chuẩn hoá hai mốc về đúng GIỜ (`date_trunc('hour', …)`) xảy ra PHÍA
// SERVER, bên trong hàm SQL (`schema.sql` §20c) — không phải ở đây. `hotWindows`
// chỉ trừ ngày rồi trả ISO string; snap-về-giờ là một lớp phòng thủ khác, thuộc
// về RPC, ngăn một JWT hợp lệ dò nhị phân trục thời gian tới độ chính xác giây.
import "server-only";

import { HOT_WINDOW_RECENT_DAYS, HOT_WINDOW_WIDE_DAYS } from "@/lib/adaptive/constants";
import type { HotCounts } from "@/lib/adaptive/examShelves";
import { LIST_ROW_CEILING, readBounded } from "@/lib/supabase/boundedRead";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Một dòng thô mà `exam_hot_counts` trả — ba cột đếm là SQL `bigint`, PostgREST
 *  có thể trả về dạng số hoặc dạng chuỗi tuỳ độ lớn, nên kiểu ở đây khai cả hai. */
type HotCountsRow = {
  exam_id: string;
  recent_count: number | string | null;
  wide_count: number | string | null;
  total_count: number | string | null;
};

/** `Number(...)` rồi bảo vệ bằng `isFinite` — cùng quy ước ép-số-tại-biên mà
 *  `ranking.ts` (`:87-92`) đã dùng cho `exam_results.total_score`; giá trị
 *  không hữu hạn (null/chuỗi hỏng/undefined) rơi về 0 chứ không lan lỗi tiếp. */
function toFiniteCount(value: number | string | null): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/**
 * Hai mốc bắt đầu của thang "Nổi nhất" — cửa sổ GẦN ĐÂY (`HOT_WINDOW_RECENT_DAYS`
 * ngày) và cửa sổ RỘNG (`HOT_WINDOW_WIDE_DAYS` ngày) — tính lùi từ `now`, trả
 * dạng ISO 8601 UTC để gửi thẳng làm tham số `timestamptz` cho RPC.
 *
 * KHÔNG đọc đồng hồ: `now` là tham số bắt buộc, không có nhánh mặc định nào
 * gọi `Date.now()`/`new Date()` không đối số.
 */
export function hotWindows(now: Date): { sinceRecent: string; sinceWide: string } {
  return {
    sinceRecent: new Date(now.getTime() - HOT_WINDOW_RECENT_DAYS * MS_PER_DAY).toISOString(),
    sinceWide: new Date(now.getTime() - HOT_WINDOW_WIDE_DAYS * MS_PER_DAY).toISOString(),
  };
}

/**
 * Điểm gọi `rpc("exam_hot_counts", …)` DUY NHẤT trong toàn bộ codebase (xem
 * Notes của task file) — mọi composition cần ba cửa sổ đếm cross-user đều đi
 * qua đây, không tự dựng lệnh `.rpc()` riêng.
 *
 * `label` do NGƯỜI GỌI truyền vào (vd `"listExamShelves.hotCounts"`,
 * `"listExamsRanked.hotCounts"`, `"listHotExams.hotCounts"`) và được chuyển
 * thẳng cho `readBounded` — hàm này không tự đặt tên nhãn, để log nói đúng
 * composition nào đang gọi (backend DD § Logging).
 *
 * `p_max_rows` LUÔN là `LIST_ROW_CEILING + 1`, nhập từ `boundedRead.ts` — cùng
 * hằng số mà `readBounded`'s `.limit()` nội bộ dùng, nên hai bên không thể
 * trôi lệch (backend DD `:388-390`).
 */
export async function readHotCounts(
  supabase: SupabaseClient,
  label: string,
  now: Date
): Promise<Map<string, HotCounts>> {
  const { sinceRecent, sinceWide } = hotWindows(now);

  const rows = (await readBounded(
    label,
    supabase.rpc("exam_hot_counts", {
      p_since_recent: sinceRecent,
      p_since_wide: sinceWide,
      p_max_rows: LIST_ROW_CEILING + 1,
    })
  )) as HotCountsRow[];

  const counts = new Map<string, HotCounts>();
  for (const row of rows) {
    counts.set(row.exam_id, {
      recent: toFiniteCount(row.recent_count),
      wide: toFiniteCount(row.wide_count),
      total: toFiniteCount(row.total_count),
    });
  }
  return counts;
}
