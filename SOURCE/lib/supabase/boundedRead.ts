// Biên dòng cho các lệnh ĐỌC DANH SÁCH (P3 — "17 query danh sách đều không có
// .limit()", audit hiệu năng 2026-08-15).
//
// ⚠ ĐỌC PHẦN NÀY TRƯỚC KHI ĐỔI CON SỐ Ở DƯỚI ⚠
//
// Món nợ P3 từng được xếp "để yên": đo 2026-08-15 cho thấy listExams 150ms,
// không đau gì cả. Đánh giá đó ĐÚNG về độ trễ và BỎ SÓT kiểu hỏng thật:
//
//   PostgREST có `max_rows`. Khi một lệnh đọc vượt trần đó, nó trả về ĐÚNG
//   `max_rows` dòng, status 200, KHÔNG có error, KHÔNG có cảnh báo nào. Danh
//   sách bị cắt cụt và cả app — server, client, log — đều tin rằng mình đã nhận
//   đủ dữ liệu.
//
// Nghĩa là kiểu hỏng của P3 không phải "trang chậm" (thứ ai cũng thấy và đo
// được) mà là "đề biến mất khỏi catalog" (thứ không ai thấy, vì không có gì để
// so sánh với). Đúng hình dạng TD-001/TD-005/TD-009: không mã lỗi, không log,
// chỉ THIẾU.
//
// ĐÃ ĐO 2026-08-17 qua Supabase Management API (`GET /v1/projects/{ref}/
// postgrest`) trên CẢ HAI project: `max_rows = 1000` ở prod
// (pebjdlbgbmizgfpuptjl) VÀ dev (hynwleaxtbtjzkvpjsug). Không phải giá trị suy
// từ tài liệu — hai project cấu hình độc lập nên phải hỏi cả hai (đúng bài học
// TD-005: một bản vá áp lên một DB rồi quên DB kia).
//
// Dư địa lúc đo, trên prod: 6 đề published · 8 đề tổng · 154 câu hỏi · 53 lượt
// làm bài · 3 dòng kết quả. Tức còn xa trần — và đó chính là lý do món nợ này
// nguy hiểm chứ không phải lý do để bỏ qua nó: nó chỉ nổ khi site bắt đầu có
// người dùng, tức đúng lúc tệ nhất, và nổ trong im lặng.
//
// CƠ CHẾ: mỗi lệnh đọc danh sách xin `LIST_ROW_CEILING + 1` dòng. Dòng thứ
// +1 là DÒNG MỒI, nó không bao giờ đi vào kết quả — sự TỒN TẠI của nó là bằng
// chứng duy nhất rằng dữ liệu thật đã vượt trần ta khai. Nhận đủ mồi → kêu to.
//
// Vì sao dùng dòng mồi chứ không so `rows.length === max_rows`: cách sau không
// phân biệt được "đúng 1000 dòng thật" với "bị cắt ở 1000", và tệ hơn, nó phụ
// thuộc vào việc hằng số trong file này còn khớp với cấu hình thật của PostgREST
// — thứ đổi được từ dashboard mà không ai phải sửa một dòng code nào. Dòng mồi
// KHÔNG phụ thuộc điều đó: nó chỉ cần `LIST_ROW_CEILING + 1 <= max_rows` để được
// giao tới, và tỉ lệ 501/1000 để lại 2× dư địa cho giả định đó.

/**
 * `max_rows` của PostgREST — trần dòng mà nền tảng áp ÂM THẦM cho mọi response.
 *
 * Đo 2026-08-17, prod và dev đều `1000`. KHÔNG đọc được từ client: PostgREST
 * không phơi giá trị này ra ngoài, và cách duy nhất quan sát nó qua REST là có
 * sẵn hơn 1000 dòng để bị cắt — tức chỉ biết được sau khi đã hỏng. Muốn kiểm lại
 * thì hỏi Management API:
 *
 *   GET https://api.supabase.com/v1/projects/<ref>/postgrest  → { max_rows }
 *
 * Hằng số này KHÔNG được dùng để cắt dữ liệu (`LIST_ROW_CEILING` làm việc đó).
 * Nó ở đây đúng một việc: làm chỗ neo cho bất biến `LIST_ROW_CEILING < 1000`,
 * thứ mà test canh ghim lại.
 */
export const POSTGREST_MAX_ROWS = 1000;

