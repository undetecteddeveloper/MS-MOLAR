// paginate — cắt một danh sách ĐÃ SẮP THỨ TỰ thành trang. Thuần, không phụ
// thuộc gì, để hai màn hình phân trang (Kho đề, Lịch sử) dùng chung MỘT phép
// số học: off-by-one ở phân trang là lỗi im lặng (trang vẫn đầy, chỉ thiếu
// hoặc lặp đúng một dòng ở mép), nên nó cần được viết một lần và kiểm một lần
// (`__tests__/paginate.test.ts`) thay vì mỗi màn tự chép một bản.
//
// Kẹp `page` vào [1, pageCount] thay vì trả trang rỗng: `?page=999` gõ tay
// (hoặc một liên kết cũ sau khi dữ liệu thu hẹp) phải cho thấy dữ liệu, không
// phải một trang trắng không giải thích gì. Giá trị lạ (NaN, 0, âm) → trang 1.

export type Paginated<T> = {
  items: T[];
  /** Trang thật sự được trả — đã kẹp, có thể khác trang xin. */
  page: number;
  pageCount: number;
  total: number;
};

export function paginate<T>(ordered: T[], page: number, pageSize: number): Paginated<T> {
  const size = Math.max(1, Math.trunc(pageSize) || 1);
  const total = ordered.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pageCount);
  const start = (current - 1) * size;
  return { items: ordered.slice(start, start + size), page: current, pageCount, total };
}
