// Phân trang cho danh sách đề (TD-026, 2026-08-27).
//
// Ở ĐÂY chứ không phải trong `app/(layer2)/queries.ts` vì file đó có
// `import "server-only"`: một hàm THUẦN nằm trong đó thì không thể kiểm bằng
// unit test mà không dựng cả một môi trường server giả — và phép số học phân
// trang là đúng loại code cần unit test nhất (off-by-one im lặng).

/**
 * Số đề mỗi trang của `/exams` (TD-026, 2026-08-27).
 *
 * 12 = 4 hàng × 3 thẻ ở bố cục rộng nhất (lưới tối đa 3 cột, S#19), nên trang
 * cuối không bao giờ để lại một hàng lẻ trơ trọi ở desktop.
 */
export const EXAMS_PAGE_SIZE = 12;

/**
 * Cắt một danh sách ĐÃ SẮP THỨ TỰ thành trang (TD-026, 2026-08-27).
 *
 * ⚠ QUYẾT ĐỊNH: XẾP HẠNG TRƯỚC RỒI MỚI CẮT — không phải cắt rồi xếp ⚠
 *
 * TD-026 nêu ba đường đi và mỗi đường đổi một cam kết khác nhau. Đây là đường
 * (1), và lý do chọn nó:
 *
 *  · Cắt-rồi-xếp (phân trang DB-side, `.range()`) giảm tải DB nhiều nhất và
 *    PHÁ ADR-0015: `rankExamIds` chỉ nhìn thấy 12 đề của trang hiện tại, nên
 *    "xếp hạng cá nhân hoá" trở thành "xếp hạng trong phạm vi 12 đề tình cờ
 *    nằm cạnh nhau". Thứ tự sai theo trang là kiểu hỏng KHÔNG NHÌN RA ĐƯỢC —
 *    trang vẫn đầy đề, chỉ là sai đề. Loại.
 *  · Chuyển hẳn ranking xuống SQL đúng cả hai vế và là một bản viết lại của
 *    một thuật toán đã có test, cho một catalog hiện có 8 đề (đo prod
 *    2026-08-27). Đó là chi phí đi trước nhu cầu — để dành cho lúc catalog
 *    thật sự tiến tới cửa sổ xếp hạng.
 *  · Xếp-rồi-cắt (đường này) giữ ADR-0015 NGUYÊN VẸN: `rankExamIds` vẫn nhận
 *    trọn tập ứng viên, thứ tự y hệt trước, phân trang thuần tuý là chuyện
 *    TRÌNH BÀY. Không giảm tải DB — và đó là cái giá đã biết, không phải sơ
 *    suất.
 *
 * ⚠ PHẦN NÓ KHÔNG LÀM, đừng đọc nhầm: đây KHÔNG phải phân trang không giới
 * hạn. `fetchExamRows` vẫn đọc trong biên `LIST_ROW_CEILING` (500), nên tập
 * ứng viên — và do đó tổng số trang — bị chặn ở cửa sổ đó. Vượt 500 đề thì
 * `readBounded` kêu vào log (dòng mồi, `boundedRead.ts`) và ĐÓ là tín hiệu để
 * chuyển sang đường SQL, không phải để nới hằng số này lên.
 *
 * Export (thay vì để private) vì phép số học trang là chỗ off-by-one sinh
 * sống, và nó kiểm được mà không cần dựng cả một Supabase giả — xem
 * `__tests__/paginateExams.test.ts`.
 *
 * MỘT ngữ nghĩa phân trang cho CẢ HAI nhánh (`?sort` tường minh lẫn mặc định
 * cá nhân hoá), cố ý: hai ngữ nghĩa khác nhau sẽ làm tổng số trang nhảy khi
 * người dùng bấm đổi kiểu sắp xếp, và không có cách nào giải thích điều đó cho
 * họ.
 */
export function paginateExams<T>(
  ordered: T[],
  page: number
): { exams: T[]; page: number; pageCount: number; total: number } {
  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / EXAMS_PAGE_SIZE));
  // Kẹp thay vì trả trang rỗng: `?page=999` gõ tay (hoặc một link cũ sau khi
  // đề bị gỡ) phải cho thấy đề, không phải một lưới trắng không giải thích gì.
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * EXAMS_PAGE_SIZE;
  return { exams: ordered.slice(start, start + EXAMS_PAGE_SIZE), page: current, pageCount, total };
}