/**
 * Trần dòng mà ỨNG DỤNG tự khai cho một lệnh đọc danh sách.
 *
 * MỘT con số dùng chung cho mọi lệnh đọc, cố ý — nó suy ra từ nền tảng
 * (`POSTGREST_MAX_ROWS`), không phải từ hiểu biết sản phẩm về từng truy vấn.
 * Đặt mỗi query một trần khác nhau (300 cho cái này, 800 cho cái kia) sẽ là bịa
 * ra độ chính xác không có thật, và tạo thêm 12 con số để trôi lệch.
 *
 * 500 = nửa `max_rows`, mức lớn nhất còn để lại dư địa 2× cho việc dòng mồi
 * thực sự được giao. Nó cũng cao hơn dữ liệu hiện tại 3 bậc độ lớn (6 đề
 * published), nên hành vi quan sát được của mọi trang hôm nay KHÔNG đổi.
 *
 * Chạm trần này KHÔNG phải là "đã tới lúc nâng số lên". Nó là "danh sách này đã
 * lớn tới mức phải phân trang thật" — nâng số chỉ dời cái ngày đó lại, và dời
 * nó tới chỗ gần `max_rows` hơn, nơi dòng mồi không còn được giao và cổng canh
 * này chết trong im lặng.
 */
export const LIST_ROW_CEILING = 500;

/**
 * Hình dạng tối thiểu của một query builder supabase-js mà `readBounded` cần.
 *
 * Khai theo cấu trúc thay vì import type generic của `@supabase/supabase-js`:
 * các call site trong repo đã đúc kết quả bằng `as unknown as Row[]` (xem
 * (layer2)/queries.ts), nên buộc helper phải khớp generic của builder chỉ thêm
 * việc mà không thêm an toàn.
 */
interface BoundedListQuery {
  limit(count: number): PromiseLike<{
    data: unknown[] | null;
    error: { code?: string | null; message: string } | null;
  }>;
}

/**
 * Đọc một danh sách với biên tường minh, và biến việc bị cắt cụt thành TIẾNG ỒN.
 *
 * @param label Tên lệnh đọc, đi vào log khi tripwire nổ. Đặt tên theo hàm gọi nó
 *              (vd `listMyHistory`) — người đọc log cần biết đi sửa ở đâu, và
 *              stack trace của một Server Component không nói được điều đó.
 * @param query Query đã dựng xong, CHƯA gọi `.limit()`. Helper tự áp biên: để
 *              call site tự gọi `.limit()` là tạo ra hai thứ phải khớp nhau, và
 *              cái phải-nhớ đó chính là hình dạng của TD-005.
 *
 * NÉM LỖI hạ tầng (`error` của PostgREST) — giữ nguyên quy ước throw-on-
 * infrastructure-error của cả 4 file queries.ts. Đường suy giảm mềm duy nhất
 * (`fetchWrongTwiceAttempts`) tự bắt exception ở call site của nó.
 *
 * KHÔNG ném khi chạm trần, và đây là lựa chọn có chủ đích, cùng lập luận với
 * TD-009 / `checkSchemaVersion` / `rateLimitStore`: một danh sách thiếu vài dòng
 * mà làm sập cả trang là đổi hỏng hóc cục bộ lấy sự cố toàn site. Nó trả về đúng
 * `LIST_ROW_CEILING` dòng đầu và để `console.error` gánh phần báo động.
 *
 * ⚠ Vì fail-open, cổng này chỉ có giá trị KHI CÓ NGƯỜI ĐỌC LOG. Nó biến một sự
 * cố vô hình thành một sự cố nhìn thấy được — nó không tự sửa gì cả.
 */
export async function readBounded(label: string, query: BoundedListQuery): Promise<unknown[]> {
  // +1 = dòng mồi. Xin nhiều hơn trần đúng một dòng là toàn bộ cơ chế phát hiện.
  const { data, error } = await query.limit(LIST_ROW_CEILING + 1);
  if (error) throw error;

  const rows = data ?? [];
  if (rows.length <= LIST_ROW_CEILING) return rows;

  // Tới đây nghĩa là dòng mồi đã được giao: dữ liệu thật NHIỀU HƠN trần đã khai.
  // Log phải nói được ba điều, vì người đọc nó sẽ đọc lúc 2 giờ sáng: chuyện gì,
  // hậu quả gì, sửa ở đâu.
  console.error(
    `! BIÊN DANH SÁCH: ${label} có nhiều hơn ${LIST_ROW_CEILING} dòng — ` +
      `danh sách đang bị CẮT CỤT và người dùng không thấy phần còn lại. ` +
      `Đây là lúc phân trang thật (P3), KHÔNG phải lúc nâng LIST_ROW_CEILING ` +
      `(trần PostgREST là ${POSTGREST_MAX_ROWS}, nâng sát nó thì cổng canh này ` +
      `mất khả năng phát hiện).`
  );
  return rows.slice(0, LIST_ROW_CEILING);
}
